"""Chromium regression: backing window transparency never fades images/buttons.

Run `python3 tools/check-opacity-browser.py` with local Chromium and Playwright.
The test deliberately uses a visible page background and checks actual pixels.
"""
from io import BytesIO
from pathlib import Path
from shutil import which

from PIL import Image
from playwright.sync_api import sync_playwright

css = (Path(__file__).resolve().parents[1] / 'styles/runyth-cycle-token.css').read_text()
chromium = which('chromium') or which('chromium-browser')
if chromium is None:
  raise SystemExit('Chromium is unavailable')

html = '''<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; min-height: 100%; background: rgb(230, 20, 60); }
.runyth-cycle-token-window { position:absolute; left:40px; top:40px; width:460px;
  height:380px; display:flex; flex-direction:column; --background: rgb(28, 35, 44); }
.runyth-cycle-token-window .window-header { height:32px; flex:0 0 32px; }
.runyth-cycle-token-window .window-content { flex:1; min-height:0; }
</style><style>''' + css + '''</style></head><body>
<div class="runyth-cycle-token-window" style="--rct-window-surface-opacity:1">
  <header class="window-header">Image picker</header>
  <div class="window-content"><section class="rct-shell rct-simple">
    <div class="rct-search-row"><input class="rct-search" placeholder="Search"><button class="rct-regex-toggle">*</button></div>
    <div class="rct-gallery">
      <button class="rct-tile"><img class="rct-thumbnail" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='115' height='115'%3E%3Crect x='20' y='20' width='75' height='75' fill='%2300e080'/%3E%3C/svg%3E"></button>
    </div>
  </section></div>
</div></body></html>'''

with sync_playwright() as playwright:
  browser = playwright.chromium.launch(headless=True, executable_path=chromium, args=['--no-sandbox'])
  page = browser.new_page(viewport={'width': 560, 'height': 500}, device_scale_factor=1)
  page.set_content(html)
  page.locator('.rct-thumbnail').wait_for(state='visible')
  colors = []
  for opacity in (0, 0.5, 1):
    page.evaluate('''opacity => {
      const frame = document.querySelector('.runyth-cycle-token-window');
      frame.style.setProperty('--rct-window-surface-opacity', String(opacity));
      frame.classList.toggle('rct-window-transparent', opacity === 0);
    }''', opacity)
    properties = page.evaluate('''() => {
      const frame = document.querySelector('.runyth-cycle-token-window');
      const image = document.querySelector('.rct-thumbnail');
      return {
        frameOpacity: getComputedStyle(frame).opacity,
        imageOpacity: getComputedStyle(image).opacity,
        backdropOpacity: getComputedStyle(frame, '::before').opacity,
        imageRect: image.getBoundingClientRect().toJSON(),
      };
    }''')
    assert properties['frameOpacity'] == '1', properties
    assert properties['imageOpacity'] == '1', properties
    assert float(properties['backdropOpacity']) == opacity, properties
    assert properties['imageRect']['height'] >= 114, properties
    pixels = Image.open(BytesIO(page.screenshot())).convert('RGB')
    background = pixels.getpixel((44, 44))
    img = properties['imageRect']
    image_pixel = pixels.getpixel((int(img['x'] + img['width']/2), int(img['y'] + img['height']/2)))
    transparent_corner = pixels.getpixel((int(img['x'] + 3), int(img['y'] + 3)))
    colors.append((opacity, background, image_pixel, transparent_corner))
  assert colors[0][1] == (230, 20, 60), colors
  assert colors[2][1] == (28, 35, 44), colors
  assert colors[0][2] == colors[1][2] == colors[2][2], colors
  assert colors[0][2] == (0, 224, 128), colors
  assert colors[0][3] == (230, 20, 60), colors  # transparent PNG areas show the map
  for opacity, background, thumbnail, corner in colors:
    print(f'{int(opacity * 100)}% background: pixel {background}; thumbnail pixel {thumbnail}; transparent art pixel {corner}')
  print('PASS: 0–100% backdrop transparency, full-opacity token images, and interactive frame')
  browser.close()
