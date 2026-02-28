/**
 * AI Agent CLI 主入口
 */

import { Config } from '../services/config/Config.js';
import { loadUserConfig } from '../services/config/configStore.js';
import { runSetupWizard } from '../services/config/setup.js';
import { createAdapter } from '../services/ai/adapters/factory.js';
import { getSkillLoader } from '../tools/ai/index.js';
import { createExecuteTool } from '../tools/dispatcher.js';
import { getAllTools } from '../tools/definitions.js';
import { createSystemPrompt, getAgentDescriptions } from '../core/prompts.js';
import { agentLoop } from '../core/loop.js';
import { Banner, Messages, setThemeByProvider, Input, getTheme } from '../ui/index.js';
import { getReminderManager } from '../core/reminder.js';
import { countTokensFromUsage, formatTokenCount, getTokenPercentage } from '../utils/tokenCounter.js';
import { getModelContextLength, getModelDisplayName } from '../utils/modelConfig.js';
import { getCommandRegistry } from '../commands/registry.js';
import { getBuiltinCommands } from '../commands/builtinCommands.js';
import { ContextCompressor } from '../core/contextCompressor.js';
import { getAgentTypeNames } from '../core/agents.js';
import { getPermissionManager } from '../core/permissions.js';
import { loadPermissionsConfig } from '../services/config/permissions.js';
import { HookManager } from '../core/hooks.js';
import { loadHooksConfig } from '../services/config/hooks.js';
import { MCPRegistry } from '../services/mcp/registry.js';
import type { Message, ContentBlock } from '../core/types.js';
import type { SlashCommandContext } from '../commands/registry.js';


/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 1. 检查是否需要运行配置向导
    let userConfig = loadUserConfig();

    if (!userConfig) {
      // 首次运行，启动配置向导
      userConfig = await runSetupWizard();

      if (!userConfig) {
        // 用户取消配置
        console.log('配置向导已取消，退出程序。');
        process.exit(0);
      }
    }

    // 2. 加载配置
    const config = new Config(userConfig);

    // 3. 设置主题
    setThemeByProvider(config.provider);

    // 4. 初始化适配器
    console.log('正在初始化...');
    const adapter = await createAdapter(config.provider, config.apiKey, config.model, config.baseUrl);

    // 5. 加载技能
    const skillLoader = getSkillLoader(config.skillsDir);

    // 6. 创建系统提示词
    const systemPrompt = createSystemPrompt(
      config.workdir,
      skillLoader.getDescriptions(),
      getAgentDescriptions()
    );

    // 7. 初始化上下文压缩器
    const modelContextLength = getModelContextLength(userConfig.provider, userConfig.model);
    const compressor = new ContextCompressor(adapter, modelContextLength);

    // 8. 初始化权限管理器
    const permissionsConfig = loadPermissionsConfig(config.workdir);
    const permissionManager = getPermissionManager(permissionsConfig);

    // 9. 初始化 Hook 管理器
    const hooksConfig = loadHooksConfig(config.workdir);
    const hookManager = new HookManager(config.workdir, hooksConfig);

    // 10. 初始化 MCP 注册表
    const mcpRegistry = new MCPRegistry(config.workdir);
    await mcpRegistry.loadConfig();
    if (mcpRegistry.hasServers()) {
      await mcpRegistry.connectAll();
    }

    // 获取动态工具列表（包含 MCP 工具）
    const mcpTools = mcpRegistry.getAllTools();
    const dynamicTools = getAllTools(mcpTools);

    // 11. 创建工具执行函数
    const executeTool = createExecuteTool({
      workdir: config.workdir,
      skillLoader,
      adapter,
      systemPrompt,
      tools: dynamicTools,
      mcpRegistry,
    });

    // 12. 初始化命令注册系统
    const registry = getCommandRegistry();
    const builtinCommands = getBuiltinCommands();
    for (const cmd of builtinCommands) {
      registry.register(cmd);
    }

    // 12. 触发 SessionStart Hook
    if (hookManager.hasHooksFor('SessionStart')) {
      await hookManager.emit('SessionStart', { workdir: config.workdir });
    }

    // 13. 显示启动横幅
    Banner.render({
      provider: config.provider,
      providerDisplayName: config.getProviderDisplayName(),
      model: config.model,
      workdir: config.workdir,
      skills: skillLoader.listSkills(),
      agentTypes: getAgentTypeNames(),
    });

    // 14. 创建输入管理器
    const input = new Input();

    // 15. 获取 Reminder 管理器
    const reminderManager = getReminderManager();

    // 16. 对话历史
    const history: Message[] = [];

    // 17. 创建命令上下文
    const cmdContext: SlashCommandContext = {
      workdir: config.workdir,
      history,
      config: {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        getProviderDisplayName: () => config.getProviderDisplayName(),
      },
      userConfig: userConfig as any,
      input: { getHistory: () => input.getHistory() },
      reminderManager,
      compressor,
      systemPrompt,
    };

    // 18. REPL 循环
    while (true) {
      try {
        // 显示 Token 使用情况
        if (history.length > 0) {
          const theme = getTheme();
          const currentTokens = countTokensFromUsage(history);
          const maxTokens = modelContextLength;

          const percentage = getTokenPercentage(currentTokens, maxTokens);
          const modelDisplay = getModelDisplayName(userConfig.model);
          const tokenInfo = `[${userConfig.provider}] ${modelDisplay}: ${formatTokenCount(currentTokens)}/${formatTokenCount(maxTokens)} (${percentage}%)`;
          console.log(theme.textDim(tokenInfo) + '\n');
        }

        // 读取用户输入
        const result = await input.promptWithResult({ prefix: '>>>' });

        // 用户取消（ESC）
        if (result.cancelled) {
          continue;
        }

        const userInput = result.value;

        // 检查退出命令
        if (!userInput || ['exit', 'quit', 'q'].includes(userInput.toLowerCase())) {
          // 触发 SessionEnd Hook
          if (hookManager.hasHooksFor('SessionEnd')) {
            await hookManager.emit('SessionEnd', { workdir: config.workdir });
          }
          // 断开 MCP 连接
          mcpRegistry.disconnectAll();
          Messages.printGoodbye();
          break;
        }

        // UserPromptSubmit Hook
        if (hookManager.hasHooksFor('UserPromptSubmit')) {
          await hookManager.emit('UserPromptSubmit', {
            workdir: config.workdir,
          });
        }

        // 处理斜杠命令
        if (result.command) {
          const cmd = result.command;

          // 特殊处理 help 命令（需要 registry.getHelp()）
          if (cmd.toLowerCase() === 'help' || cmd.toLowerCase() === 'h') {
            console.log(registry.getHelp());
            continue;
          }

          // 尝试通过注册系统执行
          const cmdResult = await registry.execute(cmd, cmdContext);
          if (cmdResult.handled) {
            if (cmdResult.output) {
              console.log('\n' + cmdResult.output + '\n');
            }
            continue;
          }

          // 未知命令，当作普通输入处理
        }

        // 自动上下文压缩
        if (compressor.shouldCompact(history)) {
          // PreCompact Hook
          if (hookManager.hasHooksFor('PreCompact')) {
            await hookManager.emit('PreCompact', { workdir: config.workdir });
          }

          try {
            const compactResult = await compressor.compact(history, systemPrompt);
            history.length = 0;
            history.push(...compactResult.newHistory);
            const theme = getTheme();
            console.log(theme.textDim(`[上下文已自动压缩: ${compactResult.originalLength} → ${compactResult.compressedLength} 条消息]`));

            // PostCompact Hook
            if (hookManager.hasHooksFor('PostCompact')) {
              await hookManager.emit('PostCompact', { workdir: config.workdir });
            }
          } catch {
            // 压缩失败不影响正常对话
          }
        }

        // 构建用户消息内容（可能包含 reminder）
        const reminder = reminderManager.getReminder();
        let userContent: string | ContentBlock[];

        if (reminder) {
          userContent = [
            { type: 'text', text: reminder },
            { type: 'text', text: userInput },
          ];
        } else {
          userContent = userInput;
        }

        // 标记第一条消息已发送
        reminderManager.markFirstMessageSent();

        // 添加用户消息到历史
        history.push({
          role: 'user',
          content: userContent,
        });

        // 显示 AI 响应开始
        Messages.printAIHeader();

        // 记录开始时间
        const startTime = Date.now();

        // 运行代理循环（传入权限管理器和 Hook 管理器）
        const newHistory = await agentLoop(
          history,
          systemPrompt,
          dynamicTools,
          adapter,
          executeTool,
          {
            permissionManager,
            hookManager,
          }
        );

        // 更新历史
        history.length = 0;
        history.push(...newHistory);

        // 显示响应结束（带耗时）
        const elapsed = (Date.now() - startTime) / 1000;
        Messages.printAIFooter(elapsed);
      } catch (error: unknown) {
        // 处理单次对话错误
        const errorMsg = error instanceof Error ? error.message : String(error);
        Messages.printError(errorMsg);

        // 从历史中移除失败的用户消息
        if (history.length > 0 && history[history.length - 1].role === 'user') {
          history.pop();
        }
      }
    }
  } catch (error: unknown) {
    // 处理初始化错误
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n初始化失败: ${errorMsg}\n`);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('\n未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n接收到中断信号');
  Messages.printGoodbye();
  process.exit(0);
});

// 启动
main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
