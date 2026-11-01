# Runyth Cycle Token

**Version:** 0.2.6
**Foundry:** v13 (target: v13.351)  
**Systems:** system-agnostic (intended for D&D5e 5.3.3 and other Foundry v13 systems)  
**License:** AGPL-3.0-or-later

Cycle or directly select a token's visual artwork from its Token HUD. This is a standalone companion to **Runyth Cycle Portrait**: **Cycle Token changes token textures, not character portraits**, and requires neither Cycle Portrait nor Image Hover.

## Features

- Small **Cycle Token** control in the Foundry v13 Token HUD.
- **Simple picker by default:** image thumbnails, filename search and an icon-only regex toggle. Opt in to the full advanced view with Previous/Next, Refresh, Help and targeting information.
- Updates **the selected live token and the base Actor's prototype token** immediately by default. Further live tokens of the same Actor on the current scene can be updated by opt-in.
- Configure global behavior in *Game Settings → Configure Settings → Runyth Cycle Token*.
- A separate image path / wildcard pattern in **Actor → Prototype Token → Appearance**. Supports a single image, different file extensions and filename prefixes, and native Foundry token wildcards. Clear it to go back to normal behavior.
- **Per-player thumbnail dimensions** in Configure Settings: linked width+height slider by default (85–245 px, default 115 px); optional independent width and height sliders. The tile button and its artwork both grow vertically; Foundry theme button-height limits are overridden without cropping captions. Updates reflow the open picker without refetching files.
- Regex search has a persistent, high-contrast highlighted appearance while switched on.
- Gallery captions can be toggled in Configure Settings (and inside the advanced picker) without changing images (off by default). Tooltips default to the image name without extension, independent of the captions.
- Configurable Token HUD icon: Font Awesome, three illustrated SVG symbols or several emojis (including theatre masks). HUD symbols are updated immediately when the setting changes.
- The resizable Help window starts at **560 × 560** (square); Help and picker dimensions/position are remembered independently per browser. Both can be reset individually through the module settings menu.
- **No changes at installation**: all existing token and actor images stay intact until an image is selected.
- When Foundry native random-image mode is enabled, its prototype wildcard takes priority over any older Runyth pattern. Uses the Foundry v13 wildcard resolver; when native mode is off, a Runyth override or the current image folder is used.
- World-owner permissions with player API policy enforcement, sequential actor-scoped edits and pattern saves, short-lived bounded image cache, best-effort rollback after a failed multi-document edit, safe URL/path validation, localized UI (English/German).
- Public module API and `runythCycleTokenImageChanged` hook for companion modules.

## Picker layout, wildcard selection and filename searching (v0.2.5)

The default **simple image picker** displays only a search field, a compact **asterisk icon** for regex search, and image tiles. The gallery loads more tiles automatically while scrolling, without a large button. The advanced interface is preserved behind **Configure Settings → Runyth Cycle Token → Use advanced image picker** (per-player user setting, off by default).

By default the search is case-insensitive **literal substring** matching of filenames, not full paths. Press the icon beside search (it announces the mode using its hover tooltip, keyboard focus and `aria-pressed`) to enable case-insensitive JavaScript regular-expression matching. For example `^Body_.*\.webp$` matches WEBP files beginning with `Body_`. The regex preference is remembered per browser and initially off. Invalid or expensive patterns show an inline validation error; they never modify token artwork.

**Image captions** remain a separate per-browser preference, off on fresh installation. In minimal mode, turn captions on/off under Configure Settings. In advanced mode the same preference is additionally available inside the picker. Changing the personal view toggle does not reset any preexisting caption preference. **Help** remains accessible through Configure Settings → Cycle Token help, and in the advanced picker.

**Companion HUD order (v0.2.6):** The default Token HUD icon is 🃏. When Runyth Cycle Portrait is enabled and its 🎭 control appears, Cycle Token places its control immediately above Portrait’s in the Token HUD. Ordering now also handles Portrait SVG/icon-only markup, reversed HUD columns, separate left/right columns, and asynchronous insertion; unrelated Token HUD Emotes controls remain untouched. A different chosen Token icon stays selected; this change does not overwrite manually saved icon choices.

**Personal advanced view (v0.2.5):** Each Foundry user controls **Use advanced image picker** in their own Configure Settings. The old world-wide toggle is now hidden and read only for one-time migration: a previously enabled world preference is copied to each user once, after which players choose independently. Fresh installations start in simple mode. Existing image-caption, tooltip and geometry preferences are unchanged.

## Installation

**v0.1.4+ startup fix:** Foundry now loads a single generated `scripts/runtime.mjs` instead of recursively importing `scripts/window.mjs` and other source files at startup. The shipped module ZIP includes only the compiled runtime script; the source ZIP still includes the individual source modules and generator. This addresses a single missing or blocked dependency preventing *all* Runyth hooks, settings and HUD registration. It does not override a browser/network error that prevents the new main runtime itself from loading.

**Upgrade:** Stop Foundry, replace the complete `Data/modules/runyth-cycle-token` directory with the v0.2.6 module folder, restart Foundry, and force-refresh the client. If the HUD is still missing, inspect the Network tab for the response to `modules/runyth-cycle-token/scripts/runtime.mjs` and check that `Runyth Cycle Token` is enabled. A failed response for the new runtime indicates a server/browser/cache delivery problem, not a missing module dependency inside the ZIP.


1. Extract `runyth-cycle-token-0.2.6-module.zip` into the Foundry user data **Data/modules/** directory. The resulting directory must be `Data/modules/runyth-cycle-token/` and contain `module.json` at its root.
2. Restart the Foundry service or reload the application; enable **Runyth Cycle Token** in *Manage Modules*.
3. Select a token on the scene and open the Token HUD (normally right-click). Select the configured **🃏 Joker card** control (or alternate HUD icon).
4. Click a thumbnail to apply it immediately. By default the picker contains only a filename search, a small regex-toggle icon and thumbnails. Each player can enable the advanced view for Previous/Next, Refresh, Help, target descriptions and image-path details. Reopen the simple picker to refresh its file listing.

**Manual installation:** This release does not include a published HTTP manifest or download URL, so it cannot be installed from a remote manifest URL until hosted.

## Image selection and wildcard setup

Use *Actor → Prototype Token → Appearance* to configure **Token Image Path** and **Randomize Wildcard Images** natively. The module adds its optional pattern control **only within the Appearance form content**, never to the tab navigation; if a compatible content panel is unavailable, it safely leaves that layout unchanged. A separate Runyth pattern can be saved there when native randomized wildcard mode is off. This does **not** change the Actor portrait, native Image Path, or native Randomize Wildcard Images checkbox just by saving the pattern.

| Pattern | Result |
| --- | --- |
| *(empty)* | Prefer native prototype wildcard when enabled; otherwise list supported images from the live token image's directory |
| `tokens/hero/Body_Hero_*.webp` | Match only images beginning with `Body_Hero_` and ending in `.webp` |
| `tokens/hero/*.png` | Match PNGs in the folder |
| `tokens/hero/{Hero_1,Hero_2}.png` | Foundry's own wildcard brace syntax |
| `tokens/hero/Body_Hero_A.webp` | A single image candidate |

Images are naturally sorted by path/filename. The gallery displays a localized five-step setup guide when it finds no images; it disappears immediately when files resolve and does not appear for a zero-result search filter. Supported types: PNG, JPG, JPEG, WEBP, AVIF, GIF and SVG. For native Foundry wildcard capabilities and syntax, see [Foundry's token guide](https://foundryvtt.com/article/tokens/). Native prototype wildcard files are resolved via Foundry v13 `FilePicker.requestTokenImages`; custom patterns use `FilePicker.browse`, which also serves as a fallback for native wildcard lookup; no direct file-system access is used.

Ordinary image paths are under Foundry's `data` source. Explicit `s3://bucket/key` patterns are passed to the configured S3 source; HTTPS paths can be selected individually, but HTTPS remote directory wildcard enumeration is unsupported. Server permissions, S3 configuration, and installed Foundry file type support still apply.

## World settings and personal preferences

| Setting | Default | Behavior |
| --- | --- | --- |
| Enable Token HUD button | On | Show the button on editable tokens |
| Use advanced image picker (per player, user scope) | **Off** | Off: only search, small regex toggle and image grid; on: full navigation, Refresh, Help, destinations, caption checkbox and path |
| Token HUD button icon | 🃏 Joker card | Select Font Awesome images/film/palette/arrows, bundled SVG artwork (stack/cycle/frame) or emoji theatre masks / palette / cycle / camera / frame / joker |
| Allow owning players | On | Players must own both the scene token and its source Actor |
| Update current live token | On | Change the selected token immediately |
| Update Actor prototype token | On | Change the original Actor's prototype token |
| Also update matching tokens on current scene | Off | Only when opted in; same actor ID and same linked/unlinked status |
| Existing native wildcard prototype | **Preserve wildcard** | `Selected image` sets the prototype to the new image and disables randomization; `Preserve` leaves it untouched |
| Maximum images per gallery | 400 | Clamp collection size for responsive UI |
| Picker window opacity (per player, user scope) | 100% | Configure Settings slider from 0% (fully transparent backdrop) to 100% (opaque). Images, controls and captions remain visible and fully opaque |
| Thumbnail dimensions (per player, user scope; submenu) | Linked 115 × 115 px | One slider controls both axes by default; turn on advanced dimensions for independent width and height (85–245 px each). Preexisting size preference is retained |
| Show image names below thumbnails (client) | Off | Show or hide captions; in simple mode change this in Configure Settings, in advanced mode also inside the picker. Switching views preserves your choice |
| Cycle Token help (menu) | Available | Open the resizable Help window even when the minimal picker is enabled |
| Thumbnail hover tooltip (client) | Image name (no extension) | Choose name, filename with extension, full path or disabled; independent from caption visibility |
| Reset window positions and sizes (menu) | No action until clicked | Reset picker or Help geometry independently for this browser; each window remembers changes on close |

**Wildcard detail:** When prototype synchronization is on and the explicit `Selected image` policy is configured, selecting an image intentionally replaces the prototype's native wildcard and sets `randomImg=false`. The default **Preserve** policy keeps Foundry random token creation active while allowing live token cycling. Explicit existing setting choices are respected. When deliberately converting a native wildcard to a concrete prototype, the original wildcard is automatically retained as the module image-pattern override so future cycles retain their source. Your separate module image-pattern override is not erased by either choice.

**Understanding synchronization:** In the advanced view, the gallery displays actual affected destinations rather than vague "on/off" switches. *This token on the active scene* is the selected placed token. *Actor prototype* is the blueprint for **future placements**, not previously placed tokens. *Other matching tokens on this scene* operates only on the active scene and depends on live-token synchronization being enabled. If native randomization is preserved, prototype writes are deliberately omitted. **Refresh** only updates the list of candidate images and makes no Actor/Token writes.

**Linked and unlinked:** The selected scene TokenDocument is always updated independently. When prototype sync is enabled, the **source/base Actor's** prototype is updated; this can affect future placed tokens of that Actor, including when the selected scene token is unlinked. The module never updates the synthetic Actor's portrait.

**Conflict avoidance:** If all applicable destinations are disabled (or preservation policy excludes the only destination), the module refuses to apply an image rather than silently reporting success.

## Companion API

Runyth Cycle Token exposes API methods on `game.modules.get("runyth-cycle-token").api` after the `init` hook:

```js
// Foundry macro — uses the first controlled token.
const token = canvas.tokens.controlled[0];
if (!token) throw new Error("Select a token.");
const api = game.modules.get("runyth-cycle-token")?.api;
await api.cycleToken(token, 1);
```

| Method | Behavior |
| --- | --- |
| `openForToken(token)` | Open the accessible image picker for the given live token |
| `listTokenImages(token, {refresh?, settings?})` | List matching image paths (permissions enforced) |
| `applyTokenImage(token, path, {validate?, settings?})` | Update according to policy; validates gallery membership by default |
| `cycleToken(token, delta, {settings?})` | Atomically choose next/previous image relative to persisted token image |
| `saveActorPattern(actor, path)` | Write or clear the Actor's separate image source override |
| `invalidateCatalog()` | Clear short-lived cached directory listings |

`Hooks.on("runythCycleTokenImageChanged", payload => { ... })` fires **after** successful updates. Payload: `actorId`, `tokenId`, `image`, `updatedLive`, `updatedPrototype`. Subscribers should not assume the update can be rolled back if they throw.

## Startup and distribution reliability

- The distributable manifest loads only `scripts/runtime.mjs`. Source modules are joined into one reproducible entry file using the dependency-free `tools/build-runtime.py` generator, reducing browser fetches and removing `window.mjs` from the startup request graph.
- `npm run check` verifies that the bundled file exactly matches source. Integration-style mock tests load the *actual compiled entry*, verify settings and API registration, and check that the HUD button is added exactly once.
- The release builder validates that every manifest entry is present inside the published ZIP and contains no additional JavaScript imports.
- A separate network failure for the main entry cannot be repaired by module code; verify delivery and browser filtering if `runtime.mjs` fails to fetch.

## Performance, safety and compatibility

Image enumeration happens on demand, not on every token or actor render. Results are cached for at most 15 seconds (48 source entries max). The catalog is bounded (default 400), while 80 preview tiles are initially mounted; simple mode appends more on scroll without a paging button, while advanced mode offers Show more. Neither requests the catalog again. Updates use native Foundry Document APIs without a canvas-wide redraw or repeated polling. Actor-scoped queues prevent overlapping image changes and pattern saves from racing against the same Actor. Independent live-token writes use bounded parallel batches of 24. Player API overrides cannot bypass GM world-policy settings; a window-level busy guard prevents accidental double clicks.

Only supported protocol/path formats are accepted. The gallery uses native DOM methods and `textContent` for filenames; it does not inject file names as HTML. Authorization is checked before browsing and again when modifying documents. No GM socket proxy or hidden privilege escalation exists. When one of several updates fails, completed document updates are rolled back **best effort**; a server failure during rollback is logged and may require manual repair. Foundry does not provide a cross-Actor-and-Token database transaction.

Foundry v13 `foundry.applications.apps.FilePicker.implementation` and `foundry.applications.api.ApplicationV2` interfaces are used; no deprecated global `FilePicker`, `renderTemplate` or jQuery interface is required. The module adds its own controls without replacing Foundry's HUD implementation, native prototype token appearance settings, or the Cycle Portrait module.

## Tests

Use Node.js 20+ to run `npm run check` in the source directory (57 mocked/static/UI-fixture regression tests). Build the three ZIPs from a clean tagged repository with `python3 tools/build-release.py <output-directory>`. These are deterministic **mocked unit and service tests**, not a statement that interactive Foundry browser regression tests have been performed. See `docs/VALIDATION.md` for the recommended Foundry v13.351 UI regression matrix and limitations.

## Documentation

- `docs/USER_GUIDE.md` — detailed setup and troubleshooting
- `docs/ARCHITECTURE.md` — design, update semantics, API integration
- `docs/VALIDATION.md` — test evidence and in-Foundry checks
- `CHANGELOG.md` — release notes

## References

- [Official module manifest documentation](https://foundryvtt.com/article/module-development/)
- [Foundry v13 TokenHUD API](https://foundryvtt.com/api/v13/classes/foundry.applications.hud.TokenHUD.html)
- [Foundry v13 FilePicker API](https://foundryvtt.com/api/v13/classes/foundry.applications.apps.FilePicker.html)
- [Foundry v13 TokenDocument API](https://foundryvtt.com/api/v13/classes/foundry.documents.TokenDocument.html)
- [Foundry v13 Actor API](https://foundryvtt.com/api/v13/classes/foundry.documents.Actor.html)

## Licence
Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
