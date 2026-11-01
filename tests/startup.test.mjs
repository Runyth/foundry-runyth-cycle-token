// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// A Foundry-shaped startup smoke test. It tests that the deployed single-file
// runtime can execute, register hooks/settings and display its token HUD button.
// This is not a substitute for testing a live Foundry browser session.
class FakeElement {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.title = "";
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelector(selector) {
    if (selector === ".col.right") return this.right ?? null;
    if (selector === ".right") return this.right ?? null;
    if (selector === ".runyth-cycle-token-hud") return this.right?.children.find(child => child.className.includes("runyth-cycle-token-hud")) ?? null;
    return null;
  }
}
class FakeApplicationV2 {
  static DEFAULT_OPTIONS = {};
}

globalThis.HTMLElement = FakeElement;
globalThis.document = {
  createElement: tag => new FakeElement(tag),
  querySelectorAll: () => [],
};
globalThis.foundry = { applications: { api: { ApplicationV2: FakeApplicationV2 } } };
const init = [];
const hooks = new Map();
globalThis.Hooks = {
  once: (name, callback) => { if (name === "init") init.push(callback); },
  on: (name, callback) => {
    const callbacks = hooks.get(name) ?? [];
    callbacks.push(callback);
    hooks.set(name, callbacks);
  },
};
const settings = new Map();
const definitions = new Map();
const module = { api: undefined };
globalThis.game = {
  i18n: { localize: key => key },
  user: { isGM: true },
  modules: new Map([["runyth-cycle-token", module]]),
  actors: new Map(),
  settings: {
    register(namespace, key, configuration) {
      definitions.set(key, configuration);
      settings.set(key, configuration.default);
    },
    registerMenu(namespace, key, configuration) { definitions.set(key, configuration); },
    get(namespace, key) { return settings.get(key); },
  },
};

test("distribution has a single, self-contained JavaScript entry point", async () => {
  const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.esmodules, ["scripts/runtime.mjs"]);
  const runtime = await readFile(new URL("../scripts/runtime.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(runtime, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(runtime, /\bimport\s*\(/);
  assert.match(runtime, /__require\("\.\/main\.mjs"\)/);
  assert.match(runtime, /CycleTokenWindow/);
});

test("single entry initializes settings, public API and token HUD without window.mjs network fetch", async () => {
  await import("../scripts/runtime.mjs");
  assert.equal(init.length, 1);
  init[0]();
  assert.ok(module.api);
  assert.equal(typeof module.api.openForToken, "function");
  assert.ok(definitions.has("enableHud"));
  assert.ok(definitions.has("resetWindowLayouts"));
  assert.ok(definitions.has("helpGuide"));
  assert.equal(definitions.get("advancedMenu").default, false);
  assert.equal(definitions.get("wildcardPolicy").default, "preserve");
  assert.equal(definitions.get("windowOpacity").scope, "user");
  assert.equal(definitions.get("windowOpacity").config, true);
  assert.equal(definitions.get("windowOpacity").default, 100);
  assert.deepEqual(definitions.get("windowOpacity").range, { min: 0, max: 100, step: 5 });
  assert.equal(definitions.get("advancedMenu").scope, "world");
  assert.equal(definitions.get("advancedMenu").config, false, "former world toggle is hidden after migration");
  assert.equal(definitions.get("advancedMenuUser").scope, "user");
  assert.equal(definitions.get("advancedMenuUser").config, true);
  assert.equal(definitions.get("advancedMenuUser").default, false);
  assert.equal(definitions.get("advancedMenuMigrated").scope, "user");
  assert.equal(definitions.get("hudIcon").default, "emoji-joker");
  assert.equal(definitions.get("regexSearch").default, false);
  assert.equal(definitions.get("regexSearch").scope, "client");
  assert.equal(definitions.get("showImageNames").default, false);
  const size = definitions.get("thumbnailSize");
  assert.equal(size.scope, "user", "per-player settings must not be tied to a browser or world-wide");
  assert.equal(size.config, false, "existing size remains persisted but the submenu shows the controls");
  assert.ok(definitions.has("thumbnailControls"));
  assert.equal(definitions.get("thumbnailControls").restricted, false);
  for (const key of ["thumbnailAdvanced", "thumbnailWidth", "thumbnailHeight"]) {
    assert.equal(definitions.get(key).scope, "user");
    assert.equal(definitions.get(key).config, false);
  }
  assert.equal(definitions.get("thumbnailAdvanced").default, false);
  assert.equal(size.default, 115);
  assert.deepEqual(size.range, { min: 85, max: 245, step: 10 });
  assert.equal(typeof size.onChange, "function");
  assert.ok(hooks.has("renderTokenHUD"));

  const actor = { id: "actor", testUserPermission: () => true };
  game.actors.set(actor.id, actor);
  const token = { document: { actorId: actor.id, testUserPermission: () => true } };
  const html = new FakeElement();
  html.right = new FakeElement();
  const onRender = hooks.get("renderTokenHUD");
  assert.equal(onRender.length, 1);
  // Simulate a third-party hook throwing. It must not prevent the independent
  // Runyth hook from attaching its button when Foundry dispatches subsequent hooks.
  const thirdParty = () => { throw new TypeError("html.find is not a function"); };
  for (const callback of [thirdParty, ...onRender]) {
    try { callback({ object: token }, html); } catch (error) { assert.match(error.message, /html\.find/); }
  }
  assert.equal(html.right.children.length, 1);
  assert.equal(html.right.children[0].title, "RCT.Ui.open");
  assert.equal(html.right.children[0].children[0].textContent, "🃏");
  onRender[0]({ object: token }, html);
  assert.equal(html.right.children.length, 1, "HUD button insertion must be idempotent");
});
