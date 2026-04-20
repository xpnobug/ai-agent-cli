/**
 * PermissionPrompt - 权限确认组件（分发体系）
 *
 * 按 toolName 分发到不同的内容预览区：
 * - bash → 语法高亮命令预览
 * - edit_file → diff 预览（StructuredDiffList）
 * - write_file → 文件路径 + 内容预览
 * - 其他 → JSON 参数摘要
 *
 * 选项逻辑统一在顶层组件中处理。
 */

import path from 'node:path';
import { useCallback, useMemo } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import { Select, type SelectOption } from './Select.js';
import { getInkColors } from '../../theme.js';
import { HighlightedCode } from './HighlightedCode.js';
import { StructuredDiffList } from './StructuredDiff/index.js';
import { getPatchFromContents } from '../../../utils/diff.js';
import { getToolDisplayName } from './ToolUseView.js';
import type { PermissionDecision } from '../../../core/permissions.js';

export interface PermissionPromptProps {
  toolName: string;
  params: Record<string, unknown>;
  reason?: string;
  commandPrefix?: string | null;
  commandInjectionDetected?: boolean;
  /** 危险命令警告文本（中文），仅 UI 展示，不改变权限选项 */
  destructiveWarning?: string | null;
  onResolve: (result: PermissionDecision) => void;
}

function formatToolMessage(toolName: string, params: Record<string, unknown>): string {
  const formatPath = (raw: string): string => {
    const cwd = process.cwd();
    if (path.isAbsolute(raw)) {
      const rel = path.relative(cwd, raw);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
        return rel;
      }
    }
    return raw;
  };

  switch (toolName) {
    case 'bash':
      return String(params.command || '').slice(0, 160);
    case 'write_file':
    case 'edit_file':
    case 'read_file':
      return formatPath(String(params.file_path || params.path || '')).slice(0, 160);
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
  destructiveWarning,
  onResolve,
}: PermissionPromptProps) {
  const colors = getInkColors();
  const displayName = getToolDisplayName(toolName);

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
        ⏺ {displayName}
      </Text>

      {/* 按工具类型分发内容预览区 */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <PermissionPreview toolName={toolName} params={params} />
        {destructiveWarning && (
          <Text color={colors.warning}>⚠  注意：{destructiveWarning}</Text>
        )}
        {reason && <Text color={colors.textDim} dimColor>{reason}</Text>}
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

// ─── 权限预览分发 ───

function PermissionPreview({ toolName, params }: { toolName: string; params: Record<string, unknown> }) {
  const n = toolName.toLowerCase();

  // bash → 语法高亮命令
  if (n === 'bash') {
    return <HighlightedCode code={String(params.command || '')} language="bash" />;
  }

  // edit_file → diff 预览
  if (n === 'edit_file' || n === 'edit' || n === 'fileedittool' || n === 'str_replace_based_edit_tool') {
    return <EditPermissionPreview params={params} />;
  }

  // write_file → 文件路径 + 内容片段
  if (n === 'write_file' || n === 'write' || n === 'filewritetool' || n === 'create_file') {
    return <WritePermissionPreview params={params} />;
  }

  // 默认 → 参数摘要
  const message = formatToolMessage(toolName, params);
  return <Text>{message}</Text>;
}

// ─── edit_file diff 预览 ───

function EditPermissionPreview({ params }: { params: Record<string, unknown> }) {
  const oldStr = typeof params.old_string === 'string' ? params.old_string : '';
  const newStr = typeof params.new_string === 'string' ? params.new_string : '';
  const filePath = String(params.file_path || params.path || '');
  const displayPath = filePath ? formatRelativePath(filePath) : '';

  if (!oldStr && !newStr) {
    return <Text dimColor>{displayPath || 'No changes'}</Text>;
  }

  const hunks = getPatchFromContents({
    filePath: filePath || 'file',
    oldContent: oldStr,
    newContent: newStr,
  });

  const width = Math.max(40, (process.stdout.columns || 80) - 16);

  return (
    <Box flexDirection="column">
      {displayPath && <Text dimColor>{displayPath}</Text>}
      {hunks.length > 0 ? (
        <StructuredDiffList hunks={hunks} filePath={filePath} width={width} />
      ) : (
        <Text dimColor>(无差异)</Text>
      )}
    </Box>
  );
}

// ─── write_file 内容预览 ───

function WritePermissionPreview({ params }: { params: Record<string, unknown> }) {
  const filePath = String(params.file_path || params.path || '');
  const content = typeof params.content === 'string' ? params.content : '';
  const displayPath = filePath ? formatRelativePath(filePath) : '';
  const lines = content.split('\n');
  const preview = lines.slice(0, 5).join('\n');
  const extra = lines.length - 5;

  return (
    <Box flexDirection="column">
      {displayPath && <Text bold>{displayPath}</Text>}
      {content && (
        <Box flexDirection="column">
          <Text dimColor>{preview}</Text>
          {extra > 0 && <Text dimColor>... (+{extra} lines)</Text>}
        </Box>
      )}
    </Box>
  );
}

// ─── 辅助函数 ───

function formatRelativePath(raw: string): string {
  const cwd = process.cwd();
  if (path.isAbsolute(raw)) {
    const rel = path.relative(cwd, raw);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel;
    }
  }
  return raw;
}
