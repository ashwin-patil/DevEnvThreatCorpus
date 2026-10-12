import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const schema = JSON.parse(readFileSync(new URL('../schemas/corpus.schema.json', import.meta.url), 'utf8'));
export const CONTRACT_VERSION = '0.3.0';
export const NORMALIZATION_VERSION = 'unicode-lf-nfc/1';
export const categories = Object.freeze(Object.fromEntries(Object.entries({
  trust_surface: 'trustSurface', ai_involvement: 'aiInvolvement', execution_location: 'executionLocation',
  delivery: 'delivery', objective: 'objective', evidence_to_seek: 'evidenceToSeek',
}).map(([dimension, definition]) => [dimension, Object.freeze(schema.$defs[definition].enum.filter(value => value !== null))])));

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function normalizeText(text) {
  return text.replace(/\r\n?/g, '\n').normalize('NFC');
}

const entityCollections = new Set(Object.keys(schema.properties).filter(key => schema.properties[key].type === 'array'));
function ordered(value, key = '') {
  if (Array.isArray(value)) {
    const entries = entityCollections.has(key) ? [...value].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : value;
    return entries.map(item => ordered(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(name => [name, ordered(value[name], name)]));
  }
  return value;
}

export function canonicalSerialize(value) {
  return JSON.stringify(ordered(value), null, 2) + '\n';
}

export function digest(value) {
  return sha256(canonicalSerialize(value));
}

export function stableId(namespace, canonicalIdentity) {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace) || !canonicalIdentity?.trim()) throw new Error('identity requires namespace and canonical identity');
  return `${namespace}-${sha256(`${namespace}\n${canonicalIdentity}`)}`;
}

export function canonicalUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('URL must be credential-free HTTPS');
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(name) || ['fbclid', 'gclid'].includes(name.toLowerCase())) url.searchParams.delete(name);
  }
  return url.href;
}

export const URL_NORMALIZATION_VERSION = 'https-tracking/1';

function structural(value, definition, path, errors) {
  if (definition.$ref) return structural(value, schema.$defs[definition.$ref.split('/').at(-1)], path, errors);
  const fail = message => errors.push(`${path}: ${message}`);
  if (definition.anyOf) {
    if (!definition.anyOf.some(branch => { const trial = []; structural(value, branch, path, trial); return trial.length === 0; })) fail('does not match any allowed shape');
    return;
  }
  if ('const' in definition && value !== definition.const) fail(`must equal ${JSON.stringify(definition.const)}`);
  if (definition.enum && !definition.enum.includes(value)) fail(`invalid enum ${JSON.stringify(value)}`);
  if (definition.allOf) for (const branch of definition.allOf) structural(value, branch, path, errors);
  if (definition.if) {
    const trial = [];
    structural(value, definition.if, path, trial);
    const branch = trial.length === 0 ? definition.then : definition.else;
    if (branch) structural(value, branch, path, errors);
  }
  if (definition.type) {
    const matches = definition.type === 'null' ? value === null
      : definition.type === 'array' ? Array.isArray(value)
      : definition.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : definition.type === 'integer' ? Number.isSafeInteger(value)
      : typeof value === definition.type;
    if (!matches) { fail(`must be ${definition.type}`); return; }
  }
  if (typeof value === 'string') {
    if (definition.minLength && [...value].length < definition.minLength) fail('empty string is not an unknown value');
    if (definition.pattern && !new RegExp(definition.pattern).test(value)) fail('invalid string pattern');
  }
  if (typeof value === 'number' && definition.minimum !== undefined && value < definition.minimum) fail(`must be >= ${definition.minimum}`);
  if (Array.isArray(value)) {
    if (definition.minItems && value.length < definition.minItems) fail(`requires at least ${definition.minItems} items`);
    if (definition.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) fail('duplicate array item');
    if (definition.items) value.forEach((item, index) => structural(item, definition.items, `${path}[${index}]`, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of definition.required ?? []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (definition.properties?.[key]) structural(item, definition.properties[key], `${path}.${key}`, errors);
      else if (definition.additionalProperties === false) fail(`unknown field ${key}`);
      else if (typeof definition.additionalProperties === 'object') structural(item, definition.additionalProperties, `${path}.${key}`, errors);
    }
  }
}

export function validateShape(corpus) {
  const errors = [];
  structural(corpus, schema, 'corpus', errors);
  return errors;
}

function realDate(value) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value ?? '');
  if (!match || +match[1] < 1) return false;
  const month = match[2] ? +match[2] : 1;
  const day = match[3] ? +match[3] : 1;
  const year = +match[1];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.test(value) && realDate(value.slice(0, 10));
}

function dateErrors(date, path, errors) {
  const fail = message => errors.push(`${path}: ${message}`);
  if (date.precision === 'unknown') {
    if (date.value !== null || date.start !== null || date.end !== null) fail('unknown date cannot contain invented value/range');
  } else if (date.precision === 'range') {
    if (date.value !== null || !realDate(date.start) || !realDate(date.end)) fail('range requires real start/end dates and null value');
    else if (date.start.length !== date.end.length || date.start > date.end) fail('range endpoints must have equal precision and be ordered');
  } else {
    const length = { day: 10, month: 7, year: 4 }[date.precision];
    if (date.value?.length !== length || !realDate(date.value) || date.start !== null || date.end !== null) fail('invalid real calendar date or precision');
  }
}

function nullErrors(entity, path, errors) {
  if (!entity || typeof entity !== 'object') return;
  if (Array.isArray(entity)) return entity.forEach((item, i) => nullErrors(item, `${path}[${i}]`, errors));
  if (Object.hasOwn(entity, 'nullReasons')) {
    for (const [key, value] of Object.entries(entity)) {
      if (value === null && !Object.hasOwn(entity.nullReasons, key)) errors.push(`${path}.${key}: null requires a field-specific null reason`);
    }
    for (const key of Object.keys(entity.nullReasons)) {
      const value = key.split('.').reduce((node, part) => node?.[part], entity);
      if (value !== null) errors.push(`${path}.nullReasons.${key}: reason must describe an existing null field`);
    }
  }
  for (const [key, value] of Object.entries(entity)) {
    if (!['governance', 'nullReasons', 'sample', 'otelReference'].includes(key)) nullErrors(value, `${path}.${key}`, errors);
  }
}

export function entityContentHash(entity) {
  const { disposition, collectionState, history, ...content } = entity;
  return digest(content);
}

export function reviewBaseDigest(corpus) {
  const copy = structuredClone(corpus);
  copy.reviews = [];
  for (const name of ['cases', 'claims', 'categorizations', 'timelines']) {
    for (const entity of copy[name]) {
      entity.disposition = 'Pending';
      entity.history = [];
      if (name === 'cases') entity.collectionState = 'Extracted — review pending';
    }
  }
  return digest(copy);
}

export function dependencyHashes(corpus, entityType, entityId) {
  const result = {};
  const visited = new Set([`${entityType}:${entityId}`]);
  function add(type, id) {
    const key = `${type}:${id}`;
    if (visited.has(key)) return;
    visited.add(key);
    const entity = corpus[type]?.find(item => item.id === id);
    if (!entity) throw new Error(`dangling dependency ${key}`);
    result[key] = ['cases', 'claims', 'categorizations', 'timelines'].includes(type) ? entityContentHash(entity) : digest(entity);
    walk(type, entity);
  }
  function walk(type, entity) {
    if (type === 'sources') entity.revisionIds.forEach(id => add('sourceRevisions', id));
    if (type === 'sourceRevisions') add('sources', entity.sourceId);
    if (type === 'passages') add('sourceRevisions', entity.sourceRevisionId);
    if (type === 'claims') {
      add('sources', entity.sourceId);
      add('sourceRevisions', entity.sourceRevisionId);
      entity.passageIds.forEach(id => add('passages', id));
      entity.inference?.supportingClaimIds.forEach(id => add('claims', id));
      entity.conflictsWith.forEach(id => add('claims', id));
      // Bind case linkage and limits without a cyclic case-summary dependency.
      const parent = corpus.cases.find(item => item.id === entity.caseId);
      if (!parent) throw new Error(`dangling dependency cases:${entity.caseId}`);
      result[`caseScope:${parent.id}`] = digest({ id: parent.id, sourceIds: parent.sourceIds, kind: parent.kind, limits: parent.limits, revision: parent.revision });
    }
    if (type === 'cases') {
      entity.sourceIds.forEach(id => add('sources', id));
      entity.summaryClaimIds.forEach(id => add('claims', id));
      entity.pathIds?.forEach(id => add('paths', id));
    }
    if (type === 'categorizations' || type === 'timelines') {
      entity.supportingClaimIds.forEach(id => add('claims', id));
      entity.sourceIds?.forEach(id => add('sources', id));
      entity.sourceRevisionIds?.forEach(id => add('sourceRevisions', id));
    }
    if (type === 'paths') {
      entity.nodes.forEach(node => {
        node.claimIds.forEach(id => add('claims', id));
        node.behaviorIds.forEach(id => add('behaviors', id));
      });
      entity.edges.forEach(edge => edge.claimIds.forEach(id => add('claims', id)));
    }
  }
  const entity = corpus[entityType]?.find(item => item.id === entityId);
  if (!entity) throw new Error(`unknown ${entityType}:${entityId}`);
  walk(entityType, entity);
  return ordered(result);
}

export function currentReview(corpus, entityType, entity) {
  const event = corpus.reviews.find(item => item.id === entity.history.at(-1));
  if (!event || event.entityType !== entityType || event.entityId !== entity.id ||
      event.revision !== entity.revision || event.disposition !== entity.disposition ||
      event.reviewerKind !== 'human' || !timestamp(event.timestamp) ||
      event.contentHash !== entityContentHash(entity) || event.baseDigest !== reviewBaseDigest(corpus)) return false;
  return canonicalSerialize(event.dependencyHashes) === canonicalSerialize(dependencyHashes(corpus, entityType, entity.id));
}

export function validateCorpus(corpus) {
  const errors = validateShape(corpus);
  if (errors.length) return errors;
  const fail = (type, id, message) => errors.push(`${type}:${id}: ${message}`);
  const index = {};
  for (const name of entityCollections) {
    index[name] = new Map();
    for (const entity of corpus[name] ?? []) {
      if (index[name].has(entity.id)) fail(name, entity.id, 'duplicate ID');
      index[name].set(entity.id, entity);
    }
  }
  const ref = (type, id, owner, ownerId) => {
    const entity = index[type]?.get(id);
    if (!entity) fail(owner, ownerId, `dangling ${type} ${id}`);
    return entity;
  };
  const refs = (type, ids, owner, ownerId) => ids.forEach(id => ref(type, id, owner, ownerId));
  const caseClaims = (ids, caseId, type, id) => ids.forEach(claimId => {
    const claim = ref('claims', claimId, type, id);
    if (claim && claim.caseId !== caseId) fail(type, id, `claim ${claimId} belongs to another case`);
  });
  nullErrors(corpus, 'corpus', errors);
  for (const source of corpus.sources) {
    for (const field of ['originalUrl', 'canonicalUrl']) {
      if (source[field] !== null) {
        try { canonicalUrl(source[field]); } catch { fail('sources', source.id, `${field} must be credential-free HTTPS`); }
      }
    }
    if ((source.originalUrl === null) !== (source.canonicalUrl === null)) fail('sources', source.id, 'original/canonical URL nullability must agree');
    if (source.originalUrl === null && (!['supplied-text', 'text-file'].includes(source.inputKind) || source.provenance.kind !== 'supplied-text' || !source.provenance.suppliedBy)) fail('sources', source.id, 'URL absence requires supplied-text provenance and supplier');
    for (const key of ['publicationDate', 'updateDate', 'retrievalDate']) dateErrors(source[key], `sources:${source.id}.${key}`, errors);
    for (const id of source.revisionIds) {
      const revision = ref('sourceRevisions', id, 'sources', source.id);
      if (revision && revision.sourceId !== source.id) fail('sources', source.id, `revision ${id} belongs to another source`);
    }
  }
  for (const revision of corpus.sourceRevisions) {
    const source = ref('sources', revision.sourceId, 'sourceRevisions', revision.id);
    if (source && !source.revisionIds.includes(revision.id)) fail('sourceRevisions', revision.id, 'revision is not in source revisionIds');
    if (revision.normalizationVersion !== NORMALIZATION_VERSION) fail('sourceRevisions', revision.id, 'unsupported normalization version');
    for (const [field, hash] of [['rawContent', 'rawHash'], ['normalizedContent', 'normalizedHash']]) {
      if (revision[field] !== null && sha256(revision[field]) !== revision[hash]) fail('sourceRevisions', revision.id, `${hash} does not match retained content`);
    }
    if (revision.rawContent !== null && revision.normalizedContent !== null && normalizeText(revision.rawContent) !== revision.normalizedContent) fail('sourceRevisions', revision.id, 'raw/normalized content transformation mismatch');
    if (revision.normalizedContent !== null && normalizeText(revision.normalizedContent) !== revision.normalizedContent) fail('sourceRevisions', revision.id, 'retained normalized content is not normalized');
    if (!revision.rawHash || !revision.normalizedHash) fail('sourceRevisions', revision.id, 'revision requires raw and normalized hashes');
    if (revision.retention === 'not-retained' && (revision.rawContent !== null || revision.normalizedContent !== null)) fail('sourceRevisions', revision.id, 'not-retained revision contains content');
  }
  for (const passage of corpus.passages) {
    const revision = ref('sourceRevisions', passage.sourceRevisionId, 'passages', passage.id);
    if (passage.end <= passage.start) fail('passages', passage.id, 'end must follow start');
    if (!revision) continue;
    if (revision.normalizedContent !== null) {
      const points = [...revision.normalizedContent];
      if (passage.end > points.length || passage.text !== points.slice(passage.start, passage.end).join('')) fail('passages', passage.id, 'fabricated passage text or Unicode code-point offsets');
    } else {
      const attestation = passage.attestation;
      if (!attestation || !revision.normalizedHash || attestation.revisionHash !== revision.normalizedHash || !timestamp(attestation.timestamp)) fail('passages', passage.id, 'absent retained content requires human passage/locator attestation and matching revision hash');
      if (passage.text !== null && [...passage.text].length !== passage.end - passage.start) fail('passages', passage.id, 'attested text length disagrees with code-point offsets');
    }
  }
  for (const caseRecord of corpus.cases) {
    refs('sources', caseRecord.sourceIds, 'cases', caseRecord.id);
    caseClaims(caseRecord.summaryClaimIds, caseRecord.id, 'cases', caseRecord.id);
    if (caseRecord.summary !== null && !caseRecord.summaryClaimIds.length) fail('cases', caseRecord.id, 'summary requires cited claims');
    for (const pathId of caseRecord.pathIds ?? []) {
      const path = ref('paths', pathId, 'cases', caseRecord.id);
      if (path && path.caseId !== caseRecord.id) fail('cases', caseRecord.id, 'path belongs to another case');
    }
  }
  for (const claim of corpus.claims) {
    const caseRecord = ref('cases', claim.caseId, 'claims', claim.id);
    ref('sources', claim.sourceId, 'claims', claim.id);
    const revision = ref('sourceRevisions', claim.sourceRevisionId, 'claims', claim.id);
    if (caseRecord && !caseRecord.sourceIds.includes(claim.sourceId)) fail('claims', claim.id, 'source not linked to case');
    if (revision && revision.sourceId !== claim.sourceId) fail('claims', claim.id, 'wrong source revision');
    for (const passageId of claim.passageIds) {
      const passage = ref('passages', passageId, 'claims', claim.id);
      if (passage && passage.sourceRevisionId !== claim.sourceRevisionId) fail('claims', claim.id, 'wrong-revision passage');
    }
    if (!claim.passageIds.length && !claim.inference) fail('claims', claim.id, 'missing passage or explicit inference basis');
    if (claim.evidenceStatus === 'Researcher inference') {
      if (!claim.inference) fail('claims', claim.id, 'researcher inference requires rationale and supporting claims');
    } else if (claim.inference) fail('claims', claim.id, 'inference basis requires Researcher inference classification');
    if (claim.inference) {
      caseClaims(claim.inference.supportingClaimIds, claim.caseId, 'claims', claim.id);
      if (claim.inference.supportingClaimIds.includes(claim.id)) fail('claims', claim.id, 'inference cannot support itself');
    }
    for (const conflictId of claim.conflictsWith) {
      const conflict = ref('claims', conflictId, 'claims', claim.id);
      if (conflictId === claim.id || conflict?.caseId !== claim.caseId) fail('claims', claim.id, 'conflict must refer to another claim in the same case');
      if (conflict && !conflict.conflictsWith.includes(claim.id)) fail('claims', claim.id, 'conflict relation must be reciprocal');
    }
  }
  const active = new Set(), done = new Set();
  function visit(id) {
    if (active.has(id)) { fail('claims', id, 'inference support cycle'); return; }
    if (done.has(id)) return;
    active.add(id);
    index.claims.get(id)?.inference?.supportingClaimIds.forEach(visit);
    active.delete(id);
    done.add(id);
  }
  corpus.claims.forEach(claim => visit(claim.id));
  for (const category of corpus.categorizations) {
    ref('cases', category.caseId, 'categorizations', category.id);
    caseClaims(category.supportingClaimIds, category.caseId, 'categorizations', category.id);
    refs('sources', category.sourceIds, 'categorizations', category.id);
    const supportedSources = new Set(category.supportingClaimIds.map(id => index.claims.get(id)?.sourceId));
    if (category.sourceIds.some(id => !supportedSources.has(id)) || [...supportedSources].some(id => !category.sourceIds.includes(id))) fail('categorizations', category.id, 'source scope must match supporting claim sources');
    if (category.value !== null) {
      const aliases = corpus.governance.controlledAliases?.[category.dimension];
      const values = categories[category.dimension] ?? (Array.isArray(aliases) ? aliases : []);
      const other = category.value === 'other' || category.value === 'other/unknown';
      if (!values.includes(category.value) && !other) fail('categorizations', category.id, 'value not in controlled dimension');
      if (other && !category.otherText) fail('categorizations', category.id, 'other value requires explicit otherText');
      if (!other && category.otherText !== null) fail('categorizations', category.id, 'known value cannot contain otherText');
    }
  }
  const positives = categories.ai_involvement.slice(0, 4);
  for (const negative of corpus.categorizations.filter(item => item.dimension === 'ai_involvement' && item.value === 'No AI involvement reported' && item.disposition === 'Accepted')) {
    if (corpus.categorizations.some(item => item.dimension === 'ai_involvement' && item.caseId === negative.caseId && item.disposition === 'Accepted' && positives.includes(item.value) && item.sourceIds.some(id => negative.sourceIds.includes(id)))) fail('categorizations', negative.id, 'no-AI and positive roles conflict in reviewed-source scope');
  }
  for (const entry of corpus.timelines) {
    const caseRecord = ref('cases', entry.caseId, 'timelines', entry.id);
    dateErrors(entry.date, `timelines:${entry.id}.date`, errors);
    caseClaims(entry.supportingClaimIds, entry.caseId, 'timelines', entry.id);
    if (!entry.supportingClaimIds.length && !entry.sourceRevisionIds.length) fail('timelines', entry.id, 'timeline requires claim or source revision support');
    for (const id of entry.sourceRevisionIds) {
      const revision = ref('sourceRevisions', id, 'timelines', entry.id);
      if (revision && caseRecord && !caseRecord.sourceIds.includes(revision.sourceId)) fail('timelines', entry.id, 'source revision not linked to case');
    }
    if (['publication', 'source_update'].includes(entry.dateType)) {
      const field = entry.dateType === 'publication' ? 'publicationDate' : 'updateDate';
      const sourceIds = [...entry.sourceRevisionIds.map(id => index.sourceRevisions.get(id)?.sourceId), ...entry.supportingClaimIds.map(id => index.claims.get(id)?.sourceId)];
      if (!sourceIds.some(id => canonicalSerialize(index.sources.get(id)?.[field]) === canonicalSerialize(entry.date))) fail('timelines', entry.id, `metadata date does not match supported ${field}`);
    }
  }
  for (const manifest of corpus.collectionManifests) {
    refs('sources', manifest.inputSourceIds, 'collectionManifests', manifest.id);
    refs('sourceRevisions', manifest.inputRevisionIds, 'collectionManifests', manifest.id);
  }
  validateEnrichment(corpus, index, ref, refs, caseClaims, fail);
  for (const event of corpus.reviews) {
    ref(event.entityType, event.entityId, 'reviews', event.id);
    if (!timestamp(event.timestamp)) fail('reviews', event.id, 'invalid real UTC timestamp');
    if (event.disposition === 'Accepted' && event.reviewerKind !== 'human') fail('reviews', event.id, 'agents cannot accept');
  }
  for (const type of ['cases', 'claims', 'categorizations', 'timelines']) {
    for (const entity of corpus[type]) {
      for (const id of entity.history) {
        const event = ref('reviews', id, type, entity.id);
        if (event && (event.entityType !== type || event.entityId !== entity.id)) fail(type, entity.id, 'review history refers to another entity');
      }
      if (entity.disposition === 'Accepted') {
        try {
          if (!currentReview(corpus, type, entity)) fail(type, entity.id, 'accepted status requires current human review content/dependency/base hashes');
        } catch (error) { fail(type, entity.id, error.message); }
        const supports = type === 'claims' ? entity.inference?.supportingClaimIds ?? [] : entity.supportingClaimIds ?? entity.summaryClaimIds ?? [];
        if (supports.some(id => index.claims.get(id)?.disposition !== 'Accepted')) fail(type, entity.id, 'accepted entity requires accepted supporting claims');
      }
    }
  }
  return errors;
}

function validateEnrichment(corpus, index, ref, refs, caseClaims, fail) {
  const nodeIds = new Set(), edgeIds = new Set();
  for (const path of corpus.paths ?? []) {
    if (path.disposition === 'Accepted') fail('paths', path.id, 'enrichment acceptance requires a future explicit review contract; drafts only in Issue 001');
    ref('cases', path.caseId, 'paths', path.id);
    const localNodes = new Set(path.nodes.map(node => node.id));
    for (const node of path.nodes) {
      if (node.disposition === 'Accepted') fail('nodes', node.id, 'enrichment acceptance requires a future explicit review contract; drafts only in Issue 001');
      if (nodeIds.has(node.id)) fail('nodes', node.id, 'duplicate globally unique node ID');
      nodeIds.add(node.id);
      caseClaims(node.claimIds, path.caseId, 'nodes', node.id);
      refs('behaviors', node.behaviorIds, 'nodes', node.id);
    }
    for (const edge of path.edges) {
      if (edgeIds.has(edge.id)) fail('edges', edge.id, 'duplicate edge ID');
      edgeIds.add(edge.id);
      if (!localNodes.has(edge.from) || !localNodes.has(edge.to)) fail('edges', edge.id, 'endpoints must belong to path');
      caseClaims(edge.claimIds, path.caseId, 'edges', edge.id);
      const endpoints = path.nodes.filter(node => node.id === edge.from || node.id === edge.to).flatMap(node => node.claimIds);
      if (!edge.claimIds.some(id => endpoints.includes(id))) fail('edges', edge.id, 'edge requires endpoint claim support');
    }
  }
  for (const technique of corpus.frameworks ?? []) {
    ref('sources', technique.sourceId, 'frameworks', technique.id);
    try { canonicalUrl(technique.url); } catch { fail('frameworks', technique.id, 'technique URL must be HTTPS'); }
    if (technique.parentId) ref('frameworks', technique.parentId, 'frameworks', technique.id);
  }
  for (const mapping of corpus.mappings ?? []) {
    if (mapping.disposition === 'Accepted') fail('mappings', mapping.id, 'enrichment acceptance requires a future explicit review contract; drafts only in Issue 001');
    ref('cases', mapping.caseId, 'mappings', mapping.id);
    ref('behaviors', mapping.behaviorId, 'mappings', mapping.id);
    caseClaims(mapping.claimIds, mapping.caseId, 'mappings', mapping.id);
    if (mapping.provisional) {
      if (/^AML\./.test(mapping.techniqueId) || mapping.framework !== 'local') fail('mappings', mapping.id, 'provisional candidates must use local namespace, not invented official IDs');
    } else {
      const technique = ref('frameworks', mapping.techniqueId, 'mappings', mapping.id);
      if (technique && (technique.framework !== mapping.framework || technique.version !== mapping.version)) fail('mappings', mapping.id, 'framework/version mismatch');
    }
    if (Boolean(mapping.pathId) !== Boolean(mapping.nodeId)) fail('mappings', mapping.id, 'pathId/nodeId must occur together');
    if (mapping.pathId) {
      const path = ref('paths', mapping.pathId, 'mappings', mapping.id);
      const node = path?.nodes.find(item => item.id === mapping.nodeId);
      if (!node || path.caseId !== mapping.caseId || !node.behaviorIds.includes(mapping.behaviorId) || !mapping.claimIds.some(id => node.claimIds.includes(id))) fail('mappings', mapping.id, 'invalid node/case/behavior/evidence scope');
    }
    if (mapping.mappingStatus === 'Reviewed' && mapping.claimIds.some(id => index.claims.get(id)?.disposition !== 'Accepted')) fail('mappings', mapping.id, 'reviewed mapping requires accepted claim support');
  }
  for (const behavior of corpus.behaviors ?? []) {
    if (behavior.disposition === 'Accepted') fail('behaviors', behavior.id, 'enrichment acceptance requires a future explicit review contract; drafts only in Issue 001');
    refs('telemetry', behavior.signalIds, 'behaviors', behavior.id);
    refs('detections', behavior.detectionIds, 'behaviors', behavior.id);
    refs('otel', behavior.otelIds, 'behaviors', behavior.id);
    for (const [type, ids] of [['telemetry', behavior.signalIds], ['detections', behavior.detectionIds], ['otel', behavior.otelIds]]) {
      if (ids.some(id => index[type].get(id)?.behaviorId !== behavior.id)) fail('behaviors', behavior.id, `${type} belongs to another behavior`);
    }
  }
  for (const type of ['telemetry', 'detections', 'otel']) {
    for (const entity of corpus[type] ?? []) {
      if (entity.disposition === 'Accepted') fail(type, entity.id, 'enrichment acceptance requires a future explicit review contract; drafts only in Issue 001');
      ref('behaviors', entity.behaviorId, type, entity.id);
      if (type === 'detections') {
        refs('telemetry', entity.signalIds, type, entity.id);
        refs('otel', entity.otelIds, type, entity.id);
      }
      if (type === 'otel') refs('sources', entity.standardSourceIds, type, entity.id);
    }
  }
  if (corpus.otelReference?.sourceIds) refs('sources', corpus.otelReference.sourceIds, 'otelReference', 'otel-reference');
}

export function assertValid(corpus) {
  const errors = validateCorpus(corpus);
  if (errors.length) throw new Error(errors.join('\n'));
  return corpus;
}

export function assertAppendOnlyReviews(previous, next) {
  const byId = new Map(next.map(event => [event.id, event]));
  if (byId.size !== next.length) throw new Error('duplicate review event ID');
  for (const event of previous) {
    if (!byId.has(event.id) || canonicalSerialize(byId.get(event.id)) !== canonicalSerialize(event)) throw new Error(`review ${event.id} was deleted or modified`);
  }
  // Physical collection order is canonical by ID; entity.history preserves decision order.
}
