"""Export and statically verify Windows x64; never execute the exported game."""

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import urllib.request
import zipfile

from regression import REQUIRED_CHECKS, source_hashes


VERSION = "0.1.3"
STEM = "Stormline-Black-Tide"
PACKAGE = f"{STEM}-v{VERSION}-windows-x64"
TEMPLATE_SHA256 = "66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13"
RELEASE = "https://github.com/godotengine/godot-builds/releases/download/4.3-stable/"
SOURCE = "https://raw.githubusercontent.com/godotengine/godot/4.3-stable/"


def digest(path, algorithm="sha256"):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def download_text(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Stormline-local-build/0.1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read(2_000_001)
    if len(payload) > 2_000_000:
        raise ValueError("Unexpected oversized text asset")
    return payload.decode("utf-8")


def check_pe(path):
    data = path.read_bytes()
    if data[:2] != b"MZ":
        raise ValueError("EXE missing DOS signature")
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe:pe + 4] != b"PE\0\0":
        raise ValueError("EXE missing PE signature")
    machine = struct.unpack_from("<H", data, pe + 4)[0]
    optional = pe + 24
    magic = struct.unpack_from("<H", data, optional)[0]
    subsystem = struct.unpack_from("<H", data, optional + 68)[0]
    if (machine, magic, subsystem) != (0x8664, 0x20B, 2):
        raise ValueError("Expected AMD64 PE32+ GUI executable")
    return {"machine": "AMD64 (0x8664)", "format": "PE32+", "subsystem": "Windows GUI"}


def check_pck(path, root):
    # Godot 4.3 core/io/file_access_pack.cpp: v2 unencrypted standalone pack.
    data = path.read_bytes()
    magic, version, major, minor, patch, flags = struct.unpack_from("<6I", data)
    if (magic, version, major, minor) != (0x43504447, 2, 4, 3) or flags & 1:
        raise ValueError("Unexpected or encrypted PCK header")
    base = struct.unpack_from("<Q", data, 24)[0]
    count = struct.unpack_from("<I", data, 96)[0]
    if count < 10 or count > 500:
        raise ValueError("Unexpected pack file count")
    cursor = 100
    entries = {}
    for _ in range(count):
        name_size = struct.unpack_from("<I", data, cursor)[0]
        cursor += 4
        if name_size > 4096:
            raise ValueError("Invalid PCK path length")
        name = data[cursor:cursor + name_size].rstrip(b"\0").decode("utf-8")
        cursor += name_size
        offset, size = struct.unpack_from("<QQ", data, cursor)
        stored_md5 = data[cursor + 16:cursor + 32]
        file_flags = struct.unpack_from("<I", data, cursor + 32)[0]
        cursor += 36
        start = base + offset
        if file_flags or start < 100 or start + size > len(data):
            raise ValueError("Invalid or encrypted pack entry: " + name)
        payload = data[start:start + size]
        if hashlib.md5(payload).digest() != stored_md5:
            raise ValueError("PCK content checksum mismatch: " + name)
        if not name.startswith("res://") or ".." in name.split("/") or name in entries:
            raise ValueError("Unsafe or duplicate PCK path: " + name)
        relative = name[6:]
        if relative.split("/")[0] in {"tests", "tools", "docs", "build", ".buildtools", ".testdata"}:
            raise ValueError("Development file leaked into pack: " + name)
        entries[name] = {"offset": start, "size": size, "sha256": hashlib.sha256(payload).hexdigest()}
    if base < cursor:
        raise ValueError("PCK data overlaps its directory")
    if "res://project.binary" not in entries:
        raise ValueError("Pack missing project settings")

    def resolve(resource):
        if resource in entries:
            return resource
        remap = entries.get(resource + ".remap")
        if remap is None:
            raise ValueError("Missing export resource/remap: " + resource)
        text = data[remap["offset"]:remap["offset"] + remap["size"]].decode("utf-8")
        match = re.search(r'path="([^"]+)"', text)
        if not match or match[1] not in entries:
            raise ValueError("Broken export remap: " + resource)
        return match[1]

    resolved = {}
    for source in sorted((root / "src").glob("*.gd")):
        name = "res://src/" + source.name
        resolved[name] = resolve(name)
    resolved["res://scenes/main.tscn"] = resolve("res://scenes/main.tscn")
    return {"format": version, "engine": [major, minor, patch], "entry_count": count,
            "all_entry_checksums_passed": True, "resolved_runtime_resources": resolved,
            "entries": entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", required=True, type=Path)
    parser.add_argument("--qa", required=True, type=Path, help="Passing regression summary.json")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if f'config/version="{VERSION}"' not in (root / "project.godot").read_text(encoding="utf-8"):
        raise SystemExit("Package version does not match project.godot")
    qa = json.loads(args.qa.read_text(encoding="utf-8"))
    if not qa.get("passed") or qa.get("source_hashes") != source_hashes(root):
        raise SystemExit("Regression is failed, stale, or does not match the current source tree")
    checks = qa.get("checks", [])
    if tuple(job.get("check") for job in checks) != REQUIRED_CHECKS or not all(
            job.get("passed") is True and job.get("exit_code") == 0 and job.get("diagnostic_count") == 0
            for job in checks):
        raise SystemExit("Required regression checks are missing or did not pass cleanly")
    version = subprocess.run([str(args.godot), "--version"], capture_output=True,
                             text=True, encoding="utf-8", timeout=15)
    if version.returncode or version.stdout.strip() != qa["engine"]:
        raise SystemExit("Build engine differs from regression engine")
    template = root / ".buildtools" / "windows_release_x86_64.exe"
    if template.stat().st_size != 84_214_784 or digest(template) != TEMPLATE_SHA256:
        raise SystemExit("Windows export template does not match the verified official template")
    archive = root / ".buildtools" / "Godot_v4.3-stable_export_templates.tpz"
    sums = download_text(RELEASE + "SHA512-SUMS.txt")
    expected = next((line.split()[0] for line in sums.splitlines()
                     if line.split() and line.split()[-1].lstrip("*") == archive.name), None)
    if expected is None or archive.stat().st_size != 1_073_228_327 or digest(archive, "sha512") != expected:
        raise SystemExit("Template archive SHA-512 does not match the official release checksums")
    with zipfile.ZipFile(archive) as pack:
        official_template = hashlib.sha256(pack.read("templates/windows_release_x86_64.exe")).hexdigest()
    if official_template != TEMPLATE_SHA256:
        raise SystemExit("Extracted Windows template differs from the verified archive")

    # Keep previous candidates intact. Each build gets a new, bounded directory.
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    build_root = root / "build" / "releases" / stamp
    output = build_root / PACKAGE
    output.mkdir(parents=True, exist_ok=False)
    legal = output / "licenses"
    legal.mkdir()
    for name in ("LICENSE.txt", "COPYRIGHT.txt", "AUTHORS.md"):
        text = download_text(SOURCE + name)
        (legal / ("GODOT_" + name)).write_text(text, encoding="utf-8")
    for source, target in (("docs/quickstart.md", "START-HERE.md"),
                           ("docs/manual-acceptance.md", "ACCEPTANCE.md")):
        shutil.copyfile(root / source, output / target)
    (build_root / "official-SHA512-SUMS.txt").write_text(sums, encoding="utf-8")
    exe = output / (STEM + ".exe")
    cmd = [str(args.godot), "--headless", "--audio-driver", "Dummy", "--path", str(root),
           "--export-release", "Windows x86_64", str(exe)]
    proc = subprocess.run(cmd, cwd=root, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=180)
    log = proc.stdout + proc.stderr
    (build_root / "export.log").write_text(log, encoding="utf-8")
    if proc.returncode or re.search(r"SCRIPT ERROR|ERROR:|WARNING:", log):
        raise SystemExit("Export failed or emitted diagnostics; inspect " + str(build_root / "export.log"))
    pe = check_pe(exe)
    if digest(exe) != TEMPLATE_SHA256:
        raise SystemExit("Unmodified release EXE differs from the verified export template")
    pck = check_pck(exe.with_suffix(".pck"), root)
    if qa["source_hashes"] != source_hashes(root):
        raise SystemExit("Source files changed during the build")
    manifest = {"product": "Stormline: Black Tide", "version": VERSION,
                "built_utc": dt.datetime.now(dt.timezone.utc).isoformat(), "engine": qa["engine"],
                "headless_regression": qa, "export_exit_code": proc.returncode,
                "pe": pe, "pck": pck, "template_sha256": TEMPLATE_SHA256,
                "template_archive_sha512": expected, "exported_game_executed": False,
                "desktop_playtested": False, "publicly_published": False,
                "files": {str(p.relative_to(output)).replace("\\", "/"):
                          {"bytes": p.stat().st_size, "sha256": digest(p)}
                          for p in sorted(output.rglob("*")) if p.is_file()}}
    (output / "BUILD-MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    hashes = [(digest(p), str(p.relative_to(output)).replace("\\", "/"))
              for p in sorted(output.rglob("*")) if p.is_file()]
    (output / "SHA256SUMS.txt").write_text("".join(f"{value}  {name}\n" for value, name in hashes), encoding="utf-8")
    zip_path = build_root / (PACKAGE + ".zip")
    with zipfile.ZipFile(zip_path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for path in sorted(output.rglob("*")):
            if path.is_file():
                bundle.write(path, PACKAGE + "/" + str(path.relative_to(output)).replace("\\", "/"))
    with zipfile.ZipFile(zip_path) as bundle:
        if bundle.testzip() is not None:
            raise SystemExit("ZIP integrity check failed")
        for path in output.rglob("*"):
            if path.is_file() and hashlib.sha256(bundle.read(PACKAGE + "/" + str(path.relative_to(output)).replace("\\", "/"))).hexdigest() != digest(path):
                raise SystemExit("ZIP roundtrip checksum mismatch")
    zip_hash = digest(zip_path)
    zip_path.with_suffix(".zip.sha256").write_text(f"{zip_hash}  {zip_path.name}\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "output": str(output), "archive": str(zip_path),
                      "zip_sha256": zip_hash, "exe_sha256": digest(exe),
                      "pck_sha256": digest(exe.with_suffix(".pck")), "pck_entries": pck["entry_count"],
                      "exported_game_executed": False}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
