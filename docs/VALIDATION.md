# Validation — Runyth Cycle Token 0.2.5

## Automated checks

Run `npm run check` with Node.js 20+ from the source repository. No install dependencies are required.

The tests use mock Actors, Tokens, scene collections, a Foundry FilePicker service and hooks. They exercise:

- Valid/invalid image paths; image extensions and wildcard recognition.
- Custom pattern vs native wildcard vs current-image-directory selection.
- Natural sorting, duplicate removal, empty galleries, deterministic wraparound.
- Persistent selected live token and Actor prototype image changes without portrait mutation.
- Native wildcard preservation and conversion to a concrete prototype image, retaining the original pattern with rollback.
- Prototype-update failure and best-effort rollback after a failed live-token write.
- Opt-in matching scene-token propagation.
- GM/owning player permission checks and missing update target refusal.
- Stale token state and concurrent cycle serialization.
- Single image selection and wildcard FilePicker enumeration.
- Non-GM protection against bypassing world settings or image-set validation via API option overrides, including permission changes during asynchronous browsing.
- Pattern writes serialized with pending artwork updates; stale token detection after asynchronous browse.
- Partial scene-update failures with sibling rollback; 24-write parallelism ceiling on large scenes; native wildcard/no-target refusal and no-op event behavior.
- S3 bucket selection, cache separation by gallery limit, and HTTPS query parameter handling.
- Static protection against legacy globals, manifest version consistency and English/German translation key parity.
- UI fixture tests for simple-default/advanced-optional layouts, caption preference persistence, regex toggle, search validation, infinite scrolling, default caption visibility and on/off switch, default name-only tooltips and modes, HUD icon allowlist, effective destination explanations, independent geometry persistence, square Help default, reset and reopening the same cached window instance.
- ApplicationV2 lifecycle regression: the test frame does not exist during `_preFirstRender`; `setPosition` is valid only after first frame construction, and restored dimensions persist after reopen and reset without stale positioning.
- Cross-platform syntax validation of **all** source modules and the generated production runtime.
- Startup fixture loading the **actual single-file production entry** and exercising registration of `init`, Token HUD, settings and public API; duplicate buttons are rejected.
- Bundle/manifest parity and **no additional JavaScript fetches**, preventing the logged `window.mjs` resource failure from blocking bootstrap.

**Result:** 70 automated tests pass, on Node.js v22.16.0. Startup tests now execute the actual compiled browser entry, and a third static test verifies the module manifest is bound to a self-contained entry. This does *not* prove correct runtime behavior in a real Foundry client.

## Foundry v13.351 manual regression matrix (pending)

**Startup regression priority:** With the module fully replaced on disk, verify `modules/runyth-cycle-token/scripts/runtime.mjs` responds with HTTP 200 and JavaScript content; the old `scripts/window.mjs` must not appear in the Network request log. Confirm the module is enabled and its Token HUD icon appears on right-click. If the main entry fails with `net::ERR_FAILED`, investigate server/HTTP/browser filtering; that is distinct from the removed secondary import.


| Case | Expected result |
| --- | --- |
| Fresh install with existing scenes and Actors | No token or Actor image modified |
| Fresh v0.2.1 install | Simple picker contains only search, regex toggle and thumbnails; advanced toggle defaults off |
| Simple mode scroll with 200 images | More thumbnails append automatically without large buttons or duplicate image tiles |
| Toggle regex, close/reopen picker | Enabled button retains a clearly highlighted pressed appearance; disabling removes it; preference persists |
| Per-player slider 85–245 px in both picker modes | Larger widths reduce the number of columns and show proportionately taller previews, without overlap or image updates |
| Two players set different thumbnail sizes | Each user sees their own preferred size; changing size while a picker is open updates it without rerendering thumbnails |
| Toggle regex, try invalid pattern | Case-insensitive pattern matches only filenames; invalid pattern warns without changing tokens |
| Enable captions in advanced, switch to simple | Captions remain enabled; switch back retains checkbox state |
| Help with simple view | Accessible from Configure Settings menu; window geometry still remembered |
| GM Token HUD (dnd5e 5.3.3) | Control appears once and opens the gallery |
| Repeated HUD open/close and rapid token switching | No duplicate control, ghost gallery or late image result |
| Linked PC token, default sync | Selected live token and base Actor prototype update immediately |
| Unlinked NPC token, default sync | Selected scene token and base Actor prototype update; synthetic Actor portrait unchanged |
| Owner player enabled/disabled | Only an authorized player sees/uses the control |
| Native wildcard set, selected policy | Prototype receives concrete image; random mode switches off |
| Native wildcard set, preserve policy | Existing prototype wildcard/random mode remain unchanged |
| Actor custom glob across extensions/prefixes | Only images matched by Foundry FilePicker appear |
| Actor exact path override, then clear | One selectable image; clearing returns to native/fallback source |
| Empty/missing/read-denied image folder | Actionable error without mutation |
| Very large image folder | UI remains responsive; user may narrow pattern |
| Two tokens updated in rapid succession | Correct final texture and prototype, no stale writes |
| HUD alongside Cycle Portrait, Image Hover, RP Names, Token HUD Wildcard | Only this module's control and texture targets change |
| UI resized to small/medium window | Controls and help remain legible, no overlap |
| Fresh Help open | Default outer window 560 × 560 (square), text remains scrollable; no `reading style` error |
| Move/resize Help and picker, then reopen | Independent dimensions/position restored per browser using the post-frame lifecycle; no initialization error |
| Reset Help and picker through module settings menu | Each returns to centered defaults; cached closed instances do not restore old geometry |
| Image captions on/off | Initially hidden; toggled labels are path-free and preference persists |
| Thumbnail hover, captions on/off | Only image name without extension or path by default; respects optional tooltip mode |
| Change HUD icon setting | Already opened HUD updates and newly opened HUD uses chosen SVG/Font Awesome/emoji |
| Click Refresh | Re-browse image list without a single token/prototype write |
| Game/world reloaded after image change | Correct persisted texture values |
| Permission revoked while browser is open | No unauthorized changes |
| Manual injection of prototype failure | No live texture applied |
| Server failure after partial live updates | Best-effort rollback and visible error |
| Browser development console | No deprecated global warnings or uncaught module errors |

## Release boundary

All automated checks and archive integrity checks are executed during packaging. The release builder requires a clean Git tree and corresponding version tag. In-app Foundry v13.351/browser integration cannot be executed in this build environment; manual checks above are not falsely marked as passed. No bundled copy of Foundry commercial runtime is included.

## v0.2.2 thumbnail dimension regression cases

- Upgrade with a saved 205 px `thumbnailSize` user preference: the linked slider starts at 205 px and images occupy a 205 × 205 px viewport.
- Change linked slider to 85, 115 and 245 px: both actual image CSS box width and height update, and grid row height increases with preview height.
- Enable independent sliders: each inherits the linked size until explicitly overridden. Set width=245, height=85 and then width=85, height=245: images remain visible and proportionally contained, grid column count changes only with width.
- Disable independent sliders: the saved combined size returns on both axes. Reenable: prior independent settings return.
- Adjust sliders with an open image picker: image nodes are not recreated and no image directory browsing or Token/Actor updates occur.
- Rapid slider changes and an injected rejected settings write: a late failure must not revert newer slider values.
- Repeat with captions enabled, in the simple and advanced picker, at a narrow window width and with a high-aspect-ratio image.
- Optional Chromium layout smoke: `python3 tools/check-thumbnail-browser.py` (requires Python Playwright and Chromium locally) verifies pixel sizes and responsive column counts for five linked/independent dimension pairs.

Foundry v13.351 end-to-end interaction remains a **manual verification**, not a claimed automated pass.

## v0.2.5 targeted checks

| Scenario | Expected result |
| --- | --- |
| Native prototype `randomImg=true` and `texture.src="tokens/Hero_*.webp"` | Gallery resolves native images using `FilePicker.requestTokenImages` even if a stale Runyth override is saved |
| Native resolver unavailable | Public `FilePicker.browse(..., {wildcard:true})` fallback, no silently empty gallery |
| Select a native wildcard match | Placed token changes; native prototype image path/randomization remains intact with default Preserve policy |
| Empty gallery, then create matching files | Five-step setup guide while empty, normal thumbnails on reopened picker after files appear |
| Non-empty gallery but unmatched text filter | Plain no-matches message; no wildcard setup guide |
| Prototype Token → Appearance tab | Runyth fieldset only within actual form panel, never inside navigation/tab label; no duplicate elements on rerender |
| Change per-player opacity | Live picker background ranges from fully transparent at 0% to opaque at 100%; thumbnails unaffected, no image writes |

**Browser smoke:** `python3 tools/check-prototype-browser.py` executes the bundled runtime against a representative DOM and checks navigation integrity. `python3 tools/check-thumbnail-browser.py` measures actual thumbnail dimensions in Chromium. These checks and Node.js fixtures do not demonstrate full in-client compatibility with every third-party sheet/module; confirm separately on Foundry v13.351.

## v0.2.5 targeted checks

- A Foundry-like CSS theme sets `height`, `min-height`, and `max-height` to 28px for all buttons. Gallery tiles must still expand to full chosen image viewport size, plus padding and optional captions; test 85×85, 115×115, 245×245, 245×85 and 85×245.
- Per-user opacity accepts the full range 0–100% with 5% steps, retains the old default of 100% and saved values on upgrade. Zero is not clamped to 50.
- The opacity setting must not call `style.opacity` on the window frame; an independent `::before` backdrop is the only layer faded. Controls and artwork are always at full opacity, including transparent token borders and PNG alpha regions. At 0% the window surface and tile backing are transparent, while images remain visible.
- Both changes update open pickers without image re-browsing, recreating tiles, or mutating Tokens/Actors.
- Chromium checks: `python3 tools/check-thumbnail-browser.py` and `python3 tools/check-opacity-browser.py`; latter confirms screenshot pixels over colored canvas at 0%, 50%, 100%. Manual Foundry v13.351 smoke remains pending.

## v0.2.5 targeted checks

- New Joker-card default and retained explicit HUD icon choices.
- Move our button immediately before the Cycle Portrait control whether it is present before or after our `renderTokenHUD` hook, and re-order after unrelated HUD button insertions.
- Never duplicate the button or observer on a repeated HUD render; clean up on new HUD / canvas teardown.
- Exclude Token HUD Emotes and ambiguous masks from mask-only fallback identification.
- Check the user-scoped advanced-menu setting and preservation of the old hidden world setting for one-time per-user migration. Verify different users can select different modes.
- Run `python3 tools/check-hud-browser.py` against `scripts/runtime.mjs` using Chromium to verify actual DOM ordering, immediate-after behavior, Joker default and settings registration. This supplements but does not replace live Foundry v13 testing.

## v0.2.6 companion HUD placement

Run `node --test tests/hud-order.test.mjs` and `python3 tools/check-hud-browser.py`. The latter uses Chromium and the actual compiled runtime, testing both DOM adjacency and screenshot-coordinate visual order with normal and reversed HUD columns, an icon-only Portrait asset, a third-party Emotes mask button, and cross-column placement. Confirm manually in Foundry v13.351 with **both** Runyth modules enabled and Token HUD Emotes (if installed), including switching tokens, closing/reopening HUD, and different theme layouts. The companion module's real HTML structure is not bundled in this repository and is not represented exactly by the test fixture.
