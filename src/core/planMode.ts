/**
 * 规划模式管理器
 *
 * 规划模式允许代理在执行前先探索和设计实现方案
 */

import path from 'node:path';
import fs from 'fs-extra';

/**
 * 规划模式状态
 */
interface PlanModeState {
  isActive: boolean;
  planFilePath: string;
  taskDescription: string;
  startTime: number;
}

/**
 * 规划模式管理器
 */
export class PlanModeManager {
  private state: PlanModeState | null = null;
  private workdir: string;

  constructor(workdir: string) {
    this.workdir = workdir;
  }

  /**
   * 进入规划模式
   */
  enterPlanMode(taskDescription: string): string {
    if (this.state?.isActive) {
      return '错误: 已经处于规划模式中';
    }

    const planFilePath = path.join(this.workdir, '.ai-agent-plan.md');

    this.state = {
      isActive: true,
      planFilePath,
      taskDescription,
      startTime: Date.now(),
    };

    // 创建初始计划文件
    const initialContent = `# 实现计划

## 任务描述
${taskDescription}

## 分析
(在这里记录你的分析...)

## 实现步骤
1. (步骤1)
2. (步骤2)
...

## 风险和注意事项
- (风险1)
- (风险2)
`;

    fs.writeFileSync(planFilePath, initialContent, 'utf-8');

    return `已进入规划模式！

**规划文件**: ${planFilePath}

**你现在可以**:
- 使用 read_file, glob, grep 等工具探索代码库
- 在规划文件中记录你的分析和计划
- 使用 write_file 或 edit_file 更新计划文件
- 完成后使用 ExitPlanMode 工具提交计划

**注意**: 规划模式下不应执行实际的代码修改，只做探索和规划。`;
  }

  /**
   * 退出规划模式
   */
  exitPlanMode(): { success: boolean; plan: string; error?: string } {
    if (!this.state?.isActive) {
      return {
        success: false,
        plan: '',
        error: '错误: 当前不在规划模式中',
      };
    }

    // 读取计划文件
    let planContent = '';
    try {
      if (fs.existsSync(this.state.planFilePath)) {
        planContent = fs.readFileSync(this.state.planFilePath, 'utf-8');
      } else {
        return {
          success: false,
          plan: '',
          error: '错误: 计划文件不存在',
        };
      }
    } catch (error) {
      return {
        success: false,
        plan: '',
        error: `错误: 无法读取计划文件: ${error}`,
      };
    }

    const elapsed = (Date.now() - this.state.startTime) / 1000;

    // 清除状态
    this.state = null;

    return {
      success: true,
      plan: `规划完成！(用时 ${elapsed.toFixed(1)}s)

${planContent}

---

请审阅上述计划。如果同意，我将开始实施。`,
    };
  }

  /**
   * 检查是否在规划模式中
   */
  isInPlanMode(): boolean {
    return this.state?.isActive ?? false;
  }

  /**
   * 获取计划文件路径
   */
  getPlanFilePath(): string | null {
    return this.state?.planFilePath ?? null;
  }

  /**
   * 获取任务描述
   */
  getTaskDescription(): string | null {
    return this.state?.taskDescription ?? null;
  }
}

/**
 * 全局实例
 */
let planModeManagerInstance: PlanModeManager | null = null;

export function getPlanModeManager(workdir?: string): PlanModeManager {
  if (!planModeManagerInstance && workdir) {
    planModeManagerInstance = new PlanModeManager(workdir);
  }
  if (!planModeManagerInstance) {
    throw new Error('PlanModeManager 未初始化');
  }
  return planModeManagerInstance;
}

export function resetPlanModeManager(): void {
  planModeManagerInstance = null;
}
