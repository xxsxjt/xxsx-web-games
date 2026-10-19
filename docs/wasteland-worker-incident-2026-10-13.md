# Worker 并发编排事故记录 — 2026-10-13

## 背景

首次尝试用 Orca worktree 并发编排三个 Claude worker 构建废土杂货铺游戏。

## 出现的问题

### 1. 设计文档不在 worker worktree 里

**原因**：三个 worker worktree（wasteland-core/npc/ui）从 `main` 分支切出，而设计文档 `docs/wasteland-shop-design.md` 只存在于 `porcupinefish`（`xxsxjt/review-project-status`）分支，尚未合并到 main。

**后果**：每个 worker 的 Claude 读不到文件，产生幻觉路径（如 `\workspace\engineering\shen-j\...`、`/Users/luna-yang/...`），触发"读取工作目录外文件"权限弹窗卡死。

**修复**：手动 `cp docs/wasteland-shop-design.md` 到三个 worktree。

**预防**：并发任务开始前，先把所有依赖文件合并/同步到 main，或在 worktree create 时使用正确的 base-branch（含依赖文件的分支而非 main）。

### 2. Bypass Permissions 启动提示无法自动通过

**原因**：用 `--agent claude` 创建 worktree 时，Claude Code 启动会显示 Bypass Permissions 确认弹窗（交互式 TUI 菜单），`orca terminal send --text` 无法注入 TUI 按键选择。

**后果**：三个 worker 启动后立即卡在权限确认界面，需要用户手动在 Orca GUI 里操作。

**修复**：用户手动操作。

**预防**：
- 使用 `orca orchestration worker-start` 替代 `worktree create --agent`，它对权限模式有更好的控制
- 或预先在用户设置里配置 bypass 模式，避免每次新 worktree 都弹窗

### 3. Worker 反复尝试读取幻觉路径

**现象**：即使拒绝了第一个幻觉路径，Claude 会继续尝试读取其他幻觉路径（不同的随机编造路径），进入循环。

**根因**：工作目录内文件缺失，模型在找不到文件时产生路径幻觉而非报错。

**预防**：确保任务描述中的所有文件路径在 worker worktree 里实际存在后再发任务。

### 4. UI worker 仍有未处理的权限弹窗

**现象**：wasteland-ui 的 Claude 还在等"reads outside working directories are blocked"的确认（`find /Users/gateway63/...` 路径）。

**状态**：已 interrupt，等待重新发任务。

## 当前状态（事故结束时）

| Worker | 状态 | 产出 |
|--------|------|------|
| wasteland-core | 已中断，等待输入 | 无 |
| wasteland-npc | 已中断，等待输入 | 无 |
| wasteland-ui | 已中断，等待输入 | 无 |

设计文档已存在于三个 worktree 的 docs/ 目录。

## 下一步

1. 确认三个 worker 都已回到等待输入状态
2. 重新向每个 worker 发任务（文件已到位，这次不会再产生幻觉路径）
3. 监控进度，不再等 worker 主动通知（它们不会发 orchestration 消息，因为发送方式没有预先配置）
