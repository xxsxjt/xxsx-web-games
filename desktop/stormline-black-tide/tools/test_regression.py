"""Pure-Python regression-runner isolation checks; never starts an engine."""
from pathlib import Path
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import regression as REGRESSION


class GeneratedResourceIsolationTests(unittest.TestCase):
    def test_fresh_project_ignores_generated_resource_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = REGRESSION.isolate_generated_resources(root)
            self.assertEqual(marker, root / "build/.gdignore")
            self.assertEqual(marker.read_bytes(), b"")

    def test_existing_evidence_and_marker_are_preserved_on_repeat(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            evidence = root / "build/sync/stage-29/compatibility_test.gd"
            evidence.parent.mkdir(parents=True)
            payload = b'extends SceneTree\r\nconst Old = preload("res://missing-oracle.gd")\r\n'
            evidence.write_bytes(payload)
            marker = root / "build/.gdignore"
            marker.write_bytes(b"# retained existing marker\r\n")
            for repeat in range(2):
                self.assertEqual(REGRESSION.isolate_generated_resources(root), marker)
                self.assertEqual(evidence.read_bytes(), payload)
                self.assertEqual(marker.read_bytes(), b"# retained existing marker\r\n")

    def test_directory_marker_fails_closed_without_touching_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "build/.gdignore"
            marker.mkdir(parents=True)
            item = marker / "keep.txt"
            item.write_bytes(b"keep")
            with self.assertRaisesRegex(ValueError, "regular file"):
                REGRESSION.isolate_generated_resources(root)
            self.assertEqual(item.read_bytes(), b"keep")


class UnexpectedPlayerFileScannerTests(unittest.TestCase):
    def test_detects_best_contract_and_expedition_artifact_families(self):
        artifacts = (
            "nested/best-contracts.json",
            "nested/stormline-expedition-v1.json",
            "nested/stormline-expedition-v1.json.bak",
            "nested/stormline-expedition-v1.json.tmp-abc123",
            "nested/stormline-expedition-v1.json.corrupt-deadbeef",
        )
        for artifact in artifacts:
            with self.subTest(artifact=artifact), tempfile.TemporaryDirectory() as directory:
                profile = Path(directory) / "user-profile"
                target = profile / artifact
                target.parent.mkdir(parents=True)
                target.write_text("fixture", encoding="utf-8")
                self.assertEqual(REGRESSION.scan_unexpected_player_files(profile), [artifact])

    def test_engine_cache_files_are_clean_and_outside_profile_is_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            profile = root / "user-profile"
            cache = profile / "LOCALAPPDATA" / "Godot" / "cache"
            cache.mkdir(parents=True)
            (cache / "shader_cache.bin").write_bytes(b"engine cache")
            outside = root / "unisolated" / "best-contracts.json"
            outside.parent.mkdir()
            outside.write_text("outside", encoding="utf-8")
            self.assertEqual(REGRESSION.scan_unexpected_player_files(profile), [])


class RegressionRunnerArtifactTests(unittest.TestCase):
    def test_mocked_runner_fails_for_each_artifact_and_preserves_score_evidence(self):
        artifacts = ("APPDATA/best-contracts.json", "stormline-expedition-v1.json",
                     "stormline-expedition-v1.json.bak", "stormline-expedition-v1.json.tmp-token",
                     "stormline-expedition-v1.json.corrupt-token")
        for artifact in artifacts:
            with self.subTest(artifact=artifact), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                tools = root / "tools"
                tools.mkdir()
                entry = tools / "regression.py"
                entry.write_text("", encoding="utf-8")

                def run(command, **_options):
                    if command[-1] == "--version":
                        return subprocess.CompletedProcess(command, 0,
                                                           "4.3.stable.official.77dcf97d8\n", "")
                    if "--log-file" in command:
                        log_file = Path(command[command.index("--log-file") + 1])
                        log_file.parent.mkdir(parents=True, exist_ok=True)
                        log_file.touch()
                        profile = next(root.glob("build/qa/*/user-profile"))
                        target = profile / artifact
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_text("fixture", encoding="utf-8")
                    return subprocess.CompletedProcess(command, 0, "", "")

                with patch.object(REGRESSION, "__file__", str(entry)), \
                        patch.object(REGRESSION, "SCRIPT_SUITES", ()), \
                        patch.object(REGRESSION, "source_hashes", return_value={}), \
                        patch.object(REGRESSION.subprocess, "run", side_effect=run), \
                        patch("sys.argv", ["regression.py", "--godot", "Godot.exe"]), \
                        patch("builtins.print"):
                    self.assertEqual(REGRESSION.main(), 1)
                summary_path = next(root.glob("build/qa/*/summary.json"))
                summary = json.loads(summary_path.read_text(encoding="utf-8"))
                self.assertEqual(len(summary["unexpected_player_files"]), 1)
                self.assertIn("isolated_profile_score_files", summary)

    def test_mocked_runner_accepts_clean_engine_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tools = root / "tools"
            tools.mkdir()
            entry = tools / "regression.py"
            entry.write_text("", encoding="utf-8")

            def run(command, **options):
                if command[-1] == "--version":
                    return subprocess.CompletedProcess(command, 0,
                                                       "4.3.stable.official.77dcf97d8\n", "")
                if "--log-file" in command:
                    log_file = Path(command[command.index("--log-file") + 1])
                    log_file.parent.mkdir(parents=True, exist_ok=True)
                    log_file.touch()
                    cache = Path(options["env"]["LOCALAPPDATA"]) / "Godot" / "cache"
                    cache.mkdir(parents=True, exist_ok=True)
                    (cache / "shader_cache.bin").write_bytes(b"cache")
                return subprocess.CompletedProcess(command, 0, "", "")

            with patch.object(REGRESSION, "__file__", str(entry)), \
                    patch.object(REGRESSION, "SCRIPT_SUITES", ()), \
                    patch.object(REGRESSION, "source_hashes", return_value={}), \
                    patch.object(REGRESSION.subprocess, "run", side_effect=run), \
                    patch("sys.argv", ["regression.py", "--godot", "Godot.exe"]), \
                    patch("builtins.print"):
                self.assertEqual(REGRESSION.main(), 0)
            summary_path = next(root.glob("build/qa/*/summary.json"))
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["unexpected_player_files"], [])
            self.assertIn("isolated_profile_score_files", summary)


if __name__ == "__main__":
    unittest.main(verbosity=2)
