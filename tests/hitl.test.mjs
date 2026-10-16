import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { privateStoreTest } from './platform.mjs';
import { canonicalSerialize, profileRecords, profileFiles, queryProfile, validateProfileRow, stableId, updatePrivateCorpus, digest } from '../scripts/contract.mjs';
import { applyItemReview, reviewSnapshot, progressSummary, runItemReview } from '../src/hitl.mjs';
import { GUIDE_VERSION, checksFor, confirmationFor, TYPE_CHECKS, labelCompleteness } from '../src/review-guide.mjs';
import { reviewGroups, reviewNavigation, reviewSession } from '../src/review-ui.mjs';
import { createModel, applyReviewProjection } from '../src/model.mjs';

const fixture = async () => {
  const c = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
  c.claims[0].origin = 'LLM source paraphrase';
  c.behaviors[0].claimIds = ['synthetic-claim-a'];
  c.behaviors[0].caseId = 'synthetic-case-a';
  c.behaviors[0].occurrences = [{ caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'], origin: 'LLM source paraphrase' }];
  return c;
};
const key = 'claims:synthetic-claim-a';
const input = (c, itemKey = key, action = 'accept', extra = {}, annotations = []) => ({
  snapshot: reviewSnapshot(c, annotations).snapshot, itemKey, action,
  reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION,
  rationale: 'Synthetic reviewer decision; not incident evidence.',
  ...(action === 'accept' ? { checks: Object.fromEntries(Object.keys(checksFor(itemKey.split(':')[0])).map(k => [k, { result: 'pass' }])) } : {}),
  ...(action === 'exclude' ? { exclusionReason: 'insufficient evidence' } : {}), ...extra,
});
const decide = (c, itemKey = key, action = 'accept', extra = {}, annotations = []) =>
  applyItemReview(c, input(c, itemKey, action, extra, annotations), annotations);
const unit = (c, itemKey = key, annotations = []) => reviewSnapshot(c, annotations).units.find(u => u.itemKey === itemKey);
const support = c => { decide(c); decide(c, 'claims:synthetic-claim-b'); };

test('Issue #81 AC-01/05 stable identities span every artifact type and both groupings without merging occurrences', async () => {
  const c = await fixture(), s = reviewSnapshot(c);
  assert.deepEqual([...new Set(s.units.map(u => u.type))].sort(), Object.keys(TYPE_CHECKS).filter(t => t !== 'annotations').sort());
  for (const group of ['blog', 'category']) {
    const view = reviewGroups(s.units, { caseId: 'synthetic-case-a', group });
    assert.equal(new Set(view.records.map(u => u.itemKey)).size, view.records.length);
    assert.deepEqual(new Set([...view.groups.values()].flat().map(u => u.itemKey)), new Set(view.records.map(u => u.itemKey)));
  }
  c.behaviors[0].occurrences.push(structuredClone(c.behaviors[0].occurrences[0]));
  assert.equal(reviewSnapshot(c).units.filter(u => u.type === 'occurrences').length, 2);
});

test('Issue #81 AC-02 exact Unicode grounding, private/unavailable evidence and supporting navigation are honest', async () => {
  const c = await fixture(), u = unit(c);
  assert.equal(u.evidence[0].quote, c.passages[0].text);
  assert.ok(u.evidence[0].context.includes(c.passages[0].text));
  c.sourceRevisions[0].normalizedContent = null;
  const missing = unit(c);
  assert.equal(missing.evidence[0].quote, null);
  assert.match(missing.evidence[0].explanation, /unavailable\/private/);
  assert.equal(missing.state, 'Blocked/support changed');
});

test('Issue #81 AC-03/04/07 checklist, guide, self-attestation, reasons and stale writes are enforced', async () => {
  const c = await fixture();
  for (const extra of [{ checks: {} }, { checks: { evidence: { result: 'suggested-by-LLM' } } }]) {
    assert.throws(() => applyItemReview(c, input(c, key, 'accept', extra)), /CHECKLIST_REQUIRED/);
  }
  assert.throws(() => applyItemReview(c, input(c, key, 'accept', { guideVersion: 'future' })), /INVALID_REVIEW/);
  assert.throws(() => applyItemReview(c, input(c, key, 'accept', { selfAttested: false })), /INVALID_REVIEW/);
  assert.throws(() => applyItemReview(c, input(c, key, 'unsure', { rationale: ' ' })), /REASON_REQUIRED/);
  assert.throws(() => applyItemReview(c, input(c, key, 'exclude', { exclusionReason: 'other', rationale: ' ' })), /REASON_REQUIRED/);
  const checks = input(c).checks; checks.type = { result: 'not-applicable', reason: 'Synthetic documented non-applicability.' };
  const stale = input(c);
  decide(c, key, 'accept', { checks });
  assert.throws(() => applyItemReview(c, stale), /STALE_REVIEW/);
  assert.equal(unit(c).state, 'Accepted');
  assert.equal(unit(c).history[0].guideVersion, GUIDE_VERSION);
  assert.equal(unit(c).history[0].reviewerKind, 'self-attested-human');
});

test('Issue #81 AC-03/12/13 edits retain the original LLM proposal, require acceptance and preserve exclusion history', async () => {
  const c = await fixture(), original = structuredClone(c.claims[0]);
  decide(c);
  decide(c, key, 'modify', { patch: { description: 'Human corrected synthetic claim.' } });
  assert.notEqual(unit(c).state, 'Accepted');
  assert.equal(c.claims[0].description, original.description);
  assert.equal(unit(c).record.description, 'Human corrected synthetic claim.');
  assert.equal(unit(c).editor, 'synthetic-human');
  decide(c);
  assert.equal(unit(c).contentOrigin, 'LLM source paraphrase');
  decide(c, key, 'exclude', { replacementKeys: ['claims:synthetic-claim-b'] });
  const excluded = unit(JSON.parse(canonicalSerialize(c)));
  assert.equal(excluded.state, 'Excluded'); assert.equal(excluded.history.length, 4);
  assert.deepEqual(excluded.history.at(-1).original, original);
  assert.equal(excluded.history.at(-1).exclusionReason, 'insufficient evidence');
  assert.equal(excluded.history.at(-1).replacementKeys[0], 'claims:synthetic-claim-b');
  assert.ok(!profileRecords(c).records.some(r => r.entityType === 'claims'));
});

test('Issue #81 AC-06/13 transitive invalidation, exclusion propagation, unrelated changes and provenance correction', async () => {
  const c = await fixture(); support(c);
  const behavior = 'behaviors:synthetic-behavior', sensor = 'telemetry:synthetic-sensor';
  decide(c, behavior); decide(c, sensor); decide(c, 'claims:synthetic-claim-c');
  decide(c, key, 'provenance', { contentOrigin: 'Human authored', labelAuthorship: 'Human authored',
    provenanceEvidence: 'Synthetic original drafting notes.' });
  for (const k of [key, behavior, sensor]) assert.equal(unit(c, k).eligible, false);
  assert.equal(unit(c, 'claims:synthetic-claim-c').state, 'Accepted');
  decide(c); decide(c, behavior); decide(c, sensor);
  decide(c, key, 'exclude');
  assert.equal(unit(c, sensor).state, 'Blocked/support changed');
  decide(c, key, 'provenance', { contentOrigin: 'LLM source paraphrase', labelAuthorship: 'LLM-derived',
    provenanceEvidence: 'Synthetic recovered model transcript.' });
  assert.equal(unit(c).originalOrigin, 'LLM source paraphrase');
  assert.equal(unit(c).history.at(-1).previousOrigin, 'Human authored');
  c.name += ' Unrelated metadata edit';
  assert.equal(unit(c, 'claims:synthetic-claim-c').state, 'Accepted');
});

test('Issue #81 AC-06 missing/cyclic support and independently supported relationships fail closed', async () => {
  const c = await fixture();
  c.claims[0].inference = { rationale: 'Synthetic cycle.', supportingClaimIds: ['synthetic-claim-b'] };
  c.claims[1].inference = { rationale: 'Synthetic cycle.', supportingClaimIds: ['synthetic-claim-a'] };
  assert.equal(unit(c).eligible, false);
  assert.match(JSON.stringify(reviewSnapshot(c)), /Cyclic required support/);
  c.claims[0].inference.supportingClaimIds = ['missing'];
  assert.match(JSON.stringify(unit(c)), /Missing required support/);
  const d = await fixture(); support(d); decide(d, 'behaviors:synthetic-behavior');
  for (const n of d.paths[0].nodes) decide(d, `nodes:${d.paths[0].id}/${n.id}`);
  assert.equal(unit(d, `edges:${d.paths[0].id}/${d.paths[0].edges[0].id}`).eligible, false);
  assert.equal(unit(d, `paths:${d.paths[0].id}`).eligible, false);
});

for (const type of Object.keys(TYPE_CHECKS).filter(t => t !== 'annotations')) {
  test(`Issue #81 AC-05 ${type} supports item accept/modify/exclude/defer`, async () => {
    const c = await fixture();
    const target = reviewSnapshot(c).units.find(u => u.type === type && (type !== 'timelines' || u.dependencies.length));
    // Fixture-only topological preparation, never production bulk acceptance.
    for (let pass = 0; pass < 8; pass++) {
      const next = reviewSnapshot(c).units.find(u => u.itemKey !== target.itemKey && !u.eligible && !u.blockers.length && u.labels.state === 'complete');
      if (!next) break;
      decide(c, next.itemKey);
      pass--;
    }
    decide(c, target.itemKey);
    const binding = unit(c, target.itemKey).binding;
    decide(c, target.itemKey, 'modify', { patch: {}, researcherTags: ['synthetic-correction'] });
    assert.notEqual(unit(c, target.itemKey).binding, binding);
    assert.equal(unit(c, target.itemKey).eligible, false);
    decide(c, target.itemKey); decide(c, target.itemKey, 'exclude');
    assert.equal(unit(c, target.itemKey).state, 'Excluded');
    decide(c, target.itemKey, 'unsure');
    assert.equal(unit(c, target.itemKey).state, 'Unsure');
    assert.equal(unit(c, target.itemKey).currentHumanReview, false);
  });
}

test('Issue #81 AC-05/08/13 prompt usage, tools, IOCs, roles and all sidecar annotation types are reviewable', async () => {
  const c = await fixture();
  const base = { caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a', sourceRevisionId: 'synthetic-revision-a',
    origin: 'manual', status: 'pending', evidenceStatus: 'evidence-backed',
    support: { quote: c.passages[0].text, locator: { start: c.passages[0].start, end: c.passages[0].end } } };
  const contexts = {
    'role-context': { roles: ['other-unclear'] }, 'observed-behavior': { behavior: 'observed' },
    'data-sources': { collection: 'article-mentioned' }, 'commands-ai-artifacts': { artifactKind: 'prompt-instruction', artifactUsage: 'unclear' },
    'traditional-indicators': { indicatorKind: 'domain' }, 'ttp-references': { mapping: 'source-mentioned' },
    'detection-references': { detection: 'published-reference' }, 'talk-tags': {},
  };
  for (const [type, context] of Object.entries(contexts)) {
    const annotations = [{ ...base, id: `synthetic-${type}`, type, value: c.passages[0].text, context }];
    const itemKey = `annotations:${annotations[0].id}`;
    decide(c, itemKey, 'accept', {}, annotations);
    decide(c, itemKey, 'modify', { patch: { value: c.passages[0].text + ' corrected label' } }, annotations);
    decide(c, itemKey, 'exclude', {}, annotations); decide(c, itemKey, 'unsure', {}, annotations);
    assert.equal(unit(c, itemKey, annotations).state, type === 'commands-ai-artifacts' ? 'Blocked/support changed' : 'Unsure');
    if (type === 'commands-ai-artifacts') assert.match(JSON.stringify(unit(c, itemKey, annotations).blockers), /no longer matches/);
    assert.equal(unit(c, itemKey, annotations).history.at(-1).action, 'unsure');
  }
  assert.equal(labelCompleteness('annotations', { type: 'commands-ai-artifacts', evidenceStatus: 'inference',
    context: { artifactKind: 'prompt-instruction' } }).state, 'incomplete');
  assert.equal(labelCompleteness('occurrences', {}).applicable, false);
});

test('Issue #81 AC-08 navigation reload stores no reviewer identity, evidence or decision', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const nav = { caseId: 'synthetic-case-a', group: 'category', filter: 'Excluded', itemKey: key, type: 'claims', sourceId: '' };
  reviewNavigation(storage, nav); assert.deepEqual(reviewNavigation(storage), nav);
  assert.match(reviewNavigation({ getItem() { throw new Error('Denied'); } }).notice, /could not/);
});

test('Issue #81 AC-09 reviewed export requires item approvals, strips private evidence and is deterministic', async () => {
  const c = await fixture();
  assert.equal(profileRecords(c).records.length, 0);
  support(c);
  const onlyClaims = profileRecords(c);
  assert.ok(!onlyClaims.records.some(r => ['behaviors', 'paths', 'telemetry', 'mappings'].includes(r.entityType)));
  const context = onlyClaims.records.find(r => r.entityType === 'cases');
  assert.deepEqual(Object.keys(context.entity).sort(), ['contextOnly', 'id', 'name', 'sourceIds']);
  assert.equal(context.reviewStatus, null);
  const bundle = queryProfile(onlyClaims, 'bundle', { caseId: 'synthetic-case-a' });
  assert.ok(bundle.records.some(r => r.entityType === 'claims'));
  assert.equal(unit(c, 'cases:synthetic-case-a').eligible, false);
  decide(c, 'cases:synthetic-case-a'); decide(c, 'behaviors:synthetic-behavior');
  decide(c, 'telemetry:synthetic-sensor');
  const profile = profileRecords(c);
  assert.ok(profile.records.find(r => r.entityType === 'telemetry')?.reviewStatus.currentAcceptance);
  assert.ok(!profile.records.some(r => r.entityType === 'detections'));
  assert.deepEqual(profileRecords(c), profile);
  assert.doesNotMatch(canonicalSerialize(profile), /A tool was used in a benign exercise/);
  assert.ok(profile.records.filter(r => r.entityType === 'passages').every(r => r.entity.text === null));
  assert.ok(profile.records.filter(r => r.entityType === 'sourceRevisions').every(r => r.entity.normalizedContent === null && r.entity.rawContent === null));
});

test('Issue #81 AC-11 honest mixed-source/type, exclusion/unsure/stale, failed-source and empty counts', async () => {
  const c = await fixture(); support(c);
  decide(c, 'categorizations:synthetic-category-victim', 'exclude');
  decide(c, 'categorizations:synthetic-category-review', 'unsure');
  c.sources.push({ id: 'synthetic-failed', revisionIds: [] }); c.cases[0].sourceIds.push('synthetic-failed');
  // Scope change correctly stales earlier decisions.
  const stale = progressSummary(c, reviewSnapshot(c), 'synthetic-case-a');
  assert.equal(stale.reviewed, 0); assert.equal(stale.extraction.unavailable, 1);
  support(c);
  decide(c, 'categorizations:synthetic-category-victim', 'exclude');
  const summary = progressSummary(c, reviewSnapshot(c), 'synthetic-case-a');
  assert.equal(summary.reviewed, 3); assert.equal(summary.ready, 2);
  assert.ok(summary.total > summary.reviewed); assert.ok(summary.extraction.eligible > 0);
  const empty = progressSummary(c, reviewSnapshot(c), 'missing');
  assert.equal(empty.total, 0); assert.equal(empty.extraction.eligible, 0);
});

privateStoreTest('Issue #81 AC-07 durable reload, stale/concurrent writers and append-only audit protection', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hitl-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const c = await fixture(), file = path.join(directory, 'corpus.json');
  await writeFile(file, canonicalSerialize(c), { mode: 0o600 });
  const decision = input(c);
  const results = await Promise.all([runItemReview(directory, decision), runItemReview(directory, decision)]);
  assert.equal(results.filter(r => r.status === 'succeeded').length, 1);
  assert.ok(results.some(r => ['STORE_BUSY', 'STALE_REVIEW'].includes(r.code)));
  const loaded = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(unit(loaded).state, 'Accepted');
  const before = await readFile(file, 'utf8');
  const result = await updatePrivateCorpus(directory, corpus => { corpus.governance.localReview.events = []; }, { reviewAware: true });
  assert.equal(result.status, 'failed');
  assert.equal(await readFile(file, 'utf8'), before);
  loaded.governance.localReview.events[0].rationale += ' tampered';
  assert.throws(() => reviewSnapshot(loaded), /INVALID_REVIEW_LOG/);
  assert.notEqual(digest(loaded), digest(c));
});

test('Issue #81 AC-04/14 guide and contextual UI use the exact same immutable checks/version', async () => {
  const guide = await readFile(new URL('../docs/researcher-review-guide.md', import.meta.url), 'utf8');
  assert.ok(guide.includes(GUIDE_VERSION));
  for (const type of Object.keys(TYPE_CHECKS)) {
    for (const text of Object.values(checksFor(type))) assert.ok(guide.includes(text), `${type}: ${text}`);
  }
});

test('Issue #81 AC-03/04 compact human confirmation records the checklist; canonical rejection and Other are explicit', async () => {
  const c = await fixture(), confirmation = confirmationFor(unit(c));
  assert.throws(() => decide(c, key, 'accept', { checks: undefined, confirmation: 'LLM checked it' }), /CHECKLIST_REQUIRED/);
  decide(c, key, 'accept', { checks: undefined, confirmation, nonApplicability: { type: 'Synthetic justified exception.' } });
  const event = unit(c).history.at(-1);
  assert.equal(event.confirmation, confirmation);
  assert.equal(event.checks.evidence.result, 'pass');
  assert.equal(event.checks.type.result, 'not-applicable');
  assert.equal(event.checks.type.reason, 'Synthetic justified exception.');
  decide(c, key, 'exclude', { exclusionReason: 'unsupported', rationale: '' });
  assert.equal(unit(c).history.at(-1).rationale, 'Excluded: unsupported.');
  assert.equal(unit(c).original.origin, 'LLM source paraphrase');
});

test('Issue #81 AC-01/05/06 deterministic priority triage hides claims, exposes exceptions and propagates structural blockers', async () => {
  const c = await fixture(), state = reviewSnapshot(c);
  const nav = { caseId: 'synthetic-case-a', queue: 'priority', group: 'category' };
  const priority = reviewGroups(state.units, nav);
  assert.ok(priority.records.length);
  assert.ok(priority.records.every(u => ['behaviors', 'occurrences'].includes(u.type)));
  assert.ok(reviewGroups(state.units, { ...nav, queue: 'evidence' }).records.every(u => u.type === 'claims'));
  c.claims[0].inference = { rationale: 'Synthetic unresolved support', supportingClaimIds: ['missing'] };
  const blocked = reviewSnapshot(c);
  assert.equal(reviewGroups(blocked.units, nav).records.length, 0);
  assert.ok(reviewGroups(blocked.units, { ...nav, queue: 'exceptions' }).records.length >= 2);
  assert.equal(blocked.units.find(u => u.type === 'occurrences').actionable, false);
});

test('Issue #81 AC-07/08 reviewer identity is per-tab, self-attested and separate from navigation', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const win = { sessionStorage: storage };
  reviewSession(win, { reviewer: 'synthetic-reviewer', selfAttested: true });
  assert.deepEqual(reviewSession(win), { reviewer: 'synthetic-reviewer', selfAttested: true });
  reviewNavigation(storage, { itemKey: key, reviewer: 'must-not-be-bookmarked', evidence: 'private passage' });
  assert.deepEqual(reviewNavigation(storage), { itemKey: key });
  assert.match(reviewSession({}).notice, /could not/);
});

test('Issue #81 AC-09 every draft/reviewed row validates, including accepted optional, nested and redacted annotation units', async () => {
  const c = await fixture();
  const annotations = [{ id: 'synthetic-export-tool', type: 'commands-ai-artifacts', value: c.passages[0].text,
    caseId: c.claims[0].caseId, sourceId: c.claims[0].sourceId, sourceRevisionId: c.claims[0].sourceRevisionId,
    status: 'pending', origin: 'manual', evidenceStatus: 'evidence-backed',
    support: { quote: c.passages[0].text, locator: { start: c.passages[0].start, end: c.passages[0].end } },
    context: { artifactKind: 'ide-cli', artifactUsage: 'general-mention' } }];
  for (;;) {
    const next = reviewSnapshot(c, annotations).units.find(u => !u.eligible && !u.blockers.length && u.labels.state === 'complete');
    if (!next) break;
    decide(c, next.itemKey, 'accept', {}, annotations);
  }
  const { reviewedProfile } = await import('../src/hitl.mjs');
  const reviewed = reviewedProfile(c, annotations);
  for (const profile of [profileRecords(c, 'draft'), reviewed]) {
    for (const row of profile.records) assert.deepEqual(validateProfileRow(row), [], `${row.entityType}:${row.entity.id}`);
    assert.ok(profileFiles(profile)['schema.json']);
  }
  for (const type of ['nodes', 'edges', 'occurrences', 'annotations', 'mappings', 'telemetry', 'detections', 'otel']) {
    const row = reviewed.records.find(r => r.entityType === type);
    assert.ok(row, `missing schema exercise: ${type}`);
    assert.ok(row.reviewStatus.currentAcceptance);
    const bad = structuredClone(row); delete bad.reviewStatus.binding;
    assert.ok(validateProfileRow(bad).length);
  }
  const bundle = queryProfile(reviewed, 'bundle', { caseId: 'synthetic-case-a' });
  assert.ok(bundle.records.some(r => r.entityType === 'annotations'));
  assert.ok(bundle.records.some(r => r.entityType === 'occurrences'));
});

test('Issue #81 AC-11 N/A units are excluded from label denominators, not counted complete', async () => {
  const c = await fixture(), snapshot = reviewSnapshot(c);
  const summary = progressSummary(c, snapshot, 'synthetic-case-a');
  const scoped = snapshot.units.filter(u => u.caseIds.includes('synthetic-case-a'));
  assert.equal(summary.labelsApplicable, scoped.filter(u => u.labels.applicable).length);
  assert.equal(summary.labelsComplete, scoped.filter(u => u.labels.applicable && u.labels.state === 'complete').length);
  assert.equal(summary.total, summary.labelsApplicable + summary.labelsNA);
  assert.ok(summary.labelsNA >= 2);
  assert.equal(summary.priority.byType.behaviors.labelsNA, 1);
  assert.ok(summary.deferred > 0 && summary.hiddenEvidence > 0);
});

test('Issue #81 AC-11 extraction unions stable segment identities across incremental/skipped runs and discloses legacy lower bounds', async () => {
  const c = await fixture(), revision = c.sourceRevisions[0];
  revision.normalizedContent = 'x'.repeat(5000);
  const segments = [0, 2400, 4800].map(start => stableId('segment', `${revision.id}\n${revision.normalizedHash}\n${start}\n${Math.min(5000, start + 2400)}`));
  const coverage = { sourceRevisionId: revision.id, normalizedHash: revision.normalizedHash, completed: 1, segments: 3 };
  const run = (id, completedId) => ({ id, caseId: 'synthetic-case-a', coverage: [coverage],
    segmentCoverage: segments.map(segmentId => ({ segmentId, status: segmentId === completedId ? 'completed' : 'skipped' })) });
  c.governance.campaignExtraction = { runs: [run('first', segments[0]), run('second', segments[1]), run('skip', null), run('duplicate', segments[0])] };
  const progress = () => progressSummary(c, { units: [] }, null, [c.sources[0].id]).extraction;
  assert.equal(progress().completed, 2);
  assert.equal(progress().eligible, 3);
  c.governance.campaignExtraction.runs.push({ id: 'legacy', coverage: [{ ...coverage, completed: 3 }] });
  assert.equal(progress().completed, 3);
  c.governance.campaignExtraction.runs = [{ coverage: [{ ...coverage, completed: 2 }] }, { coverage: [{ ...coverage, completed: 1 }] }];
  assert.equal(progress().completed, 2);
  assert.equal(progress().legacyUnlocated, 1);
  c.governance.campaignExtraction.runs = [{ coverage: [{ ...coverage, normalizedHash: 'wrong', completed: 3 }] }];
  assert.equal(progress().completed, 0);
});

test('Issue #81 private display uses effective edits/state without changing canonical proposals or the public preview', async () => {
  const c = await fixture(), before = canonicalSerialize(c);
  decide(c, key, 'modify', { patch: { description: 'Friendly effective correction.' } });
  const model = createModel(c); model.itemReview = reviewSnapshot(c);
  const effective = applyReviewProjection(model);
  assert.equal(effective.claims.get(c.claims[0].id).description, 'Friendly effective correction.');
  assert.equal(effective.claims.get(c.claims[0].id).itemReview.editor, 'synthetic-human');
  assert.equal(effective.originalCorpus.claims[0].description, JSON.parse(before).claims[0].description);
  assert.equal(c.claims[0].description, JSON.parse(before).claims[0].description);
  const publicModel = { ...model, publicDraft: true };
  assert.equal(applyReviewProjection(publicModel), publicModel);
});
