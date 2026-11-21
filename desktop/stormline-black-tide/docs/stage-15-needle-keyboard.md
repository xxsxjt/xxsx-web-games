# 阶段 15：全程离散按键的自然受损航次

日期：2026-11-20。新增测试专用离散采样/按键驱动器 `tests/needle_keyboard_driver.gd` 和 `tests/needle_keyboard_test.gd`，注册完整 QA 并补充文档。没有修改生产输入、物理、合同、界面、音效或成绩规则。

## 测试方法

- 复用阶段 13 自然针礁路线，从原始合同开局实际扫描、挂索并驶入中央针礁，随后按恢复或持续过载策略驾驶，不瞬移、不修改资源、碰撞或报告。
- 油门、转向、收缆请求每 **6 tick / 100 ms** 采样，并用有余量累计的脉冲量化为 -1/0/1；相邻采样间保持不变。扫描、慢车、功率和挂索仍由当前路线请求决定，不声称所有按键都有 100 ms 的反应延迟。
- 导航/扫描/慢车/绞盘按键通过 `Input.parse_input_event()` 与 `Input.flush_buffered_events()` 更新 Godot 进程内按键状态；功率、Space、菜单和重开通过 viewport 的合成按键边沿处理。没有发送 Windows 输入，没有控制实际窗口。
- **每个导航 tick 均调用正式 `_physics_process(1/60)`**，让生产代码轮询 W/S/A/D 或方向键、E、Shift、Q/F 和 Space 队列；测试不直接调用 `_advance_simulation()`，也不修改应用模拟器。
- 独立模型、独立路线驾驶器及独立量化器以同样离散控制逐 tick 对照公开快照。该对照检查输入接线与采样，不是独立物理实现。
- WASD 和方向键各运行恢复与过载，共四航次。两种策略碰撞前/后公开快照必须完全相同；方向键别名与 WASD 的实际碰撞及终态逐项相同。
- 首次真实交付保存测试最佳，过载失败和重复交付均核对文件字节、重读排名及正常成绩提示。debrief 后保持推进/转向/收缆/扫描和 Space 不得重放结果；每航次后释放所有合成持有键。

## 定向结果

**49 项断言，0 失败。** 包括四航次逐 tick 模型一致性、六 tick 采样块保持、真实碰撞/交付/过载失败、存档和按键释放。

| 事件/终态 | WASD 与方向键均得到 |
|---|---|
| 扫描 / 挂索 / 实际撞中央针礁 | tick 1829 / 2869 / 4273 |
| 受损返港 | tick 8231，137.18 秒；船体 80.2、舱体 78.4、电量 42.5；双体低速低张力停泊 60 tick |
| 过载失败 | tick 4519，75.32 秒；真实断缆，峰值过载 1.0，无成功报告 |
| 输入及模型 | 所有导航 tick 与同离散控制模型一致，方向键与 WASD 碰撞及终态完全相同 |

航次输入序列不同于阶段 13/14 的连续控制，不要求与它们的 tick 或剩余资源相同。离散控制造成的额外受损真实保留至交付，不通过修改地图或降低损伤实现通过。

## 完整 QA、候选与同步

新增 `needle_keyboard` 纳入 `tools/regression.py`，完整 QA 从 17 项扩为 18 项。

- 开发源完整 QA：`build/qa/20261120-181638-431403/summary.json`，**18/18** 检查通过，退出 0、诊断 0，34 项代码/配置指纹不变。按键航次 49 项、自然生命周期 211 项、自然恢复 55 项、临港生命周期 335 项及终局优先级 693 项均通过。
- 镜像完整 QA：`desktop/stormline-black-tide/build/qa/20261120-182121-451725/summary.json`，同样 **18/18** 检查通过，退出 0、诊断 0；49/211/55/335/693 项定向结果一致。57 个项目文件逐字节匹配开发源，34 项代码/配置指纹与开发源及候选 manifest 相同。
- v0.1.1 Windows x64 本机候选：`build/releases/20261120-181724-358629/Stormline-Black-Tide-v0.1.1-windows-x64/`，ZIP 在同级目录。manifest 与上述 QA 指纹一致；官方模板 PE、18 项 PCK 条目/校验、ZIP CRC 与逐文件 round-trip 哈希通过。

| 文件 | SHA-256 |
|---|---|
| ZIP | `80b9cc7b1aa41aa0dbddab67134a213868bc8a27f4bdc666ba420c7771855054` |
| PCK | `ada982babbc09c48f519110bdada66b91e771833bb9fd6cb2979472d7801538c` |
| 官方 EXE 模板 | `66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13` |

仓外 PCK-only 探针：`C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-stage15/stormline-pck-probe-niw1nxlw/smoke.json`。18 项 PCK 校验、七个编译脚本和入口 PackedScene 资源读取、无场景模型单步通过，退出 0、诊断 0；隔离用户目录没有最佳成绩文件。

总站 `npm run build` 后 `npm test` 通过，`dist/` 无差异，首页 blob 保持 `f084b47f24ad3ca00c4bb1dd3f4a115b36da83c9`；未部署网页。命令输出保存在本机 `build/sync/stage-15-website-build.log` 和 `build/sync/stage-15-website-test.log`。

## 同步状态

开发源、镜像和候选验证完成，准备以七个明确白名单文件推送至既有 `xxsxjt/xxsx-web-games` 的桌面子目录；远端分支/完整树/逐 blob 回读尚未完成。最终本机证据使用 `build/sync/stage-15.json`，不上传候选、缓存或档案。测试成绩只写 `.testdata/needle-keyboard-*` 隔离目录并清理，不访问玩家档案。

## 验证边界

这是官方 Godot `--headless --audio-driver Dummy` 的进程内合成按键航次，证明指定脚本在每 100 ms 更新三轴数字控制时可达，但不能等同真人可操作性、反应时间、手感或难度验收。未启动图形游戏、播放音频或操作系统键鼠。候选仅静态检查和 PCK-only 资源探针，不运行导出 EXE、不实例化候选主场景，不发布二进制、不部署网页。
