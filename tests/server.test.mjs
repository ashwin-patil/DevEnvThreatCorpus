import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPreviewServer, emptyCorpus, parseArguments } from '../scripts/server.mjs';
import { canonicalSerialize, validateCorpus } from '../scripts/contract.mjs';

async function start(t, options) {
  const server = await createPreviewServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

function request(port, url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, headers, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
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
  const directory = await mkdtemp(path.join(os.tmpdir(), 'workbench-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
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
  assert.equal((await request(port, '/api/corpus', { Host: `attacker.example:${port}` })).status, 403);
  assert.equal((await request(port, '/api/corpus', { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { 'Sec-Fetch-Site': 'same-site' })).status, 403);
  assert.equal((await request(port, '/api/corpus', { Host: `localhost:${port}`, Origin: `http://localhost:${port}` })).status, 200);
  const head = await request(port, '/api/corpus', {}, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
});

test('AC-05 CLI accepts only explicit port and absolute corpus options', () => {
  assert.deepEqual(parseArguments([]), { port: 4173 });
  assert.deepEqual(parseArguments(['--port', '1234', '--corpus', '/tmp/private/corpus.json']), {
    port: 1234, corpusFile: '/tmp/private/corpus.json',
  });
  for (const args of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port', '1.5'],
    ['--port', '1234', '--port', '1235'], ['--host', '0.0.0.0'], ['--corpus', 'relative.json']]) {
    assert.throws(() => parseArguments(args));
  }
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
