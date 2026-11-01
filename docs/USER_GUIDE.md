# User Guide — Runyth Cycle Token 0.2.5

## Quick start

1. Enable the module in *Manage Modules*.
2. Right-click an editable scene token and press the Runyth Cycle Token HUD icon.
3. The **default simplified picker** shows only a filename search, a compact regex button beside it, and selectable image thumbnails. Click an image to update the token immediately according to world synchronization policy.
4. In **Configure Settings → Runyth Cycle Token**, each player can enable **Use advanced image picker** to restore Previous/Next, Refresh, Help, destination explanations, the image caption toggle and active image path.

If Runyth Cycle Portrait is active and shows its 🎭 mask control on the Token HUD, this module keeps its 🃏 button **directly above** the Portrait button. The position also updates when another module inserts its HUD control later. The Joker card is only the default; a GM-selected alternative icon is preserved.

The advanced-picker option is **user-scoped**, so each player can choose their own view. On upgrade from 0.2.4, the old GM world preference is inherited once per user, then becomes independent. Fresh installations begin in simple mode.

### Simple and advanced view

| Option | Simple (default) | Advanced |
| --- | --- | --- |
| Search field and regex toggle | Yes | Yes |
| Thumbnail gallery (click to apply) | Yes | Yes |
| Per-player thumbnail dimensions | 85–245 px per axis, linked by default | 85–245 px per axis, linked by default |
| Image names below thumbnails | When client preference is on | When client preference is on; also has a checkbox |
| Previous/Next, Refresh, Help, targets and path | Hidden | Visible |
| More thumbnails | Loaded automatically on scroll | **Show more** button |

The simple mode is intentionally compact: no heading, status panel, navigation/refresh/help buttons, or footer. When no images resolve, the gallery displays five setup steps for native prototype wildcard image paths and supported files. The guidance disappears once any thumbnail is available. A search with no matches and an invalid regex produce separate messages. To refresh files in simple mode, close and reopen the picker (the module re-browses available files). In advanced mode **Refresh** bypasses the normal 15-second list cache. Neither action changes token artwork on its own.

### Search modes

The small **asterisk icon-only button** next to search toggles between:

- **Off by default:** case-insensitive literal substring search in each filename, including extension. `Body_` finds filenames containing `Body_`; special characters have no effect.
- **On:** case-insensitive JavaScript regular expressions. For example `^Body_.*\.webp$` matches WEBP names beginning with `Body_`. Invalid regex syntax shows an error and leaves images untouched. Common expensive forms (nested repeats, quantified alternations or backreferences) and expressions longer than 160 characters are rejected.

The mode is a personal per-browser preference and is retained across window reopenings. The toggle has a hover tooltip, descriptive accessibility label and **persistent highlighted pressed state**, but no visible text.

### Thumbnail dimensions, opacity and regex feedback (v0.2.5)

Each player can open **Game Settings → Configure Settings → Runyth Cycle Token → Configure thumbnail sizes**. By default, the **Width and height** slider changes both image viewport dimensions together (85–245 px in 10 px increments, 115 × 115 px initially). Enable **Use separate width and height sliders** to show independent **Width** and **Height** controls. Each new axis initially inherits your existing combined size; separate values are remembered if you switch back to combined mode. Thumbnails never stretch or distort: `object-fit: contain` preserves each image's aspect ratio within its configurable viewport. The whole thumbnail button expands with the preview (and optional filename caption), so theme-imposed short button heights cannot clip the artwork. Larger previews naturally fit fewer columns and rows. These are **user-scoped** Foundry v13 preferences, not world-wide or per-browser settings. A gallery already open updates immediately without recreating images, reloading files or modifying tokens.

Each player can also use the **Window opacity** slider directly in Configure Settings to set the image-picker window from 0% to 100% background opacity (default 100%). At 0%, the window has no backdrop, while image thumbnails, image labels, search and buttons remain fully opaque. Transparent regions of PNGs and other artwork show the canvas behind them. Changes take effect immediately in open pickers and do not alter other players’ windows.

The small regex toggle now shows a **filled, high-contrast highlighted background** while enabled, in addition to its tooltip and accessible pressed state. The highlight stays visible after saving or reopening the picker; regular-expression matching remains off until explicitly activated.

### Image captions, tooltips and Help

Thumbnails show **only images** by default. The separate **Show image names under thumbnails** setting is stored per browser. In simple mode, change it through **Configure Settings**; in advanced mode the checkbox also appears inside the picker. Switching views does **not** clear this preference, including if captions were enabled before an upgrade.

Thumbnail hover tooltips show only the name without an extension by default. Their behavior is independently configurable under Configure Settings. The resizable **Help** window is available at **Configure Settings → Runyth Cycle Token → Cycle Token help**, even with simple view enabled, and from the Help button in advanced mode. On first launch Help is square (560 × 560); the size and position of Help and picker are remembered separately and may be reset through **Reset window positions and sizes**.

The HUD shortcut defaults to the 🃏 Joker card and remains GM-configurable, including three bundled SVG designs and matching Font Awesome/emoji icons. The search and image preview never mutate tokens until a thumbnail is selected.

## Image sources

The module first checks whether **Randomize Wildcard Images** is enabled on the base Actor and whether its **Token Image Path** contains a wildcard. If so, the **native prototype wildcard takes priority**, even if an older optional Runyth override is saved. Foundry v13 `FilePicker.requestTokenImages(actor.id)` resolves those patterns, with `FilePicker.browse` as fallback. Otherwise, the optional Runyth override is used; if it is empty, images in the selected token's current folder are listed. This fallback is deliberate: it never silently activates Foundry's native random mode.

To avoid unrelated files in a large folder, set **Token Image Path** in the Actor's Prototype Token → Appearance form and enable **Randomize Wildcard Images**, such as `tokens/hero/Body_Hero_*.png` or `tokens/hero/Body_Hero_*.webp`. An optional Runyth override remains available in the Appearance form content when Foundry native randomization is off; it never changes the native fields by itself. The module never inserts into the Appearance tab navigation. You can choose an exact image to temporarily restrict the selection to one file. **Clear override** restores native/fallback selection. Image patterns are only saved when you press **Save pattern**.

## What gets updated

- **Current token:** the live TokenDocument `texture.src` on the current scene.
- **Prototype:** the base Actor's `prototypeToken.texture.src`, used by future placed tokens. A selected image replaces native randomized wildcard mode when configured to do so.
- **Other scene tokens (off by default):** only matching Actor ID and same linkage mode on the active scene. No changes are made to off-scene tokens.
- **Actor portrait:** never changed; Runyth Cycle Portrait remains independently responsible for actor portraits.

For newly initialized settings, *Existing native wildcard prototype → Preserve wildcard prototype* is the default. Old explicitly saved choices are respected. This preserves randomization while letting the placed token change. If both **Current token** and **Prototype token** update are disabled, the module reports that no update targets are enabled.

## What do the gallery's synchronization labels mean?

In advanced view, instead of ambiguous "Live token: on" / "Prototype: on", the gallery spells out the **actual targets** when an image is selected. In simple view these explanations are available in Help and world settings. **This token on the active scene** changes the token you right-clicked. **Actor prototype (default artwork for tokens placed later)** changes the source Actor blueprint for future placements; it does **not** retroactively update scene tokens. **Other matching tokens on this scene** updates matching Actor tokens on the active scene, and requires live-token updates; off-scene tokens are untouched. If native prototype randomization is configured to be preserved, the gallery excludes prototype from the active destinations even if prototype updates are generally enabled.

The global settings that control these effects are *Update current live token*, *Update Actor prototype token*, *Also update matching tokens on current scene* and *Existing native wildcard prototype*. Use the Help window for worked explanations. A Refresh click never triggers any of these changes; it only re-enumerates the image selection.

## Permissions

GMs can operate the gallery for any existing token with a source Actor. GM-created integrations may override target settings for a particular operation; player integrations may not bypass the world's permission or synchronization settings. Players require both token ownership and ownership of the source Actor, plus the world setting allowing owning players. The module will not use a GM relay to bypass Foundry access rights.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| HUD icon not visible | Check the HUD toggle, select a scene token with a source Actor, and verify ownership. |
| Gallery empty | Follow the five-step guide displayed in the empty gallery: Prototype Token → Appearance → Token Image Path with a valid wildcard and **Randomize Wildcard Images** enabled; ensure matching files are readable. Reopen the picker, or Refresh in advanced mode. |
| Prototype remains unchanged | Enable prototype synchronization; also check if wildcard policy is set to Preserve. |
| New tokens are no longer random | Set wildcard policy to Preserve before selection if native wildcard mode must remain enabled. The original wildcard is retained as a module pattern when conversion is selected. |
| Only selected token changed | Enable the optional same-scene synchronization for matching tokens. Off-scene tokens are never changed. |
| Unexpected folder images | Enable a narrow native wildcard on Prototype Token → Appearance. It takes precedence over a Runyth override while native randomization is enabled. |
| Failed update | Check console errors, Foundry permissions and server storage; if rollback also fails, restore affected token textures manually. |
| Two HUD add-ons overlap | Their buttons are independent. Disable conflicting HUD addons one at a time for diagnosis. |

## Uninstallation

Disabling or uninstalling the module does not erase token images. Module-specific Actor flags may remain in world data (they are inert without the module). Native token and actor-image records stay in place.
