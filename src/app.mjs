import { VIEWS, FACETS, COMPARISON_DIMENSIONS, COMPARISON_FACETS, DATE_TYPES, createModel, filterRecords, facetOptions, parseRoute, routeHash, claimTarget, metadata, comparisonRecords, comparisonCoverage } from './model.mjs';
import { element, action, renderCase, renderSource, renderClaim, renderConflicts, renderComparison } from './render.mjs';
import { createStudio, renderStudio, selectedPassage, hashText, webIntakeInput, downloadProposal } from './studio.mjs';
import { EXPLORE_VIEWS, VIEW_ANNOTATIONS, renderExploration, renderEvidencePanel, explorationRecords } from './explore.mjs';

export async function fetchCorpus(fetcher, endpoint) {
  const response = await fetcher(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Local corpus request failed (${response.status}).`);
  const corpus = await response.json(), model = createModel(corpus);
  model.snapshot = await hashText(JSON.stringify(corpus));
  model.collectionEnabled = endpoint === '/api/corpus' && response.headers?.get?.('x-collection-enabled') === 'true';
  const stale = response.headers?.get?.('x-stale-reviews');
  model.staleReviewCount = /^\d+$/.test(stale ?? '') ? Number(stale) : 0;
  model.annotations = [];
  model.campaignStatus = {};
  if (model.collectionEnabled) {
    try {
      const annotations = await fetcher('/api/enrichment', { cache: 'no-store' });
      if (!annotations.ok) throw new Error('Unavailable enrichment');
      const document = await annotations.json();
      if (!['talk-enrichment/1', 'campaign-projection/1'].includes(document.schemaVersion) || !Array.isArray(document.annotations)) throw new Error('Invalid enrichment response');
      model.annotations = document.annotations;
    } catch { model.annotationError = 'Private annotations could not be loaded or validated. Core records remain available; check the sidecar and reload.'; }
    if (corpus.governance?.campaignExtraction) {
      const statuses = await Promise.all(corpus.cases.map(async record => {
        try {
          const result = await fetcher(`/api/campaign/status?case=${encodeURIComponent(record.id)}`, { cache: 'no-store' });
          if (!result.ok) throw new Error('Unavailable campaign status');
          return [record.id, await result.json()];
        } catch { return [record.id, null]; }
      }));
      model.campaignStatus = Object.fromEntries(statuses.filter(([, value]) => value));
      if (statuses.some(([, value]) => !value)) model.campaignStatusError = 'Some campaign run status could not be loaded. Reload before relying on displayed coverage.';
    }
  }
  return model;
}

export function mountWorkbench(doc, win, fetcher = win.fetch.bind(win)) {
  const $ = id => doc.getElementById(id);
  let model = null, filters = {}, route = parseRoute(win.location.hash), activePassages = [], request = 0;
  let studio = null;
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
    if (model) buildFacets();
    const hash = routeHash(view, id, revisionId);
    // replaceState avoids a second render, preserving focus on the revealed content.
    win.history.pushState(null, '', hash);
    render();
    $('content').focus();
  }
  function trustLabel() {
    return model?.corpus.governance?.synthetic ?
      'SYNTHETIC DEMO — generated benign fixture, not incident evidence.' :
      `Local corpus · ${model?.collectionEnabled ? 'private collection enabled; intake stays pending' : 'read-only snapshot'} · ` +
      `${model?.staleReviewCount ? `${model.staleReviewCount} stale recorded review${model.staleReviewCount === 1 ? '' : 's'} retained; ` : ''}supplied dispositions are not independent approval.`;
  }
  function buildFacets() {
    $('facets').replaceChildren();
    const comparing = route.view === 'comparison';
    const keys = comparing ? COMPARISON_FACETS : FACETS;
    const allOptions = facetOptions(model, keys);
    const titleFor = key => COMPARISON_DIMENSIONS[key] ??
      ({ evidenceStatus: 'Evidence status', reviewerDisposition: 'Claim reviewer disposition' }[key] ?? key[0].toUpperCase() + key.slice(1));
    for (const key of keys) {
      const options = allOptions[key];
      const details = element(doc, 'details');
      details.append(element(doc, 'summary', `${titleFor(key)} (${filters[key]?.length ?? 0} selected)`));
      if (comparing && key !== 'tags') {
        const label = element(doc, 'label', `${titleFor(key)} matching `), mode = element(doc, 'select');
        for (const value of ['OR', 'AND']) mode.append(element(doc, 'option', value));
        mode.value = filters.modes?.[key] ?? 'OR';
        mode.addEventListener('change', () => {
          filters.modes = { ...filters.modes, [key]: mode.value }; render();
        });
        label.append(mode); details.append(label);
      }
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
          details.firstChild.textContent = `${titleFor(key)} (${selected.size} selected)`;
          render();
        });
        label.append(input, element(doc, 'span', title)); group.append(label);
      }
      details.append(group); $('facets').append(details);
    }
    if (comparing) {
      const dates = element(doc, 'fieldset');
      const dateInputs = [];
      dates.className = 'date-filters';
      dates.append(element(doc, 'legend', 'Typed date overlap (inclusive)'));
      for (const [key, title, options] of [
        ['dateType', 'Date type', ['', ...DATE_TYPES]],
        ['dateUnknown', 'Unknown dates', ['', 'exclude', 'only']],
        ['dateFrom', 'From', null], ['dateTo', 'Through', null],
      ]) {
        const label = element(doc, 'label', `${title} `), input = element(doc, options ? 'select' : 'input');
        if (options) for (const value of options) {
          const option = element(doc, 'option', value || (key === 'dateType' ? 'All types' : 'Include unless bounded'));
          option.value = value; input.append(option);
        }
        else input.type = 'date';
        if (!options) dateInputs.push(input);
        input.value = filters[key] ?? '';
        input.addEventListener('change', () => {
          filters[key] = input.value;
          for (const control of dateInputs) control.setCustomValidity?.(
            filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ?
              'From must not be after Through.' : '');
          render();
        });
        label.append(input); dates.append(label);
      }
      $('facets').append(dates);
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
    $('toolbar').hidden = ['method', 'studio'].includes(route.view);
    if (route.view === 'studio') {
      $('result').textContent = 'Private curator drafts · no canonical writes or approval';
      if (route.id && (studio.sourceId !== route.id || studio.revisionId !== route.revisionId)) {
        studio.sourceId = route.id; studio.revisionId = route.revisionId; studio.selection = null;
      }
      $('content').append(renderStudio(doc, win, studio, { enabled: model.collectionEnabled,
        collect: collectArticles, refresh: render, navigate, campaignStatus: model.campaignStatus,
        campaignStatusError: model.campaignStatusError, prepareCampaign, importCampaign })); return;
    }
    if (route.view === 'method') {
      $('result').textContent = 'Trust & method · collection is not acceptance';
      const panel = element(doc, 'section', null, 'panel');
      panel.append(element(doc, 'h2', 'Evidence before interpretation'));
      for (const text of [
        'Sources form an independent library, including records with no case. Shared sources do not establish shared actors or attribution.',
        'Author/source assertions describe what a source reports. Researcher inferences keep their rationale and supporting claims separate. Origin, evidence status, uncertainty and disposition are independent axes.',
        'LLM content stays labeled by its recorded origin. Pending, Needs correction and Excluded records remain visible; acceptance metadata is not proof of research truth.',
        'Claims navigate to their exact source revision. Old snapshots and conflicting claims remain available. Unicode passages use half-open code-point intervals [start, end); overlapping claims are not merged.',
        'Null values keep their recorded reasons. Publication, discovery, disclosure and incident activity dates retain type and precision; missing content is not invented.',
        'Only same-origin local endpoints and bundled assets are requested by the browser. With --store, explicit Fetch articles sends public HTTPS URLs to the backend, which persists collection and campaign links; new campaigns remain Pending, never accepted. --corpus and no-store modes remain read-only snapshots. The curator studio retains pasted text and pending annotations in memory and downloads private proposals. There is no automatic acceptance, model call or curator review. Local browsing filters never change canonical records. Untrusted original HTML is download-only; extracted text is displayed by default.',
        'Comparison, attack paths and behavior views describe recorded observations and research proposals, not attribution or prevalence. Framework membership does not establish occurrence. Security telemetry and detection hypotheses are distinct from synthetic OpenTelemetry examples. Optional enrichment is displayed with its recorded origin and disposition; human research review and merge approval remain independent.',
      ]) panel.append(element(doc, 'p', text));
      $('content').append(panel); return;
    }
    if (route.view === 'comparison') {
      const selection = comparisonRecords(model, filters), coverage = comparisonCoverage(model, selection);
      const active = Object.entries(filters).filter(([, value]) => Array.isArray(value) ? value.length : typeof value === 'string' && value)
        .map(([key, value]) => {
          const mode = filters.modes?.[key] ?? (key === 'tags' ? filters.tagMode ?? 'OR' : 'OR');
          return `${key}=${Array.isArray(value) ? value.join(` ${mode} `) + ` (${mode})` : value}`;
        });
      $('result').textContent = `${coverage.cases} distinct cases · ${coverage.sources} distinct linked sources (case context) · ${coverage.claims} matching claims · ${coverage.supported} source-supported claims. ` +
        `Review coverage: ${coverage.humanEvents}/${coverage.claims} claims with matching recorded human events; ${Object.entries(coverage.dispositions).map(([d, n]) => `${n} ${d}`).join(', ') || 'no claims'}. ` +
        `Recorded events are not current eligibility or independent approval. Active filters: ${active.join('; ') || 'none'}. Snapshot: ${model.corpus.name} · ${model.corpus.schemaVersion} · loaded JSON SHA-256 ${model.snapshot}`;
      if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
        $('content').append(empty('Invalid date range: From must not be after Through.')); return;
      }
      $('content').append(selection.cases.length ? renderComparison(doc, model, selection, filters, navigate) :
        empty('No cases match the current comparison filters. Unknown dates do not match bounded ranges.'));
      return;
    }
    if (Object.hasOwn(EXPLORE_VIEWS, route.view)) {
      const selection = explorationRecords(model, route.view, filters);
      const annotationCount = (model.annotations ?? []).filter(a => (VIEW_ANNOTATIONS[route.view] ?? []).includes(a.type) && selection.caseIds.has(a.caseId) && (!filters.query || JSON.stringify(a).toLowerCase().includes(filters.query.toLowerCase()))).length;
      $('result').textContent = `${selection.records.length} matching ${EXPLORE_VIEWS[route.view]} records${annotationCount ? ` + ${annotationCount} pending annotations` : ''} · pending research and recorded evidence, not accepted incidents`;
      $('content').append(renderExploration(doc, model, route.view, filters, navigate, route.id, () => load('/api/demo-research'))); return;
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
        element(doc, 'small', route.view === 'sources' && !record.revisionIds.length ?
          'No retained revision / failed or incomplete intake' : record.disposition ?? record.collectionState));
      list.append(button);
    }
    const detail = element(doc, 'div');
    if (route.id && !model[route.view].has(route.id)) detail.append(element(doc, 'p', 'Unknown target; showing a matching record instead.', 'subtle'));
    if (route.view === 'cases') detail.append(renderCase(doc, model, selected, navigate,
      value => downloadProposal(doc, win, value, 'campaign-citations.json')),
      renderEvidencePanel(doc, model, selected, navigate, async (format, value) => {
        let campaign = null;
        if (model.collectionEnabled && model.corpus.governance?.campaignExtraction) {
          const response = await fetcher('/api/campaign/export', { method: 'POST', cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: selected.id, format }) });
          if (!response.ok) throw new Error(`Campaign export failed (${response.status}).`);
          campaign = format === 'json' ? await response.json() : await response.text();
        }
        if (format === 'json') downloadProposal(doc, win,
          campaign == null ? value : { ...value, campaignExtraction: campaign }, 'campaign-talk-bundle.json');
        else {
          const markdown = campaign == null ? value : `${value}\n## Campaign extraction run and catalog provenance\n\n${campaign}`;
          const url = win.URL.createObjectURL(new win.Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
          const link = element(doc, 'a'); link.href = url; link.download = 'campaign-talk-bundle.md'; doc.body.append(link);
          try { link.click(); } finally { link.remove(); }
          win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
        }
      }));
    if (route.view === 'sources') detail.append(renderSource(doc, model, selected, route.revisionId, navigate,
      id => { route = { view: 'sources', id: selected.id, revisionId: id }; activePassages = []; win.history.replaceState(null, '', routeHash('sources', selected.id, id)); render(); $('content').focus(); },
      ids => { activePassages = ids; render(); $('content').focus(); }, activePassages, openDraft));
    if (route.view === 'claims') {
      const target = claimTarget(model, selected.id), panel = element(doc, 'section', null, 'panel');
      panel.append(element(doc, 'h2', 'Claim & exact source evidence'),
        renderClaim(doc, model, selected, navigate),
        renderConflicts(doc, model, [selected.id], navigate));
      detail.append(panel, renderSource(doc, model, model.sources.get(target.sourceId), target.revisionId, navigate,
        id => navigate('sources', target.sourceId, id), ids => { activePassages = ids; render(); $('content').focus(); }, activePassages, openDraft));
    }
    workspace.append(list, detail); $('content').append(workspace);
  }
  function openDraft(revision, root) {
    const selection = root ? selectedPassage(root, win.getSelection(), revision) : null;
    studio.sourceId = revision.sourceId; studio.revisionId = revision.id; studio.selection = selection;
    navigate('studio', revision.sourceId, revision.id);
  }
  function renderStats() {
    $('stats').replaceChildren();
    for (const [label, count] of [['Cases', model.corpus.cases.length], ['Sources', model.corpus.sources.length],
      ['Claims', model.corpus.claims.length], ['Needs correction claims', model.corpus.claims.filter(c => c.disposition === 'Needs correction').length]]) {
      const stat = element(doc, 'div', null, 'stat');
      stat.append(element(doc, 'strong', count), element(doc, 'span', label)); $('stats').append(stat);
    }
  }
  async function collectArticles() {
    const batch = studio.webIntake;
    if (!model.collectionEnabled || batch.waiting) return;
    let input;
    try { input = webIntakeInput(batch); }
    catch (error) { batch.error = error.message; render(); return; }
    batch.waiting = true; batch.error = ''; render();
    $('demo').disabled = true; $('reload-corpus').disabled = true;
    try {
      const response = await fetcher('/api/intake', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      let result;
      try { result = await response.json(); } catch { throw new Error(`Collection request failed (${response.status}); reload before explicit retry.`); }
      if (!response.ok || !Array.isArray(result.results) || (result.status === 'failed' && !result.results.length)) {
        throw new Error(result.message ?? `Collection failed (${result.code ?? response.status}).`);
      }
      batch.results = result.results; batch.resultCaseId = result.caseId ?? '';
      if (result.caseId) { batch.caseId = result.caseId; batch.caseName = ''; }
      try {
        const loaded = await fetchCorpus(fetcher, '/api/corpus');
        model = loaded; studio.base = model.corpus;
        reset(); renderStats();
        status(`${trustLabel()} Collection finished; inspect per-URL outcomes and campaign citations.`);
      } catch {
        batch.error = 'Collection outcomes received, but corpus refresh failed. Successful articles may be persisted; reload before resubmitting.';
      }
    } catch (error) { batch.error = error.message; }
    finally {
      batch.waiting = false; $('demo').disabled = false; $('reload-corpus').disabled = false; render();
    }
  }
  async function campaignRequest(routeName, input) {
    const response = await fetcher(`/api/campaign/${routeName}`, { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    let result;
    try { result = await response.json(); }
    catch { throw new Error(`Campaign ${routeName} failed (${response.status}).`); }
    if (!response.ok || result.status === 'failed') {
      throw new Error(result.message ?? `Campaign ${routeName} failed (${result.code ?? response.status}).`);
    }
    return result;
  }
  async function prepareCampaign(input) {
    return campaignRequest('prepare', input);
  }
  async function importCampaign(input) {
    const result = await campaignRequest('import', input);
    const loaded = await fetchCorpus(fetcher, '/api/corpus');
    model = loaded; studio.base = loaded.corpus;
    reset(); renderStats();
    status(`${trustLabel()} Campaign candidate imported as pending research; inspect coverage and limitations.`);
    return result;
  }
  async function load(endpoint) {
    if (studio?.webIntake.waiting) return;
    if (studio && (studio.drafts.length || studio.intakes.length || studio.cases.length) &&
        !win.confirm('Switching corpus discards private studio drafts. Download first. Discard drafts?')) return;
    const token = ++request;
    $('demo').disabled = true;
    $('reload-corpus').disabled = true;
    status('Loading local corpus…');
    try {
      const loaded = await fetchCorpus(fetcher, endpoint);
      if (token !== request) return;
      model = loaded; studio = createStudio(model.corpus); reset();
      renderStats();
      status(`${trustLabel()} ${model.corpus.name}`, model.corpus.governance?.synthetic ? 'synthetic' : '');
      render();
    } catch (error) {
      if (token === request) status(`${error.message} ${model ? 'Previously loaded corpus remains displayed.' : 'No corpus loaded; the synthetic demo can be tried explicitly.'}`, 'error');
    } finally {
      if (token === request) {
        $('demo').disabled = false;
        $('reload-corpus').disabled = false;
      }
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
  $('reload-corpus').addEventListener('click', () => load('/api/corpus'));
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
  win.addEventListener('beforeunload', event => {
    if (studio && (studio.drafts.length || studio.intakes.length || studio.cases.length || studio.webIntake.waiting ||
        studio.campaign.waiting || studio.campaign.candidate)) {
      event.preventDefault(); event.returnValue = '';
    }
  });
  return { ready: load('/api/corpus'), navigate, load, getModel: () => model };
}

if (typeof document !== 'undefined') mountWorkbench(document, window);
