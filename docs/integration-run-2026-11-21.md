# 2026-11-21 集成与阶段同步工作单

## 范围与边界

- 集成负责人：本 Orca dispatch；主控只沟通和监督。本工作单记录源码集成、验证、提交与远端回读，不把计划当作完成证据。
- 工作树：`D:/Users/xxsx/orca/xxsx-web-games`；开始时 `main=12d29f3`，上轮已 `fetch origin main`，无强推、reset、清理他人文件或修改受限来源。
- 网页项目修改后须 `npm run build` 再 `npm test`；`dist/` 是跟踪发布产物。源码同步、站点部署、浏览器试玩分开报告；本任务未授权站点部署、浏览器/GUI自动化、截图或图形游戏客户端。
- 桌面项目只允许 Godot 4.3 headless/CLI、工具脚本和 PCK-only 探针。`desktop/stormline-black-tide/` 是公开仓库源码镜像，不参与网页 `npm` 构建。
- 共享工作树中文件所有权优先；未冻结的他人工作留在原处。本工作单、根级集成文档和版本/目录/构建/桌面镜像等仅在集成者拥有范围内修改。

## 阶段与门槛

1. **审查上轮旧作切片**：逐读补给站状态反馈、卡牌回合回执、塔防护盾优先、V59历史哈希清单和dev-preview缓存版本测试；运行独立定向 Node/VM 测试及相关旧回归。发现共享旧切片需修复时先请主控转交所有权。
2. **冻结与隔离验证**：全仓构建前请求所有并行工作者冻结并提交清单；确认 `scripts/build.mjs` 对 `src/` 的递归收集不会把半成品纳入产物。若尚有文件未冻结，仅在单独隔离副本验证，绝不移动/删除共享文件或用原树构建。
3. **稳定旧切片阶段提交**：仅在测试通过且冻结边界明确时，按文件清单 `git add` 旧切片源码、测试、文档、历史清单和验证器修改；先核验远端并保留历史，再正常提交/推送，远端回读分支、树与逐文件 Git blob。
4. **收集新作与桌面交接**：取得余烬、打捞、边境战术、黑盒和桌面开发源冻结/测试证据；只在集成者负责的根入口、索引、测试、文档和镜像路径接线。版本按实际交付范围确定（候选 V60），不提前发布未冻结模块。
5. **桌面阶段24核验**：对当前阶段冻结源码运行既有完整 Godot headless QA及构建工具、必要 Windows PCK 资源探针；逐文件比较开发源纳入清单与公开镜像，排除缓存/构建物/玩家档案。任何未实际运行的人工桌面试玩或二进制发行都明确标未执行。
6. **最终冻结构建与同步**：在所有新作/桌面交接稳定后先 `npm run build` 再 `npm test`，另跑各会话定向回归和桌面 headless QA；检查 `git diff --check`、存档/入口兼容和发布物内容。正常提交推送并回读远端 main 与文件树，逐文件 Git blob 核验。

## 当前进度

- [x] 读取全局、项目与桌面 AGENTS，工作区索引、用户协作偏好、会话互通标准及简报；识别共享工作树与独占区。
- [x] 记录构建器会递归收集全部 `src/*.js|css`，因此当前未冻结 `src/ember-convoy.js` 会被常规构建收录；不在共享树运行发布构建。
- [x] 上轮旧切片源码审查与定向回归：`node tests/station-feedback.cjs`、`node tests/echo-receipt.cjs`、`node tests/relay-shield.cjs`、`node tests/freefield.cjs`、`node tests/campaign-games.cjs`、`node tests/dev-preview.cjs` 均退出 0；历史清单 93 项逐项与当前 `dist/` SHA-256 一致。
- [x] 在隔离副本中以当前旧切片文件清单重建并运行 `npm run build`、`npm test` 及三项定向测试，均退出 0；隔离构建未写共享 `dist/`。隔离副本相对起始 `dist/` 只产生预期的 `play.html`、`release-manifest.json` 和四个已修改旧切片资源哈希变化，无文件删除。
- [x] 边境与黑盒会话已冻结：边境 `src/border.js`、`tests/border-hardening.cjs`、`docs/border-hardening.md`；黑盒 `src/blackbox.js`、`src/circuit-campaign.js`、`tests/circuit-hardening.cjs`、`docs/circuit-hardening.md`。主控已转交原14+旅程7+黑盒新增9组的退出结果；我已复跑 `node tests/circuit.cjs` 与 `node tests/circuit-hardening.cjs`，均退出 0。
- [ ] 新作接线、V60（若符合事实）文档、索引与新回归。
- [ ] 桌面阶段24源码镜像、无窗口 QA 与必要包探针。
- [ ] 最终构建、全套测试、提交推送及远端逐文件核验。

## 当前交接

- 当前主控已切换为本轮新会话 `2953b73d-c497-4d79-bd1a-d871144147c4`；后续集成报告发送到当前 Run，不恢复旧会话。
- 打捞、余烬和桌面阶段仍未冻结，故未接线、未把余烬半成品纳入发布、未运行共享树正式构建，也未镜像桌面开发源。
- 当前共享树可见冻结的边境/黑盒改动以及仍在进行中的打捞/余烬/桌面文件；集成前仍需按所有权收取完整清单和真实 QA 证据。

## 稳定旧切片阶段同步清单

本阶段只提交不依赖余烬的既有切片与发布器兼容补丁，明确排除边境、黑盒、电路、打捞、余烬和桌面改动：

- 源码：`src/echo-deck.js`、`src/freefield.js`、`src/game.js`、`src/relay-defense.js`。
- 测试与说明：`tests/dev-preview.cjs`、`tests/station-feedback.cjs`、`tests/echo-receipt.cjs`、`tests/relay-shield.cjs`、`docs/neon-station-feedback.md`、`docs/echo-turn-receipt.md`、`docs/relay-shield-priority.md`。
- 发布器与产物：`scripts/published-assets.json`、`dist/play.html`、`dist/release-manifest.json`、`dist/src/game.js`、`dist/static/echo-deck.7cdcab32cd1c.js`、`dist/static/freefield.2747ee8b26cc.js`、`dist/static/game.9e071dab2f0c.js`、`dist/static/relay-defense.dffef6ffe4b2.js`。
- 协作记录：本文件 `docs/integration-run-2026-11-21.md`。

隔离发布构建副本：`C:\Users\xxsx\AppData\Local\Temp\opencode\xxsx-old-slices-publish-542b255f5b88466e847b7b72b809a53e`。该副本中 `npm run build`、`npm test`、四项旧切片定向测试均退出 0；本阶段不把该隔离结果表述为共享树最终构建通过。

## 证据登记

命令、退出码、提交 SHA、远端 `refs/heads/main`、内容核验与未执行边界随阶段追加；任何未实测项保持“未执行/未验证”，不据计划或旧摘要推断通过。
