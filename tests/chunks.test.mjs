import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, normalizeText } from '../scripts/contract.mjs';
import { CHUNK_POLICY, chunkRevision, referenceTokens, unionCoverage } from '../src/chunks.mjs';
import { ARTICLE_PARSER_VERSION, parseArticle } from '../src/article.mjs';

const revision = text => ({ id: 'benign-revision', normalizedContent: text, normalizedHash: sha256(text) });
function check(text) {
  const input = revision(text), chunks = chunkRevision(input), points = [...text];
  assert.deepEqual(chunkRevision(input), chunks, 'deterministic identities and projections');
  let frontier = 0;
  for (const chunk of chunks) {
    assert.equal(chunk.coreStart, frontier, 'every canonical point covered with forward progress');
    assert.ok(chunk.start <= frontier && chunk.end > frontier);
    assert.equal(chunk.text, points.slice(chunk.start, chunk.end).join(''));
    assert.equal(chunk.sourceRevisionId, input.id);
    assert.equal(chunk.normalizedHash, input.normalizedHash);
    assert.equal(chunk.policyVersion, CHUNK_POLICY.version);
    assert.equal(chunk.tokens, referenceTokens(chunk.text));
    assert.ok(chunk.tokens <= 2000);
    assert.equal(chunk.overlap.tokens, referenceTokens(points.slice(chunk.start, frontier).join('')));
    assert.ok(chunk.overlap.tokens <= 200);
    assert.ok(frontier - chunk.start <= CHUNK_POLICY.overlapCodePoints);
    frontier = chunk.end;
  }
  assert.equal(frontier, points.length);
  return chunks;
}

test('#84 AC-01 pinned reference tokenizer counts ordinary data, including special spellings', () => {
  assert.equal(referenceTokens('hello world'), 2);
  assert.equal(referenceTokens('😀'), 1);
  assert.ok(referenceTokens('<|endoftext|>') > 1);
  assert.equal(referenceTokens(''), 0);
  assert.ok(Object.isFrozen(CHUNK_POLICY));
});

test('#84 AC-01/02 empty, whitespace, combining marks, CRLF and non-BMP slices', () => {
  for (const text of ['', ' \n\n\t', '😀 Cafe\u0301\r\n\r\nA benign paragraph.  \n',
    '😀'.repeat(2100), '漢字😀 e\u0301. '.repeat(500)]) check(text);
});

test('#84 AC-01 exact token threshold and oversized code-point fallback', () => {
  const fitting = '😀'.repeat(2000);
  assert.equal(referenceTokens(fitting), 2000);
  assert.equal(check(fitting).length, 1);
  const chunks = check(`${fitting}😀`);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every(chunk => chunk.warnings.some(w => w.code === 'oversized-unit-split')));
});

test('#84 AC-03 fitting paragraphs cross the old 2400-code-point boundary intact', () => {
  const paragraph = 'A harmless sentence describing a local example. '.repeat(65);
  assert.ok([...paragraph].length > 2400);
  const chunks = check(paragraph);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, paragraph);
  assert.deepEqual(chunks[0].warnings, []);
});

test('#84 AC-01/03 fitting fenced code, blockquoted prompts and quoted paragraphs stay intact', () => {
  const code = '```text\n' + 'benign example\n'.repeat(80) + '```\n\n';
  const prompt = '> ' + 'Describe this benign fixture. '.repeat(80) + '\n\n';
  const quoted = '"Please summarize this harmless example. '.repeat(60) + '"\n\n';
  const text = 'Intro. '.repeat(1000) + '\n\n' + code + prompt + quoted;
  const chunks = check(text);
  for (const unit of [code, prompt, quoted]) {
    assert.ok(referenceTokens(unit) <= 2000);
    assert.ok(chunks.some(chunk => chunk.text.includes(unit)));
  }
});

test('#84 AC-01/03 oversized fenced code and prompts split explicitly without losing content', () => {
  for (const text of [
    '~~~text\n' + 'harmless example. '.repeat(1600) + '\n~~~\n',
    '> ' + 'Benign prompt. '.repeat(1600) + '\n',
    '````text\n```\n' + '😀'.repeat(2100) + '\n````\n',
    '```text\n' + '😀'.repeat(2100),
  ]) {
    const chunks = check(text);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(chunk => chunk.warnings.some(w => ['code', 'prompt'].includes(w.kind))));
  }
});

test('#84 AC-03 indented fence-like code content cannot prematurely close a fitting block', () => {
  const block = '```\n' + '😀'.repeat(300) + '\n    ```\n' + '😀'.repeat(1000) + '\n```\n';
  assert.ok(referenceTokens(block) < 2000);
  const chunks = check('😀'.repeat(1500) + '\n\n' + block);
  assert.ok(chunks.some(chunk => chunk.text.includes(block)));
});

test('#84 AC-03 separator whitespace cannot force a fitting code block to split', () => {
  const block = '```text\n' + '😀'.repeat(1950) + '\n```\n';
  const separator = (' \t'.repeat(100) + '\n').repeat(3);
  assert.ok(referenceTokens(block) <= 2000);
  assert.ok(referenceTokens(block + separator) > 2000);
  const chunks = check(block + separator + 'Benign ending.');
  assert.ok(chunks.some(chunk => chunk.text.includes(block) && !chunk.warnings.length));
});

test('#84 AC-01/03 oversized code prefers complete lines before code-point fallback', () => {
  const line = 'benign_example_with_no_sentence_punctuation\n';
  const chunks = check('```text\n' + line.repeat(600) + '```\n');
  assert.ok(chunks.length > 1);
  assert.ok(chunks.slice(0, -1).every(chunk => chunk.text.endsWith('\n')));
});

test('#84 AC-03 overlap is preceding canonical context, not new source content', () => {
  const chunks = check('A benign paragraph. \n\n'.repeat(600));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.slice(1).some(chunk => chunk.overlap.tokens > 0));
  assert.ok(chunks.reduce((sum, chunk) => sum + chunk.end - chunk.start, 0)
    > chunks.at(-1).end, 'processed windows and unique coverage are different');
});

test('#84 AC-02 hash tampering and malformed Unicode fail; distinct revisions have distinct identities', () => {
  assert.throws(() => chunkRevision({ ...revision('benign'), normalizedContent: 'changed' }),
    { code: 'REVISION_HASH_MISMATCH' });
  assert.throws(() => chunkRevision(revision('\ud800')), { code: 'INVALID_CHUNK_REVISION' });
  assert.throws(() => chunkRevision(revision('a\0b')), { code: 'INVALID_CHUNK_REVISION' });
  const input = revision('Repeated benign quote. Repeated benign quote.');
  assert.notEqual(chunkRevision(input)[0].id, chunkRevision({ ...input, id: 'other-revision' })[0].id);
});

test('#84 AC-03 HTML parser output protects fitting code with blank lines and multiline prompts without changing text', () => {
  const code = '😀'.repeat(300) + '\n\n' + '😀'.repeat(1500);
  const prompt = 'Exact benign instruction.\n\nKeep this second paragraph.';
  const html = `<article><p>${'😀'.repeat(1500)}</p><pre><code>${code}</code></pre>`
    + `<blockquote><p>${prompt.split('\n\n').join('</p><p>')}</p></blockquote></article>`;
  const text = normalizeText(parseArticle(html).text), input = {
    ...revision(text), rawContent: html, parserVersion: ARTICLE_PARSER_VERSION,
  };
  const before = structuredClone(input), chunks = chunkRevision(input);
  assert.ok(referenceTokens(code) <= 2000);
  assert.ok(chunks.some(chunk => chunk.text.includes(code) && !chunk.warnings.length));
  assert.ok(chunks.some(chunk => chunk.text.includes('Exact benign instruction.\nKeep this second paragraph.')));
  assert.deepEqual(input, before);
  assert.equal(unionCoverage(chunks).reduce((n, range) => n + range.end - range.start, 0), [...text].length);
  assert.throws(() => chunkRevision({ ...input, rawContent: '<article>Different article.</article>' }),
    { code: 'ARTICLE_BOUNDARY_MISMATCH' });
});

test('#84 AC-03 HTML repeated and oversized protected blocks retain Unicode coordinates and code warnings', () => {
  const code = '😀'.repeat(2100), html = `<article><pre>${code}</pre><pre>${code}</pre></article>`;
  const text = normalizeText(parseArticle(html).text);
  const chunks = chunkRevision({ ...revision(text), rawContent: html, parserVersion: ARTICLE_PARSER_VERSION });
  assert.ok(chunks.every(chunk => chunk.tokens <= 2000));
  assert.ok(chunks.every(chunk => chunk.warnings.some(w => w.kind === 'code')));
  assert.equal(chunks.map(chunk => [...chunk.text].slice(chunk.coreStart - chunk.start).join('')).join(''), text);
});

test('#84 AC-03 historical HTML text is not reinterpreted and explicitly discloses unavailable block hints', () => {
  const input = { ...revision('Retained historical text.'), parserVersion: 'readable-html/4',
    rawContent: '<article>Not reinterpreted with the current parser.</article>' };
  const chunks = chunkRevision(input);
  assert.equal(chunks[0].text, input.normalizedContent);
  assert.deepEqual(chunks[0].warnings, [{ code: 'historical-html-boundaries-unavailable', parserVersion: 'readable-html/4' }]);
});
