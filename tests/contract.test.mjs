import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertValid, validateCorpus, validateShape, canonicalSerialize, canonicalUrl, digest, sha256, schema,
  normalizeText, stableId, entityContentHash, dependencyHashes, reviewBaseDigest, currentReview, assertAppendOnlyReviews,
} from '../scripts/contract.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = () => read('./fixtures/benign/core-only.json');
const dateValue = value => value === null
  ? { precision: 'unknown', value: null, start: null, end: null, nullReasons: { value: 'not_reported', start: 'not_applicable', end: 'not_applicable' } }
  : { precision: { 4: 'year', 7: 'month', 10: 'day' }[value.length], value, start: null, end: null, nullReasons: { start: 'not_applicable', end: 'not_applicable' } };
function enrichmentFixture() {
  const corpus = fixture();
  corpus.cases[0].pathIds = ['synthetic-path'];
  corpus.paths = [{
    id: 'synthetic-path', caseId: 'synthetic-case-a', scope: 'representative', origin: 'Human authored', disposition: 'Pending',
    nodes: [
      {
        id: 'synthetic-node', title: 'Synthetic action', detail: 'Synthetic optional enrichment.',
        claimIds: ['synthetic-claim-a'], behaviorIds: ['synthetic-behavior'],
        evidenceStatus: 'Source-reported observation', origin: 'Human authored', disposition: 'Pending',
      },
      {
        id: 'synthetic-node-b', title: 'Second synthetic action', detail: 'Synthetic node order is meaningful.',
        claimIds: ['synthetic-claim-b'], behaviorIds: ['synthetic-behavior'],
        evidenceStatus: 'Unclear or disputed', origin: 'Human authored', disposition: 'Pending',
      },
    ],
    edges: [],
  }];
  corpus.behaviors = [{
    id: 'synthetic-behavior', namespace: 'synthetic', name: 'Synthetic action', boundary: 'Synthetic boundary',
    description: 'Synthetic optional behavior.', signalIds: [], detectionIds: [], otelIds: [],
    origin: 'Human authored', disposition: 'Pending',
  }];
  corpus.frameworks = [{
    id: 'synthetic-technique', name: 'Synthetic technique', framework: 'ATT&CK', version: 'test',
    sourceId: 'synthetic-source-a', url: 'https://example.invalid/technique',
  }];
  corpus.mappings = [{
    id: 'synthetic-mapping', caseId: 'synthetic-case-a', behaviorId: 'synthetic-behavior',
    framework: 'ATT&CK', version: 'test', techniqueId: 'synthetic-technique',
    pathId: 'synthetic-path', nodeId: 'synthetic-node', claimIds: ['synthetic-claim-a'],
    rationale: 'Synthetic mapping rationale.', applicability: 'Synthetic fixture only.',
    origin: 'Human authored', mappingStatus: 'Proposed', disposition: 'Pending',
  }];
  return corpus;
}
function fails(corpus, pattern) {
  const errors = validateCorpus(corpus);
  assert.ok(errors.some(error => error.includes(pattern)), `expected ${pattern}; got ${errors.join('\n')}`);
}
function accept(corpus, type, entity) {
  entity.disposition = 'Accepted';
  const event = {
    id: `review-${type}-${entity.id}`, entityType: type, entityId: entity.id, revision: entity.revision,
    baseDigest: reviewBaseDigest(corpus), reviewer: 'synthetic-human-reviewer', reviewerKind: 'human',
    timestamp: '2026-10-12T12:00:00Z', disposition: 'Accepted', rationale: 'Synthetic fixture review assertion; no authentication or research approval.',
    contentHash: entityContentHash(entity), dependencyHashes: dependencyHashes(corpus, type, entity.id),
  };
  corpus.reviews.push(event);
  entity.history.push(event.id);
  return event;
}

test('AC-01 supplied-text source-only intake permits absent URLs with provenance and null reasons', () => {
  const corpus = fixture();
  corpus.sources = [corpus.sources[0]];
  corpus.sourceRevisions = [];
  corpus.sources[0].revisionIds = [];
  corpus.sources[0].collectionState = 'Collected';
  corpus.sources[0].extractionStatus = 'Not started';
  for (const type of ['passages', 'cases', 'claims', 'categorizations', 'timelines', 'collectionManifests']) corpus[type] = [];
  assertValid(corpus);
  delete corpus.sources[0].nullReasons.originalUrl;
  fails(corpus, 'null requires a field-specific null reason');
  corpus.sources[0].nullReasons.originalUrl = 'not_applicable';
  corpus.sources[0].provenance.kind = 'supplied-url';
  fails(corpus, 'URL absence requires supplied-text provenance');
});

test('AC-02 many-to-many links retain case-scoped shared passage identity without attribution', () => {
  const corpus = assertValid(fixture());
  assert.equal(corpus.cases[0].sourceIds.length, 2);
  assert.equal(corpus.claims[0].sourceId, corpus.claims[2].sourceId);
  assert.notEqual(corpus.claims[0].caseId, corpus.claims[2].caseId);
  assert.deepEqual(corpus.claims[0].passageIds, corpus.claims[2].passageIds);
  corpus.cases[0].sourceIds = ['synthetic-source-b'];
  fails(corpus, 'source not linked to case');
});

test('AC-03 core-only fixture needs no enrichment modules', () => {
  const corpus = assertValid(fixture());
  for (const name of ['paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel']) assert.equal(Object.hasOwn(corpus, name), false);
  assert.deepEqual(validateShape(corpus), []);
});

for (const negative of read('./fixtures/benign/negative.json')) {
  test(`${negative.gate} negative fixture: ${negative.id}`, () => {
    const corpus = fixture();
    const parent = negative.path.slice(0, -1).reduce((value, key) => value[key], corpus);
    parent[negative.path.at(-1)] = negative.value;
    fails(corpus, negative.error);
  });
}

test('AC-04 duplicate IDs and globally duplicated optional node IDs fail clearly', () => {
  const corpus = fixture();
  corpus.claims.push(structuredClone(corpus.claims[0]));
  fails(corpus, 'duplicate ID');
  const optional = enrichmentFixture();
  optional.paths[0].nodes.push(structuredClone(optional.paths[0].nodes[0]));
  optional.paths[0].nodes[1].id = optional.paths[0].nodes[0].id;
  fails(optional, 'duplicate globally unique node ID');
});

test('AC-04 Unicode passages use code points, not UTF-16; revisions bind raw and normalized content hashes', () => {
  const corpus = assertValid(fixture());
  assert.equal([...corpus.sourceRevisions[0].normalizedContent].slice(2, 6).join(''), 'Café');
  assert.notEqual(corpus.sourceRevisions[0].normalizedContent.slice(2, 6), 'Café');
  assert.equal(normalizeText('Cafe\u0301\r\n'), 'Café\n');
  const mutation = fixture();
  mutation.sourceRevisions[0].rawHash = 'a'.repeat(64);
  fails(mutation, 'rawHash does not match retained content');
  mutation.sourceRevisions[0].normalizedHash = 'b'.repeat(64);
  fails(mutation, 'normalizedHash does not match retained content');
  const mismatch = fixture();
  mismatch.sourceRevisions[0].rawContent = 'Different raw text';
  mismatch.sourceRevisions[0].rawHash = sha256(mismatch.sourceRevisions[0].rawContent);
  fails(mismatch, 'transformation mismatch');
});

test('AC-04 absent retained content requires human attestation and matching normalized revision hash', () => {
  const corpus = fixture(), revision = corpus.sourceRevisions[0], passage = corpus.passages[0];
  revision.rawContent = null;
  revision.normalizedContent = null;
  revision.retention = 'not-retained';
  revision.nullReasons = { rawContent: 'not_applicable', normalizedContent: 'not_applicable' };
  fails(corpus, 'absent retained content requires human');
  passage.attestation = { reviewer: 'synthetic-human', reviewerKind: 'human', timestamp: '2026-10-12T12:00:00Z', revisionHash: revision.normalizedHash, rationale: 'Synthetic reviewer-attested location; retained content unavailable.' };
  delete passage.nullReasons.attestation;
  assertValid(corpus);
  passage.text = null;
  passage.nullReasons.text = 'not_applicable';
  assertValid(corpus);
  passage.attestation.revisionHash = 'a'.repeat(64);
  fails(corpus, 'matching revision hash');
});

test('AC-04 explicit inference requires same-case support, nonempty rationale, no self/cyclic support', () => {
  const corpus = fixture();
  corpus.claims[3].inference.supportingClaimIds = ['synthetic-claim-c'];
  fails(corpus, 'belongs to another case');
  corpus.claims[3].inference.supportingClaimIds = ['synthetic-claim-inference'];
  fails(corpus, 'inference cannot support itself');
  fails(corpus, 'inference support cycle');
  const cycle = fixture();
  cycle.claims[0].evidenceStatus = 'Researcher inference';
  cycle.claims[0].inference = { rationale: 'Synthetic cyclic support.', supportingClaimIds: ['synthetic-claim-inference'] };
  delete cycle.claims[0].nullReasons.inference;
  fails(cycle, 'inference support cycle');
  cycle.claims[0].inference.rationale = '';
  fails(cycle, 'does not match any allowed shape');
});

test('AC-05 null states remain distinct; known values cannot have null reasons; positive AI roles overlap', () => {
  const corpus = assertValid(fixture());
  assert.equal(corpus.sources[0].nullReasons.publisher, 'unknown');
  assert.equal(corpus.sources[0].nullReasons.author, 'not_reported');
  assert.equal(corpus.sources[0].nullReasons.originalUrl, 'not_applicable');
  assert.equal(corpus.categorizations.filter(item => item.dimension === 'ai_involvement' && item.sourceIds.includes('synthetic-source-a')).length, 3);
  corpus.sources[0].nullReasons.title = 'unknown';
  fails(corpus, 'reason must describe an existing null field');
});

test('AC-05 reviewed-source scoped no-AI cannot coexist with positive roles, cross-source disagreement remains', () => {
  const corpus = fixture();
  for (const claim of corpus.claims.slice(0, 2)) accept(corpus, 'claims', claim);
  accept(corpus, 'categorizations', corpus.categorizations[0]);
  accept(corpus, 'categorizations', corpus.categorizations[4]);
  assertValid(corpus);
  corpus.categorizations[4].sourceIds = ['synthetic-source-a'];
  corpus.categorizations[4].supportingClaimIds = ['synthetic-claim-a'];
  fails(corpus, 'no-AI and positive roles conflict');
});

test('AC-05 controlled aliases, explicit other values, and category claim/source scope', () => {
  const corpus = fixture(), category = corpus.categorizations[0];
  category.dimension = 'tool';
  category.value = 'Claude Code';
  assertValid(corpus);
  category.value = 'Claude';
  fails(corpus, 'value not in controlled dimension');
  category.value = 'other';
  fails(corpus, 'other value requires explicit otherText');
  category.otherText = 'Synthetic local tool';
  delete category.nullReasons.otherText;
  assertValid(corpus);
  category.sourceIds = ['synthetic-source-b'];
  fails(corpus, 'source scope must match');
});

test('AC-05 malformed controlled aliases cannot bypass exact membership or throw; unrelated governance survives', () => {
  const corpus = fixture(), category = corpus.categorizations[0];
  category.dimension = 'tool';
  category.value = 'Claude';
  fails(corpus, 'value not in controlled dimension');
  for (const aliases of ['Claude Code', {}, null, [42], [''], [' '], ['Claude Code', 'Claude Code']]) {
    corpus.governance.controlledAliases.tool = aliases;
    assert.doesNotThrow(() => validateCorpus(corpus));
    assert.ok(validateCorpus(corpus).some(error => error.includes('corpus.governance.controlledAliases.tool')), JSON.stringify(aliases));
  }
  corpus.governance.controlledAliases.tool = ['Claude Code'];
  fails(corpus, 'value not in controlled dimension');
  category.value = 'Claude Code';
  corpus.governance.legacyConsumerRule = { retained: true };
  assertValid(corpus);
  assert.deepEqual(corpus.governance.legacyConsumerRule, { retained: true });
});

test('AC-06 real calendar and day/month/year/range/unknown preserve publication vs activity types', () => {
  const corpus = assertValid(fixture());
  assert.deepEqual(new Set(corpus.timelines.map(item => item.date.precision)), new Set(['day', 'month', 'year', 'range', 'unknown']));
  assert.notEqual(corpus.timelines[0].dateType, corpus.timelines[1].dateType);
  assert.equal(corpus.timelines[1].date.value, null);
  assert.equal(dateValue('2026-06').value, '2026-06');
  assert.equal(dateValue('2026').value, '2026');
  corpus.timelines[4].date.start = '2025-09';
  fails(corpus, 'range endpoints must have equal precision and be ordered');
  const centuries = fixture();
  centuries.sources[0].publicationDate.value = '1900-02-29';
  fails(centuries, 'invalid real calendar date');
  centuries.sources[0].publicationDate.value = '2000-02-29';
  centuries.timelines[0].date.value = '2000-02-29';
  assertValid(centuries);
});

test('AC-06 publication metadata must match cited source; unsupported timeline dates fail', () => {
  const corpus = fixture();
  corpus.timelines[0].date.value = '2024-03-01';
  fails(corpus, 'metadata date does not match');
  corpus.timelines[0].sourceRevisionIds = [];
  fails(corpus, 'timeline requires claim or source revision support');
});

test('AC-07 conflicting claims remain separate and reciprocal through canonical roundtrip', () => {
  const corpus = assertValid(JSON.parse(canonicalSerialize(fixture())));
  assert.equal(corpus.claims.find(item => item.id === 'synthetic-claim-a').conflictsWith[0], 'synthetic-claim-b');
  assert.equal(corpus.claims.find(item => item.id === 'synthetic-claim-b').conflictsWith[0], 'synthetic-claim-a');
  corpus.claims.find(item => item.id === 'synthetic-claim-b').conflictsWith = [];
  fails(corpus, 'conflict relation must be reciprocal');
});

test('AC-08 fresh 0.3.0 records validate without importing legacy claims or metadata', () => {
  const corpus = assertValid(fixture());
  assert.equal(corpus.schemaVersion, '0.3.0');
  assert.equal(Object.hasOwn(corpus, 'migration'), false);
  for (const entity of [...corpus.sources, ...corpus.sourceRevisions, ...corpus.cases, ...corpus.claims]) {
    assert.equal(Object.hasOwn(entity, 'legacy'), false);
    assert.equal(Object.hasOwn(entity, 'migrationGap'), false);
  }
  const imported = structuredClone(corpus);
  imported.migration = { fromVersion: '0.2.0' };
  fails(imported, 'unknown field migration');
  const legacySource = structuredClone(corpus);
  legacySource.sources[0].inputKind = 'legacy-reference';
  fails(legacySource, 'invalid enum');
  const legacyRevision = structuredClone(corpus);
  legacyRevision.sourceRevisions[0].retention = 'legacy-missing';
  fails(legacyRevision, 'invalid enum');
  const legacyClaim = structuredClone(corpus);
  legacyClaim.claims[0].legacy = { originalStatus: 'Approved' };
  fails(legacyClaim, 'unknown field legacy');
});

test('AC-08 current acceptance requires human event; changed entity/dependency/base hashes invalidate approval', () => {
  const corpus = fixture(), claim = corpus.claims[2];
  const event = accept(corpus, 'claims', claim);
  assert.equal(currentReview(corpus, 'claims', claim), true);
  assertValid(corpus);
  for (const mutate of [
    c => { c.claims[2].description += ' Edited'; },
    c => { c.claims[2].revision = 'r2'; },
    c => { c.sourceRevisions[0].parserVersion = 'supplied-text/2'; },
    c => { c.sources[0].title += ' Edited'; },
    c => { c.passages[0].locator = 'changed'; },
    c => { c.cases[1].limits += ' Edited'; },
    c => { c.reviews[0].contentHash = 'a'.repeat(64); },
    c => { c.reviews[0].dependencyHashes = {}; },
    c => { c.reviews[0].baseDigest = 'a'.repeat(64); },
    c => { c.reviews[0].reviewerKind = 'agent'; },
    c => { c.reviews[0].timestamp = '2026-02-30T12:00:00Z'; },
  ]) {
    const changed = structuredClone(corpus);
    mutate(changed);
    fails(changed, 'requires current human review');
  }
  assert.equal(claim.origin, 'Human source paraphrase');
  assert.equal(event.reviewer, 'synthetic-human-reviewer');
});

test('AC-08 append-only events and latest disposition do not silently grant acceptance', () => {
  const corpus = fixture();
  const event = accept(corpus, 'claims', corpus.claims[2]);
  assertAppendOnlyReviews([], corpus.reviews);
  assertAppendOnlyReviews(corpus.reviews, [...corpus.reviews, { ...event, id: 'later-review' }]);
  assert.throws(() => assertAppendOnlyReviews(corpus.reviews, []), /deleted or modified/);
  assert.throws(() => assertAppendOnlyReviews(corpus.reviews, [{ ...event, rationale: 'edited' }]), /deleted or modified/);
  assert.throws(() => assertAppendOnlyReviews(corpus.reviews, [event, event]), /duplicate/);
  corpus.reviews.push({ ...event, id: 'correction', disposition: 'Needs correction' });
  corpus.claims[2].history.push('correction');
  fails(corpus, 'requires current human review');
  corpus.claims[2].disposition = 'Needs correction';
  assertValid(corpus);
});

test('AC-08 accepted inference/category/summary requires accepted supporting claims and separate review', () => {
  const corpus = fixture();
  accept(corpus, 'claims', corpus.claims[3]);
  fails(corpus, 'accepted entity requires accepted supporting claims');
  accept(corpus, 'claims', corpus.claims[0]);
  accept(corpus, 'claims', corpus.claims[1]);
  assertValid(corpus);
  assert.equal(corpus.cases[0].disposition, 'Pending');
  accept(corpus, 'cases', corpus.cases[0]);
  assertValid(corpus);
});

test('AC-03 optional enrichment references fail closed without making paths required', () => {
  const corpus = enrichmentFixture();
  corpus.mappings[0].nodeId = 'missing-node';
  fails(corpus, 'invalid node/case/behavior/evidence scope');
  delete corpus.mappings[0].nodeId;
  fails(corpus, 'pathId/nodeId must occur together');
  delete corpus.mappings[0].pathId;
  assertValid(corpus);
  corpus.mappings[0].claimIds = ['synthetic-claim-c'];
  fails(corpus, 'belongs to another case');
  const provisional = enrichmentFixture();
  delete provisional.mappings[0].pathId;
  delete provisional.mappings[0].nodeId;
  provisional.mappings[0].provisional = true;
  provisional.mappings[0].framework = 'local';
  provisional.mappings[0].techniqueId = 'local-candidate-1';
  assertValid(provisional);
  provisional.mappings[0].techniqueId = 'AML.T9999';
  fails(provisional, 'provisional candidates must use local namespace');
});

test('AC-09 identical inputs yield identical canonical bytes/digest; key/entity order is not semantic path order', () => {
  const corpus = fixture();
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value;
  const reordered = reverseKeys(corpus);
  reordered.claims.reverse();
  reordered.sources.reverse();
  assert.equal(canonicalSerialize(corpus), canonicalSerialize(reordered));
  assert.equal(digest(corpus), digest(reordered));
  assert.equal(canonicalSerialize(corpus).endsWith('\n'), true);
  const optional = enrichmentFixture(), changed = enrichmentFixture();
  changed.paths[0].nodes.reverse();
  assert.notEqual(digest(optional), digest(changed));
  assert.equal(stableId('source', 'https://example.invalid/article'), stableId('source', 'https://example.invalid/article'));
  assert.notEqual(stableId('case', 'same'), stableId('source', 'same'));
  assert.equal(canonicalUrl('https://example.invalid/a?article=1&utm_source=test#heading'), 'https://example.invalid/a?article=1');
  assert.notEqual(canonicalUrl('https://example.invalid/a?article=1'), canonicalUrl('https://example.invalid/a?article=2'));
  assert.throws(() => canonicalUrl('https://synthetic-user@example.invalid/'), /credential-free/);
});

test('AC-09 schema/type core declarations and controlled enum sets stay aligned', () => {
  const declarations = readFileSync(new URL('../schemas/contract.d.ts', import.meta.url), 'utf8');
  for (const name of ['Source', 'SourceRevision', 'Passage', 'Case', 'Claim', 'Categorization', 'Timeline', 'ReviewEvent', 'CollectionManifest', 'Governance', 'Corpus']) assert.match(declarations, new RegExp(`interface ${name}\\b`));
  for (const name of ['lifecycle', 'disposition', 'evidenceStatus', 'origin']) {
    for (const value of schema.$defs[name].enum) assert.ok(declarations.includes(`'${value}'`), `${name}: ${value}`);
  }
  assert.equal(process.versions.node.split('.')[0], '22');
});

test('AC-09 configured project command executes offline contract tests within trusted-base mapped surfaces', () => {
  const config = read('../project.config.json');
  assert.deepEqual(config.project_commands, [
    ['node', '--test', 'tests/contract.test.mjs'],
    ['node', '--test', 'tests/intake.test.mjs'],
    ['node', '--test', 'tests/extract.test.mjs'],
    ['node', '--test', 'tests/review.test.mjs'],
    ['node', '--test', 'tests/hitl.test.mjs'],
    ['node', '--test', 'tests/exports.test.mjs'],
    ['node', '--test', 'tests/workbench.test.mjs'],
    ['node', '--test', 'tests/server.test.mjs'],
  ]);
  const governance = config.paths.governance;
  const mapped = (path, patterns) => patterns.some(pattern => pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern);
  for (const path of ['scripts/package.json', 'scripts/package-lock.json', 'scripts/.nvmrc', 'scripts/.node-version']) assert.ok(mapped(path, governance), path);
  assert.ok(config.paths.tests.includes('tests/**'));
  for (const path of ['scripts/contract.mjs', 'scripts/extract.mjs', 'scripts/review.mjs', 'schemas/corpus.schema.json', 'schemas/contract.d.ts']) {
    assert.ok(mapped(path, config.paths.application), path);
    assert.ok(!mapped(path, governance), `application is not governance: ${path}`);
  }
  assert.ok(config.paths.readme_triggers.includes('scripts/extract.mjs'));
});
