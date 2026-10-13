/* wasteland-shop.js – 废土杂货铺主入口
 * 依赖：WastelandCore, WastelandNPC, WastelandUI（按顺序加载）
 * 挂载点：<div id="wastelandShopMount"></div>
 */
(function (root) {
  'use strict';

  var Core, NPC, UI;
  var state = null;      // 当前游戏状态
  var host  = null;      // DOM 挂载点

  // ── 初始游戏状态 ─────────────────────────────────────────
  function createInitialState() {
    var grid = Core.createGrid(10, 8);
    var market = Core.createMarketState();
    var rep = NPC.createReputation();
    var feedback = NPC.createFeedbackQueue();

    // 初始物品：几件用于教程
    var water = Core.createItem('water', 1, 1, 3, true, 7, 'trade');
    var food  = Core.createItem('food',  2, 1, 2, true, 5, 'salvage');
    var metal = Core.createItem('metal', 1, 2, 3, true, null, 'salvage');
    Core.place(grid, water, 0, 0);
    Core.place(grid, food,  2, 0);
    Core.place(grid, metal, 5, 0);

    return {
      day:        1,
      week:       1,
      gold:       200,          // 起始资金
      rent:       80,           // 每周租金
      grid:       grid,
      market:     market,
      reputation: rep,
      feedback:   feedback,
      playerSkill: {
        identify: 0,            // 鉴定熟练度 0-100
        negotiate: 0,
        health: 100
      },
      inventory:  {},           // itemId → item（从 grid 中取）
      todayNPCs:  [],           // 今日上门 NPC 列表
      todayEvents:[],           // 今日事件日志
      auction: null,            // 当前拍卖场状态（每周一场）
      phase: 'shop',            // shop | auction | end
      pendingDayResult: null
    };
  }

  // ── 今日 NPC 生成（每天 2-5 个） ─────────────────────────
  function generateDailyNPCs() {
    var count = 2 + Math.floor(Math.random() * 4);
    var npcs = [];
    for (var i = 0; i < count; i++) {
      npcs.push(NPC.generateNPC(Math.random() < 0.7 ? 'customer' : 'dispatcher'));
    }
    return npcs;
  }

  // ── 周拍卖状态 ──────────────────────────────────────────
  function createAuctionState() {
    var tiers = ['low', 'mid', 'high'];
    var tier = tiers[Math.floor(Math.random() * tiers.length)];
    var clueCount = tier === 'low' ? 1 : tier === 'mid' ? 2 : 3;
    var clues = [];
    var cluePool = [
      '箱体重量约 40kg，偏轻',
      '锁具品牌：Rexar（工业级）',
      '来源港口：东区第七仓储',
      '外壳有明显撞击痕迹',
      '上一持有人职业：医疗工作者',
      '发出轻微金属摩擦声',
      '来源记录：军事物资清单'
    ];
    for (var i = 0; i < clueCount; i++) {
      clues.push(cluePool[Math.floor(Math.random() * cluePool.length)]);
    }
    var basePrice = tier === 'low' ? 80 : tier === 'mid' ? 200 : 500;
    var aiCount = 2 + Math.floor(Math.random() * 3);
    var competitors = [];
    for (var j = 0; j < aiCount; j++) {
      competitors.push(NPC.generateNPC('bidder'));
    }
    return {
      tier: tier,
      clues: clues,
      basePrice: basePrice,
      currentBid: basePrice,
      currentLeader: null,
      minIncrement: Math.floor(basePrice * 0.05),
      competitors: competitors,
      round: 0,
      maxRounds: 5 + Math.floor(Math.random() * 4),
      done: false,
      playerWon: false
    };
  }

  // ── 日结算 ───────────────────────────────────────────────
  function endDay() {
    var result = Core.advanceDay(state);
    // 消费延迟反馈
    var events = NPC.createFeedbackQueue().tick
      ? [] : [];
    state.day += 1;
    if (state.day % 7 === 1) {
      state.week += 1;
      state.gold -= state.rent;
      state.todayEvents.push('本周租金已扣除：' + state.rent + ' 元');
      if (state.gold < 0) {
        state.todayEvents.push('⚠ 资金不足，无法支付租金！');
      }
      state.auction = createAuctionState();
    }
    state.todayNPCs = generateDailyNPCs();
    state.todayEvents = ['第 ' + state.day + ' 天开始。今日有 ' + state.todayNPCs.length + ' 位访客。'];
    Core.saveGame(state);
    render();
  }

  // ── 出价逻辑 ─────────────────────────────────────────────
  function playerBid(amount) {
    var auc = state.auction;
    if (!auc || auc.done) return;
    var bid = parseInt(amount, 10);
    if (isNaN(bid) || bid < auc.currentBid + auc.minIncrement) {
      state.todayEvents.push('出价无效，至少需要 ' + (auc.currentBid + auc.minIncrement) + ' 元');
      render(); return;
    }
    auc.currentBid = bid;
    auc.currentLeader = 'player';
    // AI 竞价回合
    auc.competitors.forEach(function (npc) {
      var aiMax = NPC.negotiatePrice(npc, {basePrice: auc.basePrice, type: 'auction'}, auc.basePrice);
      if (aiMax > auc.currentBid && Math.random() > 0.4) {
        auc.currentBid = auc.currentBid + auc.minIncrement;
        auc.currentLeader = npc.name;
      }
    });
    auc.round += 1;
    if (auc.round >= auc.maxRounds || auc.currentLeader === 'player') {
      auc.done = true;
      auc.playerWon = auc.currentLeader === 'player';
      if (auc.playerWon) {
        state.gold -= auc.currentBid;
        var prize = Core.createItem('junk', 2, 2, 2 + Math.floor(Math.random() * 3), Math.random() > 0.3, null, 'auction');
        Core.place(state.grid, prize, 0, 4);
        state.todayEvents.push('🎉 拍卖成功！花费 ' + auc.currentBid + ' 元。集装箱已送入仓库。');
      } else {
        state.todayEvents.push('拍卖结束，未能拍得。最终价格：' + auc.currentBid + ' 元。');
      }
    }
    render();
  }

  // ── 交易处理 ─────────────────────────────────────────────
  function handleTrade(npc, item, mode) {
    // mode: 'buy' 玩家买入, 'sell' 玩家卖出
    var price = NPC.negotiatePrice(npc, item, Core.computePrice(state.market, item));
    var verdict = NPC.evaluateTrade(npc, item, state.playerSkill.identify);
    if (mode === 'sell') {
      state.gold += price;
      state.todayEvents.push(npc.name + ' 购买了 ' + item.name + '，成交 ' + price + ' 元。');
      var outcome = NPC.resolveOutcome(npc, item, verdict);
      if (outcome !== 'nothing') {
        NPC.applyEffect(state.reputation, { type: outcome, item: item, npc: npc });
      }
    } else {
      if (state.gold >= price) {
        state.gold -= price;
        Core.place(state.grid, item, 0, 6);
        state.todayEvents.push('从 ' + npc.name + ' 处收购了 ' + item.name + '，花费 ' + price + ' 元。');
      } else {
        state.todayEvents.push('资金不足，无法收购。');
      }
    }
    render();
  }

  // ── 渲染 ─────────────────────────────────────────────────
  function render() {
    if (!host || !state) return;
    var callbacks = {
      onEndDay:   endDay,
      onBid:      playerBid,
      onTrade:    handleTrade,
      onItemClick: function (item) {
        var panel = host.querySelector('.wl-detail-panel');
        if (panel) UI.renderItemDetail(panel, item, [], state.playerSkill.identify);
      }
    };
    UI.renderShopFloor(host, {
      day:       state.day,
      week:      state.week,
      gold:      state.gold,
      rent:      state.rent,
      grid:      state.grid,
      market:    state.market,
      reputation: state.reputation,
      npcs:      state.todayNPCs,
      events:    state.todayEvents,
      auction:   state.auction,
      phase:     state.phase
    }, callbacks);
    if (state.grid) {
      var gridEl = host.querySelector('#wl-grid');
      if (gridEl) UI.renderGrid(gridEl, state.grid, callbacks);
    }
    if (state.auction && !state.auction.done) {
      var aucEl = host.querySelector('#wl-auction');
      if (aucEl) UI.renderAuction(aucEl, state.auction, callbacks);
    }
  }

  // ── 入口 ─────────────────────────────────────────────────
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
    // 尝试恢复存档，否则新游戏
    state = Core.loadGame() || createInitialState();
    state.todayNPCs   = generateDailyNPCs();
    state.todayEvents = ['欢迎回到废土杂货铺。第 ' + state.day + ' 天。'];
    render();
    return { leave: function () { host.innerHTML = ''; host = null; } };
  }

  root.WastelandShop = { enter: mount, leave: function () {}, VERSION: '1' };

}(window));
