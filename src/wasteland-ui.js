/* wasteland-ui.js – 废土杂货铺 UI 层 v3 CRT磷绿终端风格
 * 纯原生 JS IIFE，暴露 window.WastelandUI
 */
(function () {
  'use strict';

  // ── 颜色常量 ────────────────────────────────────────────────
  var PHOSPHOR     = '#39ff14';
  var PHOSPHOR_DIM = '#1a7a08';
  var AMBER        = '#ffb347';
  var PANEL_BG     = '#080c06';
  var GRID_BG      = '#050805';

  // ── 物品类型配置 ──────────────────────────────────────────
  var ITEM_TYPES = {
    weapon:     { icon: '🔫', color: '#ff4a6a', label: '武器'   },
    ammo:       { icon: '💣', color: '#ffb75c', label: '弹药'   },
    food:       { icon: '🥫', color: '#3dcc7a', label: '食物'   },
    water:      { icon: '💧', color: '#3abfff', label: '水'     },
    medicine:   { icon: '💊', color: '#9a5cff', label: '药品'   },
    chemical:   { icon: '⚗️', color: '#ff66c4', label: '化学品' },
    metal:      { icon: '⚙️', color: '#e6b820', label: '金属'   },
    elec:       { icon: '🔋', color: '#00d8e6', label: '电子'   },
    electronic: { icon: '🔋', color: '#00d8e6', label: '电子'   },
    cloth:      { icon: '🧥', color: '#9a7cff', label: '布料'   },
    alcohol:    { icon: '🍶', color: '#ff8c20', label: '酒'     },
    drug:       { icon: '💉', color: '#ff718e', label: '针剂'   },
    tool:       { icon: '🔧', color: '#6a8aaa', label: '工具'   },
    junk:       { icon: '📦', color: '#7a8a9a', label: '废品'   },
    contraband: { icon: '⚡', color: '#ff2020', label: '违禁品', blink: true },
    fake:       { icon: '🎭', color: '#ff718e', label: '假货'   },
    misc:       { icon: '📋', color: '#7a8fa8', label: '杂项'   },
  };

  // ── 辅助函数 ─────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function typeConf(type) { return ITEM_TYPES[type] || ITEM_TYPES.misc; }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'style') node.style.cssText = attrs[k];
        else if (k.startsWith('data-')) node.dataset[k.slice(5)] = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  function on(node, event, fn) { node.addEventListener(event, fn); return node; }

  function ensureStyles() {
    if (document.getElementById('wl-crt-styles')) return;
    var s = document.createElement('style');
    s.id = 'wl-crt-styles';
    s.textContent = [
      '@keyframes wlPhosphorGlow{0%,100%{box-shadow:0 0 6px ' + PHOSPHOR + '88,inset 0 0 4px ' + PHOSPHOR + '22}50%{box-shadow:0 0 12px ' + PHOSPHOR + 'bb,inset 0 0 8px ' + PHOSPHOR + '44}}',
      '@keyframes wlAmberPulse{0%,100%{box-shadow:0 0 6px ' + AMBER + '88}50%{box-shadow:0 0 14px ' + AMBER + 'cc}}',
      '@keyframes wlRedBlink{0%,100%{background:rgba(180,0,0,.22)}50%{background:rgba(255,0,0,.40)}}',
      '@keyframes wlContrabandBlink{50%{border-color:rgba(255,32,32,.2);box-shadow:none;}}',
      '@keyframes wlTickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}',
      '.wl-ticker{overflow:hidden;background:' + PANEL_BG + ';border:1px solid ' + PHOSPHOR_DIM + ';border-radius:3px;padding:5px 0;}',
      '.wl-ticker__track{display:inline-block;white-space:nowrap;will-change:transform;}',
      '.wl-ticker__text{padding:0 20px;font:700 12px ui-monospace,monospace;color:' + PHOSPHOR + ';letter-spacing:.05em;}',
      '@media(prefers-reduced-motion:reduce){.wl-ticker__track,.wl-crt-blink{animation:none!important;}}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── CRT panel base style helper ──────────────────────────
  function crtPanel(style) {
    return 'background:' + PANEL_BG + ';border:1px solid ' + PHOSPHOR_DIM + ';font-family:ui-monospace,SFMono-Regular,monospace;color:' + PHOSPHOR + ';' + (style || '');
  }

  // Quality dots helper
  function qualityDots(qLvl, size) {
    var s = size || 5;
    var wrap = el('span', {
      style: 'position:absolute;bottom:2px;right:2px;display:flex;gap:2px;',
      'aria-label': '品质 ' + qLvl + '/5',
    });
    for (var i = 1; i <= 5; i++) {
      wrap.appendChild(el('i', {
        style: 'display:inline-block;width:' + s + 'px;height:' + s + 'px;border-radius:50%;' +
          'background:' + (i <= qLvl ? PHOSPHOR : '#1c2a18') + ';font-style:normal;',
      }));
    }
    return wrap;
  }

  // ── 1. renderGrid ─────────────────────────────────────────
  function renderGrid(container, gridData, callbacks) {
    ensureStyles();
    var cells = (gridData && gridData.cells) || [];
    var cols = gridData.cols || 10;
    var rows = gridData.rows || 8;
    var CELL = 48;
    var cb = callbacks || {};

    var occupied = {};
    cells.forEach(function (item) {
      for (var dy = 0; dy < (item.h || 1); dy++) {
        for (var dx = 0; dx < (item.w || 1); dx++) {
          occupied[(item.x + dx) + ',' + (item.y + dy)] = item;
        }
      }
    });

    container.innerHTML = '';
    container.style.cssText = 'position:relative;background:' + GRID_BG + ';' +
      'display:grid;grid-template-columns:repeat(' + cols + ',' + CELL + 'px);' +
      'grid-template-rows:repeat(' + rows + ',' + CELL + 'px);gap:1px;' +
      'border:1px solid ' + PHOSPHOR_DIM + ';' +
      'background-color:' + PHOSPHOR_DIM + ';' + // gap color
      'box-shadow:inset 0 0 20px rgba(0,0,0,.6);';

    var rendered = {};
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var key = col + ',' + row;
        var item = occupied[key];

        if (item && item.x === col && item.y === row && !rendered[item.id]) {
          rendered[item.id] = true;
          var conf = typeConf(item.type);
          var qLvl = item.quality != null ? Math.min(5, Math.max(1, Math.round(item.quality))) : 0;
          var itemColor = item.color || conf.color || PHOSPHOR;
          var w = item.w || 1;
          var h = item.h || 1;

          var cellDiv = el('div', {
            draggable: 'true',
            'data-id': item.id,
            tabindex: '0',
            role: 'button',
            'aria-label': esc(item.name || conf.label),
            style: [
              'position:relative',
              'grid-column:' + (col + 1) + '/span ' + w,
              'grid-row:' + (row + 1) + '/span ' + h,
              'background:linear-gradient(160deg,' + itemColor + '18 0%,' + GRID_BG + ' 60%)',
              'border-left:3px solid ' + itemColor,
              'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px',
              'cursor:pointer;overflow:hidden',
              'transition:background .1s,border-color .1s',
            ].join(';'),
          });

          // 图标
          cellDiv.appendChild(el('span', {
            style: 'font-size:' + (h > 1 ? '24' : '20') + 'px;line-height:1;display:block;',
            'aria-hidden': 'true'
          }, item.icon || conf.icon));

          // 物品名（只在格子够大时显示）
          var shortName = (item.name || conf.label || '').slice(0, w > 1 ? 8 : 5);
          cellDiv.appendChild(el('span', {
            style: 'font-size:9px;color:' + itemColor + ';line-height:1;' +
                   'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
                   'max-width:' + (w * CELL - 8) + 'px;letter-spacing:.02em;'
          }, shortName));

          // 假货标记
          if (item.genuine === false) {
            cellDiv.appendChild(el('span', {
              style: 'position:absolute;top:2px;right:3px;font-size:8px;color:#ff4a6a;font-weight:900;',
            }, '⚠'));
          }

          // 品质点
          if (qLvl) {
            var dots = el('span', {
              style: 'position:absolute;bottom:2px;right:2px;display:flex;gap:1px;',
              'aria-label': '品质 ' + qLvl + '/5',
            });
            for (var qi = 1; qi <= 5; qi++) {
              dots.appendChild(el('i', {
                style: 'display:inline-block;width:3px;height:3px;border-radius:50%;font-style:normal;' +
                       'background:' + (qi <= qLvl ? itemColor : '#1c2a18') + ';',
              }));
            }
            cellDiv.appendChild(dots);
          }

          (function (captured, cDiv, cColor) {
            on(cDiv, 'click', function (e) {
              e.stopPropagation();
              if (cb.onSelect) cb.onSelect(captured.id);
            });
            on(cDiv, 'keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (cb.onSelect) cb.onSelect(captured.id); }
            });
            on(cDiv, 'mouseover', function () {
              cDiv.style.background = 'linear-gradient(160deg,' + cColor + '30 0%,' + cColor + '10 60%)';
            });
            on(cDiv, 'mouseout', function () {
              cDiv.style.background = 'linear-gradient(160deg,' + cColor + '18 0%,' + GRID_BG + ' 60%)';
            });
            on(cDiv, 'dragstart', function (e) {
              e.dataTransfer.setData('text/plain', captured.id);
              e.dataTransfer.effectAllowed = 'move';
              cDiv.style.opacity = '.45';
            });
            on(cDiv, 'dragend', function () { cDiv.style.opacity = '1'; });
          }(item, cellDiv, itemColor));

          container.appendChild(cellDiv);

        } else if (!item) {
          var emptyDiv = el('div', {
            'data-x': col,
            'data-y': row,
            style: [
              'grid-column:' + (col + 1),
              'grid-row:' + (row + 1),
              'background:' + GRID_BG,
              // subtle dot pattern
              'background-image:radial-gradient(circle,' + PHOSPHOR_DIM + '20 1px,transparent 1px)',
              'background-size:10px 10px',
            ].join(';'),
          });

          (function (cx, cy) {
            on(emptyDiv, 'dragover', function (e) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              emptyDiv.style.background = PHOSPHOR + '14';
              emptyDiv.style.backgroundImage = 'none';
              emptyDiv.style.outline = '1px dashed ' + PHOSPHOR + '80';
            });
            on(emptyDiv, 'dragleave', function () {
              emptyDiv.style.background = GRID_BG;
              emptyDiv.style.backgroundImage = 'radial-gradient(circle,' + PHOSPHOR_DIM + '20 1px,transparent 1px)';
              emptyDiv.style.backgroundSize = '10px 10px';
              emptyDiv.style.outline = 'none';
            });
            on(emptyDiv, 'drop', function (e) {
              e.preventDefault();
              emptyDiv.style.background = GRID_BG;
              emptyDiv.style.outline = 'none';
              var itemId = e.dataTransfer.getData('text/plain');
              if (cb.onDrop) cb.onDrop({ itemId: itemId, toX: cx, toY: cy });
            });
          }(col, row));

          container.appendChild(emptyDiv);
        }
      }
    }
  }

  // ── 2. renderCounter ─────────────────────────────────────
  // 交易台：8×4 弹出格子区域。NPC说需求，玩家拖物品进去，NPC评估后出价。
  function renderCounter(container, counterState, callbacks) {
    ensureStyles();
    var s   = counterState || {};
    var npc = s.npc || {};
    var slots = s.slots || [];
    var cb  = callbacks || {};
    var COLS = 8, ROWS = 4, CELL = 42;

    container.innerHTML = '';

    // 空闲状态：简单提示
    if (!s.npcId || s.phase === 'idle') {
      container.style.cssText = 'padding:8px 10px;';
      container.appendChild(el('p', {
        style: 'font-size:.68rem;color:' + PHOSPHOR_DIM + ';font-style:italic;'
      }, '点击访客「接待」后，将仓库物品拖到交易台。'));
      return;
    }

    container.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px;';

    // NPC 信息条
    var infoBar = el('div', {
      style: 'display:flex;align-items:baseline;gap:8px;padding:4px 6px;' +
             'background:rgba(255,179,71,.06);border-left:2px solid ' + AMBER + ';'
    });
    infoBar.appendChild(el('b', { style: 'font-size:12px;color:' + AMBER + ';' }, esc(npc.name || '??')));
    var budgetSpan = el('span', { style: 'font-size:11px;color:rgba(255,179,71,.7);' },
      '预算 ¥' + (npc.budget || '?'));
    infoBar.appendChild(budgetSpan);
    if (npc.wants && npc.wants.length) {
      var wText = npc.wants.map(function(w){
        return typeof w === 'object' ? (w.category || '?') + (w.qty > 1 ? '×' + w.qty : '') : String(w);
      }).join(' / ');
      infoBar.appendChild(el('span', { style: 'font-size:10px;color:rgba(57,255,20,.5);margin-left:4px;' },
        '需要：' + wText));
    }
    container.appendChild(infoBar);

    // 交易台格子 8×4
    var gridEl = el('div', {
      style: 'display:grid;' +
             'grid-template-columns:repeat(' + COLS + ',' + CELL + 'px);' +
             'grid-template-rows:repeat(' + ROWS + ',' + CELL + 'px);' +
             'gap:1px;background:' + PHOSPHOR_DIM + ';' +
             'border:1px solid ' + AMBER + '44;' +
             'box-shadow:0 0 12px rgba(255,179,71,.08);'
    });

    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var idx = row * COLS + col;
        (function(slotIdx) {
          var slotItem = slots[slotIdx] || null;
          var slotDiv  = el('div', {
            'data-slot': slotIdx,
            style: 'position:relative;background:' + GRID_BG + ';' +
                   'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
                   'cursor:pointer;overflow:hidden;transition:background .1s;'
          });

          if (slotItem) {
            var conf = typeConf(slotItem.type);
            var iColor = slotItem.color || conf.color || AMBER;
            slotDiv.style.background = 'linear-gradient(160deg,' + iColor + '18 0%,' + GRID_BG + ' 60%)';
            slotDiv.style.borderLeft = '2px solid ' + iColor;
            slotDiv.appendChild(el('span', {
              style: 'font-size:18px;line-height:1;display:block;',
              'aria-hidden': 'true'
            }, slotItem.icon || conf.icon));
            slotDiv.appendChild(el('span', {
              style: 'font-size:8px;color:' + iColor + ';line-height:1;' +
                     'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38px;'
            }, (slotItem.name || conf.label || '').slice(0, 5)));
            on(slotDiv, 'click', function () {
              if (cb.onRemoveFromSlot) cb.onRemoveFromSlot(slotIdx);
            });
          } else {
            slotDiv.appendChild(el('span', {
              style: 'font-size:14px;color:rgba(255,179,71,.2);'
            }, '+'));
          }

          // drag-enter 计数器防止子元素触发 false dragleave
          var enterCount = 0;
          on(slotDiv, 'dragenter', function(e) {
            e.preventDefault(); enterCount++;
            slotDiv.style.background = AMBER + '1a';
            slotDiv.style.outline = '1px dashed ' + AMBER + '80';
          });
          on(slotDiv, 'dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
          on(slotDiv, 'dragleave', function() {
            enterCount--;
            if (enterCount <= 0) {
              enterCount = 0;
              slotDiv.style.background = slotItem
                ? 'linear-gradient(160deg,' + (slotItem.color || AMBER) + '18 0%,' + GRID_BG + ' 60%)'
                : GRID_BG;
              slotDiv.style.outline = 'none';
            }
          });
          on(slotDiv, 'drop', function(e) {
            e.preventDefault(); enterCount = 0;
            slotDiv.style.background = GRID_BG;
            slotDiv.style.outline = 'none';
            var itemId = e.dataTransfer.getData('text/plain');
            if (cb.onSlotDrop) cb.onSlotDrop({ itemId: itemId, slotIdx: slotIdx });
          });

          gridEl.appendChild(slotDiv);
        }(idx));
      }
    }
    container.appendChild(gridEl);

    // 出价 + 操作按钮
    var footer = el('div', { style: 'display:flex;align-items:center;gap:8px;' });

    if (s.offer != null) {
      footer.appendChild(el('span', {
        style: 'flex:1;font-size:14px;color:' + AMBER + ';font-weight:900;' +
               'text-shadow:0 0 8px rgba(255,179,71,.4);'
      }, '报价 ¥' + s.offer.toLocaleString()));

      var confirmBtn = el('button', {
        type: 'button',
        style: 'padding:5px 14px;border:1px solid ' + PHOSPHOR + ';' +
               'background:rgba(57,255,20,.1);color:' + PHOSPHOR + ';' +
               'cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;' +
               'letter-spacing:.06em;transition:background .15s;',
      }, '确认成交');
      on(confirmBtn, 'click', function () { if (cb.onConfirm) cb.onConfirm(); });
      on(confirmBtn, 'mouseover', function() { confirmBtn.style.background = 'rgba(57,255,20,.2)'; });
      on(confirmBtn, 'mouseout',  function() { confirmBtn.style.background = 'rgba(57,255,20,.1)'; });

      var rejectBtn = el('button', {
        type: 'button',
        style: 'padding:5px 12px;border:1px solid rgba(255,74,106,.4);' +
               'background:transparent;color:rgba(255,74,106,.7);' +
               'cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:.06em;',
      }, '拒绝');
      on(rejectBtn, 'click', function () { if (cb.onReject) cb.onReject(); });

      footer.appendChild(confirmBtn);
      footer.appendChild(rejectBtn);
    } else if (slots.some(Boolean)) {
      // 有物品但还没出价——等待状态
      footer.appendChild(el('span', {
        style: 'font-size:11px;color:rgba(255,179,71,.4);font-style:italic;'
      }, '等待 ' + esc(npc.name || 'NPC') + ' 评估…'));
    } else {
      footer.appendChild(el('span', {
        style: 'font-size:11px;color:rgba(57,255,20,.3);font-style:italic;'
      }, '从仓库拖入物品放上台面'));
    }

    var cancelBtn = el('button', {
      type: 'button',
      style: 'margin-left:auto;padding:4px 10px;border:1px solid rgba(255,255,255,.1);' +
             'background:transparent;color:rgba(200,200,200,.3);' +
             'cursor:pointer;font-family:inherit;font-size:10px;',
    }, '取消');
    on(cancelBtn, 'click', function () { if (cb.onCancel) cb.onCancel(); });
    footer.appendChild(cancelBtn);
    container.appendChild(footer);
  }

  // ── 3. renderNpcQueue ────────────────────────────────────

  // ── 3. renderNpcQueue ────────────────────────────────────
  function renderNpcQueue(container, npcs, callbacks) {
    ensureStyles();
    var cb = callbacks || {};
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;gap:0;';

    var header = el('div', {
      style: 'font-size:9px;color:' + PHOSPHOR_DIM + ';letter-spacing:.16em;text-transform:uppercase;' +
             'padding:6px 10px 4px;border-bottom:1px solid ' + PHOSPHOR_DIM + ';background:' + PANEL_BG + ';'
    }, '▸ 今日访客 · ' + (npcs || []).length + ' 人');
    container.appendChild(header);

    if (!(npcs || []).length) {
      container.appendChild(el('p', { style: 'font-size:11px;color:' + PHOSPHOR_DIM + ';padding:10px;font-style:italic;' }, '今日暂无访客。'));
      return;
    }

    (npcs || []).forEach(function (npc) {
      var isActive = npc.activated || npc.active;
      var card = el('div', {
        'data-id': npc.id,
        tabindex: '0',
        role: 'button',
        'aria-label': esc(npc.name),
        style: 'display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;' +
               'border-bottom:1px solid rgba(57,255,20,.08);' +
               'background:' + (isActive ? 'rgba(57,255,20,.05)' : GRID_BG) + ';' +
               'opacity:' + (isActive ? '0.5' : '1') + ';' +
               'transition:background .15s;',
      });

      // 角色 emoji（按类型）
      var roleEmoji = { scavenger:'🧟', trader:'🤝', medic:'⚕️', informant:'🕵️', collector:'🍷', contractor:'👷' };
      card.appendChild(el('span', {
        style: 'font-size:20px;flex:0 0 auto;filter:grayscale(' + (isActive ? '80%' : '0') + ');',
        'aria-hidden': 'true'
      }, npc.emoji || roleEmoji[npc.role] || '👤'));

      var info = el('div', { style: 'flex:1;min-width:0;' });
      info.appendChild(el('b', {
        style: 'display:block;font-size:12px;color:' + AMBER + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      }, esc(npc.name || '??')));

      var tags = el('div', { style: 'display:flex;gap:4px;margin-top:2px;flex-wrap:wrap;' });
      if (npc.label || npc.role) {
        tags.appendChild(el('span', {
          style: 'font-size:9px;padding:1px 4px;border:1px solid ' + PHOSPHOR_DIM + ';color:' + PHOSPHOR_DIM + ';letter-spacing:.05em;'
        }, esc(npc.label || npc.role)));
      }
      if (npc.intel) {
        tags.appendChild(el('span', {
          style: 'font-size:9px;padding:1px 4px;border:1px solid ' + AMBER + ';color:' + AMBER + ';'
        }, '情报'));
      }
      info.appendChild(tags);

      if (!isActive && npc.budget != null && npc.budget > 0) {
        info.appendChild(el('span', {
          style: 'display:block;font-size:10px;color:' + PHOSPHOR_DIM + ';margin-top:2px;'
        }, '预算 ¥' + npc.budget + (npc.wants && npc.wants.length
          ? ' · 需要 ' + npc.wants.map(function (w) { return w.category || w; }).join('/')
          : '')));
      }
      card.appendChild(info);

      if (!isActive) {
        var btn = el('button', {
          style: 'flex:0 0 auto;padding:3px 8px;border:1px solid ' + PHOSPHOR_DIM + ';' +
                 'background:transparent;color:' + PHOSPHOR + ';font-size:10px;cursor:pointer;' +
                 'font-family:inherit;letter-spacing:.05em;',
          type: 'button'
        }, npc.intel ? '问情报' : '接待');
        (function (captured) {
          on(btn, 'click', function (e) {
            e.stopPropagation();
            if (cb.onActivate) cb.onActivate(captured.id);
          });
        }(npc));
        card.appendChild(btn);
      } else {
        card.appendChild(el('span', { style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';flex:0 0 auto;' }, '已处理'));
      }

      (function (captured) {
        on(card, 'click', function () { if (!captured.activated && cb.onActivate) cb.onActivate(captured.id); });
      }(npc));

      container.appendChild(card);
    });
  }

  // ── 4. renderMarketBoard ─────────────────────────────────
  function renderMarketBoard(container, marketState) {
    ensureStyles();
    var s = marketState || {};
    var categories = [
      { key: 'water',     label: '水资源',   icon: '💧' },
      { key: 'food',      label: '食物',     icon: '🥫' },
      { key: 'material',  label: '材料',     icon: '⚙️'  },
      { key: 'tech',      label: '科技',     icon: '🔋' },
      { key: 'medicine',  label: '药品',     icon: '💊' },
      { key: 'equipment', label: '装备',     icon: '🔫' },
    ];

    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;');

    categories.forEach(function (cat) {
      var data = (s[cat.key] || s.prices && s.prices[cat.key]) || {};
      var coef = data.coef != null ? data.coef : 1.0;
      var trend = data.trend || 0;   // positive = rising, negative = falling
      var shortage = !!data.shortage;

      var trendStr, trendColor;
      if (trend >= 2)       { trendStr = '++'; trendColor = '#ff4a6a'; }
      else if (trend === 1) { trendStr = '+';  trendColor = '#ff8080'; }
      else if (trend === 0) { trendStr = '─';  trendColor = PHOSPHOR_DIM; }
      else if (trend === -1){ trendStr = '-';  trendColor = '#50e080'; }
      else                  { trendStr = '--'; trendColor = PHOSPHOR; }

      var cell = el('div', {
        style: [
          'border:1px solid ' + (shortage ? '#ff2020' : PHOSPHOR_DIM),
          'background:' + (shortage ? 'rgba(180,0,0,.22)' : PANEL_BG),
          'padding:6px 8px',
          'display:flex;align-items:center;gap:6px',
          shortage ? 'animation:wlRedBlink 1.2s ease-in-out infinite;' : '',
        ].join(';'),
      });

      cell.appendChild(el('span', { style: 'font-size:16px;flex:0 0 auto;', 'aria-hidden': 'true' }, cat.icon));
      var info = el('div', { style: 'flex:1;min-width:0;' });
      info.appendChild(el('span', { style: 'display:block;font-size:10px;color:' + PHOSPHOR_DIM + ';' }, esc(cat.label)));
      info.appendChild(el('b', { style: 'font-size:13px;color:' + PHOSPHOR + ';' },
        'x' + coef.toFixed(2)));
      if (shortage) {
        info.appendChild(el('span', { style: 'display:block;font-size:9px;color:#ff4a6a;' }, '断供'));
      }
      cell.appendChild(info);
      cell.appendChild(el('span', { style: 'font-size:14px;font-weight:bold;color:' + trendColor + ';flex:0 0 auto;' }, trendStr));
      container.appendChild(cell);
    });
  }

  // ── 5. renderItemDetail ──────────────────────────────────
  function renderItemDetail(container, item, tools, playerSkill, marketPrice) {
    ensureStyles();
    if (!item) { container.innerHTML = ''; return; }
    var conf = typeConf(item.type);

    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:10px;display:flex;flex-direction:column;gap:8px;');

    // Header
    var hdr = el('div', { style: 'display:flex;align-items:center;gap:10px;' });
    hdr.appendChild(el('span', {
      style: 'font-size:36px;filter:drop-shadow(0 0 8px ' + PHOSPHOR + ');flex:0 0 auto;',
      'aria-hidden': 'true',
    }, item.icon || conf.icon));
    var titleWrap = el('div', {});
    titleWrap.appendChild(el('b', { style: 'display:block;font-size:15px;color:' + PHOSPHOR + ';' }, esc(item.name || conf.label)));
    titleWrap.appendChild(el('span', {
      style: 'font-size:10px;padding:1px 6px;border:1px solid ' + conf.color + ';color:' + conf.color + ';',
    }, conf.icon + ' ' + conf.label));
    if (item.genuine === false) {
      titleWrap.appendChild(el('span', {
        style: 'margin-left:4px;font-size:10px;padding:1px 6px;border:1px solid #ff4a6a;color:#ff4a6a;',
      }, '仿品'));
    }
    hdr.appendChild(titleWrap);
    container.appendChild(hdr);

    // Attribute list
    var attrs = [
      item.purity  != null ? ['纯度',     item.purity + '%'] : null,
      item.quality != null ? ['品质',     item.quality + (typeof item.quality === 'number' && item.quality <= 5 ? '/5' : '%')] : null,
      item.capacity!= null ? ['容量',     item.capacity] : null,
      item.container!=null ? ['容器',     item.container] : null,
      item.expiry  != null ? ['保质期',   item.expiry + ' 天'] : null,
      item.origin  != null ? ['来源',     item.origin] : null,
      item.ageDays != null ? ['陈年天数', item.ageDays + ' 天'] : null,
    ].filter(Boolean);

    if (attrs.length) {
      var attrGrid = el('div', {
        style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px;',
      });
      attrs.forEach(function (pair) {
        var row = el('div', { style: 'display:flex;gap:4px;font-size:11px;' });
        row.appendChild(el('span', { style: 'color:' + PHOSPHOR_DIM + ';' }, pair[0] + ':'));
        row.appendChild(el('b', { style: 'color:' + PHOSPHOR + ';' }, esc(String(pair[1]))));
        attrGrid.appendChild(row);
      });
      container.appendChild(attrGrid);
    }

    // Price block
    if (marketPrice != null) {
      var priceBlock = el('div', {
        style: 'border:1px solid ' + PHOSPHOR_DIM + ';padding:6px 8px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;',
      });
      [
        { label: '市场均价', value: marketPrice,                    color: PHOSPHOR },
        { label: '建议零售', value: Math.round(marketPrice * 1.3),  color: AMBER },
        { label: '建议收购', value: Math.round(marketPrice * 0.65), color: PHOSPHOR_DIM },
      ].forEach(function (p) {
        var col = el('div', { style: 'text-align:center;' });
        col.appendChild(el('span', { style: 'display:block;font-size:9px;color:' + PHOSPHOR_DIM + ';letter-spacing:.06em;' }, p.label));
        col.appendChild(el('b', { style: 'display:block;font-size:13px;color:' + p.color + ';' },
          p.value.toLocaleString() + ' ¥'));
        priceBlock.appendChild(col);
      });
      container.appendChild(priceBlock);
    }

    // Tools
    var matchTools = (tools || []).filter(function (t) {
      return !t.targetType || t.targetType === item.type;
    });
    if (matchTools.length) {
      var toolRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });
      matchTools.forEach(function (tool) {
        var btn = el('button', {
          type: 'button',
          style: 'padding:3px 10px;border:1px solid ' + PHOSPHOR_DIM + ';background:transparent;' +
            'color:' + PHOSPHOR + ';cursor:pointer;font-family:inherit;font-size:11px;',
        }, '🔬 ' + esc(tool.name));
        on(btn, 'click', function () {
          if (container._wlDetectCb) container._wlDetectCb(item.id, tool.id);
        });
        toolRow.appendChild(btn);
      });
      container.appendChild(toolRow);
    }
  }

  // ── 6. renderLootClaim ───────────────────────────────────
  function renderLootClaim(container, lootItems, callbacks) {
    ensureStyles();
    var cb = callbacks || {};
    var items = lootItems || [];

    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:8px;display:flex;flex-direction:column;gap:6px;');

    container.appendChild(el('span', {
      style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';letter-spacing:.1em;',
    }, '▶ 战利品'));

    if (!items.length) {
      container.appendChild(el('p', { style: 'color:' + PHOSPHOR_DIM + ';font-size:12px;margin:4px 0;' }, '暂无战利品'));
      return;
    }

    var list = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
    items.forEach(function (loot) {
      var conf = typeConf(loot.type);
      var qLvl = loot.quality != null ? Math.min(5, Math.max(1, Math.round(loot.quality))) : 0;
      var row = el('div', {
        style: 'display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid ' + PHOSPHOR_DIM + ';',
      });
      row.appendChild(el('span', { style: 'font-size:18px;', 'aria-hidden': 'true' }, loot.icon || conf.icon));
      var info = el('div', { style: 'flex:1;min-width:0;' });
      info.appendChild(el('b', { style: 'display:block;font-size:12px;color:' + PHOSPHOR + ';' }, esc(loot.name || conf.label)));
      info.appendChild(el('span', { style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';' },
        conf.label + (loot.qty > 1 ? ' ×' + loot.qty : '')));
      row.appendChild(info);
      if (qLvl) {
        var dotWrap = el('span', { style: 'display:flex;gap:2px;align-items:center;' });
        for (var i = 1; i <= 5; i++) {
          dotWrap.appendChild(el('i', {
            style: 'display:inline-block;width:5px;height:5px;border-radius:50%;font-style:normal;' +
              'background:' + (i <= qLvl ? PHOSPHOR : '#1c2a18') + ';',
          }));
        }
        row.appendChild(dotWrap);
      }
      list.appendChild(row);
    });
    container.appendChild(list);

    var collectBtn = el('button', {
      type: 'button',
      style: 'width:100%;padding:7px;border:1px solid ' + PHOSPHOR + ';background:' + PHOSPHOR + '18;' +
        'color:' + PHOSPHOR + ';cursor:pointer;font-family:inherit;font-size:12px;font-weight:bold;' +
        'box-shadow:0 0 6px ' + PHOSPHOR + '44;',
    }, '全部收入仓库 →');
    on(collectBtn, 'click', function () {
      if (cb.onCollectAll) cb.onCollectAll(items.slice());
    });
    container.appendChild(collectBtn);
  }

  // ── 7. renderBaseView ────────────────────────────────────
  function renderBaseView(container, baseState, callbacks) {
    ensureStyles();
    var s = baseState || {};
    var fixed = s.fixedSlots || {};
    var freeGrid = s.freeGrid || [];
    var cb = callbacks || {};

    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:10px;display:flex;gap:12px;');

    // Left: 4 fixed slots
    var leftPanel = el('div', {
      style: 'display:flex;flex-direction:column;gap:8px;min-width:160px;',
    });
    leftPanel.appendChild(el('span', {
      style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';letter-spacing:.1em;margin-bottom:2px;',
    }, '■ 固定设施'));

    var fixedDefs = [
      { key: 'power',          label: '电力',   icon: '⚡' },
      { key: 'security',       label: '安保',   icon: '🛡' },
      { key: 'water_purifier', label: '净水器', icon: '💧' },
      { key: 'storage',        label: '仓储',   icon: '📦' },
    ];
    fixedDefs.forEach(function (def) {
      var slot = fixed[def.key] || {};
      var installed = !!slot.installed;
      var level = slot.level || 0;
      var statusColor = installed ? PHOSPHOR : (slot.installed === false ? '#ff4a6a' : '#4a4a4a');
      var statusLabel = installed ? '运行' : (slot.installed === false ? '关闭' : '未装');

      var row = el('div', {
        style: 'display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid ' + PHOSPHOR_DIM + ';',
      });
      var led = el('i', {
        style: 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + ';' +
          'flex:0 0 auto;font-style:normal;' + (installed ? 'box-shadow:0 0 5px ' + statusColor + ';' : ''),
      });
      row.appendChild(led);
      row.appendChild(el('span', { style: 'font-size:14px;flex:0 0 auto;' }, def.icon));
      var info = el('div', { style: 'flex:1;' });
      info.appendChild(el('b', { style: 'display:block;font-size:11px;color:' + PHOSPHOR + ';' }, def.label));
      info.appendChild(el('span', { style: 'font-size:9px;color:' + statusColor + ';' },
        statusLabel + (level > 0 ? ' LV' + level : '')));
      row.appendChild(info);
      leftPanel.appendChild(row);
    });
    container.appendChild(leftPanel);

    // Right: 4x3 free grid (80px cells)
    var FCELL = 80;
    var FCOLS = 4, FROWS = 3;
    var rightPanel = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
    rightPanel.appendChild(el('span', {
      style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';letter-spacing:.1em;',
    }, '□ 自由设施格'));

    var fOccupied = {};
    (freeGrid || []).forEach(function (facility) {
      for (var dy = 0; dy < (facility.h || 1); dy++) {
        for (var dx = 0; dx < (facility.w || 1); dx++) {
          fOccupied[(facility.x + dx) + ',' + (facility.y + dy)] = facility;
        }
      }
    });

    var fGrid = el('div', {
      style: 'display:grid;grid-template-columns:repeat(' + FCOLS + ',' + FCELL + 'px);' +
        'grid-template-rows:repeat(' + FROWS + ',' + FCELL + 'px);background:' + GRID_BG + ';' +
        'border:1px solid ' + PHOSPHOR_DIM + ';',
    });

    var fRendered = {};
    for (var row = 0; row < FROWS; row++) {
      for (var col = 0; col < FCOLS; col++) {
        var fKey = col + ',' + row;
        var fac = fOccupied[fKey];

        if (fac && fac.x === col && fac.y === row && !fRendered[fac.id || fKey]) {
          fRendered[fac.id || fKey] = true;
          var facDiv = el('div', {
            draggable: 'true',
            style: [
              'grid-column:' + (col + 1) + '/span ' + (fac.w || 1),
              'grid-row:' + (row + 1) + '/span ' + (fac.h || 1),
              'border:1px solid ' + PHOSPHOR,
              'background:' + PANEL_BG,
              'display:flex;flex-direction:column;align-items:center;justify-content:center',
              'cursor:pointer;font-size:11px;color:' + PHOSPHOR,
              'box-shadow:0 0 5px ' + PHOSPHOR + '55',
            ].join(';'),
          });
          facDiv.appendChild(el('span', { style: 'font-size:24px;', 'aria-hidden': 'true' }, fac.icon || '🏗'));
          facDiv.appendChild(el('span', { style: 'font-size:9px;text-align:center;max-width:' + (FCELL * (fac.w || 1) - 8) + 'px;overflow:hidden;' },
            esc(fac.name || '设施')));
          fGrid.appendChild(facDiv);
        } else if (!fac) {
          var fEmpty = el('div', {
            'data-x': col,
            'data-y': row,
            style: 'grid-column:' + (col + 1) + ';grid-row:' + (row + 1) + ';' +
              'border:1px dashed ' + PHOSPHOR_DIM + '44;background:transparent;',
          });
          (function (cx, cy) {
            on(fEmpty, 'dragover', function (e) {
              e.preventDefault();
              fEmpty.style.background = PHOSPHOR + '12';
            });
            on(fEmpty, 'dragleave', function () { fEmpty.style.background = 'transparent'; });
            on(fEmpty, 'drop', function (e) {
              e.preventDefault();
              fEmpty.style.background = 'transparent';
              var facId = e.dataTransfer.getData('text/plain');
              if (cb.onFacilityDrop) cb.onFacilityDrop({ facId: facId, toX: cx, toY: cy });
            });
          }(col, row));
          fGrid.appendChild(fEmpty);
        }
      }
    }
    rightPanel.appendChild(fGrid);
    container.appendChild(rightPanel);
  }

  // ── Legacy: renderMarketTicker ────────────────────────────
  function renderMarketTicker(container, events) {
    ensureStyles();
    container.innerHTML = '';
    container.className = (container.className || '').replace(/\bwl-ticker\b/g, '').trim() + ' wl-ticker';
    var items = events || [];
    if (!items.length) return;
    var text = items.join('  ·  ');
    var dur = Math.max(12, items.length * 5);
    var full = text + '　　　·　　　' + text;
    var track = el('div', {
      class: 'wl-ticker__track',
      style: 'animation:wlTickerScroll ' + dur + 's linear infinite;',
    });
    track.appendChild(el('span', { class: 'wl-ticker__text', 'aria-live': 'polite' }, full));
    container.appendChild(track);
  }

  // ── Legacy: renderDispatchPanel ───────────────────────────
  function renderDispatchPanel(container, dispatches, onDispatch) {
    ensureStyles();
    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:8px;display:flex;flex-direction:column;gap:6px;');
    container.appendChild(el('span', { style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';letter-spacing:.1em;' }, '🗺 在途派遣'));

    var list = dispatches || [];
    var statusColors = { active: PHOSPHOR, returned: '#75ffb2', failed: '#ff718e', waiting: AMBER };
    var statusLabels = { active: '行进中', returned: '已归来', failed: '任务失败', waiting: '待命' };

    if (!list.length) {
      container.appendChild(el('p', { style: 'color:' + PHOSPHOR_DIM + ';font-size:12px;' }, '暂无在途派遣。'));
    } else {
      list.forEach(function (d) {
        var sc = statusColors[d.status] || PHOSPHOR_DIM;
        var sl = statusLabels[d.status] || (d.status || '—');
        var row = el('div', {
          style: 'display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid ' + PHOSPHOR_DIM + ';',
        });
        row.appendChild(el('span', { style: 'font-size:16px;' }, '🧭'));
        var info = el('div', { style: 'flex:1;min-width:0;' });
        info.appendChild(el('b', { style: 'display:block;font-size:12px;color:' + PHOSPHOR + ';' },
          esc(d.npcName || '未知') + ' → ' + esc(d.destination || '?')));
        info.appendChild(el('span', { style: 'font-size:10px;color:' + PHOSPHOR_DIM + ';' },
          '剩余 ' + (d.daysLeft != null ? d.daysLeft + ' 天' : '—')));
        row.appendChild(info);
        row.appendChild(el('span', {
          style: 'padding:2px 7px;border:1px solid ' + sc + ';color:' + sc + ';font-size:10px;',
        }, sl));
        container.appendChild(row);
      });
    }

    var btnRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;' });
    [
      { key: '近郊',    label: '近郊',    color: PHOSPHOR },
      { key: '中距离',  label: '中距离',  color: AMBER },
      { key: '深入禁区', label: '深入禁区', color: '#ff718e' },
    ].forEach(function (dest) {
      var btn = el('button', {
        type: 'button',
        style: 'flex:1;min-width:70px;padding:4px 8px;border:1px solid ' + dest.color + '66;' +
          'background:transparent;color:' + dest.color + ';cursor:pointer;font-family:inherit;font-size:11px;',
      }, dest.label);
      on(btn, 'click', function (d) {
        return function () { if (onDispatch) onDispatch(d.key); };
      }(dest));
      btnRow.appendChild(btn);
    });
    container.appendChild(btnRow);
  }

  // ── Legacy: renderLootPanel ───────────────────────────────
  function renderLootPanel(container, lootItems, onCollect) {
    renderLootClaim(container, lootItems, { onCollectAll: onCollect });
  }

  // ── Legacy: renderShopFloor ───────────────────────────────
  function renderShopFloor(container, state, callbacks) {
    var cb = callbacks || {};
    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:10px;display:flex;flex-direction:column;gap:10px;');

    var topbar = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ' + PHOSPHOR_DIM + ';padding-bottom:6px;' });
    topbar.appendChild(el('span', { style: 'font-size:13px;color:' + PHOSPHOR + ';' }, '第 ' + (state.day || 1) + ' 天'));
    topbar.appendChild(el('span', { style: 'font-size:13px;color:' + AMBER + ';' }, '¥ ' + (state.cash || 0).toLocaleString()));
    container.appendChild(topbar);

    var footer = el('div', { style: 'display:flex;justify-content:flex-end;' });
    var endBtn = el('button', {
      type: 'button',
      style: 'padding:6px 18px;border:1px solid ' + PHOSPHOR + ';background:' + PHOSPHOR + '18;' +
        'color:' + PHOSPHOR + ';cursor:pointer;font-family:inherit;font-size:13px;font-weight:bold;',
    }, '结束今天 →');
    on(endBtn, 'click', function () { if (cb.onEndDay) cb.onEndDay(); });
    footer.appendChild(endBtn);
    container.appendChild(footer);
  }

  // ── Legacy: renderAuction ────────────────────────────────
  function renderAuction(container, auctionState, callbacks) {
    var cb = callbacks || {};
    var s = auctionState || {};
    container.innerHTML = '';
    container.style.cssText = crtPanel('padding:10px;display:flex;flex-direction:column;gap:8px;');

    container.appendChild(el('b', { style: 'font-size:14px;color:' + PHOSPHOR + ';' },
      esc(s.containerName || '未知集装箱')));

    var statusBar = el('div', { style: 'display:flex;gap:12px;font-size:11px;color:' + AMBER + ';' });
    statusBar.appendChild(el('span', {}, '最高价: ' + (s.currentBid != null ? s.currentBid.toLocaleString() + ' ¥' : '—')));
    statusBar.appendChild(el('span', {}, '出价方: ' + esc(s.currentBidder || '—')));
    statusBar.appendChild(el('span', {}, '回合: ' + (s.round || 1) + '/' + (s.maxRound || '?')));
    container.appendChild(statusBar);

    if (s.ended) {
      container.appendChild(el('b', {
        style: 'color:' + (s.won ? PHOSPHOR : '#ff4a6a') + ';font-size:13px;',
      }, s.won ? '拍得！成交 ' + (s.currentBid || 0).toLocaleString() + ' ¥' : '未能拍到'));
    } else {
      var minBid = (s.currentBid || 0) + (s.minIncrement || 1);
      var bidRow = el('div', { style: 'display:flex;gap:6px;align-items:center;' });
      var bidInput = el('input', {
        type: 'number',
        min: String(minBid),
        step: String(s.minIncrement || 1),
        value: s.myBid != null ? String(s.myBid) : String(minBid),
        style: 'flex:1;padding:4px 8px;border:1px solid ' + AMBER + ';background:' + GRID_BG + ';color:' + AMBER + ';font-family:inherit;font-size:12px;',
      });
      bidRow.appendChild(bidInput);
      var bidBtn = el('button', {
        type: 'button',
        style: 'padding:4px 12px;border:1px solid ' + AMBER + ';background:' + AMBER + '18;color:' + AMBER + ';cursor:pointer;font-family:inherit;font-size:12px;',
      }, '出价');
      on(bidBtn, 'click', function () {
        var amount = parseFloat(bidInput.value);
        if (!isNaN(amount) && cb.onBid) cb.onBid(amount);
      });
      bidRow.appendChild(bidBtn);
      container.appendChild(bidRow);
    }
  }

  // ── mount / unmount helpers ──────────────────────────────
  function mount(node, fn) { if (fn) fn(node); }
  function unmount(node) { if (node) node.innerHTML = ''; }

  // ── 公开 API ─────────────────────────────────────────────
  window.WastelandUI = {
    VERSION: '3',
    // New CRT functions
    renderGrid: renderGrid,
    renderCounter: renderCounter,
    renderNpcQueue: renderNpcQueue,
    renderMarketBoard: renderMarketBoard,
    renderItemDetail: renderItemDetail,
    renderLootClaim: renderLootClaim,
    renderBaseView: renderBaseView,
    // Legacy compat
    renderShopFloor: renderShopFloor,
    renderAuction: renderAuction,
    renderMarketTicker: renderMarketTicker,
    renderDispatchPanel: renderDispatchPanel,
    renderLootPanel: renderLootPanel,
    mount: mount,
    unmount: unmount,
  };

}());
