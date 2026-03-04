/**
 * 文本输入核心逻辑
 */

import { useState } from 'react';
import type { Key } from 'ink';
import { useDoublePress } from './useDoublePress.js';
import { Cursor } from '../../../utils/cursor.js';
import { normalizeLineEndings } from '../utils/paste.js';

type MaybeCursor = void | Cursor;
type InputHandler = (input: string) => MaybeCursor;
type InputMapper = (input: string) => MaybeCursor;

function mapInput(inputMap: Array<[string, InputHandler]>): InputMapper {
  return function (input: string): MaybeCursor {
    const handler = new Map(inputMap).get(input) ?? (() => {});
    return handler(input);
  };
}

export type UseTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onExit?: () => void;
  onExitMessage?: (show: boolean, key?: string) => void;
  onMessage?: (show: boolean, message?: string) => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  onHistoryReset?: () => void;
  focus?: boolean;
  mask?: string;
  multiline?: boolean;
  cursorChar: string;
  invert: (text: string) => string;
  columns: number;
  disableCursorMovementForUpDownKeys?: boolean;
  externalOffset: number;
  onOffsetChange: (offset: number) => void;
};

export type UseTextInputResult = {
  renderedValue: string;
  onInput: (input: string, key: Key) => void;
  offset: number;
  setOffset: (offset: number) => void;
};

export function useTextInput({
  value: originalValue,
  onChange,
  onSubmit,
  onExit,
  onExitMessage,
  onMessage,
  onHistoryUp,
  onHistoryDown,
  onHistoryReset,
  mask = '',
  multiline = false,
  cursorChar,
  invert,
  columns,
  disableCursorMovementForUpDownKeys = false,
  externalOffset,
  onOffsetChange,
}: UseTextInputProps): UseTextInputResult {
  const offset = externalOffset;
  const setOffset = onOffsetChange;
  const cursor = Cursor.fromText(originalValue, columns, offset);
  const [pendingMessageTimeout, setPendingMessageTimeout] =
    useState<NodeJS.Timeout | null>(null);

  function clearPendingMessage() {
    if (!pendingMessageTimeout) return;
    clearTimeout(pendingMessageTimeout);
    setPendingMessageTimeout(null);
    onMessage?.(false);
  }

  const handleCtrlC = useDoublePress(
    (show) => {
      clearPendingMessage();
      onExitMessage?.(show, 'Ctrl-C');
    },
    () => onExit?.(),
    () => {
      if (originalValue) {
        onChange('');
        onHistoryReset?.();
      }
    }
  );

  const handleEscape = useDoublePress(
    (show) => {
      clearPendingMessage();
      onMessage?.(!!originalValue && show, '再按一次 Esc 清空');
    },
    () => {
      if (originalValue) {
        onChange('');
      }
    }
  );

  function clear(): Cursor {
    return Cursor.fromText('', columns, 0);
  }

  const handleEmptyCtrlD = useDoublePress(
    (show) => onExitMessage?.(show, 'Ctrl-D'),
    () => onExit?.()
  );

  function handleCtrlD(): MaybeCursor {
    clearPendingMessage();
    if (cursor.text === '') {
      handleEmptyCtrlD();
      return cursor;
    }
    return cursor.del();
  }

  const handleCtrl = mapInput([
    ['a', () => cursor.startOfLine()],
    ['b', () => cursor.left()],
    ['c', handleCtrlC],
    ['d', handleCtrlD],
    ['e', () => cursor.endOfLine()],
    ['f', () => cursor.right()],
    [
      'h',
      () => {
        clearPendingMessage();
        return cursor.backspace();
      },
    ],
    ['k', () => cursor.deleteToLineEnd()],
    ['l', () => clear()],
    ['n', () => downOrHistoryDown()],
    ['p', () => upOrHistoryUp()],
    ['u', () => cursor.deleteToLineStart()],
    ['w', () => cursor.deleteWordBefore()],
  ]);

  const handleMeta = mapInput([
    ['b', () => cursor.prevWord()],
    ['f', () => cursor.nextWord()],
    ['d', () => cursor.deleteWordAfter()],
  ]);

  function getKeyFlag(key: Key, prop: string): boolean {
    const record = key as Record<string, unknown>;
    const value = record[prop];
    return typeof value === 'boolean' ? value : false;
  }

  function handleEnter(key: Key) {
    if (!multiline) {
      onSubmit?.(originalValue);
      return;
    }

    if (key.meta || getKeyFlag(key, 'option')) {
      return cursor.insert('\n');
    }
    onSubmit?.(originalValue);
    return undefined;
  }

  function upOrHistoryUp() {
    if (disableCursorMovementForUpDownKeys) {
      onHistoryUp?.();
      return cursor;
    }
    const cursorUp = cursor.up();
    if (cursorUp.equals(cursor)) {
      onHistoryUp?.();
    }
    return cursorUp;
  }

  function downOrHistoryDown() {
    if (disableCursorMovementForUpDownKeys) {
      onHistoryDown?.();
      return cursor;
    }
    const cursorDown = cursor.down();
    if (cursorDown.equals(cursor)) {
      onHistoryDown?.();
    }
    return cursorDown;
  }

  function onInput(input: string, key: Key): void {
    if (key.tab) {
      return;
    }

    if (
      key.backspace ||
      key.delete ||
      input === '\b' ||
      input === '\x7f' ||
      input === '\x08'
    ) {
      const nextCursor = cursor.backspace();
      if (!cursor.equals(nextCursor)) {
        setOffset(nextCursor.offset);
        if (cursor.text !== nextCursor.text) {
          onChange(nextCursor.text);
        }
      }
      return;
    }

    if (!key.ctrl && !key.meta && input.length > 1) {
      const nextCursor = cursor.insert(normalizeLineEndings(input));
      if (!cursor.equals(nextCursor)) {
        setOffset(nextCursor.offset);
        if (cursor.text !== nextCursor.text) {
          onChange(nextCursor.text);
        }
      }
      return;
    }

    const nextCursor = mapKey(key)(input);
    if (nextCursor) {
      if (!cursor.equals(nextCursor)) {
        setOffset(nextCursor.offset);
        if (cursor.text !== nextCursor.text) {
          onChange(nextCursor.text);
        }
      }
    }
  }

  function mapKey(key: Key): InputMapper {
    if (key.backspace || key.delete) {
      clearPendingMessage();
      return () => cursor.backspace();
    }

    switch (true) {
      case key.escape:
        return handleEscape;
      case key.leftArrow && (key.ctrl || key.meta || getKeyFlag(key, 'fn')):
        return () => cursor.prevWord();
      case key.rightArrow && (key.ctrl || key.meta || getKeyFlag(key, 'fn')):
        return () => cursor.nextWord();
      case key.ctrl:
        return handleCtrl;
      case getKeyFlag(key, 'home'):
        return () => cursor.startOfLine();
      case getKeyFlag(key, 'end'):
        return () => cursor.endOfLine();
      case key.pageDown:
        return () => cursor.endOfLine();
      case key.pageUp:
        return () => cursor.startOfLine();
      case key.return:
        return () => handleEnter(key);
      case key.meta:
        return handleMeta;
      case key.upArrow:
        return upOrHistoryUp;
      case key.downArrow:
        return downOrHistoryDown;
      case key.leftArrow:
        return () => cursor.left();
      case key.rightArrow:
        return () => cursor.right();
    }
    return function (input: string) {
      switch (true) {
        case input === '\x1b[H' || input === '\x1b[1~':
          return cursor.startOfLine();
        case input === '\x1b[F' || input === '\x1b[4~':
          return cursor.endOfLine();
        case input === '\b' || input === '\x7f' || input === '\x08':
          clearPendingMessage();
          return cursor.backspace();
        default:
          return cursor.insert(input.replace(/\r/g, '\n'));
      }
    };
  }

  return {
    onInput,
    renderedValue: cursor.render(cursorChar, mask, invert),
    offset,
    setOffset,
  };
}
