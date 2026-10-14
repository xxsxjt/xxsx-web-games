/* wasteland-shop.js – 废土杂货铺主入口 v3
 * 依赖加载顺序：WastelandCore → WastelandNPC → WastelandUI → 本文件
 * 挂载点：<div id="wastelandShopMount"></div>
 */
(function (root) {
  'use strict';

  var Core, NPC, UI;
  var state          = null;
  var host           = null;
  var selectedItemId = null;

  // ── 物品类目颜色映射（供 adaptGrid 使用）─────────────────────
  var CATEGORY_COLOR = {
    water:     '#3abfff',
    alcohol:   '#ff8c20',
    chemical:  '#ff66c4',
    food:      '#3dcc7a',
    material:  '#e6b820',
    tech:      '#00d8e6',
    medicine:  '#9a5cff',
    equipment: '#6a8aaa',
    illegal:   '#ff2020',
    misc:      '#7a8fa8'
  };

  // ── adaptGrid：Core.grid → UI.renderGrid 期待的格式 ──────────
  // 从 ITEM_CATALOG 取 icon/color
  function adaptGrid(coreGrid, selId) {
    if (!coreGrid || !coreGrid.items) {
      return { cols: 10, rows: 8, cells: [], selectedId: null };
    }
    var catalog = Core.ITEM_CATALOG || {};
    var cells = Object.values(coreGrid.items).filter(function (entry) {
      return entry && entry.item && entry.item.w && entry.item.h;
    }).map(function (entry) {
      var item = entry.item;
      var sku  = catalog[item.skuId] || {};
      var cat  = item.category || sku.category || 'misc';
      return {
        id:      item.id,
        type:    cat,
        w:       item.w,
        h:       item.h,
        x:       entry.x,
        y:       entry.y,
        name:    item.name,
        genuine: item.genuine,
        quality: item.quality,
        fake:    !item.genuine,
        icon:    sku.icon || item.icon || '📦',
        color:   CATEGORY_COLOR[cat] || '#7a8fa8'
      };
    });
    return {
      cols:       coreGrid.cols || 10,
      rows:       coreGrid.rows || 8,
      cells:      cells,
      selectedId: selId || null
    };
  }

  // ── 初始化仓库放入几件起始物品 ─────────────────────────────
  var STARTER_SKUS = [
    'water_bottle_500', 'canned_meat', 'iron_ingot_1kg', 'bandage_roll', 'junk_metal'
  ];

  function _placeStarterItems(grid) {
    STARTER_SKUS.forEach(function (skuId) {
      try {
        var item = Core.createItem(skuId, { quality: 3, genuine: true, origin: 'trade' });
        for (var row = 0; row < grid.rows; row++) {
          var done = false;
          for (var col = 0; col < grid.cols; col++) {
            if (Core.canPlace(grid, item, col, row)) {
              Core.place(grid, item, col, row);
              done = true; break;
            }
          }
          if (done) break;
        }
      } catch (e) { /* SKU 不存在时跳过 */ }
    });
  }

  // ── 初始游戏状态 ──────────────────────────────────────────
  function createInitialState() {
    var grid    = Core.createGrid(10, 8);
    var market  = Core.createMarketState();
    var rep     = NPC.createReputation();
    var fbQueue = NPC.createFeedbackQueue();
    _placeStarterItems(grid);
    return {
      day:   1,
      week:  1,
      gold:  200,
      rent:  80,
      grid:  grid,
      market: market,
      reputation: rep,
      fbQueue:    fbQueue,
      playerSkill: {
        identify: { water: 0, food: 0, material: 0, medicine: 0 },
        negotiate: 0,
        health:    100
      },
      dispatches:   [],
      returnedLoot: [],
      baseState: {
        fixedSlots: {
          power:          { installed: false, level: 0, fuel: 0 },
          security:       { installed: false, level: 0 },
          water_purifier: { installed: false, level: 0 },
          storage:        { installed: false, level: 0 }
        },
        freeGrid:   Core.createGrid(4, 3),
        facilities: []
      },
      prices: {},
      counterState: {
        npcId:    null,
        slots:    [null, null, null, null, null, null],
        phase:    'idle',
        offer:    null,
        attitude: 1.0
      },
      todayNPCs:   [],
      todayEvents: [],
      auction:     null,
      activeView:  'shop'
    };
  }

  // ── NPC 角色配置表 ─────────────────────────────────────────
  var NPC_ROLE_CONFIGS = [
    {
      role: 'scavenger',  label: '拾荒者',
      budgetRange: [50, 120],  wantCategories: ['water', 'food'],
      premium: 0.65, intel: false, bulk: false
    },
    {
      role: 'trader',     label: '商人',
      budgetRange: [100, 300], wantCategories: ['material', 'tech'],
      premium: 0.80, intel: false, bulk: false
    },
    {
      role: 'medic',      label: '医护',
      budgetRange: [150, 400], wantCategories: ['medicine'],
      premium: 0.90, intel: false, bulk: false
    },
    {
      role: 'informant',  label: '情报贩子',
      budgetRange: [0, 0],     wantCategories: [],
      premium: 1.00, intel: true,  bulk: false
    },
    {
      role: 'collector',  label: '收藏家',
      budgetRange: [200, 500], wantCategories: ['alcohol'],
      premium: 1.00, intel: false, bulk: false, wantAged: true
    },
    {
      role: 'contractor', label: '工地采购',
      budgetRange: [150, 400], wantCategories: ['material'],
      excludeCategories: ['medicine', 'tech'],
      premium: 0.75, intel: false, bulk: true
    }
  ];

  var NPC_SURNAMES = ['陈', '王', '李', '张', '刘', '赵', '周', '吴', '郑', '孙', '钟', '林'];
  var NPC_GIVENS   = ['铁', '锋', '义', '柱', '漠', '砂', '荒', '沛', '烛', '砾', '尘', '卯'];

  function _randomNpcName() {
    var s = NPC_SURNAMES[Math.floor(Math.random() * NPC_SURNAMES.length)];
    var g = NPC_GIVENS[Math.floor(Math.random() * NPC_GIVENS.length)];
    return s + g;
  }

  var INTEL_TEXTS = [
    '东区仓库三天内将有大批药品入市，囤药风险上升。',
    '本周执法队将突击检查中央市场——违禁品暂时收起。',
    '某势力正批量收购电子元件，tech 类物资价格即将上涨。',
    '上周有商人被抢，治安恶化，今日客流减少约两成。',
    '有买家愿意高价收购陈年酒，可开价高达市价三倍。',
    '附近一处废墟刚被清理，战利品品质普遍为良好以上。',
    '医护派系资金充裕，近期大量采购外科手术包。',
    '情报：下周集装箱拍卖将出现高档货，建议储备资金。'
  ];

  function _pickIntelText() {
    return INTEL_TEXTS[Math.floor(Math.random() * INTEL_TEXTS.length)];
  }

  // ── generateDailyNPCs：2-5个NPC，各有budget/wants/role ────────
  function generateDailyNPCs() {
    var n = 2 + Math.floor(Math.random() * 4); // 2-5
    var shuffled = NPC_ROLE_CONFIGS.slice().sort(function () { return Math.random() - 0.5; });
    var list = [];
    for (var i = 0; i < n; i++) {
      var conf = shuffled[i % shuffled.length];
      var budget = conf.intel ? 0 :
        conf.budgetRange[0] + Math.floor(Math.random() * (conf.budgetRange[1] - conf.budgetRange[0] + 1));
      var intelPrice = conf.intel ? (50 + Math.floor(Math.random() * 151)) : null;
      var wants = conf.wantCategories.map(function (cat) {
        return { category: cat, qty: conf.bulk ? (2 + Math.floor(Math.random() * 3)) : 1 };
      });
      list.push({
        id:         'npc_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 9999),
        name:       _randomNpcName(),
        role:       conf.role,
        label:      conf.label,
        budget:     budget,
        wants:      wants,
        premium:    conf.premium,
        attitude:   1.0,
        intel:      conf.intel  || false,
        intelPrice: intelPrice,
        intelText:  conf.intel  ? _pickIntelText() : null,
        wantAged:   conf.wantAged || false,
        activated:  false
      });
    }
    return list;
  }

  // ── 辅助：查找今日 NPC ────────────────────────────────────
  function _findNpc(npcId) {
    if (!npcId) return null;
    for (var i = 0; i < state.todayNPCs.length; i++) {
      if (state.todayNPCs[i].id === npcId) return state.todayNPCs[i];
    }
    return null;
  }

  // ── 辅助：构造事件对象 ────────────────────────────────────
  function _makeEvent(type, label, desc, hour) {
    return {
      id:       type + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      hour:     hour != null ? hour : (8 + Math.floor(Math.random() * 10)),
      type:     type,
      label:    label,
      desc:     desc || '',
      resolved: false
    };
  }

  // ── handleCounterDrop：从仓库移动物品到柜台槽 ─────────────
  function handleCounterDrop(itemId, slotIdx) {
    var cs = state.counterState;
    if (cs.phase === 'idle' || !cs.npcId) return;
    if (slotIdx < 0 || slotIdx >= cs.slots.length) return;

    // 槽位已有物品时先归还
    if (cs.slots[slotIdx]) {
      _returnSlotItem(slotIdx);
    }

    var entry = state.grid.items[itemId];
    if (!entry) return;

    // 从仓库取出
    Core.remove(state.grid, itemId);
    cs.slots[slotIdx] = itemId;
    if (!state._counterItems) state._counterItems = {};
    state._counterItems[itemId] = entry.item;

    // 触发 NPC 评估
    evaluateCounterOffer();
    render();
  }

  // ── 将单个槽位物品归还仓库 ────────────────────────────────
  function _returnSlotItem(slotIdx) {
    var cs = state.counterState;
    var id = cs.slots[slotIdx];
    if (!id) return;
    cs.slots[slotIdx] = null;
    var item = state._counterItems && state._counterItems[id];
    if (item) {
      for (var row = 0; row < state.grid.rows; row++) {
        var placed = false;
        for (var col = 0; col < state.grid.cols; col++) {
          if (Core.canPlace(state.grid, item, col, row)) {
            Core.place(state.grid, item, col, row);
            placed = true; break;
          }
        }
        if (placed) break;
      }
      if (state._counterItems) delete state._counterItems[id];
    }
  }

  // ── 将所有柜台物品归还仓库 ───────────────────────────────
  function _returnCounterItems() {
    var cs = state.counterState;
    for (var i = 0; i < cs.slots.length; i++) {
      if (cs.slots[i]) _returnSlotItem(i);
    }
    cs.phase    = 'idle';
    cs.npcId    = null;
    cs.offer    = null;
    cs.attitude = 1.0;
  }

  // ── handleCounterReturn：从槽位取回物品到仓库 ────────────
  function handleCounterReturn(itemId) {
    var cs = state.counterState;
    var slotIdx = cs.slots.indexOf(itemId);
    if (slotIdx === -1) return;
    _returnSlotItem(slotIdx);
    // 重新评估（有物品剩余时）
    var hasItems = cs.slots.some(function (s) { return !!s; });
    if (hasItems) {
      evaluateCounterOffer();
    } else {
      cs.offer = null;
      cs.phase = 'active';
    }
    render();
  }

  // ── evaluateCounterOffer：计算 NPC 出价 ──────────────────
  function evaluateCounterOffer() {
    var cs  = state.counterState;
    var npc = _findNpc(cs.npcId);
    if (!npc || (cs.phase !== 'active' && cs.phase !== 'negotiating')) return;

    var itemIds = cs.slots.filter(Boolean);
    if (!itemIds.length) {
      cs.offer = null;
      return;
    }

    var items = itemIds.map(function (id) {
      return state._counterItems && state._counterItems[id];
    }).filter(Boolean);

    // 满足 wants 的类目匹配度
    var satisfiedWants = npc.wants.filter(function (want) {
      return items.some(function (item) { return item.category === want.category; });
    });
    var wantRatio = npc.wants.length > 0
      ? (satisfiedWants.length / npc.wants.length)
      : 1.0;
    var wantBonus = 0.6 + 0.4 * wantRatio;

    // 求总市场价并做 NPC 鉴定
    var totalValue  = 0;
    var fakePenalty = 1.0;
    items.forEach(function (item) {
      var marketPrice = Core.computePrice(state.market, item);
      totalValue += marketPrice;
      var cat   = item.category || 'misc';
      var skill = (state.playerSkill.identify && state.playerSkill.identify[cat]) || 0;
      var ev    = NPC.evaluateTrade(npc, item, skill / 100);
      if (!item.genuine && ev.verdict === 'fake') {
        fakePenalty = Math.min(fakePenalty, 0.35);
      } else if (ev.verdict === 'uncertain') {
        fakePenalty = Math.min(fakePenalty, 0.75);
      }
    });

    // 陈年酒加成（collector）
    var agedBonus = 1.0;
    if (npc.wantAged) {
      var hasAged = items.some(function (item) {
        return item.category === 'alcohol' && item.agedDays != null && item.agedDays > 10;
      });
      if (hasAged) agedBonus = 1.3;
    }

    // 最终出价 = totalValue × premium × attitude × wantBonus × fakePenalty × agedBonus
    var multiplier = npc.premium * cs.attitude * wantBonus * fakePenalty * agedBonus;
    cs.offer = Math.max(1, Math.min(
      npc.budget,
      Math.round(totalValue * multiplier)
    ));
    cs.phase = 'negotiating';
  }

  // ── confirmCounterSale：确认成交 ──────────────────────────
  function confirmCounterSale() {
    var cs  = state.counterState;
    var npc = _findNpc(cs.npcId);
    if (!npc || cs.offer == null || cs.offer <= 0) return;

    var earned = cs.offer;
    state.gold += earned;

    // 声誉小幅提升
    NPC.applyEffect(state.reputation, { overall: 2 });

    var summary = '向 ' + npc.name + '（' + npc.label + '）成交，入账 ¥' + earned + '。';
    state.todayEvents.push(_makeEvent('counter_sale', '柜台成交', summary));

    // 假货延迟反馈
    cs.slots.filter(Boolean).forEach(function (id) {
      var item = state._counterItems && state._counterItems[id];
      if (item && !item.genuine) {
        var delay = 1 + Math.floor(Math.random() * 3);
        state.fbQueue.add({
          label:     npc.name + ' 发现商品有问题',
          desc:      '购买的【' + item.name + '】被认定为假货。',
          repEffect: { overall: -5 }
        }, delay);
      }
    });

    // 清空柜台
    cs.slots    = [null, null, null, null, null, null];
    cs.phase    = 'idle';
    cs.offer    = null;
    cs.npcId    = null;
    cs.attitude = 1.0;
    state._counterItems = {};

    Core.saveGame(state);
    render();
  }

  // ── activateNpc：激活 NPC 到柜台 ─────────────────────────
  function activateNpc(npcId) {
    var npc = _findNpc(npcId);
    if (!npc || npc.activated) return;

    // 情报贩子：显示情报报价弹窗
    if (npc.intel) {
      _showIntelPrompt(npc);
      return;
    }

    // 如果当前柜台有别的 NPC，先归还所有物品
    if (state.counterState.npcId && state.counterState.npcId !== npcId) {
      _returnCounterItems();
    }

    state.counterState.npcId    = npcId;
    state.counterState.phase    = 'active';
    state.counterState.offer    = null;
    state.counterState.attitude = 0.9 + Math.random() * 0.2; // 0.9–1.1

    state.todayEvents.push(_makeEvent('npc_activated', npc.name + ' 上柜台',
      '等待出价，需求：' + (npc.wants.length
        ? npc.wants.map(function (w) { return w.category + ' ×' + w.qty; }).join('、')
        : '无特定需求')));
    render();
  }

  // ── 情报弹窗（内嵌实现）─────────────────────────────────
  function _showIntelPrompt(npc) {
    var existing = document.getElementById('wl-intel-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'wl-intel-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;' +
      'align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);';

    var box = document.createElement('div');
    box.style.cssText = 'background:#0d1a26;border:1px solid rgba(114,244,255,.3);border-radius:12px;' +
      'padding:28px 32px;max-width:380px;width:90%;';

    var title = document.createElement('h3');
    title.style.cssText = 'margin:0 0 8px;font-size:15px;color:#72f4ff;';
    title.textContent   = '情报贩子：' + npc.name;

    var desc = document.createElement('p');
    desc.style.cssText = 'font-size:13px;color:#91a4bf;margin:0 0 16px;line-height:1.6;';
    desc.textContent   = '"我手上有点消息……要不要听？价格公道。"';

    var price = document.createElement('p');
    price.style.cssText = 'font-size:20px;font-weight:800;color:#ffd76a;margin:0 0 20px;';
    price.textContent   = '¥ ' + npc.intelPrice;

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;';

    var buyBtn = document.createElement('button');
    buyBtn.className   = 'wl-btn wl-btn--primary';
    buyBtn.type        = 'button';
    buyBtn.textContent = '购买情报';
    buyBtn.style.flex  = '1';
    buyBtn.addEventListener('click', function () { modal.remove(); buyIntel(npc.id); });

    var cancelBtn = document.createElement('button');
    cancelBtn.className   = 'wl-btn';
    cancelBtn.type        = 'button';
    cancelBtn.textContent = '算了';
    cancelBtn.style.flex  = '1';
    cancelBtn.addEventListener('click', function () { modal.remove(); });

    btnRow.appendChild(buyBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(price);
    box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  // ── buyIntel：购买情报 ────────────────────────────────────
  function buyIntel(npcId) {
    var npc = _findNpc(npcId);
    if (!npc || !npc.intel) return;
    if (state.gold < npc.intelPrice) {
      state.todayEvents.push(_makeEvent('intel_fail', '资金不足',
        '购买情报需要 ¥' + npc.intelPrice + '，当前余额 ¥' + state.gold + '。'));
      render();
      return;
    }
    state.gold    -= npc.intelPrice;
    npc.activated  = true;
    state.todayEvents.push(_makeEvent('intel', '【情报】' + npc.name,
      npc.intelText || '情报内容不明。'));
    Core.saveGame(state);
    render();
  }

  // ── 周拍卖状态构造 ────────────────────────────────────────
  function _createAuctionState() {
    var tiers = ['low', 'mid', 'high'];
    var tier  = tiers[Math.floor(Math.random() * tiers.length)];
    var base  = tier === 'low' ? 80 : tier === 'mid' ? 200 : 500;
    var cluePool = [
      '箱体重量约 40kg，偏轻', '锁具品牌：Rexar（工业级）',
      '来源港口：东区第七仓储', '外壳有明显撞击痕迹',
      '上一持有人职业：医疗工作者', '发出轻微金属摩擦声',
      '来源记录：军事物资清单'
    ];
    var clueCount = tier === 'low' ? 1 : tier === 'mid' ? 2 : 3;
    var used = {}, clues = [];
    while (clues.length < clueCount) {
      var c = cluePool[Math.floor(Math.random() * cluePool.length)];
      if (!used[c]) { used[c] = true; clues.push({ id: 'c' + clues.length, label: c, revealed: true }); }
    }
    var names = [
      '神秘货柜 #' + (100 + Math.floor(Math.random() * 900)),
      '封存集装箱', '旧军供箱'
    ];
    var competitors = [];
    for (var j = 0; j < 2 + Math.floor(Math.random() * 3); j++) {
      competitors.push(NPC.generateNPC('bidder'));
    }
    return {
      tier:          tier,
      containerName: names[Math.floor(Math.random() * names.length)],
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

  // ── playerBid：拍卖出价 ───────────────────────────────────
  function playerBid(amount) {
    var auc = state.auction;
    if (!auc || auc.done) return;
    var bid       = parseInt(amount, 10);
    var minNeeded = auc.currentBid + auc.minIncrement;
    if (isNaN(bid) || bid < minNeeded) {
      state.todayEvents.push(_makeEvent('bid_fail', '出价无效', '最低需要 ¥' + minNeeded + '。'));
      render(); return;
    }
    auc.currentBid    = bid;
    auc.currentLeader = 'player';
    auc.competitors.forEach(function (npc) {
      var aiMax = NPC.negotiatePrice(npc, { basePrice: auc.basePrice, type: 'auction' }, auc.basePrice);
      if (typeof aiMax === 'number' && aiMax > auc.currentBid && Math.random() > 0.45) {
        auc.currentBid    = auc.currentBid + auc.minIncrement;
        auc.currentLeader = npc.name;
      }
    });
    auc.round += 1;
    if (auc.round >= auc.maxRounds) {
      auc.done      = true;
      auc.playerWon = (auc.currentLeader === 'player');
      if (auc.playerWon) {
        state.gold -= auc.currentBid;
        var prize  = Core.createItem('junk_metal', { quality: 1 + Math.floor(Math.random() * 4), origin: 'auction' });
        var placed = false;
        for (var ar = 0; ar < 6 && !placed; ar++) {
          for (var ac = 0; ac < 8 && !placed; ac++) {
            if (Core.canPlace(state.grid, prize, ac, ar)) {
              Core.place(state.grid, prize, ac, ar); placed = true;
            }
          }
        }
        state.todayEvents.push(_makeEvent('auction_won', '拍卖成功',
          '花费 ¥' + auc.currentBid + ' 拍得集装箱。' + (placed ? '货物已入库。' : '仓库已满，货物丢失！')));
      } else {
        state.todayEvents.push(_makeEvent('auction_lost', '拍卖结束',
          '最终成交 ¥' + auc.currentBid + '，由 ' + auc.currentLeader + ' 拍得。'));
      }
    }
    Core.saveGame(state);
    render();
  }

  // ── endDay ────────────────────────────────────────────────
  function endDay() {
    if (state.counterState.npcId) _returnCounterItems();

    // 延迟反馈
    var fired = state.fbQueue.tick();
    fired.forEach(function (fb) {
      state.todayEvents.push(_makeEvent('feedback', fb.label || '延迟反馈', fb.desc || ''));
      if (fb.repEffect) NPC.applyEffect(state.reputation, fb.repEffect);
    });

    // 1. Core.advanceDay
    var result = Core.advanceDay(state);
    // 2. day++
    state.day += 1;
    // 3. 处理事件
    (result.events || []).forEach(function (ev) {
      var text   = typeof ev === 'string' ? ev : (ev.text || JSON.stringify(ev));
      var evType = (typeof ev === 'object' && ev.type === 'market') ? 'market' : 'system';
      state.todayEvents.push(_makeEvent(evType, evType === 'market' ? '行情通知' : '系统消息', text));
    });
    // 4. 周结算（day%7===1 且非第1天）
    if (state.day > 1 && (state.day - 1) % 7 === 0) {
      state.week += 1;
      state.gold -= state.rent;
      var rentOk = state.gold >= 0;
      if (!rentOk) NPC.applyEffect(state.reputation, { overall: -10 });
      var rentEv = _makeEvent('rent',
        rentOk ? '租金已扣除' : '租金扣除失败',
        '本周租金 ¥' + state.rent + '。' + (rentOk ? '' : '账户余额不足，声誉 -10。'), 0);
      rentEv.resolved = true;
      state.todayEvents.unshift(rentEv);
      state.auction = _createAuctionState();
      state.todayEvents.push(_makeEvent('auction_open', '集装箱拍卖开启',
        '本周拍卖已开启，共 ' + (state.auction.competitors.length + 1) + ' 名竞拍者。', 9));
    }
    // 5. 生成新 todayNPCs
    state.todayNPCs   = generateDailyNPCs();
    state.todayEvents = state.todayEvents.concat(
      state.todayNPCs.map(function (npc) {
        return _makeEvent('npc_visit', npc.name + '（' + npc.label + '）来访',
          npc.intel
            ? '情报贩子，出售情报 ¥' + npc.intelPrice
            : '预算约 ¥' + npc.budget + '，需求：' +
              (npc.wants.length ? npc.wants.map(function (w) { return w.category; }).join('/') : '—'));
      })
    );
    // 6. saveGame
    Core.saveGame(state);
    // 7. render
    render();
  }

  // ── switchView ────────────────────────────────────────────
  function switchView(view) {
    state.activeView = view === 'base' ? 'base' : 'shop';
    render();
  }

  // ── collectLoot：战利品入库 ───────────────────────────────
  function collectLoot(lootItems) {
    (lootItems || state.returnedLoot).forEach(function (item) {
      for (var row = 0; row < state.grid.rows; row++) {
        var placed = false;
        for (var col = 0; col < state.grid.cols; col++) {
          if (Core.canPlace(state.grid, item, col, row)) {
            Core.place(state.grid, item, col, row);
            placed = true; break;
          }
        }
        if (placed) break;
      }
    });
    state.returnedLoot = [];
    Core.saveGame(state);
    render();
  }

  // ── render ────────────────────────────────────────────────
  function render() {
    if (!host || !state) return;

    // 状态栏
    var statDay  = document.getElementById('wl-stat-day');
    var statCash = document.getElementById('wl-stat-cash');
    var statRep  = document.getElementById('wl-stat-rep');
    if (statDay)  statDay.textContent  = '第 ' + state.day + ' 天 · 第 ' + state.week + ' 周';
    if (statCash) statCash.textContent = '¥ ' + state.gold.toLocaleString();
    if (statRep)  statRep.textContent  = '声誉 ' + ((state.reputation && state.reputation.overall) || 0);

    if (state.activeView === 'base') {
      _renderBaseView();
    } else {
      _renderShopView();
    }

    // 战利品（两个视图都可显示）
    if (state.returnedLoot && state.returnedLoot.length > 0) {
      var lootEl = document.getElementById('wl-loot');
      if (lootEl) {
        if (UI.renderLootClaim) {
          UI.renderLootClaim(lootEl, state.returnedLoot, { onCollect: collectLoot });
        } else if (UI.renderLootPanel) {
          UI.renderLootPanel(lootEl, state.returnedLoot, collectLoot);
        } else {
          _renderLootFallback(lootEl, state.returnedLoot);
        }
      }
    }
  }

  // ── shop 视图渲染 ─────────────────────────────────────────
  function _renderShopView() {
    // 格子仓库
    var gridEl = document.getElementById('wl-grid');
    if (gridEl) {
      var gridCb = {
        onSelect: function (itemId) {
          var cs = state.counterState;
          if (cs.phase === 'active' && cs.npcId) {
            var emptySlot = cs.slots.indexOf(null);
            if (emptySlot !== -1) { handleCounterDrop(itemId, emptySlot); return; }
          }
          selectedItemId = itemId;
          var entry    = state.grid.items[itemId];
          var detailEl = document.getElementById('wl-detail');
          if (detailEl && entry) {
            var mkt  = Core.computePrice(state.market, entry.item);
            var cat  = entry.item.category || 'misc';
            var sk   = (state.playerSkill.identify && state.playerSkill.identify[cat]) || 0;
            UI.renderItemDetail(detailEl, entry.item, [], sk, mkt);
          }
          UI.renderGrid(gridEl, adaptGrid(state.grid, selectedItemId), gridCb);
        },
        onDrop: function (payload) {
          var entry = state.grid.items[payload.itemId];
          if (!entry) return;
          var item = entry.item, ox = entry.x, oy = entry.y;
          Core.remove(state.grid, payload.itemId);
          if (Core.canPlace(state.grid, item, payload.toX, payload.toY)) {
            Core.place(state.grid, item, payload.toX, payload.toY);
          } else {
            Core.place(state.grid, item, ox, oy);
          }
          render();
        }
      };
      UI.renderGrid(gridEl, adaptGrid(state.grid, selectedItemId), gridCb);
    }

    // 柜台
    var counterEl = document.getElementById('wl-counter');
    if (counterEl) {
      var counterCb = {
        onSlotDrop:   handleCounterDrop,
        onSlotReturn: handleCounterReturn,
        onConfirm:    confirmCounterSale,
        onCancel:     function () { _returnCounterItems(); render(); }
      };
      if (UI.renderCounter) {
        UI.renderCounter(counterEl, state.counterState, counterCb);
      } else {
        _renderCounterFallback(counterEl, state.counterState, counterCb);
      }
    }

    // NPC 队列
    var npcQueueEl = document.getElementById('wl-npc-queue');
    if (npcQueueEl) {
      if (UI.renderNpcQueue) {
        UI.renderNpcQueue(npcQueueEl, state.todayNPCs, { onActivate: activateNpc });
      } else {
        _renderNpcQueueFallback(npcQueueEl, state.todayNPCs);
      }
    }

    // 市场板
    var marketEl = document.getElementById('wl-market');
    if (marketEl) {
      if (UI.renderMarketBoard) {
        UI.renderMarketBoard(marketEl, state.market);
      } else {
        _renderMarketFallback(marketEl, state.market);
      }
    }

    // 物品详情
    var detailEl = document.getElementById('wl-detail');
    if (detailEl) {
      if (selectedItemId && state.grid.items[selectedItemId]) {
        var sel  = state.grid.items[selectedItemId];
        var mkt2 = Core.computePrice(state.market, sel.item);
        var cat2 = sel.item.category || 'misc';
        var sk2  = (state.playerSkill.identify && state.playerSkill.identify[cat2]) || 0;
        UI.renderItemDetail(detailEl, sel.item, [], sk2, mkt2);
      } else {
        selectedItemId = null;
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
          containerName: auc.containerName, tier: auc.tier, clues: auc.clues,
          currentBid: auc.currentBid, currentBidder: auc.currentLeader || '—',
          minIncrement: auc.minIncrement, round: auc.round, maxRound: auc.maxRounds, ended: false
        }, { onBid: playerBid });
      } else if (auc && auc.done) {
        if (aucWrap) aucWrap.style.display = '';
        UI.renderAuction(aucEl, {
          containerName: auc.containerName, tier: auc.tier, clues: auc.clues,
          currentBid: auc.currentBid, ended: true, won: auc.playerWon
        }, { onBid: playerBid });
      } else {
        if (aucWrap) aucWrap.style.display = 'none';
      }
    }

    // 行情 ticker
    var tickerEl   = document.getElementById('wl-ticker');
    if (tickerEl) {
      var mktEvents = (state.todayEvents || []).filter(function (e) { return e.type === 'market'; });
      if (mktEvents.length) {
        var texts = mktEvents.map(function (e) { return e.desc || e.label; });
        if (UI.renderMarketTicker) UI.renderMarketTicker(tickerEl, texts);
      } else {
        tickerEl.innerHTML = '';
      }
    }
  }

  // ── base 视图渲染 ─────────────────────────────────────────
  function _renderBaseView() {
    var baseEl = document.getElementById('wl-base');
    if (!baseEl) return;
    var baseCb = {
      onInstall: function (slot, itemId) { /* 安装设施预留 */ },
      onUpgrade: function (slot) { /* 升级设施预留 */ },
      onRefuel:  function (amount) { /* 添加燃料预留 */ }
    };
    if (UI.renderBaseView) {
      UI.renderBaseView(baseEl, state.baseState, baseCb);
    } else {
      _renderBaseFallback(baseEl, state.baseState);
    }
  }

  // ── 内嵌 fallback：柜台 ───────────────────────────────────
  function _renderCounterFallback(container, cs, cb) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:8px;';

    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;color:#72f4ff;margin:0 0 8px;font-size:13px;';
    title.textContent   = cs.npcId ? '柜台交易中' : '柜台（空闲）';
    wrap.appendChild(title);

    if (cs.npcId) {
      var npc = _findNpc(cs.npcId);
      if (npc) {
        var npcInfo = document.createElement('p');
        npcInfo.style.cssText = 'font-size:12px;color:#91a4bf;margin:0 0 8px;';
        npcInfo.textContent   = npc.name + '（' + npc.label + '） 预算 ¥' + npc.budget;
        wrap.appendChild(npcInfo);
      }

      var slotsRow = document.createElement('div');
      slotsRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;';
      cs.slots.forEach(function (id, idx) {
        var slot = document.createElement('div');
        slot.style.cssText = 'width:60px;height:60px;border:1px dashed rgba(255,255,255,.2);' +
          'border-radius:6px;display:flex;align-items:center;justify-content:center;' +
          'font-size:10px;color:#7890ab;cursor:pointer;text-align:center;padding:2px;';
        if (id) {
          var item = state._counterItems && state._counterItems[id];
          slot.style.borderColor = 'rgba(114,244,255,.5)';
          slot.style.color = '#72f4ff';
          slot.textContent = item ? item.name.slice(0, 5) : '?';
          slot.title = '点击归还';
          slot.addEventListener('click', (function (capturedId) {
            return function () { if (cb.onSlotReturn) cb.onSlotReturn(capturedId); };
          }(id)));
        } else {
          slot.textContent = '空 ' + (idx + 1);
        }
        slotsRow.appendChild(slot);
      });
      wrap.appendChild(slotsRow);

      if (cs.offer != null) {
        var offerRow = document.createElement('p');
        offerRow.style.cssText = 'font-size:16px;color:#ffd76a;font-weight:800;margin:0 0 10px;';
        offerRow.textContent   = 'NPC 出价：¥' + cs.offer;
        wrap.appendChild(offerRow);
        var confirmBtn = document.createElement('button');
        confirmBtn.className   = 'wl-btn wl-btn--primary wl-btn--sm';
        confirmBtn.type        = 'button';
        confirmBtn.textContent = '确认成交';
        confirmBtn.style.marginRight = '8px';
        confirmBtn.addEventListener('click', function () { if (cb.onConfirm) cb.onConfirm(); });
        wrap.appendChild(confirmBtn);
      }

      var cancelBtn = document.createElement('button');
      cancelBtn.className   = 'wl-btn wl-btn--sm';
      cancelBtn.type        = 'button';
      cancelBtn.textContent = '取消交易';
      cancelBtn.addEventListener('click', function () { if (cb.onCancel) cb.onCancel(); });
      wrap.appendChild(cancelBtn);
    }
    container.appendChild(wrap);
  }

  // ── 内嵌 fallback：NPC 队列 ───────────────────────────────
  function _renderNpcQueueFallback(container, npcs) {
    container.innerHTML = '';
    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;color:#72f4ff;margin:0 0 8px;font-size:13px;';
    title.textContent   = '今日访客（' + npcs.length + '）';
    container.appendChild(title);
    npcs.forEach(function (npc) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;' +
        'border:1px solid rgba(255,255,255,.08);border-radius:6px;margin-bottom:6px;' +
        'background:rgba(255,255,255,.02);' + (npc.activated ? 'opacity:.5;' : '');
      var info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = '<b style="font-size:13px;color:#ddeeff;">' + npc.name + '</b>' +
        '<br><span style="font-size:11px;color:#7890ab;">' + npc.label +
        (npc.intel ? ' · 情报 ¥' + npc.intelPrice : ' · 预算 ¥' + npc.budget) + '</span>';
      var btn = document.createElement('button');
      btn.className   = 'wl-btn wl-btn--sm';
      btn.type        = 'button';
      btn.textContent = npc.activated ? '已处理' : (npc.intel ? '购情报' : '接待');
      btn.disabled    = npc.activated;
      btn.addEventListener('click', (function (capturedId) {
        return function () { activateNpc(capturedId); };
      }(npc.id)));
      row.appendChild(info);
      row.appendChild(btn);
      container.appendChild(row);
    });
  }

  // ── 内嵌 fallback：市场板 ────────────────────────────────
  function _renderMarketFallback(container, market) {
    container.innerHTML = '';
    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;color:#72f4ff;margin:0 0 6px;font-size:12px;';
    title.textContent   = '市场行情';
    container.appendChild(title);
    var coeff = (market && market.coefficients) || {};
    var hasChange = false;
    Object.keys(coeff).forEach(function (cat) {
      var v = coeff[cat];
      if (v === 1.0) return;
      hasChange = true;
      var row = document.createElement('div');
      row.style.cssText = 'font-size:11px;color:' + (v > 1 ? '#ff718e' : '#75ffb2') +
        ';margin-bottom:2px;';
      row.textContent = cat + '  ×' + v.toFixed(2);
      container.appendChild(row);
    });
    if (!hasChange) {
      var p = document.createElement('p');
      p.style.cssText = 'font-size:11px;color:#7890ab;margin:0;';
      p.textContent   = '行情平稳。';
      container.appendChild(p);
    }
  }

  // ── 内嵌 fallback：基地 ───────────────────────────────────
  function _renderBaseFallback(container, baseState) {
    container.innerHTML = '';
    var title = document.createElement('h3');
    title.style.cssText = 'color:#72f4ff;margin:0 0 12px;font-size:15px;';
    title.textContent   = '基地管理';
    container.appendChild(title);
    var slots = (baseState && baseState.fixedSlots) || {};
    var SLOT_LABELS = {
      power: '⚡ 电力设施', security: '🛡 安保系统',
      water_purifier: '💧 净水装置', storage: '📦 仓储扩展'
    };
    Object.keys(slots).forEach(function (key) {
      var slot = slots[key];
      var row  = document.createElement('div');
      row.style.cssText = 'padding:10px;border:1px solid rgba(255,255,255,.1);' +
        'border-radius:6px;margin-bottom:8px;display:flex;align-items:center;gap:10px;';
      var label = document.createElement('b');
      label.style.cssText = 'flex:1;color:#ddeeff;font-size:13px;';
      label.textContent   = SLOT_LABELS[key] || key;
      var status = document.createElement('span');
      status.style.cssText = 'font-size:11px;color:' + (slot.installed ? '#75ffb2' : '#7890ab') + ';';
      status.textContent   = slot.installed ? '已安装 Lv.' + slot.level : '未安装';
      row.appendChild(label);
      row.appendChild(status);
      container.appendChild(row);
    });
  }

  // ── 内嵌 fallback：战利品 ────────────────────────────────
  function _renderLootFallback(container, lootItems) {
    container.innerHTML = '';
    var title = document.createElement('p');
    title.style.cssText = 'font-weight:700;color:#ffd76a;margin:0 0 8px;font-size:13px;';
    title.textContent   = '🎁 派遣归来，共 ' + lootItems.length + ' 件物资';
    container.appendChild(title);
    var btn = document.createElement('button');
    btn.className   = 'wl-btn wl-btn--primary wl-btn--sm';
    btn.type        = 'button';
    btn.textContent = '全部入库';
    btn.addEventListener('click', function () { collectLoot(); });
    container.appendChild(btn);
  }

  // ── mount：初始化并挂载 ───────────────────────────────────
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

    // 存档兼容：补全新增字段
    if (!state.dispatches)      state.dispatches      = [];
    if (!state.returnedLoot)    state.returnedLoot    = [];
    if (!state.activeView)      state.activeView      = 'shop';
    if (!state._counterItems)   state._counterItems   = {};
    if (!state.prices)          state.prices          = {};
    if (!state.counterState || !Array.isArray(state.counterState.slots)) {
      state.counterState = {
        npcId: null, slots: [null, null, null, null, null, null],
        phase: 'idle', offer: null, attitude: 1.0
      };
    }
    if (!state.baseState) {
      state.baseState = {
        fixedSlots: {
          power:          { installed: false, level: 0, fuel: 0 },
          security:       { installed: false, level: 0 },
          water_purifier: { installed: false, level: 0 },
          storage:        { installed: false, level: 0 }
        },
        freeGrid:   Core.createGrid(4, 3),
        facilities: []
      };
    }
    if (!state.playerSkill || typeof state.playerSkill.identify !== 'object' ||
        Array.isArray(state.playerSkill.identify)) {
      state.playerSkill = {
        identify: { water: 0, food: 0, material: 0, medicine: 0 },
        negotiate: 0,
        health: 100
      };
    }
    if (!state.fbQueue || typeof state.fbQueue.tick !== 'function') {
      state.fbQueue = NPC.createFeedbackQueue();
    }

    // 重置当日状态
    state.todayNPCs   = generateDailyNPCs();
    state.todayEvents = [
      _makeEvent('welcome', '开始新的一天',
        '第 ' + state.day + ' 天，余额 ¥' + state.gold +
        '。今日 ' + state.todayNPCs.length + ' 位访客。', 8)
    ];
    state.todayNPCs.forEach(function (npc) {
      state.todayEvents.push(_makeEvent('npc_visit',
        npc.name + '（' + npc.label + '）来访',
        npc.intel
          ? '情报贩子，出售情报 ¥' + npc.intelPrice
          : '预算约 ¥' + npc.budget + '，需求：' +
            (npc.wants.length ? npc.wants.map(function (w) { return w.category; }).join('/') : '—')));
    });
    if (state.week > 1 && !state.auction) {
      state.auction = _createAuctionState();
    }

    // 绑定按钮
    var endDayBtn = document.getElementById('wl-end-day-btn');
    if (endDayBtn) endDayBtn.onclick = endDay;

    var switchBaseBtn = document.getElementById('wl-switch-base');
    if (switchBaseBtn) switchBaseBtn.onclick = function () { switchView('base'); };

    var switchShopBtn = document.getElementById('wl-switch-shop');
    if (switchShopBtn) switchShopBtn.onclick = function () { switchView('shop'); };

    root.NeonGameBooted = true;
    render();
    return {};
  }

  // ── 公开 API ─────────────────────────────────────────────
  root.WastelandShop = {
    enter: mount,
    leave: function () {
      if (state && Core) Core.saveGame(state);
      host           = null;
      selectedItemId = null;
    },
    VERSION: '3'
  };

}(window));
