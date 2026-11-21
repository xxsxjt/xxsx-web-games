"""Pure-Python tests for the non-executable PCK probe runner."""

import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


import smoke_export as SMOKE

PROJECT_ROOT = Path(SMOKE.__file__).resolve().parents[1]


class SmokeExportTests(unittest.TestCase):
    def test_output_decoder_handles_text_and_bytes(self):
        self.assertEqual(SMOKE.decode_output("ok"), "ok")
        self.assertEqual(SMOKE.decode_output(b"ok"), "ok")
        self.assertEqual(SMOKE.decode_output(None), "")

    def test_runner_preflights_pck_before_any_process(self):
        with tempfile.TemporaryDirectory() as directory, patch("sys.argv", [
                "smoke_export.py", "--godot", "missing-godot.exe", "--pck", str(Path(directory) / "missing.pck"),
                "--sandbox-dir", str(Path(directory) / "sandbox")]), patch.object(
                    SMOKE.subprocess, "run", side_effect=AssertionError("process must not start")):
            with self.assertRaises(SystemExit):
                SMOKE.main()

    def test_runner_rejects_scratch_inside_source_tree_before_process(self):
        with tempfile.TemporaryDirectory(dir=PROJECT_ROOT) as directory:
            root = Path(directory) / "source"
            root.mkdir()
            pck = root / "candidate.pck"
            pck.write_bytes(b"not parsed before root guard")
            with patch("sys.argv", ["smoke_export.py", "--godot", "missing-godot.exe",
                                    "--pck", str(pck), "--sandbox-dir", str(root / "build" / "evidence")]), \
                    patch.object(SMOKE.subprocess, "run", side_effect=AssertionError("must not start")):
                with self.assertRaisesRegex(SystemExit, "outside the source project tree"):
                    SMOKE.main()

    def test_only_headless_probe_is_launched_with_isolated_profile(self):
        # The regression runner intentionally places TEMP inside source/build.
        # Use an isolated sibling so the real source-tree guard stays enabled.
        with tempfile.TemporaryDirectory(prefix="stormline-probe-test-", dir=PROJECT_ROOT.parent) as directory:
            root = Path(directory)
            release = root / "release"
            release.mkdir()
            pack = release / "Stormline-Black-Tide.pck"
            pack.write_bytes(b"fixture")
            scratch = root / "scratch"
            required = ["res://src/main.gd", "res://src/voyage_review.gd"]
            loaded = required.copy()

            def run(command, **options):
                self.assertEqual(command[0], "Godot.exe")
                self.assertEqual(command[1:5], ["--headless", "--audio-driver", "Dummy", "--path"])
                self.assertEqual(command[6], "--log-file")
                self.assertTrue(Path(command[7]).is_relative_to(scratch))
                self.assertTrue(Path(options["env"]["APPDATA"]).is_relative_to(scratch))
                self.assertNotIn("run/main_scene", (Path(command[5]) / "project.godot").read_text(encoding="utf-8"))
                if command[8:] == ["--version"]:
                    return subprocess.CompletedProcess(command, 0, SMOKE.ENGINE_VERSION, "")
                self.assertEqual(command[8:11], ["--script", "res://package_probe.gd", "--"])
                self.assertEqual(Path(command[11]), pack.resolve())
                Path(command[7]).touch()
                Path(command[12]).write_text(json.dumps({
                    "passed": True, "pack_mounted": True, "main_scene_loaded": True,
                    "main_scene_instantiated": False, "contract_ids_valid": True, "loaded_scripts": loaded,
                }), encoding="utf-8")
                return subprocess.CompletedProcess(command, 0, "", "")

            with patch("sys.argv", ["smoke_export.py", "--godot", "Godot.exe", "--pck", str(pack),
                                    "--sandbox-dir", str(scratch)]), patch.object(
                                         SMOKE, "check_pck", return_value={"entry_count": 20,
                                             "resolved_runtime_resources": dict.fromkeys(required, "fixture")}), patch.object(
                                         SMOKE.subprocess, "run", side_effect=run) as process, patch("builtins.print"):
                self.assertEqual(SMOKE.main(), 0)
                self.assertEqual(process.call_count, 2)
                loaded.remove("res://src/voyage_review.gd")
                self.assertEqual(SMOKE.main(), 1, "a stale probe without the review script must fail")
                self.assertEqual(process.call_count, 4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
