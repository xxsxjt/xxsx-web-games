/* Ember Convoy: one deterministic ruleset for the page, saves and headless tests.
 * This game never opens the shared profile or any other game's storage key. */
(function (root) {
  'use strict';

  var KEY = 'xxsxEmberConvoyV1';
  var ROUND_LIMIT = 12;
  var PHASES = ['route', 'battle', 'salvage', 'upgrade', 'extract', 'won', 'lost'];
  var SHIP_NAMES = ['前锋', '护卫', '工程'];
  var SHIP_ROLES = ['破阵舰', '护盾舰', '维修舰'];
  var ENEMY_TYPES = {
    cutter: { name: '掠袭艇', hp: 7, armor: 0, damage: 2, intent: 'shot' },
    frigate: { name: '哨戒舰', hp: 8, armor: 1, damage: 2, intent: 'shot' },
    jammer: { name: '噪潮舰', hp: 6, armor: 0, damage: 1, intent: 'jam' },
    crown: { name: '王冠级', hp: 15, armor: 1, damage: 3, intent: 'cannon' }
  };
  var ENCOUNTERS = [
    { quiet: ['cutter', 'cutter'], rich: ['frigate', 'cutter', 'jammer'] },
    { quiet: ['jammer', 'frigate'], rich: ['jammer', 'frigate', 'frigate'] },
    { quiet: ['crown', 'cutter'], rich: ['crown', 'frigate', 'jammer'] }
  ];
  var STATE_FIELDS = 'version seed phase leg route hull hullMax shield heat scrap weapon plating upgradeUsed battle reason history log';

  function integer(value, low, high) { return Number.isInteger(value) && value >= low && value <= high; }
  function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
  function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function fields(value, names) {
    if (!object(value)) return false;
    var expected = names ? names.split(' ').filter(Boolean) : [];
    return Object.keys(value).length === expected.length && expected.every(function (key) { return own(value, key); });
  }
  function triplet(value, check) { return Array.isArray(value) && value.length === 3 && value.every(check); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function hash(text) {
    var value = 2166136261;
    for (var i = 0; i < text.length; i += 1) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
  function seedValue(seed) {
    if (integer(seed, 0, 4294967295)) return seed;
    var text = typeof seed === 'string' ? seed.trim().slice(0, 48) : '';
    if (!text) text = 'EMBER-01';
    if (/^EC-[0-9a-f]{8}$/i.test(text)) return parseInt(text.slice(3), 16) >>> 0;
    if (/^0x[0-9a-f]{1,8}$/i.test(text)) return parseInt(text.slice(2), 16) >>> 0;
    return parseInt(hash(text), 16) >>> 0;
  }
  function seedCode(seed) { return 'EC-' + seed.toString(16).toUpperCase().padStart(8, '0'); }
  function event(state, message) { state.log.unshift(message); state.log.length = Math.min(14, state.log.length); }
  function living(state, ship) { return integer(ship, 0, 2) && state.hull[ship] > 0; }
  function enemySpec(leg, route, order) {
    var type = ENCOUNTERS[leg][route][order], spec = ENEMY_TYPES[type];
    return { type: type, hp: spec.hp + (route === 'rich' && leg === 2 && type === 'crown' ? 3 : 0), armor: spec.armor };
  }
  function intentFor(enemy, round) {
    var spec = ENEMY_TYPES[enemy.type];
    return { intent: spec.intent, damage: spec.damage + (enemy.type === 'crown' && round % 2 === 0 ? 2 : 0) };
  }
  function create(seed) {
    return {
      version: 1, seed: seedValue(seed), phase: 'route', leg: 0, route: null,
      hull: [10, 10, 10], hullMax: [10, 10, 10], shield: [2, 2, 2], heat: [0, 0, 0],
      scrap: 2, weapon: 0, plating: 0, upgradeUsed: false, battle: null, reason: '', history: [],
      log: ['航团已集结。先读敌群情报，再选择第一段航路。']
    };
  }
  function targetFor(state, enemy) {
    var alive = [0, 1, 2].filter(function (ship) { return living(state, ship); });
    var code = enemy.order * 17 + state.leg * 31 + state.battle.round * 13;
    return alive[(state.seed + code) % alive.length];
  }
  function setIntents(state) {
    state.battle.enemies.forEach(function (enemy) {
      var intent = intentFor(enemy, state.battle.round);
      enemy.target = targetFor(state, enemy); enemy.intent = intent.intent; enemy.damage = intent.damage;
    });
  }
  function validHistoryItem(item) {
    if (!fields(item, 'action data') || typeof item.action !== 'string' || !object(item.data)) return false;
    var data = item.data;
    switch (item.action) {
      case 'route': return fields(data, 'route') && (data.route === 'quiet' || data.route === 'rich');
      case 'attack': return fields(data, 'ship enemy') && integer(data.ship, 0, 2) && /^e[0-2]-[0-2]$/.test(data.enemy);
      case 'breach': return fields(data, 'enemy') && typeof data.enemy === 'string' && /^e[0-2]-[0-2]$/.test(data.enemy);
      case 'screen': case 'repair': return fields(data, 'target') && integer(data.target, 0, 2);
      case 'cool': return fields(data, 'ship') && integer(data.ship, 0, 2);
      case 'salvage': return fields(data, 'choice') && (data.choice === 'patch' || data.choice === 'parts');
      case 'upgrade': return fields(data, 'kind') && (data.kind === 'weapon' || data.kind === 'plating');
      case 'vent': case 'endTurn': case 'continue': case 'extract': return fields(data, '');
      default: return false;
    }
  }
  function validState(s) {
    if (!fields(s, STATE_FIELDS) || s.version !== 1 || !integer(s.seed, 0, 4294967295) || PHASES.indexOf(s.phase) < 0 || !integer(s.leg, 0, 2)) return false;
    if (s.route !== null && s.route !== 'quiet' && s.route !== 'rich') return false;
    if (!integer(s.scrap, 0, 30) || !integer(s.weapon, 0, 2) || !integer(s.plating, 0, 2) || typeof s.upgradeUsed !== 'boolean') return false;
    if (!triplet(s.hullMax, function (hp) { return hp === 10 + s.plating; }) || !triplet(s.hull, function (hp, i) { return integer(hp, 0, s.hullMax[i]); })) return false;
    if (!triplet(s.shield, function (value, i) { return integer(value, 0, 6) && (s.hull[i] > 0 || value === 0); }) || !triplet(s.heat, function (value, i) { return integer(value, 0, 4) && (s.hull[i] > 0 || value === 0); })) return false;
    if (!Array.isArray(s.log) || s.log.length < 1 || s.log.length > 14 || s.log.some(function (line) { return typeof line !== 'string' || line.length > 220; })) return false;
    if (!Array.isArray(s.history) || s.history.length > 160 || !s.history.every(validHistoryItem)) return false;
    var alive = s.hull.some(function (hp) { return hp > 0; });
    if (s.phase === 'lost') {
      if (!['destroyed', 'blockade'].includes(s.reason) || (s.reason === 'destroyed' && alive) || (s.reason === 'blockade' && !alive)) return false;
    } else if (!alive || s.reason !== (s.phase === 'won' ? 'evacuated' : '')) return false;
    if (s.phase === 'battle') {
      var b = s.battle;
      if (s.route === null || !fields(b, 'round commands used cover enemies') || !integer(b.round, 1, ROUND_LIMIT) || !integer(b.commands, 0, 2)) return false;
      if (!triplet(b.used, function (value) { return typeof value === 'boolean'; }) || b.used.filter(Boolean).length !== 2 - b.commands || !triplet(b.cover, function (value, i) { return typeof value === 'boolean' && (!value || living(s, i)); })) return false;
      if (!Array.isArray(b.enemies) || b.enemies.length < 1 || b.enemies.length > ENCOUNTERS[s.leg][s.route].length) return false;
      var previous = -1;
      for (var i = 0; i < b.enemies.length; i += 1) {
        var enemy = b.enemies[i];
        if (!fields(enemy, 'id order type hp maxHp armor target intent damage') || !integer(enemy.order, 0, ENCOUNTERS[s.leg][s.route].length - 1) || enemy.order <= previous) return false;
        previous = enemy.order;
        var spec = enemySpec(s.leg, s.route, enemy.order);
        if (enemy.id !== 'e' + s.leg + '-' + enemy.order || enemy.type !== spec.type || enemy.maxHp !== spec.hp || enemy.armor !== spec.armor || !integer(enemy.hp, 1, spec.hp) || !living(s, enemy.target)) return false;
        var intent = intentFor(enemy, b.round);
        if (enemy.target !== targetFor(s, enemy) || enemy.intent !== intent.intent || enemy.damage !== intent.damage) return false;
      }
    } else if (s.battle !== null) return false;
    if (s.phase === 'route' && s.route !== null) return false;
    if (s.phase !== 'route' && s.route === null) return false;
    if ((s.phase === 'extract' || s.phase === 'won') && s.leg !== 2) return false;
    return true;
  }
  function damageFor(state, ship, enemy, breach) {
    return Math.max(1, breach ? 5 + state.weapon - Math.max(0, enemy.armor - 1) : [4, 2, 2][ship] + state.weapon - enemy.armor - (state.heat[ship] >= 3 ? 1 : 0));
  }
  function findEnemy(state, id) { return state.battle && state.battle.enemies.find(function (enemy) { return enemy.id === id; }); }
  function orderReason(state, ship, hot) {
    if (!living(state, ship)) return '该舰已失联，不能行动';
    if (state.battle.used[ship]) return '该舰本回合已行动';
    if (!state.battle.commands) return '本回合命令点已用完';
    if (hot && state.heat[ship] >= 4) return '热量已满，请散热或结束回合';
    return '';
  }
  function reason(state, action, data) {
    data = data || {};
    if (!validState(state)) return '状态校验失败';
    if (!validHistoryItem({ action: action, data: data })) return '未知指令或无效参数';
    if (state.history.length >= 160) return '指令记录已达上限';
    if (action === 'route') return state.phase === 'route' ? '' : '当前不是航路选择阶段';
    if (['attack', 'breach', 'screen', 'repair', 'vent', 'cool', 'endTurn'].includes(action)) {
      if (state.phase !== 'battle') return '当前不在战斗中';
      if (action === 'endTurn') return ''; // Passing is always legal, including at two commands / full heat.
      var ship = action === 'breach' ? 0 : action === 'screen' ? 1 : action === 'repair' || action === 'vent' ? 2 : data.ship;
      var blocked = orderReason(state, ship, !['cool', 'vent'].includes(action));
      if (blocked) return blocked;
      if (action === 'attack' || action === 'breach') {
        if (!findEnemy(state, data.enemy)) return '请标记一艘存活敌舰';
        if (action === 'breach' && state.heat[0] > 2) return '破甲需要热量不超过 2';
      }
      if (action === 'screen' || action === 'repair') {
        if (!living(state, data.target)) return '不能支援已失联的舰船';
        if (action === 'screen' && state.shield[data.target] === 6 && state.battle.cover[data.target]) return '该舰屏障已满';
        if (action === 'repair') {
          if (state.scrap < 1) return '抢修需要 1 废料';
          if (state.hull[data.target] === state.hullMax[data.target] && state.heat[data.target] === 0) return '船体完好且无积热，无需消耗维修物资';
        }
      }
      if (action === 'cool' && state.heat[ship] === 0) return '该舰没有积热';
      if (action === 'vent' && !state.heat.some(function (heat) { return heat > 0; })) return '全舰没有积热';
      return '';
    }
    if (action === 'salvage') return state.phase === 'salvage' ? '' : '当前没有可打捞残骸';
    if (action === 'upgrade') {
      if (state.phase !== 'upgrade') return '当前不在改装阶段';
      if (state.upgradeUsed) return '本次停靠已安装一项改装';
      if (state.scrap < 2) return '改装需要 2 废料';
      return state[data.kind] >= 2 ? '该改装已达最高等级' : '';
    }
    if (action === 'continue') return state.phase === 'upgrade' ? '' : '当前不在改装阶段';
    if (action === 'extract') return state.phase === 'extract' ? '' : '需清空三段航路后才能撤离';
    return '未知指令';
  }
  function takeOrder(state, ship) { state.battle.commands -= 1; state.battle.used[ship] = true; }
  function beginBattle(state, route) {
    state.route = route; state.phase = 'battle'; state.upgradeUsed = false;
    state.battle = {
      round: 1, commands: 2, used: [false, false, false], cover: [false, false, false],
      enemies: ENCOUNTERS[state.leg][route].map(function (_, order) {
        var spec = enemySpec(state.leg, route, order), intent = intentFor(spec, 1);
        return { id: 'e' + state.leg + '-' + order, order: order, type: spec.type, hp: spec.hp, maxHp: spec.hp, armor: spec.armor, target: 0, intent: intent.intent, damage: intent.damage };
      })
    };
    setIntents(state);
    event(state, '第 ' + (state.leg + 1) + ' 段 · ' + (route === 'quiet' ? '灰烬航道 / 低威胁' : '残骸带 / 高威胁，胜后额外 +1 废料') + '。');
  }
  function finishBattle(state) {
    state.battle = null; state.phase = 'salvage';
    if (state.route === 'rich') state.scrap = Math.min(30, state.scrap + 1);
    event(state, '敌群已清除，停止敌方反击。打捞只能在维修包与零件箱之间选一个。');
  }
  function lose(state, why) {
    state.phase = 'lost'; state.reason = why; state.battle = null;
    event(state, why === 'destroyed' ? '三舰失去航行能力。未撤离，远征失败。' : '第 12 回合结算后仍有敌舰，封锁合围。未撤离，远征失败。');
  }
  // The forecast and the real enemy phase call this exact resolver, in stable ID order.
  function volley(state) {
    var impacts = [];
    state.battle.enemies.forEach(function (enemy) {
      var target = enemy.target;
      if (!state.hull.some(function (hp) { return hp > 0; })) return;
      if (!living(state, target)) {
        for (var hop = 1; hop <= 3; hop += 1) if (living(state, (enemy.target + hop) % 3)) { target = (enemy.target + hop) % 3; break; }
      }
      var reduced = state.battle.cover[target] ? Math.min(2, enemy.damage) : 0;
      var damage = enemy.damage - reduced, absorbed = Math.min(state.shield[target], damage);
      var before = state.hull[target];
      state.battle.cover[target] = false; state.shield[target] -= absorbed;
      state.hull[target] = Math.max(0, before - (damage - absorbed));
      if (enemy.intent === 'jam') state.heat[target] = Math.min(4, state.heat[target] + 1);
      if (state.hull[target] === 0) { state.shield[target] = 0; state.heat[target] = 0; }
      impacts.push({ id: enemy.id, target: target, planned: enemy.target, damage: damage, reduced: reduced, absorbed: absorbed, hull: before - state.hull[target], jam: enemy.intent === 'jam' });
    });
    return impacts;
  }
  function finishRound(state) {
    if (!state.hull.some(function (hp) { return hp > 0; })) { lose(state, 'destroyed'); return; }
    if (state.battle.round === ROUND_LIMIT) { lose(state, 'blockade'); return; }
    state.heat = state.heat.map(function (heat, i) { return living(state, i) ? Math.max(0, heat - 1) : 0; });
    state.shield = state.shield.map(function (shield, i) { return living(state, i) ? (shield > 2 ? shield - 1 : Math.min(2, shield + 1)) : 0; });
    state.battle.round += 1; state.battle.commands = 2;
    state.battle.used = [false, false, false]; state.battle.cover = [false, false, false]; setIntents(state);
  }
  function forecast(state) {
    if (!validState(state) || state.phase !== 'battle') return null;
    var next = copy(state), impacts = volley(next);
    finishRound(next);
    return { impacts: impacts, hull: next.hull, shield: next.shield, heat: next.heat, phase: next.phase, reason: next.reason };
  }
  function patchTarget(state) {
    var target = -1;
    for (var i = 0; i < 3; i += 1) if (living(state, i) && (target < 0 || state.hullMax[i] - state.hull[i] > state.hullMax[target] - state.hull[target])) target = i;
    return target;
  }
  function act(state, action, data) {
    data = data || {};
    if (reason(state, action, data)) return false;
    var ship, enemy, healed;
    if (action === 'route') beginBattle(state, data.route);
    else if (action === 'attack' || action === 'breach') {
      ship = action === 'breach' ? 0 : data.ship; enemy = findEnemy(state, data.enemy);
      takeOrder(state, ship);
      var damage = damageFor(state, ship, enemy, action === 'breach');
      enemy.hp = Math.max(0, enemy.hp - damage); state.heat[ship] = Math.min(4, state.heat[ship] + (action === 'breach' ? 2 : 1));
      event(state, SHIP_NAMES[ship] + (action === 'breach' ? '破甲' : '开火') + ' → ' + enemy.id.toUpperCase() + '：' + damage + ' 伤害' + (enemy.hp === 0 ? '，敌舰击毁，取消其预告。' : '。'));
      state.battle.enemies = state.battle.enemies.filter(function (item) { return item.hp > 0; });
      if (!state.battle.enemies.length) finishBattle(state);
    } else if (action === 'screen') {
      takeOrder(state, 1); state.shield[data.target] = Math.min(6, state.shield[data.target] + 4); state.battle.cover[data.target] = true; state.heat[1] = Math.min(4, state.heat[1] + 1);
      event(state, '护卫屏障 → ' + SHIP_NAMES[data.target] + '：护盾 +4（上限 6），首发伤害 -2；护卫 +1 热。');
    } else if (action === 'repair') {
      takeOrder(state, 2); state.scrap -= 1; healed = Math.min(3, state.hullMax[data.target] - state.hull[data.target]);
      state.hull[data.target] += healed; state.heat[data.target] = Math.max(0, state.heat[data.target] - 1); state.heat[2] = Math.min(4, state.heat[2] + 1);
      event(state, '工程抢修 → ' + SHIP_NAMES[data.target] + '：恢复 ' + healed + ' 船体，目标 -1 热；消耗 1 废料，工程 +1 热。');
    } else if (action === 'vent') {
      takeOrder(state, 2); state.heat = state.heat.map(function (heat) { return Math.max(0, heat - 2); });
      event(state, '工程舰打开全舰散热阀：存活舰船降低 2 热；本回合不能再抢修。');
    } else if (action === 'cool') {
      takeOrder(state, data.ship); state.heat[data.ship] = Math.max(0, state.heat[data.ship] - 3);
      event(state, SHIP_NAMES[data.ship] + '停止射击，自行散热 3。');
    } else if (action === 'endTurn') {
      var round = state.battle.round, passed = state.battle.commands;
      event(state, '结算第 ' + round + ' 回合' + (passed ? '，放弃 ' + passed + ' 点剩余命令' : '') + '。');
      volley(state).forEach(function (impact) { event(state, impact.id.toUpperCase() + ' → ' + SHIP_NAMES[impact.target] + (impact.target !== impact.planned ? '（前目标失联，顺延）' : '') + '：损失 ' + impact.hull + ' 船体 / ' + impact.absorbed + ' 护盾' + (impact.jam ? '，穿盾 +1 热' : '') + '。'); });
      finishRound(state);
      if (state.phase === 'battle') event(state, '第 ' + state.battle.round + ' 回合预告公开：2 命令，活舰 -1 热；护盾向基准 2 回充 / 衰减 1。');
    } else if (action === 'salvage') {
      if (data.choice === 'patch') {
        ship = patchTarget(state); healed = Math.min(4, state.hullMax[ship] - state.hull[ship]); state.hull[ship] += healed;
        state.heat = state.heat.map(function (heat) { return Math.max(0, heat - 2); });
        event(state, '打捞维修包：' + SHIP_NAMES[ship] + '恢复 ' + healed + ' 船体，全舰 -2 热；失联舰不复活。');
      } else { state.scrap = Math.min(30, state.scrap + 2); event(state, '打捞零件箱：废料 +2。'); }
      state.phase = 'upgrade';
    } else if (action === 'upgrade') {
      state.scrap -= 2; state[data.kind] += 1; state.upgradeUsed = true;
      if (data.kind === 'weapon') event(state, '武器校准器安装完成：全舰基础伤害 +1。');
      else {
        state.hullMax = state.hullMax.map(function (max) { return max + 1; });
        state.hull = state.hull.map(function (hp) { return hp > 0 ? hp + 1 : 0; });
        event(state, '隔舱衬板安装完成：全舰最大船体 +1，存活舰修复 1；不能复活失联舰。');
      }
    } else if (action === 'continue') {
      if (state.leg < 2) { state.leg += 1; state.phase = 'route'; state.route = null; event(state, '进入下一段航路。船体、护盾、积热与剩余废料继续携带。'); }
      else { state.phase = 'extract'; event(state, '王冠级已击破。抵达撤离窗口，需亲自确认撤离才能完成远征。'); }
    } else if (action === 'extract') { state.phase = 'won'; state.reason = 'evacuated'; event(state, '撤离完成。三段航路的存活舰船与剩余物资已封存到本局战报。'); }
    state.history.push({ action: action, data: copy(data) });
    return true;
  }
  function replay(seed, history) {
    if (!Array.isArray(history) || history.length > 160) return null;
    var state = create(seed);
    for (var i = 0; i < history.length; i += 1) if (!validHistoryItem(history[i]) || !act(state, history[i].action, history[i].data)) return null;
    return state;
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (object(value)) return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function reachable(state) {
    if (!validState(state)) return false;
    var rebuilt = replay(state.seed, state.history);
    return !!rebuilt && canonical(rebuilt) === canonical(state);
  }
  function encode(state, revision) {
    if (!integer(revision, 0, 1000000) || !reachable(state)) return null;
    var payload = { schema: 2, revision: revision, state: state };
    return JSON.stringify({ schema: 2, revision: revision, state: state, checksum: 'ec1-' + hash(canonical(payload)) });
  }
  function decode(raw) {
    if (typeof raw !== 'string' || raw.length > 96000) return null;
    try {
      var value = JSON.parse(raw);
      if (!fields(value, 'schema revision state checksum') || value.schema !== 2 || !integer(value.revision, 0, 1000000) || typeof value.checksum !== 'string') return null;
      if (value.checksum !== 'ec1-' + hash(canonical({ schema: 2, revision: value.revision, state: value.state })) || !reachable(value.state)) return null;
      return value;
    } catch (error) { return null; }
  }

  function openSession(storage) {
    var session = { state: null, warning: '', revision: 0, conflict: false, storage: storage || null, expected: { main: null, pending: null, backup: null }, lastGoodRaw: null, rejected: [] };
    if (!storage) { session.warning = '本地存储不可用；仍可完整游玩，但刷新会丢失当前进度。'; return session; }
    try {
      var sources = ['main', 'pending', 'backup'].map(function (name, priority) {
        var raw = storage.getItem(name === 'main' ? KEY : KEY + '.' + name);
        session.expected[name] = raw;
        var decoded = decode(raw);
        if (raw !== null && !decoded) session.rejected.push({ key: KEY + (name === 'main' ? '.rejected' : '.rejected-' + name), raw: raw });
        return { name: name, priority: priority, raw: raw, decoded: decoded };
      });
      var good = sources.filter(function (source) { return source.decoded; }).sort(function (a, b) { return b.decoded.revision - a.decoded.revision || a.priority - b.priority; });
      if (good.length) {
        session.state = good[0].decoded.state; session.revision = good[0].decoded.revision; session.lastGoodRaw = good[0].raw;
        if (good[0].name !== 'main') session.warning = '已从有效' + (good[0].name === 'pending' ? '待完成事务' : '备份') + '恢复进度；原损坏内容会先隔离再保存。';
        good.slice(1).forEach(function (source) {
          if (source.name === 'pending' && source.decoded.revision === good[0].decoded.revision && source.raw !== good[0].raw) {
            session.rejected.push({ key: KEY + '.rejected-pending', raw: source.raw }); session.warning = '存在同修订号的另一份事务；以主档为准，保存前保留事务副本。';
          }
        });
      } else if (session.rejected.length) session.warning = '独立存档校验失败；不会清空原内容。开始新局前会尝试保留隔离副本。';
      if (session.rejected.length && !session.warning) session.warning = '进度已恢复；发现的损坏副档会在下次保存前隔离。';
    } catch (error) { session.storage = null; session.warning = '本地存储读取失败；仍可游玩，当前进度仅保留在本页。'; }
    return session;
  }
  function preflight(session) {
    if (session.conflict) return false;
    if (!session.storage) return true;
    try {
      var unchanged = ['main', 'pending', 'backup'].every(function (name) { return session.storage.getItem(name === 'main' ? KEY : KEY + '.' + name) === session.expected[name]; });
      if (!unchanged) { session.conflict = true; session.warning = '另一页面已更新这份独立档案。本页已停止操作且未覆盖新进度，请重新载入。'; }
      return unchanged;
    } catch (error) { session.storage = null; session.warning = '存储读取失败；继续游玩，但后续进度只保留在本页。'; return true; }
  }
  function persist(session) {
    if (!session.storage || !preflight(session) || !session.storage) return false;
    var next = encode(session.state, session.revision + 1);
    if (!next) { session.warning = '本次进度未通过完整复盘校验；旧档案未被覆盖。'; return false; }
    function write(name, value) {
      var key = name === 'main' ? KEY : KEY + '.' + name;
      session.storage.setItem(key, value);
      if (session.storage.getItem(key) !== value) throw new Error('write verify');
      session.expected[name] = value;
    }
    try {
      session.rejected.forEach(function (source) {
        var existing = session.storage.getItem(source.key);
        if (existing !== source.raw) {
          if (existing !== null) throw new Error('quarantine occupied');
          session.storage.setItem(source.key, source.raw);
          if (session.storage.getItem(source.key) !== source.raw) throw new Error('quarantine verify');
        }
      });
      if (!preflight(session) || !session.storage) return false;
      write('pending', next);
      if (!preflight(session) || !session.storage) return false;
      if (session.lastGoodRaw !== null) write('backup', session.lastGoodRaw);
      if (!preflight(session) || !session.storage) return false;
      write('main', next); session.lastGoodRaw = next; session.revision += 1; session.rejected = [];
      try {
        if (session.storage.getItem(KEY + '.pending') !== next) { session.conflict = true; session.warning = '主档已保存，但另一页面写入了新事务；本页停止操作，请重新载入。'; return false; }
        session.storage.removeItem(KEY + '.pending');
        if (session.storage.getItem(KEY + '.pending') !== null) throw new Error('remove verify');
        session.expected.pending = null; session.warning = '';
      } catch (cleanupError) { session.storage = null; session.warning = '主档已保存，但事务清理失败；为避免误覆盖，本页后续进度只保留在内存。'; }
      return true;
    } catch (error) { session.storage = null; session.warning = '本次保存未完成，已停止后续写入；旧档 / 待完成事务可供下次恢复，本页仍可继续游玩。'; return false; }
  }
  function startSession(session, seed) {
    if (session.state && !['won', 'lost'].includes(session.state.phase)) return false;
    if (!preflight(session)) return false;
    session.state = create(seed); persist(session); return true;
  }
  function commit(session, action, data) {
    if (!session.state || !preflight(session) || !act(session.state, action, data)) return false;
    persist(session); return true;
  }

  function escapeText(value) { return String(value).replace(/[&<>"']/g, function (character) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]; }); }
  function routeInfo(state, route) {
    return ENCOUNTERS[state.leg][route].map(function (_, order) {
      var spec = enemySpec(state.leg, route, order);
      return ENEMY_TYPES[spec.type].name + ' ' + spec.hp + '船体 / ' + spec.armor + '甲';
    }).join(' · ');
  }
  function mount(doc, storage) {
    var host = doc.getElementById('ember-convoy');
    if (!host) return null;
    if (host.emberConvoyCleanup) host.emberConvoyCleanup();
    var session = openSession(storage), selectedEnemy = '', selectedShip = 0, disposed = false;
    function actionButton(action, data, label, detail, key, blocked, focus) {
      var attrs = ' type="button" class="ec-action' + (['endTurn', 'continue', 'extract', 'start', 'restart'].includes(action) ? ' ec-action--primary' : '') + '" data-ec-action="' + action + '" data-focus="' + escapeText(focus || action) + '"';
      Object.keys(data || {}).forEach(function (name) { attrs += ' data-' + name + '="' + escapeText(data[name]) + '"'; });
      if (key) attrs += ' data-key="' + key + '"';
      if (blocked || session.conflict) attrs += ' disabled aria-disabled="true"';
      return '<button' + attrs + '><span><b>' + escapeText(label) + '</b><small>' + escapeText(blocked || detail) + '</small></span>' + (key ? '<kbd>' + key + '</kbd>' : '<span aria-hidden="true">›</span>') + '</button>';
    }
    function gameButton(state, action, data, label, detail, key, focus) { return actionButton(action, data, label, detail, key, reason(state, action, data), focus); }
    function fleet(state, selectable) {
      return '<div class="ec-ships">' + state.hull.map(function (hp, ship) {
        var dead = hp === 0, focused = selectable && ship === selectedShip;
        var title = '<span class="ec-ship-code">0' + (ship + 1) + ' / ' + SHIP_NAMES[ship] + '</span><strong>' + SHIP_ROLES[ship] + '</strong><span class="ec-meter-label">船体 <b>' + hp + ' / ' + state.hullMax[ship] + '</b></span><span class="ec-meter"><i style="width:' + Math.round(hp / state.hullMax[ship] * 100) + '%"></i></span><span class="ec-ship-stats">盾 <b>' + state.shield[ship] + '</b> · 热 <b class="' + (state.heat[ship] >= 3 ? 'is-hot' : '') + '">' + state.heat[ship] + '/4</b></span><span class="ec-state">' + (dead ? '失联 / 无法行动' : focused ? '支援目标 ✓' : selectable ? '标记为支援目标' : '在线') + '</span>';
        if (selectable) return '<button type="button" class="ec-ship ec-ship--' + ship + (dead ? ' is-disabled' : '') + '" data-ec-action="selectShip" data-target="' + ship + '" data-focus="ship-' + ship + '" aria-pressed="' + focused + '"' + (dead || session.conflict ? ' disabled' : '') + '>' + title + '</button>';
        return '<article class="ec-ship ec-ship--' + ship + (dead ? ' is-disabled' : '') + '">' + title + '</article>';
      }).join('') + '</div>';
    }
    function routeView(state) {
      return '<section class="ec-stage" aria-labelledby="phase-title"><p class="ec-eyebrow">ROUTE ' + (state.leg + 1) + ' / 3 · 航路选择</p><h2 id="phase-title" tabindex="-1">押安全，还是押回收？</h2><p class="ec-lede">两条路都会推进同一航段。敌群完全公开；第三段必遇精英王冠级。</p><div class="ec-choices">' + ['quiet', 'rich'].map(function (route, i) {
        return '<article class="ec-choice"><p class="ec-eyebrow">' + (route === 'quiet' ? 'LOW THREAT / 02 CONTACTS' : 'HIGH THREAT / 03 CONTACTS') + '</p><h3>' + (route === 'quiet' ? '灰烬航道' : '残骸带') + '</h3><p>' + escapeText(routeInfo(state, route)) + '</p>' + gameButton(state, 'route', { route: route }, route === 'quiet' ? '选择低威胁航路' : '选择高威胁航路', route === 'quiet' ? '标准打捞，保存船体与维修物资' : '敌舰更多；胜后额外 +1 废料', String(i + 1)) + '</article>';
      }).join('') + '</div><p class="ec-key-hint">数字 1 / 2 选择。航段间不自动修复，也不会复活失联舰。</p></section>';
    }
    function enemyCard(enemy, preview) {
      var impact = preview.impacts.find(function (item) { return item.id === enemy.id; });
      var note = enemy.intent === 'jam' ? '干扰脉冲 · ' + enemy.damage + '伤 / 穿盾+1热' : enemy.type === 'crown' ? (enemy.damage === 5 ? '精英蓄能重炮 · 5伤' : '精英试射 · 3伤（偶数轮5伤）') : '齐射 · ' + enemy.damage + '伤';
      var actual = impact ? '若现在结算 → ' + SHIP_NAMES[impact.target] + '：损失 ' + impact.hull + '船体 / ' + impact.absorbed + '盾' + (impact.reduced ? ' · 屏障减伤 ' + impact.reduced : '') : '若现在结算：舰队已在此前攻击中失联';
      return '<button type="button" class="ec-enemy" data-ec-action="selectEnemy" data-enemy="' + enemy.id + '" data-focus="enemy-' + enemy.id + '" aria-pressed="' + (selectedEnemy === enemy.id) + '"' + (session.conflict ? ' disabled' : '') + '><span class="ec-enemy-top"><span>' + enemy.id.toUpperCase() + ' · 装甲 ' + enemy.armor + '</span><span>' + (selectedEnemy === enemy.id ? '火力目标 ✓' : '标记目标') + '</span></span><strong>' + ENEMY_TYPES[enemy.type].name + ' <small>' + enemy.hp + ' / ' + enemy.maxHp + '</small></strong><span class="ec-meter ec-meter--enemy"><i style="width:' + Math.round(enemy.hp / enemy.maxHp * 100) + '%"></i></span><span class="ec-intent">预告 → ' + SHIP_NAMES[enemy.target] + ' · ' + note + '</span><span class="ec-projection">' + actual + '</span></button>';
    }
    function commandView(state) {
      var enemy = findEnemy(state, selectedEnemy), enemyName = enemy.id.toUpperCase() + ' ' + ENEMY_TYPES[enemy.type].name;
      var groups = [];
      for (var ship = 0; ship < 3; ship += 1) {
        var attack = gameButton(state, 'attack', { ship: ship, enemy: enemy.id }, '开火 → ' + enemy.id.toUpperCase(), '预计 ' + damageFor(state, ship, enemy, false) + ' 伤 · +1 热', String([1, 4, 7][ship]), 'attack-' + ship);
        if (ship === 0) attack += gameButton(state, 'breach', { enemy: enemy.id }, '破甲 → ' + enemy.id.toUpperCase(), '预计 ' + damageFor(state, 0, enemy, true) + ' 伤 · 忽略1甲 · +2 热', '2', 'breach');
        if (ship === 1) attack += gameButton(state, 'screen', { target: selectedShip }, '屏障 → ' + SHIP_NAMES[selectedShip], '+4 护盾 / 首发 -2伤；护卫 +1 热', '5', 'screen');
        if (ship === 2) {
          attack += gameButton(state, 'repair', { target: selectedShip }, '抢修 → ' + SHIP_NAMES[selectedShip], '最多+3船体 / 目标-1热；1废料，工程+1热', '8', 'repair');
          attack += gameButton(state, 'vent', {}, '全舰散热', '全舰 -2 热；工程满热时也可用', '9', 'vent');
        }
        attack += gameButton(state, 'cool', { ship: ship }, '本舰散热', '降低本舰 3 热；放弃本轮射击', ship === 0 ? '3' : ship === 1 ? '6' : '', 'cool-' + ship);
        groups.push('<section class="ec-command-group" aria-label="' + SHIP_NAMES[ship] + '舰指令"><h4><span>0' + (ship + 1) + ' ' + SHIP_NAMES[ship] + '</span><small>' + (state.hull[ship] === 0 ? '失联' : state.battle.used[ship] ? '本轮已行动' : '可行动一次') + '</small></h4>' + attack + '</section>');
      }
      return '<div class="ec-order-head"><div><p class="ec-eyebrow">COMMAND DECK · 两点命令</p><h3>火力：' + escapeText(enemyName) + '</h3></div><p>支援：' + SHIP_NAMES[selectedShip] + ' · 点舰船切换</p></div><div class="ec-commands">' + groups.join('') + '</div>';
    }
    function battleView(state) {
      var preview = forecast(state), b = state.battle;
      return '<section class="ec-stage" aria-labelledby="phase-title"><div class="ec-stage-head"><div><p class="ec-eyebrow">LEG ' + (state.leg + 1) + ' / ROUND ' + b.round + ' OF 12</p><h2 id="phase-title" tabindex="-1">先读预告，再下命令。</h2></div><span class="ec-round">命令 ' + b.commands + ' / 2</span></div><p class="ec-lede">先标记敌舰与支援对象，再执行指令。每艘活舰每轮只行动一次；击毁敌舰立即取消它的预告。</p><div class="ec-tactical-grid"><div><div class="ec-section-line"><span>敌方预告 / 按编号依次结算</span><small>' + b.enemies.length + ' CONTACTS</small></div><div class="ec-enemies">' + b.enemies.map(function (enemy) { return enemyCard(enemy, preview); }).join('') + '</div></div><div><div class="ec-section-line"><span>本舰队 / 点选支援目标</span><small>3 HULLS</small></div>' + fleet(state, true) + '<p class="ec-caption">满热不能开火、开屏障或抢修；自行 / 全舰散热不受满热限制。失联舰不能行动、受援或复活。</p></div></div>' + commandView(state) + '<div class="ec-end-deck"><p class="' + (preview.phase === 'lost' ? 'ec-danger' : '') + '">' + (preview.phase === 'lost' ? '现在结算将失败：' + (preview.reason === 'blockade' ? '12轮封锁合围。' : '三舰均失联。') : '现在结算后船体：前锋 ' + preview.hull[0] + ' / 护卫 ' + preview.hull[1] + ' / 工程 ' + preview.hull[2] + '。') + '</p>' + gameButton(state, 'endTurn', {}, b.commands ? '结束回合 · 放弃余下 ' + b.commands + ' 命令' : '结束回合', '按上方实际预估结算；活舰-1热，护盾向2变化1', 'E', 'endTurn') + '</div><p class="ec-key-hint">1–9 下令，E 结算；Tab / Enter 操作所有按钮。第12轮结算仍有敌舰则封锁失败。敌方目标若在同一轮先失联，后续攻击按前锋→护卫→工程循环转向，以上预估已计入。</p></section>';
    }
    function salvageView(state) {
      var target = patchTarget(state), healed = Math.min(4, state.hullMax[target] - state.hull[target]);
      return '<section class="ec-stage" aria-labelledby="phase-title"><p class="ec-eyebrow">RECOVERY ' + (state.leg + 1) + ' / 3</p><h2 id="phase-title" tabindex="-1">只能带走一箱。</h2><p class="ec-lede">船体与废料都能帮你走得更远。维修包不能复活失联舰；同损伤时优先前锋，再护卫，再工程。</p><div class="ec-choices">' + gameButton(state, 'salvage', { choice: 'patch' }, '维修包', SHIP_NAMES[target] + '修复 ' + healed + ' 船体，全舰 -2 热；不增加废料', '1') + gameButton(state, 'salvage', { choice: 'parts' }, '零件箱', '废料 +2；可用于抢修或改装，不修复船体', '2') + '</div></section>';
    }
    function upgradeView(state) {
      return '<section class="ec-stage" aria-labelledby="phase-title"><p class="ec-eyebrow">REFIT / 每次停靠最多一项</p><h2 id="phase-title" tabindex="-1">留维修物资，还是加装战力？</h2><p class="ec-lede">每项消耗 2 废料；可以不买，直接前进。' + (state.leg === 2 ? '这是最后一次停靠，前方没有战斗；保留余料或整修舰船后撤离。' : '战斗抢修同样要用废料，买满火力不等于一定安全。') + '</p><div class="ec-choices">' + gameButton(state, 'upgrade', { kind: 'weapon' }, '武器校准器 · ' + state.weapon + '/2', '全舰基础伤害 +1；费用 2 废料', '1') + gameButton(state, 'upgrade', { kind: 'plating' }, '隔舱衬板 · ' + state.plating + '/2', '全舰最大船体+1，活舰修复1；费用2废料', '2') + '</div>' + gameButton(state, 'continue', {}, state.leg < 2 ? '进入下一段航路 →' : '前往撤离窗口 →', '保留尚未花费的废料', 'E') + '</section>';
    }
    function extractView(state) {
      return '<section class="ec-stage ec-stage--extract" aria-labelledby="phase-title"><p class="ec-eyebrow">EVACUATION / 撤离窗口</p><h2 id="phase-title" tabindex="-1">击败精英，还不等于抵达终点。</h2><p class="ec-lede">三段航路全部清空。下一步由你确认撤离，才会封存胜利战报；现在离开页面可继续此撤离窗口。</p>' + gameButton(state, 'extract', {}, '确认撤离 · 完成远征', '带走剩余舰船和 ' + state.scrap + ' 废料', 'E') + '</section>';
    }
    function terminalView(state) {
      var won = state.phase === 'won', routes = state.history.filter(function (item) { return item.action === 'route'; });
      return '<section class="ec-stage ec-stage--terminal" aria-labelledby="phase-title"><p class="ec-eyebrow">' + (won ? 'MISSION COMPLETE / 撤离完成' : 'MISSION FAILED / 未能撤离') + '</p><h2 id="phase-title" tabindex="-1">' + (won ? '余烬还在飞。' : state.reason === 'blockade' ? '封锁线合拢了。' : '最后一盏航灯熄灭。') + '</h2><p class="ec-lede">' + (won ? '你通过三段航路、击破王冠级，并亲自确认撤离。' : state.reason === 'blockade' ? '本段第12轮结算后仍有敌舰；封锁合围，航团无法撤离。' : '公开预告依序结算后三舰船体归零；失联舰不再行动，也不会自动复活。') + '</p><dl class="ec-report"><div><dt>存活舰</dt><dd>' + state.hull.filter(function (hp) { return hp > 0; }).length + ' / 3</dd></div><div><dt>' + (won ? '带回废料' : '未撤离废料') + '</dt><dd>' + state.scrap + '</dd></div><div><dt>已执行指令</dt><dd>' + state.history.length + '</dd></div></dl><p class="ec-caption">航路：' + routes.map(function (item, i) { return (i + 1) + '段 ' + (item.data.route === 'quiet' ? '灰烬' : '残骸'); }).join(' → ') + '。相同种子 + 相同决策会得到相同结果；种子不会替你选择航路。</p><label class="ec-seed-label" for="ec-seed-replay">复盘种子（可直接重用下方 EC 编码）</label><input id="ec-seed-replay" class="ec-seed-input" type="text" maxlength="48" spellcheck="false" autocomplete="off" value="' + seedCode(state.seed) + '">' + actionButton('restart', {}, '用此种子重新出航', '将本局留作一份备份，开始新的独立远征', '') + '</section>';
    }
    function rules() {
      return '<details class="ec-rules"><summary>规则速查与键盘操作</summary><ul><li>每轮2命令，每艘活舰最多一次行动。可在任何时候结束回合，未用命令不保留。</li><li>前锋基础伤害4，护卫/工程2；装甲直接减伤，至少造成1。破甲基础5、忽略1甲、增加2热。</li><li>普通开火增加1热；热量3时普通火力-1，热量4不能开火/屏障/抢修。自行散热-3；工程全舰散热-2，满热也可用。</li><li>护卫屏障+4盾（上限6），本轮首发减伤2，护卫+1热。工程抢修消耗1废料，恢复最多3船体、目标-1热，工程+1热。</li><li>先依敌舰编号结算公开预告，盾先于船体吸收伤害。干扰即使被盾吸收也+1热。目标在本轮失联则攻击顺延，实时预估包含顺延与屏障。</li><li>若仍可战斗，活舰每轮-1热；护盾每轮向基准2变化1，屏障首发减伤只保留本轮。打赢最后一舰后不再反击或免费维护。</li><li>每战第12轮结算仍有敌舰则封锁失败。第三段王冠级奇数轮3伤、偶数轮5伤。所有路线上都有精英，只有手动确认撤离才算胜利。</li><li>数字1–9下令、E结算/前进；Tab切换，Enter或空格激活按钮。键盘按住不会重复下令，输入种子时快捷键停用。</li></ul></details>';
    }
    function render(focus, phaseChanged) {
      if (disposed) return;
      var state = session.state;
      var warning = '<p class="' + (session.warning ? 'ec-save-warning' : 'ec-save-ok') + '" role="status">' + escapeText(session.warning || '本机自动保存 · 独立档案 xxsxEmberConvoyV1') + '</p>';
      var header = '';
      if (!state) {
        host.innerHTML = '<div class="ec-frame">' + header + '<main class="ec-main"><div class="ec-title-row"><div><p class="ec-eyebrow">DETERMINISTIC EXPEDITION / 01–03</p><h1>余烬航团</h1><p class="ec-lede">三段航路，一支伤痕舰队。敌方下一步完全公开；你的两点命令，要分给火力、屏障与抢修。</p></div><span class="ec-title-index" aria-hidden="true">01<br>—<br>03</span></div><section class="ec-stage ec-stage--start"><div class="ec-start-graphic" aria-hidden="true"><span>VAN</span><span>ESC</span><span>ENG</span><i></i></div><div><p class="ec-eyebrow">ROUTE / COMBAT / RECOVERY</p><h2 id="phase-title" tabindex="-1">每一次出手，都要放弃另一个机会。</h2><p>前锋破甲，护卫保护队友，工程抢修或散热。赢下战斗后打捞、改装，击败精英后亲自确认撤离。没有计时操作，也没有隐藏骰子。</p><label class="ec-seed-label" for="ec-seed-start">可复盘种子（文字或 EC 编码）</label><input id="ec-seed-start" class="ec-seed-input" type="text" maxlength="48" spellcheck="false" autocomplete="off" value="EMBER-01">' + actionButton('start', {}, '集结舰队，选择航路', '开始三段独立远征，不读取旧游戏档案', '') + '</div></section><div class="ec-rules-strip"><span><b>2</b> 命令 / 回合</span><span><b>3</b> 舰船分工</span><span><b>0</b> 隐藏骰子</span></div>' + warning + rules() + '</main></div>';
      } else {
        if (state.phase === 'battle') {
          if (!findEnemy(state, selectedEnemy)) selectedEnemy = state.battle.enemies[0].id;
          if (!living(state, selectedShip)) selectedShip = [0, 1, 2].find(function (ship) { return living(state, ship); });
        }
        var progress = [0, 1, 2].map(function (leg) { return '<span class="' + (state.phase === 'won' || leg < state.leg ? 'is-done' : leg === state.leg ? 'is-current' : '') + '">0' + (leg + 1) + '</span>'; }).join('');
        var view = state.phase === 'route' ? routeView(state) : state.phase === 'battle' ? battleView(state) : state.phase === 'salvage' ? salvageView(state) : state.phase === 'upgrade' ? upgradeView(state) : state.phase === 'extract' ? extractView(state) : terminalView(state);
        host.innerHTML = '<div class="ec-frame">' + header + '<main class="ec-main"><div class="ec-title-row ec-title-row--compact"><div><p class="ec-eyebrow">DETERMINISTIC EXPEDITION</p><h1>余烬航团</h1></div><div class="ec-progress" aria-label="第 ' + (state.leg + 1) + ' 段，共三段">' + progress + '</div></div><div class="ec-hud"><span>航段 <b>0' + (state.leg + 1) + ' / 3</b></span><span>废料 <b>' + state.scrap + '</b></span><span>武器 <b>+' + state.weapon + '</b></span><span>衬板 <b>+' + state.plating + '</b></span></div>' + view + (state.phase !== 'battle' ? '<section class="ec-fleet-summary" aria-label="舰队状态"><div class="ec-section-line"><span>舰队状态</span><small>HULL STATUS</small></div>' + fleet(state, false) + '</section>' : '') + '<p class="ec-receipt" role="status" aria-live="polite" aria-atomic="true">' + escapeText(state.log[0]) + '</p><details class="ec-log"><summary>航行记录 · 最近 ' + state.log.length + ' 条</summary><ol>' + state.log.map(function (line) { return '<li>' + escapeText(line) + '</li>'; }).join('') + '</ol></details>' + warning + rules() + '<p class="ec-disclaimer">无需登录或外部服务。种子 ' + seedCode(state.seed) + ' 与决策序列共同决定结果；存档含完整决策序列并逐步复盘校验。</p></main></div>';
      }
      if (session.conflict) host.querySelectorAll('button').forEach(function (button) { button.disabled = true; });
      var announcement = doc.getElementById('ec-announcement');
      if (announcement) announcement.textContent = session.warning || (state ? state.log[0] : '舰队等待集结');
      var nextFocus = phaseChanged ? host.querySelector('#phase-title') : focus ? host.querySelector('[data-focus="' + focus + '"]') : null;
      if (nextFocus && nextFocus.disabled) nextFocus = host.querySelector('#phase-title');
      if (nextFocus && nextFocus.focus) nextFocus.focus({ preventScroll: !phaseChanged });
    }
    function onClick(eventObject) {
      var button = eventObject.target && eventObject.target.closest ? eventObject.target.closest('[data-ec-action]') : null;
      if (!button || !host.contains(button) || button.disabled || session.conflict || disposed) return;
      var action = button.getAttribute('data-ec-action'), focus = button.getAttribute('data-focus');
      if (action === 'selectEnemy') {
        if (session.state && findEnemy(session.state, button.getAttribute('data-enemy'))) { selectedEnemy = button.getAttribute('data-enemy'); render(focus, false); }
        return;
      }
      if (action === 'selectShip') {
        var ship = Number(button.getAttribute('data-target'));
        if (session.state && living(session.state, ship)) { selectedShip = ship; render(focus, false); }
        return;
      }
      var before = session.state ? session.state.phase : '', ok;
      if (action === 'start' || action === 'restart') {
        var input = host.querySelector(action === 'start' ? '#ec-seed-start' : '#ec-seed-replay');
        ok = startSession(session, input ? input.value : 'EMBER-01');
      } else {
        var data = {};
        ['route', 'choice', 'kind', 'enemy', 'ship', 'target'].forEach(function (name) {
          var value = button.getAttribute('data-' + name);
          if (value !== null) data[name] = name === 'ship' || name === 'target' ? Number(value) : value;
        });
        ok = commit(session, action, data);
      }
      if (ok || session.warning) render(focus, session.state && before !== session.state.phase);
    }
    function onKey(eventObject) {
      if (!eventObject || eventObject.repeat || eventObject.defaultPrevented || eventObject.altKey || eventObject.ctrlKey || eventObject.metaKey || disposed) return;
      var target = eventObject.target;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable || target.closest && target.closest('[contenteditable="true"]'))) return;
      var key = String(eventObject.key).toUpperCase();
      if (!/^[1-9E]$/.test(key)) return;
      var button = host.querySelector('[data-key="' + key + '"]');
      if (!button || button.disabled || session.conflict) return;
      eventObject.preventDefault(); button.click();
    }
    function destroy() {
      disposed = true; host.removeEventListener('click', onClick); doc.removeEventListener('keydown', onKey);
      if (host.emberConvoyCleanup === destroy) delete host.emberConvoyCleanup;
    }
    host.addEventListener('click', onClick); doc.addEventListener('keydown', onKey); host.emberConvoyCleanup = destroy; render();
    return { session: session, render: render, destroy: destroy };
  }

  var api = {
    storageKey: KEY, roundLimit: ROUND_LIMIT, seedValue: seedValue, seedCode: seedCode,
    create: create, createBattle: function (state, route) { return act(state, 'route', { route: route }); },
    act: act, reason: reason, forecast: forecast, replay: replay, validState: validState,
    encode: encode, decode: decode, openSession: openSession, startSession: startSession,
    commit: commit, mount: mount
  };
  root.EmberConvoy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document && root.document.getElementById && root.document.getElementById('ember-convoy')) {
    var storage = null;
    try { storage = root.localStorage; } catch (error) { /* Privacy mode may throw even while accessing the getter. */ }
    mount(root.document, storage);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
