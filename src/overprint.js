/* Overprint Work Order A01: a deterministic, no-save print-order puzzle. */
(function () {
  'use strict';

  const WIDTH = 4;
  const HEIGHT = 4;
  const SIZE = WIDTH * HEIGHT;
  const INITIAL = {H: 1, D: 4};
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
  const LABELS = {'.': '留白', H: '横纹', D: '实点'};
  const MARKS = {'.': '·', H: 'H', D: 'D'};
  const CLASSES = {'.': 'blank', H: 'stripe', D: 'dot'};
  const FIRST_HINT = '后印覆盖先印；空格要留白。';
  const LEVEL_HASH = '#level/01';
  const DIRECTIONS = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};

  function cloneRemaining(remaining) {
    return {H: remaining.H, D: remaining.D};
  }

  function create() {
    return {
      board: Array(SIZE).fill('.'),
      remaining: cloneRemaining(INITIAL),
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
    return state.board.flatMap((current, index) => current === TARGET[index] ? [] : [{
      index, ...coordinate(index), current, target: TARGET[index]
    }]);
  }

  function evaluate(board, remaining) {
    if (board.every((value, index) => value === TARGET[index])) return {phase: 'won', reason: ''};
    if (board.some((value, index) => TARGET[index] === '.' && value !== '.')) return {phase: 'lost', reason: 'blank'};
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
    const cells = footprint.map(cell => {
      const index = (cell.row - 1) * WIDTH + cell.column - 1;
      return {...cell, index, current: state.board[index], target: TARGET[index]};
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
    const outcome = evaluate(board, remaining);
    const next = {
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
    const outcome = evaluate(snapshot.board, snapshot.remaining);
    return {
      ok: true,
      state: {
        board: snapshot.board.slice(),
        remaining: cloneRemaining(snapshot.remaining),
        history: state.history.slice(0, -1),
        phase: outcome.phase,
        reason: outcome.reason
      },
      note: '已撤销上一笔印刷，印面和版数均已恢复。'
    };
  }

  function restart() { return create(); }

  function mount(doc, win) {
    const byId = id => doc.getElementById(id);
    const workBoard = byId('work-board');
    if (!workBoard) return;
    const workCells = [];
    const stampButton = byId('stamp');
    const undoButton = byId('undo');
    const restartButton = byId('restart');
    const plateButtons = {D: byId('plate-D'), H: byId('plate-H')};
    let state = create();
    let selected = 'D';
    let anchor = null;
    let cursor = 0;
    let message = FIRST_HINT;

    function normalizeHash() {
      if (win.location.hash === LEVEL_HASH) return;
      try { win.history.replaceState(win.history.state, '', LEVEL_HASH); }
      catch { try { win.location.hash = LEVEL_HASH; } catch { /* URL is optional. */ } }
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
          const target = TARGET[index];
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
          workCells.push({cell, mark, ghost});
        }
      }
    }

    function renderBoard(plan) {
      workCells.forEach(({cell, mark, ghost}, index) => {
        const current = state.board[index];
        const target = TARGET[index];
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
      const plan = anchor === null ? null : preview(state, selected, anchor);
      renderBoard(plan);
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

    function availablePlate(remaining) { return remaining.D ? 'D' : 'H'; }

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
      resetWorkspace(restart(), 'D', `已重开 A01。${FIRST_HINT}`);
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
    win.addEventListener('hashchange', normalizeHash);
    win.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      const active = doc.activeElement;
      resetWorkspace(create(), 'D', FIRST_HINT);
      if (workBoard.contains(active) || active === undoButton || active === stampButton) workCells[0].cell.focus({preventScroll: true});
    });
    normalizeHash();
    makeBoards();
    render();
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = {TARGET, create, preview, stamp, undo, restart, differences};
  } else if (typeof document !== 'undefined') mount(document, window);
}());
