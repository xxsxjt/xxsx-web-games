"""Pure-Python regression-runner isolation checks; never starts an engine."""
from pathlib import Path
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
