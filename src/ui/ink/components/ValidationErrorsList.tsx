/**
 * ValidationErrorsList — 验证错误列表
 *
 * 功能：展示配置/设置验证错误的统一组件。
 */

import React from 'react';
import { Box, Text } from '../primitives.js';
import figures from 'figures';

export interface ValidationError {
  /** 错误字段/路径 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 严重程度 */
  severity?: 'error' | 'warning';
}

type Props = {
  errors: ValidationError[];
  title?: string;
};

export function ValidationErrorsList({ errors, title }: Props): React.ReactNode {
  if (errors.length === 0) return null;

  return (
    <Box flexDirection="column" marginY={1}>
      {title && (
        <Text bold color="red">
          {figures.cross} {title}
        </Text>
      )}
      {errors.map((error, index) => {
        const isWarning = error.severity === 'warning';
        const icon = isWarning ? figures.warning : figures.cross;
        const color = isWarning ? 'yellow' : 'red';

        return (
          <Box key={`${error.field}-${index}`} gap={1}>
            <Text color={color}>{icon}</Text>
            <Text bold>{error.field}:</Text>
            <Text>{error.message}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
