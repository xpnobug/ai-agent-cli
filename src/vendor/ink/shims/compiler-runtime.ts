// @ts-nocheck
/**
 * React Compiler runtime polyfill for React 18
 *
 * _c(size) 创建一个固定大小的缓存数组，用 Symbol sentinel 填充。
 * React Compiler 编译输出用它做自动 memoization。
 */

const $empty = Symbol.for('react.memo_cache_sentinel');

export function c(size: number): any[] {
  const cache = new Array(size);
  for (let i = 0; i < size; i++) {
    cache[i] = $empty;
  }
  return cache;
}
