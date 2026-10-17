import { randomUUID } from 'node:crypto';
import {
  canonicalSerialize, digest, stableId, assertValid, reviewEligibleCorpus, updatePrivateCorpus,
} from '../scripts/contract.mjs';
import { readEnrichmentSnapshot, validateEnrichment } from './enrichment.mjs';
import { GUIDE_VERSION, GUIDE_VERSIONS, checksFor, confirmationFor, priorityCategory, labelCompleteness, labelFields, EXCLUSION_REASONS, CONTENT_ORIGINS } from './review-guide.mjs';
import { unionCoverage } from './chunks.mjs';

export const HITL_VERSION = 'local-hitl/1';
const coreTypes = ['claims', 'cases', 'categorizations', 'timelines'];
const optionalTypes = ['behaviors', 'paths', 'mappings', 'telemetry', 'detections', 'otel'];
const keyFor = (type, id) => `${type}:${id}`;
const unique = values => [...new Set(values)];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const nonempty = value => typeof value === 'string' && !!value.trim() && value.length <= 65536;
const clean = record => {
  const { disposition, history, collectionState, ...value } = record;
  return value;
};
const edits = {
  claims: ['description', 'evidenceStatus', 'uncertainty', 'observationContext'],
  cases: ['summary', 'limits'], categorizations: ['value'],
  timelines: ['description', 'uncertainty'],
  behaviors: ['name', 'description', 'boundary'], occurrences: [],
  paths: ['scope'], nodes: ['title', 'detail'], edges: ['relation', 'basis'],
  mappings: ['rationale', 'applicability'], telemetry: ['availability', 'limitations'],
  detections: ['hypothesis', 'tuning', 'testPlan'], otel: ['action', 'limitations'],
  annotations: ['value', 'normalizedValue', 'context'],
};

function eventsOf(corpus) {
  const log = corpus.governance?.localReview;
  if (!log) return [];
  if (log.schemaVersion !== HITL_VERSION || !Array.isArray(log.events)) fail('INVALID_REVIEW_LOG');
  let previous = null;
  const ids = new Set();
  for (const event of log.events) {
    const { eventHash, ...body } = event;
    if (eventHash !== digest(body) || event.previous !== previous || ids.has(event.id)
      || event.reviewerKind !== 'self-attested-human' || !nonempty(event.reviewer)
      || !Number.isFinite(Date.parse(event.timestamp)) || !nonempty(event.itemKey)
      || !['accept', 'exclude', 'unsure', 'modify', 'provenance'].includes(event.action)
      || !GUIDE_VERSIONS.includes(event.guideVersion)) fail('INVALID_REVIEW_LOG');
    ids.add(event.id); previous = eventHash;
  }

  return log.events;
}

export function assertReviewHistory(previous, next) {
  const before = eventsOf({ governance: { localReview: previous } });
  const after = eventsOf({ governance: { localReview: next } });
  if (after.length < before.length || before.some((event, index) =>
    canonicalSerialize(event) !== canonicalSerialize(after[index]))) fail('REVIEW_HISTORY_REWRITE');
}

export function reviewUnits(corpus, annotations = []) {
  const runs = corpus.governance?.campaignExtraction?.runs ?? [];
  const units = [], keys = new Set();
  const supportFor = (type, id) => runs.flatMap(run => (run.recordSupport ?? [])
    .filter(s => s.recordType === type && s.recordId === id).flatMap(s => s.supportingClaimIds));
  function add(type, record, { id = record.id, caseIds, support, dependencies = [], parent, index } = {}) {
    const itemKey = keyFor(type, id);
    if (keys.has(itemKey)) fail('DUPLICATE_REVIEW_UNIT');
    keys.add(itemKey);
    const claimIds = unique(support ?? record.supportingClaimIds ?? record.claimIds ?? record.summaryClaimIds ?? []);
    const cases = unique(caseIds ?? (record.caseId ? [record.caseId] :
      claimIds.map(id => corpus.claims.find(c => c.id === id)?.caseId).filter(Boolean)));
    const sources = unique([...(record.sourceIds ?? []), ...(record.sourceId ? [record.sourceId] : []),
      ...claimIds.map(id => corpus.claims.find(c => c.id === id)?.sourceId).filter(Boolean)]);
    const runMetadata = runs.filter(run => run.claimIds?.includes(record.id)
      || run.claimSnapshots?.some(c => c.id === record.id)
      || run.annotations?.some(a => a.id === record.id)
      || run.records?.[type]?.some(r => r.id === record.id)
      || (parent && run.records?.[parent.type]?.some(r => r.id === parent.id)))
      .map(run => ({ id: run.id, provider: run.provider, promptVersion: run.promptVersion,
        requestHash: run.requestHash, responseHash: run.responseHash, envelopeHash: run.envelopeHash }));
    units.push({ itemKey, type, id, caseIds: cases, sourceIds: sources, original: structuredClone(record),
      record: structuredClone(record), claimIds, parent, index, runMetadata,
      dependencies: unique([...claimIds.map(id => keyFor('claims', id)), ...dependencies]),
      originalOrigin: record.origin ?? (runMetadata.length ? 'agent' : 'unknown'),
      contentOrigin: record.origin ?? (runMetadata.length ? 'agent' : 'unknown'),
      labelAuthorship: record.labelAuthorship ?? (/LLM|agent/.test(record.origin ?? '') || runMetadata.length
        ? 'LLM-derived' : /^Human|manual/.test(record.origin ?? '') ? 'Human authored' : 'unknown') });
    return units.at(-1);
  }
  for (const type of coreTypes) for (const record of corpus[type] ?? []) {
    add(type, record, { caseIds: type === 'cases' ? [record.id] : undefined,
      support: type === 'claims' ? record.inference?.supportingClaimIds ?? [] : undefined });
  }
  for (const b of corpus.behaviors ?? []) {
    const support = unique([...(b.claimIds ?? []), ...supportFor('behaviors', b.id),
      ...(b.occurrences ?? []).flatMap(o => o.claimIds ?? o.supportingClaimIds ?? [])]);
    const cases = unique([...(b.caseId ? [b.caseId] : []), ...(b.occurrences ?? []).map(o => o.caseId).filter(Boolean),
      ...support.map(id => corpus.claims.find(c => c.id === id)?.caseId).filter(Boolean)]);
    add('behaviors', b, { caseIds: cases, support });
    (b.occurrences ?? []).forEach((o, index) => add('occurrences', o, {
      id: `${b.id}/${index}`, parent: { type: 'behaviors', id: b.id }, index,
      caseIds: o.caseId ? [o.caseId] : cases, dependencies: [keyFor('behaviors', b.id)],
    }));
  }
  for (const p of corpus.paths ?? []) {
    const parent = { type: 'paths', id: p.id };
    for (const n of p.nodes) add('nodes', n, { id: `${p.id}/${n.id}`, parent, caseIds: [p.caseId],
      dependencies: n.behaviorIds.map(id => keyFor('behaviors', id)) });
    for (const e of p.edges) add('edges', e, { id: `${p.id}/${e.id}`, parent, caseIds: [p.caseId],
      dependencies: [e.from, e.to].map(id => keyFor('nodes', `${p.id}/${id}`)) });
    add('paths', p, { support: supportFor('paths', p.id),
      dependencies: [...p.nodes.map(n => keyFor('nodes', `${p.id}/${n.id}`)),
        ...p.edges.map(e => keyFor('edges', `${p.id}/${e.id}`))] });
  }
  for (const type of ['mappings', 'telemetry', 'detections', 'otel']) for (const r of corpus[type] ?? []) {
    const behavior = units.find(u => u.itemKey === keyFor('behaviors', r.behaviorId));
    add(type, r, { caseIds: r.caseId ? [r.caseId] : behavior?.caseIds ?? [],
      support: r.claimIds ?? supportFor(type, r.id),
      dependencies: [keyFor('behaviors', r.behaviorId),
        ...(type === 'mappings' && r.nodeId ? [keyFor('nodes', `${r.pathId}/${r.nodeId}`)] : []),
        ...(type === 'detections' ? [...r.signalIds.map(id => keyFor('telemetry', id)),
          ...r.otelIds.map(id => keyFor('otel', id))] : [])] });
  }
  const campaignAnnotations = runs.flatMap(run => (run.annotations ?? []).map(a => ({
    ...a, runId: run.id, modelVersion: run.provider?.version, promptVersion: run.promptVersion,
  })));
  for (const a of [...annotations, ...campaignAnnotations]) add('annotations', a);
  for (const run of runs) for (const r of run.unresolvedMappings ?? []) {
    const unit = add('mappings', r, { support: r.supportingClaimIds,
      dependencies: [keyFor('behaviors', r.behaviorId)] });
    unit.unresolved = r.reason ?? 'Unresolved catalog support';
  }
  const lookup = new Map(units.map(u => [u.itemKey, u]));
  let expanded;
  do {
    expanded = false;
    for (const u of units) {
      const inherited = unique([...u.sourceIds, ...u.dependencies.flatMap(key => lookup.get(key)?.sourceIds ?? [])]);
      if (inherited.length !== u.sourceIds.length) { u.sourceIds = inherited; expanded = true; }
    }
  } while (expanded);
  const events = eventsOf(corpus);
  for (const u of units) {
    u.history = events.filter(e => e.itemKey === u.itemKey);
    const originalHash = digest(clean(u.original));
    // Old corrections remain in history but cannot overwrite a regenerated proposal.
    for (const e of u.history.filter(e => e.originalHash === originalHash)) {
      if (e.action === 'modify') {
        Object.assign(u.record, structuredClone(e.patch));
        u.editor = e.reviewer;
        if (e.labelEdited) u.labelAuthorship = 'Human-edited';
        u.researcherTags = e.researcherTags;
      }
      if (e.action === 'provenance') {
        u.contentOrigin = e.contentOrigin; u.labelAuthorship = e.labelAuthorship;
      }
    }
    u.originalHash = originalHash;
    u.labels = labelCompleteness(u.type, u.record);
    const evidenceIds = unique([...(u.record.passageIds ?? []),
      ...u.claimIds.flatMap(id => corpus.claims.find(c => c.id === id)?.passageIds ?? [])]);
    const revisionIds = unique([...(u.record.sourceRevisionId ? [u.record.sourceRevisionId] : []),
      ...(u.record.sourceRevisionIds ?? []),
      ...evidenceIds.map(id => corpus.passages.find(p => p.id === id)?.sourceRevisionId).filter(Boolean)]);
    u.evidence = evidenceIds.map(id => {
      const passage = corpus.passages.find(p => p.id === id);
      const revision = corpus.sourceRevisions.find(r => r.id === passage?.sourceRevisionId);
      const retained = typeof revision?.normalizedContent === 'string';
      const exact = retained && passage && Number.isInteger(passage.start) && Number.isInteger(passage.end)
        && [...revision.normalizedContent].slice(passage.start, passage.end).join('') === passage.text;
      return { id, passage: passage ?? null, revisionId: passage?.sourceRevisionId ?? null,
        quote: exact ? passage.text : null,
        context: exact ? [...revision.normalizedContent].slice(Math.max(0, passage.start - 200), passage.end + 200).join('') : null,
        explanation: exact ? null : 'Exact retained passage unavailable/private or no longer matches this revision; no passage fabricated.' };
    });
    if (u.type === 'annotations' && u.record.support) {
      const revision = corpus.sourceRevisions.find(r => r.id === u.record.sourceRevisionId);
      const { quote, locator } = u.record.support;
      const text = revision?.normalizedContent;
      const exact = typeof text === 'string' && locator
        && [...text].slice(locator.start, locator.end).join('') === quote;
      u.evidence.push({ revisionId: u.record.sourceRevisionId, locator: structuredClone(locator), quote: exact ? quote : null,
        context: exact ? [...text].slice(Math.max(0, locator.start - 200), locator.end + 200).join('') : null,
        explanation: exact ? null : 'Annotation evidence unavailable/private; no passage fabricated.' });
    }
    if (u.type === 'annotations' && u.record.type === 'commands-ai-artifacts') {
      const literal = u.record.value;
      u.groundingLost = !u.evidence.some(e => e.quote !== null && e.quote.includes(literal));
    }
    u.binding = digest({ record: clean(u.record), originalHash, contentOrigin: u.contentOrigin,
      labelAuthorship: u.labelAuthorship, editor: u.editor ?? null, tags: u.researcherTags ?? [],
      edits: u.history.filter(e => ['modify', 'provenance'].includes(e.action)).map(e => e.eventHash),
      evidence: evidenceIds.map(id => corpus.passages.find(p => p.id === id) ?? null),
      revisions: revisionIds.map(id => corpus.sourceRevisions.find(r => r.id === id) ?? null),
      sources: u.sourceIds.map(id => corpus.sources.find(s => s.id === id) ?? null),
      conflicts: (u.record.conflictsWith ?? []).map(id => clean(corpus.claims.find(c => c.id === id) ?? {})),
      scope: u.caseIds.map(id => {
        const c = corpus.cases.find(c => c.id === id);
        return c ? { id, kind: c.kind, limits: c.limits, sourceIds: c.sourceIds } : null;
      }), runMetadata: u.runMetadata,
      catalog: u.type === 'mappings' ? (corpus.frameworks ?? []).find(f => f.id === u.record.techniqueId) ?? null : null });
  }
  return units.sort((a, b) => a.itemKey.localeCompare(b.itemKey));
}

export function reviewSnapshot(corpus, annotations = []) {
  const units = reviewUnits(corpus, annotations), byKey = new Map(units.map(u => [u.itemKey, u]));
  const done = new Set(), active = new Set();
  function resolve(u) {
    if (done.has(u.itemKey)) return;
    if (active.has(u.itemKey)) return;
    active.add(u.itemKey);
    const blockers = [], bindings = {};
    for (const key of u.dependencies) {
      const support = byKey.get(key);
      if (!support) { blockers.push({ itemKey: key, reason: 'Missing required support' }); continue; }
      if (active.has(key)) { blockers.push({ itemKey: key, reason: 'Cyclic required support' }); continue; }
      resolve(support);
      bindings[key] = { revision: digest({ binding: support.binding, support: support.supportBindings }),
        decisionId: support.history.at(-1)?.id ?? null, state: support.state };
      if (support.state !== 'Accepted') blockers.push({ itemKey: key, reason: `Required support is ${support.state}` });
    }
    u.supportBindings = bindings;
    const event = u.history.at(-1);
    const current = event?.binding === u.binding && canonicalSerialize(event.supportBindings) === canonicalSerialize(bindings);
    if (u.unresolved) blockers.push({ itemKey: u.itemKey, reason: `Unresolvable support: ${u.unresolved}` });
    const direct = u.type === 'claims' ? !u.record.inference : u.type === 'annotations' && !u.dependencies.length;
    if (direct && !u.evidence.some(e => e.quote !== null)) blockers.push({ itemKey: u.itemKey, reason: 'Exact retained evidence is unavailable' });
    if (u.type === 'annotations' && u.record.evidenceStatus === 'unresolved') blockers.push({ itemKey: u.itemKey, reason: 'Unresolved annotation evidence' });
    if (u.groundingLost) blockers.push({ itemKey: u.itemKey, reason: 'Extracted literal no longer matches exact evidence; correct or regenerate before acceptance' });
    if (!['claims', 'annotations'].includes(u.type) && !u.dependencies.length) blockers.push({ itemKey: u.itemKey, reason: 'No independently supported record; regenerate or exclude' });
    u.structurallyBlocked = blockers.some(b => /Missing|Cyclic|Unresolvable|unavailable|Unresolved|no longer matches|No independently/.test(b.reason))
      || u.dependencies.some(key => byKey.get(key)?.structurallyBlocked);
    u.stale = !!event && (!current || (event.action === 'accept' && blockers.length > 0));
    u.state = current && event.action === 'exclude' ? 'Excluded' :
      u.stale || blockers.length ? 'Blocked/support changed' :
        current && event.action === 'accept' ? 'Accepted' : current && event.action === 'unsure' ? 'Unsure' : 'Needs review';
    if (u.stale) blockers.push({ itemKey: u.itemKey, reason: 'Decision binding/support changed; explicit re-review required' });
    u.blockers = blockers;
    u.eligible = u.state === 'Accepted';
    u.currentHumanReview = current && !u.stale && ['Accepted', 'Excluded'].includes(u.state);
    active.delete(u.itemKey); done.add(u.itemKey);
  }
  units.forEach(resolve);
  for (const u of units) {
    u.priorityCategory = priorityCategory(u);
    // Deterministic triage, not a model judgment: exact evidence and resolvable,
    // source-local support are required; pending human support review is allowed.
    u.actionable = !!u.priorityCategory && !u.structurallyBlocked && u.evidence.some(e => e.quote !== null);
    u.triageReason = !u.priorityCategory ? 'Evidence/advanced record; not a priority annotation' :
      u.actionable ? 'Grounded priority candidate; required support still needs explicit human decisions' :
        'Exception: missing/mismatching exact evidence or unresolved required support';
  }
  return { schemaVersion: HITL_VERSION, guideVersion: GUIDE_VERSION, snapshot: digest({ corpus, annotations }), units };
}

export function applyItemReview(corpus, input, annotations = []) {
  if (!input || Object.keys(input).some(k => !['snapshot', 'itemKey', 'reviewer', 'selfAttested', 'action', 'rationale',
    'checks', 'guideVersion', 'patch', 'researcherTags', 'contentOrigin', 'labelAuthorship', 'provenanceEvidence',
    'exclusionReason', 'replacementKeys', 'confirmation', 'nonApplicability'].includes(k))
    || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(input.reviewer ?? '')
    || input.selfAttested !== true || input.guideVersion !== GUIDE_VERSION
    || !['accept', 'modify', 'exclude', 'unsure', 'provenance'].includes(input.action)) fail('INVALID_REVIEW');
  const state = reviewSnapshot(corpus, annotations);
  if (input.snapshot !== state.snapshot) fail('STALE_REVIEW');
  const u = state.units.find(u => u.itemKey === input.itemKey);
  if (!u) fail('UNKNOWN_REVIEW_ITEM');
  if (!['accept', 'exclude'].includes(input.action) && !nonempty(input.rationale)) fail('REASON_REQUIRED');
  if (input.action === 'accept') {
    if (u.blockers.some(b => b.reason !== 'Decision binding/support changed; explicit re-review required')
      || u.labels.state !== 'complete') fail('BLOCKED_REVIEW');
    const required = checksFor(u.type);
    if (input.confirmation !== undefined && input.confirmation !== confirmationFor(u)) fail('CHECKLIST_REQUIRED');
    if (input.confirmation === undefined && (!input.checks || Object.keys(input.checks).length !== Object.keys(required).length
      || Object.keys(required).some(key => {
        const check = input.checks[key];
        return check?.result !== 'pass' && !(check?.result === 'not-applicable' && nonempty(check.reason));
      }))) fail('CHECKLIST_REQUIRED');
    if (input.nonApplicability !== undefined && (!input.nonApplicability || typeof input.nonApplicability !== 'object'
      || Array.isArray(input.nonApplicability) || Object.entries(input.nonApplicability)
        .some(([key, reason]) => !Object.hasOwn(required, key) || !nonempty(reason)))) fail('CHECKLIST_REQUIRED');
  }
  if (input.action === 'exclude' && ![...EXCLUSION_REASONS, 'other'].includes(input.exclusionReason)) fail('EXCLUSION_REASON_REQUIRED');
  if (input.action === 'exclude' && input.exclusionReason === 'other' && !nonempty(input.rationale)) fail('REASON_REQUIRED');
  const event = { id: `hitl-${randomUUID()}`, itemKey: u.itemKey, action: input.action,
    reviewer: input.reviewer, reviewerKind: 'self-attested-human', timestamp: new Date().toISOString(),
    rationale: input.rationale ?? '', guideVersion: GUIDE_VERSION, binding: u.binding,
    originalHash: u.originalHash, supportBindings: u.supportBindings, original: u.original,
    contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship,
    runMetadata: u.runMetadata, sourceIds: u.sourceIds, claimIds: u.claimIds,
    previous: eventsOf(corpus).at(-1)?.eventHash ?? null };
  if (input.action === 'accept') {
    event.checks = input.confirmation ? Object.fromEntries(Object.keys(checksFor(u.type)).map(key => [key,
      input.nonApplicability?.[key] ? { result: 'not-applicable', reason: input.nonApplicability[key] } : { result: 'pass' }])) :
      structuredClone(input.checks);
    if (input.confirmation) event.confirmation = input.confirmation;
  }
  if (input.action === 'modify') {
    const patch = input.patch ?? {};
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || Object.keys(patch).some(k => !edits[u.type].includes(k))
      || (!Object.keys(patch).length && !input.researcherTags)
      || (input.researcherTags && (!Array.isArray(input.researcherTags) || input.researcherTags.length > 30
        || input.researcherTags.some(t => !nonempty(t))))) fail('INVALID_CORRECTION');
    const normalizedPatch = structuredClone(patch);
    if (u.record.nullReasons) {
      normalizedPatch.nullReasons = { ...u.record.nullReasons };
      for (const field of Object.keys(patch)) if (u.record[field] === null && patch[field] !== null) delete normalizedPatch.nullReasons[field];
    }
    const changed = { ...u.record, ...normalizedPatch };
    if (digest(changed) === digest(u.record) && digest(input.researcherTags ?? []) === digest(u.researcherTags ?? [])) fail('INVALID_CORRECTION');
    if (Object.entries(patch).some(([key, value]) => key !== 'context' && !nonempty(value))) fail('INVALID_CORRECTION');
    if (u.type === 'annotations') {
      const { claimIds, runId, ...a } = changed;
      // Campaign model metadata may be explicitly unknown; validation does not invent it.
      if (a.origin === 'agent') { a.modelVersion ||= 'unknown'; a.promptVersion ||= 'unknown'; }
      if (validateEnrichment({ schemaVersion: 'talk-enrichment/1', annotations: [a] }, corpus).length) fail('INVALID_CORRECTION');
    } else {
      const copy = structuredClone(corpus);
      const record = u.parent ? copy[u.parent.type].find(r => r.id === u.parent.id)[u.type].find(r => r.id === u.record.id) :
        copy[u.type]?.find(r => r.id === u.id);
      if (record) Object.assign(record, normalizedPatch);
      try { assertValid(reviewEligibleCorpus(copy)); } catch { fail('INVALID_CORRECTION'); }
    }
    event.patch = normalizedPatch; event.researcherTags = input.researcherTags ?? u.researcherTags ?? [];
    event.labelEdited = input.researcherTags !== undefined || labelFields(u.type, u.record)
      .some(field => Object.hasOwn(patch, field.split('.')[0]));
  } else if (input.patch !== undefined || input.researcherTags !== undefined) fail('INVALID_REVIEW');
  if (input.action === 'provenance') {
    const authors = ['LLM-derived', 'Human authored', 'Human-edited', 'unknown'];
    if (!CONTENT_ORIGINS.includes(input.contentOrigin) || !authors.includes(input.labelAuthorship)
      || !nonempty(input.provenanceEvidence)) fail('INVALID_PROVENANCE');
    Object.assign(event, { contentOrigin: input.contentOrigin, labelAuthorship: input.labelAuthorship,
      provenanceEvidence: input.provenanceEvidence, previousOrigin: u.contentOrigin, previousLabelAuthorship: u.labelAuthorship });
  }
  if (input.action === 'exclude') {
    if (input.replacementKeys !== undefined && (!Array.isArray(input.replacementKeys)
      || input.replacementKeys.some(key => !state.units.some(item => item.itemKey === key && key !== u.itemKey)))) fail('INVALID_REPLACEMENT');
    event.exclusionReason = input.exclusionReason; event.replacementKeys = input.replacementKeys ?? [];
    event.rationale = input.exclusionReason === 'other' ? input.rationale.trim() :
      `Excluded: ${input.exclusionReason}.${nonempty(input.rationale) ? ` ${input.rationale.trim()}` : ''}`;
  }
  event.eventHash = digest(event);
  corpus.governance.localReview ??= { schemaVersion: HITL_VERSION, events: [] };
  corpus.governance.localReview.events.push(event);
  return { itemKey: u.itemKey, eventId: event.id };
}

export async function runItemReview(store, input) {
  let code;
  const result = await updatePrivateCorpus(store, async corpus => {
    try {
      const annotations = await readEnrichmentSnapshot(store, corpus);
      return applyItemReview(corpus, input, annotations.annotations);
    } catch (error) { code = error.code; throw error; }
  }, { reviewAware: true });
  return result.status === 'failed' && code ? { ...result, code } : result;
}

export function progressSummary(corpus, snapshot, caseId, sourceIds) {
  const units = snapshot.units.filter(u => (!caseId || u.caseIds.includes(caseId))
    && (!sourceIds || u.sourceIds.some(id => sourceIds.includes(id))));
  const count = items => ({ total: items.length,
    labelsApplicable: items.filter(u => u.labels.applicable).length,
    labelsNA: items.filter(u => !u.labels.applicable).length,
    labelsComplete: items.filter(u => u.labels.applicable && u.labels.state === 'complete').length,
    reviewed: items.filter(u => u.currentHumanReview).length, ready: items.filter(u => u.eligible).length });
  const sources = corpus.sources.filter(s => (!caseId || corpus.cases.find(c => c.id === caseId)?.sourceIds.includes(s.id))
    && (!sourceIds || sourceIds.includes(s.id)));
  let eligible = 0, completed = 0, unavailable = 0, unprocessed = 0, legacyUnlocated = 0;
  for (const source of sources) {
    const revision = source.revisionIds.map(id => corpus.sourceRevisions.find(r => r.id === id))
      .filter(r => typeof r?.normalizedContent === 'string' && r.normalizedContent.length).at(-1);
    if (!revision) { unavailable++; continue; }
    const length = [...revision.normalizedContent].length, segments = Math.ceil(length / 2400);
    eligible += length;
    const historical = new Map(Array.from({ length: segments }, (_, i) => {
      const start = i * 2400, end = Math.min(length, start + 2400);
      return [stableId('segment', `${revision.id}\n${revision.normalizedHash}\n${start}\n${end}`), { start, end }];
    }));
    const ranges = [];
    let attempted = false, unlocated = false;
    for (const run of corpus.governance?.campaignExtraction?.runs ?? []) {
      if (caseId && run.caseId !== caseId) continue;
      const coverage = run.coverage?.find(c => c.sourceRevisionId === revision.id && c.normalizedHash === revision.normalizedHash);
      if (!coverage) continue;
      attempted = true;
      if (Array.isArray(run.segmentCoverage)) {
        for (const item of run.segmentCoverage) {
          if (item.status !== 'completed') continue;
          if (run.chunkPolicy) {
            if (item.sourceRevisionId === revision.id && item.normalizedHash === revision.normalizedHash
              && Number.isSafeInteger(item.start) && Number.isSafeInteger(item.end)
              && item.start >= 0 && item.end > item.start && item.end <= length) ranges.push(item);
          } else if (historical.has(item.segmentId)) ranges.push(historical.get(item.segmentId));
        }
      } else if (coverage.completed === segments && coverage.segments === segments) ranges.push({ start: 0, end: length });
      else if (coverage.completed > 0) unlocated = true;
    }
    completed += unionCoverage(ranges).reduce((sum, range) => sum + range.end - range.start, 0);
    if (unlocated) legacyUnlocated++;
    if (!attempted) unprocessed++;
  }
  const priority = units.filter(u => u.actionable);
  return { ...count(units), byType: Object.fromEntries(unique(units.map(u => u.type)).map(type => [type, count(units.filter(u => u.type === type))])),
    priority: { ...count(priority), byType: Object.fromEntries(['tools', 'behaviors', 'prompts'].map(type => [type,
      count(priority.filter(u => u.priorityCategory === type))])) },
    hiddenEvidence: units.filter(u => u.type === 'claims').length,
    deferred: units.filter(u => !u.priorityCategory && u.type !== 'claims').length,
    exceptions: units.filter(u => u.priorityCategory && !u.actionable).length,
    extraction: { completed, eligible, unavailable, unprocessed, legacyUnlocated, unit: 'canonical-code-points' } };
}

// Reviewed records are a projection, not a private audit log or an importable corpus.
export function reviewedProfile(corpus, annotations = []) {
  assertValid(reviewEligibleCorpus(corpus));
  const state = reviewSnapshot(corpus, annotations), records = [];
  const accepted = state.units.filter(u => u.eligible);
  const byKey = new Map(accepted.map(u => [u.itemKey, u]));
  const sourceIds = new Set(), revisionIds = new Set(), passageIds = new Set(), frameworkIds = new Set();
  const caseIds = new Set();
  const add = (entityType, entity, reviewStatus = null, warnings = []) => records.push({
    schemaVersion: corpus.schemaVersion, entityType, entity, reviewStatus, warnings,
  });
  for (const u of accepted) {
    const entity = structuredClone(u.record);
    u.caseIds.forEach(id => caseIds.add(id));
    if (u.parent) { entity.id = stableId('review-unit', u.itemKey); entity.localId = u.record.id ?? String(u.index); entity.parent = u.parent; }
    if (u.type === 'behaviors') {
      entity.occurrences = (entity.occurrences ?? []).flatMap((o, i) => {
        const occurrence = byKey.get(keyFor('occurrences', `${u.id}/${i}`));
        return occurrence ? [structuredClone(occurrence.record)] : [];
      });
      for (const [field, type] of [['signalIds', 'telemetry'], ['detectionIds', 'detections'], ['otelIds', 'otel']]) {
        if (entity[field]) entity[field] = entity[field].filter(id => byKey.has(keyFor(type, id)));
      }
    }
    if (u.type === 'paths') {
      entity.nodes = entity.nodes.map(n => structuredClone(byKey.get(keyFor('nodes', `${u.id}/${n.id}`)).record));
      entity.edges = entity.edges.map(e => structuredClone(byKey.get(keyFor('edges', `${u.id}/${e.id}`)).record));
    }
    if (u.type === 'annotations') {
      // Literal extracted annotations may contain private quotations; reviewed public
      // exports include classification metadata only, not article-derived values.
      for (const field of ['value', 'normalizedValue', 'support', 'context', 'modelVersion', 'promptVersion']) delete entity[field];
      entity.contentOmitted = 'Private annotation content retained locally; classification is not a public quotation license.';
      if (entity.sourceRevisionId) revisionIds.add(entity.sourceRevisionId);
    }
    if (u.type === 'cases' && entity.pathIds) entity.pathIds = entity.pathIds.filter(id => byKey.has(keyFor('paths', id)));
    if (u.type === 'mappings') frameworkIds.add(entity.techniqueId);
    if (u.type === 'claims') {
      revisionIds.add(entity.sourceRevisionId); entity.passageIds.forEach(id => passageIds.add(id));
      if (entity.conflictsWith.some(id => !byKey.has(keyFor('claims', id)))) entity.conflictsWithheld = true;
      entity.conflictsWith = entity.conflictsWith.filter(id => byKey.has(keyFor('claims', id)));
    }
    (entity.sourceRevisionIds ?? []).forEach(id => revisionIds.add(id));
    (entity.standardSourceIds ?? []).forEach(id => sourceIds.add(id));
    u.sourceIds.forEach(id => sourceIds.add(id));
    if (entity.history) entity.history = [];
    if (Object.hasOwn(entity, 'disposition')) entity.disposition = 'Accepted';
    add(u.type, entity, { currentAcceptance: true, guideVersion: u.history.at(-1).guideVersion, caseIds: u.caseIds,
      contentOrigin: u.contentOrigin, labelAuthorship: u.labelAuthorship, humanReviewed: true,
      binding: u.binding }, u.type === 'detections' || u.type === 'otel' ? ['Reviewed proposal; not operational validation.'] : []);
  }
  for (const id of caseIds) if (!byKey.has(keyFor('cases', id))) {
    const record = corpus.cases.find(c => c.id === id);
    if (record) add('cases', { id, name: record.name, sourceIds: record.sourceIds.filter(id => sourceIds.has(id)), contextOnly: true },
      null, ['Case identity context only; summary withheld pending its independent review.']);
  }
  // Framework definitions are pinned reference metadata, not incident review units.
  let changed;
  do {
    changed = false;
    for (const f of corpus.frameworks ?? []) if (frameworkIds.has(f.id) && f.parentId && !frameworkIds.has(f.parentId)) {
      frameworkIds.add(f.parentId); changed = true;
    }
  } while (changed);
  for (const f of corpus.frameworks ?? []) if (frameworkIds.has(f.id)) {
    add('frameworks', structuredClone(f)); sourceIds.add(f.sourceId);
  }
  for (const p of corpus.passages) if (passageIds.has(p.id)) {
    add('passages', { ...structuredClone(p), text: null, attestation: null,
      nullReasons: { ...p.nullReasons, text: 'not_applicable', attestation: 'not_applicable' } });
    revisionIds.add(p.sourceRevisionId);
  }
  for (const r of corpus.sourceRevisions) if (revisionIds.has(r.id)) {
    add('sourceRevisions', { ...structuredClone(r), rawContent: null, normalizedContent: null,
      nullReasons: { ...r.nullReasons, rawContent: 'not_applicable', normalizedContent: 'not_applicable' } });
    sourceIds.add(r.sourceId);
  }
  for (const s of corpus.sources) if (sourceIds.has(s.id)) add('sources', {
    ...structuredClone(s), revisionIds: s.revisionIds.filter(id => revisionIds.has(id)),
  });
  records.sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entity.id.localeCompare(b.entity.id));
  const snapshotDigest = digest(records);
  return { schemaVersion: corpus.schemaVersion, profile: 'reviewed', snapshotDigest, records,
    coverage: { profile: 'reviewed', snapshotDigest, filters: {},
      units: Object.fromEntries(['cases', 'sources', 'claims'].map(t => [t, records.filter(r => r.entityType === t).length])),
      optionalEnrichment: Object.fromEntries(optionalTypes.map(t => [t, records.filter(r => r.entityType === t).length])),
      reviewCoverage: Object.fromEntries([...coreTypes, ...optionalTypes].map(t => [t, {
        currentAccepted: state.units.filter(u => u.type === t && u.eligible).length,
        included: records.filter(r => r.entityType === t).length,
        pending: state.units.filter(u => u.type === t && u.state === 'Needs review').length,
        excluded: state.units.filter(u => u.type === t && u.state === 'Excluded').length,
        staleAcceptance: state.units.filter(u => u.type === t && u.stale).length,
      }])) } };
}
