/**
 * UUID 工具
 */

import { randomBytes, randomUUID } from 'node:crypto';

export function generateUuid(): string {
  try {
    return randomUUID();
  } catch {
    return randomUuidFallback();
  }
}

/**
 * 严格版 UUID 校验：版本号必须为 1-5、variant 必须是 8/9/a/b。
 * 适合校验 randomUUID() 自己生成的 ID。
 */
export function isUuid(value: string): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 宽松版 UUID 校验：只看 8-4-4-4-12 hex 格式，不强制 version / variant。
 * 适合校验外部输入的 UUID（如来自别的系统的历史 ID）。
 */
export function validateUuid(maybeUuid: unknown): string | null {
  if (typeof maybeUuid !== 'string') return null;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return re.test(maybeUuid) ? maybeUuid : null;
}

/**
 * 生成 agent ID。
 * 格式：`a{label-}{16 hex}`，label 省略时例如 `aa3f2c1b4d5e6f7a`。
 * 带前缀 `a` 与 task ID 形态一致，便于日志区分。
 */
export function createAgentId(label?: string): string {
  const suffix = randomBytes(8).toString('hex');
  return label ? `a${label}-${suffix}` : `a${suffix}`;
}

function randomUuidFallback(): string {
  return [
    randomHex(4),
    randomHex(2),
    randomHex(2),
    randomHex(2),
    randomHex(6),
  ].join('-');
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
