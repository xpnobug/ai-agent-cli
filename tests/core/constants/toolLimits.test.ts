import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_RESULT_SIZE_CHARS,
  MAX_TOOL_RESULT_TOKENS,
  BYTES_PER_TOKEN,
  MAX_TOOL_RESULT_BYTES,
  MAX_TOOL_RESULTS_PER_MESSAGE_CHARS,
  TOOL_SUMMARY_MAX_LENGTH,
} from '../../../src/core/constants/toolLimits.js';

describe('toolLimits 常量', () => {
  it('数值大小自洽', () => {
    expect(DEFAULT_MAX_RESULT_SIZE_CHARS).toBe(50_000);
    expect(MAX_TOOL_RESULT_TOKENS).toBe(100_000);
    expect(BYTES_PER_TOKEN).toBe(4);
    expect(MAX_TOOL_RESULT_BYTES).toBe(MAX_TOOL_RESULT_TOKENS * BYTES_PER_TOKEN);
  });

  it('聚合上限 > 单个结果上限', () => {
    expect(MAX_TOOL_RESULTS_PER_MESSAGE_CHARS).toBeGreaterThan(
      DEFAULT_MAX_RESULT_SIZE_CHARS,
    );
  });

  it('摘要上限合理（< 100）', () => {
    expect(TOOL_SUMMARY_MAX_LENGTH).toBeLessThan(100);
  });
});
