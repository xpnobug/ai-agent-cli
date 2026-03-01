/**
 * statusline 配置
 */

import { loadUserConfig, saveUserConfig } from '../config/configStore.js';

type UserSettings = {
  statusLine?: unknown;
  [key: string]: unknown;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getStatusLineCommand(): string | null {
  const config = loadUserConfig() as UserSettings | null;
  if (!config) return null;

  const raw = config.statusLine;
  if (typeof raw === 'string') return normalizeString(raw);
  if (raw && typeof raw === 'object') {
    const cmd = (raw as { command?: unknown }).command;
    return normalizeString(cmd);
  }
  return null;
}

export function setStatusLineCommand(command: string | null): boolean {
  const config = loadUserConfig() as UserSettings | null;
  if (!config) return false;

  const next: UserSettings = { ...config };
  if (command === null) {
    delete next.statusLine;
  } else {
    next.statusLine = command;
  }

  saveUserConfig(next as any);
  return true;
}
