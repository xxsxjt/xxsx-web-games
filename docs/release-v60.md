# V60：余烬航团与既有玩法反馈集成

日期：2026-11-21。**状态：V60 共享树最终构建和 24 条回归命令全部通过，产物/历史资源/存档隔离核验通过；实现已同步 GitHub 并完成全树 465/465 文件正文/blob 回读，未部署 Sites。** `package.json` 与共享 `dist/release-manifest.json` 均为 `V60`。打捞旧中间哈希全部作废，仅使用最后交接三文件的当前字节。

## 本轮范围

- 新增第十款《余烬航团》，独立入口 `games/ember-convoy.html`、目录 ID `ember-convoy`、专用 CSS/JS/SVG。原九款目录条目、入口及顺序不变，不将新作塞入旧 `play-loader` 或共享舰站档案。
- 余烬完整闭环：三段远征，每段二选一航路、公开敌舰意图、一轮两点命令、三舰分工、打捞和前两段改装；第三段清敌后仍须确认撤离。舰船失联不能行动或复活，12 轮封锁是显式失败边界。详见 `ember-convoy-design.md`，不是无限战役或一般性平衡结论。
- 已独立同步的旧切片：补给站状态反馈、卡牌实际回执、塔防护盾优先及相关回归；该阶段提交 `69497ce5c44e2d706bc704357e2338d605fa5e76` 与核验记录 `aeb1b9032e1ca75fcb90bae70850a8e61895a537`。本次将这些回归接入完整测试链，重新完成共享树 V60 验证，而非沿用旧隔离结果。
- 已冻结的边境反馈：共用只读行动检查、准确拒绝原因、目标取消、推击/技能结果及撤离/冲突提示；保持 ruleset 2、新旧档案分流与原自然旅程。详见 `border-hardening.md`。
- 已冻结的黑盒/电路反馈：十八关战役增加免费只读端口诊断，不读取隐藏解法、不消耗提示、不改变通关或星级规则；旧七层随机挑战只增加模型诊断 API，没有新增旧 UI 面板。详见 `circuit-hardening.md`。
- 已冻结的打捞反馈：逐格可见移动风险、路线失联格及目标后续动作、准确装载缺额和守卫工具提示，复用正式移动/planner。未复现资源结算不一致，不将提示优化称为规则修复；原数值、存档与路线规则不变。详见 `salvage-hardening.md`。
- 桌面阶段24已在 `78b63120e32f7746a08d92af5bdc0a2be6ab5f6f` 独立完成同步，不参与网页版本和本轮构建，不重复无变化 QA、不扩展阶段25。PCK-only 资源探针不是可玩包、图形试玩或二进制发行。

## 入口与存档兼容

- 保留原六款 `play.html#game/...`、三款既有独立页面和寄壳旧书签跳转。首页只增加新目录条目，收藏/最近打开仍使用 `xxsxWebGamesHubV1`，不重新编号既有游戏 ID。
- 余烬仅使用新键 `xxsxEmberConvoyV1` 及同名前缀的 pending、backup、rejected 档案。schema v2 在字段/checksum 检查外从种子重演决策历史；显示种子 `EC-XXXXXXXX` 可还原原整数。其他作品档案不访问、不迁移、不清空。
- 余烬存储不可用时保留可玩的内存局；写入失败会停止后续持久化，冲突会拒绝旧页覆盖。检查当前主档/事务字节**不是跨标签原子锁**，不保证同时写入时的原子互斥。
- 既有 V58/V59 缓存目录、脚本、封面和独立页继续受历史资源固定清单及发布器回归保护；`scripts/published-assets.json` 的全部 93 项和源/产物 manifest 一致性已通过最终核验，没有以清空 `dist/` 解决构建问题。

## 已执行验证

### 余烬正式冻结读回

集成人员按主控六文件清单独立核对当前 SHA-256，**6/6 与冻结值相同，测试前后未变**；严格 UTF-8、无 BOM/替换字符、LF、无尾空格及 SVG XML 检查均通过。

| 命令/检查 | 已执行结果 |
| --- | --- |
| `node tests/ember-convoy.cjs` | exit 0 |
| `node --check src/ember-convoy.js` | exit 0 |
| `node --check tests/ember-convoy.cjs` | exit 0 |
| 六文件字节/编码/行尾、SVG XML | 全部通过 |

证据：`C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-ember-20261121-032129-569034/ember-freeze.json` 及相邻三份命令日志。

模块回归覆盖公开真实动作三段胜利、三路高威胁胜利、种子化自然失败/封锁、死舰拒绝、过滤后敌舰编号、种子重开、预测/真实结算、重演存档、损坏隔离、冲突/故障和 DOM 按钮/键盘旅程。256 种子是状态与编码检查，**不是 256 种子全部通关**；DOM/VM 通过不等于真实浏览器/手机/屏幕阅读器试玩。

### 共享接线

- `npm test` 保留原 17 条命令及其顺序，增加 station-feedback、echo-receipt、relay-shield、border-hardening、circuit-hardening、ember-convoy、salvage-hardening，共 **24 条**。
- 首页共享测试新增真实十作目录的新入口/搜索/收藏/最近打开/重载旅程，并锁定原九作入口。内存存储桩保留旧游戏档案，验证首页仅访问目录键；`node tests/hub.cjs` 已 exit 0。
- 发布静态验证增加余烬独立入口/专用资源/live status/缩放和 manifest 必需项；HTTP CLI 预览测试增加余烬源码与构建后资源请求。不改 `src/play-loader.js`，不调用浏览器自动化。
- `node --check tests/hub.cjs`、`tests/static-validation.cjs`、`tests/dev-preview.cjs` 已 exit 0；共享 `static-validation` 和完整 `dev-preview` 随下述最终 `npm test` 在 V60 产物上通过，不是对旧 `dist/` 提前声称通过。

### 打捞最终冻结读回

集成者核对最终 Git blob：`src/salvage-expedition.js=bab909425273de901a57faa2be758f43f786da17`、`tests/salvage-hardening.cjs=6c82b221d7cf72a8236fc1c30107bb40f0a81337`、`docs/salvage-hardening.md=9684031c862e4befd2a390175953132fe0798fe5`，**3/3 相同，测试前后字节未变**。严格 UTF-8/LF、无 BOM/替换字符/尾空格及限定 diff-check 均通过。

Node v24.21.0 独立复跑 `salvage-hardening`（11 项、6,048 组 planner/正式动作对照）、`salvage-journey`（5 项）、`campaign-games`（21 项）及源码/测试两项 `node --check`，均 exit 0。证据 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-final-20261121-033155-580765/salvage-freeze.json`。自然旅程与边界夹具分开计，不冒称浏览器或全局平衡验收。

### 最终共享树构建与产物核验

所有实施线正式冻结后，在真实共享工作树按顺序执行，而非隔离副本：

| 命令 | 结果 |
| --- | --- |
| `npm run build` | exit 0，`Built V60`；首页 HTML/CSS/JS/目录 gzip 12,683 字节，图标另计 |
| `npm test` | exit 0，完整 24 条命令全部执行通过，原 17 条顺序保留 |

执行时间为 2026-11-21 11:33:58–11:34:22 UTC。`build-test.json` 与相邻 `npm-build.log`、`npm-test.log` 记录完整命令、退出码和输出；目录为 `C:/Users/xxsx/AppData/Local/Temp/opencode/xxsx-v60-final-20261121-033155-580765/`。16 份冻结源码/入口/样式/图标/测试/文档和 39 项构建输入在命令前后 SHA-256 未变。

- 源码及构建后 loader 分别 **46/46**；原六款路由、舰站书签、寄壳旧书签及依赖失败保档通过。首页实际十作目录测试保留原九作完整条目/入口/收藏，并验证余烬搜索、收藏、最近打开及重载。
- `dev-preview` 用回环 HTTP CLI 验证源码与构建页、余烬 JS/CSS/SVG、V58/V59 缓存目录/脚本/封面/独立入口和 MIME；测试/配置等发布排除与无 SPA 假路由保护通过。这不是浏览器执行、渲染或触控测试。
- 发布器回归验证 LF/CRLF 确定性、固定历史资源、相对路径和构建失败保护；静态验证检查独立页、manifest、缩放保护及资源引用，全部通过。
- 最终 manifest **51 组**源码/产物哈希及长度一致、**16 份**旧路径 alias 哈希一致、历史资源 **93/93** 与固定 SHA-256 相同。原九作目录对象逐项等于基线，新增余烬四项发布源，未删除任何既有发布源或已跟踪 `dist/` 文件。
- 相对最终基线，既有发布源字节只改变目录及已冻结的边境、黑盒、电路、打捞四份源码；hub/loader 源码未改，产物哈希变化来自目录路径和其引用传播。许可证、第三方声明、历史固定清单、桌面镜像均未改；测试、文档、桌面或 Git 目录未进入产物。
- 额外对余烬源码与构建 JS 分别运行存档隔离探针：44 个旧键/事务/备份哨兵字节不变，只访问余烬新命名空间，真实动作后重载、过滤敌舰 ID 与旧页写入拒绝通过。证据 `new-game-storage-isolation.log`；其余产物、目录与冻结指纹证据见 `artifact-verification.json`。

## GitHub 同步

实现提交 **`c8c7a920669eac1fedc22e9cef13e3a47c71f522`** 已正常推送既有 `origin/main`，仅含显式清单 **41 个文件**（25 份源码/测试/文档/配置、16 份构建产物）。暂存前 `fetch` 确认本地/远端基线同为 `78b63120e32f7746a08d92af5bdc0a2be6ab5f6f`；暂存清单与预期逐项相同，严格 UTF-8/无 BOM 或替换字符、源码及冻结指纹、暂存 diff-check 全通过。未暂存桌面、缓存、玩家档案或本机证据日志。

推送后 `ls-remote`、`fetch` 和 GitHub commit API 均确认实现 SHA；远端树 **`3b5ea8dc59399d99582c703845d9c84fed153086`** 的完整 **465 个 blob** 路径/SHA 与本地提交完全一致。按该提交逐文件读取 **465/465 份远端 HTTP 正文**并重算 Git blob，与远端树及本地工作树 Git 清洗后 blob 全部一致，工作树/暂存区干净。证据为上述最终证据目录的 `github-implementation.json`、`staged.json` 和 `staged.diff`，不是仅确认 push 返回成功。

本节及根工作单是后续同步记录提交；最终记录提交的 SHA、最新 main/树/blob 复核保留于同目录 `final-sync.json`，不在文档内写入自身尚不存在的提交号。记录提交仅改变两份集成文档，不重跑未变化玩法或桌面 QA；收尾继续核对 39 项构建输入、16 份冻结文件及产物哈希。

## 未执行边界

未部署 Sites，未执行 GUI、浏览器自动化、截图、触屏/屏幕阅读器或真人试玩；未生成/运行游戏 EXE 或 ZIP，未发布桌面二进制。本轮 Node/VM、内存档案和 HTTP CLI 结果不代表真实玩家档案读写、手机排版/读屏体验或全局平衡验收；桌面阶段24保持独立完成，不重复运行。
