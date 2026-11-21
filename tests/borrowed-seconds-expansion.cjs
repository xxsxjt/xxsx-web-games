const assert = require('node:assert/strict');
const { G, SOLUTIONS, move, eventAt, mount } = require('./borrowed-seconds.cjs');

const [, , , , fifth, sixth] = G.ROOMS;
const practice = G.PRACTICE;
const [first5, second5, finish5] = SOLUTIONS[4];
const [first6, left6, right6, finish6] = SOLUTIONS[5];
const practiceRecordings = ['UULL', '.URRURR'];
const practiceRoutes = ['..URR..DR', 'DRR....UR'];

// The old maps and bookmark identities are fixtures, not inferred from the new rooms.
const legacyMaps = [
  ['#########', '#.1##.X##', '#S###.###', '#...A.###', '#########'],
  ['#########', '#1..###X#', '###.###.#', '###SA...#', '###..####', '#########'],
  ['#########', '#1.######', '##.######', '#1..S.A##', '######..#', '#######X#', '#########'],
  ['##########', '##1#######', '##.###2###', '##.###.###', '##S.A..BX#', '######2###', '##########'],
];
for (const [i, rows] of legacyMaps.entries()) {
  const room = G.ROOMS[i];
  assert.equal(room.number, i + 1);
  assert.equal(room.hash, `#room-${i + 1}`);
  assert.equal(room.width, rows[0].length);
  assert.equal(room.height, rows.length);
  assert.equal(room.tiles, rows.join(''));
}
assert.equal(G.BEATS, 10);
assert.deepEqual(Array.from(G.ECHO_IDS), ['A', 'B', 'C']);
assert.equal(G.SAVE_KEY, 'xxsxBorrowedSecondsV1');
assert.equal(G.ROOMS.length, 6);
assert.equal(practice.hash, '#practice');
assert.ok(!G.ROOMS.includes(practice));

function record(run, commands, id) {
  const enacted = move(run, commands);
  assert.equal(G.canSeal(enacted), true);
  const sealed = G.sealRun(enacted);
  assert.equal(sealed.beat, 0);
  assert.equal(sealed.echoes.length, run.echoes.length + 1);
  assert.equal(sealed.echoes.at(-1).id, id);
  assert.equal(sealed.echoes.at(-1).actions.join(''), commands.padEnd(10, '.'));
  return sealed;
}

function won(run, beat) {
  assert.equal(run.phase, 'won');
  assert.equal(run.beat, beat);
  assert.equal(run.positions.at(-1), run.room.exit);
  assert.equal(run.frames.at(-1).after.length, run.room.groups.length);
  assert.ok(run.frames.every(frame => frame.events.every(event => event.outcome !== 'blocked')));
  return run;
}

// Room 5: gate 1 is used by the second echo, gate 2 by the player.
const upper5 = record(G.newRun(fifth), first5, 'A');
const upperRecording = move(upper5, second5);
assert.equal(upperRecording.frames[2].open.join(), '');
assert.equal(upperRecording.frames[2].after.join(), '1');
assert.equal(upperRecording.frames[3].open.join(), '1');
assert.equal(fifth.tiles[eventAt(upperRecording.frames, 4, 'player').to], 'A');
const lower5 = move(G.sealRun(upperRecording), finish5.slice(0, 4));
const snapshot5 = JSON.stringify(lower5);
const forecast5 = G.timeline(lower5);
assert.equal(JSON.stringify(lower5), snapshot5);
assert.deepEqual(forecast5, move(lower5, '......').frames, 'Forecasts and real waits settle identically');
assert.equal(forecast5[5].open.join(), '1');
assert.equal(forecast5[5].after.join(), '1,2');
assert.equal(forecast5[6].open.join(), '1,2');
assert.equal(eventAt(forecast5, 7, 'player').outcome, 'wait');
const rushed5 = move(lower5, '.R....');
assert.equal(rushed5.phase, 'spent');
assert.equal(eventAt(rushed5.frames, 6, 'player').reason, 'gate');
assert.equal(eventAt(rushed5.frames, 6, 'player').circuit, '2');
assert.equal(rushed5.positions.at(-1), lower5.positions.at(-1), 'Opening on beat 7 does not replay the blocked input');
const win5 = won(move(lower5, finish5.slice(4)), 8);
assert.equal(fifth.tiles[eventAt(win5.frames, 7, 'player').to], 'B');

// Room 6: left takes longer. Swapping the recordings misses the last feasible start at gate 2.
const anchor6 = record(G.newRun(sixth), first6, 'A');
const staged6 = record(record(anchor6, left6, 'B'), right6, 'C');
const approach6 = move(staged6, finish6.slice(0, 8));
assert.equal(approach6.frames[7].open.join(), '1');
assert.equal(approach6.frames[7].after.join(), '1,2');
assert.equal(approach6.frames[4].events.map(event => event.actor).join(), 'A,B,C,player');
assert.equal(G.canSeal(approach6), false);
assert.equal(G.sealRun(approach6), approach6, 'A live round at capacity cannot overwrite an echo');
won(move(approach6, finish6.slice(8)), 10);

const wrong6 = record(record(anchor6, '..UUUR', 'B'), '...UUULUL', 'C');
const missed6 = move(wrong6, finish6);
assert.equal(missed6.phase, 'spent');
assert.equal(eventAt(missed6.frames, 9, 'player').reason, 'gate');
assert.equal(eventAt(missed6.frames, 9, 'player').circuit, '2');
assert.equal(missed6.frames[8].after.join(), '1,2');
assert.equal(G.sealRun(missed6), missed6, 'Capacity still applies after the tenth beat');

const cut6 = G.removeEcho(missed6, 'C');
assert.equal(cut6.beat, 0);
assert.equal(cut6.echoes.map(echo => echo.id).join(), 'A,B');
assert.equal(cut6.echoes[1], missed6.echoes[1]);
assert.ok(cut6.positions.every(at => at === sixth.start));
assert.equal(missed6.echoes.length, 3, 'Removing an echo does not mutate the old round');
const unfed6 = move(cut6, '..........');
assert.equal(unfed6.phase, 'spent');
assert.equal(unfed6.frames[8].after.join(), '1', 'Deleting C really loses pressure on one of the 2 plates');
assert.equal(unfed6.frames[9].open.join(), '1');
assert.deepEqual(Array.from(sixth.groups[1].plates, at => unfed6.positions.includes(at)), [false, true]);
assert.equal(eventAt(unfed6.frames, 9, 'C'), undefined);
const repaired6 = record(record(G.removeEcho(unfed6, 'B'), left6, 'B'), right6, 'C');
won(move(repaired6, finish6), 10);

// The two practice solutions enter the same gate from different cells, not just at different times.
const practiceSetup = record(record(G.newRun(practice), practiceRecordings[0], 'A'), practiceRecordings[1], 'B');
const practiceGate = practice.tiles.indexOf('A');
for (const [index, route] of practiceRoutes.entries()) {
  const solved = won(move(practiceSetup, route), 9);
  const entry = eventAt(solved.frames, 8, 'player');
  assert.equal(entry.from, practiceGate + (index === 0 ? -1 : 1) * practice.width);
  assert.equal(entry.to, practiceGate);
  assert.equal(solved.frames[6].open.join(), '');
  assert.equal(solved.frames[6].after.join(), '1');
}

const save = G.SAVE_KEY;
function trackStorage(raw) {
  const data = new Map([['unrelatedSave', 'untouched']]);
  if (raw !== undefined) data.set(save, raw);
  const writes = [];
  return {
    writes,
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); data.set(key, value); },
  };
}
const through = (hash, storage) => mount({ hash, getStorage: () => storage });
const get = (app, id) => app.nodes.get(id);
const text = (app, id) => get(app, id).textContent;
const arrow = { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight', '.': '.' };
function keys(app, commands) {
  for (const action of commands) assert.equal(app.key(arrow[action]), true, `Key for ${action} was not handled`);
}
function keyboardRecord(app, commands) {
  keys(app, commands);
  assert.equal(get(app, 'seal').disabled, false);
  assert.equal(app.key('e'), true);
  assert.equal(text(app, 'beat-count'), '00');
  assert.equal(app.active(), get(app, 'board'));
}

for (let cleared = 0; cleared <= 4; cleared++) {
  const raw = JSON.stringify({ v: 1, cleared });
  const storage = trackStorage(raw);
  const app = through('', storage);
  assert.equal(app.location.hash, `#room-${cleared + 1}`);
  assert.equal(text(app, 'progress-count'), `通关 ${cleared} / 6`);
  for (let i = 0; i < 4; i++) {
    const hash = `#room-${i + 1}`;
    app.navigate(hash);
    assert.equal(app.location.hash, i <= cleared ? hash : `#room-${cleared + 1}`);
    assert.equal(get(app, `pick-${i + 1}`).disabled, i > cleared);
    if (i < cleared) assert.equal(get(app, 'clear-stamp').hidden, false);
  }
  assert.equal(storage.getItem(save), raw);
  assert.deepEqual(storage.writes, []);
}

const corrupt = trackStorage('{broken');
assert.equal(through('#room-6', corrupt).location.hash, '#room-1');
const direct = through('#practice', corrupt);
assert.equal(direct.location.hash, '#practice');
assert.equal(text(direct, 'room-title'), practice.title);
assert.equal(get(direct, 'practice-room').attributes.get('aria-current'), 'page');
assert.equal(get(direct, 'practice-actions').hidden, false);
assert.equal(get(direct, 'pick-2').disabled, true);
for (const commands of practiceRecordings) keyboardRecord(direct, commands);
keys(direct, practiceRoutes[0]);
assert.match(text(direct, 'feedback'), /练习成功.*不计入主线/);
assert.equal(direct.active(), get(direct, 'return-mainline'));
assert.equal(get(direct, 'next-room').hidden, true);
assert.equal(get(direct, 'finish').hidden, true);
assert.equal(text(direct, 'progress-count'), '通关 0 / 6');
assert.equal(corrupt.getItem(save), '{broken');
assert.deepEqual(corrupt.writes, [], 'Practice must not repair or overwrite a corrupt campaign record');
direct.click('practice-reset');
assert.equal(get(direct, 'play-controls').hidden, false);
assert.equal(text(direct, 'memory'), '回声 0 / 3');
assert.equal(text(direct, 'beat-count'), '00');
direct.click('return-mainline');
assert.equal(direct.location.hash, '#room-1', 'A direct practice link returns to the default unlocked room');

const noStorage = through('#practice');
assert.match(text(noStorage, 'save-note'), /无法使用本机存档.*每轮路线刷新会丢失/);
keyboardRecord(noStorage, practiceRecordings[0]);
keys(noStorage, 'D');
const reloadedPractice = through(noStorage.location.hash);
assert.equal(text(reloadedPractice, 'beat-count'), '00');
assert.equal(text(reloadedPractice, 'memory'), '回声 0 / 3');
assert.equal(text(reloadedPractice, 'progress-count'), '通关 0 / 6');
assert.equal(reloadedPractice.location.hash, '#practice');
for (const commands of practiceRecordings) keyboardRecord(reloadedPractice, commands);
keys(reloadedPractice, practiceRoutes[1]);
assert.match(text(reloadedPractice, 'feedback'), /练习成功/);
assert.equal(text(reloadedPractice, 'progress-count'), '通关 0 / 6');
assert.equal(get(reloadedPractice, 'pick-2').disabled, true);
reloadedPractice.click('replay');
assert.equal(text(reloadedPractice, 'memory'), '回声 0 / 3');
assert.equal(get(reloadedPractice, 'play-controls').hidden, false);

// One URL/keyboard journey from a real-shaped old save, through practice and into the new results.
const v4 = '{"v":1,"cleared":4}';
const storage = trackStorage(v4);
const campaign = through('#room-6', storage);
assert.equal(campaign.location.hash, '#room-5', 'The sixth room is still locked');
campaign.navigate('#room-4');
assert.equal(get(campaign, 'finish').hidden, true);
campaign.click('next-room');
assert.equal(campaign.location.hash, '#room-5');
assert.equal(campaign.active(), get(campaign, 'room-title'));
keyboardRecord(campaign, first5);
const reload5 = through(campaign.location.hash, storage);
assert.equal(text(reload5, 'memory'), '回声 0 / 3');
assert.match(text(reload5, 'save-note'), /不保存每轮路线，刷新会丢局/);
campaign.click('practice-room');
assert.equal(campaign.location.hash, '#practice');
assert.equal(get(campaign, 'pick-5').attributes.has('aria-current'), false);
assert.equal(campaign.active(), get(campaign, 'room-title'));
keyboardRecord(campaign, practiceRecordings[0]);
campaign.navigate('#practice'); // The hashchange queued by the button must not reinitialize the room.
assert.equal(text(campaign, 'memory'), '回声 1 / 3');
keys(campaign, 'D');
assert.equal(campaign.key('r'), true);
assert.equal(text(campaign, 'beat-count'), '00');
assert.equal(text(campaign, 'memory'), '回声 1 / 3');
campaign.click('erase-A');
assert.equal(text(campaign, 'memory'), '回声 0 / 3');
assert.match(text(campaign, 'feedback'), /压板贡献也会消失/);
keyboardRecord(campaign, practiceRecordings[0]);
campaign.click('practice-reset');
assert.equal(text(campaign, 'memory'), '回声 0 / 3');
assert.equal(get(campaign, 'echo-tools').hidden, true);
for (const commands of practiceRecordings) keyboardRecord(campaign, commands);
campaign.select('review-beat', '8');
assert.match(text(campaign, 'review-summary'), /预演.*1 号门可进入/);
assert.equal(campaign.key('ArrowUp'), false, 'The review select keeps native arrow keys');
assert.equal(campaign.key('e'), false);
assert.equal(text(campaign, 'beat-count'), '00');
campaign.click('move-down');
keys(campaign, practiceRoutes[1].slice(1));
assert.match(text(campaign, 'feedback'), /练习成功/);
campaign.select('review-beat', '8');
assert.match(text(campaign, 'review-summary'), /实录.*1 号门可进入/);
assert.equal(storage.getItem(save), v4);
assert.deepEqual(storage.writes, []);
assert.equal(get(campaign, 'pick-6').disabled, true);
campaign.click('return-mainline');
assert.equal(campaign.location.hash, '#room-5');
assert.equal(get(campaign, 'practice-actions').hidden, true);
assert.equal(get(campaign, 'practice-room').attributes.has('aria-current'), false);
assert.equal(text(campaign, 'memory'), '回声 0 / 3', 'The previous mainline round was not saved');
assert.equal(campaign.active(), get(campaign, 'room-title'));

for (const commands of [first5, second5]) keyboardRecord(campaign, commands);
keys(campaign, finish5);
assert.equal(campaign.active(), get(campaign, 'next-room'));
assert.equal(text(campaign, 'progress-count'), '通关 5 / 6');
assert.equal(through('', storage).location.hash, '#room-6');
campaign.click('next-room');
assert.equal(campaign.location.hash, '#room-6');
for (const commands of [first6, '..UUUR', '...UUULUL']) keyboardRecord(campaign, commands);
keys(campaign, finish6[0]);
assert.equal(get(campaign, 'seal').disabled, true);
assert.equal(campaign.key('e'), true);
assert.match(text(campaign, 'feedback'), /回声槽已满，无法封存.*压板贡献/);
assert.equal(text(campaign, 'beat-count'), '01');
assert.equal(text(campaign, 'memory'), '回声 3 / 3');
keys(campaign, finish6.slice(1));
assert.match(text(campaign, 'feedback'), /十拍用完/);
campaign.select('review-beat', '9');
assert.match(text(campaign, 'review-events'), /你：向上，被关闭的 2 号门挡住/);
campaign.click('erase-C');
assert.equal(text(campaign, 'memory'), '回声 2 / 3');
keys(campaign, '..........');
assert.match(text(campaign, 'review-summary'), /实录｜1 号门可进入/);
assert.doesNotMatch(text(campaign, 'review-events'), /回声 C/);
campaign.click('erase-B');
for (const commands of [left6, right6]) keyboardRecord(campaign, commands);
keys(campaign, finish6);
assert.equal(text(campaign, 'progress-count'), '通关 6 / 6');
assert.equal(campaign.active(), get(campaign, 'finish'));
assert.equal(get(campaign, 'next-room').hidden, true);
assert.deepEqual(storage.writes, [[save, '{"v":1,"cleared":5}'], [save, '{"v":1,"cleared":6}']]);
assert.equal(storage.getItem('unrelatedSave'), 'untouched');
const completed = through('', storage);
assert.equal(completed.location.hash, '#room-6');
assert.equal(get(completed, 'clear-stamp').hidden, false);
assert.equal(get(completed, 'finish').hidden, false);
completed.navigate('#practice');
completed.navigate('#room-2');
assert.equal(text(completed, 'room-title'), G.ROOMS[1].title);
assert.equal(get(completed, 'practice-actions').hidden, true);
completed.click('practice-room');
completed.click('return-mainline');
assert.equal(completed.location.hash, '#room-2', 'The return action prefers the previous room over the latest unlocked one');
assert.equal(get(completed, 'clear-stamp').hidden, false);

console.log('PASS borrowed seconds expansion: split-door timing, three-slot loss and recovery, two practice entries, old saves and keyboard/URL journeys');
