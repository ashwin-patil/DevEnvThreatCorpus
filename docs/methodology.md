# Research methodology

Use the [five-stage workflow](workflow.md) for inputs, actions, outputs and
acceptance boundaries, and [status](status.md) for implementation/evaluation
limits. This page owns the research distinctions; the linked architecture
sections retain the exact CLI and data contracts. No historical prototype
assertions are imported as accepted research.

## Enterprise telemetry collection scope

These overlapping **local navigation families** use recognizable enterprise
collection terms, not exact official framework IDs or promised coverage.
`telemetry-scope-rules/1` proposes Pending source-local categorizations from
eligible bounded claim sentences; absence/negation, recommendations and inferred
consequences do not establish positive scope. HITL can correct/exclude/defer and
accept separately from the supporting claims. Blog/alias groups display only
categories supported by their own sources, never wholesale campaign inheritance.

| Family | Typical enterprise collection surface and limitation |
|---|---|
| Endpoint telemetry | EDR process/command-line and file activity; individual file reads need appropriate sensor/audit configuration. |
| CI/CD audit | [Workflow/job/run logs](https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs), runner records; access, retention and instrumentation vary. |
| Source-control audit | [Repository/organization audit](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization), permission, visibility and API changes; organization logs do not cover every personal-account action. |
| Cloud control-plane audit | [CloudTrail management events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-management-events-with-cloudtrail.html), Azure Activity, Google Cloud Audit Logs; local credential theft alone establishes no cloud API action. |
| Identity & access logs | IdP sign-in, consent and token/session lifecycle audit where available; reading a local secret is not an IdP event. |
| Network & DNS telemetry | Enterprise resolver, proxy, firewall and flow logs; do not assume TLS payload/file contents are visible. |
| AI agent observability | Instrumented CLI/agent transcripts, model/tool-operation traces; [OpenTelemetry GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai) remain in Development and message content is sensitive/opt-in, not default universal enterprise telemetry. |
| Package & build provenance | Registry publish/install metadata, dependency/build records and provenance attestations where collection is controlled; historical attestations may not exist. |

Scope is distinct from the existing typed telemetry-event, detection and OTEL
records. This refactor creates none of those records, event mappings or detection
logic. A family badge means only that a source-linked behavior suggests examining
that collection surface. Operational availability and effectiveness require later
scoped work and executed evidence.

## Prompt responses and observation provenance

An optional response is metadata on its exact prompt occurrence, not a separate
prompt entry or an outcome shared across exact-prompt groups. Preserve literal
encoding, full raw response/context receipts and source-local claim dependencies.
The response artifact may cover more text than its associated atomic claim;
never silently enlarge that claim's supporting passage. Private validation checks
exact retained text/hashes; public projection checks shape/scope/receipts but
cannot independently reverify withheld articles.

Distinguish researcher-controlled testing, reported compromised-host evidence,
source-reported log review with unspecified environment, illustration and unknown.
An attacker saying “authorized testing” proves none of those environments. Nor
does a separate malware runtime experiment locate an AI transcript. Keep unknown
model/role explicit, and distinguish a local refusal from aggregate source-reported
success elsewhere. Missing responses are not an outcome. Guide v4 binds these
decisions to each prompt/response/support revision; independent human semantic,
rights/privacy and documentation review remain required.

## High-level campaign categories

These are overlapping local research facets, **not** a replacement for formal
framework mappings or a claim that MITRE/OWASP defines these exact four groups.

| Category | Meaning and framework relationship |
|---|---|
| Victim-side agent abuse | Misuse of a victim-environment agent, including attempts/refusals. Where supported, distinguish direct/indirect [OWASP LLM01 prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) rather than inferring it from any AI mention. |
| Attacker-side AI use | AI used by the adversary to develop/operate attacks. Separate the operating side from a victim agent invoked by malicious code. |
| AI review targeting | Content attempts to manipulate/evade an AI code/security reviewer; a particular mechanism may involve prompt injection, but the label alone establishes no technique. |
| Developer-targeted social engineering | Deceptive recruiting/development interactions induce execution/access. [ATT&CK phishing](https://attack.mitre.org/techniques/T1566/) and user-execution concepts provide broader context; not every developer lure automatically maps to phishing. |

`campaign-category-rules/1` creates source-local Pending categorization records
from individual, bounded English claim-description sentences, not whole-document
keyword co-occurrence or raw article extraction. Eligible source assertions,
attempts and demonstrations require source/revision/passage linkage. Explicit
role/action wording is required; hypothetical/recommendation/negated clauses,
inferences, excluded/correction-needed claims and ambiguous roles abstain.
This heuristic is deliberately incomplete and can be wrong: a label needs its
own HITL decision after supporting-claim review. Missing matches are unclassified,
never evidence of no AI involvement, no abuse or no social engineering.

The origin is **Deterministic rule** and label authorship **Rule-derived**; the
underlying claim may still be LLM-paraphrased. Versioned record identities and
claim dependencies retain rule/source scope. Category corrections, exclusion,
deferral and acceptance use the existing review log; no rule overwrites a human
correction or accepts support. Cards deduplicate values while preserving every
source-local assertion and review state. Category facets on source/claim views
match their own supporting occurrences, not every source associated with a case.

The current ATT&CK catalogue is an offline reference, not incident evidence.
Its importer verifies the original immutable material SHA-256 and Git blob,
retains the upstream license notice, and excludes inventoried revoked/deprecated
attack patterns. Run `node src/import-attack-catalog.mjs --check` with the pinned
runtime to check reproducibility (requires the official public download).
Scoped `.gitattributes` files pin the generated catalogue and frozen historical
request fixture to LF, so Git's Windows checkout conversion cannot alter their
deterministic byte snapshots. Strict snapshot assertions are unchanged;
canonicalization is enforced at checkout, not silently tolerated by the
importer or replay reader.
Current reference membership never silently rewrites historical request/run
catalogue pins. The optional adapter transmits only complete ID/name membership
and pin metadata; definitions, URLs, license text and exclusions remain local,
with the existing byte/token caps unchanged. No network model generation is
implied by category extraction or catalogue import.
The preview explicitly serves the pure category helper as a browser dependency;
campaign execution, model adapters and the catalogue importer stay outside its
static allowlist. DOM tests alone do not establish that an HTTP-served module
graph loads; the server regression and actual browser smoke cover that boundary.

## Provenance before interpretation

A **source** identifies an input; a **source revision** identifies retained
content with raw/normalized hashes and parser/normalization versions. Changed
content at one canonical URL adds a revision rather than overwriting the old
one. An exact rerun does not refresh retrieval dates. Supplied text associated
with a URL is an operator assertion, not proof that the URL was fetched.

A **passage** belongs to one exact revision. Its locator uses zero-based,
end-exclusive Unicode code points in the retained normalized text, not bytes,
HTML offsets or the current web page. A source-grounded **claim** preserves its
case, source, revision and passage IDs. Matching a quotation establishes input
correspondence, not independent verification of the assertion.

Retain unknown/null reasons, collection failures and incomplete extraction
coverage. A failed request supplies no successful revision. Publication, update,
retrieval and activity dates remain separate, with recorded precision; sorting
intervals does not resolve overlapping chronology.
See [revision/normalization rules](architecture.md#manual-intake-contract) and
[typed date semantics](architecture.md#comparison-and-typed-timeline-model).

## Manual and AI-assisted extraction

Manual extraction validates researcher-supplied templates against retained text,
hashes and existing cases; it does not create cases implicitly. Inference claims
use `Researcher inference`, `Human inference`, supporting claim IDs and rationale
instead of fabricated passage text.

Campaign extraction is a two-step researcher handoff, not a model integration:
prepare a frozen request from selected revisions, use a separately configured
chat, then validate/apply its candidate locally. Requests bind scope, input,
prompt and catalog metadata. Validation requires segment outcomes and exact
quotes from completed segments; code derives offsets rather than trusting model
positions. Unavailable text, skipped segments and failed segments remain visible.
Requested model preference is advisory; effective model/version may be unknown.
Never infer them from the requested name.

Manual and AI-assisted outputs remain Pending. Exact citation checks, schema
validity and completed segments are mechanical checks, not semantic gold,
extraction recall/precision or human acceptance. Article content and returned
candidates are untrusted research data, never instructions to execute.
See [manual extraction](architecture.md#manual-extraction-contract) and the
[campaign handoff contract](architecture.md#campaign-extraction-contract).

## Keep evidence, origin and review independent

| Axis | Question answered | What it does not establish |
|---|---|---|
| Evidence status | What kind of support/assertion is recorded, such as `Attempted behavior` or `Researcher inference`? | Attempted behavior is not completed execution; a source report is not independent confirmation. |
| Origin | How was the assertion produced, such as `LLM source paraphrase` or `Human inference`? | Human review does not rewrite authorship; model origin alone neither proves nor disproves a claim. |
| Review disposition and eligibility | Is the record Pending, Accepted, Needs correction or Excluded, and is its acceptance current? | A recorded event or case lifecycle label does not establish current eligible acceptance or authenticated reviewer identity. |

Keep observation context, uncertainty, source-mentioned versus researcher-proposed
mapping basis, and incident versus vendor-test usage alongside these axes.
Do not collapse them into one confidence badge.

Contradictions remain separate claims with reciprocal same-case conflict links.
The Nx and StepSecurity package-availability estimates disagree; Wiz's repository
exposure window measures something different, not a third interchangeable
estimate. Neither selecting a preferred source nor accepting a claim silently
resolves conflicts. See [Nx interpretation limits](nx-corpus.md#interpretation-and-public-boundary).

## Correction, exclusion and stale acceptance

The local review CLI records an explicit human identifier and rationale. That
identifier is **self-attested**, not authenticated. A filesystem owner can alter
the store; append-only application checks are not tamper-proof audit storage.

Correction permits only specified fields and already recorded passages from the
original revision; it cannot rewrite origin, attribution or reciprocal conflict
links. A corrected claim gets a new revision and `Needs correction`, followed by
a separate explicit acceptance if warranted. Exclusion retains the record and
history rather than deleting evidence. Events retain decisions/hashes, not full
historical claim snapshots.

Recorded disposition and effective eligibility are distinct. Current acceptance
must match the entity revision/content, dependencies and whole normalized
`reviewBaseDigest`. Review events, reviewable dispositions/history and case
lifecycle are normalized out; **any non-review base edit can invalidate earlier
acceptance**, including an unrelated edit or another linked source revision.
Inference acceptance also depends on currently accepted support. Inspect status
and re-review; never transplant hashes or treat an old event as fresh approval.
The read-only UI's recorded-event counts do not reimplement this eligibility gate.

The reviewed export selects currently eligible claims and dependency closure;
an empty reviewed profile is valid. Draft exports remain visibly draft.
Optional enrichment context does not acquire acceptance from an accepted claim.
See [review and correction](architecture.md#manual-claim-review-contract),
[eligibility implementation](../scripts/contract.mjs) (`reviewBaseDigest`,
`currentReview`, `reviewEligibleCorpus`), and
[export profiles](architecture.md#reproducible-exports-and-read-only-queries).

## Public-safe Nx worked example

This chain comes from the checked-in
[public projection](../src/data/nx-draft.json), also preserved at the
[inspected baseline](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/06f93a10f4481378c394785f4e2d239886a92c21/src/data/nx-draft.json).
It illustrates traceability, **not acceptance**. Find typed rows by `entityType`
and `entity.id`; do not validate this projection as an importable private corpus.

| Link | Recorded value |
|---|---|
| Source | StepSecurity's [Nx analysis](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware); `source-a51036e953e037c63840945207be185e7cf43bdd22f70a8c8712959ae5f24bd3` |
| Revision | `source-revision-682a51fd30b46aee1bd5dc6eee22ec5487f733eded5044200f83e80e527786ad` |
| Revision fingerprint | Normalized SHA-256 `40365a366c3b84b99356a23be3ffaab56883915f4daaa3b8337434f47ac4fb1f`; `unicode-lf-nfc/1`, `readable-html/5` |
| Passage | `campaign-passage-70c0ad6f43a9bedf4aae49169b7287c27e99a6751161db7eb9f7132cf1db0caa`; `code-points:8908-9567`, interval `[8908, 9567)` |
| Claim | `campaign-claim-0c4d8e8c7d865e53b02a44a719a2df4e8f2524b94e1108dbf43576d38501a140`, revision `r1` |
| Case | `case-06efe0e7191796ad8e1bd690e22de800b249ccfb9e8fb905efaf0af28d3f2b02`, Pending |
| Recorded description, not an article quotation | “The payload attempts filesystem reconnaissance through Claude, Gemini and q CLIs.” |
| Evidence / origin | `Attempted behavior` / `LLM source paraphrase`; observation context: “Source-local report; not independently verified.” |
| Uncertainty | “Published payload intent and invocations do not prove completion on each victim.” |
| Review | Empty claim history; `recordedDisposition: Pending`, `effectiveDisposition: Pending`, `currentAcceptance: false`, `stale: false`. No human acceptance is recorded; not stale does not mean accepted. |

The source's `revisionIds` includes that revision; the revision points back to
the source; the passage points to that revision; the claim names the source,
revision and passage. The accompanying review status belongs to that claim row.
The precise locator/hash below are copied from these public records, not
reconstructed from a live article.

The source row still records `extractionStatus: Not started`; that lifecycle
field must not erase the linked claim or be promoted to completed/accepted
research. Publication and update dates are unknown. No chronology is inferred.

See the [capability evidence](status.md#capability-and-maturity-matrix) for
mechanical checks; protected retained text and independent human research review
are still needed to assess the claim's support.

### What the public projection omits

Article bodies and ordinary supporting quotations are withheld; passage `text`
and `attestation` are null. Original locators and hashes are retained without
shortening spans, inventing text or adding human passage attestation. Consequently
public readers can inspect linkage but cannot recompute quotation equality from
this projection. A live URL is context, not a replacement for the retained revision.

The separately published exact-prompt display entries are a bounded exception,
source-attributed untrusted artifacts, not an authorization to reconstruct other
quotations or execute prompts. Private decisions, run envelopes, logs and archives
are not public evidence. See the
[Nx coverage and public boundary](nx-corpus.md) and
[typed draft archive](data/nx-draft.zip).

## Reconstruction, comparison and detection

Within-case reconstruction needs independent support for relationships, not just
supported endpoints. Distinguish source-supported edges, inferred relationships,
conditional execution and propagation. Preserve disconnected nodes or unordered
sets when chronology is unavailable. Loops and phase layout establish neither
repetition nor execution.

Cross-case comparisons retain member case/claim/revision identity and uncertainty.
Shared tool names, behavior labels, citations and display tags do not prove a
shared actor, prevalence or common campaign. Pattern synthesis needs explicit
human reasoning; a grouped view is not an accepted cross-case finding.

Detection hypotheses connect supported observations to proposed telemetry and
assumptions. A resolved framework ID is catalog membership, not proof of
applicability. Source guidance, researcher proposals and inert synthetic OTEL
examples stay distinct. Evaluated rules would require a specified implementation,
datasets, conditions and measured results; none is established by a mapping,
fixture pass or this documentation.
