# CLI reference

Run from the clone root using the [pinned Node runtime](../../scripts/.node-version).
Examples use an absolute `REPO` and private temporary files; no package install,
model credentials, live articles or application build is needed for offline work.
These recipes replace the historical README exercises while its anchors remain.
See [configuration](configuration.md) for server modes, permissions and bounds,
and [formats](formats-and-versioning.md) for input contracts.

## Command inventory

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
| `extract.mjs campaign validate` / `apply` | `--store --request --input` | Validate first, apply explicitly |
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
```

For actual extraction, inspect this private request, deliberately supply it to
your configured chat, save returned `campaign-candidate/1` JSON privately, then
validate and explicitly apply using the commands below. Optional record arrays
belong at candidate top level, not in the guide's `records` property.
Disclose requested/effective model separately; unavailable effective metadata
must remain null/unknown, not inferred from a preference.

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
Apply changes the non-review base even for this no-claim run. Real campaigns must
inspect completed/skipped/failed coverage, absences, exact evidence and limitations.
Protected campaign bundles can include normalized article text; never publish them.

Protected three-revision quality evaluation is separate: copy the authorized store,
freeze a permission-restricted baseline/hashes and an independent human-authored
gold checklist **before** exposing requests to a model. Never refetch unavailable
revisions or score candidate answers against themselves. Only authorized aggregate
counts/hashes/discrepancies may leave the private store. The offline recipe above
is not that evaluation or evidence of extraction quality.

## Manual claim review

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

After inspecting only these disposable synthetic outputs:

```sh
rm -r -- "$WORK"
```

Never use that cleanup command on a real store. Contributor verification is
`python scripts/verify.py`; it runs scaffold checks and all seven configured
application suites. Live collection/model evaluation, Codespaces access and
independent human review are separate evidence, not implied by fixture success.
