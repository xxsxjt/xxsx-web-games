# XXSX Web Games

xxsx 的静态网页游戏总站与源码总仓库。这里收录不同题材、不同系列和不同技术实现的网页游戏，不要求它们共享世界观、存档或成长系统。

所有游戏以浏览器直接游玩为目标，优先适配手机，也支持桌面。当前公开站点无需登录；当前收录的游戏使用本机存档，无后端服务。

- [打开 XXSX 游戏站](https://neon-drift-roguelite.xxsxjt.chatgpt.site)
- [GitHub 总仓库](https://github.com/xxsxjt/xxsx-web-games)

## 当前收录

第一批游戏来自原 Neon Drift 站点。**Neon Drift / 霓虹突围是其中一款游戏，不是总站名称。** V51 已建立独立总站：首页展示六款作品、类型筛选、收藏和最近打开，游戏在 `play.html` 按入口加载。原公开地址、舰站入口和本机存档继续可用。六款作品仍标注为测试版。

| 游戏 | 类型 | 当前入口 |
| --- | --- | --- |
| 霓虹突围 · Neon Drift | 弹幕 Roguelite：十波战役 / 无尽 | `play.html#game/expedition` |
| 边境战术：失落站 | 小队回合战术 | `play.html#game/border` |
| 信号中继 | 限时操作小游戏 | `play.html#game/relay` |
| 回声实验室 | 记忆小游戏 | `play.html#game/lab` |
| 深空打捞 | 打捞小游戏 | `play.html#game/salvage` |
| 黑盒解码 | 电路解谜 | `play.html#game/blackbox` |

这批游戏属于原舰站集合，部分资源、委托和档案相互关联。未来新增的独立游戏可以使用自己的界面、规则和存档，直接加入总站。

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
- `src/`：玩法、导航、档案和响应式样式；共享游戏适配层仍在逐步拆分。
- `assets/`：原始及发布用游戏美术资源。
- `dist/`：当前可部署的静态构建结果。
- `scripts/`：构建脚本。
- `tests/`：机制回归与静态发布校验。
- `docs/`：游戏说明、历次计划、验证记录与总站迁移计划。

本轮实现与实际验证见 [V51 发布记录](docs/release-v51.md)。后续完整路线见 [总站与游戏质量升级规划](docs/quality-upgrade-plan-2026-10-07.md)，包含现状证据、方案取舍、重点游戏升级、架构迁移和验收门槛。[V50 游戏集合说明](docs/neon-drift-v50.md)与[早期总站迁移计划](docs/game-hub-roadmap.md)保留作背景。

## 来源与同步

本次导入的原站点源码提交为 `77a2a90187369240d52c284912eefcc24cf053d2`，对应已发布的 V50。GitHub 保留仓库创建时的初始提交及许可证，游戏源码作为新的导入提交加入；此前的 Sites Git 历史没有导入 GitHub。

后续项目更新应同时维护此仓库和已发布站点，并验证两边使用同一份游戏源码。本次没有配置后台定时同步，详细执行规则见 `AGENTS.md`。

## 许可证

保留仓库创建时选择的 [GNU AGPL v3.0](LICENSE)。第三方来源记录见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
