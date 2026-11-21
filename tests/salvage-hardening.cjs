const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..');
const window = {
  document: { getElementById() { return null; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
for (const name of ['campaign-core', 'salvage-expedition']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), { window, console });
}
const salvage = window.XXSXSalvage;
const clone = value => JSON.parse(JSON.stringify(value));
const KEY = 'xxsxSalvageExpeditionV1';

// Deliberate legal unit fixtures, separate from the natural mounted journeys in
// salvage-journey.cjs. Move real generated cargo, never duplicate item IDs.
function carry(state, kinds) {
  for (const kind of kinds) {
    const deck = state.ground.findIndex(floor => floor.some(item => item.kind === kind));
    assert.notEqual(deck, -1, 'generated cargo exists: ' + kind);
    const at = state.ground[deck].findIndex(item => item.kind === kind);
    state.bag.push(state.ground[deck].splice(at, 1)[0]);
  }
}

function compareRoute(state, goal) {
  assert.equal(salvage.valid(state), true, 'legal resource-boundary fixture');
  const before = JSON.stringify(state);
  const forecast = salvage.plan(state, goal), actual = clone(state);
  assert.equal(JSON.stringify(state), before, 'planning is read-only');
  if (forecast.steps === null) {
    assert.equal(forecast.path.length, 0);
    return forecast;
  }
  for (const cell of forecast.path.slice(1)) {
    if (actual.phase !== 'explore') break;
    assert.equal(salvage.act(actual, 'move', { cell: String(cell) }), true);
    assert.equal(actual.pos, cell, 'planner only includes passable moves');
    assert.equal(salvage.valid(actual), true);
  }
  assert.equal(actual.oxygen, forecast.oxygen, 'oxygen agrees with actual movement');
  assert.equal(actual.hp, forecast.hp, 'armor agrees with actual movement');
  assert.equal(actual.phase === 'explore', forecast.safe, 'survival agrees with actual movement');
  if (!forecast.safe) assert.equal(forecast.failedAt, actual.pos, 'forecast marks the actual loss cell');
  return forecast;
}

function mount(values = new Map()) {
  let onClick;
  const host = {
    innerHTML: '',
    querySelector() { return null; },
    addEventListener(name, fn) { assert.equal(name, 'click'); onClick = fn; }
  };
  const local = {
    document: { getElementById(id) { return id === 'salvageExpedition' ? host : null; } },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    }
  };
  const math = Object.create(Math);
  math.random = () => 0.25;
  const context = vm.createContext({ window: local, console, Math: math, Date: { now: () => 1700000000000 } });
  for (const name of ['campaign-core', 'salvage-expedition']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), context, { timeout: 1000 });
  }
  function button(action, data = {}) {
    for (const match of host.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const dataset = {};
      for (const attr of match[1].matchAll(/\bdata-([\w-]+)="([^"]*)"/g)) {
        dataset[attr[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attr[2];
      }
      if (dataset.campaignAction === action && Object.entries(data).every(([key, value]) => dataset[key] === String(value))) {
        return { dataset, disabled: /(?:^|\s)disabled(?:\s|=|$)/.test(match[1]), attributes: match[1], label: match[2] };
      }
    }
    return null;
  }
  return {
    host, values, engine: local.XXSXSalvage, button,
    click(action, data = {}) {
      const node = button(action, data);
      assert.ok(node, 'rendered action: ' + action);
      assert.equal(node.disabled, false, 'enabled action: ' + action);
      onClick({ target: { closest() { return node; } } });
    },
    state() { return JSON.parse(values.get(KEY)).state; },
    checkpoint() { return JSON.parse(values.get(KEY)); }
  };
}

function checkpoint(state, meta = { runs: 1, clears: 0, best: 0 }) {
  return new Map([[KEY, JSON.stringify({ schema: 1, revision: 1, meta, state })]]);
}

function preview(session, cell) {
  const id = 'salvage-step-' + cell;
  const move = session.button('move', { cell });
  assert.equal(move.disabled, false, 'preview links to an enabled map button');
  assert.match(move.attributes, new RegExp('aria-describedby="' + id + '"'));
  const visible = session.host.innerHTML.match(new RegExp('<span id="' + id + '">([^<]*(?:<b>[^<]*</b>[^<]*)?)</span>'));
  assert.ok(visible, 'preview for cell ' + cell + ' is visible text, not a title');
  return visible[1].replace(/<\/?b>/g, '');
}

function test(name, fn) {
  fn();
  console.log('PASS ' + name);
}

test('a one-step oxygen-station route forecasts the same survivable result as movement', () => {
  // Minimal legal state at cell 1 with exactly 2 oxygen; cell 2 is an unused station.
  const state = salvage.create(42, 'engineer');
  state.pos = 1;
  state.visited[0].push(1);
  state.oxygen = 2;
  assert.equal(salvage.valid(state), true);

  const forecast = salvage.plan(state, 'oxygen');
  assert.deepEqual(Array.from(forecast.path), [1, 2]);
  assert.equal(forecast.oxygen, 24);
  assert.equal(forecast.safe, true, 'station oxygen is applied before the survival check');

  const actual = clone(state);
  assert.equal(salvage.move(actual, 2), true);
  assert.equal(actual.phase, 'explore');
  assert.equal(actual.oxygen, forecast.oxygen);
  assert.equal(actual.hp, forecast.hp);
});

test('every traversable room is reachable without crossing a locked guard', () => {
  for (let deck = 0; deck < salvage.layouts.length; deck++) {
    const map = salvage.layouts[deck];
    const reached = new Set([20]);
    const queue = [20];
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head];
      for (let next = 0; next < 25; next++) {
        const distance = Math.abs(at % 5 - next % 5) + Math.abs(Math.floor(at / 5) - Math.floor(next / 5));
        if (distance !== 1 || map[next] === '#' || map[next] === 'G' || reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    for (let cell = 0; cell < 25; cell++) {
      if (map[cell] !== '#' && map[cell] !== 'G') assert.ok(reached.has(cell), 'deck ' + deck + ' room ' + cell);
      if (map[cell] === 'G') {
        assert.ok(Array.from(reached).some(at => Math.abs(at % 5 - cell % 5) + Math.abs(Math.floor(at / 5) - Math.floor(cell / 5)) === 1), 'guard has an approachable side');
      }
    }
  }
});

test('a full cargo hold rejects another item without losing it or changing resources', () => {
  const state = salvage.create(17, 'hauler');
  state.pos = 0;
  state.visited[0].push(0);
  state.bag = [
    { id: '9-0', kind: 'relic', cell: 0 },
    { id: '9-1', kind: 'relic', cell: 0 },
    { id: '9-2', kind: 'relic', cell: 0 },
    { id: '9-3', kind: 'data', cell: 0 },
    { id: '9-4', kind: 'data', cell: 0 },
    { id: '9-5', kind: 'data', cell: 0 }
  ];
  assert.equal(salvage.weight(state), 12);
  assert.equal(salvage.valid(state), true);
  const oxygen = state.oxygen, heat = state.heat;
  const groundBefore = clone(state.ground[0]);
  assert.equal(salvage.act(state, 'take', { item: '0-0' }), true);
  assert.equal(state.bag.length, 6);
  assert.deepEqual(clone(state.ground[0]), groundBefore);
  assert.equal(state.oxygen, oxygen);
  assert.equal(state.heat, heat);
  assert.equal(salvage.valid(state), true);
});

test('locked guards stay out of forecasts and legacy third-deck saves still default to extraction', () => {
  const state = salvage.create(23, 'engineer');
  state.pos = 11;
  state.visited[0].push(11);
  const forecast = salvage.plan(state, 'extract');
  assert.ok(forecast.path.length > 1);
  assert.equal(forecast.path.includes(12), false, 'locked deck-zero guard is not routable');

  const old = salvage.create(29, 'scout');
  old.deck = 2;
  old.planGoal = 'lift';
  delete old.planGoal;
  assert.equal(salvage.valid(old), true, 'planGoal was optional in the original version-1 save format');
  assert.deepEqual(Array.from(salvage.plan(old).path), [20]);
  assert.equal(salvage.plan(old).steps, 0, 'third-deck default remains the current extraction room');
});

test('planner agrees with formal movement across three decks, all kits and resource thresholds', () => {
  let checked = 0;
  const resources = [
    { oxygen: 1, hp: 80, heat: 0 }, { oxygen: 2, hp: 80, heat: 0 },
    { oxygen: 3, hp: 80, heat: 4 }, { oxygen: 4, hp: 3, heat: 5 },
    { oxygen: 8, hp: 2, heat: 8 }, { oxygen: 24, hp: 9, heat: 5 },
    { oxygen: 120, hp: 80, heat: 8 }
  ];
  for (let deck = 0; deck < 3; deck++) for (const kit of ['scout', 'hauler', 'engineer']) {
    for (const cargo of [[], ['relic', 'scrap'], ['relic', 'scrap', 'core']]) {
      for (const limits of resources) for (const pos of [0, 1, 2, 10, 11, 17, 20, 23]) {
        if (salvage.layouts[deck][pos] === '#') continue;
        const state = salvage.create(37, kit);
        state.deck = deck;
        state.pos = pos;
        if (!state.visited[deck].includes(pos)) state.visited[deck].push(pos);
        carry(state, cargo);
        Object.assign(state, limits);
        for (const goal of ['lift', 'extract', 'oxygen', 'tools']) {
          compareRoute(state, goal);
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 6048);
  console.log('  compared ' + checked + ' planner/act cases');
});

test('one-use oxygen, overflow and hot armor loss use the same arrival ordering as act', () => {
  for (const oxygen of [1, 2, 3, 119, 120]) for (const hp of [1, 2, 3]) {
    const state = salvage.create(41, 'engineer');
    state.pos = 1;
    state.oxygen = oxygen;
    state.hp = hp;
    state.heat = 5;
    const forecast = compareRoute(state, 'oxygen');
    assert.equal(forecast.oxygen, oxygen <= 4 ? 24 : 120, 'oxygen uses the station even at zero and caps at 120');
    assert.equal(forecast.safe, hp > 2, 'station can restore oxygen but not armor');
    const actual = clone(state);
    salvage.act(actual, 'move', { cell: '2' });
    assert.equal(actual.heat, 3);
    assert.ok(actual.used[0].includes(2));
    if (actual.phase === 'explore') {
      assert.equal(salvage.act(actual, 'move', { cell: '1' }), true);
      const before = actual.oxygen;
      assert.equal(salvage.act(actual, 'move', { cell: '2' }), true);
      assert.equal(actual.oxygen, Math.max(0, before - salvage.cost(actual)), 'used station does not refill');
      assert.equal(salvage.plan(actual, 'oxygen').steps, null);
    }
  }
});

test('guards require formal clearance while a longer oxygen detour can rescue a dangerous shortest route', () => {
  const state = salvage.create(43, 'engineer');
  state.pos = 11;
  const locked = compareRoute(state, 'lift');
  assert.equal(locked.path.includes(12), false);
  const before = clone(state);
  assert.equal(salvage.act(state, 'move', { cell: '12' }), true);
  assert.deepEqual(clone(state), { ...before, message: state.message }, 'blocked move only changes its refusal message');
  assert.equal(salvage.act(state, 'breach', { cell: '12' }), true);
  const cleared = compareRoute(state, 'lift');
  assert.equal(cleared.path.includes(12), true);
  assert.ok(cleared.steps < locked.steps);

  const alternative = salvage.create(47, 'scout');
  alternative.deck = 2;
  alternative.pos = 11;
  alternative.heat = 5;
  alternative.hp = 5;
  const direct = compareRoute(alternative, 'extract');
  assert.equal(direct.safe, false);
  const oxygen = compareRoute(alternative, 'oxygen');
  assert.equal(oxygen.safe, true);
  for (const cell of oxygen.path.slice(1)) assert.equal(salvage.act(alternative, 'move', { cell: String(cell) }), true);
  assert.equal(compareRoute(alternative, 'extract').safe, true, 'the shortest-route warning is not a claim that every alternative fails');
});

test('full-core loading reports the exact shortage before a click and never loses cargo on refusal', () => {
  const state = salvage.create(53, 'scout');
  state.deck = 2;
  state.pos = 14;
  carry(state, ['relic', 'relic', 'scrap', 'data']);
  assert.equal(salvage.valid(state), true);
  assert.equal(salvage.weight(state), 9);
  const session = mount(checkpoint(state));
  assert.equal(session.button('take', { item: '2-14' }).disabled, true);
  const refusal = /主机核心需要 4 重量，可用 0，还差 4；放下至少 4 重量再装载。/;
  assert.match(session.host.innerHTML, new RegExp('>货舱容量不足：' + refusal.source + '</span>'));
  const before = clone(state);
  assert.equal(salvage.act(state, 'take', { item: '2-14' }), true);
  assert.match(state.message, refusal);
  for (const field of ['bag', 'ground', 'oxygen', 'hp', 'tools', 'heat', 'steps']) assert.deepEqual(clone(state[field]), before[field]);

  session.click('drop', { item: state.bag[0].id }); // Weight 3 is not enough.
  assert.equal(session.button('take', { item: '2-14' }).disabled, true);
  assert.match(session.host.innerHTML, /可用 3，还差 1；放下至少 1 重量再装载。<\/span>/);
  session.click('drop', { item: state.bag[3].id });
  session.click('take', { item: '2-14' });
  assert.equal(salvage.weight(session.state()), 9);
  assert.ok(session.state().bag.some(item => item.id === '2-14'));
  assert.equal(session.state().ground[2].some(item => item.id === '2-14'), false);
});

test('visible per-cell forecasts agree with lethal arrival, distinguish corridors, and stop after loss', () => {
  const doomed = salvage.create(59, 'engineer');
  doomed.pos = 1;
  doomed.oxygen = 2;
  doomed.heat = 5;
  doomed.hp = 2;
  const death = mount(checkpoint(doomed));
  assert.match(preview(death, 2), /第 1 行第 3 列 氧气站：移动后护甲耗尽，远征失联，货物无法带回。氧气 2 → 24（步耗 4，含首次补给）；护甲 2 → 0；热度 5 → 3。/);
  assert.match(preview(death, 0), /移动后氧气与护甲耗尽/);
  assert.match(death.host.innerHTML, /role="status">途中资源会耗尽：第 1 行第 3 列护甲耗尽，无法执行目标动作。/);
  assert.match(death.host.innerHTML, /最短路线共 3 步；失联时剩余氧气 24、护甲 0，不是目标到达值。/);
  assert.match(death.button('move', { cell: '2' }).label, /氧/);
  death.click('move', { cell: '2' });
  const { pos, oxygen, hp, heat, phase, steps, used } = death.state();
  assert.deepEqual({ pos, oxygen, hp, heat, phase, steps, used: used[0] }, { pos: 2, oxygen: 24, hp: 0, heat: 3, phase: 'lost', steps: 1, used: [2] });
  assert.doesNotMatch(death.host.innerHTML, /相邻移动风险预览/);

  const start = mount(checkpoint(salvage.create(60, 'scout')));
  assert.match(preview(start, 15), /第 4 行第 1 列 走廊：氧气 100 → 98/);
  assert.match(preview(start, 21), /第 5 行第 2 列 走廊：氧气 100 → 98/);
  assert.match(start.host.innerHTML, /可选择「进入下层」，改装后下潜。/);
});

test('rendered goals distinguish absent, used, and reachable targets without promising unavailable actions', () => {
  const noRoute = salvage.create(61, 'scout');
  noRoute.deck = 2;
  noRoute.planGoal = 'lift';
  const unreachable = mount(checkpoint(noRoute));
  assert.match(unreachable.host.innerHTML, /第三层没有可进入的下层；改选撤离目标/);
  const base = mount(checkpoint(salvage.create(62, 'scout')));
  base.click('plan', { choice: 'tools' });
  assert.match(base.host.innerHTML, /本层没有工具仓；改选路线目标/);
  const station = salvage.create(62, 'scout');
  station.pos = 1;
  station.oxygen = 2;
  station.planGoal = 'oxygen';
  const supplied = mount(checkpoint(station));
  assert.match(preview(supplied, 2), /氧气 2 → 24（步耗 2，含首次补给）/);
  assert.match(supplied.host.innerHTML, /氧气补给已计入到达值/);
  supplied.click('move', { cell: '2' });
  assert.equal(supplied.state().phase, 'explore');
  assert.equal(supplied.state().oxygen, 24);
  assert.match(supplied.host.innerHTML, /本层氧气站的补给已用完；改选路线目标/);
  supplied.click('move', { cell: '1' });
  assert.match(preview(supplied, 2), /氧气 22 → 20（步耗 2）/);

  const exitState = salvage.create(63, 'scout');
  exitState.pos = 23;
  exitState.planGoal = 'extract';
  assert.match(preview(mount(checkpoint(exitState)), 24), /可撤离，但未携带货物/);
  carry(exitState, ['data']);
  assert.match(preview(mount(checkpoint(exitState)), 24), /可撤离并带回货物/);
  exitState.deck = 2;
  carry(exitState, ['core']);
  const coreExit = mount(checkpoint(exitState));
  assert.match(preview(coreExit, 24), /可选择「带货撤离」，完成核心回收/);
  coreExit.click('move', { cell: '24' });
  assert.match(coreExit.host.innerHTML, /已在目标舱室。可选择「带货撤离」，完成核心回收/);
  coreExit.click('extract');
  assert.equal(coreExit.state().phase, 'won');

  const guard = salvage.create(67, 'engineer');
  guard.pos = 11;
  guard.tools = 0;
  const blocked = mount(checkpoint(guard));
  assert.match(preview(blocked, 12), /守卫未解除，工具不足；改走其他路线/);
  assert.equal(blocked.button('hack', { cell: '12' }).disabled, true);
  assert.equal(blocked.button('breach', { cell: '12' }).disabled, true);
  blocked.click('move', { cell: '12' });
  assert.equal(blocked.state().pos, 11);
  assert.match(blocked.state().message, /守卫未解除，工具不足；改走其他路线/);

  guard.tools = 1;
  const breachOnly = mount(checkpoint(guard));
  assert.match(preview(breachOnly, 12), /工具只够爆破/);
  assert.equal(breachOnly.button('hack', { cell: '12' }).disabled, true);
  assert.equal(breachOnly.button('breach', { cell: '12' }).disabled, false);
});

test('a V53 running save without planGoal loads unchanged, and stale mounted pages cannot replace it', () => {
  const old = salvage.create(71, 'hauler');
  delete old.planGoal;
  const shared = checkpoint(old);
  const before = shared.get(KEY);
  const first = mount(shared), stale = mount(shared);
  assert.equal(first.engine.valid(first.state()), true);
  assert.equal(first.values.get(KEY), before, 'loading the legacy save does not rewrite it');
  first.click('move', { cell: '21' });
  const latest = shared.get(KEY), backup = shared.get(KEY + '.backup');
  assert.equal(first.state().pos, 21);
  assert.equal(backup, before);
  stale.click('move', { cell: '15' }); // Still at 20 in the stale page.
  assert.equal(shared.get(KEY), latest, 'stale page did not replace newer checkpoint');
  assert.equal(shared.get(KEY + '.backup'), backup);
  assert.match(stale.host.innerHTML, /另一页面已更新本局/);
  const refreshed = mount(shared);
  refreshed.click('move', { cell: '22' });
  assert.equal(refreshed.state().pos, 22);
  assert.equal(refreshed.checkpoint().revision, JSON.parse(latest).revision + 1);
});

console.log('Salvage hardening checks passed.');
