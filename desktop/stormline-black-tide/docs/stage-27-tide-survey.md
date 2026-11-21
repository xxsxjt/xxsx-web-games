# 阶段 27：实测制图与同区局部缓流

日期：2026-11-21；独立桌面源码 **v0.2.1**。冻结候选已接入规范源及桌面镜像，两侧最终完整 QA、PCK-only 与资源加载均通过；实施源码已正常推送，HTTP ref/完整树及 103 份桌面正文/blob 读回通过。最终记录提交的 ref/树/正文仍以本机 `build/sync/stage-27-final.json` 为准，不递归增加记录提交。三合同快玩、旧成绩及 v1 远征格式保留；V61 网页版本不改动，本阶段不是二进制发行或真人验收。

## 接收范围与可回退基线

- 唯一集成者；无子代理。阶段 26 基线 `7b2de90a17e59ff89b383fdf3af579176ccbaae7` 的两侧 97 个原始文件哈希及 Git blob 独立匹配；fetch 后 HEAD、origin/main、实时远端 main 均为 V61 最终 `0ce052369613f8b0d2b95443deec3057c33b2c2d`，整仓树 `70ac6266e3ea534d9ec7e870bcf8364f67826b84`。
- 批准 Temp `stormline-tide-survey-freeze-20261121.json` 的 SHA-256 为 `3af00bf8acd3777cfa59e76b1958cdd2e919fcbed49c4a30e938487c419373b9`：102 文件的原始字节/SHA-256/Git blob、精确 23 个变化、59 项运行指纹与 71 份候选 QA 日志全部独立复核。只复制这 23 个路径，随后仅调整集成状态文档并增加本记录；不改冻结玩法、测试或断言。最终源码清单为 103 份。
- 批准 Temp `tide-survey-integration-20261121/preflight.json` 和 `copy.json` 保存明确接收/复制清单；相邻 `rollback/{canonical,mirror}/` 保留被覆盖旧文件。只读预检曾将既有四份 Python 缓存误计为源码，失败记录 `preflight-attempt-01.json` 保留；排除缓存重跑后通过，未清理缓存或修改冻结内容。
- 历史 `docs/stage-18-tow-risk-feedback.md`、`docs/stage-19-towline-visual-feedback.md` 的 CRLF 原字节保留；其 Git/HTTP 正文使用既有清洗后 blob 比较，规范源与镜像另作原始字节比较。阶段 26 文档和 `build/sync/` 成功/失败证据均保留，不改写。

## 玩法与兼容边界

原六部署的每海区首部署新增可选 `*-chart-safe/high`。依次在 A/B 测站 13 米内、船速严格低于 4 m/s 持续按 E；松键、超速、越界只清零当前未完成样本。两站后仍要真实扫描、挂索、拖带、双体 60 tick 稳定入港并成功保存，同区主回收的局部涡流项才乘 0.70 / 0.60，不改基础风或漂流。失败、放弃、中断、陈旧写入或保存故障不提前授予持久收益。

新代码读原 ID 的 v1 档案；旧报价正文、令牌、公式和三合同快玩保留，不自动迁档。含新 ID 的档案不能降级给 v0.2.0。玩法、两种合法构筑各六航的持久交付、失败后付费充电重新取样恢复和指定路线电量表见 `tide-survey.md`。

候选完整 36/36、旧版对照与 PCK 证据经独立复核：原 Catalog 与显式重映射 State/Store 的阶段 26 oracle 共 4982 项；阶段 25 三旧约逐 tick 相同到 4719 / 6559 / 9204 成功终态。oracle 夹具只留批准 Temp，不复制到源码或 PCK。候选包 599808 字节，29 条目、13 映射、十二脚本/入口只加载；不是最终规范源导出。

## 最终规范源与镜像验证

官方 Godot `4.3.stable.official.77dcf97d8`，完整 `python -B -X utf8 tools/regression.py --godot <官方 4.3 console>` 已在两侧分别完成 **36/36、退出 0、零诊断**。外层强隔离 USERPROFILE/HOME、全部 XDG、APPDATA/LOCALAPPDATA/PROGRAMDATA/TEMP 等目录，内层逐引擎命令显式 `--headless --audio-driver Dummy --log-file <独立日志>`；两侧检查顺序与冻结候选相同，59 项冻结输入前后不变，各 71 份控制台/引擎日志逐份复核。

- 规范源摘要：`build/qa/20261121-090052-607842/summary.json`；批准 Temp 强隔离包装摘要：`expedition-tide-survey-canonical-20261121-090052-461612/summary.json`。
- 镜像摘要：`desktop/stormline-black-tide/build/qa/20261121-090052-600817/summary.json`；批准 Temp 包装摘要：`expedition-tide-survey-mirror-20261121-090052-463106/summary.json`。
- 候选及最终双侧旧远征 app 各仍为 1407 项、七次正式交付；实测制图 app 各 1344 项、两构筑各六次持久交付及失败后重新取样恢复。边界夹具与实际驾驶在原测试中分别标识，不修改任何断言。

最终 QA 同指纹门控 `--export-pack "Windows x86_64"` 与 `tools/smoke_export.py` 均通过：

| 导出 | 大小（字节） | SHA-256 | 证据（批准 Temp 下） |
| --- | ---: | --- | --- |
| 最终规范源 PCK | 599712 | `9847ec440a2d97f369fe344ecd11ac40f23f4d0e56a275a2c69fe8520dcddaf4` | `expedition-tide-survey-canonical-pack-20261121-090418-993498/summary.json` |
| 镜像独立导出 PCK | 599488 | `680cfb1aa89135edee2f0c7128c7f8d9c325b2817c5e86099677da83e1aa2dc7` | `expedition-tide-survey-mirror-pack-20261121-090418-993068/summary.json` |

两份独立导出均 29 条目/13 运行映射、完整条目校验与十二脚本/入口只加载通过，但**包字节不同**：编译脚本条目、顺序/偏移、uid cache 等存在差异，不能称为可复现同字节构建，也不推断具体原因。59 份原始运行输入完全相同。另让镜像 `smoke_export.py` 对同一份最终规范源 PCK 再执行隔离探针，通过；证据 `tide-survey-canonical-pack-mirror-probe-20261121-090619-030258/summary.json`，因此最终规范源包已由两侧工具验证。所有探针只加载十二脚本和入口 PackedScene，不实例化 main、不运行游戏 EXE、不生成 ZIP。完整门禁及每份日志 SHA-256 索引：`tide-survey-integration-20261121/final-gates.json`。

## 源码同步

实施提交 **`6a5072a0d1c09bab276e46b18934f9a3fac281b4`**，树 **`505b9fcedc23b07c8b790fa023c84117cb79450f`**：只显式暂存 24 个桌面路径（23 个冻结差异加本记录），再次 fetch 确认远端后正常提交/推送，无强推。HTTP main ref、commit、完整未截断树 **503 个 blob** 与本地全部对象一致，**103/103** 桌面 HTTP 正文/清洗后 Git blob 及规范源/镜像原始字节逐份匹配。其余 **400** 个非桌面 blob 与 V61 最终基线 `0ce0523` 完全相同，包括根 LICENSE；没有重建或部署网页。

证据：`build/sync/stage-27-implementation.json`，相邻 `-tree.json` / `-commit.json`；批准 Temp `tide-survey-integration-20261121/implementation.json` 保存最终原始哈希与清洗后 blob。外部提交回执脚本在成功提交后因 `git diff-tree -rz` 组合参数不受支持而退出，失败记录 `implementation-commit-receipt-attempt-01.json` 保留；改用独立 `-r -z` 只读复核已存在的提交、父节点、精确路径及干净工作树，不重复提交或回退任何内容，随后正常 push 和远端读回通过。

本次只再更新本记录、`task-plan.md` 与 `tide-survey.md` 三份集成/证据文档；最终记录提交后复核完整树/全部桌面正文，结果只留本机 `build/sync/stage-27-final.json`，总证据入口 `build/sync/stage-27-evidence-index.json`，不递归追记自身 SHA。文档变更不改变 59 项已验收运行输入，不重跑或改写既有 QA/导出证据。

## 独立全程数字键验证（与两侧最终 QA 分开）

协调者补交的另一条独立 Temp 工作已完成；本集成者只读复核其最终回执、两份摘要、四份逐航 JSON、测试/执行器及原始冻结文件，未重跑、复制该测试或修改候选。位置：批准 Temp `stormline-tide-keyboard-20261121-954f34a0/evidence/final-receipt.json`，SHA-256 `6eda40f9f48732c2b5fabd3926aac7d706edd8522cc5359d3ea6f80c0ed4c39c`；宽水/较紧路线摘要 run ID 分别为 `20261121-090122-299169` / `20261121-090253-408246`。集成者接收复核与原始日志/档案哈希见 `tide-survey-integration-20261121/independent-keyboard-receipt.json`。

- 推进＋声纳、稳索＋声纳 × 原宽水/测试侧较紧返程，共 **四次完整六部署、各 178 项/0 失败、24 次真实持久交付和 24 次 fresh-main Store 重载**；每航每 tick 都由引擎内合成数字键经正式 `_physics_process` 轮询，导航每六 tick 保持离散输入，与相同数字输入的独立模型快照逐 tick 完全一致，不注入航程/资源/路径或放宽停泊。
- 四份逐航 JSON 实际共 **12 条制图航次、24 个有序 A/B 样本**；每样本持续 E 123 tick，真实距离 ≤13m、速度 <4m/s，之后真实扫描/挂索/双体入港 60 tick。不是交接口头数量 18 航/36 样本；采样完成速度实测约 0.820–1.369m/s。102/102 冻结白名单及 12 份运行脚本前后不变，隔离默认 profile 未写快玩/远征档。

| 指定数字键输入 | 第三海区制图后余电 | 六部署终局余电 | 第三海区制图＋主回收总用时 |
| --- | ---: | ---: | ---: |
| 推进＋声纳／宽水 | 12.9031% | 11.9177% | 329.3833s |
| 推进＋声纳／测试侧较紧返程 | 31.2772% | 35.6405% | 271.2000s |
| 稳索＋声纳／宽水 | 22.2085% | 22.8417% | 344.4167s |
| 稳索＋声纳／测试侧较紧返程 | 39.4098% | 42.0835% | 274.9500s |

较紧返程只在独立测试导航中使用 `(-45,-59) → (45,-45) → (54,-28) → (55,17)`，不是新增生产路线或修改正式地图；相同合法付费服务策略下，按原始 tick 精确重算，两种构筑的第三海区双航合计各少 **58.1833s / 69.4667s**，不是交接叙述的 58.00s / 69.94s。原候选连续 Pilot 的 2.13% / 20.22% 是不同指定输入下的制图交付余电，不能与数字键终局余电混为一项；全部都是指定输入可达性/取舍证据，不证明真人平衡或操作容错。

## 未执行与不能推出的结论

- 冻结候选和两侧最终共享 QA 的六航仍以连续 Pilot 输入为主，每条制图仅 120 tick 经正式数字键轮询；全航程数字键通过来自上节独立测试，不把它冒充已加入 36 项共享回归或本集成者重新执行的航次。两者均不是系统键鼠或真人操作。
- 第三海区宽水制图的推进＋声纳余电仅 2.13%，稳索＋声纳 20.22%；指定输入可达成不证明手感、容错或平衡合格，未穷举全部构筑/风险/压力/路线。
- 未运行或生成游戏 EXE/ZIP；无 GUI、截图、声音播放、浏览器自动化、Sites 部署、二进制发布或真实玩家目录访问；不执行 npm 重建、不改 V61、根 LICENSE 或网页存档。
