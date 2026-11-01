import { basename, IMAGE_EXTENSIONS } from "./core.mjs";

/** File display text is independent of storage paths, URLs and query strings. */
export function imageDisplayName(path) {
  const rawFile = basename(path);
  let file = rawFile;
  try { file = decodeURIComponent(rawFile); } catch { /* Keep malformed percent-encoding readable. */ }
  const extension = IMAGE_EXTENSIONS.find(ext => file.toLowerCase().endsWith(ext));
  return extension ? file.slice(0, -extension.length) || file : file;
}

export function imageTooltip(path, mode = "stem") {
  switch (mode) {
    case "none": return "";
    case "filename": return basename(path);
    case "path": return String(path);
    default: return imageDisplayName(path);
  }
}

/** Explain effects rather than exposing implementation switches as 'on/off'. */
export function affectedTargets(settings, nativeRandom = false) {
  const destinations = [];
  if (settings.live) destinations.push("current");
  if (settings.live && settings.otherLive) destinations.push("scene");
  if (settings.prototype && !(nativeRandom && settings.wildcard === "preserve")) destinations.push("prototype");
  return destinations;
}
