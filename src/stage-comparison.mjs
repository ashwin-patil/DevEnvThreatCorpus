import path from 'node:path';
import { assertValid, canonicalSerialize, digest, readPrivateTemplate, reviewEligibleCorpus,
  updatePrivateCorpus, validatePrivateCorpus } from '../scripts/contract.mjs';
import { validateCampaignSnapshot } from './campaign.mjs';
import { reviewSnapshot } from './hitl.mjs';
import { privateDirectory, privateOutput, readEnrichmentSnapshot } from './enrichment.mjs';
import { stageFail, stageList, stageObject, validateBaselineSelections } from './stage-contract.mjs';

export const COMPARISON_VERSION = 'campaign-stage-comparison/1';
export const BASELINE_VERSION = 'campaign-private-baseline/1';
export const ADOPTION_VERSION = 'campaign-baseline-selection/1';
export const COMPARISON_RUBRIC = Object.freeze({
  version: 'campaign-major-mismatch/1',
  major: ['material assertion/evidence loss or unsupported addition', 'exact prompt/command/evidence alteration',
    'tool identity/usage or actor/role change', 'attempted/reported/inferred classification change',
    'behavior/trust-boundary loss or unsupported change', 'path relationship/chronology change',
    'framework mapping scope/basis change', 'lost contradiction or unexplained source coverage loss'],
  rule: 'All unmatched/changed groups are major until independently adjudicated against retained sources. Old Pending output is not gold. IDs/counts alone cannot establish equivalence.',
});
const withoutHash = (object, key) => Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
const equal = (a, b) => canonicalSerialize(a) === canonicalSerialize(b);

function candidateDigest(corpus) {
  const copy = structuredClone(corpus);
  delete copy.governance.baselineSelections;
  return digest(copy);
}
function revisionInventory(corpus, caseId) {
  const selected = corpus.cases.find(c => c.id === caseId);
  if (!selected) stageFail('UNKNOWN_CASE');
  return corpus.sourceRevisions.filter(r => selected.sourceIds.includes(r.sourceId))
    .map(r => ({ id: r.id, sourceId: r.sourceId, hash: digest(r) })).sort((a, b) => a.id.localeCompare(b.id));
}
export function freezeBaseline(corpus, caseId, annotations = []) {
  assertValid(reviewEligibleCorpus(corpus)); validateCampaignSnapshot(corpus);
  const body = { schemaVersion: BASELINE_VERSION, caseId, corpus: structuredClone(corpus),
    annotations: structuredClone(annotations), corpusHash: digest(corpus), revisions: revisionInventory(corpus, caseId) };
  return { ...body, baselineHash: digest(body) };
}
function validateBaseline(baseline) {
  stageObject(baseline, ['schemaVersion', 'caseId', 'corpus', 'annotations', 'corpusHash', 'revisions', 'baselineHash']);
  if (baseline.schemaVersion !== BASELINE_VERSION || digest(withoutHash(baseline, 'baselineHash')) !== baseline.baselineHash
    || digest(baseline.corpus) !== baseline.corpusHash
    || !equal(revisionInventory(baseline.corpus, baseline.caseId), baseline.revisions)) stageFail('INVALID_BASELINE');
  assertValid(reviewEligibleCorpus(baseline.corpus)); validateCampaignSnapshot(baseline.corpus);
}
export function regenerationCandidate(baseline) {
  validateBaseline(baseline);
  const original = baseline.corpus, parent = original.cases.find(c => c.id === baseline.caseId);
  const sources = original.sources.filter(s => parent.sourceIds.includes(s.id));
  const corpus = {
    schemaVersion: original.schemaVersion, name: `${parent.name} - separate Pending regeneration`,
    sources: structuredClone(sources), sourceRevisions: structuredClone(original.sourceRevisions.filter(r => sources.some(s => s.id === r.sourceId))),
    passages: [], cases: [{ ...structuredClone(parent), summary: null, summaryClaimIds: [], disposition: 'Pending',
      collectionState: 'Collected', history: [], nullReasons: { ...parent.nullReasons, summary: 'not_reported' } }],
    claims: [], categorizations: [], timelines: [], reviews: [], collectionManifests: [],
    governance: { regeneration: { schemaVersion: 'campaign-regeneration/1', baselineHash: baseline.baselineHash,
      caseId: baseline.caseId, sourceRevisions: baseline.revisions } },
  };
  assertValid(corpus);
  return corpus;
}

function configuration(corpus, caseId) {
  return (corpus.governance.campaignExtraction?.runs ?? []).filter(r => r.caseId === caseId).map(r => ({
    id: r.id, schemaVersion: r.schemaVersion, stage: r.stage?.kind ?? 'monolithic',
    requestHash: r.requestHash, responseHash: r.responseHash, promptVersion: r.promptVersion,
    promptHash: r.promptHash, provider: r.provider, chunkPolicy: r.chunkPolicy ?? null,
    catalogHash: digest(r.catalogSnapshot ?? null), coverage: r.coverage, processing: r.stage?.processing ?? null,
  }));
}

export function comparisonInventory(corpus, caseId, annotations = []) {
  const units = reviewSnapshot(corpus, annotations).units.filter(u => u.caseIds.includes(caseId)
    && !(u.type === 'cases' && u.record.summary === null));
  const references = new Map();
  const brief = r => Object.fromEntries(['name', 'description', 'value', 'normalizedValue', 'title', 'detail', 'basis',
    'relation', 'boundary', 'evidenceStatus', 'context', 'techniqueId', 'framework', 'version', 'normalizedHash', 'canonicalUrl']
    .filter(k => r[k] !== undefined).map(k => [k, r[k]]));
  for (const [type, values] of Object.entries(corpus)) if (Array.isArray(values)) {
    for (const record of values) if (record?.id) references.set(record.id, { type, ...brief(record) });
  }
  for (const u of units) {
    references.set(u.id, { type: u.type, ...brief(u.record) });
    if (u.parent && u.record.id) references.set(u.record.id, { type: u.type, ...brief(u.record) });
  }
  const omitted = new Set(['id', 'history', 'disposition', 'revision', 'runId', 'namespace', 'modelVersion', 'promptVersion']);
  function semantic(value, key = '') {
    if (typeof value === 'string' && references.has(value)) return references.get(value);
    if (Array.isArray(value)) return value.map(v => semantic(v, key));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([k]) => !omitted.has(k)).map(([k, v]) => [k, semantic(v, k)]));
    return value;
  }
  return units.map(u => {
    const evidence = u.evidence.map(e => ({
      revisionHash: corpus.sourceRevisions.find(r => r.id === e.revisionId)?.normalizedHash ?? null,
      start: e.passage?.start ?? e.locator?.start ?? null, end: e.passage?.end ?? e.locator?.end ?? null,
      quote: e.quote, explanation: e.explanation,
    }));
    if (!evidence.some(e => e.quote)) for (const revisionId of u.record.sourceRevisionIds ?? []) {
      const revision = corpus.sourceRevisions.find(r => r.id === revisionId);
      if (typeof revision?.normalizedContent === 'string' && revision.normalizedContent.length) evidence.push({
        revisionHash: revision.normalizedHash, start: 0, end: [...revision.normalizedContent].length,
        quote: revision.normalizedContent,
        explanation: 'Retained revision context, not an asserted supporting passage. Inspect the record basis and source metadata independently.',
      });
    }
    const record = semantic(u.record);
    const signature = digest({ type: u.type, record, evidence, contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship });
    return { itemKey: u.itemKey, type: u.type, record: structuredClone(u.record), evidence,
      state: u.state, signature, contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship };
  }).sort((a, b) => a.itemKey.localeCompare(b.itemKey));
}

export function compareBaseline(baseline, corpus, annotations = []) {
  validateBaseline(baseline); assertValid(reviewEligibleCorpus(corpus)); validateCampaignSnapshot(corpus);
  const old = comparisonInventory(baseline.corpus, baseline.caseId, baseline.annotations);
  const fresh = comparisonInventory(corpus, baseline.caseId, annotations);
  if (old.length + fresh.length > 10000) stageFail('COMPARISON_LIMIT');
  const used = new Set(), groups = [];
  const add = (kind, before, after) => {
    const body = { kind, type: before[0]?.type ?? after[0]?.type ?? 'source-coverage',
      before, after, major: kind !== 'matched' };
    groups.push({ id: `difference-${digest(body)}`, ...body });
  };
  const remaining = [];
  for (const item of old) {
    const match = fresh.find(n => !used.has(n.itemKey) && n.type === item.type && n.signature === item.signature);
    if (match) { used.add(match.itemKey); add('matched', [item], [match]); }
    else remaining.push(item);
  }
  const additions = fresh.filter(i => !used.has(i.itemKey));
  const overlap = (a, b) => a.type === b.type && a.evidence.some(e => e.revisionHash && b.evidence.some(f =>
    f.revisionHash === e.revisionHash && Number.isInteger(e.start) && Number.isInteger(f.start)
    && e.start < f.end && f.start < e.end));
  const visited = new Set();
  for (const item of remaining) {
    if (visited.has(item.itemKey)) continue;
    const before = [item], after = [];
    visited.add(item.itemKey);
    let changed;
    do {
      changed = false;
      for (const n of additions) if (!used.has(n.itemKey) && before.some(o => overlap(o, n))) {
        used.add(n.itemKey); after.push(n); changed = true;
      }
      for (const o of remaining) if (!visited.has(o.itemKey) && after.some(n => overlap(o, n))) {
        visited.add(o.itemKey); before.push(o); changed = true;
      }
    } while (changed);
    add(!after.length ? 'omitted' : before.length === 1 && after.length > 1 ? 'split'
      : before.length > 1 && after.length === 1 ? 'merged' : 'substantively-changed', before, after);
  }
  for (const n of additions) if (!used.has(n.itemKey)) add('added', [], [n]);
  const revisions = revisionInventory(corpus, baseline.caseId);
  if (!equal(baseline.revisions, revisions)) {
    add('source-coverage-changed', [{ type: 'source-coverage', revisions: baseline.revisions }],
      [{ type: 'source-coverage', revisions }]);
  }
  const body = { schemaVersion: COMPARISON_VERSION, caseId: baseline.caseId, baselineHash: baseline.baselineHash,
    candidateHash: candidateDigest(corpus), candidateAnnotationsHash: digest(annotations),
    rubric: COMPARISON_RUBRIC, beforeConfiguration: configuration(baseline.corpus, baseline.caseId),
    afterConfiguration: configuration(corpus, baseline.caseId), groups,
    limitations: ['Deterministic correspondence suggestions, not semantic approval. All populated reviewable types are included.',
      'Old Pending extraction is not gold. Inspect exact evidence and config/coverage deltas; no count/similarity threshold approves adoption.'] };
  return { ...body, comparisonHash: digest(body) };
}

function validateAdjudication(comparison, adjudication) {
  stageObject(adjudication, ['schemaVersion', 'comparisonHash', 'reviewer', 'independent', 'selfAttested',
    'rubricVersion', 'decisions', 'approveSelection']);
  if (adjudication.schemaVersion !== 'campaign-comparison-adjudication/1'
    || adjudication.comparisonHash !== comparison.comparisonHash
    || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(adjudication.reviewer ?? '')
    || adjudication.independent !== true || adjudication.selfAttested !== true || adjudication.approveSelection !== true
    || adjudication.rubricVersion !== COMPARISON_RUBRIC.version) stageFail('HUMAN_ADJUDICATION_REQUIRED');
  stageList(adjudication.decisions);
  const expected = comparison.groups.filter(g => g.major);
  if (adjudication.decisions.length !== expected.length) stageFail('UNRESOLVED_MAJOR_MISMATCH');
  const seen = new Set();
  for (const d of adjudication.decisions) {
    stageObject(d, ['differenceId', 'outcome', 'rationale', 'evidence']);
    const group = expected.find(g => g.id === d.differenceId);
    if (!group || seen.has(d.differenceId) || !['corrected-and-rechecked', 'accepted-evidence-backed-change'].includes(d.outcome)
      || typeof d.rationale !== 'string' || !d.rationale.trim() || !Array.isArray(d.evidence) || !d.evidence.length) {
      stageFail('UNRESOLVED_MAJOR_MISMATCH');
    }
    for (const reference of stageList(d.evidence)) {
      stageObject(reference, ['revisionHash', 'start', 'end', 'quote']);
      if (![...group.before, ...group.after].flatMap(i => i.evidence ?? []).some(e => equal(reference, {
        revisionHash: e.revisionHash, start: e.start, end: e.end, quote: e.quote,
      })) || !reference.quote) stageFail('INVALID_COMPARISON_EVIDENCE');
    }
    seen.add(d.differenceId);
  }
}

export function selectBaseline(corpus, baseline, comparison, adjudication, annotations = []) {
  const fresh = compareBaseline(baseline, corpus, annotations);
  if (!equal(fresh, comparison)) stageFail('STALE_COMPARISON');
  if (corpus.governance.regeneration?.baselineHash !== baseline.baselineHash
    || !equal(revisionInventory(corpus, baseline.caseId), baseline.revisions)) stageFail('INVALID_REGENERATION');
  const oldKeys = new Set(comparisonInventory(baseline.corpus, baseline.caseId, baseline.annotations).map(i => i.itemKey));
  const next = comparisonInventory(corpus, baseline.caseId, annotations);
  if (next.some(i => i.type !== 'cases' && oldKeys.has(i.itemKey))
    || corpus.reviews.length || corpus.governance.localReview?.events?.length) stageFail('REVIEW_TRANSFER_FORBIDDEN');
  validateAdjudication(comparison, adjudication);
  const body = { schemaVersion: ADOPTION_VERSION, caseId: baseline.caseId,
    baselineHash: baseline.baselineHash, candidateHash: comparison.candidateHash,
    annotationsHash: comparison.candidateAnnotationsHash, comparisonHash: comparison.comparisonHash,
    rubricVersion: COMPARISON_RUBRIC.version, adjudication: structuredClone(adjudication),
    reviewer: adjudication.reviewer, timestamp: new Date().toISOString(),
    previous: corpus.governance.baselineSelections?.at(-1)?.selectionHash ?? null };
  const selection = { ...body, selectionHash: digest(body) };
  corpus.governance.baselineSelections ??= [];
  corpus.governance.baselineSelections.push(selection);
  return selection;
}

export function baselineSelectionStatus(corpus, annotations = []) {
  validateBaselineSelections(corpus.governance);
  const selected = corpus.governance.baselineSelections?.at(-1);
  return { selected: !!selected && selected.candidateHash === candidateDigest(corpus)
    && selected.annotationsHash === digest(annotations), selectionHash: selected?.selectionHash ?? null,
  warning: 'Working-baseline selection is not item acceptance, release eligibility or public publication.' };
}

export async function runComparison({ command, store, caseId, baselineFile, comparisonFile, inputFile, outputFile }) {
  try {
    if (!['freeze', 'candidate', 'compare', 'select', 'status'].includes(command)) stageFail('INVALID_INPUT');
    const read = async file => JSON.parse(await readPrivateTemplate(file));
    const baseline = baselineFile ? await read(baselineFile) : null;
    if (command === 'candidate') {
      if (!outputFile || path.resolve(outputFile) === path.resolve(baselineFile)) stageFail('UNSAFE_PATH');
      const candidate = regenerationCandidate(baseline);
      await privateOutput(outputFile, candidate);
      return { status: 'succeeded', candidateHash: candidateDigest(candidate), pending: true };
    }
    const verify = await privateDirectory(store);
    if (command === 'select') {
      const comparison = await read(comparisonFile), adjudication = await read(inputFile);
      let code;
      const result = await updatePrivateCorpus(store, async corpus => {
        try {
          const sidecar = await readEnrichmentSnapshot(store, corpus);
          const selection = selectBaseline(corpus, baseline, comparison, adjudication, sidecar.annotations);
          return { selectionHash: selection.selectionHash, pending: true };
        } catch (error) { code = error.code; throw error; }
      }, { reviewAware: true });
      return result.status === 'failed' && code ? { ...result, code } : result;
    }
    const corpus = await validatePrivateCorpus(path.join(store, 'corpus.json'), { reviewAware: true });
    const annotations = (await readEnrichmentSnapshot(store, corpus)).annotations;
    await verify();
    if (command === 'status') return { status: 'succeeded', ...baselineSelectionStatus(corpus, annotations) };
    const result = command === 'freeze' ? freezeBaseline(corpus, caseId, annotations) : compareBaseline(baseline, corpus, annotations);
    if (!outputFile) stageFail('INVALID_INPUT');
    await privateOutput(outputFile, result);
    return { status: 'succeeded', ...(command === 'freeze' ? { baselineHash: result.baselineHash }
      : { comparisonHash: result.comparisonHash, major: result.groups.filter(g => g.major).length }),
    private: true, pending: true };
  } catch (error) {
    return { status: 'failed', code: error.code ?? 'INVALID_COMPARISON' };
  }
}
