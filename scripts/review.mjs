import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assertValid, dependencyHashes, entityContentHash, readPrivateTemplate, reviewBaseDigest,
  reviewEligibleCorpus, updatePrivateCorpus, validateCorpus, validatePrivateCorpus, validateShape,
} from './contract.mjs';

export const REVIEW_VERSION = 'manual-review/1';
const fail = code => { const error = new Error(code); error.code = code; return error; };
const dispositions = { accept: 'Accepted', correct: 'Needs correction', exclude: 'Excluded' };
const correctionFields = new Set([
  'description', 'passageIds', 'inference', 'evidenceStatus', 'uncertainty', 'observationContext', 'nullReasons',
]);

function onlyKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => keys.includes(key));
}

export function applyReview(corpus, decision, reviewer) {
  const required = ['schemaVersion', 'claimId', 'action', 'baseDigest', 'rationale'];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(reviewer ?? '')
    || !onlyKeys(decision, [...required, 'correction'])
    || !required.every(key => Object.hasOwn(decision, key))
    || decision.schemaVersion !== REVIEW_VERSION
    || !Object.hasOwn(dispositions, decision.action)
    || typeof decision.rationale !== 'string' || !decision.rationale.trim()
    || typeof decision.baseDigest !== 'string' || !/^[a-f0-9]{64}$/.test(decision.baseDigest)) {
    throw fail('INVALID_REVIEW');
  }
  if (decision.baseDigest !== reviewBaseDigest(corpus)) throw fail('STALE_BASE');
  const candidate = reviewEligibleCorpus(corpus);
  const claim = candidate.claims.find(item => item.id === decision.claimId);
  if (!claim) throw fail('UNKNOWN_CLAIM');
  if (decision.action === 'correct') {
    if (!onlyKeys(decision.correction, [...correctionFields]) || !Object.keys(decision.correction).length) {
      throw fail('INVALID_REVIEW');
    }
    const previousHash = entityContentHash(claim);
    Object.assign(claim, structuredClone(decision.correction));
    if (entityContentHash(claim) === previousHash) throw fail('INVALID_REVIEW');
    claim.revision = `review-${randomUUID()}`;
  } else if (Object.hasOwn(decision, 'correction')) {
    throw fail('INVALID_REVIEW');
  }
  claim.disposition = dispositions[decision.action];
  const shapeErrors = validateShape(candidate);
  if (shapeErrors.length) {
    const error = fail('INVALID_REVIEW');
    error.errors = shapeErrors;
    throw error;
  }
  let dependencies;
  try { dependencies = dependencyHashes(candidate, 'claims', claim.id); }
  catch { throw fail('INVALID_REVIEW'); }
  const event = {
    id: `review-${randomUUID()}`, entityType: 'claims', entityId: claim.id, revision: claim.revision,
    baseDigest: decision.baseDigest, reviewer, reviewerKind: 'human', timestamp: new Date().toISOString(),
    disposition: claim.disposition, rationale: decision.rationale,
    contentHash: entityContentHash(claim), dependencyHashes: dependencies,
  };
  candidate.reviews.push(event);
  claim.history.push(event.id);
  // Corrections change the base and can invalidate other approvals, never their events.
  const eligible = reviewEligibleCorpus(candidate);
  const errors = validateCorpus(eligible);
  if (errors.length) {
    const error = fail('INVALID_REVIEW');
    error.errors = errors;
    throw error;
  }
  if (decision.action === 'accept' && eligible.claims.find(item => item.id === claim.id).disposition !== 'Accepted') {
    throw fail('INVALID_REVIEW');
  }
  assertValid(eligible);
  Object.assign(corpus, eligible);
  return { claimId: claim.id, eventId: event.id, disposition: claim.disposition, baseDigest: reviewBaseDigest(corpus) };
}

export async function runReview({ templateFile, store, reviewer }) {
  try {
    if (typeof templateFile !== 'string' || typeof store !== 'string') throw fail('INVALID_INPUT');
    let decision;
    try { decision = JSON.parse(await readPrivateTemplate(templateFile)); }
    catch (error) { if (error.code) throw error; throw fail('INVALID_REVIEW'); }
    return await updatePrivateCorpus(store, corpus => applyReview(corpus, decision, reviewer), { reviewAware: true });
  } catch (error) {
    return { status: 'failed', code: error.code ?? 'INVALID_REVIEW' };
  }
}

export async function reviewStatus(file) {
  const corpus = await validatePrivateCorpus(file, { reviewAware: true });
  const eligible = reviewEligibleCorpus(corpus);
  return {
    status: 'succeeded', baseDigest: reviewBaseDigest(corpus),
    claims: corpus.claims.map(claim => {
      const disposition = eligible.claims.find(item => item.id === claim.id).disposition;
      return {
        id: claim.id, recordedDisposition: claim.disposition, disposition,
        eligibleAccepted: disposition === 'Accepted',
        stale: claim.disposition === 'Accepted' && disposition === 'Pending',
        origin: claim.origin, evidenceStatus: claim.evidenceStatus, history: claim.history,
      };
    }),
  };
}

async function cli([command, ...args]) {
  try {
    const options = {};
    if (args.length % 2) throw fail('INVALID_INPUT');
    for (let i = 0; i < args.length; i += 2) {
      if (Object.hasOwn(options, args[i])) throw fail('INVALID_INPUT');
      options[args[i]] = args[i + 1];
    }
    if (command === 'status' || command === 'validate') {
      if (Object.keys(options).length !== 1 || !options['--file']) throw fail('INVALID_INPUT');
      const result = await reviewStatus(options['--file']);
      return command === 'status' ? result : {
        status: 'succeeded', code: 'VALID', baseDigest: result.baseDigest,
        eligibleAcceptedClaimIds: result.claims.filter(claim => claim.eligibleAccepted).map(claim => claim.id),
        staleClaimIds: result.claims.filter(claim => claim.stale).map(claim => claim.id),
      };
    }
    if (command !== 'decide' || Object.keys(options).length !== 3
      || !['--template', '--store', '--reviewer'].every(key => options[key])) throw fail('INVALID_INPUT');
    return runReview({ templateFile: options['--template'], store: options['--store'], reviewer: options['--reviewer'] });
  } catch (error) { return { status: 'failed', code: error.code ?? 'INVALID_REVIEW' }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cli(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'succeeded' ? 0 : 1;
}
