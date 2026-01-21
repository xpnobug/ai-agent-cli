/**
 * 外部编辑器集成
 * 支持打开外部编辑器编辑长文本
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 编辑器结果
 */
export interface EditorResult {
    text: string | null;
    editorLabel?: string;
    error?: Error;
}

/**
 * 检测系统中可用的编辑器
 */
async function detectAvailableEditor(): Promise<string | null> {
    // 优先使用环境变量
    const editorFromEnv = process.env.EDITOR || process.env.VISUAL;
    if (editorFromEnv) {
        return editorFromEnv;
    }

    // 按优先级尝试常见编辑器
    const editors =
        process.platform === 'win32'
            ? ['code', 'notepad', 'vim', 'vi']
            : ['code', 'nano', 'vim', 'vi'];

    for (const editor of editors) {
        try {
            if (process.platform === 'win32') {
                // Windows: 使用 where 命令
                await execAsync(`where ${editor}`, { timeout: 1000 });
            } else {
                // Unix-like: 使用 which 命令
                await execAsync(`which ${editor}`, { timeout: 1000 });
            }
            return editor;
        } catch {
            // 编辑器不存在，继续下一个
            continue;
        }
    }

    return null;
}

/**
 * 获取编辑器的友好名称
 */
function getEditorLabel(editorPath: string): string {
    const basename = path.basename(editorPath).toLowerCase();

    const labels: Record<string, string> = {
        code: 'VS Code',
        'code-insiders': 'VS Code Insiders',
        vim: 'Vim',
        vi: 'Vi',
        nano: 'Nano',
        emacs: 'Emacs',
        notepad: 'Notepad',
        'notepad++': 'Notepad++',
    };

    return labels[basename] || basename;
}

/**
 * 启动外部编辑器
 * 
 * @param initialText - 初始文本内容
 * @returns 编辑后的文本和编辑器信息
 */
export async function launchExternalEditor(
    initialText: string = ''
): Promise<EditorResult> {
    let tmpFile: string | null = null;

    try {
        // 1. 检测可用编辑器
        const editor = await detectAvailableEditor();

        if (!editor) {
            return {
                text: null,
                error: new Error(
                    'No editor found. Please set $EDITOR environment variable or install code/nano/vim.'
                ),
            };
        }

        // 2. 创建临时文件
        tmpFile = path.join(
            os.tmpdir(),
            `ai-agent-${Date.now()}-${Math.random().toString(36).slice(2)}.md`
        );

        await fs.writeFile(tmpFile, initialText, 'utf-8');

        // 3. 构建编辑器命令
        let command: string;
        const editorName = path.basename(editor).toLowerCase();

        if (editorName === 'code' || editorName.startsWith('code-')) {
            // VS Code: 使用 --wait 等待关闭
            command = `"${editor}" --wait "${tmpFile}"`;
        } else if (editorName === 'vim' || editorName === 'vi' || editorName === 'nano') {
            // 终端编辑器: 直接打开
            command = `"${editor}" "${tmpFile}"`;
        } else {
            // 默认方式
            command = `"${editor}" "${tmpFile}"`;
        }

        // 4. 打开编辑器（同步等待关闭）
        execSync(command, {
            stdio: 'inherit',
            windowsHide: false,
        });

        // 5. 读取编辑后的内容
        const editedText = await fs.readFile(tmpFile, 'utf-8');

        // 6. 清理临时文件
        await fs.unlink(tmpFile);

        return {
            text: editedText,
            editorLabel: getEditorLabel(editor),
        };
    } catch (error) {
        // 清理临时文件
        if (tmpFile) {
            try {
                await fs.unlink(tmpFile);
            } catch {
                // 忽略清理错误
            }
        }

        return {
            text: null,
            error: error as Error,
        };
    }
}

/**
 * 检查编辑器是否可用
 */
export async function isEditorAvailable(): Promise<boolean> {
    const editor = await detectAvailableEditor();
    return editor !== null;
}

/**
 * 获取当前配置的编辑器名称
 */
export async function getConfiguredEditor(): Promise<string | null> {
    return await detectAvailableEditor();
}
