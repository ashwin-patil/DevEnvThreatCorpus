import { element } from './render.mjs';

export function renderStageComparison(doc, comparison) {
  const section = element(doc, 'section', null, 'stage-comparison');
  section.append(element(doc, 'h4', 'Private old/new extraction comparison'),
    element(doc, 'p', 'Correspondence suggestions only. Old Pending output is not gold. Every material difference needs independent source-backed adjudication; this view cannot adopt or accept items.'));
  if (comparison?.schemaVersion !== 'campaign-stage-comparison/1' || !Array.isArray(comparison.groups)) {
    section.append(element(doc, 'p', 'No valid comparison loaded.')); return section;
  }
  section.append(element(doc, 'p', `Comparison: ${comparison.comparisonHash} · ${comparison.groups.filter(g => g.major).length} unresolved-by-default major groups`));
  const config = element(doc, 'details');
  config.append(element(doc, 'summary', 'Source coverage and model/prompt/chunk/catalog configuration'),
    element(doc, 'pre', JSON.stringify({ before: comparison.beforeConfiguration, after: comparison.afterConfiguration }, null, 2)));
  section.append(config);
  for (const group of comparison.groups) {
    const detail = element(doc, 'details');
    detail.append(element(doc, 'summary', `${group.type} · ${group.kind} · ${group.major ? 'human adjudication required' : 'candidate match, inspect meaning/evidence'}`));
    const table = element(doc, 'table'), head = element(doc, 'tr');
    head.append(element(doc, 'th', 'Preserved baseline'), element(doc, 'th', 'Separate candidate'));
    const row = element(doc, 'tr');
    for (const values of [group.before, group.after]) {
      const cell = element(doc, 'td');
      cell.append(element(doc, 'pre', JSON.stringify(values, null, 2))); row.append(cell);
    }
    table.append(head, row); detail.append(element(doc, 'p', group.id), table); section.append(detail);
  }
  return section;
}
