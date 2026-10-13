import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertValid, canonicalSerialize, validatePrivateCorpus } from './contract.mjs';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['src/index.html', 'text/html']],
  ['/src/index.html', ['src/index.html', 'text/html']],
  ['/src/style.css', ['src/style.css', 'text/css']],
  ['/src/app.mjs', ['src/app.mjs', 'text/javascript']],
  ['/src/model.mjs', ['src/model.mjs', 'text/javascript']],
  ['/src/render.mjs', ['src/render.mjs', 'text/javascript']],
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

export async function createPreviewServer({ corpusFile } = {}) {
  const corpus = corpusFile ? await validatePrivateCorpus(corpusFile) : assertValid(emptyCorpus());
  const demo = assertValid(JSON.parse(await readFile(new URL('tests/fixtures/benign/core-only.json', root), 'utf8')));
  const responses = new Map([
    ['/api/corpus', canonicalSerialize(corpus)],
    ['/api/demo', canonicalSerialize(demo)],
  ]);
  return http.createServer(async (request, response) => {
    const port = response.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const origins = hosts.map(host => `http://${host}`);
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    const send = (status, body, type = 'text/plain') => {
      response.writeHead(status, { ...headers, 'Content-Type': `${type}; charset=utf-8` });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!hosts.includes(request.headers.host) ||
        (request.headers.origin && !origins.includes(request.headers.origin)) ||
        (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) {
      return send(403, 'Local same-origin preview only.');
    }
    if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Read-only preview.');
    if (responses.has(request.url)) return send(200, responses.get(request.url), 'application/json');
    const asset = assets.get(request.url);
    if (!asset) return send(404, 'Not found.');
    try {
      send(200, await readFile(new URL(asset[0], root)), asset[1]);
    } catch {
      send(404, 'Not found.');
    }
  });
}

export function parseArguments(args) {
  const options = { port: 4173 };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!['--port', '--corpus'].includes(flag) || seen.has(flag) || !value || value.startsWith('--')) {
      throw new Error('Usage: node scripts/server.mjs [--port 4173] [--corpus /absolute/private/corpus.json]');
    }
    seen.add(flag);
    if (flag === '--port') {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('Invalid port.');
      options.port = Number(value);
    } else {
      if (!path.isAbsolute(value)) throw new Error('Corpus path must be absolute.');
      options.corpusFile = value;
    }
  }
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
      console.log(`Read-only workbench: http://127.0.0.1:${port}/`);
      console.log('Loopback only. Corpus is a startup snapshot; restart to reload. Do not expose or tunnel private content.');
    });
  } catch {
    console.error('Preview startup failed. Use --port 1..65535 and an optional absolute, private, valid 0.3.0 --corpus file.');
    process.exitCode = 1;
  }
}
