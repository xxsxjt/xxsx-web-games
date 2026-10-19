# 交接文档 — xxsx-web-games

最后更新：2026-10-19 ｜ 维护者：pi-workspace 分支

## 一句话

**静态网页游戏总站与源码总仓库**。不同题材、系列、技术实现的网页游戏，不要求共享世界观。

## 路径（重要：有两层）

```
主仓库：  D:\Users\xxsx\orca\xxsx-web-games          ← Orca 项目在这里，git 主分支
工作树：  D:\Users\xxsx\orca\workspaces\xxsx-web-games\<name>   ← 五个 git worktree
```

Orca 项目 id：`github:xxsxjt/xxsx-web-games`

> ⚠️ **Orca 里注册的 `xxsx-web-games` 项目路径是主仓库，不是 `workspaces/` 下的目录。**
> `workspaces/` 下那五个是 git worktree，不是独立项目。

## 当前 worktree 一览

| worktree | 分支 | HEAD |
|---|---|---|
| 主仓库 `xxsx-web-games` | `main` | `84becad` V57: ship Shell Heist vertical slice |
| `workspaces/.../porcupinefish` | `xxsxjt/review-project-status` | `61e362f` |
| `workspaces/.../wasteland-core` | `xxsxjt/wasteland-core` | `c54c382` |
| `workspaces/.../wasteland-npc` | `xxsxjt/wasteland-npc` | `53be884` |
| `workspaces/.../wasteland-qa` | `xxsxjt/wasteland-qa` | `efca992` |
| `workspaces/.../wasteland-ui` | `xxsxjt/wasteland-ui` | `31c9301` |

主仓库 `main` 干净（0 dirty）。

## 主仓库结构

```
xxsx-web-games/
├── README.md              总说明
├── AGENTS.md              工作区规则
├── design.md              设计规范
├── THIRD_PARTY_NOTICES.md
├── index.html             站点入口
├── content/               游戏内容
├── assets/                素材
├── docs/
├── dist/                  构建产物
└── .hallmark              （构建标记）
```

## 公开入口

- 游戏站：https://neon-drift-roguelite.xxsxjt.chatgpt.site
- GitHub：https://github.com/xxsxjt/xxsx-web-games

## 版本演进（README 记录）

| 版本 | 内容 |
|---|---|
| V51 | 建立独立总站：首页六款作品、类型筛选、收藏、最近打开；`play.html` 按入口加载 |
| V52 | 六张独立图标、十八关电路战役、战术警戒/掩护/推击/反应堆规则 |
| V53 | 原三款短局接入三层资源远征、九节点卡牌构筑、十二波塔防；射击新增三条构筑路线 |
| V57 | Shell Heist vertical slice |

**注意**：Neon Drift / 霓虹突围是**其中一款游戏**，不是总站名称。

## 技术栈

- 纯静态：Vanilla JS + CSS，无框架
- 浏览器直接游玩，优先适配手机
- 本机存档，**无后端服务**
- 当前公开站点无需登录

## 已知问题

1. **五个 worktree 各占一个分支**，需要确认哪些还在活跃开发
2. **`wasteland-*` 四个分支**是同一套游戏的不同模块（core / npc / qa / ui），
   但它们是**独立 worktree 独立分支**，不是 monorepo 子包
3. **六款作品仍标注测试版**
4. 旧地址、舰站入口和旧本机存档需要继续兼容

## 迁移历史

2026-10-19 之前位置未变。本次整理只做了只读检查 + 写这份文档，**没有改动代码**。

## 开工前必读

1. **先确认你要改哪个 worktree** —— 五个目录对应五个分支
2. **不要引入后端**（当前设计是无服务端的）
3. **保持旧存档兼容**
4. 新游戏进 `content/`，遵循 `design.md`
5. 第三方素材要更新 `THIRD_PARTY_NOTICES.md`
