/* 美术资产批量生成器
 *
 * 读 tools/art/manifest.json，逐条调用 AIGCPro 的 OpenAI 兼容接口出图，
 * 后处理成游戏可直接用的尺寸，写到 assets/ 下。
 *
 * 设计要点：
 *   - 断点续跑：目标文件已存在且能读出 PNG 头就跳过，200 张不会因为中途断网全废
 *   - 并发 3：实测单张 20–25 秒，并发 3 是最稳的速度/限流平衡点
 *   - 密钥只在内存里：从本机 vault 解析，从不写盘、不进日志
 *   - 失败重试 2 次，仍失败就记进 failures.json 继续往下跑
 *
 * 用法：
 *   node tools/art/generate.mjs                 全部
 *   node tools/art/generate.mjs --kind=item     只做某一类
 *   node tools/art/generate.mjs --limit=6       只做前 6 条（冒烟测试）
 *   node tools/art/generate.mjs --id=canned_meat,qi_pill
 *   node tools/art/generate.mjs --force         覆盖已存在的文件
 */
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, existsSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const MANIFEST = join(ROOT, 'tools', 'art', 'manifest.json');
const REPORT = join(ROOT, 'tools', 'art', 'last-run.json');
const VAULT_RUNTIME = 'D:/Users/xxsx/AppData/Local/RuntimeData/tools/vault-runtime.cjs';
const VAULT_ALIAS = 'eoaigcpro_api_key';
const ENDPOINT = 'https://ovh.aigcpro.org/v1/chat/completions';

// ffmpeg 的可执行文件必须指向真 exe —— D:/Codex/TOOLS/bin/ffmpeg.cmd 那个
// 批处理垫片在 node 的 execFile 下会 EINVAL，踩过一次。
const FFMPEG = 'D:/Codex/TOOLS/portable/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';

const CONCURRENCY = Number(argOf('concurrency')) || 3;
const RETRIES = 2;

function argOf(name) {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
}
const FLAG = name => process.argv.includes('--' + name);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadKey() {
  const r = spawnSync(process.execPath, [VAULT_RUNTIME, 'resolve', VAULT_ALIAS], {encoding: 'utf8'});
  const key = (r.stdout || '').trim();
  if (!key) throw new Error('无法从本机 vault 解析 ' + VAULT_ALIAS);
  return key;
}

// ── 调一次接口，拿回 PNG 字节 ───────────────────────────────────
async function requestImage(key, entry) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key},
    body: JSON.stringify({
      model: 'gpt-image-2.5-sunburst',
      messages: [{role: 'user', content: entry.prompt}],
      stream: false,
    }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('响应不是 JSON（HTTP ' + res.status + '）：' + text.slice(0, 120));
  }
  if (!res.ok) throw new Error('HTTP ' + res.status + '：' + JSON.stringify(json).slice(0, 200));
  const content = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content : '';
  const raw = typeof content === 'string' ? content : JSON.stringify(content);
  const m = /data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)/.exec(raw);
  if (!m) throw new Error('响应里没有图片数据：' + raw.slice(0, 160));
  return {data: Buffer.from(m[2], 'base64'), mime: m[1], usage: json.usage || null};
}

// ── 原始图 → 游戏资产 ───────────────────────────────────────────
// transparent: 等比缩到 size，用透明 padding 补成正方形（避免竖构图浪费格子）
// 不透明场景：等比缩放到短边覆盖 size，再居中裁剪成方图
function postProcess(rawFile, entry) {
  mkdirSync(dirname(entry.output), {recursive: true});
  const size = entry.size || 256;
  const vf = entry.transparent
    ? `scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
      `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`
    : `scale=${size}:${size}:force_original_aspect_ratio=increase,` +
      `crop=${size}:${size}`;
  const args = ['-y', '-loglevel', 'error', '-i', rawFile, '-vf', vf, '-frames:v', '1',
    '-pix_fmt', entry.transparent ? 'rgba' : 'rgb24', entry.output];
  const r = spawnSync(FFMPEG, args, {encoding: 'utf8'});
  if (r.status !== 0) throw new Error('ffmpeg 失败：' + (r.stderr || '').slice(0, 200));
}

function isUsable(file) {
  if (!existsSync(file)) return false;
  try {
    if (statSync(file).size < 1024) return false;
    const b = readFileSync(file);
    if (b.slice(1, 4).toString() === 'PNG') return b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0;
    return b.length > 1024;
  } catch (e) { return false; }
}

// ── 单条处理（含重试） ──────────────────────────────────────────
async function runOne(key, entry, index, total) {
  const label = `[${index + 1}/${total}] ${entry.id}`;
  if (!FLAG('force') && isUsable(join(ROOT, entry.output))) {
    console.log(label + ' 跳过（已存在）');
    return {id: entry.id, status: 'skipped'};
  }
  const t0 = Date.now();
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const {data, mime, usage} = await requestImage(key, entry);
      const ext = mime.includes('png') ? 'png' : 'png'; // 接口实际都给 PNG
      const rawFile = join(ROOT, 'tools', 'art', '.raw', entry.id + '.' + ext);
      mkdirSync(dirname(rawFile), {recursive: true});
      writeFileSync(rawFile, data);
      postProcess(rawFile, entry);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(label + ' ok ' + secs + 's ' + Math.round(data.length / 1024) + 'KB');
      return {id: entry.id, status: 'ok', secs: Number(secs), bytes: data.length, usage};
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES) {
        console.log(label + ' 失败（' + e.message.slice(0, 80) + '），' + (attempt + 1) + '/' + RETRIES + ' 次重试');
        await sleep(2000 * (attempt + 1));
      }
    }
  }
  console.log(label + ' 放弃：' + (lastErr && lastErr.message ? lastErr.message.slice(0, 160) : '未知'));
  return {id: entry.id, status: 'failed', error: lastErr ? String(lastErr.message).slice(0, 300) : 'unknown'};
}

// ── 主流程：固定并发池 ──────────────────────────────────────────
async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let entries = manifest.entries;

  const kinds = (argOf('kind') || '').split(',').filter(Boolean);
  if (kinds.length) entries = entries.filter(e => kinds.includes(e.kind));

  const ids = (argOf('id') || '').split(',').filter(Boolean);
  if (ids.length) entries = entries.filter(e => ids.includes(e.id));

  const limit = Number(argOf('limit')) || 0;
  if (limit > 0) entries = entries.slice(0, limit);

  if (!entries.length) {
    console.log('没有匹配的条目');
    return;
  }

  const key = loadKey();
  console.log('开始：' + entries.length + ' 条，并发 ' + CONCURRENCY +
    (FLAG('force') ? '，强制覆盖' : '，已存在的跳过'));

  const results = new Array(entries.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= entries.length) return;
      results[i] = await runOne(key, entries[i], i, entries.length);
    }
  }
  await Promise.all(Array.from({length: Math.min(CONCURRENCY, entries.length)}, worker));

  const tally = {ok: 0, skipped: 0, failed: 0};
  for (const r of results) if (r) tally[r.status] = (tally[r.status] || 0) + 1;
  const failures = results.filter(r => r && r.status === 'failed');

  writeFileSync(REPORT, JSON.stringify({
    finishedAt: new Date().toISOString(),
    tally, failures, results,
  }, null, 2) + '\n');

  console.log('完成：' + JSON.stringify(tally));
  if (failures.length) {
    console.log('失败清单见 tools/art/last-run.json；重跑同一条命令会自动只补失败项。');
    failures.slice(0, 10).forEach(f => console.log('  - ' + f.id + '：' + f.error));
  }
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(e => {
  console.error('生成器崩了：' + e.message);
  process.exitCode = 1;
});
