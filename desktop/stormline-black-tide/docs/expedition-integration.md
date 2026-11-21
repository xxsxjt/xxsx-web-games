# Stormline 复杂远征：集成与证据工作单

日期：2026-11-21。Run `run_5b452f0fd900`；唯一工具/集成/Git 负责人 `ctx_d7f7e1a9b898`。主控拥有 `docs/expedition-plan.md`，此处不替代该玩法/API 契约。

## 当前事实与隔离

- 候选根为批准 Temp 下的 `stormline-expedition-candidate-20261121`，不是规范源、镜像或发行包。基线 `721d80b38dc1a84c69ec91273b9ae8bb8ffaf36a`；相邻 `stormline-expedition-locked-baseline-20261121.json` 记录 83 份来源字节及 3 份历史 Markdown 的 CRLF/LF 差异，不能声称全部 raw Git 对象一致。
- 接手时已独立核验：候选五份共享工具与锁定基线相同，规范开发源 83/83 原始字节仍与清单相同。之后仅修改候选工具和本集成记录，不向规范源/镜像复制半成品，不提前改完成版本。
- A 规则/档案线 `ctx_a284b7b9a1bb` 正式冻结五文件，清单 `C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-state-frozen-20261121.json`；集成者独立核验 SHA-256、字节数/行数、严格 UTF-8/LF 5/5，保留原冻结文件。原定向 QA `expedition-state-qa-20261121-062258-864157/summary.json` 只覆盖当时 Catalog `13da61c97c0904da4b27aeba22f1798598be8be015713323350b4ec548a16b9b`；中间目录指纹变化仅是未冻结输入观察，不是玩法回归失败或 A 冻结文件漂移。
- B 模拟/目录线 `ctx_0928cc4f75ca` 已正式冻结且独立核验 4/4 SHA-256 与严格 UTF-8/LF。最终 `src/storm_sim.gd` 为 `ec71fa82d22408b2d1aff063fdf7ccd3900d47deb803dc6f8eda8e0e2b144cb7`，Catalog 为 `8ef9a5ecdadcb683285fbeaf48e7791e672a75ee0757399defdf3775f7667179`；完整四文件哈希及命令在 `C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-sim-20261121/20261121-063838-428262/summary.json`。其只读兼容复原证明最终 Catalog 相对 A 旧依赖仅新增 `sector_name()`/内部复用、将已有压力上限 12 暴露为常量，反向复原恰好匹配旧 SHA-256；没有经济/ID/模块/物理数值变化，不修改候选文件。
- B 已有模型输入证据：正式 State 购买/装备/扣费/充电，经原 Pilot 的真实 step 输入完成 drive+sonar 和 tow+sonar 各六次交付，逐航先扫描/挂索、60 tick 稳定入港；旗舰分别 147.57/217 秒、134.95/179 秒。三旧合同完整快照逐 tick 对照至 4719/6559/9204 tick 相同。B 摘要全部列出子命令均 exit 0、0 诊断、其四文件前后未变；没有为本次交接重跑无变化 B 套件。此为模型/输入证据，**不是正式 main/按钮信号/存储 I/O 验收**；0.453→0.362 是归一化额定载荷比例，不是绝对拖缆力下降。
- B 冻结后已完成一次必要 A 定向复验：`python -B -X utf8 C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-state-runner-20261121.py expedition_state expedition_store`，整体 exit 0；379 条规则夹具、47 条实际存储 I/O 均 exit 0、0 诊断。证据 `C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-state-qa-20261121-064240-562088/summary.json` 捕获 State/Store/Catalog/两测试的前后指纹，最终 Catalog 为上述 B 冻结字节；`sources_unchanged=true`、`natural_driving=false`。另读回 stdout 与两份引擎日志均无诊断，9/9 A+B 文件严格 UTF-8/LF 与各自冻结哈希一致；本机证据索引 `C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-ab-revalidation-20261121.json`。未逐保存追哈希，也不再为同字节重复这次定向复验。
- A 的真实快照主动放弃与中断恢复仍区分：`abandon` 只接受 approach/return 的实际当前 hull/battery，额外扣损、增加 pressure 且无奖励；`recover_interrupted` 只处理重载，不声称保存途中消耗或抵抗强制杀进程回档。C `ctx_51020aa9555d` 已正式冻结五文件并完成 `worker_done succeeded`；集成者核对清单 `expedition-app-4qbcofkc/expedition-app-frozen-20261121.json` SHA-256 `188b887812e18317e99f95e0a5084be2594bdc8a9b0392e60d27d8788e5ab48f`，摘要 SHA-256 `278a50f9c6639d72396616ed9265ce2b60ee54ba16efa74b7a1017c536a9df8d`，A/B/C 冻结 14/14、C 的 27 份运行输入及 23 份日志均读回匹配，12 条定向命令 exit 0、0 诊断。接口文档为测试批次后补录，按最终哈希独立核验，不冒称其字节包含于该批次。
- C 正式 main/按钮/档案证据：推进+声纳六次持久交付至旗舰 147.57/217 秒，稳索+声纳高风险打捞首航 79.02/133 秒，每次 60 tick 双体稳定；另一次 76.93 秒物理成功遇陈旧档案，未入账且不计七次交付。1375 条正式应用检查覆盖付费维修/充电、带耗损出航、实际输入触礁和消耗后主动放弃、自然超时失败、中断重载、坏档/备份、故障写盘、冲突和重复结算、旧成绩四文件不变及四视口几何。完整航程采用原 Pilot 连续输入经正式 `_advance_simulation`；实际引擎轮询按键只验证 120 tick，不是全程离散键盘、真人或窗口试玩。另一构筑未完成正式应用六航。独立读回在批准 Temp `expedition-c-integration-readback-20261121.json`；未修改实施者冻结字节。
- 当前阶段表：A **正式冻结 5/5 且最终目录定向复验通过**；B **正式冻结 4/4 且已有模型输入驾驶证据**；C **正式冻结 5/5 且正式应用定向验收通过**。候选及 v0.2.0 最终规范源/镜像完整回归均 **34/34 通过**，两侧 55 项指纹相同且未变，owner14 文件保留冻结字节。候选摘要是批准 Temp 候选根 `build/qa/20261121-072031-548248/summary.json`，不是规范源该路径；最终规范源/镜像摘要分别为 `build/qa/20261121-072912-287900/summary.json` 和总仓库 `desktop/stormline-black-tide/build/qa/20261121-072912-352847/summary.json`。本轮无功能缺陷需 owner 重冻。
- 同一候选字节 PCK-only 及资源探针通过：批准 Temp `expedition-candidate-pack-20261121-072454-176150/summary.json`，578176 字节，SHA-256 `f7b4f975bef67cdf457c96cb2f8af466b2afa562f1b1192f8227ec94cc7d2f78`。静态 29 项资源校验与 12 脚本/入口资源加载均通过，未实例化主场景，隔离环境未产生默认成绩或远征档，不生成 EXE/ZIP。这份候选仍是 0.1.3 基线元数据，不是最终版本包；规范源整合、版本元数据及后续完整 QA/PCK 将另记，不能复用为不同元数据的同字节导出证据。
- 网页 V61 与桌面独立。《借来的十秒》B `ctx_0aaea8c557ea` 异常停止且无交接/worker_done，未完成正式六文件冻结；主控已核对原 dispatch 仍 live/idle/input_accepted 并发送一次限定续接，未替换/retry/stop/reset。该处为**未决的 B 实施处置**，不是正常等待，也不是已确认任务失败；保留全部现有修改，旧四房回归不等于六房扩展完成，不构建未冻结 B、不派重复写者。V61 推送不是本复杂主线的终点。

## 共享工具准备（未代表游戏通过）

- 保留全部原回归及顺序，末尾注册 `expedition_state`、`expedition_store`、`expedition_sim`、`expedition_app` 四套必需检查；不复制旧回归凑数。
- PCK-only 探针保留八份原脚本与入口 PackedScene，增加真实远征依赖 `expedition_catalog/state/store/hud`。仅加载资源、检查旧三合同常量；不构造模拟器/状态/存储实例，不实例化入口，不调用游戏 EXE。
- Python 探针要求完整必需资源集合，并继续将实际加载集合与 PCK 静态资源逐项相等比较；自测同步覆盖缺失复盘/任一新依赖，以及 manifest 与 probe 同时陈旧的拒绝路径。源树 scratch 禁入、显式日志、隔离用户/应用数据/临时/XDG 守卫不放宽。
- 本次候选工具预检已通过：`python -X utf8 -m unittest discover -s tools -p test_*.py -v` 为 5 个 Python 测试方法全过；AST/注册检查确认 Stage25 原 28 套件顺序不变、末尾新增 4 套，PCK 清单与 runner 必需资源集合均为 12 项一致；逐项核验规范开发源 83/83 仍为锁定基线字节。测试覆盖每个必需脚本从实际 probe 缺失时拒绝，以及资源 manifest 与 probe 同时缺项仍拒绝；源树 scratch、引擎日志和九个用户/临时/XDG 隔离变量断言均保留。仅检查工具接线，不曾调用 Godot。
- 完整候选通过后已按 20 路径接收清单整合规范源，只改必要元数据/入口文档；最终两侧 QA 和十二脚本/入口 PCK 资源探针通过。97 份白名单原始字节相同，最终 0.2.0 PCK SHA-256 `ae5dff36403b1012b96f3796c57d9b35fe0da7bf87f0f53ddd625c7b5cf26217`，578528 字节/29 资源，未实例化主场景。实现提交 `cf877c94fd05230678e58472a41ad43e2d2f48af` 已推送，远端完整 484 blob 树与 97/97 正文/blob 读回通过；实现证据与记录提交后的最终读回见 `stage-26-expedition.md`。规范源不覆盖主控后续候选计划，网页 B 不阻塞桌面阶段且网页修改不进其提交。

## 冻结后的真实验收门槛

1. 逐文件接收 A/B/C 冻结 SHA-256 与 Git blob，核对当前字节及 UTF-8；记录所有源码/配置/测试/工具输入指纹。API 变更或失败交原 owner 修复重冻。
2. 候选完整官方 Godot 4.3 headless QA：保留旧三合同快玩、成绩/sidecar、复盘、固定输入基线。至少一条正式 main 自然六部署至最终旗舰成功；另一不同构筑/分支自然完成首部署。禁止注入位置/HP/终态/报酬冒充驾驶。规则结算夹具与自然输入旅程分开登记。
3. 核验支线、风险、持续损伤、维修、充电、模块的实际模拟差异与后续状态，不只读 UI 数字。正式按钮/键盘、存储失败、重复结算、陈旧会话、中断恢复和明确终止均需有对应证据。
4. 候选通过后，对照仍锁定的规范源及后来通用文档变化，以显式白名单逐文件整合；不全树覆盖、不删除用户文件。必要版本元数据只在此时更新，并对最终代码/工具字节重新 QA。
5. 同指纹开发源/镜像 QA、PCK-only 导出及两侧资源探针；保留所有输入与产物指纹，说明复用证据的准确范围。镜像仅同步源码、测试、工具和必要文档，排除缓存/日志/档案/PCK/包。
6. fetch 保留历史，显式暂存并正常提交/push；读取远端 main、commit、完整树及逐文件正文/Git blob。网页 `dist/` 不因桌面源码变化重发，不将候选、源码同步、实际试玩与二进制发行混为一谈。

## 限制

全部引擎调用必须 `--headless --audio-driver Dummy`、显式 `--log-file` 并隔离用户/应用数据/临时/XDG。继承早期手工 headless 缺省日志位置/写入未核验的历史边界；后续隔离不能追溯消除，也不证明玩家成绩被改，不读取或清理玩家目录。

没有图形试玩、GUI/Computer Use、浏览器自动化、截图、游戏 EXE/ZIP、公开二进制或 Sites 部署。本阶段目标是相互影响的真实经营与驾驶闭环，不以新菜单、局部加关或测试数量充当产品深度。
