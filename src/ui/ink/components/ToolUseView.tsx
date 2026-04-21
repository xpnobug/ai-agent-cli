/**
 * ToolUseView - 工具调用展示
 *
 * - ⏺ 前缀（实心圆点）
 * - 紧凑单行：toolName (detail)
 * - 运行中动画：圆点闪烁
 * - 无 marginTop（紧凑排列）
 */

import path from 'node:path';
import { Box, Text } from '../primitives.js';
import { useEffect, useState } from 'react';
import { getInkColors } from '../../theme.js';
import { truncatePathMiddle } from '../../../utils/format.js';
import { FilePathLink } from './FilePathLink.js';

// ─── 工具名映射（API name → 用户友好显示名）───
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  bash: 'Bash',
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Update',
  glob: 'Glob',
  grep: 'Grep',
  web_fetch: 'WebFetch',
  web_search: 'WebSearch',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  todowrite: 'TodoWrite',
  todo_write: 'TodoWrite',
  askuserquestion: 'AskUserQuestion',
  ask_user_question: 'AskUserQuestion',
  enterplanmode: 'EnterPlanMode',
  enter_plan_mode: 'EnterPlanMode',
  exitplanmode: 'ExitPlanMode',
  exit_plan_mode: 'ExitPlanMode',
  taskoutput: 'TaskOutput',
  task_output: 'TaskOutput',
  taskstop: 'TaskStop',
  task_stop: 'TaskStop',
  taskcreate: 'TaskCreate',
  task_create: 'TaskCreate',
  taskget: 'TaskGet',
  task_get: 'TaskGet',
  taskupdate: 'TaskUpdate',
  task_update: 'TaskUpdate',
  tasklist: 'TaskList',
  task_list: 'TaskList',
  str_replace_based_edit_tool: 'Update',
  create_file: 'Write',
  view_file: 'Read',
};

export function getToolDisplayName(name: string): string {
  return TOOL_DISPLAY_NAMES[name.toLowerCase()] ?? name;
}

// ─── 判断 detail 是否为文件路径（用于高亮）───
function looksLikePath(str: string): boolean {
  // 绝对路径 / 相对路径（含 . 或 ..）/ 含扩展名的普通路径
  if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) return true;
  const ext = path.extname(str);
  return ext.length > 1 && ext.length <= 6;
}

export interface ToolUseViewProps {
  name: string;
  detail?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  animate: boolean;
}

export function ToolUseView({ name, detail, status, animate }: ToolUseViewProps) {
  const colors = getInkColors();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => {
      setIsVisible((prev) => !prev);
    }, 500);
    return () => clearInterval(timer);
  }, [animate]);

  const color =
    status === 'error' ? colors.error
    : status === 'done' ? 'gray'
    : status === 'queued' ? colors.textDim
    : colors.primary;

  const showDot = !animate || isVisible;
  const showDetail = detail && detail.trim().length > 0;
  const truncatedDetail = showDetail ? truncatePathMiddle(detail!, 50) : '';
  const displayName = getToolDisplayName(name);
  const isPath = showDetail && looksLikePath(detail!.trim());

  return (
    <Box flexDirection="row" flexWrap="nowrap" height={1}>
      <Box minWidth={2}>
        <Text color={color} dimColor={status === 'queued'}>{showDot ? '⏺' : ' '}</Text>
      </Box>
      <Box flexShrink={0}>
        <Text bold wrap="truncate-end">{displayName}</Text>
      </Box>
      {showDetail && (
        <Box flexWrap="nowrap">
          <Text dimColor>(</Text>
          {isPath && path.isAbsolute(detail!.trim()) ? (
            <FilePathLink filePath={detail!.trim()}>
              <Text color={colors.primary} wrap="truncate-end">{truncatedDetail}</Text>
            </FilePathLink>
          ) : (
            <Text color={isPath ? colors.primary : undefined} wrap="truncate-end">
              {truncatedDetail}
            </Text>
          )}
          <Text dimColor>)</Text>
        </Box>
      )}
    </Box>
  );
}
