import { describe, it, expect, vi } from 'vitest';
import {
  systemPromptSection,
  DANGEROUS_uncachedSystemPromptSection,
  resolveSystemPromptSections,
  clearSystemPromptSections,
  createSectionCache,
} from '../../src/services/systemPromptSections.js';

describe('resolveSystemPromptSections', () => {
  it('按顺序返回各段内容', async () => {
    const sections = [
      systemPromptSection('a', () => 'A'),
      systemPromptSection('b', () => 'B'),
    ];
    expect(await resolveSystemPromptSections(sections)).toEqual(['A', 'B']);
  });

  it('null 返回原样保留', async () => {
    const sections = [
      systemPromptSection('a', () => null),
      systemPromptSection('b', () => 'B'),
    ];
    expect(await resolveSystemPromptSections(sections)).toEqual([null, 'B']);
  });

  it('cacheable 段命中缓存后不再 compute', async () => {
    const cache = createSectionCache();
    const compute = vi.fn(() => 'X');
    const sections = [systemPromptSection('a', compute)];
    await resolveSystemPromptSections(sections, cache);
    await resolveSystemPromptSections(sections, cache);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('DANGEROUS_uncached 每次重算', async () => {
    const cache = createSectionCache();
    const compute = vi.fn(() => 'X');
    const sections = [
      DANGEROUS_uncachedSystemPromptSection('a', compute, 'volatile'),
    ];
    await resolveSystemPromptSections(sections, cache);
    await resolveSystemPromptSections(sections, cache);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('异步 compute 正确 await', async () => {
    const sections = [
      systemPromptSection('a', async () => {
        await new Promise((r) => setTimeout(r, 1));
        return 'done';
      }),
    ];
    expect(await resolveSystemPromptSections(sections)).toEqual(['done']);
  });

  it('clearSystemPromptSections 后重新 compute', async () => {
    const cache = createSectionCache();
    const compute = vi.fn(() => 'X');
    const sections = [systemPromptSection('a', compute)];
    await resolveSystemPromptSections(sections, cache);
    clearSystemPromptSections(cache);
    await resolveSystemPromptSections(sections, cache);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('混合 cacheable + volatile 段', async () => {
    const cache = createSectionCache();
    const computeA = vi.fn(() => 'A');
    const computeB = vi.fn(() => 'B');
    const sections = [
      systemPromptSection('a', computeA),
      DANGEROUS_uncachedSystemPromptSection('b', computeB, 'changes often'),
    ];
    await resolveSystemPromptSections(sections, cache);
    await resolveSystemPromptSections(sections, cache);
    expect(computeA).toHaveBeenCalledTimes(1);
    expect(computeB).toHaveBeenCalledTimes(2);
  });
});

describe('createSectionCache', () => {
  it('has/get/set/clear 基础操作', () => {
    const c = createSectionCache();
    expect(c.has('x')).toBe(false);
    c.set('x', 'hello');
    expect(c.has('x')).toBe(true);
    expect(c.get('x')).toBe('hello');
    c.clear();
    expect(c.has('x')).toBe(false);
  });
});
