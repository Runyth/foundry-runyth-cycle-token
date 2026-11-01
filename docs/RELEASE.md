# Release packaging — 0.2.6

The three deliverables are:

1. `runyth-cycle-token-0.2.6-module.zip` — installable `runyth-cycle-token/` folder containing one self-contained `scripts/runtime.mjs` entry, manifest, styles, languages, bundled SVGs, license and runtime README/CHANGELOG.
2. `runyth-cycle-token-0.2.6-source.zip` — full repository, including complete `.git/` history, tests, source, documentation and release metadata.
3. `runyth-cycle-token-0.2.6-documentation.zip` — only release documentation (`README.md`, `CHANGELOG.md`, `LICENSE`, `docs/`).

Run `python3 tools/build-runtime.py` after changing source JavaScript, then `npm run check` and `python3 tools/build-release.py /path/to/output` from the clean, tagged repository. The builder checks ZIP CRCs. These files are manually distributed archives; no imaginary GitHub release, HTTP manifest or hosted URL is claimed. The source repository uses `master` as its default branch and includes an annotated `v0.2.6` tag, retaining all earlier release tags through `v0.2.4`.

## Root-cause regression guard

The installed v0.1.3 manifest statically loaded `scripts/main.mjs`, which in turn imported `scripts/window.mjs`; a failed HTTP request for that file blocked all module setup. The v0.2.6 manifest instead references `scripts/runtime.mjs` and the installable archive ships no other JavaScript modules. `tools/build-runtime.py --check`, startup tests, and the builder's ZIP entry-point checks prevent regressions.

When upgrading, remove the old module folder before extracting the new version so stale split scripts are not mistaken for active assets. The previous fetch failure could also have been caused by browser filtering, a cache or server response: verify the runtime request in DevTools if the new module is still absent.

## v0.2.6 focused regression

- Native wildcard source precedence, Foundry resolver/fallback, preservation policy, empty catalog recovery.
- Prototype Appearance tab insertion constrained to verified content (browser smoke test executes compiled runtime).
- User-scoped opacity slider applies to active picker and on next render, not to token art.
- Empty gallery instructions disappear after any image is found and do not appear for filtered zero matches.

Run `python3 tools/check-prototype-browser.py` and `python3 tools/check-thumbnail-browser.py` where local Chromium + Playwright are available. Interactive Foundry v13 testing remains outstanding.

## v0.2.6 browser regression checks

Run `python3 tools/check-thumbnail-browser.py` to test multiple linked/independent dimensions with a simulated Foundry theme that clamps all buttons to 28px high; tiles must override this, including with captions. Run `python3 tools/check-opacity-browser.py` to validate screenshot pixels at 0%, 50%, and 100%: backing changes alpha, token art remains unchanged, and transparent art pixels reveal the canvas at zero. Both require installed Chromium and Python Playwright; opacity test also uses Pillow. Both are representative Chromium tests, not Foundry-client end-to-end guarantees.

## v0.2.6 focused regression

Run `npm run check` and `python3 tools/check-hud-browser.py`. The Chromium smoke test runs the generated single-entry runtime, simulates an asynchronously added Cycle Portrait theatre-mask control, and verifies that the Joker button stays immediately above it. `tests/migration.test.mjs` covers independent user preferences and preservation of the prior world setting. Check no Actor or Token document changes were added.

## v0.2.6 HUD-order regression

The v0.2.5 button-order test only simulated plain theatre-mask text in a normal flex column. That was insufficient: a production Portrait button can render an icon asset, use different labels, or exist in a reversed or separate HUD column. `tests/hud-order.test.mjs` and `tools/check-hud-browser.py` now exercise icon-only markup, nested icons, Emotes controls, asynchronous updates, cross-column movement, and normal/reversed flexbox *visual* position using the bundled runtime. Only Runyth Cycle Token's control is ever moved. This does not establish the actual DOM layout of a separately installed Cycle Portrait version; users should verify that combination inside Foundry v13.
