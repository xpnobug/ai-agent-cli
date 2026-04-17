/**
 * 本地日期工具
 *
 * - getLocalISODate: "YYYY-MM-DD"，取用户本地时区
 * - getLocalMonthYear: "February 2026"，粒度到月，用于少变动的提示词片段
 *
 * 注意：getSessionStartDate 用 memoize 锁住会话起始日期。
 * 主交互路径里 system prompt 会被缓存，凌晨跨天时如果重算日期会
 * 把整段 prefix cache 冲掉；牺牲"日期精确到今天"换 cache 稳定。
 * 简单模式（--bare）每次请求重建 prompt，也需要一个会话级常量来避免抖动。
 */

/** 支持用 CLAUDE_CODE_OVERRIDE_DATE / AI_AGENT_OVERRIDE_DATE 覆盖，便于测试 */
function readOverrideDate(): string | undefined {
  return (
    process.env.AI_AGENT_OVERRIDE_DATE ?? process.env.CLAUDE_CODE_OVERRIDE_DATE
  );
}

export function getLocalISODate(): string {
  const override = readOverrideDate();
  if (override) return override;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let cachedSessionStartDate: string | null = null;

/** 懒缓存的会话起始日期；整个进程只算一次 */
export function getSessionStartDate(): string {
  if (!cachedSessionStartDate) {
    cachedSessionStartDate = getLocalISODate();
  }
  return cachedSessionStartDate;
}

/** 仅测试使用：清空会话起始日期缓存 */
export function _resetSessionStartDateForTest(): void {
  cachedSessionStartDate = null;
}

/** "Month YYYY"（英文月名 + 年份），月级变动，用于减少 cache bust */
export function getLocalMonthYear(): string {
  const override = readOverrideDate();
  const date = override ? new Date(override) : new Date();
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
