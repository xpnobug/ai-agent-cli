/**
 * useCanUseTool — 工具权限检查 Hook
 *
 * 功能：检查当前权限模式下是否允许使用指定工具。
 */

import { useMemo } from 'react';

export type PermissionCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * 检查工具是否允许在当前权限模式下使用。
 * 当前简化实现：所有工具默认需要确认。
 */
export function useCanUseTool(
  toolName: string,
  permissionMode: string = 'default',
): PermissionCheckResult {
  return useMemo(() => {
    // 只读工具始终允许
    const readOnlyTools = new Set([
      'read_file', 'glob', 'grep', 'web_search',
    ]);

    if (readOnlyTools.has(toolName)) {
      return { allowed: true };
    }

    // 自动模式下所有工具都允许
    if (permissionMode === 'auto' || permissionMode === 'yolo') {
      return { allowed: true };
    }

    // 默认模式下需要确认
    return { allowed: false, reason: '需要用户确认' };
  }, [toolName, permissionMode]);
}
