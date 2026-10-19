import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertValid, canonicalSerialize, digest, sha256 } from '../scripts/contract.mjs';
import { restorePendingDraft, runPendingRecovery } from '../src/nx-recovery.mjs';
import { readEnrichmentSnapshot, validateEnrichment } from '../src/enrichment.mjs';
import { applyItemReview, reviewSnapshot } from '../src/hitl.mjs';
import { GUIDE_VERSION, checksFor } from '../src/review-guide.mjs';
import { privateStoreTest } from './platform.mjs';

async function fixture() {
  const evidence = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
  const responseClaim = { ...structuredClone(evidence.claims[0]), id: 'synthetic-response-claim',
    description: 'Synthetic response evidence, not a real AI exchange.', conflictsWith: [] };
  evidence.claims.push(responseClaim);
  evidence.behaviors = [{
    id: 'synthetic-recovered-behavior', namespace: 'Synthetic fixture', name: 'Synthetic behavior',
    description: 'Synthetic behavior only, not incident evidence.', boundary: 'Synthetic boundary',
    caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'], signalIds: [], detectionIds: [], otelIds: [],
    origin: 'LLM normalized behavior', disposition: 'Pending',
    occurrences: [{ caseId: 'synthetic-case-a', claimIds: ['synthetic-claim-a'],
      origin: 'LLM source paraphrase', disposition: 'Pending' }],
  }];
  const rows = Object.entries(evidence).filter(([, value]) => Array.isArray(value))
    .filter(([type]) => !['reviews', 'collectionManifests'].includes(type))
    .flatMap(([entityType, entries]) => entries.map(value => {
      const entity = structuredClone(value);
      if (entityType === 'sourceRevisions') {
        entity.rawContent = null;
        entity.normalizedContent = null;
        entity.nullReasons = { rawContent: 'not_applicable', normalizedContent: 'not_applicable' };
      }
      if (entityType === 'passages') {
        entity.text = null;
        entity.nullReasons.text = 'not_applicable';
      }
      return { schemaVersion: '0.3.0', entityType, entity, warnings: ['Draft profile; synthetic test only.'] };
    }));
  const revision = evidence.sourceRevisions[0];
  const support = { locator: { start: 2, end: 6 }, sha256: sha256('Caf\u00e9') };
  const document = {
    schemaVersion: 'public-draft/1', profile: 'draft', records: rows, snapshotDigest: digest(rows),
    sourceCoverage: evidence.sources.map(source => {
      const revisions = evidence.sourceRevisions.filter(revision => revision.sourceId === source.id);
      return { sourceId: source.id, url: source.canonicalUrl ?? 'https://example.invalid/synthetic-a', status: 'collected',
        revisions: revisions.map(revision => ({ id: revision.id, normalizedHash: revision.normalizedHash,
          codePoints: [...revision.normalizedContent].length })) };
    }),
    tools: [{ id: 'synthetic-tool', literal: 'Caf\u00e9', usage: 'general-mention', caseId: 'synthetic-case-a',
      sourceId: 'synthetic-source-a', sourceRevisionId: revision.id, claimId: 'synthetic-claim-a' }],
    prompts: [{ id: 'synthetic-prompt', literal: 'Caf\u00e9', label: 'Synthetic prompt', usage: 'vendor-example',
      caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a', sourceRevisionId: revision.id,
      claimId: 'synthetic-claim-a', locator: { start: 2, end: 6 },
      responses: [{ schemaVersion: 'prompt-response/1', id: 'synthetic-response', text: 'Caf\u00e9',
        encoding: 'plain-text', role: 'unspecified', agent: 'unknown', model: 'unknown', outcome: 'unknown',
        observationContext: 'illustrative-example', contextBasis: 'Synthetic fixture only.',
        pairingBasis: 'Synthetic pairing only.', claimIds: [responseClaim.id], revisionHash: revision.normalizedHash,
        support: structuredClone(support), contextSupport: structuredClone(support) }] }],
    limitations: ['Entirely synthetic; no network or research approval.'],
  };
  return { document, evidence };
}

const rehash = document => { document.snapshotDigest = digest(document.records); };
const decision = (corpus, annotations, itemKey) => ({
  snapshot: reviewSnapshot(corpus, annotations).snapshot, itemKey, action: 'accept',
  reviewer: 'synthetic-human', selfAttested: true, guideVersion: GUIDE_VERSION,
  rationale: 'Synthetic test decision only.',
  checks: Object.fromEntries(Object.keys(checksFor(itemKey.split(':')[0])).map(key => [key, { result: 'pass' }])),
});

test('#91 AC-02 recovery preserves records/IDs, source-local artifact dependencies, Unicode and Pending history', async () => {
  const { document, evidence } = await fixture();
  const before = structuredClone({ document, evidence });
  const { corpus, enrichment, receipt } = restorePendingDraft(document, evidence);
  assertValid(corpus);
  assert.deepEqual({ document, evidence }, before);
  assert.equal(corpus.governance.publicDraft, undefined);
  assert.deepEqual(corpus.reviews, []);
  assert.equal(corpus.governance.campaignExtraction, undefined);
  for (const row of document.records) {
    const restored = corpus[row.entityType].find(record => record.id === row.entity.id);
    if (!['passages', 'sourceRevisions'].includes(row.entityType)) assert.deepEqual(restored, row.entity);
  }
  for (const revision of corpus.sourceRevisions) {
    assert.equal(revision.rawContent, null);
    assert.equal(sha256(revision.normalizedContent), revision.normalizedHash);
    assert.equal(revision.rawHash, document.records.find(row => row.entity.id === revision.id).entity.rawHash);
  }
  assert.deepEqual(enrichment.annotations.map(a => a.id), ['synthetic-tool', 'synthetic-prompt']);
  assert.deepEqual(enrichment.annotations[1].responses, document.prompts[0].responses);
  assert.equal(enrichment.annotations[0].support.quote, 'Caf\u00e9');
  assert.equal(enrichment.annotations[0].modelVersion, 'unknown-public-projection');
  assert.equal(enrichment.annotations[0].status, 'pending');
  assert.equal(receipt.sources.length, 2);
  assert.deepEqual(validateEnrichment(enrichment, corpus), []);
  const snapshot = reviewSnapshot(corpus, enrichment.annotations);
  assert.ok(snapshot.units.every(unit => !unit.eligible && !unit.currentHumanReview));
  assert.deepEqual(snapshot.units.find(u => u.id === 'synthetic-prompt').claimIds,
    ['synthetic-claim-a', 'synthetic-response-claim']);
  assert.deepEqual(corpus.behaviors, evidence.behaviors);
  assert.deepEqual(snapshot.units.find(u => u.id === 'synthetic-recovered-behavior').dependencies,
    ['claims:synthetic-claim-a']);
  assert.equal(snapshot.units.filter(u => u.type === 'occurrences').length, 1);
});

test('#91 AC-02 artifacts cannot be accepted before separately reviewed claim and response support', async () => {
  const { document, evidence } = await fixture();
  const { corpus, enrichment: { annotations } } = restorePendingDraft(document, evidence);
  const promptKey = 'annotations:synthetic-prompt';
  assert.throws(() => applyItemReview(corpus, decision(corpus, annotations, promptKey), annotations));
  applyItemReview(corpus, decision(corpus, annotations, 'claims:synthetic-claim-a'), annotations);
  assert.throws(() => applyItemReview(corpus, decision(corpus, annotations, promptKey), annotations));
  applyItemReview(corpus, decision(corpus, annotations, 'claims:synthetic-response-claim'), annotations);
  applyItemReview(corpus, decision(corpus, annotations, promptKey), annotations);
  assert.equal(reviewSnapshot(corpus, annotations).units.find(u => u.itemKey === promptKey).state, 'Accepted');
  corpus.passages[0].text = 'Changed synthetic evidence';
  assert.equal(reviewSnapshot(corpus, annotations).units.find(u => u.itemKey === promptKey).eligible, false);
});

test('#91 AC-01/03 recovery rejects missing/changed evidence, parser differences and source confusion', async () => {
  for (const mutate of [
    evidence => { evidence.sourceRevisions = []; evidence.sources.forEach(source => { source.revisionIds = []; }); },
    evidence => { evidence.sourceRevisions[0].normalizedHash = sha256('different'); },
    evidence => { evidence.sourceRevisions[0].parserVersion = 'another-parser/1'; },
    evidence => { evidence.sources[0].canonicalUrl = 'https://example.invalid/other';
      evidence.sources[0].originalUrl = evidence.sources[0].canonicalUrl; },
  ]) {
    const { document, evidence } = await fixture();
    mutate(evidence);
    assert.throws(() => restorePendingDraft(document, evidence));
  }
  const { document, evidence } = await fixture();
  document.sourceCoverage[0].revisions[0].codePoints++;
  assert.throws(() => restorePendingDraft(document, evidence), /MATCHING_EVIDENCE_REQUIRED/);
});

test('#91 AC-01/03 a newly fetched raw revision never overwrites the historical raw hash or identity', async () => {
  const { document, evidence } = await fixture();
  const revision = evidence.sourceRevisions[0];
  revision.id = 'synthetic-new-raw-revision';
  evidence.sources[0].revisionIds = [revision.id];
  revision.rawContent = revision.normalizedContent;
  revision.rawHash = sha256(revision.rawContent);
  evidence.passages[0].sourceRevisionId = revision.id;
  evidence.claims.filter(claim => claim.sourceId === revision.sourceId).forEach(claim => { claim.sourceRevisionId = revision.id; });
  for (const timeline of evidence.timelines) {
    timeline.sourceRevisionIds = timeline.sourceRevisionIds.map(id => id === 'synthetic-revision-a' ? revision.id : id);
  }
  for (const manifest of evidence.collectionManifests) {
    manifest.inputRevisionIds = manifest.inputRevisionIds.map(id => id === 'synthetic-revision-a' ? revision.id : id);
  }
  const restored = restorePendingDraft(document, evidence);
  assert.equal(restored.corpus.sourceRevisions[0].id, 'synthetic-revision-a');
  assert.equal(restored.corpus.sourceRevisions[0].rawHash, document.records.find(row => row.entity.id === 'synthetic-revision-a').entity.rawHash);
  assert.equal(restored.receipt.sources[0].historicalRawHashMatched, false);
  assert.equal(restored.receipt.sources[0].retrievalRevisions[0].id, revision.id);
});

test('#91 AC-01/02 malformed bounds, digest changes, forged quotation receipts and approvals fail closed', async () => {
  for (const mutate of [
    document => { document.records[0].entity.title = 'tampered'; },
    document => { document.records.find(row => row.entityType === 'claims').entity.disposition = 'Accepted'; rehash(document); },
    document => { document.records.find(row => row.entityType === 'passages').entity.end = 10000; rehash(document); },
    document => { document.expansion = { groundingReceipts: [{ claimId: 'synthetic-claim-a', sourceId: 'synthetic-source-a',
      revisionId: 'synthetic-revision-a', start: 2, end: 6,
      normalizedHash: document.sourceCoverage[0].revisions[0].normalizedHash, quoteHash: sha256('forged') }] }; },
    document => { document.tools[0].literal = 'not present'; },
    document => { document.prompts[0].responses[0].support.sha256 = sha256('forged'); },
    document => { document.prompts[0].responses[0].text = 'not the response'; },
    document => { document.coverage = { promptArtifacts: { schemaVersion: 'public-prompt-artifacts/1',
      prompts: document.prompts }, promptArtifactDigest: '0'.repeat(64) }; },
  ]) {
    const { document, evidence } = await fixture();
    mutate(document);
    assert.throws(() => restorePendingDraft(document, evidence));
  }
});

test('#91 AC-02 bound sidecar claim IDs reject missing, duplicate and cross-case/source/revision support', async () => {
  const { document, evidence } = await fixture();
  const { corpus, enrichment } = restorePendingDraft(document, evidence);
  for (const claimIds of [[], ['missing'], ['synthetic-claim-a', 'synthetic-claim-a'],
    ['synthetic-claim-b'], ['synthetic-claim-c']]) {
    const changed = structuredClone(enrichment);
    changed.annotations[0].claimIds = claimIds;
    assert.ok(validateEnrichment(changed, corpus).length);
  }
});

async function privateFixture(t) {
  const root = fileURLToPath(new URL('../.private-intake/', import.meta.url));
  await mkdir(root, { mode: 0o700, recursive: true });
  const directory = await mkdtemp(path.join(root, 'nx-recovery-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { document, evidence } = await fixture();
  const baselineFile = path.join(directory, 'baseline.json');
  const text = canonicalSerialize(document);
  await writeFile(baselineFile, text, { mode: 0o600 });
  const retrievalStore = path.join(directory, 'retrieval');
  await mkdir(retrievalStore, { mode: 0o700 });
  await writeFile(path.join(retrievalStore, 'corpus.json'), canonicalSerialize(evidence), { mode: 0o600 });
  return { baselineFile, baselineHash: sha256(text), retrievalStore, outputStore: path.join(directory, 'review') };
}

privateStoreTest('#91 AC-02/04 CLI creates a protected separate Pending store, refuses overwrites and preserves inputs', async t => {
  const options = await privateFixture(t);
  const before = await readFile(path.join(options.retrievalStore, 'corpus.json'), 'utf8');
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/extract.mjs', import.meta.url)),
    'recover-public', '--baseline', options.baselineFile, '--baseline-sha256', options.baselineHash,
    '--retrieval-store', options.retrievalStore, '--output-store', options.outputStore], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.equal(JSON.parse(child.stdout).pending, true);
  const corpusFile = path.join(options.outputStore, 'corpus.json');
  const corpusText = await readFile(corpusFile, 'utf8');
  const corpus = JSON.parse(corpusText);
  assertValid(corpus);
  const annotations = await readEnrichmentSnapshot(options.outputStore, corpus);
  assert.equal(annotations.annotations.length, 2);
  assert.equal((await stat(options.outputStore)).mode & 0o777, 0o700);
  for (const file of ['baseline.json', 'corpus.json', 'recovery-receipt.json', 'enrichment/annotations.json']) {
    assert.equal((await stat(path.join(options.outputStore, file))).mode & 0o777, 0o600);
  }
  assert.equal((await runPendingRecovery(options)).status, 'failed');
  assert.equal(await readFile(corpusFile, 'utf8'), corpusText);
  assert.equal(await readFile(path.join(options.retrievalStore, 'corpus.json'), 'utf8'), before);
});

privateStoreTest('#91 AC-04 bad baseline hash and unsafe evidence permissions create no output', async t => {
  const options = await privateFixture(t);
  assert.equal((await runPendingRecovery({ ...options, baselineHash: '0'.repeat(64) })).code, 'BASELINE_FILE_HASH_MISMATCH');
  await assert.rejects(stat(options.outputStore), { code: 'ENOENT' });
  await chmod(path.join(options.retrievalStore, 'corpus.json'), 0o644);
  assert.equal((await runPendingRecovery(options)).status, 'failed');
  await assert.rejects(stat(options.outputStore), { code: 'ENOENT' });
});

test('#91 AC-04 Windows recovery fails before reading or writing private paths', async t => {
  if (process.platform !== 'win32') return t.skip('Windows-only fail-fast boundary');
  assert.deepEqual(await runPendingRecovery({}), { status: 'failed', code: 'UNSUPPORTED_PLATFORM' });
});
