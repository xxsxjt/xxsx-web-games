'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {FakeDocument} = require('./support/dom.cjs');

const source = fs.readFileSync(path.join(__dirname, '../src/overprint.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../games/overprint.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../src/overprint.css'), 'utf8');
const context = {module: {exports: {}}};
const script = new vm.Script(source, {filename: 'src/overprint.js'});
script.runInNewContext(context);
const G = context.module.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const at = (row, column) => (row - 1) * 4 + column - 1;
const IDS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'];

// These are action lists, not finished-board/state fixtures: every route starts with create().
// They exercise both historical A01 solutions and two different full orders for every new ticket.
const ROUTES = {
  A01: [
    [['D', 1, 3], ['H', 2, 3], ['D', 2, 4], ['D', 3, 3], ['D', 2, 2]],
    [['D', 1, 3], ['D', 2, 4], ['D', 3, 3], ['H', 2, 2], ['D', 2, 2]]
  ],
  A02: [
    [['H', 1, 1], ['D', 1, 4], ['D', 3, 3]],
    [['D', 3, 3], ['D', 1, 4], ['H', 1, 1]]
  ],
  A03: [
    [['H', 1, 1], ['D', 1, 2], ['H', 2, 2], ['D', 3, 2], ['D', 1, 4]],
    [['D', 1, 4], ['H', 1, 1], ['D', 1, 2], ['H', 2, 2], ['D', 3, 2]]
  ],
  A04: [
    [['H', 1, 1], ['H', 1, 2], ['D', 2, 2], ['D', 2, 3], ['D', 3, 3]],
    [['D', 3, 3], ['H', 1, 2], ['D', 2, 2], ['H', 1, 1], ['D', 2, 3]]
  ],
  A05: [
    [['H', 1, 2], ['D', 2, 2], ['H', 3, 3], ['D', 1, 4]],
    [['D', 1, 4], ['H', 3, 3], ['H', 1, 2], ['D', 2, 2]]
  ],
  A06: [
    [['H', 1, 1], ['D', 1, 2], ['H', 2, 2], ['D', 3, 2], ['H', 3, 3], ['D', 3, 3], ['D', 1, 4]],
    [['H', 1, 1], ['H', 3, 3], ['D', 1, 2], ['H', 2, 2], ['D', 1, 4], ['D', 3, 3], ['D', 3, 2]]
  ]
};
const EVIDENCE = {
  A01: {safe: 8, solutions: 30}, A02: {safe: 4, solutions: 6},
  A03: {safe: 7, solutions: 5}, A04: {safe: 9, solutions: 80},
  A05: {safe: 7, solutions: 12}, A06: {safe: 13, solutions: 105}
};

function checkedStamp(state, type, anchor) {
  const before = JSON.stringify(state);
  const plan = G.preview(state, type, anchor);
  assert.equal(plan.ok, true, `${state.levelId} ${type}@${anchor}: ${plan.note}`);
  assert.equal(JSON.stringify(state), before, 'Preview is read-only');
  assert.deepEqual(plain(plan.overwrites), plain(plan.cells.filter(cell => cell.current !== '.')));
  assert.deepEqual(plain(plan.blankHits), plain(plan.cells.filter(cell => cell.target === '.')));
  assert.deepEqual(plain(plan.mismatches), plain(plan.cells.filter(cell => cell.target !== '.' && cell.target !== type)));
  const result = G.stamp(state, type, anchor);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(state), before, 'Stamp must preserve its input state');
  assert.deepEqual(plain(result.preview), plain(plan), 'The submitted footprint matches the visible preview exactly');
  const affected = plan.cells.map(cell => cell.index);
  for (let index = 0; index < 16; index++) {
    assert.equal(result.state.board[index], affected.includes(index) ? type : state.board[index]);
  }
  assert.equal(result.state.remaining[type], state.remaining[type] - 1);
  assert.equal(result.state.remaining[type === 'H' ? 'D' : 'H'], state.remaining[type === 'H' ? 'D' : 'H']);
  assert.equal(result.state.history.length, state.history.length + 1);
  assert.equal(result.state.levelId, state.levelId);
  return result;
}

function journey(id, route) {
  let state = G.create(id);
  assert(state.board.every(value => value === '.'));
  route.forEach(([type, row, column], index) => {
    assert.equal(state.phase, 'playing', 'No route may print through a terminal state');
    state = checkedStamp(state, type, at(row, column)).state;
    assert.equal(state.phase, index === route.length - 1 ? 'won' : 'playing');
  });
  assert.equal(G.differences(state).length, 0);
  assert.deepEqual(plain(state.board), plain(G.getLevel(id).target));
  return state;
}

function rejectsWithoutCost(state, type, anchor) {
  const before = JSON.stringify(state);
  assert.equal(G.preview(state, type, anchor).ok, false);
  const result = G.stamp(state, type, anchor);
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.equal(JSON.stringify(state), before, 'Rejected actions consume neither stock nor history');
}

function safePlans(state) {
  return ['H', 'D'].flatMap(type => Array.from({length: 16}, (_, anchor) => G.preview(state, type, anchor)))
    .filter(plan => plan.ok && !plan.blankHits.length);
}

// Exhaustively enumerate using only official preview/stamp transitions. Memo keys contain observed
// states, never synthesized boards. This counts action sequences, not aesthetically distinct layouts.
function countSolutions(id) {
  const memo = new Map();
  function visit(state) {
    if (state.phase === 'won') return 1;
    if (state.phase !== 'playing') return 0;
    const key = `${state.board.join('')}/${state.remaining.H}/${state.remaining.D}`;
    if (memo.has(key)) return memo.get(key);
    let count = 0;
    for (const plan of safePlans(state)) count += visit(G.stamp(state, plan.type, plan.anchor).state);
    memo.set(key, count);
    return count;
  }
  return visit(G.create(id));
}

assert.deepEqual(plain(G.LEVELS.map(level => level.id)), IDS);
assert.equal(new Set(G.LEVELS.map(level => level.target.join(''))).size, 6);
assert.equal(G.getLevel().id, 'A01');
assert.equal(G.create().levelId, 'A01');
assert.equal(G.restart().levelId, 'A01');
assert.equal(G.TARGET, G.getLevel('A01').target);
assert.equal(G.TARGET.join(''), '..D..DHD.DDD..D.');
assert.deepEqual(plain(G.create().remaining), {H: 1, D: 4});
assert.equal(G.getLevel('constructor').id, 'A01');
assert.equal(G.levelFromHash('#level/01'), 'A01');
assert.equal(G.levelFromHash('#level/07'), 'A01');
assert.equal(G.levelFromHash('#level/<script>'), 'A01');
assert(Object.isFrozen(G.LEVELS));

for (const id of IDS) {
  const level = G.getLevel(id);
  const start = G.create(id);
  assert.equal(G.levelFromHash(level.hash), id);
  assert(Object.isFrozen(level.target) && Object.isFrozen(level.initial) && Object.isFrozen(level));
  assert.equal(level.target.length, 16);
  assert(level.target.includes('.') && level.target.includes('D') && level.target.includes('H'));
  assert(safePlans(start).length >= 4, `${id} must offer choices, not a unique highlighted anchor`);
  assert.equal(safePlans(start).length, EVIDENCE[id].safe);
  assert.notDeepEqual(ROUTES[id][0], ROUTES[id][1]);
  const wins = ROUTES[id].map(route => journey(id, route));
  assert.deepEqual(plain(wins[0].board), plain(wins[1].board));
  for (const won of wins) {
    rejectsWithoutCost(won, 'D', 0);
    rejectsWithoutCost(won, 'H', 0);
    const undone = G.undo(won);
    assert.equal(undone.ok, true);
    assert.equal(undone.state.phase, 'playing');
    const [type, row, column] = ROUTES[id][wins.indexOf(won)].at(-1);
    assert.equal(undone.state.remaining[type], won.remaining[type] + 1);
    assert.equal(checkedStamp(undone.state, type, at(row, column)).state.phase, 'won');
    assert.deepEqual(plain(G.restart(won)), plain(start));
  }

  for (const type of ['', 'constructor', 'toString', ['D'], null]) rejectsWithoutCost(start, type, 0);
  for (const anchor of [null, undefined, -1, 16, 2.5, '0', NaN, Infinity]) rejectsWithoutCost(start, 'D', anchor);
  for (const [type, anchor] of [['D', at(4, 4)], ['H', at(2, 4)], ['H', at(4, 4)]]) {
    rejectsWithoutCost(start, type, anchor);
    assert.deepEqual(plain(G.preview(start, type, anchor).cells), [], 'No edge footprint can wrap around');
  }
  assert.equal(G.undo(start).ok, false);

  // Explicitly compare every selectable starting footprint, including deliberately risky prints.
  for (const type of ['H', 'D']) for (let anchor = 0; anchor < 16; anchor++) {
    if (G.preview(start, type, anchor).ok) checkedStamp(start, type, anchor);
  }

  const blankPlan = ['D', 'H'].flatMap(type => Array.from({length: 16}, (_, anchor) => G.preview(start, type, anchor)))
    .find(plan => plan.ok && plan.blankHits.length);
  assert(blankPlan, `${id} must explain a real legal-but-failing print`);
  const failed = checkedStamp(start, blankPlan.type, blankPlan.anchor);
  assert.equal(failed.state.phase, 'lost');
  assert.equal(failed.state.reason, 'blank');
  assert.match(failed.note, /留白.*撤销/);
  rejectsWithoutCost(failed.state, 'D', 0);
  assert.deepEqual(plain(G.undo(failed.state).state), plain(start));
  assert.deepEqual(plain(G.restart(failed.state)), plain(start));

  let wasted = start;
  for (const type of ['H', 'D']) {
    const plan = safePlans(start).find(item => item.type === type);
    assert(plan);
    for (let n = 0; n < level.initial[type]; n++) wasted = checkedStamp(wasted, type, plan.anchor).state;
    rejectsWithoutCost(wasted, type, plan.anchor);
  }
  assert.equal(wasted.phase, 'lost');
  assert.equal(wasted.reason, 'exhausted');
  assert(G.differences(wasted).length > 0);
  assert.deepEqual(plain(wasted.remaining), {H: 0, D: 0});
  const recovered = G.undo(wasted);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.phase, 'playing');
  assert.equal(recovered.state.remaining.D, 1);
  assert.deepEqual(plain(G.restart(wasted)), plain(start));
  let rewound = wasted;
  while (rewound.history.length) rewound = G.undo(rewound).state;
  assert.deepEqual(plain(rewound), plain(start), 'Undo restores all stock and the blank ticket after either loss');

  assert.equal(countSolutions(id), EVIDENCE[id].solutions);
  console.log(`MODEL ${id}: ${ROUTES[id].map(route => route.map(([type, row, column]) => `${type}(${row},${column})`).join(' → ')).join(' | ')}; safe anchors ${EVIDENCE[id].safe}; winning action sequences ${EVIDENCE[id].solutions}`);
}

for (const id of ['A03', 'A06']) {
  const wrongOrder = ROUTES[id][0].slice();
  [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];
  let state = G.create(id);
  for (const [type, row, column] of wrongOrder) state = checkedStamp(state, type, at(row, column)).state;
  assert.equal(state.phase, 'lost', `${id}: reversing base and cover is a real failure, not a cosmetic order`);
  assert.equal(state.reason, 'exhausted');
  assert.equal(G.differences(state).length, 1);
  assert.equal(G.differences(state)[0].index, at(1, 2));
  assert.equal(G.undo(state).state.phase, 'playing');
}

// The fixture parses the shipped HTML and executes the real renderer. Native Tab/Enter/Space
// button activation is simulated below; this is not browser automation, layout or screen-reader proof.
function mount(hash = '', {replaceDenied = false} = {}) {
  const document = new FakeDocument(html);
  const ids = document.querySelectorAll('[id]').map(node => node.getAttribute('id'));
  assert.equal(ids.length, new Set(ids).size);
  const events = new Map();
  const forbidden = () => { throw new Error('Overprint must not access any storage or network'); };
  const window = {
    location: {hash},
    history: {state: {keep: 'unrelated-history'}, replaceState(state, _, next) {
      if (replaceDenied) throw new Error('History unavailable');
      assert.equal(state, window.history.state);
      window.location.hash = next;
    }},
    get localStorage() { return forbidden(); },
    get sessionStorage() { return forbidden(); },
    get indexedDB() { return forbidden(); },
    fetch: forbidden,
    addEventListener: (type, listener) => events.set(type, listener)
  };
  script.runInNewContext({document, window, fetch: forbidden,
    get localStorage() { return forbidden(); }, get sessionStorage() { return forbidden(); }});
  const byId = id => document.getElementById(id);
  const board = byId('work-board');
  const cells = board.querySelectorAll('[data-cell]');
  const page = {
    document, window, byId, board, cells,
    text: id => byId(id).textContent,
    phase: () => byId('feedback').dataset.phase,
    previews: () => board.querySelectorAll('.is-preview').map(cell => Number(cell.dataset.cell)),
    current: () => cells.map(cell => cell.querySelector('.mark').textContent.replace('·', '.')),
    fire: (type, detail) => events.get(type)(detail),
    key: (key, details = {}) => document.activeElement.dispatch('keydown', {key, ...details}),
    tabTo(node) {
      const order = document.querySelectorAll('a,button,[tabindex],summary').filter(item => !item.disabled && item.tabIndex === 0 && !item.hidden);
      assert(order.includes(node), 'The real rendered control must be reachable by Tab');
      for (let i = 0; i < order.length && document.activeElement !== node; i++) {
        order[(order.indexOf(document.activeElement) + 1) % order.length].focus();
      }
      assert.equal(document.activeElement, node);
    },
    activate(id, key = 'Enter') {
      const node = byId(id);
      assert.equal(node.hidden, false);
      assert.equal(node.disabled, false);
      assert(node.textContent.trim().length > 0, 'An authored visible button must have a text label');
      this.tabTo(node);
      assert.equal(this.key(key).defaultPrevented, false, 'Do not hijack native button activation');
      node.dispatch('click', {detail: 0});
    },
    tap(index) { cells[index].querySelector('.mark').dispatch('click', {button: 0, detail: 1, pointerType: 'touch'}); },
    route(id) { window.location.hash = G.getLevel(id).hash; events.get('hashchange')(); }
  };
  return page;
}

function assertBlank(page, id) {
  const level = G.getLevel(id);
  assert.equal(page.window.location.hash, level.hash);
  assert.equal(page.text('level-label'), `${id} / ${level.name}`);
  assert.equal(page.text('level-focus'), level.focus);
  assert.equal(page.text('level-hint'), level.hint);
  assert.equal(page.text('print-bed-label'), `PRINT BED / ${id.slice(1)}`);
  assert.equal(page.phase(), 'playing');
  assert.deepEqual(page.current(), Array(16).fill('.'));
  assert.deepEqual(page.previews(), []);
  assert.equal(page.board.querySelectorAll('.is-anchor').length, 0);
  assert.equal(page.text('history-count'), '0');
  assert.equal(Number(page.text('difference-count')), G.differences(G.create(id)).length);
  assert.equal(Number(page.text('plate-H-stock')), level.initial.H);
  assert.equal(Number(page.text('plate-D-stock')), level.initial.D);
  assert.equal(page.byId('stamp').disabled, true);
  assert.equal(page.byId('undo').disabled, true);
  assert.equal(page.byId('restart').disabled, false);
  assert.equal(page.byId('plate-D').getAttribute('aria-pressed'), 'true');
  assert.equal(page.byId('plate-H').getAttribute('aria-pressed'), 'false');
  assert.equal(page.cells.filter(cell => cell.tabIndex === 0).length, 1);
  assert.equal(page.cells[0].tabIndex, 0);
  for (const other of IDS) {
    assert.equal(page.byId(`level-${other}`).disabled, false);
    assert.equal(page.byId(`level-${other}`).getAttribute('aria-pressed'), String(other === id));
  }
  assert.equal(page.byId('target-board').querySelectorAll('[role="cell"]').map(cell => cell.textContent.replace('·', '.')).join(''), level.target.join(''));
}

function printDOM(page, state, [type, row, column], keyboard) {
  const target = at(row, column);
  if (keyboard) {
    if (page.byId(`plate-${type}`).getAttribute('aria-pressed') !== 'true') page.activate(`plate-${type}`);
    const cursor = page.cells.find(cell => cell.tabIndex === 0);
    page.tabTo(cursor);
    let y = Math.floor(Number(cursor.dataset.cell) / 4) + 1, x = Number(cursor.dataset.cell) % 4 + 1;
    while (y !== row) { page.key(y < row ? 'ArrowDown' : 'ArrowUp'); y += Math.sign(row - y); }
    while (x !== column) { page.key(x < column ? 'ArrowRight' : 'ArrowLeft'); x += Math.sign(column - x); }
    assert.equal(page.document.activeElement, page.cells[target]);
    const before = page.text('history-count');
    assert.equal(page.key(type === 'H' ? 'Enter' : ' ').defaultPrevented, true);
    assert.equal(page.text('history-count'), before, 'Keyboard cell selection only previews');
  } else {
    page.byId(`plate-${type}`).click();
    page.tap(target);
  }
  const plan = G.preview(state, type, target);
  assert(plan.ok);
  assert.equal(page.byId('stamp').disabled, false);
  assert.equal(page.text('preview-note'), plan.note);
  assert.deepEqual(page.previews(), plain(plan.cells.map(cell => cell.index)));
  assert.deepEqual(page.current(), plain(state.board), 'DOM preview must not commit any ink');
  for (const cell of plan.cells) {
    const ghost = page.cells[cell.index].querySelector('.preview-mark');
    const symbol = cell.target === '.' ? '!' : cell.current !== '.' ? '→' : '+';
    assert.equal(ghost.hidden, false);
    assert.equal(ghost.textContent, `${symbol}${type}`);
    assert.match(page.cells[cell.index].getAttribute('aria-label'), /将误印|将覆盖为|将印上/);
  }
  const next = G.stamp(state, type, target).state;
  if (keyboard) page.activate('stamp', ' ');
  else page.byId('stamp').click();
  assert.equal(page.phase(), next.phase);
  assert.deepEqual(page.current(), plain(next.board));
  assert.equal(Number(page.text('history-count')), next.history.length);
  assert.equal(Number(page.text('plate-H-stock')), next.remaining.H);
  assert.equal(Number(page.text('plate-D-stock')), next.remaining.D);
  assert.equal(Number(page.text('difference-count')), G.differences(next).length);
  assert.deepEqual(page.previews(), []);
  return next;
}

const page = mount('#level/01');
assertBlank(page, 'A01');
assert.equal(page.document.querySelector('a').getAttribute('href'), '../');
assert.equal(page.document.querySelector('a').hidden, false);
assert.match(page.document.querySelector('.save-note').textContent, /网址只标记当前工单，不保存局内进度/);
assert.match(page.text('work-keys'), /方向键.*Enter.*预览/);
assert.equal(page.byId('feedback').getAttribute('role'), 'status');
assert.equal(page.byId('preview-note').getAttribute('role'), 'status');
assert.match(css, /button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
assert.match(css, /\.work-cell\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
assert.match(css, /@media \(max-width: 500px\)/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|fetch)\b|\.innerHTML\s*=/);

for (const [index, id] of IDS.entries()) {
  page.activate(`level-${id}`, index % 2 ? ' ' : 'Enter');
  assertBlank(page, id);
  assert.equal(page.document.activeElement, page.byId(`level-${id}`));
  const hintBefore = page.current();
  const summary = page.byId('level-hints').querySelector('summary');
  page.tabTo(summary);
  assert.equal(page.key('Enter').defaultPrevented, false);
  page.byId('level-hints').open = true; // Native details disclosure is simulated, never a model action.
  assert.deepEqual(page.current(), hintBefore);
  assert.equal(page.text('history-count'), '0');

  // Each new ticket has a complete keyboard journey through the actual visible controls.
  let state = G.create(id);
  for (const step of ROUTES[id][0]) state = printDOM(page, state, step, true);
  assert.equal(page.phase(), 'won');
  assert.equal(page.text('phase-label'), '样张一致');
  assert.equal(page.document.activeElement, page.byId('undo'));
  assert.equal(page.byId('stamp').disabled, true);
  assert.equal(page.byId('plate-H').disabled, true);
  assert.equal(page.byId('plate-D').disabled, true);
  page.byId('stamp').dispatch('click', {detail: 0});
  assert.equal(page.phase(), 'won');
  page.activate('undo');
  state = G.undo(state).state;
  assert.equal(page.phase(), 'playing');
  assert.deepEqual(page.current(), plain(state.board));
  state = printDOM(page, state, ROUTES[id][0].at(-1), true);
  page.activate('restart', ' ');
  assertBlank(page, id);
  assert.equal(page.document.activeElement, page.cells[0]);

  // Touch-event route is also complete and naturally committed; refresh discards it.
  state = G.create(id);
  for (const step of ROUTES[id][1]) state = printDOM(page, state, step, false);
  assert.equal(page.phase(), 'won');
  assertBlank(mount(page.window.location.hash), id);
  page.fire('pageshow', {persisted: false});
  assert.equal(page.phase(), 'won');
  page.fire('pageshow', {persisted: true});
  assertBlank(page, id);

  // Both invalid boundary attempts and a real blank failure use the visible controls.
  page.tap(at(4, 4));
  assert.equal(page.byId('stamp').disabled, true);
  assert.equal(page.byId('preview-note').dataset.kind, 'edge');
  page.byId('stamp').dispatch('click');
  assert.equal(page.text('history-count'), '0');
  const start = G.create(id);
  const risk = ['D', 'H'].flatMap(type => Array.from({length: 16}, (_, anchor) => G.preview(start, type, anchor)))
    .find(plan => plan.ok && plan.blankHits.length);
  page.byId(`plate-${risk.type}`).click();
  page.tap(risk.anchor);
  assert.equal(page.byId('preview-note').dataset.kind, 'risk');
  assert.match(page.text('preview-note'), /确认会使本单失败/);
  page.byId('stamp').click();
  assert.equal(page.phase(), 'lost');
  assert.equal(page.text('phase-label'), '留白误印');
  assert.equal(page.document.activeElement, page.byId('undo'));
  page.activate('undo');
  assertBlank(page, id);

  // Waste stock through real print buttons without touching target/state internals.
  state = G.create(id);
  for (const type of ['H', 'D']) {
    const plan = safePlans(G.create(id)).find(item => item.type === type);
    for (let n = 0; n < G.getLevel(id).initial[type]; n++) {
      state = printDOM(page, state, [type, Math.floor(plan.anchor / 4) + 1, plan.anchor % 4 + 1], true);
    }
  }
  assert.equal(page.phase(), 'lost');
  assert.equal(page.text('phase-label'), '版数用尽');
  assert.match(page.text('feedback'), /版数用尽.*可以撤销/);
  assert.equal(page.document.activeElement, page.byId('undo'));
  page.activate('undo');
  assert.equal(page.phase(), 'playing');
  assert.equal(Number(page.text('plate-D-stock')), 1);
  assert.deepEqual(page.current(), plain(G.undo(state).state.board));
  page.activate('restart');
  assertBlank(page, id);

  // Leave ink and a preview, then change tickets through a keyboard-activated visible button.
  state = printDOM(page, G.create(id), ROUTES[id][0][0], false);
  const plan = safePlans(state)[0];
  page.byId(`plate-${plan.type}`).click();
  page.tap(plan.anchor);
  assert(page.previews().length > 0);
  const nextId = IDS[(index + 1) % IDS.length];
  page.activate(`level-${nextId}`);
  assertBlank(page, nextId);
  assert.equal(page.byId('level-hints').open, false);
  assert.equal(page.document.activeElement, page.byId(`level-${nextId}`));
  console.log(`DOM ${id}: keyboard win, undo/re-win/restart, touch win, blank and exhaustion fail/undo, reload/BFCache, boundary reject, dirty switch → ${nextId}`);
}

const routed = mount('#level/06', {replaceDenied: true});
assertBlank(routed, 'A06');
printDOM(routed, G.create('A06'), ROUTES.A06[0][0], true);
routed.tap(at(2, 2));
routed.route('A03');
assertBlank(routed, 'A03');
assert.equal(routed.document.activeElement, routed.cells[0], 'URL changes reset the old grid focus as well as its preview');
routed.window.location.hash = '#unknown';
routed.fire('hashchange');
assertBlank(routed, 'A01');
assertBlank(mount('', {replaceDenied: true}), 'A01');
assertBlank(mount('#level/<img src=x>'), 'A01');
console.log('PASS overprint campaign: 12 natural model solutions, exhaustive official-action solvability, all-ticket failure/undo/stock/terminal checks, 12 visible-control DOM journeys and no-storage routes; browser layout/native inputs/screen readers NOT tested');
