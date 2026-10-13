// Presentation-only normalization; source records, provenance and review stay intact.
export const PUBLISHER_NAMES = Object.freeze({
  'nx.dev': 'Nx', 'stepsecurity.io': 'StepSecurity', 'socket.dev': 'Socket',
  'redcanary.com': 'Red Canary', 'pillar.security': 'Pillar Security',
  'unit42.paloaltonetworks.com': 'Unit 42', 'snyk.io': 'Snyk', 'wiz.io': 'Wiz',
  'microsoft.com': 'Microsoft', 'github.blog': 'GitHub',
  'attack.mitre.org': 'MITRE ATT&CK', 'atlas.mitre.org': 'MITRE ATLAS',
});
export function publisherDisplay(source) {
  let host = '';
  for (const url of [source.canonicalUrl, source.originalUrl]) {
    try { const parsed = new URL(url); if (['http:', 'https:'].includes(parsed.protocol)) { host = parsed.hostname.toLowerCase(); break; } } catch { /* Missing metadata remains explicit. */ }
  }
  const name = Object.entries(PUBLISHER_NAMES).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1];
  if (name) return { name, basis: 'normalized URL host' };
  if (source.publisher?.trim()) return { name: source.publisher.trim(), basis: 'reported publisher' };
  return { name: host.replace(/^www\./, '') || 'Publisher not reported', basis: host ? 'URL host; publisher unverified' : 'unavailable' };
}
const CONCEPTS = [
  { id: 'local-ai-invocation', name: 'Local AI CLI invocation', pattern: /(?:ai|coding|local).*?(?:cli|agent|assistant).*?(?:invoc|launch|use)|malware\s*→\s*local coding agent/i },
  { id: 'filesystem-secret-discovery', name: 'Filesystem secret discovery', pattern: /filesystem.*?(?:secret|credential)|(?:secret|credential).*?(?:scan|discover)/i },
  { id: 'package-install-execution', name: 'Package installation execution', pattern: /(?:install|package).*?(?:execution|execute)|trusted install\s*→/i },
  { id: 'tool-instruction-change', name: 'Tool instruction change', pattern: /(?:tool|metadata).*?(?:instruction|poison|change)/i },
  { id: 'repository-data-transfer', name: 'Repository data transfer', pattern: /(?:data|exfil).*?(?:repository|github)|collected data\s*→/i },
];
export function behaviorInventory(records) {
  const groups = new Map();
  for (const record of records) {
    const activityPattern = record.kind === 'activity-pattern' || /→|->/.test(record.name);
    const concept = CONCEPTS.find(c => c.pattern.test(`${record.name} ${record.description ?? ''} ${record.boundary ?? ''}`));
    const normalizedName = record.name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const kind = activityPattern ? 'activity-pattern' : 'atomic-behavior';
    const key = `${kind}:${concept?.id ?? normalizedName}`;
    if (!groups.has(key)) groups.set(key, { id: key, name: concept?.name ?? record.name, kind,
      basis: concept ? 'Suggested local concept; lexical matching, human confirmation required.' : 'Normalized label equality; semantic equivalence is not established.', members: [] });
    groups.get(key).members.push(record);
  }
  return [...groups.values()];
}
