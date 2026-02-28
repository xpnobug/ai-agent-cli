/**
 * WebFetch 缓存
 * 15 分钟 TTL 的 URL 内容缓存，减少重复请求
 */

/**
 * 缓存条目
 */
interface CacheEntry {
  content: string;
  timestamp: number;
  url: string;
}

/**
 * 默认 TTL: 15 分钟
 */
const DEFAULT_TTL = 15 * 60 * 1000;

/**
 * 最大缓存条目数
 */
const MAX_ENTRIES = 50;

/**
 * URL 内容缓存
 */
export class FetchCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttl: number = DEFAULT_TTL) {
    this.ttl = ttl;
  }

  /**
   * 获取缓存内容
   */
  get(url: string): string | undefined {
    const entry = this.cache.get(url);
    if (!entry) return undefined;

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(url);
      return undefined;
    }

    return entry.content;
  }

  /**
   * 设置缓存内容
   */
  set(url: string, content: string): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= MAX_ENTRIES) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(url, {
      content,
      timestamp: Date.now(),
      url,
    });
  }

  /**
   * 检查是否有缓存
   */
  has(url: string): boolean {
    return this.get(url) !== undefined;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清除过期条目
   */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }
}

// 单例缓存实例
let cacheInstance: FetchCache | null = null;

export function getFetchCache(): FetchCache {
  if (!cacheInstance) {
    cacheInstance = new FetchCache();
  }
  return cacheInstance;
}
