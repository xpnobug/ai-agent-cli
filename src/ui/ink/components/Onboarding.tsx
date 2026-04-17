/**
 * Onboarding — 首次运行引导流程
 *
 * 使用 useState 步骤管理（不依赖 wizard 框架），
 * 作为独立 Ink 实例在主 App 渲染前运行。
 *
 * 步骤：提供商选择 → API Key → 模型选择 → 主题选择 → 安全说明
 */

import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from '../primitives.js';
import { Mascot } from './LogoV2/Mascot.js';
import { CustomSelect } from './CustomSelect/index.js';
import { OrderedList } from './ui/OrderedList.js';
import { PressEnterToContinue } from './PressEnterToContinue.js';
import { PRODUCT_NAME, VERSION } from '../../../core/constants.js';
import { setTheme, THEME_SETTINGS, type ThemeSetting } from '../../theme.js';
import { mergeAndSaveUserConfig, type UserConfig } from '../../../services/config/configStore.js';
import type { Provider } from '../../../core/types.js';
import {
  PROVIDER_OPTIONS,
  MODEL_OPTIONS,
  THEME_OPTIONS,
  PROVIDER_NAMES,
  BASE_URL_MODE_OPTIONS,
  SimpleTextInput,
  buildMascotOptions,
} from './configShared.js';

// ─── 步骤 ID ───

type StepId = 'provider' | 'api-key' | 'model' | 'api-base' | 'theme' | 'mascot' | 'security';

interface OnboardingStep {
  id: StepId;
  component: React.ReactNode;
}

// ─── WelcomeBanner — 顶部欢迎画面 ───

function WelcomeBanner(): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center" paddingX={2} paddingY={1}>
      <Mascot pose="arms-up" />
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text bold color="magenta">
          {PRODUCT_NAME} v{VERSION}
        </Text>
        <Text dimColor>欢迎！让我们完成初始设置。</Text>
      </Box>
    </Box>
  );
}

// ─── Onboarding 主组件 ───

type Props = {
  onDone: (config: UserConfig | null) => void;
};

export function Onboarding({ onDone }: Props): React.ReactNode {
  // 步骤管理
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // 配置数据积累
  const [provider, setProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [model, setModel] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [customModelError, setCustomModelError] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState<string | undefined>(undefined);
  const [customBaseUrlInput, setCustomBaseUrlInput] = useState('');
  const [customBaseUrlError, setCustomBaseUrlError] = useState('');
  const [isCustomBaseUrl, setIsCustomBaseUrl] = useState(false);
  const [mascotId, setMascotId] = useState('clawd');

  // ─── 步骤导航 ───

  function goToNextStep() {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      finishOnboarding();
    }
  }

  function finishOnboarding() {
    if (!provider || !apiKey || !model) return;
    const config = resolvedBaseUrl
      ? mergeAndSaveUserConfig({
          provider,
          apiKey: apiKey.trim(),
          model,
          mascot: mascotId,
          baseUrl: resolvedBaseUrl,
        })
      : mergeAndSaveUserConfig(
          { provider, apiKey: apiKey.trim(), model, mascot: mascotId },
          { clearBaseUrl: true }
        );
    onDone(config);
  }

  // ─── Step 1: 选择提供商 ───

  function handleProviderSelect(value: string) {
    if (value === 'anthropic' || value === 'openai' || value === 'gemini') {
      setProvider(value);
      goToNextStep();
    }
  }

  const providerStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>{' '}请选择 AI 提供商：</Text>
      <CustomSelect
        options={PROVIDER_OPTIONS}
        onChange={handleProviderSelect}
        onCancel={() => onDone(null)}
      />
      <Text dimColor>{' '}↑↓ 导航 · Enter 选择 · Esc 退出</Text>
    </Box>
  );

  // ─── Step 2: 输入 API Key ───

  function handleApiKeySubmit(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 5) {
      setApiKeyError('API Key 长度至少为 5 个字符');
      return;
    }
    setApiKeyError('');
    setApiKey(trimmed);
    goToNextStep();
  }

  const apiKeyStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>
        {' '}请输入 {provider ? PROVIDER_NAMES[provider] : ''} API Key：
      </Text>
      <SimpleTextInput
        value={apiKey}
        onChange={(v) => { setApiKey(v); setApiKeyError(''); }}
        onSubmit={handleApiKeySubmit}
        onCancel={() => onDone(null)}
        placeholder="sk-..."
        mask="*"
      />
      {apiKeyError ? <Text color="red">{' '}{apiKeyError}</Text> : null}
      <Text dimColor>{' '}输入完成后按 Enter 确认 · Esc 退出</Text>
    </Box>
  );

  // ─── Step 3: 选择模型 ───

  function handleModelSelect(value: string) {
    if (value === '__custom__') {
      setIsCustomModel(true);
      return;
    }
    setModel(value);
    goToNextStep();
  }

  function handleCustomModelSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setCustomModelError('模型名称不能为空');
      return;
    }
    setCustomModelError('');
    setModel(trimmed);
    setIsCustomModel(false);
    goToNextStep();
  }

  const modelStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>{' '}请选择模型：</Text>
      {isCustomModel ? (
        <Box flexDirection="column" gap={1}>
          <Text>{' '}请输入模型名称：</Text>
          <SimpleTextInput
            value={customModelInput}
            onChange={(v) => { setCustomModelInput(v); setCustomModelError(''); }}
            onSubmit={handleCustomModelSubmit}
            onCancel={() => setIsCustomModel(false)}
            placeholder="model-name"
          />
          {customModelError ? <Text color="red">{' '}{customModelError}</Text> : null}
          <Text dimColor>{' '}Enter 确认 · Esc 返回列表</Text>
        </Box>
      ) : (
        <>
          <CustomSelect
            options={provider ? MODEL_OPTIONS[provider] : []}
            onChange={handleModelSelect}
            onCancel={() => onDone(null)}
          />
          <Text dimColor>{' '}↑↓ 导航 · Enter 选择 · Esc 退出</Text>
        </>
      )}
    </Box>
  );

  // ─── Step 4: API Base URL（官方 / 自定义代理） ───

  function handleBaseUrlModeSelect(value: string) {
    if (value === '__default__') {
      setResolvedBaseUrl(undefined);
      goToNextStep();
      return;
    }
    if (value === '__custom__') {
      setIsCustomBaseUrl(true);
    }
  }

  function handleCustomBaseUrlSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('http')) {
      setCustomBaseUrlError('请输入有效的 URL (以 http:// 或 https:// 开头)');
      return;
    }
    setCustomBaseUrlError('');
    setResolvedBaseUrl(trimmed);
    setIsCustomBaseUrl(false);
    goToNextStep();
  }

  const apiBaseStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>{' '}API 端点：</Text>
      {isCustomBaseUrl ? (
        <Box flexDirection="column" gap={1}>
          <Text>{' '}请输入 Base URL：</Text>
          <SimpleTextInput
            value={customBaseUrlInput}
            onChange={(v) => { setCustomBaseUrlInput(v); setCustomBaseUrlError(''); }}
            onSubmit={handleCustomBaseUrlSubmit}
            onCancel={() => setIsCustomBaseUrl(false)}
            placeholder="https://..."
          />
          {customBaseUrlError ? <Text color="red">{' '}{customBaseUrlError}</Text> : null}
          <Text dimColor>{' '}Enter 确认 · Esc 返回上一项</Text>
        </Box>
      ) : (
        <>
          <CustomSelect
            options={BASE_URL_MODE_OPTIONS}
            onChange={handleBaseUrlModeSelect}
            onCancel={() => onDone(null)}
          />
          <Text dimColor>{' '}↑↓ 导航 · Enter 选择 · Esc 退出</Text>
        </>
      )}
    </Box>
  );

  // ─── Step 5: 选择主题 ───

  function handleThemeSelect(value: string) {
    if (THEME_SETTINGS.includes(value as ThemeSetting)) {
      setTheme(value);
    }
    goToNextStep();
  }

  const themeStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>{' '}请选择终端主题：</Text>
      <CustomSelect
        options={THEME_OPTIONS}
        onChange={handleThemeSelect}
        onCancel={() => goToNextStep()}
      />
      <Text dimColor>{' '}↑↓ 导航 · Enter 选择 · Esc 跳过</Text>
    </Box>
  );

  // ─── Step 6: 选择吉祥物 ───

  function handleMascotSelect(value: string) {
    setMascotId(value);
    goToNextStep();
  }

  const mascotStep = (
    <Box flexDirection="column" gap={1}>
      <Text bold>{' '}请选择吉祥物：</Text>
      <CustomSelect
        options={buildMascotOptions()}
        onChange={handleMascotSelect}
        onCancel={() => goToNextStep()}
      />
      <Text dimColor>{' '}↑↓ 导航 · Enter 选择 · Esc 跳过</Text>
    </Box>
  );

  // ─── Step 7: 安全说明 ───

  const handleSecurityContinue = useCallback(() => {
    finishOnboarding();
  }, [provider, apiKey, model, mascotId, resolvedBaseUrl]);

  const SecurityStepContent = (): React.ReactNode => {
    useInput((_input, key) => {
      if (key.return) {
        handleSecurityContinue();
      }
    });

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>{' '}安全说明：</Text>
        <Box flexDirection="column" width={70}>
          <OrderedList>
            <OrderedList.Item>
              <Text>AI 可能犯错</Text>
              <Text dimColor wrap="wrap">
                请始终审查 AI 的回复，尤其是在执行代码时。
              </Text>
            </OrderedList.Item>
            <OrderedList.Item>
              <Text>工具调用需要确认</Text>
              <Text dimColor wrap="wrap">
                文件读写、命令执行等操作默认需要您的确认才会执行。
              </Text>
            </OrderedList.Item>
            <OrderedList.Item>
              <Text>API Key 仅保存在本地</Text>
              <Text dimColor wrap="wrap">
                您的密钥存储在 ~/.ai-agent/config.json 中，不会上传到任何服务。
              </Text>
            </OrderedList.Item>
          </OrderedList>
        </Box>
        <PressEnterToContinue />
      </Box>
    );
  };

  const securityStep = <SecurityStepContent />;

  // ─── 步骤数组 ───

  const steps: OnboardingStep[] = [
    { id: 'provider', component: providerStep },
    { id: 'api-key', component: apiKeyStep },
    { id: 'model', component: modelStep },
    { id: 'api-base', component: apiBaseStep },
    { id: 'theme', component: themeStep },
    { id: 'mascot', component: mascotStep },
    { id: 'security', component: securityStep },
  ];

  const currentStep = steps[currentStepIndex];

  // ─── 渲染 ───

  return (
    <Box flexDirection="column">
      <WelcomeBanner />
      <Box flexDirection="column" marginTop={1}>
        {currentStep?.component}
      </Box>
    </Box>
  );
}
