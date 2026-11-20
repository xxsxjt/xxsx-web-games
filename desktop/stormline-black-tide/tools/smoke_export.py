"""Load exported PCK resources with headless Godot; never launch the game EXE or scene."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

from build_windows import check_pck


ENGINE_VERSION = "4.3.stable.official.77dcf97d8"


def decode_output(value):
    return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else (value or "")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", required=True, type=Path)
    parser.add_argument("--pck", required=True, type=Path, help="Exported standalone Godot 4.3 PCK")
    parser.add_argument("--sandbox-dir", required=True, type=Path,
                        help="Explicit scratch root for an isolated probe project and user profile")
    parser.add_argument("--timeout", type=int, default=45, choices=range(5, 121))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        pck = args.pck.resolve(strict=True)
    except OSError as exc:
        raise SystemExit("PCK file is missing or unreadable") from exc
    if pck.suffix.lower() != ".pck":
        raise SystemExit("Expected a standalone PCK, not a game executable")
    sandbox = args.sandbox_dir.resolve()
    if sandbox == root or sandbox.is_relative_to(root):
        raise SystemExit("Keep the temporary probe project outside the source project tree")
    if sandbox == pck.parent or sandbox.is_relative_to(pck.parent):
        raise SystemExit("Keep probe evidence outside the release package directory")
    static = check_pck(pck, root)
    try:
        version = subprocess.run([str(args.godot), "--version"], capture_output=True,
                                 text=True, encoding="utf-8", timeout=15)
    except OSError as exc:
        raise SystemExit("Godot executable is missing or cannot start") from exc
    if version.returncode or version.stdout.strip() != ENGINE_VERSION:
        raise SystemExit("Expected official Godot 4.3 stable for the PCK probe")
    sandbox.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix="stormline-pck-probe-", dir=sandbox))
    project = run / "probe"
    project.mkdir()
    (project / "project.godot").write_text(
        'config_version=5\n[application]\nconfig/name="StormlinePackProbe"\n'
        'config/use_custom_user_dir=true\nconfig/custom_user_dir_name="StormlinePackProbe"\n'
        '[rendering]\nrenderer/rendering_method="gl_compatibility"\n', encoding="utf-8")
    shutil.copyfile(root / "tools" / "package_probe.gd", project / "package_probe.gd")
    env = os.environ.copy()
    for key in ("APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "USERPROFILE",
                "HOME", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"):
        folder = run / key
        folder.mkdir()
        env[key] = str(folder)

    probe_result = run / "probe-result.json"
    command = [str(args.godot), "--headless", "--audio-driver", "Dummy", "--path", str(project),
               "--script", "res://package_probe.gd", "--", str(pck), str(probe_result)]
    try:
        process = subprocess.run(command, cwd=project, env=env, capture_output=True,
                                 text=True, encoding="utf-8", errors="replace", timeout=args.timeout,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        output = process.stdout + process.stderr
        exit_code, timed_out = process.returncode, False
    except subprocess.TimeoutExpired as exc:
        output = decode_output(exc.stdout) + decode_output(exc.stderr)
        output += f"\nHeadless pack probe exceeded {args.timeout} seconds.\n"
        exit_code, timed_out = -1, True

    log = run / "stdout-stderr.log"
    log.write_text(output, encoding="utf-8")
    diagnostics = [line[:500] for line in output.splitlines()
                   if re.search(r"SCRIPT ERROR|ERROR:|WARNING:|\bFAIL\b", line, re.I)]
    probe = json.loads(probe_result.read_text(encoding="utf-8")) if probe_result.is_file() else {}
    score_writes = sorted(str(path.relative_to(run)).replace("\\", "/")
                          for path in run.rglob("*stormline-best-contracts*") if path.is_file())
    passed = (exit_code == 0 and not diagnostics and not timed_out and not score_writes
              and probe.get("passed") is True and probe.get("main_scene_instantiated") is False)
    result = {
        "tested_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "engine": ENGINE_VERSION,
        "pck_sha256": hashlib.sha256(pck.read_bytes()).hexdigest(),
        "static_entry_count": static["entry_count"], "static_checksums_passed": True,
        "exit_code": exit_code, "timed_out": timed_out, "passed": passed,
        "diagnostic_count": len(diagnostics), "diagnostics": diagnostics, "probe": probe,
        "isolated_user_profile": True, "best_score_files_created": score_writes,
        "exported_game_executed": False, "main_scene_instantiated": False,
        "rendering_tested": False, "audio_played": False, "interactive_or_manual_playtest": False,
        "evidence_log": str(log),
    }
    summary = run / "smoke.json"
    summary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "evidence_log"},
                     ensure_ascii=False, indent=2))
    print("Pack probe evidence: " + str(summary))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
