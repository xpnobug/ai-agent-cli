/**
 * usePromptInputPlaceholder — 动态占位符
 *
 * 功能：空输入时根据状态显示不同占位符文本。
 */

import { useMemo } from 'react';

type Props = {
  input: string;
  submitCount: number;
};

/** 示例命令池 */
const EXAMPLE_COMMANDS = [
  '输入你的问题，或者 /help 查看命令',
  '描述你想做的事情…',
  '可以粘贴代码或错误日志让我帮你分析',
  '试试 /compact 压缩上下文',
];

let _exampleIndex = 0;

function getExampleCommand(): string {
  const cmd = EXAMPLE_COMMANDS[_exampleIndex % EXAMPLE_COMMANDS.length]!;
  _exampleIndex++;
  return cmd;
}

export function usePromptInputPlaceholder({
  input,
  submitCount,
}: Props): string | undefined {
  const placeholder = useMemo(() => {
    if (input !== '') {
      return undefined;
    }

    // 首次提交前显示示例命令
    if (submitCount < 1) {
      return getExampleCommand();
    }

    return undefined;
  }, [input, submitCount]);

  return placeholder;
}
