import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createModel, metadata, dateLabel, caseSourceIds, linkedClaims, claimTarget,
  passageSegments, conflictPairs, recordContext, filterRecords, facetOptions, parseRoute, routeHash,
} from '../src/model.mjs';
import { element, renderClaim, renderConflicts, renderSourceText, renderSource, renderCase } from '../src/render.mjs';
import { fetchCorpus, mountWorkbench } from '../src/app.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(fixture);
const model = () => createModel(fresh());

// Deliberately small test-only DOM: no browser dependencies and no HTML parser.
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {};
    this.dataset = {}; this.listeners = {}; this.value = ''; this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(_) { throw new Error('Unsafe HTML rendering is forbidden'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  async trigger(name) {
    for (const fn of this.listeners[name] ?? []) await fn({ target: this, preventDefault() {} });
  }
  focus() { this.focused = true; }
  get firstChild() { return this.children[0]; }
}
class FakeDocument {
  constructor() {
    this.nodes = new Map(['status', 'stats', 'views', 'toolbar', 'search', 'tag-mode', 'reset', 'facets', 'result', 'content', 'demo', 'skip-content']
      .map(id => [id, new FakeElement(id === 'search' ? 'input' : 'div')]));
  }
  createElement(tag) { return new FakeElement(tag); }
  getElementById(id) { return this.nodes.get(id); }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function button(node, label) { return descendants(node).find(n => n.tagName === 'BUTTON' && n.textContent.includes(label)); }
function fakeWindow(hash = '') {
  const win = { location: { hash }, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
  win.history = {
    pushState(_state, _title, value) { win.location.hash = value; },
    replaceState(_state, _title, value) { win.location.hash = value; },
  };
  return win;
}
function response(corpus = fresh(), status = 200) {
  return { ok: status === 200, status, async json() { return corpus; } };
}
async function mounted(corpus = fresh(), hash = '') {
  const doc = new FakeDocument(), win = fakeWindow(hash), requests = [];
  const app = mountWorkbench(doc, win, async (path, options) => { requests.push([path, options]); return response(structuredClone(corpus)); });
  await app.ready;
  return { doc, win, app, requests, content: doc.getElementById('content') };
}

test('model accepts the 0.3.0 core-only contract without enrichment', () => {
  const m = model(); assert.equal(m.cases.size, 2); assert.equal(m.sources.size, 2);
  assert.equal(m.corpus.paths, undefined);
});
test('model rejects legacy data and missing core arrays', () => {
  assert.throws(() => createModel({ ...fresh(), schemaVersion: '0.2.0' }), /0.3.0/);
  const corpus = fresh(); delete corpus.claims;
  assert.throws(() => createModel(corpus), /0.3.0/);
});
test('missing metadata preserves null reasons rather than manufacturing values', () => {
  assert.equal(metadata(fixture.sources[0], 'publisher'), 'Not available (unknown)');
  assert.equal(metadata(fixture.sources[0], 'author'), 'Not available (not_reported)');
  assert.equal(metadata(fixture.claims[2], 'uncertainty'), 'Not available (unknown)');
});
test('date labels preserve day/month/year/range/unknown precision and types', () => {
  assert.match(dateLabel(fixture.sources[0].publicationDate), /2024-02-29 · day precision/);
  assert.match(dateLabel(fixture.timelines[2].date), /2025-06 · month/);
  assert.match(dateLabel(fixture.timelines[3].date), /2025 · year/);
  assert.match(dateLabel(fixture.timelines[4].date), /2025-06 – 2025-08 · range/);
  assert.equal(dateLabel(fixture.timelines[1].date), 'Unknown (not_reported)');
});
test('case association includes all claims and keeps shared source cases separate', () => {
  const m = model();
  assert.deepEqual(caseSourceIds(m, 'synthetic-case-a'), ['synthetic-source-a', 'synthetic-source-b']);
  assert.deepEqual(caseSourceIds(m, 'synthetic-case-b'), ['synthetic-source-a']);
  assert.deepEqual(recordContext(m, 'sources', m.sources.get('synthetic-source-a')).cases,
    ['synthetic-case-a', 'synthetic-case-b']);
  assert.equal(filterRecords(m, 'cases').length, 2);
});
test('case source association includes categorization source basis', () => {
  const corpus = fresh();
  corpus.cases[1].sourceIds = [];
  corpus.categorizations[3].sourceIds = ['synthetic-source-b'];
  assert.deepEqual(caseSourceIds(createModel(corpus), 'synthetic-case-b'), ['synthetic-source-a', 'synthetic-source-b']);
});
test('exact claim target retains an older source revision', () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'new-revision', normalizedContent: 'New text' });
  corpus.sources[0].revisionIds.push('new-revision');
  const m = createModel(corpus);
  assert.equal(claimTarget(m, 'synthetic-claim-a').revisionId, 'synthetic-revision-a');
  assert.equal(linkedClaims(m, 'synthetic-source-a', 'new-revision').length, 0);
  assert.equal(linkedClaims(m, 'synthetic-source-a', 'synthetic-revision-a').length, 3);
  assert.equal(claimTarget(m, 'missing'), null);
});
test('inference support is not conflated with own quoted passages', () => {
  const m = model(), inference = m.claims.get('synthetic-claim-inference');
  assert.deepEqual(inference.passageIds, []);
  assert.deepEqual(inference.inference.supportingClaimIds, ['synthetic-claim-a', 'synthetic-claim-b']);
  assert.equal(claimTarget(m, inference.inference.supportingClaimIds[1]).sourceId, 'synthetic-source-b');
});
test('Unicode half-open code point segments preserve emoji and combining marks', () => {
  const text = '😀 e\u0301 🧑‍💻!';
  const segments = passageSegments(text, [
    { id: 'accent', start: 2, end: 4 }, { id: 'emoji', start: 5, end: 8 },
  ]);
  assert.equal(segments.map(s => s.text).join(''), text);
  assert.equal(segments.find(s => s.passageIds.includes('accent')).text, 'e\u0301');
  assert.equal(segments.find(s => s.passageIds.includes('emoji')).text, '🧑‍💻');
});
test('overlapping, duplicate and nested passages retain every membership', () => {
  const segments = passageSegments('😀abcde', [
    { id: 'outer', start: 0, end: 5 }, { id: 'middle', start: 2, end: 4 },
    { id: 'duplicate', start: 2, end: 4 }, { id: 'overlap', start: 3, end: 6 },
  ]);
  assert.deepEqual(segments.find(s => s.text === 'c').passageIds, ['outer', 'middle', 'duplicate', 'overlap']);
  assert.deepEqual(segments.at(-1).passageIds, ['overlap']);
  assert.equal(segments.map(s => s.text).join(''), '😀abcde');
});
test('invalid intervals never truncate source text or become highlights', () => {
  const segments = passageSegments('😀ab', [
    { id: 'bad', start: -1, end: 2 }, { id: 'long', start: 1, end: 9 },
    { id: 'zero', start: 1, end: 1 }, { id: 'fraction', start: 1.5, end: 2 },
  ]);
  assert.deepEqual(segments, [{ start: 0, end: 3, text: '😀ab', passageIds: [] }]);
  assert.deepEqual(passageSegments(null, []), []);
});
test('reciprocal conflicts render once and remain visible from either selected side', () => {
  const m = model();
  assert.equal(conflictPairs(m).length, 1);
  assert.equal(conflictPairs(m, ['synthetic-claim-b']).length, 1);
  assert.equal(conflictPairs(m, ['synthetic-claim-c']).length, 0);
});
test('multiple contradiction targets are preserved rather than merged', () => {
  const corpus = fresh();
  corpus.claims[0].conflictsWith.push('synthetic-claim-c');
  corpus.claims[2].conflictsWith.push('synthetic-claim-a');
  assert.equal(conflictPairs(createModel(corpus)).length, 2);
});
test('search finds sources without any case association, including normalized text', () => {
  const corpus = fresh();
  corpus.sources.push({ ...corpus.sources[0], id: 'orphan', title: 'Standalone archival note', revisionIds: ['orphan-rev'] });
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'orphan-rev', sourceId: 'orphan', normalizedContent: 'unique archival word' });
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'sources', { query: 'archival word' })[0].id, 'orphan');
  assert.deepEqual(recordContext(m, 'sources', m.sources.get('orphan')).cases, []);
  assert.equal(filterRecords(m, 'sources').length, 3);
});
test('source and publisher facets have OR semantics within, AND across facets', () => {
  const m = model();
  assert.equal(filterRecords(m, 'sources', { publishers: ['(Unknown publisher)', 'Synthetic publisher'] }).length, 2);
  assert.equal(filterRecords(m, 'sources', { publishers: ['Synthetic publisher'], cases: ['synthetic-case-b'] }).length, 0);
  assert.equal(filterRecords(m, 'sources', { sources: ['synthetic-source-a'], cases: ['synthetic-case-b'] }).length, 1);
});
test('tags support explicit OR / AND semantics, distinct case counts and independent source association', () => {
  const corpus = fresh();
  corpus.categorizations.push(
    { ...corpus.categorizations[0], id: 'tag-a', dimension: 'tag', value: 'one' },
    { ...corpus.categorizations[0], id: 'tag-b', dimension: 'tag', value: 'two' },
    { ...corpus.categorizations[3], id: 'tag-c', dimension: 'tag', value: 'one' });
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'cases', { tags: ['one', 'two'], tagMode: 'OR' }).length, 2);
  assert.equal(filterRecords(m, 'cases', { tags: ['one', 'two'], tagMode: 'AND' }).length, 1);
  assert.equal(filterRecords(m, 'sources', { tags: ['two'] }).length, 2);
  assert.deepEqual(facetOptions(m).tags, ['one', 'two']);
});
test('Needs correction, Pending and Excluded remain searchable and filterable', () => {
  const corpus = fresh();
  corpus.claims[0].disposition = 'Needs correction'; corpus.claims[1].disposition = 'Excluded';
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'claims', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'cases', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'sources', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'claims', { disposition: ['Excluded'] }).length, 1);
  assert.equal(filterRecords(m, 'claims').length, 4);
});
test('empty filters reset to the complete collection, query AND facets', () => {
  const m = model();
  assert.equal(filterRecords(m, 'cases', { query: 'does not exist' }).length, 0);
  assert.equal(filterRecords(m, 'sources', { query: 'Café', publishers: ['Synthetic publisher'] }).length, 0);
  assert.equal(filterRecords(m, 'cases', {}).length, 2);
});
test('hash routes encode IDs and recover malformed percent sequences / unknown views', () => {
  assert.deepEqual(parseRoute(routeHash('sources', 'source / 雪', 'r#😀')),
    { view: 'sources', id: 'source / 雪', revisionId: 'r#😀' });
  assert.deepEqual(parseRoute('#claims/%ZZ'), { view: 'cases', id: '', revisionId: '' });
  assert.equal(parseRoute('#missing').view, 'cases');
});
test('rendered corpus strings are inert text including HTML, scripts and javascript URLs', () => {
  const corpus = fresh(), attack = '<img src=x onerror=alert(1)><script>bad()</script>&"';
  corpus.sources[0].title = attack; corpus.sources[0].canonicalUrl = 'javascript:alert(1)';
  corpus.sourceRevisions[0].normalizedContent = attack; corpus.claims[0].description = attack;
  corpus.claims[0].uncertainty = attack; corpus.cases[0].summary = attack;
  const doc = new FakeDocument(), m = createModel(corpus);
  const nodes = [
    renderSource(doc, m, corpus.sources[0], '', () => {}, () => {}, () => {}),
    renderClaim(doc, m, corpus.claims[0], () => {}),
    renderCase(doc, m, corpus.cases[0], () => {}),
  ];
  for (const root of nodes) {
    assert.ok(root.textContent.includes(attack));
    assert.ok(!descendants(root).some(n => ['IMG', 'SCRIPT', 'IFRAME'].includes(n.tagName)));
    assert.ok(!descendants(root).some(n => n.attributes.href?.startsWith('javascript:')));
  }
});
test('source text DOM reconstructs exact text and overlapping highlight click exposes all passage IDs', async () => {
  const doc = new FakeDocument(), text = '😀 e\u0301 abc', selected = [];
  const node = renderSourceText(doc, { normalizedContent: text }, [
    { id: 'a', start: 2, end: 7 }, { id: 'b', start: 5, end: 8 },
  ], ids => selected.push(ids));
  assert.equal(node.textContent, text);
  const overlap = descendants(node).find(n => n.tagName === 'BUTTON' && n.attributes['aria-label'].includes('a, b'));
  await overlap.trigger('click');
  assert.deepEqual(selected, [['a', 'b']]);
});
test('null source text gives honest retention reason, no synthesized quote', () => {
  const doc = new FakeDocument();
  const node = renderSourceText(doc, { normalizedContent: null, nullReasons: { normalizedContent: 'not_reported' } },
    [{ id: 'p', start: 0, end: 4, text: 'fake' }], () => {});
  assert.match(node.textContent, /not retained \(not_reported\)/);
  assert.ok(!node.textContent.includes('fake'));
});
test('claim DOM explicitly labels assertions and inferences, rationale and all independent axes', async () => {
  const doc = new FakeDocument(), m = model(), calls = [];
  const inference = renderClaim(doc, m, m.claims.get('synthetic-claim-inference'), (...args) => calls.push(args));
  const assertion = renderClaim(doc, m, m.claims.get('synthetic-claim-a'), () => {});
  assert.match(inference.textContent, /Researcher inference — not a source assertion/);
  assert.match(inference.textContent, /Inference rationale/);
  assert.match(inference.textContent, /Inference support — separate claims/);
  for (const label of ['Origin', 'Evidence status', 'Disposition', 'Uncertainty', 'exact revision']) assert.ok(inference.textContent.includes(label));
  assert.match(assertion.textContent, /Author \/ source assertion/);
  await button(inference, 'Supporting claim: A second').trigger('click');
  assert.deepEqual(calls[0], ['claims', 'synthetic-claim-b']);
});
test('conflict DOM shows side-by-side reciprocal targets and navigation for both', async () => {
  const doc = new FakeDocument(), m = model(), calls = [];
  const root = renderConflicts(doc, m, ['synthetic-claim-a'], (...args) => calls.push(args));
  const pair = root.children.find(c => c.className === 'conflict-pair');
  assert.equal(pair.children.length, 2);
  assert.match(root.textContent, /Neither side is chosen or merged/);
  for (const card of pair.children) await descendants(card).find(n => n.className === 'claim-title').trigger('click');
  assert.deepEqual(calls.map(c => c[1]), ['synthetic-claim-a', 'synthetic-claim-b']);
});
test('source revision selector retains old snapshots and switches explicit revision only', async () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'new-revision', normalizedContent: 'New text' });
  corpus.sources[0].revisionIds.push('new-revision');
  const doc = new FakeDocument(), calls = [], m = createModel(corpus);
  const root = renderSource(doc, m, corpus.sources[0], 'synthetic-revision-a', () => {}, id => calls.push(id), () => {});
  const select = descendants(root).find(n => n.tagName === 'SELECT');
  assert.equal(select.children.length, 2);
  assert.equal(select.value, 'synthetic-revision-a');
  assert.ok(root.textContent.includes('Café'));
  select.value = 'new-revision'; await select.trigger('change');
  assert.deepEqual(calls, ['new-revision']);
});
test('unknown or cross-source requested revision gives an explicit fallback warning', () => {
  const doc = new FakeDocument(), m = model();
  const root = renderSource(doc, m, m.sources.get('synthetic-source-a'), 'synthetic-revision-b',
    () => {}, () => {}, () => {});
  assert.match(root.textContent, /Requested revision synthetic-revision-b is not available for this source/);
  assert.match(root.textContent, /showing synthetic-revision-a instead/);
});
test('passage-selected source panel keeps both claims on one shared passage', () => {
  const doc = new FakeDocument(), m = model();
  const root = renderSource(doc, m, m.sources.get('synthetic-source-a'), 'synthetic-revision-a',
    () => {}, () => {}, () => {}, ['synthetic-passage-a']);
  assert.match(root.textContent, /same synthetic passage is scoped independently/);
  assert.ok(!root.textContent.includes('Inference rationale'));
  assert.ok(button(root, 'Show all revision claims'));
});
test('fetch helper requests only local endpoint with no-store and propagates failures', async () => {
  const calls = [];
  const m = await fetchCorpus(async (...args) => { calls.push(args); return response(); }, '/api/corpus');
  assert.equal(m.claims.size, 4);
  assert.deepEqual(calls[0], ['/api/corpus', { cache: 'no-store' }]);
  await assert.rejects(fetchCorpus(async () => response(null, 400), '/api/corpus'), /400/);
  await assert.rejects(fetchCorpus(async () => response({ schemaVersion: '0.2.0' }), '/api/corpus'), /0.3.0/);
});
test('initial empty valid corpus stays empty until explicit synthetic demo activation', async () => {
  const empty = fresh();
  for (const key of ['sources', 'sourceRevisions', 'passages', 'cases', 'claims', 'categorizations', 'timelines', 'reviews', 'collectionManifests']) empty[key] = [];
  empty.governance = {}; empty.name = 'No configured corpus';
  const doc = new FakeDocument(), win = fakeWindow(), requests = [];
  const app = mountWorkbench(doc, win, async path => { requests.push(path); return response(path === '/api/demo' ? fresh() : empty); });
  await app.ready;
  assert.deepEqual(requests, ['/api/corpus']);
  assert.match(doc.getElementById('content').textContent, /No records configured/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
  await doc.getElementById('demo').trigger('click');
  assert.deepEqual(requests, ['/api/corpus', '/api/demo']);
  assert.match(doc.getElementById('status').textContent, /SYNTHETIC DEMO/);
});
test('all four core views render with visible active navigation and matching record counts', async () => {
  const { doc, app, content } = await mounted();
  for (const view of ['cases', 'sources', 'claims', 'method']) {
    app.navigate(view);
    const selected = doc.getElementById('views').children.filter(b => b.attributes['aria-current'] === 'page');
    assert.equal(selected.length, 1); assert.equal(selected[0].dataset.view, view);
    assert.ok(content.textContent.length > 100);
  }
  assert.equal(doc.getElementById('toolbar').hidden, true);
  assert.match(content.textContent, /There is no live source fetching, file upload, export/);
});
test('deep-link claim reload resolves its older snapshot, not the newest revision', async () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'latest', normalizedContent: 'LATEST ONLY' });
  corpus.sources[0].revisionIds.push('latest');
  const { content } = await mounted(corpus, '#claims/synthetic-claim-a');
  const sourceText = descendants(content).find(n => n.className === 'source-text');
  assert.equal(sourceText.textContent, corpus.sourceRevisions[0].normalizedContent);
});
test('crosslink resets hiding filters, exposes exact target and moves keyboard focus', async () => {
  const { doc, app, content, win } = await mounted();
  doc.getElementById('search').value = 'never matches';
  await doc.getElementById('search').trigger('input');
  assert.match(content.textContent, /No records match/);
  app.navigate('claims', 'synthetic-claim-b');
  assert.equal(doc.getElementById('search').value, '');
  assert.equal(win.location.hash, '#claims/synthetic-claim-b/');
  assert.match(doc.getElementById('status').textContent, /reset search \/ facets/);
  assert.match(content.textContent, /A second synthetic source denies/);
  assert.equal(content.focused, true);
});
test('skip link preserves the selected route while focusing content', async () => {
  const { doc, win, content } = await mounted(fresh(), '#claims/synthetic-claim-b');
  await doc.getElementById('skip-content').trigger('click');
  assert.equal(win.location.hash, '#claims/synthetic-claim-b');
  assert.equal(content.focused, true);
});
test('keyboard highlight activation retains a meaningful focus destination and reveals linked claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a/synthetic-revision-a');
  const highlight = descendants(content).find(n => n.className === 'passage-highlight');
  await highlight.trigger('click');
  assert.equal(content.focused, true);
  assert.match(doc.getElementById('content').textContent, /Passage selection: synthetic-passage-a/);
});
test('empty result reset restores full count and all facets', async () => {
  const { doc, content } = await mounted();
  doc.getElementById('search').value = 'no such record';
  await doc.getElementById('search').trigger('input');
  assert.match(doc.getElementById('result').textContent, /0 matching cases \/ 2 total/);
  await button(content, 'Reset search & filters').trigger('click');
  assert.match(doc.getElementById('result').textContent, /2 matching cases \/ 2 total/);
});
test('actual facet checkbox and tag mode interactions update counts without writes', async () => {
  const corpus = fresh(); corpus.claims[0].disposition = 'Needs correction';
  const { doc, app } = await mounted(corpus);
  app.navigate('claims');
  const label = descendants(doc.getElementById('facets')).find(n => n.tagName === 'LABEL' && n.textContent === 'Needs correction');
  const input = label.children[0]; input.checked = true; await input.trigger('change');
  assert.match(doc.getElementById('result').textContent, /1 matching claims \/ 4 total/);
  doc.getElementById('tag-mode').value = 'AND';
  await doc.getElementById('tag-mode').trigger('change');
  assert.equal(app.getModel().claims.get('synthetic-claim-a').disposition, 'Needs correction');
});
test('malformed hash navigation, unknown targets and browser back never crash', async () => {
  const { win, doc } = await mounted(fresh(), '#sources/%ZZ');
  assert.match(doc.getElementById('result').textContent, /matching cases/);
  win.location.hash = '#claims/unknown'; win.listeners.hashchange();
  assert.match(doc.getElementById('content').textContent, /Unknown target/);
  win.location.hash = '#sources/synthetic-source-b/synthetic-revision-b'; win.listeners.popstate();
  assert.match(doc.getElementById('content').textContent, /The tool was not used/);
});
test('failed local load is visible and does not substitute a silent demo', async () => {
  const doc = new FakeDocument(), win = fakeWindow(), paths = [];
  const app = mountWorkbench(doc, win, async path => { paths.push(path); return response(null, 503); });
  await app.ready;
  assert.deepEqual(paths, ['/api/corpus']);
  assert.match(doc.getElementById('status').textContent, /503/);
  assert.equal(doc.getElementById('status').attributes['data-kind'], 'error');
  assert.equal(doc.getElementById('demo').disabled, false);
});
test('failed replacement retains previous data with an explicit limitation', async () => {
  const document = new FakeDocument(), win = fakeWindow();
  let count = 0;
  const instance = mountWorkbench(document, win, async () => ++count === 1 ? response() : response(null, 500));
  await instance.ready; await instance.load('/api/demo');
  assert.equal(instance.getModel().cases.size, 2);
  assert.match(document.getElementById('status').textContent, /Previously loaded corpus remains displayed/);
  assert.ok(document.getElementById('content').textContent.length);
});
test('DOM controls are semantic buttons / labels, highlights have accessible names', () => {
  const doc = new FakeDocument(), node = renderSourceText(doc, { normalizedContent: 'abc' },
    [{ id: 'p', start: 0, end: 2 }], () => {});
  const control = descendants(node).find(n => n.tagName === 'BUTTON');
  assert.equal(control.type, 'button');
  assert.match(control.attributes['aria-label'], /code points 0–2/);
  assert.equal(element(doc, 'span', '<b>literal</b>').textContent, '<b>literal</b>');
});
test('bundled entrypoint uses only permitted local assets and no external requests or unsafe HTML sinks', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  for (const path of ['/src/app.mjs', '/src/style.css', '/docs/assets/logo.svg', '/docs/assets/favicon.svg']) assert.ok(html.includes(path));
  assert.ok(!/https?:\/\/|cdn|<iframe/i.test(html));
  for (const file of ['app.mjs', 'render.mjs', 'model.mjs']) {
    const text = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage/.test(text), file);
  }
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  for (const color of ['#f6f3eb', '#fffdf7', '#25352f', '#68746b', '#dcded2', '#cb572d', '#2c5e50']) assert.ok(css.includes(color));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('@media(max-width:700px)'));
});
