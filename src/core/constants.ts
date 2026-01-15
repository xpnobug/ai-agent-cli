/**
 * 产品常量定义
 * 包含产品信息、UI 元素、默认配置等全局常量
 */

/**
 * 产品名称
 */
export const PRODUCT_NAME = 'AI Agent CLI';

/**
 * 产品命令
 */
export const PRODUCT_COMMAND = 'ai-agent';

/**
 * 版本号
 */
export const VERSION = '1.0.0';

/**
 * 产品版本（别名，用于 Banner）
 */
export const PRODUCT_VERSION = VERSION;

/**
 * 项目配置文件名
 */
export const PROJECT_FILE = '.ai-agent/project.md';

/**
 * 项目设置目录
 */
export const PROJECT_DIR = '.ai-agent';

/**
 * 问题反馈链接
 */
export const ISSUES_URL = 'https://github.com/user/ai-agent-cli/issues';

/**
 * 中断消息（用于检测用户取消）
 */
export const INTERRUPT_MESSAGE = '[用户中断]';
export const INTERRUPT_MESSAGE_FOR_TOOL_USE = '[用户在工具执行期间中断]';

/**
 * 边框字符
 */
export const BORDER = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  separator: ' │ ',
};

/**
 * 默认配置
 */
export const DEFAULTS = {
  maxTokens: 8192,
  maxTurns: 50,
  subagentMaxTurns: 10,
  todoNagThreshold: 10,
  bashTimeout: 60000, // 60秒
  webFetchTimeout: 30000, // 30秒
  maxTodos: 20,
};

/**
 * 宏定义（用于提示词中的动态替换）
 */
export const MACRO = {
  VERSION,
  ISSUES_EXPLAINER: `在 ${ISSUES_URL} 报告问题`,
  PROJECT_FILE,
  PRODUCT_NAME,
  PRODUCT_COMMAND,
};

/**
 * ASCII Logo
 */
export const ASCII_LOGO = [
  '    _    ___      _                    _   ',
  '   / \\  |_ _|    / \\   __ _  ___ _ __ | |_ ',
  '  / _ \\  | |    / _ \\ / _` |/ _ \\ \'_ \\| __|',
  ' / ___ \\ | |   / ___ \\ (_| |  __/ | | | |_ ',
  '/_/   \\_\\___|_/_/   \\_\\__, |\\___|_| |_|\\__|',
  '              |_____|___/                  ',
];


/**
 * 状态图标
 */
export const STATUS_ICONS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '○',
  inProgress: '◐',
  completed: '●',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};


/**
 * 工具图标
 */
export const TOOL_ICONS: Record<string, string> = {
  bash: '⚡',
  read_file: '📄',
  write_file: '✏️',
  edit_file: '📝',
  Glob: '🔍',
  Grep: '🔎',
  TodoWrite: '📋',
  Skill: '🎯',
  Task: '🤖',
  EnterPlanMode: '📐',
  ExitPlanMode: '✅',
  WebFetch: '🌐',
  WebSearch: '🔍',
  AskUserQuestion: '❓',
};

/**
 * 默认工具图标
 */
export const DEFAULT_ICON = '🔧';
