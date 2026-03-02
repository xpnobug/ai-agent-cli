/**
 * useCancelRequest - ESC/Ctrl+C 中断请求
 */

import { useInput } from 'ink';
import type { FocusTarget } from '../types.js';

export interface UseCancelRequestOptions {
  isLoading: boolean;
  focus: FocusTarget;
  onInterrupt: () => void;
}

export function useCancelRequest({
  isLoading,
  focus,
  onInterrupt,
}: UseCancelRequestOptions): void {
  useInput(
    (input, key) => {
      // Ctrl+C：随时中断/退出
      if (key.ctrl && input === 'c') {
        onInterrupt();
        return;
      }

      // ESC：仅在加载中且无对话框时中断
      if (!key.escape) return;
      if (!isLoading) return;
      if (focus) return;

      onInterrupt();
    },
    { isActive: true }
  );
}
