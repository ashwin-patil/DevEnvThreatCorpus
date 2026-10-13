import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { Readable } from 'node:stream';
import { ARTICLE_PARSER_VERSION, parseArticle, PUBLISHERS } from '../src/article.mjs';
export { PUBLISHERS };

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
      event.reviewerKind !== 'human' || !event.reviewer.trim() || !event.rationale.trim() || !timestamp(event.timestamp) ||
      event.contentHash !== entityContentHash(entity) || event.baseDigest !== reviewBaseDigest(corpus)) return false;
  return canonicalSerialize(event.dependencyHashes) === canonicalSerialize(dependencyHashes(corpus, entityType, entity.id));
}

export function reviewEligibleCorpus(corpus) {
  const errors = validateShape(corpus);
  if (errors.length) throw new Error(errors.join('\n'));
  const copy = structuredClone(corpus);
  let changed;
  do {
    changed = false;
    for (const type of ['claims', 'cases', 'categorizations', 'timelines']) {
      for (const entity of copy[type]) {
        if (entity.disposition !== 'Accepted') continue;
        const supports = type === 'claims' ? entity.inference?.supportingClaimIds ?? []
          : entity.supportingClaimIds ?? entity.summaryClaimIds ?? [];
        if (!currentReview(copy, type, entity)
          || supports.some(id => copy.claims.find(claim => claim.id === id)?.disposition !== 'Accepted')) {
          entity.disposition = 'Pending';
          changed = true;
        }
      }
    }
  } while (changed);
  return copy;
}

const profileEntityTypes = [
  'cases', 'sources', 'sourceRevisions', 'passages', 'claims', 'categorizations', 'timelines',
  'paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel',
];
const optionalEntityTypes = ['paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel'];
const reviewableEntityTypes = ['cases', 'claims', 'categorizations', 'timelines'];

function currentAccepted(corpus, type, entity) {
  return entity.disposition === 'Accepted' && currentReview(corpus, type, entity);
}

export function profileRecords(input, profile = 'reviewed') {
  if (!['reviewed', 'draft'].includes(profile)) throw new Error('profile must be reviewed or draft');
  if (input?.schemaVersion !== CONTRACT_VERSION) throw new Error(`unsupported schema version ${JSON.stringify(input?.schemaVersion)}; expected ${CONTRACT_VERSION}`);

  const corpus = reviewEligibleCorpus(input);
  assertValid(corpus);
  const stale = new Set();
  for (const type of reviewableEntityTypes) {
    for (const entity of input[type] ?? []) {
      const current = corpus[type].find(item => item.id === entity.id);
      if (entity.disposition === 'Accepted' && current?.disposition !== 'Accepted') stale.add(`${type}:${entity.id}`);
    }
  }

  let selectedClaims = new Set(corpus.claims.filter(claim => profile === 'draft' || currentAccepted(corpus, 'claims', claim)).map(claim => claim.id));
  if (profile === 'reviewed') {
    let changed;
    do {
      changed = false;
      for (const claim of corpus.claims) {
        if (!selectedClaims.has(claim.id)) continue;
        const dependencies = [...(claim.inference?.supportingClaimIds ?? []), ...claim.conflictsWith];
        if (dependencies.some(id => !selectedClaims.has(id))) {
          selectedClaims.delete(claim.id);
          changed = true;
        }
      }
    } while (changed);
  }

  const selectedCases = new Set(corpus.cases.filter(item => profile === 'draft'
    || corpus.claims.some(claim => selectedClaims.has(claim.id) && claim.caseId === item.id)).map(item => item.id));
  const selectedCategories = new Set(corpus.categorizations
    .filter(item => selectedCases.has(item.caseId) && (profile === 'draft' || currentAccepted(corpus, 'categorizations', item)
      && item.supportingClaimIds.every(id => selectedClaims.has(id))))
    .map(item => item.id));
  const selectedTimelines = new Set(corpus.timelines
    .filter(item => selectedCases.has(item.caseId) && (profile === 'draft' || currentAccepted(corpus, 'timelines', item)
      && item.supportingClaimIds.every(id => selectedClaims.has(id))))
    .map(item => item.id));
  const selectedSourceIds = new Set([
    ...corpus.claims.filter(item => selectedClaims.has(item.id)).map(item => item.sourceId),
    ...corpus.cases.filter(item => selectedCases.has(item.id)).flatMap(item => item.sourceIds),
    ...corpus.categorizations.filter(item => selectedCategories.has(item.id)).flatMap(item => item.sourceIds),
  ]);
  const selectedRevisionIds = new Set([
    ...corpus.claims.filter(item => selectedClaims.has(item.id)).map(item => item.sourceRevisionId),
    ...corpus.timelines.filter(item => selectedTimelines.has(item.id)).flatMap(item => item.sourceRevisionIds),
  ]);
  const selectedPassageIds = new Set(corpus.claims.filter(item => selectedClaims.has(item.id)).flatMap(item => item.passageIds));
  const selectedPaths = new Set((corpus.paths ?? [])
    .filter(item => selectedCases.has(item.caseId) && (profile === 'draft'
      || [...item.nodes.flatMap(node => node.claimIds), ...item.edges.flatMap(edge => edge.claimIds)].every(id => selectedClaims.has(id))))
    .map(item => item.id));
  const selectedMappings = new Set((corpus.mappings ?? [])
    .filter(item => selectedCases.has(item.caseId) && (profile === 'draft' || item.mappingStatus !== 'Rejected'
      && item.claimIds.every(id => selectedClaims.has(id))
      && (!item.pathId || selectedPaths.has(item.pathId))))
    .map(item => item.id));
  const selectedBehaviorIds = new Set([
    ...(corpus.paths ?? []).filter(item => selectedPaths.has(item.id)).flatMap(item => item.nodes.flatMap(node => node.behaviorIds)),
    ...(corpus.mappings ?? []).filter(item => selectedMappings.has(item.id)).map(item => item.behaviorId),
  ]);
  const selectedBehaviors = new Set((corpus.behaviors ?? [])
    .filter(item => profile === 'draft' || item.disposition !== 'Excluded' && selectedBehaviorIds.has(item.id))
    .map(item => item.id));
  const selectedPathIds = new Set((corpus.paths ?? [])
    .filter(item => selectedPaths.has(item.id) && item.nodes.every(node => node.behaviorIds.every(id => selectedBehaviors.has(id))))
    .map(item => item.id));
  const selectedMappingIds = new Set((corpus.mappings ?? [])
    .filter(item => selectedMappings.has(item.id) && selectedBehaviors.has(item.behaviorId)
      && (!item.pathId || selectedPathIds.has(item.pathId)))
    .map(item => item.id));
  const selectedDetectionIds = new Set((corpus.detections ?? [])
    .filter(item => profile === 'draft' || item.disposition !== 'Excluded' && selectedBehaviors.has(item.behaviorId))
    .map(item => item.id));
  const selectedOtelIds = new Set((corpus.otel ?? [])
    .filter(item => profile === 'draft' || item.disposition !== 'Excluded' && selectedBehaviors.has(item.behaviorId))
    .map(item => item.id));
  const selectedTelemetryIds = new Set((corpus.telemetry ?? [])
    .filter(item => profile === 'draft' || item.disposition !== 'Excluded' && selectedBehaviors.has(item.behaviorId))
    .map(item => item.id));
  const selectedFrameworkIds = new Set(profile === 'draft' ? (corpus.frameworks ?? []).map(item => item.id)
    : (corpus.mappings ?? []).filter(item => selectedMappingIds.has(item.id)).map(item => item.techniqueId));
  let parentFramework;
  do {
    parentFramework = false;
    for (const technique of corpus.frameworks ?? []) {
      if (selectedFrameworkIds.has(technique.id) && technique.parentId && !selectedFrameworkIds.has(technique.parentId)) {
        selectedFrameworkIds.add(technique.parentId);
        parentFramework = true;
      }
    }
  } while (parentFramework);
  for (const technique of corpus.frameworks ?? []) {
    if (profile === 'draft' || selectedFrameworkIds.has(technique.id)) selectedSourceIds.add(technique.sourceId);
  }
  for (const action of corpus.otel ?? []) {
    if (profile === 'draft' || selectedOtelIds.has(action.id)) action.standardSourceIds.forEach(id => selectedSourceIds.add(id));
  }
  for (const revision of corpus.sourceRevisions) {
    if (selectedRevisionIds.has(revision.id)) selectedSourceIds.add(revision.sourceId);
  }

  const idsByType = {
    cases: selectedCases,
    sources: selectedSourceIds,
    sourceRevisions: selectedRevisionIds,
    passages: selectedPassageIds,
    claims: selectedClaims,
    categorizations: selectedCategories,
    timelines: selectedTimelines,
    paths: selectedPathIds,
    behaviors: selectedBehaviors,
    frameworks: selectedFrameworkIds,
    mappings: selectedMappingIds,
    telemetry: selectedTelemetryIds,
    detections: selectedDetectionIds,
    otel: selectedOtelIds,
  };
  const records = [];
  for (const type of profileEntityTypes) {
    for (const original of (corpus[type] ?? []).filter(item => idsByType[type].has(item.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      const entity = structuredClone(original);
      if (type === 'sourceRevisions') {
        entity.rawContent = null;
        entity.normalizedContent = null;
        entity.nullReasons = { ...entity.nullReasons, rawContent: 'not_applicable', normalizedContent: 'not_applicable' };
      }
      if (type === 'sources') entity.revisionIds = entity.revisionIds.filter(id => selectedRevisionIds.has(id));
      if (type === 'cases') {
        entity.sourceIds = entity.sourceIds.filter(id => selectedSourceIds.has(id));
        entity.summaryClaimIds = entity.summaryClaimIds.filter(id => selectedClaims.has(id));
        if (entity.pathIds) entity.pathIds = entity.pathIds.filter(id => selectedPathIds.has(id));
      }
      if (type === 'claims') {
        entity.conflictsWith = entity.conflictsWith.filter(id => selectedClaims.has(id));
        if (entity.inference) entity.inference.supportingClaimIds = entity.inference.supportingClaimIds.filter(id => selectedClaims.has(id));
      }
      if (type === 'categorizations') {
        entity.sourceIds = entity.sourceIds.filter(id => selectedSourceIds.has(id));
        entity.supportingClaimIds = entity.supportingClaimIds.filter(id => selectedClaims.has(id));
      }
      if (type === 'timelines') {
        entity.sourceRevisionIds = entity.sourceRevisionIds.filter(id => selectedRevisionIds.has(id));
        entity.supportingClaimIds = entity.supportingClaimIds.filter(id => selectedClaims.has(id));
      }
      if (type === 'paths') {
        for (const node of entity.nodes) {
          node.claimIds = node.claimIds.filter(id => selectedClaims.has(id));
          node.behaviorIds = node.behaviorIds.filter(id => selectedBehaviors.has(id));
        }
        for (const edge of entity.edges) edge.claimIds = edge.claimIds.filter(id => selectedClaims.has(id));
      }
      if (type === 'behaviors') {
        entity.signalIds = entity.signalIds.filter(id => selectedTelemetryIds.has(id));
        entity.detectionIds = entity.detectionIds.filter(id => selectedDetectionIds.has(id));
        entity.otelIds = entity.otelIds.filter(id => selectedOtelIds.has(id));
      }
      if (type === 'frameworks' && entity.parentId && !selectedFrameworkIds.has(entity.parentId)) entity.parentId = null;
      if (type === 'mappings') {
        entity.claimIds = entity.claimIds.filter(id => selectedClaims.has(id));
        if (entity.pathId && !selectedPathIds.has(entity.pathId)) delete entity.pathId;
      }
      if (type === 'detections') {
        entity.signalIds = entity.signalIds.filter(id => selectedTelemetryIds.has(id));
        entity.otelIds = entity.otelIds.filter(id => selectedOtelIds.has(id));
      }
      if (type === 'otel') entity.standardSourceIds = entity.standardSourceIds.filter(id => selectedSourceIds.has(id));
      const accepted = reviewableEntityTypes.includes(type) && currentAccepted(corpus, type, original);
      const projected = reviewableEntityTypes.includes(type) && entityContentHash(entity) !== entityContentHash(original);
      if (projected) entity.disposition = 'Pending';
      if (reviewableEntityTypes.includes(type)) entity.history = [];
      const warnings = [];
      if (profile === 'draft') warnings.push('Draft profile; records are not represented as an eligible reviewed release.');
      if (optionalEntityTypes.includes(type)) warnings.push('Optional enrichment; this record is outside the current claim acceptance workflow.');
      if (projected) warnings.push('Export projection changed entity references; canonical acceptance does not apply to this view.');
      records.push({
        schemaVersion: CONTRACT_VERSION,
        entityType: type,
        entity,
        reviewStatus: reviewableEntityTypes.includes(type) ? {
          recordedDisposition: input[type].find(item => item.id === original.id).disposition,
          effectiveDisposition: projected ? 'Pending' : original.disposition,
          currentAcceptance: accepted && !projected,
          stale: stale.has(`${type}:${original.id}`),
          projected,
        } : null,
        warnings,
      });
    }
  }

  const counts = Object.fromEntries(['cases', 'sources', 'claims'].map(type => [type, records.filter(record => record.entityType === type).length]));
  const optionalEnrichment = Object.fromEntries(optionalEntityTypes.map(type => [type, records.filter(record => record.entityType === type).length]));
  const reviewCoverage = Object.fromEntries(reviewableEntityTypes.map(type => {
    const all = corpus[type];
    return [type, {
      unit: type === 'claims' ? 'claim' : type === 'cases' ? 'case' : type === 'timelines' ? 'timeline' : 'categorization',
      currentAccepted: all.filter(item => currentAccepted(corpus, type, item)).length,
      included: idsByType[type].size,
      pending: all.filter(item => item.disposition === 'Pending').length,
      excluded: all.filter(item => item.disposition === 'Excluded').length,
      staleAcceptance: all.filter(item => stale.has(`${type}:${item.id}`)).length,
    }];
  }));
  const snapshot = records.map(({ schemaVersion, entityType, entity, reviewStatus, warnings }) => ({ schemaVersion, entityType, entity, reviewStatus, warnings }));
  const snapshotDigest = digest(snapshot);
  return {
    schemaVersion: CONTRACT_VERSION,
    profile,
    snapshotDigest,
    records,
    coverage: {
      units: counts,
      profile,
      filters: {},
      reviewCoverage,
      optionalEnrichment,
      snapshotDigest,
    },
  };
}

const csvColumns = {
  cases: ['profile', 'warnings', 'id', 'name', 'kind', 'summary', 'aliases', 'summaryClaimIds', 'sourceIds', 'disposition', 'origin', 'revision', 'limits', 'nullReasons'],
  sources: ['profile', 'warnings', 'id', 'originalUrl', 'canonicalUrl', 'title', 'publisher', 'author', 'publicationDate', 'updateDate', 'retrievalDate', 'inputKind', 'provenance', 'revisionIds', 'extractionStatus', 'collectionState', 'nullReasons'],
  timelines: ['profile', 'warnings', 'id', 'caseId', 'description', 'date', 'dateType', 'supportingClaimIds', 'sourceRevisionIds', 'basis', 'uncertainty', 'origin', 'disposition', 'revision', 'nullReasons'],
};

function csvValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function spreadsheetSafe(value) {
  if (value.startsWith("'")) return `'${value}`;
  return /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvCell(value) {
  const safe = spreadsheetSafe(csvValue(value));
  return `"${safe.replaceAll('"', '""')}"`;
}

function csvFile(type, records, profile) {
  const columns = csvColumns[type];
  const rows = [columns, ...records.filter(record => record.entityType === type).map(record => columns.map(column => ({
    profile,
    warnings: record.warnings,
  }[column] ?? record.entity[column])))];
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function profileSchema() {
  const reviewStatusSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['recordedDisposition', 'effectiveDisposition', 'currentAcceptance', 'stale', 'projected'],
    properties: {
      recordedDisposition: { enum: schema.$defs.disposition.enum },
      effectiveDisposition: { enum: schema.$defs.disposition.enum },
      currentAcceptance: { type: 'boolean' },
      stale: { type: 'boolean' },
      projected: { type: 'boolean' },
    },
  };
  return {
    $schema: schema.$schema,
    title: 'DevEnvThreatCorpus profile JSONL record',
    description: 'One allowlisted typed entity from a reviewed or draft profile export.',
    oneOf: profileEntityTypes.map(type => ({
      type: 'object',
      additionalProperties: false,
      required: ['schemaVersion', 'entityType', 'entity', 'reviewStatus', 'warnings'],
      properties: {
        schemaVersion: { const: CONTRACT_VERSION },
        entityType: { const: type },
        entity: schema.properties[type].items,
        reviewStatus: reviewableEntityTypes.includes(type) ? reviewStatusSchema : { type: 'null' },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    })),
    $defs: schema.$defs,
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === ',') { row.push(decodeSpreadsheet(cell)); cell = ''; }
    else if (char === '\r' && text[index + 1] === '\n') {
      row.push(decodeSpreadsheet(cell));
      rows.push(row);
      row = [];
      cell = '';
      index++;
    } else if (char === '\n') {
      row.push(decodeSpreadsheet(cell));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('invalid CSV: unterminated quoted field');
  if (cell || row.length) { row.push(decodeSpreadsheet(cell)); rows.push(row); }
  return rows;
}

function decodeSpreadsheet(value) {
  if (value.startsWith("''")) return value.slice(1);
  return /^'\s*[=+\-@]/u.test(value) ? value.slice(1) : value;
}

export function profileFiles(profile) {
  const files = {
    'schema.json': canonicalSerialize(profileSchema()),
    'records.jsonl': profile.records.map(record => JSON.stringify(record)).join('\n') + (profile.records.length ? '\n' : ''),
    'cases.csv': csvFile('cases', profile.records, profile.profile),
    'sources.csv': csvFile('sources', profile.records, profile.profile),
    'timelines.csv': csvFile('timelines', profile.records, profile.profile),
  };
  const fileHashes = Object.fromEntries(Object.keys(files).sort().map(name => [name, sha256(files[name])]));
  const manifest = {
    schemaVersion: CONTRACT_VERSION,
    profile: profile.profile,
    snapshotDigest: profile.snapshotDigest,
    files: fileHashes,
    coverage: profile.coverage,
  };
  files['manifest.json'] = canonicalSerialize(manifest);
  return files;
}

export function queryProfile(profile, operation, options = {}) {
  const allowedEntities = new Set(['cases', 'sources', 'claims']);
  if (!['list', 'get', 'bundle'].includes(operation)) throw new Error('operation must be list, get, or bundle');
  const entries = profile.records;
  if (operation === 'bundle') {
    const caseRecord = entries.find(item => item.entityType === 'cases' && item.entity.id === options.caseId);
    if (!caseRecord) throw new Error(`unknown case ID ${JSON.stringify(options.caseId)}`);
    const caseIds = new Set([options.caseId]);
    const claimIds = new Set(entries.filter(item => item.entityType === 'claims' && item.entity.caseId === options.caseId).map(item => item.entity.id));
    let changed;
    do {
      changed = false;
      for (const record of entries.filter(item => item.entityType === 'claims' && claimIds.has(item.entity.id))) {
        const linked = [...record.entity.conflictsWith, ...(record.entity.inference?.supportingClaimIds ?? [])];
        for (const id of linked) {
          const linkedClaim = entries.find(item => item.entityType === 'claims' && item.entity.id === id);
          if (linkedClaim && !claimIds.has(id)) { claimIds.add(id); caseIds.add(linkedClaim.entity.caseId); changed = true; }
        }
      }
    } while (changed);
    const claims = entries.filter(item => item.entityType === 'claims' && claimIds.has(item.entity.id));
    const cases = entries.filter(item => item.entityType === 'cases' && caseIds.has(item.entity.id));
    const paths = entries.filter(item => item.entityType === 'paths' && caseIds.has(item.entity.caseId));
    const mappings = entries.filter(item => item.entityType === 'mappings'
      && (caseIds.has(item.entity.caseId) || item.entity.claimIds.some(id => claimIds.has(id))));
    const behaviorIds = new Set([
      ...paths.flatMap(item => item.entity.nodes.flatMap(node => node.behaviorIds)),
      ...mappings.map(item => item.entity.behaviorId),
    ]);
    const techniqueIds = new Set(mappings.map(item => item.entity.techniqueId));
    const techniques = entries.filter(item => item.entityType === 'frameworks' && techniqueIds.has(item.entity.id));
    const caseSources = cases.flatMap(item => item.entity.sourceIds);
    const sources = new Set([
      ...caseSources,
      ...claims.map(item => item.entity.sourceId),
      ...techniques.map(item => item.entity.sourceId),
      ...entries.filter(item => item.entityType === 'otel' && behaviorIds.has(item.entity.behaviorId)).flatMap(item => item.entity.standardSourceIds),
    ]);
    const revisions = new Set([
      ...claims.map(item => item.entity.sourceRevisionId),
      ...entries.filter(item => item.entityType === 'timelines' && caseIds.has(item.entity.caseId)).flatMap(item => item.entity.sourceRevisionIds),
    ]);
    const passages = new Set(claims.flatMap(item => item.entity.passageIds));
    const bundleRecords = entries.filter(item => item.entityType === 'cases' && caseIds.has(item.entity.id)
      || item.entityType === 'claims' && claimIds.has(item.entity.id)
      || item.entityType === 'sources' && sources.has(item.entity.id)
      || item.entityType === 'sourceRevisions' && revisions.has(item.entity.id)
      || item.entityType === 'passages' && passages.has(item.entity.id)
      || ['categorizations', 'timelines', 'paths'].includes(item.entityType) && caseIds.has(item.entity.caseId)
      || item.entityType === 'mappings' && (caseIds.has(item.entity.caseId) || item.entity.claimIds.some(id => claimIds.has(id)))
      || item.entityType === 'behaviors' && behaviorIds.has(item.entity.id)
      || item.entityType === 'frameworks' && techniqueIds.has(item.entity.id)
      || ['telemetry', 'detections', 'otel'].includes(item.entityType) && behaviorIds.has(item.entity.behaviorId));
    return {
      status: 'succeeded', operation, profile: profile.profile, digest: profile.snapshotDigest,
      unit: 'case bundle', caseId: options.caseId, coverage: profile.coverage, records: bundleRecords,
    };
  }
  if (!allowedEntities.has(options.entity)) throw new Error('entity must be cases, sources, or claims');
  if (operation === 'get') {
    const record = entries.find(item => item.entityType === options.entity && item.entity.id === options.id);
    if (!record) throw new Error(`unknown ${options.entity} ID ${JSON.stringify(options.id)}`);
    return { status: 'succeeded', operation, profile: profile.profile, digest: profile.snapshotDigest, unit: options.entity.slice(0, -1), coverage: profile.coverage, record };
  }
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('limit must be an integer from 1 through 1000');
  const caseRecord = options.caseId && entries.find(item => item.entityType === 'cases' && item.entity.id === options.caseId);
  const caseSourceIds = new Set(caseRecord?.entity.sourceIds ?? []);
  const records = entries.filter(item => item.entityType === options.entity && (!options.caseId
    || item.entityType === 'cases' && item.entity.id === options.caseId
    || item.entity.caseId === options.caseId
    || item.entityType === 'sources' && caseSourceIds.has(item.entity.id))).slice(0, limit);
  return {
    status: 'succeeded', operation, profile: profile.profile, digest: profile.snapshotDigest,
    unit: options.entity.slice(0, -1), filters: { ...(options.caseId ? { caseId: options.caseId } : {}) },
    coverage: profile.coverage, records,
  };
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
    if (revision.rawContent !== null && revision.normalizedContent !== null) {
      try {
        const normalized = revision.parserVersion === HTML_PARSER_VERSION
          ? normalizeText(readableHtml(revision.rawContent)) : revision.parserVersion === 'readable-html/3'
            ? normalizeText(parseArticle(revision.rawContent, undefined, { replaceNulls: false }).text) : revision.parserVersion === 'readable-html/2'
            ? normalizeText(parseArticle(revision.rawContent, undefined, { legacyRoots: true, replaceNulls: false }).text) : revision.parserVersion === 'readable-html/1'
            ? normalizeText(legacyReadableHtml(revision.rawContent)) : normalizeText(revision.rawContent);
        if (normalized !== revision.normalizedContent) fail('sourceRevisions', revision.id, 'raw/normalized content transformation mismatch');
      } catch { fail('sourceRevisions', revision.id, 'raw/normalized content transformation mismatch'); }
    }
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

  // Manual intake deliberately shares the corpus contract rather than a second record store.
  export const INTAKE_VERSION = 'manual-intake/1';
  export const HTML_PARSER_VERSION = ARTICLE_PARSER_VERSION;
  export const TEXT_PARSER_VERSION = 'utf8-text/1';
  export const INTAKE_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, deadlineMs: 20_000, retries: 2, redirects: 3 });
  const repoRoot = fileURLToPath(new URL('../', import.meta.url));
  const safeCodes = new Set([
    'INVALID_INPUT', 'UNSAFE_URL', 'UNSAFE_ADDRESS', 'PEER_MISMATCH', 'NETWORK', 'TIMEOUT', 'TOO_LARGE',
    'ACCESS_DENIED', 'HTTP_STATUS', 'ROBOTS_DENIED', 'ROBOTS_UNSUPPORTED', 'REDIRECT_LIMIT',
    'UNSUPPORTED_TYPE', 'UNSUPPORTED_ENCODING', 'MALFORMED_TEXT', 'MALFORMED_HTML', 'EMPTY_CONTENT',
    'UNSAFE_PATH', 'STORE_BUSY', 'INVALID_CORPUS', 'IDENTITY_COLLISION', 'INVALID_EXTRACTION', 'PERSISTENCE',
    'INVALID_REVIEW', 'UNKNOWN_CLAIM', 'STALE_BASE', 'UNSUPPORTED_SCHEMA_VERSION', 'INVALID_PROFILE',
    'OUTPUT_EXISTS', 'NOT_FOUND',
  ]);
  class IntakeError extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const rejectIntake = code => { throw new IntakeError(code); };
  const safeCode = error => {
    if (safeCodes.has(error?.code)) return error.code;
    const message = String(error?.message ?? '');
    if (message.startsWith('unsupported schema version')) return 'UNSUPPORTED_SCHEMA_VERSION';
    if (message.startsWith('profile must')) return 'INVALID_PROFILE';
    if (message.startsWith('unknown ')) return 'NOT_FOUND';
    if (message.includes('already exists')) return 'OUTPUT_EXISTS';
    if (message.startsWith('operation must') || message.startsWith('entity must') || message.startsWith('limit must')) return 'INVALID_INPUT';
    return 'PERSISTENCE';
  };

  export function intakeUrl(input) {
    try {
      if (typeof input !== 'string' || input.length > 8192 || /[\u0000-\u0020\\]/u.test(input)) rejectIntake('UNSAFE_URL');
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) rejectIntake('UNSAFE_URL');
      for (const [key, value] of url.searchParams) {
        if (/(?:token|secret|passw|credential|session|signature|auth|api.?key|^key$|^sig$|^code$)/i.test(key)
          || /(?:bearer\s|-----BEGIN|https?:\/\/[^/]*@)/i.test(value)) rejectIntake('UNSAFE_URL');
      }
      return canonicalUrl(input);
    } catch { rejectIntake('UNSAFE_URL'); }
  }

  function ipv6Number(address) {
    const halves = address.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
    return words.reduce((n, word) => (n << 16n) + BigInt(`0x${word}`), 0n);
  }

  export function isPublicAddress(address) {
    if (typeof address !== 'string' || address.includes('%')) return false;
    const family = isIP(address);
    if (family === 4) {
      const n = address.split('.').reduce((v, octet) => v * 256 + Number(octet), 0);
      const excluded = [
        [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8], [0xa9fe0000, 16],
        [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24], [0xc0586300, 24], [0xc0a80000, 16],
        [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24], [0xe0000000, 3],
      ];
      return !excluded.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)));
    }
    if (family !== 6 || address.includes('.')) return false;
    const n = ipv6Number(address);
    const inRange = (base, bits) => (n >> BigInt(128 - bits)) === (ipv6Number(base) >> BigInt(128 - bits));
    return inRange('2000::', 3) && ![
      ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3ffe::', 16], ['3fff::', 20],
    ].some(([base, bits]) => inRange(base, bits));
  }

  function strictText(bytes, ascii = false, allowHtmlNulls = false) {
    try {
      if (ascii && bytes.some(byte => byte > 127)) rejectIntake('UNSUPPORTED_ENCODING');
      // BOM handling is explicit: retain it in rawContent so rawHash covers every input byte.
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if ((!allowHtmlNulls && text.includes('\0')) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) rejectIntake('MALFORMED_TEXT');
      return text;
    } catch (error) {
      if (error instanceof IntakeError) throw error;
      rejectIntake('MALFORMED_TEXT');
    }
  }

  const htmlTags = new Set('html head body title meta link div p br hr h1 h2 h3 h4 h5 h6 ul ol li pre blockquote section article main header footer nav span a strong em b i u s code small sup sub table thead tbody tfoot tr td th dl dt dd script style template'.split(' '));
  const voidTags = new Set(['br', 'hr', 'meta', 'link']);
  const blockTags = new Set('html head body title div p br hr h1 h2 h3 h4 h5 h6 ul ol li pre blockquote section article main header footer nav table thead tbody tfoot tr td th dl dt dd'.split(' '));
  const hiddenTags = new Set(['head', 'script', 'style', 'template']);
  const entities = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®' });
  function htmlEntities(text) {
    return text.replace(/&([^;\s<]*);|&/g, (match, name) => {
      if (!name) rejectIntake('MALFORMED_HTML');
      if (Object.hasOwn(entities, name)) return entities[name];
      if (!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(name)) rejectIntake('MALFORMED_HTML');
      const n = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      if (!Number.isSafeInteger(n) || n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) || (n < 32 && ![9, 10, 13].includes(n))) rejectIntake('MALFORMED_HTML');
      return String.fromCodePoint(n);
    });
  }

  function legacyReadableHtml(raw) {
    const stack = [], output = [];
    let pos = 0, hiddenDepth = 0;
    const hidden = () => hiddenDepth > 0;
    while (pos < raw.length) {
      if (['script', 'style'].includes(stack.at(-1))) {
        const closing = new RegExp(`</${stack.at(-1)}\\s*>`, 'ig');
        closing.lastIndex = pos;
        const match = closing.exec(raw);
        if (!match) rejectIntake('MALFORMED_HTML');
        pos = match.index;
      }
      if (raw.startsWith('<!--', pos)) {
        const end = raw.indexOf('-->', pos + 4);
        if (end < 0 || raw.slice(pos + 4, end).includes('--')) rejectIntake('MALFORMED_HTML');
        pos = end + 3;
        continue;
      }
      if (raw[pos] !== '<') {
        const end = raw.indexOf('<', pos);
        const segment = raw.slice(pos, end < 0 ? raw.length : end);
        if (!hidden()) output.push(htmlEntities(segment));
        pos += segment.length;
        continue;
      }
      const token = /^(?:<!doctype html\s*>|<\/?[a-z][a-z0-9]*(?:\s+[a-z_:][a-z0-9_.:-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'`=<>]+))?)*\s*\/?>)/i.exec(raw.slice(pos))?.[0];
      if (!token) rejectIntake('MALFORMED_HTML');
      if (token.includes('&')) htmlEntities(token);
      pos += token.length;
      if (/^<!/i.test(token)) { if (stack.length) rejectIntake('MALFORMED_HTML'); continue; }
      const name = /^<\/?([a-z0-9]+)/i.exec(token)[1].toLowerCase();
      if (!htmlTags.has(name)) rejectIntake('MALFORMED_HTML');
      const closing = token.startsWith('</');
      if (closing) {
        if (!new RegExp(`^</${name}\\s*>$`, 'i').test(token) || voidTags.has(name) || stack.pop() !== name) rejectIntake('MALFORMED_HTML');
        if (hiddenTags.has(name)) hiddenDepth--;
      } else if (!voidTags.has(name)) {
        if (token.endsWith('/>')) rejectIntake('MALFORMED_HTML');
        if (stack.length >= 128) rejectIntake('MALFORMED_HTML');
        stack.push(name);
        if (hiddenTags.has(name)) hiddenDepth++;
      }
      if (!hidden() && blockTags.has(name)) output.push('\n');
    }
    if (stack.length) rejectIntake('MALFORMED_HTML');
    return output.join('').replace(/[ \t\r\f]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n+/g, '\n').trim();
  }

  export function readableHtml(raw) {
    return parseArticle(raw).text;
  }

  function mediaType(headers, htmlAllowed = true) {
    const value = headers['content-type'];
    const match = typeof value === 'string' && /^(text\/plain|text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.exec(value);
    if (!match || (!htmlAllowed && match[1].toLowerCase() !== 'text/plain')) rejectIntake('UNSUPPORTED_TYPE');
    const charset = /;\s*charset\s*=\s*"?([\w-]+)"?/i.exec(value)?.[1]?.toLowerCase();
    return { html: match[1].toLowerCase() !== 'text/plain', charset };
  }

  function decodeResponse(bytes, type) {
    let charset = type.charset;
    if (!charset && type.html) {
      const prefix = bytes.subarray(0, 1024).toString('latin1');
      charset = /<meta\b[^>]*charset\s*=\s*["']?\s*([\w-]+)/i.exec(prefix)?.[1]?.toLowerCase();
    }
    charset ??= 'utf-8';
    if (['utf-8', 'utf8'].includes(charset)) return { raw: strictText(bytes, false, type.html), charset: 'utf-8' };
    if (['us-ascii', 'ascii'].includes(charset)) return { raw: strictText(bytes, true, type.html), charset: 'us-ascii' };
    if (!['windows-1252', 'iso-8859-1', 'latin1'].includes(charset)) rejectIntake('UNSUPPORTED_ENCODING');
    const raw = new TextDecoder('windows-1252', { fatal: true }).decode(bytes);
    if (!type.html && raw.includes('\0')) rejectIntake('MALFORMED_TEXT');
    return { raw, charset: 'windows-1252' };
  }

  function budget(deps) {
    const now = deps.now ?? Date.now;
    const started = now(), limit = Math.min(deps.deadlineMs ?? INTAKE_LIMITS.deadlineMs, INTAKE_LIMITS.deadlineMs);
    if (!Number.isFinite(limit) || limit <= 0) rejectIntake('INVALID_INPUT');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limit);
    const remaining = () => {
      if (controller.signal.aborted || now() - started >= limit) rejectIntake('TIMEOUT');
    };
    const run = async fn => {
      remaining();
      let abort;
      try {
        const result = await Promise.race([
          Promise.resolve().then(fn),
          new Promise((_, reject) => {
            abort = () => reject(new IntakeError('TIMEOUT'));
            controller.signal.addEventListener('abort', abort, { once: true });
          }),
        ]);
        remaining();
        return result;
      } finally { if (abort) controller.signal.removeEventListener('abort', abort); }
    };
    return { run, remaining, signal: controller.signal, close: () => { clearTimeout(timer); controller.abort(); } };
  }

  async function secureRequest({ url, address, family, signal }) {
    return new Promise((resolve, reject) => {
      const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
      const request = https.get(url, {
        agent: false, signal, headers: { 'User-Agent': 'DevEnvThreatCorpusIntake/1', Accept: 'text/plain, text/html, image/*', 'Accept-Encoding': 'gzip, deflate, br' },
        lookup: (_host, options, callback) => options.all
          ? callback(null, [{ address, family }]) : callback(null, address, family),
        servername: isIP(hostname) ? undefined : hostname,
        rejectUnauthorized: true,
      }, response => {
        const peerAddress = response.socket.remoteAddress;
        if (!isPublicAddress(peerAddress) || ipIdentity(peerAddress) !== ipIdentity(address)) {
          response.destroy();
          reject(new IntakeError('PEER_MISMATCH'));
          return;
        }
        resolve({ status: response.statusCode, headers: response.headers, peerAddress, body: response, close: () => response.destroy() });
      });
      request.once('error', () => reject(new IntakeError(signal.aborted ? 'TIMEOUT' : 'NETWORK')));
    });
  }

  const ipIdentity = address => isIP(address) === 6 ? ipv6Number(address).toString() : address;
  async function checkedRequest(url, deps, time) {
    const safe = intakeUrl(url), host = new URL(safe).hostname.replace(/^\[|\]$/g, '');
    let addresses;
    try {
      addresses = isIP(host) ? [{ address: host, family: isIP(host) }]
        : await time.run(() => (deps.resolve ?? (name => lookup(name, { all: true, verbatim: true })))(host, { signal: time.signal }));
    } catch (error) { throw error instanceof IntakeError ? error : new IntakeError('NETWORK'); }
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(item => !isPublicAddress(item.address) || item.family !== isIP(item.address))) rejectIntake('UNSAFE_ADDRESS');
    const pinned = addresses[0];
    let response;
    try {
      response = await time.run(() => (deps.request ?? secureRequest)({ url: safe, ...pinned, signal: time.signal }));
    } catch (error) { throw error instanceof IntakeError ? error : new IntakeError('NETWORK'); }
    if (!response || !isPublicAddress(response.peerAddress) || ipIdentity(response.peerAddress) !== ipIdentity(pinned.address)) {
      response?.close?.();
      rejectIntake('PEER_MISMATCH');
    }
    return response;
  }

  async function responseBytes(response, time, limit = INTAKE_LIMITS.bytes, onBytes = () => {}) {
    if (response.headers['content-length'] !== undefined) {
      const length = String(response.headers['content-length']);
      if (!/^\d+$/.test(length)) rejectIntake('HTTP_STATUS');
      if (Number(length) > limit) rejectIntake('TOO_LARGE');
    }
    const chunks = [];
    let size = 0;
    const iterator = response.body?.[Symbol.asyncIterator]?.();
    if (!iterator) rejectIntake('NETWORK');
    while (true) {
      const next = await time.run(() => iterator.next());
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) rejectIntake('NETWORK');
      size += next.value.byteLength;
      onBytes(next.value.byteLength);
      if (size > limit) rejectIntake('TOO_LARGE');
      chunks.push(Buffer.from(next.value));
    }
    if (response.headers['content-length'] !== undefined && Number(response.headers['content-length']) !== size) rejectIntake('HTTP_STATUS');
    const compressed = Buffer.concat(chunks, size);
    const encoding = String(response.headers['content-encoding'] ?? 'identity').toLowerCase().trim();
    if (encoding === 'identity') return compressed;
    const factory = { gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress }[encoding];
    if (!factory) rejectIntake('UNSUPPORTED_ENCODING');
    const decoder = factory(), input = Readable.from([compressed]);
    input.pipe(decoder);
    const decoded = [];
    let decodedSize = 0, charged = size;
    try {
      const output = decoder[Symbol.asyncIterator]();
      while (true) {
        const next = await time.run(() => output.next());
        if (next.done) break;
        decodedSize += next.value.length;
        if (decodedSize > charged) { onBytes(decodedSize - charged); charged = decodedSize; }
        if (decodedSize > limit) rejectIntake('TOO_LARGE');
        decoded.push(next.value);
      }
      return Buffer.concat(decoded, decodedSize);
    } catch (error) {
      throw error instanceof IntakeError ? error : new IntakeError('UNSUPPORTED_ENCODING');
    } finally { input.destroy(); decoder.destroy(); }
  }

  async function fetchBounded(initial, deps, time, state, robots = false) {
    let url = initial, redirects = 0;
    while (true) {
      const response = await checkedRequest(url, deps, time);
      try {
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects++ >= INTAKE_LIMITS.redirects) rejectIntake('REDIRECT_LIMIT');
          if (typeof response.headers.location !== 'string' || !response.headers.location) rejectIntake('HTTP_STATUS');
          let next;
          try { next = intakeUrl(new URL(response.headers.location, url).href); } catch { rejectIntake('UNSAFE_URL'); }
          if (robots && new URL(next).origin !== new URL(initial).origin) rejectIntake('ROBOTS_UNSUPPORTED');
          url = next;
          continue;
        }
        if ([401, 403, 451].includes(response.status)) rejectIntake('ACCESS_DENIED');
        if (robots && [404, 410].includes(response.status)) return { missing: true, final: url };
        if (response.status >= 500 || response.status === 429) rejectIntake('NETWORK');
        if (response.status !== 200) rejectIntake('HTTP_STATUS');
        const type = mediaType(response.headers, !robots);
        const { raw } = decodeResponse(await responseBytes(response, time), type);
        return { raw, type, final: url };
      } finally { response.close?.(); }
    }
  }

  function robotsAllows(raw, target) {
    const groups = [];
    let group = null, rulesStarted = false;
    for (const line of raw.split(/\r?\n/)) {
      const clean = line.replace(/#.*$/, '').trim();
      if (!clean) continue;
      const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(clean);
      if (!match) continue;
      const [, directive, value] = match, key = directive.toLowerCase();
      if (key === 'user-agent') {
        if (!value || !/^(?:\*|[a-z0-9_-]+(?:\/[a-z0-9_.-]+)?)$/i.test(value)) rejectIntake('ROBOTS_UNSUPPORTED');
        if (!group || rulesStarted) { group = { agents: [], rules: [] }; groups.push(group); rulesStarted = false; }
        group.agents.push(value.toLowerCase());
      } else if (['allow', 'disallow'].includes(key)) {
        if (!group || (value && !value.startsWith('/'))) rejectIntake('ROBOTS_UNSUPPORTED');
        rulesStarted = true;
        if (value) group.rules.push({ allow: key === 'allow', value });
      }
    }
    const named = groups.filter(g => g.agents.some(a => a !== '*' && 'devenvthreatcorpusintake/1'.startsWith(a)));
    const specificity = named.length ? Math.max(...named.flatMap(g => g.agents.filter(a => a !== '*' && 'devenvthreatcorpusintake/1'.startsWith(a)).map(a => a.length))) : 0;
    const applicable = specificity ? named.filter(g => g.agents.some(a => a.length === specificity && 'devenvthreatcorpusintake/1'.startsWith(a)))
      : groups.filter(g => g.agents.includes('*'));
    const destination = new URL(target);
    const normalized = value => value.replace(/[^\x00-\x7f]/gu, char => encodeURIComponent(char))
      .replace(/%[a-f0-9]{2}/gi, octet => /^[a-z0-9._~-]$/i.test(String.fromCharCode(parseInt(octet.slice(1), 16)))
        ? String.fromCharCode(parseInt(octet.slice(1), 16)) : octet.toUpperCase());
    const pathname = normalized(destination.pathname + destination.search);
    const rules = applicable.flatMap(g => g.rules).map(rule => {
      const value = normalized(rule.value);
      const anchor = value.endsWith('$');
      const parts = (anchor ? value.slice(0, -1) : value).split('*');
      let matches = pathname.startsWith(parts[0]), cursor = parts[0].length;
      for (let index = 1; matches && index < parts.length - 1; index++) {
        const offset = pathname.indexOf(parts[index], cursor);
        matches = offset !== -1;
        cursor = offset + parts[index].length;
      }
      if (parts.length === 1) matches &&= !anchor || pathname.length === cursor;
      else if (matches) {
        const tail = parts.at(-1);
        matches = anchor ? pathname.endsWith(tail) && pathname.length - tail.length >= cursor : pathname.indexOf(tail, cursor) !== -1;
      }
      return { ...rule, length: value.replace(/[*$]/g, '').replace(/%[0-9A-F]{2}/g, 'x').length, matches };
    }).filter(rule => rule.matches).sort((a, b) => b.length - a.length || Number(b.allow) - Number(a.allow));
    return !rules.length || rules[0].allow;
  }

  export const IMAGE_LIMITS = Object.freeze({ images: 20, bytes: 5 * 1024 * 1024, totalBytes: 50 * 1024 * 1024 });
  function imageLimits(deps) {
    const supplied = deps.imageLimits ?? {};
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).some(key => !Object.hasOwn(IMAGE_LIMITS, key))) rejectIntake('INVALID_INPUT');
    const limits = { ...IMAGE_LIMITS, ...supplied };
    if (Object.keys(limits).some(key => !Number.isSafeInteger(limits[key]) || limits[key] < 0 || limits[key] > IMAGE_LIMITS[key])) rejectIntake('INVALID_INPUT');
    return limits;
  }
  const imageExtensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };

  async function retrieve(url, deps, state, archive = false) {
    const time = budget(deps);
    const policies = new Map();
    const limits = imageLimits(deps);
    const policy = async target => {
      const origin = new URL(target).origin;
      if (!policies.has(origin)) {
        const result = await fetchBounded(`${origin}/robots.txt`, deps, time, state, true);
        policies.set(origin, result.missing ? null : result.raw);
      }
      if (policies.get(origin) !== null && !robotsAllows(policies.get(origin), target)) rejectIntake('ROBOTS_DENIED');
    };
    try {
      for (let attempt = 0; attempt <= INTAKE_LIMITS.retries; attempt++) {
        state.retries = attempt;
        try {
          let target = url;
          for (let redirects = 0; ; redirects++) {
            await policy(target);
            const response = await checkedRequest(target, deps, time);
            try {
              if ([301, 302, 303, 307, 308].includes(response.status)) {
                if (redirects >= INTAKE_LIMITS.redirects) rejectIntake('REDIRECT_LIMIT');
                if (typeof response.headers.location !== 'string' || !response.headers.location) rejectIntake('HTTP_STATUS');
                try { target = intakeUrl(new URL(response.headers.location, target).href); } catch { rejectIntake('UNSAFE_URL'); }
                continue;
              }
              state.finalHash = sha256(target);
              if ([401, 403, 451].includes(response.status)) rejectIntake('ACCESS_DENIED');
              if (response.status >= 500 || response.status === 429) rejectIntake('NETWORK');
              if (response.status !== 200) rejectIntake('HTTP_STATUS');
              const type = mediaType(response.headers);
              const bytes = await responseBytes(response, time);
              const { raw, charset } = decodeResponse(bytes, type);
              const article = type.html ? parseArticle(raw, target) : { text: raw, metadata: {}, images: [] };
              const normalized = normalizeText(article.text);
              time.remaining();
              const content = { raw, normalized, bytes, charset, html: type.html, finalUrl: target,
                metadata: article.metadata, assets: [], imageBytes: new Map(),
                parserVersion: type.html ? HTML_PARSER_VERSION : TEXT_PARSER_VERSION };
              if (archive) {
                let total = 0, attempted = 0;
                const seen = new Set();
                for (const originalUrl of article.images) {
                  const asset = { originalUrl, url: null, finalUrl: null, localPath: null, hash: null, status: 'failed', reason: null };
                  content.assets.push(asset);
                  try {
                    asset.url = new URL(originalUrl, target).href;
                    let imageUrl = intakeUrl(asset.url);
                    if (seen.has(imageUrl)) { asset.status = 'skipped'; asset.reason = 'DUPLICATE'; continue; }
                    seen.add(imageUrl);
                    if (attempted >= limits.images) { asset.status = 'skipped'; asset.reason = 'IMAGE_COUNT_LIMIT'; continue; }
                    if (total >= limits.totalBytes || !limits.bytes) { asset.status = 'skipped'; asset.reason = 'IMAGE_TOTAL_LIMIT'; continue; }
                    attempted++;
                    for (let redirects = 0; ; redirects++) {
                      await policy(imageUrl);
                      const image = await checkedRequest(imageUrl, deps, time);
                      try {
                        if ([301, 302, 303, 307, 308].includes(image.status)) {
                          if (redirects >= INTAKE_LIMITS.redirects) rejectIntake('REDIRECT_LIMIT');
                          if (typeof image.headers.location !== 'string' || !image.headers.location) rejectIntake('HTTP_STATUS');
                          imageUrl = intakeUrl(new URL(image.headers.location, imageUrl).href);
                          continue;
                        }
                        if ([401, 403, 451].includes(image.status)) rejectIntake('ACCESS_DENIED');
                        if (image.status !== 200) rejectIntake('HTTP_STATUS');
                        const mime = String(image.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
                        const extension = imageExtensions[mime];
                        if (!extension) rejectIntake('UNSUPPORTED_TYPE');
                        const data = await responseBytes(image, time, Math.min(limits.bytes, limits.totalBytes - total), count => { total += count; });
                        asset.finalUrl = imageUrl;
                        asset.hash = sha256(data);
                        asset.localPath = `images/${asset.hash}.${extension}`;
                        asset.status = 'collected';
                        asset.contentType = mime;
                        asset.bytes = data.length;
                        content.imageBytes.set(asset.localPath, data);
                        break;
                      } finally { image.close?.(); }
                    }
                  } catch (error) {
                    asset.reason = safeCodes.has(error?.code) ? error.code : 'UNSAFE_URL';
                  }
                }
              }
              return content;
            } finally { response.close?.(); }
          }
        } catch (error) {
          const failure = error instanceof IntakeError ? error : new IntakeError('NETWORK');
          if (failure.code !== 'NETWORK' || attempt === INTAKE_LIMITS.retries) throw failure;
        }
      }
    } finally { time.close(); }
  }

  function absoluteSafe(file) {
    if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0') || file.split(path.sep).some(part => part === '.' || part === '..') || path.normalize(file) !== file) rejectIntake('UNSAFE_PATH');
    return file;
  }

  async function safeComponents(file) {
    absoluteSafe(file);
    let current = path.parse(file).root;
    for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) rejectIntake('UNSAFE_PATH');
    }
  }

  async function readPrivate(file, { corpus = false, privateOnly = false, maxBytes = INTAKE_LIMITS.bytes } = {}) {
    try {
      await safeComponents(file);
      const before = await fs.lstat(file);
      if (!before.isFile() || before.nlink !== 1 || ((corpus || privateOnly) && (before.mode & 0o077))) rejectIntake('UNSAFE_PATH');
      const handle = await fs.open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || ((corpus || privateOnly) && (stat.mode & 0o077))) rejectIntake('UNSAFE_PATH');
        if (!corpus && stat.size > maxBytes) rejectIntake('TOO_LARGE');
        const chunks = [];
        let size = 0;
        for await (const chunk of handle.createReadStream({ autoClose: false })) {
          size += chunk.length;
          if (!corpus && size > maxBytes) rejectIntake('TOO_LARGE');
          chunks.push(chunk);
        }
        return Buffer.concat(chunks, size);
      } finally { await handle.close(); }
    } catch (error) {
      if (error instanceof IntakeError) throw error;
      rejectIntake(corpus ? 'INVALID_CORPUS' : 'UNSAFE_PATH');
    }
  }

  export async function validatePrivateCorpus(file, { reviewAware = false } = {}) {
    const bytes = await readPrivate(file, { corpus: true });
    try {
      const corpus = JSON.parse(strictText(bytes));
      assertValid(reviewAware ? reviewEligibleCorpus(corpus) : corpus);
      return corpus;
    } catch { rejectIntake('INVALID_CORPUS'); }
  }

  async function loadProfileCorpus(file) {
    const bytes = await readPrivate(file, { corpus: true });
    let corpus;
    try { corpus = JSON.parse(strictText(bytes)); }
    catch { rejectIntake('INVALID_CORPUS'); }
    if (corpus?.schemaVersion !== CONTRACT_VERSION) rejectIntake('UNSUPPORTED_SCHEMA_VERSION');
    let effective;
    try { effective = reviewEligibleCorpus(corpus); }
    catch (error) {
      const failure = new IntakeError('INVALID_CORPUS');
      failure.errors = String(error.message).split('\n');
      throw failure;
    }
    const errors = validateCorpus(effective);
    if (errors.length) {
      const failure = new IntakeError('INVALID_CORPUS');
      failure.errors = errors;
      throw failure;
    }
    return corpus;
  }

  export async function readPrivateTemplate(file) {
    return strictText(await readPrivate(file, { privateOnly: true }));
  }

  export async function updatePrivateCorpus(directory, update, { reviewAware = false } = {}) {
    let store, result, failure;
    try {
      if (typeof update !== 'function') rejectIntake('INVALID_INPUT');
      store = await openStore(directory);
      store.reviewAware = reviewAware;
      try {
        await fs.lstat(store.file);
        store.baseline = digest(await validatePrivateCorpus(store.file, { reviewAware }));
      } catch (error) {
        if (error.code === 'ENOENT') rejectIntake('INVALID_CORPUS');
        throw error;
      }
      const corpus = await validatePrivateCorpus(store.file, { reviewAware });
      const previousReviews = structuredClone(corpus.reviews);
      result = await update(corpus);
      assertAppendOnlyReviews(previousReviews, corpus.reviews);
      await persist(store, corpus);
    } catch (error) {
      failure = { status: 'failed', code: safeCode(error), ...(error?.errors ? { errors: error.errors } : {}) };
    } finally {
      try { await store?.close(); }
      catch { failure = { status: 'failed', code: 'PERSISTENCE' }; }
    }
    return failure ?? { status: 'succeeded', ...result };
  }

  function emptyCorpus() {
    return { schemaVersion: CONTRACT_VERSION, name: 'Private manual intake', sources: [], sourceRevisions: [], passages: [], cases: [], claims: [], categorizations: [], timelines: [], reviews: [], collectionManifests: [], governance: {} };
  }

  async function openStore(directory) {
    absoluteSafe(directory);
    const relative = path.relative(repoRoot, directory);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
      && relative !== '.private-intake' && !relative.startsWith(`.private-intake${path.sep}`))) rejectIntake('UNSAFE_PATH');
    try {
      await safeComponents(path.dirname(directory));
      try { await fs.mkdir(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      await safeComponents(directory);
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || (stat.mode & 0o077)) rejectIntake('UNSAFE_PATH');
      const lockPath = path.join(directory, '.intake.lock');
      let lock;
      try { lock = await fs.open(lockPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW, 0o600); }
      catch (error) { rejectIntake(error.code === 'EEXIST' ? 'STORE_BUSY' : 'PERSISTENCE'); }
      const verifyDirectory = async () => {
        await safeComponents(directory);
        const current = await fs.lstat(directory);
        if (current.dev !== stat.dev || current.ino !== stat.ino || (current.mode & 0o077)) rejectIntake('UNSAFE_PATH');
      };
      return {
        file: path.join(directory, 'corpus.json'),
        verifyDirectory,
        close: async () => { await lock.close(); await verifyDirectory(); await fs.unlink(lockPath); },
      };
    } catch (error) { throw error instanceof IntakeError ? error : new IntakeError('PERSISTENCE'); }
  }

  async function persist(store, corpus) {
    let temporary, handle;
    const unchanged = async () => {
      await store.verifyDirectory();
      try {
        const stat = await fs.lstat(store.file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o077)) rejectIntake('UNSAFE_PATH');
        if (store.baseline === null || digest(await validatePrivateCorpus(store.file, { reviewAware: store.reviewAware })) !== store.baseline) rejectIntake('PERSISTENCE');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (store.baseline !== null) rejectIntake('PERSISTENCE');
      }
    };
    try {
      await unchanged();
      assertValid(corpus);
      temporary = path.join(path.dirname(store.file), `.intake-${randomUUID()}.pending`);
      handle = await fs.open(temporary, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW, 0o600);
      await handle.writeFile(canonicalSerialize(corpus), 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await unchanged();
      await fs.rename(temporary, store.file);
      temporary = null;
      const directory = await fs.open(path.dirname(store.file), fsConstants.O_RDONLY);
      try { await directory.sync(); } finally { await directory.close(); }
    } catch (error) { throw error instanceof IntakeError ? error : new IntakeError('PERSISTENCE'); }
    finally {
      await handle?.close().catch(() => {});
      if (temporary) await fs.unlink(temporary).catch(() => {});
    }
  }

  const unknownDate = () => ({ precision: 'unknown', value: null, start: null, end: null, nullReasons: { value: 'not_reported', start: 'not_applicable', end: 'not_applicable' } });
  const archiveArtifacts = new Set(['original.html', 'article.txt', 'metadata.json', 'assets.json']);
  const archiveByteLimit = artifact => artifact === 'assets.json' ? 50 * 1024 * 1024
    : artifact === 'original.html' ? INTAKE_LIMITS.bytes : 3 * INTAKE_LIMITS.bytes;
  function archivePath({ store, sourceId, revisionId }) {
    absoluteSafe(store);
    const relative = path.relative(repoRoot, store);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
      && relative !== '.private-intake' && !relative.startsWith(`.private-intake${path.sep}`))) rejectIntake('UNSAFE_PATH');
    if (![sourceId, revisionId].every(id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,160}$/.test(id))) rejectIntake('INVALID_INPUT');
    return path.join(store, 'articles', sourceId, revisionId);
  }
  async function privateDirectory(directory, create = false) {
    if (create) {
      try { await fs.mkdir(directory, { mode: 0o700 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    await safeComponents(directory);
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || (stat.mode & 0o077)) rejectIntake('UNSAFE_PATH');
  }
  export async function readArchiveArtifact(input) {
    if (!input || !archiveArtifacts.has(input.artifact)) rejectIntake('INVALID_INPUT');
    const directory = archivePath(input);
    for (const dir of [input.store, path.join(input.store, 'articles'), path.dirname(directory), directory]) await privateDirectory(dir);
    return readPrivate(path.join(directory, input.artifact), { privateOnly: true, maxBytes: archiveByteLimit(input.artifact) });
  }
  function metadataDate(value) {
    if (typeof value !== 'string') return unknownDate();
    const match = /^(\d{4}(?:-\d{2}(?:-\d{2})?)?)(?:T.*)?$/.exec(value);
    if (!match || !realDate(match[1])) return unknownDate();
    return { precision: { 4: 'year', 7: 'month', 10: 'day' }[match[1].length], value: match[1], start: null, end: null, nullReasons: { start: 'not_applicable', end: 'not_applicable' } };
  }
  async function archiveArticle(store, input, source, revision, content, retrievedAt) {
    const directory = archivePath({ store: input.store, sourceId: source.id, revisionId: revision.id });
    const warnings = content.assets.filter(asset => asset.status !== 'collected' && asset.reason !== 'DUPLICATE')
      .map(asset => ({ url: asset.url ?? asset.originalUrl, code: asset.reason }));
    await store.verifyDirectory();
    await privateDirectory(path.join(input.store, 'articles'), true);
    await privateDirectory(path.dirname(directory), true);
    try {
      await fs.lstat(directory);
      const metadata = JSON.parse((await readArchiveArtifact({ store: input.store, sourceId: source.id, revisionId: revision.id, artifact: 'metadata.json' })).toString('utf8'));
      if (metadata.sourceId !== source.id || metadata.revisionId !== revision.id || metadata.rawHash !== revision.rawHash || metadata.normalizedHash !== revision.normalizedHash) rejectIntake('IDENTITY_COLLISION');
      const original = await readArchiveArtifact({ store: input.store, sourceId: source.id, revisionId: revision.id, artifact: 'original.html' });
      const article = await readArchiveArtifact({ store: input.store, sourceId: source.id, revisionId: revision.id, artifact: 'article.txt' });
      if (sha256(original) !== metadata.originalBytesHash || sha256(article) !== revision.normalizedHash) rejectIntake('IDENTITY_COLLISION');
      const assets = JSON.parse((await readArchiveArtifact({ store: input.store, sourceId: source.id, revisionId: revision.id, artifact: 'assets.json' })).toString('utf8'));
      if (!Array.isArray(assets.assets) || !Array.isArray(assets.warnings)) rejectIntake('PERSISTENCE');
      return { alreadyPresent: true, warnings: assets.warnings };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const staging = path.join(path.dirname(directory), `.archive-${randomUUID()}.pending`);
    const paths = Object.fromEntries([...archiveArtifacts].map(artifact => [artifact, `articles/${source.id}/${revision.id}/${artifact}`]));
    const metadata = {
      schemaVersion: 'article-archive/1', sourceId: source.id, revisionId: revision.id,
      originalUrl: input.url, finalUrl: content.finalUrl, canonicalUrl: source.canonicalUrl,
      title: content.metadata.title ?? source.title, publisher: content.metadata.publisher ?? source.publisher, pagePublisher: content.metadata.pagePublisher ?? null,
      author: content.metadata.author ?? source.author, publicationDate: content.metadata.publicationDate ?? null,
      updateDate: content.metadata.updateDate ?? null, retrievedAt,
      rawHash: revision.rawHash, normalizedHash: revision.normalizedHash, originalBytesHash: sha256(content.bytes),
      parserVersion: content.parserVersion, normalizationVersion: NORMALIZATION_VERSION,
      charset: content.charset, contentType: content.html ? 'text/html' : 'text/plain',
      paths, imageLimits: imageLimits(input.archiveDeps ?? {}),
      limitations: ['Untrusted response HTML is download-only; no browser execution or access-control bypass.', 'Static HTML and article images only; no JavaScript rendering or recursive asset crawling.'],
    };
    try {
      await fs.mkdir(staging, { mode: 0o700 });
      await fs.mkdir(path.join(staging, 'images'), { mode: 0o700 });
      const files = new Map([
        ['original.html', content.bytes], ['article.txt', Buffer.from(content.normalized)],
        ['metadata.json', Buffer.from(canonicalSerialize(metadata))],
        ['assets.json', Buffer.from(canonicalSerialize({ schemaVersion: 'article-assets/1', assets: content.assets, warnings }))],
        ...content.imageBytes,
      ]);
      for (const [file, bytes] of files) {
        if (archiveArtifacts.has(file) && bytes.length > archiveByteLimit(file)) rejectIntake('TOO_LARGE');
        await fs.writeFile(path.join(staging, file), bytes, { flag: 'wx', mode: 0o600 });
      }
      await store.verifyDirectory();
      await privateDirectory(path.dirname(directory));
      try { await fs.lstat(directory); rejectIntake('PERSISTENCE'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await fs.rename(staging, directory);
      return { alreadyPresent: false, warnings };
    } finally { await fs.rm(staging, { recursive: true, force: true }).catch(() => {}); }
  }
  function provenance(kind, supplier) {
    return { kind: kind === 'url' ? 'supplied-url' : 'supplied-text', suppliedBy: supplier, description: 'Operator supplied input; intake only, no extraction or research approval.', nullReasons: {} };
  }

  export async function intakeSource(input, deps = {}) {
    let store;
    try {
      if (!input || !['text', 'file', 'url'].includes(input.kind) || typeof input.suppliedBy !== 'string'
        || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(input.suppliedBy)) rejectIntake('INVALID_INPUT');
      store = await openStore(input.store);
      let corpus;
      try {
        await fs.lstat(store.file);
        corpus = await validatePrivateCorpus(store.file);
        store.baseline = digest(corpus);
      } catch (error) {
        if (error.code === 'ENOENT') { corpus = emptyCorpus(); store.baseline = null; } else throw error;
      }
      const state = { retries: 0, finalHash: null };
      const eventTime = new Date((deps.now ?? Date.now)()).toISOString();
      const inputProvenance = provenance(input.kind, input.suppliedBy);
      let canonical = null, original = null, content, source, inputHash = null, failure = null;
      try {
        if (input.kind === 'url' || input.sourceUrl !== undefined) {
          original = input.kind === 'url' ? input.url : input.sourceUrl;
          canonical = intakeUrl(original);
          inputHash = sha256(canonical);
        }
        if (input.kind === 'url') content = await retrieve(canonical, deps, state, Boolean(input.archive));
        else {
          let bytes;
          if (input.kind === 'text') {
            if (typeof input.text !== 'string') rejectIntake('INVALID_INPUT');
            if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(input.text)) rejectIntake('MALFORMED_TEXT');
            bytes = Buffer.from(input.text, 'utf8');
            if (bytes.length > INTAKE_LIMITS.bytes) rejectIntake('TOO_LARGE');
          } else bytes = await readPrivate(input.file);
          const raw = strictText(bytes);
          inputHash ??= sha256(raw);
          content = { raw, normalized: normalizeText(raw), parserVersion: TEXT_PARSER_VERSION };
        }
        if (!content.normalized.trim()) rejectIntake('EMPTY_CONTENT');
      } catch (error) { failure = safeCodes.has(error?.code) ? error.code : 'MALFORMED_TEXT'; }
      const identity = canonical ? `${URL_NORMALIZATION_VERSION}\n${canonical}` : content ? `supplied-bytes/1\n${sha256(content.raw)}` : null;
      if (identity) {
        const sourceId = stableId('source', identity);
        source = corpus.sources.find(item => item.id === sourceId);
        if (source && (source.canonicalUrl !== canonical || (!canonical && !source.revisionIds.some(id => corpus.sourceRevisions.find(r => r.id === id)?.rawHash === sha256(content.raw))))) rejectIntake('IDENTITY_COLLISION');
        if (!source) {
          source = {
            id: sourceId, originalUrl: original, canonicalUrl: canonical, title: null, publisher: null, author: null,
            publicationDate: unknownDate(), updateDate: unknownDate(), retrievalDate: unknownDate(),
            inputKind: { text: 'supplied-text', file: 'text-file', url: 'url' }[input.kind],
            provenance: inputProvenance, revisionIds: [], extractionStatus: 'Not started', collectionState: 'Collected',
            nullReasons: { title: 'not_reported', publisher: 'not_reported', author: 'not_reported', ...(!canonical ? { originalUrl: 'not_reported', canonicalUrl: 'not_reported' } : {}) },
          };
          corpus.sources.push(source);
        }
      }
      let revision, archiveResult;
      if (!failure) {
        const candidate = {
          id: stableId('source-revision', canonicalSerialize({ sourceId: source.id, rawHash: sha256(content.raw), normalizedHash: sha256(content.normalized), normalizationVersion: NORMALIZATION_VERSION, parserVersion: content.parserVersion })),
          sourceId: source.id, rawHash: sha256(content.raw), normalizedHash: sha256(content.normalized),
          normalizationVersion: NORMALIZATION_VERSION, parserVersion: content.parserVersion,
          provenance: inputProvenance, rawContent: content.raw, normalizedContent: content.normalized, retention: 'private', nullReasons: {},
        };
        revision = corpus.sourceRevisions.find(item => item.id === candidate.id);
        if (revision && ['sourceId', 'rawHash', 'normalizedHash', 'normalizationVersion', 'parserVersion', 'rawContent', 'normalizedContent'].some(key => revision[key] !== candidate[key])) rejectIntake('IDENTITY_COLLISION');
        try {
          if (input.archive) archiveResult = await archiveArticle(store, { ...input, archiveDeps: deps }, source, revision ?? candidate, content, eventTime);
        } catch (error) { failure = safeCode(error); }
        if (!failure && !revision) { revision = candidate; corpus.sourceRevisions.push(revision); source.revisionIds.push(revision.id); }
        if (failure) revision = undefined;
        if (!failure && input.kind === 'url') {
          for (const key of ['title', 'publisher', 'author']) {
            if (content.metadata[key] && source[key] === null) { source[key] = content.metadata[key]; delete source.nullReasons[key]; }
          }
          for (const key of ['publicationDate', 'updateDate']) {
            if (source[key].precision === 'unknown') source[key] = metadataDate(content.metadata[key]);
          }
        }
        if (!failure && input.kind === 'url' && source.retrievalDate.precision === 'unknown') source.retrievalDate = {
          precision: 'day', value: eventTime.slice(0, 10), start: null, end: null, nullReasons: { start: 'not_applicable', end: 'not_applicable' },
        };
      }
      const manifestIdentity = canonicalSerialize({ sourceId: source?.id ?? null, revisionId: revision?.id ?? null, inputHash, inputKind: input.kind, supplier: input.suppliedBy, version: INTAKE_VERSION, ...(failure ? { eventTime, event: randomUUID() } : {}) });
      const manifestId = stableId('intake-manifest', manifestIdentity);
      let manifest = corpus.collectionManifests.find(item => item.id === manifestId);
      if (manifest && (manifest.inputHash !== inputHash || manifest.inputSourceIds[0] !== source?.id || manifest.inputRevisionIds[0] !== revision?.id
        || manifest.provenance.suppliedBy !== input.suppliedBy || manifest.provenance.kind !== inputProvenance.kind
        || manifest.toolVersion !== INTAKE_VERSION || manifest.outcome !== (failure ? 'Failed' : 'Succeeded')
        || manifest.outputHash !== (revision ? digest(revision) : null))) rejectIntake('IDENTITY_COLLISION');
      if (!manifest) {
        manifest = {
          id: manifestId, kind: 'manual-collection', inputSourceIds: source ? [source.id] : [], inputRevisionIds: revision ? [revision.id] : [],
          outcome: failure ? 'Failed' : 'Succeeded', provenance: inputProvenance, toolVersion: INTAKE_VERSION,
          inputHash, outputHash: revision ? digest(revision) : null,
          limitations: [
            `event-time=${eventTime}`, `status=${failure ? 'failed' : 'succeeded'}`, `error-code=${failure ?? 'NONE'}`,
            `retry-count=${state.retries}`, `final-target-sha256=${state.finalHash ?? 'NONE'}`,
            `url-normalization=${URL_NORMALIZATION_VERSION}`, 'intake-only; metadata not inferred; private retention; no research approval',
          ],
          nullReasons: { ...(inputHash === null ? { inputHash: 'not_reported' } : {}), ...(revision ? {} : { outputHash: 'not_applicable' }) },
        };
        corpus.collectionManifests.push(manifest);
      }
      if (store.baseline !== digest(corpus)) corpus = reviewEligibleCorpus(corpus);
      await persist(store, corpus);
      return { status: failure ? 'failed' : 'succeeded', code: failure ?? 'OK', ...(source ? { sourceId: source.id } : {}), ...(revision ? { revisionId: revision.id } : {}), manifestId: manifest.id,
        ...(archiveResult ? archiveResult : {}) };
    } catch (error) { return { status: 'failed', code: safeCode(error) }; }
    finally { await store?.close().catch(() => {}); }
  }

  export const BATCH_LIMIT = 20;
  export async function collectBatch(input, deps = {}) {
    let caseId = input?.caseId ?? null;
    try {
      if (!input || !Array.isArray(input.urls) || !input.urls.length || input.urls.length > BATCH_LIMIT
        || input.urls.some(url => typeof url !== 'string' || url.length > 8192)
        || typeof input.operator !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(input.operator)
        || Boolean(input.caseId) === Boolean(input.caseName)
        || (input.caseId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$/.test(input.caseId))
        || (input.caseName && (typeof input.caseName !== 'string' || !input.caseName.trim() || input.caseName.length > 200 || /[\u0000-\u001f]/u.test(input.caseName)))) rejectIntake('INVALID_INPUT');
      imageLimits(deps);
      const store = await openStore(input.store);
      try {
        if (input.caseId) {
          const corpus = await validatePrivateCorpus(store.file, { reviewAware: true });
          if (!corpus.cases.some(record => record.id === input.caseId)) rejectIntake('NOT_FOUND');
        }
      } finally { await store.close(); }
      caseId ??= stableId('case', `explicit-campaign/1\n${randomUUID()}`);
      const results = [], seen = new Map();
      let linked = false;
      for (const url of input.urls) {
        if (seen.has(url)) {
          const prior = seen.get(url);
          results.push({ ...prior, status: prior.status === 'failed' ? 'failed' : prior.warnings.length ? 'collected with image warnings' : 'already present' });
          continue;
        }
        const collected = await intakeSource({ kind: 'url', url, suppliedBy: input.operator, store: input.store, archive: true }, deps);
        const result = { url, status: 'failed', code: collected.code, sourceId: collected.sourceId ?? null, revisionId: collected.revisionId ?? null, warnings: collected.warnings ?? [] };
        if (collected.status === 'succeeded') {
          const association = await updatePrivateCorpus(input.store, corpus => {
            let campaign = corpus.cases.find(record => record.id === caseId);
            if (!campaign) {
              if (input.caseId) rejectIntake('NOT_FOUND');
              campaign = {
                id: caseId, name: input.caseName.trim(), aliases: [], kind: 'Campaign', summary: null,
                summaryClaimIds: [], sourceIds: [collected.sourceId], collectionState: 'Collected', disposition: 'Pending',
                limits: 'Explicit operator grouping only; collection does not establish campaign attribution or approve claims.',
                origin: 'Human authored', revision: 'r1', history: [], nullReasons: { summary: 'not_reported' },
              };
              corpus.cases.push(campaign);
            } else if (!campaign.sourceIds.includes(collected.sourceId)) {
              campaign.sourceIds.push(collected.sourceId);
              campaign.revision = stableId('case-revision', canonicalSerialize({ caseId, sourceIds: campaign.sourceIds.slice().sort(), previous: campaign.revision }));
              campaign.disposition = 'Pending';
              campaign.collectionState = 'Extracted — review pending';
            }
            Object.assign(corpus, reviewEligibleCorpus(corpus));
            return { caseId };
          }, { reviewAware: true });
          if (association.status === 'succeeded') {
            linked = true;
            result.status = result.warnings.length ? 'collected with image warnings' : collected.alreadyPresent ? 'already present' : 'collected';
            result.code = result.warnings.length ? 'IMAGE_WARNINGS' : 'OK';
          } else result.code = association.code;
        }
        seen.set(url, result);
        results.push(result);
      }
      const successes = results.filter(result => result.status !== 'failed').length;
      return { status: successes === results.length ? 'succeeded' : successes ? 'partial' : 'failed', caseId: input.caseId || linked ? caseId : null, results };
    } catch (error) { return { status: 'failed', caseId: input?.caseId ?? null, code: safeCode(error), results: [] }; }
  }

  async function intakeCli(args) {
    try {
      const [command, kind] = args;
      const parse = values => {
        const result = {};
        if (values.length % 2) rejectIntake('INVALID_INPUT');
        for (let i = 0; i < values.length; i += 2) {
          if (!/^--[a-z-]+$/.test(values[i]) || Object.hasOwn(result, values[i])) rejectIntake('INVALID_INPUT');
          result[values[i]] = values[i + 1];
        }
        return result;
      };
      if (command === 'validate') {
        const options = parse(args.slice(1));
        if (Object.keys(options).length !== 1 || !options['--file']) rejectIntake('INVALID_INPUT');
        await validatePrivateCorpus(options['--file']);
        return { status: 'succeeded', code: 'VALID' };
      }
      if (command === 'intake') {
        const rest = args.slice(2);
        if (kind === 'batch') {
          const options = parse(rest), allowed = new Set(['--urls-file', '--case-id', '--case-name', '--supplied-by', '--store', '--max-images', '--image-bytes', '--image-total-bytes']);
          if (Object.keys(options).some(key => !allowed.has(key)) || !options['--urls-file'] || !options['--supplied-by'] || !options['--store']) rejectIntake('INVALID_INPUT');
          const text = strictText(await readPrivate(options['--urls-file']));
          const urls = text.replace(/^\ufeff/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          const limits = Object.fromEntries([['--max-images', 'images'], ['--image-bytes', 'bytes'], ['--image-total-bytes', 'totalBytes']]
            .filter(([option]) => options[option] !== undefined).map(([option, key]) => [key, Number(options[option])]));
          return await collectBatch({ urls, caseId: options['--case-id'], caseName: options['--case-name'], operator: options['--supplied-by'], store: options['--store'] }, { imageLimits: limits });
        }
        const options = parse(rest), allowed = new Set([`--${kind}`, '--supplied-by', '--store', ...(kind !== 'url' ? ['--source-url'] : [])]);
        if (!['text', 'file', 'url'].includes(kind) || Object.keys(options).some(key => !allowed.has(key))
          || !Object.hasOwn(options, `--${kind}`) || !options['--supplied-by'] || !options['--store']) rejectIntake('INVALID_INPUT');
        return await intakeSource({ kind, [kind]: options[`--${kind}`], suppliedBy: options['--supplied-by'], store: options['--store'], ...(options['--source-url'] !== undefined ? { sourceUrl: options['--source-url'] } : {}) });
      }
      if (command === 'export' || command === 'list' || command === 'get' || command === 'bundle') {
        const options = parse(args.slice(1));
        const common = new Set(['--file', '--profile']);
        const allowed = command === 'export' ? new Set([...common, '--out'])
          : command === 'list' ? new Set([...common, '--entity', '--case-id', '--limit'])
          : command === 'get' ? new Set([...common, '--entity', '--id'])
          : new Set([...common, '--case']);
        if (Object.keys(options).some(key => !allowed.has(key)) || !options['--file']) rejectIntake('INVALID_INPUT');
        const profile = options['--profile'] ?? 'reviewed';
        const corpus = await loadProfileCorpus(options['--file']);
        const snapshot = profileRecords(corpus, profile);
        if (command === 'export') {
          if (!options['--out']) rejectIntake('INVALID_INPUT');
          const files = profileFiles(snapshot);
          const target = absoluteSafe(options['--out']);
          const parent = path.dirname(target);
          await safeComponents(parent);
          try { await fs.lstat(target); throw new Error('output directory already exists'); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
          const temporary = path.join(parent, `.corpus-export-${randomUUID()}`);
          try {
            await fs.mkdir(temporary, { mode: 0o755 });
            for (const [name, content] of Object.entries(files)) {
              await fs.writeFile(path.join(temporary, name), content, { flag: 'wx', mode: 0o644 });
            }
            await fs.rename(temporary, target);
          } catch (error) {
            await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
            throw error;
          }
          return {
            status: 'succeeded', profile, snapshotDigest: snapshot.snapshotDigest,
            coverage: snapshot.coverage, files: Object.keys(files).sort(),
          };
        }
        if (command === 'list') {
          return queryProfile(snapshot, 'list', {
            entity: options['--entity'], caseId: options['--case-id'],
            limit: options['--limit'] === undefined ? undefined : Number(options['--limit']),
          });
        }
        if (command === 'get') return queryProfile(snapshot, 'get', { entity: options['--entity'], id: options['--id'] });
        return queryProfile(snapshot, 'bundle', { caseId: options['--case'] });
      }
      rejectIntake('INVALID_INPUT');
    } catch (error) { return { status: 'failed', code: safeCode(error), ...(error?.errors ? { errors: error.errors } : {}) }; }
  }

  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await intakeCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exitCode = result.status === 'succeeded' ? 0 : 1;
  }
