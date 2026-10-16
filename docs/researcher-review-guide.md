# Researcher decision guide

Version: **researcher-review/1**. This version is immutable. Publish a new named
version and retain this text and its checks when rules change; never reinterpret
historical decisions with a newer guide. The Workbench embeds these exact checks.

## One item, one human decision

Identity is explicitly self-attested, not authenticated. Coordinate locally so one
human reviews at a time. LLMs propose content and evidence; they cannot check boxes,
accept records or establish human authorship. Read the exact revision and available
context, inspect uncertainty/conflicts and follow supporting-record links.

Accept applies only to the selected revision. Accepted supporting claims and other
required artifacts are prerequisites, not automatic approval of a derived item.
Modify makes a human-edited revision; inspect it again and explicitly Accept.
Simple content fields, annotation context labels and researcher tags can be edited.
Structural/precision/support corrections should be excluded and regenerated using
the existing extraction workflow, not patched into a graph or inferred chronology.

Exclude requires a reason: unsupported, inaccurate, duplicate, outside scope,
misattributed or insufficient evidence. Retain the original candidate, attribution,
support, extraction metadata and history; record replacement links if known.
Exclusion means “not included here”, not “false” or a negative training label.
Unsure requires a reason and is appropriate for ambiguous attribution, incomplete
evidence or unknown usage. Stop rather than guess. Next item/navigation records no
decision. Revisit excluded/unsure items through their filters.

Content origin, label authorship and human review are independent. An accepted
LLM-derived record stays LLM-derived. Human-edited indicates an editor, not a new
original author. Human-reviewed indicates current acceptance, not independent
truth or validated deployment. Correct provenance is a separate audited action:
give the reason and available evidence, including justified human-to-LLM
corrections. Prior attribution remains visible; affected approvals need re-review.

## Labels and required fields

Use existing labels plus researcher tags, not a new taxonomy. Completeness means
required fields are populated by anyone; it does not mean correctness or approval.
Missing/incomplete/complete labels are independent of authorship and review.

| Artifact | Required label fields / rule |
|---|---|
| Claim | evidenceStatus; proposed description and exact passage or explicit supported inference |
| Case summary | No label applies; summary and supporting claims |
| Category | dimension and value (existing controlled values or researcher tag) |
| Timeline | dateType and date.precision; retain supported value/range/null reason |
| Behavior | boundary; name, description and supporting claims |
| Behavior occurrence | No label applies; distinct source-local claim support |
| Path | scope; independently reviewed nodes and relationships |
| Node | evidenceStatus; action and supporting behavior/claims |
| Edge | relation and basis; its own supporting evidence, not just endpoints |
| Framework mapping | framework, version, techniqueId, mappingStatus; pinned definition, rationale, limits |
| Telemetry | category, eventType, availability; honest proposed collection and limitations |
| Detection | validation; hypothesis, test plan and support (review does not test it) |
| Instrumentation | sampleOrigin, stability; action and inert synthetic sample |
| Every annotation | type and evidenceStatus; value and source revision/support |
| Prompt/tool annotation | context.artifactKind and context.artifactUsage |
| IOC annotation | context.indicatorKind |
| Role annotation | context.roles |
| Behavior annotation | context.behavior |
| Data-source annotation | context.collection |
| Mapping annotation | context.mapping |
| Detection-reference annotation | context.detection |
| Talk tag | No additional context label applies |

“Source-reported observation” records a report, not independent confirmation.
“Attempted behavior” does not establish execution or success. “Researcher inference”
retains rationale/support and is not a literal source assertion. “Confirmed” may be
used in prose only with evidence of what, by whom and within what scope was
confirmed. Demonstrations/vendor examples and potential consequences remain distinct
from incident observations. Tool/prompt usage labels are targeted, attempted-abuse,
reported-abuse, vendor-example, general-mention or unclear.

Example: include a literal prompt with its exact spacing, source and vendor-example
usage when it is a vendor demonstration; do not call it observed attacker use.
Include an attempted action as attempted, not successful. Exclude an unsupported
sequence between two otherwise supported nodes. Defer an ambiguous executable
identity rather than guessing a product. A catalog technique definition may be
reference metadata, but its mapping needs its own review.

## Mandatory personal checklist

Every Accept records all three common checks and the applicable type check.
LLM suggestions never complete them. A genuinely non-applicable check requires
an explicit explanation; a reason does not supply missing required evidence.

- Supported by the cited evidence; uncertainty and conflicts are explicit.
- Faithful to the source; reported, attempted, inferred and confirmed are not interchangeable.
- Correct campaign, source occurrence, actor/role and scope.

### Type-specific checks (exact UI text)

- Claims: The atomic claim and its evidence classification are supported.
- Cases: The summary adds nothing beyond its independently accepted supporting claims.
- Categories: The existing category/tag value and its scope are supported.
- Timelines: The date type and precision are supported, not invented.
- Behaviors: The behavior definition adds no unsupported action or trust boundary.
- Occurrences: This distinct behavior occurrence has its own source-local support.
- Paths: The path scope is supported; ordering is not inferred from layout.
- Nodes: The node action and linked behaviors have independent support.
- Edges: This relationship has its own evidence; accepted endpoints do not approve it.
- Mappings: The mapping fits the pinned definition; membership alone is not evidence.
- Telemetry: Collection is a proposal unless separately evidenced; availability is honest.
- Detections: Human review approves a proposal, not operational validation or deployment.
- Instrumentation: Instrumentation remains a proposal; synthetic samples are not incident evidence.
- Annotations: Identity, role and usage are supported; prompt literals and use context are exact.

## Eligibility and limits

Source/content/provenance/support changes invalidate affected decisions. Exclusions
block dependents. Missing support and cyclic prerequisites stay blocked; follow the
links, exclude or regenerate instead of accepting around the blocker. Other records
are never automatically accepted. Case summaries do not become claim prerequisites.

Reviewed profiles contain only accepted reviewable records and eligible dependencies;
pending optional enrichment cannot qualify. Public profiles strip article bodies and
passage text and conservatively withhold annotation content. Private campaign/talk
exports remain research drafts and can contain private text. No action publishes.

Campaign progress deduplicates stable review units. Source counts may overlap and
must not be summed. Extraction measures eligible retained source segments, not all
incident facts. Unavailable/unprocessed sources remain separate. Accept and Exclude
complete current review; Unsure and changed/stale decisions do not. Ready means
current release eligibility, not quality. Zero denominators are N/A, never 100%.

Independent researcher, semantic, UX, keyboard/narrow-screen accessibility and
documentation-relevance review remain required; automated tests are not that review.
