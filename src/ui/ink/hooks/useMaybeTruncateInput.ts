/**
 * useMaybeTruncateInput — 长输入截断
 *
 * 功能：超过 10000 字符时自动截断输入，防止终端卡顿。
 */

import { useEffect, useState } from 'react';

const MAX_INPUT_LENGTH = 10_000;
const TRUNCATION_SUFFIX = '\n\n[… 输入被截断，原始长度 {len} 字符]';

type Props = {
  input: string;
  onInputChange: (input: string) => void;
  setCursorOffset: (offset: number) => void;
};

export function useMaybeTruncateInput({
  input,
  onInputChange,
  setCursorOffset,
}: Props): void {
  const [hasAppliedTruncation, setHasAppliedTruncation] = useState(false);

  useEffect(() => {
    if (hasAppliedTruncation) return;
    if (input.length <= MAX_INPUT_LENGTH) return;

    const suffix = TRUNCATION_SUFFIX.replace('{len}', String(input.length));
    const newInput = input.slice(0, MAX_INPUT_LENGTH - suffix.length) + suffix;

    onInputChange(newInput);
    setCursorOffset(newInput.length);
    setHasAppliedTruncation(true);
  }, [input, hasAppliedTruncation, onInputChange, setCursorOffset]);

  // 输入清空后重置截断状态
  useEffect(() => {
    if (input === '') {
      setHasAppliedTruncation(false);
    }
  }, [input]);
}
