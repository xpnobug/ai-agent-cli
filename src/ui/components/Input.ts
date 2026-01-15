/**
 * 自定义输入组件
 * 支持历史记录、ESC 取消、快捷命令
 */

import * as readline from 'node:readline';
import { getTheme } from '../theme.js';

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
  placeholder?: string;
  showHints?: boolean;
}

/**
 * 输入结果
 */
export interface InputResult {
  value: string;
  cancelled: boolean;
  command?: string; // 快捷命令如 /help
}

/**
 * 自定义输入管理器
 */
export class Input {
  private history: CommandHistory;
  private abortController: AbortController | null = null;

  constructor() {
    this.history = new CommandHistory();
  }

  /**
   * 获取用户输入
   */
  async prompt(config: InputConfig = {}): Promise<string> {
    const result = await this.promptWithResult(config);
    return result.cancelled ? '' : result.value;
  }

  /**
   * 获取用户输入（带详细结果）
   */
  promptWithResult(config: InputConfig = {}): Promise<InputResult> {
    const theme = getTheme();
    const { prefix = '>>>', showHints = true } = config;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      let currentInput = '';
      let cursorPos = 0;
      const hintText = theme.textDim('ESC cancel · ↑↓ history · /help commands');

      // 清除当前行并重绘
      const redraw = () => {
        // 移到输入行
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
        process.stdout.write(theme.primary(prefix + ' ') + currentInput);
        
        // 显示底部提示
        if (showHints) {
          process.stdout.write('\n');
          readline.clearLine(process.stdout, 0);
          process.stdout.write(hintText);
          // 移回输入行
          readline.moveCursor(process.stdout, 0, -1);
        }
        
        readline.cursorTo(process.stdout, prefix.length + 1 + cursorPos);
      };

      // 清理底部提示
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

      // 设置原始模式以捕获特殊按键
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
          console.log(); // 换行
          resolve({ value: '', cancelled: true });
          return;
        }

        // 方向键序列 (ESC [ A/B/C/D)
        if (code === 27 && key[1] === 91) {
          const arrow = key[2];
          
          // 上箭头
          if (arrow === 65) {
            const prev = this.history.up(currentInput);
            if (prev !== null) {
              currentInput = prev;
              cursorPos = currentInput.length;
              redraw();
            }
            return;
          }
          
          // 下箭头
          if (arrow === 66) {
            const next = this.history.down();
            if (next !== null) {
              currentInput = next;
              cursorPos = currentInput.length;
              redraw();
            }
            return;
          }

          // 右箭头
          if (arrow === 67) {
            if (cursorPos < currentInput.length) {
              cursorPos++;
              redraw();
            }
            return;
          }

          // 左箭头
          if (arrow === 68) {
            if (cursorPos > 0) {
              cursorPos--;
              redraw();
            }
            return;
          }
          return;
        }

        // Enter - 提交
        if (code === 13 || code === 10) {
          cleanup();
          console.log(); // 换行
          
          const value = currentInput.trim();
          
          // 添加到历史
          if (value) {
            this.history.add(value);
          }

          // 检查是否是快捷命令
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
        if (code === 4 && currentInput === '') {
          cleanup();
          console.log();
          resolve({ value: 'exit', cancelled: false });
          return;
        }

        // Backspace
        if (code === 127 || code === 8) {
          if (cursorPos > 0) {
            currentInput = 
              currentInput.slice(0, cursorPos - 1) + 
              currentInput.slice(cursorPos);
            cursorPos--;
            redraw();
          }
          return;
        }

        // Delete (ESC [ 3 ~)
        if (code === 27 && key[1] === 91 && key[2] === 51 && key[3] === 126) {
          if (cursorPos < currentInput.length) {
            currentInput = 
              currentInput.slice(0, cursorPos) + 
              currentInput.slice(cursorPos + 1);
            redraw();
          }
          return;
        }

        // Ctrl+A - 移到行首
        if (code === 1) {
          cursorPos = 0;
          redraw();
          return;
        }

        // Ctrl+E - 移到行尾
        if (code === 5) {
          cursorPos = currentInput.length;
          redraw();
          return;
        }

        // Ctrl+U - 清除到行首
        if (code === 21) {
          currentInput = currentInput.slice(cursorPos);
          cursorPos = 0;
          redraw();
          return;
        }

        // Ctrl+K - 清除到行尾
        if (code === 11) {
          currentInput = currentInput.slice(0, cursorPos);
          redraw();
          return;
        }

        // Ctrl+W - 删除前一个单词
        if (code === 23) {
          const before = currentInput.slice(0, cursorPos);
          const after = currentInput.slice(cursorPos);
          const newBefore = before.replace(/\S+\s*$/, '');
          currentInput = newBefore + after;
          cursorPos = newBefore.length;
          redraw();
          return;
        }

        // 普通字符（包括多字节字符如中文）
        if (code >= 32) {
          currentInput =
            currentInput.slice(0, cursorPos) +
            char +
            currentInput.slice(cursorPos);
          cursorPos += char.length;
          redraw();
        }
      };

      process.stdin.on('data', onKeypress);
    });
  }

  /**
   * 取消当前输入
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 获取历史记录
   */
  getHistory(): string[] {
    return this.history.getAll();
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.history.clear();
  }
}

// 单例
let inputInstance: Input | null = null;

export function getInput(): Input {
  if (!inputInstance) {
    inputInstance = new Input();
  }
  return inputInstance;
}

export function resetInput(): void {
  inputInstance = null;
}
