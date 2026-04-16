/**
 * overlayContext — Overlay 状态协调上下文
 *
 * 目标：在多个浮层同时可能出现时，协调 Esc / 输入焦点 / 请求取消等行为。
 * 当前实现采用独立 Context，不直接耦合 AppState，便于逐步接入现有架构。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface OverlayContextValue {
  activeOverlays: Set<string>;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
}

const NON_MODAL_OVERLAYS = new Set(['autocomplete']);

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());

  const registerOverlay = useCallback((id: string) => {
    setActiveOverlays((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unregisterOverlay = useCallback((id: string) => {
    setActiveOverlays((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<OverlayContextValue>(() => ({
    activeOverlays,
    registerOverlay,
    unregisterOverlay,
  }), [activeOverlays, registerOverlay, unregisterOverlay]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

/**
 * 在某个组件挂载期间将其登记为 overlay。
 */
export function useRegisterOverlay(id: string, enabled = true): void {
  const ctx = useContext(OverlayContext);
  // 取稳定的函数引用（useCallback 产出），不依赖整个 ctx 对象，
  // 避免 activeOverlays 变化 → ctx 引用变化 → effect 重跑 → 无限循环。
  const register = ctx?.registerOverlay;
  const unregister = ctx?.unregisterOverlay;

  useEffect(() => {
    if (!enabled || !register || !unregister) return;
    register(id);
    return () => unregister(id);
  }, [register, unregister, enabled, id]);
}

/**
 * 是否存在任何 overlay。
 */
export function useIsOverlayActive(): boolean {
  const ctx = useContext(OverlayContext);
  return (ctx?.activeOverlays.size ?? 0) > 0;
}

/**
 * 是否存在会阻止主输入框聚焦的 modal overlay。
 */
export function useIsModalOverlayActive(): boolean {
  const ctx = useContext(OverlayContext);
  if (!ctx) return false;

  for (const id of ctx.activeOverlays) {
    if (!NON_MODAL_OVERLAYS.has(id)) {
      return true;
    }
  }
  return false;
}
