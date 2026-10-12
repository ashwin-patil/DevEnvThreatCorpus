import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertValid, validateCorpus, validateShape, canonicalSerialize, canonicalUrl, digest, sha256, schema,
  normalizeText, stableId, entityContentHash, dependencyHashes, reviewBaseDigest, currentReview, assertAppendOnlyReviews,
} from '../scripts/contract.mjs';
import { migrateLegacy, dateValue } from '../scripts/migrate-contract.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = () => read('./fixtures/benign/core-only.json');
const frozen = () => read('../handoff/reference/corpus.json');
const migrated = () => read('./fixtures/migration/after-0.3.0.json');
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
  const optional = migrated();
  optional.paths[1].nodes[0].id = optional.paths[0].nodes[0].id;
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

test('AC-08 migration preserves all source/case/claim IDs, legacy states/origins, and optional module counts', () => {
  const before = frozen(), { corpus, report } = migrateLegacy(before);
  assertValid(corpus);
  assert.deepEqual(corpus.sources.map(item => item.id), before.sources.map(item => item.id));
  assert.deepEqual(corpus.cases.map(item => item.id), before.campaigns.map(item => item.id));
  assert.deepEqual(corpus.claims.map(item => item.id), before.evidence.map(item => item.id));
  for (const name of ['paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel']) assert.equal(corpus[name].length, before[name].length);
  assert.equal(corpus.cases.length, 5);
  assert.equal(corpus.claims.length, 23);
  assert.equal(corpus.paths.length, 5);
  assert.equal(corpus.behaviors.length, 8);
  assert.equal(corpus.frameworks.length, 210);
  for (const item of corpus.claims) {
    const old = before.evidence.find(old => old.id === item.id);
    assert.equal(item.sourceId, old.sourceId);
    assert.equal(item.legacy.originalStatus, old.status);
    assert.equal(item.legacy.originalOrigin, old.origin);
    assert.equal(item.disposition, 'Pending');
    assert.equal(item.migrationGap.reason, 'legacy passage not retained');
    assert.deepEqual(item.passageIds, []);
  }
  for (const path of corpus.paths) {
    assert.equal(Object.hasOwn(path, 'campaignId'), false);
    for (const node of path.nodes) {
      assert.equal(Object.hasOwn(node, 'evidenceIds'), false);
      assert.deepEqual(node.claimIds, node.legacy.evidenceIds);
      assert.deepEqual(node.behaviorIds, node.legacy.patternIds);
    }
    for (const edge of path.edges) assert.deepEqual(edge.claimIds, edge.legacy.evidenceIds);
  }
  for (const mapping of corpus.mappings) {
    assert.equal(Object.hasOwn(mapping, 'campaignId'), false);
    assert.equal(Object.hasOwn(mapping, 'evidenceIds'), false);
    assert.deepEqual(mapping.claimIds, mapping.legacy.evidenceIds);
    assert.equal(mapping.caseId, mapping.legacy.campaignId);
  }
  assert.equal(report.acceptedClaims, 0);
  assert.equal(report.gaps.length, 23);
});

test('AC-08 GC-05 Deadbugz remains intent, Nx remains package scanning, Gambit remains composite', () => {
  const corpus = assertValid(migrated());
  const deadbugz = corpus.claims.find(item => item.id === 'deadbugz-e4');
  assert.equal(deadbugz.evidenceStatus, 'Attempted behavior');
  assert.equal(deadbugz.legacy.originalStatus, 'Intent only');
  assert.match(deadbugz.uncertainty, /execution and victim theft are not established/);
  const nx = corpus.paths.find(item => item.id === 'path-nx').nodes.find(item => item.id === 'nx-5');
  assert.match(nx.atlasApplicability, /package-level scanning, not agent-mediated credential retrieval/);
  assert.equal(corpus.paths.find(item => item.id === 'path-gambit').scope, 'composite');
  assert.match(corpus.cases.find(item => item.id === 'gambit').limits, /combines multiple intrusions/);
  assert.equal(corpus.cases.find(item => item.id === 'gambit').legacy.date, '2026-06');
  assert.equal(corpus.timelines.length, 0);
  const scanning = corpus.mappings.find(item => item.id === 'map-nx-5-secrets-T1552.001');
  assert.equal(scanning.techniqueId, 'T1552.001');
  assert.equal(scanning.framework, 'ATT&CK');
  assert.deepEqual(scanning.claimIds, ['nx-e5']);
  for (const edge of corpus.paths.find(item => item.id === 'path-gambit').edges) {
    assert.equal(edge.relation, 'conditional');
    assert.equal(edge.label, 'composite playbook; varies by intrusion');
  }
  assert.equal(corpus.cases.find(item => item.id === 'whatsapp').legacy.date, null);
});

test('AC-08 every optional reference and empty behavior list survives; legacy OTEL hashes stay audit metadata', () => {
  const before = frozen(), corpus = assertValid(migrated());
  assert.equal(before.evidence.filter(item => item.quote === null).length, 23);
  assert.equal(before.sources.filter(item => item.contentHash === null).length, 12);
  assert.equal(before.sources.filter(item => item.contentHash !== null).length, 3);
  assert.equal(before.sources.filter(item => before.campaigns.some(c => c.id === item.id)).length, 5);
  for (const source of before.sources) {
    const revision = corpus.sourceRevisions.find(item => item.sourceId === source.id);
    assert.equal(revision.rawHash, null);
    assert.equal(revision.normalizedHash, null);
    assert.equal(revision.legacy.originalContentHash, source.contentHash);
    assert.equal(revision.legacy.originalRevision, source.revision ?? null);
  }
  assert.deepEqual(corpus.frameworks, before.frameworks);
  for (const action of before.otel) assert.deepEqual(corpus.otel.find(item => item.id === action.id).standardSourceIds, action.standardSourceIds);
  assert.deepEqual(corpus.otelReference, before.otelReference);
  let behaviorReferenceFields = 0, claimReferenceFields = 0;
  const caseReferenceFields = corpus.claims.length + corpus.paths.length + corpus.mappings.length;
  for (const path of before.paths) {
    const after = corpus.paths.find(item => item.id === path.id);
    for (const node of path.nodes) {
      const migratedNode = after.nodes.find(item => item.id === node.id);
      assert.deepEqual(migratedNode.behaviorIds, node.patternIds);
      behaviorReferenceFields += 1;
      claimReferenceFields += 1;
    }
    claimReferenceFields += after.edges.length;
  }
  claimReferenceFields += corpus.mappings.length;
  assert.equal(behaviorReferenceFields, 23);
  assert.equal(claimReferenceFields, 60);
  assert.equal(caseReferenceFields, 45);
  for (const name of ['paths', 'behaviors', 'mappings', 'telemetry', 'detections', 'otel']) {
    for (const item of corpus[name]) {
      assert.equal(item.disposition, 'Pending');
      assert.equal(item.legacy.originalOrigin, before[name].find(old => old.id === item.id).origin);
    }
  }
});

test('AC-08 legacy Approved is still Pending; passage exceptions are explicit migration-only, never accepted', () => {
  const before = frozen();
  before.evidence[0].reviewStatus = 'Approved';
  before.campaigns[0].reviewStatus = 'Approved';
  const { corpus } = migrateLegacy(before);
  assert.equal(corpus.claims[0].disposition, 'Pending');
  assert.equal(corpus.claims[0].legacy.reviewStatus, 'Approved');
  assert.equal(corpus.cases[0].disposition, 'Pending');
  corpus.claims[0].disposition = 'Accepted';
  fails(corpus, 'missing legacy passage can never be accepted');
  const noException = migrated();
  noException.migration.pendingPassageExceptions = [];
  fails(noException, 'invalid migration pending passage exception');
  const noMigration = migrated();
  delete noMigration.migration;
  fails(noMigration, 'legacy-missing is migration-only');
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

test('AC-08 optional enrichment references fail closed without making paths required', () => {
  const corpus = migrated();
  corpus.mappings[0].nodeId = 'missing-node';
  fails(corpus, 'invalid node/case/behavior/evidence scope');
  delete corpus.mappings[0].nodeId;
  fails(corpus, 'pathId/nodeId must occur together');
  delete corpus.mappings[0].pathId;
  assertValid(corpus);
  corpus.mappings[0].claimIds = ['gambit-e1'];
  fails(corpus, 'belongs to another case');
  const provisional = migrated();
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
  const optional = migrated(), changed = migrated();
  changed.paths[0].nodes.reverse();
  assert.notEqual(digest(optional), digest(changed));
  assert.equal(stableId('source', 'https://example.invalid/article'), stableId('source', 'https://example.invalid/article'));
  assert.notEqual(stableId('case', 'same'), stableId('source', 'same'));
  assert.equal(canonicalUrl('https://example.invalid/a?article=1&utm_source=test#heading'), 'https://example.invalid/a?article=1');
  assert.notEqual(canonicalUrl('https://example.invalid/a?article=1'), canonicalUrl('https://example.invalid/a?article=2'));
  assert.throws(() => canonicalUrl('https://synthetic-user@example.invalid/'), /credential-free/);
});

test('AC-09 durable migration before/after/report reproduce exactly; frozen baseline preserved with inherited manifest gaps', () => {
  const beforeBytes = readFileSync(new URL('./fixtures/migration/before-0.2.0.json', import.meta.url), 'utf8');
  assert.equal(beforeBytes, readFileSync(new URL('../handoff/reference/corpus.json', import.meta.url), 'utf8'));
  const { corpus, report } = migrateLegacy(JSON.parse(beforeBytes));
  report.frozenInputByteHash = sha256(beforeBytes);
  assert.equal(canonicalSerialize(corpus), readFileSync(new URL('./fixtures/migration/after-0.3.0.json', import.meta.url), 'utf8'));
  assert.equal(canonicalSerialize(report), readFileSync(new URL('./fixtures/migration/report.json', import.meta.url), 'utf8'));
  const baseline = read('./fixtures/migration/reference-baseline.json');
  assert.equal(sha256(readFileSync(new URL('../handoff/REFERENCE-MANIFEST.json', import.meta.url), 'utf8')), baseline.importedManifestHash, 'imported reference manifest itself remains frozen');
  const discrepancies = baseline.inheritedManifestDiscrepancies;
  assert.equal(Object.keys(discrepancies).length, 14);
  for (const [path, expected] of Object.entries(read('../handoff/REFERENCE-MANIFEST.json').files)) {
    const actual = sha256(readFileSync(new URL(`../handoff/reference/${path}`, import.meta.url), 'utf8'));
    if (Object.hasOwn(discrepancies, path)) {
      assert.notEqual(actual, expected, `documented inherited manifest gap ${path}`);
      assert.equal(actual, discrepancies[path], `frozen committed baseline ${path}`);
    } else assert.equal(actual, expected, `frozen reference ${path}`);
  }
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
  assert.deepEqual(config.project_commands, [['node', '--test', 'tests/contract.test.mjs']]);
  const governance = config.paths.governance;
  const mapped = (path, patterns) => patterns.some(pattern => pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern);
  for (const path of ['scripts/package.json', 'scripts/package-lock.json', 'scripts/.nvmrc', 'scripts/.node-version', 'schemas/contract.d.ts']) assert.ok(mapped(path, governance), path);
  for (const path of ['tests/fixtures/benign/core-only.json', 'tests/fixtures/migration/report.json']) assert.ok(mapped(path, config.paths.tests), path);
  assert.ok(governance.includes('schemas/**'));
  assert.ok(governance.includes('scripts/**'));
  assert.ok(config.paths.tests.includes('tests/**'));
});
