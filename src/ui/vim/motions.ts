/**
 * Vim Motion 函数
 *
 * 本项目 cursor.ts 与完整 Vim Cursor 接口不一致，
 * 所以这里把 motions 需要的 cursor 方法抽成 VimCursor 接口，
 * 由具体 Cursor 实现通过适配器注入。
 */

/**
 * Motion 所需的 Cursor 能力集。
 * 任何实现此接口的对象都可以作为 motions 的输入。
 */
export interface VimCursor {
  left(): VimCursor;
  right(): VimCursor;
  up(): VimCursor;
  down(): VimCursor;
  upLogicalLine(): VimCursor;
  downLogicalLine(): VimCursor;
  nextVimWord(): VimCursor;
  prevVimWord(): VimCursor;
  endOfVimWord(): VimCursor;
  nextWORD(): VimCursor;
  prevWORD(): VimCursor;
  endOfWORD(): VimCursor;
  startOfLogicalLine(): VimCursor;
  firstNonBlankInLogicalLine(): VimCursor;
  endOfLogicalLine(): VimCursor;
  startOfLastLine(): VimCursor;
  equals(other: VimCursor): boolean;
}

/**
 * 把一个 motion 解析为目标 cursor 位置。
 * 纯函数：不修改任何东西，仅做计算。
 */
export function resolveMotion<C extends VimCursor>(
  key: string,
  cursor: C,
  count: number,
): C {
  let result = cursor;
  for (let i = 0; i < count; i++) {
    const next = applySingleMotion(key, result) as C;
    if (next.equals(result)) break;
    result = next;
  }
  return result;
}

/**
 * 应用一次 motion 步进。
 */
function applySingleMotion(key: string, cursor: VimCursor): VimCursor {
  switch (key) {
    case 'h':
      return cursor.left();
    case 'l':
      return cursor.right();
    case 'j':
      return cursor.downLogicalLine();
    case 'k':
      return cursor.upLogicalLine();
    case 'gj':
      return cursor.down();
    case 'gk':
      return cursor.up();
    case 'w':
      return cursor.nextVimWord();
    case 'b':
      return cursor.prevVimWord();
    case 'e':
      return cursor.endOfVimWord();
    case 'W':
      return cursor.nextWORD();
    case 'B':
      return cursor.prevWORD();
    case 'E':
      return cursor.endOfWORD();
    case '0':
      return cursor.startOfLogicalLine();
    case '^':
      return cursor.firstNonBlankInLogicalLine();
    case '$':
      return cursor.endOfLogicalLine();
    case 'G':
      return cursor.startOfLastLine();
    default:
      return cursor;
  }
}

/**
 * 判断 motion 是否为 inclusive（包含目标字符）。
 * e / E / $ 结尾类 motion 在与 operator 组合时包含终点字符。
 */
export function isInclusiveMotion(key: string): boolean {
  return 'eE$'.includes(key);
}

/**
 * 判断 motion 是否为 linewise（与 operator 组合时按整行操作）。
 * 注：gj/gk 按 `:help gj` 属于 characterwise exclusive，不是 linewise。
 */
export function isLinewiseMotion(key: string): boolean {
  return 'jkG'.includes(key) || key === 'gg';
}
