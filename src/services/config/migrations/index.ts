/**
 * 配置迁移系统
 *
 * 当 UserConfig 字段语义变化（改名 / 改格式 / 补默认值）时，
 * 用迁移项集中承载"老版本 → 新版本"的改动，保证用户升级后配置可用。
 *
 * 设计要点：
 * - 每个 migration 有唯一 id，执行成功后写入 migratedIds，下次跳过（幂等）。
 * - 迁移函数必须是纯函数 + 可失败：返回 { changed, config } 或抛错。
 * - 迁移失败不应污染原配置；runner 只在所有迁移成功时才覆写文件。
 */

import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import {
  getConfigDir,
  loadUserConfig,
  saveUserConfig,
  type UserConfig,
} from '../configStore.js';

/** 执行上下文，避免迁移直接读环境变量 / 写磁盘 */
export interface MigrationContext {
  /** 当前配置快照；迁移可读，不应就地改（返回新对象） */
  config: UserConfig;
  /** 用户级配置目录（测试可注入） */
  configDir: string;
}

/** 迁移结果 */
export interface MigrationResult {
  /** true 表示配置有变更，需要回写 */
  changed: boolean;
  /** 新的配置对象（即使 changed=false 也要返回同一引用，便于链式传递） */
  config: UserConfig;
  /** 诊断信息 */
  note?: string;
}

/** 单个迁移项 */
export interface Migration {
  id: string;
  description?: string;
  run: (ctx: MigrationContext) => MigrationResult | Promise<MigrationResult>;
}

const MIGRATIONS: Migration[] = [];

/** 注册迁移（测试 / 扩展可手动追加，默认迁移在本模块底部调用） */
export function registerMigration(m: Migration): void {
  if (MIGRATIONS.some((x) => x.id === m.id)) {
    throw new Error(`重复的迁移 id: ${m.id}`);
  }
  MIGRATIONS.push(m);
}

/** 仅供测试使用：清空注册表 */
export function _resetMigrationsForTest(): void {
  MIGRATIONS.length = 0;
}

/** 仅供测试使用：读取注册表 */
export function _listRegisteredMigrations(): ReadonlyArray<Migration> {
  return MIGRATIONS.slice();
}

/** 已应用迁移记录文件位置：与 config.json 同目录下的 migrations.json */
export function getMigrationsStatePath(configDir = getConfigDir()): string {
  return path.join(configDir, 'migrations.json');
}

interface MigrationsState {
  migratedIds: string[];
}

function loadState(configDir: string): MigrationsState {
  try {
    const p = getMigrationsStatePath(configDir);
    if (!fs.existsSync(p)) return { migratedIds: [] };
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as MigrationsState;
    return { migratedIds: Array.isArray(raw.migratedIds) ? raw.migratedIds : [] };
  } catch {
    return { migratedIds: [] };
  }
}

function saveState(configDir: string, state: MigrationsState): void {
  fs.ensureDirSync(configDir);
  fs.writeFileSync(getMigrationsStatePath(configDir), JSON.stringify(state, null, 2), 'utf-8');
}

export interface RunMigrationsReport {
  applied: string[];
  skipped: string[];
  anyChange: boolean;
  /** 整个流程中迁移函数抛错的 id → message */
  errors: Record<string, string>;
}

/**
 * 运行所有已注册迁移。
 * 若 config 为 null（未初始化），直接返回，不执行任何迁移。
 */
export async function runMigrations(options?: {
  configDir?: string;
  migrations?: Migration[];
}): Promise<RunMigrationsReport> {
  const configDir = options?.configDir ?? getConfigDir();
  const migrations = options?.migrations ?? MIGRATIONS.slice();

  const report: RunMigrationsReport = {
    applied: [],
    skipped: [],
    anyChange: false,
    errors: {},
  };

  const current = loadUserConfig();
  if (!current) return report;

  const state = loadState(configDir);
  const appliedSet = new Set(state.migratedIds);

  let config = current;
  for (const m of migrations) {
    if (appliedSet.has(m.id)) {
      report.skipped.push(m.id);
      continue;
    }
    try {
      const result = await m.run({ config, configDir });
      config = result.config;
      if (result.changed) report.anyChange = true;
      appliedSet.add(m.id);
      report.applied.push(m.id);
    } catch (err) {
      report.errors[m.id] = err instanceof Error ? err.message : String(err);
      // 单个失败不影响其他独立迁移，但失败项不计入已应用
    }
  }

  // 只在所有处理结束后原子落盘，避免中途崩溃留下脏配置
  if (report.anyChange) {
    saveUserConfig(config);
  }
  saveState(configDir, { migratedIds: Array.from(appliedSet) });

  return report;
}

// ─── 样板迁移 ──────────────────────────────────────────────────────────
// 用 registerMigration 声明默认迁移项，保持集中、可查。
// 新增迁移时追加条目即可；不要修改已发布的旧 id。

registerMigration({
  id: '2026-04-18-legacy-provider-field',
  description: '历史 provider 字段允许大写 / 别名，规范为小写枚举',
  run: ({ config }) => {
    const raw = String(config.provider || '').toLowerCase();
    const alias: Record<string, UserConfig['provider']> = {
      anthropic: 'anthropic',
      claude: 'anthropic',
      openai: 'openai',
      gpt: 'openai',
      gemini: 'gemini',
      google: 'gemini',
    };
    const mapped = alias[raw];
    if (!mapped || mapped === config.provider) {
      return { changed: false, config };
    }
    return {
      changed: true,
      config: { ...config, provider: mapped },
      note: `provider: ${config.provider} → ${mapped}`,
    };
  },
});

registerMigration({
  id: '2026-04-18-mascot-default',
  description: '为老用户补默认吉祥物，和 Onboarding 新默认对齐',
  run: ({ config }) => {
    if (config.mascot) return { changed: false, config };
    return {
      changed: true,
      config: { ...config, mascot: 'default' },
      note: 'mascot: <unset> → default',
    };
  },
});

/** 默认 HOME 推断（用于 CLI 启动点的入口便捷函数） */
export function defaultConfigDir(): string {
  return path.join(os.homedir(), '.ai-agent');
}
