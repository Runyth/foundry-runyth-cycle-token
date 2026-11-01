import { MODULE_ID } from "./core.mjs";
import { HUD_ICON_CHOICES, updateVisibleHudIcons } from "./hud-icons.mjs";

// Foundry v13 supports user scope: a player preference within this World,
// unlike client scope (which follows a browser across worlds).
export const THUMBNAIL_SIZE = Object.freeze({ min: 85, max: 245, step: 10, default: 115 });

export function normalizedThumbnailSize(value) {
  if (value === null || value === undefined || value === "") return THUMBNAIL_SIZE.default;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return THUMBNAIL_SIZE.default;
  const clamped = Math.max(THUMBNAIL_SIZE.min, Math.min(THUMBNAIL_SIZE.max, numeric));
  return THUMBNAIL_SIZE.min + Math.round((clamped - THUMBNAIL_SIZE.min) / THUMBNAIL_SIZE.step) * THUMBNAIL_SIZE.step;
}

/** Pure resolution of linked/independent dimensions. Zero is an unset advanced axis. */
export function thumbnailDimensions({ size, advanced = false, width = 0, height = 0 } = {}) {
  const linked = normalizedThumbnailSize(size);
  const axis = value => Number.isFinite(Number(value)) && Number(value) > 0
    ? normalizedThumbnailSize(value) : linked;
  return {
    width: advanced ? axis(width) : linked,
    height: advanced ? axis(height) : linked,
  };
}

// Default to a fully opaque background; each user controls their own window surface.
export const WINDOW_OPACITY = Object.freeze({ min: 0, max: 100, step: 5, default: 100 });

export function normalizedWindowOpacity(value) {
  if (value === null || value === undefined || value === "") return WINDOW_OPACITY.default;
  const number = Number(value);
  if (!Number.isFinite(number)) return WINDOW_OPACITY.default;
  return WINDOW_OPACITY.min + Math.round((Math.max(WINDOW_OPACITY.min, Math.min(WINDOW_OPACITY.max, number)) - WINDOW_OPACITY.min) / WINDOW_OPACITY.step) * WINDOW_OPACITY.step;
}

/** Never set element.style.opacity: it would also fade token artwork.
 * Paint opacity is confined to the window background's CSS pseudo-element. */
export function applyWindowBackdropOpacity(frame, value) {
  const opacity = normalizedWindowOpacity(value);
  frame?.style?.setProperty?.("--rct-window-surface-opacity", String(opacity / 100));
  frame?.classList?.toggle?.("rct-window-transparent", opacity === 0);
}

export function updateVisibleWindowOpacity(value) {
  for (const frame of document.querySelectorAll(".runyth-cycle-token-window")) {
    applyWindowBackdropOpacity(frame, value);
  }
}

export function readThumbnailPreferences() {
  const get = key => game.settings.get(MODULE_ID, key);
  return {
    size: normalizedThumbnailSize(get("thumbnailSize")),
    advanced: Boolean(get("thumbnailAdvanced")),
    width: get("thumbnailWidth"),
    height: get("thumbnailHeight"),
  };
}

/** Update CSS variables in place; do not refetch, rerender, or mutate Token documents. */
export function updateVisibleThumbnailSize(preferences = readThumbnailPreferences()) {
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

export function registerSettings({ layoutMenuType, helpMenuType, thumbnailMenuType, onAdvancedMenuChange } = {}) {
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
export async function migrateAdvancedMenuPreference() {
  if (game.settings.get(MODULE_ID, "advancedMenuMigrated")) return false;
  const legacy = Boolean(game.settings.get(MODULE_ID, "advancedMenu"));
  if (legacy && !game.settings.get(MODULE_ID, "advancedMenuUser")) {
    await game.settings.set(MODULE_ID, "advancedMenuUser", true);
  }
  await game.settings.set(MODULE_ID, "advancedMenuMigrated", true);
  return legacy;
}

export function readSettings() {
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
