/**
 * configShared — Onboarding 和 ConfigSetDialog 共享的数据常量与输入组件
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import type { SelectOption } from './CustomSelect/index.js';
import type { Provider } from '../../../core/types.js';
import { usePasteHandler } from '../hooks/usePasteHandler.js';
import { normalizeLineEndings } from '../utils/paste.js';
import {
  acquireBracketedPasteMode,
  releaseBracketedPasteMode,
  consumeBracketedPasteStream,
  type BracketedPasteStreamState,
} from '../utils/bracketedPasteStream.js';

// ─── 提供商选项 ───

export const PROVIDER_OPTIONS: SelectOption<string>[] = [
  { value: 'anthropic', label: 'Anthropic Claude', description: '推荐' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'gemini', label: 'Google Gemini' },
];

// ─── 模型选项（按提供商） ───

export const MODEL_OPTIONS: Record<Provider, SelectOption<string>[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: '推荐' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: '最强推理' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: '最快速' },
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
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

/** API Base URL：默认官方端点 vs 自定义（代理/兼容网关） */
export const BASE_URL_MODE_OPTIONS: SelectOption<string>[] = [
  { value: '__default__', label: '使用官方默认 API 端点' },
  { value: '__custom__', label: '自定义 Base URL...', description: '代理 / 兼容网关' },
];

// ─── 吉祥物选项（从注册表动态生成） ───

import { getMascotRegistry } from './LogoV2/mascots/index.js';

export function buildMascotOptions(): SelectOption<string>[] {
  return getMascotRegistry().map((m, i) => ({
    value: m.id,
    label: m.name,
    description: i === 0 ? '默认' : undefined,
  }));
}

/** 单行字段：粘贴时去掉换行与控制字符（与逐字输入行为一致） */
function sanitizeSingleLinePastedText(text: string): string {
  return normalizeLineEndings(text)
    .replace(/[\r\n]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '');
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
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const bracketedPasteState = useRef<BracketedPasteStreamState>({
    mode: 'normal',
    incomplete: '',
    buffer: '',
  });

  useEffect(() => {
    acquireBracketedPasteMode();
    return () => releaseBracketedPasteMode();
  }, []);

  const appendPasted = useCallback(
    (raw: string) => {
      const chunk = sanitizeSingleLinePastedText(raw);
      if (chunk) {
        onChange(valueRef.current + chunk);
      }
    },
    [onChange]
  );

  const { handlePaste } = usePasteHandler({
    onTextPaste: appendPasted,
  });

  useInput((input, key) => {
    if (key.escape && onCancel) {
      onCancel();
      return;
    }
    if (key.return) {
      onSubmit(valueRef.current);
      return;
    }
    if (key.backspace || key.delete) {
      onChange(valueRef.current.slice(0, -1));
      return;
    }
    if (
      input &&
      consumeBracketedPasteStream(input, bracketedPasteState.current, {
        onPlainText: (t) => {
          if (!t) return;
          if (t.length === 1) {
            const code = t.charCodeAt(0);
            if (!key.ctrl && !key.meta && code >= 32) {
              onChange(valueRef.current + t);
            }
            return;
          }
          appendPasted(t);
        },
        onPasteComplete: (t) => handlePaste(t),
      })
    ) {
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length > 1) {
      handlePaste(input);
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1 && input.charCodeAt(0) >= 32) {
      onChange(valueRef.current + input);
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
