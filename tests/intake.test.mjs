import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateStoreTest } from './platform.mjs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import {
  intakeSource, validatePrivateCorpus, intakeUrl, isPublicAddress, readableHtml, INTAKE_LIMITS,
  HTML_PARSER_VERSION, TEXT_PARSER_VERSION, NORMALIZATION_VERSION, URL_NORMALIZATION_VERSION,
  sha256, normalizeText, canonicalSerialize, stableId, validateCorpus,
  collectBatch, readArchiveArtifact, IMAGE_LIMITS, BATCH_LIMIT,
  robotsAllows, digest,
} from '../scripts/contract.mjs';
import { parseArticle } from '../src/article.mjs';
import { canonicalArticleUrl, publisherDisplay, sourceInventory } from '../src/research-inventory.mjs';
import { applyExtraction } from '../scripts/extract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = name => fileURLToPath(new URL(`./fixtures/intake/${name}`, import.meta.url));
const storageRoot = path.join(root, '.private-intake');
const operator = 'synthetic-operator';

test('publisher normalization recognizes Nx without changing reported page publisher metadata', () => {
  const article = parseArticle('<html><head><meta property="og:site_name" content="Nx Blog"></head><body><article><h1>Synthetic report</h1><p>Benign fixture.</p></article></body></html>', 'https://nx.dev/blog/report');
  assert.equal(article.metadata.publisher, 'Nx');
  assert.equal(article.metadata.pagePublisher, 'Nx Blog');
});
test('publisher metadata and migrated domains normalize Zscaler without relabeling legacy Red Canary pages', () => {
  for (const [host, reported, expected] of [
    ['redcanary.com', 'Zscaler Blog', 'Zscaler'],
    ['zscaler.com', 'Red Canary', 'Zscaler'],
    ['redcanary.com', 'Red Canary', 'Red Canary'],
    ['articles.example', 'Zscaler, Inc.', 'Zscaler'],
  ]) {
    const article = parseArticle(`<html><head><meta property="og:site_name" content="${reported}"></head><body><article><p>Benign fixture.</p></article></body></html>`, `https://${host}/blog/report`);
    assert.equal(article.metadata.publisher, expected);
    assert.equal(article.metadata.pagePublisher, reported);
    assert.equal(article.text, 'Benign fixture.');
  }
});
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
const aliasUrl = 'https://redcanary.com/blog/threat-detection/ai-cli-tools/';
const finalArticleUrl = 'https://www.zscaler.com/blogs/cybersecurity-best-practices/ai-cli-tools';
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

test('Issue #51 AC-01 logical article grouping preserves records and narrowly identifies the verified alias', () => {
  const historical = { id: 'legacy-alias', canonicalUrl: aliasUrl, originalUrl: aliasUrl,
    publisher: 'Red Canary', revisionIds: ['retained-revision'], extractionStatus: 'Extracted' };
  const target = { id: 'target-failure', canonicalUrl: finalArticleUrl, originalUrl: finalArticleUrl,
    publisher: null, revisionIds: [] };
  const other = { ...historical, id: 'other-redcanary', canonicalUrl: 'https://redcanary.com/blog/other/',
    originalUrl: 'https://redcanary.com/blog/other/' };
  const sources = [target, historical, other, { id: 'no-url-a' }, { id: 'no-url-b' }];
  const before = digest(sources);
  const groups = sourceInventory(sources);
  assert.equal(groups.length, 4);
  const article = groups.find(group => group.canonicalUrl === finalArticleUrl);
  assert.equal(article.source, historical);
  assert.equal(article.id, historical.id);
  assert.deepEqual(article.members, [target, historical]);
  assert.equal(article.publisher.name, 'Zscaler');
  assert.equal(publisherDisplay(other).name, 'Red Canary');
  assert.equal(digest(sources), before);
  assert.equal(canonicalArticleUrl(`${aliasUrl}?utm_source=synthetic#fixture`), finalArticleUrl);
  for (const address of [
    'https://redcanary.com/blog/other/', 'https://redcanary.com/blog/threat-detection/ai-cli-tools/?edition=2',
    'https://redcanary.com.evil.invalid/blog/threat-detection/ai-cli-tools/',
  ]) assert.equal(canonicalArticleUrl(address), address);
  assert.equal(canonicalArticleUrl('https://operator@redcanary.com/blog/threat-detection/ai-cli-tools/'), null);
  assert.equal(canonicalArticleUrl('javascript:alert(1)'), null);
  assert.equal(sourceInventory([historical, { ...target, revisionIds: ['target-revision'] }])[0].id, target.id);
});

test('Issue #51 AC-01 robots leading wildcards retain agent selection, longest match, ties and explicit denial', () => {
  for (const [policy, address, expected] of [
    ['User-agent: *\nDisallow: *_archive.html', finalArticleUrl, true],
    ['User-agent: *\nDisallow: *_archive.html', 'https://articles.example/report_archive.html', false],
    ['User-agent: *\nDisallow: *_archive.html$', 'https://articles.example/report_archive.html?edition=2', true],
    ['User-agent: *\nDisallow: *_archive.html\nAllow: /report_archive.html', 'https://articles.example/report_archive.html', true],
    ['User-agent: *\nDisallow: *_archive.html\nAllow: *_archive.html', 'https://articles.example/report_archive.html', true],
    ['User-agent: *\nAllow: /\nDisallow: *secret*archive$', 'https://articles.example/secret/x/archive', false],
    ['User-agent: *\nDisallow: /\nUser-agent: OtherBot\nDisallow: *\nUser-agent: DevEnvThreatCorpusIntake\nAllow: /', finalArticleUrl, true],
    ['User-agent: *\nAllow: /\nUser-agent: DevEnvThreatCorpusIntake\nDisallow: *', finalArticleUrl, false],
    ['User-agent: DevEnvThreatCorpusIntake\nDisallow: /\nUser-agent: DevEnvThreatCorpusIntake\nAllow: /report', 'https://articles.example/report', true],
    ['User-agent: DevEnvThreatCorpusIntake\nAllow: /\nUser-agent: DevEnvThreatCorpusIntake/1\nDisallow: /report', 'https://articles.example/report', false],
    ['User-agent: *\nDisallow: *%73ecret', 'https://articles.example/secret', false],
  ]) assert.equal(robotsAllows(policy, address), expected, policy);
});

privateStoreTest('Issue #51 AC-01 unsupported robots reasons are bounded, actionable and preserve attributed text fallback', async t => {
  const directory = await workspace(t);
  for (const [name, policy, reason] of [
    ['agent', 'User-agent: Bad Agent\nAllow: /', 'invalid-agent-token'],
    ['ungrouped', 'Disallow: /', 'ungrouped-rule'],
    ['pattern', 'User-agent: *\nDisallow: confidential-relative-path', 'unsupported-rule-pattern'],
  ]) {
    const store = path.join(directory, name), deps = fake(undefined, { robots: () => response(policy) });
    const result = await intakeSource(urlInput(store), deps);
    assert.equal(result.code, 'ROBOTS_UNSUPPORTED');
    assert.equal(result.reason, reason);
    assert.match(result.guidance, /operator-supplied text\/file with --source-url/);
    assert.ok(result.guidance.length < 400);
    assert.ok(!JSON.stringify(result).includes('confidential-relative-path'));
    assert.equal(deps.calls.length, 1);
    const before = await corpusAt(store), failure = structuredClone(before.collectionManifests[0]);
    assert.ok(failure.limitations.includes(`robots-reason=${reason}`));
    assert.equal((await intakeSource({ ...supplied(store), sourceUrl: url })).status, 'succeeded');
    const after = await corpusAt(store);
    assert.deepEqual(after.collectionManifests.find(record => record.id === failure.id), failure);
    assert.equal(after.sourceRevisions[0].provenance.kind, 'supplied-text');
    assert.equal(after.sourceRevisions[0].provenance.suppliedBy, operator);
    assert.equal(deps.calls.length, 1);
  }
  const store = path.join(directory, 'cross-origin');
  const deps = fake(undefined, { robots: () => response('', { status: 301, headers: { location: 'https://other.example/robots.txt' } }) });
  const failed = await intakeSource({ ...urlInput(store), url: aliasUrl }, deps);
  assert.equal(failed.code, 'ROBOTS_UNSUPPORTED');
  assert.equal(failed.reason, 'cross-origin-policy-redirect');
  assert.equal(deps.calls.length, 1, 'cross-origin robots endpoint and article are not fetched');
});

function aliasTransport(options = {}) {
  return fake(request => request.url === aliasUrl
    ? response('', { status: 301, headers: { location: finalArticleUrl } })
    : response('Synthetic canonical article.'), {
    robots: request => response(new URL(request.url).hostname === 'redcanary.com'
      ? 'User-agent: *\nAllow: /blog/'
      : 'User-agent: *\nDisallow: *_archive.html'),
    ...options,
  });
}

privateStoreTest('Issue #51 AC-01 alias retries retain both failures and independently authorize each article origin', async t => {
  const directory = await workspace(t), store = path.join(directory, 'history');
  for (const address of [aliasUrl, finalArticleUrl]) {
    const failed = await intakeSource({ ...urlInput(store), url: address },
      fake(undefined, { robots: () => response('User-agent: Bad Agent\nAllow: /') }));
    assert.equal(failed.code, 'ROBOTS_UNSUPPORTED');
  }
  const before = await corpusAt(store), failures = structuredClone(before.collectionManifests);
  const aliasRecord = structuredClone(before.sources.find(source => source.canonicalUrl === aliasUrl));
  const deps = aliasTransport();
  const first = await intakeSource({ ...urlInput(store), url: aliasUrl }, deps);
  assert.equal(first.status, 'succeeded');
  assert.deepEqual(deps.calls.map(request => request.url), [
    'https://redcanary.com/robots.txt', aliasUrl, 'https://www.zscaler.com/robots.txt', finalArticleUrl,
  ]);
  let corpus = await corpusAt(store);
  assert.equal(corpus.sourceRevisions.length, 1);
  assert.deepEqual(corpus.sources.find(source => source.id === aliasRecord.id), aliasRecord);
  for (const failed of failures) assert.deepEqual(corpus.collectionManifests.find(record => record.id === failed.id), failed);
  const successful = corpus.collectionManifests.find(record => record.id === first.manifestId);
  assert.ok(successful.inputSourceIds.includes(aliasRecord.id));
  assert.ok(successful.limitations.includes(`redirect-target-sha256=${sha256(finalArticleUrl)}`));
  assert.ok(successful.limitations.some(value => value.startsWith('robots-policy-sha256=') && value.includes(sha256('https://redcanary.com')) && value.includes(sha256('https://www.zscaler.com'))));
  const originalRevision = structuredClone(corpus.sourceRevisions[0]);
  const second = await intakeSource({ ...urlInput(store), url: finalArticleUrl }, aliasTransport());
  const stable = await fs.readFile(path.join(store, 'corpus.json'), 'utf8');
  assert.equal(second.sourceId, first.sourceId);
  assert.equal(second.revisionId, first.revisionId);
  assert.deepEqual(await intakeSource({ ...urlInput(store), url: aliasUrl }, aliasTransport()), first);
  assert.equal(await fs.readFile(path.join(store, 'corpus.json'), 'utf8'), stable);
  corpus = await corpusAt(store);
  assert.deepEqual(corpus.sourceRevisions, [originalRevision]);
  assert.equal(sourceInventory(corpus.sources).length, 1);
  assert.equal(corpus.claims.length, 0);
  const deniedStore = path.join(directory, 'denied');
  const denied = aliasTransport({ robots: request => response(new URL(request.url).hostname === 'redcanary.com'
    ? 'User-agent: *\nAllow: /' : 'User-agent: *\nDisallow: *') });
  assert.equal((await intakeSource({ ...urlInput(deniedStore), url: aliasUrl }, denied)).code, 'ROBOTS_DENIED');
  assert.ok(!denied.calls.some(request => request.url === finalArticleUrl));
});

privateStoreTest('Issue #51 AC-01 canonical-first and alias-first batches share one successful source, revision and manual claim', async t => {
  const directory = await workspace(t);
  for (const addresses of [[finalArticleUrl, aliasUrl], [aliasUrl, finalArticleUrl]]) {
    const store = path.join(directory, `batch-${addresses[0] === aliasUrl ? 'alias' : 'canonical'}`);
    const result = await collectBatch({ urls: addresses, caseName: 'Synthetic alias campaign', operator, store }, aliasTransport());
    assert.equal(result.status, 'succeeded');
    assert.equal(result.results[0].sourceId, result.results[1].sourceId);
    assert.equal(result.results[0].revisionId, result.results[1].revisionId);
    assert.equal(result.results[1].status, 'already present');
    let corpus = await corpusAt(store);
    assert.equal(corpus.cases[0].sourceIds.length, 1);
    assert.equal(corpus.sourceRevisions.length, 1);
    assert.equal(sourceInventory(corpus.sources).length, 1);
    assert.ok(corpus.sources.some(source => source.originalUrl === aliasUrl));
    assert.ok(corpus.sources.some(source => [source.originalUrl, source.canonicalUrl].includes(finalArticleUrl)));
    const revision = corpus.sourceRevisions[0];
    const template = { schemaVersion: 'manual-extraction/1', claims: [{
      id: 'synthetic-alias-claim', caseId: corpus.cases[0].id, sourceId: revision.sourceId,
      sourceRevisionId: revision.id, revisionHash: revision.normalizedHash,
      description: 'Synthetic canonical article.', evidenceStatus: 'Source-reported observation', origin: 'Human source paraphrase',
      passages: [{ id: 'synthetic-alias-passage', locator: 'synthetic whole article', start: 0,
        end: [...revision.normalizedContent].length, text: revision.normalizedContent }],
    }] };
    applyExtraction(corpus, template, operator, JSON.stringify(template));
    await fs.writeFile(path.join(store, 'corpus.json'), canonicalSerialize(corpus), { mode: 0o600 });
    const claims = structuredClone(corpus.claims), passages = structuredClone(corpus.passages);
    assert.equal((await collectBatch({ urls: [...addresses].reverse(), caseId: corpus.cases[0].id, operator, store }, aliasTransport())).status, 'succeeded');
    corpus = await corpusAt(store);
    assert.deepEqual(corpus.claims, claims);
    assert.deepEqual(corpus.passages, passages);
    const prior = digest(corpus);
    applyExtraction(corpus, template, operator, JSON.stringify(template));
    assert.equal(digest(corpus), prior);
    assert.equal(corpus.claims.length, 1);
  }
});

privateStoreTest('Issue #51 AC-01 retained legacy source IDs, claims, revisions and manifests survive canonical retries', async t => {
  const directory = await workspace(t), store = path.join(directory, 'legacy');
  await fs.mkdir(store, { mode: 0o700 });
  const corpus = JSON.parse(await fs.readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  const legacy = corpus.sources[0];
  legacy.originalUrl = aliasUrl;
  legacy.canonicalUrl = aliasUrl;
  delete legacy.nullReasons.originalUrl;
  delete legacy.nullReasons.canonicalUrl;
  assert.deepEqual(validateCorpus(corpus), []);
  await fs.writeFile(path.join(store, 'corpus.json'), canonicalSerialize(corpus), { mode: 0o600 });
  const preserved = structuredClone({ sources: corpus.sources, claims: corpus.claims, passages: corpus.passages,
    revisions: corpus.sourceRevisions, manifests: corpus.collectionManifests, reviews: corpus.reviews, cases: corpus.cases });
  const first = await intakeSource({ ...urlInput(store), url: finalArticleUrl }, aliasTransport());
  assert.equal(first.status, 'succeeded');
  assert.equal(first.sourceId, legacy.id);
  const after = await corpusAt(store);
  for (const source of preserved.sources) {
    const actual = after.sources.find(record => record.id === source.id);
    assert.deepEqual(actual, { ...source, revisionIds: source.id === legacy.id ? [...source.revisionIds, first.revisionId] : source.revisionIds });
  }
  for (const revision of preserved.revisions) assert.deepEqual(after.sourceRevisions.find(record => record.id === revision.id), revision);
  for (const manifest of preserved.manifests) assert.deepEqual(after.collectionManifests.find(record => record.id === manifest.id), manifest);
  for (const name of ['claims', 'passages', 'reviews', 'cases']) assert.deepEqual(after[name], preserved[name]);
  assert.equal(after.sourceRevisions.filter(revision => revision.sourceId === legacy.id).length, 2, 'new content adds a revision, not a replacement source');
  const stable = await fs.readFile(path.join(store, 'corpus.json'), 'utf8');
  assert.deepEqual(await intakeSource({ ...urlInput(store), url: finalArticleUrl }, aliasTransport()), first);
  assert.equal(await fs.readFile(path.join(store, 'corpus.json'), 'utf8'), stable);
});

privateStoreTest('Issue #51 AC-01 alias failures after canonical success append failure history without losing retained coverage', async t => {
  const directory = await workspace(t), store = path.join(directory, 'post-success-failure');
  const first = await intakeSource({ ...urlInput(store), url: finalArticleUrl }, aliasTransport());
  assert.equal((await intakeSource({ ...urlInput(store), url: aliasUrl }, aliasTransport())).status, 'succeeded');
  const before = await corpusAt(store);
  for (let i = 0; i < 2; i++) {
    const result = await intakeSource({ ...urlInput(store), url: aliasUrl },
      aliasTransport({ robots: () => response('User-agent: Bad Agent\nDisallow: /') }));
    assert.equal(result.code, 'ROBOTS_UNSUPPORTED');
    const failed = (await corpusAt(store)).collectionManifests.find(m => m.id === result.manifestId);
    assert.equal(failed.outcome, 'Failed');
    assert.deepEqual(failed.inputRevisionIds, []);
  }
  const after = await corpusAt(store);
  assert.equal(after.collectionManifests.length, before.collectionManifests.length + 2);
  assert.deepEqual(after.sourceRevisions, before.sourceRevisions);
  assert.deepEqual(after.sources, before.sources);
  assert.equal(after.sourceRevisions[0].sourceId, first.sourceId);
});

privateStoreTest('AC-01 CLI text/file/validation and injected HTTPS create valid private source-only records', async t => {
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

privateStoreTest('AC-02 missing metadata/date fields remain honest; successful URL alone records retrieval day', async t => {
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

privateStoreTest('AC-03 exact reruns are byte-identical; URL changes preserve revisions and unrelated data', async t => {
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

privateStoreTest('AC-03 raw text/file identities do not merge changed bytes, and collision guards reject reused identities', async t => {
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

privateStoreTest('AC-04 streaming exact limit succeeds; missing/misleading lengths and over-limit chunks fail', async t => {
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

privateStoreTest('AC-04 shared deadline bounds DNS, robots, reads and retries; only transient errors retry twice', async t => {
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

privateStoreTest('AC-04 supplied UTF-8 bytes are bounded and concurrently invoked intake is rejected', async t => {
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

privateStoreTest('AC-04/05 redirects are bounded and each target gets robots/DNS/peer validation', async t => {
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

test('AC-05 prohibited IPv4/IPv6 addresses are rejected without filesystem access', () => {
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
});

privateStoreTest('AC-05 mixed DNS answers, rebinding and peer mismatches never pass', async t => {
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

const unsafeUrls = [
  'https://synthetic-user@articles.example/', 'https://articles.example/?access_token=SECRET',
  'https://articles.example/?api_key=SECRET', 'https://articles.example/?signature=SECRET',
  'javascript:globalThis.bad=true', 'https://articles.example:8443/', 'https://articles.example/\\x',
];
test('AC-05 URL validation rejects credentials and executable URLs while preserving meaningful parameters', () => {
  for (const inputUrl of unsafeUrls) assert.throws(() => intakeUrl(inputUrl), { code: 'UNSAFE_URL' });
  assert.equal(intakeUrl('https://articles.example/read?id=7&utm_source=x#frag'), 'https://articles.example/read?id=7');
  assert.notEqual(intakeUrl('https://articles.example/read?id=7'), intakeUrl('https://articles.example/read?id=8'));
});

privateStoreTest('AC-05 credential/sensitive query/executable URLs fail safely without persisting secrets', async t => {
  const directory = await workspace(t);
  for (const inputUrl of unsafeUrls) {
    const store = path.join(directory, `bad-${randomUUID()}`), transport = fake();
    const result = await intakeSource({ ...urlInput(store), url: inputUrl }, transport);
    assert.equal(result.code, 'UNSAFE_URL');
    assert.equal(transport.calls.length, 0);
    const corpus = await corpusAt(store);
    assert.equal(corpus.sources.length, 0);
    assert.ok(!JSON.stringify(corpus.collectionManifests).includes('SECRET'));
    assert.ok(!JSON.stringify(result).includes(inputUrl));
  }
});

privateStoreTest('Issue #30 AC-01 robots informational directives allow otherwise permitted intake', async t => {
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

privateStoreTest('AC-05 robots honor explicit denials and reject unparseable agents and access restrictions', async t => {
  const directory = await workspace(t);
  for (const [name, robots, expected] of [
    ['deny', response('User-agent: *\nDisallow: /synthetic'), 'ROBOTS_DENIED'],
    ['agent', response('User-agent: DevEnvThreatCorpusIntake\nDisallow: /'), 'ROBOTS_DENIED'],
    ['wildcard-deny', response('User-agent: *\nDisallow: /*?id=*'), 'ROBOTS_DENIED'],
    ['end-anchor', response('Content-Signal: search=yes\nUser-agent: *\nDisallow: /synthetic?id=7$'), 'ROBOTS_DENIED'],
    ['unparsed-agent', response('Host: articles.example\nUser-agent: Bad Agent\nAllow: /'), 'ROBOTS_UNSUPPORTED'],
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
  for (const [name, policy] of [
    ['wildcard', 'User-agent: *\nDisallow: /*secret\nAllow: /synthetic*'],
    ['named', 'User-agent: *\nDisallow: /\nUser-agent: DevEnvThreatCorpusIntake\nAllow: /'],
    ['tie', 'User-agent: *\nDisallow: /synthetic\nAllow: /synthetic'],
    ['extension', 'User-agent: *\nCrawl-delay: 2\nUnknown: value'],
    ['percent', 'User-agent: *\nDisallow: /%73ynthetic-secret'],
  ]) {
    const store = path.join(directory, name);
    assert.equal((await intakeSource(urlInput(store), fake(undefined, { robots: () => response(policy) }))).status, 'succeeded');
  }
});

privateStoreTest('AC-06 text/HTML Unicode normalization and raw hashes are deterministic, with no script execution', async t => {
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

privateStoreTest('AC-06 malformed UTF-8/text/HTML and unsupported encodings/types fail explicitly', async t => {
  const directory = await workspace(t);
  for (const [name, article, expected] of [
    ['invalid-utf8', () => response('', { body: (async function* () { yield Buffer.from([0xc3, 0x28]); })() }), 'MALFORMED_TEXT'],
    ['nul', () => response('A\0B'), 'MALFORMED_TEXT'],
    ['empty', () => response(' \n'), 'EMPTY_CONTENT'],
    ['json', () => response('{}', { headers: { 'content-type': 'application/json' } }), 'UNSUPPORTED_TYPE'],
    ['unknown-charset', () => response('abc', { headers: { 'content-type': 'text/plain; charset=unsupported' } }), 'UNSUPPORTED_ENCODING'],
    ['ascii', () => response('café', { headers: { 'content-type': 'text/plain; charset=us-ascii' } }), 'UNSUPPORTED_ENCODING'],
    ['gzip', () => response('abc', { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-encoding': 'gzip' } }), 'UNSUPPORTED_ENCODING'],
    ...['<img src="x">', '<script>unclosed'].map((raw, i) => [`html-${i}`, () => response(raw, { headers: { 'content-type': 'text/html; charset=utf-8' } }), 'EMPTY_CONTENT']),
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
  for (const html of ['<p>missing', '<p>bad &unknown;</p>', '<p>bad &amp</p>', '<p>&#0;</p>', '<p>&#xD800;</p>', '<p><b>x</p></b>', '<p title="&unknown;">x</p>', '<span>'.repeat(129) + 'x' + '</span>'.repeat(129)]) {
    assert.ok(readableHtml(html).trim(), 'Issue #39 explicitly authorizes tolerant HTML recovery');
  }
});

privateStoreTest('AC-07 each failed attempt remains inspectable; CLI supplied-text fallback links URL without network', async t => {
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

privateStoreTest('AC-08 private modes, safe paths, symlinks/hardlinks, public files and busy locks are enforced', async t => {
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

privateStoreTest('AC-08 corrupt states and persistence failures never overwrite data or leave success records', async t => {
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

privateStoreTest('AC-08 output and manifests never disclose paths, URLs, input content or raw transport errors', async t => {
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

const htmlResponse = (html, options = {}) => response(html, {
  ...options, headers: { 'content-type': 'text/html', ...options.headers },
});
const batchInput = (store, urls, options = {}) => ({ store, urls, operator, caseName: 'Explicit synthetic campaign', ...options });
const artifact = (store, result, name) => readArchiveArtifact({ store, sourceId: result.sourceId, revisionId: result.revisionId, artifact: name });

test('Issue #39 AC-03 extraction ignores hidden article roots and their images', () => {
  for (const wrapper of ['template', 'nav', 'div hidden', 'div aria-hidden="true"']) {
    const name = wrapper.split(' ')[0];
    const article = parseArticle(`<${wrapper}><article>Placeholder<img src="/hidden.png"></article></${name}><main>Actual report<img src="/visible.png"></main>`);
    assert.equal(article.text, 'Actual report');
    assert.deepEqual(article.images, ['/visible.png']);
  }
});

privateStoreTest('Issue #39 AC-03 parser versions preserve previously retained hidden-root evidence', async t => {
  const directory = await workspace(t), store = path.join(directory, 'parser-versions');
  const raw = '<template><article>Placeholder</article></template><main>Actual report</main>';
  await intakeSource(supplied(store, raw));
  const corpus = await corpusAt(store), revision = corpus.sourceRevisions[0];
  revision.parserVersion = 'readable-html/2';
  revision.normalizedContent = 'Placeholder';
  revision.normalizedHash = sha256(revision.normalizedContent);
  corpus.collectionManifests = [];
  assert.deepEqual(validateCorpus(corpus), []);
  revision.parserVersion = HTML_PARSER_VERSION;
  assert.equal(HTML_PARSER_VERSION, 'readable-html/5');
  assert.ok(validateCorpus(corpus).some(error => error.includes('transformation mismatch')));
  revision.normalizedContent = 'Actual report';
  revision.normalizedHash = sha256(revision.normalizedContent);
  assert.deepEqual(validateCorpus(corpus), []);
  revision.parserVersion = 'readable-html/3';
  assert.deepEqual(validateCorpus(corpus), [], 'previously retained /3 revisions keep their original transformation');
});

privateStoreTest('metadata parser /5 preserves /4 HTML transformations and rejects altered retained text', async t => {
  const directory = await workspace(t), store = path.join(directory, 'retained-parser-v4');
  const collected = await collectBatch(batchInput(store, [url]), fake(() => htmlResponse('<article><h1>Benign retained report</h1><p>Before\0after</p></article>')));
  assert.equal(collected.results[0].status, 'collected');
  const corpus = await corpusAt(store), revision = corpus.sourceRevisions[0];
  revision.parserVersion = 'readable-html/4';
  const before = canonicalSerialize(revision);
  assert.deepEqual(validateCorpus(corpus), []);
  assert.equal(canonicalSerialize(revision), before);
  revision.normalizedContent = 'Fabricated replacement'; revision.normalizedHash = sha256(revision.normalizedContent);
  assert.ok(validateCorpus(corpus).some(error => error.includes('transformation mismatch')));
});

privateStoreTest('HTML NUL handling retains original bytes, creates readable text and leaves plain-text rejection intact', async t => {
  const directory = await workspace(t);
  const raw = '<html><head><script>bootstrap\0payload</script></head><body><article><h1>Synthetic report</h1><p>Before\0after</p><pre>tool --flag</pre></article></body></html>';
  for (const charset of ['utf-8', 'us-ascii', 'windows-1252']) {
    const store = path.join(directory, charset), deps = fake(() => response(raw, { headers: { 'content-type': `text/html; charset=${charset}` } }));
    const result = await collectBatch({ store, urls: [url], caseName: 'Synthetic NUL-compatible campaign', operator }, deps);
    assert.equal(result.results[0].status, 'collected');
    const corpus = await corpusAt(store), revision = corpus.sourceRevisions[0];
    assert.equal(revision.rawContent, raw);
    assert.equal(revision.rawHash, sha256(raw));
    assert.equal(revision.parserVersion, 'readable-html/5');
    assert.ok(revision.normalizedContent.includes('Before\ufffdafter'));
    assert.ok(revision.normalizedContent.includes('tool --flag'));
    assert.ok(!revision.normalizedContent.includes('bootstrap'));
    const original = await readArchiveArtifact({ store, sourceId: revision.sourceId, revisionId: revision.id, artifact: 'original.html' });
    assert.equal(original.toString('utf8'), raw);
    const repeated = await collectBatch({ store, urls: [url], caseId: result.caseId, operator }, deps);
    assert.equal(repeated.results[0].status, 'already present');
    assert.equal((await corpusAt(store)).sourceRevisions.length, 1);
  }
  assert.equal((await intakeSource(supplied(path.join(directory, 'plain'), 'Before\0after'))).code, 'MALFORMED_TEXT');
});

privateStoreTest('Issue #39 AC-02/03 expanded legacy text archives remain readable and idempotent', async t => {
  const directory = await workspace(t), store = path.join(directory, 'expanded');
  const text = 'é'.repeat(1_200_000), bytes = Buffer.from(`<article>${text}</article>`, 'latin1');
  const transport = fake(() => htmlResponse('', {
    headers: { 'content-type': 'text/html; charset=windows-1252' },
    body: (async function* () { yield bytes; })(),
  }));
  const first = await collectBatch(batchInput(store, [url]), transport);
  assert.equal(first.status, 'succeeded');
  assert.equal((await artifact(store, first.results[0], 'article.txt')).toString(), text);
  const repeated = await collectBatch(batchInput(store, [url], { caseName: undefined, caseId: first.caseId }), transport);
  assert.equal(repeated.results[0].status, 'already present');
  assert.equal((await corpusAt(store)).sourceRevisions.length, 1);
});

privateStoreTest('Issue #39 AC-01/02 three successes, durable partial failure and per-input deduplication link one pending campaign', async t => {
  const directory = await workspace(t), store = path.join(directory, 'batch');
  const urls = ['https://articles.example/one', 'https://articles.example/two', 'https://articles.example/three', 'https://articles.example/denied', 'https://articles.example/one'];
  const transport = fake(request => new URL(request.url).pathname === '/denied'
    ? response('', { status: 403 }) : htmlResponse('<article><h1>Ordinary heading<p>Retained text'));
  const collected = await collectBatch(batchInput(store, urls), transport);
  assert.equal(collected.status, 'partial');
  assert.deepEqual(collected.results.map(result => result.status), ['collected', 'collected', 'collected', 'failed', 'already present']);
  assert.equal(collected.results[3].code, 'ACCESS_DENIED');
  assert.equal(transport.calls.filter(request => new URL(request.url).pathname === '/one').length, 1);
  const corpus = await corpusAt(store), campaign = corpus.cases[0];
  assert.equal(campaign.id, collected.caseId);
  assert.equal(campaign.kind, 'Campaign');
  assert.equal(campaign.disposition, 'Pending');
  assert.equal(campaign.sourceIds.length, 3);
  assert.equal(corpus.sources.length, 4);
  assert.equal(corpus.sourceRevisions.length, 3);
  assert.equal(corpus.collectionManifests.filter(manifest => manifest.outcome === 'Failed').length, 1);
  assert.equal(corpus.reviews.length, 0);
  const before = await fs.readFile(path.join(store, 'corpus.json'));
  const retry = await collectBatch(batchInput(store, urls.slice(0, 3), { caseName: undefined, caseId: collected.caseId }), transport);
  assert.equal(retry.status, 'succeeded');
  assert.ok(retry.results.every(result => result.status === 'already present'));
  assert.deepEqual(await fs.readFile(path.join(store, 'corpus.json')), before);
  const changed = await collectBatch(batchInput(store, [urls[0]], { caseName: undefined, caseId: collected.caseId }),
    fake(() => htmlResponse('<article><h1>Ordinary heading<p>Changed article')));
  assert.equal(changed.results[0].status, 'collected');
  assert.equal(changed.results[0].sourceId, collected.results[0].sourceId);
  assert.notEqual(changed.results[0].revisionId, collected.results[0].revisionId);
  assert.equal((await corpusAt(store)).cases[0].sourceIds.length, 3);
  const second = await collectBatch(batchInput(store, [urls[0]], { caseName: 'Independent explicitly chosen campaign' }),
    fake(() => htmlResponse('<article><h1>Ordinary heading<p>Changed article')));
  assert.notEqual(second.caseId, collected.caseId);
  assert.equal((await corpusAt(store)).cases.length, 2);
});

privateStoreTest('Issue #39 AC-03/04 archive preserves HTML and metadata, mapped publishers and exact preformatted commands', async t => {
  const directory = await workspace(t), store = path.join(directory, 'metadata');
  const html = '<!doctype html><html><head><title>Reported title</title><meta property="og:site_name" content="Page publisher">'
    + '<meta name="author" content="Reported author"><meta property="article:published_time" content="2026-10-11T13:00:00Z">'
    + '</head><body><nav>Not article text<img src="/nav.png"></nav><article><h1>Heading</h1><p>First<p>Second'
    + '<ul><li>One<li>Two</ul><pre><code>npm test -- --run\n  printf "exact  spacing"\n\nlast line</code></pre>'
    + '<img data-src="/lazy.png" src="data:image/png;base64,x"><script>globalThis.bad=true</script></article></body>';
  const transport = fake(request => new URL(request.url).pathname === '/lazy.png'
    ? response('image', { headers: { 'content-type': 'image/png' } }) : htmlResponse(html));
  const collected = await collectBatch(batchInput(store, ['https://stepsecurity.io/blog/article']), transport);
  assert.equal(collected.status, 'succeeded');
  const result = collected.results[0], corpus = await corpusAt(store), source = corpus.sources[0];
  assert.equal(source.publisher, 'StepSecurity');
  assert.equal(source.title, 'Reported title');
  assert.equal(source.author, 'Reported author');
  assert.equal(source.publicationDate.value, '2026-10-11');
  assert.equal((await artifact(store, result, 'original.html')).toString(), html);
  const text = (await artifact(store, result, 'article.txt')).toString();
  assert.ok(text.includes('Heading\nFirst\nSecond\nOne\nTwo'));
  assert.ok(text.includes('npm test -- --run\n  printf "exact  spacing"\n\nlast line'));
  assert.ok(!text.includes('Not article text') && !text.includes('globalThis'));
  const metadata = JSON.parse(await artifact(store, result, 'metadata.json'));
  assert.equal(metadata.pagePublisher, 'Page publisher');
  assert.equal(metadata.publisher, 'StepSecurity');
  assert.equal(metadata.originalUrl, 'https://stepsecurity.io/blog/article');
  assert.equal(metadata.finalUrl, metadata.originalUrl);
  assert.equal(metadata.rawHash, corpus.sourceRevisions[0].rawHash);
  assert.equal(metadata.originalBytesHash, sha256(Buffer.from(html)));
  const assets = JSON.parse(await artifact(store, result, 'assets.json'));
  assert.equal(assets.assets.length, 1);
  assert.equal(assets.assets[0].originalUrl, '/lazy.png');
  assert.equal(assets.assets[0].hash, sha256('image'));
  assert.equal(await fs.readFile(path.join(store, metadata.paths['assets.json']), 'utf8'), (await artifact(store, result, 'assets.json')).toString());
  assert.equal((await fs.stat(path.join(store, 'articles', result.sourceId, result.revisionId))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(store, 'articles', result.sourceId, result.revisionId, 'original.html'))).mode & 0o777, 0o600);
  const gitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/.test(key)));
  const ignored = spawnSync('git', ['check-ignore', path.join(store, 'articles', result.sourceId, result.revisionId, 'original.html')], { cwd: root, env: gitEnvironment });
  assert.equal(ignored.status, 0);
  for (const [host, expected] of [['socket.dev', 'Socket'], ['blog.redcanary.com', 'Red Canary'], ['unknown.example', null]]) {
    const independent = path.join(directory, host);
    await collectBatch(batchInput(independent, [`https://${host}/article`]), fake(() => htmlResponse('<article><p>No reported metadata')));
    const unknown = (await corpusAt(independent)).sources[0];
    assert.equal(unknown.publisher, expected);
    assert.equal(unknown.title, null);
    assert.equal(unknown.author, null);
  }
});

privateStoreTest('Issue #39 AC-03 common compression, optional charsets, meta charset and decoded-byte limits', async t => {
  const directory = await workspace(t);
  for (const [name, compress] of [['gzip', gzipSync], ['deflate', deflateSync], ['br', brotliCompressSync]]) {
    const store = path.join(directory, name), raw = '<article><h1>Café</h1><p>Compressed static article';
    const bytes = compress(Buffer.from(raw));
    const collected = await collectBatch(batchInput(store, ['https://articles.example/article']), fake(() => htmlResponse('', {
      headers: { 'content-encoding': name, 'content-length': String(bytes.length) }, body: (async function* () { yield bytes; })(),
    })));
    assert.equal(collected.status, 'succeeded');
    assert.equal((await artifact(store, collected.results[0], 'original.html')).toString(), raw);
  }
  for (const [name, html, headers] of [
    ['http-charset', '<article><p>Caf\xe9', { 'content-type': 'text/html; charset=iso-8859-1; extra=value' }],
    ['meta-charset', '<meta charset="windows-1252"><article><p>Caf\xe9', {}],
  ]) {
    const store = path.join(directory, name), bytes = Buffer.from(html, 'latin1');
    const collected = await collectBatch(batchInput(store, ['https://articles.example/article']), fake(() => htmlResponse('', {
      headers, body: (async function* () { yield bytes; })(),
    })));
    assert.equal(collected.status, 'succeeded');
    assert.equal((await artifact(store, collected.results[0], 'article.txt')).toString(), 'Café');
    assert.deepEqual(await artifact(store, collected.results[0], 'original.html'), bytes);
    assert.equal(JSON.parse(await artifact(store, collected.results[0], 'metadata.json')).charset, 'windows-1252');
  }
  const oversized = gzipSync(Buffer.from('x'.repeat(INTAKE_LIMITS.bytes + 1))), store = path.join(directory, 'bomb');
  await checkFailure(store, urlInput(store), fake(() => response('', {
    headers: { 'content-type': 'text/plain', 'content-encoding': 'gzip' }, body: (async function* () { yield oversized; })(),
  })), 'TOO_LARGE');
});

privateStoreTest('Issue #39 AC-03/07 images reuse DNS/peer/HTTPS/redirect/robots boundaries without discarding text', async t => {
  const directory = await workspace(t), store = path.join(directory, 'images');
  const html = '<article><p>Usable article text<img src="/good.png"><img src="https://127.0.0.1/private">'
    + '<img src="http://other.example/unsafe"><img src="/redirect.png"><img src="/denied.png"><img src="/not-image.png">'
    + '<img src="/wrong-peer.png"><img src="/large.png"><img src="/robots-blocked.png"><img src="/after.png">';
  const transport = fake(request => {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/article') return htmlResponse(html);
    if (pathname === '/redirect.png') return response('', { status: 302, headers: { location: 'https://10.0.0.1/secret' } });
    if (pathname === '/denied.png') return response('', { status: 403 });
    if (pathname === '/not-image.png') return htmlResponse('<script>bad</script>');
    return response(pathname === '/large.png' ? '123456789' : 'png', {
      headers: { 'content-type': 'image/png' }, peerAddress: pathname === '/wrong-peer.png' ? '8.8.8.8' : publicIP,
    });
  }, { robots: () => response('User-agent: *\nDisallow: /*blocked*') });
  const collected = await collectBatch(batchInput(store, ['https://articles.example/article']), { ...transport, imageLimits: { bytes: 8 } });
  assert.equal(collected.status, 'succeeded');
  assert.equal(collected.results[0].status, 'collected with image warnings');
  const assets = JSON.parse(await artifact(store, collected.results[0], 'assets.json'));
  assert.deepEqual(assets.assets.map(asset => asset.reason), [null, 'UNSAFE_ADDRESS', 'UNSAFE_URL', 'UNSAFE_ADDRESS', 'ACCESS_DENIED', 'UNSUPPORTED_TYPE', 'PEER_MISMATCH', 'TOO_LARGE', 'ROBOTS_DENIED', null]);
  assert.ok(transport.calls.every(request => new URL(request.url).protocol === 'https:' && request.address === publicIP));
  assert.ok(!transport.calls.some(request => new URL(request.url).pathname === '/robots-blocked.png'));
  assert.equal((await artifact(store, collected.results[0], 'article.txt')).toString(), 'Usable article text');
});

privateStoreTest('Issue #39 AC-03/07 bounded configurable count/individual/total image work and deadline', async t => {
  const directory = await workspace(t);
  assert.deepEqual(IMAGE_LIMITS, { images: 20, bytes: 5242880, totalBytes: 52428800 });
  for (const [name, limits, expected] of [
    ['count', { images: 1 }, [null, 'IMAGE_COUNT_LIMIT', 'IMAGE_COUNT_LIMIT']],
    ['total', { bytes: 3, totalBytes: 4 }, [null, 'TOO_LARGE', 'IMAGE_TOTAL_LIMIT']],
    ['disabled', { images: 0 }, ['IMAGE_COUNT_LIMIT', 'IMAGE_COUNT_LIMIT', 'IMAGE_COUNT_LIMIT']],
  ]) {
    const store = path.join(directory, name);
    const transport = fake(request => new URL(request.url).pathname === '/article'
      ? htmlResponse('<article><p>Article<img src="/1.png"><img src="/2.png"><img src="/3.png">')
      : response('png', { headers: { 'content-type': 'image/png' } }));
    const collected = await collectBatch(batchInput(store, ['https://articles.example/article']), { ...transport, imageLimits: limits });
    assert.equal(collected.status, 'succeeded');
    assert.deepEqual(JSON.parse(await artifact(store, collected.results[0], 'assets.json')).assets.map(asset => asset.reason), expected);
  }
  for (const imageLimits of [{ images: 21 }, { bytes: 5242881 }, { totalBytes: 52428801 }, { images: -1 }, { bytes: 1.5 }, { unknown: 1 }]) {
    const failed = await collectBatch(batchInput(path.join(directory, `bad-${randomUUID()}`), [url]), { imageLimits });
    assert.equal(failed.code, 'INVALID_INPUT');
  }
  const store = path.join(directory, 'deadline');
  const transport = fake(request => new URL(request.url).pathname === '/article'
    ? htmlResponse('<article><p>Retain text<img src="/hang.png">')
    : response('', { headers: { 'content-type': 'image/png' }, body: (async function* () { await new Promise(() => {}); })() }));
  const result = await collectBatch(batchInput(store, ['https://articles.example/article']), { ...transport, deadlineMs: 25 });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.results[0].warnings[0].code, 'TIMEOUT');
});

privateStoreTest('Issue #39 AC-05/07 archive reader rejects traversal, links and nonprivate artifacts; archive failures persist no successful revision', async t => {
  const directory = await workspace(t), store = path.join(directory, 'reader');
  const collected = await collectBatch(batchInput(store, [url]), fake(() => htmlResponse('<article><p>Private')));
  assert.equal(collected.status, 'succeeded');
  const result = collected.results[0], input = { store, sourceId: result.sourceId, revisionId: result.revisionId, artifact: 'original.html' };
  for (const changed of [{ artifact: '../corpus.json' }, { artifact: 'images/x.png' }, { sourceId: '..' }, { revisionId: '../escape' }, { store: 'relative' }]) {
    await assert.rejects(readArchiveArtifact({ ...input, ...changed }), error => ['INVALID_INPUT', 'UNSAFE_PATH'].includes(error.code));
  }
  const file = path.join(store, 'articles', result.sourceId, result.revisionId, 'original.html'), retained = await fs.readFile(file);
  await fs.chmod(file, 0o644);
  await assert.rejects(readArchiveArtifact(input), { code: 'UNSAFE_PATH' });
  await fs.chmod(file, 0o600);
  const hardlink = path.join(directory, 'hardlink');
  await fs.link(file, hardlink);
  await assert.rejects(readArchiveArtifact(input), { code: 'UNSAFE_PATH' });
  await fs.unlink(hardlink);
  await fs.unlink(file);
  await fs.symlink(path.join(store, 'corpus.json'), file);
  await assert.rejects(readArchiveArtifact(input), { code: 'UNSAFE_PATH' });
  await fs.unlink(file);
  await fs.writeFile(file, retained, { mode: 0o600 });
  const revisionDirectory = path.dirname(file);
  await fs.chmod(revisionDirectory, 0o755);
  await assert.rejects(readArchiveArtifact(input), { code: 'UNSAFE_PATH' });
  await fs.chmod(revisionDirectory, 0o700);
  const unsafeStore = path.join(directory, 'unsafe-archive');
  await intakeSource(supplied(unsafeStore));
  await fs.symlink(directory, path.join(unsafeStore, 'articles'));
  const failed = await collectBatch(batchInput(unsafeStore, [url]), fake(() => htmlResponse('<article><p>Archive must fail')));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.results[0].code, 'UNSAFE_PATH');
  const corpus = await corpusAt(unsafeStore);
  assert.equal(corpus.sourceRevisions.length, 1);
  assert.equal(corpus.collectionManifests.find(manifest => manifest.inputSourceIds.includes(failed.results[0].sourceId)).outcome, 'Failed');
  assert.deepEqual(corpus.cases, []);
});

privateStoreTest('Issue #39 AC-01/02 batch input limit applies before deduplication and CLI UTF-8 URL file persists per-input failures', async t => {
  const directory = await workspace(t);
  assert.equal(BATCH_LIMIT, 20);
  const transport = fake();
  for (const options of [{ urls: Array(21).fill(url) }, { urls: [] }, { caseId: 'unknown', caseName: 'also' }, { caseName: undefined }, { operator: 'invalid operator' }]) {
    const result = await collectBatch({ ...batchInput(path.join(directory, `invalid-${randomUUID()}`), [url]), ...options }, transport);
    assert.equal(result.code, 'INVALID_INPUT');
  }
  assert.equal(transport.calls.length, 0);
  const file = path.join(directory, 'urls.txt'), store = path.join(directory, 'cli');
  await fs.writeFile(file, '\ufeffhttp://articles.example/one\n\nhttp://articles.example/two\r\nhttp://articles.example/three\n', { mode: 0o600 });
  const result = cli(['intake', 'batch', '--urls-file', file, '--case-name', 'CLI explicit campaign', '--supplied-by', operator, '--store', store]);
  assert.equal(result.status, 1);
  assert.equal(result.result.results.length, 3);
  assert.ok(result.result.results.every(item => item.status === 'failed' && item.code === 'UNSAFE_URL'));
  assert.equal((await corpusAt(store)).collectionManifests.length, 3);
  assert.deepEqual((await corpusAt(store)).cases, []);
});
