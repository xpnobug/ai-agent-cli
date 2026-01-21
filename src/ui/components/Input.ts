/**
 * 自定义输入组件 (基于 Cursor 类重构)
 * 所有文本操作使用不可变的 Cursor 对象
 */

import * as readline from 'node:readline';
import stringWidth from 'string-width';
import { getTheme } from '../theme.js';
import { launchExternalEditor } from '../../utils/externalEditor.js';
import { Cursor } from '../../utils/cursor.js';

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

  clear(): void {
    this.history = [];
    this.reset();
  }
}

/**
 * 输入配置
 */
export interface InputConfig {
  prefix?: string;
  showHints?: boolean;
}

/**
 * 输入结果
 */
export interface InputResult {
  value: string;
  cancelled: boolean;
  command?: string;
}

/**
 * Input 类 - 使用 Cursor 架构
 */
export class Input {
  private history: CommandHistory;
  private abortController: AbortController | null = null;

  constructor() {
    this.history = new CommandHistory();
  }

  async prompt(config: InputConfig = {}): Promise<string> {
    const result = await this.promptWithResult(config);
    return result.cancelled ? '' : result.value;
  }

  promptWithResult(config: InputConfig = {}): Promise<InputResult> {
    const theme = getTheme();
    const { prefix = '>>>', showHints = true } = config;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // 使用 Cursor 对象管理状态
      let cursor = new Cursor('');
      const hintText = theme.textDim('ESC cancel · ↑↓ history · Shift+Enter newline · Ctrl+G editor · /help');

      // 渲染函数
      const redraw = () => {
        const lines = cursor.getLines();
        const pos = cursor.getPosition();
        const prefixLen = prefix.length + 1;

        // 清屏并重绘
        readline.cursorTo(process.stdout, 0);
        readline.clearScreenDown(process.stdout);

        // 渲染所有行
        for (let i = 0; i < lines.length; i++) {
          if (i === 0) {
            process.stdout.write(theme.primary(prefix + ' ') + lines[i]);
          } else {
            process.stdout.write('\n' + ' '.repeat(prefixLen) + lines[i]);
          }
        }

        // 显示提示
        if (showHints) {
          process.stdout.write('\n');
          process.stdout.write(hintText);
        }

        // 定位光标
        // 从当前位置(最后一行+提示行)移动到目标位置
        const currentRow = lines.length - 1 + (showHints ? 1 : 0);
        const targetRow = pos.line;
        const rowDiff = targetRow - currentRow;

        if (rowDiff !== 0) {
          readline.moveCursor(process.stdout, 0, rowDiff);
        }

        // 计算光标所在行的文本，从行首到光标位置
        const currentLine = lines[pos.line] || '';
        const textBeforeCursor = currentLine.slice(0, pos.column);

        // 计算显示宽度（中文字符占2列）
        const displayWidth = stringWidth(textBeforeCursor);

        // 定位到正确的显示列
        readline.cursorTo(process.stdout, prefixLen + displayWidth);
      };

      // 清理提示
      const clearHints = () => {
        if (showHints) {
          process.stdout.write('\n');
          readline.clearLine(process.stdout, 0);
          readline.moveCursor(process.stdout, 0, -1);
        }
      };

      // 初始显示
      process.stdout.write(theme.primary(prefix + ' '));
      if (showHints) {
        process.stdout.write('\n' + hintText);
        readline.moveCursor(process.stdout, 0, -1);
        readline.cursorTo(process.stdout, prefix.length + 1);
      }

      // 设置原始模式
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const cleanup = () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onKeypress);
        clearHints();
        rl.close();
      };

      const onKeypress = (key: Buffer) => {
        const char = key.toString();
        const code = key[0];

        // ESC - 取消
        if (code === 27 && key.length === 1) {
          cleanup();
          console.log();
          resolve({ value: '', cancelled: true });
          return;
        }

        // 方向键序列 (ESC [ A/B/C/D)
        if (code === 27 && key[1] === 91) {
          const arrow = key[2];

          // 上箭头 - 历史记录或上移
          if (arrow === 65) {
            const prev = this.history.up(cursor.text);
            if (prev !== null) {
              cursor = new Cursor(prev, prev.length);
              redraw();
            } else {
              cursor = cursor.up();
              redraw();
            }
            return;
          }

          // 下箭头 - 历史记录或下移
          if (arrow === 66) {
            const next = this.history.down();
            if (next !== null) {
              cursor = new Cursor(next, next.length);
              redraw();
            } else {
              cursor = cursor.down();
              redraw();
            }
            return;
          }

          // 右箭头
          if (arrow === 67) {
            cursor = cursor.right();
            redraw();
            return;
          }

          // 左箭头
          if (arrow === 68) {
            cursor = cursor.left();
            redraw();
            return;
          }

          // Delete键 (ESC [ 3 ~)
          if (key[2] === 51 && key[3] === 126) {
            cursor = cursor.delete();
            redraw();
            return;
          }

          return;
        }

        // Shift+Enter - 插入换行
        if (code === 27 && key.length > 4) {
          const keyStr = key.toString();
          if (keyStr.includes('[13;2u') || keyStr.includes('[27;2;13~')) {
            cursor = cursor.insert('\n');
            redraw();
            return;
          }
        }

        // Ctrl+G - 外部编辑器
        if (code === 7) {
          cleanup();
          console.log('\n正在打开外部编辑器...');

          launchExternalEditor(cursor.text).then((result) => {
            if (result.text !== null) {
              const theme = getTheme();
              console.log(theme.success(`✓ 已从 ${result.editorLabel || '编辑器'} 加载内容`));
              cursor = new Cursor(result.text, result.text.length);
            } else {
              const theme = getTheme();
              const errorMsg = result.error?.message || '编辑器不可用';
              console.log(theme.error(`✗ ${errorMsg}`));
              console.log(theme.textDim('提示: 设置 $EDITOR 环境变量或安装 code/nano/vim\n'));
            }

            this.promptWithResult(config).then((newResult) => {
              resolve(newResult);
            });
          }).catch((error) => {
            const theme = getTheme();
            console.log(theme.error(`✗ 编辑器启动失败: ${error.message}\n`));
            this.promptWithResult(config).then((newResult) => {
              resolve(newResult);
            });
          });

          return;
        }

        // Enter - 提交
        if (code === 13 || code === 10) {
          cleanup();
          console.log();

          const value = cursor.text.trim();

          if (value) {
            this.history.add(value);
          }

          if (value.startsWith('/')) {
            resolve({ value, cancelled: false, command: value.slice(1) });
          } else {
            resolve({ value, cancelled: false });
          }
          return;
        }

        // Ctrl+C - 退出
        if (code === 3) {
          cleanup();
          console.log('\n');
          process.exit(0);
        }

        // Ctrl+D - 退出（空输入时）
        if (code === 4 && cursor.text === '') {
          cleanup();
          console.log();
          resolve({ value: 'exit', cancelled: false });
          return;
        }

        // Backspace
        if (code === 127 || code === 8) {
          cursor = cursor.backspace();
          redraw();
          return;
        }

        // Ctrl+A - 移到行首
        if (code === 1) {
          cursor = cursor.startOfLine();
          redraw();
          return;
        }

        // Ctrl+E - 移到行尾
        if (code === 5) {
          cursor = cursor.endOfLine();
          redraw();
          return;
        }

        // Ctrl+U - 清除到行首
        if (code === 21) {
          cursor = cursor.deleteToLineStart();
          redraw();
          return;
        }

        // Ctrl+K - 清除到行尾
        if (code === 11) {
          cursor = cursor.deleteToLineEnd();
          redraw();
          return;
        }

        // Ctrl+W - 删除前一个单词
        if (code === 23) {
          cursor = cursor.deleteWordBefore();
          redraw();
          return;
        }

        // 普通字符
        if (code >= 32) {
          cursor = cursor.insert(char);
          redraw();
        }
      };

      process.stdin.on('data', onKeypress);
    });
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getHistory(): string[] {
    return this.history.getAll();
  }

  clearHistory(): void {
    this.history.clear();
  }
}
