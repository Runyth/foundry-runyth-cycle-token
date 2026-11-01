import { MODULE_ID } from "./core.mjs";
import { RememberedWindow } from "./layout.mjs";
import { openHelp } from "./help.mjs";
import { affectedTargets, imageDisplayName, imageTooltip } from "./presentation.mjs";
import { applyTokenImage, baseActorOf, canEdit, cycleToken, listTokenImages } from "./service.mjs";
import { applyWindowBackdropOpacity, readSettings } from "./settings.mjs";
import { filterImagePaths } from "./search.mjs";

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

export class CycleTokenWindow extends RememberedWindow {
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
