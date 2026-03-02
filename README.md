# AI Agent CLI

一个功能完整的 AI 编程助手命令行工具，支持多个 LLM 提供商（Anthropic Claude、OpenAI、Google Gemini），基于 TypeScript + React Ink 构建。

## 核心特性

### 多提供商支持

通过统一的适配器接口无缝切换 LLM 提供商：

| 提供商                  | 支持模型                                                          |
|----------------------|---------------------------------------------------------------|
| **Anthropic Claude** | Claude Sonnet 4、Claude Opus 4、Claude 3.5 Sonnet、Claude 3 Opus |
| **OpenAI**           | GPT-4 Turbo、GPT-4、o1-preview、o1-mini                          |
| **Google Gemini**    | Gemini 2.0 Flash、Gemini 1.5 Pro、Gemini 1.5 Flash              |
| **其他三方模型**           | ♾️                                                            |
### 15+ 内置工具

#### 文件操作
- **bash** - 执行 Shell 命令（支持超时和后台运行）
- **read_file** - 读取文件内容（支持行号范围、PDF、图片）
- **write_file** - 创建或覆盖文件
- **edit_file** - 精确字符串替换编辑

#### 高效搜索
- **Glob** - 快速文件模式匹配（支持 `**/*.ts` 等 Glob 模式）
- **Grep** - 基于 ripgrep 的正则内容搜索（支持上下文行和多行匹配）

#### 智能交互
- **AskUserQuestion** - 结构化多选/单选提问
- **TodoWrite** - 任务创建与进度跟踪

#### 代理与规划
- **Task** - 启动专属子代理执行复杂任务
- **Skill** - 加载领域专业知识和技能
- **EnterPlanMode / ExitPlanMode** - 进入/退出规划模式

#### 网络能力
- **WebFetch** - 获取网页内容并转换为 Markdown（15 分钟自清理缓存）
- **WebSearch** - 网络搜索

#### MCP 扩展
- **ListMcpResources / ReadMcpResource** - Model Context Protocol 动态工具和资源

### 6 种子代理系统

| 代理类型 | 用途 | 工具权限 |
|---------|------|---------|
| **explore** | 只读代码库分析 | bash、read_file、Glob、Grep |
| **code** | 完整代码实现 | 全部工具 |
| **plan** | 架构设计与方案规划 | bash、read_file、Glob、Grep |
| **bash** | Shell 命令执行 | bash、read_file |
| **guide** | 文档查询指南 | read_file、Glob、Grep |
| **general** | 通用多步骤任务 | 全部工具 |

### 技能系统

支持 Markdown 格式的可复用技能，AI 可自动识别并调用：

```markdown
---
name: my-skill
description: 技能描述
when_to_use: AI 自动调用条件
allowed-tools: [read_file, Glob]
model: sonnet
---
技能内容。使用 $ARGUMENTS 获取参数。
```

**目录结构**：
```
项目级 (.ai-agent/skills/*/SKILL.md)
用户级 (~/.ai-agent/skills/*/SKILL.md)
```

**管理命令**：
```bash
/skill list        # 列出所有技能
/skill install     # 安装技能（本地/GitHub）
/skill uninstall   # 卸载技能
/skill enable      # 启用技能
/skill disable     # 禁用技能
```

### 终端 UI

基于 React + Ink 的现代终端界面：

- **多行输入** - Shift+Enter 换行，支持长 Prompt 编辑
- **外部编辑器** - Ctrl+G 打开 VS Code / Vim / Nano
- **历史导航** - ↑↓ 箭头浏览命令历史
- **Emacs 快捷键** - Ctrl+A/E/U/K/W 等
- **斜杠命令补全** - 输入 `/` 自动补全命令
- **流式输出** - 实时显示 AI 响应和工具调用
- **Token 追踪** - 实时显示用量和费用
- **请求状态指示器** - 可视化请求进度
- **权限确认对话框** - 敏感操作前确认

### 安全机制

- **权限管理** - 支持 ask / acceptEdits / bypassPermissions / plan 等模式
- **敏感文件保护** - 自动拦截 `.env`、`*.key`、`credentials` 等
- **只读模式** - explore 代理仅允许读操作
- **危险命令拦截** - 拦截 `rm -rf /` 等破坏性命令
- **路径沙箱** - 限制文件操作范围

### Hook 系统

支持在关键事件点执行自定义 Shell 命令：

- `SessionStart` - 会话开始
- `UserPromptSubmit` - 用户提交输入
- `PreCompact` / `PostCompact` - 上下文压缩前后

### 上下文管理

- **自动压缩** - Token 使用超过 80% 阈值时自动压缩对话历史
- **层级中断** - 支持 ESC / Ctrl+C 优雅中断当前操作
- **用户输入排队** - 串行处理多条输入，避免竞争

## 项目结构

```
ai-agent-cli/
├── src/
│   ├── entrypoints/              # 入口点
│   │   ├── cli.ts                # CLI 主入口（22 步启动流程）
│   │   └── index.ts              # 库导出入口
│   │
│   ├── core/                     # 核心逻辑（无 UI 依赖）
│   │   ├── types.ts              # TypeScript 类型定义
│   │   ├── loop.ts               # 主代理循环（兼容包装层）
│   │   ├── loopGenerator.ts      # async Generator 事件驱动架构
│   │   ├── agentEvent.ts         # Agent 事件类型
│   │   ├── agentSession.ts       # Agent 会话管理
│   │   ├── agents.ts             # 6 种子代理配置
│   │   ├── prompts.ts            # 模块化系统提示词
│   │   ├── permissions.ts        # 权限管理系统
│   │   ├── hooks.ts              # Hook 管理器
│   │   ├── contextCompressor.ts  # 对话历史自动压缩
│   │   ├── abort.ts              # 层级式中断控制器
│   │   ├── backgroundTasks.ts    # 后台任务管理
│   │   ├── planMode.ts           # 规划模式管理器
│   │   ├── reminder.ts           # 智能提醒管理器
│   │   ├── projectContext.ts     # 项目上下文管理
│   │   ├── toolResult.ts         # 工具结果处理
│   │   ├── commandPrefix.ts      # 命令前缀解析
│   │   ├── constants.ts          # 常量定义
│   │   └── outputStyles.ts       # 输出样式定义
│   │
│   ├── services/                 # 服务层
│   │   ├── ai/adapters/          # LLM 适配器（统一接口）
│   │   │   ├── base.ts           # ProtocolAdapter 抽象基类
│   │   │   ├── anthropic.ts      # Anthropic 适配器（Prompt Caching）
│   │   │   ├── openai.ts         # OpenAI 适配器（Function Calling）
│   │   │   ├── gemini.ts         # Gemini 适配器（多模态）
│   │   │   └── factory.ts        # 适配器工厂
│   │   ├── config/               # 配置服务
│   │   │   ├── Config.ts         # 配置管理（环境变量 + .env）
│   │   │   ├── configStore.ts    # 持久化存储 (~/.ai-agent/config.json)
│   │   │   ├── setup.ts          # 交互式配置向导
│   │   │   ├── permissions.ts    # 权限规则加载
│   │   │   ├── hooks.ts          # Hook 配置加载
│   │   │   ├── keybindings.ts    # 快捷键配置
│   │   │   └── types.ts          # 配置类型定义
│   │   ├── mcp/                  # Model Context Protocol
│   │   │   ├── client.ts         # MCP 客户端
│   │   │   ├── registry.ts       # MCP 注册表
│   │   │   └── types.ts          # MCP 类型定义
│   │   ├── system/               # 系统服务
│   │   │   ├── security.ts       # 安全验证（路径/命令检查）
│   │   │   ├── sensitiveFiles.ts # 敏感文件检测
│   │   │   └── fileFreshness.ts  # 文件新鲜度检测
│   │   ├── ui/statusline.ts      # 状态栏服务
│   │   ├── customCommands.ts     # 命令/技能加载器
│   │   └── skillMarketplace.ts   # 技能市场
│   │
│   ├── tools/                    # 工具实现（按功能分组）
│   │   ├── definitions.ts        # 工具定义（JSON Schema）
│   │   ├── dispatcher.ts         # 工具分发器
│   │   ├── types.ts              # 工具类型定义
│   │   ├── filesystem/           # bash、read_file、write_file、edit_file
│   │   ├── search/               # Glob、Grep
│   │   ├── interaction/          # AskUserQuestion、TodoWrite、TaskManager
│   │   ├── agent/                # Task、PlanMode
│   │   ├── ai/                   # Skill
│   │   ├── network/              # WebFetch、WebSearch（含缓存）
│   │   └── mcp/                  # MCP 动态工具
│   │
│   ├── commands/                 # 斜杠命令
│   │   ├── registry.ts           # 命令注册表
│   │   ├── builtinCommands.ts    # 内置命令
│   │   └── skillCommands.ts      # 技能相关命令
│   │
│   ├── ui/                       # UI 层（React + Ink）
│   │   ├── UIController.ts       # UI 控制器接口
│   │   ├── ink/
│   │   │   ├── App.tsx           # 根组件
│   │   │   ├── store.ts          # AppStore（外部状态管理）
│   │   │   ├── InkUIController.ts # Ink UI 控制器实现
│   │   │   ├── components/       # UI 组件
│   │   │   │   ├── UserInput.tsx          # 多行输入组件
│   │   │   │   ├── StreamingText.tsx      # 流式文本渲染
│   │   │   │   ├── ToolUseView.tsx        # 工具调用可视化
│   │   │   │   ├── ToolResultView.tsx     # 工具结果展示
│   │   │   │   ├── PermissionPrompt.tsx   # 权限确认
│   │   │   │   ├── ThinkingSpinner.tsx    # 思考动画
│   │   │   │   ├── HighlightedCode.tsx    # 代码高亮
│   │   │   │   └── ...                    # 其他组件
│   │   │   ├── hooks/            # React Hooks
│   │   │   │   ├── useTextInput.ts        # 文本输入
│   │   │   │   ├── useSlashCompletion.ts  # 斜杠补全
│   │   │   │   ├── useStatusLine.ts       # 状态栏
│   │   │   │   └── useDoublePress.ts      # 双击检测
│   │   │   ├── dialogs/          # 对话框
│   │   │   └── completion/       # 命令补全
│   │   ├── theme.ts              # 终端主题
│   │   ├── markdown.ts           # Markdown 渲染
│   │   └── keybindings.ts        # 快捷键映射
│   │
│   ├── utils/                    # 通用工具
│   │   ├── cursor.ts             # 不可变光标和文本操作
│   │   ├── tokenCounter.ts       # Token 计数
│   │   ├── tokenTracker.ts       # Token 用量追踪与费用计算
│   │   ├── modelConfig.ts        # 模型参数配置
│   │   ├── externalEditor.ts     # 外部编辑器集成
│   │   └── retry.ts              # 重试工具
│   │
│   └── types/                    # 全局类型定义
│
├── bin/                          # 可执行文件
│   └── ai-agent-cli.js          # CLI 入口（命令别名: aac）
│
├── skills/                       # 项目级技能
├── .ai-agent/                    # 项目级配置
├── dist/                         # 编译输出
├── .env.example                  # 环境变量示例
├── package.json                  # 项目配置
├── tsconfig.json                 # TypeScript 配置
├── QUICKSTART.md                 # 快速开始指南
└── README.md                     # 本文档
```

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/xpnobug/ai-agent-cli.git
cd ai-agent-cli

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 API 密钥
```

### 配置 API 密钥

在 `.env` 文件中配置提供商和 API 密钥：

```bash
# 选择提供商: anthropic | openai | gemini
PROVIDER=anthropic

# Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_key
# ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# OpenAI
# OPENAI_API_KEY=your_openai_key
# OPENAI_MODEL=gpt-4-turbo-preview

# Google Gemini
# GEMINI_API_KEY=your_gemini_key
# GEMINI_MODEL=gemini-2.0-flash-exp
```

### 运行

```bash
# 开发模式
npm run dev

# 构建并运行
npm run build
npm start

# 全局安装后使用
npm link
ai-agent-cli   # 或简写 aac
```

## 使用示例

### 基础对话

```
>>> 帮我创建一个 TypeScript 项目
```

### 使用子代理

```
>>> 使用 explore 代理分析项目架构
```

### 规划模式

```
>>> 进入规划模式，设计一个用户认证系统
```

### 网络搜索

```
>>> 搜索 React 18 的新特性
```

### 技能管理

```
>>> /skill list
>>> /skill install github-user/skill-repo
```

## 配置

### 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `PROVIDER` | LLM 提供商 (anthropic/openai/gemini) | 是 |
| `ANTHROPIC_API_KEY` | Anthropic Claude API 密钥 | 按提供商 |
| `OPENAI_API_KEY` | OpenAI API 密钥 | 按提供商 |
| `GEMINI_API_KEY` | Google Gemini API 密钥 | 按提供商 |
| `ANTHROPIC_MODEL` | Anthropic 自定义模型 | 否 |
| `OPENAI_MODEL` | OpenAI 自定义模型 | 否 |
| `GEMINI_MODEL` | Gemini 自定义模型 | 否 |
| `ANTHROPIC_BASE_URL` | Anthropic 自定义端点 | 否 |
| `OPENAI_BASE_URL` | OpenAI 自定义端点 | 否 |

### 权限模式

| 模式 | 说明 |
|------|------|
| `ask` | 每次工具调用都询问（默认） |
| `acceptEdits` | 自动允许文件编辑 |
| `bypassPermissions` | 跳过所有权限检查 |
| `plan` | 只读模式，仅允许读操作 |

## 架构设计

### 数据流

```
用户输入 → handleUserInput（排队串行处理）
  → processSingleInput（斜杠命令解析 & 权限检查）
    → agentLoop → agentLoopGenerator（yield AgentEvent）
      → AI 适配器（Anthropic/OpenAI/Gemini）
        → 工具分发器 → 具体工具实现
      → UIController（分发事件到 Ink）
        → React + Ink 渲染
```

### 关键设计模式

- **适配器模式** - 统一多 LLM 提供商接口（ProtocolAdapter 抽象基类）
- **事件驱动** - async Generator 产出 AgentEvent，UI 层订阅消费
- **外部 Store** - React 外的 AppStore，通过 useSyncExternalStore 精确订阅
- **层级中断** - HierarchicalAbortController 支持优雅取消嵌套操作
- **工具分组** - 按功能域组织工具（filesystem / search / interaction / agent / network / mcp）

## 开发

### 项目脚本

```bash
npm run dev            # 开发模式（tsx 热重载）
npm run build          # TypeScript 编译
npm test               # 运行测试（Vitest）
npm run test:ui        # 测试 UI 界面
npm run test:coverage  # 测试覆盖率
npm run lint           # ESLint 代码检查
npm run lint:fix       # 自动修复代码风格
```

### 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 5.3+ |
| 运行时 | Node.js 18+ |
| UI 框架 | React 18 + Ink 4.4 |
| AI SDK | @anthropic-ai/sdk、openai、@google/generative-ai |
| 构建 | tsc（ES Modules） |
| 测试 | Vitest |
| 代码检查 | ESLint + @typescript-eslint |
| 模式验证 | Zod |
| Markdown | marked + turndown |

## 相关文档

- [快速开始](QUICKSTART.md) - 快速上手指南

## 参考项目

- [learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) - 原始教育项目
- [Kode](https://github.com/shareAI-lab/Kode) - 生产级开源 Agent
- [Agent Skills Spec](https://github.com/anthropics/agent-skills) - 官方技能规范

## 致谢

感谢 [shareAI Lab](https://github.com/shareAI-lab) 提供的优秀教育资源和设计理念。

## License

MIT
