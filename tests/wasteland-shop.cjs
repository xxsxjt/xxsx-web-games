const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const modules = ['wasteland-core', 'wasteland-npc', 'wasteland-shop'];
// 两个世界做深，其余标注开发中：废土界四个角色、宗门界四个角色，情报贩子中立。
const worlds = {
  scavenger:['wasteland_nuclear','核爆废土'],
  trader:['wasteland_nuclear','核爆废土'],
  medic:['wasteland_nuclear','核爆废土'],
  contractor:['wasteland_nuclear','核爆废土'],
  herbalist:['xianxia_sect','灵霄宗门界'],
  alchemist:['xianxia_sect','灵霄宗门界'],
  cultivator:['xianxia_sect','灵霄宗门界'],
  collector:['xianxia_sect','灵霄宗门界'],
  informant:['','维度中转站']
};
function makeNode(tag) {
  const listeners = {}, classes = new Set();
  const node = {
    tag, className:'', style:{cssText:''}, dataset:{}, children:[], attributes:{}, innerHTML:'', textContent:'',
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, callback) { (listeners[type] || (listeners[type] = [])).push(callback); },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key] || null; },
    querySelectorAll() { return []; },
    remove() { this.removed = true; },
    focus() {},
    fire(type, event) { (listeners[type] || []).forEach(callback => callback(Object.assign({preventDefault(){},stopPropagation(){},key:'',dataTransfer:{setData(){},getData(){return '';}}}, event || {}))); },
    get childrenByName() { return this.children.filter(child => child.tag === 'small').map(child => child.textContent); }
  };
  node.classList = {
    add(value) { classes.add(value); node.className = [...classes].join(' '); },
    remove(value) { classes.delete(value); node.className = [...classes].join(' '); },
    contains(value) { return classes.has(value); },
    toggle(value, force) { const enabled = force == null ? !classes.has(value) : !!force; enabled ? classes.add(value) : classes.delete(value); node.className = [...classes].join(' '); return enabled; }
  };
  return node;
}
function createSession(seed) {
  const values = new Map(Object.entries(seed || {})), nodes = new Map(), callbacks = {};
  const document = {
    head:makeNode('head'),
    createElement:makeNode,
    createTextNode:text => ({textContent:text,tag:'#text'}),
    getElementById(id) { if (!nodes.has(id)) nodes.set(id,makeNode('div')); return nodes.get(id); }
  };
  const window = {
    document,
    localStorage:{getItem:key => values.get(key) || null,setItem:(key,value) => values.set(key,String(value)),removeItem:key => values.delete(key)}
  };
  const ui = {
    renderGrid(node,data,cb) { callbacks.grid = cb; callbacks.gridData = data; },
    renderCounter(node,data,cb) { callbacks.counter = cb; callbacks.counterData = data; },
    renderMarketBoard(node,data) { callbacks.market = data; },
    renderItemDetail(node,data) { callbacks.detail = data; },
    renderAuction(node,data,cb) { callbacks.auction = {data,cb}; }, renderMarketTicker() {}, renderBaseView(node,data) { callbacks.base = data; },
    renderEventLog(node,data) { callbacks.events = data; },
    renderContacts(node,data,offers,cb) { callbacks.contacts = {data,offers,cb}; },
    renderNpcQueue(node,data,cb) { callbacks.queue = {data,cb}; },
    renderMachineZone(node,data,cb) { callbacks.machines = {data,cb}; },
    renderWorldPicker(node,data,cb) { callbacks.worlds = {data,cb}; },
    renderLootClaim(node,items,cb) { callbacks.loot = {items,cb}; }
  };
  window.WastelandUI = ui;
  const context = vm.createContext({window,document,console,Math,Date,JSON,Object,Array,String,Number,Boolean,parseInt,parseFloat,isNaN});
  for (const file of modules) vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),context,{filename:file+'.js'});
  assert.ok(window.WastelandShop.enter());
  return {window,values,nodes,callbacks,endDay(){nodes.get('wl-end-day-btn').onclick();},state(){return window.WastelandShop.getState();}};
}
function deepText(node) { return [node.textContent,...(node.children || []).map(deepText)].filter(Boolean).join(' '); }

const npcSession = createSession();
const npc = npcSession.window.WastelandNPC;
for (const [role,[id,name]] of Object.entries(worlds)) {
  assert.equal(npc.worldForNpc({role}).id,id);
  assert.equal(npc.worldForNpc({role}).name,name);
}
assert.equal(npc.worldForNpc({role:'trader',worldId:1}).id,'wasteland_nuclear');
assert.equal(npc.worldForNpc({role:'trader',worldId:2}).id,'steampunk');
assert.equal(npc.worldForNpc({role:'scavenger',worldId:3}).id,'wasteland_plague');
assert.equal(npc.worldForNpc({role:'informant',worldId:6}).id,'xianxia_mortal');
assert.equal(npc.worldForNpc({role:'trader',worldId:'2'}).id,'steampunk');
assert.equal(npc.worldForNpc({role:'trader',worldId:11}).id,'unknown');
assert.deepEqual(JSON.parse(JSON.stringify(npc.worldForNpc({role:'medic',worldId:'guest_realm',worldName:'访客自定义界',worldMark:'X',worldColor:'#123456'}))),{id:'guest_realm',name:'访客自定义界',mark:'X',color:'#123456'});

// 旧存档的商旅世界是用数字下标存的，而 LEGACY_VISITOR_WORLD_ORDER 只有 6 项
// （对应旧版的六个角色）。所以这份夹具必须用旧角色名，不能用新版角色——
// 新角色在旧版根本不存在，拿它们造「旧档」检验不了迁移逻辑。
const legacyWorlds = {
  scavenger:['wasteland_nuclear','核爆废土'],
  trader:['steampunk','蒸汽帝国'],
  medic:['wasteland_plague','瘟疫荒原'],
  informant:['cybermage','赛博魔法城'],
  collector:['ancient_empire','古代帝国集市'],
  contractor:['xianxia_mortal','凡界集市']
};
const saved = npcSession.state();
saved.day=14;saved.week=2;saved.gold=765;saved._savedDay=saved.day;
saved.todayNPCs=Object.entries(legacyWorlds).map(([role,[,name]],index)=>({id:'legacy-'+role,name:'旧旅商'+index,role,worldId:index+1,worldName:name,budget:100+index,label:'旧商旅',wants:[],activated:false,intel:false}));
saved.todayEvents=[{type:'counter_sale',label:'旧成交',desc:'已成交记录'},{type:'market',label:'旧行情',desc:'供应告警'},{type:'rent',label:'旧维护费',desc:'维护费已结算'}];
const legacyValues = {'xxsxWastelandShopV1':JSON.stringify(saved)};
const resumed = createSession(legacyValues), state = resumed.state();
assert.equal(state.day,14);
assert.equal(state.week,2);
assert.equal(state.gold,765);
assert.deepEqual(JSON.parse(JSON.stringify(state.todayNPCs.map(visitor=>visitor.worldId))),['wasteland_nuclear','steampunk','wasteland_plague','cybermage','ancient_empire','xianxia_mortal']);
assert.deepEqual(JSON.parse(JSON.stringify(state.todayNPCs.map(visitor=>visitor.worldName))),Object.values(legacyWorlds).map(([,name])=>name));
assert.deepEqual(JSON.parse(JSON.stringify(state.todayNPCs.map(visitor=>visitor.worldMark))).map(Boolean),Array(6).fill(true));
assert.deepEqual(JSON.parse(JSON.stringify(state.todayNPCs.map(visitor=>visitor.worldColor))).map(Boolean),Array(6).fill(true));
assert.deepEqual(JSON.parse(resumed.values.get('xxsxWastelandShopV1')).todayNPCs.map(visitor=>visitor.worldId),['wasteland_nuclear','steampunk','wasteland_plague','cybermage','ancient_empire','xianxia_mortal']);
for (const type of ['counter_sale','market','rent']) assert.ok(state.todayEvents.some(event=>event.type===type),'retained daily event '+type);

// 今天开在哪一界，就只来那一界的客商（情报贩子中立，哪一界都可能有）。
// 这里必须用新开的会话——resumed 第一天还是从旧档迁移过来的访客，
// 他们的世界来自旧下标，不适用「本界只来本界客人」这条规则。
const worldDay = createSession();
const seen = new Set();
for (let day=0; day<180 && seen.size<4; day++) {
  for (const visitor of worldDay.state().todayNPCs) {
    const [id,name] = worlds[visitor.role];
    assert.equal(visitor.worldId,id,'generated visitor world ID');
    assert.equal(visitor.worldName,name,'generated visitor world name');
    assert.ok(visitor.worldMark&&visitor.worldColor,'generated visitor world badge');
    if (!visitor.intel) seen.add(visitor.role);
  }
  if (seen.size<4) worldDay.endDay();
}
assert.deepEqual([...seen].sort(),['contractor','medic','scavenger','trader'],'a wasteland day must only bring wasteland visitors');

// 世界表必须从 NPC 模块导出两件事：
//   WORLD_ORDER  —— 界门选择器靠它渲染卡片，漏了就变成「面板在、里面空」
//   worldById    —— 商店靠它判断某个世界能不能开张，漏了则任何转场都被拒
// 这两个漏导出都真的发生过，而且是静默失败（不报错、只是没反应）。
assert.ok(Array.isArray(npc.WORLD_ORDER)&&npc.WORLD_ORDER.length===11,'NPC must expose the world table the picker renders from');
assert.equal(typeof npc.worldById,'function','NPC must expose worldById so the shop can validate a world');
assert.ok(npc.worldById('wasteland_nuclear'),'worldById must resolve a real world');
assert.equal(npc.worldById('wasteland_nuclear').status,'playable','the wasteland must be marked playable');
assert.equal(npc.worldById('xianxia_sect').status,'playable','the sect world must be marked playable');
assert.equal(npc.worldById('medieval').status,'wip','an unfinished world must be marked as in development');
const playableIds = npc.WORLD_ORDER.filter(w=>w.status==='playable').map(w=>w.id);
// WORLD_ORDER 是在 vm 上下文里构造的，filter/map 返回的数组原型属于那个 realm，
// 宿主侧的 deepStrictEqual 会因此判不等。过一遍 JSON 把它带回本 realm。
assert.deepEqual(JSON.parse(JSON.stringify(playableIds)),['wasteland_nuclear','xianxia_sect'],'exactly two worlds ship complete content for now');
// 每个正式世界都必须真的有的玩：机器 + 配方 + 本界角色
const machineDefs = npcSession.window.WastelandCore.MACHINE_DEFS;
const recipeDefs = npcSession.window.WastelandCore.RECIPE_DEFS;
for (const wid of playableIds) {
  const worldMachines = Object.values(machineDefs).filter(m=>m.world===wid);
  assert.ok(worldMachines.length>=3,'a playable world needs its own machines: '+wid);
  const worldRecipes = Object.values(recipeDefs).filter(r=>worldMachines.some(m=>m.key===r.machine));
  assert.ok(worldRecipes.length>=5,'a playable world needs a real production chain: '+wid);
}
console.log('PASS dimensional visitor worlds, legacy visitor migration, archive restoration and daily event retention');

/* ══ 今日界门 ══════════════════════════════════════════════════════
 * 规则：每天开门前可以换一次世界，换完当天锁死；开发中的世界不能进。
 * 锁死这条不是洁癖——不锁的话玩家可以反复转场，每次重掷一批客商，
 * 一直刷到满意为止，「今天来谁」的随机性就没了。
 * （这个漏洞真的发生过：转场当时忘了置 worldLocked。）
 */
const picker = createSession();
picker.nodes.get('wl-switch-base').onclick();
assert.ok(picker.callbacks.worlds&&picker.callbacks.worlds.cb.onPickWorld,'the world picker must reach the base view');
const pickerData = picker.callbacks.worlds.data;
assert.equal(pickerData.worldId,'wasteland_nuclear','a new shop opens in the starting world');
assert.equal(pickerData.worlds.length,11,'the picker must list every designed world, finished or not');
assert.equal(pickerData.locked,false,'a fresh day must still allow a single move');

// 开发中的世界不能进
picker.callbacks.worlds.cb.onPickWorld('medieval');
let pickerState = picker.state();
assert.equal(pickerState.worldId,'wasteland_nuclear','an unfinished world must be refused');
assert.ok(pickerState.todayEvents.some(e=>e.type==='world_fail'),'a refused world must say why');

// 转场：客源换成本界的
picker.callbacks.worlds.cb.onPickWorld('xianxia_sect');
pickerState = picker.state();
assert.equal(pickerState.worldId,'xianxia_sect','a playable world must accept the move');
assert.ok(pickerState.worldPlace,'a move must land the shop somewhere concrete');
assert.ok(pickerState.todayNPCs.every(v=>v.intel||v.worldId==='xianxia_sect'),'a sect day must only bring sect visitors');
assert.ok(pickerState.todayEvents.some(e=>e.type==='world_switch'),'the move must be recorded in the day log');

// 同一天不能再换——否则可以反复重掷客商
const afterMove = picker.state();
const rolesAfterMove = afterMove.todayNPCs.map(v=>v.id).join(',');
picker.callbacks.worlds.cb.onPickWorld('wasteland_nuclear');
pickerState = picker.state();
assert.equal(pickerState.worldId,'xianxia_sect','a second move in the same day must be refused');
assert.equal(pickerState.todayNPCs.map(v=>v.id).join(','),rolesAfterMove,'a refused move must not reroll the roster');
assert.equal(pickerState.worldLocked,true,'committing to a world must lock it for the day');

// 接客也会锁
const lockCheck = createSession();
lockCheck.callbacks.queue.cb.onActivate(lockCheck.state().todayNPCs.filter(v=>!v.intel)[0].id);
assert.equal(lockCheck.state().worldLocked,true,'receiving a visitor must lock the day’s world too');

// 到了第二天自动解锁，并重新挑落脚点
const nextDay = createSession();
nextDay.nodes.get('wl-switch-base').onclick();
nextDay.callbacks.worlds.cb.onPickWorld('xianxia_sect');
assert.equal(nextDay.state().worldLocked,true,'committing must lock the gate');
nextDay.endDay();
assert.equal(nextDay.state().worldLocked,false,'a new day must unlock the gate again');
nextDay.nodes.get('wl-switch-base').onclick();
assert.equal(nextDay.callbacks.worlds.data.locked,false,'the picker must offer a fresh move on the new day');
console.log('PASS the daily gate lets you choose one world, locks it for the day and refuses unfinished worlds');


const damaged = npcSession.state();
damaged.gold = null;                       // JSON.parse turns a NaN balance into null
damaged.counterState = {npcId:'ghost',npc:null,slots:new Array(32).fill(null),phase:'negotiating',offer:null};
const healed = createSession({'xxsxWastelandShopV1':JSON.stringify(damaged)}).state();
assert.ok(Number.isFinite(healed.gold),'a corrupted balance must be repaired on load, not left as null');
assert.equal(healed.counterState.attitude,1.0,'a counter state without an attitude must fall back to 1.0 instead of making every offer NaN');
assert.ok(Number.isFinite(healed.counterState.attitude),'the restored attitude must be a real number');
console.log('PASS damaged archives are repaired before they can produce a NaN trade');

// Daily queues are random (2-5 visitors, some intel-only); this flow needs two regular visitors
let play = createSession();
for (let tries=0; play.state().todayNPCs.filter(visitor=>!visitor.intel).length<2; tries++) {
  assert.ok(tries<200,'a business day should eventually offer two regular visitors');
  play = createSession();
}
let playState = play.state();
const customer = playState.todayNPCs.find(visitor=>!visitor.intel && visitor.wants.some(want=>want.category==='water')) || playState.todayNPCs.find(visitor=>!visitor.intel);
const customerId = customer.id;
play.callbacks.queue.cb.onActivate(customerId);
playState = play.state();
assert.equal(playState.counterState.npcId,customerId,'the selected visitor should arrive at the counter');
const itemId = Object.values(playState.grid.items).find(entry=>entry.item.category==='water').item.id;
play.callbacks.grid.onSelect(itemId);
playState = play.state();
assert.equal(playState.counterState.slots[0],itemId,'clicking stock during negotiation should put it on the counter');
assert.ok(play.callbacks.counterData.slots[0].name,'the visible counter should receive a complete item, not its storage ID');
assert.ok(playState.counterState.offer>0,'the requested stock should produce an offer');
const firstOffer = playState.counterState.offer;
const secondItem = Object.values(playState.grid.items).find(entry=>entry.item.category==='food').item.id;
play.callbacks.grid.onSelect(secondItem);
playState = play.state();
assert.equal(playState.counterState.slots[1],secondItem,'a second item should be accepted after the customer makes an offer');
assert.ok(playState.counterState.offer>=firstOffer,'adding goods should refresh the offer');
play.callbacks.counter.onRemoveFromSlot(1);
playState = play.state();
assert.equal(playState.counterState.slots[1],null,'removing counter stock should clear its slot');
assert.ok(playState.grid.items[secondItem],'removing counter stock should return it to the warehouse');
const goldBeforeSale = playState.gold;
play.callbacks.counter.onConfirm();
playState = play.state();
assert.ok(playState.gold>goldBeforeSale,'confirming a valid offer should credit the sale');
assert.equal(playState.counterState.phase,'idle','a completed sale should release the counter');
assert.ok(playState.todayNPCs.find(visitor=>visitor.id===customerId).activated,'a customer should not be reusable after a completed sale');
play.callbacks.grid.onSelect(Object.values(playState.grid.items)[0].item.id);
assert.ok(play.callbacks.detail&&play.callbacks.detail.name,'warehouse selection should render complete item details');
play.nodes.get('wl-switch-base').onclick();
assert.equal(play.state().activeView,'base','the base button should reach the station workbench');
assert.ok(play.callbacks.base.fixedSlots,'the base workbench should render stored facilities');
play.nodes.get('wl-switch-shop').onclick();
assert.equal(play.state().activeView,'shop','the shop button should return to trading');
const returningId = play.state().todayNPCs.find(visitor=>!visitor.intel&&!visitor.activated).id;
play.callbacks.queue.cb.onActivate(returningId);
const stockId = Object.values(play.state().grid.items)[0].item.id;
play.callbacks.grid.onSelect(stockId);
play.endDay();
playState = play.state();
assert.equal(playState.day,2,'the end-day button should advance the business day');
assert.ok(playState.grid.items[stockId],'unfinished counter stock should be returned at settlement');
assert.equal(playState.counterState.phase,'idle','day settlement should close the prior counter');
assert.equal(JSON.parse(play.values.get('xxsxWastelandShopV1')).day,2,'day settlement should persist its new state');
const aucSeed = play.state();
aucSeed.auction = {containerName:'裂隙漂流物 #321',tier:'low',clues:[{id:'c0',label:'线索',revealed:true}],
  basePrice:100,currentBid:100,currentLeader:null,minIncrement:10,competitors:[],round:0,maxRounds:5,done:false,playerWon:false};
const auc = createSession({'xxsxWastelandShopV1':JSON.stringify(aucSeed)});
assert.ok(auc.callbacks.auction&&auc.callbacks.auction.cb.onBid,'the auction panel must be reachable before round one');
const goldBeforeBid = auc.state().gold;
auc.callbacks.auction.cb.onBid(goldBeforeBid+5000);
assert.equal(auc.state().gold,goldBeforeBid,'a bid larger than the purse must not be accepted');
assert.ok(auc.state().todayEvents.some(event=>event.type==='bid_fail'),'a rejected bid must be recorded where the player can see it');

// 拍卖奖池里的每个 id 都必须在目录里真实存在。
// 这里曾经是 cloth_roll / battery_pack / precision_tool 三个不存在的 id，
// 被静默回退成 ¤4 废金属，中高两档花 200/500 拍回一块铁。
const shopSource = fs.readFileSync(path.join(root,'src','wasteland-shop.js'),'utf8');
const poolBlock = shopSource.match(/var AUCTION_POOL = \{[\s\S]*?\n  \};/);
assert.ok(poolBlock,'the auction prize pool must be a named block so it can be pinned');
const poolIds = [...poolBlock[0].matchAll(/'([a-z0-9_]+)'/g)].map(m=>m[1]);
assert.ok(poolIds.length>=6,'the auction pool must cover three tiers');
const catalog = npcSession.window.WastelandCore.ITEM_CATALOG;
for (const id of poolIds) {
  assert.ok(catalog[id],'auction prize id must exist in ITEM_CATALOG: '+id);
}
const tierFloor = {low:80,mid:200,high:500};
for (const [tier,floor] of Object.entries(tierFloor)) {
  const tierBlock = poolBlock[0].match(new RegExp(tier+":\\s*\\[([^\\]]+)\\]"));
  assert.ok(tierBlock,'the auction pool must declare a '+tier+' tier');
  const ids = [...tierBlock[1].matchAll(/'([a-z0-9_]+)'/g)].map(m=>m[1]);
  const worst = Math.min(...ids.map(id=>catalog[id].basePrice));
  assert.ok(worst>=floor*0.6,'the '+tier+' prize pool must be worth its '+floor+' opening bid (cheapest is ¤'+worst+')');
}
// 拍卖真的把奖品交到手上，而且不再吐出废金属
const winSeed = play.state();
winSeed.gold = 5000;
winSeed.auction = {containerName:'裂隙漂流物 #999',tier:'high',clues:[],
  basePrice:500,currentBid:500,currentLeader:'player',minIncrement:25,competitors:[],round:4,maxRounds:5,done:false,playerWon:false};
const won = createSession({'xxsxWastelandShopV1':JSON.stringify(winSeed)});
won.callbacks.auction.cb.onBid(525);
const wonState = won.state();
assert.ok(wonState.todayEvents.some(e=>e.type==='auction_won'),'a winning top bid must settle the auction');
const prize = Object.values(wonState.grid.items).map(e=>e.item).find(i=>i&&i.origin==='auction');
assert.ok(prize,'a won auction must place its prize in the warehouse');
assert.ok(catalog[prize.skuId].basePrice>=500*0.6,'a high-tier win must not pay ¤500 for scrap (got '+prize.skuId+' ¤'+catalog[prize.skuId].basePrice+')');
console.log('PASS every auction prize id exists in the catalog and matches its tier');

// 前期没有稳定供货渠道：货来自上门商旅的兜售
let shop = createSession();
let shopState = shop.state();
assert.ok(!('supply' in shopState),'the shop must not have a standing wholesale shelf');
const carriers = shopState.todayNPCs.filter(npc=>Array.isArray(npc.offers)&&npc.offers.length);
assert.ok(carriers.length,'some visitor must turn up carrying goods to sell');
for(const npc of carriers){
  for(const offer of npc.offers){
    assert.ok(offer.unitCost>0,'a carried lot must have a price');
    assert.ok(offer.qty>0,'a carried lot must have stock');
    assert.ok(offer.skuId&&offer.category,'a carried lot must identify what it is');
  }
}
// 收货价锚定市场均价：不应出现白捡（远低于市价）的情况
for(const npc of carriers) for(const offer of npc.offers){
  assert.ok(offer.unitCost/offer.listPrice>0.8,'carried goods must be priced near market, not free');
}

// 接待带货的商旅，收下他的一件货
const carrier = carriers[0];
const wanted   = carrier.offers.find(o=>o.unitCost<=shopState.gold);
assert.ok(wanted,'the opening balance must afford at least one carried lot');
shop.callbacks.queue.cb.onActivate(carrier.id);
shopState = shop.state();
assert.ok(shop.callbacks.counterData.offers.length,'the counter must show what the visitor is carrying');
const goldBefore  = shopState.gold;
const stockBefore = Object.keys(shopState.grid.items).length;
shop.callbacks.counter.onTakeOffer(wanted.id,1);
shopState = shop.state();
assert.equal(shopState.gold,goldBefore-wanted.unitCost,'taking goods must deduct what the visitor asked');
assert.equal(Object.keys(shopState.grid.items).length,stockBefore+1,'taken goods must land in the warehouse');
const stillThere = shopState.todayNPCs.find(n=>n.id===carrier.id).offers.find(o=>o.id===wanted.id);
assert.ok(!stillThere||stillThere.qty===wanted.qty-1,'taking one must reduce what he still has');

// 收不起的货不能把余额扣成负数
const rich = shopState.todayNPCs.find(n=>n.id===carrier.id).offers[0];
if(rich){
  const held = shop.state().gold;
  shop.callbacks.counter.onTakeOffer(rich.id,99);
  assert.ok(shop.state().gold>=0,'taking goods must never drive the balance negative');
  assert.ok(shop.state().gold<=held,'the balance must not increase from buying');
}

// 连续经营几天仍然收得到货（货源每日随商旅刷新）
for(let d=0;d<4;d++){ shop.endDay(); }
const laterState = shop.state();
const laterCarriers = laterState.todayNPCs.filter(npc=>Array.isArray(npc.offers)&&npc.offers.length);
assert.ok(laterCarriers.length,'visitors must keep bringing goods on later days');
console.log('PASS visitors carry the goods and the shop cannot overdraw on them');

// 人脉订购：下单先付款、数天后到货，货带品牌标识
const ordShop = createSession();
let ordState = ordShop.state();
assert.ok(Array.isArray(ordState.contacts)&&ordState.contacts.length,'the shop must know its potential suppliers');
assert.ok(ordState.contacts.every(c=>!c.unlocked),'contacts must start locked, not handed over at the opening');
for(const contact of ordState.contacts) assert.ok(contact.leadDays>0,'every supplier must need lead time');

// 解锁并下单
const ordSeed = ordShop.state();
ordSeed.gold = 3000;
ordSeed.contacts.forEach(c=>{c.unlocked=true;c.since=1;});
const ordering = createSession({'xxsxWastelandShopV1':JSON.stringify(ordSeed)});
// The supplier panel lives on the base side of the shop, so open it first.
ordering.nodes.get('wl-switch-base').onclick();
assert.ok(ordering.callbacks.contacts&&ordering.callbacks.contacts.offers,'the contact panel must reach the shop');
const supplier = ordering.callbacks.contacts.data.find(c=>c.unlocked);
const goods = ordering.callbacks.contacts.offers[supplier.id];
assert.ok(goods&&goods.items.length,'an unlocked supplier must offer goods to order');
const ordItem = goods.items[0];
const goldBeforeOrder = ordering.state().gold;
ordering.callbacks.contacts.cb.onOrder(supplier.id,ordItem.skuId,1);
let ordAfter = ordering.state();
assert.equal(ordAfter.gold,goldBeforeOrder-ordItem.unitCost,'placing an order must charge up front');
assert.equal(ordAfter.orders.length,1,'the order must be recorded as pending');
assert.ok(ordAfter.orders[0].daysLeft>0,'a placed order must still have lead time to run');

// 到货：仓库里出现带品牌、来源为 order 的货。
// 记下到货前的物品 id——夜间失窃会顺走一件便宜货（通常是 ¤4 的废铁），
// 一进一出总数会打平，所以「总数必须变多」是不可靠的判据。
// 要证明的是：到货那件是新增的 id。
const idsBeforeDelivery = new Set(Object.keys(ordAfter.grid.items));
const daysLeft = ordAfter.orders[0].daysLeft;
for(let d=0;d<daysLeft;d++) ordering.endDay();
ordAfter = ordering.state();
assert.equal(ordAfter.orders.length,0,'the order must clear once its lead time elapses');
const delivered = Object.values(ordAfter.grid.items).map(e=>e.item).filter(i=>i&&i.origin==='order');
assert.equal(delivered.length,1,'the ordered goods must land in the warehouse');
assert.ok(delivered[0].brand,'ordered goods must carry the supplier brand');
assert.equal(delivered[0].skuId,ordItem.skuId,'the delivered goods must be what was ordered');
assert.ok(!idsBeforeDelivery.has(delivered[0].id),'delivery must add the ordered goods as new stock');
assert.ok(ordAfter.todayEvents.some(e=>e.type==='order_arrived'),'the delivery must be recorded on the day it lands');
console.log('PASS supplier orders bill up front, arrive after their lead time and carry a brand');

// 停业判定：欠款且无货可卖、也进不起货时才停业；手里还有货就不算绝路
const deadSeed = createSession().state();
deadSeed.gold = -500;
deadSeed.grid.items = {};
deadSeed.orders = [];
deadSeed.returnedLoot = [];
deadSeed.todayNPCs = (deadSeed.todayNPCs||[]).map(npc=>Object.assign({},npc,{offers:[],activated:true}));
deadSeed.gameOver = null;
const dead = createSession({'xxsxWastelandShopV1':JSON.stringify(deadSeed)});
dead.endDay();
assert.ok(dead.state().gameOver,'a shop that owes money with nothing to sell must close');
assert.equal(dead.state().gameOver.gold,-500,'the closing record must keep the final balance');

const heldSeed = createSession().state();
heldSeed.gold = -500;
heldSeed.orders = [];
heldSeed.returnedLoot = [];
heldSeed.gameOver = null;
const held = createSession({'xxsxWastelandShopV1':JSON.stringify(heldSeed)});
assert.ok(Object.keys(held.state().grid.items).length,'the seeded shop must still hold stock');
held.endDay();
assert.ok(!held.state().gameOver,'stock on hand is still a way back and must not close the shop');

// 停业之后不能再推进天数
const closedDay = dead.state().day;
dead.endDay();
assert.equal(dead.state().day,closedDay,'a closed shop must not keep advancing days');
assert.equal(dead.state().orders.length,0,'a closed shop must not keep pending orders');
assert.equal(dead.state().todayNPCs.length,0,'a closed shop must not keep a visitor queue waiting');
console.log('PASS insolvency closes the shop only when nothing is sellable or affordable');

console.log('PASS the auction refuses bids beyond the shop balance');

/* ══ 生产系统 ══════════════════════════════════════════════════════
 * 用户的要求是「成品比原料值钱，除非炼废了」。所以这里两件事都要钉：
 *   1) 目录层面：每道配方的成品价值都高于原料（确定性，不靠掷骰）
 *   2) 废品必须真的亏：废品价值低于原料，但不能是零（不至于血本无归）
 * 再验行为：买机器扣钱、排产扣料、有电才推进、断电停工、换世界不串机器。
 */
const PRODUCE_SESSION = () => createSession();
const prodCatalog = npcSession.window.WastelandCore.ITEM_CATALOG;
const prodRecipes = npcSession.window.WastelandCore.RECIPE_DEFS;
const prodMachines = npcSession.window.WastelandCore.MACHINE_DEFS;
assert.ok(Object.keys(prodRecipes).length >= 15,'the catalog must ship a real production tree, not a token recipe');
assert.ok(Object.keys(prodMachines).length >= 5,'each crafted world needs its own machines');
for (const [id,recipe] of Object.entries(prodRecipes)) {
  const inValue = recipe.inputs.reduce((sum,need)=>{
    const sku = prodCatalog[need.skuId];
    assert.ok(sku,'recipe '+id+' must consume a real SKU: '+need.skuId);
    return sum + sku.basePrice*need.qty;
  },0);
  const outSku = prodCatalog[recipe.output.skuId];
  assert.ok(outSku,'recipe '+id+' must produce a real SKU: '+recipe.output.skuId);
  const outValue = outSku.basePrice*recipe.output.qty;
  assert.ok(outValue>inValue,'finished goods must beat their inputs: '+id+'（原料 ¤'+inValue+' → 成品 ¤'+outValue+'）');
  assert.ok(outValue>=inValue*1.5,'the margin must be worth the machine, the power and the wait: '+id);
  if (recipe.failOutput) {
    const failSku = prodCatalog[recipe.failOutput.skuId];
    assert.ok(failSku,'recipe '+id+' must fail into a real SKU');
    const failValue = failSku.basePrice*recipe.failOutput.qty;
    assert.ok(failValue<inValue,'a failed batch has to be a real loss: '+id+'（废品 ¤'+failValue+' vs 原料 ¤'+inValue+'）');
    assert.ok(failValue>0,'a failed batch must not be a total wipe: '+id);
  }
  assert.ok(prodMachines[recipe.machine],'recipe '+id+' must belong to a real machine: '+recipe.machine);
}
console.log('PASS every recipe turns cheap inputs into dearer finished goods, and a failed batch is a real but survivable loss');

// 买机器要扣钱、占机器区；换世界买不到别的世界的机器
const craftSeed = PRODUCE_SESSION().state();
craftSeed.gold = 5000;
craftSeed.worldId = 'wasteland_nuclear';
const crafting = createSession({'xxsxWastelandShopV1':JSON.stringify(craftSeed)});
crafting.nodes.get('wl-switch-base').onclick();
assert.ok(crafting.callbacks.machines&&crafting.callbacks.machines.cb.onBuy,'the machine zone must reach the base view');
const buyable = Object.keys(crafting.callbacks.machines.data.available);
assert.ok(buyable.includes('smelter'),'the wasteland must offer its own furnace');
assert.ok(!buyable.includes('alchemy_furnace'),'a xianxia furnace must not be buyable in the wasteland');
const goldBeforeMachine = crafting.state().gold;
crafting.callbacks.machines.cb.onBuy('smelter');
let craftState = crafting.state();
assert.equal(craftState.gold,goldBeforeMachine-prodMachines.smelter.cost,'adding a machine must charge its price');
const zoneIds = Object.keys(craftState.baseState.freeGrid.items);
assert.equal(zoneIds.length,1,'the bought machine must occupy the machine zone');
assert.equal(craftState.baseState.freeGrid.items[zoneIds[0]].item.machineKey,'smelter','the machine zone holds machines, not trade goods');
console.log('PASS machines are bought per world and land in the machine zone, not the warehouse');

// 断电排不了产；通电后扣料、过天数、出货
crafting.callbacks.machines.cb.onProduce(zoneIds[0],'melt_iron');
craftState = crafting.state();
assert.equal(craftState.production.length,0,'with no power a batch must not start at all');
assert.ok(craftState.todayEvents.some(e=>e.type==='produce_fail'),'a refused batch must say why');

const poweredSeed = crafting.state();
poweredSeed.baseState.fixedSlots.power = {installed:true,level:1,fuel:30};
// 备足料：熔铁吃 4 份废铁
const addStock = (seed,skuId,qty) => {
  const core = npcSession.window.WastelandCore;
  for (let i=0;i<qty;i++) {
    const item = core.createItem(skuId,{quality:3,origin:'trade'});
    let placed = false;
    for (let y=0;y<seed.grid.rows&&!placed;y++)
      for (let x=0;x<seed.grid.cols&&!placed;x++)
        if (core.canPlace(seed.grid,item,x,y)) { core.place(seed.grid,item,x,y); placed=true; }
  }
  return seed;
};
addStock(poweredSeed,'junk_metal',12);
const powered = createSession({'xxsxWastelandShopV1':JSON.stringify(poweredSeed)});
powered.nodes.get('wl-switch-base').onclick();
const poweredZone = Object.keys(powered.state().baseState.freeGrid.items)[0];
const junkBefore = Object.values(powered.state().grid.items).filter(e=>e.item.skuId==='junk_metal').length;
powered.callbacks.machines.cb.onProduce(poweredZone,'melt_iron');
let poweredState = powered.state();
assert.equal(poweredState.production.length,1,'a powered machine must accept the batch');
const junkAfter = Object.values(poweredState.grid.items).filter(e=>e.item.skuId==='junk_metal').length;
assert.equal(junkAfter,junkBefore-4,'starting a batch must consume exactly its inputs up front');
const job = poweredState.production[0];
assert.equal(job.daysLeft,prodRecipes.melt_iron.days,'the batch must carry its full lead time');

powered.endDay();
poweredState = powered.state();
assert.equal(poweredState.production.length,0,'the batch must clear once its days elapse');
const crafted = Object.values(poweredState.grid.items).map(e=>e.item).filter(i=>i.origin==='craft');
assert.ok(crafted.length,'a finished batch must deliver goods');
assert.ok(crafted.every(i=>i.skuId==='iron_ingot_1kg'||i.skuId==='slag'),'a melt must yield ingots or slag, nothing else');
assert.ok(poweredState.todayEvents.some(e=>e.type==='produce_done'||e.type==='produce_bad'),'the result must be recorded on the day it lands');
console.log('PASS a powered machine consumes its inputs up front and delivers finished goods after its lead time');

// 断电停工：批次原地等待，不推进天数、也不再扣料。
// 注意 state() 返回的是 JSON 深拷贝，改它上面的字段碰不到实时状态——
// 所以这里靠「燃料只剩 1 天」来制造断电：结算先烧掉最后一天电，生产推进时才看到停机。
const idleSeed = Object.assign({}, poweredSeed);
idleSeed.baseState = Object.assign({}, poweredSeed.baseState, {
  fixedSlots: Object.assign({}, poweredSeed.baseState.fixedSlots, {
    power: {installed:true,level:1,fuel:1}
  })
});
const idle = createSession({'xxsxWastelandShopV1':JSON.stringify(idleSeed)});
idle.nodes.get('wl-switch-base').onclick();
const idleZone = Object.keys(idle.state().baseState.freeGrid.items)[0];
idle.callbacks.machines.cb.onProduce(idleZone,'melt_iron');
let idleState = idle.state();
assert.equal(idleState.production.length,1,'the batch must start while there is still fuel');
const junkAfterStart = Object.values(idleState.grid.items).filter(e=>e.item.skuId==='junk_metal').length;
assert.equal(junkAfterStart,junkBefore-4,'starting the batch must eat its inputs exactly once');
idle.endDay();
idleState = idle.state();
assert.equal(idleState.baseState.fixedSlots.power.fuel,0,'the last day of fuel must be burned by settlement');
assert.equal(idleState.production.length,1,'a power cut must park the batch instead of dropping it');
assert.equal(idleState.production[0].daysLeft,prodRecipes.melt_iron.days,'a parked batch must not tick down');
// 废铁是仓库里最便宜的货，夜间失窃优先偷它。所以这里不能直接断言「数量没变」——
// 要区分「生产又吃了一 口料」和「被偷了一件」：后者必然留下 theft 事件。
const junkParked = Object.values(idleState.grid.items).filter(e=>e.item.skuId==='junk_metal').length;
const wasStolen = idleState.todayEvents.some(e=>e.type==='theft');
assert.equal(junkParked, wasStolen ? junkAfterStart-1 : junkAfterStart,
  'a power cut must not consume more inputs（少的那件必须能由失窃事件解释）');
console.log('PASS a power cut parks production instead of destroying the batch');

/* ══ 净水器 ════════════════════════════════════════════════════════
 * FACILITY_DEFS 一直宣称净水器「回收战利品时给水与化学品提价」，
 * 但代码里从没实现过——它只是在烧滤芯。现在补上了，就得钉住：
 * 提价只作用于打捞来的水/化学品，且只在净水器通电时生效；
 * 别的东西（药品、贸易货）一件都不该被动到。
 */
const purifySeed = createSession().state();
purifySeed.gold = 5000;
purifySeed.baseState.fixedSlots.power = {installed:true,level:1,fuel:30};
purifySeed.baseState.fixedSlots.water_purifier = {installed:true,level:1};
const purifyCore = npcSession.window.WastelandCore;
const salvageWater = purifyCore.createItem('water_bottle_500',{origin:'salvage',purity:3});
const salvageMeds  = purifyCore.createItem('antibiotic',{origin:'salvage',quality:3});
const tradedWater  = purifyCore.createItem('water_bottle_500',{origin:'trade',purity:3});
purifySeed.returnedLoot = [salvageWater, salvageMeds, tradedWater];
const purifier = createSession({'xxsxWastelandShopV1':JSON.stringify(purifySeed)});
assert.ok(purifier.callbacks.loot&&purifier.callbacks.loot.cb.onCollectAll,'the loot claim panel must reach the shop');
purifier.callbacks.loot.cb.onCollectAll(purifier.state().returnedLoot);
const claimed = Object.values(purifier.state().grid.items).map(e=>e.item);
const claimedWater = claimed.find(i=>i.skuId==='water_bottle_500'&&i.origin==='salvage');
const claimedTrade = claimed.find(i=>i.skuId==='water_bottle_500'&&i.origin==='trade');
const claimedMeds  = claimed.find(i=>i.skuId==='antibiotic');
assert.ok(claimedWater,'the salvaged water must reach the warehouse');
assert.equal(claimedWater.purity,4,'an active purifier must raise salvaged water by one purity grade');
assert.equal(claimedTrade.purity,3,'traded goods must not be touched by the purifier');
assert.equal(claimedMeds.quality,3,'a purifier must not grade up medicine');
assert.ok(purifier.state().todayEvents.some(e=>e.type==='purified'),'the purifier must report what it treated');

// 没有净水器（或断电）时不该有任何加成
const noPurifySeed = JSON.parse(JSON.stringify(purifySeed));
noPurifySeed.baseState.fixedSlots.water_purifier = {installed:false,level:0};
noPurifySeed.returnedLoot = [{id:'x1',skuId:'water_bottle_500',name:'过滤水1L铝壶',category:'water',puritySystem:true,purity:3,quality:3,genuine:true,origin:'salvage',w:1,h:1,basePrice:15,tags:[],icon:'💧'}];
const dry = createSession({'xxsxWastelandShopV1':JSON.stringify(noPurifySeed)});
dry.callbacks.loot.cb.onCollectAll(dry.state().returnedLoot);
const dryWater = Object.values(dry.state().grid.items).map(e=>e.item).find(i=>i.origin==='salvage');
assert.equal(dryWater.purity,3,'without a purifier salvaged water must keep its grade');
console.log('PASS the purifier only upgrades salvaged water and chemicals, and only while powered');

console.log('PASS Dimensional Trading Post legacy visitors, session flow, storage transactions, settlement and responsive UI');

const uiNodes = new Map();
const uiDocument = {
  head:makeNode('head'),createElement:makeNode,
  createTextNode:text=>({textContent:text,tag:'#text'}),
  getElementById(id) { if (!uiNodes.has(id)) uiNodes.set(id,makeNode('div')); return uiNodes.get(id); }
};
const uiWindow = {document:uiDocument,WastelandNPC:npc};
const uiContext = vm.createContext({window:uiWindow,document:uiDocument,console,Math,Date,JSON,Object,Array,String,Number,Boolean,parseInt,parseFloat,isNaN});
vm.runInContext(fs.readFileSync(path.join(root,'src/wasteland-ui.js'),'utf8'),uiContext,{filename:'wasteland-ui.js'});
const ui = uiWindow.WastelandUI;
const item = Object.assign({},playState.grid.items[Object.keys(playState.grid.items)[0]].item,{type:'water',icon:'💧',color:'#79c7ee'});
const counter = makeNode('div');
ui.renderCounter(counter,{npcId:'n1',npc:{name:'林砚',role:'trader',worldId:'steampunk',worldName:'蒸汽帝国',budget:400,wants:[{category:'water',qty:1}]},slots:[item,null,null,null,null,null,null,null],phase:'negotiating',offer:123},{onConfirm(){},onRemoveFromSlot(){},onCancel(){}});
const counterText = deepText(counter);
assert.ok(counterText.includes(item.name)&&counterText.includes('¤ 123'),'counter should show the item name and its current offer');
assert.ok(counter.children.some(node=>node.className==='wl-counter-slots'),'counter should expose the compact eight-slot trade board');
const market = makeNode('div');
ui.renderMarketBoard(market,{coefficients:{water:1.8,food:.7,material:1,tech:1,medicine:1,equipment:1},stockout:{water:3}});
assert.ok(market.children.some(node=>node.className.includes('wl-market-card--scarce')),'live stockout state should appear on its market card');
assert.ok(market.children.some(node=>deepText(node).includes('×1.80')),'the market panel must read real stored coefficients');
const inventory = makeNode('div');
ui.renderGrid(inventory,{cols:10,rows:8,cells:[Object.assign({},item,{id:'touch-test',x:1,y:0,w:1,h:1,quality:4})]},{onSelect(){}});
const inventoryItem = inventory.children.find(node=>node.className.includes('wl-inventory-cell--item'));
assert.equal(inventory.className,'wl-inventory-grid');
assert.ok(inventoryItem&&inventoryItem.style.cssText.includes('grid-column:2/span 1'),'inventory cells should use responsive placement and retain their saved coordinates');
assert.ok(inventoryItem.children.some(child=>child.tag==='span'&&deepText(child)===item.name),'responsive inventory tiles must show the complete item name');
assert.equal(market.children.length,11,'the market board must expose every tracked category, including tobacco');
const log = makeNode('div');
ui.renderEventLog(log,[{type:'intel',label:'【情报】孙漠',desc:'东区仓库三天内将有大批药品入市',hour:9}]);
assert.ok(deepText(log).includes('药品入市'),'a purchased piece of intelligence must be readable somewhere in the UI');
assert.ok(deepText(log).includes('9:00'),'day-log entries should carry their hour');
const base = makeNode('div');
ui.renderBaseView(base,{fixedSlots:{},freeGrid:{cols:4,rows:3,items:{f1:{item:{id:'f1',name:'净水塔',w:1,h:1},x:2,y:1}}}},{});
assert.ok(deepText(base).includes('净水塔'),'facilities stored in a core grid must render on the base workbench');
