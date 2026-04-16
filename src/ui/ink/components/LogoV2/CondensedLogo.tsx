/**
 * CondensedLogo — 简洁版启动横幅
 *
 * 左侧 Clawd 像素画 + 右侧信息列，水平排列。
 *
 *  ▐▛███▜▌  AI Agent CLI v1.0.0
 *  ▝▜█████▛▘  gpt-5.4
 *    ▘▘ ▝▝    ~/my-project
 */

import { Box, Text } from '../../primitives.js';
import { Mascot } from './Mascot.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../../../../core/constants.js';
import type { BannerConfig } from '../../types.js';

export interface CondensedLogoProps {
  config: BannerConfig;
}

export function CondensedLogo({ config }: CondensedLogoProps) {
  const workdirName = config.workdir.split('/').pop() || 'workspace';

  return (
    <Box flexDirection="row" gap={2} alignItems="center" paddingBottom={1}>
      {/* 左侧：Clawd 像素字符画 */}
      <Mascot variant={config.mascot} />

      {/* 右侧：信息列 */}
      <Box flexDirection="column">
        {/* 产品名 + 版本 */}
        <Text>
          <Text bold>{PRODUCT_NAME}</Text>
          {' '}
          <Text dimColor>v{PRODUCT_VERSION}</Text>
        </Text>

        {/* 模型 */}
        <Text dimColor>{config.model}</Text>

        {/* 工作目录 */}
        <Text dimColor>~/{workdirName}</Text>
      </Box>
    </Box>
  );
}
