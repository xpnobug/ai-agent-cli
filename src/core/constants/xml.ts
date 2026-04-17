/**
 * XML 标签常量
 *
 * 用于在消息体中标记命令 / 终端输出 / 任务通知等特殊片段，
 * 配合渲染器识别、折叠或转换格式。
 */

// ─── 斜杠命令元数据 ─────────────────────────────────────────────────
export const COMMAND_NAME_TAG = 'command-name';
export const COMMAND_MESSAGE_TAG = 'command-message';
export const COMMAND_ARGS_TAG = 'command-args';

// ─── 终端 / bash 相关 ───────────────────────────────────────────────
export const BASH_INPUT_TAG = 'bash-input';
export const BASH_STDOUT_TAG = 'bash-stdout';
export const BASH_STDERR_TAG = 'bash-stderr';
export const LOCAL_COMMAND_STDOUT_TAG = 'local-command-stdout';
export const LOCAL_COMMAND_STDERR_TAG = 'local-command-stderr';
export const LOCAL_COMMAND_CAVEAT_TAG = 'local-command-caveat';

/** 全部终端相关标签：用于判断某条消息是否是终端输出（而非用户 prompt） */
export const TERMINAL_OUTPUT_TAGS = [
  BASH_INPUT_TAG,
  BASH_STDOUT_TAG,
  BASH_STDERR_TAG,
  LOCAL_COMMAND_STDOUT_TAG,
  LOCAL_COMMAND_STDERR_TAG,
  LOCAL_COMMAND_CAVEAT_TAG,
] as const;

/** 系统回调标签：让模型在空闲窗口自检 */
export const TICK_TAG = 'tick';

// ─── 后台任务通知 ────────────────────────────────────────────────────
export const TASK_NOTIFICATION_TAG = 'task-notification';
export const TASK_ID_TAG = 'task-id';
export const TOOL_USE_ID_TAG = 'tool-use-id';
export const TASK_TYPE_TAG = 'task-type';
export const OUTPUT_FILE_TAG = 'output-file';
export const STATUS_TAG = 'status';
export const SUMMARY_TAG = 'summary';
export const REASON_TAG = 'reason';
export const WORKTREE_TAG = 'worktree';
export const WORKTREE_PATH_TAG = 'worktreePath';
export const WORKTREE_BRANCH_TAG = 'worktreeBranch';

// ─── 斜杠命令帮助 / 信息识别用的公共参数集 ────────────────────────
export const COMMON_HELP_ARGS = ['help', '-h', '--help'] as const;

export const COMMON_INFO_ARGS = [
  'list',
  'show',
  'display',
  'current',
  'view',
  'get',
  'check',
  'describe',
  'print',
  'version',
  'about',
  'status',
  '?',
] as const;

// ─── 检查 helper ────────────────────────────────────────────────────

/** 判断一段消息文本是否以某个标签包裹（粗粒度匹配首尾） */
export function isWrappedInTag(text: string, tag: string): boolean {
  const t = text.trim();
  return t.startsWith(`<${tag}>`) && t.endsWith(`</${tag}>`);
}

/** 判断文本是否是终端输出（而不是用户 prompt） */
export function isTerminalOutput(text: string): boolean {
  return TERMINAL_OUTPUT_TAGS.some((tag) => isWrappedInTag(text, tag));
}

/** 判断一组参数是否请求帮助（help / -h / --help） */
export function isHelpArg(arg: string | undefined): boolean {
  if (!arg) return false;
  return (COMMON_HELP_ARGS as readonly string[]).includes(arg.toLowerCase());
}

/** 判断一组参数是否请求当前状态/信息 */
export function isInfoArg(arg: string | undefined): boolean {
  if (!arg) return false;
  return (COMMON_INFO_ARGS as readonly string[]).includes(arg.toLowerCase());
}
