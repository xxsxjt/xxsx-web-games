# 阶段 19：3D 拖缆标签状态同步

日期：2026-11-20（验证记录生成于 UTC 2026-11-21）。本阶段继续只改呈现、无窗口测试和说明，不改模型规则、缆绳几何/动力学、相机、位置坐标或存档。

## 变更

- 标签读取与 HUD 同一 `tension` / `overload` 快照，分别表达 `MONITOR`、`OVERLOAD / RISK ACCUM` 与 `RISK FALLING`；回落状态使用独立紫色标签。绳体颜色和闪光仍只表示当前额定负载，不被历史风险残值点亮成当前过载。
- 实时张力低于 100% 但一位小数格式会舍入为 100% 时，改显示 `<100%`；达到张力快照上限显示 `≥150%`。风险小值与接近 100% 的舍入也使用边界写法，不显示虚假的零值或满值。
- 脱缆时清除标签文字、隐藏标签并关闭绳灯，避免终态保留前一帧拖缆信息。
- 不把风险比例换算成固定断缆秒数，不改变任何模拟值或输入。

## 测试与边界

`tests/towline_visual_feedback_test.gd`：**98 项断言、0 失败**。使用 Godot `--headless` 将程序化场景节点加入场景树，仅检查两个合同的 Label3D、缆绳材质颜色、灯能量、标签显隐和调用前后快照字典；不执行 3D 渲染。包含 40%/72%、99.99%/100%、135%/150% 上限、非零风险、卸载残险、风险清零和脱缆快照；这些是合成呈现夹具，不冒充自然航次。

已有 `tow_risk_feedback` 的两条输入自然航次加入 `_matches_world`：每次风险采样同时检查 3D 标签是否依据当前负载显示累积/回落、封顶值是否标下界、脱缆时是否清除，以及呈现前后模拟器快照相同。258 项仍全部通过、`feedback_mismatch=0`；卸载/持续过载分支终态仍为 tick 8232 交付、tick 4519 断缆，没有注入位置、资源、天气或成功状态。

开发源完整 QA：`build/qa/20261120-201930-279137/summary.json`，**22/22** 通过，38 项代码/配置指纹不变、退出/诊断皆为 0。定向节点检查和自然航次日志与摘要同目录保存。Windows x64 v0.1.1 同源码候选位于 `build/releases/20261120-202212-927355/Stormline-Black-Tide-v0.1.1-windows-x64/`；PE、18 项 PCK 和 ZIP 校验通过，manifest 与 38 项指纹一致。ZIP SHA-256：`f5dae3530f236c18c82f4b786ca04fc7db8c361fb5218c27f55e95b3b00bb901`；PCK SHA-256：`2bb0eb007242b3c4a10e72d39cf8697ce35cc0d9111d4b674811c7c08110369f`。仓外 PCK-only 探针 `C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-stage19/stormline-pck-probe-ev_dhalb/smoke.json` 退出 0、诊断 0，未运行 EXE、未实例化候选主场景、未创建成绩文件。

总站 `npm run build` 和 `npm test` 通过；网页源码、`dist/` 与根 `LICENSE` 未变，没有部署网页。镜像完整 QA：`desktop/stormline-black-tide/build/qa/20261120-202336-100114/summary.json`，22/22 通过、38 项指纹一致。

本项仅是 headless 场景节点状态核验，不能证明摄像机视角下标签可读、实际字体/渲染、3D 色彩可辨或性能。没有启动图形游戏、运行导出 EXE、桌面自动化或真人试玩。

## 阶段状态

GitHub `main` 已收到提交 `0491ff86b66383272953746efe0eea99497c3ea8`。整仓完整树 417 blob 与提交树一致；GitHub API 逐项返回的 65 个项目 blob 正文与提交对象一致（文本由 Git 清洗过滤器规范化后核对），同时开发源与镜像工作文件逐字节匹配。完整证据见 `build/sync/stage-19.json` 及同目录 tree/blob 明细。该修复与阶段 18 HUD 风险显示配套，但保持模拟器规则不变；不发布二进制或部署网页。
