/**
 * 子代理会话记录（内存态）
 */

import type { Message } from '../../core/types.js';

const transcripts = new Map<string, Message[]>();

export function saveAgentTranscript(agentId: string, messages: Message[]): void {
  transcripts.set(agentId, messages);
}

export function getAgentTranscript(agentId: string): Message[] | undefined {
  return transcripts.get(agentId);
}
