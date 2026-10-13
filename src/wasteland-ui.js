/* wasteland-ui.js – 废土杂货铺 UI 层
 * 纯原生 JS IIFE，暴露 window.WastelandUI
 * UI 无状态：只接受 state 参数渲染，事件通过 callbacks 回传
 */
(function () {
  'use strict';

  // ── 物品类型配置 ──────────────────────────────────────────
  var ITEM_TYPES = {
    weapon:   { icon: '🔫', color: 'var(--wl-weapon)',   label: '武器' },
    ammo:     { icon: '📦', color: 'var(--wl-ammo)',     label: '弹药' },
    food:     { icon: '🥫', color: 'var(--wl-food)',     label: '食物' },
    water:    { icon: '💧', color: 'var(--wl-water)',    label: '水' },
    medicine: { icon: '💊', color: 'var(--wl-medicine)', label: '药品' },
    chemical: { icon: '⚗️',  color: 'var(--wl-chemical)',label: '化学品' },
    metal:    { icon: '⚙️',  color: 'var(--wl-metal)',   label: '金属' },
    elec:     { icon: '🔋', color: 'var(--wl-elec)',     label: '电子' },
    cloth:    { icon: '🧥', color: 'var(--wl-cloth)',    label: '布料' },
    alcohol:  { icon: '🍾', color: 'var(--wl-alcohol)',  label: '酒' },
    drug:     { icon: '💉', color: 'var(--wl-drug)',     label: '针剂' },
    tool:     { icon: '🔧', color: 'var(--wl-tool)',     label: '工具' },
    fake:     { icon: '🎭', color: 'var(--wl-fake)',     label: '假货' },
    misc:     { icon: '📋', color: 'var(--wl-misc)',     label: '杂项' },
  };

  // ── 辅助函数 ─────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function typeConf(type) {
    return ITEM_TYPES[type] || ITEM_TYPES.misc;
  }

  function el(tag, attrs, ...children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'style') node.style.cssText = attrs[k];
        else if (k.startsWith('data-')) node.dataset[k.slice(5)] = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    children.forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    return node;
  }

  // ── 1. 格子仓库 renderGrid ────────────────────────────────
  /**
   * @param {HTMLElement} container
   * @param {Object} gridState  { cols, rows, cells: [{id,type,w,h,x,y,name,qty}], selectedId }
   * @param {Object} callbacks  { onSelect(id), onDrop({itemId,toX,toY}), onContextMenu(id,evt) }
   */
  function renderGrid(container, gridState, callbacks) {
    var cols = gridState.cols || 10;
    var rows = gridState.rows || 8;
    var cells = gridState.cells || [];
    var selectedId = gridState.selectedId || null;
    var cb = callbacks || {};

    // Build occupation map
    var occupied = {}; // "x,y" → item
    cells.forEach(function (item) {
      for (var dy = 0; dy < (item.h || 1); dy++) {
        for (var dx = 0; dx < (item.w || 1); dx++) {
          occupied[(item.x + dx) + ',' + (item.y + dy)] = item;
        }
      }
    });

    container.innerHTML = '';
    container.className = (container.className || '').replace(/\bwl-grid\b/g, '').trim() + ' wl-grid';
    container.style.setProperty('--wl-grid-cols', cols);
    container.style.setProperty('--wl-grid-rows', rows);

    // Track which cells have already rendered an item anchor
    var rendered = {};

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var key = col + ',' + row;
        var item = occupied[key];

        if (item && item.x === col && item.y === row) {
          // Anchor cell (top-left of item)
          rendered[item.id] = true;
          var conf = typeConf(item.type);
          var isSelected = item.id === selectedId;

          var cellDiv = el('div', {
            class: 'wl-cell wl-cell--item' + (isSelected ? ' wl-cell--selected' : ''),
            style: [
              'grid-column: ' + (col + 1) + ' / span ' + (item.w || 1),
              'grid-row: ' + (row + 1) + ' / span ' + (item.h || 1),
              '--wl-item-color: ' + conf.color,
            ].join(';'),
            draggable: 'true',
            'data-id': item.id,
            'data-x': item.x,
            'data-y': item.y,
            tabindex: '0',
            'aria-label': esc(item.name || conf.label) + (item.qty > 1 ? ' ×' + item.qty : ''),
            role: 'button',
          });

          var iconSpan = el('span', { class: 'wl-cell__icon', 'aria-hidden': 'true' }, conf.icon);
          var nameSpan = el('span', { class: 'wl-cell__name' }, esc(item.name || conf.label));
          cellDiv.appendChild(iconSpan);
          cellDiv.appendChild(nameSpan);
          if (item.qty > 1) {
            cellDiv.appendChild(el('span', { class: 'wl-cell__qty' }, '×' + item.qty));
          }
          if (item.fake) {
            cellDiv.appendChild(el('span', { class: 'wl-cell__badge wl-cell__badge--fake', title: '假货' }, '⚠'));
          }

          // Pointer / drag events
          on(cellDiv, 'click', function (capturedItem) {
            return function (e) {
              e.stopPropagation();
              if (cb.onSelect) cb.onSelect(capturedItem.id);
            };
          }(item));

          on(cellDiv, 'keydown', function (capturedItem) {
            return function (e) {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (cb.onSelect) cb.onSelect(capturedItem.id);
              }
            };
          }(item));

          on(cellDiv, 'contextmenu', function (capturedItem) {
            return function (e) {
              e.preventDefault();
              if (cb.onContextMenu) cb.onContextMenu(capturedItem.id, e);
            };
          }(item));

          on(cellDiv, 'dragstart', function (capturedItem) {
            return function (e) {
              e.dataTransfer.setData('text/plain', capturedItem.id);
              e.dataTransfer.effectAllowed = 'move';
              cellDiv.classList.add('wl-cell--dragging');
            };
          }(item));

          on(cellDiv, 'dragend', function () {
            cellDiv.classList.remove('wl-cell--dragging');
          });

          container.appendChild(cellDiv);

        } else if (!item) {
          // Empty cell — drop target
          var emptyDiv = el('div', {
            class: 'wl-cell wl-cell--empty',
            style: 'grid-column:' + (col + 1) + ';grid-row:' + (row + 1),
            'data-x': col,
            'data-y': row,
          });

          on(emptyDiv, 'dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            emptyDiv.classList.add('wl-cell--dragover');
          });
          on(emptyDiv, 'dragleave', function () {
            emptyDiv.classList.remove('wl-cell--dragover');
          });
          on(emptyDiv, 'drop', function (capturedCol, capturedRow) {
            return function (e) {
              e.preventDefault();
              emptyDiv.classList.remove('wl-cell--dragover');
              var itemId = e.dataTransfer.getData('text/plain');
              if (cb.onDrop) cb.onDrop({ itemId: itemId, toX: capturedCol, toY: capturedRow });
            };
          }(col, row));

          // Pointer drop for touch / non-drag flow
          on(emptyDiv, 'click', function (capturedCol, capturedRow) {
            return function () {
              if (cb.onDropTarget) cb.onDropTarget(capturedCol, capturedRow);
            };
          }(col, row));

          container.appendChild(emptyDiv);
        }
        // Occupied continuation cells are skipped (grid spans cover them)
      }
    }
  }

  // ── 2. 物品详情 renderItemDetail ──────────────────────────
  /**
   * @param {HTMLElement} panel
   * @param {Object} item   { id, name, type, w, h, weight, quality, purity, expiry,
   *                          authentic, origin, notes, fake, identified }
   * @param {Array}  tools  可用工具列表 [{ id, name, targetType }]
   * @param {Number} skill  0-100 鉴定技能值（对应类型）
   */
  function renderItemDetail(panel, item, tools, skill) {
    var conf = typeConf(item.type);
    var cb_detect = panel._wlDetectCb || null; // caller sets panel._wlDetectCb before calling

    panel.innerHTML = '';
    panel.className = (panel.className || '').replace(/\bwl-detail\b/g, '').trim() + ' wl-detail';

    // Header
    var hdr = el('div', { class: 'wl-detail__header' });
    var iconWrap = el('div', {
      class: 'wl-detail__icon',
      style: '--wl-item-color:' + conf.color,
      'aria-hidden': 'true',
    }, conf.icon);
    var titleWrap = el('div', { class: 'wl-detail__title-wrap' });
    titleWrap.appendChild(el('h2', { class: 'wl-detail__name' }, esc(item.name)));
    titleWrap.appendChild(el('span', { class: 'wl-detail__type-badge' }, conf.icon + ' ' + conf.label));
    if (item.fake) {
      titleWrap.appendChild(el('span', { class: 'wl-detail__fake-badge' }, '⚠ 已标记假货'));
    }
    hdr.appendChild(iconWrap);
    hdr.appendChild(titleWrap);
    panel.appendChild(hdr);

    // Stats grid
    var stats = [
      ['尺寸', (item.w || 1) + '×' + (item.h || 1) + ' 格'],
      ['重量', item.weight != null ? item.weight + ' kg' : '—'],
      ['品质', item.quality != null ? item.quality + '%' : '—'],
      item.purity != null ? ['纯度', item.purity + '%'] : null,
      item.expiry != null ? ['保质期', item.expiry + ' 天'] : null,
      ['来源', item.origin || '未知'],
    ].filter(Boolean);

    var grid = el('div', { class: 'wl-detail__stats' });
    stats.forEach(function (pair) {
      var cell = el('div', { class: 'wl-detail__stat' });
      cell.appendChild(el('span', { class: 'wl-detail__stat-label' }, pair[0]));
      cell.appendChild(el('b', { class: 'wl-detail__stat-value' }, pair[1]));
      grid.appendChild(cell);
    });
    panel.appendChild(grid);

    // 真实性 / 鉴定状态
    var authSection = el('div', { class: 'wl-detail__auth' });
    if (item.identified) {
      var authClass = item.authentic === true ? 'wl-detail__auth-result--ok'
                    : item.authentic === false ? 'wl-detail__auth-result--fake'
                    : 'wl-detail__auth-result--unknown';
      var authText = item.authentic === true ? '✔ 正品（已确认）'
                   : item.authentic === false ? '✘ 假货（已确认）'
                   : '？ 真实性未知';
      authSection.appendChild(el('span', { class: 'wl-detail__auth-result ' + authClass }, authText));
    } else {
      // Skill estimate
      var skillLevel = skill || 0;
      var estimateText;
      if (skillLevel === 0) {
        estimateText = '无估算能力';
      } else if (skillLevel < 30) {
        estimateText = '估算：不确定（技能不足）';
      } else if (skillLevel < 70) {
        estimateText = '估算：' + (item._estimate != null ? item._estimate : '—');
      } else {
        estimateText = '估算（高精度）：' + (item._estimate != null ? item._estimate : '—');
      }
      authSection.appendChild(el('span', { class: 'wl-detail__auth-estimate' }, '🔍 ' + estimateText));
    }
    panel.appendChild(authSection);

    // Notes
    if (item.notes) {
      var noteWrap = el('div', { class: 'wl-detail__notes' });
      noteWrap.appendChild(el('span', { class: 'wl-detail__notes-label' }, '📝 鉴定笔记'));
      noteWrap.appendChild(el('p', { class: 'wl-detail__notes-body' }, esc(item.notes)));
      panel.appendChild(noteWrap);
    }

    // Tool detection buttons
    var matchingTools = (tools || []).filter(function (t) {
      return !t.targetType || t.targetType === item.type;
    });
    if (matchingTools.length > 0) {
      var toolSection = el('div', { class: 'wl-detail__tools' });
      toolSection.appendChild(el('span', { class: 'wl-detail__tools-label' }, '工具检测'));
      var toolBtns = el('div', { class: 'wl-detail__tool-btns' });
      matchingTools.forEach(function (tool) {
        var btn = el('button', { class: 'wl-btn wl-btn--tool', type: 'button' },
          '🔬 ' + esc(tool.name));
        on(btn, 'click', function () {
          if (panel._wlDetectCb) panel._wlDetectCb(item.id, tool.id);
        });
        toolBtns.appendChild(btn);
      });
      toolSection.appendChild(toolBtns);
      panel.appendChild(toolSection);
    } else {
      panel.appendChild(
        el('p', { class: 'wl-detail__no-tools' }, '暂无可用检测工具')
      );
    }
  }

  // ── 3. 店铺主界面 renderShopFloor ─────────────────────────
  /**
   * @param {HTMLElement} container
   * @param {Object} state  { day, cash, events:[{id,hour,type,label,desc,resolved}],
   *                          prices:[{id,name,type,retail,purchase}], inventory:[...] }
   * @param {Object} callbacks  { onSetPrice(id,field,value), onEndDay(), onResolveEvent(id) }
   */
  function renderShopFloor(container, state, callbacks) {
    var cb = callbacks || {};
    container.innerHTML = '';
    container.className = (container.className || '').replace(/\bwl-shop\b/g, '').trim() + ' wl-shop';

    // ── 顶部信息栏 ──
    var topbar = el('div', { class: 'wl-shop__topbar' });
    topbar.appendChild(el('span', { class: 'wl-shop__day' }, '第 ' + (state.day || 1) + ' 天'));
    topbar.appendChild(el('span', { class: 'wl-shop__cash' }, '💰 ' + (state.cash || 0).toLocaleString() + ' 元'));
    container.appendChild(topbar);

    // ── 今日客流事件 ──
    var evSection = el('section', { class: 'wl-shop__events', 'aria-label': '今日客流事件' });
    evSection.appendChild(el('h3', { class: 'wl-section-title' }, '今日事件'));
    var events = state.events || [];
    if (events.length === 0) {
      evSection.appendChild(el('p', { class: 'wl-empty' }, '今天暂无事件，客流正常。'));
    } else {
      var evList = el('div', { class: 'wl-event-list' });
      events.forEach(function (ev) {
        var evCard = el('div', {
          class: 'wl-event-card' + (ev.resolved ? ' wl-event-card--resolved' : ''),
          'data-type': ev.type || 'default',
        });
        var evHead = el('div', { class: 'wl-event-card__head' });
        evHead.appendChild(el('span', { class: 'wl-event-card__hour' }, ev.hour != null ? ev.hour + ':00' : '—'));
        evHead.appendChild(el('span', { class: 'wl-event-card__label' }, esc(ev.label || ev.type)));
        if (ev.resolved) {
          evHead.appendChild(el('span', { class: 'wl-event-card__done' }, '✔'));
        }
        evCard.appendChild(evHead);
        if (ev.desc) {
          evCard.appendChild(el('p', { class: 'wl-event-card__desc' }, esc(ev.desc)));
        }
        if (!ev.resolved && cb.onResolveEvent) {
          var resolveBtn = el('button', { class: 'wl-btn wl-btn--sm', type: 'button' }, '处理');
          on(resolveBtn, 'click', function (capturedId) {
            return function () { cb.onResolveEvent(capturedId); };
          }(ev.id));
          evCard.appendChild(resolveBtn);
        }
        evList.appendChild(evCard);
      });
      evSection.appendChild(evList);
    }
    container.appendChild(evSection);

    // ── 价格设置面板 ──
    var priceSection = el('section', { class: 'wl-shop__prices', 'aria-label': '价格设置' });
    priceSection.appendChild(el('h3', { class: 'wl-section-title' }, '价格设置'));
    var prices = state.prices || [];
    if (prices.length === 0) {
      priceSection.appendChild(el('p', { class: 'wl-empty' }, '仓库无在售商品。'));
    } else {
      var priceTable = el('div', { class: 'wl-price-table', role: 'table', 'aria-label': '商品价格' });
      // Header
      var pHdr = el('div', { class: 'wl-price-row wl-price-row--hdr', role: 'row' });
      ['商品', '类型', '零售价', '收购价'].forEach(function (h) {
        pHdr.appendChild(el('span', { class: 'wl-price-cell wl-price-cell--hdr', role: 'columnheader' }, h));
      });
      priceTable.appendChild(pHdr);

      prices.forEach(function (item) {
        var conf = typeConf(item.type);
        var row = el('div', { class: 'wl-price-row', role: 'row' });

        row.appendChild(el('span', { class: 'wl-price-cell wl-price-cell--name', role: 'cell' },
          conf.icon + ' ' + esc(item.name)));
        row.appendChild(el('span', { class: 'wl-price-cell wl-price-cell--type', role: 'cell' }, conf.label));

        // Retail price input
        var retailInput = el('input', {
          class: 'wl-price-input',
          type: 'number',
          min: '0',
          step: '1',
          value: item.retail != null ? String(item.retail) : '',
          'aria-label': esc(item.name) + ' 零售价',
        });
        on(retailInput, 'change', function (capturedId) {
          return function (e) {
            var v = parseFloat(e.target.value);
            if (!isNaN(v) && cb.onSetPrice) cb.onSetPrice(capturedId, 'retail', v);
          };
        }(item.id));
        var retailCell = el('span', { class: 'wl-price-cell wl-price-cell--input', role: 'cell' });
        retailCell.appendChild(retailInput);
        row.appendChild(retailCell);

        // Purchase price input
        var purchaseInput = el('input', {
          class: 'wl-price-input',
          type: 'number',
          min: '0',
          step: '1',
          value: item.purchase != null ? String(item.purchase) : '',
          'aria-label': esc(item.name) + ' 收购价',
        });
        on(purchaseInput, 'change', function (capturedId) {
          return function (e) {
            var v = parseFloat(e.target.value);
            if (!isNaN(v) && cb.onSetPrice) cb.onSetPrice(capturedId, 'purchase', v);
          };
        }(item.id));
        var purchaseCell = el('span', { class: 'wl-price-cell wl-price-cell--input', role: 'cell' });
        purchaseCell.appendChild(purchaseInput);
        row.appendChild(purchaseCell);

        priceTable.appendChild(row);
      });
      priceSection.appendChild(priceTable);
    }
    container.appendChild(priceSection);

    // ── 结束今天按钮 ──
    var footer = el('div', { class: 'wl-shop__footer' });
    var endBtn = el('button', { class: 'wl-btn wl-btn--primary wl-btn--end-day', type: 'button' },
      '结束今天 →');
    on(endBtn, 'click', function () {
      if (cb.onEndDay) cb.onEndDay();
    });
    footer.appendChild(endBtn);
    container.appendChild(footer);
  }

  // ── 4. 集装箱拍卖 renderAuction ───────────────────────────
  /**
   * @param {HTMLElement} container
   * @param {Object} auctionState  {
   *   containerName, tier, clues:[{id,label,revealed}],
   *   currentBid, currentBidder, myBid, minIncrement,
   *   timeLeft, round, maxRound, ended, won }
   * @param {Object} callbacks  { onBid(amount), onRevealClue(id) }
   */
  function renderAuction(container, auctionState, callbacks) {
    var cb = callbacks || {};
    var s = auctionState || {};
    container.innerHTML = '';
    container.className = (container.className || '').replace(/\bwl-auction\b/g, '').trim() + ' wl-auction';

    // ── 标题行 ──
    var hdr = el('div', { class: 'wl-auction__header' });
    hdr.appendChild(el('div', { class: 'wl-auction__title-wrap' },
      el('span', { class: 'wl-auction__kicker' }, '集装箱拍卖'),
      el('h2', { class: 'wl-auction__name' }, esc(s.containerName || '未知集装箱'))
    ));
    var tierColors = { low: 'var(--wl-tier-low)', mid: 'var(--wl-tier-mid)', high: 'var(--wl-tier-high)' };
    var tierLabels = { low: '低档', mid: '中档', high: '高档' };
    hdr.appendChild(el('span', {
      class: 'wl-auction__tier',
      style: 'color:' + (tierColors[s.tier] || tierColors.mid),
    }, tierLabels[s.tier] || '—'));
    container.appendChild(hdr);

    // ── 拍卖状态栏 ──
    var statusBar = el('div', { class: 'wl-auction__status' });
    statusBar.appendChild(el('div', { class: 'wl-auction__stat' },
      el('span', null, '当前最高价'),
      el('b', null, s.currentBid != null ? s.currentBid.toLocaleString() + ' 元' : '—')
    ));
    statusBar.appendChild(el('div', { class: 'wl-auction__stat' },
      el('span', null, '出价方'),
      el('b', null, esc(s.currentBidder || '—'))
    ));
    statusBar.appendChild(el('div', { class: 'wl-auction__stat' },
      el('span', null, '回合'),
      el('b', null, (s.round || 1) + ' / ' + (s.maxRound || '?'))
    ));
    if (s.timeLeft != null) {
      statusBar.appendChild(el('div', { class: 'wl-auction__stat' },
        el('span', null, '剩余时间'),
        el('b', { class: 'wl-auction__timer' + (s.timeLeft < 30 ? ' wl-auction__timer--urgent' : '') },
          s.timeLeft + ' 秒')
      ));
    }
    container.appendChild(statusBar);

    // ── 线索卡片 ──
    var clueSection = el('section', { class: 'wl-auction__clues', 'aria-label': '集装箱线索' });
    clueSection.appendChild(el('h3', { class: 'wl-section-title' }, '线索'));
    var clues = s.clues || [];
    if (clues.length === 0) {
      clueSection.appendChild(el('p', { class: 'wl-empty' }, '暂无线索。'));
    } else {
      var clueGrid = el('div', { class: 'wl-clue-grid' });
      clues.forEach(function (clue) {
        var clueCard = el('div', {
          class: 'wl-clue-card' + (clue.revealed ? ' wl-clue-card--revealed' : ''),
        });
        clueCard.appendChild(el('span', { class: 'wl-clue-card__icon', 'aria-hidden': 'true' },
          clue.revealed ? '📋' : '🔒'));
        clueCard.appendChild(el('span', { class: 'wl-clue-card__label' },
          clue.revealed ? esc(clue.label) : '未揭示'));
        if (!clue.revealed && cb.onRevealClue) {
          var revealBtn = el('button', {
            class: 'wl-btn wl-btn--sm wl-btn--ghost',
            type: 'button',
            'aria-label': '揭示线索',
          }, '揭示');
          on(revealBtn, 'click', function (capturedId) {
            return function () { cb.onRevealClue(capturedId); };
          }(clue.id));
          clueCard.appendChild(revealBtn);
        }
        clueGrid.appendChild(clueCard);
      });
      clueSection.appendChild(clueGrid);
    }
    container.appendChild(clueSection);

    // ── 结果展示 / 出价区 ──
    if (s.ended) {
      var result = el('div', {
        class: 'wl-auction__result ' + (s.won ? 'wl-auction__result--won' : 'wl-auction__result--lost'),
      });
      result.appendChild(el('span', { class: 'wl-auction__result-icon', 'aria-hidden': 'true' },
        s.won ? '🏆' : '😔'));
      result.appendChild(el('b', { class: 'wl-auction__result-text' },
        s.won ? '拍得！成交价 ' + (s.currentBid || 0).toLocaleString() + ' 元'
               : '未能拍到，最终成交 ' + (s.currentBid || 0).toLocaleString() + ' 元'));
      container.appendChild(result);
    } else {
      var bidSection = el('div', { class: 'wl-auction__bid' });
      bidSection.appendChild(el('label', { class: 'wl-auction__bid-label', for: 'wl-bid-input' },
        '我的出价'));
      var minBid = (s.currentBid || 0) + (s.minIncrement || 1);
      var bidInput = el('input', {
        id: 'wl-bid-input',
        class: 'wl-auction__bid-input',
        type: 'number',
        min: String(minBid),
        step: String(s.minIncrement || 1),
        value: s.myBid != null ? String(s.myBid) : String(minBid),
        'aria-label': '出价金额',
        placeholder: '最低 ' + minBid,
      });
      bidSection.appendChild(bidInput);

      var bidBtn = el('button', {
        class: 'wl-btn wl-btn--primary',
        type: 'button',
        'aria-label': '提交出价',
      }, '出价 →');
      on(bidBtn, 'click', function () {
        var amount = parseFloat(bidInput.value);
        if (!isNaN(amount) && cb.onBid) cb.onBid(amount);
      });
      bidSection.appendChild(bidBtn);

      if (s.minIncrement) {
        bidSection.appendChild(el('span', { class: 'wl-auction__bid-hint' },
          '最低加价：' + s.minIncrement + ' 元'));
      }
      container.appendChild(bidSection);
    }
  }

  // ── mount / unmount helpers ──────────────────────────────
  function mount(el, fn) {
    if (fn) fn(el);
  }

  function unmount(el) {
    if (el) el.innerHTML = '';
  }

  // ── 公开 API ─────────────────────────────────────────────
  window.WastelandUI = {
    VERSION: '1',
    renderGrid: renderGrid,
    renderItemDetail: renderItemDetail,
    renderShopFloor: renderShopFloor,
    renderAuction: renderAuction,
    mount: mount,
    unmount: unmount,
  };

}());
