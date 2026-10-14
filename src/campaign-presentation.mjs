// Read-only display occurrences: canonical records and historical routes never change.
export function pathDisplayName(path) {
  if (path.name?.trim() && path.name !== path.id) return path.name.trim();
  const titles = [...new Set((path.nodes ?? []).map(n => n.title?.trim()).filter(Boolean))];
  return titles.length ? `${titles[0]}${titles.length > 1 ? ` → ${titles.at(-1)}` : ''}` : 'Supported phase — title unavailable';
}

export function campaignGraph(model, caseId, paths = model.corpus.paths ?? []) {
  const members = paths.filter(p => p.caseId === caseId);
  const counts = kind => {
    const result = new Map();
    for (const p of members) for (const r of p[kind]) result.set(r.id, (result.get(r.id) ?? 0) + 1);
    return result;
  };
  const nodeCounts = counts('nodes'), edgeCounts = counts('edges');
  // JSON tuples are injective even when imported IDs contain delimiters.
  const occurrenceId = (kind, p, r, counts) => counts.get(r.id) === 1
    ? r.id : JSON.stringify(['display-occurrence', kind, p.id, r.id]);
  // Avoid collisions between a generated occurrence and an arbitrary canonical ID.
  const reserved = new Set(members.flatMap(p => [...p.nodes, ...p.edges].map(r => r.id)));
  const used = new Set();
  const idFor = (kind, p, r, counts) => {
    let id = occurrenceId(kind, p, r, counts);
    if (counts.get(r.id) !== 1) while (reserved.has(id) || used.has(id)) id = JSON.stringify(['display-occurrence', id]);
    used.add(id); return id;
  };
  const nodes = [], edges = [], groups = [];
  for (const path of members) {
    const nodeIds = new Map();
    const project = (record, id) => ({ ...record, id, canonicalId: record.id,
      memberPath: path, canonicalRecord: record,
      runIds: (model.corpus.governance?.campaignExtraction?.runs ?? [])
        .filter(r => r.caseId === caseId && ((r.recordSupport ?? []).some(s =>
          s.recordId === path.id || s.recordId === record.id))).map(r => r.id ?? r.runId).filter(Boolean),
      sourceOccurrences: (record.claimIds ?? []).map(id => model.claims.get(id)).filter(c => c?.caseId === caseId)
        .map(c => ({ claimId: c.id, sourceId: c.sourceId, sourceRevisionId: c.sourceRevisionId })) });
    for (const node of path.nodes) {
      const id = idFor('node', path, node, nodeCounts); nodeIds.set(node.id, id);
      nodes.push(project(node, id));
    }
    for (const edge of path.edges) edges.push({ ...project(edge, idFor('edge', path, edge, edgeCounts)),
      from: nodeIds.get(edge.from), to: nodeIds.get(edge.to) });
    groups.push({ path, name: pathDisplayName(path), nodeIds: [...nodeIds.values()] });
  }
  return { id: members[0]?.id, caseId, name: model.cases.get(caseId)?.name ?? 'Campaign graph',
    scope: [...new Set(members.map(p => p.scope))].join(' / '), members, groups, nodes, edges };
}

export function campaignSummary(model, record) {
  const valid = id => {
    const claim = model.claims.get(id);
    return claim?.caseId === record.id && model.sources.has(claim.sourceId) && model.sourceRevisions.has(claim.sourceRevisionId);
  };
  const declared = record.summaryClaimIds ?? [];
  if (record.summary?.trim() && declared.length && declared.every(valid)) {
    return { text: record.summary, claimIds: [...new Set(declared)], origin: record.origin ?? 'Origin not recorded',
      disposition: record.disposition ?? 'Pending', projected: false };
  }
  const paths = (model.corpus.paths ?? []).filter(p => p.caseId === record.id);
  const explicit = [...declared, ...paths.flatMap(p => [...p.nodes, ...p.edges].flatMap(r => r.claimIds ?? [])),
    ...(model.corpus.governance?.campaignExtraction?.runs ?? []).filter(r => r.caseId === record.id)
      .flatMap(r => (r.recordSupport ?? []).flatMap(s => s.supportingClaimIds ?? []))];
  const claimIds = [...new Set(explicit)].filter(valid).slice(0, 2);
  return { text: claimIds.length ? claimIds.map(id => {
    const c = model.claims.get(id); return `${evidenceLabel(c.evidenceStatus)}: ${c.description}`;
  }).join(' ') : 'No cited campaign summary recorded. Source-linked summary support is unavailable.',
  claimIds, origin: 'Agent display projection', disposition: 'Pending', projected: true };
}

export function evidenceLabel(status) {
  return ({
    'Source-reported observation': 'Reported', 'Attempted behavior': 'Attempt reported',
    'Demonstrated capability or proof of concept': 'Demonstrated capability',
    'Researcher inference': 'Inference', 'Potential consequence': 'Potential consequence',
    'Unclear or disputed': 'Unclear / disputed',
  })[status] ?? 'Evidence not classified';
}
export function originReview(record) {
  const origin = ({ 'LLM source paraphrase': 'LLM paraphrase', 'LLM synthesis': 'LLM synthesis' })[record.origin]
    ?? record.origin ?? 'Origin not recorded';
  const review = record.disposition ?? 'Pending';
  return `${origin} · ${review === 'Pending' ? 'unreviewed' : review}`;
}
export function activityIcon(node) {
  const text = `${node.title ?? ''} ${node.detail ?? ''}`;
  if (/credential|secret|token|key\b/i.test(text)) return 'credentials';
  if (/package|npm|install|dependency/i.test(text)) return 'package';
  if (/network|exfil|transfer|upload|server|repository data/i.test(text)) return 'network';
  if (/agent|assistant|prompt|model|ai\b/i.test(text)) return 'agent';
  return 'terminal';
}

export const ICON_PATHS = Object.freeze({
  graph: 'M3 3h6v6H3z M15 15h6v6h-6z M9 6h9v9 M6 9v9h9',
  terminal: 'M3 5h18v14H3z M6 8l4 4-4 4 M13 16h5',
  package: 'M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10',
  agent: 'M4 6h16v14H4z M12 2v4 M8 11h1 M15 11h1 M8 16h8',
  credentials: 'M10 9a4 4 0 1 1-8 0 4 4 0 1 1 8 0 M9 12l11 10 M14 17l3-3 M17 20l3-3',
  network: 'M8 5a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M22 5a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M15 19a3 3 0 1 1-6 0 3 3 0 1 1 6 0 M8 5h8 M6 8l5 8 M18 8l-5 8',
});
