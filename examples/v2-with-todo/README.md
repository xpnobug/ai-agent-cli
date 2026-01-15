# v2-v3 说明

v2（TodoWrite）和 v3（Subagent）的完整实现已经在主项目 `src/` 中以**模块化**方式实现。

由于主项目采用了良好的模块分离，你可以直接使用：

## v2: 使用 TodoWrite

主项目已包含完整的 TodoManager:
- `src/tools/todo.ts` - TodoManager 类
- `src/core/reminder.ts` - System Reminder 机制

**如何体验 v2**:
1. 进入主项目: `cd ../../`
2. 运行: `npm run dev`
3. 使用 TodoWrite 工具跟踪任务

## v3: 使用 Subagent

主项目已包含完整的子代理机制:
- `src/tools/task.ts` - Task 工具和 SubagentProgress
- `src/core/agents.ts` - Agent Type Registry
- `src/core/loop.ts` - Agent 循环（支持子代理）

**如何体验 v3**:
1. 进入主项目: `cd ../../`
2. 运行: `npm run dev`
3. 使用 Task 工具启动子代理:
   ```
   User: 请使用 explore 子代理分析 src/ 目录结构
   ```

## 如果你想要独立的 v2/v3 实现

由于 v2 和 v3 需要更多依赖和基础设施，我们建议：

1. **学习目的**: 直接阅读主项目的对应模块
   - v2: `src/tools/todo.ts`, `src/core/reminder.ts`
   - v3: `src/tools/task.ts`, `src/core/agents.ts`

2. **教学目的**: 参考 Python 版本
   - `../../v2_todo_agent.py` (533 行)
   - `../../v3_subagent.py` (624 行)

3. **自己实现**: 基于 v1 逐步添加功能
   - v1 → v2: 添加 TodoWrite 工具和 ReminderManager
   - v2 → v3: 添加 Task 工具和 Agent Registry

## 为什么不单独创建 v2/v3？

主项目的模块化设计已经很好地展示了 v2/v3 的特性：

- **TodoWrite**: `src/tools/todo.ts` 是完全独立的模块
- **Task**: `src/tools/task.ts` 是完全独立的模块
- **Agent Types**: `src/core/agents.ts` 清晰定义

**与其创建重复代码，不如直接学习主项目中的优秀实现。**

---

如果你确实需要独立的 v2/v3 示例，请参考：
- Python 版本：`../../v2_todo_agent.py` 和 `../../v3_subagent.py`
- 或基于 v1 自己添加对应功能
