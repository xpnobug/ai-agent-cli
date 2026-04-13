// @ts-nocheck
/**
 * utils/execFileNoThrow shim
 */

import { execFile } from 'node:child_process';

export interface ExecOptions {
  input?: string;
  useCwd?: boolean;
  timeout?: number;
}

export function execFileNoThrow(
  file: string,
  args: string[],
  options?: ExecOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number; code?: number }> {
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { timeout: options?.timeout },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? (error as any).code ?? 1 : 0,
          code: error ? (error as any).code ?? 1 : 0,
        });
      },
    );
    if (options?.input && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}
