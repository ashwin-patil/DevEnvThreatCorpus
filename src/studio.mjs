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
  return { base, intakes: [], cases: [], drafts: [], selection: null, sourceId: '', revisionId: '',
    webIntake: { urls: '', operator: '', caseId: '', caseName: '', waiting: false, results: [], error: '', resultCaseId: '' },
    campaign: { caseId: '', requestedModel: '', waiting: false, error: '', preparedRequest: null,
      preparedCaseId: '', candidate: null, candidateName: '', summary: null } };
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

export function webIntakeInput(state) {
  const urls = state.urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
  if (!urls.length || urls.length > 20) throw new Error('Supply 1–20 HTTPS URLs, one per line.');
  for (const value of urls) {
    let url;
    try { url = new URL(value); } catch { throw new Error('Every line must be a valid HTTPS URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 8192) throw new Error('Use credential-free HTTPS URLs, up to 8192 characters per line.');
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(state.operator)) throw new Error('Operator must be a 1–64 character ASCII identifier.');
  if (Boolean(state.caseId) === Boolean(state.caseName.trim())) throw new Error('Choose an existing campaign OR enter a new pending campaign name.');
  if (state.caseName.length > 200 || /[\u0000-\u001f]/u.test(state.caseName)) throw new Error('Campaign name must be at most 200 characters without control characters.');
  return { urls: [...new Set(urls)], operator: state.operator,
    ...(state.caseId ? { caseId: state.caseId } : { caseName: state.caseName.trim() }) };
}

export function renderWebIntake(doc, state, { enabled = false, collect, refresh, navigate } = {}) {
  const section = element(doc, 'section', null, 'web-intake');
  section.append(element(doc, 'h3', 'Fetch articles into a private campaign'),
    element(doc, 'p', 'Maximum 20 public HTTPS URLs per batch, one per line. Collection persists locally; new campaigns remain Pending. It does not accept evidence or perform review.'));
  const failures = state.base.collectionManifests.filter(manifest => manifest.outcome === 'Failed');
  if (failures.length) {
    const retained = element(doc, 'details');
    retained.append(element(doc, 'summary', `Persisted failed intake attempts (${failures.length}) — not successful evidence`));
    for (const manifest of failures) {
      const item = element(doc, 'div', null, 'intake-outcome');
      item.append(element(doc, 'p', `Failed intake ${manifest.id} · operator ${manifest.provenance.suppliedBy ?? 'unknown'}`));
      for (const detail of manifest.limitations.filter(text => /^(?:error-code|event-time)=/.test(text))) item.append(element(doc, 'p', detail));
      for (const id of manifest.inputSourceIds) {
        const source = state.base.sources.find(record => record.id === id);
        item.append(element(doc, 'p', source?.originalUrl ?? `Source ${id}`));
        if (navigate) item.append(action(doc, 'Open failed intake context', () => navigate('sources', id)));
      }
      retained.append(item);
    }
    section.append(retained);
  }
  if (!enabled) {
    section.append(element(doc, 'p', state.base.governance?.synthetic ?
      'Synthetic demo is read-only. Reload the local corpus to collect into your private store.' :
      'Collection is disabled. Start the local backend with --store /absolute/private/store; --corpus and no-store modes remain read-only.'));
    return section;
  }
  const batch = state.webIntake, form = element(doc, 'form', null, 'studio-fields');
  form.addEventListener('submit', event => event.preventDefault());
  function control(label, key, tag = 'input') {
    const wrapper = element(doc, 'label', label), input = element(doc, tag);
    input.setAttribute('aria-label', label); input.disabled = batch.waiting;
    wrapper.append(input); form.append(wrapper);
    input.addEventListener(tag === 'select' ? 'change' : 'input', () => { batch[key] = input.value; });
    return input;
  }
  const campaign = control('Existing campaign (or leave blank to create)', 'caseId', 'select');
  const blank = element(doc, 'option', 'Create a new pending campaign'); blank.value = ''; campaign.append(blank);
  for (const record of state.base.cases) {
    const option = element(doc, 'option', `${record.name} · ${record.kind} · ${record.disposition}`);
    option.value = record.id; campaign.append(option);
  }
  campaign.value = batch.caseId;
  const name = control('New pending campaign name (only when no existing campaign selected)', 'caseName');
  name.value = batch.caseName; name.maxLength = 200;
  const operator = control('Operator identifier', 'operator');
  operator.value = batch.operator; operator.maxLength = 64;
  const urls = control('Article URLs (one per line; maximum 20)', 'urls', 'textarea');
  urls.value = batch.urls; urls.rows = 6; urls.maxLength = 20 * 8193;
  const fetchButton = action(doc, batch.waiting ? 'Fetching articles…' : 'Fetch articles', async () => {
    if (!batch.waiting) await collect();
  });
  fetchButton.disabled = batch.waiting;
  const clear = action(doc, 'Clear URLs', () => { batch.urls = ''; refresh(); });
  clear.disabled = batch.waiting;
  form.append(fetchButton, clear); section.append(form);
  const message = element(doc, 'p', batch.waiting ? 'Fetching sequentially. Wait for per-URL outcomes; do not resubmit. No automatic batch retries.' : batch.error, 'studio-message');
  message.setAttribute('role', 'status'); section.append(message);
  if (batch.results.length) {
    section.append(element(doc, 'h4', 'Per-URL collection outcomes'));
    for (const result of batch.results) {
      const item = element(doc, 'div', null, 'intake-outcome');
      item.append(element(doc, 'p', `${result.url} · ${result.status} · ${result.code ?? ''}`));
      for (const warning of result.warnings ?? []) item.append(element(doc, 'p', `Image warning: ${typeof warning === 'string' ? warning : JSON.stringify(warning)}`));
      if (result.status === 'failed') {
        const label = element(doc, 'label', 'Select failed URL for manual retry'), selected = element(doc, 'input');
        selected.type = 'checkbox'; selected.checked = Boolean(result.selected); selected.disabled = batch.waiting;
        selected.addEventListener('change', () => { result.selected = selected.checked; });
        label.append(selected); item.append(label);
      } else if (result.sourceId && navigate) item.append(action(doc, 'Open retained source', () => navigate('sources', result.sourceId, result.revisionId)));
      section.append(item);
    }
    if (batch.results.some(result => result.status === 'failed')) {
      const retry = action(doc, 'Use selected failed URLs (does not fetch)', () => {
        const selected = batch.results.filter(result => result.status === 'failed' && result.selected);
        batch.error = selected.length ? 'Selected failed URLs are in the input. Click Fetch articles to retry explicitly.' : 'Select at least one failed URL.';
        if (selected.length) batch.urls = selected.map(result => result.url).join('\n');
        refresh();
      });
      retry.disabled = batch.waiting; section.append(retry);
    }
    if (batch.resultCaseId && navigate) section.append(action(doc, 'Open campaign and all citations', () => navigate('cases', batch.resultCaseId)));
  }
  return section;
}

export const CAMPAIGN_FILE_LIMIT = 2 * 1024 * 1024;

export async function campaignCandidate(file) {
  if (!file) throw new Error('Choose a returned candidate JSON file.');
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > CAMPAIGN_FILE_LIMIT) {
    throw new Error('Candidate JSON must be at most 2 MiB.');
  }
  let value;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error('Candidate file must be valid UTF-8 JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Candidate JSON must be an object.');
  return value;
}

export function renderCampaignEnrichment(doc, win, state, {
  enabled = false, prepareCampaign, importCampaign, campaignStatus = {}, campaignStatusError = '',
} = {}, refresh = () => {}) {
  const section = element(doc, 'section', null, 'campaign-enrichment');
  section.append(element(doc, 'h3', 'Enrich campaign'),
    element(doc, 'p', 'Two-step private handoff. This workbench does not call a model service: prepare and download the bounded request, use the configured Codex chat with a researcher, then import its returned JSON against that same request.'));
  if (campaignStatusError) section.append(element(doc, 'p', campaignStatusError, 'enrichment-warning'));
  const campaign = state.campaign;
  const wrapper = element(doc, 'label', 'Existing campaign '), select = element(doc, 'select');
  select.setAttribute('aria-label', 'Campaign to enrich');
  select.append(element(doc, 'option', 'Choose an existing campaign'));
  select.firstChild.value = '';
  for (const record of state.base.cases) {
    const option = element(doc, 'option', `${record.name} · ${record.disposition}`);
    option.value = record.id; select.append(option);
  }
  select.value = campaign.caseId; select.disabled = !enabled || campaign.waiting;
  select.addEventListener('change', () => {
    campaign.caseId = select.value; campaign.preparedRequest = null; campaign.preparedCaseId = '';
    campaign.candidate = null; campaign.candidateName = ''; campaign.summary = null; campaign.error = ''; refresh();
  });
  wrapper.append(select); section.append(wrapper);
  if (!enabled) {
    section.append(element(doc, 'p', state.base.governance?.synthetic ?
      'Campaign enrichment is disabled for the read-only synthetic demo.' :
      'Campaign enrichment is disabled. Start the local backend with --store /absolute/private/store.'));
    const disabled = action(doc, 'Prepare & download private request', () => {});
    disabled.disabled = true; section.append(disabled); return section;
  }
  const requested = element(doc, 'input');
  requested.setAttribute('aria-label', 'Requested model (optional)');
  requested.value = campaign.requestedModel; requested.maxLength = 200; requested.disabled = campaign.waiting;
  requested.addEventListener('input', () => { campaign.requestedModel = requested.value; });
  const requestedLabel = element(doc, 'label', 'Requested model (optional) '); requestedLabel.append(requested);
  section.append(element(doc, 'h4', 'Step 1 — prepare request'), requestedLabel);
  const prepare = action(doc, campaign.waiting ? 'Working…' : 'Prepare & download private request', async () => {
    if (campaign.waiting) return;
    if (!campaign.caseId) { campaign.error = 'Choose an existing campaign first.'; refresh(); return; }
    campaign.waiting = true; campaign.error = ''; refresh();
    try {
      const result = await prepareCampaign({ caseId: campaign.caseId,
        ...(campaign.requestedModel.trim() ? { requestedModel: campaign.requestedModel.trim() } : {}) });
      if (result.status !== 'succeeded' || !result.request) throw new Error(result.message ?? `Preparation failed (${result.code ?? 'unknown'}).`);
      campaign.preparedRequest = result.request; campaign.preparedCaseId = campaign.caseId;
      campaign.candidate = null; campaign.candidateName = ''; campaign.summary = result.summary ?? null;
      downloadProposal(doc, win, result.request, `campaign-${campaign.caseId}-request.json`);
    } catch (error) { campaign.error = error.message; }
    finally { campaign.waiting = false; refresh(); }
  });
  prepare.disabled = campaign.waiting || !campaign.caseId; section.append(prepare,
    element(doc, 'p', campaign.preparedRequest ?
      `Prepared request for ${campaign.preparedCaseId}. Send only this downloaded request to the configured Codex chat; researcher review remains required.` :
      'No request prepared in this browser session.', 'subtle'));

  section.append(element(doc, 'h4', 'Step 2 — choose returned JSON and import'));
  const fileLabel = element(doc, 'label', 'Returned candidate JSON '), file = element(doc, 'input');
  file.type = 'file'; file.accept = 'application/json,.json'; file.disabled = campaign.waiting || !campaign.preparedRequest;
  file.setAttribute('aria-label', 'Returned campaign candidate JSON');
  file.addEventListener('change', async () => {
    campaign.error = ''; campaign.candidate = null; campaign.candidateName = '';
    try {
      campaign.candidate = await campaignCandidate(file.files?.[0]);
      campaign.candidateName = file.files[0].name ?? 'candidate.json';
    } catch (error) { campaign.error = error.message; }
    refresh();
  });
  fileLabel.append(file); section.append(fileLabel,
    element(doc, 'p', campaign.candidateName ? `Selected ${campaign.candidateName}; import remains bound to the prepared request for ${campaign.preparedCaseId}.` :
      'Choose one JSON object no larger than 2 MiB. The file is size-checked before it is read.', 'subtle'));
  const apply = action(doc, campaign.waiting ? 'Working…' : 'Import candidate against prepared request', async () => {
    if (campaign.waiting || !campaign.preparedRequest || !campaign.candidate) return;
    if (campaign.preparedCaseId !== campaign.caseId) {
      campaign.error = 'The selected campaign no longer matches the prepared request. Prepare a new request.'; refresh(); return;
    }
    campaign.waiting = true; campaign.error = ''; refresh();
    try {
      const result = await importCampaign({ request: campaign.preparedRequest, candidate: campaign.candidate });
      if (result.status !== 'succeeded') throw new Error(result.message ?? `Import failed (${result.code ?? 'unknown'}).`);
      campaign.summary = result.summary ?? {};
      campaign.candidate = null; campaign.candidateName = '';
    } catch (error) { campaign.error = error.message; }
    finally { campaign.waiting = false; refresh(); }
  });
  apply.disabled = campaign.waiting || !campaign.preparedRequest || !campaign.candidate; section.append(apply);

  const status = campaignStatus[campaign.caseId] ?? campaignStatus.get?.(campaign.caseId);
  const summary = campaign.summary ?? {};
  const run = summary.runs?.at(-1) ?? status?.runs?.at(-1);
  const coverage = run?.coverage ?? summary.coverage;
  const totals = Array.isArray(coverage) ? coverage.reduce((result, item) => ({
    completed: result.completed + (item.completed ?? 0),
    skipped: result.skipped + (item.skipped ?? 0),
    failed: result.failed + (item.failed ?? 0),
  }), { completed: 0, skipped: 0, failed: 0 }) : summary;
  const provider = run?.provider ?? {};
  if (Array.isArray(coverage)) {
    section.append(element(doc, 'p', `Coverage: ${coverage.length} source revision${coverage.length === 1 ? '' : 's'}`));
    for (const row of coverage) section.append(element(doc, 'p',
      `${row.sourceId ?? 'unknown source'} / ${row.sourceRevisionId ?? 'unknown revision'} · ${row.status ?? 'unknown status'} · ` +
      `${row.segments ?? 0} segments · ${row.completed ?? 0} completed · ${row.skipped ?? 0} skipped · ${row.failed ?? 0} failed`));
  } else if (coverage != null) {
    section.append(element(doc, 'p', `Coverage: ${typeof coverage === 'object' ? JSON.stringify(coverage) : coverage}`));
  }
  section.append(element(doc, 'p', `Completed: ${totals.completed ?? 0} · Skipped: ${totals.skipped ?? 0} · Failed: ${totals.failed ?? 0}`),
    element(doc, 'p', `Disposition: ${run?.disposition ?? summary.disposition ?? 'Pending'} · Pending: ${status?.pending ?? true ? 'yes' : 'no'}`),
    element(doc, 'p', `Provider: ${provider.id ?? summary.provider ?? 'not recorded'} · Requested model: ${provider.requestedModel ?? 'not recorded'} · Effective model: ${provider.effectiveModel ?? provider.version ?? summary.effectiveModel ?? summary.modelVersion ?? 'not recorded'} · Prompt version: ${summary.promptVersion ?? run?.promptVersion ?? 'not recorded'}`));
  for (const limitation of [...new Set([...(status?.limitations ?? []), ...(summary.limitations ?? []), ...(run?.limitations ?? [])])]) {
    section.append(element(doc, 'p', `Limitation: ${limitation}`));
  }
  const message = element(doc, 'p', campaign.waiting ? 'Campaign operation in progress; do not resubmit.' : campaign.error, 'studio-message');
  message.setAttribute('role', 'status'); section.append(message);
  return section;
}

export function renderStudio(doc, win, state, collection = {}) {
  const panel = element(doc, 'section', null, 'panel studio');
  panel.append(element(doc, 'h2', 'Ingestion & curator studio'),
    element(doc, 'p', 'PRIVATE · collection remains pending, never automatic acceptance. A configured --store enables explicit backend article fetching and collection writes. Curator annotations and pasted text remain in-memory private drafts; no model calls. Drafts survive tab navigation, but not reload or corpus switching. Download before leaving.'),
    element(doc, 'p', 'Supply only material you are authorized to retain. Downloads contain private source text; protect them like your corpus.'));
  const message = element(doc, 'p', '', 'studio-message'); message.setAttribute('role', 'status');
  panel.append(message);
  panel.append(renderWebIntake(doc, state, collection));
  panel.append(renderCampaignEnrichment(doc, win, state, collection, refresh));
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
  function refresh() { panel.replaceWith(renderStudio(doc, win, state, collection)); }
  return panel;
}
