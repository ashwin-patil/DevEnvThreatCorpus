import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertValid, canonicalSerialize, digest, NORMALIZATION_VERSION, sha256 } from './contract.mjs';

export const MIGRATION_VERSION = 'foundation-migration/1';
const evidenceStates = {
  Reported: 'Source-reported observation',
  'Attempt reported': 'Attempted behavior',
  'Intent only': 'Attempted behavior',
  'Research observed': 'Demonstrated capability or proof of concept',
  Demonstrated: 'Demonstrated capability or proof of concept',
};

export function dateValue(value, reason = 'not_reported') {
  return value === null || value === undefined
    ? { precision: 'unknown', value: null, start: null, end: null, nullReasons: { value: reason, start: 'not_applicable', end: 'not_applicable' } }
    : { precision: { 4: 'year', 7: 'month', 10: 'day' }[value.length], value, start: null, end: null, nullReasons: { start: 'not_applicable', end: 'not_applicable' } };
}

function legacy(record, status = record.reviewStatus) {
  return { ...structuredClone(record), originalStatus: status ?? 'not_reported', originalOrigin: record.origin ?? 'not_reported' };
}

function provenance(record) {
  return { kind: 'legacy-reference', suppliedBy: null, description: record.provenance ?? 'Frozen 0.2.0 enrichment record', nullReasons: { suppliedBy: 'not_reported' } };
}

function enrichment(record) {
  const { reviewStatus, reviewer, ...fields } = structuredClone(record);
  return { ...fields, disposition: 'Pending', legacy: legacy(record) };
}

export function migrateLegacy(input) {
  if (input.schemaVersion !== '0.2.0') throw new Error('migration accepts exactly schema 0.2.0');
  const claims = input.evidence.map(item => {
    if (!evidenceStates[item.status]) throw new Error(`unknown legacy evidence status ${item.status}`);
    return {
      id: item.id, caseId: item.campaignId, sourceId: item.sourceId, sourceRevisionId: `${item.sourceId}:legacy-0.2.0`,
      description: item.claim, passageIds: [], inference: null, evidenceStatus: evidenceStates[item.status],
      origin: item.origin, disposition: 'Pending', revision: 'legacy-0.2.0', history: [], conflictsWith: [],
      uncertainty: item.status === 'Intent only' ? 'Intent only; execution and victim theft are not established.'
        : item.status === 'Attempt reported' ? 'Attempt reported; successful execution/outcome is not established.' : 'Legacy source passage unavailable; independent review pending.',
      observationContext: ['Research observed', 'Demonstrated'].includes(item.status) ? item.status : null,
      nullReasons: { inference: 'not_applicable', ...(!['Research observed', 'Demonstrated'].includes(item.status) ? { observationContext: 'not_applicable' } : {}) },
      migrationGap: { reason: 'legacy passage not retained', originalLocator: item.locator ?? null },
      legacy: legacy(item, item.status),
    };
  });
  const corpus = {
    schemaVersion: '0.3.0', name: input.name,
    sources: input.sources.map(item => ({
      id: item.id, originalUrl: item.url, canonicalUrl: item.url, title: item.title, publisher: item.publisher, author: null,
      publicationDate: dateValue(item.published), updateDate: dateValue(null), retrievalDate: dateValue(item.accessed),
      inputKind: 'legacy-reference', provenance: provenance(item), revisionIds: [`${item.id}:legacy-0.2.0`],
      extractionStatus: 'Unavailable', collectionState: 'Extracted — review pending', nullReasons: { author: 'not_reported' }, legacy: legacy(item),
    })),
    sourceRevisions: input.sources.map(item => ({
      id: `${item.id}:legacy-0.2.0`, sourceId: item.id, rawHash: null, normalizedHash: null,
      normalizationVersion: NORMALIZATION_VERSION, parserVersion: 'legacy-unavailable/1', provenance: provenance(item),
      rawContent: null, normalizedContent: null, retention: 'legacy-missing',
      nullReasons: { rawHash: 'not_reported', normalizedHash: 'not_reported', rawContent: 'not_reported', normalizedContent: 'not_reported' },
      legacy: { originalRevision: item.revision ?? null, originalContentHash: item.contentHash ?? null },
    })),
    passages: [],
    cases: input.campaigns.map(item => ({
      id: item.id, name: item.name, aliases: [], kind: item.kind, summary: item.summary,
      summaryClaimIds: claims.filter(claim => claim.caseId === item.id).map(claim => claim.id),
      sourceIds: item.sourceIds, collectionState: 'Extracted — review pending', disposition: 'Pending',
      limits: item.limit, origin: item.origin, revision: 'legacy-0.2.0', history: [], pathIds: item.pathIds ?? [],
      nullReasons: {}, legacy: legacy(item),
    })),
    claims, categorizations: [], timelines: [], reviews: [], collectionManifests: [],
    governance: structuredClone(input.governance),
    migration: { fromVersion: '0.2.0', toolVersion: MIGRATION_VERSION, inputHash: digest(input), pendingPassageExceptions: claims.map(claim => claim.id) },
    legacy: { schemaVersion: input.schemaVersion, updated: input.updated, modules: input.modules, build: input.build },
  };
  if (input.paths) corpus.paths = input.paths.map(item => {
    const { campaignId, nodes, edges, ...rest } = enrichment(item);
    return {
      ...rest, caseId: campaignId, scope: item.campaignId === 'gambit' ? 'composite' : 'representative',
      nodes: nodes.map(node => {
        const { evidenceIds, patternIds, status, ...fields } = enrichment(node);
        if (!evidenceStates[status]) throw new Error(`unknown node evidence status ${status}`);
        return { ...fields, claimIds: evidenceIds, behaviorIds: patternIds, evidenceStatus: evidenceStates[status] };
      }),
      edges: edges.map(edge => {
        const { evidenceIds, ...fields } = enrichment(edge);
        return { ...fields, claimIds: evidenceIds };
      }),
    };
  });
  if (input.behaviors) corpus.behaviors = input.behaviors.map(enrichment);
  if (input.frameworks) corpus.frameworks = structuredClone(input.frameworks);
  if (input.mappings) corpus.mappings = input.mappings.map(item => {
    const { campaignId, evidenceIds, ...fields } = enrichment(item);
    const technique = input.frameworks?.find(technique => technique.id === item.techniqueId);
    if (!technique) throw new Error(`mapping ${item.id} has no framework technique`);
    return { ...fields, caseId: campaignId, claimIds: evidenceIds, framework: technique.framework, version: technique.version, mappingStatus: 'Proposed' };
  });
  for (const name of ['telemetry', 'detections', 'otel']) if (input[name]) corpus[name] = input[name].map(enrichment);
  if (input.otelReference) corpus.otelReference = structuredClone(input.otelReference);
  const report = {
    schemaVersion: '0.3.0', migrationVersion: MIGRATION_VERSION, beforeDigest: digest(input), afterDigest: digest(corpus),
    idPolicy: 'Entity-type scoped IDs preserve legacy source/case identity; node IDs are globally unique.',
    acceptedClaims: 0, collisionResolutions: [],
    preservedIds: { sources: input.sources.map(item => item.id), cases: input.campaigns.map(item => item.id), claims: input.evidence.map(item => item.id) },
    transformations: ['campaigns -> cases', 'evidence -> claims', 'campaignId -> caseId', 'node evidenceIds -> claimIds', 'node patternIds -> behaviorIds', 'edge evidenceIds -> claimIds', 'mapping evidenceIds -> claimIds', 'mapping technique -> explicit framework/version', 'Unreviewed/Approved -> Pending (no authenticated review evidence)', 'Legacy statuses preserved as originalStatus; origin preserved as originalOrigin'],
    gaps: claims.map(claim => ({ claimId: claim.id, sourceId: claim.sourceId, sourceRevisionId: claim.sourceRevisionId, reason: claim.migrationGap.reason, originalLocator: claim.migrationGap.originalLocator })),
    sourceGaps: corpus.sourceRevisions.map(revision => ({ sourceId: revision.sourceId, revisionId: revision.id, missingRawHash: true, missingNormalizedHash: true, missingRetainedContent: true, legacyContentHash: revision.legacy.originalContentHash, legacyRevision: revision.legacy.originalRevision })),
    limits: ['No quotations, raw/normalized input hashes, reviewers or dates invented.', 'Legacy contentHash and revision retained only as original metadata; their input normalization/parser provenance is not established.', 'Legacy campaign dates/roles remain audit metadata: no unsupported timeline/category assertions generated.', 'Review identity is a recorded assertion; authentication is not implemented by this contract.', 'Optional enrichments retained as pending drafts, not verified detections or observed telemetry.'],
    semanticRegressions: {
      deadbugz: { claimId: 'deadbugz-e4', status: 'Attempted behavior', originalStatus: 'Intent only', executionEstablished: false },
      nx: { claimId: 'nx-e5', scope: 'package-level scanning; not agent credential retrieval', preservedNodeLimit: corpus.paths?.find(path => path.id === 'path-nx')?.nodes.find(node => node.id === 'nx-5')?.atlasApplicability ?? null },
      gambit: { caseId: 'gambit', pathId: 'path-gambit', scope: 'composite', datePrecision: 'month' },
    },
  };
  assertValid(corpus);
  return { corpus, report };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--write-fixtures') throw new Error('usage: node scripts/migrate-contract.mjs --write-fixtures');
  const beforeBytes = readFileSync(new URL('../handoff/reference/corpus.json', import.meta.url), 'utf8');
  const { corpus, report } = migrateLegacy(JSON.parse(beforeBytes));
  report.frozenInputByteHash = sha256(beforeBytes);
  const directory = new URL('../tests/fixtures/migration/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('before-0.2.0.json', directory), beforeBytes);
  writeFileSync(new URL('after-0.3.0.json', directory), canonicalSerialize(corpus));
  writeFileSync(new URL('report.json', directory), canonicalSerialize(report));
  console.log(`Migration fixtures written: 5 cases, 23 pending claims; ${report.afterDigest}`);
}
