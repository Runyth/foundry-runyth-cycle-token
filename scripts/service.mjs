import { MODULE_ID, assertAssetPath, hasWildcard, inferSource, isImage, normalizedImages, nextImage, policy } from "./core.mjs";
import { readSettings } from "./settings.mjs";

// Actor-scoped serialization prevents two tokens of the same Actor from racing to update its prototype.
const actorQueues = new Map();
const MAX_CACHED = 48;
const catalogCache = new Map();
const CACHE_MS = 15000;
const MAX_PARALLEL_TOKEN_WRITES = 24;
const localize = key => game.i18n.localize(`RCT.${key}`);

export function baseActorOf(token) {
  const id = token?.document?.actorId;
  return id ? game.actors?.get(id) : null;
}

// World policy may be overridden by GM integrations, but never widened by player macros.
function effectiveSettings(settings) {
  return game.user?.isGM ? settings : readSettings();
}

export function canEdit(token, { baseActor = baseActorOf(token) } = {}) {
  if (!token?.document || !baseActor || !game.user) return false;
  if (!game.user.isGM && !readSettings().owners) return false;
  return Boolean(game.user.isGM || (token.document.testUserPermission(game.user, "OWNER") && baseActor.testUserPermission(game.user, "OWNER")));
}

function resolveBrowse(path) {
  // S3 is represented explicitly. Other paths use Foundry's data source; external HTTPS is a single image.
  if (/^s3:\/\//i.test(path)) {
    const match = /^s3:\/\/([^/]+)\/(.*)$/i.exec(path);
    if (!match) throw new Error("S3 paths need a bucket and key.");
    return { source: "s3", target: match[2], bucket: match[1] };
  }
  return { source: "data", target: path, bucket: undefined };
}

export async function listTokenImages(token, { refresh = false, settings = readSettings() } = {}) {
  settings = effectiveSettings(settings);
  if (!canEdit(token, { settings })) throw new Error(localize("Errors.noPermission"));
  const actor = baseActorOf(token);
  const source = inferSource({
    pattern: actor.getFlag(MODULE_ID, "pattern"),
    prototypePath: actor.prototypeToken?.texture?.src,
    randomImg: actor.prototypeToken?.randomImg,
    currentPath: token.document.texture?.src,
  });
  const path = source.path;
  const wildcard = hasWildcard(path);
  if (source.kind === "single" || (source.kind === "custom" && !wildcard && isImage(path))) {
    return [path];
  }
  if (/^https?:\/\//i.test(path)) throw new Error(localize("Errors.remotePattern"));
  const limit = Math.max(20, Math.min(2000, Number(settings.maxImages) || 400));
  const cacheKey = JSON.stringify([source.kind, path, limit]);
  const cached = catalogCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.time < CACHE_MS) return cached.images.slice();
  const picker = foundry.applications.apps.FilePicker.implementation;
  let nativeImages = null;
  // Foundry provides a dedicated, server-side resolver for prototype-token
  // wildcard images. It handles braces, glob patterns, and storage sources.
  // Unlike naive directory browsing, it also uses exactly the active Actor's
  // native prototype configuration.
  if (source.kind === "wildcard" && typeof picker.requestTokenImages === "function") {
    try {
      const resolved = await picker.requestTokenImages(actor.id);
      if (Array.isArray(resolved) && resolved.length) nativeImages = resolved;
    } catch (error) {
      // Fall back to the public wildcard browse API for storage providers where
      // the dedicated endpoint is unavailable; don't hide both failures.
      console.debug(`${MODULE_ID} | Native wildcard resolver unavailable; falling back to browse`, error);
    }
  }
  let files = nativeImages;
  if (!files) {
    const { source: storage, target, bucket } = resolveBrowse(path);
    const response = await picker.browse(storage, target, {
      ...(bucket ? { bucket } : {}),
      extensions: ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"],
      wildcard,
    });
    files = response?.files;
  }
  // Never inject the current token's image into a wildcard result: it could
  // have been assigned independently and not match the native prototype.
  const images = normalizedImages(files, {
    include: source.kind === "directory" ? token.document.texture?.src : "",
  });
  const bounded = images.slice(0, limit);
  // Never cache empty results: a user fixing the folder or wildcard should
  // see the new files on the next picker open without waiting for TTL.
  if (bounded.length) {
    if (catalogCache.size >= MAX_CACHED) catalogCache.delete(catalogCache.keys().next().value);
    catalogCache.set(cacheKey, { time: Date.now(), images: bounded });
  } else catalogCache.delete(cacheKey);
  return bounded.slice();
}

export function invalidateCatalog() {
  catalogCache.clear();
}

function enqueueActor(actorId, task) {
  const previous = actorQueues.get(actorId) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  const settled = current.catch(() => {});
  actorQueues.set(actorId, settled);
  void settled.then(() => { if (actorQueues.get(actorId) === settled) actorQueues.delete(actorId); });
  return current;
}

/** Updates chosen Token Documents and the *base* Actor prototype without mutating its portrait. */
async function applyUnlocked(token, path, { settings, validate }) {
  settings = effectiveSettings(settings);
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  // The selected token must still exist in the active scene.
  if (!token.document.parent || canvas.scene?.id !== token.document.parent.id || !token.document.parent.tokens?.get(token.document.id)) {
    throw new Error(localize("Errors.staleToken"));
  }
  if (validate) {
    const candidates = await listTokenImages(token, { settings });
    if (!candidates.includes(path)) throw new Error(localize("Errors.notListed"));
    // World policy may change during I/O. Never apply a stale player policy snapshot.
    settings = effectiveSettings(settings);
    // Filesystem browse is asynchronous: the token may have been deleted or access revoked.
    if (!canEdit(token, { settings, baseActor: actor }) ||
        canvas.scene?.id !== token.document.parent?.id ||
        token.document.parent.tokens?.get(token.document.id) !== token.document) {
      throw new Error(localize("Errors.staleToken"));
    }
  }
  const desired = policy(settings);
  const wildcardProtected = desired.wildcard === "preserve" && actor.prototypeToken?.randomImg;
  const updatePrototype = desired.prototype && !wildcardProtected;
  const documents = desired.live ? [token.document] : [];
  if (desired.otherLive && desired.live) {
    // Explicit opt-in; only other tokens on this scene associated with the same base Actor.
    for (const doc of canvas.scene.tokens) {
      if (doc.id !== token.document.id && doc.actorId === actor.id && doc.actorLink === token.document.actorLink) {
        if (game.user.isGM || doc.testUserPermission(game.user, "OWNER")) documents.push(doc);
      }
    }
  }
  if (!documents.length && !updatePrototype) throw new Error(localize("Errors.nothingEnabled"));
  const changed = [];
  const oldPrototype = actor.prototypeToken?.texture?.src;
  const oldRandom = actor.prototypeToken?.randomImg;
  let protoDone = false;
  let wildcardPatternSaved = false;
  try {
    // When converting a native wildcard to a concrete prototype, retain the original
    // browsing pattern in this module so subsequent cycles do not broaden to the folder.
    if (updatePrototype && oldRandom && hasWildcard(oldPrototype) && !actor.getFlag(MODULE_ID, "pattern")) {
      await actor.setFlag(MODULE_ID, "pattern", oldPrototype);
      wildcardPatternSaved = true;
      invalidateCatalog();
    }
    // Update prototype first. Roll back all completed writes if a later write fails.
    if (updatePrototype && (oldPrototype !== path || oldRandom)) {
      await actor.update({ "prototypeToken.texture.src": path, "prototypeToken.randomImg": false });
      protoDone = true;
    }
    // Tokens are independent documents; write them concurrently rather than adding
    // one full network round-trip per matching token on large scenes. Record all
    // fulfilled writes so a partial failure can trigger compensating rollback.
    const pending = documents.filter(doc => doc.texture?.src !== path)
      .map(doc => ({ doc, previous: doc.texture?.src }));
    for (let start = 0; start < pending.length; start += MAX_PARALLEL_TOKEN_WRITES) {
      const batch = pending.slice(start, start + MAX_PARALLEL_TOKEN_WRITES);
      const results = await Promise.allSettled(batch.map(entry => entry.doc.update({ "texture.src": path })));
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") changed.push(batch[i]);
      }
      const failure = results.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (let start = 0; start < changed.length; start += MAX_PARALLEL_TOKEN_WRITES) {
      const batch = changed.slice(start, start + MAX_PARALLEL_TOKEN_WRITES);
      const reversions = await Promise.allSettled(batch.map(entry =>
        entry.doc.update({ "texture.src": entry.previous })));
      for (const rollback of reversions) {
        if (rollback.status === "rejected") rollbackErrors.push(rollback.reason);
      }
    }
    if (protoDone) {
      try { await actor.update({ "prototypeToken.texture.src": oldPrototype, "prototypeToken.randomImg": oldRandom }); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (wildcardPatternSaved) {
      try { await actor.unsetFlag(MODULE_ID, "pattern"); invalidateCatalog(); }
      catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) {
      console.error(`${MODULE_ID} | Rollback incomplete`, rollbackErrors);
      throw new Error(`${error.message} ${localize("Errors.rollbackIncomplete")}`, { cause: error });
    }
    throw error;
  }
  const result = Object.freeze({ actorId: actor.id, tokenId: token.document.id, image: path, updatedLive: changed.length, updatedPrototype: protoDone });
  if (changed.length || protoDone) {
    try { Hooks.callAll("runythCycleTokenImageChanged", result); }
    catch (error) { console.warn(`${MODULE_ID} | Downstream image-change hook failed`, error); }
  }
  return result;
}

/** Update selected token and prototype with actor-wide transaction serialization. */
export async function applyTokenImage(token, imagePath, { settings = readSettings(), validate = true } = {}) {
  settings = effectiveSettings(settings);
  const path = assertAssetPath(imagePath);
  if (!isImage(path) || hasWildcard(path)) throw new Error(localize("Errors.notImage"));
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  return enqueueActor(actor.uuid ?? actor.id, () => applyUnlocked(token, path, {
    settings, validate: game.user?.isGM ? validate : true,
  }));
}

/** Cycle atomically based on the latest persisted texture, including overlapping API calls. */
export async function cycleToken(token, delta = 1, { settings = readSettings(), ...options } = {}) {
  settings = effectiveSettings(settings);
  const actor = baseActorOf(token);
  if (!canEdit(token, { settings, baseActor: actor })) throw new Error(localize("Errors.noPermission"));
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Cycle direction must be a nonzero integer.");
  return enqueueActor(actor.uuid ?? actor.id, async () => {
    const images = await listTokenImages(token, { ...options, settings });
    const selected = nextImage(images, token.document.texture?.src, delta);
    if (!selected) throw new Error(localize("Errors.noImages"));
    return applyUnlocked(token, selected, { settings, validate: false });
  });
}

export async function saveActorPattern(actor, pattern) {
  if (!actor || !(game.user?.isGM || (readSettings().owners && actor.testUserPermission(game.user, "OWNER")))) {
    throw new Error(localize("Errors.noPermission"));
  }
  const trimmed = String(pattern ?? "").trim();
  // Validate before enqueueing, then recheck the current permissions at commit time.
  const path = trimmed ? assertAssetPath(trimmed) : "";
  if (path && !hasWildcard(path) && !isImage(path)) throw new Error(localize("Errors.badPattern"));
  return enqueueActor(actor.uuid ?? actor.id, async () => {
    if (!(game.user?.isGM || (readSettings().owners && actor.testUserPermission(game.user, "OWNER")))) {
      throw new Error(localize("Errors.noPermission"));
    }
    if (path) await actor.setFlag(MODULE_ID, "pattern", path);
    else await actor.unsetFlag(MODULE_ID, "pattern");
    invalidateCatalog();
  });
}
