/**
 * Bracketed paste (OSC 200 / 201) 流解析，与主输入 TextInput 行为一致。
 * 终端在开启 \x1b[?2004h 后，粘贴会以 \x1b[200~ … \x1b[201~ 包裹。
 */

export const BRACKETED_PASTE_ENABLE = '\x1b[?2004h';
export const BRACKETED_PASTE_DISABLE = '\x1b[?2004l';
export const BRACKETED_PASTE_START = '\x1b[200~';
export const BRACKETED_PASTE_END = '\x1b[201~';
export const BRACKETED_PASTE_START_NO_ESC = '[200~';
export const BRACKETED_PASTE_END_NO_ESC = '[201~';

let bracketedPasteRefCount = 0;

export function setBracketedPasteEnabled(enabled: boolean): void {
  if (!process.stdout?.isTTY) return;
  process.stdout.write(enabled ? BRACKETED_PASTE_ENABLE : BRACKETED_PASTE_DISABLE);
}

export function acquireBracketedPasteMode(): void {
  if (bracketedPasteRefCount === 0) {
    setBracketedPasteEnabled(true);
  }
  bracketedPasteRefCount++;
}

export function releaseBracketedPasteMode(): void {
  bracketedPasteRefCount = Math.max(0, bracketedPasteRefCount - 1);
  if (bracketedPasteRefCount === 0) {
    setBracketedPasteEnabled(false);
  }
}

export type BracketedPasteStreamState = {
  mode: 'normal' | 'in_paste';
  incomplete: string;
  buffer: string;
};

function longestSuffixPrefix(haystack: string, needle: string): number {
  const max = Math.min(haystack.length, needle.length - 1);
  for (let len = max; len > 0; len--) {
    if (haystack.endsWith(needle.slice(0, len))) return len;
  }
  return 0;
}

function findFirstMarker(
  haystack: string,
  markers: string[]
): { index: number; marker: string } | null {
  let best: { index: number; marker: string } | null = null;
  for (const marker of markers) {
    const index = haystack.indexOf(marker);
    if (index === -1) continue;
    if (!best || index < best.index) {
      best = { index, marker };
    }
  }
  return best;
}

function getSuffixKeepLength(haystack: string, markers: string[]): number {
  let keep = 0;
  for (const marker of markers) {
    keep = Math.max(keep, longestSuffixPrefix(haystack, marker));
  }
  return keep;
}

/**
 * @returns true 表示 input 已由本解析器消费（含分包拼接），调用方勿再处理本次 input。
 *         false 表示应按普通按键处理**原始** input（与 TextInput 一致）。
 */
export function consumeBracketedPasteStream(
  input: string,
  state: BracketedPasteStreamState,
  sink: {
    onPlainText: (text: string) => void;
    onPasteComplete: (text: string) => void;
  }
): boolean {
  let handledAny = false;
  let data = state.incomplete + input;
  state.incomplete = '';

  const startMarkers = [BRACKETED_PASTE_START, BRACKETED_PASTE_START_NO_ESC];
  const endMarkers = [BRACKETED_PASTE_END, BRACKETED_PASTE_END_NO_ESC];

  while (data) {
    if (state.mode === 'normal') {
      const start = findFirstMarker(data, startMarkers);
      if (!start) {
        const keep = getSuffixKeepLength(data, startMarkers);
        if (keep === 0) {
          if (!handledAny) {
            return false;
          }
          sink.onPlainText(data);
          return true;
        }

        const toInsert = data.slice(0, -keep);
        if (toInsert) {
          sink.onPlainText(toInsert);
        }
        state.incomplete = data.slice(-keep);
        handledAny = true;
        return true;
      }

      const before = data.slice(0, start.index);
      if (before) {
        sink.onPlainText(before);
      }

      data = data.slice(start.index + start.marker.length);
      state.mode = 'in_paste';
      handledAny = true;
      continue;
    }

    const end = findFirstMarker(data, endMarkers);
    if (!end) {
      const keep = getSuffixKeepLength(data, endMarkers);
      const content = keep > 0 ? data.slice(0, -keep) : data;
      if (content) {
        state.buffer += content;
      }
      if (keep > 0) {
        state.incomplete = data.slice(-keep);
      }
      handledAny = true;
      return true;
    }

    state.buffer += data.slice(0, end.index);
    const completedPaste = state.buffer;
    state.buffer = '';
    state.mode = 'normal';

    sink.onPasteComplete(completedPaste);

    data = data.slice(end.index + end.marker.length);
    handledAny = true;
    continue;
  }

  return true;
}
