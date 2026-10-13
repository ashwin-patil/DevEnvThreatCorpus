import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  intakeSource, validatePrivateCorpus, intakeUrl, isPublicAddress, readableHtml, INTAKE_LIMITS,
  HTML_PARSER_VERSION, TEXT_PARSER_VERSION, NORMALIZATION_VERSION, URL_NORMALIZATION_VERSION,
  sha256, normalizeText, canonicalSerialize, stableId, validateCorpus,
} from '../scripts/contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = name => fileURLToPath(new URL(`./fixtures/intake/${name}`, import.meta.url));
const storageRoot = path.join(root, '.private-intake');
const operator = 'synthetic-operator';
const url = 'https://articles.example/synthetic?id=7';
const publicIP = '93.184.216.34';
const cli = args => {
  const result = spawnSync(process.execPath, ['scripts/contract.mjs', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.stderr, '');
  return { ...result, result: JSON.parse(result.stdout) };
};
async function workspace(t) {
  await fs.mkdir(storageRoot, { recursive: true, mode: 0o700 });
  const directory = path.join(storageRoot, `test-${randomUUID()}`);
  await fs.mkdir(directory, { mode: 0o700 });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
const corpusAt = directory => validatePrivateCorpus(path.join(directory, 'corpus.json'));
const supplied = (store, text = 'Synthetic content.') => ({ kind: 'text', text, suppliedBy: operator, store });
function response(text = 'Synthetic URL content.', options = {}) {
  return {
    status: options.status ?? 200,
    headers: options.headers ?? { 'content-type': 'text/plain; charset=utf-8' },
    peerAddress: options.peerAddress ?? publicIP,
    body: options.body ?? (async function* () { yield Buffer.from(text); })(),
    close: options.close ?? (() => {}),
  };
}
function fake(article = () => response(), options = {}) {
  const calls = [];
  return {
    calls,
    resolve: options.resolve ?? (async () => [{ address: publicIP, family: 4 }]),
    request: async request => {
      calls.push(request);
      if (new URL(request.url).pathname === '/robots.txt') return options.robots?.(request) ?? response('', { status: 404 });
      return article(request, calls);
    },
    ...options.clock,
  };
}
const urlInput = store => ({ kind: 'url', url, suppliedBy: operator, store });
const checkFailure = async (store, input, deps, code) => {
  const result = await intakeSource(input, deps);
  assert.equal(result.status, 'failed');
  assert.equal(result.code, code);
  const corpus = await corpusAt(store);
  assert.equal(corpus.sourceRevisions.length, 0);
  assert.equal(corpus.collectionManifests.at(-1).outcome, 'Failed');
  assert.equal(corpus.collectionManifests.at(-1).inputRevisionIds.length, 0);
  assert.deepEqual(validateCorpus(corpus), []);
  return corpus;
};

test('AC-01 CLI text/file/validation and injected HTTPS create valid private source-only records', async t => {
  const directory = await workspace(t);
  const textStore = path.join(directory, 'text');
  const text = cli(['intake', 'text', '--text', 'Synthetic cafe\u0301\r\n🌿', '--supplied-by', operator, '--store', textStore]);
  assert.equal(text.status, 0);
  assert.equal(text.result.status, 'succeeded');
  const textCorpus = await corpusAt(textStore);
  assert.equal(textCorpus.sources[0].originalUrl, null);
  assert.equal(textCorpus.sources[0].provenance.kind, 'supplied-text');
  assert.equal(textCorpus.sources[0].provenance.suppliedBy, operator);
  assert.equal(textCorpus.sourceRevisions[0].normalizedContent, 'Synthetic café\n🌿');
  const fileStore = path.join(directory, 'file');
  assert.equal(cli(['intake', 'file', '--file', fixture('benign.txt'), '--supplied-by', operator, '--store', fileStore]).status, 0);
  assert.equal((await corpusAt(fileStore)).sources[0].inputKind, 'text-file');
  assert.deepEqual(cli(['validate', '--file', path.join(fileStore, 'corpus.json')]).result, { status: 'succeeded', code: 'VALID' });
  const urlStore = path.join(directory, 'url');
  const transport = fake();
  assert.equal((await intakeSource(urlInput(urlStore), transport)).status, 'succeeded');
  assert.deepEqual(transport.calls.map(c => new URL(c.url).pathname), ['/robots.txt', '/synthetic']);
  assert.ok(transport.calls.every(c => c.address === publicIP && c.family === 4 && c.signal instanceof AbortSignal));
  assert.equal((await corpusAt(urlStore)).sourceRevisions[0].retention, 'private');
});

test('AC-02 missing metadata/date fields remain honest; successful URL alone records retrieval day', async t => {
  const directory = await workspace(t);
  for (const kind of ['text', 'url']) {
    const store = path.join(directory, kind);
    const deps = fake(undefined, { clock: { now: () => Date.parse('2026-10-12T12:34:56Z') } });
    await intakeSource(kind === 'text' ? supplied(store) : urlInput(store), deps);
    const corpus = await corpusAt(store), source = corpus.sources[0];
    for (const field of ['title', 'publisher', 'author']) {
      assert.equal(source[field], null);
      assert.equal(source.nullReasons[field], 'not_reported');
    }
    for (const field of ['publicationDate', 'updateDate']) assert.equal(source[field].precision, 'unknown');
    assert.equal(source.retrievalDate.precision, kind === 'url' ? 'day' : 'unknown');
    if (kind === 'url') assert.equal(source.retrievalDate.value, '2026-10-12');
    assert.equal(source.extractionStatus, 'Not started');
    assert.equal(source.collectionState, 'Collected');
    for (const field of ['cases', 'claims', 'passages', 'reviews', 'timelines', 'categorizations']) assert.deepEqual(corpus[field], []);
  }
  const failed = await checkFailure(path.join(directory, 'denied'), urlInput(path.join(directory, 'denied')), fake(() => response('', { status: 403 })), 'ACCESS_DENIED');
  assert.equal(failed.sources[0].retrievalDate.precision, 'unknown');
});

test('AC-03 exact reruns are byte-identical; URL changes preserve revisions and unrelated data', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  const first = await intakeSource(urlInput(store), fake(() => response('Version one')));
  const before = await fs.readFile(path.join(store, 'corpus.json'), 'utf8');
  const repeated = await intakeSource({ ...urlInput(store), url: `${url}&utm_source=tracking#fragment` }, fake(() => response('Version one')));
  assert.deepEqual(repeated, first);
  assert.equal(await fs.readFile(path.join(store, 'corpus.json'), 'utf8'), before);
  const changed = await intakeSource(urlInput(store), fake(() => response('Version two')));
  assert.equal(changed.sourceId, first.sourceId);
  assert.notEqual(changed.revisionId, first.revisionId);
  const corpus = await corpusAt(store);
  assert.equal(corpus.sources.length, 1);
  assert.equal(corpus.sourceRevisions.length, 2);
  assert.ok(corpus.sources[0].revisionIds.includes(first.revisionId));
  assert.equal(corpus.sourceRevisions.find(r => r.id === first.revisionId).rawContent, 'Version one');
  assert.equal((await intakeSource({ ...urlInput(store), url: 'https://articles.example/synthetic?id=8' }, fake())).status, 'succeeded');
  await intakeSource(supplied(store, 'Unrelated supplied source'));
  const preserved = await corpusAt(store);
  assert.equal(preserved.sources.length, 3);
  assert.equal(preserved.sourceRevisions.length, 4);
  assert.deepEqual(preserved.sourceRevisions.find(r => r.id === first.revisionId), corpus.sourceRevisions.find(r => r.id === first.revisionId));
  assert.equal(preserved.collectionManifests[0].toolVersion, 'manual-intake/1');
  assert.ok(preserved.collectionManifests.every(m => m.limitations.includes(`url-normalization=${URL_NORMALIZATION_VERSION}`)));
  const existingStore = path.join(directory, 'existing');
  await fs.mkdir(existingStore, { mode: 0o700 });
  const prior = JSON.parse(await fs.readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  await fs.writeFile(path.join(existingStore, 'corpus.json'), canonicalSerialize(prior), { mode: 0o600 });
  assert.equal((await intakeSource(supplied(existingStore, 'Additional synthetic source'))).status, 'succeeded');
  const extended = await corpusAt(existingStore);
  for (const collection of ['sources', 'sourceRevisions', 'collectionManifests', 'cases', 'claims', 'passages', 'timelines', 'reviews', 'categorizations']) {
    for (const record of prior[collection]) assert.deepEqual(extended[collection].find(r => r.id === record.id), record);
  }
});

test('AC-03 raw text/file identities do not merge changed bytes, and collision guards reject reused identities', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  const first = await intakeSource(supplied(store, 'a\r\nb'));
  assert.deepEqual(await intakeSource(supplied(store, 'a\r\nb')), first);
  const different = await intakeSource(supplied(store, 'a\nb'));
  assert.notEqual(different.sourceId, first.sourceId);
  const corpus = await corpusAt(store);
  corpus.sources[0].canonicalUrl = 'https://articles.example/other';
  corpus.sources[0].originalUrl = corpus.sources[0].canonicalUrl;
  delete corpus.sources[0].nullReasons.originalUrl;
  delete corpus.sources[0].nullReasons.canonicalUrl;
  await fs.writeFile(path.join(store, 'corpus.json'), canonicalSerialize(corpus), { mode: 0o600 });
  assert.equal((await intakeSource(supplied(store, corpus.sourceRevisions.find(r => r.sourceId === corpus.sources[0].id).rawContent))).code, 'IDENTITY_COLLISION');
});

test('AC-04 streaming exact limit succeeds; missing/misleading lengths and over-limit chunks fail', async t => {
  const directory = await workspace(t);
  assert.deepEqual(INTAKE_LIMITS, { bytes: 2097152, deadlineMs: 20000, retries: 2, redirects: 3 });
  const exactStore = path.join(directory, 'exact');
  const text = 'x'.repeat(INTAKE_LIMITS.bytes);
  assert.equal((await intakeSource(urlInput(exactStore), fake(() => response(text)))).status, 'succeeded');
  for (const [name, headers] of [
    ['missing', { 'content-type': 'text/plain; charset=utf-8' }],
    ['misleading', { 'content-type': 'text/plain; charset=utf-8', 'content-length': '1' }],
    ['declared', { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(INTAKE_LIMITS.bytes + 1) }],
  ]) {
    const store = path.join(directory, name);
    await checkFailure(store, urlInput(store), fake(() => response('', { headers, body: (async function* () {
      yield Buffer.from(text); yield Buffer.from('x');
    })() })), 'TOO_LARGE');
  }
  const mismatch = path.join(directory, 'length');
  await checkFailure(mismatch, urlInput(mismatch), fake(() => response('abc', { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-length': '4' } })), 'HTTP_STATUS');
});

test('AC-04 shared deadline bounds DNS, robots, reads and retries; only transient errors retry twice', async t => {
  const directory = await workspace(t);
  let attempts = 0;
  const eventual = fake(() => response('Recovered', { status: ++attempts < 3 ? 503 : 200 }));
  const recoveredStore = path.join(directory, 'retry');
  assert.equal((await intakeSource(urlInput(recoveredStore), eventual)).status, 'succeeded');
  assert.equal(attempts, 3);
  assert.ok((await corpusAt(recoveredStore)).collectionManifests[0].limitations.includes('retry-count=2'));
  const exhausted = fake(() => response('', { status: 503 }));
  const exhaustedStore = path.join(directory, 'exhausted');
  await checkFailure(exhaustedStore, urlInput(exhaustedStore), exhausted, 'NETWORK');
  assert.equal(exhausted.calls.filter(c => new URL(c.url).pathname !== '/robots.txt').length, 3);
  for (const stage of ['dns', 'robots', 'body']) {
    const store = path.join(directory, stage);
    let tick = 0;
    const options = { clock: { now: () => tick } };
    if (stage === 'dns') options.resolve = async () => { tick = 20000; return [{ address: publicIP, family: 4 }]; };
    if (stage === 'robots') options.robots = () => { tick = 20000; return response('', { status: 404 }); };
    const deps = fake(() => response('', { body: (async function* () { tick = 20000; yield Buffer.from('late'); })() }), options);
    await checkFailure(store, urlInput(store), deps, 'TIMEOUT');
  }
  const hangStore = path.join(directory, 'hanging');
  const start = Date.now();
  await checkFailure(hangStore, urlInput(hangStore), { ...fake(), resolve: () => new Promise(() => {}), deadlineMs: 15 }, 'TIMEOUT');
  assert.ok(Date.now() - start < 1000);
});

test('AC-04 supplied UTF-8 bytes are bounded and concurrently invoked intake is rejected', async t => {
  const directory = await workspace(t);
  const tooLarge = '🌿'.repeat(INTAKE_LIMITS.bytes / 4 + 1);
  const pastedStore = path.join(directory, 'paste');
  assert.equal((await intakeSource(supplied(pastedStore, tooLarge))).code, 'TOO_LARGE');
  const file = path.join(directory, 'too-large.txt');
  await fs.writeFile(file, tooLarge, { mode: 0o600 });
  const fileStore = path.join(directory, 'file');
  assert.equal((await intakeSource({ kind: 'file', file, suppliedBy: operator, store: fileStore })).code, 'TOO_LARGE');
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const store = path.join(directory, 'concurrent');
  const first = intakeSource(urlInput(store), fake(async () => { started(); await gate; return response('First'); }));
  await entered;
  const second = await intakeSource(supplied(store, 'Concurrent'));
  assert.deepEqual(second, { status: 'failed', code: 'STORE_BUSY' });
  release();
  assert.equal((await first).status, 'succeeded');
  assert.equal((await corpusAt(store)).sourceRevisions.length, 1);
});

test('AC-04/05 redirects are bounded and each target gets robots/DNS/peer validation', async t => {
  const directory = await workspace(t);
  const safeStore = path.join(directory, 'safe');
  const safe = fake(request => new URL(request.url).hostname === 'articles.example'
    ? response('', { status: 302, headers: { location: 'https://other.example/read' } }) : response('Redirected'));
  assert.equal((await intakeSource(urlInput(safeStore), safe)).status, 'succeeded');
  assert.equal(safe.calls.filter(c => new URL(c.url).pathname === '/robots.txt').length, 2);
  const loopingStore = path.join(directory, 'loop');
  const looping = fake(() => response('', { status: 302, headers: { location: '/again' } }));
  await checkFailure(loopingStore, urlInput(loopingStore), looping, 'REDIRECT_LIMIT');
  assert.equal(looping.calls.filter(c => new URL(c.url).pathname !== '/robots.txt').length, 4);
  for (const destination of ['http://articles.example/', 'file:///etc/passwd', 'https://127.0.0.1/', 'https://[::ffff:7f00:1]/']) {
    const store = path.join(directory, `redirect-${randomUUID()}`);
    const result = await intakeSource(urlInput(store), fake(() => response('', { status: 302, headers: { location: destination } })));
    assert.equal(result.status, 'failed');
    assert.ok(['UNSAFE_URL', 'UNSAFE_ADDRESS'].includes(result.code));
  }
  const malformedStore = path.join(directory, 'missing-location');
  await checkFailure(malformedStore, urlInput(malformedStore), fake(() => response('', { status: 302, headers: {} })), 'HTTP_STATUS');
});

test('AC-05 prohibited IPv4/IPv6, mixed DNS answers, rebinding and peer mismatches never pass', async t => {
  const prohibited = [
    '0.0.0.0', '0.1.2.3', '10.0.0.1', '100.64.1.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
    '172.31.255.255', '192.0.0.9', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1',
    '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:93.184.216.34', '::ffff:7f00:1', '64:ff9b::5db8:d822', '64:ff9b:1::1',
    '100::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1', '2001::1', '2001:2::1',
    '2001:db8::1', '2001:10::1', '2001:20::1', '2002:5db8:d822::1', '3ffe::1', '3fff::1', 'fe80::1%eth0',
  ];
  for (const ip of prohibited) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of [publicIP, '8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(ip), true, ip);
  const directory = await workspace(t);
  for (const [name, deps] of [
    ['mix', fake(undefined, { resolve: async () => [{ address: publicIP, family: 4 }, { address: '10.0.0.1', family: 4 }] })],
    ['private', fake(undefined, { resolve: async () => [{ address: 'fc00::1', family: 6 }] })],
    ['peer', fake(() => response('secret', { peerAddress: '127.0.0.1' }))],
    ['unresolved-peer', fake(() => response('secret', { peerAddress: '8.8.8.8' }))],
  ]) {
    const store = path.join(directory, name);
    await checkFailure(store, urlInput(store), deps, name.includes('peer') ? 'PEER_MISMATCH' : 'UNSAFE_ADDRESS');
    if (name === 'mix' || name === 'private') assert.equal(deps.calls.length, 0);
  }
  let lookups = 0;
  const rebind = fake(undefined, { resolve: async () => [{ address: ++lookups === 1 ? publicIP : '127.0.0.1', family: 4 }] });
  const rebindStore = path.join(directory, 'rebind');
  await checkFailure(rebindStore, urlInput(rebindStore), rebind, 'UNSAFE_ADDRESS');
  assert.equal(rebind.calls.length, 1);
  for (const literal of ['https://2130706433/', 'https://0x7f000001/', 'https://[::1]/', 'https://[2002:7f00:1::]/']) {
    const store = path.join(directory, `literal-${randomUUID()}`), transport = fake();
    assert.equal((await intakeSource({ ...urlInput(store), url: literal }, transport)).code, 'UNSAFE_ADDRESS');
    assert.equal(transport.calls.length, 0);
  }
  const ipv6Store = path.join(directory, 'ipv6');
  const ipv6Deps = {
    resolve: async () => [{ address: '2606:4700:4700::1111', family: 6 }],
    request: async request => response('Public IPv6', {
      status: new URL(request.url).pathname === '/robots.txt' ? 404 : 200,
      peerAddress: '2606:4700:4700:0:0:0:0:1111',
    }),
  };
  assert.equal((await intakeSource(urlInput(ipv6Store), ipv6Deps)).status, 'succeeded');
});

test('AC-05 credential/sensitive query/executable URLs fail safely; meaningful parameters survive', async t => {
  const directory = await workspace(t);
  for (const inputUrl of [
    'https://synthetic-user@articles.example/', 'https://articles.example/?access_token=SECRET',
    'https://articles.example/?api_key=SECRET', 'https://articles.example/?signature=SECRET',
    'javascript:globalThis.bad=true', 'https://articles.example:8443/', 'https://articles.example/\\x',
  ]) {
    const store = path.join(directory, `bad-${randomUUID()}`), transport = fake();
    const result = await intakeSource({ ...urlInput(store), url: inputUrl }, transport);
    assert.equal(result.code, 'UNSAFE_URL');
    assert.equal(transport.calls.length, 0);
    const corpus = await corpusAt(store);
    assert.equal(corpus.sources.length, 0);
    assert.ok(!JSON.stringify(corpus.collectionManifests).includes('SECRET'));
    assert.ok(!JSON.stringify(result).includes(inputUrl));
  }
  assert.equal(intakeUrl('https://articles.example/read?id=7&utm_source=x#frag'), 'https://articles.example/read?id=7');
  assert.notEqual(intakeUrl('https://articles.example/read?id=7'), intakeUrl('https://articles.example/read?id=8'));
});

test('Issue #30 AC-01 robots informational directives allow otherwise permitted intake', async t => {
  const directory = await workspace(t);
  for (const [name, policy] of [
    ['host', 'Host: other.example\nUser-agent: *\nAllow: /synthetic'],
    ['content-signal', 'User-agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /synthetic'],
    ['clean-param', 'User-agent: *\nAllow: /synthetic\nClean-param: id /synthetic'],
    ['combined', 'hOsT: other.example # informational only\nUser-agent: *\nContent-Signal: search=yes, ai-train=no\nUser-agent: DevEnvThreatCorpusIntake\nDisallow: /\nClean-param: id /synthetic\nAllow: /synthetic'],
  ]) {
    const store = path.join(directory, name);
    const deps = fake(undefined, { robots: () => response(policy) });
    assert.equal((await intakeSource(urlInput(store), deps)).status, 'succeeded');
    assert.deepEqual(deps.calls.map(c => c.url), ['https://articles.example/robots.txt', url]);
    assert.equal((await corpusAt(store)).sources[0].originalUrl, url);
  }
});

test('AC-05 robots fail closed without override, including access restrictions and unsupported policies', async t => {
  const directory = await workspace(t);
  for (const [name, robots, expected] of [
    ['deny', response('User-agent: *\nDisallow: /synthetic'), 'ROBOTS_DENIED'],
    ['agent', response('User-agent: DevEnvThreatCorpusIntake\nDisallow: /'), 'ROBOTS_DENIED'],
    ['unsupported', response('User-agent: *\nDisallow: /*secret'), 'ROBOTS_UNSUPPORTED'],
    ['allow-wildcard', response('Host: articles.example\nUser-agent: *\nAllow: /synthetic*'), 'ROBOTS_UNSUPPORTED'],
    ['end-anchor', response('Content-Signal: search=yes\nUser-agent: *\nDisallow: /synthetic$'), 'ROBOTS_UNSUPPORTED'],
    ['unparsed-agent', response('Host: articles.example\nUser-agent: Bad Agent\nAllow: /'), 'ROBOTS_UNSUPPORTED'],
    ['metadata-deny', response('User-agent: *\nDisallow: /synthetic\nHost: other.example\nContent-Signal: search=yes\nClean-param: id /synthetic\nUser-agent: DevEnvThreatCorpusIntake\nAllow: /'), 'ROBOTS_DENIED'],
    ['metadata-delay', response('Host: articles.example\nUser-agent: *\nCrawl-delay: 2'), 'ROBOTS_UNSUPPORTED'],
    ['unknown-directive', response('Host: articles.example\nUser-agent: *\nUnknown: value'), 'ROBOTS_UNSUPPORTED'],
    ['delay', response('User-agent: *\nCrawl-delay: 2'), 'ROBOTS_UNSUPPORTED'],
    ['auth', response('', { status: 401 }), 'ACCESS_DENIED'],
    ['cross-origin', response('', { status: 302, headers: { location: 'https://other.example/robots.txt' } }), 'ROBOTS_UNSUPPORTED'],
  ]) {
    const store = path.join(directory, name), deps = fake(undefined, { robots: () => robots });
    await checkFailure(store, urlInput(store), deps, expected);
    assert.equal(deps.calls.filter(c => new URL(c.url).pathname === '/synthetic').length, 0);
  }
  const allowedStore = path.join(directory, 'allowed');
  assert.equal((await intakeSource(urlInput(allowedStore), fake(undefined, { robots: () => response('User-agent: *\nDisallow: /\nAllow: /synthetic') }))).status, 'succeeded');
  const absentStore = path.join(directory, 'gone');
  assert.equal((await intakeSource(urlInput(absentStore), fake(undefined, { robots: () => response('', { status: 410 }) }))).status, 'succeeded');
});

test('AC-06 text/HTML Unicode normalization and raw hashes are deterministic, with no script execution', async t => {
  const directory = await workspace(t), store = path.join(directory, 'html');
  const raw = await fs.readFile(fixture('article.html'), 'utf8');
  assert.equal((await intakeSource(urlInput(store), fake(() => response(raw, { headers: { 'content-type': 'text/html; charset=utf-8' } })))).status, 'succeeded');
  const corpus = await corpusAt(store), revision = corpus.sourceRevisions[0];
  assert.equal(revision.rawContent, raw);
  assert.equal(revision.rawHash, sha256(raw));
  assert.equal(revision.normalizedContent, 'Synthetic & benign\nCafé 🌿 — readable text.\nSecond paragraph.');
  assert.equal(revision.normalizedHash, sha256(revision.normalizedContent));
  assert.equal(revision.parserVersion, HTML_PARSER_VERSION);
  assert.equal(revision.normalizationVersion, NORMALIZATION_VERSION);
  assert.equal(globalThis.intakeFixtureExecuted, undefined);
  assert.equal(readableHtml('<p>A &lt; B &copy; &#128512;</p>'), 'A < B © 😀');
  revision.normalizedContent = normalizeText(raw);
  revision.normalizedHash = sha256(revision.normalizedContent);
  assert.ok(validateCorpus(corpus).some(e => e.includes('transformation mismatch')));
  const splitStore = path.join(directory, 'split');
  const unicode = Buffer.from('\ufeffcafe\u0301\r\n🌿');
  const split = fake(() => response('', { body: (async function* () {
    for (const byte of unicode) yield Buffer.from([byte]);
  })() }));
  assert.equal((await intakeSource(urlInput(splitStore), split)).status, 'succeeded');
  const splitRevision = (await corpusAt(splitStore)).sourceRevisions[0];
  assert.equal(splitRevision.rawHash, sha256(unicode));
  assert.equal(splitRevision.normalizedContent, '\ufeffcafé\n🌿');
});

test('AC-06 malformed UTF-8/text/HTML and unsupported encodings/types fail explicitly', async t => {
  const directory = await workspace(t);
  for (const [name, article, expected] of [
    ['invalid-utf8', () => response('', { body: (async function* () { yield Buffer.from([0xc3, 0x28]); })() }), 'MALFORMED_TEXT'],
    ['nul', () => response('A\0B'), 'MALFORMED_TEXT'],
    ['empty', () => response(' \n'), 'EMPTY_CONTENT'],
    ['json', () => response('{}', { headers: { 'content-type': 'application/json' } }), 'UNSUPPORTED_TYPE'],
    ['no-charset', () => response('abc', { headers: { 'content-type': 'text/plain' } }), 'UNSUPPORTED_TYPE'],
    ['latin', () => response('abc', { headers: { 'content-type': 'text/plain; charset=iso-8859-1' } }), 'UNSUPPORTED_ENCODING'],
    ['ascii', () => response('café', { headers: { 'content-type': 'text/plain; charset=us-ascii' } }), 'UNSUPPORTED_ENCODING'],
    ['gzip', () => response('abc', { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-encoding': 'gzip' } }), 'UNSUPPORTED_ENCODING'],
    ...['<p>missing', '<p>bad &unknown;</p>', '<p>bad &amp</p>', '<p>&#0;</p>', '<p>&#xD800;</p>', '<p><b>x</p></b>', '<p title="&unknown;">x</p>', '<img src="x">', '<script>unclosed', '<span>'.repeat(129) + 'x' + '</span>'.repeat(129)].map((raw, i) => [`html-${i}`, () => response(raw, { headers: { 'content-type': 'text/html; charset=utf-8' } }), 'MALFORMED_HTML']),
  ]) {
    const store = path.join(directory, name);
    await checkFailure(store, urlInput(store), fake(article), expected);
  }
  const file = path.join(directory, 'invalid.txt');
  await fs.writeFile(file, Buffer.from([0xff]), { mode: 0o600 });
  const result = cli(['intake', 'file', '--file', file, '--supplied-by', operator, '--store', path.join(directory, 'invalid-file')]);
  assert.equal(result.status, 1);
  assert.equal(result.result.code, 'MALFORMED_TEXT');
  assert.equal((await intakeSource(supplied(path.join(directory, 'surrogate'), '\ud800'))).code, 'MALFORMED_TEXT');
});

test('AC-07 each failed attempt remains inspectable; CLI supplied-text fallback links URL without network', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  const deps = fake(() => response('', { status: 403 }));
  const one = await intakeSource(urlInput(store), deps), two = await intakeSource(urlInput(store), deps);
  assert.notEqual(one.manifestId, two.manifestId);
  assert.equal(one.sourceId, two.sourceId);
  const fallback = cli(['intake', 'text', '--text', 'Synthetic fallback.', '--source-url', url, '--supplied-by', operator, '--store', store]);
  assert.equal(fallback.status, 0);
  assert.equal(fallback.result.sourceId, one.sourceId);
  const corpus = await corpusAt(store);
  assert.equal(corpus.sources.length, 1);
  assert.equal(corpus.sourceRevisions.length, 1);
  assert.equal(corpus.collectionManifests.length, 3);
  assert.equal(corpus.collectionManifests.filter(m => m.outcome === 'Failed').length, 2);
  assert.equal(corpus.sourceRevisions[0].provenance.kind, 'supplied-text');
  assert.equal(corpus.sourceRevisions[0].parserVersion, TEXT_PARSER_VERSION);
  assert.equal(corpus.sources[0].retrievalDate.precision, 'unknown');
  const fileFallback = cli(['intake', 'file', '--file', fixture('benign.txt'), '--source-url', url, '--supplied-by', operator, '--store', store]);
  assert.equal(fileFallback.status, 0);
  assert.equal(fileFallback.result.sourceId, one.sourceId);
  assert.equal((await corpusAt(store)).sourceRevisions.length, 2);
  const failureCli = cli(['intake', 'url', '--url', 'http://invalid.example/', '--supplied-by', operator, '--store', store]);
  assert.equal(failureCli.status, 1);
  assert.equal(failureCli.result.code, 'UNSAFE_URL');
  assert.ok(!failureCli.stdout.includes('invalid.example'));
});

test('AC-08 private modes, safe paths, symlinks/hardlinks, public files and busy locks are enforced', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  await intakeSource(supplied(store));
  assert.equal((await fs.stat(store)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(store, 'corpus.json'))).mode & 0o777, 0o600);
  for (const badStore of ['relative', `${directory}/../escape`, path.join(root, 'unauthorized-intake')]) assert.equal((await intakeSource(supplied(badStore))).code, 'UNSAFE_PATH');
  const link = path.join(directory, 'linked');
  await fs.symlink(store, link);
  assert.equal((await intakeSource(supplied(link))).code, 'UNSAFE_PATH');
  const fileLink = path.join(directory, 'linked.txt');
  await fs.symlink(fixture('benign.txt'), fileLink);
  assert.equal((await intakeSource({ kind: 'file', file: fileLink, suppliedBy: operator, store: path.join(directory, 'file-link') })).code, 'UNSAFE_PATH');
  const publicStore = path.join(directory, 'public');
  await fs.mkdir(publicStore, { mode: 0o755 });
  assert.equal((await intakeSource(supplied(publicStore))).code, 'UNSAFE_PATH');
  const file = path.join(store, 'corpus.json');
  const original = await fs.readFile(file);
  await fs.chmod(file, 0o644);
  assert.equal((await intakeSource(supplied(store))).code, 'UNSAFE_PATH');
  await fs.chmod(file, 0o600);
  const hardlink = path.join(directory, 'hardlink.json');
  await fs.link(file, hardlink);
  assert.equal((await intakeSource(supplied(store))).code, 'UNSAFE_PATH');
  await fs.unlink(hardlink);
  await fs.writeFile(path.join(store, '.intake.lock'), '', { mode: 0o600 });
  assert.equal((await intakeSource(supplied(store))).code, 'STORE_BUSY');
  await fs.unlink(path.join(store, '.intake.lock'));
  assert.deepEqual(await fs.readFile(file), original);
  assert.equal((await intakeSource({ kind: 'file', file: directory, suppliedBy: operator, store: path.join(directory, 'directory-input') })).code, 'UNSAFE_PATH');
});

test('AC-08 corrupt states and persistence failures never overwrite data or leave success records', async t => {
  const directory = await workspace(t), store = path.join(directory, 'corrupt');
  await fs.mkdir(store, { mode: 0o700 });
  await fs.writeFile(path.join(store, 'corpus.json'), '{"broken":true}', { mode: 0o600 });
  assert.equal((await intakeSource(supplied(store))).code, 'INVALID_CORPUS');
  assert.equal(await fs.readFile(path.join(store, 'corpus.json'), 'utf8'), '{"broken":true}');
  assert.deepEqual(await fs.readdir(store), ['corpus.json']);
  assert.equal(cli(['validate', '--file', path.join(store, 'corpus.json')]).status, 1);
  const failedStore = path.join(directory, 'write');
  await intakeSource(supplied(failedStore, 'Prior revision'));
  const original = await fs.readFile(path.join(failedStore, 'corpus.json'));
  const malicious = fake(async () => {
    await fs.rename(failedStore, `${failedStore}-preserved`);
    await fs.symlink(`${failedStore}-preserved`, failedStore);
    return response('Must not persist');
  });
  const result = await intakeSource(urlInput(failedStore), malicious);
  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'UNSAFE_PATH');
  assert.deepEqual(await fs.readFile(path.join(`${failedStore}-preserved`, 'corpus.json')), original);
  assert.ok(!(await fs.readdir(`${failedStore}-preserved`)).some(name => name.endsWith('.pending')));
  const linkStore = path.join(directory, 'state-link');
  await fs.mkdir(linkStore, { mode: 0o700 });
  await fs.symlink(path.join(store, 'corpus.json'), path.join(linkStore, 'corpus.json'));
  assert.equal((await intakeSource(supplied(linkStore))).code, 'UNSAFE_PATH');
  const alteredStore = path.join(directory, 'altered');
  await intakeSource(supplied(alteredStore, 'Original'));
  let alteredBytes;
  const altering = fake(async () => {
    const altered = await corpusAt(alteredStore);
    altered.name = 'Externally changed corpus';
    alteredBytes = canonicalSerialize(altered);
    await fs.writeFile(path.join(alteredStore, 'corpus.json'), alteredBytes, { mode: 0o600 });
    return response('Must not overwrite external change');
  });
  assert.equal((await intakeSource(urlInput(alteredStore), altering)).code, 'PERSISTENCE');
  assert.equal(await fs.readFile(path.join(alteredStore, 'corpus.json'), 'utf8'), alteredBytes);
  assert.deepEqual(await fs.readdir(alteredStore), ['corpus.json']);
});

test('AC-08 output and manifests never disclose paths, URLs, input content or raw transport errors', async t => {
  const directory = await workspace(t), store = path.join(directory, 'store');
  const sensitive = 'SYNTHETIC_CONTENT_NOT_FOR_LOGS';
  const result = await intakeSource(supplied(store, sensitive));
  assert.ok(!JSON.stringify(result).includes(sensitive));
  const deps = fake(() => { throw new Error(`secret URL ${url} and ${directory}`); });
  const failure = await intakeSource(urlInput(store), deps);
  assert.equal(failure.code, 'NETWORK');
  const corpus = await corpusAt(store);
  const manifests = JSON.stringify(corpus.collectionManifests);
  for (const secret of [url, directory, sensitive, 'secret URL']) {
    assert.ok(!manifests.includes(secret));
    assert.ok(!JSON.stringify(failure).includes(secret));
  }
  const unexpected = path.join(store, 'unrelated.txt');
  await fs.writeFile(unexpected, 'Keep unrelated file', { mode: 0o600 });
  await intakeSource(supplied(store));
  assert.equal(await fs.readFile(unexpected, 'utf8'), 'Keep unrelated file');
  assert.ok((await fs.readdir(store)).every(name => ['corpus.json', 'unrelated.txt'].includes(name)));
  assert.equal(result.sourceId, stableId('source', `supplied-bytes/1\n${sha256(sensitive)}`));
});
