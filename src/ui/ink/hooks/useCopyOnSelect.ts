/**
 * useCopyOnSelect — 选中文本自动复制到剪贴板
 *
 * 功能：监听终端选区变化，选中文本后自动复制到系统剪贴板。
 */

import { useEffect } from 'react';
import instances from '../../../vendor/ink/instances.js';

/**
 * 启用选中即复制功能。
 * 依赖自定义 Ink fork 的 selection 事件。
 */
export function useCopyOnSelect(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    const ink = instances.get(process.stdout);
    if (!ink) return;

    const handleSelection = (text: string) => {
      if (!text) return;
      // 使用 OSC 52 序列复制到剪贴板
      const encoded = Buffer.from(text).toString('base64');
      process.stdout.write(`\x1b]52;c;${encoded}\x07`);
    };

    // 如果 Ink 实例支持 selection 事件
    const emitter = ink as any;
    if (typeof emitter.on === 'function') {
      emitter.on('selection', handleSelection);
      return () => {
        emitter.off('selection', handleSelection);
      };
    }

    return undefined;
  }, [enabled]);
}
