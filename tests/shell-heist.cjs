const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {module: {exports: {}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/shell-heist.js'), 'utf8'), context);
const game = context.module.exports;

const shorthand = {L: 'left', U: 'up', D: 'down', R: 'right', X: 'ability', I: 'interact', Q: 'leave'};
const commands = text => text.split(' ').map(token => shorthand[token] || 'borrow:' + token);
const campaign = [
  [0, '', 'C R X R R I R'],
  [1, '', 'T X Q R H X R R R'],
  [2, 'press', 'T X Q U C X R R D Q U R R R R D I U R'],
  [2, 'laser', 'T X Q D N X R H X R R R U U U R I U R']
];

function apply(state, action) {
  const snapshot = JSON.stringify(state);
  const result = game.turn(state, action);
  assert.equal(JSON.stringify(state), snapshot, 'turn must not mutate an earlier state');
  assert.equal(result.ok, true, `${action} at turn ${state.turn}: ${result.note}`);
  return result.state;
}

function denied(state, action, note) {
  const result = game.turn(state, action);
  assert.equal(result.ok, false, action);
  assert.equal(result.state, state);
  assert.match(result.note, note);
}

function play(state, text) { return commands(text).reduce(apply, state); }
const progress = game.fresh();
for (const [index, route, solution] of campaign) {
  const actions = commands(solution);
  assert.equal(game.unlocked(progress, index), true);
  let state = actions.reduce(apply, game.start(index));
  assert.equal(state.phase, 'won', `room ${index + 1}: ${route}`);
  assert.equal(state.route, route);
  assert.equal(state.turn, actions.length);
  assert.equal(game.ready(state), true);
  if (route === 'press') {
    assert.equal(game.weighted(state), true);
    assert.equal(state.scanned, false);
  }
  if (route === 'laser') {
    assert.equal(game.weighted(state), false);
    assert.equal(state.gate, false);
  }
  denied(state, 'right', /已经结束/);
  game.record(progress, state);
  progress.actions = actions;
  progress.room = index;
  const restored = game.load(JSON.stringify(progress));
  assert.deepEqual(restored.state, state);
  // Undo can replay the entire input journal except its last action.
  const undone = game.replay(index, actions.slice(0, -1));
  assert.equal(undone.phase, 'play');
  assert.deepEqual(apply(undone, actions.at(-1)), state);
}
assert.deepEqual(Array.from(progress.best), [7, 9, 19]);
assert.deepEqual(Array.from(progress.routes), ['press', 'laser']);

const first = game.start(0);
denied(first, 'ability', /本体/);
denied(first, 'borrow:H', /没有这个壳/);
denied(first, 'upwards', /未知/);
denied(first, 'borrow:__proto__', /没有这个壳/);
denied(play(first, 'C'), 'ability', /贴近/);
denied(play(first, 'C R'), 'right', /闸门锁着/);
const prematureExit = play(first, 'C R X R R R');
assert.equal(prematureExit.phase, 'play', 'reaching an exit before B cannot clear the room');
denied(prematureExit, 'interact', /B 上/);

const turret = play(game.start(1), 'T');
denied(turret, 'down', /炮台固定/);
const camera = play(turret, 'Q');
denied(camera, 'right', /摄像门锁着/);
const shield = play(turret, 'X Q R H');
denied(shield, 'right', /展开护盾/);
assert.equal(play(shield, 'X').shield, 3, 'activating does not spend one of the protected steps');
const beam = play(shield, 'X R');
denied(beam, 'leave', /光束里不能/);
denied(beam, 'borrow:T', /光束里不能/);
assert.equal(play(shield, 'Q H').controlled, 'H', 'unmoving shell can be re-entered from its cell');
const inBeam = play(shield, 'X R R');
assert.equal(inBeam.shield, 1);
const lost = play(inBeam, 'L');
assert.equal(lost.phase, 'lost');
assert.equal(play(inBeam, 'X R').phase, 'won');

const north = play(game.start(2), 'T X Q U C X R R');
denied(north, 'right', /压板/);
const onPlate = play(north, 'D Q');
assert.equal(game.weighted(onPlate), true);
assert.equal(game.weighted(play(onPlate, 'C U')), false, 'moving the plate shell closes the gate');
const south = play(game.start(2), 'T X Q D N');
denied(south, 'right', /侦察/);
const scoutAtBeam = play(south, 'X R H Q');
denied(scoutAtBeam, 'right', /护盾壳/);

const initial = game.fresh();
assert.equal(game.unlocked(initial, 1), false);
assert.equal(game.load(JSON.stringify({...initial, room: 1})), null);
assert.equal(game.load(JSON.stringify({...initial, actions: ['borrow:H']})), null);
assert.equal(game.load(JSON.stringify({...initial, actions: Array(game.MAX_TURNS + 1).fill('up')})), null);
assert.equal(game.load(JSON.stringify({...initial, best: [null, 9, null]})), null);
assert.equal(game.load(JSON.stringify({...initial, actions: commands(campaign[0][2])})), null, 'won journal must have a corresponding record');
assert.equal(game.load('not json'), null);

const unrelated = new Map([['xxsxShellHeistV1', 'old bytes'], ['xxsxWebGamesHubV1', 'other bytes']]);
const storage = {getItem: key => unrelated.get(key) ?? null, setItem: (key, value) => unrelated.set(key, value)};
const firstTab = game.store(storage);
const stale = game.store(storage);
assert.equal(firstTab.save(progress), true);
assert.equal(stale.save(stale.progress), false);
assert.match(stale.info, /另一个页面/);
assert.equal(game.store(storage).state.phase, 'won');
assert.equal(unrelated.get('xxsxShellHeistV1'), 'old bytes');
assert.equal(unrelated.get('xxsxWebGamesHubV1'), 'other bytes');
unrelated.set(game.KEY, 'corrupt');
const corrupt = game.store(storage);
assert.equal(corrupt.state.phase, 'play');
assert.equal(corrupt.save(progress), false);
assert.equal(unrelated.get(game.KEY), 'corrupt');
assert.equal(game.store(undefined).save(progress), false);

console.log('PASS shell heist: all three rooms, both final routes, shell/laser/plate rules, undo, isolated persistence and no-storage mode');
