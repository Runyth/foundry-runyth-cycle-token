// GENERATED FILE. DO NOT EDIT. Run: python3 tools/build-runtime.py
// Foundry loads this single module; there are no relative browser requests.
// Source fingerprint: 46d7f366fad3b5c31383ecb08b99c1edca49b6e368559db2af26a006ee6b75f0
const __factories = Object.create(null);
const __cache = Object.create(null);
function __require(key) {
  if (Object.hasOwn(__cache, key)) return __cache[key];
  const factory = __factories[key];
  if (!factory) throw new Error(`Missing bundled module: ${key}`);
  const exports = Object.create(null);
  __cache[key] = exports;
  factory(__require, exports);
  return exports;
}

__factories["./config.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {saveActorPattern} = __require("./service.mjs");
const {readSettings} = __require("./settings.mjs");
const {openHelp} = __require("./help.mjs");
const t = key => game.i18n.localize(`RCT.${key}`);

/** Supplement the Appearance tab without overriding core fields or form submission. */
function renderPrototypeSettings(app, html) {
  if (!(html instanceof HTMLElement)) return;
  const actor = app.actor;
  if (!actor || !(game.user.isGM ||
      (readSettings().owners && actor.testUserPermission(game.user, "OWNER")))) return;
  if (html.querySelector(`.${MODULE_ID}-config`)) return;
  // Foundry uses data-tab="appearance" on BOTH the tab navigation control
  // and its content panel. The old broad query could append our entire fieldset
  // to the navigation item, stretching the tab bar to an unusable size.
  const candidates = [html, ...html.querySelectorAll('[data-tab="appearance"]')];
  const appearance = candidates.find(node =>
    node?.getAttribute?.("data-tab") === "appearance" &&
    !node.closest?.('nav, [role="tablist"], .tabs, .tab-navigation, .sheet-tabs') &&
    node.querySelector?.('input[name="texture.src"], input[name="prototypeToken.texture.src"], [name="texture.src"], .form-group')
  );
  if (!appearance) return; // Never insert into a tab strip or unknown layout.
  const section = document.createElement("fieldset");
  section.className = `${MODULE_ID}-config`;
  const legend = document.createElement("legend");
  legend.textContent = t("Config.title");
  const label = document.createElement("label");
  label.textContent = t("Config.path");
  label.htmlFor = `${MODULE_ID}-pattern-${actor.id}`;
  const entry = document.createElement("input");
  entry.type = "text";
  entry.id = label.htmlFor;
  entry.placeholder = t("Config.placeholder");
  entry.value = actor.getFlag(MODULE_ID, "pattern") ?? "";
  entry.autocomplete = "off";
  entry.spellcheck = false;
  // Inputs intentionally have no "name": native form submission remains entirely untouched.
  const description = document.createElement("p");
  description.className = "hint";
  description.textContent = t("Config.hint");
  const buttons = document.createElement("div");
  buttons.className = "rct-config-buttons";

  const makeButton = (text, callback) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", callback);
    return button;
  };
  const save = makeButton(t("Config.save"), async () => {
    save.disabled = true;
    try {
      await saveActorPattern(actor, entry.value);
      ui.notifications.info(t("Config.saved"));
    } catch (error) { ui.notifications.error(`${MODULE_ID}: ${error.message}`); }
    finally { save.disabled = false; }
  });
  const browse = makeButton(t("Config.browse"), () => {
    new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: entry.value || actor.prototypeToken?.texture?.src || "",
      callback: path => { entry.value = path; },
    }).render(true);
  });
  const reset = makeButton(t("Config.reset"), () => { entry.value = ""; save.click(); });
  const help = makeButton(t("Ui.help"), () => void openHelp());
  buttons.append(save, browse, reset, help);
  section.append(legend, label, entry, description, buttons);
  appearance.append(section);
}
  __exports.renderPrototypeSettings = renderPrototypeSettings;
};

__factories["./core.mjs"] = (__require, __exports) => {
/** Pure helpers used by the Runyth Cycle Token runtime and tests. */
const MODULE_ID = "runyth-cycle-token";
const IMAGE_EXTENSIONS = Object.freeze([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const INVALID_PROTOCOL = /^(?:javascript|data|blob|file):/i;
const KNOWN_PROTOCOL = /^[a-z][a-z\d+.-]*:/i;

function assertAssetPath(value) {
  if (typeof value !== "string") throw new Error("Image path must be a string.");
  const path = value.trim();
  if (!path || path.length > 2048 || /[\u0000-\u001f\\<>]/.test(path) || INVALID_PROTOCOL.test(path)) {
    throw new Error("Unsupported or unsafe image path.");
  }
  // Remote images may be used as a single file, never as a browsed directory.
  if (KNOWN_PROTOCOL.test(path) && !/^https?:\/\//i.test(path) && !/^s3:\/\//i.test(path)) {
    throw new Error("Unsupported image path protocol.");
  }
  if (path.split(/[/?#]/).some(part => part === "..")) throw new Error("Parent directory paths are not allowed.");
  // Remote query parameters are valid, but glob characters in remote filenames are not.
  if (/^https?:\/\//i.test(path) && /[*{}\[\]]/.test(path.split(/[?#]/, 1)[0])) {
    throw new Error("Remote wildcard paths are not supported.");
  }
  return path;
}

function hasWildcard(path) {
  // Query parameters on HTTP(S) image URLs are not filesystem globs.
  if (/^https?:\/\//i.test(path)) return false;
  return /[*?{}\[\]]/.test(path);
}

function isImage(path) {
  const basename = String(path).split(/[?#]/, 1)[0].toLowerCase();
  return IMAGE_EXTENSIONS.some(extension => basename.endsWith(extension));
}

function inferSource({ pattern, prototypePath, randomImg, currentPath }) {
  // Foundry native wildcard configuration is authoritative while enabled,
  // even if this module retained an older custom-pattern override.
  if (randomImg && typeof prototypePath === "string" && hasWildcard(prototypePath)) {
    return { path: assertAssetPath(prototypePath), kind: "wildcard" };
  }
  if (typeof pattern === "string" && pattern.trim()) return { path: assertAssetPath(pattern), kind: "custom" };
  if (typeof currentPath !== "string" || !currentPath.trim()) throw new Error("Token has no image path.");
  const path = assertAssetPath(currentPath);
  if (/^https?:\/\//i.test(path)) return { path, kind: "single" };
  const last = path.lastIndexOf("/");
  if (last < 0) return { path: "", kind: "directory" };
  return { path: path.slice(0, last), kind: "directory" };
}

function normalizedImages(files, { include = "" } = {}) {
  const images = new Set();
  for (const value of files ?? []) {
    if (typeof value !== "string") continue;
    try {
      const path = assertAssetPath(value);
      if (isImage(path)) images.add(path);
    } catch { /* Ignore files that the server cannot safely display. */ }
  }
  if (include && isImage(include)) {
    try { images.add(assertAssetPath(include)); } catch { /* Ignore invalid current paths. */ }
  }
  return [...images].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }) || (a < b ? -1 : 1));
}

function nextImage(images, active, delta = 1) {
  if (!Array.isArray(images) || !images.length) return null;
  const index = images.indexOf(active);
  const start = index === -1 ? (delta >= 0 ? -1 : 0) : index;
  return images[((start + delta) % images.length + images.length) % images.length];
}

function basename(path) {
  return String(path).split(/[?#]/, 1)[0].split("/").at(-1) || path;
}

function policy(settings) {
  return {
    live: settings.live !== false,
    prototype: settings.prototype !== false,
    otherLive: settings.otherLive === true,
    wildcard: settings.wildcard === "preserve" ? "preserve" : "selected",
  };
}
  __exports.MODULE_ID = MODULE_ID;
  __exports.IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;
  __exports.assertAssetPath = assertAssetPath;
  __exports.hasWildcard = hasWildcard;
  __exports.isImage = isImage;
  __exports.inferSource = inferSource;
  __exports.normalizedImages = normalizedImages;
  __exports.nextImage = nextImage;
  __exports.basename = basename;
  __exports.policy = policy;
};

__factories["./help.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {RememberedWindow} = __require("./layout.mjs");
const t = key => game.i18n.localize(`RCT.${key}`);
let helpInstance = null;

class CycleTokenHelp extends RememberedWindow {
  static GEOMETRY_KEY = "helpWindow";
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-help`,
    classes: ["runyth-cycle-token-help"],
    window: { title: "Runyth Cycle Token — Help", icon: "fa-solid fa-circle-question", resizable: true },
    position: { width: 560, height: 560 },
  };

  async _renderHTML() {
    const root = document.createElement("article");
    root.className = "rct-help-content";
    for (const key of ["quickstart", "refresh", "destinations", "pattern", "wildcard", "permissions", "preferences"]) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = t(`Help.${key}.title`);
      const body = document.createElement("p");
      body.textContent = t(`Help.${key}.body`);
      section.append(heading, body);
      root.append(section);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = t("Ui.close");
    close.addEventListener("click", () => void this.close());
    root.append(close);
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}

async function openHelp() {
  helpInstance ??= new CycleTokenHelp();
  await helpInstance.render(true);
  helpInstance.bringToFront();
  return helpInstance;
}
  __exports.CycleTokenHelp = CycleTokenHelp;
  __exports.openHelp = openHelp;
};

__factories["./hud-icons.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
/** Fixed allowlist: icon setting values are never interpreted as arbitrary HTML or URLs. */
const HUD_ICON_CHOICES = Object.freeze({
  "fa-images": "RCT.Settings.icon.images",
  "fa-film": "RCT.Settings.icon.film",
  "fa-palette": "RCT.Settings.icon.palette",
  "fa-arrows-rotate": "RCT.Settings.icon.rotate",
  "fa-image": "RCT.Settings.icon.image",
  "svg-stack": "RCT.Settings.icon.stack",
  "svg-cycle": "RCT.Settings.icon.cycle",
  "svg-frame": "RCT.Settings.icon.frame",
  "emoji-theatre": "RCT.Settings.icon.theatre",
  "emoji-art": "RCT.Settings.icon.art",
  "emoji-cycle": "RCT.Settings.icon.emojiCycle",
  "emoji-camera": "RCT.Settings.icon.camera",
  "emoji-frame": "RCT.Settings.icon.emojiFrame",
  "emoji-joker": "RCT.Settings.icon.joker",
});

const ICONS = Object.freeze({
  "fa-images": { type: "fa", name: "fa-images" },
  "fa-film": { type: "fa", name: "fa-film" },
  "fa-palette": { type: "fa", name: "fa-palette" },
  "fa-arrows-rotate": { type: "fa", name: "fa-arrows-rotate" },
  "fa-image": { type: "fa", name: "fa-image" },
  "svg-stack": { type: "svg", name: "token-stack.svg" },
  "svg-cycle": { type: "svg", name: "token-cycle.svg" },
  "svg-frame": { type: "svg", name: "token-frame.svg" },
  "emoji-theatre": { type: "emoji", name: "🎭" },
  "emoji-art": { type: "emoji", name: "🎨" },
  "emoji-cycle": { type: "emoji", name: "🔄" },
  "emoji-camera": { type: "emoji", name: "📸" },
  "emoji-frame": { type: "emoji", name: "🖼️" },
  "emoji-joker": { type: "emoji", name: "🃏" },
});

function getIconDefinition(key) {
  return ICONS[key] ?? ICONS["emoji-joker"];
}

function setHudIcon(button, iconKey) {
  const spec = getIconDefinition(iconKey);
  let item;
  if (spec.type === "fa") {
    item = document.createElement("i");
    item.className = `fa-solid ${spec.name}`;
  } else if (spec.type === "svg") {
    item = document.createElement("img");
    item.className = "rct-hud-svg";
    item.src = `modules/${MODULE_ID}/assets/${spec.name}`;
    item.alt = "";
  } else {
    item = document.createElement("span");
    item.className = "rct-hud-emoji";
    item.textContent = spec.name;
  }
  item.setAttribute("aria-hidden", "true");
  button.replaceChildren(item);
}

/** Reflect an icon change in HUDs already open, without forcing full HUD rerenders. */
function updateVisibleHudIcons(iconKey) {
  for (const button of document.querySelectorAll(`.${MODULE_ID}-hud`)) setHudIcon(button, iconKey);
}
  __exports.HUD_ICON_CHOICES = HUD_ICON_CHOICES;
  __exports.getIconDefinition = getIconDefinition;
  __exports.setHudIcon = setHudIcon;
  __exports.updateVisibleHudIcons = updateVisibleHudIcons;
};

__factories["./hud-order.mjs"] = (__require, __exports) => {
/**
 * Place this module's own HUD control adjacent to Runyth Cycle Portrait.
 *
 * Never edit, clone, replace, or patch the companion control. A native DOM
 * observer handles late arrivals and rerenders without timers or hook patches.
 */
const PORTRAIT_MODULE = "runyth-cycle-portrait";
const TOKEN_CONTROL = "runyth-cycle-token-hud";
const CONTROL_SELECTOR = ".control-icon, button, [role='button']";
const PORTRAIT_SIGNATURE = /runyth[\s_-]*cycle[\s_-]*portrait/i;
const PORTRAIT_LABEL = /(?:cycle[\s_-]*portrait|portrait[\s_-]*(?:cycle|hud|image)|portr[aä]t[\s_-]*(?:wechsel|zyklus)|change[\s_-]*portrait)/i;
const THEATRE_MASKS = /🎭|masks[-_ ]?(?:theater|theatre)|theat(?:er|re)[-_ ]?masks/i;

let observedHud = null;
let observedButton = null;
let observer = null;

function ownControl(node) {
  return node?.classList?.contains(TOKEN_CONTROL) ?? false;
}

function isControl(node) {
  return node?.matches?.(CONTROL_SELECTOR) ?? false;
}

function controls(hud) {
  if (!hud?.querySelectorAll) return [];
  return Array.from(hud.querySelectorAll(CONTROL_SELECTOR)).filter(node => {
    if (ownControl(node)) return false;
    // Don't treat nested icon buttons as independent controls.
    for (let parent = node.parentElement; parent && parent !== hud; parent = parent.parentElement) {
      if (isControl(parent)) return false;
    }
    return true;
  });
}

/** Collect identity data from native DOM only (never parse or execute HTML). */
function identity(node) {
  const pieces = [];
  const attrs = ["id", "title", "aria-label", "data-tooltip", "data-action", "data-module", "data-tooltip-text", "data-testid"];
  for (const item of [node, ...Array.from(node.querySelectorAll?.("img, svg, use, i, span") ?? [])]) {
    if (typeof item.className === "string") pieces.push(item.className);
    if (typeof item.title === "string") pieces.push(item.title);
    if (typeof item.id === "string") pieces.push(item.id);
    for (const key of attrs) pieces.push(item.getAttribute?.(key) ?? "");
    for (const key of ["src", "href", "alt", "style", "data-src"]) pieces.push(item.getAttribute?.(key) ?? "");
  }
  // Text is a last resort: an emoji may be drawn with an img/SVG instead.
  pieces.push(node.textContent ?? "");
  return pieces.filter(Boolean).join(" ");
}

function isUnrelatedControl(label) {
  return /token[\s_-]*hud[\s_-]*emotes|hud[\s_-]*emotes|token[\s_-]*emotes/i.test(label);
}

function portraitScore(node) {
  const label = identity(node);
  if (isUnrelatedControl(label)) return 0;
  // Class/id/asset URLs containing the exact module ID are definitive.
  if (PORTRAIT_SIGNATURE.test(label)) return 4;
  // Typical translated tooltip variants and portrait-specific icon assets.
  if (PORTRAIT_LABEL.test(label)) return 3;
  if (/portrait[-_/ ]?icon\.(?:svg|webp|png)|portrait[-_ ]?hud/i.test(label)) return 2;
  if (THEATRE_MASKS.test(label)) return 1;
  return 0;
}

function findPortraitHudControl(hud) {
  const candidates = controls(hud).map(node => ({ node, score: portraitScore(node) }));
  const best = Math.max(0, ...candidates.map(item => item.score));
  if (!best) return null;
  const winners = candidates.filter(item => item.score === best);
  // An ambiguous visual match is NOT sufficient to relocate the HUD control.
  return winners.length === 1 ? winners[0].node : null;
}

function reverseDirection(parent) {
  if (typeof getComputedStyle !== "function") return false;
  const styles = getComputedStyle(parent);
  return styles?.flexDirection === "column-reverse" || styles?.flexDirection === "row-reverse";
}

/** Move ONLY our button; respect reversed flexbox layouts. */
function positionAbovePortrait(hud, button) {
  if (!button || !hud?.contains?.(button)) return false;
  const portrait = findPortraitHudControl(hud);
  const target = portrait?.parentElement;
  if (!target || portrait === button || !hud.contains(portrait)) return false;

  // In column-reverse visual order is opposite DOM order. The literal
  // previousElementSibling assumption caused wrong visual ordering in HUDs.
  if (reverseDirection(target)) {
    if (portrait.nextElementSibling === button) return false;
    target.insertBefore(button, portrait.nextElementSibling);
  } else {
    if (portrait.previousElementSibling === button) return false;
    target.insertBefore(button, portrait);
  }
  return true;
}

function stopPortraitHudObservation() {
  observer?.disconnect();
  observer = null;
  observedHud = null;
  observedButton = null;
}

function syncPortraitHudOrder(hud, button) {
  if (!game.modules?.get(PORTRAIT_MODULE)?.active || !hud?.contains?.(button)) {
    stopPortraitHudObservation();
    return;
  }
  if (observedHud !== hud || observedButton !== button) {
    stopPortraitHudObservation();
    observedHud = hud;
    observedButton = button;
  }
  positionAbovePortrait(hud, button);
  if (!observer && typeof MutationObserver === "function") {
    observer = new MutationObserver(() => {
      if (observedHud === hud && observedButton === button && hud.contains(button)) {
        positionAbovePortrait(hud, button);
      }
    });
    observer.observe(hud, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "title", "aria-label", "src", "style", "data-tooltip"] });
  }
}
  __exports.findPortraitHudControl = findPortraitHudControl;
  __exports.positionAbovePortrait = positionAbovePortrait;
  __exports.stopPortraitHudObservation = stopPortraitHudObservation;
  __exports.syncPortraitHudOrder = syncPortraitHudOrder;
};

__factories["./layout.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const { ApplicationV2 } = foundry.applications.api;
const openWindows = new Set();
const t = key => game.i18n.localize(`RCT.${key}`);
const SIZE = Object.freeze({ window: { width: 660, height: 570 }, helpWindow: { width: 560, height: 560 } });

/** Keep windows on-screen after changes to display size or DPI. */
function restoredGeometry(saved, viewport = { width: 1920, height: 1080 }) {
  if (!Number.isFinite(saved?.width) || !Number.isFinite(saved?.height)) return null;
  const maxWidth = Math.max(250, (Number(viewport.width) || 1920) - 24);
  const maxHeight = Math.max(220, (Number(viewport.height) || 1080) - 24);
  const width = Math.max(Math.min(320, maxWidth), Math.min(maxWidth, saved.width));
  const height = Math.max(Math.min(280, maxHeight), Math.min(maxHeight, saved.height));
  const result = { width, height };
  if (Number.isFinite(saved.left)) result.left = Math.max(0, Math.min(maxWidth - width + 24, saved.left));
  if (Number.isFinite(saved.top)) result.top = Math.max(0, Math.min(maxHeight - height + 24, saved.top));
  return result;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function centeredDefaults(size, screen) {
  const width = Math.min(size.width, Math.max(250, screen.width - 24));
  const height = Math.min(size.height, Math.max(220, screen.height - 24));
  return {
    width, height,
    left: Math.max(0, (screen.width - width) / 2),
    top: Math.max(0, (screen.height - height) / 2),
  };
}

/** Shared ApplicationV2 persistence; _preClose is awaitable in v13, unlike _onClose. */
class RememberedWindow extends ApplicationV2 {
  static GEOMETRY_KEY = "window";

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    // v13 setPosition writes to the rendered frame element's style. In
    // _preFirstRender that element does not exist yet, causing the observed
    // 'Cannot read properties of undefined (reading style)' error.
    // _onFirstRender runs after the frame is created and is safe on reopen.
    const saved = game.settings.get(MODULE_ID, this.constructor.GEOMETRY_KEY);
    const screen = viewport();
    const geometry = restoredGeometry(saved, screen);
    this.setPosition(geometry ?? centeredDefaults(SIZE[this.constructor.GEOMETRY_KEY], screen));
    openWindows.add(this);
  }

  async _preClose(options) {
    const { width, height, left, top } = this.position;
    try {
      if (Number.isFinite(width) && Number.isFinite(height)) {
        await game.settings.set(MODULE_ID, this.constructor.GEOMETRY_KEY, { width, height, left, top });
      }
    } catch (error) { console.warn(`${MODULE_ID} | Window geometry could not be saved`, error); }
    await super._preClose(options);
  }

  _onClose(options) {
    openWindows.delete(this);
    super._onClose(options);
  }
}

async function resetLayout(key) {
  if (!Object.hasOwn(SIZE, key)) throw new Error(`Unknown geometry key: ${key}`);
  // Update any open instance so its close cannot restore the previous geometry.
  for (const app of openWindows) {
    if (app.constructor.GEOMETRY_KEY !== key) continue;
    app.setPosition(centeredDefaults(SIZE[key], viewport()));
  }
  await game.settings.set(MODULE_ID, key, {});
}

/** Native settings submenu; no ApplicationV1 or FormApplication dependency. */
class WindowLayoutSettings extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-layout-settings`,
    classes: ["runyth-cycle-token-layout"],
    window: { title: "Runyth Cycle Token — Window Layout", icon: "fa-solid fa-up-right-and-down-left-from-center", resizable: true },
    position: { width: 440, height: 275 },
  };

  async _renderHTML() {
    const root = document.createElement("section");
    root.className = "rct-layout-settings";
    const heading = document.createElement("p");
    heading.textContent = t("Layout.description");
    root.append(heading);
    for (const [key, labelKey] of [["window", "Layout.picker"], ["helpWindow", "Layout.help"]]) {
      const row = document.createElement("div");
      row.className = "rct-layout-row";
      const label = document.createElement("span");
      label.textContent = t(labelKey);
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = t("Layout.reset");
      reset.addEventListener("click", async () => {
        reset.disabled = true;
        try {
          await resetLayout(key);
          ui.notifications.info(t("Layout.done"));
        } catch (error) {
          ui.notifications.error(`${MODULE_ID}: ${error.message}`);
        } finally { reset.disabled = false; }
      });
      row.append(label, reset);
      root.append(row);
    }
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
  __exports.restoredGeometry = restoredGeometry;
  __exports.RememberedWindow = RememberedWindow;
  __exports.resetLayout = resetLayout;
  __exports.WindowLayoutSettings = WindowLayoutSettings;
};

__factories["./main.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {registerSettings, readSettings, migrateAdvancedMenuPreference} = __require("./settings.mjs");
const {CycleTokenWindow} = __require("./window.mjs");
const {CycleTokenHelp} = __require("./help.mjs");
const {setHudIcon} = __require("./hud-icons.mjs");
const {syncPortraitHudOrder, stopPortraitHudObservation} = __require("./hud-order.mjs");
const {WindowLayoutSettings} = __require("./layout.mjs");
const {ThumbnailSettingsWindow} = __require("./thumbnail-settings.mjs");
const {renderPrototypeSettings} = __require("./config.mjs");
const {applyTokenImage, canEdit, cycleToken, invalidateCatalog, listTokenImages, saveActorPattern} = __require("./service.mjs");
let windowInstance = null;
async function openForToken(token) {
  if (!canEdit(token)) throw new Error(game.i18n.localize("RCT.Errors.noPermission"));
  windowInstance ??= new CycleTokenWindow(token);
  await windowInstance.showToken(token);
  return windowInstance;
}

function renderHud(app, html) {
  const settings = readSettings();
  if (!settings.hud || !(html instanceof HTMLElement)) return;
  const token = app.object;
  if (!canEdit(token)) return;
  const target = html.querySelector(".col.right") ?? html.querySelector(".right") ?? html;
  let button = html.querySelector(`.${MODULE_ID}-hud`);
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = `control-icon ${MODULE_ID}-hud`;
    button.title = game.i18n.localize("RCT.Ui.open");
    button.setAttribute("aria-label", button.title);
    setHudIcon(button, settings.hudIcon);
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void openForToken(token).catch(error => ui.notifications.error(`${MODULE_ID}: ${error.message}`));
    });
    target.append(button);
  }
  syncPortraitHudOrder(html, button);
}

Hooks.once("init", () => {
  registerSettings({
    layoutMenuType: WindowLayoutSettings,
    helpMenuType: CycleTokenHelp,
    thumbnailMenuType: ThumbnailSettingsWindow,
    onAdvancedMenuChange: () => {
      if (windowInstance?.rendered) {
        void windowInstance.render().catch(error => ui.notifications.error(`${MODULE_ID}: ${error.message}`));
      }
    },
  });
  const module = game.modules.get(MODULE_ID);
  module.api = Object.freeze({
    openForToken, listTokenImages, applyTokenImage, cycleToken, saveActorPattern, invalidateCatalog,
  });
});

Hooks.on("renderTokenHUD", renderHud);
Hooks.once("ready", () => {
  void migrateAdvancedMenuPreference().catch(error => {
    console.warn(`${MODULE_ID} | Could not migrate advanced-view preference`, error);
  });
});
Hooks.on("renderPrototypeTokenConfig", renderPrototypeSettings);
Hooks.on("canvasTearDown", () => {
  stopPortraitHudObservation();
  if (windowInstance?.rendered) void windowInstance.close();
});
  __exports.openForToken = openForToken;
};

__factories["./presentation.mjs"] = (__require, __exports) => {
const {basename, IMAGE_EXTENSIONS} = __require("./core.mjs");
/** File display text is independent of storage paths, URLs and query strings. */
function imageDisplayName(path) {
  const rawFile = basename(path);
  let file = rawFile;
  try { file = decodeURIComponent(rawFile); } catch { /* Keep malformed percent-encoding readable. */ }
  const extension = IMAGE_EXTENSIONS.find(ext => file.toLowerCase().endsWith(ext));
  return extension ? file.slice(0, -extension.length) || file : file;
}

function imageTooltip(path, mode = "stem") {
  switch (mode) {
    case "none": return "";
    case "filename": return basename(path);
    case "path": return String(path);
    default: return imageDisplayName(path);
  }
}

/** Explain effects rather than exposing implementation switches as 'on/off'. */
function affectedTargets(settings, nativeRandom = false) {
  const destinations = [];
  if (settings.live) destinations.push("current");
  if (settings.live && settings.otherLive) destinations.push("scene");
  if (settings.prototype && !(nativeRandom && settings.wildcard === "preserve")) destinations.push("prototype");
  return destinations;
}
  __exports.imageDisplayName = imageDisplayName;
  __exports.imageTooltip = imageTooltip;
  __exports.affectedTargets = affectedTargets;
};

__factories["./search.mjs"] = (__require, __exports) => {
const {basename} = __require("./core.mjs");
// Compile at most once per filter change. Limit expensive patterns so a
// typo cannot lock a token HUD containing hundreds of image paths.
const MAX_PATTERN_LENGTH = 160;
const MAX_FILENAME_LENGTH = 255;

/** Pure, case-insensitive filename filtering; patterns do not inspect directory paths. */
function filterImagePaths(paths, query, regex = false) {
  const needle = String(query ?? "").trim();
  if (!needle) return { matches: paths, error: null };
  if (!regex) {
    const lower = needle.toLocaleLowerCase();
    return { matches: paths.filter(path => basename(path).toLocaleLowerCase().includes(lower)), error: null };
  }
  if (needle.length > MAX_PATTERN_LENGTH) return { matches: [], error: "tooLong" };
  // Reject common exponential-backtracking structures. This is deliberately
  // conservative: users may simplify a pattern if it contains nested repeats.
  if (/\\[1-9]/.test(needle) || /\((?:\\.|[^()])*[+*}](?:\\.|[^()])*\)\s*(?:[+*]|\{\d)/.test(needle) ||
      /\((?:\\.|[^()])*\|(?:\\.|[^()])*\)\s*(?:[+*]|\{\d)/.test(needle)) {
    return { matches: [], error: "unsafe" };
  }
  let pattern;
  try { pattern = new RegExp(needle, "i"); }
  catch { return { matches: [], error: "invalid" }; }
  return {
    matches: paths.filter(path => pattern.test(basename(path).slice(0, MAX_FILENAME_LENGTH))),
    error: null,
  };
}
  __exports.filterImagePaths = filterImagePaths;
};

__factories["./service.mjs"] = (__require, __exports) => {
const {MODULE_ID, assertAssetPath, hasWildcard, inferSource, isImage, normalizedImages, nextImage, policy} = __require("./core.mjs");
const {readSettings} = __require("./settings.mjs");
// Actor-scoped serialization prevents two tokens of the same Actor from racing to update its prototype.
const actorQueues = new Map();
const MAX_CACHED = 48;
const catalogCache = new Map();
const CACHE_MS = 15000;
const MAX_PARALLEL_TOKEN_WRITES = 24;
const localize = key => game.i18n.localize(`RCT.${key}`);

function baseActorOf(token) {
  const id = token?.document?.actorId;
  return id ? game.actors?.get(id) : null;
}

// World policy may be overridden by GM integrations, but never widened by player macros.
function effectiveSettings(settings) {
  return game.user?.isGM ? settings : readSettings();
}

function canEdit(token, { baseActor = baseActorOf(token) } = {}) {
  if (!token?.document || !baseActor || !game.user) return false;
  if (!game.user.isGM && !readSettings().owners) return false;
  return Boolean(game.user.isGM || (token.document.testUserPermission(game.user, "OWNER") && baseActor.testUserPermission(game.user, "OWNER")));
}

function resolveBrowse(path) {
  // S3 is represented explicitly. Other paths use Foundry's data source; external HTTPS is a single image.
  if (/^s3:\/\//i.test(path)) {
    const match = /^s3:\/\/([^/]+)\/(.*)$/i.exec(path);
    if (!match) throw new Error("S3 paths need a bucket and key.");
    return { source: "s3", target: match[2], bucket: match[1] };
  }
  return { source: "data", target: path, bucket: undefined };
}

async function listTokenImages(token, { refresh = false, settings = readSettings() } = {}) {
  settings = effectiveSettings(settings);
  if (!canEdit(token, { settings })) throw new Error(localize("Errors.noPermission"));
  const actor = baseActorOf(token);
  const source = inferSource({
    pattern: actor.getFlag(MODULE_ID, "pattern"),
    prototypePath: actor.prototypeToken?.texture?.src,
    randomImg: actor.prototypeToken?.randomImg,
    currentPath: token.document.texture?.src,
  });
  const path = source.path;
  const wildcard = hasWildcard(path);
  if (source.kind === "single" || (source.kind === "custom" && !wildcard && isImage(path))) {
    return [path];
  }
  if (/^https?:\/\//i.test(path)) throw new Error(localize("Errors.remotePattern"));
  const limit = Math.max(20, Math.min(2000, Number(settings.maxImages) || 400));
  const cacheKey = JSON.stringify([source.kind, path, limit]);
  const cached = catalogCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.time < CACHE_MS) return cached.images.slice();
  const picker = foundry.applications.apps.FilePicker.implementation;
  let nativeImages = null;
  // Foundry provides a dedicated, server-side resolver for prototype-token
  // wildcard images. It handles braces, glob patterns, and storage sources.
  // Unlike naive directory browsing, it also uses exactly the active Actor's
  // native prototype configuration.
  if (source.kind === "wildcard" && typeof picker.requestTokenImages === "function") {
    try {
      const resolved = await picker.requestTokenImages(actor.id);
      if (Array.isArray(resolved) && resolved.length) nativeImages = resolved;
    } catch (error) {
      // Fall back to the public wildcard browse API for storage providers where
      // the dedicated endpoint is unavailable; don't hide both failures.
      console.debug(`${MODULE_ID} | Native wildcard resolver unavailable; falling back to browse`, error);
    }
  }
  let files = nativeImages;
  if (!files) {
    const { source: storage, target, bucket } = resolveBrowse(path);
    const response = await picker.browse(storage, target, {
      ...(bucket ? { bucket } : {}),
      extensions: ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"],
      wildcard,
    });
    files = response?.files;
  }
  // Never inject the current token's image into a wildcard result: it could
  // have been assigned independently and not match the native prototype.
  const images = normalizedImages(files, {
    include: source.kind === "directory" ? token.document.texture?.src : "",
  });
  const bounded = images.slice(0, limit);
  // Never cache empty results: a user fixing the folder or wildcard should
  // see the new files on the next picker open without waiting for TTL.
  if (bounded.length) {
    if (catalogCache.size >= MAX_CACHED) catalogCache.delete(catalogCache.keys().next().value);
    catalogCache.set(cacheKey, { time: Date.now(), images: bounded });
  } else catalogCache.delete(cacheKey);
  return bounded.slice();
}

function invalidateCatalog() {
  catalogCache.clear();
}

function enqueueActor(actorId, task) {
  const previous = actorQueues.get(actorId) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  const settled = current.catch(() => {});
  actorQueues.set(actorId, settled);
  void settled.then(() => { if (actorQueues.get(actorId) === settled) actorQueues.delete(actorId); });
  return current;
}

/** Updates chosen Token Documents and the *base* Actor prototype without mutating its portrait. */
async function applyUnlocked(token, path, { settings, validate }) {
  settings = effectiveSettings(settings);
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  // The selected token must still exist in the active scene.
  if (!token.document.parent || canvas.scene?.id !== token.document.parent.id || !token.document.parent.tokens?.get(token.document.id)) {
    throw new Error(localize("Errors.staleToken"));
  }
  if (validate) {
    const candidates = await listTokenImages(token, { settings });
    if (!candidates.includes(path)) throw new Error(localize("Errors.notListed"));
    // World policy may change during I/O. Never apply a stale player policy snapshot.
    settings = effectiveSettings(settings);
    // Filesystem browse is asynchronous: the token may have been deleted or access revoked.
    if (!canEdit(token, { settings, baseActor: actor }) ||
        canvas.scene?.id !== token.document.parent?.id ||
        token.document.parent.tokens?.get(token.document.id) !== token.document) {
      throw new Error(localize("Errors.staleToken"));
    }
  }
  const desired = policy(settings);
  const wildcardProtected = desired.wildcard === "preserve" && actor.prototypeToken?.randomImg;
  const updatePrototype = desired.prototype && !wildcardProtected;
  const documents = desired.live ? [token.document] : [];
  if (desired.otherLive && desired.live) {
    // Explicit opt-in; only other tokens on this scene associated with the same base Actor.
    for (const doc of canvas.scene.tokens) {
      if (doc.id !== token.document.id && doc.actorId === actor.id && doc.actorLink === token.document.actorLink) {
        if (game.user.isGM || doc.testUserPermission(game.user, "OWNER")) documents.push(doc);
      }
    }
  }
  if (!documents.length && !updatePrototype) throw new Error(localize("Errors.nothingEnabled"));
  const changed = [];
  const oldPrototype = actor.prototypeToken?.texture?.src;
  const oldRandom = actor.prototypeToken?.randomImg;
  let protoDone = false;
  let wildcardPatternSaved = false;
  try {
    // When converting a native wildcard to a concrete prototype, retain the original
    // browsing pattern in this module so subsequent cycles do not broaden to the folder.
    if (updatePrototype && oldRandom && hasWildcard(oldPrototype) && !actor.getFlag(MODULE_ID, "pattern")) {
      await actor.setFlag(MODULE_ID, "pattern", oldPrototype);
      wildcardPatternSaved = true;
      invalidateCatalog();
    }
    // Update prototype first. Roll back all completed writes if a later write fails.
    if (updatePrototype && (oldPrototype !== path || oldRandom)) {
      await actor.update({ "prototypeToken.texture.src": path, "prototypeToken.randomImg": false });
      protoDone = true;
    }
    // Tokens are independent documents; write them concurrently rather than adding
    // one full network round-trip per matching token on large scenes. Record all
    // fulfilled writes so a partial failure can trigger compensating rollback.
    const pending = documents.filter(doc => doc.texture?.src !== path)
      .map(doc => ({ doc, previous: doc.texture?.src }));
    for (let start = 0; start < pending.length; start += MAX_PARALLEL_TOKEN_WRITES) {
      const batch = pending.slice(start, start + MAX_PARALLEL_TOKEN_WRITES);
      const results = await Promise.allSettled(batch.map(entry => entry.doc.update({ "texture.src": path })));
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") changed.push(batch[i]);
      }
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (let start = 0; start < changed.length; start += MAX_PARALLEL_TOKEN_WRITES) {
      const batch = changed.slice(start, start + MAX_PARALLEL_TOKEN_WRITES);
      const reversions = await Promise.allSettled(batch.map(entry =>
        entry.doc.update({ "texture.src": entry.previous })));
      for (const rollback of reversions) {
        if (rollback.status === "rejected") rollbackErrors.push(rollback.reason);
      }
    }
    if (protoDone) {
      try { await actor.update({ "prototypeToken.texture.src": oldPrototype, "prototypeToken.randomImg": oldRandom }); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (wildcardPatternSaved) {
      try { await actor.unsetFlag(MODULE_ID, "pattern"); invalidateCatalog(); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      console.error(`${MODULE_ID} | Rollback incomplete`, rollbackErrors);
      throw new Error(`${error.message} ${localize("Errors.rollbackIncomplete")}`, { cause: error });
    }
    throw error;
  }
  const result = Object.freeze({ actorId: actor.id, tokenId: token.document.id, image: path, updatedLive: changed.length, updatedPrototype: protoDone });
  if (changed.length || protoDone) {
    try { Hooks.callAll("runythCycleTokenImageChanged", result); }
    catch (error) { console.warn(`${MODULE_ID} | Downstream image-change hook failed`, error); }
  }
  return result;
}

/** Update selected token and prototype with actor-wide transaction serialization. */
async function applyTokenImage(token, imagePath, { settings = readSettings(), validate = true } = {}) {
  settings = effectiveSettings(settings);
  const path = assertAssetPath(imagePath);
  if (!isImage(path) || hasWildcard(path)) throw new Error(localize("Errors.notImage"));
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  return enqueueActor(actor.uuid ?? actor.id, () => applyUnlocked(token, path, {
    settings, validate: game.user?.isGM ? validate : true,
  }));
}

/** Cycle atomically based on the latest persisted texture, including overlapping API calls. */
async function cycleToken(token, delta = 1, { settings = readSettings(), ...options } = {}) {
  settings = effectiveSettings(settings);
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Cycle direction must be a nonzero integer.");
  return enqueueActor(actor.uuid ?? actor.id, async () => {
    const images = await listTokenImages(token, { ...options, settings });
    const selected = nextImage(images, token.document.texture?.src, delta);
    if (!selected) throw new Error(localize("Errors.noImages"));
    return applyUnlocked(token, selected, { settings, validate: false });
  });
}

async function saveActorPattern(actor, pattern) {
  if (!actor || !(game.user?.isGM || (readSettings().owners && actor.testUserPermission(game.user, "OWNER")))) {
    throw new Error(localize("Errors.noPermission"));
  }
  const trimmed = String(pattern ?? "").trim();
  // Validate before enqueueing, then recheck the current permissions at commit time.
  const path = trimmed ? assertAssetPath(trimmed) : "";
  if (path && !hasWildcard(path) && !isImage(path)) throw new Error(localize("Errors.badPattern"));
  return enqueueActor(actor.uuid ?? actor.id, async () => {
    if (!(game.user?.isGM || (readSettings().owners && actor.testUserPermission(game.user, "OWNER")))) {
      throw new Error(localize("Errors.noPermission"));
    }
    if (path) await actor.setFlag(MODULE_ID, "pattern", path);
    else await actor.unsetFlag(MODULE_ID, "pattern");
    invalidateCatalog();
  });
}
  __exports.baseActorOf = baseActorOf;
  __exports.canEdit = canEdit;
  __exports.listTokenImages = listTokenImages;
  __exports.invalidateCatalog = invalidateCatalog;
  __exports.applyTokenImage = applyTokenImage;
  __exports.cycleToken = cycleToken;
  __exports.saveActorPattern = saveActorPattern;
};

__factories["./settings.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {HUD_ICON_CHOICES, updateVisibleHudIcons} = __require("./hud-icons.mjs");
// Foundry v13 supports user scope: a player preference within this World,
// unlike client scope (which follows a browser across worlds).
const THUMBNAIL_SIZE = Object.freeze({ min: 85, max: 245, step: 10, default: 115 });

function normalizedThumbnailSize(value) {
  if (value === null || value === undefined || value === "") return THUMBNAIL_SIZE.default;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return THUMBNAIL_SIZE.default;
  const clamped = Math.max(THUMBNAIL_SIZE.min, Math.min(THUMBNAIL_SIZE.max, numeric));
  return THUMBNAIL_SIZE.min + Math.round((clamped - THUMBNAIL_SIZE.min) / THUMBNAIL_SIZE.step) * THUMBNAIL_SIZE.step;
}

/** Pure resolution of linked/independent dimensions. Zero is an unset advanced axis. */
function thumbnailDimensions({ size, advanced = false, width = 0, height = 0 } = {}) {
  const linked = normalizedThumbnailSize(size);
  const axis = value => Number.isFinite(Number(value)) && Number(value) > 0
    ? normalizedThumbnailSize(value) : linked;
  return {
    width: advanced ? axis(width) : linked,
    height: advanced ? axis(height) : linked,
  };
}

// Default to a fully opaque background; each user controls their own window surface.
const WINDOW_OPACITY = Object.freeze({ min: 0, max: 100, step: 5, default: 100 });

function normalizedWindowOpacity(value) {
  if (value === null || value === undefined || value === "") return WINDOW_OPACITY.default;
  const number = Number(value);
  if (!Number.isFinite(number)) return WINDOW_OPACITY.default;
  return WINDOW_OPACITY.min + Math.round((Math.max(WINDOW_OPACITY.min, Math.min(WINDOW_OPACITY.max, number)) - WINDOW_OPACITY.min) / WINDOW_OPACITY.step) * WINDOW_OPACITY.step;
}

/** Never set element.style.opacity: it would also fade token artwork.
 * Paint opacity is confined to the window background's CSS pseudo-element. */
function applyWindowBackdropOpacity(frame, value) {
  const opacity = normalizedWindowOpacity(value);
  frame?.style?.setProperty?.("--rct-window-surface-opacity", String(opacity / 100));
  frame?.classList?.toggle?.("rct-window-transparent", opacity === 0);
}

function updateVisibleWindowOpacity(value) {
  for (const frame of document.querySelectorAll(".runyth-cycle-token-window")) {
    applyWindowBackdropOpacity(frame, value);
  }
}

function readThumbnailPreferences() {
  const get = key => game.settings.get(MODULE_ID, key);
  return {
    size: normalizedThumbnailSize(get("thumbnailSize")),
    advanced: Boolean(get("thumbnailAdvanced")),
    width: get("thumbnailWidth"),
    height: get("thumbnailHeight"),
  };
}

/** Update CSS variables in place; do not refetch, rerender, or mutate Token documents. */
function updateVisibleThumbnailSize(preferences = readThumbnailPreferences()) {
  const { width, height } = thumbnailDimensions(preferences);
  for (const shell of document.querySelectorAll(".runyth-cycle-token-window .rct-shell")) {
    shell.style.setProperty("--rct-thumbnail-width", `${width}px`);
    shell.style.setProperty("--rct-thumbnail-height", `${height}px`);
  }
}

// onChange provides a new value before we can assume every mocked/remote
// setting store reflects it. Patch the appropriate dimension explicitly.
function onThumbnailChange(key) {
  return value => updateVisibleThumbnailSize({ ...readThumbnailPreferences(), [key]: value });
}

const SETTINGS = [
  ["enableHud", { type: Boolean, default: true }],
  // Keep the pre-0.2.5 shared value only as migration input. Never expose it
  // as an editable world-wide menu preference again.
  ["advancedMenu", { type: Boolean, default: false, config: false }],
  ["hudIcon", { type: String, default: "emoji-joker", choices: HUD_ICON_CHOICES, onChange: updateVisibleHudIcons }],
  ["allowOwners", { type: Boolean, default: true }],
  ["syncCurrent", { type: Boolean, default: true }],
  ["syncPrototype", { type: Boolean, default: true }],
  ["syncScene", { type: Boolean, default: false }],
  ["wildcardPolicy", { type: String, default: "preserve", choices: { selected: "RCT.Settings.wildcard.selected", preserve: "RCT.Settings.wildcard.preserve" } }],
  ["maxImages", { type: Number, default: 400, range: { min: 20, max: 2000, step: 20 } }],
];

function registerSettings({ layoutMenuType, helpMenuType, thumbnailMenuType, onAdvancedMenuChange } = {}) {
  for (const [key, definition] of SETTINGS) {
    game.settings.register(MODULE_ID, key, {
      name: `RCT.Settings.${key}.name`,
      hint: `RCT.Settings.${key}.hint`,
      scope: "world",
      config: true,
      ...definition,
      restricted: true,
    });
  }
  // Foundry 'user' scope stores a separate preference for each world user.
  game.settings.register(MODULE_ID, "advancedMenuUser", {
    name: "RCT.Settings.advancedMenu.name",
    hint: "RCT.Settings.advancedMenu.hint",
    scope: "user", config: true, type: Boolean, default: false,
    onChange: onAdvancedMenuChange,
  });
  game.settings.register(MODULE_ID, "advancedMenuMigrated", {
    scope: "user", config: false, type: Boolean, default: false,
  });
  // Per-browser preferences appear alongside the world settings for this module.
  game.settings.register(MODULE_ID, "showImageNames", {
    name: "RCT.Settings.showImageNames.name",
    hint: "RCT.Settings.showImageNames.hint",
    scope: "client", config: true, type: Boolean, default: false,
  });
  game.settings.register(MODULE_ID, "tooltipMode", {
    name: "RCT.Settings.tooltipMode.name",
    hint: "RCT.Settings.tooltipMode.hint",
    scope: "client", config: true, type: String, default: "stem",
    choices: {
      stem: "RCT.Settings.tooltip.stem",
      filename: "RCT.Settings.tooltip.filename",
      path: "RCT.Settings.tooltip.path",
      none: "RCT.Settings.tooltip.none",
    },
  });
  game.settings.register(MODULE_ID, "thumbnailSize", {
    name: "RCT.Settings.thumbnailSize.name",
    hint: "RCT.Settings.thumbnailSize.hint",
    scope: "user", config: false, type: Number,
    default: THUMBNAIL_SIZE.default,
    range: { min: THUMBNAIL_SIZE.min, max: THUMBNAIL_SIZE.max, step: THUMBNAIL_SIZE.step },
    onChange: onThumbnailChange("size"),
  });
  game.settings.register(MODULE_ID, "thumbnailAdvanced", {
    scope: "user", config: false, type: Boolean, default: false,
    onChange: onThumbnailChange("advanced"),
  });
  for (const key of ["thumbnailWidth", "thumbnailHeight"]) {
    game.settings.register(MODULE_ID, key, {
      scope: "user", config: false, type: Number, default: 0,
      onChange: onThumbnailChange(key === "thumbnailWidth" ? "width" : "height"),
    });
  }
  game.settings.register(MODULE_ID, "windowOpacity", {
    name: "RCT.Settings.windowOpacity.name",
    hint: "RCT.Settings.windowOpacity.hint",
    scope: "user", config: true, type: Number, default: WINDOW_OPACITY.default,
    range: { min: WINDOW_OPACITY.min, max: WINDOW_OPACITY.max, step: WINDOW_OPACITY.step },
    onChange: updateVisibleWindowOpacity,
  });
  if (thumbnailMenuType) game.settings.registerMenu(MODULE_ID, "thumbnailControls", {
    name: "RCT.Thumbnail.menuName",
    label: "RCT.Thumbnail.menuLabel",
    hint: "RCT.Thumbnail.menuHint",
    icon: "fa-solid fa-expand",
    type: thumbnailMenuType,
    restricted: false,
  });
  // The regex toggle is deliberately in the picker, not among the visible settings.
  game.settings.register(MODULE_ID, "regexSearch", {
    scope: "client", config: false, type: Boolean, default: false,
  });
  for (const name of ["window", "helpWindow"]) {
    game.settings.register(MODULE_ID, name, {
      scope: "client", config: false, type: Object, default: {},
    });
  }
  if (helpMenuType) game.settings.registerMenu(MODULE_ID, "helpGuide", {
    name: "RCT.HelpMenu.name",
    label: "RCT.HelpMenu.label",
    hint: "RCT.HelpMenu.hint",
    icon: "fa-solid fa-circle-question",
    type: helpMenuType,
    restricted: false,
  });
  if (layoutMenuType) game.settings.registerMenu(MODULE_ID, "resetWindowLayouts", {
    name: "RCT.Layout.menuName",
    label: "RCT.Layout.menuLabel",
    hint: "RCT.Layout.menuHint",
    icon: "fa-solid fa-up-right-and-down-left-from-center",
    type: layoutMenuType,
    restricted: false,
  });
}

/** Inherit the former world-wide choice once per user, without affecting
 * subsequent personal choices or other players. The old setting is read only. */
async function migrateAdvancedMenuPreference() {
  if (game.settings.get(MODULE_ID, "advancedMenuMigrated")) return false;
  const legacy = Boolean(game.settings.get(MODULE_ID, "advancedMenu"));
  if (legacy && !game.settings.get(MODULE_ID, "advancedMenuUser")) {
    await game.settings.set(MODULE_ID, "advancedMenuUser", true);
  }
  await game.settings.set(MODULE_ID, "advancedMenuMigrated", true);
  return legacy;
}

function readSettings() {
  const get = name => game.settings.get(MODULE_ID, name);
  return {
    hud: get("enableHud"),
    advancedMenu: get("advancedMenuUser"),
    hudIcon: get("hudIcon"),
    owners: get("allowOwners"),
    live: get("syncCurrent"),
    prototype: get("syncPrototype"),
    otherLive: get("syncScene"),
    wildcard: get("wildcardPolicy"),
    maxImages: get("maxImages"),
    windowOpacity: normalizedWindowOpacity(get("windowOpacity")),
    showImageNames: get("showImageNames"),
    tooltipMode: get("tooltipMode"),
    thumbnailSize: normalizedThumbnailSize(get("thumbnailSize")),
    thumbnailDimensions: thumbnailDimensions(readThumbnailPreferences()),
  };
}
  __exports.THUMBNAIL_SIZE = THUMBNAIL_SIZE;
  __exports.normalizedThumbnailSize = normalizedThumbnailSize;
  __exports.thumbnailDimensions = thumbnailDimensions;
  __exports.WINDOW_OPACITY = WINDOW_OPACITY;
  __exports.normalizedWindowOpacity = normalizedWindowOpacity;
  __exports.applyWindowBackdropOpacity = applyWindowBackdropOpacity;
  __exports.updateVisibleWindowOpacity = updateVisibleWindowOpacity;
  __exports.readThumbnailPreferences = readThumbnailPreferences;
  __exports.updateVisibleThumbnailSize = updateVisibleThumbnailSize;
  __exports.registerSettings = registerSettings;
  __exports.migrateAdvancedMenuPreference = migrateAdvancedMenuPreference;
  __exports.readSettings = readSettings;
};

__factories["./thumbnail-settings.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {THUMBNAIL_SIZE, normalizedThumbnailSize, readThumbnailPreferences, thumbnailDimensions, updateVisibleThumbnailSize} = __require("./settings.mjs");
const { ApplicationV2 } = foundry.applications.api;
const t = key => game.i18n.localize(`RCT.${key}`);

/** A per-user submenu avoids unsupported modifications to Foundry's settings form. */
class ThumbnailSettingsWindow extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-thumbnail-settings`,
    classes: ["runyth-cycle-token-thumbnail-settings"],
    window: { title: "Runyth Cycle Token — Thumbnail Sizes", icon: "fa-solid fa-expand", resizable: true },
    position: { width: 460, height: 360 },
  };

  async _renderHTML() {
    // Render from stored user settings whenever the submenu opens.
    const state = { ...readThumbnailPreferences() };
    const root = document.createElement("section");
    root.className = "rct-size-controls";
    const intro = document.createElement("p");
    intro.textContent = t("Thumbnail.description");
    root.append(intro);

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "rct-size-toggle";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = state.advanced;
    const toggleText = document.createElement("span");
    toggleText.textContent = t("Thumbnail.advanced");
    toggleLabel.append(toggle, toggleText);
    root.append(toggleLabel);

    const sliders = new Map();
    const makeSlider = (key, labelKey) => {
      const section = document.createElement("div");
      section.className = `rct-size-slider rct-size-${key}`;
      const label = document.createElement("label");
      const input = document.createElement("input");
      const output = document.createElement("output");
      const id = `rct-thumbnail-${key}`;
      input.id = id;
      label.htmlFor = id;
      label.append(document.createTextNode(t(labelKey)), output);
      input.type = "range";
      input.min = String(THUMBNAIL_SIZE.min);
      input.max = String(THUMBNAIL_SIZE.max);
      input.step = String(THUMBNAIL_SIZE.step);
      section.append(label, input);
      root.append(section);
      sliders.set(key, { section, input, output });
      return input;
    };
    makeSlider("size", "Thumbnail.both");
    makeSlider("width", "Thumbnail.width");
    makeSlider("height", "Thumbnail.height");

    const explain = document.createElement("p");
    explain.className = "rct-muted";
    explain.textContent = t("Thumbnail.hint");
    root.append(explain);

    const sync = () => {
      const dimensions = thumbnailDimensions(state);
      const values = { size: normalizedThumbnailSize(state.size), ...dimensions };
      for (const [key, { section, input, output }] of sliders) {
        // A zero-value independent axis inherits the previous linked size.
        input.value = String(values[key]);
        output.textContent = `${values[key]} px`;
        section.hidden = state.advanced ? key === "size" : key !== "size";
      }
      toggle.checked = state.advanced;
      updateVisibleThumbnailSize(state);
    };

    // Serialize user preference writes so fast interactions cannot leave a
    // stale user setting or reset an axis through an out-of-order callback.
    let sequence = Promise.resolve();
    const revisions = new Map();
    const changed = key => revisions.set(key, (revisions.get(key) ?? 0) + 1);
    const save = (name, value, stateKey) => {
      const revision = revisions.get(stateKey);
      sequence = sequence.catch(() => {}).then(async () => {
        try {
          await game.settings.set(MODULE_ID, name, value);
        } catch (error) {
          // Do not discard a newer user adjustment when an older request fails.
          if (revisions.get(stateKey) === revision) {
            state[stateKey] = name === "thumbnailAdvanced" ? Boolean(game.settings.get(MODULE_ID, name))
              : game.settings.get(MODULE_ID, name);
            sync();
          }
          ui.notifications.error(`${MODULE_ID}: ${error.message}`);
        }
      });
      return sequence;
    };

    toggle.addEventListener("change", () => {
      state.advanced = toggle.checked;
      changed("advanced");
      sync();
      void save("thumbnailAdvanced", state.advanced, "advanced");
    });
    for (const [key, { input }] of sliders) {
      // Live visual preview has zero server, image, or Token document I/O.
      input.addEventListener("input", () => {
        state[key] = normalizedThumbnailSize(input.value);
        changed(key);
        sync();
      });
      input.addEventListener("change", () => {
        state[key] = normalizedThumbnailSize(input.value);
        changed(key);
        sync();
        const name = key === "size" ? "thumbnailSize" : `thumbnail${key[0].toUpperCase()}${key.slice(1)}`;
        void save(name, state[key], key);
      });
    }
    sync();
    return root;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }
}
  __exports.ThumbnailSettingsWindow = ThumbnailSettingsWindow;
};

__factories["./window.mjs"] = (__require, __exports) => {
const {MODULE_ID} = __require("./core.mjs");
const {RememberedWindow} = __require("./layout.mjs");
const {openHelp} = __require("./help.mjs");
const {affectedTargets, imageDisplayName, imageTooltip} = __require("./presentation.mjs");
const {applyTokenImage, baseActorOf, canEdit, cycleToken, listTokenImages} = __require("./service.mjs");
const {applyWindowBackdropOpacity, readSettings} = __require("./settings.mjs");
const {filterImagePaths} = __require("./search.mjs");
const t = key => game.i18n.localize(`RCT.${key}`);
const GALLERY_PAGE_SIZE = 80;

function appliedMessage(result) {
  return t("Ui.applied")
    .replace("{live}", String(result.updatedLive))
    .replace("{prototype}", String(result.updatedPrototype ? 1 : 0));
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, icon, action, { disabled = false, title = label } = {}) {
  const node = element("button", "rct-button");
  node.type = "button";
  node.disabled = disabled;
  node.setAttribute("aria-label", label);
  node.title = title;
  const symbol = element("i", `fa-solid ${icon}`);
  symbol.setAttribute("aria-hidden", "true");
  node.append(symbol, element("span", "", label));
  node.addEventListener("click", action);
  return node;
}

class CycleTokenWindow extends RememberedWindow {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-window`,
    classes: ["runyth-cycle-token-window"],
    window: { title: "Runyth Cycle Token", icon: "fa-solid fa-images", resizable: true },
    position: { width: 660, height: 570 },
  };

  constructor(token) {
    super();
    this.token = token;
    this.images = [];
    this.loading = false;
    this.loaded = false;
    this.busy = false;
    this.search = "";
    this.regexMode = Boolean(game.settings.get(MODULE_ID, "regexSearch"));
    this.visibleCount = GALLERY_PAGE_SIZE;
    this.notice = "";
    this.revision = 0;
  }

  async showToken(token) {
    if (this.token?.document?.uuid !== token?.document?.uuid) {
      this.token = token;
      this.revision++;
      this.images = [];
      this.loaded = false;
      this.loading = false;
      this.visibleCount = GALLERY_PAGE_SIZE;
      this.search = "";
      this.notice = "";
    }
    if (!this.rendered) {
      this.loaded = false;
      this.loading = false;
    }
    await this.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    // The frame exists only after Foundry has completed its render lifecycle.
    // Change only the backdrop paint; never fade thumbnail image descendants.
    applyWindowBackdropOpacity(this.element, readSettings().windowOpacity);
    if (!this.loaded && !this.loading && canEdit(this.token)) void this.refreshImages();
  }

  async refreshImages(force = false) {
    if (this.loading) return;
    const rev = ++this.revision;
    const token = this.token;
    this.loading = true;
    this.notice = "";
    // The rendered status updates when the I/O settles; avoid nested render calls.
    try {
      const images = await listTokenImages(token, { refresh: force });
      if (rev !== this.revision || !this.rendered) return;
      this.images = images;
      this.visibleCount = GALLERY_PAGE_SIZE;
      this.loaded = true;
      if (!images.length) this.notice = t("Errors.noImages");
      else if (force) this.notice = t("Ui.refreshed");
    } catch (error) {
      if (rev !== this.revision || !this.rendered) return;
      this.loaded = true;
      this.notice = error.message;
      console.warn(`${MODULE_ID} | Cannot browse token images`, error);
    } finally {
      if (rev === this.revision) {
        this.loading = false;
        if (this.rendered) await this.render();
      }
    }
  }

  async apply(image) {
    if (this.busy || !canEdit(this.token)) return;
    this.busy = true;
    const token = this.token;
    try {
      const result = await applyTokenImage(token, image);
      if (token === this.token) this.notice = appliedMessage(result);
    } catch (error) {
      if (token === this.token) this.notice = error.message;
      ui.notifications.error(`${MODULE_ID}: ${error.message}`);
      console.error(`${MODULE_ID} | Image update failed`, error);
    } finally {
      this.busy = false;
      if (this.rendered && token === this.token) await this.render();
    }
  }

  async cycle(delta) {
    if (this.busy || !canEdit(this.token)) return;
    const token = this.token;
    this.busy = true;
    try {
      const result = await cycleToken(token, delta);
      if (token === this.token) this.notice = appliedMessage(result);
    } catch (error) {
      if (token === this.token) this.notice = error.message;
      ui.notifications.error(`${MODULE_ID}: ${error.message}`);
    } finally {
      this.busy = false;
      if (this.rendered && token === this.token) await this.render();
    }
  }

  async _renderHTML() {
    const settings = readSettings();
    const advanced = Boolean(settings.advancedMenu);
    const root = element("section", `rct-shell${advanced ? " rct-advanced" : " rct-simple"}`);
    // Both axes must be definite; "height: auto" on an image inside a flex
    // button can collapse to nearly zero in Foundry's window layout.
    root.style.setProperty("--rct-thumbnail-width", `${settings.thumbnailDimensions.width}px`);
    root.style.setProperty("--rct-thumbnail-height", `${settings.thumbnailDimensions.height}px`);
    const token = this.token;
    const active = token?.document?.texture?.src ?? "";
    const editable = canEdit(token);
    const disabled = this.busy || this.loading || !editable;
    let namesToggle;

    if (advanced) {
      const heading = element("div", "rct-heading");
      heading.append(element("strong", "", token?.name ?? t("Ui.noToken")));
      heading.append(element("span", "rct-muted", t("Ui.count").replace("{count}", String(this.images.length))));
      root.append(heading);

      const toolbar = element("div", "rct-toolbar");
      toolbar.append(
        button(t("Ui.previous"), "fa-arrow-left", () => void this.cycle(-1), { disabled: disabled || !this.images.length }),
        button(t("Ui.next"), "fa-arrow-right", () => void this.cycle(1), { disabled: disabled || !this.images.length }),
        button(t("Ui.refresh"), "fa-rotate", () => void this.refreshImages(true), { disabled: this.loading || this.busy, title: t("Ui.refreshHint") }),
        button(t("Ui.help"), "fa-circle-question", () => void openHelp()),
      );
      root.append(toolbar);

      const targets = affectedTargets(settings, Boolean(baseActorOf(token)?.prototypeToken?.randomImg));
      const destination = element("div", "rct-destinations");
      destination.append(element("strong", "", t("Ui.destinationHeading")));
      const descriptions = { current: "Ui.targetCurrent", scene: "Ui.targetScene", prototype: "Ui.targetPrototype" };
      destination.append(element("p", "", targets.length
        ? targets.map(key => t(descriptions[key])).join(" · ") : t("Ui.noDestinations")));
      root.append(destination);
      const status = element("p", "rct-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.textContent = this.loading ? t("Ui.loading") : this.notice;
      root.append(status);

      const namesLabel = element("label", "rct-names-toggle");
      namesToggle = element("input");
      namesToggle.type = "checkbox";
      namesToggle.checked = Boolean(settings.showImageNames);
      namesLabel.append(namesToggle, element("span", "", t("Ui.showNames")));
      root.append(namesLabel);
      namesToggle.addEventListener("change", async () => {
        const visible = namesToggle.checked;
        namesToggle.disabled = true;
        drawGallery();
        try { await game.settings.set(MODULE_ID, "showImageNames", visible); }
        catch (error) {
          namesToggle.checked = !visible;
          drawGallery();
          ui.notifications.error(`${t("Ui.preferenceFailed")}: ${error.message}`);
        } finally { namesToggle.disabled = false; }
      });
    }

    const searchRow = element("div", "rct-search-row");
    const search = element("input", "rct-search");
    search.type = "search";
    search.placeholder = t("Ui.search");
    search.setAttribute("aria-label", t("Ui.search"));
    search.value = this.search;
    const regexToggle = element("button", "rct-regex-toggle");
    regexToggle.type = "button";
    const regexIcon = element("i", "fa-solid fa-asterisk");
    regexIcon.setAttribute("aria-hidden", "true");
    regexToggle.append(regexIcon);
    const updateRegexButton = () => {
      regexToggle.setAttribute("aria-pressed", String(this.regexMode));
      regexToggle.setAttribute("aria-label", t(this.regexMode ? "Ui.regexDisable" : "Ui.regexEnable"));
      regexToggle.title = t(this.regexMode ? "Ui.regexDisable" : "Ui.regexEnable");
      regexToggle.classList.toggle("is-active", this.regexMode);
    };
    updateRegexButton();
    searchRow.append(search, regexToggle);
    root.append(searchRow);

    const gallery = element("div", "rct-gallery");
    gallery.setAttribute("role", "group");
    gallery.setAttribute("aria-label", t("Ui.gallery"));
    let currentMatches = [];
    const appendTiles = paths => {
      const fragment = document.createDocumentFragment();
      for (const path of paths) {
        const tile = element("button", `rct-tile${active === path ? " is-active" : ""}`);
        tile.type = "button";
        tile.disabled = disabled;
        const tooltip = imageTooltip(path, settings.tooltipMode);
        if (tooltip) tile.title = tooltip;
        tile.setAttribute("aria-label", imageDisplayName(path));
        tile.setAttribute("aria-pressed", String(active === path));
        const picture = element("img", "rct-thumbnail");
        picture.loading = "lazy";
        picture.decoding = "async";
        picture.alt = "";
        picture.src = path;
        tile.append(picture);
        if (advanced ? namesToggle.checked : settings.showImageNames) {
          tile.append(element("span", "rct-filename", imageDisplayName(path)));
        }
        tile.addEventListener("click", () => void this.apply(path));
        fragment.append(tile);
      }
      gallery.append(fragment);
    };
    const makeSetupGuide = () => {
      const guide = element("section", "rct-empty-guide");
      guide.setAttribute("role", "status");
      guide.append(element("strong", "", t("Empty.title")));
      guide.append(element("p", "", t("Empty.intro")));
      const steps = element("ol");
      for (const key of ["open", "path", "wildcard", "files", "reload"]) {
        steps.append(element("li", "", t(`Empty.${key}`)));
      }
      guide.append(steps, element("p", "rct-muted", t("Empty.alternative")));
      if (this.notice && this.notice !== t("Errors.noImages")) {
        guide.append(element("p", "rct-muted", this.notice));
      }
      return guide;
    };
    const drawGallery = () => {
      gallery.replaceChildren();
      const { matches, error } = filterImagePaths(this.images, this.search, this.regexMode);
      currentMatches = matches;
      search.setAttribute("aria-invalid", String(Boolean(error)));
      search.title = error ? t(`Ui.regexError.${error}`) : "";
      if (error) {
        const warning = element("p", "rct-search-error", t(`Ui.regexError.${error}`));
        warning.setAttribute("role", "alert");
        gallery.append(warning);
        return;
      }
      if (!matches.length) {
        if (this.loading || !this.loaded) gallery.append(element("p", "rct-muted", t("Ui.loading")));
        else if (!this.images.length) gallery.append(makeSetupGuide());
        else gallery.append(element("p", "rct-muted", t("Ui.noMatches")));
      }
      appendTiles(matches.slice(0, this.visibleCount));
      if (advanced && matches.length > this.visibleCount) {
        const remaining = matches.length - this.visibleCount;
        const more = button(t("Ui.more").replace("{count}", String(remaining)), "fa-chevron-down", () => {
          this.visibleCount += GALLERY_PAGE_SIZE;
          drawGallery();
        }, { disabled });
        more.classList.add("rct-more");
        gallery.append(more);
      }
    };
    // In the minimal view, scrolling loads more images without any large
    // paging button, recreating thumbnails or fetching additional listings.
    if (!advanced) gallery.addEventListener("scroll", () => {
      if (this.visibleCount >= currentMatches.length) return;
      if (gallery.scrollTop + gallery.clientHeight < gallery.scrollHeight - 160) return;
      const from = this.visibleCount;
      this.visibleCount = Math.min(currentMatches.length, from + GALLERY_PAGE_SIZE);
      appendTiles(currentMatches.slice(from, this.visibleCount));
    });
    search.addEventListener("input", event => {
      this.search = event.target.value;
      this.visibleCount = GALLERY_PAGE_SIZE;
      drawGallery();
    });
    regexToggle.addEventListener("click", async () => {
      if (regexToggle.disabled) return;
      this.regexMode = !this.regexMode;
      this.visibleCount = GALLERY_PAGE_SIZE;
      updateRegexButton();
      drawGallery();
      regexToggle.disabled = true;
      try { await game.settings.set(MODULE_ID, "regexSearch", this.regexMode); }
      catch (error) {
        this.regexMode = !this.regexMode;
        updateRegexButton();
        drawGallery();
        ui.notifications.error(`${t("Ui.preferenceFailed")}: ${error.message}`);
      } finally { regexToggle.disabled = false; }
    });
    drawGallery();
    root.append(gallery);
    if (advanced) {
      const footer = element("footer", "rct-footer");
      footer.append(element("small", "", t("Ui.imageSource")));
      footer.append(element("code", "rct-path", active || "—"));
      root.append(footer);
    }
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onClose(options) {
    // Invalidate any in-flight directory browse before the same instance reopens.
    this.revision++;
    this.loading = false;
    super._onClose(options);
  }
}
  __exports.CycleTokenWindow = CycleTokenWindow;
};

__require("./main.mjs");
