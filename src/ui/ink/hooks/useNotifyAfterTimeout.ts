/**
 * useNotifyAfterTimeout — 长时间运行后发送系统通知
 *
 * 功能：当 AI 响应超过指定时间后，发送桌面通知提醒用户。
 *       仅在终端不在焦点时触发。
 */

import { useEffect, useRef } from 'react';
import { execaCommand } from 'execa';

const DEFAULT_TIMEOUT_MS = 30_000; // 30 秒

interface NotifyOptions {
  /** 是否正在加载（AI 正在响应） */
  isLoading: boolean;
  /** 超时阈值（毫秒），默认 30 秒 */
  timeoutMs?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 发送 macOS 系统通知
 */
async function sendNotification(title: string, message: string): Promise<void> {
  try {
    if (process.platform === 'darwin') {
      await execaCommand(
        `osascript -e 'display notification "${message}" with title "${title}"'`,
        { reject: false, timeout: 5000 },
      );
    }
    // Linux: 使用 notify-send（如果可用）
    else if (process.platform === 'linux') {
      await execaCommand(
        `notify-send "${title}" "${message}"`,
        { reject: false, timeout: 5000 },
      );
    }
  } catch {
    // 通知失败不影响主流程
  }
}

export function useNotifyAfterTimeout({
  isLoading,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  enabled = true,
}: NotifyOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (isLoading) {
      // 开始计时
      notifiedRef.current = false;
      timerRef.current = setTimeout(() => {
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          sendNotification('AI Agent CLI', '响应已就绪');
        }
      }, timeoutMs);
    } else {
      // 加载结束，清除计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading, timeoutMs, enabled]);
}
