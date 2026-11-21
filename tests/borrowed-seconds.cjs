const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlFile = path.join(__dirname, '../games/borrowed-seconds.html');
const jsFile = path.join(__dirname, '../src/borrowed-seconds.js');
const html = fs.readFileSync(htmlFile, 'utf8');
const script = new vm.Script(fs.readFileSync(jsFile, 'utf8'), { filename: jsFile });
const core = { exports: {} };
script.runInNewContext({ module: core });
const G = core.exports;

// Each string is one round. Seal after each string except the last; '.' waits a beat.
const SOLUTIONS = [
  ['UR', 'DRRRRUUR'],
  ['UULL', '....RRRRUU'],
  ['LLUUL', '.LLL', 'R....RDRD'],
  ['UUU', 'R..RRRUU', '...RRRRD', '....RRRRRR'],
  ['UUL', 'R..RRU', 'DDRR..RR'],
  ['RR', '..UUULUL', '...UUUR', '....UUU.UU'],
];

function move(run, commands) {
  for (const command of commands) {
    assert.equal(run.phase, 'playing', 'The script must not act after this round ended');
    const next = G.advance(run, command);
    assert.equal(next.beat, run.beat + 1);
    assert.equal(next.actions.length, next.beat);
    assert.equal(next.frames.length, next.beat);
    assert.equal(next.frames.at(-1).events.length, run.echoes.length + 1);
    const offSpawn = next.positions.filter(at => at !== next.room.start);
    assert.equal(new Set(offSpawn).size, offSpawn.length, 'Only spawn can contain multiple actors');
    run = next;
  }
  return run;
}

function setup(index, ...recordings) {
  return recordings.reduce((run, commands) => G.sealRun(move(run, commands)), G.newRun(G.ROOMS[index]));
}

const eventAt = (frames, beat, actor) => frames[beat - 1].events.find(event => event.actor === actor);

// Share the exact same action driver and DOM contract with the expansion test.
if (require.main !== module) {
  module.exports = { G, SOLUTIONS, move, eventAt, mount };
  return;
}

assert.equal(G.ROOMS.length, SOLUTIONS.length);
for (const [index, solution] of SOLUTIONS.entries()) {
  let run = G.newRun(G.ROOMS[index]);
  for (const [turn, commands] of solution.entries()) {
    run = move(run, commands);
    assert.ok(run.frames.every(frame => frame.events.every(event => event.outcome !== 'blocked')),
      `Room ${index + 1}'s reference route needs no collision to succeed`);
    if (turn === solution.length - 1) {
      assert.equal(run.phase, 'won', `Room ${index + 1} should be solvable`);
      assert.equal(run.positions.at(-1), run.room.exit);
      assert.equal(G.activeCircuits(run.room, run.positions).length, run.room.groups.length);
      assert.equal(G.advance(run, '.'), run);
      assert.equal(G.sealRun(run), run);
      assert.equal(G.retryRun(run), run);
    } else {
      const sealed = G.sealRun(run);
      assert.equal(sealed.beat, 0);
      assert.equal(sealed.echoes.length, turn + 1);
      assert.ok(sealed.positions.every(at => at === run.room.start));
      assert.equal(sealed.echoes.at(-1).actions.join(''), commands.padEnd(G.BEATS, '.'));
      run = sealed;
    }
  }
}
assert.equal(SOLUTIONS[1].at(-1).length, G.BEATS, 'Room 2 wins on the last legal beat');
assert.equal(SOLUTIONS[3].at(-1).length, G.BEATS, 'Room 4 wins on the last legal beat');
assert.equal(move(setup(0, '..UR'), 'DRR.RRUUR').phase, 'won',
  'Room 1 also accepts a staggered recording, not a single required rhythm');

const empty = G.newRun(G.ROOMS[0]);
assert.equal(G.sealRun(empty), empty, 'Cannot seal a zero-beat round');
assert.equal(G.retryRun(empty), empty);
for (const invalid of ['?', 'constructor', ['R'], null, undefined]) {
  assert.equal(G.advance(empty, invalid), empty, 'Unknown commands cannot consume a beat');
}
const spent = move(empty, 'L.........');
assert.equal(empty.beat, 0, 'Moving must not mutate old states');
assert.equal(eventAt(spent.frames, 1, 'player').reason, 'wall');
assert.equal(eventAt(spent.frames, 2, 'player').outcome, 'wait');
assert.equal(spent.phase, 'spent');
assert.equal(G.advance(spent, 'U'), spent, 'The eleventh move cannot occur');
assert.equal(G.sealRun(spent).echoes[0].actions.join(''), 'L.........', 'Blocked inputs are still recorded');

const withPlate = setup(0, 'UR');
const snapshot = JSON.stringify(withPlate);
const preview = G.timeline(withPlate);
assert.equal(JSON.stringify(withPlate), snapshot, 'Forecasts must not modify the current round');
assert.deepEqual(preview, move(withPlate, '..........').frames, 'Forecast and real waits use identical rules');
assert.equal(preview[1].open.join(), '');
assert.equal(preview[1].after.join(), '1');
assert.equal(preview[2].open.join(), '1');

const passingGate = move(setup(1, 'UULLR'), '...RRRL');
assert.equal(eventAt(passingGate.frames, 4, 'player').reason, 'gate', 'Opening is not retroactive within a beat');
assert.equal(eventAt(passingGate.frames, 5, 'player').outcome, 'move', 'Leaving a plate does not close its door mid-beat');
assert.equal(passingGate.frames[4].after.join(), '');
assert.equal(eventAt(passingGate.frames, 6, 'player').outcome, 'move', 'A closed door does not trap an occupant');
assert.equal(eventAt(passingGate.frames, 7, 'player').reason, 'gate', 'Re-entering a closed door is blocked');

const unsynced = move(setup(0, 'UR...L..R'), 'DRRRRUUR');
assert.equal(unsynced.positions.at(-1), unsynced.room.exit);
assert.equal(unsynced.phase, 'playing', 'Being on the exit without hold pressure is not a win');
assert.equal(G.timeline(unsynced).length, 9, 'A forecast stops if the assumed wait would win');
assert.equal(G.advance(unsynced, '.').phase, 'won', 'Waiting at the exit can resynchronize');

const avoidable = setup(2, '.LLUUL');
assert.equal(eventAt(G.timeline(avoidable), 2, 'A').outcome, 'move');
const changed = move(avoidable, 'L.R.');
assert.equal(eventAt(changed.frames, 2, 'A').blocker, 'player', 'Live positions can obstruct an older echo');
assert.equal(eventAt(changed.frames, 3, 'A').blocker, 'player', 'The old echo acts before you vacate a cell');
assert.equal(eventAt(changed.frames, 4, 'A').command, 'U', 'A blocked echo continues with the next instruction');
assert.equal(eventAt(changed.frames, 4, 'A').reason, 'wall', 'An echo does not teleport to its recorded location');

const wrongFork = setup(3, 'UUU', 'R..RRRD', '...RRRRUU');
const failed = move(wrongFork, '....RRRRRR');
assert.equal(failed.phase, 'spent', 'Taking the long branch second misses the opening');
assert.equal(eventAt(failed.frames, 9, 'player').reason, 'gate');
assert.equal(G.canSeal(failed), false);
assert.equal(G.sealRun(failed), failed, 'A full buffer does not overwrite any echo');
const reset = G.retryRun(failed);
assert.equal(reset.echoes, failed.echoes);
assert.equal(reset.beat, 0);
assert.equal(reset.frames.length, 0);
assert.equal(G.removeEcho(failed, 'Z'), failed, 'Only an existing echo can be removed');
const edited = G.removeEcho(failed, 'B');
assert.equal(edited.beat, 0);
assert.equal(edited.echoes.map(echo => echo.id).join(), 'A,C');
const reused = G.sealRun(move(edited, '.'));
assert.equal(G.advance(reused, '.').frames[0].events.map(event => event.actor).join(), 'A,C,B,player',
  'A reused label replays last of the echoes, not in alphabetical order');

function memoryStorage(initial) {
  const data = new Map(initial);
  return { getItem: key => data.get(key) ?? null, setItem: (key, val) => data.set(key, val) };
}

const storage = memoryStorage([['unrelatedSave', 'keep']]);
const record = G.openProgress(() => storage);
assert.equal(record.local, true);
record.complete(2);
assert.equal(record.cleared, 0, 'Cannot mark a locked room cleared');
record.complete(0);
assert.deepEqual(JSON.parse(storage.getItem(G.SAVE_KEY)), { v: 1, cleared: 1 });
assert.equal(storage.getItem('unrelatedSave'), 'keep');
assert.equal(G.openProgress(() => storage).cleared, 1, 'A new session restores progress');
storage.setItem(G.SAVE_KEY, JSON.stringify({ v: 1, cleared: 4 }));
record.complete(1);
assert.equal(record.cleared, 4, 'Completing in an older tab cannot replace a higher count');

// The old invalid boundary (5) is now a real room count; retain the same strict
// out-of-range assertion at the new first invalid boundary (7).
for (const invalid of ['{', 'null', '{"v":2,"cleared":4}', '{"v":1,"cleared":7}', '{"v":1,"cleared":-1}',
  '{"v":1,"cleared":0.5}', '{"v":1,"cleared":"4"}']) {
  assert.equal(G.openProgress(() => memoryStorage([[G.SAVE_KEY, invalid]])).cleared, 0);
}
const denied = () => { throw new Error('Storage denied'); };
const soft = G.openProgress(() => ({ getItem: () => null, setItem: denied }));
soft.complete(0);
assert.equal(soft.local, false);
soft.complete(1);
assert.equal(soft.cleared, 2, 'A write failure must preserve session-only unlocks');
assert.equal(G.openProgress(denied).local, false, 'Even a denied localStorage getter is safe');
assert.equal(G.openProgress(() => undefined).local, false);
assert.equal(G.roomFromHash('#room-4', 0), 0, 'Hash links do not let the player skip locked rooms');
assert.equal(G.roomFromHash('#room-1', 3), 0, 'Hash links can reopen earlier rooms');
assert.equal(G.roomFromHash('', 4), 4, 'Finishing the old four rooms defaults to the newly unlocked fifth room');

// Minimal DOM contract smoke test, not a substitute for a real browser layout pass.
function mount({ hash = '', getStorage = () => undefined } = {}) {
  const roomLocation = { hash };
  const windowEvents = new Map();
  const documentEvents = new Map();
  const document = {
    createElement: tag => node(tag),
    getElementById: id => nodes.get(id) ?? null,
    addEventListener: (type, fn) => documentEvents.set(type, fn),
    activeElement: null,
  };
  function node(tag) {
    const attributes = new Map();
    const classes = new Set();
    const listeners = new Map();
    return {
      children: [], attributes, listeners, hidden: false, disabled: false, textContent: '', value: '',
      classList: { add: token => classes.add(token), toggle: (token, on) => on ? classes.add(token) : classes.delete(token) },
      style: { setProperty() {} },
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      setAttribute: (attr, value) => attributes.set(attr, String(value)),
      removeAttribute: attr => attributes.delete(attr),
      addEventListener: (type, fn) => listeners.set(type, fn),
      closest(selector) { return selector.split(', ').includes(tag) ? this : null; },
      focus() { document.activeElement = this; },
    };
  }
  const ids = [...html.matchAll(/<([a-z][a-z0-9]*)\b[^<>]*\sid="([\w-]+)"[^<>]*>/g)];
  const nodes = new Map(ids.map(([, tag, id]) => [id, node(tag)]));
  assert.equal(nodes.size, ids.length, 'The standalone entry must not have duplicate IDs');
  const window = {
    location: roomLocation,
    history: { replaceState: (_state, _unused, next) => { roomLocation.hash = next; } },
    get localStorage() { return getStorage(); },
    addEventListener: (type, fn) => windowEvents.set(type, fn),
  };
  script.runInNewContext({ document, window });
  function click(id) {
    const element = nodes.get(id);
    assert.equal(element.disabled, false, `${id} must be enabled`);
    assert.equal(element.hidden, false, `${id} must be shown`);
    element.focus();
    element.listeners.get('click')({ detail: 1 });
  }
  return {
    nodes, click, location: roomLocation,
    active: () => document.activeElement,
    key(key, config) {
      const event = { key, target: document.activeElement, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...config };
      documentEvents.get('keydown')(event);
      return event.defaultPrevented;
    },
    select(id, value) {
      const control = nodes.get(id);
      control.value = value;
      control.focus();
      control.listeners.get('change')();
    },
    navigate(next) {
      roomLocation.hash = next;
      windowEvents.get('hashchange')();
    },
  };
}

for (const match of html.matchAll(/\b(?:src|href)="(\.\.\/[^"/]+\/[^"#]+)"/g)) {
  assert.ok(fs.existsSync(path.resolve(path.dirname(htmlFile), match[1])), `Missing standalone resource ${match[1]}`);
}
assert.match(html, /class="back-link" href="\.\.\/"/);

const blockedStorage = mount({ hash: '#room-4', getStorage: denied });
const node = id => blockedStorage.nodes.get(id);
assert.equal(blockedStorage.location.hash, '#room-1');
assert.equal(node('workbench').hidden, false);
assert.equal(node('pick-2').disabled, true);
assert.match(node('save-note').textContent, /无法使用本机存档/);
assert.equal(blockedStorage.key('ArrowUp', { repeat: true }), true);
assert.equal(node('beat-count').textContent, '00', 'A held keyboard direction must not burn beats');
blockedStorage.key('ArrowUp');
blockedStorage.key('d');
assert.match(node('feedback').textContent, /可封存当前路线/);
blockedStorage.key('E');
assert.equal(node('beat-count').textContent, '00');
assert.equal(node('memory').textContent, '回声 1 / 3');
blockedStorage.key(' ');
assert.equal(node('beat-count').textContent, '01');
blockedStorage.key('R');
assert.equal(node('beat-count').textContent, '00');
assert.equal(node('memory').textContent, '回声 1 / 3');
const touch = { U: 'move-up', D: 'move-down', L: 'move-left', R: 'move-right', '.': 'move-wait' };
for (const command of SOLUTIONS[0][1]) blockedStorage.click(touch[command]);
assert.match(node('feedback').textContent, /仅保留在当前页面/);
assert.equal(node('progress-count').textContent, '通关 1 / 6');
assert.equal(blockedStorage.active(), node('next-room'));
blockedStorage.click('next-room');
assert.equal(blockedStorage.location.hash, '#room-2');
assert.equal(mount({ hash: '#room-2', getStorage: denied }).location.hash, '#room-1', 'No-storage progress is session-only');

const collision = mount({ hash: '#room-3', getStorage: () => memoryStorage([[G.SAVE_KEY, '{"v":1,"cleared":2}']]) });
for (const command of '.LLUUL') collision.click(touch[command]);
collision.click('seal');
collision.select('review-beat', '2');
assert.match(collision.nodes.get('review-summary').textContent, /预演/);
assert.equal(collision.key('ArrowLeft'), false, 'Timeline selection must keep native input');
assert.equal(collision.nodes.get('beat-count').textContent, '00', 'Inspecting a forecast spends no beats');
collision.click('move-left');
collision.click('move-wait');
assert.match(collision.nodes.get('feedback').textContent, /回声 A 被你的棋子挡住/);
collision.select('review-beat', '2');
assert.match(collision.nodes.get('review-summary').textContent, /实录/);
assert.match(collision.nodes.get('review-events').textContent, /回声 A：向左，被你的棋子挡住/);
collision.click('erase-A');
assert.equal(collision.nodes.get('beat-count').textContent, '00');
assert.equal(collision.nodes.get('memory').textContent, '回声 0 / 3');

const campaignStorage = memoryStorage();
const campaign = mount({ getStorage: () => campaignStorage });
for (const [index, solution] of SOLUTIONS.entries()) {
  for (const [turn, commands] of solution.entries()) {
    for (const command of commands) campaign.click(touch[command]);
    if (turn < solution.length - 1) campaign.click('seal');
  }
  const refresh = mount({ hash: `#room-${index + 1}`, getStorage: () => campaignStorage });
  assert.equal(refresh.nodes.get('progress-count').textContent, `通关 ${index + 1} / 6`);
  assert.equal(refresh.nodes.get('clear-stamp').hidden, false);
  assert.equal(refresh.nodes.get('play-controls').hidden, true);
  assert.equal(refresh.nodes.get('result-actions').hidden, false);
  assert.equal(refresh.nodes.get('finish').hidden, index < SOLUTIONS.length - 1);
  if (index < SOLUTIONS.length - 1) campaign.click('next-room');
}
campaign.navigate('#room-1');
assert.equal(campaign.nodes.get('room-title').textContent, G.ROOMS[0].title);
campaign.click('replay');
assert.equal(campaign.nodes.get('play-controls').hidden, false);
assert.equal(campaign.nodes.get('progress-count').textContent, '通关 6 / 6', 'Replay cannot erase completion');

console.log('PASS borrowed seconds: six playable rooms, original four routes and failures retained, real/forecast timing, collisions, memory limits, keyboard/touch wiring, save and no-save reloads');
