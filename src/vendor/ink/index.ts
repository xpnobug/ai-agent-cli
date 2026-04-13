// @ts-nocheck
/**
 * vendor/ink 统一入口
 *
 * 导出自定义 Ink fork 的核心 API。
 */

import type { ReactNode } from 'react';
import inkRender, {
  type Instance,
  createRoot as inkCreateRoot,
  type RenderOptions,
  type Root,
} from './root.js';

export type { RenderOptions, Instance, Root };

export async function render(
  node: ReactNode,
  options?: NodeJS.WriteStream | RenderOptions,
): Promise<Instance> {
  return inkRender(node, options);
}

export async function createRoot(options?: RenderOptions): Promise<Root> {
  return inkCreateRoot(options);
}

// ─── 组件 ───
export { default as Box } from './components/Box.js';
export type { Props as BoxProps } from './components/Box.js';
export { default as Text } from './components/Text.js';
export type { Props as TextProps } from './components/Text.js';
export { default as Spacer } from './components/Spacer.js';
export { default as Newline } from './components/Newline.js';
export type { Props as NewlineProps } from './components/Newline.js';
export { default as Link } from './components/Link.js';
export type { Props as LinkProps } from './components/Link.js';
export { default as Button } from './components/Button.js';
export type { ButtonState, Props as ButtonProps } from './components/Button.js';
export { NoSelect } from './components/NoSelect.js';
export { RawAnsi } from './components/RawAnsi.js';
export { default as ScrollBox } from './components/ScrollBox.js';
export type { ScrollBoxHandle } from './components/ScrollBox.js';

// ─── Hooks ───
export { default as useApp } from './hooks/use-app.js';
export { default as useInput } from './hooks/use-input.js';
export { default as useStdin } from './hooks/use-stdin.js';
export { useSelection } from './hooks/use-selection.js';
export { useTerminalFocus } from './hooks/use-terminal-focus.js';
export { useTerminalTitle } from './hooks/use-terminal-title.js';
export { useTerminalViewport } from './hooks/use-terminal-viewport.js';
export { useAnimationFrame } from './hooks/use-animation-frame.js';
export { useAnimationTimer, useInterval } from './hooks/use-interval.js';
export { useTabStatus } from './hooks/use-tab-status.js';

// ─── 事件 ───
export { EventEmitter } from './events/emitter.js';
export { Event } from './events/event.js';
export { InputEvent } from './events/input-event.js';
export type { Key } from './events/input-event.js';
export { ClickEvent } from './events/click-event.js';
export { TerminalFocusEvent } from './events/terminal-focus-event.js';
export type { TerminalFocusEventType } from './events/terminal-focus-event.js';

// ─── 工具 ───
export { Ansi } from './Ansi.js';
export { FocusManager } from './focus.js';
export { default as measureElement } from './measure-element.js';
export { default as wrapText } from './wrap-text.js';
export type { DOMElement } from './dom.js';
export type { FlickerReason } from './frame.js';
export { supportsTabStatus } from './termio/osc.js';
