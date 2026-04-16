/**
 * useDiffData — Diff 数据计算 Hook
 *
 * 功能：为 StructuredDiff 组件计算 diff 数据，
 *       包含行级别的增删改统计。
 */

import { useMemo } from 'react';
import { diffLines, type Change } from 'diff';

export interface DiffStats {
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 总变更行数 */
  totalChanges: number;
}

export interface DiffHunk {
  /** Hunk 中的变更块 */
  changes: Change[];
  /** 起始行号（原始文件） */
  oldStart: number;
  /** 起始行号（新文件） */
  newStart: number;
}

export interface DiffData {
  /** Diff 统计信息 */
  stats: DiffStats;
  /** Hunk 列表 */
  hunks: DiffHunk[];
  /** 是否有变更 */
  hasChanges: boolean;
}

/**
 * 将 diff 变更分割为 Hunks（上下文合并）
 */
function splitIntoHunks(changes: Change[], contextLines: number = 3): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const lineCount = change.count ?? 1;

    if (change.added || change.removed) {
      if (!currentHunk) {
        currentHunk = {
          changes: [],
          oldStart: Math.max(1, oldLine - contextLines),
          newStart: Math.max(1, newLine - contextLines),
        };
      }
      currentHunk.changes.push(change);
    } else {
      // 未变更的行
      if (currentHunk) {
        currentHunk.changes.push(change);
        // 如果连续未变更行超过 contextLines * 2，结束当前 hunk
        if (lineCount > contextLines * 2) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    }

    if (change.removed) {
      oldLine += lineCount;
    } else if (change.added) {
      newLine += lineCount;
    } else {
      oldLine += lineCount;
      newLine += lineCount;
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * 计算两段文本之间的 diff 数据
 */
export function useDiffData(oldText: string, newText: string): DiffData {
  return useMemo(() => {
    const changes = diffLines(oldText, newText);

    let additions = 0;
    let deletions = 0;

    for (const change of changes) {
      const lineCount = change.count ?? 1;
      if (change.added) {
        additions += lineCount;
      } else if (change.removed) {
        deletions += lineCount;
      }
    }

    const hunks = splitIntoHunks(changes);

    return {
      stats: {
        additions,
        deletions,
        totalChanges: additions + deletions,
      },
      hunks,
      hasChanges: additions > 0 || deletions > 0,
    };
  }, [oldText, newText]);
}
