import { describe, it, expect } from 'vitest';
import { insertBlockAfterToolResults } from '../../src/utils/contentArray.js';

describe('insertBlockAfterToolResults', () => {
  it('有 tool_result 时插在最后一个之后', () => {
    const content: unknown[] = [
      { type: 'text', text: 'hi' },
      { type: 'tool_result', content: 'a' },
      { type: 'tool_result', content: 'b' },
      { type: 'text', text: 'final' },
    ];
    const block = { type: 'cache_control' };
    insertBlockAfterToolResults(content, block);
    // tool_result 最后一个在 index=2，新块在 3
    expect(content[3]).toEqual(block);
    expect((content[4] as { type: string }).type).toBe('text');
  });

  it('无 tool_result 时插在最后一个元素之前', () => {
    const content: unknown[] = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'last' },
    ];
    const block = { type: 'note' };
    insertBlockAfterToolResults(content, block);
    expect(content.length).toBe(3);
    expect(content[1]).toEqual(block);
    expect((content[2] as { text: string }).text).toBe('last');
  });

  it('tool_result 在末尾时插完补 text 占位', () => {
    const content: unknown[] = [
      { type: 'text', text: 'a' },
      { type: 'tool_result', content: 'r' },
    ];
    const block = { type: 'cache_control' };
    insertBlockAfterToolResults(content, block);
    // 最终应该是 [text, tool_result, block, text占位]
    expect(content.length).toBe(4);
    expect(content[2]).toEqual(block);
    expect((content[3] as { type: string; text: string }).text).toBe('.');
  });

  it('空数组也能处理', () => {
    const content: unknown[] = [];
    insertBlockAfterToolResults(content, { type: 'x' });
    expect(content).toHaveLength(1);
  });
});
