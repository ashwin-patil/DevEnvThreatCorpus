import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createModel, metadata, dateLabel, caseSourceIds, linkedClaims, claimTarget,
  passageSegments, conflictPairs, recordContext, filterRecords, facetOptions, parseRoute, routeHash,
} from '../src/model.mjs';
import { element, renderClaim, renderConflicts, renderSourceText, renderSource, renderCase } from '../src/render.mjs';
import { fetchCorpus, mountWorkbench } from '../src/app.mjs';
import {
  DIMENSIONS, EVIDENCE, normalizeSuppliedText, serializeProposal, hashText, selectedPassage,
  createStudio, pasteArticle, addStudioCase, saveDraft, extractionProposal, corpusProposal, renderStudio, downloadProposal,
} from '../src/studio.mjs';
import { assertValid, validateShape, categories, schema, normalizeText, digest, sha256, canonicalSerialize, intakeSource } from '../scripts/contract.mjs';
import { applyExtraction } from '../scripts/extract.mjs';
import { emptyCorpus } from '../scripts/server.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  replaceWith(node) {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children[index] = node; node.parentNode = this.parentNode;
  }
  remove() { this.parentNode.children = this.parentNode.children.filter(n => n !== this); }
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
    this.body = new FakeElement('body');
    this.nodes = new Map(['status', 'stats', 'views', 'toolbar', 'search', 'tag-mode', 'reset', 'facets', 'result', 'content', 'demo', 'reload-corpus', 'skip-content']
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
  await doc.getElementById('reload-corpus').trigger('click');
  assert.deepEqual(requests, ['/api/corpus', '/api/demo', '/api/corpus']);
  assert.equal(app.getModel().cases.size, 0);
  assert.match(doc.getElementById('content').textContent, /No records configured/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
  assert.equal(doc.getElementById('reload-corpus').disabled, false);
});
test('reload local corpus restores configured records and clears demo filters', async () => {
  const local = fresh();
  local.name = 'Configured local snapshot'; local.governance = {};
  const doc = new FakeDocument(), win = fakeWindow();
  const app = mountWorkbench(doc, win, async endpoint => response(endpoint === '/api/demo' ? fresh() : local));
  await app.ready;
  await doc.getElementById('demo').trigger('click');
  doc.getElementById('search').value = 'no matching records';
  await doc.getElementById('search').trigger('input');
  await doc.getElementById('reload-corpus').trigger('click');
  assert.equal(app.getModel().corpus.name, local.name);
  assert.equal(doc.getElementById('search').value, '');
  assert.match(doc.getElementById('result').textContent, /2 matching cases/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
});
test('all core views and curator studio render with visible active navigation', async () => {
  const { doc, app, content } = await mounted();
  for (const view of ['cases', 'sources', 'claims', 'studio', 'method']) {
    app.navigate(view);
    const selected = doc.getElementById('views').children.filter(b => b.attributes['aria-current'] === 'page');
    assert.equal(selected.length, 1); assert.equal(selected[0].dataset.view, view);
    assert.ok(content.textContent.length > 100);
  }
  assert.equal(doc.getElementById('toolbar').hidden, true);
  assert.match(content.textContent, /There is no live source fetching, server write, automatic acceptance/);
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
test('source facet fallback clears passage selection so the newly visible source keeps its claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a');
  await descendants(content).find(n => n.className === 'passage-highlight').trigger('click');
  assert.match(content.textContent, /Passage selection: synthetic-passage-a/);
  const label = descendants(doc.getElementById('facets')).find(n =>
    n.tagName === 'LABEL' && n.textContent === 'Synthetic conflicting account');
  label.children[0].checked = true;
  await label.children[0].trigger('change');
  assert.ok(!content.textContent.includes('Passage selection'));
  assert.ok(descendants(content).some(n => n.className === 'claim-title' &&
    n.textContent === 'A second synthetic source denies tool use.'));
  assert.ok(!content.textContent.includes('No linked claims for this revision / passage'));
});
test('tag mode changes clear selected passages instead of retaining a hidden subset of claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a');
  await descendants(content).find(n => n.className === 'passage-highlight').trigger('click');
  assert.ok(!content.textContent.includes('Inference rationale'));
  doc.getElementById('tag-mode').value = 'AND';
  await doc.getElementById('tag-mode').trigger('change');
  assert.ok(!content.textContent.includes('Passage selection'));
  assert.match(content.textContent, /Inference rationale/);
});
test('revision selection on a filtered fallback source updates the complete route and survives reset', async () => {
  const { doc, win, content } = await mounted(fresh(), '#sources/synthetic-source-a/synthetic-revision-a');
  const label = descendants(doc.getElementById('facets')).find(n =>
    n.tagName === 'LABEL' && n.textContent === 'Synthetic conflicting account');
  label.children[0].checked = true;
  await label.children[0].trigger('change');
  const revision = descendants(content).find(n => n.tagName === 'SELECT');
  revision.value = 'synthetic-revision-b';
  await revision.trigger('change');
  assert.equal(win.location.hash, '#sources/synthetic-source-b/synthetic-revision-b');
  await doc.getElementById('reset').trigger('click');
  const selected = descendants(content).find(n => n.className === 'record-card' &&
    n.attributes['aria-pressed'] === 'true');
  assert.match(selected.textContent, /Synthetic conflicting account/);
  assert.equal(descendants(content).find(n => n.className === 'source-text').textContent, 'The tool was not used.');
  assert.equal(win.location.hash, '#sources/synthetic-source-b/synthetic-revision-b');
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
  for (const file of ['app.mjs', 'render.mjs', 'model.mjs', 'studio.mjs']) {
    const text = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage/.test(text), file);
  }
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  for (const color of ['#f6f3eb', '#fffdf7', '#25352f', '#68746b', '#dcded2', '#cb572d', '#2c5e50']) assert.ok(css.includes(color));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('@media(max-width:700px)'));
});

function textNode(text) { return { nodeType: 3, textContent: text, childNodes: [] }; }
function tree(...children) {
  return { nodeType: 1, childNodes: children, get textContent() { return children.map(c => c.textContent).join(''); } };
}
function selection(startContainer, startOffset, endContainer, endOffset, extra = {}) {
  return { rangeCount: 1, isCollapsed: false, getRangeAt: () => ({ startContainer, startOffset, endContainer, endOffset }), ...extra };
}
function draftState() {
  const state = createStudio(fresh());
  state.sourceId = 'synthetic-source-a'; state.revisionId = 'synthetic-revision-a';
  return state;
}
function choosePassage(state, start = 0, end = 3) {
  const revision = [...state.base.sourceRevisions, ...state.intakes.map(i => i.revision)].find(r => r.id === state.revisionId);
  const points = [...revision.normalizedContent];
  state.selection = { sourceRevisionId: revision.id, revisionHash: revision.normalizedHash,
    start, end, text: points.slice(start, end).join(''), locator: `code-points:${start}-${end}` };
}
const claimInput = () => ({ caseId: 'synthetic-case-a', description: 'Synthetic curator claim; not incident evidence.',
  evidenceStatus: 'Source-reported observation' });
function inputNamed(node, label) {
  return descendants(node).find(n => n.attributes['aria-label'] === label);
}

test('Issue #31 AC-01 browser normalization, enums and hashes match the foundation contract', async () => {
  const samples = ['😀 cafe\u0301\r\n🧑‍💻\rend', '\uFEFF A\r\nB', '<p>&amp; literal HTML</p>', '日本語 repeated 😀 repeated'];
  for (const raw of samples) {
    assert.equal(normalizeSuppliedText(raw), normalizeText(raw));
    assert.equal(await hashText(raw), sha256(raw));
  }
  for (const [dimension, values] of Object.entries(DIMENSIONS)) assert.deepEqual(values, categories[dimension]);
  assert.deepEqual(EVIDENCE, schema.$defs.evidenceStatus.enum);
  assert.equal(serializeProposal(fixture), canonicalSerialize(fixture));
  assert.equal(await hashText(serializeProposal(fixture)), digest(fixture));
});

test('Issue #31 AC-01 DOM Range resolves UTF-16 boundaries across nested highlights and repeated text', () => {
  const first = textNode('😀 '), middle = textNode('café'), end = textNode('\n🧑‍💻 😀 café');
  const root = tree(tree(first), tree(tree(middle)), end);
  const revision = { id: 'rev', normalizedContent: root.textContent, normalizedHash: sha256(root.textContent) };
  const picked = selectedPassage(root, selection(first, 3, end, 6), revision);
  assert.deepEqual(picked, { sourceRevisionId: 'rev', revisionHash: revision.normalizedHash,
    start: 2, end: 10, text: 'café\n🧑‍💻', locator: 'code-points:2-10' });
  // Browser ranges are document-ordered even for backward pointer selections.
  assert.deepEqual(selectedPassage(root, selection(first, 3, end, 6, { anchorNode: end, focusNode: first }), revision), picked);
  const repeated = selectedPassage(root, selection(end, 10, end, 14), revision);
  assert.equal(repeated.text, 'café'); assert.equal(repeated.start, 13);
  assert.equal(selectedPassage(root, selection(root, 1, root, 2), revision).text, 'café');
  assert.equal(selectedPassage(root, selection(root, 0, root, 3), revision).text, root.textContent);
});

test('Issue #31 AC-01 invalid, collapsed, outside, stale and surrogate-splitting DOM ranges are rejected', () => {
  const node = textNode('😀a'), root = tree(node), revision = { id: 'rev', normalizedContent: root.textContent };
  for (const selected of [
    null, selection(node, 0, node, 0, { isCollapsed: true }),
    selection(node, 0, node, 2, { rangeCount: 2 }),
    selection(textNode('outside'), 0, node, 2), selection(node, 0, textNode('outside'), 2),
    selection(node, 1, node, 2), selection(node, 0, node, 1), selection(root, -1, root, 1),
  ]) assert.equal(selectedPassage(root, selected, revision), null);
  assert.equal(selectedPassage(root, selection(node, 0, node, 2), { ...revision, normalizedContent: 'new' }), null);
  assert.equal(selectedPassage(root, selection(node, 0, node, 2), { ...revision, normalizedContent: null }), null);
});

test('Issue #31 AC-02 generated extraction JSON applies to the existing CLI contract without changing the base', () => {
  const state = draftState(), before = canonicalSerialize(state.base);
  choosePassage(state);
  const first = saveDraft(state, { ...claimInput(), behavior: 'Synthetic behavior', artifacts: 'example.invalid\nartifact.txt',
    dimensions: { trust_surface: [DIMENSIONS.trust_surface[0]], execution_location: ['CLI', 'endpoint'] }, techniques: ['T1059', 'AML.T0051'] });
  assert.equal(state.selection, null);
  const inference = saveDraft(state, { ...claimInput(), description: 'Synthetic inference', evidenceStatus: 'Researcher inference',
    rationale: 'Explicit synthetic reasoning', supportingClaimIds: [first.id] });
  const exported = JSON.parse(serializeProposal(extractionProposal(state))), target = fresh();
  applyExtraction(target, exported, 'operator', serializeProposal(exported));
  assert.deepEqual(validateShape(target), []); assertValid(target);
  const applied = target.claims.find(c => c.id === inference.id);
  assert.equal(applied.disposition, 'Pending');
  assert.equal(applied.origin, 'Human inference');
  assert.equal(applied.inference.supportingClaimIds[0], first.id);
  assert.equal(canonicalSerialize(state.base), before);
  assert.ok(!JSON.stringify(exported).includes('candidateTechniques'));
});

test('Issue #31 AC-02 pasted fixture generates a standalone schema-valid private proposal and CLI-compatible identities', async t => {
  const input = JSON.parse(await readFile(new URL('./fixtures/extraction/studio-input.json', import.meta.url), 'utf8'));
  const state = createStudio(emptyCorpus()), before = canonicalSerialize(state.base);
  const revision = await pasteArticle(state, input);
  assert.equal(revision.normalizedContent, normalizeText(input.text));
  const record = addStudioCase(state, 'Synthetic studio exercise; not incident evidence', 'Research exercise');
  choosePassage(state, 0, [...revision.normalizedContent].length);
  saveDraft(state, { ...claimInput(), caseId: record.id, ...input.annotation });
  const proposal = JSON.parse(serializeProposal(await corpusProposal(state)));
  assert.deepEqual(validateShape(proposal), []); assertValid(proposal);
  assert.equal(proposal.governance.studio.baseDigest, digest(state.base));
  assert.equal(proposal.behaviors[0].candidateTechniques[1].framework, 'ATLAS');
  assert.deepEqual(proposal.behaviors[0].artifacts, ['example.invalid', 'synthetic-artifact.txt']);
  assert.equal(proposal.categorizations.length, 6);
  assert.ok(proposal.categorizations.every(c => c.disposition === 'Pending'));
  assert.equal(proposal.sources[0].publisher, input.publisher);
  assert.equal(proposal.sources[0].publicationDate.precision, 'unknown');
  assert.throws(() => extractionProposal(state), /New intake\/cases/);
  assert.equal(canonicalSerialize(state.base), before);
  const store = await mkdtemp(path.join(os.tmpdir(), 'studio-intake-'));
  t.after(() => rm(store, { recursive: true, force: true }));
  const result = await intakeSource({ kind: 'text', text: input.text, sourceUrl: input.url, suppliedBy: input.suppliedBy, store });
  assert.equal(result.status, 'succeeded');
  const cli = JSON.parse(await readFile(path.join(store, 'corpus.json'), 'utf8'));
  assert.equal(cli.sources[0].id, proposal.sources[0].id);
  assert.equal(cli.sourceRevisions[0].id, revision.id);
  assert.equal(cli.sourceRevisions[0].normalizedHash, revision.normalizedHash);
});

test('Issue #31 AC-02 existing cases are explicit context, not rewritten review decisions', async () => {
  const state = draftState(), before = canonicalSerialize(state.base);
  choosePassage(state); saveDraft(state, claimInput());
  const proposal = await corpusProposal(state);
  assertValid(proposal);
  assert.deepEqual(proposal.governance.studio.contextCaseIds, ['synthetic-case-a']);
  assert.deepEqual(proposal.governance.studio.contextSourceIds, ['synthetic-source-a']);
  assert.equal(proposal.cases[0].summary, null);
  assert.equal(proposal.cases[0].disposition, 'Pending');
  assert.deepEqual(proposal.reviews, []);
  assert.equal(canonicalSerialize(state.base), before);
});

test('Issue #31 AC-02 grounding fails closed for missing, altered, out-of-range and wrong-revision passages', () => {
  const state = draftState();
  assert.throws(() => saveDraft(state, claimInput()), /Select an exact passage/);
  for (const change of [{ start: -1 }, { end: 999 }, { end: 1.5 }, { text: 'invented' },
    { sourceRevisionId: 'wrong' }, { revisionHash: 'wrong' }]) {
    choosePassage(state); Object.assign(state.selection, change);
    assert.throws(() => saveDraft(state, claimInput()), /Select an exact passage/);
  }
  choosePassage(state);
  assert.throws(() => saveDraft(state, { ...claimInput(), description: ' ' }), /description/);
  assert.throws(() => saveDraft(state, { ...claimInput(), caseId: 'missing' }), /case/);
  assert.throws(() => saveDraft(state, { ...claimInput(), dimensions: { delivery: ['other'] } }), /Other delivery/);
  assert.throws(() => saveDraft(state, { ...claimInput(), techniques: ['Tbad'] }), /Technique IDs/);
  assert.throws(() => saveDraft(state, { ...claimInput(), techniques: ['T1059'] }), /behavior description/);
  assert.equal(state.drafts.length, 0);
  assert.throws(() => extractionProposal(state), /at least one/);
});

test('Issue #31 AC-02 inferences need nonblank rationale and earlier same-case support, never fake quotations', () => {
  const state = draftState(), input = { ...claimInput(), evidenceStatus: 'Researcher inference' };
  assert.throws(() => saveDraft(state, input), /rationale/);
  assert.throws(() => saveDraft(state, { ...input, rationale: 'reason' }), /same-case/);
  choosePassage(state); const support = saveDraft(state, claimInput());
  assert.throws(() => saveDraft(state, { ...input, caseId: 'synthetic-case-b', rationale: 'reason', supportingClaimIds: [support.id] }), /same-case/);
  choosePassage(state);
  const inference = saveDraft(state, { ...input, rationale: 'reason', supportingClaimIds: [support.id] });
  assert.deepEqual(inference.passages, []); assert.equal(inference.origin, 'Human inference');
});

test('Issue #31 AC-03 intake refuses unsafe text/credentials, bounds input and never overwrites an existing source', async () => {
  const input = { url: 'https://example.org/studio', text: 'Synthetic text', suppliedBy: 'operator' };
  for (const update of [{ text: '' }, { text: '\uD800' }, { text: 'a\0b' }, { text: '😀'.repeat(524289) },
    { url: 'javascript:alert(1)' }, { url: '******example.org' }, { suppliedBy: 'invalid supplier' }]) {
    const state = createStudio(emptyCorpus());
    await assert.rejects(pasteArticle(state, { ...input, ...update }));
    assert.deepEqual(state.intakes, []);
  }
  const state = createStudio(emptyCorpus());
  await pasteArticle(state, input);
  await assert.rejects(pasteArticle(state, { ...input, text: 'changed', url: input.url + '?utm_source=ignored#fragment' }), /already has a source/);
  assert.equal(state.intakes.length, 1);
});

test('Issue #31 AC-02/03 DOM studio composes, saves, preserves and removes a pending claim without network writes', async () => {
  const { doc, win, app, content, requests } = await mounted();
  app.navigate('studio');
  await button(content, 'Save pending claim').trigger('click');
  assert.match(content.textContent, /Select or explicitly create a case/);
  const source = inputNamed(content, 'Selectable normalized source text');
  // Feed browser-shaped text nodes to the real selection handler.
  const child = textNode(source.textContent); source.childNodes = [child]; source.nodeType = 1;
  win.getSelection = () => selection(child, 0, child, 4);
  await source.trigger('pointerup');
  assert.match(content.textContent, /code-points:0-3/);
  inputNamed(content, 'Case').value = 'synthetic-case-a';
  inputNamed(content, 'Claim description').value = '<script>synthetic literal claim</script>';
  await button(content, 'Save pending claim').trigger('click');
  assert.match(content.textContent, /Saved pending claims · 1/);
  assert.match(content.textContent, /No active passage selection/);
  assert.equal(descendants(content).filter(n => n.tagName === 'SCRIPT').length, 0);
  app.navigate('cases'); app.navigate('studio');
  assert.match(content.textContent, /synthetic literal claim/);
  assert.equal(app.getModel().corpus.claims.length, fixture.claims.length);
  assert.deepEqual(requests.map(r => r[0]), ['/api/corpus']);
  win.confirm = () => false;
  await app.load('/api/demo');
  assert.equal(requests.length, 1);
  await button(content, 'Remove draft claim').trigger('click');
  assert.match(content.textContent, /Saved pending claims · 0/);
  assert.ok(doc.getElementById('toolbar').hidden);
});

test('Issue #31 AC-01 revision changes clear active selections and source view opens the exact revision', async () => {
  const state = draftState(), doc = new FakeDocument(), win = fakeWindow();
  choosePassage(state);
  const host = new FakeElement('div'); host.append(renderStudio(doc, win, state));
  inputNamed(host, 'Source').value = 'synthetic-source-b';
  await inputNamed(host, 'Source').trigger('change');
  assert.equal(state.selection, null); assert.equal(state.revisionId, 'synthetic-revision-b');
  await button(host, 'Select entire revision').trigger('click');
  assert.equal(state.selection.text, state.base.sourceRevisions[1].normalizedContent);
  assert.equal(state.selection.start, 0);
  assert.equal(state.selection.end, [...state.selection.text].length);
  const mountedApp = await mounted(fresh(), '#sources/synthetic-source-b/synthetic-revision-b');
  await button(mountedApp.content, 'Draft from this revision').trigger('click');
  assert.equal(mountedApp.win.location.hash, '#studio/synthetic-source-b/synthetic-revision-b');
  assert.equal(inputNamed(mountedApp.content, 'Exact source revision').value, 'synthetic-revision-b');
});

test('Issue #31 AC-03 pasted HTML stays literal in DOM and JSON downloads use only revocable local blobs', async () => {
  const state = createStudio(emptyCorpus()), doc = new FakeDocument();
  const payload = '<script>alert(1)</script><img src="https://example.invalid/pixel" onerror="alert(1)">';
  await pasteArticle(state, { text: payload, url: 'https://example.org/studio', suppliedBy: 'operator', title: payload });
  const view = renderStudio(doc, fakeWindow(), state);
  assert.equal(inputNamed(view, 'Selectable normalized source text').textContent, payload);
  assert.equal(descendants(view).filter(n => ['SCRIPT', 'IMG', 'IFRAME'].includes(n.tagName)).length, 0);
  let blob, downloaded, revoked;
  const create = doc.createElement.bind(doc);
  doc.createElement = tag => {
    const node = create(tag); node.click = () => { downloaded = { href: node.href, filename: node.download }; }; return node;
  };
  const win = { Blob, URL: { createObjectURL(value) { blob = value; return 'blob:local-only'; },
    revokeObjectURL(url) { revoked = url; } }, setTimeout(fn) { fn(); } };
  downloadProposal(doc, win, await corpusProposal(state), 'curator-proposal.json');
  assert.deepEqual(downloaded, { href: 'blob:local-only', filename: 'curator-proposal.json' });
  assert.equal(revoked, 'blob:local-only'); assert.equal(doc.body.children.length, 0);
  assert.equal(blob.type, 'application/json');
  assertValid(JSON.parse(await blob.text()));
});
test('official wide wordmark has its native aspect ratio, accessible brand name and no duplicate text', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const brand = html.match(/<a class="brand"[^>]*>(.*?)<\/a>/s)?.[1];
  assert.ok(brand);
  assert.match(brand, /alt="DevEnvThreatCorpus"/);
  assert.match(brand, /width="360" height="80"/);
  assert.ok(!brand.includes('<span') && !brand.includes('<small'));
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.brand img\{[^}]*width:100%;height:auto/);
  assert.match(css, /\.brand\{[^}]*width:300px/);
});
