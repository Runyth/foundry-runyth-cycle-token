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

export function findPortraitHudControl(hud) {
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
export function positionAbovePortrait(hud, button) {
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

export function stopPortraitHudObservation() {
  observer?.disconnect();
  observer = null;
  observedHud = null;
  observedButton = null;
}

export function syncPortraitHudOrder(hud, button) {
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
