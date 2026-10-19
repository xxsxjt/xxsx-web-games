/* 资产索引生成器
 *
 * 扫描 assets/ 下已经生成好的图，写成一个普通 <script>：
 *   assets/art-index.js  →  window.WL_ART = { "canned_meat": "assets/items/canned_meat.png", ... }
 *
 * 为什么要这一步，而不是让 UI 直接按约定拼路径：
 *   美术是分批生成的，179 张里任何一张都可能还没跑完。如果 UI 一律
 *   写死 "assets/items/<id>.png"，缺的那张就是破图 + 一串 404。
 *   有了索引，UI 只认「确实在盘上」的图，其余继续用 emoji。
 *
 * 这个文件会被 build.mjs 当作普通静态资源一起哈希发布，不需要额外打包步骤。
 *
 * 用法：node tools/art/index.mjs
 */
import {readdirSync, existsSync, writeFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'assets', 'art-index.js');

// kind → [目录, 文件名到键名的转换]
const SOURCES = [
  // 物品：文件名就是 SKU id
  {dir: 'assets/items', key: name => name.replace(/\.png$/i, '')},
  // 机器：<machineKey>.png → machine_<key>
  {dir: 'assets/machines', key: name => 'machine_' + name.replace(/\.png$/i, '')},
  // 设施：<key>.png → facility_<key>
  {dir: 'assets/facilities', key: name => 'facility_' + name.replace(/\.png$/i, '')},
  // 立绘：<role>.png → npc_<role>
  {dir: 'assets/portraits', key: name => 'npc_' + name.replace(/\.png$/i, '')},
  // 世界背景：<worldId>.png → world_<worldId>
  {dir: 'assets/worlds', key: name => 'world_' + name.replace(/\.png$/i, '')},
  // UI 部件：<name>.png → ui_<name>
  {dir: 'assets/ui', key: name => 'ui_' + name.replace(/\.png$/i, '').replace(/-/g, '_')},
];

const art = {};
const counts = {};

for (const src of SOURCES) {
  const abs = join(ROOT, src.dir);
  if (!existsSync(abs)) { counts[src.dir] = 0; continue; }
  let n = 0;
  for (const name of readdirSync(abs)) {
    if (!/\.png$/i.test(name)) continue;
    const file = join(abs, name);
    if (statSync(file).size < 1024) continue;   // 生成失败留下的空壳不算数
    const key = src.key(name);
    art[key] = relative(ROOT, file).split(sep).join('/');
    n++;
  }
  counts[src.dir] = n;
}

writeFileSync(OUT,
  '/* 自动生成，不要手改。来源：tools/art/index.mjs */\n' +
  'window.WL_ART=' + JSON.stringify(art, null, 0) + ';\n',
  'utf8');

console.log('index ->', relative(ROOT, OUT));
console.log('counts:', JSON.stringify(counts), 'total', Object.keys(art).length);
