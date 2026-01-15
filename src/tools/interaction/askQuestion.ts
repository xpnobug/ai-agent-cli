/**
 * AskUserQuestion 工具 - 主动向用户提问
 * 支持单选、多选、结构化选项
 */

import * as readline from 'readline';

/**
 * 问题选项
 */
export interface QuestionOption {
  label: string;
  description: string;
}

/**
 * 问题定义
 */
export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

/**
 * 向用户提问并获取答案
 */
export async function runAskUserQuestion(questions: Question[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers: Record<string, string | string[]> = {};

  try {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 ${q.header}`);
      console.log(`${'='.repeat(60)}\n`);
      console.log(`❓ ${q.question}\n`);

      // 显示选项
      q.options.forEach((opt, idx) => {
        console.log(`  ${idx + 1}. ${opt.label}`);
        console.log(`     ${opt.description}\n`);
      });

      // 添加 "Other" 选项
      console.log(`  ${q.options.length + 1}. Other (自定义输入)\n`);

      // 获取用户输入
      const answer = await new Promise<string>((resolve) => {
        const promptText = q.multiSelect
          ? `请选择（多选用逗号分隔，如 1,3）: `
          : `请选择 (1-${q.options.length + 1}): `;

        rl.question(promptText, (input) => {
          resolve(input.trim());
        });
      });

      // 解析答案
      if (q.multiSelect) {
        const selections = answer.split(',').map((s) => s.trim());
        const selectedLabels: string[] = [];

        for (const sel of selections) {
          const idx = parseInt(sel, 10) - 1;
          if (idx >= 0 && idx < q.options.length) {
            selectedLabels.push(q.options[idx].label);
          } else if (idx === q.options.length) {
            // Other 选项
            const customAnswer = await new Promise<string>((resolve) => {
              rl.question('请输入自定义答案: ', (input) => {
                resolve(input.trim());
              });
            });
            selectedLabels.push(customAnswer);
          }
        }

        answers[q.header] = selectedLabels;
      } else {
        const idx = parseInt(answer, 10) - 1;
        if (idx >= 0 && idx < q.options.length) {
          answers[q.header] = q.options[idx].label;
        } else if (idx === q.options.length) {
          // Other 选项
          const customAnswer = await new Promise<string>((resolve) => {
            rl.question('请输入自定义答案: ', (input) => {
              resolve(input.trim());
            });
          });
          answers[q.header] = customAnswer;
        } else {
          answers[q.header] = '(无效选择)';
        }
      }
    }

    rl.close();

    // 格式化返回结果
    let result = '用户回答:\n\n';
    for (const [header, answer] of Object.entries(answers)) {
      if (Array.isArray(answer)) {
        result += `${header}: ${answer.join(', ')}\n`;
      } else {
        result += `${header}: ${answer}\n`;
      }
    }

    return result;
  } catch (error: unknown) {
    rl.close();
    if (error instanceof Error) {
      return `提问错误: ${error.message}`;
    }
    return `提问错误: ${String(error)}`;
  }
}
