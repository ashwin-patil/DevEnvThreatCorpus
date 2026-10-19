import { createModel, researchPresentation } from './model.mjs';
import { OBSERVATION_CONTEXTS, validatePromptResponses } from './prompt-responses.mjs';

const TYPES = ['sources', 'sourceRevisions', 'passages', 'cases', 'claims', 'categorizations', 'timelines',
  'paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel'];
const USAGE = ['targeted', 'attempted-abuse', 'reported-abuse', 'vendor-example', 'general-mention', 'unclear'];
const fail = () => { throw new Error('Invalid public Pending draft projection.'); };
function sameProjection(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameProjection(a[key], b[key]));
}

// Export rows are a display projection, not a private corpus: omitted article text
// cannot acquire the human passage attestation required by private-corpus import.
export function publicDraftModel(document) {
  if (document?.schemaVersion !== 'public-draft/1' || document.profile !== 'draft'
      || !Array.isArray(document.records) || !Array.isArray(document.sourceCoverage)
      || !Array.isArray(document.tools) || !Array.isArray(document.limitations)
      || (document.prompts !== undefined && !Array.isArray(document.prompts))
      || !/^[a-f0-9]{64}$/.test(document.snapshotDigest ?? '')) fail();
  const corpus = { schemaVersion: '0.3.0', name: 'Nx / s1ngularity — public Pending draft',
    ...Object.fromEntries(TYPES.map(type => [type, []])), reviews: [], collectionManifests: [],
    governance: { publicDraft: true } };
  for (const source of document.sourceCoverage) {
    let url;
    try { url = new URL(source.url); } catch { fail(); }
    if (url.protocol !== 'https:' || url.username || url.password
      || !['collected', 'failed'].includes(source.status)) fail();
  }
  const seen = new Set();
  for (const row of document.records) {
    const entity = row?.entity;
    if (row?.schemaVersion !== '0.3.0' || !TYPES.includes(row.entityType) || !entity
        || typeof entity.id !== 'string' || seen.has(`${row.entityType}:${entity.id}`)
        || !Array.isArray(row.warnings) || !row.warnings.some(w => typeof w === 'string' && w.startsWith('Draft profile;'))
        || row.reviewStatus?.currentAcceptance === true || entity.disposition === 'Accepted'
        || row.reviewStatus?.effectiveDisposition === 'Accepted' || row.reviewStatus?.recordedDisposition === 'Accepted'
        || (entity.history && entity.history.length)
        || (row.entityType === 'sourceRevisions' && (entity.rawContent !== null || entity.normalizedContent !== null))
        || (row.entityType === 'passages' && (entity.text !== null || entity.attestation !== null))) fail();
    seen.add(`${row.entityType}:${entity.id}`);
    corpus[row.entityType].push(structuredClone(entity));
  }
  const model = createModel(corpus);
  model.annotations = document.tools.map(tool => {
    const claim = model.claims.get(tool.claimId);
    if (!claim || claim.caseId !== tool.caseId || claim.sourceId !== tool.sourceId
        || claim.sourceRevisionId !== tool.sourceRevisionId || typeof tool.id !== 'string'
        || typeof tool.literal !== 'string' || tool.literal.length > 80 || !USAGE.includes(tool.usage)) fail();
    return { id: tool.id, type: 'commands-ai-artifacts', value: tool.literal, caseId: tool.caseId,
      sourceId: tool.sourceId, sourceRevisionId: tool.sourceRevisionId, claimIds: [claim.id],
      status: 'pending', origin: 'agent', evidenceStatus: 'unresolved',
      context: { artifactKind: 'ide-cli', artifactUsage: tool.usage,
        notes: 'Public locator-only projection; full supporting passages remain private.' } };
  });
  const artifactIds = new Set(model.annotations.map(annotation => annotation.id));
  for (const prompt of document.prompts ?? []) {
    const claim = model.claims.get(prompt?.claimId), locator = prompt?.locator;
    const passages = claim?.passageIds.map(id => model.passages.get(id)).filter(Boolean)
      .sort((a, b) => a.start - b.start) ?? [];
    let coveredEnd = locator?.start;
    for (const passage of passages) {
      if (passage.sourceRevisionId === prompt?.sourceRevisionId && passage.start <= coveredEnd
          && passage.end > coveredEnd) coveredEnd = passage.end;
    }
    if (!claim || claim.caseId !== prompt.caseId || claim.sourceId !== prompt.sourceId
        || claim.sourceRevisionId !== prompt.sourceRevisionId || !model.sources.has(prompt.sourceId)
        || model.sourceRevisions.get(prompt.sourceRevisionId)?.sourceId !== prompt.sourceId
        || typeof prompt.id !== 'string' || !prompt.id.trim() || artifactIds.has(prompt.id)
        || typeof prompt.literal !== 'string' || !prompt.literal.trim() || prompt.literal.length > 16384
        || prompt.literal.includes('\0') || typeof prompt.label !== 'string' || !prompt.label.trim()
        || prompt.label.length > 120 || !USAGE.includes(prompt.usage)
        || !Number.isSafeInteger(locator?.start) || !Number.isSafeInteger(locator?.end)
        || locator.start < 0 || locator.end <= locator.start || coveredEnd < locator.end
        || [...prompt.literal].length !== locator.end - locator.start) fail();
    artifactIds.add(prompt.id);
    if (prompt.observationContext !== undefined && !Object.hasOwn(OBSERVATION_CONTEXTS, prompt.observationContext)) fail();
    if (prompt.observationBasis !== undefined && (typeof prompt.observationBasis !== 'string'
      || !prompt.observationBasis.trim() || prompt.observationBasis.length > 16384 || prompt.observationBasis.includes('\0'))) fail();
    const annotation = { id: prompt.id, type: 'commands-ai-artifacts', value: prompt.literal,
      normalizedValue: prompt.label, caseId: prompt.caseId, sourceId: prompt.sourceId,
      sourceRevisionId: prompt.sourceRevisionId, claimIds: [claim.id], status: 'pending', origin: 'agent',
      evidenceStatus: 'evidence-backed', support: { locator: { ...locator } },
      context: { artifactKind: 'prompt-instruction', artifactUsage: prompt.usage,
        observationContext: prompt.observationContext ?? 'unknown',
        observationBasis: prompt.observationBasis ?? 'The published prompt alone does not identify a test or compromised-host observation.' },
      ...(prompt.responses !== undefined ? { responses: structuredClone(prompt.responses) } : {}) };
    if (validatePromptResponses(annotation, corpus, { publicProjection: true }).length) fail();
    model.annotations.push(annotation);
  }
  if (document.coverage?.promptArtifacts !== undefined) {
    const artifacts = document.coverage.promptArtifacts;
    if (artifacts?.schemaVersion !== 'public-prompt-artifacts/1'
      || JSON.stringify(artifacts.prompts) !== JSON.stringify(document.prompts)
      || !/^[a-f0-9]{64}$/.test(document.coverage.promptArtifactDigest ?? '')) fail();
  }
  model.collectionEnabled = false;
  model.staleReviewCount = 0;
  model.campaignStatus = {};
  model.publicDraft = { sourceCoverage: structuredClone(document.sourceCoverage),
    limitations: [...document.limitations], baseRevision: document.baseRevision, snapshotDigest: document.snapshotDigest };
  model.publicCatalogSnapshot = structuredClone(document.catalogSnapshot);
  model.publicAvailableCatalogSnapshot = structuredClone(document.availableCatalogSnapshot);
  model.presentation = researchPresentation(model);
  if (document.coverage?.researchPresentation !== undefined
    && (!/^[a-f0-9]{64}$/.test(document.coverage.researchPresentationDigest ?? '')
      || !sameProjection(document.coverage.researchPresentation, model.presentation))) fail();
  if (document.coverage?.researchPresentation === undefined && document.coverage?.researchPresentationDigest !== undefined) fail();
  return model;
}
