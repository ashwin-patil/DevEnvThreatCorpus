import { element, action, safeExternalUrl, caseCitations, renderClaim, sourceCitation, claimCitation, technicalDetails, reviewChip, reviewLegend } from './render.mjs';
import { filterRecords, metadata, caseSourceIds } from './model.mjs';
import { publisherDisplay, behaviorInventory } from './research-inventory.mjs';
import { aiLibrary } from './ai-library.mjs';

export const EXPLORE_VIEWS = { paths: 'Attack paths', behaviors: 'Behaviors', tools: 'AI tools', prompts: 'Prompt library', frameworks: 'ATLAS & TTPs', telemetry: 'Security telemetry', otel: 'OpenTelemetry' };
export const ANNOTATION_LABELS = {
  'role-context': 'AI and attacker / victim context', 'observed-behavior': 'Observed behaviors',
  'data-sources': 'Mapped data sources', 'commands-ai-artifacts': 'Commands, prompts and AI tools',
  'traditional-indicators': 'Indicators and CI/CD artifacts', 'ttp-references': 'TTP references',
  'detection-references': 'Public detection references', 'talk-tags': 'Talk tags and notes',
};
export const VIEW_ANNOTATIONS = { behaviors: ['observed-behavior'], frameworks: ['ttp-references'], telemetry: ['data-sources', 'detection-references'] };
const list = (model, key) => model.corpus[key] ?? [];
export const caseAnnotations = (model, id) => (model.annotations ?? []).filter(a => a.caseId === id);
const normalized = a => a.normalizedValue ?? a.value;

function behaviorSupport(model, behavior) {
  return [...new Set([...(behavior.claimIds ?? []),
    ...(behavior.occurrences ?? []).flatMap(o => o.claimIds ?? []),
    ...(model.corpus.governance?.campaignExtraction?.runs ?? []).flatMap(r =>
      (r.recordSupport ?? []).filter(s => s.recordType === 'behaviors' && s.recordId === behavior.id)
        .flatMap(s => s.supportingClaimIds ?? []))])];
}

const USAGE = {
  targeted: ['Targeted', '◇'], 'attempted-abuse': ['Attempted abuse', '◐'],
  'reported-abuse': ['Reported abuse', '●'], 'vendor-example': ['Vendor example', '□'],
  'general-mention': ['General mention', '·'], unclear: ['Unclear', '?'], mixed: ['Mixed source classifications', '◈'],
};
function usageOf(annotations) {
  const values = [...new Set(annotations.map(a => Object.hasOwn(USAGE, a.context?.artifactUsage) ? a.context.artifactUsage : 'unclear'))];
  return values.length === 1 ? values[0] : 'mixed';
}
function usageLegend(doc) {
  const legend = element(doc, 'aside', null, 'usage-legend');
  legend.setAttribute('aria-label', 'AI tool and prompt usage legend');
  legend.append(element(doc, 'strong', 'Usage legend'));
  for (const [key, [label, symbol]] of Object.entries(USAGE)) legend.append(element(doc, 'span', `${symbol} ${label}`, `usage-key usage-${key}`));
  legend.append(element(doc, 'p', 'Each source entry retains its classification. Mixed means linked sources use different classifications.', 'legend-note subtle'));
  return legend;
}
function behaviorLinks(doc, parent, model, claimIds, paths, navigate) {
  const pathIds = new Set(paths.flatMap(p => p.nodes.filter(n => n.claimIds.some(id => claimIds.has(id))).flatMap(n => n.behaviorIds)));
  const behaviors = list(model, 'behaviors').filter(b => pathIds.has(b.id) || behaviorSupport(model, b).some(id => claimIds.has(id)));
  const groups = behaviorInventory(behaviors);
  parent.append(element(doc, 'h3', 'Behaviors'));
  for (const [kind, label] of [['atomic-behavior', 'Actions'], ['activity-pattern', 'Activity patterns']]) {
    const items = groups.filter(g => g.kind === kind); if (!items.length) continue;
    const section = element(doc, 'section', null, `behavior-category ${kind}`);
    section.append(element(doc, 'h4', label));
    section.append(reviewLegend(doc));
    for (const group of items) {
      const chip = reviewChip(doc, group.name, group.members[0].disposition, () => navigate('behaviors', group.members[0].id));
      chip.title = group.basis; section.append(chip);
    }
    parent.append(section);
  }
  if (!behaviors.length) parent.append(element(doc, 'p', 'No linked behaviors recorded. Collection alone does not extract behavior.', 'subtle'));
}
export function renderCaseLibrary(doc, model, records, navigate, filters = {}) {
  const panel = element(doc, 'section', null, 'case-library');
  panel.append(element(doc, 'h2', 'Case library'), element(doc, 'p',
    'One card per campaign or explicitly selected research group. Expand a card to explore its blogs, behaviors, AI tools and prompts. Shared research does not merge campaigns.', 'subtle'), usageLegend(doc));
  const grid = element(doc, 'div', null, 'research-grid');
  for (const record of records) {
    const card = element(doc, 'details', null, 'panel research-card case-card');
    const summary = element(doc, 'summary');
    const claims = model.corpus.claims.filter(c => c.caseId === record.id);
    const sourceIds = caseSourceIds(model, record.id), claimIds = new Set(claims.map(c => c.id));
    summary.append(element(doc, 'h2', record.name), element(doc, 'p', `${sourceIds.length} research sources · ${claims.length} claims · ${record.disposition}`, 'subtle'),
      element(doc, 'span', 'Expand campaign', 'card-expand'));
    card.append(summary);
    const body = element(doc, 'div', null, 'case-card-body');
    body.append(element(doc, 'p', record.summary ?? 'No cited campaign summary recorded.'), element(doc, 'p', record.limits, 'limits'),
      action(doc, 'Open campaign workspace', () => navigate('cases', record.id)));
    body.append(element(doc, 'h3', 'Research blogs'));
    const totals = new Map(), index = new Map();
    for (const id of sourceIds) { const source = model.sources.get(id); if (source) {const name = publisherDisplay(source).name; totals.set(name, (totals.get(name) ?? 0) + 1);} }
    for (const id of sourceIds) {
      const source = model.sources.get(id); if (!source) continue;
      const display = publisherDisplay(source); index.set(display.name, (index.get(display.name) ?? 0) + 1);
      const chip = action(doc, `${display.name}${totals.get(display.name) > 1 ? ` · ${index.get(display.name)}` : ''} ↗`, () => navigate('sources', id));
      chip.title = `${metadata(source, 'title')} · ${display.basis}`; chip.setAttribute('aria-label', `${display.name}: ${metadata(source, 'title')}`); body.append(chip);
    }
    const paths = list(model, 'paths').filter(p => p.caseId === record.id);
    behaviorLinks(doc, body, model, claimIds, paths, navigate);
    body.append(element(doc, 'h3', 'Attack paths'));
    for (const path of paths) body.append(action(doc, path.name ?? `${record.name} attack path`, () => navigate('paths', path.id)));
    if (!paths.length) body.append(element(doc, 'p', 'No supported path recorded.', 'subtle'));
    appendAiLinks(doc, body, model, record.id, navigate);
    card.append(body); grid.append(card);
  }
  panel.append(grid); return panel;
}
export function renderResearchLibrary(doc, model, sources, navigate, filters = {}) {
  const panel = element(doc, 'section', null, 'research-library');
  panel.append(element(doc, 'h2', 'Research library'), element(doc, 'p',
    'One card per blog or research source. Campaign tags open the associated case; one blog can support several cases without combining their attribution. Open a blog to inspect exact revisions and claims.', 'subtle'), usageLegend(doc));
  const grid = element(doc, 'div', null, 'research-grid');
  for (const source of sources) {
    const card = element(doc, 'article', null, 'panel research-card blog-card');
    const cases = model.corpus.cases.filter(c => caseSourceIds(model, c.id).includes(source.id) && (!filters.cases?.length || filters.cases.includes(c.id)));
    const caseIds = new Set(cases.map(c => c.id));
    const claims = model.corpus.claims.filter(c => c.sourceId === source.id && caseIds.has(c.caseId));
    const claimIds = new Set(claims.map(c => c.id));
    card.append(element(doc, 'span', publisherDisplay(source).name, 'publisher-badge'),
      element(doc, 'h2', metadata(source, 'title')), element(doc, 'p', source.revisionIds.length
        ? `${source.collectionState} · ${source.revisionIds.length} retained revision(s)` : 'No retained article revision · source metadata only', 'subtle'),
      action(doc, 'Open research source', () => navigate('sources', source.id)));
    card.append(element(doc, 'h3', 'Campaigns / cases'));
    for (const record of cases) card.append(action(doc, record.name, () => navigate('cases', record.id), 'chip campaign-tag'));
    if (!cases.length) card.append(element(doc, 'p', 'Independent source · no associated case', 'subtle'));
    if (!source.revisionIds.length && model.corpus.collectionManifests.some(m => m.outcome === 'Failed' && m.inputSourceIds.includes(source.id))) card.append(element(doc, 'p', 'Failed intake attempt · article unavailable for extraction.', 'limits'));
    const paths = list(model, 'paths').filter(p => caseIds.has(p.caseId) && p.nodes.some(n => n.claimIds.some(id => claimIds.has(id))));
    behaviorLinks(doc, card, model, claimIds, paths, navigate);
    const evidence = element(doc, 'details'); evidence.append(element(doc, 'summary', `Claims & evidence · ${claims.length}`));
    for (const claim of claims) evidence.append(action(doc, claim.description, () => navigate('claims', claim.id)));
    card.append(evidence);
    for (const [view, label] of [['tools', 'AI tools'], ['prompts', 'Prompts']]) {
      const entries = aiLibrary(model, view, caseIds).filter(r => r.annotations.some(a => a.sourceId === source.id));
      if (!entries.length) continue;
      card.append(element(doc, 'h3', label));
      for (const entry of entries) card.append(aiChip(doc, entry, navigate, view, entry.annotations.filter(a => a.sourceId === source.id)));
    }
    grid.append(card);
  }
  panel.append(grid); return panel;
}
function aiChip(doc, record, navigate, view, annotations = record.annotations) {
  const usage = usageOf(annotations), [label, symbol] = USAGE[usage];
  const chip = action(doc, `${symbol} ${record.name}`, () => navigate(view, record.id), `chip usage-${usage}`);
  chip.title = `${label}. ${record.basis}`; chip.setAttribute('aria-label', `${record.name}: ${label}`); return chip;
}

function reference(doc, url, label = url) {
  const safe = safeExternalUrl(url);
  if (!safe) return element(doc, 'span', label ?? 'No public reference');
  const link = element(doc, 'a', label); link.href = safe; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function appendAiLinks(doc, parent, model, caseId, navigate, sourceIds) {
  for (const [view, label] of [['tools', 'AI tools'], ['prompts', 'Prompts']]) {
    const entries = aiLibrary(model, view, new Set([caseId])).filter(r => !sourceIds || r.annotations.some(a => sourceIds.has(a.sourceId)));
    parent.append(element(doc, 'h3', label));
    for (const r of entries) parent.append(aiChip(doc, r, navigate, view, r.annotations.filter(a => !sourceIds || sourceIds.has(a.sourceId))));
    if (!entries.length) parent.append(element(doc, 'p', 'No grounded entries recorded.', 'subtle'));
  }
}

function row(doc, parent, label, value) {
  if (value == null || (Array.isArray(value) && !value.length)) return;
  const p = element(doc, 'p'); p.append(element(doc, 'strong', `${label}: `),
    element(doc, 'span', Array.isArray(value) ? value.join(', ') : value)); parent.append(p);
}
function provenance(doc, record) {
  return element(doc, 'p', [record.origin, record.evidenceStatus, record.disposition ?? record.status ?? 'Pending',
    record.mappingStatus].filter(Boolean).join(' · '), 'subtle');
}
function support(doc, model, ids, navigate) {
  const section = element(doc, 'details'); section.append(element(doc, 'summary', 'Supporting claims and exact passages'));
  for (const id of [...new Set(ids ?? [])]) {
    const claim = model.claims.get(id);
    if (claim) section.append(renderClaim(doc, model, claim, navigate));
    else section.append(element(doc, 'p', `Unavailable claim: ${id}. No support inferred.`));
  }
  if (!ids?.length) section.append(element(doc, 'p', 'No claim support recorded. This is not established campaign evidence.'));
  return section;
}
function annotationCard(doc, model, annotation, navigate) {
  const card = element(doc, 'article', null, 'claim-card');
  if (annotation.type === 'commands-ai-artifacts') {
    const usage = usageOf([annotation]); card.className += ` usage-${usage}`;
    card.title = USAGE[usage][0]; card.setAttribute('aria-label', `Source artifact: ${USAGE[usage][0]}`);
  }
  card.append(element(doc, 'pre', annotation.value, 'artifact-value'), provenance(doc, annotation));
  if (annotation.normalizedValue) row(doc, card, 'Normalized value', annotation.normalizedValue);
  for (const [key, value] of Object.entries(annotation.context ?? {})) {
    if (key !== 'artifactUsage') row(doc, card, key, value);
  }
  const revision = model.sourceRevisions.get(annotation.sourceRevisionId);
  const locator = annotation.support?.locator;
  const quote = locator && revision?.normalizedContent != null
    ? [...revision.normalizedContent].slice(locator.start, locator.end).join('') : annotation.support?.quote;
  if (quote) card.append(element(doc, 'blockquote', quote));
  if (locator) row(doc, card, 'Code-point passage', `[${locator.start}, ${locator.end})`);
  card.append(technicalDetails(doc, [['Exact revision', annotation.sourceRevisionId], ['Annotation identifier', annotation.id]]));
  row(doc, card, 'Model / prompt', [annotation.modelVersion, annotation.promptVersion].filter(Boolean));
  card.append(sourceCitation(doc, model, annotation.sourceId, navigate, annotation.sourceRevisionId));
  if (annotation.externalReferenceUrl) card.append(reference(doc, annotation.externalReferenceUrl, 'Public reference'));
  return card;
}

export function renderEvidencePanel(doc, model, record, navigate, download) {
  const panel = element(doc, 'section', null, 'panel research-evidence');
  panel.append(element(doc, 'h2', 'Campaign research & talk evidence'),
    element(doc, 'p', 'Private annotations are pending. Evidence-backed describes passage linkage, not independent confirmation. Inferences and unresolved items remain separate.', 'subtle'));
  if (model.annotationError) panel.append(element(doc, 'p', model.annotationError, 'enrichment-warning'));
  if (download) for (const format of ['json', 'md']) panel.append(action(doc, `Download talk bundle (${format === 'md' ? 'Markdown' : 'JSON'})`,
    () => download(format, format === 'md' ? talkMarkdown(talkBundle(model, record.id)) : talkBundle(model, record.id))));
  panel.append(usageLegend(doc));
  const annotations = caseAnnotations(model, record.id);
  appendAiLinks(doc, panel, model, record.id, navigate);
  for (const [type, label] of Object.entries(ANNOTATION_LABELS)) {
    const items = annotations.filter(a => a.type === type);
    const section = element(doc, 'details'); section.open = type === 'observed-behavior';
    section.append(element(doc, 'summary', `${label} · ${items.length}`));
    for (const item of items) section.append(annotationCard(doc, model, item, navigate));
    if (!items.length) section.append(element(doc, 'p', 'No annotations recorded. Import a private talk-enrichment/1 sidecar, then reload the local corpus.'));
    panel.append(section);
  }
  return panel;
}

export function talkBundle(model, caseId) {
  const record = model.cases.get(caseId);
  if (!record) throw new Error('Unknown case; cannot export a talk bundle.');
  const claims = model.corpus.claims.filter(c => c.caseId === caseId);
  const passageIds = new Set(claims.flatMap(c => c.passageIds));
  const paths = list(model, 'paths').filter(p => p.caseId === caseId), mappings = list(model, 'mappings').filter(m => m.caseId === caseId);
  const behaviorIds = new Set([...paths.flatMap(p => p.nodes.flatMap(n => n.behaviorIds)), ...mappings.map(m => m.behaviorId)]);
  return { schemaVersion: 'talk-bundle/1', private: true, warning: 'Research draft. Recorded dispositions do not establish current eligibility or independent approval.',
    corpusSnapshot: model.snapshot ?? null, case: record, citations: caseCitations(model, record).citations,
    claims, passages: model.corpus.passages.filter(p => passageIds.has(p.id)), annotations: caseAnnotations(model, caseId),
    categorizations: model.corpus.categorizations.filter(c => c.caseId === caseId), timelines: model.corpus.timelines.filter(t => t.caseId === caseId),
    paths, mappings, behaviors: list(model, 'behaviors').filter(b => behaviorIds.has(b.id)),
    frameworks: list(model, 'frameworks').filter(t => mappings.some(m => m.techniqueId === t.id)),
    telemetry: list(model, 'telemetry').filter(t => behaviorIds.has(t.behaviorId)),
    detections: list(model, 'detections').filter(d => behaviorIds.has(d.behaviorId)),
    otel: list(model, 'otel').filter(o => behaviorIds.has(o.behaviorId)) };
}
export function talkMarkdown(bundle) {
  // Escape Markdown/HTML punctuation in all imported prose; source text is never executable markup.
  const text = value => String(value ?? 'Unknown').replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&');
  const lines = [`# ${text(bundle.case.name)}`, '', text(bundle.warning), '', `Disposition: ${text(bundle.case.disposition)}`, '',
    '## References', ...bundle.citations.map(c => `- ${text(c.publisher)} — ${text(c.title)} — ${text(c.url)}`), '', '## Claims'];
  for (const claim of bundle.claims) {
    lines.push('', `### ${text(claim.description)}`, text(`${claim.evidenceStatus} · ${claim.origin} · ${claim.disposition}`),
      `Source: ${text(claim.sourceId)} / ${text(claim.sourceRevisionId)}`);
    for (const passage of bundle.passages.filter(p => claim.passageIds.includes(p.id))) lines.push('',
      ...String(passage.text ?? '').split('\n').map(line => `> ${text(line)}`), `Locator: ${text(passage.locator)}`);
    if (claim.inference) lines.push(`Inference rationale: ${text(claim.inference.rationale)}`);
  }
  for (const [type, label] of Object.entries(ANNOTATION_LABELS)) {
    const items = bundle.annotations.filter(a => a.type === type); if (!items.length) continue;
    lines.push('', `## ${label}`);
    for (const a of items) lines.push('', `- ${text(a.value)}`, `  ${text(`${a.evidenceStatus} · ${a.origin} · ${a.status}`)}`,
      `  Source: ${text(a.sourceId)} / ${text(a.sourceRevisionId)}`, `  Context: ${text(JSON.stringify(a.context ?? {}))}`,
      ...(a.support ? [`  Support: ${text(JSON.stringify(a.support))}`] : []),
      ...(a.externalReferenceUrl ? [`  Reference: ${text(a.externalReferenceUrl)}`] : []));
  }
  if (bundle.timelines.length) lines.push('', '## Typed timeline', ...bundle.timelines.map(t => `- ${text(t.description)} — ${text(t.dateType)} — ${text(JSON.stringify(t.date))}`));
  if (bundle.categorizations.length) lines.push('', '## Categorization proposals', ...bundle.categorizations.map(c => `- ${text(c.dimension)}: ${text(c.value)} — ${text(c.disposition)}`));
  if (bundle.mappings.length) lines.push('', '## Candidate framework mappings', ...bundle.mappings.map(m => `- ${text(m.framework)} ${text(m.version)} ${text(m.techniqueId)} — ${text(m.mappingStatus)} — ${text(m.rationale)}`));
  if (bundle.detections?.length) lines.push('', '## Detection hypotheses', ...bundle.detections.map(d => `- ${text(d.hypothesis)} — ${text(d.validation)} — ${text(d.origin)}`));
  return lines.join('\n') + '\n';
}

export function explorationRecords(model, view, filters = {}) {
  const caseIds = new Set(filterRecords(model, 'cases', { ...filters, query: '' }).map(c => c.id));
  const paths = list(model, 'paths').filter(p => caseIds.has(p.caseId));
  const behaviorIds = new Set(paths.flatMap(p => p.nodes.flatMap(n => n.behaviorIds)));
  const mappings = list(model, 'mappings').filter(m => caseIds.has(m.caseId));
  for (const b of list(model, 'behaviors')) if (behaviorSupport(model, b).some(id =>
    caseIds.has(model.claims.get(id)?.caseId))) behaviorIds.add(b.id);
  for (const m of mappings) behaviorIds.add(m.behaviorId);
  const scoped = Object.entries(filters).some(([key, value]) => key !== 'query' && key !== 'tagMode' && Array.isArray(value) && value.length);
  let records = ['tools', 'prompts'].includes(view) ? aiLibrary(model, view, caseIds).map(r => ({ ...r,
    annotations: r.annotations.filter(a => !filters.sources?.length || filters.sources.includes(a.sourceId)) })).filter(r => r.annotations.length) :
    view === 'paths' ? paths : view === 'behaviors' ? list(model, 'behaviors').filter(b => !scoped || behaviorIds.has(b.id)) :
    view === 'frameworks' ? list(model, 'frameworks').filter(t => !scoped || mappings.some(m => m.techniqueId === t.id)) :
      list(model, view).filter(t => !scoped || behaviorIds.has(t.behaviorId));
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  records = records.filter(r => !query || JSON.stringify(r).toLocaleLowerCase().includes(query));
  return { records, paths, caseIds, mappings };
}

function svgNode(doc, tag, attributes = {}, text) {
  const node = doc.createElementNS ? doc.createElementNS('http://www.w3.org/2000/svg', tag) : doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text; return node;
}
export function graphLayout(path) {
  return Object.fromEntries(path.nodes.map((node, index) => [node.id, { x: 24 + (index % 3) * 290, y: 28 + Math.floor(index / 3) * 165 }]));
}
function renderGraph(doc, model, path, navigate) {
  const panel = element(doc, 'section', null, 'panel attack-graph');
  panel.append(element(doc, 'h2', path.name ?? model.cases.get(path.caseId)?.name ?? path.id), provenance(doc, path),
    element(doc, 'p', 'Solid: proposed sequence · dashed: conditional · orange: propagation. Relationships retain their recorded basis; graph position is presentation only.'));
  const toolbar = element(doc, 'div', null, 'graph-toolbar'), inspection = element(doc, 'section', null, 'graph-inspection');
  const svg = svgNode(doc, 'svg', { viewBox: '0 0 920 430', class: 'research-graph', role: 'img', 'aria-label': 'Attack path diagram; keyboard node and edge controls follow below' });
  let positions = graphLayout(path), box = { x: 0, y: 0, w: 920, h: Math.max(430, Math.ceil(path.nodes.length / 3) * 165 + 50) }, dragging = null;
  const showNode = node => {
    inspection.replaceChildren(element(doc, 'h3', node.title), element(doc, 'p', node.detail), provenance(doc, node), support(doc, model, node.claimIds, navigate));
    for (const id of node.behaviorIds) inspection.append(action(doc, model.corpus.behaviors?.find(b => b.id === id)?.name ?? id, () => navigate('behaviors', id)));
  };
  const showEdge = edge => inspection.replaceChildren(element(doc, 'h3', edge.relation), element(doc, 'p', edge.basis), provenance(doc, edge), support(doc, model, edge.claimIds, navigate));
  function paint() {
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`); svg.replaceChildren();
    const defs = svgNode(doc, 'defs'), marker = svgNode(doc, 'marker', { id: 'research-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(svgNode(doc, 'path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#2c5e50' })); defs.append(marker); svg.append(defs);
    for (const edge of path.edges) {
      const a = positions[edge.from], b = positions[edge.to]; if (!a || !b) continue;
      const sameRow = Math.abs(a.y - b.y) < 80 && edge.from !== edge.to;
      const sx = sameRow ? a.x + (b.x > a.x ? 240 : 0) : a.x + 120, sy = sameRow ? a.y + 52 : a.y + 105;
      const tx = sameRow ? b.x + (b.x > a.x ? 0 : 240) : b.x + 120, ty = sameRow ? b.y + 52 : b.y;
      const d = edge.from === edge.to ? `M${sx} ${sy} C${sx + 160} ${sy + 70} ${tx + 160} ${ty - 70} ${tx} ${ty}` :
        sameRow ? `M${sx} ${sy} C${(sx + tx) / 2} ${sy} ${(sx + tx) / 2} ${ty} ${tx} ${ty}` :
          `M${sx} ${sy} C${sx} ${(sy + ty) / 2} ${tx} ${(sy + ty) / 2} ${tx} ${ty}`;
      const group = svgNode(doc, 'g', { class: `research-edge ${edge.relation}`, role: 'button', tabindex: 0, 'aria-label': `Inspect ${edge.relation}: ${edge.basis}` });
      group.append(svgNode(doc, 'path', { d, class: 'edge-hit' }), svgNode(doc, 'path', { d, class: 'edge-line', 'marker-end': 'url(#research-arrow)' }));
      group.append(svgNode(doc, 'text', { x: (sx + tx) / 2, y: (sy + ty) / 2 - 9, 'text-anchor': 'middle', class: 'edge-label' }, edge.relation));
      group.addEventListener('click', () => showEdge(edge)); group.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); showEdge(edge); } }); svg.append(group);
    }
    for (const node of path.nodes) {
      const pos = positions[node.id], group = svgNode(doc, 'g', { transform: `translate(${pos.x},${pos.y})`, class: 'research-node', tabindex: 0, role: 'button', 'aria-label': `Inspect node: ${node.title}` });
      group.append(svgNode(doc, 'rect', { width: 240, height: 105, rx: 6 }));
      const words = node.title.split(/\s+/), lines = [''];
      for (const word of words) { if ((lines.at(-1) + word).length > 28 && lines.at(-1)) lines.push(''); lines[lines.length - 1] += `${word} `; }
      lines.slice(0, 3).forEach((line, index) => group.append(svgNode(doc, 'text', { x: 12, y: 23 + index * 17 }, line.trim())));
      group.append(svgNode(doc, 'text', { x: 12, y: 88, class: 'node-status' }, node.disposition ?? 'Pending'), svgNode(doc, 'title', {}, node.detail));
      group.addEventListener('click', () => { if (!dragging?.moved) showNode(node); });
      group.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); showNode(node); } });
      const grip = svgNode(doc, 'circle', { cx: 225, cy: 12, r: 6, class: 'node-grip', 'data-drag-node': node.id }); group.append(grip); svg.append(group);
    }
  }
  const zoom = factor => { const w = box.w * factor; if (w < 350 || w > 4000) return; box.x += (box.w - w) / 2; const h = box.h * factor; box.y += (box.h - h) / 2; box.w = w; box.h = h; paint(); };
  toolbar.append(action(doc, 'Zoom out', () => zoom(1.25)), action(doc, 'Zoom in', () => zoom(.8)), action(doc, 'Reset layout', () => {
    positions = graphLayout(path); box = { x: 0, y: 0, w: 920, h: Math.max(430, Math.ceil(path.nodes.length / 3) * 165 + 50) }; paint();
  }));
  svg.addEventListener('pointerdown', e => {
    const id = e.target.getAttribute?.('data-drag-node');
    if (!id && e.target.closest?.('.research-node, .research-edge')) return;
    dragging = { id, x: e.clientX, y: e.clientY, origin: id ? { ...positions[id] } : { ...box }, moved: false };
    svg.setPointerCapture?.(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging) return; const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - dragging.x) * box.w / rect.width, dy = (e.clientY - dragging.y) * box.h / rect.height;
    dragging.moved = Math.abs(dx) + Math.abs(dy) > 4;
    if (dragging.id) positions[dragging.id] = { x: dragging.origin.x + dx, y: dragging.origin.y + dy };
    else { box.x = dragging.origin.x - dx; box.y = dragging.origin.y - dy; } paint();
  });
  for (const event of ['pointerup', 'pointercancel']) svg.addEventListener(event, () => { dragging = null; });
  const alternative = element(doc, 'details'); alternative.append(element(doc, 'summary', 'Text alternative: all nodes and cited relationships'));
  for (const node of path.nodes) alternative.append(action(doc, node.title, () => showNode(node)));
  for (const edge of path.edges) alternative.append(action(doc, `${path.nodes.find(n => n.id === edge.from)?.title} → ${path.nodes.find(n => n.id === edge.to)?.title} · ${edge.relation}`, () => showEdge(edge)));
  paint(); if (path.nodes.length) showNode(path.nodes[0]); panel.append(toolbar, svg, alternative, inspection); return panel;
}

export function renderExploration(doc, model, view, filters, navigate, selectedId = '', loadDemo) {
  const panel = element(doc, 'section', null, 'exploration');
  panel.append(element(doc, 'p', 'Source-supported observations and pending research proposals. Missing enrichment is not evidence that a behavior did not occur; shared behaviors do not establish shared attribution.', 'subtle'));
  if (loadDemo) panel.append(action(doc, 'Load synthetic research demo (replaces displayed corpus only)', loadDemo));
  const selected = explorationRecords(model, view, filters);
  const matchesTarget = r => r.id === selectedId || (['tools', 'prompts'].includes(view)
    && r.annotations.some(a => `${view}-${a.id}` === selectedId));
  if (selectedId && !selected.records.some(matchesTarget)
    && !(view === 'telemetry' && list(model, 'detections').some(d => d.id === selectedId
      && selected.records.some(t => t.behaviorId === d.behaviorId)))) {
    panel.append(element(doc, 'p', 'Unknown target or target outside the active filters. No different research record has been substituted.', 'empty'),
      action(doc, `Return to ${EXPLORE_VIEWS[view]}`, () => navigate(view))); return panel;
  }
  if (['tools', 'prompts'].includes(view)) {
    panel.append(element(doc, 'h2', EXPLORE_VIEWS[view]), element(doc, 'p', view === 'tools'
      ? 'Normalized products with source-local usage labels. Association does not prove successful abuse. Unresolved executable names remain separate.'
      : 'Exact vendor-reported prompts for research and detection development. Benign vendor examples remain labeled; these are not validated detection rules or independently confirmed IOCs. No prompt is executed.'));
    panel.append(usageLegend(doc));
    const grid = element(doc, 'div', null, 'research-grid');
    for (const record of selected.records.filter(r => !selectedId || matchesTarget(r))) {
      const card = element(doc, 'article', null, `panel research-card usage-${usageOf(record.annotations)}`);
      card.append(element(doc, 'h2', record.name), element(doc, 'p', record.basis, 'subtle'));
      if (!selectedId) card.append(action(doc, 'Open library entry', () => navigate(view, record.id)));
      for (const a of record.annotations) {
        const item = annotationCard(doc, model, a, navigate);
        item.append(action(doc, `Campaign: ${model.cases.get(a.caseId)?.name ?? a.caseId}`, () => navigate('cases', a.caseId)),
          support(doc, model, a.claimIds, navigate));
        // Relationships require common source-local claims, not lexical similarity or article proximity.
        const other = view === 'tools' ? 'prompts' : 'tools';
        for (const related of aiLibrary(model, other, new Set([a.caseId])).filter(r => r.annotations.some(b =>
          b.sourceRevisionId === a.sourceRevisionId && b.claimIds?.some(id => a.claimIds?.includes(id))))) {
          item.append(action(doc, `Related ${other === 'tools' ? related.name : 'prompt'}`, () => navigate(other, related.id)));
        }
        card.append(item);
      }
      grid.append(card);
    }
    if (!grid.children.length) panel.append(element(doc, 'p', 'No grounded entries for these filters. Prepare and import a passage-grounded extraction; collecting an article alone does not extract tools or prompts.', 'empty'));
    panel.append(grid); return panel;
  }
  if (view === 'behaviors') {
    const inventory = element(doc, 'section', null, 'panel behavior-inventory');
    inventory.append(element(doc, 'h2', 'Normalized behavior inventory'), element(doc, 'p',
      'Suggested local concepts group similar labels for review. Atomic behaviors are actions; activity patterns describe transitions or chains. Labels with arrows are treated as pattern candidates, not proven chronology. No source record, evidence status or review decision is merged or replaced.'));
    inventory.append(reviewLegend(doc));
    for (const [kind, label] of [['atomic-behavior', 'Actions'], ['activity-pattern', 'Activity patterns']]) {
      const category = element(doc, 'section', null, `behavior-category ${kind}`);
      category.append(element(doc, 'h3', label));
      for (const group of behaviorInventory(selected.records).filter(g => g.kind === kind)) {
      const item = element(doc, 'article', null, 'claim-card');
      item.append(element(doc, 'h4', group.name),
        element(doc, 'p', group.basis, 'subtle'), element(doc, 'p', `${group.members.length} source-specific record(s)${group.members.length > 1 ? ' · possible overlap; inspect evidence before consolidation' : ''}`));
      for (const member of group.members) item.append(reviewChip(doc, member.name, member.disposition, () => navigate('behaviors', member.id)));
      category.append(item);
      }
      if (category.children.length > 1) inventory.append(category);
    }
    inventory.append(element(doc, 'h3', 'Chained activities from recorded paths'), element(doc, 'p',
      'Each transition retains its recorded relationship and evidence basis. A chain is not an atomic behavior, and connecting two nodes does not prove execution or causality.', 'subtle'));
    const chains = selected.paths.flatMap(p => p.edges.map(edge => ({ p, edge })));
    for (const { p, edge } of chains) {
      const from = p.nodes.find(n => n.id === edge.from), to = p.nodes.find(n => n.id === edge.to);
      const item = element(doc, 'details'); item.append(element(doc, 'summary', `${from?.title ?? edge.from} → ${to?.title ?? edge.to} · ${edge.relation}`),
        element(doc, 'p', edge.basis), provenance(doc, edge), support(doc, model, edge.claimIds, navigate),
        action(doc, 'Open recorded attack path', () => navigate('paths', p.id))); inventory.append(item);
    }
    if (!chains.length) inventory.append(element(doc, 'p', 'No chained activities recorded. Add evidence-supported path relationships through extraction; no chains are inferred from similar behavior names.'));
    panel.append(inventory);
  }
  if (view === 'paths') {
    if (selected.records.length) {
      const choose = element(doc, 'div', null, 'graph-toolbar');
      for (const path of selected.records) choose.append(action(doc, model.cases.get(path.caseId)?.name ?? path.id, () => navigate('paths', path.id)));
      panel.append(choose, renderGraph(doc, model, selected.records.find(p => p.id === selectedId) ?? selected.records[0], navigate));
    } else panel.append(element(doc, 'p', 'No authored attack paths in the selected corpus. Collection does not automatically reconstruct a graph.', 'empty'));
    return panel;
  }
  const grid = element(doc, 'div', null, 'research-grid');
  if (view === 'frameworks') {
    const runs = (model.corpus.governance?.campaignExtraction?.runs ?? []).filter(r => selected.caseIds.has(r.caseId));
    const unresolved = runs.flatMap(r => r.unresolvedMappings ?? []);
    const available = Object.values(model.campaignStatus ?? {}).flatMap(s => s.availableCatalogSnapshot?.catalogs ?? []);
    const catalogs = new Map([...available, ...runs.flatMap(r => r.catalogSnapshot?.catalogs ?? [])]
      .map(c => [`${c.framework}:${c.version}:${c.materialDigest}`, c]));
    const catalogPanel = element(doc, 'section', null, 'panel resolver-catalog');
    catalogPanel.append(element(doc, 'h2', 'Mapping and catalog coverage'), element(doc, 'p',
      `${selected.mappings.length} recorded mappings · ${unresolved.length} unresolved candidates · ${catalogs.size} pinned resolver catalogs`),
      element(doc, 'p', 'Resolver references are catalog membership only, not campaign observations. Only validated candidate mappings appear in the mapped technique cards. Missing mappings do not mean no relevant technique applies.', 'subtle'));
    catalogPanel.append(element(doc, 'p', 'Catalogs include the current local resolver and any retained run snapshots. Preparing a new extraction uses the current resolver; earlier runs keep their original catalog provenance.', 'subtle'));
    if (!catalogs.size) catalogPanel.append(element(doc, 'p', 'No resolver snapshot is recorded in this corpus. Prepare/import a grounded extraction candidate to retain its catalog provenance.'));
    for (const c of catalogs.values()) {
      const details = element(doc, 'details', null, 'catalog-entries');
      details.append(element(doc, 'summary', `${c.framework} ${c.version} · ${c.techniques?.length ?? 0} resolver entries`));
      details.append(element(doc, 'p', 'Reference catalog for candidate extraction; no incident occurrence or acceptance is implied.', 'subtle'));
      const search = element(doc, 'input'); search.type = 'search'; search.placeholder = 'Search technique ID, name or description'; search.setAttribute('aria-label', `Search ${c.framework} catalog`);
      const entries = element(doc, 'div', null, 'catalog-list');
      for (const t of c.techniques ?? []) {
        const entry = reference(doc, t.url, `${t.id} · ${t.name}`);
        entry.title = t.description ?? t.name;
        entry.dataset.search = `${t.id} ${t.name} ${t.description ?? ''}`.toLocaleLowerCase(); entries.append(entry);
      }
      search.addEventListener('input', () => { for (const entry of entries.children) entry.hidden = !entry.dataset.search.includes(search.value.toLocaleLowerCase()); });
      details.append(search, entries, technicalDetails(doc, [['Pinned revision', c.immutableRevision], ['Material SHA-256', c.materialDigest]]), reference(doc, c.materialUrl, 'Official pinned material'), reference(doc, c.licenseUrl, c.license));
      catalogPanel.append(details);
    }
    if (![...catalogs.values()].some(c => c.framework === 'ATLAS')) catalogPanel.append(element(doc, 'p', 'No ATLAS resolver catalog is currently loaded; ATLAS candidates remain unresolved.'));
    for (const u of unresolved) {
      const card = element(doc, 'article', null, 'claim-card');
      card.append(element(doc, 'h3', `${u.framework} ${u.version} · ${u.techniqueLiteral} · unresolved`));
      row(doc, card, 'Rationale', u.rationale); row(doc, card, 'Applicability', u.applicability);
      card.append(support(doc, model, u.supportingClaimIds, navigate)); catalogPanel.append(card);
    }
    panel.append(catalogPanel);
    const controls = element(doc, 'div', null, 'graph-toolbar'), state = { framework: 'All frameworks', catalogScope: 'Full catalog' };
    const count = element(doc, 'p', `${selected.records.length} retained technique records`, 'subtle'); count.setAttribute('role', 'status');
    for (const [label, values, key] of [
      ['Framework', ['All frameworks', ...new Set(selected.records.map(r => r.framework))], 'framework'],
      ['Catalog scope', ['Full catalog', 'Mapped to selected cases'], 'catalogScope'],
    ]) {
      const field = element(doc, 'label', `${label} `), select = element(doc, 'select'); select.setAttribute('aria-label', label);
      for (const value of values) { const option = element(doc, 'option', value); option.value = value; select.append(option); }
      select.value = values[0]; field.append(select); controls.append(field);
      select.addEventListener('change', () => {
        state[key] = select.value;
        for (const card of grid.children) if (card.dataset.framework) card.hidden = (state.framework !== 'All frameworks' && card.dataset.framework !== state.framework) ||
          (state.catalogScope === 'Mapped to selected cases' && card.dataset.mapped !== 'true');
        count.textContent = `${[...grid.children].filter(c => c.dataset.framework && !c.hidden).length} visible catalog entries · pending annotations are displayed separately`;
      });
    }
    panel.append(controls, count);
  }
  for (const record of selected.records) {
    const card = element(doc, 'article', null, 'panel research-card'); card.id = `research-${record.id}`;
    card.append(element(doc, 'h2', record.name ?? record.eventType ?? record.action ?? record.id), provenance(doc, record));
    if (record.id === selectedId) card.setAttribute('data-selected', 'true');
    if (view === 'behaviors') {
      row(doc, card, 'Local namespace', record.namespace); row(doc, card, 'Description', record.description); row(doc, card, 'Trust boundary', record.boundary);
      const paths = selected.paths.filter(p => p.nodes.some(n => n.behaviorIds.includes(record.id)));
      const directSupport = behaviorSupport(model, record);
      const caseIds = new Set([...paths.map(p => p.caseId), ...selected.mappings.filter(m => m.behaviorId === record.id).map(m => m.caseId),
        ...directSupport.map(id => model.claims.get(id)?.caseId).filter(id => selected.caseIds.has(id))]);
      row(doc, card, 'Distinct related cases', caseIds.size);
      for (const id of caseIds) card.append(action(doc, model.cases.get(id)?.name ?? id, () => navigate('cases', id)));
      card.append(support(doc, model, [...directSupport, ...paths.flatMap(p => p.nodes.filter(n => n.behaviorIds.includes(record.id)).flatMap(n => n.claimIds))], navigate));
      for (const [key, target] of [['signalIds', 'telemetry'], ['detectionIds', 'telemetry'], ['otelIds', 'otel']]) for (const id of record[key] ?? []) card.append(action(doc, id, () => navigate(target, id)));
    } else if (view === 'frameworks') {
      card.dataset.framework = record.framework;
      row(doc, card, 'Technique / framework / version', [record.id, record.framework, record.version]); card.append(reference(doc, record.url, 'Framework reference'));
      const mappings = selected.mappings.filter(m => m.techniqueId === record.id);
      card.dataset.mapped = String(mappings.length > 0);
      card.append(element(doc, 'p', mappings.length ? `${mappings.length} recorded candidate mappings; catalog membership does not establish occurrence.` : 'No candidate mapping in the selected cases.'));
      for (const mapping of mappings) {
        const section = element(doc, 'details'); section.append(element(doc, 'summary', `${model.cases.get(mapping.caseId)?.name ?? mapping.caseId} · ${mapping.mappingStatus}`), provenance(doc, mapping));
        row(doc, section, 'Rationale', mapping.rationale); row(doc, section, 'Applicability', mapping.applicability); section.append(support(doc, model, mapping.claimIds, navigate)); card.append(section);
      }
    } else if (view === 'telemetry') {
      for (const key of ['category', 'eventType', 'logicalFields', 'joinKeys', 'availability', 'schema', 'limitations']) row(doc, card, key, record[key]);
      card.append(action(doc, record.behaviorId, () => navigate('behaviors', record.behaviorId)));
      for (const detection of list(model, 'detections').filter(d => d.behaviorId === record.behaviorId)) {
        const section = element(doc, 'details'); section.open = detection.id === selectedId;
        section.append(element(doc, 'summary', 'Detection hypothesis · retain validation status'), provenance(doc, detection));
        for (const key of ['hypothesis', 'windowSeconds', 'windowBasis', 'tuning', 'validation', 'testPlan']) row(doc, section, key, detection[key]); card.append(section);
      }
    } else if (view === 'otel') {
      for (const key of ['action', 'customFields', 'sampleOrigin', 'sampleFormat', 'stability', 'limitations']) row(doc, card, key, record[key]);
      for (const id of record.standardSourceIds ?? []) { const source = model.sources.get(id); if (source) card.append(reference(doc, source.originalUrl ?? source.canonicalUrl, source.title ?? id)); }
      const details = element(doc, 'details'); details.append(element(doc, 'summary', 'Synthetic sample · not incident telemetry'), element(doc, 'pre', JSON.stringify(record.sample, null, 2), 'artifact-value')); card.append(details);
      const copied = element(doc, 'p', '', 'subtle'); copied.setAttribute('role', 'status');
      details.append(action(doc, 'Copy synthetic sample', async () => {
        try { await doc.defaultView.navigator.clipboard.writeText(JSON.stringify(record.sample, null, 2)); copied.textContent = 'Synthetic sample copied; not incident telemetry.'; }
        catch { copied.textContent = 'Clipboard unavailable; select and copy the displayed sample.'; }
      }), copied);
    }
    grid.append(card);
  }
  if (view === 'behaviors') {
    const groups = new Map();
    for (const a of model.annotations ?? []) {
      if (a.type !== 'observed-behavior' || !selected.caseIds.has(a.caseId) || (filters.query && !JSON.stringify(a).toLowerCase().includes(filters.query.toLowerCase()))) continue;
      const key = normalized(a); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(a);
    }
    for (const [name, annotations] of groups) {
      const card = element(doc, 'article', null, 'panel research-card'); card.append(element(doc, 'h2', name), element(doc, 'p', 'Grouped annotation labels, not established shared attribution.'), element(doc, 'p', `${new Set(annotations.map(a => a.caseId)).size} distinct cases`));
      for (const a of annotations) card.append(annotationCard(doc, model, a, navigate)); grid.append(card);
    }
  }
  if (view === 'telemetry') for (const detection of list(model, 'detections').filter(d => !selected.records.some(r => r.behaviorId === d.behaviorId))) {
    const behavior = list(model, 'behaviors').find(b => b.id === detection.behaviorId);
    if (!explorationRecords(model, 'behaviors', filters).records.some(b => b.id === detection.behaviorId)) continue;
    const card = element(doc, 'article', null, 'panel research-card'); card.append(element(doc, 'h2', behavior?.name ?? detection.id), provenance(doc, detection));
    for (const key of ['hypothesis', 'validation', 'tuning', 'testPlan']) row(doc, card, key, detection[key]); grid.append(card);
  }
  for (const type of (VIEW_ANNOTATIONS[view] ?? []).filter(type => type !== 'observed-behavior')) {
    for (const a of model.annotations ?? []) {
      if (a.type !== type || !selected.caseIds.has(a.caseId) || (filters.query && !JSON.stringify(a).toLowerCase().includes(filters.query.toLowerCase()))) continue;
      const card = element(doc, 'section', null, 'panel research-card');
      card.append(element(doc, 'h2', ANNOTATION_LABELS[type]), element(doc, 'p', 'Pending annotation; source references and researcher proposals retain their recorded context.'), annotationCard(doc, model, a, navigate)); grid.append(card);
    }
  }
  if (view === 'otel' && model.corpus.otelReference) {
    const referencePanel = element(doc, 'details', null, 'panel'); referencePanel.append(element(doc, 'summary', 'Pinned OpenTelemetry reference · recorded snapshot, not live validation'), element(doc, 'pre', JSON.stringify(model.corpus.otelReference, null, 2), 'artifact-value')); panel.append(referencePanel);
  }
  if (!grid.children.length) panel.append(element(doc, 'p', 'No records for this view / filter. Optional enrichment can be added without changing collection or review.', 'empty'));
  if (view === 'behaviors') {
    const originals = element(doc, 'details'); originals.open = Boolean(selectedId);
    originals.append(element(doc, 'summary', 'Source-specific behavior records · evidence and classifications'), grid); panel.append(originals);
  } else panel.append(grid);
  return panel;
}
