# v0: Bash is All You Need

**核心理念：一个工具 + 递归 = 完整 Agent**

## 关键洞察

Unix 哲学告诉我们：一切皆文件，一切皆可管道。而 bash 是这个世界的入口：

| 你需要 | Bash 命令 |
|--------|-----------|
| 读文件 | `cat`, `head`, `grep` |
| 写文件 | `echo '...' > file` |
| 搜索 | `find`, `grep`, `rg` |
| 执行 | `python`, `npm`, `make` |
| **子代理** | `node index.ts "task"` |

最后一行是关键：**通过 bash 调用自身，就实现了子代理机制**！

## 工作原理

### 子代理递归

```
主代理
  └─ bash: node index.ts "分析架构"
       └─ 子代理（独立进程，独立历史）
            ├─ bash: find . -name "*.ts"
            ├─ bash: cat src/main.ts
            └─ 返回摘要 → stdout → 父代理收到结果
```

**为什么这能工作？**

1. **进程隔离 = 上下文隔离**
   - 子进程有独立的 `history=[]`
   - 不会污染父进程的对话历史

2. **stdout = 结果返回**
   - 子代理的输出被父代理捕获
   - 作为工具结果返回

3. **递归调用 = 无限嵌套**
   - 子代理可以再调用子代理
   - 天然支持任意深度的任务分解

## 安装

```bash
cd examples/v0-bash-only
npm install
```

## 使用

### 交互模式
```bash
npm start
```

### 子代理模式（被其他代理调用）
```bash
node index.ts "explore the codebase and summarize"
```

## 代码结构

**核心代码：~150行（含注释）**
**核心逻辑：~50行**

```typescript
while (true) {
  response = await model(messages, tools)
  if (response.stop_reason !== "tool_use") return
  results = await execute_tools(response.tool_calls)
  messages.append(results)
}
```

这就是 Agent 的全部本质。

## 与 v3 的对比

| 机制 | v3 (Task 工具) | v0 (Bash 递归) |
|------|----------------|----------------|
| 代码行数 | ~900 行 | ~150 行 |
| 子代理实现 | Task tool | `node self 'task'` |
| 上下文隔离 | 独立 messages[] | 独立进程 |
| 工具过滤 | 白名单机制 | 无（bash 万能） |
| 进度显示 | SubagentProgress | 直接 stdout |

## 牺牲了什么

- 没有代理类型区分（explore/code/plan）
- 没有工具白名单（子代理也能写文件）
- 没有优雅的进度显示

## 得到了什么

- 极致简洁：~50 行核心逻辑
- 零额外概念：不需要理解 Task、Agent Registry
- 完整能力：读、写、搜索、执行、子代理

---

**Bash is All You Need.**
