/**
 * AI Agent CLI 主入口
 */

import { createElement } from 'react';
import { render } from 'ink';
import { Config } from '../services/config/Config.js';
import { loadUserConfig } from '../services/config/configStore.js';
import { runSetupWizard } from '../services/config/setup.js';
import { createAdapter } from '../services/ai/adapters/factory.js';
import { getSkillLoader } from '../tools/ai/index.js';
import { createExecuteTool } from '../tools/dispatcher.js';
import { getAllTools } from '../tools/definitions.js';
import { createSystemPrompt, getAgentDescriptions } from '../core/prompts.js';
import { agentLoop } from '../core/loop.js';
import { setThemeByProvider, getTheme, PRODUCT_NAME } from '../ui/index.js';
import { AppStore } from '../ui/ink/store.js';
import { InkUIController } from '../ui/ink/InkUIController.js';
import { App } from '../ui/ink/App.js';
import { getInputHistory } from '../ui/ink/components/UserInput.js';
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
import { initTokenTracker } from '../utils/tokenTracker.js';
import { HierarchicalAbortController } from '../core/abort.js';
import { patchConsole } from '../ui/ink/patchConsole.js';
import { KeybindingRegistry, DEFAULT_KEYBINDINGS } from '../ui/keybindings.js';
import { loadKeybindings } from '../services/config/keybindings.js';
import type { Message, ContentBlock } from '../core/types.js';
import type { SlashCommandContext } from '../commands/registry.js';

// 模块级控制变量
let rootAbort: HierarchicalAbortController | null = null;
let unmountInk: (() => void) | null = null;
let restoreConsole: (() => void) | null = null;


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

    // 11. 工具执行器配置（abortController 在每次对话时动态注入）
    const baseToolConfig = {
      workdir: config.workdir,
      skillLoader,
      adapter,
      systemPrompt,
      tools: dynamicTools,
      mcpRegistry,
    };

    // 12. 初始化 Token 追踪器
    const tokenTracker = initTokenTracker(config.model);

    // 13. 初始化命令注册系统
    const registry = getCommandRegistry();
    const builtinCommands = getBuiltinCommands();
    for (const cmd of builtinCommands) {
      registry.register(cmd);
    }

    // 14. 初始化按键映射注册表
    const userKeybindings = loadKeybindings(config.workdir);
    const keybindingRegistry = new KeybindingRegistry(DEFAULT_KEYBINDINGS, userKeybindings.length > 0 ? userKeybindings : undefined);

    // 15. 触发 SessionStart Hook
    if (hookManager.hasHooksFor('SessionStart')) {
      await hookManager.emit('SessionStart', { workdir: config.workdir });
    }

    // 15. 设置终端标题
    process.stdout.write(`\x1b]0;${PRODUCT_NAME} - ${config.model}\x07`);

    // 16. Banner 配置
    const bannerConfig = {
      provider: config.provider,
      providerDisplayName: config.getProviderDisplayName(),
      model: config.model,
      workdir: config.workdir,
      skills: skillLoader.listSkills(),
      agentTypes: getAgentTypeNames(),
    };

    // 17. 创建 AppStore（外部状态管理）
    const store = AppStore.createInitialState(getTheme(), bannerConfig);
    const appStore = new AppStore(store);

    // 18. 创建 Ink UI 控制器（注入 store）
    const inkController = new InkUIController(appStore, tokenTracker);

    // 19. 获取 Reminder 管理器
    const reminderManager = getReminderManager();

    // 20. 对话历史
    const history: Message[] = [];

    // 21. 创建命令上下文
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
      input: { getHistory: () => getInputHistory() },
      reminderManager,
      compressor,
      systemPrompt,
      tokenTracker,
    };

    // 22. 用户输入处理回调（由 Ink UserInput 组件触发）
    async function handleUserInput(text: string): Promise<void> {
      try {
        // 检查退出命令
        if (!text || ['exit', 'quit', 'q'].includes(text.toLowerCase())) {
          if (hookManager.hasHooksFor('SessionEnd')) {
            await hookManager.emit('SessionEnd', { workdir: config.workdir });
          }
          mcpRegistry.disconnectAll();
          unmountInk?.();
          return;
        }

        // 更新输入框底部 Token 使用信息
        if (history.length > 0) {
          const currentTokens = countTokensFromUsage(history);
          const percentage = getTokenPercentage(currentTokens, modelContextLength);
          const modelDisplay = getModelDisplayName(config.model);
          const tokenInfo = `[${config.provider}] ${modelDisplay}: ${formatTokenCount(currentTokens)}/${formatTokenCount(modelContextLength)} (${percentage}%)`;
          appStore.setTokenInfo(tokenInfo);
        }

        // UserPromptSubmit Hook
        if (hookManager.hasHooksFor('UserPromptSubmit')) {
          await hookManager.emit('UserPromptSubmit', { workdir: config.workdir });
        }

        // 处理斜杠命令
        if (text.startsWith('/')) {
          const spaceIdx = text.indexOf(' ');
          const cmd = spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx);

          // 特殊处理 help 命令
          if (cmd.toLowerCase() === 'help' || cmd.toLowerCase() === 'h') {
            inkController.showInfo(registry.getHelp());
            inkController.goToInput();
            return;
          }

          // 尝试通过注册系统执行
          const cmdResult = await registry.execute(cmd, cmdContext);
          if (cmdResult.handled) {
            if (cmdResult.output) {
              inkController.showInfo(cmdResult.output);
            }
            inkController.goToInput();
            return;
          }

          // 未知命令，当作普通输入处理
        }

        // 显示用户消息
        inkController.addUserMessage(text);

        // 自动上下文压缩
        if (compressor.shouldCompact(history)) {
          if (hookManager.hasHooksFor('PreCompact')) {
            await hookManager.emit('PreCompact', { workdir: config.workdir });
          }

          try {
            const compactResult = await compressor.compact(history, systemPrompt);
            history.length = 0;
            history.push(...compactResult.newHistory);
            inkController.showInfo(`[上下文已自动压缩: ${compactResult.originalLength} → ${compactResult.compressedLength} 条消息]`);

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
            { type: 'text', text: text },
          ];
        } else {
          userContent = text;
        }

        // 标记第一条消息已发送
        reminderManager.markFirstMessageSent();

        // 添加用户消息到历史
        history.push({
          role: 'user',
          content: userContent,
        });

        // 记录开始时间
        const startTime = Date.now();

        // 运行代理循环（使用层级式 AbortController）
        rootAbort = new HierarchicalAbortController();

        // 每次对话创建新的工具执行器（绑定当前 abortController）
        const executeTool = createExecuteTool({
          ...baseToolConfig,
          abortController: rootAbort,
        });

        const newHistory = await agentLoop(
          history,
          systemPrompt,
          dynamicTools,
          adapter,
          executeTool,
          {
            permissionManager,
            hookManager,
            abortController: rootAbort,
            tokenTracker,
            uiController: inkController,
          }
        );

        rootAbort = null;

        // 更新历史
        history.length = 0;
        history.push(...newHistory);

        // 显示响应耗时
        const elapsed = (Date.now() - startTime) / 1000;
        const elapsedStr = elapsed >= 60
          ? `${Math.floor(elapsed / 60)}m ${Math.round(elapsed % 60)}s`
          : `${elapsed.toFixed(1)}s`;
        inkController.showInfo(`Crunched for ${elapsedStr}`);
      } catch (error: unknown) {
        // 重置中断控制器
        rootAbort = null;

        // 处理单次对话错误
        const errorMsg = error instanceof Error ? error.message : String(error);
        inkController.showError(errorMsg);

        // 从历史中移除失败的用户消息
        if (history.length > 0 && history[history.length - 1].role === 'user') {
          history.pop();
        }
      }

      // 确保回到输入阶段
      inkController.goToInput();
    }

    // 23. 退出处理（Ctrl+D 触发）
    function handleExit(): void {
      if (hookManager.hasHooksFor('SessionEnd')) {
        hookManager.emit('SessionEnd', { workdir: config.workdir }).catch(() => {});
      }
      mcpRegistry.disconnectAll();
    }

    // 24. 拦截 console 输出到 TUI（在 render 前启用）
    restoreConsole = patchConsole(appStore);

    // 25. 渲染 Ink 应用（传入 store 而非 controller）
    const { waitUntilExit, unmount } = render(
      createElement(App, {
        store: appStore,
        onInput: handleUserInput,
        onExit: handleExit,
        commandNames: registry.getCommandNames(),
        keybindingRegistry,
        getTokenStats: () => {
          const stats = tokenTracker.getStats();
          return { totalTokens: stats.totalTokens, totalCost: stats.totalCost };
        },
      }),
      { exitOnCtrlC: false }
    );
    unmountInk = unmount;

    // 等待应用退出
    await waitUntilExit();
    restoreConsole?.();
    restoreConsole = null;
    console.log('\n再见！\n');
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

// 处理 Ctrl+C（智能中断：生成中中断生成，空闲时退出程序）
process.on('SIGINT', () => {
  if (rootAbort && !rootAbort.signal.aborted) {
    // AI 生成中：级联中断所有子代理
    rootAbort.abort();
    rootAbort = null;
  } else {
    // 空闲状态或已中断：退出 Ink 应用
    unmountInk?.();
  }
});

// 启动
main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
