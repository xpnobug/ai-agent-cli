/**
 * 工具结果大小相关常量
 *
 * 控制工具结果何时被落盘、何时截断、何时只回传预览给模型。
 * 单独抽成常量以便各工具共享阈值，避免各自硬编码。
 */

/**
 * 单个工具结果在字符数超过此值时，应持久化到磁盘并只给模型返回预览 + 文件路径。
 * 单个工具可在此基础上声明更小的 maxResultSizeChars；此常量是系统硬顶。
 */
export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000;

/**
 * 工具结果的 token 上限。
 * 这里按 ~4 字节/token 的保守估算，对应约 400KB 文本。
 */
export const MAX_TOOL_RESULT_TOKENS = 100_000;

/** 估算：每 token 占多少字节（用于字节数 ↔ token 互转） */
export const BYTES_PER_TOKEN = 4;

/** 工具结果字节上限（从 token 上限推导） */
export const MAX_TOOL_RESULT_BYTES = MAX_TOOL_RESULT_TOKENS * BYTES_PER_TOKEN;

/**
 * 单条 user 消息（一轮并行工具的 tool_result 合集）里所有结果的总字符上限。
 * 多个并行工具各自命中 per-tool max 时可能叠加到 400K+，这里是聚合硬顶；
 * 超过时把最大的几块持久化到磁盘，用预览替换，直到回到预算之内。
 *
 * 不同轮次独立判断：上一轮 150K + 本轮 150K 不会相互挤压。
 */
export const MAX_TOOL_RESULTS_PER_MESSAGE_CHARS = 200_000;

/** 紧凑视图里工具摘要字符串的最大字符数 */
export const TOOL_SUMMARY_MAX_LENGTH = 50;
