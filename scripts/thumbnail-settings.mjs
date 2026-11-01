import { MODULE_ID } from "./core.mjs";
import { THUMBNAIL_SIZE, normalizedThumbnailSize, readThumbnailPreferences, thumbnailDimensions, updateVisibleThumbnailSize } from "./settings.mjs";

const { ApplicationV2 } = foundry.applications.api;
const t = key => game.i18n.localize(`RCT.${key}`);

/** A per-user submenu avoids unsupported modifications to Foundry's settings form. */
export class ThumbnailSettingsWindow extends ApplicationV2 {
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
