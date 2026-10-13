import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalSerialize, reviewBaseDigest, sha256, validateCorpus } from '../scripts/contract.mjs';
import { applyReview } from '../scripts/review.mjs';
import {
  ANNOTATION_TYPES, ENRICHMENT_LIMITS, ENRICHMENT_VERSION, createEnrichmentTemplate,
  enrichmentSchema, runEnrichment, validateEnrichment,
} from '../src/enrichment.mjs';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const fixture = async file => readJson(new URL(file, import.meta.url));
const makeStore = async corpus => {
  const root = new URL('../.private-intake/', import.meta.url).pathname;
  await mkdir(root, { mode: 0o700, recursive: true });
  const directory = await mkdtemp(path.join(root, 'extract-test-'));
  const corpusFile = path.join(directory, 'corpus.json');
  await writeFile(corpusFile, canonicalSerialize(corpus ?? await fixture('./fixtures/benign/core-only.json')), { mode: 0o600 });
  return { directory, corpusFile };
};
const writeTemplate = async (directory, template) => {
  const file = path.join(directory, 'template.json');
  await writeFile(file, typeof template === 'string' ? template : JSON.stringify(template), { mode: 0o600 });
  await chmod(file, 0o600);
  return file;
};
const invoke = (directory, template) => spawnSync(process.execPath, [
  new URL('../scripts/extract.mjs', import.meta.url).pathname,
  '--template', template, '--store', directory, '--supplied-by', 'synthetic-researcher',
], { encoding: 'utf8' });
const result = child => JSON.parse(child.stdout);

test('AC-01 manual CLI creates pending claims, passages, links, manifest, and safely deduplicates reruns', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const templateFile = await writeTemplate(directory, await fixture('./fixtures/extraction/manual.json'));

  const first = invoke(directory, templateFile);
  assert.equal(first.status, 0, first.stderr);
  const firstResult = result(first);
  assert.equal(firstResult.status, 'succeeded');
  assert.equal(firstResult.claimIds.length, 5);
  const stored = await readJson(corpusFile);
  assert.deepEqual(validateCorpus(stored), []);
  assert.ok(firstResult.claimIds.every(id => stored.claims.find(claim => claim.id === id)?.disposition === 'Pending'));
  assert.equal(stored.reviews.length, 0);
  const manifest = stored.collectionManifests.find(item => item.id === firstResult.manifestId);
  assert.equal(manifest.kind, 'extraction');
  assert.equal(manifest.outcome, 'Succeeded');
  const firstBytes = await readFile(corpusFile, 'utf8');

  const second = invoke(directory, templateFile);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(result(second).manifestId, firstResult.manifestId);
  assert.equal(await readFile(corpusFile, 'utf8'), firstBytes);
});

test('AC-02 code-point slices preserve emoji and NFC-composed text from the exact hashed revision', async t => {
  const base = await fixture('./fixtures/benign/core-only.json');
  const revision = base.sourceRevisions.find(item => item.id === 'synthetic-revision-a');
  revision.rawContent = '😀 Cafe\u0301\r\nA tool was used in a benign exercise.';
  revision.rawHash = sha256(revision.rawContent);
  const { directory, corpusFile } = await makeStore(base);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const templateFile = await writeTemplate(directory, await fixture('./fixtures/extraction/manual.json'));
  const child = invoke(directory, templateFile);
  assert.equal(child.status, 0, child.stderr);
  const corpus = await readJson(corpusFile);
  const normalizedRevision = corpus.sourceRevisions.find(item => item.id === 'synthetic-revision-a');
  const unicodePassage = corpus.passages.find(item => item.id === 'extracted-passage-c');
  assert.equal(normalizedRevision.rawContent, '😀 Cafe\u0301\r\nA tool was used in a benign exercise.');
  assert.equal(normalizedRevision.normalizedContent, '😀 Café\nA tool was used in a benign exercise.');
  assert.equal([...normalizedRevision.normalizedContent].slice(unicodePassage.start, unicodePassage.end).join(''), '😀 Café');
  assert.equal(unicodePassage.text, '😀 Café');
  assert.equal(corpus.claims.find(item => item.id === 'extracted-claim-a').sourceRevisionId, normalizedRevision.id);
});

for (const [name, mutate] of [
  ['wrong revision hash', template => { template.claims[0].revisionHash = '0'.repeat(64); }],
  ['unknown source', template => { template.claims[0].sourceId = 'missing-source'; }],
  ['unknown case', template => { template.claims[0].caseId = 'missing-case'; }],
  ['wrong source revision', template => { template.claims[0].sourceRevisionId = 'synthetic-revision-b'; }],
  ['fabricated passage text', template => { template.claims[0].passages[0].text = 'invented'; }],
  ['invalid passage offsets', template => { template.claims[0].passages[0].start = 100; }],
  ['nonreciprocal conflict', template => { template.claims[1].conflictsWith = []; }],
  ['self conflict', template => { template.claims[0].conflictsWith = ['extracted-claim-a']; }],
  ['dangling conflict', template => { template.claims[0].conflictsWith = ['missing-claim']; }],
  ['dangling inference support', template => { template.claims[3].inference.supportingClaimIds = ['missing-claim']; }],
  ['cyclic inference support', template => { template.claims[3].inference.supportingClaimIds = ['extracted-inference']; }],
  ['inference with passage evidence', template => { template.claims[3].passages = [{ id: 'inference-passage', locator: 'line 1', start: 0, end: 1, text: '😀' }]; }],
]) {
  test(`AC-02/05/06 invalid ${name} fails without modifying corpus`, async t => {
    const { directory, corpusFile } = await makeStore();
    t.after(() => rm(directory, { recursive: true, force: true }));
    const original = await readFile(corpusFile, 'utf8');
    const template = await fixture('./fixtures/extraction/manual.json');
    mutate(template);
    const child = invoke(directory, await writeTemplate(directory, template));
    assert.notEqual(child.status, 0);
    assert.equal(result(child).status, 'failed');
    assert.equal(await readFile(corpusFile, 'utf8'), original);
  });
}

test('AC-04/05/06 one source may support claims in multiple cases; inferences and contradictions stay distinct', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await readJson(corpusFile);
  base.cases.find(item => item.id === 'synthetic-case-b').sourceIds = ['synthetic-source-a'];
  await writeFile(corpusFile, canonicalSerialize(base), { mode: 0o600 });
  const templateFile = await writeTemplate(directory, await fixture('./fixtures/extraction/manual.json'));
  const child = invoke(directory, templateFile);
  assert.equal(child.status, 0, child.stderr);
  const corpus = await readJson(corpusFile);
  const inferred = corpus.claims.find(item => item.id === 'extracted-inference');
  assert.equal(inferred.evidenceStatus, 'Researcher inference');
  assert.equal(inferred.disposition, 'Pending');
  assert.equal(inferred.inference.rationale, 'The separately recorded statements conflict; no attribution is inferred.');
  assert.deepEqual(inferred.inference.supportingClaimIds, ['synthetic-claim-a', 'synthetic-claim-b']);
  assert.deepEqual(corpus.claims.find(item => item.id === 'extracted-claim-a').conflictsWith, ['extracted-claim-b']);
  assert.deepEqual(corpus.claims.find(item => item.id === 'extracted-claim-b').conflictsWith, ['extracted-claim-a']);
  assert.equal(corpus.claims.find(item => item.id === 'extracted-claim-a').caseId, 'synthetic-case-a');
  assert.equal(corpus.claims.find(item => item.id === 'extracted-claim-other-case').caseId, 'synthetic-case-b');
  assert.deepEqual(corpus.cases.find(item => item.id === 'synthetic-case-b').sourceIds, ['synthetic-source-a', 'synthetic-source-b']);
});

test('AC-01 malformed template and invalid CLI arguments return explicit failure outcomes', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const templateFile = await writeTemplate(directory, '{');
  const badJson = invoke(directory, templateFile);
  assert.notEqual(badJson.status, 0);
  assert.deepEqual(result(badJson), { status: 'failed', code: 'INVALID_EXTRACTION' });
  const badArgs = spawnSync(process.execPath, ['scripts/extract.mjs', '--store', directory], { encoding: 'utf8' });
  assert.notEqual(badArgs.status, 0);
  assert.deepEqual(result(badArgs), { status: 'failed', code: 'INVALID_INPUT' });
  assert.equal((await readJson(corpusFile)).claims.length, 4);
});

test('AC-01 conflicting reuse of an existing claim ID fails rather than replacing records', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = await fixture('./fixtures/extraction/manual.json');
  const templateFile = await writeTemplate(directory, template);
  assert.equal(invoke(directory, templateFile).status, 0);
  const firstBytes = await readFile(corpusFile, 'utf8');
  template.claims[0].description += ' Edited';
  const changed = invoke(directory, await writeTemplate(directory, template));
  assert.notEqual(changed.status, 0);
  assert.equal(result(changed).status, 'failed');
  assert.equal(await readFile(corpusFile, 'utf8'), firstBytes);
});

const enrichmentTemplate = corpus => createEnrichmentTemplate({
  corpus, caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a', sourceRevisionId: 'synthetic-revision-a',
});
const enrichmentInvoke = (command, directory, args = []) => spawnSync(process.execPath, [
  new URL('../scripts/extract.mjs', import.meta.url).pathname, 'enrichment', command, '--store', directory, ...args,
], { encoding: 'utf8' });

test('issue39 AC-06 enrichment preserves the core colon and long reference ID contract', async t => {
  const caseId = `case:${'x'.repeat(140)}`, sourceId = 'source:article', sourceRevisionId = 'revision:article';
  let input = JSON.stringify(await fixture('./fixtures/benign/core-only.json'));
  for (const [oldId, newId] of [['synthetic-case-a', caseId], ['synthetic-source-a', sourceId], ['synthetic-revision-a', sourceRevisionId]]) {
    input = input.replaceAll(JSON.stringify(oldId), JSON.stringify(newId));
  }
  const corpus = JSON.parse(input);
  assert.deepEqual(validateCorpus(corpus), []);
  const { directory, corpusFile } = await makeStore(corpus);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const before = await readFile(corpusFile, 'utf8');
  const template = createEnrichmentTemplate({ corpus, caseId, sourceId, sourceRevisionId });
  const child = enrichmentInvoke('import', directory, ['--input', await writeTemplate(directory, template)]);
  assert.equal(child.status, 0, child.stdout);
  assert.equal(await readFile(corpusFile, 'utf8'), before);
});

test('issue39 AC-06 enrichment template, validation, import, and export retain all eight pending types privately', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corpusBefore = await readFile(corpusFile, 'utf8');
  const templateFile = path.join(directory, 'enrichment-template.json');
  const generated = enrichmentInvoke('template', directory, [
    '--case', 'synthetic-case-a', '--source', 'synthetic-source-a', '--revision', 'synthetic-revision-a', '--output', templateFile,
  ]);
  assert.equal(generated.status, 0, generated.stdout);
  const template = await readJson(templateFile);
  assert.equal(template.schemaVersion, ENRICHMENT_VERSION);
  assert.deepEqual(template.annotations.map(item => item.type), ANNOTATION_TYPES);
  assert.equal(enrichmentSchema.additionalProperties, false);
  assert.deepEqual(validateEnrichment(template, await readJson(corpusFile)), []);
  for (const command of ['validate', 'import']) {
    const child = enrichmentInvoke(command, directory, ['--input', templateFile]);
    assert.equal(child.status, 0, child.stdout);
    assert.equal(result(child).annotationIds.length, 8);
    assert.equal(child.stdout.includes('Replace this'), false, 'CLI must not publish private annotation values');
  }
  const sidecarFile = path.join(directory, 'enrichment', 'annotations.json');
  const firstBytes = await readFile(sidecarFile, 'utf8');
  const firstStat = await stat(sidecarFile);
  assert.equal(firstStat.mode & 0o777, 0o600);
  assert.equal((await stat(path.dirname(sidecarFile))).mode & 0o777, 0o700);
  assert.equal(firstStat.nlink, 1);
  assert.equal(enrichmentInvoke('import', directory, ['--input', templateFile]).status, 0);
  assert.equal(await readFile(sidecarFile, 'utf8'), firstBytes);
  assert.equal((await stat(sidecarFile)).ino, firstStat.ino, 'identical imports must not rewrite the sidecar');
  const output = path.join(directory, 'export.json');
  assert.equal(enrichmentInvoke('export', directory, ['--output', output, '--case', 'synthetic-case-a']).status, 0);
  assert.equal(await readFile(output, 'utf8'), firstBytes);
  const exported = await readJson(output);
  assert.ok(exported.annotations.every(item => item.status === 'pending' && item.evidenceStatus === 'inference'));
  assert.equal(enrichmentInvoke('import', directory, ['--input', output]).status, 0);
  assert.equal(await readFile(corpusFile, 'utf8'), corpusBefore, 'enrichment must not mutate canonical claims or reviews');
  const repository = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  // Verification removes KEY variables; discard incomplete inherited Git configuration.
  const gitEnvironment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/.test(key)));
  const ignored = spawnSync('git', ['check-ignore', sidecarFile, templateFile, output], {
    encoding: 'utf8', cwd: repository, env: gitEnvironment,
  });
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.equal(ignored.stdout.trim().split('\n').length, 3);
});

test('issue39 AC-06 all types resolve exact Unicode quotes, with code-point half-open locators and separate contexts', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = enrichmentTemplate(await readJson(corpusFile));
  for (const item of template.annotations) {
    item.evidenceStatus = 'evidence-backed';
    item.support = { quote: '😀 Café' };
    item.value = '😀 Café';
  }
  template.annotations[0].context.roles = ['victim-side-environment', 'attacker-side-ai-use', 'ai-review-targeting'];
  template.annotations[1].context.behavior = 'demonstrated';
  template.annotations[2].context = { collection: 'article-mentioned', dataSources: ['agent-ide', 'github-actions', 'dns'] };
  template.annotations[3].context = { artifactKind: 'prompt-instruction' };
  template.annotations[3].normalizedValue = 'Additional normalized value; exact value is unchanged';
  template.annotations[4].context = { indicatorKind: 'configuration' };
  template.annotations[5].context = { mapping: 'source-mentioned', framework: 'Example framework', frameworkVersion: '1' };
  template.annotations[6].context.detection = 'published-reference';
  template.annotations[6].externalReferenceUrl = 'https://example.invalid/public-rule';
  template.annotations[7].support = { locator: { start: 0, end: 6 } };
  const file = await writeTemplate(directory, template);
  const imported = await runEnrichment({ command: 'import', store: directory, inputFile: file });
  assert.equal(imported.status, 'succeeded', JSON.stringify(imported));
  const stored = await readJson(path.join(directory, 'enrichment', 'annotations.json'));
  for (const item of stored.annotations) {
    assert.deepEqual(item.support, { quote: '😀 Café', locator: { start: 0, end: 6 } });
    assert.equal(item.value, '😀 Café');
    assert.equal(item.status, 'pending');
  }
  assert.deepEqual(stored.annotations.find(item => item.type === 'role-context').context.roles, template.annotations[0].context.roles);
});

test('issue39 AC-06 reference-scoped template IDs accumulate more than 20 annotations across campaigns and articles', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corpus = await readJson(corpusFile);
  const original = await readFile(corpusFile, 'utf8');
  const templates = [
    enrichmentTemplate(corpus),
    createEnrichmentTemplate({ corpus, caseId: 'synthetic-case-b', sourceId: 'synthetic-source-a', sourceRevisionId: 'synthetic-revision-a' }),
    createEnrichmentTemplate({ corpus, caseId: 'synthetic-case-a', sourceId: 'synthetic-source-b', sourceRevisionId: 'synthetic-revision-b' }),
  ];
  assert.deepEqual(enrichmentTemplate(corpus), templates[0], 'identical references produce deterministic IDs');
  assert.equal(new Set(templates.flatMap(template => template.annotations.map(item => item.id))).size, 24);
  for (const template of templates) {
    const imported = await runEnrichment({ command: 'import', store: directory, inputFile: await writeTemplate(directory, template) });
    assert.equal(imported.status, 'succeeded', JSON.stringify(imported));
  }
  const sidecar = path.join(directory, 'enrichment', 'annotations.json');
  const stored = await readJson(sidecar);
  assert.equal(stored.annotations.length, 24);
  assert.equal((await runEnrichment({ command: 'import', store: directory, inputFile: await writeTemplate(directory, templates[0]) })).status, 'succeeded');
  assert.equal((await readJson(sidecar)).annotations.length, 24);
  assert.equal(await readFile(corpusFile, 'utf8'), original);
});

test('issue39 AC-06 repeated or missing quotes stay explicitly unresolved; locators disambiguate repeated Unicode', async t => {
  const corpus = await fixture('./fixtures/benign/core-only.json');
  const revision = corpus.sourceRevisions[0];
  revision.rawContent += '\n😀 Café';
  revision.normalizedContent += '\n😀 Café';
  revision.rawHash = sha256(revision.rawContent);
  revision.normalizedHash = sha256(revision.normalizedContent);
  const { directory, corpusFile } = await makeStore(corpus);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = enrichmentTemplate(corpus);
  const item = template.annotations.find(item => item.type === 'commands-ai-artifacts');
  item.support = { quote: '😀 Café' };
  item.evidenceStatus = 'evidence-backed';
  assert.ok(validateEnrichment(template, corpus).some(message => message.includes('uniquely')));
  item.evidenceStatus = 'unresolved';
  assert.deepEqual(validateEnrichment(template, corpus), []);
  assert.equal((await runEnrichment({ command: 'import', store: directory, inputFile: await writeTemplate(directory, template) })).status, 'succeeded');
  const unresolved = await readJson(path.join(directory, 'enrichment', 'annotations.json'));
  assert.deepEqual(unresolved.annotations.find(record => record.id === item.id).support, { quote: '😀 Café' });
  item.support.quote = 'not present';
  assert.deepEqual(validateEnrichment(template, corpus), []);
  item.evidenceStatus = 'inference';
  assert.ok(validateEnrichment(template, corpus).length);
  item.evidenceStatus = 'evidence-backed';
  const start = [...revision.normalizedContent].length - 6;
  item.support = { quote: '😀 Café', locator: { start, end: start + 6 } };
  assert.deepEqual(validateEnrichment(template, corpus), []);
  assert.deepEqual(validateEnrichment({ ...template, annotations: [{ ...item, support: { quote: 'Café', locator: { start, end: start + 6 } } }] }, corpus)
    .some(message => message.includes('differs')), true);
  assert.equal((await readJson(corpusFile)).reviews.length, 0);
});

for (const [name, mutate] of [
  ['unknown case', item => { item.caseId = 'missing'; }],
  ['unknown source', item => { item.sourceId = 'missing'; }],
  ['wrong revision source', item => { item.sourceRevisionId = 'synthetic-revision-b'; }],
  ['unlinked case source', item => { item.caseId = 'synthetic-case-b'; item.sourceId = 'synthetic-source-b'; item.sourceRevisionId = 'synthetic-revision-b'; }],
  ['unknown annotation type', item => { item.type = 'unexpected'; }],
  ['unknown core review field', item => { item.disposition = 'Accepted'; }],
  ['untrusted accepted status', item => { item.status = 'accepted'; }],
  ['agent without versions', item => { item.origin = 'agent'; }],
  ['agent without model version', item => { item.origin = 'agent'; item.promptVersion = 'prompt/1'; }],
  ['agent with empty prompt version', item => { item.origin = 'agent'; item.modelVersion = 'model/1'; item.promptVersion = ''; }],
  ['unsupported evidence-backed assertion', item => { item.evidenceStatus = 'evidence-backed'; }],
  ['mismatched locator text', item => { item.support = { quote: 'invented', locator: { start: 0, end: 6 } }; }],
  ['out of range locator', item => { item.support = { locator: { start: 0, end: 1000 } }; }],
  ['empty locator', item => { item.support = { locator: { start: 2, end: 2 } }; }],
  ['file external reference', item => { item.externalReferenceUrl = 'file:///article'; }],
  ['credentialed external reference', item => { item.externalReferenceUrl = '******example.invalid/'; }],
  ['fabricated date field', item => { item.publicationDate = '2026-10-13'; }],
]) {
  test(`issue39 AC-06 enrichment rejects ${name} without corpus or sidecar mutation`, async t => {
    const { directory, corpusFile } = await makeStore();
    t.after(() => rm(directory, { recursive: true, force: true }));
    const original = await readFile(corpusFile, 'utf8');
    const template = enrichmentTemplate(await readJson(corpusFile));
    mutate(template.annotations[0]);
    const child = enrichmentInvoke('import', directory, ['--input', await writeTemplate(directory, template)]);
    assert.notEqual(child.status, 0);
    assert.equal(result(child).code, 'INVALID_ENRICHMENT');
    assert.equal(await readFile(corpusFile, 'utf8'), original);
    await assert.rejects(stat(path.join(directory, 'enrichment', 'annotations.json')), { code: 'ENOENT' });
  });
}

test('issue39 AC-06 agent annotations retain model/prompt attribution and never alter existing human reviews', async t => {
  const corpus = await fixture('./fixtures/benign/core-only.json');
  applyReview(corpus, {
    schemaVersion: 'manual-review/1', claimId: 'synthetic-claim-a', action: 'accept',
    baseDigest: reviewBaseDigest(corpus), rationale: 'Synthetic human decision for enrichment isolation testing.',
  }, 'synthetic-reviewer');
  const { directory, corpusFile } = await makeStore(corpus);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = await readFile(corpusFile, 'utf8');
  const template = enrichmentTemplate(corpus);
  for (const item of template.annotations) Object.assign(item, { origin: 'agent', modelVersion: 'synthetic-model/1', promptVersion: 'synthetic-prompt/1' });
  const file = await writeTemplate(directory, template);
  assert.equal(enrichmentInvoke('import', directory, ['--input', file]).status, 0);
  assert.equal(enrichmentInvoke('export', directory, ['--output', path.join(directory, 'export.json')]).status, 0);
  assert.equal(await readFile(corpusFile, 'utf8'), original);
  const stored = await readJson(path.join(directory, 'enrichment', 'annotations.json'));
  assert.ok(stored.annotations.every(item => item.origin === 'agent' && item.modelVersion === 'synthetic-model/1'
    && item.promptVersion === 'synthetic-prompt/1' && item.status === 'pending'));
});

test('issue39 AC-06 conflicting annotation ID imports fail atomically', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = enrichmentTemplate(await readJson(corpusFile));
  const file = await writeTemplate(directory, template);
  assert.equal(enrichmentInvoke('import', directory, ['--input', file]).status, 0);
  const sidecar = path.join(directory, 'enrichment', 'annotations.json');
  const original = await readFile(sidecar, 'utf8');
  template.annotations[0].value = 'Changed annotation must use a new ID.';
  const child = enrichmentInvoke('import', directory, ['--input', await writeTemplate(directory, template)]);
  assert.equal(result(child).code, 'ANNOTATION_COLLISION');
  assert.equal(await readFile(sidecar, 'utf8'), original);
});

test('issue39 AC-06 missing revision links, unavailable evidence, duplicate IDs, and inferred classifications fail closed', async () => {
  const corpus = await fixture('./fixtures/benign/core-only.json');
  const template = enrichmentTemplate(corpus);
  const item = template.annotations.find(record => record.type === 'commands-ai-artifacts');
  item.evidenceStatus = 'evidence-backed';
  item.support = { quote: '😀 Café' };
  const unlinked = structuredClone(corpus);
  unlinked.sources[0].revisionIds = [];
  assert.ok(validateEnrichment(template, unlinked).some(message => message.includes('unlinked')));
  const unretained = structuredClone(corpus);
  unretained.sourceRevisions[0].normalizedContent = null;
  assert.ok(validateEnrichment(template, unretained).some(message => message.includes('retained')));
  item.evidenceStatus = 'unresolved';
  assert.deepEqual(validateEnrichment(template, unretained), []);
  item.support.quote = '\ud83d';
  item.evidenceStatus = 'evidence-backed';
  assert.ok(validateEnrichment(template, corpus).length, 'a surrogate fragment cannot stand in for a Unicode code point');
  template.annotations.push(structuredClone(template.annotations[0]));
  assert.ok(validateEnrichment(template, corpus).some(message => message.includes('duplicate ID')));
  template.annotations.pop();
  item.evidenceStatus = 'inference';
  delete item.support;
  for (const type of ['observed-behavior', 'data-sources', 'ttp-references', 'detection-references']) {
    const proposed = template.annotations.find(record => record.type === type);
    proposed.evidenceStatus = 'evidence-backed';
    proposed.support = { quote: '😀 Café' };
    assert.ok(validateEnrichment(template, corpus).length, `${type} proposals cannot become evidence-backed`);
    proposed.evidenceStatus = 'inference';
  }
});

test('issue39 AC-06 tampered sidecar status and busy intake locks do not publish or alter private records', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = await writeTemplate(directory, enrichmentTemplate(await readJson(corpusFile)));
  const original = await readFile(corpusFile, 'utf8');
  await writeFile(path.join(directory, '.intake.lock'), '', { mode: 0o600 });
  assert.equal((await runEnrichment({ command: 'import', store: directory, inputFile: file })).code, 'STORE_BUSY');
  await rm(path.join(directory, '.intake.lock'));
  assert.equal(enrichmentInvoke('import', directory, ['--input', file]).status, 0);
  const sidecar = path.join(directory, 'enrichment', 'annotations.json');
  const tampered = await readJson(sidecar);
  tampered.annotations[0].status = 'accepted';
  await writeFile(sidecar, JSON.stringify(tampered), { mode: 0o600 });
  const output = path.join(directory, 'out.json');
  assert.equal((await runEnrichment({ command: 'export', store: directory, outputFile: output })).code, 'INVALID_ENRICHMENT');
  await assert.rejects(stat(output), { code: 'ENOENT' });
  assert.equal(await readFile(corpusFile, 'utf8'), original);
});

test('issue39 AC-06 strict annotation and byte limits and CLI argument validation', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const corpus = await readJson(corpusFile);
  const template = enrichmentTemplate(corpus);
  template.annotations = Array.from({ length: ENRICHMENT_LIMITS.annotations + 1 }, (_, index) => ({ ...template.annotations[0], id: `annotation-${index}` }));
  assert.ok(validateEnrichment(template, corpus).some(message => message.includes('too many')));
  const tooLarge = await writeTemplate(directory, ' '.repeat(ENRICHMENT_LIMITS.bytes + 1));
  assert.equal(result(enrichmentInvoke('import', directory, ['--input', tooLarge])).code, 'TOO_LARGE');
  const malformed = await writeTemplate(directory, '{');
  assert.equal(result(enrichmentInvoke('validate', directory, ['--input', malformed])).code, 'INVALID_ENRICHMENT');
  for (const [command, args] of [
    ['unknown', []], ['import', []], ['validate', ['--input', malformed, '--input', malformed]],
    ['export', ['--output', path.join(directory, 'out.json'), '--unknown', 'x']],
    ['template', ['--output', path.join(directory, 'out.json')]], ['validate', ['--input']],
  ]) {
    assert.equal(result(enrichmentInvoke(command, directory, args)).code, 'INVALID_INPUT');
  }
});

test('issue39 AC-06 private path boundaries reject public files, links, unsafe output, and symlinked enrichment', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const template = enrichmentTemplate(await readJson(corpusFile));
  const file = await writeTemplate(directory, template);
  const runImport = inputFile => runEnrichment({ command: 'import', store: directory, inputFile });
  await chmod(file, 0o644);
  assert.equal((await runImport(file)).code, 'UNSAFE_PATH');
  await chmod(file, 0o600);
  const linked = path.join(directory, 'linked.json');
  await link(file, linked);
  assert.equal((await runImport(file)).code, 'UNSAFE_PATH');
  await rm(linked);
  await symlink(file, linked);
  assert.equal((await runImport(linked)).code, 'UNSAFE_PATH');
  await rm(linked);
  const linkedDirectory = path.join(directory, 'linked-directory');
  await symlink(directory, linkedDirectory);
  assert.equal((await runImport(path.join(linkedDirectory, 'template.json'))).code, 'UNSAFE_PATH');
  await rm(linkedDirectory);
  await symlink(directory, path.join(directory, 'enrichment'));
  assert.equal((await runImport(file)).code, 'UNSAFE_PATH');
  await rm(path.join(directory, 'enrichment'));
  assert.equal((await runImport(file)).status, 'succeeded');
  const exportArgs = { command: 'export', store: directory };
  assert.equal((await runEnrichment({ ...exportArgs, outputFile: corpusFile })).status, 'failed', 'exports cannot overwrite canonical corpus');
  assert.equal((await runEnrichment({ ...exportArgs, outputFile: 'relative.json' })).code, 'UNSAFE_PATH');
  assert.equal((await runEnrichment({ ...exportArgs, outputFile: path.resolve('enrichment-leak.json') })).code, 'UNSAFE_PATH');
  const publicDirectory = path.join(directory, 'public');
  await mkdir(publicDirectory, { mode: 0o755 });
  assert.equal((await runEnrichment({ ...exportArgs, outputFile: path.join(publicDirectory, 'out.json') })).code, 'UNSAFE_PATH');
  const sidecar = path.join(directory, 'enrichment', 'annotations.json');
  await link(sidecar, linked);
  assert.equal((await runEnrichment({ ...exportArgs, outputFile: path.join(directory, 'out.json') })).code, 'UNSAFE_PATH');
  await rm(linked);
  await chmod(path.join(directory, 'enrichment'), 0o755);
  assert.equal((await runImport(file)).code, 'UNSAFE_PATH');
  await chmod(path.join(directory, 'enrichment'), 0o700);
  await chmod(directory, 0o755);
  assert.equal((await runImport(file)).code, 'UNSAFE_PATH');
  await chmod(directory, 0o700);
});
