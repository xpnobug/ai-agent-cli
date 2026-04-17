/**
 * 共享 Intl 实例（懒加载 + 缓存）
 *
 * Intl 构造器创建成本 ~0.05-0.1ms，跨模块反复 new 不划算。
 * 这里用懒加载 + 模块内缓存，让热点路径（文字切分、相对时间格式化）
 * 只付一次构造代价。
 */

// 文字切分器：grapheme 与 word，两种粒度各存一个
let graphemeSegmenter: Intl.Segmenter | null = null;
let wordSegmenter: Intl.Segmenter | null = null;

export function getGraphemeSegmenter(): Intl.Segmenter {
  if (!graphemeSegmenter) {
    graphemeSegmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
  }
  return graphemeSegmenter;
}

/** 返回文本中第一个 grapheme 簇；空串返回 '' */
export function firstGrapheme(text: string): string {
  if (!text) return '';
  const segments = getGraphemeSegmenter().segment(text);
  const first = segments[Symbol.iterator]().next().value as
    | { segment: string }
    | undefined;
  return first?.segment ?? '';
}

/** 返回文本中最后一个 grapheme 簇；空串返回 '' */
export function lastGrapheme(text: string): string {
  if (!text) return '';
  let last = '';
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    last = segment;
  }
  return last;
}

export function getWordSegmenter(): Intl.Segmenter {
  if (!wordSegmenter) {
    wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  }
  return wordSegmenter;
}

// 相对时间格式化器按 style:numeric 作 key 缓存
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

export function getRelativeTimeFormat(
  style: 'long' | 'short' | 'narrow',
  numeric: 'always' | 'auto',
  locale: string = 'en',
): Intl.RelativeTimeFormat {
  const key = `${locale}:${style}:${numeric}`;
  let rtf = rtfCache.get(key);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { style, numeric });
    rtfCache.set(key, rtf);
  }
  return rtf;
}

// 时区在进程生命周期内基本不变，缓存一次即可
let cachedTimeZone: string | null = null;

export function getTimeZone(): string {
  if (!cachedTimeZone) {
    cachedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return cachedTimeZone;
}

// 系统 locale 的语言子 tag（如 'en', 'zh'）
// null = 尚未计算；undefined = 计算过但失败（ICU 被剥离的环境），
// 区分两种状态可以避免每次调用都重试。
let cachedSystemLocaleLanguage: string | undefined | null = null;

export function getSystemLocaleLanguage(): string | undefined {
  if (cachedSystemLocaleLanguage === null) {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      cachedSystemLocaleLanguage = new Intl.Locale(locale).language;
    } catch {
      cachedSystemLocaleLanguage = undefined;
    }
  }
  return cachedSystemLocaleLanguage;
}

/** 仅测试使用：清空 locale 缓存 */
export function _clearIntlCacheForTest(): void {
  graphemeSegmenter = null;
  wordSegmenter = null;
  rtfCache.clear();
  cachedTimeZone = null;
  cachedSystemLocaleLanguage = null;
}
