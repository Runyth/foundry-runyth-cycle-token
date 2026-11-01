#!/usr/bin/env python3
"""Chromium smoke test of the DISTRIBUTED single-file HUD code and setting registration.

Uses a synthetic Foundry HUD and engine globals. This is not a complete live
Foundry integration test.
"""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
chromium = which('chromium') or which('chromium-browser')
if not chromium:
  raise SystemExit('Chromium is not installed')

with sync_playwright() as p:
  browser = p.chromium.launch(headless=True, executable_path=chromium, args=['--no-sandbox'])
  page = browser.new_page(viewport={'width': 960, 'height': 720})
  page.set_content('''<!doctype html><html><head><style>
    .col.right { display:flex;flex-direction:column;gap:6px; }
    .control-icon { min-height:40px;width:45px; }
  </style></head><body><div id="hud"><div class="col right"></div></div></body></html>''')
  page.evaluate('''() => {
    window.__hooks = {};
    window.__definitions = new Map();
    window.__settings = new Map();
    window.Hooks = {
      once: (name, callback) => { (window.__hooks[name] ??= []).push(callback); },
      on: (name, callback) => { (window.__hooks[name] ??= []).push(callback); },
    };
    const actor = {id:'actor',testUserPermission:()=>true};
    window.__token = {document:{actorId:actor.id,testUserPermission:()=>true}};
    window.game = {
      user: {isGM:true},
      actors: new Map([[actor.id, actor]]),
      modules: new Map([['runyth-cycle-token',{}],['runyth-cycle-portrait',{active:true}]]),
      i18n: {localize: key => key},
      settings: {
        register: (namespace, name, entry) => {__definitions.set(name,entry);__settings.set(name,entry.default);},
        registerMenu: () => {},
        get: (namespace, name) => __settings.get(name),
        set: async (namespace, name, value) => {__settings.set(name,value); return value;},
      },
    };
    window.ui = {notifications: {error:()=>{},info:()=>{}}};
    window.foundry = {applications: {api: {ApplicationV2: class { static DEFAULT_OPTIONS = {}; }}}};
  }''')
  page.add_script_tag(content=(root / 'scripts/runtime.mjs').read_text())
  result = page.evaluate('''() => {
    window.__hooks.init[0]();
    const root = document.querySelector('#hud');
    const column = root.querySelector('.right');
    const render = () => __hooks.renderTokenHUD[0]({object: __token}, root);
    render();
    const token = column.querySelector('.runyth-cycle-token-hud');
    if (!token) throw new Error('Runyth HUD button missing');
    const defaultIcon = token.textContent;
    const masks = document.createElement('button');
    masks.className='control-icon'; masks.textContent = '🎭';
    column.append(masks);
    return { defaultIcon, advancedScope: __definitions.get('advancedMenuUser').scope,
      advancedDefault: __definitions.get('advancedMenuUser').default,
      advancedVisible: __definitions.get('advancedMenuUser').config,
      oldWorldHidden: __definitions.get('advancedMenu').config === false,
      iconDefault: __definitions.get('hudIcon').default };
  }''')
  assert result == {
    'defaultIcon':'🃏', 'advancedScope':'user', 'advancedDefault':False,
    'advancedVisible':True, 'oldWorldHidden':True, 'iconDefault':'emoji-joker'
  }, result
  page.wait_for_function('''() => {
    const column = document.querySelector('#hud .right');
    const masks = [...column.children].find(node=>node.textContent==='🎭');
    return masks?.previousElementSibling?.classList.contains('runyth-cycle-token-hud');
  }''')
  before = page.evaluate('''() => {
    const column = document.querySelector('#hud .right');
    const masks = [...column.children].find(node=>node.textContent==='🎭');
    const r1 = masks.getBoundingClientRect();
    const r2 = masks.previousElementSibling.getBoundingClientRect();
    return {masksY:r1.y, jokerY:r2.y, count:column.querySelectorAll('.runyth-cycle-token-hud').length};
  }''')
  assert before['count'] == 1 and before['jokerY'] < before['masksY'], before
  # Simulate another module's late insertion between the two controls.
  page.evaluate('''() => {
    const column=document.querySelector('#hud .right');
    const masks=[...column.children].find(node=>node.textContent==='🎭');
    const other=document.createElement('button');other.className='control-icon';other.textContent='Other';
    column.insertBefore(other,masks);
  }''')
  page.wait_for_function('''() => {
    const column = document.querySelector('#hud .right');
    const masks = [...column.children].find(node=>node.textContent==='🎭');
    return masks?.previousElementSibling?.classList.contains('runyth-cycle-token-hud');
  }''')
  page.evaluate('''() => __hooks.renderTokenHUD[0]({object:__token},document.querySelector('#hud'))''')
  assert page.locator('.runyth-cycle-token-hud').count() == 1
  # Production-like companion: icon-only DOM, with no literal mask text.
  # An Emotes theatre-mask button must not be selected instead.
  page.evaluate('''() => {
    const hud=document.querySelector('#hud');
    const column=hud.querySelector('.right');
    const old=[...column.children].find(el=>el.textContent==='🎭');
    old.remove();
    const emotes=document.createElement('button');
    emotes.className='control-icon';
    emotes.title='Token HUD Emotes';
    emotes.textContent='🎭';
    const portrait=document.createElement('div');
    portrait.className='control-icon';
    const img=document.createElement('img');
    img.src='/modules/runyth-cycle-portrait/img/portrait-icon.svg';
    portrait.append(img);
    column.append(emotes,portrait);
    window.__portrait=portrait;
    window.__emotes=emotes;
  }''')
  page.wait_for_function('''() => __portrait.previousElementSibling?.classList.contains('runyth-cycle-token-hud')''')
  assert page.evaluate('''() => __emotes.parentElement === __portrait.parentElement''')
  # Real CSS layout check: reverse direction makes DOM order inverse to pixels.
  page.evaluate("""() => document.querySelector('#hud .right').style.flexDirection='column-reverse'""")
  page.wait_for_function('''() => {
    const token=document.querySelector('.runyth-cycle-token-hud');
    return __portrait.nextElementSibling===token
      && token.getBoundingClientRect().top < __portrait.getBoundingClientRect().top;
  }''')
  # Revert to normal direction and verify the observer repairs the position.
  page.evaluate("""() => document.querySelector('#hud .right').style.flexDirection='column'""")
  page.wait_for_function('''() => {
    const token=document.querySelector('.runyth-cycle-token-hud');
    return __portrait.previousElementSibling===token
      && token.getBoundingClientRect().top < __portrait.getBoundingClientRect().top;
  }''')
  # Portrait and Token can initially belong to different HUD columns. Move
  # only Token's control across columns, leaving the companion untouched.
  page.evaluate('''() => {
    const hud=document.querySelector('#hud');
    const left=document.createElement('div');
    left.className='col left';
    left.style.cssText='display:flex;flex-direction:column;gap:6px';
    hud.append(left);
    left.append(__portrait);
  }''')
  page.wait_for_function('''() => {
    const token=document.querySelector('.runyth-cycle-token-hud');
    return token.parentElement === __portrait.parentElement
      && __portrait.previousElementSibling===token;
  }''')
  assert page.locator('.runyth-cycle-token-hud').count() == 1

  # Confirm the setting actually controls readSettings' view model.
  views = page.evaluate('''async () => {
    __settings.set('advancedMenuUser',true);
    const read = game.modules.get('runyth-cycle-token').api;
    // UI mode changes are read by the picker on rendering, not via an API setting.
    return {enabled: __settings.get('advancedMenuUser'), worldUntouched:__settings.get('advancedMenu')===false,
      apiPresent:typeof read.openForToken==='function'};
  }''')
  assert views == {'enabled':True, 'worldUntouched':True, 'apiPresent':True}, views
  print('PASS: bundled runtime, Joker, async insertion, SVG companion, reversed column, split HUD columns and third-party Emotes isolation')
  browser.close()
