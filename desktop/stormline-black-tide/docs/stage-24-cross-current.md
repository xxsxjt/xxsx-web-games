# 阶段 24：碎潮回廊、三合同接线与流场反馈

日期：2026-11-21。本阶段属于独立 Godot 桌面作品 v0.1.2，不升级网页 V59、不改网页入口或存档。源码冻结后完成总 QA、PCK-only 资源探针、开发源到仓库镜像核验，再独立提交与同步；图形试玩与二进制发布不是本轮交付。

## 实现与兼容范围

- 新增第三合同 `cross-current`，复用原模拟器而不改原两份合同的参数、物理与固定输入 120 秒自然基线。安全绕行与东流捷径分别经正式控制输入完成扫描、挂索和靠港；既有玩法与失败规则保留。
- 任务台从模拟器合同字典生成选择，支持 1/2/3；旧默认选择不变。第三合同最佳成绩使用 `.expansion.json` sidecar，旧 v1 主档及备份不加入新合同 ID，旧程序仍能读取旧两份成绩。
- 雷达将两处流场标为 1/2，HUD 对拖船与已披露舱体显示圈内/圈外/圈边及距离；未锁定舱不泄露位置。四份反馈实现/测试/文档按交接 SHA-256 冻结，集成人员未改写其内容。
- 反馈最小复现最初 5 项中 4 失败；第一版新增读数触发布局 720 项中的 3 处 dock 重叠，改为两条紧凑读数且仅本合同雷达高度调至 194 后消除，没有缩小字号。详见 `cross-current-onboarding.md`。
- `tools/regression.py` 将新 `cross_current_route_feedback` 纳入必需检查；当前为导入、26 套 Godot 脚本、Python `smoke_tool`，共 28 项。构建器仍从相同 `REQUIRED_CHECKS` 读取门槛，不放宽诊断、源码指纹或旧基线断言。
- PCK 探针仍不实例化入口场景，只加载 7 个脚本及入口 PackedScene 资源；新增三份合同逐一 reset/step 检查，防止遗漏第三合同或回退到默认合同。

## 清单口径与纳入理由

冻结交接初查时，开发源 **77 个**、镜像 **71 个**普通文件。清单包含根配置/说明、`src`、`scenes`、`tests`、`tools`、`docs`；明确排除 `.buildtools`、`.godot`、`.testdata`、`build`、`__pycache__`、Git 数据及链接，不扫描或复制玩家目录。镜像没有独有文件；当时差异 20 份（14 份修改、6 份新增），其余 57 份原始字节一致。不是“仅四文件更新”，也不删除或重建镜像目录。

| 初查差异文件 | 纳入理由 |
|---|---|
| `README.md` | v0.1.2、三合同说明、操作与 QA 入口 |
| `docs/breakwater-contract.md` | 第三合同路线、Pilot API 与自然航次证据（新增） |
| `docs/cross-current-onboarding.md` | 冻结流场反馈说明、首次失败及定向验证（新增） |
| `docs/manual-acceptance.md` | 更新第三合同待人工验收范围，不冒称已试玩 |
| `docs/quickstart.md` | 三合同操作与旧记录兼容说明 |
| `docs/task-plan.md` | 阶段完成边界与后续状态 |
| `project.godot` | 作品版本 0.1.2 |
| `src/main.gd` | 第三合同任务台数字键接线 |
| `src/radar.gd` | 冻结流场编号反馈 |
| `src/storm_hud.gd` | 三合同 UI、冻结流场读数与布局修复 |
| `src/storm_records.gd` | 新合同 sidecar、保留旧 v1 主档/备份兼容 |
| `src/storm_sim.gd` | 第三合同数据，原两合同基线保持 |
| `tests/breakwater_journey_test.gd` | 两条自然航线、旧合同字典/120 秒基线（新增） |
| `tests/cross_current_app_test.gd` | 应用结算、旧档字节与 sidecar 隔离（新增） |
| `tests/cross_current_route_feedback_test.gd` | 冻结边界、两条自然航次及生命周期 67 项（新增） |
| `tests/layout_test.gd` | 三合同四视口 720 项几何边界 |
| `tests/records_test.gd` | 新合同及旧记录恢复/写入隔离 |
| `tests/rule_threshold_language_test.gd` | 既有比较符、读数舍入和提示语义 29 项（新增） |
| `tools/build_windows.py` | 本阶段版本与共享 QA 必需门槛；本轮不调用 EXE 构建 |
| `tools/regression.py` | 收录第三合同与语言检查，并纳入冻结 route feedback |

集成期间另外修改 `tools/package_probe.gd`（PCK 三合同资源单步）并新增本阶段文档，因此最终源码清单为 **78 个**普通文件、相对原镜像 **22 份**阶段差异。完整相对路径与逐文件 SHA-256 另存本机 `build/sync/` 证据；不将缓存、PCK、构建包或原始日志纳入 Git。根 `LICENSE`、既有第三方许可和所有无差异项目文件保持不变。

## 验证与证据

官方引擎固定 `4.3.stable.official.77dcf97d8`；命令均为 CLI/headless，音频使用 Dummy。正式集成工具更新后重新运行全套，不沿用更新前结果。

- 首次集成 `python -X utf8 tools/regression.py --godot <官方控制台引擎>`：退出 0，28/28、0 诊断，44 项代码/配置指纹前后不变。摘要 `build/qa/20261121-030256-023644/summary.json`。该次发生在增强 PCK 探针之前，后续最终 QA 另记，不将其当作最终工具字节的验证。
- 首次 `--headless --audio-driver Dummy --export-pack "Windows x86_64" <本机PCK>`：退出 0、0 诊断，仅生成 PCK，18 条资源。`tools/smoke_export.py` 退出 0、0 诊断，7 脚本和入口资源加载成功、主场景未实例化、用户目录隔离、未产生最佳成绩。该次探针尚未增加三合同单步；最终探针结果在最终验证后追加。
- 自然航线与反馈检查：safe 9204 tick / 153.40 秒、shortcut 8064 tick / 134.40 秒；分别 365/327 次 HUD 采样、37/35 次挂索前舱体采样，捷径拖带阶段进入流圈 62 帧，逐 tick 模型与呈现读数一致。`breakwater_journey` 为 42/0，`cross_current_app` 为 21/0，route feedback 为 67/0。
- 旧呈现 125/0、交互 936/0、布局 720/0、显隐 93/0；`rule_threshold_language` 29/0。日志里的 `FAILURE cross-current timeout` 是被断言要求的自然超时失败情景，不是失败断言；该组最终 42/0，未过滤诊断或降低门槛。

### 最终当前字节与镜像验证

- 三合同 PCK 探针首次接入时，导入检查准确拦下 `valid` 的类型推断错误（引擎进程 exit 0，但 2 条诊断使总 QA exit 1），证据 `build/qa/20261121-030614-950217/summary.json`。仅将该工具变量显式标为 `bool` 后，重新运行完整总 QA；未改模拟器、冻结四文件或放宽断言/诊断检查。
- 开发源最终命令 `python -X utf8 tools/regression.py --godot D:/AGENT/TOOLS/portable/godot/Godot_v4.3-stable_win64_console.exe` 退出 0，**28/28、0 诊断、44 项代码/配置指纹前后未变**。摘要 `build/qa/20261121-030631-337590/summary.json`；运行器日志/命令登记 `build/sync/stage-24-source-final.json`。
- 镜像使用同一命令退出 0，**28/28、0 诊断、44 项指纹前后未变且与开发源相同**。摘要 `desktop/stormline-black-tide/build/qa/20261121-030850-398499/summary.json`（路径相对总仓库）；镜像本机记录为 `build/sync/stage-24-mirror-final.json`。
- 按明确 78 文件清单逐文件复制 22 份差异，未删除任何镜像文件；原始字节 SHA-256 **78/78** 一致。清单和修改前镜像哈希保留于开发源 `build/sync/stage-24-source-mirror.json`；最终文档登记后再次比对全部文件，不将 QA 缓存、玩家隔离档案或日志复制到 Git。
- 最终 `--headless --audio-driver Dummy --export-pack "Windows x86_64"` 退出 0、0 诊断；PCK 338128 字节、18 项资源，SHA-256 `de30cfbc487a2f6611f328e69d3fb45d8ee37360f46c930af8bcc2d8cf97725a`，只留在本机 `build/pack-probe/stage-24-final-20261121-030804-864699/`，未生成 EXE。命令/哈希记录 `build/sync/stage-24-pack-final.json`。
- 开发源与镜像分别运行 `tools/smoke_export.py` 验证同一 PCK，均退出 0、0 诊断：18 项静态校验通过、7 脚本和入口 PackedScene 可加载、三合同 reset/step 均正确、主场景未实例化、无成绩写入、独立用户目录。证据分别为 `C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-stage24-pck-probe/stormline-pck-probe-jdd_00nr/smoke.json` 和 `C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-stage24-mirror-pck-probe/stormline-pck-probe-9cpp9jgz/smoke.json`。该探针不是可玩包、真人试玩或发布证明。

## 未执行边界

未执行 GUI、截图、真实渲染观察、OS 键盘/真人试玩或音频播放；未生成/运行游戏 EXE，未创建 Windows ZIP 候选，未发布任何二进制或部署 Sites。网页打捞与余烬未冻结增量、网页测试配置准备改动及根集成工作单不纳入本桌面提交；不运行共享网页 build/test。
