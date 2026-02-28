/**
 * DynamicArea - 动态区域组件（堆叠式渲染）
 *
 * 替代旧的 switch/case 互斥 ActiveArea：
 * - Spinner 与对话框/输入框可共存
 * - 焦点驱动对话框与输入框互斥
 *
 * 文件名保留 ActiveArea.tsx 避免大面积 import 修改。
 *
 * 注意：不使用外层 <Box> 包裹，避免 Ink 动态区域行高计算偏差。
 * 子元素直接暴露给父级 Box(column)，由 App.tsx 的根 Box 负责布局。
 */

import type { LoadingState, FocusTarget } from '../types.js';
import { EnhancedSpinner } from './EnhancedSpinner.js';
import type { TokenStatsSnapshot } from './EnhancedSpinner.js';
import { UserInput } from './UserInput.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import type { QuestionDef } from './QuestionPrompt.js';
import { QuestionPrompt } from './QuestionPrompt.js';
import type { KeybindingRegistry } from '../../keybindings.js';

export interface DynamicAreaProps {
  loading: LoadingState;
  focus: FocusTarget;
  onInput: (text: string) => void;
  onExit: () => void;
  commandNames: string[];
  keybindingRegistry?: KeybindingRegistry;
  getTokenStats?: () => TokenStatsSnapshot;
  tokenInfo?: string | null;
}

export function DynamicArea({ loading, focus, onInput, onExit, commandNames, keybindingRegistry, getTokenStats, tokenInfo }: DynamicAreaProps) {
  return (
    <>
      {/* Spinner — loading 非 null 时显示，与对话框/输入共存 */}
      {loading && <EnhancedSpinner loading={loading} getTokenStats={getTokenStats} />}

      {/* 焦点驱动的对话框（互斥） */}
      {focus?.type === 'permission' && (
        <PermissionPrompt
          toolName={focus.toolName}
          params={focus.params}
          reason={focus.reason}
          onResolve={focus.resolve}
        />
      )}
      {focus?.type === 'question' && (
        <QuestionPrompt
          questions={focus.questions as QuestionDef[]}
          onResolve={focus.resolve}
        />
      )}

      {/* 无焦点 → 输入框 */}
      {!focus && (
        <UserInput
          commandNames={commandNames}
          onSubmit={onInput}
          onCancel={() => {}}
          onExit={onExit}
          keybindingRegistry={keybindingRegistry}
          tokenInfo={tokenInfo}
        />
      )}
    </>
  );
}

/**
 * @deprecated 使用 DynamicArea 替代
 */
export const ActiveArea = DynamicArea;
