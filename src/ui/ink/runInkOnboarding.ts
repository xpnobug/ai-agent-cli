/**
 * runInkOnboarding — 独立 Ink 实例运行引导流程
 *
 * 在主 App 渲染前以独立 Ink 实例运行 Onboarding 组件，
 * 完成后 unmount + cleanup，确保主 App 可正常接管 stdout。
 */

import { createElement } from 'react';
import { renderSync } from '../../vendor/ink/root.js';
import type { UserConfig } from '../../services/config/configStore.js';
import { Onboarding } from './components/Onboarding.js';

export async function runInkOnboarding(): Promise<UserConfig | null> {
  return new Promise<UserConfig | null>((resolve) => {
    let resolved = false;

    const handleDone = (config: UserConfig | null) => {
      if (resolved) return;
      resolved = true;
      inst.unmount();
      inst.cleanup();
      resolve(config);
    };

    const inst = renderSync(
      createElement(Onboarding, { onDone: handleDone }),
      { exitOnCtrlC: false, patchConsole: false },
    );
  });
}
