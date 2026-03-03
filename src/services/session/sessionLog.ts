/**
 * 会话 JSONL 存储
 */

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Message } from '../../core/types.js';
import { VERSION } from '../../core/constants.js';
import { getConfigDir } from '../config/configStore.js';
import { getSessionId } from './sessionId.js';
import { PLAN_SLUG_ADJECTIVES, PLAN_SLUG_NOUNS, PLAN_SLUG_VERBS } from './planSlugWords.js';
import { generateUuid } from '../../utils/uuid.js';

type PersistTarget =
  | { kind: 'session'; sessionId: string }
  | { kind: 'agent'; agentId: string };

type JsonlEnvelopeBase = {
  cwd: string;
  sessionId: string;
  version: string;
  gitBranch?: string;
  userType: string;
  isSidechain: boolean;
  parentUuid: string | null;
  logicalParentUuid?: string;
  agentId: string;
  slug: string;
  uuid: string;
  timestamp: string;
};

type SessionJsonlEntry =
  | (JsonlEnvelopeBase & {
      type: 'user';
      message: Message;
      toolUseResult?: unknown;
    })
  | (JsonlEnvelopeBase & {
      type: 'assistant';
      message: Message;
      requestId?: string;
      isApiErrorMessage?: boolean;
    })
  | { type: 'summary'; summary: string; leafUuid: string }
  | { type: 'custom-title'; sessionId: string; customTitle: string }
  | { type: 'tag'; sessionId: string; tag: string }
  | {
      type: 'file-history-snapshot';
      messageId: string;
      snapshot: {
        messageId: string;
        trackedFileBackups: Record<string, unknown>;
        timestamp: string;
      };
      isSnapshotUpdate: boolean;
    };

function getSessionStoreBaseDir(): string {
  return process.env.AI_AGENT_SESSION_DIR ?? getConfigDir();
}

export function sanitizeProjectNameForSessionStore(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

export function getSessionProjectsDir(): string {
  return join(getSessionStoreBaseDir(), 'projects');
}

export function getSessionProjectDir(cwd: string): string {
  return join(getSessionProjectsDir(), sanitizeProjectNameForSessionStore(cwd));
}

export function getSessionLogFilePath(args: {
  cwd: string;
  sessionId: string;
}): string {
  return join(getSessionProjectDir(args.cwd), `${args.sessionId}.jsonl`);
}

export function getAgentLogFilePath(args: {
  cwd: string;
  agentId: string;
}): string {
  return join(getSessionProjectDir(args.cwd), `agent-${args.agentId}.jsonl`);
}

function safeMkdir(dir: string): void {
  if (existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
}

function safeEnsureFile(path: string): void {
  safeMkdir(dirname(path));
  if (!existsSync(path)) writeFileSync(path, '', 'utf8');
}

function safeAppendJsonl(path: string, record: unknown): void {
  try {
    safeEnsureFile(path);
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
  } catch {
  }
}

const lastUuidByFile = new Map<string, string | null>();
const snapshotWrittenByFile = new Set<string>();
const slugBySessionId = new Map<string, string>();
let currentSessionCustomTitle: string | null = null;
let currentSessionTag: string | null = null;

type LastPersistedInfo = { uuid: string | null; slug: string | null };

function safeReadLastPersistedInfo(filePath: string): LastPersistedInfo {
  try {
    if (!existsSync(filePath)) return { uuid: null, slug: null };
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let lastSlug: string | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== 'object') continue;

      if (!lastSlug && typeof parsed.slug === 'string' && parsed.slug.trim()) {
        lastSlug = parsed.slug.trim();
      }

      if (typeof parsed.uuid === 'string' && parsed.uuid) {
        return { uuid: parsed.uuid, slug: lastSlug };
      }
    }

    return { uuid: null, slug: lastSlug };
  } catch {
    return { uuid: null, slug: null };
  }
}

function pickIndex(length: number): number {
  return randomBytes(4).readUInt32BE(0) % length;
}

function pickWord(words: readonly string[]): string {
  return words[pickIndex(words.length)]!;
}

function generateSessionSlug(): string {
  const adjective = pickWord(PLAN_SLUG_ADJECTIVES);
  const verb = pickWord(PLAN_SLUG_VERBS);
  const noun = pickWord(PLAN_SLUG_NOUNS);
  return `${adjective}-${verb}-${noun}`;
}

function getOrCreateSessionSlug(sessionId: string): string {
  const existing = slugBySessionId.get(sessionId);
  if (existing) return existing;
  const slug = generateSessionSlug();
  slugBySessionId.set(sessionId, slug);
  return slug;
}

type GitBranchCacheEntry = { cwd: string; value: string | undefined };
let gitBranchCache: GitBranchCacheEntry | null = null;

function getGitBranchBestEffort(cwd: string): string | undefined {
  if (gitBranchCache && gitBranchCache.cwd === cwd) return gitBranchCache.value;

  let value: string | undefined;
  try {
    const stdout = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 750,
    });
    const branch = stdout.toString('utf8').trim();
    value = branch || undefined;
  } catch {
    value = undefined;
  }

  gitBranchCache = { cwd, value };
  return value;
}

function ensureFileHistorySnapshot(
  filePath: string,
  firstMessageUuid: string,
): void {
  if (snapshotWrittenByFile.has(filePath)) return;

  try {
    safeEnsureFile(filePath);
    const size = statSync(filePath).size;
    if (size > 0) {
      snapshotWrittenByFile.add(filePath);
      return;
    }
  } catch {
  }

  const now = new Date().toISOString();
  safeAppendJsonl(filePath, {
    type: 'file-history-snapshot',
    messageId: firstMessageUuid,
    snapshot: {
      messageId: firstMessageUuid,
      trackedFileBackups: {},
      timestamp: now,
    },
    isSnapshotUpdate: false,
  } satisfies SessionJsonlEntry);

  snapshotWrittenByFile.add(filePath);
}

function resolvePersistTarget(agentId?: string): PersistTarget {
  const id = (agentId ?? 'main').trim() || 'main';
  if (id !== 'main') return { kind: 'agent', agentId: id };
  return { kind: 'session', sessionId: getSessionId() };
}

export function appendSessionJsonlFromMessage(args: {
  message: Message;
  agentId?: string;
}): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const { message, agentId } = args;
  if (message.role !== 'user' && message.role !== 'assistant') return;

  const cwd = process.cwd();
  const userType = (process.env.USER_TYPE ?? 'external').trim() || 'external';
  const sessionId = getSessionId();
  const resolvedAgentId = (agentId ?? 'main').trim() || 'main';
  const isSidechain = resolvedAgentId !== 'main';
  const gitBranch = getGitBranchBestEffort(cwd);

  const target = resolvePersistTarget(resolvedAgentId);
  const filePath =
    target.kind === 'agent'
      ? getAgentLogFilePath({ cwd, agentId: target.agentId })
      : getSessionLogFilePath({ cwd, sessionId: target.sessionId });

  if (!lastUuidByFile.has(filePath)) {
    const info = safeReadLastPersistedInfo(filePath);
    lastUuidByFile.set(filePath, info.uuid);
    if (info.slug) slugBySessionId.set(sessionId, info.slug);
  }
  const previousUuid = lastUuidByFile.get(filePath) ?? null;

  const slug = getOrCreateSessionSlug(sessionId);

  const resolvedUuid = message.uuid || generateUuid();
  if (!message.uuid) {
    message.uuid = resolvedUuid;
  }

  if (target.kind === 'session') {
    ensureFileHistorySnapshot(filePath, resolvedUuid);
  }

  const base: JsonlEnvelopeBase = {
    parentUuid: previousUuid,
    logicalParentUuid: undefined,
    isSidechain,
    userType,
    cwd,
    sessionId,
    version: VERSION,
    ...(gitBranch ? { gitBranch } : {}),
    agentId: resolvedAgentId,
    slug,
    uuid: resolvedUuid,
    timestamp: new Date().toISOString(),
  };

  const record: SessionJsonlEntry =
    message.role === 'user'
      ? {
          ...base,
          type: 'user',
          message,
        }
      : {
          ...base,
          type: 'assistant',
          message,
        };

  safeAppendJsonl(filePath, record);
  lastUuidByFile.set(filePath, resolvedUuid);
}

export function appendSessionSummaryRecord(args: {
  summary: string;
  leafUuid: string;
  sessionId?: string;
}): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const sessionId = args.sessionId ?? getSessionId();
  const cwd = process.cwd();
  safeAppendJsonl(getSessionLogFilePath({ cwd, sessionId }), {
    type: 'summary',
    summary: args.summary,
    leafUuid: args.leafUuid,
  } satisfies SessionJsonlEntry);
}

export function appendSessionCustomTitleRecord(args: {
  sessionId: string;
  customTitle: string;
}): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const cwd = process.cwd();
  safeAppendJsonl(getSessionLogFilePath({ cwd, sessionId: args.sessionId }), {
    type: 'custom-title',
    sessionId: args.sessionId,
    customTitle: args.customTitle,
  } satisfies SessionJsonlEntry);
  if (args.sessionId === getSessionId()) {
    currentSessionCustomTitle = args.customTitle;
  }
}

export function appendSessionTagRecord(args: {
  sessionId: string;
  tag: string;
}): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const cwd = process.cwd();
  safeAppendJsonl(getSessionLogFilePath({ cwd, sessionId: args.sessionId }), {
    type: 'tag',
    sessionId: args.sessionId,
    tag: args.tag,
  } satisfies SessionJsonlEntry);
  if (args.sessionId === getSessionId()) {
    currentSessionTag = args.tag;
  }
}

export function getCurrentSessionCustomTitle(): string | null {
  return currentSessionCustomTitle;
}

export function getCurrentSessionTag(): string | null {
  return currentSessionTag;
}

export function resetSessionJsonlStateForTests(): void {
  lastUuidByFile.clear();
  snapshotWrittenByFile.clear();
  slugBySessionId.clear();
  gitBranchCache = null;
  currentSessionCustomTitle = null;
  currentSessionTag = null;
}
