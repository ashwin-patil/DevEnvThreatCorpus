export const CATEGORY_EXTRACTION_VERSION = 'campaign-category-rules/1';
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

const AI = /\b(?:AI|LLMs?|Claude(?: Code)?|Gemini(?: CLI)?|Amazon Q|Q CLI|ChatGPT|assistants?|agents?)\b/i;
const EXPLICIT_AI = /\b(?:AI|LLMs?|Claude|Gemini|Amazon Q|Q CLI|ChatGPT)\b/i;
const INELIGIBLE = /\b(?:recommend\w*|investigat\w*|should|would|could|may|might|hypothetic\w*|potential\w*|defen[cd]\w*|mitigat\w*)\b/i;
const NEGATED = /\b(?:no|not|never|without|rather than|denied|denies|didn't|doesn't|did not|does not)\b/i;
const STATES = new Set(['Source-reported observation', 'Attempted behavior', 'Demonstrated capability or proof of concept']);

function matches(rule, sentence) {
  if (INELIGIBLE.test(sentence) || NEGATED.test(sentence)) return false;
  if (rule.id === 'victim-agent') return AI.test(sentence)
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
    && /\b(?:malicious|prompt injection|evad\w*|bypass\w*|manipulat\w*|deceiv\w*)\b/i.test(sentence);
  return /\b(?:recruiter|job|interview|coding (?:task|test|challenge)|technical assessment|hiring|developers?)\b/i.test(sentence)
    && /\b(?:lure[ds]?|social engineering|impersonat\w*|malicious|fake|deceptive|trojan\w*)\b/i.test(sentence)
    && /\b(?:lure|trick|induc|invit|persuad|ask|execut|run|clon|download|install|open)\w*/i.test(sentence);
}

// Classify individual source-linked assertions, never a bag of article keywords.
// These conservative lexical proposals do not decide actor intent or success.
export function proposeCampaignCategories(corpus, claimIds = corpus.claims.map(c => c.id)) {
  const selected = new Set(claimIds), proposals = [];
  for (const claim of corpus.claims) {
    if (!selected.has(claim.id) || !STATES.has(claim.evidenceStatus) || claim.inference
      || claim.disposition === 'Excluded' || claim.disposition === 'Needs correction') continue;
    const source = corpus.sources.find(s => s.id === claim.sourceId);
    const revision = corpus.sourceRevisions.find(r => r.id === claim.sourceRevisionId);
    if (!source?.revisionIds.includes(claim.sourceRevisionId) || revision?.sourceId !== source.id
      || !corpus.cases.some(c => c.id === claim.caseId && c.sourceIds.includes(source.id))
      || !claim.passageIds.some(id => corpus.passages.some(p => p.id === id && p.sourceRevisionId === revision.id))) continue;
    const sentences = claim.description.split(/(?<=[.!?])\s+|[\r\n]+/u).filter(s => s.length <= 700);
    for (const rule of CAMPAIGN_CATEGORIES) if (sentences.some(sentence => matches(rule, sentence))) {
      proposals.push({
        id: `category-rules-1:${rule.id}:${claim.id}`, caseId: claim.caseId,
        dimension: rule.dimension, value: rule.value, otherText: null,
        sourceIds: [claim.sourceId], supportingClaimIds: [claim.id],
        origin: 'Deterministic rule', disposition: 'Pending', revision: 'r1', history: [], nullReasons: { otherText: 'not_applicable' },
      });
    }
  }
  return proposals.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function applyCampaignCategories(corpus, claimIds) {
  const added = [];
  for (const proposal of proposeCampaignCategories(corpus, claimIds)) {
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
  return record.origin === 'Deterministic rule'
    ? CAMPAIGN_CATEGORIES.find(rule => record.id.startsWith(`category-rules-1:${rule.id}:`)) : undefined;
}

export function campaignCategoryGroups(corpus, caseId) {
  const records = campaignCategories(corpus, caseId);
  return CAMPAIGN_CATEGORIES.map(rule => {
    const members = records.filter(c => c.value === rule.value && c.dimension === rule.dimension);
    const states = [...new Set(members.map(c => c.itemReview?.state ?? c.disposition))];
    return { ...rule, records: members, state: states.length === 1 ? states[0] : 'Mixed review states' };
  }).filter(group => group.records.length);
}
