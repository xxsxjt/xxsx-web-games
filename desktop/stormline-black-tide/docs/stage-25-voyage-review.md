# 阶段 25：成功 / 失败航次复盘与独立集成

日期：2026-11-21；作品源码版本 **v0.1.3**。本阶段只安全收口已冻结成果，不扩网页作品数量。用户已要求后续转向 Stormline 成体系的远征、跨航次损伤、维修/改装、奖励与航路选择闭环；新系统在独立候选副本开发，不混入本阶段指纹或证据，保留旧三合同快玩。

## 玩家功能与旧版兼容

- 成功及失败结算都可用按钮或 V 展开本航次复盘，显示真实模拟时间、船/舱耐久损失、公开峰张和有证据的关键事件；原结算、重开、任务台与三合同仍保留。
- 最多保留 16 条节点（前 4 + 最近 12），区分累计采集与实际保留；内存数据不持久化，不提供录像/重放，不推断未取得的通知或单一失败因果。碰撞只计明确通知，不等于全部物理接触；封顶峰张显示“≥150%”。
- 六文件实现与文档已按实施者冻结 SHA-256 / Git blob 独立核对，集成者未改动。实现、五条自然航次及字段证据见 [实施记录](voyage-review.md)。不修改 `storm_sim`、`storm_records`、原三合同、Pilot、主档格式、备份或 sidecar。
- 自然航次逐 tick 与同输入独立模型一致：碎潮捷径成功 8064、针礁受损恢复成功 8231、卸载成功 8232、持续过载失败 4519、黑潮基础成功 4554。旧合同数据与固定输入基线、第三合同外绕 9204 仍由旧测试保护。成绩主档/备份/sidecar 的隔离夹具四份原始字节不因查看复盘而变。

## 集成范围与失败记录

- `project.godot` 与完整打包工具版本元数据为 0.1.3；本轮不调用完整 EXE/ZIP 打包入口。
- `tools/regression.py` 将 `voyage_review`、`voyage_review_app` 纳入必需门槛；每次正式运行创建独立应用数据及临时目录，所有 Godot 命令显式带 `--log-file`。诊断同时读取 stdout/stderr 与引擎日志，不过滤或放宽门槛。
- PCK 探针覆盖八个脚本（新增 `voyage_review.gd`）和入口 PackedScene。只读三合同常量，不再构造/步进模拟器；真实规则由完整总 QA 验证。探针不实例化主场景、不运行游戏 EXE。Python 自测还核验缺少复盘脚本的陈旧探针必须失败。
- 首轮完整 QA：`build/qa/20261121-054755-986859/summary.json`，Godot 部分均过，但 Python `smoke_tool` 失败，总退出 1，不能称整套通过。已独立复现：正式回归把 `TEMP` 隔离到源树 `build/`，正例临时探针因此被正确的“禁止源树内 scratch”守卫拒绝。只把正例夹具放到可自动清理的源树同级隔离目录，守卫和反例均保留；定向自测退出 0。最终完整重跑另记，不沿用失败结果。

## 白名单与验证登记

起点镜像 78 份普通文件；新增复盘模块、两套测试、实施说明和本文，最终白名单 83 份。仅同步既有跟踪文件及明确新增项，不重建或删除镜像；排除 `.godot`、`.buildtools`、`.testdata`、`build`、`__pycache__`、Git 数据与链接。所有本机日志、PCK 和隔离档案仅留本机，不纳入 Git；根 LICENSE 与第三方许可保留。

- 开发源最终命令 `python -X utf8 tools/regression.py --godot D:/AGENT/TOOLS/portable/godot/Godot_v4.3-stable_win64_console.exe` 退出 0，全部必需检查通过、0 诊断，47 项代码/配置指纹前后未变，隔离用户目录未产生最佳成绩文件。摘要 `build/qa/20261121-055347-834086/summary.json`；本机核验 `build/sync/stage-25-source-final.json`。
- 当前字节 PCK-only 命令为官方引擎 `--headless --audio-driver Dummy --path <开发源> --log-file <独立日志> --export-pack "Windows x86_64" <PCK>`，独立应用数据和临时目录，退出 0、0 诊断。PCK 367056 字节、21 项资源，SHA-256 `f0b99698fadda7dbbee3d971a6a9a9b555355f480c31ac85fe53b50319321fa1`；没有 EXE/ZIP，47 项指纹未变。命令、各资源校验及哈希在 `build/sync/stage-25-pack-final.json`，PCK 仅留本机 `build/pack-probe/stage-25-final-20261121-055557-936634/`。
- 开发源与镜像各自的 `tools/smoke_export.py` 对同一 PCK 均退出 0、0 诊断：八脚本和入口资源加载、三合同常量匹配、主场景未实例化、无成绩文件。证据分别为批准临时根下 `stormline-stage25-source-probe/stormline-pck-probe-8wf9cphi/smoke.json` 与 `stormline-stage25-mirror-probe/stormline-pck-probe-i72ortqk/smoke.json`；索引 `build/sync/stage-25-probes.json`。此检查不运行模拟器，不代替完整规则回归。
- 镜像使用同一完整 QA 命令退出 0，全部必需检查通过、0 诊断；摘要为总仓库下 `desktop/stormline-black-tide/build/qa/20261121-055528-253709/summary.json`。47 项指纹前后不变且与开发源逐项相同，隔离用户目录没有最佳成绩文件；全部 83 份原始字节一致，19 份阶段差异按白名单复制、无删除。文档补记后只复核文档和既有 QA 指纹，不冒称重新跑过整套。
- 本机初查白名单与修改前镜像哈希：`build/sync/stage-25-initial-whitelist.json`；定向复现及修复日志：`build/qa/stage25-smoke-{reproduction,corrected}/smoke.log`。

## GitHub 独立同步与读回

开发源、PCK 和镜像满足当前字节门槛后，仅显式暂存上述 **19 份桌面差异**，`git diff --cached --check` 退出 0；正常提交 **`b2e4b7ed885ab19be181924926689f9ccefba217`** 并推送既有 `origin/main`。提交前 fetch 后本地/远端均为 `da355904066a1ffea00b6f45d87614de2f9ec642`；未强推、未暂存网页源码、根工作单、V61 产物、本机日志/PCK、候选新系统或 LICENSE。

推送后 `ls-remote`、fetch、GitHub main ref 和 commit API 均确认该实现提交；远端树 **`dd799afda004bc2b07772f050c5599f2e794bd6e`** 的完整 **470 个 blob** 路径/模式/SHA 与本地提交一致。逐项读取该提交下 **83/83 桌面远端正文**，重新计算 Git blob，与远端树、本地对象、Git 清洗后的镜像一致；开发源和镜像原始字节也逐项相同。六份冻结实现与两侧 47 项 QA 指纹仍未变。证据 `build/sync/stage-25-github-implementation.json` 和相邻 `-tree.json`。

本节是实施提交后的独立记录；记录提交本身的最终 main/tree/83 正文读回登记于本机 `build/sync/stage-25-final.json`，避免在文档中自引用尚不存在的提交号。补记只复核文档与既有指纹，不声称又运行过整套 QA。

## 早期日志边界与未执行项

**实施者早期手工 headless 调用未显式设置 `--log-file`，默认引擎日志可能触及用户目录；实际位置与写入未核验。后续显式隔离不能追溯消除这一边界。这不是玩家成绩被修改的证据。** 不为此检查、删除或清理用户目录；成绩测试仅用隔离夹具。

未执行 GUI、Computer Use、浏览器自动化、截图、图形/真人试玩、OS 键盘输入或音频播放。未生成/运行游戏 EXE、未创建 ZIP、未发布二进制、未部署 Sites。PCK-only 是资源加载证据，不是可玩候选、真实渲染或操控验收。网页 V61 与候选复杂新系统的源码/测试均不计入本阶段。
