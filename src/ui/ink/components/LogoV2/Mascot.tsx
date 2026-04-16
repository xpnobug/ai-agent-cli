/**
 * Mascot — 通用吉祥物渲染器
 *
 * 通过 variant 参数选择角色，支持 mascots/ 目录下的所有已注册角色。
 * 替代原 Clawd.tsx 硬编码实现。
 */

import React from 'react';
import { Box, Text } from '../../primitives.js';
import { getMascotById, type MascotPose } from './mascots/index.js';

interface Props {
  variant?: string;    // 角色 id，默认 'clawd'
  pose?: MascotPose;   // 姿势，默认 'default'
}

export function Mascot({ variant = 'clawd', pose = 'default' }: Props): React.ReactNode {
  const mascot = getMascotById(variant);

  // Apple Terminal 检测
  if (process.env['TERM_PROGRAM'] === 'Apple_Terminal') {
    return <AppleTerminalMascot mascot={mascot} pose={pose} />;
  }

  const p = mascot.poses[pose];
  return (
    <Box flexDirection="column">
      {/* 第 1 行：身体侧边 + 眼睛/头部（有背景色） */}
      <Text>
        <Text color={mascot.color}>{p.r1L}</Text>
        <Text color={mascot.color} backgroundColor={mascot.bgColor}>{p.r1E}</Text>
        <Text color={mascot.color}>{p.r1R}</Text>
      </Text>
      {/* 第 2 行：手臂 + 身体（有背景色） */}
      <Text>
        <Text color={mascot.color}>{p.r2L}</Text>
        <Text color={mascot.color} backgroundColor={mascot.bgColor}>{mascot.bodyFill}</Text>
        <Text color={mascot.color}>{p.r2R}</Text>
      </Text>
      {/* 第 3 行：脚 */}
      <Text color={mascot.color}>{mascot.footRow}</Text>
    </Box>
  );
}

function AppleTerminalMascot({
  mascot,
  pose,
}: {
  mascot: ReturnType<typeof getMascotById>;
  pose: MascotPose;
}): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text>
        <Text color={mascot.color}>▗</Text>
        <Text color={mascot.bgColor} backgroundColor={mascot.color}>
          {mascot.appleEyes[pose]}
        </Text>
        <Text color={mascot.color}>▖</Text>
      </Text>
      <Text backgroundColor={mascot.color}>{' '.repeat(7)}</Text>
      <Text color={mascot.color}>▘▘ ▝▝</Text>
    </Box>
  );
}

export type { MascotPose };
