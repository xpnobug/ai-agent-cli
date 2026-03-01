/**
 * 文件读取时间戳管理
 *
 * 用于保障写入/编辑前必须先读取，并检测外部修改。
 */

const readFileTimestamps = new Map<string, number>();

export function recordFileRead(filePath: string, mtimeMs: number): void {
  readFileTimestamps.set(filePath, mtimeMs);
}

export function getFileReadTimestamp(filePath: string): number | null {
  return readFileTimestamps.get(filePath) ?? null;
}
