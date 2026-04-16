/**
 * DiagnosticsDisplay — 诊断结果展示
 *
 * 功能：/doctor 命令触发，展示系统诊断结果。
 */

import React from 'react';
import figures from 'figures';
import { Box, Text } from '../primitives.js';
import { Pane } from './design-system/Pane.js';

export interface DiagnosticCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message?: string;
  detail?: string;
}

type Props = {
  checks: DiagnosticCheck[];
  onClose?: () => void;
};

function statusIcon(status: DiagnosticCheck['status']): { icon: string; color: string } {
  switch (status) {
    case 'pass': return { icon: figures.tick, color: 'green' };
    case 'warn': return { icon: figures.warning, color: 'yellow' };
    case 'fail': return { icon: figures.cross, color: 'red' };
    case 'skip': return { icon: figures.line, color: 'gray' };
  }
}

export function DiagnosticsDisplay({ checks }: Props): React.ReactNode {
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return (
    <Pane color={failCount > 0 ? 'red' : warnCount > 0 ? 'yellow' : 'green'}>
      <Box flexDirection="column" gap={1}>
        <Text bold>系统诊断</Text>
        {checks.map((check) => {
          const { icon, color } = statusIcon(check.status);
          return (
            <Box key={check.name} flexDirection="column">
              <Box gap={1}>
                <Text color={color}>{icon}</Text>
                <Text bold>{check.name}</Text>
                {check.message && <Text dimColor>{check.message}</Text>}
              </Box>
              {check.detail && (
                <Box paddingLeft={3}>
                  <Text dimColor>{check.detail}</Text>
                </Box>
              )}
            </Box>
          );
        })}
        <Box gap={2} marginTop={1}>
          <Text color="green">{passCount} 通过</Text>
          {warnCount > 0 && <Text color="yellow">{warnCount} 警告</Text>}
          {failCount > 0 && <Text color="red">{failCount} 失败</Text>}
        </Box>
      </Box>
    </Pane>
  );
}
