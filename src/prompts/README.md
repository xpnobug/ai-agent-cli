# Prompt 目录说明

本目录统一管理项目中的提示词模板（Prompt Templates）。
目标：**把提示词与业务代码解耦**，便于维护、迭代和 A/B 测试。

## 目录结构

```text
src/prompts/
  system/        # 主系统提示词片段（createSystemPrompt）
  agent/         # 子代理角色提示词（AGENT_TYPES）
  styles/        # 输出风格提示词（explanatory / learning）
  compression/   # 上下文压缩摘要提示词
  safety/        # 安全策略相关提示词（如命令前缀检测）
  tools/         # 工具级提示词（如 WebFetch 提取）
```

## 变量替换

模板支持 `{{varName}}` 占位符，运行时由 `promptLoader` 注入。

示例：

```md
你是 {{productName}}。
```

由代码替换为：

```ts
loadPromptWithVars('system/identity.md', { productName: PRODUCT_NAME })
```

## 加载入口

- `src/services/promptLoader.ts`
  - `loadPrompt(relativePath)`
  - `loadPromptWithVars(relativePath, vars)`
  - `renderPrompt(template, vars)`

## 代码映射关系

### system/
- 使用位置：`src/core/prompts.ts`
- 作用：组装 `createSystemPrompt()` 和 `createSubagentSystemPrompt()`

### agent/
- 使用位置：`src/core/agents.ts`
- 作用：定义 `AGENT_TYPES.*.systemPrompt`

### styles/
- 使用位置：`src/core/outputStyles.ts`
- 作用：输出风格 prompt（解释型/学习型）

### compression/
- 使用位置：`src/core/contextCompressor.ts`
- 作用：上下文压缩摘要生成提示词

### safety/
- 使用位置：`src/core/commandPrefix.ts`
- 作用：Bash 命令前缀检测提示词

### tools/
- 使用位置：`src/tools/network/webFetch.ts`
- 作用：网页内容提取提示词

## 维护规范

1. **一类功能一个文件**，避免将多个场景混在同一个模板。
2. **优先改模板，不改业务逻辑**：语气、结构、约束优先在 prompt 文件调整。
3. **变量名稳定**：避免频繁改占位符命名，减少调用方改动。
4. **修改后至少执行**：`npm run build`。
5. 对行为敏感模板（`safety/`）修改时，建议附回归验证记录。

## 注意

- `skills/**/SKILL.md` 是技能体系的独立提示词来源，不在本目录统一管理。
- 如果新增模板文件，请同步更新本 README 的“代码映射关系”。
