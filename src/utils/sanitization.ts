/**
 * Unicode 隐藏字符攻击防护
 *
 * 去除 ASCII Smuggling / Hidden Prompt Injection 常用的不可见 Unicode：
 *   - Tag 字符、格式控制字符、私用区字符等对用户不可见但模型会读到
 *
 * 参考：HackerOne 报告 #3086545，Claude Desktop MCP 中的同类漏洞。
 * 实现思路：
 *   1. NFKC 规范化处理组合字符序列
 *   2. 正则剥除危险 Unicode 类别（主策略 + 显式 code point 兜底）
 *   3. 可递归处理嵌套对象
 *
 * 输出如果和输入不同就再跑一遍，直到不再变化（有迭代次数上限防死循环）。
 */

const MAX_ITERATIONS = 10;

/**
 * 对单个字符串做 Unicode 净化。
 * 反复迭代直到结果稳定；超过 MAX_ITERATIONS 次还在变就抛错
 * （正常文本不会触发，除非恶意构造）。
 */
export function partiallySanitizeUnicode(input: string): string {
  let current = input;
  let previous = '';
  let iterations = 0;

  while (current !== previous && iterations < MAX_ITERATIONS) {
    previous = current;

    // 1) NFKC 规范化：把兼容分解形式合并，防止绕过
    current = current.normalize('NFKC');

    // 2) 主策略：剥除危险 Unicode 类别
    //   Cf 格式控制、Co 私用区、Cn 未分配
    current = current.replace(/[\p{Cf}\p{Co}\p{Cn}]/gu, '');

    // 3) 兜底：部分运行时对 \p{...} 支持不全，用显式 code point 范围再过一遍
    current = current
      .replace(/[\u200B-\u200F]/g, '') // 零宽空格、LTR/RTL 标记
      .replace(/[\u202A-\u202E]/g, '') // 方向格式化控制
      .replace(/[\u2066-\u2069]/g, '') // 方向隔离字符
      .replace(/[\uFEFF]/g, '') // 字节序标记
      .replace(/[\uE000-\uF8FF]/g, ''); // BMP 私用区

    iterations++;
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error(
      `Unicode 净化达到最大迭代次数（${MAX_ITERATIONS}），输入片段：${input.slice(0, 100)}`,
    );
  }

  return current;
}

/** 递归版：字符串走净化，数组/对象逐项递归；其他类型原样返回。 */
export function recursivelySanitizeUnicode(value: string): string;
export function recursivelySanitizeUnicode<T>(value: T[]): T[];
export function recursivelySanitizeUnicode<T extends object>(value: T): T;
export function recursivelySanitizeUnicode<T>(value: T): T;
export function recursivelySanitizeUnicode(value: unknown): unknown {
  if (typeof value === 'string') {
    return partiallySanitizeUnicode(value);
  }
  if (Array.isArray(value)) {
    return value.map(recursivelySanitizeUnicode);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[recursivelySanitizeUnicode(key)] = recursivelySanitizeUnicode(val);
    }
    return out;
  }
  return value;
}
