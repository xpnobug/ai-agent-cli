/**
 * Messages — 消息管线组件
 *
 * 适配 ai-agent-cli 的 CompletedItem 类型系统。
 *
 * 管线：completedItems → applyGrouping → collapseReadSearchGroups → renderableMessages
 * 渲染：VirtualMessageList（全屏虚拟滚动） | .map()（降级直接渲染）
 *
 * 包含：
 * - 消息分组（连续 tool_use/tool_result → GroupedToolUse）
 * - 折叠读/搜索组（全是 read/search 工具 → CollapsedReadSearchGroup）
 * - 启动横幅 + StatusNotices 作为消息区头部
 * - 未读分割线（UnseenDivider）
 * - 流式文本 + 活跃工具调用
 * - VirtualMessageList 集成（scrollRef + columns 驱动虚拟滚动）
 * - 自定义 memo 比较器（streaming 增量不触发完整重渲染）
 */

import React, { useMemo, useCallback } from 'react';
import type { RefObject } from 'react';
import { Box, Text } from '../primitives.js';
import type { ScrollBoxHandle } from '../primitives.js';
import type { CompletedItem, ActiveToolUse } from '../types.js';
import type { StreamingState } from '../types.js';
import { ToolUseView } from './ToolUseView.js';
import { ToolUseLoader } from './ToolUseLoader.js';
import { VirtualMessageList } from './VirtualMessageList.js';
import { MessageRow } from './messages/MessageRow.js';
import { StreamingMarkdown } from './markdown/StreamingMarkdown.js';
import { isReadSearchTool } from './messages/CollapsedReadSearchView.js';
import { BannerView } from './BannerView.js';
import { StatusNotices } from './StatusNotices.js';

// ─── 消息分组类型 ───

export interface GroupedToolUse {
  type: 'grouped_tool_use';
  id: string;
  items: CompletedItem[];
}

export interface CollapsedReadSearchGroup {
  type: 'collapsed_read_search';
  id: string;
  items: CompletedItem[];
}

export type RenderableMessage = CompletedItem | GroupedToolUse | CollapsedReadSearchGroup;

// ─── 管线函数 ───

/**
 * 连续的 tool_use + tool_result 分组为 GroupedToolUse（>2 个时）
 */
function applyGrouping(items: CompletedItem[]): RenderableMessage[] {
  const result: RenderableMessage[] = [];
  let toolGroup: CompletedItem[] = [];

  const flushGroup = () => {
    if (toolGroup.length === 0) return;
    if (toolGroup.length <= 2) {
      result.push(...toolGroup);
    } else {
      result.push({
        type: 'grouped_tool_use',
        id: `group-${toolGroup[0]!.id}`,
        items: [...toolGroup],
      });
    }
    toolGroup = [];
  };

  for (const item of items) {
    if (item.type === 'tool_use' || item.type === 'tool_result') {
      toolGroup.push(item);
    } else {
      flushGroup();
      result.push(item);
    }
  }
  flushGroup();

  return result;
}

/**
 * 全是 read/search 工具的组 → CollapsedReadSearchGroup
 */
function collapseReadSearchGroups(messages: RenderableMessage[]): RenderableMessage[] {
  return messages.map((msg) => {
    if (msg.type !== 'grouped_tool_use') return msg;
    const toolUses = msg.items.filter((i) => i.type === 'tool_use');
    const allReadSearch = toolUses.length > 0 && toolUses.every(
      (i) => i.type === 'tool_use' && isReadSearchTool(i.name),
    );
    if (allReadSearch) {
      return {
        type: 'collapsed_read_search' as const,
        id: msg.id,
        items: msg.items,
      };
    }
    return msg;
  });
}

// ─── 消息 key 提取 ───

const messageKey = (msg: RenderableMessage): string => msg.id;

// ─── renderItem（VirtualMessageList 的渲染函数） ───

function renderMessageItem(
  msg: RenderableMessage,
  idx: number,
  list: RenderableMessage[],
): React.ReactNode {
  return <MessageRow message={msg} index={idx} messages={list} />;
}

// ─── Messages 组件 Props ───

export interface MessagesProps {
  completedItems: CompletedItem[];
  activeToolUses: ActiveToolUse[];
  streaming: StreamingState;
  /** ScrollBox ref（虚拟滚动需要） */
  scrollRef?: RefObject<ScrollBoxHandle | null>;
  /** 终端列数（虚拟滚动高度缓存失效需要） */
  columns?: number;
  /** 隐藏 banner/logo（子代理视图时） */
  hideLogo?: boolean;
  /** 启用 StickyTracker */
  trackStickyPrompt?: boolean;
}

// ─── Messages 实现 ───

function MessagesImpl({
  completedItems,
  activeToolUses,
  streaming,
  scrollRef,
  columns,
  hideLogo = false,
  trackStickyPrompt = true,
}: MessagesProps) {
  // ─── 消息管线：归一化 → 分组 → 折叠 ───
  const renderableMessages = useMemo(() => {
    const grouped = applyGrouping(completedItems);
    return collapseReadSearchGroups(grouped);
  }, [completedItems]);

  /**
   * 不参与虚拟列表切片；这里保持相同编排。
   */
  const startupBanner = useMemo(() => {
    if (hideLogo) return null;
    const first = renderableMessages[0];
    return first?.type === 'banner' ? first : null;
  }, [renderableMessages, hideLogo]);

  const listMessages = useMemo(
    () => (startupBanner ? renderableMessages.slice(1) : renderableMessages),
    [renderableMessages, startupBanner],
  );

  const startupHeader = useMemo(() => {
    if (!startupBanner) return null;

    return (
      <Box flexDirection="column" gap={1}>
        <BannerView config={startupBanner.config} />
        <StatusNotices
          workdir={startupBanner.config.workdir}
          projectFile={startupBanner.config.projectFile}
        />
      </Box>
    );
  }, [startupBanner]);

  const renderItem = useCallback(
    (msg: RenderableMessage, idx: number, all: RenderableMessage[]) =>
      renderMessageItem(msg, idx, all),
    [],
  );

  // ─── 虚拟滚动 vs 直接渲染 ───
  const useVirtual = Boolean(scrollRef && columns);

  return (
    <Box flexDirection="column">
      {startupHeader}

      {/* 消息列表 */}
      {useVirtual ? (
        <VirtualMessageList
          messages={listMessages}
          scrollRef={scrollRef!}
          columns={columns!}
          itemKey={messageKey}
          renderItem={renderItem}
          trackStickyPrompt={trackStickyPrompt}
        />
      ) : (
        listMessages.map((msg, idx) => (
          <MessageRow key={msg.id} message={msg} index={idx} messages={listMessages} />
        ))
      )}

      {/* 流式文本（StreamingMarkdown：stable/unstable 分割，只重解析最后一个块） */}
      {streaming && (
        <Box alignItems="flex-start" flexDirection="row" marginTop={1} width="100%">
          <Box flexDirection="row">
            <Box minWidth={2}>
              <Text color="gray">⏺</Text>
            </Box>
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <StreamingMarkdown>{streaming.text}</StreamingMarkdown>
            </Box>
          </Box>
        </Box>
      )}

      {/* 活跃工具调用 */}
      {activeToolUses.length > 0 && (
        <Box flexDirection="column" gap={1}>
          {activeToolUses.map((toolUse) => (
            toolUse.status === 'running' ? (
              <ToolUseLoader
                key={toolUse.toolUseId}
                toolName={toolUse.name}
                description={toolUse.detail}
              />
            ) : (
              <ToolUseView
                key={toolUse.toolUseId}
                name={toolUse.name}
                detail={toolUse.detail}
                status={toolUse.status}
                animate={false}
              />
            )
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── 自定义 memo 比较器 ───

function areMessagesEqual(prev: MessagesProps, next: MessagesProps): boolean {
  // scrollRef、trackStickyPrompt 等 ref/callback 跳过比较（不影响渲染输出）
  if (prev.completedItems !== next.completedItems) return false;
  if (prev.activeToolUses !== next.activeToolUses) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.columns !== next.columns) return false;
  if (prev.hideLogo !== next.hideLogo) return false;
  return true;
}

export const Messages = React.memo(MessagesImpl, areMessagesEqual);
