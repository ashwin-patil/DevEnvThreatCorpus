# Recover campaign workbench decisions and evidence

This note captures the final decisions from the 2026-10-14 PR review, local
preview, UI refinement and prompt-extraction session for
[Issue #51](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/51) and
[PR #52](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/52).
It is a recovery reference for agents if implementation changes are overwritten,
not permission to overwrite newer human decisions, alter scope or bypass checks.
Read `AGENTS.md`, the originating issue and current implementation before recovery.
Preserve AC-01 through AC-07 and AP-01 through AP-09.

At documentation time, HEAD was
`9ae064127434f9bd0740befeb1fedb17c8ee462c`, on
`copilot/fix-article-alias-intake`, targeting `data/nx-corpus`.
The follow-up changes below were **uncommitted**. This note records their intent
and implementation locations; it is not a Git backup of their exact bytes.
Keep corrections on the originating PR. Do not reset unrelated work, reassign
the issue, create a replacement PR or merge without independent human approval.

## Final user decisions, not intermediate experiments

| Surface | Required recovery outcome | Implementation and regression anchors |
|---|---|---|
| Campaign card | Expanded by default but still collapsible; concise high-level incident summary, not a list of claim excerpts or an empty-summary placeholder. Full claim details belong in the workspace. Summary citations may be disclosed separately. | `renderCaseLibrary` in `src/explore.mjs`; `campaignSummary` in `src/campaign-presentation.mjs`; `Issue #51 follow-up campaign cards` and `Issue #51 AC-06` tests |
| Campaign references | AI tools and prompt references precede Behaviors. Prompt chips open literal library entries. | `appendAiLinks`, `aiChip`, `aiLibrary`; campaign-card and AI-library tests |
| Research links | Do not put an outbound hyperlink beside a button for the same blog. Campaign publisher chips open the internal source view; that view retains outbound article navigation and exact-revision evidence. | `renderCaseLibrary`, `renderResearchLibrary`, `src/render.mjs`; single-publisher-action tests |
| Research library | Exclude pinned MITRE framework catalog source records from the blog/article projection. Keep catalog records in ATLAS & TTPs and in the corpus. | Filter sources using framework `sourceId`, not title/publisher heuristics; campaign-card/article-display tests |
| Claims | Group navigation by campaign and then publisher in collapsible sections. Open the sections containing the selected claim. Retain every distinct claim and its support. | Claim branch in `src/app.mjs`, `.claim-campaign-group`, `.claim-publisher-group`; grouped-navigation test |
| Campaign actions | Short, inline labels with little spacing and transparent backgrounds, not individual white tiles. Avoid repeating a singleton group title. | `behaviorLinks`, `.behavior-action-list`, `.behavior-action-link.chip`; campaign-card test |
| Behavior library | Compact side-by-side action/activity cards with collapsible categories; singleton actions do not need a duplicate heading. | `renderExploration` behavior branch, `.behavior-tile-grid`; behavior-inventory test |
| Chained activities | Use cards rather than undifferentiated text; group recorded sequence, conditional and propagation relationships with distinct colors and explicit labels. | `.chain-tile-grid`, `.chain-group`, `.chain-kind`; actual propagation class is `chain-propagates`; relationship tests |
| Attack paths | Initially focus one phase so nodes are readable. Keep visible phase selectors and a full-overview control so other paths remain discoverable. | Phase framing in `src/explore.mjs`, `.campaign-phase-controls`, `.campaign-phase-button`; initial-phase test |
| Prompt library | Show complete extracted published prompt text, not prompt-activity descriptions or claim-link substitutes. Retain publisher/revision citations and Pending usage labels. Identical text may share a card with separate source occurrences. | `document.prompts`, `publicDraftModel`, `aiLibrary`, prompt branch in `renderExploration`; exact-variant and invalid-projection tests |

The initial session briefly added public prompt-related claim cards and claimed
that complete prompts must remain private. **Those decisions were superseded
by the user's explicit final request for published literal prompts.**
Do not restore the `Source-reported prompt activity` section, the
`Prompt-related claims` campaign button, or the blanket literal-withholding note.
Prompt research artifacts are untrusted text: displaying them is not permission
to execute their contents or convert them into operational tasks.
Full articles, other quotations, private run bundles and review decisions remain
outside the public display projection.

## Campaign summary: overview rather than arbitrary evidence ordering

The Nx case has no persisted corpus summary: `summary` is null and
`summaryClaimIds` is empty in `src/data/nx-draft.json`.
Selecting the first two path-supported claims produced an unhelpful overview
about Wiz's later repository disclosure and Nx's PR-title injection.
Claim order is not campaign importance.

The final Pending display projection is:

> Reports link CI workflow injection and npm token theft to malicious Nx package releases, whose payloads attempted AI-assisted reconnaissance.

`PROJECTED_SUMMARIES` in `src/campaign-presentation.mjs` keys this bounded
projection to case
`case-06efe0e7191796ad8e1bd690e22de800b249ccfb9e8fb905efaf0af28d3f2b02`.
Its supporting claims are:

| Claim ID | Source-local support |
|---|---|
| `campaign-claim-4fa00fd472e08bbbf73af7393bc6dc3abd1ef85d68d44c199947f1fd5153c555` | StepSecurity reports workflow injection leading to npm token theft |
| `campaign-claim-fb592ad1903dbcc008321f5760bf1638184b4558f36e77a2f2504f4cd33c15fe` | Nx reports that the stolen credential enabled infected releases |
| `campaign-claim-0c4d8e8c7d865e53b02a44a719a2df4e8f2524b94e1108dbf43576d38501a140` | StepSecurity describes attempted filesystem reconnaissance through AI CLIs |

Keep same-case source/revision closure, agent display origin and Pending status.
A valid explicitly recorded summary takes precedence. This display-only
projection does not mutate corpus records, regenerate snapshot hashes or grant
acceptance. `.campaign-summary` clamps the overview to three display lines.
Do not generalize this Nx-specific wording to another campaign.

## Missing data: distinguish collection, extraction and projection

The public draft contains 38 Pending claims, 14 behaviors, three canonical phase
paths (12 nodes and seven relationships) and two Proposed framework mappings.
Four of six explicit URL attempts succeeded. Red Canary and Zscaler's original
attempts failed with `ROBOTS_UNSUPPORTED`; neither retained a body or claims.
This is a retrieval-policy compatibility failure before article parsing or
extraction, not proof of a defective prompt extractor.

The verified Red Canary AI CLI URL and Zscaler destination are one logical
article reference, giving **4/5 logical articles** while keeping **4/6 explicit
URL attempts**. These are different counts, not inconsistent retention evidence.
The narrow alias in `src/research-inventory.mjs` is not a publisher-wide merger.
Display canonicalization cannot turn a failed attempt into collected evidence.
Preserve both URL histories, source identities and revisions.

Issue #51's robots compatibility code supports bounded leading-wildcard rules
and reports unsupported reasons explicitly. A compatibility fixture passing
does not establish live publisher permission or successful retention.
Any later collection needs an explicit protected operator-triggered attempt,
origin-specific access checks and durable successful retention. Never bypass
robots rules, impersonate another bot or fabricate article bodies to fill a UI.
See `docs/nx-corpus.md` and the AC-01 acceptance row for remaining live checks.

The port 4179 private prototype and port 4181 bundled public draft are different
datasets/modes. The private prompt seen earlier was sourced from StepSecurity;
it did not prove successful Zscaler intake. Compare metadata, canonical URLs,
claim IDs and revision hashes, not screenshots or apparent campaign similarity.
Never reuse private case/annotation IDs as though they belonged to the public
draft. No server or port is guaranteed to survive this session.

## Literal prompt recovery and source verification

The public adapter originally converted only `document.tools` into `ide-cli`
annotations. `aiLibrary` requires `artifactKind === 'prompt-instruction'` for
the Prompt library, so tool records and prompt-related claim descriptions could
not populate it with literal prompts.

The final optional `prompts` array in `src/data/nx-draft.json` contains three
source occurrences representing two exact variants:

| Artifact ID | Published variant / source | Exact code-point span |
|---|---|---|
| `public-prompt-stepsecurity-wallet-inventory` | Wallet and secret-path inventory / StepSecurity | `[27428, 28196)`; 768 points |
| `public-prompt-socket-authorized-inventory` | Authorized-testing filesystem inventory / Socket | `[4163, 4600)`; 437 points |
| `public-prompt-socket-wallet-inventory` | Wallet and secret-path inventory / Socket | `[7073, 7841)`; 768 points |

Source URLs:

- [StepSecurity Nx analysis](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware)
- [Socket Nx analysis](https://socket.dev/blog/nx-packages-compromised)
- [Wiz analysis](https://www.wiz.io/blog/s1ngularity-supply-chain-attack)

At the executed check, StepSecurity's normalized text hash was
`40365a366c3b84b99356a23be3ffaab56883915f4daaa3b8337434f47ac4fb1f`,
revision
`source-revision-682a51fd30b46aee1bd5dc6eee22ec5487f733eded5044200f83e80e527786ad`.
Socket's was
`be9fa7a0348a6fdd8f5cd18cee0d897493bff5481957e5c0c26f0a0ec67850b1`,
revision
`source-revision-30d589b80ca6cb0479599b72e08d26fc0fbabd773ae9bf90fa31b42e34c29a9c`.
All three literal slices matched exactly after applying `readableHtml` from
`scripts/contract.mjs` to fetched HTML. Do not assume a future page is unchanged.

Wiz's retained article and the checked current page describe AI-tool use and
flags, but do not quote a complete prompt. **Do not attribute StepSecurity or
Socket's literal to Wiz.** An empty Wiz-filtered prompt view is honest;
another article, code block or image would require its own verified extraction.
Zscaler remains unretained. Do not invent a literal for either publisher.

When recovering prompt data, use the full text already in the projection or a
matching retained source revision. Do not reconstruct a literal from a claim
paraphrase. Verify `sha256(readableHtml(html))` against the recorded normalized
hash, then compare `[...normalizedText].slice(start, end).join('')` to the literal.
Use Unicode code points, not UTF-16 `String.slice` offsets. Exclude surrounding
`const PROMPT = '` and closing quote/semicolon wrappers when defining the prompt
span. If the hash differs, do not retain old revision IDs/offsets for new text;
use the normal reviewed intake/extraction path.

`publicDraftModel` validates bounded literal/label text, usage enums, unique IDs,
same-case claim/source/revision closure, locator length and coverage by the
claim's cited passages. Socket's wallet prompt crosses two consecutive passages;
support must cover the entire span without a gap. Locator-shape checks are not
cryptographic proof of text authenticity when bodies are omitted.
Public prompt artifacts remain Pending and collection-disabled, and do not
change the typed corpus export or its snapshot digest.

`aiLibrary` groups prompts by exact literal equality, preserving punctuation,
whitespace, case and source occurrences. The library displays one `<pre>` per
variant, then source-specific provenance. Do not replace the literal with its
normalized label or lose a second source when deduplicating. Rendering uses text
nodes, not `innerHTML`; source links retain safe URL handling. The Prompt library
does not show supporting claim descriptions/buttons, although claim linkage
remains in annotation metadata and available in the workspace.

## Graph, claims and UX invariants

The unified graph is a read-only aggregate, not a replacement for three stored
paths. Friendly phase names, member routes, exact revision navigation and return
context must survive filtering, source inspection, reload and back/forward.
Preserve canonical IDs and collision-safe display occurrence IDs.
Disconnected phases must stay disconnected: never add arrows to make the
overview visually coherent. A sequence label is not a timestamp, universal
completion or proof of common attribution.

Keep evidence status, origin and review separate. Attempted use, Wiz's aggregate
reported success and a vendor experiment are not interchangeable. Parallel
relationships, self-loops, reversed edges, conflicts and conditional behavior
retain independent support. Compact controls still need accessible names,
keyboard/non-drag movement and deterministic bounded reset.
After phase-focused startup, tests measuring overview zoom/reset must explicitly
select **Full campaign overview** before capturing their baseline.

An exact description duplicate check found no same-source duplicates in the
public draft during the session. Semantic claim deduplication was **not**
implemented or independently reviewed. Grouping by publisher is navigation,
not deduplication. Do not merge different claims merely because their labels
look similar, they cite the same publisher, or they describe one campaign.

## Recovery procedure and validation limits

1. Inspect the current worktree and newer human decisions. Recover missing
   behavior selectively; do not replace whole files with an older version.
   Search the originating branch/PR history before reconstructing code.
2. Restore the runtime surfaces together: `src/explore.mjs`, `src/app.mjs`,
   `src/style.css`, `src/campaign-presentation.mjs`, `src/public-profile.mjs`
   and the explicit prompt projection in `src/data/nx-draft.json`.
   The original alias/graph changes also involve `src/research-inventory.mjs`,
   `src/render.mjs`, `src/graph-geometry.mjs`, `scripts/contract.mjs` and
   `scripts/server.mjs`; do not regress them while recovering follow-ups.
3. Restore focused regressions in `tests/workbench.test.mjs` and preserve
   article/intake/server tests. Update README, architecture, corpus coverage,
   acceptance audit and CHANGELOG when implementation changes.
4. Run the exact commands below on the recovered revision, then inspect the
   browser. Record fresh results in the originating PR; old results are not
   acceptance evidence for recovered or newly committed code.

Run from the active worktree (not the main checkout):

```powershell
node --test --test-name-pattern="Issue #51 follow-up|Issue #51 public prompt" tests/workbench.test.mjs
node --test tests/article-display.test.mjs
node --test tests/workbench.test.mjs
node --check src/public-profile.mjs
node --check src/campaign-presentation.mjs
node --check src/explore.mjs
node --check src/app.mjs
git diff --check
python scripts/verify.py
```

The last prompt follow-up on the HEAD above plus uncommitted implementation
passed 6/6 focused tests, source hash/literal comparisons for all three
occurrences, syntax checks and `git diff --check`.
The earlier article-display run passed 3/3. The latest full verifier **failed**:
35/35 governance, 46/46 contract, 5/39 intake, 34/97 extraction, 1/46 review,
10 exports passed with one skipped, 117/119 workbench and 6/14 server.
Configured application commands are nonempty; this was neither scaffold-only
validation nor a clean application pass.

The Windows runtime was Node 22.15.0 rather than pinned 22.23.3.
Many failures concerned POSIX-style private paths/permissions and malformed
Windows temporary paths (`ENOENT`, `Private path must be absolute and normalized`).
The workbench also retained an AP-01 route-callback assertion failure.
Hosted investigation later isolated that assertion to an ambiguous test lookup:
the substring-based `button` helper matched a generated phase title containing
the last node's label before the exact text-node control. The corrected test
uses exact button text and checks `aria-pressed` before/after selection while
retaining the original canonical-route assertion. Scope or exact-match synthetic
control lookups when phase labels embed node names; do not change valid phase
behavior to satisfy a test that selected the wrong control.
A narrowly name-filtered selection of an early test could access `FakeDocument`
before initialization, while the complete suite passed that selected behavior.
Do not weaken assertions, skip suites or silently classify all failures as
environmental. Correctly distinguish infrastructure and actual assertions.
Historical native-POSIX passes documented elsewhere predate these changes and
must not be reused as current evidence.

For a read-only public preview, run
`node scripts/server.mjs --port 4181` and open
`http://127.0.0.1:4181/#prompts//`. Do not start another listener if the port is
already in use; inspect the existing instance first. No dependency installation
or build step was needed. `--corpus` and `--store` select different protected
modes; never expose a private preview through a public host or tunnel.

Agent browser inspection found two wrapped literal blocks, three source
citations, zero activity cards, zero cited-claim buttons and no horizontal
overflow. Clicking StepSecurity opened its exact recorded revision.
This is a smoke observation, not comprehensive theme/responsive/accessibility
acceptance. Inspect campaign, research, claims, prompts, behaviors and graph
routes, including source filters and phase/overview controls, and obtain
independent human content, UX, accessibility and documentation relevance review.

See [acceptance audit](../acceptance-audit.md) for criterion-to-evidence links,
[architecture](../architecture.md) for implementation boundaries,
[Nx corpus](../nx-corpus.md) for coverage,
[evidence expiry](evidence-expires-with-revision.md) for revision-bound checks,
and [HTML decoding](preserve-originals-version-html-decoding.md) for preserving
original bytes and versioned transformations.
