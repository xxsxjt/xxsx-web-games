# 航次复盘（阶段 25）

## 实施前现状与证据口径

现有结算只显示终态、分数和资源读数，没有本航次事件时间线。`storm_sim.step()` 返回公开快照；`event_id` 每次 `_emit` 增加，但同一 tick 的后一次事件会覆盖 `event_kind/event`。碰礁通知还有船、舱共用的 0.54 秒节流，因此通知数量不是全部物理接触次数；终态 `collision` 类别也不证明又发生一次船/舱碰撞。

本功能不修改模拟器。可靠事实仅来自正式 `main` 每次模拟步后的快照：

- 已知 false→true 的 `scanned`、`tow_attached` 状态边沿，记录锁定和挂索的模拟时间；即使同 tick 通知被覆盖也不漏这两个状态事实。
- 新 `event_id` 且 `event_kind == collision`、文本明确以“船体碰撞：”或“舱体擦碰：”开头的通知。保留原通知作为证据，不从减速、耐久下降或距离猜测碰撞或礁石。
- 带载时公开 `tension >= 1.0` 的首次/再次进入、回到额定内，以及公开累计 `overload` 回落至零。张力回到额定内不等于累计风险已清零；断缆不记为卸载成功。
- `phase` 的成功/失败终态和 `fail_reason`。成功为真实靠港；不会提供重放、路线最优或单一原因判断。

事件跳号只报告有未取得的通知细节，不推测其种类、数量或原因，也不恢复其内容。复盘始终说明碰撞通知非全部接触；信息不足显示“未记录”，不编造起点、时刻或损失。时间只取 `time`，不累计墙钟/渲染 delta。峰值沿用公开封顶值，达到上限显示“≥150%”。

## 计划与写入边界

1. 新增纯数据、有界内存的 `src/voyage_review.gd`；正式 main 开航初始化、每物理步采集，重开/回简报/选合同清空。
2. HUD 只消费 main 生成的同一份 review view，在成功和失败结算提供紧凑的原生展开区域；保留既有字号与其余界面。
3. 不持久化复盘、不读旧玩家档案、不更改成绩格式/sidecar、模拟物理/阈值/终态优先级、合同和 Pilot。

## 验证计划

- 纯模块：有界保留、重复和逆序快照幂等、事件 ID 去重/跳号、同 tick 多事实稳定顺序、缺字段不伪造、峰值封顶、损失不作碰撞因果。
- 正式 main/HUD：任务台合法选择第三合同并用既有 Pilot 控制自然成功；既有针礁自然按键过载失败。逐 tick 与独立同输入模拟器比较，每条复盘事件逐项对照其当 tick 公开快照。
- 暂停/失焦/渲染重绘不增加时间或条目；R 重开、回简报/换三合同清理隔离；隔离成绩主档、备份和 sidecar 字节不因复盘改变。
- 官方 Godot 4.3 `--headless --audio-driver Dummy` editor import、新两套测试及 presentation_lifecycle、cross_current_app、cross_current_route_feedback、layout 等定向回归；四视口核对折叠/展开几何。无 GUI、截图、导出 EXE、ZIP、总 QA 或镜像。

## 实施与实测结果

### 已完成的玩家功能

- 正式 `main` 开航建立基准、每次 `sim.step` 后采集；不在 `_publish`、HUD 或墙钟回调记事件。终局 tick 先采集再发布，因此成功/失败结算首帧已有本次复盘。
- 结算原生按钮或 `[V]` 在原成绩概览与复盘之间切换，标题/终局原因/重开/任务台/声音/退出仍可用。复盘区是 218 设计像素高的原生滚动区，18 点字；没有缩小既有字号。
- 纯内存最多保留 16 节点：前 4 个关键节点加最新 12 个；显示“已采集 / 保留”和省略量。9 类计数、前一份固定 7 个标量、每事件最多 120 字，无输入历史/录像/重放/路径最优声明。`view()` 深复制可变数据。
- 用时取末次模拟时间减初始模拟时间；船/舱耐久损失取初始减当前，单位为“点”，不是碰撞归因；峰张来自公开 `peak_tension`，封顶显示 `≥150%`。缺数据为“未记录”。建议只对应已收到碰撞通知或实测过载门槛，不把剩余电量、峰张或锁定耗时解释成因果。
- 重新开航、R、回任务台和换约清空旧数据/折叠状态/滚动位置；无成绩字段、sidecar 或其他业务持久化新增，`storm_sim`/`storm_records`/三合同/Pilot 未改。

### 最终定向验证（2026-11-21）

引擎 `D:/AGENT/TOOLS/portable/godot/Godot_v4.3-stable_win64_console.exe --version` 返回 `4.3.stable.official.77dcf97d8`。以下为**13 项定向**，不是集成者负责的总 QA、导出或镜像验证；最终五个代码/测试文件在整组命令前后 SHA-256 相同。

共同前缀（PowerShell `&` 调用，下表参数追加到其后，日志文件均为绝对路径）：

```powershell
& 'D:/AGENT/TOOLS/portable/godot/Godot_v4.3-stable_win64_console.exe' --headless --audio-driver Dummy --path 'D:/AGENT/WORKSPACES/Projects/stormline-black-tide'
```

日志公共目录为 `C:/Users/xxsx/AppData/Local/Temp/opencode/`。每项**准确追加参数**为 `--log-file '<该目录><下表日志名>'` 加“入口参数”；因此每个命令都显式覆盖默认引擎日志路径。

| 项 | 入口参数 | 日志名 | 退出码 / 诊断 / 结果 |
|---|---|---|---|
| 导入 | `--editor --quit` | `stormline-stage25-import.log` | 0 / 0 / 成功 |
| 纯模块 | `--script res://tests/voyage_review_test.gd` | `stormline-stage25-voyage_review.log` | 0 / 0 / 21 检查 |
| 正式应用复盘 | `--script res://tests/voyage_review_app_test.gd` | `stormline-stage25-voyage_review_app.log` | 0 / 0 / 424 检查 |
| 呈现生命周期 | `--script res://tests/presentation_lifecycle_test.gd` | `stormline-stage25-presentation_lifecycle.log` | 0 / 0 / 125 检查 |
| 第三合同应用 | `--script res://tests/cross_current_app_test.gd` | `stormline-stage25-cross_current_app.log` | 0 / 0 / 21 检查 |
| 叠流反馈 | `--script res://tests/cross_current_route_feedback_test.gd` | `stormline-stage25-cross_current_route_feedback.log` | 0 / 0 / 67 检查 |
| 旧布局 | `--script res://tests/layout_test.gd` | `stormline-stage25-layout.log` | 0 / 0 / 744 检查 |
| 键盘 | `--script res://tests/input_test.gd` | `stormline-stage25-input.log` | 0 / 0 / 27 检查 |
| 原应用 | `--script res://tests/app_test.gd` | `stormline-stage25-app.log` | 0 / 0 / 50 检查 |
| 三合同自然基线 | `--script res://tests/breakwater_journey_test.gd` | `stormline-stage25-breakwater_journey.log` | 0 / 0 / 42 检查 |
| 原过载反馈 | `--script res://tests/tow_risk_feedback_test.gd` | `stormline-stage25-tow_risk_feedback.log` | 0 / 0 / 258 检查 |
| 阈值文案 | `--script res://tests/rule_threshold_language_test.gd` | `stormline-stage25-rule_threshold_language.log` | 0 / 0 / 29 检查 |
| 原成绩存储 | `--script res://tests/records_test.gd` | `stormline-stage25-records.log` | 0 / 0 / validation/roundtrip/ranking/recovery/storage failure 全通过 |

诊断筛选为 `SCRIPT ERROR`、`ERROR:`、`WARNING:`、`FAIL:` / `FAIL `。早期一次新应用测试因局部 `valid` 变量类型推断失败退出 1，改为显式 bool 后通过；另一次 PowerShell 汇总辅助调用不存在的 `Get-FileHash` 使外层退出 1（其中引擎均退出 0），已改用 Python `hashlib` 对最终整组重跑并核对。只以上表最终命令与最终指纹作为通过证据。

### 正式自然航次（逐 tick 同输入独立模型一致）

全由任务台选约、开航进入正式 main/HUD，未注入位置、HP、扫描/挂索标志或终态。第三合同与基础合同使用正式 `_advance_simulation` 合法控制边界；针礁三条使用既有量化 Driver、进程内合成按键和正式 `_physics_process` 轮询，不是 OS 键鼠。

| 航次 | 真实终态 tick / 模拟秒 | 船损 / 舱损（点） | 公开峰张 | 采集节点 |
|---|---|---|---|---|
| 碎潮捷径 | 成功 8064 / 134.400000000 | 0 / 0 | 0.453970998 | 锁定 42.833333333；挂索 59.633333333；真实靠港 |
| 针礁受损恢复 | 成功 8231 / 137.183333333 | 19.772850521 / 21.598277855 | 0.596287075 | 锁定 30.483333333；挂索 47.816666667；船碰撞通知 71.216666667；舱擦碰通知 76.166666667；靠港 |
| 针礁卸载 | 成功 8232 / 137.200000000 | 18.839517188 / 0.410991069 | 1.377052800 | 同前锁定/挂索/船通知；首次过载 73.783333333；额定内 74.166666667；累计风险清零 74.566666667；靠港 |
| 针礁持续过载 | 失败 4519 / 75.316666667 | 18.839517188 / 7.132090177 | 1.5（展示 ≥150%） | 同前锁定/挂索/船通知；首次过载 73.783333333；真实断缆失败 |
| 黑潮基础 | 成功 4554 / 75.900000000 | 0 / 0 | 0.453238641 | 锁定 13.600000000；挂索 28.616666667；靠港 |

新应用套件对**每条**复盘条目的时间、event_id 和具体证据字段核对当 tick 公开快照；最终用时/船损/舱损/峰张精确相等。保留第三合同 8064、针礁 8231/8232/4519、黑潮 4554 基线；旧回归另验证第三合同外绕 9204、旧合同完整数据与 120 秒自然状态未变。再次过载、同 tick 覆盖、通知跳号与缺字段为纯模块定向，不声称这五条自然航次都出现过这些情形。

测试在 `res://.testdata/review-<pid>-<ticks>/best.json` 注入已有更优成绩，三合同主档、`.bak`、`.expansion.json`、`.expansion.json.bak` 的 4 份字节在全部开航、结算、查看复盘、失败、重开和换约前后保持相同；仅清理本次隔离夹具。另由旧成绩测试核验原有正常新纪录写入路径，复盘不修改该路径。

在自然锁定/挂索/碰撞/过载/靠港采样处插入失焦暂停，并用 0、1/60、0.75、60 秒重复回调，模型与 review 不推进；恢复无追赶。成功/失败结算重绘不增条目；R、回简报和三合同切换隔离通过。四视口 1440×900、1280×720、960×600、1920×1080 对所有五条真实结算和一条 101 节点 UI-only 长记录夹具分别检查收起/展开、按钮界限与原生滚动可达建议；旧布局 744 检查无退化。

### 最终代码/测试指纹

以下五项在最终 13 项定向验证前后均未变，文档本身在验证后补入本结果：

| 相对路径 | SHA-256 |
|---|---|
| `src/main.gd` | `43cb53c005e3fbc86a7a89f47b3d69b23658e31392a44725da096e6778c8ee26` |
| `src/storm_hud.gd` | `f765d39ec5376aa2a837178751a1de4f09ab8b5d33e7ee2ed5724c13f1da2148` |
| `src/voyage_review.gd` | `0105a4507a497b0818a33082575a079242132e6ae3112cdbcb41d0ec7fd29683` |
| `tests/voyage_review_test.gd` | `06e746ca33f5075341253323d4a96822a3af1c88ee743bf4a14591dd5d7a09ee` |
| `tests/voyage_review_app_test.gd` | `f98e3126068ac1497317ccbd90fa04a6296dc7e93383ac2802d91e2539aefb16` |

### 限制、早期日志边界与交接

- **早期手工 headless 验证没有显式设置 `--log-file`，默认引擎日志可能写入用户目录；实际位置/写入情况未核验。最终隔离日志重跑不能追溯消除这一已发生边界，因此不声称全程绝无玩家目录写入。** 不为此读取、删除或清理用户目录；没有证据表明玩家成绩档被修改，亦不将“可能默认日志写入”扩大成此结论。
- 当前业务代码与已核调用路径不新增文件写入；所有已运行成绩测试均指定 `res://.testdata`，不读取旧玩家存档。该业务结论不覆盖上述引擎默认日志的早期未核验行为。
- 仅无窗口脚本/资源导入与 Control 几何；没有 GUI、截图、真实窗口、真人驾驶/视觉试玩、图形游戏客户端、导出 EXE/ZIP。长记录为 UI-only 夹具，不是伪造自然航次。
- 碰撞仅限明确的新通知，节流和被覆盖的细节不可还原；不提供完整接触计数/亚 tick 时序/因果归责/最短航路/重放。内存截断不是事件未发生；保留量与已采集总量分开。
- 本 worker 只改指定六文件，不写模拟器/成绩/radar/world/audio/旧测试/tools/通用文档/镜像/Git；总 QA、版本、镜像和远端同步交唯一集成者，不能据本定向验证声称已完成。
