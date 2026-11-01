// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { basename } from "./core.mjs";

// Compile at most once per filter change. Limit expensive patterns so a
// typo cannot lock a token HUD containing hundreds of image paths.
const MAX_PATTERN_LENGTH = 160;
const MAX_FILENAME_LENGTH = 255;

/** Pure, case-insensitive filename filtering; patterns do not inspect directory paths. */
export function filterImagePaths(paths, query, regex = false) {
  const needle = String(query ?? "").trim();
  if (!needle) return { matches: paths, error: null };
  if (!regex) {
    const lower = needle.toLocaleLowerCase();
    return { matches: paths.filter(path => basename(path).toLocaleLowerCase().includes(lower)), error: null };
  }
  if (needle.length > MAX_PATTERN_LENGTH) return { matches: [], error: "tooLong" };
  // Reject common exponential-backtracking structures. This is deliberately
  // conservative: users may simplify a pattern if it contains nested repeats.
  if (/\\[1-9]/.test(needle) || /\((?:\\.|[^()])*[+*}](?:\\.|[^()])*\)\s*(?:[+*]|\{\d)/.test(needle) ||
      /\((?:\\.|[^()])*\|(?:\\.|[^()])*\)\s*(?:[+*]|\{\d)/.test(needle)) {
    return { matches: [], error: "unsafe" };
  }
  let pattern;
  try { pattern = new RegExp(needle, "i"); }
  catch { return { matches: [], error: "invalid" }; }
  return {
    matches: paths.filter(path => pattern.test(basename(path).slice(0, MAX_FILENAME_LENGTH))),
    error: null,
  };
}
