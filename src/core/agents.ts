/**
 * Agent 配置加载器
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import type { AgentType } from './types.js';
import { loadPromptWithVars } from '../services/promptLoader.js';
import { getConfigDir } from '../services/config/configStore.js';

export type AgentSource = 'built-in' | 'userSettings' | 'projectSettings';
export type AgentLocation = 'built-in' | 'user' | 'project';
export type AgentModel = 'inherit' | (string & {});
export type AgentPermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'delegate';

export interface AgentConfig {
  agentType: string;
  whenToUse: string;
  tools: string[] | '*';
  disallowedTools?: string[];
  skills?: string[];
  systemPrompt: string;
  source: AgentSource;
  location: AgentLocation;
  baseDir?: string;
  filename?: string;
  color?: string;
  model?: AgentModel;
  permissionMode?: AgentPermissionMode;
  forkContext?: boolean;
  maxTurns?: number;
  maxTokens?: number;
}

const BUILTIN_AGENTS: AgentConfig[] = [
  {
    agentType: 'explore',
    whenToUse: '只读探索代理，用于搜索和分析代码库',
    tools: ['bash', 'read_file', 'Glob', 'Grep'],
    systemPrompt: loadPromptWithVars('agent/explore.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
  {
    agentType: 'code',
    whenToUse: '实现功能或修复 bug 的全权限代理',
    tools: '*',
    systemPrompt: loadPromptWithVars('agent/code.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
  {
    agentType: 'plan',
    whenToUse: '规划代理，用于设计实施策略',
    tools: ['bash', 'read_file', 'Glob', 'Grep'],
    systemPrompt: loadPromptWithVars('agent/plan.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
  {
    agentType: 'bash',
    whenToUse: '仅执行 bash 命令的代理',
    tools: ['bash', 'read_file'],
    systemPrompt: loadPromptWithVars('agent/bash.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
  {
    agentType: 'guide',
    whenToUse: '查找文档与指南的代理',
    tools: ['read_file', 'Glob', 'Grep'],
    systemPrompt: loadPromptWithVars('agent/guide.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
  {
    agentType: 'general',
    whenToUse: '通用代理，适合复杂综合任务',
    tools: '*',
    systemPrompt: loadPromptWithVars('agent/general.md', {}),
    source: 'built-in',
    location: 'built-in',
    baseDir: 'built-in',
  },
];

const VALID_PERMISSION_MODES: AgentPermissionMode[] = [
  'default',
  'acceptEdits',
  'plan',
  'bypassPermissions',
  'dontAsk',
  'delegate',
];

function sourceToLocation(source: AgentSource): AgentLocation {
  switch (source) {
    case 'userSettings':
      return 'user';
    case 'projectSettings':
      return 'project';
    case 'built-in':
    default:
      return 'built-in';
  }
}

function splitCliList(values: string[]): string[] {
  if (values.length === 0) return [];
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    let current = '';
    let inParens = false;

    for (const ch of value) {
      switch (ch) {
        case '(':
          inParens = true;
          current += ch;
          break;
        case ')':
          inParens = false;
          current += ch;
          break;
        case ',':
          if (inParens) {
            current += ch;
          } else {
            const trimmed = current.trim();
            if (trimmed) out.push(trimmed);
            current = '';
          }
          break;
        default:
          current += ch;
      }
    }

    const trimmed = current.trim();
    if (trimmed) out.push(trimmed);
  }

  return out;
}

function normalizeToolList(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!value) return [];

  let raw: string[] = [];
  if (typeof value === 'string') raw = [value];
  else if (Array.isArray(value)) raw = value.filter((v): v is string => typeof v === 'string');

  if (raw.length === 0) return [];
  const parsed = splitCliList(raw);
  if (parsed.includes('*')) return ['*'];
  return parsed;
}

function normalizeStringArray(value: unknown): string[] {
  const normalized = normalizeToolList(value);
  if (normalized === null) return [];
  return normalized;
}

function readMarkdownFile(filePath: string): { frontmatter: any; content: string } | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    return {
      frontmatter: (parsed.data as any) ?? {},
      content: String(parsed.content ?? ''),
    };
  } catch {
    return null;
  }
}

function listMarkdownFilesRecursively(rootDir: string): string[] {
  const files: string[] = [];
  const visitedDirs = new Set<string>();

  const walk = (dirPath: string) => {
    let dirStat: ReturnType<typeof statSync>;
    try {
      dirStat = statSync(dirPath);
    } catch {
      return;
    }
    if (!dirStat.isDirectory()) return;

    const dirKey = `${dirStat.dev}:${dirStat.ino}`;
    if (visitedDirs.has(dirKey)) return;
    visitedDirs.add(dirKey);

    let entries: Array<{
      name: string;
      isDirectory(): boolean;
      isFile(): boolean;
      isSymbolicLink(): boolean;
    }> = [];
    try {
      entries = readdirSync(dirPath, { withFileTypes: true, encoding: 'utf8' }) as any;
    } catch {
      return;
    }

    for (const entry of entries) {
      const name = String(entry.name ?? '');
      const fullPath = join(dirPath, name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        if (name.endsWith('.md')) files.push(fullPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        try {
          const st = statSync(fullPath);
          if (st.isDirectory()) {
            walk(fullPath);
          } else if (st.isFile() && name.endsWith('.md')) {
            files.push(fullPath);
          }
        } catch {
          continue;
        }
      }
    }
  };

  if (!existsSync(rootDir)) return [];
  walk(rootDir);
  return files;
}

function parseAgentFromFile(options: {
  filePath: string;
  baseDir: string;
  source: AgentSource;
}): AgentConfig | null {
  const parsed = readMarkdownFile(options.filePath);
  if (!parsed) return null;

  const fm = parsed.frontmatter ?? {};
  const name = typeof fm.name === 'string' ? fm.name.trim() : '';
  const description = typeof fm.description === 'string' ? fm.description : '';
  if (!name || !description) return null;

  const whenToUse = description.replace(/\\n/g, '\n');
  const filename = basename(options.filePath, '.md');

  const color = typeof fm.color === 'string' ? fm.color : undefined;

  let modelRaw: unknown = fm.model;
  if (typeof modelRaw !== 'string' && typeof fm.model_name === 'string') {
    modelRaw = fm.model_name;
  }
  let model = typeof modelRaw === 'string' ? modelRaw.trim() : undefined;
  if (model === '') model = undefined;

  const forkContextValue: unknown = fm.forkContext;
  const forkContext = forkContextValue === 'true' || forkContextValue === true;

  const permissionModeValue: unknown = fm.permissionMode;
  const permissionModeIsValid =
    typeof permissionModeValue === 'string' &&
    VALID_PERMISSION_MODES.includes(permissionModeValue as AgentPermissionMode);

  const toolsList = normalizeToolList(fm.tools);
  const tools: string[] | '*' =
    toolsList === null || toolsList.includes('*') ? '*' : toolsList;

  const disallowedRaw =
    fm.disallowedTools ?? fm['disallowed-tools'] ?? fm['disallowed_tools'];
  const disallowedTools = disallowedRaw !== undefined
    ? normalizeToolList(disallowedRaw) ?? []
    : undefined;

  const skills = normalizeStringArray(fm.skills);
  const systemPrompt = parsed.content.trim();

  return {
    agentType: name,
    whenToUse,
    tools,
    ...(disallowedTools !== undefined ? { disallowedTools } : {}),
    ...(skills.length > 0 ? { skills } : { skills: [] }),
    systemPrompt,
    source: options.source,
    location: sourceToLocation(options.source),
    baseDir: options.baseDir,
    filename,
    ...(color ? { color } : {}),
    ...(model ? { model: model as AgentModel } : {}),
    ...(permissionModeIsValid
      ? { permissionMode: permissionModeValue as AgentPermissionMode }
      : {}),
    ...(forkContext ? { forkContext: true } : {}),
  };
}

function getUserAgentDirs(): string[] {
  const root = getConfigDir();
  return [join(root, 'agents')];
}

function findProjectAgentDirs(cwd: string): string[] {
  const result: string[] = [];
  const home = resolve(homedir());
  let current = resolve(cwd);

  while (current !== home) {
    const dir = join(current, '.ai-agent', 'agents');
    if (existsSync(dir)) result.push(dir);

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return result;
}

function scanAgentPaths(options: {
  dirPathOrFile: string;
  baseDir: string;
  source: AgentSource;
}): AgentConfig[] {
  const out: AgentConfig[] = [];

  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(options.dirPathOrFile);
  } catch {
    return [];
  }

  const addFile = (filePath: string) => {
    if (!filePath.endsWith('.md')) return;
    const agent = parseAgentFromFile({
      filePath,
      baseDir: options.baseDir,
      source: options.source,
    });
    if (agent) out.push(agent);
  };

  if (st.isFile()) {
    addFile(options.dirPathOrFile);
    return out;
  }

  if (!st.isDirectory()) return [];

  for (const filePath of listMarkdownFilesRecursively(options.dirPathOrFile)) {
    addFile(filePath);
  }

  return out;
}

function mergeAgents(allAgents: AgentConfig[]): AgentConfig[] {
  const builtIn = allAgents.filter(a => a.source === 'built-in');
  const user = allAgents.filter(a => a.source === 'userSettings');
  const project = allAgents.filter(a => a.source === 'projectSettings');

  const ordered = [builtIn, user, project];
  const map = new Map<string, AgentConfig>();
  for (const group of ordered) {
    for (const agent of group) {
      map.set(agent.agentType, agent);
    }
  }
  return Array.from(map.values());
}

let cachedAgents: AgentConfig[] | null = null;
let cachedCwd: string | null = null;

function loadAllAgents(): AgentConfig[] {
  const cwd = process.cwd();
  if (cachedAgents && cachedCwd === cwd) return cachedAgents;

  const userDirs = getUserAgentDirs();
  const projectDirs = findProjectAgentDirs(cwd);

  const userAgents = userDirs.flatMap(dir =>
    scanAgentPaths({ dirPathOrFile: dir, baseDir: dir, source: 'userSettings' }),
  );
  const projectAgents = projectDirs.flatMap(dir =>
    scanAgentPaths({ dirPathOrFile: dir, baseDir: dir, source: 'projectSettings' }),
  );

  const merged = mergeAgents([...BUILTIN_AGENTS, ...userAgents, ...projectAgents]);
  cachedAgents = merged;
  cachedCwd = cwd;
  return merged;
}

export function getActiveAgents(): AgentConfig[] {
  return loadAllAgents();
}

export function getAvailableAgentTypes(): string[] {
  return getActiveAgents().map(agent => agent.agentType);
}

export function getAgentByType(agentType: AgentType): AgentConfig | undefined {
  return getActiveAgents().find(agent => agent.agentType === agentType);
}

export function getAgentTypeDescriptions(): string {
  return getActiveAgents()
    .map(agent => {
      const toolsStr = agent.tools === '*' ? '*' : agent.tools.join(', ');
      return `- ${agent.agentType}: ${agent.whenToUse} (工具: ${toolsStr})`;
    })
    .join('\n');
}

export function getAgentTypeNames(): AgentType[] {
  return getAvailableAgentTypes();
}
