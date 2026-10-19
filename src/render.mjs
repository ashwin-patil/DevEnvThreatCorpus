import { metadata, dateLabel, linkedClaims, passageSegments, conflictPairs, caseSourceIds, comparisonTimeline, researchRelationships, telemetryScopeEntries, researchSources } from './model.mjs';
import { publisherDisplay, sourceInventory, canonicalArticleUrl } from './research-inventory.mjs';
import { campaignCategoryGroups, telemetryCategoryGroups, categoryRule } from './campaign-categories.mjs';

// Corpus values enter the DOM only through textContent; attributes and handlers are UI-owned.
export function element(doc, tag, text, className = '') {
  const node = doc.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

export function action(doc, label, handler, className = 'chip', researchKind) {
  const node = element(doc, 'button', label, className);
  node.type = 'button';
  if (researchKind) node.setAttribute('data-research-kind', researchKind);
  node.addEventListener('click', handler);
  return node;
}

function field(doc, parent, label, value) {
  if (value == null || /^(?:Not available|Unknown)(?: \(|$)/u.test(String(value))) return;
  const row = element(doc, 'p');
  row.append(element(doc, 'strong', `${label}: `), element(doc, 'span', value));
  parent.append(row);
}

export function technicalDetails(doc, rows) {
  const details = element(doc, 'details', null, 'technical-details');
  details.append(element(doc, 'summary', 'Technical provenance'));
  for (const [label, value] of rows) field(doc, details, label, value);
  return details;
}
export function sourceCitation(doc, model, sourceId, navigate, revisionId, prefix = 'Source') {
  const source = model.sources.get(sourceId), publisher = publisherDisplay(source).name;
  const chip = action(doc, prefix ? `${prefix}: ${publisher}` : publisher, () => navigate('sources', sourceId, revisionId), 'chip publisher-tag');
  chip.title = metadata(source, 'title'); chip.setAttribute('aria-label', `${prefix || 'Publisher'}: ${publisher} — ${metadata(source, 'title')}`);
  return chip;
}
export function claimCitation(doc, model, id, navigate, label = 'Supporting evidence') {
  const claim = model.claims.get(id), source = model.sources.get(claim?.sourceId);
  const chip = action(doc, `${label} · ${publisherDisplay(source).name}`, () => navigate('claims', id));
  chip.title = claim?.description ?? 'Supporting claim unavailable'; return chip;
}
export function publisherTags(doc, model, sourceIds, navigate) {
  const section = element(doc, 'div', null, 'publisher-tags');
  const ids = new Set(sourceIds);
  for (const article of sourceInventory(researchSources(model).filter(source => ids.has(source.id)))) {
    section.append(sourceCitation(doc, model, article.id, navigate, undefined, ''));
  }
  return section;
}
export function relatedResearch(doc, model, claimIds, navigate, excludeKey, options = {}) {
  const section = element(doc, 'section', null, 'related-research'), index = researchRelationships(model), seen = new Set();
  const related = claimIds.flatMap(id => index.byClaim.get(id) ?? []).filter(object => {
    const key = `${object.type}:${object.view}:${object.targetId}`;
    if (object.key === excludeKey || seen.has(key) || options.types && !options.types.includes(object.type)
      || options.excludeViews?.includes(object.view)) return false;
    seen.add(key); return true;
  });
  const caseIds = options.campaigns === false ? [] : [...new Set(claimIds.map(id => model.claims.get(id)?.caseId).filter(id => model.cases.has(id)))];
  if (!related.length && !caseIds.length) return section;
  section.append(element(doc, 'h4', 'Related research'));
  if (caseIds.length) {
    const campaigns = element(doc, 'section', null, 'related-group'); campaigns.setAttribute('data-related-group', 'campaigns');
    campaigns.append(element(doc, 'h5', 'Campaigns tagged'));
    for (const id of caseIds) campaigns.append(action(doc, model.cases.get(id).name, () => navigate('cases', id), 'chip campaign-tag'));
    section.append(campaigns);
  }
  const groups = new Map();
  for (const object of related) {
    const group = { behaviors: 'Behaviors', telemetryScopes: 'Log Collection/Telemetry Scope', categorizations: 'Categories',
      paths: 'Attack flow', mappings: 'Framework mappings', telemetry: 'Telemetry proposals', detections: 'Detection hypotheses',
      otel: 'Instrumentation', timelines: 'Timelines', annotations: object.view === 'prompts' ? 'Prompts'
        : object.view === 'tools' ? 'AI tools' : 'Source artifacts' }[object.type];
    if (!groups.has(group)) {
      const block = element(doc, 'section', null, 'related-group');
      block.setAttribute('data-related-group', object.type === 'annotations' ? object.view : object.type);
      block.append(element(doc, 'h5', group)); groups.set(group, block); section.append(block);
    }
    const sourceId = object.type === 'telemetryScopes' && claimIds.length === 1 ? model.claims.get(claimIds[0])?.sourceId : '';
    groups.get(group).append(action(doc, `${{ behaviors: 'Behavior', telemetryScopes: 'Log scope', categorizations: 'Category', paths: 'Attack path',
      annotations: object.view === 'prompts' ? 'Prompt' : object.view === 'tools' ? 'AI tool' : 'Source artifact',
      mappings: 'Mapping', telemetry: 'Telemetry', detections: 'Detection', otel: 'Instrumentation', timelines: 'Timeline' }[object.type]}: ${object.label}`,
    () => navigate(object.view, object.targetId, sourceId), 'chip',
    object.type === 'categorizations' ? 'category' : { cases: 'campaign', sources: 'publisher', behaviors: 'behavior', tools: 'tool', prompts: 'prompt',
      paths: 'flow', telemetry: 'telemetry' }[object.view]));
  }
  return section;
}
const REVIEW = { Pending: ['Awaiting human review', '◐', 'pending'], Accepted: ['Recorded acceptance; eligibility requires review', '✓', 'accepted'],
  'Needs correction': ['Needs correction', '!', 'correction'], Excluded: ['Excluded', '×', 'excluded'] };
export function reviewChip(doc, name, disposition, handler) {
  const [label, symbol, key] = REVIEW[disposition] ?? ['Review state unavailable', '?', 'unclassified'];
  const chip = action(doc, `${symbol} ${name}`, handler, `chip review-${key}`);
  chip.title = label; chip.setAttribute('aria-label', `${name}: ${label}`); return chip;
}
export function reviewLegend(doc) {
  const legend = element(doc, 'aside', null, 'usage-legend'); legend.setAttribute('aria-label', 'Human review legend');
  legend.append(element(doc, 'strong', 'Human review'));
  for (const [state, [label, symbol, key]] of Object.entries(REVIEW)) legend.append(element(doc, 'span', `${symbol} ${state}`, `usage-key review-${key}`));
  legend.append(element(doc, 'p', 'Pending means awaiting human review. Review state is separate from whether an attack was attempted or succeeded. Recorded acceptance still requires eligibility checks.', 'legend-note subtle'));
  return legend;
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function externalLink(doc, value) {
  const safe = safeExternalUrl(value);
  if (!safe) return element(doc, 'span', value ?? 'Not available (unknown)');
  const link = element(doc, 'a', value);
  link.href = safe; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}

export function caseCitations(model, record) {
  return { schemaVersion: 'campaign-citations/1', caseId: record.id, caseName: record.name,
    citations: sourceInventory(caseSourceIds(model, record.id).map(id => model.sources.get(id)).filter(Boolean)).map(group => {
      const source = group.source;
      const alias = canonicalArticleUrl(source.originalUrl) !== safeExternalUrl(source.originalUrl);
      return { sourceId: source.id, title: source?.title ?? null,
        publisher: group.members.length > 1 || alias ? group.publisher.name : source?.publisher ?? null,
        url: safeExternalUrl(group.canonicalUrl) ?? safeExternalUrl(source?.originalUrl),
        publicationDate: source?.publicationDate ?? null, retrievalDate: source?.retrievalDate ?? null,
        sourceRevisionIds: [...new Set(group.members.flatMap(member => member.revisionIds ?? []))],
        members: group.members.map(member => ({ sourceId: member.id, originalUrl: safeExternalUrl(member.originalUrl),
          canonicalUrl: safeExternalUrl(member.canonicalUrl), sourceRevisionIds: [...(member.revisionIds ?? [])] })) };
    }) };
}

function archiveDownloads(doc, model, source, revision) {
  if (!model.collectionEnabled ||
      !/^source-[a-f0-9]{64}$/.test(source.id) || !/^source-revision-[a-f0-9]{64}$/.test(revision.id)) return null;
  const section = element(doc, 'section', null, 'archive-downloads');
  section.append(element(doc, 'h3', 'Private archive downloads (when retained)'),
    element(doc, 'p', 'Extracted text is displayed below. Original HTML is untrusted: download only, never rendered in this workbench. Legacy snapshots may not have archived files.', 'subtle'));
  for (const [artifact, label] of [['article.txt', 'Extracted article text'], ['original.html', 'Original HTML (untrusted)'],
    ['metadata.json', 'Citation / archive metadata'], ['assets.json', 'Image outcomes / hashes']]) {
    const link = element(doc, 'a', label, 'chip');
    link.href = `/api/archive/${source.id}/${revision.id}/${artifact}`;
    link.download = artifact;
    section.append(link);
  }
  return section;
}

export function renderClaim(doc, model, claim, navigate, compact = false, relations = {}) {
  const card = element(doc, 'article', null, 'claim-card');
  card.append(cardContext(doc, model, [claim.caseId], navigate, new Set([claim.sourceId])));
  card.append(element(doc, 'p', claim.inference ? 'Researcher inference — not a source assertion' :
    'Author / source assertion — not independently established', 'eyebrow'));
  card.append(action(doc, claim.description, () => navigate('claims', claim.id), 'claim-title'));
  card.append(technicalDetails(doc, [['Claim identifier', claim.id], ['Claim revision', claim.revision], ['Source revision', claim.sourceRevisionId], ['Missing metadata reasons', JSON.stringify(claim.nullReasons ?? {})]]));
  for (const key of ['origin', 'evidenceStatus', 'disposition', 'uncertainty', 'observationContext']) {
    field(doc, card, { evidenceStatus: 'Evidence status', observationContext: 'Observation context' }[key] ??
      key[0].toUpperCase() + key.slice(1), metadata(claim, key));
  }
  const source = model.sources.get(claim.sourceId);
  card.append(sourceCitation(doc, model, claim.sourceId, navigate, claim.sourceRevisionId));
  if (!compact) {
    card.append(relatedResearch(doc, model, [claim.id], navigate, undefined, relations));
    if (claim.inference) {
      field(doc, card, 'Inference rationale', claim.inference.rationale);
      card.append(element(doc, 'h4', 'Inference support — separate claims, not quoted passages'));
      for (const id of claim.inference.supportingClaimIds) {
        card.append(action(doc, `Supporting claim: ${model.claims.get(id)?.description ?? id}`,
          () => navigate('claims', id)));
      }
    }
    for (const id of claim.passageIds) {
      const passage = model.passages.get(id);
      if (!passage) continue;
      card.append(technicalDetails(doc, [['Passage identifier', id], ['Locator', passage.locator], ['Code-point interval', `[${passage.start}, ${passage.end})`]]));
      card.append(element(doc, 'blockquote', metadata(passage, 'text')));
    }
    if (!claim.passageIds.length && !claim.inference) card.append(element(doc, 'p', 'No retained supporting passage.'));
  }
  return card;
}

export function renderConflicts(doc, model, claimIds, navigate) {
  const section = element(doc, 'section', null, 'conflicts');
  const pairs = conflictPairs(model, claimIds);
  if (!pairs.length) return section;
  section.append(element(doc, 'h3', `Conflicting claims · ${pairs.length} retained pair(s)`),
    element(doc, 'p', 'Contradictions are preserved. Neither side is chosen or merged by this workbench.'));
  for (const pair of pairs) {
    const row = element(doc, 'div', null, 'conflict-pair');
    for (const claim of pair) row.append(renderClaim(doc, model, claim, navigate, true));
    section.append(row);
  }
  return section;
}

export function renderSourceText(doc, revision, passages, onPassages) {
  const text = element(doc, 'div', null, 'source-text');
  if (revision.normalizedContent === null) {
    text.append(element(doc, 'p', `Normalized text not retained (${revision.nullReasons?.normalizedContent ?? 'unknown'}). Locators are not verified quotations.`));
    return text;
  }
  for (const segment of passageSegments(revision.normalizedContent, passages)) {
    if (segment.passageIds.length) {
      const button = action(doc, segment.text, () => {
        if (!doc.getSelection?.()?.toString()) onPassages(segment.passageIds);
      }, 'passage-highlight');
      button.setAttribute('aria-label', `${segment.text} · ${segment.passageIds.length} linked passages · code points ${segment.start}–${segment.end}; show linked claims`);
      button.title = `${segment.passageIds.length} overlapping evidence passages`;
      text.append(button);
    } else text.append(element(doc, 'span', segment.text));
  }
  return text;
}

export function renderSource(doc, model, source, revisionId, navigate, onRevision, onPassages, activePassages = [], onDraft) {
  const section = element(doc, 'section', null, 'panel');
  const caseIds = model.corpus.cases.filter(record => caseSourceIds(model, record.id).includes(source.id)).map(record => record.id);
  section.append(cardContext(doc, model, caseIds, navigate, new Set([source.id])));
  section.append(element(doc, 'h2', metadata(source, 'title')));
  field(doc, section, 'Display publisher', publisherDisplay(source).name);
  field(doc, section, 'Publisher display basis', publisherDisplay(source).basis);
  for (const key of ['publisher', 'author', 'originalUrl', 'canonicalUrl', 'inputKind', 'extractionStatus', 'collectionState']) {
    field(doc, section, key === 'publisher' ? 'Reported publisher' : key, metadata(source, key));
  }
  for (const key of ['publicationDate', 'updateDate', 'retrievalDate']) field(doc, section, key, dateLabel(source[key]));
  if (safeExternalUrl(source.originalUrl) || safeExternalUrl(source.canonicalUrl)) {
    const original = element(doc, 'p', 'Original source: ');
    original.append(externalLink(doc, safeExternalUrl(source.originalUrl) ? source.originalUrl : source.canonicalUrl));
    section.append(original);
  }
  field(doc, section, 'Provenance', `${source.provenance.kind} · ${metadata(source.provenance, 'suppliedBy')} · ${source.provenance.description}`);
  const label = element(doc, 'label', 'Source revision (older snapshots preserved) ');
  const select = element(doc, 'select');
  const revisions = model.corpus.sourceRevisions.filter(r => r.sourceId === source.id);
  for (const [index, revision] of revisions.entries()) {
    const option = element(doc, 'option', `Snapshot ${index + 1}`);
    option.value = revision.id; select.append(option);
  }
  const revision = revisions.find(r => r.id === revisionId) ?? revisions.at(-1);
  const attempts = model.corpus.collectionManifests.filter(item => item.inputSourceIds.includes(source.id));
  const eventTime = manifest => Date.parse(manifest.limitations.find(text => text.startsWith('event-time='))?.slice(11) ?? '');
  const successes = attempts.filter(item => item.outcome === 'Succeeded').map(eventTime).filter(Number.isFinite);
  const latestSuccess = successes.length ? Math.max(...successes) : -Infinity;
  const earlierFailures = [];
  for (const manifest of attempts.filter(item => item.outcome === 'Failed')) {
    const note = element(doc, 'p', `Failed intake attempt — not successful evidence: ${manifest.limitations.filter(text => /^(?:error-code|event-time|robots-reason)=/.test(text)).join(' · ')}`);
    if (manifest.limitations.includes('error-code=ROBOTS_UNSUPPORTED')) note.append(element(doc, 'span',
      ' Robots compatibility failed closed. Inspect the bounded reason; operator-supplied text/file with --source-url and supplier attribution is available only when retention is authorized.'));
    if (revision && eventTime(manifest) < latestSuccess) earlierFailures.push(note);
    else section.append(note);
  }
  if (earlierFailures.length) {
    const history = element(doc, 'details');
    history.append(element(doc, 'summary', `Previous intake history (${earlierFailures.length}) — a later collection succeeded`), ...earlierFailures);
    section.append(history);
  }
  if (revisionId && !revisions.some(r => r.id === revisionId)) {
    section.append(element(doc, 'p', 'Requested revision is not available for this source; showing the available snapshot below.', 'subtle'));
  }
  select.value = revision?.id ?? '';
  select.addEventListener('change', () => onRevision(select.value));
  label.append(select); section.append(label);
  if (!revision) {
    section.append(element(doc, 'p', 'No source snapshot is available.')); return section;
  }
  section.append(technicalDetails(doc, [['Snapshot identifier', revision.id], ['Normalization / parser', `${revision.normalizationVersion} · ${revision.parserVersion}`], ['Normalized hash', revision.normalizedHash], ['Raw hash / retention', `${revision.rawHash} · ${revision.retention}`], ['Missing metadata reasons', JSON.stringify(source.nullReasons ?? {})]]));
  field(doc, section, 'Snapshot provenance', `${revision.provenance.kind} · ${metadata(revision.provenance, 'suppliedBy')} · ${revision.provenance.description}`);
  const archive = archiveDownloads(doc, model, source, revision);
  if (archive) section.append(archive);
  const split = element(doc, 'div', null, 'evidence-split');
  const left = element(doc, 'section'), right = element(doc, 'section');
  const passages = model.corpus.passages.filter(p => p.sourceRevisionId === revision.id);
  const sourceText = renderSourceText(doc, revision, passages, onPassages);
  if (onDraft && revision.normalizedContent !== null) {
    const capture = () => { if (doc.getSelection?.()?.toString()) onDraft(revision, sourceText); };
    sourceText.addEventListener('pointerup', capture);
    sourceText.addEventListener('keyup', capture);
    sourceText.tabIndex = 0;
    left.append(action(doc, 'Draft from this revision', () => onDraft(revision)),
      element(doc, 'p', 'Select text to open the curator studio with exact passage offsets; the loaded corpus remains unchanged.', 'subtle'));
  }
  left.append(element(doc, 'h3', 'Normalized source text'),
    element(doc, 'p', 'Highlight intervals use Unicode code points, not bytes or UTF-16. Click a highlight to reveal every overlapping passage’s claims.', 'subtle'),
    sourceText);
  const passageLinks = element(doc, 'details'); passageLinks.append(element(doc, 'summary', `Evidence passages · ${passages.length}`));
  for (const [index, passage] of passages.entries()) {
    const chip = action(doc, `${publisherDisplay(source).name} · Passage ${index + 1}`, () => onPassages([passage.id]));
    chip.title = `Show claims supported by code points ${passage.start}–${passage.end}`; passageLinks.append(chip);
  }
  if (passages.length) left.append(passageLinks);
  right.append(element(doc, 'h3', 'Linked claims · exact selected revision'));
  if (activePassages.length) {
    right.append(element(doc, 'p', `${activePassages.length} evidence passage(s) selected`),
      action(doc, 'Show all revision claims', () => onPassages([])));
  }
  const claims = linkedClaims(model, source.id, revision.id).filter(c =>
    !activePassages.length || c.passageIds.some(id => activePassages.includes(id)));
  for (const claim of claims) right.append(renderClaim(doc, model, claim, navigate));
  if (!claims.length) right.append(element(doc, 'p', 'No linked claims for this revision / passage. This does not mean no behavior occurred.'));
  split.append(left, right); section.append(split,
    renderConflicts(doc, model, linkedClaims(model, source.id, revision.id).map(c => c.id), navigate));
  return section;
}

function categoryBadges(doc, model, caseIds, sourceIds, scope, navigate, includeContext = false) {
  const badges = element(doc, 'div', null, 'campaign-category-badges');
  badges.setAttribute('aria-label', scope ? 'Proposed telemetry scope and review state' : 'Campaign categories and review state');
  const groups = new Map();
  const ids = Array.isArray(caseIds) ? caseIds : [caseIds];
  for (const id of ids) {
    for (const group of (scope ? telemetryCategoryGroups : campaignCategoryGroups)(model.corpus, id, sourceIds)) {
      if (!groups.has(group.id)) groups.set(group.id, { ...group, records: [], inherited: false, caseId: id });
      groups.get(group.id).records.push(...group.records);
    }
  }
  if (includeContext && sourceIds && !scope) for (const id of ids) {
    for (const group of campaignCategoryGroups(model.corpus, id)) {
      if (groups.has(group.id) && !groups.get(group.id).inherited) continue;
      if (!groups.has(group.id)) groups.set(group.id, { ...group, records: [], inherited: true, caseId: id });
      groups.get(group.id).records.push(...group.records);
    }
  }
  for (const group of groups.values()) {
    const states = [...new Set(group.records.map(c => c.itemReview?.state ?? c.disposition))];
    const state = states.length !== 1 ? 'Pending' : states[0] === 'Accepted' ? 'Recorded acceptance' : states[0];
    const label = `${group.value} · ${state}`, className = `usage-key ${scope ? 'telemetry-scope-badge' : 'campaign-category-badge'}`;
    const badge = scope && navigate ? action(doc, label, () => navigate('telemetry', group.records[0].id, sourceIds ? [...sourceIds][0] : ''), className)
      : navigate ? action(doc, label, () => navigate('cases', group.caseId), className) : element(doc, 'span', label, className);
    badge.title = `${group.description} ${scope ? 'Collection scope only; logs, coverage and deployment are not established.' : 'Classification does not establish successful abuse.'}`;
    if (states.length !== 1) badge.title += ` Recorded review states: ${states.join(', ')}.`;
    badge.setAttribute('data-category-basis', group.inherited ? 'campaign-context' : 'source-supported');
    if (group.inherited) badge.title += ' Campaign-level association only; this blog is not independently classified by this badge.';
    badges.append(badge);
  }
  return badges;
}
export const campaignCategoryBadges = (doc, model, caseIds, sourceIds, navigate, includeContext = false) =>
  categoryBadges(doc, model, caseIds, sourceIds, false, navigate, includeContext);
export function cardContext(doc, model, caseIds, navigate, sourceIds) {
  const section = element(doc, 'div', null, 'card-badges card-context'), campaigns = element(doc, 'div', null, 'campaign-links');
  const ids = [...new Set(caseIds)].filter(id => model.cases.has(id));
  for (const id of ids) campaigns.append(action(doc, `Campaign: ${model.cases.get(id).name}`, () => navigate('cases', id), 'chip campaign-tag'));
  section.append(campaigns, campaignCategoryBadges(doc, model, ids, sourceIds, navigate, true));
  return section;
}
export const telemetryScopeBadges = (doc, model, caseIds, sourceIds, navigate) => {
  const section = element(doc, 'section', null, 'telemetry-scope-summary');
  const entries = telemetryScopeEntries(model, new Set(Array.isArray(caseIds) ? caseIds : [caseIds]), sourceIds);
  if (!entries.length) return section;
  section.append(element(doc, 'h3', 'Log Collection/Telemetry Scope'));
  section.append(categoryBadges(doc, model, caseIds, sourceIds, true, navigate));
  const claimIds = new Set(entries.flatMap(r => r.claimIds)), sources = new Set(entries.flatMap(r => r.sourceIds));
  section.append(element(doc, 'p', `${claimIds.size} supporting claims · ${sourceInventory([...sources].map(id => model.sources.get(id)).filter(Boolean)).length} source articles`, 'subtle scope-citation'));
  return section;
};

export function renderCampaignCategories(doc, model, caseId, navigate, openReview, showBadges = true, sourceIds, scope = false) {
  const section = element(doc, 'section', null, 'campaign-categories');
  section.append(element(doc, 'h3', scope ? 'Telemetry scope (proposed)' : 'Campaign categories'));
  if (showBadges) section.append((scope ? telemetryScopeBadges : campaignCategoryBadges)(doc, model, caseId, sourceIds, navigate));
  const groups = (scope ? telemetryCategoryGroups : campaignCategoryGroups)(model.corpus, caseId, sourceIds);
  if (!groups.length) {
    section.append(element(doc, 'p', scope ? 'No telemetry scope classification recorded; this is not evidence that logs are unavailable.'
      : 'Unclassified: no supported high-level category recorded. This is not evidence of no AI involvement.', 'subtle'));
    return section;
  }
  section.append(element(doc, 'p', scope ? 'Source-supported collection-scope proposals, not observed logs, validated events, detection coverage or deployment. Availability and enterprise visibility require separate evaluation.'
    : 'Overlapping research labels, not official technique mappings. Pending rules classify source-linked claim wording, not success or human acceptance.', 'subtle'));
  const details = element(doc, 'details');
  details.append(element(doc, 'summary', scope ? 'Telemetry scope evidence & review' : 'Category evidence & review'));
  for (const group of groups) {
    details.append(element(doc, 'h4', group.value), element(doc, 'p', group.description));
    for (const category of group.records) {
      const block = element(doc, 'div', null, 'category-evidence');
      const rule = categoryRule(category);
      block.append(element(doc, 'p', `${category.origin} · ${category.itemReview?.state ?? category.disposition}${rule ? ` · ${rule.version}/${rule.id}` : ''}`, 'subtle'));
      for (const id of category.supportingClaimIds) block.append(claimCitation(doc, model, id, navigate, scope ? 'Scope evidence' : 'Category evidence'));
      details.append(block);
    }
  }
  if (model.itemReview && openReview) details.append(action(doc, scope ? 'Review telemetry scope' : 'Review campaign categories',
    () => openReview(caseId, sourceIds ? [...sourceIds][0] : '', 'All', scope ? 'telemetry-scope' : 'campaigns')));
  else details.append(element(doc, 'p', 'This preview cannot save category decisions. Retained evidence and the supported local HITL workflow are required.', 'subtle'));
  section.append(details);
  return section;
}

export function renderCase(doc, model, record, navigate, exportReferences) {
  const panel = element(doc, 'article', null, 'panel');
  panel.append(cardContext(doc, model, [record.id], navigate));
  panel.append(element(doc, 'h2', record.name));
  panel.append(renderCampaignCategories(doc, model, record.id, navigate));
  panel.append(telemetryScopeBadges(doc, model, record.id, undefined, navigate));
  panel.append(technicalDetails(doc, [['Campaign identifier', record.id], ['Revision', record.revision]]));
  for (const key of ['kind', 'summary', 'limits', 'origin', 'disposition', 'collectionState']) {
    field(doc, panel, key, metadata(record, key));
  }
  panel.append(element(doc, 'h3', 'Sources · shared citation is not shared attribution'));
  const references = caseCitations(model, record);
  if (exportReferences) panel.append(action(doc, 'Download all campaign citations (JSON)', () => exportReferences(references)));
  for (const citation of references.citations) {
    const source = model.sources.get(citation.sourceId), reference = element(doc, 'section', null, 'citation');
    reference.append(action(doc, metadata(source, 'title'), () => navigate('sources', citation.sourceId)));
    field(doc, reference, 'Normalized publisher', publisherDisplay(source).name);
    field(doc, reference, 'Publisher display basis', publisherDisplay(source).basis);
    field(doc, reference, 'Reported publisher', metadata(source, 'publisher'));
    const url = element(doc, 'p', 'Original URL: ');
    url.append(externalLink(doc, source?.originalUrl ?? source?.canonicalUrl)); reference.append(url);
    field(doc, reference, 'Publication date', dateLabel(citation.publicationDate));
    field(doc, reference, 'Retrieved', dateLabel(citation.retrievalDate));
    if (!source?.revisionIds.length) reference.append(element(doc, 'p', 'No retained revision: this intake is not successful source evidence.'));
    panel.append(reference);
  }
  panel.append(element(doc, 'h3', 'Summary claim basis'));
  for (const id of record.summaryClaimIds) panel.append(action(doc,
    model.claims.get(id)?.description ?? id, () => navigate('claims', id)));
  panel.append(element(doc, 'h3', 'Categorization / tags · proposals retain disposition'));
  for (const category of model.corpus.categorizations.filter(c => c.caseId === record.id && c.dimension !== 'telemetry_scope')) {
    const block = element(doc, 'div', null, 'claim-card');
    field(doc, block, category.dimension, `${metadata(category, 'value')} · ${category.origin} · ${category.disposition}`);
    if (category.otherText !== null) field(doc, block, 'Other detail', category.otherText);
    for (const id of category.supportingClaimIds) block.append(claimCitation(doc, model, id, navigate, 'Category evidence'));
    for (const id of category.sourceIds) block.append(sourceCitation(doc, model, id, navigate, undefined, 'Category source'));
    panel.append(block);
  }
  panel.append(element(doc, 'h3', 'Typed dates · publication is not execution'));
  for (const item of model.corpus.timelines.filter(t => t.caseId === record.id)) {
    panel.append(renderTimelineItem(doc, model, item, navigate));
  }
  panel.append(element(doc, 'h3', 'All case claims'));
  const claims = model.corpus.claims.filter(c => c.caseId === record.id);
  for (const claim of claims) panel.append(renderClaim(doc, model, claim, navigate));
  panel.append(renderConflicts(doc, model, claims.map(c => c.id), navigate));
  return panel;
}

export function renderTimelineItem(doc, model, item, navigate) {
  const block = element(doc, 'article', null, 'claim-card');
  if (item.date == null) field(doc, block, 'Undated entry', `${item.dateType} · ${item.description}`);
  else field(doc, block, item.dateType, `${dateLabel(item.date)} · ${item.description}`);
  if (item.kind === 'source') {
    field(doc, block, 'Basis', 'Source metadata only — not an incident or execution date');
    block.append(sourceCitation(doc, model, item.sourceId, navigate));
    return block;
  }
  block.append(action(doc, `Case: ${model.cases.get(item.caseId)?.name ?? 'Case unavailable'}`, () => navigate('cases', item.caseId)));
  field(doc, block, 'Basis', item.basis);
  field(doc, block, 'Uncertainty', metadata(item, 'uncertainty'));
  field(doc, block, 'Origin / disposition', `${item.origin} · ${item.disposition}`);
  for (const id of item.supportingClaimIds) block.append(claimCitation(doc, model, id, navigate, 'Date evidence'));
  for (const id of item.sourceRevisionIds) {
    const revision = model.sourceRevisions.get(id);
    if (revision) block.append(sourceCitation(doc, model, revision.sourceId, navigate, id, 'Date source'));
  }
  return block;
}

export function renderComparison(doc, model, selection, filters, navigate) {
  const panel = element(doc, 'section', null, 'panel');
  panel.append(element(doc, 'h2', 'Observations within the collected dataset'),
    element(doc, 'p', 'Compare the separately cited claims below. Shared labels or citations do not establish shared behavior, actors, attribution, or prevalence. Missing data is not evidence that an event did not occur.'),
    element(doc, 'p', 'Category filters use case-linked assertions, including pending or contradictory proposals, not established case facts. Evidence status and reviewer disposition match each claim itself.'));
  const columns = element(doc, 'div', null, 'evidence-split');
  for (const record of selection.cases) {
    const column = element(doc, 'section');
    column.append(cardContext(doc, model, [record.id], navigate), element(doc, 'h3', record.name),
      action(doc, 'Open case context', () => navigate('cases', record.id)),
      element(doc, 'p', `${record.kind} · ${record.origin} · ${record.disposition} · ${metadata(record, 'limits')}`));
    for (const category of model.corpus.categorizations.filter(c => c.caseId === record.id)) {
      const card = element(doc, 'article', null, 'claim-card');
      card.append(cardContext(doc, model, [record.id], navigate, new Set(category.sourceIds)));
      card.append(element(doc, 'p', `Recorded category assertion: ${category.dimension} = ${metadata(category, 'value')} · ${category.origin} · ${category.disposition}`));
      if (category.otherText !== null) field(doc, card, 'Other detail', category.otherText);
      for (const id of category.supportingClaimIds) card.append(claimCitation(doc, model, id, navigate, 'Category evidence'));
      for (const id of category.sourceIds) card.append(sourceCitation(doc, model, id, navigate, undefined, 'Category source'));
      column.append(card);
    }
    column.append(element(doc, 'h4', 'Source-supported claims · not independently established'));
    const claims = selection.supported.filter(c => c.caseId === record.id);
    for (const claim of claims) {
      const card = renderClaim(doc, model, claim, navigate);
      const source = model.sources.get(claim.sourceId);
      field(doc, card, 'Source publication', dateLabel(source.publicationDate));
      field(doc, card, 'Source update', dateLabel(source.updateDate));
      const event = model.corpus.reviews.find(r => r.id === claim.history.at(-1));
      field(doc, card, 'Recorded review event', event ?
        `${event.reviewerKind} · ${event.reviewer} · ${event.timestamp} · ${event.disposition} · ${event.rationale}` :
        'No recorded review event');
      column.append(card);
    }
    if (!claims.length) column.append(element(doc, 'p', 'No matching source-supported claims. This is not evidence of absent behavior.'));
    columns.append(column);
  }
  panel.append(columns, element(doc, 'h3', 'Shared citations across selected cases · not shared attribution'));
  const shared = selection.sourceIds.filter(id =>
    new Set(selection.supported.filter(c => c.sourceId === id).map(c => c.caseId)).size > 1);
  for (const id of shared) {
    const row = element(doc, 'div', null, 'claim-card');
    row.append(sourceCitation(doc, model, id, navigate, undefined, 'Shared source'));
    for (const [index, claim] of selection.supported.filter(c => c.sourceId === id).entries()) row.append(claimCitation(doc, model, claim.id, navigate, `${model.cases.get(claim.caseId).name} · Evidence ${index + 1}`));
    panel.append(row);
  }
  if (!shared.length) panel.append(element(doc, 'p', 'No shared citations among matching source-supported claims.'));
  panel.append(element(doc, 'p', 'Conflict counterparts may be outside the active filters. They are context only and are not added to the selected counts.'),
    renderConflicts(doc, model, selection.claims.map(c => c.id), navigate));
  if (selection.unresolved.length) {
    const details = element(doc, 'details');
    details.append(element(doc, 'summary', `${selection.unresolved.length} inference / unresolved-support claims · excluded from source-supported comparison`));
    for (const claim of selection.unresolved) details.append(renderClaim(doc, model, claim, navigate));
    panel.append(details);
  }
  const timeline = comparisonTimeline(model, selection, filters);
  panel.append(element(doc, 'h3', 'Typed timeline · source metadata is not execution'),
    element(doc, 'p', 'Timeline shows selected case context, not only matching claims. Dated entries sort by earliest possible bound, not a known event day. Overlapping approximate intervals do not establish event order. Source metadata appears once per source; case timeline assertions remain distinct.'));
  for (const item of timeline.dated) panel.append(renderTimelineItem(doc, model, item, navigate));
  if (timeline.unknown.length) {
    const undated = element(doc, 'details', null, 'undated-entries');
    undated.append(element(doc, 'summary', `Undated entries · ${timeline.unknown.length}`), element(doc, 'p', 'Dates are not reported; entries remain unordered and are excluded from dated chronology.'));
    for (const item of timeline.unknown) undated.append(renderTimelineItem(doc, model, item, navigate));
    panel.append(undated);
  }
  if (!timeline.dated.length && !timeline.unknown.length) panel.append(element(doc, 'p', 'No timeline entries match the typed date filter.'));
  return panel;
}
