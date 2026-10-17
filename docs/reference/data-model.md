# Data model

## Effective staged inputs

The `grounded-applied-pending/1` policy permits derivation from grounded applied
Pending items, including valid effective human modifications, without accepting
them. Excluded, Unsure, unresolved, cyclic, cross-case or unsupported items are
ineligible. Input snapshots retain original proposal hash, effective record,
content/provenance/dependency binding, reviewer/editor metadata, exact passages
and canonical context, decision ID and originating run IDs.

Selecting a behavior also freezes its independently reviewed occurrences, not
only its display label. Every selected upstream item and its required dependency closure binds **every
output in that bounded cohort**. Choose minimal coherent cohorts; an unrelated
input unnecessarily selected into a cohort intentionally invalidates that cohort
when corrected. The effective revision excludes a mere acceptance decision:
accepting unchanged support later does not require regeneration. Material
content/provenance changes do, even if the changed support is subsequently
accepted. Original proposals and historical stage snapshots are never rewritten.

Claims, tool/prompt usage annotations, behavior definitions, occurrences, paths,
nodes, edges and mappings retain separate review identities. Upstream acceptance
does not approve a dependent item; reviewed exports enforce the existing current
approval and dependency closure. Stage processing counts, canonical covered
source positions, human review and release eligibility are distinct measures.

Start with source evidence, not optional path or detection records.
[Architecture](../architecture.md) owns component flow and trust boundaries;
[formats](formats-and-versioning.md) owns schema/type and serialized-format
references. Runtime checks live in [contract.mjs](../../scripts/contract.mjs).

## Core entities

The required `0.3.0` arrays exist even when empty:

| Collection | Meaning and relationships |
|---|---|
| `sources` | Attributable URL/text/file identity, metadata with null reasons, provenance, ordered `revisionIds`, extraction and collection state |
| `sourceRevisions` | One source's exact content version: raw/normalized hashes, normalization/parser identity, retention and optionally retained text |
| `passages` | Exact revision support: text or explicit absence, locator and half-open code-point interval; optional human attestation is revision-bound |
| `cases` | Explicit campaign/incident/exercise scope, source associations, limits and supported summary; shared sources do not merge cases |
| `claims` | One case, one source and one exact revision, description, passages or inference support, conflicts, uncertainty, evidence status, origin and disposition |
| `categorizations` | Multi-label case assertions with explicit source and supporting-claim scope, not truth about every claim in that case |
| `timelines` | Typed, precision-preserving date assertions with claim/revision support, basis and uncertainty |
| `reviews` | Ordered decision events bound to entity revision, content, dependencies and review base |
| `collectionManifests` | Input/revision IDs, collection/extraction outcome, provenance, tool/input/output identity and limitations; failure is not a retained revision |

`governance` holds extension metadata, including campaign snapshots; it is not
an alternative claim collection. The [TypeScript declarations](../../schemas/contract.d.ts)
describe these entities; the [JSON Schema](../../schemas/corpus.schema.json) and
runtime relationship checks jointly enforce them.

Source-to-case associations are many-to-many and deliberate. Manual extraction
requires existing cases; only the explicit batch new-campaign action creates a
new Pending case. Neither URL similarity nor identical content establishes case
membership, common actors or authenticity. Nulls require field-specific
`unknown`, `not_reported` or `not_applicable` reasons, not fabricated metadata.

## Exact passage support

Passage `start`/`end` are zero-based, end-exclusive **Unicode code-point**
positions in the exact named retained normalized revision, not UTF-8 bytes,
UTF-16 indices, raw HTML offsets or the newest version of a page. The normalized
hash and source/revision relationship must match. Extraction rejects fabricated
text, invalid intervals, absent retained content and mismatched hashes before
persisting any claims.

Manual extraction supplies text and offsets. Campaign candidates supply exact
quotes in completed request segments, with an occurrence selection for repeated
quotes; local code derives offsets rather than trusting model offsets. Enrichment
can resolve a unique exact quote without a locator; repeated quotes require an
exact locator or explicit unresolved status.

Browser selection converts Range UTF-16 endpoints over the exact rendered text
nodes to code points, rejects cross-root/surrogate-splitting selections, and
rechecks revision/hash on save. Overlapping highlights preserve all linked claims
without duplicating text. See [studio.mjs](../../src/studio.mjs) `selectedPassage`.

A text match establishes correspondence, not truth. Inferences use
`Researcher inference`, `Human inference` for manual input, rationale and
same-case supporting claims instead of fabricated passages. Inference cycles
are invalid; conflicts remain separate reciprocal same-case records, not a
winner selected by software.

## Review freshness and status axes

Keep these axes independent:

- **Evidence status:** source-reported observation, attempted behavior,
  demonstrated capability/proof of concept, potential consequence, researcher
  inference, or unclear/disputed.
- **Origin:** human authorship/paraphrase/inference, official framework or an
  explicit LLM origin. Human review never rewrites authorship.
- **Disposition:** `Pending`, `Accepted`, `Needs correction`, `Excluded`.
- **Collection lifecycle:** `Collected`, `Extracted — review pending`, `Reviewed`,
  `Needs correction`, `Excluded`. `Reviewed` does not mean all claims are accepted.

`reviewBaseDigest` in [contract.mjs](../../scripts/contract.mjs) clears reviews,
normalizes reviewable dispositions/history, and normalizes case collection
lifecycle. **Any other corpus edit**, even unrelated content or a newly linked
source revision, conservatively stales acceptance. Review decisions alone do not
stale other decisions.

`currentReview`, `dependencyHashes` and `reviewEligibleCorpus` require the
latest matching human event, revision, disposition, content/dependency hashes
and base. Source dependencies bind all linked revisions; accepted inference,
summary, category and timeline records also require accepted supporting claims
transitively. Malformed evidence/events still fail validation. Eligibility is
not a repair mechanism.

Review-aware status/profile commands expose stale acceptance as effectively
Pending without erasing recorded history. Successful decisions persist effective
pending dispositions alongside the new event. Strict contract validation and
intake/extraction remain fail-closed on stale Accepted records. Re-read review
status and explicitly re-review after non-review edits; never transplant hashes.
The browser's recorded-event coverage and loaded-JSON digest are **not** the CLI's
cryptographic review eligibility or profile digest.

## Optional derived records

Optional arrays `paths`, `behaviors`, `frameworks`, `mappings`, `telemetry`,
`detections` and `otel`, plus optional `otelReference`, do not replace the core.
Empty/missing optional collections are normal.

- **Behaviors** separate reusable definitions from supported occurrences.
  A behavior set may be unordered; a path is not mandatory.
- **Paths** contain case-local nodes and separately supported edges. Sequence,
  conditional and propagation relations retain basis and independent edge claims.
  Supported self-loops/cycles are allowed; a loop does not establish repetition,
  execution, chronology or causality.
- **Framework records** resolve pinned official reference identities, not incident
  assertions. Mappings need rationale/applicability and remain Proposed unless
  separately reviewed. Explicit node scope requires paired path/node IDs, behavior
  membership and every mapping claim in that same node/case—even for unresolved
  catalog misses. Claim overlap cannot manufacture scope.
- **Telemetry and detection hypotheses** distinguish article-mentioned guidance
  from researcher-proposed collection/detections; they are not evaluated rules.
- **OTEL samples** are inert allowlisted synthetic examples, with the exact
  `LLM synthetic fixture; not incident evidence` label and `synthetic.*` or
  reserved `example.invalid` values. The legacy template allowlist is empty.
- **Private annotations and run projections** retain literal values separately
  from normalized labels, explicit support, uncertainty and Pending origin/status.
  They cannot accept canonical claims.

See [campaign-records.mjs](../../src/campaign-records.mjs),
[enrichment.mjs](../../src/enrichment.mjs) and
[framework pins](formats-and-versioning.md#pinned-framework-references).

## Dates and comparison

`DateValue` preserves `day`, `month`, `year`, `range` or `unknown` precision.
Publication, source update, first reported activity, incident execution,
discovery and disclosure remain distinct; retrieval is source metadata, not an
inferred incident date. `dateBounds` in [model.mjs](../../src/model.mjs) derives
calendar intervals for sorting/inclusive overlap without changing stored precision.
Overlapping bounds do not establish order. Unknown dates remain unordered;
the explicit unknown-only mode ignores bounds.

Comparison applies search AND facets with explicit per-facet OR/AND modes.
Claim facets match individual claims; empty cases drop out when those facets are
active. Source-supported comparison requires a non-inference claim and a retained
passage in its exact revision; unavailable/locator-only support and inferences
remain separately labeled. Conflict counterparts can appear as out-of-filter context.
Counts identify distinct cases/sources, matching claims and selected-case timeline
context—not prevalence, attribution, acceptance or detection coverage.

## Presentation-only grouping

[campaign-presentation.mjs](../../src/campaign-presentation.mjs),
[research-inventory.mjs](../../src/research-inventory.mjs) and
[ai-library.mjs](../../src/ai-library.mjs) project existing support without mutation.
Campaign graphs aggregate same-case member paths but retain original path/run,
node and edge identities and historical routes. Disconnected components receive
no invented edges. Pan/zoom/layout/filter/history state is ephemeral, absent
from corpus hashes, acceptance and exports.

Article alias cards preserve member URLs/revisions/failures; the specifically
verified Red Canary AI CLI → Zscaler alias is not a general publisher rewrite.
New collection must still authorize every requested/redirect origin. Pinned catalog
sources are not research articles. Claims grouped by campaign/publisher stay separate.

Tool normalization uses known aliases, not model-suggested replacement literals
(`q` maps to Amazon Q while retaining the literal). Exact prompt equality groups
copies but keeps every source/case occurrence navigable. Product/prompt relationships
require shared source-local claims, not proximity in an article. Usage, evidence,
origin and review are independent; absent usage stays unclear. Public prompt
locators must close over same-case claim/revision passages and match literal length,
but without retained text that checks linkage/shape, not authenticity or attestation.

## Private, public, synthetic and historical data

| Data class | Boundary |
|---|---|
| Private corpus/archive/run data | Entire store and external request/candidate/decision bundles remain protected; article archives are not canonical schema records |
| Bundled public Nx draft | Purpose-built [public adapter](../../src/public-profile.mjs) and [projection](../../src/data/nx-draft.json); Pending, with full articles/other quotations/private run bundles withheld. Published prompt literals are an explicit inert source-attributed exception, not acceptance |
| Core profile exports | Reviewed/draft selection with dependency closure and full bodies stripped; passage excerpts can remain, so publication still needs rights/privacy review |
| Campaign/presentation talk bundles | Private, Pending-oriented views; protected campaign bundles retain complete revision records, including raw HTML text and normalized bodies, while presentation-only revision provenance omits bodies |
| Synthetic demos/fixtures | Explicitly synthetic, not incident evidence; demo loading changes display, not a store |
| Frozen historical `0.2.0` corpus | Unchanged [archived `handoff/reference/`](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference) material; no migration/seed import or compatibility promise for `0.3.0` |

See [Nx coverage and omissions](../nx-corpus.md) and
[export formats](formats-and-versioning.md#profile-exports). Missing public text
must not be reconstructed from a newer page or treated as absent incident behavior.
