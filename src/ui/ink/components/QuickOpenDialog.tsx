/**
 * QuickOpenDialog — 快速打开文件对话框
 *
 * 功能：Ctrl+P 触发，模糊搜索工作目录文件，预览文件内容。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { HighlightedCode } from './HighlightedCode.js';
import fg from 'fast-glob';
import { readFileSync } from 'node:fs';
import { extname, relative } from 'node:path';

type Props = {
  /** 工作目录 */
  workdir: string;
  /** 关闭对话框 */
  onDone: () => void;
  /** 插入文件路径到输入框 */
  onInsert: (text: string) => void;
};

type FileItem = {
  /** 相对路径 */
  relativePath: string;
  /** 绝对路径 */
  absolutePath: string;
  /** 小写版本（用于搜索） */
  lower: string;
};

const VISIBLE_RESULTS = 8;
const PREVIEW_LINES = 20;

/** 模糊匹配：query 的每个字符在 text 中按序出现 */
function fuzzyMatch(text: string, query: string): boolean {
  let j = 0;
  for (let i = 0; i < text.length && j < query.length; i++) {
    if (text[i] === query[j]) j++;
  }
  return j === query.length;
}

/** 截断路径中间部分 */
function truncatePathMiddle(p: string, maxLen: number): string {
  if (p.length <= maxLen) return p;
  const half = Math.floor((maxLen - 3) / 2);
  return p.slice(0, half) + '...' + p.slice(p.length - half);
}

/** 安全读取文件前 N 行 */
function readFilePreview(filePath: string, maxLines: number): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, maxLines);
    return lines.join('\n');
  } catch {
    return null;
  }
}

export function QuickOpenDialog({ workdir, onDone, onInsert }: Props): React.ReactNode {
  useRegisterOverlay('quick-open');
  const { columns, rows } = useTerminalSize();
  const visibleResults = Math.min(VISIBLE_RESULTS, Math.max(4, rows - 14));

  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const queryGenRef = useRef(0);

  // 初次加载：扫描工作目录文件
  useEffect(() => {
    let cancelled = false;
    const gen = ++queryGenRef.current;

    (async () => {
      try {
        const files = await fg('**/*', {
          cwd: workdir,
          ignore: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/*.min.js',
            '**/*.map',
          ],
          onlyFiles: true,
          absolute: true,
          dot: false,
          suppressErrors: true,
        });

        if (cancelled || queryGenRef.current !== gen) return;

        const items: FileItem[] = files.slice(0, 5000).map((abs) => {
          const rel = relative(workdir, abs);
          return {
            relativePath: rel,
            absolutePath: abs,
            lower: rel.toLowerCase(),
          };
        });

        // 按路径排序
        items.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        setAllFiles(items);
      } catch {
        // 忽略扫描错误
      }
    })();

    return () => { cancelled = true; };
  }, [workdir]);

  // 过滤文件列表
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFiles.slice(0, 200);
    const exact: FileItem[] = [];
    const fuzzy: FileItem[] = [];
    for (const item of allFiles) {
      if (item.lower.includes(q)) {
        exact.push(item);
      } else if (fuzzyMatch(item.lower, q)) {
        fuzzy.push(item);
      }
    }
    return exact.concat(fuzzy).slice(0, 200);
  }, [allFiles, query]);

  // 预览当前聚焦文件
  const handleFocus = useCallback((item: FileItem | undefined) => {
    if (!item) {
      setPreview(null);
      return;
    }
    const content = readFilePreview(item.absolutePath, PREVIEW_LINES);
    setPreview(content);
  }, []);

  const listWidth = Math.max(30, columns - 8);

  return (
    <FuzzyPicker
      title="Quick Open"
      placeholder="输入文件名搜索…"
      items={filtered}
      getKey={(item) => item.relativePath}
      onQueryChange={setQuery}
      onSelect={(item) => {
        onInsert(item.relativePath);
        onDone();
      }}
      onTab={{
        action: '插入路径',
        handler: (item) => {
          onInsert(item.relativePath);
          onDone();
        },
      }}
      onFocus={handleFocus}
      onCancel={onDone}
      visibleCount={visibleResults}
      emptyMessage={(q) => q ? '未找到匹配文件' : '正在扫描文件…'}
      matchLabel={filtered.length > 0 ? `${filtered.length} 个文件` : undefined}
      selectAction="打开"
      renderItem={(item, isFocused) => (
        <Text color={isFocused ? 'cyan' : undefined}>
          {truncatePathMiddle(item.relativePath, listWidth)}
        </Text>
      )}
      renderPreview={(item) => {
        if (!preview) return null;
        const ext = extname(item.relativePath).slice(1);
        return (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderDimColor
            paddingX={1}
            height={Math.min(PREVIEW_LINES + 2, rows - visibleResults - 8)}
          >
            <Text dimColor bold>{item.relativePath}</Text>
            <HighlightedCode code={preview} language={ext} />
          </Box>
        );
      }}
    />
  );
}
