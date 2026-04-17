import { describe, it, expect } from 'vitest';
import {
  BLACK_CIRCLE,
  BULLET_OPERATOR,
  UP_ARROW,
  DOWN_ARROW,
  DIAMOND_OPEN,
  DIAMOND_FILLED,
  BRIDGE_SPINNER_FRAMES,
  BRIDGE_READY_INDICATOR,
  EFFORT_LOW,
  EFFORT_MAX,
} from '../../../src/core/constants/figures.js';

describe('figures 常量', () => {
  it('按平台挑 BLACK_CIRCLE', () => {
    // Darwin 用 ⏺（U+23FA），其他平台用 ●（U+25CF）
    if (process.platform === 'darwin') {
      expect(BLACK_CIRCLE).toBe('⏺');
    } else {
      expect(BLACK_CIRCLE).toBe('●');
    }
  });

  it('方向箭头单字符', () => {
    expect(UP_ARROW).toHaveLength(1);
    expect(DOWN_ARROW).toHaveLength(1);
  });

  it('努力程度 LOW != MAX', () => {
    expect(EFFORT_LOW).not.toBe(EFFORT_MAX);
  });

  it('DIAMOND_OPEN != DIAMOND_FILLED', () => {
    expect(DIAMOND_OPEN).not.toBe(DIAMOND_FILLED);
  });

  it('BRIDGE_SPINNER_FRAMES 有多帧', () => {
    expect(BRIDGE_SPINNER_FRAMES.length).toBeGreaterThanOrEqual(4);
    expect(typeof BRIDGE_READY_INDICATOR).toBe('string');
  });

  it('BULLET_OPERATOR 常量存在', () => {
    expect(BULLET_OPERATOR).toBe('∙');
  });
});
