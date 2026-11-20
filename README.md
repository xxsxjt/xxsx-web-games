# XXSX Web Games

xxsx 的静态网页游戏总站与游戏源码总仓库。这里收录不同题材、不同系列和不同技术实现的游戏，不要求它们共享世界观、存档或成长系统；独立桌面作品放在 `desktop/`，不影响浏览器游戏站。

网页目录中的游戏以浏览器直接游玩为目标，优先适配手机，也支持桌面。站点无需登录和后端服务；有进度的游戏在本机存档，单关原型《叠印工单》不存档。

- [打开 XXSX 游戏站](https://neon-drift-roguelite.xxsxjt.chatgpt.site)
- [GitHub 总仓库](https://github.com/xxsxjt/xxsx-web-games)

## 源码收录

第一批游戏来自原 Neon Drift 站点。**Neon Drift / 霓虹突围是其中一款游戏，不是总站名称。** V51 建立独立总站：首页展示作品、类型筛选、收藏和最近打开，游戏在 `play.html` 按入口加载。V52 接入六张独立图标、十八关电路战役及战术警戒、掩护、推击和反应堆规则。V53 为原三款短局接入三层资源远征、九节点卡牌构筑与十二波塔防，并为射击新增三条构筑路线。V58 让《寄壳行动》和《借来的十秒》进入目录；V59 的源码与构建加入《叠印工单》A01，总计九款。站点部署状态单独记录。

| 游戏 | 类型 | 当前入口 |
| --- | --- | --- |
| 霓虹突围 · Neon Drift | 弹幕 Roguelite：十波战役 / 无尽；突击、反击、僚机路线 | `play.html#game/expedition` |
| 边境战术：失落站 | 三舱段小队战术：警戒 / 推击 / 反应堆 | `play.html#game/border` |
| 信号中继 | 塔防：三张地图 / 十二波 / 三类塔与网络升级 | `play.html#game/relay` |
| 回声实验室 | 卡牌：九节点 / 十二种牌 / 三位监守 / 研究与晶体 | `play.html#game/lab` |
| 深空打捞 | 探索：三层废舰 / 氧气与货舱 / 三种装备方案 | `play.html#game/salvage` |
| 黑盒解码 | 十八关电路战役 / 保留随机七层挑战 | `play.html#game/blackbox` |
| 寄壳行动 | 解谜：三舱段 / 四种壳体 / 双路线 | `games/shell-heist.html` |
| 借来的十秒 | 解谜：四房间 / 十拍回声 / 逐步同步 | `games/borrowed-seconds.html` |
| 叠印工单 | 解谜原型：A01 单关 / 预览与覆盖 / 无存档 | `games/overprint.html#level/01` |

原舰站集合的部分资源、委托和档案仍相互关联。新解谜、探索、卡牌与塔防战役使用各自的进度，不改写旧挑战记录或共享奖励；旧短局在同页可展开区域继续游玩。三款独立页面各用自己的界面和规则；旧 `play.html#game/shell` 与 `#station/shell` 书签仍会跳转到《寄壳行动》。

## 独立桌面作品

- 《风暴线：黑潮回收 / Stormline: Black Tide》：`desktop/stormline-black-tide/`，Godot 4.3 Compatibility，Windows x64 惯性拖带回收游戏，含两条任务、程序化 3D、雷达、音效和本机最佳成绩。
- 桌面源码不参与下述 npm 网页构建；运行、无窗口回归和导出方法见其 README。未验证的画面/手感/音频与已通过自动检查分开记录。
- 每完成并验证一个阶段即提交、推送并回读核验；不把源码同步等同于桌面二进制发行或网页站点部署。

## 网页开发

安装依赖并启动本地开发：

```sh
npm ci
npm run dev
```

构建并检查：

```sh
npm run build
npm test
```

构建会生成带内容哈希的资源、游戏目录和 `dist/release-manifest.json`；测试检查游戏机制、存档恢复和源文件与发布文件的一致性，因此修改代码后先构建再测试。`dist/` 可以由静态 HTTP 服务托管，不依赖服务器端 API。`npm run dev` 优先使用 Vite；未安装依赖时可用 Node 内置静态服务预览，构建与测试也仅使用 Node 内置模块。

## 源码结构

- `index.html`、`src/hub.*`：独立总站首页。
- `content/games.json`：九款作品的稳定 ID、入口、类型、操作与存档说明。
- `play.html`、`src/play-loader.js`：现有游戏页面与按入口加载。
- `games/*.html`、`src/{shell-heist,borrowed-seconds,overprint}.*`：独立游戏入口、规则和样式。
- `src/campaign-core.js`：三款新战役的行动保存、校验、备份及实时暂停；`src/salvage-expedition.js`、`src/echo-deck.js`、`src/relay-defense.js`：各自的状态模型与操作界面。
- `src/`：玩法、导航、档案和响应式样式；共享游戏适配层仍在逐步拆分。
- `assets/`：原始及发布用游戏美术资源。
- `dist/`：当前可部署的静态构建结果。
- `scripts/`：构建脚本。
- `tests/`：机制回归与静态发布校验。
- `docs/`：游戏说明、历次计划、验证记录与总站迁移计划。

V54 继续打磨决策与操作反馈：卡牌可蓄能并预估出牌结算，打捞可规划路线并预估氧气与护甲，塔防显示待入场队列和实际命中，并支持点地图选择炮位。三款战役新增旧页面写档冲突提示，仍沿用 V53 存档键。

本轮实现与实际验证见 [V54 发布记录](docs/release-v54.md)。战役基础见 [V53 发布记录](docs/release-v53.md)。前轮见 [V52 发布记录](docs/release-v52.md)；图标文件与完整提示词见 [V52 图标记录](docs/game-icons-v52.md)。总站基础见 [V51 发布记录](docs/release-v51.md)。后续完整路线见 [总站与游戏质量升级规划](docs/quality-upgrade-plan-2026-10-07.md)，包含现状证据、方案取舍、重点游戏升级、架构迁移和验收门槛。[V50 游戏集合说明](docs/neon-drift-v50.md)与[早期总站迁移计划](docs/game-hub-roadmap.md)保留作背景。

## 来源与同步

本次导入的原站点源码提交为 `77a2a90187369240d52c284912eefcc24cf053d2`，对应已发布的 V50。GitHub 保留仓库创建时的初始提交及许可证，游戏源码作为新的导入提交加入；此前的 Sites Git 历史没有导入 GitHub。

后续项目更新应同时维护此仓库和已发布站点，并验证两边使用同一份游戏源码。本次没有配置后台定时同步，详细执行规则见 `AGENTS.md`。

## 许可证

保留仓库创建时选择的 [GNU AGPL v3.0](LICENSE)。第三方来源记录见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

V56：新增《寄壳行动》等新作候选的可玩性筛选与竖切片验收标准。

V58：总站收录八款作品；《寄壳行动》完成三舱段双路线切片，《借来的十秒》完成四房间十拍回声切片；构建器增加历史发布资源固定清单、暂存失败保护和独立入口引用校验。见 [V58 发布记录](docs/release-v58.md)。

V59：《叠印工单》实现 A01，验证见 [V59 发布记录](docs/release-v59.md)，玩法和其他候选见 [V59 新游实验室](docs/new-game-lab-v59.md)；既有游戏扩展仍见[待办](docs/expansion-backlog-v59.md)。

V55：霓虹突围改为自动锁敌的自由战场，含四周围攻、经验吸取和补给站争夺。其他五款改进操作反馈。下一款《寄壳行动》已作为第七款竖切片上线；《借来的十秒》等后续方向仍见[设计方案](docs/new-game-concepts-v55.md)。
