// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { applyTokenImage, canEdit, cycleToken, listTokenImages, saveActorPattern, invalidateCatalog } from "../scripts/service.mjs";

const events = [];
let listing = ["art/a.png", "art/b.png", "art/c.png"];
let browseCalls = 0;
let browseOverride = null;
let nativeCalls = 0;
let nativeResult = null;
let nativeFailure = null;
const actors = new Map();
const scene = { id: "scene-1", tokens: new Map() };
// Foundry Collections iterate documents, unlike JavaScript Map key/value pairs.
scene.tokens[Symbol.iterator] = function* () { yield* this.values(); };
const user = { isGM: true, id: "gm" };
const SETTINGS = { owners: true, live: true, prototype: true, otherLive: false, wildcard: "selected", maxImages: 100 };
let worldSettings = { ...SETTINGS };
const SETTING_NAMES = { allowOwners: "owners", syncCurrent: "live", syncPrototype: "prototype", syncScene: "otherLive", wildcardPolicy: "wildcard", maxImages: "maxImages", enableHud: "hud" };

globalThis.game = {
  user, actors,
  settings: { get: (_module, key) => worldSettings[SETTING_NAMES[key]] },
  i18n: { localize: key => key },
};
globalThis.canvas = { scene };
globalThis.Hooks = { callAll: (...args) => events.push(args) };
globalThis.foundry = {
  applications: { apps: { FilePicker: { implementation: {
    requestTokenImages: async actorId => {
      nativeCalls++;
      assert.equal(actorId, "a1");
      if (nativeFailure) throw nativeFailure;
      return nativeResult;
    },
    browse: async (...args) => {
    browseCalls++;
    return browseOverride ? browseOverride(...args) : { files: listing };
  } } } } },
};

function makeActor(id = "a1", { wildcard = false, failPrototype = false } = {}) {
  const flags = {};
  const actor = {
    id, uuid: `Actor.${id}`, name: "Hero",
    prototypeToken: { texture: { src: wildcard ? "art/*.png" : "art/a.png" }, randomImg: wildcard },
    testUserPermission: () => true,
    getFlag: (_id, name) => flags[name],
    setFlag: async (_id, name, value) => { flags[name] = value; },
    unsetFlag: async (_id, name) => { delete flags[name]; },
    update: async changes => {
      if (failPrototype) throw new Error("prototype failure");
      if ("prototypeToken.texture.src" in changes) actor.prototypeToken.texture.src = changes["prototypeToken.texture.src"];
      if ("prototypeToken.randomImg" in changes) actor.prototypeToken.randomImg = changes["prototypeToken.randomImg"];
    },
  };
  actors.set(id, actor);
  return actor;
}

function makeToken(id = "t1", actorId = "a1", { fail = false, actorLink = true } = {}) {
  const doc = {
    id, actorId, actorLink, parent: scene, texture: { src: "art/a.png" },
    testUserPermission: () => true,
    update: async changes => {
      if (fail) throw new Error("token failure");
      await sleep(2);
      doc.texture.src = changes["texture.src"];
    },
  };
  scene.tokens.set(id, doc);
  return { document: doc, name: `Token ${id}` };
}

test.beforeEach(() => {
  actors.clear(); scene.tokens.clear();
  listing = ["art/a.png", "art/b.png", "art/c.png"];
  browseCalls = 0;
  browseOverride = null;
  nativeResult = null;
  nativeCalls = 0;
  nativeFailure = null;
  invalidateCatalog();
  events.length = 0;
  user.isGM = true;
  worldSettings = { ...SETTINGS };
});

test("changes live and prototype without changing Actor portrait", async () => {
  const actor = makeActor();
  actor.img = "portraits/hero.webp";
  const token = makeToken();
  const result = await applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false });
  assert.equal(token.document.texture.src, "art/b.png");
  assert.equal(actor.prototypeToken.texture.src, "art/b.png");
  assert.equal(actor.img, "portraits/hero.webp");
  assert.equal(result.updatedPrototype, true);
  assert.equal(result.updatedLive, 1);
  assert.equal(events.at(-1)[0], "runythCycleTokenImageChanged");
});

test("native wildcard preserved when configured; live token changes", async () => {
  const actor = makeActor("a1", { wildcard: true });
  const token = makeToken();
  await applyTokenImage(token, "art/b.png", { settings: { ...SETTINGS, wildcard: "preserve" }, validate: false });
  assert.equal(actor.prototypeToken.texture.src, "art/*.png");
  assert.equal(actor.prototypeToken.randomImg, true);
  assert.equal(token.document.texture.src, "art/b.png");
});

test("selected image replaces native prototype wildcard and turns randomization off", async () => {
  const actor = makeActor("a1", { wildcard: true });
  const token = makeToken();
  await applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false });
  assert.equal(actor.prototypeToken.texture.src, "art/b.png");
  assert.equal(actor.prototypeToken.randomImg, false);
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), "art/*.png");
});

test("rolls back prototype when live token update fails", async () => {
  const actor = makeActor();
  const token = makeToken("t1", "a1", { fail: true });
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false }), /token failure/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
  assert.equal(token.document.texture.src, "art/a.png");
  assert.equal(events.length, 0);
});


test("rollback clears preserved pattern when original native wildcard conversion fails", async () => {
  const actor = makeActor("a1", { wildcard: true });
  const token = makeToken("t1", "a1", { fail: true });
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false }), /token failure/);
  assert.equal(actor.prototypeToken.texture.src, "art/*.png");
  assert.equal(actor.prototypeToken.randomImg, true);
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), undefined);
});

test("prototype failure leaves live token untouched", async () => {
  const actor = makeActor("a1", { failPrototype: true });
  const token = makeToken();
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false }), /prototype failure/);
  assert.equal(token.document.texture.src, "art/a.png");
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
});

test("updates matching scene tokens only when enabled", async () => {
  makeActor();
  const first = makeToken("t1");
  const other = makeToken("t2");
  const notSame = makeToken("t3", "other");
  await applyTokenImage(first, "art/b.png", { settings: { ...SETTINGS, otherLive: true }, validate: false });
  assert.equal(other.document.texture.src, "art/b.png");
  assert.equal(notSame.document.texture.src, "art/a.png");
});

test("owner restrictions and no-target configurations deny safe mutations", async () => {
  const actor = makeActor();
  const token = makeToken();
  user.isGM = false;
  worldSettings.owners = false;
  assert.equal(canEdit(token, { settings: { ...SETTINGS, owners: true } }), false);
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: { ...SETTINGS, owners: true }, validate: false }), /noPermission/);
  await assert.rejects(saveActorPattern(actor, "art/*.png"), /noPermission/);
  user.isGM = true;
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: { ...SETTINGS, prototype: false, live: false }, validate: false }), /nothingEnabled/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
});

test("token disappeared after selection: refuse write", async () => {
  makeActor();
  const token = makeToken();
  scene.tokens.delete(token.document.id);
  await assert.rejects(applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false }), /staleToken/);
});

test("serializes overlapping cycles against current texture, not a stale snapshot", async () => {
  makeActor();
  const token = makeToken();
  await Promise.all(Array.from({ length: 3 }, () => cycleToken(token, 1, { settings: SETTINGS })));
  assert.equal(token.document.texture.src, "art/a.png");
});

test("concrete pattern does not invoke browser; wildcard browse returns supported image list", async () => {
  const actor = makeActor();
  const token = makeToken();
  await saveActorPattern(actor, "art/b.png");
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS }), ["art/b.png"]);
  assert.equal(browseCalls, 0);
  await saveActorPattern(actor, "art/*.png");
  listing = ["art/b.png", "art/readme.txt", "art/a.png"];
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS, refresh: true }), ["art/a.png", "art/b.png"]);
});


test("player cannot bypass world target policy with public API settings", async () => {
  const actor = makeActor();
  const token = makeToken();
  user.isGM = false;
  worldSettings.live = false;
  worldSettings.prototype = false;
  await assert.rejects(applyTokenImage(token, "art/b.png", {
    settings: { ...SETTINGS, live: true, prototype: true }, validate: false,
  }), /nothingEnabled/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
  assert.equal(token.document.texture.src, "art/a.png");
});

test("player cannot bypass owner prohibition on gallery enumeration", async () => {
  makeActor();
  const token = makeToken();
  user.isGM = false;
  worldSettings.owners = false;
  await assert.rejects(listTokenImages(token, { settings: { ...SETTINGS, owners: true } }), /noPermission/);
  assert.equal(browseCalls, 0);
});

test("actor pattern saves serialize with ongoing image changes", async () => {
  const actor = makeActor();
  const token = makeToken();
  let release;
  const started = new Promise(resolve => { release = resolve; });
  let go;
  const gate = new Promise(resolve => { go = resolve; });
  const originalUpdate = actor.update;
  actor.update = async changes => {
    release();
    await gate;
    return originalUpdate(changes);
  };
  const apply = applyTokenImage(token, "art/b.png", { settings: SETTINGS, validate: false });
  await started;
  const save = saveActorPattern(actor, "art/c.png");
  await Promise.resolve();
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), undefined);
  go();
  await Promise.all([apply, save]);
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), "art/c.png");
});

test("scene propagation rolls back successful sibling updates after failure", async () => {
  const actor = makeActor();
  const first = makeToken("t1");
  const next = makeToken("t2");
  makeToken("t3", "a1", { fail: true });
  await assert.rejects(applyTokenImage(first, "art/b.png", {
    settings: { ...SETTINGS, otherLive: true }, validate: false,
  }), /token failure/);
  assert.equal(first.document.texture.src, "art/a.png");
  assert.equal(next.document.texture.src, "art/a.png");
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
  assert.equal(events.length, 0);
});

test("deleting token during browsing prevents all writes", async () => {
  const actor = makeActor();
  const token = makeToken();
  let resolveBrowse;
  browseOverride = () => new Promise(resolve => { resolveBrowse = resolve; });
  const applying = applyTokenImage(token, "art/b.png", { settings: SETTINGS });
  // Wait until the async browse has actually started.
  for (let i = 0; i < 10 && !resolveBrowse; i++) await sleep(1);
  assert.equal(typeof resolveBrowse, "function");
  scene.tokens.delete(token.document.id);
  resolveBrowse({ files: ["art/a.png", "art/b.png"] });
  await assert.rejects(applying, /staleToken/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
});

test("different image collection limits never reuse an oversized cached listing", async () => {
  makeActor();
  const token = makeToken();
  listing = Array.from({ length: 75 }, (_, n) => `art/t${n}.png`);
  assert.equal((await listTokenImages(token, { settings: { ...SETTINGS, maxImages: 60 } })).length, 60);
  assert.equal((await listTokenImages(token, { settings: { ...SETTINGS, maxImages: 20 } })).length, 20);
  assert.equal(browseCalls, 2);
  assert.equal((await listTokenImages(token, { settings: { ...SETTINGS, maxImages: 20 } })).length, 20);
  assert.equal(browseCalls, 2);
});

test("S3 patterns browse only the declared bucket", async () => {
  const actor = makeActor();
  const token = makeToken();
  await saveActorPattern(actor, "s3://my-bucket/actors/hero_*.webp");
  let request;
  browseOverride = async (...args) => {
    request = args;
    return { files: ["s3://my-bucket/actors/hero_1.webp"] };
  };
  assert.deepEqual(await listTokenImages(token), ["s3://my-bucket/actors/hero_1.webp"]);
  assert.equal(request[0], "s3");
  assert.equal(request[1], "actors/hero_*.webp");
  assert.equal(request[2].bucket, "my-bucket");
  assert.equal(request[2].wildcard, true);
});

test("native wildcard preservation with no live target returns a refusal", async () => {
  const actor = makeActor("a1", { wildcard: true });
  const token = makeToken();
  await assert.rejects(applyTokenImage(token, "art/b.png", {
    settings: { ...SETTINGS, live: false, wildcard: "preserve" }, validate: false,
  }), /nothingEnabled/);
  assert.equal(actor.prototypeToken.texture.src, "art/*.png");
});


test("selecting an already active image is a no-op and emits no change event", async () => {
  makeActor();
  const token = makeToken();
  const result = await applyTokenImage(token, "art/a.png", { settings: SETTINGS, validate: false });
  assert.equal(result.updatedLive, 0);
  assert.equal(result.updatedPrototype, false);
  assert.equal(events.length, 0);
});

test("owner access works with world settings enabled", async () => {
  const actor = makeActor();
  const token = makeToken();
  user.isGM = false;
  assert.equal(canEdit(token), true);
  await saveActorPattern(actor, "art/*.png");
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), "art/*.png");
  const result = await cycleToken(token, 1);
  assert.equal(result.updatedLive, 1);
  assert.equal(token.document.texture.src, "art/b.png");
});


test("non-GM cannot turn off image membership validation", async () => {
  const actor = makeActor();
  const token = makeToken();
  user.isGM = false;
  await assert.rejects(applyTokenImage(token, "art/unlisted.png", {
    settings: { ...SETTINGS }, validate: false,
  }), /notListed/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
  assert.equal(token.document.texture.src, "art/a.png");
});

test("changes to world policy during async browse take effect before writing", async () => {
  const actor = makeActor();
  const token = makeToken();
  user.isGM = false;
  let releaseBrowse;
  browseOverride = () => new Promise(resolve => { releaseBrowse = resolve; });
  const pending = applyTokenImage(token, "art/b.png");
  for (let i = 0; i < 10 && !releaseBrowse; i++) await sleep(1);
  assert.equal(typeof releaseBrowse, "function");
  worldSettings.live = false;
  worldSettings.prototype = false;
  releaseBrowse({ files: listing });
  await assert.rejects(pending, /nothingEnabled/);
  assert.equal(actor.prototypeToken.texture.src, "art/a.png");
  assert.equal(token.document.texture.src, "art/a.png");
});


test("scene-wide synchronization respects its 24-write concurrency ceiling", async () => {
  makeActor();
  const tokens = Array.from({ length: 51 }, (_, index) => makeToken(`batch-${index}`));
  let active = 0;
  let peak = 0;
  for (const token of tokens) {
    const doc = token.document;
    doc.update = async changes => {
      active++;
      peak = Math.max(peak, active);
      try {
        await sleep(1);
        doc.texture.src = changes["texture.src"];
      } finally {
        active--;
      }
    };
  }
  const result = await applyTokenImage(tokens[0], "art/b.png", {
    settings: { ...SETTINGS, otherLive: true }, validate: false,
  });
  assert.equal(result.updatedLive, 51);
  assert.ok(peak <= 24, `peak concurrency ${peak}`);
  assert.ok(peak > 1, "writes should still be parallelized");
  assert.ok(tokens.every(token => token.document.texture.src === "art/b.png"));
});


test("native wildcard takes precedence over a stale Runyth pattern and resolves through v13 FilePicker", async () => {
  const actor = makeActor("a1", { wildcard: true });
  const token = makeToken();
  await saveActorPattern(actor, "art/unrelated_*.png");
  nativeResult = ["art/hero_02.webp", "art/hero_01.webp", "art/hero_01.webp"];
  const result = await listTokenImages(token, { settings: SETTINGS });
  assert.deepEqual(result, ["art/hero_01.webp", "art/hero_02.webp"]);
  assert.equal(nativeCalls, 1);
  assert.equal(browseCalls, 0, "native wildcard resolver should avoid unrelated browse calls");
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), "art/unrelated_*.png");
  await applyTokenImage(token, "art/hero_02.webp", {
    settings: { ...SETTINGS, wildcard: "preserve" },
  });
  assert.equal(token.document.texture.src, "art/hero_02.webp");
  assert.equal(actor.prototypeToken.texture.src, "art/*.png");
  assert.equal(actor.prototypeToken.randomImg, true);
  assert.equal(actor.getFlag("runyth-cycle-token", "pattern"), "art/unrelated_*.png");
});

test("native wildcard resolver falls back to public browse on failure or empty result", async () => {
  makeActor("a1", { wildcard: true });
  const token = makeToken();
  nativeFailure = new Error("temporarily unavailable");
  listing = ["art/hero_01.png", "art/hero_02.png"];
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS, refresh: true }), listing);
  assert.equal(nativeCalls, 1);
  assert.equal(browseCalls, 1);
  nativeFailure = null;
  nativeResult = [];
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS, refresh: true }), listing);
  assert.equal(nativeCalls, 2);
  assert.equal(browseCalls, 2);
});

test("empty image listings are not cached after the user fixes wildcard files", async () => {
  makeActor("a1", { wildcard: true });
  const token = makeToken();
  nativeResult = [];
  listing = [];
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS }), []);
  listing = ["art/new_file.webp"];
  assert.deepEqual(await listTokenImages(token, { settings: SETTINGS }), ["art/new_file.webp"]);
  assert.equal(browseCalls, 2);
});
