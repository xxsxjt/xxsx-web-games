# 《风暴线》复杂独立游戏主线：远征经营与实际驾驶

日期：2026-11-21。用户纠正：“怎么还在搞小游戏，能不能搞个复杂点的”。本轮以**一款有相互制约系统的独立游戏**为目标，不再以增加小游戏、独立关卡、界面文字或测试数量作为主要交付。

## 当前状态与隔离

- 本目录是批准临时区内的实现候选，不是规范开发源，也不是已同步或可发行版本。
- 显式复制 82 份公开源码/测试/工具/配置/文档，Stage25 的六个实现文件逐项 SHA-256 相符。基线清单在相邻 `stormline-expedition-candidate-baseline-20261121.json`。
- Stage25 锁定后已重新对照 `721d80b38dc1a84c69ec91273b9ae8bb8ffaf36a` 的 83 份公开文件，补入最终阶段文档和任务计划。候选保留规范开发源实际字节，47 份代码/配置与锁定版本一致；三份历史 Markdown 与 Git 对象仅 CRLF/LF 不同，已逐项记录，不当成代码差异。权威候选基线更新为相邻 `stormline-expedition-locked-baseline-20261121.json`。
- 唯一集成者继续承担 Stage25 后续与网页 V61 的安全收口；三实施者不写规范源、镜像、阶段 25 锁定指纹或 Git。远征三线冻结且主控核验完成后，由同一集成者按显式清单独立推进远征全套 QA 与规范源集成；网页未完成项不阻塞桌面主线，不把其半成品混入桌面提交。
- 保留旧三合同的快玩、物理基线、成绩文件和复盘；远征采用独立的有版本档案，不重解释或迁移旧最佳成绩。
- 仅 CLI、官方 Godot 4.3 无窗口导入与回归；所有运行均显式日志和隔离用户目录。不启动图形游戏、Computer Use、截图、游戏 EXE/ZIP 或站点部署。

## 完整可玩闭环

船坞整备 → 选择海区与合同 → 权衡船体、电池、维修材料和改装预算 → 按真实配置驶入 3D 海域 → 搜寻/扫描/挂索/避礁/交付或失败 → 结算报酬与持续损伤 → 维修/改装/补给 → 下一次远征部署 → 完成旗舰回收或撤退结算 → 保存并继续。

首轮做 **三海区、六次连续部署**：每海区先在勘测/回收支线中二选一，再进行该区主回收；第三海区主回收为旗舰任务。每次可选择保守或高风险合同，航线和奖励在出航前公开。支线选择改变后续主回收的风暴、时限或补给，不只改变结算说明。前三合同快玩仍独立可用。

## 必须相互影响的系统

1. **航区/合同**：明确的分支图、可选节点、已完成节点、最终目标；真实任务数据控制风暴强度、回收舱质量、截止时间和海区障碍，而不是只换标题。
2. **预算/材料/持续损伤**：有限初始资金和维修材料；每次出航扣成本，交付按完整度结算，失败损失成本并保留损伤；船体和电池状态进入下一航次实际模拟。可撤退结算，不能靠反复打开结算页刷奖励。
3. **船只改装**：推进、稳索、声纳三类模块，有限装备位/功耗预算，不能全装；至少两种可完成的构筑。提升推力要付出能耗，强化拖缆要付出质量/操纵，声纳要付出动力或能耗；通过实际 step 数值体现而非仅 UI 预览。
4. **船坞取舍**：维修和充电会消耗预算/材料/远征风暴窗口；带伤继续、少修多改、提早撤退都必须有明确后果。避免经济死锁：可明示终止并开始新远征，不暗中赠送无限资金。
5. **档案与生命周期**：独立版本档案，有限输入大小、严格验证、备份/安全写入与陈旧会话冲突保护；中途退出可恢复船坞，出航前即记录部署令牌/成本。重新载入中断航次按明示规则处理，不伪称保存每一物理帧；失败/重开不能复制奖励。

## 模块契约与所有权

- A 远征规则/档案：新增 `src/expedition_state.gd`、`src/expedition_store.gd`、`tests/expedition_state_test.gd`、`tests/expedition_store_test.gd`、`docs/expedition-state.md`。
- B 实际模拟/任务目录：修改 `src/storm_sim.gd`，新增 `src/expedition_catalog.gd`、`tests/expedition_sim_test.gd`、`docs/expedition-simulation.md`。旧无参数 reset/step/snapshot 及旧合同全量保真。
- C 正式应用/可用界面：修改 `src/main.gd`、`src/storm_hud.gd`，新增 `src/expedition_hud.gd`、`tests/expedition_app_test.gd`、`docs/expedition-interface.md`。从正式入口进入，真实按钮信号驱动；不得只有模型无入口。
- 集成仍由唯一 Git 负责人承接；候选验证完成后再按当前 Stage25 锁定基线做显式差异整合，不覆盖工具修复。主控只协调、核对和验收，不同时修改实施者文件。

### 三线共用 API（实现者不得静默另造）

`expedition_catalog.gd` 为纯 `RefCounted` 数据目录，提供 `static func offers(sector:int, leg:int, path:Array, pressure:int) -> Array`、`static func build_contract(offer_id:String, pressure:int, path:Array) -> Dictionary`、`static func modules() -> Dictionary`。offer 含 `id/name/sector/leg/risk/base_contract/reward/parts_reward/launch_cost/summary`，catalog 自身生成风暴/质量/时限参数，全部由同一目录驱动预览与模拟。为避免循环 preload，catalog 不引用 Sim；build_contract 只返回经验证的任务覆盖参数（`id/name/briefing/base_contract/sector/leg/risk/severity/mass/deadline/wind_angle` 等），Sim 从 `CONTRACTS[base_contract].duplicate(true)` 得到真实几何再套用明确白名单覆盖项，不复制三份底图或接受任意磁盘任务数据。

模块 ID：`stock`（默认空槽，不进入 equipped）、`drive`、`tow`、`sonar`；最多装两件不同模块，负载预算 3，其中 drive/tow 各 2，sonar 1，因此不能同时 drive+tow；drive+sonar 与 tow+sonar 是两条完整构筑。目录条目含 `id/name/description/price/load/effects`，effects 为显式命名的乘数（如 thrust/energy/rating/sensors/stability/mass），由模拟实施者在保持可解前提下设定并供界面原样显示，不用预览/模拟两套公式。目录应尽早冻结字段和数值交另两线，后续更改须显式通知。

`expedition_state.gd` 为纯规则对象。`new_campaign() -> Dictionary`；`validate(data:Variant) -> bool`；`offers(state:Dictionary) -> Array`；`act(state:Dictionary, action:String, payload:Dictionary={}) -> Dictionary`；`launch_spec(state:Dictionary) -> Dictionary`。均为 static 方法。act 返回 `{ok:bool, state:Dictionary, message:String}`，永不原地修改传入 state。action 至少 `buy/equip/unequip/repair/recharge/launch/settle/retreat/recover_interrupted`。选择合同由 `launch` payload.offer_id，settle payload 为 `{token, snapshot}`，只取该部署终态的公开 snapshot，必须核对部署 token/任务身份和终态以防重复结算。state 包括 version/revision/sector/leg/credits/parts/hull/battery/pressure/owned/equipped/path/active/history/status；history 有界。launch_spec 返回 `token/offer_id/contract/loadout/hull/battery`，contract 使用 catalog，loadout 为模块 ID 数组。空状态不是可接受档案。campaign id 使用无秘密的本机唯一值或调用方显式传入，不用时间作为随机任务真相。

`expedition_store.gd` 为单档案存储适配。`_init(path:String)`；`load_state() -> Dictionary`（含 `ok/state/message/exists/conflict`）；`save_state(state:Dictionary, expected_revision:int) -> Dictionary`。初始化不暗中开新档/覆盖坏档；无档 `expected_revision=-1` 才可创建，保存必须比磁盘 revision 大 1，读写均验证；陈旧进程不能覆盖新档。只对指定路径操作，不扫描用户目录，不使用或修改旧最佳成绩。

`storm_sim.gd` 新增 `reset_expedition(spec:Dictionary) -> bool`：只在验证完整合法合同/模块/初始状态后生效，失败时原实例状态不变。复用同一个物理 step，不用子类/平行战斗模拟；真实配置应用到 drive/能耗/传感器/缆绳额定/质量或稳定等。默认 stock 路径要与原模型逐 tick 等价。snapshot 新增的 expedition 元数据仅在远征模式出现，快玩投影不变；保留 contract_id 为有效 base_contract，动态任务名称/说明用单独安全元数据，世界按实际 contract.configure。远征成绩不写快玩榜单。

应用负责从独立档案读取/保存 act 结果；先成功保存 launch 再进入运行，终态 settle 只发生一次；中断复归的成本与损伤规则有清楚文本。暂停/R/回菜单/退出与快玩区分，远征不得通过 R 免费满血或免成本重开。存储失败给可读反馈，不把未保存状态假装成已保存。HUD、地图、模块预览和世界均消费同一份真实模型/目录数据。

前置审查修正：**手动放弃不等于无末帧的进程中断**。已有真实模拟快照时，放弃必须以当前船体/余电为依据再计救援代价，不能按出航值减固定数而反向补回已消耗资源。A 已实现 `abandon {token,snapshot}`，核对当前部署身份和 approach/return 快照，按当前船体/电池再扣 15/20、压力 +2、无奖励；`recover_interrupted {}` 只用于缺少末帧的重载。规则/存储定向隔离回归通过且主控已读回实现与运行摘要，**不代表 A 已正式冻结或 C 的公开输入旅程已通过**。固定中断惩罚不保存全部物理进度或航程消耗，不承诺阻止故意杀进程回档；不为此扩成反作弊或逐帧存储系统。

## 验收门槛

- 两条不同分支/构筑从新远征经真实驾驶完成至少相应首个部署；至少一条走完整六次部署至远征成功。不得注入终态、位置、HP/奖励替代操作；纯规则测试的明确结算夹具与正式输入旅程分开报告。
- 对照同一合同、同一输入的不同模块，验证推力/能耗/声纳/张力等真实差异；无配置路径逐 tick 对照旧版，原三合同与全套旧回归不回退。
- 失败、带伤继续、修复、充电、改装、切支线、撤退、重载中断、重复终态、损坏档/备份、陈旧写入、写入失败均覆盖。
- 正式 main/HUD 可从旧任务台进入/退出远征；真实控件和键盘等价；四视口无窗口几何，完整内容可滚动、不靠缩小字体隐藏信息。无窗口检查不当作真人试玩。
- 候选冻结后完整回归、PCK-only 资源探针、显式清单镜像与远端内容核验。未做图形实玩、二进制发行或网页部署均明确标记。

## 进度

- 实际编排：Run `run_5b452f0fd900`。A `ctx_a284b7b9a1bb`、B `ctx_0928cc4f75ca`、C `ctx_51020aa9555d` 均已接收任务并启动；C 工具回执虽中断，但已通过 worker-list/worker-show 确认 `input_accepted`、`working`，没有重复启动。三线直接交换接口，Git 仍唯一归 `ctx_d7f7e1a9b898`。
- 集成者已明确接受跨 V61 与远征的唯一共享工具/集成/Git 责任：只在候选接入 `expedition_state`、`expedition_store`、`expedition_sim`、`expedition_app` 四套必需回归，保留旧套件，扩展只加载资源的 PCK 探针及陈旧探针拒绝测试。三实施线全部正式冻结前，不运行候选全套 QA、不导出 PCK、不复制回规范源；准备接线不算功能已完成。V61 等十秒线冻结是有意门槛，不重启或轮询该等待。
- [x] 用户方向纠正已记录，现有小改仅安全收口。
- [x] 基线代码已读；独立候选与六文件哈希验证完成。
- [x] 远征规则/档案实际实现并冻结：A 已正式交接并 `worker_done succeeded`；主控独立核对五文件 SHA-256、严格 UTF-8 和无替换字符全部相符。清单为相邻 `expedition-state-frozen-20261121.json`；最终规则/存储摘要为 `expedition-state-qa-20261121-062258-864157/summary.json`，记录 `sources_unchanged=true`、`natural_driving=false`，其所测 Catalog 为 `13da61c97c0904da4b27aeba22f1798598be8be015713323350b4ec548a16b9b`。该值在首次核验时相符，之后 B 继续编辑未冻结目录，已经变化；A 五个文件的冻结不受此影响，但旧 QA 不覆盖新依赖。B 最终冻结后由集成者针对最终 Catalog 复验 state/store，C 正式驾驶证据绑定最终 Sim/Catalog/State/Store 指纹；不因中间保存反复追哈希或唤醒 A。
- [x] 动态合同/改装进入同一模拟并冻结：B 已正式交接并 `worker_done succeeded`，主控独立核验四文件 SHA-256/严格 UTF-8 相符，同时确认 A 五文件仍冻结。最终 Catalog 为 `8ef9a5ecdadcb683285fbeaf48e7791e672a75ee0757399defdf3775f7667179`，Sim 为 `ec71fa82d22408b2d1aff063fdf7ccd3900d47deb803dc6f8eda8e0e2b144cb7`。定向证据 `expedition-sim-20261121/20261121-063838-428262/summary.json` 记录输入未变和命令通过。两种构筑分别用正式 State 操作、原 Pilot 和同一 step 连续完成六次部署，每航先扫描再挂索、稳定入港 60 tick；这是模型/输入旅程，不是正式 main/按钮/档案 I/O 验收。旧三合同与锁定模型完整快照逐 tick 相同。目录仅增加海区名称 helper 和公开原有压力上限常量：主控只读逆向还原后精确得到 A 所测旧目录 hash，共享数值不变；集成者仍针对最终目录复验 A 两套定向检查。
- [x] 最终目录依赖定向复验完成：集成者在 B 冻结字节上重跑 A state/store，证据为相邻 `expedition-state-qa-20261121-064240-562088/summary.json`。主控已读回摘要，State/Store/两测试及最终 Catalog 指纹均有记录，命令全部 exit 0、无诊断、`sources_unchanged=true`，仍明确 `natural_driving=false`。不再重复该同字节检查；集成者此后等待 C 正式冻结属有意门槛，不重启或为状态回执反复唤醒。
- [x] 正式应用/船坞/海图/结算贯通并冻结：C `ctx_51020aa9555d` 正式交接并 `worker_done succeeded`，五文件不再写入。冻结清单 `expedition-app-4qbcofkc/expedition-app-frozen-20261121.json` 的 SHA-256 为 `188b887812e18317e99f95e0a5084be2594bdc8a9b0392e60d27d8788e5ab48f`，运行摘要为同目录 `summary.json`，SHA-256 为 `278a50f9c6639d72396616ed9265ce2b60ee54ba16efa74b7a1017c536a9df8d`。主控独立核验 A/B/C 共 14 文件的 SHA-256、Git blob、严格 UTF-8/LF、27 项运行输入当前未漂移及 23 份控制台/引擎日志指纹；12 条定向命令均 exit 0、无诊断。界面证据文档在运行后补齐，最终文档哈希由冻结清单单独核验，不伪称该文档与运行批次前字节相同。主控核验索引为相邻 `expedition-c-coordinator-verification-20261121.json`；这是交接证据核对，不是重跑引擎或完整 QA。
- [x] 正式 main 两构筑及完整六部署自然旅程门槛：推进＋声纳经真实按钮、Store 与原 Pilot 连续输入完成六航，旗舰 147.57/217 秒；稳索＋声纳冒险打捞首航 79.02/133 秒。七次均先扫描/挂索、双体稳定入港 60 tick 且已读回持久奖励；陈旧会话另一次 76.93 秒物理成功未发奖、不计入七次。实际碰礁耗电后主动放弃按当前船体/电量再扣救援损失，付费维修/充电、带伤出航、自然超时、中断、写失败/备份/陈旧会话/终局与快玩成绩隔离均有应用证据。四视口 Control 几何通过；全程 Pilot 连续输入不是全程键盘或真人试玩，另有 120 tick 引擎键盘适配对照，第二构筑正式应用完整六航未做。
- [ ] 候选全套旧基线/档案兼容与新增四套联合回归、资源只读 PCK 探针：三线正式冻结门槛已满足，交唯一集成者接续，不再以等待 C 或等待网页 B 为由停在门外。任何可复现实施缺陷仍退原 owner 精确修复并重冻，不增派重复写者。
- [ ] 在锁定后的规范基线上集成、镜像、推送并回读远端内容。
