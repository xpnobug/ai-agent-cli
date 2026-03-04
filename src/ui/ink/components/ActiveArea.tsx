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

import type { FocusTarget, ActiveToolUse } from '../types.js';
import { RequestStatusIndicator } from './RequestStatusIndicator.js';
import type { TokenStatsSnapshot } from './EnhancedSpinner.js';
import { UserInput } from './UserInput.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import type { AskUserQuestionDef } from '../types.js';
import { QuestionPrompt } from './QuestionPrompt.js';
import type { SlashCommandItem } from '../completion/types.js';
import { ToolUseView } from './ToolUseView.js';
import { SessionSelector } from './SessionSelector.js';
import { TaskSelector } from './TaskSelector.js';

export interface DynamicAreaProps {
  focus: FocusTarget;
  onInput: (text: string) => void;
  onExit: () => void;
  slashCommands: SlashCommandItem[];
  getTokenStats?: () => TokenStatsSnapshot;
  tokenInfo?: string | null;
  activeToolUses: ActiveToolUse[];
  isLoading: boolean;
}

export function DynamicArea({
  focus,
  onInput,
  onExit,
  slashCommands,
  getTokenStats,
  tokenInfo,
  activeToolUses,
  isLoading,
}: DynamicAreaProps) {
  return (
    <>
      {/* RequestStatusIndicator */}
      {isLoading && !focus && (
        <RequestStatusIndicator getTokenStats={getTokenStats} />
      )}

      {/* 活跃工具调用（非 Static，可动画） */}
      {activeToolUses.length > 0 && (
        <>
          {activeToolUses.map((toolUse) => (
            <ToolUseView
              key={toolUse.toolUseId}
              name={toolUse.name}
              detail={toolUse.detail}
              status={toolUse.status}
              animate={toolUse.status === 'running'}
            />
          ))}
        </>
      )}

      {/* 焦点驱动的对话框（互斥） */}
      {focus?.type === 'permission' && (
        <PermissionPrompt
          toolName={focus.toolName}
          params={focus.params}
          reason={focus.reason}
          commandPrefix={focus.commandPrefix}
          commandInjectionDetected={focus.commandInjectionDetected}
          onResolve={focus.resolve}
        />
      )}
      {focus?.type === 'question' && (
        <QuestionPrompt
          questions={focus.questions as AskUserQuestionDef[]}
          initialAnswers={focus.initialAnswers}
          onResolve={focus.resolve}
        />
      )}
      {focus?.type === 'session_selector' && (
        <SessionSelector
          sessions={focus.sessions}
          onSelect={(index) => focus.resolve(index)}
          onCancel={() => focus.resolve(null)}
        />
      )}
      {focus?.type === 'task_selector' && (
        <TaskSelector
          tasks={focus.tasks}
          onAction={(action, taskId) => focus.resolve({ action, taskId })}
          onCancel={() => focus.resolve(null)}
        />
      )}

      {/* 无焦点 → 输入框 */}
      {!focus && (
        <UserInput
          slashCommands={slashCommands}
          onSubmit={onInput}
          onExit={onExit}
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
