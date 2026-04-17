/**
 * 带缓存的系统提示词分段组装
 *
 * 主思路：系统提示由多个"段"组成（工具说明、代理描述、环境信息……）。
 * 绝大部分段在会话内不变，只有少数 volatile 段（比如当前工作区状态）
 * 会每轮重算。把段标记 cacheable / volatile，可以让 prefix cache
 * 尽量稳定，不被 volatile 段意外冲掉。
 *
 * 调用方可以给实例注入外部的 key-value 缓存（便于持久化 / 跨调用共享），
 * 默认使用内部 Map。
 */

export type ComputeFn = () => string | null | Promise<string | null>;

export interface SystemPromptSection {
  /** 段名（作为 cache key，最好唯一稳定） */
  name: string;
  /** 计算函数 */
  compute: ComputeFn;
  /** true 表示每次都重算（会破坏 prefix cache，慎用） */
  cacheBreak: boolean;
}

/** 常规段：会话内计算一次并缓存，直到显式 clear */
export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): SystemPromptSection {
  return { name, compute, cacheBreak: false };
}

/**
 * 易变段：每轮重算，破坏 prefix cache。
 * 命名里带 DANGEROUS 是为了让 reviewer 在 diff 里立刻注意。
 * _reason 仅作文档用途，不参与运行时逻辑。
 */
export function DANGEROUS_uncachedSystemPromptSection(
  name: string,
  compute: ComputeFn,
  _reason: string,
): SystemPromptSection {
  return { name, compute, cacheBreak: true };
}

/** 简易缓存接口，便于注入外部 store / 做测试 */
export interface SectionCache {
  has(name: string): boolean;
  get(name: string): string | null | undefined;
  set(name: string, value: string | null): void;
  clear(): void;
}

function createDefaultCache(): SectionCache {
  const map = new Map<string, string | null>();
  return {
    has: (n) => map.has(n),
    get: (n) => map.get(n),
    set: (n, v) => {
      map.set(n, v);
    },
    clear: () => {
      map.clear();
    },
  };
}

/**
 * 解析所有段并返回字符串数组（保持顺序；null 表示该段此轮未提供内容）。
 * cacheable 段命中缓存时不会调用 compute；volatile 段每次都 compute。
 */
export async function resolveSystemPromptSections(
  sections: SystemPromptSection[],
  cache: SectionCache = createDefaultCache(),
): Promise<(string | null)[]> {
  return Promise.all(
    sections.map(async (s) => {
      if (!s.cacheBreak && cache.has(s.name)) {
        return cache.get(s.name) ?? null;
      }
      const value = await s.compute();
      cache.set(s.name, value);
      return value;
    }),
  );
}

/** 清空所有段缓存；应在 /clear /compact 等重置点调用 */
export function clearSystemPromptSections(cache: SectionCache): void {
  cache.clear();
}

/** 工厂：创建一个独立缓存实例（便于调用方持有） */
export function createSectionCache(): SectionCache {
  return createDefaultCache();
}
