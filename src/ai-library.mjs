// Read-only projections over grounded annotations. Never infer tool use from article-wide mentions.
export const ARTIFACT_USAGE = Object.freeze(['targeted', 'attempted-abuse', 'reported-abuse', 'vendor-example', 'general-mention', 'unclear']);
const TOOLS = [
  ['claude-code', 'Claude Code', ['claude code', 'claude']],
  ['gemini-cli', 'Gemini CLI', ['gemini cli', 'gemini']],
  ['openai-codex', 'OpenAI Codex', ['openai codex', 'codex cli', 'codex']],
  ['amazon-q', 'Amazon Q', ['amazon q', 'amazon q developer', 'amazon q developer cli', 'q']],
  ['warp', 'Warp', ['warp']],
];
export function toolIdentity(literal) {
  const key = literal.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ');
  const match = TOOLS.find(t => t[2].includes(key));
  // Executable aliases apply only to extracted ide-cli artifacts, never arbitrary commands.
  return match ? { id: `ai-tool-${match[0]}`, name: match[1], basis: key === 'q'
    ? 'Amazon Q CLI executable alias; original q literal retained. Reference: https://aws.amazon.com/about-aws/whats-new/2025/06/amazon-q-developer-cli-claude-sonnet-4/' : 'Known product alias' }
    : { id: null, name: literal, basis: 'Unresolved source literal; product identity unconfirmed' };
}
export function aiLibrary(model, view, caseIds = new Set(model.corpus.cases.map(c => c.id))) {
  const groups = new Map();
  for (const a of model.annotations ?? []) {
    if (a.type !== 'commands-ai-artifacts' || !caseIds.has(a.caseId)) continue;
    const kind = a.context?.artifactKind;
    if (view === 'tools' ? kind !== 'ide-cli' : kind !== 'prompt-instruction') continue;
    const identity = view === 'tools' ? toolIdentity(a.value) : null;
    // Exact prompt equality only: whitespace, case and code points retain detection significance.
    const key = identity?.id ?? `${kind}:${a.value}`;
    if (!groups.has(key)) groups.set(key, { id: identity?.id ?? `${view}-${a.id}`,
      name: identity?.name ?? (view === 'prompts' ? a.normalizedValue ?? `${a.value.slice(0, 72)}${a.value.length > 72 ? '…' : ''}` : a.value),
      basis: identity?.basis ?? 'Exact literal equality; similar prompts remain separate variants', annotations: [], caseIds: [] });
    const group = groups.get(key);
    group.annotations.push(a);
    if (!group.caseIds.includes(a.caseId)) group.caseIds.push(a.caseId);
  }
  return [...groups.values()];
}
