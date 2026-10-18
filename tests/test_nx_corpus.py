from __future__ import annotations

import hashlib
import json
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def entity_digest(entities: list[dict] | dict) -> str:
    encoded = json.dumps(entities, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def canonical_digest(value: list[dict] | dict) -> str:
    return hashlib.sha256((json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode()).hexdigest()


class NxPublicExpansionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.document = json.loads((ROOT / "src/data/nx-draft.json").read_text(encoding="utf-8"))
        cls.rows = cls.document["records"]
        cls.entities = {
            kind: [row["entity"] for row in cls.rows if row["entityType"] == kind]
            for kind in {row["entityType"] for row in cls.rows}
        }

    def test_original_claims_passages_paths_and_mappings_are_preserved(self) -> None:
        self.assertEqual(canonical_digest(self.rows[:245]), "dfd85011f0209749b4999e76fd76d14638363309bbf253c3712d159965495da5")
        expected = {
            "claims": (38, "17c2190e95ed6bfcac413a2f64f07197fd88d65e2e83a25b01a6fc93fa0e6be4"),
            "passages": (43, "feaa4cd76404707538a0f1ee7c28a11df34e11a68dadad7bdb0ac2a0f52fd17f"),
            "paths": (3, "19c17469e2ac9f657f7578fa4d674a95f4c9ae92fd15c3688ac32e545a199fef"),
            "mappings": (2, "71bd09859437aeef82111a43361910110d4682407e1383aec3cd0aca5943cb30"),
        }
        for kind, (count, expected_hash) in expected.items():
            with self.subTest(kind=kind):
                originals = [
                    entity for entity in self.entities[kind]
                    if not entity["id"].startswith("nx-expansion-")
                ]
                self.assertEqual(len(originals), count)
                self.assertEqual(entity_digest(originals), expected_hash)

    def test_six_publisher_articles_share_one_pending_campaign(self) -> None:
        case = self.entities["cases"][0]
        articles = [source for source in self.entities["sources"] if source["id"] in case["sourceIds"]]
        self.assertEqual(len(articles), 6)
        self.assertEqual(
            {source["publisher"] for source in articles},
            {"Nx", "StepSecurity", "Wiz", "Socket", "Semgrep", "Panther"},
        )
        self.assertEqual(len(self.entities["cases"]), 1)
        self.assertEqual(set(case["sourceIds"]), {source["id"] for source in articles})
        self.assertEqual(case["disposition"], "Pending")
        self.assertEqual(
            next(source for source in articles if source["publisher"] == "StepSecurity")["id"],
            "source-a51036e953e037c63840945207be185e7cf43bdd22f70a8c8712959ae5f24bd3",
        )
        for source in articles:
            self.assertTrue(any(claim["sourceId"] == source["id"] for claim in self.entities["claims"]))

    def test_pending_categories_preserve_claim_scope_and_historical_catalogue(self) -> None:
        categories = [c for c in self.entities["categorizations"] if c["dimension"] != "telemetry_scope"]
        self.assertEqual(len(categories), 4)
        claims = {claim["id"]: claim for claim in self.entities["claims"]}
        sources = {source["id"]: source for source in self.entities["sources"]}
        self.assertEqual({category["value"] for category in categories}, {"Victim-side agent abuse"})
        self.assertEqual(
            {sources[category["sourceIds"][0]]["publisher"] for category in categories},
            {"Nx", "Wiz", "Semgrep", "Panther"},
        )
        for category in categories:
            claim = claims[category["supportingClaimIds"][0]]
            self.assertEqual(category["caseId"], claim["caseId"])
            self.assertEqual(category["sourceIds"], [claim["sourceId"]])
            self.assertEqual(category["origin"], "Deterministic rule")
            self.assertEqual(category["disposition"], "Pending")
            self.assertEqual(category["history"], [])
        self.assertEqual(set(self.document["categoryExtraction"]["categoryIds"]), {c["id"] for c in categories})
        self.assertEqual(self.document["categoryExtraction"]["version"], "campaign-category-rules/1")
        self.assertEqual(self.document["coverage"]["reviewCoverage"]["categorizations"]["pending"], 67)
        historical = self.document["catalogSnapshot"]
        self.assertEqual(
            hashlib.sha256(json.dumps(historical, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest(),
            "5ef2ab3578cdc919c4853641221083548c556a7aee909745cd3e9669313956c5",
        )
        active = next(c for c in self.document["availableCatalogSnapshot"]["catalogs"] if c["framework"] == "ATT&CK")
        old = next(c for c in historical["catalogs"] if c["framework"] == "ATT&CK")
        self.assertEqual(len(old["techniques"]), 1)
        self.assertEqual(len(active["techniques"]), 697)
        self.assertEqual(active["materialDigest"], old["materialDigest"])
        self.assertEqual(active["immutableRevision"], old["immutableRevision"])
        self.assertEqual(len(self.rows), 308)

    def test_telemetry_scope_is_pending_source_local_and_not_instrumentation(self) -> None:
        categories = [c for c in self.entities["categorizations"] if c["dimension"] == "telemetry_scope"]
        self.assertEqual(len(categories), 63)
        self.assertEqual(
            {c["value"] for c in categories},
            {"Endpoint telemetry", "CI/CD audit", "Source-control audit", "Network & DNS telemetry",
             "AI agent observability", "Package & build provenance"},
        )
        self.assertEqual(self.document["telemetryScopeExtraction"]["version"], "telemetry-scope-rules/1")
        self.assertEqual(set(self.document["telemetryScopeExtraction"]["categoryIds"]), {c["id"] for c in categories})
        claims = {c["id"]: c for c in self.entities["claims"]}
        for category in categories:
            claim = claims[category["supportingClaimIds"][0]]
            self.assertEqual(category["sourceIds"], [claim["sourceId"]])
            self.assertEqual(category["caseId"], claim["caseId"])
            self.assertEqual(category["disposition"], "Pending")
            self.assertEqual(category["history"], [])
            self.assertEqual(category["origin"], "Deterministic rule")
        for kind in ("telemetry", "detections", "otel"):
            self.assertFalse(self.entities.get(kind))

    def test_semgrep_response_is_nested_with_honest_context_and_distinct_full_artifact_support(self) -> None:
        prompts = self.document["prompts"]
        self.assertEqual(len(prompts), 4)
        self.assertEqual(len({p["literal"] for p in prompts}), 2)
        paired = [p for p in prompts if p.get("responses")]
        self.assertEqual(len(paired), 1)
        parent = paired[0]
        self.assertEqual(parent["id"], "nx-expansion-prompt-8abb1862b59fc30f4260c5b69a212b2b402bc93f500430db4fcfd512b66cd66a")
        response, = parent["responses"]
        self.assertEqual(response["outcome"], "refusal")
        self.assertEqual(response["observationContext"], "reported-log-review")
        self.assertEqual(response["role"], "unspecified")
        self.assertEqual(response["model"], "unknown")
        self.assertEqual(response["agent"], "Claude")
        self.assertEqual(response["encoding"], "json-string")
        self.assertEqual(response["support"]["locator"], {"start": 9178, "end": 9820})
        self.assertEqual(response["contextSupport"]["locator"], {"start": 8060, "end": 8155})
        raw = json.dumps(response["text"], ensure_ascii=False, separators=(",", ":"))
        self.assertEqual(len(raw), 642)
        self.assertEqual(hashlib.sha256(raw.encode()).hexdigest(), response["support"]["sha256"])
        self.assertEqual(hashlib.sha256(response["text"].encode()).hexdigest(),
                         "191c6163621b168aeb4a1e775bdf5da588475e1ed238304a016cb06136ea6650")
        claims = {c["id"]: c for c in self.entities["claims"]}
        for claim_id in response["claimIds"]:
            self.assertEqual(claims[claim_id]["sourceId"], parent["sourceId"])
            self.assertEqual(claims[claim_id]["sourceRevisionId"], parent["sourceRevisionId"])
        partial_passage = next(p for p in self.entities["passages"]
                               if p["id"] == "nx-expansion-passage-7b4eb48385063c99a01189f1b1e92dbe920b7955793ed3cbcf8dbed6703635af")
        self.assertEqual((partial_passage["start"], partial_passage["end"]), (9179, 9474))
        self.assertTrue(all(p["observationContext"] == "unknown" for p in prompts if p is not parent))
        artifacts = self.document["coverage"]["promptArtifacts"]
        self.assertEqual(artifacts["prompts"], prompts)
        self.assertEqual(artifacts["sourcesReviewed"], 6)
        self.assertEqual(artifacts["sourcesWithLiteralResponses"], ["Semgrep"])
        self.assertEqual(canonical_digest(artifacts), self.document["coverage"]["promptArtifactDigest"])

    def test_parsing_receipts_cover_full_text_without_upgrading_historical_failures(self) -> None:
        expansion = self.document["expansion"]
        self.assertEqual(expansion["schemaVersion"], "nx-public-expansion/1")
        self.assertEqual(len(expansion["parsedArticles"]), 6)
        revisions = {revision["id"]: revision for revision in self.entities["sourceRevisions"]}
        for receipt in expansion["parsedArticles"]:
            with self.subTest(source=receipt["sourceId"]):
                revision = revisions[receipt["sourceRevisionId"]]
                self.assertEqual(receipt["sourceId"], revision["sourceId"])
                self.assertEqual(receipt["normalizedHash"], revision["normalizedHash"])
                self.assertGreater(receipt["codePoints"], 0)
                self.assertEqual(receipt["parsedCodePoints"], receipt["codePoints"])
                self.assertRegex(receipt["fetchedRawHash"], r"^[a-f0-9]{64}$")
                self.assertRegex(receipt["robotsHash"], r"^[a-f0-9]{64}$")
        self.assertEqual(sum(row["reusedNormalizedRevision"] for row in expansion["parsedArticles"]), 4)
        failures = [row for row in self.document["sourceCoverage"] if row["status"] == "failed"]
        self.assertEqual(len(failures), 2)
        self.assertTrue(all(row["reason"] == "ROBOTS_UNSUPPORTED" and not row["revisions"] for row in failures))

    def test_new_claims_have_same_source_revision_and_bounded_passages(self) -> None:
        passages = {passage["id"]: passage for passage in self.entities["passages"]}
        revisions = {revision["id"]: revision for revision in self.entities["sourceRevisions"]}
        lengths = {
            revision["id"]: revision["codePoints"]
            for source in self.document["sourceCoverage"] for revision in source["revisions"]
        }
        new_ids = self.document["expansion"]["newClaimIds"]
        self.assertEqual(len(new_ids), len(set(new_ids)))
        new_claims = [claim for claim in self.entities["claims"] if claim["id"] in new_ids]
        self.assertEqual(len(new_claims), len(new_ids))
        self.assertGreater(len(new_claims), 0)
        self.assertEqual(len(self.entities["claims"]), 38 + len(new_claims))
        receipts = self.document["expansion"]["groundingReceipts"]
        self.assertEqual({row["claimId"] for row in receipts}, set(new_ids))
        self.assertGreaterEqual(len(receipts), len(new_ids))
        self.assertEqual(len(receipts), len({
            (row["claimId"], row["revisionId"], row["start"], row["end"]) for row in receipts
        }))
        for receipt in receipts:
            self.assertRegex(receipt["quoteHash"], r"^[a-f0-9]{64}$")
            claim = next(claim for claim in new_claims if claim["id"] == receipt["claimId"])
            self.assertEqual(receipt["sourceId"], claim["sourceId"])
            self.assertEqual(receipt["revisionId"], claim["sourceRevisionId"])
            self.assertEqual(receipt["normalizedHash"], revisions[claim["sourceRevisionId"]]["normalizedHash"])
            self.assertTrue(any(
                passages[passage_id]["start"] == receipt["start"]
                and passages[passage_id]["end"] == receipt["end"]
                for passage_id in claim["passageIds"]
            ))
        for claim in self.entities["claims"]:
            with self.subTest(claim=claim["id"]):
                self.assertEqual(claim["disposition"], "Pending")
                self.assertEqual(claim["history"], [])
                revision = revisions[claim["sourceRevisionId"]]
                self.assertEqual(revision["sourceId"], claim["sourceId"])
                self.assertTrue(claim["passageIds"])
                for passage_id in claim["passageIds"]:
                    passage = passages[passage_id]
                    self.assertEqual(passage["sourceRevisionId"], revision["id"])
                    self.assertGreaterEqual(passage["start"], 0)
                    self.assertGreater(passage["end"], passage["start"])
                    self.assertLessEqual(passage["end"], lengths[revision["id"]])
                    self.assertEqual(passage["locator"], f"code-points:{passage['start']}-{passage['end']}")

    def test_public_rows_withhold_bodies_quotes_attestations_and_acceptance(self) -> None:
        keys = [(row["entityType"], row["entity"]["id"]) for row in self.rows]
        self.assertEqual(len(keys), len(set(keys)))
        for row in self.rows:
            entity = row["entity"]
            with self.subTest(entity=entity["id"]):
                if row["entityType"] == "sourceRevisions":
                    self.assertIsNone(entity["rawContent"])
                    self.assertIsNone(entity["normalizedContent"])
                if row["entityType"] == "passages":
                    self.assertIsNone(entity["text"])
                    self.assertIsNone(entity["attestation"])
                self.assertNotEqual(entity.get("disposition"), "Accepted")
                self.assertFalse((row.get("reviewStatus") or {}).get("currentAcceptance", False))

    def test_targets_credentials_and_shutdown_remain_precise_and_conditional(self) -> None:
        claims = {claim["id"]: claim for claim in self.entities["claims"]}
        by_key = {
            receipt["key"]: claims[receipt["claimId"]]
            for receipt in self.document["expansion"]["groundingReceipts"]
        }
        for key in ("step-bounded-wallet-inventory-prompt", "semgrep-full-inventory-prompt"):
            claim = by_key[key]
            self.assertEqual(claim["evidenceStatus"], "Attempted behavior")
            for literal in (".env", "id_rsa", "keystore.json", "secrets.json", "*.keyfile", "IndexedDB"):
                self.assertIn(literal, claim["description"])
        for key in ("step-gh-token-role-upstream", "panther-upstream-token-escalation"):
            self.assertIn("GITHUB_TOKEN", by_key[key]["description"])
            self.assertIn("upstream", by_key[key]["uncertainty"].lower())
        for prefix in ("gho_", "ghp_"):
            self.assertIn(prefix, by_key["step-gh-prefix-filter"]["description"])
        self.assertIn(".npmrc", by_key["step-npm-whoami-gated-read"]["description"])
        for key in ("step-shutdown-startup-file-mutation", "semgrep-password-conditioned-shutdown"):
            claim = by_key[key]
            self.assertEqual(claim["evidenceStatus"], "Attempted behavior")
            for literal in (".bashrc", ".zshrc", "sudo shutdown -h 0"):
                self.assertIn(literal, claim["description"])
        self.assertIsNone(by_key["semgrep-explicit-claude-refusal"]["inference"])
        self.assertEqual(by_key["panther-visibility-rule-counterfactual"]["evidenceStatus"], "Potential consequence")

    def test_behavior_occurrences_keep_case_and_claim_support(self) -> None:
        claims = {claim["id"]: claim for claim in self.entities["claims"]}
        for behavior in self.entities["behaviors"]:
            with self.subTest(behavior=behavior["id"]):
                self.assertEqual(behavior["disposition"], "Pending")
                for claim_id in behavior["claimIds"]:
                    self.assertEqual(claims[claim_id]["caseId"], behavior["caseId"])
                for occurrence in behavior["occurrences"]:
                    self.assertEqual(occurrence["disposition"], "Pending")
                    self.assertTrue(set(occurrence["claimIds"]) <= set(behavior["claimIds"]))

    def test_zip_rows_manifest_and_coverage_match_display_projection(self) -> None:
        with zipfile.ZipFile(ROOT / "docs/data/nx-draft.zip") as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(
                set(archive.namelist()),
                {f"nx-draft/{name}" for name in (
                    "cases.csv", "manifest.json", "records.jsonl", "schema.json", "sources.csv", "timelines.csv"
                )},
            )
            rows = [
                json.loads(line)
                for line in archive.read("nx-draft/records.jsonl").decode("utf-8").splitlines()
            ]
            self.assertEqual(rows, self.rows)
            manifest = json.loads(archive.read("nx-draft/manifest.json"))
            self.assertEqual(manifest["snapshotDigest"], self.document["snapshotDigest"])
            self.assertEqual(manifest["coverage"], self.document["coverage"])
            for name, expected_hash in manifest["files"].items():
                self.assertEqual(hashlib.sha256(archive.read(f"nx-draft/{name}")).hexdigest(), expected_hash)
        counts = self.document["coverage"]["units"]
        for kind in ("cases", "sources", "claims"):
            self.assertEqual(counts[kind], len(self.entities[kind]))
        canonical = json.dumps(self.rows, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
        self.assertEqual(hashlib.sha256(canonical.encode()).hexdigest(), self.document["snapshotDigest"])
