import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { digest, readPrivateTemplate, sha256, validatePrivateCorpus } from '../scripts/contract.mjs';
import { privateDirectory, privateOutput } from './enrichment.mjs';
import {
  ADAPTER_REQUEST_VERSION, ADAPTER_SPEC, prepareAdapterCampaign, validateAdapterReceipt,
  validateCampaignCandidate, verifyCampaignRequest,
} from './campaign.mjs';
import { referenceTokens } from './chunks.mjs';

export const ADAPTER_LIMITS = Object.freeze({
  requestBytes: 256 * 1024, referenceTokens: 32_000, outputTokens: 16_000,
  timeoutMs: 120_000, responseBytes: 2 * 1024 * 1024, attempts: 1,
});

const fail = code => { throw Object.assign(new Error(code), { code }); };
const safeCodes = new Set([
  'ADAPTER_DISABLED', 'MISSING_CONFIGURATION', 'TRANSMISSION_DENIED', 'UNSUPPORTED_MODEL',
  'REQUEST_TAMPERED', 'STALE_INPUT', 'REQUEST_TOO_LARGE', 'TIMEOUT', 'RATE_LIMIT',
  'PROVIDER_AUTH', 'PROVIDER_ERROR', 'INVALID_OUTPUT', 'OUTPUT_TOO_LARGE', 'PROVIDER_REFUSAL',
  'INCOMPLETE_OUTPUT', 'INVALID_ADAPTER_RECEIPT', 'ARTIFACT_EXISTS', 'UNSAFE_PATH',
  'UNSUPPORTED_PLATFORM', 'PERSISTENCE', 'INVALID_INPUT',
]);
const safeCode = error => safeCodes.has(error?.code) ? error.code
  : /^E[A-Z]+$/.test(error?.code ?? '') ? 'PERSISTENCE' : 'INVALID_CANDIDATE';

export function adapterPayload(request) {
  if (request?.schemaVersion !== ADAPTER_REQUEST_VERSION) fail('REQUEST_TAMPERED');
  const { requestHash, inputs, caseScope, catalogSnapshot, candidateGuide, chunkPolicy } = request;
  const catalog = {
    resolverVersion: catalogSnapshot.resolverVersion, digest: catalogSnapshot.digest,
    descriptionAvailability: 'IDs and names only; definitions, URLs, license text and exclusion inventory remain local. Do not invent catalog descriptions.',
    catalogs: catalogSnapshot.catalogs.map(catalog => ({
      framework: catalog.framework, version: catalog.version, immutableRevision: catalog.immutableRevision,
      materialDigest: catalog.materialDigest, materialUrl: catalog.materialUrl,
      techniques: catalog.techniques.map(({ id, name }) => ({ id, name })),
    })),
  };
  const payload = {
    model: ADAPTER_SPEC.requestedModel, reasoning: { effort: ADAPTER_SPEC.reasoningEffort },
    store: false, background: false, tools: [], max_output_tokens: ADAPTER_LIMITS.outputTokens,
    instructions: request.prompt.text,
    input: JSON.stringify({ requestHash, inputs, caseScope, catalogSnapshot: catalog, candidateGuide, chunkPolicy }),
    text: { format: { type: 'json_object' } },
  };
  const body = JSON.stringify(payload);
  if (Buffer.byteLength(body) > ADAPTER_LIMITS.requestBytes
    || referenceTokens(body) > ADAPTER_LIMITS.referenceTokens) fail('REQUEST_TOO_LARGE');
  return body;
}

function configuration(enabled, env) {
  if (enabled !== true) fail('ADAPTER_DISABLED');
  const key = env.OPENAI_API_KEY;
  if (typeof key !== 'string' || !key.trim() || key.length > 8192 || /[\s\u0000-\u001f]/u.test(key)) {
    fail('MISSING_CONFIGURATION');
  }
  return key;
}

async function deadline(operation, controller, remainingMs) {
  if (remainingMs <= 0) fail('TIMEOUT');
  let timer;
  try {
    return await Promise.race([operation(), new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' }));
      }, remainingMs);
    })]);
  } finally { clearTimeout(timer); }
}

async function responseText(response) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > ADAPTER_LIMITS.responseBytes)) {
    fail('OUTPUT_TOO_LARGE');
  }
  if (!response.body) fail('INVALID_OUTPUT');
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ADAPTER_LIMITS.responseBytes) fail('OUTPUT_TOO_LARGE');
      chunks.push(value);
    }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { fail('INVALID_OUTPUT'); }
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
}

function outputText(response) {
  if (!Array.isArray(response.output)) fail('INVALID_OUTPUT');
  if (response.output.some(item => !item || typeof item !== 'object')) fail('INVALID_OUTPUT');
  const messages = response.output.filter(item => item.type === 'message');
  if (response.output.some(item => !['message', 'reasoning'].includes(item.type))) fail('INVALID_OUTPUT');
  if (messages.some(item => item.content?.some(part => part.type === 'refusal'))) fail('PROVIDER_REFUSAL');
  if (messages.length !== 1 || messages[0].role !== 'assistant' || !Array.isArray(messages[0].content)
    || messages[0].content.length !== 1 || messages[0].content[0].type !== 'output_text'
    || typeof messages[0].content[0].text !== 'string') fail('INVALID_OUTPUT');
  return messages[0].content[0].text;
}

function usageFor(response) {
  if (response.usage === undefined || response.usage === null) return null;
  const usage = {
    inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens,
  };
  if (Object.values(usage).some(n => !Number.isSafeInteger(n) || n < 0)
    || usage.inputTokens + usage.outputTokens !== usage.totalTokens) fail('INVALID_OUTPUT');
  return usage;
}

function receiptFor(request, candidate, output, response) {
  const usage = usageFor(response);
  const receipt = {
    schemaVersion: 'model-adapter-receipt/1', requestHash: request.requestHash, responseHash: digest(candidate),
    adapterVersion: ADAPTER_SPEC.adapterVersion, outputHash: sha256(output),
    effectiveModel: response.model ?? null, version: null, usage,
    nullReasons: { ...(response.model == null ? { effectiveModel: 'not_reported' } : {}),
      version: 'not_reported', ...(usage === null ? { usage: 'not_reported' } : {}) },
  };
  return validateAdapterReceipt(request, candidate, receipt);
}

export async function requestAdapter(corpus, request, { enabled = false, confirmPublic, env = process.env } = {},
  { fetch: transport = globalThis.fetch, timeoutMs = ADAPTER_LIMITS.timeoutMs } = {}) {
  const key = configuration(enabled, env);
  verifyCampaignRequest(corpus, request);
  if (request.schemaVersion !== ADAPTER_REQUEST_VERSION) fail('REQUEST_TAMPERED');
  if (confirmPublic !== request.requestHash) fail('TRANSMISSION_DENIED');
  const body = adapterPayload(request);
  if (!Number.isFinite(timeoutMs) || timeoutMs > ADAPTER_LIMITS.timeoutMs) fail('INVALID_INPUT');
  const controller = new AbortController();
  try {
    const text = await deadline(async () => {
      let response;
      try {
        response = await transport(ADAPTER_SPEC.endpoint, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body,
        });
      } catch {
        if (controller.signal.aborted) fail('TIMEOUT');
        fail('PROVIDER_ERROR');
      }
      if (!response.ok) {
        await response.body?.cancel();
        fail(response.status === 429 ? 'RATE_LIMIT' : [401, 403].includes(response.status) ? 'PROVIDER_AUTH' : 'PROVIDER_ERROR');
      }
      return responseText(response);
    }, controller, timeoutMs);
    if (text.includes(key)) fail('PROVIDER_ERROR');
    return text;
  } catch (error) {
    if (controller.signal.aborted) fail('TIMEOUT');
    if (safeCodes.has(error.code)) throw error;
    fail('PROVIDER_ERROR');
  } finally { controller.abort(); }
}

async function unusedArtifacts(outputFile) {
  if (typeof outputFile !== 'string' || !path.isAbsolute(outputFile)) fail('UNSAFE_PATH');
  const verify = await privateDirectory(path.dirname(outputFile));
  const files = {
    candidate: outputFile, receipt: `${outputFile}.receipt.json`,
    attempt: `${outputFile}.attempt.json`, result: `${outputFile}.result.json`,
  };
  for (const file of Object.values(files)) {
    try { await lstat(file); fail('ARTIFACT_EXISTS'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await verify();
  return files;
}

export async function runAdapter({ command, store, caseId, revisionIds, requestFile, outputFile,
  enabled = false, confirmPublic, env = process.env } = {}, deps = {}) {
  let files, request, usage = null, candidateSaved = false, receiptSaved = false;
  const started = Date.now();
  try {
    if (!['prepare', 'generate'].includes(command)) fail('INVALID_INPUT');
    if (process.platform === 'win32') fail('UNSUPPORTED_PLATFORM');
    if (typeof store !== 'string') fail('UNSAFE_PATH');
    const verifyStore = await privateDirectory(store);
    const corpus = await validatePrivateCorpus(path.join(store, 'corpus.json'), { reviewAware: true });
    await verifyStore();
    if (command === 'prepare') {
      request = prepareAdapterCampaign(corpus, { caseId, revisionIds });
      adapterPayload(request);
      await privateOutput(outputFile, request);
      return { status: 'succeeded', command, requestHash: request.requestHash, prepared: true, generated: false };
    }
    configuration(enabled, env);
    try { request = JSON.parse(await readPrivateTemplate(requestFile)); }
    catch (error) {
      if (error instanceof SyntaxError) fail('INVALID_INPUT');
      throw error;
    }
    verifyCampaignRequest(corpus, request);
    if (request.schemaVersion !== ADAPTER_REQUEST_VERSION) fail('REQUEST_TAMPERED');
    if (confirmPublic !== request.requestHash) fail('TRANSMISSION_DENIED');
    adapterPayload(request);
    files = await unusedArtifacts(outputFile);
    await privateOutput(files.attempt, {
      schemaVersion: 'model-adapter-attempt/1', requestHash: request.requestHash, provider: ADAPTER_SPEC,
      publicResearchConfirmed: true, limits: ADAPTER_LIMITS, startedAt: new Date(started).toISOString(),
      warning: 'One potentially billable attempt. A timeout does not establish cancellation or zero cost.',
    });
    const response = await requestAdapter(corpus, request, { enabled, confirmPublic, env }, {
      ...deps, timeoutMs: ADAPTER_LIMITS.timeoutMs - (Date.now() - started),
    });
    let envelope;
    try { envelope = JSON.parse(response); } catch { fail('INVALID_OUTPUT'); }
    if (!envelope || typeof envelope !== 'object') fail('INVALID_OUTPUT');
    if (JSON.stringify(envelope).includes(env.OPENAI_API_KEY)) fail('PROVIDER_ERROR');
    // Save returned text before parsing/validation, even if a completed call is stale or malformed.
    const output = outputText(envelope);
    if (output.includes(env.OPENAI_API_KEY)) fail('PROVIDER_ERROR');
    await privateOutput(files.candidate, output, { raw: true });
    candidateSaved = true;
    usage = usageFor(envelope);
    if (envelope.status !== 'completed') fail('INCOMPLETE_OUTPUT');
    let candidate;
    try { candidate = JSON.parse(output); } catch { fail('INVALID_OUTPUT'); }
    const receipt = receiptFor(request, candidate, output, envelope);
    await privateOutput(files.receipt, receipt);
    receiptSaved = true;
    const current = await validatePrivateCorpus(path.join(store, 'corpus.json'), { reviewAware: true });
    await verifyStore();
    validateCampaignCandidate(current, request, candidate, receipt);
    await privateOutput(files.result, {
      schemaVersion: 'model-adapter-result/1', status: 'succeeded', requestHash: request.requestHash,
      candidateSaved, receiptSaved, applied: false, usage,
    });
    return { status: 'succeeded', command, requestHash: request.requestHash,
      candidateSaved, receiptSaved, applied: false, pending: true };
  } catch (error) {
    const result = { status: 'failed', code: safeCode(error), candidateSaved, receiptSaved, applied: false };
    if (files) {
      try {
        await privateOutput(files.result, { schemaVersion: 'model-adapter-result/1', ...result,
          requestHash: request.requestHash, usage,
          recovery: 'Inspect retained artifacts. Re-prepare stale input; never rehash/rebase it. Explicit retry may incur another charge.' });
      } catch { return { ...result, code: 'PERSISTENCE', retentionUncertain: true }; }
    }
    return result;
  }
}
