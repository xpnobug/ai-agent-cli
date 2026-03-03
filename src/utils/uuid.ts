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

export function isUuid(value: string): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
