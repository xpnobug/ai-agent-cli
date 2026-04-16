/**
 * wizard/ — 向导框架
 *
 * 提供多步骤向导的 Provider + Layout + Navigation 基础设施。
 */

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Box, Text } from '../../primitives.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Byline } from '../design-system/Byline.js';

// ─── 类型 ───

export interface WizardStep {
  id: string;
  title?: string;
  component: React.ComponentType;
}

interface WizardContextValue {
  currentStepIndex: number;
  totalSteps: number;
  title: string;
  showStepCounter: boolean;
  goBack: () => void;
  goNext: () => void;
  goTo: (index: number) => void;
  complete: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside WizardProvider');
  return ctx;
}

// ─── WizardProvider ───

interface WizardProviderProps {
  title: string;
  steps: WizardStep[];
  onComplete: () => void;
  onCancel: () => void;
  showStepCounter?: boolean;
  children?: never;
}

export function WizardProvider({
  title,
  steps,
  onComplete,
  onCancel,
  showStepCounter = true,
}: WizardProviderProps): React.ReactNode {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      onCancel();
    }
  }, [currentStepIndex, onCancel]);

  const goNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStepIndex, steps.length, onComplete]);

  const goTo = useCallback((index: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(steps.length - 1, index)));
  }, [steps.length]);

  const value = useMemo<WizardContextValue>(
    () => ({
      currentStepIndex,
      totalSteps: steps.length,
      title,
      showStepCounter,
      goBack,
      goNext,
      goTo,
      complete: onComplete,
    }),
    [currentStepIndex, steps.length, title, showStepCounter, goBack, goNext, goTo, onComplete],
  );

  const CurrentStep = steps[currentStepIndex]?.component;
  if (!CurrentStep) return null;

  return (
    <WizardContext.Provider value={value}>
      <WizardDialogLayout>
        <CurrentStep />
      </WizardDialogLayout>
    </WizardContext.Provider>
  );
}

// ─── WizardDialogLayout ───

interface WizardDialogLayoutProps {
  title?: string;
  children: ReactNode;
  footerText?: ReactNode;
}

export function WizardDialogLayout({
  title: titleOverride,
  children,
  footerText,
}: WizardDialogLayoutProps): React.ReactNode {
  const {
    currentStepIndex,
    totalSteps,
    title: providerTitle,
    showStepCounter,
    goBack,
  } = useWizard();

  const title = titleOverride || providerTitle || '向导';
  const stepSuffix = showStepCounter ? ` (${currentStepIndex + 1}/${totalSteps})` : '';

  return (
    <>
      <Dialog
        title={`${title}${stepSuffix}`}
        onCancel={goBack}
        color="suggestion"
      >
        {children}
      </Dialog>
      <WizardNavigationFooter instructions={footerText} />
    </>
  );
}

// ─── WizardNavigationFooter ───

interface WizardNavigationFooterProps {
  instructions?: ReactNode;
}

export function WizardNavigationFooter({
  instructions,
}: WizardNavigationFooterProps): React.ReactNode {
  const defaultInstructions = (
    <Byline>
      <KeyboardShortcutHint shortcut="↑↓" action="导航" />
      <KeyboardShortcutHint shortcut="Enter" action="选择" />
      <KeyboardShortcutHint shortcut="Esc" action="返回" />
    </Byline>
  );

  return (
    <Box marginLeft={3} marginTop={1}>
      <Text dimColor>{instructions ?? defaultInstructions}</Text>
    </Box>
  );
}
