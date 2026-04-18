import { describe, it, expect } from 'vitest';
import { createUserMessage } from '../../src/utils/messages.js';

describe('createUserMessage 入口净化', () => {
  it('普通字符串原样保留', () => {
    const msg = createUserMessage({ content: 'hello world' });
    const block = msg.message.content[0]!;
    expect((block as { text: string }).text).toBe('hello world');
  });

  it('去除零宽空格', () => {
    const msg = createUserMessage({ content: 'hi\u200Bthere' });
    expect((msg.message.content[0] as { text: string }).text).toBe('hithere');
  });

  it('去除 RLO 方向覆盖字符', () => {
    const msg = createUserMessage({ content: 'user\u202Ename' });
    expect((msg.message.content[0] as { text: string }).text).toBe('username');
  });

  it('ContentBlockParam[] 不被二次处理', () => {
    // 内部组装的块（可能含 tool_result / image）保持原样
    const msg = createUserMessage({
      content: [{ type: 'text', text: 'kept\u200Bzero-width' }],
    });
    expect((msg.message.content[0] as { text: string }).text).toBe(
      'kept\u200Bzero-width',
    );
  });

  it('保留 CJK 与单体 emoji；ZWJ 组合 emoji 会被拆成单体（安全取舍）', () => {
    // 单体 emoji 与 CJK 原样
    const ok = createUserMessage({ content: '你好 🌍 世界' });
    expect((ok.message.content[0] as { text: string }).text).toBe('你好 🌍 世界');
    // ZWJ（U+200D，\\p{Cf}）被净化策略统一剥除，代价是 ZWJ 合成 emoji 会散开
    const zwj = createUserMessage({ content: 'a\u200Db' });
    expect((zwj.message.content[0] as { text: string }).text).toBe('ab');
  });

  it('isMeta 依旧被传递', () => {
    const msg = createUserMessage({ content: 'x', isMeta: true });
    expect(msg.isMeta).toBe(true);
  });
});
