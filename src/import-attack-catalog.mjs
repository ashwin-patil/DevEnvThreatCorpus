// Generation only; never imported by the application. Reproduce from immutable
// upstream bytes: node src/import-attack-catalog.mjs [--check]
// Offline: node src/import-attack-catalog.mjs [--check] MATERIAL.json LICENSE.txt
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const revision = '6cda5ad8462c79e14fbb872f4e09059b18e0cfc4';
const upstream = 'https://github.com/mitre-attack/attack-stix-data';
const materialPath = 'enterprise-attack/enterprise-attack-19.2.json';
export const ATTACK_PIN = Object.freeze({
  framework: 'ATT&CK',
  version: '19.2',
  // Retain the existing source identity, including the original retrieval date.
  sourceResolverVersion: 'pinned-catalog-resolver/1',
  upstream,
  immutableRevision: revision,
  materialUrl: `${upstream}/blob/${revision}/${materialPath}`,
  materialDigest: 'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4',
  gitBlobSha: '8b8a9c8cc9e553f96f963b91265f50ee0854636d',
  retrievalDate: '2026-10-13',
  license: 'MITRE ATT&CK Terms of Use (LICENSE.txt at the pinned revision)',
  licenseUrl: `${upstream}/blob/${revision}/LICENSE.txt`,
  licenseDigest: '738144f7fb054722a4ef9d3367c51710341dc12fc574c6ac3a41daaaecd8bf5e',
  licenseGitBlobSha: '7d8dc97542672cc9ec78de1b643b5b39ca7e2fba',
});

const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
function verifyBytes(bytes, sha256, blob, label) {
  if (hash('sha256', bytes) !== sha256) throw new Error(`${label} SHA256 mismatch`);
  const gitBytes = Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]);
  if (hash('sha1', gitBytes) !== blob) throw new Error(`${label} Git blob mismatch`);
}
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// Kept separate from byte verification so filtering/validation can be tested
// with small synthetic STIX bundles. Production generation always verifies first.
export function projectAttackBundle(bundle) {
  if (bundle.type !== 'bundle' || !Array.isArray(bundle.objects)) throw new Error('Expected STIX bundle');
  const techniques = [], excluded = [], seen = new Set();
  let attackPatternCount = 0, activeSubtechniqueCount = 0;
  for (const object of bundle.objects) {
    if (object.type !== 'attack-pattern') continue;
    attackPatternCount++;
    if (!Array.isArray(object.x_mitre_domains) ||
        object.x_mitre_domains.length !== 1 || object.x_mitre_domains[0] !== 'enterprise-attack') {
      throw new Error('Expected enterprise-attack domain');
    }
    const refs = object.external_references?.filter(ref => ref.source_name === 'mitre-attack');
    const ref = refs?.[0];
    if (refs?.length !== 1 || !/^T\d{4}(?:\.\d{3})?$/.test(ref?.external_id)) {
      throw new Error('Invalid ATT&CK technique reference');
    }
    const id = ref.external_id;
    if (seen.has(id)) throw new Error(`Duplicate ATT&CK ID: ${id}`);
    seen.add(id);
    for (const flag of ['revoked', 'x_mitre_deprecated', 'x_mitre_is_subtechnique']) {
      if (object[flag] !== undefined && typeof object[flag] !== 'boolean') throw new Error(`Invalid ${flag}: ${id}`);
    }
    const revoked = object.revoked === true, deprecated = object.x_mitre_deprecated === true;
    if (revoked || deprecated) {
      excluded.push({ id, revoked, deprecated });
      continue;
    }
    if (typeof object.name !== 'string' || !object.name.trim() ||
        typeof ref.url !== 'string' ||
        ![ `https://attack.mitre.org/techniques/${id.replace('.', '/')}`,
          `https://attack.mitre.org/techniques/${id.replace('.', '/')}/` ].includes(ref.url)) {
      throw new Error(`Invalid ATT&CK name/URL: ${id}`);
    }
    const subtechnique = id.includes('.');
    if (subtechnique !== (object.x_mitre_is_subtechnique === true)) throw new Error(`Invalid subtechnique flag: ${id}`);
    if (subtechnique) activeSubtechniqueCount++;
    techniques.push({ id, name: object.name, url: ref.url });
  }
  techniques.sort(byId);
  excluded.sort(byId);
  const activeIds = new Set(techniques.map(t => t.id));
  for (const { id } of techniques) {
    if (id.includes('.') && !activeIds.has(id.split('.')[0])) throw new Error(`Missing active parent: ${id}`);
  }
  return {
    projection: {
      formatVersion: 'attack-enterprise-active/1',
      selection: 'All enterprise attack-pattern objects except revoked or x_mitre_deprecated; other STIX object types are not resolver techniques.',
      sourceObjectCount: bundle.objects.length,
      attackPatternCount,
      activeTechniqueCount: techniques.length - activeSubtechniqueCount,
      activeSubtechniqueCount,
      excludedCount: excluded.length,
      revokedCount: excluded.filter(t => t.revoked).length,
      deprecatedCount: excluded.filter(t => t.deprecated).length,
      revokedAndDeprecatedCount: excluded.filter(t => t.revoked && t.deprecated).length,
      excluded,
    },
    techniques,
  };
}

export function buildAttackCatalog(materialBytes, licenseBytes) {
  verifyBytes(materialBytes, ATTACK_PIN.materialDigest, ATTACK_PIN.gitBlobSha, 'Material');
  verifyBytes(licenseBytes, ATTACK_PIN.licenseDigest, ATTACK_PIN.licenseGitBlobSha, 'License');
  return {
    ...ATTACK_PIN,
    // Exact upstream notice, including copyright designation and disclaimers.
    licenseText: licenseBytes.toString('utf8'),
    ...projectAttackBundle(JSON.parse(materialBytes.toString('utf8'))),
  };
}

export const serializeAttackCatalog = catalog => `${JSON.stringify(catalog, null, 2)}\n`;

async function main(args) {
  const check = args[0] === '--check';
  if (check) args = args.slice(1);
  if (![0, 2].includes(args.length) || args.some(arg => arg.startsWith('--'))) {
    throw new Error('Usage: node src/import-attack-catalog.mjs [--check] [MATERIAL.json LICENSE.txt]');
  }
  const download = async path => {
    const response = await fetch(`https://raw.githubusercontent.com/mitre-attack/attack-stix-data/${revision}/${path}`);
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}: ${path}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const [material, license] = await Promise.all(args.length
    ? args.map(file => readFile(file))
    : [download(materialPath), download('LICENSE.txt')]);
  const catalog = buildAttackCatalog(material, license);
  const serialized = serializeAttackCatalog(catalog);
  const destination = new URL('./attack-catalog.json', import.meta.url);
  if (check) {
    if (await readFile(destination, 'utf8') !== serialized) throw new Error('ATT&CK catalogue is not reproducible');
  } else {
    await writeFile(destination, serialized, 'utf8');
  }
  console.log(`${check ? 'Verified' : 'Generated'} ATT&CK ${catalog.version}: ${catalog.techniques.length} active entries, ${catalog.projection.excludedCount} excluded`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
