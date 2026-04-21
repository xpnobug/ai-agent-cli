/**
 * StructuredDiff — 结构化 Diff 展示（逐词级高亮）
 *
 * 使用 diffWordsWithSpace 实现逐词级 diff 高亮：
 * - 红色背景 = 删除的词
 * - 绿色背景 = 新增的词
 * - 行号 + 前缀符号（+/-/空格）
 *
 * 处理流程：
 * 1. 将 diff lines 转为 LineObject（add/remove/nochange）
 * 2. 配对相邻的 remove+add 行
 * 3. 用 diffWordsWithSpace 计算逐词 diff
 * 4. 渲染带行号和背景色的 diff 视图
 */

import { diffWordsWithSpace, type StructuredPatchHunk } from 'diff';
import React, { useMemo } from 'react';
import { Box, Text } from '../../primitives.js';

// ─── 类型 ───

interface DiffLine {
  code: string;
  type: 'add' | 'remove' | 'nochange';
  i: number;
  originalCode: string;
  wordDiff?: boolean;
  matchedLine?: DiffLine;
}

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

// ─── 常量 ───

/** 逐词 diff 与整行 diff 的阈值（变更比例超过此值则回退到整行） */
const CHANGE_THRESHOLD = 0.4;

// ─── Props ───

interface StructuredDiffProps {
  patch: StructuredPatchHunk;
  dim?: boolean;
  width?: number;
}

// ─── 组件 ───

export function StructuredDiff({ patch, dim = false, width }: StructuredDiffProps) {
  const safeWidth = Math.max(1, Math.floor(width ?? (process.stdout.columns || 80)));

  const diff = useMemo(
    () => formatDiff(patch.lines, patch.oldStart, safeWidth, dim),
    [patch.lines, patch.oldStart, safeWidth, dim],
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {diff.map((node, i) => (
        <Box key={i}>{node}</Box>
      ))}
    </Box>
  );
}

// ─── 行转换 ───

/** 将 diff 字符串行转为 LineObject */
function transformLinesToObjects(lines: string[]): DiffLine[] {
  return lines.map((code) => {
    if (code.startsWith('+')) {
      return { code: code.slice(1), i: 0, type: 'add' as const, originalCode: code.slice(1) };
    }
    if (code.startsWith('-')) {
      return { code: code.slice(1), i: 0, type: 'remove' as const, originalCode: code.slice(1) };
    }
    return { code: code.slice(1), i: 0, type: 'nochange' as const, originalCode: code.slice(1) };
  });
}

/** 配对相邻的 remove+add 行用于逐词 diff */
function processAdjacentLines(lineObjects: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0;
  while (i < lineObjects.length) {
    const current = lineObjects[i]!;
    if (current.type === 'remove') {
      const removeLines: DiffLine[] = [current];
      let j = i + 1;
      while (j < lineObjects.length && lineObjects[j]?.type === 'remove') {
        removeLines.push(lineObjects[j]!);
        j++;
      }
      const addLines: DiffLine[] = [];
      while (j < lineObjects.length && lineObjects[j]?.type === 'add') {
        addLines.push(lineObjects[j]!);
        j++;
      }
      if (removeLines.length > 0 && addLines.length > 0) {
        const pairCount = Math.min(removeLines.length, addLines.length);
        for (let k = 0; k < pairCount; k++) {
          removeLines[k]!.wordDiff = true;
          addLines[k]!.wordDiff = true;
          removeLines[k]!.matchedLine = addLines[k];
          addLines[k]!.matchedLine = removeLines[k];
        }
        result.push(...removeLines);
        result.push(...addLines);
        i = j;
      } else {
        result.push(current);
        i++;
      }
    } else {
      result.push(current);
      i++;
    }
  }
  return result;
}

/** 为 diff 行添加行号 */
function numberDiffLines(diff: DiffLine[], startLine: number): DiffLine[] {
  let lineNum = startLine;
  const result: DiffLine[] = [];
  const queue = [...diff];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const line = { ...current, i: lineNum };
    switch (current.type) {
      case 'nochange':
      case 'add':
        lineNum++;
        result.push(line);
        break;
      case 'remove': {
        result.push(line);
        let numRemoved = 0;
        while (queue[0]?.type === 'remove') {
          lineNum++;
          const next = queue.shift()!;
          result.push({ ...next, i: lineNum });
          numRemoved++;
        }
        lineNum -= numRemoved;
        break;
      }
    }
  }
  return result;
}

// ─── 逐词 Diff ───

/** 计算两段文本的逐词 diff */
function calculateWordDiffs(oldText: string, newText: string): DiffPart[] {
  return diffWordsWithSpace(oldText, newText, { ignoreCase: false });
}

/** 生成逐词 diff 元素 */
function generateWordDiffElements(
  item: DiffLine, width: number, maxWidth: number, dim: boolean,
): React.ReactNode[] | null {
  if (!item.wordDiff || !item.matchedLine) return null;

  const removedText = item.type === 'remove' ? item.originalCode : item.matchedLine.originalCode;
  const addedText = item.type === 'remove' ? item.matchedLine.originalCode : item.originalCode;
  const wordDiffs = calculateWordDiffs(removedText, addedText);

  // 变更比例超过阈值则回退到整行 diff
  const totalLength = removedText.length + addedText.length;
  const changedLength = wordDiffs.filter((p) => p.added || p.removed).reduce((sum, p) => sum + p.value.length, 0);
  if (changedLength / totalLength > CHANGE_THRESHOLD || dim) return null;

  const diffPrefix = item.type === 'add' ? '+' : '-';
  const lineNumStr = item.i.toString().padStart(maxWidth) + ' ';
  const bgColor = item.type === 'add' ? 'green' : 'red';

  // 构建逐词高亮元素
  const parts: React.ReactNode[] = [];
  let renderedLen = lineNumStr.length + diffPrefix.length;
  wordDiffs.forEach((part, idx) => {
    let show = false;
    let wordBg: string | undefined;
    if (item.type === 'add') {
      if (part.added) { show = true; wordBg = 'greenBright'; }
      else if (!part.removed) { show = true; }
    } else {
      if (part.removed) { show = true; wordBg = 'redBright'; }
      else if (!part.added) { show = true; }
    }
    if (show) {
      parts.push(
        <Text key={idx} backgroundColor={wordBg}>{part.value}</Text>,
      );
      renderedLen += part.value.length;
    }
  });

  // 右侧填充空格让背景色延伸到屏幕宽度
  const padRight = Math.max(0, width - renderedLen);
  const fill = ' '.repeat(padRight);

  return [
    <Box key={`${item.type}-${item.i}`} flexDirection="row">
      <Text backgroundColor={bgColor} dimColor={dim}>
        {lineNumStr}{diffPrefix}
      </Text>
      <Text backgroundColor={bgColor} dimColor={dim}>
        {parts}{fill}
      </Text>
    </Box>,
  ];
}

// ─── 主渲染 ───

function formatDiff(
  lines: string[], startingLineNumber: number, width: number, dim: boolean,
): React.ReactNode[] {
  const safeWidth = Math.max(1, Math.floor(width));
  const lineObjects = transformLinesToObjects(lines);
  const processedLines = processAdjacentLines(lineObjects);
  const ls = numberDiffLines(processedLines, startingLineNumber);

  const maxLineNumber = Math.max(...ls.map(({ i }) => i), 0);
  const maxWidth = Math.max(maxLineNumber.toString().length + 1, 0);

  return ls.flatMap((item): React.ReactNode[] => {
    // 逐词 diff
    if (item.wordDiff && item.matchedLine) {
      const elements = generateWordDiffElements(item, safeWidth, maxWidth, dim);
      if (elements) return elements;
    }

    // 标准渲染
    const lineNumStr = item.i.toString().padStart(maxWidth) + ' ';
    const sigil = item.type === 'add' ? '+' : item.type === 'remove' ? '-' : ' ';
    const bgColor = item.type === 'add'
      ? (dim ? undefined : 'green')
      : item.type === 'remove'
        ? (dim ? undefined : 'red')
        : undefined;

    // 为了让背景色从行首延伸到屏幕宽度（而不是只覆盖字符范围），
    // 把整行拼成单个字符串并右侧填空格到 safeWidth。
    const prefix = `${lineNumStr}${sigil}`;
    const rendered = `${prefix}${item.code}`;
    const padded =
      bgColor !== undefined && rendered.length < safeWidth
        ? rendered + ' '.repeat(safeWidth - rendered.length)
        : rendered;

    return [
      <Box key={`${item.type}-${item.i}`}>
        <Text backgroundColor={bgColor} dimColor={dim || item.type === 'nochange'}>
          {padded}
        </Text>
      </Box>,
    ];
  });
}

// ─── 多 Hunk 列表 ───

export function StructuredDiffList({
  hunks, dim = false, width, filePath: _filePath,
}: {
  hunks: StructuredPatchHunk[];
  dim?: boolean;
  width?: number;
  filePath?: string;
}) {
  if (hunks.length === 0) return <Text dimColor>（无差异）</Text>;

  return (
    <Box flexDirection="column">
      {hunks.map((hunk, i) => (
        <StructuredDiff key={i} patch={hunk} dim={dim} width={width} />
      ))}
    </Box>
  );
}
