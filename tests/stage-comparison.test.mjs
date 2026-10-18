import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest, validateCorpus } from '../scripts/contract.mjs';
import { freezeBaseline, regenerationCandidate, compareBaseline, comparisonInventory,
  selectBaseline, baselineSelectionStatus, COMPARISON_RUBRIC } from '../src/stage-comparison.mjs';
import { prepareStage, applyStage } from '../src/stages.mjs';
import { STAGE_CANDIDATE } from '../src/stage-contract.mjs';
import { assertStageHistory } from '../src/stage-contract.mjs';
import { reviewSnapshot } from '../src/hitl.mjs';
import { renderStageComparison } from '../src/stage-view.mjs';

const fixture = async () => JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
function renameClaims(corpus) {
  const mapping = new Map(corpus.claims.map(c => [c.id, `renamed-${c.id}`]));
  function replace(value) {
    if (typeof value === 'string') return mapping.get(value) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]));
    return value;
  }
  return replace(corpus);
}
const evidenceFor = group => [...group.before, ...group.after].flatMap(i => i.evidence ?? [])
  .filter(e => e.quote).slice(0, 1).map(({ revisionHash, start, end, quote }) => ({ revisionHash, start, end, quote }));
function adjudicate(comparison) {
  return { schemaVersion: 'campaign-comparison-adjudication/1', comparisonHash: comparison.comparisonHash,
    reviewer: 'independent-synthetic-reviewer', independent: true, selfAttested: true, approveSelection: true,
    rubricVersion: COMPARISON_RUBRIC.version,
    decisions: comparison.groups.filter(g => g.major).map(g => ({ differenceId: g.id,
      outcome: 'accepted-evidence-backed-change', rationale: 'Synthetic exercise only; inspected the quoted retained evidence.',
      evidence: evidenceFor(g) })) };
}

test('#85 AC-08/09 baseline freeze retains exact sources, proposals and overlays; candidate copies no extracted history', async () => {
  const original = await fixture(), before = digest(original), baseline = freezeBaseline(original, 'synthetic-case-a');
  const next = regenerationCandidate(baseline);
  assert.equal(digest(original), before);
  assert.equal(next.claims.length, 0);
  assert.equal(next.passages.length, 0);
  assert.equal(next.reviews.length, 0);
  assert.equal(next.cases.length, 1);
  assert.equal(next.cases[0].summary, null);
  assert.deepEqual(next.sourceRevisions, original.sourceRevisions);
  assert.equal(next.governance.regeneration.baselineHash, baseline.baselineHash);
  const altered = structuredClone(baseline); altered.corpus.claims[0].description = 'changed';
  assert.throws(() => regenerationCandidate(altered), { code: 'INVALID_BASELINE' });
});

test('#85 AC-09 renamed generated IDs are not semantic mismatches, equal-count changed meanings are', async () => {
  const original = await fixture(), baseline = freezeBaseline(original, 'synthetic-case-a');
  const renamed = renameClaims(original);
  const same = compareBaseline(baseline, renamed);
  assert.equal(same.groups.filter(g => g.major).length, 0);
  renamed.claims[0].description = 'A substantially different assertion with the same record count.';
  const changed = compareBaseline(baseline, renamed);
  assert.ok(changed.groups.some(g => g.kind === 'substantively-changed'));
  assert.equal(renamed.claims.length, original.claims.length);
});

test('#85 AC-09 split/merge and omission/addition suggestions retain complete exact evidence for human adjudication', async () => {
  const original = await fixture();
  original.claims = original.claims.filter(c => c.caseId === 'synthetic-case-a' && !c.inference);
  original.claims.forEach(c => { c.conflictsWith = []; });
  original.cases = [original.cases[0]];
  original.cases[0].summaryClaimIds = [];
  original.cases[0].summary = null; original.cases[0].nullReasons.summary = 'not_reported';
  original.categorizations = []; original.timelines = [];
  const baseline = freezeBaseline(original, 'synthetic-case-a'), next = structuredClone(original);
  next.claims[0].description = 'First partial assertion.';
  next.claims.push({ ...structuredClone(next.claims[0]), id: 'split-second', description: 'Second partial assertion.' });
  let comparison = compareBaseline(baseline, next);
  assert.ok(comparison.groups.some(g => g.type === 'claims' && g.kind === 'split'));
  const splitBaseline = freezeBaseline(next, 'synthetic-case-a');
  comparison = compareBaseline(splitBaseline, original);
  assert.ok(comparison.groups.some(g => g.type === 'claims' && g.kind === 'merged'));
  next.claims = next.claims.filter(c => c.id !== original.claims[1].id);
  comparison = compareBaseline(baseline, next);
  assert.ok(comparison.groups.some(g => g.kind === 'omitted'));
});

test('#85 AC-09 exact literal, role/usage and evidence changes remain explicit across every populated annotation type', async () => {
  const original = await fixture();
  const annotation = { id: 'synthetic-prompt', caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a',
    sourceRevisionId: 'synthetic-revision-a', type: 'commands-ai-artifacts', value: 'Café',
    evidenceStatus: 'evidence-backed', origin: 'manual', status: 'pending',
    claimIds: ['synthetic-claim-a'], support: { quote: 'Café', locator: { start: 2, end: 6 } },
    context: { artifactKind: 'prompt-instruction', artifactUsage: 'vendor-example' } };
  const baseline = freezeBaseline(original, 'synthetic-case-a', [annotation]);
  const changed = structuredClone(annotation);
  changed.id = 'different-prompt-id'; changed.value = 'Caf'; changed.context.artifactUsage = 'reported-abuse';
  const comparison = compareBaseline(baseline, original, [changed]);
  const group = comparison.groups.find(g => g.type === 'annotations' && g.major);
  assert.equal(group.before[0].record.value, 'Café');
  assert.equal(group.after[0].record.value, 'Caf');
  assert.equal(group.before[0].evidence[0].quote, 'Café');
});

test('#85 AC-09 comparison/adoption blocks unresolved or stale adjudication, selects explicitly without transferring acceptance', async () => {
  const original = await fixture(), baseline = freezeBaseline(original, 'synthetic-case-a'), next = regenerationCandidate(baseline);
  const request = prepareStage(next, { kind: 'ground', caseId: baseline.caseId });
  applyStage(next, request, { schemaVersion: STAGE_CANDIDATE, kind: 'ground', requestHash: request.requestHash,
    model: { effectiveModel: null, version: null, nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
    processing: request.inputs.flatMap(i => i.segments.map(s => ({ inputId: s.id, status: 'completed', reason: null }))),
    outputs: { claims: [], artifacts: [] }, limitations: ['Synthetic candidate: omissions need human adjudication.'] });
  const comparison = compareBaseline(baseline, next), adjudication = adjudicate(comparison), before = digest(baseline);
  const incomplete = structuredClone(adjudication); incomplete.decisions = [];
  assert.throws(() => selectBaseline(next, baseline, comparison, incomplete), { code: 'UNRESOLVED_MAJOR_MISMATCH' });
  const unsupported = structuredClone(adjudication); unsupported.decisions[0].evidence[0].quote = 'invented';
  assert.throws(() => selectBaseline(next, baseline, comparison, unsupported), { code: 'INVALID_COMPARISON_EVIDENCE' });
  const selection = selectBaseline(next, baseline, comparison, adjudication);
  assert.equal(baselineSelectionStatus(next).selected, true);
  assert.ok(selection.selectionHash);
  assert.equal(digest(baseline), before);
  assert.equal(reviewSnapshot(next).units.some(u => u.eligible), false);
  assert.deepEqual(validateCorpus(next), []);
  const tampered = structuredClone(next);
  tampered.governance.baselineSelections[0].reviewer = 'changed-reviewer';
  assert.ok(validateCorpus(tampered).some(e => e.includes('INVALID_BASELINE_SELECTION')));
  const rewritten = structuredClone(next.governance); rewritten.baselineSelections = [];
  assert.throws(() => assertStageHistory(next.governance, rewritten), { code: 'BASELINE_HISTORY_REWRITE' });
  next.name += ' changed';
  assert.equal(baselineSelectionStatus(next).selected, false);
  assert.throws(() => selectBaseline(next, baseline, comparison, adjudication), { code: 'STALE_COMPARISON' });
});

test('#85 AC-08/09 reproducible evaluation includes all populated review types, not just claims/counts', async () => {
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
  const baseline = freezeBaseline(corpus, 'synthetic-case-a');
  const a = compareBaseline(baseline, corpus), b = compareBaseline(baseline, corpus);
  assert.deepEqual(a, b);
  assert.ok(new Set(comparisonInventory(corpus, 'synthetic-case-a').map(i => i.type)).size > 5);
  assert.equal(a.groups.filter(g => g.major).length, 0);
});

test('#85 AC-07/09 comparison renderer is inert, side-by-side and never supplies approval controls', () => {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; }
    append(...items) { this.children.push(...items); }
    setAttribute() {}
  }
  const doc = { createElement: tag => new Element(tag) };
  const comparison = { schemaVersion: 'campaign-stage-comparison/1', comparisonHash: 'synthetic',
    groups: [{ id: 'synthetic', type: 'claims', kind: 'omitted', major: true,
      before: [{ record: { description: '<script>inert</script>' } }], after: [] }] };
  const root = renderStageComparison(doc, comparison);
  const elements = [];
  const walk = e => { elements.push(e); e.children.forEach(walk); }; walk(root);
  assert.equal(elements.filter(e => e.tagName === 'td').length, 2);
  assert.ok(elements.some(e => e.textContent.includes('<script>inert</script>')));
  assert.equal(elements.some(e => e.tagName === 'button'), false);
});
