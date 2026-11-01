import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { imageDisplayName, imageTooltip, affectedTargets } from "../scripts/presentation.mjs";
import { getIconDefinition, HUD_ICON_CHOICES, setHudIcon } from "../scripts/hud-icons.mjs";

// A small DOM and ApplicationV2 fixture verifies view models and event handling
// without pretending to be a real Foundry/Electron browser integration test.
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.attrs = new Map();
    this.className = "";
    this.textContent = "";
    this.title = "";
    this.value = "";
    this.checked = false;
    this.scrollTop = 0;
    this.clientHeight = 300;
    this.scrollHeight = 1000;
    const cssProperties = new Map();
    this.style = {
      setProperty: (name, value) => cssProperties.set(name, value),
      getPropertyValue: name => cssProperties.get(name) ?? "",
    };
    this.classList = {
      add: name => { if (!this.className.split(" ").includes(name)) this.className += ` ${name}`; },
      toggle: (name, active) => {
        const list = new Set(this.className.split(" ").filter(Boolean));
        if (active) list.add(name); else list.delete(name);
        this.className = [...list].join(" ");
      },
    };
  }
  append(...children) { this.children.push(...children.flatMap(c => c.tagName === "fragment" ? c.children : [c])); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attrs.set(key, value); }
  getAttribute(key) { return this.attrs.get(key); }
  addEventListener(key, callback) { this.listeners.set(key, callback); }
  dispatch(type) { return this.listeners.get(type)?.({ target: this, preventDefault() {}, stopPropagation() {} }); }
  querySelectorAll(selector) {
    const result = [];
    const recurse = node => {
      if (selector.startsWith(".") && node.className.split(" ").includes(selector.slice(1))) result.push(node);
      for (const child of node.children) recurse(child);
    };
    recurse(this);
    return result;
  }
}

class ApplicationV2 {
  constructor() {
    this.position = { ...this.constructor.DEFAULT_OPTIONS?.position };
    this.rendered = false;
    this.element = undefined; // Foundry has not yet created the frame.
    this.content = undefined;
    this.positionCalls = 0;
  }
  async _preFirstRender() {}
  async _onFirstRender() {}
  async _preClose() {}
  async _onRender() {}
  _onClose() {}
  setPosition(value) {
    // Foundry v13 applies position via a frame's style. Simulate the failure
    // that occurs when setPosition is invoked before the first frame exists.
    if (!this.element?.style) throw new TypeError("Cannot read properties of undefined (reading 'style')");
    this.positionCalls++;
    Object.assign(this.position, value);
  }
  async render() {
    const first = !this.rendered;
    if (first) await this._preFirstRender({}, {});
    if (first) {
      this.element = new Element("section");
      this.content = new Element("div");
    }
    this.rendered = true;
    this._replaceHTML(await this._renderHTML(), this.content);
    if (first) await this._onFirstRender({}, {});
    await this._onRender({}, {});
    return this;
  }
  async close() {
    await this._preClose({});
    this.rendered = false;
    this._onClose({});
    this.element = undefined;
    this.content = undefined;
  }
  bringToFront() {}
}

globalThis.foundry = { applications: { api: { ApplicationV2 } } };
globalThis.document = {
  createElement: tag => new Element(tag),
  createDocumentFragment: () => new Element("fragment"),
  createTextNode: text => { const node = new Element("#text"); node.textContent = text; return node; },
  querySelectorAll: () => [],
};
globalThis.window = { innerWidth: 1280, innerHeight: 840 };
globalThis.ui = { notifications: { error: message => { throw new Error(message); }, info() {} } };
const stored = new Map();
globalThis.game = {
  i18n: { localize: key => key },
  user: { isGM: true },
  actors: new Map(),
  settings: {
    get: (namespace, key) => stored.get(key),
    set: async (namespace, key, value) => { stored.set(key, value); return value; },
    register: () => {}, registerMenu: () => {},
  },
};
globalThis.canvas = { scene: { id: "scene-1", tokens: new Map() } };
const { restoredGeometry, resetLayout, WindowLayoutSettings } = await import("../scripts/layout.mjs");
const { CycleTokenWindow } = await import("../scripts/window.mjs");
const { THUMBNAIL_SIZE, normalizedThumbnailSize, thumbnailDimensions, readThumbnailPreferences, updateVisibleThumbnailSize, normalizedWindowOpacity, updateVisibleWindowOpacity, applyWindowBackdropOpacity, WINDOW_OPACITY } = await import("../scripts/settings.mjs");
const { ThumbnailSettingsWindow } = await import("../scripts/thumbnail-settings.mjs");
const { CycleTokenHelp, openHelp } = await import("../scripts/help.mjs");

function defaults() {
  Object.entries({
    enableHud: true, hudIcon: "emoji-joker", allowOwners: true, syncCurrent: true,
    syncPrototype: true, syncScene: false, wildcardPolicy: "selected", maxImages: 400,
    showImageNames: false, tooltipMode: "stem", advancedMenuUser: false, regexSearch: false, thumbnailSize: 115, thumbnailAdvanced: false, thumbnailWidth: 0, thumbnailHeight: 0, window: {}, helpWindow: {}, windowOpacity: 100,
  }).forEach(([key, value]) => stored.set(key, value));
}

function fixture() {
  const actor = { id: "actor-1", prototypeToken: { randomImg: false }, testUserPermission: () => true };
  game.actors.set(actor.id, actor);
  const parent = canvas.scene;
  const doc = { id: "token-1", uuid: "Scene.scene-1.Token.token-1", actorId: actor.id,
    texture: { src: "art/Alpha_One.png" }, parent, testUserPermission: () => true };
  parent.tokens.set(doc.id, doc);
  return { document: doc, name: "Test token" };
}

function first(root, cls) { return root.querySelectorAll(`.${cls}`)[0]; }

test.beforeEach(() => { defaults(); game.actors.clear(); canvas.scene.tokens.clear(); });

test("image tooltip defaults to filename stem and supports optional modes", () => {
  assert.equal(imageDisplayName("tokens/hero/Body.Hero.webp?cache=7"), "Body.Hero");
  assert.equal(imageTooltip("tokens/hero/Hero One.png"), "Hero One");
  assert.equal(imageTooltip("tokens/hero/Hero One.png", "filename"), "Hero One.png");
  assert.equal(imageTooltip("tokens/hero/Hero One.png", "path"), "tokens/hero/Hero One.png");
  assert.equal(imageTooltip("tokens/hero/Hero One.png", "none"), "");
});

test("image gallery starts without captions, displays only image names on hover", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/Alpha_One.png", "art/Beta.webp"];
  picker.loaded = true;
  const root = await picker._renderHTML();
  const tile = first(root, "rct-tile");
  assert.equal(tile.title, "Alpha_One");
  assert.equal(tile.getAttribute("aria-label"), "Alpha_One");
  assert.equal(tile.children.length, 1);
  assert.equal(first(root, "rct-names-toggle"), undefined);
  stored.set("advancedMenuUser", true);
  const advancedRoot = await picker._renderHTML();
  const checkbox = first(advancedRoot, "rct-names-toggle").children[0];
  assert.equal(checkbox.checked, false);
  checkbox.checked = true;
  checkbox.dispatch("change");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.get("showImageNames"), true);
  const displayed = first(advancedRoot, "rct-tile");
  assert.equal(displayed.children.length, 2);
  assert.equal(displayed.children[1].textContent, "Alpha_One");
});

test("thumbnail tooltip modes follow setting independently of caption visibility", async () => {
  stored.set("showImageNames", true);
  stored.set("tooltipMode", "none");
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["directory/my-icon.webp"];
  const root = await picker._renderHTML();
  assert.equal(first(root, "rct-tile").title, "");
  assert.equal(first(root, "rct-tile").children[1].textContent, "my-icon");
  stored.set("tooltipMode", "filename");
  const newRoot = await picker._renderHTML();
  assert.equal(first(newRoot, "rct-tile").title, "my-icon.webp");
});

test("minimal mode is the default: search, icon-only regex toggle and thumbnails only", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/Alpha_One.png", "art/Beta.webp"];
  const root = await picker._renderHTML();
  assert.ok(root.className.includes("rct-simple"));
  assert.equal(root.children.length, 2);
  assert.equal(first(root, "rct-toolbar"), undefined);
  assert.equal(first(root, "rct-heading"), undefined);
  assert.equal(first(root, "rct-names-toggle"), undefined);
  assert.equal(first(root, "rct-destinations"), undefined);
  assert.equal(first(root, "rct-footer"), undefined);
  assert.equal(first(root, "rct-status"), undefined);
  const toggle = first(root, "rct-regex-toggle");
  assert.equal(toggle.children.length, 1);
  assert.equal(toggle.children[0].tagName, "i");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.equal(first(root, "rct-tile").children.length, 1);
  assert.equal(first(root, "rct-tile").title, "Alpha_One");
});

test("advanced menu retains full controls, and captions survive transitions to simple mode", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/Alpha_One.png"];
  stored.set("advancedMenuUser", true);
  let root = await picker._renderHTML();
  assert.equal(first(root, "rct-toolbar").children.length, 4);
  assert.ok(first(root, "rct-heading"));
  assert.ok(first(root, "rct-destinations"));
  assert.ok(first(root, "rct-footer"));
  const toggle = first(root, "rct-names-toggle").children[0];
  toggle.checked = true;
  await toggle.dispatch("change");
  assert.equal(stored.get("showImageNames"), true);
  stored.set("advancedMenuUser", false);
  root = await picker._renderHTML();
  assert.equal(first(root, "rct-names-toggle"), undefined);
  assert.equal(first(root, "rct-tile").children[1].textContent, "Alpha_One");
  stored.set("advancedMenuUser", true);
  root = await picker._renderHTML();
  assert.equal(first(root, "rct-names-toggle").children[0].checked, true);
  stored.set("showImageNames", false);
  stored.set("advancedMenuUser", false);
  root = await picker._renderHTML();
  assert.equal(first(root, "rct-tile").children.length, 1);
});

test("search toggles between literal substring and case-insensitive regex, preserving preference", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/Hero_01.webp", "art/Hero_02.webp", "art/Other.png"];
  let root = await picker._renderHTML();
  const search = first(root, "rct-search");
  const regex = first(root, "rct-regex-toggle");
  search.value = String.raw`^hero_\d{2}\.webp$`;
  search.dispatch("input");
  assert.equal(root.querySelectorAll(".rct-tile").length, 0, "regex source is literal with regex off");
  await regex.dispatch("click");
  assert.equal(stored.get("regexSearch"), true);
  assert.equal(regex.getAttribute("aria-pressed"), "true");
  assert.equal(root.querySelectorAll(".rct-tile").length, 2);
  search.value = "[";
  search.dispatch("input");
  assert.equal(search.getAttribute("aria-invalid"), "true");
  assert.equal(root.querySelectorAll(".rct-search-error").length, 1);
  assert.equal(root.querySelectorAll(".rct-tile").length, 0);
  await regex.dispatch("click");
  assert.equal(stored.get("regexSearch"), false);
  assert.equal(search.getAttribute("aria-invalid"), "false");
  assert.equal(root.querySelectorAll(".rct-search-error").length, 0);
  search.value = "hero";
  search.dispatch("input");
  assert.equal(root.querySelectorAll(".rct-tile").length, 2);
  const reopened = new CycleTokenWindow(fixture());
  assert.equal(reopened.regexMode, false);
});

test("regex toggle remains visibly pressed after asynchronous persistence and rerender", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.loaded = true;
  picker.images = ["art/Hero.webp"];
  let root = await picker._renderHTML();
  const regex = first(root, "rct-regex-toggle");
  assert.equal(regex.getAttribute("aria-pressed"), "false");
  assert.equal(regex.className.includes("is-active"), false);
  await regex.dispatch("click");
  assert.equal(regex.getAttribute("aria-pressed"), "true");
  assert.equal(regex.className.includes("is-active"), true);
  assert.equal(stored.get("regexSearch"), true);
  root = await picker._renderHTML();
  assert.equal(first(root, "rct-regex-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(first(root, "rct-regex-toggle").className.includes("is-active"), true);
  const css = await readFile(new URL("../styles/runyth-cycle-token.css", import.meta.url), "utf8");
  assert.match(css, /button\.rct-regex-toggle\[aria-pressed="true"\]/);
  assert.match(css, /background:\s*var\(--color-border-highlight/);
  assert.match(css, /box-shadow:\s*inset/);
  await first(root, "rct-regex-toggle").dispatch("click");
  assert.equal(stored.get("regexSearch"), false);
  assert.equal(first(root, "rct-regex-toggle").getAttribute("aria-pressed"), "false");
});

test("thumbnail size remains compatible with v0.2.1 user settings and bounds", async () => {
  assert.deepEqual(THUMBNAIL_SIZE, { min: 85, max: 245, step: 10, default: 115 });
  for (const [value, expected] of [[undefined, 115], [null, 115], ["", 115], [NaN, 115], ["invalid", 115], [-50, 85], [10000, 245], [141, 145]]) {
    assert.equal(normalizedThumbnailSize(value), expected);
  }
  assert.deepEqual(thumbnailDimensions({ size: 175 }), { width: 175, height: 175 });
  assert.deepEqual(thumbnailDimensions({ size: 175, advanced: true, width: 0, height: 0 }), { width: 175, height: 175 });
  assert.deepEqual(thumbnailDimensions({ size: 175, advanced: true, width: 245, height: 85 }), { width: 245, height: 85 });
  assert.deepEqual(thumbnailDimensions({ size: 175, advanced: false, width: 245, height: 85 }), { width: 175, height: 175 });
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/A.webp", "art/B.webp"];
  for (const advancedMenu of [false, true]) {
    stored.set("advancedMenuUser", advancedMenu);
    for (const size of [85, 115, 175, 245]) {
      stored.set("thumbnailSize", size);
      const root = await picker._renderHTML();
      assert.equal(root.style.getPropertyValue("--rct-thumbnail-width"), `${size}px`);
      assert.equal(root.style.getPropertyValue("--rct-thumbnail-height"), `${size}px`);
      assert.equal(first(root, "rct-gallery").querySelectorAll(".rct-tile").length, 2);
    }
  }
  // Settings onChange updates an open view in-place, retaining existing nodes.
  const root = await picker._renderHTML();
  const initialTile = first(root, "rct-tile");
  const originalQuery = document.querySelectorAll;
  try {
    document.querySelectorAll = selector => {
      assert.equal(selector, ".runyth-cycle-token-window .rct-shell");
      return [root];
    };
    updateVisibleThumbnailSize({ size: 115, advanced: true, width: 245, height: 85 });
  } finally { document.querySelectorAll = originalQuery; }
  assert.equal(root.style.getPropertyValue("--rct-thumbnail-width"), "245px");
  assert.equal(root.style.getPropertyValue("--rct-thumbnail-height"), "85px");
  assert.equal(first(root, "rct-tile"), initialTile, "size change must not recreate thumbnails");
  const css = await readFile(new URL("../styles/runyth-cycle-token.css", import.meta.url), "utf8");
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*calc\(var\(--rct-thumbnail-width/);
  assert.match(css, /grid-auto-rows:\s*max-content/);
  assert.match(css, /height:\s*var\(--rct-thumbnail-height/);
  assert.match(css, /min-height:\s*var\(--rct-thumbnail-height/);
  assert.match(css, /flex:\s*0 0 auto/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.rct-thumbnail\s*\{[^}]*height:\s*auto/, "image height must not depend on auto sizing");
});

test("thumbnail settings submenu switches from one linked slider to two independent sliders", async () => {
  stored.set("thumbnailSize", 205); // upgrade from v0.2.1 retains saved preference
  const window = new ThumbnailSettingsWindow();
  const root = await window._renderHTML();
  const toggle = first(root, "rct-size-toggle").children[0];
  const linked = first(root, "rct-size-size");
  const width = first(root, "rct-size-width");
  const height = first(root, "rct-size-height");
  assert.equal(toggle.checked, false);
  assert.equal(linked.hidden, false);
  assert.equal(width.hidden, true);
  assert.equal(height.hidden, true);
  assert.equal(linked.children[1].value, "205");
  // A new advanced user inherits the old combined size on both axes.
  toggle.checked = true;
  toggle.dispatch("change");
  assert.equal(linked.hidden, true);
  assert.equal(width.hidden, false);
  assert.equal(height.hidden, false);
  assert.equal(width.children[1].value, "205");
  assert.equal(height.children[1].value, "205");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.get("thumbnailAdvanced"), true);
  width.children[1].value = "245";
  width.children[1].dispatch("input");
  width.children[1].dispatch("change");
  height.children[1].value = "85";
  height.children[1].dispatch("input");
  height.children[1].dispatch("change");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored.get("thumbnailWidth"), 245);
  assert.equal(stored.get("thumbnailHeight"), 85);
  assert.deepEqual(thumbnailDimensions(readThumbnailPreferences()), { width: 245, height: 85 });
  toggle.checked = false;
  toggle.dispatch("change");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(thumbnailDimensions(readThumbnailPreferences()), { width: 205, height: 205 });
  // Advanced values survive temporarily returning to linked mode.
  toggle.checked = true;
  toggle.dispatch("change");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(thumbnailDimensions(readThumbnailPreferences()), { width: 245, height: 85 });
});

test("failed personal preference save rolls back and reports the error", async () => {
  const originalSet = game.settings.set;
  const originalError = ui.notifications.error;
  const errors = [];
  try {
    game.settings.set = async () => { throw new Error("Storage unavailable"); };
    ui.notifications.error = message => errors.push(message);
    const menu = new ThumbnailSettingsWindow();
    const root = await menu._renderHTML();
    const input = first(root, "rct-size-size").children[1];
    input.value = "245";
    input.dispatch("change");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(input.value, "115");
    assert.equal(stored.get("thumbnailSize"), 115);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Storage unavailable/);
  } finally {
    game.settings.set = originalSet;
    ui.notifications.error = originalError;
  }
});

test("a late failed save must not undo a more recent slider value", async () => {
  const originalSet = game.settings.set;
  const originalError = ui.notifications.error;
  let releaseFirst;
  const firstWrite = new Promise(resolve => { releaseFirst = resolve; });
  const errors = [];
  let count = 0;
  try {
    game.settings.set = async (namespace, name, value) => {
      if (++count === 1) { await firstWrite; throw new Error("Stale failure"); }
      stored.set(name, value);
      return value;
    };
    ui.notifications.error = message => errors.push(message);
    const root = await new ThumbnailSettingsWindow()._renderHTML();
    const input = first(root, "rct-size-size").children[1];
    input.value = "245";
    input.dispatch("change");
    await new Promise(resolve => setImmediate(resolve)); // first write now pending
    input.value = "175";
    input.dispatch("change");
    releaseFirst();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stored.get("thumbnailSize"), 175);
    assert.equal(input.value, "175");
    assert.equal(errors.length, 1);
  } finally {
    releaseFirst?.();
    game.settings.set = originalSet;
    ui.notifications.error = originalError;
  }
});

test("height and width remain independent during live slider preview, without thumbnail replacement", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/A.webp"];
  const gallery = await picker._renderHTML();
  const tile = first(gallery, "rct-tile");
  const originalQuery = document.querySelectorAll;
  document.querySelectorAll = () => [gallery];
  try {
    const menu = new ThumbnailSettingsWindow();
    const controls = await menu._renderHTML();
    const toggle = first(controls, "rct-size-toggle").children[0];
    toggle.checked = true;
    toggle.dispatch("change");
    const width = first(controls, "rct-size-width").children[1];
    const height = first(controls, "rct-size-height").children[1];
    width.value = "245";
    width.dispatch("input");
    assert.equal(gallery.style.getPropertyValue("--rct-thumbnail-width"), "245px");
    assert.equal(gallery.style.getPropertyValue("--rct-thumbnail-height"), "115px");
    height.value = "175";
    height.dispatch("input");
    assert.equal(gallery.style.getPropertyValue("--rct-thumbnail-height"), "175px");
    assert.equal(first(gallery, "rct-tile"), tile);
  } finally { document.querySelectorAll = originalQuery; }
});

test("regex search client preference survives reopening and works in advanced view", async () => {
  stored.set("regexSearch", true);
  stored.set("advancedMenuUser", true);
  const picker = new CycleTokenWindow(fixture());
  assert.equal(picker.regexMode, true);
  picker.images = ["art/Body_A.webp", "art/Body_B.webp", "art/Face_C.png"];
  const root = await picker._renderHTML();
  assert.equal(first(root, "rct-regex-toggle").getAttribute("aria-pressed"), "true");
  assert.equal(first(root, "rct-toolbar").children.length, 4);
  const search = first(root, "rct-search");
  search.value = String.raw`^body_.*\.webp$`;
  search.dispatch("input");
  assert.equal(root.querySelectorAll(".rct-tile").length, 2);
});

test("minimal image listing appends thumbnails on scroll without paging buttons", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.images = Array.from({ length: 205 }, (_, i) => `art/image-${i}.webp`);
  const root = await picker._renderHTML();
  const gallery = first(root, "rct-gallery");
  assert.equal(gallery.querySelectorAll(".rct-tile").length, 80);
  assert.equal(first(root, "rct-more"), undefined);
  gallery.scrollTop = 700;
  gallery.dispatch("scroll");
  assert.equal(gallery.querySelectorAll(".rct-tile").length, 160);
  gallery.scrollTop = 1700;
  gallery.scrollHeight = 1900;
  gallery.dispatch("scroll");
  assert.equal(gallery.querySelectorAll(".rct-tile").length, 205);
  gallery.dispatch("scroll");
  assert.equal(gallery.querySelectorAll(".rct-tile").length, 205);
});

test("destination explanations honor scene dependencies and wildcard preservation", () => {
  assert.deepEqual(affectedTargets({ live: true, otherLive: false, prototype: true, wildcard: "selected" }), ["current", "prototype"]);
  assert.deepEqual(affectedTargets({ live: false, otherLive: true, prototype: true, wildcard: "preserve" }, true), []);
  assert.deepEqual(affectedTargets({ live: true, otherLive: true, prototype: true, wildcard: "preserve" }, true), ["current", "scene"]);
});

test("HUD icon options include bundled vector artwork, Font Awesome and emoji with safe fallback", () => {
  assert.equal(Object.keys(HUD_ICON_CHOICES).length, 14);
  assert.equal(getIconDefinition("svg-cycle").type, "svg");
  assert.equal(getIconDefinition("emoji-theatre").name, "🎭");
  assert.equal(getIconDefinition("arbitrary/unsafe-path").name, "🃏");
  const node = new Element("button");
  setHudIcon(node, "svg-stack");
  assert.equal(node.children[0].src, "modules/runyth-cycle-token/assets/token-stack.svg");
  setHudIcon(node, "emoji-theatre");
  assert.equal(node.children[0].textContent, "🎭");
});

test("help begins square, restores separate coordinates, persists on close", async () => {
  const help = new CycleTokenHelp();
  assert.equal(help.position.width, 560);
  assert.equal(help.position.height, 560);
  await help.render();
  assert.equal(first(help.content, "rct-help-content").children.length, 8);
  help.setPosition({ left: 180, top: 75, width: 610, height: 490 });
  await help.close();
  assert.deepEqual(stored.get("helpWindow"), { left: 180, top: 75, width: 610, height: 490 });
  const another = new CycleTokenHelp();
  await another.render();
  assert.equal(another.position.left, 180);
  assert.equal(another.position.width, 610);
  await another.close();
});

test("window geometry clamped to viewport and reset menu clears settings for future launch", async () => {
  assert.deepEqual(restoredGeometry({}, { width: 1000, height: 800 }), null);
  assert.deepEqual(restoredGeometry({ width: 900, height: 700, left: 900, top: 900 }, { width: 700, height: 500 }),
    { width: 676, height: 476, left: 24, top: 24 });
  stored.set("helpWindow", { left: 150, top: 100, width: 700, height: 650 });
  stored.set("window", { left: 45, top: 55, width: 700, height: 500 });
  await resetLayout("helpWindow");
  assert.deepEqual(stored.get("helpWindow"), {});
  assert.equal(stored.get("window").left, 45);
  const menu = new WindowLayoutSettings();
  await menu.render();
  assert.equal(first(menu.content, "rct-layout-row").children.length, 2);
});

test("picker also persists its geometry independently", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.loaded = true;
  await picker.render();
  picker.setPosition({ width: 770, height: 590, left: 90, top: 40 });
  await picker.close();
  assert.deepEqual(stored.get("window"), { width: 770, height: 590, left: 90, top: 40 });
  assert.deepEqual(stored.get("helpWindow"), {});
});

// Reopening a cached ApplicationV2 instance after a reset must not reuse its old size.
test("reopening the same help instance after reset uses square centered defaults", async () => {
  const help = new CycleTokenHelp();
  await help.render();
  help.setPosition({ width: 900, height: 410, left: 100, top: 120 });
  await help.close();
  await resetLayout("helpWindow");
  await help.render();
  assert.equal(help.position.width, 560);
  assert.equal(help.position.height, 560);
  assert.equal(help.position.left, 360);
  assert.equal(help.position.top, 140);
  await help.close();
});

// Lifecycle regression: the actual Foundry v13 frame is not available in
// _preFirstRender, so attempting to set its style there crashes the application.
test("geometry restoration runs only after the v13 frame exists", async () => {
  stored.set("helpWindow", { width: 620, height: 480, left: 110, top: 95 });
  const help = new CycleTokenHelp();
  assert.equal(help.element, undefined);
  await help._preFirstRender({}, {});
  assert.equal(help.positionCalls, 0);
  await help.render();
  assert.equal(help.positionCalls, 1);
  assert.deepEqual(help.position, { width: 620, height: 480, left: 110, top: 95 });
  await help.render();
  assert.equal(help.positionCalls, 1, "rerender must not overwrite user's changes");
  await help.close();
});

test("picker and help both render without pre-frame style errors, including reopening", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.loaded = true;
  await picker.render();
  assert.equal(picker.positionCalls, 1);
  await picker.close();
  await picker.render();
  assert.equal(picker.positionCalls, 2);
  await picker.close();
  const help = new CycleTokenHelp();
  await help.render();
  assert.equal(help.positionCalls, 1);
  await help.close();
});

test("resetting layout while help is open updates frame and survives closing", async () => {
  const help = new CycleTokenHelp();
  await help.render();
  help.setPosition({ width: 750, height: 630, left: 45, top: 35 });
  await resetLayout("helpWindow");
  assert.equal(help.position.width, 560);
  assert.equal(help.position.height, 560);
  await help.close();
  assert.equal(stored.get("helpWindow").width, 560);
  assert.equal(stored.get("helpWindow").height, 560);
});

// Reproduce the exact failure mechanism from the user's Foundry log so this
// fixture cannot silently accept a return to premature positioning.
test("pre-frame setPosition reproduces the logged style error", async () => {
  class LegacyWindow extends ApplicationV2 {
    async _preFirstRender() { this.setPosition({ width: 560, height: 560 }); }
    async _renderHTML() { return new Element("p"); }
    _replaceHTML(result, content) { content.replaceChildren(result); }
  }
  const legacy = new LegacyWindow();
  await assert.rejects(() => legacy.render(), /reading 'style'/);
  assert.equal(legacy.rendered, false);
});


test("empty gallery shows localized actionable native wildcard setup guide only when loaded", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.loaded = true;
  picker.images = [];
  for (const advanced of [false, true]) {
    stored.set("advancedMenuUser", advanced);
    const empty = await picker._renderHTML();
    const guide = first(empty, "rct-empty-guide");
    assert.ok(guide, "empty gallery should show setup guide in both modes");
    assert.equal(guide.getAttribute("role"), "status");
    assert.equal(guide.children[2].tagName, "ol");
    assert.equal(guide.children[2].children.length, 5);
    picker.images = ["art/found.png"];
    const populated = await picker._renderHTML();
    assert.equal(first(populated, "rct-empty-guide"), undefined, "guide must disappear when an image exists");
    assert.equal(first(populated, "rct-tile").title, "found");
    picker.images = [];
  }
  picker.loaded = false;
  const loading = await picker._renderHTML();
  assert.equal(first(loading, "rct-empty-guide"), undefined, "do not show setup advice while browsing is pending");
});

test("empty guide is not confused with a search that matches zero existing images", async () => {
  const picker = new CycleTokenWindow(fixture());
  picker.loaded = true;
  picker.images = ["art/hit.png"];
  picker.search = "not-a-match";
  const root = await picker._renderHTML();
  assert.equal(first(root, "rct-empty-guide"), undefined);
  assert.equal(first(root, "rct-gallery").children[0].textContent, "RCT.Ui.noMatches");
});

test("per-player opacity setting is clamped and applied on render without calling setPosition", async () => {
  assert.deepEqual(WINDOW_OPACITY, { min: 0, max: 100, step: 5, default: 100 });
  for (const [value, expected] of [[undefined,100],[null,100],["",100],[NaN,100],[0,0],[-5,0],[120,100],[83,85]]) {
    assert.equal(normalizedWindowOpacity(value), expected);
  }
  const originalQuery = document.querySelectorAll;
  const frame = new Element("div");
  try {
    document.querySelectorAll = selector => {
      assert.equal(selector, ".runyth-cycle-token-window");
      return [frame];
    };
    updateVisibleWindowOpacity(65);
    assert.equal(frame.style.getPropertyValue("--rct-window-surface-opacity"), "0.65");
    assert.equal(frame.style.getPropertyValue("opacity"), "", "parent opacity must never affect images");
    applyWindowBackdropOpacity(frame, 0);
    assert.equal(frame.style.getPropertyValue("--rct-window-surface-opacity"), "0");
    assert.ok(frame.className.includes("rct-window-transparent"));
    applyWindowBackdropOpacity(frame, 100);
    assert.equal(frame.style.getPropertyValue("--rct-window-surface-opacity"), "1");
    assert.ok(!frame.className.includes("rct-window-transparent"));
  } finally { document.querySelectorAll = originalQuery; }
  stored.set("windowOpacity", 80);
  const picker = new CycleTokenWindow(fixture());
  picker.images = ["art/hit.png"];
  picker.loaded = true;
  await picker.render(true);
  assert.equal(picker.element.style.getPropertyValue("--rct-window-surface-opacity"), "0.8");
  assert.equal(picker.positionCalls, 1);
  await picker.close();
});


test("thumbnail buttons override host button height and opacity never fades their artwork", async () => {
  const css = await readFile(new URL("../styles/runyth-cycle-token.css", import.meta.url), "utf8");
  assert.match(css, /\.rct-gallery\s*>\s*button\.rct-tile\s*\{[^}]*height:\s*max-content\s*!important/s);
  assert.match(css, /\.rct-gallery\s*>\s*button\.rct-tile\s*\{[^}]*max-height:\s*none\s*!important/s);
  assert.match(css, /\.rct-gallery\s*>\s*button\.rct-tile\s*\{[^}]*min-height:\s*calc\(var\(--rct-thumbnail-height/s);
  assert.match(css, /\.runyth-cycle-token-window::before\s*\{[^}]*opacity:\s*var\(--rct-window-surface-opacity\)/s);
  assert.doesNotMatch(css, /\.runyth-cycle-token-window\s*\{[^}]*(?:^|[;{])\s*opacity\s*:/sm, "window element must not become translucent");
  const source = await readFile(new URL("../scripts/window.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /setProperty\?\.\(\"opacity\"/, "do not set global frame opacity");
});
