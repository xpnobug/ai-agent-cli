import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  expandPath,
  toRelativePath,
  getDirectoryForPath,
  containsPathTraversal,
  normalizePathForConfigKey,
} from '../../src/utils/pathUtils.js';

let tmpHome = '';
const originalHomedir = os.homedir;

function stubHome(): void {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aac-path-'));
  (os as unknown as { homedir: () => string }).homedir = () => tmpHome;
}
function restoreHome(): void {
  (os as unknown as { homedir: () => string }).homedir = originalHomedir;
  if (tmpHome && fs.existsSync(tmpHome)) fs.rmSync(tmpHome, { recursive: true, force: true });
  tmpHome = '';
}

describe('expandPath', () => {
  beforeEach(stubHome);
  afterEach(restoreHome);

  it('~ → $HOME', () => {
    expect(expandPath('~')).toBe(tmpHome.normalize('NFC'));
  });
  it('~/x → $HOME/x', () => {
    expect(expandPath('~/docs')).toBe(path.join(tmpHome, 'docs'));
  });
  it('绝对路径保持不变但 normalize', () => {
    expect(expandPath('/a/b/../c')).toBe(path.normalize('/a/c'));
  });
  it('相对路径按 baseDir 解析', () => {
    expect(expandPath('./src', '/proj')).toBe(path.resolve('/proj', 'src'));
  });
  it('空字符串 → 规范化后的 baseDir', () => {
    expect(expandPath('  ', '/proj')).toBe(path.normalize('/proj'));
  });
  it('null 字节被拒绝', () => {
    expect(() => expandPath('/tmp\0hack')).toThrow(/null/);
  });
  it('非字符串入参抛 TypeError', () => {
    expect(() => expandPath(123 as never)).toThrow(TypeError);
  });
});

describe('toRelativePath', () => {
  it('cwd 内部 → 相对路径', () => {
    expect(toRelativePath(path.join('/proj', 'src', 'x.ts'), '/proj')).toBe(
      path.join('src', 'x.ts'),
    );
  });
  it('cwd 外部 → 保持绝对路径', () => {
    expect(toRelativePath('/other/x', '/proj')).toBe('/other/x');
  });
});

describe('getDirectoryForPath', () => {
  let tmp = '';
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aac-dir-'));
  });
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = '';
  });

  it('目录 → 原路径', () => {
    expect(getDirectoryForPath(tmp)).toBe(tmp.normalize('NFC'));
  });
  it('文件 → 父目录', () => {
    const fp = path.join(tmp, 'f.txt');
    fs.writeFileSync(fp, 'x');
    expect(getDirectoryForPath(fp)).toBe(tmp.normalize('NFC'));
  });
  it('不存在 → 父目录', () => {
    const fp = path.join(tmp, 'nope.txt');
    expect(getDirectoryForPath(fp)).toBe(tmp.normalize('NFC'));
  });
});

describe('containsPathTraversal', () => {
  it('识别 .. 段', () => {
    expect(containsPathTraversal('../foo')).toBe(true);
    expect(containsPathTraversal('a/../b')).toBe(true);
    expect(containsPathTraversal('a/..')).toBe(true);
    expect(containsPathTraversal('a\\..\\b')).toBe(true);
  });
  it('不误伤文件名里的 ..', () => {
    expect(containsPathTraversal('a..b')).toBe(false);
    expect(containsPathTraversal('foo.bar')).toBe(false);
  });
});

describe('normalizePathForConfigKey', () => {
  it('反斜杠 → 正斜杠', () => {
    expect(normalizePathForConfigKey('C:\\a\\b')).toBe('C:/a/b');
  });
  it('处理 . 与 ..', () => {
    expect(normalizePathForConfigKey('a/./b/../c')).toBe('a/c');
  });
});
