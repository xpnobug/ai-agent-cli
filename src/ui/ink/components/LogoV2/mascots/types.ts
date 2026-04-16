/**
 * MascotDefinition 类型 — 吉祥物角色定义接口
 *
 * 新增角色只需在 mascots/ 目录添加文件，实现此接口即可。
 */

// 姿势类型
export type MascotPose = 'default' | 'arms-up' | 'look-left' | 'look-right';

// 标准终端渲染片段（3 行 × 分段）
export interface PoseSegments {
  r1L: string;  // 第 1 行左侧（无背景）
  r1E: string;  // 第 1 行眼睛/头部（有背景色）
  r1R: string;  // 第 1 行右侧（无背景）
  r2L: string;  // 第 2 行左侧（无背景）
  r2R: string;  // 第 2 行右侧（无背景）
}

// 吉祥物定义
export interface MascotDefinition {
  id: string;                                    // 唯一标识（用于配置引用）
  name: string;                                  // 显示名称（用于选择器）
  color: string;                                 // 主色（Ink 颜色名，如 'magenta'）
  bgColor: string;                               // 背景色（Ink 颜色名，如 'magentaBright'）
  poses: Record<MascotPose, PoseSegments>;       // 4 种姿势的渲染片段
  appleEyes: Record<MascotPose, string>;         // Apple Terminal 眼睛渲染
  bodyFill: string;                              // 第 2 行身体填充字符串
  footRow: string;                               // 第 3 行脚部字符串
}
