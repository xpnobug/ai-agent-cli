/**
 * 安全工具测试
 */

import { describe, it, expect } from 'vitest';
import { safePath, validateBashCommand, truncateOutput } from '../../src/utils/security.js';
import path from 'node:path';

describe('Security Utils', () => {
  describe('safePath', () => {
    const workdir = '/workspace';

    it('应该允许工作目录内的路径', () => {
      const result = safePath(workdir, 'file.txt');
      expect(result).toBe(path.join(workdir, 'file.txt'));
    });

    it('应该允许子目录中的文件', () => {
      const result = safePath(workdir, 'src/index.ts');
      expect(result).toBe(path.join(workdir, 'src/index.ts'));
    });

    it('应该阻止路径遍历攻击', () => {
      expect(() => safePath(workdir, '../etc/passwd')).toThrow('路径越界');
    });

    it('应该阻止绝对路径逃逸', () => {
      expect(() => safePath(workdir, '/etc/passwd')).toThrow('路径越界');
    });

    it('应该处理复杂的路径遍历尝试', () => {
      expect(() => safePath(workdir, 'foo/../../etc/passwd')).toThrow('路径越界');
    });
  });

  describe('validateBashCommand', () => {
    it('应该允许安全的命令', () => {
      expect(() => validateBashCommand('ls -la')).not.toThrow();
      expect(() => validateBashCommand('git status')).not.toThrow();
      expect(() => validateBashCommand('npm install')).not.toThrow();
    });

    it('应该阻止 rm -rf /', () => {
      expect(() => validateBashCommand('rm -rf /')).toThrow('危险命令');
    });

    it('应该阻止 sudo 命令', () => {
      expect(() => validateBashCommand('sudo reboot')).toThrow('危险命令');
    });

    it('应该阻止 shutdown 命令', () => {
      expect(() => validateBashCommand('shutdown now')).toThrow('危险命令');
    });

    it('应该阻止 fork bomb', () => {
      expect(() => validateBashCommand(':(){:|:&};:')).toThrow('危险命令');
    });

    it('应该阻止删除系统目录', () => {
      expect(() => validateBashCommand('rm -rf /etc')).toThrow('禁止删除系统目录');
    });

    it('应该对大小写不敏感', () => {
      expect(() => validateBashCommand('RM -RF /')).toThrow('危险命令');
      expect(() => validateBashCommand('SUDO apt-get')).toThrow('危险命令');
    });
  });

  describe('truncateOutput', () => {
    it('应该保留短输出不变', () => {
      const short = 'Hello, world!';
      expect(truncateOutput(short, 100)).toBe(short);
    });

    it('应该截断过长的输出', () => {
      const long = 'a'.repeat(200);
      const result = truncateOutput(long, 100);
      expect(result.length).toBeGreaterThan(100); // 包含截断消息
      expect(result).toContain('输出被截断');
    });

    it('应该显示行数信息', () => {
      const multiline = 'line1\nline2\nline3\n' + 'x'.repeat(200);
      const result = truncateOutput(multiline, 50);
      expect(result).toContain('行');
    });
  });
});
