/**
 * UserPlanMessage — 计划内容展示
 *
 * 功能：用圆角边框 + planMode 颜色展示计划内容。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { Markdown } from '../markdown/Markdown.js';
import type { MessageViewProps } from './registry.js';
import { registerMessageView } from './registry.js';

type UserPlanItem = {
  id: string;
  type: 'user_plan';
  planContent: string;
};

function UserPlanMessageView({ item }: MessageViewProps<UserPlanItem>): React.ReactNode {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      marginTop={1}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Plan to implement
        </Text>
      </Box>
      <Markdown>{item.planContent}</Markdown>
    </Box>
  );
}

registerMessageView('user_plan', UserPlanMessageView as any);

export { UserPlanMessageView };
