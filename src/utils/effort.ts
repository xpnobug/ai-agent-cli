/**
 * Effort（努力程度）值的纯工具
 *
 * 从上游 effort.ts 抽出与订阅等级 / 模型能力表无关的部分：
 *   - EFFORT_LEVELS 常量
 *   - isEffortLevel 类型守卫
 *   - parseEffortValue 兼容字符串与数字
 *   - isValidNumericEffort 正整数校验
 *   - convertEffortValueToLevel 归一为字符串等级
 *
 * 不包含：subscription / 特定模型 / GrowthBook 相关逻辑，
 * 那些在多 Provider 场景下不适用。
 */

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** 运行时可用的 effort 值：已知等级或一个整数 */
export type EffortValue = EffortLevel | number;

/** 是否为已知等级字符串 */
export function isEffortLevel(value: string): value is EffortLevel {
  return (EFFORT_LEVELS as readonly string[]).includes(value);
}

/** 整数即合法（与上游保持一致的简化约束） */
export function isValidNumericEffort(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * 把任意值解析为 EffortValue：
 *   - undefined/null/空串 → undefined
 *   - 合法整数 → 数字原样
 *   - "low/medium/high/max"（大小写无关）→ 对应等级
 *   - "3" 这类可转整数字符串 → 数字
 *   - 其它 → undefined
 */
export function parseEffortValue(value: unknown): EffortValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && isValidNumericEffort(value)) {
    return value;
  }
  const str = String(value).toLowerCase();
  if (isEffortLevel(str)) {
    return str;
  }
  const numericValue = parseInt(str, 10);
  if (!Number.isNaN(numericValue) && isValidNumericEffort(numericValue)) {
    return numericValue;
  }
  return undefined;
}

/**
 * 把 EffortValue 归一为等级字符串：
 *   - 字符串非法时 fallback 到 'high'（给远端配置兜底）
 *   - 数字按分档：≤0 → low、1-2 → medium、≥3 → high
 */
export function convertEffortValueToLevel(value: EffortValue): EffortLevel {
  if (typeof value === 'string') {
    return isEffortLevel(value) ? value : 'high';
  }
  if (value <= 0) return 'low';
  if (value <= 2) return 'medium';
  return 'high';
}

/**
 * 只保留可以持久化到设置文件里的 effort。
 * 数字与 'max' 都是"会话范围"，不应落到 settings.json；
 * 仅 low/medium/high 允许持久化。
 */
export function toPersistableEffort(
  value: EffortValue | undefined,
): EffortLevel | undefined {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return undefined;
}
