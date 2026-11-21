# 阶段 20：阈值附近的反馈读数

日期：2026-11-20（本轮验证记录生成于 UTC 2026-11-21）。本阶段只调整 HUD 文本、headless 回归和说明；不改模拟规则、控制、场景位置、相机或存档格式。

## 变更

- 扫描尚未完成但百分数整数舍入会显示 100% 时改为 `<100%`。扫描速度边界按真实严格小于规则显示方向标记。
- 挂索距离、船速、相对速度，以及临港拖船/回收舱速度和拖缆张力仍使用一位小数；当舍入结果与规则阈值相同、真实值却在阈值另一侧时，添加 `<`、`>` 或 `≥` 标明方向。
- 普通读数及正好命中阈值的读数保持简洁，不增加容差，不改变“可按 Space 挂索”资格提示和绿色停泊判定。

## 定向回归

`tests/interaction_feedback_test.gd` 的定向断言增至 **936 项，0 失败**。覆盖两个合同、四种 viewport 尺寸、扫描 99.99%/严格速度门槛、挂索距离/船速/相对速度两侧舍入、停泊的船舱速度和严格张力门槛。

边界资格使用模型实际 `_attach()` 与 `_update_docking()` 交叉检查。原两条自然离散键盘航次保持不变：与独立模型逐 tick 快照一致，恢复交付 tick 8231，持续过载断缆 tick 4519；呈现调用不推进模型。原碰礁点 tick 4273 保持一致。

## 完整验证与范围

- Godot `4.3.stable.official.77dcf97d8` 开发源与镜像各自全套无窗口 QA：均 **22/22** 通过、0 诊断、38 项源码指纹一致。开发源摘要：`build/qa/20261120-222858-874634/summary.json`；镜像摘要：`desktop/stormline-black-tide/build/qa/20261120-222858-856724/summary.json`。两份 `interaction_feedback.log` 均为 936 项、0 失败。
- 总站 `npm run build` 和 `npm test` 通过；没有变更 `dist/`，没有部署网站。
- 本阶段未导出 Windows EXE/PCK 候选；未运行图形游戏、未启动导出 EXE、未使用桌面自动化、未触碰玩家成绩目录，也未真人试玩。3D 渲染、字体、实际桌面可读性仍未测。

## 阶段状态

阶段实现提交 `40a266ce0c9799025bd7e8b1a42d9cf833edf826` 已同步 GitHub `main`，基于 `473a939d3bf990c20d89df4637202be3605e3657`；回读记录由后续文档提交收录。**实现提交**的完整 GitHub 树 SHA 为 `15eff962e1fe17c6cc23d10d05736cb62d4f7174`，整仓 418 个 blob；`desktop/stormline-black-tide/` 66 个文件的 API blob 正文全部读回核验。实现后的文档提交与最终树单独记录于本机 `build/sync/stage-20.json`，不把实现树当作后续文档树。实现树证据：`build/sync/stage-20-github-tree-40a266c.json`、`build/sync/stage-20-project-blobs-40a266c.json`。最终同步核验还逐文件比较开发源、镜像工作树与 Git 清洗后的远端内容。`dist/`、网站源码和根 `LICENSE` 均未改动；没有部署网站或发布二进制。下一阶段候选仍见 `docs/task-plan.md`。
