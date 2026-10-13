/* wasteland-shop.js – 废土杂货铺主入口
 * 依赖加载顺序：WastelandCore → WastelandNPC → WastelandUI → 本文件
 * 挂载点：<div id="wastelandShopMount"></div>
 */
(function (root) {
  'use strict';

  var Core, NPC, UI;
  var state          = null;
  var host           = null;
  var prices         = {};   // itemId → {retail, purchase}
  var selectedItemId = null; // 当前选中物品 id

  // ── 格子适配器（Core.grid → UI.renderGrid 期待的格式）────────
  function adaptGrid(coreGrid, selId) {
    var cells = Object.values(coreGrid.items).map(function (entry) {
      var item = entry.item;
      return {
        id:      item.id,
        type:    item.type,
        w:       item.w,
        h:       item.h,
        x:       entry.x,
        y:       entry.y,
        name:    item.name,
        genuine: item.genuine,
        quality: item.quality,
        fake:    !item.genuine
      };
    });
    return { cols: coreGrid.cols, rows: coreGrid.rows, cells: cells, selectedId: selId || null };
  }

  // ── 初始游戏状态 ───────────────────────────────────────────
  function createInitialState() {
    var grid    = Core.createGrid(10, 8);
    var market  = Core.createMarketState();
    var rep     = NPC.createReputation();
    var fbQueue = NPC.createFeedbackQueue();

    // 几件初始物品
    var water = Core.createItem('water', 1, 1, 3, true,  7, 'trade');
    var food  = Core.createItem('food',  2, 1, 2, true,  5, 'salvage');
    var metal = Core.createItem('metal', 1, 2, 3, true, null, 'salvage');
    Core.place(grid, water, 0, 0);
    Core.place(grid, food,  2, 0);
    Core.place(grid, metal, 5, 0);

    return {
      day:        1,
      week:       1,
      gold:       200,
      rent:       80,
      grid:       grid,
      market:     market,
      reputation: rep,
      fbQueue:    fbQueue,
      playerSkill: { identify: 0, negotiate: 0, health: 100 },
      todayNPCs:  [],
      todayEvents:[],
      auction:    null,
      phase:      'shop'
    };
  }

  // ── 今日 NPC ───────────────────────────────────────────────
  function generateDailyNPCs() {
    var n = 2 + Math.floor(Math.random() * 4);
    var list = [];
    for (var i = 0; i < n; i++) {
      list.push(NPC.generateNPC(Math.random() < 0.7 ? 'customer' : 'dispatcher'));
    }
    return list;
  }

  // ── 今日事件对象（UI 期待 {id,hour,type,label,desc,resolved}）──
  function makeEvent(type, label, desc, hour) {
    return {
      id:       type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      hour:     hour != null ? hour : (8 + Math.floor(Math.random() * 10)),
      type:     type,
      label:    label,
      desc:     desc || '',
      resolved: false
    };
  }

  function makeNPCVisitEvent(npc) {
    var tags = npc.tags || [];
    var desc = '身份：' + (tags[0] || '不明') + '　资金：约 ' + npc.funds + ' 元';
    return makeEvent('npc_visit', npc.name + ' 来访', desc);
  }

  // ── 价格列表（UI 期待 [{id,name,type,retail,purchase}]）──────
  function buildPriceList(grid) {
    var seen = {};
    var list = [];
    Object.keys(grid.items).forEach(function (id) {
      var item = grid.items[id].item;
      if (seen[item.type]) return;
      seen[item.type] = true;
      var base = Core.computePrice(state.market, item);
      if (!prices[item.id]) prices[item.id] = { retail: Math.round(base * 1.3), purchase: Math.round(base * 0.7) };
      list.push({
        id:       item.id,
        name:     item.name,
        type:     item.type,
        retail:   prices[item.id].retail,
        purchase: prices[item.id].purchase
      });
    });
    return list;
  }

  // ── 周拍卖 ─────────────────────────────────────────────────
  function createAuctionState() {
    var tiers = ['low', 'mid', 'high'];
    var tier  = tiers[Math.floor(Math.random() * tiers.length)];
    var clueCount = tier === 'low' ? 1 : tier === 'mid' ? 2 : 3;
    var cluePool = [
      '箱体重量约 40kg，偏轻',
      '锁具品牌：Rexar（工业级）',
      '来源港口：东区第七仓储',
      '外壳有明显撞击痕迹',
      '上一持有人职业：医疗工作者',
      '发出轻微金属摩擦声',
      '来源记录：军事物资清单'
    ];
    var used = {};
    var clues = [];
    while (clues.length < clueCount) {
      var c = cluePool[Math.floor(Math.random() * cluePool.length)];
      if (!used[c]) { used[c] = true; clues.push({ id: 'c' + clues.length, label: c, revealed: true }); }
    }
    var base = tier === 'low' ? 80 : tier === 'mid' ? 200 : 500;
    var competitors = [];
    var aiCount = 2 + Math.floor(Math.random() * 3);
    for (var j = 0; j < aiCount; j++) competitors.push(NPC.generateNPC('bidder'));
    return {
      tier:          tier,
      containerName: ['神秘货柜 #' + (100 + Math.floor(Math.random() * 900)), '封存集装箱', '旧军供箱'][Math.floor(Math.random() * 3)],
      clues:         clues,
      basePrice:     base,
      currentBid:    base,
      currentLeader: null,
      minIncrement:  Math.max(10, Math.floor(base * 0.05)),
      competitors:   competitors,
      round:         0,
      maxRounds:     5 + Math.floor(Math.random() * 4),
      done:          false,
      playerWon:     false
    };
  }

  // ── 结束今天 ────────────────────────────────────────────────
  function endDay() {
    // 延迟反馈触发
    var fired = state.fbQueue.tick();
    fired.forEach(function (fb) {
      state.todayEvents.push(makeEvent('feedback', fb.label || '有人反馈了你的商品', fb.desc || ''));
      if (fb.repEffect) NPC.applyEffect(state.reputation, fb.repEffect);
    });

    Core.advanceDay(state);
    state.day += 1;

    if (state.day % 7 === 1) {
      state.week += 1;
      state.gold -= state.rent;
      var rentEv = state.gold < 0
        ? makeEvent('rent', '⚠ 租金扣除失败', '账户余额不足 ' + state.rent + ' 元。信誉受损。', 0)
        : makeEvent('rent', '租金已扣除', '本周租金 ' + state.rent + ' 元已结算。', 0);
      rentEv.resolved = true;
      state.todayEvents = [rentEv];
      state.auction = createAuctionState();
      state.todayEvents.push(makeEvent('auction_open', '集装箱拍卖开启', '本周拍卖已开始，共 ' + (state.auction.competitors.length + 1) + ' 名竞拍者。', 9));
    } else {
      state.todayEvents = [];
    }

    state.todayNPCs = generateDailyNPCs();
    state.todayNPCs.forEach(function (npc) {
      state.todayEvents.push(makeNPCVisitEvent(npc));
    });

    Core.saveGame(state);
    render();
  }

  // ── 处理事件（NPC 来访）──────────────────────────────────────
  function resolveEvent(evId) {
    var ev = state.todayEvents.find(function (e) { return e.id === evId; });
    if (!ev || ev.resolved || ev.type !== 'npc_visit') return;

    // 找到对应 NPC
    var npc = state.todayNPCs.find(function (n) { return makeNPCVisitEvent(n).label === ev.label; });
    if (!npc) { ev.resolved = true; render(); return; }

    // NPC 有物品卖给玩家，或者想买玩家的东西
    var gridItems = Object.values(state.grid.items).map(function (e) { return e.item; });
    if (gridItems.length > 0 && Math.random() > 0.4) {
      // NPC 想买
      var item = gridItems[Math.floor(Math.random() * gridItems.length)];
      var base  = Core.computePrice(state.market, item);
      var price = NPC.negotiatePrice(npc, item, base);
      state.gold += price;
      Core.remove(state.grid, item.id);
      ev.desc += '　→ 购买了你的【' + item.name + '】，成交 ' + price + ' 元。';
      var verdict = NPC.evaluateTrade(npc, item, state.playerSkill.identify);
      if (verdict.verdict === 'fake' && !item.genuine) {
        // 卖假货，延迟反馈
        var delay = 1 + Math.floor(Math.random() * 3);
        state.fbQueue.add({
          label: npc.name + ' 发现商品有问题',
          desc:  '购买的【' + item.name + '】被认定为假货。',
          repEffect: { overall: -5 }
        }, delay);
      }
    } else {
      // NPC 带东西来卖
      var sellItem = Core.createItem(
        ['water', 'food', 'metal', 'junk'][Math.floor(Math.random() * 4)],
        1, 1,
        1 + Math.floor(Math.random() * 3),
        Math.random() > 0.2,
        null,
        'salvage'
      );
      var sellPrice = Math.round(Core.computePrice(state.market, sellItem) * 0.6);
      if (state.gold >= sellPrice && Core.canPlace(state.grid, sellItem, 0, 4)) {
        state.gold -= sellPrice;
        Core.place(state.grid, sellItem, 0, 4);
        ev.desc += '　→ 向你出售了【' + sellItem.name + '】，花费 ' + sellPrice + ' 元。';
      } else {
        ev.desc += '　→ 空手离开（仓库满或资金不足）。';
      }
    }

    ev.resolved = true;
    Core.saveGame(state);
    render();
  }

  // ── 出价 ────────────────────────────────────────────────────
  function playerBid(amount) {
    var auc = state.auction;
    if (!auc || auc.done) return;
    var bid = parseInt(amount, 10);
    var minNeeded = auc.currentBid + auc.minIncrement;
    if (isNaN(bid) || bid < minNeeded) {
      state.todayEvents.push(makeEvent('bid_fail', '出价无效', '最低需要 ' + minNeeded + ' 元。'));
      render(); return;
    }
    auc.currentBid    = bid;
    auc.currentLeader = 'player';

    // AI 竞价
    auc.competitors.forEach(function (npc) {
      var aiMax = NPC.negotiatePrice(npc, { basePrice: auc.basePrice, type: 'auction' }, auc.basePrice);
      if (typeof aiMax === 'number' && aiMax > auc.currentBid && Math.random() > 0.45) {
        auc.currentBid    = auc.currentBid + auc.minIncrement;
        auc.currentLeader = npc.name;
      }
    });
    auc.round += 1;

    if (auc.round >= auc.maxRounds) {
      auc.done = true;
      auc.playerWon = (auc.currentLeader === 'player');
      if (auc.playerWon) {
        state.gold -= auc.currentBid;
        var prize = Core.createItem('junk', 2, 2, 1 + Math.floor(Math.random() * 4), Math.random() > 0.3, null, 'auction');
        var placed = false;
        for (var row = 0; row < 6 && !placed; row++) {
          for (var col = 0; col < 8 && !placed; col++) {
            if (Core.canPlace(state.grid, prize, col, row)) { Core.place(state.grid, prize, col, row); placed = true; }
          }
        }
        state.todayEvents.push(makeEvent('auction_won', '🎉 拍卖成功', '花费 ' + auc.currentBid + ' 元拍得集装箱。' + (placed ? '货物已入库。' : '仓库已满，货物丢失！')));
      } else {
        state.todayEvents.push(makeEvent('auction_lost', '拍卖结束', '最终成交价 ' + auc.currentBid + ' 元，由 ' + auc.currentLeader + ' 拍得。'));
      }
    }
    Core.saveGame(state);
    render();
  }

  // ── 价格调整 ────────────────────────────────────────────────
  function setPrice(itemId, field, value) {
    if (!prices[itemId]) prices[itemId] = {};
    prices[itemId][field] = value;
    render();
  }

  // ── 事件列表渲染 ─────────────────────────────────────────────
  function renderEventsList(container, events) {
    container.innerHTML = '';
    if (!events || events.length === 0) {
      var p = document.createElement('p');
      p.className = 'wl-empty';
      p.textContent = '今日暂无事件，静待时机。';
      container.appendChild(p);
      return;
    }
    events.forEach(function (ev) {
      var card = document.createElement('div');
      card.className = 'wl-event-card' + (ev.resolved ? ' wl-event-card--resolved' : '');
      card.dataset.type = ev.type || 'default';

      var head = document.createElement('div');
      head.className = 'wl-event-card__head';

      var hourSpan = document.createElement('span');
      hourSpan.className = 'wl-event-card__hour';
      hourSpan.textContent = ev.hour != null ? ev.hour + ':00' : '—';

      var labelSpan = document.createElement('span');
      labelSpan.className = 'wl-event-card__label';
      labelSpan.textContent = ev.label || ev.type;

      head.appendChild(hourSpan);
      head.appendChild(labelSpan);

      if (ev.resolved) {
        var doneSpan = document.createElement('span');
        doneSpan.className = 'wl-event-card__done';
        doneSpan.textContent = '✔';
        head.appendChild(doneSpan);
      }
      card.appendChild(head);

      if (ev.desc) {
        var descP = document.createElement('p');
        descP.className = 'wl-event-card__desc';
        descP.textContent = ev.desc;
        card.appendChild(descP);
      }

      if (!ev.resolved && ev.type === 'npc_visit') {
        var btn = document.createElement('button');
        btn.className = 'wl-btn wl-btn--sm';
        btn.type = 'button';
        btn.textContent = '处理';
        btn.addEventListener('click', (function (capturedId) {
          return function () { resolveEvent(capturedId); };
        }(ev.id)));
        card.appendChild(btn);
      }
      container.appendChild(card);
    });
  }

  // ── 渲染 ────────────────────────────────────────────────────
  function render() {
    if (!host || !state) return;

    // 更新状态栏
    var statDay = document.getElementById('wl-stat-day');
    if (statDay) statDay.textContent = '第 ' + state.day + ' 天 · 第 ' + state.week + ' 周';

    var statCash = document.getElementById('wl-stat-cash');
    if (statCash) statCash.textContent = '¥ ' + state.gold.toLocaleString();

    var statRep = document.getElementById('wl-stat-rep');
    if (statRep) statRep.textContent = '声誉 ' + ((state.reputation && state.reputation.overall) || 0);

    var rentEl = document.getElementById('wl-rent-countdown');
    if (rentEl) {
      var daysLeft = 7 - ((state.day - 1) % 7);
      rentEl.textContent = daysLeft + ' 天后结算租金 ¥' + state.rent;
    }

    var hdrStatus = document.getElementById('game-header-status');
    if (hdrStatus) hdrStatus.textContent = '第 ' + state.day + ' 天 · ¥' + state.gold;

    // 构建回调
    var cb = {
      onEndDay:       endDay,
      onBid:          playerBid,
      onResolveEvent: resolveEvent,
      onSetPrice:     setPrice,
      onSelect: function (itemId) {
        selectedItemId = itemId;
        var entry = state.grid.items[itemId];
        var detailEl = document.getElementById('wl-detail');
        if (detailEl && entry) {
          UI.renderItemDetail(detailEl, entry.item, [], state.playerSkill.identify);
          detailEl.dataset.hasItem = '1';
        }
        // 重绘格子以更新选中高亮
        var gEl = document.getElementById('wl-grid');
        if (gEl) UI.renderGrid(gEl, adaptGrid(state.grid, selectedItemId), cb);
      },
      onDrop: function (payload) {
        var itemId = payload.itemId;
        var toX    = payload.toX;
        var toY    = payload.toY;
        var entry  = state.grid.items[itemId];
        if (!entry) return;
        var item  = entry.item;
        var origX = entry.x;
        var origY = entry.y;
        Core.remove(state.grid, itemId);
        if (Core.canPlace(state.grid, item, toX, toY)) {
          Core.place(state.grid, item, toX, toY);
        } else {
          // 目标位置无法放置，还原
          Core.place(state.grid, item, origX, origY);
        }
        render();
      }
    };

    // 渲染格子仓库
    var gridEl = document.getElementById('wl-grid');
    if (gridEl) UI.renderGrid(gridEl, adaptGrid(state.grid, selectedItemId), cb);

    // 渲染事件列表
    var eventsEl = document.getElementById('wl-events');
    if (eventsEl) renderEventsList(eventsEl, state.todayEvents || []);

    // 物品详情面板
    var detailEl = document.getElementById('wl-detail');
    if (detailEl) {
      if (selectedItemId && state.grid.items[selectedItemId]) {
        UI.renderItemDetail(detailEl, state.grid.items[selectedItemId].item, [], state.playerSkill.identify);
        detailEl.dataset.hasItem = '1';
      } else {
        selectedItemId = null;
        delete detailEl.dataset.hasItem;
        detailEl.innerHTML = '<p class="wl-empty">点击仓库中的物品查看详情。</p>';
      }
    }

    // 拍卖面板
    var aucWrap = document.getElementById('wl-auction-wrap');
    var aucEl   = document.getElementById('wl-auction');
    var auc     = state.auction;
    if (aucEl) {
      if (auc && !auc.done) {
        if (aucWrap) aucWrap.style.display = '';
        UI.renderAuction(aucEl, {
          containerName: auc.containerName,
          tier:          auc.tier,
          clues:         auc.clues,
          currentBid:    auc.currentBid,
          currentBidder: auc.currentLeader || '—',
          minIncrement:  auc.minIncrement,
          round:         auc.round,
          maxRound:      auc.maxRounds,
          ended:         false
        }, cb);
      } else if (auc && auc.done) {
        if (aucWrap) aucWrap.style.display = '';
        UI.renderAuction(aucEl, {
          containerName: auc.containerName,
          tier:          auc.tier,
          clues:         auc.clues,
          currentBid:    auc.currentBid,
          ended:         true,
          won:           auc.playerWon
        }, cb);
      } else {
        if (aucWrap) aucWrap.style.display = 'none';
      }
    }
  }

  // ── 入口 ────────────────────────────────────────────────────
  function mount() {
    host = root.document && root.document.getElementById('wastelandShopMount');
    if (!host) return null;
    Core = root.WastelandCore;
    NPC  = root.WastelandNPC;
    UI   = root.WastelandUI;
    if (!Core || !NPC || !UI) {
      host.innerHTML = '<p style="color:#ff718e;padding:2rem">模块加载失败，请刷新重试。</p>';
      return null;
    }

    // 加载或新建存档
    var saved = null;
    try { saved = Core.loadGame(); } catch (e) { saved = null; }
    state = saved || createInitialState();

    // 重置当日状态（存档不保存 NPC 和事件，重开时重新生成）
    state.todayNPCs   = generateDailyNPCs();
    state.todayEvents = [];
    if (!state.fbQueue || typeof state.fbQueue.tick !== 'function') {
      state.fbQueue = NPC.createFeedbackQueue();
    }
    state.todayEvents.push(makeEvent('welcome', '开始新的一天', '第 ' + state.day + ' 天，余额 ' + state.gold + ' 元。今日有 ' + state.todayNPCs.length + ' 位访客。', 8));
    state.todayNPCs.forEach(function (npc) {
      state.todayEvents.push(makeNPCVisitEvent(npc));
    });
    if (state.week > 1 && !state.auction) {
      state.auction = createAuctionState();
    }

    // 绑定结束今天按钮
    var endDayBtn = document.getElementById('wl-end-day-btn');
    if (endDayBtn) endDayBtn.onclick = endDay;

    root.NeonGameBooted = true;
    render();
    return {};
  }

  root.WastelandShop = {
    enter: mount,
    leave: function () {
      if (state && Core) Core.saveGame(state);
      host           = null;
      selectedItemId = null;
    },
    VERSION: '1'
  };

}(window));
