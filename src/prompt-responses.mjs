export const RESPONSE_VERSION = 'prompt-response/1';
export const RESPONSE_OUTCOMES = ['refusal', 'partial', 'compliance-reported', 'error', 'unknown'];
export const OBSERVATION_CONTEXTS = {
  'researcher-test': 'Researcher-controlled test',
  'compromised-host': 'Reported compromised-host evidence',
  'reported-log-review': 'Source-reported log review; environment unspecified',
  'illustrative-example': 'Illustrative example',
  unknown: 'Unknown observation environment',
};
const text = { type: 'string', minLength: 1, maxLength: 16384 };
const supportSchema = {
  type: 'object', additionalProperties: false, required: ['locator', 'sha256'],
  properties: {
    locator: { type: 'object', additionalProperties: false, required: ['start', 'end'],
      properties: { start: { type: 'integer', minimum: 0 }, end: { type: 'integer', minimum: 1 } } },
    sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  },
};
export const responseSchema = {
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'id', 'text', 'encoding', 'role', 'agent', 'model', 'outcome',
    'observationContext', 'contextBasis', 'pairingBasis', 'claimIds', 'revisionHash', 'support', 'contextSupport'],
  properties: {
    schemaVersion: { const: RESPONSE_VERSION }, id: text, text: { anyOf: [text, { const: null }] },
    encoding: { enum: ['plain-text', 'json-string'] }, role: { enum: ['assistant', 'tool', 'unspecified'] },
    agent: text, model: text, outcome: { enum: RESPONSE_OUTCOMES },
    observationContext: { enum: Object.keys(OBSERVATION_CONTEXTS) },
    contextBasis: text, pairingBasis: text,
    claimIds: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: text },
    revisionHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    support: supportSchema, contextSupport: supportSchema,
  },
};
const validText = value => typeof value === 'string' && !!value.trim() && value.length <= 16384 && !value.includes('\0');
const validLocator = locator => Number.isSafeInteger(locator?.start) && Number.isSafeInteger(locator?.end)
  && locator.start >= 0 && locator.end > locator.start;
export function responseSupportText(revision, support) {
  return typeof revision?.normalizedContent === 'string' && validLocator(support?.locator)
    ? [...revision.normalizedContent].slice(support.locator.start, support.locator.end).join('') : null;
}
export const decodeResponse = (raw, encoding) => encoding === 'json-string' ? JSON.parse(raw) : raw;

// Public projections can check scope/shape/receipts, but cannot reverify omitted article text.
export function validatePromptResponses(annotation, corpus, { publicProjection = false } = {}) {
  const responses = annotation.responses;
  if (responses === undefined) return [];
  const errors = [], reject = message => errors.push(`prompt responses: ${message}`);
  if (!Array.isArray(responses) || responses.length > 20) return ['prompt responses: invalid response list'];
  if (annotation.type !== 'commands-ai-artifacts' || annotation.context?.artifactKind !== 'prompt-instruction') {
    return ['prompt responses: only prompt occurrences may contain responses'];
  }
  const revision = corpus.sourceRevisions.find(r => r.id === annotation.sourceRevisionId);
  const seen = new Set();
  for (const response of responses) {
    if (!response || typeof response !== 'object' || Array.isArray(response)
      || Object.keys(response).some(key => !Object.hasOwn(responseSchema.properties, key))
      || responseSchema.required.some(key => !Object.hasOwn(response, key))
      || response.schemaVersion !== RESPONSE_VERSION || !validText(response.id) || seen.has(response.id)
      || !['plain-text', 'json-string'].includes(response.encoding)
      || !['assistant', 'tool', 'unspecified'].includes(response.role)
      || !RESPONSE_OUTCOMES.includes(response.outcome)
      || !Object.hasOwn(OBSERVATION_CONTEXTS, response.observationContext)
      || ['agent', 'model', 'contextBasis', 'pairingBasis'].some(key => !validText(response[key]))
      || !(response.text === null || validText(response.text))
      || !/^[a-f0-9]{64}$/.test(response.revisionHash ?? '')
      || response.revisionHash !== revision?.normalizedHash
      || revision?.sourceId !== annotation.sourceId
      || !Array.isArray(response.claimIds) || !response.claimIds.length || response.claimIds.length > 20
      || new Set(response.claimIds).size !== response.claimIds.length) {
      reject('invalid shape, identity, revision or classification'); continue;
    }
    seen.add(response.id);
    for (const id of response.claimIds) {
      const claim = corpus.claims.find(c => c.id === id);
      if (!claim || claim.caseId !== annotation.caseId || claim.sourceId !== annotation.sourceId
        || claim.sourceRevisionId !== annotation.sourceRevisionId) reject('response evidence must stay source-local');
    }
    for (const support of [response.support, response.contextSupport]) {
      if (!support || Object.keys(support).some(key => !['locator', 'sha256'].includes(key))
        || !validLocator(support.locator) || Object.keys(support.locator).some(key => !['start', 'end'].includes(key))
        || !/^[a-f0-9]{64}$/.test(support.sha256 ?? '')) {
        reject('invalid response/context receipt'); continue;
      }
      if (!publicProjection && (typeof revision?.normalizedContent !== 'string'
        || support.locator.end > [...revision.normalizedContent].length)) reject('response support requires retained text');
    }
    const promptSupport = annotation.support?.locator;
    if (!validLocator(promptSupport)) reject('exact prompt support is required for response pairing');
    if (!publicProjection) {
      const prompt = responseSupportText(revision, annotation.support);
      const raw = responseSupportText(revision, response.support);
      if (prompt !== annotation.value) reject('paired prompt literal differs from retained source');
      try {
        const decoded = decodeResponse(raw, response.encoding);
        if (typeof decoded !== 'string' || (response.text !== null && decoded !== response.text)) reject('response literal differs from retained source');
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        reject('invalid published response encoding');
      }
    }
  }
  return errors;
}
