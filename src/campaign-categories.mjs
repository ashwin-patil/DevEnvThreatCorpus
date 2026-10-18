export const CATEGORY_EXTRACTION_VERSION = 'campaign-category-rules/1';
export const TELEMETRY_SCOPE_VERSION = 'telemetry-scope-rules/1';
export const CAMPAIGN_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'victim-agent', dimension: 'ai_involvement', value: 'Victim-side agent abuse',
    description: 'Attempted or reported misuse of an AI agent installed or authenticated in the victim environment.' }),
  Object.freeze({ id: 'attacker-ai', dimension: 'ai_involvement', value: 'Attacker-side AI use',
    description: 'An adversary uses AI to develop or operate an attack; not merely an attacker invoking a victim agent.' }),
  Object.freeze({ id: 'ai-review', dimension: 'ai_involvement', value: 'AI review targeting',
    description: 'Malicious content attempts to manipulate or evade an AI code/security reviewer.' }),
  Object.freeze({ id: 'developer-lure', dimension: 'trust_surface', value: 'Developer-targeted social engineering',
    description: 'Deceptive developer, recruiting or coding-task interactions induce execution or access.' }),
]);
export const TELEMETRY_CATEGORIES = Object.freeze([
  { id: 'endpoint', value: 'Endpoint telemetry', description: 'EDR process/command-line and file activity. File-read visibility depends on sensor/audit configuration.' },
  { id: 'ci-cd', value: 'CI/CD audit', description: 'Workflow/job/run logs and runner audit records. Retention, permissions and runner instrumentation vary.' },
  { id: 'source-control', value: 'Source-control audit', description: 'Repository, visibility, permission and API audit logs. Organization audit does not cover every personal-account action.' },
  { id: 'cloud', value: 'Cloud control-plane audit', description: 'CloudTrail, Azure Activity or Google Cloud Audit Logs for management/API activity; credential theft alone does not establish cloud activity.' },
  { id: 'identity', value: 'Identity & access logs', description: 'IdP sign-in, authentication, consent and token/session lifecycle audit. Reading a local secret is not automatically an IdP event.' },
  { id: 'network', value: 'Network & DNS telemetry', description: 'Enterprise DNS, proxy, firewall and network-flow logs. TLS payloads and file contents are not assumed visible.' },
  { id: 'agent', value: 'AI agent observability', description: 'Agent/CLI transcripts, tool-call and model-operation traces when instrumented. Message content is sensitive and not enabled or retained by default.' },
  { id: 'supply-chain', value: 'Package & build provenance', description: 'Registry publish/install metadata, dependency/build records and provenance attestations where the enterprise controls collection.' },
].map(rule => Object.freeze({ ...rule, dimension: 'telemetry_scope' })));
export const ALL_CAMPAIGN_CATEGORIES = Object.freeze([...CAMPAIGN_CATEGORIES, ...TELEMETRY_CATEGORIES]);

const EXPLICIT_AI = /\b(?:AI|LLMs?|Claude|Gemini|Amazon Q|Q CLI|ChatGPT)\b/i;
const INELIGIBLE = /\b(?:recommend\w*|investigat\w*|should|would|could|may|might|hypothetic\w*|potential\w*|defen[cd]\w*|mitigat\w*)\b/i;
const NEGATED = /\b(?:no|not|never|without|rather than|denied|denies|didn't|doesn't|did not|does not)\b/i;
const STATES = new Set(['Source-reported observation', 'Attempted behavior', 'Demonstrated capability or proof of concept']);

function matches(rule, sentence) {
  if (INELIGIBLE.test(sentence) || NEGATED.test(sentence)) return false;
  if (rule.id === 'victim-agent') return EXPLICIT_AI.test(sentence)
    && !/\b(?:their own|attacker-controlled|attacker-owned)\s+(?:AI|LLM|Claude|Gemini|agent)/i.test(sentence)
    && (/\bvictim(?:[- ]side)?\b/i.test(sentence)
      || (/\b(?:local|installed|authenticated)\b/i.test(sentence)
        && /\b(?:payload|malware|postinstall|malicious (?:script|package|prompt))\b/i.test(sentence)))
    && /\b(?:abus\w*|misus\w*|reconnaissance|invok\w*|malicious prompt|instruct\w*|attempted use)\b/i.test(sentence);
  if (rule.id === 'attacker-ai') {
    const actorUse = /\b(?:attackers?|adversar(?:y|ies)|threat actors?|operators?)\s+(?:(?:reportedly|directly)\s+)?(?:used?|uses|leveraged?|employed?|operated?|ran)\s+(?:(?:their|own|an?|the)\s+){0,3}(?:AI|LLMs?|ChatGPT|Claude|Gemini)\b/i;
    const own = /\btheir own\s+(?:AI|LLM|Claude|Gemini|agent)/i.test(sentence);
    return actorUse.test(sentence)
      && (own || /\bto (?:generate|write|create|develop|plan|automate)\b/i.test(sentence))
      && (own || !/\b(?:victim|local|installed|authenticated)\b/i.test(sentence));
  }
  if (rule.id === 'ai-review') return EXPLICIT_AI.test(sentence)
    && /\b(?:(?:code|security)\s+review(?:er|s)?|AI[- ]review(?:er|s)?|LLM[- ]review(?:er|s)?)\b/i.test(sentence)
    && /\b(?:evad\w*|bypass\w*|manipulat\w*|deceiv\w*|subvert\w*|trick\w*|mislead\w*)\b/i.test(sentence);
  return /\b(?:recruiter|job|interview|coding (?:task|test|challenge)|technical assessment|hiring|developers?)\b/i.test(sentence)
    && /\b(?:lure[ds]?|social engineering|impersonat\w*|trick\w*|deceiv\w*|fake|deceptive|trojan\w*)\b/i.test(sentence)
    && /\b(?:lure|trick|induc|invit|persuad|ask|execut|run|clon|download|install|open)\w*/i.test(sentence);
}

function linkedClaims(corpus, claimIds) {
  const selected = new Set(claimIds ?? corpus.claims.map(c => c.id));
  return corpus.claims.filter(claim => {
    if (!selected.has(claim.id) || !STATES.has(claim.evidenceStatus) || claim.inference
      || claim.disposition === 'Excluded' || claim.disposition === 'Needs correction') return false;
    const source = corpus.sources.find(s => s.id === claim.sourceId);
    const revision = corpus.sourceRevisions.find(r => r.id === claim.sourceRevisionId);
    if (!source?.revisionIds.includes(claim.sourceRevisionId) || revision?.sourceId !== source.id
      || !corpus.cases.some(c => c.id === claim.caseId && c.sourceIds.includes(source.id))
      || !claim.passageIds.some(id => corpus.passages.some(p => p.id === id && p.sourceRevisionId === revision.id))) return false;
    return true;
  });
}
function proposal(rule, claim, prefix) {
  return {
    id: `${prefix}:${rule.id}:${claim.id}`, caseId: claim.caseId,
    dimension: rule.dimension, value: rule.value, otherText: null,
    sourceIds: [claim.sourceId], supportingClaimIds: [claim.id],
    origin: 'Deterministic rule', disposition: 'Pending', revision: 'r1', history: [], nullReasons: { otherText: 'not_applicable' },
  };
}

// Classify individual source-linked assertions, never a bag of article keywords.
// These conservative lexical proposals do not decide actor intent or success.
export function proposeCampaignCategories(corpus, claimIds) {
  const proposals = [];
  for (const claim of linkedClaims(corpus, claimIds)) {
    const sentences = claim.description.split(/(?<=[.!?])\s+|[\r\n]+/u).filter(s => s.length <= 700);
    for (const rule of CAMPAIGN_CATEGORIES) if (sentences.some(sentence => matches(rule, sentence))) {
      proposals.push(proposal(rule, claim, 'category-rules-1'));
    }
  }
  return proposals.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function telemetryMatch(id, sentence) {
  if (INELIGIBLE.test(sentence) || NEGATED.test(sentence)) return false;
  if (id === 'endpoint') return /\b(?:postinstall|shell|bashrc|zshrc|filesystem|local files?|endpoint|process|telemetry\.js|npm (?:install|run)|sudo shutdown)\b/i.test(sentence);
  if (id === 'ci-cd') return /\b(?:GitHub Actions|pull_request_target|workflows?|build pipelines?|CI runners?|CI\/CD)\b/i.test(sentence);
  if (id === 'source-control') return /\b(?:GitHub|GitLab|Bitbucket|repositories|repository)\b/i.test(sentence)
    && /\b(?:creat|upload|exfiltrat|publis|visib|public|push|permission|token|leak|clon)\w*/i.test(sentence);
  if (id === 'cloud') return /\b(?:AWS|Azure|GCP|CloudTrail|cloud)\b/i.test(sentence)
    && /\b(?:API calls?|control[- ]plane|role assignments?|IAM polic(?:y|ies)|cloud resources|management operations)\b/i.test(sentence);
  if (id === 'identity') return /\b(?:sign[- ]in|OAuth (?:consent|grant|authoriz\w*)|authentication (?:event|log|attempt)|identity provider|service principal (?:sign|auth)|(?:token|session) (?:issuance|revocation))\b/i.test(sentence);
  if (id === 'network') return /\b(?:exfiltrat\w*|upload\w*|outbound|egress|DNS|HTTP(?:S)?|network connections?|curl|wget)\b/i.test(sentence);
  if (id === 'agent') return EXPLICIT_AI.test(sentence) && /\b(?:invok\w*|prompts?|CLI|refus\w*|agents?|tool[- ]calls?|transcripts?|reconnaissance)\b/i.test(sentence);
  return /\b(?:npm|packages?|registry|provenance|artifacts?|dependenc(?:y|ies))\b/i.test(sentence)
    && /\b(?:publish|install|release|version|compromis|postinstall|build|signature|provenance)\w*/i.test(sentence);
}
export function proposeTelemetryCategories(corpus, claimIds) {
  const proposals = [];
  for (const claim of linkedClaims(corpus, claimIds)) {
    const sentences = claim.description.split(/(?<=[.!?])\s+|[\r\n]+/u).filter(s => s.length <= 700);
    for (const rule of TELEMETRY_CATEGORIES) if (sentences.some(sentence => telemetryMatch(rule.id, sentence))) {
      proposals.push(proposal(rule, claim, 'telemetry-scope-rules-1'));
    }
  }
  return proposals.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function applyCampaignCategories(corpus, claimIds) {
  const added = [];
  for (const proposal of [...proposeCampaignCategories(corpus, claimIds), ...proposeTelemetryCategories(corpus, claimIds)]) {
    const existing = corpus.categorizations.find(c => c.id === proposal.id);
    if (existing) {
      for (const key of ['caseId', 'dimension', 'sourceIds', 'supportingClaimIds', 'origin']) {
        if (JSON.stringify(existing[key]) !== JSON.stringify(proposal[key])) {
          throw Object.assign(new Error(`Campaign category identity collision: ${proposal.id}`), { code: 'CATEGORY_COLLISION' });
        }
      }
      continue; // Preserve corrections and decisions; regeneration never approves or resets them.
    }
    corpus.categorizations.push(proposal); added.push(proposal.id);
  }
  return added;
}

export function campaignCategories(corpus, caseId) {
  return corpus.categorizations.filter(c => c.caseId === caseId && c.disposition !== 'Excluded'
    && CAMPAIGN_CATEGORIES.some(rule => c.dimension === rule.dimension && c.value === rule.value));
}

export function categoryRule(record) {
  if (record.origin !== 'Deterministic rule') return;
  const rule = CAMPAIGN_CATEGORIES.find(rule => record.id.startsWith(`category-rules-1:${rule.id}:`));
  if (rule) return { ...rule, version: CATEGORY_EXTRACTION_VERSION };
  const scope = TELEMETRY_CATEGORIES.find(rule => record.id.startsWith(`telemetry-scope-rules-1:${rule.id}:`));
  return scope ? { ...scope, version: TELEMETRY_SCOPE_VERSION } : undefined;
}

function groups(corpus, caseId, rules, sourceIds) {
  const records = corpus.categorizations.filter(c => c.caseId === caseId && c.disposition !== 'Excluded'
    && (!sourceIds || c.sourceIds.every(id => sourceIds.has(id))));
  return rules.map(rule => {
    const members = records.filter(c => c.value === rule.value && c.dimension === rule.dimension);
    const states = [...new Set(members.map(c => c.itemReview?.state ?? c.disposition))];
    return { ...rule, records: members, state: states.length === 1 ? states[0] : 'Mixed review states' };
  }).filter(group => group.records.length);
}
export const campaignCategoryGroups = (corpus, caseId, sourceIds) => groups(corpus, caseId, CAMPAIGN_CATEGORIES, sourceIds);
export const telemetryCategoryGroups = (corpus, caseId, sourceIds) => groups(corpus, caseId, TELEMETRY_CATEGORIES, sourceIds);
