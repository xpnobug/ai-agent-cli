/**
 * 危险 bash 命令模式识别
 *
 * 扫描命令字符串，命中已知高风险模式时返回一段人类可读的警告文本；
 * 仅用于 UI 侧展示（权限对话框），不影响权限链路决策。
 *
 * 模式来自 Claude Code 的 destructiveCommandWarning，译为中文。
 */

interface DestructivePattern {
  pattern: RegExp;
  warning: string;
}

const DESTRUCTIVE_PATTERNS: DestructivePattern[] = [
  // Git：数据丢失 / 难以回滚
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    warning: '可能丢弃未提交的改动',
  },
  {
    pattern: /\bgit\s+push\b[^;&|\n]*[ \t](--force|--force-with-lease|-f)\b/,
    warning: '可能覆盖远程分支历史',
  },
  {
    pattern:
      /\bgit\s+clean\b(?![^;&|\n]*(?:-[a-zA-Z]*n|--dry-run))[^;&|\n]*-[a-zA-Z]*f/,
    warning: '可能永久删除未跟踪文件',
  },
  {
    pattern: /\bgit\s+checkout\s+(--\s+)?\.[ \t]*($|[;&|\n])/,
    warning: '可能丢弃工作区所有改动',
  },
  {
    pattern: /\bgit\s+restore\s+(--\s+)?\.[ \t]*($|[;&|\n])/,
    warning: '可能丢弃工作区所有改动',
  },
  {
    pattern: /\bgit\s+stash[ \t]+(drop|clear)\b/,
    warning: '可能永久移除 stash 中的改动',
  },
  {
    pattern: /\bgit\s+branch\s+(-D[ \t]|--delete\s+--force|--force\s+--delete)\b/,
    warning: '可能强制删除分支',
  },

  // Git：绕过安全检查
  {
    pattern: /\bgit\s+(commit|push|merge)\b[^;&|\n]*--no-verify\b/,
    warning: '跳过了安全 hook（pre-commit / pre-push 等）',
  },
  {
    pattern: /\bgit\s+commit\b[^;&|\n]*--amend\b/,
    warning: '可能改写最近一次 commit',
  },

  // 文件删除
  {
    pattern:
      /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f|(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*f[a-zA-Z]*[rR]/,
    warning: '可能递归强制删除文件',
  },
  {
    pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR]/,
    warning: '可能递归删除文件',
  },
  {
    pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*f/,
    warning: '可能强制删除文件',
  },

  // 数据库
  {
    pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
    warning: '可能删除数据库对象',
  },
  {
    pattern: /\bDELETE\s+FROM\s+\w+[ \t]*(;|"|'|\n|$)/i,
    warning: '可能清空数据库表',
  },

  // 基础设施
  {
    pattern: /\bkubectl\s+delete\b/,
    warning: '可能删除 Kubernetes 资源',
  },
  {
    pattern: /\bterraform\s+destroy\b/,
    warning: '可能销毁 Terraform 基础设施',
  },
  {
    pattern: /\bdocker\s+rm\b[^;&|\n]*-[a-zA-Z]*f/,
    warning: '可能强制删除 Docker 容器',
  },
  {
    pattern: /\bdocker\s+system\s+prune\b/,
    warning: '可能清理 Docker 镜像 / 容器 / 卷',
  },

  // 包管理覆写
  {
    pattern: /\bnpm\s+publish\b/,
    warning: '会发布包到 npm registry',
  },
  {
    pattern: /\bpnpm\s+publish\b/,
    warning: '会发布包到 npm registry',
  },
];

/**
 * 扫描命令，返回第一个命中的警告；无匹配返回 null。
 * 仅作 UI 展示，调用方可安全忽略。
 */
export function getDestructiveCommandWarning(command: string): string | null {
  for (const { pattern, warning } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) {
      return warning;
    }
  }
  return null;
}
