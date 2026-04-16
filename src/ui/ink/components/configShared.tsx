/**
 * configShared — Onboarding 和 ConfigSetDialog 共享的数据常量与输入组件
 */

import React from 'react';
import { Box, Text, useInput } from '../primitives.js';
import type { SelectOption } from './CustomSelect/index.js';
import type { Provider } from '../../../core/types.js';

// ─── 提供商选项 ───

export const PROVIDER_OPTIONS: SelectOption<string>[] = [
  { value: 'anthropic', label: 'Anthropic Claude', description: '推荐' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'gemini', label: 'Google Gemini' },
];

// ─── 模型选项（按提供商） ───

export const MODEL_OPTIONS: Record<Provider, SelectOption<string>[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', description: '推荐' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: '__custom__', label: '自定义模型...', description: '手动输入' },
  ],
  openai: [
    { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo', description: '推荐' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: '__custom__', label: '自定义模型...', description: '手动输入' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: '推荐' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: '__custom__', label: '自定义模型...', description: '手动输入' },
  ],
};

// ─── 主题选项 ───

export const THEME_OPTIONS: SelectOption<string>[] = [
  { value: 'auto', label: '自动 (Auto)', description: '跟随系统深色/浅色' },
  { value: 'dark', label: '深色 (Dark)' },
  { value: 'light', label: '浅色 (Light)' },
  { value: 'dark-daltonized', label: '深色色盲友好' },
  { value: 'light-daltonized', label: '浅色色盲友好' },
  { value: 'dark-ansi', label: '深色 ANSI', description: '16 色终端' },
  { value: 'light-ansi', label: '浅色 ANSI', description: '16 色终端' },
];

// ─── 提供商显示名称 ───

export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

// ─── 吉祥物选项（从注册表动态生成） ───

import { getMascotRegistry } from './LogoV2/mascots/index.js';

export function buildMascotOptions(): SelectOption<string>[] {
  return getMascotRegistry().map((m, i) => ({
    value: m.id,
    label: m.name,
    description: i === 0 ? '默认' : undefined,
  }));
}

// ─── SimpleTextInput — 轻量文本输入组件 ───

export interface SimpleTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  mask?: string;
}

export function SimpleTextInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  mask,
}: SimpleTextInputProps): React.ReactNode {
  useInput((input, key) => {
    if (key.escape && onCancel) {
      onCancel();
      return;
    }
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    // 过滤控制字符，只接受可打印字符
    if (input && !key.ctrl && !key.meta && input.length === 1 && input.charCodeAt(0) >= 32) {
      onChange(value + input);
    }
  });

  const displayValue = mask ? mask.repeat(value.length) : value;
  const showPlaceholder = !value && placeholder;

  return (
    <Box>
      <Text color="cyan">{'▸ '}</Text>
      {showPlaceholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        <Text>{displayValue}</Text>
      )}
      <Text color="cyan">{'█'}</Text>
    </Box>
  );
}
