// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID } from "./core.mjs";
import { RememberedWindow } from "./layout.mjs";

const t = key => game.i18n.localize(`RCT.${key}`);
let helpInstance = null;

export class CycleTokenHelp extends RememberedWindow {
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

export async function openHelp() {
  helpInstance ??= new CycleTokenHelp();
  await helpInstance.render(true);
  helpInstance.bringToFront();
  return helpInstance;
}
