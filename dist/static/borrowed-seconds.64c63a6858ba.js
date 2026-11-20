(() => {
  'use strict';

  const BEATS = 10;
  const SAVE_KEY = 'xxsxBorrowedSecondsV1';
  const TIMELINE_NOTE = '虚线预演假设你接下来一直等待。× 表示受阻；门行显示该拍可进入的门号。';
  const ECHO_IDS = Object.freeze(['A', 'B', 'C']);
  const GATES = Object.freeze({ A: '1', B: '2', C: '3' });
  const ACTIONS = Object.freeze({
    U: Object.freeze({ dx: 0, dy: -1, glyph: '↑', label: '向上' }),
    L: Object.freeze({ dx: -1, dy: 0, glyph: '←', label: '向左' }),
    R: Object.freeze({ dx: 1, dy: 0, glyph: '→', label: '向右' }),
    D: Object.freeze({ dx: 0, dy: 1, glyph: '↓', label: '向下' }),
    '.': Object.freeze({ dx: 0, dy: 0, glyph: '·', label: '等待' }),
  });

  const ROOMS = Object.freeze([
    {
      title: '留在压板', topic: '封存',
      goal: '留一个回声在 1 号压板上，再走另一条路去出口。',
      tip: '先走上 1 号压板，再按「封存回声」；不用走满十拍。',
      rows: [
        '#########',
        '#.1##.X##',
        '#S###.###',
        '#...A.###',
        '#########',
      ],
    },
    {
      title: '晚一拍的门', topic: '时序',
      goal: '1 号门离得很近，压板却很远。留出开门需要的拍数。',
      tip: '门要到压板踩住的下一拍才能进入。可提前在时间线上检查。',
      rows: [
        '#########',
        '#1..###X#',
        '###.###.#',
        '###SA...#',
        '###..####',
        '#########',
      ],
    },
    {
      title: '窄廊错身', topic: '阻塞',
      goal: '两块 1 号压板同时有人，1 号门才开。小心回声在窄廊撞上。',
      tip: '共用一段路时，可以先等待，再把错开的起步录进第二段回声。',
      rows: [
        '#########',
        '#1.######',
        '##.######',
        '#1..S.A##',
        '######..#',
        '#######X#',
        '#########',
      ],
    },
    {
      title: '三重同步', topic: '组合',
      goal: '借 1 号门送两段回声进去，让它们分开踩住两块 2 号压板。',
      tip: '三块板都要保持踩住。两条 2 号支路长度不同，想想谁该先走。',
      rows: [
        '##########',
        '##1#######',
        '##.###2###',
        '##.###.###',
        '##S.A..BX#',
        '######2###',
        '##########',
      ],
    },
  ].map(compileRoom));

  function compileRoom({ rows, ...info }, index) {
    const width = rows[0].length;
    const tiles = rows.join('');
    const start = tiles.indexOf('S');
    const exit = tiles.indexOf('X');
    const groups = Object.values(GATES).flatMap(id => {
      const plates = [...tiles].flatMap((tile, at) => tile === id ? [at] : []);
      return plates.length ? [Object.freeze({ id, plates: Object.freeze(plates) })] : [];
    });
    const gateIds = Object.entries(GATES).filter(([tile]) => tiles.includes(tile)).map(([, id]) => id);
    if (rows.some(row => row.length !== width) || /[^#.SX123ABC]/.test(tiles) ||
        start < 0 || start !== tiles.lastIndexOf('S') || exit < 0 || exit !== tiles.lastIndexOf('X') ||
        !groups.length || groups.map(group => group.id).join('') !== gateIds.join('')) {
      throw new Error(`Invalid borrowed-seconds room ${index + 1}`);
    }
    return Object.freeze({ ...info, number: index + 1, hash: `#room-${index + 1}`,
      width, height: rows.length, tiles, start, exit, groups: Object.freeze(groups) });
  }

  function newRun(room, echoes = []) {
    return { room, echoes, actions: [], frames: [], beat: 0, phase: 'playing',
      positions: Array(echoes.length + 1).fill(room.start) };
  }

  function activeCircuits(room, positions) {
    return room.groups.filter(group => group.plates.every(at => positions.includes(at))).map(group => group.id);
  }

  function actorId(run, index) {
    return run.echoes[index]?.id ?? 'player';
  }

  function advance(run, action) {
    if (run.phase !== 'playing' || typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) return run;
    const { room, echoes } = run;
    const beat = run.beat + 1;
    // Gate state is sampled once. Earlier actors can vacate a cell, but cannot open a gate mid-beat.
    const open = activeCircuits(room, run.positions);
    const positions = run.positions.slice();
    const events = echoes.map(echo => echo.actions[beat - 1]).concat(action).map((command, index) => {
      const from = positions[index];
      const event = { actor: actorId(run, index), command, from, to: from };
      if (command === '.') return { ...event, outcome: 'wait' };

      const { dx, dy } = ACTIONS[command];
      const x = from % room.width + dx;
      const y = Math.floor(from / room.width) + dy;
      const at = x < 0 || x >= room.width || y < 0 || y >= room.height ? -1 : x + y * room.width;
      const blocked = { ...event, at, outcome: 'blocked' };
      const circuit = GATES[room.tiles[at]];
      if (at < 0 || room.tiles[at] === '#') return { ...blocked, reason: 'wall' };
      if (circuit && !open.includes(circuit)) return { ...blocked, reason: 'gate', circuit };
      const occupant = positions.indexOf(at);
      if (at !== room.start && occupant !== -1) {
        return { ...blocked, reason: 'actor', blocker: actorId(run, occupant) };
      }
      positions[index] = at;
      return { ...event, outcome: 'move', to: at };
    });

    const after = activeCircuits(room, positions);
    const won = positions.at(-1) === room.exit && after.length === room.groups.length;
    return { room, echoes, beat, positions, actions: [...run.actions, action],
      frames: [...run.frames, { beat, open, after, events }],
      phase: won ? 'won' : beat === BEATS ? 'spent' : 'playing' };
  }

  function canSeal(run) {
    return run.beat > 0 && run.phase !== 'won' && run.echoes.length < ECHO_IDS.length;
  }

  function sealRun(run) {
    if (!canSeal(run)) return run;
    const id = ECHO_IDS.find(slot => !run.echoes.some(echo => echo.id === slot));
    const actions = Object.freeze([...run.actions, ...Array(BEATS - run.beat).fill('.')]);
    return newRun(run.room, [...run.echoes, Object.freeze({ id, actions })]);
  }

  function retryRun(run) {
    return run.phase === 'won' || !run.beat ? run : newRun(run.room, run.echoes);
  }

  function removeEcho(run, id) {
    const echoes = run.echoes.filter(echo => echo.id !== id);
    return run.phase === 'won' || echoes.length === run.echoes.length ? run : newRun(run.room, echoes);
  }

  function timeline(run) {
    let preview = run;
    while (preview.phase === 'playing') preview = advance(preview, '.');
    return preview.frames;
  }

  function parseProgress(raw) {
    try {
      const data = JSON.parse(raw);
      if (data?.v === 1 && Number.isInteger(data.cleared) && data.cleared >= 0 && data.cleared <= ROOMS.length) {
        return data.cleared;
      }
    } catch { /* Ignore malformed or unavailable local data. */ }
    return 0;
  }

  function openProgress(getStorage) {
    let storage = null;
    let cleared = 0;
    try {
      storage = getStorage() || null;
      if (storage) cleared = parseProgress(storage.getItem(SAVE_KEY));
    } catch { storage = null; }

    return Object.freeze({
      get local() { return storage !== null; },
      get cleared() { return cleared; },
      complete(index) {
        if (!Number.isInteger(index) || index < 0 || index >= ROOMS.length || index > cleared) return;
        const next = Math.max(cleared, index + 1);
        if (storage && next > cleared) {
          try {
            // Preserve advances observed just before the write; this isn't a cross-tab lock.
            const latest = parseProgress(storage.getItem(SAVE_KEY));
            if (latest < next) storage.setItem(SAVE_KEY, JSON.stringify({ v: 1, cleared: next }));
            cleared = Math.max(latest, next);
            return;
          } catch { storage = null; }
        }
        cleared = next;
      },
    });
  }

  function roomFromHash(hash, cleared) {
    const index = ROOMS.findIndex(room => room.hash === hash);
    return index >= 0 && index <= cleared ? index : Math.min(cleared, ROOMS.length - 1);
  }

  const twoDigits = n => String(n).padStart(2, '0');
  const nameOf = id => id === 'player' ? '你' : `回声 ${id}`;
  const gateNames = ids => `${ids.join('、')} 号门`;

  function blockReason(event) {
    if (event.reason === 'gate') return `被关闭的 ${gateNames([event.circuit])}挡住`;
    if (event.reason === 'actor') return event.blocker === 'player' ? '被你的棋子挡住' : `被回声 ${event.blocker} 挡住`;
    return '撞到墙';
  }

  function describeEvent(event) {
    const head = `${nameOf(event.actor)}：${ACTIONS[event.command].label}`;
    return event.outcome === 'blocked' ? `${head}，${blockReason(event)}` : head;
  }

  function beatMessage(run) {
    const { open, after, events } = run.frames.at(-1);
    const player = events.at(-1);
    const message = [];
    if (run.phase === 'spent') message.push('十拍用完，出口尚未同步。');
    const blocked = events.filter(event => event.outcome === 'blocked');
    if (blocked.length) message.push(`${blocked.map(event => `${nameOf(event.actor)}${event.actor === 'player' ? '' : ' '}${blockReason(event)}`).join('；')}。`);
    if (run.phase === 'playing') {
      const opened = after.filter(id => !open.includes(id));
      const closed = open.filter(id => !after.includes(id));
      if (opened.length) message.push(`${gateNames(opened)}下一拍可通行。`);
      if (closed.length) message.push(`${gateNames(closed)}下一拍关闭。`);
      if (run.positions.at(-1) === run.room.exit) message.push('出口未同步：还有压板空着。');
      const floor = run.room.tiles[player.to];
      if (player.outcome === 'move' && /[123]/.test(floor) && canSeal(run)) {
        message.push(`你在 ${floor} 号压板上，可封存当前路线。`);
      }
    }
    if (!message.length) message.push(`${describeEvent(player)}。`);
    if (run.phase === 'spent') {
      message.push(canSeal(run) ? '可封存这轮或重试。' : '可重试，或移除一段回声腾出槽位。');
    }
    return `第 ${twoDigits(run.beat)} 拍 · ${message.join('')}`;
  }

  function mount(doc, win) {
    const byId = id => doc.getElementById(id);
    if (!byId('seconds-game')) return;
    const board = byId('board');
    const feedback = byId('feedback');
    const reviewBeat = byId('review-beat');
    const seal = byId('seal');
    const retry = byId('retry');
    const next = byId('next-room');
    const finish = byId('finish');
    const replay = byId('replay');
    const roomTitle = byId('room-title');
    const trace = byId('timeline');
    const picks = ROOMS.map(room => byId(`pick-${room.number}`));
    const erase = ECHO_IDS.map(id => byId(`erase-${id}`));
    const moveButtons = { U: byId('move-up'), L: byId('move-left'), R: byId('move-right'),
      D: byId('move-down'), '.': byId('move-wait') };
    const keys = new Map([
      ['arrowup', 'U'], ['w', 'U'], ['arrowleft', 'L'], ['a', 'L'],
      ['arrowright', 'R'], ['d', 'R'], ['arrowdown', 'D'], ['s', 'D'], [' ', '.'], ['.', '.'],
    ]);
    const progress = openProgress(() => win.localStorage);
    const element = (tag, className, text) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    let roomIndex = -1;
    let run;
    let restored = false;
    let tiles;
    const done = () => restored || run.phase === 'won';

    function initializeBoard(room) {
      board.style.setProperty('--columns', room.width);
      tiles = [...room.tiles].map(tile => {
        const className = tile === '#' ? 'wall' : tile === 'S' ? 'spawn' : tile === 'X' ? 'exit' :
          GATES[tile] ? 'gate' : tile === '.' ? 'floor' : 'plate';
        const cell = element('div', `tile tile-${className}`);
        const glyph = tile === 'S' ? '◎' : tile === 'X' ? '↗' : GATES[tile] || (className === 'plate' ? tile : '');
        if (glyph) cell.append(element('span', 'tile-mark', glyph));
        const actor = element('span', 'piece');
        const pile = element('span', 'pile');
        cell.append(actor, pile);
        cell.setAttribute('aria-hidden', 'true');
        return { cell, actor, pile };
      });
      board.replaceChildren(...tiles.map(tile => tile.cell));
    }

    function drawBoard() {
      const { room, positions } = run;
      const open = activeCircuits(room, positions);
      const impacts = run.frames.at(-1)?.events.filter(event => event.outcome === 'blocked').map(event => event.at) ?? [];
      tiles.forEach(({ cell, actor, pile }, index) => {
        const tile = room.tiles[index];
        const at = positions.flatMap((pos, slot) => pos === index ? [actorId(run, slot)] : []);
        const hasYou = at.includes('player');
        cell.classList.toggle('is-occupied', at.length > 0);
        cell.classList.toggle('is-held', /[123]/.test(tile) && at.length > 0);
        cell.classList.toggle('is-open', open.includes(GATES[tile]));
        cell.classList.toggle('is-ready', tile === 'X' && open.length === room.groups.length);
        cell.classList.toggle('is-impact', impacts.includes(index));
        actor.hidden = at.length === 0;
        actor.classList.toggle('piece-you', hasYou);
        actor.textContent = hasYou ? '你' : at[0] ?? '';
        pile.hidden = at.length <= 1;
        pile.textContent = at.length > 1 ? `+${at.length - 1}` : '';
      });
      board.classList.toggle('is-solved', run.phase === 'won');
      const location = (pos, index) => `${nameOf(actorId(run, index))}在第 ${pos % room.width + 1} 列、第 ${Math.floor(pos / room.width) + 1} 行`;
      board.setAttribute('aria-label', `${room.title}地图。${positions.map(location).join('；')}。${open.length ? `${gateNames(open)}可进入。` : '门均关闭。'}`);
    }

    function drawTimeline() {
      trace.hidden = restored;
      byId('review').hidden = restored;
      byId('timeline-note').textContent = restored ? '通关已记录。重玩本房可以重新录制时间线。' : TIMELINE_NOTE;
      if (restored) {
        trace.replaceChildren();
        return;
      }

      const frames = timeline(run);
      const selected = Number(reviewBeat.value) || Math.max(1, run.beat);
      const caption = element('th', '', '拍');
      caption.scope = 'col';
      const heading = element('tr');
      heading.append(caption);
      for (let beat = 1; beat <= BEATS; beat++) {
        const tick = element('th', beat === selected ? 'is-selected' : '', String(beat));
        tick.scope = 'col';
        heading.append(tick);
      }
      const header = element('thead');
      header.append(heading);
      const body = element('tbody');

      function lane(label, longLabel, className, content) {
        const row = element('tr', className);
        const name = element('th', 'lane-label', label);
        name.scope = 'row';
        name.setAttribute('aria-label', longLabel);
        row.append(name);
        for (let beat = 1; beat <= BEATS; beat++) {
          const frame = frames[beat - 1];
          const [glyph, description, blocked] = frame ? content(frame) : ['—', '无记录', false];
          const predicted = frame && beat > run.beat;
          const cell = element('td', 'trace-cell', glyph);
          if (predicted) cell.classList.add('is-forecast');
          if (blocked) cell.classList.add('is-blocked');
          if (beat === selected) cell.classList.add('is-selected');
          const accessible = predicted ? `预演：${description}` : description;
          cell.title = accessible;
          cell.setAttribute('aria-label', accessible);
          row.append(cell);
        }
        body.append(row);
      }

      run.echoes.concat({ id: 'player' }).forEach(({ id }, index) => {
        lane(id === 'player' ? '你' : id, nameOf(id), id === 'player' ? 'live-lane' : 'echo-lane', frame => {
          const event = frame.events[index];
          const blocked = event.outcome === 'blocked';
          return [blocked ? '×' : ACTIONS[event.command].glyph, describeEvent(event), blocked];
        });
      });
      lane('门', '本拍可进入的门', 'gate-lane', frame => [frame.open.join('/') || '·',
        frame.open.length ? `${gateNames(frame.open)}可进入` : '本拍门均关闭', false]);
      trace.replaceChildren(header, body);

      const frame = frames[selected - 1];
      const prefix = `第 ${twoDigits(selected)} 拍`;
      byId('review-summary').textContent = !frame ? `${prefix} · 无记录` :
        `${prefix} · ${selected > run.beat ? '预演' : '实录'}｜${frame.open.length ? `${gateNames(frame.open)}可进入` : '门均关闭'}`;
      byId('review-events').textContent = frame ? `${frame.events.map(describeEvent).join('；')}。` :
        run.phase === 'won' ? '同步后本轮已停止。' : '预演中已同步，届时本轮停止。';
    }

    function render(message) {
      const cleared = progress.cleared;
      const finished = done();
      const acting = run.phase === 'playing' && !restored;
      byId('clock').hidden = restored;
      byId('clear-stamp').hidden = !restored;
      byId('beat-count').textContent = twoDigits(run.beat);
      byId('progress-count').textContent = `通关 ${cleared} / ${ROOMS.length}`;
      byId('memory').textContent = `回声 ${run.echoes.length} / ${ECHO_IDS.length}`;
      byId('play-controls').hidden = finished;
      byId('result-actions').hidden = !finished;
      next.hidden = !finished || roomIndex === ROOMS.length - 1;
      finish.hidden = !finished || roomIndex !== ROOMS.length - 1;
      for (const button of Object.values(moveButtons)) button.disabled = !acting;
      seal.disabled = finished || !canSeal(run);
      retry.disabled = finished || run.beat === 0;
      byId('echo-tools').hidden = finished || run.echoes.length === 0;
      erase.forEach((button, index) => {
        button.hidden = finished || !run.echoes.some(echo => echo.id === ECHO_IDS[index]);
      });
      picks.forEach((button, index) => {
        const complete = index < cleared;
        button.disabled = index > cleared;
        button.classList.toggle('is-cleared', complete);
        if (index === roomIndex) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
        button.setAttribute('aria-label', `第 ${index + 1} 间${complete ? '，已通关' : button.disabled ? '，未解锁' : ''}`);
      });
      byId('save-note').textContent = progress.local ? '仅在此浏览器记录通关；不保存每轮路线。' :
        '无法使用本机存档。未保存的通关进度只保留到本页关闭或刷新。';

      drawBoard();
      drawTimeline();
      feedback.classList.toggle('is-success', finished);
      feedback.classList.toggle('is-spent', run.phase === 'spent');
      feedback.textContent = message;
    }

    function setHash(index, replace) {
      const { hash } = ROOMS[index];
      if (win.location.hash === hash) return;
      if (replace) {
        try {
          win.history.replaceState(null, '', hash);
          return;
        } catch { /* The room still works when history writes are unavailable. */ }
      }
      try { win.location.hash = hash; } catch { /* URL changes are optional. */ }
    }

    function openRoom(index, focus = false) {
      roomIndex = index;
      const room = ROOMS[index];
      run = newRun(room);
      restored = index < progress.cleared;
      reviewBeat.value = '';
      byId('room-code').textContent = `房间 ${twoDigits(room.number)} / ${twoDigits(ROOMS.length)} · ${room.topic}`;
      roomTitle.textContent = room.title;
      byId('room-goal').textContent = room.goal;
      initializeBoard(room);
      render(restored ? (index === ROOMS.length - 1 ? '四间房已通关。可重玩本房，或返回游戏厅。' :
        '本房已通关。可继续下一间，或重玩本房。') : room.tip);
      if (focus) roomTitle.focus();
    }

    function syncHash() {
      const index = roomFromHash(win.location.hash, progress.cleared);
      setHash(index, true);
      if (index !== roomIndex) openRoom(index);
    }

    function selectRoom(index) {
      if (index > progress.cleared || !ROOMS[index] || index === roomIndex) return;
      setHash(index, false);
      openRoom(index, true);
    }

    function move(command) {
      if (done()) return;
      const updated = advance(run, command);
      if (updated === run) return;
      const wasOnMove = Object.values(moveButtons).includes(doc.activeElement);
      run = updated;
      reviewBeat.value = '';
      if (run.phase === 'won') {
        progress.complete(roomIndex);
        const winMessage = roomIndex === ROOMS.length - 1 ? '四间房已通关。实验完成。' : '同步成功，本房已通关。';
        render(`${winMessage}${progress.local ? '' : '本次通关仅保留在当前页面。'}`);
        (next.hidden ? finish : next).focus({ preventScroll: true });
      } else {
        render(beatMessage(run));
        if (run.phase === 'spent' && wasOnMove) (seal.disabled ? retry : seal).focus({ preventScroll: true });
      }
    }

    function record() {
      if (done()) return;
      const recorded = sealRun(run);
      if (recorded === run) {
        if (run.echoes.length === ECHO_IDS.length) feedback.textContent = '回声槽已满。移除一段回声会腾出槽位，并重启本轮。';
        else if (!run.beat) feedback.textContent = '先走一步或等待一拍，再封存回声。';
        return;
      }
      const id = recorded.echoes.at(-1).id;
      run = recorded;
      reviewBeat.value = '';
      render(`回声 ${id} 已封存，全员回到起点。${run.echoes.length === ECHO_IDS.length ? '回声槽已满。' : ''}`);
      board.focus({ preventScroll: true });
    }

    function retryRound() {
      if (done()) return;
      const restarted = retryRun(run);
      if (restarted === run) return;
      run = restarted;
      reviewBeat.value = '';
      render('本轮已重试，已有回声保留。');
      board.focus({ preventScroll: true });
    }

    picks.forEach((button, index) => button.addEventListener('click', () => selectRoom(index)));
    for (const [command, button] of Object.entries(moveButtons)) button.addEventListener('click', event => {
      move(command);
      // Pointer users can switch to keyboard shortcuts without Space re-clicking the last arrow.
      if (event.detail > 0 && run.phase === 'playing') board.focus({ preventScroll: true });
    });
    seal.addEventListener('click', record);
    retry.addEventListener('click', retryRound);
    erase.forEach((button, index) => button.addEventListener('click', () => {
      if (done()) return;
      const id = ECHO_IDS[index];
      const updated = removeEcho(run, id);
      if (updated === run) return;
      run = updated;
      reviewBeat.value = '';
      render(`已移除回声 ${id}，本轮重启。`);
      board.focus();
    }));
    next.addEventListener('click', () => { if (done()) selectRoom(roomIndex + 1); });
    replay.addEventListener('click', () => {
      if (!done()) return;
      restored = false;
      run = newRun(run.room);
      reviewBeat.value = '';
      render(run.room.tip);
      board.focus({ preventScroll: true });
    });
    reviewBeat.addEventListener('change', drawTimeline);
    win.addEventListener('hashchange', syncHash);
    doc.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || done() ||
          event.target?.closest?.('select, input, textarea, [contenteditable]')) return;
      const key = event.key.toLowerCase();
      // Keep native Space activation for a focused control. Period is an alternate wait shortcut.
      if (key === ' ' && event.target?.closest?.('button, a, summary')) return;
      if (!keys.has(key) && key !== 'e' && key !== 'r') return;
      event.preventDefault();
      if (event.repeat) return;
      if (key === 'e') record();
      else if (key === 'r') retryRound();
      else move(keys.get(key));
    });

    syncHash();
    byId('workbench').hidden = false;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = Object.freeze({ BEATS, SAVE_KEY, ECHO_IDS, ROOMS, newRun, advance, canSeal, sealRun,
      retryRun, removeEcho, activeCircuits, timeline, openProgress, roomFromHash });
  }
  if (typeof document !== 'undefined') mount(document, window);
})();
