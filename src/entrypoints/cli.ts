/**
 * AI Agent CLI 主入口
 */

import { Config } from '../services/config/Config.js';
import { loadUserConfig, getConfigSummary } from '../services/config/configStore.js';
import { runSetupWizard, runReconfigureWizard } from '../services/config/setup.js';
import { createAdapter } from '../services/ai/adapters/factory.js';
import { getSkillLoader } from '../tools/ai/index.js';
import { createExecuteTool } from '../tools/dispatcher.js';
import { ALL_TOOLS } from '../tools/definitions.js';
import { createSystemPrompt, getAgentDescriptions } from '../core/prompts.js';
import { agentLoop } from '../core/loop.js';
import { Banner, Messages, setThemeByProvider, getInput } from '../ui/index.js';
import { getReminderManager } from '../core/reminder.js';
import type { Message, ContentBlock } from '../core/types.js';


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

    // 5. 创建系统提示词
    const systemPrompt = createSystemPrompt(
      config.workdir,
      skillLoader.getDescriptions(),
      getAgentDescriptions()
    );

    // 6. 创建工具执行函数
    const executeTool = createExecuteTool({
      workdir: config.workdir,
      skillLoader,
      adapter,
      systemPrompt,
      tools: ALL_TOOLS,
    });

    // 7. 显示启动横幅
    Banner.render({
      provider: config.provider,
      providerDisplayName: config.getProviderDisplayName(),
      model: config.model,
      workdir: config.workdir,
      skills: skillLoader.listSkills(),
      agentTypes: ['explore', 'code', 'plan'],
    });

    // 8. 获取输入管理器
    const input = getInput();

    // 9. 获取 Reminder 管理器
    const reminderManager = getReminderManager();

    // 10. 对话历史
    const history: Message[] = [];

    // 11. REPL 循环
    while (true) {
      try {
        // 读取用户输入
        const result = await input.promptWithResult({ prefix: '>>>' });

        // 用户取消（ESC）
        if (result.cancelled) {
          continue;
        }

        const userInput = result.value;

        // 检查退出命令
        if (!userInput || ['exit', 'quit', 'q'].includes(userInput.toLowerCase())) {
          Messages.printGoodbye();
          break;
        }

        // 处理快捷命令
        if (result.command) {
          const cmd = result.command.toLowerCase();
          if (cmd === 'help' || cmd === 'h') {
            console.log('\n可用命令:');
            console.log('  /help, /h     - 显示帮助');
            console.log('  /clear, /c    - 清空对话历史');
            console.log('  /history      - 显示输入历史');
            console.log('  /config       - 查看当前配置');
            console.log('  /config set   - 重新配置');
            console.log('  exit, quit, q - 退出程序\n');
            continue;
          }
          if (cmd === 'config') {
            console.log('\n当前配置:');
            console.log(getConfigSummary(userConfig));
            console.log();
            continue;
          }
          if (cmd === 'config set') {
            const newConfig = await runReconfigureWizard();
            if (newConfig) {
              console.log('\n配置已更新，请重新启动 CLI 以使用新配置。\n');
              process.exit(0);
            }
            continue;
          }
          if (cmd === 'clear' || cmd === 'c') {
            history.length = 0;
            reminderManager.reset();
            console.log('\n对话历史已清空\n');
            continue;
          }
          if (cmd === 'history') {
            const inputHistory = input.getHistory();
            if (inputHistory.length === 0) {
              console.log('\n暂无输入历史\n');
            } else {
              console.log('\n输入历史:');
              inputHistory.slice(0, 10).forEach((h, i) => {
                console.log(`  ${i + 1}. ${h}`);
              });
              console.log();
            }
            continue;
          }
          // 未知命令，当作普通输入处理
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

        // 运行代理循环
        const newHistory = await agentLoop(
          history,
          systemPrompt,
          ALL_TOOLS,
          adapter,
          executeTool
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
