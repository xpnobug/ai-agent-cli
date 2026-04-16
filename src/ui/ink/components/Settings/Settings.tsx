/**
 * Settings — 设置面板
 *
 * 功能：/config 命令触发，展示 Config + Status + Usage 三个 Tab。
 */

import React from 'react';
import { Box, Text, useInput } from '../../primitives.js';
import { Pane } from '../design-system/Pane.js';
import { Tab, Tabs } from '../design-system/Tabs.js';

type Props = {
  onClose: () => void;
  /** 当前配置快照 */
  config: ConfigSnapshot;
  /** 使用统计 */
  usage?: UsageSnapshot;
};

export interface ConfigSnapshot {
  provider: string;
  model: string;
  apiKeySet: boolean;
  workdir: string;
  permissionMode?: string;
  mcpServers?: number;
  customAgents?: number;
}

export interface UsageSnapshot {
  totalTokens: number;
  totalCost: number;
  sessionDuration: number;
  turns: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function ConfigRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box gap={2}>
      <Box width={20}><Text dimColor>{label}</Text></Box>
      <Text color={color} bold>{value}</Text>
    </Box>
  );
}

function ConfigTab({ config }: { config: ConfigSnapshot }) {
  return (
    <Box flexDirection="column" paddingY={1}>
      <ConfigRow label="提供商" value={config.provider} />
      <ConfigRow label="模型" value={config.model} />
      <ConfigRow label="API Key" value={config.apiKeySet ? '已设置' : '未设置'} color={config.apiKeySet ? 'green' : 'red'} />
      <ConfigRow label="工作目录" value={config.workdir} />
      {config.permissionMode && <ConfigRow label="权限模式" value={config.permissionMode} />}
      {config.mcpServers !== undefined && <ConfigRow label="MCP 服务器" value={String(config.mcpServers)} />}
      {config.customAgents !== undefined && <ConfigRow label="自定义代理" value={String(config.customAgents)} />}
    </Box>
  );
}

function StatusTab({ config }: { config: ConfigSnapshot }) {
  return (
    <Box flexDirection="column" paddingY={1}>
      <ConfigRow label="系统" value={`${process.platform} ${process.arch}`} />
      <ConfigRow label="Node.js" value={process.version} />
      <ConfigRow label="终端" value={process.env.TERM || 'unknown'} />
      <ConfigRow label="Shell" value={process.env.SHELL || 'unknown'} />
      <ConfigRow label="提供商" value={config.provider} color="cyan" />
    </Box>
  );
}

function UsageTab({ usage }: { usage?: UsageSnapshot }) {
  if (!usage) {
    return <Text dimColor>暂无使用数据</Text>;
  }
  return (
    <Box flexDirection="column" paddingY={1}>
      <ConfigRow label="Token 使用" value={formatTokens(usage.totalTokens)} color="cyan" />
      <ConfigRow label="费用" value={`$${usage.totalCost.toFixed(4)}`} color="yellow" />
      <ConfigRow label="对话轮次" value={String(usage.turns)} />
      <ConfigRow label="会话时长" value={`${Math.round(usage.sessionDuration)}s`} />
    </Box>
  );
}

export function Settings({ onClose, config, usage }: Props): React.ReactNode {
  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  return (
    <Pane color="cyan">
      <Box flexDirection="column">
        <Tabs>
          <Tab id="config" title="配置">
            <ConfigTab config={config} />
          </Tab>
          <Tab id="status" title="状态">
            <StatusTab config={config} />
          </Tab>
          <Tab id="usage" title="使用">
            <UsageTab usage={usage} />
          </Tab>
        </Tabs>
        <Box marginTop={1}>
          <Text dimColor>Esc 关闭</Text>
        </Box>
      </Box>
    </Pane>
  );
}
