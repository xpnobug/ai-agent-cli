/**
 * ModelPicker — 模型选择器
 *
 * 功能：通过 FuzzyPicker 列出当前 provider 可用模型，选择后切换。
 * 适配：支持多 provider（Anthropic/OpenAI/Gemini），去掉 Effort/FastMode 依赖。
 */

import React, { useMemo, useState } from 'react';
import { Box, Text } from '../primitives.js';
import { FuzzyPicker } from './design-system/FuzzyPicker.js';
import { useRegisterOverlay } from '../context/overlayContext.js';
import { getModelDisplayName, getModelContextLength } from '../../../utils/modelConfig.js';

type Props = {
  /** 当前选中的模型 */
  currentModel: string;
  /** 当前 provider */
  provider: string;
  /** 选择模型后的回调 */
  onSelect: (model: string) => void;
  /** 取消 */
  onCancel: () => void;
};

type ModelItem = {
  model: string;
  displayName: string;
  contextLength: number;
  lower: string;
};

/** 按 provider 获取模型列表 */
function getModelsForProvider(provider: string): string[] {
  switch (provider.toLowerCase()) {
    case 'anthropic':
      return [
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-3.5-sonnet',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
      ];
    case 'openai':
      return [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4-turbo-preview',
        'gpt-4-0125-preview',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini',
      ];
    case 'gemini':
      return [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
      ];
    default:
      return [];
  }
}

/** 格式化 token 数量 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

export function ModelPicker({ currentModel, provider, onSelect, onCancel }: Props): React.ReactNode {
  useRegisterOverlay('model-picker');
  const [query, setQuery] = useState('');

  const allModels = useMemo((): ModelItem[] => {
    return getModelsForProvider(provider).map((model) => ({
      model,
      displayName: getModelDisplayName(model),
      contextLength: getModelContextLength(provider, model),
      lower: model.toLowerCase(),
    }));
  }, [provider]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter((item) => item.lower.includes(q));
  }, [allModels, query]);

  return (
    <FuzzyPicker
      title={`选择模型 (${provider})`}
      placeholder="输入模型名称搜索…"
      items={filtered}
      getKey={(item) => item.model}
      onQueryChange={setQuery}
      onSelect={(item) => onSelect(item.model)}
      onCancel={onCancel}
      emptyMessage="未找到匹配模型"
      selectAction="切换"
      renderItem={(item, isFocused) => (
        <Box gap={2}>
          <Text color={isFocused ? 'cyan' : undefined} bold={item.model === currentModel}>
            {item.model === currentModel ? '● ' : '  '}
            {item.displayName}
          </Text>
          <Text dimColor>
            {formatTokens(item.contextLength)} ctx
          </Text>
        </Box>
      )}
    />
  );
}
