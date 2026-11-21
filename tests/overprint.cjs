'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {FakeDocument} = require('./support/dom.cjs');

const source = fs.readFileSync(path.join(__dirname, '../src/overprint.js'), 'utf8');
const context = {module: {exports: {}}};
vm.runInNewContext(source, context, {filename: 'src/overprint.js'});
const G = context.module.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const at = (row, column) => (row - 1) * 4 + column - 1;
const MAIN = [['D', 1, 3], ['H', 2, 3], ['D', 2, 4], ['D', 3, 3], ['D', 2, 2]];
const ALTERNATE = [['D', 1, 3], ['D', 2, 4], ['D', 3, 3], ['H', 2, 2], ['D', 2, 2]];
const WRONG = [MAIN[1], MAIN[0], ...MAIN.slice(2)];

function stamp(state, type, row, column) {
  const prior = JSON.stringify(state);
  const result = G.stamp(state, type, at(row, column));
  assert.equal(JSON.stringify(state), prior, 'A stamp must not mutate its previous state');
  assert.equal(result.ok, true, `${type}(${row},${column}): ${result.note}`);
  return result.state;
}

function solve(steps) {
  return steps.reduce((state, [type, row, column]) => stamp(state, type, row, column), G.create());
}

assert.equal(G.TARGET.join(''), '..D..DHD.DDD..D.');
assert.equal(G.TARGET.length, 16);

let first = G.create();
assert.equal(G.differences(first).length, 8);
MAIN.forEach(([type, row, column], index) => {
  first = stamp(first, type, row, column);
  assert.equal(G.differences(first).length, [7, 6, 4, 2, 0][index]);
});
assert.equal(first.phase, 'won');
assert.equal(first.reason, '');
assert.deepEqual(plain(first.remaining), {H: 0, D: 0});
assert.deepEqual(plain(G.differences(first)), []);
assert.match(G.stamp(first, 'D', at(2, 2)).note, /已经结束/);

const second = solve(ALTERNATE);
assert.equal(second.phase, 'won', 'The distinct left-anchor route must also solve the ticket');
assert.deepEqual(plain(second.board), plain(first.board));

assert.equal(solve(WRONG.slice(0, 2)).phase, 'playing', 'Ordinary mismatches do not cause premature failure');
const wrongOrder = solve(WRONG);
assert.equal(wrongOrder.phase, 'lost');
assert.equal(wrongOrder.reason, 'exhausted');
assert.equal(G.differences(wrongOrder).length, 1);
assert.equal(G.differences(wrongOrder)[0].row, 2);
assert.equal(G.differences(wrongOrder)[0].column, 3);
assert.equal(wrongOrder.board[at(2, 3)], 'D');
assert.deepEqual(plain(G.differences(wrongOrder)), [{index: at(2, 3), row: 2, column: 3, current: 'D', target: 'H'}]);

const blankStart = G.create();
const blankPreview = G.preview(blankStart, 'D', at(1, 1));
assert.equal(blankPreview.ok, true, 'A blank error is confirmed only when printed, not during preview');
assert.deepEqual(plain(blankPreview.blankHits.map(item => item.index)), [at(1, 1), at(2, 1)]);
assert.ok(blankStart.board.every(value => value === '.'));
assert.deepEqual(plain(blankStart.remaining), {H: 1, D: 4});
const blankFail = G.stamp(blankStart, 'D', at(1, 1));
assert.equal(blankFail.state.phase, 'lost');
assert.equal(blankFail.state.reason, 'blank');
assert.equal(blankFail.state.remaining.D, 3);
assert.match(blankFail.note, /留白/);
const blankUndo = G.undo(blankFail.state);
assert.equal(blankUndo.state.phase, 'playing');
assert.deepEqual(plain(blankUndo.state.remaining), {H: 1, D: 4});
assert.deepEqual(plain(blankUndo.state.board), Array(16).fill('.'));

const edge = G.create();
const down = G.preview(edge, 'D', at(4, 3));
assert.equal(down.ok, false);
assert.equal(down.edge, '下边');
const right = G.preview(edge, 'H', at(2, 4));
assert.equal(right.ok, false);
assert.equal(right.edge, '右边');
assert.equal(G.preview(edge, 'H', at(4, 4)).edge, '右边和下边');
assert.deepEqual(plain(right.cells), [], 'Right-edge footprints must not wrap to the next row');
assert.equal(G.stamp(edge, 'D', at(4, 3)).state, edge, 'Out-of-board prints do not create history');
assert.equal(G.stamp(edge, 'H', at(2, 4)).state, edge);
assert.equal(edge.history.length, 0);

const cornerCut = G.preview(edge, 'H', at(2, 3));
assert.equal(cornerCut.ok, true);
assert.equal(cornerCut.cells.length, 3, 'The H plate has a missing lower-right corner');
const afterCut = G.stamp(edge, 'H', at(2, 3)).state;
assert.equal(afterCut.board[at(3, 4)], '.', 'The missing corner must remain blank');

const stalePreview = G.create();
assert.equal(G.stamp(stalePreview, '', at(1, 3)).state, stalePreview);
assert.equal(G.stamp(stalePreview, 'constructor', at(1, 3)).state, stalePreview);
for (const index of [null, undefined, -1, 16, 1.5, '2']) {
  assert.equal(G.stamp(stalePreview, 'D', index).state, stalePreview, 'Invalid anchors are no-ops');
}
assert.equal(G.stamp(stalePreview, 'D', at(1, 3)).state.history.length, 1);
assert.equal(G.stamp(stalePreview, ['D'], at(1, 3)).state, stalePreview);
const noUndo = G.undo(G.create());
assert.equal(noUndo.ok, false);
assert.equal(G.stamp(G.create(), 'H', at(2, 3)).state.remaining.H, 0);
const noStock = G.stamp(G.stamp(G.create(), 'H', at(2, 3)).state, 'H', at(2, 2));
assert.equal(noStock.ok, false);

const played = stamp(G.create(), 'D', 1, 3);
const planned = G.preview(played, 'H', at(2, 3));
assert.deepEqual(plain(planned.overwrites.map(item => item.index)), [at(2, 3)]);
assert.deepEqual(plain(planned.mismatches.map(item => item.index)), [at(2, 4), at(3, 3)]);
assert.equal(played.board[at(2, 3)], 'D', 'Preview must not paint the board');
assert.equal(stamp(played, 'D', 1, 3).remaining.D, 2, 'Deliberate reprints spend a plate even if the pattern is unchanged');
const erased = G.undo(played);
assert.equal(erased.ok, true);
assert.deepEqual(plain(erased.state.board), Array(16).fill('.'));
assert.deepEqual(plain(erased.state.remaining), {H: 1, D: 4});
assert.equal(erased.state.history.length, 0);
assert.deepEqual(plain(G.restart(first).board), Array(16).fill('.'));
assert.deepEqual(plain(G.restart(first).remaining), {H: 1, D: 4});
assert.deepEqual(plain(G.undo(first).state), plain(solve(MAIN.slice(0, -1))));

const html = fs.readFileSync(path.join(__dirname, '../games/overprint.html'), 'utf8');
const script = new vm.Script(source, {filename: 'src/overprint.js'});

function mount(hash = '', {replaceDenied = false} = {}) {
  const document = new FakeDocument(html);
  const ids = document.querySelectorAll('[id]').map(node => node.getAttribute('id'));
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
  const events = new Map();
  const historyState = {keep: 1};
  let replacements = 0;
  const forbidden = () => { throw new Error('A01 must not touch storage or issue network requests'); };
  const window = {
    location: {hash},
    history: {state: historyState, replaceState(state, _, next) {
      if (replaceDenied) throw new Error('History API unavailable');
      assert.equal(state, historyState);
      replacements++;
      window.location.hash = next;
    }},
    get localStorage() { return forbidden(); },
    get sessionStorage() { return forbidden(); },
    fetch: forbidden,
    addEventListener: (type, listener) => events.set(type, listener)
  };
  script.runInNewContext({document, window, fetch: forbidden});
  const byId = id => document.getElementById(id);
  const board = byId('work-board');
  const cells = board.querySelectorAll('[data-cell]');
  function tabTo(target) {
    const order = document.querySelectorAll('a,button,[tabindex],summary').filter(node => !node.disabled && node.tabIndex === 0);
    assert(order.includes(target), 'Target must be reachable from the authored tab order');
    for (let i = 0; i < order.length && document.activeElement !== target; i++) {
      order[(order.indexOf(document.activeElement) + 1) % order.length].focus();
    }
    assert.equal(document.activeElement, target);
  }
  return {
    document, window, board, cells, byId,
    text: id => byId(id).textContent,
    hash: () => window.location.hash,
    replacements: () => replacements,
    fire: (type, detail) => events.get(type)(detail),
    phase: () => byId('feedback').dataset.phase,
    current: index => cells[index].querySelector('.mark').textContent,
    ghost: index => cells[index].querySelector('.preview-mark'),
    previews: () => board.querySelectorAll('.is-preview').map(cell => Number(cell.dataset.cell)),
    tap: (index, pointerType = 'touch') => cells[index].querySelector('.mark').dispatch('click', {button: 0, detail: 1, pointerType}),
    click: id => byId(id).click(),
    key: (key, details) => document.activeElement.dispatch('keydown', {key, ...details}),
    tabTo,
    activate(id) {
      tabTo(byId(id));
      assert.equal(this.key('Enter').defaultPrevented, false, 'Native button activation is not intercepted');
      byId(id).dispatch('click', {detail: 0});
    },
  };
}

function numbers(page, expected) {
  assert.deepEqual(['plate-H-stock', 'plate-D-stock', 'history-count', 'difference-count'].map(id => Number(page.text(id))), expected);
}

function resetAssertions(page) {
  numbers(page, [1, 4, 0, 8]);
  assert.equal(page.phase(), 'playing');
  assert.equal(page.byId('plate-D').getAttribute('aria-pressed'), 'true');
  assert.equal(page.byId('stamp').disabled, true);
  assert.equal(page.byId('undo').disabled, true);
  assert.deepEqual(page.previews(), []);
  assert.ok(page.cells.every((_, index) => page.current(index) === '·'));
}

function pointerPrint(page, type, row, column) {
  assert.equal(page.byId(`plate-${type}`).disabled, false);
  page.click(`plate-${type}`);
  page.tap(at(row, column));
  assert.equal(page.byId('stamp').disabled, false);
  page.click('stamp');
}

const view = mount('#unknown');
assert.equal(view.hash(), '#level/01');
assert.equal(view.replacements(), 1);
// A02 is now a real route; keep the original invalid-route fallback assertions using an unknown order.
view.window.location.hash = '#level/99';
view.fire('hashchange');
assert.equal(view.hash(), '#level/01');
assert.equal(view.replacements(), 2);
assert.equal(mount('', {replaceDenied: true}).hash(), '#level/01');
assert.equal(mount('#level/01').replacements(), 0);
resetAssertions(view);
assert.equal(view.document.querySelector('a').getAttribute('href'), '../');
assert.equal(view.board.getAttribute('role'), 'grid');
assert.equal(view.board.children.length, 4);
assert.ok(view.board.children.every(row => row.getAttribute('role') === 'row' && row.children.length === 4));
assert.equal(view.cells.length, 16);
assert.equal(view.cells.filter(cell => cell.tabIndex === 0).length, 1);
assert.match(view.cells[0].getAttribute('aria-label'), /第 1 行第 1 列，当前留白，目标留白/);
assert.equal(view.byId('target-board').querySelectorAll('[role="cell"]').map(cell => cell.textContent.replace('·', '.')).join(''), G.TARGET.join(''));
view.byId('stamp').dispatch('click');
view.byId('undo').dispatch('click');
resetAssertions(view);

view.tap(at(4, 3));
assert.equal(view.byId('stamp').disabled, true);
assert.equal(view.byId('preview-note').dataset.kind, 'edge');
assert.match(view.text('preview-note'), /下边/);
assert.deepEqual(view.previews(), []);
view.click('plate-H');
view.tap(at(2, 4));
assert.match(view.text('preview-note'), /右边/);
assert.deepEqual(view.previews(), []);
view.byId('stamp').dispatch('click');
numbers(view, [1, 4, 0, 8]);

view.click('plate-D');
view.tap(at(1, 1));
assert.equal(view.byId('preview-note').dataset.kind, 'risk');
assert.match(view.text('preview-note'), /确认会使本单失败/);
assert.equal(view.ghost(at(2, 1)).textContent, '!D');
assert.match(view.cells[0].getAttribute('aria-label'), /将误印实点/);
assert.deepEqual(view.previews(), [at(1, 1), at(2, 1)]);
numbers(view, [1, 4, 0, 8]);
view.click('stamp');
assert.equal(view.phase(), 'lost');
assert.equal(view.text('phase-label'), '留白误印');
assert.equal(view.document.activeElement, view.byId('undo'));
assert.equal(view.byId('plate-H').disabled, true);
assert.equal(view.byId('plate-D').disabled, true);
numbers(view, [1, 3, 1, 10]);
view.click('undo');
resetAssertions(view);
assert.equal(view.document.activeElement, view.cells[0]);

view.tap(at(1, 3));
assert.match(view.text('preview-note'), /1 格会暂时不同/);
assert.equal(view.ghost(at(1, 3)).textContent, '+D');
assert.equal(view.current(at(1, 3)), '·');
view.click('plate-H');
assert.equal(view.byId('stamp').disabled, true);
assert.deepEqual(view.previews(), []);
view.byId('stamp').dispatch('click');
numbers(view, [1, 4, 0, 8]);
pointerPrint(view, ...MAIN[0]);
view.byId('stamp').dispatch('click');
numbers(view, [1, 3, 1, 7]);
assert.match(view.text('feedback'), /第 2 行第 3 列现在是实点，样张要横纹/);
view.click('plate-H');
view.tap(at(2, 3));
assert.equal(view.ghost(at(2, 3)).textContent, '→H');
assert.match(view.cells[at(2, 3)].getAttribute('aria-label'), /将覆盖为横纹/);
assert.match(view.text('preview-note'), /覆盖 1 格/);
assert.deepEqual(view.previews(), [at(2, 3), at(2, 4), at(3, 3)]);
view.click('stamp');
numbers(view, [0, 3, 2, 6]);
assert.equal(view.byId('plate-D').getAttribute('aria-pressed'), 'false', 'Depletion requires a deliberate next plate choice');
assert.equal(view.document.activeElement, view.byId('plate-D'));
assert.equal(view.byId('plate-H').disabled, true);
view.tap(at(2, 4));
assert.equal(view.byId('stamp').disabled, true);
assert.match(view.text('preview-note'), /先选/);
for (const step of MAIN.slice(2)) pointerPrint(view, ...step);
numbers(view, [0, 0, 5, 0]);
assert.equal(view.phase(), 'won');
assert.match(view.text('feedback'), /样张一致/);
assert.equal(view.document.activeElement, view.byId('undo'));
view.click('undo');
numbers(view, [0, 1, 4, 2]);
assert.equal(view.phase(), 'playing');
pointerPrint(view, ...MAIN.at(-1));
assert.equal(view.phase(), 'won');
view.fire('pageshow', {persisted: false});
assert.equal(view.phase(), 'won');
view.fire('pageshow', {persisted: true});
resetAssertions(view);
assert.equal(view.document.activeElement, view.cells[0]);
resetAssertions(mount('#level/01'));

for (const step of WRONG) pointerPrint(view, ...step);
numbers(view, [0, 0, 5, 1]);
assert.equal(view.text('phase-label'), '版数用尽');
assert.match(view.text('feedback'), /第 2 行第 3 列/);
view.click('restart');
resetAssertions(view);
assert.equal(view.document.activeElement, view.cells[0]);

const keyboard = mount();
keyboard.tabTo(keyboard.cells[0]);
assert.equal(keyboard.key('ArrowLeft').defaultPrevented, true);
assert.equal(keyboard.document.activeElement, keyboard.cells[0]);
assert.equal(keyboard.key('ArrowRight', {altKey: true}).defaultPrevented, false);
assert.equal(keyboard.key('Enter', {isComposing: true}).defaultPrevented, false);
assert.equal(keyboard.key('Enter', {repeat: true}).defaultPrevented, true);
assert.equal(keyboard.byId('stamp').disabled, true);
const stampControl = keyboard.byId('stamp');
for (const [type, row, column] of ALTERNATE) {
  const plate = keyboard.byId(`plate-${type}`);
  if (plate.getAttribute('aria-pressed') !== 'true') keyboard.activate(`plate-${type}`);
  const cursor = keyboard.cells.find(cell => cell.tabIndex === 0);
  keyboard.tabTo(cursor);
  let y = Math.floor(Number(cursor.dataset.cell) / 4) + 1, x = Number(cursor.dataset.cell) % 4 + 1;
  while (y !== row) { keyboard.key(y < row ? 'ArrowDown' : 'ArrowUp'); y += Math.sign(row - y); }
  while (x !== column) { keyboard.key(x < column ? 'ArrowRight' : 'ArrowLeft'); x += Math.sign(column - x); }
  assert.equal(keyboard.document.activeElement, keyboard.cells[at(row, column)]);
  const before = keyboard.text('history-count');
  assert.equal(keyboard.key(type === 'H' ? 'Enter' : ' ').defaultPrevented, true);
  assert.equal(keyboard.text('history-count'), before);
  assert.equal(keyboard.byId('stamp'), stampControl, 'Render must not replace a focused control');
  assert.equal(stampControl.disabled, false);
  keyboard.activate('stamp');
}
numbers(keyboard, [0, 0, 5, 0]);
assert.equal(keyboard.phase(), 'won');
assert.equal(keyboard.document.activeElement, keyboard.byId('undo'));

console.log('PASS overprint: two solutions, both failure modes, preview/cover/edge, stock and undo, model immutability, pointer and keyboard DOM flows, route and no-save reloads');
