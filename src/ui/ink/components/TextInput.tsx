/**
 * TextInput - 终端输入组件
 */

import React from 'react';
import { Text, useInput } from '../primitives.js';
import chalk from 'chalk';
import type { Key } from '../primitives.js';
import { useTextInput } from '../hooks/useTextInput.js';
import { usePasteHandler } from '../hooks/usePasteHandler.js';
import {
  shouldAggregatePasteChunk,
} from '../utils/paste.js';
import {
  acquireBracketedPasteMode,
  releaseBracketedPasteMode,
  consumeBracketedPasteStream,
  type BracketedPasteStreamState,
} from '../utils/bracketedPasteStream.js';

export type TextInputProps = {
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  placeholder?: string;
  multiline?: boolean;
  focus?: boolean;
  mask?: string;
  showCursor?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onExit?: () => void;
  onExitMessage?: (show: boolean, key?: string) => void;
  onMessage?: (show: boolean, message?: string) => void;
  onHistoryReset?: () => void;
  columns: number;
  onPaste?: (text: string) => void;
  isDimmed?: boolean;
  disableCursorMovementForUpDownKeys?: boolean;
  onSpecialKey?: (input: string, key: Key) => boolean;
  cursorOffset: number;
  onChangeCursorOffset: (offset: number) => void;
};

export default function TextInput({
  value: originalValue,
  placeholder = '',
  focus = true,
  mask,
  multiline = false,
  showCursor = true,
  onChange,
  onSubmit,
  onExit,
  onHistoryUp,
  onHistoryDown,
  onExitMessage,
  onMessage,
  onHistoryReset,
  columns,
  onPaste,
  isDimmed = false,
  disableCursorMovementForUpDownKeys = false,
  onSpecialKey,
  cursorOffset,
  onChangeCursorOffset,
}: TextInputProps) {
  const { onInput, renderedValue } = useTextInput({
    value: originalValue,
    onChange,
    onSubmit,
    onExit,
    onExitMessage,
    onMessage,
    onHistoryReset,
    onHistoryUp,
    onHistoryDown,
    mask,
    multiline,
    cursorChar: showCursor ? ' ' : '',
    invert: chalk.inverse,
    columns,
    disableCursorMovementForUpDownKeys,
    externalOffset: cursorOffset,
    onOffsetChange: onChangeCursorOffset,
  });

  React.useEffect(() => {
    acquireBracketedPasteMode();
    return () => releaseBracketedPasteMode();
  }, []);

  const [pasteState, setPasteState] = React.useState<{
    chunks: string[];
    timeoutId: ReturnType<typeof setTimeout> | null;
  }>({ chunks: [], timeoutId: null });

  const bracketedPasteState = React.useRef<BracketedPasteStreamState>({
    mode: 'normal',
    incomplete: '',
    buffer: '',
  });

  const { handlePaste } = usePasteHandler({
    // 普通粘贴仍按文本输入处理，保持现有输入体验。
    onTextPaste: (text) => {
      onInput(text, {} as Key);
    },
    // 特殊粘贴（大段、多行）优先交给外部回调，例如后续的粘贴预览/确认框。
    onSpecialPaste: onPaste
      ? (text) => {
          Promise.resolve().then(() => onPaste(text));
        }
      : undefined,
  });

  const flushBracketedPasteBuffer = (rawText: string) => {
    handlePaste(rawText);
  };

  const resetPasteTimeout = (
    currentTimeoutId: ReturnType<typeof setTimeout> | null
  ) => {
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId);
    }
    return setTimeout(() => {
      setPasteState(({ chunks }) => {
        const pastedText = chunks.join('');
        handlePaste(pastedText);
        return { chunks: [], timeoutId: null };
      });
    }, 500);
  };

  const wrappedOnInput = (input: string, key: Key): void => {
    if (/^(?:\x1b)?\[13;2(?:u|~)$/.test(input)) {
      onInput('\r', { ...key, return: true, meta: false, shift: false } as Key);
      return;
    }
    if (/^(?:\x1b)?\[13;(?:3|4)(?:u|~)$/.test(input)) {
      onInput('\r', { ...key, return: true, meta: true } as Key);
      return;
    }

    if (input === '\n') {
      if (multiline) {
        onInput('\n', key);
        return;
      }

      onInput('\r', { ...key, return: true } as Key);
      return;
    }

    if (input === '\x1b\r' || input === '\x1b\n') {
      onInput('\r', {
        ...key,
        return: true,
        meta: true,
      } as Key);
      return;
    }

    if (onSpecialKey && onSpecialKey(input, key)) {
      return;
    }

    if (
      key.backspace ||
      key.delete ||
      input === '\b' ||
      input === '\x7f' ||
      input === '\x08'
    ) {
      onInput(input, {
        ...key,
        backspace: true,
      } as Key);
      return;
    }

    if (
      input &&
      consumeBracketedPasteStream(input, bracketedPasteState.current, {
        onPlainText: (t) => onInput(t, {} as Key),
        onPasteComplete: flushBracketedPasteBuffer,
      })
    ) {
      return;
    }

    if (onPaste && shouldAggregatePasteChunk(input, pasteState.timeoutId !== null)) {
      setPasteState(({ chunks, timeoutId }) => {
        return {
          chunks: [...chunks, input],
          timeoutId: resetPasteTimeout(timeoutId),
        };
      });
      return;
    }

    onInput(input, key);
  };

  useInput(wrappedOnInput, { isActive: focus });

  let renderedPlaceholder = placeholder
    ? chalk.dim(placeholder)
    : undefined;

  if (showCursor && focus) {
    renderedPlaceholder =
      placeholder.length > 0
        ? chalk.inverse(placeholder[0]) + chalk.dim(placeholder.slice(1))
        : chalk.inverse(' ');
  }

  const showPlaceholder = originalValue.length === 0 && placeholder;
  return (
    <Text wrap="truncate-end" dimColor={isDimmed}>
      {showPlaceholder ? renderedPlaceholder : renderedValue}
    </Text>
  );
}
