# 阶段 04：尾舱接触回归与探针隔离

日期：2026-11-20。本阶段新增确定性边界测试和构建验证工具防护，不改变两条任务的驾驶物理或存档格式。

## 检查与发现

- `tests/cargo_tow_test.gd`：两份合同、六处礁石，64 项通过。覆盖尾舱刚好在安全半径外不受损、擦碰推离与冲击/持续损伤、拖船无损、具体礁石提示、非致命碰撞保持返航，以及尾舱归零后失败且无成功报告。未系缆尾舱不进入拖带碰撞分支。
- 该测试直接构造模型接触状态，并非完整驾驶路线。最初使用世界坐标上的精确相切点时有两次浮点舍入导致轻微内穿；外侧用例改为离边界 0.0001 米，不将浮点表示误差误报为玩法修复。
- 完整 QA 曾因 probe 临时项目放在 `build/` 内触发嵌套 `project.godot` 警告。已保留并移出该临时项目；`tools/smoke_export.py` 现在在解析 PCK/启动进程前拒绝源码树内或候选包内的 scratch。
- Python `smoke_tool` 四项自测通过，包含源码树内 scratch 的拒绝用例。临时用户目录与成绩路径隔离。

## 无窗口证据与候选

- 开发源完整十一项 QA：`build/qa/20261120-124803-928784/summary.json`，全部退出 0、诊断 0，源码指纹未变。
- v0.1.1 Windows x64 候选：`build/releases/20261120-125438-727552/Stormline-Black-Tide-v0.1.1-windows-x64/`，相邻同名 ZIP。
- PE、18 项 PCK 资源校验值、ZIP CRC 与九个包内文件逐项读回通过。构建 manifest 的 QA 与开发源指纹匹配；包内启动和验收说明与源码一致。

| 文件 | SHA-256 |
|---|---|
| ZIP | `277f247f8eb686c6f8c3c0cb5f41a96ae5c4f1a9d66cbf1b973bb10b994661ef` |
| PCK | `c8cb70c32d6b0b6ada25129311199e659d1c3aa136a799045af75bafb5011b8b` |
| 官方 EXE 模板 | `66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13` |

PCK-only 报告已保留到 `build/evidence/stage-04-pck.json`；原始仓外日志位于 `C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-pck-probe-stage04-release/stormline-pck-probe-j2uc9t6e/`。七个编译脚本和入口 PackedScene 资源可读，无场景模拟器单步通过，退出 0、诊断 0、无成绩文件。

## 同步与验证边界

只同步明确白名单内的源码、测试、工具和文档到已有总仓库 `desktop/stormline-black-tide/`。镜像重跑同一十一项 QA；推送前 fetch，推送后读取 GitHub 分支与完整文件树，逐个项目 blob 比较开发源。只有成功读回才生成本机忽略文件 `build/sync/stage-04.json`；文档描述不代替该证据。

未执行导出 EXE、未实例化候选包的主游戏场景；未测试窗口、GPU、字体、音频播放、真人操控或体验。应用源码集成回归属于另一个无窗口测试层，不等于包启动验证。二进制仅在本机，没有二进制发行或网页站点部署；网页入口、存档及根 LICENSE 不变。
