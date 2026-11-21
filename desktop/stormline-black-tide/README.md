# 风暴线：黑潮回收 / Stormline: Black Tide

独立桌面 3D 拖带驾驶游戏，Godot 4.3 Compatibility。v0.1.1 含「黑潮回收」「针礁水道」两条任务，修复低分辨率界面与异常控制值；不属于网页总站，也不共享其存档或版本。原本机成绩目录与格式保持兼容。

任务闭环：任务台选约 → 驶向搜索海区 → 低速扫描 → 挂索 → 管理功率、缆长与惯性带舱返航 → 船舱同时入港稳住 1 秒 → 结算并保存本机最佳。程序化场景和音效，不需要外部素材服务。

## 文档与证据

- 玩家启动与操作：`docs/quickstart.md`
- 尚未执行的桌面实测清单：`docs/manual-acceptance.md`（不阻塞后续自主开发）
- 开发、回归和交付边界：`docs/development.md`
- 阶段 02（HUD / 键盘）：`docs/stage-02-interface-input.md`
- 阶段 03（规则边界 / 包资源加载）：`docs/stage-03-package-smoke.md`
- 阶段 04（六处礁石尾舱接触 / 探针路径防护）：`docs/stage-04-cargo-tow.md`
- 阶段 05（拖船/尾舱独立碰撞冷却）：`docs/stage-05-impact-cooldown.md`
- 阶段 06（擦礁后返航 / 致命碰撞存档隔离）：`docs/stage-06-impact-recovery.md`
- 阶段 07（碰撞冷却窗恢复与合同重置）：`docs/stage-07-collision-cooldown-boundaries.md`
- 阶段 08（持续擦礁与双体分时复碰）：`docs/stage-08-continuous-contact.md`
- 阶段 09（高风暴、低储备复合受损返航）：`docs/stage-09-compound-risk-recovery.md`
- 阶段 10（低资源成功/失败对照与存档保护）：`docs/stage-10-resource-boundaries.md`
- 阶段 11（停泊最终 tick 的耗尽/超时优先级）：`docs/stage-11-terminal-priority.md`
- 阶段 12（临港暂停/失焦、恢复与重开一致性）：`docs/stage-12-docking-lifecycle.md`
- 阶段 13（针礁水道自然触礁后返航）：`docs/stage-13-needle-recovery.md`
- 阶段 14（自然受损航次的暂停/失焦与重开）：`docs/stage-14-needle-lifecycle.md`
- 持续开发和验证计划：`docs/task-plan.md`
- 本机无窗口证据：`build/qa/<时间戳>/summary.json` 及相邻日志。
- Windows 候选包：`build/releases/<时间戳>/`；EXE、独立 PCK、说明和校验随包放置。

## 开发与构建

依赖官方 Godot `4.3.stable.official.77dcf97d8` 和 Python 3.11+。模型以 60 Hz 固定步长驱动，场景/HUD/音效消费同一快照。回归数据仅写本项目 `.testdata/` 隔离目录，不写玩家成绩。

```powershell
python -X utf8 tools/regression.py --godot 'Godot_v4.3-stable_win64_console.exe'
```

通过后，将工具打印的 `summary.json` 路径传给构建脚本。`.buildtools/` 中需已有官方 4.3 模板包及其 Windows x64 release 模板；脚本重新校验官方 SHA-512、模板 SHA-256 和回归源码指纹，下载引擎许可文本，随后无窗口导出、检查 PE/PCK、制作 ZIP 并读回核验。构建器不运行游戏 EXE。

```powershell
python -X utf8 tools/build_windows.py --godot 'Godot_v4.3-stable_win64_console.exe' --qa 'build/qa/<本次时间戳>/summary.json'
```

构建器要求十六项 Godot 无窗口检查（导入与十五套脚本）及 `smoke_tool`（Python 探针自测）；完整 QA 命令会自动执行这十七项检查，含终局优先级、临港生命周期、针礁触礁恢复及自然受损航次生命周期套件。

导出后可用官方 Godot 的隔离无窗口脚本仅加载 PCK 资源。下述探针不执行游戏 EXE、不实例化主场景，只加载七个编译脚本和入口 PackedScene 资源、对无场景模拟器单步校验。用户目录和日志隔离；不播放音频、不截屏、不验证真实渲染/操控。

```powershell
python -X utf8 tools/smoke_export.py --godot 'Godot_v4.3-stable_win64_console.exe' --pck 'build/releases/<时间戳>/Stormline-Black-Tide-v0.1.1-windows-x64/Stormline-Black-Tide.pck' --sandbox-dir '<本机允许的临时目录>/stormline-pck-probe'
```

将 Godot 所在目录加入 PATH，或把示例中的可执行文件名换成完整本机路径。模板预设使用项目相对资源路径，无需沿用开发机目录。

## GitHub 阶段同步

用户于 2026-11-20 授权每完成一个阶段就更新现有 `xxsxjt/xxsx-web-games`，本作源码独立收录在 `desktop/stormline-black-tide/`。每阶段先验证，再提交/推送并回读远端文件树，保留已有 LICENSE 与历史。桌面目录不参与网页构建，不改变 V59 的网页入口和存档。

`build/`、`.buildtools/`、`.godot/`、`.testdata/` 不作为源码提交。不另建公共仓库、不自动发布二进制或重发网页站点。常规开发和验证由 Agent 自主继续，尚未执行的桌面实测如实保留，不再以等待用户操作为开发阻塞。
