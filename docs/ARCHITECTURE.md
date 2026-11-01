# Architecture — Runyth Cycle Token 0.2.6

## Design goals

- Standalone Foundry v13 module; no D&D5e-only implementation dependency.
- Defer all browsing and artwork changes until explicitly used.
- Avoid modifying `Actor.img` and any original portrait data.
- Preserve compatibility with other HUD add-ons by injecting one idempotent button on `renderTokenHUD`, without replacing the HUD application.
- Use modern Foundry namespaced APIs and native DOM event listeners.

## Files

| File | Responsibility |
| --- | --- |
| `scripts/core.mjs` | Pure path validation, image matching/sorting, cycling and update policy |
| `scripts/settings.mjs` | World/client/user settings, thumbnail dimension normalization, settings submenu registration and defaults |
| `scripts/thumbnail-settings.mjs` | Per-user ApplicationV2 slider submenu, linked/independent axes, immediate CSS-only preview and serialized writes |
| `scripts/layout.mjs` | Remembered ApplicationV2 geometry, post-frame `_onFirstRender` restoration (never pre-frame `setPosition`), on-screen clamping and independent resets |
| `scripts/help.mjs` | Square-on-first-launch responsive, resizable Help window |
| `scripts/search.mjs` | Pure filename-only substring and constrained regex search, with invalid-pattern results |
| `scripts/presentation.mjs` | Pure image label/tooltip and effective destination semantics |
| `scripts/hud-icons.mjs` and `assets/*.svg` | Allowlisted HUD SVG/emoji/Font Awesome choices and live HUD icon updates |
| `scripts/service.mjs` | Discovery and Actor/Token permission checks; serialized Document updates and rollback |
| `scripts/window.mjs` | ApplicationV2 browser, thumbnails, filters, status, keyboard-friendly controls |
| `scripts/config.mjs` | Prototype Token Appearance tab Actor pattern input, FilePicker and help |
| `scripts/hud-order.mjs` | Optional companion HUD integration: identifies Portrait controls by module identity, icon, or tooltip; accounts for reversed flex order; one scoped observer, only moves our own button |
| `scripts/main.mjs` | Source of hook registration, singleton window and companion API; **not** an installed browser entry point |

## Update sequence

1. Verify permissions on both the live TokenDocument and the base Actor.
2. Resolve Actor image-pattern override; otherwise native wildcard or current token image directory.
3. Use `FilePicker.implementation.browse` for directory/wildcard discovery; natural-sort and cap the image results.
4. Lock on base Actor identity. Check permissions and active-scene token existence again.
5. Validate the selected image is a member of the configured gallery (unless the documented privileged companion API deliberately disables validation).
6. Persist prototype texture and random-mode setting (when policy permits).
7. Persist selected live token and optionally related same-scene tokens.
8. If any step fails, attempt to restore prior values of completed writes, log any rollback failures and return the error.
9. Emit the `runythCycleTokenImageChanged` hook after successful completion.

## Concurrency

An Actor-scoped promise queue covers explicit-image writes, image cycles and Actor pattern edits, so repeated cycling cannot compute all selections from the same stale image. Queues release themselves after settling. File browsing caches are short lived (15 seconds, 48 entries), keyed by source/pattern/catalog limit, and lists are capped. UI tiles are mounted in 80-item increments to minimize main-thread and image-decoding overhead; simple mode appends tiles on scroll, advanced mode uses manual paging. Same-scene token updates use bounded parallel batches of 24, with best-effort rollback after partially failed batches. Browser state tracks a revision counter to reject stale async responses after switching tokens or closing windows. Geometry uses awaitable ApplicationV2 `_preClose` persistence; the saved windows are distinct per browser and can be reset via a modern settings submenu.

## Per-player preview dimensions (v0.2.2)

Foundry v13 supports `scope: "user"` settings. The existing `thumbnailSize` user value is preserved on upgrade, but its built-in slider is replaced by a per-user **Thumbnail dimensions** settings submenu (ApplicationV2). By default the existing single value controls **both width and height**. The separate user settings `thumbnailAdvanced` (default false), `thumbnailWidth`, and `thumbnailHeight` enable independent axis control. An axis with an unset zero sentinel inherits the existing linked size, preventing a reset to 115 px when an older user first opens advanced controls. Values are normalized and bounded to 85–245 px in 10 px increments. Switching off independent sliders leaves their values intact, ready to restore if re-enabled.

Each image picker shell defines `--rct-thumbnail-width` and `--rct-thumbnail-height`. Responsive CSS Grid uses width plus tile padding for column sizing; the preview `<img>` uses an explicit `height` and `min-height` tied to the height custom property, `flex: 0 0 auto` so a column-flex tile cannot shrink it, and `object-fit: contain` to preserve the original media aspect ratio. The grid uses `grid-auto-rows: max-content` and allows scrolling as vertical space is consumed. No intrinsic `height:auto` + aspect ratio inference remains, eliminating the observed nearly-zero-height previews in a constrained Foundry window. The settings submenu updates both custom properties in place and commits user preferences on `change`; write requests are serialized and late failures do not overwrite newer user edits. A picker rerender always rehydrates both dimensions from persisted user settings. No image re-browse, thumbnail recreation, Actor write or Token write is involved.

The regex button continues using `[aria-pressed="true"]` for a theme-independent accessible active state.

## UI preference and view configuration

The advanced-view switch is a user-scoped setting (default false); the previous world setting is retained as hidden, one-time migration input; existing image-name and tooltip preferences are client scoped and unchanged on switching views. Regex matching is a separate client-scoped setting (default off, toggle in search row only). Help is registered as an ApplicationV2 settings submenu so it remains accessible from simple view. Both picker views reuse the identical image catalogue, permission checks, and image-update service. Search runs in memory against filename components only; regex patterns are compiled once per filter change, validated with length and expensive-pattern guards, and never used to construct HTML or URLs.

## Security and compatibility boundaries

- Calls are always checked against the active user's Foundry permissions, without elevated socket RPCs. Non-GM callers cannot override the configured world authorization, synchronization policy or image-membership validation through API options. The current world policy is re-read following asynchronous browsing before persistence.
- User-supplied paths are validated; `javascript:`, `data:`, `file:`, traversal and control characters are rejected.
- UI filenames are DOM text nodes, never interpolated HTML. Thumbnail names default to hidden; tooltips use path-free, extension-free text unless the local client setting changes this. HUD icons are created from a fixed allowlist.
- Source storage is browser-accessible only. Remote HTTPS supports single-image paths, not directory wildcards.
- When `randomImg` is enabled, prototype synchronization deliberately disables it in `selected` mode, since retaining a wildcard flag with a concrete path would be inconsistent. `preserve` mode leaves the prototype unchanged. The source wildcard is copied into a module Actor flag during conversion and restored on failure, maintaining the original browsing scope.
- The module does not hook token updates recursively or poll the canvas.
- No D&D5e rules, token compendium imports or world migrations are needed.

## Known practical boundaries

- Foundry provides no atomic transaction across an Actor and Scene TokenDocuments. Rollback is compensating and best effort.
- A very large directory is still returned by Foundry's browser before client-side truncation. Narrow your Actor pattern for best performance.
- Third-party animated media, game-system canvas layers, HUD replacements and S3 provider behaviors require in-app testing.
- A native token HUD provided by another module with fully replaced markup may not include the expected standard columns; the module falls back to the HUD root.

## Single-file runtime distribution (v0.1.4 onward)

The original source graph remains organized into small ES modules under `scripts/`. The production manifest requests only `scripts/runtime.mjs`, generated offline by `tools/build-runtime.py`. The generator wraps individual module scopes, preserves explicit local imports/exports in a deterministic in-memory module table, and refuses unsupported syntax. It needs only Python 3.10+ and writes a reproducible bundle, checked with `--check` in CI/testing and before packaging. The module ZIP ships the single bundle, not the individual source scripts; the source ZIP retains all individual scripts plus their full Git history.

The change specifically prevents failure to load a second Runyth JS file from suppressing all `init` hooks. It does not mask a failure to download the single manifest entry itself. A startup fixture executes the generated bundle in Node with Foundry-shaped globals, and the release builder confirms the archive's entry files exist and have no outstanding imports.

## v0.2.5 native wildcard source and UI placement

Native `prototypeToken.randomImg` + wildcard `prototypeToken.texture.src` wins over any saved Runyth Actor pattern. For that source, `FilePicker.implementation.requestTokenImages(actor.id)` resolves the concrete images on the Foundry server; `FilePicker.implementation.browse(...,{wildcard:true})` is a fallback. A custom Actor pattern is used only when native randomization is not active; otherwise, the live token image directory supplies the candidates. The module never adds the live token's current path to native wildcard results when it is not a valid match. Empty results are intentionally not cached.

The `renderPrototypeTokenConfig` hook accepts an `HTMLElement`, not jQuery. Both tab navigation and content may have `data-tab="appearance"`; injection requires an actual content panel containing form fields, and refuses navigation elements. No native field gets a new input name or an automatic value change. A Chromium DOM regression runs the *bundled* entry to check the navigation remains untouched.

Opacity is user-scoped via the Foundry settings system (0–100%, default 100%). `onChange` and `_onRender` set a custom property on the picker root; only a non-interactive `::before` backdrop consumes this opacity. The ApplicationV2 frame and all descendant images/controls retain computed opacity 1, including at 0%, and transparent artwork pixels reveal the canvas underneath. At 0%, the theme frame border/shadow and tile backing colors are removed. No `element.style.opacity` is set on any ancestor. Geometry remains independent.

## v0.2.5 tile layout hardening

Foundry themes may force `button` height and `max-height` to a one-line control. A `.rct-tile` is semantically a button, but must be laid out like a responsive image card. Highly scoped selectors on `.rct-gallery > button.rct-tile` explicitly override host button heights and maximums, impose minimum height based on `--rct-thumbnail-height` plus padding, and let optional captions grow the tile. The image retains exact independent width/height constraints with `object-fit: contain`. The gallery preserves its bounded, incremental render strategy and CSS Grid row sizing.

## v0.2.6 companion HUD ordering and v0.2.5 per-user view

`scripts/hud-order.mjs` observes only the active token HUD when `runyth-cycle-portrait` is active, using one scoped `MutationObserver` without polling or monkey-patches. It identifies the Portrait control using its module ID, icon asset URL, tooltips or the unique 🎭 fallback. The resolver excludes unrelated Token HUD Emotes and refuses ambiguous matches. **Only our button is moved** into the companion column; it is inserted immediately *before* Portrait for normal flex columns or immediately *after* Portrait for reversed flex columns, yielding the correct **visual** order in either case. The operation is idempotent and observation is disconnected on HUD replacement or canvas teardown. No companion dependency is required.

`advancedMenu` is the old hidden world setting, retained only as a migration source. `advancedMenuUser` is the new, editable Foundry `user`-scope setting. At `ready`, `advancedMenuMigrated` ensures a user's prior shared advanced-mode preference is copied at most once. Later personal choices are independent; existing thumbnail, opacity, image-label, wildcard and sync settings are unchanged.
