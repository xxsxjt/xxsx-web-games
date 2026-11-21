# 2026-11-21 集成与阶段同步工作单

## 范围与边界

- 集成负责人：本 Orca dispatch；主控只沟通和监督。本工作单记录源码集成、验证、提交与远端回读，不把计划当作完成证据。
- 工作树：`D:/Users/xxsx/orca/xxsx-web-games`；开始时 `main=12d29f3`，上轮已 `fetch origin main`，无强推、reset、清理他人文件或修改受限来源。
- 当前集成基线：桌面阶段24已独立同步，本地 `HEAD` / `origin/main` 均为 `78b63120e32f7746a08d92af5bdc0a2be6ab5f6f`；网页最终集成仍未提交，不重跑无变化桌面 QA、不扩展阶段25。
- 网页项目修改后须 `npm run build` 再 `npm test`；`dist/` 是跟踪发布产物。源码同步、站点部署、浏览器试玩分开报告；本任务未授权站点部署、浏览器/GUI自动化、截图或图形游戏客户端。
- 桌面项目只允许 Godot 4.3 headless/CLI、工具脚本和 PCK-only 探针。`desktop/stormline-black-tide/` 是公开仓库源码镜像，不参与网页 `npm` 构建。
- 共享工作树中文件所有权优先；未冻结的他人工作留在原处。本工作单、根级集成文档和版本/目录/构建/桌面镜像等仅在集成者拥有范围内修改。

## 阶段与门槛

1. **审查上轮旧作切片**：逐读补给站状态反馈、卡牌回合回执、塔防护盾优先、V59历史哈希清单和dev-preview缓存版本测试；运行独立定向 Node/VM 测试及相关旧回归。发现共享旧切片需修复时先请主控转交所有权。
2. **冻结与隔离验证**：全仓构建前请求所有并行工作者冻结并提交清单；确认 `scripts/build.mjs` 对 `src/` 的递归收集不会把半成品纳入产物。若尚有文件未冻结，仅在单独隔离副本验证，绝不移动/删除共享文件或用原树构建。
3. **稳定旧切片阶段提交**：仅在测试通过且冻结边界明确时，按文件清单 `git add` 旧切片源码、测试、文档、历史清单和验证器修改；先核验远端并保留历史，再正常提交/推送，远端回读分支、树与逐文件 Git blob。
4. **收集新作与桌面交接**：取得余烬、打捞、边境战术、黑盒和桌面开发源冻结/测试证据；只在集成者负责的根入口、索引、测试、文档和镜像路径接线。版本按实际交付范围确定（候选 V60），不提前发布未冻结模块。
5. **桌面阶段24核验**：对当前阶段冻结源码运行既有完整 Godot headless QA及构建工具、必要 Windows PCK 资源探针；逐文件比较开发源纳入清单与公开镜像，排除缓存/构建物/玩家档案。任何未实际运行的人工桌面试玩或二进制发行都明确标未执行。
6. **最终冻结构建与同步**：在所有交接稳定后先 `npm run build` 再 `npm test`，另跑必要定向回归；桌面阶段24已独立验证，不重复无变化 QA。检查 `git diff --check`、存档/入口兼容和发布物内容；正常提交推送并回读远端 main 与文件树，逐文件 Git blob 核验。

## 当前进度

- [x] 读取全局、项目与桌面 AGENTS，工作区索引、用户协作偏好、会话互通标准及简报；识别共享工作树与独占区。
- [x] 记录构建器会递归收集全部 `src/*.js|css`，未冻结源码会被常规构建收录；余烬现已冻结，但打捞重做仍未冻结，继续不在共享树运行发布构建。
- [x] 上轮旧切片源码审查与定向回归：`node tests/station-feedback.cjs`、`node tests/echo-receipt.cjs`、`node tests/relay-shield.cjs`、`node tests/freefield.cjs`、`node tests/campaign-games.cjs`、`node tests/dev-preview.cjs` 均退出 0；历史清单 93 项逐项与当前 `dist/` SHA-256 一致。
- [x] 在隔离副本中以当前旧切片文件清单重建并运行 `npm run build`、`npm test` 及三项定向测试，均退出 0；隔离构建未写共享 `dist/`。隔离副本相对起始 `dist/` 只产生预期的 `play.html`、`release-manifest.json` 和四个已修改旧切片资源哈希变化，无文件删除。
- [x] 边境与黑盒会话已冻结：边境 `src/border.js`、`tests/border-hardening.cjs`、`docs/border-hardening.md`；黑盒 `src/blackbox.js`、`src/circuit-campaign.js`、`tests/circuit-hardening.cjs`、`docs/circuit-hardening.md`。主控已转交原14+旅程7+黑盒新增9组的退出结果；我已复跑 `node tests/circuit.cjs` 与 `node tests/circuit-hardening.cjs`，均退出 0。
- [x] 新作接线、V60 文档、索引与新回归；十作目录保留原九作，完整测试链 24 条，待最终共享树验证。
- [x] 桌面阶段24独立源码镜像、开发源/镜像完整无窗口 QA 与 PCK-only 包探针；22 份桌面文件实现提交和 2 份同步记录文档均已推送，远端树与 78 份项目正文逐项核验，详见下节。未运行网页最终构建或发布桌面二进制。
- [ ] 最终构建、全套测试、提交推送及远端逐文件核验。

## 当前交接

- 当前主控已切换为本轮新会话 `2953b73d-c497-4d79-bd1a-d871144147c4`；后续集成报告发送到当前 Run，不恢复旧会话。
- 五实施线全部正式冻结成功：桌面阶段24已独立镜像/同步；余烬六文件和打捞最终三文件已独立核对当前字节并复跑定向测试；边境/黑盒此前已完成冻结和隔离验证。
- 当前共享树进入正式 V60 build/test 与产物验证；只修改集成所有权内的目录、测试、版本文档和构建产物，不覆盖任何冻结独占源码。打捞旧中间哈希仍全部作废。

## 稳定旧切片阶段同步清单

本阶段只提交不依赖余烬的既有切片与发布器兼容补丁，明确排除边境、黑盒、电路、打捞、余烬和桌面改动：

- 源码：`src/echo-deck.js`、`src/freefield.js`、`src/game.js`、`src/relay-defense.js`。
- 测试与说明：`tests/dev-preview.cjs`、`tests/station-feedback.cjs`、`tests/echo-receipt.cjs`、`tests/relay-shield.cjs`、`docs/neon-station-feedback.md`、`docs/echo-turn-receipt.md`、`docs/relay-shield-priority.md`。
- 发布器与产物：`scripts/published-assets.json`、`dist/play.html`、`dist/release-manifest.json`、`dist/src/game.js`、`dist/static/echo-deck.7cdcab32cd1c.js`、`dist/static/freefield.2747ee8b26cc.js`、`dist/static/game.9e071dab2f0c.js`、`dist/static/relay-defense.dffef6ffe4b2.js`。
- 协作记录：本文件 `docs/integration-run-2026-11-21.md`。

隔离发布构建副本：`C:\Users\xxsx\AppData\Local\Temp\opencode\xxsx-old-slices-publish-542b255f5b88466e847b7b72b809a53e`。该副本中 `npm run build`、`npm test`、四项旧切片定向测试均退出 0；本阶段不把该隔离结果表述为共享树最终构建通过。

本阶段提交 `69497ce5c44e2d706bc704357e2338d605fa5e76`（20 个显式文件）已正常推送；`git fetch origin main`、`git ls-remote origin refs/heads/main` 均读到该 SHA。远端 main 树核对本清单 20/20 文件 Git blob 与本地一致。推送后工作树中仍保留未提交的边境、黑盒、电路、打捞、余烬独占改动；未部署 Sites、未做浏览器试玩。

## 证据登记

命令、退出码、提交 SHA、远端 `refs/heads/main`、内容核验与未执行边界随阶段追加；任何未实测项保持“未执行/未验证”，不据计划或旧摘要推断通过。

## 已冻结回归接入准备（尚未最终集成）

- 以 `aeb1b9032e1ca75fcb90bae70850a8e61895a537` 为当前基线；仅修改集成所有权内的 `package.json` 与本工作单，未修改任何冻结/未冻结玩法源码，也未改 `releaseVersion: V59`。
- `npm test` 命令增加 `tests/station-feedback.cjs`、`tests/echo-receipt.cjs`、`tests/relay-shield.cjs`、`tests/border-hardening.cjs` 和 `tests/circuit-hardening.cjs`，保留原全部测试。打捞、余烬回归等待正式冻结后接入。
- 直接执行 `border`、`border-journey`、`border-hardening`、`circuit`、`circuit-hardening`、`station-feedback`、`freefield`、`campaign-games`、`echo-receipt`、`relay-shield`、`dev-preview` 共 11 套 Node 定向回归，全部退出 0；边境、黑盒和电路源码的 3 项 `node --check` 也全部退出 0。
- 定向结果和冻结输入 SHA-256 位于 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-frozen-regressions-txHfLG/evidence.json`，同目录保留逐命令日志；7 份边境/黑盒冻结文件与 `package.json` 在该次测试前后字节哈希一致。
- 初次验证脚本在执行测试前因当前 PowerShell 无 `Get-FileHash` 而退出 1，未产生验证结果或改写源码；改用 Node `crypto` 后完成上述验证。
- 本轮未运行共享树 `npm run build` / `npm test`，未更新共享 `dist/`，未镜像桌面、部署 Sites 或执行 GUI/浏览器试玩。后续隔离验证必须继续排除未冻结的打捞、余烬和桌面内容，不能代替最终共享树结果。

### 已冻结边境/黑盒的隔离整合验证

- 隔离目录：`C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-frozen-integration-HQ7D9Q`，由上述基线 `git archive` 解包后，仅覆盖 `package.json`、边境/黑盒的 7 份已冻结源码/测试/文档和本工作单。未复制共享树未冻结的打捞、余烬或桌面改动；打捞与桌面抽查文件仍逐字节等于基线，余烬 4 份源码/入口/测试均不存在于副本。
- 在该副本依次运行 `npm run build`、`npm run test`，均退出 0；后者执行全部 22 条测试命令（含此次新增的 5 套回归）。边境 110 动作自然旅程、21 项 hardening、黑盒新增 9 组、双模式 loader、发布器失败保护与静态校验均通过。冻结输入与配置的测试后 SHA-256 未变化。
- 隔离构建中边境、黑盒和电路的源码哈希/产物哈希均匹配 manifest；打捞资源仍是已提交基线 `static/salvage-expedition.997fc1ce8acc.js`，未收录任何 `ember-convoy` 资源。
- 历史发布资源 93/93 项在共享 `dist/` 和隔离 `dist/` 均逐字节 SHA-256 匹配固定清单；共享 `git status --porcelain --untracked-files=all -- dist` 无输出，未回写任何隔离产物。
- 证据：隔离目录内 `isolation-inputs.json`、`validation-evidence.json`、`artifact-verification.json`、`npm-build.log` 与 `npm-test.log`。此结果仅证明已冻结子集可整合；打捞、余烬、桌面正式冻结及最终共享树构建/回归/同步仍未完成。
- 后续主控通知：打捞会话的命令行编辑曾损坏 UTF-8，原源码增量已由所有者按 Git blob 原始字节恢复，正在重新实现与验证；此前打捞源码哈希作废，不接收为冻结证据。最终须收取当前字节读回、编码/限定 diff，以及 `salvage-hardening`、`salvage-journey`、`campaign-games` 和语法检查的重新执行结果；本集成会话不覆盖该源码。

## 桌面阶段24独立完成（与网页最终集成分开）

- 四份流场反馈冻结文件当前 SHA-256 与主控/所有者交接逐项一致。检查开发源 77 个、镜像 71 个文件，初查 20 份差异包含此前未镜像第三合同数据、入口、sidecar 成绩、测试与说明，未遗漏为仅复制四份反馈文件。集成补充正式回归/PCK 三合同单步工具和阶段文档后，最终 78 个源码/测试/工具/文档、22 份实现差异；未删除或重建镜像目录，排除缓存、构建包、临时日志与玩家档案。
- 最终开发源完整 QA：`build/qa/20261121-030631-337590/summary.json`；镜像完整 QA：`desktop/stormline-black-tide/build/qa/20261121-030850-398499/summary.json`（相对总仓库）。均官方 Godot 4.3、28/28、退出 0、0 诊断，44 项代码/配置指纹前后不变且两侧一致。三合同 route feedback 纳入正式门槛；safe/shortcut 仍 9204/8064 tick，自然旧合同基线未放宽。
- PCK-only 导出退出 0、0 诊断，338128 字节、18 项资源；SHA-256 `de30cfbc487a2f6611f328e69d3fb45d8ee37360f46c930af8bcc2d8cf97725a`。开发源/镜像两次隔离 `smoke_export.py` 均退出 0、0 诊断，7 脚本、入口资源、3 合同 reset/step 通过，未实例化主场景、未写成绩、未生成/运行 EXE、未发布二进制。
- 实现提交 `67a1479c32e6fc9873a130b80698f5c7ea4b8d00`（22 份显式桌面文件）；核验记录提交 `78b63120e32f7746a08d92af5bdc0a2be6ab5f6f`（仅 2 份桌面文档）。均先 fetch、精确检查暂存清单与 diff-check，再正常提交/推送，无强推；网页准备改动未暂存。
- 最终 `ls-remote`/`fetch`/GitHub API 回读 `main=78b63120e32f7746a08d92af5bdc0a2be6ab5f6f`，树 `473d32c675c813c0adcc9887cee2909f9ca30780`，全仓 441 blob 路径/SHA 一致，桌面 78/78 份远端正文重新计算 Git blob 与提交/API树/本地过滤后内容一致，开发源与镜像原始字节 78/78 一致。根 `LICENSE` 和 `THIRD_PARTY_NOTICES.md` 哈希未变，桌面与共享 `dist/` Git 状态干净，暂存区为空。
- 详证：开发源 `docs/stage-24-cross-current.md`；本机 `D:/AGENT/WORKSPACES/Projects/stormline-black-tide/build/sync/stage-24-final.json`、`stage-24-source-mirror.json` 及阶段文档引用的总 QA/资源探针日志。网页仍 V59；未执行共享网页 build/test、GUI/截图/真人试玩、Sites 部署或 EXE/ZIP 候选。
- 根工作单和 `package.json` 的网页集成准备改动继续保留未提交；打捞与余烬正式冻结后再进行网页最终接线/构建/回归，不把桌面同步当作网页最终通过。

## 余烬冻结核验与 V60 接线准备

- 主控及所有者正式冻结六文件：`src/ember-convoy.js`、`src/ember-convoy.css`、`games/ember-convoy.html`、`assets/icons/ember-convoy.svg`、`tests/ember-convoy.cjs`、`docs/ember-convoy-design.md`。集成者未修改六文件；当前 SHA-256 **6/6 等于主控交接值**，测试前后不变，严格 UTF-8、无 BOM/替换字符、LF/无尾空格、SVG XML 均通过。
- 独立复跑 `node tests/ember-convoy.cjs` 和两个源码/测试 `node --check`，均退出 0。证据 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-ember-20261121-032129-569034/ember-freeze.json`；256 种子只作状态/编码覆盖，不冒称全部通关或浏览器试玩。
- 仅在集成所有权内修改 `content/games.json`、`package.json`、`tests/hub.cjs`、`tests/static-validation.cjs`、`tests/dev-preview.cjs`、根 README/版本记录/本工作单；新增第十款 `ember-convoy`，原九作完整条目/顺序保留，使用专用独立页，不改旧 loader 或共享存档。
- 源码 `releaseVersion` 准备为 `V60`，`npm test` 保留全部 22 条既有命令并加入余烬，当前共 23 条。共享 `dist/` 尚未构建，仍保留已提交 V59。README 明确区分源码目录、构建、同步和站点部署；版本记录为 `docs/release-v60.md`，不提前声称最终通过。
- `node tests/hub.cjs` 退出 0：真实十作目录渲染、新作搜索/收藏/最近打开/重载、原九入口/收藏及其他游戏存档字节保护通过；三个修改后的共享测试脚本语法检查和限定 `git diff --check` 退出 0。
- 仍等待打捞重做后当前字节正式冻结。未执行共享树 build/npm test、未改共享 `dist/`、未暂存提交、未重跑桌面 QA、未部署 Sites/执行 GUI 或发布二进制。

## 全部源码冻结，开始最终共享树验证

- 收到打捞所有者与主控正式冻结，最终 3 个 Git blob 分别为 `bab909425273de901a57faa2be758f43f786da17`、`6c82b221d7cf72a8236fc1c30107bb40f0a81337`、`9684031c862e4befd2a390175953132fe0798fe5`，对应源码、hardening 测试和文档；当前原始字节 3/3 匹配，严格 UTF-8/LF、无 BOM/替换字符/尾空格及限定 diff-check 通过。
- 集成独立复跑 `salvage-hardening` 11 项/6,048 对照、`salvage-journey` 5 项、`campaign-games` 21 项与两个语法检查，均 exit 0；测试前后字节不变。证据 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-final-20261121-033155-580765/salvage-freeze.json`。
- 将打捞 hardening 接入完整测试链，当前 24 条；保留原 17 条顺序及本轮其他 7 套回归。已更新根 AGENTS 的 V60 范围、README、release-v60 和本工作单；冻结源码未改写。
- 正式构建前 `git fetch origin main` 后 `HEAD=origin/main=78b63120e32f7746a08d92af5bdc0a2be6ab5f6f`。接下来以当前全部冻结字节执行共享树 build/test，结果与同步证据完成后追加；不把此前隔离通过作为最终结果。

## V60 最终共享树验证通过（待 Git 同步）

- 按冻结门槛在真实共享树依次运行 `npm run build`、`npm test`，**均 exit 0，完整 24 条测试命令全部通过**；运行时间 2026-11-21 11:33:58–11:34:22 UTC。原 17 条顺序保留，源码/产物 loader 均 46/46，HTTP CLI 预览、构建失败保护和静态验证包含在完整链内，未使用 GUI/浏览器。
- 构建为 V60，首页 HTML/CSS/JS/目录 gzip 12,683 字节；51 组源码/产物 SHA-256 与长度、16 份 alias 全部匹配，历史固定资源 93/93 匹配。未删除任何已跟踪产物或既有发布源，新加入余烬四项发布源；原九作目录完整对象和顺序与基线一致。
- 最终命令前后 16 份冻结文件和 39 项构建输入字节未变；hub/loader 源码、许可证、第三方声明、93 项历史清单及桌面镜像未变。没有测试/文档/桌面/Git 目录进入产物。
- 额外在余烬源码与构建 JS 各验证 44 个旧档案键/事务/备份哨兵，所有字节保留且仅访问余烬命名空间，真实动作、重载和旧页冲突拒绝通过；不是访问真实玩家存档。
- 全套证据目录 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-final-20261121-033155-580765/`：`build-test.json`、`npm-build.log`、`npm-test.log`、`artifact-verification.json`、`new-game-storage-isolation.log`、`build-inputs-before.json`、`salvage-freeze.json`。文档更新不改变构建输入；下一步仅在最终编码/diff/暂存范围核验后提交推送并读回远端。
