/**
 * 安全工具函数
 * 提供路径安全检查、命令验证等功能
 */

import path from 'node:path';

/**
 * 危险命令模式列表
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i, // rm -rf / 或 rm -rf ~
  /rm\s+-rf\s+\*/i, // rm -rf *
  />\s*\/dev\/sd[a-z]/i, // 写入磁盘设备
  /mkfs\./i, // 格式化命令
  /dd\s+if=/i, // dd 命令
  /:(){ :|:& };:/i, // fork bomb
  /chmod\s+-R\s+777\s+\//i, // 危险权限修改
  /curl.*\|\s*(ba)?sh/i, // curl | bash
  /wget.*\|\s*(ba)?sh/i, // wget | bash
];

/**
 * 只读命令白名单（用于 explore 代理）
 */
const READ_ONLY_COMMANDS = [
  'ls',
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'grep',
  'find',
  'wc',
  'diff',
  'file',
  'stat',
  'du',
  'df',
  'pwd',
  'echo',
  'which',
  'whereis',
  'type',
  'git log',
  'git diff',
  'git status',
  'git show',
  'git branch',
  'git remote',
  'tree',
  'env',
  'printenv',
];

/**
 * 安全路径检查
 * 确保路径在工作目录内，防止路径遍历攻击
 */
export function safePath(workdir: string, filePath: string): string {
  // 解析绝对路径
  const resolved = path.resolve(workdir, filePath);

  // 规范化路径
  const normalizedWorkdir = path.normalize(workdir);
  const normalizedResolved = path.normalize(resolved);

  // 检查是否在工作目录内
  if (!normalizedResolved.startsWith(normalizedWorkdir)) {
    throw new Error(`路径越界: ${filePath} 不在工作目录 ${workdir} 内`);
  }

  return resolved;
}

/**
 * 验证 bash 命令安全性
 */
export function validateBashCommand(command: string): void {
  // 检查危险模式
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`危险命令被阻止: ${command}`);
    }
  }
}

/**
 * 验证只读命令（用于 explore 代理）
 */
export function validateReadOnlyCommand(command: string): void {
  // 提取命令的第一个词
  const firstWord = command.trim().split(/\s+/)[0];

  // 检查是否在白名单中
  const isAllowed = READ_ONLY_COMMANDS.some((allowed) => {
    if (allowed.includes(' ')) {
      // 多词命令（如 git log）
      return command.trim().startsWith(allowed);
    }
    return firstWord === allowed;
  });

  if (!isAllowed) {
    throw new Error(`只读模式下不允许执行: ${command}`);
  }
}

/**
 * 截断过长的输出
 */
export function truncateOutput(output: string, maxLength: number): string {
  if (output.length <= maxLength) {
    return output;
  }

  const truncated = output.slice(0, maxLength);
  const remaining = output.length - maxLength;

  return `${truncated}\n\n... (输出已截断，省略 ${remaining} 字符)`;
}

/**
 * 检查文件扩展名是否安全
 */
export function isSafeFileExtension(filePath: string): boolean {
  const dangerousExtensions = ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd', '.ps1'];
  const ext = path.extname(filePath).toLowerCase();
  return !dangerousExtensions.includes(ext);
}

/**
 * 清理用户输入
 */
export function sanitizeInput(input: string): string {
  // 移除控制字符
  return input.replace(/[\x00-\x1F\x7F]/g, '');
}
