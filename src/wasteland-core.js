/* Wasteland Shop · core state machine · pure IIFE · no dependencies */
(function(root){
  'use strict';

  var VERSION='1';
  var SAVE_KEY='xxsxWastelandShopV1';

  /* ─── 物品类型定义 ─────────────────────────────────────────────── */
  var ITEM_TYPES={
    water:    {name:'水',       category:'consumable', basePrice:8,   stackable:false},
    food:     {name:'食物',     category:'consumable', basePrice:12,  stackable:false},
    medicine: {name:'药品',     category:'medicine',   basePrice:60,  stackable:false},
    syringe:  {name:'针剂',     category:'medicine',   basePrice:150, stackable:false},
    metal:    {name:'金属',     category:'material',   basePrice:25,  stackable:false},
    ore:      {name:'矿石',     category:'material',   basePrice:15,  stackable:false},
    chemical: {name:'化学品',   category:'material',   basePrice:40,  stackable:false},
    alcohol:  {name:'酒',       category:'consumable', basePrice:80,  stackable:false},
    electronic:{name:'电子元件',category:'tech',       basePrice:90,  stackable:false},
    tool:     {name:'工具',     category:'equipment',  basePrice:50,  stackable:false},
    weapon:   {name:'武器',     category:'equipment',  basePrice:200, stackable:false},
    contraband:{name:'违禁品',  category:'illegal',    basePrice:300, stackable:false},
    recipe:   {name:'配方',     category:'misc',       basePrice:120, stackable:false},
    seed:     {name:'种子',     category:'material',   basePrice:10,  stackable:false},
    junk:     {name:'废品',     category:'misc',       basePrice:3,   stackable:false}
  };

  var QUALITY_NAMES={1:'损坏',2:'劣质',3:'普通',4:'良好',5:'优质'};
  var ORIGIN_NAMES={salvage:'拾荒所得',auction:'集装箱拍卖',trade:'贸易',craft:'自制',unknown:'来源不明'};

  /* ─── 物品模型 ─────────────────────────────────────────────────── */
  // createItem(type, w, h, quality, genuine, expiry, origin)
  // type: keyof ITEM_TYPES
  // w,h: grid size (int ≥ 1)
  // quality: 1-5
  // genuine: bool
  // expiry: days remaining, null = no expiry
  // origin: keyof ORIGIN_NAMES
  function createItem(type,w,h,quality,genuine,expiry,origin){
    if(!ITEM_TYPES[type])throw new Error('Unknown item type: '+type);
    var def=ITEM_TYPES[type];
    return {
      id: _uid(),
      type: type,
      name: def.name,
      category: def.category,
      w: w||1,
      h: h||1,
      rotated: false,       // if true, effective dims are h×w
      quality: quality||3,
      genuine: genuine!==false,
      expiry: expiry!=null?expiry:null,  // null = no expiry
      origin: origin||'unknown',
      basePrice: def.basePrice,
      // effective sell price is computed by market state
      notes: ''             // player's private annotation
    };
  }

  function _uid(){
    return Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  }

  /* ─── 格子仓库 ─────────────────────────────────────────────────── */
  // createGrid(cols, rows) → grid object
  // cells: flat array length cols*rows, each null or {itemId,x,y} back-ref
  // items: map id→item+placement{x,y,rotated}
  function createGrid(cols,rows){
    return {
      cols: cols,
      rows: rows,
      cells: _blankCells(cols,rows),  // null | itemId string
      items: {}                        // id → {item, x, y}
    };
  }

  function _blankCells(cols,rows){
    var a=[];
    for(var i=0;i<cols*rows;i++)a.push(null);
    return a;
  }

  function _cellIdx(grid,x,y){return y*grid.cols+x;}

  function _itemDims(item){
    return item.rotated?{w:item.h,h:item.w}:{w:item.w,h:item.h};
  }

  // canPlace(grid, item, x, y) → bool
  function canPlace(grid,item,x,y){
    var d=_itemDims(item);
    if(x<0||y<0||x+d.w>grid.cols||y+d.h>grid.rows)return false;
    for(var dy=0;dy<d.h;dy++){
      for(var dx=0;dx<d.w;dx++){
        if(grid.cells[_cellIdx(grid,x+dx,y+dy)]!==null)return false;
      }
    }
    return true;
  }

  // place(grid, item, x, y) → bool (mutates grid)
  function place(grid,item,x,y){
    if(!canPlace(grid,item,x,y))return false;
    var d=_itemDims(item);
    for(var dy=0;dy<d.h;dy++)
      for(var dx=0;dx<d.w;dx++)
        grid.cells[_cellIdx(grid,x+dx,y+dy)]=item.id;
    grid.items[item.id]={item:item,x:x,y:y};
    return true;
  }

  // remove(grid, itemId) → item | null (mutates grid)
  function remove(grid,itemId){
    var entry=grid.items[itemId];
    if(!entry)return null;
    var item=entry.item, d=_itemDims(item), x=entry.x, y=entry.y;
    for(var dy=0;dy<d.h;dy++)
      for(var dx=0;dx<d.w;dx++)
        grid.cells[_cellIdx(grid,x+dx,y+dy)]=null;
    delete grid.items[itemId];
    return item;
  }

  // getAt(grid, x, y) → item | null
  function getAt(grid,x,y){
    if(x<0||y<0||x>=grid.cols||y>=grid.rows)return null;
    var id=grid.cells[_cellIdx(grid,x,y)];
    if(!id)return null;
    return grid.items[id]?grid.items[id].item:null;
  }

  // rotate(item) → item (mutates rotated flag, returns same item)
  function rotate(item){
    item.rotated=!item.rotated;
    return item;
  }

  /* ─── 市场行情 ─────────────────────────────────────────────────── */
  // createMarketState() → market
  // coefficient: price multiplier per category (1.0 = baseline)
  function createMarketState(){
    return {
      day: 0,
      // supply coefficients by category; >1 = price up, <1 = price down
      coefficients:{
        consumable:  1.0,
        medicine:    1.0,
        material:    1.0,
        tech:        1.0,
        equipment:   1.0,
        illegal:     1.0,
        misc:        1.0
      },
      // stockout flags: category → days remaining (0 = available)
      stockout:{
        consumable:  0,
        medicine:    0,
        material:    0,
        tech:        0,
        equipment:   0,
        illegal:     0,
        misc:        0
      },
      // pending events (applied on next advanceDay)
      pendingShocks: []  // [{category, delta, duration}]
    };
  }

  // computePrice(market, item) → number
  function computePrice(market,item){
    var coeff=market.coefficients[item.category]||1.0;
    var qualityMult=0.5+(item.quality-1)*0.2;   // 0.5 / 0.7 / 0.9 / 1.1 / 1.3
    var genuineMult=item.genuine?1.0:0.45;
    return Math.round(item.basePrice*coeff*qualityMult*genuineMult);
  }

  /* ─── 日推进 ─────────────────────────────────────────────────────
   * advanceDay(state) → DayResult
   * state shape (minimal required):
   *   { day, market, grid, player, events:[], log:[] }
   * DayResult:
   *   { ok:bool, day, expired:[itemId], events:[str], warnings:[str] }
   ─────────────────────────────────────────────────────────────────── */
  function advanceDay(state){
    state.day=(state.day||0)+1;
    var result={ok:true,day:state.day,expired:[],events:[],warnings:[]};

    // 1. 保质期损耗
    var grid=state.grid;
    if(grid){
      Object.keys(grid.items).forEach(function(id){
        var entry=grid.items[id];
        var item=entry.item;
        if(item.expiry!=null){
          item.expiry--;
          if(item.expiry<=0){
            remove(grid,id);
            result.expired.push(id);
            result.events.push('物品「'+item.name+'」已过期并移除。');
          }else if(item.expiry<=3){
            result.warnings.push('物品「'+item.name+'」还有 '+item.expiry+' 天保质期。');
          }
        }
      });
    }

    // 2. 市场行情推进
    var market=state.market;
    if(market){
      market.day=state.day;
      // apply pending shocks
      var still=[];
      market.pendingShocks.forEach(function(shock){
        market.coefficients[shock.category]=(market.coefficients[shock.category]||1)+shock.delta;
        // clamp [0.2, 5]
        market.coefficients[shock.category]=Math.max(0.2,Math.min(5,market.coefficients[shock.category]));
        shock.duration--;
        if(shock.duration>0)still.push(shock);
        else{
          // revert to 1.0 gradually — just reset here for simplicity
          market.coefficients[shock.category]=_clamp(market.coefficients[shock.category]-shock.delta,0.5,3);
        }
      });
      market.pendingShocks=still;
      // tick stockout counters
      Object.keys(market.stockout).forEach(function(cat){
        if(market.stockout[cat]>0){
          market.stockout[cat]--;
          if(market.stockout[cat]===0){
            result.events.push('「'+cat+'」类物资恢复供应。');
            market.coefficients[cat]=Math.max(0.8,market.coefficients[cat]-0.3);
          }
        }
      });
    }

    // 3. 玩家消耗检定
    var player=state.player;
    if(player){
      // hunger/thirst tick
      player.hunger=(player.hunger||0)+1;
      player.thirst=(player.thirst||0)+1;
      if(player.thirst>=3)result.warnings.push('玩家缺水，健康下降风险提升。');
      if(player.hunger>=3)result.warnings.push('玩家缺食物，健康下降风险提升。');
      // health decay
      if(player.thirst>=4||player.hunger>=4){
        player.health=Math.max(0,(player.health||100)-10);
        result.events.push('因长期缺乏补给，健康值下降至 '+player.health+'。');
      }
    }

    // 4. 周结算（每 7 天）
    if(state.day%7===0){
      var rent=state.rent||0;
      if(rent>0&&player){
        player.funds=(player.funds||0)-rent;
        result.events.push('周租金结算：-'+rent+'。当前资金 '+player.funds+'。');
        if(player.funds<0)result.warnings.push('资金不足，负债经营！');
      }
      result.events.push('集装箱拍卖场次刷新，请关注本周线索。');
    }

    // 5. 随机事件检定（10% 日触发概率）
    if(Math.random()<0.10){
      var rndEvents=[
        '情报贩子在门口转悠，或许有有价值的消息。',
        '一名拾荒者上门，想出售今日收货。',
        '执法小队经过附近街区——保持店面整洁。',
        '附近商铺发生纠纷，今日客流略有下降。',
        '有传言称某批物资即将断供，囤货需求上涨。'
      ];
      var ev=rndEvents[Math.floor(Math.random()*rndEvents.length)];
      result.events.push('[随机事件] '+ev);
    }

    // 6. 记录日志
    if(state.log){
      state.log.push({day:state.day,events:result.events.slice(),warnings:result.warnings.slice()});
      // keep last 30 days only
      if(state.log.length>30)state.log=state.log.slice(-30);
    }

    return result;
  }

  function _clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

  /* ─── 存档 ────────────────────────────────────────────────────── */
  function saveGame(state){
    try{
      var json=JSON.stringify(state);
      root.localStorage&&root.localStorage.setItem(SAVE_KEY,json);
      return true;
    }catch(e){return false;}
  }

  function loadGame(){
    try{
      var raw=root.localStorage&&root.localStorage.getItem(SAVE_KEY);
      if(!raw)return null;
      return JSON.parse(raw);
    }catch(e){return null;}
  }

  /* ─── 公开 API ──────────────────────────────────────────────────── */
  root.WastelandCore={
    VERSION: VERSION,
    createItem: createItem,
    createGrid: createGrid,
    canPlace: canPlace,
    place: place,
    remove: remove,
    getAt: getAt,
    rotate: rotate,
    createMarketState: createMarketState,
    computePrice: computePrice,
    advanceDay: advanceDay,
    saveGame: saveGame,
    loadGame: loadGame,
    // expose type/quality tables for UI use
    ITEM_TYPES: ITEM_TYPES,
    QUALITY_NAMES: QUALITY_NAMES,
    ORIGIN_NAMES: ORIGIN_NAMES
  };
})(typeof window!=='undefined'?window:this);
