/* Wasteland Shop · core state machine · pure IIFE · no dependencies */
(function(root){
  'use strict';

  var VERSION='2';
  var SAVE_KEY='xxsxWastelandShopV1';

  /* ─── 纯度系统 ─────────────────────────────────────────────────── */
  var PURITY_NAMES={1:'污染',2:'低纯',3:'标准',4:'净化',5:'纯净'};
  var PURITY_MULT={1:0.2,2:0.5,3:1.0,4:1.5,5:2.5};

  /* ─── 品质系统 ─────────────────────────────────────────────────── */
  var QUALITY_NAMES={1:'损坏',2:'劣质',3:'普通',4:'良好',5:'优质'};
  var QUALITY_MULT={1:0.3,2:0.6,3:1.0,4:1.4,5:2.0};
  var ORIGIN_NAMES={salvage:'拾荒所得',auction:'集装箱拍卖',trade:'贸易',craft:'自制',unknown:'来源不明'};
  var CATEGORY_NAMES={water:'水资源',alcohol:'酒类',chemical:'化学品',food:'食物',material:'金属材料',tech:'电子科技',medicine:'药品',equipment:'装备',illegal:'违禁品',misc:'杂项',tobacco:'烟草'};

  /* ─── 物品目录 ─────────────────────────────────────────────────── */
  var ITEM_CATALOG={
    /* ── 水类 ── */
    water_cup:           {name:'一次性水杯100ml',      category:'water',    subtype:'water',    basePrice:3,   w:1,h:1,puritySystem:true, expiryDays:null, icon:'🥤',tags:['liquid','container']},
    water_bottle_500:    {name:'矿泉水500ml塑料瓶',    category:'water',    subtype:'water',    basePrice:15,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'💧',tags:['liquid','water']},
    water_bottle_2l:     {name:'矿泉水2L',             category:'water',    subtype:'water',    basePrice:28,  w:1,h:2,puritySystem:true, expiryDays:null, icon:'🪣',tags:['liquid','water']},
    water_bucket_5l:     {name:'桶装水5L铁桶',         category:'water',    subtype:'water',    basePrice:55,  w:2,h:2,puritySystem:true, expiryDays:null, icon:'🪣',tags:['liquid','water','heavy']},
    water_industrial_10l:{name:'工业用水10L',           category:'water',    subtype:'water',    basePrice:35,  w:2,h:2,puritySystem:true, expiryDays:null, icon:'🛢️',tags:['liquid','industrial']},
    water_distilled_500: {name:'蒸馏水500ml医用瓶',    category:'water',    subtype:'water',    basePrice:40,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'⚗️',tags:['liquid','medical']},
    water_filtered_1l:   {name:'过滤水1L铝壶',         category:'water',    subtype:'water',    basePrice:22,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🍶',tags:['liquid','water']},
    /* ── 酒类 ── */
    vodka_500:           {name:'伏特加500ml',           category:'alcohol',  subtype:'spirits',  basePrice:80,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🍾',tags:['liquid','alcohol'],agedDays:0},
    vodka_1l:            {name:'伏特加1L',              category:'alcohol',  subtype:'spirits',  basePrice:150, w:1,h:2,puritySystem:true, expiryDays:null, icon:'🍾',tags:['liquid','alcohol'],agedDays:0},
    whisky_700:          {name:'威士忌700ml',           category:'alcohol',  subtype:'spirits',  basePrice:200, w:1,h:2,puritySystem:true, expiryDays:null, icon:'🥃',tags:['liquid','alcohol','aging'],agedDays:0},
    beer_can:            {name:'啤酒330ml铁罐',         category:'alcohol',  subtype:'beer',     basePrice:12,  w:1,h:1,puritySystem:true, expiryDays:180,  icon:'🍺',tags:['liquid','alcohol'],agedDays:0},
    moonshine_500:       {name:'私酿白酒500ml',         category:'alcohol',  subtype:'spirits',  basePrice:45,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🍶',tags:['liquid','alcohol','illicit'],agedDays:0},
    industrial_alcohol_5l:{name:'工业酒精5L铁桶',      category:'alcohol',  subtype:'chemical', basePrice:60,  w:1,h:2,puritySystem:true, expiryDays:null, icon:'🛢️',tags:['liquid','chemical'],agedDays:0},
    wine_750:            {name:'红酒750ml',             category:'alcohol',  subtype:'wine',     basePrice:180, w:1,h:2,puritySystem:true, expiryDays:null, icon:'🍷',tags:['liquid','alcohol','aging'],agedDays:0},
    rice_wine_500:       {name:'米酒500ml陶瓷瓶',      category:'alcohol',  subtype:'wine',     basePrice:65,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🍶',tags:['liquid','alcohol','aging'],agedDays:0},
    brandy_500:          {name:'白兰地500ml',           category:'alcohol',  subtype:'spirits',  basePrice:250, w:1,h:2,puritySystem:true, expiryDays:null, icon:'🥂',tags:['liquid','alcohol','aging'],agedDays:0},
    /* ── 烟草类 ── */
    cigarette_pack:      {name:'香烟1包20支',           category:'tobacco',  subtype:'cigarette',basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:730,  icon:'🚬',tags:['tobacco','consumer']},
    cigarette_carton:    {name:'香烟1条10包',           category:'tobacco',  subtype:'cigarette',basePrice:260, w:1,h:2,puritySystem:false,expiryDays:730,  icon:'🚬',tags:['tobacco','consumer','bulk']},
    rolling_tobacco:     {name:'散装烟丝100g',          category:'tobacco',  subtype:'loose',    basePrice:45,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🚬',tags:['tobacco','loose']},
    cigar_box:           {name:'雪茄礼盒',              category:'tobacco',  subtype:'cigar',    basePrice:320, w:1,h:2,puritySystem:false,expiryDays:730,  icon:'🚬',tags:['tobacco','cigar','luxury']},
    chewing_tobacco:     {name:'嚼烟块',                category:'tobacco',  subtype:'chew',     basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:540,  icon:'🚬',tags:['tobacco','chew']},
    tobacco_leaf:        {name:'烟叶500g',              category:'tobacco',  subtype:'leaf',     basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🍂',tags:['tobacco','material','agriculture']},
    vape_pen:            {name:'电子烟',                category:'tobacco',  subtype:'vape',     basePrice:120, w:1,h:1,puritySystem:false,expiryDays:null, icon:'💨',tags:['tobacco','device','modern']},
    /* ── 工业液体 ── */
    fuel_jerrycan_5l:    {name:'燃油5L铁桶',           category:'chemical', subtype:'fuel',     basePrice:90,  w:1,h:2,puritySystem:true, expiryDays:null, icon:'⛽',tags:['liquid','fuel','flammable']},
    acid_1l:             {name:'硫酸1L玻璃瓶',         category:'chemical', subtype:'acid',     basePrice:70,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'⚗️',tags:['liquid','hazard','corrosive']},
    lubricant_500:       {name:'机油500ml',             category:'chemical', subtype:'lubricant',basePrice:35,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🛢️',tags:['liquid','industrial']},
    solvent_1l:          {name:'溶剂1L',                category:'chemical', subtype:'solvent',  basePrice:45,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧪',tags:['liquid','chemical']},
    coolant_2l:          {name:'冷却液2L',              category:'chemical', subtype:'coolant',  basePrice:40,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧊',tags:['liquid','industrial']},
    bleach_1l:           {name:'漂白水1L',              category:'chemical', subtype:'bleach',   basePrice:25,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧴',tags:['liquid','chemical','cleaning']},
    glycerin_500:        {name:'甘油500ml',             category:'chemical', subtype:'glycerin', basePrice:55,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧪',tags:['liquid','chemical','medical']},
    /* ── 食物类 ── */
    canned_meat:         {name:'午餐肉罐头340g',        category:'food',     subtype:'canned',   basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['food','canned','nonperishable']},
    canned_fish:         {name:'鱼罐头200g',            category:'food',     subtype:'canned',   basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['food','canned']},
    canned_beans:        {name:'豆类罐头400g',          category:'food',     subtype:'canned',   basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['food','canned']},
    canned_fruit:        {name:'水果罐头300g',          category:'food',     subtype:'canned',   basePrice:22,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['food','canned']},
    canned_vegetable:    {name:'蔬菜罐头350g',          category:'food',     subtype:'canned',   basePrice:16,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['food','canned']},
    canned_stew:         {name:'炖肉罐头500g',          category:'food',     subtype:'canned',   basePrice:35,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🥘',tags:['food','canned']},
    hardtack:            {name:'压缩饼干500g铝箔',      category:'food',     subtype:'dry',      basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🍪',tags:['food','dry','nonperishable']},
    energy_bar:          {name:'能量棒x5铝箔包',        category:'food',     subtype:'dry',      basePrice:35,  w:1,h:1,puritySystem:false,expiryDays:730,  icon:'🍫',tags:['food','dry']},
    instant_rice:        {name:'真空米饭200g',          category:'food',     subtype:'dry',      basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:180,  icon:'🍚',tags:['food','dry']},
    dried_mushroom:      {name:'干蘑菇100g布袋',        category:'food',     subtype:'dry',      basePrice:28,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🍄',tags:['food','dry']},
    jerky:               {name:'干肉条200g',            category:'food',     subtype:'dry',      basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🥩',tags:['food','dry']},
    salt_bag:            {name:'盐1kg',                 category:'food',     subtype:'spice',    basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧂',tags:['food','spice','nonperishable']},
    sugar_bag:           {name:'糖500g',                category:'food',     subtype:'spice',    basePrice:15,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🍬',tags:['food','spice']},
    coffee_powder:       {name:'咖啡粉200g',            category:'food',     subtype:'beverage', basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'☕',tags:['food','beverage']},
    fresh_vegetable:     {name:'新鲜蔬菜500g',          category:'food',     subtype:'fresh',    basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:3,    icon:'🥦',tags:['food','fresh','perishable']},
    potato_bag:          {name:'土豆2kg',               category:'food',     subtype:'fresh',    basePrice:30,  w:1,h:2,puritySystem:false,expiryDays:30,   icon:'🥔',tags:['food','fresh']},
    sprouted_potato:     {name:'发芽土豆500g',          category:'food',     subtype:'fresh',    basePrice:5,   w:1,h:1,puritySystem:false,expiryDays:5,    icon:'🥔',tags:['food','fresh','damaged']},
    bread_loaf:          {name:'面包',                  category:'food',     subtype:'baked',    basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:5,    icon:'🍞',tags:['food','baked','perishable']},
    protein_powder:      {name:'蛋白粉500g',            category:'food',     subtype:'supplement',basePrice:80, w:1,h:1,puritySystem:false,expiryDays:730,  icon:'💪',tags:['food','supplement']},
    vitamin_pack:        {name:'综合维生素x30片',       category:'food',     subtype:'supplement',basePrice:45, w:1,h:1,puritySystem:false,expiryDays:730,  icon:'💊',tags:['food','supplement','medicine']},
    ration_pack:         {name:'军用口粮密封包',        category:'food',     subtype:'ration',   basePrice:90,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🎁',tags:['food','military','nonperishable']},
    spice_pack:          {name:'综合香料包',            category:'food',     subtype:'spice',    basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🌶️',tags:['food','spice']},
    cooking_oil_500:     {name:'食用油500ml',           category:'food',     subtype:'oil',      basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🫙',tags:['food','liquid']},
    /* ── 金属/材料 ── */
    iron_ingot_1kg:      {name:'铁锭1kg',               category:'material', subtype:'metal',    basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔩',tags:['metal','craft']},
    iron_ingot_5kg:      {name:'铁锭5kg',               category:'material', subtype:'metal',    basePrice:95,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🔩',tags:['metal','craft','heavy']},
    copper_pipe_30:      {name:'铜管30cm',              category:'material', subtype:'metal',    basePrice:35,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪛',tags:['metal','pipe']},
    copper_pipe_1m:      {name:'铜管1m',                category:'material', subtype:'metal',    basePrice:110, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🪛',tags:['metal','pipe']},
    aluminum_sheet:      {name:'铝板20x20cm',           category:'material', subtype:'metal',    basePrice:45,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪤',tags:['metal','sheet']},
    screw_bag:           {name:'螺丝螺母套装',          category:'material', subtype:'hardware', basePrice:15,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔧',tags:['hardware','craft']},
    copper_wire:         {name:'废铜线卷',              category:'material', subtype:'metal',    basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪡',tags:['metal','wire','electrical']},
    lead_block:          {name:'铅块500g',              category:'material', subtype:'metal',    basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⬛',tags:['metal','heavy']},
    steel_pipe_50:       {name:'钢管50cm',              category:'material', subtype:'metal',    basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪛',tags:['metal','pipe']},
    spring_pack:         {name:'弹簧x10',               category:'material', subtype:'hardware', basePrice:22,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🌀',tags:['hardware','mechanical']},
    tin_sheet:           {name:'锡板10x10cm',           category:'material', subtype:'metal',    basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪤',tags:['metal','sheet']},
    brass_rod:           {name:'黄铜棒20cm',            category:'material', subtype:'metal',    basePrice:48,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔑',tags:['metal','rod']},
    magnet:              {name:'强磁铁',                category:'material', subtype:'hardware', basePrice:35,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧲',tags:['hardware','magnetic']},
    chain_1m:            {name:'铁链1m',                category:'material', subtype:'metal',    basePrice:38,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'⛓️',tags:['metal','chain']},
    bearing_pack:        {name:'轴承x4',                category:'material', subtype:'hardware', basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚙️',tags:['hardware','mechanical']},
    steel_ball_pack:     {name:'钢珠x20',               category:'material', subtype:'hardware', basePrice:28,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚫',tags:['hardware','ammo']},
    wire_mesh:           {name:'铁丝网30x30',           category:'material', subtype:'metal',    basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🕸️',tags:['metal','mesh']},
    rivets_bag:          {name:'铆钉包',                category:'material', subtype:'hardware', basePrice:12,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔩',tags:['hardware','craft']},
    /* ── 电子类 ── */
    battery_aa:          {name:'5号电池x4',             category:'tech',     subtype:'battery',  basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:1825,icon:'🔋',tags:['tech','power']},
    battery_large:       {name:'大号锂电池',            category:'tech',     subtype:'battery',  basePrice:45,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔋',tags:['tech','power']},
    battery_flat:        {name:'平板电池',              category:'tech',     subtype:'battery',  basePrice:80,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔋',tags:['tech','power']},
    solar_panel_small:   {name:'小型太阳能板',          category:'tech',     subtype:'solar',    basePrice:120, w:1,h:2,puritySystem:false,expiryDays:null, icon:'☀️',tags:['tech','power','solar']},
    solar_panel_mid:     {name:'中型太阳能板',          category:'tech',     subtype:'solar',    basePrice:280, w:2,h:2,puritySystem:false,expiryDays:null, icon:'☀️',tags:['tech','power','solar']},
    circuit_board:       {name:'电路板完整',            category:'tech',     subtype:'board',    basePrice:65,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'💻',tags:['tech','electronics']},
    circuit_board_broken:{name:'电路板碎片',            category:'tech',     subtype:'board',    basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'💻',tags:['tech','junk','electronics']},
    led_strip:           {name:'LED灯条1m',             category:'tech',     subtype:'lighting', basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'💡',tags:['tech','lighting']},
    radio_module:        {name:'无线电模块',            category:'tech',     subtype:'radio',    basePrice:90,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'📡',tags:['tech','communication']},
    motion_sensor:       {name:'运动传感器',            category:'tech',     subtype:'sensor',   basePrice:75,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'👁️',tags:['tech','sensor']},
    capacitor_pack:      {name:'电容x10',               category:'tech',     subtype:'component',basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚡',tags:['tech','component']},
    transistor_pack:     {name:'晶体管x20',             category:'tech',     subtype:'component',basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚡',tags:['tech','component']},
    usb_hub:             {name:'USB集线器',             category:'tech',     subtype:'connector',basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔌',tags:['tech','connector']},
    antenna:             {name:'短波天线',              category:'tech',     subtype:'radio',    basePrice:85,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'📡',tags:['tech','communication']},
    thermostat:          {name:'温控器',                category:'tech',     subtype:'sensor',   basePrice:70,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🌡️',tags:['tech','sensor']},
    power_inverter:      {name:'逆变器',                category:'tech',     subtype:'power',    basePrice:160, w:1,h:2,puritySystem:false,expiryDays:null, icon:'⚡',tags:['tech','power']},
    relay_module:        {name:'继电器模块',            category:'tech',     subtype:'component',basePrice:38,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚙️',tags:['tech','component']},
    voltage_meter:       {name:'万用表',                category:'tech',     subtype:'tool',     basePrice:95,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'📏',tags:['tech','tool']},
    /* ── 医疗类 ── */
    bandage_roll:        {name:'绷带卷',                category:'medicine', subtype:'bandage',  basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:1825,icon:'🩹',tags:['medicine','first-aid']},
    gauze_pack:          {name:'纱布包',                category:'medicine', subtype:'bandage',  basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:1825,icon:'🩹',tags:['medicine','first-aid']},
    antiseptic_100:      {name:'碘伏100ml',             category:'medicine', subtype:'antiseptic',basePrice:35, w:1,h:1,puritySystem:false,expiryDays:730,  icon:'🧴',tags:['medicine','antiseptic']},
    saline_500:          {name:'生理盐水500ml',         category:'medicine', subtype:'fluid',    basePrice:50,  w:1,h:1,puritySystem:false,expiryDays:730,  icon:'💉',tags:['medicine','fluid']},
    painkiller:          {name:'止痛药x20片',           category:'medicine', subtype:'drug',     basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:1095,icon:'💊',tags:['medicine','drug']},
    antibiotic:          {name:'抗生素x10片',           category:'medicine', subtype:'drug',     basePrice:80,  w:1,h:1,puritySystem:false,expiryDays:730,  icon:'💊',tags:['medicine','drug','prescription']},
    tetanus_vaccine:     {name:'破伤风疫苗注射器',     category:'medicine', subtype:'vaccine',  basePrice:120, w:1,h:1,puritySystem:false,expiryDays:365,  icon:'💉',tags:['medicine','vaccine']},
    antidote:            {name:'解毒血清1ml',           category:'medicine', subtype:'antidote', basePrice:300, w:1,h:1,puritySystem:false,expiryDays:180,  icon:'🧪',tags:['medicine','rare','antidote']},
    sleeping_pill:       {name:'安眠药x10管制',        category:'medicine', subtype:'controlled',basePrice:60, w:1,h:1,puritySystem:false,expiryDays:1095,icon:'💊',tags:['medicine','controlled']},
    stimulant:           {name:'兴奋剂针管制',         category:'medicine', subtype:'controlled',basePrice:200,w:1,h:1,puritySystem:false,expiryDays:365,  icon:'💉',tags:['medicine','controlled','illegal']},
    morphine:            {name:'吗啡针管制',           category:'medicine', subtype:'controlled',basePrice:400,w:1,h:1,puritySystem:false,expiryDays:365,  icon:'💉',tags:['medicine','controlled','illegal']},
    vitamin_c:           {name:'维生素Cx100片',        category:'medicine', subtype:'vitamin',  basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:1095,icon:'💊',tags:['medicine','vitamin']},
    water_purifier_tablet:{name:'净水片x20',           category:'medicine', subtype:'purifier', basePrice:28,  w:1,h:1,puritySystem:false,expiryDays:1825,icon:'💧',tags:['medicine','purifier','survival']},
    surgical_kit:        {name:'外科手术包',           category:'medicine', subtype:'kit',      basePrice:280, w:1,h:2,puritySystem:false,expiryDays:1825,icon:'🩺',tags:['medicine','surgery','kit']},
    radiation_pill:      {name:'碘化钾片x30',          category:'medicine', subtype:'radiation',basePrice:90,  w:1,h:1,puritySystem:false,expiryDays:1825,icon:'☢️',tags:['medicine','radiation','survival']},
    first_aid_kit:       {name:'急救包',               category:'medicine', subtype:'kit',      basePrice:150, w:1,h:2,puritySystem:false,expiryDays:1825,icon:'🩺',tags:['medicine','kit','first-aid']},
    eye_drops:           {name:'眼药水10ml',           category:'medicine', subtype:'eye',      basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'👁️',tags:['medicine','eye']},
    fever_reducer:       {name:'退烧药x15',            category:'medicine', subtype:'drug',     basePrice:35,  w:1,h:1,puritySystem:false,expiryDays:1095,icon:'💊',tags:['medicine','drug']},
    /* ── 工具/装备 ── */
    multitool:           {name:'多功能刀',             category:'equipment',subtype:'tool',     basePrice:80,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔪',tags:['tool','survival','multi']},
    wrench:              {name:'扳手',                 category:'equipment',subtype:'tool',     basePrice:45,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔧',tags:['tool','repair']},
    pliers:              {name:'钳子',                 category:'equipment',subtype:'tool',     basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔧',tags:['tool','repair']},
    soldering_iron:      {name:'焊枪',                 category:'equipment',subtype:'tool',     basePrice:110, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔥',tags:['tool','electronics']},
    water_tester:        {name:'水质检测仪',           category:'equipment',subtype:'instrument',basePrice:150,w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧪',tags:['tool','instrument','water']},
    geiger:              {name:'辐射计',               category:'equipment',subtype:'instrument',basePrice:200,w:1,h:1,puritySystem:false,expiryDays:null, icon:'☢️',tags:['tool','instrument','radiation']},
    magnifier:           {name:'放大镜',               category:'equipment',subtype:'tool',     basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔍',tags:['tool','optics']},
    balance_scale:       {name:'天平秤',               category:'equipment',subtype:'instrument',basePrice:120,w:1,h:2,puritySystem:false,expiryDays:null, icon:'⚖️',tags:['tool','instrument','trade']},
    lockpick_set:        {name:'开锁工具套装',         category:'equipment',subtype:'tool',     basePrice:90,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🗝️',tags:['tool','lockpick','illegal']},
    knife:               {name:'战术刀',               category:'equipment',subtype:'weapon',   basePrice:70,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔪',tags:['weapon','blade']},
    axe:                 {name:'斧头',                 category:'equipment',subtype:'weapon',   basePrice:95,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🪓',tags:['weapon','tool','heavy']},
    rope_10m:            {name:'绳子10m',              category:'equipment',subtype:'survival', basePrice:35,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🪢',tags:['tool','survival']},
    tarp:                {name:'防水布',               category:'equipment',subtype:'survival', basePrice:50,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🏕️',tags:['tool','survival','shelter']},
    flashlight:          {name:'手电筒',               category:'equipment',subtype:'lighting', basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔦',tags:['tool','lighting']},
    gas_mask:            {name:'防毒面具',             category:'equipment',subtype:'protection',basePrice:180,w:1,h:2,puritySystem:false,expiryDays:null, icon:'😷',tags:['protection','hazmat']},
    hazmat_gloves:       {name:'防化手套',             category:'equipment',subtype:'protection',basePrice:45, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧤',tags:['protection','hazmat']},
    shovel:              {name:'折叠铲',               category:'equipment',subtype:'tool',     basePrice:65,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⛏️',tags:['tool','digging']},
    saw:                 {name:'手锯',                 category:'equipment',subtype:'tool',     basePrice:75,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🪚',tags:['tool','cutting']},
    /* ── 违禁/稀有 ── */
    fake_id:             {name:'伪造证件',             category:'illegal',  subtype:'document', basePrice:500, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪪',tags:['illegal','document','rare']},
    signal_jammer:       {name:'信号干扰器',           category:'illegal',  subtype:'device',   basePrice:350, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📡',tags:['illegal','tech','device']},
    ammo_9mm:            {name:'9mm弹药x30',           category:'illegal',  subtype:'ammo',     basePrice:120, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔫',tags:['illegal','ammo','weapon']},
    ammo_762:            {name:'7.62mm弹药x20',        category:'illegal',  subtype:'ammo',     basePrice:200, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🔫',tags:['illegal','ammo','weapon']},
    pistol:              {name:'手枪',                 category:'illegal',  subtype:'firearm',  basePrice:800, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🔫',tags:['illegal','weapon','firearm']},
    stun_grenade:        {name:'闪光弹',               category:'illegal',  subtype:'explosive',basePrice:250, w:1,h:1,puritySystem:false,expiryDays:null, icon:'💥',tags:['illegal','explosive','weapon']},
    explosive:           {name:'炸药块',               category:'illegal',  subtype:'explosive',basePrice:600, w:1,h:1,puritySystem:false,expiryDays:null, icon:'💣',tags:['illegal','explosive','rare']},
    stolen_goods:        {name:'来历不明货物',         category:'illegal',  subtype:'unknown',  basePrice:150, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📦',tags:['illegal','mystery']},
    black_market_info:   {name:'黑市情报纸条',         category:'illegal',  subtype:'document', basePrice:80,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'📝',tags:['illegal','document','info']},
    /* ── 灵霄宗门界：原料 ───────────────────────────────────────
     * 这一批是炼丹链的上游。刻意把原料压得很便宜、成品拉得很贵——
     * 差价就是生产系统的全部意义，也是玩家愿意花 ¤ 买机器、烧电、等天数的理由。
     * 失败率再把这笔差价削回来一部分，成品比原料值钱，除非炼废了。
     */
    herb_lingcao:        {name:'灵草',                 category:'material', subtype:'herb',    basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:180, icon:'🌿',tags:['herb','xianxia','alchemy']},
    herb_huoyan:         {name:'火炎花',               category:'material', subtype:'herb',    basePrice:32,  w:1,h:1,puritySystem:false,expiryDays:180, icon:'🌺',tags:['herb','xianxia','alchemy','hot']},
    herb_lingzhi:        {name:'灵芝',                 category:'material', subtype:'herb',    basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:365, icon:'🍄',tags:['herb','xianxia','alchemy','rare']},
    cinnabar_ore:        {name:'丹砂矿',               category:'material', subtype:'ore',     basePrice:25,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟥',tags:['ore','xianxia','alchemy','mineral']},
    spirit_sand:         {name:'灵砂',                 category:'material', subtype:'ore',     basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'✨',tags:['ore','xianxia','alchemy','mineral']},
    spirit_ore:          {name:'灵矿原石',             category:'material', subtype:'ore',     basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'💠',tags:['ore','xianxia','mineral']},
    spirit_stone:        {name:'灵石',                 category:'material', subtype:'crystal', basePrice:150, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔷',tags:['xianxia','crystal','currency']},
    beast_core:          {name:'妖兽内丹',             category:'material', subtype:'core',    basePrice:380, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔮',tags:['xianxia','core','rare']},
    /* ── 灵霄宗门界：辅料 ── */
    spirit_essence:      {name:'灵液500ml',            category:'chemical', subtype:'essence', basePrice:110, w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧫',tags:['liquid','xianxia','alchemy']},
    toxic_extract:       {name:'毒液提取液',           category:'chemical', subtype:'toxin',   basePrice:75,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'☠️',tags:['liquid','xianxia','hazard']},
    cinnabar_ink:        {name:'朱砂墨',               category:'misc',     subtype:'ink',     basePrice:65,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🖌️',tags:['xianxia','craft','material']},
    talisman_paper:      {name:'符纸',                 category:'misc',     subtype:'paper',   basePrice:40,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'📜',tags:['xianxia','craft','paper']},
    recipe_scroll:       {name:'丹方残卷',             category:'misc',     subtype:'document',basePrice:140, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📜',tags:['xianxia','document','recipe']},
    sect_token:          {name:'宗门令牌',             category:'misc',     subtype:'document',basePrice:200, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🎴',tags:['xianxia','document','credential']},
    /* ── 灵霄宗门界：成品丹药 ── */
    qi_pill:             {name:'回气丹',               category:'medicine', subtype:'pill',    basePrice:120, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟠',tags:['medicine','xianxia','pill']},
    spirit_pill:         {name:'凝神丹',               category:'medicine', subtype:'pill',    basePrice:260, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟣',tags:['medicine','xianxia','pill']},
    healing_pill:        {name:'疗伤丹',               category:'medicine', subtype:'pill',    basePrice:380, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔴',tags:['medicine','xianxia','pill']},
    marrow_pill:         {name:'洗髓丹',               category:'medicine', subtype:'pill',    basePrice:1200,w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟡',tags:['medicine','xianxia','pill','rare']},
    toxic_pill:          {name:'毒丹',                 category:'medicine', subtype:'pill',    basePrice:220, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟢',tags:['medicine','xianxia','pill','hazard']},
    waste_pill:          {name:'废丹',                 category:'medicine', subtype:'pill',    basePrice:22,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚫',tags:['medicine','xianxia','junk']},
    jade_gourd:          {name:'玉葫芦',               category:'equipment',subtype:'xianxia', basePrice:160, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🏺',tags:['xianxia','tool','container']},
    formation_disc:      {name:'阵盘',                 category:'equipment',subtype:'xianxia', basePrice:300, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🔯',tags:['xianxia','device']},
    /* ── 核爆废土：装配台成品与废料 ─────────────────────────────
     * 装配台把便宜零件拼成贵的整机；失败则烧成废件。
     */
    power_drill:         {name:'电动工具',             category:'equipment',subtype:'tool',    basePrice:240, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔩',tags:['tool','power','craft']},
    radio_station:       {name:'自制电台',             category:'tech',     subtype:'radio',   basePrice:320, w:1,h:2,puritySystem:false,expiryDays:null, icon:'📻',tags:['tech','communication','craft']},
    burnt_board:         {name:'烧毁电路',             category:'tech',     subtype:'junk',    basePrice:12,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔥',tags:['tech','junk']},
    slag:                {name:'炉渣',                 category:'misc',     subtype:'junk',    basePrice:6,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪨',tags:['junk','metal']},

    /* ══ 扩展包 A · 宗门材料（喂给丹炉与符箓台） ══════════════ */
    spirit_wood:         {name:'灵木',                 category:'material', subtype:'wood',    basePrice:65,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🎋',tags:['material','xianxia','wood']},
    black_iron:          {name:'玄铁',                 category:'material', subtype:'ore',     basePrice:180, w:1,h:1,puritySystem:false,expiryDays:null, icon:'⬛',tags:['material','xianxia','ore','rare']},
    beast_bone:          {name:'妖兽骨',               category:'material', subtype:'bone',    basePrice:95,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🦴',tags:['material','xianxia','bone']},
    spirit_silk:         {name:'灵蚕丝',               category:'material', subtype:'cloth',   basePrice:140, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧵',tags:['material','xianxia','cloth']},
    moon_dew:            {name:'月华露',               category:'material', subtype:'essence', basePrice:120, w:1,h:1,puritySystem:false,expiryDays:120,  icon:'💧',tags:['material','xianxia','essence','alchemy']},
    thunder_stone:       {name:'雷击石',               category:'material', subtype:'ore',     basePrice:210, w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚡',tags:['material','xianxia','ore','hot']},

    /* ══ 扩展包 B · 废土稀有材料 ══════════════════════════════ */
    titanium_scrap:      {name:'钛合金边角料',         category:'material', subtype:'metal',   basePrice:85,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⚙️',tags:['material','metal','alloy']},
    rare_earth:          {name:'稀土矿粉',             category:'material', subtype:'ore',     basePrice:130, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪙',tags:['material','ore','rare']},
    rubber_sheet:        {name:'橡胶板',               category:'material', subtype:'rubber',  basePrice:28,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⬜',tags:['material','rubber']},
    glass_pane:          {name:'玻璃板',               category:'material', subtype:'glass',   basePrice:22,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🪟',tags:['material','glass']},
    copper_wire_coil:    {name:'铜线圈',               category:'material', subtype:'metal',   basePrice:55,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧲',tags:['material','metal','electric']},
    ceramic_plate:       {name:'陶瓷片',               category:'material', subtype:'ceramic', basePrice:38,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🍽️',tags:['material','ceramic']},

    /* ══ 扩展包 C · 高阶电子 ══════════════════════════════════ */
    microchip:           {name:'微处理器',             category:'tech',     subtype:'chip',    basePrice:260, w:1,h:1,puritySystem:false,expiryDays:null, icon:'💠',tags:['tech','chip','electronics']},
    antenna_array:       {name:'天线阵列',             category:'tech',     subtype:'antenna', basePrice:150, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📡',tags:['tech','communication','radio']},
    servo_motor:         {name:'伺服电机',             category:'tech',     subtype:'motor',   basePrice:190, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🌀',tags:['tech','motor','mechanical']},
    power_cell:          {name:'高能电池组',           category:'tech',     subtype:'battery', basePrice:220, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔋',tags:['tech','battery','power']},
    sensor_module:       {name:'传感器模块',           category:'tech',     subtype:'sensor',  basePrice:165, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📶',tags:['tech','sensor','electronics']},
    display_panel:       {name:'显示面板',             category:'tech',     subtype:'display', basePrice:140, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🖥️',tags:['tech','display','electronics']},
    relay_switch:        {name:'继电器组',             category:'tech',     subtype:'relay',   basePrice:75,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔌',tags:['tech','relay','electric']},

    /* ══ 扩展包 D · 宗门丹药与医药 ════════════════════════════ */
    foundation_pill:     {name:'筑基丹',               category:'medicine', subtype:'pill',    basePrice:900, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟣',tags:['medicine','xianxia','pill','rare']},
    detox_pill:          {name:'解毒丹',               category:'medicine', subtype:'pill',    basePrice:280, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🟢',tags:['medicine','xianxia','pill','antidote']},
    marrow_wash_pill:    {name:'淬体丹',               category:'medicine', subtype:'pill',    basePrice:600, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔵',tags:['medicine','xianxia','pill','rare']},
    blood_pill:          {name:'补血丹',               category:'medicine', subtype:'pill',    basePrice:190, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔴',tags:['medicine','xianxia','pill','healing']},
    antiserum:           {name:'抗毒血清',             category:'medicine', subtype:'injectable',basePrice:320,w:1,h:1,puritySystem:false,expiryDays:180, icon:'💉',tags:['medicine','injectable','antidote']},
    painkiller:          {name:'强效止痛片',           category:'medicine', subtype:'pill',    basePrice:85,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'⚪',tags:['medicine','pill','pain']},
    stimulant:           {name:'兴奋剂',               category:'medicine', subtype:'injectable',basePrice:140,w:1,h:1,puritySystem:false,expiryDays:240,icon:'💊',tags:['medicine','injectable','stimulant']},

    /* ══ 扩展包 E · 装备与法器 ════════════════════════════════ */
    spirit_sword:        {name:'灵剑',                 category:'equipment',subtype:'weapon',  basePrice:1100,w:1,h:2,puritySystem:false,expiryDays:null, icon:'🗡️',tags:['equipment','weapon','xianxia','rare']},
    talisman_robe:       {name:'符纹道袍',             category:'equipment',subtype:'armor',   basePrice:680, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🥋',tags:['equipment','armor','xianxia']},
    storage_ring:        {name:'储物戒',               category:'equipment',subtype:'accessory',basePrice:1500,w:1,h:1,puritySystem:false,expiryDays:null, icon:'💍',tags:['equipment','accessory','xianxia','rare']},
    spirit_lantern:      {name:'引魂灯',               category:'equipment',subtype:'tool',    basePrice:420, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🏮',tags:['equipment','tool','xianxia']},
    hazmat_suit:         {name:'全套防化服',           category:'equipment',subtype:'armor',   basePrice:520, w:1,h:2,puritySystem:false,expiryDays:null, icon:'🥼',tags:['equipment','armor','survival']},
    welding_mask:        {name:'焊接面罩',             category:'equipment',subtype:'tool',    basePrice:95,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪖',tags:['equipment','tool','repair']},
    toolbox:             {name:'工具箱',               category:'equipment',subtype:'tool',    basePrice:180, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧰',tags:['equipment','tool','repair']},
    night_vision:        {name:'夜视仪',               category:'equipment',subtype:'gadget',  basePrice:460, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🌙',tags:['equipment','gadget','optics']},
    climbing_gear:       {name:'攀爬索具',             category:'equipment',subtype:'tool',    basePrice:130, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪜',tags:['equipment','tool','survival']},

    /* ══ 扩展包 F · 宗门灵食与废土干粮 ════════════════════════ */
    spirit_rice:         {name:'灵米1kg',              category:'food',     subtype:'grain',   basePrice:75,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🍚',tags:['food','xianxia','grain']},
    spirit_tea:          {name:'灵茶50g',              category:'food',     subtype:'drink',   basePrice:110, w:1,h:1,puritySystem:false,expiryDays:540,  icon:'🍵',tags:['food','xianxia','drink','luxury']},
    dried_meat:          {name:'风干兽肉',             category:'food',     subtype:'meat',    basePrice:90,  w:1,h:1,puritySystem:false,expiryDays:400,  icon:'🥓',tags:['food','xianxia','meat']},
    compressed_ration:   {name:'压缩口粮',             category:'food',     subtype:'ration',  basePrice:35,  w:1,h:1,puritySystem:false,expiryDays:1800, icon:'🍫',tags:['food','ration','survival']},
    pickled_veg:         {name:'腌菜罐',               category:'food',     subtype:'preserve',basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:900,  icon:'🫙',tags:['food','preserve']},

    /* ══ 扩展包 G · 化学品完整链 ══════════════════════════════ */
    hydrochloric_acid:   {name:'盐酸1L',               category:'chemical', subtype:'acid',    basePrice:42,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧪',tags:['chemical','acid','industrial']},
    lye_solution:        {name:'烧碱溶液1L',           category:'chemical', subtype:'base',    basePrice:38,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧼',tags:['chemical','base','industrial']},
    acetone:             {name:'丙酮500ml',            category:'chemical', subtype:'solvent', basePrice:48,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'💨',tags:['chemical','solvent','industrial']},
    hydrogen_peroxide:   {name:'双氧水500ml',          category:'chemical', subtype:'oxidizer',basePrice:36,  w:1,h:1,puritySystem:true, expiryDays:365,  icon:'🫧',tags:['chemical','oxidizer','medical']},
    ammonia:             {name:'氨水1L',               category:'chemical', subtype:'base',    basePrice:40,  w:1,h:1,puritySystem:true, expiryDays:null, icon:'🧴',tags:['chemical','base','industrial']},
    resin_glue:          {name:'合成树脂胶',           category:'chemical', subtype:'adhesive',basePrice:58,  w:1,h:1,puritySystem:false,expiryDays:720,  icon:'🩹',tags:['chemical','adhesive','craft']},

    /* ══ 扩展包 H · 杂项与凭证 ════════════════════════════════ */
    sect_pass:           {name:'宗门通行令',           category:'misc',     subtype:'token',   basePrice:280, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🎫',tags:['misc','xianxia','token','document']},
    beast_tamer_permit:  {name:'御兽许可',             category:'misc',     subtype:'document',basePrice:340, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📜',tags:['misc','xianxia','document','rare']},
    ancient_coin:        {name:'古币',                 category:'misc',     subtype:'currency',basePrice:200, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🪙',tags:['misc','currency','collectible']},
    star_chart:          {name:'星图残卷',             category:'misc',     subtype:'document',basePrice:180, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🌌',tags:['misc','document','navigation']},
    blueprint:           {name:'机械图纸',             category:'misc',     subtype:'document',basePrice:260, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📐',tags:['misc','document','craft','recipe']},

    /* ── 杂项 ── */
    junk_metal:          {name:'废铁500g',             category:'misc',     subtype:'junk',     basePrice:4,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🗑️',tags:['junk','metal']},
    junk_plastic:        {name:'废塑料',               category:'misc',     subtype:'junk',     basePrice:3,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🗑️',tags:['junk','plastic']},
    junk_cloth:          {name:'破布',                 category:'misc',     subtype:'junk',     basePrice:5,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧣',tags:['junk','cloth']},
    empty_bottle:        {name:'空瓶',                 category:'misc',     subtype:'container',basePrice:2,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🍾',tags:['container','junk']},
    empty_can:           {name:'空罐头',               category:'misc',     subtype:'container',basePrice:1,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🥫',tags:['container','junk']},
    map_fragment:        {name:'地图碎片',             category:'misc',     subtype:'document', basePrice:60,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🗺️',tags:['document','rare','navigation']},
    recipe_card:         {name:'配方卡',               category:'misc',     subtype:'document', basePrice:100, w:1,h:1,puritySystem:false,expiryDays:null, icon:'📋',tags:['document','craft','recipe']},
    filter_cartridge:    {name:'净水滤芯',             category:'misc',     subtype:'filter',   basePrice:65,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🔵',tags:['filter','survival','water']},
    seed_wheat:          {name:'小麦种子50g',          category:'misc',     subtype:'seed',     basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🌾',tags:['seed','farming']},
    seed_potato:         {name:'土豆种块200g',         category:'misc',     subtype:'seed',     basePrice:15,  w:1,h:1,puritySystem:false,expiryDays:60,   icon:'🥔',tags:['seed','farming']},
    seed_herb:           {name:'药草种子',             category:'misc',     subtype:'seed',     basePrice:30,  w:1,h:1,puritySystem:false,expiryDays:365,  icon:'🌿',tags:['seed','farming','medicine']},
    soil_bag:            {name:'培养土2kg',            category:'misc',     subtype:'farming',  basePrice:25,  w:1,h:2,puritySystem:false,expiryDays:null, icon:'🌱',tags:['farming','soil']},
    charcoal_bag:        {name:'木炭1kg',              category:'misc',     subtype:'fuel',     basePrice:18,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'⬛',tags:['fuel','craft']},
    candle_pack:         {name:'蜡烛x10',              category:'misc',     subtype:'lighting', basePrice:20,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🕯️',tags:['lighting','survival']},
    matches:             {name:'火柴盒',               category:'misc',     subtype:'fire',     basePrice:8,   w:1,h:1,puritySystem:false,expiryDays:null, icon:'🔥',tags:['fire','survival']},
    duct_tape:           {name:'胶带5m',               category:'misc',     subtype:'repair',   basePrice:22,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🖇️',tags:['repair','craft']},
    plastic_bag:         {name:'塑料袋x50',            category:'misc',     subtype:'container',basePrice:10,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'🛍️',tags:['container','misc']},
    notebook:            {name:'笔记本',               category:'misc',     subtype:'document', basePrice:15,  w:1,h:1,puritySystem:false,expiryDays:null, icon:'📓',tags:['document','misc']},
    compass:             {name:'指南针',               category:'misc',     subtype:'instrument',basePrice:40, w:1,h:1,puritySystem:false,expiryDays:null, icon:'🧭',tags:['instrument','navigation','survival']}
  };

  /* ─── 物品模型 ─────────────────────────────────────────────────── */
  // createItem(skuId, overrides) → item instance
  function createItem(skuId, overrides){
    var sku=ITEM_CATALOG[skuId];
    if(!sku)throw new Error('Unknown SKU: '+skuId);
    overrides=overrides||{};
    var quality=overrides.quality||3;
    var genuine=overrides.genuine!==false;
    var origin=overrides.origin||'unknown';
    var expiry=overrides.expiry!=null?overrides.expiry:sku.expiryDays;
    var agedDays=overrides.agedDays!=null?overrides.agedDays:(sku.agedDays!=null?sku.agedDays:undefined);
    var item={
      id: _uid(),
      skuId: skuId,
      name: sku.name,
      category: sku.category,
      subtype: sku.subtype,
      w: sku.w,
      h: sku.h,
      rotated: false,
      quality: quality,
      genuine: genuine,
      expiry: expiry,
      origin: origin,
      basePrice: sku.basePrice,
      puritySystem: sku.puritySystem||false,
      icon: sku.icon||'📦',
      tags: sku.tags||[],
      brand: overrides.brand || sku.brand || null,
      supplier: overrides.supplier || sku.supplier || null,
      notes: ''
    };
    if(sku.puritySystem){
      item.purity=overrides.purity||3;
    }
    if(agedDays!==undefined){
      item.agedDays=agedDays;
    }
    return item;
  }

  function _uid(){
    return Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  }

  /* ─── 格子仓库 ─────────────────────────────────────────────────── */
  function createGrid(cols,rows){
    return {
      cols: cols,
      rows: rows,
      cells: _blankCells(cols,rows),
      items: {}
    };
  }

  function _blankCells(cols,rows){
    var a=[];
    for(var i=0;i<cols*rows;i++)a.push(null);
    return a;
  }

  function _cellIdx(grid,x,y){return y*grid.cols+x;}

  function _itemDims(item){
    if(!item)return{w:1,h:1};
    return item.rotated?{w:item.h,h:item.w}:{w:item.w,h:item.h};
  }

  function canPlace(grid,item,x,y){
    if(!grid||!item)return false;
    var d=_itemDims(item);
    if(x<0||y<0||x+d.w>grid.cols||y+d.h>grid.rows)return false;
    for(var dy=0;dy<d.h;dy++){
      for(var dx=0;dx<d.w;dx++){
        if(grid.cells[_cellIdx(grid,x+dx,y+dy)]!==null)return false;
      }
    }
    return true;
  }

  function place(grid,item,x,y){
    if(!canPlace(grid,item,x,y))return false;
    var d=_itemDims(item);
    for(var dy=0;dy<d.h;dy++)
      for(var dx=0;dx<d.w;dx++)
        grid.cells[_cellIdx(grid,x+dx,y+dy)]=item.id;
    grid.items[item.id]={item:item,x:x,y:y};
    return true;
  }

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

  function getAt(grid,x,y){
    if(x<0||y<0||x>=grid.cols||y>=grid.rows)return null;
    var id=grid.cells[_cellIdx(grid,x,y)];
    if(!id)return null;
    return grid.items[id]?grid.items[id].item:null;
  }

  function rotate(item){
    item.rotated=!item.rotated;
    return item;
  }

  /* ─── 市场行情 ─────────────────────────────────────────────────── */
  function categoryName(key){return CATEGORY_NAMES[key]||key;}

  function createMarketState(){
    return {
      day: 0,
      coefficients:{
        water:       1.0,
        alcohol:     1.0,
        tobacco:     1.0,
        chemical:    1.0,
        food:        1.0,
        material:    1.0,
        tech:        1.0,
        medicine:    1.0,
        equipment:   1.0,
        illegal:     1.0,
        misc:        1.0
      },
      stockout:{
        water:       0,
        alcohol:     0,
        tobacco:     0,
        chemical:    0,
        food:        0,
        material:    0,
        tech:        0,
        medicine:    0,
        equipment:   0,
        illegal:     0,
        misc:        0
      },
      pendingShocks: []
    };
  }

  /* computePrice
   * puritySystem items: basePrice * purityMult * marketCoeff
   * alcohol with agedDays: applies aging bonus *(1+agedDays*0.01) capped at *3
   * standard items: basePrice * qualityMult * marketCoeff * genuineMult
   */
  function computePrice(market,item){
    var coeff=market.coefficients[item.category]||1.0;
    if(item.puritySystem){
      var purity=item.purity!=null?item.purity:3;
      var purityMult=PURITY_MULT[purity]||1.0;
      var base=item.basePrice*purityMult*coeff;
      if(item.agedDays!=null&&item.agedDays>0){
        var ageMult=Math.min(3, 1+item.agedDays*0.01);
        base=base*ageMult;
      }
      return Math.round(base);
    }
    var qualityMult=QUALITY_MULT[item.quality]||1.0;
    var genuineMult=item.genuine?1.0:0.35;
    return Math.round(item.basePrice*qualityMult*coeff*genuineMult);
  }

  /* ─── 派遣系统 ─────────────────────────────────────────────────── */
  function createDispatch(npcId,npcName,destination,days){
    var defaultDays={suburb:1,midrange:3,deepzone:7};
    var d=days||defaultDays[destination]||1;
    return {
      id: _uid(),
      npcId: npcId,
      npcName: npcName||'NPC',
      destination: destination||'suburb',
      daysRemaining: d,
      totalDays: d,
      status: 'out'
    };
  }

  var _DISPATCH_LOOT={
    suburb:{
      skus:['water_bottle_500','water_cup','junk_metal','junk_plastic','junk_cloth','canned_beans','canned_fish','empty_bottle','matches','candle_pack'],
      count:[1,3],qualityRange:[1,3]
    },
    midrange:{
      skus:['water_bottle_500','water_bottle_2l','canned_meat','canned_stew','iron_ingot_1kg','copper_pipe_30','battery_aa','bandage_roll','painkiller','multitool','screw_bag','salt_bag','hardtack'],
      count:[1,4],qualityRange:[2,4]
    },
    deepzone:{
      // signal_jammer 是唯一没法靠商旅带上门的货（¤350 超过访客带货上限），
      // 所以它的入口只能在这里：一台被遗弃在禁区里的干扰器。
      // 240 的补给费加 7 天往返，换来它也不算白送。
      skus:['water_distilled_500','canned_meat','iron_ingot_5kg','circuit_board','antibiotic','surgical_kit','first_aid_kit','voltage_meter','radio_module','fuel_jerrycan_5l','geiger','antidote','ammo_9mm','stolen_goods','recipe_card','map_fragment','signal_jammer','ammo_762','stun_grenade','hazmat_suit','night_vision','toolbox'],
      count:[2,5],qualityRange:[2,5]
    },
    sect_ruins:{
      // 宗门界的派遣目的地。高阶法器与丹材单价高（¤420–1500），
      // 商旅带货上限（900）收不下，只能靠进遗迹去捡。
      // 也正因为难拿，它们才撑得起宗门线的高端交易。
      skus:['spirit_sword','storage_ring','spirit_lantern','talisman_robe','formation_disc','jade_gourd','black_iron','beast_bone','thunder_stone','spirit_silk','moon_dew','spirit_wood','foundation_pill','marrow_wash_pill','sect_pass','beast_tamer_permit','ancient_coin','star_chart','spirit_tea','dried_meat'],
      count:[1,3],qualityRange:[3,5]
    }
  };

  function _randInt(lo,hi){return lo+Math.floor(Math.random()*(hi-lo+1));}

  function _generateDispatchLoot(destination){
    var spec=_DISPATCH_LOOT[destination]||_DISPATCH_LOOT.suburb;
    var count=_randInt(spec.count[0],spec.count[1]);
    var loot=[];
    for(var i=0;i<count;i++){
      var skus=spec.skus.slice();
      if(destination==='midrange'){
        var rareSkus=['antibiotic','voltage_meter','circuit_board'];
        skus=skus.filter(function(s){return rareSkus.indexOf(s)===-1||Math.random()<0.3;});
        if(skus.length===0)skus=['water_bottle_500','canned_beans','junk_metal'];
      }
      if(destination==='deepzone'){
        var veryRare=['ammo_9mm','stolen_goods','antidote','surgical_kit'];
        skus=skus.filter(function(s){return veryRare.indexOf(s)===-1||Math.random()<0.2;});
        if(skus.length===0)skus=['water_bottle_500','canned_meat','iron_ingot_1kg'];
      }
      var skuId=skus[Math.floor(Math.random()*skus.length)];
      var quality=_randInt(spec.qualityRange[0],spec.qualityRange[1]);
      loot.push(createItem(skuId,{quality:quality,origin:'salvage'}));
    }
    return loot;
  }

  /* ─── 日推进 ─────────────────────────────────────────────────────
   * advanceDay(state) → DayResult
   ─────────────────────────────────────────────────────────────────── */
  /* ─── 生产设施与配方 ─────────────────────────────────────────────
   * 机器区（baseState.freeGrid）放的是机器，不是货架——它和仓库是分开的
   * 两块地方：仓库堆货，机器区跑生产。
   *
   * 数值原则：成品的目录价合计 ≈ 原料合计的 2–3 倍。这个倍数就是玩家愿意
   * 花钱买机器、烧电、等天数的全部理由。失败率再把差价削回去一部分——
   * 所以「炼废了」是设计内的风险，不是 bug，越贵的配方废得越狠。
   */
  var MACHINE_DEFS={
    smelter:{
      key:'smelter',label:'熔炉',icon:'🔥',w:2,h:2,cost:300,world:'wasteland_nuclear',
      desc:'把废铁废铜熔成规整的金属锭。废土上最常见的第一台机器。',
      recipes:['melt_iron','melt_copper','melt_steel','alloy_brass']
    },
    workbench:{
      key:'workbench',label:'装配台',icon:'🔧',w:2,h:1,cost:420,world:'wasteland_nuclear',
      desc:'把零件拼成整机。单价最高的产品出在这里，也最容易烧板子。',
      recipes:['fix_board','build_drill','build_inverter','build_radio']
    },
    chem_still:{
      key:'chem_still',label:'化工台',icon:'⚗️',w:2,h:1,cost:380,world:'wasteland_nuclear',
      desc:'提纯与合成腐蚀性药剂，气味很大，成品单价不低。',
      recipes:['refine_acid','make_toxin','make_coolant']
    },
    alchemy_furnace:{
      key:'alchemy_furnace',label:'丹炉',icon:'🏺',w:2,h:2,cost:650,world:'xianxia_sect',
      desc:'灵霄宗门界的看家本事。原料便宜、丹药极贵，但炼制失败会出一炉废丹。',
      recipes:['alchemy_qi','alchemy_spirit','alchemy_heal','alchemy_toxic','alchemy_marrow']
    },
    talisman_desk:{
      key:'talisman_desk',label:'符箓台',icon:'🔯',w:1,h:1,cost:300,world:'xianxia_sect',
      desc:'朱砂落纸，画得出阵盘与令牌。占地小，适合塞在角落。',
      recipes:['make_talisman','carve_token']
    },
    spirit_field:{
      key:'spirit_field',label:'灵田',icon:'🌱',w:2,h:2,cost:200,world:'xianxia_sect',
      desc:'种下药种，几天后收一茬灵草。所有丹方的最上游。',
      recipes:['grow_lingcao','grow_huoyan']
    }
  };

  // 每道配方：吃 inputs、烧 days 天、出 output。failChance 命中则只出 failOutput。
  var RECIPE_DEFS={
    /* ── 熔炉 ── */
    melt_iron:{
      id:'melt_iron',machine:'smelter',label:'熔炼铁锭',days:1,failChance:0.08,
      inputs:[{skuId:'junk_metal',qty:4}],
      output:{skuId:'iron_ingot_1kg',qty:2,qualityRange:[2,4]},
      failOutput:{skuId:'slag',qty:1}
    },
    melt_copper:{
      id:'melt_copper',machine:'smelter',label:'熔炼铜管',days:1,failChance:0.10,
      inputs:[{skuId:'copper_wire',qty:1},{skuId:'junk_metal',qty:2}],
      output:{skuId:'copper_pipe_30',qty:2,qualityRange:[2,4]},
      failOutput:{skuId:'slag',qty:1}
    },
    melt_steel:{
      id:'melt_steel',machine:'smelter',label:'熔炼钢管',days:1,failChance:0.10,
      inputs:[{skuId:'iron_ingot_1kg',qty:1},{skuId:'charcoal_bag',qty:1}],
      output:{skuId:'steel_pipe_50',qty:2,qualityRange:[3,5]},
      failOutput:{skuId:'slag',qty:2}
    },
    alloy_brass:{
      id:'alloy_brass',machine:'smelter',label:'炼黄铜',days:2,failChance:0.15,
      inputs:[{skuId:'copper_pipe_30',qty:1},{skuId:'tin_sheet',qty:1}],
      output:{skuId:'brass_rod',qty:3,qualityRange:[3,5]},
      failOutput:{skuId:'slag',qty:2}
    },
    /* ── 装配台 ── */
    fix_board:{
      id:'fix_board',machine:'workbench',label:'修复电路板',days:1,failChance:0.15,
      inputs:[{skuId:'circuit_board_broken',qty:2},{skuId:'transistor_pack',qty:1}],
      output:{skuId:'circuit_board',qty:2,qualityRange:[2,4]},
      failOutput:{skuId:'burnt_board',qty:1}
    },
    build_drill:{
      id:'build_drill',machine:'workbench',label:'组装电动工具',days:2,failChance:0.12,
      inputs:[{skuId:'iron_ingot_1kg',qty:1},{skuId:'bearing_pack',qty:1},{skuId:'screw_bag',qty:1}],
      output:{skuId:'power_drill',qty:1,qualityRange:[3,5]},
      failOutput:{skuId:'burnt_board',qty:1}
    },
    build_inverter:{
      id:'build_inverter',machine:'workbench',label:'组装逆变器',days:2,failChance:0.18,
      inputs:[{skuId:'circuit_board',qty:1},{skuId:'capacitor_pack',qty:1},{skuId:'relay_module',qty:1}],
      output:{skuId:'power_inverter',qty:2,qualityRange:[3,5]},
      failOutput:{skuId:'burnt_board',qty:2}
    },
    build_radio:{
      id:'build_radio',machine:'workbench',label:'组装电台',days:3,failChance:0.20,
      inputs:[{skuId:'radio_module',qty:1},{skuId:'antenna',qty:1},{skuId:'circuit_board',qty:1}],
      output:{skuId:'radio_station',qty:2,qualityRange:[3,5]},
      failOutput:{skuId:'burnt_board',qty:2}
    },
    /* ── 化工台 ── */
    refine_acid:{
      id:'refine_acid',machine:'chem_still',label:'提纯硫酸',days:1,failChance:0.18,
      inputs:[{skuId:'solvent_1l',qty:1}],
      output:{skuId:'acid_1l',qty:2,qualityRange:[3,5],purityRange:[3,5]},
      failOutput:{skuId:'bleach_1l',qty:1}
    },
    make_toxin:{
      id:'make_toxin',machine:'chem_still',label:'调配毒液',days:2,failChance:0.22,
      inputs:[{skuId:'acid_1l',qty:1},{skuId:'glycerin_500',qty:1}],
      output:{skuId:'toxic_extract',qty:3,qualityRange:[3,5],purityRange:[3,5]},
      failOutput:{skuId:'bleach_1l',qty:2}
    },
    make_coolant:{
      id:'make_coolant',machine:'chem_still',label:'调和冷却液',days:1,failChance:0.12,
      inputs:[{skuId:'bleach_1l',qty:1},{skuId:'water_industrial_10l',qty:1}],
      output:{skuId:'coolant_2l',qty:3,qualityRange:[3,5],purityRange:[3,5]},
      failOutput:{skuId:'bleach_1l',qty:1}
    },
    /* ── 丹炉 ── */
    alchemy_qi:{
      id:'alchemy_qi',machine:'alchemy_furnace',label:'炼回气丹',days:2,failChance:0.20,
      inputs:[{skuId:'herb_lingcao',qty:3},{skuId:'cinnabar_ore',qty:1}],
      output:{skuId:'qi_pill',qty:2,qualityRange:[2,4]},
      failOutput:{skuId:'waste_pill',qty:2}
    },
    alchemy_spirit:{
      id:'alchemy_spirit',machine:'alchemy_furnace',label:'炼凝神丹',days:3,failChance:0.25,
      inputs:[{skuId:'herb_lingcao',qty:2},{skuId:'spirit_sand',qty:2},{skuId:'spirit_essence',qty:1}],
      output:{skuId:'spirit_pill',qty:2,qualityRange:[3,5]},
      failOutput:{skuId:'waste_pill',qty:2}
    },
    alchemy_heal:{
      id:'alchemy_heal',machine:'alchemy_furnace',label:'炼疗伤丹',days:3,failChance:0.25,
      inputs:[{skuId:'herb_lingzhi',qty:1},{skuId:'spirit_essence',qty:1}],
      output:{skuId:'healing_pill',qty:1,qualityRange:[3,5]},
      failOutput:{skuId:'waste_pill',qty:2}
    },
    alchemy_toxic:{
      id:'alchemy_toxic',machine:'alchemy_furnace',label:'炼毒丹',days:2,failChance:0.22,
      inputs:[{skuId:'toxic_extract',qty:2},{skuId:'herb_huoyan',qty:2}],
      output:{skuId:'toxic_pill',qty:2,qualityRange:[3,5]},
      failOutput:{skuId:'waste_pill',qty:2}
    },
    alchemy_marrow:{
      id:'alchemy_marrow',machine:'alchemy_furnace',label:'炼洗髓丹',days:7,failChance:0.40,
      inputs:[{skuId:'beast_core',qty:1},{skuId:'spirit_stone',qty:1},{skuId:'herb_lingzhi',qty:2}],
      output:{skuId:'marrow_pill',qty:1,qualityRange:[3,5]},
      failOutput:{skuId:'waste_pill',qty:3}
    },
    /* ── 符箓台 ── */
    make_talisman:{
      id:'make_talisman',machine:'talisman_desk',label:'画阵盘',days:2,failChance:0.20,
      inputs:[{skuId:'talisman_paper',qty:2},{skuId:'cinnabar_ink',qty:1}],
      output:{skuId:'formation_disc',qty:1,qualityRange:[3,5]},
      failOutput:{skuId:'talisman_paper',qty:1}
    },
    carve_token:{
      id:'carve_token',machine:'talisman_desk',label:'刻宗门令牌',days:1,failChance:0.15,
      inputs:[{skuId:'cinnabar_ink',qty:1},{skuId:'spirit_sand',qty:1}],
      output:{skuId:'sect_token',qty:1,qualityRange:[3,5]},
      failOutput:{skuId:'talisman_paper',qty:1}
    },
    /* ── 灵田 ── */
    grow_lingcao:{
      id:'grow_lingcao',machine:'spirit_field',label:'种灵草',days:4,failChance:0.15,
      inputs:[{skuId:'seed_herb',qty:1},{skuId:'soil_bag',qty:1}],
      output:{skuId:'herb_lingcao',qty:6,qualityRange:[2,4]},
      failOutput:{skuId:'soil_bag',qty:1}
    },
    grow_huoyan:{
      id:'grow_huoyan',machine:'spirit_field',label:'种火炎花',days:5,failChance:0.20,
      inputs:[{skuId:'seed_herb',qty:1},{skuId:'charcoal_bag',qty:1}],
      output:{skuId:'herb_huoyan',qty:3,qualityRange:[3,5]},
      failOutput:{skuId:'soil_bag',qty:1}
    }
  };

  function machineDef(key){return MACHINE_DEFS[key]||null;}
  function recipeDef(id){return RECIPE_DEFS[id]||null;}

  // 一道配方在给定机器等级下的实际失败率：机器越好越稳
  function recipeFailChance(recipe,machineLevel){
    var base=recipe.failChance||0;
    var relief=Math.max(0,(machineLevel||1)-1)*0.04;
    return Math.max(0.02,base-relief);
  }

  function createMachine(machineKey,overrides){
    var def=MACHINE_DEFS[machineKey];
    if(!def)throw new Error('Unknown machine: '+machineKey);
    overrides=overrides||{};
    return {
      id: overrides.id||_uid(),
      machineKey: machineKey,
      name: def.label,
      icon: def.icon,
      w: def.w,
      h: def.h,
      level: overrides.level||1
    };
  }

  /* 开始一项生产：只登记任务，扣料与产出入库由调用方负责
   * （商店侧要用自己的仓库与待领区逻辑）。 */
  function createProductionJob(recipeId,machineId,machineLevel,startedDay){
    var recipe=RECIPE_DEFS[recipeId];
    if(!recipe)return null;
    return {
      id:_uid(),
      recipeId:recipeId,
      machineId:machineId,
      machineLevel:machineLevel||1,
      daysLeft:recipe.days,
      totalDays:recipe.days,
      startedDay:startedDay||1
    };
  }

  // 判定一项完成的生产，返回 {failed, items:[...]}
  function resolveProduction(job){
    var recipe=RECIPE_DEFS[job&&job.recipeId];
    if(!recipe)return {failed:false,items:[]};
    var failed=Math.random()<recipeFailChance(recipe,job.machineLevel);
    var spec=failed?(recipe.failOutput||recipe.output):recipe.output;
    if(!spec)return {failed:failed,items:[]};
    var items=[];
    for(var i=0;i<(spec.qty||1);i++){
      var opts={origin:'craft'};
      if(spec.qualityRange){
        opts.quality=_randInt(spec.qualityRange[0],spec.qualityRange[1]);
      }
      if(spec.purityRange){
        opts.purity=_randInt(spec.purityRange[0],spec.purityRange[1]);
      }
      try{items.push(createItem(spec.skuId,opts));}catch(e){}
    }
    return {failed:failed,items:items};
  }

  // 仓库里有没有足够的料
  function _countInGrid(grid,skuId){
    var n=0;
    Object.keys(grid.items||{}).forEach(function(id){
      var entry=grid.items[id];
      if(entry&&entry.item&&entry.item.skuId===skuId)n++;
    });
    return n;
  }

  function canStartRecipe(state,recipeId){
    var recipe=RECIPE_DEFS[recipeId];
    if(!recipe||!state||!state.grid)return false;
    for(var i=0;i<recipe.inputs.length;i++){
      var need=recipe.inputs[i];
      if(_countInGrid(state.grid,need.skuId)<need.qty)return false;
    }
    return true;
  }

  function advanceDay(state){
    var result={ok:true,day:state.day,expired:[],events:[],warnings:[]};

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
        if(item.agedDays!=null){
          item.agedDays++;
        }
      });
    }

    var market=state.market;
    if(market){
      market.day=state.day;
      var still=[];
      market.pendingShocks.forEach(function(shock){
        market.coefficients[shock.category]=(market.coefficients[shock.category]||1)+shock.delta;
        market.coefficients[shock.category]=Math.max(0.2,Math.min(5,market.coefficients[shock.category]));
        shock.duration--;
        if(shock.duration>0){
          still.push(shock);
        }else{
          market.coefficients[shock.category]=_clamp(market.coefficients[shock.category]-shock.delta,0.5,3);
        }
      });
      market.pendingShocks=still;
      Object.keys(market.stockout).forEach(function(cat){
        if(market.stockout[cat]>0){
          market.stockout[cat]--;
          if(market.stockout[cat]===0){
            result.events.push('「'+categoryName(cat)+'」类物资恢复供应。');
            market.coefficients[cat]=Math.max(0.8,market.coefficients[cat]-0.3);
          }
        }
      });
      if(Math.random()<0.15){
        var cats=Object.keys(market.coefficients);
        var cat=cats[Math.floor(Math.random()*cats.length)];
        var evType=Math.floor(Math.random()*3);
        if(evType===0){
          var dur0=_randInt(3,5);
          market.pendingShocks.push({category:cat,delta:0.5,duration:dur0});
          result.events.push({type:'market',text:'「'+categoryName(cat)+'」类物资出现缺货，价格上涨。',category:cat,coeff:1.5});
        }else if(evType===1){
          var dur1=_randInt(2,3);
          market.pendingShocks.push({category:cat,delta:-0.4,duration:dur1});
          result.events.push({type:'market',text:'「'+categoryName(cat)+'」类物资大量涌入，价格暴跌。',category:cat,coeff:0.6});
        }else{
          var dur2=_randInt(5,7);
          market.stockout[cat]=dur2;
          market.coefficients[cat]=3.0;
          result.events.push({type:'market',text:'「'+categoryName(cat)+'」类物资彻底断供，价格飙升。',category:cat,coeff:3.0});
        }
      }
    }

    if(state.dispatches&&state.dispatches.length>0){
      state.dispatches.forEach(function(dispatch){
        if(dispatch.status==='out'){
          dispatch.daysRemaining--;
          if(dispatch.daysRemaining<=0){
            dispatch.status='returned';
            var loot=_generateDispatchLoot(dispatch.destination);
            if(!state.returnedLoot)state.returnedLoot=[];
            // 标记来源：商店侧要在同一批 returnedLoot 里区分
            // 「派遣带回的」与「订购到货放不下而积压的」，否则空手而归的
            // 回滚会误删订购的货。
            loot.forEach(function(it){it.dispatchId=dispatch.id;it.origin='salvage';state.returnedLoot.push(it);});
            result.events.push('[派遣] '+dispatch.npcName+'从'+dispatch.destination+'返回，带回'+loot.length+'件物资。');
          }
        }
      });
    }

    // 这里曾经也扣一次租金，结果同一周被扣两次（core 判 day%7===0，
    // 而商店在 day++ 之后判 (day-1)%7===0，两个条件在同一次结算里都成立，
    // 实际每周扣 ¤160 而不是设计的 ¤80）。租金的唯一执行放在 shop 的结算里，
    // 那里还有声誉惩罚与拍卖刷新；core 只负责行情与天数。
    if(state.day%7===0){
      result.events.push('集装箱拍卖场次刷新，请关注本周线索。');
    }

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

    if(state.log){
      state.log.push({day:state.day,events:result.events.slice(),warnings:result.warnings.slice()});
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
      var state=JSON.parse(raw);
      if(state&&state.grid&&state.grid.items){
        Object.keys(state.grid.items).forEach(function(id){
          var entry=state.grid.items[id];
          if(entry&&entry.item){
            if(!entry.item.w)entry.item.w=1;
            if(!entry.item.h)entry.item.h=1;
          }
        });
      }
      return state;
    }catch(e){return null;}
  }

  /* ─── 公开 API ──────────────────────────────────────────────────── */
  root.WastelandCore={
    VERSION: VERSION,
    ITEM_CATALOG: ITEM_CATALOG,
    QUALITY_NAMES: QUALITY_NAMES,
    QUALITY_MULT: QUALITY_MULT,
    PURITY_NAMES: PURITY_NAMES,
    PURITY_MULT: PURITY_MULT,
    ORIGIN_NAMES: ORIGIN_NAMES,
    CATEGORY_NAMES: CATEGORY_NAMES,
    categoryName: categoryName,
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
    createDispatch: createDispatch,
    MACHINE_DEFS: MACHINE_DEFS,
    RECIPE_DEFS: RECIPE_DEFS,
    machineDef: machineDef,
    recipeDef: recipeDef,
    recipeFailChance: recipeFailChance,
    createMachine: createMachine,
    createProductionJob: createProductionJob,
    resolveProduction: resolveProduction,
    canStartRecipe: canStartRecipe,
    saveGame: saveGame,
    loadGame: loadGame
  };
})(typeof window!=='undefined'?window:this);
