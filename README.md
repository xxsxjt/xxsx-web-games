# XXSX Web Games

xxsx 的静态网页游戏总站与源码总仓库。这里收录不同题材、不同系列和不同技术实现的网页游戏，不要求它们共享世界观、存档或成长系统。

所有游戏以浏览器直接游玩为目标，优先适配手机，也支持桌面。当前公开站点无需登录；当前收录的游戏使用本机存档，无后端服务。

- [打开 XXSX 游戏站](https://neon-drift-roguelite.xxsxjt.chatgpt.site)
- [GitHub 总仓库](https://github.com/xxsxjt/xxsx-web-games)

## 当前收录

第一批游戏来自原 Neon Drift 站点。**Neon Drift / 霓虹突围是其中一款游戏，不是总站名称。** V51 建立独立总站：首页展示六款作品、类型筛选、收藏和最近打开，游戏在 `play.html` 按入口加载。V52 接入六张独立图标、十八关电路战役及战术警戒、掩护、推击和反应堆规则。V53 为原三款短局接入三层资源远征、九节点卡牌构筑与十二波塔防，并为射击新增三条构筑路线。原地址、舰站入口和旧本机存档继续可用；六款作品仍标注测试版。

| 游戏 | 类型 | 当前入口 |
| --- | --- | --- |
| 霓虹突围 · Neon Drift | 弹幕 Roguelite：十波战役 / 无尽；突击、反击、僚机路线 | `play.html#game/expedition` |
| 边境战术：失落站 | 三舱段小队战术：警戒 / 推击 / 反应堆 | `play.html#game/border` |
| 信号中继 | 塔防：三张地图 / 十二波 / 三类塔与网络升级 | `play.html#game/relay` |
| 回声实验室 | 卡牌：九节点 / 十二种牌 / 三位监守 / 研究与晶体 | `play.html#game/lab` |
| 深空打捞 | 探索：三层废舰 / 氧气与货舱 / 三种装备方案 | `play.html#game/salvage` |
| 黑盒解码 | 十八关电路战役 / 保留随机七层挑战 | `play.html#game/blackbox` |

原舰站集合的部分资源、委托和档案仍相互关联。新解谜、探索、卡牌与塔防战役使用各自的进度，不改写旧挑战记录或共享奖励；旧短局在同页可展开区域继续游玩。未来独立游戏可以使用自己的界面、规则和存档，直接加入总站。

## 开发

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
- `content/games.json`：六款作品的稳定 ID、入口、类型、操作与存档说明。
- `play.html`、`src/play-loader.js`：现有游戏页面与按入口加载。
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

V55：霓虹突围改为自动锁敌的自由战场，含四周围攻、经验吸取和补给站争夺。其他五款改进操作反馈。下一款《借来的十秒》仅为[设计方案](docs/new-game-concepts-v55.md)，尚未上线。
