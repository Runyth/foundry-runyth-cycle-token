// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { assertAssetPath, hasWildcard, inferSource, isImage, nextImage, normalizedImages, policy } from "../scripts/core.mjs";

test("rejects unsafe paths and traversal", () => {
  for (const path of ["", "file:///tmp/hi.png", "javascript:alert(1)", "images/../escape.png", "a\\b.png", "bad\nname.png"]) {
    assert.throws(() => assertAssetPath(path));
  }
  assert.equal(assertAssetPath("users/Hero/Body_*.webp"), "users/Hero/Body_*.webp");
});

test("recognizes image extensions and wildcards", () => {
  assert.equal(isImage("hero.WEBP?123"), true);
  assert.equal(isImage("hero.exe"), false);
  assert.equal(hasWildcard("/token/{head,body}?.png"), true);
  assert.equal(hasWildcard("/token/single.png"), false);
});

test("source priority: native wildcard, Actor override, current image folder", () => {
  assert.deepEqual(inferSource({ pattern: "a/*.png", prototypePath: "b/*", randomImg: true, currentPath: "c/1.png" }), { path: "b/*", kind: "wildcard" });
  assert.deepEqual(inferSource({ pattern: "a/*.png", prototypePath: "b/*", randomImg: false, currentPath: "c/1.png" }), { path: "a/*.png", kind: "custom" });
  assert.deepEqual(inferSource({ pattern: "", prototypePath: "b/*.webp", randomImg: true, currentPath: "c/1.png" }), { path: "b/*.webp", kind: "wildcard" });
  assert.deepEqual(inferSource({ pattern: "", prototypePath: "b/*.webp", randomImg: false, currentPath: "c/1.png" }), { path: "c", kind: "directory" });
  assert.deepEqual(inferSource({ currentPath: "https://example.net/1.png" }), { path: "https://example.net/1.png", kind: "single" });
});

test("deduplicates, filters and sorts naturally", () => {
  assert.deepEqual(normalizedImages(["a/10.png", "a/2.png", "a/2.png", "a/not.txt", "a/1.webp"]), ["a/1.webp", "a/2.png", "a/10.png"]);
});

test("cycles forwards/backwards, handles unlisted source and empty gallery", () => {
  const images = ["a.png", "b.png", "c.png"];
  assert.equal(nextImage(images, "c.png", 1), "a.png");
  assert.equal(nextImage(images, "a.png", -1), "c.png");
  assert.equal(nextImage(images, "not-in-set.png", 1), "a.png");
  assert.equal(nextImage(images, "not-in-set.png", -1), "c.png");
  assert.equal(nextImage([], "missing.png"), null);
});

test("normalizes updates with explicit default sync target policy", () => {
  assert.deepEqual(policy({ live: true, prototype: true, otherLive: false, wildcard: "selected" }), { live: true, prototype: true, otherLive: false, wildcard: "selected" });
  assert.equal(policy({ wildcard: "preserve" }).wildcard, "preserve");
});


test("HTTPS cache-busting queries are not glob patterns", () => {
  const image = "https://cdn.example.com/char.webp?token=abc123&v=2";
  assert.equal(hasWildcard(image), false);
  assert.equal(isImage(image), true);
  assert.equal(assertAssetPath(image), image);
  assert.deepEqual(inferSource({ currentPath: image }), { path: image, kind: "single" });
  assert.throws(() => assertAssetPath("https://cdn.example.com/*.png"));
});
