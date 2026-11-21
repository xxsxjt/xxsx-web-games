# 远征规则与档案（候选实现）

## 实施计划（2026-11-21）

1. 固定不可变规则 API、字段、整备和失败代价，先交 B/C 对接；任务与模块价格只读 Catalog。
2. 实现三海区六次成功部署的状态机、令牌结算、压力/支线合同上下文和明示中断后果。
3. 实现独立版本档案、实际字节陈旧写保护、显式备份恢复与写失败反馈。
4. 官方 Godot 4.3 隔离 headless 回归规则夹具与存储；与 C 的真实输入旅程分开报告，冻结五文件及 SHA256。

## 已固定的对接契约

`State` 不引用 Sim，仅 preload `expedition_catalog.gd`；公开 static 方法为 `new_campaign/validate/offers/act/launch_spec`。
`act` 返回 `{ok,state,message}`，成功恰好 `revision+1`，失败不变；输入及嵌套数组/字典均不原地修改。
状态包含 `version/revision/campaign_id/sector/leg/credits/parts/hull/battery/pressure/owned/equipped/path/active/history/status/deployment`。
`status` 为 `dock/active/completed/retreated`；`path` 仅已成功的 offer_id，按海区支线/主回收顺序推进。

开局资金 180、材料 6、船体/电池 100、压力 0。`buy/equip/unequip` payload `{module_id}`，价格和负载只取 Catalog；最多两模块，负载不超过 3。
`repair {}` 每次修复至多 25 船体，费用 14 资金、1 材料、1 压力；`recharge {}` 至多 40 电量，费用 10 资金、1 压力，均禁止无效满额购买。
`launch {offer_id}` 支付 Catalog 出航费，要求船体至少 20、电池至少 25；预先存 active 后应用才能进入航行。
`active` 为 `{token,offer_id,sector,leg,pressure,path,hull,battery,loadout}`；token 绑定 campaign_id 与严格递增 deployment。
`launch_spec` 为 `{token,offer_id,contract,loadout,hull,battery,pressure,path}`，合同由 Catalog 以冻结上下文重建，绝不信任磁盘任意任务参数。

`settle {token,snapshot}` 要求 snapshot 的 `expedition_token/offer_id/contract_id` 与当前部署一致，phase 仅 success/failed。
成功奖励为 `floor(reward*cargo_integrity/100)`，材料为 Catalog.parts_reward；只成功才追加 path、推进六个节点，最后进入 completed。
失败无报酬、不推进，保留真实船体/电池并额外船体 -8、压力 +2，回船坞后可付费重试或终止。
`abandon {token,snapshot}` 用当前真实非终态快照主动放弃：核对部署令牌/身份与 approach/return 阶段，按实际当前船体 -15、电池 -20、压力 +2，无奖励回船坞；不会提高到出航读数。
`recover_interrupted {}` 只用于重载中断：在已预付成本之外，按出航记录船体 -15、电池 -20、压力 +2，无奖励回船坞。它不保存物理帧或途中消耗，**不保证防故意杀进程回档**，不能拿它替代有真实快照的主动放弃。
`retreat {}` 仅船坞明示终止为 retreated；`restart {}` 仅终态可用，生成新 campaign_id 和初始资源，但保留 revision+1，供同档 CAS/备份保存。

Store 为 `RefCounted` 实例：`new(path)`、`load_state()`、`save_state(state,expected_revision)`，返回统一 `{ok,state,message,exists,conflict}`。
坏主档返回失败及 `backup_available`，不自动覆盖；`restore_backup()` 为明确恢复入口，先保留 `.corrupt` 后恢复已验证 `.bak`，并核对实际读取指纹。
默认路径由 main 注入，不读取旧成绩或 sidecar；所有测试档案仅候选 `.testdata`。

## 验证边界与失败夹具

快照消费只读公开字段：字符串 `expedition_token/offer_id/contract_id/phase/fail_reason`；有限数值 `hull/battery/cargo_integrity/time/dock/overload`；布尔 `scanned/tow_attached`。数值范围为船体/电池 0..出航值，舱体 0..100，时间 0..目录时限+1 秒，dock/overload 0..1。成功须船/电/舱均大于零、时间未超时、扫描/挂索成立、dock=1，且无失败原因。失败须非空原因，并至少命中船体/电池/舱体为零、超时、过载=1 之一；不接受单纯将 phase 改成 failed 的未解释终态。主动放弃只接受仍在 approach/return 的非终态快照，资源大于零且未达任何失败阈值，return 必须已扫描并挂索，不能拿别次任务或终态冒充。

`tests/expedition_state_test.gd` 的 `terminal_fixture` **明确伪造规则输入**，仅验证令牌、流程、经济和字段边界，绝不当作自然航行；覆盖两构筑六次成功、支线与压力真实合同差异、每类失败阈值、带伤继续、补给、穷困终止/重开、中断、重复/跨任务/逆序结算和 history 上限。正式 main 自然驾驶是 C 的单独验收。

## 存储范围与并发实情

档案封装为 `{format:"stormline-expedition",version:1,state:{...}}`，上限 98,304 字节；字段完整且不接受陌生状态键、NaN/Infinity、非整数资金/修订/计数、乱序 path 或无效 active。严格 UTF-8 检查拒绝超长编码、代理区、截断、越界码点和 NUL，中文正常保留。

每次读取保存实际字节 SHA-256；保存重读当前字节，核对本实例已观察值和 expected_revision，新状态修订恰好 +1。临时档先写、flush、读回、验证，再保留上一有效主档 `.bak` 后同目录替换主档，最后读回；失败不回报成功。无档只接受完全初始状态（允许自己的 campaign_id），不是任何伪造 revision0 资源表。父目录不会偷偷创建，必须由调用方提供适当路径。

这不是跨进程原子锁：比较与 rename 之间仍存在窄 TOCTOU 窗口，不承诺对真正同时的无锁写入线性一致；防的是已读取旧字节的常见陈旧会话覆盖。也不是反作弊或断电持久性证明，不防手工篡改合法 JSON、操纵备份、磁盘损坏或系统崩溃时的硬件缓存丢失。坏主档不会自动用 `.bak` 代替并继续悄悄写，必须明确恢复，且坏字节保留 `.corrupt-摘要`。

`tests/expedition_store_test.gd` 实际 I/O 仅用候选 `.testdata/expedition-state-*`，覆盖初始/增量写后读回、真实字节陈旧冲突、同 revision 不同字节、坏档/备份显式恢复、字段/编码/大小上限、预存 active 的多次启动中断、restart CAS 与旧终态备份、父目录/文件被目录阻挡等写失败。

## 正式规则/存储回归与冻结

2026-11-21 正式命令（批准 Temp 中 A 自己的 runner，不修改共享 tools）：

```powershell
python -X utf8 C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-state-runner-20261121.py
```

退出码 **0**。runner 核对 `4.3.stable.official.77dcf97d8`，两个实际 Godot 脚本均退出 0、无 SCRIPT ERROR / ERROR / WARNING / FAIL；源码与 Catalog 前后 SHA256 不变。
最终证据：`C:/Users/xxsx/AppData/Local/Temp/opencode/expedition-state-qa-20261121-062258-864157/summary.json`，含每条完整命令、退出码、实际依赖指纹、显式日志和隔离环境路径。
每次引擎调用均 `--headless --audio-driver Dummy --path <candidate> --log-file <approved Temp evidence>`；APPDATA、LOCALAPPDATA、TEMP、TMP、USERPROFILE、HOME 和五个 XDG 目录逐项置于该次 evidence 子目录。
存储可复盘夹具在候选 `.testdata/expedition-state-3fcf658d4361cb4a`；可直接读回 initial/backup/corrupt/interrupted/写失败文件，不访问真实玩家路径。

规则回归覆盖 379 项，实际 I/O 回归 47 项；这些是覆盖定位，不是玩家收益或实际完成六航次的证明。终态字典夹具与正式 main 输入驾驶严格分开。
期间初次脚本类型推导错误导致超时/非零，已修复；JSON 整数读回的类型差异和空 SHA 更新诊断已修复，以上最终证据均无诊断，不以早期失败作最终通过证据。

本 A 线交接只含下列五个新增文件，不包含 `.testdata`、runner、日志、Catalog、Sim 或 C 的文件。代码文件最终 SHA256：

| 文件 | SHA256 |
|---|---|
| `src/expedition_state.gd` | `97768d379a4739fd2ffa18bb0544b68fc1d5873c3c9dcb804240ece152f69661` |
| `src/expedition_store.gd` | `d68899c6ffb6161a3c37ea6137b23ee4bea19fa1cfeefbea6d8a75022e3338f6` |
| `tests/expedition_state_test.gd` | `7cc84e3f9b31f7d3b02c10c6533d1fbc5dc97442138c742be9052392db1e5cd6` |
| `tests/expedition_store_test.gd` | `42c2bf05f13ee2e7f3da7f68b3a465e44b480fcf3eb367a8d7902ff16feb815b` |

第五份为本文，本文自身 SHA256 见同批冻结交接清单，避免把自身哈希写回本文引起递归变更。实际测试依赖的 B 目录指纹为 `src/expedition_catalog.gd` = `13da61c97c0904da4b27aeba22f1798598be8be015713323350b4ec548a16b9b`；之后若 B 更改目录物理/经济/字段，须区分旧证据并针对性重验，不用旧通过替新字节背书。

未做也不声称：自然 main 六部署/两构筑驾驶（由 C 负责）、图形真人试玩、GUI/浏览器/截图、PCK/EXE/ZIP、站点部署、规范开发源/镜像/Git 写入、远端同步。本候选不是发行版。最终中文 UTF-8/全文件读回/基线差异审计见 A 独立冻结清单。
