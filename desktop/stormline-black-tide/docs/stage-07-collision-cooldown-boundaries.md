# 阶段 07：碰撞冷却窗口边界

日期：2026-11-20。扩展阶段 04/05 的六处礁石确定性模型回归，验证低速接触、损伤冷却到期与合同重开的时序边界；未修改碰撞物理或 UI 行为。

## 覆盖

- 两实体以 0.3 m/s 向礁石轻触：只发生持续损伤，不发生冲击损伤，不生成冲击提示。
- 首次冲击后将双体移出危险范围，以实际 `Sim.step()` 推进 40 个固定步长；重新接触后拖船和尾舱各自冲击损伤冷却重新可用，碰撞提示冷却也到期。
- 触礁后 `reset(contract_id)`，再用新任务时钟进行同样碰撞：两套损伤冷却与提示节流状态全部清零。
- 与阶段 04/05 已有的安全边界、脱缆、双体同帧冲击、冷却窗内重复碰撞和致命损伤合并，`cargo_tow_test.gd` 现为六处礁石共 **166 项通过、0 失败**。

## 验证与候选

- 开发源完整 QA：`build/qa/20261120-133012-904257/summary.json`，13 项检查全部通过，退出码与诊断均为 0，源码指纹未变；`cargo_tow` 日志包含上述 166 项断言。总仓库镜像重跑摘要为 `desktop/stormline-black-tide/build/qa/20261120-133426-944376/summary.json`，13/13 同样通过，且与开发源指纹一致。
- Windows x64 v0.1.1 本机候选：`build/releases/20261120-133036-568701/Stormline-Black-Tide-v0.1.1-windows-x64/`，ZIP 位于同级目录。PE、18 项 PCK 条目及校验、ZIP CRC 和包内逐文件读回均通过，manifest 对应本阶段 QA。

| 文件 | SHA-256 |
|---|---|
| ZIP | `50af98e39e8f4553d0ace43892ccd5e2d0b9ee0441b0c9d8a838a75052598f9b` |
| PCK | `2fe060f35cc2cbec9f19b09bd8423aeaf5f4a010403dcab696361b9ce8fe45bc` |
| 官方 EXE 模板 | `66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13` |

- PCK-only 仓外探针报告保留于本机忽略文件 `build/evidence/stage-07-pck.json`。七个脚本、入口 PackedScene 资源与模型单步通过；未执行导出 EXE、未实例化主场景，也未验证渲染、音频或真人操作。

## 同步状态

待将本阶段显式白名单文件镜像至 `xxsxjt/xxsx-web-games` 的 `desktop/stormline-black-tide/`，镜像重跑相同 13 项 QA 后提交推送。只有 GitHub 分支、完整树及逐文件 blob 回读成功后，才写入本机忽略文件 `build/sync/stage-07.json` 并将本节更新为完成。

不启动图形窗口或导出 EXE、不实例化包内主场景；这不是渲染、音频或真人试玩验证。
