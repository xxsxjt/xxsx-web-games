/* dimensional-trading-post UI layer · cross-world market console
 * 纯原生 JS IIFE，暴露 window.WastelandUI
 */
(function () {
  'use strict';

  // ── 颜色常量 ────────────────────────────────────────────────
  var PHOSPHOR     = '#79e7ee';
  var PHOSPHOR_DIM = '#557383';
  var AMBER        = '#ffc867';
  var PANEL_BG     = '#0b1420';
  var GRID_BG      = '#0c1925';
  var MUTED        = '#9bb0c1';
  // 商旅立绘：assets/portraits/<role>.png，由 tools/art/index.mjs 汇总到 WL_ART
  function npcArt(npc) {
    var art = window.WL_ART;
    if (!npc || !art) return null;
    return art['npc_' + npc.role] || null;
  }

  function worldForNpc(npc) {
    return window.WastelandNPC&&window.WastelandNPC.worldForNpc
      ? window.WastelandNPC.worldForNpc(npc)
      : (function(){var known=WORLD_VISITORS[npc&&npc.role]||{name:'维度中转站',mark:'◇',color:'#79e7ee'};return{id:npc&&npc.worldId||'',name:npc&&npc.worldName||known.name,mark:npc&&npc.worldMark||known.mark,color:npc&&npc.worldColor||known.color};}());
  }
  var WORLD_VISITORS = {
    scavenger: {name:'核爆废土',mark:'☢',color:'#ffc867'},
    trader: {name:'蒸汽帝国',mark:'⚙',color:'#79e7ee'},
    medic: {name:'瘟疫荒原',mark:'✚',color:'#85edbc'},
    informant: {name:'赛博魔法城',mark:'⌘',color:'#bb9bff'},
    collector: {name:'古代帝国集市',mark:'◇',color:'#ffc867'},
    contractor: {name:'凡界集市',mark:'▦',color:'#a7b8ce'}
  };

  // ── 物品类型配置 ──────────────────────────────────────────
  var ITEM_TYPES = {
    weapon:     { icon: '🔫', color: '#ff7e8e', label: '武器'   },
    ammo:       { icon: '💣', color: '#ffb75c', label: '弹药'   },
    food:       { icon: '🥫', color: '#85cda8', label: '食物'   },
    water:      { icon: '💧', color: '#79c7ee', label: '水'     },
    medicine:   { icon: '💊', color: '#bb9bff', label: '药品'   },
    chemical:   { icon: '⚗️', color: '#ff66c4', label: '化学品' },
    metal:      { icon: '⚙️', color: '#d9bd85', label: '金属'   },
    elec:       { icon: '🔋', color: '#79e7ee', label: '电子'   },
    electronic: { icon: '🔋', color: '#79e7ee', label: '电子'   },
    cloth:      { icon: '🧥', color: '#bb9bff', label: '布料'   },
    alcohol:    { icon: '🍶', color: '#ffc867', label: '酒'     },
    tobacco:    { icon: '🚬', color: '#c9a97a', label: '烟草'   },
    drug:       { icon: '💉', color: '#ff718e', label: '针剂'   },
    tool:       { icon: '🔧', color: '#a7b8ce', label: '工具'   },
    junk:       { icon: '📦', color: '#7a8a9a', label: '废品'   },
    contraband: { icon: '⚡', color: '#ff7e8e', label: '违禁品', blink: true },
    fake:       { icon: '🎭', color: '#ff718e', label: '假货'   },
    misc:       { icon: '📋', color: '#7a8fa8', label: '杂项'   },
  };

  // ── 辅助函数 ─────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Display names (purity grades, origins) live in WastelandCore
  function coreName(table, key) {
    var core = window.WastelandCore;
    return core && core[table] ? core[table][key] : null;
  }

  function typeConf(type) {
    var aliases = {material:'metal',tech:'electronic',equipment:'tool',illegal:'contraband'};
    return ITEM_TYPES[aliases[type] || type] || ITEM_TYPES.misc;
  }

  // ── 图标：支持 "img:路径" 与 emoji 两种写法 ──────────────────
  // 美术资源是分批生成的，可能随时缺文件。所以这里一律带兜底：
  // 图片加载失败就换回 emoji，绝不让格子里出现破图。
  function iconNode(icon, fallback, className) {
    var spec = icon || '';
    if (spec.indexOf('img:') === 0) {
      var img = el('img', {
        class: (className ? className + ' ' : '') + 'wl-icon-img',
        src: spec.slice(4),
        alt: '',
        'aria-hidden': 'true',
        loading: 'lazy',
        decoding: 'async',
      });
      // 兜底必须在同一位置替换，不能只藏起来——藏起来格子里就空了
      img.addEventListener('error', function () {
        var span = el('span', {class: className || '', 'aria-hidden': 'true'}, fallback || '📦');
        if (img.parentNode) img.parentNode.replaceChild(span, img);
      });
      return img;
    }
    return el('span', {class: className || '', 'aria-hidden': 'true'}, spec || fallback || '📦');
  }

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
      '@keyframes wlRedBlink{0%,100%{background:rgba(150,42,62,.22)}50%{background:rgba(255,78,104,.35)}}',
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
    return 'background:' + PANEL_BG + ';border:1px solid ' + PHOSPHOR_DIM + ';font-family:system-ui,sans-serif;color:#eaf6ff' + ';' + (style || '');
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
          'background:' + (i <= qLvl ? PHOSPHOR : '#263b4a') + ';font-style:normal;',
      }));
    }
    return wrap;
  }

  // ── 1. renderGrid ─────────────────────────────────────────
  function renderGrid(container, gridData, callbacks) {
    var data = gridData || {};
    var cells = data.cells || [];
    var cols = data.cols || 10, rows = data.rows || 8;
    var cb = callbacks || {}, occupied = {};
    cells.forEach(function (item) {
      for (var y = 0; y < (item.h || 1); y++) {
        for (var x = 0; x < (item.w || 1); x++) occupied[(item.x + x) + ',' + (item.y + y)] = item;
      }
    });
    // Every selection rebuilds the whole grid, so note where the keyboard user was standing
    // and which cell currently holds the single tab stop, then restore both afterwards.
    var resumeEl = document.activeElement, resumeId = null, hadFocus = false;
    if (resumeEl && resumeEl.getAttribute && container.contains && container.contains(resumeEl)) {
      hadFocus = true;
      resumeId = resumeEl.getAttribute('data-id') || resumeEl.getAttribute('data-resume');
    }
    var lastTab = container.getAttribute('data-last-tab');
    container.innerHTML = '';
    container.className = 'wl-inventory-grid';
    container.style.cssText = '--wl-cols:' + cols + ';--wl-rows:' + rows + ';';
    var liveIds = {};
    cells.forEach(function (c) { liveIds[c.id] = true; });
    var firstItemId = null, cellMap = {};
    var tabOwner = (data.selectedId && liveIds[data.selectedId] && data.selectedId)
      || (lastTab && liveIds[lastTab] && lastTab)
      || null;
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var item = occupied[col + ',' + row];
        if (item && (item.x !== col || item.y !== row)) continue;
        if (item) {
          if (!firstItemId) firstItemId = item.id;
          var color = item.color || typeConf(item.type).color;
          var cell = el('div', {
            class: 'wl-inventory-cell wl-inventory-cell--item' + (data.selectedId === item.id ? ' wl-inventory-cell--selected' : ''),
            draggable: 'true', tabindex: item.id === (tabOwner || firstItemId) ? '0' : '-1', role: 'button', 'data-id': item.id,
            'aria-label': item.name || '货物', 'aria-pressed': String(data.selectedId === item.id),
            style: '--wl-item-color:' + color + ';grid-column:' + (col + 1) + '/span ' + (item.w || 1) + ';grid-row:' + (row + 1) + '/span ' + (item.h || 1) + ';'
          });
          cell.appendChild(iconNode(item.icon, typeConf(item.type).icon, 'wl-inventory-icon'));
          cell.appendChild(el('span', {class:'wl-inventory-name'}, item.name || typeConf(item.type).label));
          if (item.genuine === false) cell.appendChild(el('span', {class:'wl-inventory-warning','aria-label':'仿品'}, '⚠'));
          if (item.quality) {
            var q = Math.max(1, Math.min(5, Math.round(item.quality)));
            var dots = el('span', {class:'wl-inventory-quality','aria-label':'品质 ' + q + '/5'});
            for (var qi = 1; qi <= 5; qi++) dots.appendChild(el('i', {class:qi <= q ? 'filled' : ''}));
            cell.appendChild(dots);
          }
          (function (captured, target) {
            on(target, 'click', function () { if (cb.onSelect) cb.onSelect(captured.id); });
            on(target, 'keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (cb.onSelect) cb.onSelect(captured.id); return; }
              var step = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
              if (!step) return;
              e.preventDefault();
              // Step one cell at a time in the pressed direction until a real cell is reached.
              var nx = captured.x, ny = captured.y, landing = null;
              while (nx + step[0] >= 0 && ny + step[1] >= 0 && nx + step[0] < cols && ny + step[1] < rows) {
                nx += step[0]; ny += step[1];
                var candidate = cellMap[nx + ',' + ny];
                if (candidate && candidate !== target) { landing = candidate; break; }
              }
              if (!landing) return;
              if (landing.getAttribute('tabindex') === '-1') landing.setAttribute('tabindex', '0');
              container.setAttribute('data-last-tab', landing.getAttribute('data-id') || landing.getAttribute('data-resume') || '');
              landing.focus();
            });
            on(target, 'dragstart', function (e) { e.dataTransfer.setData('text/plain', captured.id); e.dataTransfer.effectAllowed = 'move'; target.style.opacity = '.45'; });
            on(target, 'dragend', function () { target.style.opacity = ''; });
            on(target, 'dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
            on(target, 'drop', function (e) {
              e.preventDefault();
              var moved = e.dataTransfer.getData('text/plain');
              if (!moved || moved === captured.id || !cb.onDrop) return;
              // Occupied target: hand the move to the shop, which finds the nearest free space.
              cb.onDrop({itemId: moved, toX: captured.x, toY: captured.y});
            });
          }(item, cell));
          for (var cy = 0; cy < (item.h || 1); cy++) {
            for (var cx2 = 0; cx2 < (item.w || 1); cx2++) cellMap[(item.x + cx2) + ',' + (item.y + cy)] = cell;
          }
          container.appendChild(cell);
        } else {
          var empty = el('div', {class:'wl-inventory-cell wl-inventory-cell--empty',tabindex:'-1','data-x':col,'data-y':row,'data-resume':'cell-' + col + '-' + row,style:'grid-column:' + (col + 1) + ';grid-row:' + (row + 1) + ';'});
          (function (cx, cy, target) {
            on(target, 'dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; target.classList.add('wl-inventory-cell--dragover'); });
            on(target, 'dragleave', function () { target.classList.remove('wl-inventory-cell--dragover'); });
            on(target, 'drop', function (e) { e.preventDefault(); target.classList.remove('wl-inventory-cell--dragover'); if (cb.onDrop) cb.onDrop({itemId:e.dataTransfer.getData('text/plain'),toX:cx,toY:cy}); });
          }(col, row, empty));
          cellMap[col + ',' + row] = empty;
          container.appendChild(empty);
        }
      }
    }
    // If nothing holds the tab stop yet, hand it to the first free cell.
    var restoreTarget = null;
    for (var ci = 0; ci < (container.children.length || 0); ci++) {
      var child = container.children[ci];
      var key = child.getAttribute('data-id') || child.getAttribute('data-resume') || '';
      if (!tabOwner && !firstItemId && child.getAttribute('data-resume')) child.setAttribute('tabindex', '0');
      if (hadFocus && resumeId && key === resumeId && !restoreTarget) restoreTarget = child;
    }
    if (restoreTarget && restoreTarget.focus) restoreTarget.focus();
  }

  function renderCounter(container, counterState, callbacks) {
    var s = counterState || {}, npc = s.npc || {}, slots = s.slots || [], cb = callbacks || {};
    container.innerHTML = '';
    container.style.cssText = '';
    container.className = 'wl-counter-panel';
    container.appendChild(el('h2', {class:'wl-trade-title'}, '交易柜台'));
    if (!s.npcId || s.phase === 'idle') {
      var idle = el('div', {class:'wl-counter-empty'});
      idle.appendChild(el('span', {'aria-hidden':'true'}, '◇'));
      idle.appendChild(el('p', {}, '先接待一位商旅，再点击仓库货物上柜台。'));
      container.appendChild(idle);
      return;
    }
    var visitor = worldForNpc(npc);
    var info = el('div', {class:'wl-counter-person'});
    info.appendChild(el('b', {}, npc.name || '商旅'));
    info.appendChild(el('span', {}, visitor.name + ' · 预算 ¤' + (npc.budget || 0)));
    var wants = (npc.wants || []).map(function (w) { return typeConf(w.category || w).label + (w.qty > 1 ? ' ×' + w.qty : ''); }).join(' / ');
    info.appendChild(el('p', {}, wants ? '想收：' + wants : '没有特别的需求'));
    container.appendChild(info);
    container.appendChild(el('p', {class:'wl-counter-hint'}, '点击仓库货物上柜台，再次点击台面货物可取回。'));

    // 他上门时自己也带货：这是前期唯一的进货来源
    var carried = s.offers || [];
    if (carried.length) {
      var shelf = el('section', {class:'wl-offer-shelf'});
      shelf.appendChild(el('h3', {class:'wl-offer-shelf__title'}, npc.name + ' 带来的货'));
      carried.forEach(function (offer) {
        var conf = typeConf(offer.category);
        var margin = offer.listPrice > 0
          ? Math.round((offer.listPrice - offer.unitCost) / offer.listPrice * 100)
          : 0;
        var row = el('article', {class:'wl-offer-row','data-offer':offer.id});
        row.appendChild(iconNode(offer.icon, conf.icon, 'wl-offer-icon'));
        var info = el('div', {class:'wl-offer-info'});
        info.appendChild(el('b', {}, esc(offer.name)));
        var meta = el('span', {class:'wl-offer-meta'});
        meta.appendChild(el('i', {class:'wl-supply-tag wl-supply-tag--' + offer.category}, conf.label));
        meta.appendChild(el('i', {}, '品质 ' + offer.quality + '/5'));
        meta.appendChild(el('i', {}, '剩 ' + offer.qty + ' 件'));
        if (offer.genuine === false) meta.appendChild(el('i', {class:'wl-supply-tag wl-supply-tag--fake'}, '来路可疑'));
        info.appendChild(meta);
        row.appendChild(info);

        var prices = el('div', {class:'wl-offer-prices'});
        var ask = el('div', {});
        ask.appendChild(el('small', {}, '他要价'));
        ask.appendChild(el('b', {}, '¤ ' + offer.unitCost));
        prices.appendChild(ask);
        var worth = el('div', {});
        worth.appendChild(el('small', {}, '市场价'));
        worth.appendChild(el('b', {}, '¤ ' + offer.listPrice));
        prices.appendChild(worth);
        var gain = el('div', {});
        gain.appendChild(el('small', {}, '转手'));
        gain.appendChild(el('b', {class: margin >= 15 ? 'wl-supply-good' : margin >= 0 ? 'wl-supply-mid' : 'wl-supply-bad'},
          (margin > 0 ? '+' : '') + margin + '%'));
        prices.appendChild(gain);
        row.appendChild(prices);

        var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm wl-btn--primary',
          'aria-label':'收下 ' + offer.name + ' 一件，花费 ¤' + offer.unitCost}, '收下');
        on(btn, 'click', function () { if (cb.onTakeOffer) cb.onTakeOffer(offer.id, 1); });
        row.appendChild(btn);
        shelf.appendChild(row);
      });
      container.appendChild(shelf);
    }
    function renderSlots(start, end) {
      var grid = el('div', {class:'wl-counter-slots'});
      for (var index = start; index < end; index++) {
        (function (slotIdx) {
          var item = slots[slotIdx];
          var slot = el('button', {type:'button',class:'wl-counter-slot' + (item ? ' wl-counter-slot--filled' : ''),'data-slot':slotIdx,'aria-label':item ? '取回 ' + item.name : '空柜台位 ' + (slotIdx + 1)});
          slot.appendChild(iconNode(item ? item.icon : '', item ? typeConf(item.type).icon : '+', 'wl-counter-icon'));
          if (item) slot.appendChild(el('small', {}, item.name || '货物'));
          on(slot, 'click', function () { if (item && cb.onRemoveFromSlot) cb.onRemoveFromSlot(slotIdx); });
          on(slot, 'dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; slot.classList.add('wl-counter-slot--dragover'); });
          on(slot, 'dragleave', function () { slot.classList.remove('wl-counter-slot--dragover'); });
          on(slot, 'drop', function (e) { e.preventDefault(); slot.classList.remove('wl-counter-slot--dragover'); if (cb.onSlotDrop) cb.onSlotDrop({itemId:e.dataTransfer.getData('text/plain'),slotIdx:slotIdx}); });
          grid.appendChild(slot);
        }(index));
      }
      return grid;
    }
    container.appendChild(renderSlots(0, Math.min(8, slots.length)));
    if (slots.length > 8) {
      var extra = el('details', {class:'wl-overflow-slots'});
      extra.open = slots.slice(8).some(Boolean);
      extra.appendChild(el('summary', {}, '更多台面位置 · ' + (slots.length - 8) + ' 格'));
      extra.appendChild(renderSlots(8, slots.length));
      container.appendChild(extra);
    }
    var footer = el('div', {class:'wl-counter-footer'});
    var offer = el('div', {class:'wl-counter-offer'});
    offer.appendChild(el('small', {}, '商旅出价'));
    offer.appendChild(el('span', {}, s.offer != null ? '¤ ' + s.offer.toLocaleString() : '等待货物'));
    footer.appendChild(offer);
    var confirmBtn = el('button', {type:'button',class:'wl-btn wl-btn--primary'}, '确认成交');
    confirmBtn.disabled = s.offer == null;
    on(confirmBtn, 'click', function () { if (s.offer != null && cb.onConfirm) cb.onConfirm(); });
    var cancelBtn = el('button', {type:'button',class:'wl-btn wl-btn--ghost'}, '收回货物');
    on(cancelBtn, 'click', function () { if (cb.onCancel) cb.onCancel(); });
    footer.appendChild(confirmBtn);
    footer.appendChild(cancelBtn);
    container.appendChild(footer);
  }

  function renderNpcQueue(container, npcs, callbacks) {
    var list = npcs || [], cb = callbacks || {};
    // Activation rebuilds the queue and removes the button that was pressed, so remember which
    // visitor the keyboard user came from and put focus back on that card afterwards.
    var resumeId = container.getAttribute ? container.getAttribute('data-focus-npc') : null;
    container.innerHTML = '';
    container.style.cssText = '';
    var header = el('h2', {class:'wl-trade-title wl-visitor-heading'}, '今日商旅');
    header.appendChild(el('span', {}, list.filter(function (npc) { return !npc.activated; }).length + ' 位待接待'));
    container.appendChild(header);
    if (!list.length) container.appendChild(el('p', {class:'wl-empty'}, '今天还没有商旅抵达。'));
    list.forEach(function (npc) {
      var visitor = worldForNpc(npc), done = !!npc.activated, current = cb.activeNpcId === npc.id;
      var card = el('div', {class:'wl-visitor' + (done ? ' wl-visitor--done' : '') + (current ? ' wl-visitor--current' : ''),'data-id':npc.id,tabindex:'-1',style:'--wl-world-color:' + visitor.color + ';'});
      // 立绘优先，没有就退回世界标记（☢ / ☯）。立绘是 512 方图，
      // 列表里裁成圆形头像，失败时同样退回标记，不会留空。
      var portrait = npcArt(npc);
      if (portrait) {
        var portraitImg = el('img', {class:'wl-visitor-portrait', src:portrait, alt:'', 'aria-hidden':'true', loading:'lazy'});
        portraitImg.addEventListener('error', function () {
          if (portraitImg.parentNode) portraitImg.parentNode.replaceChild(
            el('span', {class:'wl-visitor-mark','aria-hidden':'true'}, visitor.mark), portraitImg);
        });
        card.appendChild(portraitImg);
      } else {
        card.appendChild(el('span', {class:'wl-visitor-mark','aria-hidden':'true'}, visitor.mark));
      }
      var info = el('div', {class:'wl-visitor-info'});
      info.appendChild(el('b', {}, npc.name || '商旅'));
      info.appendChild(el('span', {class:'wl-visitor-world'}, visitor.name));
      var wants = (npc.wants || []).map(function (w) { return typeConf(w.category || w).label; }).join('、');
      info.appendChild(el('span', {class:'wl-visitor-budget'}, '预算 ¤' + (npc.budget || 0) + (wants ? ' · 收 ' + wants : '')));
      card.appendChild(info);
      if (done || current) card.appendChild(el('span', {class:'wl-visitor-status'}, done ? '已接待' : '洽谈中'));
      else {
        var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm wl-btn--ghost','aria-label':(npc.intel ? '向 ' : '接待 ') + (npc.name || '商旅') + (npc.intel ? ' 问情报' : '')}, npc.intel ? '问情报' : '接待');
        on(btn, 'click', function () {
          if (container.setAttribute) container.setAttribute('data-focus-npc', npc.id);
          if (cb.onActivate) cb.onActivate(npc.id);
        });
        card.appendChild(btn);
      }
      container.appendChild(card);
    });
    if (resumeId) {
      var back = null;
      for (var qi = 0; qi < (container.children.length || 0); qi++) {
        if (container.children[qi].getAttribute && container.children[qi].getAttribute('data-id') === resumeId) back = container.children[qi];
      }
      if (back && back.focus) back.focus();
    }
    if (container.removeAttribute) container.removeAttribute('data-focus-npc');
  }

  // ── 人脉订购：后期解锁的稳定供货渠道 ─────────────────
  function renderContacts(container, contacts, offers, callbacks) {
    var list = contacts || [], byContact = offers || {}, cb = callbacks || {};
    container.innerHTML = '';
    container.className = 'wl-contacts';
    if (!list.length) {
      container.appendChild(el('p', {class:'wl-empty'}, '还没有可以联系的人脉。'));
      return;
    }
    list.forEach(function (contact) {
      var def = byContact[contact.id];
      var card = el('article', {class:'wl-contact' + (contact.unlocked ? '' : ' wl-contact--locked')});
      var head = el('div', {class:'wl-contact__head'});
      head.appendChild(el('span', {class:'wl-contact__icon','aria-hidden':'true'}, contact.icon || '\u{1F3ED}'));
      var title = el('div', {});
      title.appendChild(el('b', {}, esc(contact.name)));
      title.appendChild(el('small', {}, contact.unlocked
        ? '可订购 · 约 ' + contact.leadDays + ' 天到货'
        : '尚未打通 · 需要更高声誉与更多成交'));
      head.appendChild(title);
      card.appendChild(head);

      if (contact.unlocked && def && def.items && def.items.length) {
        def.items.forEach(function (entry) {
          var row = el('div', {class:'wl-contact-order'});
          var label = el('div', {class:'wl-contact-order__label'});
          label.appendChild(el('b', {}, esc(entry.name)));
          label.appendChild(el('small', {}, '预付 \u00A4' + entry.unitCost + ' / 件 · 市价 \u00A4' + entry.listPrice));
          row.appendChild(label);
          // 注意：不能写成 disabled: true/false —— el() 走 setAttribute，
          // 传入 null 会落成字符串 "null"，而只要该属性存在按钮就是禁用的。
          var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm',
            'aria-label':'向 ' + contact.name + ' 订购 ' + entry.name}, '订购 1');
          btn.disabled = entry.unitCost > def.gold;
          on(btn, 'click', function () { if (cb.onOrder) cb.onOrder(contact.id, entry.skuId, 1); });
          row.appendChild(btn);
          card.appendChild(row);
        });
      }
      container.appendChild(card);
    });
  }

  function renderEventLog(container, events) {
    var list = (events || []).slice().reverse().slice(0, 12);
    container.innerHTML = '';
    container.className = 'wl-event-log';
    if (!list.length) {
      container.appendChild(el('p', {class:'wl-empty'}, '今天还没有记事。'));
      return;
    }
    list.forEach(function (ev) {
      var row = el('article', {class:'wl-event wl-event--' + (ev.type || 'note')});
      var head = el('div', {class:'wl-event__head'});
      head.appendChild(el('b', {}, ev.label || '记事'));
      if (ev.hour != null) head.appendChild(el('span', {}, ev.hour + ':00'));
      row.appendChild(head);
      if (ev.desc) row.appendChild(el('p', {class:'wl-event__desc'}, ev.desc));
      container.appendChild(row);
    });
  }

  function renderMarketBoard(container, marketState) {
    var s = marketState || {};
    // Every category createMarketState() tracks, labelled the same way the item badges are.
    var categories = [
      {key:'water',label:ITEM_TYPES.water.label}, {key:'food',label:ITEM_TYPES.food.label},
      {key:'material',label:'金属'}, {key:'tech',label:'电子'},
      {key:'medicine',label:ITEM_TYPES.medicine.label}, {key:'equipment',label:ITEM_TYPES.tool.label},
      {key:'alcohol',label:ITEM_TYPES.alcohol.label}, {key:'chemical',label:ITEM_TYPES.chemical.label},
      {key:'illegal',label:ITEM_TYPES.contraband.label}, {key:'misc',label:ITEM_TYPES.misc.label},
      {key:'tobacco',label:ITEM_TYPES.tobacco.label},
    ];
    container.innerHTML = '';
    container.style.cssText = '';
    container.className = 'wl-market-board';
    categories.forEach(function (cat) {
      var legacy = s[cat.key] || s.prices && s.prices[cat.key] || {};
      var value = s.coefficients && s.coefficients[cat.key];
      var coef = Number.isFinite(value) ? value : legacy.coef != null ? legacy.coef : 1;
      var shortage = !!(s.stockout && s.stockout[cat.key] > 0 || legacy.shortage);
      var delta = Math.round((coef - 1) * 100);
      var suffix = shortage ? 'scarce' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady';
      var card = el('div', {class:'wl-market-card wl-market-card--' + suffix,'data-category':cat.key});
      card.appendChild(el('span', {}, cat.label));
      card.appendChild(el('span', {}, shortage ? '断供' : '基准比'));
      card.appendChild(el('b', {}, '×' + coef.toFixed(2)));
      card.appendChild(el('small', {}, shortage ? '供应紧张' : delta === 0 ? '持平' : (delta > 0 ? '+' : '') + delta + '%'));
      container.appendChild(card);
    });
  }

  function renderItemDetail(container, item, tools, playerSkill, marketPrice) {
    ensureStyles();
    if (!item) { container.innerHTML = ''; return; }
    var conf = typeConf(item.type || item.category);

    container.innerHTML = '';
    container.style.cssText = '';
    container.className = 'wl-detail-content';

    // Header
    var hdr = el('div', { style: 'display:flex;align-items:center;gap:10px;' });
    hdr.appendChild(el('span', {
      style: 'font-size:36px;filter:drop-shadow(0 0 8px ' + PHOSPHOR + ');flex:0 0 auto;',
      'aria-hidden': 'true',
    }, item.icon || conf.icon));
    var titleWrap = el('div', {});
    titleWrap.appendChild(el('b', {class:'wl-detail-title',style:'display:block;font-size:15px;'}, esc(item.name || conf.label)));
    titleWrap.appendChild(el('span', {
      style: 'font-size:10px;padding:1px 6px;border:1px solid ' + conf.color + ';color:' + conf.color + ';',
    }, conf.icon + ' ' + conf.label));
    if (item.genuine === false) {
      titleWrap.appendChild(el('span', {
        style: 'margin-left:4px;font-size:10px;padding:1px 6px;border:1px solid #ff7e8e;color:#ff7e8e;',
      }, '仿品'));
    }
    hdr.appendChild(titleWrap);
    container.appendChild(hdr);

    // Attribute list
    var attrs = [
      item.purity  != null ? ['纯度',     coreName('PURITY_NAMES', item.purity) || item.purity] : null,
      item.quality != null ? ['品质',     item.quality + (typeof item.quality === 'number' && item.quality <= 5 ? '/5' : '%')] : null,
      item.capacity!= null ? ['容量',     item.capacity] : null,
      item.container!=null ? ['容器',     item.container] : null,
      item.expiry  != null ? ['保质期',   item.expiry + ' 天'] : null,
      item.origin  != null ? ['来源',     coreName('ORIGIN_NAMES', item.origin) || item.origin] : null,
      item.agedDays != null ? ['陈年天数', item.agedDays + ' 天'] : null,
    ].filter(Boolean);

    if (attrs.length) {
      var attrGrid = el('div', {
        style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px;',
      });
      attrs.forEach(function (pair) {
        var row = el('div', { style: 'display:flex;gap:4px;font-size:11px;' });
        row.appendChild(el('span', { style: 'color:' + MUTED + ';' }, pair[0] + ':'));
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
        col.appendChild(el('span', { style: 'display:block;font-size:9px;color:' + MUTED + ';letter-spacing:.06em;' }, p.label));
        col.appendChild(el('b', { style: 'display:block;font-size:13px;color:' + p.color + ';' },
          '¤ ' + p.value.toLocaleString()));
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
      style: 'font-size:10px;color:' + MUTED + ';letter-spacing:.1em;',
    }, '▶ 战利品'));

    if (!items.length) {
      container.appendChild(el('p', { style: 'color:' + MUTED + ';font-size:12px;margin:4px 0;' }, '暂无战利品'));
      return;
    }

    var list = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
    items.forEach(function (loot) {
      var conf = typeConf(loot.type);
      var qLvl = loot.quality != null ? Math.min(5, Math.max(1, Math.round(loot.quality))) : 0;
      var row = el('div', {
        style: 'display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid ' + PHOSPHOR_DIM + ';',
      });
      row.appendChild(iconNode(loot.icon, conf.icon, 'wl-loot-icon'));
      var info = el('div', { style: 'flex:1;min-width:0;' });
      info.appendChild(el('b', { style: 'display:block;font-size:12px;color:' + PHOSPHOR + ';' }, esc(loot.name || conf.label)));
      info.appendChild(el('span', { style: 'font-size:10px;color:' + MUTED + ';' },
        conf.label + (loot.qty > 1 ? ' ×' + loot.qty : '')));
      row.appendChild(info);
      if (qLvl) {
        var dotWrap = el('span', { style: 'display:flex;gap:2px;align-items:center;' });
        for (var i = 1; i <= 5; i++) {
          dotWrap.appendChild(el('i', {
            style: 'display:inline-block;width:5px;height:5px;border-radius:50%;font-style:normal;' +
              'background:' + (i <= qLvl ? PHOSPHOR : '#263b4a') + ';',
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
  function renderBaseView(container, baseState, callbacks, options) {
    ensureStyles();
    var s = baseState || {};
    var opt = options || {};
    var facDefs = opt.defs || {};
    var facActive = opt.active || {};
    var timers = (s.timers) || {};
    var fixed = s.fixedSlots || {};
    var freeGrid = Array.isArray(s.freeGrid)
      ? s.freeGrid
      : s.freeGrid && s.freeGrid.items
        // Core grids store {item, x, y} entries keyed by item ID
        ? Object.keys(s.freeGrid.items).map(function (id) {
          var entry = s.freeGrid.items[id];
          return entry && entry.item ? Object.assign({}, entry.item, {x:entry.x, y:entry.y}) : null;
        }).filter(Boolean)
        : (s.facilities || []);
    var cb = callbacks || {};

    container.innerHTML = '';
    container.style.cssText = '';
    container.className = 'wl-base-layout';

    // Left: 4 fixed slots
    var leftPanel = el('div', {
      style: 'display:flex;flex-direction:column;gap:8px;min-width:160px;',
    });
    leftPanel.appendChild(el('span', {
      style: 'font-size:10px;color:' + MUTED + ';letter-spacing:.1em;margin-bottom:2px;',
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
      var def2 = facDefs[def.key] || {};
      // 电力本身只要通电就算运行；其余设施被断电拖累时显示为待机
      var running = installed && (facActive[def.key] !== false);
      var statusColor = running ? PHOSPHOR : (installed ? AMBER : MUTED);
      var statusLabel = !installed ? '未安装' : (running ? '运行' : '待机·断电');

      var card = el('div', {class:'wl-facility-card'});
      var row = el('div', {class:'wl-facility-card__head'});
      var led = el('i', {
        style: 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + statusColor + ';' +
          'flex:0 0 auto;font-style:normal;' + (running ? 'box-shadow:0 0 5px ' + statusColor + ';' : ''),
      });
      row.appendChild(led);
      row.appendChild(iconNode(def.icon, '🏗', 'wl-facility-icon'));
      var info = el('div', { style: 'flex:1;min-width:0;' });
      info.appendChild(el('b', { style: 'display:block;font-size:11px;color:' + PHOSPHOR + ';' }, def.label));
      info.appendChild(el('span', { style: 'font-size:9px;color:' + statusColor + ';' },
        statusLabel + (level > 0 ? ' LV' + level : '') +
        (def.key === 'power' && installed ? ' · 燃料 ' + (slot.fuel || 0) + ' 天' : '')));
      row.appendChild(info);
      card.appendChild(row);

      if (def2.desc) card.appendChild(el('p', {class:'wl-facility-card__desc'}, def2.desc));

      var actions = el('div', {class:'wl-facility-card__actions'});
      if (!installed) {
        var installBtn = el('button', {type:'button',class:'wl-btn wl-btn--sm'},
          '安装 ¤' + (def2.installCost || 0));
        installBtn.disabled = (opt.gold || 0) < (def2.installCost || 0);
        on(installBtn, 'click', function () { if (cb.onInstall) cb.onInstall(def.key); });
        actions.appendChild(installBtn);
      } else {
        if (level < 3 && def2.upgradeCost) {
          var upCost = def2.upgradeCost[level - 1];
          var upBtn = el('button', {type:'button',class:'wl-btn wl-btn--sm'},
            '升级 LV' + (level + 1) + ' ¤' + upCost);
          upBtn.disabled = (opt.gold || 0) < upCost;
          on(upBtn, 'click', function () { if (cb.onUpgrade) cb.onUpgrade(def.key); });
          actions.appendChild(upBtn);
        } else if (level >= 3) {
          actions.appendChild(el('small', {class:'wl-facility-card__max'}, '已达最高等级'));
        }
        if (def.key === 'power' && opt.fuelSkus && opt.fuelSkus.length) {
          opt.fuelSkus.forEach(function (fuel) {
            var count = opt.fuelStock && opt.fuelStock[fuel.skuId] ? opt.fuelStock[fuel.skuId] : 0;
            var fBtn = el('button', {type:'button',class:'wl-btn wl-btn--sm',
              'aria-label':'消耗' + fuel.label + '补充燃料，可维持 ' + fuel.days + ' 天'},
              '加' + fuel.label + '（' + count + '）');
            fBtn.disabled = count <= 0;
            on(fBtn, 'click', function () { if (cb.onRefuel) cb.onRefuel(fuel.skuId); });
            actions.appendChild(fBtn);
          });
        }
      }
      card.appendChild(actions);
      leftPanel.appendChild(card);
    });
    container.appendChild(leftPanel);

    // Right: 4x3 free grid (80px cells)
    var FCELL = 80;
    var FCOLS = 4, FROWS = 3;
    var rightPanel = el('div', {class:'wl-facility-panel',style:'display:flex;flex-direction:column;gap:8px;'});
    rightPanel.appendChild(el('span', {
      style: 'font-size:10px;color:' + MUTED + ';letter-spacing:.1em;',
    }, '□ 自由设施格'));

    var fOccupied = {};
    (freeGrid || []).forEach(function (facility) {
      for (var dy = 0; dy < (facility.h || 1); dy++) {
        for (var dx = 0; dx < (facility.w || 1); dx++) {
          fOccupied[(facility.x + dx) + ',' + (facility.y + dy)] = facility;
        }
      }
    });

    var fGrid = el('div', {class:'wl-facility-grid'});

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
          // 机器摆进自由格后，走的是「设施网格」这条渲染路径，
          // 而机器对象自带的只是 catalog 里的 emoji。这里按 machineKey 补一次美术索引，
          // 否则同一个熔炉在机器区有图、在网格里是 emoji。
          var slotIcon = fac.icon;
          if (fac.machineKey && window.WL_ART && window.WL_ART['machine_' + fac.machineKey]) {
            slotIcon = 'img:' + window.WL_ART['machine_' + fac.machineKey];
          }
          facDiv.appendChild(iconNode(slotIcon, '🏗', 'wl-facility-slot-icon'));
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
    // The container already carries aria-live; a second nested region made every event announce twice.
    track.appendChild(el('span', { class: 'wl-ticker__text', 'aria-hidden': 'true' }, full));
    container.appendChild(track);
  }

  // ── Legacy: renderDispatchPanel ───────────────────────────
  // ── renderDispatchPanel：派遣 —— 先选人，再选去处 ──────────
  // data: { dispatches, tiers, cap, inFlight, gold, powerOnline, visitors }
  // callbacks: { onSend(destinationKey, npcId) }
  function renderDispatchPanel(container, data, callbacks) {
    ensureStyles();
    var d = data || {}, cb = callbacks || {};
    var list  = d.dispatches || [];
    var tiers = d.tiers || {};
    var visitors = d.visitors || [];

    container.innerHTML = '';
    container.style.cssText = '';
    container.className = 'wl-dispatch';

    var head = el('div', {class:'wl-dispatch__head'});
    head.appendChild(el('h3', {class:'wl-dispatch__title'}, '派遣队'));
    head.appendChild(el('span', {class:'wl-dispatch__cap'},
      '在途 ' + (d.inFlight || 0) + ' / ' + (d.cap || 1) +
      (d.powerOnline ? '' : ' · 电力下线，名额受限')));
    container.appendChild(head);

    // 在途
    if (list.length) {
      var statusLabels = { out: '行进中', returned: '已归来', failed: '失败', waiting: '待命', active: '行进中' };
      list.forEach(function (trip) {
        if (!trip) return;
        var row = el('article', {class:'wl-dispatch-row'});
        row.appendChild(el('span', {class:'wl-dispatch-row__icon','aria-hidden':'true'}, '🧭'));
        var info = el('div', {class:'wl-dispatch-row__info'});
        info.appendChild(el('b', {}, esc(trip.npcName || '商旅') + ' → ' +
          esc((tiers[trip.destination] && tiers[trip.destination].label) || trip.destination || '?')));
        var days = trip.daysRemaining != null ? trip.daysRemaining : trip.daysLeft;
        info.appendChild(el('small', {}, days != null ? '还剩 ' + days + ' 天' : '行程未知'));
        row.appendChild(info);
        row.appendChild(el('span', {class:'wl-dispatch-row__status'}, statusLabels[trip.status] || trip.status || '—'));
        container.appendChild(row);
      });
    } else {
      container.appendChild(el('p', {class:'wl-empty'}, '目前没有在途的派遣队。'));
    }

    // 选人
    var picker = el('div', {class:'wl-dispatch__picker'});
    picker.appendChild(el('span', {class:'wl-dispatch__label'}, '派谁去'));
    if (!visitors.length) {
      picker.appendChild(el('p', {class:'wl-empty'}, '今天没有空闲的商旅可以出行。'));
      container.appendChild(picker);
      return;
    }
    var chosenId = visitors[0].id;
    var chips = el('div', {class:'wl-dispatch__chips'});
    visitors.forEach(function (visitor, index) {
      var chip = el('button', {type:'button','data-npc':visitor.id,
        class:'wl-chip' + (index === 0 ? ' wl-chip--on' : ''),
        'aria-pressed': index === 0 ? 'true' : 'false'}, visitor.name || '商旅');
      on(chip, 'click', function () {
        chosenId = visitor.id;
        // 单选：把选中态收敛到这一颗
        var all = chips.children || [];
        for (var k = 0; k < all.length; k++) {
          var node = all[k];
          if (!node.classList || !node.classList.contains('wl-chip')) continue;
          var isThis = node === chip;
          node.classList.toggle('wl-chip--on', isThis);
          node.setAttribute('aria-pressed', isThis ? 'true' : 'false');
        }
      });
      chips.appendChild(chip);
    });
    picker.appendChild(chips);
    container.appendChild(picker);

    // 选去处
    var destRow = el('div', {class:'wl-dispatch__dests'});
    ['suburb', 'midrange', 'deepzone'].forEach(function (key) {
      var tier = tiers[key];
      if (!tier) return;
      var affordable = (d.gold || 0) >= tier.fee;
      var full = (d.inFlight || 0) >= (d.cap || 1);
      var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm wl-dispatch__dest',
        'aria-label':'派遣前往' + tier.label + '，补给费 ¤' + tier.fee}, tier.label);
      // 同 disabled 的坑：el() 走 setAttribute，用属性赋值才不会落成字符串 "null"
      btn.disabled = !affordable || full;
      on(btn, 'click', function () {
        if (cb.onSend) cb.onSend(key, chosenId);
      });
      var meta = el('small', {class:'wl-dispatch__dest-meta'},
        '¤' + tier.fee + ' · ' + tier.days + '天');
      var wrap = el('div', {class:'wl-dispatch__dest-wrap'});
      wrap.appendChild(btn);
      wrap.appendChild(meta);
      destRow.appendChild(wrap);
    });
    container.appendChild(destRow);
    container.appendChild(el('p', {class:'wl-dispatch__hint'},
      '派遣是补贴：近郊风险低、收益薄；深入禁区利润高但空手概率也高，且要先付得起补给费。'));
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
    topbar.appendChild(el('span', { style: 'font-size:13px;color:' + AMBER + ';' }, '¤ ' + (state.cash || 0).toLocaleString()));
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
    container.style.cssText = '';
    container.className = 'wl-auction-content';

    container.appendChild(el('b', { style: 'font-size:14px;color:' + PHOSPHOR + ';' },
      esc(s.containerName || '未知集装箱')));

    var statusBar = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px 12px;font-size:12px;color:' + AMBER + ';' });
    statusBar.appendChild(el('span', {}, '最高价: ' + (s.currentBid != null ? s.currentBid.toLocaleString() + ' ¤' : '—')));
    statusBar.appendChild(el('span', {}, '出价方: ' + esc(s.currentBidder || '—')));
    statusBar.appendChild(el('span', {}, '回合: ' + (s.round || 1) + '/' + (s.maxRound || '?')));
    container.appendChild(statusBar);

    if (s.ended) {
      container.appendChild(el('b', {
        style: 'color:' + (s.won ? PHOSPHOR : '#ff7e8e') + ';font-size:13px;',
      }, s.won ? '拍得！成交 ¤' + (s.currentBid || 0).toLocaleString() : '未能拍到'));
    } else {
      var minBid = (s.currentBid || 0) + (s.minIncrement || 1);
      var bidRow = el('div', { style: 'display:flex;gap:6px;align-items:center;' });
      var bidInput = el('input', {
        type: 'number',
        min: String(minBid),
        step: String(s.minIncrement || 1),
        value: s.myBid != null ? String(s.myBid) : String(minBid),
        'aria-label': '竞拍出价',
        style: 'flex:1;min-width:0;min-height:44px;padding:8px;border:1px solid ' + AMBER + ';background:' + GRID_BG + ';color:' + AMBER + ';font-family:inherit;font-size:12px;',
      });
      bidRow.appendChild(bidInput);
      var bidBtn = el('button', {
        type: 'button',
        style: 'min-height:44px;padding:8px 12px;border:1px solid ' + AMBER + ';background:' + AMBER + '18;color:' + AMBER + ';cursor:pointer;font-family:inherit;font-size:12px;',
      }, '出价');
      on(bidBtn, 'click', function () {
        var amount = parseFloat(bidInput.value);
        if (!isNaN(amount) && cb.onBid) cb.onBid(amount);
      });
      bidRow.appendChild(bidBtn);
      container.appendChild(bidRow);
    }
  }

  // ── 8. renderMachineZone：机器区 + 生产排产 ───────────────
  /* data: {
   *   machines: [{id, machineKey, name, icon, w, h, level, running:{recipeId,daysLeft,totalDays}|null}],
   *   available: {machineKey: def},          // 本世界能买的机器
   *   recipes: {recipeId: def},              // 全部配方
   *   craftable: {recipeId: enabled},        // 料够不够
   *   gold, powerOnline, worldName,
   *   cols, rows, cells                      // 机器区格位（用于显示空位）
   * }
   * callbacks: { onBuy(machineKey), onProduce(machineId, recipeId) }
   */
  function renderMachineZone(container, data, callbacks) {
    ensureStyles();
    var d = data || {}, cb = callbacks || {};
    var machines = d.machines || [];
    var available = d.available || {};
    var recipes = d.recipes || {};
    var craftable = d.craftable || {};
    var cat = (window.WastelandCore && window.WastelandCore.ITEM_CATALOG) || {};

    container.innerHTML = '';
    container.className = 'wl-machines';

    // 标题由页面的 pane-heading 提供，这里只放这一节的实时状态，避免出现两个「机器区」
    var head = el('div', {class:'wl-machines__head'});
    head.appendChild(el('span', {class:'wl-machines__world'},
      esc(d.worldName || '') + ' · ' + machines.length + ' 台在架'));
    container.appendChild(head);

    var power = el('p', {class:'wl-machines__power' + (d.powerOnline ? '' : ' wl-machines__power--off')},
      d.powerOnline ? '⚡ 电力在线，机器可以开工' : '⚠ 断电：机器停工，批次原地等待，不消耗原料');
    container.appendChild(power);

    // 在架机器
    if (!machines.length) {
      container.appendChild(el('p', {class:'wl-empty'},
        '机器区还是空的。生产要在这里放机器——下面「可添置」里选一台。'));
    }
    machines.forEach(function (m) {
      var card = el('article', {class:'wl-machine'});
      var chead = el('div', {class:'wl-machine__head'});
      chead.appendChild(iconNode(m.icon, '🏗', 'wl-machine__icon'));
      var title = el('div', {class:'wl-machine__title'});
      title.appendChild(el('b', {}, esc(m.name)));
      title.appendChild(el('small', {}, 'LV' + (m.level || 1) + ' · ' + (m.w || 1) + '×' + (m.h || 1) + ' 格'));
      chead.appendChild(title);
      if (m.running) {
        chead.appendChild(el('span', {class:'wl-machine__busy'},
          '运行中 ' + (m.running.totalDays - m.running.daysLeft) + '/' + m.running.totalDays + ' 天'));
      }
      card.appendChild(chead);

      var list = el('div', {class:'wl-machine__recipes'});
      var def = (window.WastelandCore && window.WastelandCore.machineDef)
        ? window.WastelandCore.machineDef(m.machineKey) : null;
      var ids = (def && def.recipes) || [];
      ids.forEach(function (rid) {
        var recipe = recipes[rid];
        if (!recipe) return;
        var canDo = !m.running && d.powerOnline && craftable[rid];
        var row = el('div', {class:'wl-machine__recipe'});
        var label = el('div', {class:'wl-machine__recipe-label'});
        label.appendChild(el('b', {}, esc(recipe.label)));
        var ins = (recipe.inputs || []).map(function (need) {
          var sku = cat[need.skuId];
          return (sku ? sku.name : need.skuId) + '×' + need.qty;
        }).join(' + ');
        var outSku = cat[recipe.output.skuId];
        label.appendChild(el('small', {},
          ins + ' → ' + (outSku ? outSku.name : recipe.output.skuId) + '×' + recipe.output.qty +
          ' · ' + recipe.days + ' 天 · 失败率 ' + Math.round((recipe.failChance || 0) * 100) + '%'));
        row.appendChild(label);
        var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm',
          'aria-label':'在' + m.name + '上开始' + recipe.label}, '开工');
        btn.disabled = !canDo;
        on(btn, 'click', function () { if (cb.onProduce) cb.onProduce(m.id, rid); });
        row.appendChild(btn);
        list.appendChild(row);
      });
      card.appendChild(list);
      container.appendChild(card);
    });

    // 可添置的机器
    var keys = Object.keys(available);
    if (keys.length) {
      var shop = el('div', {class:'wl-machines__shop'});
      shop.appendChild(el('span', {class:'wl-machines__shop-title'}, '■ 可添置（本世界）'));
      keys.forEach(function (k) {
        var def = available[k];
        var card = el('div', {class:'wl-machine-buy'});
        var info = el('div', {class:'wl-machine-buy__info'});
        var buyHead = el('b', {});
        buyHead.appendChild(iconNode(def.icon, '🏗', 'wl-machine-buy__icon'));
        buyHead.appendChild(document.createTextNode(' ' + def.label));
        info.appendChild(buyHead);
        info.appendChild(el('small', {}, def.desc || ''));
        info.appendChild(el('small', {class:'wl-machine-buy__cost'},
          '¤' + def.cost + ' · ' + def.w + '×' + def.h + ' 格'));
        card.appendChild(info);
        var btn = el('button', {type:'button',class:'wl-btn wl-btn--sm'}, '添置 ¤' + def.cost);
        btn.disabled = (d.gold || 0) < def.cost;
        on(btn, 'click', function () { if (cb.onBuy) cb.onBuy(k); });
        card.appendChild(btn);
        shop.appendChild(card);
      });
      container.appendChild(shop);
    }

    // 在跑的批次
    var running = machines.filter(function (m) { return m.running; });
    if (running.length) {
      var prod = el('div', {class:'wl-machines__running'});
      prod.appendChild(el('span', {class:'wl-machines__shop-title'}, '■ 在跑'));
      running.forEach(function (m) {
        var recipe = recipes[m.running.recipeId];
        prod.appendChild(el('div', {class:'wl-machine-run'},
          esc(m.name) + ' · ' + esc(recipe ? recipe.label : m.running.recipeId) +
          ' · 还剩 ' + m.running.daysLeft + ' 天'));
      });
      container.appendChild(prod);
    }
  }

  // ── 9. renderWorldPicker：今天在哪一界开张 ────────────────
  /* data: { worldId, worldPlace, locked, worlds:[{id,name,mark,color,status}], day }
   * callbacks: { onPickWorld(worldId) }
   */
  function renderWorldPicker(container, data, callbacks) {
    ensureStyles();
    var d = data || {}, cb = callbacks || {};
    var worlds = d.worlds || [];

    container.innerHTML = '';
    container.className = 'wl-worlds';

    // 同上：标题交给 pane-heading，这里只说今天开在哪
    var head = el('div', {class:'wl-worlds__head'});
    head.appendChild(el('span', {class:'wl-worlds__place'},
      '第 ' + (d.day || 1) + ' 天 · 开在' + esc(d.worldPlace || '空间夹层')));
    container.appendChild(head);

    var grid = el('div', {class:'wl-worlds__grid'});
    worlds.forEach(function (w) {
      var playable = w.status === 'playable';
      var active = w.id === d.worldId;
      var card = el('button', {
        type: 'button',
        class: 'wl-world' + (active ? ' wl-world--active' : '') + (playable ? '' : ' wl-world--wip'),
        'aria-pressed': active ? 'true' : 'false',
      });
      card.appendChild(el('span', {class:'wl-world__mark','aria-hidden':'true'}, w.mark || '◇'));
      card.appendChild(el('b', {class:'wl-world__name'}, esc(w.name)));
      card.appendChild(el('small', {class:'wl-world__status'},
        !playable ? '开发中' : (active ? '今天在这里' : '可转场')));
      // 开发中的世界是死按钮，但保留在那里，让玩家看得见规划
      card.disabled = !playable || active || d.locked;
      on(card, 'click', function () { if (cb.onPickWorld) cb.onPickWorld(w.id); });
      grid.appendChild(card);
    });
    container.appendChild(grid);

    if (d.locked) {
      container.appendChild(el('p', {class:'wl-worlds__note'},
        '今天已经开张接客，换世界要等明天结束营业。'));
    }
  }

  // ── mount / unmount helpers ──────────────────────────────
  function mount(node, fn) { if (fn) fn(node); }
  function unmount(node) { if (node) node.innerHTML = ''; }

  // ── 公开 API ─────────────────────────────────────────────
  window.WastelandUI = {
    VERSION: '3',
    // New CRT functions
    worldForNpc: worldForNpc,
    renderGrid: renderGrid,
    renderCounter: renderCounter,
    renderNpcQueue: renderNpcQueue,
    renderMarketBoard: renderMarketBoard,
    renderEventLog: renderEventLog,
    renderContacts: renderContacts,
    renderItemDetail: renderItemDetail,
    renderLootClaim: renderLootClaim,
    renderBaseView: renderBaseView,
    renderMachineZone: renderMachineZone,
    renderWorldPicker: renderWorldPicker,
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
