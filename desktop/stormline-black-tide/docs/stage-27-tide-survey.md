# 阶段 27：实测制图与同区局部缓流

日期：2026-11-21；独立桌面源码 **v0.2.1**。冻结候选已接入规范源及桌面镜像，两侧最终完整 QA、PCK-only 与资源加载均通过；GitHub 提交/读回仍待执行，不以本地验证替代。三合同快玩、旧成绩及 v1 远征格式保留；V61 网页版本不改动，本阶段不是二进制发行或真人验收。

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

本地最终验证已通过；待仅显式暂存 24 个桌面路径（23 个冻结差异加本记录），正常 fetch/commit/push，不强推。随后验证 HTTP main ref、commit、完整未截断树与本地全部 Git 对象一致，每份桌面 HTTP 正文对应清洗后 Git blob，并逐文件比较规范源/镜像原始字节；证明非桌面树与 V61 最终基线不变。实施读回通过后只增加一次最终状态记录提交，最终回执留本机 `build/sync/`，不递归追记文档提交。

## 未执行与不能推出的结论

- 本轮两种构筑的正式 main/真实隔离 Store 六航是连续 Pilot 输入为主，每条制图仅 120 tick 经正式数字键轮询；不冒称全航程键盘或真人通过。全程数字键评估属于另一条独立 Temp 工作，本记录不将其计为通过。
- 第三海区宽水制图的推进＋声纳余电仅 2.13%，稳索＋声纳 20.22%；指定输入可达成不证明手感、容错或平衡合格，未穷举全部构筑/风险/压力/路线。
- 未运行或生成游戏 EXE/ZIP；无 GUI、截图、声音播放、浏览器自动化、Sites 部署、二进制发布或真实玩家目录访问；不执行 npm 重建、不改 V61、根 LICENSE 或网页存档。
