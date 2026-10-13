import { element, action } from './render.mjs';

export const DIMENSIONS = {
  trust_surface: ['Social engineering and malicious repositories', 'Package or registry compromise', 'IDE and local execution paths', 'Skill marketplace poisoning', 'MCP or tool poisoning', 'Credentials and identity', 'CI/CD and cloud'],
  ai_involvement: ['Victim-side agent abuse', 'Attacker-side AI use', 'AI review targeting', 'AI assets targeted', 'No AI involvement reported', 'Unclear'],
  execution_location: ['endpoint', 'IDE', 'CLI', 'WSL', 'container', 'CI runner', 'cloud', 'remote service', 'unknown'],
  delivery: ['recruiter lure', 'repository content', 'package install/update', 'extension', 'Skill', 'MCP integration', 'configuration change', 'other'],
};
export const EVIDENCE = ['Source-reported observation', 'Attempted behavior', 'Demonstrated capability or proof of concept', 'Potential consequence', 'Researcher inference', 'Unclear or disputed'];
const collections = new Set(['sources', 'sourceRevisions', 'passages', 'cases', 'claims', 'categorizations', 'timelines', 'reviews', 'collectionManifests', 'paths', 'behaviors', 'frameworks', 'mappings', 'telemetry', 'detections', 'otel']);
export const normalizeSuppliedText = text => text.replace(/\r\n?/g, '\n').normalize('NFC');
export function serializeProposal(value) {
  function ordered(item, key = '') {
    if (Array.isArray(item)) return (collections.has(key) ? [...item].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : item).map(v => ordered(v));
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(k => [k, ordered(item[k], k)]));
    return item;
  }
  return JSON.stringify(ordered(value), null, 2) + '\n';
}
export async function hashText(text) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const identity = async (namespace, value) => `${namespace}-${await hashText(`${namespace}\n${value}`)}`;
const newId = kind => `studio-${kind}-${globalThis.crypto.randomUUID()}`;
const unknownDate = () => ({ precision: 'unknown', value: null, start: null, end: null, nullReasons: { value: 'not_reported', start: 'not_applicable', end: 'not_applicable' } });
const required = (text, label) => {
  if (typeof text !== 'string' || !text.trim()) throw new Error(`${label} is required.`);
  return text.trim();
};

// DOM Range offsets are UTF-16. Count only after locating exact boundaries, never by searching quoted text.
export function selectedPassage(root, selection, revision) {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed ||
      revision.normalizedContent === null || root.textContent !== revision.normalizedContent) return null;
  const range = selection.getRangeAt(0);
  function offset(target, boundary) {
    let result = null, length = 0;
    function walk(node) {
      if (node === target) {
        const children = [...node.childNodes];
        const limit = node.nodeType === 3 ? node.textContent.length : children.length;
        if (!Number.isInteger(boundary) || boundary < 0 || boundary > limit) return;
        result = length + (node.nodeType === 3 ? boundary : children.slice(0, boundary).reduce((n, child) => n + child.textContent.length, 0));
      }
      if (node.nodeType === 3) length += node.textContent.length;
      else for (const child of node.childNodes) walk(child);
    }
    walk(root);
    return result;
  }
  const start = offset(range.startContainer, range.startOffset), end = offset(range.endContainer, range.endOffset);
  const text = revision.normalizedContent;
  const splitsPair = i => i > 0 && /[\uD800-\uDBFF]/.test(text[i - 1]) && /[\uDC00-\uDFFF]/.test(text[i] ?? '');
  if (start === null || end === null || end <= start || splitsPair(start) || splitsPair(end)) return null;
  const from = [...text.slice(0, start)].length, to = [...text.slice(0, end)].length;
  return { sourceRevisionId: revision.id, revisionHash: revision.normalizedHash,
    start: from, end: to, text: text.slice(start, end), locator: `code-points:${from}-${to}` };
}

export function createStudio(base) {
  return { base, intakes: [], cases: [], drafts: [], selection: null, sourceId: '', revisionId: '' };
}
export function studioSources(state) { return [...state.base.sources, ...state.intakes.map(i => i.source)]; }
export function studioRevisions(state) { return [...state.base.sourceRevisions, ...state.intakes.map(i => i.revision)]; }
export function studioCases(state) { return [...state.base.cases, ...state.cases]; }

export async function pasteArticle(state, input) {
  const raw = input.text;
  if (typeof raw !== 'string' || !raw.trim() || raw.includes('\0') || !raw.isWellFormed()) throw new Error('Supply nonempty, well-formed text without NUL.');
  if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024) throw new Error('Article exceeds the 2 MiB intake limit.');
  const supplier = required(input.suppliedBy, 'Supplier identifier');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(supplier)) throw new Error('Supplier must be a 1–64 character ASCII identifier.');
  const originalUrl = required(input.url, 'Canonical HTTPS URL');
  const url = new URL(originalUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a credential-free HTTPS URL; no fetch is performed.');
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(name) || ['fbclid', 'gclid'].includes(name.toLowerCase())) url.searchParams.delete(name);
  }
  const canonicalUrl = url.href, normalizedContent = normalizeSuppliedText(raw);
  const sourceId = await identity('source', `https-tracking/1\n${canonicalUrl}`);
  if (studioSources(state).some(s => s.canonicalUrl === canonicalUrl)) throw new Error('This URL already has a source. Select its retained revision; intake does not overwrite snapshots or metadata.');
  const provenance = { kind: 'supplied-text', suppliedBy: supplier, description: 'Operator-pasted article; HTML retained as literal text. Pending private studio proposal; no fetch or approval.', nullReasons: {} };
  const fields = { sourceId, rawHash: await hashText(raw), normalizedHash: await hashText(normalizedContent), normalizationVersion: 'unicode-lf-nfc/1', parserVersion: 'utf8-text/1' };
  const revision = { id: await identity('source-revision', serializeProposal(fields)), ...fields, provenance,
    rawContent: raw, normalizedContent, retention: 'private', nullReasons: {} };
  const source = { id: sourceId, originalUrl, canonicalUrl, title: input.title?.trim() || null,
    publisher: input.publisher?.trim() || null, author: input.author?.trim() || null,
    publicationDate: unknownDate(), updateDate: unknownDate(), retrievalDate: unknownDate(),
    inputKind: 'supplied-text', provenance, revisionIds: [revision.id], extractionStatus: 'Not started', collectionState: 'Collected', nullReasons: {} };
  for (const key of ['title', 'publisher', 'author']) if (source[key] === null) source.nullReasons[key] = 'not_reported';
  state.intakes.push({ source, revision });
  state.sourceId = source.id; state.revisionId = revision.id; state.selection = null;
  return revision;
}

export function addStudioCase(state, name, kind) {
  if (!['Campaign', 'Incident', 'Research exercise', 'Comparator', 'Composite playbook', 'Other'].includes(kind)) throw new Error('Select a case kind.');
  const record = { id: newId('case'), name: required(name, 'Case name'), kind, aliases: [],
    summary: null, summaryClaimIds: [], sourceIds: [], collectionState: 'Extracted — review pending',
    limits: 'Explicit curator draft; not reviewed.', origin: 'Human authored', disposition: 'Pending', revision: 'r1', history: [], nullReasons: { summary: 'not_reported' } };
  state.cases.push(record);
  return record;
}

export function saveDraft(state, input) {
  const revision = studioRevisions(state).find(r => r.id === state.revisionId && r.sourceId === state.sourceId);
  if (!revision || revision.normalizedContent === null) throw new Error('Select a retained source revision.');
  if (!studioCases(state).some(c => c.id === input.caseId)) throw new Error('Select or explicitly create a case.');
  const description = required(input.description, 'Claim description');
  if (!EVIDENCE.includes(input.evidenceStatus)) throw new Error('Select an evidence status.');
  const inference = input.evidenceStatus === 'Researcher inference';
  let basis = null, passages = [];
  if (inference) {
    const rationale = required(input.rationale, 'Inference rationale');
    const support = [...new Set(input.supportingClaimIds ?? [])];
    if (!support.length || support.some(id => !state.drafts.some(d => d.claim.id === id && d.claim.caseId === input.caseId))) {
      throw new Error('Inference requires at least one earlier same-case draft claim.');
    }
    basis = { rationale, supportingClaimIds: support };
  } else {
    const p = state.selection, points = [...revision.normalizedContent];
    if (!p || p.sourceRevisionId !== revision.id || p.revisionHash !== revision.normalizedHash ||
        !Number.isSafeInteger(p.start) || !Number.isSafeInteger(p.end) || p.start < 0 || p.end <= p.start ||
        p.end > points.length || p.text !== points.slice(p.start, p.end).join('')) throw new Error('Select an exact passage in the active revision before saving.');
    passages = [{ id: newId('passage'), locator: p.locator, start: p.start, end: p.end, text: p.text }];
  }
  const dimensions = [];
  for (const [dimension, values] of Object.entries(input.dimensions ?? {})) {
    if (!Object.hasOwn(DIMENSIONS, dimension) || !Array.isArray(values)) throw new Error('Unknown categorization dimension.');
    for (const value of new Set(values)) {
      if (!DIMENSIONS[dimension].includes(value)) throw new Error('Unknown categorization value.');
      dimensions.push({ dimension, value, otherText: value === 'other' ? required(input.otherDelivery, 'Other delivery detail') : null });
    }
  }
  const candidateTechniques = [...new Set(input.techniques ?? [])].map(id => {
    if (!/^(?:T\d{4}(?:\.\d{3})?|AML\.T\d{4}(?:\.\d{3})?)$/.test(id)) throw new Error('Technique IDs must use ATT&CK T#### or ATLAS AML.T#### notation.');
    return { id, framework: id.startsWith('AML.') ? 'ATLAS' : 'ATT&CK', status: 'Unverified candidate — not an official mapping' };
  });
  const behavior = input.behavior?.trim() || '';
  if ((candidateTechniques.length || input.artifacts?.trim()) && !behavior) throw new Error('Add a behavior description for artifacts or technique candidates.');
  const claim = { id: newId('claim'), caseId: input.caseId, sourceId: revision.sourceId, sourceRevisionId: revision.id,
    revisionHash: revision.normalizedHash, description, evidenceStatus: input.evidenceStatus,
    origin: inference ? 'Human inference' : 'Human source paraphrase', passages,
    ...(basis ? { inference: basis } : {}), uncertainty: input.uncertainty?.trim() || null };
  state.drafts.push({ claim, dimensions, behavior, artifacts: (input.artifacts ?? '').split('\n').map(s => s.trim()).filter(Boolean), candidateTechniques });
  state.selection = null;
  return claim;
}

export function extractionProposal(state) {
  if (!state.drafts.length) throw new Error('Save at least one grounded claim first.');
  if (state.drafts.some(d => !state.base.cases.some(c => c.id === d.claim.caseId) ||
      !state.base.sourceRevisions.some(r => r.id === d.claim.sourceRevisionId && r.normalizedHash === d.claim.revisionHash))) {
    throw new Error('New intake/cases require the private corpus proposal download, not the existing-record extraction CLI.');
  }
  return { schemaVersion: 'manual-extraction/1', claims: structuredClone(state.drafts.map(d => d.claim)) };
}

export async function corpusProposal(state) {
  if (!state.drafts.length && !state.intakes.length) throw new Error('Paste an article or save a claim first.');
  const baseDigest = await hashText(serializeProposal(state.base));
  const proposal = { schemaVersion: '0.3.0', name: 'PRIVATE pending curator proposal — not a release or replacement corpus',
    sources: [], sourceRevisions: [], passages: [], cases: [], claims: [], categorizations: [], timelines: [], reviews: [], collectionManifests: [], behaviors: [],
    governance: { ...(state.base.governance.synthetic ? { synthetic: true } : {}), studio: { version: 'curator-studio/1', baseDigest, contextCaseIds: [], contextSourceIds: [],
      limitations: ['Private retained text. All authored records pending; no approval.', 'Context records identify dependencies, not edits to existing records. Do not overwrite a corpus with this proposal.', 'Technique IDs are unverified candidates, not catalog entries or reviewed mappings.'] } } };
  const revisionIds = new Set([...state.intakes.map(i => i.revision.id), ...state.drafts.map(d => d.claim.sourceRevisionId)]);
  proposal.sourceRevisions = structuredClone(studioRevisions(state).filter(r => revisionIds.has(r.id)));
  const sourceIds = new Set(proposal.sourceRevisions.map(r => r.sourceId));
  proposal.sources = structuredClone(studioSources(state).filter(s => sourceIds.has(s.id)));
  for (const source of proposal.sources) {
    source.revisionIds = proposal.sourceRevisions.filter(r => r.sourceId === source.id).map(r => r.id);
    source.collectionState = 'Extracted — review pending';
    source.extractionStatus = state.drafts.some(d => d.claim.sourceId === source.id) ? 'Extracted' : 'Not started';
    if (state.base.sources.some(s => s.id === source.id)) proposal.governance.studio.contextSourceIds.push(source.id);
  }
  for (const caseId of new Set(state.drafts.map(d => d.claim.caseId))) {
    const source = studioCases(state).find(c => c.id === caseId);
    const context = state.base.cases.some(c => c.id === caseId);
    if (context) proposal.governance.studio.contextCaseIds.push(caseId);
    proposal.cases.push({ id: caseId, name: source.name, kind: source.kind, aliases: [], summary: null, summaryClaimIds: [],
      sourceIds: [...new Set(state.drafts.filter(d => d.claim.caseId === caseId).map(d => d.claim.sourceId))],
      limits: context ? 'Context identity only; not a proposed change to the existing case or its reviews.' : source.limits,
      collectionState: 'Extracted — review pending', origin: source.origin, disposition: 'Pending', revision: 'r1', history: [], nullReasons: { summary: 'not_reported' } });
  }
  for (const draft of state.drafts) {
    const { revisionHash, passages, ...item } = structuredClone(draft.claim);
    const claim = { ...item, passageIds: passages.map(p => p.id), inference: item.inference ?? null, conflictsWith: [],
      observationContext: null, disposition: 'Pending', revision: 'r1', history: [],
      nullReasons: { observationContext: 'not_applicable', ...(!item.inference ? { inference: 'not_applicable' } : {}), ...(item.uncertainty === null ? { uncertainty: 'unknown' } : {}) } };
    proposal.claims.push(claim);
    proposal.passages.push(...passages.map(p => ({ ...p, sourceRevisionId: claim.sourceRevisionId, attestation: null, nullReasons: { attestation: 'not_applicable' } })));
    for (const [index, category] of draft.dimensions.entries()) proposal.categorizations.push({
      id: `${claim.id}-category-${index}`, caseId: claim.caseId, ...category, supportingClaimIds: [claim.id], sourceIds: [claim.sourceId],
      origin: 'Human authored', disposition: 'Pending', revision: 'r1', history: [], nullReasons: category.otherText === null ? { otherText: 'not_applicable' } : {},
    });
    if (draft.behavior) proposal.behaviors.push({ id: `${claim.id}-behavior`, namespace: 'local', name: draft.behavior,
      description: draft.behavior, boundary: 'Curator-described behavior; applicability pending review.', claimIds: [claim.id],
      artifacts: [...draft.artifacts], candidateTechniques: structuredClone(draft.candidateTechniques),
      signalIds: [], detectionIds: [], otelIds: [], origin: 'Human authored', disposition: 'Pending' });
  }
  return proposal;
}

export function downloadProposal(doc, win, value, filename) {
  const url = win.URL.createObjectURL(new win.Blob([serializeProposal(value)], { type: 'application/json' }));
  const link = element(doc, 'a');
  link.href = url; link.download = filename;
  doc.body.append(link);
  try { link.click(); } finally { link.remove(); win.setTimeout(() => win.URL.revokeObjectURL(url), 1000); }
}

export function renderStudio(doc, win, state) {
  const panel = element(doc, 'section', null, 'panel studio');
  panel.append(element(doc, 'h2', 'Ingestion & curator studio'),
    element(doc, 'p', 'PRIVATE · pending drafts only. No server writes, model calls or source fetches. Drafts survive tab navigation, but not reload or corpus switching. Download before leaving.'),
    element(doc, 'p', 'Supply only material you are authorized to retain. Downloads contain private source text; protect them like your corpus.'));
  const message = element(doc, 'p', '', 'studio-message'); message.setAttribute('role', 'status');
  panel.append(message);
  function run(fn) {
    return async () => {
      try { await fn(); } catch (error) { message.textContent = error.message; }
    };
  }
  function control(parent, label, tag = 'input', options = []) {
    const wrapper = element(doc, 'label', label), input = element(doc, tag);
    input.setAttribute('aria-label', label);
    if (tag === 'select') for (const [value, text] of options) {
      const option = element(doc, 'option', text); option.value = value; input.append(option);
    }
    wrapper.append(input); parent.append(wrapper); return input;
  }
  const intake = element(doc, 'details'), intakeBody = element(doc, 'div', null, 'studio-fields');
  intake.append(element(doc, 'summary', 'Direct article intake / paste'));
  const url = control(intakeBody, 'Canonical HTTPS URL'), title = control(intakeBody, 'Title (optional)');
  const publisher = control(intakeBody, 'Publisher (optional)'), author = control(intakeBody, 'Author (optional)');
  const suppliedBy = control(intakeBody, 'Supplier identifier');
  const raw = control(intakeBody, 'Raw text / HTML (retained literally, never rendered as markup)', 'textarea');
  raw.rows = 7;
  intakeBody.append(element(doc, 'p', 'Normalization: CRLF/CR → LF, Unicode NFC. HTML tags remain literal text, as in CLI supplied-text intake. No publication/retrieval date is inferred.'));
  const paste = action(doc, 'Retain article in draft', run(async () => {
    paste.disabled = true;
    try {
      await pasteArticle(state, { url: url.value, title: title.value, publisher: publisher.value, author: author.value, suppliedBy: suppliedBy.value, text: raw.value });
      refresh();
    } finally { paste.disabled = false; }
  }));
  intakeBody.append(paste); intake.append(intakeBody); panel.append(intake);
  const workspace = element(doc, 'div', null, 'evidence-split');
  const evidence = element(doc, 'section'), drawer = element(doc, 'section', null, 'studio-fields');
  drawer.setAttribute('aria-label', 'Claim drafting drawer');
  const sources = studioSources(state), revisions = studioRevisions(state);
  if (!sources.some(s => s.id === state.sourceId)) state.sourceId = sources[0]?.id ?? '';
  let revision = revisions.find(r => r.id === state.revisionId && r.sourceId === state.sourceId) ?? revisions.filter(r => r.sourceId === state.sourceId).at(-1);
  if (state.revisionId !== revision?.id) state.selection = null;
  state.revisionId = revision?.id ?? '';
  const sourceSelect = control(evidence, 'Source', 'select', sources.map(s => [s.id, s.title ?? s.id]));
  sourceSelect.value = state.sourceId;
  sourceSelect.addEventListener('change', () => { state.sourceId = sourceSelect.value; state.revisionId = ''; state.selection = null; refresh(); });
  const revisionSelect = control(evidence, 'Exact source revision', 'select', revisions.filter(r => r.sourceId === state.sourceId).map(r => [r.id, r.id]));
  revisionSelect.value = state.revisionId;
  revisionSelect.addEventListener('change', () => { state.revisionId = revisionSelect.value; state.selection = null; refresh(); });
  evidence.append(element(doc, 'h3', 'Select a passage'), element(doc, 'p', 'Drag across text, extend a selection with Shift + arrow keys, or use Select entire revision. Selection is captured by revision/hash; saving consumes it. Use Clear selection to discard it.'));
  const text = element(doc, 'div', revision?.normalizedContent ?? 'No retained text. Paste an article or choose another revision.', 'source-text');
  text.tabIndex = 0; text.setAttribute('aria-label', 'Selectable normalized source text');
  const selectionLabel = element(doc, 'p'), quote = element(doc, 'blockquote');
  selectionLabel.setAttribute('role', 'status');
  function showSelection() {
    const p = state.selection;
    selectionLabel.textContent = p ? `${p.sourceRevisionId} · ${p.locator} · [${p.start}, ${p.end}) · SHA-256 ${p.revisionHash}` : 'No active passage selection.';
    quote.textContent = p?.text ?? '';
  }
  function capture() { state.selection = revision ? selectedPassage(text, win.getSelection(), revision) : null; showSelection(); }
  text.addEventListener('pointerup', capture); text.addEventListener('keyup', capture);
  evidence.append(text, selectionLabel, quote,
    action(doc, 'Select entire revision', () => {
      if (!revision || revision.normalizedContent === null || !revision.normalizedContent.length) return;
      const length = [...revision.normalizedContent].length;
      state.selection = { sourceRevisionId: revision.id, revisionHash: revision.normalizedHash,
        start: 0, end: length, text: revision.normalizedContent, locator: `code-points:0-${length}` };
      showSelection();
    }),
    action(doc, 'Clear selection', () => { state.selection = null; win.getSelection()?.removeAllRanges(); showSelection(); }));
  showSelection();
  drawer.append(element(doc, 'h3', 'Grounded claim & behavior'));
  const caseSelect = control(drawer, 'Case', 'select', [['', 'Choose a case'], ...studioCases(state).map(c => [c.id, c.name])]);
  const newCase = element(doc, 'details'); newCase.append(element(doc, 'summary', 'Explicitly create a draft case'));
  const name = control(newCase, 'New case name');
  const kind = control(newCase, 'New case kind', 'select', ['', 'Campaign', 'Incident', 'Research exercise', 'Comparator', 'Composite playbook', 'Other'].map(v => [v, v || 'Choose a kind']));
  newCase.append(action(doc, 'Create draft case', run(() => {
    const record = addStudioCase(state, name.value, kind.value);
    const option = element(doc, 'option', record.name); option.value = record.id; caseSelect.append(option); caseSelect.value = record.id;
    updateSupport();
    newCase.open = false; message.textContent = 'Draft case created explicitly; no attribution inferred.';
  }))); drawer.append(newCase);
  const description = control(drawer, 'Claim description', 'textarea');
  const status = control(drawer, 'Evidence status', 'select', EVIDENCE.map(v => [v, v]));
  status.value = EVIDENCE[0];
  const uncertainty = control(drawer, 'Uncertainty (optional)', 'textarea');
  const rationale = control(drawer, 'Researcher-inference rationale', 'textarea');
  const support = element(doc, 'fieldset');
  support.append(element(doc, 'legend', 'Inference support: earlier same-case draft claims (required for inference)'));
  const supporting = state.drafts.map(d => {
    const input = control(support, d.claim.description); input.type = 'checkbox'; input.value = d.claim.id;
    return { input, caseId: d.claim.caseId };
  });
  function updateSupport() {
    for (const item of supporting) {
      item.input.disabled = item.caseId !== caseSelect.value;
      if (item.input.disabled) item.input.checked = false;
    }
  }
  caseSelect.addEventListener('change', updateSupport); updateSupport(); drawer.append(support);
  const behavior = control(drawer, 'Behavior description (optional)', 'textarea');
  const categories = [];
  for (const [dimension, values] of Object.entries(DIMENSIONS)) {
    const group = element(doc, 'fieldset'); group.append(element(doc, 'legend', `${dimension} · multi-label`));
    for (const value of values) {
      const input = control(group, value); input.type = 'checkbox'; categories.push({ dimension, value, input });
    }
    drawer.append(group);
  }
  const other = control(drawer, 'Other delivery detail (required when selected)');
  const artifacts = control(drawer, 'IOCs / artifacts (one per line; text only)', 'textarea');
  const catalog = element(doc, 'fieldset'); catalog.append(element(doc, 'legend', 'Candidate techniques from the loaded catalog · not reviewed mappings'));
  const techniques = (state.base.frameworks ?? []).filter(t => ['ATT&CK', 'ATLAS'].includes(t.framework)).map(t => {
    const input = control(catalog, `${t.framework} ${t.id} · ${t.name} · ${t.version}`); input.type = 'checkbox'; input.value = t.id; return input;
  });
  if (!techniques.length) catalog.append(element(doc, 'p', 'No local catalog loaded. Enter candidate IDs below; no remote catalog is fetched.'));
  drawer.append(catalog);
  const ids = control(drawer, 'Additional candidate IDs (comma-separated T#### / AML.T####)');
  drawer.append(element(doc, 'p', 'IDs are recorded as unverified candidates, never fabricated official catalog records.'));
  drawer.append(action(doc, 'Save pending claim', run(() => {
    saveDraft(state, { caseId: caseSelect.value, description: description.value, evidenceStatus: status.value,
      uncertainty: uncertainty.value, rationale: rationale.value, supportingClaimIds: supporting.filter(s => s.input.checked).map(s => s.input.value),
      behavior: behavior.value, artifacts: artifacts.value, otherDelivery: other.value,
      dimensions: Object.fromEntries(Object.keys(DIMENSIONS).map(d => [d, categories.filter(c => c.dimension === d && c.input.checked).map(c => c.value)])),
      techniques: [...techniques.filter(i => i.checked).map(i => i.value), ...ids.value.split(',').map(s => s.trim()).filter(Boolean)] });
    refresh();
  })));
  workspace.append(evidence, drawer); panel.append(workspace);
  const drafts = element(doc, 'section');
  drafts.append(element(doc, 'h3', `Saved pending claims · ${state.drafts.length}`));
  for (const draft of state.drafts) {
    const card = element(doc, 'article', null, 'claim-card');
    card.append(element(doc, 'p', `${draft.claim.description} · ${draft.claim.evidenceStatus} · ${draft.claim.origin} · Pending`),
      element(doc, 'p', draft.claim.inference ? `Inference: ${draft.claim.inference.rationale}` : draft.claim.passages.map(p => `${p.locator}: ${p.text}`).join('\n')),
      element(doc, 'p', [draft.behavior, ...draft.dimensions.map(d => `${d.dimension}: ${d.value}`), ...draft.artifacts, ...draft.candidateTechniques.map(t => t.id)].join(' · ')),
      action(doc, 'Remove draft claim', run(() => {
        if (state.drafts.some(d => d.claim.inference?.supportingClaimIds.includes(draft.claim.id))) throw new Error('Remove dependent inference drafts first.');
        state.drafts = state.drafts.filter(d => d !== draft); refresh();
      })));
    drafts.append(card);
  }
  drafts.append(element(doc, 'p', 'Extraction download contains only claims/passages for existing sources and cases; behavior, categories and intake metadata are in the private corpus proposal. Neither download approves research.'),
    action(doc, 'Download manual-extraction/1', run(() => downloadProposal(doc, win, extractionProposal(state), 'manual-extraction.json'))),
    action(doc, 'Download private corpus proposal', run(async () => downloadProposal(doc, win, await corpusProposal(state), 'curator-proposal.json'))));
  panel.append(drafts);
  function refresh() { panel.replaceWith(renderStudio(doc, win, state)); }
  return panel;
}
