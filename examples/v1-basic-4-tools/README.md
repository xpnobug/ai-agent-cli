# v1: Model as Agent

**核心理念：模型是 80%，代码是 20%**

## 关键洞察

Claude Code、Cursor Agent、Codex 的秘密？**没有秘密。**

去掉 CLI 的美化、进度条、权限系统，剩下的惊人地简单：**一个让模型持续调用工具直到任务完成的循环**。

## 4 个基础工具

Claude Code 有 ~20 个工具，但这 4 个覆盖了 90% 的用例：

| 工具 | 用途 | 示例 |
|------|------|------|
| `bash` | 运行任何命令 | `npm install`, `git status` |
| `read_file` | 读取文件内容 | 查看 `src/index.ts` |
| `write_file` | 创建/覆盖文件 | 创建 `README.md` |
| `edit_file` | 精确修改 | 替换一个函数 |

用这 4 个工具，模型可以：
- 探索代码库（`bash: find, grep, ls`）
- 理解代码（`read_file`）
- 做出修改（`write_file`, `edit_file`）
- 运行一切（`bash: python, npm, make`）

## Agent Loop

整个 agent 用一个函数表达：

```typescript
async function agentLoop(history) {
  while (true) {
    // 1. 询问模型
    const response = await client.messages.create({
      model: MODEL, system: SYSTEM,
      messages: history, tools: TOOLS
    })

    // 2. 打印文本输出
    for (const block of response.content) {
      if (block.type === 'text') console.log(block.text)
    }

    // 3. 如果没有工具调用，完成
    if (response.stop_reason !== 'tool_use') break

    // 4. 执行工具，继续
    const results = []
    for (const tc of toolCalls) {
      const output = await executeTool(tc.name, tc.input)
      results.push({ tool_use_id: tc.id, content: output })
    }

    history.push({ role: 'assistant', content: response.content })
    history.push({ role: 'user', content: results })
  }
}
```

**为什么有效：**
1. 模型控制循环（持续调用工具直到 `stop_reason != "tool_use"`）
2. 结果成为上下文（作为 "user" 消息反馈）
3. 内存自动（消息列表累积历史）

## 代码结构

**总行数：~320 行（含注释）**
**核心逻辑：~200 行**

```
index.ts
├── 配置 (20 行)
├── 工具定义 (40 行)
├── 工具实现 (100 行)
├── Agent 循环 (40 行)
└── 主函数 REPL (40 行)
```

## 安装

```bash
cd examples/v1-basic-4-tools
npm install
```

## 使用

```bash
npm start
```

## 缺少什么

| 特性 | 为什么省略 | 在哪里添加 |
|------|-----------|-----------|
| Todo 跟踪 | 不是必需的 | v2 |
| 子代理 | 增加复杂性 | v3 |
| 技能系统 | 高级特性 | v4 |

重点：**核心很小**。其他都是优化。

## 更大的图景

Claude Code、Cursor、Codex、Devin——都共享这个模式：

```typescript
while (!done) {
  response = model(conversation, tools)
  results = execute(response.tool_calls)
  conversation.append(results)
}
```

差异在于工具、显示、安全。但本质始终是：**给模型工具，让它工作**。

---

**Model as Agent. 这就是全部秘密。**
