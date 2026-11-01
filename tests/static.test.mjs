// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Regression guard against Foundry v13 deprecated global APIs and V1 widgets.
test("runtime imports no deprecated global application or DOM APIs", async () => {
  const scripts = await readdir(join(root, "scripts"));
  for (const filename of scripts.filter(name => name.endsWith(".mjs"))) {
    const source = await readFile(join(root, "scripts", filename), "utf8");
    assert.doesNotMatch(source, /(?<![.\w])(?:FilePicker|renderTemplate|Application|Dialog|jQuery)\s*\(/,
      `${filename} references a legacy global constructor/function`);
    assert.doesNotMatch(source, /\$\s*\(/, `${filename} uses jQuery`);
    assert.doesNotMatch(source, /\.prototype\._(?:render|onRender)\b/, `${filename} monkey-patches a private UI method`);
  }
});

test("package, module manifest and both localization trees are consistent", async () => {
  const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
  const manifest = await read("module.json");
  const pkg = await read("package.json");
  assert.equal(manifest.id, "runyth-cycle-token");
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.compatibility.minimum, "13");
  const flatten = (value, prefix = "") => Object.entries(value).flatMap(([key, v]) =>
    typeof v === "string" ? [`${prefix}${key}`] : flatten(v, `${prefix}${key}.`));
  const en = flatten(await read("lang/en.json")).sort();
  const de = flatten(await read("lang/de.json")).sort();
  assert.deepEqual(de, en);
});

// A single-file runtime ensures failure to fetch a secondary window module
// cannot suppress module initialization before Hooks.once("init").
test("compiled runtime and module manifest agree with shipped entry", async () => {
  const manifest = JSON.parse(await readFile(join(root, "module.json"), "utf8"));
  assert.deepEqual(manifest.esmodules, ["scripts/runtime.mjs"]);
  const runtime = await readFile(join(root, manifest.esmodules[0]), "utf8");
  assert.match(runtime, /^\/\/ SPDX-License-Identifier: AGPL-3\.0-or-later\n\/\/ Copyright \(C\) 2026 Daniel Braniewski\. See the LICENSE file for rights and obligations\.\n\/\/ GENERATED FILE/);
  assert.doesNotMatch(runtime, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(runtime, /\bimport\s*\(/);
});
