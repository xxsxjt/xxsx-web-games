# 风暴线：黑潮回收 / Stormline: Black Tide

独立桌面 3D 拖带驾驶游戏，Godot 4.3 Compatibility。v0.2.9 在真实整备工单页并列「上航参考 / Last voyage」：实际付费开航后逐步测得整航，只有对应成功／失败结算保存入账后才替换上一份；可显示／收起、选整航或最近6个上航完成段、明确清除。仅本次运行内存，与当前／草案资源和所选真实报价分开，不预测成本／续航或自动整备。保留远征手动航段原生按钮及 J 开始／K 完成／L 取消，暂停和结算比较本航最近6段；实际返坞仍清空本航段，上航参考独立保留。行程、船体／电池净变、可用实耗与端点风／风暴不归因，无环境流读数，快玩不增加此功能。公开航路仍有船坞选线、驾驶台 N/B/C、实际船距／北基准方位与雷达空心航点；到点不完成目标。整备工单仍按原动作顺序投影、一次明确保存。三海区六部署的结构破口、耗电排水、低速临封、跨航次维修、实测制图、局部缓流、支线／风险和有限改装共同影响下一航次。原三合同快玩、成绩和航次复盘保留。本作不属于网页总站，不共享网页存档或版本；无登录、无联网依赖。

任务闭环：任务台选约 → 驶向搜索海区 → 低速扫描 → 挂索 → 管理功率、缆长与惯性带舱返航 → 船舱同时入港稳住 1 秒 → 结算并保存本机最佳。结算点击「航次复盘」或按 V 查看真实采集的用时、损失、公开峰张与关键事件；只保留本次航行的有限数据，不写档、不重放。程序化场景和音效，不需要外部素材服务。

远征由任务台 **X / 远征** 进入：新建档案 → 比较勘测/打捞与保守/冒险合同 → 付费配置推进/稳索/声纳（两槽、负载预算 3）→ 出航驾驶 → 持久结算 → 维修/充电/换装 → 后续部署 → 旗舰回收或明确撤退。勘测降低后续回收的海况/舱重并拓宽窗口；打捞即时多赚但后续更紧。船体/余电来自真实模拟，手动放弃按当前耗损另扣救援，不能靠 R 免费重开；快玩仍可自由 R 重开。独立远征档不会替代或迁移旧最佳成绩。

每海区的首部署还可选择**实测制图**：按顺序到 A、B 测站，在 13 米内、船速严格低于 4 m/s，持续按 E 完成取样，再扫描并拖舱交付。途中松 E 省电；松键、越界和超速只清零当前未完成样本。高航费和绕航换取同区主回收局部涡流 ×0.70（保守）／×0.60（冒险），不直接减弱基础漂流或风。未交付、保存失败或冲突都不取得持久收益。详见 `docs/tide-survey.md`。

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
- 阶段 15（全程离散按键的自然受损航次）：`docs/stage-15-needle-keyboard.md`
- 阶段 16（持键暂停/失焦、恢复与重开）：`docs/stage-16-held-key-lifecycle.md`
- 阶段 17（扫描/挂索/靠港操作反馈）：`docs/stage-17-interaction-feedback.md`
- 阶段 18（拖缆负载与风险反馈）：`docs/stage-18-tow-risk-feedback.md`
- 阶段 19（3D 拖缆标签状态同步）：`docs/stage-19-towline-visual-feedback.md`
- 阶段 20（阈值附近的反馈读数）：`docs/stage-20-threshold-readings.md`
- 阶段 21（场景标记可见状态生命周期）：`docs/stage-21-world-visibility-lifecycle.md`
- 阶段 22（正式应用 HUD/雷达/世界切屏一致性）：`docs/stage-22-presentation-lifecycle.md`
- 阶段 23（锁定目标标记跟随漂移舱体）：`docs/stage-23-live-contact-position.md`
- 阶段 24（碎潮回廊 / 三合同任务台 / 兼容成绩）：`docs/stage-24-cross-current.md`
- 阶段 25（成功/失败航次复盘 / 总 QA 与镜像）：`docs/stage-25-voyage-review.md`；实现及自然航次：`docs/voyage-review.md`
- 阶段 26（远征经营与真实驾驶闭环）：`docs/stage-26-expedition.md`；规则/档案、物理与正式应用证据：`docs/expedition-{state,simulation,interface}.md`。实施者文档冻结在候选验收时点，后续整合状态以阶段 26 记录为准。
- 阶段 27（实测制图 / 同区局部缓流）：`docs/stage-27-tide-survey.md`；玩法、冻结候选证据和余量边界：`docs/tide-survey.md`。规范源、镜像验证和源码同步以阶段 27 记录分别登记，不以候选通过替代。
- 阶段 28（进水损管 / 跨航次结构维修）：`docs/stage-28-damage-control.md`；操作、成本、旧档显式启用与真实规则：`docs/damage-control.md`。新建损管远征使用 G 排水、H 连续低速临封，旧档读入不静默改变玩法。
- 阶段 29（进水推进负载 / 油门电耗）：`docs/stage-29-flood-propulsion-load.md`；零水位 ×1.00，只放大油门推进项，不重算旧档或三合同规则；派生读数不新增持久字段。
- 阶段 30（耗电分账 / 带损返航反馈）：`docs/stage-30-energy-feedback.md`；上一固定步需求率与本航累计实际扣电分开，六项合计保留电量不足末步的比例分摊。自然触礁三策略只是指定输入程序对照，不代表最优策略或真人平衡。
- 阶段 31（坏档恢复 / 封堵门槛与提示 / 雷达截边）：`docs/stage-31-recovery-and-feedback.md`；主档接收上限仍为 98,304 字节，超限坏档仅在 1 MiB 保留容量内明确归档后恢复；H 同步前后速度均须严格低于门槛；图外标记不代表实际位置，真实距离不从钳制像素反推。QA / PCK 探针同时拒绝隔离目录内意外玩家档案。
- 阶段 32（可撤销的船厂整备工单）：`docs/stage-32-work-order.md`；原动作顺序投影与实际提交共用规则，最多12项、一次修订与存储，不替代原单项整备，不承诺返航可达性。
- 阶段 33（公开航点与手动导航）：`docs/stage-33-public-navigation.md`；公开字段纯投影、最多三点内存路线、原生备航／驾驶控件、船距／方位与独立雷达参考环，不泄露隐藏舱、不替代目标操作。
- 阶段 34（手动内存航段观察）：`docs/stage-34-voyage-segments.md`；实际逐步行程而非端点位移，电池净变与可选实耗分开；最多最近6段，不改模拟、目标或档案。
- 阶段 35（已入账上航参考与实际整备）：`docs/stage-35-voyage-reference.md`；一次已入账参考、独立整航实测、原生显示／选择／清除与原工单投影并列，失败待存不替换，无新持久字段。
- 碎潮回廊的流场编号、船舱边界读数与定向验证：`docs/cross-current-onboarding.md`
- 持续开发和验证计划：`docs/task-plan.md`
- 本机无窗口证据：`build/qa/<时间戳>/summary.json` 及相邻日志。
- Windows 完整候选包在单独的打包流程中生成，路径为 `build/releases/<时间戳>/`；阶段 26–35 仅 PCK-only，不生成游戏 EXE/ZIP、不发布二进制。

## 开发与构建

依赖官方 Godot `4.3.stable.official.77dcf97d8` 和 Python 3.11+。模型以 60 Hz 固定步长驱动，场景/HUD/音效消费同一快照。正式回归每次创建独立用户目录和明确引擎日志路径，成绩测试使用本项目 `.testdata/` 隔离夹具。早期手工调用的引擎默认日志边界见阶段 25 记录。

```powershell
python -B -X utf8 tools/regression.py --godot 'Godot_v4.3-stable_win64_console.exe'
```

仅在另行获准进行完整 Windows 打包时，将工具打印的 `summary.json` 路径传给构建脚本。`.buildtools/` 中需已有官方 4.3 模板包及其 Windows x64 release 模板；脚本重新校验官方 SHA-512、模板 SHA-256 和回归源码指纹，下载引擎许可文本，随后无窗口导出、检查 PE/PCK、制作 ZIP 并读回核验。构建器不运行游戏 EXE。以下打包命令不属于阶段 26/27 已执行项。

```powershell
python -X utf8 tools/build_windows.py --godot 'Godot_v4.3-stable_win64_console.exe' --qa 'build/qa/<本次时间戳>/summary.json'
```

当前必需四十七项 Godot 无窗口检查（导入与四十六套脚本）及 `smoke_tool`（Python 探针自测），共四十八项。原套件顺序不变，上航参考两套追加在航段之后；检查列表以 `tools/regression.py` 的 `REQUIRED_CHECKS` 为准。显式旧版本 oracle 对照另行运行、不要求普通源码检出带有历史夹具。规则夹具、模型输入旅程和正式场景/存储旅程分别登记。

导出后可用官方 Godot 的隔离无窗口脚本仅加载 PCK 资源。当前探针只读十六个脚本（含复盘、远征、损管、导航、航段与上航参考）、入口 PackedScene 和模拟脚本的三合同常量；不实例化主场景或运行模拟器、游戏 EXE。用户目录和日志隔离；不播放音频、不截屏、不验证真实渲染/操控。强制资源清单与实际加载集合均检查，陈旧 manifest/probe 不能一起遗漏新依赖后仍通过。

```powershell
python -X utf8 tools/smoke_export.py --godot 'Godot_v4.3-stable_win64_console.exe' --pck 'build/pack-probe/<本次目录>/Stormline-Black-Tide.pck' --sandbox-dir '<本机允许的临时目录>/stormline-pck-probe'
```

将 Godot 所在目录加入 PATH，或把示例中的可执行文件名换成完整本机路径。模板预设使用项目相对资源路径，无需沿用开发机目录。

## GitHub 阶段同步

用户于 2026-11-20 授权每完成一个阶段就更新现有 `xxsxjt/xxsx-web-games`，本作源码独立收录在 `desktop/stormline-black-tide/`。每阶段先验证，再提交/推送并回读远端文件树，保留已有 LICENSE 与历史。桌面目录不参与网页构建，不改变网页入口和存档。

`build/`、`.buildtools/`、`.godot/`、`.testdata/` 不作为源码提交。不另建公共仓库、不自动发布二进制或重发网页站点。常规开发和验证由 Agent 自主继续，尚未执行的桌面实测如实保留，不再以等待用户操作为开发阻塞。
