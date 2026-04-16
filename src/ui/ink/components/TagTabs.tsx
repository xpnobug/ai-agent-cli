/**
 * TagTabs — 标签页切换组件
 *
 * 功能：通用的标签筛选器（如按标签过滤列表）。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';

type Props = {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
};

export function TagTabs({ tags, selectedTag, onSelect }: Props): React.ReactNode {
  return (
    <Box gap={1}>
      <Box onClick={() => onSelect(null)}>
        <Text
          color={selectedTag === null ? 'cyan' : undefined}
          bold={selectedTag === null}
          underline={selectedTag === null}
        >
          全部
        </Text>
      </Box>
      {tags.map((tag) => (
        <Box key={tag} onClick={() => onSelect(tag)}>
          <Text
            color={selectedTag === tag ? 'cyan' : undefined}
            bold={selectedTag === tag}
            underline={selectedTag === tag}
          >
            {tag}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
