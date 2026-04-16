/**
 * promptOverlayContext — 提示输入覆盖层上下文
 *
 * - suggestions 数据通道：给 slash/搜索类浮层写入结构化候选项
 * - dialog 节点通道：给自动模式确认框等任意弹层写入 ReactNode
 *
 * 这里将“数据”和“setter”拆成不同 context：
 * - 读数据的组件按需订阅实际值
 * - 写数据的组件只拿稳定 setter，不会因自己写入而额外重渲染
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

// ─── 建议覆盖层 ───

export interface PromptOverlayData {
  suggestions: Array<{ value: string; displayValue: string; description?: string }>;
  selectedSuggestion: number;
  maxColumnWidth?: number;
}

type Setter<T> = (value: T | null) => void;

const PromptOverlayDataContext = createContext<PromptOverlayData | null>(null);
const PromptOverlaySetterContext = createContext<Setter<PromptOverlayData> | null>(null);

export function usePromptOverlay(): PromptOverlayData | null {
  return useContext(PromptOverlayDataContext);
}

/**
 * 写入建议浮层数据。
 * 组件卸载时自动清空，避免旧浮层残留。
 */
export function useSetPromptOverlay(data: PromptOverlayData | null): void {
  const setData = useContext(PromptOverlaySetterContext);

  useEffect(() => {
    if (!setData) return;
    setData(data);
    return () => setData(null);
  }, [data, setData]);
}

// ─── 对话框覆盖层 ───

const PromptOverlayDialogContext = createContext<ReactNode | null>(null);
const PromptOverlayDialogSetterContext = createContext<Setter<ReactNode> | null>(null);

export function usePromptOverlayDialog(): ReactNode | null {
  return useContext(PromptOverlayDialogContext);
}

/**
 * 写入对话框浮层节点。
 * 组件卸载时自动清空。
 */
export function useSetPromptOverlayDialog(dialog: ReactNode | null): void {
  const setDialog = useContext(PromptOverlayDialogSetterContext);

  useEffect(() => {
    if (!setDialog) return;
    setDialog(dialog);
    return () => setDialog(null);
  }, [dialog, setDialog]);
}

// ─── Provider ───

export function PromptOverlayProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PromptOverlayData | null>(null);
  const [dialog, setDialog] = useState<ReactNode | null>(null);

  return (
    <PromptOverlaySetterContext.Provider value={setData}>
      <PromptOverlayDialogSetterContext.Provider value={setDialog}>
        <PromptOverlayDataContext.Provider value={data}>
          <PromptOverlayDialogContext.Provider value={dialog}>
            {children}
          </PromptOverlayDialogContext.Provider>
        </PromptOverlayDataContext.Provider>
      </PromptOverlayDialogSetterContext.Provider>
    </PromptOverlaySetterContext.Provider>
  );
}
