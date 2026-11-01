import test from "node:test";
import assert from "node:assert/strict";
import { filterImagePaths } from "../scripts/search.mjs";

const paths = [
  "tokens/Hero_01.webp", "tokens/hero_02.PNG", "tokens/Bandit-3.png",
  "other/Hero.png?cache=1", "tokens/Special (black).webp",
];

test("simple search is the default, case insensitive and matches filenames only", () => {
  assert.deepEqual(filterImagePaths(paths, "hero").matches, paths.filter((_, i) => [0, 1, 3].includes(i)));
  assert.deepEqual(filterImagePaths(paths, "tokens").matches, []);
  assert.deepEqual(filterImagePaths(paths, "(black)").matches, [paths[4]]);
  assert.equal(filterImagePaths(paths, " ").matches, paths);
});

test("regex search uses case-insensitive JavaScript expressions on filenames", () => {
  assert.deepEqual(filterImagePaths(paths, String.raw`^hero_\d{2}\.(png|webp)$`, true).matches, paths.slice(0, 2));
  assert.deepEqual(filterImagePaths(paths, "^bandit-[0-9]+\\.png$", true).matches, [paths[2]]);
  assert.deepEqual(filterImagePaths(paths, String.raw`\(black\)`, true).matches, [paths[4]]);
});

test("invalid or excessive regular expressions fail closed without throwing", () => {
  assert.deepEqual(filterImagePaths(paths, "[", true), { matches: [], error: "invalid" });
  assert.deepEqual(filterImagePaths(paths, "a".repeat(161), true), { matches: [], error: "tooLong" });
  assert.deepEqual(filterImagePaths(paths, "(a+)+$", true), { matches: [], error: "unsafe" });
  assert.deepEqual(filterImagePaths(paths, String.raw`(a)\1`, true), { matches: [], error: "unsafe" });
  assert.deepEqual(filterImagePaths(paths, "(a|aa)+$", true), { matches: [], error: "unsafe" });
});
