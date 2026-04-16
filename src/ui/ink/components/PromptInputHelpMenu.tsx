/**
 * PromptInputHelpMenu — 快捷键帮助列表
 *
 * 纯内容组件，不包含 Pane 容器。由调用方决定是否包裹。
 * 支持 fixedWidth 和 gap 参数（HelpV2 General 中紧凑使用）。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';

type Props = {
  dimColor?: boolean;
  fixedWidth?: boolean;
  gap?: number;
  paddingX?: number;
};

interface HelpSection {
  title: string;
  shortcuts: { key: string; description: string }[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: '输入',
    shortcuts: [
      { key: 'Enter', description: '发送消息（空行时换行）' },
      { key: 'Esc', description: '取消/返回' },
      { key: '↑/↓', description: '浏览历史' },
      { key: 'Ctrl+C', description: '中断 AI 响应' },
      { key: 'Ctrl+D', description: '退出程序' },
    ],
  },
  {
    title: '搜索',
    shortcuts: [
      { key: 'Ctrl+R', description: '搜索历史' },
      { key: 'Ctrl+P', description: '快速打开文件' },
      { key: 'Ctrl+F', description: '全局内容搜索' },
    ],
  },
  {
    title: '滚动',
    shortcuts: [
      { key: 'PageUp/Down', description: '翻页' },
      { key: 'Ctrl+Home', description: '跳到顶部' },
      { key: 'Ctrl+End', description: '跳到底部' },
    ],
  },
  {
    title: '命令',
    shortcuts: [
      { key: '/help', description: '显示命令帮助' },
      { key: '/model', description: '切换模型' },
      { key: '/compact', description: '压缩上下文' },
      { key: '/clear', description: '清除对话' },
    ],
  },
];

export function PromptInputHelpMenu({
  dimColor = true,
  fixedWidth = false,
  gap = 1,
  paddingX = 0,
}: Props): React.ReactNode {
  const keyWidth = fixedWidth ? 16 : undefined;

  return (
    <Box flexDirection="column" paddingX={paddingX} gap={gap}>
      {HELP_SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text bold dimColor={dimColor}>{section.title}</Text>
          {section.shortcuts.map((shortcut) => (
            <Box key={shortcut.key} gap={gap}>
              <Box width={keyWidth} minWidth={keyWidth}>
                <Text color="cyan">{shortcut.key}</Text>
              </Box>
              <Text dimColor={dimColor}>{shortcut.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
