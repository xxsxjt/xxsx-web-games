# 阶段 03：模型边界与可复现 PCK 资源探针

日期：2026-11-20。阶段目标是规则边界、模拟输入健壮性，以及在不执行桌面游戏、不实例化主场景的前提下检验导出内容是否能被 Godot 读入。真实窗口、GPU、声音和人工操船仍不在本阶段的验证结论中。

## 问题与修复

- 新增 19 项靠港规则检查：黑潮测试逐项拒绝未挂索、船或舱越界、超速和张力达到上限的状态；两合同都检查精确港圈/速度边界、保持 59 tick 未完成与 60 tick 完成，以及短暂超速或张力达到上限后清零。全部通过。
- 加入模型输入数值保护。测试确认极大有限 power 值先转整型会溢出，NaN/Infinity 和非数字输入可能进入操纵状态；另发现放缆/收缆路径虽已限幅，电量扣除却继续转换原始输入，从而产生无效输入致电量归零或类型错误。现统一先将 throttle/steer/reel 归一到有限、-1..1 值；其他类型或非有限值视为零，绞盘耗电使用同一个安全值。Power 在限域后再转整数。非有限帧时长则在状态改变之前被丢弃。
- 新回归对绞盘输入注入 NaN、±Infinity、字符串、null、Vector2 与极大数值：修复前 12 项断言失败并出现类型转换错误；修复后异常输入与对应安全输入的耗电、缆长结果一致。

## 回归与候选

- `tests/robustness_test.gd`：27 项异常输入、长帧与错类型断言，加上两个合同各 5,000 个固定种子步长压力检查，总计 10,027 项。逐步验证模型量有限，船舱位置、耐久、电量及功率档位均有界。
- 阶段 03 摘要：`build/qa/20261120-122532-749707/summary.json`。九项 Godot 无窗口检查（`import/app/journey/records/audio/layout/input/docking/robustness`）和 Python `smoke_tool` 共十项全部通过，退出 0、无诊断。原有旅程仍通过：黑潮 4,554 tick、针礁 6,522 tick、主动断索 1,958 tick。
- `smoke_tool` 的四项 Python 自测覆盖缺失/不安全位置在启动进程前拒绝、文本/字节日志解码，以及只调用无窗口探针并隔离用户配置；其中包含阶段 04 将 scratch 拦在项目根之外的回归。

阶段 03 初版候选保留为历史证据。阶段 04 全套 QA 对应的 v0.1.1 本机候选：`build/releases/20261120-125438-727552/Stormline-Black-Tide-v0.1.1-windows-x64/`，ZIP 为同目录下同名文件。PE、18 项 PCK 资源校验值与 ZIP CRC/逐文件读回通过，manifest 对应含 cargo_tow 的十一项 QA。后续候选与同步状态见 `docs/stage-04-cargo-tow.md` 及之后的阶段记录。

| 文件 | SHA-256 |
|---|---|
| ZIP（阶段 04 候选） | `277f247f8eb686c6f8c3c0cb5f41a96ae5c4f1a9d66cbf1b973bb10b994661ef` |
| PCK（阶段 04 候选） | `c8cb70c32d6b0b6ada25129311199e659d1c3aa136a799045af75bafb5011b8b` |
| EXE 模板 | `66b26ad96df7458ea917b632a73ac7c88bb058db24dbd11a457fd50435ab7b13` |

EXE 是与 v0.1.0 相同的未修改官方模板，游戏资源在独立 PCK；模板哈希不变不是启动验证。

## 安全加载探针的限制

`tools/package_probe.gd` 加载 standalone PCK、七个编译脚本和入口 PackedScene 资源、实例化不含场景/磁盘依赖的模拟器并推进一个 tick；它显式不启动主场景，也不启动导出 EXE。`tools/smoke_export.py` 仅启动本机官方 Godot 编辑器的 `--headless` 资源探针；各用户配置目录位于指定 scratch，每次新建隔离用户档。完整 PCK / remap 和 ZIP 读回由构建器校验。

阶段 04 候选的 PCK-only 探针报告已保留为本机忽略文件 `build/evidence/stage-04-pck.json`；原始日志在 `C:/Users/xxsx/AppData/Local/Temp/opencode/stormline-pck-probe-stage04-release/stormline-pck-probe-j2uc9t6e/`。18 项静态校验、七个脚本、入口资源和模拟器单步均通过；退出 0、无诊断、未生成成绩文件。临时 Godot 项目位于仓库外。

探针成功只能证明 PCK 内脚本和入口资源可由相同 Godot 版本读取，并确认无场景模拟器能执行一步。它**不**等价于 EXE 运行，不测试 Windows 导出模板实际加载、不创建图形窗口、不作 GPU 渲染、不载入字体绘制、不播声音、不作真人输入或关卡体验验收。真实桌面实测仍待人工按 `docs/manual-acceptance.md` 执行。

不要复用 v0.1.0 的早期 EXE headless 启动记录为新版本包测试；该尝试已被更保守的 PCK-only 探针替代。

## GitHub 同步

阶段 03 核心实现已在 `xxsxjt/xxsx-web-games` 的 `main` 提交 `7ed96349d576f0768354a374a9be40394712b0b9` 同步；阶段 04 后续新增尾舱礁石回归和 scratch 路径防护。阶段 04 镜像与远端逐文件回读使用本机忽略文件 `build/sync/stage-04.json` 留证，只在回读通过后生成；本文件不代替该证明。候选包不进入 GitHub 或网页 `dist/`；源码同步不代表网页部署或二进制发行。

阶段 04 对两条合同的六处礁石增加尾舱擦碰/损伤/失败检查：安全半径、刚好外侧、擦碰推离、损伤与反馈、拖船是否无损、脱缆尾舱是否被误处理以及尾舱致命损坏后任务是否失败。`tests/cargo_tow_test.gd` 当前 64 项通过。这些为模型边界测试，不等于完整操船路线或画面测试。
