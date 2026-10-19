# Public Nx snapshot archive

The exact public JSON/ZIP pair before `public-research-view/1` is preserved from
revision `040b2bfcd62091f9727cac319f83875ba384dea5`. These are public Pending artifacts,
not private retained articles, accepted research or a gold release.

| Snapshot | SHA-256 |
|---|---|
| `nx-draft-040b2bf.json` | `0d6fce2d8e22fb8d3f1566e096e02435a5165495b1bb612f2e7c5737c09f3904` |
| `nx-draft-040b2bf.zip` | `d232c8a999d2ae09b9c3f00ccb813c70a9e9fb630b49e327ea802edaaf74244f` |

To deliberately restore the data pair from the repository root in PowerShell:

```powershell
Copy-Item docs\data\archive\nx-draft-040b2bf.json src\data\nx-draft.json
Copy-Item docs\data\archive\nx-draft-040b2bf.zip docs\data\nx-draft.zip
```

Restore both files together and rerun `python scripts\verify.py` before publishing.
The current reader supports the legacy snapshot and derives its presentation when
the optional metadata is absent. Data restoration does not roll back UI code.
Current-format integrity tests intentionally require the new metadata, so a
deliberate rollback also needs an independently reviewed expectation change;
do not bypass or weaken checks to publish a mismatched pair.

Going forward, current JSON coverage and ZIP `manifest.json` coverage share
`researchPresentation` (`public-research-view/1`) and its canonical SHA-256
`researchPresentationDigest`. Generate that projection with `researchPresentation`
in `src/model.mjs`, after constructing a validated public model; do not hand-edit
its counts or relationship IDs. For changed canonical data, first omit stale
presentation fields when constructing the model, then regenerate the projection
and canonical digest and copy identical coverage into the ZIP manifest.
The reader rejects stale or unsupported projection content; offline integrity
checks verify the digest and JSON/ZIP parity. The typed-row snapshot digest stays
separate. All canonical records, exact prompt occurrences and nested responses
remain preserved; a paired reader default is not an export filter.
