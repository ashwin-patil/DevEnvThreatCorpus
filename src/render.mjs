import { metadata, dateLabel, linkedClaims, passageSegments, conflictPairs, caseSourceIds, comparisonTimeline } from './model.mjs';

// Corpus values enter the DOM only through textContent; attributes and handlers are UI-owned.
export function element(doc, tag, text, className = '') {
  const node = doc.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

export function action(doc, label, handler, className = 'chip') {
  const node = element(doc, 'button', label, className);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function field(doc, parent, label, value) {
  const row = element(doc, 'p');
  row.append(element(doc, 'strong', `${label}: `), element(doc, 'span', value));
  parent.append(row);
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
    citations: caseSourceIds(model, record.id).map(id => {
      const source = model.sources.get(id);
      return { sourceId: id, title: source?.title ?? null, publisher: source?.publisher ?? null,
        url: safeExternalUrl(source?.originalUrl) ?? safeExternalUrl(source?.canonicalUrl),
        publicationDate: source?.publicationDate ?? null, retrievalDate: source?.retrievalDate ?? null,
        sourceRevisionIds: [...(source?.revisionIds ?? [])] };
    }) };
}

function archiveDownloads(doc, model, source, revision) {
  if (!model.collectionEnabled || source.inputKind !== 'url' ||
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

export function renderClaim(doc, model, claim, navigate, compact = false) {
  const card = element(doc, 'article', null, 'claim-card');
  card.append(element(doc, 'p', claim.inference ? 'Researcher inference — not a source assertion' :
    'Author / source assertion — not independently established', 'eyebrow'));
  card.append(action(doc, claim.description, () => navigate('claims', claim.id), 'claim-title'));
  field(doc, card, 'Claim ID / revision', `${claim.id} / ${claim.revision}`);
  for (const key of ['origin', 'evidenceStatus', 'disposition', 'uncertainty', 'observationContext']) {
    field(doc, card, { evidenceStatus: 'Evidence status', observationContext: 'Observation context' }[key] ??
      key[0].toUpperCase() + key.slice(1), metadata(claim, key));
  }
  const source = model.sources.get(claim.sourceId);
  card.append(action(doc, `Source: ${metadata(source, 'title')} · exact revision ${claim.sourceRevisionId}`,
    () => navigate('sources', claim.sourceId, claim.sourceRevisionId)));
  card.append(action(doc, `Case: ${model.cases.get(claim.caseId)?.name ?? claim.caseId}`,
    () => navigate('cases', claim.caseId)));
  if (!compact) {
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
      field(doc, card, 'Passage / locator / code-point interval', `${id} · ${passage.locator} · [${passage.start}, ${passage.end})`);
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
      button.setAttribute('aria-label', `${segment.text} · passages ${segment.passageIds.join(', ')} · code points ${segment.start}–${segment.end}; show linked claims`);
      button.title = `Overlapping passages: ${segment.passageIds.join(', ')}`;
      text.append(button);
    } else text.append(element(doc, 'span', segment.text));
  }
  return text;
}

export function renderSource(doc, model, source, revisionId, navigate, onRevision, onPassages, activePassages = [], onDraft) {
  const section = element(doc, 'section', null, 'panel');
  section.append(element(doc, 'h2', metadata(source, 'title')));
  for (const key of ['publisher', 'author', 'originalUrl', 'canonicalUrl', 'inputKind', 'extractionStatus', 'collectionState']) {
    field(doc, section, key, metadata(source, key));
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
  for (const revision of revisions) {
    const option = element(doc, 'option', revision.id);
    option.value = revision.id; select.append(option);
  }
  const revision = revisions.find(r => r.id === revisionId) ?? revisions.at(-1);
  for (const manifest of model.corpus.collectionManifests.filter(item => item.outcome === 'Failed' && item.inputSourceIds.includes(source.id))) {
    section.append(element(doc, 'p', `Failed intake attempt — not successful evidence: ${manifest.limitations.filter(text => /^(?:error-code|event-time)=/.test(text)).join(' · ')}`));
  }
  if (revisionId && !revisions.some(r => r.id === revisionId)) {
    section.append(element(doc, 'p', `Requested revision ${revisionId} is not available for this source; showing ${revision?.id ?? 'no snapshot'} instead.`, 'subtle'));
  }
  select.value = revision?.id ?? '';
  select.addEventListener('change', () => onRevision(select.value));
  label.append(select); section.append(label);
  if (!revision) {
    section.append(element(doc, 'p', 'No source snapshot is available.')); return section;
  }
  field(doc, section, 'Snapshot / normalization / parser', `${revision.id} · ${revision.normalizationVersion} · ${revision.parserVersion}`);
  field(doc, section, 'Normalized hash', metadata(revision, 'normalizedHash'));
  field(doc, section, 'Raw hash / retention', `${metadata(revision, 'rawHash')} · ${revision.retention}`);
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
  for (const passage of passages) left.append(action(doc,
    `${passage.locator} · [${passage.start}, ${passage.end}) · ${passage.id}`, () => onPassages([passage.id])));
  right.append(element(doc, 'h3', 'Linked claims · exact selected revision'));
  if (activePassages.length) {
    right.append(element(doc, 'p', `Passage selection: ${activePassages.join(', ')}`),
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

export function renderCase(doc, model, record, navigate, exportReferences) {
  const panel = element(doc, 'article', null, 'panel');
  panel.append(element(doc, 'h2', record.name));
  for (const key of ['kind', 'summary', 'limits', 'origin', 'disposition', 'collectionState', 'revision']) {
    field(doc, panel, key, metadata(record, key));
  }
  panel.append(element(doc, 'h3', 'Sources · shared citation is not shared attribution'));
  const references = caseCitations(model, record);
  if (exportReferences) panel.append(action(doc, 'Download all campaign citations (JSON)', () => exportReferences(references)));
  for (const citation of references.citations) {
    const source = model.sources.get(citation.sourceId), reference = element(doc, 'section', null, 'citation');
    reference.append(action(doc, metadata(source, 'title'), () => navigate('sources', citation.sourceId)));
    field(doc, reference, 'Normalized publisher', metadata(source, 'publisher'));
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
  for (const category of model.corpus.categorizations.filter(c => c.caseId === record.id)) {
    const block = element(doc, 'div', null, 'claim-card');
    field(doc, block, category.dimension, `${metadata(category, 'value')} · ${category.origin} · ${category.disposition}`);
    if (category.otherText !== null) field(doc, block, 'Other detail', category.otherText);
    for (const id of category.supportingClaimIds) block.append(action(doc, `Category basis: ${id}`, () => navigate('claims', id)));
    for (const id of category.sourceIds) block.append(action(doc, `Category source: ${id}`, () => navigate('sources', id)));
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
  field(doc, block, item.dateType, `${dateLabel(item.date)} · ${item.description}`);
  if (item.kind === 'source') {
    field(doc, block, 'Basis', 'Source metadata only — not an incident or execution date');
    block.append(action(doc, `Source: ${item.sourceId}`, () => navigate('sources', item.sourceId)));
    return block;
  }
  block.append(action(doc, `Case: ${model.cases.get(item.caseId)?.name ?? item.caseId}`, () => navigate('cases', item.caseId)));
  field(doc, block, 'Basis', item.basis);
  field(doc, block, 'Uncertainty', metadata(item, 'uncertainty'));
  field(doc, block, 'Origin / disposition', `${item.origin} · ${item.disposition}`);
  for (const id of item.supportingClaimIds) block.append(action(doc, `Date basis: ${id}`, () => navigate('claims', id)));
  for (const id of item.sourceRevisionIds) {
    const revision = model.sourceRevisions.get(id);
    if (revision) block.append(action(doc, `Date snapshot: ${id}`, () => navigate('sources', revision.sourceId, id)));
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
    column.append(element(doc, 'h3', record.name),
      action(doc, 'Open case context', () => navigate('cases', record.id)),
      element(doc, 'p', `${record.kind} · ${record.origin} · ${record.disposition} · ${metadata(record, 'limits')}`));
    for (const category of model.corpus.categorizations.filter(c => c.caseId === record.id)) {
      const card = element(doc, 'article', null, 'claim-card');
      card.append(element(doc, 'p', `Recorded category assertion: ${category.dimension} = ${metadata(category, 'value')} · ${category.origin} · ${category.disposition}`));
      if (category.otherText !== null) field(doc, card, 'Other detail', category.otherText);
      for (const id of category.supportingClaimIds) card.append(action(doc, `Category basis: ${id}`, () => navigate('claims', id)));
      for (const id of category.sourceIds) card.append(action(doc, `Category source: ${id}`, () => navigate('sources', id)));
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
    row.append(action(doc, `Shared source: ${metadata(model.sources.get(id), 'title')}`, () => navigate('sources', id)));
    for (const claim of selection.supported.filter(c => c.sourceId === id)) row.append(action(doc,
      `${model.cases.get(claim.caseId).name}: ${claim.id}`, () => navigate('claims', claim.id)));
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
  panel.append(element(doc, 'h3', `Unknown dates · unordered (${timeline.unknown.length} entries)`));
  for (const item of timeline.unknown) panel.append(renderTimelineItem(doc, model, item, navigate));
  if (!timeline.dated.length && !timeline.unknown.length) panel.append(element(doc, 'p', 'No timeline entries match the typed date filter.'));
  return panel;
}
