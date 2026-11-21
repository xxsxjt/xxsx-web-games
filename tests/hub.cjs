'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {FakeDocument} = require('./support/dom.cjs');

const root = path.join(__dirname, '..');
const key = 'xxsxWebGamesHubV1';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'src/hub.js'), 'utf8');
const context = {module: {exports: {}}, Promise};
vm.runInNewContext(source, context, {filename: 'src/hub.js'});
const hub = context.module.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const legacyRoutes = {
  expedition: 'play.html#game/expedition', border: 'play.html#game/border',
  blackbox: 'play.html#game/blackbox', salvage: 'play.html#game/salvage',
  lab: 'play.html#game/lab', relay: 'play.html#game/relay',
  shell: 'games/shell-heist.html', seconds: 'games/borrowed-seconds.html', overprint: 'games/overprint.html'
};
const preservedSaves = ['neonDriftProfileV1', 'neonBorderTacticsSaveV1', 'xxsxCircuitCampaignV1',
  'xxsxSalvageExpeditionV1', 'xxsxEchoDeckV1', 'xxsxRelayDefenseV1', 'xxsxShellHeistV1',
  'xxsxShellHeistCampaignV1', 'xxsxBorrowedSecondsV1', 'xxsxEmberConvoyV1', 'unrelated']
  .map(name => [name, JSON.stringify({keep: name})]);

const fixture = [
  {id: 'expedition', name: '月面前哨', type: '动作', description: '自由移动、自动瞄准，挑战 Boss。', controls: 'WASD / 触屏', save: '本机成长记录', format: '短局', status: '测试版', cover: 'assets/icons/expedition-v1.webp', tags: ['生存']},
  {id: 'lab', name: '回声牌局', type: '卡牌', description: '构筑卡组，规划攻击与屏障。', controls: '点击 / 触屏', save: '每步保存', format: '战役', status: '测试版', cover: 'assets/icons/lab-v1.webp', keywords: ['Build']},
  {id: 'shell', name: '寄壳行动', type: '解谜', description: '借用壳体能力穿过设施。', controls: '方向键 / 触屏按钮', save: '竖切片记录', format: '固定关卡', entry: 'games/shell-heist.html', cover: 'assets/icons/shell-heist.svg'},
  {id: 'borrowed-seconds', name: '借来的十秒', type: '动作', description: '借用时间突围，规划短暂的行动。', controls: '点击 / 触屏', save: '本机记录', format: '短局', entry: 'games/borrowed-seconds.html', cover: 'assets/icons/borrowed-seconds.svg'},
  {id: 'overprint', name: '叠印工单', type: '解谜', description: '复原样张，后印覆盖先印，空格要留白。', controls: '点击 / 键盘 / 触屏', save: '无存档', format: '单关 A01', entry: 'games/overprint.html', cover: 'assets/icons/overprint.svg'}
];

class MemoryStorage {
  constructor(record = null) {
    this.values = new Map(preservedSaves);
    if (record !== null) this.seed(record);
    this.readError = false;
    this.writeError = false;
    this.calls = [];
  }
  getItem(name) {
    this.calls.push(['get', name]);
    if (this.readError) throw new Error('Storage read blocked');
    return this.values.has(name) ? this.values.get(name) : null;
  }
  setItem(name, value) {
    this.calls.push(['set', name]);
    if (this.writeError) throw new Error('Storage quota/permission failure');
    this.values.set(name, String(value));
  }
  seed(record) { this.values.set(key, typeof record === 'string' ? record : JSON.stringify(record)); }
  saved() { return JSON.parse(this.values.get(key)); }
  verifyScope() {
    assert(this.calls.every(([, name]) => name === key), 'hub must touch only its own storage key');
    for (const [name, bytes] of preservedSaves) assert.equal(this.values.get(name), bytes, 'preserve non-hub save: ' + name);
  }
}

function testPathsAndCatalog() {
  const base = 'https://games.example/catalog/';
  for (const value of ['games/borrowed-seconds.html', 'games/shell-heist.html', 'games/overprint.html', 'games/ember-convoy.html', './games/shell-heist.html', 'play.html', 'games/demo.v2.html']) {
    const entry = hub.safeEntry(value);
    assert.equal(entry, value.replace(/^\.\//, ''));
    assert.equal(new URL(entry, base).origin, new URL(base).origin);
    assert(new URL(entry, base).pathname.startsWith('/catalog/'));
  }
  for (const value of [
    'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'https://remote.example/game.html',
    '//remote.example/game.html', '/games/a.html', '../a.html', '././games/a.html', './games/../a.html',
    'games/../../a.html', 'games/./a.html', 'games//a.html', 'games\\a.html', 'games/%2e%2e/a.html',
    'games/%252e%252e/a.html', 'games%2fa.html', 'games/a.html#x', 'games/a.html?x=1',
    'games/a.html\n', ' games/a.html', 'games/a.html" onmouseover="x', 'games/<img>.html',
    'games/a.js', 'games/.hidden.html', '', null, undefined, 3, ['games/a.html'], {toString: () => 'games/a.html'}
  ]) assert.equal(hub.safeEntry(value), '', 'unsafe entry: ' + String(value));

  const games = hub.normalizeCatalog(fixture);
  assert.equal(games[0].href, 'play.html#game/expedition');
  assert.equal(games[2].href, 'games/shell-heist.html');
  assert.equal(games[3].href, 'games/borrowed-seconds.html');
  assert.equal(games[4].href, 'games/overprint.html');
  assert.equal(hub.normalizeCatalog([{...fixture[0], entry: '//remote.example/game.html', cover: 'javascript:evil'}])[0].href, 'play.html#game/expedition');
  assert.equal(hub.normalizeCatalog([{...fixture[0], cover: 'assets/../private.svg'}])[0].cover, '');
  assert.equal(hub.safe('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
  for (const bad of [null, {}, [], [null], [{id: '<img>', name: 'x'}], [{id: 'x', name: 3}], [fixture[0], fixture[0]]]) assert.throws(() => hub.normalizeCatalog(bad));

  const registered = JSON.parse(fs.readFileSync(path.join(root, 'content/games.json'), 'utf8'));
  const catalog = hub.normalizeCatalog(registered);
  assert.equal(catalog.length, 10, 'V60 registers one new game beside the original nine');
  for (const [id, href] of Object.entries(legacyRoutes)) {
    const game = catalog.find(item => item.id === id);
    assert(game, 'existing entry missing: ' + id);
    assert.equal(game.href, href, 'preserve existing navigation: ' + id);
  }
  const ember = catalog.find(item => item.id === 'ember-convoy');
  assert(ember, 'Ember Convoy must be registered');
  assert.equal(ember.href, 'games/ember-convoy.html');
  assert.equal(ember.cover, 'assets/icons/ember-convoy.svg');
  assert.equal(ember.type, '战术');
  assert.deepEqual(plain(hub.filterGames(catalog, {query: '余烬', type: '战术'}, []).map(game => game.id)), ['ember-convoy']);
}

function testSearch() {
  const games = hub.normalizeCatalog(fixture);
  const find = (query, type = '', favoritesOnly = false, favorites = []) => plain(hub.filterGames(games, {query, type, favoritesOnly}, favorites).map(game => game.id));
  assert.deepEqual(find('月面'), ['expedition']);
  assert.deepEqual(find('自动瞄准'), ['expedition']);
  assert.deepEqual(find('解谜'), ['shell', 'overprint']);
  assert.deepEqual(find('复原样张', '解谜'), ['overprint']);
  assert.deepEqual(find('ＷＡＳＤ BOSS'), ['expedition']);
  assert.deepEqual(find('  自动   触屏  '), ['expedition']);
  assert.deepEqual(find('每步保存'), ['lab']);
  assert.deepEqual(find('固定关卡'), ['shell']);
  assert.deepEqual(find('生存'), ['expedition']);
  assert.deepEqual(find('BUILD'), ['lab']);
  assert.deepEqual(find('动作', '动作', true, ['borrowed-seconds']), ['borrowed-seconds']);
  assert.deepEqual(find('', '解谜', true, ['expedition']), []);
  assert.deepEqual(find('壳', '解谜', true, ['shell']), ['shell']);
  assert.deepEqual(find('   '), fixture.map(game => game.id));
  assert.deepEqual(find('<img src=x>'), []);
  assert.equal(games.length, fixture.length);
}

function testDecodeAndStore() {
  assert.deepEqual(plain(hub.decodeState(null)), {state: {favorites: [], recent: []}, writable: true});
  for (const invalid of ['{bad', 'null', '[]', '3', '{}', '{"unexpected":[]}', '{"favorites":null}', '{"recent":{}}']) assert.equal(hub.decodeState(invalid).writable, false);
  const partial = hub.decodeState('{"favorites":["shell",4,"<img>","shell"],"recent":[]}');
  assert.equal(partial.writable, false);
  assert.deepEqual(plain(partial.state.favorites), ['shell']);
  assert.equal(hub.decodeState('{"favorites":[]}').writable, true);
  const decoded = hub.decodeState(JSON.stringify({favorites: ['shell', 'shell', 'old-unlisted'], recent: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'a']}));
  assert.deepEqual(plain(decoded.state.favorites), ['shell', 'old-unlisted']);
  assert.deepEqual(plain(decoded.state.recent), ['a', 'b', 'c', 'd', 'e', 'f']);

  const memory = new MemoryStorage({favorites: ['shell', 'old-unlisted'], recent: ['lab']});
  const first = hub.createStore(() => memory);
  const second = hub.createStore(() => memory);
  assert.equal(first.refresh(), true);
  second.refresh();
  first.favorite('expedition', true);
  second.opened('borrowed-seconds');
  assert.deepEqual(memory.saved().favorites, ['shell', 'old-unlisted', 'expedition'], 'recent writes must not lose a newer favorite from another page');
  second.favorite('shell', false);
  first.opened('lab');
  assert.deepEqual(memory.saved().favorites, ['old-unlisted', 'expedition'], 'stale snapshots must not bring a removed favorite back');
  assert.deepEqual(memory.saved().recent, ['lab', 'borrowed-seconds']);
  const snapshot = first.snapshot();
  snapshot.favorites.length = 0;
  assert.deepEqual(plain(first.snapshot().favorites), ['old-unlisted', 'expedition']);
  const calls = memory.calls.length;
  assert.equal(first.favorite('../x', true), false);
  assert.equal(memory.calls.length, calls);
  memory.verifyScope();

  let denied = true;
  const blockedMemory = new MemoryStorage({favorites: ['shell'], recent: []});
  const blocked = hub.createStore(() => { if (denied) throw new Error('Storage getter denied'); return blockedMemory; });
  assert.equal(blocked.refresh(), false);
  blocked.favorite('expedition', true);
  blocked.opened('lab');
  assert.deepEqual(plain(blocked.snapshot().favorites), ['expedition']);
  assert.equal(blocked.snapshot().issue, 'read');
  assert.equal(blocked.snapshot().pending, true);
  denied = false;
  blockedMemory.writeError = true;
  assert.equal(blocked.save(), false);
  assert.equal(blocked.snapshot().issue, 'write');
  assert.deepEqual(plain(blocked.snapshot().favorites), ['shell', 'expedition']);
  blockedMemory.seed({favorites: ['shell', 'borrowed-seconds'], recent: ['borrowed-seconds']});
  blocked.refresh();
  assert.deepEqual(plain(blocked.snapshot().favorites), ['shell', 'borrowed-seconds', 'expedition']);
  blockedMemory.writeError = false;
  assert.equal(blocked.save(), true);
  assert.equal(blocked.snapshot().pending, false);
  assert.deepEqual(blockedMemory.saved().recent, ['lab', 'borrowed-seconds']);
  blockedMemory.verifyScope();

  const corruptMemory = new MemoryStorage('{bad');
  const corrupt = hub.createStore(() => corruptMemory);
  assert.equal(corrupt.refresh(), false);
  corrupt.favorite('shell', true);
  corrupt.opened('lab');
  corrupt.refresh();
  assert.equal(corruptMemory.values.get(key), '{bad', 'malformed bytes must remain unchanged');
  assert.deepEqual(plain(corrupt.snapshot().favorites), ['shell']);
  assert.equal(corrupt.snapshot().issue, 'corrupt');
  assert.equal(corruptMemory.calls.filter(([operation]) => operation === 'set').length, 0);
  corruptMemory.seed({favorites: ['expedition'], recent: []});
  assert.equal(corrupt.save(), true);
  assert.deepEqual(corruptMemory.saved(), {favorites: ['expedition', 'shell'], recent: ['lab']});
  corruptMemory.seed('{"favorites": ["lab", null], "recent": []}');
  corrupt.refresh();
  assert.deepEqual(plain(corrupt.snapshot().favorites), ['expedition', 'shell'], 'later corrupt events must not erase the last valid in-memory snapshot');
  corruptMemory.verifyScope();
}

function harness(options = {}) {
  const doc = new FakeDocument(html);
  const storage = options.storage || new MemoryStorage({favorites: [], recent: []});
  const listeners = {}, timers = new Map();
  const fetches = [];
  let timerId = 0;
  const win = {
    localStorage: storage,
    location: {hash: options.hash || '', replace(value) { this.replaced = value; }},
    AbortController,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
    dispatch(type, event) { for (const listener of listeners[type] || []) listener(event); },
    fetch(url, init) {
      fetches.push({url, init});
      if (options.fetch) return options.fetch(url, init);
      return Promise.resolve({ok: true, json: () => Promise.resolve(options.games || fixture)});
    }
  };
  hub.start(win, doc);
  return {
    doc, win, storage, fetches, timers,
    byId: id => doc.getElementById(id),
    elements: selector => doc.querySelectorAll(selector),
    one: (attribute, value, container = doc) => container.querySelectorAll('[' + attribute + ']').find(node => value === undefined || node.getAttribute(attribute) === value),
    input(value) { const search = doc.getElementById('gameSearch'); search.value = value; search.focus(); search.dispatch('input'); },
    fireTimers() { for (const callback of [...timers.values()]) callback(); }
  };
}

async function settle() { for (let index = 0; index < 20; index++) await Promise.resolve(); }

async function testRegisteredEmberEntry() {
  const games = JSON.parse(fs.readFileSync(path.join(root, 'content/games.json'), 'utf8'));
  const favorites = Object.keys(legacyRoutes);
  const memory = new MemoryStorage({favorites, recent: ['expedition', 'lab', 'shell']});
  const h = harness({games, storage: memory});
  await settle();
  assert.equal(h.elements('article').length, 10);
  assert.equal(h.byId('favoriteCount').textContent, '9', 'new catalogue must retain every existing favorite');
  for (const [id, href] of Object.entries(legacyRoutes)) assert.equal(h.one('data-open', id, h.byId('games')).getAttribute('href'), href);
  h.input('余烬');
  assert.equal(h.elements('article').length, 1);
  const open = h.one('data-open', 'ember-convoy', h.byId('games'));
  assert.equal(open.getAttribute('href'), 'games/ember-convoy.html');
  h.one('data-favorite', 'ember-convoy').click();
  assert.deepEqual(memory.saved().favorites, favorites.concat('ember-convoy'));
  assert.equal(h.one('data-open', 'ember-convoy', h.byId('games')).click().defaultPrevented, false);
  assert.deepEqual(memory.saved().recent, ['ember-convoy', 'expedition', 'lab', 'shell']);
  const restored = harness({games, storage: memory});
  await settle();
  assert.equal(restored.byId('favoriteCount').textContent, '10');
  assert.equal(restored.one('data-open', 'ember-convoy', restored.byId('recentGames')).getAttribute('href'), 'games/ember-convoy.html');
  memory.verifyScope();
}

async function testDomInteractions() {
  const memory = new MemoryStorage({favorites: ['shell', 'old-unlisted'], recent: ['old-unlisted', 'expedition', 'lab', 'shell', 'borrowed-seconds']});
  const h = harness({storage: memory});
  assert.equal(h.byId('catalogControls').disabled, true);
  assert.equal(h.byId('games').getAttribute('aria-busy'), 'true');
  await settle();
  assert.equal(h.fetches.length, 1);
  assert.equal(h.fetches[0].url, 'content/games.json');
  assert.equal(h.timers.size, 0);
  assert.equal(h.byId('catalogControls').disabled, false);
  assert.equal(h.byId('games').getAttribute('aria-busy'), 'false');
  assert.equal(h.elements('article').length, fixture.length);
  assert.equal(h.byId('resultsSummary').textContent, `显示 ${fixture.length} / ${fixture.length} 款作品`);
  assert.equal(h.byId('favoriteCount').textContent, '1');
  assert.deepEqual(h.byId('recentGames').querySelectorAll('[data-open]').map(node => node.dataset.open), ['expedition', 'lab', 'shell']);
  assert.equal(h.one('data-open', 'shell').getAttribute('href'), 'games/shell-heist.html');
  assert.equal(h.one('data-open', 'borrowed-seconds').getAttribute('href'), 'games/borrowed-seconds.html');
  assert.equal(h.one('data-open', 'overprint').getAttribute('href'), 'games/overprint.html');
  assert.equal(h.one('data-open', 'expedition').getAttribute('href'), 'play.html#game/expedition');
  assert.equal(h.elements('script').length, 1);
  assert.equal(h.elements('script')[0].getAttribute('src'), 'src/hub.js', 'home must load only the hub script, not a legacy game bundle');
  const about = h.elements('a').find(node => node.getAttribute('href') === 'https://github.com/xxsxjt/xxsx-web-games');
  assert.equal(about.getAttribute('aria-label'), '关于项目，查看 GitHub 仓库');

  h.input('ＢＯＳＳ 触屏');
  assert.equal(h.elements('article').length, 1);
  assert.equal(h.byId('resultsSummary').textContent, `显示 1 / ${fixture.length} 款作品 · 搜索「ＢＯＳＳ 触屏」`);
  h.one('data-type', '卡牌').click();
  assert.equal(h.elements('article').length, 0);
  assert.equal(h.byId('games').querySelector('h2').textContent, '没有找到匹配的作品');
  h.byId('clearSearch').click();
  assert.equal(h.elements('article').length, 1);
  assert.equal(h.one('data-type', '卡牌').getAttribute('aria-pressed'), 'true', 'clearing search must retain the type filter');
  assert.equal(h.doc.activeElement, h.byId('gameSearch'));
  h.byId('resetFilters').click();
  assert.equal(h.elements('article').length, fixture.length);
  assert.equal(h.byId('resetFilters').hidden, true);

  h.one('data-favorite', 'expedition').click();
  assert.equal(h.one('data-favorite', 'expedition').getAttribute('aria-pressed'), 'true');
  assert.equal(h.doc.activeElement, h.one('data-favorite', 'expedition'), 'favorite rerender must restore keyboard focus');
  h.byId('favoritesFilter').click();
  assert.equal(h.elements('article').length, 2);
  h.one('data-type', '解谜').click();
  assert.equal(h.elements('article').length, 1);
  assert.equal(h.byId('favoritesFilter').getAttribute('aria-pressed'), 'true');
  h.input('壳');
  assert.equal(h.elements('article').length, 1);
  h.input('绝无此词');
  assert.equal(h.elements('article').length, 0);
  h.one('data-clear-search').click();
  assert.equal(h.elements('article').length, 1);
  assert.equal(h.one('data-type', '解谜').getAttribute('aria-pressed'), 'true');
  assert.equal(h.byId('favoritesFilter').getAttribute('aria-pressed'), 'true');
  h.one('data-favorite', 'shell').click();
  assert.equal(h.elements('article').length, 0);
  assert.equal(h.byId('games').querySelector('h2').textContent, '当前条件下没有作品');
  assert.equal(h.doc.activeElement, h.byId('favoritesFilter'), 'removing the last visible favorite must leave a keyboard destination');
  assert.deepEqual(memory.saved().favorites, ['old-unlisted', 'expedition']);
  h.one('data-reset').click();
  assert.equal(h.elements('article').length, fixture.length);

  h.input('时间');
  const composing = h.byId('gameSearch').dispatch('keydown', {key: 'Escape', isComposing: true});
  assert.equal(composing.defaultPrevented, false);
  assert.equal(h.byId('gameSearch').value, '时间');
  const escape = h.byId('gameSearch').dispatch('keydown', {key: 'Escape', isComposing: false});
  assert.equal(escape.defaultPrevented, true);
  assert.equal(h.byId('gameSearch').value, '');
  assert.equal(h.elements('article').length, fixture.length);

  const open = h.one('data-open', 'borrowed-seconds', h.byId('games'));
  const event = open.click();
  assert.equal(event.defaultPrevented, false, 'normal game navigation must not be intercepted');
  assert(h.one('data-open', 'borrowed-seconds', h.byId('games')) === open, 'opening a game must not replace the clicked anchor');
  assert.equal(memory.saved().recent[0], 'borrowed-seconds');
  assert.equal(h.byId('recentGames').querySelectorAll('[data-open]')[0].dataset.open, 'borrowed-seconds');
  h.win.dispatch('pageshow', {persisted: true});
  assert.equal(h.byId('recentGames').querySelectorAll('[data-open]')[0].dataset.open, 'borrowed-seconds');
  memory.verifyScope();
}

async function testStorageEventsAndFailures() {
  const memory = new MemoryStorage({favorites: ['shell'], recent: []});
  const h = harness({storage: memory});
  await settle();
  memory.writeError = true;
  h.one('data-favorite', 'expedition').click();
  assert.equal(h.byId('storageMessage').hidden, false);
  assert.equal(h.byId('hubNotice').textContent, '浏览器未能保存目录记录。改动暂留在本页，关闭页面后可能丢失。');
  h.input('触屏');
  assert.equal(h.one('data-favorite', 'expedition').getAttribute('aria-pressed'), 'true', 'search rerenders must retain unsaved page favorites');
  memory.seed({favorites: ['shell', 'lab'], recent: ['lab']});
  const focused = h.one('data-favorite', 'expedition');
  focused.focus();
  const writes = memory.calls.filter(([operation]) => operation === 'set').length;
  h.win.dispatch('storage', {key, newValue: '{malicious-or-stale-event-value'});
  assert.equal(h.doc.activeElement, h.one('data-favorite', 'expedition'));
  assert.notEqual(h.doc.activeElement, focused, 'the replacement control should hold focus after an external refresh');
  assert.equal(h.byId('favoriteCount').textContent, '3');
  assert.equal(memory.calls.filter(([operation]) => operation === 'set').length, writes, 'storage refreshes must not write back');
  const before = memory.calls.length;
  h.win.dispatch('storage', {key: 'xxsxEchoDeckV1'});
  assert.equal(memory.calls.length, before, 'unrelated storage events must not touch hub state');
  memory.writeError = false;
  h.byId('retryStorage').click();
  assert.equal(h.byId('storageMessage').hidden, true);
  assert.equal(h.doc.activeElement, h.byId('favoritesFilter'));
  assert.deepEqual(memory.saved().favorites, ['shell', 'lab', 'expedition']);

  memory.seed('{bad');
  h.win.dispatch('storage', {key});
  assert.equal(h.byId('favoriteCount').textContent, '3');
  assert.equal(h.byId('hubNotice').textContent, '目录记录格式异常，未覆盖原记录。本页改动暂不保存，各游戏存档未改动。');
  h.one('data-favorite', 'lab').click();
  assert.equal(memory.values.get(key), '{bad');
  assert.equal(h.one('data-favorite', 'lab').getAttribute('aria-pressed'), 'false');
  h.input('');
  assert.equal(h.one('data-favorite', 'shell').getAttribute('aria-pressed'), 'true');
  memory.seed({favorites: ['shell', 'lab', 'borrowed-seconds'], recent: []});
  h.byId('retryStorage').click();
  assert.deepEqual(memory.saved().favorites, ['shell', 'borrowed-seconds']);
  assert.equal(h.byId('storageMessage').hidden, true);
  memory.values.delete(key);
  h.win.dispatch('storage', {key: null});
  assert.equal(h.byId('favoriteCount').textContent, '0', 'a clear storage event must safely re-read current bytes');
  h.byId('favoritesFilter').click();
  assert.equal(h.byId('games').querySelector('h2').textContent, '还没有收藏作品');
  const emptyAction = h.one('data-reset');
  emptyAction.focus();
  h.win.dispatch('storage', {key});
  assert.equal(h.doc.activeElement, h.one('data-reset'), 'external updates must also preserve empty-state action focus');
  assert.notEqual(h.doc.activeElement, emptyAction);
  memory.verifyScope();

  const unreadable = new MemoryStorage({favorites: ['shell'], recent: []});
  unreadable.readError = true;
  const blocked = harness({storage: unreadable});
  await settle();
  assert.equal(blocked.elements('article').length, fixture.length, 'unreadable storage must not prevent loading games');
  assert.equal(blocked.byId('storageMessage').hidden, false);
  blocked.one('data-favorite', 'lab').click();
  blocked.input('牌');
  assert.equal(blocked.one('data-favorite', 'lab').getAttribute('aria-pressed'), 'true');
  unreadable.readError = false;
  blocked.byId('retryStorage').click();
  assert.deepEqual(unreadable.saved().favorites, ['shell', 'lab']);
  assert.equal(blocked.byId('storageMessage').hidden, true);
  unreadable.verifyScope();
}

async function testEscaping() {
  const name = '<img src=x onerror="alert(1)"> & "作\'品"';
  const type = '解谜"><button autofocus>';
  const games = [{...fixture[0], name, type, description: '</p><svg onload="evil()">', controls: '<script>x</script>', save: '" & <iframe>', entry: 'javascript:evil()', cover: 'x" onerror="evil()'}];
  const memory = new MemoryStorage({favorites: [], recent: ['expedition']});
  const h = harness({games, storage: memory});
  await settle();
  assert.equal(h.byId('games').querySelector('h2').textContent, name);
  assert.equal(h.byId('games').querySelector('p').textContent, games[0].description);
  assert.equal(h.one('data-type', type).textContent, type);
  assert.equal(h.byId('recentGames').querySelector('a').textContent, name);
  assert.equal(h.one('data-open', 'expedition').getAttribute('href'), 'play.html#game/expedition');
  assert.equal(h.elements('svg').length, 0);
  assert.equal(h.elements('iframe').length, 0);
  assert.equal(h.elements('img').length, 0, 'a rejected cover must use the safe text placeholder');
  assert.equal(h.elements('script').length, 1);
  assert.equal(h.elements('[onerror]').length, 0);
  assert.equal(h.elements('[autofocus]').length, 0);
  h.input('<img src=x>');
  assert.equal(h.byId('resultsSummary').textContent, '显示 0 / 1 款作品 · 搜索「<img src=x>」');
  assert.equal(h.elements('img').length, 0, 'queries must render as text, never HTML');
  memory.verifyScope();
}

async function testLoadingAndLegacyRoutes() {
  let fail = true;
  const h = harness({fetch: () => {
    if (fail) return Promise.reject(new Error('Offline'));
    return Promise.resolve({ok: true, json: () => Promise.resolve(fixture)});
  }});
  await settle();
  assert.equal(h.elements('article').length, 0);
  assert.equal(h.byId('resultsSummary').textContent, '目录未能载入，暂无结果数。');
  assert.equal(h.byId('catalogControls').disabled, true);
  assert.equal(h.byId('games').getAttribute('aria-busy'), 'false');
  assert(h.one('data-retry-catalog'));
  h.one('data-retry-catalog').click();
  await settle();
  assert.equal(h.doc.activeElement, h.one('data-retry-catalog'), 'failed keyboard retries must focus the new retry control');
  fail = false;
  h.one('data-retry-catalog').click();
  await settle();
  assert.equal(h.elements('article').length, fixture.length);
  assert.equal(h.doc.activeElement, h.byId('gameSearch'));
  assert.equal(h.byId('catalogControls').disabled, false);

  for (const response of [
    {ok: false, json: () => { throw new Error('Should not decode an HTTP error'); }},
    {ok: true, json: () => Promise.reject(new Error('Bad JSON'))},
    {ok: true, json: () => Promise.resolve({games: []})},
    {ok: true, json: () => Promise.resolve([{id: '<img>', name: 'Bad ID'}])}
  ]) {
    const broken = harness({fetch: () => Promise.resolve(response)});
    await settle();
    assert.equal(broken.elements('article').length, 0);
    assert(broken.one('data-retry-catalog'));
    assert.equal(broken.timers.size, 0);
  }

  const timeout = harness({fetch: (_, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('Aborted'))))});
  await settle();
  timeout.fireTimers();
  await settle();
  assert.equal(timeout.byId('games').querySelector('p').textContent, '加载超时，请检查网络后重试。收藏不会因此清除。');
  assert.equal(timeout.timers.size, 0);

  for (const hash of ['#game/shell', '#game/expedition', '#station/bridge']) {
    const legacy = harness({hash});
    await settle();
    assert.equal(legacy.win.location.replaced, 'play.html' + hash);
    assert.equal(legacy.fetches.length, 0);
    assert.equal(legacy.storage.calls.length, 0, 'legacy redirects must not read or modify any saves');
  }
  const hashChange = harness();
  await settle();
  hashChange.win.location.hash = '#games';
  hashChange.win.dispatch('hashchange', {});
  assert.equal(hashChange.win.location.replaced, undefined);
  hashChange.win.location.hash = '#game/shell';
  hashChange.win.dispatch('hashchange', {});
  assert.equal(hashChange.win.location.replaced, 'play.html#game/shell');
}

(async function () {
  testPathsAndCatalog();
  testSearch();
  testDecodeAndStore();
  await testRegisteredEmberEntry();
  await testDomInteractions();
  await testStorageEventsAndFailures();
  await testEscaping();
  await testLoadingAndLegacyRoutes();
  console.log('PASS hub: safe local entries, real combined search counts, escaped rendering, keyboard focus, legacy routes, storage failure/recovery/merge, cross-tab refresh and catalogue retries');
})().catch(error => { console.error(error); process.exitCode = 1; });
