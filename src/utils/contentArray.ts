/**
 * content 数组块插入工具
 *
 * 用于在 user message 的 content[] 里把补充块（cache 指令、
 * system-reminder 等）插入到合适位置：
 *   - 若存在 tool_result 块：插在最后一个 tool_result 之后
 *   - 否则：插在最后一个块之前
 *   - 插完后如果新块正好是末尾元素，再补一个 text 块占位
 *     （部分 provider 要求 content 最后一个必须是 text）
 *
 * 会就地修改入参数组（mutates in place）。
 */

interface Block {
  type: string;
  [k: string]: unknown;
}

export function insertBlockAfterToolResults(
  content: unknown[],
  block: unknown,
): void {
  let lastToolResultIndex = -1;
  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      (item as Block).type === 'tool_result'
    ) {
      lastToolResultIndex = i;
    }
  }

  if (lastToolResultIndex >= 0) {
    const insertPos = lastToolResultIndex + 1;
    content.splice(insertPos, 0, block);
    // 如果插完后新块正好落到末尾，追加 text 占位块
    if (insertPos === content.length - 1) {
      content.push({ type: 'text', text: '.' });
    }
    return;
  }

  // 没有 tool_result 块：插在最后一个元素之前
  const insertIndex = Math.max(0, content.length - 1);
  content.splice(insertIndex, 0, block);
}
