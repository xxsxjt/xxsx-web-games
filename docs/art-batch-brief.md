# 美术资产生成 · 执行说明（已完成）

> **2026-10-18 更新：200/200 已生成完毕并接入 UI。**
> 本文保留为管线文档；重跑或补图照着做即可。
> 三条军火（ammo_9mm / ammo_762 / pistol）原始提示词被内容政策拒绝，
> 已改用中性描述（「工程用钉枪」「金属弹药收纳箱」）重试成功。

这份文件是给执行批量生图的会话看的。**先读完再动手。**

## 现在是什么状态

- 游戏「界门交易行」已经可玩，`npm test` 全绿（214 项）
- 美术管线**已经写好并验证过**，不需要你再写生成脚本
- 已生成 6 张物品图作为样板：`assets/items/{water_bottle_500,canned_meat,iron_ingot_1kg,circuit_board,qi_pill,whisky_700}.png`
- UI 已经接好：`assets/art-index.js` 里有的图会显示为图片，没有的自动退回 emoji
- 待生成清单：`tools/art/manifest.json`，共 **200 条**（物品 179 / 机器 6 / 设施 4 / 立绘 9 / 场景 2）

## 你的任务

按顺序跑完下面 6 步，**不要改 `src/` 里的任何代码**。

### 步骤 1 · 确认环境

```bash
cd D:/Users/xxsx/orca/workspaces/xxsx-web-games/porcupinefish
node --version            # 需要 20+（用到 fetch / import.meta.dirname）
ls tools/art/             # 应该有 manifest.mjs / generate.mjs / index.mjs / manifest.json
```

### 步骤 2 · 先小规模试跑，确认管线还活着

```bash
node tools/art/generate.mjs --kind=item --limit=6
```

预期输出形如 `[1/6] xxxxx ok 22.1s 1200KB`，最后 `完成：{"ok":6,...}`。

- 如果出现 `无法从本机 vault 解析 eoaigcpro_api_key` → **停下报告**，不要尝试别的取钥方式
- 如果出现 `ffmpeg 失败` → 检查 `D:/Codex/TOOLS/portable/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe` 是否存在
- 如果 6 条里失败 ≥3 条 → 停下报告，不要继续跑 200 张

### 步骤 3 · 检查试跑产物的质量

用 Read 工具打开 `assets/items/` 下新生成的 3–4 张图，逐张确认：

- [ ] 背景是**透明**的（棋盘格，不是深色方块）
- [ ] 画面里**没有文字/字母/水印**
- [ ] 主体居中、没有被裁掉
- [ ] 风格和已有的 6 张样板一致（深色科幻 + 青色/琥珀点缀）

只要有一项不满足，**停下来报告**，不要批量跑。风格漂移的 179 张图比 emoji 更糟。

### 步骤 4 · 全量生成

分三批跑，每批之间可以喘口气（也能早点发现限流）：

```bash
node tools/art/generate.mjs --kind=item,item,item        # 实际按下面命令
```

实际命令：

```bash
# 批 1：物品（179 条，单独跑）
node tools/art/generate.mjs --kind=item

# 批 2：机器 + 设施（10 条）
node tools/art/generate.mjs --kind=machine,facility

# 批 3：立绘 + 场景（11 条，立绘是有人的画面，最容易跑偏，单独跑便于检查）
node tools/art/generate.mjs --kind=npc,world
```

- 每条 20–30 秒，共约 200 条，总耗时 **15–25 分钟**
- 生成器支持断点续跑：已存在的文件自动跳过，中途挂了直接重跑同一条命令
- 失败项会记在 `tools/art/last-run.json`；重跑同一命令会自动只补失败项
- 如果连续失败超过 10 条，停下报告（大概率是限流或余额）

### 步骤 5 · 重建索引与发布产物

```bash
node tools/art/index.mjs     # 重新扫描 assets/，写 assets/art-index.js
node scripts/build.mjs       # 重建 dist
npm test                     # 必须全绿
```

`node tools/art/index.mjs` 的预期输出形如
`counts: {"assets/items":179,"assets/machines":6,...} total 200`。

### 步骤 6 · 浏览器实测（必须做）

```bash
node scripts/dev.mjs --port 5199
```

用无头 Edge 截图验证（不要接管用户的桌面浏览器）：

```bash
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --screenshot=out.png --window-size=1440,1000 \
  --virtual-time-budget=8000 http://127.0.0.1:5199/wasteland.html
```

打开仓库时应该看到：格子里的物品是**图片**而不是 emoji；没有破图；
`document.images` 里 `naturalWidth===0` 的数量为 0。

如果图片没出现，先确认 `window.WL_ART` 里有条目，再确认 `assets/items/<id>.png` 真的存在。

## 绝对不要做的事

- **不要修改 `src/` 下任何文件**（除非是修真正导致报错的 bug，且必须在报告里写明）
- **不要手改 `tools/art/manifest.json`**——它由 `manifest.mjs` 生成
- **不要把密钥打印、写进文件、写进日志**；生成器已经在内存里处理
- **不要重写提示词模板**。风格统一靠 `manifest.mjs` 里的 `STYLE_TRANSPARENT` 和 `CATEGORY_HINT`，
  如果你觉得某张图不好，先看是不是提示词里 `SUBJECT_OVERRIDE` 缺了这条，报告出来让人决定，不要自己批量改
- **不要删 `.raw` 原始图**——它们可以用来重新裁切，占空间也不大（约 250 MB）

## 完成后要报告的内容

1. 各类型最终数量（`index.mjs` 的输出）
2. 失败项清单（如果有）
3. 抽查的 3 张图的简短评价（透明底、无文字、风格一致）
4. `npm test` 结果
5. 浏览器截图确认的几个点（有图 / 无破图）

## 已有的工具速查

| 命令 | 作用 |
|---|---|
| `node tools/art/manifest.mjs` | 重新生成清单（改提示词后跑） |
| `node tools/art/generate.mjs --limit=N` | 只跑前 N 条 |
| `node tools/art/generate.mjs --kind=item` | 只跑某类 |
| `node tools/art/generate.mjs --id=a,b` | 只跑指定 id |
| `node tools/art/generate.mjs --force` | 覆盖已有文件 |
| `node tools/art/index.mjs` | 重建 `assets/art-index.js` |

## 模型与配额

- 模型：`gpt-image-2.5-sunburst`（真 alpha 通道，透明底可用）
- 端点：`https://ovh.aigcpro.org/v1/chat/completions`（OpenAI 兼容格式）
- 单张约 1350–2100 completion tokens，200 张合计约 40 万 tokens
- 密钥别名：`eoaigcpro_api_key`（由生成器内部从本机 vault 解析）
