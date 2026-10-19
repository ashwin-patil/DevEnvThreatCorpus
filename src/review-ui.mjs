import { element, action } from './render.mjs';
import { GUIDE_VERSION, checksFor, confirmationFor, priorityCategory, PRIORITY_LABELS, EXCLUSION_REASONS, CONTENT_ORIGINS } from './review-guide.mjs';
import { ALL_CAMPAIGN_CATEGORIES, categoryRule } from './campaign-categories.mjs';
import { OBSERVATION_CONTEXTS, RESPONSE_OUTCOMES } from './prompt-responses.mjs';
import { reviewLabel } from './model.mjs';

export const REVIEW_FILTERS = ['All', 'Needs review', 'Accepted', 'Excluded', 'Unsure',
  'Awaiting support', 'Re-review required', 'Evidence unavailable', 'Blocked/support changed'];
const filterLabel = value => ({ 'Needs review': 'Awaiting review', Accepted: 'Reviewed - accepted',
  'Blocked/support changed': 'All blocked items' })[value] ?? value;
const STORAGE_KEY = 'devenv-threat-corpus.review-navigation';
const NAV_KEYS = ['caseId', 'sourceId', 'type', 'filter', 'group', 'itemKey', 'queue', 'category', 'mode'];
const navigationFields = value => Object.fromEntries(NAV_KEYS
  .filter(k => typeof value?.[k] === 'string').map(k => [k, value[k]]));
export function supportNavigation(nav, itemKey, parentKey) {
  return { queue: 'all', category: '', filter: 'All', sourceId: '', type: '', itemKey,
    supportTrail: [...(nav.supportTrail ?? []), navigationFields({
      queue: 'priority', group: 'category', category: '', filter: 'All', sourceId: '', type: '', ...nav, itemKey: parentKey,
    })] };
}
export function returnFromSupport(nav) {
  if (nav.supportTrail?.length) return { ...nav.supportTrail.at(-1), supportTrail: nav.supportTrail.slice(0, -1) };
  return { itemKey: nav.returnItemKey, returnItemKey: '' };
}
export function reviewGroups(units, { caseId, sourceId = '', type = '', filter = 'All', group = 'category', queue = 'all', category = '' }) {
  const records = units.filter(u => u.caseIds.includes(caseId) && (!sourceId || u.sourceIds.includes(sourceId))
    && (!type || u.type === type) && (!category || priorityCategory(u) === category)
    && (queue === 'priority' ? u.actionable : queue === 'exceptions' ? !!priorityCategory(u) && !u.actionable :
      queue === 'evidence' ? u.type === 'claims' : true)
    && (filter === 'All' || u.state === filter || reviewLabel(u) === filter
      || filter === 'Awaiting support' && reviewLabel(u).startsWith('Review supporting')));
  const groups = new Map();
  for (const unit of records) for (const key of group === 'category' ? [PRIORITY_LABELS[priorityCategory(unit)] ?? unit.type] : unit.sourceIds.length ? unit.sourceIds : ['Supporting records / no direct source']) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  }
  return { records, groups };
}
export function reviewNavigation(storage, update) {
  try {
    const value = update ?? JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    const safe = Object.fromEntries([...NAV_KEYS, 'returnItemKey']
      .filter(k => typeof value?.[k] === 'string').map(k => [k, value[k]]));
    if (Array.isArray(value?.supportTrail)) safe.supportTrail = value.supportTrail.slice(-32).map(navigationFields);
    if (update) storage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch { return { notice: 'Review navigation could not be saved/restored. Decisions remain in private storage.' }; }
}
export function reviewWindowNavigation(win, update) {
  try { return reviewNavigation(win.localStorage, update); }
  catch { return { notice: 'Review navigation storage unavailable; decisions remain in private storage.' }; }
}
export function reviewSession(win, update) {
  try {
    const key = 'devenv-threat-corpus.review-session';
    if (update) win.sessionStorage.setItem(key, JSON.stringify({ reviewer: update.reviewer, selfAttested: update.selfAttested }));
    const value = update ?? JSON.parse(win.sessionStorage.getItem(key) ?? '{}');
    return { reviewer: typeof value.reviewer === 'string' ? value.reviewer : '', selfAttested: value.selfAttested === true };
  } catch { return { ...(update ?? { reviewer: '', selfAttested: false }), notice: 'Session identity could not be saved; it remains in memory until reload.' }; }
}
const ratio = (n, d) => d ? `${n}/${d}` : 'No eligible items / N/A';
export function renderProgress(doc, summary, openQueue) {
  const root = element(doc, 'section', null, 'review-progress');
  const totals = (target, title, counts) => {
    target.append(element(doc, 'p', `${title}: labels complete ${ratio(counts.labelsComplete, counts.labelsApplicable)} (${counts.labelsNA ?? 0} N/A) · current human review ${ratio(counts.reviewed, counts.total)} · release-ready ${ratio(counts.ready, counts.total)} stable review units.`));
  };
  totals(root, 'Actionable priority artifacts', summary.priority ?? summary);
  const e = summary.extraction;
  root.append(element(doc, 'p', `Extraction ${ratio(e.completed, e.eligible)} eligible retained canonical code points (union of completed windows across chunk-policy versions); ${e.unavailable} unavailable source(s), ${e.unprocessed} unprocessed source(s). Not all incident facts.`),
    element(doc, 'p', `Hidden supporting claims: ${summary.hiddenEvidence ?? 0}; deferred advanced records: ${summary.deferred ?? 0}; priority exceptions: ${summary.exceptions ?? 0}. These are not approvals.`),
    element(doc, 'p', 'Labels populated ≠ approval. N/A is excluded from label denominators. Accept + Exclude complete current review; Unsure/stale do not. Source counts overlap: do not sum. No quality score.', 'subtle'));
  if (e.legacyUnlocated) root.append(element(doc, 'p', `${e.legacyUnlocated} source(s) have historical partial coverage without segment identities; unlocated work is disclosed separately and excluded from the canonical coverage numerator.`));
  for (const stage of summary.stages ?? []) root.append(element(doc, 'p',
    `Stage ${stage.kind}: ${ratio(stage.completed, stage.inputs)} input units processed; ${stage.skipped} skipped, ${stage.failed} failed. Stage completion is separate from source coverage and review/release readiness.`));
  for (const filter of REVIEW_FILTERS.slice(1)) root.append(action(doc, filterLabel(filter), () => openQueue(filter)));
  const detail = element(doc, 'details'); detail.append(element(doc, 'summary', 'Expand by artifact type'));
  for (const [type, counts] of Object.entries(summary.priority?.byType ?? summary.byType)) totals(detail, PRIORITY_LABELS[type] ?? type, counts);
  const advanced = element(doc, 'details'); advanced.append(element(doc, 'summary', 'Whole corpus / evidence and deferred type counts'));
  for (const [type, counts] of Object.entries(summary.byType)) totals(advanced, type, counts);
  detail.append(advanced);
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
export function renderReview(doc, model, state, nav, { change, decide, navigate, session = {}, setSession = () => {}, loadDemo }) {
  const root = element(doc, 'section', null, 'review-page');
  root.append(element(doc, 'h2', 'Campaign review — one item at a time'),
    element(doc, 'p', 'Local, single active reviewer; identity is self-attested, not authenticated. Source/category selection is navigation, never approval. Exclusion is not falsehood or a negative training label.'));
  if (!state) {
    root.append(element(doc, 'p', model.reviewError ?? 'Review requires explicit private --store mode. Public preview and read-only snapshots cannot record decisions.'));
    if (loadDemo) root.append(action(doc, 'Start synthetic review exercise (isolated, not Nx)', loadDemo),
      element(doc, 'p', 'The synthetic exercise writes only server-memory fixture decisions. Reload retains them; server restart clears them. No public Nx writes or private-store changes.'));
    return root;
  }
  if (state.guideVersion !== GUIDE_VERSION) { root.append(element(doc, 'p', 'Guide mismatch: reload the application before reviewing.')); return root; }
  const caseId = nav.caseId || model.corpus.cases[0]?.id || '';
  if (model.reviewDemo) root.append(element(doc, 'p', 'SYNTHETIC REVIEW EXERCISE — benign fixtures, not incident evidence. Decisions live in this server process only; restart clears them.', 'limits'));
  const identity = element(doc, 'details'); identity.open = !session.selfAttested;
  identity.append(element(doc, 'summary', `Reviewer session: ${session.selfAttested ? session.reviewer : 'set identity once'} (self-attested, not authenticated)`));
  const reviewer = field(doc, identity, 'Reviewer identifier'); reviewer.value = session.reviewer ?? '';
  const attested = field(doc, identity, 'I am the active human reviewer; this identifier is self-attested'); attested.type = 'checkbox'; attested.checked = session.selfAttested === true;
  identity.append(action(doc, 'Set / correct session identity', () => setSession({ reviewer: reviewer.value.trim(), selfAttested: attested.checked })));
  if (session.notice) identity.append(element(doc, 'p', session.notice));
  root.append(identity);
  choose(doc, root, 'Campaign', model.corpus.cases.map(c => [c.id, c.name]), caseId,
    value => change({ caseId: value, sourceId: '', itemKey: '', supportTrail: [] }));
  const queue = nav.queue ?? 'priority';
  choose(doc, root, 'Review workload', [['priority', 'Grounded priority candidates'], ['exceptions', 'Priority exceptions / missing support'],
    ['evidence', 'Supporting claims - start here'], ['all', 'All records / later pass']], queue,
  value => change({ queue: value, itemKey: '', category: '', returnItemKey: '', supportTrail: [] }));
  root.append(action(doc, 'Review supporting claims', () => change({ queue: 'evidence', category: '', type: '',
    filter: 'Needs review', itemKey: '', returnItemKey: '', supportTrail: [] })),
  element(doc, 'p', 'Review source-linked claims first, then the artifacts they support. Awaiting support is not a failed or changed review.', 'subtle'));
  for (const [category, name] of Object.entries(PRIORITY_LABELS)) root.append(action(doc, name,
    () => change({ category, queue: 'priority', group: 'category', type: '', itemKey: '', returnItemKey: '', supportTrail: [] })));
  root.append(action(doc, 'All priority categories', () => change({ category: '', queue: 'priority', itemKey: '', returnItemKey: '', supportTrail: [] })));
  choose(doc, root, 'Group by', [['category', 'Artifact category'], ['blog', 'Blog / source']], nav.group ?? 'category', value => change({ group: value }));
  choose(doc, root, 'Queue', REVIEW_FILTERS.map(v => [v, filterLabel(v)]), nav.filter ?? 'All', value => change({ filter: value, itemKey: '' }));
  choose(doc, root, 'Source', [['', 'All sources'], ...model.corpus.sources.map(s => [s.id, s.title ?? s.id])],
    nav.sourceId ?? '', value => change({ sourceId: value, itemKey: '' }));
  if (nav.notice) root.append(element(doc, 'p', nav.notice));
  if (state.campaigns[caseId]) root.append(renderProgress(doc, state.campaigns[caseId],
    filter => change({ filter, queue: 'all', category: '', type: '', itemKey: '', returnItemKey: '', supportTrail: [] })));
  const selection = reviewGroups(state.units, { ...nav, queue, caseId });
  const selected = state.units.find(u => u.itemKey === nav.itemKey && u.caseIds.includes(caseId)) ??
    (!nav.itemKey ? selection.records.find(u => !['Accepted', 'Excluded'].includes(u.state)) ?? selection.records[0] : null);
  const workspace = element(doc, 'div', null, 'workspace'), list = element(doc, 'aside', null, 'record-list');
  list.setAttribute('aria-label', 'Review queue');
  if (nav.confirmation) {
    const confirmed = element(doc, 'p', nav.confirmation); confirmed.setAttribute('role', 'status'); root.append(confirmed);
    if (nav.previousItemKey) root.append(action(doc, 'Previous item / history', () => change({ queue: 'all', category: '', filter: 'All', itemKey: nav.previousItemKey })));
  }
  for (const [name, items] of selection.groups) {
    const group = element(doc, 'details'); group.open = true;
    group.append(element(doc, 'summary', `${model.sources.get(name)?.title ?? name} · ${items.length} occurrences`));
    for (const u of items) {
      const label = u.record.name ?? u.record.title ?? u.record.description ?? u.record.value ?? u.id;
      const button = action(doc, `${u.type} · ${label} · ${reviewLabel(u)}`, () => change({ itemKey: u.itemKey }));
      button.setAttribute('aria-pressed', String(selected?.itemKey === u.itemKey));
      button.title = 'Similar wording may be inspected together; identities and source occurrences are never merged.';
      group.append(button);
    }
    list.append(group);
  }
  if (!selection.records.length) list.append(element(doc, 'p',
    'No items match this workload and these filters. This does not mean review is complete. Try Review supporting claims or select All records / later pass.'));
  workspace.append(list);
  const detail = element(doc, 'article', null, 'panel review-detail');
  if (!selected) detail.append(element(doc, 'p', nav.itemKey ? 'Selected item is hidden/unavailable. Clear selection or change filters; no other item substituted.' : 'No eligible items / N/A'),
    action(doc, 'Clear selection', () => change({ itemKey: '' })));
  else {
    const u = selected;
    const rule = categoryRule(u.original);
    if (rule) detail.append(element(doc, 'p', `${rule.version} / ${rule.id}: ${rule.description} Matched source-linked claim wording, not an independent finding or available telemetry. Missing matches do not establish absence.`, 'limits'));
    detail.append(element(doc, 'h3', `${u.type}: ${u.id}`),
      element(doc, 'p', reviewLabel(u), 'review-status'),
      element(doc, 'h4', 'Candidate'),
      element(doc, u.priorityCategory === 'prompts' ? 'pre' : 'p',
        u.record.value ?? u.record.name ?? u.record.description ?? u.record.summary ?? u.record.title ?? u.id, 'review-candidate'),
      element(doc, 'p', `Uncertainty: ${u.record.uncertainty ?? 'Not reported; inspect supporting records.'}`),
      element(doc, 'p', `Conflicts: ${(u.record.conflictsWith ?? []).join(', ') || 'None recorded; this is not proof of no conflict.'}`));
    for (const [label, value] of [['Identity', u.record.normalizedValue], ['Description', u.record.description],
      ['Category / boundary', u.record.boundary], ['Usage', u.record.context?.artifactUsage],
      ['Context', u.record.context?.notes], ['Evidence class', u.record.evidenceStatus]]) {
      if (value) detail.append(element(doc, 'p', `${label}: ${value}`));
    }
    if (u.groundingLost) detail.append(element(doc, 'p', 'Exact grounding lost: edited literal is not in the retained passage. Acceptance and release are blocked.', 'limits'));
    const original = element(doc, 'details'); original.append(element(doc, 'summary', 'Origin, edits and technical review details'),
      element(doc, 'p', `Content origin: ${u.contentOrigin} · Label authorship: ${u.labelAuthorship}`),
      element(doc, 'p', `${/LLM|agent/.test(u.originalOrigin) ? 'LLM-derived (original contribution retained)' : `Original origin: ${u.originalOrigin}`} · ${u.editor ? `Human-edited by ${u.editor}` : 'No human content edit'} · ${u.currentHumanReview ? `Human-reviewed · ${u.state}` : 'Not currently human-reviewed'}`),
      element(doc, 'p', 'Origin records who produced the candidate; accepting an unchanged AI-derived item records human review, not human authorship.'),
      element(doc, 'p', `Technical review state: ${u.state} · labels ${u.labels.applicable ? u.labels.state : 'N/A (no label applies)'}`),
      element(doc, 'pre', JSON.stringify({ original: u.original, runMetadata: u.runMetadata, revision: u.binding }, null, 2)));
    detail.append(original, element(doc, 'h4', 'Exact evidence and available context'));
    if (!u.evidence.length) detail.append(element(doc, 'p', 'No direct passage on this item. Inspect supporting records below; unavailable/private passages are not invented.'));
    const shownEvidence = new Map();
    function showEvidence(e, parent, attribution) {
      const locator = e.locator ?? e.passage;
      const key = e.quote !== null && Number.isInteger(locator?.start) && Number.isInteger(locator?.end)
        ? JSON.stringify([e.revisionId, locator.start, locator.end, e.quote]) : null;
      if (key && shownEvidence.has(key)) {
        parent.append(element(doc, 'p', `${attribution} · Same exact passage as evidence ${shownEvidence.get(key)} above.`, 'subtle'));
        return false;
      }
      const number = shownEvidence.size + 1;
      if (key) shownEvidence.set(key, number);
      parent.append(element(doc, 'p', `${attribution} · Evidence ${number}`, 'subtle'),
        element(doc, 'blockquote', e.quote ?? e.explanation, 'review-quote'));
      return true;
    }
    for (const e of u.evidence) {
      if (!showEvidence(e, detail, e.id ? `Source passage: ${e.id}` : 'Direct annotation support')) continue;
      const r = model.corpus.sourceRevisions.find(r => r.id === e.revisionId);
      const source = model.sources.get(r?.sourceId);
      detail.append(element(doc, 'p', `${source?.title ?? 'Source unavailable'} · ${source?.publisher ?? 'Publisher not recorded'} · ${source?.originalUrl ?? 'No public URL'} · revision ${e.revisionId ?? 'unavailable'}`, 'subtle'));
      if (r) detail.append(action(doc, 'Open exact source revision', () => navigate('sources', r.sourceId, r.id)));
      const context = element(doc, 'details'); context.append(element(doc, 'summary', 'Surrounding source context'), element(doc, 'pre', e.context ?? 'Surrounding context unavailable.')); detail.append(context);
    }
    for (const key of u.dependencies) {
      const support = state.units.find(s => s.itemKey === key);
      const box = element(doc, 'section', null, 'claim-card');
      box.append(element(doc, 'p', `Required support · ${support ? reviewLabel(support) : 'Missing'}`),
        element(doc, 'p', support?.record.description ?? support?.record.name ?? key));
      if (support?.evidence[0]) showEvidence(support.evidence[0], box, `Supporting record: ${key}`);
      box.append(action(doc, `Review supporting item: ${key}`, () => change(supportNavigation(nav, key, u.itemKey))));
      detail.append(box);
    }
    for (const id of u.record.conflictsWith ?? []) detail.append(action(doc, `Conflicting claim: ${id}`,
      () => change(supportNavigation(nav, `claims:${id}`, u.itemKey))));
    const blockers = element(doc, 'details'); blockers.append(element(doc, 'summary', 'Acceptance requirements / technical blockers'));
    for (const blocker of u.blockers) blockers.append(action(doc, blocker.reason,
      () => change(supportNavigation(nav, blocker.itemKey, u.itemKey))));
    if (u.blockers.length) detail.append(blockers);
    if (nav.supportTrail?.length || nav.returnItemKey) detail.append(action(doc, 'Return to candidate after support review',
      () => change(returnFromSupport(nav))));
    const guide = element(doc, 'details');
    const link = element(doc, 'a', 'Full researcher decision guide'); link.href = '/docs/researcher-review-guide.md';
    guide.append(element(doc, 'summary', `Decision guide ${GUIDE_VERSION}`), link,
      element(doc, 'p', 'Accept only after personally checking evidence, fidelity, scope and the type rule. Reported ≠ confirmed; attempted ≠ successful; inference is explicit. Unsure is preferable to guessing. Modify creates a new revision and never accepts it. Exclude retains the candidate. Proposals remain untested proposals.'));
    for (const text of Object.values(checksFor(u.type))) guide.append(element(doc, 'p', text));
    detail.append(guide);
    const notice = element(doc, 'p'); notice.setAttribute('role', 'status'); detail.append(notice);
    let saving = false;
    async function submit(actionName, extra = {}) {
      if (saving) return;
      if (!session.selfAttested || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(session.reviewer ?? '')) {
        notice.textContent = 'Set your self-attested session identity first.'; identity.open = true; return;
      }
      saving = true;
      try { await decide({ snapshot: state.snapshot, itemKey: u.itemKey, reviewer: session.reviewer,
        selfAttested: true, guideVersion: GUIDE_VERSION, action: actionName, ...extra }); }
      catch (error) { notice.textContent = error.message; saving = false; }
    }
    const acceptance = confirmationFor(u);
    detail.append(element(doc, 'p', `Accept confirms: ${acceptance}`, 'review-attestation'));
    const accept = action(doc, 'Accept item — I confirm', () => submit('accept', { confirmation: acceptance }));
    accept.disabled = u.blockers.some(b => b.reason !== 'Decision binding/support changed; explicit re-review required') || u.labels.state !== 'complete';
    detail.append(accept);
    const rejection = element(doc, 'details');
    rejection.append(element(doc, 'summary', 'Exclude item (explicit decision)'),
      element(doc, 'p', 'The selected reason is a draft choice, not an existing verdict. Only Confirm rejection records an exclusion.'));
    const exclusionReason = choose(doc, rejection, 'Reason', [...EXCLUSION_REASONS, 'other'].map(r => [r, r]), EXCLUSION_REASONS[0], () => {});
    const rationale = field(doc, rejection, 'Optional detail (required for Other)', 'textarea');
    const links = element(doc, 'details'); links.append(element(doc, 'summary', 'Replacement links'));
    const replacements = field(doc, links, 'Replacement item keys (comma separated)'); rejection.append(links);
    rejection.append(action(doc, 'Confirm rejection', () => submit('exclude', { exclusionReason: exclusionReason.value,
      rationale: rationale.value, replacementKeys: replacements.value.split(',').map(k => k.trim()).filter(Boolean) })));
    detail.append(rejection);
    const modify = element(doc, 'details'); modify.append(element(doc, 'summary', 'Modify item'));
    const controls = [], responseControls = [];
    const edit = (name, key, value, tag = 'input') => {
      const control = field(doc, modify, name, tag); control.value = value ?? ''; controls.push({ key, control, before: value ?? '' });
    };
    const category = priorityCategory(u);
    if (category === 'tools') edit('Tool identity', 'normalizedValue', u.record.normalizedValue ?? u.record.value);
    if (category === 'prompts') {
      edit('Exact prompt literal', 'value', u.record.value, 'textarea');
      const context = choose(doc, modify, 'Prompt observation environment', Object.entries(OBSERVATION_CONTEXTS),
        u.record.context?.observationContext ?? 'unknown', () => {});
      controls.push({ key: 'context.observationContext', control: context, before: u.record.context?.observationContext ?? 'unknown' });
      for (const [index, response] of (u.record.responses ?? []).entries()) {
        modify.append(element(doc, 'h4', `Attached response ${index + 1}: ${response.agent}`),
          element(doc, 'p', response.contextBasis, 'limits'),
          element(doc, 'pre', response.text ?? 'Response text withheld.', 'artifact-value'));
        for (const [key, label, values] of [
          ['outcome', 'Response outcome', RESPONSE_OUTCOMES.map(v => [v, v])],
          ['observationContext', 'Response observation environment', Object.entries(OBSERVATION_CONTEXTS)],
        ]) {
          const control = choose(doc, modify, label, values, response[key], () => {});
          responseControls.push({ index, key, control, before: response[key] });
        }
      }
    }
    if (['tools', 'prompts'].includes(category)) {
      const usage = choose(doc, modify, 'Usage', ['targeted', 'attempted-abuse', 'reported-abuse', 'vendor-example', 'general-mention', 'unclear'].map(v => [v, v]), u.record.context?.artifactUsage ?? 'unclear', () => {});
      controls.push({ key: 'context.artifactUsage', control: usage, before: u.record.context?.artifactUsage ?? '' });
      edit('Use context', 'context.notes', u.record.context?.notes, 'textarea');
    } else if (u.type === 'categorizations' && ['campaigns', 'telemetry-scope'].includes(category)) {
      const values = [...new Set([u.record.value, ...ALL_CAMPAIGN_CATEGORIES.filter(r => r.dimension === u.record.dimension).map(r => r.value)])];
      const control = choose(doc, modify, category === 'telemetry-scope' ? 'Telemetry scope' : 'Campaign category', values.map(value => [value, value]), u.record.value, () => {});
      controls.push({ key: 'value', control, before: u.record.value });
    } else if (u.type === 'behaviors') {
      edit('Behavior name', 'name', u.record.name); edit('Behavior description', 'description', u.record.description, 'textarea');
      edit('Category / trust boundary', 'boundary', u.record.boundary);
    } else if (u.type === 'annotations' && u.record.type === 'observed-behavior') {
      edit('Behavior description', 'value', u.record.value, 'textarea');
      const behavior = choose(doc, modify, 'Behavior classification', ['observed', 'attempted', 'demonstrated', 'inferred'].map(v => [v, v]),
        u.record.context?.behavior ?? 'inferred', () => {});
      controls.push({ key: 'context.behavior', control: behavior, before: u.record.context?.behavior ?? '' });
    } else if (u.type !== 'occurrences') {
      // Advanced records retain simple text correction; structural editors are deferred.
      const key = ['description', 'summary', 'value', 'detail', 'basis', 'rationale', 'limitations', 'hypothesis', 'action'].find(k => typeof u.record[k] === 'string');
      if (key) edit('Content correction', key, u.record[key], 'textarea');
    }
    const tags = field(doc, modify, 'Researcher tags (optional, comma separated)'); tags.value = (u.researcherTags ?? []).join(', ');
    const editReason = field(doc, modify, 'Change reason', 'textarea');
    modify.append(action(doc, 'Save changes (not acceptance)', () => {
      const patch = {};
      for (const { key, control, before } of controls) if (control.value !== before) {
        if (key.startsWith('context.')) { patch.context ??= { ...u.record.context }; patch.context[key.slice(8)] = control.value; }
        else patch[key] = control.value;
      }
      for (const { index, key, control, before } of responseControls) if (control.value !== before) {
        patch.responses ??= structuredClone(u.record.responses);
        patch.responses[index][key] = control.value;
      }
      submit('modify', { patch, researcherTags: tags.value.split(',').map(t => t.trim()).filter(Boolean), rationale: editReason.value });
    }));
    detail.append(modify);
    const unsure = element(doc, 'details'); unsure.append(element(doc, 'summary', 'Unsure / Skip'));
    const unsureReason = field(doc, unsure, 'Why unsure?', 'textarea');
    unsure.append(action(doc, 'Save Unsure', () => submit('unsure', { rationale: unsureReason.value }))); detail.append(unsure);
    const advanced = element(doc, 'details'); advanced.append(element(doc, 'summary', 'Provenance correction / non-applicability'));
    const origin = choose(doc, advanced, 'Correct content origin', CONTENT_ORIGINS.map(v => [v, v]), CONTENT_ORIGINS.includes(u.contentOrigin) ? u.contentOrigin : 'unknown', () => {});
    const authorship = choose(doc, advanced, 'Correct label authorship', ['LLM-derived', 'Rule-derived', 'Human authored', 'Human-edited', 'unknown'].map(v => [v, v]), u.labelAuthorship, () => {});
    const provenanceReason = field(doc, advanced, 'Provenance correction reason', 'textarea');
    const evidence = field(doc, advanced, 'Available provenance evidence / reference');
    advanced.append(action(doc, 'Save provenance correction', () => submit('provenance', { contentOrigin: origin.value,
      labelAuthorship: authorship.value, rationale: provenanceReason.value, provenanceEvidence: evidence.value })));
    const nonApplicable = choose(doc, advanced, 'Non-applicable check', Object.keys(checksFor(u.type)).map(k => [k, k]), 'type', () => {});
    const naReason = field(doc, advanced, 'Non-applicability explanation');
    advanced.append(action(doc, 'Accept with documented non-applicability', () => submit('accept', { confirmation: acceptance,
      nonApplicability: { [nonApplicable.value]: naReason.value } })));
    detail.append(advanced);
    const next = selection.records[selection.records.indexOf(u) + 1];
    detail.append(action(doc, 'Next item (navigation only; no decision)', () => change({ itemKey: next?.itemKey ?? u.itemKey })));
    const history = element(doc, 'details'); history.append(element(doc, 'summary', `Retained audit history · ${u.history.length}`),
      element(doc, 'pre', JSON.stringify(u.history, null, 2)));
    detail.append(history);
    if (u.stageInputs?.length) {
      const stage = element(doc, 'details');
      stage.append(element(doc, 'summary', 'Frozen effective stage inputs (corrections and evidence)'),
        element(doc, 'pre', JSON.stringify(u.stageInputs, null, 2)));
      detail.append(stage);
    }
  }
  detail.tabIndex = -1;
  workspace.append(detail); root.append(workspace);
  const eligibility = element(doc, 'details'); eligibility.append(element(doc, 'summary', 'Case release eligibility / withheld reasons'));
  for (const u of state.units.filter(u => u.caseIds.includes(caseId))) eligibility.append(action(doc,
    `${u.itemKey}: ${u.eligible ? 'Eligible' : `Withheld — ${reviewLabel(u)}; ${u.blockers.map(b => b.reason).join('; ')}`}`,
    () => change({ queue: 'all', category: '', filter: 'All', type: '', sourceId: '', itemKey: u.itemKey })));
  root.append(eligibility);
  return root;
}
