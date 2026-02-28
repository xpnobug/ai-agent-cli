/**
 * useAppStore — 精确订阅 Hook
 *
 * 基于 useSyncExternalStore，组件只在选择的 state slice 变化时重渲染。
 */

import { useSyncExternalStore, useRef, useCallback, useState, useEffect } from 'react';
import type { AppStore, AppState } from './store.js';

/**
 * 精确订阅 AppStore 的某个切片
 *
 * @example
 * const phase = useAppStore(store, s => s.phase);
 * const items = useAppStore(store, s => s.completedItems);
 */
export function useAppStore<T>(store: AppStore, selector: (s: AppState) => T): T {
  // 缓存 selector 结果，避免每次都触发重渲染
  const prevRef = useRef<T>();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useCallback(() => {
    const next = selectorRef.current(store.getState());
    // 浅比较：如果结果相同则返回旧引用，防止不必要的重渲染
    if (Object.is(prevRef.current, next)) {
      return prevRef.current as T;
    }
    prevRef.current = next;
    return next;
  }, [store]);

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * useElapsedTime — 每 100ms 更新一次经过时间
 *
 * @param startTime 起始时间戳（Date.now()），传 null 停止计时
 * @returns 经过的秒数
 */
export function useElapsedTime(startTime: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime === null) {
      setElapsed(0);
      return;
    }

    // 立即计算一次
    setElapsed((Date.now() - startTime) / 1000);

    const timer = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(timer);
  }, [startTime]);

  return elapsed;
}
