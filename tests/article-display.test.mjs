import test from 'node:test';
import assert from 'node:assert/strict';
import { createModel } from '../src/model.mjs';
import { caseCitations } from '../src/render.mjs';
import { canonicalSerialize, digest } from '../scripts/contract.mjs';

const alias = 'https://redcanary.com/blog/threat-detection/ai-cli-tools/';
const target = 'https://www.zscaler.com/blogs/cybersecurity-best-practices/ai-cli-tools';
function fixture() {
  return {
    schemaVersion: '0.3.0',
    sources: [
      { id: 'synthetic-alias', originalUrl: alias, canonicalUrl: alias, publisher: 'Red Canary',
        title: 'Synthetic article metadata', revisionIds: ['synthetic-alias-revision'] },
      { id: 'synthetic-target', originalUrl: target, canonicalUrl: target, publisher: 'Zscaler',
        title: 'Synthetic target metadata', revisionIds: ['synthetic-target-revision'] },
      { id: 'synthetic-unrelated', originalUrl: 'https://redcanary.com/blog/other/',
        canonicalUrl: 'https://redcanary.com/blog/other/', publisher: 'Red Canary', revisionIds: [] },
    ],
    cases: [{ id: 'synthetic-case', name: 'Synthetic alias exercise',
      sourceIds: ['synthetic-alias', 'synthetic-target', 'synthetic-unrelated'] }],
    claims: [], sourceRevisions: [], passages: [], categorizations: [], timelines: [],
    reviews: [], collectionManifests: [{ id: 'synthetic-failure', outcome: 'Failed', inputSourceIds: ['synthetic-alias'] }],
  };
}

test('AC-01 campaign citations group exact verified aliases without deleting source provenance', () => {
  const corpus = fixture(), before = digest(corpus), model = createModel(corpus);
  const exported = caseCitations(model, corpus.cases[0]);
  assert.equal(exported.citations.length, 2);
  const article = exported.citations.find(c => c.url === target);
  assert.equal(article.publisher, 'Zscaler');
  assert.deepEqual(new Set(article.sourceRevisionIds), new Set(['synthetic-alias-revision', 'synthetic-target-revision']));
  assert.deepEqual(new Set(article.members.map(m => m.originalUrl)), new Set([alias, target]));
  assert.deepEqual(new Set(article.members.map(m => m.sourceId)), new Set(['synthetic-alias', 'synthetic-target']));
  assert.equal(exported.citations.find(c => c.sourceId === 'synthetic-unrelated').publisher, 'Red Canary');
  assert.equal(digest(corpus), before);
  assert.equal(canonicalSerialize(caseCitations(model, corpus.cases[0])), canonicalSerialize(exported));
});

test('AC-01 alias-only citations use target URL and unsafe URLs never become public links', () => {
  const corpus = fixture();
  corpus.cases[0].sourceIds = ['synthetic-alias'];
  const model = createModel(corpus), citation = caseCitations(model, corpus.cases[0]).citations[0];
  assert.equal(citation.url, target);
  assert.equal(citation.publisher, 'Zscaler');
  assert.equal(citation.members[0].originalUrl, alias);
  corpus.sources[0].originalUrl = 'javascript:alert(1)';
  corpus.sources[0].canonicalUrl = 'https://operator@redcanary.com/blog/other/';
  const unsafe = caseCitations(model, corpus.cases[0]).citations[0];
  assert.equal(unsafe.url, null);
  assert.equal(unsafe.members[0].originalUrl, null);
  assert.equal(unsafe.members[0].canonicalUrl, null);
});

test('AC-01 shared research does not union citations across cases', () => {
  const corpus = fixture();
  corpus.cases.push({ id: 'synthetic-other-case', name: 'Other synthetic case', sourceIds: ['synthetic-unrelated'] });
  const exported = caseCitations(createModel(corpus), corpus.cases[1]);
  assert.equal(exported.citations.length, 1);
  assert.equal(exported.citations[0].sourceId, 'synthetic-unrelated');
});
