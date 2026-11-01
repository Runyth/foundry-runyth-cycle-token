// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "./core.mjs";

const { ApplicationV2 } = foundry.applications.api;
const openWindows = new Set();
const t = key => game.i18n.localize(`RCT.${key}`);
const SIZE = Object.freeze({ window: { width: 660, height: 570 }, helpWindow: { width: 560, height: 560 } });

/** Keep windows on-screen after changes to display size or DPI. */
export function restoredGeometry(saved, viewport = { width: 1920, height: 1080 }) {
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
export class RememberedWindow extends ApplicationV2 {
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

export async function resetLayout(key) {
  if (!Object.hasOwn(SIZE, key)) throw new Error(`Unknown geometry key: ${key}`);
  // Update any open instance so its close cannot restore the previous geometry.
  for (const app of openWindows) {
    if (app.constructor.GEOMETRY_KEY !== key) continue;
    app.setPosition(centeredDefaults(SIZE[key], viewport()));
  }
  await game.settings.set(MODULE_ID, key, {});
}

/** Native settings submenu; no ApplicationV1 or FormApplication dependency. */
export class WindowLayoutSettings extends ApplicationV2 {
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
