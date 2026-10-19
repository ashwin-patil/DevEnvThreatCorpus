import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  assertValid, digest, normalizeText, readPrivateTemplate, sha256, validatePrivateCorpus,
} from '../scripts/contract.mjs';
import { publicDraftModel } from './public-profile.mjs';
import { ENRICHMENT_VERSION, privateDirectory, privateOutput, validateEnrichment } from './enrichment.mjs';
import { reviewSnapshot } from './hitl.mjs';

export const RECOVERY_VERSION = 'public-pending-recovery/1';
const fail = (code, message = code) => { throw Object.assign(new Error(message), { code }); };

export function restorePendingDraft(document, evidence) {
  const model = publicDraftModel(document);
  if (digest(document.records) !== document.snapshotDigest
    || document.coverage?.promptArtifacts
      && digest(document.coverage.promptArtifacts) !== document.coverage.promptArtifactDigest
    || document.coverage?.researchPresentation
      && digest(document.coverage.researchPresentation) !== document.coverage.researchPresentationDigest) {
    fail('BASELINE_DIGEST_MISMATCH');
  }
  assertValid(evidence);
  const corpus = structuredClone(model.corpus);
  const sources = [];
  for (const revision of corpus.sourceRevisions) {
    const coverage = document.sourceCoverage.find(source => source.sourceId === revision.sourceId
      && source.status === 'collected')?.revisions.find(item => item.id === revision.id);
    const source = corpus.sources.find(source => source.id === revision.sourceId);
    const matches = evidence.sourceRevisions.filter(candidate => candidate.sourceId === revision.sourceId
      && candidate.normalizedHash === revision.normalizedHash
      && candidate.parserVersion === revision.parserVersion
      && candidate.normalizationVersion === revision.normalizationVersion
      && typeof candidate.normalizedContent === 'string');
    const retainedSource = evidence.sources.find(item => item.id === source?.id);
    if (!coverage || coverage.normalizedHash !== revision.normalizedHash || !matches.length
      || retainedSource?.canonicalUrl !== source?.canonicalUrl) fail('MATCHING_EVIDENCE_REQUIRED');
    const text = matches[0].normalizedContent;
    if (sha256(text) !== revision.normalizedHash || normalizeText(text) !== text
      || [...text].length !== coverage.codePoints
      || matches.some(item => item.normalizedContent !== text)) fail('MATCHING_EVIDENCE_REQUIRED');
    revision.normalizedContent = text;
    revision.retention = 'private';
    delete revision.nullReasons.normalizedContent;
    // Fresh raw responses remain in the retrieval store, never under an old raw hash.
    revision.nullReasons.rawContent = 'not_reported';
    sources.push({
      sourceId: source.id, revisionId: revision.id, normalizedHash: revision.normalizedHash,
      historicalRawHash: revision.rawHash,
      retrievalRevisions: matches.map(item => ({ id: item.id, rawHash: item.rawHash }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      historicalRawHashMatched: matches.some(item => item.rawHash === revision.rawHash),
    });
  }
  for (const passage of corpus.passages) {
    const revision = corpus.sourceRevisions.find(item => item.id === passage.sourceRevisionId);
    const points = [...revision.normalizedContent];
    if (!Number.isSafeInteger(passage.start) || !Number.isSafeInteger(passage.end)
      || passage.start < 0 || passage.end <= passage.start || passage.end > points.length) fail('INVALID_PASSAGE_BOUNDS');
    passage.text = points.slice(passage.start, passage.end).join('');
    delete passage.nullReasons.text;
  }
  for (const receipt of document.expansion?.groundingReceipts ?? []) {
    const revision = corpus.sourceRevisions.find(item => item.id === receipt.revisionId);
    const claim = corpus.claims.find(item => item.id === receipt.claimId);
    if (!revision || !claim || claim.sourceId !== receipt.sourceId || claim.sourceRevisionId !== revision.id
      || receipt.normalizedHash !== revision.normalizedHash
      || !claim.passageIds.some(id => corpus.passages.some(passage => passage.id === id
        && passage.sourceRevisionId === revision.id && passage.start === receipt.start && passage.end === receipt.end))
      || sha256([...revision.normalizedContent].slice(receipt.start, receipt.end).join('')) !== receipt.quoteHash) {
      fail('GROUNDING_RECEIPT_MISMATCH');
    }
  }
  const annotations = model.annotations.map(annotation => {
    const item = structuredClone(annotation);
    item.modelVersion = 'unknown-public-projection';
    item.promptVersion = 'unknown-public-projection';
    item.context.notes = 'Restored Pending public artifact; original model/prompt versions and private extraction run are unavailable. Not a recovered generation run or human decision.';
    if (!item.support) {
      const passages = item.claimIds.flatMap(id => corpus.claims.find(claim => claim.id === id)?.passageIds ?? [])
        .map(id => corpus.passages.find(passage => passage.id === id))
        .filter(passage => passage?.sourceRevisionId === item.sourceRevisionId && passage.text.includes(item.value))
        .sort((a, b) => a.end - a.start - (b.end - b.start) || a.start - b.start || a.id.localeCompare(b.id));
      if (!passages.length) fail('ARTIFACT_EVIDENCE_REQUIRED');
      const passage = passages[0];
      item.support = { locator: { start: passage.start, end: passage.end } };
    }
    const { start, end } = item.support.locator;
    const revision = corpus.sourceRevisions.find(revision => revision.id === item.sourceRevisionId);
    item.support.quote = [...revision.normalizedContent].slice(start, end).join('');
    if (item.context.artifactKind === 'prompt-instruction'
      ? item.support.quote !== item.value : !item.support.quote.includes(item.value)) fail('ARTIFACT_EVIDENCE_REQUIRED');
    item.evidenceStatus = 'evidence-backed';
    return item;
  });
  const enrichment = { schemaVersion: ENRICHMENT_VERSION, annotations };
  const receipt = {
    schemaVersion: RECOVERY_VERSION, baselineSnapshotDigest: document.snapshotDigest,
    retrievalCorpusDigest: digest(evidence), sources,
    recordCount: document.records.length, passageCount: corpus.passages.length,
    groundingReceiptCount: document.expansion?.groundingReceipts?.length ?? 0,
    annotationIds: annotations.map(item => item.id),
    limitations: [
      'New Pending working copy, not the original private extraction, a comparison/adjudication, or gold.',
      'Historical raw hashes/IDs retained; raw originals remain omitted. Fresh raw responses stay in the separate retrieval store.',
      'Artifact model/prompt versions are explicitly unknown; original private extraction-run metadata is unavailable.',
      'No decisions, attestations, provider runs, frozen evaluation outcomes or publication approval were created.',
    ],
  };
  corpus.governance = { publicPendingRecovery: receipt };
  assertValid(corpus);
  const errors = validateEnrichment(enrichment, corpus);
  if (errors.length) fail('INVALID_RECOVERED_ARTIFACTS', errors.join('\n'));
  const review = reviewSnapshot(corpus, annotations);
  if (review.units.some(unit => unit.eligible || unit.currentHumanReview)) fail('UNEXPECTED_REVIEW_ACCEPTANCE');
  receipt.reviewPreparation = {
    reviewUnitCount: review.units.length, acceptedCount: 0,
    structurallyBlocked: review.units.filter(unit => unit.structurallyBlocked)
      .map(unit => ({ itemKey: unit.itemKey, reasons: unit.blockers.map(blocker => blocker.reason) })),
  };
  return { corpus, enrichment, receipt };
}

export async function runPendingRecovery({ baselineFile, baselineHash, retrievalStore, outputStore }) {
  if (process.platform === 'win32') return { status: 'failed', code: 'UNSUPPORTED_PLATFORM' };
  let created = false;
  const written = [];
  try {
    if (!/^[a-f0-9]{64}$/.test(baselineHash ?? '') || typeof outputStore !== 'string'
      || !path.isAbsolute(outputStore) || path.normalize(outputStore) !== outputStore) fail('INVALID_INPUT');
    const baselineText = await readPrivateTemplate(baselineFile);
    if (sha256(baselineText) !== baselineHash) fail('BASELINE_FILE_HASH_MISMATCH');
    await privateDirectory(retrievalStore);
    const evidence = await validatePrivateCorpus(path.join(retrievalStore, 'corpus.json'), { reviewAware: true });
    const restored = restorePendingDraft(JSON.parse(baselineText), evidence);
    const parent = await privateDirectory(path.dirname(outputStore));
    await fs.mkdir(outputStore, { mode: 0o700 });
    created = true;
    await parent();
    await privateDirectory(outputStore);
    await privateDirectory(path.join(outputStore, 'enrichment'), { create: true });
    const files = [
      ['baseline.json', baselineText, true],
      ['recovery-receipt.json', { ...restored.receipt, baselineFileHash: baselineHash, createdAt: new Date().toISOString() }, false],
      [path.join('enrichment', 'annotations.json'), restored.enrichment, false],
      ['corpus.json', restored.corpus, false],
    ];
    for (const [name, value, raw] of files) {
      const file = path.join(outputStore, name);
      await privateOutput(file, value, { raw });
      written.push(file);
    }
    return { status: 'succeeded', pending: true, recordCount: restored.receipt.recordCount,
      sourceRevisions: restored.receipt.sources.length, passages: restored.receipt.passageCount,
      annotations: restored.enrichment.annotations.length, reviewUnits: restored.receipt.reviewPreparation.reviewUnitCount,
      structurallyBlocked: restored.receipt.reviewPreparation.structurallyBlocked.length, outputStore };
  } catch (error) {
    if (created) {
      try {
        for (const file of written.reverse()) await fs.unlink(file);
        const enrichment = path.join(outputStore, 'enrichment');
        const stat = await fs.lstat(enrichment).catch(error => {
          if (error.code !== 'ENOENT') throw error;
          return null;
        });
        if (stat) await fs.rmdir(enrichment);
        await fs.rmdir(outputStore);
      } catch (cleanup) {
        return { status: 'failed', code: error.code ?? 'RECOVERY_FAILED',
          cleanupCode: cleanup.code ?? 'CLEANUP_FAILED', outputStore };
      }
    }
    return { status: 'failed', code: error.code ?? 'RECOVERY_FAILED' };
  }
}
