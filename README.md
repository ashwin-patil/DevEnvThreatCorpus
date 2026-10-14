<p align="center">
  <img src="docs/assets/logo.svg" alt="DevEnvThreatCorpus Logo" width="540">
</p>

<p align="center">
  <strong>Evidence-grounded threat intelligence · Attack paths · Telemetry</strong>
</p>

<p align="center">
  <a href=".github/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0_%2F_CC--BY--4.0-blue.svg" alt="License"></a>
  <a href="scripts/.node-version"><img src="https://img.shields.io/badge/Node-22.23.3-green.svg" alt="Node version"></a>
  <a href="schemas/corpus.schema.json"><img src="https://img.shields.io/badge/Schema-0.3.0-orange.svg" alt="Schema version"></a>
</p>

---

# DevEnvThreatCorpus

The bundled **Nx / s1ngularity public Pending draft** contains 38 claims,
14 behaviors, 3 retained representative phase paths and 2 Proposed mappings from
four retained reports. Attack paths presents these records as one case-scoped
campaign graph, not three competing campaign histories. Two explicit URLs for
one additional article failed the original intake; their failure history remains
available even when their alias is displayed once. Start
`node scripts/server.mjs --port 4181` without private input to inspect it, or serve
the repository statically and open `src/index.html`. Explicit private `--corpus`
and `--store` modes keep their existing behavior. The public draft withholds full
articles, other quotations and private run bundles; published prompt literals
are available as source-attributed, untrusted research artifacts. It is not a
private corpus import or a reviewed release. See [coverage and evidence
limits](docs/nx-corpus.md) and the [typed draft export](docs/data/nx-draft.zip).

The local ATLAS & TTPs view separates campaign mapping counts from resolver
references. New campaign extraction requests include the pinned MITRE ATLAS
2026.09 catalog (208 techniques/sub-techniques, official descriptions and parent
relationships) alongside the existing ATT&CK projection. Catalog sections expand
and search by ID, name or description. Catalog membership is not incident evidence:
source-mentioned IDs must occur in supporting passages; grounded analogies remain
researcher-proposed and Pending. Historical runs retain their original snapshots.

Citation chips show publisher names and navigate to exact evidence or source
revisions. Full IDs, hashes and Unicode offsets remain in collapsed Technical
provenance and private exports. Undated timeline entries are collapsed without
inventing dates. Behavior chips use review colors/symbols and a Human review
legend; Pending means awaiting human review, separate from attack outcome.

DevEnvThreatCorpus is building a human-reviewed corpus for research on
developer-environment threats. The current work provides the data contract,
offline validation, operator-triggered source intake, researcher-triggered
manual claim extraction, local human claim review, and reproducible
reviewed/draft exports with read-only queries for a new corpus.
The private review CLI records append-only decisions and checks current
acceptance eligibility; local reviewer identity is self-attested, not authenticated.

## Current implementation

Attack paths groups existing phase paths into a read-only campaign view. Friendly
phase/activity labels replace identifier-heavy selectors; technical disclosures
retain the original path, node and edge identities. Disconnected phases remain
disconnected: the view does not invent chronology, actor identity or transitions.
Additional supported paths enrich the same case graph, without merging other cases,
source occurrences, evidence classifications or review states.

Attack paths retain stable `#paths/<path-id>/<node-or-edge-id>` routes. Select a
node or directed relationship on the SVG canvas or in its complete text
alternative; related evidence, behavior, framework and telemetry navigation keeps
the case context and offers **Return to selected path element**. Explicit evidence
links clear graph-specific search/facets so they can reveal the linked claim or
source, while the return action restores the original graph filters and selection.
Changing a source revision retains this saved return context, including after
reload and browser back/forward. Missing paths
discard it with an explanation, and retired elements remain explanatory targets. Missing,
retired or filtered targets explain their state rather than substituting another
case. Cases without paths still expose their claims and behaviors.

The graph labels representative/composite scope, research-exercise case kind and
recorded review state. Solid sequence, dashed conditional and dotted propagation
curves describe relationships, not evidence strength, execution or chronology.
Inspection keeps node and edge support separate, including exact passages,
uncertainty and conflicts. Node candidates require matching behavior, every
supporting claim and a retained pinned catalog; broader and unresolved candidates
are labeled separately. No recorded candidate does not mean no behavior occurred.

Zoom, background pan and explicit node grips affect only in-memory presentation.
The compact icon toolbar has accessible names and tooltips; expand its movement
controls for **Pan** and **Move selected node** actions without dragging.
**Focus selection** enlarges the selected activity or relationship for readable
inspection, including narrow screens. A phase selector focuses the initial
campaign view on one readable phase while keeping the other phases available;
**Full campaign overview** and **Reset layout** restore the complete deterministic
fit, including disconnected nodes and loops. Enter/Space
select named controls; focus survives canvas updates and a short status announces
inspection. Both themes and narrow screens use the existing workbench shell.
Pointer and button movement share bounds based on the reset fit: node boxes can
move one fit-width/height beyond each side, and the viewport center can move one
fit-width/height from its reset center. Reaching a boundary clamps further movement;
zoom and reset retain these presentation-only limits.
Selecting another phase in the same campaign keeps the viewport and focused
control; historical member-path links still identify the exact occurrence.
Parallel relationships retain separate connectors and claim support. Public
coverage counts logical articles rather than aliases, with original URLs and
failure reasons available under **Original URLs & coverage history**.
Campaign cards open expanded with a short cited claim-based summary and defer
full claim details to the campaign workspace.
Publisher controls open one internal source view; the outbound article link is
available from that view rather than duplicated beside each campaign chip.
Campaign cards list AI tools and prompt references before compact inline behavior
actions and can be collapsed to a compact overview.
The Research library excludes pinned MITRE catalog records, which remain in
**ATLAS & TTPs**. Claims are grouped by campaign and publisher in collapsible
navigation sections; distinct records and source support are never merged.
Behavior actions use compact, borderless inline labels and avoid repeating
single-source group names; recorded relationships use compact collapsible tiles;
sequence, conditional and propagation relationships have separate visual labels.
The Prompt library shows extracted prompt text, not prompt-activity claim cards.
The public draft contains two exact variants from StepSecurity and Socket;
identical text shares a card while preserving each source citation and revision
locator. Wiz reports AI-tool use and flags but does not quote a complete prompt
in the retained article, so no literal is attributed to Wiz. Prompts are displayed
as inert text for research, never executed or treated as independent confirmation.
Private case-wide talk JSON/Markdown bundles include paths, independent node/edge
support, mapping scope labels, catalog provenance and revision hashes with exact
passages, but omit full article bodies and visual layout state.
Shared behaviors are case-scoped projections: only the selected case's claims and
occurrences survive, with an explicit limit label; canonical records stay unchanged.
Protected campaign exports remain the full retained-revision closure; selected-path-only and image
exports are deferred. Never commit private bundles or screenshots of private data.
Independent research, screen-reader/accessibility, UX and documentation review
and a protected real-extraction walkthrough remain required before merge.

Variable-height research/artifact cards use a column flow with consistent gutters
so shorter cards do not leave an empty grid row underneath. Campaign cards retain
stable expandable grid positions. Publisher labels and Publisher filters use
recognized HTML publisher metadata or the canonical/final URL host. Zscaler URLs
use Zscaler; explicit rebranded metadata is normalized while raw page publisher
values remain archived. Historical Red Canary pages retain their own identity
unless their retained URL or metadata identifies Zscaler. No arbitrary HTML tags
or publisher ownership relationship is promoted to accepted campaign evidence.

Case library is the campaign-level overview: one expandable card per case, with
links to its research blogs, behaviors, tools, prompts and full workspace. Research
library is the source-level overview: one card per blog/article, with campaign
tags and source-specific behavior and evidence links. Shared blogs can tag several
cases without merging their attribution. Tool/prompt colors and symbols use a
visible usage legend; behavior titles remain plain names under Actions or Activity
patterns category sections. This changes presentation only, not corpus identities
or pending/accepted review state.

The verified Red Canary AI CLI article alias and its Zscaler destination are one
logical research article, not a publisher-wide merger. Original source routes,
URLs, retained revisions and failed manifests remain inspectable. Collection still
checks each redirect origin's robots policy and never treats HTTP 200 as permission.
Leading-wildcard policies such as `*_archive.html` use bounded wildcard matching,
longest matching rule and Allow on ties. Unsupported policies fail explicitly with
a supplied-text fallback; collection never silently refetches or impersonates a bot.
Overview summaries retain linked claim citations and explicit uncertainty. Projected
claim excerpts are agent-origin Pending presentation, not human-approved summaries.
Published prompt literals are visible; full article and other quotation inspection
still requires the private archive.

AI tools and Prompt library views project grounded `ide-cli` and
`prompt-instruction` annotations. Campaign and Research library cards link to
entries, exact revisions and supporting claims. Known product aliases share a
display identity; the Amazon Q CLI alias `q` displays as Amazon Q while its
source literal remains available. Unknown executables remain unresolved. Exact prompt variants
retain case, whitespace and punctuation rather than being semantically merged.
Prepare a fresh campaign request using extraction prompt version 3, then import
its candidate to populate these views. Optional artifact `usage` classifies
targeting, attempted/reported abuse, vendor examples, general mentions or unclear
context; older annotations display unclear. These are pending research artifacts,
not independently confirmed IOCs or deployed detection rules. Existing request
files must be prepared again after the prompt version change.

The 0.3.0 contract models sources and their revisions, passages, cases, claims,
categorization, timelines, and review events. Its validator checks schema shape
and relationships between records, including evidence references, content
hashes, date precision, conflicts, and review dependencies. Canonical
serialization and identity helpers support deterministic record comparison.
Manual HTTPS URL, UTF-8 text, and UTF-8 file intake persist private source
revisions and explicit success/failure manifests using that same contract. The
offline manual extraction CLI adds pending, passage-grounded claims and case
associations from a researcher-completed template; it does not accept or review
claims.
The separate manual review CLI accepts, corrects, or excludes explicit claims;
its status/validation commands distinguish recorded acceptance from current eligibility.

The local Research Workbench displays fresh 0.3.0 cases, sources, exact
revision passages, and claims locally, with search, facets, explicit conflict
comparison, and a **Comparison & timelines** view of selected corpus observations.
Its curator studio adds in-memory article intake, passage selection,
and pending claim/behavior proposal downloads. Explicit batch URL collection
also persists private sources and campaign links through the local backend.
For an existing case, campaign extraction now prepares a bounded private request
for a researcher-mediated Codex chat handoff and validates/imports its returned
candidate as pending records. It does not call a model or network endpoint.
None of these paths accepts claims or adjudicates research.

The new corpus starts from newly supplied source material. Existing 0.2.0
claims are not migrated, copied, or used to seed it. The frozen 0.2.0 material
under `handoff/` is retained as historical and design reference only.

**No live fetches or legacy records are used in the offline exercise or semantic tests.**
Fixtures are visibly synthetic, not incident evidence. Retrieval success does
not establish research truth or human acceptance.
The bundled public draft is checked separately for its export/privacy boundary;
its presence in a server test does not establish incident accuracy.

## Manual intake: offline exercise

Run these Bash commands from the clone with the pinned Node runtime. All
repository paths below are absolute; adjust `R` to your clone location.
The explicit private store is ignored by Git and must never be published.

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/exercise"
umask 077
mkdir -p "$S"
node "$R/scripts/contract.mjs" intake text --text 'Synthetic intake exercise; not incident evidence.' --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
# Inspect only locally: this file includes retained article content.
node --input-type=module -e 'import fs from "node:fs"; const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(JSON.stringify({sources:c.sources,revisions:c.sourceRevisions,manifests:c.collectionManifests},null,2));' "$S/corpus.json"
# The identical rerun must add no sources, revisions, or success manifests.
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --supplied-by operator --store "$S"
# Expected nonzero exit and a retained Failed manifest; no network request.
node "$R/scripts/contract.mjs" intake url --url http://example.org/offline-fixture --supplied-by operator --store "$S"
# Supplied-text fallback is a separate, attributed event; it performs no fetch.
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --source-url https://example.org/offline-fixture --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
```

The invalid HTTP input demonstrates failure-history preservation, not
same-source recovery: it is rejected before source registration. The fallback
explicitly associates supplied content with its HTTPS URL. Offline transport
tests separately exercise inaccessible valid-HTTPS requests and same-source
fallback without contacting a website.

To request a real public HTTPS source deliberately, replace the fixture URL:

```bash
node "$R/scripts/contract.mjs" intake url --url https://example.org/article --supplied-by operator --store "$S"
```

That command uses the network; it is not part of the offline exercise.
The robots parser supports wildcard and end-anchored Allow/Disallow rules and
ignores informational declarations without overriding access rules. Explicit
denials and cross-origin policy redirects still fail closed. Robots permission
does not replace operator authorization or article-storage rights.
See [intake rules and limitations](docs/architecture.md#manual-intake-contract)
for access policy, supported encodings/HTML, identity, bounds, safe retention,
and failure handling. Do not pass credentials or confidential text on a shared
command line; use a permission-restricted UTF-8 file instead.

## Batch campaign collection: CLI and local web

### Research views and talk preparation

The workbench also provides **Attack paths**, **Behaviors**, **ATLAS & TTPs**,
**Security telemetry**, and **OpenTelemetry** views using optional 0.3.0 records.
They preserve the existing layout and display recorded origins, pending states,
claims, mapping rationale, and proposal limitations. Graphs support node/edge
inspection, zoom, pan, node movement, reset, and keyboard/text alternatives.
Collection alone creates no attack graph, framework mapping, or accepted fact.
No legacy 0.2.0 incidents are imported automatically.

In private `--store` mode, campaign pages display validated `talk-enrichment/1`
annotations and the derived `campaign-projection/1` view of applied campaign
runs, grouped by AI/attacker/victim context, behaviors, data sources,
commands/prompts/tools, indicators/CI/CD artifacts, TTPs, detection references,
and talk tags. Import manual annotations with the existing enrichment CLI below
and click **Reload local corpus**. Invalid/stale annotations display a warning
while core sources and claims remain usable. The annotation endpoint is
read-only; the browser does not receive filesystem access or model credentials.

Campaign pages export private talk bundles as JSON or Markdown: citations,
case claims and passages, annotations, categories, timelines, and optional
paths/mappings retain their provenance and dispositions. These exports do not
include full article archives or promote claims. Keep them private.

For a benign visual example, open a research view and choose **Load synthetic
research demo**. It replaces only the displayed corpus, disables collection,
and is prominently labeled synthetic. **Reload local corpus** restores your
private collection. The original basic synthetic demo is unchanged.

Collection accepts at most **20 explicit public HTTPS URLs** per batch, one per
line. Choose an existing case ID or explicitly name a new pending campaign.
Identical inputs and unchanged source revisions are deduplicated; a changed
article creates a new revision. Sources may belong to several explicitly
selected cases. Failures do not discard other results. Retry only the failed
URLs; collection is not research acceptance or automatic attribution.

Failure codes distinguish network (`NETWORK`, `TIMEOUT`), HTTP/access
(`HTTP_STATUS`, `ACCESS_DENIED`, `ROBOTS_DENIED`), content
(`UNSUPPORTED_TYPE`, `UNSUPPORTED_ENCODING`, `MALFORMED_TEXT`, `EMPTY_CONTENT`,
`TOO_LARGE`), and storage (`UNSAFE_PATH`, `STORE_BUSY`, `PERSISTENCE`) failures.
Check connectivity for network errors, respect access denials, use authorized
supplied-text fallback for unsupported articles, and check private permissions
or wait for an active writer for storage errors. A failed result is not a
collected source revision.
After a later successful collection, earlier failed attempts are collapsed
under **Previous intake history** on the source page. Their audit records are
retained; unresolved failures and failures after the latest success stay visible.

This runnable example uses public article URLs already referenced in the
research handoff, but imports **no legacy records or claims**. Confirm permission
to retrieve and retain these articles before running it:

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/campaign"
umask 077
mkdir -p "$S"
printf '%s\n' \
  'https://nx.dev/blog/s1ngularity-postmortem' \
  'https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware' \
  'https://www.stepsecurity.io/blog/ctrl-tinycolor-and-40-npm-packages-compromised' \
  > "$S/urls.txt"
node "$R/scripts/contract.mjs" intake batch --urls-file "$S/urls.txt" --case-name 'Supply-chain research' --supplied-by operator --store "$S"
# Subsequent batches can use --case-id <returned-case-id> instead of --case-name.
node "$R/scripts/server.mjs" --store "$S" --port 4173
```

Open `http://127.0.0.1:4173/#studio` and use **Fetch articles** with the campaign,
operator, and multiline URL controls. Wait for per-URL outcomes, then inspect
the updated cases and sources. Reloading the browser or local corpus retains
collection and links; no server restart is needed in `--store` mode. The
existing `--corpus` mode remains a read-only startup snapshot. Never expose
this loopback server through a public host or tunnel.

Archives live beneath `$S/articles/<source-id>/<revision-id>/`: returned HTML,
extracted article text, citation metadata, and the image asset manifest.
Defaults bound article images to 20, 5 MiB each, and 50 MiB total. CLI flags
`--max-images`, `--image-bytes`, and `--image-total-bytes` can lower those
limits (byte limits are integer bytes; zero disables the corresponding work).
Image failures
are warnings, not grounds to discard usable text. Only body images, including
supported lazy URLs, are requested; there is no link crawl, arbitrary asset
download, JavaScript rendering, or access-restriction bypass. Unknown publisher,
author, or date information remains unknown. The hostname publisher map is
editable in the collection implementation; page publisher text is retained
separately from its normalized citation name.

Article responses remain bounded to 2 MiB after decompression. UTF-8 archive
text and metadata allow up to 6 MiB for supported charset expansion, with the
same limits enforced when writing and downloading. Hidden/template article
roots and their images are excluded from extraction. Archive links are tied
to the selected revision even when the source was initially supplied as text.
New HTML revisions use `readable-html/5`; existing `/1`, `/2`, `/3`, and `/4` revisions
validate against their original transformations without rewriting evidence.
HTML NUL characters are replaced only in the parsing projection, as in browser
HTML tokenization. Original response content and hashes remain intact in the
private archive. Invalid UTF-8 and NULs in supplied/plain text still fail.

Extracted text is the default view. Original HTML is untrusted and download-only,
never rendered in the workbench origin. Do not open it in a privileged browser
context. All article and enrichment files remain private and Git-ignored.
Case references show every linked source, with title, publisher, URL, and
available date. Citation downloads are private research aids, not a public
article-publishing mechanism.

### Private talk enrichment

After successful collection, create a versioned `talk-enrichment/1` template
for an existing campaign/source/revision. The template includes all eight types
as explicitly unverified placeholders; edit it before importing:

```bash
CASE_ID=$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(c.cases[0].id)' "$S/corpus.json")
SOURCE_ID=$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(c.cases[0].sourceIds[0])' "$S/corpus.json")
REVISION_ID=$(node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1]));console.log(c.sources.find(s=>s.id===process.argv[2]).revisionIds.at(-1))' "$S/corpus.json" "$SOURCE_ID")
node "$R/scripts/extract.mjs" enrichment template --store "$S" --case "$CASE_ID" --source "$SOURCE_ID" --revision "$REVISION_ID" --output "$S/enrichment-template.json"
# Edit the private template, retaining exact quoted artifacts and pending status.
node "$R/scripts/extract.mjs" enrichment validate --store "$S" --input "$S/enrichment-template.json"
node "$R/scripts/extract.mjs" enrichment import --store "$S" --input "$S/enrichment-template.json"
node "$R/scripts/extract.mjs" enrichment export --store "$S" --case "$CASE_ID" --output "$S/enrichment-export.json"
```

Imports are private, pending, and revision-linked. They neither change core
claims/review decisions nor imply confirmed maliciousness. Outputs refuse
existing files; use a fresh output name. See the [enrichment contract](docs/architecture.md#private-talk-enrichment-contract)
for required fields, evidence locators, overlapping role dimensions,
agent/model provenance, and observed-versus-proposed distinctions.
Case/source/revision references use the existing core identifier syntax,
including colons; annotation IDs retain their separate sidecar restrictions.

### Campaign extraction through a configured Codex chat

This separate workflow operates on one **existing** case. `prepare` freezes its
selected retained revisions, exact citations and hashes, at most 1,000 passages
of at most 2,400 Unicode code points each, the extraction instructions, and the
candidate guide into a `campaign-request/1` file. By default it deduplicates the
case's source list and selects the last retained revision in each source's
revision list. Use `--revisions` only to select comma-separated retained revision
IDs explicitly. Unavailable text is recorded rather than fetched or omitted.
Requests and candidates are each limited to 2 MiB.

**Research library** opens as cards grouped by existing cases, with article,
claim, path and supported-behavior links; sources without cases remain independent
cards. Selecting an article opens its exact revision/evidence detail, while
**Claims & evidence** remains the claim-first inspection view. **ATLAS & TTPs**
shows recorded mappings separately from unresolved candidates and the pinned
resolver references present in applied runs. Catalog references are not incident
evidence; the current resolver has limited ATT&CK coverage and the pinned ATLAS
2026.09 catalog. Historical run snapshots remain separate from current references.

Research chips use compact normalized publisher names (including Nx); repeated
publisher chips are numbered, with exact article titles in tooltips/accessibility
labels. Reported metadata stays separate. Behaviors opens a suggested normalized
inventory, separating atomic actions and activity-pattern candidates; original
records and evidence remain inspectable. Chained activities come only from
recorded path relationships. Grouping suggests review and never merges evidence.
See the [researcher usability review](docs/usability-review.md) for limits.

Potential consequences and disputed behavior remain inference in the research
annotation projection, with the original classification in context notes.
Node-specific technique candidates may cite only claims supporting that node.
This boundary applies before catalog lookup, including unknown IDs/versions and
unsupported source literals: `pathId` and `nodeId` must be supplied together,
name a node in the candidate path and include the candidate behavior; **all**
mapping claims must support that node. Candidate path/node references use their
local IDs; stored records retain the canonical generated IDs. Unscoped candidates
remain broader case/behavior proposals even when their claims overlap a node.

Issue #48 permits explicitly supported self-loops as well as multi-node cycles.
Every edge still needs its own claim support, relation, plain-language basis and
source-supported/inferred classification. A loop alone proves neither repetition
nor chronology, execution or causality. New unresolved candidates retain scope,
rationale, applicability, exact support, framework/version, technique/source
literals, reason, agent authorship and Pending state in status and private exports;
no catalog miss becomes an official mapping.

```bash
R=/absolute/path/to/DevEnvThreatCorpus
S=/absolute/private/store
CASE_ID=existing-case-id
umask 077
node "$R/scripts/extract.mjs" campaign prepare --store "$S" --case "$CASE_ID" \
  --output "$S/campaign-request.json" --requested-model 'GPT-6.1 Sol High'
# Optional: add --revisions source-revision-id-1,source-revision-id-2
# Give only campaign-request.json to the researcher-configured Codex chat.
# Save its single campaign-candidate/1 JSON response as the private file below.
chmod 600 "$S/campaign-candidate.json"
node "$R/scripts/extract.mjs" campaign validate --store "$S" \
  --request "$S/campaign-request.json" --input "$S/campaign-candidate.json"
node "$R/scripts/extract.mjs" campaign apply --store "$S" \
  --request "$S/campaign-request.json" --input "$S/campaign-candidate.json"
node "$R/scripts/extract.mjs" campaign status --store "$S" --case "$CASE_ID"
node "$R/scripts/extract.mjs" campaign export --store "$S" --case "$CASE_ID" \
  --output "$S/campaign-talk.json" --format json
node "$R/scripts/extract.mjs" campaign export --store "$S" --case "$CASE_ID" \
  --output "$S/campaign-talk.md" --format md
# Omit --case from status to summarize every run in the private store.
```

The requested model label is advisory metadata, not a selection made by this
repository. For this implementation the requested label is `GPT-6.1 Sol High`;
the effective main-chat model/version is not exposed and must remain `null` with
an `unknown` reason unless the entrypoint supplies it. Do not confuse either
value with the model used by an implementation agent. Candidate article text,
code, prompts, and links remain untrusted data; do not execute or follow them.
CLI terminal output is limited to safe identifiers, hashes, coverage and record
counts, while request, candidate and export content stays in protected files.

`apply` rechecks the unchanged request/base/hashes and exact quotations, resolves
Unicode code-point offsets locally, validates complete coverage and dependency
closure, then atomically updates `corpus.json`. Core pending records and a
versioned `governance.campaignExtraction` run snapshot share that publication
boundary. Existing manual extraction, review history and enrichment sidecars are
preserved; generated annotations are a derived compatibility projection. Exact
replay is idempotent, while stale, colliding, invalid or concurrent operations
leave the prior snapshot usable. JSON/Markdown exports are private,
dependency-closed pending research drafts, never reviewed releases.
Fresh preparation uses `campaign-extraction/2` and writes `campaign-run/2`, binding
`campaign-record-normalization/2` into generated record identities. Request and
candidate interfaces remain `/1`; existing snapshot/export containers are unchanged.
Applied `/1` runs stay readable and exact replay does not rewrite them. Unapplied
old requests must be prepared again rather than normalized under old identities.
The read-only `unresolvedMappingAvailability` entries label historical missing
metadata `unavailable` and scope `case/behavior`; they never reconstruct a node,
rationale or applicability, or alter the original run envelope.

This is the extraction prerequisite for #46, not graph/navigation completion.
Exports remain case-wide private dependency-closed bundles; selected-path-only
exports are deferred. Run `node --test tests/campaign-records.test.mjs tests/campaign.test.mjs`
explicitly alongside `python scripts/verify.py` using pinned Node 22.23.3 on POSIX.
Native Windows file-URL/permission behavior is not validated by this exercise.
Independent human relationship, metadata, compatibility and documentation review
and approval remain required; synthetic success is not semantic gold acceptance.

In `node "$R/scripts/server.mjs" --store "$S"`, open **Curator studio → Enrich
campaign**. Choose an existing case, prepare/download its request, use the same
researcher-mediated Codex handoff, and import one returned JSON file (2 MiB
maximum) against that in-session request. The workbench displays pending state,
coverage, limitations and model disclosure. Case talk downloads add the same
campaign run/catalog provenance and dependency closure. Preparation is not
extraction, and the browser never receives filesystem paths or model credentials.

Before evaluating protected retained material, copy the pre-evaluation store;
never refetch substitute text for a missing revision. Keep the frozen gold
checklist human-authored and independent of the model response:

```bash
LIVE=/absolute/private/original-store
E=/absolute/private/evaluation
umask 077
mkdir -p "$E"
cp -a "$LIVE/." "$E/store/"
cp "$LIVE/corpus.json" "$E/corpus.before.json"
chmod 700 "$E" "$E/store"
find "$E" -type d -exec chmod 700 {} \;
find "$E" -type f -exec chmod 600 {} \;
find "$E/store" -type f -print0 | sort -z | xargs -0 sha256sum > "$E/pre-evaluation.sha256"
sha256sum "$E/corpus.before.json" > "$E/corpus.before.sha256"
# A human now creates $E/gold-checklist.json independently of the candidate.
chmod 600 "$E/gold-checklist.json"
sha256sum "$E/gold-checklist.json" > "$E/gold-checklist.sha256"
# Run prepare/validate/apply/status/export against $E/store, not $LIVE.
# Compare quoted evidence programmatically and the result against the human gold.
sha256sum -c "$E/corpus.before.sha256"
sha256sum -c "$E/gold-checklist.sha256"
```

Record only safe aggregate complete/partial/failed revision counts, gold coverage
counts, quote-validation counts, hashes and discrepancies on the issue/PR—never
private text. The current three-revision protected evaluation and frozen gold
measurement have not been performed. See the [campaign architecture](docs/architecture.md#campaign-extraction-contract)
and [Issue #45 acceptance matrix](docs/acceptance-audit.md#issue-45-passage-grounded-campaign-extraction).

## Manual extraction: offline exercise

Extraction reads an existing valid private `corpus.json` and an explicit
researcher-completed JSON template. It never retrieves sources, calls a model,
creates cases, merges cases, or accepts claims. The committed example and base
corpus below are synthetic test data only:

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/extraction-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
cp "$R/tests/fixtures/extraction/manual.json" "$S/template.json"
chmod 600 "$S/corpus.json" "$S/template.json"
node "$R/scripts/extract.mjs" --template "$S/template.json" --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
# Repeating the exact template is idempotent.
node "$R/scripts/extract.mjs" --template "$S/template.json" --supplied-by operator --store "$S"
```

For research input, set `schemaVersion` to `manual-extraction/1` and provide a
`claims` array. Each claim names an existing `caseId`,
`sourceId`, `sourceRevisionId`, and the revision's exact `normalizedHash`, plus
its description, evidence status, origin, and a researcher-assigned ID.
Source-grounded claims include passage records with IDs, locators, zero-based
half-open Unicode code-point offsets, and passage text that exactly matches the
retained normalized revision. Inference claims instead set `evidenceStatus` to
`Researcher inference`, `origin` to `Human inference`, and provide an
`inference` object with rationale and supporting claim IDs. Conflict links must
be reciprocal in the template. See `tests/fixtures/extraction/manual.json` for
the complete synthetic format. Use an explicit existing case; the CLI never
infers case identity from sources or content.

The template and private store must be absolute local paths with restrictive
permissions. Success and failure are JSON outcomes; invalid templates leave the
corpus unchanged. A successful extraction records a manifest and leaves claims
`Pending`. This operation does not establish source truth, reviewer identity,
acceptance, or conflict resolution. See [manual extraction rules and
limitations](docs/architecture.md#manual-extraction-contract).

## Manual claim review: offline exercise

Review is an explicit human operation, not an intake/extraction side effect.
Use the synthetic fixture only to exercise commands; it is not incident evidence:

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/review-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
cp "$R/tests/fixtures/review/accept.json" "$S/decision.json"
chmod 600 "$S/corpus.json" "$S/decision.json"
node "$R/scripts/review.mjs" status --file "$S/corpus.json" > "$S/status.json"
# Copy the current base digest into the synthetic decision, not a cached approval.
node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));d.baseDigest=JSON.parse(fs.readFileSync(process.argv[2],"utf8")).baseDigest;fs.writeFileSync(process.argv[1],JSON.stringify(d,null,2)+"\n");' "$S/decision.json" "$S/status.json"
node "$R/scripts/review.mjs" decide --template "$S/decision.json" --store "$S" --reviewer synthetic-human-reviewer
node "$R/scripts/review.mjs" status --file "$S/corpus.json"
node "$R/scripts/review.mjs" validate --file "$S/corpus.json"
```

For real review, inspect the claim and its exact cited passages first; supply
your own reviewer identifier (1–64 ASCII letters/digits, `_`, `.`, `-`, starting
with a letter/digit) and substantive rationale. Do not use the fixture's identity
or rationale as actual research approval. The template requires
`schemaVersion: "manual-review/1"`, `claimId`, `baseDigest`, `rationale`, and
`action: "accept"`, `"correct"`, or `"exclude"`.

To correct, edit the private decision to set `"action": "correct"` and add, for
example, `"correction": {"description": "Corrected claim wording"}`. The claim
becomes `Needs correction` with a new revision and event, never automatically
accepted. To exclude, set `"action": "exclude"` and remove `correction`.
Accept/exclude cannot include a correction. After changing content, rerun
`status` and copy the new `baseDigest` before a separate accept decision.
Decisions may revisit existing dispositions; each successful invocation appends
an event, including repeated decisions, rather than deduplicating human actions.

Review-aware `status` and `validate` are read-only and report only current
acceptance: stale recorded acceptance is effectively `Pending`. Strict
`contract.mjs validate` and the unchanged workbench reject stale acceptance.
Unknown claims, stale bases, invalid corrections, blank rationale, malformed
templates, unsafe paths, and concurrent writers exit nonzero without modifying
the corpus. See [review semantics and failure codes](docs/architecture.md#manual-claim-review-contract)
for audit, correction-field, identity, and storage limitations.

## Corpus exports and read-only queries: offline exercise

Exports use a private local corpus file and never fetch or ingest a source.
Reviewed output contains only currently accepted claims and their accepted
claim-dependency closure; with no eligible claims it produces a valid empty
reviewed profile. Draft output is separately labeled and warns that its records
are not an eligible reviewed release. Both omit full article snapshots and
review-event history. Output directories must not already exist.

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/export-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
chmod 600 "$S/corpus.json"
node "$R/scripts/contract.mjs" export --file "$S/corpus.json" --profile reviewed --out "$S/reviewed"
node "$R/scripts/contract.mjs" export --file "$S/corpus.json" --profile draft --out "$S/draft"
node "$R/scripts/contract.mjs" list --file "$S/corpus.json" --profile draft --entity claims
node "$R/scripts/contract.mjs" get --file "$S/corpus.json" --profile draft --entity claims --id synthetic-claim-a
node "$R/scripts/contract.mjs" bundle --file "$S/corpus.json" --profile draft --case synthetic-case-a
```

Each export contains an allowlisted schema, typed JSONL, case/source/timeline
CSV, and manifest with file hashes, snapshot digest, profile, unit counts, and
review coverage. CSV null values are empty cells accompanied by `nullReasons`;
multi-label fields and typed dates use JSON cells so labels, precision, ranges,
and unknown values round-trip. Formula-like cells are prefixed with an
apostrophe, with the repository parser reversing that prefix for round trips.
Counts identify cases, sources, or claims and do not imply prevalence or
detection coverage. List/get/bundle accept only cases, sources, and claims;
unknown IDs and unsupported schema versions fail explicitly. See
[export/query rules and limitations](docs/architecture.md#reproducible-exports-and-read-only-queries).

## Research Workbench: offline preview

With the pinned Node runtime, start the loopback-only preview from the repository
root; no installation, build, CDN, model, or internet connection is required:

```sh
node scripts/server.mjs
```

Open `http://127.0.0.1:4173/`. The initial corpus is empty. Select **Load synthetic
demo** to exercise benign 0.3.0 fixtures, including emoji passages, inference,
and conflicting claims. Demo records are not incident evidence and are never
written to your corpus. Browse cases and sources independently; click passage
highlights or claim links to inspect their exact retained revision.

Select **Reload local corpus** to leave the demo and restore the configured
startup snapshot (or the empty corpus if none was supplied), clearing search
and filters. This does not reread changed files; restart the server for that.

To inspect fresh intake/extraction output instead, supply its absolute private
corpus path (file mode `0600`, as produced by intake):

```sh
node scripts/server.mjs --corpus /absolute/private/store/corpus.json --port 4173
```

This validates the whole corpus before serving a read-only startup snapshot.
Restart the server to reload changed records; stop it with Ctrl+C. Retained
article content is exposed only to the local browser. Do not deploy, tunnel,
share screenshots containing private material, or relax file permissions to use
this preview. Missing retained text is reported, not reconstructed. For further
privacy, filtering, and acceptance limits see [Architecture](docs/architecture.md)
and [Acceptance audit](docs/acceptance-audit.md).

### Comparison & timelines: filter collected observations

Open **Comparison & timelines** (or `http://127.0.0.1:4173/#comparison`).
Select cases or filter by trust surface, AI involvement, execution location,
tool/platform, delivery, objective, evidence status, and claim reviewer
disposition. Search ANDs every selected facet; each facet defaults to OR across
values and offers AND (all values required); tags use **Tag matching**.
Category labels are case-linked assertions, including pending/conflicting
proposals, not established case facts. Evidence/disposition filters match each
claim itself. Empty results offer reset, and evidence crosslinks reset filters
to reveal the target.

Choose a date type and optional inclusive **From / Through** boundaries.
Month/year/range values match by interval overlap without changing their
displayed precision. Unknown dates do not match bounded ranges; **only** shows
unknown dates and ignores bounds. Publication/source update stay separate from
first reported activity, incident/execution, discovery, and disclosure. Dated
entries sort by earliest possible interval bound, not an invented event day;
unknown dates are displayed separately and unordered.

Separate case columns retain passage citations, exact revisions, origin,
evidence status, uncertainty, and supplied disposition. Inferences or claims
without retained passage support are available in a labeled section but excluded
from source-supported comparison. Conflicting counterparts remain visible even
outside active filters, without entering selected counts. Shared citations are
observations within this dataset, never shared attribution or prevalence.

Counts identify distinct selected cases, distinct linked sources in their full
case context, matching claims, and source-supported claims. Timeline entries also
show full selected case context, constrained by the typed date filter. Repeated
reports do not increase case counts. Review coverage reports matching recorded
human events and claim dispositions, **not current acceptance eligibility** or
independent approval; use the review CLI for eligibility. Active filters and a
SHA-256 identifier of the loaded JSON snapshot remain visible. Nothing is written
or fetched remotely; independent human research, UX/accessibility, and
documentation review is required before merge.

### Curator studio: paste, select, draft, download

1. Open **Curator studio → Direct article intake / paste**. Supply an authorized
   article, its credential-free HTTPS URL, supplier identifier, and optional
   title/publisher/author. Nothing is fetched. Text is retained privately in
   memory, with CRLF/CR converted to LF and Unicode NFC normalization. Pasted
   HTML is **literal text**, not rendered or converted to readable HTML; paste
   the article's readable text instead if you do not want tags in your evidence.
   The 2 MiB limit matches CLI supplied-text intake. An already-loaded URL is
   not overwritten: select its retained revision instead.
2. Select a source and exact revision, then drag over the normalized text.
   Alternatively extend a text selection with Shift+arrow keys, or activate
   **Select entire revision** with the keyboard. The captured quote,
   revision hash, locator, and zero-based half-open **code-point** interval
   appear beside the composer. Selecting text in the Research library also
   opens this drawer; **Draft from this revision** opens it without a selection.
3. Choose an existing case, or explicitly create a named draft case with a kind.
   Enter a claim, evidence status, and uncertainty. A source assertion needs an
   active passage; **Researcher inference** instead needs a rationale and at
   least one earlier same-case saved draft claim. Saving consumes the selection.
   Choose a new passage for another assertion. Inferences do not fabricate quotes.
4. Optionally describe a behavior, choose multiple categorization values, enter
   IOCs/artifacts one per line, and pick techniques from a loaded local catalog
   or enter candidate ATT&CK/ATLAS IDs. Candidate IDs are unverified annotations,
   not official catalog entries or reviewed mappings. No remote catalog is used.
   Remove a mistaken draft and compose it again; remove dependent inferences first.
5. **Download manual-extraction/1** exports claims/passages only when all referenced
   cases and revisions already exist in the loaded corpus. Apply this JSON using
   the existing extraction command below. Behavior, categories, IOCs, and technique
   candidates are **not** part of that CLI format.
6. **Download private corpus proposal** includes intake metadata, normalized/raw
   text, claims, categories, and behavior annotations as standalone schema-valid
   0.3.0 JSON. It identifies the original corpus by digest and marks existing
   case/source identities as context, not updates. **Do not overwrite an existing
   corpus with it.** There is no automatic merge/promotion command for this richer
   proposal; a human must inspect it and arrange a scoped local application.

Protect downloaded files (mode `0600`) in a private directory (mode `0700`).
Do not commit or upload them. To apply an existing-record extraction download:

```sh
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
node "$R/scripts/extract.mjs" --template /absolute/private/manual-extraction.json --store /absolute/private/store --supplied-by operator
# Validate a standalone richer proposal without applying it:
node "$R/scripts/contract.mjs" validate --file /absolute/private/curator-proposal.json
```

Saved drafts survive Workbench tab navigation only. Reloading the page, closing
it, or confirming a corpus switch discards them; unsaved composer fields are
discarded when the panel is rebuilt. Download first. All authored records remain
pending, and independent human research review and merge approval are required.

## Validate locally

Requirements: Python with the pinned dependency from
`requirements-governance.txt`, plus Node.js v22.23.3 as declared by
`scripts/.nvmrc`.

```powershell
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

`python scripts/verify.py` runs the repository governance checks and configured
project commands, including the offline contract, intake, extraction,
campaign-record, review, export/query, workbench, and preview-server suites.
To run the focused suites directly with the pinned Node runtime:

```powershell
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/contract.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/intake.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/extract.test.mjs
node --test tests/campaign.test.mjs
node --test tests/campaign-records.test.mjs
node --test tests/review.test.mjs
node --test tests/exports.test.mjs
node --test tests/workbench.test.mjs
node --test tests/server.test.mjs
```

The tests check valid and invalid synthetic records: source and passage
provenance, case/claim relationships, hash and locator consistency,
categorization and timeline constraints, conflict links, current human-review
requirements, clean-start behavior, optional enrichment, and deterministic
serialization. Intake checks use injected fake DNS/transports, while extraction
tests use synthetic corpus/templates and temporary private stores. Neither suite
contacts websites or assesses whether a research claim is factually true.
Campaign-record checks use benign claims and a narrow pinned catalog fixture to
exercise supported/unresolved records and inert proposals; they do not measure
real extraction recall, framework correctness, or research truth.
Review tests exercise private decisions, append-only history, stale acceptance,
negative inputs, and separate provenance/status axes without authenticating a human.
Export/query tests use only visibly synthetic corpus fixtures and check reproducible
profiles, eligibility/dependency closure, CSV round trips, safe cell handling,
and private snapshot exclusion.

## Project status and next work

Implemented now:

- JSON Schema 0.3.0 and matching TypeScript declarations.
- Offline validation for structural rules and cross-record relationships.
- Deterministic identity and serialization helpers.
- Manual URL/text/file intake, bounded destination-checked HTTPS retrieval,
  private atomic retention, linked revisions, and recoverable failure manifests.
- Offline manual extraction from researcher-completed templates, exact
  revision-grounded passages, explicit case/source links, inference and conflict
  records, and pending-only outcomes.
- Researcher-mediated campaign request/candidate handoff for existing cases,
  with bounded passage coverage, exact local quote resolution, atomic pending
  records/run snapshots, narrow pinned-catalog resolution, status and private
  dependency-closed talk exports. No runtime model/network adapter is included.
- Private local claim acceptance, correction, and exclusion with append-only
  digest-bound events, explicit reviewer attribution, and current-eligibility checks.
- Deterministic reviewed/draft export profiles, typed JSONL, case/source/timeline
  CSV, digests and coverage metadata, plus read-only case/source/claim queries.
- Read-only client-side research workbench (`src/**`) with Unicode passage
  inspection, case/claim exploration, conflicts, facets, local branding, and a
  loopback-only offline preview server (`scripts/server.mjs`).
- Synthetic positive and negative contract fixtures with acceptance-focused
  tests.
- Project documentation describing the clean-start decision and evidence
  limits.

Not implemented yet:

- Unattended semantic extraction, runtime model/provider integration, or
  independently validated real-article extraction quality.
- Authenticated reviewer identity or hosted review.
- Deployment or an operational corpus-processing pipeline.

See [Architecture](docs/architecture.md) for the intended fresh-input flow,
[Acceptance audit](docs/acceptance-audit.md) for criterion-to-test and evidence
mapping, and [Documentation index](docs/README.md) for the other project
guides. The preserved [handoff](handoff/00-START-HERE.md) describes product
history and possible future work; it does not indicate that those features are
already implemented.

## Contribution and review

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution guidelines, [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) for community standards, and [SECURITY.md](.github/SECURITY.md) for vulnerability disclosure.

Start with a complete implementation-task issue containing requirements,
scope/exclusions, dependencies, stable acceptance criteria, and definition of
done. PRD issues/files or other requirements links are optional. An authorized
human starts one Copilot session; corrections stay on its originating PR.

Keep implementation scoped to its originating issue and preserve stable
acceptance-criterion IDs. Application and governance changes require relevant
documentation and substantive root `CHANGELOG.md` prose in the same PR.
Maintain this README when public entrypoints, setup, or usage change; configured
triggers enforce a minimum, not proof of relevance. Documentation-only and
test-only maintenance need no ceremonial changelog or learning entry.
Changed learning notes must update the learning index in the same PR.
See [upkeep rules](docs/setup-and-configuration.md#documentation-upkeep-policy)
and [required merge settings and inspection blocker](docs/merge-rules.md).
Automated checks establish contract behavior, not
research truth or authenticated human approval; subjective acceptance requires
independent human review before merge. Do not put secrets in source records,
issues, prompts, or logs.
