/**
 * PlanApprovalMessageView — 计划审批展示
 *
 * 功能：展示计划审批请求和响应。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { Markdown } from '../markdown/Markdown.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';

type PlanApprovalItem = {
  id: string;
  type: 'plan_approval';
  planContent: string;
  planFilePath?: string;
  approved?: boolean;
};

function PlanApprovalMessageView({ item }: MessageViewProps<PlanApprovalItem>): React.ReactNode {
  const borderColor = item.approved === false ? 'red' : 'yellow';
  const statusText = item.approved === true
    ? '计划已批准'
    : item.approved === false
      ? '计划已拒绝'
      : '等待审批';

  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        borderStyle="round"
        borderColor={borderColor}
        flexDirection="column"
        paddingX={1}
      >
        <Box marginBottom={1}>
          <Text color={borderColor} bold>
            {statusText}
          </Text>
        </Box>
        <Box
          borderStyle="single"
          borderDimColor
          borderLeft={false}
          borderRight={false}
          flexDirection="column"
          paddingX={1}
          marginBottom={1}
        >
          <Markdown>{item.planContent}</Markdown>
        </Box>
        {item.planFilePath && (
          <Text dimColor>计划文件: {item.planFilePath}</Text>
        )}
      </Box>
    </Box>
  );
}

registerMessageView('plan_approval', PlanApprovalMessageView as any);

export { PlanApprovalMessageView };
