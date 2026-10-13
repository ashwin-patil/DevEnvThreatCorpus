import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertAppendOnlyReviews, assertValid, canonicalSerialize, dependencyHashes, entityContentHash,
  reviewBaseDigest, reviewEligibleCorpus, validateCorpus, updatePrivateCorpus,
} from '../scripts/contract.mjs';
import { applyReview } from '../scripts/review.mjs';

const root = new URL('../', import.meta.url).pathname;
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const fixture = () => readJson(new URL('./fixtures/benign/core-only.json', import.meta.url));
const invoke = args => {
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/review.mjs'), ...args], { encoding: 'utf8' });
  assert.equal(child.error, undefined);
  return { exit: child.status, ...JSON.parse(child.stdout) };
};
const setup = async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dev-threat-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'corpus.json');
  const template = path.join(directory, 'decision.json');
  await writeFile(file, canonicalSerialize(await fixture()), { mode: 0o600 });
  const decision = await readJson(new URL('./fixtures/review/accept.json', import.meta.url));
  decision.baseDigest = reviewBaseDigest(await readJson(file));
  const decide = async (input = decision, reviewer = 'synthetic-human-reviewer') => {
    await writeFile(template, JSON.stringify(input), { mode: 0o600 });
    return invoke(['decide', '--template', template, '--store', directory, '--reviewer', reviewer]);
  };
  return { directory, file, template, decision, decide };
};

for (const [action, disposition] of [['accept', 'Accepted'], ['correct', 'Needs correction'], ['exclude', 'Excluded']]) {
  test(`AC-01/02/04 ${action} CLI records explicit decision and preserves independent status axes`, async t => {
    const { file, decision, decide } = await setup(t);
    const before = await readJson(file);
    before.claims[0].origin = 'LLM source paraphrase';
    before.cases[0].collectionState = 'Reviewed';
    await writeFile(file, canonicalSerialize(before));
    decision.baseDigest = reviewBaseDigest(before);
    decision.action = action;
    if (action === 'correct') decision.correction = { description: 'Corrected synthetic proposal; no attribution change.' };
    const started = Date.now();
    const result = await decide();
    assert.equal(result.exit, 0, JSON.stringify(result));
    const corpus = await readJson(file), claim = corpus.claims[0], event = corpus.reviews[0];
    assertValid(corpus);
    assert.equal(claim.disposition, disposition);
    assert.equal(claim.origin, 'LLM source paraphrase');
    assert.equal(claim.evidenceStatus, before.claims[0].evidenceStatus);
    assert.deepEqual(corpus.sources, before.sources);
    assert.deepEqual(corpus.cases, before.cases);
    assert.equal(corpus.cases[0].disposition, 'Pending');
    assert.deepEqual(claim.history, [event.id]);
    assert.equal(event.entityType, 'claims');
    assert.equal(event.entityId, claim.id);
    assert.equal(event.revision, claim.revision);
    assert.equal(event.reviewer, 'synthetic-human-reviewer');
    assert.equal(event.reviewerKind, 'human');
    assert.equal(event.rationale, decision.rationale);
    assert.ok(Date.parse(event.timestamp) >= started && Date.parse(event.timestamp) <= Date.now());
    assert.equal(event.baseDigest, decision.baseDigest);
    assert.equal(event.contentHash, entityContentHash(claim));
    assert.deepEqual(event.dependencyHashes, dependencyHashes(corpus, 'claims', claim.id));
    for (const key of ['sources:synthetic-source-a', 'sourceRevisions:synthetic-revision-a', 'passages:synthetic-passage-a', 'caseScope:synthetic-case-a']) {
      assert.match(event.dependencyHashes[key], /^[a-f0-9]{64}$/);
    }
    const status = invoke(['status', '--file', file]);
    assert.equal(status.exit, 0);
    assert.equal(status.claims[0].eligibleAccepted, action === 'accept');
  });
}

for (const [name, mutate, code = 'INVALID_REVIEW'] of [
  ['unknown claim', d => { d.claimId = 'missing'; }, 'UNKNOWN_CLAIM'],
  ['stale base', d => { d.baseDigest = 'f'.repeat(64); }, 'STALE_BASE'],
  ['bad base', d => { d.baseDigest = 'bad'; }],
  ['unknown action', d => { d.action = 'approve'; }],
  ['array accept action', d => { d.action = ['accept']; }],
  ['array correct action', d => { d.action = ['correct']; }],
  ['array exclude action', d => { d.action = ['exclude']; }],
  ['forged reviewer kind', d => { d.reviewerKind = 'human'; }],
  ['blank rationale', d => { d.rationale = ' \n '; }],
  ['missing rationale', d => { delete d.rationale; }],
  ['bad version', d => { d.schemaVersion = '0.3.0'; }],
  ['accept with correction', d => { d.correction = { description: 'No implicit correction/acceptance.' }; }],
  ['exclude with correction', d => { d.action = 'exclude'; d.correction = { description: 'Not permitted.' }; }],
  ['empty correction', d => { d.action = 'correct'; d.correction = {}; }],
  ['missing correction', d => { d.action = 'correct'; }],
  ['no-op correction', d => { d.action = 'correct'; d.correction = { description: 'The synthetic source includes the word Café.' }; }],
  ['invalid correction shape', d => { d.action = 'correct'; d.correction = { description: null }; }],
  ['attribution change', d => { d.action = 'correct'; d.correction = { caseId: 'synthetic-case-b' }; }],
  ['source change', d => { d.action = 'correct'; d.correction = { sourceId: 'synthetic-source-b' }; }],
  ['revision attribution change', d => { d.action = 'correct'; d.correction = { sourceRevisionId: 'synthetic-revision-b' }; }],
  ['origin change', d => { d.action = 'correct'; d.correction = { origin: 'Human authored' }; }],
  ['history rewrite', d => { d.action = 'correct'; d.correction = { history: [] }; }],
  ['conflict rewrite', d => { d.action = 'correct'; d.correction = { conflictsWith: [] }; }],
  ['ungrounded correction', d => { d.action = 'correct'; d.correction = { passageIds: [] }; }],
  ['unknown passage correction', d => { d.action = 'correct'; d.correction = { passageIds: ['missing'] }; }],
  ['wrong revision passages', d => { d.action = 'correct'; d.correction = { passageIds: ['synthetic-passage-b'] }; }],
  ['inference inconsistency', d => { d.action = 'correct'; d.correction = { evidenceStatus: 'Researcher inference' }; }],
  ['invalid null reasons', d => { d.action = 'correct'; d.correction = { uncertainty: null, nullReasons: {} }; }],
  ['unsupported inference acceptance', d => { d.claimId = 'synthetic-claim-inference'; }],
]) {
  test(`AC-01 invalid ${name} fails without modifying canonical corpus`, async t => {
    const { file, decision, decide } = await setup(t);
    const bytes = await readFile(file, 'utf8');
    mutate(decision);
    const result = await decide();
    assert.equal(result.exit, 1, JSON.stringify(result));
    assert.equal(result.code, code);
    assert.equal(await readFile(file, 'utf8'), bytes);
  });
}

test('AC-01 malformed JSON, invalid CLI and reviewer identity fail explicitly', async t => {
  const { directory, file, template, decision, decide } = await setup(t);
  const before = await readFile(file, 'utf8');
  await writeFile(template, '{', { mode: 0o600 });
  assert.equal(invoke(['decide', '--template', template, '--store', directory, '--reviewer', 'human']).code, 'INVALID_REVIEW');
  for (const args of [
    [], ['status', '--store', directory], ['validate', '--file', file, '--extra', 'yes'],
    ['status', '--file', file, '--file', file], ['decide', '--store', directory],
    ['decide', '--template', template, '--store', directory, '--reviewer'],
  ]) assert.equal(invoke(args).code, 'INVALID_INPUT');
  for (const reviewer of [' ', 'agent/name', '']) assert.equal((await decide(decision, reviewer)).exit, 1);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('AC-02 correction and subsequent acceptance append decisions without implicit approval or audit loss', async t => {
  const { file, decision, decide } = await setup(t);
  assert.equal((await decide()).exit, 0);
  const accepted = await readJson(file);
  decision.action = 'correct';
  decision.correction = { description: 'A corrected synthetic description.' };
  assert.equal((await decide()).exit, 0);
  const corrected = await readJson(file);
  assert.equal(corrected.claims[0].disposition, 'Needs correction');
  assert.notEqual(corrected.claims[0].revision, accepted.claims[0].revision);
  assertAppendOnlyReviews(accepted.reviews, corrected.reviews);
  assert.deepEqual(corrected.claims[0].history.slice(0, 1), accepted.claims[0].history);
  assert.equal(corrected.reviews.length, 2);
  decision.action = 'accept';
  delete decision.correction;
  assert.equal((await decide()).code, 'STALE_BASE');
  decision.baseDigest = reviewBaseDigest(corrected);
  assert.equal((await decide()).exit, 0);
  const final = await readJson(file);
  assertAppendOnlyReviews(corrected.reviews, final.reviews);
  assert.equal(final.reviews.length, 3);
  assert.equal(final.claims[0].history.length, 3);
  assert.equal(final.claims[0].disposition, 'Accepted');
  assert.equal(final.claims[0].origin, accepted.claims[0].origin);
});

for (const [name, mutate] of [
  ['claim content', c => { c.claims[0].description += ' Changed'; }],
  ['claim revision', c => { c.claims[0].revision = 'r2'; }],
  ['cited revision', c => { c.sourceRevisions[0].parserVersion += '/changed'; }],
  ['source metadata', c => { c.sources[0].title += ' Changed'; }],
  ['passage locator', c => { c.passages[0].locator += ' Changed'; }],
  ['case scope', c => { c.cases[0].limits += ' Changed'; }],
  ['unrelated base content', c => { c.name += ' Changed'; }],
  ['new linked source revision', c => {
    const revision = structuredClone(c.sourceRevisions[0]);
    revision.id = 'synthetic-revision-a-new';
    revision.parserVersion += '/new';
    c.sourceRevisions.push(revision);
    c.sources[0].revisionIds.push(revision.id);
  }],
]) {
  test(`AC-03 changed ${name} is pending in read-only status/validation and can be explicitly re-reviewed`, async t => {
    const { file, decision, decide } = await setup(t);
    assert.equal((await decide()).exit, 0);
    const corpus = await readJson(file), priorEvents = structuredClone(corpus.reviews);
    mutate(corpus);
    await writeFile(file, canonicalSerialize(corpus));
    const bytes = await readFile(file, 'utf8');
    assert.ok(validateCorpus(corpus).some(error => error.includes('requires current human review')));
    for (const command of ['status', 'validate']) {
      const result = invoke([command, '--file', file]);
      assert.equal(result.exit, 0, JSON.stringify(result));
      if (command === 'status') {
        assert.equal(result.claims[0].disposition, 'Pending');
        assert.equal(result.claims[0].recordedDisposition, 'Accepted');
        assert.equal(result.claims[0].stale, true);
        assert.equal(result.claims[0].eligibleAccepted, false);
      } else assert.deepEqual(result.eligibleAcceptedClaimIds, []);
      assert.equal(await readFile(file, 'utf8'), bytes);
    }
    assert.equal((await decide()).code, 'STALE_BASE');
    decision.baseDigest = reviewBaseDigest(corpus);
    assert.equal((await decide()).exit, 0);
    const reviewed = await readJson(file);
    assertAppendOnlyReviews(priorEvents, reviewed.reviews);
    assert.equal(reviewed.claims[0].disposition, 'Accepted');
    assertValid(reviewed);
  });
}

test('AC-03 unchanged decisions coexist; correction invalidates other acceptance without altering events', async t => {
  const { file, decision, decide } = await setup(t);
  assert.equal((await decide()).exit, 0);
  decision.claimId = 'synthetic-claim-b';
  assert.equal((await decide()).exit, 0);
  let corpus = await readJson(file);
  assert.equal(corpus.claims.filter(c => c.disposition === 'Accepted').length, 2);
  const events = structuredClone(corpus.reviews);
  decision.action = 'correct';
  decision.correction = { description: 'Changed proposal.' };
  assert.equal((await decide()).exit, 0);
  corpus = await readJson(file);
  assert.equal(corpus.claims[0].disposition, 'Pending');
  assert.equal(corpus.claims[1].disposition, 'Needs correction');
  assertAppendOnlyReviews(events, corpus.reviews);
  assertValid(corpus);
});

test('AC-03 eligibility propagates through inference support without mutating its input', async () => {
  const corpus = await fixture();
  for (const claimId of ['synthetic-claim-a', 'synthetic-claim-b', corpus.claims[3].id]) {
    applyReview(corpus, {
      schemaVersion: 'manual-review/1', claimId, action: 'accept',
      baseDigest: reviewBaseDigest(corpus), rationale: 'Synthetic support review.',
    }, 'synthetic-human');
  }
  const before = canonicalSerialize(corpus);
  assert.deepEqual(reviewEligibleCorpus(corpus), corpus);
  corpus.claims[0].disposition = 'Excluded';
  const view = reviewEligibleCorpus(corpus);
  assert.equal(view.claims[3].disposition, 'Pending');
  assert.equal(corpus.claims[3].disposition, 'Accepted');
  assert.equal(canonicalSerialize(view.reviews), canonicalSerialize(corpus.reviews));
  assert.notEqual(canonicalSerialize(corpus), before);
});

test('AC-01/02 private persistence rejects unsafe paths, locks and rewritten events', async t => {
  const { directory, file, template, decision, decide } = await setup(t);
  assert.equal((await decide()).exit, 0);
  const before = await readFile(file, 'utf8');
  await chmod(template, 0o644);
  assert.equal(invoke(['decide', '--template', template, '--store', directory, '--reviewer', 'human']).code, 'UNSAFE_PATH');
  await chmod(template, 0o600);
  const linked = path.join(directory, 'link.json');
  await symlink(template, linked);
  assert.equal(invoke(['decide', '--template', linked, '--store', directory, '--reviewer', 'human']).code, 'UNSAFE_PATH');
  await writeFile(path.join(directory, '.intake.lock'), '', { mode: 0o600 });
  assert.equal((await decide(decision)).code, 'STORE_BUSY');
  await rm(path.join(directory, '.intake.lock'));
  const result = await updatePrivateCorpus(directory, corpus => { corpus.reviews[0].rationale = 'Rewritten'; });
  assert.equal(result.status, 'failed');
  assert.equal(await readFile(file, 'utf8'), before);
});

test('AC-03 review-aware validation does not conceal malformed evidence or agent acceptance', async t => {
  const { file, decide } = await setup(t);
  assert.equal((await decide()).exit, 0);
  const corpus = await readJson(file);
  for (const mutate of [
    c => { c.claims[0].passageIds = ['missing']; },
    c => { c.passages[0].text = 'Fabricated'; },
    c => { c.reviews[0].reviewerKind = 'agent'; },
    c => { c.reviews[0].timestamp = '2026-02-30T12:00:00Z'; },
  ]) {
    const invalid = structuredClone(corpus);
    mutate(invalid);
    await writeFile(file, canonicalSerialize(invalid));
    const before = await readFile(file, 'utf8');
    assert.equal(invoke(['validate', '--file', file]).code, 'INVALID_CORPUS');
    assert.equal(await readFile(file, 'utf8'), before);
  }
});
