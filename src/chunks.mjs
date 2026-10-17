import { createRequire } from 'node:module';
import { sha256, stableId } from '../scripts/contract.mjs';

const require = createRequire(new URL('../scripts/package.json', import.meta.url));
const { get_encoding } = require('tiktoken');
const tokenizer = get_encoding('o200k_base');

export const CHUNK_POLICY = Object.freeze({
  version: 'canonical-context/1',
  tokenizer: 'tiktoken/1.0.22',
  encoding: 'o200k_base',
  maxTokens: 2000,
  overlapTokens: 200,
  overlapCodePoints: 200,
});

export function referenceTokens(text) {
  // Embedded special-token spellings are article data, never control tokens.
  return tokenizer.encode(text, [], []).length;
}

function invalid(code) {
  throw Object.assign(new Error(code), { code });
}

function units(text) {
  const result = [];
  let offset = 0, current = null, fence = null;
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    const blank = !line.trim();
    const kind = opening ? 'code' : /^ {0,3}>/.test(line) ? 'prompt' : 'paragraph';
    if (fence) {
      current.end += [...line].length;
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*(?:\r?\n)?$/)?.[1];
      if (closing?.[0] === fence[0] && closing.length >= fence.length) {
        fence = null;
        current = null;
      }
    } else if (blank) {
      if (result.at(-1)?.kind === 'whitespace') result.at(-1).end += [...line].length;
      else result.push({ start: offset, end: offset + [...line].length, kind: 'whitespace' });
      current = null;
    } else {
      if (!current || opening || current.kind !== kind) {
        current = { start: offset, end: offset, kind };
        result.push(current);
      }
      current.end += [...line].length;
      if (opening) fence = opening[1];
    }
    offset += [...line].length;
  }
  return result;
}

function sentenceEnds(points, start, end) {
  const ends = [];
  for (let i = start; i < end; i++) {
    if (/[.!?]/u.test(points[i]) && (i + 1 === end || /\s/u.test(points[i + 1]))) {
      let next = i + 1;
      while (next < end && /\s/u.test(points[next])) next++;
      ends.push(next);
      i = next - 1;
    }
  }
  return ends;
}

// Every accepted probe is measured. BPE prefix counts need not be monotonic;
// this deterministic search promises a fitting prefix, not a globally maximal one.
function fittingEnd(points, start, end, budget, count) {
  let low = start, high = Math.min(end, start + 1);
  while (count(start, high) <= budget) {
    low = high;
    if (high === end) return high;
    high = Math.min(end, start + (high - start) * 2);
  }
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (count(start, middle) <= budget) low = middle;
    else high = middle;
  }
  if (low === start) invalid('CHUNK_NO_FORWARD_PROGRESS');
  return low;
}

export function chunkRevision(revision) {
  const text = revision?.normalizedContent;
  if (typeof revision?.id !== 'string' || !revision.id
    || typeof text !== 'string' || !text.isWellFormed() || text.includes('\0')) invalid('INVALID_CHUNK_REVISION');
  if (sha256(text) !== revision.normalizedHash) invalid('REVISION_HASH_MISMATCH');
  const points = [...text];
  const count = (start, end) => referenceTokens(points.slice(start, end).join(''));
  const sourceUnits = units(text), parts = [], overlapBoundaries = new Set([0]);
  for (const unit of sourceUnits) {
    overlapBoundaries.add(unit.start);
    overlapBoundaries.add(unit.end);
    const sentences = sentenceEnds(points, unit.start, unit.end);
    const lines = [];
    for (let i = unit.start; i < unit.end; i++) {
      if (points[i] === '\n') lines.push(i + 1);
    }
    if (unit.kind === 'paragraph') sentences.forEach(end => overlapBoundaries.add(end));
    const oversized = count(unit.start, unit.end) > CHUNK_POLICY.maxTokens;
    let start = unit.start;
    while (start < unit.end) {
      let end = oversized
        ? fittingEnd(points, start, unit.end, CHUNK_POLICY.maxTokens, count) : unit.end;
      if (end < unit.end) {
        const sentence = sentences.filter(boundary => boundary > start && boundary <= end).at(-1);
        const line = lines.filter(boundary => boundary > start && boundary <= end).at(-1);
        const meaningful = unit.kind === 'code' ? line ?? sentence : sentence ?? line;
        if (meaningful !== undefined && count(start, meaningful) <= CHUNK_POLICY.maxTokens) end = meaningful;
      }
      parts.push({ start, end, warning: oversized
        ? { code: 'oversized-unit-split', kind: unit.kind, start: unit.start, end: unit.end } : null });
      start = end;
    }
  }

  const boundaries = [...overlapBoundaries].sort((a, b) => a - b), chunks = [];
  let index = 0;
  while (index < parts.length) {
    const coreStart = parts[index].start;
    let start = coreStart;
    for (const boundary of boundaries) {
      if (boundary < coreStart - CHUNK_POLICY.overlapCodePoints || boundary >= coreStart) continue;
      if (count(boundary, coreStart) <= CHUNK_POLICY.overlapTokens) {
        start = boundary;
        break;
      }
    }
    // Never split a fitting unit merely to retain overlap.
    if (count(start, parts[index].end) > CHUNK_POLICY.maxTokens) start = coreStart;
    let end = parts[index].end;
    const warnings = [];
    do {
      const part = parts[index++];
      end = part.end;
      if (part.warning && !warnings.some(warning => warning.start === part.warning.start)) warnings.push(part.warning);
    } while (index < parts.length && count(start, parts[index].end) <= CHUNK_POLICY.maxTokens);
    const chunkText = points.slice(start, end).join('');
    chunks.push({
      id: stableId('chunk', `${CHUNK_POLICY.version}\n${revision.id}\n${revision.normalizedHash}\n${start}\n${end}`),
      policyVersion: CHUNK_POLICY.version,
      sourceRevisionId: revision.id, normalizedHash: revision.normalizedHash,
      start, end, coreStart, text: chunkText, tokens: referenceTokens(chunkText),
      overlap: { start, end: coreStart, tokens: count(start, coreStart) }, warnings,
    });
  }
  return chunks;
}
