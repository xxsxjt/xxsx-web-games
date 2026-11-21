/* Overprint Work Orders A01–A06: one deterministic model, no saved progress. */
(function () {
  'use strict';

  const WIDTH = 4;
  const HEIGHT = 4;
  const SIZE = WIDTH * HEIGHT;
  const PLATES = {
    H: {name: '横纹版', description: '盖本格、右格和下格。', offsets: [[0, 0], [0, 1], [1, 0]]},
    D: {name: '实点版', description: '盖本格与下格。', offsets: [[0, 0], [1, 0]]}
  };
  const TARGET = Object.freeze([
    '.', '.', 'D', '.',
    '.', 'D', 'H', 'D',
    '.', 'D', 'D', 'D',
    '.', '.', 'D', '.'
  ]);
  function order(id, name, initial, target, focus, hint) {
    return Object.freeze({
      id, name, hash: `#level/${id.slice(1)}`, initial: Object.freeze(initial),
      target: Object.freeze(target), focus, hint
    });
  }
  const LEVELS = Object.freeze([
    order('A01', '搭版', {H: 1, D: 4}, TARGET,
      '入门搭版：把中央横纹保留下来，再补齐实点。',
      '先比较两种印版的形状。横纹旁的实点可能要后补；暂时不同不等于失败，误印留白才会立即失败。'),
    order('A02', '白边练习', {H: 1, D: 2}, [
      'H', 'H', '.', 'D',
      'H', '.', '.', 'D',
      '.', '.', 'D', '.',
      '.', '.', 'D', '.'
    ], '基础留白：三块图案之间的空隙也必须保持干净。',
    '不必急着覆盖。先看一张版的每个落点，包括横纹版缺掉的右下角；分开的图案可以按不同先后完成。'),
    order('A03', '回墨次序', {H: 2, D: 3}, [
      'H', 'D', '.', 'D',
      'H', 'H', 'H', 'D',
      '.', 'D', '.', '.',
      '.', 'D', '.', '.'
    ], '覆盖先后：同一列里实点与横纹交替，不能一口气印完同一种版。',
    '对照相邻的横纹与实点：有的实点是底墨，有的实点要最后补。预览中的「覆盖」只说明会改写，不保证改对；独立的一列可穿插安排。'),
    order('A04', '版数分账', {H: 2, D: 3}, [
      'H', 'H', 'H', '.',
      'H', 'D', 'D', '.',
      '.', 'D', 'D', '.',
      '.', '.', 'D', '.'
    ], '库存分配：横纹要够铺满上沿，三格长的实点列也要算足版数。',
    '能合法压下不代表值得消耗。数一数哪些横纹只能由横纹版覆盖；三格长的实点列无法用一张两格版填完，重复覆盖有时是必要的。'),
    order('A05', '贴边定位', {H: 2, D: 2}, [
      '.', 'H', 'H', 'D',
      '.', 'D', '.', 'D',
      '.', 'D', 'H', 'H',
      '.', '.', 'H', '.'
    ], '边界锚位：利用最右列与最下行，但绝不让版跨出印面。',
    '锚格是印版的左上角，不是图案中心。实点版可锚在最右列；横纹版的右下角不印，所以靠近角落也可能留下干净的空格。'),
    order('A06', '错层合版', {H: 3, D: 4}, [
      'H', 'D', '.', 'D',
      'H', 'H', 'H', 'D',
      '.', 'D', 'D', 'H',
      '.', 'D', 'D', '.'
    ], '综合排印：错层覆盖、边角留白与有限库存同时交付。',
    '把样张分成会互相改写的交叠区和可以独立完成的边列。先想各格最后该由哪种版留下，再安排先后；随时可以撤销试印，不会自动替你压印。')
  ]);
  const LABELS = {'.': '留白', H: '横纹', D: '实点'};
  const MARKS = {'.': '·', H: 'H', D: 'D'};
  const CLASSES = {'.': 'blank', H: 'stripe', D: 'dot'};
  const FIRST_HINT = '后印覆盖先印；空格要留白。';
  const DIRECTIONS = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};

  function getLevel(id = 'A01') {
    return LEVELS.find(level => level.id === id) || LEVELS[0];
  }

  function levelFromHash(hash) {
    return (LEVELS.find(level => level.hash === hash) || LEVELS[0]).id;
  }

  function cloneRemaining(remaining) {
    return {H: remaining.H, D: remaining.D};
  }

  function create(id = 'A01') {
    const level = getLevel(id);
    return {
      levelId: level.id,
      board: Array(SIZE).fill('.'),
      remaining: cloneRemaining(level.initial),
      history: [],
      phase: 'playing',
      reason: ''
    };
  }

  function coordinate(index) {
    return {row: Math.floor(index / WIDTH) + 1, column: index % WIDTH + 1};
  }

  function validAnchor(anchor) {
    return Number.isInteger(anchor) && anchor >= 0 && anchor < SIZE;
  }

  function differences(state) {
    const target = getLevel(state.levelId).target;
    return state.board.flatMap((current, index) => current === target[index] ? [] : [{
      index, ...coordinate(index), current, target: target[index]
    }]);
  }

  function evaluate(board, remaining, levelId) {
    const target = getLevel(levelId).target;
    if (board.every((value, index) => value === target[index])) return {phase: 'won', reason: ''};
    if (board.some((value, index) => target[index] === '.' && value !== '.')) return {phase: 'lost', reason: 'blank'};
    if (remaining.H === 0 && remaining.D === 0) return {phase: 'lost', reason: 'exhausted'};
    return {phase: 'playing', reason: ''};
  }

  function describeCell({row, column}) {
    return `第 ${row} 行第 ${column} 列`;
  }

  function describeDifference(cell) {
    return `${describeCell(cell)}现在是${LABELS[cell.current]}，样张要${LABELS[cell.target]}。`;
  }

  function preview(state, type, anchor) {
    if (!state || state.phase !== 'playing') return {ok: false, edge: '', cells: [], note: '本单已经结束，可撤销或重开。'};
    if (typeof type !== 'string' || !Object.hasOwn(PLATES, type)) return {ok: false, edge: '', cells: [], note: '请先选择一张印版。'};
    if (!Number.isInteger(state.remaining[type]) || state.remaining[type] <= 0) {
      return {ok: false, edge: '', cells: [], note: `${PLATES[type].name}已用完，请选择还有余量的印版。`};
    }
    if (!validAnchor(anchor)) return {ok: false, edge: '', cells: [], note: '请在工作印面上选择一格。'};
    const origin = coordinate(anchor);
    const footprint = PLATES[type].offsets.map(([dy, dx]) => ({row: origin.row + dy, column: origin.column + dx}));
    const edges = [];
    if (footprint.some(cell => cell.column > WIDTH)) edges.push('右边');
    if (footprint.some(cell => cell.row > HEIGHT)) edges.push('下边');
    if (edges.length) {
      const edge = edges.join('和');
      return {ok: false, edge, cells: [], note: `印版越出${edge}，请换一个锚格。`};
    }
    const target = getLevel(state.levelId).target;
    const cells = footprint.map(cell => {
      const index = (cell.row - 1) * WIDTH + cell.column - 1;
      return {...cell, index, current: state.board[index], target: target[index]};
    });
    const blankHits = cells.filter(cell => cell.target === '.');
    const overwrites = cells.filter(cell => cell.current !== '.');
    const mismatches = cells.filter(cell => cell.target !== '.' && cell.target !== type);
    let note = `落印 ${cells.length} 格${overwrites.length ? `，其中覆盖 ${overwrites.length} 格` : ''}。`;
    if (blankHits.length) note = `会印到留白：${blankHits.map(describeCell).join('、')}。确认会使本单失败。`;
    else if (mismatches.length) note += `${mismatches.length} 格会暂时不同，可再覆盖。`;
    return {ok: true, type, anchor, cells, blankHits, overwrites, mismatches, note};
  }

  function stamp(state, type, anchor) {
    const checked = preview(state, type, anchor);
    if (!checked.ok) return {ok: false, state, note: checked.note, preview: checked};
    const board = state.board.slice();
    checked.cells.forEach(cell => { board[cell.index] = type; });
    const remaining = cloneRemaining(state.remaining);
    remaining[type]--;
    const outcome = evaluate(board, remaining, state.levelId);
    const next = {
      levelId: getLevel(state.levelId).id,
      board,
      remaining,
      history: state.history.concat([{board: state.board.slice(), remaining: cloneRemaining(state.remaining)}]),
      phase: outcome.phase,
      reason: outcome.reason
    };
    let note;
    if (outcome.phase === 'won') note = `样张一致，${SIZE} 格全部匹配。`;
    else if (outcome.reason === 'blank') note = `留白误印：${checked.blankHits.map(describeCell).join('、')}。可以撤销。`;
    else {
      const pending = differences(next);
      const first = pending.find(cell => checked.mismatches.some(hit => hit.index === cell.index)) || pending[0];
      note = outcome.reason === 'exhausted' ? `版数用尽，还差 ${pending.length} 格；可以撤销。` :
        `已压印${PLATES[type].name}，还差 ${pending.length} 格。`;
      note += describeDifference(first);
    }
    return {ok: true, state: next, note, preview: checked};
  }

  function undo(state) {
    if (!state || !state.history.length) return {ok: false, state, note: '没有可撤销的印刷。'};
    const snapshot = state.history[state.history.length - 1];
    const outcome = evaluate(snapshot.board, snapshot.remaining, state.levelId);
    return {
      ok: true,
      state: {
        levelId: getLevel(state.levelId).id,
        board: snapshot.board.slice(),
        remaining: cloneRemaining(snapshot.remaining),
        history: state.history.slice(0, -1),
        phase: outcome.phase,
        reason: outcome.reason
      },
      note: '已撤销上一笔印刷，印面和版数均已恢复。'
    };
  }

  function restart(stateOrId) {
    return create(typeof stateOrId === 'object' && stateOrId ? stateOrId.levelId : stateOrId);
  }

  function mount(doc, win) {
    const byId = id => doc.getElementById(id);
    const workBoard = byId('work-board');
    if (!workBoard) return;
    const workCells = [];
    const stampButton = byId('stamp');
    const undoButton = byId('undo');
    const restartButton = byId('restart');
    const plateButtons = {D: byId('plate-D'), H: byId('plate-H')};
    const levelButtons = LEVELS.map(level => byId(`level-${level.id}`));
    let state = create(levelFromHash(win.location.hash));
    let selected = 'D';
    let anchor = null;
    let cursor = 0;
    let message = FIRST_HINT;

    function normalizeHash() {
      const hash = getLevel(state.levelId).hash;
      if (win.location.hash === hash) return;
      try { win.history.replaceState(win.history.state, '', hash); }
      catch { try { win.location.hash = hash; } catch { /* URL is optional. */ } }
    }

    function appendRow(board) {
      const row = doc.createElement('div');
      row.className = 'board-row';
      row.setAttribute('role', 'row');
      board.append(row);
      return row;
    }

    function makeBoards() {
      const targetBoard = byId('target-board');
      for (let row = 0; row < HEIGHT; row++) {
        const sampleRow = appendRow(targetBoard);
        const workRow = appendRow(workBoard);
        for (let column = 0; column < WIDTH; column++) {
          const index = row * WIDTH + column;
          const target = getLevel(state.levelId).target[index];
          const sample = doc.createElement('div');
          sample.className = `target-cell ink-${CLASSES[target]}`;
          sample.setAttribute('role', 'cell');
          sample.setAttribute('aria-label', `${describeCell(coordinate(index))}，${LABELS[target]}`);
          sample.textContent = MARKS[target];
          sampleRow.append(sample);

          const cell = doc.createElement('div');
          cell.setAttribute('data-cell', String(index));
          cell.setAttribute('role', 'gridcell');
          const mark = doc.createElement('span');
          mark.setAttribute('aria-hidden', 'true');
          const targetMark = doc.createElement('small');
          targetMark.className = 'target-mark';
          targetMark.textContent = target === '.' ? '空' : MARKS[target];
          targetMark.setAttribute('aria-hidden', 'true');
          const ghost = doc.createElement('small');
          ghost.className = 'preview-mark';
          ghost.setAttribute('aria-hidden', 'true');
          cell.append(mark, targetMark, ghost);
          workRow.append(cell);
          workCells.push({cell, mark, ghost, targetMark, sample});
        }
      }
    }

    function renderBoard(plan) {
      const targetSheet = getLevel(state.levelId).target;
      workCells.forEach(({cell, mark, ghost, targetMark, sample}, index) => {
        const current = state.board[index];
        const target = targetSheet[index];
        sample.className = `target-cell ink-${CLASSES[target]}`;
        sample.setAttribute('aria-label', `${describeCell(coordinate(index))}，${LABELS[target]}`);
        sample.textContent = MARKS[target];
        targetMark.textContent = target === '.' ? '空' : MARKS[target];
        const hit = plan?.ok && plan.cells.some(item => item.index === index);
        const risk = hit && target === '.';
        const covering = hit && current !== '.';
        const change = !hit ? '' : risk ? `，将误印${LABELS[selected]}` : covering ?
          `，将覆盖为${LABELS[selected]}` : `，将印上${LABELS[selected]}`;
        const description = `${describeCell(coordinate(index))}，当前${LABELS[current]}，目标${LABELS[target]}${change}`;
        cell.className = 'work-cell';
        cell.tabIndex = index === cursor ? 0 : -1;
        cell.setAttribute('aria-label', description);
        if (index === anchor) cell.classList.add('is-anchor');
        if (current !== target) cell.classList.add('is-different');
        if (hit) cell.classList.add('is-preview');
        if (risk) cell.classList.add('is-risk');
        mark.className = `mark ink-${CLASSES[current]}`;
        mark.textContent = MARKS[current];
        ghost.hidden = !hit;
        ghost.textContent = hit ? `${risk ? '!' : covering ? '→' : '+'}${selected}` : '';
      });
    }

    function render() {
      const level = getLevel(state.levelId);
      const plan = anchor === null ? null : preview(state, selected, anchor);
      renderBoard(plan);
      updateText('level-label', `${level.id} / ${level.name}`);
      updateText('print-bed-label', `PRINT BED / ${level.id.slice(1)}`);
      updateText('level-focus', level.focus);
      updateText('level-hint', level.hint);
      levelButtons.forEach((button, index) => {
        button.disabled = false;
        button.setAttribute('aria-pressed', String(LEVELS[index].id === level.id));
      });
      updateText('difference-count', differences(state).length);
      updateText('history-count', state.history.length);
      updateText('phase-label', state.phase === 'won' ? '样张一致' : state.phase === 'lost' ? (state.reason === 'blank' ? '留白误印' : '版数用尽') : '进行中');
      updateText('feedback', message);
      byId('feedback').dataset.phase = state.phase;
      updateText('selected-plate', selected ? `${PLATES[selected].name}：${PLATES[selected].description}` :
        state.phase === 'playing' ? '请选择还有余量的印版。' : '本单已结束，可撤销或重开。');
      updateText('preview-note', plan?.note || (state.phase !== 'playing' ? '无待压印。' : selected ?
        '点工作印面的一格预览，再按「压印」。' : '先选一张印版，再预览落点。'));
      byId('preview-note').dataset.kind = plan?.blankHits?.length ? 'risk' : plan?.edge ? 'edge' : 'normal';
      stampButton.disabled = !plan?.ok;
      undoButton.disabled = !state.history.length;
      restartButton.disabled = false;
      for (const [type, button] of Object.entries(plateButtons)) {
        updateText(`plate-${type}-stock`, state.remaining[type]);
        button.disabled = state.phase !== 'playing' || state.remaining[type] <= 0;
        button.setAttribute('aria-pressed', String(selected === type));
      }
    }

    function updateText(id, value) {
      const node = byId(id);
      const text = String(value);
      if (node.textContent !== text) node.textContent = text;
    }

    function choosePlate(type) {
      if (type === selected) return;
      selected = type;
      anchor = null;
      render();
    }

    function chooseCell(index) {
      if (!validAnchor(index)) return;
      cursor = index;
      if (state.phase === 'playing' && selected) anchor = index;
      render();
      workCells[cursor].cell.focus({preventScroll: true});
    }

    function moveFocus(rowDelta, columnDelta) {
      const {row, column} = coordinate(cursor);
      const nextRow = row + rowDelta, nextColumn = column + columnDelta;
      if (nextRow < 1 || nextRow > HEIGHT || nextColumn < 1 || nextColumn > WIDTH) return;
      workCells[cursor].cell.tabIndex = -1;
      cursor = (nextRow - 1) * WIDTH + nextColumn - 1;
      workCells[cursor].cell.tabIndex = 0;
      workCells[cursor].cell.focus();
    }

    function resetWorkspace(next, type, note) {
      state = next;
      selected = type;
      anchor = null;
      cursor = 0;
      message = note;
      render();
    }

    function availablePlate(remaining) { return remaining.D ? 'D' : remaining.H ? 'H' : ''; }

    function changeLevel(id, focusButton) {
      const level = getLevel(id);
      const changed = state.levelId !== level.id;
      const active = doc.activeElement;
      if (changed) {
        resetWorkspace(create(level.id), 'D', `已切换到 ${level.id}，从空白工单开始。${FIRST_HINT}`);
        byId('level-hints').open = false;
      }
      normalizeHash();
      if (focusButton) byId(`level-${level.id}`).focus({preventScroll: true});
      else if (changed && (workBoard.contains(active) || active === undoButton || active === stampButton)) {
        workCells[0].cell.focus({preventScroll: true});
      }
    }

    levelButtons.forEach((button, index) => {
      button.addEventListener('click', () => changeLevel(LEVELS[index].id, true));
    });

    for (const [type, button] of Object.entries(plateButtons)) {
      button.addEventListener('click', () => { if (!button.disabled) choosePlate(type); });
    }
    stampButton.addEventListener('click', event => {
      const result = stamp(state, selected, anchor);
      if (!result.ok) return;
      state = result.state;
      cursor = anchor;
      anchor = null;
      message = result.note;
      if (state.phase !== 'playing' || !state.remaining[selected]) selected = '';
      render();
      const nextFocus = state.phase !== 'playing' ? undoButton : selected ? workCells[cursor].cell : plateButtons[availablePlate(state.remaining)];
      nextFocus.focus({preventScroll: event.detail > 0});
    });
    undoButton.addEventListener('click', () => {
      const result = undo(state);
      if (!result.ok) return;
      resetWorkspace(result.state, availablePlate(result.state.remaining), result.note);
      workCells[0].cell.focus();
    });
    restartButton.addEventListener('click', () => {
      resetWorkspace(restart(state), 'D', `已重开 ${state.levelId}。${FIRST_HINT}`);
      workCells[0].cell.focus();
    });
    workBoard.addEventListener('click', event => {
      const cell = event.target.closest?.('[data-cell]');
      if (cell) chooseCell(Number(cell.dataset.cell));
    });
    workBoard.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (Object.hasOwn(DIRECTIONS, event.key)) {
        event.preventDefault();
        moveFocus(...DIRECTIONS[event.key]);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) chooseCell(cursor);
      }
    });
    win.addEventListener('hashchange', () => changeLevel(levelFromHash(win.location.hash), false));
    win.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      const active = doc.activeElement;
      resetWorkspace(create(levelFromHash(win.location.hash)), 'D', '返回页面后已恢复为空白工单。' + FIRST_HINT);
      normalizeHash();
      if (workBoard.contains(active) || active === undoButton || active === stampButton) workCells[0].cell.focus({preventScroll: true});
    });
    normalizeHash();
    makeBoards();
    render();
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {TARGET, LEVELS, getLevel, levelFromHash, create, preview, stamp, undo, restart, differences};
  } else if (typeof document !== 'undefined') mount(document, window);
}());
