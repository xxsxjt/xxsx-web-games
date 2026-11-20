"""Pure-Python tests for the non-executable PCK probe runner."""

import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


import smoke_export as SMOKE


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

    def test_only_headless_probe_is_launched_with_isolated_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            release = root / "release"
            release.mkdir()
            pack = release / "Stormline-Black-Tide.pck"
            pack.write_bytes(b"fixture")
            scratch = root / "scratch"

            def run(command, **options):
                self.assertEqual(command[0], "Godot.exe")
                if command[1:] == ["--version"]:
                    return subprocess.CompletedProcess(command, 0, SMOKE.ENGINE_VERSION, "")
                self.assertEqual(command[1:5], ["--headless", "--audio-driver", "Dummy", "--path"])
                self.assertEqual(command[6:9], ["--script", "res://package_probe.gd", "--"])
                self.assertEqual(Path(command[9]), pack.resolve())
                self.assertTrue(Path(options["env"]["APPDATA"]).is_relative_to(scratch))
                self.assertNotIn("run/main_scene", (Path(command[5]) / "project.godot").read_text(encoding="utf-8"))
                Path(command[10]).write_text(json.dumps({
                    "passed": True, "main_scene_instantiated": False,
                }), encoding="utf-8")
                return subprocess.CompletedProcess(command, 0, "", "")

            with patch("sys.argv", ["smoke_export.py", "--godot", "Godot.exe", "--pck", str(pack),
                                    "--sandbox-dir", str(scratch)]), patch.object(
                                        SMOKE, "check_pck", return_value={"entry_count": 18}), patch.object(
                                        SMOKE.subprocess, "run", side_effect=run) as process, patch("builtins.print"):
                self.assertEqual(SMOKE.main(), 0)
                self.assertEqual(process.call_count, 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
