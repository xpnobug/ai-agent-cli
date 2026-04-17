/**
 * Vim 模式状态机类型
 *
 * 这些类型就是文档本身：读这些类型就能知道系统是如何运作的。
 *
 * 状态图：
 * ```
 *                              VimState
 *   ┌──────────────────────────────┬──────────────────────────────────────┐
 *   │  INSERT                      │  NORMAL                              │
 *   │  （追踪 insertedText）       │  （CommandState 状态机）             │
 *   │                              │                                      │
 *   │                              │  idle ──┬─[d/c/y]──► operator        │
 *   │                              │         ├─[1-9]────► count           │
 *   │                              │         ├─[fFtT]───► find            │
 *   │                              │         ├─[g]──────► g               │
 *   │                              │         ├─[r]──────► replace         │
 *   │                              │         └─[><]─────► indent          │
 *   │                              │                                      │
 *   │                              │  operator ─┬─[motion]──► execute     │
 *   │                              │            ├─[0-9]────► operatorCount│
 *   │                              │            ├─[ia]─────► operatorTextObj
 *   │                              │            └─[fFtT]───► operatorFind │
 *   └──────────────────────────────┴──────────────────────────────────────┘
 * ```
 */

// ============================================================================
// 核心类型
// ============================================================================

export type Operator = 'delete' | 'change' | 'yank';

export type FindType = 'f' | 'F' | 't' | 'T';

export type TextObjScope = 'inner' | 'around';

// ============================================================================
// 状态机类型
// ============================================================================

/**
 * 完整的 Vim 状态。mode 决定追踪哪些数据。
 *
 * INSERT 模式：记录正在输入的文本（用于 dot-repeat）
 * NORMAL 模式：记录当前正在解析的命令（状态机）
 */
export type VimState =
  | { mode: 'INSERT'; insertedText: string }
  | { mode: 'NORMAL'; command: CommandState };

/**
 * NORMAL 模式下的命令状态机。
 * 每个状态都明确知道自己在等什么输入，
 * TypeScript 保证 switch 分支穷尽。
 */
export type CommandState =
  | { type: 'idle' }
  | { type: 'count'; digits: string }
  | { type: 'operator'; op: Operator; count: number }
  | { type: 'operatorCount'; op: Operator; count: number; digits: string }
  | { type: 'operatorFind'; op: Operator; count: number; find: FindType }
  | {
      type: 'operatorTextObj';
      op: Operator;
      count: number;
      scope: TextObjScope;
    }
  | { type: 'find'; find: FindType; count: number }
  | { type: 'g'; count: number }
  | { type: 'operatorG'; op: Operator; count: number }
  | { type: 'replace'; count: number }
  | { type: 'indent'; dir: '>' | '<'; count: number };

/**
 * 跨命令保留的持久状态 —— 即 Vim 的"记忆"，
 * 用于 dot-repeat 与 put（p/P）这类操作。
 */
export interface PersistentState {
  lastChange: RecordedChange | null;
  lastFind: { type: FindType; char: string } | null;
  register: string;
  registerIsLinewise: boolean;
}

/**
 * 已录制的变更，用于 dot-repeat。
 * 记录重放一个命令所需的全部信息。
 */
export type RecordedChange =
  | { type: 'insert'; text: string }
  | {
      type: 'operator';
      op: Operator;
      motion: string;
      count: number;
    }
  | {
      type: 'operatorTextObj';
      op: Operator;
      objType: string;
      scope: TextObjScope;
      count: number;
    }
  | {
      type: 'operatorFind';
      op: Operator;
      find: FindType;
      char: string;
      count: number;
    }
  | { type: 'replace'; char: string; count: number }
  | { type: 'x'; count: number }
  | { type: 'toggleCase'; count: number }
  | { type: 'indent'; dir: '>' | '<'; count: number }
  | { type: 'openLine'; direction: 'above' | 'below' }
  | { type: 'join'; count: number };

// ============================================================================
// 按键分组 —— 使用命名常量，避免魔法字符串
// ============================================================================

export const OPERATORS = {
  d: 'delete',
  c: 'change',
  y: 'yank',
} as const satisfies Record<string, Operator>;

export function isOperatorKey(key: string): key is keyof typeof OPERATORS {
  return key in OPERATORS;
}

/** 简单 motions（不需要额外参数的单键移动） */
export const SIMPLE_MOTIONS = new Set([
  'h',
  'l',
  'j',
  'k', // 基础移动
  'w',
  'b',
  'e',
  'W',
  'B',
  'E', // 词移动
  '0',
  '^',
  '$', // 行内定位
]);

export const FIND_KEYS = new Set(['f', 'F', 't', 'T']);

export const TEXT_OBJ_SCOPES = {
  i: 'inner',
  a: 'around',
} as const satisfies Record<string, TextObjScope>;

export function isTextObjScopeKey(
  key: string,
): key is keyof typeof TEXT_OBJ_SCOPES {
  return key in TEXT_OBJ_SCOPES;
}

/** 支持的 text object 键 */
export const TEXT_OBJ_TYPES = new Set([
  'w',
  'W', // 词 / WORD
  '"',
  "'",
  '`', // 引号
  '(',
  ')',
  'b', // 圆括号
  '[',
  ']', // 方括号
  '{',
  '}',
  'B', // 花括号
  '<',
  '>', // 尖括号
]);

/** Vim 命令中允许的 count 上限，避免 "1e9dd" 爆炸 */
export const MAX_VIM_COUNT = 10000;

// ============================================================================
// 状态初始化工厂
// ============================================================================

export function createInitialVimState(): VimState {
  return { mode: 'INSERT', insertedText: '' };
}

export function createInitialPersistentState(): PersistentState {
  return {
    lastChange: null,
    lastFind: null,
    register: '',
    registerIsLinewise: false,
  };
}
