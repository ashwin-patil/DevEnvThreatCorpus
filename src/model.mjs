export const VIEWS = { cases: 'Case library', sources: 'Research library', claims: 'Claims & evidence', method: 'Trust & method' };
export const FACETS = ['cases', 'sources', 'publishers', 'tags', 'disposition'];

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
    cases: caseIds, sources: sourceIds,
    publishers: sources.map(s => s.publisher ?? '(Unknown publisher)'),
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

export function facetOptions(model) {
  return Object.fromEntries(FACETS.map(key => [key,
    [...new Set(['cases', 'sources', 'claims'].flatMap(kind =>
      model.corpus[kind].flatMap(r => recordContext(model, kind, r)[key])))].sort(),
  ]));
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
