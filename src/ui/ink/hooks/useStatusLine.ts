/**
 * useStatusLine - 状态栏命令输出
 */

import { useEffect, useRef, useState } from 'react';
import { execa } from 'execa';
import { getStatusLineCommand } from '../../../services/ui/statusline.js';

const MAX_STATUSLINE_LENGTH = 300;
const STATUSLINE_TIMEOUT_MS = 1000;
const STATUSLINE_INTERVAL_MS = 2000;

function normalizeStatusLineText(value: string): string {
  const singleLine = value.replace(/\r?\n/g, ' ').trim();
  if (singleLine.length > MAX_STATUSLINE_LENGTH) {
    return `${singleLine.slice(0, MAX_STATUSLINE_LENGTH)}…`;
  }
  return singleLine;
}

export function useStatusLine(): string | null {
  const [text, setText] = useState<string | null>(null);
  const lastCommandRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const enabled =
      process.env.KODE_STATUSLINE_ENABLED === '1' ||
      process.env.NODE_ENV !== 'test';
    if (!enabled) return;

    let alive = true;

    const tick = async () => {
      const command = getStatusLineCommand();
      if (!command) {
        lastCommandRef.current = null;
        abortRef.current?.abort();
        abortRef.current = null;
        if (alive) setText(null);
        return;
      }

      lastCommandRef.current = command;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const result = await execa('bash', ['-c', command], {
          cwd: process.cwd(),
          timeout: STATUSLINE_TIMEOUT_MS,
          reject: false,
          signal: ac.signal,
        });

        if (!alive || ac.signal.aborted) return;

        const raw =
          result.exitCode === 0 ? result.stdout : result.stdout || result.stderr;
        const next = raw ? normalizeStatusLineText(raw) : '';
        setText(next || null);
      } catch (error: unknown) {
        if (!alive) return;
        if (ac.signal.aborted) return;
        setText(null);
      }
    };

    tick().catch(() => {});
    const id = setInterval(() => {
      tick().catch(() => {});
    }, STATUSLINE_INTERVAL_MS);

    return () => {
      alive = false;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, []);

  return text;
}
