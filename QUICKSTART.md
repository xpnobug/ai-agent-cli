# 快速使用指南

## 安装依赖

```bash
cd ai-agent-cli
npm install
```

## 配置环境

复制 `.env.example` 并配置 API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的 API 密钥：

```env
PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxxx...
```

## 开发运行

```bash
npm run dev
```

## 构建项目

```bash
npm run build
```

## 本地测试（全局安装）

```bash
# 链接到全局
npm link

# 运行
ai-agent-cli

# 或使用简写
aac

# 取消链接
npm unlink -g ai-agent-cli
```

## 发布到 npm

```bash
# 登录 npm
npm login

# 发布
npm publish
```

## 使用示例

### 1. 基础对话

```
> 你好

> 当前目录有哪些文件？
```

### 2. 文件操作

```
> 读取 package.json 文件

> 创建一个新的 test.txt 文件，内容是 "Hello World"
```

### 3. 使用技能

```
> 加载 web-dev 技能

> 帮我创建一个 React 组件
```

### 4. 复杂任务

```
> 分析这个项目的代码结构

> 实现一个用户登录功能
```

## 常见问题

### Q: 如何切换 LLM 提供商？

A: 修改 `.env` 文件中的 `PROVIDER` 变量：

```env
PROVIDER=openai  # 或 gemini
```

### Q: 如何添加自定义技能？

A: 在 `skills/` 目录创建新文件夹和 `SKILL.md` 文件：

```bash
mkdir -p skills/my-skill
nano skills/my-skill/SKILL.md
```

### Q: 构建失败怎么办？

A: 确保 Node.js 版本 >= 18：

```bash
node --version
```

### Q: 如何调试？

A: 使用 TypeScript 执行器：

```bash
npm run dev
```

或者编译后查看 dist 目录：

```bash
npm run build
ls -la dist/
```

## 下一步

- 查看 [README.md](./README.md) 了解详细文档
- 阅读 [实施计划](~/.claude/plans/snug-watching-fox.md) 了解架构设计
- 探索 `src/` 目录了解代码结构
- 创建自定义技能扩展功能

## 技术支持

如遇问题，请查看：
1. README.md 故障排除部分
2. GitHub Issues
3. 源代码注释（全中文）

祝使用愉快！ 🎉
