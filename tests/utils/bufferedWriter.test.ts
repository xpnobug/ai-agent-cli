import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBufferedWriter } from '../../src/utils/bufferedWriter.js';

afterEach(() => vi.useRealTimers());

describe('createBufferedWriter', () => {
  it('未到阈值不刷写', () => {
    vi.useFakeTimers();
    const writeFn = vi.fn();
    const w = createBufferedWriter({ writeFn });
    w.write('a');
    w.write('b');
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('到达时间阈值 → 刷写', () => {
    vi.useFakeTimers();
    const writeFn = vi.fn();
    const w = createBufferedWriter({ writeFn, flushIntervalMs: 100 });
    w.write('a');
    w.write('b');
    vi.advanceTimersByTime(100);
    expect(writeFn).toHaveBeenCalledTimes(1);
    expect(writeFn).toHaveBeenCalledWith('ab');
  });

  it('到达数量阈值 → 刷写', async () => {
    const writeFn = vi.fn();
    const w = createBufferedWriter({
      writeFn,
      maxBufferSize: 3,
      flushIntervalMs: 10_000,
    });
    w.write('a');
    w.write('b');
    w.write('c');
    // 第 3 条触发溢出：detach + setImmediate
    await new Promise((r) => setImmediate(r));
    expect(writeFn).toHaveBeenCalledWith('abc');
  });

  it('到达字节阈值 → 刷写', async () => {
    const writeFn = vi.fn();
    const w = createBufferedWriter({
      writeFn,
      maxBufferBytes: 5,
      flushIntervalMs: 10_000,
    });
    w.write('abc');
    w.write('de'); // 累计 5
    await new Promise((r) => setImmediate(r));
    expect(writeFn).toHaveBeenCalledWith('abcde');
  });

  it('immediateMode 直通', () => {
    const writeFn = vi.fn();
    const w = createBufferedWriter({ writeFn, immediateMode: true });
    w.write('a');
    w.write('b');
    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('dispose 冲掉残留 buffer', () => {
    const writeFn = vi.fn();
    const w = createBufferedWriter({ writeFn, flushIntervalMs: 10_000 });
    w.write('x');
    w.write('y');
    w.dispose();
    expect(writeFn).toHaveBeenCalledWith('xy');
  });

  it('多次溢出正确合并排序', async () => {
    const writeFn = vi.fn();
    const w = createBufferedWriter({
      writeFn,
      maxBufferSize: 2,
      flushIntervalMs: 10_000,
    });
    w.write('a');
    w.write('b'); // 溢出 1 → pendingOverflow = ['a','b']
    w.write('c');
    w.write('d'); // 溢出 2：由于 pendingOverflow 非空，应合并
    await new Promise((r) => setImmediate(r));
    // 合并后只有一次 write，内容按写入顺序拼接
    const calls = writeFn.mock.calls.map((c) => c[0]).join('');
    expect(calls).toBe('abcd');
  });
});
