import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runEnrichment } from '../src/enrichment.mjs';
import { runCampaign } from '../src/campaign.mjs';
import { benignChunkReport } from '../src/chunks.mjs';
import { runStage } from '../src/stages.mjs';
import { runComparison } from '../src/stage-comparison.mjs';
import {
  assertValid, canonicalSerialize, digest, readPrivateTemplate, sha256, stableId, updatePrivateCorpus,
} from './contract.mjs';

export const EXTRACTION_VERSION = 'manual-extraction/1';
const fail = message => {
  const error = new Error(message);
  error.code = 'INVALID_EXTRACTION';
  return error;
};

function onlyKeys(value, allowed, required) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key))
    && required.every(key => Object.hasOwn(value, key));
}

function identifiers(items) {
  return [...new Set(items)].sort();
}

export function applyExtraction(corpus, template, suppliedBy, templateText) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(suppliedBy)
    || !onlyKeys(template, ['schemaVersion', 'claims'], ['schemaVersion', 'claims'])
    || template.schemaVersion !== EXTRACTION_VERSION || !Array.isArray(template.claims) || !template.claims.length) {
    throw fail('template must contain manual-extraction/1 claims and valid supplier attribution');
  }

  const claims = [];
  const passages = [];
  const seenClaimIds = new Set();
  const seenPassageIds = new Set();
  for (const item of template.claims) {
    const required = ['id', 'caseId', 'sourceId', 'sourceRevisionId', 'revisionHash', 'description', 'evidenceStatus', 'origin'];
    const optional = ['passages', 'inference', 'conflictsWith', 'uncertainty', 'observationContext'];
    if (!onlyKeys(item, [...required, ...optional], required) || !Array.isArray(item.passages ?? [])
      || !Array.isArray(item.conflictsWith ?? [])) throw fail('claim template has missing or unknown fields');
    if (seenClaimIds.has(item.id)) throw fail(`duplicate claim ID in template: ${item.id}`);
    seenClaimIds.add(item.id);

    const source = corpus.sources.find(record => record.id === item.sourceId);
    const revision = corpus.sourceRevisions.find(record => record.id === item.sourceRevisionId);
    const caseRecord = corpus.cases.find(record => record.id === item.caseId);
    if (!source || !revision || !caseRecord || revision.sourceId !== source.id
      || !source.revisionIds.includes(revision.id) || item.revisionHash !== revision.normalizedHash
      || revision.normalizedContent === null) throw fail(`claim ${item.id} has an unknown source/case or incorrect/unretained revision`);

    const passageIds = [];
    for (const passage of item.passages ?? []) {
      if (!onlyKeys(passage, ['id', 'locator', 'start', 'end', 'text'], ['id', 'locator', 'start', 'end', 'text'])
        || !Number.isSafeInteger(passage.start) || !Number.isSafeInteger(passage.end)
        || passage.start < 0 || passage.end <= passage.start) throw fail(`claim ${item.id} has invalid passage offsets`);
      if (seenPassageIds.has(passage.id)) throw fail(`duplicate passage ID in template: ${passage.id}`);
      seenPassageIds.add(passage.id);
      const text = [...revision.normalizedContent].slice(passage.start, passage.end).join('');
      if (!text || text !== passage.text) throw fail(`claim ${item.id} passage text does not match its revision offsets`);
      passageIds.push(passage.id);
      passages.push({
        id: passage.id, sourceRevisionId: revision.id, text, locator: passage.locator,
        start: passage.start, end: passage.end, attestation: null, nullReasons: { attestation: 'not_applicable' },
      });
    }
    const inference = item.inference ?? null;
    if ((item.evidenceStatus === 'Researcher inference') !== (inference !== null)
      || (inference && item.origin !== 'Human inference')
      || (!inference && item.origin === 'Human inference')
      || (inference && (item.passages ?? []).length)) throw fail(`claim ${item.id} has inconsistent inference classification`);
    if (!passageIds.length && !inference) throw fail(`claim ${item.id} needs passages or an explicit inference`);

    const claim = {
      id: item.id, caseId: item.caseId, sourceId: source.id, sourceRevisionId: revision.id,
      description: item.description, passageIds, inference, evidenceStatus: item.evidenceStatus,
      origin: item.origin, disposition: 'Pending', revision: 'r1', history: [],
      conflictsWith: item.conflictsWith ?? [], uncertainty: item.uncertainty ?? null,
      observationContext: item.observationContext ?? null,
      nullReasons: {
        ...(inference === null ? { inference: 'not_applicable' } : {}),
        ...(item.uncertainty === undefined || item.uncertainty === null ? { uncertainty: 'unknown' } : {}),
        ...(item.observationContext === undefined || item.observationContext === null ? { observationContext: 'not_applicable' } : {}),
      },
    };
    claims.push(claim);
  }

  for (const [records, collection] of [[passages, corpus.passages], [claims, corpus.claims]]) {
    for (const record of records) {
      const existing = collection.find(item => item.id === record.id);
      if (existing && canonicalSerialize(existing) !== canonicalSerialize(record)) throw fail(`record ID collision: ${record.id}`);
      if (!existing) collection.push(record);
    }
  }
  for (const claim of claims) {
    const parent = corpus.cases.find(record => record.id === claim.caseId);
    if (!parent.sourceIds.includes(claim.sourceId)) parent.sourceIds.push(claim.sourceId);
    corpus.sources.find(record => record.id === claim.sourceId).extractionStatus = 'Extracted';
  }

  const sourceIds = identifiers(claims.map(claim => claim.sourceId));
  const revisionIds = identifiers(claims.map(claim => claim.sourceRevisionId));
  const inputHash = sha256(templateText);
  const outputHash = digest({
    claims: claims.map(claim => corpus.claims.find(record => record.id === claim.id)),
    passages: passages.map(passage => corpus.passages.find(record => record.id === passage.id)),
  });
  const manifest = {
    id: stableId('extraction-manifest', canonicalSerialize({ inputHash, suppliedBy, toolVersion: EXTRACTION_VERSION })),
    kind: 'extraction', inputSourceIds: sourceIds, inputRevisionIds: revisionIds, outcome: 'Succeeded',
    provenance: {
      kind: 'supplied-text', suppliedBy,
      description: 'Researcher-completed manual extraction template; no model or acceptance.',
      nullReasons: {},
    },
    toolVersion: EXTRACTION_VERSION, inputHash, outputHash,
    limitations: ['manual template only; claims remain pending review; no automatic case creation or merging'],
    nullReasons: {},
  };
  const prior = corpus.collectionManifests.find(record => record.id === manifest.id);
  if (prior && canonicalSerialize(prior) !== canonicalSerialize(manifest)) throw fail('extraction manifest identity collision');
  if (!prior) corpus.collectionManifests.push(manifest);

  const errors = [];
  try { assertValid(corpus); } catch (error) { errors.push(...error.message.split('\n')); }
  if (errors.length) {
    const error = fail('extraction does not satisfy the 0.3.0 corpus contract');
    error.errors = errors;
    throw error;
  }
  return { claimIds: claims.map(claim => claim.id), manifestId: manifest.id };
}

export async function runExtraction({ templateFile, store, suppliedBy }) {
  try {
    if (typeof templateFile !== 'string' || typeof store !== 'string') throw fail('template and store paths are required');
    const templateText = await readPrivateTemplate(templateFile);
    let template;
    try { template = JSON.parse(templateText); } catch { throw fail('template must be valid JSON'); }
    return await updatePrivateCorpus(store, corpus => applyExtraction(corpus, template, suppliedBy, templateText));
  } catch (error) {
    return { status: 'failed', code: error.code ?? 'INVALID_INPUT' };
  }
}

async function cli(args) {
  if (args[0] === 'stage') return stageCli(args.slice(1));
  if (args[0] === 'regeneration') return comparisonCli(args.slice(1));
  if (args[0] === 'campaign') return campaignCli(args.slice(1));
  if (args[0] === 'enrichment') return enrichmentCli(args.slice(1));
  const values = {};
  if (args.length % 2) return { status: 'failed', code: 'INVALID_INPUT' };
  for (let index = 0; index < args.length; index += 2) {
    if (!['--template', '--store', '--supplied-by'].includes(args[index]) || Object.hasOwn(values, args[index])) {
      return { status: 'failed', code: 'INVALID_INPUT' };
    }
    values[args[index]] = args[index + 1];
  }
  if (Object.keys(values).length !== 3) return { status: 'failed', code: 'INVALID_INPUT' };
  return runExtraction({ templateFile: values['--template'], store: values['--store'], suppliedBy: values['--supplied-by'] });
}

function commandOptions(args, required, optional = []) {
  if (args.length % 2) return null;
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (![...required, ...optional].includes(args[i]) || Object.hasOwn(values, args[i]) || !args[i + 1]) return null;
    values[args[i]] = args[i + 1];
  }
  return required.every(k => Object.hasOwn(values, k)) ? values : null;
}

async function stageCli([command, ...args]) {
  const required = {
    prepare: ['--store', '--case', '--stage', '--output'], validate: ['--store', '--request', '--input'],
    apply: ['--store', '--request', '--input'], status: ['--store'],
  }[command];
  if (!required) return { status: 'failed', code: 'INVALID_INPUT' };
  const values = commandOptions(args, required, command === 'prepare' ? ['--inputs', '--revisions', '--requested-model']
    : command === 'status' ? ['--case'] : []);
  if (!values) return { status: 'failed', code: 'INVALID_INPUT' };
  const result = await runStage({ command, store: values['--store'], caseId: values['--case'], kind: values['--stage'],
    inputKeys: values['--inputs']?.split(','), revisionIds: values['--revisions']?.split(','),
    requestedModel: values['--requested-model'], outputFile: values['--output'], requestFile: values['--request'], inputFile: values['--input'] });
  if (result.status !== 'succeeded') return result;
  return { status: result.status, command, pending: true,
    ...(result.request ? { requestHash: result.request.requestHash, kind: result.request.kind,
      inputs: result.request.upstream.length, revisions: result.request.inputs.length } : {}),
    ...(result.runId ? { runId: result.runId, replay: result.replay ?? false } : {}),
    ...(result.validationHash ? { validationHash: result.validationHash } : {}),
    ...(command === 'status' ? { stages: result.summary.runs.map(r => ({ id: r.id, kind: r.kind,
      state: r.state, completed: r.processing.filter(i => i.status === 'completed').length, total: r.processing.length })) } : {}) };
}

async function comparisonCli([command, ...args]) {
  const required = {
    freeze: ['--store', '--case', '--output'], candidate: ['--baseline', '--output'],
    compare: ['--store', '--baseline', '--output'], select: ['--store', '--baseline', '--comparison', '--input'],
    status: ['--store'],
  }[command];
  if (!required) return { status: 'failed', code: 'INVALID_INPUT' };
  const values = commandOptions(args, required);
  if (!values) return { status: 'failed', code: 'INVALID_INPUT' };
  return runComparison({ command, store: values['--store'], caseId: values['--case'],
    baselineFile: values['--baseline'], comparisonFile: values['--comparison'], inputFile: values['--input'], outputFile: values['--output'] });
}

async function campaignCli([command, ...args]) {
  if (command === 'report-demo') {
    return args.length ? { status: 'failed', code: 'INVALID_INPUT' }
      : { status: 'succeeded', benignReport: benignChunkReport() };
  }
  const required = {
    prepare: ['--store', '--case', '--output'],
    report: ['--store', '--request', '--output'],
    validate: ['--store', '--request', '--input'],
    apply: ['--store', '--request', '--input'],
    status: ['--store'],
    export: ['--store', '--case', '--output'],
  }[command];
  if (!required || args.length % 2) return { status: 'failed', code: 'INVALID_INPUT' };
  const allowed = [...new Set([...required, ...(command === 'prepare' ? ['--revisions', '--requested-model'] : []),
    ...(command === 'export' ? ['--format'] : []), ...(command === 'status' ? ['--case'] : [])])];
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.includes(args[index]) || Object.hasOwn(values, args[index]) || !args[index + 1]) {
      return { status: 'failed', code: 'INVALID_INPUT' };
    }
    values[args[index]] = args[index + 1];
  }
  if (required.some(key => !Object.hasOwn(values, key))) return { status: 'failed', code: 'INVALID_INPUT' };
  const result = await runCampaign({
    command, store: values['--store'], caseId: values['--case'], outputFile: values['--output'],
    requestFile: values['--request'], inputFile: values['--input'],
    revisionIds: values['--revisions']?.split(','), requestedModel: values['--requested-model'],
    format: values['--format'],
  });
  // The private file is the payload; terminal/CI output contains only safe aggregate metadata.
  if (result.status !== 'succeeded') return result;
  return {
    status: result.status, command, ...(result.runId ? { runId: result.runId, replay: result.replay ?? false } : {}),
    ...(result.request ? { requestHash: result.request.requestHash, inputSnapshotDigest: result.request.inputSnapshotDigest,
      sources: result.request.inputs.length, segments: result.request.inputs.reduce((n, i) => n + i.segments.length, 0),
      unavailable: result.request.inputs.filter(i => i.availability === 'unavailable').length } : {}),
    ...(result.summary?.runs ? { pending: true, runs: result.summary.runs.map(run => ({
      id: run.id, claims: run.claimIds.length, coverage: run.coverage.map(({ sourceId, sourceRevisionId, reason, ...safe }) => safe),
      limitations: run.limitations.length, recordCounts: run.recordCounts,
    })) } : {}),
    ...(result.bundle ? { private: true, format: values['--format'] ?? 'json' } : {}),
    ...(command === 'report' ? { private: true, chunks: result.summary.chunks } : {}),
  };
}

async function enrichmentCli([command, ...args]) {
  const required = {
    validate: ['--store', '--input'], import: ['--store', '--input'],
    export: ['--store', '--output'],
    template: ['--store', '--case', '--source', '--revision', '--output'],
  }[command];
  if (!required || args.length % 2) return { status: 'failed', code: 'INVALID_INPUT' };
  const allowed = [...required, ...(command === 'export' ? ['--case'] : [])];
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.includes(args[index]) || Object.hasOwn(values, args[index]) || !args[index + 1]) {
      return { status: 'failed', code: 'INVALID_INPUT' };
    }
    values[args[index]] = args[index + 1];
  }
  if (required.some(key => !Object.hasOwn(values, key))) return { status: 'failed', code: 'INVALID_INPUT' };
  return runEnrichment({
    command, store: values['--store'], inputFile: values['--input'], outputFile: values['--output'],
    caseId: values['--case'], sourceId: values['--source'], sourceRevisionId: values['--revision'],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cli(process.argv.slice(2));
  process.stdout.write(result.benignReport ?? JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'succeeded' ? 0 : 1;
}
