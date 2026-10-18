import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalSerialize, digest } from '../scripts/contract.mjs';
import { applyStage, prepareStage, stageStatus, validateStageCandidate } from '../src/stages.mjs';
import { STAGE_CANDIDATE, STAGE_LIMITS, stageSize, assertStageHistory } from '../src/stage-contract.mjs';
import { applyItemReview, reviewSnapshot, reviewedProfile, progressSummary } from '../src/hitl.mjs';
import { checksFor, GUIDE_VERSION } from '../src/review-guide.mjs';
import { validateCampaignSnapshot } from '../src/campaign.mjs';

const fixture = async () => JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
export function stageCandidate(request) {
  return { schemaVersion: STAGE_CANDIDATE, requestHash: request.requestHash, kind: request.kind,
    model: { effectiveModel: null, version: null, nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
    processing: (request.kind === 'ground' ? request.inputs.flatMap(i => i.segments.map(s => s.id))
      : request.upstream.map(i => i.itemKey)).map(inputId => ({ inputId, status: 'completed', reason: null })),
    outputs: Object.fromEntries(request.allowedOutputs.map(k => [k, []])), limitations: ['Synthetic only.'] };
}
function grounded(request) {
  const candidate = stageCandidate(request);
  candidate.outputs.claims = [{ id: 'cafe', sourceRevisionId: 'synthetic-revision-a',
    description: 'A synthetic Café tool literal.', evidenceStatus: 'Source-reported observation',
    passages: [{ segmentId: request.inputs.find(i => i.sourceRevisionId === 'synthetic-revision-a').segments[0].id, quote: 'Café' }],
    supportingClaimIds: [], rationale: null, conflictsWith: [], uncertainty: null, observationContext: null,
    nullReasons: { rationale: 'not_applicable', uncertainty: 'not_reported', observationContext: 'not_reported' } }];
  candidate.outputs.artifacts = [{ kind: 'ide-cli', literal: 'Café', usage: 'vendor-example', supportingClaimIds: ['cafe'] }];
  return candidate;
}
function decide(corpus, itemKey, action = 'accept', extra = {}) {
  const unit = reviewSnapshot(corpus).units.find(u => u.itemKey === itemKey);
  return applyItemReview(corpus, { snapshot: reviewSnapshot(corpus).snapshot, itemKey, action,
    reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION, rationale: 'Synthetic check.',
    ...(action === 'accept' ? { checks: Object.fromEntries(Object.keys(checksFor(unit.type)).map(k => [k, { result: 'pass' }])) } : {}),
    ...extra });
}
async function pipeline() {
  const corpus = await fixture();
  const ground = prepareStage(corpus, { kind: 'ground', caseId: 'synthetic-case-a' });
  const candidate = grounded(ground);
  const groundRun = validateStageCandidate(corpus, ground, candidate);
  applyStage(corpus, ground, candidate);
  const literal = `annotations:${groundRun.annotations[0].id}`;
  const interpret = prepareStage(corpus, { kind: 'interpret', caseId: 'synthetic-case-a', inputKeys: [literal] });
  const behavior = stageCandidate(interpret);
  behavior.outputs.behaviors = [{ localId: 'b', name: 'Synthetic behavior', boundary: 'Benign exercise only.',
    description: 'A benign source-local action.', supportingClaimIds: groundRun.claimIds }];
  const behaviorRun = validateStageCandidate(corpus, interpret, behavior);
  applyStage(corpus, interpret, behavior);
  return { corpus, ground, candidate, groundRun, literal, interpret, behavior, behaviorRun };
}

test('#85 AC-01/02 source-local stage rejects inference, unknown/nested groups, bad evidence and wrong versions', async () => {
  const corpus = await fixture(), request = prepareStage(corpus, { kind: 'ground', caseId: 'synthetic-case-a' });
  const before = digest(corpus);
  for (const mutate of [
    c => { c.outputs.behaviors = []; },
    c => { c.outputs.claims[0].evidenceStatus = 'Researcher inference'; },
    c => { c.outputs.claims[0].passages[0].quote = 'invented'; },
    c => { c.outputs.artifacts[0].kind = 'domain'; },
    c => { c.outputs.claims[0].behaviors = []; },
    c => { c.schemaVersion = 'campaign-candidate/1'; },
  ]) {
    const c = grounded(request); mutate(c);
    assert.throws(() => validateStageCandidate(corpus, request, c));
    assert.equal(digest(corpus), before);
  }
});

test('#85 AC-01/04 ground stage freezes provenance, canonical evidence, original candidate and replay identity', async () => {
  const corpus = await fixture(), request = prepareStage(corpus, { kind: 'ground', caseId: 'synthetic-case-a' });
  const c = grounded(request), run = validateStageCandidate(corpus, request, c);
  assert.deepEqual(run.stage.candidate, c);
  assert.equal(run.schemaVersion, 'campaign-stage-run/1');
  assert.equal(run.passageSnapshots[0].start, 2);
  assert.equal(run.passageSnapshots[0].end, 6);
  assert.equal(run.disposition, 'Pending');
  applyStage(corpus, request, c);
  const before = canonicalSerialize(corpus);
  assert.equal(applyStage(corpus, request, c).replay, true);
  assert.equal(canonicalSerialize(corpus), before);
  validateCampaignSnapshot(corpus);
  const tampered = structuredClone(corpus);
  tampered.governance.campaignExtraction.runs[0].stage.candidate.outputs.claims[0].description = 'changed';
  assert.throws(() => reviewSnapshot(tampered));
});

test('#85 AC-02/03 grounded Pending inputs feed behavior but claims and tool usage need independent acceptance', async () => {
  const { corpus, groundRun, literal, behaviorRun } = await pipeline();
  const key = `behaviors:${behaviorRun.records.behaviors[0].id}`;
  assert.throws(() => decide(corpus, key), { code: 'BLOCKED_REVIEW' });
  decide(corpus, `claims:${groundRun.claimIds[0]}`);
  assert.throws(() => decide(corpus, key), { code: 'BLOCKED_REVIEW' });
  decide(corpus, literal);
  decide(corpus, key);
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === key).eligible, true);
  assert.equal(reviewSnapshot(corpus).units.find(u => u.type === 'occurrences').eligible, false);
  assert.equal(reviewedProfile(corpus).records.some(r => r.entityType === 'behaviors'), true);
});

test('#85 AC-02/03 relate resolves only selected upstream behavior and independently supported mappings/edges', async () => {
  const { corpus, groundRun, behaviorRun } = await pipeline();
  const behaviorId = behaviorRun.records.behaviors[0].id;
  const request = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'relate', inputKeys: [`behaviors:${behaviorId}`] });
  const candidate = stageCandidate(request);
  candidate.outputs.paths = [{ localId: 'path', scope: 'representative', supportingClaimIds: groundRun.claimIds,
    nodes: ['a', 'b'].map(localId => ({ localId, title: localId, detail: 'Synthetic action.',
      behaviorIds: [behaviorId], supportingClaimIds: groundRun.claimIds, evidenceStatus: 'Attempted behavior' })),
    edges: [{ localId: 'edge', from: 'a', to: 'b', supportingClaimIds: groundRun.claimIds,
      relation: 'conditional', basis: 'Synthetic conditional support.', evidenceBasis: 'source-supported' }] }];
  candidate.outputs.mappings = [{ localId: 'map', behaviorId, framework: 'ATT&CK', version: '19.2',
    techniqueId: 'T1059', rationale: 'Synthetic analogy, not deployment.', applicability: 'Synthetic only.',
    supportingClaimIds: groundRun.claimIds, mappingBasis: 'researcher-proposed', pathId: 'path', nodeId: 'a' }];
  const run = validateStageCandidate(corpus, request, candidate);
  applyStage(corpus, request, candidate);
  validateCampaignSnapshot(corpus);
  assert.equal(run.records.paths.length, 1);
  assert.equal(run.records.mappings.length, 1);
  assert.equal(reviewedProfile(corpus).records.some(r => r.entityType === 'paths'), false);
  const stagedKeys = new Set(reviewSnapshot(corpus).units.filter(u =>
    u.runMetadata.some(r => [groundRun.id, behaviorRun.id, run.id].includes(r.id))).map(u => u.itemKey));
  while ([...stagedKeys].some(key => !reviewSnapshot(corpus).units.find(u => u.itemKey === key).eligible)) {
    const available = reviewSnapshot(corpus).units.find(u => stagedKeys.has(u.itemKey) && !u.eligible
      && u.blockers.length === 0);
    assert.ok(available, 'The staged dependency closure must admit individual topological review.');
    decide(corpus, available.itemKey);
  }
  assert.equal(reviewedProfile(corpus).records.some(r => r.entityType === 'paths'), true);
  assert.equal(reviewedProfile(corpus).records.some(r => r.entityType === 'mappings'), true);
  const invalid = structuredClone(candidate);
  invalid.outputs.paths[0].nodes[0].behaviorIds = ['not-selected'];
  const fresh = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'relate', inputKeys: [`behaviors:${behaviorId}`] });
  invalid.requestHash = fresh.requestHash;
  assert.throws(() => validateStageCandidate(corpus, fresh, invalid));
  const occurrence = reviewSnapshot(corpus).units.find(u => u.type === 'occurrences'
    && u.parent.id === behaviorId);
  assert.ok(request.upstream.some(i => i.itemKey === occurrence.itemKey));
  decide(corpus, occurrence.itemKey, 'provenance', { contentOrigin: 'LLM source paraphrase',
    labelAuthorship: 'LLM-derived', provenanceEvidence: 'Synthetic occurrence provenance correction.' });
  assert.equal(reviewedProfile(corpus).records.some(r => r.entityType === 'paths'), false);
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === `behaviors:${behaviorId}`).eligible, true);
});

test('#85 AC-01 exact string/array/byte bounds reject N+1 without weakening N', () => {
  assert.doesNotThrow(() => stageSize('x'.repeat(STAGE_LIMITS.text)));
  assert.throws(() => stageSize('x'.repeat(STAGE_LIMITS.text + 1)), { code: 'STAGE_LIMIT' });
  assert.doesNotThrow(() => stageSize(Array(STAGE_LIMITS.items).fill(null)));
  assert.throws(() => stageSize(Array(STAGE_LIMITS.items + 1).fill(null)), { code: 'STAGE_LIMIT' });
  const payload = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`field${i}`, 'x'.repeat(65000)]));
  assert.doesNotThrow(() => stageSize(payload));
  payload.extra = 'x'.repeat(20000);
  assert.throws(() => stageSize(payload), { code: 'TOO_LARGE' });
});

test('#85 AC-04 stage history rejects replacement/removal and changed-response application requires a fresh base', async () => {
  const { corpus, ground, candidate, groundRun } = await pipeline();
  const before = structuredClone(corpus.governance);
  const changed = structuredClone(candidate); changed.limitations.push('Different response.');
  assert.throws(() => applyStage(corpus, ground, changed), { code: 'STALE_INPUT' });
  const rewritten = structuredClone(before);
  rewritten.campaignExtraction.runs.find(r => r.id === groundRun.id).limitations.push('Rewritten');
  assert.throws(() => assertStageHistory(before, rewritten), { code: 'STAGE_HISTORY_REWRITE' });
  const removed = structuredClone(before); removed.campaignExtraction.runs.shift();
  assert.throws(() => assertStageHistory(before, removed), { code: 'STAGE_HISTORY_REWRITE' });
  assert.doesNotThrow(() => assertStageHistory(before, corpus.governance));
});

test('#85 AC-03/05 changes outside the selected cohort do not invalidate unchanged effective inputs', async () => {
  const { corpus, groundRun, literal, behaviorRun } = await pipeline();
  const key = `behaviors:${behaviorRun.records.behaviors[0].id}`;
  decide(corpus, `claims:${groundRun.claimIds[0]}`);
  decide(corpus, literal);
  decide(corpus, key);
  decide(corpus, 'claims:synthetic-claim-b', 'modify', { patch: { description: 'Unrelated synthetic correction.' } });
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === key).eligible, true);
});

test('#85 AC-04/05 effective correction before prepare is frozen, later corrections require regeneration', async () => {
  const { corpus, literal, behaviorRun } = await pipeline();
  const behaviorKey = `behaviors:${behaviorRun.records.behaviors[0].id}`;
  const prior = canonicalSerialize(corpus.governance.campaignExtraction.runs);
  decide(corpus, literal, 'modify', { patch: { normalizedValue: 'Human corrected display' } });
  assert.match(reviewSnapshot(corpus).units.find(u => u.itemKey === behaviorKey).blockers.map(b => b.reason).join(' '), /Frozen stage input changed/);
  const request = prepareStage(corpus, { kind: 'interpret', caseId: 'synthetic-case-a', inputKeys: [literal] });
  assert.equal(request.upstream.find(i => i.itemKey === literal).record.normalizedValue, 'Human corrected display');
  assert.equal(canonicalSerialize(corpus.governance.campaignExtraction.runs), prior);
  decide(corpus, literal, 'modify', { patch: { normalizedValue: 'Another correction' } });
  assert.throws(() => validateStageCandidate(corpus, request, stageCandidate(request)), { code: 'STALE_INPUT' });
});

test('#85 AC-03/04 exclusion and provenance changes retain history; rerun records do not inherit decisions', async () => {
  const { corpus, groundRun, literal, behaviorRun } = await pipeline();
  decide(corpus, `claims:${groundRun.claimIds[0]}`);
  decide(corpus, literal);
  const key = `behaviors:${behaviorRun.records.behaviors[0].id}`;
  decide(corpus, key);
  decide(corpus, literal, 'provenance', { contentOrigin: 'LLM source paraphrase', labelAuthorship: 'LLM-derived',
    provenanceEvidence: 'Synthetic recorded author correction.' });
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === key).eligible, false);
  decide(corpus, literal, 'exclude', { exclusionReason: 'unsupported' });
  assert.throws(() => prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'interpret', inputKeys: [literal] }));
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === literal).history.length, 3);
  const request = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'ground' }), c = grounded(request);
  const result = applyStage(corpus, request, c);
  assert.notEqual(result.runId, groundRun.id);
  const newRun = corpus.governance.campaignExtraction.runs.at(-1);
  assert.notEqual(newRun.claimIds[0], groundRun.claimIds[0]);
  assert.equal(reviewSnapshot(corpus).units.find(u => u.itemKey === `claims:${newRun.claimIds[0]}`).history.length, 0);
});

test('#85 AC-05/06/07 skipped/failed/empty stages have honest denominators and no reviewed output', async () => {
  const corpus = await fixture(), request = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'ground' });
  const c = stageCandidate(request);
  c.processing.forEach((i, n) => { i.status = n ? 'failed' : 'skipped'; i.reason = 'Synthetic interruption.'; });
  applyStage(corpus, request, c);
  assert.equal(stageStatus(corpus).runs[0].state, 'failed');
  const snapshot = reviewSnapshot(corpus), progress = progressSummary(corpus, snapshot, 'synthetic-case-a');
  assert.equal(progress.stages[0].completed, 0);
  assert.equal(progress.extraction.completed, 0);
  assert.equal(reviewedProfile(corpus).records.length, 0);
  const derivation = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'interpret', inputKeys: ['claims:synthetic-claim-a'] });
  const candidate = stageCandidate(derivation);
  candidate.processing[0].status = 'failed'; candidate.processing[0].reason = 'No output.';
  candidate.outputs.behaviors = [{ localId: 'bad', name: 'bad', boundary: 'bad', description: 'bad',
    supportingClaimIds: ['synthetic-claim-a'] }];
  assert.throws(() => validateStageCandidate(corpus, derivation, candidate), { code: 'UNPROCESSED_SUPPORT' });
});

test('#85 AC-01/02/05 rejects oversize units, absent/wrong-case supports and changed request bindings', async () => {
  const corpus = await fixture();
  assert.throws(() => prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'interpret', inputKeys: ['claims:synthetic-claim-c'] }));
  assert.throws(() => prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'interpret', inputKeys: Array(1001).fill('x') }));
  const request = prepareStage(corpus, { caseId: 'synthetic-case-a', kind: 'interpret', inputKeys: ['claims:synthetic-claim-a'] });
  const candidate = stageCandidate(request);
  candidate.outputs.behaviors = [{ localId: 'bad', name: 'bad', boundary: 'bad', description: 'bad',
    supportingClaimIds: ['synthetic-claim-b'] }];
  assert.throws(() => validateStageCandidate(corpus, request, candidate));
  const tampered = structuredClone(request); tampered.upstream[0].record.description = 'tampered';
  const { requestHash, ...body } = tampered; tampered.requestHash = digest(body);
  assert.throws(() => validateStageCandidate(corpus, tampered, stageCandidate(tampered)), { code: 'STALE_STAGE_INPUT' });
});
