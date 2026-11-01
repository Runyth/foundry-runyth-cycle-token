// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
/** Pure helpers used by the Runyth Cycle Token runtime and tests. */
export const MODULE_ID = "runyth-cycle-token";
export const IMAGE_EXTENSIONS = Object.freeze([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const INVALID_PROTOCOL = /^(?:javascript|data|blob|file):/i;
const KNOWN_PROTOCOL = /^[a-z][a-z\d+.-]*:/i;

export function assertAssetPath(value) {
  if (typeof value !== "string") throw new Error("Image path must be a string.");
  const path = value.trim();
  if (!path || path.length > 2048 || /[\u0000-\u001f\\<>]/.test(path) || INVALID_PROTOCOL.test(path)) {
    throw new Error("Unsupported or unsafe image path.");
  }
  // Remote images may be used as a single file, never as a browsed directory.
  if (KNOWN_PROTOCOL.test(path) && !/^https?:\/\//i.test(path) && !/^s3:\/\//i.test(path)) {
    throw new Error("Unsupported image path protocol.");
  }
  if (path.split(/[/?#]/).some(part => part === "..")) throw new Error("Parent directory paths are not allowed.");
  // Remote query parameters are valid, but glob characters in remote filenames are not.
  if (/^https?:\/\//i.test(path) && /[*{}\[\]]/.test(path.split(/[?#]/, 1)[0])) {
    throw new Error("Remote wildcard paths are not supported.");
  }
  return path;
}

export function hasWildcard(path) {
  // Query parameters on HTTP(S) image URLs are not filesystem globs.
  if (/^https?:\/\//i.test(path)) return false;
  return /[*?{}\[\]]/.test(path);
}

export function isImage(path) {
  const basename = String(path).split(/[?#]/, 1)[0].toLowerCase();
  return IMAGE_EXTENSIONS.some(extension => basename.endsWith(extension));
}

export function inferSource({ pattern, prototypePath, randomImg, currentPath }) {
  // Foundry native wildcard configuration is authoritative while enabled,
  // even if this module retained an older custom-pattern override.
  if (randomImg && typeof prototypePath === "string" && hasWildcard(prototypePath)) {
    return { path: assertAssetPath(prototypePath), kind: "wildcard" };
  }
  if (typeof pattern === "string" && pattern.trim()) return { path: assertAssetPath(pattern), kind: "custom" };
  if (typeof currentPath !== "string" || !currentPath.trim()) throw new Error("Token has no image path.");
  const path = assertAssetPath(currentPath);
  if (/^https?:\/\//i.test(path)) return { path, kind: "single" };
  const last = path.lastIndexOf("/");
  if (last < 0) return { path: "", kind: "directory" };
  return { path: path.slice(0, last), kind: "directory" };
}

export function normalizedImages(files, { include = "" } = {}) {
  const images = new Set();
  for (const value of files ?? []) {
    if (typeof value !== "string") continue;
    try {
      const path = assertAssetPath(value);
      if (isImage(path)) images.add(path);
    } catch { /* Ignore files that the server cannot safely display. */ }
  }
  if (include && isImage(include)) {
    try { images.add(assertAssetPath(include)); } catch { /* Ignore invalid current paths. */ }
  }
  return [...images].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }) || (a < b ? -1 : 1));
}

export function nextImage(images, active, delta = 1) {
  if (!Array.isArray(images) || !images.length) return null;
  const index = images.indexOf(active);
  const start = index === -1 ? (delta >= 0 ? -1 : 0) : index;
  return images[((start + delta) % images.length + images.length) % images.length];
}

export function basename(path) {
  return String(path).split(/[?#]/, 1)[0].split("/").at(-1) || path;
}

export function policy(settings) {
  return {
    live: settings.live !== false,
    prototype: settings.prototype !== false,
    otherLive: settings.otherLive === true,
    wildcard: settings.wildcard === "preserve" ? "preserve" : "selected",
  };
}
