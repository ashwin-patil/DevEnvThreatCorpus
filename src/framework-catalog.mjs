// Pinned projections of immutable official catalog assets; resolver input,
// not incident evidence. Projections retain their upstream license notices.
import { digest } from '../scripts/contract.mjs';
import atlas from './atlas-catalog.json' with { type: 'json' };
import attack from './attack-catalog.json' with { type: 'json' };

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const PINNED_FRAMEWORK_CATALOG = Object.freeze({
  resolverVersion: 'pinned-catalog-resolver/2',
  catalogs: Object.freeze([freeze(attack), freeze(atlas)]),
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
