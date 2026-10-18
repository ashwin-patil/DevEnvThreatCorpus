import test from 'node:test';
import './theme.test.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createModel, applyReviewProjection, metadata, dateLabel, caseSourceIds, linkedClaims, claimTarget,
  passageSegments, conflictPairs, recordContext, filterRecords, facetOptions, parseRoute, routeHash,
  COMPARISON_DIMENSIONS, COMPARISON_FACETS, DATE_TYPES, dateBounds, matchesDate,
  comparisonRecords, comparisonTimeline, comparisonCoverage,
} from '../src/model.mjs';
import { element, renderClaim, renderConflicts, renderSourceText, renderSource, renderCase, renderComparison, caseCitations, safeExternalUrl, sourceCitation, claimCitation, reviewChip, reviewLegend } from '../src/render.mjs';
import { fetchCorpus, mountWorkbench } from '../src/app.mjs';
import { catalogSnapshot } from '../src/framework-catalog.mjs';
import { renderExploration, renderResearchLibrary, renderCaseLibrary, renderEvidencePanel, talkBundle, talkMarkdown, explorationRecords, graphLayout, nodeMappings } from '../src/explore.mjs';
import {
  DIMENSIONS, EVIDENCE, normalizeSuppliedText, serializeProposal, hashText, selectedPassage,
  CAMPAIGN_FILE_LIMIT, campaignCandidate, createStudio, pasteArticle, addStudioCase, saveDraft, extractionProposal,
  corpusProposal, renderCampaignEnrichment, renderStudio, downloadProposal, webIntakeInput,
} from '../src/studio.mjs';
import { assertValid, validateShape, categories, schema, normalizeText, digest, sha256, canonicalSerialize, intakeSource, reviewBaseDigest } from '../scripts/contract.mjs';
import { applyExtraction } from '../scripts/extract.mjs';
import { applyReview } from '../scripts/review.mjs';
import { emptyCorpus } from '../scripts/server.mjs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateStoreTest } from './platform.mjs';
import { publisherDisplay, behaviorInventory, articleCoverage } from '../src/research-inventory.mjs';
import { campaignGraph, campaignSummary, pathDisplayName, evidenceLabel, originReview, activityIcon } from '../src/campaign-presentation.mjs';
import { graphRouter, segmentClear, NODE_WIDTH, NODE_HEIGHT } from '../src/graph-geometry.mjs';
import { aiLibrary, toolIdentity } from '../src/ai-library.mjs';
import { publicDraftModel } from '../src/public-profile.mjs';
import { PUBLIC_DRAFT_URL } from '../src/app.mjs';
import { applyItemReview, reviewSnapshot } from '../src/hitl.mjs';
import { GUIDE_VERSION, confirmationFor } from '../src/review-guide.mjs';
import { renderReview, reviewNavigation, reviewSession, supportNavigation, returnFromSupport } from '../src/review-ui.mjs';

test('public draft rejects retained bodies, attestation and acceptance without changing private corpus import', () => {
  const input = { schemaVersion: 'public-draft/1', profile: 'draft', snapshotDigest: 'a'.repeat(64),
    records: [], sourceCoverage: [], tools: [], limitations: [] };
  const row = { schemaVersion: '0.3.0', entityType: 'sourceRevisions',
    entity: { id: 'synthetic-revision', rawContent: null, normalizedContent: null },
    reviewStatus: null, warnings: ['Draft profile; not a release.'] };
  const project = () => publicDraftModel({ ...input, records: [row] });
  assert.equal(project().collectionEnabled, false);
  row.entity.rawContent = 'Synthetic retained private text'; assert.throws(project, /Invalid public/);
  row.entity.rawContent = null; row.entity.normalizedContent = 'Synthetic retained text'; assert.throws(project, /Invalid public/);
  row.entity.normalizedContent = null; row.entityType = 'passages'; row.entity = { id: 'synthetic-passage', text: null, attestation: null };
  assert.equal(project().corpus.passages[0].text, null);
  row.entity.attestation = { reviewer: 'invented' }; assert.throws(project, /Invalid public/);
  row.entity.attestation = null; row.entity.text = 'Synthetic quote'; assert.throws(project, /Invalid public/);
  row.entity.text = null; row.reviewStatus = { currentAcceptance: true }; assert.throws(project, /Invalid public/);
  row.reviewStatus = null; row.entity.disposition = 'Accepted'; assert.throws(project, /Invalid public/);
});

test('public loader falls back only for static API absence or explicitly bundled mode; private empty input wins', async () => {
  const projected = { schemaVersion: 'public-draft/1', profile: 'draft', snapshotDigest: 'b'.repeat(64),
    records: [], sourceCoverage: [], tools: [], limitations: [] };
  for (const mode of ['static', 'bundled']) {
    const calls = [];
    const result = await fetchCorpus(async endpoint => {
      calls.push(endpoint);
      if (endpoint === '/api/corpus') return { ok: mode === 'bundled', status: mode === 'static' ? 404 : 200,
        headers: { get: key => key === 'x-corpus-mode' && mode === 'bundled' ? 'public-draft' : null } };
      assert.equal(endpoint, PUBLIC_DRAFT_URL);
      return { ok: true, json: async () => projected };
    }, '/api/corpus');
    assert.equal(result.publicDraft.snapshotDigest, projected.snapshotDigest);
    assert.equal(result.collectionEnabled, false); assert.equal(calls.length, 2);
  }
  const calls = [];
  const privateEmpty = await fetchCorpus(async endpoint => {
    calls.push(endpoint); return { ok: true, headers: { get: () => null }, json: async () => emptyCorpus() };
  }, '/api/corpus');
  assert.equal(privateEmpty.publicDraft, undefined); assert.deepEqual(calls, ['/api/corpus']);
  await assert.rejects(fetchCorpus(async () => ({ ok: false, status: 500 }), '/api/corpus'), /request failed/);
});

const fixture = JSON.parse(await readFile(new URL('./fixtures/benign/core-only.json', import.meta.url), 'utf8'));
const researchFixture = JSON.parse(await readFile(new URL('./fixtures/benign/research-views.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(fixture);
const model = () => createModel(fresh());

test('AI product aliases preserve literals and ambiguous executables do not become products', () => {
  assert.equal(toolIdentity(' Claude Code ').name, 'Claude Code');
  assert.equal(toolIdentity('codex').id, toolIdentity('OpenAI Codex').id);
  assert.equal(toolIdentity('Amazon Q Developer CLI').name, 'Amazon Q');
  assert.equal(toolIdentity('q').id, toolIdentity('Amazon Q').id);
  assert.match(toolIdentity('q').basis, /original q literal retained/);
  for (const value of ['claude-sonnet-4', 'claude --flag', 'claude code evil']) assert.equal(toolIdentity(value).id, null);
});

test('research cards distinguish failed URL metadata from a retained article', () => {
  const m = model(), source = { ...m.corpus.sources[0], id: 'failed-url', revisionIds: [], collectionState: 'Collected' };
  m.corpus.collectionManifests.push({ inputSourceIds: [source.id], outcome: 'Failed' });
  const card = renderResearchLibrary(new FakeDocument(), m, [source], () => {});
  assert.match(card.textContent, /No retained article revision/);
  assert.match(card.textContent, /Failed intake attempt/);
  assert.doesNotMatch(card.textContent, /Collected · extraction/);
});

test('AI libraries retain exact prompt variants, scope, provenance, navigation and export', async () => {
  const m = model();
  const base = { type: 'commands-ai-artifacts', caseId: 'synthetic-case-a', sourceId: 'synthetic-source-a',
    sourceRevisionId: 'synthetic-revision-a', claimIds: ['synthetic-claim-a'], status: 'pending', origin: 'agent' };
  m.annotations = [
    { ...base, id: 'tool-a', value: 'claude', normalizedValue: 'Misleading replacement', context: { artifactKind: 'ide-cli', artifactUsage: 'attempted-abuse' } },
    { ...base, id: 'prompt-a', value: '<script>synthetic prompt 😀</script>', context: { artifactKind: 'prompt-instruction', artifactUsage: 'vendor-example' } },
    { ...base, id: 'prompt-b', value: '<script>synthetic prompt 😀</script> ', context: { artifactKind: 'prompt-instruction' } },
    { ...base, id: 'prompt-c', caseId: 'synthetic-case-b', value: '<script>synthetic prompt 😀</script>', context: { artifactKind: 'prompt-instruction' } },
  ];
  const before = JSON.stringify(m.annotations);
  assert.equal(aiLibrary(m, 'tools')[0].name, 'Claude Code');
  assert.equal(aiLibrary(m, 'prompts').length, 2);
  assert.equal(aiLibrary(m, 'prompts', new Set(['synthetic-case-b']))[0].annotations.length, 1);
  assert.equal(explorationRecords(m, 'tools', { cases: ['synthetic-case-b'] }).records.length, 0);
  assert.equal(explorationRecords(m, 'prompts', { sources: ['missing-source'] }).records.length, 0);
  assert.equal(explorationRecords(m, 'tools', { query: 'attempted-abuse' }).records.length, 1);
  const calls = [], root = renderExploration(new FakeDocument(), m, 'prompts', {}, (...args) => calls.push(args), 'prompts-prompt-c');
  assert.doesNotMatch(root.textContent, /Unknown target/);
  assert.match(root.textContent, /Vendor example/);
  assert.doesNotMatch(root.textContent, /artifactUsage:/);
  assert.ok(descendants(root).some(n => n.getAttribute?.('aria-label') === 'Source artifact: Vendor example'));
  assert.match(root.textContent, /synthetic prompt 😀/);
  const sourceButton = descendants(root).find(n => n.tagName === 'BUTTON' && n.textContent.startsWith('Source:'));
  await sourceButton.trigger('click'); assert.deepEqual(calls[0], ['sources', 'synthetic-source-a', 'synthetic-revision-a']);
  const card = renderResearchLibrary(new FakeDocument(), m, m.corpus.sources, (...args) => calls.push(args));
  const toolChip = descendants(card).find(n => n.tagName === 'BUTTON' && n.textContent === '◐ Claude Code');
  assert.match(toolChip.className, /usage-attempted-abuse/);
  assert.equal(toolChip.getAttribute('aria-label'), 'Claude Code: Attempted abuse');
  await toolChip.trigger('click');
  assert.deepEqual(calls.at(-1), ['tools', 'ai-tool-claude-code']);
  assert.equal(talkBundle(m, 'synthetic-case-a').annotations.find(a => a.id === 'prompt-a').value, m.annotations[1].value);
  assert.equal(JSON.stringify(m.annotations), before);
});

test('publisher labels normalize known hosts, retain metadata and reject lookalike hosts', () => {
  const source = { publisher: null, originalUrl: 'https://nx.dev/blog/report', canonicalUrl: null };
  const before = JSON.stringify(source);
  assert.equal(publisherDisplay(source).name, 'Nx');
  assert.equal(publisherDisplay({ ...source, originalUrl: 'https://www.stepsecurity.io/blog/report' }).name, 'StepSecurity');
  assert.notEqual(publisherDisplay({ ...source, originalUrl: 'https://nx.dev.evil.invalid/report' }).name, 'Nx');
  assert.equal(publisherDisplay({ publisher: 'Independent research', originalUrl: null }).name, 'Independent research');
  assert.equal(publisherDisplay({ publisher: 'The MITRE Corporation', originalUrl: 'https://github.com/mitre-attack/catalog' }).name, 'The MITRE Corporation');
  assert.match(publisherDisplay({ originalUrl: 'https://unknown.example/report' }).basis, /unverified/);
  assert.equal(JSON.stringify(source), before);
});
test('publisher display and facets follow migrated URLs and explicit metadata without changing source records', () => {
  const m = model(), source = m.corpus.sources[0];
  source.publisher = 'Red Canary'; source.originalUrl = 'https://redcanary.com/blog/report'; source.canonicalUrl = 'https://www.zscaler.com/blogs/report';
  const before = JSON.stringify(source);
  assert.equal(publisherDisplay(source).name, 'Zscaler');
  assert.equal(filterRecords(m, 'sources', { publishers: ['Zscaler'] }).some(s => s.id === source.id), true);
  assert.equal(JSON.stringify(source), before);
  assert.equal(publisherDisplay({ ...source, canonicalUrl: null }).name, 'Red Canary');
  assert.equal(publisherDisplay({ ...source, canonicalUrl: null, publisher: 'Zscaler Blog' }).name, 'Zscaler');
});

test('compact research chips retain full accessible titles and disambiguate repeated publishers', () => {
  const corpus = fresh();
  for (const s of corpus.sources) { s.publisher = 'StepSecurity'; s.originalUrl = null; s.canonicalUrl = null; }
  const root = renderCaseLibrary(new FakeDocument(), createModel(corpus), corpus.cases, () => {});
  const chips = descendants(root).filter(n => n.tagName === 'BUTTON' && n.title?.includes('reported publisher'));
  assert.ok(chips.some(n => n.textContent === 'StepSecurity · 1'));
  assert.ok(chips.some(n => n.textContent === 'StepSecurity · 2'));
  assert.ok(chips.every(n => n.getAttribute('aria-label').includes('Synthetic')));
});

test('suggested inventory groups similar CLI labels but keeps transitions and evidence records separate', () => {
  const records = [
    { id: 'a', name: 'Attempted local AI CLI invocation', disposition: 'Pending' },
    { id: 'b', name: 'Attempted local AI CLI invocation with permissive flag', disposition: 'Pending' },
    { id: 'c', name: 'Malware → local coding agent', disposition: 'Pending' },
  ];
  const before = JSON.stringify(records), groups = behaviorInventory(records);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(g => g.kind === 'atomic-behavior').members.length, 2);
  assert.equal(groups.find(g => g.kind === 'activity-pattern').members.length, 1);
  assert.ok(groups.every(g => /confirmation required/.test(g.basis)));
  assert.equal(JSON.stringify(records), before);
});

test('missing exploration targets never substitute a different behavior or attack path', () => {
  const m = createModel(structuredClone(researchFixture));
  for (const view of ['paths', 'behaviors']) {
    const content = renderExploration(new FakeDocument(), m, view, {}, () => {}, 'missing-target');
    assert.match(content.textContent, /No different research record has been substituted/);
    assert.equal(descendants(content).filter(n => n.className.includes('research-card')).length, 0);
  }
});

test('research library cards link directly supported behaviors without needing a path or mapping', async () => {
  const corpus = fresh();
  corpus.behaviors = [{ id: 'direct-behavior', name: 'Direct source behavior', claimIds: ['synthetic-claim-a'],
    namespace: 'synthetic', boundary: 'Synthetic only', description: 'Direct claim support',
    signalIds: [], detectionIds: [], otelIds: [], origin: 'LLM normalized behavior', disposition: 'Pending' }];
  const m = createModel(corpus), calls = [];
  const cards = renderResearchLibrary(new FakeDocument(), m, [corpus.sources[0]], (...args) => calls.push(args));
  assert.match(cards.textContent, /Research library/);
  assert.match(cards.textContent, /Direct source behavior/);
  assert.match(cards.textContent, /Campaigns \/ cases/);
  await button(cards, 'Direct source behavior').trigger('click');
  assert.deepEqual(calls, [['behaviors', 'direct-behavior']]);
  const scoped = renderResearchLibrary(new FakeDocument(), m, [corpus.sources[0]], () => {}, { cases: ['synthetic-case-a'] });
  assert.ok(!scoped.textContent.includes(corpus.cases[1].name), 'shared articles must not bypass the selected case filter');
  const otherSource = renderResearchLibrary(new FakeDocument(), m, [corpus.sources[1]], () => {});
  assert.ok(!otherSource.textContent.includes('Direct source behavior'), 'source filtering must not leak another article behavior');
  const detail = renderExploration(new FakeDocument(), m, 'behaviors', { cases: ['synthetic-case-a'] }, () => {});
  assert.match(detail.textContent, /Distinct related cases: 1/);
  assert.ok(detail.textContent.includes(corpus.claims[0].description));
});

test('research cards preserve independent sources and escape imported titles', () => {
  const corpus = fresh(), source = structuredClone(corpus.sources[0]);
  source.id = 'independent-source'; source.title = '<script>untrusted-title</script>';
  source.revisionIds = []; corpus.sources.push(source);
  const cards = renderResearchLibrary(new FakeDocument(), createModel(corpus), [source], () => {});
  assert.match(cards.textContent, /Independent source/);
  assert.ok(cards.textContent.includes(source.title));
  assert.equal(descendants(cards).filter(n => n.tagName === 'SCRIPT').length, 0);
});

test('case cards expand per campaign while blog cards retain many-to-many tags', async () => {
  const m = model(), calls = [], before = JSON.stringify(m.corpus);
  const cases = renderCaseLibrary(new FakeDocument(), m, m.corpus.cases, (...args) => calls.push(args));
  const campaignCards = descendants(cases).filter(n => n.tagName === 'DETAILS' && (n.className ?? '').includes('case-card'));
  assert.equal(campaignCards.length, m.corpus.cases.length);
  assert.ok(campaignCards.every(n => n.open));
  assert.match(campaignCards[0].textContent, /Expand campaign/);
  await button(campaignCards[0], 'Open campaign workspace').trigger('click');
  assert.deepEqual(calls[0], ['cases', m.corpus.cases[0].id]);
  const blogs = renderResearchLibrary(new FakeDocument(), m, m.corpus.sources, (...args) => calls.push(args));
  const blogCards = descendants(blogs).filter(n => (n.className ?? '').includes('blog-card'));
  assert.equal(blogCards.length, m.corpus.sources.length);
  const shared = blogCards.find(n => n.textContent.includes(m.corpus.sources[0].title));
  const linkedCases = m.corpus.cases.filter(c => caseSourceIds(m, c.id).includes(m.corpus.sources[0].id));
  assert.equal(descendants(shared).filter(n => (n.className ?? '').includes('campaign-tag')).length, linkedCases.length);
  assert.equal(JSON.stringify(m.corpus), before);
});

test('behavior category labels stay outside normalized behavior titles', () => {
  const m = createModel(structuredClone(researchFixture));
  const content = renderExploration(new FakeDocument(), m, 'behaviors', {}, () => {});
  const categoryTitles = descendants(content).filter(n => n.tagName === 'SUMMARY').map(n => n.textContent);
  assert.ok(categoryTitles.some(title => title.startsWith('Actions ·')));
  assert.ok(descendants(content).filter(n => n.tagName === 'H4').every(n => !/Atomic behavior|Activity pattern/.test(n.textContent)));
});

test('TTP view separates pinned resolver references and unresolved candidates from recorded mappings', () => {
  const corpus = fresh();
  corpus.governance.campaignExtraction = { runs: [{ caseId: 'synthetic-case-a',
    catalogSnapshot: { catalogs: [{ framework: 'ATT&CK', version: 'synthetic-version', materialDigest: 'synthetic-digest',
      immutableRevision: 'synthetic-revision', techniques: [{ id: 'T1059', name: 'Synthetic catalog reference', url: 'https://example.invalid/technique' }] }] },
    unresolvedMappings: [{ framework: 'ATLAS', version: 'unknown', techniqueLiteral: 'unverified candidate',
      rationale: 'No catalog match', supportingClaimIds: ['synthetic-claim-a'] }] }] };
  const content = renderExploration(new FakeDocument(), createModel(corpus), 'frameworks', {}, () => {});
  assert.match(content.textContent, /0 recorded mappings · 1 unresolved candidates · 1 pinned resolver catalogs/);
  assert.match(content.textContent, /Reference catalog for candidate extraction/);
  assert.match(content.textContent, /No ATLAS resolver catalog/);
  assert.match(content.textContent, /unverified candidate · unresolved/);
});

test('current resolver catalog is searchable and separate from historic snapshots and incident mappings', async () => {
  const m = model(), before = JSON.stringify(m.corpus);
  m.campaignStatus = { 'synthetic-case-a': { availableCatalogSnapshot: catalogSnapshot() } };
  const root = renderExploration(new FakeDocument(), m, 'frameworks', {}, () => {});
  assert.match(root.textContent, /0 recorded mappings · 0 unresolved candidates · 2 pinned resolver catalogs/);
  const atlas = descendants(root).find(n => n.className === 'catalog-entries' && n.textContent.includes('ATLAS 2026.09'));
  assert.ok(atlas); assert.ok(atlas.getAttribute('open') == null);
  assert.match(atlas.textContent, /208 resolver entries/);
  const search = descendants(atlas).find(n => n.tagName === 'INPUT');
  search.value = 'AML.T0051'; await search.trigger('input');
  const visible = descendants(atlas).find(n => n.className === 'catalog-list').children.filter(n => !n.hidden);
  assert.ok(visible.length > 0 && visible.length < 208);
  assert.ok(visible.every(n => n.dataset.search.includes('aml.t0051')));
  assert.ok(visible.some(n => n.textContent.startsWith('AML.T0051 ·')));
  assert.equal(JSON.stringify(m.corpus), before);
});

test('compact citations and review colors preserve exact targets without identifier/status suffixes', async () => {
  const m = model(), doc = new FakeDocument(), calls = [];
  m.sources.get('synthetic-source-a').publisher = 'Nx';
  const nav = (...args) => calls.push(args);
  const source = sourceCitation(doc, m, 'synthetic-source-a', nav, 'synthetic-revision-a');
  const claim = claimCitation(doc, m, 'synthetic-claim-a', nav);
  assert.equal(source.textContent, 'Source: Nx');
  assert.equal(claim.textContent, 'Supporting evidence · Nx');
  await source.trigger('click'); await claim.trigger('click');
  assert.deepEqual(calls, [['sources', 'synthetic-source-a', 'synthetic-revision-a'], ['claims', 'synthetic-claim-a']]);
  const chip = reviewChip(doc, 'Credential discovery', 'Pending', () => calls.push('behavior'));
  assert.equal(chip.textContent, '◐ Credential discovery');
  assert.match(chip.className, /review-pending/);
  assert.match(chip.getAttribute('aria-label'), /Awaiting human review/);
  await chip.trigger('click'); assert.equal(calls.at(-1), 'behavior');
  assert.match(reviewLegend(doc).textContent, /separate from whether an attack was attempted or succeeded/);
  const rendered = renderClaim(doc, m, m.claims.get('synthetic-claim-a'), nav);
  const technical = descendants(rendered).find(n => n.className === 'technical-details');
  assert.ok(technical.getAttribute('open') == null); assert.match(technical.textContent, /synthetic-claim-a/);
  const comparison = renderComparison(doc, m, comparisonRecords(m, {}), {}, nav);
  const undated = descendants(comparison).find(n => n.className === 'undated-entries');
  assert.ok(undated && undated.getAttribute('open') == null);
  assert.ok(descendants(comparison).filter(n => n.tagName === 'BUTTON').every(n => !n.textContent.includes('synthetic-claim-') && !n.textContent.includes('synthetic-source-')));
});

test('research views retain optional core-only empty states and synthetic graph support without mutating evidence', async () => {
  assertValid(researchFixture);
  const { app, content } = await mounted(researchFixture), before = canonicalSerialize(app.getModel().corpus);
  for (const view of ['paths', 'behaviors', 'frameworks', 'telemetry', 'otel']) {
    app.navigate(view);
    assert.ok(content.textContent.length);
    assert.ok(!content.textContent.includes('Unknown target'));
    const empty = await mounted(emptyCorpus(), `#${view}`);
    assert.match(empty.content.textContent, /No (authored attack paths|records)/);
  }
  app.navigate('paths');
  await button(content, '→ Benign tool response').trigger('click');
  assert.match(content.textContent, /Synthetic conditional relationship/);
  const svg = descendants(content).find(n => n.tagName === 'SVG');
  await button(content, 'Full campaign overview').trigger('click');
  const box = svg.getAttribute('viewBox');
  await button(content, 'Zoom in').trigger('click'); assert.notEqual(svg.getAttribute('viewBox'), box);
  await button(content, 'Reset layout').trigger('click'); assert.equal(svg.getAttribute('viewBox'), box);
  await button(content, 'Benign tool response').trigger('click'); assert.match(content.textContent, /no real incident or attack/);
  assert.equal(canonicalSerialize(app.getModel().corpus), before);
});

test('research case filters prevent cross-case paths and mapped enrichment contamination', () => {
  const m = createModel(researchFixture), firstCase = researchFixture.cases[0].id, otherCase = researchFixture.cases[1].id;
  assert.equal(explorationRecords(m, 'paths', { cases: [firstCase] }).records.length, 1);
  for (const view of ['paths', 'behaviors', 'frameworks', 'telemetry', 'otel'])
    assert.equal(explorationRecords(m, view, { cases: [otherCase] }).records.length, 0, view);
  assert.equal(explorationRecords(m, 'frameworks', { query: 'not an official technique' }).records.length, 1);
  assert.equal(Object.keys(graphLayout(researchFixture.paths[0])).length, 2);
});

test('research catalog controls and talk bundles retain scoped references, telemetry and hypotheses', async () => {
  const m = createModel(structuredClone(researchFixture));
  m.corpus.frameworks.push({ ...m.corpus.frameworks[0], id: 'unmapped-catalog-entry', framework: 'ATT&CK' });
  const doc = new FakeDocument(), root = renderExploration(doc, m, 'frameworks', {}, () => {});
  const controls = descendants(root).filter(n => n.tagName === 'SELECT');
  const cards = descendants(root).filter(n => n.className === 'panel research-card');
  controls[0].value = 'ATT&CK'; await controls[0].trigger('change');
  assert.equal(cards[0].hidden, true); assert.equal(cards[1].hidden, false);
  controls[1].value = 'Mapped to selected cases'; await controls[1].trigger('change'); assert.equal(cards[1].hidden, true);
  const bundle = talkBundle(m, researchFixture.cases[0].id);
  for (const key of ['paths', 'mappings', 'behaviors', 'frameworks', 'telemetry', 'detections', 'otel']) assert.equal(bundle[key].length, 1, key);
  assert.match(talkMarkdown(bundle), /Candidate framework mappings/);
  assert.match(talkMarkdown(bundle), /Untested hypothesis/);
});

test('pending TTP, data-source and detection annotations are visible without fabricated core enrichment', () => {
  const m = model(), c = m.corpus.cases[0], r = m.corpus.sourceRevisions[0];
  m.annotations = ['ttp-references', 'data-sources', 'detection-references'].map((type, index) => ({
    id: `annotation-${index}`, caseId: c.id, sourceId: r.sourceId, sourceRevisionId: r.id, type,
    value: `Pending reference ${index}`, origin: 'manual', evidenceStatus: 'inference', status: 'pending',
  }));
  assert.match(renderExploration(new FakeDocument(), m, 'frameworks', {}, () => {}).textContent, /Pending reference 0/);
  const telemetry = renderExploration(new FakeDocument(), m, 'telemetry', {}, () => {});
  assert.match(telemetry.textContent, /Pending reference 1/); assert.match(telemetry.textContent, /Pending reference 2/);
  assert.ok(!m.corpus.mappings && !m.corpus.telemetry, 'display does not promote annotations into core records');
});

test('campaign enrichment preserves exact evidence, overlapping contexts and safe draft talk exports', async () => {
  const m = model(), record = m.corpus.cases[0], revision = m.corpus.sourceRevisions[0], before = canonicalSerialize(m.corpus);
  const quote = [...revision.normalizedContent].slice(0, 5).join('');
  m.annotations = [{ id: 'test-pending', caseId: record.id, sourceId: revision.sourceId, sourceRevisionId: revision.id,
    type: 'commands-ai-artifacts', value: '<script>untrusted</script> --flag', context: { artifactKind: 'command' },
    origin: 'manual', evidenceStatus: 'evidence-backed', status: 'pending', support: { locator: { start: 0, end: 5 } },
    externalReferenceUrl: 'javascript:untrusted()' }];
  const calls = [], doc = new FakeDocument(), panel = renderEvidencePanel(doc, m, record, (...args) => calls.push(args));
  assert.match(panel.textContent, /pending/); assert.ok(panel.textContent.includes(quote));
  assert.equal(descendants(panel).filter(n => n.tagName === 'SCRIPT').length, 0);
  assert.equal(descendants(panel).filter(n => n.tagName === 'A' && n.href?.startsWith('javascript:')).length, 0);
  await button(panel, 'Source:').trigger('click'); assert.deepEqual(calls[0], ['sources', revision.sourceId, revision.id]);
  const bundle = talkBundle(m, record.id);
  assert.equal(bundle.annotations.length, 1); assert.equal(bundle.private, true);
  assert.equal(bundle.citations.length, caseSourceIds(m, record.id).length);
  assert.ok(bundle.claims.every(c => c.caseId === record.id));
  assert.ok(!Object.hasOwn(bundle, 'sourceRevisions'), 'talk bundle does not silently include full article archives');
  assert.match(talkMarkdown(bundle), /\\<script\\>/);
  assert.equal(canonicalSerialize(m.corpus), before);
});

test('private annotation reads fail visibly while preserving the loaded corpus and read-only demos', async () => {
  const requests = [];
  const loaded = await fetchCorpus(async endpoint => {
    requests.push(endpoint); return endpoint === '/api/enrichment' ? response(null, 500) : response(fresh(), 200, true);
  }, '/api/corpus');
  assert.deepEqual(requests, ['/api/corpus', '/api/review', '/api/enrichment']);
  assert.equal(loaded.corpus.claims.length, fixture.claims.length); assert.deepEqual(loaded.annotations, []);
  assert.match(loaded.annotationError, /could not be loaded/);
  const demoRequests = [];
  await fetchCorpus(async endpoint => { demoRequests.push(endpoint); return response(researchFixture); }, '/api/demo-research');
  assert.deepEqual(demoRequests, ['/api/demo-research']);
});

test('Issue #45 campaign handoff is two-step, size-checks before reading and preserves unknown model disclosure', async () => {
  let read = false;
  await assert.rejects(campaignCandidate({
    size: CAMPAIGN_FILE_LIMIT + 1,
    async text() { read = true; return '{}'; },
  }), /at most 2 MiB/);
  assert.equal(read, false);
  assert.deepEqual(await campaignCandidate({ size: 2, async text() { return '{}'; } }), {});
  await assert.rejects(campaignCandidate({ size: 2, async text() { return '[]'; } }), /must be an object/);

  const state = createStudio(fresh());
  state.campaign.caseId = 'synthetic-case-a';
  state.campaign.preparedCaseId = 'synthetic-case-a';
  state.campaign.preparedRequest = { schemaVersion: 'campaign-request/1', requestHash: 'synthetic' };
  state.campaign.candidate = { schemaVersion: 'campaign-candidate/1', requestHash: 'synthetic' };
  let imported;
  const status = { 'synthetic-case-a': { pending: true, limitations: ['Independent review is pending.'], runs: [{
    disposition: 'Pending', provider: { id: 'codex-chat-handoff', requestedModel: null, effectiveModel: null, version: null },
    promptVersion: 'synthetic-prompt/1', coverage: [{ completed: 2, skipped: 1, failed: 0 }],
  }] } };
  const host = new FakeElement('div');
  host.append(renderCampaignEnrichment(new FakeDocument(), fakeWindow(), state, {
    enabled: true, campaignStatus: status,
    prepareCampaign: async () => { throw new Error('not used'); },
    importCampaign: async input => { imported = input; return { status: 'succeeded', summary: status['synthetic-case-a'] }; },
  }));
  assert.match(host.textContent, /Step 1.*prepare request/);
  assert.match(host.textContent, /Step 2.*choose returned JSON/);
  assert.match(host.textContent, /Completed: 2 · Skipped: 1 · Failed: 0/);
  assert.match(host.textContent, /Provider: codex-chat-handoff.*Effective model: not recorded/);
  assert.match(host.textContent, /Pending: yes/);
  await button(host, 'Import candidate against prepared request').trigger('click');
  assert.equal(imported.request, state.campaign.preparedRequest);
  assert.equal(imported.candidate.requestHash, 'synthetic');

  const readOnly = renderCampaignEnrichment(new FakeDocument(), fakeWindow(), createStudio(fresh()));
  assert.match(readOnly.textContent, /Campaign enrichment is disabled/);
  assert.equal(button(readOnly, 'Prepare & download').disabled, true);
});

test('Issue #25 AC-01 all category dimensions support OR / AND within and AND across facets', () => {
  for (const dimension of Object.keys(COMPARISON_DIMENSIONS)) {
    const corpus = fresh();
    corpus.categorizations = ['first', 'second'].map((value, i) => ({
      ...corpus.categorizations[0], id: `category-${i}`, dimension, value,
    }));
    const m = createModel(corpus);
    assert.deepEqual(facetOptions(m, COMPARISON_FACETS)[dimension], ['first', 'second']);
    for (const mode of ['OR', 'AND']) {
      assert.deepEqual(comparisonRecords(m, { [dimension]: ['first', 'second'], modes: { [dimension]: mode } }).cases.map(c => c.id),
        ['synthetic-case-a']);
    }
    corpus.categorizations.pop();
    assert.equal(comparisonRecords(m, { [dimension]: ['first', 'second'], modes: { [dimension]: 'AND' } }).cases.length, 0);
    assert.equal(comparisonRecords(m, { [dimension]: ['first', 'second'] }).cases.length, 1);
    assert.equal(comparisonRecords(m, { [dimension]: ['first'], cases: ['synthetic-case-b'] }).cases.length, 0);
    assert.equal(comparisonRecords(m, {}).cases.length, 2);
  }
});

test('Issue #25 AC-01 exact claim evidence and disposition filters cannot borrow another claim status', () => {
  const corpus = fresh();
  corpus.claims[0].disposition = 'Needs correction';
  corpus.claims[1].disposition = 'Excluded';
  const m = createModel(corpus);
  assert.equal(comparisonRecords(m, {
    evidenceStatus: ['Source-reported observation'], reviewerDisposition: ['Excluded'],
  }).cases.length, 0);
  assert.deepEqual(comparisonRecords(m, {
    evidenceStatus: ['Source-reported observation', 'Unclear or disputed'], reviewerDisposition: ['Needs correction', 'Excluded'],
  }).claims.map(c => c.id), ['synthetic-claim-a', 'synthetic-claim-b']);
  assert.equal(comparisonRecords(m, {
    evidenceStatus: ['Source-reported observation', 'Unclear or disputed'], modes: { evidenceStatus: 'AND' },
  }).claims.length, 0);
});

test('Issue #25 AC-01/03 typed dates use inclusive overlap without mutating approximate or unknown precision', () => {
  const corpus = fresh(), before = JSON.stringify(corpus);
  const item = date => ({ dateType: 'discovery', date });
  const year = corpus.timelines[3].date, month = corpus.timelines[2].date, range = corpus.timelines[4].date;
  assert.deepEqual(dateBounds(year), ['2025-01-01', '2025-12-31']);
  assert.deepEqual(dateBounds(month), ['2025-06-01', '2025-06-30']);
  assert.deepEqual(dateBounds(range), ['2025-06-01', '2025-08-31']);
  assert.deepEqual(dateBounds({ precision: 'month', value: '2024-02' }), ['2024-02-01', '2024-02-29']);
  assert.deepEqual(dateBounds({ precision: 'month', value: '1900-02' }), ['1900-02-01', '1900-02-28']);
  assert.deepEqual(dateBounds({ precision: 'range', start: '2024', end: '2025' }), ['2024-01-01', '2025-12-31']);
  assert.deepEqual(dateBounds({ precision: 'range', start: '2025-06-10', end: '2025-06-12' }), ['2025-06-10', '2025-06-12']);
  for (const date of [year, month, range]) {
    assert.equal(matchesDate(item(date), { dateFrom: '2025-06-30', dateTo: '2025-06-30', dateType: 'discovery' }), true);
    assert.equal(matchesDate(item(date), { dateType: 'incident_execution' }), false);
  }
  assert.equal(matchesDate(item(range), { dateFrom: '2025-08-31' }), true);
  assert.equal(matchesDate(item(range), { dateFrom: '2025-09-01' }), false);
  assert.equal(matchesDate(item(month), { dateTo: '2025-05-31' }), false);
  const unknown = item(corpus.timelines[1].date);
  assert.equal(matchesDate(unknown), true);
  assert.equal(matchesDate(unknown, { dateFrom: '2025-01-01' }), false);
  assert.equal(matchesDate(unknown, { dateUnknown: 'exclude' }), false);
  assert.equal(matchesDate(unknown, { dateUnknown: 'only', dateFrom: '2025-01-01' }), true);
  assert.equal(matchesDate(item(month), { dateUnknown: 'only' }), false);
  assert.equal(matchesDate(item(range), { dateFrom: '2025-08-01', dateTo: '2025-06-01' }), false);
  const m = createModel(corpus);
  assert.equal(comparisonRecords(m, { dateType: 'incident_execution', dateFrom: '2025-01-01' }).cases.length, 0);
  assert.equal(comparisonRecords(m, { dateType: 'incident_execution', dateUnknown: 'only' }).cases.length, 1);
  assert.deepEqual(comparisonRecords(m, { dateType: 'first_reported_activity', dateFrom: '2025-06-30', dateTo: '2025-06-30' }).claims.map(c => c.id),
    ['synthetic-claim-a']);
  assert.equal(JSON.stringify(corpus), before);
});

test('Issue #25 AC-02/03 comparison preserves shared sources, contradictory claims, and unresolved support', () => {
  const m = model(), selection = comparisonRecords(m);
  assert.deepEqual(selection.supported.map(c => c.id), ['synthetic-claim-a', 'synthetic-claim-b', 'synthetic-claim-c']);
  assert.deepEqual(selection.unresolved.map(c => c.id), ['synthetic-claim-inference']);
  assert.deepEqual(comparisonCoverage(m, selection), {
    cases: 2, sources: 2, claims: 4, supported: 3, humanEvents: 0, dispositions: { Pending: 4 },
  });
  const doc = new FakeDocument(), rendered = renderComparison(doc, m, selection, {}, () => {});
  assert.match(rendered.textContent, /Observations within the collected dataset/);
  for (const text of ['Shared source:', 'synthetic-claim-a', 'synthetic-claim-b', 'Source revision: synthetic-revision-a',
    'Source-reported observation', 'Human source paraphrase', 'Unclear or disputed', 'Disagreement retained, not merged.',
    'Source publication', 'month precision', 'Undated entries', 'excluded from source-supported comparison']) {
    assert.ok(rendered.textContent.includes(text), text);
  }
  assert.equal(descendants(rendered).filter(n => n.className === 'conflict-pair').length, 1);
  const filtered = comparisonRecords(m, { evidenceStatus: ['Source-reported observation'] });
  assert.equal(filtered.claims.length, 1);
  const contextual = renderComparison(doc, m, filtered, {}, () => {});
  assert.match(contextual.textContent, /synthetic-claim-b/);
  assert.match(contextual.textContent, /outside the active filters/);
  assert.equal(comparisonCoverage(m, filtered).claims, 1);
  const corpus = fresh();
  corpus.passages[0].text = null;
  assert.deepEqual(comparisonRecords(createModel(corpus)).supported.map(c => c.id), ['synthetic-claim-b']);
  corpus.passages[0].text = fixture.passages[0].text;
  corpus.passages[0].sourceRevisionId = 'wrong-revision';
  assert.deepEqual(comparisonRecords(createModel(corpus)).supported.map(c => c.id), ['synthetic-claim-b']);
});

test('Issue #25 AC-03 duplicate reports keep case counts and source metadata distinct from event assertions', () => {
  const corpus = fresh();
  corpus.sources.push({ ...corpus.sources[0], id: 'duplicate-report', revisionIds: ['duplicate-revision'] });
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'duplicate-revision', sourceId: 'duplicate-report' });
  corpus.passages.push({ ...corpus.passages[0], id: 'duplicate-passage', sourceRevisionId: 'duplicate-revision' });
  corpus.claims.push({ ...corpus.claims[2], id: 'duplicate-claim', sourceId: 'duplicate-report',
    sourceRevisionId: 'duplicate-revision', passageIds: ['duplicate-passage'] });
  corpus.cases[1].sourceIds.push('duplicate-report');
  assertValid(corpus);
  const m = createModel(corpus), selection = comparisonRecords(m), coverage = comparisonCoverage(m, selection);
  assert.equal(coverage.cases, 2); assert.equal(coverage.sources, 3); assert.equal(coverage.claims, 5);
  const timeline = comparisonTimeline(m, selection);
  assert.equal(timeline.dated.filter(t => t.kind === 'source' && t.dateType === 'publication').length, 3);
  assert.ok(timeline.unknown.every(t => t.date.precision === 'unknown'));
  assert.ok(timeline.dated.every(t => t.date.precision !== 'unknown'));
  for (const type of DATE_TYPES.filter(t => t !== 'source_update')) {
    assert.ok([...timeline.dated, ...timeline.unknown].some(t => t.dateType === type));
  }
  const bounded = comparisonTimeline(m, selection, { dateType: 'disclosure', dateFrom: '2025-08-31' });
  assert.deepEqual(bounded.dated.map(t => t.id), ['synthetic-range']);
  assert.equal(bounded.unknown.length, 0);
  assert.deepEqual(comparisonTimeline(m, selection, { dateUnknown: 'only' }).dated, []);
});

test('Issue #25 AC-03 recorded review coverage is not acceptance eligibility', () => {
  const corpus = fresh();
  for (const [claimId, action] of [['synthetic-claim-a', 'correct'], ['synthetic-claim-b', 'exclude']]) {
    applyReview(corpus, {
      schemaVersion: 'manual-review/1', claimId, action, baseDigest: reviewBaseDigest(corpus),
      rationale: 'Synthetic comparison coverage fixture; not a research decision.',
      ...(action === 'correct' ? { correction: { uncertainty: 'Synthetic correction needed.' } } : {}),
    }, 'synthetic-reviewer');
  }
  assertValid(corpus);
  const m = createModel(corpus), coverage = comparisonCoverage(m, comparisonRecords(m));
  assert.equal(coverage.humanEvents, 2);
  assert.deepEqual(coverage.dispositions, { 'Needs correction': 1, Excluded: 1, Pending: 2 });
  corpus.reviews[0].revision = 'old';
  assert.equal(comparisonCoverage(m, comparisonRecords(m)).humanEvents, 1);
  corpus.reviews[1].reviewerKind = 'agent';
  assert.equal(comparisonCoverage(m, comparisonRecords(m)).humanEvents, 0);
});

test('Issue #25 AC-01/04 comparison controls, reset, empty states, crosslinks and snapshot are read-only', async () => {
  const corpus = fresh(), before = JSON.stringify(corpus);
  const { doc, app, content, requests } = await mounted(corpus, '#comparison');
  assert.match(content.textContent, /Observations within the collected dataset/);
  assert.match(doc.getElementById('result').textContent, /2 distinct cases · 2 distinct linked sources.*4 matching claims/);
  assert.match(doc.getElementById('result').textContent, /Review coverage: 0\/4.*not current eligibility.*Active filters: none.*SHA-256 [a-f0-9]{64}/);
  const facets = doc.getElementById('facets');
  const ai = facets.children.find(n => n.firstChild.textContent.startsWith('AI involvement'));
  const checkboxes = descendants(ai).filter(n => n.tagName === 'INPUT');
  for (const input of checkboxes.slice(0, 2)) { input.checked = true; await input.trigger('change'); }
  const mode = descendants(ai).find(n => n.tagName === 'SELECT');
  mode.value = 'AND'; await mode.trigger('change');
  assert.match(doc.getElementById('result').textContent, /1 distinct cases/);
  assert.match(doc.getElementById('result').textContent, /ai_involvement=.* AND .* \(AND\)/);
  doc.getElementById('search').value = 'no-result-synthetic';
  await doc.getElementById('search').trigger('input');
  assert.match(content.textContent, /No cases match/);
  await button(content, 'Reset search').trigger('click');
  assert.match(doc.getElementById('result').textContent, /2 distinct cases/);
  const dates = facets.children.find(n => n.className === 'date-filters');
  const inputs = descendants(dates).filter(n => n.tagName === 'INPUT');
  inputs[0].value = '2025-08-01'; await inputs[0].trigger('change');
  inputs[1].value = '2025-06-01'; await inputs[1].trigger('change');
  assert.match(content.textContent, /Invalid date range/);
  await button(content, 'Reset search').trigger('click');
  await button(content, 'Source:').trigger('click');
  assert.equal(doc.getElementById('content').focused, true);
  assert.equal(doc.getElementById('facets').children.length, 5);
  app.navigate('comparison');
  assert.equal(parseRoute('#comparison').view, 'comparison');
  assert.equal(JSON.stringify(corpus), before);
  assert.deepEqual(requests.map(r => r[0]), ['/api/corpus']);
  const empty = await mounted(emptyCorpus(), '#comparison');
  assert.match(empty.content.textContent, /No cases match/);
});

// Deliberately small test-only DOM: no browser dependencies and no HTML parser.
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {};
    this.dataset = {}; this.listeners = {}; this.value = ''; this._text = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(_) { throw new Error('Unsafe HTML rendering is forbidden'); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  replaceChildren(...nodes) { this._text = ''; this.children = []; this.append(...nodes); }
  replaceWith(node) {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children[index] = node; node.parentNode = this.parentNode;
  }
  remove() { this.parentNode.children = this.parentNode.children.filter(n => n !== this); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
  async trigger(name, event = {}) {
    for (const fn of this.listeners[name] ?? []) await fn({ target: this, preventDefault() {}, ...event });
  }
  focus() { this.focused = true; }
  get firstChild() { return this.children[0]; }
}

function branchingModel() {
    const corpus = structuredClone(researchFixture), p = corpus.paths[0];
    p.scope = 'composite';
    for (let i = 2; i < 8; i++) p.nodes.push({ ...structuredClone(p.nodes[0]), id: `branch-${i}`, title: `Synthetic disconnected or branching node ${i}` });
    p.nodes[0].title = '<script>Long synthetic node label that remains available in inspection and text controls</script>';
    p.edges.push(
      { ...p.edges[0], id: 'branch', to: 'branch-2', relation: 'sequence', basis: 'Reconstructed synthetic sequence; execution not confirmed' },
      { ...p.edges[0], id: 'cycle', from: 'branch-2', relation: 'propagates', basis: 'Synthetic cycle' },
      { ...p.edges[0], id: 'loop', to: p.nodes[0].id, relation: 'propagates', basis: 'Synthetic self-loop' },
    );
    return createModel(corpus);
  }

function multiPhaseModel() {
  const m = branchingModel(), first = m.corpus.paths[0];
  first.name = 'Synthetic upstream compromise';
  const second = structuredClone(first);
  second.id = 'synthetic-victim-phase'; delete second.name;
  second.nodes = second.nodes.slice(0, 2);
  second.nodes[0].title = 'Synthetic victim execution';
  second.nodes[0].evidenceStatus = 'Attempted behavior';
  second.nodes[0].claimIds = ['synthetic-claim-b'];
  second.edges = second.edges.slice(0, 1);
  second.edges[0].claimIds = ['synthetic-claim-b'];
  const later = structuredClone(second);
  later.id = 'synthetic-later-phase'; later.name = 'Synthetic credential reuse';
  later.nodes[0].title = 'Synthetic credential reuse'; later.nodes[0].evidenceStatus = 'Potential consequence';
  const unrelated = structuredClone(second);
  unrelated.id = 'synthetic-other-case-path'; unrelated.caseId = 'synthetic-case-b';
  unrelated.nodes.forEach(n => { n.claimIds = ['synthetic-claim-c']; });
  unrelated.edges.forEach(e => { e.claimIds = ['synthetic-claim-c']; });
  m.corpus.paths.push(second, later, unrelated);
  m.corpus.governance.campaignExtraction = { runs: [
    { id: 'synthetic-run-one', caseId: first.caseId, recordSupport: [{ recordId: second.id, supportingClaimIds: ['synthetic-claim-b'] }] },
    { id: 'synthetic-run-two', caseId: first.caseId, recordSupport: [{ recordId: second.id, supportingClaimIds: ['synthetic-claim-b'] }] },
  ] };
  return m;
}

test('Issue #51 AC-02/03 campaign projection preserves phase occurrences, collisions, run provenance and independent support', () => {
  const m = multiPhaseModel(), first = m.corpus.paths[0], before = digest(m.corpus), graph = campaignGraph(m, first.caseId);
  assert.equal(graph.members.length, 3);
  assert.equal(graph.groups.length, 3);
  assert.equal(graph.edges.length, graph.members.reduce((n, p) => n + p.edges.length, 0));
  assert.equal(new Set(graph.nodes.map(n => n.id)).size, graph.nodes.length);
  const occurrences = graph.nodes.filter(n => n.canonicalId === first.nodes[0].id);
  assert.equal(occurrences.length, 3);
  assert.deepEqual(new Set(occurrences.map(n => n.evidenceStatus)), new Set(['Source-reported observation', 'Attempted behavior', 'Potential consequence']));
  assert.deepEqual(occurrences[1].sourceOccurrences.map(s => s.claimId), ['synthetic-claim-b']);
  assert.deepEqual(occurrences[1].runIds, ['synthetic-run-one', 'synthetic-run-two']);
  for (const edge of graph.edges) {
    assert.equal(edge.canonicalRecord, edge.memberPath.edges.find(e => e.id === edge.canonicalId));
    assert.ok(graph.nodes.some(n => n.id === edge.from && n.memberPath === edge.memberPath));
    assert.ok(graph.nodes.some(n => n.id === edge.to && n.memberPath === edge.memberPath));
  }
  assert.ok(!graph.members.some(p => p.caseId !== first.caseId));
  assert.equal(digest(m.corpus), before);
  const reserved = graph.nodes[0].id;
  m.corpus.paths[0].nodes.push({ ...first.nodes[0], id: reserved });
  const collision = campaignGraph(m, first.caseId);
  assert.equal(new Set(collision.nodes.map(n => n.id)).size, collision.nodes.length);
  assert.equal(collision.nodes.find(n => n.canonicalId === reserved).id, reserved);
  assert.match(pathDisplayName(m.corpus.paths[1]), /Synthetic victim execution/);
  assert.equal(pathDisplayName({ id: 'long-hash', nodes: [] }), 'Supported phase — title unavailable');
});

test('Issue #51 AC-05 evidence, origin and review labels do not collapse attempted, disputed or inferred activities', () => {
  assert.deepEqual(['Source-reported observation', 'Attempted behavior', 'Demonstrated capability or proof of concept',
    'Researcher inference', 'Potential consequence', 'Unclear or disputed'].map(evidenceLabel),
  ['Reported', 'Attempt reported', 'Demonstrated capability', 'Inference', 'Potential consequence', 'Unclear / disputed']);
  assert.equal(originReview({ origin: 'LLM source paraphrase', disposition: 'Pending' }), 'LLM paraphrase · unreviewed');
  assert.equal(originReview({ origin: 'Human source paraphrase', disposition: 'Needs correction' }), 'Human source paraphrase · Needs correction');
  assert.deepEqual(['workflow command', 'package install', 'AI agent', 'credentials', 'network upload'].map(title => activityIcon({ title })),
    ['terminal', 'package', 'agent', 'credentials', 'network']);
});

test('Issue #51 AC-06 summary projection requires same-case source/revision closure and stays Pending without mutating claims', () => {
  const m = multiPhaseModel(), record = m.corpus.cases[0];
  record.summary = null; record.summaryClaimIds = [];
  const before = digest(m.corpus), summary = campaignSummary(m, record);
  assert.equal(summary.projected, true);
  assert.equal(summary.disposition, 'Pending');
  assert.match(summary.origin, /Agent/);
  assert.ok(summary.claimIds.length);
  for (const id of summary.claimIds) assert.ok(summary.text.includes(m.claims.get(id).description));
  assert.equal(digest(m.corpus), before);
  record.summary = 'Synthetic supported summary'; record.summaryClaimIds = ['synthetic-claim-a'];
  assert.equal(campaignSummary(m, record).projected, false);
  record.summaryClaimIds.push('synthetic-claim-c');
  assert.notEqual(campaignSummary(m, record).text, record.summary);
  m.claims.get('synthetic-claim-a').sourceRevisionId = m.corpus.sourceRevisions.find(r => r.sourceId !== m.claims.get('synthetic-claim-a').sourceId).id;
  assert.ok(!campaignSummary(m, record).claimIds.includes('synthetic-claim-a'));
  m.corpus.paths = []; m.corpus.governance = {}; record.summaryClaimIds = [];
  assert.match(campaignSummary(m, record).text, /No cited campaign summary/);
  const root = renderCaseLibrary(new FakeDocument(), { ...m, publicDraft: {} }, [record], () => {});
  assert.match(root.textContent, /No grounded entries recorded/);
  assert.ok(root.textContent.includes(record.limits));
  assert.equal(descendants(root).filter(n => n.className?.includes('case-card') && n.tagName === 'DETAILS').length, 1);
});

test('Issue #51 follow-up campaign cards keep claim details in the workspace and show one publisher action', async () => {
  const publicModel = publicDraftModel(JSON.parse(await readFile(new URL('../src/data/nx-draft.json', import.meta.url), 'utf8')));
  const record = publicModel.corpus.cases[0];
  const summary = campaignSummary(publicModel, record);
  const cases = renderCaseLibrary(new FakeDocument(), publicModel, [record], () => {});
  const campaignCard = descendants(cases).find(node => node.className?.includes('case-card'));
  assert.ok(campaignCard.open);
  assert.equal(summary.text, 'Reports link CI workflow injection and npm token theft to malicious Nx package releases, whose payloads attempted AI-assisted reconnaissance.');
  assert.equal(summary.projected, true);
  assert.equal(summary.disposition, 'Pending');
  assert.equal(summary.claimIds.length, 3);
  assert.ok(summary.claimIds.every(id => cases.textContent.includes(publicModel.claims.get(id).description)));
  assert.doesNotMatch(cases.textContent, /Reported: Wiz links later repository disclosure/);
  assert.doesNotMatch(cases.textContent, /No concise campaign summary has been recorded/);
  assert.ok(descendants(cases).some(node => node.textContent === '◐ Wallet and secret-path inventory'));
  assert.doesNotMatch(cases.textContent, /Prompt-related claims/);
  assert.ok(cases.textContent.indexOf('AI tools') < cases.textContent.indexOf('Behaviors'));
  assert.ok(descendants(cases).some(node => node.className === 'behavior-action-list'));
  const privateModel = model(), privateRecord = privateModel.corpus.cases[0];
  privateModel.annotations = [{
    id: 'private-prompt', type: 'commands-ai-artifacts', caseId: privateRecord.id,
    sourceId: privateModel.corpus.sources[0].id, sourceRevisionId: privateModel.corpus.sourceRevisions[0].id,
    claimIds: [privateModel.corpus.claims.find(claim => claim.caseId === privateRecord.id).id],
    value: 'Synthetic private prompt', status: 'pending', origin: 'agent',
    context: { artifactKind: 'prompt-instruction', artifactUsage: 'vendor-example' },
  }];
  const privateCalls = [], privateCard = renderCaseLibrary(new FakeDocument(), privateModel,
    privateModel.corpus.cases, (...args) => privateCalls.push(args));
  assert.ok(privateCard.textContent.indexOf('Prompts') < privateCard.textContent.indexOf('Behaviors'));
  const promptLink = descendants(privateCard).find(node => node.tagName === 'BUTTON' && node.textContent === '□ Synthetic private prompt');
  assert.ok(promptLink);
  await promptLink.trigger('click');
  assert.deepEqual(privateCalls.at(-1), ['prompts', 'prompts-private-prompt']);
  const summaryClaims = campaignSummary(publicModel, record).claimIds;
  assert.ok(!publicModel.corpus.claims.filter(claim => !summaryClaims.includes(claim.id))
    .some(claim => cases.textContent.includes(claim.description)));
  assert.doesNotMatch(cases.textContent, /published research/);
  const library = renderResearchLibrary(new FakeDocument(), publicModel, publicModel.corpus.sources, () => {});
  assert.equal(descendants(library).filter(node => node.className?.includes('blog-card')).length, 4);
  assert.doesNotMatch(library.textContent, /MITRE ATT&CK|MITRE ATLAS/);
  assert.equal(descendants(library).filter(node => node.tagName === 'A').length, 0);
});

test('Issue #51 follow-up public prompt library renders exact variants with source citations, not activity claims', async () => {
  const document = JSON.parse(await readFile(new URL('../src/data/nx-draft.json', import.meta.url), 'utf8'));
  const before = digest(document), publicModel = publicDraftModel(document), calls = [];
  const entries = aiLibrary(publicModel, 'prompts');
  assert.equal(entries.length, 2);
  assert.equal(entries.flatMap(entry => entry.annotations).length, 3);
  const page = renderExploration(new FakeDocument(), publicModel, 'prompts', {}, (...args) => calls.push(args));
  assert.match(page.textContent, /Exact vendor-reported prompts for research/);
  assert.match(page.textContent, /No prompt is executed/);
  assert.doesNotMatch(page.textContent, /Source-reported prompt activity|Full prompt text remains withheld|Inspect cited claim/);
  const literals = descendants(page).filter(node => node.className === 'artifact-value');
  assert.equal(literals.length, 2);
  assert.deepEqual(literals.map(node => node.textContent), entries.map(entry => entry.annotations[0].value));
  for (const claim of publicModel.corpus.claims) assert.ok(!page.textContent.includes(claim.description));
  for (const prompt of document.prompts) {
    const annotation = publicModel.annotations.find(a => a.id === prompt.id);
    assert.equal(annotation.value, prompt.literal);
    assert.equal(annotation.status, 'pending');
    assert.equal([...annotation.value].length, prompt.locator.end - prompt.locator.start);
  }
  const sourceButtons = descendants(page).filter(node => node.tagName === 'BUTTON' && node.textContent.startsWith('Source:'));
  assert.equal(sourceButtons.length, 3);
  await sourceButtons[0].trigger('click');
  assert.deepEqual(calls[0], ['sources', document.prompts[0].sourceId, document.prompts[0].sourceRevisionId]);
  const socket = renderExploration(new FakeDocument(), publicModel, 'prompts', { sources: [document.prompts[1].sourceId] }, () => {});
  assert.equal(descendants(socket).filter(node => node.className === 'artifact-value').length, 2);
  const wizId = document.sourceCoverage.find(source => source.url.includes('wiz.io')).sourceId;
  const wiz = renderExploration(new FakeDocument(), publicModel, 'prompts', { sources: [wizId] }, () => {});
  assert.match(wiz.textContent, /No grounded entries/);
  assert.equal(descendants(wiz).filter(node => node.className === 'artifact-value').length, 0);
  assert.equal(digest(document), before);
});

test('Issue #51 public prompt projection rejects missing support, invalid locators, identity collisions and malformed literals', async () => {
  const document = JSON.parse(await readFile(new URL('../src/data/nx-draft.json', import.meta.url), 'utf8'));
  for (const alter of [
    prompt => { prompt.caseId = 'other-case'; },
    prompt => { prompt.sourceId = 'other-source'; },
    prompt => { prompt.sourceRevisionId = 'missing-revision'; },
    prompt => { prompt.claimId = 'missing-claim'; },
    prompt => { prompt.id = document.tools[0].id; },
    prompt => { prompt.literal = ''; },
    prompt => { prompt.literal = 'a'.repeat(16385); },
    prompt => { prompt.literal = prompt.literal.replace('R', '\0'); },
    prompt => { prompt.label = ''; },
    prompt => { prompt.usage = 'invented'; },
    prompt => { prompt.locator.start += 1; },
    prompt => { prompt.locator.start = 0; prompt.locator.end = [...prompt.literal].length; },
  ]) {
    const invalid = structuredClone(document);
    alter(invalid.prompts[0]);
    assert.throws(() => publicDraftModel(invalid), /Invalid public Pending draft projection/);
  }
  const duplicate = structuredClone(document);
  duplicate.prompts.push(structuredClone(duplicate.prompts[0]));
  assert.throws(() => publicDraftModel(duplicate), /Invalid public/);
  const gap = structuredClone(document);
  gap.records.find(row => row.entity.id === 'campaign-passage-5ac9b8203bba17601a5b64b945abe6213a4f3d93efebd062f5d80f7a085d7611').entity.start += 1;
  assert.throws(() => publicDraftModel(gap), /Invalid public/);
  const legacy = structuredClone(document); delete legacy.prompts;
  assert.equal(aiLibrary(publicDraftModel(legacy), 'prompts').length, 0);
  const synthetic = structuredClone(document);
  synthetic.prompts = [{ ...synthetic.prompts[1], literal: '<script>synthetic artifact</script> \n',
    locator: { start: 4163, end: 4163 + '<script>synthetic artifact</script> \n'.length } }];
  const page = renderExploration(new FakeDocument(), publicDraftModel(synthetic), 'prompts', {}, () => {});
  assert.equal(descendants(page).find(node => node.className === 'artifact-value').textContent, synthetic.prompts[0].literal);
  assert.equal(descendants(page).filter(node => node.tagName === 'SCRIPT').length, 0);
});

test('Issue #51 follow-up claims navigation groups records by campaign and publisher without merging identities', async () => {
  const corpus = branchingModel().corpus, first = corpus.claims[0];
  const { content } = await mounted(corpus, routeHash('claims', first.id));
  const campaigns = descendants(content).filter(node => node.className === 'claim-campaign-group');
  const publishers = descendants(content).filter(node => node.className === 'claim-publisher-group');
  assert.ok(campaigns.length > 0);
  assert.ok(publishers.length > 0);
  assert.ok(campaigns.some(node => node.open));
  assert.ok(publishers.some(node => node.open));
  assert.equal(descendants(content).filter(node => node.className === 'record-card').length, corpus.claims.length);
});

test('Issue #51 follow-up behavior inventory uses compact collapsible activity and relation cards', () => {
  const m = multiPhaseModel(), page = renderExploration(new FakeDocument(), m, 'behaviors', {}, () => {});
  assert.ok(descendants(page).some(node => node.className === 'behavior-tile-grid'));
  const singletonAction = descendants(page).find(node => node.className === 'behavior-tile' && node.children.length === 1);
  assert.equal(singletonAction?.children[0].tagName, 'BUTTON');
  assert.ok(descendants(page).some(node => node.className === 'chain-tile-grid'));
  for (const relation of ['sequence', 'conditional']) {
    assert.ok(descendants(page).some(node => node.className === `chain-group chain-${relation}`));
    assert.ok(descendants(page).some(node => node.className === `chain-tile chain-${relation}`));
  }
  assert.ok(descendants(page).filter(node => node.className?.startsWith('behavior-group')).every(node => !node.open));
});

test('Issue #51 follow-up attack graph focuses its initial phase and offers phase and overview framing', async () => {
  const m = multiPhaseModel(), page = renderExploration(new FakeDocument(), m, 'paths', {}, () => {});
  const svg = descendants(page).find(node => node.getAttribute('class') === 'research-graph');
  const initialWidth = Number(svg.getAttribute('viewBox').split(' ')[2]);
  const controls = descendants(page).filter(node => node.className === 'campaign-phase-button');
  assert.equal(controls.length, m.corpus.paths.filter(path => path.caseId === m.corpus.cases[0].id).length + 1);
  assert.equal(controls.filter(node => node.getAttribute('aria-pressed') === 'true').length, 1);
  assert.ok(controls.at(-1).textContent.includes('Full campaign overview'));
  await controls.at(-1).trigger('click');
  const overviewWidth = Number(svg.getAttribute('viewBox').split(' ')[2]);
  assert.ok(overviewWidth > initialWidth);
  assert.equal(controls.filter(node => node.getAttribute('aria-pressed') === 'true').length, 0);
});

test('Issue #51 AC-01 logical public coverage retains alias failures but counts a successful article only once', () => {
  const rows = [
    { url: 'https://redcanary.com/blog/threat-detection/ai-cli-tools/', status: 'failed', reason: 'ROBOTS_UNSUPPORTED' },
    { url: 'https://www.zscaler.com/blogs/cybersecurity-best-practices/ai-cli-tools', status: 'collected' },
    { url: 'https://www.zscaler.com/blogs/cybersecurity-best-practices/ai-cli-tools', status: 'collected' },
    { url: 'https://redcanary.com/blog/other/', status: 'failed', reason: 'ROBOTS_DENIED' },
  ], before = digest(rows), articles = articleCoverage(rows);
  assert.equal(articles.length, 2);
  assert.equal(articles.filter(a => a.collected).length, 1);
  assert.deepEqual(articles[0].members, rows.slice(0, 3));
  assert.equal(digest(rows), before);
});

test('Issue #51 AC-05 geometry anchors branches, reverse/cycle/self/parallel edges outside cards with associated labels', () => {
  const positions = { a: { x: 40, y: 70 }, b: { x: 370, y: 70 }, c: { x: 700, y: 70 }, disconnected: { x: 370, y: 350 } };
  const rectangles = Object.values(positions).map(p => ({ ...p, w: NODE_WIDTH, h: NODE_HEIGHT }));
  const route = graphRouter(positions), edges = [
    { from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'a', to: 'c' },
    { from: 'c', to: 'a' }, { from: 'a', to: 'a' }, { from: 'c', to: 'disconnected' },
  ];
  const routes = edges.map(route);
  assert.notEqual(routes[0].d, routes[1].d, 'parallel independently supported edges must not hide each other');
  const onBoundary = (p, r) => ((p.x === r.x || p.x === r.x + r.w) && p.y >= r.y && p.y <= r.y + r.h)
    || ((p.y === r.y || p.y === r.y + r.h) && p.x >= r.x && p.x <= r.x + r.w);
  for (let i = 0; i < routes.length; i++) {
    const g = routes[i]; assert.ok(g);
    assert.ok(onBoundary(g.points[0], { ...positions[edges[i].from], w: NODE_WIDTH, h: NODE_HEIGHT }));
    assert.ok(onBoundary(g.points.at(-1), { ...positions[edges[i].to], w: NODE_WIDTH, h: NODE_HEIGHT }));
    for (let j = 1; j < g.points.length; j++) assert.ok(segmentClear(g.points[j - 1], g.points[j], rectangles));
    assert.ok(g.label);
    assert.ok(g.labelAnchor, 'label has an explicit association to its own connector');
    assert.ok(rectangles.every(r => g.label.x + 66 < r.x || g.label.x - 66 > r.x + r.w || g.label.y + 6 < r.y || g.label.y - 24 > r.y + r.h));
    assert.ok(Math.hypot(g.label.x - g.labelAnchor.x, g.label.y - g.labelAnchor.y) <= 100);
  }
  assert.equal(route({ from: 'a', to: 'retired' }), null);
  const moved = graphRouter({ ...positions, b: { x: -280, y: -200 } })({ from: 'a', to: 'b' });
  assert.ok(moved?.d);
  const unusual = graphLayout({ nodes: [{ id: '__proto__' }, { id: 'constructor' }] });
  assert.equal(Object.keys(unusual).length, 2);
  const closeCards = graphRouter({ a: positions.a, neighbor: { x: 300, y: 70 } });
  assert.ok(closeCards({ from: 'a', to: 'a' })?.d, 'self-loop uses alternative ports when a permitted neighbor blocks its right port');
});

test('Issue #51 AC-02/03 phase selection preserves graph viewport, focus, filters and canonical return routes', async () => {
  const m = multiPhaseModel(), first = m.corpus.paths[0], second = m.corpus.paths[1], before = digest(m.corpus);
  const { content, win, doc, app } = await mounted(m.corpus, routeHash('paths', first.id));
  doc.getElementById('search').value = 'synthetic';
  await doc.getElementById('search').trigger('input');
  const svg = descendants(content).find(n => n.getAttribute('class') === 'research-graph');
  await button(content, 'Zoom in').trigger('click');
  await button(content, 'Pan down').trigger('click');
  const box = svg.getAttribute('viewBox');
  const node = descendants(svg).find(n => n.getAttribute('data-member-path') === second.id && n.getAttribute('data-entity-kind') === 'node');
  node.focus(); await node.trigger('keydown', { key: 'Enter' });
  assert.equal(descendants(content).find(n => n.getAttribute('class') === 'research-graph'), svg);
  assert.equal(svg.getAttribute('viewBox'), box);
  assert.equal(node.focused, true);
  assert.equal(node.getAttribute('aria-pressed'), 'true');
  assert.equal(win.location.hash, routeHash('paths', second.id, second.nodes[0].id));
  assert.equal(win.history.state.pathContext.pathId, second.id);
  assert.equal(doc.getElementById('search').value, 'synthetic');
  const inspection = descendants(content).find(n => n.className === 'graph-inspection');
  await button(inspection, m.claims.get('synthetic-claim-b').description).trigger('click');
  const reload = await mounted(m.corpus, win.location.hash, win.history.state);
  await button(reload.content, 'Return to selected path element').trigger('click');
  assert.equal(reload.win.location.hash, routeHash('paths', second.id, second.nodes[0].id));
  assert.equal(reload.doc.getElementById('search').value, 'synthetic');
  assert.equal(digest(app.getModel().corpus), before);
});

test('Issue #51 AC-03 switching displayed campaigns never carries the previous case filter', async () => {
  const m = multiPhaseModel(), { content, win } = await mounted(m.corpus, '#paths');
  const other = m.corpus.cases[1], otherPath = m.corpus.paths.at(-1);
  await button(content, `${other.name} · campaign graph`).trigger('click');
  assert.equal(win.location.hash, routeHash('paths', otherPath.id));
  assert.doesNotMatch(content.textContent, /target outside the active filters/);
  assert.match(content.textContent, new RegExp(other.name));
  assert.ok(descendants(content).some(n => n.getAttribute('class') === 'research-graph'));
});

test('Issue #51 AC-03 search-matched campaigns retain unmatched member routes through evidence, reload and history', async () => {
  const m = multiPhaseModel(), first = m.corpus.paths[0], other = m.corpus.paths[1];
  const { content, win, doc } = await mounted(m.corpus, routeHash('paths', first.id));
  doc.getElementById('search').value = 'upstream compromise';
  await doc.getElementById('search').trigger('input');
  const node = descendants(content).find(n => n.getAttribute('data-member-path') === other.id && n.getAttribute('data-entity-kind') === 'node');
  await node.trigger('keydown', { key: 'Enter' });
  const hash = win.location.hash, state = structuredClone(win.history.state);
  const reload = await mounted(m.corpus, hash, state);
  assert.doesNotMatch(reload.content.textContent, /target outside the active filters/);
  const inspection = descendants(reload.content).find(n => n.className === 'graph-inspection');
  assert.ok(inspection.textContent.startsWith(other.nodes[0].title));
  await button(inspection, m.claims.get('synthetic-claim-b').description).trigger('click');
  await button(reload.content, 'Return to selected path element').trigger('click');
  assert.equal(reload.win.location.hash, hash);
  assert.equal(reload.doc.getElementById('search').value, 'upstream compromise');
  assert.doesNotMatch(reload.content.textContent, /target outside the active filters/);
  reload.win.location.hash = hash; reload.win.history.state = state;
  await reload.win.listeners.popstate();
  assert.ok(descendants(reload.content).some(n => n.getAttribute('class') === 'research-graph'));
});

test('Issue #51 AC-04 compact controls focus selection, bound zoom, close movement menu and deterministically reset', async () => {
  const m = multiPhaseModel(), before = digest(m.corpus), root = renderExploration(new FakeDocument(), m, 'paths', {}, () => {});
  const svg = descendants(root).find(n => n.getAttribute('class') === 'research-graph');
  svg.getBoundingClientRect = () => ({ width: 317, height: 420 });
  await button(root, 'Full campaign overview').trigger('click');
  const initial = svg.getAttribute('viewBox'), fitWidth = Number(initial.split(' ')[2]);
  const control = name => descendants(root).find(n => n.getAttribute('aria-label') === name);
  await control('Focus selection').trigger('click');
  assert.ok(Number(svg.getAttribute('viewBox').split(' ')[2]) < fitWidth);
  for (let i = 0; i < 100; i++) await control('Zoom in').trigger('click');
  assert.equal(Number(svg.getAttribute('viewBox').split(' ')[2]) / fitWidth, .12);
  for (let i = 0; i < 100; i++) await control('Zoom out').trigger('click');
  assert.equal(Number(svg.getAttribute('viewBox').split(' ')[2]) / fitWidth, 4);
  const menu = descendants(root).find(n => n.className === 'graph-movement');
  menu.open = true;
  const toolbar = descendants(root).find(n => n.className === 'graph-icon-toolbar');
  await toolbar.trigger('keydown', { key: 'Escape' });
  assert.equal(menu.open, false);
  await control('Reset layout').trigger('click');
  assert.equal(svg.getAttribute('viewBox'), initial);
  assert.equal(digest(m.corpus), before);
  const labels = descendants(root).filter(n => n.getAttribute('class') === 'node-status');
  assert.ok(labels.every(n => n.textContent.length <= 42 && n.textContent.endsWith('unreviewed')));
});

  test('AP-01/02/04 node routes, no-path state and directed graph inspection stay in case scope', async () => {
    const m = branchingModel(), calls = [], p = m.corpus.paths[0];
    const root = renderExploration(new FakeDocument(), m, 'paths', { cases: [p.caseId] }, (...args) => calls.push(args), p.id, null, p.nodes[0].id);
    assert.match(root.textContent, /Research exercise.*composite/);
    assert.match(root.textContent, /line style does not establish evidence strength/i);
    assert.ok(root.textContent.includes(p.nodes[0].title));
    assert.equal(descendants(root).filter(n => n.getAttribute('data-entity-kind') === 'edge').length, 4);
    const nodeControl = descendants(root).find(n => n.tagName === 'BUTTON'
      && n.textContent === 'Synthetic disconnected or branching node 7');
    assert.ok(nodeControl);
    assert.equal(nodeControl.getAttribute('aria-pressed'), 'false');
    await nodeControl.trigger('click');
    assert.equal(nodeControl.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(calls.at(-1), ['paths', p.id, 'branch-7']);
    const edge = descendants(root).find(n => n.getAttribute('data-entity-id') === 'branch');
    await edge.trigger('keydown', { key: 'Enter' });
    assert.match(root.textContent, /Reconstructed synthetic sequence/);
    const inspection = descendants(root).find(n => n.className === 'graph-inspection');
    assert.match(inspection.textContent, /Node support does not establish this relationship/);
    assert.match(inspection.textContent, /Conflicting claims/);
    assert.equal(descendants(root).filter(n => n.tagName === 'SCRIPT').length, 0);
    const missing = renderExploration(new FakeDocument(), m, 'paths', {}, () => {}, p.id, null, 'retired-node');
    assert.match(missing.textContent, /Unknown or retired node\/relationship/);
    assert.equal(descendants(missing).filter(n => n.className === 'research-graph').length, 0);
    const empty = renderExploration(new FakeDocument(), m, 'paths', { cases: ['synthetic-case-b'] }, () => {});
    assert.match(empty.textContent, /No authored attack paths/);
    assert.ok(empty.textContent.includes(m.corpus.claims.find(c => c.caseId === 'synthetic-case-b').description));
    p.nodes[0].claimIds.push('synthetic-claim-c');
    const scoped = renderExploration(new FakeDocument(), m, 'paths', {}, () => {}, p.id);
    const scopedInspection = descendants(scoped).find(n => n.className === 'graph-inspection');
    assert.match(scopedInspection.textContent, /outside this case.*No support inferred/);
    assert.ok(!scopedInspection.textContent.includes(m.claims.get('synthetic-claim-c').description));
  });

  test('AP-03 node mappings require exact support and retained catalog pins, with broad and unresolved separated', () => {
    const m = branchingModel(), p = m.corpus.paths[0], n = p.nodes[0], base = m.corpus.mappings[0];
    const pin = catalogSnapshot().catalogs.find(c => c.framework === 'ATT&CK');
    const technique = pin.techniques[0];
    m.corpus.frameworks.push({ id: technique.id, framework: pin.framework, version: pin.version, name: technique.name });
    const valid = { ...base, id: 'node-mapping', pathId: p.id, nodeId: n.id, framework: pin.framework, version: pin.version, techniqueId: technique.id };
    m.corpus.mappings.push(valid);
    m.corpus.governance.campaignExtraction = { runs: [{ caseId: p.caseId, catalogSnapshot: { catalogs: [pin] },
      unresolvedMappings: [{ ...valid, id: 'unresolved', techniqueLiteral: 'literal-unresolved', supportingClaimIds: n.claimIds, reason: 'No official match' }] }] };
    assert.equal(nodeMappings(m, p, n).nodeScoped.length, 1);
    assert.equal(nodeMappings(m, p, n).broad.length, 1);
    assert.equal(nodeMappings(m, p, n).unresolved.length, 1);
    for (const change of [
      { claimIds: [...n.claimIds, 'synthetic-claim-b'] }, { claimIds: [] }, { claimIds: ['synthetic-claim-c'] },
      { caseId: 'synthetic-case-b' }, { behaviorId: 'not-on-node' }, { version: 'wrong-version' },
      { techniqueId: 'not-in-catalog' }, { nodeId: undefined },
    ]) {
      Object.assign(valid, { ...base, pathId: p.id, nodeId: n.id, framework: pin.framework, version: pin.version, techniqueId: technique.id }, change);
      assert.equal(nodeMappings(m, p, n).nodeScoped.length, 0, JSON.stringify(change));
    }
    const root = renderExploration(new FakeDocument(), m, 'paths', {}, () => {}, p.id);
    assert.match(root.textContent, /No node-scoped candidate recorded/);
    assert.match(root.textContent, /Broader behavior\/case candidates/);
    assert.match(root.textContent, /literal-unresolved/);
  });

  test('AP-05/06 graph controls preserve entities, selection, cancellation and corpus identity', async () => {
    const m = branchingModel(), before = digest(m.corpus), root = renderExploration(new FakeDocument(), m, 'paths', {}, () => {});
    const svg = descendants(root).find(n => n.className === 'research-graph' || n.getAttribute('class') === 'research-graph');
    const nodes = descendants(svg).filter(n => n.getAttribute('data-entity-kind') === 'node');
    await button(root, 'Full campaign overview').trigger('click');
    const initial = svg.getAttribute('viewBox'), transforms = nodes.map(n => n.getAttribute('transform'));
    await nodes.at(-1).trigger('keydown', { key: ' ' });
    assert.equal(nodes.at(-1).getAttribute('aria-pressed'), 'true');
    await button(root, 'Move selected node right').trigger('click');
    assert.notEqual(nodes.at(-1).getAttribute('transform'), transforms.at(-1));
    await button(root, 'Pan left').trigger('click');
    await button(root, 'Zoom in').trigger('click');
    assert.notEqual(svg.getAttribute('viewBox'), initial);
    assert.equal(descendants(svg).filter(n => n.getAttribute('data-entity-kind') === 'node').at(-1), nodes.at(-1));
    let captured, released;
    svg.setPointerCapture = id => { captured = id; };
    svg.releasePointerCapture = id => { released = id; };
    svg.getBoundingClientRect = () => ({ width: 920, height: 430 });
    const grip = descendants(nodes[0]).find(n => n.getAttribute('data-drag-node'));
    await svg.trigger('pointerdown', { target: grip, pointerId: 7, clientX: 20, clientY: 20, button: 0 });
    assert.equal(captured, 7);
    await svg.trigger('pointermove', { pointerId: 8, clientX: 900, clientY: 900 });
    assert.equal(nodes[0].getAttribute('transform'), transforms[0]);
    await svg.trigger('pointermove', { pointerId: 7, clientX: 40, clientY: 40 });
    const moved = nodes[0].getAttribute('transform');
    await svg.trigger('pointercancel', { pointerId: 7 });
    assert.equal(released, 7);
    await svg.trigger('pointermove', { pointerId: 7, clientX: 100, clientY: 100 });
    assert.equal(nodes[0].getAttribute('transform'), moved);
    await nodes[0].trigger('click');
    assert.equal(nodes.at(-1).getAttribute('aria-pressed'), 'true', 'drag/cancel must not select another entity');
    await button(root, 'Reset layout').trigger('click');
    assert.equal(svg.getAttribute('viewBox'), initial);
    assert.deepEqual(nodes.map(n => n.getAttribute('transform')), transforms);
    assert.equal(digest(m.corpus), before);
    assert.ok(descendants(root).some(n => n.getAttribute('role') === 'status' && n.getAttribute('aria-live') === 'polite'));
  });

  test('AP-08 private talk exports preserve path semantics, closure and exact scoped mapping metadata', () => {
    const m = branchingModel(), p = m.corpus.paths[0];
    const bundle = talkBundle(m, p.caseId), markdown = talkMarkdown(bundle);
    assert.deepEqual(bundle.paths, [p]);
    assert.ok(bundle.revisionProvenance.some(r => r.id === m.claims.get(p.nodes[0].claimIds[0]).sourceRevisionId));
    for (const value of [p.nodes[0].title, p.edges[1].basis, p.edges[3].id, 'composite', 'Broader behavior/case', 'Synthetic sample', 'Uncertainty', 'Conflicts']) {
      assert.ok(markdown.includes(value.replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&')), value);
    }
    assert.ok(!bundle.claims.some(c => c.caseId !== p.caseId));
    assert.doesNotMatch(markdown, /<script>/);
    assert.equal(bundle.private, true);
  });
class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
    this.nodes = new Map(['status', 'stats', 'views', 'toolbar', 'search', 'tag-mode', 'reset', 'facets', 'result', 'content', 'demo', 'reload-corpus', 'skip-content']
      .map(id => [id, new FakeElement(id === 'search' ? 'input' : 'div')]));
  }
  createElement(tag) { return new FakeElement(tag); }
  getElementById(id) { return this.nodes.get(id); }
}
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function button(node, label) { return descendants(node).find(n => n.tagName === 'BUTTON' && n.textContent.includes(label)); }
function fakeWindow(hash = '') {
  const win = { location: { hash }, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
  win.history = {
    pushState(state, _title, value) { this.state = state; win.location.hash = value; },
    replaceState(state, _title, value) { this.state = state; win.location.hash = value; },
  };
  return win;
}

test('#85 AC-01/07 staged handoff validates before explicit apply and clears validation on candidate replacement', async () => {
  const state = createStudio(fresh()), calls = [];
  state.campaign.caseId = 'synthetic-case-a'; state.campaign.preparedCaseId = 'synthetic-case-a';
  state.campaign.stageKind = 'ground';
  state.campaign.preparedRequest = { schemaVersion: 'campaign-stage-request/1', requestHash: 'synthetic-stage' };
  state.campaign.candidate = { schemaVersion: 'campaign-stage-candidate/1', requestHash: 'synthetic-stage' };
  const render = () => renderCampaignEnrichment(new FakeDocument(), fakeWindow(), state, {
    enabled: true, stageOperation: async (command, input) => {
      calls.push({ command, input }); return { status: 'succeeded', summary: { kind: 'ground', processing: [] } };
    },
  });
  let root = render();
  assert.equal(button(root, 'Explicitly apply validated stage').disabled, true);
  await button(root, 'Validate stage candidate').trigger('click');
  assert.deepEqual(calls.map(c => c.command), ['validate']);
  root = render();
  assert.equal(button(root, 'Explicitly apply validated stage').disabled, false);
  assert.match(root.textContent, /application will recheck freshness/);
  await button(root, 'Explicitly apply validated stage').trigger('click');
  assert.deepEqual(calls.map(c => c.command), ['validate', 'apply']);
  assert.equal(state.campaign.candidate, null);
  state.campaign.candidate = { schemaVersion: 'campaign-stage-candidate/1', requestHash: 'another' };
  assert.equal(button(render(), 'Explicitly apply validated stage').disabled, true);
});

function reviewFixture() {
  const corpus = structuredClone(researchFixture), passage = corpus.passages[0], claim = corpus.claims[0];
  // Keep the research article distinct from the fixture's catalog metadata source.
  corpus.sources.push({ ...structuredClone(corpus.sources[0]), id: 'synthetic-catalog-only', revisionIds: [] });
  for (const framework of corpus.frameworks) framework.sourceId = 'synthetic-catalog-only';
  const annotations = [{ id: 'synthetic-review-tool', type: 'commands-ai-artifacts', value: passage.text,
    normalizedValue: 'Original proposed identity', caseId: claim.caseId, sourceId: claim.sourceId,
    sourceRevisionId: claim.sourceRevisionId, origin: 'manual', status: 'pending', evidenceStatus: 'evidence-backed',
    claimIds: [claim.id], support: { quote: passage.text, locator: { start: passage.start, end: passage.end } },
    context: { artifactKind: 'ide-cli', artifactUsage: 'general-mention' } }];
  const snapshot = () => ({ ...reviewSnapshot(corpus, annotations), campaigns: {}, sources: {} });
  const decide = (itemKey, action = 'accept', extra = {}) => {
    const state = snapshot(), unit = state.units.find(u => u.itemKey === itemKey);
    return applyItemReview(corpus, { snapshot: state.snapshot, itemKey, action, guideVersion: GUIDE_VERSION,
      reviewer: 'synthetic-human', selfAttested: true, ...(action === 'accept' ? { confirmation: confirmationFor(unit) } : {}), ...extra }, annotations);
  };
  return { corpus, annotations, snapshot, decide, key: `annotations:${annotations[0].id}`, claimKey: `claims:${claim.id}` };
}
function reviewView(fixture, itemKey, change = () => {}, nav = {}) {
  const model = createModel(fixture.corpus), state = fixture.snapshot();
  return renderReview(new FakeDocument(), model, state, { caseId: fixture.corpus.cases[0].id, itemKey, ...nav },
    { change, decide: () => {}, navigate: () => {} });
}
test('Issue #81 review correction: human-edited tool identity is consistent in Review, library and campaign/blog cards without product merging', () => {
  const f = reviewFixture(); f.decide(f.claimKey);
  f.decide(f.key, 'modify', { patch: { normalizedValue: 'Claude Code' }, rationale: 'Synthetic identity correction.' });
  f.decide(f.key);
  const model = createModel(f.corpus); model.annotations = f.annotations; model.itemReview = f.snapshot();
  const projected = applyReviewProjection(model), doc = new FakeDocument();
  const [entry] = aiLibrary(projected, 'tools');
  assert.equal(entry.name, 'Claude Code');
  assert.equal(entry.annotations[0].value, f.annotations[0].value);
  assert.match(entry.basis, /no automatic product merge/);
  assert.match(reviewView(f, f.key).textContent, /Identity: Claude Code/);
  const library = renderExploration(doc, projected, 'tools', {}, () => {});
  assert.ok(descendants(library).some(n => n.tagName === 'H2' && n.textContent === 'Claude Code'));
  assert.match(library.textContent, /Café/);
  for (const view of [
    renderCaseLibrary(doc, projected, projected.corpus.cases, () => {}),
    renderResearchLibrary(doc, projected, projected.corpus.sources, () => {}),
  ]) assert.ok(button(view, 'Claude Code'));
  projected.annotations.push({ ...f.annotations[0], id: 'separate-original-occurrence', value: 'Claude Code' });
  assert.equal(aiLibrary(projected, 'tools').length, 2);
  const unedited = createModel(f.corpus); unedited.annotations = f.annotations;
  assert.equal(aiLibrary(unedited, 'tools')[0].name, f.annotations[0].value);
});

test('Issue #81 review correction: current Accepted and Excluded are human-reviewed; stale decisions are not', () => {
  const f = reviewFixture(); f.decide(f.claimKey);
  assert.match(reviewView(f, f.claimKey).textContent, /Human-reviewed · Accepted/);
  f.decide(f.claimKey, 'exclude', { exclusionReason: 'unsupported' });
  assert.match(reviewView(f, f.claimKey).textContent, /Human-reviewed · Excluded/);
  f.corpus.claims[0].description += ' Changed proposal.';
  assert.match(reviewView(f, f.claimKey).textContent, /Not currently human-reviewed/);
  assert.doesNotMatch(reviewView(f, f.claimKey).textContent, /Human-reviewed · (Accepted|Excluded)/);
});

test('Issue #81 review correction: exact repeated passages render once, retaining attribution and distinct revisions/locations', () => {
  const f = reviewFixture(), view = reviewView(f, f.key);
  assert.equal(descendants(view).filter(n => n.tagName === 'BLOCKQUOTE' && n.textContent === f.annotations[0].value).length, 1);
  assert.match(view.textContent, /Source passage: synthetic-passage-a/);
  assert.match(view.textContent, /Direct annotation support · Same exact passage/);
  assert.ok(button(view, `Review supporting item: ${f.claimKey}`));
  const state = f.snapshot(), target = state.units.find(u => u.itemKey === f.key);
  target.evidence.push({ ...target.evidence[0], id: 'distinct-location',
    passage: { ...target.evidence[0].passage, start: 20, end: 24 } });
  target.evidence.push({ ...target.evidence[0], id: 'distinct-revision', revisionId: 'other-revision' });
  const distinct = renderReview(new FakeDocument(), createModel(f.corpus), state,
    { caseId: f.corpus.cases[0].id, itemKey: f.key }, { change() {}, decide() {}, navigate() {} });
  assert.equal(descendants(distinct).filter(n => n.tagName === 'BLOCKQUOTE').length, 3);
});

test('Issue #81 review correction: nested support navigation and reload restore priority workload/category/group/source/filter', async () => {
  const f = reviewFixture(), doc = new FakeDocument(), win = fakeWindow('#review/synthetic-case-a');
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  win.localStorage = storage; win.sessionStorage = storage;
  const nav = { caseId: 'synthetic-case-a', queue: 'priority', category: 'tools', group: 'blog',
    sourceId: 'synthetic-source-a', filter: 'Blocked/support changed', type: '', itemKey: f.key, mode: '' };
  reviewNavigation(storage, nav); reviewSession(win, { reviewer: 'synthetic-human', selfAttested: true });
  const nested = supportNavigation({ ...nav, ...supportNavigation(nav, f.claimKey, f.key) }, 'claims:nested', f.claimKey);
  const firstReturn = returnFromSupport(nested);
  assert.equal(firstReturn.itemKey, f.claimKey);
  assert.deepEqual(returnFromSupport({ ...nested, ...firstReturn }), { ...nav, supportTrail: [] });
  let posts = 0;
  const fetcher = async (endpoint, options = {}) => {
    if (endpoint === '/api/review' && options.method === 'POST') {
      posts++; applyItemReview(f.corpus, JSON.parse(options.body), f.annotations); return response({});
    }
    if (endpoint === '/api/review') return response(f.snapshot());
    if (endpoint === '/api/enrichment') return response({ schemaVersion: 'talk-enrichment/1', annotations: f.annotations });
    return response(structuredClone(f.corpus), 200, true);
  };
  const app = mountWorkbench(doc, win, fetcher); await app.ready;
  const content = doc.getElementById('content');
  await button(content, `Review supporting item: ${f.claimKey}`).trigger('click');
  assert.equal(reviewNavigation(storage).queue, 'all');
  assert.equal(posts, 0);
  // Reload while on the support item: both the return context and identity survive.
  const reloadDoc = new FakeDocument(), reloaded = mountWorkbench(reloadDoc, win, fetcher); await reloaded.ready;
  await button(reloadDoc.getElementById('content'), 'Accept item — I confirm').trigger('click');
  assert.equal(posts, 1);
  assert.deepEqual(reviewNavigation(storage), { ...nav, supportTrail: [] });
  assert.equal(f.snapshot().units.find(u => u.itemKey === f.key).eligible, false);
  assert.equal(f.snapshot().units.find(u => u.itemKey === f.claimKey).state, 'Accepted');
});
function response(corpus = fresh(), status = 200, collectionEnabled = false) {
  return { ok: status === 200, status, headers: { get: key => key === 'x-collection-enabled' && collectionEnabled ? 'true' : null },
    async json() { return corpus; } };
}
async function mounted(corpus = fresh(), hash = '', historyState = null) {
  const doc = new FakeDocument(), win = fakeWindow(hash), requests = [];
  win.history.state = structuredClone(historyState);
  const app = mountWorkbench(doc, win, async (path, options) => { requests.push([path, options]); return response(structuredClone(corpus)); });
  await app.ready;
  return { doc, win, app, requests, content: doc.getElementById('content') };
}

test('AP-01/07 graph search reveals linked evidence and restores context on reload and back/forward', async () => {
  const corpus = branchingModel().corpus, p = corpus.paths[0];
  const { doc, win, content } = await mounted(corpus, routeHash('paths', p.id, 'branch-7'));
  doc.getElementById('search').value = 'disconnected';
  await doc.getElementById('search').trigger('input');
  const inspection = descendants(content).find(n => n.className === 'graph-inspection');
  await button(inspection, corpus.claims[0].description).trigger('click');
  const claimHash = win.location.hash, claimState = structuredClone(win.history.state);
  assert.match(content.textContent, /Claim & exact source evidence/);
  assert.equal(doc.getElementById('search').value, '');
  assert.equal(claimState.pathContext.filters.query, 'disconnected');
  assert.deepEqual(claimState.filters.cases, [p.caseId]);
  await button(content, 'Source:').trigger('click');
  assert.match(content.textContent, /Café/);
  assert.ok(!content.textContent.includes(corpus.claims.find(c => c.caseId === 'synthetic-case-b').description));
  const sourceHash = win.location.hash, sourceState = structuredClone(win.history.state);
  const reloaded = await mounted(corpus, sourceHash, sourceState);
  await button(reloaded.content, 'Return to selected path element').trigger('click');
  assert.equal(reloaded.win.location.hash, routeHash('paths', p.id, 'branch-7'));
  assert.equal(reloaded.doc.getElementById('search').value, 'disconnected');
  assert.ok(descendants(reloaded.content).find(n => n.className === 'graph-inspection').textContent.startsWith('Synthetic disconnected or branching node 7'));
  for (const [hash, state] of [[claimHash, claimState], [sourceHash, sourceState]]) {
    reloaded.win.location.hash = hash; reloaded.win.history.state = state;
    await reloaded.win.listeners.popstate();
    assert.ok(button(reloaded.content, 'Return to selected path element'));
    assert.equal(reloaded.doc.getElementById('search').value, '');
    assert.doesNotMatch(reloaded.content.textContent, /No records match/);
  }
  const retired = structuredClone(corpus);
  retired.paths[0].nodes = retired.paths[0].nodes.filter(n => n.id !== 'branch-7');
  const stale = await mounted(retired, claimHash, claimState);
  await button(stale.content, 'Return to selected path element').trigger('click');
  assert.match(stale.content.textContent, /Unknown or retired node\/relationship/);
  assert.equal(descendants(stale.content).filter(n => n.getAttribute('class') === 'research-graph').length, 0);
  const changed = structuredClone(corpus); changed.paths = [];
  const missing = await mounted(changed, claimHash, claimState);
  assert.ok(!button(missing.content, 'Return to selected path element'));
  assert.match(missing.doc.getElementById('status').textContent, /Saved path context.*unavailable/);
  const invalid = await mounted(corpus, claimHash, { ...claimState, pathContext: { ...claimState.pathContext, filters: { cases: ['synthetic-case-b'] } } });
  assert.ok(!button(invalid.content, 'Return to selected path element'));
});

test('AP-01/07 source revision changes retain path context through reload and back/forward', async () => {
  const corpus = branchingModel().corpus, p = corpus.paths[0], claim = corpus.claims[0];
  const revision = { ...structuredClone(corpus.sourceRevisions.find(r => r.id === claim.sourceRevisionId)),
    id: 'synthetic-new-revision', normalizedContent: 'Synthetic newer snapshot.' };
  corpus.sourceRevisions.push(revision);
  corpus.sources.find(s => s.id === claim.sourceId).revisionIds.push(revision.id);
  const before = digest(corpus);
  const { doc, win, content } = await mounted(corpus, routeHash('paths', p.id, 'branch-7'));
  doc.getElementById('search').value = 'disconnected';
  await doc.getElementById('search').trigger('input');
  const inspection = descendants(content).find(n => n.className === 'graph-inspection');
  await button(inspection, claim.description).trigger('click');
  const claimHash = win.location.hash, claimState = structuredClone(win.history.state);
  await button(content, 'Source:').trigger('click');
  const sourceState = structuredClone(win.history.state);
  const select = descendants(content).find(n => n.tagName === 'SELECT' && n.children.some(o => o.value === revision.id));
  select.value = revision.id;
  await select.trigger('change');
  const revisionHash = routeHash('sources', claim.sourceId, revision.id);
  assert.equal(win.location.hash, revisionHash);
  assert.deepEqual(win.history.state, sourceState);
  assert.match(content.textContent, /Synthetic newer snapshot/);
  const reloaded = await mounted(corpus, revisionHash, win.history.state);
  assert.ok(button(reloaded.content, 'Return to selected path element'));
  assert.match(reloaded.content.textContent, /Synthetic newer snapshot/);
  assert.ok(!reloaded.content.textContent.includes(corpus.claims.find(c => c.caseId === 'synthetic-case-b').description));
  for (const [hash, state] of [[claimHash, claimState], [revisionHash, sourceState]]) {
    reloaded.win.location.hash = hash;
    reloaded.win.history.state = structuredClone(state);
    await reloaded.win.listeners.popstate();
    assert.ok(button(reloaded.content, 'Return to selected path element'));
    assert.deepEqual(reloaded.win.history.state.filters.cases, [p.caseId]);
  }
  await button(reloaded.content, 'Return to selected path element').trigger('click');
  assert.equal(reloaded.win.location.hash, routeHash('paths', p.id, 'branch-7'));
  assert.equal(reloaded.doc.getElementById('search').value, 'disconnected');
  assert.ok(descendants(reloaded.content).find(n => n.className === 'graph-inspection').textContent.startsWith('Synthetic disconnected or branching node 7'));
  assert.equal(digest(reloaded.app.getModel().corpus), before);

  // Ordinary source navigation still carries no path context and retains its selected revision.
  const plain = await mounted(corpus, routeHash('sources', claim.sourceId, claim.sourceRevisionId));
  const plainSelect = descendants(plain.content).find(n => n.tagName === 'SELECT' && n.children.some(o => o.value === revision.id));
  plainSelect.value = revision.id;
  await plainSelect.trigger('change');
  assert.equal(plain.win.history.state, null);
  assert.equal(plain.win.location.hash, revisionHash);
  const plainReload = await mounted(corpus, revisionHash, plain.win.history.state);
  assert.match(plainReload.content.textContent, /Synthetic newer snapshot/);
  assert.ok(!button(plainReload.content, 'Return to selected path element'));
});

test('AP-05 extreme pointer and repeated button movement are bounded with capture-loss and reset', async () => {
  const m = branchingModel(), before = digest(m.corpus), root = renderExploration(new FakeDocument(), m, 'paths', {}, () => {});
  const svg = descendants(root).find(n => n.getAttribute('class') === 'research-graph');
  const node = descendants(svg).find(n => n.getAttribute('data-entity-kind') === 'node');
  await button(root, 'Full campaign overview').trigger('click');
  node.focus();
  const initial = svg.getAttribute('viewBox').split(' ').map(Number), transform = node.getAttribute('transform');
  const [x, y, w, h] = initial, coordinates = () => node.getAttribute('transform').match(/-?[\d.]+/g).map(Number);
  const assertBounds = () => {
    const [bx, by, bw, bh] = svg.getAttribute('viewBox').split(' ').map(Number), [nx, ny] = coordinates();
    assert.ok(bx + bw / 2 >= x - w / 2 && bx + bw / 2 <= x + w * 1.5);
    assert.ok(by + bh / 2 >= y - h / 2 && by + bh / 2 <= y + h * 1.5);
    assert.ok(nx >= x - w && nx <= x + 2 * w - 240);
    assert.ok(ny >= y - h && ny <= y + 2 * h - 105);
  };
  for (const direction of ['right', 'down', 'left', 'up']) {
    for (let i = 0; i < 120; i++) {
      await button(root, `Pan ${direction}`).trigger('click');
      await button(root, `Move selected node ${direction}`).trigger('click');
    }
    assertBounds();
  }
  svg.getBoundingClientRect = () => ({ width: 920, height: 430 });
  svg.setPointerCapture = () => {};
  svg.releasePointerCapture = () => {};
  const grip = descendants(node).find(n => n.getAttribute('data-drag-node'));
  for (const target of [svg, grip]) for (const extreme of [-1e9, 1e9]) {
    await svg.trigger('pointerdown', { target, pointerId: 4, clientX: 0, clientY: 0, button: 0 });
    await svg.trigger('pointermove', { pointerId: 4, clientX: extreme, clientY: extreme });
    assertBounds();
    await svg.trigger('lostpointercapture', { pointerId: 4 });
    const stopped = [svg.getAttribute('viewBox'), node.getAttribute('transform')];
    await svg.trigger('pointermove', { pointerId: 4, clientX: -extreme, clientY: -extreme });
    assert.deepEqual([svg.getAttribute('viewBox'), node.getAttribute('transform')], stopped);
  }
  assert.equal(node.focused, true);
  assert.equal(node.getAttribute('aria-pressed'), 'true');
  await button(root, 'Reset layout').trigger('click');
  assert.deepEqual(svg.getAttribute('viewBox').split(' ').map(Number), initial);
  assert.equal(node.getAttribute('transform'), transform);
  assert.equal(digest(m.corpus), before);
});

test('AP-01/06/07 routed selection and evidence traversal preserve case, filters and return target', async () => {
  const corpus = branchingModel().corpus, p = corpus.paths[0];
  const { doc, win, app, content } = await mounted(corpus, routeHash('paths', p.id, 'branch-7'));
  const inspection = () => descendants(content).find(n => n.className === 'graph-inspection');
  assert.ok(inspection().textContent.startsWith('Synthetic disconnected or branching node 7'));
  const entity = descendants(content).find(n => n.getAttribute('data-entity-id') === 'branch-7');
  await entity.trigger('keydown', { key: 'Enter' });
  assert.equal(descendants(content).find(n => n.getAttribute('data-entity-id') === 'branch-7'), entity);
  assert.equal(win.location.hash, routeHash('paths', p.id, 'branch-7'));
  const contextState = win.history.state;
  await button(inspection(), corpus.claims[0].description).trigger('click');
  assert.match(content.textContent, /Claim & exact source evidence/);
  assert.ok(!content.textContent.includes(corpus.claims.find(c => c.caseId === 'synthetic-case-b').description));
  assert.deepEqual(win.history.state.filters.cases, [p.caseId]);
  await button(content, 'Return to selected path element').trigger('click');
  assert.equal(win.location.hash, routeHash('paths', p.id, 'branch-7'));
  assert.ok(inspection().textContent.startsWith('Synthetic disconnected or branching node 7'));
  win.history.state = contextState;
  await win.listeners.popstate();
  assert.ok(inspection().textContent.startsWith('Synthetic disconnected or branching node 7'));
  await button(inspection(), 'Benign tool invocation').trigger('click');
  assert.match(content.textContent, /Broader behavior\/case candidate/);
  assert.match(content.textContent, /Proposed security telemetry/);
  await button(content, 'Proposed OTEL instrumentation').trigger('click');
  assert.match(content.textContent, /Synthetic sample · not incident telemetry/);
  await button(content, 'Return to selected path element').trigger('click');
  assert.equal(win.location.hash, routeHash('paths', p.id, 'branch-7'));
  assert.equal(digest(app.getModel().corpus), digest(corpus));
});

test('AP-07 shared behavior and detection-only routes do not borrow another case support', () => {
  const m = branchingModel(), b = m.corpus.behaviors[0];
  b.claimIds = ['synthetic-claim-a', 'synthetic-claim-c'];
  const root = renderExploration(new FakeDocument(), m, 'behaviors', { cases: ['synthetic-case-a'] }, () => {}, b.id);
  assert.ok(!root.textContent.includes(m.claims.get('synthetic-claim-c').description));
  m.corpus.telemetry = [];
  const detection = renderExploration(new FakeDocument(), m, 'telemetry', { cases: ['synthetic-case-a'] }, () => {}, m.corpus.detections[0].id);
  assert.doesNotMatch(detection.textContent, /Unknown target/);
  assert.match(detection.textContent, /Untested hypothesis/);
});

test('model accepts the 0.3.0 core-only contract without enrichment', () => {
  const m = model(); assert.equal(m.cases.size, 2); assert.equal(m.sources.size, 2);
  assert.equal(m.corpus.paths, undefined);
});
test('model rejects legacy data and missing core arrays', () => {
  assert.throws(() => createModel({ ...fresh(), schemaVersion: '0.2.0' }), /0.3.0/);
  const corpus = fresh(); delete corpus.claims;
  assert.throws(() => createModel(corpus), /0.3.0/);
});
test('missing metadata preserves null reasons rather than manufacturing values', () => {
  assert.equal(metadata(fixture.sources[0], 'publisher'), 'Not available (unknown)');
  assert.equal(metadata(fixture.sources[0], 'author'), 'Not available (not_reported)');
  assert.equal(metadata(fixture.claims[2], 'uncertainty'), 'Not available (unknown)');
});
test('date labels preserve day/month/year/range/unknown precision and types', () => {
  assert.match(dateLabel(fixture.sources[0].publicationDate), /2024-02-29 · day precision/);
  assert.match(dateLabel(fixture.timelines[2].date), /2025-06 · month/);
  assert.match(dateLabel(fixture.timelines[3].date), /2025 · year/);
  assert.match(dateLabel(fixture.timelines[4].date), /2025-06 – 2025-08 · range/);
  assert.equal(dateLabel(fixture.timelines[1].date), 'Unknown (not_reported)');
});
test('case association includes all claims and keeps shared source cases separate', () => {
  const m = model();
  assert.deepEqual(caseSourceIds(m, 'synthetic-case-a'), ['synthetic-source-a', 'synthetic-source-b']);
  assert.deepEqual(caseSourceIds(m, 'synthetic-case-b'), ['synthetic-source-a']);
  assert.deepEqual(recordContext(m, 'sources', m.sources.get('synthetic-source-a')).cases,
    ['synthetic-case-a', 'synthetic-case-b']);
  assert.equal(filterRecords(m, 'cases').length, 2);
});
test('case source association includes categorization source basis', () => {
  const corpus = fresh();
  corpus.cases[1].sourceIds = [];
  corpus.categorizations[3].sourceIds = ['synthetic-source-b'];
  assert.deepEqual(caseSourceIds(createModel(corpus), 'synthetic-case-b'), ['synthetic-source-a', 'synthetic-source-b']);
});
test('exact claim target retains an older source revision', () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'new-revision', normalizedContent: 'New text' });
  corpus.sources[0].revisionIds.push('new-revision');
  const m = createModel(corpus);
  assert.equal(claimTarget(m, 'synthetic-claim-a').revisionId, 'synthetic-revision-a');
  assert.equal(linkedClaims(m, 'synthetic-source-a', 'new-revision').length, 0);
  assert.equal(linkedClaims(m, 'synthetic-source-a', 'synthetic-revision-a').length, 3);
  assert.equal(claimTarget(m, 'missing'), null);
});
test('inference support is not conflated with own quoted passages', () => {
  const m = model(), inference = m.claims.get('synthetic-claim-inference');
  assert.deepEqual(inference.passageIds, []);
  assert.deepEqual(inference.inference.supportingClaimIds, ['synthetic-claim-a', 'synthetic-claim-b']);
  assert.equal(claimTarget(m, inference.inference.supportingClaimIds[1]).sourceId, 'synthetic-source-b');
});
test('Unicode half-open code point segments preserve emoji and combining marks', () => {
  const text = '😀 e\u0301 🧑‍💻!';
  const segments = passageSegments(text, [
    { id: 'accent', start: 2, end: 4 }, { id: 'emoji', start: 5, end: 8 },
  ]);
  assert.equal(segments.map(s => s.text).join(''), text);
  assert.equal(segments.find(s => s.passageIds.includes('accent')).text, 'e\u0301');
  assert.equal(segments.find(s => s.passageIds.includes('emoji')).text, '🧑‍💻');
});
test('overlapping, duplicate and nested passages retain every membership', () => {
  const segments = passageSegments('😀abcde', [
    { id: 'outer', start: 0, end: 5 }, { id: 'middle', start: 2, end: 4 },
    { id: 'duplicate', start: 2, end: 4 }, { id: 'overlap', start: 3, end: 6 },
  ]);
  assert.deepEqual(segments.find(s => s.text === 'c').passageIds, ['outer', 'middle', 'duplicate', 'overlap']);
  assert.deepEqual(segments.at(-1).passageIds, ['overlap']);
  assert.equal(segments.map(s => s.text).join(''), '😀abcde');
});
test('invalid intervals never truncate source text or become highlights', () => {
  const segments = passageSegments('😀ab', [
    { id: 'bad', start: -1, end: 2 }, { id: 'long', start: 1, end: 9 },
    { id: 'zero', start: 1, end: 1 }, { id: 'fraction', start: 1.5, end: 2 },
  ]);
  assert.deepEqual(segments, [{ start: 0, end: 3, text: '😀ab', passageIds: [] }]);
  assert.deepEqual(passageSegments(null, []), []);
});
test('reciprocal conflicts render once and remain visible from either selected side', () => {
  const m = model();
  assert.equal(conflictPairs(m).length, 1);
  assert.equal(conflictPairs(m, ['synthetic-claim-b']).length, 1);
  assert.equal(conflictPairs(m, ['synthetic-claim-c']).length, 0);
});
test('multiple contradiction targets are preserved rather than merged', () => {
  const corpus = fresh();
  corpus.claims[0].conflictsWith.push('synthetic-claim-c');
  corpus.claims[2].conflictsWith.push('synthetic-claim-a');
  assert.equal(conflictPairs(createModel(corpus)).length, 2);
});
test('search finds sources without any case association, including normalized text', () => {
  const corpus = fresh();
  corpus.sources.push({ ...corpus.sources[0], id: 'orphan', title: 'Standalone archival note', revisionIds: ['orphan-rev'] });
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'orphan-rev', sourceId: 'orphan', normalizedContent: 'unique archival word' });
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'sources', { query: 'archival word' })[0].id, 'orphan');
  assert.deepEqual(recordContext(m, 'sources', m.sources.get('orphan')).cases, []);
  assert.equal(filterRecords(m, 'sources').length, 3);
});
test('source and publisher facets have OR semantics within, AND across facets', () => {
  const m = model();
  assert.equal(filterRecords(m, 'sources', { publishers: ['(Unknown publisher)', 'Synthetic publisher'] }).length, 2);
  assert.equal(filterRecords(m, 'sources', { publishers: ['Synthetic publisher'], cases: ['synthetic-case-b'] }).length, 0);
  assert.equal(filterRecords(m, 'sources', { sources: ['synthetic-source-a'], cases: ['synthetic-case-b'] }).length, 1);
});
test('tags support explicit OR / AND semantics, distinct case counts and independent source association', () => {
  const corpus = fresh();
  corpus.categorizations.push(
    { ...corpus.categorizations[0], id: 'tag-a', dimension: 'tag', value: 'one' },
    { ...corpus.categorizations[0], id: 'tag-b', dimension: 'tag', value: 'two' },
    { ...corpus.categorizations[3], id: 'tag-c', dimension: 'tag', value: 'one' });
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'cases', { tags: ['one', 'two'], tagMode: 'OR' }).length, 2);
  assert.equal(filterRecords(m, 'cases', { tags: ['one', 'two'], tagMode: 'AND' }).length, 1);
  assert.equal(filterRecords(m, 'sources', { tags: ['two'] }).length, 2);
  assert.deepEqual(facetOptions(m).tags, ['one', 'two']);
});
test('Needs correction, Pending and Excluded remain searchable and filterable', () => {
  const corpus = fresh();
  corpus.claims[0].disposition = 'Needs correction'; corpus.claims[1].disposition = 'Excluded';
  const m = createModel(corpus);
  assert.equal(filterRecords(m, 'claims', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'cases', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'sources', { disposition: ['Needs correction'] }).length, 1);
  assert.equal(filterRecords(m, 'claims', { disposition: ['Excluded'] }).length, 1);
  assert.equal(filterRecords(m, 'claims').length, 4);
});
test('empty filters reset to the complete collection, query AND facets', () => {
  const m = model();
  assert.equal(filterRecords(m, 'cases', { query: 'does not exist' }).length, 0);
  assert.equal(filterRecords(m, 'sources', { query: 'Café', publishers: ['Synthetic publisher'] }).length, 0);
  assert.equal(filterRecords(m, 'cases', {}).length, 2);
});
test('hash routes encode IDs and recover malformed percent sequences / unknown views', () => {
  assert.deepEqual(parseRoute(routeHash('sources', 'source / 雪', 'r#😀')),
    { view: 'sources', id: 'source / 雪', revisionId: 'r#😀' });
  assert.deepEqual(parseRoute('#claims/%ZZ'), { view: 'cases', id: '', revisionId: '' });
  assert.equal(parseRoute('#missing').view, 'cases');
});
test('rendered corpus strings are inert text including HTML, scripts and javascript URLs', () => {
  const corpus = fresh(), attack = '<img src=x onerror=alert(1)><script>bad()</script>&"';
  corpus.sources[0].title = attack; corpus.sources[0].canonicalUrl = 'javascript:alert(1)';
  corpus.sourceRevisions[0].normalizedContent = attack; corpus.claims[0].description = attack;
  corpus.claims[0].uncertainty = attack; corpus.cases[0].summary = attack;
  const doc = new FakeDocument(), m = createModel(corpus);
  const nodes = [
    renderSource(doc, m, corpus.sources[0], '', () => {}, () => {}, () => {}),
    renderClaim(doc, m, corpus.claims[0], () => {}),
    renderCase(doc, m, corpus.cases[0], () => {}),
  ];
  for (const root of nodes) {
    assert.ok(root.textContent.includes(attack));
    assert.ok(!descendants(root).some(n => ['IMG', 'SCRIPT', 'IFRAME'].includes(n.tagName)));
    assert.ok(!descendants(root).some(n => n.attributes.href?.startsWith('javascript:')));
  }
});
test('source text DOM reconstructs exact text and overlapping highlight click exposes all passage IDs', async () => {
  const doc = new FakeDocument(), text = '😀 e\u0301 abc', selected = [];
  const node = renderSourceText(doc, { normalizedContent: text }, [
    { id: 'a', start: 2, end: 7 }, { id: 'b', start: 5, end: 8 },
  ], ids => selected.push(ids));
  assert.equal(node.textContent, text);
  const overlap = descendants(node).find(n => n.tagName === 'BUTTON' && n.attributes['aria-label'].includes('2 linked passages'));
  await overlap.trigger('click');
  assert.deepEqual(selected, [['a', 'b']]);
});
test('null source text gives honest retention reason, no synthesized quote', () => {
  const doc = new FakeDocument();
  const node = renderSourceText(doc, { normalizedContent: null, nullReasons: { normalizedContent: 'not_reported' } },
    [{ id: 'p', start: 0, end: 4, text: 'fake' }], () => {});
  assert.match(node.textContent, /not retained \(not_reported\)/);
  assert.ok(!node.textContent.includes('fake'));
});
test('claim DOM explicitly labels assertions and inferences, rationale and all independent axes', async () => {
  const doc = new FakeDocument(), m = model(), calls = [];
  const inference = renderClaim(doc, m, m.claims.get('synthetic-claim-inference'), (...args) => calls.push(args));
  const assertion = renderClaim(doc, m, m.claims.get('synthetic-claim-a'), () => {});
  assert.match(inference.textContent, /Researcher inference — not a source assertion/);
  assert.match(inference.textContent, /Inference rationale/);
  assert.match(inference.textContent, /Inference support — separate claims/);
  for (const label of ['Origin', 'Evidence status', 'Disposition', 'Uncertainty', 'Source revision']) assert.ok(inference.textContent.includes(label));
  assert.match(assertion.textContent, /Author \/ source assertion/);
  await button(inference, 'Supporting claim: A second').trigger('click');
  assert.deepEqual(calls[0], ['claims', 'synthetic-claim-b']);
});
test('conflict DOM shows side-by-side reciprocal targets and navigation for both', async () => {
  const doc = new FakeDocument(), m = model(), calls = [];
  const root = renderConflicts(doc, m, ['synthetic-claim-a'], (...args) => calls.push(args));
  const pair = root.children.find(c => c.className === 'conflict-pair');
  assert.equal(pair.children.length, 2);
  assert.match(root.textContent, /Neither side is chosen or merged/);
  for (const card of pair.children) await descendants(card).find(n => n.className === 'claim-title').trigger('click');
  assert.deepEqual(calls.map(c => c[1]), ['synthetic-claim-a', 'synthetic-claim-b']);
});
test('source revision selector retains old snapshots and switches explicit revision only', async () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'new-revision', normalizedContent: 'New text' });
  corpus.sources[0].revisionIds.push('new-revision');
  const doc = new FakeDocument(), calls = [], m = createModel(corpus);
  const root = renderSource(doc, m, corpus.sources[0], 'synthetic-revision-a', () => {}, id => calls.push(id), () => {});
  const select = descendants(root).find(n => n.tagName === 'SELECT');
  assert.equal(select.children.length, 2);
  assert.equal(select.value, 'synthetic-revision-a');
  assert.ok(root.textContent.includes('Café'));
  select.value = 'new-revision'; await select.trigger('change');
  assert.deepEqual(calls, ['new-revision']);
});
test('unknown or cross-source requested revision gives an explicit fallback warning', () => {
  const doc = new FakeDocument(), m = model();
  const root = renderSource(doc, m, m.sources.get('synthetic-source-a'), 'synthetic-revision-b',
    () => {}, () => {}, () => {});
  assert.match(root.textContent, /Requested revision is not available for this source/);
  assert.match(root.textContent, /showing the available snapshot below/);
});
test('passage-selected source panel keeps both claims on one shared passage', () => {
  const doc = new FakeDocument(), m = model();
  const root = renderSource(doc, m, m.sources.get('synthetic-source-a'), 'synthetic-revision-a',
    () => {}, () => {}, () => {}, ['synthetic-passage-a']);
  assert.match(root.textContent, /same synthetic passage is scoped independently/);
  assert.ok(!root.textContent.includes('Inference rationale'));
  assert.ok(button(root, 'Show all revision claims'));
});
test('fetch helper requests only local endpoint with no-store and propagates failures', async () => {
  const calls = [];
  const m = await fetchCorpus(async (...args) => { calls.push(args); return response(); }, '/api/corpus');
  assert.equal(m.claims.size, 4);
  assert.deepEqual(calls[0], ['/api/corpus', { cache: 'no-store' }]);
  await assert.rejects(fetchCorpus(async () => response(null, 400), '/api/corpus'), /400/);
  await assert.rejects(fetchCorpus(async () => response({ schemaVersion: '0.2.0' }), '/api/corpus'), /0.3.0/);
});
test('initial empty valid corpus stays empty until explicit synthetic demo activation', async () => {
  const empty = fresh();
  for (const key of ['sources', 'sourceRevisions', 'passages', 'cases', 'claims', 'categorizations', 'timelines', 'reviews', 'collectionManifests']) empty[key] = [];
  empty.governance = {}; empty.name = 'No configured corpus';
  const doc = new FakeDocument(), win = fakeWindow(), requests = [];
  const app = mountWorkbench(doc, win, async path => { requests.push(path); return response(path === '/api/demo' ? fresh() : empty); });
  await app.ready;
  assert.deepEqual(requests, ['/api/corpus']);
  assert.match(doc.getElementById('content').textContent, /No records configured/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
  await doc.getElementById('demo').trigger('click');
  assert.deepEqual(requests, ['/api/corpus', '/api/demo']);
  assert.match(doc.getElementById('status').textContent, /SYNTHETIC DEMO/);
  await doc.getElementById('reload-corpus').trigger('click');
  assert.deepEqual(requests, ['/api/corpus', '/api/demo', '/api/corpus']);
  assert.equal(app.getModel().cases.size, 0);
  assert.match(doc.getElementById('content').textContent, /No records configured/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
  assert.equal(doc.getElementById('reload-corpus').disabled, false);
});
test('reload local corpus restores configured records and clears demo filters', async () => {
  const local = fresh();
  local.name = 'Configured local snapshot'; local.governance = {};
  const doc = new FakeDocument(), win = fakeWindow();
  const app = mountWorkbench(doc, win, async endpoint => response(endpoint === '/api/demo' ? fresh() : local));
  await app.ready;
  await doc.getElementById('demo').trigger('click');
  doc.getElementById('search').value = 'no matching records';
  await doc.getElementById('search').trigger('input');
  await doc.getElementById('reload-corpus').trigger('click');
  assert.equal(app.getModel().corpus.name, local.name);
  assert.equal(doc.getElementById('search').value, '');
  assert.match(doc.getElementById('result').textContent, /2 matching cases/);
  assert.ok(!doc.getElementById('status').textContent.includes('SYNTHETIC'));
});
test('all core views and curator studio render with visible active navigation', async () => {
  const { doc, app, content } = await mounted();
  for (const view of ['cases', 'sources', 'claims', 'studio', 'method']) {
    app.navigate(view);
    const selected = doc.getElementById('views').children.filter(b => b.attributes['aria-current'] === 'page');
    assert.equal(selected.length, 1); assert.equal(selected[0].dataset.view, view);
    assert.ok(content.textContent.length > 100);
  }
  assert.equal(doc.getElementById('toolbar').hidden, true);
  assert.match(content.textContent, /new campaigns remain Pending, never accepted/);
  assert.match(content.textContent, /--corpus and no-store modes remain read-only/);
});
test('deep-link claim reload resolves its older snapshot, not the newest revision', async () => {
  const corpus = fresh();
  corpus.sourceRevisions.push({ ...corpus.sourceRevisions[0], id: 'latest', normalizedContent: 'LATEST ONLY' });
  corpus.sources[0].revisionIds.push('latest');
  const { content } = await mounted(corpus, '#claims/synthetic-claim-a');
  const sourceText = descendants(content).find(n => n.className === 'source-text');
  assert.equal(sourceText.textContent, corpus.sourceRevisions[0].normalizedContent);
});
test('crosslink resets hiding filters, exposes exact target and moves keyboard focus', async () => {
  const { doc, app, content, win } = await mounted();
  doc.getElementById('search').value = 'never matches';
  await doc.getElementById('search').trigger('input');
  assert.match(content.textContent, /No records match/);
  app.navigate('claims', 'synthetic-claim-b');
  assert.equal(doc.getElementById('search').value, '');
  assert.equal(win.location.hash, '#claims/synthetic-claim-b/');
  assert.match(doc.getElementById('status').textContent, /reset search \/ facets/);
  assert.match(content.textContent, /A second synthetic source denies/);
  assert.equal(content.focused, true);
});
test('skip link preserves the selected route while focusing content', async () => {
  const { doc, win, content } = await mounted(fresh(), '#claims/synthetic-claim-b');
  await doc.getElementById('skip-content').trigger('click');
  assert.equal(win.location.hash, '#claims/synthetic-claim-b');
  assert.equal(content.focused, true);
});
test('keyboard highlight activation retains a meaningful focus destination and reveals linked claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a/synthetic-revision-a');
  const highlight = descendants(content).find(n => n.className === 'passage-highlight');
  await highlight.trigger('click');
  assert.equal(content.focused, true);
  assert.match(doc.getElementById('content').textContent, /1 evidence passage\(s\) selected/);
});
test('empty result reset restores full count and all facets', async () => {
  const { doc, content } = await mounted();
  doc.getElementById('search').value = 'no such record';
  await doc.getElementById('search').trigger('input');
  assert.match(doc.getElementById('result').textContent, /0 matching cases \/ 2 total/);
  await button(content, 'Reset search & filters').trigger('click');
  assert.match(doc.getElementById('result').textContent, /2 matching cases \/ 2 total/);
});
test('actual facet checkbox and tag mode interactions update counts without writes', async () => {
  const corpus = fresh(); corpus.claims[0].disposition = 'Needs correction';
  const { doc, app } = await mounted(corpus);
  app.navigate('claims');
  const label = descendants(doc.getElementById('facets')).find(n => n.tagName === 'LABEL' && n.textContent === 'Needs correction');
  const input = label.children[0]; input.checked = true; await input.trigger('change');
  assert.match(doc.getElementById('result').textContent, /1 matching claims \/ 4 total/);
  doc.getElementById('tag-mode').value = 'AND';
  await doc.getElementById('tag-mode').trigger('change');
  assert.equal(app.getModel().claims.get('synthetic-claim-a').disposition, 'Needs correction');
});
test('source facet fallback clears passage selection so the newly visible source keeps its claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a');
  await descendants(content).find(n => n.className === 'passage-highlight').trigger('click');
  assert.match(content.textContent, /1 evidence passage\(s\) selected/);
  const label = descendants(doc.getElementById('facets')).find(n =>
    n.tagName === 'LABEL' && n.textContent === 'Synthetic conflicting account');
  label.children[0].checked = true;
  await label.children[0].trigger('change');
  assert.ok(!content.textContent.includes('Passage selection'));
  assert.ok(descendants(content).some(n => n.className === 'claim-title' &&
    n.textContent === 'A second synthetic source denies tool use.'));
  assert.ok(!content.textContent.includes('No linked claims for this revision / passage'));
});
test('tag mode changes clear selected passages instead of retaining a hidden subset of claims', async () => {
  const { doc, content } = await mounted(fresh(), '#sources/synthetic-source-a');
  await descendants(content).find(n => n.className === 'passage-highlight').trigger('click');
  assert.ok(!content.textContent.includes('Inference rationale'));
  doc.getElementById('tag-mode').value = 'AND';
  await doc.getElementById('tag-mode').trigger('change');
  assert.ok(!content.textContent.includes('Passage selection'));
  assert.match(content.textContent, /Inference rationale/);
});
test('revision selection on a filtered fallback source updates the complete route and survives reset', async () => {
  const { doc, win, content } = await mounted(fresh(), '#sources/synthetic-source-a/synthetic-revision-a');
  const label = descendants(doc.getElementById('facets')).find(n =>
    n.tagName === 'LABEL' && n.textContent === 'Synthetic conflicting account');
  label.children[0].checked = true;
  await label.children[0].trigger('change');
  const revision = descendants(content).find(n => n.tagName === 'SELECT');
  revision.value = 'synthetic-revision-b';
  await revision.trigger('change');
  assert.equal(win.location.hash, '#sources/synthetic-source-b/synthetic-revision-b');
  await doc.getElementById('reset').trigger('click');
  const selected = descendants(content).find(n => n.className === 'record-card' &&
    n.attributes['aria-pressed'] === 'true');
  assert.match(selected.textContent, /Synthetic conflicting account/);
  assert.equal(descendants(content).find(n => n.className === 'source-text').textContent, 'The tool was not used.');
  assert.equal(win.location.hash, '#sources/synthetic-source-b/synthetic-revision-b');
});
test('malformed hash navigation, unknown targets and browser back never crash', async () => {
  const { win, doc } = await mounted(fresh(), '#sources/%ZZ');
  assert.match(doc.getElementById('result').textContent, /matching cases/);
  win.location.hash = '#claims/unknown'; win.listeners.hashchange();
  assert.match(doc.getElementById('content').textContent, /Unknown target/);
  win.location.hash = '#sources/synthetic-source-b/synthetic-revision-b'; win.listeners.popstate();
  assert.match(doc.getElementById('content').textContent, /The tool was not used/);
});
test('failed local load is visible and does not substitute a silent demo', async () => {
  const doc = new FakeDocument(), win = fakeWindow(), paths = [];
  const app = mountWorkbench(doc, win, async path => { paths.push(path); return response(null, 503); });
  await app.ready;
  assert.deepEqual(paths, ['/api/corpus']);
  assert.match(doc.getElementById('status').textContent, /503/);
  assert.equal(doc.getElementById('status').attributes['data-kind'], 'error');
  assert.equal(doc.getElementById('demo').disabled, false);
});
test('failed replacement retains previous data with an explicit limitation', async () => {
  const document = new FakeDocument(), win = fakeWindow();
  let count = 0;
  const instance = mountWorkbench(document, win, async () => ++count === 1 ? response() : response(null, 500));
  await instance.ready; await instance.load('/api/demo');
  assert.equal(instance.getModel().cases.size, 2);
  assert.match(document.getElementById('status').textContent, /Previously loaded corpus remains displayed/);
  assert.ok(document.getElementById('content').textContent.length);
});
test('DOM controls are semantic buttons / labels, highlights have accessible names', () => {
  const doc = new FakeDocument(), node = renderSourceText(doc, { normalizedContent: 'abc' },
    [{ id: 'p', start: 0, end: 2 }], () => {});
  const control = descendants(node).find(n => n.tagName === 'BUTTON');
  assert.equal(control.type, 'button');
  assert.match(control.attributes['aria-label'], /code points 0–2/);
  assert.equal(element(doc, 'span', '<b>literal</b>').textContent, '<b>literal</b>');
});
test('bundled entrypoint uses only permitted local assets and no external requests or unsafe HTML sinks', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  for (const path of ['/src/app.mjs', '/src/theme.js', '/src/style.css', '/docs/assets/logo.svg', '/docs/assets/logo-dark.svg', '/docs/assets/favicon.svg']) assert.ok(html.includes(path));
  assert.ok(!/https?:\/\/|cdn|<iframe/i.test(html));
  for (const file of ['app.mjs', 'render.mjs', 'model.mjs', 'studio.mjs']) {
    const text = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|localStorage|sessionStorage/.test(text), file);
  }
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  for (const color of ['#f6f3eb', '#fffdf7', '#25352f', '#59675d', '#dcded2', '#b04a26', '#2c5e50']) assert.ok(css.includes(color));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('@media(max-width:700px)'));
});

function textNode(text) { return { nodeType: 3, textContent: text, childNodes: [] }; }
function tree(...children) {
  return { nodeType: 1, childNodes: children, get textContent() { return children.map(c => c.textContent).join(''); } };
}
function selection(startContainer, startOffset, endContainer, endOffset, extra = {}) {
  return { rangeCount: 1, isCollapsed: false, getRangeAt: () => ({ startContainer, startOffset, endContainer, endOffset }), ...extra };
}
function draftState() {
  const state = createStudio(fresh());
  state.sourceId = 'synthetic-source-a'; state.revisionId = 'synthetic-revision-a';
  return state;
}
function choosePassage(state, start = 0, end = 3) {
  const revision = [...state.base.sourceRevisions, ...state.intakes.map(i => i.revision)].find(r => r.id === state.revisionId);
  const points = [...revision.normalizedContent];
  state.selection = { sourceRevisionId: revision.id, revisionHash: revision.normalizedHash,
    start, end, text: points.slice(start, end).join(''), locator: `code-points:${start}-${end}` };
}
const claimInput = () => ({ caseId: 'synthetic-case-a', description: 'Synthetic curator claim; not incident evidence.',
  evidenceStatus: 'Source-reported observation' });
function inputNamed(node, label) {
  return descendants(node).find(n => n.attributes['aria-label'] === label);
}

test('Issue #31 AC-01 browser normalization, enums and hashes match the foundation contract', async () => {
  const samples = ['😀 cafe\u0301\r\n🧑‍💻\rend', '\uFEFF A\r\nB', '<p>&amp; literal HTML</p>', '日本語 repeated 😀 repeated'];
  for (const raw of samples) {
    assert.equal(normalizeSuppliedText(raw), normalizeText(raw));
    assert.equal(await hashText(raw), sha256(raw));
  }
  for (const [dimension, values] of Object.entries(DIMENSIONS)) assert.deepEqual(values, categories[dimension]);
  assert.deepEqual(EVIDENCE, schema.$defs.evidenceStatus.enum);
  assert.equal(serializeProposal(fixture), canonicalSerialize(fixture));
  assert.equal(await hashText(serializeProposal(fixture)), digest(fixture));
});

test('Issue #31 AC-01 DOM Range resolves UTF-16 boundaries across nested highlights and repeated text', () => {
  const first = textNode('😀 '), middle = textNode('café'), end = textNode('\n🧑‍💻 😀 café');
  const root = tree(tree(first), tree(tree(middle)), end);
  const revision = { id: 'rev', normalizedContent: root.textContent, normalizedHash: sha256(root.textContent) };
  const picked = selectedPassage(root, selection(first, 3, end, 6), revision);
  assert.deepEqual(picked, { sourceRevisionId: 'rev', revisionHash: revision.normalizedHash,
    start: 2, end: 10, text: 'café\n🧑‍💻', locator: 'code-points:2-10' });
  // Browser ranges are document-ordered even for backward pointer selections.
  assert.deepEqual(selectedPassage(root, selection(first, 3, end, 6, { anchorNode: end, focusNode: first }), revision), picked);
  const repeated = selectedPassage(root, selection(end, 10, end, 14), revision);
  assert.equal(repeated.text, 'café'); assert.equal(repeated.start, 13);
  assert.equal(selectedPassage(root, selection(root, 1, root, 2), revision).text, 'café');
  assert.equal(selectedPassage(root, selection(root, 0, root, 3), revision).text, root.textContent);
});

test('Issue #31 AC-01 invalid, collapsed, outside, stale and surrogate-splitting DOM ranges are rejected', () => {
  const node = textNode('😀a'), root = tree(node), revision = { id: 'rev', normalizedContent: root.textContent };
  for (const selected of [
    null, selection(node, 0, node, 0, { isCollapsed: true }),
    selection(node, 0, node, 2, { rangeCount: 2 }),
    selection(textNode('outside'), 0, node, 2), selection(node, 0, textNode('outside'), 2),
    selection(node, 1, node, 2), selection(node, 0, node, 1), selection(root, -1, root, 1),
  ]) assert.equal(selectedPassage(root, selected, revision), null);
  assert.equal(selectedPassage(root, selection(node, 0, node, 2), { ...revision, normalizedContent: 'new' }), null);
  assert.equal(selectedPassage(root, selection(node, 0, node, 2), { ...revision, normalizedContent: null }), null);
});

test('Issue #31 AC-02 generated extraction JSON applies to the existing CLI contract without changing the base', () => {
  const state = draftState(), before = canonicalSerialize(state.base);
  choosePassage(state);
  const first = saveDraft(state, { ...claimInput(), behavior: 'Synthetic behavior', artifacts: 'example.invalid\nartifact.txt',
    dimensions: { trust_surface: [DIMENSIONS.trust_surface[0]], execution_location: ['CLI', 'endpoint'] }, techniques: ['T1059', 'AML.T0051'] });
  assert.equal(state.selection, null);
  const inference = saveDraft(state, { ...claimInput(), description: 'Synthetic inference', evidenceStatus: 'Researcher inference',
    rationale: 'Explicit synthetic reasoning', supportingClaimIds: [first.id] });
  const exported = JSON.parse(serializeProposal(extractionProposal(state))), target = fresh();
  applyExtraction(target, exported, 'operator', serializeProposal(exported));
  assert.deepEqual(validateShape(target), []); assertValid(target);
  const applied = target.claims.find(c => c.id === inference.id);
  assert.equal(applied.disposition, 'Pending');
  assert.equal(applied.origin, 'Human inference');
  assert.equal(applied.inference.supportingClaimIds[0], first.id);
  assert.equal(canonicalSerialize(state.base), before);
  assert.ok(!JSON.stringify(exported).includes('candidateTechniques'));
});

test('Issue #31 AC-02 pasted fixture generates a standalone schema-valid private proposal', async () => {
  const input = JSON.parse(await readFile(new URL('./fixtures/extraction/studio-input.json', import.meta.url), 'utf8'));
  const state = createStudio(emptyCorpus()), before = canonicalSerialize(state.base);
  const revision = await pasteArticle(state, input);
  assert.equal(revision.normalizedContent, normalizeText(input.text));
  const record = addStudioCase(state, 'Synthetic studio exercise; not incident evidence', 'Research exercise');
  choosePassage(state, 0, [...revision.normalizedContent].length);
  saveDraft(state, { ...claimInput(), caseId: record.id, ...input.annotation });
  const proposal = JSON.parse(serializeProposal(await corpusProposal(state)));
  assert.deepEqual(validateShape(proposal), []); assertValid(proposal);
  assert.equal(proposal.governance.studio.baseDigest, digest(state.base));
  assert.equal(proposal.behaviors[0].candidateTechniques[1].framework, 'ATLAS');
  assert.deepEqual(proposal.behaviors[0].artifacts, ['example.invalid', 'synthetic-artifact.txt']);
  assert.equal(proposal.categorizations.length, 6);
  assert.ok(proposal.categorizations.every(c => c.disposition === 'Pending'));
  assert.equal(proposal.sources[0].publisher, input.publisher);
  assert.equal(proposal.sources[0].publicationDate.precision, 'unknown');
  assert.throws(() => extractionProposal(state), /New intake\/cases/);
  assert.equal(canonicalSerialize(state.base), before);
});

privateStoreTest('Issue #31 AC-02 pasted proposal identities match POSIX private CLI intake', async t => {
  const input = JSON.parse(await readFile(new URL('./fixtures/extraction/studio-input.json', import.meta.url), 'utf8'));
  const state = createStudio(emptyCorpus());
  const revision = await pasteArticle(state, input);
  const record = addStudioCase(state, 'Synthetic studio exercise; not incident evidence', 'Research exercise');
  choosePassage(state, 0, [...revision.normalizedContent].length);
  saveDraft(state, { ...claimInput(), caseId: record.id, ...input.annotation });
  const proposal = await corpusProposal(state);
  const root = fileURLToPath(new URL('../.private-intake/', import.meta.url));
  await mkdir(root, { recursive: true, mode: 0o700 });
  const store = await mkdtemp(path.join(root, 'studio-intake-'));
  t.after(() => rm(store, { recursive: true, force: true }));
  const result = await intakeSource({ kind: 'text', text: input.text, sourceUrl: input.url, suppliedBy: input.suppliedBy, store });
  assert.equal(result.status, 'succeeded');
  const cli = JSON.parse(await readFile(path.join(store, 'corpus.json'), 'utf8'));
  assert.equal(cli.sources[0].id, proposal.sources[0].id);
  assert.equal(cli.sourceRevisions[0].id, revision.id);
  assert.equal(cli.sourceRevisions[0].normalizedHash, revision.normalizedHash);
});

test('Issue #31 AC-02 existing cases are explicit context, not rewritten review decisions', async () => {
  const state = draftState(), before = canonicalSerialize(state.base);
  choosePassage(state); saveDraft(state, claimInput());
  const proposal = await corpusProposal(state);
  assertValid(proposal);
  assert.deepEqual(proposal.governance.studio.contextCaseIds, ['synthetic-case-a']);
  assert.deepEqual(proposal.governance.studio.contextSourceIds, ['synthetic-source-a']);
  assert.equal(proposal.cases[0].summary, null);
  assert.equal(proposal.cases[0].disposition, 'Pending');
  assert.deepEqual(proposal.reviews, []);
  assert.equal(canonicalSerialize(state.base), before);
});

test('Issue #31 AC-02 grounding fails closed for missing, altered, out-of-range and wrong-revision passages', () => {
  const state = draftState();
  assert.throws(() => saveDraft(state, claimInput()), /Select an exact passage/);
  for (const change of [{ start: -1 }, { end: 999 }, { end: 1.5 }, { text: 'invented' },
    { sourceRevisionId: 'wrong' }, { revisionHash: 'wrong' }]) {
    choosePassage(state); Object.assign(state.selection, change);
    assert.throws(() => saveDraft(state, claimInput()), /Select an exact passage/);
  }
  choosePassage(state);
  assert.throws(() => saveDraft(state, { ...claimInput(), description: ' ' }), /description/);
  assert.throws(() => saveDraft(state, { ...claimInput(), caseId: 'missing' }), /case/);
  assert.throws(() => saveDraft(state, { ...claimInput(), dimensions: { delivery: ['other'] } }), /Other delivery/);
  assert.throws(() => saveDraft(state, { ...claimInput(), techniques: ['Tbad'] }), /Technique IDs/);
  assert.throws(() => saveDraft(state, { ...claimInput(), techniques: ['T1059'] }), /behavior description/);
  assert.equal(state.drafts.length, 0);
  assert.throws(() => extractionProposal(state), /at least one/);
});

test('Issue #31 AC-02 inferences need nonblank rationale and earlier same-case support, never fake quotations', () => {
  const state = draftState(), input = { ...claimInput(), evidenceStatus: 'Researcher inference' };
  assert.throws(() => saveDraft(state, input), /rationale/);
  assert.throws(() => saveDraft(state, { ...input, rationale: 'reason' }), /same-case/);
  choosePassage(state); const support = saveDraft(state, claimInput());
  assert.throws(() => saveDraft(state, { ...input, caseId: 'synthetic-case-b', rationale: 'reason', supportingClaimIds: [support.id] }), /same-case/);
  choosePassage(state);
  const inference = saveDraft(state, { ...input, rationale: 'reason', supportingClaimIds: [support.id] });
  assert.deepEqual(inference.passages, []); assert.equal(inference.origin, 'Human inference');
});

test('Issue #31 AC-03 intake refuses unsafe text/credentials, bounds input and never overwrites an existing source', async () => {
  const input = { url: 'https://example.org/studio', text: 'Synthetic text', suppliedBy: 'operator' };
  for (const update of [{ text: '' }, { text: '\uD800' }, { text: 'a\0b' }, { text: '😀'.repeat(524289) },
    { url: 'javascript:alert(1)' }, { url: '******example.org' }, { suppliedBy: 'invalid supplier' }]) {
    const state = createStudio(emptyCorpus());
    await assert.rejects(pasteArticle(state, { ...input, ...update }));
    assert.deepEqual(state.intakes, []);
  }
  const state = createStudio(emptyCorpus());
  await pasteArticle(state, input);
  await assert.rejects(pasteArticle(state, { ...input, text: 'changed', url: input.url + '?utm_source=ignored#fragment' }), /already has a source/);
  assert.equal(state.intakes.length, 1);
});

test('Issue #31 AC-02/03 DOM studio composes, saves, preserves and removes a pending claim without network writes', async () => {
  const { doc, win, app, content, requests } = await mounted();
  app.navigate('studio');
  await button(content, 'Save pending claim').trigger('click');
  assert.match(content.textContent, /Select or explicitly create a case/);
  const source = inputNamed(content, 'Selectable normalized source text');
  // Feed browser-shaped text nodes to the real selection handler.
  const child = textNode(source.textContent); source.childNodes = [child]; source.nodeType = 1;
  win.getSelection = () => selection(child, 0, child, 4);
  await source.trigger('pointerup');
  assert.match(content.textContent, /code-points:0-3/);
  inputNamed(content, 'Case').value = 'synthetic-case-a';
  inputNamed(content, 'Claim description').value = '<script>synthetic literal claim</script>';
  await button(content, 'Save pending claim').trigger('click');
  assert.match(content.textContent, /Saved pending claims · 1/);
  assert.match(content.textContent, /No active passage selection/);
  assert.equal(descendants(content).filter(n => n.tagName === 'SCRIPT').length, 0);
  app.navigate('cases'); app.navigate('studio');
  assert.match(content.textContent, /synthetic literal claim/);
  assert.equal(app.getModel().corpus.claims.length, fixture.claims.length);
  assert.deepEqual(requests.map(r => r[0]), ['/api/corpus']);
  win.confirm = () => false;
  await app.load('/api/demo');
  assert.equal(requests.length, 1);
  await button(content, 'Remove draft claim').trigger('click');
  assert.match(content.textContent, /Saved pending claims · 0/);
  assert.ok(doc.getElementById('toolbar').hidden);
});

test('Issue #31 AC-01 revision changes clear active selections and source view opens the exact revision', async () => {
  const state = draftState(), doc = new FakeDocument(), win = fakeWindow();
  choosePassage(state);
  const host = new FakeElement('div'); host.append(renderStudio(doc, win, state));
  inputNamed(host, 'Source').value = 'synthetic-source-b';
  await inputNamed(host, 'Source').trigger('change');
  assert.equal(state.selection, null); assert.equal(state.revisionId, 'synthetic-revision-b');
  await button(host, 'Select entire revision').trigger('click');
  assert.equal(state.selection.text, state.base.sourceRevisions[1].normalizedContent);
  assert.equal(state.selection.start, 0);
  assert.equal(state.selection.end, [...state.selection.text].length);
  const mountedApp = await mounted(fresh(), '#sources/synthetic-source-b/synthetic-revision-b');
  await button(mountedApp.content, 'Draft from this revision').trigger('click');
  assert.equal(mountedApp.win.location.hash, '#studio/synthetic-source-b/synthetic-revision-b');
  assert.equal(inputNamed(mountedApp.content, 'Exact source revision').value, 'synthetic-revision-b');
});

test('Issue #31 AC-03 pasted HTML stays literal in DOM and JSON downloads use only revocable local blobs', async () => {
  const state = createStudio(emptyCorpus()), doc = new FakeDocument();
  const payload = '<script>alert(1)</script><img src="https://example.invalid/pixel" onerror="alert(1)">';
  await pasteArticle(state, { text: payload, url: 'https://example.org/studio', suppliedBy: 'operator', title: payload });
  const view = renderStudio(doc, fakeWindow(), state);
  assert.equal(inputNamed(view, 'Selectable normalized source text').textContent, payload);
  assert.equal(descendants(view).filter(n => ['SCRIPT', 'IMG', 'IFRAME'].includes(n.tagName)).length, 0);
  let blob, downloaded, revoked;
  const create = doc.createElement.bind(doc);
  doc.createElement = tag => {
    const node = create(tag); node.click = () => { downloaded = { href: node.href, filename: node.download }; }; return node;
  };
  const win = { Blob, URL: { createObjectURL(value) { blob = value; return 'blob:local-only'; },
    revokeObjectURL(url) { revoked = url; } }, setTimeout(fn) { fn(); } };
  downloadProposal(doc, win, await corpusProposal(state), 'curator-proposal.json');
  assert.deepEqual(downloaded, { href: 'blob:local-only', filename: 'curator-proposal.json' });
  assert.equal(revoked, 'blob:local-only'); assert.equal(doc.body.children.length, 0);
  assert.equal(blob.type, 'application/json');
  assertValid(JSON.parse(await blob.text()));
});
test('official wide wordmark has its native aspect ratio, accessible brand name and no duplicate text', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const brand = html.match(/<a class="brand"[^>]*>(.*?)<\/a>/s)?.[1];
  assert.ok(brand);
  assert.match(brand, /alt="DevEnvThreatCorpus"/);
  assert.match(brand, /width="360" height="80"/);
  assert.ok(!brand.includes('<span') && !brand.includes('<small'));
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.brand img\{[^}]*width:100%;height:auto/);
  assert.match(css, /\.brand\{[^}]*width:300px/);
});

test('Issue #39 AC-01 web batch controls validate explicit HTTPS inputs, campaign choice, operator and maximum 20', () => {
  const valid = { urls: 'https://socket.dev/a\nhttps://redcanary.com/b\nhttps://socket.dev/a\n',
    operator: 'operator', caseName: 'Pending campaign', caseId: '' };
  assert.deepEqual(webIntakeInput(valid), { urls: ['https://socket.dev/a', 'https://redcanary.com/b'], operator: 'operator', caseName: 'Pending campaign' });
  assert.deepEqual(webIntakeInput({ ...valid, caseId: 'existing', caseName: '' }).caseId, 'existing');
  for (const change of [{ urls: '' }, { urls: Array(21).fill('https://socket.dev/a').join('\n') },
    { urls: 'javascript:alert(1)' }, { urls: 'https://operator@socket.dev/a' },
    { urls: 'not-a-url' }, { operator: '' }, { operator: 'bad operator' }, { caseName: '' }, { caseId: 'existing' },
    { caseName: 'a'.repeat(201) }, { caseName: 'control\ncharacter' }]) {
    assert.throws(() => webIntakeInput({ ...valid, ...change }));
  }
});

test('Issue #39 AC-01/02/05 studio fetch shows waiting and partial outcomes, refreshes links, preserves drafts, retries only selected failed input', async () => {
  const doc = new FakeDocument(), win = fakeWindow('#studio'), calls = [];
  let corpus = fresh(), release, entered;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const outcomes = { caseId: 'synthetic-case-a', results: [
    { url: 'https://socket.dev/a', status: 'collected', code: 'OK', sourceId: 'synthetic-source-a', revisionId: 'synthetic-revision-a', warnings: [] },
    { url: 'https://redcanary.com/b', status: 'collected with image warnings', code: 'OK', sourceId: 'synthetic-source-b', revisionId: 'synthetic-revision-b', warnings: ['Image denied: ACCESS_DENIED'] },
    { url: 'https://socket.dev/c', status: 'failed', code: 'ACCESS_DENIED', warnings: [] },
  ] };
  const app = mountWorkbench(doc, win, async (endpoint, options) => {
    calls.push([endpoint, options]);
    if (endpoint === '/api/intake') {
      entered(); await pending;
      corpus.cases[0].name = 'Refreshed private campaign'; corpus.governance = {};
      return response(structuredClone(outcomes));
    }
    if (endpoint === '/api/enrichment') return response({ schemaVersion: 'talk-enrichment/1', annotations: [] });
    return response(structuredClone(corpus), 200, true);
  });
  await app.ready;
  const content = doc.getElementById('content');
  for (const [label, value] of [
    ['Existing campaign (or leave blank to create)', 'synthetic-case-a'],
    ['Operator identifier', 'operator'],
    ['Article URLs (one per line; maximum 20)', outcomes.results.map(item => item.url).join('\n')],
  ]) {
    const input = inputNamed(content, label); input.value = value;
    await input.trigger(input.tagName === 'SELECT' ? 'change' : 'input');
  }
  const privateName = inputNamed(content, 'New case name');
  privateName.value = 'Private draft preserved';
  inputNamed(content, 'New case kind').value = 'Campaign';
  await button(content, 'Create draft case').trigger('click');
  const collection = button(content, 'Fetch articles').trigger('click');
  await started;
  assert.match(content.textContent, /Fetching sequentially/);
  assert.equal(button(content, 'Fetching articles').disabled, true);
  assert.equal(doc.getElementById('reload-corpus').disabled, true);
  await app.load('/api/demo');
  assert.equal(calls.length, 4);
  release(); await collection;
  assert.deepEqual(calls.map(item => item[0]), ['/api/corpus', '/api/review', '/api/enrichment', '/api/intake', '/api/corpus', '/api/review', '/api/enrichment']);
  assert.equal(calls[3][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[3][1].body), { urls: outcomes.results.map(item => item.url), operator: 'operator', caseId: 'synthetic-case-a' });
  assert.match(content.textContent, /collected with image warnings.*OK/);
  assert.match(content.textContent, /Image denied: ACCESS_DENIED/);
  assert.match(content.textContent, /failed.*ACCESS_DENIED/);
  assert.match(inputNamed(content, 'Existing campaign (or leave blank to create)').textContent, /Refreshed private campaign/);
  assert.match(inputNamed(content, 'Case').textContent, /Private draft preserved/);
  const failed = descendants(content).find(node => node.type === 'checkbox' && node.parentNode.textContent.includes('manual retry'));
  failed.checked = true; await failed.trigger('change');
  await button(content, 'Use selected failed URLs').trigger('click');
  assert.equal(inputNamed(content, 'Article URLs (one per line; maximum 20)').value, 'https://socket.dev/c');
  assert.equal(calls.filter(item => item[0] === '/api/intake').length, 1);
  await button(content, 'Open campaign and all citations').trigger('click');
  assert.match(content.textContent, /Refreshed private campaign/);
  app.navigate('studio');
  assert.equal(inputNamed(content, 'Article URLs (one per line; maximum 20)').value, 'https://socket.dev/c');
  await button(content, 'Clear URLs').trigger('click');
  assert.equal(inputNamed(content, 'Article URLs (one per line; maximum 20)').value, '');
});

test('Issue #39 AC-01/02 web transport failure remains visible, never retries, and no-store / demo prohibit writes', async () => {
  const doc = new FakeDocument(), win = fakeWindow('#studio'), calls = [];
  const app = mountWorkbench(doc, win, async (endpoint, options) => {
    calls.push([endpoint, options]);
    if (endpoint === '/api/intake') return response({ message: 'Another collection is in progress.' }, 409);
    return response(fresh(), 200, endpoint === '/api/corpus');
  });
  await app.ready;
  const content = doc.getElementById('content');
  for (const [label, value] of [['New pending campaign name (only when no existing campaign selected)', 'New pending'],
    ['Operator identifier', 'operator'], ['Article URLs (one per line; maximum 20)', 'https://socket.dev/a']]) {
    const input = inputNamed(content, label); input.value = value; await input.trigger('input');
  }
  await button(content, 'Fetch articles').trigger('click');
  assert.match(content.textContent, /Another collection is in progress/);
  assert.equal(button(content, 'Fetch articles').disabled, false);
  assert.equal(calls.filter(item => item[0] === '/api/intake').length, 1);
  await app.load('/api/demo');
  assert.match(content.textContent, /Synthetic demo is read-only/);
  assert.equal(button(content, 'Fetch articles'), undefined);
  const local = fresh(); local.governance = {};
  const readonly = await mounted(local, '#studio');
  assert.match(readonly.content.textContent, /--corpus and no-store modes remain read-only/);
  assert.equal(button(readonly.content, 'Fetch articles'), undefined);
  assert.ok(readonly.requests.every(([, options]) => options.method === undefined));
});

test('Issue #39 AC-04 every case-linked citation renders metadata and safe external links and exports complete JSON', async () => {
  const corpus = fresh(), doc = new FakeDocument(), m = createModel(corpus), record = corpus.cases[0];
  record.sourceIds.push('synthetic-source-b');
  corpus.sources[0].publisher = 'StepSecurity';
  corpus.sources[0].originalUrl = 'https://www.stepsecurity.io/blog/one';
  corpus.sources[1].publisher = null; corpus.sources[1].originalUrl = 'https://socket.dev/blog/two';
  corpus.sources[1].canonicalUrl = 'https://socket.dev/blog/two';
  let exported;
  const rendered = renderCase(doc, m, record, () => {}, value => { exported = value; });
  const references = descendants(rendered).filter(node => node.className === 'citation');
  assert.equal(references.length, 2);
  for (const reference of references) {
    for (const field of ['Normalized publisher', 'Original URL', 'Retrieved']) assert.match(reference.textContent, new RegExp(field));
    const link = descendants(reference).find(node => node.tagName === 'A');
    assert.ok(link.href.startsWith('https://')); assert.equal(link.rel, 'noopener noreferrer');
  }
  assert.match(references[0].textContent, /StepSecurity/);
  assert.match(references[1].textContent, /Socket/);
  assert.ok(!references[1].textContent.includes('Not available'));
  await button(rendered, 'Download all campaign citations').trigger('click');
  assert.deepEqual(exported, caseCitations(m, record));
  assert.equal(exported.citations.length, 2);
  assert.equal(exported.citations[1].publisher, null);
  for (const url of ['javascript:alert(1)', 'http://socket.dev/a', 'https://operator@socket.dev/a', 'data:text/html,<script>']) assert.equal(safeExternalUrl(url), null);
  corpus.sources[1].originalUrl = 'javascript:alert(1)'; corpus.sources[1].canonicalUrl = 'https://operator@socket.dev/a';
  assert.equal(caseCitations(m, record).citations[1].url, null);
  const unsafe = renderCase(doc, m, record, () => {});
  assert.equal(descendants(unsafe).filter(node => node.tagName === 'A').length, 1);
});

test('Issue #39 AC-05 archives offer only selected revision attachments and extracted text by default', () => {
  const corpus = fresh(), source = corpus.sources[0], revision = corpus.sourceRevisions[0];
  source.id = `source-${'a'.repeat(64)}`; revision.sourceId = source.id;
  revision.id = `source-revision-${'b'.repeat(64)}`; source.revisionIds = [revision.id]; source.inputKind = 'url';
  revision.rawContent = '<script>untrusted()</script>';
  const m = createModel(corpus); m.collectionEnabled = true;
  const rendered = renderSource(new FakeDocument(), m, source, revision.id, () => {}, () => {}, () => {});
  const links = descendants(rendered).filter(node => node.tagName === 'A' && node.download);
  assert.deepEqual(links.map(node => node.download), ['article.txt', 'original.html', 'metadata.json', 'assets.json']);
  assert.ok(links.every(node => node.href.startsWith(`/api/archive/${source.id}/${revision.id}/`)));
  assert.match(rendered.textContent, /download only, never rendered/);
  assert.equal(descendants(rendered).find(node => node.className === 'source-text').textContent, revision.normalizedContent);
  assert.ok(!rendered.textContent.includes('untrusted()'));
  for (const inputKind of ['text', 'file']) {
    source.inputKind = inputKind;
    const fetched = renderSource(new FakeDocument(), m, source, revision.id, () => {}, () => {}, () => {});
    assert.equal(descendants(fetched).filter(node => node.download).length, 4);
  }
  m.collectionEnabled = false;
  const readonly = renderSource(new FakeDocument(), m, source, revision.id, () => {}, () => {}, () => {});
  assert.equal(descendants(readonly).filter(node => node.download).length, 0);
});

test('Issue #39 AC-02 failed intake remains visibly failed after corpus reload, not collected evidence', async () => {
  const corpus = fresh(), source = corpus.sources[0];
  source.revisionIds = []; source.title = null; source.collectionState = 'Collected';
  corpus.sourceRevisions = corpus.sourceRevisions.filter(revision => revision.sourceId !== source.id);
  corpus.collectionManifests = [{
    id: 'failed-intake', outcome: 'Failed', inputSourceIds: [source.id], inputRevisionIds: [],
    provenance: { suppliedBy: 'operator' }, limitations: ['error-code=ACCESS_DENIED', 'event-time=2026-10-13T00:00:00Z'],
  }];
  const { app, content } = await mounted(corpus, '#studio');
  assert.match(content.textContent, /Persisted failed intake attempts.*not successful evidence/);
  assert.match(content.textContent, /error-code=ACCESS_DENIED/);
  app.navigate('sources', source.id);
  assert.match(content.textContent, /No retained revision \/ failed or incomplete intake/);
  assert.match(content.textContent, /Failed intake attempt — not successful evidence.*ACCESS_DENIED/);
  assert.match(content.textContent, /No source snapshot is available/);
  const recovered = fresh(), recoveredSource = recovered.sources[0];
  recovered.collectionManifests = [...corpus.collectionManifests, {
    id: 'success-after-failure', outcome: 'Succeeded', inputSourceIds: [source.id], inputRevisionIds: recoveredSource.revisionIds,
    limitations: ['event-time=2026-10-13T01:00:00Z'],
  }];
  const panel = renderSource(new FakeDocument(), createModel(recovered), recoveredSource, '', () => {}, () => {}, () => {});
  const history = panel.children.find(node => node.tagName === 'DETAILS' && node.textContent.includes('Previous intake history'));
  assert.ok(history); assert.ok(!history.open);
  assert.ok(!panel.children.some(node => node.tagName === 'P' && node.textContent.startsWith('Failed intake attempt')));
  recovered.collectionManifests.push({ ...corpus.collectionManifests[0], id: 'new-failure', limitations: ['error-code=NETWORK', 'event-time=2026-10-13T02:00:00Z'] });
  const currentFailure = renderSource(new FakeDocument(), createModel(recovered), recoveredSource, '', () => {}, () => {}, () => {});
  assert.ok(currentFailure.children.some(node => node.tagName === 'P' && node.textContent.includes('error-code=NETWORK')),
    'a subsequent failure must not be hidden by an earlier successful snapshot');
});
