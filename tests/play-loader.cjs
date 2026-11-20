'use strict';

// Source-only by default; no browser, server, build, packages, or test-only
// production globals are needed. To check a release as well:
//   node tests/play-loader.cjs --dist
//   node tests/play-loader.cjs --root <release-directory> [--manifest <file>]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');

const repository = path.resolve(__dirname, '..');
let root = repository, manifestPath;
for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index];
  if (arg === '--dist') root = path.join(repository, 'dist');
  else if (arg === '--root' || arg === '--manifest') {
    const value = process.argv[++index];
    assert(value && !value.startsWith('--'), arg + ' requires a path');
    if (arg === '--root') root = path.resolve(value);
    else manifestPath = path.resolve(value);
  } else if (!arg.startsWith('-') && index === 2) root = path.resolve(arg);
  else throw new Error('Unknown argument: ' + arg);
}
if (!manifestPath && root !== repository && fs.existsSync(path.join(root, 'release-manifest.json'))) manifestPath = path.join(root, 'release-manifest.json');
const manifest = manifestPath ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
const base = new URL('https://fixture.invalid/games-site/');
function localFile(reference) {
  assert.equal(typeof reference, 'string', 'resource URL must be a string');
  const url = new URL(reference, base);
  assert.equal(url.origin, base.origin, 'fixture must not access external resources');
  assert(url.pathname.startsWith(base.pathname), 'resource escapes the page directory');
  const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
  assert(relative && !relative.split(/[\\/]/).includes('..'), 'invalid local resource path');
  return path.join(root, relative);
}
const readResource = reference => fs.readFileSync(localFile(reference), 'utf8');
const html = readResource('play.html');

function decode(value) {
  return String(value).replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, entity => {
    const names = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'"};
    if (names[entity.toLowerCase()] !== undefined) return names[entity.toLowerCase()];
    return String.fromCodePoint(parseInt(entity.slice(2, -1).replace(/^x/i, ''), /^&#x/i.test(entity) ? 16 : 10));
  });
}

// A deliberately bounded DOM model parses the real page and rendered controls.
// Missing IDs/selectors are not auto-created, so incomplete page fixtures fail.
class Element {
  constructor(document, tag, text = '') {
    this.ownerDocument = document;
    this.tagName = tag.toLowerCase();
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = new Map();
    this.content = text;
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.scrollTop = 0;
    const properties = {};
    this.style = {setProperty(name, value) { properties[name] = String(value); }, getPropertyValue(name) { return properties[name] || ''; }};
    this.classList = {
      contains: name => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => { const on = force === undefined ? !this.classList.contains(name) : Boolean(force); this.classList[on ? 'add' : 'remove'](name); return on; }
    };
  }
  get children() { return this.childNodes.filter(node => node.tagName !== '#text'); }
  get parentElement() { return this.parentNode?.tagName === '#document' ? null : this.parentNode; }
  get className() { return this.attributes.class || ''; }
  set className(value) { this.attributes.class = String(value); }
  get id() { return this.attributes.id || ''; }
  get textContent() { return this.tagName === '#text' ? this.content : this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) { this.clear(); this.appendChild(new Element(this.ownerDocument, '#text', String(value))); }
  get innerHTML() { return this.childNodes.map(node => node.tagName === '#text' ? node.content : '<' + node.tagName + '>' + node.innerHTML + '</' + node.tagName + '>').join(''); }
  set innerHTML(value) { this.clear(); parseInto(this, String(value)); }
  get src() { return this.attributes.src || ''; }
  set src(value) { this.attributes.src = String(value); }
  clear() { this.childNodes.forEach(node => { node.parentNode = null; }); this.childNodes = []; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    if (['hidden', 'disabled', 'checked'].includes(name)) this[name] = true;
    if (name === 'value') this.value = String(value);
  }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  appendChild(node) {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    this.childNodes.push(node);
    if (this === this.ownerDocument?.head && node.tagName === 'script') this.ownerDocument.appendScript?.(node);
    return node;
  }
  remove() {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this);
    this.parentNode = null;
  }
  matches(selector) {
    if (this.tagName === '#text') return false;
    return selector.split(',').some(part => {
      const chain = part.trim().split(/\s+/);
      if (!this.matchesSimple(chain.pop())) return false;
      let ancestor = this.parentNode;
      while (chain.length) {
        const next = chain.pop();
        while (ancestor && !ancestor.matchesSimple(next)) ancestor = ancestor.parentNode;
        if (!ancestor) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    });
  }
  matchesSimple(selector) {
    let accepted = true;
    selector = selector.replace(/:not\(([^)]+)\)/g, (_, inner) => { if (this.matchesSimple(inner)) accepted = false; return ''; });
    const rest = selector.replace(/(^[a-z][\w-]*|\*)|([.#][\w-]+)|(\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\])/gi, (token, tag, named, attr, key, value) => {
      if (tag && tag !== '*' && this.tagName !== tag.toLowerCase()) accepted = false;
      if (named?.startsWith('#') && this.id !== named.slice(1)) accepted = false;
      if (named?.startsWith('.') && !this.classList.contains(named.slice(1))) accepted = false;
      if (attr && (!this.hasAttribute(key) || value !== undefined && this.getAttribute(key) !== value)) accepted = false;
      return '';
    });
    assert.equal(rest, '', 'unsupported fixture selector: ' + selector);
    return accepted;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => node.childNodes.forEach(child => { if (child.matches(selector)) found.push(child); visit(child); });
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (node.matches(selector)) return node; return null; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  dispatch(type, details = {}) {
    const event = {type, target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...details};
    for (let node = this; node; node = node.parentNode) {
      event.currentTarget = node;
      for (const callback of node.listeners.get(type) || []) callback(event);
      if (event.stopped) break;
    }
    return event;
  }
  click() { if (!this.disabled) { this.focus(); return this.dispatch('click'); } }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return {width: 390, height: 600, left: 0, top: 0, right: 390, bottom: 600}; }
  getClientRects() { return this.hidden || this.classList.contains('hidden') ? [] : [this.getBoundingClientRect()]; }
  getContext() { return this.ownerDocument.canvasContext; }
}

function parseInto(container, markup) {
  const stack = [container], voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const tokens = markup.match(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<[^>]*>|[^<]+/gi) || [];
  for (const token of tokens) {
    if (/^<!/.test(token)) continue;
    if (/^<\//.test(token)) {
      const tag = /^<\/\s*([\w-]+)/.exec(token)?.[1].toLowerCase();
      const index = stack.findLastIndex(node => node.tagName === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    if (token[0] !== '<') { stack[stack.length - 1].appendChild(new Element(container.ownerDocument, '#text', decode(token))); continue; }
    const match = /^<([\w-]+)\b([^>]*)>/.exec(token);
    assert(match, 'malformed fixture markup');
    const node = new Element(container.ownerDocument, match[1]);
    for (const attr of match[2].replace(/\/$/, '').matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) node.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
    stack[stack.length - 1].appendChild(node);
    if (node.tagName === 'script') node.textContent = token.slice(match[0].length).replace(/<\/script\s*>$/i, '');
    else if (!voids.has(node.tagName) && !/\/>$/.test(token)) stack.push(node);
  }
}

function page() {
  const document = new Element(null, '#document');
  document.ownerDocument = document;
  document.hidden = false;
  document.canvasContext = new Proxy({measureText: text => ({width: String(text).length * 6})}, {get: (object, key) => key in object ? object[key] : () => ({addColorStop() {}})});
  document.createElement = tag => new Element(document, tag);
  document.getElementById = id => document.querySelector('#' + id);
  parseInto(document, html);
  document.documentElement = document.querySelector('html');
  document.head = document.querySelector('head');
  document.body = document.querySelector('body');
  document.activeElement = document.body;
  const title = document.querySelector('title');
  Object.defineProperty(document, 'title', {get: () => title.textContent, set: text => { title.textContent = text; }});
  return document;
}

const template = page();
const gameFilesNode = template.getElementById('gameFiles');
assert(gameFilesNode && gameFilesNode.getAttribute('type') === 'application/json', 'real page must declare gameFiles');
const gameFiles = JSON.parse(gameFilesNode.textContent);
const scriptNodes = template.querySelectorAll('script[src]');
assert.equal(scriptNodes.length, 1, 'play.html should have one executable loader, not eager game scripts');
const loaderPath = scriptNodes[0].src;
assert.match(loaderPath, /(?:^|\/)play-loader(?:\.[a-f0-9]+)?\.js$/);
const loaderSource = readResource(loaderPath);
const common = ['catalog', 'core', 'runtime', 'field'];
const short = ['arcade', 'campaignCore', 'salvageExpedition', 'echoDeck', 'relayDefense'];
const extras = {expedition: [], border: ['border'], blackbox: ['blackbox', 'arcade', 'circuit'], relay: short, lab: short, salvage: short, station: []};
const order = kind => common.concat(extras[kind], ['game']);
const globals = {blackbox: 'NeonBlackbox', arcade: 'NeonArcade', circuit: 'NeonCircuitCampaign', border: 'NeonBorderTactics', campaignCore: 'XXSXCampaignCore', salvageExpedition: 'XXSXSalvage', echoDeck: 'XXSXEchoDeck', relayDefense: 'XXSXRelayDefense'};

async function boot(hash, options = {}) {
  const document = page(), loading = document.getElementById('playLoading');
  const calls = {scripts: [], completed: [], fetches: [], replace: [], assign: [], reload: 0, history: [], errors: [], images: [], storage: []};
  const storage = new Map([['neonDriftRogueSoundV2', 'off'], ['unrelated', 'keep'], ['xxsxWebGamesHubV1', '{"favorites":["shell"],"recent":[]}'], ['xxsxShellHeistV1', '{"keep":"shell-save"}'], ['xxsxBorrowedSecondsV1', '{"keep":"new-game-save"}']]);
  const originalStorage = [...storage];
  const localStorage = {
    getItem(key) { calls.storage.push(['get', key]); return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { calls.storage.push(['set', key]); storage.set(key, String(value)); },
    removeItem(key) { calls.storage.push(['remove', key]); storage.delete(key); }
  };
  const timers = new Map(), frames = new Map(), events = new Map();
  let timerId = 0, frameId = 0, seed = options.seed ?? 8128, pendingScripts = 0;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const timestamp = Date.UTC(2026, 10, 20, 12);
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
  }
  const location = {hash, replace: url => calls.replace.push(url), assign: url => calls.assign.push(url), reload: () => { calls.reload++; }};
  const changeHistory = (method, url) => { calls.history.push([method, url]); location.hash = new URL(url, base).hash; };
  const window = {
    document, location, localStorage, devicePixelRatio: 1,
    history: {replaceState: (_state, _title, url) => changeHistory('replace', url), pushState: (_state, _title, url) => changeHistory('push', url)},
    addEventListener(type, callback) { if (!events.has(type)) events.set(type, []); events.get(type).push(callback); },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    setInterval(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearInterval: id => timers.delete(id),
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
    matchMedia: () => ({matches: true, addEventListener() {}}),
    getComputedStyle: () => ({fontFamily: 'sans-serif', getPropertyValue: () => '#111111'})
  };
  class Image {
    constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 768; }
    set src(value) { this.url = value; calls.images.push(value); }
    get src() { return this.url || ''; }
  }
  const fetch = async reference => {
    calls.fetches.push(reference);
    if (options.catalogFailure) throw new Error('injected catalogue fetch failure');
    return {ok: true, json: async () => JSON.parse(readResource(reference))};
  };
  Object.assign(window, {fetch, Image, performance: {now: () => 0}});
  const sandbox = vm.createContext({window, document, location, localStorage, navigator: {}, Image, console, Math: math, Date: FixtureDate, performance: window.performance, fetch,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, setInterval: window.setInterval, clearInterval: window.clearInterval,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame});
  document.appendScript = script => {
    assert.equal(pendingScripts, 0, 'next script appended before the preceding load/error event');
    const name = Object.keys(gameFiles).find(key => gameFiles[key] === script.src);
    assert(name, 'loader requested a URL absent from the actual gameFiles: ' + script.src);
    calls.scripts.push(name);
    pendingScripts++;
    queueMicrotask(() => {
      try {
        if (options.fail === name) { script.onerror?.(new Error('injected resource failure: ' + name)); return; }
        try {
          if (options.omit !== name) vm.runInContext(readResource(script.src), sandbox, {filename: script.src, timeout: 2000});
        } catch (error) {
          // Classic script runtime errors are reported globally but still fire
          // load, unlike a resource/network error. The boot sentinel must help.
          calls.errors.push(error);
        }
        calls.completed.push(name);
        script.onload?.();
      } finally { pendingScripts--; }
    });
  };
  vm.runInContext(loaderSource, sandbox, {filename: loaderPath, timeout: 2000});
  // Drain asynchronous script/load/fetch Promise chains, without real timers or
  // executing any combat/campaign animation loop.
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise(resolve => setImmediate(resolve));
    if (!pendingScripts && (window.NeonGameBooted || !loading.parentNode || calls.replace.length || /暂时未能载入/.test(loading.textContent))) break;
  }
  return {
    window, document, calls, storage, originalStorage, loading, frames, timers,
    changeHash(next, event = 'hashchange') { location.hash = next; for (const callback of events.get(event) || []) callback({type: event}); },
    click(selector) { const node = document.querySelector(selector); assert(node, 'control missing: ' + selector); node.click(); return node; }
  };
}

function healthy(t, kind) {
  assert.deepEqual(t.calls.errors.map(error => error.stack), [], 'actual game scripts must execute without runtime errors');
  assert.deepEqual(t.calls.scripts, order(kind), 'route must load only its own dependencies, sequentially');
  assert.deepEqual(t.calls.completed, order(kind));
  assert.equal(t.window.NeonGameBooted, true, 'real game.js boot sentinel must be set');
  assert.equal(t.loading.parentNode, null, 'successful boot removes the loading overlay');
  for (const [name, global] of Object.entries(globals)) assert.equal(t.window[global] !== undefined, order(kind).includes(name), 'dependency leakage or missing export: ' + name);
  for (const [key, value] of t.originalStorage) assert.equal(t.storage.get(key), value, 'unrelated local saves changed: ' + key);
}

function gameScreen(t, kind) {
  assert(t.document.getElementById('appShell').classList.contains('arcadeGameMode'));
  assert(!t.document.getElementById('arcadeGamePages').classList.contains('hidden'));
  if (kind === 'expedition' || kind === 'border') {
    const id = kind === 'border' ? 'borderTacticsPage' : 'expeditionGamePage';
    assert(!t.document.getElementById(id).classList.contains('hidden'), kind + ' screen is hidden');
  } else {
    const panel = kind === 'relay' ? 'signals' : kind;
    assert(t.document.querySelector('[data-hub-panel="' + panel + '"]').classList.contains('active'));
  }
}

function startLegacyBlackbox(t) {
  const boards = [], generate = t.window.NeonBlackbox.generate;
  // Observe the real generator's returned board; do not alter generated masks,
  // state, moves, seed, solutions, event handlers, or any production source.
  t.window.NeonBlackbox.generate = function(...args) { const board = generate.apply(this, args); boards.push(board); return board; };
  t.click('#blackboxStartBtn');
  assert.equal(boards.length, 1);
  const board = boards[0];
  assert.equal(board.stage, 1);
  assert.equal(board.movesUsed, 0);
  assert.equal(t.window.NeonBlackbox.isSolved(board), false);
  assert.equal(t.document.querySelectorAll('#blackboxGrid button').length, board.cells.length);
  return {boards, board};
}

function solveLegacyLayer(t, board) {
  let clicks = 0;
  for (const index of board.solutionPath) {
    while (board.cells[index].mask !== board.cells[index].solutionMask && !t.window.NeonBlackbox.isSolved(board)) {
      assert(clicks++ < board.moveLimit, 'generated solution should fit the real move budget');
      const tile = t.document.querySelectorAll('#blackboxGrid button')[index];
      assert(tile && !tile.disabled, 'solution tile must be genuinely clickable');
      tile.click();
    }
  }
  assert(t.window.NeonBlackbox.isSolved(board), 'real generated first layer did not connect');
  assert.equal(board.movesUsed, clicks, 'every solution step must use the real tile handler');
  return clicks;
}

let passed = 0, failed = 0;
async function test(name, callback) {
  try { await callback(); passed++; console.log('PASS', name); }
  catch (error) { failed++; console.error('FAIL', name, '\n' + (error.stack || error)); }
}

(async function main() {
  await test('actual page gameFiles and executable loader resolve locally' + (manifest ? ' and match the release manifest' : ' without a build'), () => {
    assert.equal(new Set(Object.values(gameFiles)).size, Object.keys(gameFiles).length);
    for (const reference of [loaderPath, ...Object.values(gameFiles)]) assert(fs.statSync(localFile(reference)).isFile(), 'missing page resource: ' + reference);
    for (const name of new Set(Object.keys(extras).flatMap(order))) assert(gameFiles[name], 'missing dependency mapping: ' + name);
    if (manifest) {
      const resources = [loaderPath, ...Object.values(gameFiles)];
      for (const reference of resources) {
        const record = Object.values(manifest.files).find(file => file.path === reference);
        assert(record, 'page references an unindexed release resource: ' + reference);
        const bytes = fs.readFileSync(localFile(reference));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, 'release resource hash: ' + reference);
      }
    }
  });

  for (const hash of ['#game/shell', '#station/shell']) await test(hash + ' replaces the bookmark before any legacy JS, catalogue request, or storage access', async () => {
    const t = await boot(hash);
    assert.deepEqual(t.calls.replace, ['games/shell-heist.html']);
    assert.deepEqual(t.calls.scripts, []);
    assert.deepEqual(t.calls.fetches, []);
    assert.deepEqual(t.calls.storage, []);
    assert.deepEqual(t.calls.assign, []);
    assert.equal(t.calls.reload, 0);
    assert.equal(t.window.NeonGameBooted, undefined);
    assert.equal(t.window.NeonPlayLoader, undefined);
    assert.deepEqual([...t.storage], t.originalStorage);
  });

  const routes = [
    ['#game/expedition', 'expedition'], ['#game/border', 'border'], ['#game/blackbox', 'blackbox'],
    ['#game/relay', 'relay'], ['#game/lab', 'lab'], ['#game/salvage', 'salvage'],
    ['#station/expedition', 'expedition'], ['#station/border', 'border'], ['#station/blackbox', 'blackbox'],
    ['#station/signals', 'relay'], ['#station/lab', 'lab'], ['#station/salvage', 'salvage']
  ];
  for (const [hash, kind] of routes) await test(hash + ' boots the actual game with isolated dependencies', async () => {
    const t = await boot(hash);
    healthy(t, kind);
    gameScreen(t, kind);
    assert.equal(t.window.location.hash, '#game/' + kind);
    assert.deepEqual(t.calls.replace, []);
    assert.deepEqual(t.calls.assign, []);
    assert.equal(t.calls.reload, 0);
    if (kind !== 'expedition') assert.deepEqual(t.calls.images, [], 'non-shooter entry must not preload shooter images');
    if (hash.startsWith('#station/')) assert(t.calls.history.some(([method, target]) => method === 'replace' && target === '#game/' + kind), 'legacy bookmark should canonicalize without a new history entry');
    if (kind === 'blackbox') assert(t.document.getElementById('circuitCampaign').querySelector('[data-circuit-action="check"]'), 'circuit campaign must mount beside the legacy blackbox');
    if (['relay', 'lab', 'salvage'].includes(kind)) for (const id of ['relayDefense', 'echoDeck', 'salvageExpedition']) assert(t.document.getElementById(id).querySelector('[data-campaign-action="start"]'), 'short-mode collection did not mount: ' + id);
    const catalog = JSON.parse(readResource(t.calls.fetches[0]));
    assert.equal(t.document.title, catalog.find(game => game.id === kind).name + ' · XXSX 游戏站');
  });

  for (const hash of ['#game/bridge', '#station/bridge', '#station/routes', '#station/codex', '#station/chronicle', '#station/workbench']) await test(hash + ' keeps station deep links free of other game engines', async () => {
    const t = await boot(hash);
    healthy(t, 'station');
    assert(t.document.getElementById('appShell').classList.contains('hubMode'));
    const view = hash === '#game/bridge' ? 'bridge' : hash.split('/')[1];
    assert(t.document.querySelector('[data-hub-panel="' + view + '"]').classList.contains('active'));
    assert.equal(t.window.location.hash, '#station/' + view);
    assert.deepEqual(t.calls.assign, []);
  });

  for (const hash of ['', '#arcade', '#game/notregistered', '#station/notregistered']) await test((hash || '(empty hash)') + ' sends the retired collection or unknown deep link home without extra engines', async () => {
    const t = await boot(hash);
    healthy(t, hash === '' || hash === '#arcade' ? 'expedition' : 'station');
    assert.deepEqual(t.calls.assign, ['./']);
    assert.deepEqual(t.calls.replace, []);
    assert.equal(t.calls.reload, 0);
  });

  await test('real blackbox first-layer tile clicks create three upgrade choices and advance to layer two', async () => {
    for (const seed of [8128, 1, 0xdecafbad]) {
      const t = await boot('#game/blackbox', {seed});
      healthy(t, 'blackbox');
      const {boards, board} = startLegacyBlackbox(t);
      assert(solveLegacyLayer(t, board) > 0);
      assert.equal(t.document.getElementById('blackboxStatus').textContent, 'CHOOSE / MODULE');
      const draft = t.document.getElementById('blackboxDraft');
      assert(!draft.classList.contains('hidden'));
      const choices = draft.querySelectorAll('button.arcadeDraftCard');
      assert.equal(choices.length, 3, 'victory must call the actual NeonArcade.offerChoices');
      assert.equal(new Set(choices.map(node => node.textContent)).size, 3);
      assert(choices.every(node => node.querySelector('strong')?.textContent && node.querySelector('span')?.textContent), 'upgrade labels and descriptions must render');
      choices[0].click();
      assert.equal(boards.length, 2, 'choosing a real upgrade should generate the next layer');
      assert.equal(boards[1].stage, 2);
      assert.equal(boards[1].movesUsed, 0);
      assert(draft.classList.contains('hidden'));
      assert.equal(t.document.getElementById('blackboxStage').textContent, '02 / 07');
      assert.equal(t.document.getElementById('blackboxStatus').textContent, 'LAYER 2 / ROUTE');
      assert.deepEqual(t.calls.scripts, order('blackbox'), 'solving must not compensate with hidden dependency loads');
    }
  });

  await test('negative control: omitting arcade still boots, but genuine first-layer victory detects offerChoices regression', async () => {
    const t = await boot('#game/blackbox', {omit: 'arcade'});
    assert.equal(t.window.NeonGameBooted, true);
    assert.equal(t.window.NeonArcade, undefined);
    const {board} = startLegacyBlackbox(t);
    assert.throws(() => solveLegacyLayer(t, board), /offerChoices/);
  });

  await test('short-mode collection switches internally for hashchange and popstate, but incompatible engines navigate away', async () => {
    const t = await boot('#game/relay');
    healthy(t, 'relay');
    t.changeHash('#game/lab');
    gameScreen(t, 'lab');
    t.changeHash('#game/salvage', 'popstate');
    gameScreen(t, 'salvage');
    assert.deepEqual(t.calls.replace, []);
    const catalog = JSON.parse(readResource(t.calls.fetches[0]));
    assert.equal(t.document.title, catalog.find(game => game.id === 'salvage').name + ' · XXSX 游戏站');
    t.changeHash('#game/blackbox');
    assert.deepEqual(t.calls.replace, ['play.html#game/blackbox']);
    assert.equal(t.calls.reload, 1);
    assert.deepEqual(t.calls.scripts, order('relay'), 'incompatible navigation must not mix more scripts into this document');
  });

  await test('real delegated navigation uses loader boundaries; shell redirects without legacy reload', async () => {
    const t = await boot('#game/blackbox');
    healthy(t, 'blackbox');
    for (const kind of ['expedition', 'station', 'blackbox']) assert.equal(t.window.NeonPlayLoader.supports(kind), true);
    for (const kind of ['border', 'relay', 'lab', 'salvage', 'shell']) assert.equal(t.window.NeonPlayLoader.supports(kind), false);
    t.click('[data-arcade-game="border"]');
    assert.deepEqual(t.calls.replace, ['play.html#game/border']);
    assert.equal(t.calls.reload, 1);
    t.window.NeonPlayLoader.navigate('shell');
    assert.deepEqual(t.calls.replace, ['play.html#game/border', 'games/shell-heist.html']);
    assert.equal(t.calls.reload, 1, 'standalone shell navigation must not reload the old play page');
    t.window.NeonPlayLoader.home();
    assert.deepEqual(t.calls.assign, ['./']);
  });

  for (const hash of ['#game/shell', '#station/shell']) await test(hash + ' also redirects safely when restored in an already-booted legacy document', async () => {
    const t = await boot('#game/blackbox');
    healthy(t, 'blackbox');
    t.changeHash(hash);
    assert.deepEqual(t.calls.replace, ['games/shell-heist.html']);
    assert.equal(t.calls.reload, 0);
    assert.deepEqual(t.calls.scripts, order('blackbox'));
  });

  await test('catalogue request failure does not block the real game boot or legacy blackbox upgrade', async () => {
    const t = await boot('#game/blackbox', {catalogFailure: true});
    healthy(t, 'blackbox');
    const {board} = startLegacyBlackbox(t);
    solveLegacyLayer(t, board);
    assert.equal(t.document.querySelectorAll('#blackboxDraft button.arcadeDraftCard').length, 3);
  });

  const failureRoutes = Object.fromEntries(Object.keys(gameFiles).map(name => [name, common.includes(name) || name === 'game' ? 'blackbox' : ['blackbox', 'arcade', 'circuit'].includes(name) ? 'blackbox' : name === 'border' ? 'border' : 'relay']));
  for (const [name, kind] of Object.entries(failureRoutes)) await test('failed ' + name + ' script stops the dependency chain and preserves saves behind a useful retry/home message', async () => {
    const t = await boot('#game/' + kind, {fail: name});
    assert.equal(t.window.NeonGameBooted, undefined);
    const expected = order(kind);
    assert.deepEqual(t.calls.scripts, expected.slice(0, expected.indexOf(name) + 1));
    assert.deepEqual(t.calls.completed, expected.slice(0, expected.indexOf(name)));
    assert(t.loading.parentNode, 'failure overlay must remain present');
    assert.match(t.loading.textContent, /游戏暂时未能载入/);
    assert.match(t.loading.textContent, /刷新重试/);
    assert.match(t.loading.textContent, /已有本机存档仍会保留/);
    assert.equal(t.loading.querySelector('a').getAttribute('href'), './');
    assert.deepEqual([...t.storage], t.originalStorage, 'loader failures must not erase any local storage');
    assert.deepEqual(t.calls.replace, []);
    assert.deepEqual(t.calls.assign, []);
  });

  await test('script load events alone cannot remove loading overlay without the real game boot sentinel', async () => {
    const t = await boot('#game/expedition', {omit: 'game'});
    assert.deepEqual(t.calls.completed, order('expedition'));
    assert.equal(t.window.NeonGameBooted, undefined);
    assert(t.loading.parentNode);
    assert.match(t.loading.textContent, /游戏暂时未能载入/);
    assert.deepEqual([...t.storage], t.originalStorage);
  });

  console.log(`Play loader: ${passed} passed, ${failed} failed (${root === repository ? 'source' : root}${manifest ? ', manifest verified' : ''}).`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
