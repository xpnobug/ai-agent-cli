#!/usr/bin/env node
/**
 * v0: Bash is All You Need
 *
 * 核心理念：一个工具 + 递归 = 完整 Agent
 *
 * 关键特性：
 * 1. 只有 1 个工具：bash
 * 2. 通过 bash 调用自身实现子代理
 * 3. 进程隔离 = 上下文隔离
 * 4. ~50 行核心代码
 *
 * 运行方式：
 * - 交互模式：node index.ts
 * - 子代理模式：node index.ts "explore src/"
 */

import Anthropic from '@anthropic-ai/sdk';
import { execa } from 'execa';
import * as readline from 'readline';

// 配置
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const BASE_URL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.MODEL_NAME || 'claude-sonnet-4-20250514';
const WORKDIR = process.cwd();

// 初始化 Anthropic 客户端
const client = new Anthropic({
  apiKey: API_KEY,
  ...(BASE_URL && { baseURL: BASE_URL }),
});

// 唯一的工具：bash
const TOOL = {
  name: 'bash',
  description: `Execute shell command. Common patterns:
- Read: cat/head/tail, grep/find/rg/ls
- Write: echo 'content' > file, sed -i 's/old/new/g' file
- Subagent: node ${__filename} 'task description' (spawns isolated agent, returns summary)`,
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
    },
    required: ['command'],
  },
};

// 系统提示词
const SYSTEM = `You are a CLI agent at ${WORKDIR}. Solve problems using bash commands.

Rules:
- Prefer tools over prose. Act first, explain briefly after.
- Read files: cat, grep, find, rg, ls, head, tail
- Write files: echo '...' > file, sed -i, or cat << 'EOF' > file
- Subagent: For complex subtasks, spawn a subagent to keep context clean:
  node ${__filename} "explore src/ and summarize the architecture"

When to use subagent:
- Task requires reading many files (isolate the exploration)
- Task is independent and self-contained
- You want to avoid polluting current conversation with intermediate details

The subagent runs in isolation and returns only its final summary.`;

/**
 * Agent 主循环
 */
async function chat(prompt: string, history: Anthropic.MessageParam[] = []): Promise<string> {
  // 添加用户消息
  history.push({
    role: 'user',
    content: prompt,
  });

  while (true) {
    // 1. 调用模型
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: history,
      tools: [TOOL],
      max_tokens: 8000,
    });

    // 2. 构建助手消息
    history.push({
      role: 'assistant',
      content: response.content,
    });

    // 3. 如果没有工具调用，返回文本
    if (response.stop_reason !== 'tool_use') {
      const textBlocks = response.content.filter((block) => block.type === 'text');
      return textBlocks.map((block) => (block as Anthropic.TextBlock).text).join('\n');
    }

    // 4. 执行所有工具调用
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const command = (block.input as { command: string }).command;
        console.log(`\x1b[33m$ ${command}\x1b[0m`); // 黄色显示命令

        try {
          // 执行命令
          const result = await execa(command, {
            shell: true,
            cwd: WORKDIR,
            timeout: 300000, // 5分钟超时
          });

          const output = (result.stdout + result.stderr).trim();
          console.log(output || '(empty)');

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: output.slice(0, 50000), // 截断
          });
        } catch (error: any) {
          const output = error.stdout || error.stderr || '(timeout or error)';
          console.log(output);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: output.slice(0, 50000),
          });
        }
      }
    }

    // 5. 添加工具结果到历史
    history.push({
      role: 'user',
      content: toolResults,
    });
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // 子代理模式：执行任务并输出结果
    const task = args.join(' ');
    const result = await chat(task);
    console.log(result);
  } else {
    // 交互模式：REPL
    console.log('🤖 v0: Bash is All You Need');
    console.log(`📁 Working directory: ${WORKDIR}`);
    console.log('Type "exit" to quit.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const history: Anthropic.MessageParam[] = [];

    const askQuestion = () => {
      rl.question('\x1b[36m>> \x1b[0m', async (input) => {
        const query = input.trim();

        if (!query || query === 'exit' || query === 'q') {
          rl.close();
          return;
        }

        try {
          const response = await chat(query, history);
          console.log(response);
          console.log(); // 空行
        } catch (error: any) {
          console.error('Error:', error.message);
        }

        askQuestion();
      });
    };

    askQuestion();
  }
}

main().catch(console.error);
