/**
 * 子代理存储
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

function getConfigDirectory(): string {
  return process.env.AI_AGENT_CONFIG_DIR ?? join(homedir(), '.ai-agent');
}

function getSessionId(): string {
  return process.env.AI_AGENT_SESSION_ID ?? 'default-session';
}

export function getAgentFilePath(agentId: string): string {
  const sessionId = getSessionId();
  const filename = `${sessionId}-agent-${agentId}.json`;
  const configDir = getConfigDirectory();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  return join(configDir, filename);
}

export function readAgentData<T = any>(agentId: string): T | null {
  const filePath = getAgentFilePath(agentId);
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function writeAgentData<T = any>(agentId: string, data: T): void {
  const filePath = getAgentFilePath(agentId);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getDefaultAgentId(): string {
  return 'default';
}

export function resolveAgentId(agentId?: string): string {
  return agentId || getDefaultAgentId();
}

export function generateAgentId(): string {
  return randomUUID();
}
