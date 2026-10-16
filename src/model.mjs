export const VIEWS = { cases: 'Case library', sources: 'Research library', review: 'Review', claims: 'Claims & evidence', comparison: 'Comparison & timelines', studio: 'Curator studio', paths: 'Attack paths', behaviors: 'Behaviors', tools: 'AI tools', prompts: 'Prompt library', frameworks: 'ATLAS & TTPs', telemetry: 'Security telemetry', otel: 'OpenTelemetry', method: 'Trust & method' };
import { publisherDisplay } from './research-inventory.mjs';
export const FACETS = ['cases', 'sources', 'publishers', 'tags', 'disposition'];
export const COMPARISON_DIMENSIONS = {
  trust_surface: 'Trust surface', ai_involvement: 'AI involvement', execution_location: 'Execution location',
  tool: 'Tool', platform: 'Platform', delivery: 'Delivery', objective: 'Objective',
};
export const COMPARISON_FACETS = ['cases', 'sources', 'publishers', 'tags', ...Object.keys(COMPARISON_DIMENSIONS), 'evidenceStatus', 'reviewerDisposition'];
export const DATE_TYPES = ['publication', 'source_update', 'first_reported_activity', 'incident_execution', 'discovery', 'disclosure'];

export function createModel(corpus) {
  if (corpus?.schemaVersion !== '0.3.0' ||
      !['sources', 'sourceRevisions', 'passages', 'cases', 'claims', 'categorizations', 'timelines', 'reviews', 'collectionManifests'].every(k => Array.isArray(corpus[k]))) {
    throw new Error('Expected a server-validated 0.3.0 corpus.');
  }
  const model = { corpus };
  for (const key of ['sources', 'sourceRevisions', 'passages', 'cases', 'claims']) {
    model[key] = new Map(corpus[key].map(record => [record.id, record]));
  }
  return model;
}

export function applyReviewProjection(model) {
  if (!model.itemReview || model.publicDraft) return model;
  const originalCorpus = model.originalCorpus ?? model.corpus, corpus = structuredClone(originalCorpus);
  const annotations = new Map((model.annotations ?? []).map(a => [a.id, structuredClone(a)]));
  for (const u of [...model.itemReview.units].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))) {
    let record;
    if (u.type === 'annotations') { record = structuredClone(u.record); annotations.set(u.id, record); }
    else if (u.parent) {
      const parent = corpus[u.parent.type]?.find(r => r.id === u.parent.id);
      record = u.type === 'occurrences' ? parent?.occurrences?.[u.index] :
        parent?.[u.type]?.find(r => r.id === u.original.id);
    } else record = corpus[u.type]?.find(r => r.id === u.id);
    if (!record) continue;
    Object.assign(record, structuredClone(u.record));
    if (Object.hasOwn(record, 'disposition')) record.disposition = u.state === 'Accepted' ? 'Accepted' :
      u.state === 'Excluded' ? 'Excluded' : 'Pending';
    record.itemReview = { itemKey: u.itemKey, state: u.state, editor: u.editor ?? null,
      contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship,
      displayIdentity: u.editor && u.record.normalizedValue !== u.original.normalizedValue
        ? u.record.normalizedValue : null };
  }
  return { ...model, ...createModel(corpus), originalCorpus, annotations: [...annotations.values()] };
}

export function metadata(record, key) {
  return record?.[key] ?? `Not available (${record?.nullReasons?.[key] ?? 'unknown'})`;
}

export function dateLabel(date) {
  if (!date || date.precision === 'unknown') return `Unknown (${date?.nullReasons?.value ?? 'unknown'})`;
  return `${date.precision === 'range' ? `${date.start} – ${date.end}` : date.value} · ${date.precision} precision`;
}

export function caseSourceIds(model, caseId) {
  return [...new Set([
    ...(model.cases.get(caseId)?.sourceIds ?? []),
    ...model.corpus.claims.filter(c => c.caseId === caseId).map(c => c.sourceId),
    ...model.corpus.categorizations.filter(c => c.caseId === caseId).flatMap(c => c.sourceIds),
  ])];
}

export function linkedClaims(model, sourceId, revisionId) {
  return model.corpus.claims.filter(c => c.sourceId === sourceId && (!revisionId || c.sourceRevisionId === revisionId));
}

export function claimTarget(model, claimId) {
  const claim = model.claims.get(claimId);
  if (!claim) return null;
  return { view: 'claims', id: claim.id, sourceId: claim.sourceId, revisionId: claim.sourceRevisionId };
}

export function passageSegments(text, passages) {
  if (text === null || text === undefined) return [];
  const points = Array.from(text);
  const valid = passages.filter(p => Number.isInteger(p.start) && Number.isInteger(p.end) &&
    p.start >= 0 && p.end > p.start && p.end <= points.length);
  const boundaries = [...new Set([0, points.length, ...valid.flatMap(p => [p.start, p.end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => ({
    start, end: boundaries[i + 1], text: points.slice(start, boundaries[i + 1]).join(''),
    passageIds: valid.filter(p => p.start <= start && p.end >= boundaries[i + 1]).map(p => p.id),
  }));
}

export function conflictPairs(model, claimIds = model.corpus.claims.map(c => c.id)) {
  const included = new Set(claimIds), seen = new Set(), pairs = [];
  for (const claim of model.corpus.claims) for (const target of claim.conflictsWith) {
    const other = model.claims.get(target);
    const key = JSON.stringify([claim.id, target].sort());
    if (other && (included.has(claim.id) || included.has(target)) && !seen.has(key)) {
      seen.add(key); pairs.push([claim, other]);
    }
  }
  return pairs;
}

export function recordContext(model, kind, record) {
  const caseIds = kind === 'cases' ? [record.id] : kind === 'claims' ? [record.caseId] :
    model.corpus.cases.filter(c => caseSourceIds(model, c.id).includes(record.id)).map(c => c.id);
  const sourceIds = kind === 'sources' ? [record.id] : kind === 'claims' ? [record.sourceId] : caseSourceIds(model, record.id);
  const claims = kind === 'claims' ? [record] : model.corpus.claims.filter(c =>
    kind === 'cases' ? c.caseId === record.id : c.sourceId === record.id);
  const categories = model.corpus.categorizations.filter(c => caseIds.includes(c.caseId));
  const sources = sourceIds.map(id => model.sources.get(id)).filter(Boolean);
  return {
    ...Object.fromEntries(Object.keys(COMPARISON_DIMENSIONS).map(key =>
      [key, categories.filter(c => c.dimension === key).map(c => c.value ?? '(Unknown)')])),
    evidenceStatus: [...new Set(claims.map(c => c.evidenceStatus))],
    reviewerDisposition: kind === 'claims' ? [record.disposition] : [...new Set(claims.map(c => c.disposition))],
    cases: caseIds, sources: sourceIds,
    publishers: sources.map(s => { const display = publisherDisplay(s); return ['URL host; publisher unverified', 'unavailable'].includes(display.basis) ? '(Unknown publisher)' : display.name; }),
    tags: categories.filter(c => c.dimension === 'tag').map(c => c.value ?? '(Unknown tag)'),
    disposition: [...new Set([record.disposition, record.collectionState, ...claims.map(c => c.disposition),
      ...categories.map(c => c.disposition)].filter(Boolean))],
    search: [record, ...claims, ...sources, ...categories,
      ...caseIds.map(id => model.cases.get(id)),
      ...model.corpus.sourceRevisions.filter(r => sourceIds.includes(r.sourceId))]
      .map(r => JSON.stringify(r)).join(' ').toLocaleLowerCase(),
  };
}

export function filterRecords(model, kind, filters = {}) {
  const query = (filters.query ?? '').trim().toLocaleLowerCase();
  return model.corpus[kind].filter(record => {
    const context = recordContext(model, kind, record);
    return (!query || context.search.includes(query)) && FACETS.every(key => {
      const selected = filters[key] ?? [];
      if (!selected.length) return true;
      return key === 'tags' && filters.tagMode === 'AND' ?
        selected.every(value => context[key].includes(value)) :
        selected.some(value => context[key].includes(value));
    });
  });
}

export function facetOptions(model, keys = FACETS) {
  return Object.fromEntries(keys.map(key => [key,
    [...new Set(['cases', 'sources', 'claims'].flatMap(kind =>
      model.corpus[kind].flatMap(r => recordContext(model, kind, r)[key])))].sort(),
  ]));
}

// Bounds are used only for inclusive overlap, never as invented display dates.
export function dateBounds(date) {
  if (!date || date.precision === 'unknown') return null;
  const bound = (value, end) => {
    if (value.length === 4) return `${value}-${end ? '12-31' : '01-01'}`;
    if (value.length === 7) {
      const [year, month] = value.split('-').map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
      return `${value}-${end ? String(days).padStart(2, '0') : '01'}`;
    }
    return value;
  };
  return date.precision === 'range' ? [bound(date.start, false), bound(date.end, true)] :
    [bound(date.value, false), bound(date.value, true)];
}

export function matchesDate(item, filters = {}) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return false;
  if (filters.dateType && item.dateType !== filters.dateType) return false;
  const bounds = dateBounds(item.date);
  if (filters.dateUnknown === 'only') return !bounds;
  if (!bounds) return filters.dateUnknown !== 'exclude' && !filters.dateFrom && !filters.dateTo;
  return (!filters.dateFrom || bounds[1] >= filters.dateFrom) &&
    (!filters.dateTo || bounds[0] <= filters.dateTo);
}

function recordDates(model, kind, record) {
  const sourceIds = kind === 'claims' ? [record.sourceId] : caseSourceIds(model, record.id);
  return [
    ...sourceIds.flatMap(id => {
      const source = model.sources.get(id);
      return source ? [{ dateType: 'publication', date: source.publicationDate },
        { dateType: 'source_update', date: source.updateDate }] : [];
    }),
    ...model.corpus.timelines.filter(t => kind === 'claims' ?
      t.supportingClaimIds.includes(record.id) : t.caseId === record.id),
  ];
}

export function comparisonRecords(model, filters = {}) {
  const matches = (kind, record, keys) => {
    const context = recordContext(model, kind, record);
    return (!(filters.query ?? '').trim() || context.search.includes(filters.query.trim().toLocaleLowerCase())) &&
      keys.every(key => {
        const selected = filters[key] ?? [];
        const mode = filters.modes?.[key] ?? (key === 'tags' ? filters.tagMode : 'OR');
        return !selected.length || (mode === 'AND' ?
          selected.every(v => context[key].includes(v)) : selected.some(v => context[key].includes(v)));
      }) && (!(filters.dateType || filters.dateFrom || filters.dateTo || filters.dateUnknown) ||
        recordDates(model, kind, record).some(item => matchesDate(item, filters)));
  };
  const claims = model.corpus.claims.filter(c => matches('claims', c, COMPARISON_FACETS));
  const claimFilters = filters.evidenceStatus?.length || filters.reviewerDisposition?.length;
  const cases = model.corpus.cases.filter(c =>
    matches('cases', c, COMPARISON_FACETS.filter(k => !['evidenceStatus', 'reviewerDisposition'].includes(k))) &&
    (!claimFilters || claims.some(claim => claim.caseId === c.id)));
  const selectedIds = new Set(cases.map(c => c.id));
  const selectedClaims = claims.filter(c => selectedIds.has(c.caseId));
  const supported = selectedClaims.filter(c => !c.inference && c.evidenceStatus !== 'Researcher inference' &&
    c.passageIds.some(id => {
      const passage = model.passages.get(id);
      return passage?.sourceRevisionId === c.sourceRevisionId && passage.text !== null;
    }));
  return { cases, claims: selectedClaims, supported,
    unresolved: selectedClaims.filter(c => !supported.includes(c)),
    sourceIds: [...new Set(cases.flatMap(c => caseSourceIds(model, c.id)))] };
}

export function comparisonTimeline(model, selection, filters = {}) {
  const ids = new Set(selection.cases.map(c => c.id));
  const entries = [
    ...model.corpus.timelines.filter(t => ids.has(t.caseId)).map(t => ({ ...t, kind: 'event' })),
    ...selection.sourceIds.flatMap(id => {
      const source = model.sources.get(id);
      return ['publication', 'source_update'].map(dateType => ({
        id: `${id}:${dateType}`, sourceId: id, kind: 'source', dateType,
        date: source[dateType === 'publication' ? 'publicationDate' : 'updateDate'],
        description: metadata(source, 'title'),
      }));
    }),
  ].filter(item => matchesDate(item, filters));
  return {
    dated: entries.filter(item => dateBounds(item.date)).sort((a, b) =>
      dateBounds(a.date)[0].localeCompare(dateBounds(b.date)[0]) || a.id.localeCompare(b.id)),
    unknown: entries.filter(item => !dateBounds(item.date)),
  };
}

export function comparisonCoverage(model, selection) {
  const humanEvents = selection.claims.filter(claim => {
    const event = model.corpus.reviews.find(r => r.id === claim.history.at(-1));
    return event?.reviewerKind === 'human' && event.entityType === 'claims' &&
      event.entityId === claim.id && event.revision === claim.revision && event.disposition === claim.disposition;
  }).length;
  return { cases: selection.cases.length, sources: selection.sourceIds.length, claims: selection.claims.length,
    supported: selection.supported.length, humanEvents,
    dispositions: Object.fromEntries([...new Set(selection.claims.map(c => c.disposition))]
      .map(d => [d, selection.claims.filter(c => c.disposition === d).length])) };
}

export function parseRoute(hash) {
  try {
    const [view, id = '', revisionId = ''] = hash.replace(/^#/, '').split('/').map(decodeURIComponent);
    return { view: Object.hasOwn(VIEWS, view) ? view : 'cases', id, revisionId };
  } catch {
    return { view: 'cases', id: '', revisionId: '' };
  }
}

export function routeHash(view, id = '', revisionId = '') {
  return '#' + [view, id, revisionId].map(encodeURIComponent).join('/');
}
