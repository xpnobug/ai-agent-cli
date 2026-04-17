/**
 * 工具定义 - JSON Schemas
 * 定义所有可用工具的名称、描述和参数结构
 */

import type { ToolDefinition, AgentType } from '../core/types.js';
import { getAgentTypeDescriptions, getAgentByType } from '../core/agents.js';
import { DEFAULTS } from '../core/constants.js';
import { getMCPBuiltinTools } from './mcp/mcpTools.js';

// 1. Bash 工具
export const BASH_TOOL: ToolDefinition = {
  name: 'bash',
  description: `在工作目录中执行 bash 命令。

功能:
- 运行任何 shell 命令（ls、git、npm、grep 等）
- 输出被截断为 50MB
- 默认超时 ${DEFAULTS.bashTimeout / 1000} 秒，可通过 timeout 参数自定义
- 支持后台执行模式

使用建议:
- 运行非平凡命令时，先解释命令的作用
- 避免运行交互式命令
- 长时间运行的命令使用 run_in_background 模式
- 对于文件搜索，优先使用 Glob 和 Grep 工具`,
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 bash 命令',
      },
      run_in_background: {
        type: 'boolean',
        description: '是否在后台运行（可选，默认 false）。后台任务返回 taskId，用 TaskOutput 获取结果。',
      },
      timeout: {
        type: 'number',
        description: `超时时间（毫秒，可选，默认 ${DEFAULTS.bashTimeout}，最大 600000）`,
      },
      description: {
        type: 'string',
        description: '命令描述（可选，用于进度显示）',
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
- 读取文本文件
- 默认从开头读取最多 2000 行
- 可用 offset/limit 控制行范围
- 行长度超过 2000 字符会被截断
- 输出使用 cat -n 风格（空格 + 行号 + Tab）
- 支持读取图片与 PDF（以多模态内容返回）

使用建议:
- file_path 必须是绝对路径
- 推荐直接读取完整文件（不传 offset/limit）
- 对于大文件，使用 offset + limit 分段读取
- 编辑文件前先读取以了解内容`,
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '文件绝对路径',
      },
      limit: {
        type: 'number',
        description: '最多读取的行数（可选）',
      },
      offset: {
        type: 'number',
        description: '起始行号（1-based，可选）',
      },
    },
    required: ['file_path'],
  },
};

// 3. 文件写入工具
export const WRITE_FILE_TOOL: ToolDefinition = {
  name: 'write_file',
  description: `创建或覆盖文件。

功能:
- 创建新文件或完全覆盖现有文件
- 自动创建父目录
- 返回结构化结果（type/filePath/content/structuredPatch/originalFile/gitDiff）

使用建议:
- file_path 必须是绝对路径
- 用于创建新文件
- 对于修改现有文件，优先使用 edit_file
- 写入前确认文件路径正确`,
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '文件绝对路径',
      },
      content: {
        type: 'string',
        description: '文件内容',
      },
    },
    required: ['file_path', 'content'],
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
- 支持 replace_all 模式替换所有匹配

关键要求:
- file_path 必须是绝对路径
- old_string 必须与文件中的内容**完全匹配**（包括空格和换行）
- old_string/new_string 不要包含 read_file 的行号前缀
- read_file 行号前缀格式：空格 + 行号 + Tab
- new_string 必须与 old_string 不同
- 默认只替换第一处匹配；使用 replace_all 替换全部`,
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '文件绝对路径',
      },
      old_string: {
        type: 'string',
        description: '要替换的原文本（必须精确匹配）',
      },
      new_string: {
        type: 'string',
        description: '替换后的新文本（必须与 old_string 不同）',
      },
      replace_all: {
        type: 'boolean',
        description: '是否替换所有匹配（可选，默认 false）',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
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
- 支持多行匹配和文件类型过滤
- 支持分页（offset/head_limit）

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
      multiline: {
        type: 'boolean',
        description: '是否启用多行匹配模式（可选，默认 false）。启用后 . 匹配换行符。',
      },
      type: {
        type: 'string',
        description: '文件类型过滤（可选，如 "js", "ts", "py", "rust", "go", "java"）',
      },
      head_limit: {
        type: 'number',
        description: '限制输出的条目数（可选，默认不限制）',
      },
      offset: {
        type: 'number',
        description: '跳过前 N 条结果（可选，默认 0）',
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
      answers: {
        type: 'object',
        description: '预填回答（可选，key 为问题文本，value 为回答）',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['questions'],
  },
};

// 8. Todo 管理工具（兼容别名）
export const TODO_WRITE_TOOL: ToolDefinition = {
  name: 'TodoWrite',
  description: `更新当前会话的任务列表，用于跟踪进度与待办事项。

关键要求:
- 同时只能有 1 个任务为 in_progress
- 每个任务必须提供 content（祈使句）与 activeForm（进行时）

状态说明:
- pending: 待处理
- in_progress: 进行中
- completed: 已完成

使用建议:
- 任务描述使用祈使句（如"创建文件"）
- activeForm 使用进行时（如"正在创建文件"）`,
  input_schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '任务列表',
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

// 9. 技能加载工具
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
- 15 分钟自动缓存
- 可用 prompt 参数提取特定信息
- 自动检测跨域重定向

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
      prompt: {
        type: 'string',
        description: '内容提取提示词（可选）。指定后会用 LLM 从网页内容中提取所需信息。',
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

// 14. TaskOutput 工具（获取后台任务输出）
export const TASK_OUTPUT_TOOL: ToolDefinition = {
  name: 'TaskOutput',
  description: `获取正在运行或已完成的任务输出。

功能:
- 支持后台 bash 任务与后台子代理任务
- 支持阻塞等待与非阻塞查询
- 返回任务状态、输出与错误信息`,
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '后台任务 ID',
      },
      block: {
        type: 'boolean',
        description: '是否阻塞等待完成（可选，默认 true）',
      },
      timeout: {
        type: 'number',
        description: '最大等待时间（毫秒，可选，默认 30000）',
      },
    },
    required: ['task_id'],
  },
};

// 15. TaskStop 工具（停止后台任务）
export const TASK_STOP_TOOL: ToolDefinition = {
  name: 'TaskStop',
  description: `停止正在运行的后台任务。

功能:
- 通过任务 ID 停止后台任务
- 返回操作是否成功`,
  input_schema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '要停止的后台任务 ID',
      },
    },
    required: ['task_id'],
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
- 可选继承或恢复历史
- 支持后台运行并通过 TaskOutput 拉取结果

子代理类型:
${agentDescriptions}

使用建议:
- description 应简短（3-5字），用于进度展示
- prompt 需完整明确，子代理不会与你交互`,
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
        subagent_type: {
          type: 'string',
          description: '子代理类型',
        },
        model: {
          type: 'string',
          description: '指定使用的模型（可选，默认继承父代理）',
        },
        run_in_background: {
          type: 'boolean',
          description: '是否在后台运行（可选，默认 false）。后台运行返回 sessionId。',
        },
        resume: {
          type: 'string',
          description: '恢复之前的 Agent 会话 ID（可选）。传入后续消息继续之前的对话。',
        },
      },
      required: ['description', 'prompt', 'subagent_type'],
    },
  };
}

// 16. 子代理任务工具
export const TASK_TOOL: ToolDefinition = createTaskTool();

// 17. TaskCreate 工具
export const TASK_CREATE_TOOL: ToolDefinition = {
  name: 'TaskCreate',
  description: `创建新任务，用于跟踪多步骤工作进度。

使用场景:
- 复杂任务需要 3 个以上步骤时
- 需要向用户展示进度时
- 收到多个子任务时

注意: 单一简单任务不需要创建 Task。`,
  input_schema: {
    type: 'object',
    properties: {
      subject: {
        type: 'string',
        description: '任务标题（祈使句，如"修复登录 bug"）',
      },
      description: {
        type: 'string',
        description: '任务详细描述',
      },
      activeForm: {
        type: 'string',
        description: '进行中显示的文本（现在进行时，如"正在修复登录 bug"）',
      },
      owner: {
        type: 'string',
        description: '任务负责人（可选）',
      },
      metadata: {
        type: 'object',
        description: '附加元数据（可选）',
      },
    },
    required: ['subject', 'description'],
  },
};

// 18. TaskGet 工具
export const TASK_GET_TOOL: ToolDefinition = {
  name: 'TaskGet',
  description: `获取任务详情。返回任务的完整信息，包括描述、状态和依赖关系。`,
  input_schema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: '任务 ID',
      },
    },
    required: ['taskId'],
  },
};

// 19. TaskUpdate 工具
export const TASK_UPDATE_TOOL: ToolDefinition = {
  name: 'TaskUpdate',
  description: `更新任务状态或内容。

状态流转: pending → in_progress → completed
使用 status="deleted" 永久删除任务。

重要:
- 开始工作前标记为 in_progress
- 完全完成后才标记为 completed
- 遇到错误时保持 in_progress`,
  input_schema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: '任务 ID',
      },
      subject: {
        type: 'string',
        description: '新标题（可选）',
      },
      description: {
        type: 'string',
        description: '新描述（可选）',
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'deleted'],
        description: '新状态（可选）',
      },
      activeForm: {
        type: 'string',
        description: '进行中显示文本（可选）',
      },
      owner: {
        type: 'string',
        description: '任务负责人（可选）',
      },
      metadata: {
        type: 'object',
        description: '元数据（合并到现有数据，设为 null 删除键）',
      },
      addBlocks: {
        type: 'array',
        items: { type: 'string' },
        description: '此任务阻塞的任务 ID 列表（可选）',
      },
      addBlockedBy: {
        type: 'array',
        items: { type: 'string' },
        description: '阻塞此任务的任务 ID 列表（可选）',
      },
    },
    required: ['taskId'],
  },
};

// 20. TaskList 工具
export const TASK_LIST_TOOL: ToolDefinition = {
  name: 'TaskList',
  description: `列出所有任务。返回任务摘要列表，包含 ID、标题、状态和依赖信息。`,
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

// NotebookEdit — 编辑 .ipynb 单元格
export const NOTEBOOK_EDIT_TOOL: ToolDefinition = {
  name: 'NotebookEdit',
  description: `编辑 Jupyter .ipynb 单元格。支持 replace / insert / delete 三种模式。

用法:
- notebook_path 必须是绝对路径，指向 .ipynb
- cell_number 为 0-based 索引（replace/delete 必填；insert 可省略，默认追加）
- insert 模式下必须给出 cell_type（code 或 markdown）
- new_source 为新的单元格源码（字符串）`,
  input_schema: {
    type: 'object',
    properties: {
      notebook_path: { type: 'string', description: '.ipynb 绝对路径' },
      cell_number: { type: 'number', description: '0-based 单元格索引' },
      cell_id: { type: 'string', description: '目标单元格 id（可替代 cell_number）' },
      cell_type: { type: 'string', enum: ['code', 'markdown'] },
      edit_mode: {
        type: 'string',
        enum: ['replace', 'insert', 'delete'],
        description: '默认 replace',
      },
      new_source: { type: 'string', description: '新的单元格源码（对 delete 无效）' },
    },
    required: ['notebook_path'],
  },
};

// CronCreate — 创建定时任务
export const CRON_CREATE_TOOL: ToolDefinition = {
  name: 'CronCreate',
  description: `创建一个定时任务，到时间触发后会把 prompt 入队为一次 /loop 输入。

- cron: 标准 5 字段表达式（分 时 日 月 周），本地时区
- prompt: 触发时要执行的提示词
- recurring: true=周期触发，false=仅触发一次（默认 true）
- durable: true=持久化到 .ai-agent/scheduled_tasks.json；false=仅当前会话`,
  input_schema: {
    type: 'object',
    properties: {
      cron: { type: 'string', description: '5 字段 cron 表达式' },
      prompt: { type: 'string', description: '触发时执行的提示词' },
      recurring: { type: 'boolean', description: '是否重复执行（默认 true）' },
      durable: { type: 'boolean', description: '是否持久化（默认 false）' },
    },
    required: ['cron', 'prompt'],
  },
};

// CronList — 列出所有定时任务
export const CRON_LIST_TOOL: ToolDefinition = {
  name: 'CronList',
  description: '列出所有已创建的定时任务（包含持久化与会话级）。',
  input_schema: { type: 'object', properties: {}, required: [] },
};

// CronDelete — 删除定时任务
export const CRON_DELETE_TOOL: ToolDefinition = {
  name: 'CronDelete',
  description: '按 id 删除定时任务，可一次传多个 id。',
  input_schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '单个任务 id' },
      ids: { type: 'array', items: { type: 'string' }, description: '多个任务 id 列表' },
    },
    required: [],
  },
};
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
  TASK_OUTPUT_TOOL,
  TASK_STOP_TOOL,
  TASK_CREATE_TOOL,
  TASK_GET_TOOL,
  TASK_UPDATE_TOOL,
  TASK_LIST_TOOL,
  NOTEBOOK_EDIT_TOOL,
  CRON_CREATE_TOOL,
  CRON_LIST_TOOL,
  CRON_DELETE_TOOL,
  ...getMCPBuiltinTools(),
];

const SUBAGENT_DISALLOWED_TOOL_NAMES = new Set<string>([
  'Task',
  'TaskOutput',
  'TaskStop',
  'EnterPlanMode',
  'ExitPlanMode',
  'AskUserQuestion',
]);

function getToolNameFromSpec(spec: string): string {
  const trimmed = spec.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/^([^(]+)\(([^)]+)\)$/);
  if (!match) return trimmed;
  const toolName = match[1]?.trim();
  const ruleContent = match[2]?.trim();
  if (!toolName || !ruleContent) return trimmed;
  return toolName;
}

// 所有工具列表（含 Task，用于主代理）
export const ALL_TOOLS: ToolDefinition[] = [
  ...BASE_TOOLS,
  TASK_TOOL,
];

/**
 * 动态获取所有工具（包含 MCP 工具等动态工具）
 */
export function getAllTools(extraTools?: ToolDefinition[]): ToolDefinition[] {
  if (extraTools && extraTools.length > 0) {
    return [...ALL_TOOLS, ...extraTools];
  }
  return ALL_TOOLS;
}

/**
 * 根据代理类型获取工具
 */
export function getToolsForAgentType(agentType: AgentType): ToolDefinition[] {
  const config = getAgentByType(agentType);
  let tools = BASE_TOOLS.filter(
    tool => !SUBAGENT_DISALLOWED_TOOL_NAMES.has(tool.name),
  );

  if (!config) {
    return tools;
  }

  if (config.tools !== '*' && Array.isArray(config.tools)) {
    const allowedToolNames = new Set(
      config.tools.map(getToolNameFromSpec).filter(Boolean),
    );
    tools = tools.filter(tool => allowedToolNames.has(tool.name));
  }

  if (Array.isArray(config.disallowedTools) && config.disallowedTools.length > 0) {
    const disallowed = new Set(
      config.disallowedTools.map(getToolNameFromSpec).filter(Boolean),
    );
    tools = tools.filter(tool => !disallowed.has(tool.name));
  }

  return tools;
}
