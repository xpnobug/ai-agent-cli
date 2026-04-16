/**
 * GlobalSearchDialog — 全局内容搜索对话框
 *
 * 功能：Ctrl+Shift+F 触发，使用 ripgrep 搜索工作目录内容，
 *       显示匹配行和文件预览。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { HighlightedCode } from './HighlightedCode.js';
import { execaCommand } from 'execa';
import { readFileSync } from 'node:fs';
import { relative, extname } from 'node:path';

type Props = {
  /** 工作目录 */
  workdir: string;
  /** 关闭对话框 */
  onDone: () => void;
  /** 插入文件路径到输入框 */
  onInsert: (text: string) => void;
};

type Match = {
  /** 文件相对路径 */
  file: string;
  /** 行号 */
  line: number;
  /** 匹配行文本 */
  text: string;
  /** 唯一标识 */
  key: string;
};

const VISIBLE_RESULTS = 12;
const DEBOUNCE_MS = 150;
const PREVIEW_CONTEXT_LINES = 4;
const MAX_TOTAL_MATCHES = 500;

/** 截断文本到指定宽度 */
function truncateToWidth(text: string, width: number): string {
  if (text.length <= width) return text;
  return text.slice(0, width - 1) + '…';
}

/** 安全读取文件指定行范围 */
function readFileInRange(filePath: string, startLine: number, endLine: number): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join('\n');
  } catch {
    return null;
  }
}

export function GlobalSearchDialog({ workdir, onDone, onInsert }: Props): React.ReactNode {
  useRegisterOverlay('global-search');
  const { columns, rows } = useTerminalSize();
  const previewOnRight = columns >= 140;
  const visibleResults = Math.min(VISIBLE_RESULTS, Math.max(4, rows - 14));

  const [matches, setMatches] = useState<Match[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenRef = useRef(0);

  // Debounced ripgrep 搜索
  const doSearch = useCallback((searchQuery: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setMatches([]);
      setTruncated(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const gen = ++searchGenRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        // 使用 rg (ripgrep) 搜索
        const { stdout } = await execaCommand(
          `rg --json --max-count=10 --max-filesize=1M -e ${JSON.stringify(searchQuery)} .`,
          {
            cwd: workdir,
            reject: false,
            timeout: 10000,
          },
        );

        if (searchGenRef.current !== gen) return;

        const results: Match[] = [];
        for (const line of stdout.split('\n')) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'match' && parsed.data) {
              const filePath = parsed.data.path?.text;
              const lineNum = parsed.data.line_number;
              const lineText = parsed.data.lines?.text?.trimEnd();
              if (filePath && lineNum && lineText) {
                const rel = relative(workdir, `${workdir}/${filePath}`);
                results.push({
                  file: rel,
                  line: lineNum,
                  text: lineText,
                  key: `${rel}:${lineNum}`,
                });
              }
            }
          } catch {
            // 忽略 JSON 解析错误
          }
          if (results.length >= MAX_TOTAL_MATCHES) break;
        }

        setMatches(results);
        setTruncated(results.length >= MAX_TOTAL_MATCHES);
        setIsSearching(false);
      } catch {
        if (searchGenRef.current === gen) {
          setMatches([]);
          setIsSearching(false);
        }
      }
    }, DEBOUNCE_MS);
  }, [workdir]);

  // 清除 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // 加载预览
  const handleFocus = useCallback((item: Match | undefined) => {
    if (!item) {
      setPreview(null);
      return;
    }
    const startLine = Math.max(1, item.line - PREVIEW_CONTEXT_LINES);
    const endLine = item.line + PREVIEW_CONTEXT_LINES;
    const content = readFileInRange(`${workdir}/${item.file}`, startLine, endLine);
    setPreview(content);
  }, [workdir]);

  const listWidth = Math.max(30, columns - 8);

  return (
    <FuzzyPicker
      title={isSearching ? 'Global Search (搜索中…)' : 'Global Search'}
      placeholder="输入关键词搜索文件内容…"
      items={matches}
      getKey={(item) => item.key}
      onQueryChange={(q) => {
        doSearch(q);
      }}
      onSelect={(item) => {
        onInsert(`${item.file}:${item.line}`);
        onDone();
      }}
      onTab={{
        action: '插入路径',
        handler: (item) => {
          onInsert(item.file);
          onDone();
        },
      }}
      onFocus={handleFocus}
      onCancel={onDone}
      visibleCount={visibleResults}
      emptyMessage={(q) =>
        q ? (isSearching ? '搜索中…' : '未找到匹配内容') : '输入关键词开始搜索'
      }
      matchLabel={
        matches.length > 0
          ? `${matches.length} 个匹配${truncated ? '（已截断）' : ''}`
          : undefined
      }
      selectAction="打开"
      previewPosition={previewOnRight ? 'right' : 'bottom'}
      renderItem={(item, isFocused) => (
        <Box>
          <Text color={isFocused ? 'cyan' : 'yellow'} dimColor={!isFocused}>
            {truncateToWidth(item.file, Math.floor(listWidth * 0.4))}
          </Text>
          <Text dimColor>:{item.line} </Text>
          <Text color={isFocused ? undefined : undefined} dimColor={!isFocused}>
            {truncateToWidth(item.text.trim(), Math.floor(listWidth * 0.55))}
          </Text>
        </Box>
      )}
      renderPreview={(item) => {
        if (!preview) return null;
        const ext = extname(item.file).slice(1);
        return (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderDimColor
            paddingX={1}
            height={Math.min(PREVIEW_CONTEXT_LINES * 2 + 3, rows - visibleResults - 8)}
          >
            <Text dimColor bold>{item.file}:{item.line}</Text>
            <HighlightedCode
              code={preview}
              language={ext}
            />
          </Box>
        );
      }}
    />
  );
}
