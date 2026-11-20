const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

// Run directly: node tests/salvage-journey.cjs
// These are mounted-game journeys, not hand-built winning state fixtures. Every
// gameplay action must correspond to an enabled button in the current render.
// Route finding is one 25-cell BFS; each journey has a hard 180-action budget.
// The sole fault injection below corrupts storage, not the gameplay state.
const KEY = 'xxsxSalvageExpeditionV1';
const root = path.join(__dirname, '..');
const sources = ['campaign-core', 'salvage-expedition'].map(file => ({
  file: 'src/' + file + '.js',
  source: fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8')
}));
const copy = value => JSON.parse(JSON.stringify(value));

function load(values = new Map()) {
  let onClick;
  const host = {
    innerHTML: '',
    querySelector() { return null; },
    addEventListener(name, fn) {
      assert.equal(name, 'click');
      onClick = fn;
    }
  };
  const window = {
    document: { getElementById(id) { return id === 'salvageExpedition' ? host : null; } },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    }
  };
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.25;
  const context = vm.createContext({ window, console, Math: deterministicMath, Date: { now: () => 1700000000000 } });
  for (const { source, file } of sources) vm.runInContext(source, context, { filename: file, timeout: 1000 });

  function button(action, extra = {}) {
    for (const match of host.innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const dataset = {};
      for (const attribute of match[1].matchAll(/\bdata-([\w-]+)="([^"]*)"/g)) {
        dataset[attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attribute[2];
      }
      if (dataset.campaignAction === action && Object.entries(extra).every(([key, value]) => dataset[key] === String(value))) {
        return { dataset, disabled: /(?:^|\s)disabled(?:\s|=|$)/.test(match[1]) };
      }
    }
    return null;
  }

  return {
    host, values, engine: window.XXSXSalvage, button,
    click(action, extra) {
      const node = button(action, extra);
      assert.ok(node, 'rendered button: ' + action + ' ' + JSON.stringify(extra));
      assert.equal(node.disabled, false, 'enabled button: ' + action + ' ' + JSON.stringify(extra));
      onClick({ target: { closest(selector) { assert.equal(selector, '[data-campaign-action]'); return node; } } });
    }
  };
}

function route(engine, state, target) {
  assert.ok(Number.isInteger(target) && target >= 0 && target < 25);
  const queue = [[state.pos]], seen = new Set([state.pos]);
  for (let head = 0; head < queue.length && head < 25; head++) {
    const cells = queue[head], at = cells[cells.length - 1];
    if (at === target) return cells;
    for (let next = 0; next < 25; next++) {
      const type = engine.layouts[state.deck][next];
      if (seen.has(next) || type === '#' || type === 'G' && !state.cleared[state.deck].includes(next)) continue;
      if (Math.abs(at % 5 - next % 5) + Math.abs(Math.floor(at / 5) - Math.floor(next / 5)) !== 1) continue;
      seen.add(next);
      queue.push(cells.concat(next));
    }
  }
  assert.fail('no legal route on deck ' + state.deck + ' from ' + state.pos + ' to ' + target);
}

function inventory(state) {
  return state.bag.concat(...state.ground).map(item => item.id + ':' + item.kind).sort();
}

class Journey {
  constructor(name) {
    this.name = name;
    this.values = new Map([['xxsxEchoDeckV1', 'other-game-bytes-must-not-change']]);
    this.session = load(this.values);
    this.actions = [];
    this.items = null;
    assert.equal(this.values.has(KEY), false);
  }

  checkpoint() { return JSON.parse(this.values.get(KEY)); }
  state() { return this.checkpoint().state; }

  step(action, extra = {}) {
    assert.ok(this.actions.length < 180, this.name + ': finite action budget');
    const previous = this.values.get(KEY);
    const before = previous ? JSON.parse(previous) : null;
    this.actions.push({ action, ...extra });
    try {
      this.session.click(action, extra);
      const raw = this.values.get(KEY), after = JSON.parse(raw);
      assert.notEqual(raw, previous, 'action automatically saved');
      assert.equal(after.schema, 1);
      assert.equal(after.revision, before ? before.revision + 1 : 1);
      assert.equal(this.session.engine.valid(after.state), true, 'checkpoint remains reloadable');
      assert.equal(this.values.has(KEY + '.pending'), false);
      if (previous) assert.equal(this.values.get(KEY + '.backup'), previous, 'backup is the preceding real action');
      if (action === 'start') this.items = inventory(after.state);
      assert.deepEqual(inventory(after.state), this.items, 'cargo is neither duplicated nor deleted across decks');
      assert.equal(this.values.get('xxsxEchoDeckV1'), 'other-game-bytes-must-not-change');
      const terminal = ['won', 'lost', 'extracted'].includes(after.state.phase);
      assert.equal(after.state.recorded, terminal, 'only terminal states are settled');
      return after;
    } catch (error) {
      error.message += '\nJourney ' + this.name + ', replay actions: ' + JSON.stringify(this.actions);
      throw error;
    }
  }

  start(kit) { return this.step('start', { choice: kit }); }

  go(target) {
    const cells = route(this.session.engine, this.state(), target);
    for (const cell of cells.slice(1)) {
      const after = this.step('move', { cell: String(cell) }).state;
      assert.equal(after.pos, cell);
      assert.equal(after.phase, 'explore', 'chosen route has enough real resources');
    }
    return this.state();
  }

  take(id) {
    const state = this.state();
    const item = state.ground[state.deck].find(candidate => candidate.id === id && candidate.cell === state.pos);
    assert.ok(item, 'cargo is present in this room: ' + id);
    return this.step('take', { item: id });
  }

  reload() {
    const before = Array.from(this.values);
    this.session = load(this.values);
    assert.deepEqual(Array.from(this.values), before, 'opening a valid checkpoint does not rewrite it');
    assert.match(this.session.host.innerHTML, new RegExp('第 ' + (this.state().deck + 1) + ' 层'));
    if (this.state().phase === 'upgrade') assert.ok(this.session.button('upgrade', { choice: 'cargo' }));
    return this.state();
  }

  disabled(action, extra = {}) {
    const button = this.session.button(action, extra);
    assert.ok(button, 'disabled control is rendered: ' + action);
    assert.equal(button.disabled, true, 'unavailable action cannot be clicked: ' + action);
  }

  terminal() {
    const checkpoint = this.checkpoint(), raw = this.values.get(KEY);
    assert.equal(checkpoint.state.recorded, true);
    this.disabled('extract');
    this.disabled('vent');
    // Rules-only rejection checks on clones of the actual terminal checkpoint;
    // these are not playable clicks and cannot change the journey or its saves.
    for (const [action, data] of [
      ['extract', {}], ['move', { cell: '23' }], ['descend', {}],
      ['upgrade', { choice: 'seal' }], ['drop', { item: checkpoint.state.bag[0]?.id || '0-0' }]
    ]) {
      const state = copy(checkpoint.state), before = JSON.stringify(state);
      assert.equal(this.session.engine.act(state, action, data), false, 'terminal rules reject ' + action);
      assert.equal(JSON.stringify(state), before);
    }
    this.reload();
    this.reload();
    assert.equal(this.values.get(KEY), raw, 'terminal reloads do not award again');
  }

  report() {
    const { state, meta } = this.checkpoint();
    console.log('  ' + this.name + ': ' + JSON.stringify({
      phase: state.phase, oxygen: state.oxygen, hp: state.hp, tools: state.tools,
      heat: state.heat, cap: state.cap, steps: state.steps,
      weight: this.session.engine.weight(state), score: this.session.engine.score(state),
      meta, actions: this.actions.length
    }));
  }
}

function test(name, run) {
  run();
  console.log('✓ ' + name);
}

test('all kits clear three decks through rendered actions, upgrade checkpoints and one-use supplies', () => {
  const expected = {
    scout: { oxygen: 96, hp: 100, tools: 6, cap: 12 },
    engineer: { oxygen: 78, hp: 72, tools: 11, cap: 12 },
    hauler: { oxygen: 88, hp: 100, tools: 7, cap: 13 }
  };
  for (const kit of Object.keys(expected)) {
    const j = new Journey('three-deck/' + kit);
    j.start(kit);
    assert.equal(j.state().pos, 20);
    assert.equal(j.state().bag.length, 0);
    j.go(0); j.take('0-0');
    j.go(10); j.take('0-10');
    j.go(2);
    const oxygen = j.state().oxygen;
    j.go(3); j.reload(); j.go(2);
    assert.equal(j.state().oxygen, oxygen - 4, 'oxygen station cannot supply twice after reload');
    j.go(7);
    const blocked = j.state();
    j.step('move', { cell: '12' });
    for (const field of ['pos', 'oxygen', 'hp', 'tools', 'steps']) assert.equal(j.state()[field], blocked[field]);
    const guardAction = kit === 'engineer' ? 'breach' : 'hack';
    j.step(guardAction, { cell: '12' });
    assert.equal(j.state().tools, blocked.tools - (kit === 'hauler' ? 2 : 1));
    assert.equal(j.state().hp, blocked.hp - (kit === 'engineer' ? 8 : 0));
    j.go(12); j.go(4);
    j.step('descend'); j.reload();
    j.step('upgrade', { choice: kit === 'hauler' ? 'coolant' : 'cargo' });
    assert.equal(j.state().deck, 1);
    assert.equal(j.state().planGoal, 'lift');
    j.go(23);
    const toolSupply = j.state().tools;
    j.reload();
    assert.equal(j.state().tools, toolSupply);
    j.go(8); j.take('1-8');
    j.go(10);
    const secondOxygen = j.state().oxygen, secondCost = j.session.engine.cost(j.state());
    j.go(15); j.reload(); j.go(10);
    assert.equal(j.state().oxygen, secondOxygen - 2 * secondCost);
    j.go(1); j.take('1-1'); j.go(4);
    j.step('descend'); j.reload();
    j.step('upgrade', { choice: kit === 'engineer' ? 'coolant' : 'seal' });
    assert.equal(j.state().deck, 2);
    assert.equal(j.state().planGoal, 'extract');
    const toolsBefore = j.state().tools;
    j.go(10);
    assert.equal(j.state().tools, toolsBefore + 2);
    j.go(15); j.reload(); j.go(10);
    assert.equal(j.state().tools, toolsBefore + 2, 'tools cannot be farmed after reload');
    j.go(17);
    const thirdOxygen = j.state().oxygen, thirdCost = j.session.engine.cost(j.state());
    j.go(12); j.reload(); j.go(17);
    assert.equal(j.state().oxygen, thirdOxygen - 2 * thirdCost);
    j.go(14); j.take('2-14'); j.reload(); j.go(24);
    assert.equal(j.session.engine.weight(j.state()), 12);
    assert.equal(j.session.engine.score(j.state()), 750, 'core has no victory bonus before extraction');
    assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 0, best: 0 });
    j.step('extract');
    const state = j.state();
    assert.equal(state.phase, 'won');
    assert.equal(state.steps, 52);
    assert.equal(state.heat, 1);
    for (const [field, value] of Object.entries(expected[kit])) assert.equal(state[field], value, kit + ' ' + field);
    assert.equal(j.session.engine.score(state), 1050);
    assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: 1050 });
    j.terminal(); j.report();
  }
});

test('early retreat on every deck banks only actual cargo, and a subsequent empty run grants no clear', () => {
  for (let deck = 0; deck < 3; deck++) {
    const j = new Journey('early-retreat/deck-' + deck);
    j.start('hauler');
    j.go(10); j.take('0-10');
    for (let level = 0; level < deck; level++) {
      if (level === 1) { j.go(8); j.take('1-8'); }
      j.go(4); j.step('descend'); j.reload();
      j.step('upgrade', { choice: level === 0 ? 'cargo' : 'seal' });
    }
    j.reload(); j.go(24);
    const score = deck === 2 ? 175 : 55;
    assert.equal(j.state().deck, deck);
    assert.equal(j.state().bag.some(item => item.kind === 'core'), false);
    j.step('extract');
    assert.equal(j.state().phase, 'extracted');
    assert.equal(j.session.engine.score(j.state()), score);
    assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: score });
    j.terminal(); j.report();
    j.start('hauler');
    assert.deepEqual(j.checkpoint().meta, { runs: 2, clears: 1, best: score });
    assert.equal(j.state().pos, 20);
    j.step('extract');
    assert.equal(j.state().phase, 'extracted');
    assert.equal(j.session.engine.score(j.state()), 0);
    assert.deepEqual(j.checkpoint().meta, { runs: 2, clears: 1, best: score });
    j.terminal();
  }
});

test('real heat, cooling and cross-deck cargo drops allow a capacity-limited core recovery after reload', () => {
  const j = new Journey('heat-and-capacity');
  j.start('scout');
  j.go(0); j.take('0-0');
  for (let repeat = 0; repeat < 3; repeat++) { j.step('drop', { item: '0-0' }); j.take('0-0'); }
  j.go(10); j.take('0-10');
  assert.equal(j.state().heat, 5);
  assert.equal(j.session.engine.cost(j.state()), 4);
  j.step('plan', { choice: 'oxygen' }); j.reload();
  const raw = j.values.get(KEY), forecast = copy(j.session.engine.plan(j.state()));
  assert.equal(j.values.get(KEY), raw, 'prediction does not write a checkpoint');
  assert.deepEqual(forecast.path, [10, 5, 0, 1, 2]);
  assert.equal(forecast.safe, true);
  for (const cell of forecast.path.slice(1)) j.step('move', { cell: String(cell) });
  assert.equal(j.state().oxygen, forecast.oxygen);
  assert.equal(j.state().hp, forecast.hp);
  assert.equal(j.state().hp, 72);
  assert.equal(j.state().heat, 3);
  const beforeVent = j.state();
  j.step('vent'); j.reload();
  assert.equal(j.state().heat, 0);
  assert.equal(j.state().tools, beforeVent.tools - 1);
  assert.equal(j.state().oxygen, beforeVent.oxygen - 2);
  j.go(4); j.step('descend'); j.step('upgrade', { choice: 'seal' });
  j.go(8); j.take('1-8'); j.go(10); j.go(4);
  j.step('descend'); j.reload(); j.step('upgrade', { choice: 'coolant' });
  j.go(14);
  assert.equal(j.state().cap, 9);
  assert.equal(j.session.engine.weight(j.state()), 7);
  j.disabled('take', { item: '2-14' });
  j.step('drop', { item: '0-0' }); j.reload();
  assert.ok(j.state().ground[2].some(item => item.id === '0-0' && item.cell === 14));
  assert.equal(j.state().ground[0].some(item => item.id === '0-0'), false);
  j.take('2-14'); j.reload();
  assert.equal(j.session.engine.weight(j.state()), 8);
  j.disabled('take', { item: '0-0' });
  j.go(24); j.step('extract');
  assert.equal(j.state().phase, 'won');
  assert.equal(j.state().hp, 96);
  assert.equal(j.state().tools, 6);
  assert.equal(j.state().steps, 38);
  assert.equal(j.session.engine.score(j.state()), 875, 'abandoned first-deck relic has no sale value');
  assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: 875 });
  j.terminal(); j.report();
});

test('a naturally exhausted cargo run loses even at the landing cell without overwriting an earlier best', () => {
  const j = new Journey('natural-oxygen-loss');
  j.start('scout'); j.go(10); j.take('0-10'); j.go(20); j.step('extract');
  assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: 55 });
  j.start('scout'); j.go(10); j.take('0-10'); j.go(20); j.reload();
  // Deliberately ignore the visible exit: this bounded 45-move loop consumes
  // actual oxygen, rather than assigning an artificial one-oxygen fixture.
  for (let moves = 0; moves < 60 && j.state().oxygen > 1; moves++) {
    j.step('move', { cell: j.state().pos === 20 ? '21' : '20' });
    assert.equal(j.state().phase, 'explore');
  }
  assert.equal(j.state().pos, 21);
  assert.equal(j.state().oxygen, 1);
  j.step('plan', { choice: 'extract' }); j.reload();
  const forecast = copy(j.session.engine.plan(j.state()));
  assert.deepEqual(forecast.path, [21, 20]);
  assert.equal(forecast.safe, false);
  assert.equal(forecast.oxygen, 0);
  assert.match(j.session.host.innerHTML, /途中资源会耗尽/);
  j.step('move', { cell: '20' });
  assert.equal(j.state().phase, 'lost');
  assert.equal(j.state().oxygen, 0);
  assert.equal(j.state().pos, 20);
  assert.equal(j.state().steps, 50);
  assert.equal(j.state().bag.length, 1, 'cargo remains in the loss report but earns nothing');
  assert.equal(j.session.engine.score(j.state()), 0);
  assert.deepEqual(j.checkpoint().meta, { runs: 2, clears: 1, best: 55 });
  j.terminal(); j.report();
});

test('a corrupted terminal save recovers the real pre-extraction backup and settles exactly once again', () => {
  const j = new Journey('storage-fault/pre-extraction-backup');
  j.start('engineer'); j.go(0); j.take('0-0'); j.go(4);
  j.step('descend'); j.step('upgrade', { choice: 'cargo' });
  j.go(8); j.take('1-8'); j.go(4);
  j.step('descend'); j.reload(); j.step('upgrade', { choice: 'seal' });
  j.go(14); j.take('2-14'); j.go(24);
  const beforeExtraction = j.values.get(KEY);
  j.step('extract');
  const terminal = j.values.get(KEY);
  assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: 940 });
  assert.equal(j.values.get(KEY + '.backup'), beforeExtraction);

  // Storage corruption is intentional fault injection. The recovered state is
  // byte-for-byte the preceding naturally reached checkpoint, not a fixture.
  const corrupt = '{deliberately-broken-terminal-checkpoint';
  j.values.set(KEY, corrupt);
  j.session = load(j.values);
  assert.match(j.session.host.innerHTML, /已恢复上一份有效存档/);
  assert.equal(j.values.get(KEY), corrupt, 'recovery preserves rejected primary bytes until a new action');
  assert.equal(j.values.get(KEY + '.backup'), beforeExtraction);
  j.session.click('extract', {});
  assert.equal(j.values.get(KEY + '.rejected'), corrupt);
  assert.equal(j.values.get(KEY), terminal, 'one real extraction reconstructs exactly the original terminal save');
  assert.equal(j.values.get(KEY + '.backup'), beforeExtraction);
  assert.equal(j.values.has(KEY + '.pending'), false);
  assert.deepEqual(j.checkpoint().meta, { runs: 1, clears: 1, best: 940 });
  j.terminal(); j.report();
});

console.log('Salvage journey regression passed: natural starts/actions, bounded routing, no winning state fixtures.');
