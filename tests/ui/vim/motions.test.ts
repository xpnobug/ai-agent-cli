import { describe, it, expect } from 'vitest';
import {
  resolveMotion,
  isInclusiveMotion,
  isLinewiseMotion,
  type VimCursor,
} from '../../../src/ui/vim/motions.js';

/**
 * 最小 VimCursor 模拟：把位置记成字符串 tag，
 * 每个方法产生可区分的新 tag，用于追踪 motion 是否被正确调用。
 */
class TagCursor implements VimCursor {
  constructor(public tag = 'origin') {}
  private step(next: string): TagCursor {
    return new TagCursor(next);
  }
  left(): TagCursor { return this.step('left'); }
  right(): TagCursor { return this.step('right'); }
  up(): TagCursor { return this.step('up'); }
  down(): TagCursor { return this.step('down'); }
  upLogicalLine(): TagCursor { return this.step('upLogicalLine'); }
  downLogicalLine(): TagCursor { return this.step('downLogicalLine'); }
  nextVimWord(): TagCursor { return this.step('nextVimWord'); }
  prevVimWord(): TagCursor { return this.step('prevVimWord'); }
  endOfVimWord(): TagCursor { return this.step('endOfVimWord'); }
  nextWORD(): TagCursor { return this.step('nextWORD'); }
  prevWORD(): TagCursor { return this.step('prevWORD'); }
  endOfWORD(): TagCursor { return this.step('endOfWORD'); }
  startOfLogicalLine(): TagCursor { return this.step('startOfLogicalLine'); }
  firstNonBlankInLogicalLine(): TagCursor { return this.step('firstNonBlankInLogicalLine'); }
  endOfLogicalLine(): TagCursor { return this.step('endOfLogicalLine'); }
  startOfLastLine(): TagCursor { return this.step('startOfLastLine'); }
  equals(other: VimCursor): boolean {
    return (other as TagCursor).tag === this.tag;
  }
}

describe('resolveMotion 路由', () => {
  const cases: Array<[string, string]> = [
    ['h', 'left'],
    ['l', 'right'],
    ['j', 'downLogicalLine'],
    ['k', 'upLogicalLine'],
    ['gj', 'down'],
    ['gk', 'up'],
    ['w', 'nextVimWord'],
    ['b', 'prevVimWord'],
    ['e', 'endOfVimWord'],
    ['W', 'nextWORD'],
    ['B', 'prevWORD'],
    ['E', 'endOfWORD'],
    ['0', 'startOfLogicalLine'],
    ['^', 'firstNonBlankInLogicalLine'],
    ['$', 'endOfLogicalLine'],
    ['G', 'startOfLastLine'],
  ];
  for (const [motion, tag] of cases) {
    it(`"${motion}" 调 cursor.${tag}`, () => {
      const r = resolveMotion(motion, new TagCursor(), 1) as TagCursor;
      expect(r.tag).toBe(tag);
    });
  }

  it('未知 motion 保持原位', () => {
    const cursor = new TagCursor('origin');
    const r = resolveMotion('?', cursor, 5) as TagCursor;
    expect(r.tag).toBe('origin');
  });

  it('count 累加（equals 相同时提前退出）', () => {
    // TagCursor 每次 left() 都返回 tag='left'，equals=true → 提前退出
    const cursor = new TagCursor('left');
    const r = resolveMotion('h', cursor, 10) as TagCursor;
    expect(r.tag).toBe('left');
  });

  it('count=0 返回原 cursor', () => {
    const cursor = new TagCursor('origin');
    const r = resolveMotion('h', cursor, 0) as TagCursor;
    expect(r.tag).toBe('origin');
  });
});

describe('isInclusiveMotion', () => {
  it('e/E/$ 为 inclusive', () => {
    expect(isInclusiveMotion('e')).toBe(true);
    expect(isInclusiveMotion('E')).toBe(true);
    expect(isInclusiveMotion('$')).toBe(true);
  });
  it('其它为 exclusive', () => {
    expect(isInclusiveMotion('h')).toBe(false);
    expect(isInclusiveMotion('w')).toBe(false);
  });
});

describe('isLinewiseMotion', () => {
  it('j/k/G 与 gg 为 linewise', () => {
    expect(isLinewiseMotion('j')).toBe(true);
    expect(isLinewiseMotion('k')).toBe(true);
    expect(isLinewiseMotion('G')).toBe(true);
    expect(isLinewiseMotion('gg')).toBe(true);
  });
  it('gj/gk 不是 linewise', () => {
    expect(isLinewiseMotion('gj')).toBe(false);
    expect(isLinewiseMotion('gk')).toBe(false);
  });
});
