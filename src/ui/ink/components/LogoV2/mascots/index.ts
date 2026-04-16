/**
 * 吉祥物注册表
 *
 * 新增角色步骤：
 * 1. 在本目录新建文件（如 owl.ts），导出一个 MascotDefinition
 * 2. 在此文件 import 并加入 ALL_MASCOTS 数组
 * 3. 重新构建
 */

import { clawdMascot } from './clawd.js';
import { robotMascot } from './robot.js';
import { catMascot } from './cat.js';
import type { MascotDefinition } from './types.js';

const ALL_MASCOTS: MascotDefinition[] = [clawdMascot, robotMascot, catMascot];

/** 获取所有已注册的吉祥物 */
export function getMascotRegistry(): MascotDefinition[] {
  return ALL_MASCOTS;
}

/** 按 id 查找吉祥物，未找到则返回默认（clawd） */
export function getMascotById(id: string): MascotDefinition {
  return ALL_MASCOTS.find((m) => m.id === id) ?? clawdMascot;
}

export { clawdMascot, robotMascot, catMascot };
export type { MascotDefinition, MascotPose, PoseSegments } from './types.js';
