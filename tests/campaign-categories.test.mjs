import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyCampaignCategories, proposeCampaignCategories, campaignCategoryGroups } from '../src/campaign-categories.mjs';
import { assertValid, sha256, canonicalSerialize, profileRecords } from '../scripts/contract.mjs';
import { applyExtraction } from '../scripts/extract.mjs';
import { appendOutputs } from '../src/campaign.mjs';
import { applyItemReview, reviewSnapshot } from '../src/hitl.mjs';
import { GUIDE_VERSION, GUIDE_VERSIONS, checksFor, priorityCategory } from '../src/review-guide.mjs';
import { createModel, applyReviewProjection, recordContext, filterRecords } from '../src/model.mjs';

const baseline = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
const victim = 'The malicious payload attempted to invoke authenticated Claude for victim reconnaissance.';
function fixture(description = victim, evidenceStatus = 'Attempted behavior') {
  const c = structuredClone(baseline);
  c.categorizations = [];
  c.claims[0].description = description; c.claims[0].evidenceStatus = evidenceStatus;
  const revision = c.sourceRevisions[0];
  revision.rawContent = revision.normalizedContent = description;
  revision.rawHash = revision.normalizedHash = sha256(description);
  Object.assign(c.passages[0], { text: description, start: 0, end: [...description].length });
  assertValid(c);
  return c;
}
const values = c => proposeCampaignCategories(c, [c.claims[0].id]).map(c => c.value);
function decide(c, itemKey, action = 'accept', extra = {}) {
  return applyItemReview(c, { snapshot: reviewSnapshot(c).snapshot, itemKey, action,
    reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION,
    rationale: 'Synthetic test-only decision, not incident review.',
    ...(action === 'accept' ? { checks: Object.fromEntries(Object.keys(checksFor(itemKey.split(':')[0])).map(k => [k, { result: 'pass' }])) } : {}),
    ...(action === 'exclude' ? { exclusionReason: 'unsupported' } : {}), ...extra });
}

for (const [description, expected] of [
  [victim, ['Victim-side agent abuse']],
  ['The malicious script attempted to invoke victim Claude, which refused the request.', ['Victim-side agent abuse']],
  ['Attackers used their own AI to generate a phishing message.', ['Attacker-side AI use']],
  ['Threat actors used Claude to write deceptive messages.', ['Attacker-side AI use']],
  ['Attackers used their own AI to automate reconnaissance of local files.', ['Attacker-side AI use']],
  ['Malicious prompt injection attempted to bypass an AI code reviewer.', ['AI review targeting']],
  ['A fake recruiter lured developers into running a malicious coding task.', ['Developer-targeted social engineering']],
  [`${victim} Attackers used their own AI to generate a phishing message.`, ['Victim-side agent abuse', 'Attacker-side AI use']],
]) test(`#89 AC-06 deterministic positive: ${expected.join(' + ')}`, () => {
  const c = fixture(description);
  assert.deepEqual(new Set(values(c)), new Set(expected));
  applyCampaignCategories(c, [c.claims[0].id]); assertValid(c);
  for (const category of c.categorizations) {
    assert.equal(category.origin, 'Deterministic rule'); assert.equal(category.disposition, 'Pending');
    assert.deepEqual(category.sourceIds, [c.claims[0].sourceId]);
    assert.deepEqual(category.supportingClaimIds, [c.claims[0].id]);
    assert.deepEqual(category.history, []);
  }
});

for (const description of [
  'No attacker used their own AI to generate a message.',
  'The attacker did not invoke the victim local AI agent.',
  'Researchers recommend invoking a local AI agent for investigation.',
  'A local Claude session would support reconnaissance.',
  'The attacker used the victim local AI agent to generate text.',
  'A payload uses Claude for reconnaissance.', // Environment/operating side unspecified.
  'AI-generated malware was discovered.', // AI operator unspecified.
  'An AI code reviewer inspected a benign task.',
  'Developers cloned a legitimate coding challenge.',
  'The interview article mentioned an AI reviewer. A malicious script ran elsewhere.',
  'Local Claude was available. A malicious prompt was mentioned separately.',
]) test(`#89 AC-06 abstains rather than inventing a role: ${description}`, () => {
  assert.deepEqual(values(fixture(description)), []);
});

test('#89 AC-06 uncertain/inferred/excluded/unlinked inputs never become automatic categories or no-AI labels', () => {
  for (const status of ['Potential consequence', 'Unclear or disputed']) assert.deepEqual(values(fixture(victim, status)), []);
  for (const change of [
    c => { c.claims[0].inference = { supportingClaimIds: ['synthetic-claim-b'] }; },
    c => { c.claims[0].disposition = 'Excluded'; },
    c => { c.claims[0].disposition = 'Needs correction'; },
    c => { c.sourceRevisions[0].sourceId = 'synthetic-source-b'; },
    c => { c.claims[0].passageIds = []; },
    c => { c.cases[0].sourceIds = ['synthetic-source-b']; },
  ]) {
    const c = fixture(); change(c); assert.deepEqual(values(c), []);
  }
});

test('#89 AC-06 idempotent proposals retain source-local identities and never rewrite existing corrections/history', () => {
  const c = fixture(), before = canonicalSerialize(c.claims);
  const ids = applyCampaignCategories(c, [c.claims[0].id]);
  assert.equal(ids.length, 1);
  assert.deepEqual(applyCampaignCategories(c, [c.claims[0].id]), []);
  assert.equal(canonicalSerialize(c.claims), before);
  c.categorizations[0].value = 'Unclear';
  c.categorizations[0].history = ['synthetic-original-review'];
  const corrected = canonicalSerialize(c.categorizations);
  applyCampaignCategories(c, [c.claims[0].id]);
  assert.equal(canonicalSerialize(c.categorizations), corrected);
  c.categorizations[0].sourceIds = ['synthetic-source-b'];
  assert.throws(() => applyCampaignCategories(c, [c.claims[0].id]), /identity collision/);
});

test('#89 AC-06 manual and campaign/staged output application persist the same reviewable deterministic proposals', () => {
  const manual = fixture(), claim = manual.claims[0], text = claim.description;
  const template = { schemaVersion: 'manual-extraction/1', claims: [{
    id: 'synthetic-new-claim', caseId: claim.caseId, sourceId: claim.sourceId,
    sourceRevisionId: claim.sourceRevisionId, revisionHash: manual.sourceRevisions[0].normalizedHash,
    description: text, evidenceStatus: claim.evidenceStatus, origin: 'Human source paraphrase',
    passages: [{ id: 'synthetic-new-passage', locator: 'Synthetic full sentence', start: 0, end: [...text].length, text }],
  }] };
  applyExtraction(manual, template, 'synthetic-author', JSON.stringify(template));
  const expected = manual.categorizations.find(c => c.supportingClaimIds.includes('synthetic-new-claim'));
  assert.ok(expected); assertValid(manual);
  const count = manual.categorizations.length;
  applyExtraction(manual, template, 'synthetic-author', JSON.stringify(template));
  assert.equal(manual.categorizations.length, count);
  const staged = fixture();
  appendOutputs(staged, [structuredClone(claim)], [], { id: 'synthetic-run', records: {} });
  assert.ok(staged.categorizations.some(c => c.supportingClaimIds.includes(claim.id)));
});

test('#89 AC-06 category HITL supports separate correction/acceptance, defer, exclusion and support-change invalidation', () => {
  const c = fixture(), [id] = applyCampaignCategories(c, [c.claims[0].id]), key = `categorizations:${id}`;
  const unit = () => reviewSnapshot(c).units.find(u => u.itemKey === key);
  assert.equal(priorityCategory(unit()), 'campaigns'); assert.equal(unit().labelAuthorship, 'Rule-derived');
  assert.equal(unit().eligible, false);
  assert.throws(() => decide(c, key), /BLOCKED_REVIEW/);
  decide(c, `claims:${c.claims[0].id}`);
  decide(c, key, 'unsure'); assert.equal(unit().state, 'Unsure');
  decide(c, key, 'modify', { patch: { value: 'AI review targeting' } });
  assert.equal(unit().state, 'Blocked/support changed'); assert.equal(unit().eligible, false);
  assert.equal(unit().labelAuthorship, 'Human-edited');
  decide(c, key); assert.equal(unit().state, 'Accepted');
  assert.equal(c.categorizations[0].value, 'Victim-side agent abuse'); // Original proposal survives the overlay.
  const projected = applyReviewProjection({ ...createModel(c), itemReview: reviewSnapshot(c) });
  assert.equal(projected.corpus.categorizations[0].value, 'AI review targeting');
  assert.equal(projected.corpus.categorizations[0].disposition, 'Accepted');
  decide(c, `claims:${c.claims[0].id}`, 'modify', { patch: { description: `${victim} Corrected synthetic context.` } });
  assert.equal(unit().state, 'Blocked/support changed'); assert.equal(unit().eligible, false);
  decide(c, key, 'exclude'); assert.equal(unit().state, 'Excluded');
  const excluded = applyReviewProjection({ ...createModel(c), itemReview: reviewSnapshot(c) });
  assert.equal(campaignCategoryGroups(excluded.corpus, c.cases[0].id).length, 0);
  assert.ok(GUIDE_VERSIONS.includes('researcher-review/2'));
  assert.ok(!profileRecords(c).records.some(r => r.entityType === 'categorizations'));
});

test('#89 AC-06 categories deduplicate badges, preserve independent sources and filter only supported source/claim occurrences', () => {
  const c = fixture(), ids = applyCampaignCategories(c, [c.claims[0].id]);
  c.categorizations.push({ ...structuredClone(c.categorizations[0]), id: 'synthetic-second-category' });
  assert.equal(campaignCategoryGroups(c, c.cases[0].id).length, 1);
  assert.equal(campaignCategoryGroups(c, c.cases[0].id)[0].records.length, 2);
  const model = createModel(c), selected = { campaignCategories: ['Victim-side agent abuse'] };
  assert.deepEqual(filterRecords(model, 'cases', selected).map(c => c.id), [c.cases[0].id]);
  assert.deepEqual(filterRecords(model, 'sources', selected).map(c => c.id), [c.sources[0].id]);
  assert.deepEqual(filterRecords(model, 'claims', selected).map(c => c.id), [c.claims[0].id]);
  assert.deepEqual(recordContext(model, 'cases', c.cases[1]).campaignCategories, []);
  c.categorizations.find(c => c.id === ids[0]).disposition = 'Excluded';
  c.categorizations[1].disposition = 'Excluded';
  assert.deepEqual(filterRecords(model, 'cases', selected), []);
});
