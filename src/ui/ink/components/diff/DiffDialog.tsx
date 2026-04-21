/**
 * diff/ — 多文件 Diff 浏览
 *
 * 包含：DiffFileList（文件列表） + DiffDetailView（单文件详情） + DiffDialog（容器）
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from '../../primitives.js';
import { Pane } from '../design-system/Pane.js';
import { StructuredDiffList } from '../StructuredDiff/index.js';
import type { StructuredPatchHunk } from 'diff';
import { getInkColors } from '../../../theme.js';

// ─── 类型 ───

export interface DiffFile {
  filePath: string;
  hunks: StructuredPatchHunk[];
  additions: number;
  deletions: number;
}

type DiffDialogProps = {
  files: DiffFile[];
  onClose: () => void;
};

// ─── DiffFileList — 文件列表 ───

function DiffFileList({
  files,
  selectedIndex,
  onSelect,
}: {
  files: DiffFile[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}): React.ReactNode {
  const colors = getInkColors();
  return (
    <Box flexDirection="column">
      <Text bold>Changed files ({files.length})</Text>
      {files.map((file, i) => (
        <Box key={file.filePath} gap={1} onClick={() => onSelect(i)}>
          <Text color={i === selectedIndex ? colors.info : undefined} bold={i === selectedIndex}>
            {i === selectedIndex ? '▸' : ' '} {file.filePath}
          </Text>
          <Text color={colors.success}>+{file.additions}</Text>
          <Text color={colors.error}>-{file.deletions}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── DiffDetailView — 单文件详情 ───

function DiffDetailView({ file }: { file: DiffFile }): React.ReactNode {
  const width = Math.max(40, (process.stdout.columns || 80) - 16);
  const colors = getInkColors();

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={colors.info}>{file.filePath}</Text>
        <Text> </Text>
        <Text color={colors.success}>+{file.additions}</Text>
        <Text> </Text>
        <Text color={colors.error}>-{file.deletions}</Text>
      </Box>
      <StructuredDiffList hunks={file.hunks} filePath={file.filePath} width={width} />
    </Box>
  );
}

// ─── DiffDialog — 容器 ───

export function DiffDialog({ files, onClose }: DiffDialogProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  useInput((_input, key) => {
    if (key.escape) {
      if (showDetail) {
        setShowDetail(false);
      } else {
        onClose();
      }
      return;
    }
    if (key.upArrow && !showDetail) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow && !showDetail) {
      setSelectedIndex((prev) => Math.min(files.length - 1, prev + 1));
    }
    if (key.return && !showDetail) {
      setShowDetail(true);
    }
  });

  if (files.length === 0) {
    return (
      <Pane color="cyan">
        <Text dimColor>No changes</Text>
      </Pane>
    );
  }

  const selectedFile = files[selectedIndex];

  return (
    <Pane color="cyan">
      <Box flexDirection="column" gap={1}>
        {showDetail && selectedFile ? (
          <DiffDetailView file={selectedFile} />
        ) : (
          <DiffFileList
            files={files}
            selectedIndex={selectedIndex}
            onSelect={(i) => {
              setSelectedIndex(i);
              setShowDetail(true);
            }}
          />
        )}
        <Text dimColor>
          {showDetail ? 'Esc 返回列表' : '↑↓ 导航 · Enter 查看 · Esc 关闭'}
        </Text>
      </Box>
    </Pane>
  );
}
