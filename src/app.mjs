import { VIEWS, FACETS, createModel, filterRecords, facetOptions, parseRoute, routeHash, claimTarget, metadata } from './model.mjs';
import { element, action, renderCase, renderSource, renderClaim, renderConflicts } from './render.mjs';

export async function fetchCorpus(fetcher, endpoint) {
  const response = await fetcher(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Local corpus request failed (${response.status}).`);
  return createModel(await response.json());
}

export function mountWorkbench(doc, win, fetcher = win.fetch.bind(win)) {
  const $ = id => doc.getElementById(id);
  let model = null, filters = {}, route = parseRoute(win.location.hash), activePassages = [], request = 0;
  const status = (text, kind = '') => {
    $('status').textContent = text; $('status').setAttribute('data-kind', kind);
  };
  function reset() {
    filters = {}; activePassages = [];
    $('search').value = ''; $('tag-mode').value = 'OR';
    if (model) buildFacets();
  }
  function navigate(view, id = '', revisionId = '') {
    reset();
    status('Navigation revealed the target and reset search / facets. ' + trustLabel(),
      model?.corpus.governance?.synthetic ? 'synthetic' : '');
    route = { view, id, revisionId };
    const hash = routeHash(view, id, revisionId);
    // replaceState avoids a second render, preserving focus on the revealed content.
    win.history.pushState(null, '', hash);
    render();
    $('content').focus();
  }
  function trustLabel() {
    return model?.corpus.governance?.synthetic ?
      'SYNTHETIC DEMO — generated benign fixture, not incident evidence.' :
      'Local corpus · read-only · supplied dispositions are not independent approval.';
  }
  function buildFacets() {
    $('facets').replaceChildren();
    const allOptions = facetOptions(model);
    for (const key of FACETS) {
      const options = allOptions[key];
      const details = element(doc, 'details');
      details.append(element(doc, 'summary', `${key[0].toUpperCase() + key.slice(1)} (${filters[key]?.length ?? 0} selected)`));
      const group = element(doc, 'fieldset');
      group.append(element(doc, 'legend', `Filter ${key}`));
      if (!options.length) group.append(element(doc, 'p', 'No recorded values.'));
      for (const value of options) {
        const label = element(doc, 'label'), input = element(doc, 'input');
        input.type = 'checkbox'; input.checked = (filters[key] ?? []).includes(value);
        const title = key === 'cases' ? model.cases.get(value)?.name ?? value :
          key === 'sources' ? metadata(model.sources.get(value), 'title') : value;
        input.addEventListener('change', () => {
          const selected = new Set(filters[key] ?? []);
          input.checked ? selected.add(value) : selected.delete(value);
          filters[key] = [...selected];
          activePassages = [];
          details.firstChild.textContent = `${key[0].toUpperCase() + key.slice(1)} (${selected.size} selected)`;
          render();
        });
        label.append(input, element(doc, 'span', title)); group.append(label);
      }
      details.append(group); $('facets').append(details);
    }
  }
  function empty(text) {
    const node = element(doc, 'section', null, 'empty');
    node.append(element(doc, 'p', text), action(doc, 'Reset search & filters', () => { reset(); render(); }));
    return node;
  }
  function render() {
    if (!model) return;
    for (const button of $('views').children) button.setAttribute('aria-current',
      button.dataset.view === route.view ? 'page' : 'false');
    $('content').replaceChildren();
    $('toolbar').hidden = route.view === 'method';
    if (route.view === 'method') {
      $('result').textContent = 'Trust & method · read-only scope';
      const panel = element(doc, 'section', null, 'panel');
      panel.append(element(doc, 'h2', 'Evidence before interpretation'));
      for (const text of [
        'Sources form an independent library, including records with no case. Shared sources do not establish shared actors or attribution.',
        'Author/source assertions describe what a source reports. Researcher inferences keep their rationale and supporting claims separate. Origin, evidence status, uncertainty and disposition are independent axes.',
        'LLM content stays labeled by its recorded origin. Pending, Needs correction and Excluded records remain visible; acceptance metadata is not proof of research truth.',
        'Claims navigate to their exact source revision. Old snapshots and conflicting claims remain available. Unicode passages use half-open code-point intervals [start, end); overlapping claims are not merged.',
        'Null values keep their recorded reasons. Publication, discovery, disclosure and incident activity dates retain type and precision; missing content is not invented.',
        'This is offline and read-only. Only same-origin local corpus endpoints and bundled assets are requested. There is no live source fetching, file upload, export, correction or curator review. Local browsing filters never change canonical records.',
        'Graph, framework, comparison and detection views are not implemented in this core slice. Their absence does not mean no attack occurred. Human research review and merge approval remain independent.',
      ]) panel.append(element(doc, 'p', text));
      $('content').append(panel); return;
    }
    const records = filterRecords(model, route.view, filters);
    $('result').textContent = `${records.length} matching ${route.view} / ${model.corpus[route.view].length} total · counted as distinct records, not incidents or accepted evidence`;
    if (!records.length) {
      $('content').append(empty(model.corpus[route.view].length ?
        'No records match the current search and facets.' :
        'No records configured in this library. Choose Load synthetic demo for clearly labeled benign examples.'));
      return;
    }
    const selected = records.find(r => r.id === route.id) ?? records[0];
    const workspace = element(doc, 'div', null, 'workspace'), list = element(doc, 'aside', null, 'record-list');
    list.setAttribute('aria-label', `Matching ${route.view}`);
    for (const record of records) {
      const button = action(doc, '', () => {
        route = { view: route.view, id: record.id, revisionId: '' }; activePassages = [];
        win.history.pushState(null, '', routeHash(route.view, route.id)); render(); $('content').focus();
      }, 'record-card');
      button.setAttribute('aria-pressed', String(record.id === selected.id));
      button.append(element(doc, 'small', record.kind ?? (record.inference ? 'Researcher inference' : route.view === 'claims' ? 'Author / source assertion' : 'Source record')),
        element(doc, 'strong', record.name ?? record.title ?? record.description ?? metadata(record, 'title')),
        element(doc, 'small', record.disposition ?? record.collectionState));
      list.append(button);
    }
    const detail = element(doc, 'div');
    if (route.id && !model[route.view].has(route.id)) detail.append(element(doc, 'p', 'Unknown target; showing a matching record instead.', 'subtle'));
    if (route.view === 'cases') detail.append(renderCase(doc, model, selected, navigate));
    if (route.view === 'sources') detail.append(renderSource(doc, model, selected, route.revisionId, navigate,
      id => { route = { view: 'sources', id: selected.id, revisionId: id }; activePassages = []; win.history.replaceState(null, '', routeHash('sources', selected.id, id)); render(); $('content').focus(); },
      ids => { activePassages = ids; render(); $('content').focus(); }, activePassages));
    if (route.view === 'claims') {
      const target = claimTarget(model, selected.id), panel = element(doc, 'section', null, 'panel');
      panel.append(element(doc, 'h2', 'Claim & exact source evidence'),
        renderClaim(doc, model, selected, navigate),
        renderConflicts(doc, model, [selected.id], navigate));
      detail.append(panel, renderSource(doc, model, model.sources.get(target.sourceId), target.revisionId, navigate,
        id => navigate('sources', target.sourceId, id), ids => { activePassages = ids; render(); $('content').focus(); }, activePassages));
    }
    workspace.append(list, detail); $('content').append(workspace);
  }
  async function load(endpoint) {
    const token = ++request;
    $('demo').disabled = true;
    status('Loading local corpus…');
    try {
      const loaded = await fetchCorpus(fetcher, endpoint);
      if (token !== request) return;
      model = loaded; reset();
      $('stats').replaceChildren();
      for (const [label, count] of [['Cases', model.corpus.cases.length], ['Sources', model.corpus.sources.length],
        ['Claims', model.corpus.claims.length], ['Needs correction claims', model.corpus.claims.filter(c => c.disposition === 'Needs correction').length]]) {
        const stat = element(doc, 'div', null, 'stat');
        stat.append(element(doc, 'strong', count), element(doc, 'span', label)); $('stats').append(stat);
      }
      status(`${trustLabel()} ${model.corpus.name}`, model.corpus.governance?.synthetic ? 'synthetic' : '');
      render();
    } catch (error) {
      if (token === request) status(`${error.message} ${model ? 'Previously loaded corpus remains displayed.' : 'No corpus loaded; the synthetic demo can be tried explicitly.'}`, 'error');
    } finally {
      if (token === request) $('demo').disabled = false;
    }
  }
  for (const [view, label] of Object.entries(VIEWS)) {
    const button = action(doc, label, () => navigate(view), '');
    button.dataset.view = view; $('views').append(button);
  }
  $('toolbar').addEventListener('submit', e => e.preventDefault());
  $('search').addEventListener('input', () => { filters.query = $('search').value; activePassages = []; render(); });
  $('tag-mode').addEventListener('change', () => { filters.tagMode = $('tag-mode').value; activePassages = []; render(); });
  $('reset').addEventListener('click', () => { reset(); render(); });
  $('demo').addEventListener('click', () => load('/api/demo'));
  $('skip-content')?.addEventListener('click', event => {
    event.preventDefault(); $('content').focus();
  });
  function restoreRoute() {
    route = parseRoute(win.location.hash); reset();
    if (model) {
      status('Route navigation reset search / facets. ' + trustLabel(), model.corpus.governance?.synthetic ? 'synthetic' : '');
      render();
    }
  }
  win.addEventListener('hashchange', restoreRoute);
  win.addEventListener('popstate', restoreRoute);
  return { ready: load('/api/corpus'), navigate, load, getModel: () => model };
}

if (typeof document !== 'undefined') mountWorkbench(document, window);
