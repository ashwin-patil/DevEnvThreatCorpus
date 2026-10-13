import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPreviewServer, emptyCorpus, parseArguments, WEB_INTAKE_LIMITS } from '../scripts/server.mjs';
import { canonicalSerialize, validateCorpus } from '../scripts/contract.mjs';

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
  const root = new URL('../.private-intake/', import.meta.url);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(path.join(root.pathname, 'web-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const sameOrigin = port => ({ Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' });
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

test('AC-05 private source records are validated and held as a read-only startup snapshot', async t => {
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
  assert.deepEqual(parseArguments([]), { port: 4173 });
  assert.deepEqual(parseArguments(['--port', '1234', '--corpus', '/tmp/private/corpus.json']), {
    port: 1234, corpusFile: '/tmp/private/corpus.json',
  });
  assert.deepEqual(parseArguments(['--store', '/private/store']), { port: 4173, store: '/private/store' });
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', '1.5'],
    ['--port', '1234', '--port', '1235'], ['--host', '0.0.0.0'], ['--corpus', 'relative.json'],
    ['--store', 'relative'], ['--store', '/private/../store'], ['--corpus', '/private/corpus.json', '--store', '/private/store']]) {
    assert.throws(() => parseArguments(args));
  }
});

test('Issue #39 AC-01/02/05 web collects three articles with partial failure, pending links, idempotency and reload persistence', async t => {
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

test('Issue #39 AC-05 intake enforces exact host/origin, fetch metadata, JSON fields, body bounds and no concurrent writes', async t => {
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

test('Issue #39 AC-05 incomplete JSON body times out and releases the write guard', async t => {
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

test('Issue #39 AC-03/05 archive artifacts are allowlisted attachments, never executable HTML or arbitrary files', async t => {
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
    ['/', 'text/html'], ['/src/index.html', 'text/html'], ['/src/style.css', 'text/css'],
    ['/src/app.mjs', 'text/javascript'], ['/src/model.mjs', 'text/javascript'],
    ['/src/render.mjs', 'text/javascript'], ['/src/studio.mjs', 'text/javascript'], ['/docs/assets/logo.svg', 'image/svg+xml'],
    ['/docs/assets/favicon.svg', 'image/svg+xml'],
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
