import { MODULE_ID } from "./core.mjs";
import { saveActorPattern } from "./service.mjs";
import { readSettings } from "./settings.mjs";
import { openHelp } from "./help.mjs";

const t = key => game.i18n.localize(`RCT.${key}`);

/** Supplement the Appearance tab without overriding core fields or form submission. */
export function renderPrototypeSettings(app, html) {
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
