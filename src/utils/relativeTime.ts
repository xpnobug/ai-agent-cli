/**
 * 相对时间格式化
 *
 * 覆盖两类需求：
 *   - formatRelativeTime / formatRelativeTimeAgo：
 *     人类友好的"3m ago / in 2h"表示
 *   - formatResetTime / formatResetText：
 *     给"配额将在 X 重置"这类场景，<24h 只显示时间、>24h 显示日期
 */

import { getRelativeTimeFormat, getTimeZone } from './intl.js';

export type RelativeTimeStyle = 'long' | 'short' | 'narrow';

export interface RelativeTimeOptions {
  style?: RelativeTimeStyle;
  numeric?: 'always' | 'auto';
}

/**
 * 把一个 Date 与 now（默认当前时间）比较，输出"3m ago / in 2h"格式。
 * style='narrow' 采用自定义短单位（y/mo/w/d/h/m/s）；
 * 其它 style 走 Intl.RelativeTimeFormat。
 */
export function formatRelativeTime(
  date: Date,
  options: RelativeTimeOptions & { now?: Date } = {},
): string {
  const { style = 'narrow', numeric = 'always', now = new Date() } = options;
  const diffInMs = date.getTime() - now.getTime();
  const diffInSeconds = Math.trunc(diffInMs / 1000);

  const intervals = [
    { unit: 'year', seconds: 31_536_000, shortUnit: 'y' },
    { unit: 'month', seconds: 2_592_000, shortUnit: 'mo' },
    { unit: 'week', seconds: 604_800, shortUnit: 'w' },
    { unit: 'day', seconds: 86_400, shortUnit: 'd' },
    { unit: 'hour', seconds: 3_600, shortUnit: 'h' },
    { unit: 'minute', seconds: 60, shortUnit: 'm' },
    { unit: 'second', seconds: 1, shortUnit: 's' },
  ] as const;

  for (const { unit, seconds: intervalSeconds, shortUnit } of intervals) {
    if (Math.abs(diffInSeconds) >= intervalSeconds) {
      const value = Math.trunc(diffInSeconds / intervalSeconds);
      if (style === 'narrow') {
        return diffInSeconds < 0
          ? `${Math.abs(value)}${shortUnit} ago`
          : `in ${value}${shortUnit}`;
      }
      return getRelativeTimeFormat('long', numeric).format(
        value,
        unit as Intl.RelativeTimeFormatUnit,
      );
    }
  }

  if (style === 'narrow') {
    return diffInSeconds <= 0 ? '0s ago' : 'in 0s';
  }
  return getRelativeTimeFormat(style, numeric).format(0, 'second');
}

/**
 * 未来时间原样用 formatRelativeTime；过去时间强制 numeric:'always'
 * 保证出现 "X units ago" 而不是 "yesterday"。
 */
export function formatRelativeTimeAgo(
  date: Date,
  options: RelativeTimeOptions & { now?: Date } = {},
): string {
  const { now = new Date(), ...rest } = options;
  if (date > now) {
    return formatRelativeTime(date, { ...rest, now });
  }
  return formatRelativeTime(date, { ...rest, numeric: 'always', now });
}

/**
 * 给"配额在何时重置"这类场景做显示：
 *   - <24h：仅显示时间（10:15am）
 *   - >24h：日期 + 时间（Feb 20, 4:30pm），跨年补年份
 * showTimezone=true 时在末尾追加 "(Asia/Shanghai)"。
 */
export function formatResetTime(
  timestampInSeconds: number | undefined,
  showTimezone: boolean = false,
  showTime: boolean = true,
): string | undefined {
  if (!timestampInSeconds) return undefined;

  const date = new Date(timestampInSeconds * 1000);
  const now = new Date();
  const minutes = date.getMinutes();

  const hoursUntilReset = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilReset > 24) {
    const dateOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: showTime ? 'numeric' : undefined,
      minute: !showTime || minutes === 0 ? undefined : '2-digit',
      hour12: showTime ? true : undefined,
    };

    if (date.getFullYear() !== now.getFullYear()) {
      dateOptions.year = 'numeric';
    }

    const dateString = date.toLocaleString('en-US', dateOptions);
    return (
      dateString.replace(/ ([AP]M)/i, (_match, ampm: string) =>
        ampm.toLowerCase(),
      ) + (showTimezone ? ` (${getTimeZone()})` : '')
    );
  }

  const timeString = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: minutes === 0 ? undefined : '2-digit',
    hour12: true,
  });

  return (
    timeString.replace(/ ([AP]M)/i, (_match, ampm: string) =>
      ampm.toLowerCase(),
    ) + (showTimezone ? ` (${getTimeZone()})` : '')
  );
}

/** 接受 ISO 字符串版本的 formatResetTime */
export function formatResetText(
  resetsAt: string,
  showTimezone: boolean = false,
  showTime: boolean = true,
): string {
  const dt = new Date(resetsAt);
  return `${formatResetTime(
    Math.floor(dt.getTime() / 1000),
    showTimezone,
    showTime,
  )}`;
}

/**
 * 日志条目元信息格式化：
 *   "3m ago · main · 1.2KB · #ui-fix · @assistant · acme/repo#123"
 */
export interface LogMetadata {
  modified: Date;
  messageCount: number;
  fileSize?: number;
  gitBranch?: string;
  tag?: string;
  agentSetting?: string;
  prNumber?: number;
  prRepository?: string;
}

function formatFileSizeCompact(sizeInBytes: number): string {
  const kb = sizeInBytes / 1024;
  if (kb < 1) return `${sizeInBytes} bytes`;
  if (kb < 1024) return `${kb.toFixed(1).replace(/\.0$/, '')}KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(/\.0$/, '')}MB`;
  return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')}GB`;
}

export function formatLogMetadata(log: LogMetadata): string {
  const sizeOrCount =
    log.fileSize !== undefined
      ? formatFileSizeCompact(log.fileSize)
      : `${log.messageCount} messages`;
  const parts: string[] = [
    formatRelativeTimeAgo(log.modified, { style: 'short' }),
    ...(log.gitBranch ? [log.gitBranch] : []),
    sizeOrCount,
  ];
  if (log.tag) parts.push(`#${log.tag}`);
  if (log.agentSetting) parts.push(`@${log.agentSetting}`);
  if (log.prNumber) {
    parts.push(
      log.prRepository
        ? `${log.prRepository}#${log.prNumber}`
        : `#${log.prNumber}`,
    );
  }
  return parts.join(' · ');
}
