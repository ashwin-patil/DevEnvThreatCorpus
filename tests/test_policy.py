from __future__ import annotations

import copy
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

from scripts.pr_policy import evaluate
from scripts.verify import CONFIG_PATH, ROOT, VerificationError, load_json


def base_config() -> dict:
    return copy.deepcopy(load_json(CONFIG_PATH))


def make_payload() -> dict:
    snapshot = {
        "number": 42,
        "state": "open",
        "base_sha": "base-123",
        "base_ref": "main",
        "head_sha": "head-123",
        "originating_issue": {
            "number": 17,
            "state": "OPEN",
            "body": "Acceptance criteria: AC-01 and AC-02",
        },
        "files_complete": True,
        "files": [
            {"path": "CHANGELOG.md", "status": "modified", "previous_path": None},
            {"path": "README.md", "status": "modified", "previous_path": None},
            {"path": "tests/test_example.py", "status": "added", "previous_path": None},
        ],
    }
    return {"snapshot_before": copy.deepcopy(snapshot), "snapshot_after": copy.deepcopy(snapshot)}


class PolicyTests(unittest.TestCase):
    def test_workflows_separate_hosted_verification_from_metadata_policy(self) -> None:
        policy_text = (ROOT / ".github/workflows/pr-policy.yml").read_text(encoding="utf-8")
        policy = yaml.safe_load(policy_text)
        verify = yaml.safe_load(
            (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
        )
        self.assertIn("closingIssuesReferences(first: 2)", policy_text)
        self.assertIn("github.paginate(github.rest.pulls.listFiles", policy_text)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", policy_text)
        self.assertNotIn("pr.body", policy_text)
        self.assertNotIn("pulls.listReviews", policy_text)
        self.assertEqual(policy["permissions"], {
            "contents": "read", "issues": "read", "pull-requests": "read"
        })
        self.assertEqual(verify["permissions"], {"contents": "read"})
        self.assertIn("python scripts/verify.py", str(verify["jobs"]["verify"]))

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

    def test_valid_metadata_passes_without_pr_body_or_manual_evidence(self) -> None:
        result = evaluate(make_payload(), base_config())
        self.assertEqual(result, {"changed_paths": 3, "criteria": 2})

    def test_linked_issue_must_be_distinct_open_and_have_criteria(self) -> None:
        for issue, message in (
            (None, "exactly one linked"),
            ({"number": 42, "state": "OPEN", "body": "AC-01"}, "invalid or closed"),
            ({"number": 17, "state": "CLOSED", "body": "AC-01"}, "invalid or closed"),
            ({"number": 17, "state": "OPEN", "body": "No criteria"}, "stable acceptance"),
        ):
            with self.subTest(issue=issue):
                payload = make_payload()
                payload["snapshot_before"]["originating_issue"] = issue
                payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
                with self.assertRaisesRegex(VerificationError, message):
                    evaluate(payload, base_config())

    def test_stale_snapshot_and_new_commit_fail(self) -> None:
        for field, value in (("head_sha", "head-new"), ("base_sha", "base-new")):
            payload = make_payload()
            payload["snapshot_after"][field] = value
            with self.assertRaisesRegex(VerificationError, "stale PR event"):
                evaluate(payload, base_config())

        payload = make_payload()
        payload["snapshot_after"]["originating_issue"]["body"] = "AC-03"
        with self.assertRaisesRegex(VerificationError, "stale PR event"):
            evaluate(payload, base_config())

    def test_file_inventory_must_be_complete_valid_and_mapped(self) -> None:
        for mutation, message in (
            (lambda s: s.update(files_complete=False), "incomplete"),
            (lambda s: s.update(files=[]), "non-empty"),
            (lambda s: s["files"].append(copy.deepcopy(s["files"][0])), "duplicate file"),
            (lambda s: s["files"][0].update(path="../escape"), "unsafe"),
            (lambda s: s["files"][0].update(path="unmapped/file.xyz"), "no configured surface"),
            (lambda s: s["files"][0].update(previous_path="other"), "non-rename"),
            (lambda s: s["files"][0].update(status="renamed"), "previous path"),
        ):
            with self.subTest(message=message):
                payload = make_payload()
                mutation(payload["snapshot_before"])
                payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
                with self.assertRaisesRegex(VerificationError, message):
                    evaluate(payload, base_config())

    def test_rename_requires_valid_previous_path(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["files"][1] = {
            "path": "docs/readme.md", "status": "renamed", "previous_path": "README.md"
        }
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        self.assertEqual(evaluate(payload, base_config())["changed_paths"], 3)

    def test_learning_note_requires_same_pr_index_update(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["files"].append({
            "path": "docs/learnings/lesson.md", "status": "added", "previous_path": None
        })
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "learning index"):
            evaluate(payload, base_config())
        payload["snapshot_before"]["files"].append({
            "path": "docs/learnings/README.md", "status": "modified", "previous_path": None
        })
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        self.assertEqual(evaluate(payload, base_config())["changed_paths"], 5)

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
