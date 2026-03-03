/**
 * 会话 ID 管理
 */

import { randomUUID } from 'node:crypto';

let currentSessionId: string = randomUUID();

export function setSessionId(nextSessionId: string): void {
  currentSessionId = nextSessionId;
}

export function resetSessionIdForTests(): void {
  currentSessionId = randomUUID();
}

export function getSessionId(): string {
  return currentSessionId;
}
