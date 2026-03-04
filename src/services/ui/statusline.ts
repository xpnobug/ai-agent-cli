/**
 * statusline 配置
 */

import { loadUserConfig, saveUserConfig, type UserConfig } from '../config/configStore.js';

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getStatusLineCommand(): string | null {
  const config = loadUserConfig();
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
  const config = loadUserConfig();
  if (!config) return false;

  const next: UserConfig = { ...config };
  if (command === null) {
    delete next.statusLine;
  } else {
    next.statusLine = command;
  }

  saveUserConfig(next);
  return true;
}
