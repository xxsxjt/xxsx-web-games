"""Bounded Godot 4.3 headless checks; never starts a desktop game window."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import stat
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
    "voyage_review", "voyage_review_app",
    "expedition_state", "expedition_store", "expedition_sim", "expedition_app",
    "tide_survey", "tide_survey_app",
    "damage_control", "damage_control_app",
    "energy_budget", "energy_feedback_app",
)
REQUIRED_CHECKS = ("import", *SCRIPT_SUITES, "smoke_tool")


def source_hashes(root):
    paths = [root / name for name in ("project.godot", "export_presets.cfg")]
    for folder, pattern in (("src", "*.gd"), ("scenes", "*.tscn"),
                            ("tests", "*.gd"), ("tools", "*.py"), ("tools", "*.gd")):
        paths.extend((root / folder).rglob(pattern))
    return {str(path.relative_to(root)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths)}


def isolated_environment(profile):
    """Give each headless run a new application-data and temporary root."""
    env = os.environ.copy()
    for key in ("APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "USERPROFILE",
                "HOME", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"):
        folder = profile / key
        folder.mkdir(parents=True, exist_ok=False)
        env[key] = str(folder)
    return env


def isolate_generated_resources(root):
    """Keep retained .gd evidence under build out of Godot's resource scanner."""
    folder = root / "build"
    folder.mkdir(parents=True, exist_ok=True)
    info = folder.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
        raise ValueError("Generated build directory must not be a link or reparse point")
    marker = folder / ".gdignore"
    if marker.exists():
        info = marker.lstat()
        if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
            raise ValueError("Generated resource marker must be a regular file")
        return marker
    try:
        with marker.open("xb"):
            pass
    except FileExistsError:
        info = marker.lstat()
        if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
            raise ValueError("Generated resource marker must be a regular file")
    return marker


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    isolate_generated_resources(root)
    sources = source_hashes(root)
    evidence = root / "build" / "qa" / dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    evidence.mkdir(parents=True, exist_ok=False)
    profile = evidence / "user-profile"
    env = isolated_environment(profile)
    engine_logs = evidence / "engine"
    engine_logs.mkdir()
    base = [str(args.godot), "--headless", "--audio-driver", "Dummy", "--path", str(root)]

    def engine_command(name, *args):
        return base + ["--log-file", str(engine_logs / f"{name}.log"), *args]

    version = subprocess.run(engine_command("version", "--version"), cwd=root, env=env,
                             capture_output=True, text=True, encoding="utf-8", timeout=15)
    if version.returncode or version.stdout.strip() != "4.3.stable.official.77dcf97d8":
        raise SystemExit("Expected official Godot 4.3 stable; received " + version.stdout.strip())
    jobs = [("import", engine_command("import", "--editor", "--quit"), True)]
    jobs += [(name, engine_command(name, "--script", f"res://tests/{name}_test.gd"), True)
             for name in SCRIPT_SUITES]
    jobs.append(("smoke_tool", [sys.executable, "-X", "utf8", "-m", "unittest",
                               "discover", "-s", "tools", "-p", "test_*.py", "-v"], False))
    results = []
    for name, command, godot_job in jobs:
        started = dt.datetime.now(dt.timezone.utc)
        try:
            proc = subprocess.run(command, cwd=root, env=env, capture_output=True,
                                  text=True, encoding="utf-8", errors="replace", timeout=120)
            output = proc.stdout + proc.stderr
            exit_code = proc.returncode
        except subprocess.TimeoutExpired as exc:
            output = "TIMEOUT after 120 seconds\n" + str(exc)
            exit_code = -1
        log = evidence / f"{name}.log"
        log.write_text(output, encoding="utf-8")
        engine_log = engine_logs / f"{name}.log" if godot_job else None
        engine_output = engine_log.read_text(encoding="utf-8", errors="replace") if engine_log and engine_log.is_file() else ""
        errors = set(re.findall(r"^.*(?:SCRIPT ERROR|ERROR:|WARNING:|FAIL[: ]|TIMEOUT).*?$", output + "\n" + engine_output, re.M))
        passed = exit_code == 0 and not errors and (engine_log is None or engine_log.is_file())
        result = {"check": name, "exit_code": exit_code, "passed": passed,
                   "started_utc": started.isoformat(), "diagnostic_count": len(errors),
                   "command": command, "log": str(log.relative_to(root)),
                   "engine_log": str(engine_log.relative_to(root)) if engine_log else None}
        results.append(result)
        print(f"{name}: {'PASS' if passed else 'FAIL'} exit={exit_code} diagnostics={len(errors)}", flush=True)
        for line in output.splitlines():
            if line.startswith(("APP ", "MODEL ", "Stormline ", "PASS ", "FAIL", "SCRIPT ERROR", "ERROR:", "WARNING:")):
                print(line, flush=True)
        if name == "import" and not passed:
            break
    score_files = sorted(path.relative_to(profile).as_posix() for path in profile.rglob("*best-contracts*")
                         if path.is_file())
    summary = {"engine": version.stdout.strip(), "headless_only": True,
               "isolated_user_profile": str(profile.relative_to(root)), "isolated_profile_score_files": score_files,
               "desktop_playtested": False, "checks": results,
               "source_hashes": sources, "sources_unchanged": sources == source_hashes(root),
               "passed": not score_files and len(results) == len(jobs) and all(item["passed"] for item in results)
                          and sources == source_hashes(root)}
    (evidence / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Evidence: {evidence}", flush=True)
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
