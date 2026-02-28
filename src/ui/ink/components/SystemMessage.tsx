/**
 * SystemMessage - 系统消息组件（成功/错误/警告/信息）
 *
 * 统一使用 ✱ 前缀，颜色按级别区分
 */

import { Text } from 'ink';
import { UI_SYMBOLS } from '../../../core/constants.js';
import { isAccessibilityMode, getInkColors } from '../../theme.js';

export interface SystemMessageProps {
  level: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

export function SystemMessage({ level, text }: SystemMessageProps) {
  if (isAccessibilityMode()) {
    const labelMap = { success: '成功', error: '错误', warning: '警告', info: '信息' };
    return <Text>[{labelMap[level]}] {text}</Text>;
  }

  const colors = getInkColors();

  const colorMap = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.textDim,
  } as const;

  return (
    <Text>
      <Text color={colorMap[level]}>{UI_SYMBOLS.statusPrefix}</Text>
      {' '}
      {level === 'error' ? (
        <Text color={colors.error} bold>{text}</Text>
      ) : (
        <Text dimColor>{text}</Text>
      )}
    </Text>
  );
}
