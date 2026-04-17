/**
 * ModelPicker — 模型选择器
 *
 * - 分 provider 展示模型列表，带描述和上下文长度
 * - 当前选中模型显示 ✓ 标记和模型 ID
 * - 使用 CustomSelect 替代 FuzzyPicker
 */

import React, { useMemo } from 'react';
import { Box, Text } from '../primitives.js';
import { CustomSelect, type SelectOption } from './CustomSelect/index.js';
import { useRegisterOverlay } from '../context/overlayContext.js';

// ─── 模型定义 ───

interface ModelDef {
  id: string;           // 模型 ID（传给 API）
  name: string;         // 显示名称
  description: string;  // 简短描述
  context: string;      // 上下文长度
}

const ANTHROPIC_MODELS: ModelDef[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: '最强推理 · $3/$15 per Mtok', context: '200K' },
  { id: 'claude-opus-4-6[1m]', name: 'Claude Opus 4.6 (1M)', description: '最强推理 · 1M 上下文', context: '1M' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: '推荐 · $3/$15 per Mtok', context: '200K' },
  { id: 'claude-sonnet-4-6[1m]', name: 'Claude Sonnet 4.6 (1M)', description: '推荐 · 长会话', context: '1M' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: '最快速 · $1/$5 per Mtok', context: '200K' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: '上一代推荐', context: '200K' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '上一代旗舰', context: '200K' },
];

const OPENAI_MODELS: ModelDef[] = [
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: '推荐 · 高速高质量', context: '128K' },
  { id: 'gpt-4', name: 'GPT-4', description: '稳定版本', context: '128K' },
  { id: 'gpt-4o', name: 'GPT-4o', description: '多模态优化', context: '128K' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量快速', context: '128K' },
  { id: 'o1-preview', name: 'o1 Preview', description: '深度推理', context: '128K' },
  { id: 'o1-mini', name: 'o1 Mini', description: '轻量推理', context: '128K' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '经济实惠', context: '16K' },
];

const GEMINI_MODELS: ModelDef[] = [
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '推荐 · 最强性能', context: '2M' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', description: '实验性高速', context: '1M' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '高速低成本', context: '1M' },
  { id: 'gemini-pro', name: 'Gemini Pro', description: '基础版本', context: '32K' },
];

const MODEL_REGISTRY: Record<string, ModelDef[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
};

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

// ─── 组件 ───

type Props = {
  currentModel: string;
  provider: string;
  onSelect: (model: string) => void;
  onCancel: () => void;
};

export function ModelPicker({ currentModel, provider, onSelect, onCancel }: Props): React.ReactNode {
  useRegisterOverlay('model-picker');

  const options = useMemo((): SelectOption<string>[] => {
    const models = MODEL_REGISTRY[provider.toLowerCase()] ?? [];
    return models.map((m) => ({
      value: m.id,
      label: m.id === currentModel ? `${m.name} ✓` : m.name,
      description: `${m.description} · ${m.context} ctx`,
    }));
  }, [provider, currentModel]);

  // 当前选中模型的 ID 显示
  const currentDef = (MODEL_REGISTRY[provider.toLowerCase()] ?? []).find((m) => m.id === currentModel);

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>选择模型</Text>
        <Text dimColor>
          切换 {PROVIDER_NAMES[provider.toLowerCase()] ?? provider} 模型，选择后需重启生效。
        </Text>
      </Box>
      <CustomSelect
        options={options}
        defaultValue={currentModel}
        onChange={onSelect}
        onCancel={onCancel}
      />
      {currentDef && (
        <Text dimColor>
          当前: {currentDef.name} ({currentModel})
        </Text>
      )}
      <Text dimColor>Enter 确认 · Esc 取消</Text>
    </Box>
  );
}
