#!/usr/bin/env node
/**
 * v1: Model as Agent
 *
 * 核心理念：模型是 80%，代码是 20%
 *
 * 关键特性：
 * 1. 4 个工具：bash, read_file, write_file, edit_file
 * 2. 简单的 agent loop
 * 3. ~200 行核心代码
 * 4. 无 Todo、Task、Skill
 *
 * 这是所有 coding agent 的本质。
 */

import Anthropic from '@anthropic-ai/sdk';
import { execa } from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as readline from 'readline';

// 配置
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const BASE_URL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.MODEL_NAME || 'claude-sonnet-4-20250514';
const WORKDIR = process.cwd();

const client = new Anthropic({
  apiKey: API_KEY,
  ...(BASE_URL && { baseURL: BASE_URL }),
});

// 工具定义
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'bash',
    description: 'Run a shell command. Use for: ls, find, grep, git, npm, python, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read file contents. Returns UTF-8 text.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to file' },
        limit: { type: 'integer', description: 'Max lines to read (optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to file. Creates parent directories if needed.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path for file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace exact text in file. Use for surgical edits.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to file' },
        old_text: { type: 'string', description: 'Exact text to find' },
        new_text: { type: 'string', description: 'Replacement text' },
      },
      required: ['path', 'old_text', 'new_text'],
    },
  },
];

// 系统提示词
const SYSTEM = `You are a coding agent at ${WORKDIR}.

Loop: think briefly -> use tools -> report results.

Rules:
- Prefer tools over prose. Act, don't just explain.
- Never invent file paths. Use bash ls/find first if unsure.
- Make minimal changes. Don't over-engineer.
- After finishing, summarize what changed.`;

// 安全路径检查
function safePath(p: string): string {
  const fullPath = path.resolve(WORKDIR, p);
  if (!fullPath.startsWith(WORKDIR)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return fullPath;
}

// 工具实现
async function runBash(command: string): Promise<string> {
  // 基本安全检查
  const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot'];
  if (dangerous.some((d) => command.includes(d))) {
    return 'Error: Dangerous command blocked';
  }

  try {
    const result = await execa(command, {
      shell: true,
      cwd: WORKDIR,
      timeout: 60000,
    });
    const output = (result.stdout + result.stderr).trim();
    return output.slice(0, 50000) || '(no output)';
  } catch (error: any) {
    return error.message || 'Error executing command';
  }
}

async function runReadFile(filePath: string, limit?: number): Promise<string> {
  try {
    const fullPath = safePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    if (limit && limit < lines.length) {
      return lines.slice(0, limit).join('\n') + `\n... (${lines.length - limit} more lines)`;
    }

    return content.slice(0, 50000);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

async function runWriteFile(filePath: string, content: string): Promise<string> {
  try {
    const fullPath = safePath(filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    return `Wrote ${content.length} bytes to ${filePath}`;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

async function runEditFile(filePath: string, oldText: string, newText: string): Promise<string> {
  try {
    const fullPath = safePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }

    const newContent = content.replace(oldText, newText);
    await fs.writeFile(fullPath, newContent);
    return `Edited ${filePath}`;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'bash':
      return runBash(input.command);
    case 'read_file':
      return runReadFile(input.path, input.limit);
    case 'write_file':
      return runWriteFile(input.path, input.content);
    case 'edit_file':
      return runEditFile(input.path, input.old_text, input.new_text);
    default:
      return `Unknown tool: ${name}`;
  }
}

// Agent 主循环
async function agentLoop(history: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
    // 1. 调用模型
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages: history,
      tools: TOOLS,
      max_tokens: 8000,
    });

    // 2. 显示文本输出
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(block.text);
      }
    }

    // 3. 如果没有工具调用，结束
    if (response.stop_reason !== 'tool_use') {
      history.push({
        role: 'assistant',
        content: response.content,
      });
      break;
    }

    // 4. 执行工具
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`\n> ${block.name}: ${JSON.stringify(block.input).slice(0, 50)}...`);

        const output = await executeTool(block.name, block.input);
        const preview = output.slice(0, 200) + (output.length > 200 ? '...' : '');
        console.log(`  ${preview}`);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: output,
        });
      }
    }

    // 5. 添加到历史并继续
    history.push({
      role: 'assistant',
      content: response.content,
    });
    history.push({
      role: 'user',
      content: toolResults,
    });
  }
}

// 主函数
async function main() {
  console.log('🤖 v1: Model as Agent (4 Tools)');
  console.log(`📁 Working directory: ${WORKDIR}`);
  console.log('Type "exit" to quit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: Anthropic.MessageParam[] = [];

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const query = input.trim();

      if (!query || query === 'exit' || query === 'q') {
        rl.close();
        return;
      }

      history.push({
        role: 'user',
        content: query,
      });

      try {
        await agentLoop(history);
        console.log(); // 空行
      } catch (error: any) {
        console.error('Error:', error.message);
      }

      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
