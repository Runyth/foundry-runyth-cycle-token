#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
"""Build an offline, self-contained Foundry ES module from local source modules.

No npm dependency or runtime network import is needed. The input grammar is
intentionally small and fails closed if new import/export syntax is introduced.
"""
from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
OUTPUT = SCRIPTS / "runtime.mjs"
IMPORT = re.compile(r'^import\s+\{\s*([^}]+?)\s*}\s+from\s+"(\./[a-z-]+\.mjs)";\s*$', re.MULTILINE)
EXPORT = re.compile(r'^(export\s+)((?:async\s+)?function|class|const)\s+([A-Za-z_$][\w$]*)\b', re.MULTILINE)


def build() -> str:
  parts: list[str] = []
  fingerprints: list[str] = []
  for path in sorted(SCRIPTS.glob("*.mjs")):
    if path == OUTPUT:
      continue
    source = path.read_text(encoding="utf-8")
    fingerprints.append(f"{path.name} {hashlib.sha256(source.encode()).hexdigest()}")
    dependencies = []

    def replace_import(match: re.Match[str]) -> str:
      specifiers, dependency = match.groups()
      if not (SCRIPTS / dependency).resolve().is_relative_to(SCRIPTS.resolve()):
        raise ValueError(f"Unexpected import path in {path.name}: {dependency}")
      if not (SCRIPTS / dependency).is_file():
        raise ValueError(f"Missing dependency in {path.name}: {dependency}")
      dependencies.append(dependency)
      return f'const {{{specifiers}}} = __require("{dependency}");'

    source = IMPORT.sub(replace_import, source)
    # Reject rather than silently generate a broken bundle when the source
    # starts using a syntax the deterministic compiler does not support.
    if re.search(r'\b(?:import|export)\s*(?:\(|{|\*|default|[A-Za-z_$])', source):
      # Exports are removed below; leave declaration-type exports for now.
      for line in source.splitlines():
        if line.lstrip().startswith("import "):
          raise ValueError(f"Unsupported import in {path.name}: {line}")
    names: list[str] = []

    def replace_export(match: re.Match[str]) -> str:
      _, declaration, name = match.groups()
      names.append(name)
      return f"{declaration} {name}"

    source = EXPORT.sub(replace_export, source)
    if re.search(r'^\s*(?:import|export)\s', source, re.MULTILINE):
      raise ValueError(f"Unsupported import/export declaration in {path.name}")
    if re.search(r'\bimport\s*\(', source):
      raise ValueError(f"Dynamic imports are not permitted in bundled runtime: {path.name}")
    if len(names) != len(set(names)):
      raise ValueError(f"Duplicate exports in {path.name}")
    export_code = "\n".join(f"  __exports.{name} = {name};" for name in names)
    parts.append(f'__factories["./{path.name}"] = (__require, __exports) => {{\n{source.rstrip()}\n{export_code}\n}};')

  fingerprint = hashlib.sha256("\n".join(fingerprints).encode()).hexdigest()
  return ("// SPDX-License-Identifier: AGPL-3.0-or-later\n"
          "// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.\n"
          "// GENERATED FILE. DO NOT EDIT. Run: python3 tools/build-runtime.py\n"
          "// Foundry loads this single module; there are no relative browser requests.\n"
          f"// Source fingerprint: {fingerprint}\n"
          "const __factories = Object.create(null);\n"
          "const __cache = Object.create(null);\n"
          "function __require(key) {\n"
          "  if (Object.hasOwn(__cache, key)) return __cache[key];\n"
          "  const factory = __factories[key];\n"
          "  if (!factory) throw new Error(`Missing bundled module: ${key}`);\n"
          "  const exports = Object.create(null);\n"
          "  __cache[key] = exports;\n"
          "  factory(__require, exports);\n"
          "  return exports;\n"
          "}\n\n" + "\n\n".join(parts) + '\n\n__require("./main.mjs");\n')


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true", help="Fail if the checked-in bundle is stale")
  args = parser.parse_args()
  expected = build()
  if args.check:
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
      raise SystemExit("Generated runtime is stale. Run python3 tools/build-runtime.py and commit.")
    print("Runtime bundle matches source inputs.")
  else:
    OUTPUT.write_text(expected, encoding="utf-8")
    print(f"Created {OUTPUT.relative_to(ROOT)} ({len(expected.encode()):,} bytes)")


if __name__ == "__main__":
  main()
