/**
 * 会话 JSONL 加载
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Message } from '../../core/types.js';
import { getSessionProjectDir } from './sessionLog.js';
import { generateUuid, isUuid } from '../../utils/uuid.js';

type JsonlUserEntry = {
  type: 'user';
  sessionId?: string;
  uuid?: string;
  message?: Message;
  toolUseResult?: unknown;
  isApiErrorMessage?: boolean;
};

type JsonlAssistantEntry = {
  type: 'assistant';
  sessionId?: string;
  uuid?: string;
  message?: Message;
  isApiErrorMessage?: boolean;
  requestId?: string;
};

type JsonlSummaryEntry = {
  type: 'summary';
  summary?: string;
  leafUuid?: string;
};

type JsonlCustomTitleEntry = {
  type: 'custom-title';
  sessionId?: string;
  customTitle?: string;
};

type JsonlTagEntry = {
  type: 'tag';
  sessionId?: string;
  tag?: string;
};

type JsonlFileHistorySnapshotEntry = {
  type: 'file-history-snapshot';
  messageId?: string;
  snapshot?: unknown;
  isSnapshotUpdate?: boolean;
};

type JsonlEntry =
  | JsonlUserEntry
  | JsonlAssistantEntry
  | JsonlSummaryEntry
  | JsonlCustomTitleEntry
  | JsonlTagEntry
  | JsonlFileHistorySnapshotEntry
  | Record<string, unknown>;

function safeParseJson(line: string): unknown | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getEntryType(entry: JsonlEntry): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const typeValue = (entry as { type?: unknown }).type;
  return typeof typeValue === 'string' ? typeValue : null;
}

function isUserEntry(entry: JsonlEntry): entry is JsonlUserEntry {
  return getEntryType(entry) === 'user';
}

function isAssistantEntry(entry: JsonlEntry): entry is JsonlAssistantEntry {
  return getEntryType(entry) === 'assistant';
}

function isSummaryEntry(entry: JsonlEntry): entry is JsonlSummaryEntry {
  return getEntryType(entry) === 'summary';
}

function isCustomTitleEntry(entry: JsonlEntry): entry is JsonlCustomTitleEntry {
  return getEntryType(entry) === 'custom-title';
}

function isTagEntry(entry: JsonlEntry): entry is JsonlTagEntry {
  return getEntryType(entry) === 'tag';
}

function isFileHistorySnapshotEntry(entry: JsonlEntry): entry is JsonlFileHistorySnapshotEntry {
  return getEntryType(entry) === 'file-history-snapshot';
}

function normalizeLoadedMessage(entry: JsonlUserEntry | JsonlAssistantEntry, role: 'user' | 'assistant'): Message | null {
  if (!entry.message) return null;
  const raw = entry.message as Message & { uuid?: string };
  const uuid = entry.uuid || raw.uuid || generateUuid();

  return {
    role,
    content: raw.content,
    usage: raw.usage,
    uuid,
  };
}

export type SessionLogData = {
  messages: Message[];
  summaries: Map<string, string>;
  customTitles: Map<string, string>;
  tags: Map<string, string>;
  fileHistorySnapshots: Map<string, JsonlFileHistorySnapshotEntry>;
};

export function loadSessionLogData(args: { cwd: string; sessionId: string }): SessionLogData {
  const { cwd, sessionId } = args;
  const projectDir = getSessionProjectDir(cwd);
  const filePath = join(projectDir, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) {
    throw new Error(`未找到会话: ${sessionId}`);
  }

  const lines = readFileSync(filePath, 'utf8').split('\n');
  const messages: Message[] = [];
  const summaries = new Map<string, string>();
  const customTitles = new Map<string, string>();
  const tags = new Map<string, string>();
  const fileHistorySnapshots = new Map<string, JsonlFileHistorySnapshotEntry>();

  for (const line of lines) {
    const raw = safeParseJson(line.trim());
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as JsonlEntry;

    if (isUserEntry(entry)) {
      if (entry.sessionId && entry.sessionId !== sessionId) continue;
      const msg = normalizeLoadedMessage(entry, 'user');
      if (msg) messages.push(msg);
      continue;
    }

    if (isAssistantEntry(entry)) {
      if (entry.sessionId && entry.sessionId !== sessionId) continue;
      const msg = normalizeLoadedMessage(entry, 'assistant');
      if (msg) messages.push(msg);
      continue;
    }

    if (isSummaryEntry(entry)) {
      const leafUuid = typeof entry.leafUuid === 'string' ? entry.leafUuid : '';
      const summary = typeof entry.summary === 'string' ? entry.summary : '';
      if (leafUuid && summary) summaries.set(leafUuid, summary);
      continue;
    }

    if (isCustomTitleEntry(entry)) {
      const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
      const title = typeof entry.customTitle === 'string' ? entry.customTitle : '';
      if (id && title) customTitles.set(id, title);
      continue;
    }

    if (isTagEntry(entry)) {
      const id = typeof entry.sessionId === 'string' ? entry.sessionId : '';
      const tag = typeof entry.tag === 'string' ? entry.tag : '';
      if (id && tag) tags.set(id, tag);
      continue;
    }

    if (isFileHistorySnapshotEntry(entry)) {
      const messageId = typeof entry.messageId === 'string' ? entry.messageId : '';
      if (messageId) fileHistorySnapshots.set(messageId, entry);
      continue;
    }
  }

  return { messages, summaries, customTitles, tags, fileHistorySnapshots };
}

export function loadSessionMessages(args: { cwd: string; sessionId: string }): Message[] {
  return loadSessionLogData(args).messages;
}

export function findMostRecentSessionId(cwd: string): string | null {
  const projectDir = getSessionProjectDir(cwd);
  if (!existsSync(projectDir)) return null;

  const candidates = readdirSync(projectDir)
    .filter((name) => name.endsWith('.jsonl'))
    .filter((name) => !name.startsWith('agent-'))
    .map((name) => ({
      sessionId: basename(name, '.jsonl'),
      path: join(projectDir, name),
    }))
    .filter((c) => isUuid(c.sessionId));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    try {
      return statSync(b.path).mtimeMs - statSync(a.path).mtimeMs;
    } catch {
      return 0;
    }
  });

  return candidates[0]?.sessionId ?? null;
}
