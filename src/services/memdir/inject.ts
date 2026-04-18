/**
 * 记忆注入 —— 基于用户本轮输入，从 memdir 里找相关记忆并拼成一段
 * 系统提示补充文本。
 *
 * 显式调用而非自动切入 loopGenerator 是刻意选择：
 *   - 每轮都改 systemPrompt 会破 prefix cache
 *   - 是否注入记忆与场景相关（子代理、背景任务可能不需要）
 * 调用方（CLI / Session / 某个 /remember 命令）在合适时机自行使用。
 */

import { findRelevantMemories } from './findRelevantMemories.js';
import { scanMemories } from './memoryScan.js';
import { memoryAge } from './memoryAge.js';
import type { MemoryRecord } from './memoryScan.js';

export interface InjectOptions {
  /** 每次至多注入多少条；默认 5 */
  limit?: number;
  /** 低于此得分不注入；默认 2 */
  minScore?: number;
  /** memdir 根路径；缺省由 memoryScan 走 cwd */
  memdirPath?: string;
  /** memoryScan 的 cwd */
  cwd?: string;
  /** 预扫描好的记忆列表（测试 / 缓存复用时传入，跳过 IO） */
  preloaded?: readonly MemoryRecord[];
  /** 相对时间的 now，便于测试 */
  now?: number;
}

export interface InjectionResult {
  /** 若没有相关记忆返回 null，调用方决定是否拼接 */
  systemReminderBlock: string | null;
  /** 命中的记忆数（用于日志/遥测） */
  hitCount: number;
}

/**
 * 根据用户本轮文本找相关记忆，生成一段 <system-reminder> 包裹的文本。
 *
 * 返回的文本形如：
 * ```
 * <system-reminder>
 * 你有以下 N 条可能相关的记忆（越新越前）：
 *
 * - [user] 用户角色（今天）：xxxxx
 *   正文前 200 字…
 * - [feedback] 简短回复（2 天前）：xxxxx
 *   正文…
 * </system-reminder>
 * ```
 *
 * 未命中返回 { systemReminderBlock: null, hitCount: 0 }。
 */
export async function buildMemoryInjection(
  userInput: string,
  options: InjectOptions = {},
): Promise<InjectionResult> {
  const { limit = 5, minScore = 2, now = Date.now() } = options;

  const memories: readonly MemoryRecord[] = options.preloaded
    ? options.preloaded
    : await scanMemories({ memdirPath: options.memdirPath, cwd: options.cwd });

  if (memories.length === 0) {
    return { systemReminderBlock: null, hitCount: 0 };
  }

  const ranked = findRelevantMemories(userInput, memories, {
    limit,
    minScore,
    now,
  });

  if (ranked.length === 0) {
    return { systemReminderBlock: null, hitCount: 0 };
  }

  const lines: string[] = [
    `你有以下 ${ranked.length} 条可能相关的记忆（越相关越前）：`,
    '',
  ];
  for (const m of ranked) {
    const typeTag = m.type ? `[${m.type}]` : '[未分类]';
    const age = memoryAge(m.mtimeMs);
    const head = `- ${typeTag} ${m.name}（${age}）`;
    const descLine = m.description ? `：${m.description}` : '';
    const bodyPreview = m.body.length > 200 ? `${m.body.slice(0, 200)}…` : m.body;
    lines.push(head + descLine);
    if (bodyPreview) lines.push(`  ${bodyPreview.replace(/\n/g, ' ')}`);
  }

  const block = `<system-reminder>\n${lines.join('\n')}\n</system-reminder>`;
  return { systemReminderBlock: block, hitCount: ranked.length };
}
