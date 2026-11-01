# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
"""Optional Chromium CSS regression test (Python Playwright + local Chromium).

Checks pixel geometry against an actual browser layout engine. No browser code
is shipped in the Foundry installable module and no external network is used.
"""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / "styles/runyth-cycle-token.css").read_text()
chromium = which("chromium") or which("chromium-browser")
if chromium is None:
  raise SystemExit("Chromium not found: install Chromium or run the Node test suite instead")
html='''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;}
.runyth-cycle-token-window { width:480px;height:480px; background:#30343a; }
.window-content{height:100%}
.window-content img { max-height:100%; }
</style><style>'''+css+'''</style><style>/* Simulate Foundry themes restricting every button to a short horizontal strip. */
.runyth-cycle-token-window button { height:28px; min-height:28px; max-height:28px; }
</style></head><body><div class="runyth-cycle-token-window"><div class="window-content"><section class="rct-shell rct-simple"><div class="rct-search-row"><input class="rct-search" placeholder="Search"><button class="rct-regex-toggle">*</button></div><div class="rct-gallery" style="height:430px;">'''+''.join('<button class="rct-tile"><img class="rct-thumbnail" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'500\' height=\'800\'%3E%3Crect width=\'500\' height=\'800\' fill=\'teal\'/%3E%3C/svg%3E"></button>' for _ in range(12))+'''</div></section></div></div></body></html>'''
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, executable_path=chromium, args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':650,'height':600})
  page.set_content(html)
  results=[]
  for w,h in ((85,85),(115,115),(245,245),(245,85),(85,245)):
    page.evaluate('([w,h]) => { const shell = document.querySelector(".rct-shell"); shell.style.setProperty("--rct-thumbnail-width",w+"px"); shell.style.setProperty("--rct-thumbnail-height",h+"px"); }',[w,h]);
    values=page.evaluate('''() => {
      const imgs=[...document.querySelectorAll(".rct-thumbnail")];
      const rect=imgs[0].getBoundingClientRect();
      const cards=[...document.querySelectorAll(".rct-tile")];
      return { imageWidth: rect.width,imageHeight:rect.height, tileHeight:cards[0].getBoundingClientRect().height, columns: new Set(cards.slice(0,12).map(c=>Math.round(c.getBoundingClientRect().x))).size };
    }''')
    assert values['imageHeight'] >= h - 0.1, (w,h,values)
    assert values['imageWidth']>0 and values['tileHeight']>=h+12, (w,h,values)
    results.append((w,h,values))
  for w,h,values in results:
    print(f'{w}x{h} -> image {values["imageWidth"]:.0f}x{values["imageHeight"]:.0f}; '
          f'tile height {values["tileHeight"]:.0f}; columns {values["columns"]}')
  assert [item[2]["columns"] for item in results] == [4, 3, 1, 1, 4]
  # Captions must increase the tile height rather than getting clipped by a
  # Foundry theme's default button max-height.
  page.evaluate('''() => {
    document.querySelectorAll('.rct-tile').forEach((tile, i) => {
      const caption = document.createElement('span');
      caption.className = 'rct-filename';
      caption.textContent = `Example character token ${i + 1}`;
      tile.append(caption);
    });
    const shell = document.querySelector('.rct-shell');
    shell.style.setProperty('--rct-thumbnail-width', '245px');
    shell.style.setProperty('--rct-thumbnail-height', '245px');
  }''')
  caption = page.evaluate('''() => {
    const tile = document.querySelector('.rct-tile');
    const image = tile.querySelector('img');
    const text = tile.querySelector('.rct-filename');
    return {tile: tile.getBoundingClientRect().height,
      image: image.getBoundingClientRect().height,
      caption: text.getBoundingClientRect().height,
      scroll: tile.scrollHeight, client: tile.clientHeight};
  }''')
  assert caption['image'] == 245 and caption['caption'] > 0, caption
  assert caption['tile'] >= caption['image'] + caption['caption'] + 12, caption
  assert caption['scroll'] <= caption['client'] + 1, caption
  print(f"245x245 with captions -> tile {caption['tile']:.0f}px, no overflow")
  print("PASS: Chromium pixel geometry, themed button overrides, captions, and responsive grid reflow")
  browser.close()
