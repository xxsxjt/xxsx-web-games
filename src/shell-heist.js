/* Shell Heist: deterministic puzzle rules shared by the page and Node tests. */
(function () {
  'use strict';

  const KEY = 'xxsxShellHeistCampaignV1';
  const MAX_TURNS = 240;
  const SHIELD_TURNS = 3;
  const TYPES = {
    C: {name: '冲锋壳', mark: '↯', desc: '贴着闸门发动冲锋，永久撞开它。'},
    T: {name: '炮台壳', mark: '⊙', desc: '接管远端终端 A，解除摄像门。炮台不能移动。'},
    N: {name: '侦察壳', mark: '⌁', desc: '扫描隐藏通道，使它在本局内保持开放。'},
    H: {name: '护盾壳', mark: '◇', desc: '挡住激光，持续接下来的三步。可重新展开，但不能在光束里离壳。'}
  };
  const DIRS = {
    up: [0, -1, '↑', '上'], left: [-1, 0, '←', '左'],
    down: [0, 1, '↓', '下'], right: [1, 0, '→', '右']
  };
  const ROOM_DATA = [
    {
      name: '卸载闸口', goals: ['terminal'],
      intro: '先寄壳。冲锋壳就在你右边一格。',
      hint: '冲锋壳必须紧挨闸门才能打开它。通过后，站到 B 格上交互，再走到出口。你可以带着壳撤离。',
      rows: ['########', '#...#..#', '#SC.+BX#', '#...#..#', '########']
    },
    {
      name: '断光廊', goals: ['remote'],
      intro: '让炮台接管 A，再借护盾壳穿过光束。',
      hint: '炮台不能移动，解除摄像门后就离壳。两格光束加最后一格安全地面，正好用完一面护盾；先开盾再走。',
      rows: ['#########', '#ST!H~~X#', '#...#####', '#########']
    },
    {
      name: '交叉闸网', goals: ['remote', 'terminal'],
      intro: '接管 A、取回 B。可以留壳压住北门，也可以绕南侧光束。',
      hint: '北线：撞开闸门后向下一步，此时离壳，壳会沿最后方向滑到压板上。南线：借侦察壳开通道，再换护盾壳。两条线最后都要到 B 和出口。',
      rows: ['##########', '#C+.=...X#', '#S#.#..B.#', '#T#P#....#', '#..##....#', '#N?H~~...#', '##########']
    }
  ];
  const ROOMS = ROOM_DATA.map(({rows, ...details}) => {
    const shells = [];
    const floor = rows.join('');
    for (const [pos, type] of Array.from(floor).entries()) if (TYPES[type]) shells.push({type, pos});
    return {...details, w: rows[0].length, h: rows.length, floor: floor.replace(/[SCTNH]/g, '.'), start: floor.indexOf('S'), shells};
  });
  const ROUTES = ['press', 'laser'];
  const ROUTE_NAMES = {press: '北线 · 留壳压板', laser: '南线 · 扫描穿光'};

  function start(index = 0) {
    const room = ROOMS[index];
    return {
      index, pos: room.start, controlled: '', shells: room.shells.map(shell => ({...shell, dir: ''})),
      gate: false, remote: false, scanned: false, terminal: false, shield: 0, route: '', phase: 'play', turn: 0
    };
  }

  function next(room, pos, direction) {
    const [dx, dy] = DIRS[direction];
    const x = pos % room.w + dx, y = Math.floor(pos / room.w) + dy;
    return x < 0 || x >= room.w || y < 0 || y >= room.h ? -1 : y * room.w + x;
  }

  function ready(s) { return ROOMS[s.index].goals.every(goal => s[goal]); }

  function weighted(s) { return s.shells.some(shell => ROOMS[s.index].floor[shell.pos] === 'P'); }

  function nearby(s) {
    const room = ROOMS[s.index];
    const reach = [s.pos, ...Object.keys(DIRS).map(dir => next(room, s.pos, dir))];
    return s.shells.filter(shell => shell.type !== s.controlled && reach.includes(shell.pos))
      .sort((a, b) => Number(b.pos === s.pos) - Number(a.pos === s.pos));
  }

  function obstacle(s, pos, type, shield) {
    const cell = ROOMS[s.index].floor[pos];
    if (pos < 0 || cell === '#') return '前方是墙。';
    if (cell === '+' && !s.gate) return '闸门锁着，需要冲锋壳。';
    if (cell === '!' && !s.remote) return '摄像门锁着，让炮台接管 A。';
    if (cell === '?' && !s.scanned) return '维护通道封闭，需要侦察扫描。';
    if (cell === '=' && !weighted(s)) return '北门锁着，需要用壳体压住压板。';
    if (cell === '~' && (type !== 'H' || !shield)) return '激光还在，只有展开护盾的护盾壳能通过。';
    if (s.shells.some(shell => shell.type !== type && shell.pos === pos)) return '有壳体占着这格。可以靠近后寄壳。';
    return '';
  }

  function coastTo(s, shell) {
    if (!shell.dir || shell.type === 'T') return -1;
    const pos = next(ROOMS[s.index], shell.pos, shell.dir);
    return pos !== s.pos && !obstacle(s, pos, shell.type, 0) ? pos : -1;
  }

  function turn(previous, action) {
    const no = note => ({ok: false, state: previous, note});
    if (previous.phase !== 'play') return no('本局已经结束，可撤销或重开。');
    if (typeof action !== 'string') return no('未知操作。');
    const s = {...previous, shells: previous.shells.map(shell => ({...shell}))};
    const room = ROOMS[s.index];
    const shell = s.shells.find(item => item.type === s.controlled);
    const cell = room.floor[s.pos];
    let note, renew = false;

    if (Object.hasOwn(DIRS, action)) {
      if (s.controlled === 'T') return no('炮台固定在基座上。按“离壳”再移动。');
      const target = next(room, s.pos, action), reason = obstacle(s, target, s.controlled, s.shield);
      if (reason) return no(reason);
      // Record west-to-east crossings, not merely which abilities were used.
      if (s.index === 2 && action === 'right') {
        if (cell === '=') s.route = 'press';
        if (cell === '~' && room.floor[target] !== '~') s.route = 'laser';
      }
      s.pos = target;
      if (shell) { shell.pos = target; shell.dir = action; }
      note = room.floor[target] === 'B' && !s.terminal ? '已到 B。按“交互”取回坐标。' :
        room.floor[target] === 'X' && !ready(s) ? '出口还不能开启：先完成未划掉的目标。' : '移动至' + coordinate(room, target) + '。';
    } else if (action.startsWith('borrow:') || action === 'leave') {
      const leaving = action === 'leave';
      if (cell === '~') return no('光束里不能离壳或换壳。先到安全地面。');
      const candidate = leaving ? null : nearby(s).find(item => item.type === action.slice(7));
      if (!leaving && !candidate) return no('附近没有这个壳。请先靠近一格。');
      if (candidate && room.floor[candidate.pos] === '~') return no('不能寄入光束中的壳体。');
      if (leaving && !shell) return no('你现在没有借用壳体。');
      s.controlled = candidate ? candidate.type : '';
      if (candidate) { s.pos = candidate.pos; candidate.dir = ''; }
      s.shield = 0;
      note = candidate ? '已寄壳：' + TYPES[candidate.type].name + '。' : '你已离壳。';
      if (shell) {
        const coast = coastTo(s, shell);
        if (coast >= 0) {
          shell.pos = coast;
          note += room.floor[coast] === 'P' ? '空壳滑到压板上，北门开启。' : '空壳沿' + DIRS[shell.dir][3] + '方滑了一格。';
        } else { note += '空壳留在原格。'; }
        shell.dir = '';
      }
    } else if (action === 'ability') {
      if (!shell) return no('本体没有能力。先借一副壳。');
      if (shell.type === 'C') {
        if (s.gate) return no('闸门已经打开。');
        if (!Object.keys(DIRS).some(dir => room.floor[next(room, s.pos, dir)] === '+')) return no('冲锋需要贴近闸门。');
        s.gate = true;
        note = '撞开闸门。闸门本局不再关闭。';
      } else if (shell.type === 'T') {
        if (s.remote) return no('A 已经接管。');
        s.remote = true;
        note = '终端 A 已接管。可以离壳。';
      } else if (shell.type === 'N') {
        if (s.scanned) return no('维护通道已经开启。');
        s.scanned = true;
        note = '扫描完成，维护通道已打开。';
      } else {
        if (s.shield === SHIELD_TURNS) return no('护盾还有完整的三步。');
        s.shield = SHIELD_TURNS;
        renew = true;
        note = '护盾展开：接下来三步受到保护。';
      }
    } else if (action === 'interact') {
      if (cell !== 'B') return no('站到终端 B 上才能交互。');
      if (s.terminal) return no('已经从 B 取回坐标。');
      s.terminal = true;
      note = 'B 坐标已取回。';
    } else { return no('未知操作。'); }

    s.turn++;
    if (!renew && s.shield) s.shield--;
    if (room.floor[s.pos] === '~' && !s.shield) {
      s.phase = 'lost';
      note = '护盾耗尽时还在光束里。撤销一步，或重试。';
    } else if (room.floor[s.pos] === 'X' && ready(s)) {
      s.phase = 'won';
      note = '撤离完成 · ' + s.turn + ' 步' + (s.route ? ' · ' + ROUTE_NAMES[s.route] : '') + '。';
    } else if (s.turn >= MAX_TURNS) {
      s.phase = 'lost';
      note = '达到本局 240 步上限。可以撤销或重试。';
    }
    return {ok: true, state: s, note};
  }

  function replay(index, actions) {
    if (!Number.isInteger(index) || !ROOMS[index] || !Array.isArray(actions) || actions.length > MAX_TURNS) return null;
    let state = start(index);
    for (const action of actions) {
      const result = turn(state, action);
      if (!result.ok) return null;
      state = result.state;
    }
    return state;
  }

  function fresh() { return {version: 1, room: 0, best: ROOMS.map(() => null), routes: [], actions: []}; }

  function unlocked(progress, index) { return !!ROOMS[index] && (index === 0 || progress.best[index - 1] !== null); }

  function record(progress, state) {
    if (state.phase !== 'won') return;
    progress.best[state.index] = Math.min(progress.best[state.index] ?? MAX_TURNS, state.turn);
    if (state.route && !progress.routes.includes(state.route)) progress.routes.push(state.route);
  }

  function load(raw) {
    if (raw === null) return {progress: fresh(), state: start()};
    if (typeof raw !== 'string' || raw.length > 6000) return null;
    try {
      const p = JSON.parse(raw);
      if (!p || p.version !== 1 || !Array.isArray(p.best) || p.best.length !== ROOMS.length ||
        !p.best.every((n, i) => n === null || Number.isInteger(n) && n > 0 && n <= MAX_TURNS && (i === 0 || p.best[i - 1] !== null)) ||
        !Array.isArray(p.routes) || p.routes.length > ROUTES.length || new Set(p.routes).size !== p.routes.length ||
        !p.routes.every(route => ROUTES.includes(route)) || (p.routes.length && p.best[ROOMS.length - 1] === null) ||
        !Number.isInteger(p.room) || !unlocked(p, p.room)) return null;
      const state = replay(p.room, p.actions);
      if (!state || (state.phase === 'won' && (p.best[p.room] === null || p.best[p.room] > state.turn ||
        state.route && !p.routes.includes(state.route)))) return null;
      return {progress: {version: 1, room: p.room, best: p.best, routes: p.routes, actions: p.actions}, state};
    } catch { return null; }
  }

  function store(storage) {
    let raw, writable = false, info = '';
    let restored = load(null);
    try {
      raw = storage.getItem(KEY);
      const data = load(raw);
      if (data) { restored = data; writable = true; }
      else { info = '旧记录无法读取，未覆盖原记录。本次可游玩但不会保存。'; }
    } catch { info = '本机存档不可用，本次进度刷新后会丢失。'; }
    return {
      ...restored,
      get info() { return info; },
      save(progress) {
        if (!writable) return false;
        try {
          if (storage.getItem(KEY) !== raw) {
            writable = false;
            info = '另一个页面更新了本机记录，本页不会覆盖。刷新可读取其进度。';
            return false;
          }
          const value = JSON.stringify(progress);
          storage.setItem(KEY, value);
          raw = value;
          info = '';
          return true;
        } catch {
          info = '暂时无法写入存档。继续行动可重试，刷新前请留意。';
          return false;
        }
      }
    };
  }

  function coordinate(room, pos) { return '第 ' + (Math.floor(pos / room.w) + 1) + ' 行第 ' + (pos % room.w + 1) + ' 列'; }

  const CELLS = {
    '#': ['wall', '', '墙'], '.': ['floor', '', '地面'], '+': ['gate', '▥', '闸门'],
    '!': ['camera', '▥', '摄像门'], '?': ['scan', '?', '未扫描通道'], '=': ['press', '▥', '北门'],
    '~': ['beam', '≋', '激光'], B: ['terminal', 'B', '终端 B'], P: ['plate', '▣', '压板'], X: ['exit', '↗', '出口']
  };

  function drawBoard(s) {
    const room = ROOMS[s.index];
    const plateDown = weighted(s);
    let html = '';
    for (let y = 0; y < room.h; y++) {
      html += '<tr>';
      for (let x = 0; x < room.w; x++) {
        const pos = y * room.w + x, tile = room.floor[pos], active = pos === s.pos;
        const shell = s.shells.find(item => item.pos === pos);
        const [kind, mark, label] = CELLS[tile];
        const open = tile === '+' && s.gate || tile === '!' && s.remote || tile === '?' && s.scanned || tile === '=' && plateDown;
        const done = tile === 'B' && s.terminal || tile === 'P' && !!shell || tile === 'X' && ready(s);
        const actor = active ? (s.controlled ? TYPES[s.controlled].mark : '●') : shell ? TYPES[shell.type].mark : '';
        const occupant = active ? (s.controlled ? '，你在' + TYPES[s.controlled].name + '中' : '，你在这里' + (shell ? '，与' + TYPES[shell.type].name + '同格' : '')) : shell ? '，' + TYPES[shell.type].name : '';
        const description = coordinate(room, pos) + '，' + label + (open ? '已开启' : '') + (done && tile !== 'X' ? '已激活' : '') + occupant;
        html += '<td class="cell ' + kind + (open ? ' open' : '') + (done ? ' done' : '') + (active ? ' active' : '') + '" aria-label="' + description + '" title="' + description + '">' +
          '<span aria-hidden="true">' + (actor || (open ? '·' : mark)) + '</span>' +
          (actor && mark ? '<small aria-hidden="true">' + mark + '</small>' : '') + '</td>';
      }
      html += '</tr>';
    }
    return html;
  }

  function mount(doc, storage) {
    const host = doc.getElementById('shell-game');
    if (!host) return;
    const items = Object.fromEntries([...host.querySelectorAll('[id]')].map(node => [node.id, node]));
    const roomButtons = [...host.querySelectorAll('[data-room]')];
    const gameButtons = [...host.querySelectorAll('[data-turn]')];
    const saved = store(storage);
    const progress = saved.progress;
    let s = saved.state;
    let note = s.phase === 'won' ? '已恢复本机通关记录 · ' + s.turn + ' 步。' :
      s.phase === 'lost' ? '已恢复中断的一局。可以撤销一步或重试。' : s.turn ? '已恢复本机进度。' : ROOMS[s.index].intro;
    const button = action => gameButtons.find(node => node.dataset.turn === action);

    function render() {
      const room = ROOMS[s.index], shell = s.shells.find(item => item.type === s.controlled);
      const coast = shell ? coastTo(s, shell) : -1;
      const targets = nearby(s), selected = items['borrow-target'].value;
      items['room-title'].textContent = room.name;
      items['room-code'].textContent = '舱段 / 0' + (s.index + 1);
      items.turns.textContent = String(s.turn).padStart(2, '0');
      items['shell-status'].textContent = s.phase === 'play' ? (s.shield ? '护盾 ' + s.shield + ' 步' : '信号在线') : s.phase === 'won' ? '已撤离' : '信号中断';
      items.map.style.setProperty('--map-columns', room.w);
      items.map.setAttribute('aria-label', room.name + '设施地图，' + room.h + ' 行 ' + room.w + ' 列');
      items['map-body'].innerHTML = drawBoard(s);
      items.status.dataset.phase = s.phase;
      const outcome = note + ' 当前位于' + coordinate(room, s.pos) + '。';
      if (items.status.textContent !== outcome) items.status.textContent = outcome;
      items['current-shell'].textContent = shell ? TYPES[shell.type].name : '本体 / 游离信号';
      items['shell-rule'].textContent = shell ? TYPES[shell.type].desc : '本体只能移动、寄壳或操作终端。相邻一格或同格即可寄壳。';
      items.coast.textContent = shell ? (room.floor[s.pos] === '~' ? '光束中不能离壳。' : coast < 0 ? '现在离壳：壳体留在原格。' : '现在离壳：壳体向' + DIRS[shell.dir][3] + '滑一格' + (room.floor[coast] === 'P' ? '，压住压板。' : '。')) : '空壳最多滑动一次，之后保持原位。';
      items['goal-a'].hidden = !room.goals.includes('remote');
      items['goal-b'].hidden = !room.goals.includes('terminal');
      items['goal-a'].textContent = (s.remote ? '✓ 已接管' : '○ 接管') + '终端 A';
      items['goal-b'].textContent = (s.terminal ? '✓ 已取回' : '○ 取回') + '终端 B 坐标';
      items['goal-exit'].textContent = s.phase === 'won' ? '✓ 已撤离' : ready(s) ? '→ 出口已就绪' : '○ 完成目标后撤离';
      items['room-hint'].textContent = room.hint;
      items['best-steps'].textContent = progress.best[s.index] === null ? '尚无本舱成绩' : '最少 ' + progress.best[s.index] + ' 步';
      items['route-record'].hidden = s.index !== 2;
      items['route-record'].textContent = progress.routes.length ? '已走过：' + progress.routes.map(route => ROUTE_NAMES[route]).join(' / ') : '两条撤离路线尚未记录';
      items['save-status'].hidden = !saved.info;
      items['save-status'].textContent = saved.info;
      items['progress-count'].textContent = '撤离 ' + progress.best.filter(n => n !== null).length + ' / ' + ROOMS.length;
      items['borrow-choice'].hidden = targets.length < 2 || s.phase !== 'play';
      items['borrow-target'].innerHTML = targets.map(target => '<option value="' + target.type + '">' + TYPES[target.type].name + '</option>').join('');
      if (targets.some(target => target.type === selected)) items['borrow-target'].value = selected;
      button('borrow').textContent = targets.length ? '寄壳：' + TYPES[items['borrow-target'].value].name : '寄壳';
      for (const node of gameButtons) node.disabled = s.phase !== 'play';
      items.undo.disabled = !progress.actions.length;
      items['next-room'].hidden = s.phase !== 'won' || s.index + 1 >= ROOMS.length;
      for (const node of roomButtons) {
        const index = Number(node.dataset.room);
        const open = unlocked(progress, index);
        node.disabled = !open;
        node.setAttribute('aria-current', index === s.index ? 'step' : 'false');
        node.setAttribute('aria-label', ROOMS[index].name + (open ? progress.best[index] === null ? '，可游玩' : '，已撤离' : '，未解锁'));
      }
    }

    function choose(index) {
      if (!unlocked(progress, index)) return;
      progress.room = index;
      progress.actions = [];
      s = start(index);
      note = ROOMS[index].intro;
      saved.save(progress);
      render();
      items['room-title'].focus();
    }

    function act(action) {
      if (action === 'undo') {
        if (!progress.actions.length) return;
        progress.actions.pop();
        s = replay(s.index, progress.actions);
        note = '已撤销上一步。';
        saved.save(progress);
      } else {
        const result = turn(s, action === 'borrow' ? 'borrow:' + items['borrow-target'].value : action);
        s = result.state;
        note = result.note;
        if (result.ok) {
          progress.actions.push(action === 'borrow' ? 'borrow:' + items['borrow-target'].value : action);
          record(progress, s);
          saved.save(progress);
        }
      }
      render();
      if (s.phase !== 'play' && action !== 'undo') (items['next-room'].hidden ? items.restart : items['next-room']).focus({preventScroll: true});
    }

    host.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target || target.disabled) return;
      if (target.dataset.turn) act(target.dataset.turn);
      else if (target.dataset.room !== undefined && Number(target.dataset.room) !== s.index) choose(Number(target.dataset.room));
      else if (target === items.restart) choose(s.index);
      else if (target === items.undo) act('undo');
      else if (target === items['next-room']) choose(s.index + 1);
    });
    items['borrow-target'].addEventListener('change', () => {
      button('borrow').textContent = '寄壳：' + TYPES[items['borrow-target'].value].name;
    });

    const keys = new Map(Object.entries({ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right',
      w: 'up', a: 'left', s: 'down', d: 'right', e: 'borrow', x: 'ability', q: 'leave', f: 'interact', z: 'undo'}));
    doc.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing ||
        event.target.closest?.('input, select, textarea, [contenteditable]')) return;
      const action = keys.get(event.key) || keys.get(event.key.toLowerCase());
      if (!action || (action !== 'undo' && s.phase !== 'play')) return;
      event.preventDefault();
      if (!event.repeat) act(action);
    });

    render();
    items.workbench.hidden = false;
  }

  if (typeof module === 'object' && module.exports) module.exports = {KEY, MAX_TURNS, ROOMS, start, turn, replay, ready, nearby, weighted, record, store, load, fresh, unlocked};
  else if (typeof document !== 'undefined') {
    let storage;
    try { storage = window.localStorage; } catch { /* playable without storage */ }
    mount(document, storage);
  }
})();
