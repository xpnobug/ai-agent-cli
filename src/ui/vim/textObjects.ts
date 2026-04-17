/**
 * Vim Text Object 查找
 *
 * 用于识别 iw/aw/i"/a( 等文本对象的起止位置。
 *
 * 原 Claude Code 版本依赖 utils/Cursor 里的字符判定辅助函数与
 * utils/intl 里的 grapheme segmenter；本项目里无同名工具，
 * 这里就地内联一份最小实现。
 */

export type TextObjectRange = { start: number; end: number } | null;

// ─── 字符判定（最小实现）──────────────────────────────────────────────
// Vim 把字符分为 word/punctuation/whitespace 三类，
// word 类在不同 iskeyword 配置下可扩展；这里按 Vim 默认规则：
//   word = [A-Za-z0-9_] 以及各类 Unicode 字母/数字
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;
const WHITESPACE_RE = /\s/;

function isVimWordChar(ch: string): boolean {
  if (!ch) return false;
  return WORD_CHAR_RE.test(ch);
}

function isVimWhitespace(ch: string): boolean {
  if (!ch) return false;
  return WHITESPACE_RE.test(ch);
}

function isVimPunctuation(ch: string): boolean {
  if (!ch) return false;
  return !isVimWordChar(ch) && !isVimWhitespace(ch);
}

// ─── Grapheme segmenter（使用浏览器/Node 原生 Intl.Segmenter）─────────
interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string; index: number }>;
}

let segmenter: GraphemeSegmenter | null = null;

function getGraphemeSegmenter(): GraphemeSegmenter {
  if (!segmenter) {
    // Node 16+ / 浏览器均有 Intl.Segmenter；
    // 此处 cast 防止 TS 低版本 lib 报错。
    segmenter = new (Intl as unknown as {
      Segmenter: new (
        locale?: string,
        opts?: { granularity: 'grapheme' },
      ) => GraphemeSegmenter;
    }).Segmenter(undefined, { granularity: 'grapheme' });
  }
  return segmenter;
}

// ─── 配对分隔符表 ──────────────────────────────────────────────────────
const PAIRS: Record<string, [string, string]> = {
  '(': ['(', ')'],
  ')': ['(', ')'],
  b: ['(', ')'],
  '[': ['[', ']'],
  ']': ['[', ']'],
  '{': ['{', '}'],
  '}': ['{', '}'],
  B: ['{', '}'],
  '<': ['<', '>'],
  '>': ['<', '>'],
  '"': ['"', '"'],
  "'": ["'", "'"],
  '`': ['`', '`'],
};

/** 在 offset 处查找一个 text object 的范围 */
export function findTextObject(
  text: string,
  offset: number,
  objectType: string,
  isInner: boolean,
): TextObjectRange {
  if (objectType === 'w') {
    return findWordObject(text, offset, isInner, isVimWordChar);
  }
  if (objectType === 'W') {
    // WORD = 任何非空白字符（跨标点）
    return findWordObject(text, offset, isInner, (ch) => !isVimWhitespace(ch));
  }

  const pair = PAIRS[objectType];
  if (pair) {
    const [open, close] = pair;
    return open === close
      ? findQuoteObject(text, offset, open, isInner)
      : findBracketObject(text, offset, open, close, isInner);
  }

  return null;
}

function findWordObject(
  text: string,
  offset: number,
  isInner: boolean,
  isWordChar: (ch: string) => boolean,
): TextObjectRange {
  // 先切成 grapheme 片段，保证 Unicode 情况下的游标移动正确
  const graphemes: Array<{ segment: string; index: number }> = [];
  for (const { segment, index } of getGraphemeSegmenter().segment(text)) {
    graphemes.push({ segment, index });
  }

  // 找到 offset 落在哪个 grapheme 上
  let graphemeIdx = graphemes.length - 1;
  for (let i = 0; i < graphemes.length; i++) {
    const g = graphemes[i]!;
    const nextStart =
      i + 1 < graphemes.length ? graphemes[i + 1]!.index : text.length;
    if (offset >= g.index && offset < nextStart) {
      graphemeIdx = i;
      break;
    }
  }

  const graphemeAt = (idx: number): string => graphemes[idx]?.segment ?? '';
  const offsetAt = (idx: number): number =>
    idx < graphemes.length ? graphemes[idx]!.index : text.length;
  const isWs = (idx: number): boolean => isVimWhitespace(graphemeAt(idx));
  const isWord = (idx: number): boolean => isWordChar(graphemeAt(idx));
  const isPunct = (idx: number): boolean => isVimPunctuation(graphemeAt(idx));

  let startIdx = graphemeIdx;
  let endIdx = graphemeIdx;

  if (isWord(graphemeIdx)) {
    while (startIdx > 0 && isWord(startIdx - 1)) startIdx--;
    while (endIdx < graphemes.length && isWord(endIdx)) endIdx++;
  } else if (isWs(graphemeIdx)) {
    while (startIdx > 0 && isWs(startIdx - 1)) startIdx--;
    while (endIdx < graphemes.length && isWs(endIdx)) endIdx++;
    return { start: offsetAt(startIdx), end: offsetAt(endIdx) };
  } else if (isPunct(graphemeIdx)) {
    while (startIdx > 0 && isPunct(startIdx - 1)) startIdx--;
    while (endIdx < graphemes.length && isPunct(endIdx)) endIdx++;
  }

  if (!isInner) {
    // around：把紧挨着的空白也吞进去
    if (endIdx < graphemes.length && isWs(endIdx)) {
      while (endIdx < graphemes.length && isWs(endIdx)) endIdx++;
    } else if (startIdx > 0 && isWs(startIdx - 1)) {
      while (startIdx > 0 && isWs(startIdx - 1)) startIdx--;
    }
  }

  return { start: offsetAt(startIdx), end: offsetAt(endIdx) };
}

function findQuoteObject(
  text: string,
  offset: number,
  quote: string,
  isInner: boolean,
): TextObjectRange {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = text.indexOf('\n', offset);
  const effectiveEnd = lineEnd === -1 ? text.length : lineEnd;
  const line = text.slice(lineStart, effectiveEnd);
  const posInLine = offset - lineStart;

  const positions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === quote) positions.push(i);
  }

  // 两两配对：0-1、2-3、4-5 ...
  for (let i = 0; i < positions.length - 1; i += 2) {
    const qs = positions[i]!;
    const qe = positions[i + 1]!;
    if (qs <= posInLine && posInLine <= qe) {
      return isInner
        ? { start: lineStart + qs + 1, end: lineStart + qe }
        : { start: lineStart + qs, end: lineStart + qe + 1 };
    }
  }

  return null;
}

function findBracketObject(
  text: string,
  offset: number,
  open: string,
  close: string,
  isInner: boolean,
): TextObjectRange {
  let depth = 0;
  let start = -1;

  for (let i = offset; i >= 0; i--) {
    if (text[i] === close && i !== offset) depth++;
    else if (text[i] === open) {
      if (depth === 0) {
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start === -1) return null;

  depth = 0;
  let end = -1;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      if (depth === 0) {
        end = i;
        break;
      }
      depth--;
    }
  }
  if (end === -1) return null;

  return isInner ? { start: start + 1, end } : { start, end: end + 1 };
}
