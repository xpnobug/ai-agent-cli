/**
 * 带缓冲的写入器
 *
 * 用于日志 / 大输出打印等场景，把多次 write 合并成少数几次磁盘 IO：
 *   - 时间阈值：flushIntervalMs 到期强制刷写
 *   - 数量阈值：buffer.length >= maxBufferSize 强制刷写
 *   - 字节阈值：bufferBytes >= maxBufferBytes 强制刷写
 *
 * 溢出刷写（flushDeferred）用 setImmediate 异步执行，调用方的
 * 当前 tick 永远不会被 writeFn 阻塞。即便进程提前退出，
 * flush()/dispose() 也能把已 detached 的溢出批次同步冲掉。
 */

export type WriteFn = (content: string) => void;

export interface BufferedWriter {
  write: (content: string) => void;
  flush: () => void;
  dispose: () => void;
}

export interface BufferedWriterOptions {
  writeFn: WriteFn;
  /** 时间阈值（ms），默认 1000 */
  flushIntervalMs?: number;
  /** 数量阈值，默认 100 */
  maxBufferSize?: number;
  /** 字节阈值，默认 Infinity */
  maxBufferBytes?: number;
  /** true 表示直通，不做任何缓冲（便于调试） */
  immediateMode?: boolean;
}

export function createBufferedWriter(
  opts: BufferedWriterOptions,
): BufferedWriter {
  const {
    writeFn,
    flushIntervalMs = 1000,
    maxBufferSize = 100,
    maxBufferBytes = Number.POSITIVE_INFINITY,
    immediateMode = false,
  } = opts;

  let buffer: string[] = [];
  let bufferBytes = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  // 已 detach 但尚未真正写入的一批内容；
  // flush/dispose 时要同步冲掉以防进程退出丢数据
  let pendingOverflow: string[] | null = null;

  function clearTimer(): void {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function flush(): void {
    if (pendingOverflow) {
      writeFn(pendingOverflow.join(''));
      pendingOverflow = null;
    }
    if (buffer.length === 0) {
      clearTimer();
      return;
    }
    writeFn(buffer.join(''));
    buffer = [];
    bufferBytes = 0;
    clearTimer();
  }

  function scheduleFlush(): void {
    if (!flushTimer) {
      flushTimer = setTimeout(flush, flushIntervalMs);
    }
  }

  function flushDeferred(): void {
    if (pendingOverflow) {
      // 上一次溢出写还在队列中：合并到里面保持顺序
      pendingOverflow.push(...buffer);
      buffer = [];
      bufferBytes = 0;
      clearTimer();
      return;
    }
    const detached = buffer;
    buffer = [];
    bufferBytes = 0;
    clearTimer();
    pendingOverflow = detached;
    setImmediate(() => {
      const toWrite = pendingOverflow;
      pendingOverflow = null;
      if (toWrite) writeFn(toWrite.join(''));
    });
  }

  return {
    write(content: string): void {
      if (immediateMode) {
        writeFn(content);
        return;
      }
      buffer.push(content);
      bufferBytes += content.length;
      scheduleFlush();
      if (buffer.length >= maxBufferSize || bufferBytes >= maxBufferBytes) {
        flushDeferred();
      }
    },
    flush,
    dispose(): void {
      flush();
    },
  };
}
