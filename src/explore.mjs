import { element, action, safeExternalUrl, caseCitations, renderClaim, renderConflicts, sourceCitation, claimCitation, technicalDetails, reviewChip, reviewLegend, campaignCategoryBadges, renderCampaignCategories } from './render.mjs';
import { filterRecords, metadata, caseSourceIds } from './model.mjs';
import { publisherDisplay, behaviorInventory, sourceInventory } from './research-inventory.mjs';
import { aiLibrary } from './ai-library.mjs';
import { campaignGraph, campaignSummary, pathDisplayName, evidenceLabel, originReview, activityIcon, ICON_PATHS } from './campaign-presentation.mjs';
import { graphLayout, graphRouter, NODE_WIDTH, NODE_HEIGHT } from './graph-geometry.mjs';
import { renderProgress } from './review-ui.mjs';
export { graphLayout } from './graph-geometry.mjs';

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
    const section = element(doc, 'details', null, `behavior-category ${kind}`);
    section.append(element(doc, 'summary', `${label} · ${items.length}`), reviewLegend(doc));
    const tiles = element(doc, 'div', null, 'behavior-action-list');
    for (const group of items) {
      const chip = reviewChip(doc, group.name, group.members[0].disposition, () => navigate('behaviors', group.members[0].id));
      chip.title = group.basis; chip.classList?.add('behavior-action-link');
      if (!chip.classList) chip.setAttribute('class', `${chip.getAttribute('class')} behavior-action-link`);
      tiles.append(chip);
    }
    section.append(tiles);
    parent.append(section);
  }
  if (!behaviors.length) parent.append(element(doc, 'p', 'No linked behaviors recorded. Collection alone does not extract behavior.', 'subtle'));
}
export function renderCaseLibrary(doc, model, records, navigate, filters = {}, openReview) {
  const panel = element(doc, 'section', null, 'case-library');
  panel.append(element(doc, 'h2', 'Case library'), element(doc, 'p',
    'One card per campaign or explicitly selected research group. Cards open expanded to show cited context, research and linked views; collapse them for a compact overview. Shared research does not merge campaigns.', 'subtle'), usageLegend(doc));
  const grid = element(doc, 'div', null, 'research-grid');
  for (const record of records) {
    const card = element(doc, 'details', null, 'panel research-card case-card');
    card.open = true;
    const summary = element(doc, 'summary');
    const sourceIds = caseSourceIds(model, record.id), claimIds = new Set(model.corpus.claims.filter(c => c.caseId === record.id).map(c => c.id));
    const articles = sourceInventory(sourceIds.map(id => model.sources.get(id)).filter(Boolean));
    const overview = campaignSummary(model, record), paths = list(model, 'paths').filter(p => p.caseId === record.id);
    const heading = element(doc, 'h2'); heading.append(activitySvg(doc, 'graph'), element(doc, 'span', record.name));
    summary.append(element(doc, 'span', record.kind ?? 'Case', 'publisher-badge'), heading,
      campaignCategoryBadges(doc, model, record.id),
      element(doc, 'p', overview.text, 'campaign-summary'),
      element(doc, 'p', originReview(overview), 'subtle'),
      element(doc, 'p', record.limits ?? 'Limits not recorded. Source association does not establish attribution, universal success or chronology.', 'limits'),
      element(doc, 'p', `${articles.length} research articles · ${paths.length ? '1 campaign graph' : '0 campaign graphs'} · ${paths.length} phases`, 'subtle'),
      element(doc, 'span', 'Expand campaign', 'card-expand'));
    card.append(summary);
    const body = element(doc, 'div', null, 'case-card-body');
    body.append(action(doc, 'Open campaign workspace', () => navigate('cases', record.id)));
    body.append(renderCampaignCategories(doc, model, record.id, navigate, openReview, false));
    if (model.itemReview?.campaigns[record.id] && openReview) body.append(renderProgress(doc,
      model.itemReview.campaigns[record.id], filter => openReview(record.id, '', filter)));
    else if (model.collectionEnabled) body.append(element(doc, 'p', model.reviewError ?? 'Review coverage unavailable; no approval inferred.'));
    appendAiLinks(doc, body, model, record.id, navigate);
    if (overview.claimIds.length) {
      const citations = element(doc, 'details', null, 'campaign-summary-citations');
      citations.append(element(doc, 'summary', `Summary citations · ${overview.claimIds.length}`));
      for (const id of overview.claimIds) {
        const claim = model.claims.get(id);
        if (claim) citations.append(action(doc, claim.description, () => navigate('claims', id)));
      }
      body.append(citations);
    }
    body.append(element(doc, 'h3', 'Unified attack graph'));
    if (paths.length) body.append(action(doc, `${record.name} · campaign graph`, () => navigate('paths', paths[0].id)),
      element(doc, 'p', `${paths.length} underlying phase path record(s). Only recorded relationships are drawn; unconnected phases stay disconnected.`, 'subtle'));
    else body.append(element(doc, 'p', 'No supported path recorded.', 'subtle'));
    const phases = element(doc, 'details'); phases.append(element(doc, 'summary', 'Phase paths & technical provenance'));
    for (const path of paths) phases.append(action(doc, pathDisplayName(path), () => navigate('paths', path.id)),
      technicalDetails(doc, [['Canonical path', path.id], ['Origin / review', originReview(path)]]));
    if (paths.length) body.append(phases);
    body.append(element(doc, 'h3', 'Research blogs'));
    const totals = new Map(), index = new Map();
    for (const article of articles) totals.set(article.publisher.name, (totals.get(article.publisher.name) ?? 0) + 1);
    for (const article of articles) {
      const source = article.source, display = article.publisher; index.set(display.name, (index.get(display.name) ?? 0) + 1);
      const chip = action(doc, `${display.name}${totals.get(display.name) > 1 ? ` · ${index.get(display.name)}` : ''}`, () => navigate('sources', source.id));
      chip.title = `${metadata(source, 'title')} · ${display.basis}`; chip.setAttribute('aria-label', `${display.name}: ${metadata(source, 'title')}`); body.append(chip);
    }
    behaviorLinks(doc, body, model, claimIds, paths, navigate);
    card.append(body); grid.append(card);
  }
  panel.append(grid); return panel;
}
export function renderResearchLibrary(doc, model, sources, navigate, filters = {}, openReview) {
  const panel = element(doc, 'section', null, 'research-library');
  panel.append(element(doc, 'h2', 'Research library'), element(doc, 'p',
    'One card per blog or research source. Campaign tags open the associated case; one blog can support several cases without combining their attribution. Open a blog to inspect exact revisions and claims.', 'subtle'), usageLegend(doc));
  const grid = element(doc, 'div', null, 'research-grid');
  const catalogSources = new Set(list(model, 'frameworks').map(framework => framework.sourceId).filter(Boolean));
  for (const article of sourceInventory(sources.filter(source => !catalogSources.has(source.id)))) {
    const source = article.source, memberIds = new Set(article.members.map(s => s.id));
    const card = element(doc, 'article', null, 'panel research-card blog-card');
    const cases = model.corpus.cases.filter(c => caseSourceIds(model, c.id).some(id => memberIds.has(id)) && (!filters.cases?.length || filters.cases.includes(c.id)));
    const caseIds = new Set(cases.map(c => c.id));
    const claims = model.corpus.claims.filter(c => memberIds.has(c.sourceId) && caseIds.has(c.caseId));
    const claimIds = new Set(claims.map(c => c.id));
    const revisions = new Set(article.members.flatMap(s => s.revisionIds));
    card.append(element(doc, 'span', article.publisher.name, 'publisher-badge'),
      element(doc, 'h2', metadata(source, 'title')), element(doc, 'p', revisions.size
        ? `${source.collectionState} · ${revisions.size} retained revision(s)` : 'No retained article revision · source metadata only', 'subtle'),
      action(doc, 'Open research source', () => navigate('sources', source.id)));
    if (article.members.length > 1) {
      const history = element(doc, 'details'); history.append(element(doc, 'summary', `Article aliases & source history · ${article.members.length} retained identities`));
      for (const member of article.members) history.append(action(doc, `Inspect historical source: ${member.id}`, () => navigate('sources', member.id)),
        element(doc, 'p', `${member.originalUrl ?? 'Original URL unavailable'} · ${member.collectionState}`));
      card.append(history);
    }
    card.append(element(doc, 'h3', 'Campaigns / cases'));
    if (model.itemReview?.sources[source.id] && openReview) card.append(renderProgress(doc,
      model.itemReview.sources[source.id], filter => openReview(cases[0]?.id ?? '', source.id, filter)));
    else if (model.collectionEnabled) card.append(element(doc, 'p', model.reviewError ?? 'Review coverage unavailable; no approval inferred.'));
    for (const record of cases) card.append(action(doc, record.name, () => navigate('cases', record.id), 'chip campaign-tag'));
    if (!cases.length) card.append(element(doc, 'p', 'Independent source · no associated case', 'subtle'));
    if (!revisions.size && model.corpus.collectionManifests.some(m => m.outcome === 'Failed' && m.inputSourceIds.some(id => memberIds.has(id)))) card.append(element(doc, 'p', 'Failed intake attempt · article unavailable for extraction.', 'limits'));
    const paths = list(model, 'paths').filter(p => caseIds.has(p.caseId) && p.nodes.some(n => n.claimIds.some(id => claimIds.has(id))));
    behaviorLinks(doc, card, model, claimIds, paths, navigate);
    const evidence = element(doc, 'details'); evidence.append(element(doc, 'summary', `Claims & evidence · ${claims.length}`));
    for (const claim of claims) evidence.append(action(doc, claim.description, () => navigate('claims', claim.id)));
    card.append(evidence);
    for (const [view, label] of [['tools', 'AI tools'], ['prompts', 'Prompts']]) {
      const entries = aiLibrary(model, view, caseIds).filter(r => r.annotations.some(a => memberIds.has(a.sourceId)));
      if (!entries.length) continue;
      card.append(element(doc, 'h3', label));
      for (const entry of entries) card.append(aiChip(doc, entry, navigate, view, entry.annotations.filter(a => memberIds.has(a.sourceId))));
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
  if (record.itemReview) {
    const r = record.itemReview;
    return element(doc, 'p', `Content origin: ${r.contentOrigin} · Labels: ${r.labelAuthorship} · ${r.editor ? `Human-edited by ${r.editor} · ` : ''}Review: ${r.state}${r.state === 'Accepted' ? ' (Human-reviewed)' : ''}`, 'subtle');
  }
  return element(doc, 'p', [record.origin, record.evidenceStatus, record.disposition ?? record.status ?? 'Pending',
    record.mappingStatus].filter(Boolean).join(' · '), 'subtle');
}
function support(doc, model, ids, navigate, caseId) {
  const section = element(doc, 'details'); section.append(element(doc, 'summary', 'Supporting claims and exact passages'));
  const scopedClaims = model.corpus.claims.filter(c => !caseId || (caseId instanceof Set ? caseId.has(c.caseId) : c.caseId === caseId));
  const scopedModel = { ...model, corpus: { ...model.corpus, claims: scopedClaims }, claims: new Map(scopedClaims.map(c => [c.id, c])) };
  for (const id of [...new Set(ids ?? [])]) {
    const claim = scopedModel.claims.get(id);
    if (claim) section.append(renderClaim(doc, scopedModel, claim, navigate));
    else section.append(element(doc, 'p', `Unavailable claim or outside this case: ${id}. No support inferred.`));
  }
  section.append(renderConflicts(doc, scopedModel, ids ?? [], navigate));
  if (!ids?.length) section.append(element(doc, 'p', 'No claim support recorded. This is not established campaign evidence.'));
  return section;
}

export function nodeMappings(model, path, node) {
  const claimsMatch = ids => ids?.length && ids.every(id => node.claimIds.includes(id) && model.claims.get(id)?.caseId === path.caseId);
  const records = list(model, 'mappings').filter(m => m.caseId === path.caseId && node.behaviorIds.includes(m.behaviorId));
  const runs = (model.corpus.governance?.campaignExtraction?.runs ?? []).filter(r => r.caseId === path.caseId);
  const catalogs = [...runs.flatMap(r => r.catalogSnapshot?.catalogs ?? []), ...(model.publicCatalogSnapshot?.catalogs ?? [])];
  const pinned = m => list(model, 'frameworks').some(t => t.id === m.techniqueId && t.framework === m.framework && t.version === m.version)
    && catalogs.some(c => c.framework === m.framework && c.version === m.version && c.immutableRevision && c.materialDigest
      && c.techniques?.some(t => t.id === m.techniqueId));
  const targeted = records.filter(m => m.pathId === path.id && m.nodeId === node.id);
  return {
    nodeScoped: targeted.filter(m => claimsMatch(m.claimIds) && pinned(m)),
    broad: records.filter(m => !m.pathId && !m.nodeId && m.claimIds?.every(id => model.claims.get(id)?.caseId === path.caseId)),
    unresolved: runs.flatMap(r => r.unresolvedMappings ?? []).filter(m => node.behaviorIds.includes(m.behaviorId)
      && ((!m.pathId && !m.nodeId) || (m.pathId === path.id && m.nodeId === node.id && claimsMatch(m.supportingClaimIds)))),
    unavailable: targeted.filter(m => !claimsMatch(m.claimIds) || !pinned(m)),
  };
}

function mappingCard(doc, model, mapping, navigate, caseId, scope) {
  const card = element(doc, 'article', null, 'claim-card');
  card.append(element(doc, 'h4', `${mapping.framework} ${mapping.version} · ${mapping.techniqueLiteral ?? mapping.techniqueId} · ${scope}`), provenance(doc, mapping));
  for (const [key, label] of [['rationale', 'Rationale'], ['applicability', 'Applicability'], ['reason', 'Resolution limit']]) row(doc, card, label, mapping[key]);
  card.append(support(doc, model, mapping.claimIds ?? mapping.supportingClaimIds, navigate, caseId));
  if (mapping.techniqueId) card.append(action(doc, 'Inspect recorded framework candidate', () => navigate('frameworks', mapping.techniqueId)));
  return card;
}
function annotationCard(doc, model, annotation, navigate, showLiteral = true) {
  const card = element(doc, 'article', null, 'claim-card');
  if (annotation.type === 'commands-ai-artifacts') {
    const usage = usageOf([annotation]); card.className += ` usage-${usage}`;
    card.title = USAGE[usage][0]; card.setAttribute('aria-label', `Source artifact: ${USAGE[usage][0]}`);
  }
  if (showLiteral) card.append(element(doc, 'pre', annotation.value, 'artifact-value'));
  card.append(provenance(doc, annotation));
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
    element(doc, 'p', model.publicDraft ? 'Public draft tools and extracted prompts are pending. Full article quotations remain omitted; source citations and prompt locators remain available for review.' : 'Private annotations show their current item-review state when available; otherwise they are pending. Evidence-backed describes passage linkage, not independent confirmation. Inferences and unresolved items remain separate.', 'subtle'));
  if (model.annotationError) panel.append(element(doc, 'p', model.annotationError, 'enrichment-warning'));
  if (download && !model.publicDraft) for (const format of ['json', 'md']) panel.append(action(doc, `Download talk bundle (${format === 'md' ? 'Markdown' : 'JSON'})`,
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
  const caseSupport = ids => (ids ?? []).every(id => model.claims.get(id)?.caseId === caseId);
  for (const p of paths) {
    if (p.nodes.some(n => !caseSupport(n.claimIds)) || p.edges.some(e => !caseSupport(e.claimIds)
      || !p.nodes.some(n => n.id === e.from) || !p.nodes.some(n => n.id === e.to))) {
      throw new Error('Invalid path support scope; cannot export a talk bundle.');
    }
  }
  for (const m of mappings) {
    const path = paths.find(p => p.id === m.pathId), node = path?.nodes.find(n => n.id === m.nodeId);
    if (!caseSupport(m.claimIds) || Boolean(m.pathId) !== Boolean(m.nodeId) || (m.pathId &&
      (!node || !node.behaviorIds.includes(m.behaviorId) || !m.claimIds.length || !m.claimIds.every(id => node.claimIds.includes(id))))) {
      throw new Error('Invalid mapping support scope; cannot export a talk bundle.');
    }
  }
  const behaviorIds = new Set([...paths.flatMap(p => p.nodes.flatMap(n => n.behaviorIds)), ...mappings.map(m => m.behaviorId),
    ...list(model, 'behaviors').filter(b => behaviorSupport(model, b).some(id => model.claims.get(id)?.caseId === caseId)).map(b => b.id)]);
  const claimIds = new Set(claims.map(c => c.id));
  const behaviors = list(model, 'behaviors').filter(b => behaviorIds.has(b.id)).map(b => {
    const projected = structuredClone(b);
    if (projected.caseId) projected.caseId = caseId;
    if (projected.claimIds) projected.claimIds = projected.claimIds.filter(id => claimIds.has(id));
    if (projected.occurrences) projected.occurrences = projected.occurrences
      .filter(o => !o.caseId || o.caseId === caseId)
      .map(o => ({ ...o, claimIds: (o.claimIds ?? []).filter(id => claimIds.has(id)) })).filter(o => o.claimIds.length);
    return projected;
  });
  const techniqueIds = new Set(mappings.map(m => m.techniqueId));
  let size;
  do {
    size = techniqueIds.size;
    for (const t of list(model, 'frameworks')) if (techniqueIds.has(t.id) && t.parentId) techniqueIds.add(t.parentId);
  } while (techniqueIds.size !== size);
  const frameworks = list(model, 'frameworks').filter(t => techniqueIds.has(t.id));
  const otel = list(model, 'otel').filter(o => behaviorIds.has(o.behaviorId));
  const sourceIds = new Set([...caseSourceIds(model, caseId), ...frameworks.map(t => t.sourceId), ...otel.flatMap(o => o.standardSourceIds ?? [])]);
  const runs = (model.corpus.governance?.campaignExtraction?.runs ?? []).filter(r => r.caseId === caseId);
  return { schemaVersion: 'talk-bundle/1', private: true, warning: 'Research draft. Recorded dispositions do not establish current eligibility or independent approval.',
    corpusSnapshot: model.snapshot ?? null, case: record, citations: caseCitations(model, record).citations,
    claims, passages: model.corpus.passages.filter(p => passageIds.has(p.id)), annotations: caseAnnotations(model, caseId),
    categorizations: model.corpus.categorizations.filter(c => c.caseId === caseId), timelines: model.corpus.timelines.filter(t => t.caseId === caseId),
    paths, mappings, mappingScopes: Object.fromEntries(mappings.map(m => {
      const path = paths.find(p => p.id === m.pathId), node = path?.nodes.find(n => n.id === m.nodeId);
      return [m.id, !node ? 'Broader behavior/case candidate — not node-specific' :
        nodeMappings(model, path, node).nodeScoped.includes(m) ? 'Node-scoped candidate — Proposed' :
          'Node target recorded; catalog provenance unavailable — not a validated node mapping'];
    })), behaviors, behaviorProjection: {
      caseId, limits: 'Case-scoped behavior projection; other-case support omitted. Canonical records are unchanged; shared behavior is not shared attribution.',
    },
    sources: model.corpus.sources.filter(s => sourceIds.has(s.id)),
    revisionProvenance: model.corpus.sourceRevisions.filter(r => sourceIds.has(r.sourceId)).map(({ normalizedContent, ...revision }) => ({
      ...revision, bodyIncluded: false,
    })),
    frameworks, unresolvedMappings: runs.flatMap(r => r.unresolvedMappings ?? []),
    catalogSnapshots: runs.map(r => r.catalogSnapshot).filter(Boolean),
    telemetry: list(model, 'telemetry').filter(t => behaviorIds.has(t.behaviorId)),
    detections: list(model, 'detections').filter(d => behaviorIds.has(d.behaviorId)),
    otel, otelReference: model.corpus.otelReference ?? null };
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
    lines.push(`Uncertainty: ${text(claim.uncertainty)}`, `Conflicts: ${text(JSON.stringify(claim.conflictsWith))}`);
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
  lines.push('', '## Attack paths', 'Canvas position is presentation only, not chronology, causality or evidence.');
  for (const path of bundle.paths) {
    lines.push('', `### ${text(path.name ?? path.id)}`, `Case kind: ${text(bundle.case.kind)} · Scope: ${text(path.scope)}`,
      text(`${path.origin} · ${path.disposition}`));
    for (const node of path.nodes) lines.push('', `Node: ${text(node.title)}`, `Recorded node and support: ${text(JSON.stringify(node))}`);
    for (const edge of path.edges) lines.push('', `${text(path.nodes.find(n => n.id === edge.from)?.title ?? edge.from)} → ${text(path.nodes.find(n => n.id === edge.to)?.title ?? edge.to)}`,
      `Recorded relationship and independent support: ${text(JSON.stringify(edge))}`);
  }
  if (bundle.mappings.length) lines.push('', '## Candidate framework mappings', ...bundle.mappings.map(m =>
    `- ${text(bundle.mappingScopes?.[m.id] ?? 'Scope unavailable')}: ${text(JSON.stringify(m))}`));
  for (const [key, label] of [['unresolvedMappings', 'Unresolved candidates — literal IDs, not resolved mappings'], ['behaviors', 'Local behaviors'],
    ['telemetry', 'Proposed security telemetry'], ['otel', 'Proposed OTEL instrumentation — Synthetic sample, not incident telemetry'],
    ['sources', 'Source provenance'], ['revisionProvenance', 'Retained revision provenance — article bodies omitted; exact passages above'], ['frameworks', 'Recorded framework references'],
    ['catalogSnapshots', 'Pinned historical catalogs']]) {
    if (bundle[key]?.length) lines.push('', `## ${label}`, ...bundle[key].map(r => `- ${text(JSON.stringify(r))}`));
  }
  if (bundle.behaviorProjection) lines.push('', text(bundle.behaviorProjection.limits));
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
  records = records.filter(r => !query || `${JSON.stringify(r)} ${view === 'paths' ? `${pathDisplayName(r)} ${model.cases.get(r.caseId)?.name ?? ''}` : ''}`.toLocaleLowerCase().includes(query));
  return { records, paths, caseIds, mappings };
}

function svgNode(doc, tag, attributes = {}, text) {
  const node = doc.createElementNS ? doc.createElementNS('http://www.w3.org/2000/svg', tag) : doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text; return node;
}
function activitySvg(doc, name) {
  const svg = svgNode(doc, 'svg', { viewBox: '0 0 24 24', class: 'activity-icon', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(svgNode(doc, 'path', { d: ICON_PATHS[name] ?? ICON_PATHS.graph, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6 }));
  return svg;
}
function renderGraph(doc, model, path, navigate, selectedEntity = '') {
  const panel = element(doc, 'section', null, 'panel attack-graph');
  panel.append(element(doc, 'h2', path.name),
    element(doc, 'p', `${model.cases.get(path.caseId)?.kind} · ${path.scope} · 1 displayed campaign graph · ${path.members.length} retained path record(s)`),
    element(doc, 'p', 'Solid: reported/reconstructed sequence · dashed: conditional prerequisite or unestablished execution · double/dotted curve: propagation, including loops. Line style does not establish evidence strength. Graph position is presentation only, not chronology, causality or attribution.'),
    element(doc, 'p', 'Phase groups preserve separate source/run occurrences and conflicting classifications. No arrows are invented between phases; disconnected components are intentional.', 'subtle'),
    action(doc, 'Return to path case', () => navigate('cases', path.caseId)));
  const viewport = element(doc, 'div', null, 'graph-viewport');
  const toolbar = element(doc, 'div', null, 'graph-icon-toolbar'), inspection = element(doc, 'section', null, 'graph-inspection');
  toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', 'Graph controls');
  const announcement = element(doc, 'p', '', 'subtle');
  announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite'); announcement.setAttribute('aria-atomic', 'true');
  const svg = svgNode(doc, 'svg', { class: 'research-graph', role: 'group', 'aria-label': 'Attack path diagram; keyboard node and edge controls and complete text alternative follow' });
  const fittedBox = () => {
    const values = Object.values(graphLayout(path));
    const width = Math.max(920, ...values.map(p => p.x + 390));
    return { x: -100, y: -100, w: width + 160, h: Math.max(430, ...values.map(p => p.y + 240)) + 100 };
  };
  let positions = graphLayout(path), box = fittedBox(), dragging = null, suppressClick = false, selected = null;
  const fit = fittedBox();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const focusGroup = group => {
    const points = group.nodeIds.map(id => positions[id]).filter(Boolean);
    if (!points.length) return fittedBox();
    const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x + NODE_WIDTH));
    const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y + NODE_HEIGHT));
    const rect = svg.getBoundingClientRect?.(), aspect = rect?.width && rect?.height ? rect.width / rect.height : 1.6;
    const height = Math.max(bottom - top + 100, (rect?.height ?? 500) * .82);
    const width = Math.max(right - left + 100, height * aspect);
    return { x: (left + right - width) / 2, y: (top + bottom - height) / 2, w: width, h: height };
  };
  const boundedPosition = position => ({
    x: clamp(position.x, fit.x - fit.w, fit.x + 2 * fit.w - NODE_WIDTH),
    y: clamp(position.y, fit.y - fit.h, fit.y + 2 * fit.h - NODE_HEIGHT),
  });
  const moveNode = (id, position) => {
    const next = boundedPosition(position);
    if (Object.entries(positions).some(([other, p]) => other !== id && next.x < p.x + NODE_WIDTH + 8 && next.x + NODE_WIDTH + 8 > p.x
      && next.y < p.y + NODE_HEIGHT + 8 && next.y + NODE_HEIGHT + 8 > p.y)) {
      announcement.textContent = 'Movement stopped at another card. Use another direction or reset layout.'; return;
    }
    positions[id] = next;
  };
  const nodeElements = new Map(), edgeElements = new Map(), textControls = new Map();
  function select(kind, record, updateRoute) {
    selected = { kind, id: record.id };
    for (const [key, group] of [...nodeElements, ...edgeElements]) group.setAttribute('aria-pressed', String(key === `${kind}:${record.id}`));
    for (const [key, control] of textControls) control.setAttribute('aria-pressed', String(key === `${kind}:${record.id}`));
    announcement.textContent = `Inspecting ${kind === 'node' ? record.title : `${record.relation} relationship`}. Support and proposals are available below.`;
    if (updateRoute) navigate('paths', record.memberPath.id, record.canonicalId);
  }
  const occurrenceProvenance = record => technicalDetails(doc, [
    ['Phase', pathDisplayName(record.memberPath)], ['Canonical path', record.memberPath.id],
    ['Canonical element', record.canonicalId], ['Source occurrences', record.sourceOccurrences.map(s => `${s.sourceId} / ${s.sourceRevisionId} / ${s.claimId}`).join('; ')],
    ['Extraction runs', record.runIds.join(', ') || 'No retained run link available'],
  ]);
  const showNode = (node, updateRoute = true) => {
    inspection.replaceChildren(element(doc, 'h3', node.title), element(doc, 'p', node.detail), provenance(doc, node), occurrenceProvenance(node),
      support(doc, model, node.claimIds, navigate, path.caseId));
    row(doc, inspection, 'Uncertainty', node.uncertainty);
    for (const id of node.behaviorIds) inspection.append(action(doc, model.corpus.behaviors?.find(b => b.id === id)?.name ?? id, () => navigate('behaviors', id)));
    const mappings = nodeMappings(model, node.memberPath, node.canonicalRecord);
    inspection.append(element(doc, 'h4', 'Node-scoped candidates — Proposed, not established occurrence'));
    for (const m of mappings.nodeScoped) inspection.append(mappingCard(doc, model, m, navigate, path.caseId, 'Node-scoped candidate'));
    if (!mappings.nodeScoped.length) inspection.append(element(doc, 'p', 'No node-scoped candidate recorded with verified scope and a retained catalog pin. This does not mean the behavior is absent.'));
    if (mappings.unavailable.length) inspection.append(element(doc, 'p', 'Some candidates have unavailable catalog provenance or invalid node support; not presented as validated node mappings.'));
    if (mappings.broad.length) inspection.append(element(doc, 'h4', 'Broader behavior/case candidates — not node-specific'));
    for (const m of mappings.broad) inspection.append(mappingCard(doc, model, m, navigate, path.caseId, 'Broader behavior/case candidate'));
    for (const m of mappings.unresolved) inspection.append(mappingCard(doc, model, m, navigate, path.caseId,
      m.pathId ? 'Unresolved node candidate — literal ID' : 'Unresolved broader candidate — literal ID'));
    select('node', node, updateRoute);
  };
  const showEdge = (edge, updateRoute = true) => {
    inspection.replaceChildren(element(doc, 'h3', `${path.nodes.find(n => n.id === edge.from)?.title ?? edge.from} → ${path.nodes.find(n => n.id === edge.to)?.title ?? edge.to}`),
      element(doc, 'p', `${edge.relation}: ${edge.basis}`), provenance(doc, edge), occurrenceProvenance(edge),
      element(doc, 'p', 'Node support does not establish this relationship. Reported/reconstructed sequence and conditional execution retain their recorded basis.'),
      support(doc, model, edge.claimIds, navigate, path.caseId));
    row(doc, inspection, 'Uncertainty', edge.uncertainty); select('edge', edge, updateRoute);
  };
  const activate = handler => event => {
    if (event.type === 'keydown' || event.key) {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
    } else if (suppressClick) { suppressClick = false; return; }
    handler();
  };
  const defs = svgNode(doc, 'defs'), marker = svgNode(doc, 'marker', { id: 'research-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(svgNode(doc, 'path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'edge-arrow' })); defs.append(marker); svg.append(defs);
  for (const edge of path.edges) {
    const group = svgNode(doc, 'g', { class: `research-edge ${edge.relation}`, role: 'button', tabindex: 0, 'data-entity-kind': 'edge',
      'data-entity-id': edge.id, 'data-canonical-id': edge.canonicalId, 'data-member-path': edge.memberPath.id,
      'aria-label': `Inspect ${path.nodes.find(n => n.id === edge.from)?.title} to ${path.nodes.find(n => n.id === edge.to)?.title}: ${edge.relation}, ${edge.basis}` });
    const hit = svgNode(doc, 'path', { class: 'edge-hit' }), line = svgNode(doc, 'path', { class: 'edge-line', 'marker-end': 'url(#research-arrow)' });
    const label = svgNode(doc, 'text', { 'text-anchor': 'middle', class: 'edge-label' }, edge.relation === 'propagates' ? '↻ propagates' : edge.relation);
    const leader = svgNode(doc, 'path', { class: 'edge-label-leader', fill: 'none', stroke: 'currentColor', 'stroke-width': 1, 'aria-hidden': 'true' });
    group.append(hit, line, label, leader, svgNode(doc, 'title', {}, edge.basis));
    group.addEventListener('click', activate(() => showEdge(edge))); group.addEventListener('keydown', activate(() => showEdge(edge)));
    edgeElements.set(`edge:${edge.id}`, group); svg.append(group);
  }
  const phaseElements = path.groups.map(group => {
    const text = svgNode(doc, 'text', { class: 'graph-phase-label' }, `${group.name.slice(0, 66)}${group.name.length > 66 ? '…' : ''}`);
    text.append(svgNode(doc, 'title', {}, group.name)); svg.append(text); return { group, text };
  });
  for (const node of path.nodes) {
    const group = svgNode(doc, 'g', { class: 'research-node', tabindex: 0, role: 'button', 'data-entity-kind': 'node',
      'data-entity-id': node.id, 'data-canonical-id': node.canonicalId, 'data-member-path': node.memberPath.id,
      'aria-label': `Inspect node: ${node.title}. ${evidenceLabel(node.evidenceStatus)}. ${originReview(node)}` });
    group.append(svgNode(doc, 'rect', { width: NODE_WIDTH, height: NODE_HEIGHT, rx: 8 }));
    const icon = activitySvg(doc, activityIcon(node)); icon.setAttribute('x', 12); icon.setAttribute('y', 14); icon.setAttribute('width', 20); icon.setAttribute('height', 20); group.append(icon);
    const words = node.title.split(/\s+/), lines = [''];
    for (const word of words) for (const part of word.match(/.{1,24}/gu) ?? []) {
      if ((lines.at(-1) + part).length > 25 && lines.at(-1)) lines.push(''); lines[lines.length - 1] += `${part} `;
    }
    lines.slice(0, 3).forEach((line, index) => group.append(svgNode(doc, 'text', { x: 42, y: 27 + index * 18, class: 'node-title' },
      `${line.trim().slice(0, 25)}${index === 2 && lines.length > 3 ? '…' : ''}`)));
    const fullOriginReview = originReview(node), separator = fullOriginReview.lastIndexOf(' · ');
    const review = fullOriginReview.slice(separator + 3), origin = fullOriginReview.slice(0, separator);
    const originLength = Math.max(8, 42 - review.length - 3);
    const conciseOriginReview = `${origin.length > originLength ? `${origin.slice(0, originLength - 1)}…` : origin} · ${review}`;
    group.append(svgNode(doc, 'text', { x: 12, y: 92, class: 'node-evidence' }, evidenceLabel(node.evidenceStatus)),
      svgNode(doc, 'text', { x: 12, y: 112, class: 'node-status' }, conciseOriginReview),
      svgNode(doc, 'title', {}, `${node.title}: ${node.detail} · ${evidenceLabel(node.evidenceStatus)} · ${originReview(node)}`));
    group.addEventListener('click', activate(() => showNode(node))); group.addEventListener('keydown', activate(() => showNode(node)));
    const grip = svgNode(doc, 'circle', { cx: 230, cy: 16, r: 14, class: 'node-grip', 'data-drag-node': node.id });
    grip.append(svgNode(doc, 'title', {}, 'Drag activity; non-dragging movement controls are in Pan and move'));
    group.append(grip); nodeElements.set(`node:${node.id}`, group); svg.append(group);
  }
  function paint() {
    box.x = clamp(box.x, fit.x - fit.w / 2 - box.w / 2, fit.x + fit.w * 1.5 - box.w / 2);
    box.y = clamp(box.y, fit.y - fit.h / 2 - box.h / 2, fit.y + fit.h * 1.5 - box.h / 2);
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    const route = graphRouter(positions);
    for (const edge of path.edges) {
      const geometry = route(edge);
      const [hit, line, label, leader] = edgeElements.get(`edge:${edge.id}`).children;
      hit.setAttribute('d', geometry?.d ?? ''); line.setAttribute('d', geometry?.d ?? '');
      label.setAttribute('visibility', geometry?.label ? 'visible' : 'hidden');
      leader.setAttribute('d', geometry?.label ? `M${geometry.labelAnchor.x} ${geometry.labelAnchor.y} H${geometry.label.x} V${geometry.label.y + 4}` : '');
      if (geometry?.label) { label.setAttribute('x', geometry.label.x); label.setAttribute('y', geometry.label.y); }
    }
    for (const node of path.nodes) nodeElements.get(`node:${node.id}`).setAttribute('transform', `translate(${positions[node.id].x},${positions[node.id].y})`);
    for (const { group, text } of phaseElements) {
      const members = group.nodeIds.map(id => positions[id]);
      text.setAttribute('x', Math.min(...members.map(p => p.x)));
      text.setAttribute('y', Math.min(...members.map(p => p.y)) - 38);
    }
  }
  const zoom = factor => {
    const ratio = Math.max(.12, Math.min(4, box.w * factor / fittedBox().w)), w = fittedBox().w * ratio, h = box.h * w / box.w;
    box.x += (box.w - w) / 2; box.y += (box.h - h) / 2; box.w = w; box.h = h; paint();
  };
  const iconButton = (name, icon, callback) => {
    const control = action(doc, '', callback, 'graph-icon-button');
    control.setAttribute('aria-label', name); control.title = name;
    const visual = element(doc, 'span', icon); visual.setAttribute('aria-hidden', 'true');
    control.append(visual, element(doc, 'span', name, 'sr-only')); return control;
  };
  toolbar.append(iconButton('Zoom out', '−', () => zoom(1.25)), iconButton('Zoom in', '+', () => zoom(.8)), iconButton('Reset layout', '↺', () => {
    endGesture(); positions = graphLayout(path); box = fittedBox(); paint();
  }));
  toolbar.append(iconButton('Focus selection', '⌖', () => {
    endGesture();
    const record = selected?.kind === 'node' ? path.nodes.find(n => n.id === selected.id) : path.edges.find(e => e.id === selected?.id);
    const points = record ? (selected.kind === 'node' ? [positions[record.id]] : [positions[record.from], positions[record.to]]) : [];
    if (!points.length) { announcement.textContent = 'Select an activity or relationship to focus it.'; return; }
    const rect = svg.getBoundingClientRect?.(), width = rect?.width || 620, height = rect?.height || 500;
    const left = Math.min(...points.map(p => p.x)), right = Math.max(...points.map(p => p.x)) + NODE_WIDTH;
    const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y)) + NODE_HEIGHT;
    const w = Math.max(NODE_WIDTH + 48, Math.min(920, width), right - left + 60, (bottom - top + 100) * width / height);
    const h = w * height / width;
    box = { x: (left + right - w) / 2, y: (top + bottom - h) / 2, w, h }; paint();
    announcement.textContent = 'Selection enlarged for inspection. Reset layout restores the full campaign overview.';
  }));
  const movement = element(doc, 'details', null, 'graph-movement'), movementTitle = element(doc, 'summary', '↔');
  movementTitle.title = 'Pan and move'; movementTitle.setAttribute('aria-label', 'Pan and move');
  movementTitle.append(element(doc, 'span', 'Pan and move', 'sr-only')); movement.append(movementTitle);
  const movementPanel = element(doc, 'div', null, 'graph-movement-panel');
  movementPanel.append(element(doc, 'p', 'Non-dragging alternatives'), element(doc, 'p', 'Select a card to move it. Movement is bounded and cannot overlap cards. Escape or Cancel stops a gesture. Reset restores positions and viewport.', 'subtle'));
  for (const [direction, dx, dy] of [['left', -40, 0], ['right', 40, 0], ['up', 0, -40], ['down', 0, 40]]) {
    const symbol = ({ left: '←', right: '→', up: '↑', down: '↓' })[direction];
    movementPanel.append(iconButton(`Pan ${direction}`, `⊞${symbol}`, () => { endGesture(); box.x += dx; box.y += dy; paint(); }));
    movementPanel.append(iconButton(`Move selected node ${direction}`, `▣${symbol}`, () => {
      endGesture();
      if (selected?.kind !== 'node') { announcement.textContent = 'Select a node before moving it.'; return; }
      moveNode(selected.id, { x: positions[selected.id].x + dx, y: positions[selected.id].y + dy }); paint();
    }));
  }
  movementPanel.append(action(doc, 'Cancel gesture', () => endGesture()));
  movement.append(movementPanel); toolbar.append(movement);
  const phaseControls = element(doc, 'div', null, 'campaign-phase-controls');
  phaseControls.setAttribute('role', 'group');
  phaseControls.setAttribute('aria-label', 'Campaign graph phases');
  const setPhase = (group, button) => {
    box = focusGroup(group); paint();
    for (const control of phaseControls.children) control.setAttribute('aria-pressed', String(control === button));
    announcement.textContent = `Focused phase: ${group.name}. Other phases remain in this campaign graph; choose another phase or full overview.`;
  };
  for (const [index, group] of path.groups.entries()) {
    const control = action(doc, `${index + 1}. ${group.name}`, () => setPhase(group, control), 'campaign-phase-button');
    control.setAttribute('aria-pressed', 'false');
    phaseControls.append(control);
  }
  const overviewControl = action(doc, 'Full campaign overview', () => {
    box = fittedBox(); paint();
    for (const control of phaseControls.children) control.setAttribute('aria-pressed', 'false');
    announcement.textContent = 'Showing the full campaign overview. Select a phase to enlarge it.';
  }, 'campaign-phase-button');
  overviewControl.setAttribute('aria-pressed', 'false');
  phaseControls.append(overviewControl);
  toolbar.addEventListener('keydown', e => { if (e.key === 'Escape') { endGesture(); movement.open = false; } });
  svg.addEventListener('keydown', e => { if (e.key === 'Escape') endGesture(); });
  function point(event) {
    const matrix = svg.getScreenCTM?.();
    if (matrix && svg.createSVGPoint) {
      const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      return p.matrixTransform(matrix.inverse());
    }
    const rect = svg.getBoundingClientRect(), scale = Math.max(box.w / rect.width, box.h / rect.height);
    return { x: event.clientX * scale, y: event.clientY * scale };
  }
  function endGesture(event) {
    if (!dragging || (event && event.pointerId !== dragging.pointerId)) return;
    const id = dragging.pointerId; suppressClick = dragging.moved; dragging = null;
    if (svg.hasPointerCapture?.(id) !== false) svg.releasePointerCapture?.(id);
  }
  svg.addEventListener('pointerdown', e => {
    if (dragging || (e.button != null && e.button !== 0)) return;
    suppressClick = false;
    const id = e.target.getAttribute?.('data-drag-node');
    if (!id && e.target.closest?.('.research-node, .research-edge')) return;
    dragging = { id, pointerId: e.pointerId, start: point(e), matrix: svg.getScreenCTM?.()?.inverse(),
      clientX: e.clientX, clientY: e.clientY, origin: id ? { ...positions[id] } : { ...box }, moved: false };
    e.preventDefault(); svg.setPointerCapture?.(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    const p = svg.createSVGPoint?.();
    let current;
    if (p && dragging.matrix) { p.x = e.clientX; p.y = e.clientY; current = p.matrixTransform(dragging.matrix); }
    else current = point(e);
    const dx = current.x - dragging.start.x, dy = current.y - dragging.start.y;
    dragging.moved ||= Math.abs(e.clientX - dragging.clientX) + Math.abs(e.clientY - dragging.clientY) > 4;
    if (!dragging.moved) return;
    if (dragging.id) moveNode(dragging.id, { x: dragging.origin.x + dx, y: dragging.origin.y + dy });
    else { box.x = dragging.origin.x - dx; box.y = dragging.origin.y - dy; } paint();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(event, endGesture);
  svg.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.stopPropagation(); }
  }, true);
  const alternative = element(doc, 'details'); alternative.append(element(doc, 'summary', 'Text alternative: all nodes and cited relationships'));
  for (const node of path.nodes) {
    const control = action(doc, node.title, () => showNode(node)); textControls.set(`node:${node.id}`, control);
    alternative.append(control, element(doc, 'p', node.detail), provenance(doc, node), support(doc, model, node.claimIds, navigate, path.caseId));
  }
  for (const edge of path.edges) {
    const control = action(doc, `${path.nodes.find(n => n.id === edge.from)?.title} → ${path.nodes.find(n => n.id === edge.to)?.title} · ${edge.relation}`, () => showEdge(edge));
    textControls.set(`edge:${edge.id}`, control);
    alternative.append(control, element(doc, 'p', edge.basis), provenance(doc, edge), support(doc, model, edge.claimIds, navigate, path.caseId));
  }
  const node = path.nodes.find(n => n.id === selectedEntity), edge = path.edges.find(e => e.id === selectedEntity);
  const initialGroup = path.groups.find(group => group.path.id === (node ?? edge)?.memberPath.id) ?? path.groups[0];
  if (initialGroup) {
    box = focusGroup(initialGroup);
    const index = path.groups.indexOf(initialGroup);
    phaseControls.children[index]?.setAttribute('aria-pressed', 'true');
  }
  paint();
  if (node) showNode(node, false); else if (edge) showEdge(edge, false); else if (path.nodes.length) showNode(path.nodes[0], false);
  viewport.append(svg, toolbar);
  panel.append(phaseControls, viewport, alternative, announcement, inspection); return panel;
}

export function renderExploration(doc, model, view, filters, navigate, selectedId = '', loadDemo, selectedEntity = '') {
  const panel = element(doc, 'section', null, 'exploration');
  panel.append(element(doc, 'p', 'Source-supported observations and pending research proposals. Missing enrichment is not evidence that a behavior did not occur; shared behaviors do not establish shared attribution.', 'subtle'));
  if (loadDemo) panel.append(action(doc, 'Load synthetic research demo (replaces displayed corpus only)', loadDemo));
  const selected = explorationRecords(model, view, filters);
  const matchesTarget = r => r.id === selectedId || (['tools', 'prompts'].includes(view)
    && r.annotations.some(a => `${view}-${a.id}` === selectedId));
  const visibleMemberTarget = view === 'paths' && selected.paths.some(p => p.id === selectedId
    && selected.records.some(match => match.caseId === p.caseId));
  if (selectedId && !selected.records.some(matchesTarget)
    && !visibleMemberTarget
    && !(view === 'telemetry' && list(model, 'detections').some(d => d.id === selectedId
      && explorationRecords(model, 'behaviors', filters).records.some(b => b.id === d.behaviorId)))) {
    panel.append(element(doc, 'p', 'Unknown target or target outside the active filters. No different research record has been substituted.', 'empty'),
      action(doc, `Return to ${EXPLORE_VIEWS[view]}`, () => navigate(view)));
    if (view === 'paths') for (const id of selected.caseIds) panel.append(action(doc, `Return to case: ${model.cases.get(id)?.name}`, () => navigate('cases', id)));
    return panel;
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
      if (view === 'prompts') card.append(element(doc, 'pre', record.annotations[0].value, 'artifact-value'));
      for (const a of record.annotations) {
        const item = annotationCard(doc, model, a, navigate, view !== 'prompts');
        item.append(action(doc, `Campaign: ${model.cases.get(a.caseId)?.name ?? a.caseId}`, () => navigate('cases', a.caseId)));
        if (view !== 'prompts') item.append(support(doc, model, a.claimIds, navigate));
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
      const section = element(doc, 'details', null, 'behavior-group');
      const groups = behaviorInventory(selected.records).filter(group => group.kind === kind);
      section.append(element(doc, 'summary', `${label} · ${groups.length}`));
      const tiles = element(doc, 'div', null, 'behavior-tile-grid');
      for (const group of groups) {
        const item = element(doc, 'article', null, 'behavior-tile');
        if (group.members.length === 1) {
          const member = group.members[0], link = reviewChip(doc, group.name, member.disposition, () => navigate('behaviors', member.id));
          link.title = group.basis; item.append(link);
        } else {
          item.append(element(doc, 'p', group.name), element(doc, 'p', `${group.members.length} source-specific records`, 'subtle'));
          for (const member of group.members) item.append(reviewChip(doc, member.name, member.disposition, () => navigate('behaviors', member.id)));
        }
        tiles.append(item);
      }
      if (groups.length) { section.append(tiles); category.append(section); inventory.append(category); }
    }
    inventory.append(element(doc, 'h3', 'Chained activities from recorded paths'), element(doc, 'p',
      'Each transition retains its recorded relationship and evidence basis. A chain is not an atomic behavior, and connecting two nodes does not prove execution or causality.', 'subtle'));
    const chains = selected.paths.flatMap(p => p.edges.map(edge => ({ p, edge })));
    const relationLabels = { sequence: 'Sequence', conditional: 'Conditional', propagates: 'Propagation' };
    for (const relation of ['sequence', 'conditional', 'propagates']) {
      const members = chains.filter(({ edge }) => edge.relation === relation);
      if (!members.length) continue;
      const section = element(doc, 'details', null, `chain-group chain-${relation}`);
      section.append(element(doc, 'summary', `${relationLabels[relation]} · ${members.length}`));
      const tiles = element(doc, 'div', null, 'chain-tile-grid');
      for (const { p, edge } of members) {
        const from = p.nodes.find(n => n.id === edge.from), to = p.nodes.find(n => n.id === edge.to);
        const item = element(doc, 'article', null, `chain-tile chain-${relation}`);
        item.append(element(doc, 'span', relationLabels[relation], 'chain-kind'),
          element(doc, 'h4', `${from?.title ?? edge.from} → ${to?.title ?? edge.to}`),
          element(doc, 'p', edge.basis, 'subtle'),
          support(doc, model, edge.claimIds, navigate, p.caseId),
          action(doc, 'Inspect recorded relationship', () => navigate('paths', p.id, edge.id)));
        tiles.append(item);
      }
      section.append(tiles); inventory.append(section);
    }
    if (!chains.length) inventory.append(element(doc, 'p', 'No chained activities recorded. Add evidence-supported path relationships through extraction; no chains are inferred from similar behavior names.'));
    panel.append(inventory);
  }
  if (view === 'paths') {
    if (selected.records.length) {
      const path = selected.paths.find(p => p.id === selectedId) ?? selected.records[0];
      if (selectedEntity && ![...path.nodes, ...path.edges].some(r => r.id === selectedEntity)) {
        panel.append(element(doc, 'p', 'Unknown or retired node/relationship in this path. No different entity has been substituted.', 'empty'),
          action(doc, 'Return to path case', () => navigate('cases', path.caseId)),
          action(doc, 'Return to path', () => navigate('paths', path.id))); return panel;
      }
      const choose = element(doc, 'div', null, 'campaign-graph-selector');
      for (const caseId of [...new Set(selected.records.map(p => p.caseId))]) {
        const first = selected.paths.find(p => p.caseId === caseId);
        const control = action(doc, `${model.cases.get(caseId)?.name ?? 'Campaign'} · campaign graph`, () => navigate('paths', first.id));
        control.setAttribute('aria-pressed', String(caseId === path.caseId)); choose.append(control);
      }
      const graph = campaignGraph(model, path.caseId, selected.paths);
      const occurrence = [...graph.nodes, ...graph.edges].find(r => r.memberPath.id === path.id && r.canonicalId === selectedEntity);
      panel.append(choose, renderGraph(doc, model, graph, navigate, occurrence?.id ?? graph.nodes.find(n => n.memberPath.id === path.id)?.id));
    } else {
      panel.append(element(doc, 'p', 'No authored attack paths in the selected corpus. Collection does not automatically reconstruct a graph.', 'empty'));
      for (const id of selected.caseIds) panel.append(action(doc, `Case: ${model.cases.get(id)?.name}`, () => navigate('cases', id)));
      for (const c of model.corpus.claims.filter(c => selected.caseIds.has(c.caseId))) panel.append(action(doc, c.description, () => navigate('claims', c.id)));
      for (const b of explorationRecords(model, 'behaviors', filters).records) panel.append(action(doc, b.name, () => navigate('behaviors', b.id)));
    }
    return panel;
  }
  const grid = element(doc, 'div', null, 'research-grid');
  if (view === 'frameworks') {
    const runs = (model.corpus.governance?.campaignExtraction?.runs ?? []).filter(r => selected.caseIds.has(r.caseId));
    const unresolved = runs.flatMap(r => r.unresolvedMappings ?? []);
    const available = [...Object.values(model.campaignStatus ?? {}).flatMap(s => s.availableCatalogSnapshot?.catalogs ?? []),
      ...(model.publicAvailableCatalogSnapshot?.catalogs ?? []),
      ...(model.publicCatalogSnapshot?.catalogs ?? [])];
    const catalogs = new Map();
    for (const c of [...available, ...runs.flatMap(r => r.catalogSnapshot?.catalogs ?? [])]) {
      const key = `${c.framework}:${c.version}:${c.materialDigest}`;
      if (!catalogs.has(key)) catalogs.set(key, c);
    }
    const catalogPanel = element(doc, 'section', null, 'panel resolver-catalog');
    catalogPanel.append(element(doc, 'h2', 'Mapping and catalog coverage'), element(doc, 'p',
      `${selected.mappings.length} recorded mappings · ${unresolved.length} unresolved candidates · ${catalogs.size} pinned resolver catalogs`),
      element(doc, 'p', 'Resolver references are catalog membership only, not campaign observations. Only validated candidate mappings appear in the mapped technique cards. Missing mappings do not mean no relevant technique applies.', 'subtle'));
    catalogPanel.append(element(doc, 'p', 'Reference lists prefer the current local projection for the same pinned material. Earlier extraction snapshots keep their original membership and provenance; expanding this reference never re-resolves historical mappings.', 'subtle'));
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
      const directSupport = behaviorSupport(model, record).filter(id => selected.caseIds.has(model.claims.get(id)?.caseId));
      const caseIds = new Set([...paths.map(p => p.caseId), ...selected.mappings.filter(m => m.behaviorId === record.id).map(m => m.caseId),
        ...directSupport.map(id => model.claims.get(id)?.caseId).filter(id => selected.caseIds.has(id))]);
      row(doc, card, 'Distinct related cases', caseIds.size);
      for (const id of caseIds) card.append(action(doc, model.cases.get(id)?.name ?? id, () => navigate('cases', id)));
      card.append(support(doc, model, [...directSupport, ...paths.flatMap(p => p.nodes.filter(n => n.behaviorIds.includes(record.id)).flatMap(n => n.claimIds))], navigate, selected.caseIds));
      for (const mapping of selected.mappings.filter(m => m.behaviorId === record.id)) card.append(mappingCard(doc, model, mapping, navigate, mapping.caseId,
        mapping.pathId && mapping.nodeId ? 'Node-scoped candidate' : 'Broader behavior/case candidate'));
      for (const a of (model.annotations ?? []).filter(a => selected.caseIds.has(a.caseId)
        && ['data-sources', 'detection-references'].includes(a.type) && a.claimIds?.some(id => directSupport.includes(id)))) {
        card.append(element(doc, 'h4', a.type === 'data-sources' ? 'Source-reported data source' : 'Published detection reference — not a validated proposal'),
          annotationCard(doc, model, a, navigate));
      }
      for (const [key, target, label] of [['signalIds', 'telemetry', 'Proposed security telemetry'], ['detectionIds', 'telemetry', 'Proposed detection hypothesis'],
        ['otelIds', 'otel', 'Proposed OTEL instrumentation — synthetic sample']]) {
        for (const id of record[key] ?? []) card.append(action(doc, `${label}: ${id}`, () => navigate(target, id)));
      }
    } else if (view === 'frameworks') {
      card.dataset.framework = record.framework;
      row(doc, card, 'Technique / framework / version', [record.id, record.framework, record.version]); card.append(reference(doc, record.url, 'Framework reference'));
      const mappings = selected.mappings.filter(m => m.techniqueId === record.id);
      card.dataset.mapped = String(mappings.length > 0);
      card.append(element(doc, 'p', mappings.length ? `${mappings.length} recorded candidate mappings; catalog membership does not establish occurrence.` : 'No candidate mapping in the selected cases.'));
      for (const mapping of mappings) {
        const scope = mapping.pathId && mapping.nodeId ? 'Node-scoped candidate' : 'Broader behavior/case candidate — not node-specific';
        const section = element(doc, 'details'); section.append(element(doc, 'summary', `${model.cases.get(mapping.caseId)?.name ?? mapping.caseId} · ${mapping.mappingStatus} · ${scope}`), provenance(doc, mapping));
        row(doc, section, 'Rationale', mapping.rationale); row(doc, section, 'Applicability', mapping.applicability); section.append(support(doc, model, mapping.claimIds, navigate, mapping.caseId));
        if (mapping.pathId) section.append(action(doc, 'Inspect target path node', () => navigate('paths', mapping.pathId, mapping.nodeId)));
        card.append(section);
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
