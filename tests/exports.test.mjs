import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateStoreTest } from './platform.mjs';
import { spawnSync } from 'node:child_process';
import {
  canonicalSerialize, parseCsv, profileFiles, profileRecords, queryProfile, reviewBaseDigest, sha256, validateCorpus,
} from '../scripts/contract.mjs';
import { applyReview } from '../scripts/review.mjs';
import { applyItemReview, reviewSnapshot } from '../src/hitl.mjs';
import { GUIDE_VERSION, checksFor } from '../src/review-guide.mjs';
import { createModel } from '../src/model.mjs';
import { talkBundle, talkMarkdown } from '../src/explore.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = new URL('./fixtures/benign/core-only.json', import.meta.url);
function acceptItem(corpus, itemKey, action = 'accept') {
  const type = itemKey.split(':')[0];
  applyItemReview(corpus, { itemKey, action, snapshot: reviewSnapshot(corpus).snapshot,
    reviewer: 'synthetic-human-reviewer', selfAttested: true, guideVersion: GUIDE_VERSION,
    rationale: 'Synthetic offline export fixture; not a research decision.',
    ...(action === 'accept' ? { checks: Object.fromEntries(Object.keys(checksFor(type)).map(k => [k, { result: 'pass' }])) } :
      { exclusionReason: 'outside scope' }) });
}
const run = args => {
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/contract.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(child.error, undefined);
  return { exit: child.status, ...JSON.parse(child.stdout) };
};

test('AP-08 talk projection closes catalog parents, sources and exact revisions without canvas state', async () => {
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
  const technique = corpus.frameworks[0];
  technique.parentId = 'synthetic-parent';
  corpus.frameworks.push({ ...technique, id: 'synthetic-parent', parentId: undefined });
  const m = createModel(corpus), before = canonicalSerialize(corpus), bundle = talkBundle(m, corpus.paths[0].caseId);
  assert.equal(bundle.frameworks.length, 2);
  for (const claim of bundle.claims) {
    assert.ok(bundle.sources.some(s => s.id === claim.sourceId));
    assert.ok(bundle.revisionProvenance.some(r => r.id === claim.sourceRevisionId && r.bodyIncluded === false
      && !Object.hasOwn(r, 'normalizedContent')));
    for (const id of claim.passageIds) assert.ok(bundle.passages.some(p => p.id === id));
  }
  assert.match(talkMarkdown(bundle), /recorded relationship|Recorded relationship/);
  assert.match(talkMarkdown(bundle), /Broader behavior\/case/);
  assert.equal(Object.hasOwn(bundle, 'positions'), false);
  assert.equal(Object.hasOwn(bundle, 'viewBox'), false);
  assert.equal(canonicalSerialize(corpus), before);
});

test('AP-08 talk export fails closed on cross-case support and invalid node mapping scope', async () => {
  const base = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
  for (const change of [
    m => { m.claimIds = ['synthetic-claim-c']; },
    m => { m.pathId = 'other-case-path'; m.nodeId = 'node'; },
    m => { m.pathId = base.paths[0].id; },
    m => { m.pathId = base.paths[0].id; m.nodeId = base.paths[0].nodes[0].id; m.claimIds = ['synthetic-claim-a', 'synthetic-claim-b']; },
  ]) {
    const corpus = structuredClone(base); change(corpus.mappings[0]);
    assert.throws(() => talkBundle(createModel(corpus), base.paths[0].caseId), /Invalid mapping support scope/);
  }
  const corpus = structuredClone(base);
  corpus.paths[0].edges[0].claimIds = ['synthetic-claim-c'];
  assert.throws(() => talkBundle(createModel(corpus), base.paths[0].caseId), /Invalid path support scope/);
});

test('AP-02/08 standalone shared behavior exports project every claim and occurrence to the selected case', async () => {
  const corpus = JSON.parse(await readFile(fixture, 'utf8'));
  corpus.behaviors = [{
    id: 'shared-behavior', name: 'Shared synthetic behavior', origin: 'Human authored', disposition: 'Pending',
    claimIds: ['synthetic-claim-a', 'synthetic-claim-c'],
    occurrences: [
      { caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a', 'synthetic-claim-c'] },
      { caseId: 'synthetic-case-b', claimIds: ['synthetic-claim-c'] },
      { claimIds: ['synthetic-claim-a', 'synthetic-claim-c'] },
    ],
  }];
  const m = createModel(corpus), before = canonicalSerialize(corpus);
  for (const caseId of ['synthetic-case-a', 'synthetic-case-b']) {
    const bundle = talkBundle(m, caseId), behavior = bundle.behaviors[0], claimIds = new Set(bundle.claims.map(c => c.id));
    const otherClaim = caseId === 'synthetic-case-a' ? 'synthetic-claim-c' : 'synthetic-claim-a';
    assert.equal(bundle.paths.length, 0); assert.equal(bundle.mappings.length, 0);
    assert.ok(behavior.claimIds.length);
    for (const id of [...behavior.claimIds, ...behavior.occurrences.flatMap(o => o.claimIds)]) assert.ok(claimIds.has(id));
    assert.ok(behavior.occurrences.every(o => !o.caseId || o.caseId === caseId));
    assert.ok(!JSON.stringify(behavior).includes(otherClaim));
    assert.ok(!talkMarkdown(bundle).includes(otherClaim));
    assert.match(talkMarkdown(bundle), /Case-scoped behavior projection.*other-case support omitted/i);
    for (const claim of bundle.claims) for (const id of claim.passageIds) assert.ok(bundle.passages.some(p => p.id === id));
  }
  assert.equal(canonicalSerialize(corpus), before);
});

async function exportFixture({ accepted = false, optional = false, standalone = false } = {}) {
  const corpus = JSON.parse(await readFile(fixture, 'utf8'));
  if (optional) {
    corpus.behaviors = [{
      id: 'synthetic-behavior-a', namespace: 'synthetic', name: 'Synthetic behavior',
      boundary: 'No real behavior or incident.', description: 'Optional synthetic enrichment fixture.',
      claimIds: ['synthetic-claim-a'], caseId: 'synthetic-case-a',
      signalIds: [], detectionIds: [], otelIds: [], origin: 'Human authored', disposition: 'Pending',
    }];
    corpus.paths = [{
      id: 'synthetic-path-a', caseId: 'synthetic-case-a',
      nodes: [{
        id: 'synthetic-node-a', title: 'Synthetic step', detail: 'Synthetic evidence only.',
        claimIds: ['synthetic-claim-a'], behaviorIds: ['synthetic-behavior-a'],
        evidenceStatus: 'Source-reported observation', origin: 'Human authored', disposition: 'Pending',
      }],
      edges: [], scope: 'representative', origin: 'Human authored', disposition: 'Pending',
    }];
    corpus.cases.find(item => item.id === 'synthetic-case-a').pathIds = ['synthetic-path-a'];
  }
  if (standalone) {
    corpus.behaviors = [
      {
        id: 'standalone-behavior-a', namespace: 'synthetic', name: 'Standalone behavior A',
        boundary: 'Synthetic standalone behavior.', description: 'Claim-linked without a path or mapping.',
        caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'],
        occurrences: [{ caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'] }],
        signalIds: ['standalone-signal-a'], detectionIds: ['standalone-detection-a'], otelIds: [],
        origin: 'Human authored', disposition: 'Pending',
      },
      {
        id: 'framework-behavior-a', namespace: 'synthetic', name: 'Mapped behavior A',
        boundary: 'Synthetic mapped behavior.', description: 'Exercises framework parent closure.',
        caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'],
        signalIds: [], detectionIds: [], otelIds: [], origin: 'Human authored', disposition: 'Pending',
      },
      {
        id: 'standalone-behavior-c', namespace: 'synthetic', name: 'Standalone behavior C',
        boundary: 'Synthetic other-case behavior.', description: 'Must remain isolated from case A.',
        caseId: 'synthetic-case-b', claimIds: ['synthetic-claim-c'],
        signalIds: ['standalone-signal-c'], detectionIds: [], otelIds: [],
        origin: 'Human authored', disposition: 'Pending',
      },
    ];
    corpus.telemetry = [
      {
        id: 'standalone-signal-a', behaviorId: 'standalone-behavior-a', category: 'synthetic',
        eventType: 'synthetic-a', logicalFields: [], joinKeys: [], availability: 'fixture',
        schema: 'synthetic/1', limitations: 'Synthetic fixture only.', origin: 'Human authored', disposition: 'Pending',
      },
      {
        id: 'standalone-signal-a-reverse', behaviorId: 'standalone-behavior-a', category: 'synthetic',
        eventType: 'synthetic-a-reverse', logicalFields: [], joinKeys: [], availability: 'fixture',
        schema: 'synthetic/1', limitations: 'Synthetic fixture only.', origin: 'Human authored', disposition: 'Pending',
      },
      {
        id: 'standalone-signal-c', behaviorId: 'standalone-behavior-c', category: 'synthetic',
        eventType: 'synthetic-c', logicalFields: [], joinKeys: [], availability: 'fixture',
        schema: 'synthetic/1', limitations: 'Synthetic fixture only.', origin: 'Human authored', disposition: 'Pending',
      },
    ];
    corpus.otel = [{
      id: 'standalone-otel-a', behaviorId: 'standalone-behavior-a', action: 'synthetic action',
      standardSourceIds: ['synthetic-source-a'], customFields: [], sample: {}, sampleFormat: 'synthetic',
      sampleOrigin: 'Synthetic inert fixture', stability: 'fixture', limitations: 'Synthetic fixture only.',
      origin: 'Human authored', disposition: 'Pending',
    }];
    corpus.detections = [{
      id: 'standalone-detection-a', behaviorId: 'standalone-behavior-a',
      hypothesis: 'Synthetic hypothesis.', signalIds: ['standalone-signal-a-reverse'], otelIds: ['standalone-otel-a'],
      windowSeconds: 60, windowBasis: 'Synthetic fixture.', tuning: 'None.', testPlan: 'Fixture assertion.',
      validation: 'Not validated.', origin: 'Human authored', disposition: 'Pending',
    }];
    const catalogSource = structuredClone(corpus.sources.find(source => source.id === 'synthetic-source-b'));
    Object.assign(catalogSource, {
      id: 'synthetic-catalog-source',
      originalUrl: 'https://example.invalid/catalog',
      canonicalUrl: 'https://example.invalid/catalog',
      title: 'Synthetic official framework catalog',
      revisionIds: [],
      extractionStatus: 'Not started',
      collectionState: 'Collected',
    });
    corpus.sources.push(catalogSource);
    corpus.frameworks = [
      {
        id: 'synthetic-parent-technique', name: 'Synthetic parent', framework: 'ATT&CK', version: 'test',
        sourceId: 'synthetic-catalog-source', url: 'https://example.invalid/parent',
      },
      {
        id: 'synthetic-child-technique', name: 'Synthetic child', framework: 'ATT&CK', version: 'test',
        sourceId: 'synthetic-catalog-source', url: 'https://example.invalid/child', parentId: 'synthetic-parent-technique',
      },
    ];
    corpus.mappings = [{
      id: 'synthetic-framework-mapping-a', caseId: 'synthetic-case-a', behaviorId: 'framework-behavior-a',
      framework: 'ATT&CK', version: 'test', techniqueId: 'synthetic-child-technique',
      claimIds: ['synthetic-claim-a'], rationale: 'Synthetic mapping.', applicability: 'Fixture only.',
      origin: 'Human authored', mappingStatus: 'Proposed', disposition: 'Pending',
    }];
  }
  if (accepted) {
    for (const claimId of ['synthetic-claim-a', 'synthetic-claim-b']) {
      acceptItem(corpus, `claims:${claimId}`);
    }
    acceptItem(corpus, 'cases:synthetic-case-a');
    // Explicit synthetic decisions replace the old automatic optional-enrichment inclusion.
    for (;;) {
      const next = reviewSnapshot(corpus).units.find(u => u.caseIds.includes('synthetic-case-a') &&
        u.type !== 'claims' && !u.eligible && !u.blockers.length && u.labels.state === 'complete');
      if (!next) break;
      acceptItem(corpus, next.itemKey);
    }
    assert.deepEqual(validateCorpus(corpus), []);
  }
  return corpus;
}

test('Issue #24 AC-01/05 reviewed zero-eligible profile is deterministic and excludes private snapshots', async () => {
  const corpus = await exportFixture();
  const snapshot = profileRecords(corpus);
  const firstFiles = profileFiles(snapshot), secondFiles = profileFiles(profileRecords(corpus));
  assert.equal(snapshot.snapshotDigest, profileRecords(corpus).snapshotDigest);
  assert.deepEqual(snapshot.coverage.units, { cases: 0, sources: 0, claims: 0 });
  assert.deepEqual(Object.keys(firstFiles).sort(), ['cases.csv', 'manifest.json', 'records.jsonl', 'schema.json', 'sources.csv', 'timelines.csv']);
  assert.deepEqual(firstFiles, secondFiles);
  const contents = Object.entries(firstFiles).filter(([name]) => name !== 'schema.json').map(([, content]) => content).join('\n');
  assert.doesNotMatch(contents, /A tool was used in a benign exercise\./);
  assert.doesNotMatch(contents, /rawContent|normalizedContent/);
  const manifest = JSON.parse(firstFiles['manifest.json']);
  assert.equal(manifest.profile, 'reviewed');
  assert.equal(manifest.snapshotDigest, snapshot.snapshotDigest);
  assert.deepEqual(Object.keys(manifest.files), ['cases.csv', 'records.jsonl', 'schema.json', 'sources.csv', 'timelines.csv']);
  for (const [name, hash] of Object.entries(manifest.files)) assert.equal(hash, sha256(firstFiles[name]));
});

test('Issue #24 AC-01/03/04 reviewed profile and bundle retain accepted closure and applicable optional context', async () => {
  const corpus = await exportFixture({ accepted: true, optional: true });
  const snapshot = profileRecords(corpus);
  const listed = queryProfile(snapshot, 'list', { entity: 'claims' });
  assert.deepEqual(snapshot.coverage.units, { cases: 1, sources: 2, claims: 2 });
  assert.equal(listed.unit, 'claim');
  assert.equal(listed.records.length, 2);
  assert.ok(listed.records.every(record => record.reviewStatus.currentAcceptance));

  const fetched = queryProfile(snapshot, 'get', { entity: 'claims', id: 'synthetic-claim-a' });
  assert.equal(fetched.record.entity.id, 'synthetic-claim-a');
  const bundle = queryProfile(snapshot, 'bundle', { caseId: 'synthetic-case-a' });
  assert.equal(bundle.unit, 'case bundle');
  for (const type of ['claims', 'sources', 'sourceRevisions', 'passages']) {
    assert.ok(bundle.records.some(record => record.entityType === type), `${type} missing from bundle`);
  }
  assert.ok(bundle.records.every(record => !record.entity.rawContent && !record.entity.normalizedContent));
  assert.ok(bundle.records.some(record => record.entityType === 'paths'));
  assert.ok(bundle.records.some(record => record.entityType === 'behaviors' && record.reviewStatus.currentAcceptance));
  assert.equal(bundle.digest, snapshot.snapshotDigest);
  const files = profileFiles(snapshot);
  const jsonLines = files['records.jsonl'].trimEnd().split('\n').map(line => JSON.parse(line));
  assert.ok(jsonLines.every(record => record.schemaVersion === '0.3.0' && record.entityType && record.entity));
  assert.ok(jsonLines.some(record => record.entityType === 'sourceRevisions' && record.entity.rawContent === null
    && record.entity.normalizedContent === null));
  assert.doesNotMatch(files['records.jsonl'], /A tool was used in a benign exercise\./);
});

test('Issue #45 standalone behaviors retain exact support and complete case-scoped enrichment closure', async () => {
  const corpus = await exportFixture({ accepted: true, standalone: true });
  const reviewed = profileRecords(corpus);
  const draft = profileRecords(corpus, 'draft');
  const reviewedIds = new Set(reviewed.records.map(record => `${record.entityType}:${record.entity.id}`));

  assert.ok(reviewedIds.has('behaviors:standalone-behavior-a'));
  assert.ok(reviewedIds.has('behaviors:framework-behavior-a'));
  assert.ok(!reviewedIds.has('behaviors:standalone-behavior-c'));
  assert.ok(!reviewedIds.has('telemetry:standalone-signal-c'));
  assert.deepEqual(
    reviewed.records.find(record => record.entityType === 'behaviors'
      && record.entity.id === 'standalone-behavior-a').entity.claimIds,
    ['synthetic-claim-a'],
  );
  for (const key of [
    'telemetry:standalone-signal-a',
    'telemetry:standalone-signal-a-reverse',
    'detections:standalone-detection-a',
    'otel:standalone-otel-a',
    'frameworks:synthetic-child-technique',
    'frameworks:synthetic-parent-technique',
    'sources:synthetic-catalog-source',
  ]) assert.ok(reviewedIds.has(key), `${key} missing from reviewed closure`);
  assert.ok(draft.records.some(record => record.entityType === 'behaviors'
    && record.entity.id === 'standalone-behavior-c'));

  for (const profile of [reviewed, draft]) {
    const bundle = queryProfile(profile, 'bundle', { caseId: 'synthetic-case-a' });
    const ids = new Set(bundle.records.map(record => `${record.entityType}:${record.entity.id}`));
    for (const key of [
      'behaviors:standalone-behavior-a',
      'telemetry:standalone-signal-a',
      'telemetry:standalone-signal-a-reverse',
      'detections:standalone-detection-a',
      'otel:standalone-otel-a',
      'frameworks:synthetic-child-technique',
      'frameworks:synthetic-parent-technique',
      'sources:synthetic-catalog-source',
    ]) assert.ok(ids.has(key), `${key} missing from ${profile.profile} bundle`);
    assert.ok(!ids.has('behaviors:standalone-behavior-c'));
    assert.ok(!ids.has('telemetry:standalone-signal-c'));
    assert.equal(bundle.records.filter(record => record.entityType === 'paths').length, 0);
    assert.equal(bundle.records.filter(record => record.entityType === 'mappings'
      && record.entity.behaviorId === 'standalone-behavior-a').length, 0);
  }

  const otherCase = queryProfile(draft, 'bundle', { caseId: 'synthetic-case-b' });
  const otherIds = new Set(otherCase.records.map(record => `${record.entityType}:${record.entity.id}`));
  assert.ok(otherIds.has('behaviors:standalone-behavior-c'));
  assert.ok(otherIds.has('telemetry:standalone-signal-c'));
  assert.ok(!otherIds.has('behaviors:standalone-behavior-a'));
});

test('Issue #45 case bundles close every selected source revision reference', async () => {
  const corpus = await exportFixture();
  const latestRevision = structuredClone(
    corpus.sourceRevisions.find(revision => revision.id === 'synthetic-revision-a'),
  );
  latestRevision.id = 'synthetic-revision-a-latest';
  corpus.sourceRevisions.push(latestRevision);
  corpus.sources.find(source => source.id === 'synthetic-source-a').revisionIds.push(latestRevision.id);
  const latestPassage = structuredClone(
    corpus.passages.find(passage => passage.id === 'synthetic-passage-a'),
  );
  latestPassage.id = 'synthetic-passage-a-latest';
  latestPassage.sourceRevisionId = latestRevision.id;
  corpus.passages.push(latestPassage);
  const latestClaim = corpus.claims.find(claim => claim.id === 'synthetic-claim-c');
  latestClaim.sourceRevisionId = latestRevision.id;
  latestClaim.passageIds = [latestPassage.id];

  const draft = profileRecords(corpus, 'draft');
  for (const caseId of ['synthetic-case-a', 'synthetic-case-b']) {
    const bundle = queryProfile(draft, 'bundle', { caseId });
    const revisionIds = new Set(bundle.records
      .filter(record => record.entityType === 'sourceRevisions')
      .map(record => record.entity.id));
    for (const source of bundle.records.filter(record => record.entityType === 'sources')) {
      for (const revisionId of source.entity.revisionIds) {
        assert.ok(revisionIds.has(revisionId), `${caseId} missing source revision ${revisionId}`);
      }
    }
    assert.ok(revisionIds.has('synthetic-revision-a'));
    assert.ok(revisionIds.has('synthetic-revision-a-latest'));
  }
});

test('Issue #24 AC-02 CSV preserves null reasons, labels, date precision, and safe formula-like values', async () => {
  const corpus = await exportFixture();
  corpus.cases[0].name = '=SUM(1,1)';
  corpus.cases[0].summary = 'Line 1, "quoted"\nline 2';
  const files = profileFiles(profileRecords(corpus, 'draft'));
  const caseRows = parseCsv(files['cases.csv']);
  const nameColumn = caseRows[0].indexOf('name');
  const caseRow = caseRows.find(row => row[caseRows[0].indexOf('id')] === 'synthetic-case-a');
  assert.equal(caseRow[caseRows[0].indexOf('profile')], 'draft');
  assert.match(caseRow[caseRows[0].indexOf('warnings')], /Draft profile/);
  assert.equal(caseRow[nameColumn], '=SUM(1,1)');
  assert.equal(caseRow[caseRows[0].indexOf('summary')], 'Line 1, "quoted"\nline 2');
  assert.deepEqual(JSON.parse(caseRow[caseRows[0].indexOf('aliases')]), ['Benign A']);
  assert.deepEqual(JSON.parse(caseRow[caseRows[0].indexOf('nullReasons')]), {});
  const timelineRows = parseCsv(files['timelines.csv']);
  const dateColumn = timelineRows[0].indexOf('date');
  const month = timelineRows.find(row => row[timelineRows[0].indexOf('id')] === 'synthetic-month');
  assert.equal(JSON.parse(month[dateColumn]).precision, 'month');
  const sourceRows = parseCsv(files['sources.csv']);
  const source = sourceRows.find(row => row[sourceRows[0].indexOf('id')] === 'synthetic-source-a');
  assert.equal(source[sourceRows[0].indexOf('author')], '');
  assert.equal(JSON.parse(source[sourceRows[0].indexOf('nullReasons')]).author, 'not_reported');
  assert.match(files['cases.csv'], /"'=SUM\(1,1\)"/);
});

test('Issue #24 AC-01/03 unsupported versions and unknown entity IDs fail explicitly', async () => {
  const corpus = await exportFixture();
  assert.throws(() => profileRecords({ ...corpus, schemaVersion: '1.0.0' }), /unsupported schema version/);
  const dangling = structuredClone(corpus);
  dangling.claims[0].sourceId = 'missing-source';
  assert.throws(() => profileRecords(dangling), /claims:synthetic-claim-a: dangling sources missing-source/);
  assert.throws(() => queryProfile(profileRecords(corpus), 'get', { entity: 'claims', id: 'missing' }), /unknown claims ID/);
  assert.throws(() => queryProfile(profileRecords(corpus), 'list', { entity: 'telemetry' }), /entity must be/);
});

test('Issue #24 AC-04 stale decisions and missing conflict dependency never enter reviewed profile', async () => {
  const stale = await exportFixture({ accepted: true });
  stale.claims.find(item => item.id === 'synthetic-claim-a').description = 'Changed synthetic claim; prior decision is stale.';
  const staleProfile = profileRecords(stale);
  assert.deepEqual(staleProfile.coverage.units, { cases: 0, sources: 0, claims: 0 });
  assert.equal(staleProfile.coverage.reviewCoverage.claims.staleAcceptance, 2);

  const excluded = await exportFixture({ accepted: true });
  acceptItem(excluded, 'claims:synthetic-claim-b', 'exclude');
  assert.deepEqual(profileRecords(excluded).coverage.units, { cases: 1, sources: 1, claims: 1 });
  assert.equal(profileRecords(excluded).records.find(r => r.entityType === 'cases').entity.contextOnly, true);
  assert.equal(profileRecords(excluded).records.find(r => r.entityType === 'claims').entity.conflictsWithheld, true);
});

privateStoreTest('Issue #24 AC-01/03 CLI writes deterministic allowlisted profiles and fails closed', async t => {
  const privateRoot = path.join(root, '.private-intake');
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(privateRoot, 'exports-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corpusFile = path.join(directory, 'corpus.json');
  await writeFile(corpusFile, canonicalSerialize(await exportFixture()), { mode: 0o600 });
  const first = path.join(directory, 'reviewed-a'), second = path.join(directory, 'reviewed-b');
  const one = run(['export', '--file', corpusFile, '--profile', 'reviewed', '--out', first]);
  const two = run(['export', '--file', corpusFile, '--profile', 'reviewed', '--out', second]);
  assert.equal(one.exit, 0, JSON.stringify(one));
  assert.equal(one.snapshotDigest, two.snapshotDigest);
  for (const name of (await readdir(first)).sort()) {
    assert.equal(await readFile(path.join(first, name), 'utf8'), await readFile(path.join(second, name), 'utf8'));
  }
  assert.equal(run(['get', '--file', corpusFile, '--entity', 'claims', '--id', 'missing']).code, 'NOT_FOUND');
  assert.equal(run(['export', '--file', corpusFile, '--out', first]).code, 'OUTPUT_EXISTS');
});
