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
            {"path": "CHANGELOG.md", "status": "modified", "previous_path": None, "patch": "@@ -1 +1 @@\n+ - Enforce documentation upkeep."},
            {"path": "README.md", "status": "modified", "previous_path": None, "patch": "@@ -1 +1 @@\n+Document changed setup and usage."},
            {"path": "tests/test_example.py", "status": "added", "previous_path": None, "patch": None},
        ],
    }
    return {"snapshot_before": copy.deepcopy(snapshot), "snapshot_after": copy.deepcopy(snapshot)}


def with_files(files: list[dict]) -> dict:
    payload = make_payload()
    payload["snapshot_before"]["files"] = files
    payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
    return payload


def changed(path: str, status: str = "modified", patch: str | None = "+Describe the change.") -> dict:
    return {"path": path, "status": status, "previous_path": None, "patch": patch}


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
        self.assertEqual(policy_text.count("patch: f.patch ?? null"), 2)
        self.assertNotIn("head.sha }}", policy_text)
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
            "path": "docs/readme.md", "status": "renamed", "previous_path": "README.md", "patch": None
        }
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        self.assertEqual(evaluate(payload, base_config())["changed_paths"], 3)

    def test_learning_note_requires_same_pr_index_update(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["files"].append({
            "path": "docs/learnings/lesson.md", "status": "added", "previous_path": None, "patch": "+Reusable lesson"
        })
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "learning index"):
            evaluate(payload, base_config())
        payload["snapshot_before"]["files"].append({
            "path": "docs/learnings/README.md", "status": "modified", "previous_path": None, "patch": "+[Reusable lesson](lesson.md)"
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

    def test_ac03_implementation_requires_docs_and_root_changelog(self) -> None:
        for implementation in ("scripts/contract.mjs", "scripts/pr_policy.py", "schemas/corpus.schema.json", ".github/workflows/verify.yml"):
            with self.subTest(path=implementation):
                with self.assertRaisesRegex(VerificationError, "documentation update"):
                    evaluate(with_files([changed(implementation), changed("CHANGELOG.md")]), base_config())
                with self.assertRaisesRegex(VerificationError, "root CHANGELOG.md"):
                    evaluate(with_files([changed(implementation), changed("README.md")]), base_config())
                result = evaluate(with_files([changed(implementation), changed("README.md"), changed("CHANGELOG.md")]), base_config())
                self.assertEqual(result["changed_paths"], 3)

    def test_ac03_substantive_metadata_floor_does_not_certify_quality(self) -> None:
        for patch in (None, "", "+\n+   ", "+## Release\n+---", "+<!-- ceremonial -->", "-Old entry"):
            with self.subTest(patch=patch), self.assertRaisesRegex(VerificationError, "root CHANGELOG.md"):
                evaluate(with_files([changed("scripts/pr_policy.py"), changed("docs/lifecycle.md"), changed("CHANGELOG.md", patch=patch)]), base_config())
        for item in (
            changed("CHANGELOG.md", status="removed"),
            changed("CHANGELOG.md", status="renamed", patch=None) | {"previous_path": "docs/old.md"},
            changed("docs/changelog.md"),
        ):
            with self.subTest(item=item), self.assertRaisesRegex(VerificationError, "root CHANGELOG.md"):
                evaluate(with_files([changed("scripts/pr_policy.py"), changed("docs/lifecycle.md"), item]), base_config())
        # Added prose passes the mechanical floor; only a human can judge its relevance.
        evaluate(with_files([changed("scripts/pr_policy.py"), changed("docs/lifecycle.md"), changed("CHANGELOG.md", patch="+Unrelated prose")]), base_config())

    def test_ac03_hidden_comment_edits_do_not_satisfy_upkeep(self) -> None:
        hidden_patches = (
            "@@ -1,3 +1,4 @@\n <!--\n+Hidden update\n -->",
            "@@ -10,2 +10,3 @@\n Context inside existing comment\n+Hidden update\n -->",
            "@@ -1,3 +1,4 @@\n <!--\n+Hidden update\n --!>",
            "@@ -10,2 +10,3 @@\n Context inside existing comment\n+Hidden update\n --!>",
            "+<!-- unfinished comment",
            "+<!--\n+Hidden update\n+-->",
        )
        for path, message in (("docs/lifecycle.md", "documentation update"), ("CHANGELOG.md", "root CHANGELOG.md"), ("README.md", "root README.md")):
            for patch in hidden_patches:
                files = [
                    changed("scripts/contract.mjs"), changed("docs/lifecycle.md"),
                    changed("CHANGELOG.md"), changed("README.md"),
                ]
                files = [item for item in files if item["path"] != path] + [changed(path, patch=patch)]
                if path == "docs/lifecycle.md":
                    files = [item for item in files if item["path"] != "README.md"]
                with self.subTest(path=path, patch=patch), self.assertRaisesRegex(VerificationError, message):
                    evaluate(with_files(files), base_config())
        for closure in ("-->", "--!>"):
            evaluate(with_files([
                changed("scripts/pr_policy.py"), changed("docs/lifecycle.md"),
                changed("CHANGELOG.md", patch=f" <!--\n+Hidden update\n {closure}\n+Visible release note"),
            ]), base_config())

    def test_ac03_documentation_only_and_test_only_maintenance_need_no_changelog(self) -> None:
        for path in ("docs/lifecycle.md", "README.md", "tests/test_policy.py", "CHANGELOG.md"):
            with self.subTest(path=path):
                evaluate(with_files([changed(path)]), base_config())
        for status in ("removed", "renamed"):
            doc = changed("docs/lifecycle.md", status=status, patch=None)
            if status == "renamed":
                doc["previous_path"] = "docs/old.md"
            with self.assertRaisesRegex(VerificationError, "documentation update"):
                evaluate(with_files([changed("scripts/pr_policy.py"), doc, changed("CHANGELOG.md")]), base_config())

    def test_ac03_learning_and_changelog_do_not_substitute_for_documentation(self) -> None:
        with self.assertRaisesRegex(VerificationError, "documentation update"):
            evaluate(with_files([
                changed("scripts/pr_policy.py"), changed("CHANGELOG.md"),
                changed("docs/learnings/lesson.md"), changed("docs/learnings/README.md"),
            ]), base_config())
        config = base_config()
        config["paths"]["changelog"].append("docs/releases.md")
        with self.assertRaisesRegex(VerificationError, "documentation update"):
            evaluate(with_files([
                changed("scripts/pr_policy.py"), changed("CHANGELOG.md"), changed("docs/releases.md"),
            ]), config)

    def test_ac04_readme_triggers_and_uncertain_relevance(self) -> None:
        for path in base_config()["paths"]["readme_triggers"]:
            with self.subTest(path=path), self.assertRaisesRegex(VerificationError, "root README.md"):
                evaluate(with_files([changed(path), changed("docs/lifecycle.md"), changed("CHANGELOG.md")]), base_config())
        for item in (
            changed("README.md", status="removed"),
            changed("docs/readme.md", status="renamed", patch=None) | {"previous_path": "README.md"},
            changed("README.md", patch="+# Heading only"),
        ):
            with self.subTest(item=item), self.assertRaisesRegex(VerificationError, "root README.md"):
                evaluate(with_files([changed("scripts/contract.mjs"), changed("docs/lifecycle.md"), changed("CHANGELOG.md"), item]), base_config())
        # Non-trigger implementation still needs a human to decide README relevance.
        evaluate(with_files([changed("scripts/pr_policy.py"), changed("docs/lifecycle.md"), changed("CHANGELOG.md")]), base_config())

    def test_ac05_learning_removal_and_rename_require_surviving_index_update(self) -> None:
        for note in (
            changed("docs/learnings/lesson.md", status="removed"),
            changed("docs/archived.md", status="renamed") | {"previous_path": "docs/learnings/lesson.md"},
        ):
            with self.subTest(note=note):
                with self.assertRaisesRegex(VerificationError, "learning index"):
                    evaluate(with_files([note]), base_config())
                with self.assertRaisesRegex(VerificationError, "learning index"):
                    evaluate(with_files([note, changed("docs/learnings/README.md", status="removed")]), base_config())
                evaluate(with_files([note, changed("docs/learnings/README.md", patch="-[Old lesson](lesson.md)")]), base_config())

    def test_ac06_rename_origins_and_deletions_trigger_upkeep(self) -> None:
        for item in (
            changed("docs/archived.md", status="renamed", patch=None) | {"previous_path": "scripts/contract.mjs"},
            changed("scripts/contract.mjs", status="removed"),
        ):
            with self.subTest(item=item):
                with self.assertRaisesRegex(VerificationError, "documentation update"):
                    evaluate(with_files([item]), base_config())
                with self.assertRaisesRegex(VerificationError, "root README.md"):
                    evaluate(with_files([item, changed("docs/lifecycle.md"), changed("CHANGELOG.md")]), base_config())
                evaluate(with_files([item, changed("README.md"), changed("CHANGELOG.md")]), base_config())
        item = changed("docs/new.md", status="renamed") | {"previous_path": "unmapped/old.py"}
        with self.assertRaisesRegex(VerificationError, "no configured surface"):
            evaluate(with_files([item]), base_config())

    def test_ac06_trusted_config_not_head_mapping_controls_new_application_paths(self) -> None:
        payload = with_files([changed("src/new.mjs"), changed("README.md"), changed("CHANGELOG.md")])
        with self.assertRaisesRegex(VerificationError, "no configured surface"):
            evaluate(payload, base_config())
        trusted = base_config()
        trusted["paths"]["application"].append("src/**")
        evaluate(payload, trusted)

    def test_patch_metadata_is_validated_and_revision_bound(self) -> None:
        payload = make_payload()
        payload["snapshot_before"]["files"][0]["patch"] = 123
        payload["snapshot_after"] = copy.deepcopy(payload["snapshot_before"])
        with self.assertRaisesRegex(VerificationError, "invalid patch"):
            evaluate(payload, base_config())
        payload = make_payload()
        payload["snapshot_after"]["files"][0]["patch"] = "+Different content"
        with self.assertRaisesRegex(VerificationError, "stale PR event"):
            evaluate(payload, base_config())

if __name__ == "__main__":
    unittest.main()
