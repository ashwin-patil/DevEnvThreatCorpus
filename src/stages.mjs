import path from 'node:path';
import { assertValid, canonicalSerialize, digest, readPrivateTemplate, reviewEligibleCorpus, stableId,
  updatePrivateCorpus, validatePrivateCorpus } from '../scripts/contract.mjs';
import { appendOutputs, candidateGuide, prepareCampaign, normalizeStageGrounding, validateCampaignSnapshot } from './campaign.mjs';
import { normalizeCampaignRecords, RECORD_NORMALIZATION_VERSION } from './campaign-records.mjs';
import { reviewSnapshot } from './hitl.mjs';
import { privateDirectory, privateOutput, readEnrichmentSnapshot } from './enrichment.mjs';
import { STAGE_VERSION, STAGE_REQUEST, STAGE_CANDIDATE, STAGE_RUN, STAGE_OUTPUTS, STAGE_LIMITS,
  stageFail, stageObject, stageList, stageSize, stagePrompt, stageOutputHash, stageInputRevision,
  validateStageEnvelope } from './stage-contract.mjs';

const runList = corpus => corpus.governance?.campaignExtraction?.runs ?? [];
const artifactKinds = new Set(['ide-cli', 'command', 'executable', 'flag-argument', 'prompt-instruction']);
const same = (a, b) => canonicalSerialize(a) === canonicalSerialize(b);

function upstreamInputs(corpus, caseId, kind, inputKeys, annotations) {
  stageList(inputKeys, true);
  if (new Set(inputKeys).size !== inputKeys.length) stageFail('DUPLICATE_STAGE_INPUT');
  const state = reviewSnapshot(corpus, annotations), lookup = new Map(state.units.map(u => [u.itemKey, u]));
  const selected = new Map();
  function visit(key) {
    if (selected.has(key)) return;
    const u = lookup.get(key);
    const allowed = kind === 'interpret' ? ['claims', 'annotations'] : ['claims', 'annotations', 'behaviors', 'occurrences'];
    if (!u || !allowed.includes(u.type) || !u.caseIds.includes(caseId)
      || u.caseIds.some(id => id !== caseId) || u.structurallyBlocked || u.groundingLost
      || ['exclude', 'unsure'].includes(u.history.at(-1)?.action)
      || (u.stale && !['modify', 'provenance'].includes(u.history.at(-1)?.action))) stageFail('INVALID_STAGE_INPUT');
    if (u.type === 'claims' && u.record.inference) stageFail('INVALID_STAGE_INPUT');
    if (u.type === 'annotations' && (u.record.type !== 'commands-ai-artifacts'
      || !artifactKinds.has(u.record.context?.artifactKind))) stageFail('INVALID_STAGE_INPUT');
    selected.set(key, u);
    u.dependencies.forEach(visit);
    if (u.type === 'behaviors') {
      state.units.filter(item => item.type === 'occurrences' && item.parent?.id === u.id)
        .forEach(item => visit(item.itemKey));
    }
  }
  [...inputKeys].sort().forEach(visit);
  stageList([...selected.values()]);
  if (![...selected.values()].some(u => u.type === 'claims')
    || (kind === 'relate' && ![...selected.values()].some(u => u.type === 'behaviors'))) stageFail('MISSING_STAGE_SUPPORT');
  return [...selected.values()].sort((a, b) => a.itemKey.localeCompare(b.itemKey)).map(u => ({
    itemKey: u.itemKey, type: u.type, id: u.id, record: structuredClone(u.record),
    originalHash: u.originalHash, binding: u.binding, effectiveRevision: stageInputRevision(u, lookup),
    contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship, editor: u.editor ?? null,
    evidence: structuredClone(u.evidence), decisionId: u.history.at(-1)?.id ?? null, reviewState: u.state,
    runIds: u.runMetadata.map(r => r.id),
  }));
}

export function prepareStage(corpus, { caseId, kind, inputKeys = [], revisionIds = [], requestedModel = null } = {}, annotations = []) {
  stagePrompt(kind);
  stageList(revisionIds); stageList(inputKeys);
  validateCampaignSnapshot(corpus);
  const canonical = prepareCampaign(corpus, { caseId, revisionIds, requestedModel });
  if (kind === 'ground' && inputKeys.length) stageFail('INVALID_STAGE_INPUT');
  const upstream = kind === 'ground' ? [] : upstreamInputs(corpus, caseId, kind, inputKeys, annotations);
  const guide = candidateGuide();
  const body = {
    schemaVersion: STAGE_REQUEST, extractionVersion: STAGE_VERSION, kind, caseId, baseDigest: digest(corpus),
    inputPolicy: 'grounded-applied-pending/1', allowedOutputs: STAGE_OUTPUTS[kind],
    selection: { inputKeys: [...inputKeys].sort(), revisionIds: [...revisionIds] },
    caseScope: canonical.caseScope, chunkPolicy: canonical.chunkPolicy,
    inputs: kind === 'ground' ? canonical.inputs : [], upstream,
    catalogSnapshot: canonical.catalogSnapshot, provider: canonical.provider, prompt: stagePrompt(kind),
    limits: STAGE_LIMITS,
    candidateGuide: {
      schemaVersion: STAGE_CANDIDATE, kind, requestHash: 'copy requestHash',
      model: guide.model, processing: kind === 'ground' ? guide.coverage.map(({ segmentId, ...rest }) => ({ inputId: segmentId, ...rest }))
        : [{ inputId: 'selected upstream itemKey', status: 'completed', reason: null }],
      outputs: kind === 'ground' ? { claims: guide.claims, artifacts: guide.records.annotations }
        : Object.fromEntries(STAGE_OUTPUTS[kind].map(key => [key, guide.records[key]])),
      limitations: ['Every output stays Pending; all selected upstream items are required support for this cohort.'],
    },
    limitations: ['Manual private handoff only; no provider call or human acceptance.',
      'Choose a minimal upstream cohort: every selected effective input binds each output.',
      'Partial processing is not complete extraction, review, adoption or release.'],
  };
  const request = { ...body, requestHash: digest(body) };
  stageSize(request);
  return request;
}

function verifyStageRequest(corpus, request, annotations) {
  stageSize(request);
  if (request?.schemaVersion !== STAGE_REQUEST) stageFail('INVALID_STAGE');
  const { requestHash, ...body } = request;
  if (requestHash !== digest(body)) stageFail('REQUEST_TAMPERED');
  if (request.baseDigest !== digest(corpus)) stageFail('STALE_INPUT');
  const fresh = prepareStage(corpus, { caseId: request.caseId, kind: request.kind,
    ...request.selection, requestedModel: request.provider?.requestedModel }, annotations);
  if (!same(fresh, request)) stageFail('STALE_STAGE_INPUT');
}

function processingFor(request, candidate) {
  const ids = request.kind === 'ground' ? request.inputs.flatMap(i => i.segments.map(s => s.id))
    : request.upstream.map(i => i.itemKey);
  const seen = new Set();
  for (const item of stageList(candidate.processing)) {
    stageObject(item, ['inputId', 'status', 'reason']);
    if (!ids.includes(item.inputId) || seen.has(item.inputId)
      || !['completed', 'skipped', 'failed'].includes(item.status)
      || (item.status === 'completed' ? item.reason !== null : typeof item.reason !== 'string' || !item.reason.trim())) {
      stageFail('INVALID_STAGE_PROCESSING');
    }
    seen.add(item.inputId);
  }
  if (seen.size !== ids.length) stageFail('INCOMPLETE_STAGE_PROCESSING');
  return structuredClone(candidate.processing);
}

function outputCount(outputs) {
  return Object.entries(outputs).reduce((sum, [key, values]) => sum + values.length
    + (key === 'paths' ? values.reduce((n, p) => n + (p.nodes?.length ?? 0) + (p.edges?.length ?? 0), 0) : 0)
    + (key === 'behaviors' ? values.reduce((n, b) => n + 1 + (b.occurrences?.length ?? 0), 0) : 0), 0);
}

export function validateStageCandidate(corpus, request, candidate, annotations = []) {
  verifyStageRequest(corpus, request, annotations);
  stageSize(candidate);
  stageObject(candidate, ['schemaVersion', 'requestHash', 'kind', 'model', 'processing', 'outputs', 'limitations']);
  if (candidate.schemaVersion !== STAGE_CANDIDATE || candidate.requestHash !== request.requestHash
    || candidate.kind !== request.kind) stageFail('REQUEST_MISMATCH');
  stageObject(candidate.outputs, STAGE_OUTPUTS[request.kind]);
  Object.values(candidate.outputs).forEach(values => stageList(values));
  stageList(candidate.limitations).forEach(s => { if (typeof s !== 'string' || !s.trim()) stageFail(); });
  stageObject(candidate.model, ['effectiveModel', 'version', 'nullReasons']);
  stageObject(candidate.model.nullReasons, ['effectiveModel', 'version'], []);
  for (const key of ['effectiveModel', 'version']) {
    if (candidate.model[key] === null ? candidate.model.nullReasons[key] !== 'unknown'
      : typeof candidate.model[key] !== 'string' || !candidate.model[key].trim() || Object.hasOwn(candidate.model.nullReasons, key)) stageFail();
  }
  if (candidate.model.effectiveModel === null && candidate.model.version !== null) stageFail();
  if (outputCount(candidate.outputs) > STAGE_LIMITS.items) stageFail('STAGE_LIMIT');
  const processing = processingFor(request, candidate);
  const runId = stableId('campaign-stage-run', `${request.requestHash}\n${digest(candidate)}`);
  let run;
  if (request.kind === 'ground') {
    if (candidate.outputs.claims.some(c => c.evidenceStatus === 'Researcher inference')
      || candidate.outputs.artifacts.some(a => !artifactKinds.has(a.kind))) stageFail('CROSS_STAGE_OUTPUT');
    const canonical = prepareCampaign(corpus, { caseId: request.caseId, ...request.selection,
      requestedModel: request.provider.requestedModel });
    const normalized = normalizeStageGrounding(corpus, canonical, {
      schemaVersion: 'campaign-candidate/1', requestHash: canonical.requestHash,
      model: candidate.model, coverage: processing.map(({ inputId, ...r }) => ({ segmentId: inputId, ...r })),
      claims: candidate.outputs.claims, artifacts: candidate.outputs.artifacts, absences: [], limitations: candidate.limitations,
    }, runId);
    run = normalized.run;
  } else {
    const hasOutput = Object.values(candidate.outputs).some(v => v.length);
    if (hasOutput && processing.some(i => i.status !== 'completed')) stageFail('UNPROCESSED_SUPPORT');
    const effective = structuredClone(corpus);
    const claimIds = new Set(request.upstream.filter(i => i.type === 'claims').map(i => i.id));
    effective.claims = effective.claims.filter(c => claimIds.has(c.id));
    for (const input of request.upstream.filter(i => i.type === 'claims')) {
      effective.claims[effective.claims.findIndex(c => c.id === input.id)] = structuredClone(input.record);
    }
    const behaviors = request.upstream.filter(i => i.type === 'behaviors').map(i => i.record);
    effective.behaviors = behaviors;
    const normalized = normalizeCampaignRecords({ candidate: candidate.outputs, request, corpus: effective,
      claims: [], passages: [], runId, upstreamBehaviors: behaviors });
    run = {
      id: runId, normalizationVersion: RECORD_NORMALIZATION_VERSION, caseId: request.caseId,
      catalogSnapshot: structuredClone(request.catalogSnapshot), coverage: [], segmentCoverage: [], inputs: [],
      absences: [], claimIds: [], passageIds: [], claimSnapshots: [], passageSnapshots: [],
      dependencySnapshots: {}, ...normalized,
    };
  }
  run.schemaVersion = STAGE_RUN; run.extractionVersion = STAGE_VERSION;
  run.requestHash = request.requestHash; run.responseHash = digest(candidate); run.baseDigest = request.baseDigest;
  run.promptVersion = request.prompt.version; run.promptHash = request.prompt.hash;
  run.provider = { ...request.provider, ...candidate.model };
  run.disposition = 'Pending';
  run.limitations = [...request.limitations, ...candidate.limitations];
  run.inputSnapshotDigest = digest({ inputs: request.inputs, upstream: request.upstream });
  run.supersedes = runList(corpus).filter(r => r.caseId === request.caseId && r.stage?.kind === request.kind).map(r => r.id);
  run.stage = {
    kind: request.kind, request: structuredClone(request), candidate: structuredClone(candidate),
    upstream: structuredClone(request.upstream),
    lineage: [...new Set(request.upstream.flatMap(i => i.runIds))].sort(),
    processing, inputHash: run.inputSnapshotDigest, outputHash: stageOutputHash(run),
  };
  delete run.envelopeHash;
  run.envelopeHash = digest(run);
  const reviewableCount = run.claimSnapshots.length + run.annotations.length + run.unresolvedMappings.length
    + Object.values(run.records).flat().length
    + (run.records.behaviors ?? []).reduce((n, b) => n + b.occurrences.length, 0)
    + (run.records.paths ?? []).reduce((n, p) => n + p.nodes.length + p.edges.length, 0);
  if (reviewableCount > STAGE_LIMITS.items) stageFail('STAGE_LIMIT');
  validateStageEnvelope(run);
  const next = structuredClone(corpus);
  appendOutputs(next, run.claimSnapshots, run.passageSnapshots, run);
  assertValid(reviewEligibleCorpus(next)); validateCampaignSnapshot(next);
  return run;
}

export function applyStage(corpus, request, candidate, annotations = []) {
  const { requestHash, ...body } = request ?? {};
  if (requestHash !== digest(body)) stageFail('REQUEST_TAMPERED');
  validateCampaignSnapshot(corpus);
  const old = runList(corpus).find(r => r.schemaVersion === STAGE_RUN
    && r.requestHash === requestHash && r.responseHash === digest(candidate));
  if (old) return { runId: old.id, replay: true };
  const run = validateStageCandidate(corpus, request, candidate, annotations);
  appendOutputs(corpus, run.claimSnapshots, run.passageSnapshots, run);
  return { runId: run.id, replay: false };
}

export function stageStatus(corpus, caseId) {
  validateCampaignSnapshot(corpus);
  const runs = runList(corpus).filter(r => r.schemaVersion === STAGE_RUN && (!caseId || r.caseId === caseId));
  return { schemaVersion: STAGE_VERSION, pending: true, runs: runs.map(run => ({
    id: run.id, kind: run.stage.kind, promptVersion: run.promptVersion, lineage: run.stage.lineage,
    processing: run.stage.processing, inputHash: run.stage.inputHash, outputHash: run.stage.outputHash,
    state: !run.stage.processing.length ? 'empty' : run.stage.processing.every(i => i.status === 'completed') ? 'completed'
      : run.stage.processing.some(i => i.status === 'completed') ? 'partial' : 'failed',
    limitations: run.limitations,
  })), limitations: ['Processing completion is not semantic completeness, human review, adoption or release readiness.'] };
}

export async function runStage({ command, store, caseId, kind, inputKeys, revisionIds, requestedModel,
  request, candidate, requestFile, inputFile, outputFile }) {
  try {
    if (!['prepare', 'validate', 'apply', 'status'].includes(command) || !path.isAbsolute(store ?? '')) stageFail('INVALID_INPUT');
    const verifyDirectory = await privateDirectory(store);
    request ??= requestFile ? JSON.parse(await readPrivateTemplate(requestFile)) : undefined;
    candidate ??= inputFile ? JSON.parse(await readPrivateTemplate(inputFile)) : undefined;
    let failureCode;
    if (command === 'apply') {
      const result = await updatePrivateCorpus(store, async corpus => {
        try {
          const sidecar = await readEnrichmentSnapshot(store, corpus);
          return applyStage(corpus, request, candidate, sidecar.annotations);
        } catch (error) { failureCode = error.code; throw error; }
      }, { reviewAware: true });
      return result.status === 'failed' && failureCode ? { ...result, code: failureCode } : result;
    }
    const corpus = await validatePrivateCorpus(path.join(store, 'corpus.json'), { reviewAware: true });
    const sidecar = await readEnrichmentSnapshot(store, corpus);
    await verifyDirectory();
    if (command === 'status') return { status: 'succeeded', summary: stageStatus(corpus, caseId) };
    if (command === 'prepare') {
      request = prepareStage(corpus, { caseId, kind, inputKeys, revisionIds, requestedModel }, sidecar.annotations);
      if (outputFile) await privateOutput(outputFile, request);
      return { status: 'succeeded', request };
    }
    const run = validateStageCandidate(corpus, request, candidate, sidecar.annotations);
    return { status: 'succeeded', runId: run.id, validationHash: digest({ request, candidate }),
      summary: { kind: run.stage.kind, processing: run.stage.processing, pending: true } };
  } catch (error) {
    return { status: 'failed', code: error.code ?? 'INVALID_STAGE' };
  }
}
