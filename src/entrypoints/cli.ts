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
import type { SlashCommandItem } from '../ui/ink/completion/types.js';
import { getReminderManager } from '../core/reminder.js';
import { countTokensFromUsage, formatTokenCount, getTokenPercentage, getCacheTokensFromUsage } from '../utils/tokenCounter.js';
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
import { runSkill } from '../tools/ai/skill.js';
import type { Message, ContentBlock } from '../core/types.js';
import type { SlashCommandContext } from '../commands/registry.js';
import { generateUuid } from '../utils/uuid.js';
import type { AskUserQuestionDef } from '../ui/ink/types.js';
import { appendSessionJsonlFromMessage, appendSessionSummaryRecord } from '../services/session/sessionLog.js';
import { loadSessionMessages } from '../services/session/sessionLoad.js';
import { listSessions, resolveResumeSessionIdentifier } from '../services/session/sessionResume.js';
import { getSessionId, setSessionId } from '../services/session/sessionId.js';

// 模块级控制变量
let rootAbort: HierarchicalAbortController | null = null;
let unmountInk: (() => void) | null = null;
let restoreConsole: (() => void) | null = null;
let interruptHandler: (() => void) | null = null;

/**
 * 解析斜杠命令
 */
function parseSlashCommand(input: string): { commandName: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const withoutSlash = trimmed.slice(1);
  const spaceIdx = withoutSlash.indexOf(' ');
  const commandName =
    spaceIdx === -1 ? withoutSlash.trim() : withoutSlash.slice(0, spaceIdx).trim();
  if (!commandName) return null;
  const args = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim();
  return { commandName, args };
}

/**
 * 构建斜杠命令列表（内置命令 + 自定义命令/技能）
 */
function buildSlashCommands(
  builtinCommands: { name: string; aliases?: string[] }[],
  skills: { userFacingName(): string; aliases?: string[]; isHidden?: boolean }[]
): SlashCommandItem[] {
  const items: SlashCommandItem[] = [];
  const seen = new Set<string>();

  for (const cmd of builtinCommands) {
    if (seen.has(cmd.name)) continue;
    seen.add(cmd.name);
    items.push({
      name: cmd.name,
      aliases: cmd.aliases,
      isHidden: false,
    });
  }

  for (const skill of skills) {
    const name = skill.userFacingName();
    if (seen.has(name)) continue;
    seen.add(name);
    items.push({
      name,
      aliases: skill.aliases,
      isHidden: skill.isHidden === true,
    });
  }

  return items;
}


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
      getAgentDescriptions(),
      { projectFile: config.projectFile }
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
    const slashCommands = buildSlashCommands(
      registry.listCommands(),
      skillLoader.getAllSkills()
    );

    // 14. 触发 SessionStart Hook
    if (hookManager.hasHooksFor('SessionStart')) {
      await hookManager.emit('SessionStart', { workdir: config.workdir, sessionId: getSessionId() });
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
    reminderManager.setProjectFileName(config.projectFile);

    // 20. 对话历史
    const history: Message[] = [];

    const resumeSession = async (identifier?: string): Promise<string | void> => {
      const cwd = config.workdir;

      if (identifier) {
        const resolved = resolveResumeSessionIdentifier({ cwd, identifier });
        if (resolved.kind === 'not_found') {
          return `未找到会话: ${resolved.identifier}`;
        }
        if (resolved.kind === 'ambiguous') {
          return `匹配到多个会话: ${resolved.identifier}\n请使用完整 sessionId:\n${resolved.matchingSessionIds.join('\n')}`;
        }
        if (resolved.kind === 'different_directory') {
          const dir = resolved.otherCwd ? `(${resolved.otherCwd})` : '(未知目录)';
          return `该会话不属于当前目录 ${dir}，请在对应目录下执行 /resume ${resolved.sessionId}`;
        }

      const messages = loadSessionMessages({ cwd, sessionId: resolved.sessionId });
      setSessionId(resolved.sessionId);
      history.length = 0;
      history.push(...messages);
      reminderManager.reset();
      if (messages.length > 0) {
        reminderManager.markFirstMessageSent();
      }
      tokenTracker?.reset();
      inkController.hydrateHistory(messages);
      if (messages.length > 0) {
        const currentTokens = countTokensFromUsage(messages);
        const percentage = getTokenPercentage(currentTokens, modelContextLength);
        const modelDisplay = getModelDisplayName(config.model);
        const cacheUsage = getCacheTokensFromUsage(messages);
        const cacheText = cacheUsage.total > 0
          ? ` · cache r:${formatTokenCount(cacheUsage.cacheReadTokens)} c:${formatTokenCount(cacheUsage.cacheCreationTokens)}`
          : '';
        const tokenInfo = `[${config.provider}] ${modelDisplay}: ${formatTokenCount(currentTokens)}/${formatTokenCount(modelContextLength)} (${percentage}%)${cacheText}`;
        appStore.setTokenInfo(tokenInfo);
      }
      return `已恢复会话: ${resolved.sessionId}`;
      }

      const sessions = listSessions({ cwd });
      if (sessions.length === 0) {
        return '未找到可恢复的会话';
      }

      const index = await inkController.requestSessionResume(sessions);
      if (index === null) {
        return '已取消恢复会话';
      }
      const selected = sessions[index];
      if (!selected) {
        return '选择无效';
      }

      const messages = loadSessionMessages({ cwd, sessionId: selected.sessionId });
      setSessionId(selected.sessionId);
      history.length = 0;
      history.push(...messages);
      reminderManager.reset();
      if (messages.length > 0) {
        reminderManager.markFirstMessageSent();
      }
      tokenTracker?.reset();
      inkController.hydrateHistory(messages);
      if (messages.length > 0) {
        const currentTokens = countTokensFromUsage(messages);
        const percentage = getTokenPercentage(currentTokens, modelContextLength);
        const modelDisplay = getModelDisplayName(config.model);
        const cacheUsage = getCacheTokensFromUsage(messages);
        const cacheText = cacheUsage.total > 0
          ? ` · cache r:${formatTokenCount(cacheUsage.cacheReadTokens)} c:${formatTokenCount(cacheUsage.cacheCreationTokens)}`
          : '';
        const tokenInfo = `[${config.provider}] ${modelDisplay}: ${formatTokenCount(currentTokens)}/${formatTokenCount(modelContextLength)} (${percentage}%)${cacheText}`;
        appStore.setTokenInfo(tokenInfo);
      }
      return `已恢复会话: ${selected.sessionId}`;
    };

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
      userConfig: { ...userConfig },
      input: { getHistory: () => getInputHistory() },
      reminderManager,
      compressor,
      systemPrompt,
      tokenTracker,
      resumeSession,
      requestTaskManager: (tasks) => inkController.requestTaskManager(tasks),
      showToolResult: (toolName, input, result, isError) =>
        inkController.showToolResultFromCommand(toolName, input, result, isError),
    };

    // 22. 用户输入处理回调（由 Ink UserInput 组件触发）
    //  stream-json：支持排队输入，串行处理
    const pendingUserInputs: string[] = [];
    let isDrainingQueue = false;

    const processSingleInput = async (text: string): Promise<void> => {
      try {
        // 检查退出命令
        if (!text || ['exit', 'quit', 'q'].includes(text.toLowerCase())) {
          if (hookManager.hasHooksFor('SessionEnd')) {
          await hookManager.emit('SessionEnd', { workdir: config.workdir, sessionId: getSessionId() });
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
          const cacheUsage = getCacheTokensFromUsage(history);
          const cacheText = cacheUsage.total > 0
            ? ` · cache r:${formatTokenCount(cacheUsage.cacheReadTokens)} c:${formatTokenCount(cacheUsage.cacheCreationTokens)}`
            : '';
          const tokenInfo = `[${config.provider}] ${modelDisplay}: ${formatTokenCount(currentTokens)}/${formatTokenCount(modelContextLength)} (${percentage}%)${cacheText}`;
          appStore.setTokenInfo(tokenInfo);
        }

        // UserPromptSubmit Hook
        if (hookManager.hasHooksFor('UserPromptSubmit')) {
          await hookManager.emit('UserPromptSubmit', { workdir: config.workdir, sessionId: getSessionId() });
        }

        // 处理斜杠命令（内置命令 + 自定义命令/技能）
        let effectiveInput = text;
        if (text.startsWith('/')) {
          const parsed = parseSlashCommand(text);
          const cmdName = parsed?.commandName || '';

          // 特殊处理 help 命令
          if (cmdName.toLowerCase() === 'help' || cmdName.toLowerCase() === 'h') {
            inkController.showInfo(registry.getHelp());
            inkController.goToInput();
            return;
          }

          // 先尝试内置命令（支持参数）
          const cmdResult = await registry.execute(text.slice(1), cmdContext);
          if (cmdResult.handled) {
            if (cmdResult.output) {
              inkController.showInfo(cmdResult.output);
            }
            inkController.goToInput();
            return;
          }

          // 再尝试自定义命令/技能
          if (parsed) {
            const skillResult = await runSkill(skillLoader, parsed.commandName, parsed.args);
            if (!skillResult.success || !skillResult.prompt) {
              const errorMsg = skillResult.error || `未知命令: /${parsed.commandName}`;
              inkController.showError(errorMsg);
              inkController.goToInput();
              return;
            }

            inkController.showInfo(`/${parsed.commandName} 正在运行…`);
            effectiveInput = skillResult.prompt;
          }
        }

        // 显示用户消息
        inkController.addUserMessage(text);

        // 自动上下文压缩
        if (compressor.shouldCompact(history)) {
          if (hookManager.hasHooksFor('PreCompact')) {
            await hookManager.emit('PreCompact', { workdir: config.workdir, sessionId: getSessionId() });
          }

          try {
            const compactResult = await compressor.compact(history, systemPrompt);
            history.length = 0;
            history.push(...compactResult.newHistory);
            inkController.showInfo(`[上下文已自动压缩: ${compactResult.originalLength} → ${compactResult.compressedLength} 条消息]`);
            if (compactResult.summary) {
              const leaf = [...compactResult.newHistory].reverse().find((msg) => msg.role === 'assistant')?.uuid;
              if (leaf) {
                appendSessionSummaryRecord({ summary: compactResult.summary, leafUuid: leaf });
              }
            }

            if (hookManager.hasHooksFor('PostCompact')) {
              await hookManager.emit('PostCompact', { workdir: config.workdir, sessionId: getSessionId() });
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
            { type: 'text', text: effectiveInput },
          ];
        } else {
          userContent = effectiveInput;
        }

        // 标记第一条消息已发送
        reminderManager.markFirstMessageSent();

        // 添加用户消息到历史
        const userMessage: Message = {
          role: 'user',
          content: userContent,
          uuid: generateUuid(),
        };
        history.push(userMessage);

        // 记录用户消息到会话日志
        appendSessionJsonlFromMessage({ message: userMessage });

        // 记录开始时间
        const startTime = Date.now();

        // 运行代理循环（使用层级式 AbortController）
        rootAbort = new HierarchicalAbortController();

        // 每次对话创建新的工具执行器（绑定当前 abortController）
        const executeTool = createExecuteTool({
          ...baseToolConfig,
          abortController: rootAbort,
          askUserQuestion: (questions, initialAnswers) =>
            inkController.requestQuestion(questions as AskUserQuestionDef[], initialAnswers),
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
      } finally {
        // 确保回到输入阶段
        inkController.goToInput();
      }
    };

    const drainQueuedInputs = async (): Promise<void> => {
      if (isDrainingQueue) return;
      isDrainingQueue = true;
      try {
        while (pendingUserInputs.length > 0) {
          const nextInput = pendingUserInputs.shift()!;
          await processSingleInput(nextInput);
        }
      } finally {
        isDrainingQueue = false;
        if (pendingUserInputs.length > 0) {
          void drainQueuedInputs();
        }
      }
    };

    const handleUserInput = async (text: string): Promise<void> => {
      // 空输入直接忽略
      if (!text) return;

      // 退出命令不入队，立即处理
      if (['exit', 'quit', 'q'].includes(text.toLowerCase())) {
        await processSingleInput(text);
        return;
      }

      pendingUserInputs.push(text);
      void drainQueuedInputs();
    };

    // 23. 退出处理（Ctrl+D 触发）
    const handleExit = (): void => {
      if (hookManager.hasHooksFor('SessionEnd')) {
        hookManager.emit('SessionEnd', { workdir: config.workdir, sessionId: getSessionId() }).catch(() => {});
      }
      mcpRegistry.disconnectAll();
    };

    // 24. 中断处理（ESC / Ctrl+C）
    const handleInterrupt = (): void => {
      if (rootAbort && !rootAbort.signal.aborted) {
        // AI 生成中：级联中断所有子代理
        rootAbort.abort();
        rootAbort = null;
        return;
      }
      // 空闲状态：退出 Ink 应用
      unmountInk?.();
    };

    // 24. 拦截 console 输出到 TUI（在 render 前启用）
    restoreConsole = patchConsole(appStore);

    // 25. 渲染 Ink 应用（传入 store 而非 controller）
    const { waitUntilExit, unmount } = render(
      createElement(App, {
        store: appStore,
        onInput: handleUserInput,
        onExit: handleExit,
        onInterrupt: handleInterrupt,
        slashCommands,
        getTokenStats: () => {
          const stats = tokenTracker.getStats();
          return { totalTokens: stats.totalTokens, totalCost: stats.totalCost };
        },
      }),
      { exitOnCtrlC: false }
    );
    unmountInk = unmount;
    interruptHandler = handleInterrupt;

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
  if (interruptHandler) {
    interruptHandler();
    return;
  }
  if (rootAbort && !rootAbort.signal.aborted) {
    rootAbort.abort();
    rootAbort = null;
    return;
  }
  unmountInk?.();
});

// 启动
main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
