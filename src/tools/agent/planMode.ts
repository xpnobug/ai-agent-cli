/**
 * 规划模式工具
 */

import { getPlanModeManager } from '../../core/planMode.js';

/**
 * 进入规划模式
 */
export async function runEnterPlanMode(
  taskDescription: string,
  workdir: string
): Promise<string> {
  const manager = getPlanModeManager(workdir);
  return manager.enterPlanMode(taskDescription);
}

/**
 * 退出规划模式
 */
export async function runExitPlanMode(workdir: string): Promise<string> {
  const manager = getPlanModeManager(workdir);
  const result = manager.exitPlanMode();

  if (!result.success) {
    return result.error || '退出规划模式失败';
  }

  return result.plan;
}
