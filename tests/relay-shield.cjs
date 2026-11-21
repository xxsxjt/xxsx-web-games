const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const SAVE_KEY = 'xxsxRelayDefenseV1';

function load(hostId = 'relayDefense', seed) {
  let click;
  const values = seed instanceof Map ? seed : new Map(Object.entries(seed || {}));
  const host = {
    innerHTML: '',
    getClientRects() { return [{}]; },
    querySelector() { return null; },
    addEventListener(name, fn) { if (name === 'click') click = fn; }
  };
  const window = {
    document: {
      hidden: false,
      getElementById(id) { return id === hostId ? host : null; },
      addEventListener() {}
    },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); },
      removeItem(key) { values.delete(key); }
    },
    requestAnimationFrame() {},
    addEventListener() {}
  };
  for (const file of ['campaign-core', 'relay-defense']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8'), {window, console});
  }
  return {
    window, values, host,
    act(dataset) { click({target: {closest() { return {dataset}; }}}); }
  };
}

const R = load().window.XXSXRelayDefense;
function test(name, fn) { fn(); console.log('✓ ' + name); }

function firingState() {
  const s = R.create(311, 0);
  s.phase = 'wave';
  s.wave = 1;
  s.paused = false;
  s.queue = [];
  s.towers[0] = {kind: 'pulse', level: 1, cooldown: 0, priority: 'shield', invested: 32};
  return s;
}

function towerHitAt(progresses, reverse = false) {
  const s = firingState();
  const enemies = progresses.map(({kind, progress}) => R.spawn(s, kind, 0, progress));
  if (reverse) s.enemies.reverse();
  R.tick(s, 0.05);
  return {s, enemies};
}

function defensePolicy(map) {
  const s = R.create(123 + map, String(map));
  const order = [1, 3, 5, 0, 4, 2];
  const types = {0: 'ion', 1: 'pulse', 2: 'cannon', 3: 'cannon', 4: 'pulse', 5: 'pulse'};
  let steps = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && steps++ < 50000) {
    if (s.phase === 'build') {
      for (const i of order) {
        R.act(s, 'site', {site: String(i)});
        if (!s.towers[i]) R.act(s, 'build', {choice: types[i]});
      }
      for (let level = 1; level <= 2; level++) for (const i of order) {
        R.act(s, 'site', {site: String(i)});
        if (s.towers[i] && s.towers[i].level === level) R.act(s, 'upgradeTower', {});
      }
      R.startWave(s);
    } else if (s.phase === 'upgrade') {
      R.act(s, 'network', {choice: s.offers.includes('fund') ? 'fund' : s.offers.includes('range') ? 'range' : s.offers[0]});
    } else {
      if (s.capacitors > 0 && s.enemies.some(e => e.progress > 10 && e.shield > 0)) R.act(s, 'emp', {});
      R.tick(s, 0.1);
      if (steps % 100 === 0) assert.equal(R.valid(s), true);
    }
  }
  return s;
}

test('real tick selects and damages an in-range shielded enemy before a nearer unshielded enemy', () => {
  const {s, enemies: [shielded, nearer]} = towerHitAt([
    {kind: 'shielded', progress: 3},
    {kind: 'runner', progress: 4}
  ]);
  assert.equal(shielded.shield, 13, 'the pulse hit must absorb 12 shield');
  assert.equal(shielded.hp, shielded.maxHp, 'shield absorption must not change hull HP');
  assert.equal(nearer.hp, nearer.maxHp, 'the closer unshielded target must not be selected');
  assert.equal(R.valid(s), true);
});

test('shield priority filters by tower range and attacks an in-range unshielded fallback', () => {
  const {s, enemies: [outOfRangeShield, inRangeRunner]} = towerHitAt([
    {kind: 'shielded', progress: 9},
    {kind: 'runner', progress: 2}
  ]);
  assert.equal(outOfRangeShield.shield, 25, 'an out-of-range shield is not a candidate');
  assert.equal(inRangeRunner.hp, inRangeRunner.maxHp - 12, 'the in-range fallback receives the real pulse hit');
  assert.equal(R.valid(s), true);
});

test('shield priority falls back to the closest-core target when no shield is in range', () => {
  const {s, enemies: [behind, closer]} = towerHitAt([
    {kind: 'runner', progress: 3},
    {kind: 'runner', progress: 5}
  ]);
  assert.equal(behind.hp, behind.maxHp, 'the less advanced target remains untouched');
  assert.equal(closer.hp, closer.maxHp - 12, 'fallback retains first/closest-core targeting');
  assert.equal(R.valid(s), true);
});

test('equal-progress shield targets use enemy ID regardless of enemy-array order', () => {
  for (const reverse of [false, true]) {
    const {s, enemies: [lowerId, higherId]} = towerHitAt([
      {kind: 'shielded', progress: 2},
      {kind: 'shielded', progress: 2}
    ], reverse);
    assert.ok(lowerId.id < higherId.id);
    assert.equal(lowerId.shield, 13, 'lower ID wins a complete progress tie');
    assert.equal(higherId.shield, 25);
    assert.equal(R.valid(s), true);
  }
});

test('the rendered priority button cycles first, strong, fast, shield, then first', () => {
  const session = load();
  session.act({campaignAction: 'start', choice: '0'});
  session.act({campaignAction: 'build', choice: 'pulse'});
  const expected = [
    ['strong', '优先：高生命'],
    ['fast', '优先：高速'],
    ['shield', '优先：护盾优先'],
    ['first', '优先：前端']
  ];
  for (const [priority, label] of expected) {
    session.act({campaignAction: 'priority'});
    const saved = JSON.parse(session.values.get(SAVE_KEY));
    assert.equal(saved.state.version, 1);
    assert.equal(saved.state.towers[0].priority, priority);
    assert.ok(session.host.innerHTML.includes(label), 'rendered control names ' + priority);
    if (priority === 'shield') assert.match(session.host.innerHTML, /射程内带盾信号优先/);
  }
});

test('legacy first/strong/fast version-1 saves remain valid and load without migration', () => {
  for (const priority of ['first', 'strong', 'fast']) {
    const state = R.create(921, 0);
    state.towers[0] = {kind: 'pulse', level: 1, cooldown: 0, priority, invested: 32};
    assert.equal(R.valid(state), true, priority + ' legacy state remains valid');
    const raw = JSON.stringify({schema: 1, revision: 1, meta: {runs: 1, clears: 0, best: 0}, state});
    const session = load('relayDefense', new Map([[SAVE_KEY, raw]]));
    assert.equal(session.values.get(SAVE_KEY), raw, priority + ' save bytes are not migrated or rewritten on load');
    assert.ok(session.host.innerHTML.includes({first: '优先：前端', strong: '优先：高生命', fast: '优先：高速'}[priority]));
  }
});

test('real saves after actions retain each legacy priority and the existing save envelope', () => {
  for (const priority of ['first', 'strong', 'fast']) {
    const state = R.create(922, 0);
    state.towers[0] = {kind: 'pulse', level: 1, cooldown: 0, priority, invested: 32};
    const raw = JSON.stringify({schema: 1, revision: 4, meta: {runs: 2, clears: 1, best: 510}, state});
    const session = load('relayDefense', new Map([[SAVE_KEY, raw]]));
    session.act({campaignAction: 'speed'});
    const saved = JSON.parse(session.values.get(SAVE_KEY));
    assert.equal(saved.schema, 1);
    assert.equal(saved.revision, 5);
    assert.deepEqual(saved.meta, {runs: 2, clears: 1, best: 510});
    assert.equal(saved.state.version, 1);
    assert.equal(saved.state.towers[0].priority, priority, priority + ' remains unchanged after a real save');
    assert.equal(R.valid(saved.state), true);
  }
});

test('shield priority is saved in the existing version-1 schema without adding state fields', () => {
  const initial = R.create(41, 0);
  const session = load('relayDefense', new Map([[SAVE_KEY, JSON.stringify({
    schema: 1, revision: 1, meta: {runs: 1, clears: 0, best: 0}, state: initial
  })]]));
  session.act({campaignAction: 'build', choice: 'pulse'});
  for (let i = 0; i < 3; i++) session.act({campaignAction: 'priority'});
  const saved = JSON.parse(session.values.get(SAVE_KEY));
  assert.equal(saved.state.version, 1);
  assert.equal(saved.state.towers[0].priority, 'shield');
  assert.deepEqual(Object.keys(saved.state).sort(), Object.keys(initial).sort(), 'no save fields were added');
  assert.equal(R.valid(saved.state), true);
});

test('all three existing maps retain their legal twelve-wave win path', () => {
  for (let map = 0; map < 3; map++) {
    const s = defensePolicy(map);
    assert.equal(s.phase, 'won', 'map ' + map + ' core ' + s.core + ' wave ' + s.wave);
    assert.equal(s.wave, 12);
    assert.equal(R.valid(s), true);
  }
});
