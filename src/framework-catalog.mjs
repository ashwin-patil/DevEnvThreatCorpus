// Pinned projections of immutable official catalog assets; resolver input,
// not incident evidence. ATLAS adaptation retains its upstream license notice.
import { digest } from '../scripts/contract.mjs';
import atlas from './atlas-catalog.json' with { type: 'json' };

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const PINNED_FRAMEWORK_CATALOG = Object.freeze({
  resolverVersion: 'pinned-catalog-resolver/2',
  catalogs: Object.freeze([Object.freeze({
    framework: 'ATT&CK',
    version: '19.2',
    sourceResolverVersion: 'pinned-catalog-resolver/1',
    upstream: 'https://github.com/mitre-attack/attack-stix-data',
    immutableRevision: '6cda5ad8462c79e14fbb872f4e09059b18e0cfc4',
    materialUrl: 'https://github.com/mitre-attack/attack-stix-data/blob/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4/enterprise-attack/enterprise-attack-19.2.json',
    materialDigest: 'dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4',
    gitBlobSha: '8b8a9c8cc9e553f96f963b91265f50ee0854636d',
    retrievalDate: '2026-10-13',
    license: 'MITRE ATT&CK Terms of Use (LICENSE.txt at the pinned revision)',
    licenseUrl: 'https://github.com/mitre-attack/attack-stix-data/blob/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4/LICENSE.txt',
    techniques: Object.freeze([Object.freeze({
      id: 'T1059',
      name: 'Command and Scripting Interpreter',
      url: 'https://attack.mitre.org/techniques/T1059/',
    })]),
  }), freeze(atlas)]),
});

const SNAPSHOT = Object.freeze({
  resolverVersion: PINNED_FRAMEWORK_CATALOG.resolverVersion,
  digest: digest(PINNED_FRAMEWORK_CATALOG),
  catalogs: PINNED_FRAMEWORK_CATALOG.catalogs,
});

// Requests persist this digest so any resolver, provenance, or membership change
// invalidates the request hash and therefore produces a distinct run identity.
export function catalogSnapshot() {
  return structuredClone(SNAPSHOT);
}

export function catalogEntry(framework, version, techniqueId) {
  const catalog = PINNED_FRAMEWORK_CATALOG.catalogs
    .find(item => item.framework === framework && item.version === version);
  const technique = catalog?.techniques.find(item => item.id === techniqueId);
  return catalog && technique ? { catalog, technique } : null;
}
