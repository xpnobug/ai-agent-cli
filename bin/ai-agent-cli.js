#!/usr/bin/env node

/**
 * AI Agent CLI 可执行入口
 *
 * 这个文件是 npm 包的可执行入口点
 * 它简单地导入并运行编译后的 entrypoints/cli.js
 */

// 导入编译后的主文件
import('../dist/entrypoints/cli.js').catch((error) => {
  console.error('Failed to start AI Agent CLI:', error);
  process.exit(1);
});
