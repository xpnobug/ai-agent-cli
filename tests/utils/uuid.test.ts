import { describe, it, expect } from 'vitest';
import {
  generateUuid,
  isUuid,
  validateUuid,
  createAgentId,
} from '../../src/utils/uuid.js';

describe('generateUuid / isUuid', () => {
  it('生成值满足严格 UUID 格式', () => {
    for (let i = 0; i < 10; i++) {
      expect(isUuid(generateUuid())).toBe(true);
    }
  });

  it('isUuid 拒绝非 v1-5', () => {
    // version=0 不合法
    expect(isUuid('12345678-1234-0234-8234-123456789abc')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});

describe('validateUuid', () => {
  it('接受任何 8-4-4-4-12 hex', () => {
    expect(validateUuid('12345678-1234-0234-0234-123456789abc')).toBe(
      '12345678-1234-0234-0234-123456789abc',
    );
  });
  it('非字符串 → null', () => {
    expect(validateUuid(null)).toBeNull();
    expect(validateUuid(123)).toBeNull();
  });
  it('格式错误 → null', () => {
    expect(validateUuid('12345678-1234-0234')).toBeNull();
    expect(validateUuid('abc')).toBeNull();
  });
});

describe('createAgentId', () => {
  it('无 label → "a" + 16 hex', () => {
    const id = createAgentId();
    expect(id).toMatch(/^a[0-9a-f]{16}$/);
  });
  it('有 label → a{label}-{hex}', () => {
    const id = createAgentId('explore');
    expect(id).toMatch(/^aexplore-[0-9a-f]{16}$/);
  });
  it('多次生成值不同', () => {
    expect(createAgentId()).not.toBe(createAgentId());
  });
});
