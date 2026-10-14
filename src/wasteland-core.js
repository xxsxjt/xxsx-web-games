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
  function createMarketState(){
    return {
      day: 0,
      coefficients:{
        water:       1.0,
        alcohol:     1.0,
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
      skus:['water_distilled_500','canned_meat','iron_ingot_5kg','circuit_board','antibiotic','surgical_kit','first_aid_kit','voltage_meter','radio_module','fuel_jerrycan_5l','geiger','antidote','ammo_9mm','stolen_goods','recipe_card','map_fragment'],
      count:[2,5],qualityRange:[2,5]
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
            result.events.push('「'+cat+'」类物资恢复供应。');
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
          result.events.push({type:'market',text:'「'+cat+'」类物资出现缺货，价格上涨。',category:cat,coeff:1.5});
        }else if(evType===1){
          var dur1=_randInt(2,3);
          market.pendingShocks.push({category:cat,delta:-0.4,duration:dur1});
          result.events.push({type:'market',text:'「'+cat+'」类物资大量涌入，价格暴跌。',category:cat,coeff:0.6});
        }else{
          var dur2=_randInt(5,7);
          market.stockout[cat]=dur2;
          market.coefficients[cat]=3.0;
          result.events.push({type:'market',text:'「'+cat+'」类物资彻底断供，价格飙升。',category:cat,coeff:3.0});
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
            loot.forEach(function(it){state.returnedLoot.push(it);});
            result.events.push('[派遣] '+dispatch.npcName+'从'+dispatch.destination+'返回，带回'+loot.length+'件物资。');
          }
        }
      });
    }

    var player=state.player;
    if(player){
      player.hunger=(player.hunger||0)+1;
      player.thirst=(player.thirst||0)+1;
      if(player.thirst>=3)result.warnings.push('玩家缺水，健康下降风险提升。');
      if(player.hunger>=3)result.warnings.push('玩家缺食物，健康下降风险提升。');
      if(player.thirst>=4||player.hunger>=4){
        player.health=Math.max(0,(player.health||100)-10);
        result.events.push('因长期缺乏补给，健康值下降至 '+player.health+'。');
      }
    }

    if(state.day%7===0){
      var rent=state.rent||0;
      if(rent>0&&player){
        player.funds=(player.funds||0)-rent;
        result.events.push('周租金结算：-'+rent+'。当前资金 '+player.funds+'。');
        if(player.funds<0)result.warnings.push('资金不足，负债经营！');
      }
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
    saveGame: saveGame,
    loadGame: loadGame
  };
})(typeof window!=='undefined'?window:this);
