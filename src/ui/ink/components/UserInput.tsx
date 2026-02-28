/**
 * UserInput - 用户输入组件
 * 基于 Ink useStdin + Cursor 类实现
 * 使用 KeybindingRegistry 替代硬编码按键映射
 */

import { useState, useEffect, useRef } from 'react';
import { Box, Text, useStdin, useApp } from 'ink';
import { Cursor } from '../../../utils/cursor.js';
import { getInkColors } from '../../theme.js';
import { UI_SYMBOLS } from '../../../core/constants.js';
import type { KeybindingRegistry } from '../../keybindings.js';

export interface UserInputProps {
  prefix?: string;
  commandNames?: string[];
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onExit: () => void;
  keybindingRegistry?: KeybindingRegistry;
  tokenInfo?: string | null;
}

/**
 * 命令历史记录
 */
class CommandHistory {
  private history: string[] = [];
  private index = -1;
  private maxSize: number;
  private tempInput = '';

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  add(command: string): void {
    if (!command.trim()) return;
    if (this.history[0] === command) return;
    this.history.unshift(command);
    if (this.history.length > this.maxSize) {
      this.history.pop();
    }
    this.reset();
  }

  up(currentInput: string): string | null {
    if (this.history.length === 0) return null;
    if (this.index === -1) {
      this.tempInput = currentInput;
    }
    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index]!;
    }
    return null;
  }

  down(): string | null {
    if (this.index > 0) {
      this.index--;
      return this.history[this.index]!;
    } else if (this.index === 0) {
      this.index = -1;
      return this.tempInput;
    }
    return null;
  }

  reset(): void {
    this.index = -1;
    this.tempInput = '';
  }

  getAll(): string[] {
    return [...this.history];
  }
}

// 模块级命令历史实例（跨渲染保持）
const commandHistory = new CommandHistory();

export function UserInput({
  prefix = '❯',
  commandNames = [],
  onSubmit,
  onCancel,
  onExit,
  keybindingRegistry,
  tokenInfo,
}: UserInputProps) {
  const [cursor, setCursor] = useState(() => new Cursor(''));
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const { stdin, setRawMode } = useStdin();
  const { exit } = useApp();

  // 开启 raw mode
  useEffect(() => {
    setRawMode(true);
    return () => {
      setRawMode(false);
    };
  }, [setRawMode]);

  // 监听 stdin data 事件
  useEffect(() => {
    const onData = (rawData: Buffer | string) => {
      // Ink 的 setRawMode(true) 会设置 stdin.setEncoding('utf8')，
      // 导致 data 事件传入 string 而非 Buffer，需要统一转换
      const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
      const char = data.toString();
      const code = data[0];

      // 如果有 KeybindingRegistry，使用注册表模式
      if (keybindingRegistry) {
        const keyName = keybindingRegistry.parseKey(data);
        if (keyName) {
          const context: Record<string, boolean> = {
            inputEmpty: cursorRef.current.text === '',
            'hasPrefix:/': cursorRef.current.text.startsWith('/'),
          };
          const action = keybindingRegistry.getAction(keyName, context);
          if (action) {
            handleAction(action);
            return;
          }
        }

        // 可打印字符
        if (code !== undefined && code >= 32) {
          setCursor(prev => prev.insert(char));
        }
        return;
      }

      // 回退到硬编码按键映射（兼容模式）
      handleLegacyKey(data, char, code);
    };

    /**
     * 通过 action 名执行操作
     */
    function handleAction(action: string): void {
      switch (action) {
        case 'cancel':
          setCursor(new Cursor(''));
          onCancel();
          break;

        case 'historyUp':
          setCursor(prev => {
            const historyText = commandHistory.up(prev.text);
            if (historyText !== null) {
              return new Cursor(historyText, historyText.length);
            }
            return prev.up();
          });
          break;

        case 'historyDown':
          setCursor(prev => {
            const historyText = commandHistory.down();
            if (historyText !== null) {
              return new Cursor(historyText, historyText.length);
            }
            return prev.down();
          });
          break;

        case 'cursorRight':
          setCursor(prev => prev.right());
          break;

        case 'cursorLeft':
          setCursor(prev => prev.left());
          break;

        case 'delete':
          setCursor(prev => prev.delete());
          break;

        case 'newline':
          setCursor(prev => prev.insert('\n'));
          break;

        case 'submit': {
          const text = cursorRef.current.text.trim();
          if (text) {
            commandHistory.add(text);
          }
          setCursor(new Cursor(''));
          onSubmit(text);
          break;
        }

        case 'exit':
          onExit();
          exit();
          break;

        case 'backspace':
          setCursor(prev => prev.backspace());
          break;

        case 'startOfLine':
          setCursor(prev => prev.startOfLine());
          break;

        case 'endOfLine':
          setCursor(prev => prev.endOfLine());
          break;

        case 'deleteToLineStart':
          setCursor(prev => prev.deleteToLineStart());
          break;

        case 'deleteToLineEnd':
          setCursor(prev => prev.deleteToLineEnd());
          break;

        case 'deleteWordBefore':
          setCursor(prev => prev.deleteWordBefore());
          break;

        case 'complete':
          if (commandNames.length > 0) {
            setCursor(prev => {
              if (prev.text.startsWith('/')) {
                const partial = prev.text.slice(1).toLowerCase();
                const matches = commandNames.filter(name => name.startsWith(partial));
                if (matches.length === 1) {
                  const completed = '/' + matches[0];
                  return new Cursor(completed, completed.length);
                } else if (matches.length > 1) {
                  let common = matches[0];
                  for (const match of matches) {
                    while (!match.startsWith(common)) {
                      common = common.slice(0, -1);
                    }
                  }
                  if (common.length > partial.length) {
                    const completed = '/' + common;
                    return new Cursor(completed, completed.length);
                  }
                }
              }
              return prev;
            });
          }
          break;
      }
    }

    /**
     * 硬编码按键处理（兼容回退）
     */
    function handleLegacyKey(data: Buffer, char: string, code: number | undefined): void {
      // ESC - 取消
      if (code === 27 && data.length === 1) {
        setCursor(new Cursor(''));
        onCancel();
        return;
      }

      // 方向键序列 (ESC [ A/B/C/D)
      if (code === 27 && data[1] === 91) {
        const arrow = data[2];

        if (arrow === 65) {
          setCursor(prev => {
            const historyText = commandHistory.up(prev.text);
            if (historyText !== null) {
              return new Cursor(historyText, historyText.length);
            }
            return prev.up();
          });
          return;
        }

        if (arrow === 66) {
          setCursor(prev => {
            const historyText = commandHistory.down();
            if (historyText !== null) {
              return new Cursor(historyText, historyText.length);
            }
            return prev.down();
          });
          return;
        }

        if (arrow === 67) {
          setCursor(prev => prev.right());
          return;
        }

        if (arrow === 68) {
          setCursor(prev => prev.left());
          return;
        }

        if (data[2] === 51 && data[3] === 126) {
          setCursor(prev => prev.delete());
          return;
        }

        return;
      }

      // Shift+Enter
      if (code === 27 && data.length > 4) {
        const keyStr = data.toString();
        if (keyStr.includes('[13;2u') || keyStr.includes('[27;2;13~')) {
          setCursor(prev => prev.insert('\n'));
          return;
        }
      }

      // Ctrl+G
      if (code === 7) return;

      // Enter
      if (code === 13 || code === 10) {
        const text = cursorRef.current.text.trim();
        if (text) {
          commandHistory.add(text);
        }
        setCursor(new Cursor(''));
        onSubmit(text);
        return;
      }

      // Ctrl+C
      if (code === 3) {
        setCursor(new Cursor(''));
        onCancel();
        return;
      }

      // Ctrl+D
      if (code === 4 && cursorRef.current.text === '') {
        onExit();
        exit();
        return;
      }

      // Backspace
      if (code === 127 || code === 8) {
        setCursor(prev => prev.backspace());
        return;
      }

      // Ctrl+A
      if (code === 1) {
        setCursor(prev => prev.startOfLine());
        return;
      }

      // Ctrl+E
      if (code === 5) {
        setCursor(prev => prev.endOfLine());
        return;
      }

      // Ctrl+U
      if (code === 21) {
        setCursor(prev => prev.deleteToLineStart());
        return;
      }

      // Ctrl+K
      if (code === 11) {
        setCursor(prev => prev.deleteToLineEnd());
        return;
      }

      // Ctrl+W
      if (code === 23) {
        setCursor(prev => prev.deleteWordBefore());
        return;
      }

      // Tab
      if (code === 9 && commandNames.length > 0) {
        setCursor(prev => {
          if (prev.text.startsWith('/')) {
            const partial = prev.text.slice(1).toLowerCase();
            const matches = commandNames.filter(name => name.startsWith(partial));
            if (matches.length === 1) {
              const completed = '/' + matches[0];
              return new Cursor(completed, completed.length);
            } else if (matches.length > 1) {
              let common = matches[0];
              for (const match of matches) {
                while (!match.startsWith(common)) {
                  common = common.slice(0, -1);
                }
              }
              if (common.length > partial.length) {
                const completed = '/' + common;
                return new Cursor(completed, completed.length);
              }
            }
          }
          return prev;
        });
        return;
      }

      // 普通字符
      if (code !== undefined && code >= 32) {
        setCursor(prev => prev.insert(char));
      }
    }

    stdin?.on('data', onData);
    return () => {
      stdin?.off('data', onData);
    };
  }, [stdin, commandNames, onSubmit, onCancel, onExit, exit, keybindingRegistry]);

  // 渲染输入文本（光标用反色字符表示）
  const lines = cursor.getLines();
  const pos = cursor.getPosition();
  const colors = getInkColors();

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{'─'.repeat((process.stdout.columns || 80) - 1)}</Text>
      {lines.map((line, lineIdx) => (
        <Box key={lineIdx}>
          <Box flexShrink={0} width={2}>
            {lineIdx === 0 ? (
              <Text color={colors.cursor} bold>{prefix}</Text>
            ) : (
              <Text></Text>
            )}
          </Box>
          {lineIdx === pos.line ? (
            <Text>
              {line.slice(0, pos.column)}
              {line[pos.column] !== undefined
                ? <Text inverse>{line[pos.column]}</Text>
                : <Text color={colors.cursor}>█</Text>}
              {line.slice(pos.column + 1)}
            </Text>
          ) : (
            <Text>{line}</Text>
          )}
        </Box>
      ))}
      <Text dimColor>{'─'.repeat((process.stdout.columns || 80) - 1)}</Text>
      <Box justifyContent="space-between" width={(process.stdout.columns || 80) - 1}>
        <Text dimColor>{UI_SYMBOLS.statusBar} esc to interrupt · ↑↓ history · /help</Text>
        {tokenInfo && <Text dimColor>{tokenInfo}</Text>}
      </Box>
    </Box>
  );
}

/**
 * 获取命令历史
 */
export function getInputHistory(): string[] {
  return commandHistory.getAll();
}
