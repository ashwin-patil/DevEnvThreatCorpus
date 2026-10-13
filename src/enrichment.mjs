import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalSerialize, readPrivateTemplate, stableId, validatePrivateCorpus } from '../scripts/contract.mjs';

export const ENRICHMENT_VERSION = 'talk-enrichment/1';
export const ENRICHMENT_LIMITS = Object.freeze({ annotations: 1000, bytes: 2 * 1024 * 1024 });
export const ANNOTATION_TYPES = Object.freeze([
  'role-context', 'observed-behavior', 'data-sources', 'commands-ai-artifacts',
  'traditional-indicators', 'ttp-references', 'detection-references', 'talk-tags',
]);
const text = { type: 'string', minLength: 1, maxLength: 65536 };
const identifier = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$' };
const referenceIdentifier = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' };
const enumeration = values => ({ type: 'string', enum: values });
const shape = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const list = values => ({ type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: enumeration(values) });
const contextSchema = shape({
  roles: list([
    'victim-side-environment', 'victim-side-agent-abuse', 'attacker-controlled-component',
    'attacker-controlled-infrastructure', 'attacker-side-ai-use', 'ai-review-targeting', 'other-unclear',
  ]),
  behavior: enumeration(['observed', 'attempted', 'demonstrated', 'inferred']),
  trustSurface: text, objective: text,
  collection: enumeration(['article-mentioned', 'proposed']),
  dataSources: list(['endpoint', 'process', 'network', 'dns', 'identity', 'repository', 'package', 'agent-ide', 'github-actions', 'ci-cd', 'cloud']),
  artifactKind: enumeration(['command', 'executable', 'flag-argument', 'prompt-instruction', 'agent-configuration', 'ide-cli', 'extension', 'skill', 'mcp-tool', 'mcp-server']),
  indicatorKind: enumeration(['domain', 'ip', 'url', 'hash', 'file-path', 'package', 'repository', 'user-agent', 'workflow', 'action-ref', 'runner', 'configuration']),
  mapping: enumeration(['source-mentioned', 'researcher-proposed']),
  framework: text, frameworkVersion: text,
  detection: enumeration(['published-reference', 'untested-suggestion']),
  notes: text,
});
const requiredContext = {
  'role-context': 'roles', 'observed-behavior': 'behavior', 'data-sources': 'collection',
  'ttp-references': 'mapping', 'detection-references': 'detection',
};

// Context dimensions can overlap; classification never changes the evidence or review status.
export const enrichmentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...shape({
    schemaVersion: { const: ENRICHMENT_VERSION },
    annotations: {
      type: 'array', maxItems: ENRICHMENT_LIMITS.annotations,
      items: {
        ...shape({
          id: identifier, caseId: referenceIdentifier, sourceId: referenceIdentifier, sourceRevisionId: referenceIdentifier,
          type: enumeration(ANNOTATION_TYPES), value: text, normalizedValue: text,
          context: contextSchema,
          evidenceStatus: enumeration(['evidence-backed', 'inference', 'unresolved']),
          support: {
            ...shape({
              quote: text,
              locator: shape({
                start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 1 },
              }, ['start', 'end']),
            }),
            anyOf: [{ required: ['quote'] }, { required: ['locator'] }],
            description: 'Exact normalized revision quote and/or Unicode code-point half-open [start,end) offsets. Repeated quotes require a locator or unresolved evidenceStatus.',
          },
          origin: enumeration(['manual', 'agent']), status: { const: 'pending' },
          modelVersion: text, promptVersion: text, externalReferenceUrl: { ...text, format: 'uri' },
        }, ['id', 'caseId', 'sourceId', 'sourceRevisionId', 'type', 'value', 'evidenceStatus', 'origin', 'status']),
        allOf: [
          { if: { properties: { origin: { const: 'agent' } } }, then: { required: ['modelVersion', 'promptVersion'] } },
          { if: { properties: { evidenceStatus: { const: 'evidence-backed' } } }, then: { required: ['support'] } },
          ...Object.entries(requiredContext).map(([type, field]) => ({
            if: { properties: { type: { const: type } } },
            then: { required: ['context'], properties: { context: { required: [field] } } },
          })),
        ],
      },
    },
  }, ['schemaVersion', 'annotations']),
};

function failure(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function checkShape(value, definition, location, errors) {
  const reject = message => errors.push(`${location}: ${message}`);
  if (definition.const !== undefined && value !== definition.const) reject('invalid fixed value');
  if (definition.enum && !definition.enum.includes(value)) reject('invalid enum');
  if (definition.type) {
    const valid = definition.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : definition.type === 'array' ? Array.isArray(value)
        : definition.type === 'integer' ? Number.isSafeInteger(value) : typeof value === definition.type;
    if (!valid) { reject(`must be ${definition.type}`); return; }
  }
  if (typeof value === 'string') {
    if (definition.minLength && !value.trim()) reject('must not be empty');
    if (definition.maxLength && [...value].length > definition.maxLength) reject('too long');
    if (definition.pattern && !new RegExp(definition.pattern).test(value)) reject('invalid identifier');
  }
  if (typeof value === 'number' && definition.minimum !== undefined && value < definition.minimum) reject('invalid offset');
  if (Array.isArray(value)) {
    if (definition.minItems && value.length < definition.minItems) reject('empty list');
    if (definition.maxItems !== undefined && value.length > definition.maxItems) reject('too many items');
    if (definition.uniqueItems && new Set(value).size !== value.length) reject('duplicate item');
    if (definition.items) value.forEach((item, index) => checkShape(item, definition.items, `${location}[${index}]`, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of definition.required ?? []) if (!Object.hasOwn(value, field)) reject(`missing ${field}`);
    for (const [field, item] of Object.entries(value)) {
      if (definition.properties?.[field]) checkShape(item, definition.properties[field], `${location}.${field}`, errors);
      else if (definition.additionalProperties === false) reject(`unknown field ${field}`);
    }
  }
  if (definition.anyOf && !definition.anyOf.some(branch => {
    const trial = [];
    checkShape(value, branch, location, trial);
    return trial.length === 0;
  })) reject('requires a quote or locator');
  for (const branch of definition.allOf ?? []) {
    const trial = [];
    checkShape(value, branch.if, location, trial);
    if (!trial.length) checkShape(value, branch.then, location, errors);
  }
}

function resolveSupport(annotation, revision) {
  const { support } = annotation;
  if (!support || typeof revision?.normalizedContent !== 'string') return null;
  const points = [...revision.normalizedContent];
  if (support.locator) {
    const { start, end } = support.locator;
    if (end <= start || end > points.length) throw failure('INVALID_ENRICHMENT', 'support locator is outside retained text');
    const quote = points.slice(start, end).join('');
    if (support.quote !== undefined && support.quote !== quote) throw failure('INVALID_ENRICHMENT', 'quote differs from locator text');
    return { quote, locator: { start, end } };
  }
  const offset = revision.normalizedContent.indexOf(support.quote);
  if (offset < 0 || revision.normalizedContent.indexOf(support.quote, offset + 1) !== -1) return null;
  const start = [...revision.normalizedContent.slice(0, offset)].length;
  const end = start + [...support.quote].length;
  if (points.slice(start, end).join('') !== support.quote) return null;
  return { quote: support.quote, locator: { start, end } };
}

export function validateEnrichment(document, corpus) {
  const errors = [];
  try {
    if (Buffer.byteLength(JSON.stringify(document)) > ENRICHMENT_LIMITS.bytes) errors.push('enrichment: exceeds 2 MiB');
  } catch { return ['enrichment: must be a JSON document']; }
  checkShape(document, enrichmentSchema, 'enrichment', errors);
  if (errors.length) return errors;
  const seen = new Set();
  for (const item of document.annotations) {
    const reject = message => errors.push(`annotation ${item.id}: ${message}`);
    if (seen.has(item.id)) reject('duplicate ID');
    seen.add(item.id);
    const caseRecord = corpus.cases.find(record => record.id === item.caseId);
    const source = corpus.sources.find(record => record.id === item.sourceId);
    const revision = corpus.sourceRevisions.find(record => record.id === item.sourceRevisionId);
    if (!caseRecord || !source || !revision || !caseRecord.sourceIds.includes(item.sourceId)
      || !source.revisionIds.includes(item.sourceRevisionId) || revision.sourceId !== item.sourceId) {
      reject('unknown or unlinked case/source/revision');
      continue;
    }
    try {
      if (item.support?.locator && item.support.locator.end <= item.support.locator.start) {
        throw failure('INVALID_ENRICHMENT', 'support locator must be a nonempty half-open range');
      }
      const support = resolveSupport(item, revision);
      if ((item.evidenceStatus === 'evidence-backed' || item.support) && !support && item.evidenceStatus !== 'unresolved') {
        reject('support must resolve uniquely to retained text; label absent/ambiguous support unresolved');
      }
    } catch (error) { reject(error.message); }
    if (item.externalReferenceUrl !== undefined) {
      try {
        const url = new URL(item.externalReferenceUrl);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
          || /[\u0000-\u0020\\]/u.test(item.externalReferenceUrl)) throw new Error();
      } catch { reject('external reference must be a credential-free HTTP(S) URL'); }
    }
    if (item.context?.behavior === 'inferred' && item.evidenceStatus === 'evidence-backed') reject('inferred behavior must remain inference or unresolved');
    if ((item.context?.collection === 'proposed' || item.context?.mapping === 'researcher-proposed'
      || item.context?.detection === 'untested-suggestion') && item.evidenceStatus === 'evidence-backed') {
      reject('researcher proposals must remain inference or unresolved');
    }
  }
  return errors;
}

function assertEnrichment(document, corpus) {
  const errors = validateEnrichment(document, corpus);
  if (errors.length) throw failure('INVALID_ENRICHMENT', errors.join('\n'));
  return document;
}

function normalizeDocument(document, corpus) {
  assertEnrichment(document, corpus);
  const copy = structuredClone(document);
  for (const item of copy.annotations) {
    const support = resolveSupport(item, corpus.sourceRevisions.find(record => record.id === item.sourceRevisionId));
    if (support) item.support = support;
  }
  copy.annotations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return copy;
}

export function createEnrichmentTemplate({ corpus, caseId, sourceId, sourceRevisionId }) {
  const defaults = {
    'role-context': { roles: ['other-unclear'] },
    'observed-behavior': { behavior: 'inferred' },
    'data-sources': { collection: 'proposed' },
    'ttp-references': { mapping: 'researcher-proposed' },
    'detection-references': { detection: 'untested-suggestion' },
  };
  return assertEnrichment({
    schemaVersion: ENRICHMENT_VERSION,
    annotations: ANNOTATION_TYPES.map(type => ({
      id: stableId(`annotation-${type}`, canonicalSerialize({ caseId, sourceId, sourceRevisionId })),
      caseId, sourceId, sourceRevisionId, type,
      value: `Replace this ${type} placeholder; it is not source evidence.`,
      ...(defaults[type] ? { context: defaults[type] } : {}),
      evidenceStatus: 'inference', origin: 'manual', status: 'pending',
    })),
  }, corpus);
}

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
function absoluteSafe(file, write = false) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0')
    || path.normalize(file) !== file || file.split(path.sep).some(part => ['.', '..'].includes(part))) {
    throw failure('UNSAFE_PATH');
  }
  if (write) {
    const relative = path.relative(repoRoot, file);
    if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
      && relative !== '.private-intake' && !relative.startsWith(`.private-intake${path.sep}`)) throw failure('UNSAFE_PATH');
  }
  return file;
}

async function components(file) {
  absoluteSafe(file);
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw failure('UNSAFE_PATH');
  }
}

export async function privateDirectory(directory, { create = false } = {}) {
  absoluteSafe(directory, true);
  if (create) {
    await components(path.dirname(directory));
    try { await fs.mkdir(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  await components(directory);
  const baseline = await fs.lstat(directory);
  if (!baseline.isDirectory() || (baseline.mode & 0o777) !== 0o700) throw failure('UNSAFE_PATH');
  return async () => {
    await components(directory);
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.dev !== baseline.dev || stat.ino !== baseline.ino
      || (stat.mode & 0o777) !== 0o700) throw failure('UNSAFE_PATH');
  };
}

async function readDocument(file, corpus) {
  absoluteSafe(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600) throw failure('UNSAFE_PATH');
  const input = await readPrivateTemplate(file);
  if (Buffer.byteLength(input) > ENRICHMENT_LIMITS.bytes) throw failure('TOO_LARGE');
  let document;
  try { document = JSON.parse(input); } catch { throw failure('INVALID_ENRICHMENT', 'invalid JSON'); }
  return normalizeDocument(document, corpus);
}

function serialize(document) {
  const output = canonicalSerialize(document);
  if (Buffer.byteLength(output) > ENRICHMENT_LIMITS.bytes) throw failure('TOO_LARGE');
  return output;
}

async function syncDirectory(directory) {
  const handle = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await handle.sync(); } finally { await handle.close(); }
}

export async function privateOutput(file, document, { raw = false } = {}) {
  const output = raw ? document : serialize(document);
  if (typeof output !== 'string' || Buffer.byteLength(output) > ENRICHMENT_LIMITS.bytes) throw failure('TOO_LARGE');
  absoluteSafe(file, true);
  const verify = await privateDirectory(path.dirname(file));
  await verify();
  let handle;
  try {
    handle = await fs.open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(output, 'utf8');
    await handle.sync();
    await verify();
    await syncDirectory(path.dirname(file));
  } catch (error) {
    if (handle) {
      await verify();
      await fs.unlink(file);
    }
    throw error.code === 'EEXIST' ? failure('UNSAFE_PATH') : error;
  } finally { await handle?.close(); }
}

async function importDocument(directory, document, corpus) {
  const verify = await privateDirectory(directory, { create: true });
  const file = path.join(directory, 'annotations.json');
  let previous = { schemaVersion: ENRICHMENT_VERSION, annotations: [] };
  let baseline = null;
  try {
    baseline = await readPrivateTemplate(file);
    previous = await readDocument(file, corpus);
  } catch (error) {
    let missing = false;
    try { await fs.lstat(file); } catch (statError) { if (statError.code === 'ENOENT') missing = true; else throw statError; }
    if (!missing || error.code !== 'UNSAFE_PATH') throw error;
  }
  const byId = new Map(previous.annotations.map(item => [item.id, item]));
  for (const annotation of document.annotations) {
    const existing = byId.get(annotation.id);
    if (existing && canonicalSerialize(existing) !== canonicalSerialize(annotation)) throw failure('ANNOTATION_COLLISION');
    byId.set(annotation.id, annotation);
  }
  const combined = normalizeDocument({ schemaVersion: ENRICHMENT_VERSION, annotations: [...byId.values()] }, corpus);
  const output = serialize(combined);
  if (output === baseline) return;
  const pending = path.join(directory, `.enrichment-${randomUUID()}.pending`);
  let handle;
  try {
    await verify();
    handle = await fs.open(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await handle.writeFile(output, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await verify();
    if (baseline === null) {
      try { await fs.lstat(file); throw failure('PERSISTENCE'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    } else if (await readPrivateTemplate(file) !== baseline) throw failure('PERSISTENCE');
    await fs.rename(pending, file);
    await syncDirectory(directory);
  } finally {
    await handle?.close();
    await verify();
    await fs.unlink(pending).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

// Read-only projection for the loopback workbench; never changes the canonical corpus or sidecars.
export async function readEnrichmentSnapshot(store, corpus) {
  const verifyStore = await privateDirectory(store);
  const directory = path.join(store, 'enrichment');
  try { await fs.lstat(directory); }
  catch (error) { if (error.code === 'ENOENT') return { schemaVersion: ENRICHMENT_VERSION, annotations: [] }; throw error; }
  const verifyDirectory = await privateDirectory(directory);
  const document = await readDocument(path.join(directory, 'annotations.json'), corpus);
  await verifyDirectory(); await verifyStore();
  return document;
}

export async function runEnrichment({ command, store, inputFile, outputFile, caseId, sourceId, sourceRevisionId }) {
  let lock, verify, result;
  try {
    if (!['validate', 'import', 'export', 'template'].includes(command)) throw failure('INVALID_INPUT');
    verify = await privateDirectory(store);
    lock = await fs.open(path.join(store, '.intake.lock'),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      .catch(error => { throw failure(error.code === 'EEXIST' ? 'STORE_BUSY' : 'UNSAFE_PATH'); });
    await verify();
    const corpus = await validatePrivateCorpus(path.join(store, 'corpus.json'), { reviewAware: true });
    let document;
    if (command === 'validate' || command === 'import') {
      document = await readDocument(inputFile, corpus);
      if (command === 'import') await importDocument(path.join(store, 'enrichment'), document, corpus);
    } else if (command === 'template') {
      document = createEnrichmentTemplate({ corpus, caseId, sourceId, sourceRevisionId });
      await privateOutput(outputFile, document);
    } else {
      const directory = path.join(store, 'enrichment');
      await privateDirectory(directory);
      document = await readDocument(path.join(directory, 'annotations.json'), corpus);
      if (caseId !== undefined) {
        if (!corpus.cases.some(record => record.id === caseId)) throw failure('INVALID_ENRICHMENT');
        document.annotations = document.annotations.filter(item => item.caseId === caseId);
      }
      await privateOutput(outputFile, document);
    }
    result = { status: 'succeeded', command, annotationIds: document.annotations.map(item => item.id) };
  } catch (error) {
    result = { status: 'failed', code: error.code ?? 'INVALID_ENRICHMENT' };
  } finally {
    if (lock) {
      try {
        await lock.close();
        await verify();
        await fs.unlink(path.join(store, '.intake.lock'));
      } catch { result = { status: 'failed', code: 'PERSISTENCE' }; }
    }
  }
  return result;
}
