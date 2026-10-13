from __future__ import annotations

import copy
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock, patch

import yaml

from scripts.verify import (
    CONFIG_PATH,
    PROJECT_COMMAND_TIMEOUT_SECONDS,
    ROOT,
    SCHEMA_PATH,
    VerificationError,
    _unique_object,
    load_json,
    run_project_commands,
    validate_config,
    validate_scaffold,
    validate_schema_contract,
    validate_yaml_tree,
    verification_mode_message,
)


class ConfigValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = copy.deepcopy(load_json(CONFIG_PATH))
        self.schema = load_json(SCHEMA_PATH)

    def test_default_config_and_schema_are_valid(self) -> None:
        validate_config(self.config, self.schema)
        validate_schema_contract(self.schema)

    def test_missing_extra_and_duplicate_fields_fail(self) -> None:
        broken = copy.deepcopy(self.config)
        del broken["recovery"]
        with self.assertRaisesRegex(VerificationError, "keys must be exactly"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["unexpected"] = True
        with self.assertRaisesRegex(VerificationError, "keys must be exactly"):
            validate_config(broken)
        with self.assertRaisesRegex(VerificationError, "duplicate JSON object key"):
            json.loads('{"schema_version":1,"schema_version":1}', object_pairs_hook=_unique_object)

    def test_advisory_model_contract_and_commands_are_explicit(self) -> None:
        broken = copy.deepcopy(self.config)
        broken["model_preference"]["status"] = "enforced"
        with self.assertRaisesRegex(VerificationError, "must be advisory"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["project_commands"] = ["pytest"]
        with self.assertRaisesRegex(VerificationError, "argument array"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["project_commands"] = [["python", "scripts/verify.py"]]
        with self.assertRaisesRegex(VerificationError, "recursively"):
            validate_config(broken)
        broken["project_commands"] = [["bash", "-c", "pytest"]]
        with self.assertRaisesRegex(VerificationError, "shell text"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["paths"]["learning_index"] = "../outside/README.md"
        with self.assertRaisesRegex(VerificationError, "learning_index"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["project_commands"] = [["", "pytest"]]
        with self.assertRaisesRegex(VerificationError, "non-empty"):
            validate_config(broken)

    def test_unsafe_duplicate_and_conflicting_paths_fail(self) -> None:
        for unsafe in ("../outside", "/root", "docs/../../outside", "docs/*"):
            broken = copy.deepcopy(self.config)
            broken["paths"]["documentation"] = [unsafe]
            with self.subTest(unsafe=unsafe), self.assertRaisesRegex(VerificationError, "unsafe path"):
                validate_config(broken)

        broken = copy.deepcopy(self.config)
        broken["paths"]["documentation"] = ["docs/**", "docs/**"]
        with self.assertRaisesRegex(VerificationError, "duplicate path"):
            validate_config(broken)

        broken = copy.deepcopy(self.config)
        broken["paths"]["governance"].append("docs/**")
        with self.assertRaisesRegex(VerificationError, "conflicting path pattern"):
            validate_config(broken)

    def test_recovery_bounds_and_schema_drift_fail(self) -> None:
        broken = copy.deepcopy(self.config)
        broken["recovery"]["manual_repair_attempts_before_escalation"] = -1
        with self.assertRaisesRegex(VerificationError, "integer from 0 through 10"):
            validate_config(broken)
        schema = copy.deepcopy(self.schema)
        schema["additionalProperties"] = True
        with self.assertRaisesRegex(VerificationError, "reject unknown"):
            validate_schema_contract(schema)
        schema = copy.deepcopy(self.schema)
        schema["properties"]["model_preference"]["properties"]["status"]["const"] = "enforced"
        with self.assertRaisesRegex(VerificationError, "keep model preference advisory"):
            validate_schema_contract(schema)

    def test_ac06_application_and_readme_mapping_configuration(self) -> None:
        for category in ("application", "readme_triggers"):
            self.assertIn("scripts/review.mjs", self.config["paths"][category])
        for category in ("application", "readme_triggers"):
            with self.subTest(category=category):
                broken = copy.deepcopy(self.config)
                del broken["paths"][category]
                with self.assertRaisesRegex(VerificationError, "paths must define exactly"):
                    validate_config(broken)
                for patterns, message in (
                    ("src/**", "must be an array"),
                    (["../src"], "unsafe path"),
                    (["src/**", "src/**"], "duplicate path"),
                ):
                    broken = copy.deepcopy(self.config)
                    broken["paths"][category] = patterns
                    with self.assertRaisesRegex(VerificationError, message):
                        validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["paths"]["application"] = []
        broken["paths"]["readme_triggers"] = []
        validate_config(broken, self.schema)
        broken = copy.deepcopy(self.config)
        broken["paths"]["governance"].append("scripts/**")
        with self.assertRaisesRegex(VerificationError, "must not overlap"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["paths"]["application"].append("docs/runtime/**")
        with self.assertRaisesRegex(VerificationError, "must not overlap"):
            validate_config(broken)
        broken = copy.deepcopy(self.config)
        broken["paths"]["readme_triggers"].append("unmapped/**")
        with self.assertRaisesRegex(VerificationError, "covered by implementation"):
            validate_config(broken)
        schema = copy.deepcopy(self.schema)
        del schema["properties"]["paths"]["properties"]["application"]
        with self.assertRaisesRegex(VerificationError, "fields do not match"):
            validate_schema_contract(schema)

    def test_ac01_flexible_issue_form_keeps_required_task_fields(self) -> None:
        form = yaml.safe_load((ROOT / ".github/ISSUE_TEMPLATE/implementation-task.yml").read_text())
        fields = {field["id"]: field for field in form["body"] if "id" in field}
        self.assertFalse(fields["parent-prd"]["validations"]["required"])
        context = fields["parent-prd"]["attributes"]["description"]
        self.assertIn("no separate PRD issue or file is required", context)
        for field in ("dependencies", "scope", "exclusions", "acceptance-criteria", "definition-of-done"):
            self.assertTrue(fields[field]["validations"]["required"], field)
        self.assertIn("AC-01", fields["acceptance-criteria"]["attributes"]["description"])

    def test_ac02_lifecycle_allows_standalone_requirements_and_human_launch(self) -> None:
        lifecycle = (ROOT / "docs/lifecycle.md").read_text()
        for text in ("directly in", "optional", "authorized human", "same PR", "human approval"):
            self.assertIn(text, lifecycle)
        self.assertNotIn("Each task has an originating PRD", lifecycle)
        validate_scaffold(self.config)

    def test_yaml_syntax_errors_are_reported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bad_workflow = root / ".github/workflows/bad.yml"
            bad_workflow.parent.mkdir(parents=True)
            bad_workflow.write_text("jobs: [unterminated\n", encoding="utf-8")
            with self.assertRaisesRegex(VerificationError, "invalid YAML"):
                validate_yaml_tree(root)


class CommandExecutionTests(unittest.TestCase):
    def test_commands_run_from_repo_root_without_shell(self) -> None:
        config = copy.deepcopy(load_json(CONFIG_PATH))
        config["project_commands"] = [[sys.executable, "-c", "print('ok')"]]
        runner = Mock(
            return_value=subprocess.CompletedProcess(
                args=config["project_commands"][0], returncode=0, stdout="ok\n"
            )
        )
        with patch.dict(
            os.environ,
            {
                "TEST_SECRET": "not-forwarded",
                "TEST_API_KEY": "not-forwarded",
                "AWS_ACCESS_KEY_ID": "not-forwarded",
                "SERVICE_AUTH": "not-forwarded",
                "DATABASE_URL": "not-forwarded",
            },
        ):
            with redirect_stdout(io.StringIO()):
                failures = run_project_commands(config, ROOT, runner=runner)
        self.assertEqual(failures, [])
        args, kwargs = runner.call_args
        self.assertEqual(args[0], config["project_commands"][0])
        self.assertEqual(kwargs["cwd"], ROOT)
        self.assertFalse(kwargs["shell"])
        self.assertEqual(kwargs["timeout"], 30 * 60)
        self.assertEqual(kwargs["timeout"], PROJECT_COMMAND_TIMEOUT_SECONDS)
        self.assertEqual(kwargs["env"]["AI_NATIVE_VERIFY_COMMAND_ACTIVE"], "1")
        self.assertNotIn("TEST_SECRET", kwargs["env"])
        for sensitive_name in ("TEST_API_KEY", "AWS_ACCESS_KEY_ID", "SERVICE_AUTH", "DATABASE_URL"):
            self.assertNotIn(sensitive_name, kwargs["env"])

    def test_scaffold_only_mode_never_claims_application_tests_passed(self) -> None:
        config = copy.deepcopy(load_json(CONFIG_PATH))
        config["project_commands"] = []
        message = verification_mode_message(config)
        self.assertEqual(
            message,
            "SCAFFOLD-ONLY: no project commands configured; application tests were not run.",
        )
        self.assertNotIn("application tests passed", message.lower())
        config["project_commands"] = [["pytest"]]
        self.assertTrue(verification_mode_message(config).startswith("APPLICATION-VERIFICATION:"))

    def test_real_failing_command_propagates_exit_status(self) -> None:
        config = copy.deepcopy(load_json(CONFIG_PATH))
        config["project_commands"] = [[sys.executable, "-c", "raise SystemExit(23)"]]
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(io.StringIO()):
            failures = run_project_commands(config, Path(directory))
        self.assertEqual(failures, ["project command 1 exited with status 23"])

    def test_command_working_directory_is_the_project_root(self) -> None:
        config = copy.deepcopy(load_json(CONFIG_PATH))
        config["project_commands"] = [[sys.executable, "-c", "import os; print(os.getcwd())"]]
        with tempfile.TemporaryDirectory() as directory:
            output = io.StringIO()
            with redirect_stdout(output):
                failures = run_project_commands(config, Path(directory))
        self.assertEqual(failures, [])
        self.assertIn(str(Path(directory)), output.getvalue())


class WorkflowValidationTests(unittest.TestCase):
    def test_current_workflows_and_scaffold_pass_verification(self) -> None:
        config = load_json(CONFIG_PATH)
        validate_scaffold(config)
        validate_yaml_tree(ROOT)
        workflow = yaml.load(
            (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8"),
            Loader=yaml.BaseLoader,
        )
        self.assertEqual(workflow["jobs"]["verify"]["timeout-minutes"], "30")

    def test_copilot_setup_workflow_enforces_exact_job_id_and_node_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workflows_dir = root / ".github/workflows"
            workflows_dir.mkdir(parents=True)
            for name in ("verify.yml", "pr-policy.yml", "copilot-setup-steps.yml"):
                (workflows_dir / name).write_text(
                    (ROOT / ".github/workflows" / name).read_text(encoding="utf-8"),
                    encoding="utf-8",
                )
            (root / ".github/ISSUE_TEMPLATE").mkdir(parents=True)
            (root / ".github/ISSUE_TEMPLATE/config.yml").write_text(
                "blank_issues_enabled: false\n", encoding="utf-8"
            )
            validate_yaml_tree(root)

            setup_content = (workflows_dir / "copilot-setup-steps.yml").read_text(encoding="utf-8")
            bad_job_workflow = setup_content.replace("copilot-setup-steps:", "setup:", 1)
            (workflows_dir / "copilot-setup-steps.yml").write_text(bad_job_workflow, encoding="utf-8")
            with self.assertRaisesRegex(VerificationError, "exact job ID copilot-setup-steps"):
                validate_yaml_tree(root)

            no_node_workflow = setup_content.replace(
                'node-version-file: "scripts/.node-version"',
                'node-version-file: "wrong/.node-version"',
            )
            (workflows_dir / "copilot-setup-steps.yml").write_text(no_node_workflow, encoding="utf-8")
            with self.assertRaisesRegex(VerificationError, "provision Node runtime"):
                validate_yaml_tree(root)


if __name__ == "__main__":
    unittest.main()
