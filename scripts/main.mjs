// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "./core.mjs";
import { registerSettings, readSettings, migrateAdvancedMenuPreference } from "./settings.mjs";
import { CycleTokenWindow } from "./window.mjs";
import { CycleTokenHelp } from "./help.mjs";
import { setHudIcon } from "./hud-icons.mjs";
import { syncPortraitHudOrder, stopPortraitHudObservation } from "./hud-order.mjs";
import { WindowLayoutSettings } from "./layout.mjs";
import { ThumbnailSettingsWindow } from "./thumbnail-settings.mjs";
import { renderPrototypeSettings } from "./config.mjs";
import { applyTokenImage, canEdit, cycleToken, invalidateCatalog, listTokenImages, saveActorPattern } from "./service.mjs";

let windowInstance = null;
export async function openForToken(token) {
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
