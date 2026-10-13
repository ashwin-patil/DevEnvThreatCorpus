import http from 'node:http';
import { readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertValid, canonicalSerialize, validatePrivateCorpus, collectBatch, readArchiveArtifact, reviewEligibleCorpus } from './contract.mjs';
import { readEnrichmentSnapshot } from '../src/enrichment.mjs';
import { runCampaign, campaignAnnotations, campaignStatus, campaignExport } from '../src/campaign.mjs';

export const WEB_INTAKE_LIMITS = Object.freeze({ bodyBytes: 192 * 1024, bodyTimeoutMs: 10_000, urls: 20 });
export const CAMPAIGN_LIMITS = Object.freeze({ itemBytes: 2 * 1024 * 1024, bodyBytes: 4 * 1024 * 1024 + 64 * 1024 });
const archiveIds = /^source-[a-f0-9]{64}\/source-revision-[a-f0-9]{64}$/;
const archiveArtifacts = new Set(['original.html', 'article.txt', 'metadata.json', 'assets.json']);

async function intakeBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const fail = (status, message) => {
      cleanup(); request.resume(); reject(Object.assign(new Error(message), { status }));
    };
    const timer = setTimeout(() => fail(408, 'Intake body timed out.'), WEB_INTAKE_LIMITS.bodyTimeoutMs);
    const onData = chunk => {
      bytes += chunk.length;
      if (bytes > WEB_INTAKE_LIMITS.bodyBytes) fail(413, 'Intake body exceeds 192 KiB.');
      else chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(Object.assign(new Error('Expected UTF-8 JSON.'), { status: 400 })); }
    };
    const onError = () => fail(400, 'Incomplete intake body.');
    const onAborted = () => {
      // A disconnect can emit an error after the abort event removes the body listeners.
      request.once('error', () => {});
      fail(400, 'Incomplete intake body.');
    };
    function cleanup() {
      clearTimeout(timer);
      request.off('data', onData); request.off('end', onEnd); request.off('error', onError); request.off('aborted', onAborted);
    }

    request.on('data', onData); request.on('end', onEnd); request.on('error', onError); request.on('aborted', onAborted);
  });
}

async function campaignBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const fail = (status, message) => {
      cleanup(); request.resume(); reject(Object.assign(new Error(message), { status }));
    };
    const timer = setTimeout(() => fail(408, 'Campaign request timed out.'), WEB_INTAKE_LIMITS.bodyTimeoutMs);
    const onData = chunk => {
      bytes += chunk.length;
      if (bytes > CAMPAIGN_LIMITS.bodyBytes) fail(413, 'Campaign request exceeds the 4 MiB combined limit.');
      else chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { reject(Object.assign(new Error('Expected UTF-8 JSON.'), { status: 400 })); }
    };
    const onError = () => fail(400, 'Incomplete campaign request.');
    const onAborted = () => {
      request.once('error', () => {});
      fail(400, 'Incomplete campaign request.');
    };
    function cleanup() {
      clearTimeout(timer);
      request.off('data', onData); request.off('end', onEnd); request.off('error', onError); request.off('aborted', onAborted);
    }
    request.on('data', onData); request.on('end', onEnd); request.on('error', onError); request.on('aborted', onAborted);
  });
}

function validIntake(input) {
  return input && typeof input === 'object' && !Array.isArray(input) &&
    Object.keys(input).every(key => ['urls', 'caseId', 'caseName', 'operator'].includes(key)) &&
    Array.isArray(input.urls) && input.urls.length > 0 && input.urls.length <= WEB_INTAKE_LIMITS.urls &&
    input.urls.every(url => typeof url === 'string' && url.length > 0 && url.length <= 8192) &&
    typeof input.operator === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(input.operator) &&
    ((typeof input.caseId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,160}$/.test(input.caseId) && input.caseName === undefined) ||
     (typeof input.caseName === 'string' && input.caseName.trim().length > 0 && input.caseName.length <= 200 &&
      !/[\u0000-\u001f]/u.test(input.caseName) && input.caseId === undefined));
}

const caseIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,160}$/;
const exactKeys = (input, allowed) => input && typeof input === 'object' && !Array.isArray(input) &&
  Object.keys(input).every(key => allowed.includes(key));
const jsonBytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

function validCampaignInput(route, input) {
  if (route === 'prepare') return exactKeys(input, ['caseId', 'requestedModel']) &&
    caseIdPattern.test(input.caseId ?? '') &&
    (input.requestedModel === undefined || (typeof input.requestedModel === 'string' && input.requestedModel.length > 0 && input.requestedModel.length <= 200));
  if (route === 'import') return exactKeys(input, ['request', 'candidate']) &&
    input.request && typeof input.request === 'object' && !Array.isArray(input.request) &&
    input.candidate && typeof input.candidate === 'object' && !Array.isArray(input.candidate) &&
    jsonBytes(input.request) <= CAMPAIGN_LIMITS.itemBytes && jsonBytes(input.candidate) <= CAMPAIGN_LIMITS.itemBytes &&
    jsonBytes(input.request) + jsonBytes(input.candidate) <= CAMPAIGN_LIMITS.itemBytes * 2;
  return exactKeys(input, ['caseId', 'format']) && caseIdPattern.test(input.caseId ?? '') &&
    (input.format === undefined || ['json', 'md'].includes(input.format));
}

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['src/index.html', 'text/html']],
  ['/src/index.html', ['src/index.html', 'text/html']],
  ['/src/style.css', ['src/style.css', 'text/css']],
  ['/src/app.mjs', ['src/app.mjs', 'text/javascript']],
  ['/src/model.mjs', ['src/model.mjs', 'text/javascript']],
  ['/src/render.mjs', ['src/render.mjs', 'text/javascript']],
  ['/src/studio.mjs', ['src/studio.mjs', 'text/javascript']],
  ['/src/explore.mjs', ['src/explore.mjs', 'text/javascript']],
  ['/docs/assets/logo.svg', ['docs/assets/logo.svg', 'image/svg+xml']],
  ['/docs/assets/favicon.svg', ['docs/assets/favicon.svg', 'image/svg+xml']],
]);

export function emptyCorpus() {
  return {
    schemaVersion: '0.3.0', name: 'Local research workbench — no corpus loaded',
    sources: [], sourceRevisions: [], passages: [], cases: [], claims: [],
    categorizations: [], timelines: [], reviews: [], collectionManifests: [], governance: {},
  };
}

export async function createPreviewServer({ corpusFile, store, intakeDeps = {} } = {}) {
  if (corpusFile && store) throw new Error('Choose a read-only corpus snapshot or a private collection store, not both.');
  if (store && (!path.isAbsolute(store) || path.normalize(store) !== store || store.includes('\0'))) throw new Error('Store path must be absolute and normalized.');
  const corpus = corpusFile ? await validatePrivateCorpus(corpusFile, { reviewAware: true }) : assertValid(emptyCorpus());
  const demo = assertValid(JSON.parse(await readFile(new URL('tests/fixtures/benign/core-only.json', root), 'utf8')));
  const researchDemo = assertValid(JSON.parse(await readFile(new URL('tests/fixtures/benign/research-views.json', root), 'utf8')));
  const responses = new Map([
    ['/api/corpus', canonicalSerialize(corpus)],
    ['/api/demo', canonicalSerialize(demo)],
    ['/api/demo-research', canonicalSerialize(researchDemo)],
  ]);
  let writing = false;
  const staleReviews = value => {
    const eligible = reviewEligibleCorpus(value);
    return ['cases', 'claims', 'categorizations', 'timelines'].reduce((count, key) =>
      count + value[key].filter((record, index) => record.disposition === 'Accepted' && eligible[key][index]?.disposition !== 'Accepted').length, 0);
  };
  const currentCorpus = async () => {
    const file = path.join(store, 'corpus.json');
    try {
      await lstat(file);
      return await validatePrivateCorpus(file, { reviewAware: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return assertValid(emptyCorpus());
    }
  };
  const server = http.createServer(async (request, response) => {
    const port = response.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    const send = (status, body, type = 'text/plain', extra = {}) => {
      response.writeHead(status, { ...headers, 'Content-Type': `${type}; charset=utf-8`,
        ...(!['GET', 'HEAD'].includes(request.method) ? { Connection: 'close' } : {}), ...extra });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!hosts.includes(request.headers.host) ||
        (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) ||
        (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) {
      return send(403, 'Local same-origin preview only.');
    }
    if (request.method === 'POST' && request.url === '/api/intake' && store) {
      if (request.headers.origin !== `http://${request.headers.host}` ||
          (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) {
        return send(403, 'Intake requires the exact same origin.');
      }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '') ||
          request.headers['content-encoding']) return send(415, 'Expected uncompressed application/json.');
      const length = request.headers['content-length'];
      if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > WEB_INTAKE_LIMITS.bodyBytes)) {
        return send(413, 'Intake body exceeds 192 KiB.');
      }
      if (writing) return send(409, 'Another collection is in progress; wait before resubmitting.');
      writing = true;
      try {
        const input = await intakeBody(request);
        if (!validIntake(input)) return send(400, 'Supply 1–20 URLs, an operator identifier, and either an existing case ID or a new pending case name; no other fields.');
        const result = await collectBatch({ ...input, store }, intakeDeps);
        if (result.code && !result.results?.length) return send(result.code === 'STORE_BUSY' ? 409 : 400,
          JSON.stringify({ ...result, message: `Collection could not start (${result.code}). Check campaign and private store permissions; reload before retrying.` }), 'application/json');
        return send(200, JSON.stringify(result), 'application/json');
      } catch (error) {
        return send(error.status ?? 400, JSON.stringify({ status: 'failed', code: error.code ?? 'INVALID_INPUT',
          message: error.status ? error.message : 'Collection could not complete. Check campaign, URLs and private store permissions; reload before retrying.' }), 'application/json');
      } finally { writing = false; }
    }
    const campaignRoute = request.url?.match(/^\/api\/campaign\/(prepare|import|export)$/)?.[1];
    if (request.method === 'POST' && campaignRoute && store) {
      if (request.headers.origin !== `http://${request.headers.host}` ||
          (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) {
        return send(403, 'Campaign operations require the exact same origin.');
      }
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '') ||
          request.headers['content-encoding']) return send(415, 'Expected uncompressed application/json.');
      const length = request.headers['content-length'];
      if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > CAMPAIGN_LIMITS.bodyBytes)) {
        return send(413, 'Campaign request exceeds the 4 MiB combined limit.');
      }
      if (writing) return send(409, 'Another private-store operation is in progress; wait before resubmitting.');
      try {
        const input = await campaignBody(request);
        if (!validCampaignInput(campaignRoute, input)) {
          return send(400, 'Supply only the bounded fields required for this campaign operation.');
        }
        if (campaignRoute === 'export') {
          const exported = campaignExport(await currentCorpus(), input.caseId, input.format ?? 'json');
          return send(200, typeof exported === 'string' ? exported : canonicalSerialize(exported),
            input.format === 'md' ? 'text/markdown' : 'application/json');
        }
        writing = true;
        const result = await runCampaign({
          command: campaignRoute === 'import' ? 'apply' : 'prepare',
          store,
          ...(campaignRoute === 'prepare' ? { caseId: input.caseId, revisionIds: [], requestedModel: input.requestedModel ?? null } :
            { request: input.request, candidate: input.candidate }),
        });
        const status = result.status === 'succeeded' ? 200 : result.code === 'STORE_BUSY' ? 409 : 400;
        return send(status, JSON.stringify(result), 'application/json');
      } catch (error) {
        return send(error.status ?? 400, JSON.stringify({ status: 'failed', code: error.code ?? 'INVALID_INPUT',
          message: error.status ? error.message : 'Campaign operation could not complete. Reload before explicit retry.' }), 'application/json');
      } finally { writing = false; }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Collection requires --store and POST /api/intake; all other routes are read-only.');
    if (store && request.url?.startsWith('/api/campaign/status')) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const entries = [...url.searchParams.entries()];
        if (url.pathname !== '/api/campaign/status' || entries.length !== 1 || entries[0][0] !== 'case' || !caseIdPattern.test(entries[0][1])) {
          return send(400, 'Supply exactly one valid case query parameter.');
        }
        return send(200, JSON.stringify(campaignStatus(await currentCorpus(), entries[0][1])), 'application/json');
      } catch { return send(400, 'Campaign status could not be loaded.'); }
    }
    if (store && request.url === '/api/enrichment') {
      try {
        try { await lstat(path.join(store, 'corpus.json')); }
        catch (error) {
          if (error.code === 'ENOENT') return send(200, JSON.stringify({ schemaVersion: 'talk-enrichment/1', annotations: [] }), 'application/json');
          throw error;
        }
        const current = await currentCorpus();
        const manual = await readEnrichmentSnapshot(store, current);
        const projected = campaignAnnotations(current);
        return send(200, canonicalSerialize({
          schemaVersion: projected.length ? 'campaign-projection/1' : 'talk-enrichment/1',
          annotations: [...manual.annotations, ...projected],
        }), 'application/json');
      } catch { return send(500, 'Private annotations could not be validated against the current corpus. Core collection is unchanged.'); }
    }
    if (store && request.url === '/api/corpus') {
      try {
        const current = await currentCorpus();
        return send(200, canonicalSerialize(current), 'application/json', {
          'X-Collection-Enabled': 'true', 'X-Stale-Reviews': String(staleReviews(current)),
        });
      } catch { return send(500, 'Private corpus could not be loaded; check validity and permissions.'); }
    }
    if (store && request.url?.startsWith('/api/archive/')) {
      const segments = request.url.slice('/api/archive/'.length).split('/');
      if (segments.length !== 3 || !archiveIds.test(segments.slice(0, 2).join('/')) || !archiveArtifacts.has(segments[2])) {
        return send(404, 'Archive artifact not found.');
      }
      const [sourceId, revisionId, artifact] = segments;
      try {
        const bytes = await readArchiveArtifact({ store, sourceId, revisionId, artifact });
        return send(200, bytes, 'application/octet-stream', {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${artifact}"`,
          'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'none'",
        });
      } catch { return send(404, 'Archive artifact not found.'); }
    }
    if (responses.has(request.url)) return send(200, responses.get(request.url), 'application/json',
      request.url === '/api/corpus' ? { 'X-Stale-Reviews': String(staleReviews(corpus)) } : {});
    const asset = assets.get(request.url);
    if (!asset) return send(404, 'Not found.');
    try {
      send(200, await readFile(new URL(asset[0], root)), asset[1]);
    } catch {
      send(404, 'Not found.');
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

export function parseArguments(args) {
  const options = { port: 4173 };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!['--port', '--corpus', '--store'].includes(flag) || seen.has(flag) || !value || value.startsWith('--')) {
      throw new Error('Usage: node scripts/server.mjs [--port 4173] [--corpus /absolute/private/corpus.json | --store /absolute/private/store]');
    }
    seen.add(flag);
    if (flag === '--port') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Invalid port.');
      options.port = Number(value);
    } else {
      if (!path.isAbsolute(value) || path.normalize(value) !== value || value.includes('\0')) throw new Error('Private path must be absolute and normalized.');
      options[flag === '--corpus' ? 'corpusFile' : 'store'] = value;
    }
  }
  if (options.corpusFile && options.store) throw new Error('Choose --corpus or --store, not both.');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { port, ...options } = parseArguments(process.argv.slice(2));
    const server = await createPreviewServer(options);
    server.on('error', () => {
      console.error('Preview server could not start.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Local workbench: http://127.0.0.1:${port}/`);
      console.log(options.store ? 'Private collection enabled; reload reads the current corpus. Collection remains pending, not acceptance.' :
        'Read-only startup snapshot; restart to reload. Collection requires --store.');
      console.log('Loopback only. Do not expose or tunnel private content.');
    });
  } catch {
    console.error('Preview startup failed. Use --port 1..65535 and either an absolute private --store or a valid private 0.3.0 --corpus file.');
    process.exitCode = 1;
  }
}
