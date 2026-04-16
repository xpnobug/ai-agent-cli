/**
 * ConfigSetDialog — /config set 命令的配置修改对话框
 *
 * 作为 REPL 内的 focus overlay 运行，复用 Onboarding 的共享数据和组件。
 * 步骤：提供商选择 → API Key → 模型选择
 */

import React, { useState } from 'react';
import { Box, Text } from '../primitives.js';
import { CustomSelect } from './CustomSelect/index.js';
import { saveUserConfig, type UserConfig } from '../../../services/config/configStore.js';
import type { Provider } from '../../../core/types.js';
import {
  PROVIDER_OPTIONS,
  MODEL_OPTIONS,
  PROVIDER_NAMES,
  SimpleTextInput,
} from './configShared.js';

type ConfigResult = { provider: string; apiKey: string; model: string } | null;

type Props = {
  currentProvider: string;
  currentModel: string;
  onDone: (result: ConfigResult) => void;
};

type ConfigStep = 'provider' | 'api-key' | 'model';

export function ConfigSetDialog({ currentProvider, currentModel, onDone }: Props): React.ReactNode {
  const [step, setStep] = useState<ConfigStep>('provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [customModelError, setCustomModelError] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);

  // ─── 提供商选择 ───

  function handleProviderSelect(value: string) {
    if (value === 'anthropic' || value === 'openai' || value === 'gemini') {
      setProvider(value);
      setStep('api-key');
    }
  }

  // ─── API Key 输入 ───

  function handleApiKeySubmit(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 5) {
      setApiKeyError('API Key 长度至少为 5 个字符');
      return;
    }
    setApiKeyError('');
    setApiKey(trimmed);
    setStep('model');
  }

  // ─── 模型选择 ───

  function handleModelSelect(value: string) {
    if (value === '__custom__') {
      setIsCustomModel(true);
      return;
    }
    finishConfig(value);
  }

  function handleCustomModelSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setCustomModelError('模型名称不能为空');
      return;
    }
    setCustomModelError('');
    setIsCustomModel(false);
    finishConfig(trimmed);
  }

  function finishConfig(model: string) {
    if (!provider || !apiKey) return;
    const config: UserConfig = { provider, apiKey, model };
    saveUserConfig(config);
    onDone({ provider, apiKey, model });
  }

  // ─── 渲染 ───

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="cyan">重新配置</Text>
      <Box marginTop={1}>
        {step === 'provider' && (
          <Box flexDirection="column" gap={1}>
            <Text bold>
              请选择 AI 提供商
              <Text dimColor> (当前: {currentProvider})</Text>：
            </Text>
            <CustomSelect
              options={PROVIDER_OPTIONS}
              onChange={handleProviderSelect}
              onCancel={() => onDone(null)}
            />
            <Text dimColor>↑↓ 导航 · Enter 选择 · Esc 取消</Text>
          </Box>
        )}

        {step === 'api-key' && (
          <Box flexDirection="column" gap={1}>
            <Text bold>
              请输入 {provider ? PROVIDER_NAMES[provider] : ''} API Key：
            </Text>
            <SimpleTextInput
              value={apiKey}
              onChange={(v) => { setApiKey(v); setApiKeyError(''); }}
              onSubmit={handleApiKeySubmit}
              onCancel={() => onDone(null)}
              placeholder="sk-..."
              mask="*"
            />
            {apiKeyError ? <Text color="red">{apiKeyError}</Text> : null}
            <Text dimColor>Enter 确认 · Esc 取消</Text>
          </Box>
        )}

        {step === 'model' && (
          <Box flexDirection="column" gap={1}>
            <Text bold>
              请选择模型
              <Text dimColor> (当前: {currentModel})</Text>：
            </Text>
            {isCustomModel ? (
              <Box flexDirection="column" gap={1}>
                <Text>请输入模型名称：</Text>
                <SimpleTextInput
                  value={customModelInput}
                  onChange={(v) => { setCustomModelInput(v); setCustomModelError(''); }}
                  onSubmit={handleCustomModelSubmit}
                  onCancel={() => setIsCustomModel(false)}
                  placeholder="model-name"
                />
                {customModelError ? <Text color="red">{customModelError}</Text> : null}
                <Text dimColor>Enter 确认 · Esc 返回列表</Text>
              </Box>
            ) : (
              <>
                <CustomSelect
                  options={provider ? MODEL_OPTIONS[provider] : []}
                  onChange={handleModelSelect}
                  onCancel={() => onDone(null)}
                />
                <Text dimColor>↑↓ 导航 · Enter 选择 · Esc 取消</Text>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
