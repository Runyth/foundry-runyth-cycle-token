// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { migrateAdvancedMenuPreference, readSettings, registerSettings } from "../scripts/settings.mjs";

const definitions = new Map();
let user = "player1";
const users = new Map();
const world = new Map();
const client = new Map();
const initial = (name, scope, defaultValue) => {
  const target = scope === "world" ? world : scope === "client" ? client : users.get(user);
  if (!target.has(name)) target.set(name, defaultValue);
};
users.set("player1", new Map());
users.set("player2", new Map());
globalThis.game = {
  modules: new Map(),
  settings: {
    register(namespace, key, definition) {
      definitions.set(key, definition);
      initial(key, definition.scope, definition.default);
    },
    registerMenu() {},
    get(namespace, key) {
      const definition = definitions.get(key);
      const target = definition.scope === "world" ? world : definition.scope === "client" ? client : users.get(user);
      return target.get(key) ?? definition.default;
    },
    async set(namespace, key, value) {
      const definition = definitions.get(key);
      const target = definition.scope === "world" ? world : definition.scope === "client" ? client : users.get(user);
      target.set(key, value);
      return value;
    },
  },
};
registerSettings();

test("advanced view is editable by individual users while old world control is hidden", () => {
  assert.equal(definitions.get("advancedMenu").scope, "world");
  assert.equal(definitions.get("advancedMenu").config, false);
  assert.equal(definitions.get("advancedMenuUser").scope, "user");
  assert.equal(definitions.get("advancedMenuUser").config, true);
  assert.equal(definitions.get("advancedMenuUser").default, false);
});

test("new users begin in minimal mode and can independently enable advanced mode", async () => {
  user = "player1";
  assert.equal(readSettings().advancedMenu, false);
  await game.settings.set("runyth-cycle-token", "advancedMenuUser", true);
  assert.equal(readSettings().advancedMenu, true);
  user = "player2";
  assert.equal(readSettings().advancedMenu, false);
});

test("one-time legacy world preference migration never overwrites later personal changes", async () => {
  world.set("advancedMenu", true);
  user = "player1";
  users.get(user).set("advancedMenuMigrated", false);
  assert.equal(await migrateAdvancedMenuPreference(), true);
  assert.equal(readSettings().advancedMenu, true);
  assert.equal(users.get(user).get("advancedMenuMigrated"), true);
  await game.settings.set("runyth-cycle-token", "advancedMenuUser", false);
  assert.equal(await migrateAdvancedMenuPreference(), false);
  assert.equal(readSettings().advancedMenu, false);
  user = "player2";
  assert.equal(await migrateAdvancedMenuPreference(), true);
  assert.equal(readSettings().advancedMenu, true);
  await game.settings.set("runyth-cycle-token", "advancedMenuUser", false);
  assert.equal(readSettings().advancedMenu, false);
  user = "player1";
  assert.equal(readSettings().advancedMenu, false);
});

test("an already configured player choice is not overwritten by first-time migration", async () => {
  user = "player1";
  users.get(user).set("advancedMenuMigrated", false);
  users.get(user).set("advancedMenuUser", true);
  world.set("advancedMenu", false);
  await migrateAdvancedMenuPreference();
  assert.equal(readSettings().advancedMenu, true);
});
