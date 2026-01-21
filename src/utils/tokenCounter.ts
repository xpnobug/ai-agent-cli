/**
 * Token 计数和格式化工具
 * 用于估算和显示 Token 使用情况
 */

import type { Message } from '../core/types.js';

/**
 * 估算文本的 Token 数量
 * 
 * 使用简单的启发式方法: ~4 字符 ≈ 1 token
 * 对于中文: ~2 字符 ≈ 1 token
 * 
 * @param text - 要计数的文本
 * @returns Token 数量估算
 */
export function estimateTokens(text: string): number {
    // 统计中文字符数
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 其他字符数
    const otherChars = text.length - chineseChars;

    // 中文: 2字符≈1token,  英文: 4字符≈1token
    return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 统计消息历史的总 Token 数
 * 
 * @param messages - 消息历史数组
 * @returns 总 Token 数估算
 */
export function countTokens(messages: Message[]): number {
    let total = 0;

    for (const msg of messages) {
        if (typeof msg.content === 'string') {
            total += estimateTokens(msg.content);
        } else if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === 'text') {
                    total += estimateTokens(block.text);
                } else if (block.type === 'tool_result') {
                    // 工具结果也计入 token (content 是 string)
                    total += estimateTokens(block.content);
                }
            }
        }
    }

    return total;
}

/**
 * 格式化 Token 数量为人类可读的字符串
 * 
 * @param tokens - Token 数量
 * @returns 格式化后的字符串 (例: "1.5k", "245", "12.3k")
 */
export function formatTokenCount(tokens: number): string {
    if (tokens < 1000) {
        return tokens.toString();
    } else if (tokens < 10000) {
        return `${(tokens / 1000).toFixed(1)}k`;
    } else {
        return `${Math.round(tokens / 1000)}k`;
    }
}

/**
 * 获取 Token 使用百分比
 * 
 * @param current - 当前使用的 Token 数
 * @param max - 最大 Token 数
 * @returns 百分比 (0-100)
 */
export function getTokenPercentage(current: number, max: number): number {
    if (max === 0) return 0;
    return Math.round((current / max) * 100);
}

/**
 * 判断 Token 使用是否接近限制
 * 
 * @param current - 当前使用的 Token 数
 * @param max - 最大 Token 数
 * @returns 是否需要警告
 */
export function isTokenWarning(current: number, max: number): boolean {
    const percentage = getTokenPercentage(current, max);
    return percentage >= 80; // 80% 以上显示警告
}

/**
 * 判断 Token 使用是否超过限制
 * 
 * @param current - 当前使用的 Token 数
 * @param max - 最大 Token 数
 * @returns 是否超限
 */
export function isTokenDanger(current: number, max: number): boolean {
    const percentage = getTokenPercentage(current, max);
    return percentage >= 95; // 95% 以上显示危险
}

/**
 * 格式化 Token 使用情况为显示字符串
 * 
 * @param current - 当前使用的 Token 数
 * @param max - 最大 Token 数
 * @returns 格式化字符串 (例: "12.5k/200k (6%)")
 */
export function formatTokenUsage(current: number, max: number): string {
    const percentage = getTokenPercentage(current, max);
    return `${formatTokenCount(current)}/${formatTokenCount(max)} (${percentage}%)`;
}

/**
 * 从消息历史中获取准确的 Token 数（使用 API usage数据）
 * 
 * @param messages - 消息历史数组
 * @returns Token 数（从最近的 assistant 消息的 usage 数据）
 */
export function countTokensFromUsage(messages: Message[]): number {
    // 从后向前找最近的 assistant 消息
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.usage) {
            const { inputTokens, outputTokens, cacheCreationTokens = 0, cacheReadTokens = 0 } = msg.usage;
            return inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
        }
    }

    // 回退到估算
    return countTokens(messages);
}
