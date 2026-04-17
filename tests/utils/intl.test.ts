import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGraphemeSegmenter,
  getWordSegmenter,
  firstGrapheme,
  lastGrapheme,
  getRelativeTimeFormat,
  getTimeZone,
  getSystemLocaleLanguage,
  _clearIntlCacheForTest,
} from '../../src/utils/intl.js';

beforeEach(() => _clearIntlCacheForTest());

describe('segmenters 懒加载 + 缓存', () => {
  it('grapheme 与 word segmenter 返回稳定单例', () => {
    expect(getGraphemeSegmenter()).toBe(getGraphemeSegmenter());
    expect(getWordSegmenter()).toBe(getWordSegmenter());
  });

  it('grapheme 与 word 是不同实例', () => {
    expect(getGraphemeSegmenter()).not.toBe(getWordSegmenter());
  });
});

describe('firstGrapheme / lastGrapheme', () => {
  it('空串返回空串', () => {
    expect(firstGrapheme('')).toBe('');
    expect(lastGrapheme('')).toBe('');
  });

  it('ASCII 字符', () => {
    expect(firstGrapheme('hello')).toBe('h');
    expect(lastGrapheme('hello')).toBe('o');
  });

  it('中日韩：按 grapheme 取', () => {
    expect(firstGrapheme('你好')).toBe('你');
    expect(lastGrapheme('你好')).toBe('好');
  });

  it('emoji 不被 UTF-16 拆开', () => {
    expect(firstGrapheme('👨‍👩‍👧')).toBe('👨‍👩‍👧');
    expect(lastGrapheme('ok👨‍👩‍👧')).toBe('👨‍👩‍👧');
  });
});

describe('getRelativeTimeFormat 缓存', () => {
  it('相同 style/numeric/locale 返回同一实例', () => {
    const a = getRelativeTimeFormat('long', 'auto');
    const b = getRelativeTimeFormat('long', 'auto');
    expect(a).toBe(b);
  });

  it('不同参数返回不同实例', () => {
    const a = getRelativeTimeFormat('long', 'auto');
    const c = getRelativeTimeFormat('short', 'auto');
    expect(a).not.toBe(c);
  });
});

describe('getTimeZone / getSystemLocaleLanguage', () => {
  it('getTimeZone 返回非空字符串', () => {
    const tz = getTimeZone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('getSystemLocaleLanguage 在标准环境下返回 2-3 字母的语言码', () => {
    const lang = getSystemLocaleLanguage();
    if (lang !== undefined) {
      expect(lang).toMatch(/^[a-z]{2,3}$/i);
    }
  });
});
