'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/ember-convoy.js'), 'utf8');
const context = vm.createContext({ module: { exports: {} } });
vm.runInContext(source, context, { filename: 'src/ember-convoy.js', timeout: 1000 });
const G = context.module.exports;
const clone = value => JSON.parse(JSON.stringify(value));
const mapState = state => clone(state);

function route(seed, kind = 'quiet') {
  const state = G.create(seed);
  assert.equal(G.act(state, 'route', { route: kind }), true);
  return state;
}
function act(state, action, data = {}) {
  assert.equal(G.reason(state, action, data), '', action + ' reason: ' + G.reason(state, action, data));
  assert.equal(G.act(state, action, data), true, action + ' must apply');
  assert.equal(G.validState(state), true, action + ' must preserve a valid state');
  return state;
}
function victory(seed, routePlan = ['quiet', 'quiet', 'quiet']) {
  if (!Array.isArray(routePlan)) routePlan = ['quiet', 'quiet', routePlan];
  const s = G.create(seed);
  for (let leg = 0; leg < 3; leg++) {
    act(s, 'route', { route: routePlan[leg] });
    while (s.phase === 'battle') {
      // Every real battle input is chosen from an enabled ship/enemy and lets
      // the actual telegraphed enemy phase resolve between command pairs.
      while (s.phase === 'battle' && s.battle.commands > 0) {
        const enemy = s.battle.enemies[0];
        // Weapon upgrades plus the front's breach action are a reproducible
        // three-command cadence across every encounter, including the elite.
        const actions = [0, 1, 2].filter(i => s.hull[i] > 0 && !s.battle.used[i] && s.heat[i] < 4);
        const ship = actions.find(i => i === 0 && s.heat[0] <= 2) ?? actions[0];
        if (ship === undefined) break;
        const input = ship === 0 && s.heat[0] <= 2 ? 'breach' : 'attack';
        act(s, input, input === 'breach' ? { enemy: enemy.id } : { ship, enemy: enemy.id });
      }
      if (s.phase === 'battle') act(s, 'endTurn');
    }
    assert.equal(s.phase, 'salvage', 'the designed deterministic route should be beatable');
    act(s, 'salvage', { choice: s.hull.some((hp, i) => hp < s.hullMax[i] && hp > 0) ? 'patch' : 'parts' });
    if (!s.upgradeUsed && s.scrap >= 2 && s.weapon < 2) act(s, 'upgrade', { kind: 'weapon' });
    act(s, 'continue');
  }
  assert.equal(s.phase, 'extract');
  act(s, 'extract');
  return s;
}

// Deterministic seed display is an exact round-trip, unlike hashing its display text.
const numericSeed = 0x1023abcd;
assert.equal(G.seedValue(G.seedCode(numericSeed)), numericSeed);
assert.equal(G.create(G.seedCode(numericSeed)).seed, numericSeed);
assert.equal(G.create('0x1023ABCD').seed, numericSeed);
assert.equal(G.create('EMBER-01').seed, G.create('EMBER-01').seed);
assert.notEqual(G.create('EMBER-01').seed, G.create('EMBER-02').seed);

// Public route forecast and combat intent are deterministic and reachable from real actions.
const first = route('EMBER-01');
const roundOne = G.forecast(first);
assert.deepEqual(clone(roundOne.hull), [10, 10, 10]);
assert.deepEqual(clone(first.battle.enemies.map(enemy => enemy.target)), [0, 2]);
assert.equal(first.battle.enemies[0].intent, 'shot');
assert.equal(first.battle.enemies[0].damage, 2);
assert.equal(G.forecast(first).impacts.map(item => item.id).join(), 'e0-0,e0-1');
assert.equal(first.battle.round, 1, 'forecast must not mutate the live state');

// Repro the draft bug: filtering one killed enemy must preserve its stable ID/order.
act(first, 'breach', { enemy: 'e0-0' });
act(first, 'attack', { ship: 1, enemy: 'e0-0' });
assert.deepEqual(clone(first.battle.enemies.map(enemy => enemy.id)), ['e0-1']);
assert.equal(G.validState(first), true);
assert.equal(G.decode(G.encode(first, 4)).state.battle.enemies[0].id, 'e0-1');
assert.equal(G.reason(first, 'attack', { ship: 1, enemy: 'e0-1' }), '该舰本回合已行动');
act(first, 'endTurn');
assert.equal(first.battle.round, 2);

// Armor, overheat penalty, heat cap and distinct ship actions.
const rich = route(7, 'rich');
const armored = rich.battle.enemies.find(enemy => enemy.armor > 0);
assert.ok(armored);
const baseDamage = Math.max(1, 4 - armored.armor);
assert.equal(G.forecast(rich).phase, 'battle');
act(rich, 'attack', { ship: 0, enemy: armored.id });
assert.equal(armored.hp, armored.maxHp - baseDamage);
assert.equal(rich.heat[0], 1);
assert.equal(G.reason(rich, 'attack', { ship: 0, enemy: armored.id }), '该舰本回合已行动');
assert.match(G.reason(rich, 'attack', { ship: 1, enemy: 'missing' }), /无效参数/);
const hot = route(8);
assert.equal(G.validState(hot), true);
assert.equal(G.reason(hot, 'endTurn'), '');
assert.equal(G.reason(hot, 'vent'), '全舰没有积热');
assert.equal(G.reason(hot, 'cool', { ship: 0 }), '该舰没有积热');
act(hot, 'breach', { enemy: 'e0-0' });
assert.equal(hot.heat[0], 2);
assert.equal(G.reason(hot, 'cool', { ship: 0 }), '该舰本回合已行动');
act(hot, 'endTurn');
assert.equal(hot.heat[0], 1);
assert.equal(G.reason(hot, 'cool', { ship: 0 }), '');
act(hot, 'cool', { ship: 0 });
assert.equal(hot.heat[0], 0, 'self-cooling removes three heat from a previously warm ship');

// Protection, armor, useful finite repair cost and unavoidable repair-cap softlocks.
const support = route(13, 'rich');
const target = support.battle.enemies[0].target;
act(support, 'screen', { target });
assert.equal(support.shield[target], 6);
assert.equal(support.battle.cover[target], true);
assert.equal(support.heat[1], 1);
const preview = G.forecast(support);
assert.ok(preview.impacts.some(hit => hit.target === target && hit.reduced === 2));
const damagedSupport = route(0, 'rich');
act(damagedSupport, 'endTurn');
act(damagedSupport, 'endTurn');
const repairTarget = damagedSupport.hull.findIndex((hp, i) => hp > 0 && hp < damagedSupport.hullMax[i]);
assert.ok(repairTarget >= 0, 'real public volleys should make repair meaningful');
const beforeRepair = damagedSupport.hull[repairTarget];
act(damagedSupport, 'repair', { target: repairTarget });
assert.ok(damagedSupport.hull[repairTarget] > beforeRepair);
assert.equal(damagedSupport.scrap, 1);
assert.equal(G.reason(damagedSupport, 'repair', { target: repairTarget }), '该舰本回合已行动');
act(damagedSupport, 'endTurn');
assert.ok(damagedSupport.battle.round <= G.roundLimit);
const full = route(4);
assert.equal(G.reason(full, 'endTurn'), '');
act(full, 'endTurn');
assert.equal(full.battle.round, 2, 'passing with two commands is a legal finite-cost action');

// A genuine 12-round stall cannot continue forever or create an unloadable save.
const stall = route(91);
for (let round = 0; round < G.roundLimit && stall.phase === 'battle'; round++) act(stall, 'endTurn');
assert.equal(stall.phase, 'lost');
assert.equal(stall.reason, 'blockade');
assert.equal(G.validState(stall), true);
assert.equal(G.decode(G.encode(stall, 1)).state.phase, 'lost');
assert.equal(G.reason(stall, 'endTurn'), '当前不在战斗中');

// A seeded policy samples only currently legal public decisions until it loses
// through natural attack/conserve/repair choices, with no HP injection.
let lossRng = 198;
const lossPick = limit => { lossRng = (Math.imul(lossRng, 1664525) + 1013904223) >>> 0; return lossRng % limit; };
const doomed = G.create(6);
let deadShipSnapshot = null;
for (let actionCount = 0; actionCount < 300 && !['lost', 'won'].includes(doomed.phase); actionCount++) {
  let choices = [];
  if (doomed.phase === 'route') choices = ['quiet', 'rich'].map(route => ({ action: 'route', data: { route } }));
  else if (doomed.phase === 'battle') {
    for (let ship = 0; ship < 3; ship++) {
      if (!doomed.hull[ship] || doomed.battle.used[ship] || !doomed.battle.commands) continue;
      for (const enemy of doomed.battle.enemies) if (doomed.heat[ship] < 4) choices.push({ action: 'attack', data: { ship, enemy: enemy.id } });
      if (ship === 0 && doomed.heat[ship] <= 2) for (const enemy of doomed.battle.enemies) choices.push({ action: 'breach', data: { enemy: enemy.id } });
      if (ship === 1) for (let target = 0; target < 3; target++) if (doomed.hull[target]) choices.push({ action: 'screen', data: { target } });
      if (ship === 2) {
        for (let target = 0; target < 3; target++) if (doomed.hull[target] && (doomed.hull[target] < doomed.hullMax[target] || doomed.heat[target] > 0) && doomed.scrap) choices.push({ action: 'repair', data: { target } });
        if (doomed.heat.some(Boolean)) choices.push({ action: 'vent', data: {} });
      }
    }
    choices.push({ action: 'endTurn', data: {} });
  } else if (doomed.phase === 'salvage') choices = ['patch', 'parts'].map(choice => ({ action: 'salvage', data: { choice } }));
  else if (doomed.phase === 'upgrade') {
    choices = [{ action: 'continue', data: {} }];
    for (const kind of ['weapon', 'plating']) if (!doomed.upgradeUsed && doomed.scrap >= 2 && doomed[kind] < 2) choices.push({ action: 'upgrade', data: { kind } });
  } else if (doomed.phase === 'extract') choices = [{ action: 'extract', data: {} }];
  choices = choices.filter(choice => !G.reason(doomed, choice.action, choice.data));
  assert.ok(choices.length, 'seeded decision policy always has a legal move');
  const choice = choices[lossPick(choices.length)];
  assert.equal(G.act(doomed, choice.action, choice.data), true);
  if (!deadShipSnapshot && doomed.phase === 'battle' && doomed.hull.some(hp => hp === 0) && doomed.hull.some(hp => hp > 0)) deadShipSnapshot = clone(doomed);
}
assert.equal(doomed.phase, 'lost');
assert.ok(['destroyed', 'blockade'].includes(doomed.reason));
assert.ok(deadShipSnapshot, 'a naturally disabled ship must be observed while its battle remains active');
const deadShipState = mapState(deadShipSnapshot);
const deadShip = deadShipState.hull.findIndex(hp => hp === 0);
const aliveTarget = deadShipState.battle.enemies[0].id;
const deadShipBefore = JSON.stringify(deadShipState);
assert.equal(G.reason(deadShipState, 'attack', { ship: deadShip, enemy: aliveTarget }), '该舰已失联，不能行动');
assert.equal(G.act(deadShipState, 'attack', { ship: deadShip, enemy: aliveTarget }), false);
assert.equal(JSON.stringify(deadShipState), deadShipBefore, 'dead-ship action must not consume a command or change the save');
assert.equal(G.validState(deadShipState), true);
assert.deepEqual(clone(G.decode(G.encode(deadShipState, 2)).state), deadShipState, 'active battle with a dead ship must remain reloadable');
const destroyedShip = doomed.hull.findIndex(hp => hp === 0);
assert.ok(destroyedShip >= 0);
assert.equal(doomed.shield[destroyedShip], 0);
assert.equal(doomed.heat[destroyedShip], 0);
assert.equal(doomed.battle, null);
assert.equal(G.reason(doomed, 'attack', { ship: destroyedShip, enemy: 'e0-0' }), '当前不在战斗中');

// Three legs, real combat + salvage + refit + affirmative extraction reaches a win.
const won = victory('EC-DA120B77');
assert.equal(won.phase, 'won');
assert.equal(won.reason, 'evacuated');
assert.equal(won.history.filter(item => item.action === 'route').length, 3);
assert.equal(won.history.filter(item => item.action === 'extract').length, 1);
assert.ok(won.history.some(item => item.action === 'breach'));
assert.ok(won.history.some(item => item.action === 'salvage'));
assert.ok(won.history.some(item => item.action === 'upgrade'));
assert.ok(won.hull.some(hp => hp > 0));
const allRich = victory('EC-DA120B77', ['rich', 'rich', 'rich']);
assert.equal(allRich.phase, 'won', 'a real seeded command policy must also clear all three high-threat routes');
assert.equal(allRich.history.filter(item => item.action === 'route' && item.data.route === 'rich').length, 3);

// Third-route crown elite is mandatory, explicitly telegraphed, and has a powered even-round shot.
const winningPath = victory(0, 'rich');
const eliteIndex = winningPath.history.findIndex((item, index) => item.action === 'route' && winningPath.history.filter((prior, priorIndex) => priorIndex <= index && prior.action === 'route').length === 3);
const realElite = G.replay(0, winningPath.history.slice(0, eliteIndex + 1));
assert.ok(realElite);
assert.equal(realElite.battle.enemies[0].type, 'crown');
act(realElite, 'endTurn');
assert.equal(realElite.battle.round, 2);
assert.equal(realElite.battle.enemies[0].intent, 'cannon');
assert.equal(realElite.battle.enemies[0].damage, 5);
assert.equal(G.forecast(realElite).impacts[0].damage, 5);

// Replay is an action-level proof; impossible phase/HP/targets, extra properties and corrupt checksum fail.
assert.deepEqual(clone(G.replay(won.seed, won.history)), clone(won));
const beforeExtract = G.replay(won.seed, won.history.slice(0, -1));
assert.ok(beforeExtract);
assert.equal(beforeExtract.phase, 'extract', 'three clearances do not infer victory without extraction action');
const encoded = G.encode(won, 22);
assert.ok(encoded);
const envelope = JSON.parse(encoded);
assert.deepEqual(clone(G.decode(encoded).state), clone(won));
envelope.checksum = 'ec1-00000000';
assert.equal(G.decode(JSON.stringify(envelope)), null);
const forged = clone(won); forged.hull = [10, 10, 10];
assert.equal(G.validState(forged), true, 'structural phase checks accept plausible fleet values');
assert.equal(G.encode(forged, 1), null, 'action-history reachability must reject the forged result');
const unknown = clone(won); unknown.privateData = 'x';
assert.equal(G.validState(unknown), false, 'unknown fields must fail closed');
assert.equal(G.reason(won, 'extract'), '需清空三段航路后才能撤离');
assert.equal(G.reason(won, 'route', { route: 'quiet' }), '当前不是航路选择阶段');

function memoryStorage(initial = []) {
  const values = new Map(initial);
  return {
    values,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
const saves = memoryStorage([['legacy-neon-save', 'keep'], ['anotherGame', '{"progress":4}']]);
const session = G.openSession(saves);
assert.equal(G.startSession(session, G.seedCode(numericSeed)), true);
assert.equal(session.state.seed, numericSeed);
assert.ok(G.decode(saves.getItem(G.storageKey)));
assert.equal(saves.getItem(G.storageKey + '.pending'), null);
assert.equal(saves.getItem('legacy-neon-save'), 'keep');
assert.equal(saves.getItem('anotherGame'), '{"progress":4}');
assert.equal(G.commit(session, 'route', { route: 'quiet' }), true);
const other = G.openSession(saves);
assert.equal(other.state.phase, 'battle');
const beforeMain = saves.getItem(G.storageKey);
assert.equal(G.commit(session, 'endTurn', {}), true);
assert.notEqual(saves.getItem(G.storageKey), beforeMain);
assert.equal(G.commit(other, 'endTurn', {}), false, 'stale page must not overwrite a changed independent save');
assert.equal(other.conflict, true);

// Replay extension/rejected enemy index specifically guards the old filter/revision bug.
const shot = route('range-check');
act(shot, 'breach', { enemy: 'e0-0' });
act(shot, 'attack', { ship: 1, enemy: 'e0-0' });
const retained = shot.battle.enemies[0];
assert.equal(retained.order, 1);
assert.equal(retained.id, 'e0-1');
assert.equal(G.validState(shot), true);
assert.equal(G.decode(G.encode(shot, 3)).state.battle.enemies[0].order, 1);
assert.match(G.reason(shot, 'attack', { ship: 2, enemy: 'e0-0' }), /(命令点已用完|无效参数)/);

// Invalid main AND a valid enemy-filtered pending transaction: select and quarantine
// actual valid data based on checksum + action replay, without trusting array count.
const invalidEnvelope = JSON.stringify({ schema: 2, revision: 9, state: Object.assign(clone(shot), { battle: Object.assign(clone(shot.battle), { enemies: [{ ...clone(shot.battle.enemies[0]), order: 0, id: 'e0-0' }] }) }), checksum: 'ec1-00000000' });
const damagedMain = '{"callerData":"must be preserved"}';
const recoveryStore = memoryStorage([[G.storageKey, damagedMain], [G.storageKey + '.pending', invalidEnvelope]]);
const recovered = G.openSession(recoveryStore);
assert.equal(recovered.state, null, 'an enemy-filtered but bad-checksum pending record is not recoverable');
assert.match(recovered.warning, /校验失败/);
assert.equal(G.startSession(recovered, 'recover-new'), true);
assert.equal(recoveryStore.getItem(G.storageKey + '.rejected'), damagedMain);
assert.equal(recoveryStore.getItem(G.storageKey + '.rejected-pending'), invalidEnvelope);
assert.equal(G.decode(recoveryStore.getItem(G.storageKey)).state.history.length, 0);

// No storage degrades to playable memory, instead of failing to start after mutation.
const noStorage = G.openSession(null);
assert.equal(G.startSession(noStorage, 'private'), true);
assert.equal(noStorage.state.phase, 'route');
assert.match(noStorage.warning, /存储不可用/);
assert.equal(G.commit(noStorage, 'route', { route: 'quiet' }), true);
assert.equal(noStorage.state.phase, 'battle');

// Write interruption recovers through a verified pending record without clearing it first.
const interruptedStore = memoryStorage();
const interrupted = G.openSession(interruptedStore);
assert.equal(G.startSession(interrupted, 'transaction'), true);
const firstRaw = interruptedStore.getItem(G.storageKey);
assert.equal(G.commit(interrupted, 'route', { route: 'rich' }), true);
assert.equal(G.decode(interruptedStore.getItem(G.storageKey)).state.phase, 'battle');
assert.equal(G.decode(interruptedStore.getItem(G.storageKey + '.backup')).state.phase, 'route');
assert.equal(interruptedStore.getItem(G.storageKey + '.pending'), null);
const pendingRaw = G.encode(G.replay(22, [{ action: 'route', data: { route: 'quiet' } }]), 5);
interruptedStore.setItem(G.storageKey + '.pending', pendingRaw);
const pendingRecovery = G.openSession(interruptedStore);
assert.equal(pendingRecovery.state.seed, 22);
assert.equal(pendingRecovery.state.phase, 'battle');
assert.equal(G.commit(pendingRecovery, 'endTurn', {}), true);
assert.equal(G.decode(interruptedStore.getItem(G.storageKey)).state.seed, 22);
assert.equal(interruptedStore.getItem(G.storageKey + '.pending'), null);
assert.notEqual(firstRaw, interruptedStore.getItem(G.storageKey));

// A failed multi-step write does not keep blindly writing after a quota error.
const throwing = memoryStorage();
const safeSession = G.openSession(throwing);
assert.equal(G.startSession(safeSession, 'quota'), true);
const before = throwing.getItem(G.storageKey);
const realSet = throwing.setItem.bind(throwing);
throwing.setItem = (key, value) => { if (key === G.storageKey + '.pending') throw new Error('quota'); realSet(key, value); };
assert.equal(G.commit(safeSession, 'route', { route: 'quiet' }), true, 'state remains playable after storage failure');
assert.equal(safeSession.storage, null);
assert.equal(throwing.getItem(G.storageKey), before, 'failed pending write leaves primary bytes untouched');
assert.equal(safeSession.state.phase, 'battle');

// Mounted interface walkthrough: interact only with currently rendered,
// enabled action buttons; also dispatch real keyboard bindings through the page.
const listeners = new Map();
const makeButton = attrs => {
  const attributes = {};
  for (const match of attrs.matchAll(/\b([\w-]+)="([^"]*)"/g)) attributes[match[1]] = match[2];
  const button = {
    disabled: /(?:^|\s)disabled(?:\s|$)/.test(attrs),
    getAttribute(name) { return attributes[name] ?? null; },
    click() { if (!button.disabled) listeners.get('host:click')?.({ target: { closest: selector => { assert.equal(selector, '[data-ec-action]'); return button; } } }); }
  };
  return button;
};
const buttons = () => [...fakeHost.innerHTML.matchAll(/<button\b([^>]*)>/g)].map(match => makeButton(match[1]));
const fakeHost = {
  innerHTML: '',
  addEventListener(name, fn) { listeners.set('host:' + name, fn); },
  removeEventListener(name) { listeners.delete('host:' + name); },
  contains() { return true; },
  querySelector(selector) {
    const key = selector.match(/^\[data-key="([1-9E])"\]$/);
    if (key) return buttons().find(button => button.getAttribute('data-key') === key[1]) || null;
    return selector.startsWith('#') ? { focus() {} } : null;
  },
  querySelectorAll() { return []; }
};
const fakeDoc = {
  getElementById(id) { return id === 'ember-convoy' ? fakeHost : null; },
  addEventListener(name, fn) { listeners.set('doc:' + name, fn); },
  removeEventListener(name) { listeners.delete('doc:' + name); }
};
const mounted = G.mount(fakeDoc, memoryStorage());
assert.match(fakeHost.innerHTML, /DETERMINISTIC EXPEDITION/);
assert.match(fakeHost.innerHTML, /type="text"/);
assert.doesNotMatch(fakeHost.innerHTML, /<script/i);
assert.equal(typeof fakeHost.emberConvoyCleanup, 'function');
const clickUI = (action, data = {}) => {
  const button = buttons().find(item => item.getAttribute('data-ec-action') === action && Object.entries(data).every(([key, value]) => item.getAttribute('data-' + key) === String(value)));
  assert.ok(button, 'rendered UI action: ' + action + ' ' + JSON.stringify(data));
  assert.equal(button.disabled, false, 'enabled UI action: ' + action + ' ' + JSON.stringify(data));
  button.click();
};
const keyUI = key => {
  let prevented = false;
  listeners.get('doc:keydown')({ key, repeat: false, target: { tagName: 'BODY' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'keyboard binding ' + key + ' must execute a rendered action');
};
const uiWin = mounted.session;
// Start, use digit-key route selection, target selectors, actions and E end-turn.
clickUI('start');
assert.equal(uiWin.state.seed, G.create('EMBER-01').seed);
assert.equal(uiWin.state.phase, 'route');
for (let leg = 0; leg < 3; leg++) {
  assert.equal(uiWin.state.phase, 'route');
  keyUI('1');
  while (uiWin.state.phase === 'battle') {
    while (uiWin.state.phase === 'battle' && uiWin.state.battle.commands > 0) {
      const state = uiWin.state, enemy = state.battle.enemies[0];
      clickUI('selectEnemy', { enemy: enemy.id });
      let ship = [0, 1, 2].find(index => state.hull[index] > 0 && !state.battle.used[index] && state.heat[index] < 4);
      if (ship === undefined) break;
      const action = ship === 0 && state.heat[0] <= 2 ? 'breach' : 'attack';
      clickUI(action, action === 'breach' ? { enemy: enemy.id } : { ship, enemy: enemy.id });
    }
    if (uiWin.state.phase === 'battle') keyUI('e');
  }
  assert.equal(uiWin.state.phase, 'salvage');
  const choice = uiWin.state.hull.some((hp, i) => hp > 0 && hp < uiWin.state.hullMax[i]) ? 'patch' : 'parts';
  clickUI('salvage', { choice });
  if (uiWin.state.scrap >= 2 && uiWin.state.weapon < 2) clickUI('upgrade', { kind: 'weapon' });
  keyUI('e');
  if (leg < 2) assert.equal(uiWin.state.phase, 'route');
}
assert.equal(uiWin.state.phase, 'extract');
clickUI('extract');
assert.equal(uiWin.state.phase, 'won');
assert.match(fakeHost.innerHTML, /EC-[0-9A-F]{8}/);
mounted.destroy();
assert.equal(listeners.has('doc:keydown'), false);
assert.equal(fakeHost.emberConvoyCleanup, undefined);

// HTML entry is independent; styles explicitly protect narrow/reduced-motion/touch use.
const page = fs.readFileSync(path.join(root, 'games/ember-convoy.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/ember-convoy.css'), 'utf8');
assert.match(page, /href="\.\.\/"/);
assert.match(page, /viewport-fit=cover/);
assert.match(page, /src="\.\.\/src\/ember-convoy\.js"/);
assert.match(page, /href="\.\.\/src\/ember-convoy\.css"/);
assert.match(page, /href="\.\.\/assets\/icons\/ember-convoy\.svg"/);
assert.match(css, /min-width:\s*320px/);
assert.match(css, /min-height:\s*48px/);
assert.match(css, /@media\s*\(max-width:\s*380px\)/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /:focus-visible/);
assert.doesNotMatch(page, /user-scalable=no/);

console.log('PASS ember convoy deterministic victories/losses, combat forecasts, stable enemy IDs, finite command economy, replay seeds, strict reachable-state saves, quarantine/recovery, stale-tab guard, storage failure, safe render and responsive entry.');
