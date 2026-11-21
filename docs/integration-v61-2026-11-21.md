# V61 网页 / Stormline 独立阶段集成工作单

日期：2026-11-21。起点：干净 `main` 与本地 `origin/main` 均为 `da355904066a1ffea00b6f45d87614de2f9ec642`。V60 与阶段 24 沿用既有发布证据，不把旧测试重跑计作新进度。当前轮仅使用公开项目源码、Node/HTTP CLI 和官方 Godot 4.3 headless；不作浏览器自动化、截图、图形试玩、游戏 EXE/ZIP、Sites 部署或公开二进制发布。

## 用户方向纠正（2026-11-21）

- 用户明确要求转向更复杂、成体系的独立作品。本轮仅安全收口已做的阶段 25 与收到冻结后的 V61 最小集成，不新增网页作品或扩展需求，不以关卡数、测试数充当产品进展。
- 下一轮聚焦现有 Stormline：出航配置、跨航次损伤、维修/改装、奖励、路线与后续选择形成真实耦合闭环，保留原三合同快玩；不是另加战役菜单或复盘。
- 新闭环先在批准临时目录的独立候选副本开发；阶段 25 已以最终提交 `721d80b38dc1a84c69ec91273b9ae8bb8ffaf36a` 锁定。远征三线正式冻结后，完整候选 QA/PCK-only 已过，按显式清单接入独立桌面阶段 26 / v0.2.0，最终规范源/镜像验证及源码同步见其阶段文档。新证据不回填阶段 25 的 47 项指纹或 V61；不混入未登记模块，不改全机 CORE。

## 所有权和目标

| 线 | 独占实施范围 | 目标 | 当前状态 |
| --- | --- | --- | --- |
| A · 叠印工单 | `src/overprint.{js,css}`、`games/overprint.html`、`tests/overprint{,-campaign}.cjs`、`docs/overprint-campaign.md` | 六张工单；A01 旧解保留、无存档 | 正式冻结，6/6 原始 SHA-256/blob 与 UTF-8/LF 核对通过 |
| B · 借来的十秒 | `src/borrowed-seconds.{js,css}`、`games/borrowed-seconds.html`、`tests/borrowed-seconds{,-expansion}.cjs`、`docs/borrowed-seconds-expansion.md` | 六个主线房间 + 独立练习场；保留原四关及旧进度 | 原 dispatch 已正式交接并完成；6/6 长度、原始 SHA-256/blob 与 UTF-8/LF 核对通过 |
| C · Stormline | 桌面开发源 `src/{main,storm_hud,voyage_review}.gd`、`tests/voyage_review{,_app}_test.gd`、`docs/voyage-review.md` | 从真实航次生成成功/失败结算的内存复盘，不改模拟器、成绩或档案 | 正式冻结，6/6 原始 SHA-256 与 UTF-8/LF 核对通过 |
| 集成 / QA / Git | 根版本、目录、共享发布器/测试及文档、`dist/`、桌面 QA 工具/阶段元数据和明确清单的镜像 | 记录字节、验证并分别同步，只暂存显式文件 | 阶段 25：全树及 83/83 正文读回；阶段 26：最终 `7b2de90`，全树 484 blob 和 97/97 桌面正文读回。网页共享构建与 26 条回归通过，远端读回结果见发布记录 |

## 冻结和验收门槛

- 网页：A、B 都正式冻结后才在共享树构建；先逐文件核对冻结 SHA-256 与严格 UTF-8/LF，核对递归收录及发布输入。保留 V60 的 24 个测试顺序，末尾增加两条；目录仍十款，只调整两作与范围直接相关的元数据。旧入口/hash、A01 旧解与无存档、借来旧 `cleared=0..4` 恢复以及新的自然操作/键盘回归需有证据，不向内部 phase 注入状态来假冒通关。
- 网页产物：保护起点 `dist/assets/`、`dist/static/`、`dist/content/` 的全部 107 条内容哈希 URL，不只看旧 93 条。最终共享树 `npm run build` → `npm test`，含本地 HTTP CLI、静态入口/引用/内容哈希、失败保护和档案隔离；前后核对发布输入及冻结字节未变。
- 桌面：C 正式冻结后接入复盘源码与两个必需回归，并将复盘脚本纳入 PCK-only 资源探针。开发源和镜像分别通过同指纹官方 Godot 4.3 headless QA；PCK-only 只加载资源与入口，不实例化主场景或运行游戏 EXE。保护旧三合同、主档/备份/sidecar，按源码/测试/工具/文档白名单复制，不同步本机输出、缓存或玩家档案。
- Git：两个阶段互不等待；每个真正通过的阶段先 fetch、校验历史、显式暂存/提交并正常 push。推送后读远端 `main`、提交和完整树，逐文件比较 Git blob；未有读回证据不称同步。只提交项目公开文本/网页产物，不提交本机证据日志或包。

## 已核验的阶段与当前任务

- 桌面阶段 25 首轮完整 QA 的 `smoke_tool` 失败已复现并修复：隔离 `TEMP` 位于源树 `build/`，正例探针夹具被源树禁入守卫拒绝；只改正例夹具位置，不放宽守卫。开发源与镜像最终完整 QA 均退出 0、0 诊断，47 项代码/配置指纹相同且前后不变；PCK-only 及两侧资源探针通过、无主场景实例化/成绩文件。独立桌面实施提交 `b2e4b7ed885ab19be181924926689f9ccefba217` 与记录提交 `721d80b38dc1a84c69ec91273b9ae8bb8ffaf36a` 均正常推送，最终树 `4742e626adfe0cdcad5062e7d6e0ec5483ced341` 的完整 470 blob 及 83/83 桌面远端正文读回一致，证据在开发源 `build/sync/stage-25-final.json`；见 [阶段 25 记录](../desktop/stormline-black-tide/docs/stage-25-voyage-review.md)。
- 独立远征 A/B/C 共 14/14 冻结已接收，A 规则/存储和 C 正式 main/按钮/持久旅程通过；候选及最终规范源/镜像完整 QA 各 34/34。阶段 26 / v0.2.0 两侧 55 项指纹相同且不变，最终 PCK-only 十二脚本/入口探针通过。最终桌面提交 `7b2de90a17e59ff89b383fdf3af579176ccbaae7` 的远端树 `920b1e9034edb79699fe707f9b2f2a1bb10d9d88`（484 blob）及 97/97 桌面正文、Git blob、规范源/镜像一致，见开发源 `build/sync/stage-26-final-confirmed.json` 与 [阶段 26 记录](../desktop/stormline-black-tide/docs/stage-26-expedition.md)。`fed9317` 的规范源/镜像记录字节不一致失败证据保留，不能用作通过证据。网页与 `dist/` 均未进入桌面提交。
- 起点 `dist/` 有 130 个跟踪文件，其中 `assets/`、`static/`、`content/` 下 107 个内容哈希 URL；基线 Git blob 与检出字节逐项一致。原固定清单只覆盖 93 条，已按起点 Git blob 补齐其余 14 条（含 V60 缓存首页脚本与目录），不动态把任何中间构建追加到清单。发布器已递归收录 `src/` 的 JS/CSS 和 `content/` 的 JSON，独立 HTML 由目录登记；现有清单校验/暂存/失败保护机制保持不变。在起点 Git blob + 四份共享工具增量的隔离副本中，构建、发布器、HTTP CLI 与静态回归均 exit 0；这是 V60 基线的集成工具预检，不是 V61 成品验证。
- 网页兼容重点：A01 的 `#level/01` 和历史双解不改；`#room-1`–`#room-4` 与 `xxsxBorrowedSecondsV1` 的 `{v:1,cleared}` 继续有效，练习场不补写或推进旧进度。共享 `play-loader`、`core` 源码不改。B 在原 dispatch 接续后已正式冻结，和 A 共 12/12 冻结文件在共享树核验通过。真实 `npm run build` → `npm test` 均退出 0，原 24 条顺序不变，两项扩展回归只在末尾，107 条历史 URL 前后字节一致。V61 只同步网页白名单与产物，不部署 Sites；详见 [V61 发布记录](release-v61.md)。
- 桌面实施方早期手工 headless 调用未显式指定 `--log-file`，引擎可能向用户目录写默认日志，实际位置和写入未核验；后续显式隔离不抹掉该边界。这不是玩家成绩被改的证据；不读删用户目录，业务成绩回归只用隔离夹具。
- 失败交文件所有者修复及重新冻结；记录源码、生成产物、远端同步与未执行项，不能互相替代。
