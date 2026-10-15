from __future__ import annotations

import csv
import json
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = "a29de1822513b77d15b6fcf1c88dff147bf6140c"
PREFIX = "https://github.com/ashwin-patil/DevEnvThreatCorpus/"


class HandoffArchiveTests(unittest.TestCase):
    def setUp(self) -> None:
        with (ROOT / "docs/archive/handoff-inventory.tsv").open(encoding="utf-8", newline="") as stream:
            self.inventory = list(csv.DictReader(stream, delimiter="\t"))
        self.paths = {row["path"] for row in self.inventory}

    def test_inventory_covers_exact_authorized_removal_surface(self) -> None:
        config = json.loads((ROOT / "project.config.json").read_text(encoding="utf-8"))
        authorized = {p for p in config["paths"]["documentation"] if p.startswith("handoff/")}
        self.assertEqual(len(self.inventory), 45)
        self.assertEqual(len(self.paths), 45)
        self.assertEqual(self.paths, authorized)
        self.assertFalse((ROOT / "handoff").exists())
        for row in self.inventory:
            with self.subTest(path=row["path"]):
                self.assertEqual(row["mode"], "100644")
                self.assertRegex(row["blob"], r"^[0-9a-f]{40}$")
                self.assertRegex(row["sha256"], r"^[0-9a-f]{64}$")

    def test_handoff_navigation_is_pinned_and_in_archived_inventory(self) -> None:
        links = 0
        for document in [ROOT / "README.md", *(ROOT / "docs").rglob("*.md")]:
            text = document.read_text(encoding="utf-8")
            targets = re.findall(r"\]\(([^)\s]+)\)|(?:href|src)=[\"']([^\"']+)[\"']", text)
            for markdown, html in targets:
                target = markdown or html
                if "handoff/" not in target:
                    continue
                with self.subTest(document=document.relative_to(ROOT), target=target):
                    self.assertTrue(target.startswith(PREFIX), target)
                    parts = urlsplit(target).path.split("/")
                    self.assertIn(parts[3], ("blob", "tree"))
                    self.assertEqual(parts[4], ARCHIVE)
                    path = unquote("/".join(parts[5:])).rstrip("/")
                    if parts[3] == "blob":
                        self.assertIn(path, self.paths)
                    else:
                        self.assertTrue(any(p.startswith(path + "/") for p in self.paths))
                    links += 1
        self.assertGreater(links, 0)
