/**
 * useHistorySearch — 增强历史搜索 Hook
 *
 * 功能：增量子序列匹配 + 高亮 + 导航。
 */

import { useCallback, useMemo, useState } from 'react';

interface HistorySearchState {
  query: string;
  setQuery: (query: string) => void;
  matchIndex: number;
  matches: string[];
  currentMatch: string | null;
  failedMatch: boolean;
  nextMatch: () => void;
  prevMatch: () => void;
  reset: () => void;
}

/**
 * 增量子序列搜索历史记录。
 */
export function useHistorySearch(history: string[]): HistorySearchState {
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return history.filter((entry) => entry.toLowerCase().includes(q));
  }, [history, query]);

  const currentMatch = matches[matchIndex] ?? null;
  const failedMatch = query.length > 0 && matches.length === 0;

  const nextMatch = useCallback(() => {
    setMatchIndex((prev) => (prev + 1) % Math.max(1, matches.length));
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    setMatchIndex((prev) => (prev - 1 + matches.length) % Math.max(1, matches.length));
  }, [matches.length]);

  const reset = useCallback(() => {
    setQuery('');
    setMatchIndex(0);
  }, []);

  return {
    query,
    setQuery: useCallback((q: string) => {
      setQuery(q);
      setMatchIndex(0);
    }, []),
    matchIndex,
    matches,
    currentMatch,
    failedMatch,
    nextMatch,
    prevMatch,
    reset,
  };
}
