from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.pr_policy import AUDIT_END, AUDIT_START, evaluate, parse_audit
from scripts.verify import CONFIG_PATH, ROOT, VerificationError, _unique_object, load_json, validate_config


def base_config() -> dict:
    return copy.deepcopy(load_json(CONFIG_PATH))


def audit_fixture() -> dict:
    return {
        "originating_issue": 17,
        "scope": {
            "included": ["Implement the documented bootstrap lifecycle"],
            "excluded": ["Runtime application or automatic dispatch"],
        },
        "changed_files": [
            {"path": "CHANGELOG.md", "status": "modified", "previous_path": None},
            {"path": "README.md", "status": "modified", "previous_path": None},
            {"path": "docs/lifecycle.md", "status": "modified", "previous_path": None},
            {"path": "tests/test_example.py", "status": "added", "previous_path": None},
        ],
        "acceptance_criteria": [
            {
                "id": "AC-01",
                "outcome": "pass",
                "evidence": "Repository metadata inspected and recorded.",
                "evidence_files": ["README.md"],
                "verification": "python scripts/verify.py verifies the recorded repository metadata.",
                "verification_kind": "automated",
                "reviewer_decision": None,
            },
            {
                "id": "AC-02",
                "outcome": "needs-human-review",
                "evidence": "Generic scope and excluded surfaces documented.",
                "evidence_files": ["README.md"],
                "verification": "Review content for template-neutrality.",
                "verification_kind": "human_review",
                "reviewer_decision": None,
            },
        ],
        "evidence": {
            "tested_revision": "head-123",
            "verification_commands": ["python scripts/verify.py"],
            "verification_results": [
                {
                    "command": "python scripts/verify.py",
                    "exit_status": 0,
                    "summary": "23 governance tests and scaffold contracts passed",
                }
            ],
            "hosted_check_urls": [],
        },
        "declarations": {
            "documentation": ["README.md", "docs/lifecycle.md"],
            "tests": ["tests/test_example.py"],
            "changelog": ["CHANGELOG.md"],
            "learnings": ["N/A — no reusable lesson"],
            "learning_index": ["N/A — no reusable lesson"],
            "human_review_required": True,
        },
        "proposed_squash_message": (
            "Add an auditable lifecycle scaffold\n\n"
            "Issue: #17\nAcceptance: AC-01 through AC-02\n"
            "Verification: python scripts/verify.py, exit status 0\n"
            "Limitations: human review remains required"
        ),
    }


def body_for_audit(audit: dict) -> str:
    return (
        "Closes #17\n\n"
        + AUDIT_START
        + "\n```json\n"
        + json.dumps(audit, indent=2)
        + "\n```\n"
        + AUDIT_END
    )


def make_payload(audit: dict | None = None) -> dict:
    audit = audit or audit_fixture()
    body = body_for_audit(audit)
    files = [
        {"path": item["path"], "status": item["status"], "previous_path": item["previous_path"]}
        for item in audit["changed_files"]
    ]
    snapshot = {
        "number": 42,
        "state": "open",
        "draft": True,
        "body": body,
        "base_sha": "base-123",
        "base_ref": "main",
        "head_sha": "head-123",
        "originating_issue": {
            "number": 17,
            "state": "open",
            "title": "Implement a fixture",
            "body": "Acceptance criteria: AC-01 and AC-02",
            "is_pull_request": False,
        },
        "files_complete": True,
        "files": files,
    }
    return {"snapshot_before": copy.deepcopy(snapshot), "snapshot_after": copy.deepcopy(snapshot)}


class PolicyTests(unittest.TestCase):
    def test_policy_cli_runs_from_repository_root(self) -> None:
        result = subprocess.run(
            [sys.executable, "scripts/pr_policy.py", "--help"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn("usage:", result.stdout.lower())

    def test_valid_audit_passes_and_still_requires_human_review(self) -> None:
        result = evaluate(make_payload(), base_config())
        self.assertEqual(result["changed_paths"], 4)
        self.assertEqual(result["criteria"], 2)
        self.assertTrue(result["human_review_required"])
        self.assertTrue(result["draft"])

    def test_criteria_and_issue_identity_must_match_live_issue(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["originating_issue"]["number"] = 18
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "does not match the live issue"):
            evaluate(payload, base_config())

        payload = make_payload()
        payload["snapshot_before"]["originating_issue"]["body"] = "Acceptance criterion AC-01 only"
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "IDs must exactly match"):
            evaluate(payload, base_config())

        payload = make_payload()
        payload["snapshot_before"]["originating_issue"]["is_pull_request"] = True
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "closed, is a pull request"):
            evaluate(payload, base_config())

    def test_audit_parser_rejects_missing_or_duplicate_markers(self) -> None:
        with self.assertRaisesRegex(VerificationError, "exactly one"):
            parse_audit("no markers")
        with self.assertRaisesRegex(VerificationError, "exactly one"):
            parse_audit(AUDIT_START + "```json\n{}\n```" + AUDIT_END + AUDIT_START)

    def test_audit_parser_rejects_placeholders_and_duplicate_json_keys(self) -> None:
        body = AUDIT_START + '\n```json\n{"value":"TODO"}\n```\n' + AUDIT_END
        with self.assertRaisesRegex(VerificationError, "placeholder"):
            parse_audit(body)
        with self.assertRaisesRegex(VerificationError, "duplicate JSON object key"):
            parse_audit(AUDIT_START + '\n```json\n{"a":1,"a":2}\n```\n' + AUDIT_END)
        with self.assertRaisesRegex(VerificationError, "duplicate JSON object key"):
            json.loads('{"a":1,"a":2}', object_pairs_hook=_unique_object)

    def test_duplicate_acceptance_ids_and_conflicting_file_declarations_fail(self) -> None:
        audit = audit_fixture()
        audit["acceptance_criteria"].append(copy.deepcopy(audit["acceptance_criteria"][0]))
        with self.assertRaisesRegex(VerificationError, "duplicate acceptance"):
            evaluate(make_payload(audit), base_config())

        audit = audit_fixture()
        audit["changed_files"].append(copy.deepcopy(audit["changed_files"][0]))
        with self.assertRaisesRegex(VerificationError, "duplicate file metadata"):
            evaluate(make_payload(audit), base_config())

    def test_changed_file_inventory_must_be_complete_and_exact(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["files"].pop()
        payload["snapshot_after"]["files"].pop()
        with self.assertRaisesRegex(VerificationError, "exactly match"):
            evaluate(payload, base_config())

        payload = make_payload()
        payload["snapshot_before"]["files_complete"] = False
        payload["snapshot_after"]["files_complete"] = False
        with self.assertRaisesRegex(VerificationError, "incomplete"):
            evaluate(payload, base_config())

    def test_renames_require_prior_path_and_exact_file_metadata(self) -> None:
        audit = audit_fixture()
        audit["changed_files"][1] = {
            "path": "docs/readme.md",
            "status": "renamed",
            "previous_path": None,
        }
        with self.assertRaisesRegex(VerificationError, "previous path"):
            evaluate(make_payload(audit), base_config())

        audit["changed_files"][1]["previous_path"] = "README.md"
        audit["declarations"]["documentation"].remove("README.md")
        audit["declarations"]["documentation"].append("docs/readme.md")
        payload = make_payload(audit)
        config = base_config()
        config["paths"]["documentation"].append("docs/readme.md")
        self.assertEqual(evaluate(payload, config)["changed_paths"], 4)

    def test_deletion_and_rename_inventories_must_match_metadata(self) -> None:
        audit = audit_fixture()
        audit["changed_files"][0]["status"] = "removed"
        payload = make_payload()
        payload["snapshot_before"]["body"] = body_for_audit(audit)
        payload["snapshot_after"]["body"] = payload["snapshot_before"]["body"]
        with self.assertRaisesRegex(VerificationError, "exactly match"):
            evaluate(payload, base_config())

        audit = audit_fixture()
        audit["changed_files"][1] = {
            "path": "README-new.md",
            "status": "renamed",
            "previous_path": "README.md",
        }
        payload = make_payload(audit)
        payload["snapshot_before"]["files"][1]["path"] = "README-new.md"
        payload["snapshot_before"]["files"][1]["status"] = "renamed"
        payload["snapshot_before"]["files"][1]["previous_path"] = "README.md"
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "no configured surface mapping"):
            evaluate(payload, base_config())

    def test_stale_snapshot_and_new_commit_invalidate_evidence(self) -> None:
        payload = make_payload()
        payload["snapshot_after"]["head_sha"] = "head-new"
        with self.assertRaisesRegex(VerificationError, "stale PR event"):
            evaluate(payload, base_config())

        payload = make_payload()
        payload["snapshot_before"]["head_sha"] = "head-new"
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "tested_revision"):
            evaluate(payload, base_config())

    def test_invalid_outcomes_and_missing_reviewer_decision_fail(self) -> None:
        audit = audit_fixture()
        audit["acceptance_criteria"][0]["outcome"] = "fail"
        with self.assertRaisesRegex(VerificationError, "marked fail"):
            evaluate(make_payload(audit), base_config())

        audit = audit_fixture()
        audit["acceptance_criteria"][1]["outcome"] = "pass"
        with self.assertRaisesRegex(VerificationError, "without a reviewer decision"):
            evaluate(make_payload(audit), base_config())

    def test_command_results_must_be_exact_successful_pairs(self) -> None:
        audit = audit_fixture()
        audit["evidence"]["verification_results"][0]["exit_status"] = 1
        with self.assertRaisesRegex(VerificationError, "did not pass"):
            evaluate(make_payload(audit), base_config())

        audit = audit_fixture()
        audit["evidence"]["verification_results"][0]["command"] = "pytest"
        with self.assertRaisesRegex(VerificationError, "map every exact command"):
            evaluate(make_payload(audit), base_config())

    def test_unmapped_surfaces_and_missing_category_declarations_fail(self) -> None:
        audit = audit_fixture()
        audit["changed_files"].append(
            {"path": "new-area/file.xyz", "status": "added", "previous_path": None}
        )
        with self.assertRaisesRegex(VerificationError, "no configured surface mapping"):
            evaluate(make_payload(audit), base_config())

        audit = audit_fixture()
        audit["declarations"]["tests"] = ["N/A — no tests"]
        with self.assertRaisesRegex(VerificationError, "does not exactly match changed mapped paths"):
            evaluate(make_payload(audit), base_config())

    def test_learning_note_requires_same_pr_index_update(self) -> None:
        audit = audit_fixture()
        note = {"path": "docs/learnings/lesson.md", "status": "added", "previous_path": None}
        index = {
            "path": "docs/learnings/README.md",
            "status": "modified",
            "previous_path": None,
        }
        audit["changed_files"].extend([note, index])
        audit["declarations"]["documentation"].extend([note["path"], index["path"]])
        audit["declarations"]["learnings"] = [note["path"], index["path"]]
        audit["declarations"]["learning_index"] = [index["path"]]
        payload = make_payload(audit)
        audit["declarations"]["learning_index"] = ["N/A — no index"]
        payload = make_payload(audit)
        with self.assertRaisesRegex(VerificationError, "must declare docs/learnings/README.md"):
            evaluate(payload, base_config())

        payload = make_payload(audit)
        audit["declarations"]["learning_index"] = [index["path"]]
        payload = make_payload(audit)
        result = evaluate(payload, base_config())
        self.assertEqual(result["changed_paths"], 6)

    def test_policy_does_not_execute_configured_project_commands(self) -> None:
        config = base_config()
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "must-not-exist"
            config["project_commands"] = [
                ["python", "-c", f"open({str(marker)!r}, 'w').write('ran')"]
            ]
            evaluate(make_payload(), config)
            self.assertFalse(marker.exists())

    def test_policy_rejects_malformed_project_configuration(self) -> None:
        config = base_config()
        config["project_commands"] = ["pytest"]
        with self.assertRaisesRegex(VerificationError, "argument array"):
            evaluate(make_payload(), config)


if __name__ == "__main__":
    unittest.main()
