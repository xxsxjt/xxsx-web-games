# V61：既有两作扩展的安全集成

日期：2026-11-21。**V61 共享构建和完整 26 条回归通过，源码与 `dist/` 已同步 GitHub 并完成实施提交全树读回；未部署 Sites。** 本轮只收口既有两作扩展，不增加网页游戏数量；后续开发主线为独立的 Godot Stormline，不纳入 V61。

## 范围与冻结门槛

- 仍为原十款作品，不新增目录 ID、入口或存档键。目录只改《叠印工单》和《借来的十秒》的范围相关文案，其他八作与全部入口/图标保持。
- 《叠印工单》A01–A06 六单，A01 原两条解与 `#level/01` 保留，仍不访问存储/网络；各单两条正式动作通关与键盘/点击 DOM 旅程，详见 [六单实施记录](overprint-campaign.md)。六文件已冻结并由集成者核对原始 SHA-256、Git blob、严格 UTF-8/LF；原测试只将已成为合法关卡的未知哈希反例 `#level/02` 改为仍未知的 `#level/99`，断言保留。
- 《借来的十秒》为六个主线房间和独立 `#practice`；原四房地图/哈希及 `xxsxBorrowedSecondsV1` 的 `{v:1,cleared}` 保持，旧 `cleared=4` 解锁第五房。练习场不推进或补写主线，含坏档情况下的定向回归。正式动作覆盖新两房通关、错峰门阻挡、满槽拒绝、删除重录恢复及练习场两种进门路线，见 [实施记录](borrowed-seconds-expansion.md)。原实施 dispatch 已正式交接并完成，六文件的长度、原始 SHA-256、Git blob 及严格 UTF-8/LF（无 BOM）在共享工作树复核通过。交接清单 SHA-256：`4bb0a2994140ed59ca6512766fdbbae83aee646ee6c88bf39d903ec0984d28e6`。
- 两作实施方各自记录了两套定向 Node 回归和三项语法检查通过；不计作共享构建。共享 `npm run build` 成功后才运行 `npm test`；V60 原 24 条命令顺序不变，仅在尾部追加 `tests/overprint-campaign.cjs` 和 `tests/borrowed-seconds-expansion.cjs`。共享 `core`、`play-loader` 及加载结构保持不变。

## 历史资源和发布器

起点提交 `da355904066a1ffea00b6f45d87614de2f9ec642` 的 `dist/` 有 130 个跟踪文件，其中 **107 条内容哈希 URL** 覆盖 `assets/`、`static/`、`content/`。已逐项比较起点 Git blob 与检出字节，将旧固定清单从 93 补齐到 107，新增的 14 条来自起点而非临时构建。V60 缓存链 `static/hub.bdbc90a5eeab.js` → `content/games.5c6a19a2a503.json` 在保护范围；不动态将中间产物追加进清单。

发布器已有递归 JS/CSS/JSON 收录、目录登记的独立 HTML、发布前引用与内容哈希校验、暂存替换和失败保护；沿用现有机制，不另建发布器。共享回归补齐嵌套输入、107 条历史字节、缺失/损坏资源失败且旧 `dist` 不变，以及 V58/V59/V60 缓存首页/目录/封面/旧独立资源的 HTTP CLI 检查。起点字节加四份共享工具增量的隔离预检均退出 0；**这不是 V61 共享树成品验证**。

## 共享构建与验收

| 命令 | 共享工作树实测结果（Node v24.21.0） |
| --- | --- |
| `npm run build` | 退出 0，生成 V61；首页 HTML/CSS/JS/目录合计 gzip 12,675 字节，图标另计 |
| `npm test` | 构建成功后执行，退出 0；V60 原 24 条命令逐条保留顺序，两项扩展回归仅追加在末尾 |

- 前后核对 12 份冻结文件及 96 项网页源码/构建与测试输入；原始指纹均未变。`dist/` 为 137 文件（新增 7 个哈希资源、更新 4 个 HTML 与 manifest、无删除），51 组当前产物、16 个旧路径别名和 107 条历史资源逐项核验通过。历史资源的 Git blob、SHA-256 及长度与构建前完全一致，全套测试也未改写共享 `dist/`。
- `hub`、`play-loader` 的生成脚本仅更新目录哈希引用，生成的首页和 `play.html` 只更新对应脚本引用；四份源码及共享依赖加载结构均未改。目录顺序、十个 ID、入口和图标不变，其余八款元数据不变。
- 两作走正式操作验证 A01 双解、A01–A06 通关与失败恢复、借来原四房与旧进度、两张新房、练习进度/写档隔离。源码及构建后 loader 各 46/46，保留旧书签及存档。回环 HTTP CLI 检查 V58/V59/V60 缓存目录/脚本/封面及旧独立资源；隔离失败夹具验证历史资源缺失/损坏、错误引用和构建锁均不能改写已有 `dist/`。递归输入、LF/CRLF 确定性及静态校验通过。
- 本机证据在批准的 `Temp/opencode/v61-integration-20261121/`：`baseline.json`、`build-test.json`、`npm-build.log`、`npm-test.log`、`after-build.json`。首次本机产物审计漏列生成的 `play-loader` 目录引用及 `play.html` 的脚本引用，补入精确的单引用字节比对后通过；npm 构建本身退出 0，未修改项目源码或放宽回归。

## GitHub 同步

实施提交 [`dc5d7e9fc41bd4a9a927ddf5a311447c039f542c`](https://github.com/xxsxjt/xxsx-web-games/commit/dc5d7e9fc41bd4a9a927ddf5a311447c039f542c) 正常推送到 `origin/main`。推送前 fetch 确认基线为独立桌面收尾提交 `7b2de90a17e59ff89b383fdf3af579176ccbaae7`；实施只暂存 23 份网页源码、测试、配置及必要文档与 12 份 `dist/` 差异，共 35 个路径。暂存内容与本地原始字节一致，`git diff --cached --check` 通过；桌面源码、许可证、托管配置和本机日志、PCK、玩家档案均未进入网页提交。

推送后，`ls-remote` 和 GitHub API 确认实施提交为远端 `main`；非截断的递归树 `83ab3c8aac2b75d5ded53ad8c7e85f49f490de82` 的 534 个目录/文件条目与本地提交逐项一致，包括 **497 个 blob**。按实施提交逐文件读取 **497/497** 份远端 HTTP 正文并重算 blob，与远端树和本地提交匹配，其中 `dist/` 的 **107/107** 条历史资源也与固定 SHA-256 完全一致。证据：上述临时目录的 `github-implementation.json` 和 `github-implementation-tree.json`。

本节及两份根工作单属于独立的收尾记录提交，不改源码、测试或 `dist/`。该文档提交本身的最终 `main`、完整树及逐文件读回单列于同一证据目录的 `github-final.json` 与 `github-final-tree.json`。

桌面阶段 25 已锁定，阶段 26 / v0.2.0 已独立完成同指纹规范源/镜像 QA、PCK-only 及最终源码同步，见 [阶段记录](../desktop/stormline-black-tide/docs/stage-26-expedition.md)。桌面结果不纳入 npm 或 V61 验证。

## 未执行边界

没有 GUI、Computer Use、浏览器自动化、截图、真实浏览器/手机/读屏器试玩或 Sites 部署；Node VM / DOM 夹具、CSS 声明与 HTTP 字节检查不等于真实布局、原生键盘/触屏、可访问性或游戏难度实测。没有生成/运行游戏 EXE、创建 ZIP 或发布桌面二进制；源码、构建、远端同步与部署/实际试玩分别报告。
