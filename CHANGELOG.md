# Changelog

## 0.2.6 — 2026-11-01

- First publication as a Runyth module (Runyth Cycle Token keeps its id, title, npm package, and workspace identity for this release).

- Joined the Runyth publication standard: deterministic installable `-mod`, source `-src`, and documentation `-doc` archives with per-version SHA256 checksums, byte-identical rebuild verification, publication scanning, and the standard quality and release pipelines on Node 24.
- The program stays `AGPL-3.0-or-later` with the standard two-line source notice on every program source, including the freshly generated runtime bundle; the README carries the standard licence chapter.
- The generated runtime bundle now carries the licence notice as its first lines, and the static hygienics test pins that head; runtime behaviour is unchanged.

- Corrected the unreliable placement of the Cycle Token 🃏 HUD button relative to Runyth Cycle Portrait. The v0.2.5 implementation recognized little beyond a literal 🎭 glyph or specific tooltip text; an icon-only or differently localized Portrait control could not be found.
- Identify the companion through its own module ID, accessible labels, icon asset paths (including SVG/img elements), and compatible theatre-mask icons, while excluding Token HUD Emotes. Ambiguous masks never trigger arbitrary reordering.
- Respect actual **flex-direction**: when a HUD column uses `column-reverse`, the required DOM adjacency is *after* Portrait to appear visually *above* it. The prior implementation always inserted before Portrait. If the controls start in different columns, move only our own button into the Portrait column.
- Observe later additions and relevant icon/attribute changes, keeping one observer per active HUD; reuse the existing button, and disconnect observers on HUD replacement/canvas teardown. No changes to companion module files, Actor/Token documents, or artwork settings.

- Expanded unit tests for icon-only SVG/Image portraits, nested controls, reversed columns, split columns, late additions, third-party theatre masks, and ambiguous controls. Chromium smoke tests execute the compiled single-file runtime and validate *pixel position*, not just DOM order, in both normal and reversed layouts.
- Existing settings, wildcard, thumbnail, opacity, and API regression suites are unchanged. As before, full interactive Foundry v13.351 testing with the actual companion installed remains outstanding.

## 0.2.5 — 2026-11-01

- Changed the default Token HUD icon to **🃏 Joker card**, while keeping all existing icon alternatives and explicitly chosen icons intact.
- When Runyth Cycle Portrait is active and its 🎭 control appears in the Token HUD, position the Cycle Token control **directly above** the Portrait control. Observe late/asynchronous HUD insertions with one scoped observer, without modifying the companion module, duplicate buttons or unbounded polling. Avoid mistaken placement relative to Token HUD Emotes or ambiguous masks.
- Moved **Use advanced image picker** from a shared GM-controlled world toggle to a **per-player Foundry user-scoped setting**, off by default on new worlds. The previous world preference is retained hidden as one-time migration input so players who inherited advanced mode do not unexpectedly lose it; subsequent choices are independent. Open pickers can reflect the changed preference without file re-browsing.

- New HUD-ordering, observer lifecycle, icon and player-preference migration tests, plus a Chromium smoke check executing the compiled single-file runtime. Existing wildcard, gallery, window-opacity, thumbnail-size and Prototype Token tab behavior are unchanged. Interactive Foundry v13.351 validation remains outstanding.

## 0.2.4 — 2026-11-01

- Corrected the **thumbnail tile/button height**, not merely the image element. Foundry themes can impose one-line `button` height and max-height on every gallery tile; the tile now overrides that constraint and expands vertically with the configured image viewport and any filename caption. Independent width/height settings and CSS Grid remain responsive.
- Reworked the **per-player opacity** to affect only the picker background, never its images, controls, captions or search field. The old implementation applied `opacity` to the entire ApplicationV2 frame and faded all descendant artwork.
- Expanded the opacity range from **50–100%** to **0–100%** in 5% steps; at 0% the window backing surface is fully transparent, along with the tile background and window shadow, while token images remain fully visible. Existing stored opacity preferences are preserved.

- Added Chromium layout regression with a simulated 28px Foundry button theme, five thumbnail size combinations and enabled captions; verified full tile heights and no cropping.
- Added Chromium pixel-level tests at 0%, 50%, and 100% background opacity. The window background changes while image pixels do not; transparent artwork pixels reveal the scene at 0%.
- Extended automated settings and CSS regression checks, preserving the single-file startup bundle, wildcard source behavior, ownership policy, GUI state and actor/token update semantics. Real Foundry v13.351 interactive testing remains a separate manual validation step.

## 0.2.3 — 2026-11-01

- Made Foundry native prototype wildcard images authoritative whenever **Randomize Wildcard Images** is enabled. Older saved Runyth custom-pattern flags can no longer hide the real prototype wildcard catalog. When native mode is off, those optional custom patterns continue working.
- Resolve native wildcard candidates with Foundry v13 `FilePicker.requestTokenImages(actor.id)`, which understands the Actor's native configuration, with documented static `browse` as fallback. A selected concrete live-token image never needs to match the wildcard path itself. The current token is not injected into wildcard results if it is outside the matching set.
- Corrected the `renderPrototypeTokenConfig` Appearance-tab insertion selector. Navigation elements and content panels can both use `data-tab="appearance"`; now the module inserts only into a verified form content panel, never a navigation label. Unknown layouts are left untouched rather than corrupted. Repeated renders remain idempotent.
- Preserve the native randomized prototype by **default** for newly initialized world settings. The explicitly chosen **Use selected image** policy still converts a wildcard prototype to a fixed image, as documented; existing explicitly saved policy choices remain unchanged.
- Do not cache empty image catalogs. Fixing files or wildcard patterns becomes visible when the picker is reopened, instead of waiting for the former 15-second empty-result cache.

- **Window opacity (per player)**: a user-scoped 50–100% slider in Configure Settings, default 100% (opaque). It updates the currently open picker immediately and applies on subsequent renders, without touching token documents, window geometry, or other players' preferences.
- The gallery now shows localized, step-by-step setup instructions when no images resolve, including where to configure a prototype wildcard and its native randomization checkbox. The instructions disappear as soon as any image is found. A filter yielding no matches remains a distinct state, as does an invalid regex.
- Added tests for source precedence, native resolver and fallback, preserving randomization, empty-cache recovery, inline guidance, and opacity. A Chromium DOM smoke test executes the *bundled* runtime and verifies the Appearance tab bar is neither changed nor inflated.

- No Actor portrait modifications, no automatic token-artwork migrations, no deprecated Foundry globals and no new runtime file requests. The source repository keeps the complete version history.
- Automated tests and isolated browser DOM/CSS tests are **not** a substitute for testing inside a running Foundry v13.351 world. Upgrades keep existing user preferences and Actor flags intact.

## 0.2.2 — 2026-11-01

- Corrected collapsed thumbnail images: the old responsive-grid columns changed only the horizontal constraint, while the preview `<img>` retained `height: auto` inside a flex-column button. In the host layout that allowed the vertical space to shrink almost to zero. Preview width and height now have definite independent CSS variables, nonshrinking flex behavior and `object-fit: contain` to avoid distorting artwork.
- Grid rows follow the actual preview height plus any captions. Responsive columns respond to width and scrolling handles larger image heights without altering the gallery or search logic.

- A **Thumbnail dimensions** ApplicationV2 submenu in Configure Settings, available to every user. The default single slider adjusts width and height together; enabling **Use separate width and height sliders** replaces it with independent controls. Both axes allow 85–245 px in 10 px steps. Existing v0.2.1 `thumbnailSize` user preferences are retained; new unset advanced dimensions inherit that size, and previous advanced values survive mode switches.
- Live CSS-only preview in already open pickers, serialized asynchronous preference persistence and guards against older failed saves reverting newer edits.
- Regression tests for linked and independent axes, configuration switching, error handling, actual CSS layout constraints and DOM identity. Real Chromium smoke validation checks the five supported size/aspect combinations in a representative gallery layout.

- No change to token artwork, Actor images, wildcard settings, image filtering or ownership policy. The module remains a single self-contained JavaScript runtime entry for Foundry v13. The underlying per-user `thumbnailSize` setting is preserved (now edited through the submenu).
- Automated and browser-smoke validation are distinct from live in-Foundry testing, which remains outstanding.

## 0.2.1 — 2026-11-01

- Give the compact regex toggle a clearly highlighted, high-contrast pressed state. Its visible treatment is driven by the same `aria-pressed` attribute exposed to assistive technology, and is maintained across asynchronous preference saving and picker rerenders. The tooltip, accessible label, and disabled-by-default behavior are unchanged.

- **Thumbnail size (per player)** in Configure Settings: a user-scoped slider from **85 to 245 px** in **10 px** steps, default **115 px**, matching the previous gallery's column baseline. Each user can choose a size independently within the current Foundry world; the GM cannot accidentally change everyone else's grid density.
- Both simple and advanced pickers use the same responsive CSS Grid minimum column width. Image preview height scales in proportion to its rendered width, rather than retaining a fixed 96 px height. Increasing the slider naturally reduces the number of thumbnails that fit horizontally and vertically.
- Changes update any open picker **without reloading the file list, rebuilding tiles, or writing Actor/Token documents**. Image-name visibility, token updates and search remain unaffected.
- Added tests for pressed-state persistence, CSS styling, user-scoped slider registration, slider bounds, live updates without DOM replacement, and responsive column rules.

- Existing configurations and artwork require no migration. The default gallery retains its previous approximate size and preserves the v0.1.4 self-contained runtime entry.
- 59 automated Node.js tests pass. These are mocked UI/service tests, not live Foundry v13.351 browser integration; CSS was additionally statically reviewed.

## 0.2.0 — 2026-11-01

- Introduced GM-controlled **Use advanced image picker** (world setting, **disabled by default**). The default simple view contains only filename search, a small icon-only regex toggle and image thumbnails. The previous navigation, Refresh, Help, destination descriptions, status and image-path details remain available in advanced view.
- Registered Help as its own Configure Settings submenu so its resizable, remembered ApplicationV2 window stays available in simple mode. The existing per-client **Show image names** setting also stays available in Configure Settings; advanced mode retains the same in-picker checkbox. Switching layouts does not overwrite the preference.
- Added an accessible, persistently remembered per-browser regex toggle beside the search field, off by default. Plain matching uses case-insensitive filename substrings; regex mode matches case-insensitively against filenames, catches invalid syntax and refuses obviously expensive or overly long expressions.
- Added automatic incremental gallery loading on scroll for simple mode, removing its large paging button while keeping the established 80-tile initial cap. Advanced mode keeps manual Show more.
- Added English/German localization, documentation and regression tests for both views, regex modes, caption retention, and progressive gallery loading.

- Preserves all Actor flags, token images, existing caption/tooltip preferences, HUD icons, geometry and world synchronization policies. No migration is needed.
- Retains the self-contained production `scripts/runtime.mjs` entry introduced in v0.1.4, with no secondary browser JavaScript imports.
- Automated checks run under Node.js mocks; interactive verification in Foundry v13.351 remains pending.

## 0.1.4 — 2026-11-01

- Eliminated the startup dependency on `scripts/window.mjs`: the original v0.1.3 module performed static imports of UI code before `init`, so the browser's logged `net::ERR_FAILED` for that secondary file prevented the entire module from registering settings and its Token HUD control.
- The installable module now ships a single deterministic, self-contained `scripts/runtime.mjs` entry. All browser-imported Runyth JavaScript is in that file, while individual source files remain in the full Git repository for maintainability.
- Added an offline bundler that fails on unsupported module syntax and a build-time consistency check; no external build dependencies or runtime polyfills.
- Added startup regression tests that execute the generated entry in a Foundry-shaped environment and verify settings, public API, HUD injection, idempotence and resilience to a separately throwing third-party hook.
- The release builder verifies the annotated version tag resolves to HEAD, checks the exact module ZIP's entry-point integrity, and rejects extra browser JavaScript imports or stale `window.mjs` packaging.

- The v0.1.3 archive already contained `window.mjs`; the precise reason that browser failed to fetch it is not established by the log. This change removes that secondary request; server or browser failures affecting `runtime.mjs` remain externally dependent.
- RP Names 1.16.0 `html.find` errors and Token Action HUD's failed language JSON request are unrelated and not modified.

## 0.1.3 — 2026-11-01

- Runtime compatibility hotfix for the five repeated `runyth-cycle-token: Cannot read properties of undefined (reading 'style')` errors observed in the supplied Foundry console log. No image or Actor migrations are needed.

- **Root cause:** the v0.1.2 geometry restoration called `ApplicationV2.setPosition` in `_preFirstRender`. In Foundry v13 the frame HTMLElement does not yet exist at that point; positioning accesses the unavailable element's `style` and prevents the module's windows from opening.
- Restore the Help and image-picker dimensions in the documented `_onFirstRender` lifecycle instead, after Foundry creates their frames. Keep per-client saved geometry, first-open square Help window, viewport clamping, independent layout resets and cached-instance reopening.
- Strengthen the ApplicationV2 fixture so `setPosition` fails before the frame exists, and add regression tests for first render, rerender, close/reopen, and reset of an open window.
- Leave unrelated `rp-names` Token HUD `html.find` error, the chat-rendering deprecation warning, DDB Importer notices and missing Automated Conditions resource untouched; they are not attributable to this module from the log.

- **Validation:** 46 automated tests pass, including four new lifecycle regressions. Live Foundry v13.351 UI verification remains pending.

## 0.1.2 — 2026-11-01

- UX and accessibility patch; no changes to Actor flags or existing token/prototype image data are required.

- Replace the transient help dialog with a resizable ApplicationV2 help window, initially square (560 × 560). Remember size and position per browser independently from the picker; restore on subsequent opens and clamp to the current viewport.
- Add *Configure Settings → Runyth Cycle Token → Reset window positions and sizes* with independent reset actions for Help and image picker, including already open windows and cached instances after close.
- Explain Refresh precisely: bypass directory-list cache to reload image file listings without changing token data. Clarify current live token, Actor prototype for future placements, optional same-scene matching-token synchronization, and native wildcard preservation.
- Replace ambiguous "Live token: on / Prototype: on" status with a description of effective destinations; show meaningful counts after image updates.
- Add a persistent per-browser **Show image names** checkbox inside the gallery (default off) with the equivalent Configure Settings option.
- Change default image hover tooltips to filename without extension and without path. Configure tooltip as stem (default), filename, full path or none independently from image caption visibility.
- Add GM-configurable Token HUD icon selector: five Font Awesome glyphs, three bundled SVG illustrations and six themed emojis, with allowlisted DOM construction and immediate updates to open HUDs.
- Extend the dependency-free regression suite with UI event, tooltip, icon, layout restoration and reset tests; check syntax of every runtime module.

- **Validation:** 42 mock/static/UI-fixture automated tests pass. Full in-Foundry v13.351 manual integration remains pending.

## 0.1.1 — 2026-11-01

- Patch hardening release; no Actor or Token migration is required.

- Enforce GM-configured owner permissions, synchronization targets and image membership validation on player-facing public API calls; player-supplied options can no longer broaden world permissions, including while an asynchronous browse is pending.
- Serialize Actor pattern saves alongside Actor-scoped cycles and document writes; revalidate scene-token existence and permissions after async browsing.
- Handle HTTPS image URL query parameters without mistaking them for wildcard patterns, while rejecting actual remote globs.
- Fix image-cache key isolation when the world gallery limit changes.
- Limit parallel token writes to batches of 24 while retaining per-document error accounting and best-effort rollback.
- Warn explicitly about incomplete rollback; do not emit a change event when no document changed.
- Display gallery previews in increments of 80 to bound DOM and image-decoding overhead, while keeping search and cycling over all catalogued images.
- Add API/permission, stale-token, S3, concurrency, rollback and localization/static compatibility regression tests.
- Add reproducible release archive builder and verification checks.

- **Validation:** 33 Node.js mocked/static tests passed. Live Foundry v13.351 client integration remains to be verified; no assertion of a bug-free live runtime is made.

## 0.1.0 — 2026-11-01

- Initial release of **Runyth Cycle Token** for Foundry v13.

- Native v13 Token HUD picker with responsive/searchable gallery and Previous/Next controls.
- Configurable current live token, source Actor prototype, and same-scene matching-token synchronization.
- Native wildcard handling with a choice to preserve randomization or commit the chosen image to the prototype.
- Per-Actor override pattern on the Prototype Token Appearance panel (including single-image mode).
- Owner/GM access controls, localized English and German interfaces.
- Bounded image browsing cache, state safety, actor-scoped synchronization and best-effort rollback on write failure.
- Documented public API, companion hook, and deterministic automated tests.

- **Validation status:** Node.js tests run successfully with mocked Foundry APIs. Manual browser integration testing on Foundry v13.351 remains necessary before claiming complete runtime verification.
