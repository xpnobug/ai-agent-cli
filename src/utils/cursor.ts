/**
 * Cursor - 文本编辑光标类
 *
 * 提供不可变的文本编辑操作
 * 所有操作返回新的 Cursor 对象，保持原对象不变
 */

/**
 * 位置信息
 */
export interface Position {
    line: number;    // 行号 (0-indexed)
    column: number;  // 列号 (0-indexed)
}

/**
 * Cursor 类 - 管理文本和光标位置
 */
export class Cursor {
    readonly text: string;
    readonly offset: number;  // 光标在字符串中的位置 (0-indexed)

    constructor(text: string, offset: number = 0) {
        this.text = text;
        // 确保 offset 在有效范围内
        this.offset = Math.max(0, Math.min(text.length, offset));
    }

    /**
     * 获取光标所在的行和列
     */
    getPosition(): Position {
        const lines = this.text.split('\n');
        let charCount = 0;

        for (let line = 0; line < lines.length; line++) {
            const lineLength = lines[line].length;

            if (charCount + lineLength >= this.offset) {
                // 光标在当前行
                return {
                    line,
                    column: this.offset - charCount,
                };
            }

            // +1 for the '\n' character
            charCount += lineLength + 1;
        }

        // 如果到这里，光标在最后
        return {
            line: Math.max(0, lines.length - 1),
            column: lines[lines.length - 1]?.length || 0,
        };
    }

    /**
     * 从位置获取 offset
     */
    private getOffsetFromPosition(position: Position): number {
        const lines = this.text.split('\n');
        let offset = 0;

        for (let i = 0; i < position.line && i < lines.length; i++) {
            offset += lines[i].length + 1; // +1 for '\n'
        }

        const currentLine = lines[position.line] || '';
        offset += Math.min(position.column, currentLine.length);

        return Math.min(offset, this.text.length);
    }

    /**
     * 获取所有行
     */
    getLines(): string[] {
        return this.text.split('\n');
    }

    /**
     * 插入文本
     */
    insert(str: string): Cursor {
        const newText =
            this.text.slice(0, this.offset) +
            str +
            this.text.slice(this.offset);

        return new Cursor(newText, this.offset + str.length);
    }

    /**
     * 删除光标位置的字符 (Delete键)
     */
    delete(): Cursor {
        if (this.offset >= this.text.length) {
            return this;
        }

        const newText =
            this.text.slice(0, this.offset) +
            this.text.slice(this.offset + 1);

        return new Cursor(newText, this.offset);
    }

    /**
     * 删除光标前的字符 (Backspace键)
     */
    backspace(): Cursor {
        if (this.offset === 0) {
            return this;
        }

        const newText =
            this.text.slice(0, this.offset - 1) +
            this.text.slice(this.offset);

        return new Cursor(newText, this.offset - 1);
    }

    /**
     * 光标左移
     */
    left(): Cursor {
        return new Cursor(this.text, this.offset - 1);
    }

    /**
     * 光标右移
     */
    right(): Cursor {
        return new Cursor(this.text, this.offset + 1);
    }

    /**
     * 光标上移
     */
    up(): Cursor {
        const pos = this.getPosition();

        if (pos.line === 0) {
            // 已经在第一行，移到行首
            return new Cursor(this.text, 0);
        }

        const newPos: Position = {
            line: pos.line - 1,
            column: pos.column,
        };

        return new Cursor(this.text, this.getOffsetFromPosition(newPos));
    }

    /**
     * 光标下移
     */
    down(): Cursor {
        const pos = this.getPosition();
        const lines = this.getLines();

        if (pos.line >= lines.length - 1) {
            // 已经在最后一行，移到行尾
            return new Cursor(this.text, this.text.length);
        }

        const newPos: Position = {
            line: pos.line + 1,
            column: pos.column,
        };

        return new Cursor(this.text, this.getOffsetFromPosition(newPos));
    }

    /**
     * 移到行首
     */
    startOfLine(): Cursor {
        const pos = this.getPosition();
        const newPos: Position = { line: pos.line, column: 0 };
        return new Cursor(this.text, this.getOffsetFromPosition(newPos));
    }

    /**
     * 移到行尾
     */
    endOfLine(): Cursor {
        const pos = this.getPosition();
        const lines = this.getLines();
        const lineLength = lines[pos.line]?.length || 0;
        const newPos: Position = { line: pos.line, column: lineLength };
        return new Cursor(this.text, this.getOffsetFromPosition(newPos));
    }

    /**
     * 删除到行首
     */
    deleteToLineStart(): Cursor {
        const lineStart = this.startOfLine();
        const newText =
            this.text.slice(0, lineStart.offset) +
            this.text.slice(this.offset);

        return new Cursor(newText, lineStart.offset);
    }

    /**
     * 删除到行尾
     */
    deleteToLineEnd(): Cursor {
        const lineEnd = this.endOfLine();
        const newText =
            this.text.slice(0, this.offset) +
            this.text.slice(lineEnd.offset);

        return new Cursor(newText, this.offset);
    }

    /**
     * 移到下一个单词
     */
    nextWord(): Cursor {
        let pos = this.offset;

        // 跳过当前单词字符
        while (pos < this.text.length && this.isWordChar(this.text[pos])) {
            pos++;
        }

        // 跳过空白字符
        while (pos < this.text.length && !this.isWordChar(this.text[pos])) {
            pos++;
        }

        return new Cursor(this.text, pos);
    }

    /**
     * 移到上一个单词
     */
    prevWord(): Cursor {
        let pos = this.offset;

        // 如果前一个字符不是单词字符，先跳过
        if (pos > 0 && !this.isWordChar(this.text[pos - 1])) {
            pos--;
        }

        // 跳过空白字符
        while (pos > 0 && !this.isWordChar(this.text[pos - 1])) {
            pos--;
        }

        // 跳过单词字符到单词开头
        while (pos > 0 && this.isWordChar(this.text[pos - 1])) {
            pos--;
        }

        return new Cursor(this.text, pos);
    }

    /**
     * 删除前一个单词
     */
    deleteWordBefore(): Cursor {
        const wordStart = this.prevWord();
        const newText =
            this.text.slice(0, wordStart.offset) +
            this.text.slice(this.offset);

        return new Cursor(newText, wordStart.offset);
    }

    /**
     * 删除后一个单词
     */
    deleteWordAfter(): Cursor {
        const wordEnd = this.nextWord();
        const newText =
            this.text.slice(0, this.offset) +
            this.text.slice(wordEnd.offset);

        return new Cursor(newText, this.offset);
    }

    /**
     * 判断字符是否是单词字符
     */
    private isWordChar(char: string | undefined): boolean {
        if (!char) return false;
        return /\w/.test(char);
    }

    /**
     * 判断是否在开头
     */
    isAtStart(): boolean {
        return this.offset === 0;
    }

    /**
     * 判断是否在结尾
     */
    isAtEnd(): boolean {
        return this.offset === this.text.length;
    }

    /**
     * 比较两个 Cursor 是否相等
     */
    equals(other: Cursor): boolean {
        return this.text === other.text && this.offset === other.offset;
    }

    /**
     * 清空所有文本
     */
    clear(): Cursor {
        return new Cursor('', 0);
    }
}
