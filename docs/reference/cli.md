# CLI reference

Run from the clone root using the [pinned Node runtime](../../scripts/.node-version).
Examples use an absolute `REPO` and private temporary files. Install the locked
tokenizer for campaign preparation; no model credentials, live articles or
application build are needed for offline work.
These recipes replace the historical README exercises while its anchors remain.
See [configuration](configuration.md) for server modes, permissions and bounds,
and [formats](formats-and-versioning.md) for input contracts.

## Command inventory

### Staged extraction and protected regeneration

These are POSIX private-store operations using pinned Node and the installed
locked tokenizer. `STORE`, `NEW_STORE` and artifact paths below must be absolute,
operator-owned protected paths outside the repository. Directories require mode
0700 and files 0600. Create `NEW_STORE` separately before writing its `corpus.json`;
never reuse the old store or overwrite the baseline. No command invokes a model.

```sh
node scripts/extract.mjs stage prepare --store "$STORE" --case "$CASE" --stage ground --output "$GROUND_REQUEST"
node scripts/extract.mjs stage validate --store "$STORE" --request "$GROUND_REQUEST" --input "$GROUND_CANDIDATE"
node scripts/extract.mjs stage apply --store "$STORE" --request "$GROUND_REQUEST" --input "$GROUND_CANDIDATE"
node scripts/extract.mjs stage status --store "$STORE" --case "$CASE"
node scripts/extract.mjs stage prepare --store "$STORE" --case "$CASE" --stage interpret --inputs "$ITEM_KEYS" --output "$INTERPRET_REQUEST"
node scripts/extract.mjs stage prepare --store "$STORE" --case "$CASE" --stage relate --inputs "$BEHAVIOR_AND_SUPPORT_KEYS" --output "$RELATE_REQUEST"
```

Use exact comma-separated review `itemKey` values from the review snapshot; these
are not labels. Interpret includes applied claims/literal usage; Relate includes
applied behaviors/occurrences and support. Required dependency closure is selected
automatically. `--revisions` selects retained revision IDs; `--requested-model`
is advisory. Complete `candidateGuide` manually using only permitted outputs.
Validate and explicitly apply each stage before preparing the next from the
actual current base. The private browser mode exposes the same three actions,
an extraction-mode selector and an upstream-key field.

Any intervening corpus write, including review, invalidates an unapplied request.
Keep its protected request/candidate for audit; prepare a new request against the
current effective inputs, regenerate or deliberately recheck/rebind the candidate,
validate, then apply. Never edit an old run or silently replace its base hash.
Identical already-applied content replays without new records; genuinely new
responses get new identities and no transferred acceptance. Skipped/failed work
stays visible; resume by preparing current inputs and explicitly reporting every
selected input. A completed stage is not proof of complete extraction or review.

For the authorized single-campaign comparison, first freeze the old store, then
generate only into a separate candidate with the same retained revisions:

```sh
node scripts/extract.mjs regeneration freeze --store "$STORE" --case "$CASE" --output "$BASELINE"
node scripts/extract.mjs regeneration candidate --baseline "$BASELINE" --output "$NEW_STORE/corpus.json"
# Run the staged handoffs above against NEW_STORE, not STORE.
node scripts/extract.mjs regeneration compare --store "$NEW_STORE" --baseline "$BASELINE" --output "$COMPARISON"
node scripts/extract.mjs regeneration select --store "$NEW_STORE" --baseline "$BASELINE" --comparison "$COMPARISON" --input "$ADJUDICATION"
node scripts/extract.mjs regeneration status --store "$NEW_STORE"
```

`select` requires independent human source-backed adjudication of every major
group and explicit approval; it appends a private selection record, never accepts
items or modifies the old/public corpus. Comparison can be inspected side-by-side
in the private studio using a local comparison file. The browser cannot select
the baseline. Selection records the choice inside the candidate store; an operator
must explicitly start the private server with `--store "$NEW_STORE"` to use it.
See the [evaluation/adjudication procedure](../researcher-review-guide.md#staged-extraction-and-independent-comparison).

Every option below takes a value. Unknown/duplicate flags fail; there is no
`--help` command. Paths for private inputs/stores/outputs must be absolute and
permission-restricted. Supplier/reviewer IDs use the
[ASCII identifier contract](formats-and-versioning.md#review-decisions).

| Entrypoint / command | Required flags | Optional flags / default |
|---|---|---|
| `contract.mjs validate` | `--file` | Strict full corpus validation |
| `contract.mjs intake text` | `--text --supplied-by --store` | `--source-url` (association only, no fetch) |
| `contract.mjs intake file` | `--file --supplied-by --store` | `--source-url` |
| `contract.mjs intake url` | `--url --supplied-by --store` | Authorized public HTTPS retrieval |
| `contract.mjs intake batch` | `--urls-file --supplied-by --store`, exactly one `--case-id` / `--case-name` | `--max-images --image-bytes --image-total-bytes` lower image bounds |
| `extract.mjs` (no subcommand) | `--template --supplied-by --store` | Manual Pending claims only |
| `extract.mjs enrichment template` | `--store --case --source --revision --output` | Private placeholder template |
| `extract.mjs enrichment validate` / `import` | `--store --input` | Import stays pending |
| `extract.mjs enrichment export` | `--store --output` | `--case` |
| `extract.mjs campaign prepare` | `--store --case --output` | `--revisions` comma-separated IDs; `--requested-model` advisory |
| `extract.mjs campaign prepare-adapter` | `--store --case --output` | `--revisions`; offline provider-bound request preparation |
| `extract.mjs campaign generate` | `--store --request --output --enabled true --confirm-public <requestHash>` | Explicit billable action; process `OPENAI_API_KEY` required |
| `extract.mjs campaign validate` / `apply` | `--store --request --input` | `--receipt` required for adapter requests; validate first, apply explicitly |
| `extract.mjs campaign status` | `--store` | `--case` |
| `extract.mjs campaign export` | `--store --case --output` | `--format json` (default), `md` or `markdown` |
| `review.mjs status` / `validate` | `--file` | Review-aware, read-only |
| `review.mjs decide` | `--template --store --reviewer` | Explicit human decision |
| `contract.mjs export` | `--file --out` | `--profile reviewed` (default) or `draft` |
| `contract.mjs list` | `--file --entity cases\|sources\|claims` | `--profile`, `--case-id`, `--limit` (100 default, 1–1,000) |
| `contract.mjs get` | `--file --entity cases\|sources\|claims --id` | `--profile` |
| `contract.mjs bundle` | `--file --case` | `--profile` |
| `server.mjs` | None | `--port 4173`; mutually exclusive `--corpus` / `--store` |

Implementation: [contract CLI](../../scripts/contract.mjs) `intakeCli`,
[extraction CLI](../../scripts/extract.mjs) `cli`, [review CLI](../../scripts/review.mjs)
`cli`, [server](../../scripts/server.mjs) `parseArguments`.

## Offline exercise setup

Use a new terminal at the repository root. This creates only a private disposable
directory outside the clone. Never substitute a real research store into this
exercise or treat synthetic review events as human approval of research.

```sh
REPO="$PWD"
umask 077
WORK="$(mktemp -d /tmp/devenv-reference.XXXXXX)"
mkdir "$WORK/intake" "$WORK/research"
cp "$REPO/tests/fixtures/benign/core-only.json" "$WORK/research/corpus.json"
cp "$REPO/tests/fixtures/extraction/manual.json" "$WORK/manual.json"
chmod 600 "$WORK/research/corpus.json" "$WORK/manual.json"
```

Keep these variables for the subsequent blocks. Use new output names when
repeating export/prepare commands; they refuse existing destinations.

## Manual intake

```sh
node "$REPO/scripts/contract.mjs" intake text \
  --text 'Benign synthetic source; not incident evidence.' \
  --supplied-by synthetic-researcher --store "$WORK/intake"
printf '%s\n' 'Another benign synthetic source.' > "$WORK/input.txt"
node "$REPO/scripts/contract.mjs" intake file \
  --file "$WORK/input.txt" --supplied-by synthetic-researcher --store "$WORK/intake"
node "$REPO/scripts/contract.mjs" validate --file "$WORK/intake/corpus.json"
```

Expect sources, retained revisions and collection manifests, but no cases,
passages, claims or acceptance. Exact successful replay is idempotent.
`intake url --url …` uses the same supplier/store flags; **do not run it without
explicit source/access/retention authorization**. `--source-url` on text/file
records an operator association, not authenticated URL retrieval.

## Batch collection

For authorized live work only, create a mode-0600 UTF-8 newline-delimited URL
file (1–20 public HTTPS URLs), then choose one:

```sh
# Not part of the offline exercise: requires authorized live URLs.
node "$REPO/scripts/contract.mjs" intake batch \
  --urls-file /absolute/private/urls.txt --case-id existing-case-id \
  --supplied-by your-id --store /absolute/private/store
# Alternatively replace --case-id with --case-name 'New Pending campaign'.
```

Batch is sequential. A new case is created only after successful collection;
successful revisions link to the selected case, failed URLs remain failed.
One failure does not roll back another source. Mixed success returns `partial`
and a nonzero CLI exit; inspect per-source results rather than interpreting this
as complete failure or complete coverage. Original HTML/images stay protected
archives, not application previews. Offline transport/address/robots/archive
coverage is in [intake tests](../../tests/intake.test.mjs), not live-site evidence.

## Manual extraction

```sh
node "$REPO/scripts/extract.mjs" --template "$WORK/manual.json" \
  --supplied-by synthetic-researcher --store "$WORK/research"
node "$REPO/scripts/contract.mjs" validate --file "$WORK/research/corpus.json"
```

The committed template matches only the synthetic base. It adds five Pending
claims, exact passages, explicit case/source links and a success manifest.
Emoji/NFC fixtures demonstrate code points, not byte/UTF-16 offsets.
Idempotent rerun does not approve or duplicate the result.

## Private enrichment

```sh
node "$REPO/scripts/extract.mjs" enrichment template \
  --store "$WORK/research" --case synthetic-case-a \
  --source synthetic-source-a --revision synthetic-revision-a \
  --output "$WORK/enrichment.json"
node "$REPO/scripts/extract.mjs" enrichment validate \
  --store "$WORK/research" --input "$WORK/enrichment.json"
node "$REPO/scripts/extract.mjs" enrichment import \
  --store "$WORK/research" --input "$WORK/enrichment.json"
node "$REPO/scripts/extract.mjs" enrichment export \
  --store "$WORK/research" --case synthetic-case-a --output "$WORK/enrichment-export.json"
```

Template placeholders are inference, not source facts. For real authorized work,
edit literal/support/context fields deliberately and validate before import.
All annotations remain pending; changed values under an existing ID are collisions.
This sidecar does not rewrite canonical claims or reviews.

## Campaign request/chat/candidate handoff

```sh
node "$REPO/scripts/extract.mjs" campaign prepare \
  --store "$WORK/research" --case synthetic-case-a --output "$WORK/request.json"
node "$REPO/scripts/extract.mjs" campaign status \
  --store "$WORK/research" --case synthetic-case-a
node "$REPO/scripts/extract.mjs" campaign report \
  --store "$WORK/research" --request "$WORK/request.json" --output "$WORK/chunks.txt"
```

Install the locked tokenizer with `npm ci --prefix scripts --ignore-scripts`
before preparation. The report contains private retained text and must stay
in the mode-0700 working directory; it is a new mode-0600 file, never stdout.
It lists canonical ranges, reference token counts, overlap and split warnings.
Inspect it before applying a candidate: a later corpus/review change makes
the frozen request stale. Reporting does not collect, extract, apply or accept.

For a data-free, cross-platform inspection, run
`node scripts/extract.mjs campaign report-demo`. Only this explicitly synthetic
report is printed to stdout; it needs no private store or model. On native
Windows use `node .\scripts\extract.mjs campaign report-demo` after installing
the locked dependency. Real private-store reporting remains POSIX-only.

For actual extraction, inspect this private request, deliberately supply it to
your configured chat, save returned `campaign-candidate/1` JSON privately, then
validate and explicitly apply using the commands below. Optional record arrays
belong at candidate top level, not in the guide's `records` property.
Disclose requested/effective model separately; unavailable effective metadata
must remain null/unknown, not inferred from a preference.

### Optional OpenAI generation

Manual chat handoff above remains the default. The alternative below is CLI-only
and disabled unless deliberately enabled for a single request. It requires POSIX
private storage, the locked tokenizer and an operator-provisioned project-scoped
`OPENAI_API_KEY` in that CLI process's environment. Never paste the key into
commands, browser code, request files, research notes or logs; use your approved
secret-injection procedure. Managed Codespaces startup still strips credentials.
There is no provider SDK, credential discovery, browser generation API or fallback.

Prepare offline and inspect the request and selected retained article revisions:

```sh
node "$REPO/scripts/extract.mjs" campaign prepare-adapter \
  --store "$WORK/research" --case synthetic-case-a --output "$WORK/api-request.json"
```

Preparation returns its `requestHash` without calling a provider. Only an operator
who has confirmed that **all selected text and accompanying citation/scope metadata
are published public research and authorized for processing** may supply that
exact hash to `--confirm-public`. Quoted prompt artifacts in public articles are
source data, not confidential user prompts or instructions to execute.
Local unpublished notes, reviews, raw HTML, images and credentials are excluded.
Confidential source processing is not supported by this initial policy.

The following commands are **not an offline exercise**. Do not execute them
without separate request-specific transmission and spending authorization:

```sh
node "$REPO/scripts/extract.mjs" campaign generate \
  --store "$WORK/research" --request "$WORK/api-request.json" \
  --output "$WORK/api-candidate.json" --enabled true --confirm-public COPIED_REQUEST_HASH
node "$REPO/scripts/extract.mjs" campaign validate \
  --store "$WORK/research" --request "$WORK/api-request.json" \
  --input "$WORK/api-candidate.json" --receipt "$WORK/api-candidate.json.receipt.json"
# Only after inspecting the untrusted candidate and validation result:
node "$REPO/scripts/extract.mjs" campaign apply \
  --store "$WORK/research" --request "$WORK/api-request.json" \
  --input "$WORK/api-candidate.json" --receipt "$WORK/api-candidate.json.receipt.json"
```

Generation writes `api-candidate.json` plus `.attempt.json`, `.receipt.json` when
available and `.result.json` beside it. Existing paths are never overwritten.
Files are `0600` in a `0700` directory. Keep them until deliberate operator
cleanup; none is a public export. A candidate is saved before local validation,
including malformed/truncated text when available. Errors return safe codes and
saved/unsaved indicators, not provider diagnostics or source text. If persistence
fails, retention is uncertain; inspect actual files rather than assuming recovery.

Only `https://api.openai.com/v1/responses` and `gpt-6-luna` are supported; no
regional-residency guarantee is made. `store:false` is not zero retention:
provider abuse-monitoring rules may still apply. JSON mode returns an untrusted
candidate; schema/quote/coverage/reference/snapshot validation remains local.
The payload explicitly omits full catalog descriptions while retaining pins and
technique IDs/names/URLs/tactics; full catalog validation remains local. See
[finite bounds](configuration.md#optional-cli-model-adapter) and
[wire compatibility](formats-and-versioning.md#optional-provider-transport-83).

Generation does not modify `corpus.json` or create a HITL decision. Any intervening
corpus/review write makes an unapplied candidate stale. `STALE_INPUT` preserves
available candidate/receipt files; inspect them, prepare a new request and explicitly
regenerate or rework against its actual segment IDs. Never edit only hashes or
silently transfer approval. Applying the identical already-applied request/output
is replay-safe. A retry needs new artifact paths and may execute/bill again;
timeout/cancellation does not establish exactly-once execution or zero cost.

### Offline handoff exercise

For a **fully offline plumbing exercise**, the following creates an all-skipped
synthetic candidate with no claims, no model call and no claim of extraction:

```sh
node --input-type=module - "$WORK/request.json" "$WORK/candidate.json" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const candidate = {
  schemaVersion: 'campaign-candidate/1', requestHash: request.requestHash,
  model: { effectiveModel: null, version: null,
    nullReasons: { effectiveModel: 'unknown', version: 'unknown' } },
  coverage: request.inputs.flatMap(input => input.segments.map(segment => ({
    segmentId: segment.id, status: 'skipped', reason: 'Synthetic offline plumbing only.'
  }))),
  claims: [], absences: [], limitations: ['No model or semantic extraction exercised.']
};
writeFileSync(process.argv[3], JSON.stringify(candidate), { mode: 0o600 });
JS
node "$REPO/scripts/extract.mjs" campaign validate \
  --store "$WORK/research" --request "$WORK/request.json" --input "$WORK/candidate.json"
node "$REPO/scripts/extract.mjs" campaign apply \
  --store "$WORK/research" --request "$WORK/request.json" --input "$WORK/candidate.json"
node "$REPO/scripts/extract.mjs" campaign status --store "$WORK/research"
node "$REPO/scripts/extract.mjs" campaign export \
  --store "$WORK/research" --case synthetic-case-a --output "$WORK/campaign.json"
node "$REPO/scripts/extract.mjs" campaign export \
  --store "$WORK/research" --case synthetic-case-a --format md --output "$WORK/campaign.md"
```

Expect a Pending run with skipped/failed coverage, **not semantic success**.
New runs record overlapping window geometry and unique completed canonical
code points. HITL progress unions those positions across policies; window counts
are not summed into a coverage percentage.
Apply changes the non-review base even for this no-claim run. Real campaigns must
inspect completed/skipped/failed coverage, absences, exact evidence and limitations.
Protected campaign bundles include complete revisions with retained raw HTML text
and normalized bodies; never publish them.

Protected three-revision quality evaluation is separate: copy the authorized store,
freeze a permission-restricted baseline/hashes and an independent human-authored
gold checklist **before** exposing requests to a model. Never refetch unavailable
revisions or score candidate answers against themselves. Only authorized aggregate
counts/hashes/discrepancies may leave the private store. The offline recipe above
is not that evaluation or evidence of extraction quality.

## Manual claim review

Compatibility note for issue #81: `manual-review/1` remains a legacy audit
interface, but these events alone no longer qualify a reviewed export. Use the
Workbench **Review** page and its [guide](../researcher-review-guide.md), or inspect
the `itemReview` object now included in `status`. For an item template, supply
`snapshot`, `itemKey`, `action`, `selfAttested: true`, `guideVersion:
"researcher-review/2"` and rationale where required; Accept supplies the exact
selected unit's human `confirmationFor(unit)` attestation from `src/review-guide.mjs`
only after personally checking it, or explicit `checks` with
`evidence`, `fidelity`, `scope` and `type`, each `{ "result": "pass" }` only after
the human personally checks it. A documented non-applicability uses
`{ "result": "not-applicable", "reason": "..." }`. Run the same `decide --template
... --store ... --reviewer ...` command; the reviewer flag supplies the identifier.
The browser's friendly Modify fields construct allowlisted corrections; researchers
do not author JSON there. CLI templates still support allowlisted `patch` or
`researcherTags`. Exclude uses a canonical `exclusionReason` and optional
`replacementKeys`; extra prose is optional except for `other`. Unsure requires rationale.
Provenance correction uses `action: "provenance"`, `contentOrigin`,
`labelAuthorship` and `provenanceEvidence` plus rationale. Every action is a
separate snapshot-bound write. `validate` retains its legacy claim-only output;
use `status.itemReview` for full current eligibility. File-only status/exports
cannot load private sidecars; the Workbench API includes them.

First inspect current state:

```sh
node "$REPO/scripts/review.mjs" status --file "$WORK/research/corpus.json"
node "$REPO/scripts/review.mjs" validate --file "$WORK/research/corpus.json"
```

For real work, a human writes a mode-0600 `manual-review/1` decision using the
current `baseDigest`, actual identity and rationale after inspecting support.
No automatic/default acceptance is provided. In this **synthetic exercise only**,
refresh the synthetic decision fixture's digest, then append its simulated event:

```sh
node --input-type=module - "$REPO" "$WORK" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [repo, work] = process.argv.slice(2);
const { reviewBaseDigest } = await import(pathToFileURL(`${repo}/scripts/contract.mjs`));
const decision = JSON.parse(readFileSync(`${repo}/tests/fixtures/review/accept.json`, 'utf8'));
decision.baseDigest = reviewBaseDigest(JSON.parse(readFileSync(`${work}/research/corpus.json`, 'utf8')));
writeFileSync(`${work}/decision.json`, JSON.stringify(decision), { mode: 0o600 });
JS
node "$REPO/scripts/review.mjs" decide --template "$WORK/decision.json" \
  --store "$WORK/research" --reviewer synthetic-human-reviewer
node "$REPO/scripts/review.mjs" status --file "$WORK/research/corpus.json"
node "$REPO/scripts/review.mjs" validate --file "$WORK/research/corpus.json"
```

This tests plumbing, not authenticated human approval. `correct` and `exclude`
use the same command with deliberately authored decisions. Corrections require
new content and a separate later acceptance; exclusions retain records/history.
Re-read status after edits: non-review changes stale earlier acceptance.

## Exports and read-only queries

```sh
node "$REPO/scripts/contract.mjs" export --file "$WORK/research/corpus.json" \
  --profile draft --out "$WORK/draft"
node "$REPO/scripts/contract.mjs" export --file "$WORK/research/corpus.json" \
  --profile reviewed --out "$WORK/reviewed"
node "$REPO/scripts/contract.mjs" list --file "$WORK/research/corpus.json" \
  --profile draft --entity claims --case-id synthetic-case-a --limit 10
node "$REPO/scripts/contract.mjs" get --file "$WORK/research/corpus.json" \
  --profile draft --entity claims --id synthetic-claim-a
node "$REPO/scripts/contract.mjs" bundle --file "$WORK/research/corpus.json" \
  --profile draft --case synthetic-case-a
```

Queries default to `reviewed`, so specify `draft` to inspect Pending records.
No write-back, retrieval or model call occurs. Six allowlisted files comprise
each profile export; full bodies/review decision events are omitted but passages
may remain. Synthetic reviewed-profile output is still synthetic, not incident
acceptance or a public release. See [profile contract](formats-and-versioning.md#profile-exports).

## Curator studio

Start the [workbench](configuration.md#startup-modes), choose a case/source/revision,
select exact text with pointer or keyboard, and save a Pending claim. Save
inference support before its dependent draft. Download `manual-extraction/1` for
existing base cases/revisions and apply it with the manual CLI gate. The richer
private corpus proposal is **not** an automatic change-set or replacement corpus;
reconcile it manually while preserving existing records/reviews.
Drafts live in memory; download authorized private work before reload/switch.

## Errors and recovery

Data CLIs emit JSON; zero exit means `status: "succeeded"`. Batch `partial`
is nonzero. Validation/plumbing success never proves assertions true.

| Code / condition | Action |
|---|---|
| `INVALID_INPUT`, `INVALID_REVIEW`, `UNKNOWN_CLAIM` | Inspect flags/decision/scope; invalid input must not be retried as acceptance |
| `STALE_BASE`, stale/tampered request, mismatched revision/hash | Re-read current state, reprepare or explicitly re-review; never copy old hashes to bypass freshness |
| `INVALID_CORPUS`, unsupported schema, invalid dependency closure | Preserve bytes; correct only authorized input, do not migrate frozen seeds or relax validation |
| `UNSAFE_PATH`, `STORE_BUSY` | Check absolute private paths, modes, symlinks and writer ownership; never delete a potentially active lock |
| `TOO_LARGE`, `MALFORMED_TEXT`, retrieval/normalization failure | Respect bounds/access policy; use authorized supplied fallback, retaining failed outcomes |
| `PERSISTENCE` | Inspect corpus/event history before retry: a post-rename durability/lock-release failure can occur after replacement |

Keep diagnostics private. Recoverable retrieval failures can record Failed
manifests; fallback appends a distinct success without erasing the failed attempt.
Storage failure may prevent its own manifest. Export/prepare destinations must
be new; do not overwrite private evidence to rerun an exercise.
An adapter output destination created or replaced during a provider call fails
with `UNSAFE_PATH`, not a generic persistence error. Existing content is never
overwritten. If the failure manifest also cannot be saved, the result instead
reports `PERSISTENCE` with `retentionUncertain: true`; inspect retained artifacts
before explicitly preparing another potentially billable attempt.

After inspecting only these disposable synthetic outputs:

```sh
rm -r -- "$WORK"
```

Never use that cleanup command on a real store. Contributor verification is
`python scripts/verify.py`; it runs scaffold checks and all eight configured
application suites. Live collection/model evaluation, Codespaces access and
independent human review are separate evidence, not implied by fixture success.
