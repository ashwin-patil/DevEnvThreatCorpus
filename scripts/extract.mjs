import { fileURLToPath } from 'node:url';
import path from 'node:path';
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cli(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'succeeded' ? 0 : 1;
}
