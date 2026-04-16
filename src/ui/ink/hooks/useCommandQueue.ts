/**
 * useCommandQueue — 命令队列管理 Hook
 *
 * 功能：管理待执行的命令队列（如多个斜杠命令连续输入）。
 */

import { useCallback, useState } from 'react';

export interface QueuedCommand {
  id: string;
  value: string;
  addedAt: number;
}

interface CommandQueueState {
  queue: QueuedCommand[];
  enqueue: (value: string) => void;
  dequeue: () => QueuedCommand | undefined;
  peek: () => QueuedCommand | undefined;
  clear: () => void;
  remove: (id: string) => void;
  isEmpty: boolean;
  size: number;
}

let _nextId = 0;

export function useCommandQueue(): CommandQueueState {
  const [queue, setQueue] = useState<QueuedCommand[]>([]);

  const enqueue = useCallback((value: string) => {
    const cmd: QueuedCommand = {
      id: String(++_nextId),
      value,
      addedAt: Date.now(),
    };
    setQueue((prev) => [...prev, cmd]);
  }, []);

  const dequeue = useCallback(() => {
    let removed: QueuedCommand | undefined;
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      removed = prev[0];
      return prev.slice(1);
    });
    return removed;
  }, []);

  const peek = useCallback(() => queue[0], [queue]);

  const clear = useCallback(() => setQueue([]), []);

  const remove = useCallback((id: string) => {
    setQueue((prev) => prev.filter((cmd) => cmd.id !== id));
  }, []);

  return {
    queue,
    enqueue,
    dequeue,
    peek,
    clear,
    remove,
    isEmpty: queue.length === 0,
    size: queue.length,
  };
}
