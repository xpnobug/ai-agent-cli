/**
 * 任务输出存储
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { getSessionProjectDir } from './sessionLog.js';

export function getTaskOutputsDir(cwd: string = process.cwd()): string {
  return join(getSessionProjectDir(cwd), 'tasks');
}

export function getTaskOutputFilePath(taskId: string, cwd: string = process.cwd()): string {
  return join(getTaskOutputsDir(cwd), `${taskId}.output`);
}

export function ensureTaskOutputsDirExists(cwd: string = process.cwd()): void {
  const dir = getTaskOutputsDir(cwd);
  if (existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
}

export function touchTaskOutputFile(taskId: string, cwd: string = process.cwd()): string {
  ensureTaskOutputsDirExists(cwd);
  const filePath = getTaskOutputFilePath(taskId, cwd);
  if (!existsSync(filePath)) {
    const parent = dirname(filePath);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
    writeFileSync(filePath, '', 'utf8');
  }
  return filePath;
}

export function appendTaskOutput(taskId: string, chunk: string, cwd: string = process.cwd()): void {
  try {
    ensureTaskOutputsDirExists(cwd);
    appendFileSync(getTaskOutputFilePath(taskId, cwd), chunk, 'utf8');
  } catch {
  }
}

export function readTaskOutputDelta(
  taskId: string,
  offset: number,
  cwd: string = process.cwd()
): { content: string; newOffset: number } {
  try {
    const filePath = getTaskOutputFilePath(taskId, cwd);
    if (!existsSync(filePath)) return { content: '', newOffset: offset };
    const size = statSync(filePath).size;
    if (size <= offset) return { content: '', newOffset: offset };
    return {
      content: readFileSync(filePath, 'utf8').slice(offset),
      newOffset: size,
    };
  } catch {
    return { content: '', newOffset: offset };
  }
}

export function readTaskOutput(taskId: string, cwd: string = process.cwd()): string {
  try {
    const filePath = getTaskOutputFilePath(taskId, cwd);
    if (!existsSync(filePath)) return '';
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}
