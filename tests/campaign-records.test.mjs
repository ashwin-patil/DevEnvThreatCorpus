import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stableId, validateCorpus } from '../scripts/contract.mjs';
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

function scopedCandidate() {
  const value = candidate();
  value.behaviors.push({ ...structuredClone(value.behaviors[0]), localId: 'other-behavior' });
  value.paths = [{
    localId: 'path', scope: 'representative', supportingClaimIds: ['local-claim'],
    nodes: ['a', 'b'].map(localId => ({
      localId, title: localId, detail: 'Synthetic node; no execution asserted.',
      behaviorIds: ['benign-use'], supportingClaimIds: ['local-claim'],
      evidenceStatus: 'Attempted behavior',
    })),
    edges: [],
  }];
  Object.assign(value.mappings[0], { pathId: 'path', nodeId: 'a' });
  return value;
}

for (const evidenceBasis of ['source-supported', 'inferred']) {
  test(`issue48 AC-01 ${evidenceBasis} self-loop and cycle preserve independent relationship support`, async () => {
    const corpus = await fixture(), value = scopedCandidate();
    const path = value.paths[0];
    path.edges = [['a', 'a'], ['a', 'b'], ['b', 'a']].map(([from, to], index) => ({
      localId: `edge-${index}`, from, to, relation: 'conditional',
      basis: 'Synthetic conditional relationship, not repetition, chronology or causality.',
      evidenceBasis, supportingClaimIds: ['local-claim', 'synthetic-claim-b'],
    }));
    const output = normalize(corpus, value), normalized = output.records.paths[0];
    assert.equal(normalized.edges[0].from, normalized.edges[0].to);
    for (const edge of normalized.edges) {
      assert.equal(edge.relation, 'conditional');
      assert.equal(edge.basis, path.edges[0].basis);
      assert.deepEqual(edge.claimIds, ['synthetic-claim-a', 'synthetic-claim-b']);
      assert.equal(edge.origin, evidenceBasis === 'inferred' ? 'LLM inferred relationship' : 'LLM source paraphrase');
      assert.equal(output.recordSupport.find(s => s.recordId === edge.id).kind, `path-edge-${evidenceBasis}`);
    }
    for (const [type, records] of Object.entries(output.records)) (corpus[type] ??= []).push(...records);
    assert.deepEqual(validateCorpus(corpus), []);
    for (const mutate of [
      edge => { edge.to = 'missing'; }, edge => { edge.relation = 'invented'; },
      edge => { edge.supportingClaimIds = []; }, edge => { edge.basis = ''; },
      edge => { edge.supportingClaimIds = ['synthetic-claim-b']; },
      edge => { edge.evidenceBasis = 'confirmed'; },
    ]) {
      const invalid = scopedCandidate();
      invalid.paths[0].edges = [structuredClone(path.edges[0])];
      mutate(invalid.paths[0].edges[0]);
      assert.throws(() => normalize(corpus, invalid, { runId: 'invalid-loop' }), /edge|support|basis/);
    }
  });
}

const mappingVariants = [
  ['resolved', {}],
  ['unknown ID', { techniqueId: 'T9999' }],
  ['unknown version', { version: 'unknown' }],
  ['unsupported source literal', { mappingBasis: 'source-mentioned', sourceLiteral: 'T1059' }],
];
for (const [variant, mappingFields] of mappingVariants) {
  test(`issue48 AC-02 ${variant} enforces every scope boundary before resolution`, async () => {
    const corpus = await fixture();
    for (const mutate of [
      v => { delete v.mappings[0].nodeId; },
      v => { delete v.mappings[0].pathId; },
      v => { v.mappings[0].pathId = ''; v.mappings[0].nodeId = ''; },
      v => { v.mappings[0].nodeId = null; },
      v => { v.mappings[0].pathId = 'missing'; },
      v => { v.mappings[0].nodeId = 'missing'; },
      v => { v.mappings[0].behaviorId = 'other-behavior'; },
      v => { v.mappings[0].supportingClaimIds.push('synthetic-claim-b'); },
      v => { v.mappings[0].supportingClaimIds.push('synthetic-claim-c'); },
      v => { v.paths[0].nodes[0].supportingClaimIds = ['synthetic-claim-c']; },
      v => { v.mappings[0].pathId = 'synthetic-case-b:path'; },
      v => { v.mappings[0].nodeId = 'b:wrong/path'; },
      v => { v.mappings[0].rationale = ''; },
      v => { delete v.mappings[0].applicability; },
    ]) {
      const value = scopedCandidate();
      Object.assign(value.mappings[0], mappingFields);
      mutate(value);
      assert.throws(() => normalize(corpus, value), /mapping|case|identifier/);
    }
    for (const nodeScoped of [true, false]) {
      const value = scopedCandidate();
      Object.assign(value.mappings[0], mappingFields);
      if (!nodeScoped) { delete value.mappings[0].pathId; delete value.mappings[0].nodeId; }
      const output = normalize(corpus, value);
      const mapping = output.records.mappings[0] ?? output.unresolvedMappings[0];
      assert.equal(Boolean(mapping.pathId), nodeScoped);
      assert.equal(Boolean(mapping.nodeId), nodeScoped);
      if (nodeScoped) {
        assert.equal(mapping.pathId, output.records.paths[0].id);
        assert.equal(mapping.nodeId, output.records.paths[0].nodes[0].id);
      }
    }
  });
}

test('issue48 AC-03 unresolved node and broader candidates retain exact pending metadata without an official match', async () => {
  const corpus = await fixture(), value = scopedCandidate();
  Object.assign(value.mappings[0], {
    techniqueId: 'AML.未知<script>', framework: 'ATLAS', version: 'unknown',
    rationale: '😀 Café <script>untrusted DATA</script>', applicability: '[draft](https://example.invalid) | limited',
    mappingBasis: 'source-mentioned', sourceLiteral: 'Exact unsupported literal 😀',
  });
  const output = normalize(corpus, value), unresolved = output.unresolvedMappings[0];
  assert.deepEqual(output.records.frameworks, []);
  assert.deepEqual(output.records.mappings, []);
  assert.deepEqual({
    caseId: unresolved.caseId, pathId: unresolved.pathId, nodeId: unresolved.nodeId,
    rationale: unresolved.rationale, applicability: unresolved.applicability,
    supportingClaimIds: unresolved.supportingClaimIds, framework: unresolved.framework,
    version: unresolved.version, techniqueLiteral: unresolved.techniqueLiteral,
    sourceLiteral: unresolved.sourceLiteral, mappingBasis: unresolved.mappingBasis,
    reason: unresolved.reason, origin: unresolved.origin, disposition: unresolved.disposition,
  }, {
    caseId: 'synthetic-case-a', pathId: output.records.paths[0].id, nodeId: output.records.paths[0].nodes[0].id,
    rationale: value.mappings[0].rationale, applicability: value.mappings[0].applicability,
    supportingClaimIds: ['synthetic-claim-a'], framework: 'ATLAS', version: 'unknown',
    techniqueLiteral: value.mappings[0].techniqueId, sourceLiteral: value.mappings[0].sourceLiteral,
    mappingBasis: 'source-mentioned', reason: 'not-in-pinned-catalog',
    origin: 'LLM source paraphrase', disposition: 'Pending',
  });
});

test('issue48 AC-01/04 source-backed loop support and versioned generated identity fail closed', async () => {
  const corpus = await fixture(), value = scopedCandidate();
  value.paths[0].nodes[0].supportingClaimIds = ['synthetic-claim-inference'];
  value.paths[0].edges = [{
    localId: 'loop', from: 'a', to: 'a', relation: 'conditional', basis: 'Synthetic analyst relationship.',
    evidenceBasis: 'source-supported', supportingClaimIds: ['synthetic-claim-inference'],
  }];
  assert.throws(() => normalize(corpus, value), /non-inference supporting claim/);
  value.paths[0].edges[0].evidenceBasis = 'inferred';
  value.mappings = [];
  const output = normalize(corpus, value);
  assert.equal(output.records.paths[0].edges[0].origin, 'LLM inferred relationship');
  assert.notEqual(output.records.behaviors[0].id,
    stableId('campaign-behavior', 'campaign-run-1\nbenign-use'));
  for (const [type, records] of Object.entries(output.records)) (corpus[type] ??= []).push(...records);
  assert.throws(() => normalize(corpus, value), /generated ID collision/);
});

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
  assert.equal(first.resolverVersion, 'pinned-catalog-resolver/2');
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.catalogs[0].materialDigest,
    'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4');
  first.catalogs[0].techniques[0].name = 'caller mutation';
  assert.notEqual(catalogSnapshot().catalogs[0].techniques[0].name, 'caller mutation');
});

test('official ATLAS projection resolves grounded proposals and fails closed on unknown ID/version', async () => {
  const snapshot = catalogSnapshot(), atlas = snapshot.catalogs.find(c => c.framework === 'ATLAS');
  assert.equal(atlas.version, '2026.09');
  assert.equal(atlas.techniques.length, 208);
  assert.equal(atlas.materialDigest, '935efa93e28294432d3e2f537eb94991ef8d1f8c58341cd360ea3321ddb66688');
  assert.equal(new Set(atlas.techniques.map(t => t.id)).size, 208);
  for (const t of atlas.techniques) {
    assert.ok(t.description.length > 0);
    assert.equal(t.url, `https://atlas.mitre.org/techniques/${t.id}`);
    if (t.parentId) assert.ok(atlas.techniques.some(p => p.id === t.parentId));
  }
  const corpus = await fixture(), value = candidate();
  Object.assign(value.mappings[0], { framework: 'ATLAS', version: '2026.09', techniqueId: 'AML.T0051' });
  const output = normalize(corpus, value);
  assert.equal(output.records.frameworks[0].name, 'LLM Prompt Injection');
  assert.equal(output.records.mappings[0].disposition, 'Pending');
  assert.equal(output.records.mappings[0].origin, 'LLM inferred mapping');
  assert.deepEqual(output.records.mappings[0].claimIds, ['synthetic-claim-a']);
  for (const [version, techniqueId] of [['2026.08', 'AML.T0051'], ['2026.09', 'AML.T9999']]) {
    Object.assign(value.mappings[0], { version, techniqueId });
    const unresolved = normalize(corpus, value);
    assert.equal(unresolved.records.mappings.length, 0);
    assert.equal(unresolved.unresolvedMappings[0].reason, 'not-in-pinned-catalog');
  }
  Object.assign(value.mappings[0], { version: '2026.09', techniqueId: 'AML.T0051', mappingBasis: 'source-mentioned', sourceLiteral: 'AML.T0051' });
  assert.equal(normalize(corpus, value).unresolvedMappings[0].reason, 'source-literal-not-found-in-supporting-passage');
});

test('resolver upgrade reuses the historical ATT&CK catalog source without a provenance collision', async () => {
  const corpus = await fixture(), first = normalize(corpus, candidate());
  const historicalSource = structuredClone(first.records.sources[0]);
  assert.equal(historicalSource.provenance.suppliedBy, 'pinned-catalog-resolver/1');
  corpus.sources.push(historicalSource);
  const second = normalize(corpus, candidate());
  assert.equal(second.records.sources.length, 0);
  assert.equal(second.records.frameworks[0].sourceId, historicalSource.id);
  assert.deepEqual(corpus.sources.at(-1), historicalSource);
});
