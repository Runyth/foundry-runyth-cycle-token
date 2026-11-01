import { MODULE_ID } from "./core.mjs";

/** Fixed allowlist: icon setting values are never interpreted as arbitrary HTML or URLs. */
export const HUD_ICON_CHOICES = Object.freeze({
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

export function getIconDefinition(key) {
  return ICONS[key] ?? ICONS["emoji-joker"];
}

export function setHudIcon(button, iconKey) {
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
export function updateVisibleHudIcons(iconKey) {
  for (const button of document.querySelectorAll(`.${MODULE_ID}-hud`)) setHudIcon(button, iconKey);
}
