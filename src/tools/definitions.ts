/**
 * 工具定义 - JSON Schemas
 * 定义所有可用工具的名称、描述和参数结构
 */

import type { ToolDefinition, AgentType } from '../core/types.js';
import { AGENT_TYPES, getAgentTypeDescriptions } from '../core/agents.js';
import { DEFAULTS } from '../core/constants.js';

// 1. Bash 工具
export const BASH_TOOL: ToolDefinition = {
  name: 'bash',
  description: `在工作目录中执行 bash 命令。

功能:
- 运行任何 shell 命令（ls、git、npm、grep 等）
- 输出被截断为 50MB
- 命令超时 ${DEFAULTS.bashTimeout / 1000} 秒

使用建议:
- 运行非平凡命令时，先解释命令的作用
- 避免运行交互式命令
- 避免运行长时间运行的命令（如 npm run dev）
- 对于文件搜索，优先使用 Glob 和 Grep 工具`,
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 bash 命令',
      },
    },
    required: ['command'],
  },
};

// 2. 文件读取工具
export const READ_FILE_TOOL: ToolDefinition = {
  name: 'read_file',
  description: `读取文件内容。

功能:
- 读取任何文本文件
- 可选择限制读取行数
- 自动检测文件编码

使用建议:
- 编辑文件前先读取以了解内容
- 批量读取多个相关文件以获取上下文
- 对于大文件，使用 limit 参数限制行数`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径（相对于工作目录）',
      },
      limit: {
        type: 'number',
        description: '最多读取的行数（可选）',
      },
    },
    required: ['path'],
  },
};

// 3. 文件写入工具
export const WRITE_FILE_TOOL: ToolDefinition = {
  name: 'write_file',
  description: `创建或覆盖文件。

功能:
- 创建新文件或完全覆盖现有文件
- 自动创建父目录
- 支持任何文本内容

使用建议:
- 用于创建新文件
- 对于修改现有文件，优先使用 edit_file
- 写入前确认文件路径正确`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径（相对于工作目录）',
      },
      content: {
        type: 'string',
        description: '文件内容',
      },
    },
    required: ['path', 'content'],
  },
};

// 4. 文件编辑工具
export const EDIT_FILE_TOOL: ToolDefinition = {
  name: 'edit_file',
  description: `编辑现有文件，精确替换指定的文本。

功能:
- 精确匹配并替换文本
- 保持文件其他部分不变
- 支持多行文本替换

关键要求:
- old_text 必须与文件中的内容**完全匹配**（包括空格和换行）
- 如果匹配失败，检查空格、缩进和换行符
- 对于同一文件的多处修改，可以多次调用此工具`,
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径（相对于工作目录）',
      },
      old_text: {
        type: 'string',
        description: '要替换的原文本（必须精确匹配）',
      },
      new_text: {
        type: 'string',
        description: '替换后的新文本',
      },
    },
    required: ['path', 'old_text', 'new_text'],
  },
};

// 5. Glob 文件搜索工具
export const GLOB_TOOL: ToolDefinition = {
  name: 'Glob',
  description: `快速文件模式匹配工具。

功能:
- 支持 glob 模式（如 **/*.ts, src/**/*.tsx）
- 按修改时间排序返回结果
- 自动忽略 node_modules、.git 等目录

使用场景:
- 查找特定类型的文件（如所有 TypeScript 文件）
- 查找特定名称模式的文件
- 探索项目结构

示例:
- "**/*.ts" - 所有 TypeScript 文件
- "src/**/*.test.ts" - src 目录下所有测试文件
- "**/package.json" - 所有 package.json 文件`,
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob 模式（如 "**/*.tsx", "src/**/*.ts"）',
      },
      path: {
        type: 'string',
        description: '搜索路径（可选，默认为工作目录）',
      },
      ignore: {
        type: 'array',
        items: { type: 'string' },
        description: '额外的忽略模式（可选）',
      },
      maxResults: {
        type: 'number',
        description: '最大返回文件数（可选，默认10000）',
      },
    },
    required: ['pattern'],
  },
};

// 6. Grep 内容搜索工具
export const GREP_TOOL: ToolDefinition = {
  name: 'Grep',
  description: `快速内容搜索工具。

功能:
- 支持正则表达式搜索
- 可显示匹配上下文
- 多种输出模式

输出模式:
- files_with_matches: 只返回匹配的文件名（默认，推荐用于初步搜索）
- content: 返回匹配内容和上下文
- count: 返回每个文件的匹配数

使用建议:
- 先用 files_with_matches 模式找到相关文件
- 再用 read_file 查看具体内容
- 对于复杂搜索，可以并行执行多个搜索`,
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '正则表达式搜索模式',
      },
      path: {
        type: 'string',
        description: '搜索路径（可选，默认为工作目录）',
      },
      glob: {
        type: 'string',
        description: '文件过滤模式（可选，如 "*.js"）',
      },
      outputMode: {
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description: '输出模式（可选，默认 files_with_matches）',
      },
      caseInsensitive: {
        type: 'boolean',
        description: '是否忽略大小写（可选）',
      },
      contextBefore: {
        type: 'number',
        description: '显示匹配前几行（可选，仅 content 模式）',
      },
      contextAfter: {
        type: 'number',
        description: '显示匹配后几行（可选，仅 content 模式）',
      },
      maxResults: {
        type: 'number',
        description: '最大匹配数（可选，默认100）',
      },
    },
    required: ['pattern'],
  },
};

// 7. 用户提问工具
export const ASK_USER_QUESTION_TOOL: ToolDefinition = {
  name: 'AskUserQuestion',
  description: `主动向用户提问，获取结构化答案。

功能:
- 支持单选和多选
- 自动包含"其他"选项供自定义输入
- 最多 4 个问题

使用场景:
- 需要用户做出决策时
- 需要澄清需求时
- 需要用户确认方案时

注意: 不要过度使用此工具。只在真正需要用户输入时使用。`,
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: '问题列表（1-4个问题）',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: '问题内容',
            },
            header: {
              type: 'string',
              description: '问题标题（简短标识）',
            },
            options: {
              type: 'array',
              description: '选项列表（2-4个选项，自动包含Other选项）',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: '选项标签',
                  },
                  description: {
                    type: 'string',
                    description: '选项说明',
                  },
                },
                required: ['label', 'description'],
              },
            },
            multiSelect: {
              type: 'boolean',
              description: '是否允许多选（可选，默认 false）',
            },
          },
          required: ['question', 'header', 'options'],
        },
      },
    },
    required: ['questions'],
  },
};

// 8. Todo 管理工具
export const TODO_WRITE_TOOL: ToolDefinition = {
  name: 'TodoWrite',
  description: `管理任务列表，跟踪多步骤任务的进度。

功能:
- 创建、更新任务状态
- 最多 ${DEFAULTS.maxTodos} 个任务
- 同时只能有 1 个任务为 in_progress

状态说明:
- pending: 待处理
- in_progress: 进行中
- completed: 已完成

重要:
- 对于复杂任务，**必须**使用此工具进行规划
- 完成任务后**立即**标记为 completed
- 不要批量处理后再更新状态

使用建议:
- 任务描述使用祈使句（如"创建文件"）
- activeForm 使用进行时（如"正在创建文件"）`,
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '任务列表（最多20个）',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '任务唯一标识（可选）',
            },
            content: {
              type: 'string',
              description: '任务内容描述（祈使句形式，如"创建文件"）',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: '任务状态',
            },
            activeForm: {
              type: 'string',
              description: '任务进行中的描述（现在进行时形式，如"正在创建文件"）',
            },
          },
          required: ['content', 'status', 'activeForm'],
        },
      },
    },
    required: ['todos'],
  },
};

// 9. 技能加载工具 (Production-grade)
export const SKILL_TOOL: ToolDefinition = {
  name: 'Skill',
  description: `执行技能或自定义命令。

<skills_instructions>
当用户要求执行任务时，检查是否有可用技能可以更有效地完成任务。
技能提供专业能力和领域知识。

当用户提到 "/something"（如 "/commit"、"/review-pr"）时，
他们指的是技能。使用此工具调用相应的技能。

<example>
用户: "run /commit"
助手: [调用 Skill 工具: skill="commit"]
</example>

调用方式:
- 使用技能名称和可选参数
- 示例:
  - skill: "pdf" - 调用 pdf 技能
  - skill: "commit", args: "-m 'Fix bug'" - 带参数调用
  - skill: "review-pr", args: "123" - 带参数调用

重要规则:
- 当技能相关时，必须**立即**调用此工具
- **不要**只在文字中提及技能而不实际调用
- 这是阻塞要求：在生成其他响应前先调用 Skill 工具
- 只使用 <available_skills> 中列出的技能
- 不要对内置 CLI 命令使用此工具（如 /help、/clear）
</skills_instructions>
`,
  input_schema: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: '技能名称（不带前导 /）。使用 <available_skills> 中的值。',
      },
      args: {
        type: 'string',
        description: '技能的可选参数（自由文本）',
      },
    },
    required: ['skill'],
  },
};

// 10. 进入规划模式工具
export const ENTER_PLAN_MODE_TOOL: ToolDefinition = {
  name: 'EnterPlanMode',
  description: `进入规划模式，在执行前先探索和设计。

功能:
- 创建规划文件记录分析和计划
- 限制为只读工具，防止意外修改
- 完成后使用 ExitPlanMode 提交计划

使用场景:
- 复杂任务需要先分析再实施
- 需要设计实现方案
- 用户要求先规划再执行

规划模式下可用工具:
- read_file, Glob, Grep（探索代码）
- bash（只读命令如 git log）
- write_file/edit_file（仅用于更新规划文件）`,
  input_schema: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: '任务描述',
      },
    },
    required: ['taskDescription'],
  },
};

// 11. 退出规划模式工具
export const EXIT_PLAN_MODE_TOOL: ToolDefinition = {
  name: 'ExitPlanMode',
  description: `退出规划模式并提交计划供用户审阅。

功能:
- 读取规划文件内容
- 返回计划供用户审阅
- 等待用户确认后再执行

注意: 只有在规划模式中才能使用此工具。`,
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// 12. WebFetch 工具
export const WEB_FETCH_TOOL: ToolDefinition = {
  name: 'WebFetch',
  description: `获取网页内容并转换为 Markdown 格式。

功能:
- 支持 HTTP/HTTPS 协议
- 自动处理 HTML 转换
- 提取主要内容，过滤广告和导航

使用场景:
- 查询在线文档
- 获取技术博客内容
- 查看 API 文档

限制:
- 超时 ${DEFAULTS.webFetchTimeout / 1000} 秒
- 最大内容 50000 字符`,
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要获取的网页 URL',
      },
      timeout: {
        type: 'number',
        description: '超时时间（毫秒，可选，默认 30000）',
      },
      maxLength: {
        type: 'number',
        description: '最大内容长度（字符数，可选，默认 50000）',
      },
    },
    required: ['url'],
  },
};

// 13. WebSearch 工具
export const WEB_SEARCH_TOOL: ToolDefinition = {
  name: 'WebSearch',
  description: `搜索网络内容。

功能:
- 使用 DuckDuckGo 搜索引擎
- 返回标题、URL 和摘要
- 默认返回 5 个结果

使用场景:
- 查找解决方案
- 搜索技术文档
- 了解最新信息

使用建议:
- 使用具体的关键词
- 结合 WebFetch 获取详细内容`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询关键词',
      },
      maxResults: {
        type: 'number',
        description: '最大返回结果数（可选，默认 5）',
      },
      timeout: {
        type: 'number',
        description: '超时时间（毫秒，可选，默认 30000）',
      },
    },
    required: ['query'],
  },
};

/**
 * 创建 Task 工具定义（动态生成描述）
 */
function createTaskTool(): ToolDefinition {
  const agentDescriptions = getAgentTypeDescriptions();

  return {
    name: 'Task',
    description: `启动子代理执行复杂任务。

功能:
- 子代理在隔离的上下文中运行
- 不会看到父对话的历史
- 自动选择合适的工具集

子代理类型:
${agentDescriptions}

使用场景:
- **explore**: 搜索和分析代码库
  例: "查找所有使用 auth 模块的文件"
- **plan**: 设计实施策略
  例: "设计数据库迁移策略"
- **code**: 实现功能或修复 bug
  例: "实现用户注册表单"

使用建议:
- 对于文件搜索任务，优先使用 Task(explore) 以减少上下文
- 复杂任务先用 Task(plan) 规划，再用 Task(code) 实现
- description 应简短（3-5字），用于进度显示`,
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '任务简短描述（3-5个字，用于进度显示）',
        },
        prompt: {
          type: 'string',
          description: '详细的任务提示词',
        },
        agent_type: {
          type: 'string',
          enum: ['explore', 'code', 'plan'],
          description: '子代理类型',
        },
      },
      required: ['description', 'prompt', 'agent_type'],
    },
  };
}

// 14. 子代理任务工具
export const TASK_TOOL: ToolDefinition = createTaskTool();

// 基础工具列表（不含 Task，用于子代理）
export const BASE_TOOLS: ToolDefinition[] = [
  BASH_TOOL,
  READ_FILE_TOOL,
  WRITE_FILE_TOOL,
  EDIT_FILE_TOOL,
  GLOB_TOOL,
  GREP_TOOL,
  ASK_USER_QUESTION_TOOL,
  TODO_WRITE_TOOL,
  SKILL_TOOL,
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  WEB_FETCH_TOOL,
  WEB_SEARCH_TOOL,
];

// 所有工具列表（含 Task，用于主代理）
export const ALL_TOOLS: ToolDefinition[] = [
  ...BASE_TOOLS,
  TASK_TOOL,
];

/**
 * 根据代理类型获取工具
 */
export function getToolsForAgentType(agentType: AgentType): ToolDefinition[] {
  const config = AGENT_TYPES[agentType];

  if (config.tools === '*') {
    // 子代理不能调用 Task（防止无限递归）
    return BASE_TOOLS;
  }

  const allowedTools = config.tools as string[];
  return BASE_TOOLS.filter(tool => allowedTools.includes(tool.name));
}
