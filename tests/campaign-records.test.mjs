import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCorpus } from '../scripts/contract.mjs';
import {
  CANDIDATE_RECORD_GUIDE, PINNED_FRAMEWORK_CATALOG, catalogSnapshot, normalizeCampaignRecords,
} from '../src/campaign-records.mjs';

const fixture = async () => JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
const catalogUrl = PINNED_FRAMEWORK_CATALOG.catalogs[0].materialUrl;

test('AI library candidate usage is optional, enum-checked and never invents a literal', async () => {
  const corpus = await fixture(), value = candidate();
  value.artifacts = [{ kind: 'prompt-instruction', literal: 'Café', usage: 'vendor-example', supportingClaimIds: ['local-claim'] }];
  const output = normalize(corpus, value);
  assert.equal(output.annotations.find(a => a.type === 'commands-ai-artifacts').context.artifactUsage, 'vendor-example');
  value.artifacts[0].usage = 'confirmed-success';
  assert.throws(() => normalize(corpus, value), /unknown artifact usage/);
  value.artifacts[0].usage = 'targeted'; value.artifacts[0].literal = 'Unsupported product';
  assert.throws(() => normalize(corpus, value), /literal is absent/);
});

for (const evidenceStatus of ['Potential consequence', 'Unclear or disputed']) {
  test(`issue45 preserves ${evidenceStatus} without projecting observed behavior`, async () => {
    const corpus = await fixture();
    corpus.claims.find(c => c.id === 'synthetic-claim-a').evidenceStatus = evidenceStatus;
    const annotation = normalize(corpus).annotations.find(a => a.type === 'observed-behavior');
    assert.notEqual(annotation.context.behavior, 'observed');
    assert.notEqual(annotation.evidenceStatus, 'evidence-backed');
    assert.equal(annotation.context.notes, evidenceStatus);
  });
}

test('issue45 node mapping rejects additional claims outside that node support', async () => {
  const corpus = await fixture(), value = candidate();
  value.paths = [{ localId: 'path', scope: 'representative', supportingClaimIds: ['local-claim'],
    nodes: [{ localId: 'node', title: 'Synthetic node', detail: 'Synthetic support boundary.',
      behaviorIds: ['benign-use'], supportingClaimIds: ['local-claim'], evidenceStatus: 'Source-reported observation' }],
    edges: [] }];
  Object.assign(value.mappings[0], { pathId: 'path', nodeId: 'node',
    supportingClaimIds: ['local-claim', 'synthetic-claim-b'] });
  assert.throws(() => normalize(corpus, value), /path\/node/);
});

function addCatalogSource(corpus) {
  const source = structuredClone(corpus.sources[1]);
  Object.assign(source, {
    id: 'official-attack-v19.2', originalUrl: catalogUrl, canonicalUrl: catalogUrl,
    title: 'MITRE ATT&CK Enterprise 19.2 pinned catalog material',
    publisher: 'The MITRE Corporation', author: null, revisionIds: [],
    extractionStatus: 'Not started', collectionState: 'Collected',
    provenance: {
      kind: 'supplied-url', suppliedBy: 'campaign-records fixture',
      description: 'Official catalog source identity only; separate from incident evidence.', nullReasons: {},
    },
    nullReasons: { author: 'not_reported' },
  });
  corpus.sources.push(source);
}

const candidate = () => ({
  behaviors: [{
    localId: 'benign-use', name: 'Benign tool use', boundary: 'Synthetic fixture only.',
    description: 'Normalizes the fixture claim without asserting real activity.',
    supportingClaimIds: ['local-claim'], occurrences: [{ supportingClaimIds: ['local-claim'] }],
  }],
  paths: [],
  mappings: [{
    localId: 'mapping-command', behaviorId: 'benign-use', framework: 'ATT&CK', version: '19.2',
    techniqueId: 'T1059', rationale: 'Synthetic mapping proposal.',
    applicability: 'Pending researcher review.', supportingClaimIds: ['local-claim'],
    mappingBasis: 'researcher-proposed',
  }],
  telemetry: [{
    localId: 'signal', behaviorId: 'benign-use', category: 'endpoint', eventType: 'synthetic event',
    logicalFields: ['event.name'], joinKeys: [], availability: 'Proposed; not observed.',
    schema: 'Synthetic logical schema', limitations: 'No deployment or incident validation.',
    supportingClaimIds: ['local-claim'], collection: 'proposed',
  }],
  otel: [{
    localId: 'span', behaviorId: 'benign-use', action: 'Propose synthetic instrumentation.',
    standardSourceIds: [], customFields: ['synthetic.event.name'],
    sample: { 'synthetic.event.name': 'synthetic.benign_use', 'server.address': 'example.invalid' },
    sampleFormat: 'flat synthetic attributes',
    sampleOrigin: 'LLM synthetic fixture; not incident evidence', stability: 'proposal',
    limitations: 'Inert fixture; not deployed.', supportingClaimIds: ['local-claim'],
  }],
  detections: [{
    localId: 'hypothesis', behaviorId: 'benign-use', hypothesis: 'Review a synthetic event.',
    signalIds: ['signal'], otelIds: ['span'], windowSeconds: 60,
    windowBasis: 'Arbitrary proposal; tune before use.', tuning: 'Exclude known synthetic exercises.',
    testPlan: 'Use only inert fixture events.', validation: 'Untested hypothesis.',
    supportingClaimIds: ['local-claim'], kind: 'hypothesis',
  }],
  roles: [{ value: 'victim-side-environment', supportingClaimIds: ['local-claim'] }],
  artifacts: [{
    kind: 'configuration', literal: 'Café', normalizedValue: 'café',
    supportingClaimIds: ['local-claim'],
  }],
  published: [], dataSources: [], templates: [],
});

function normalize(corpus, value = candidate(), extra = {}) {
  return normalizeCampaignRecords({
    candidate: value, request: { caseId: 'synthetic-case-a' },
    claims: corpus.claims, passages: corpus.passages, corpus, runId: 'campaign-run-1',
    claimIds: { 'local-claim': 'synthetic-claim-a' }, ...extra,
  });
}

test('issue45 AC-05/06/07 creates pending grounded records with exact private support and pinned catalog provenance', async () => {
  const corpus = await fixture();
  const output = normalize(corpus);
  assert.equal(output.records.behaviors.length, 1);
  assert.equal(output.records.frameworks[0].id, 'T1059');
  assert.equal(output.records.mappings[0].mappingStatus, 'Proposed');
  assert.equal(output.records.mappings[0].origin, 'LLM inferred mapping');
  assert.equal(output.records.telemetry[0].origin, 'LLM proposed collection');
  assert.equal(output.records.detections[0].origin, 'LLM proposed detection');
  assert.equal(output.records.otel[0].sampleOrigin, 'LLM synthetic fixture; not incident evidence');
  assert.ok(output.annotations.every(item =>
    item.status === 'pending' && item.origin === 'agent' && item.claimIds.includes('synthetic-claim-a')));
  assert.ok(output.recordSupport.every(item =>
    item.disposition === 'Pending' && item.supportingClaimIds.includes('synthetic-claim-a')));
  assert.deepEqual(output.records.behaviors[0].claimIds, ['synthetic-claim-a']);
  assert.equal(output.records.behaviors[0].caseId, 'synthetic-case-a');
  assert.ok(output.annotations.some(item => item.type === 'observed-behavior' && item.support?.quote === 'Café'));
  assert.equal(output.catalogProvenance[0].materialDigest,
    'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4');
  assert.equal(output.records.sources.length, 1);
  assert.equal(corpus.cases[0].sourceIds.includes(output.records.sources[0].id), false);
  assert.equal(output.templateProvenance.length, 0);
  for (const [type, records] of Object.entries(output.records)) {
    corpus[type] ??= [];
    corpus[type].push(...records);
  }
  assert.deepEqual(validateCorpus(corpus), []);
});

test('issue45 AC-07 article telemetry and published detections remain evidence annotations, not proposal records', async () => {
  const corpus = await fixture();
  const value = candidate();
  value.mappings = []; value.otel = [];
  value.telemetry[0].collection = 'article-mentioned';
  value.detections[0].kind = 'published-reference';
  value.detections[0].signalIds = [];
  value.detections[0].otelIds = [];
  const output = normalize(corpus, value);
  assert.deepEqual(output.records.telemetry, []);
  assert.deepEqual(output.records.detections, []);
  assert.ok(output.annotations.some(item =>
    item.type === 'data-sources' && item.context.collection === 'article-mentioned'));
  assert.ok(output.annotations.some(item =>
    item.type === 'detection-references' && item.context.detection === 'published-reference'));
  assert.ok(output.annotations.filter(item => ['data-sources', 'detection-references'].includes(item.type))
    .every(item => item.status === 'pending' && item.origin === 'agent'
      && item.sourceId === 'synthetic-source-a' && item.sourceRevisionId === 'synthetic-revision-a'
      && item.support?.quote === 'Café'));
});

test('issue45 AC-05 allows a supported unordered behavior set without manufacturing a path', async () => {
  const corpus = await fixture();
  const value = candidate();
  value.mappings = []; value.telemetry = []; value.detections = []; value.otel = [];
  const output = normalize(corpus, value);
  assert.equal(output.records.behaviors.length, 1);
  assert.deepEqual(output.records.paths, []);
});

test('issue45 AC-05 preserves explicit supported and inferred path relationships', async () => {
  const corpus = await fixture();
  const value = candidate();
  value.mappings = []; value.telemetry = []; value.detections = []; value.otel = [];
  value.paths = [{
    localId: 'path', scope: 'representative', supportingClaimIds: ['local-claim'],
    nodes: [
      { localId: 'a', title: 'A', detail: 'Supported A.', behaviorIds: ['benign-use'], supportingClaimIds: ['local-claim'], evidenceStatus: 'Source-reported observation' },
      { localId: 'b', title: 'B', detail: 'Inferred B.', behaviorIds: ['benign-use'], supportingClaimIds: ['local-claim'], evidenceStatus: 'Researcher inference' },
    ],
    edges: [{
      localId: 'a-b', from: 'a', to: 'b', supportingClaimIds: ['local-claim'],
      relation: 'conditional', basis: 'Explicitly a conditional analyst proposal.', evidenceBasis: 'inferred',
    }],
  }];
  const output = normalize(corpus, value);
  assert.equal(output.records.paths[0].edges[0].origin, 'LLM inferred relationship');
  assert.equal(output.records.paths[0].disposition, 'Pending');
});

test('issue45 AC-06 empty catalog match remains unresolved and preserves literal support', async () => {
  const corpus = await fixture();
  const value = candidate();
  value.mappings[0].techniqueId = 'T9999';
  const output = normalize(corpus, value);
  assert.deepEqual(output.records.frameworks, []);
  assert.deepEqual(output.records.mappings, []);
  assert.equal(output.unresolvedMappings[0].reason, 'not-in-pinned-catalog');
  assert.deepEqual(output.unresolvedMappings[0].supportingClaimIds, ['synthetic-claim-a']);
});

test('issue45 AC-06 invalid and unsupported source-mentioned IDs never become official records', async () => {
  const corpus = await fixture();
  addCatalogSource(corpus);
  for (const [techniqueId, sourceLiteral, reason] of [
    ['T9999', 'Café', 'not-in-pinned-catalog'],
    ['T1059', 'Café', 'source-literal-not-found-in-supporting-passage'],
  ]) {
    const value = candidate();
    Object.assign(value.mappings[0], { techniqueId, sourceLiteral, mappingBasis: 'source-mentioned' });
    const output = normalize(corpus, value);
    assert.equal(output.records.mappings.length, 0);
    assert.equal(output.unresolvedMappings[0].reason, reason);
    assert.equal(output.unresolvedMappings[0].sourceLiteral, sourceLiteral);
  }
});

test('issue45 AC-07 rejects arbitrary templates and unsafe OTEL samples', async () => {
  const corpus = await fixture();
  const withTemplate = candidate();
  withTemplate.templates = [{ templateId: 'legacy', version: '1', hash: 'a'.repeat(64) }];
  assert.throws(() => normalize(corpus, withTemplate), /not in the audited template allowlist/);
  for (const sample of [
    { command: 'synthetic.run' },
    { 'synthetic.event.name': 'curl https://real.example' },
    { 'url.full': 'https://github.com/real' },
  ]) {
    const value = candidate();
    value.mappings = [];
    value.otel[0].sample = sample;
    assert.throws(() => normalize(corpus, value), /non-allowlisted|synthetic\.\*|example\.invalid/);
  }
});

test('issue45 campaign record input fails closed on unknown fields, dangling refs, collisions, and cross-case support', async () => {
  const corpus = await fixture();
  const unknown = candidate();
  unknown.behaviors[0].legacyLabel = 'trusted';
  assert.throws(() => normalize(corpus, unknown), /unknown field legacyLabel/);
  const dangling = candidate();
  dangling.behaviors[0].supportingClaimIds = ['missing'];
  assert.throws(() => normalize(corpus, dangling), /unknown claim/);
  const crossCase = candidate();
  crossCase.behaviors[0].supportingClaimIds = ['synthetic-claim-c'];
  assert.throws(() => normalize(corpus, crossCase, { claimIds: {} }), /another case/);
  const duplicate = candidate();
  duplicate.behaviors.push(structuredClone(duplicate.behaviors[0]));
  assert.throws(() => normalize(corpus, duplicate), /duplicate behaviors localId/);
});

test('issue45 candidate guide documents the strict public interface', () => {
  assert.match(CANDIDATE_RECORD_GUIDE.note, /candidate top level; never return a records property/);
  for (const key of ['behaviors', 'paths', 'mappings', 'telemetry', 'detections', 'otel', 'annotations', 'templates']) {
    assert.equal(typeof CANDIDATE_RECORD_GUIDE[key], 'string');
  }
});

test('issue45 request catalog snapshot deterministically freezes resolver pins and membership', () => {
  const first = catalogSnapshot();
  const second = catalogSnapshot();
  assert.deepEqual(first, second);
  assert.equal(first.resolverVersion, 'pinned-catalog-resolver/1');
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.catalogs[0].materialDigest,
    'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4');
  first.catalogs[0].techniques[0].name = 'caller mutation';
  assert.notEqual(catalogSnapshot().catalogs[0].techniques[0].name, 'caller mutation');
});
