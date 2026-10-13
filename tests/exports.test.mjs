import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  canonicalSerialize, parseCsv, profileFiles, profileRecords, queryProfile, reviewBaseDigest, sha256, validateCorpus,
} from '../scripts/contract.mjs';
import { applyReview } from '../scripts/review.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = new URL('./fixtures/benign/core-only.json', import.meta.url);
const run = args => {
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/contract.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(child.error, undefined);
  return { exit: child.status, ...JSON.parse(child.stdout) };
};

async function setup(t, { accepted = false, optional = false } = {}) {
  const privateRoot = path.join(root, '.private-intake');
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(privateRoot, 'exports-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corpusFile = path.join(directory, 'corpus.json');
  const corpus = JSON.parse(await readFile(fixture, 'utf8'));
  if (optional) {
    corpus.behaviors = [{
      id: 'synthetic-behavior-a', namespace: 'synthetic', name: 'Synthetic behavior',
      boundary: 'No real behavior or incident.', description: 'Optional synthetic enrichment fixture.',
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
  if (accepted) {
    for (const claimId of ['synthetic-claim-a', 'synthetic-claim-b']) {
      applyReview(corpus, {
        schemaVersion: 'manual-review/1',
        claimId,
        action: 'accept',
        baseDigest: reviewBaseDigest(corpus),
        rationale: 'Synthetic offline export fixture; not a research decision.',
      }, 'synthetic-human-reviewer');
    }
    assert.deepEqual(validateCorpus(corpus), []);
  }
  await writeFile(corpusFile, canonicalSerialize(corpus), { mode: 0o600 });
  return { directory, corpusFile, corpus };
}

test('Issue #24 AC-01/05 reviewed zero-eligible profile is deterministic and excludes private snapshots', async t => {
  const { corpus } = await setup(t);
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

test('Issue #24 AC-01/03/04 reviewed profile and bundle retain accepted closure and applicable optional context', async t => {
  const { corpus } = await setup(t, { accepted: true, optional: true });
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
  assert.ok(bundle.records.some(record => record.entityType === 'behaviors' && record.warnings.some(warning => warning.includes('Optional enrichment'))));
  assert.equal(bundle.digest, snapshot.snapshotDigest);
  const files = profileFiles(snapshot);
  const jsonLines = files['records.jsonl'].trimEnd().split('\n').map(line => JSON.parse(line));
  assert.ok(jsonLines.every(record => record.schemaVersion === '0.3.0' && record.entityType && record.entity));
  assert.ok(jsonLines.some(record => record.entityType === 'sourceRevisions' && record.entity.rawContent === null
    && record.entity.normalizedContent === null));
  assert.doesNotMatch(files['records.jsonl'], /A tool was used in a benign exercise\./);
});

test('Issue #24 AC-02 CSV preserves null reasons, labels, date precision, and safe formula-like values', async t => {
  const { corpus } = await setup(t);
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

test('Issue #24 AC-01/03 unsupported versions and unknown entity IDs fail explicitly', async t => {
  const { corpus } = await setup(t);
  assert.throws(() => profileRecords({ ...corpus, schemaVersion: '1.0.0' }), /unsupported schema version/);
  const dangling = structuredClone(corpus);
  dangling.claims[0].sourceId = 'missing-source';
  assert.throws(() => profileRecords(dangling), /claims:synthetic-claim-a: dangling sources missing-source/);
  assert.throws(() => queryProfile(profileRecords(corpus), 'get', { entity: 'claims', id: 'missing' }), /unknown claims ID/);
  assert.throws(() => queryProfile(profileRecords(corpus), 'list', { entity: 'telemetry' }), /entity must be/);
});

test('Issue #24 AC-04 stale decisions and missing conflict dependency never enter reviewed profile', async t => {
  const { corpus: stale } = await setup(t, { accepted: true });
  stale.claims.find(item => item.id === 'synthetic-claim-a').description = 'Changed synthetic claim; prior decision is stale.';
  const staleProfile = profileRecords(stale);
  assert.deepEqual(staleProfile.coverage.units, { cases: 0, sources: 0, claims: 0 });
  assert.equal(staleProfile.coverage.reviewCoverage.claims.staleAcceptance, 2);

  const { corpus: excluded } = await setup(t, { accepted: true });
  applyReview(excluded, {
    schemaVersion: 'manual-review/1',
    claimId: 'synthetic-claim-b',
    action: 'exclude',
    baseDigest: reviewBaseDigest(excluded),
    rationale: 'Synthetic exclusion fixture; not a research decision.',
  }, 'synthetic-human-reviewer');
  assert.deepEqual(profileRecords(excluded).coverage.units, { cases: 0, sources: 0, claims: 0 });
});

test('Issue #24 AC-01/03 CLI writes deterministic allowlisted profiles and fails closed', {
  skip: process.platform === 'win32' ? 'existing private corpus mode checks require POSIX permissions' : false,
}, async t => {
  const { directory, corpusFile } = await setup(t);
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
