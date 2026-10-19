/* 美术资产清单生成器
 *
 * 从 ITEM_CATALOG / MACHINE_DEFS / FACILITY_DEFS / NPC 角色表里机械地生成
 * 一份待生成清单（tools/art/manifest.json）。不手写 179 条提示词——
 * 物品名本身就是提示词主体，这里只补「画什么、什么风格」的公共部分。
 *
 * 用法：node tools/art/manifest.mjs
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import vm from 'node:vm';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'tools', 'art', 'manifest.json');

// ── 在 vm 里装载三个模块，取出真实数据 ──────────────────────────
function loadModules() {
  const sandbox = {
    window: {}, console, Math, Date, JSON, Object, Array, String, Number, Boolean,
    parseInt, parseFloat, isNaN,
    document: {
      getElementById: () => null,
      createElement: () => ({style: {}, appendChild() {}, setAttribute() {}}),
      head: {appendChild() {}},
    },
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['wasteland-core', 'wasteland-npc', 'wasteland-ui', 'wasteland-shop']) {
    vm.runInContext(readFileSync(join(ROOT, 'src', f + '.js'), 'utf8'), sandbox, {filename: f + '.js'});
  }
  return {Core: sandbox.WastelandCore, NPC: sandbox.WastelandNPC};
}

// ── 风格：一条适用于全部资产的主提示词 ──────────────────────────
// 透明底是硬要求：格子背景是深色面板，抠图不干净会露白边。
const STYLE_TRANSPARENT =
  '单个物体，透明背景（alpha 通道，PNG 透明，无背景板、无地面、无地面投影），居中，四周留约 12% 空白，' +
  '四分之三视角，左上方柔光，青色 #79e7ee 与琥珀色 #ffc867 点缀，干净的绘画矢量风格，适配深色科幻交易题材游戏。' +
  '不要任何文字、字母、标签、logo、水印、边框、画框。';

// 按品类补一句材质/年代感，避免「福尔马林质感的药品」这类跑偏
const CATEGORY_HINT = {
  water: '液体容器，可透视瓶身',
  alcohol: '玻璃或陶瓷酒瓶，瓶身有抽象几何酒标',
  tobacco: '纸质或金属烟盒',
  chemical: '工业容器，带危险品气味',
  food: '食品包装，罐头或铝箔',
  material: '工业原材料，金属或矿料质感',
  tech: '电子元件，带发光指示',
  medicine: '医药包装，洁净感',
  equipment: '工具或装备，使用痕迹',
  illegal: '违禁品，低调但贵',
  misc: '杂项小物件',
};

// 少量物体的名字太抽象，补一句具体形态，否则模型会乱猜
const SUBJECT_OVERRIDE = {
  marrow_pill: '一枚温润的金色丹药，悬浮，环绕柔和灵气',
  spirit_stone: '一块菱形半透明灵晶，内部有青色流光',
  beast_core: '一颗暗红发光的妖兽内丹，表面有裂纹',
  qi_pill: '一枚橙色发光丹药，悬浮，带青色灵气',
  spirit_pill: '一枚紫色发光丹药，悬浮，带青色灵气',
  healing_pill: '一枚红色发光丹药，悬浮，带柔和红光',
  toxic_pill: '一枚墨绿丹药，表面有瘴气缠绕',
  waste_pill: '一枚灰黑废丹，表面粗糙开裂',
  formation_disc: '一块圆形青铜阵盘，表面刻有发光符文',
  jade_gourd: '一只翠玉葫芦，半透明，带青色灵光',
  aged: '带年份感的包装',
  fake_id: '一张伪造证件卡片，反光塑料质感',
  black_market_info: '一张折叠的纸质字条',
  recipe_card: '一张手写配方卡',
  map_fragment: '一张撕裂的旧地图碎片',
  stolen_goods: '一个没有标识的普通纸箱，封条破损',
  sprouted_potato: '一颗发芽的土豆',
  empty_bottle: '一个透明的空玻璃瓶',
  empty_can: '一个空的金属罐头盒',
  junk_metal: '一堆散乱的废铁片',
  junk_plastic: '一堆废旧塑料碎片',
  junk_cloth: '一团破旧布条',
  slag: '一块多孔的深色炉渣',
  burnt_board: '一块焦黑的电路板，边缘碳化',
  circuit_board_broken: '一块碎裂的绿色电路板碎片',
};

function subjectOf(skuId, sku) {
  if (SUBJECT_OVERRIDE[skuId]) return SUBJECT_OVERRIDE[skuId];
  const hint = CATEGORY_HINT[sku.category] || '';
  return `「${sku.name}」${hint ? '，' + hint : ''}`;
}

// ── 物品 ───────────────────────────────────────────────────────
function buildItems(Core) {
  const out = [];
  for (const [skuId, sku] of Object.entries(Core.ITEM_CATALOG)) {
    out.push({
      id: skuId,
      kind: 'item',
      name: sku.name,
      category: sku.category,
      output: `assets/items/${skuId}.png`,
      size: 256,
      transparent: true,
      prompt: subjectOf(skuId, sku) + '。' + STYLE_TRANSPARENT,
    });
  }
  return out;
}

// ── 机器 ───────────────────────────────────────────────────────
// 机器本身不是「货物」，用同样的视觉语言但更厚重一点
function buildMachines(Core) {
  const SUBJECT = {
    smelter: '一座小型工业熔炉，铸铁炉膛，炉口透出橙红火光',
    workbench: '一张金属装配工作台，台面散落扳手与零件，台灯照明',
    chem_still: '一套化工蒸馏装置，玻璃管与铜壶，装有绿色液体',
    alchemy_furnace: '一尊东方丹炉，青铜三足，炉身刻云纹，炉口透出丹火',
    talisman_desk: '一张符箓台，铺着黄符纸，朱砂笔与砚台',
    spirit_field: '一块灵田，黑土上生长着发光的灵草',
  };
  const MACHINE_STYLE =
    '设备整体，透明背景（alpha 通道，无地面、无投影），正面略侧视角，左下柔光，' +
    '青色 #79e7ee 与琥珀色 #ffc867 点缀，干净的绘画矢量风格，适配深色科幻交易题材游戏。' +
    '不要任何文字、字母、logo、水印、边框。';
  return Object.values(Core.MACHINE_DEFS).map(def => ({
    id: 'machine_' + def.key,
    kind: 'machine',
    name: def.label,
    output: `assets/machines/${def.key}.png`,
    size: 256,
    transparent: true,
    prompt: (SUBJECT[def.key] || def.label) + '。' + MACHINE_STYLE,
  }));
}

// ── 设施 ───────────────────────────────────────────────────────
function buildFacilities(Core) {
  const SUBJECT = {
    power: '一台工业发电机，带燃料罐与电流指示',
    security: '一套监控与警报装置，红色警示灯',
    water_purifier: '一台净水设备，透明滤芯，清水流出',
    storage: '一排金属货架与堆叠的储物箱',
  };
  return Object.keys(SUBJECT).map(key => ({
    id: 'facility_' + key,
    kind: 'facility',
    name: key,
    output: `assets/facilities/${key}.png`,
    size: 256,
    transparent: true,
    prompt: SUBJECT[key] + '。' + STYLE_TRANSPARENT,
  }));
}

// ── 商旅立绘 ───────────────────────────────────────────────────
// 这里必须是有人的画面，所以不能套「单个物体」那套。半身像、中性表情、
// 没有文字。9 个角色统一用同一段构图描述，保证并排时不违和。
function buildNpcs(NPC) {
  const ROLES = {
    scavenger: ['拾荒者', '穿着补丁拼接的防护外套，背着旧帆布包，脸上有灰尘与划痕，眼神警觉'],
    trader: ['行商', '穿着剪裁利落的长外套，腰间挂着账本与钱袋，神情精明'],
    medic: ['游医', '穿洗得发白的医护外套，挂着听诊器与药包，神情疲惫但温和'],
    contractor: ['工地采购', '戴安全帽，穿工装背心，手臂粗壮，肩扛卷尺'],
    herbalist: ['采药人', '背竹篓，穿粗布衣，手里攥着几株草药，皮肤被晒得黝黑'],
    alchemist: ['游方丹师', '穿青灰色道袍，腰间挂丹葫芦，袖口有药渍，眼神锐利'],
    cultivator: ['散修', '穿素色长衫，腰间佩剑，气质清冷，衣角有灵光'],
    collector: ['藏家', '穿深色锦缎长袍，戴手套，手托一只古旧器物，神情挑剔'],
    informant: ['情报贩子', '穿风衣，压低帽檐，半张脸在阴影里，手里捏着一张字条'],
  };
  const PORTRAIT_STYLE =
    '半身像，正面或四分之三侧脸，中性表情，视线看向镜头，深色纯色背景（#0b1420），' +
    '背后有微弱的青色几何光纹，柔和的轮廓光，干净的绘画矢量风格，适配深色科幻交易题材游戏。' +
    '不要任何文字、字母、logo、水印、边框。';
  return Object.entries(ROLES).map(([role, [label, look]]) => ({
    id: 'npc_' + role,
    kind: 'npc',
    name: label,
    output: `assets/portraits/${role}.png`,
    size: 512,
    transparent: false,
    prompt: `人物立绘：一位${label}，${look}。` + PORTRAIT_STYLE,
  }));
}

// ── 世界背景 ───────────────────────────────────────────────────
function buildWorlds() {
  const SCENES = {
    wasteland_nuclear: [
      '核爆废土',
      '一座搭在锈蚀集装箱之间的露天集市，铁皮棚顶，远处是被核爆扭曲的城市轮廓与灰黄天空，' +
        '地面散落废铁与油桶，摊位上挂着灯泡与旧招牌（不含文字）',
    ],
    xianxia_sect: [
      '灵霄宗门界',
      '一座建在云海之上的宗门坊市，飞檐木构与石阶，远处漂浮的山峰与青色灵光，' +
        '空气中飘着符纸与灯笼，色调偏青紫与暖金',
    ],
    // 以下 8 界为「开发中」——场景图先备好，玩家在界门面板能看到它们长什么样，
    // 之后开世界时不用再等美术。
    wasteland_plague: ['瘟疫荒原', '一座被废弃的隔离集市，破败帐篷与铁皮棚，地面泥泞积水，远处雾中废墟城市，枯树与焚烧痕迹，冷绿灰黄调'],
    wasteland_ai:     ['机械末日', '被失控机械占据的废墟市集，金属骨架与断壁间挂着摊位，远处巨大机械臂与红色传感器，湿润地面反射冷光'],
    xianxia_mortal:   ['凡界集市', '热闹的古代市集，木质摊位与布棚连成长街，灯笼高挂，人流穿行，地上堆着粮袋陶器，暖黄青灰调'],
    steampunk:        ['蒸汽帝国', '蒸汽朋克工业货运站，巨大铜制管道与齿轮交错，蒸汽从阀门喷出，铁架天桥横跨，黄铜深绿调'],
    cybermage:        ['赛博魔法城', '霓虹与符文交织的未来街市，全息广告墙与悬浮摊位，魔法阵与电路纹理重叠，紫粉青蓝反光，雨夜镜面反射'],
    medieval:         ['中世纪王国', '石砌城墙下的集市广场，木制摊位与麻布棚，铁匠铺冒烟，远处教堂尖顶与城堡，暖黄昏调'],
    stellar:          ['星际外站', '悬浮在深空中的轨道货运站，环形结构与观察窗，窗外星云与星环，站内摊位由金属与全息投影构成，冷蓝紫调'],
    ancient_empire:   ['古代帝国集市', '宏伟的古代帝国商道驿站，石柱与拱廊，骆驼商队与麻布帐棚，陶罐与香料堆叠，暖褐金色调'],
  };
  const SCENE_STYLE =
    '宽幅场景插画，无人物或无脸人物，电影感构图，景深，光雾，' +
    '以深蓝 #0b1420 为底、青色 #79e7ee 与琥珀色 #ffc867 为主光，绘画质感。不要任何文字、字母、logo、水印。';
  return Object.entries(SCENES).map(([id, [label, scene]]) => ({
    id: 'world_' + id,
    kind: 'world',
    name: label,
    output: `assets/worlds/${id}.png`,
    size: 1536,
    transparent: false,
    prompt: `场景：「${label}」，${scene}。` + SCENE_STYLE,
  }));
}

// ── 主流程 ─────────────────────────────────────────────────────
const {Core, NPC} = loadModules();
const manifest = {
  generatedAt: new Date().toISOString().slice(0, 10),
  model: 'gpt-image-2.5-sunburst',
  entries: [
    ...buildItems(Core),
    ...buildMachines(Core),
    ...buildFacilities(Core),
    ...buildNpcs(NPC),
    ...buildWorlds(),
  ],
};

mkdirSync(dirname(OUT), {recursive: true});
writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');

const counts = {};
for (const e of manifest.entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
console.log('manifest ->', OUT);
console.log('entries:', manifest.entries.length, JSON.stringify(counts));
