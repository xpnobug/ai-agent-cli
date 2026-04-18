/**
 * 路径处理工具
 *
 * 提供跨平台的路径规范化与 ~ 展开。Windows 下 POSIX 风格路径
 * （/c/Users/...）会被尽力识别并转换成 Windows 风格（C:\...）。
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/** 平台判定（本地实现） */
function currentPlatform(): 'macos' | 'windows' | 'linux' | 'other' {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  return 'other';
}

/**
 * Windows 下：/c/Users/... → C:\Users\...
 * 匹配失败 / 非 Windows → 返回原串。
 */
function posixToWindowsPath(p: string): string {
  const match = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (!match) return p;
  const drive = match[1]!.toUpperCase();
  const rest = match[2]!.replace(/\//g, '\\');
  return `${drive}:\\${rest}`;
}

/**
 * 展开含 ~ 的路径为绝对路径；相对路径按 baseDir 解析。
 *
 * 安全性：
 *   - 拒绝包含 \0 的路径
 *   - 拒绝非字符串入参
 *
 * @example
 * expandPath('~')                     // 用户家目录
 * expandPath('~/Documents')           // $HOME/Documents
 * expandPath('./src', '/project')     // /project/src
 * expandPath('/absolute/path')        // /absolute/path
 */
export function expandPath(p: string, baseDir?: string): string {
  const actualBaseDir = baseDir ?? process.cwd();

  if (typeof p !== 'string') {
    throw new TypeError(`路径必须是字符串，实际是 ${typeof p}`);
  }
  if (typeof actualBaseDir !== 'string') {
    throw new TypeError(`baseDir 必须是字符串，实际是 ${typeof actualBaseDir}`);
  }
  if (p.includes('\0') || actualBaseDir.includes('\0')) {
    throw new Error('路径包含 null 字节');
  }

  const trimmed = p.trim();
  if (!trimmed) {
    return path.normalize(actualBaseDir).normalize('NFC');
  }
  if (trimmed === '~') {
    return os.homedir().normalize('NFC');
  }
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2)).normalize('NFC');
  }

  let processed = trimmed;
  if (currentPlatform() === 'windows' && /^\/[a-z]\//i.test(trimmed)) {
    try {
      processed = posixToWindowsPath(trimmed);
    } catch {
      processed = trimmed;
    }
  }

  if (path.isAbsolute(processed)) {
    return path.normalize(processed).normalize('NFC');
  }
  return path.resolve(actualBaseDir, processed).normalize('NFC');
}

/**
 * 把绝对路径转成相对 cwd 的路径（用于减少工具输出 token）。
 * 若相对路径会跑到 cwd 之外（以 .. 开头），保持绝对路径避免歧义。
 */
export function toRelativePath(
  absolutePath: string,
  cwd: string = process.cwd(),
): string {
  const rel = path.relative(cwd, absolutePath);
  return rel.startsWith('..') ? absolutePath : rel;
}

/**
 * 给一个文件或目录路径，返回其"目录"。
 * 是目录 → 原路径；是文件或不存在 → 父目录。
 *
 * UNC 路径（\\\\server\\share 或 //server/share）不 stat，
 * 避免触发 NTLM 凭据泄漏。
 */
export function getDirectoryForPath(p: string): string {
  const abs = expandPath(p);

  if (abs.startsWith('\\\\') || abs.startsWith('//')) {
    return path.dirname(abs);
  }
  try {
    const stats = fs.statSync(abs);
    if (stats.isDirectory()) {
      return abs;
    }
  } catch {
    // 不存在 / 无权限：走父目录
  }
  return path.dirname(abs);
}

/** 是否包含 ../ 这类向上跳的段 */
export function containsPathTraversal(p: string): boolean {
  return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(p);
}

/**
 * 规范化路径以便作为 JSON 配置的 key：
 *   - 先用 path.normalize 处理 . / ..
 *   - 再把反斜杠统一替换为正斜杠
 * 保证 Windows 下 "C:\x" 和 "C:/x" 得到相同的 JSON key。
 */
export function normalizePathForConfigKey(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}
