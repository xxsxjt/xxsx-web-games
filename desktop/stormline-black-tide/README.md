# 风暴线：黑潮回收 / Stormline: Black Tide

独立桌面 3D 拖带驾驶游戏，Godot 4.3 Compatibility。v0.1.0 含「黑潮回收」「针礁水道」两条任务；不属于网页总站，也不共享其存档或版本。

任务闭环：任务台选约 → 驶向搜索海区 → 低速扫描 → 挂索 → 管理功率、缆长与惯性带舱返航 → 船舱同时入港稳住 1 秒 → 结算并保存本机最佳。程序化场景和音效，不需要外部素材服务。

## 文档与证据

- 玩家启动与操作：`docs/quickstart.md`
- 尚未执行的桌面实测清单：`docs/manual-acceptance.md`（不阻塞后续自主开发）
- 开发、回归和交付边界：`docs/development.md`
- 收尾计划：`docs/task-plan.md`
- 本机无窗口证据：`build/qa/<时间戳>/summary.json` 及相邻日志。
- Windows 候选包：`build/releases/<时间戳>/`；EXE、独立 PCK、说明和校验随包放置。

## 开发与构建

依赖官方 Godot `4.3.stable.official.77dcf97d8` 和 Python 3.11+。模型以 60 Hz 固定步长驱动，场景/HUD/音效消费同一快照。回归数据仅写本项目 `.testdata/` 隔离目录，不写玩家成绩。

```powershell
python -X utf8 tools/regression.py --godot 'Godot_v4.3-stable_win64_console.exe'
```

通过后，将工具打印的 `summary.json` 路径传给构建脚本。`.buildtools/` 中需已有官方 4.3 模板包及其 Windows x64 release 模板；脚本重新校验官方 SHA-512、模板 SHA-256 和回归源码指纹，下载引擎许可文本，随后无窗口导出、检查 PE/PCK、制作 ZIP 并读回核验。不运行游戏。

```powershell
python -X utf8 tools/build_windows.py --godot 'Godot_v4.3-stable_win64_console.exe' --qa 'build/qa/<本次时间戳>/summary.json'
```

将 Godot 所在目录加入 PATH，或把示例中的可执行文件名换成完整本机路径。模板预设使用项目相对资源路径，无需沿用开发机目录。

## GitHub 阶段同步

用户于 2026-11-20 授权每完成一个阶段就更新现有 `xxsxjt/xxsx-web-games`，本作源码独立收录在 `desktop/stormline-black-tide/`。每阶段先验证，再提交/推送并回读远端文件树，保留已有 LICENSE 与历史。桌面目录不参与网页构建，不改变 V59 的网页入口和存档。

`build/`、`.buildtools/`、`.godot/`、`.testdata/` 不作为源码提交。不另建公共仓库、不自动发布二进制或重发网页站点。常规开发和验证由 Agent 自主继续，尚未执行的桌面实测如实保留，不再以等待用户操作为开发阻塞。
