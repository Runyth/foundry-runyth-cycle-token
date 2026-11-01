// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { findPortraitHudControl, positionAbovePortrait, syncPortraitHudOrder, stopPortraitHudObservation } from "../scripts/hud-order.mjs";

class Node {
  constructor(name = "div", className = "", title = "", text = "") {
    this.tagName = name;
    this.className = className;
    this.title = title;
    this.ownText = text;
    this.children = [];
    this.parentElement = null;
    this.id = "";
    this.attrs = new Map();
    this.classList = { contains: name => this.className.split(" ").includes(name) };
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    return this.parentElement.children[this.parentElement.children.indexOf(this) + 1] ?? null;
  }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    return this.parentElement.children[this.parentElement.children.indexOf(this) - 1] ?? null;
  }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  matches(selector) {
    return selector.split(",").some(s => {
      const part = s.trim();
      return part === "button" && this.tagName === "button"
        || part === "[role=\'button\']" && this.attrs.get("role") === "button"
        || part.startsWith(".") && this.classList.contains(part.slice(1))
        || part === this.tagName;
    });
  }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, following) {
    if (node.parentElement) {
      const index = node.parentElement.children.indexOf(node);
      node.parentElement.children.splice(index, 1);
    }
    const index = following ? this.children.indexOf(following) : this.children.length;
    assert.notEqual(index, -1);
    this.children.splice(index, 0, node);
    node.parentElement = this;
  }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  querySelectorAll(selector) {
    const result = [];
    const selectors = selector.split(",").map(s => s.trim());
    const visit = node => {
      for (const child of node.children) {
        if (selectors.some(s => child.matches(s))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const observations = [];
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; this.disconnected = false; observations.push(this); }
  observe(root, options) { this.root = root; this.options = options; }
  disconnect() { this.disconnected = true; }
  fire() { if (!this.disconnected) this.callback([]); }
};
const portrait = { active: true };
globalThis.game = { modules: new Map([["runyth-cycle-portrait", portrait]]) };

function hud() {
  const root = new Node();
  const column = new Node("div", "col right");
  root.append(column);
  return { root, column };
}
function ownButton() { return new Node("button", "control-icon runyth-cycle-token-hud", "Cycle token image", "🃏"); }
function portraitButton(label = "") { return new Node("button", "control-icon", label, "🎭"); }
function titles(column) { return column.children.map(node => node.title || node.textContent); }

test.beforeEach(() => { stopPortraitHudObservation(); portrait.active = true; });
test.after(() => stopPortraitHudObservation());

test("default companion position is directly above an existing portrait control", () => {
  const { root, column } = hud();
  const other = new Node("button", "control-icon", "Other", "○");
  const masks = portraitButton("Runyth Cycle Portrait");
  const own = ownButton();
  column.append(other, masks, own);
  syncPortraitHudOrder(root, own);
  assert.deepEqual(titles(column), ["Other", "Cycle token image", "Runyth Cycle Portrait"]);
  assert.equal(findPortraitHudControl(root), masks);
  assert.equal(positionAbovePortrait(root, own), false, "already adjacent, no unnecessary DOM move");
});

test("late-arriving masks-only portrait button triggers ordering without HUD rerender", () => {
  const { root, column } = hud();
  const own = ownButton();
  const other = new Node("button", "control-icon", "Other", "◉");
  column.append(own, other);
  syncPortraitHudOrder(root, own);
  const watcher = observations.at(-1);
  assert.equal(watcher.root, root);
  assert.equal(watcher.options.subtree, true);
  const masks = portraitButton();
  column.append(masks);
  watcher.fire();
  assert.equal(masks.previousElementSibling, own);
  assert.equal(own.parentElement, column);
  watcher.fire();
  assert.equal(column.children.filter(node => node === own).length, 1);
  // A separate hook later inserts a control between ours and Portrait.
  column.insertBefore(new Node("button", "control-icon", "Third-party", "!"), masks);
  watcher.fire();
  assert.equal(masks.previousElementSibling, own);
});

test("repeated HUD renders reuse one observer and teardown disconnects it", () => {
  const { root, column } = hud();
  const own = ownButton();
  column.append(own);
  syncPortraitHudOrder(root, own);
  const watcher = observations.at(-1);
  syncPortraitHudOrder(root, own);
  assert.equal(observations.at(-1), watcher);
  const next = hud();
  const nextButton = ownButton();
  next.column.append(nextButton);
  syncPortraitHudOrder(next.root, nextButton);
  assert.equal(watcher.disconnected, true);
  stopPortraitHudObservation();
  assert.equal(observations.at(-1).disconnected, true);
});

test("inactive companion and unrelated theatre emoji never cause moves", () => {
  const { root, column } = hud();
  const masks = portraitButton();
  const own = ownButton();
  column.append(masks, own);
  portrait.active = false;
  syncPortraitHudOrder(root, own);
  assert.equal(column.children[0], masks);
  portrait.active = true;
  column.append(portraitButton());
  assert.equal(findPortraitHudControl(root), null, "ambiguous masks must not be misidentified");
  assert.equal(positionAbovePortrait(root, own), false);
});

test("explicitly identified portrait wins over another theatre-mask control", () => {
  const { root, column } = hud();
  const emotes = portraitButton("Token HUD Emotes");
  const masks = portraitButton();
  masks.className = "control-icon runyth-cycle-portrait-hud";
  const own = ownButton();
  column.append(emotes, masks, own);
  syncPortraitHudOrder(root, own);
  assert.equal(masks.previousElementSibling, own);
  assert.equal(emotes.parentElement, column);
});

test("Token HUD Emotes masks alone are never mistaken for Cycle Portrait", () => {
  const { root, column } = hud();
  const emotes = portraitButton("Token HUD Emotes");
  const own = ownButton();
  column.append(emotes, own);
  assert.equal(findPortraitHudControl(root), null);
  assert.equal(positionAbovePortrait(root, own), false);
});


test("Portrait icon asset URL identifies the real companion even without text or tooltip", () => {
  const {root, column} = hud();
  const emotes = portraitButton("Token HUD Emotes");
  const portraitControl = new Node("div", "control-icon");
  const img = new Node("img");
  img.attrs.set("src", "/modules/runyth-cycle-portrait/img/portrait-icon.svg");
  portraitControl.append(img);
  const own = ownButton();
  column.append(emotes, portraitControl, own);
  assert.equal(findPortraitHudControl(root), portraitControl);
  syncPortraitHudOrder(root, own);
  assert.equal(portraitControl.previousElementSibling, own);
  assert.equal(emotes.parentElement, column);
});

test("Portrait nested icon is not mistaken for an independent control", () => {
  const {root, column} = hud();
  const wrapper = new Node("div", "control-icon");
  const nestedButton = new Node("button", "", "Portrait picker", "🎭");
  wrapper.append(nestedButton);
  const own = ownButton();
  column.append(wrapper, own);
  assert.equal(findPortraitHudControl(root), wrapper);
  syncPortraitHudOrder(root, own);
  assert.equal(wrapper.previousElementSibling, own);
});

test("reversed flex column positions token control visually ABOVE portrait", () => {
  const {root, column} = hud();
  const own = ownButton();
  const masks = portraitButton("Runyth Cycle Portrait");
  column.append(own, masks);
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({flexDirection: "column-reverse"});
  try {
    syncPortraitHudOrder(root, own);
    assert.equal(masks.nextElementSibling, own);
    assert.equal(masks.previousElementSibling, null);
    assert.equal(positionAbovePortrait(root, own), false);
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

test("same HUD with separate columns relocates token control into Portrait column", () => {
  const {root, column} = hud();
  const left = new Node("div", "col left");
  root.append(left);
  const own = ownButton();
  const masks = portraitButton("Runyth Cycle Portrait");
  column.append(own);
  left.append(masks);
  syncPortraitHudOrder(root, own);
  assert.equal(own.parentElement, left);
  assert.equal(masks.previousElementSibling, own);
});

test("late-arriving companion image control reorders through MutationObserver", () => {
  const {root, column} = hud();
  const own = ownButton();
  column.append(own);
  syncPortraitHudOrder(root, own);
  const watcher = observations.at(-1);
  const masks = new Node("div", "control-icon");
  masks.attrs.set("data-tooltip", "Cycle portrait");
  column.append(masks);
  watcher.fire();
  assert.equal(masks.previousElementSibling, own);
  assert.equal(watcher.options.attributes, true);
  assert.ok(watcher.options.attributeFilter.includes("src"));
});

test("ambiguous portrait candidates do not reorder unrelated HUD controls", () => {
  const {root, column} = hud();
  const masksA = portraitButton();
  const masksB = portraitButton();
  const own = ownButton();
  column.append(masksA, masksB, own);
  assert.equal(findPortraitHudControl(root), null);
  syncPortraitHudOrder(root, own);
  assert.equal(own.parentElement, column);
  assert.deepEqual(column.children, [masksA,masksB,own]);
});
