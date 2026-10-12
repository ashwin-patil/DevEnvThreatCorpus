import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalSerialize, validateCorpus } from '../scripts/contract.mjs';

const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const fixture = async file => readJson(new URL(file, import.meta.url));
const makeStore = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dev-threat-extract-'));
  const corpusFile = path.join(directory, 'corpus.json');
  await writeFile(corpusFile, canonicalSerialize(await fixture('./fixtures/benign/core-only.json')), { mode: 0o600 });
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
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const templateFile = await writeTemplate(directory, await fixture('./fixtures/extraction/manual.json'));
  const child = invoke(directory, templateFile);
  assert.equal(child.status, 0, child.stderr);
  const corpus = await readJson(corpusFile);
  const revision = corpus.sourceRevisions.find(item => item.id === 'synthetic-revision-a');
  const unicodePassage = corpus.passages.find(item => item.id === 'extracted-passage-c');
  assert.equal(revision.normalizedContent, '😀 Café\nA tool was used in a benign exercise.');
  assert.equal([...revision.normalizedContent].slice(unicodePassage.start, unicodePassage.end).join(''), '😀 Café');
  assert.equal(unicodePassage.text, '😀 Café');
  assert.equal(corpus.claims.find(item => item.id === 'extracted-claim-a').sourceRevisionId, revision.id);
});

for (const [name, mutate] of [
  ['wrong revision hash', template => { template.claims[0].revisionHash = '0'.repeat(64); }],
  ['wrong source revision', template => { template.claims[0].sourceRevisionId = 'synthetic-revision-b'; }],
  ['fabricated passage text', template => { template.claims[0].passages[0].text = 'invented'; }],
  ['invalid passage offsets', template => { template.claims[0].passages[0].start = 100; }],
  ['nonreciprocal conflict', template => { template.claims[1].conflictsWith = []; }],
  ['dangling inference support', template => { template.claims[3].inference.supportingClaimIds = ['missing-claim']; }],
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
});

test('AC-01 malformed template and invalid CLI arguments return explicit failure outcomes', async t => {
  const { directory, corpusFile } = await makeStore();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const templateFile = await writeTemplate(directory, '{');
  const badJson = invoke(directory, templateFile);
  assert.notEqual(badJson.status, 0);
  assert.deepEqual(result(badJson), { status: 'failed', code: 'INVALID_EXTRACTION' });
  const badArgs = spawnSync(process.execPath, [new URL('../scripts/extract.mjs', import.meta.url).pathname, '--store', directory], { encoding: 'utf8' });
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
