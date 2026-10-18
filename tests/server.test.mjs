import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { privateStoreTest } from './platform.mjs';
import { CAMPAIGN_LIMITS, createPreviewServer, emptyCorpus, parseArguments, WEB_INTAKE_LIMITS } from '../scripts/server.mjs';
import { canonicalSerialize, validateCorpus } from '../scripts/contract.mjs';
import { createEnrichmentTemplate } from '../src/enrichment.mjs';
import { confirmationFor, GUIDE_VERSION } from '../src/review-guide.mjs';
import { validateProfileRow } from '../scripts/contract.mjs';

async function start(t, options) {
  const server = await createPreviewServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

function request(port, url, headers = {}, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, headers, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (headers['Transfer-Encoding'] === 'chunked' && body) req.write(body);
    req.end(headers['Transfer-Encoding'] === 'chunked' ? undefined : body);
  });
}

async function workspace(t) {
  const root = fileURLToPath(new URL('../.private-intake/', import.meta.url));
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(root, 'web-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const sameOrigin = port => ({ Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' });

test('bundled default advertises public projection and serves only allowlisted public files', async t => {
  const port = await start(t);
  assert.equal((await request(port, '/api/corpus')).headers['x-corpus-mode'], 'public-draft');
  const data = await request(port, '/src/data/nx-draft.json');
  assert.equal(data.status, 200);
  const draft = JSON.parse(data.body);
  assert.equal(draft.profile, 'draft');
  assert.ok(draft.records.every(r => r.entityType !== 'sourceRevisions' || r.entity.rawContent === null && r.entity.normalizedContent === null));
  assert.ok(draft.records.every(r => r.entityType !== 'passages' || r.entity.text === null && r.entity.attestation === null));
  assert.equal((await request(port, '/src/public-profile.mjs')).status, 200);
  assert.equal((await request(port, '/src/stage-view.mjs')).status, 200);
  assert.equal((await request(port, '/src/stages.mjs')).status, 404);
  assert.equal((await request(port, '/src/stage-comparison.mjs')).status, 404);
  assert.equal((await request(port, '/.private-intake/candidate.json')).status, 404);
  assert.equal((await request(port, '/docs/data/nx-draft/records.jsonl')).status, 404);
});

privateStoreTest('#85 AC-01/05/07 staged HTTP prepare/validate/apply is bounded, same-origin and rejects stale input', async t => {
  const store = await workspace(t), corpus = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  const file = path.join(store, 'corpus.json');
  await writeFile(file, canonicalSerialize(corpus), { mode: 0o600 });
  const port = await start(t, { store });
  const post = (command, body, headers = sameOrigin(port)) => request(port, `/api/campaign/stage/${command}`, headers, 'POST', JSON.stringify(body));
  assert.equal((await post('prepare', { caseId: 'synthetic-case-a', kind: 'ground' }, { 'Content-Type': 'application/json' })).status, 403);
  const prepared = await post('prepare', { caseId: 'synthetic-case-a', kind: 'ground' });
  assert.equal(prepared.status, 200, prepared.body);
  const r = JSON.parse(prepared.body).request;
  const candidate = { schemaVersion: 'campaign-stage-candidate/1', requestHash: r.requestHash, kind: 'ground',
    model: { effectiveModel: null, version: null, nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
    processing: r.inputs.flatMap(i => i.segments.map(s => ({ inputId: s.id, status: 'skipped', reason: 'Synthetic only.' }))),
    outputs: { claims: [], artifacts: [] }, limitations: ['Synthetic offline exercise.'] };
  const input = { request: r, candidate };
  const before = await readFile(file, 'utf8');
  assert.equal((await post('validate', input)).status, 200);
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal((await post('apply', input)).status, 200);
  assert.notEqual(await readFile(file, 'utf8'), before);
  assert.equal((await post('validate', input)).status, 409);
  assert.equal((await post('apply', input)).status, 200);
  const review = JSON.parse((await request(port, '/api/review')).body);
  assert.equal(review.stages.runs.length, 1);
  assert.equal(review.baselineSelection.selected, false);
  assert.equal((await post('prepare', { caseId: 'synthetic-case-a', kind: 'ground', inputKeys: Array(1001).fill('x') })).status, 400);
  assert.equal((await post('prepare', { caseId: 'synthetic-case-a', kind: 'ground', endpoint: 'https://example.invalid' })).status, 400);
});

test('Issue #81 AC-03/07/09/10 isolated synthetic review works from public mode, persists through refresh, rejects stale/cross-origin writes', async t => {
  const port = await start(t), publicBefore = await request(port, '/src/data/nx-draft.json');
  const get = async () => JSON.parse((await request(port, '/api/review-demo')).body);
  const state = await get();
  assert.ok(state.units.some(u => u.priorityCategory === 'tools'));
  assert.ok(state.units.some(u => u.priorityCategory === 'prompts'));
  assert.ok(state.units.some(u => u.type === 'occurrences'));
  assert.ok(state.campaigns['synthetic-case-a'].priority.total >= 4);
  const claim = state.units.find(u => u.itemKey === 'claims:synthetic-claim-a');
  const input = { snapshot: state.snapshot, itemKey: claim.itemKey, action: 'accept',
    reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION, confirmation: confirmationFor(claim) };
  const send = (value, headers = sameOrigin(port)) => request(port, '/api/review-demo', headers, 'POST', JSON.stringify(value));
  assert.equal((await send(input, { 'Content-Type': 'application/json' })).status, 403);
  assert.equal((await send(input, { ...sameOrigin(port), Origin: 'https://example.invalid' })).status, 403);
  assert.equal((await send(input)).status, 200);
  assert.equal((await send(input)).status, 409);
  const loaded = await get(), accepted = loaded.units.find(u => u.itemKey === claim.itemKey);
  assert.equal(accepted.state, 'Accepted');
  assert.equal(accepted.history.length, 1);
  assert.equal(accepted.history[0].reviewer, 'synthetic-human');
  const tool = loaded.units.find(u => u.priorityCategory === 'tools');
  const changed = { snapshot: loaded.snapshot, itemKey: tool.itemKey, action: 'modify', reviewer: 'synthetic-human',
    selfAttested: true, guideVersion: GUIDE_VERSION, patch: { normalizedValue: 'Synthetic edited identity' },
    rationale: 'Synthetic correction, not incident evidence.' };
  assert.equal((await send(changed)).status, 200);
  const updated = await get(), edited = updated.units.find(u => u.itemKey === tool.itemKey);
  assert.equal(edited.record.normalizedValue, 'Synthetic edited identity');
  assert.equal(edited.eligible, false);
  assert.equal(edited.original.normalizedValue, 'Synthetic coding tool');
  assert.equal((await send({ ...input, snapshot: updated.snapshot, itemKey: edited.itemKey, confirmation: confirmationFor(edited) })).status, 200);
  const final = await get();
  assert.equal(final.units.find(u => u.itemKey === edited.itemKey).history.length, 2);
  const profile = JSON.parse((await request(port, '/api/review-demo/export')).body);
  assert.ok(profile.records.some(r => r.entityType === 'annotations'));
  assert.ok(profile.records.find(r => r.entityType === 'cases').entity.contextOnly);
  for (const row of profile.records) assert.deepEqual(validateProfileRow(row), []);
  assert.equal((await request(port, '/src/data/nx-draft.json')).body, publicBefore.body);
  assert.equal((await request(port, '/api/corpus')).headers['x-collection-enabled'], undefined);
  assert.equal((await request(port, '/api/review', sameOrigin(port), 'POST', JSON.stringify(input))).status, 405);
});

privateStoreTest('Issue #81 AC-07 private HTTP review persists to disk across server instances and rejects stale/concurrent writes', async t => {
  const store = await workspace(t);
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
  const file = path.join(store, 'corpus.json');
  await writeFile(file, canonicalSerialize(corpus), { mode: 0o600 });
  const port = await start(t, { store });
  const before = JSON.parse((await request(port, '/api/review')).body);
  const unit = before.units.find(u => u.itemKey === 'claims:synthetic-claim-a');
  const input = { snapshot: before.snapshot, itemKey: unit.itemKey, action: 'accept',
    reviewer: 'synthetic-disk-reviewer', selfAttested: true, guideVersion: GUIDE_VERSION, confirmation: confirmationFor(unit) };
  const send = (p, value) => request(p, '/api/review', sameOrigin(p), 'POST', JSON.stringify(value));
  const results = await Promise.all([send(port, input), send(port, input)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const persisted = await readFile(file, 'utf8'), stored = JSON.parse(persisted);
  assert.equal(stored.governance.localReview.events.length, 1);
  assert.equal(stored.governance.localReview.events[0].reviewer, input.reviewer);
  assert.equal((await lstat(file)).mode & 0o777, 0o600);
  const restarted = await start(t, { store });
  const loaded = JSON.parse((await request(restarted, '/api/review')).body);
  const accepted = loaded.units.find(u => u.itemKey === unit.itemKey);
  assert.equal(accepted.state, 'Accepted');
  assert.equal(accepted.history.length, 1);
  assert.equal((await send(restarted, input)).status, 409);
  assert.equal(await readFile(file, 'utf8'), persisted);
  assert.deepEqual(JSON.parse((await request(restarted, '/api/corpus')).body).claims, corpus.claims);
});

test('browser normalization helper is explicitly served without exposing private implementation modules', async t => {
  const port = await start(t);
  const response = await request(port, '/src/research-inventory.mjs');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.match(response.body, /publisherDisplay/);
  assert.equal((await request(port, '/src/campaign.mjs')).status, 404);
});

test('#89 AC-06 category browser dependency is allowlisted without exposing the catalogue importer or private campaign modules', async t => {
  const port = await start(t);
  const response = await request(port, '/src/campaign-categories.mjs');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.match(response.body, /campaign-category-rules\/1/);
  assert.equal((await request(port, '/src/import-attack-catalog.mjs')).status, 404);
  assert.equal((await request(port, '/src/campaign.mjs')).status, 404);
  assert.equal((await request(port, '/src/model-adapter.mjs')).status, 404);
});

test('Issue #79 AC-01/02 public preview loads real corpora from a working directory containing spaces, # and %', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workbench path #%-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const directoryUrl = pathToFileURL(directory);
  assert.match(directoryUrl.href, /%20/);
  assert.match(directoryUrl.href, /%23%25/);
  const program = `
    import { createPreviewServer } from ${JSON.stringify(new URL('../scripts/server.mjs', import.meta.url).href)};
    import { fetchCorpus, PUBLIC_DRAFT_URL } from ${JSON.stringify(new URL('../src/app.mjs', import.meta.url).href)};
    const server = await createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const fetcher = (endpoint, options) => fetch(new URL(endpoint === PUBLIC_DRAFT_URL ? '/src/data/nx-draft.json' : endpoint, base), options);
      const results = [];
      for (const endpoint of ['/api/corpus', '/api/demo', '/api/demo-research']) {
        const model = await fetchCorpus(fetcher, endpoint);
        results.push({ publicDraft: !!model.publicDraft, synthetic: !!model.corpus.governance?.synthetic,
          cases: model.corpus.cases.length, collectionEnabled: !!model.collectionEnabled });
      }
      console.log(JSON.stringify(results));
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', program], {
    cwd: fileURLToPath(directoryUrl), encoding: 'utf8', timeout: 15_000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  const [draft, ...demos] = JSON.parse(child.stdout);
  assert.equal(draft.publicDraft, true);
  assert.equal(draft.synthetic, false);
  assert.ok(draft.cases > 0);
  assert.equal(draft.collectionEnabled, false);
  for (const demo of demos) assert.deepEqual(demo, {
    publicDraft: false, synthetic: true, cases: 2, collectionEnabled: false,
  });
});
const articleUrls = ['https://www.stepsecurity.io/blog/one', 'https://socket.dev/blog/two', 'https://redcanary.com/blog/three'];
function transport(article) {
  const respond = (raw, status = 200) => ({ status, peerAddress: '93.184.216.34',
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: (async function* () { yield Buffer.from(raw); })(), close() {} });
  return {
    resolve: async () => [{ address: '93.184.216.34', family: 4 }],
    request: async input => {
      const url = new URL(input.url);
      if (url.pathname === '/robots.txt') return respond('', 404);
      if (article) return article(input, respond);
      if (['/failed', '/denied-image.png'].includes(url.pathname)) return respond('', 403);
      return respond(`<html><head><title>Article ${url.pathname}</title></head><body><article><h1>Article ${url.pathname}</h1><p>Retained synthetic source text.</p>${url.pathname === '/blog/two' ? '<img src="/denied-image.png" alt="Synthetic denied image">' : ''}<script>window.untrusted = true</script></article></body></html>`);
    },
  };
}

test('AC-05 preview starts with a valid empty corpus and offers explicitly synthetic fresh-contract demo', async t => {
  const port = await start(t);
  const empty = await request(port, '/api/corpus');
  assert.equal(empty.status, 200);
  assert.deepEqual(JSON.parse(empty.body), emptyCorpus());
  assert.deepEqual(validateCorpus(JSON.parse(empty.body)), []);
  const demo = await request(port, '/api/demo');
  assert.equal(demo.status, 200);
  const corpus = JSON.parse(demo.body);
  assert.deepEqual(validateCorpus(corpus), []);
  assert.match(corpus.name, /Synthetic.*not incident evidence/);
  assert.ok(corpus.claims.some(claim => claim.conflictsWith.length));
  assert.equal(demo.headers['cache-control'], 'no-store');
  assert.equal(demo.headers['access-control-allow-origin'], undefined);
  assert.match(demo.headers['content-security-policy'], /frame-ancestors 'none'/);
});

privateStoreTest('AC-05 private source records are validated and held as a read-only startup snapshot', async t => {
  const directory = await workspace(t);
  const corpusFile = path.join(directory, 'corpus.json');
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  await writeFile(corpusFile, canonicalSerialize(corpus), { mode: 0o600 });
  const port = await start(t, { corpusFile });
  await writeFile(corpusFile, 'invalid');
  assert.equal((await request(port, '/api/corpus')).body, canonicalSerialize(corpus));
  await assert.rejects(createPreviewServer({ corpusFile }));
  await writeFile(corpusFile, canonicalSerialize(corpus));
  await chmod(corpusFile, 0o644);
  await assert.rejects(createPreviewServer({ corpusFile }));
  await chmod(corpusFile, 0o600);
  const link = path.join(directory, 'linked.json');
  await symlink(corpusFile, link);
  await assert.rejects(createPreviewServer({ corpusFile: link }));
});

test('AC-05 server rejects writes, path traversal, repository/private files, foreign hosts and cross-site reads', async t => {
  const port = await start(t);
  for (const url of ['/project.config.json', '/.private-intake/corpus.json', '/scripts/contract.mjs',
    '/tests/fixtures/benign/core-only.json', '/src/../project.config.json', '/%2e%2e/README.md',
    '/api/corpus?file=/etc/passwd', '//api/corpus', '/api/corpus/']) {
    assert.equal((await request(port, url)).status, 404, url);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    assert.equal((await request(port, '/api/corpus', {}, method)).status, 405);
  }
  assert.equal((await request(port, '/api/intake', sameOrigin(port), 'POST', JSON.stringify({ urls: articleUrls, operator: 'operator', caseName: 'Not writable' }))).status, 405);
  assert.equal((await request(port, '/api/corpus', { Host: `attacker.example:${port}` })).status, 403);
  assert.equal((await request(port, '/api/corpus', { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { 'Sec-Fetch-Site': 'same-site' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { Host: `localhost:${port}`, Origin: `http://localhost:${port}` })).status, 200);
  assert.equal((await request(port, '/api/corpus', { Origin: `http://localhost:${port}` })).status, 403);
  const head = await request(port, '/api/corpus', {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('AC-05 CLI accepts only explicit port and absolute mutually exclusive private options', () => {
  const corpusFile = path.resolve('private', 'corpus.json'), store = path.resolve('private', 'store');
  assert.deepEqual(parseArguments([]), { port: 4173 });
  assert.deepEqual(parseArguments(['--port', '1234', '--corpus', corpusFile]), {
    port: 1234, corpusFile,
  });
  assert.deepEqual(parseArguments(['--store', store]), { port: 4173, store });
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', '1.5'],
    ['--port', '1234', '--port', '1235'], ['--host', '0.0.0.0'], ['--corpus', 'relative.json'],
    ['--store', 'relative'], ['--store', '/private/../store'], ['--corpus', '/private/corpus.json', '--store', '/private/store']]) {
    assert.throws(() => parseArguments(args));
  }
});

for (const option of ['--corpus', '--store']) {
  test(`Issue #79 AC-03 Windows rejects ${option} before touching private storage`, {
    skip: process.platform !== 'win32' ? 'Native Windows rejection boundary' : false,
  }, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'workbench #%-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const privatePath = path.join(directory, 'not-created');
    await assert.rejects(createPreviewServer(option === '--store' ? { store: privatePath } : { corpusFile: privatePath }), {
      code: 'UNSUPPORTED_PLATFORM',
    });
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/server.mjs', import.meta.url)), option, privatePath], {
      cwd: directory, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 1);
    assert.match(child.stderr, /require POSIX filesystem permissions.*WSL2/);
    assert.equal(child.stdout, '');
    await assert.rejects(lstat(privatePath), { code: 'ENOENT' });
  });
}

privateStoreTest('Issue #39 AC-01/02/05 web collects three articles with partial failure, pending links, idempotency and reload persistence', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  const port = await start(t, { store, intakeDeps: transport() });
  const empty = await request(port, '/api/corpus');
  assert.equal(empty.status, 200); assert.deepEqual(JSON.parse(empty.body), emptyCorpus());
  assert.equal(empty.headers['x-collection-enabled'], 'true');
  const input = { urls: [...articleUrls, 'https://socket.dev/failed'], caseName: 'Synthetic web campaign', operator: 'web-operator' };
  const result = await request(port, '/api/intake', sameOrigin(port), 'POST', JSON.stringify(input));
  assert.equal(result.status, 200);
  const batch = JSON.parse(result.body);
  assert.equal(batch.results.length, 4);
  assert.deepEqual(batch.results.map(item => item.status), ['collected', 'collected with image warnings', 'collected', 'failed']);
  assert.ok(batch.results[1].warnings.length);
  assert.equal(batch.results[3].code, 'ACCESS_DENIED');
  const loaded = JSON.parse((await request(port, '/api/corpus')).body);
  const campaign = loaded.cases.find(item => item.id === batch.caseId);
  assert.equal(campaign.disposition, 'Pending'); assert.equal(campaign.sourceIds.length, 3);
  assert.equal(loaded.sourceRevisions.length, 3); assert.equal(loaded.reviews.length, 0);
  assert.deepEqual(campaign.sourceIds.map(id => loaded.sources.find(source => source.id === id).publisher).sort(), ['Red Canary', 'Socket', 'StepSecurity']);
  assert.deepEqual(validateCorpus(loaded), []);
  const repeated = JSON.parse((await request(port, '/api/intake', sameOrigin(port), 'POST',
    JSON.stringify({ urls: [...articleUrls, articleUrls[0]], caseId: batch.caseId, operator: 'web-operator' }))).body);
  assert.equal(repeated.results.length, 4);
  assert.ok(repeated.results.every(item => ['already present', 'collected with image warnings'].includes(item.status)));
  const secondPort = await start(t, { store, intakeDeps: transport() });
  const reloaded = JSON.parse((await request(secondPort, '/api/corpus')).body);
  assert.equal(reloaded.sourceRevisions.length, 3);
  assert.deepEqual(reloaded.cases.find(item => item.id === batch.caseId).sourceIds, campaign.sourceIds);
  const snapshot = await start(t, { corpusFile: path.join(store, 'corpus.json') });
  assert.equal((await request(snapshot, '/api/intake', sameOrigin(snapshot), 'POST', JSON.stringify(input))).status, 405);
  assert.equal((await request(snapshot, '/api/corpus')).headers['x-collection-enabled'], undefined);
});

privateStoreTest('Issue #39 AC-05 intake enforces exact host/origin, fetch metadata, JSON fields, body bounds and no concurrent writes', async t => {
  const store = path.join(await workspace(t), 'store');
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const port = await start(t, { store, intakeDeps: transport(async (_input, respond) => {
    entered(); await gate; return respond('<article><h1>Bounded synthetic article</h1><p>Text.</p></article>');
  }) });
  const input = { urls: [articleUrls[0]], caseName: 'Boundary fixture', operator: 'operator' }, body = JSON.stringify(input);
  for (const headers of [
    { 'Content-Type': 'application/json' },
    { ...sameOrigin(port), Origin: `http://localhost:${port}` },
    { ...sameOrigin(port), Host: `attacker.example:${port}` },
    { ...sameOrigin(port), Origin: 'null' },
    { ...sameOrigin(port), 'Sec-Fetch-Site': 'none' },
    { ...sameOrigin(port), 'Sec-Fetch-Site': 'same-site' },
    { ...sameOrigin(port), 'Sec-Fetch-Site': 'cross-site' },
  ]) assert.equal((await request(port, '/api/intake', headers, 'POST', body)).status, 403);
  for (const headers of [
    { ...sameOrigin(port), 'Content-Type': 'text/plain' },
    { ...sameOrigin(port), 'Content-Encoding': 'gzip' },
  ]) assert.equal((await request(port, '/api/intake', headers, 'POST', body)).status, 415);
  for (const value of [
    { ...input, store: '/arbitrary/path' }, { ...input, unknown: true }, { ...input, caseId: 'also-selected' },
    { ...input, urls: [] }, { ...input, urls: Array(21).fill(articleUrls[0]) },
    { ...input, operator: 'invalid operator' }, { ...input, caseName: null }, [], null,
    { ...input, caseName: 'a'.repeat(201) }, { ...input, caseName: 'control\ncharacter' },
  ]) assert.equal((await request(port, '/api/intake', sameOrigin(port), 'POST', JSON.stringify(value))).status, 400);
  assert.equal((await request(port, '/api/intake', sameOrigin(port), 'POST', '{invalid')).status, 400);
  assert.equal((await request(port, '/api/intake', { ...sameOrigin(port), 'Content-Length': WEB_INTAKE_LIMITS.bodyBytes + 1 }, 'POST')).status, 413);
  const oversized = await request(port, '/api/intake', { ...sameOrigin(port), 'Transfer-Encoding': 'chunked' }, 'POST', 'x'.repeat(WEB_INTAKE_LIMITS.bodyBytes + 1));
  assert.equal(oversized.status, 413, oversized.body);
  const pending = request(port, '/api/intake', sameOrigin(port), 'POST', body);
  await started;
  try { assert.equal((await request(port, '/api/intake', sameOrigin(port), 'POST', body)).status, 409); }
  finally { release(); }
  assert.equal((await pending).status, 200);
  const invalidCase = await request(port, '/api/intake', sameOrigin(port), 'POST',
    JSON.stringify({ urls: [articleUrls[0]], caseId: 'unknown-case', operator: 'operator' }));
  assert.equal(invalidCase.status, 400); assert.match(invalidCase.body, /NOT_FOUND/);
  const server = await createPreviewServer({ store });
  assert.equal(server.headersTimeout, 10_000); assert.equal(server.requestTimeout, 15_000);
  assert.equal(server.keepAliveTimeout, 5_000);
});

privateStoreTest('Issue #39 AC-05 incomplete JSON body times out and releases the write guard', async t => {
  const store = path.join(await workspace(t), 'store'), port = await start(t, { store, intakeDeps: transport() });
  const timed = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/intake', method: 'POST',
      headers: { ...sameOrigin(port), 'Content-Length': '100' } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.write('{');
  });
  assert.equal(timed.status, 408); assert.match(timed.body, /timed out/);
  const collected = await request(port, '/api/intake', { Origin: `http://127.0.0.1:${port}`, 'Content-Type': 'application/json' }, 'POST',
    JSON.stringify({ urls: [articleUrls[0]], caseName: 'After timeout', operator: 'operator' }));
  assert.equal(collected.status, 200); assert.equal(JSON.parse(collected.body).results[0].status, 'collected');
});

privateStoreTest('Issue #39 AC-03/05 archive artifacts are allowlisted attachments, never executable HTML or arbitrary files', async t => {
  const store = path.join(await workspace(t), 'store');
  const port = await start(t, { store, intakeDeps: transport() });
  const batch = JSON.parse((await request(port, '/api/intake', sameOrigin(port), 'POST',
    JSON.stringify({ urls: [articleUrls[0]], caseName: 'Archive fixture', operator: 'operator' }))).body);
  const { sourceId, revisionId } = batch.results[0], prefix = `/api/archive/${sourceId}/${revisionId}/`;
  for (const artifact of ['original.html', 'article.txt', 'metadata.json', 'assets.json']) {
    const response = await request(port, prefix + artifact);
    assert.equal(response.status, 200, artifact);
    assert.equal(response.headers['content-type'], 'application/octet-stream');
    assert.equal(response.headers['content-disposition'], `attachment; filename="${artifact}"`);
    assert.match(response.headers['content-security-policy'], /^sandbox; default-src 'none'/);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['access-control-allow-origin'], undefined);
    if (artifact === 'original.html') assert.match(response.body, /<script>/);
    if (artifact === 'article.txt') assert.match(response.body, /Retained synthetic source text/);
    const head = await request(port, prefix + artifact, {}, 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, '');
  }
  for (const suffix of ['../corpus.json', '%2e%2e/corpus.json', 'snapshot.html', 'images/one.png', 'original.html?inline=true', 'corpus.json']) {
    assert.equal((await request(port, prefix + suffix)).status, 404);
  }
  assert.equal((await request(port, `/api/archive/${sourceId}/source-revision-${'0'.repeat(64)}/original.html`)).status, 404);
  assert.equal((await request(port, prefix + 'original.html', { Origin: 'https://attacker.example' })).status, 403);
});

test('AC-04/05 preview serves every required offline entrypoint, module and brand asset with correct MIME types', async t => {
  const port = await start(t);
  for (const [url, mime] of [
    ['/', 'text/html'], ['/src/index.html', 'text/html'], ['/src/style.css', 'text/css'], ['/src/theme.js', 'text/javascript'],
    ['/src/app.mjs', 'text/javascript'], ['/src/model.mjs', 'text/javascript'],
    ['/src/render.mjs', 'text/javascript'], ['/src/studio.mjs', 'text/javascript'], ['/src/explore.mjs', 'text/javascript'], ['/docs/assets/logo.svg', 'image/svg+xml'],
    ['/src/campaign-presentation.mjs', 'text/javascript'], ['/src/graph-geometry.mjs', 'text/javascript'],
    ['/docs/assets/favicon.svg', 'image/svg+xml'], ['/docs/assets/logo-dark.svg', 'image/svg+xml'],
  ]) {
    const response = await request(port, url);
    assert.equal(response.status, 200, url);
    assert.equal(response.headers['content-type'], `${mime}; charset=utf-8`, url);
    assert.ok(response.body.length > 0, url);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(response.headers['content-security-policy'], /script-src 'self'/);
    assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
    assert.match(response.headers['content-security-policy'], /object-src 'none'/);
  }
});

privateStoreTest('private enrichment endpoint validates pending sidecars, fails closed and never changes canonical records', async t => {
  const store = await workspace(t);
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  const corpusFile = path.join(store, 'corpus.json'), original = canonicalSerialize(corpus);
  await writeFile(corpusFile, original, { mode: 0o600 });
  const port = await start(t, { store });
  assert.deepEqual(JSON.parse((await request(port, '/api/enrichment')).body), { schemaVersion: 'talk-enrichment/1', annotations: [] });
  const document = createEnrichmentTemplate({ corpus, caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a', sourceRevisionId: 'synthetic-revision-a' });
  const directory = path.join(store, 'enrichment'), file = path.join(directory, 'annotations.json');
  await mkdir(directory, { mode: 0o700 }); await writeFile(file, canonicalSerialize(document), { mode: 0o600 });
  const loaded = await request(port, '/api/enrichment'); assert.equal(loaded.status, 200);
  assert.equal(JSON.parse(loaded.body).annotations.length, 8);
  assert.ok(JSON.parse(loaded.body).annotations.every(a => a.status === 'pending'));
  assert.equal((await request(port, '/api/enrichment', { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request(port, '/api/enrichment', sameOrigin(port), 'POST', '{}')).status, 405);
  document.annotations[0].sourceRevisionId = 'missing';
  await writeFile(file, canonicalSerialize(document), { mode: 0o600 });
  assert.equal((await request(port, '/api/enrichment')).status, 500);
  assert.equal((await request(port, '/api/corpus')).status, 200);
  assert.equal(await readFile(corpusFile, 'utf8'), original);
});

test('synthetic research demo is schema-valid, visibly synthetic, and never enables collection', async t => {
  const port = await start(t), result = await request(port, '/api/demo-research');
  assert.equal(result.status, 200); const corpus = JSON.parse(result.body);
  assert.deepEqual(validateCorpus(corpus), []); assert.ok(corpus.governance.synthetic);
  assert.equal(corpus.paths.length, 1); assert.equal(result.headers['x-collection-enabled'], undefined);
});

privateStoreTest('Issue #45 campaign routes use the shared prepare/apply/status/export API with bounded same-origin JSON only', async t => {
  const store = path.join(await workspace(t), 'store');
  await mkdir(store, { mode: 0o700 });
  const corpus = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  await writeFile(path.join(store, 'corpus.json'), canonicalSerialize(corpus), { mode: 0o600 });
  const port = await start(t, { store });
  const preparedResponse = await request(port, '/api/campaign/prepare', sameOrigin(port), 'POST',
    JSON.stringify({ caseId: 'synthetic-case-a' }));
  assert.equal(preparedResponse.status, 200, preparedResponse.body);
  const prepared = JSON.parse(preparedResponse.body);
  assert.equal(prepared.status, 'succeeded');
  assert.equal(prepared.request.schemaVersion, 'campaign-request/2');
  assert.equal(prepared.request.provider.requestedModel, null);
  const candidate = {
    schemaVersion: 'campaign-candidate/1', requestHash: prepared.request.requestHash,
    model: { effectiveModel: null, version: null, nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
    coverage: prepared.request.inputs.flatMap(input => input.segments.map(segment => ({
      segmentId: segment.id, status: 'completed', reason: null,
    }))),
    claims: [], absences: [], limitations: ['Synthetic route exercise; no semantic enrichment.'],
  };
  const imported = await request(port, '/api/campaign/import', sameOrigin(port), 'POST',
    JSON.stringify({ request: prepared.request, candidate }));
  assert.equal(imported.status, 200, imported.body);
  assert.equal(JSON.parse(imported.body).status, 'succeeded');
  const status = JSON.parse((await request(port, '/api/campaign/status?case=synthetic-case-a')).body);
  assert.equal(status.pending, true); assert.equal(status.runs.length, 1);
  assert.equal(status.runs[0].provider.effectiveModel, null);
  const exported = await request(port, '/api/campaign/export', sameOrigin(port), 'POST',
    JSON.stringify({ caseId: 'synthetic-case-a', format: 'json' }));
  assert.equal(exported.status, 200); assert.equal(JSON.parse(exported.body).schemaVersion, 'campaign-talk-bundle/1');
  assert.equal(JSON.parse(exported.body).runs.length, 1);
  const markdown = await request(port, '/api/campaign/export', sameOrigin(port), 'POST',
    JSON.stringify({ caseId: 'synthetic-case-a', format: 'md' }));
  assert.equal(markdown.status, 200); assert.match(markdown.headers['content-type'], /^text\/markdown/);
  assert.match(markdown.body, /## runs/);
  const annotations = JSON.parse((await request(port, '/api/enrichment')).body);
  assert.ok(['talk-enrichment/1', 'campaign-projection/1'].includes(annotations.schemaVersion));
  assert.ok(Array.isArray(annotations.annotations));

  assert.equal((await request(port, '/api/campaign/prepare', { 'Content-Type': 'application/json' }, 'POST',
    JSON.stringify({ caseId: 'synthetic-case-a' }))).status, 403);
  assert.equal((await request(port, '/api/campaign/prepare', sameOrigin(port), 'POST',
    JSON.stringify({ caseId: 'synthetic-case-a', command: 'export', outputFile: '/arbitrary' }))).status, 400);
  assert.equal((await request(port, '/api/campaign/status?case=synthetic-case-a&path=/arbitrary')).status, 400);
  assert.equal((await request(port, '/api/campaign/import',
    { ...sameOrigin(port), 'Content-Length': CAMPAIGN_LIMITS.bodyBytes + 1 }, 'POST')).status, 413);
});
