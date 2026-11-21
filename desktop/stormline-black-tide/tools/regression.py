"""Bounded Godot 4.3 headless checks; never starts a desktop game window."""

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


SCRIPT_SUITES = (
    "app", "journey", "records", "audio", "layout", "input", "docking", "robustness",
    "cargo_tow", "recovery", "recovery_app", "terminal_priority", "docking_lifecycle",
    "needle_recovery", "needle_lifecycle", "needle_keyboard", "needle_held_lifecycle",
    "interaction_feedback", "tow_risk_feedback", "towline_visual_feedback",
    "world_visibility_lifecycle",
    "presentation_lifecycle", "breakwater_journey", "cross_current_app",
    "cross_current_route_feedback",
    "rule_threshold_language",
)
REQUIRED_CHECKS = ("import", *SCRIPT_SUITES, "smoke_tool")


def source_hashes(root):
    paths = [root / name for name in ("project.godot", "export_presets.cfg")]
    for folder, pattern in (("src", "*.gd"), ("scenes", "*.tscn"),
                            ("tests", "*.gd"), ("tools", "*.py"), ("tools", "*.gd")):
        paths.extend((root / folder).rglob(pattern))
    return {str(path.relative_to(root)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    sources = source_hashes(root)
    version = subprocess.run([str(args.godot), "--version"], capture_output=True,
                             text=True, encoding="utf-8", timeout=15)
    if version.returncode or version.stdout.strip() != "4.3.stable.official.77dcf97d8":
        raise SystemExit("Expected official Godot 4.3 stable; received " + version.stdout.strip())
    evidence = root / "build" / "qa" / dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    evidence.mkdir(parents=True, exist_ok=False)
    base = [str(args.godot), "--headless", "--audio-driver", "Dummy", "--path", str(root)]
    jobs = [("import", base + ["--editor", "--quit"])]
    jobs += [(name, base + ["--script", f"res://tests/{name}_test.gd"]) for name in SCRIPT_SUITES]
    jobs.append(("smoke_tool", [sys.executable, "-X", "utf8", "-m", "unittest",
                                 "discover", "-s", "tools", "-p", "test_*.py", "-v"]))
    results = []
    for name, command in jobs:
        started = dt.datetime.now(dt.timezone.utc)
        try:
            proc = subprocess.run(command, cwd=root, capture_output=True,
                                  text=True, encoding="utf-8", errors="replace", timeout=120)
            output = proc.stdout + proc.stderr
            exit_code = proc.returncode
        except subprocess.TimeoutExpired as exc:
            output = "TIMEOUT after 120 seconds\n" + str(exc)
            exit_code = -1
        log = evidence / f"{name}.log"
        log.write_text(output, encoding="utf-8")
        errors = re.findall(r"^.*(?:SCRIPT ERROR|ERROR:|WARNING:|FAIL[: ]|TIMEOUT).*?$", output, re.M)
        passed = exit_code == 0 and not errors
        result = {"check": name, "exit_code": exit_code, "passed": passed,
                  "started_utc": started.isoformat(), "diagnostic_count": len(errors),
                  "log": str(log.relative_to(root))}
        results.append(result)
        print(f"{name}: {'PASS' if passed else 'FAIL'} exit={exit_code} diagnostics={len(errors)}", flush=True)
        for line in output.splitlines():
            if line.startswith(("APP ", "MODEL ", "Stormline ", "PASS ", "FAIL", "SCRIPT ERROR", "ERROR:", "WARNING:")):
                print(line, flush=True)
        if name == "import" and not passed:
            break
    summary = {"engine": version.stdout.strip(), "headless_only": True,
               "desktop_playtested": False, "checks": results,
               "source_hashes": sources, "sources_unchanged": sources == source_hashes(root),
               "passed": len(results) == len(jobs) and all(item["passed"] for item in results)
                         and sources == source_hashes(root)}
    (evidence / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Evidence: {evidence}", flush=True)
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
