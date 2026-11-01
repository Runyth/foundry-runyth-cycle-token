#!/usr/bin/env python3
"""Run a real Chromium DOM regression for the Prototype Token Appearance tab.

Mock only Foundry globals/hooks; execute the shipped single-file runtime itself.
This cannot replace a fully running Foundry v13 integration test.
"""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
chromium = which('chromium') or which('chromium-browser')
if not chromium:
  raise SystemExit('Chromium not installed')

with sync_playwright() as p:
  browser = p.chromium.launch(headless=True, executable_path=chromium, args=['--no-sandbox'])
  page = browser.new_page(viewport={'width': 1000, 'height': 800})
  page.set_content('''<!doctype html><html><body>
    <nav class="sheet-tabs tabs" role="tablist">
      <button role="tab" data-tab="appearance">Appearance</button>
    </nav>
    <form>
      <section class="tab" data-tab="appearance">
        <div class="form-group"><input name="texture.src" value="actors/Body_*.webp"></div>
      </section>
    </form>
  </body></html>''')
  page.evaluate('''() => {
    window.__hooks = {};
    window.Hooks = {
      once: (name, cb) => { window.__hooks[name] = window.__hooks[name] || []; window.__hooks[name].push(cb); },
      on: (name, cb) => { window.__hooks[name] = window.__hooks[name] || []; window.__hooks[name].push(cb); },
    };
    window.game = {
      user: {isGM: true},
      i18n: {localize: key => key},
      settings: {get: () => true, register: () => {}, registerMenu: () => {}},
      modules: new Map([['runyth-cycle-token', {}]]),
    };
    window.ui = {notifications: {error() {}, info() {}}};
    window.foundry = {applications: {api: {ApplicationV2: class {}}}};
  }''')
  page.add_script_tag(content=(root / 'scripts/runtime.mjs').read_text())
  result = page.evaluate('''() => {
    const render = window.__hooks.renderPrototypeTokenConfig?.[0];
    if (!render) throw new Error('Missing prototype hook from bundled runtime');
    const actor = {id:'abc',prototypeToken:{texture:{src:'actors/Body_*.webp'}},getFlag:()=>''};
    const documentRoot = document.body;
    const beforeNav = document.querySelector('nav').outerHTML;
    render({actor},documentRoot);
    render({actor},documentRoot);
    return {
      navUnchanged: document.querySelector('nav').outerHTML === beforeNav,
      sectionCount: document.querySelectorAll('section.tab .runyth-cycle-token-config').length,
      navCount: document.querySelectorAll('nav .runyth-cycle-token-config').length,
      untouchedNativeImage: document.querySelector('input[name="texture.src"]').value,
      textLabels: [...document.querySelectorAll('nav button')].map(x => x.textContent),
    };
  }''')
  assert result['navUnchanged'], result
  assert result['navCount'] == 0, result
  assert result['sectionCount'] == 1, result
  assert result['untouchedNativeImage'] == 'actors/Body_*.webp', result
  assert result['textLabels'] == ['Appearance'], result
  page.evaluate('''() => { document.querySelector('section.tab').remove(); }''')
  page.evaluate('''() => {
    const actor = {id:'abc',prototypeToken:{},getFlag:()=>''};
    window.__hooks.renderPrototypeTokenConfig[0]({actor},document.body);
  }''')
  assert page.locator('nav .runyth-cycle-token-config').count() == 0
  print('PASS: shipped runtime inserts only into verified Appearance content; nav untouched, idempotent, native fields untouched')
  browser.close()
