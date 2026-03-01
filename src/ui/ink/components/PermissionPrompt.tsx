/**
 * PermissionPrompt - 权限确认组件
 */

import { useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Select, type SelectOption } from './Select.js';
import { getInkColors } from '../../theme.js';
import type { PermissionDecision } from '../../../core/permissions.js';

export interface PermissionPromptProps {
  toolName: string;
  params: Record<string, unknown>;
  reason?: string;
  commandPrefix?: string | null;
  commandInjectionDetected?: boolean;
  onResolve: (result: PermissionDecision) => void;
}

function formatToolMessage(toolName: string, params: Record<string, unknown>): string {
  switch (toolName) {
    case 'bash':
      return String(params.command || '').slice(0, 160);
    case 'write_file':
    case 'edit_file':
    case 'read_file':
      return String(params.file_path || params.path || '').slice(0, 160);
    default:
      return JSON.stringify(params).slice(0, 160);
  }
}

const SHELL_KEYWORD_PREFIXES = new Set([
  'for',
  'if',
  'while',
  'until',
  'case',
  'select',
  'function',
  'do',
  'then',
  'elif',
  'else',
  'fi',
  'done',
]);

function isUnsafeCompoundCommand(command: string): boolean {
  return /[;&|`]/.test(command) || command.includes('$(') || command.includes('\n');
}

function buildOptions(
  toolName: string,
  params: Record<string, unknown>,
  commandPrefix?: string | null,
  commandInjectionDetected?: boolean
): {
  options: SelectOption[];
  defaultValue: string;
  extra?: { prefix?: string; command?: string };
} {
  const cwd = process.cwd();

  if (toolName === 'bash') {
    const command = String(params.command || '').trim();
    const hasArgs = command.includes(' ');
    const showDontAskAgainOption =
      Boolean(commandPrefix) &&
      !commandInjectionDetected &&
      !isUnsafeCompoundCommand(command);
    const prefixBase = commandPrefix ? commandPrefix.trim().split(/\s+/)[0] : null;
    const preferFullCommandOverPrefix =
      typeof prefixBase === 'string' && SHELL_KEYWORD_PREFIXES.has(prefixBase);
    const showPrefixOption = showDontAskAgainOption && !preferFullCommandOverPrefix && hasArgs;
    const options: SelectOption[] = [
      { label: 'Yes', value: 'allow' },
    ];

    if (showPrefixOption && commandPrefix) {
      options.push({
        label: `Yes, and don't ask again for commands starting with ${commandPrefix} in ${cwd}`,
        value: 'always-prefix',
      });
    }

    if (!showPrefixOption && showDontAskAgainOption && command) {
      options.push({
        label: `Yes, and don't ask again for this exact command in ${cwd}`,
        value: 'always-command',
      });
    }

    options.push({
      label: 'No, and provide instructions (esc)',
      value: 'deny',
    });

    return {
      options,
      defaultValue: 'allow',
      extra: { prefix: commandPrefix || undefined, command },
    };
  }

  const options: SelectOption[] = [
    { label: 'Yes', value: 'allow' },
    {
      label: `Yes, and don't ask again for ${toolName} in ${cwd}`,
      value: 'always-tool',
    },
    { label: 'No, and provide instructions (esc)', value: 'deny' },
  ];

  return { options, defaultValue: 'allow' };
}

export function PermissionPrompt({
  toolName,
  params,
  reason,
  commandPrefix,
  commandInjectionDetected,
  onResolve,
}: PermissionPromptProps) {
  const colors = getInkColors();
  const message = formatToolMessage(toolName, params);

  const { options, defaultValue, extra } = useMemo(
    () => buildOptions(toolName, params, commandPrefix, commandInjectionDetected),
    [toolName, params, commandPrefix, commandInjectionDetected]
  );

  const handleResolve = useCallback(
    (value: string) => {
      switch (value) {
        case 'allow':
          onResolve({ decision: 'allow' });
          break;
        case 'always-prefix':
          onResolve({
            decision: 'allow_always',
            scope: 'prefix',
            key: extra?.prefix,
          });
          break;
        case 'always-command':
          onResolve({
            decision: 'allow_always',
            scope: 'command',
            key: extra?.command,
          });
          break;
        case 'always-tool':
          onResolve({ decision: 'allow_always', scope: 'tool' });
          break;
        default:
          onResolve({ decision: 'deny' });
          break;
      }
    },
    [onResolve, extra]
  );

  useInput(
    useCallback(
      (input: string, key: { escape?: boolean; ctrl?: boolean }) => {
        if (key?.escape || input === 'q') {
          onResolve({ decision: 'deny' });
        }
        if (key?.ctrl && input === 'c') {
          onResolve({ decision: 'deny' });
        }
      },
      [onResolve]
    )
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      marginTop={1}
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
    >
      <Text bold color={colors.warning}>
        {toolName === 'bash' ? 'Bash command' : 'Tool use'}
      </Text>
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>
          {toolName}({message})
        </Text>
        {reason && <Text color={colors.textDim}>{reason}</Text>}
      </Box>

      <Box flexDirection="column">
        <Text>Do you want to proceed?</Text>
        <Select
          options={options}
          defaultValue={defaultValue}
          onChange={handleResolve}
        />
      </Box>
    </Box>
  );
}
