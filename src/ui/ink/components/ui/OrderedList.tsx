/**
 * OrderedList — 有序列表组件
 *
 * 用于 Onboarding 安全说明等多步骤列表。
 */

import React, { type ReactNode } from 'react';
import { Box, Text } from '../../primitives.js';

// ─── OrderedList.Item ───

interface ItemProps {
  children: ReactNode;
}

function OrderedListItem({ children }: ItemProps): React.ReactNode {
  return <Box flexDirection="column">{children}</Box>;
}

// ─── OrderedList ───

interface OrderedListProps {
  children: ReactNode;
}

function OrderedListImpl({ children }: OrderedListProps): React.ReactNode {
  const items = React.Children.toArray(children);
  return (
    <Box flexDirection="column" gap={1}>
      {items.map((child, index) => (
        <Box key={index} flexDirection="row" gap={1}>
          <Text bold>{index + 1}.</Text>
          <Box flexDirection="column" flexShrink={1}>
            {child}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export const OrderedList = Object.assign(OrderedListImpl, {
  Item: OrderedListItem,
});
