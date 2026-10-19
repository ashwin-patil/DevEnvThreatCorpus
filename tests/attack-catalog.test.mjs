import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { digest } from '../scripts/contract.mjs';
import { PINNED_FRAMEWORK_CATALOG, catalogEntry, catalogSnapshot } from '../src/framework-catalog.mjs';
import { ATTACK_PIN, buildAttackCatalog, projectAttackBundle, serializeAttackCatalog } from '../src/import-attack-catalog.mjs';

const bytes = readFileSync(new URL('../src/attack-catalog.json', import.meta.url));
const attack = JSON.parse(bytes);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const ids = entries => entries.map(t => t.id);
const pattern = (id, extra = {}) => ({
  type: 'attack-pattern', name: `Synthetic ${id}`,
  x_mitre_domains: ['enterprise-attack'], x_mitre_is_subtechnique: id.includes('.'),
  external_references: [{ source_name: 'mitre-attack', external_id: id,
    url: `https://attack.mitre.org/techniques/${id.replace('.', '/')}` }],
  ...extra,
});
const bundle = objects => ({ type: 'bundle', objects });

test('ATT&CK 19.2 complete active projection has exact counts, valid unique sorted IDs and explicit exclusions', () => {
  const p = attack.projection;
  assert.deepEqual({
    objects: p.sourceObjectCount, patterns: p.attackPatternCount,
    techniques: p.activeTechniqueCount, subtechniques: p.activeSubtechniqueCount,
    excluded: p.excludedCount, revoked: p.revokedCount, deprecated: p.deprecatedCount,
    both: p.revokedAndDeprecatedCount,
  }, { objects: 26086, patterns: 858, techniques: 222, subtechniques: 475,
    excluded: 161, revoked: 149, deprecated: 12, both: 0 });
  assert.equal(attack.techniques.length, 697);
  assert.equal(attack.techniques.filter(t => t.id.includes('.')).length, 475);
  assert.equal(p.excluded.length, 161);
  assert.equal(p.excluded.filter(t => t.revoked).length, 149);
  assert.equal(p.excluded.filter(t => t.deprecated).length, 12);
  assert.equal(p.excluded.filter(t => t.revoked && t.deprecated).length, 0);
  assert.equal(p.attackPatternCount, attack.techniques.length + p.excludedCount);
  assert.equal(p.excludedCount, p.revokedCount + p.deprecatedCount - p.revokedAndDeprecatedCount);
  for (const entries of [attack.techniques, p.excluded]) {
    assert.deepEqual(ids(entries), ids(entries).sort());
    assert.equal(new Set(ids(entries)).size, entries.length);
    for (const entry of entries) assert.match(entry.id, /^T\d{4}(?:\.\d{3})?$/);
  }
  const activeIds = new Set(ids(attack.techniques));
  for (const entry of attack.techniques) {
    assert.deepEqual(Object.keys(entry), ['id', 'name', 'url']);
    assert.ok(entry.name.trim());
    assert.equal(entry.url.replace(/\/$/, ''), `https://attack.mitre.org/techniques/${entry.id.replace('.', '/')}`);
    if (entry.id.includes('.')) assert.ok(activeIds.has(entry.id.split('.')[0]));
  }
  for (const entry of p.excluded) {
    assert.ok(entry.revoked || entry.deprecated);
    assert.ok(!activeIds.has(entry.id));
    assert.equal(catalogEntry('ATT&CK', '19.2', entry.id), null);
  }
});

test('ATT&CK projection preserves immutable provenance and the exact redistributable copyright/license notice', () => {
  for (const [key, value] of Object.entries(ATTACK_PIN)) assert.equal(attack[key], value);
  assert.equal(attack.immutableRevision, '6cda5ad8462c79e14fbb872f4e09059b18e0cfc4');
  assert.equal(attack.materialDigest, 'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4');
  assert.equal(attack.gitBlobSha, '8b8a9c8cc9e553f96f963b91265f50ee0854636d');
  assert.equal(attack.version, '19.2');
  assert.equal(attack.sourceResolverVersion, 'pinned-catalog-resolver/1');
  assert.equal(attack.retrievalDate, '2026-10-13');
  assert.equal(attack.materialUrl, `${attack.upstream}/blob/${attack.immutableRevision}/enterprise-attack/enterprise-attack-19.2.json`);
  assert.equal(attack.licenseUrl, `${attack.upstream}/blob/${attack.immutableRevision}/LICENSE.txt`);
  assert.equal(sha256(attack.licenseText), '738144f7fb054722a4ef9d3367c51710341dc12fc574c6ac3a41daaaecd8bf5e');
  const notice = Buffer.from(attack.licenseText);
  assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${notice.length}\0`), notice])).digest('hex'),
    '7d8dc97542672cc9ec78de1b643b5b39ca7e2fba');
  assert.match(attack.licenseText, /© 2026 The MITRE Corporation/);
  assert.match(attack.licenseText, /reproduce\nMITRE's copyright designation and this license/);
  assert.match(attack.licenseText, /DISCLAIM ALL WARRANTIES/);
  assert.throws(() => buildAttackCatalog(Buffer.from('{}'), notice), /Material SHA256 mismatch/);
});

test('ATT&CK offline asset has a deterministic byte snapshot and changes resolver snapshot identity', () => {
  assert.equal(bytes.toString('utf8'), serializeAttackCatalog(attack));
  assert.equal(sha256(bytes), '82f1a65c88db4bfff7ac1c8ff70171e3008439fd73bae7ae0156d4d428321023');
  const snapshot = catalogSnapshot();
  assert.equal(snapshot.digest, 'fbb377a4bc9352f7bf893eef18b94f37e8530c1faa4ae3cc81f77726f988e014');
  assert.equal(snapshot.digest, digest(PINNED_FRAMEWORK_CATALOG));
  assert.deepEqual(snapshot.catalogs[0], attack);
  assert.equal(snapshot.resolverVersion, 'pinned-catalog-resolver/2');
  // Reconstruct the actual previous singleton projection, not a new incident mapping.
  const { licenseDigest, licenseGitBlobSha, ...legacyPin } = ATTACK_PIN;
  const historical = { resolverVersion: snapshot.resolverVersion, catalogs: [{
    ...legacyPin, techniques: [{ id: 'T1059', name: 'Command and Scripting Interpreter',
      url: 'https://attack.mitre.org/techniques/T1059/' }],
  }, snapshot.catalogs[1]] };
  const historicalDigest = digest(historical);
  assert.notEqual(snapshot.digest, historicalDigest);
  for (const change of [
    c => c.techniques.pop(),
    c => { c.techniques[0].name += ' changed'; },
    c => { c.materialDigest = '0'.repeat(64); },
    c => { c.licenseText += '\n'; },
  ]) {
    const altered = { resolverVersion: snapshot.resolverVersion, catalogs: structuredClone(snapshot.catalogs) };
    change(altered.catalogs[0]);
    assert.notEqual(digest(altered), snapshot.digest);
  }
  snapshot.catalogs[0].techniques[0].name = 'caller mutation';
  snapshot.catalogs[0].projection.excluded[0].id = 'caller mutation';
  assert.deepEqual(catalogSnapshot().catalogs[0], attack);
  assert.equal(digest(historical), historicalDigest);
  assert.ok(Object.isFrozen(PINNED_FRAMEWORK_CATALOG.catalogs[0].projection.excluded[0]));
});

test('ATT&CK resolver now resolves formerly missing techniques/subtechniques and fails closed otherwise', () => {
  for (const [id, name] of [
    ['T1059', 'Command and Scripting Interpreter'], ['T1059.001', 'PowerShell'],
    ['T1195.002', 'Compromise Software Supply Chain'], ['T1552.001', 'Credentials In Files'], ['T1566', 'Phishing'],
  ]) {
    const entry = catalogEntry('ATT&CK', '19.2', id);
    assert.equal(entry.technique.name, name);
    assert.equal(entry.catalog.materialDigest, attack.materialDigest);
    assert.equal(entry.catalog.sourceResolverVersion, 'pinned-catalog-resolver/1');
  }
  for (const [framework, version, id] of [
    ['ATT&CK', '19.1', 'T1059.001'], ['ATT&CK', '19.2', 'T9999'],
    ['ATLAS', '19.2', 'T1059'], ['ATT&CK', '19.2', 't1059'],
  ]) assert.equal(catalogEntry(framework, version, id), null);
  assert.equal(catalogSnapshot().catalogs.find(c => c.framework === 'ATLAS').techniques.length, 208);
});

test('ATT&CK importer deterministically selects active enterprise patterns and accounts for overlapping exclusion flags', () => {
  const objects = [pattern('T1000.001'), pattern('T1003', { revoked: true, x_mitre_deprecated: true }),
    pattern('T1002', { x_mitre_deprecated: true }), pattern('T1000'), pattern('T1001', { revoked: true }),
    { type: 'malware', name: 'Not a technique' }];
  const output = projectAttackBundle(bundle(objects));
  assert.deepEqual(ids(output.techniques), ['T1000', 'T1000.001']);
  assert.deepEqual(ids(output.projection.excluded), ['T1001', 'T1002', 'T1003']);
  assert.equal(output.projection.sourceObjectCount, 6);
  assert.equal(output.projection.attackPatternCount, 5);
  assert.equal(output.projection.activeTechniqueCount, 1);
  assert.equal(output.projection.activeSubtechniqueCount, 1);
  assert.equal(output.projection.excludedCount, 3);
  assert.equal(output.projection.revokedCount, 2);
  assert.equal(output.projection.deprecatedCount, 2);
  assert.equal(output.projection.revokedAndDeprecatedCount, 1);
  assert.equal(serializeAttackCatalog(output), serializeAttackCatalog(projectAttackBundle(bundle(objects.toReversed()))));
});

test('ATT&CK importer rejects ambiguous or unsupported projection input instead of silently dropping active entries', () => {
  for (const [objects, message] of [
    [[pattern('T1000'), pattern('T1000')], /Duplicate/],
    [[pattern('T1000', { x_mitre_domains: ['mobile-attack'] })], /domain/],
    [[pattern('invalid')], /reference/],
    [[pattern('T1000', { name: '' })], /name\/URL/],
    [[pattern('T1000', { revoked: 'false' })], /Invalid revoked/],
    [[pattern('T1000', { external_references: [] })], /reference/],
    [[pattern('T1000', { external_references: [pattern('T1000').external_references[0],
      pattern('T1001').external_references[0]] })], /reference/],
    [[pattern('T1000.001')], /Missing active parent/],
    [[pattern('T1000.001', { x_mitre_is_subtechnique: false })], /subtechnique flag/],
    [[pattern('T1000', { external_references: [{ source_name: 'mitre-attack', external_id: 'T1000',
      url: 'https://example.invalid/T1000' }] })], /name\/URL/],
  ]) assert.throws(() => projectAttackBundle(bundle(objects)), message);
  assert.throws(() => projectAttackBundle({ objects: [] }), /STIX bundle/);
});
