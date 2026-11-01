#!/usr/bin/env python3
"""Create the three Runyth release ZIPs from the checked-in Git repository.

Usage: python3 tools/build-release.py [output_directory]
Requires only Python 3.10+ and git. Does not perform a Git commit.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
MODULE = "runyth-cycle-token"
VERSION = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))["version"]
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "dist"
RUNTIME = ("CHANGELOG.md", "LICENSE", "README.md", "module.json", "scripts/runtime.mjs")
RUNTIME_DIRS = ("lang", "styles", "assets")
DOCS = ("CHANGELOG.md", "LICENSE", "README.md")
DOS_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


def entries(paths: tuple[str, ...], folders: tuple[str, ...] = ()) -> list[Path]:
  result = [ROOT / name for name in paths]
  for folder in folders:
    result.extend(path for path in (ROOT / folder).rglob("*") if path.is_file())
  return sorted(result, key=lambda path: path.relative_to(ROOT).as_posix())


def write_archive(name: str, files: list[Path], prefix: str) -> Path:
  OUTPUT.mkdir(parents=True, exist_ok=True)
  destination = OUTPUT / f"{MODULE}-{VERSION}-{name}.zip"
  with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
      label = f"{prefix}/{path.relative_to(ROOT).as_posix()}"
      info = ZipInfo(label, date_time=DOS_TIMESTAMP)
      info.compress_type = ZIP_DEFLATED
      info.external_attr = 0o644 << 16
      archive.writestr(info, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
  with ZipFile(destination) as archive:
    assert archive.testzip() is None, f"Invalid ZIP: {destination}"
  return destination


def main() -> None:
  subprocess.run([sys.executable, str(ROOT / "tools" / "build-runtime.py"), "--check"], check=True)
  subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--is-inside-work-tree"],
                 check=True, stdout=subprocess.DEVNULL)
  tag = subprocess.run(["git", "-C", str(ROOT), "tag", "-l", f"v{VERSION}"],
                       capture_output=True, text=True, check=True).stdout.strip()
  if tag != f"v{VERSION}":
    raise SystemExit(f"Missing release tag v{VERSION}; commit and tag before packaging.")
  head = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                        capture_output=True, text=True, check=True).stdout.strip()
  tagged = subprocess.run(["git", "-C", str(ROOT), "rev-list", "-n", "1", f"v{VERSION}"],
                          capture_output=True, text=True, check=True).stdout.strip()
  if head != tagged:
    raise SystemExit(f"Release tag v{VERSION} does not point to the current commit.")
  dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain"],
                         capture_output=True, text=True, check=True).stdout.strip()
  if dirty:
    raise SystemExit("Working tree is dirty; commit all release changes first.")
  source = sorted((path for path in ROOT.rglob("*")
                   if path.is_file() and not any(part in {"dist", "node_modules", "coverage"}
                                                 for part in path.relative_to(ROOT).parts)),
                  key=lambda path: path.relative_to(ROOT).as_posix())
  archives = [
    write_archive("module", entries(RUNTIME, RUNTIME_DIRS), MODULE),
    write_archive("source", source, MODULE),
    write_archive("documentation", entries(DOCS, ("docs",)), f"{MODULE}-documentation"),
  ]
  # Verify the *actual* distributable: every declared ES module must be inside
  # its ZIP, and each entry must be self-contained (no browser module imports).
  with ZipFile(archives[0]) as packaged:
    manifest = json.loads(packaged.read(f"{MODULE}/module.json"))
    if manifest["version"] != VERSION:
      raise SystemExit("Release manifest version mismatch.")
    for entry in manifest["esmodules"]:
      bundled = packaged.read(f"{MODULE}/{entry}").decode("utf-8")
      if any(line.lstrip().startswith(("import ", "export ")) for line in bundled.splitlines()):
        raise SystemExit(f"Distributable {entry} contains an external module dependency.")
      if "import(" in bundled:
        raise SystemExit(f"Distributable {entry} contains dynamic imports.")
    if any(name.endswith("/window.mjs") for name in packaged.namelist()):
      raise SystemExit("The distributable unexpectedly contains the old split UI module.")
  for archive in archives:
    print(f"{archive.name}: {archive.stat().st_size:,} bytes")


if __name__ == "__main__":
  main()
