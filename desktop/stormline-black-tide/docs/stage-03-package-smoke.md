# 阶段 03：模型边界与可复现 PCK 资源探针

日期：2026-11-20。阶段目标是规则边界、模拟输入健壮性，以及在不执行桌面游戏、不实例化主场景的前提下检验导出内容是否能被 Godot 读入。真实窗口、GPU、声音和人工操船仍不在本阶段的验证结论中。

## 问题与修复

- 新增 19 项靠港规则检查：黑潮测试逐项拒绝未挂索、船或舱越界、超速和张力达到上限的状态；两合同都检查精确港圈/速度边界、保持 59 tick 未完成与 60 tick 完成，以及短暂超速或张力达到上限后清零。全部通过。
- 加入模型输入数值保护。测试确认极大有限 power 值先转整型会溢出，NaN/Infinity 和非数字输入可能进入操纵状态；另发现放缆/收缆路径虽已限幅，电量扣除却继续转换原始输入，从而产生无效输入致电量归零或类型错误。现统一先将 throttle/steer/reel 归一到有限、-1..1 值；其他类型或非有限值视为零，绞盘耗电使用同一个安全值。Power 在限域后再转整数。非有限帧时长则在状态改变之前被丢弃。
- 新回归对绞盘输入注入 NaN、±Infinity、字符串、null、Vector2 与极大数值：修复前 12 项断言失败并出现类型转换错误；修复后异常输入与对应安全输入的耗电、缆长结果一致。

## 回归与候选

- `tests/robustness_test.gd`：27 项异常输入、长帧与错类型断言，加上两个合同各 5,000 个固定种子步长压力检查，总计 10,027 项。逐步验证模型量有限，船舱位置、耐久、电量及功率档位均有界。
- 最终摘要：`build/qa/20261120-122532-749707/summary.json`。九项 Godot 无窗口检查（`import/app/journey/records/audio/layout/input/docking/robustness`）和 Python `smoke_tool` 共十项全部通过，退出 0、无诊断。原有旅程仍通过：黑潮 4,554 tick、针礁 6,522 tick、主动断索 1,958 tick。
- `smoke_tool` 的三项 Python 自测覆盖缺失 PCK 时不启动子进程、文本/字节日志解码，以及只调用无窗口探针并隔离用户配置。

Windows x64 v0.1.1 本机候选：`build/releases/20261120-122605-094803/Stormline-Black-Tide-v0.1.1-windows-x64/`；同一级目录有同名 `.zip` 和 `.zip.sha256`。PE、PCK 的 18 项资源/校验值和 ZIP CRC/逐文件读回均通过；`BUILD-MANIFEST.json` 记录了对应的十项 QA。

| 文件 | SHA-256 |
|---|---|
| ZIP | `c34784a4dedae9cca5f16225dc27a8dc06126d996e41377a8fe689fa6bce60e0` |
| PCK | `823a39d8255bbe5925f59d8fca23ef79bd196c5dd45b44b613866eb20f0a2829` |
| EXE | `66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13` |

EXE 是与 v0.1.0 相同的未修改官方模板，游戏资源在独立 PCK；模板哈希不变不是启动验证。

## 安全加载探针的限制

`tools/package_probe.gd` 加载 standalone PCK、七个编译脚本和入口 PackedScene 资源、实例化不含场景/磁盘依赖的模拟器并推进一个 tick；它显式不启动主场景，也不启动导出 EXE。`tools/smoke_export.py` 仅启动本机官方 Godot 编辑器的 `--headless` 资源探针；各用户配置目录位于指定 scratch，每次新建隔离用户档。完整 PCK / remap 和 ZIP 读回由构建器校验。

v0.1.1 实测报告：`build/evidence/stage-03-v011-probe/stormline-pck-probe-w7pq_jtv/smoke.json`。18 项静态校验通过，七个脚本与入口资源均可加载，模拟器单步有效；退出 0、无诊断、未生成成绩文件。

探针成功只能证明 PCK 内脚本和入口资源可由相同 Godot 版本读取，并确认无场景模拟器能执行一步。它**不**等价于 EXE 运行，不测试 Windows 导出模板实际加载、不创建图形窗口、不作 GPU 渲染、不载入字体绘制、不播声音、不作真人输入或关卡体验验收。真实桌面实测仍待人工按 `docs/manual-acceptance.md` 执行。

不要复用 v0.1.0 的早期 EXE headless 启动记录为新版本包测试；该尝试已被更保守的 PCK-only 探针替代。

## GitHub 同步

源码同步目标为 `xxsxjt/xxsx-web-games` 的 `main`，范围仅 `desktop/stormline-black-tide/`。镜像 QA、GitHub 全树和项目逐文件回读以本机 `build/sync/stage-03.json` 为准（该文件在读回通过后生成，不入 Git）。候选包不进入 GitHub 或网页 `dist/`；源码同步不是网页部署或二进制发行。
