import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalSerialize, digest, sha256, validatePrivateCorpus, updatePrivateCorpus } from '../scripts/contract.mjs';
import {
  ADAPTER_SPEC, prepareAdapterCampaign, prepareCampaign, verifyCampaignRequest, validateCampaignCandidate,
  applyCampaign, validateCampaignSnapshot, campaignAnnotations, campaignStatus, campaignExport, runCampaign,
} from '../src/campaign.mjs';
import { ADAPTER_LIMITS, adapterPayload, requestAdapter, runAdapter } from '../src/model-adapter.mjs';
import { applyItemReview, reviewSnapshot, reviewedProfile } from '../src/hitl.mjs';
import { GUIDE_VERSION, checksFor } from '../src/review-guide.mjs';
import { applyStage, prepareStage, validateStageCandidate } from '../src/stages.mjs';
import { privateStoreTest } from './platform.mjs';

const fixture = async () => JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
const env = { OPENAI_API_KEY: 'synthetic-not-a-credential' };
const candidateFor = request => ({
  schemaVersion: 'campaign-candidate/1', requestHash: request.requestHash,
  model: { effectiveModel: 'model-authored-assertion', version: 'not-provider-provenance', nullReasons: {} },
  coverage: request.inputs.flatMap(input => input.segments.map(s => ({ segmentId: s.id, status: 'completed', reason: null }))),
  claims: [{
    id: 'first', sourceRevisionId: 'synthetic-revision-a', description: 'Synthetic source-local observation.',
    evidenceStatus: 'Source-reported observation',
    passages: [{ segmentId: request.inputs.find(i => i.sourceRevisionId === 'synthetic-revision-a').segments[0].id,
      quote: '😀 Café', occurrence: 0 }],
    supportingClaimIds: [], rationale: null, conflictsWith: [], uncertainty: null, observationContext: null,
    nullReasons: { rationale: 'not_applicable', uncertainty: 'not_reported', observationContext: 'not_reported' },
  }],
  absences: [], limitations: ['Synthetic untrusted candidate; not incident acceptance.'],
});
const envelope = candidate => ({
  status: 'completed', model: ADAPTER_SPEC.requestedModel,
  usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }],
});
const receiptFor = (request, candidate) => ({
  schemaVersion: 'model-adapter-receipt/1', requestHash: request.requestHash, responseHash: digest(candidate),
  adapterVersion: ADAPTER_SPEC.adapterVersion, effectiveModel: ADAPTER_SPEC.requestedModel,
  version: null, usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  outputHash: sha256(JSON.stringify(candidate)), nullReasons: { version: 'not_reported' },
});
const options = request => ({ enabled: true, confirmPublic: request.requestHash, env });
const decision = (corpus, itemKey, action = 'accept', extra = {}) => applyItemReview(corpus, {
  snapshot: reviewSnapshot(corpus).snapshot, itemKey, action, reviewer: 'synthetic-human',
  selfAttested: true, guideVersion: GUIDE_VERSION, rationale: 'Synthetic review for adapter isolation.',
  ...(action === 'accept' ? {
    checks: Object.fromEntries(Object.keys(checksFor(itemKey.split(':')[0])).map(k => [k, { result: 'pass' }])),
  } : {}), ...extra,
});

test('#83 AC-01/02 manual default remains request/2; adapter request/3 binds provider, model and unchanged chunks', async () => {
  const c = await fixture(), before = digest(c), manual = prepareCampaign(c, { caseId: c.cases[0].id });
  const request = prepareAdapterCampaign(c, { caseId: c.cases[0].id });
  assert.equal(manual.schemaVersion, 'campaign-request/2');
  assert.equal(manual.provider.id, 'codex-chat-handoff');
  assert.equal(request.schemaVersion, 'campaign-request/3');
  assert.deepEqual(request.inputs, manual.inputs);
  assert.deepEqual(request.prompt, manual.prompt);
  assert.equal(request.extractionVersion, 'campaign-extraction/3');
  assert.deepEqual(request.provider, { ...ADAPTER_SPEC, nullReasons: {} });
  assert.ok(!request.limitations[0].includes('researcher handoff'));
  verifyCampaignRequest(c, request);
  for (const change of [
    r => { r.provider.endpoint = 'https://example.invalid'; },
    r => { r.provider.requestedModel = 'fallback'; },
    r => { r.inputs[0].segments[0].text += 'tampered'; },
    r => { r.chunkPolicy.maxTokens++; }, r => { r.prompt.text += 'changed'; },
  ]) {
    const changed = structuredClone(request);
    change(changed);
    const { requestHash, ...body } = changed;
    changed.requestHash = digest(body);
    assert.throws(() => verifyCampaignRequest(c, changed));
  }
  assert.equal(digest(c), before);
});

test('#83 AC-01/07 manual preparation, application, review/status and export never use adapter transport', async () => {
  const c = await fixture(), original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected model call.'); };
  try {
    const request = prepareCampaign(c, { caseId: c.cases[0].id });
    applyCampaign(c, request, candidateFor(request));
    reviewSnapshot(c); campaignStatus(c); campaignExport(c, c.cases[0].id);
    reviewedProfile(c);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('#83 AC-01/06 disabled, missing credential, denied consent and stale requests never invoke transport', async () => {
  const c = await fixture(), r = prepareAdapterCampaign(c, { caseId: c.cases[0].id });
  let calls = 0;
  const deps = { fetch: async () => { calls++; throw new Error('must not call'); } };
  for (const [opts, code] of [
    [{ ...options(r), enabled: false }, 'ADAPTER_DISABLED'],
    [{ ...options(r), env: {} }, 'MISSING_CONFIGURATION'],
    [{ ...options(r), confirmPublic: 'denied' }, 'TRANSMISSION_DENIED'],
  ]) await assert.rejects(requestAdapter(c, r, opts, deps), { code });
  const changed = structuredClone(c); changed.governance.note = 'concurrent governance change';
  await assert.rejects(requestAdapter(changed, r, options(r), deps), { code: 'STALE_INPUT' });
  assert.equal(calls, 0);
});

test('#83 AC-01/06 payload excludes review history/raw HTML and enforces exact byte/reference-token limits without truncation', async () => {
  const c = await fixture(); c.governance.unpublishedNote = 'PRIVATE-NOTE-MARKER';
  const r = prepareAdapterCampaign(c, { caseId: c.cases[0].id }), body = adapterPayload(r), p = JSON.parse(body);
  assert.equal(p.store, false); assert.equal(p.background, false); assert.deepEqual(p.tools, []);
  assert.equal(p.reasoning.effort, 'low'); assert.equal(p.max_output_tokens, 16_000);
  assert.equal(body.includes('PRIVATE-NOTE-MARKER'), false); assert.equal(body.includes('"rawContent"'), false);
  assert.deepEqual(JSON.parse(p.input).inputs, r.inputs);
  const large = structuredClone(r);
  large.inputs[0].segments[0].text = 'A'.repeat(ADAPTER_LIMITS.requestBytes);
  assert.throws(() => adapterPayload(large), { code: 'REQUEST_TOO_LARGE' });
  large.inputs[0].segments[0].text = ' a'.repeat(ADAPTER_LIMITS.referenceTokens + 1);
  assert.throws(() => adapterPayload(large), { code: 'REQUEST_TOO_LARGE' });
  const boundary = structuredClone(r);
  boundary.inputs[0].segments[0].text = '';
  const overhead = Buffer.byteLength(adapterPayload(boundary));
  boundary.inputs[0].segments[0].text = ' '.repeat(ADAPTER_LIMITS.requestBytes - overhead);
  assert.equal(Buffer.byteLength(adapterPayload(boundary)), ADAPTER_LIMITS.requestBytes);
  boundary.inputs[0].segments[0].text += ' ';
  assert.throws(() => adapterPayload(boundary), { code: 'REQUEST_TOO_LARGE' });
});

test('#83 AC-06 provider calls are single-attempt, fixed-destination, redirect-denied and redact diagnostic failures', async () => {
  const c = await fixture(), r = prepareAdapterCampaign(c, { caseId: c.cases[0].id });
  for (const [status, code] of [[429, 'RATE_LIMIT'], [401, 'PROVIDER_AUTH'], [403, 'PROVIDER_AUTH'], [500, 'PROVIDER_ERROR'], [302, 'PROVIDER_ERROR']]) {
    let calls = 0;
    await assert.rejects(requestAdapter(c, r, options(r), { fetch: async (url, init) => {
      calls++;
      assert.equal(url, ADAPTER_SPEC.endpoint); assert.equal(init.redirect, 'error');
      assert.equal(init.headers.Authorization, `Bearer ${env.OPENAI_API_KEY}`);
      return new Response(`sensitive provider diagnostic ${env.OPENAI_API_KEY}`, { status });
    } }), error => error.code === code && !error.message.includes(env.OPENAI_API_KEY));
    assert.equal(calls, 1);
  }
  await assert.rejects(requestAdapter(c, r, options(r), {
    fetch: async () => { throw new Error(`network diagnostic ${env.OPENAI_API_KEY}`); },
  }), { code: 'PROVIDER_ERROR' });
  await assert.rejects(requestAdapter(c, r, options(r), {
    fetch: async () => new Response(env.OPENAI_API_KEY),
  }), { code: 'PROVIDER_ERROR' });
  await assert.rejects(requestAdapter(c, r, options(r), {
    fetch: async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error(`stream diagnostic ${env.OPENAI_API_KEY}`)); },
    })),
  }), error => error.code === 'PROVIDER_ERROR' && !error.message.includes(env.OPENAI_API_KEY));
});

test('#83 AC-06 deadline aborts a delayed provider and response byte limit applies without content-length', async () => {
  const c = await fixture(), r = prepareAdapterCampaign(c, { caseId: c.cases[0].id });
  let signal;
  await assert.rejects(requestAdapter(c, r, options(r), {
    timeoutMs: 5, fetch: async (url, init) => { signal = init.signal; return new Promise(() => {}); },
  }), { code: 'TIMEOUT' });
  assert.equal(signal.aborted, true);
  await assert.rejects(requestAdapter(c, r, options(r), {
    fetch: async () => new Response('x'.repeat(ADAPTER_LIMITS.responseBytes + 1)),
  }), { code: 'OUTPUT_TOO_LARGE' });
  const exact = 'x'.repeat(ADAPTER_LIMITS.responseBytes);
  assert.equal((await requestAdapter(c, r, options(r), { fetch: async () => new Response(exact) })).length, exact.length);
});

test('#83 AC-02/03/04 receipt provenance differs from candidate assertions; explicit apply is Pending and replay-safe', async () => {
  const c = await fixture(), r = prepareAdapterCampaign(c, { caseId: c.cases[0].id }), candidate = candidateFor(r);
  const receipt = receiptFor(r, candidate), before = digest(c);
  assert.throws(() => validateCampaignCandidate(c, r, candidate), { code: 'INVALID_ADAPTER_RECEIPT' });
  const { run } = validateCampaignCandidate(c, r, candidate, receipt);
  assert.equal(digest(c), before); assert.equal(run.schemaVersion, 'campaign-run/4');
  assert.equal(run.provider.effectiveModel, 'gpt-6-luna');
  assert.equal(run.provider.version, null); assert.deepEqual(run.transport.usage, receipt.usage);
  assert.ok(run.segmentCoverage.every(s => Number.isSafeInteger(s.start) && Number.isSafeInteger(s.end)));
  applyCampaign(c, r, candidate, receipt);
  assert.ok(run.claimIds.every(id => c.claims.find(claim => claim.id === id).disposition === 'Pending'));
  assert.ok(reviewSnapshot(c).units.filter(u => run.claimIds.includes(u.id)).every(u => !u.eligible && !u.history.length));
  const applied = canonicalSerialize(c);
  assert.equal(applyCampaign(c, r, candidate, receipt).replay, true);
  assert.equal(canonicalSerialize(c), applied);
  const laterReceipt = structuredClone(receipt);
  laterReceipt.usage = { inputTokens: 110, outputTokens: 60, totalTokens: 170 };
  assert.equal(applyCampaign(c, r, candidate, laterReceipt).replay, true);
  assert.equal(canonicalSerialize(c), applied, 'another attempt cannot rewrite the original run provenance');
  for (const change of [
    value => { value.transport.usage.totalTokens++; },
    value => { value.provider.effectiveModel = 'invented'; },
    value => { value.segmentCoverage[0].start++; },
  ]) {
    const tampered = structuredClone(c), run = tampered.governance.campaignExtraction.runs[0];
    change(run); const { envelopeHash, ...body } = run; run.envelopeHash = digest(body);
    assert.throws(() => validateCampaignSnapshot(tampered));
  }
});

test('#83 AC-03 valid receipts cannot bypass exact support, coverage, schema or human-review field rejection', async () => {
  const c = await fixture(), r = prepareAdapterCampaign(c, { caseId: c.cases[0].id });
  for (const mutate of [
    value => { value.claims[0].origin = 'Human authored'; },
    value => { value.claims[0].disposition = 'Accepted'; },
    value => { value.claims[0].history = [{ action: 'accept' }]; },
    value => { value.claims[0].passages[0].quote = 'invented'; },
    value => { value.coverage.pop(); },
    value => { value.claims[0].sourceRevisionId = 'unknown'; },
    value => { value.checks = { evidence: { result: 'pass' } }; },
  ]) {
    const candidate = candidateFor(r); mutate(candidate);
    assert.throws(() => validateCampaignCandidate(c, r, candidate, receiptFor(r, candidate)));
  }
});

test('#83 AC-02/07 adapter receipts and landed manual stages coexist in either application order', async () => {
  for (const stageFirst of [false, true]) {
    const c = await fixture(), runs = [];
    const ground = () => {
      const request = prepareStage(c, { caseId: c.cases[0].id, kind: 'ground' });
      const { claims } = candidateFor(request);
      const candidate = {
        schemaVersion: 'campaign-stage-candidate/1', requestHash: request.requestHash, kind: 'ground',
        model: { effectiveModel: null, version: null, nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
        processing: request.inputs.flatMap(i => i.segments.map(s => ({ inputId: s.id, status: 'completed', reason: null }))),
        outputs: { claims, artifacts: [] }, limitations: ['Synthetic integration only.'],
      };
      const run = validateStageCandidate(c, request, candidate);
      applyStage(c, request, candidate);
      runs.push(run);
      assert.equal(run.schemaVersion, 'campaign-stage-run/1');
      assert.equal(Object.hasOwn(run, 'transport'), false);
    };
    const adapter = () => {
      const request = prepareAdapterCampaign(c, { caseId: c.cases[0].id }), candidate = candidateFor(request);
      const receipt = receiptFor(request, candidate);
      assert.throws(() => validateCampaignCandidate(c, request, candidate, { runId: 'not-a-receipt' }),
        { code: 'INVALID_CAMPAIGN' });
      assert.throws(() => validateCampaignCandidate(c, request, candidate, { ...receipt, requestHash: '0'.repeat(64) }),
        { code: 'INVALID_ADAPTER_RECEIPT' });
      const { run } = validateCampaignCandidate(c, request, candidate, receipt);
      applyCampaign(c, request, candidate, receipt);
      runs.push(run);
      assert.equal(run.schemaVersion, 'campaign-run/4');
      assert.deepEqual(run.transport, receipt);
    };
    for (const apply of stageFirst ? [ground, adapter] : [adapter, ground]) {
      apply();
      validateCampaignSnapshot(c);
    }
    const adapterRun = runs.find(run => run.schemaVersion === 'campaign-run/4');
    const request = prepareStage(c, { caseId: c.cases[0].id, kind: 'interpret',
      inputKeys: [`claims:${adapterRun.claimIds[0]}`] });
    assert.equal(request.upstream[0].runIds.includes(adapterRun.id), true);
    assert.equal(new Set(runs.flatMap(run => run.claimIds)).size, 2);
    const units = reviewSnapshot(c).units.filter(u => runs.some(run => run.claimIds.includes(u.id)));
    assert.equal(units.length, 2);
    assert.ok(units.every(u => !u.eligible && !u.history.length));
    assert.equal(prepareCampaign(c, { caseId: c.cases[0].id }).provider.id, 'codex-chat-handoff');
  }
});

test('#83 AC-04 regeneration retains accepted/modified/excluded/unsure claims, tools/prompts, behaviors and dependent mappings', async () => {
  const c = await fixture();
  const revision = c.sourceRevisions.find(r => r.id === 'synthetic-revision-a');
  revision.normalizedContent += '\nPublished tool Codex and prompt Say hello are benign examples.\n';
  revision.rawContent = revision.normalizedContent;
  revision.normalizedHash = sha256(revision.normalizedContent); revision.rawHash = revision.normalizedHash;
  const make = request => {
    const candidate = candidateFor(request);
    candidate.claims[0].passages[0].quote = 'Published tool Codex and prompt Say hello are benign examples.';
    candidate.artifacts = [
      { kind: 'ide-cli', literal: 'Codex', supportingClaimIds: ['first'] },
      { kind: 'prompt-instruction', literal: 'Say hello', supportingClaimIds: ['first'] },
    ];
    candidate.behaviors = [{
      localId: 'behavior', name: 'Synthetic behavior', description: 'Synthetic source-supported definition.',
      boundary: 'No operational deployment.', supportingClaimIds: ['first'],
    }];
    candidate.mappings = [{
      localId: 'mapping', behaviorId: 'behavior', framework: 'ATT&CK', version: '19.2', techniqueId: 'T1059',
      rationale: 'Bounded synthetic analogy.', applicability: 'Synthetic regression only.',
      supportingClaimIds: ['first'], mappingBasis: 'researcher-proposed',
    }];
    return candidate;
  };
  let r = prepareAdapterCampaign(c, { caseId: c.cases[0].id }), candidate = make(r);
  applyCampaign(c, r, candidate, receiptFor(r, candidate));
  const run = c.governance.campaignExtraction.runs[0], annotations = campaignAnnotations(c);
  const decide = (itemKey, action, extra = {}) => applyItemReview(c, {
    snapshot: reviewSnapshot(c).snapshot, itemKey, action, reviewer: 'synthetic-human',
    selfAttested: true, guideVersion: GUIDE_VERSION, rationale: 'Synthetic adapter regression only.',
    ...(action === 'accept' ? {
      checks: Object.fromEntries(Object.keys(checksFor(itemKey.split(':')[0])).map(k => [k, { result: 'pass' }])),
    } : {}), ...extra,
  });
  const claimKey = `claims:${run.claimIds[0]}`;
  decide(claimKey, 'modify', { patch: { description: 'Human corrected generated claim.' } });
  decide(claimKey, 'accept');
  const tools = annotations.filter(a => a.type === 'commands-ai-artifacts');
  decide(`annotations:${tools.find(a => a.context.artifactKind === 'ide-cli').id}`, 'exclude',
    { exclusionReason: 'insufficient evidence' });
  decide(`annotations:${tools.find(a => a.context.artifactKind === 'prompt-instruction').id}`, 'unsure');
  decide(`behaviors:${run.records.behaviors[0].id}`, 'accept');
  const mappingKey = `mappings:${run.records.mappings[0].id}`;
  decide(mappingKey, 'accept');
  const history = structuredClone(c.governance.localReview), originalRun = structuredClone(run);
  const oldStates = new Map(reviewSnapshot(c).units.filter(u => u.history.length).map(u => [u.itemKey, u.state]));
  r = prepareAdapterCampaign(c, { caseId: c.cases[0].id }); candidate = make(r);
  candidate.claims[0].description = 'Changed regenerated candidate cannot inherit human approval.';
  applyCampaign(c, r, candidate, receiptFor(r, candidate));
  assert.deepEqual(c.governance.localReview, history);
  assert.deepEqual(c.governance.campaignExtraction.runs[0], originalRun);
  const snapshot = reviewSnapshot(c);
  for (const [key, state] of oldStates) assert.equal(snapshot.units.find(u => u.itemKey === key).state, state);
  const next = c.governance.campaignExtraction.runs[1];
  assert.ok(snapshot.units.filter(u => next.claimIds.includes(u.id)).every(u => !u.eligible && !u.history.length));
  assert.ok(reviewedProfile(c).records.every(row => !next.claimIds.includes(row.entity.id)));
  decide(claimKey, 'modify', { patch: { description: 'Changed supporting correction invalidates dependent mapping.' } });
  const changed = reviewSnapshot(c).units.find(u => u.itemKey === mappingKey);
  assert.equal(changed.eligible, false);
  assert.equal(changed.stale, true);
});

async function setup(t, corpus) {
  const root = fileURLToPath(new URL('../.private-intake/', import.meta.url));
  await mkdir(root, { mode: 0o700, recursive: true });
  const store = await mkdtemp(path.join(root, 'adapter-test-'));
  t.after(() => rm(store, { recursive: true, force: true }));
  await writeFile(path.join(store, 'corpus.json'), canonicalSerialize(corpus), { mode: 0o600 });
  const request = prepareAdapterCampaign(corpus, { caseId: corpus.cases[0].id });
  const requestFile = path.join(store, 'request.json'), outputFile = path.join(store, 'candidate.json');
  await writeFile(requestFile, canonicalSerialize(request), { mode: 0o600 });
  return { store, request, requestFile, outputFile, command: 'generate', ...options(request) };
}

privateStoreTest('#83 AC-01/03/06 CLI preparation/generation never applies; artifacts are protected and refusals/malformed output recover explicitly', async t => {
  const c = await fixture(), opts = await setup(t, c), candidate = candidateFor(opts.request);
  const before = await readFile(path.join(opts.store, 'corpus.json'), 'utf8');
  const preparedFile = path.join(opts.store, 'cli-request.json');
  const prepared = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/extract.mjs', import.meta.url)),
    'campaign', 'prepare-adapter', '--store', opts.store, '--case', c.cases[0].id, '--output', preparedFile],
  { encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' } });
  assert.equal(prepared.status, 0, prepared.stdout);
  assert.deepEqual(JSON.parse(await readFile(preparedFile, 'utf8')), opts.request);
  assert.equal(JSON.parse(prepared.stdout).generated, false);
  const result = await runAdapter(opts, { fetch: async () => Response.json(envelope(candidate)) });
  assert.equal(result.status, 'succeeded'); assert.equal(result.applied, false);
  assert.equal(await readFile(path.join(opts.store, 'corpus.json'), 'utf8'), before);
  for (const file of [opts.outputFile, ...['receipt', 'attempt', 'result'].map(s => `${opts.outputFile}.${s}.json`)]) {
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await readFile(file, 'utf8')).includes(env.OPENAI_API_KEY), false);
  }
  let calls = 0;
  assert.equal((await runAdapter(opts, { fetch: async () => { calls++; } })).code, 'ARTIFACT_EXISTS');
  assert.equal(calls, 0);
  const apply = await runCampaign({ command: 'apply', store: opts.store, requestFile: opts.requestFile,
    inputFile: opts.outputFile, receiptFile: `${opts.outputFile}.receipt.json` });
  assert.equal(apply.status, 'succeeded');
  assert.equal((await runCampaign({ command: 'apply', store: opts.store, requestFile: opts.requestFile,
    inputFile: opts.outputFile, receiptFile: `${opts.outputFile}.receipt.json` })).replay, true);
  const receipt = JSON.parse(await readFile(`${opts.outputFile}.receipt.json`, 'utf8'));
  receipt.outputHash = '0'.repeat(64);
  await writeFile(`${opts.outputFile}.receipt.json`, canonicalSerialize(receipt), { mode: 0o600 });
  assert.equal((await runCampaign({ command: 'apply', store: opts.store, requestFile: opts.requestFile,
    inputFile: opts.outputFile, receiptFile: `${opts.outputFile}.receipt.json` })).code, 'INVALID_ADAPTER_RECEIPT');

  for (const [text, status, code] of [['not JSON', 'completed', 'INVALID_OUTPUT'], ['{"partial":', 'incomplete', 'INCOMPLETE_OUTPUT']]) {
    const opts = await setup(t, c), response = envelope({});
    response.status = status; response.output[0].content[0].text = text;
    const result = await runAdapter(opts, { fetch: async () => Response.json(response) });
    assert.equal(result.code, code); assert.equal(result.candidateSaved, true);
    assert.equal(await readFile(opts.outputFile, 'utf8'), text);
    assert.equal(JSON.parse(await readFile(`${opts.outputFile}.result.json`, 'utf8')).usage.totalTokens, 150);
  }
});

privateStoreTest('#83 AC-04/05 delayed generation preserves concurrent human edits and stale candidate, without rebase', async t => {
  const c = await fixture(), opts = await setup(t, c), candidate = candidateFor(opts.request);
  const result = await runAdapter(opts, { fetch: async () => {
    const review = await updatePrivateCorpus(opts.store, current => {
      decision(current, 'claims:synthetic-claim-a', 'modify', { patch: { description: 'Human correction during provider call.' } });
      decision(current, 'claims:synthetic-claim-b', 'unsure');
    }, { reviewAware: true });
    assert.equal(review.status, 'succeeded');
    return Response.json(envelope(candidate));
  } });
  assert.equal(result.code, 'STALE_INPUT'); assert.equal(result.candidateSaved, true); assert.equal(result.receiptSaved, true);
  const current = await validatePrivateCorpus(path.join(opts.store, 'corpus.json'), { reviewAware: true });
  assert.equal(current.governance.localReview.events.length, 2);
  assert.equal(reviewSnapshot(current).units.find(u => u.id === 'synthetic-claim-a').record.description, 'Human correction during provider call.');
  const receipt = JSON.parse(await readFile(`${opts.outputFile}.receipt.json`, 'utf8'));
  assert.throws(() => applyCampaign(current, opts.request, candidate, receipt), { code: 'STALE_INPUT' });
});

privateStoreTest('#83 AC-03/06 refusal, tool output, unsupported model, failed provider and artifact-write failures are explicit', async t => {
  const c = await fixture();
  const scenarios = [
    ['PROVIDER_REFUSAL', response => { response.output[0].content = [{ type: 'refusal', refusal: 'Refused.' }]; }],
    ['INVALID_OUTPUT', response => { response.output.push({ type: 'function_call', name: 'must_not_execute' }); }],
    ['UNSUPPORTED_MODEL', response => { response.model = 'fallback-not-authorized'; }],
  ];
  for (const [code, mutate] of scenarios) {
    const opts = await setup(t, c), response = envelope(candidateFor(opts.request)); mutate(response);
    assert.equal((await runAdapter(opts, { fetch: async () => Response.json(response) })).code, code);
    assert.equal(JSON.parse(await readFile(`${opts.outputFile}.result.json`, 'utf8')).code, code);
  }
  const opts = await setup(t, c);
  const failed = await runAdapter(opts, { fetch: async () => new Response(`private diagnostic ${env.OPENAI_API_KEY}`, { status: 429 }) });
  assert.equal(failed.code, 'RATE_LIMIT');
  assert.equal((await readFile(`${opts.outputFile}.result.json`, 'utf8')).includes(env.OPENAI_API_KEY), false);
  const collision = await setup(t, c);
  const before = await readFile(path.join(collision.store, 'corpus.json'), 'utf8');
  const persistence = await runAdapter(collision, { fetch: async () => {
    await mkdir(collision.outputFile, { mode: 0o700 });
    return Response.json(envelope(candidateFor(collision.request)));
  } });
  assert.equal(persistence.status, 'failed');
  assert.equal(persistence.code, 'UNSAFE_PATH');
  assert.equal(persistence.candidateSaved, false);
  assert.equal(persistence.receiptSaved, false);
  assert.equal((await stat(collision.outputFile)).isDirectory(), true);
  assert.equal(await readFile(path.join(collision.store, 'corpus.json'), 'utf8'), before);
  assert.equal(JSON.parse(await readFile(`${collision.outputFile}.result.json`, 'utf8')).code, 'UNSAFE_PATH');
  await assert.rejects(readFile(`${collision.outputFile}.receipt.json`, 'utf8'), { code: 'ENOENT' });
});

privateStoreTest('#83 AC-06 failure-manifest collision reports uncertain persistence without overwriting artifacts', async t => {
  const c = await fixture(), opts = await setup(t, c), sentinel = 'Existing artifact must not be overwritten.';
  const result = await runAdapter(opts, { fetch: async () => {
    await mkdir(opts.outputFile, { mode: 0o700 });
    await writeFile(`${opts.outputFile}.result.json`, sentinel, { mode: 0o600, flag: 'wx' });
    return Response.json(envelope(candidateFor(opts.request)));
  } });
  assert.deepEqual(result, { status: 'failed', code: 'PERSISTENCE', candidateSaved: false,
    receiptSaved: false, applied: false, retentionUncertain: true });
  assert.equal(await readFile(`${opts.outputFile}.result.json`, 'utf8'), sentinel);
  assert.equal((await stat(opts.outputFile)).isDirectory(), true);
  assert.equal(await readFile(path.join(opts.store, 'corpus.json'), 'utf8'), canonicalSerialize(c));
});

test('#83 AC-07 CLI rejects unknown/missing flags without exposing environment credentials', () => {
  const entry = fileURLToPath(new URL('../scripts/extract.mjs', import.meta.url));
  for (const args of [['campaign', 'generate'], ['campaign', 'generate', '--api-key', env.OPENAI_API_KEY]]) {
    const result = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
    assert.equal(result.status, 1); assert.equal(result.stdout.includes(env.OPENAI_API_KEY), false);
    assert.ok(JSON.parse(result.stdout).code);
  }
});
