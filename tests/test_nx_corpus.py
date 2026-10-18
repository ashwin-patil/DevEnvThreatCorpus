from __future__ import annotations

import hashlib
import json
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def entity_digest(entities: list[dict]) -> str:
    encoded = json.dumps(entities, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


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
