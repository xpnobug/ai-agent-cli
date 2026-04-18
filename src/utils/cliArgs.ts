/**
 * CLI 参数的早期解析
 *
 * Commander.js 等参数解析库在主流程里跑，但偶尔有一些 flag 必须
 * 在 init 之前就拿到（比如 --settings 会影响配置加载）。
 * 这里提供不依赖任何库的最小解析工具。
 */

/**
 * 从 argv 里抢出一个 flag 的值。
 * 同时兼容 "--flag value" 与 "--flag=value" 两种写法。
 *
 * @param flagName 带 dash 的 flag 名（如 '--settings'）
 * @param argv    默认 process.argv
 */
export function eagerParseCliFlag(
  flagName: string,
  argv: string[] = process.argv,
): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith(`${flagName}=`)) {
      return arg.slice(flagName.length + 1);
    }
    if (arg === flagName && i + 1 < argv.length) {
      return argv[i + 1];
    }
  }
  return undefined;
}

/**
 * 处理 Unix `--` 分隔符：用 Commander 的 passThroughOptions 时
 * `--` 会作为 positional 被传回而不是被吃掉，这里把它还原。
 *
 * 举例：`cmd --opt value name -- subcmd --flag arg` 被 Commander
 * 解析成 positional1='name'、positional2='--'、rest=['subcmd', '--flag', 'arg']。
 * 调用 extractArgsAfterDoubleDash('--', ['subcmd', '--flag', 'arg'])
 * 就得到 `{ command: 'subcmd', args: ['--flag', 'arg'] }`。
 */
export function extractArgsAfterDoubleDash(
  commandOrValue: string,
  args: string[] = [],
): { command: string; args: string[] } {
  if (commandOrValue === '--' && args.length > 0) {
    return {
      command: args[0]!,
      args: args.slice(1),
    };
  }
  return { command: commandOrValue, args };
}
