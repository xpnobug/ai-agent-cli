/**
 * 记忆项新鲜度相关工具
 *
 * 全部函数为纯函数，仅依赖 Date.now()。
 */

/**
 * 返回 mtime 距今过了多少天（向下取整）。
 * 今天返回 0、昨天返回 1、更早返回对应天数。
 * 负值（时钟偏差 / 未来时间戳）统一归零。
 */
export function memoryAgeDays(mtimeMs: number): number {
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 86_400_000));
}

/**
 * 把 mtime 转成人类可读的年龄字符串。
 * 模型对原始 ISO 时间戳的 "旧/新" 判断很差，
 * 用 "47 天前" 这种语义化描述更能触发合适的 staleness 推理。
 */
export function memoryAge(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d === 0) return '今天';
  if (d === 1) return '昨天';
  return `${d} 天前`;
}

/**
 * 针对老于 1 天的记忆生成纯文本 staleness 提示；
 * 今天 / 昨天的记忆直接返回 ''，避免噪声提示。
 *
 * 调用方如果自己会用 <system-reminder> 包裹，
 * 就该使用本函数（返回裸文本）。
 */
export function memoryFreshnessText(mtimeMs: number): string {
  const d = memoryAgeDays(mtimeMs);
  if (d <= 1) return '';
  return (
    `这条记忆已经 ${d} 天没更新。` +
    `记忆是历史时刻的观察，不是实时状态；` +
    `关于代码行为、文件/行号的说法可能已经过时。` +
    `确认当前代码后再断言。`
  );
}

/**
 * 带 <system-reminder> 包裹的单条 staleness 注记。
 * 年龄 ≤ 1 天返回 ''。
 * 适合直接拼接到工具输出里、没有额外 reminder 包装的调用场景。
 */
export function memoryFreshnessNote(mtimeMs: number): string {
  const text = memoryFreshnessText(mtimeMs);
  if (!text) return '';
  return `<system-reminder>${text}</system-reminder>\n`;
}
