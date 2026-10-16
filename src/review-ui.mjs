import { element, action } from './render.mjs';
import { GUIDE_VERSION, checksFor, EXCLUSION_REASONS, CONTENT_ORIGINS } from './review-guide.mjs';

export const REVIEW_FILTERS = ['All', 'Needs review', 'Accepted', 'Excluded', 'Unsure', 'Blocked/support changed'];
const STORAGE_KEY = 'devenv-threat-corpus.review-navigation';
export function reviewGroups(units, { caseId, sourceId = '', type = '', filter = 'All', group = 'blog' }) {
  const records = units.filter(u => u.caseIds.includes(caseId) && (!sourceId || u.sourceIds.includes(sourceId))
    && (!type || u.type === type) && (filter === 'All' || u.state === filter));
  const groups = new Map();
  for (const unit of records) for (const key of group === 'category' ? [unit.type] : unit.sourceIds.length ? unit.sourceIds : ['Supporting records / no direct source']) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  }
  return { records, groups };
}
export function reviewNavigation(storage, update) {
  try {
    if (update) { storage.setItem(STORAGE_KEY, JSON.stringify(update)); return { ...update }; }
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    return Object.fromEntries(['caseId', 'sourceId', 'type', 'filter', 'group', 'itemKey']
      .filter(k => typeof value?.[k] === 'string').map(k => [k, value[k]]));
  } catch { return { notice: 'Review navigation could not be saved/restored. Decisions remain in private storage.' }; }
}
export function reviewWindowNavigation(win, update) {
  try { return reviewNavigation(win.localStorage, update); }
  catch { return { notice: 'Review navigation storage unavailable; decisions remain in private storage.' }; }
}
const ratio = (n, d) => d ? `${n}/${d}` : 'No eligible items / N/A';
export function renderProgress(doc, summary, openQueue) {
  const root = element(doc, 'section', null, 'review-progress');
  const totals = (target, title, counts) => {
    target.append(element(doc, 'p', `${title}: labels complete ${ratio(counts.labelsComplete, counts.total)} · current human review ${ratio(counts.reviewed, counts.total)} · release-ready ${ratio(counts.ready, counts.total)} stable review units.`));
  };
  totals(root, 'Review coverage', summary);
  const e = summary.extraction;
  root.append(element(doc, 'p', `Extraction ${ratio(e.completed, e.eligible)} eligible retained source segments; ${e.unavailable} unavailable source(s), ${e.unprocessed} unprocessed source(s). Not all incident facts.`),
    element(doc, 'p', 'Labels populated ≠ approval. Accept + Exclude complete current review; Unsure/stale do not. Source counts overlap: do not sum. No quality score.', 'subtle'));
  for (const filter of REVIEW_FILTERS.slice(1)) root.append(action(doc, filter, () => openQueue(filter)));
  const detail = element(doc, 'details'); detail.append(element(doc, 'summary', 'Expand by artifact type'));
  for (const [type, counts] of Object.entries(summary.byType)) totals(detail, type, counts);
  root.append(detail); return root;
}
function field(doc, parent, label, tag = 'input') {
  const wrapper = element(doc, 'label', `${label} `), input = element(doc, tag);
  wrapper.append(input); parent.append(wrapper); return input;
}
function choose(doc, parent, label, values, selected, change) {
  const input = field(doc, parent, label, 'select');
  for (const [value, text] of values) {
    const option = element(doc, 'option', text); option.value = value; input.append(option);
  }
  input.value = selected; input.addEventListener('change', () => change(input.value)); return input;
}
export function renderReview(doc, model, state, nav, { change, decide, navigate }) {
  const root = element(doc, 'section', null, 'review-page');
  root.append(element(doc, 'h2', 'Campaign review — one item at a time'),
    element(doc, 'p', 'Local, single active reviewer; identity is self-attested, not authenticated. Source/category selection is navigation, never approval. Exclusion is not falsehood or a negative training label.'));
  if (!state) { root.append(element(doc, 'p', model.reviewError ?? 'Review requires explicit private --store mode. Public preview and read-only snapshots cannot record decisions.')); return root; }
  if (state.guideVersion !== GUIDE_VERSION) { root.append(element(doc, 'p', 'Guide mismatch: reload the application before reviewing.')); return root; }
  const caseId = nav.caseId || model.corpus.cases[0]?.id || '';
  choose(doc, root, 'Campaign', model.corpus.cases.map(c => [c.id, c.name]), caseId,
    value => change({ caseId: value, sourceId: '', itemKey: '' }));
  choose(doc, root, 'Group by', [['blog', 'Blog / source'], ['category', 'Artifact category']], nav.group ?? 'blog', value => change({ group: value }));
  choose(doc, root, 'Queue', REVIEW_FILTERS.map(v => [v, v]), nav.filter ?? 'All', value => change({ filter: value, itemKey: '' }));
  choose(doc, root, 'Source', [['', 'All sources'], ...model.corpus.sources.map(s => [s.id, s.title ?? s.id])],
    nav.sourceId ?? '', value => change({ sourceId: value, itemKey: '' }));
  choose(doc, root, 'Artifact type', [['', 'All types'], ...[...new Set(state.units.map(u => u.type))].map(t => [t, t])],
    nav.type ?? '', value => change({ type: value, itemKey: '' }));
  if (nav.notice) root.append(element(doc, 'p', nav.notice));
  if (state.campaigns[caseId]) root.append(renderProgress(doc, state.campaigns[caseId], filter => change({ filter, itemKey: '' })));
  const selection = reviewGroups(state.units, { ...nav, caseId });
  const selected = selection.records.find(u => u.itemKey === nav.itemKey) ?? (!nav.itemKey ? selection.records[0] : null);
  const workspace = element(doc, 'div', null, 'workspace'), queue = element(doc, 'aside', null, 'record-list');
  queue.setAttribute('aria-label', 'Review queue');
  for (const [name, items] of selection.groups) {
    const group = element(doc, 'details'); group.open = true;
    group.append(element(doc, 'summary', `${model.sources.get(name)?.title ?? name} · ${items.length} occurrences`));
    for (const u of items) {
      const label = u.record.name ?? u.record.title ?? u.record.description ?? u.record.value ?? u.id;
      const button = action(doc, `${u.type} · ${label} · ${u.state}`, () => change({ itemKey: u.itemKey }));
      button.setAttribute('aria-pressed', String(selected?.itemKey === u.itemKey));
      button.title = 'Similar wording may be inspected together; identities and source occurrences are never merged.';
      group.append(button);
    }
    queue.append(group);
  }
  workspace.append(queue);
  const detail = element(doc, 'article', null, 'panel review-detail');
  if (!selected) detail.append(element(doc, 'p', nav.itemKey ? 'Selected item is hidden/unavailable. Clear selection or change filters; no other item substituted.' : 'No eligible items / N/A'),
    action(doc, 'Clear selection', () => change({ itemKey: '' })));
  else {
    const u = selected;
    detail.append(element(doc, 'h3', `${u.type}: ${u.id}`),
      element(doc, 'p', `${u.state} · labels ${u.labels.state}${u.labels.applicable ? '' : ' (no label applies)'}`),
      element(doc, 'p', `Content origin: ${u.contentOrigin} · Label authorship: ${u.labelAuthorship}`),
      element(doc, 'p', `${/LLM|agent/.test(u.originalOrigin) ? 'LLM-derived (original contribution retained)' : `Original origin: ${u.originalOrigin}`} · ${u.editor ? `Human-edited by ${u.editor}` : 'No human content edit'} · ${u.state === 'Accepted' ? 'Human-reviewed' : 'Not currently human-reviewed'}`),
      element(doc, 'h4', 'Proposed content'), element(doc, 'pre', JSON.stringify(u.record, null, 2)),
      element(doc, 'p', `Uncertainty: ${u.record.uncertainty ?? 'Not reported; inspect supporting records.'}`),
      element(doc, 'p', `Conflicts: ${(u.record.conflictsWith ?? []).join(', ') || 'None recorded; this is not proof of no conflict.'}`));
    const original = element(doc, 'details'); original.append(element(doc, 'summary', 'Original candidate, extraction provenance and revision binding'),
      element(doc, 'pre', JSON.stringify({ original: u.original, runMetadata: u.runMetadata, revision: u.binding }, null, 2)));
    detail.append(original, element(doc, 'h4', 'Exact evidence and available context'));
    if (!u.evidence.length) detail.append(element(doc, 'p', 'No direct passage on this item. Inspect supporting records below; unavailable/private passages are not invented.'));
    for (const e of u.evidence) {
      detail.append(element(doc, 'p', `Source revision: ${e.revisionId ?? 'unavailable'}`),
        element(doc, 'blockquote', e.quote ?? e.explanation), element(doc, 'pre', e.context ?? 'Surrounding context unavailable.'));
      const r = model.corpus.sourceRevisions.find(r => r.id === e.revisionId);
      if (r) detail.append(action(doc, 'Open exact source revision', () => navigate('sources', r.sourceId, r.id)));
    }
    for (const key of u.dependencies) detail.append(action(doc, `Supporting record: ${key}`,
      () => change({ filter: 'All', sourceId: '', type: '', itemKey: key })));
    for (const id of u.record.conflictsWith ?? []) detail.append(action(doc, `Conflicting claim: ${id}`,
      () => change({ filter: 'All', sourceId: '', type: '', itemKey: `claims:${id}` })));
    for (const blocker of u.blockers) detail.append(action(doc, blocker.reason,
      () => change({ filter: 'All', sourceId: '', type: '', itemKey: blocker.itemKey })));
    const guide = element(doc, 'details'); guide.open = true;
    const link = element(doc, 'a', 'Full researcher decision guide'); link.href = '/docs/researcher-review-guide.md';
    guide.append(element(doc, 'summary', `Decision guide ${GUIDE_VERSION}`), link,
      element(doc, 'p', 'Accept only after personally checking evidence, fidelity, scope and the type rule. Reported ≠ confirmed; attempted ≠ successful; inference is explicit. Unsure is preferable to guessing. Modify creates a new revision and never accepts it. Exclude retains the candidate. Proposals remain untested proposals.'));
    const checkInputs = {};
    for (const [key, text] of Object.entries(checksFor(u.type))) {
      const row = element(doc, 'div');
      const result = choose(doc, row, text, [['', 'Not checked'], ['pass', 'Pass — personally checked'], ['not-applicable', 'Not applicable — reason required']], '', () => {});
      const reason = field(doc, row, 'Non-applicability reason');
      checkInputs[key] = { result, reason }; guide.append(row);
    }
    detail.append(guide);
    const reviewer = field(doc, detail, 'Reviewer identifier (self-attested)');
    const attested = field(doc, detail, 'I am the active human reviewer; this identity is self-attested'); attested.type = 'checkbox';
    const rationale = field(doc, detail, 'Decision / correction reason', 'textarea');
    const exclusionReason = choose(doc, detail, 'Exclusion reason', EXCLUSION_REASONS.map(r => [r, r]), EXCLUSION_REASONS[0], () => {});
    const patch = field(doc, detail, 'Simple content/label correction (JSON object; structural corrections must be excluded/regenerated)', 'textarea'); patch.value = '{}';
    const tags = field(doc, detail, 'Researcher tags (comma separated)');
    const origin = choose(doc, detail, 'Correct content origin', CONTENT_ORIGINS.map(v => [v, v]), 'unknown', () => {});
    const authorship = choose(doc, detail, 'Correct label authorship', ['LLM-derived', 'Human authored', 'Human-edited', 'unknown'].map(v => [v, v]), 'unknown', () => {});
    const evidence = field(doc, detail, 'Provenance correction evidence / reference');
    const replacements = field(doc, detail, 'Replacement item keys for exclusion (comma separated, optional)');
    const notice = element(doc, 'p'); notice.setAttribute('role', 'status'); detail.append(notice);
    for (const [actionName, label] of [['accept', 'Accept item'], ['modify', 'Modify — requires separate acceptance'],
      ['exclude', 'Reject / Exclude item'], ['unsure', 'Unsure / Skip with reason'], ['provenance', 'Correct provenance (audited)']]) {
      const button = action(doc, label, async () => {
        const input = { snapshot: state.snapshot, itemKey: u.itemKey, reviewer: reviewer.value,
          selfAttested: attested.checked, guideVersion: GUIDE_VERSION, action: actionName, rationale: rationale.value };
        if (actionName === 'accept') input.checks = Object.fromEntries(Object.entries(checkInputs).map(([key, c]) => [key, { result: c.result.value, reason: c.reason.value }]));
        if (actionName === 'modify') {
          try { input.patch = JSON.parse(patch.value); } catch { notice.textContent = 'Correction must be valid JSON.'; return; }
          if (tags.value.trim()) input.researcherTags = tags.value.split(',').map(t => t.trim()).filter(Boolean);
        }
        if (actionName === 'exclude') {
          input.exclusionReason = exclusionReason.value;
          input.replacementKeys = replacements.value.split(',').map(k => k.trim()).filter(Boolean);
        }
        if (actionName === 'provenance') Object.assign(input, { contentOrigin: origin.value, labelAuthorship: authorship.value, provenanceEvidence: evidence.value });
        button.disabled = true;
        try { await decide(input); } catch (error) { notice.textContent = error.message; button.disabled = false; }
      });
      detail.append(button);
    }
    const next = selection.records[selection.records.indexOf(u) + 1];
    detail.append(action(doc, 'Next item (navigation only; no decision)', () => change({ itemKey: next?.itemKey ?? u.itemKey })));
    const history = element(doc, 'details'); history.append(element(doc, 'summary', `Retained audit history · ${u.history.length}`),
      element(doc, 'pre', JSON.stringify(u.history, null, 2))); detail.append(history);
  }
  workspace.append(detail); root.append(workspace);
  const eligibility = element(doc, 'details'); eligibility.append(element(doc, 'summary', 'Case release eligibility / withheld reasons'));
  for (const u of state.units.filter(u => u.caseIds.includes(caseId))) eligibility.append(action(doc,
    `${u.itemKey}: ${u.eligible ? 'Eligible' : `Withheld — ${u.state}; ${u.blockers.map(b => b.reason).join('; ')}`}`,
    () => change({ filter: 'All', type: '', sourceId: '', itemKey: u.itemKey })));
  root.append(eligibility);
  return root;
}
