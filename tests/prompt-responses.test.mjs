import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertValid, digest, sha256 } from '../scripts/contract.mjs';
import { validateEnrichment } from '../src/enrichment.mjs';
import { RESPONSE_VERSION, validatePromptResponses } from '../src/prompt-responses.mjs';
import { applyItemReview, reviewSnapshot, reviewedProfile } from '../src/hitl.mjs';
import { GUIDE_VERSION, confirmationFor } from '../src/review-guide.mjs';
import { createModel } from '../src/model.mjs';
import { aiLibrary } from '../src/ai-library.mjs';

const baseline = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
export function responseFixture() {
  const corpus = structuredClone(baseline), revision = corpus.sourceRevisions[0], claim = corpus.claims[0];
  const prompt = 'A harmless synthetic request.', context = 'Researchers reviewed logs; the environment was unspecified.';
  const decoded = 'Synthetic refusal.\nNo task was executed. \u{1F9EA}', raw = JSON.stringify(decoded);
  const text = `${context}\n${prompt}\n${raw}`;
  revision.rawContent = revision.normalizedContent = text;
  revision.rawHash = revision.normalizedHash = sha256(text);
  const receipt = literal => {
    const start = [...text.slice(0, text.indexOf(literal))].length;
    return { locator: { start, end: start + [...literal].length }, sha256: sha256(literal) };
  };
  const promptSupport = receipt(prompt), responseSupport = receipt(raw);
  Object.assign(corpus.passages[0], { text: prompt, start: promptSupport.locator.start, end: promptSupport.locator.end });
  const responsePassage = { ...structuredClone(corpus.passages[0]), id: 'synthetic-response-passage',
    start: responseSupport.locator.start + 1, end: responseSupport.locator.start + 19, text: 'Synthetic refusal.' };
  corpus.passages.push(responsePassage);
  const responseClaim = { ...structuredClone(claim), id: 'synthetic-response-claim',
    description: 'Synthetic source reports a refusal; not incident evidence.', passageIds: [responsePassage.id], conflictsWith: [] };
  corpus.claims.push(responseClaim);
  const annotation = {
    id: 'synthetic-prompt-response', caseId: claim.caseId, sourceId: claim.sourceId, sourceRevisionId: claim.sourceRevisionId,
    type: 'commands-ai-artifacts', value: prompt, claimIds: [claim.id], origin: 'manual', status: 'pending',
    evidenceStatus: 'evidence-backed', support: { quote: prompt, locator: promptSupport.locator },
    context: { artifactKind: 'prompt-instruction', artifactUsage: 'vendor-example', observationContext: 'reported-log-review' },
    responses: [{ schemaVersion: RESPONSE_VERSION, id: 'synthetic-response', text: decoded,
      encoding: 'json-string', role: 'unspecified', agent: 'Synthetic test agent', model: 'unknown', outcome: 'refusal',
      observationContext: 'reported-log-review', contextBasis: 'Log review does not identify the host environment.',
      pairingBasis: 'Adjacent published exchange in the synthetic fixture.', revisionHash: revision.normalizedHash,
      claimIds: [responseClaim.id], support: responseSupport, contextSupport: receipt(context) }],
  };
  assertValid(corpus);
  return { corpus, annotation, revision, claim, responseClaim };
}
const validate = ({ corpus, annotation }) => {
  const { claimIds, ...item } = annotation;
  return validateEnrichment({ schemaVersion: 'talk-enrichment/1', annotations: [item] }, corpus);
};

test('#89 AC-08 exact JSON response and separate context receipts resolve without expanding an existing claim passage', () => {
  const fixture = responseFixture(), response = fixture.annotation.responses[0];
  assert.deepEqual(validate(fixture), []);
  assert.ok(response.support.locator.end > fixture.corpus.passages.find(p => p.id === 'synthetic-response-passage').end);
  assert.ok(response.text.includes('\n')); assert.ok(!response.text.includes('\\n'));
  assert.equal(response.role, 'unspecified'); assert.equal(response.model, 'unknown');
  assert.equal(response.observationContext, 'reported-log-review');
});

for (const [name, mutate] of [
  ['changed decoded text', f => { f.annotation.responses[0].text = 'Invented success'; }],
  ['changed receipt hash', f => { f.annotation.responses[0].support.sha256 = '0'.repeat(64); }],
  ['wrong normalized revision', f => { f.annotation.responses[0].revisionHash = '0'.repeat(64); }],
  ['unlinked claim', f => { f.annotation.responses[0].claimIds = [f.corpus.claims[1].id]; }],
  ['out-of-range support', f => { f.annotation.responses[0].support.locator.end = 100000; }],
  ['duplicate response identity', f => { f.annotation.responses.push(structuredClone(f.annotation.responses[0])); }],
  ['unpaired prompt literal', f => { f.annotation.value = 'Different prompt'; }],
  ['missing parent support', f => { delete f.annotation.support; }],
  ['unknown outcome enum', f => { f.annotation.responses[0].outcome = 'proven-compromise'; }],
  ['incorrect encoding', f => { f.annotation.responses[0].encoding = 'plain-text'; }],
  ['non-prompt attachment', f => { f.annotation.context.artifactKind = 'ide-cli'; }],
]) test(`#89 AC-08 rejects ${name}`, () => {
  const fixture = responseFixture(); mutate(fixture); assert.ok(validate(fixture).length);
});

test('#89 AC-08 response metadata never creates a separate prompt group or propagates across occurrences', () => {
  const f = responseFixture(), other = { ...structuredClone(f.annotation), id: 'synthetic-other-occurrence' };
  delete other.responses;
  const model = { ...createModel(f.corpus), annotations: [f.annotation, other] };
  const groups = aiLibrary(model, 'prompts');
  assert.equal(groups.length, 1); assert.equal(groups[0].annotations.length, 2);
  assert.equal(groups[0].annotations[0].responses.length, 1); assert.equal(groups[0].annotations[1].responses, undefined);
  f.annotation.responses[0].text = null; assert.deepEqual(validate(f), []);
  const projected = structuredClone(f.corpus); projected.sourceRevisions[0].normalizedContent = null;
  assert.deepEqual(validatePromptResponses(f.annotation, projected, { publicProjection: true }), []);
  assert.ok(validatePromptResponses(f.annotation, projected).length);
});

test('#89 AC-08 joint prompt review depends on response claims; corrections are separate and structural support cannot be reassigned', () => {
  const f = responseFixture(), annotations = [f.annotation], key = `annotations:${f.annotation.id}`;
  const state = () => reviewSnapshot(f.corpus, annotations), unit = () => state().units.find(u => u.itemKey === key);
  const decide = (itemKey, action = 'accept', extra = {}) => {
    const snapshot = state(), target = snapshot.units.find(u => u.itemKey === itemKey);
    return applyItemReview(f.corpus, { snapshot: snapshot.snapshot, itemKey, action,
      reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION,
      ...(action === 'accept' ? { confirmation: confirmationFor(target) } : {}), ...extra }, annotations);
  };
  assert.ok(unit().dependencies.includes(`claims:${f.responseClaim.id}`));
  decide(`claims:${f.claim.id}`); assert.equal(unit().eligible, false);
  decide(`claims:${f.responseClaim.id}`); assert.deepEqual(unit().blockers, []);
  decide(key); assert.equal(unit().state, 'Accepted');
  const responses = structuredClone(f.annotation.responses); responses[0].outcome = 'unknown';
  decide(key, 'modify', { patch: { responses }, rationale: 'Synthetic conservative correction.' });
  assert.equal(unit().state, 'Blocked/support changed'); decide(key); assert.equal(unit().state, 'Accepted');
  const reassigned = structuredClone(responses); reassigned[0].claimIds = [f.claim.id];
  assert.throws(() => decide(key, 'modify', { patch: { responses: reassigned }, rationale: 'Synthetic attempted reassignment.' }), /INVALID_CORRECTION/);
  f.responseClaim.description += ' Changed support.';
  assert.notEqual(unit().state, 'Accepted');
  assert.equal(f.annotation.responses[0].outcome, 'refusal');
});

test('#89 AC-08 accepted-profile privacy remains content-omitting for prompt and response literals', () => {
  const f = responseFixture(), state = () => reviewSnapshot(f.corpus, [f.annotation]);
  for (const itemKey of [`claims:${f.claim.id}`, `claims:${f.responseClaim.id}`, `annotations:${f.annotation.id}`]) {
    const snapshot = state(), unit = snapshot.units.find(u => u.itemKey === itemKey);
    applyItemReview(f.corpus, { snapshot: snapshot.snapshot, itemKey, action: 'accept',
      reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION, confirmation: confirmationFor(unit) }, [f.annotation]);
  }
  const profile = JSON.stringify(reviewedProfile(f.corpus, [f.annotation], 'reviewed'));
  assert.ok(!profile.includes(JSON.stringify(f.annotation.responses[0].text)));
  assert.ok(!profile.includes('Adjacent published exchange'));
  assert.equal(JSON.parse(profile).records.find(r => r.entityType === 'annotations').entity.responses, undefined);
});

test('#89 AC-08 a modified response/context receipt cannot be freshly accepted', () => {
  const f = responseFixture(); f.annotation.responses[0].contextSupport.sha256 = '0'.repeat(64);
  const snapshot = reviewSnapshot(f.corpus, [f.annotation]);
  const unit = snapshot.units.find(u => u.itemKey === `annotations:${f.annotation.id}`);
  assert.equal(unit.groundingLost, true); assert.equal(unit.structurallyBlocked, true);
  assert.throws(() => applyItemReview(f.corpus, { snapshot: snapshot.snapshot, itemKey: unit.itemKey, action: 'accept',
    reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION, confirmation: confirmationFor(unit) }, [f.annotation]), /BLOCKED_REVIEW/);
});

test('#89 AC-08 historical v3 prompt decisions replay unchanged, but adding a response requires fresh review', () => {
  const f = responseFixture(), responses = f.annotation.responses;
  delete f.annotation.responses; delete f.annotation.context.observationContext;
  const snapshot = () => reviewSnapshot(f.corpus, [f.annotation]);
  for (const key of [`claims:${f.claim.id}`, `annotations:${f.annotation.id}`]) {
    const state = snapshot(), unit = state.units.find(u => u.itemKey === key);
    applyItemReview(f.corpus, { snapshot: state.snapshot, itemKey: key, action: 'accept', reviewer: 'synthetic-human',
      selfAttested: true, guideVersion: GUIDE_VERSION, confirmation: confirmationFor(unit) }, [f.annotation]);
  }
  // Reconstitute a synthetic historical v3 log; no real human decisions are modified.
  let previous = null;
  for (const event of f.corpus.governance.localReview.events) {
    event.guideVersion = 'researcher-review/3'; event.previous = previous;
    if (event.itemKey.startsWith('annotations:')) event.confirmation = 'I personally checked evidence, fidelity and scope. The prompt literal is exact and its usage/context are supported. Reported is not confirmed; attempted is not successful.';
    const { eventHash, ...body } = event; event.eventHash = digest(body); previous = event.eventHash;
  }
  const originalLog = JSON.stringify(f.corpus.governance.localReview);
  assert.equal(snapshot().units.find(u => u.itemKey === `annotations:${f.annotation.id}`).state, 'Accepted');
  f.annotation.responses = responses; f.annotation.context.observationContext = 'reported-log-review';
  assert.notEqual(snapshot().units.find(u => u.itemKey === `annotations:${f.annotation.id}`).state, 'Accepted');
  assert.equal(JSON.stringify(f.corpus.governance.localReview), originalLog);
});
