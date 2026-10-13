import { canonicalSerialize, stableId } from '../scripts/contract.mjs';
import { PINNED_FRAMEWORK_CATALOG, catalogEntry, catalogSnapshot } from './framework-catalog.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SAMPLE_ORIGIN = 'LLM synthetic fixture; not incident evidence';
const GROUPS = ['sources', 'behaviors', 'paths', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel'];
const ANNOTATION_INPUTS = ['roles', 'artifacts', 'published', 'dataSources'];
const SAMPLE_KEYS = new Set(['synthetic.event.name', 'synthetic.tool.name', 'server.address', 'url.full']);
const ROLES = new Set([
  'victim-side-environment', 'victim-side-agent-abuse', 'attacker-controlled-component',
  'attacker-controlled-infrastructure', 'attacker-side-ai-use', 'ai-review-targeting', 'other-unclear',
]);
const ARTIFACT_KINDS = new Set([
  'command', 'executable', 'flag-argument', 'prompt-instruction', 'agent-configuration',
  'ide-cli', 'extension', 'skill', 'mcp-tool', 'mcp-server', 'domain', 'ip', 'url', 'hash',
  'file-path', 'package', 'repository', 'user-agent', 'workflow', 'action-ref', 'runner', 'configuration',
]);
const DATA_SOURCES = new Set([
  'endpoint', 'process', 'network', 'dns', 'identity', 'repository', 'package',
  'agent-ide', 'github-actions', 'ci-cd', 'cloud',
]);
const EMPTY_RECORDS = () => Object.fromEntries(GROUPS.map(name => [name, []]));

export const CANDIDATE_RECORD_GUIDE = Object.freeze({
  note: 'Documentation only: place each optional array at the candidate top level; never return a records property. Every candidate record requires nonempty exact supportingClaimIds using local claim IDs. Unknown fields are rejected. Resolved frameworks may add a separate authoritative catalog source.',
  behaviors: '{localId,name,boundary,description,supportingClaimIds,occurrences?:[{supportingClaimIds}]}',
  paths: '{localId,scope,supportingClaimIds,nodes:[{localId,title,detail,behaviorIds,supportingClaimIds,evidenceStatus}],edges:[{localId,from,to,supportingClaimIds,relation,basis,evidenceBasis}]}',
  mappings: '{localId,behaviorId,framework,version,techniqueId,rationale,applicability,supportingClaimIds,mappingBasis,pathId?,nodeId?,sourceLiteral?}',
  telemetry: '{localId,behaviorId,category,eventType,logicalFields,joinKeys,availability,schema,limitations,supportingClaimIds,collection}; article-mentioned becomes a data-sources annotation, proposed becomes a sensor record',
  detections: '{localId,behaviorId,hypothesis,signalIds,otelIds,windowSeconds,windowBasis,tuning,testPlan,validation,supportingClaimIds,kind}; published-reference becomes an annotation, hypothesis becomes a proposal record',
  otel: '{localId,behaviorId,action,standardSourceIds,customFields,sample,sampleFormat,sampleOrigin,stability,limitations,supportingClaimIds}',
  annotations: 'roles:{value,supportingClaimIds}; artifacts:{kind,literal,normalizedValue?,supportingClaimIds}; published:{title,literal,referenceUrl?,supportingClaimIds}; dataSources:{value,supportingClaimIds}',
  templates: '{templateId,version,hash}; no templates are enabled until individually audited and pinned',
});

const fields = {
  behaviors: ['localId', 'name', 'boundary', 'description', 'supportingClaimIds', 'occurrences'],
  paths: ['localId', 'scope', 'supportingClaimIds', 'nodes', 'edges'],
  nodes: ['localId', 'title', 'detail', 'behaviorIds', 'supportingClaimIds', 'evidenceStatus'],
  edges: ['localId', 'from', 'to', 'supportingClaimIds', 'relation', 'basis', 'evidenceBasis'],
  mappings: ['localId', 'behaviorId', 'framework', 'version', 'techniqueId', 'rationale', 'applicability', 'supportingClaimIds', 'mappingBasis', 'pathId', 'nodeId', 'sourceLiteral'],
  telemetry: ['localId', 'behaviorId', 'category', 'eventType', 'logicalFields', 'joinKeys', 'availability', 'schema', 'limitations', 'supportingClaimIds', 'collection'],
  detections: ['localId', 'behaviorId', 'hypothesis', 'signalIds', 'otelIds', 'windowSeconds', 'windowBasis', 'tuning', 'testPlan', 'validation', 'supportingClaimIds', 'kind'],
  otel: ['localId', 'behaviorId', 'action', 'standardSourceIds', 'customFields', 'sample', 'sampleFormat', 'sampleOrigin', 'stability', 'limitations', 'supportingClaimIds'],
  occurrences: ['supportingClaimIds'],
  roles: ['value', 'supportingClaimIds'],
  artifacts: ['kind', 'literal', 'normalizedValue', 'supportingClaimIds'],
  published: ['title', 'literal', 'referenceUrl', 'supportingClaimIds'],
  dataSources: ['value', 'supportingClaimIds'],
  templates: ['templateId', 'version', 'hash'],
};

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_CAMPAIGN_RECORDS';
  throw error;
}

function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${location} must be an object`);
  return value;
}

function exact(value, kind, location) {
  object(value, location);
  const unknown = Object.keys(value).filter(key => !fields[kind].includes(key));
  if (unknown.length) invalid(`${location} has unknown field ${unknown[0]}`);
  return value;
}

function text(value, location) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${location} must be nonempty text`);
  return value;
}

function id(value, location) {
  if (!ID.test(text(value, location))) invalid(`${location} must be an identifier`);
  return value;
}

function array(value, location, { nonempty = false } = {}) {
  if (!Array.isArray(value) || (nonempty && !value.length)) invalid(`${location} must be ${nonempty ? 'a nonempty ' : 'an '}array`);
  return value;
}

function unique(values, location) {
  if (new Set(values).size !== values.length) invalid(`${location} contains duplicates`);
  return values;
}

function candidateArray(candidate, name) {
  const value = candidate[name] ?? [];
  return array(value, `candidate.${name}`);
}

function referenceMap(claimIds) {
  if (claimIds instanceof Map) return claimIds;
  if (!claimIds || typeof claimIds !== 'object' || Array.isArray(claimIds)) invalid('claimIds must be an object or Map');
  return new Map(Object.entries(claimIds));
}

function originForClaim(claim) {
  return claim?.evidenceStatus === 'Researcher inference' ? 'LLM synthesis' : 'LLM source paraphrase';
}

function safeReferenceUrl(value, location) {
  if (value === undefined) return;
  let parsed;
  try { parsed = new URL(value); } catch { invalid(`${location} must be a URL`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /[\u0000-\u0020\\]/u.test(value)) {
    invalid(`${location} must be credential-free HTTPS`);
  }
}

function findCatalogSource(corpus, catalog) {
  const expected = catalogSource(catalog);
  const existing = (corpus.sources ?? []).find(source => source.id === expected.id);
  if (existing && canonicalSerialize(existing) !== canonicalSerialize(expected)) invalid(`catalog source collision ${expected.id}`);
  return existing ?? expected;
}

function unknownDate() {
  return {
    precision: 'unknown', value: null, start: null, end: null,
    nullReasons: { value: 'not_reported', start: 'not_applicable', end: 'not_applicable' },
  };
}

function catalogSource(catalog) {
  return {
    id: stableId('catalog-source', `${catalog.immutableRevision}\n${catalog.materialDigest}`),
    originalUrl: catalog.materialUrl, canonicalUrl: catalog.materialUrl,
    title: `MITRE ${catalog.framework} ${catalog.version} pinned catalog material`,
    publisher: 'The MITRE Corporation', author: null,
    publicationDate: unknownDate(), updateDate: unknownDate(),
    retrievalDate: {
      precision: 'day', value: catalog.retrievalDate, start: null, end: null,
      nullReasons: { start: 'not_applicable', end: 'not_applicable' },
    },
    inputKind: 'url',
    provenance: {
      kind: 'supplied-url', suppliedBy: PINNED_FRAMEWORK_CATALOG.resolverVersion,
      description: 'Pinned official framework catalog identity; separate from incident evidence.',
      nullReasons: {},
    },
    revisionIds: [], extractionStatus: 'Not started', collectionState: 'Collected',
    nullReasons: { author: 'not_reported' },
  };
}

function inertSample(sample, location) {
  object(sample, location);
  if (!Object.keys(sample).length) invalid(`${location} must contain an inert synthetic sample`);
  for (const [key, value] of Object.entries(sample)) {
    if (!SAMPLE_KEYS.has(key)) invalid(`${location} uses non-allowlisted key ${key}`);
    if (typeof value !== 'string' || !(/^synthetic\.[a-z0-9._-]+$/i.test(value)
      || value === 'example.invalid' || /^https:\/\/(?:[a-z0-9-]+\.)*example\.invalid(?:\/[a-z0-9._~!$&'()*+,;=:@%/-]*)?$/i.test(value))) {
      invalid(`${location}.${key} must be a synthetic.* value or reserved example.invalid HTTPS value`);
    }
  }
}

export function normalizeCampaignRecords({
  candidate, request, claims, passages, corpus, runId, claimIds = {},
}) {
  object(candidate, 'candidate'); object(request, 'request'); object(corpus, 'corpus');
  id(runId, 'runId');
  const caseId = id(request.caseId, 'request.caseId');
  const allClaims = array(claims, 'claims');
  const allPassages = array(passages, 'passages');
  const byClaim = new Map([...(corpus.claims ?? []), ...allClaims].map(claim => [claim.id, claim]));
  const byPassage = new Map([...(corpus.passages ?? []), ...allPassages].map(passage => [passage.id, passage]));
  const refs = referenceMap(claimIds);
  const records = EMPTY_RECORDS();
  const annotations = [], recordSupport = [], unresolvedMappings = [], templateProvenance = [];
  const catalogProvenance = [];
  const generated = new Map();
  const local = Object.fromEntries(GROUPS.map(name => [name, new Map()]));
  const coreIds = new Set(GROUPS.flatMap(name => (corpus[name] ?? []).map(item => item.id)));

  const makeId = (type, localId) => stableId(`campaign-${type}`, `${runId}\n${localId}`);
  const register = (type, localId, record) => {
    id(localId, `${type}.localId`);
    if (local[type].has(localId)) invalid(`duplicate ${type} localId ${localId}`);
    if (generated.has(record.id) || coreIds.has(record.id)) invalid(`generated ID collision ${record.id}`);
    local[type].set(localId, record.id); generated.set(record.id, type); records[type].push(record);
  };
  const resolveClaims = (values, location) => {
    unique(array(values, location, { nonempty: true }), location);
    return values.map((localId, index) => {
      id(localId, `${location}[${index}]`);
      const finalId = refs.get(localId) ?? localId;
      const claim = byClaim.get(finalId);
      if (!claim) invalid(`${location} refers to unknown claim ${localId}`);
      if (claim.caseId !== caseId) invalid(`${location} refers to claim in another case`);
      return finalId;
    });
  };
  const support = (recordType, recordId, claimRefs, kind, extra = {}) => {
    const supportingClaimIds = resolveClaims(claimRefs, `${recordType}.${recordId}.supportingClaimIds`);
    const origin = supportingClaimIds.some(claimId => originForClaim(byClaim.get(claimId)) === 'LLM synthesis')
      ? 'LLM synthesis' : 'LLM source paraphrase';
    recordSupport.push({
      id: makeId('record-support', `${recordType}:${recordId}:${kind}:${recordSupport.length}`),
      caseId, recordType, recordId, kind, supportingClaimIds, origin, disposition: 'Pending', ...extra,
    });
    return supportingClaimIds;
  };
  const annotate = ({ key, type, value, claimRefs, context, normalizedValue, externalReferenceUrl, literal }) => {
    const resolved = resolveClaims(claimRefs, `annotation.${key}.supportingClaimIds`);
    for (const claimId of resolved) {
      const claim = byClaim.get(claimId);
      const passage = (claim.passageIds ?? []).map(passageId => byPassage.get(passageId))
        .find(item => item?.sourceRevisionId === claim.sourceRevisionId && typeof item.text === 'string'
          && (literal === undefined || item.text.includes(literal)));
      annotations.push({
        id: makeId('annotation', `${key}:${claimId}`),
        type, value, caseId, sourceId: claim.sourceId, sourceRevisionId: claim.sourceRevisionId,
        evidenceStatus: passage ? 'evidence-backed'
          : claim.evidenceStatus === 'Researcher inference' ? 'inference' : 'unresolved',
        ...(passage ? { support: { quote: passage.text, locator: { start: passage.start, end: passage.end } } } : {}),
        claimIds: [claimId], ...(context ? {
          context: structuredClone(typeof context === 'function' ? context(claim) : context),
        } : {}),
        ...(normalizedValue !== undefined ? { normalizedValue } : {}),
        ...(externalReferenceUrl !== undefined ? { externalReferenceUrl } : {}),
        status: 'pending', origin: 'agent',
      });
    }
    return resolved;
  };

  for (const [index, input] of candidateArray(candidate, 'behaviors').entries()) {
    const item = exact(input, 'behaviors', `candidate.behaviors[${index}]`);
    const localId = id(item.localId, `candidate.behaviors[${index}].localId`);
    const recordId = makeId('behavior', localId);
    const allSupport = support('behaviors', recordId, item.supportingClaimIds, 'behavior-definition');
    const occurrences = [{
      caseId, claimIds: allSupport,
      origin: allSupport.some(claimId => originForClaim(byClaim.get(claimId)) === 'LLM synthesis')
        ? 'LLM synthesis' : 'LLM source paraphrase',
      disposition: 'Pending',
    }];
    for (const [occurrenceIndex, occurrence] of (item.occurrences ?? []).entries()) {
      exact(occurrence, 'occurrences', `candidate.behaviors[${index}].occurrences[${occurrenceIndex}]`);
      const occurrenceClaims = support('behaviors', recordId, occurrence.supportingClaimIds, 'behavior-occurrence', { caseId });
      occurrences.push({
        caseId, claimIds: occurrenceClaims,
        origin: occurrenceClaims.some(claimId => originForClaim(byClaim.get(claimId)) === 'LLM synthesis')
          ? 'LLM synthesis' : 'LLM source paraphrase',
        disposition: 'Pending',
      });
    }
    const behaviorClaimIds = [...new Set(occurrences.flatMap(occurrence => occurrence.claimIds))];
    annotate({
      key: `behavior:${localId}`, type: 'observed-behavior', value: text(item.name, 'behavior.name'),
      claimRefs: behaviorClaimIds,
      context: claim => ({
        behavior: claim.evidenceStatus === 'Researcher inference' ? 'inferred'
          : claim.evidenceStatus === 'Attempted behavior' ? 'attempted'
            : claim.evidenceStatus === 'Demonstrated capability or proof of concept' ? 'demonstrated' : 'observed',
      }),
    });
    register('behaviors', localId, {
      id: recordId, caseId, claimIds: behaviorClaimIds, occurrences,
      namespace: `campaign:${runId}`, name: item.name,
      boundary: text(item.boundary, 'behavior.boundary'), description: text(item.description, 'behavior.description'),
      signalIds: [], detectionIds: [], otelIds: [],
      origin: allSupport.some(claimId => originForClaim(byClaim.get(claimId)) === 'LLM synthesis')
        ? 'LLM synthesis' : 'LLM normalized behavior',
      disposition: 'Pending',
    });
  }

  const telemetryLocalIds = new Set();
  for (const [index, input] of candidateArray(candidate, 'telemetry').entries()) {
    const item = exact(input, 'telemetry', `candidate.telemetry[${index}]`);
    if (!['article-mentioned', 'proposed'].includes(item.collection)) invalid('telemetry.collection must be article-mentioned or proposed');
    const behaviorId = local.behaviors.get(item.behaviorId);
    if (!behaviorId) invalid(`telemetry refers to unknown behavior ${item.behaviorId}`);
    const localId = id(item.localId, 'telemetry.localId'), recordId = makeId('telemetry', localId);
    if (telemetryLocalIds.has(localId)) invalid(`duplicate telemetry localId ${localId}`);
    telemetryLocalIds.add(localId);
    text(item.category, 'telemetry.category'); text(item.eventType, 'telemetry.eventType');
    unique(array(item.logicalFields, 'telemetry.logicalFields').map((value, i) => text(value, `telemetry.logicalFields[${i}]`)), 'telemetry.logicalFields');
    unique(array(item.joinKeys, 'telemetry.joinKeys').map((value, i) => text(value, `telemetry.joinKeys[${i}]`)), 'telemetry.joinKeys');
    text(item.availability, 'telemetry.availability'); text(item.schema, 'telemetry.schema');
    text(item.limitations, 'telemetry.limitations');
    if (item.collection === 'article-mentioned') {
      annotate({
        key: `telemetry:${localId}`, type: 'data-sources', value: `${item.category}: ${item.eventType}`,
        claimRefs: item.supportingClaimIds,
        context: {
          collection: 'article-mentioned',
          ...(DATA_SOURCES.has(item.category) ? { dataSources: [item.category] } : {}),
        },
      });
      continue;
    }
    support('telemetry', recordId, item.supportingClaimIds, item.collection);
    register('telemetry', localId, {
      id: recordId, behaviorId, category: item.category, eventType: item.eventType,
      logicalFields: item.logicalFields, joinKeys: item.joinKeys,
      availability: item.availability, schema: item.schema, limitations: item.limitations,
      origin: 'LLM proposed collection', disposition: 'Pending',
    });
  }

  for (const [index, input] of candidateArray(candidate, 'otel').entries()) {
    const item = exact(input, 'otel', `candidate.otel[${index}]`);
    const behaviorId = local.behaviors.get(item.behaviorId);
    if (!behaviorId) invalid(`otel refers to unknown behavior ${item.behaviorId}`);
    if (item.sampleOrigin !== SAMPLE_ORIGIN) invalid(`otel.sampleOrigin must be ${SAMPLE_ORIGIN}`);
    inertSample(item.sample, `candidate.otel[${index}].sample`);
    const localId = id(item.localId, 'otel.localId'), recordId = makeId('otel', localId);
    support('otel', recordId, item.supportingClaimIds, 'instrumentation-proposal');
    const standardSourceIds = unique(array(item.standardSourceIds, 'otel.standardSourceIds')
      .map((value, i) => id(value, `otel.standardSourceIds[${i}]`)), 'otel.standardSourceIds');
    if (standardSourceIds.some(sourceId => !(corpus.sources ?? []).some(source => source.id === sourceId))) {
      invalid('otel.standardSourceIds contains an unknown source');
    }
    const customFields = unique(array(item.customFields, 'otel.customFields')
      .map((value, i) => text(value, `otel.customFields[${i}]`)), 'otel.customFields');
    if (customFields.some(value => !/^synthetic\.[a-z0-9._-]+$/i.test(value))) invalid('otel.customFields must use synthetic.* names');
    register('otel', localId, {
      id: recordId, behaviorId, action: text(item.action, 'otel.action'), standardSourceIds, customFields,
      sample: structuredClone(item.sample), sampleFormat: text(item.sampleFormat, 'otel.sampleFormat'),
      sampleOrigin: SAMPLE_ORIGIN, stability: text(item.stability, 'otel.stability'),
      limitations: text(item.limitations, 'otel.limitations'),
      origin: 'LLM proposed instrumentation', disposition: 'Pending',
    });
  }

  const detectionLocalIds = new Set();
  for (const [index, input] of candidateArray(candidate, 'detections').entries()) {
    const item = exact(input, 'detections', `candidate.detections[${index}]`);
    if (!['published-reference', 'hypothesis'].includes(item.kind)) invalid('detection.kind must be published-reference or hypothesis');
    const behaviorId = local.behaviors.get(item.behaviorId);
    if (!behaviorId) invalid(`detection refers to unknown behavior ${item.behaviorId}`);
    const localId = id(item.localId, 'detection.localId'), recordId = makeId('detection', localId);
    if (detectionLocalIds.has(localId)) invalid(`duplicate detections localId ${localId}`);
    detectionLocalIds.add(localId);
    text(item.hypothesis, 'detection.hypothesis');
    array(item.signalIds, 'detection.signalIds'); array(item.otelIds, 'detection.otelIds');
    if (item.kind === 'published-reference') {
      if (item.signalIds.length || item.otelIds.length) invalid('published detection reference cannot link proposed signals or instrumentation');
      annotate({
        key: `detection:${localId}`, type: 'detection-references', value: item.hypothesis,
        claimRefs: item.supportingClaimIds, context: { detection: 'published-reference' },
      });
      continue;
    }
    const signalIds = unique(array(item.signalIds, 'detection.signalIds').map(value => {
      const resolved = local.telemetry.get(value);
      if (!resolved) invalid(`detection refers to unknown telemetry ${value}`);
      return resolved;
    }), 'detection.signalIds');
    const otelIds = unique(array(item.otelIds, 'detection.otelIds').map(value => {
      const resolved = local.otel.get(value);
      if (!resolved) invalid(`detection refers to unknown otel ${value}`);
      return resolved;
    }), 'detection.otelIds');
    if (!Number.isSafeInteger(item.windowSeconds) || item.windowSeconds < 1) invalid('detection.windowSeconds must be a positive integer');
    support('detections', recordId, item.supportingClaimIds, item.kind);
    register('detections', localId, {
      id: recordId, behaviorId, hypothesis: item.hypothesis, signalIds, otelIds,
      windowSeconds: item.windowSeconds, windowBasis: text(item.windowBasis, 'detection.windowBasis'),
      tuning: text(item.tuning, 'detection.tuning'), testPlan: text(item.testPlan, 'detection.testPlan'),
      validation: text(item.validation, 'detection.validation'),
      origin: 'LLM proposed detection', disposition: 'Pending',
    });
  }

  for (const behavior of records.behaviors) {
    behavior.signalIds = records.telemetry.filter(item => item.behaviorId === behavior.id).map(item => item.id);
    behavior.detectionIds = records.detections.filter(item => item.behaviorId === behavior.id).map(item => item.id);
    behavior.otelIds = records.otel.filter(item => item.behaviorId === behavior.id).map(item => item.id);
  }

  for (const [index, input] of candidateArray(candidate, 'paths').entries()) {
    const item = exact(input, 'paths', `candidate.paths[${index}]`);
    if (!['representative', 'composite'].includes(item.scope)) invalid('path.scope must be representative or composite');
    const localId = id(item.localId, 'path.localId'), recordId = makeId('path', localId);
    const pathClaimIds = support('paths', recordId, item.supportingClaimIds, 'path');
    const nodeMap = new Map();
    const nodes = array(item.nodes, 'path.nodes', { nonempty: true }).map((inputNode, nodeIndex) => {
      const node = exact(inputNode, 'nodes', `candidate.paths[${index}].nodes[${nodeIndex}]`);
      const nodeLocalId = id(node.localId, 'node.localId');
      if (nodeMap.has(nodeLocalId)) invalid(`duplicate node localId ${nodeLocalId}`);
      const nodeId = makeId('node', `${localId}:${nodeLocalId}`);
      if (generated.has(nodeId) || coreIds.has(nodeId)) invalid(`generated ID collision ${nodeId}`);
      generated.set(nodeId, 'nodes'); nodeMap.set(nodeLocalId, nodeId);
      const claimIds = support('nodes', nodeId, node.supportingClaimIds, 'path-node');
      if (!['Source-reported observation', 'Attempted behavior', 'Demonstrated capability or proof of concept', 'Potential consequence', 'Researcher inference', 'Unclear or disputed'].includes(node.evidenceStatus)) {
        invalid('node.evidenceStatus is invalid');
      }
      const behaviorIds = unique(array(node.behaviorIds, 'node.behaviorIds').map(value => {
        const resolved = local.behaviors.get(value);
        if (!resolved) invalid(`node refers to unknown behavior ${value}`);
        return resolved;
      }), 'node.behaviorIds');
      return {
        id: nodeId, title: text(node.title, 'node.title'), detail: text(node.detail, 'node.detail'),
        claimIds, behaviorIds, evidenceStatus: node.evidenceStatus,
        origin: node.evidenceStatus === 'Researcher inference' ? 'LLM synthesis' : 'LLM source paraphrase',
        disposition: 'Pending',
      };
    });
    const edges = array(item.edges, 'path.edges').map((inputEdge, edgeIndex) => {
      const edge = exact(inputEdge, 'edges', `candidate.paths[${index}].edges[${edgeIndex}]`);
      const edgeLocalId = id(edge.localId, 'edge.localId'), edgeId = makeId('edge', `${localId}:${edgeLocalId}`);
      if (generated.has(edgeId) || coreIds.has(edgeId)) invalid(`generated ID collision ${edgeId}`);
      generated.set(edgeId, 'edges');
      const from = nodeMap.get(edge.from), to = nodeMap.get(edge.to);
      if (!from || !to || from === to) invalid('edge endpoints must be distinct nodes in its path');
      if (!['sequence', 'conditional', 'propagates'].includes(edge.relation)) invalid('edge.relation is invalid');
      if (!['source-supported', 'inferred'].includes(edge.evidenceBasis)) invalid('edge.evidenceBasis must be source-supported or inferred');
      const claimIds = support('edges', edgeId, edge.supportingClaimIds, `path-edge-${edge.evidenceBasis}`);
      if (edge.evidenceBasis === 'source-supported'
        && !claimIds.some(claimId => byClaim.get(claimId)?.evidenceStatus !== 'Researcher inference')) {
        invalid('source-supported edge requires a non-inference supporting claim');
      }
      const endpoints = nodes.filter(node => node.id === from || node.id === to).flatMap(node => node.claimIds);
      if (!claimIds.some(claimId => endpoints.includes(claimId))) invalid('edge support must overlap endpoint support');
      return {
        id: edgeId, from, to, claimIds, relation: edge.relation, basis: text(edge.basis, 'edge.basis'),
        origin: edge.evidenceBasis === 'source-supported' ? 'LLM source paraphrase' : 'LLM inferred relationship',
      };
    });
    if (!pathClaimIds.some(claimId => nodes.some(node => node.claimIds.includes(claimId))
      || edges.some(edge => edge.claimIds.includes(claimId)))) {
      invalid('path support must overlap node or edge support');
    }
    register('paths', localId, {
      id: recordId, caseId, nodes, edges, scope: item.scope,
      origin: edges.some(edge => edge.origin === 'LLM inferred relationship') ? 'LLM reconstruction' : 'LLM source paraphrase',
      disposition: 'Pending',
    });
  }

  const frameworkByKey = new Map();
  const mappingLocalIds = new Set();
  for (const [index, input] of candidateArray(candidate, 'mappings').entries()) {
    const item = exact(input, 'mappings', `candidate.mappings[${index}]`);
    const mappingLocalId = id(item.localId, 'mapping.localId');
    if (mappingLocalIds.has(mappingLocalId)) invalid(`duplicate mappings localId ${mappingLocalId}`);
    mappingLocalIds.add(mappingLocalId);
    const supportingClaimIds = resolveClaims(item.supportingClaimIds, `candidate.mappings[${index}].supportingClaimIds`);
    const behaviorId = local.behaviors.get(item.behaviorId);
    if (!behaviorId) invalid(`mapping refers to unknown behavior ${item.behaviorId}`);
    if (!['source-mentioned', 'researcher-proposed'].includes(item.mappingBasis)) invalid('mapping.mappingBasis is invalid');
    const entry = catalogEntry(item.framework, item.version, item.techniqueId);
    const catalogSource = entry && findCatalogSource(corpus, entry.catalog);
    let literalSupported = true;
    if (item.mappingBasis === 'source-mentioned') {
      const literal = text(item.sourceLiteral, 'mapping.sourceLiteral');
      literalSupported = supportingClaimIds.some(claimId => {
        const claim = byClaim.get(claimId);
        return (claim.passageIds ?? []).some(passageId => {
          const passageText = byPassage.get(passageId)?.text;
          return typeof passageText === 'string' && passageText.includes(literal) && passageText.includes(item.techniqueId);
        });
      });
    } else if (item.sourceLiteral !== undefined) invalid('researcher-proposed mapping cannot claim a sourceLiteral');
    if (!entry || !literalSupported) {
      unresolvedMappings.push({
        id: makeId('unresolved-mapping', mappingLocalId),
        caseId, behaviorId, framework: text(item.framework, 'mapping.framework'),
        version: text(item.version, 'mapping.version'), techniqueLiteral: text(item.techniqueId, 'mapping.techniqueId'),
        sourceLiteral: item.sourceLiteral ?? null, supportingClaimIds, mappingBasis: item.mappingBasis,
        reason: !entry ? 'not-in-pinned-catalog' : 'source-literal-not-found-in-supporting-passage',
        origin: item.mappingBasis === 'source-mentioned' ? 'LLM source paraphrase' : 'LLM inferred mapping',
        disposition: 'Pending',
      });
      continue;
    }
    const techniqueKey = `${entry.catalog.framework}:${entry.catalog.version}:${entry.technique.id}`;
    let techniqueRecord = frameworkByKey.get(techniqueKey);
    if (!techniqueRecord) {
      if (!(corpus.sources ?? []).some(source => source.id === catalogSource.id)
        && !records.sources.some(source => source.id === catalogSource.id)) {
        records.sources.push(structuredClone(catalogSource));
      }
      techniqueRecord = {
        id: entry.technique.id, name: entry.technique.name, framework: entry.catalog.framework,
        version: entry.catalog.version, sourceId: catalogSource.id, url: entry.technique.url,
        origin: 'Official framework',
      };
      if (coreIds.has(techniqueRecord.id)) {
        const existing = (corpus.frameworks ?? []).find(record => record.id === techniqueRecord.id);
        if (!existing || existing.name !== techniqueRecord.name || existing.framework !== techniqueRecord.framework
          || existing.version !== techniqueRecord.version || existing.sourceId !== techniqueRecord.sourceId
          || existing.url !== techniqueRecord.url) invalid(`catalog record collision ${techniqueRecord.id}`);
      } else {
        records.frameworks.push(techniqueRecord);
      }
      frameworkByKey.set(techniqueKey, techniqueRecord);
      if (!catalogProvenance.some(item => item.framework === entry.catalog.framework && item.version === entry.catalog.version)) {
        const { techniques, ...provenance } = entry.catalog;
        catalogProvenance.push({ ...provenance, sourceId: catalogSource.id });
      }
    }
    const mappingId = makeId('mapping', mappingLocalId);
    const mapping = {
      id: mappingId, caseId, behaviorId, framework: entry.catalog.framework, version: entry.catalog.version,
      techniqueId: techniqueRecord.id, claimIds: supportingClaimIds,
      rationale: text(item.rationale, 'mapping.rationale'), applicability: text(item.applicability, 'mapping.applicability'),
      origin: item.mappingBasis === 'source-mentioned' ? 'LLM source paraphrase' : 'LLM inferred mapping',
      mappingStatus: 'Proposed', disposition: 'Pending',
    };
    if (Boolean(item.pathId) !== Boolean(item.nodeId)) invalid('mapping.pathId and nodeId must occur together');
    if (item.pathId) {
      const pathId = local.paths.get(item.pathId);
      const path = records.paths.find(record => record.id === pathId);
      const nodeId = path?.nodes.find(node => node.id === makeId('node', `${item.pathId}:${item.nodeId}`))?.id;
      if (!path || !nodeId) invalid('mapping path/node reference is unknown');
      const node = path.nodes.find(value => value.id === nodeId);
      if (!node.behaviorIds.includes(behaviorId) || !supportingClaimIds.some(claimId => node.claimIds.includes(claimId))) {
        invalid('mapping path/node does not share behavior and claim support');
      }
      mapping.pathId = pathId; mapping.nodeId = nodeId;
    }
    support('mappings', mappingId, item.supportingClaimIds, item.mappingBasis);
    register('mappings', mappingLocalId, mapping);
  }

  for (const name of ANNOTATION_INPUTS) {
    for (const [index, input] of candidateArray(candidate, name).entries()) {
      const item = exact(input, name, `candidate.${name}[${index}]`);
      const supportingClaimIds = resolveClaims(item.supportingClaimIds, `candidate.${name}[${index}].supportingClaimIds`);
      if (name === 'roles' && !ROLES.has(item.value)) invalid(`unknown role ${item.value}`);
      if (name === 'artifacts' && !ARTIFACT_KINDS.has(item.kind)) invalid(`unknown artifact kind ${item.kind}`);
      if (name === 'dataSources' && !DATA_SOURCES.has(item.value)) invalid(`unknown data source ${item.value}`);
      if (name === 'published') safeReferenceUrl(item.referenceUrl, `candidate.${name}[${index}].referenceUrl`);
      const literal = name === 'artifacts' ? text(item.literal, 'artifact.literal')
        : name === 'published' ? text(item.literal, 'published.literal') : undefined;
      if (literal && !supportingClaimIds.some(claimId => (byClaim.get(claimId).passageIds ?? [])
        .some(passageId => byPassage.get(passageId)?.text?.includes(literal)))) {
        invalid(`${name} literal is absent from supporting claim passages`);
      }
      const indicator = name === 'artifacts' && ['domain', 'ip', 'url', 'hash', 'file-path', 'package',
        'repository', 'user-agent', 'workflow', 'action-ref', 'runner', 'configuration'].includes(item.kind);
      annotate({
        key: `${name}:${index}`,
        type: name === 'roles' ? 'role-context'
          : name === 'artifacts' ? indicator ? 'traditional-indicators' : 'commands-ai-artifacts'
            : name === 'published' ? 'detection-references' : 'data-sources',
        value: name === 'artifacts' ? item.literal : name === 'published' ? item.title : item.value,
        claimRefs: supportingClaimIds, literal,
        ...(name === 'roles' ? { context: { roles: [item.value] } } : {}),
        ...(name === 'artifacts' ? {
          context: indicator ? { indicatorKind: item.kind } : { artifactKind: item.kind },
          ...(item.normalizedValue !== undefined ? { normalizedValue: item.normalizedValue } : {}),
        } : {}),
        ...(name === 'published' ? {
          context: { detection: 'published-reference' },
          ...(item.referenceUrl !== undefined ? { externalReferenceUrl: item.referenceUrl } : {}),
        } : {}),
        ...(name === 'dataSources' ? {
          context: { collection: 'article-mentioned', dataSources: [item.value] },
        } : {}),
      });
    }
  }

  for (const [index, input] of candidateArray(candidate, 'templates').entries()) {
    exact(input, 'templates', `candidate.templates[${index}]`);
    invalid(`template ${input.templateId ?? index} is not in the audited template allowlist`);
  }

  for (const name of GROUPS) records[name].sort((a, b) => a.id.localeCompare(b.id));
  annotations.sort((a, b) => a.id.localeCompare(b.id));
  recordSupport.sort((a, b) => a.id.localeCompare(b.id));
  unresolvedMappings.sort((a, b) => a.id.localeCompare(b.id));
  return { records, annotations, recordSupport, unresolvedMappings, templateProvenance, catalogProvenance };
}

export { PINNED_FRAMEWORK_CATALOG, catalogSnapshot };
