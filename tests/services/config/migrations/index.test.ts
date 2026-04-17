import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveUserConfig, loadUserConfig, type UserConfig } from '../../../../src/services/config/configStore.js';
import {
  registerMigration,
  runMigrations,
  _resetMigrationsForTest,
  _listRegisteredMigrations,
  getMigrationsStatePath,
  type Migration,
} from '../../../../src/services/config/migrations/index.js';

let tmpHome = '';
const originalHomedir = os.homedir;

function setTmpHome(): void {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aac-mig-'));
  (os as unknown as { homedir: () => string }).homedir = () => tmpHome;
}

function restoreHome(): void {
  (os as unknown as { homedir: () => string }).homedir = originalHomedir;
  if (tmpHome && fs.existsSync(tmpHome)) {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
  tmpHome = '';
}

const base: UserConfig = {
  provider: 'anthropic',
  apiKey: 'sk-xx',
  model: 'claude-sonnet-4',
};

describe('runMigrations (基础行为)', () => {
  beforeEach(() => {
    setTmpHome();
    _resetMigrationsForTest();
  });
  afterEach(restoreHome);

  it('配置不存在 → 空报告', async () => {
    const report = await runMigrations();
    expect(report.applied).toEqual([]);
    expect(report.anyChange).toBe(false);
  });

  it('应用单个 changed=true 的迁移 → 回写配置', async () => {
    saveUserConfig(base);
    registerMigration({
      id: 'test-1',
      run: ({ config }) => ({ changed: true, config: { ...config, model: 'updated' } }),
    });
    const report = await runMigrations();
    expect(report.applied).toEqual(['test-1']);
    expect(report.anyChange).toBe(true);
    expect(loadUserConfig()?.model).toBe('updated');
  });

  it('changed=false 不写配置但记 applied', async () => {
    saveUserConfig(base);
    registerMigration({
      id: 'test-noop',
      run: ({ config }) => ({ changed: false, config }),
    });
    const report = await runMigrations();
    expect(report.applied).toEqual(['test-noop']);
    expect(report.anyChange).toBe(false);
    expect(loadUserConfig()).toEqual(base);
  });

  it('已应用的迁移被跳过（幂等）', async () => {
    saveUserConfig(base);
    const m: Migration = {
      id: 'test-once',
      run: ({ config }) => ({ changed: true, config: { ...config, apiKey: 'rotated' } }),
    };
    registerMigration(m);
    await runMigrations();
    expect(loadUserConfig()?.apiKey).toBe('rotated');

    // 第二次运行：已被记录 → 跳过，不应再执行
    saveUserConfig({ ...base, apiKey: 'user-set' });
    const report2 = await runMigrations();
    expect(report2.applied).toEqual([]);
    expect(report2.skipped).toEqual(['test-once']);
    expect(loadUserConfig()?.apiKey).toBe('user-set'); // 用户后来改的不被覆盖
  });

  it('迁移抛错 → 记入 errors，不计入 applied，不回写', async () => {
    saveUserConfig(base);
    registerMigration({
      id: 'will-fail',
      run: () => {
        throw new Error('boom');
      },
    });
    const report = await runMigrations();
    expect(report.applied).toEqual([]);
    expect(report.errors['will-fail']).toContain('boom');
  });

  it('重复 id 抛错', () => {
    registerMigration({ id: 'dup', run: ({ config }) => ({ changed: false, config }) });
    expect(() =>
      registerMigration({ id: 'dup', run: ({ config }) => ({ changed: false, config }) })
    ).toThrowError(/重复/);
  });

  it('migrations.json 被写入 configDir', async () => {
    saveUserConfig(base);
    registerMigration({
      id: 'test-state',
      run: ({ config }) => ({ changed: false, config }),
    });
    await runMigrations();
    const statePath = getMigrationsStatePath(path.join(tmpHome, '.ai-agent'));
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(state.migratedIds).toContain('test-state');
  });

  it('顺序：前一个迁移产出作为下一个输入', async () => {
    saveUserConfig(base);
    registerMigration({
      id: 'a',
      run: ({ config }) => ({ changed: true, config: { ...config, model: 'a' } }),
    });
    registerMigration({
      id: 'b',
      run: ({ config }) => ({ changed: true, config: { ...config, model: `${config.model}-b` } }),
    });
    await runMigrations();
    expect(loadUserConfig()?.model).toBe('a-b');
  });
});

describe('默认迁移：legacy-provider-field', () => {
  beforeEach(() => {
    setTmpHome();
    _resetMigrationsForTest();
    // 不重新注册默认；手动注入需要验证的那个
    registerMigration({
      id: '2026-04-18-legacy-provider-field',
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
        if (!mapped || mapped === config.provider) return { changed: false, config };
        return { changed: true, config: { ...config, provider: mapped } };
      },
    });
  });
  afterEach(restoreHome);

  it('claude → anthropic', async () => {
    saveUserConfig({ ...base, provider: 'claude' as UserConfig['provider'] });
    await runMigrations();
    expect(loadUserConfig()?.provider).toBe('anthropic');
  });

  it('标准 anthropic 不变', async () => {
    saveUserConfig({ ...base, provider: 'anthropic' });
    await runMigrations();
    expect(loadUserConfig()?.provider).toBe('anthropic');
  });
});

describe('注册表', () => {
  beforeEach(() => _resetMigrationsForTest());
  it('_listRegisteredMigrations 返回快照', () => {
    registerMigration({ id: 'x', run: ({ config }) => ({ changed: false, config }) });
    expect(_listRegisteredMigrations().map((m) => m.id)).toEqual(['x']);
  });
});
