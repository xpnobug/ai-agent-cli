/**
 * LogoV2 — 完整版启动横幅
 *
 * 双栏结构：
 * 窄终端（<80 列）降级为单栏（compact 模式）。
 */

import { useMemo } from 'react';
import { Box, Text } from '../../primitives.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../../../../core/constants.js';
import { getInkColors } from '../../../theme.js';
import type { BannerConfig } from '../../types.js';
import { Mascot } from './Mascot.js';
import { FeedColumn } from './FeedColumn.js';
import type { FeedConfig } from './Feed.js';

// ─── 布局常量 ───

const LEFT_PANEL_MAX_WIDTH = 50;

function getLayoutMode(columns: number): 'horizontal' | 'compact' {
  return columns >= 80 ? 'horizontal' : 'compact';
}

function calculateLayoutDimensions(columns: number, mode: string) {
  if (mode === 'compact') {
    return { leftWidth: columns - 4, rightWidth: 0 };
  }
  const leftWidth = Math.min(LEFT_PANEL_MAX_WIDTH, Math.floor(columns * 0.4));
  const rightWidth = columns - leftWidth - 7; // 7 = padding + border + gap
  return { leftWidth, rightWidth };
}

// ─── 信息流配置 ───

function createTipsFeed(config: BannerConfig): FeedConfig {
  const lines = [
    { text: `输入消息开始对话` },
    { text: `使用 /help 查看所有命令` },
  ];
  if (config.skills.length > 0) {
    lines.push({ text: `已加载 ${config.skills.length} 个技能` });
  }
  return {
    title: 'Tips for getting started',
    lines,
  };
}

function createAgentsFeed(config: BannerConfig): FeedConfig {
  if (config.agentTypes.length === 0) {
    return { title: 'Agent Types', lines: [], emptyMessage: 'No agents configured' };
  }
  return {
    title: 'Agent Types',
    lines: config.agentTypes.map((a) => ({ text: a })),
  };
}

// ─── Props ───

export interface LogoV2Props {
  config: BannerConfig;
}

// ─── 组件 ───

export function LogoV2({ config }: LogoV2Props) {
  const { columns } = useTerminalSize();
  const colors = getInkColors();
  // 限制最大宽度，防止超宽终端拉伸
  const effectiveColumns = Math.min(columns, 100);
  const layoutMode = getLayoutMode(effectiveColumns);
  const { leftWidth, rightWidth } = calculateLayoutDimensions(effectiveColumns, layoutMode);

  const workdirName = config.workdir.split('/').pop() || 'workspace';
  const modelLine = `${config.model} · ${config.providerDisplayName}`;
  const cwdLine = `~/${workdirName}`;

  // 边框标题
  const borderTitle = ` ${PRODUCT_NAME} v${PRODUCT_VERSION} `;

  // 信息流（右栏）
  const feeds = useMemo<FeedConfig[]>(() => [
    createTipsFeed(config),
    createAgentsFeed(config),
  ], [config]);

  if (layoutMode === 'compact') {
    // ─── 窄终端：单栏 ───
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.primary}
        borderText={{ content: borderTitle, position: 'top', align: 'start', offset: 1 } as any}
        paddingX={1}
        paddingY={1}
        alignItems="center"
        width={effectiveColumns}
      >
        <Text bold>Welcome back!</Text>
        <Box marginY={1}>
          <Mascot variant={config.mascot} />
        </Box>
        <Text dimColor>{modelLine}</Text>
        <Text dimColor>{cwdLine}</Text>
      </Box>
    );
  }

  // ─── 宽终端：双栏 ───
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      borderText={{ content: borderTitle, position: 'top', align: 'start', offset: 1 } as any}
      paddingX={1}
      paddingY={0}
      width={effectiveColumns}
    >
      <Box
        flexDirection="row"
        paddingX={1}
        gap={1}
      >
        {/* 左栏：Welcome + Clawd + 模型信息 */}
        <Box
          flexDirection="column"
          width={leftWidth}
          justifyContent="space-between"
          alignItems="center"
          minHeight={9}
        >
          <Box marginTop={1}>
            <Text bold>Welcome back!</Text>
          </Box>
          <Mascot variant={config.mascot} />
          <Box flexDirection="column" alignItems="center">
            <Text dimColor>{modelLine}</Text>
            <Text dimColor>{cwdLine}</Text>
          </Box>
        </Box>

        {/* 分隔线 */}
        <Box
          height="100%"
          borderStyle="single"
          borderColor={colors.primary}
          borderTop={false}
          borderBottom={false}
          borderLeft={false}
        />

        {/* 右栏：Tips + Agents */}
        <FeedColumn feeds={feeds} maxWidth={rightWidth} />
      </Box>
    </Box>
  );
}
