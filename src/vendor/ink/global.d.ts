// @ts-nocheck
/**
 * Ink 自定义 JSX 内部元素类型声明
 *
 * 这些是 Ink 自定义渲染器内部使用的 JSX 元素，
 * 不是标准 HTML 元素，需要在此声明以通过 TypeScript 检查。
 */

import type { Styles } from './styles.js';

// Bun 运行时全局变量桩声明
declare global {
  // eslint-disable-next-line no-var
  var Bun: {
    stringWidth: (str: string) => number;
    spawn: (...args: any[]) => any;
    [key: string]: any;
  } | undefined;

  namespace JSX {
    interface IntrinsicElements {
      'ink-box': Record<string, unknown>;
      'ink-text': Record<string, unknown>;
      'ink-link': Record<string, unknown>;
      'ink-raw-ansi': Record<string, unknown>;
      'ink-virtual-text': Record<string, unknown>;
    }
  }
}

export {};
