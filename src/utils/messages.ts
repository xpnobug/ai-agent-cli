/**
 * utils/messages — 消息管线核心函数
 *
 * 原版 5512 行，提取与 UI 渲染相关的核心管线函数。
 *
 * 包含：
 * - normalizeMessages：将 RichMessage[] 归一化为交替的 user/assistant 序列
 * - reorderMessagesInUI：重排消息顺序（tool_use + tool_result 配对）
 * - buildMessageLookups：构建 tool_use_id → 消息的查找表
 * - createUserMessage / createAssistantMessage：消息工厂函数
 */

import { randomUUID, type UUID } from 'crypto';
import type {
  AssistantMessage,
  ContentBlockParam,
  MessageLookups,
  NormalizedMessage,
  RichMessage,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  UserMessage,
} from '../types/message.js';
import { partiallySanitizeUnicode } from './sanitization.js';

// ─── 消息工厂 ───

/** 创建用户消息
 *
 * 入口净化：当 content 为字符串时（即用户直接键入的文本），
 * 自动做 Unicode 净化防护（ASCII Smuggling / 隐藏提示注入）。
 * 传入 ContentBlockParam[] 的通常是内部组装（如附件、tool_result
 * 回写），不在此处二次处理，避免误伤二进制/非文本块；
 * 这类外部数据应由各自 loader 在写入时就做净化。
 */
export function createUserMessage(params: {
  content: string | ContentBlockParam[];
  isMeta?: boolean;
}): UserMessage {
  const content: ContentBlockParam[] = typeof params.content === 'string'
    ? [{ type: 'text', text: partiallySanitizeUnicode(params.content) }]
    : params.content;

  return {
    type: 'user',
    uuid: randomUUID() as UUID,
    isMeta: params.isMeta,
    message: { role: 'user', content },
  };
}

/** 创建助手消息 */
export function createAssistantMessage(params: {
  content: string | ContentBlockParam[];
}): AssistantMessage {
  const content: ContentBlockParam[] = typeof params.content === 'string'
    ? [{ type: 'text', text: params.content }]
    : params.content;

  return {
    type: 'assistant',
    uuid: randomUUID() as UUID,
    message: { role: 'assistant', content },
  };
}

// ─── 归一化 ───

/**
 * normalizeMessages — 将 RichMessage[] 归一化为 NormalizedMessage[]
 *
 * 1. 过滤 tombstone、progress 等非对话消息
 * 2. 合并连续的同角色消息
 * 3. 确保严格交替的 user/assistant 序列（API 要求）
 */
export function normalizeMessages(messages: RichMessage[]): NormalizedMessage[] {
  const result: NormalizedMessage[] = [];

  for (const msg of messages) {
    // 只保留 user 和 assistant 类型
    if (msg.type !== 'user' && msg.type !== 'assistant') continue;

    const normalized: NormalizedMessage = msg.type === 'user'
      ? { type: 'user', uuid: msg.uuid, isMeta: (msg as UserMessage).isMeta, message: msg.message } as UserMessage
      : { type: 'assistant', uuid: msg.uuid, message: msg.message } as AssistantMessage;

    // 合并连续同角色消息
    const last = result[result.length - 1];
    if (last && last.type === normalized.type) {
      // 追加 content blocks
      last.message.content = [...last.message.content, ...normalized.message.content];
    } else {
      result.push(normalized);
    }
  }

  return result;
}

// ─── 重排序 ───

/**
 * reorderMessagesInUI — 重排消息用于 UI 渲染
 *
 * 1. 将 tool_use 及其对应的 tool_result 配对
 * 2. 隐藏 isMeta 的用户消息
 * 3. 确保视觉顺序合理（用户消息 → AI 响应 → 工具调用 → 工具结果）
 */
export function reorderMessagesInUI(messages: RichMessage[]): RichMessage[] {
  const result: RichMessage[] = [];
  const toolResultMap = new Map<string, RichMessage>();

  // 第一遍：收集所有 tool_result
  for (const msg of messages) {
    if (msg.type === 'user') {
      for (const block of msg.message.content) {
        if (block.type === 'tool_result') {
          toolResultMap.set((block as ToolResultBlock).tool_use_id, msg);
        }
      }
    }
  }

  // 第二遍：按视觉顺序输出
  const emittedToolResults = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'assistant') {
      result.push(msg);

      // 紧跟 tool_use 后面放对应的 tool_result
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          const toolResult = toolResultMap.get((block as ToolUseBlock).id);
          if (toolResult && !emittedToolResults.has((block as ToolUseBlock).id)) {
            result.push(toolResult);
            emittedToolResults.add((block as ToolUseBlock).id);
          }
        }
      }
    } else if (msg.type === 'user') {
      // 跳过已经作为 tool_result 输出的用户消息
      const isToolResult = msg.message.content.some(
        (b) => b.type === 'tool_result' && emittedToolResults.has((b as ToolResultBlock).tool_use_id),
      );
      if (!isToolResult) {
        result.push(msg);
      }
    } else {
      result.push(msg);
    }
  }

  return result;
}

// ─── 查找表 ───

/**
 * buildMessageLookups — 构建消息查找表
 *
 * - toolUseByToolUseID：tool_use_id → 包含该 tool_use 的助手消息
 * - toolResultByToolUseID：tool_use_id → 包含该 tool_result 的用户消息
 * - messageByUuid：uuid → 消息
 */
export function buildMessageLookups(messages: RichMessage[]): MessageLookups {
  const toolUseByToolUseID = new Map<string, AssistantMessage>();
  const toolResultByToolUseID = new Map<string, UserMessage>();
  const messageByUuid = new Map<UUID, RichMessage>();

  for (const msg of messages) {
    messageByUuid.set(msg.uuid, msg);

    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          toolUseByToolUseID.set((block as ToolUseBlock).id, msg as AssistantMessage);
        }
      }
    } else if (msg.type === 'user') {
      for (const block of msg.message.content) {
        if (block.type === 'tool_result') {
          toolResultByToolUseID.set((block as ToolResultBlock).tool_use_id, msg as UserMessage);
        }
      }
    }
  }

  return { toolUseByToolUseID, toolResultByToolUseID, messageByUuid };
}

// ─── 辅助函数 ───

/** 获取最后一条助手消息 */
export function getLastAssistantMessage(messages: RichMessage[]): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.type === 'assistant') return messages[i] as AssistantMessage;
  }
  return undefined;
}

/** 检查最后一个助手轮次是否有工具调用 */
export function hasToolCallsInLastAssistantTurn(messages: RichMessage[]): boolean {
  const last = getLastAssistantMessage(messages);
  if (!last) return false;
  return last.message.content.some((b) => b.type === 'tool_use');
}

/** 过滤不完整的工具调用（没有对应 tool_result 的 tool_use） */
export function filterIncompleteToolCalls(messages: RichMessage[]): RichMessage[] {
  const { toolResultByToolUseID } = buildMessageLookups(messages);

  return messages.filter((msg) => {
    if (msg.type !== 'assistant') return true;
    const hasIncomplete = msg.message.content.some(
      (b) => b.type === 'tool_use' && !toolResultByToolUseID.has((b as ToolUseBlock).id),
    );
    // 如果消息只有不完整的工具调用（没有文本），过滤掉
    if (hasIncomplete) {
      const hasText = msg.message.content.some((b) => b.type === 'text' && (b as TextBlock).text.trim() !== '');
      if (!hasText) return false;
    }
    return true;
  });
}

/** 去除提示词中的 XML 标签（system-reminder 等） */
export function stripPromptXMLTags(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

/** 生成 UUID */
export function deriveUUID(): UUID {
  return randomUUID() as UUID;
}
