/**
 * FullscreenLayout — 全屏布局组件
 *
 * React Compiler _c 已转换为标准 useMemo/useCallback。
 *
 * 布局结构（全屏模式）：
 *   PromptOverlayProvider
 *   ├── Box(flexGrow=1, overflow=hidden)
 *   │   ├── StickyPromptHeader  （条件渲染，固定 1 行）
 *   │   ├── ScrollBox(stickyScroll, paddingTop 动态)
 *   │   │   ├── ScrollChromeContext > {scrollable}
 *   │   │   └── {overlay}
 *   │   ├── NewMessagesPill     （条件渲染，absolute 浮动）
 *   │   └── {bottomFloat}       （条件渲染，absolute 右下）
 *   ├── Box(flexShrink=0)
 *   │   └── {bottom}
 *   └── Modal                   （条件渲染，absolute 底部弹窗）
 */

import figures from 'figures';
import React, {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ModalContext } from '../context/modalContext.js';
import {
  PromptOverlayProvider,
  usePromptOverlay,
  usePromptOverlayDialog,
} from '../context/promptOverlayContext.js';
import { useRegisterOverlay } from '../context/overlayContext.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Box, Text, ScrollBox } from '../primitives.js';
import type { ScrollBoxHandle } from '../primitives.js';
import instances from '../../../vendor/ink/instances.js';

/** 模态层上方保留的对话上下文行数 */
const MODAL_TRANSCRIPT_PEEK = 2;

// ─── StickyPrompt 类型 ───

/**
 * Sticky 提示词状态：
 * - {text, scrollTo}：滚动查看历史时，显示当前对话轮次的提示词
 * - 'clicked'：用户点击了 header，隐藏文本但保持 paddingTop=0
 * - null：在底部，不显示
 */
export type StickyPrompt = {
  text: string;
  scrollTo: () => void;
} | 'clicked';

/**
 * ScrollChromeContext — 滚动衍生的 chrome 状态上下文
 *
 * VirtualMessageList 中的 StickyTracker 通过此 context 写入 sticky prompt，
 * 避免从 Messages → REPL → FullscreenLayout 的回调穿透。
 * setter 是稳定的，消费此 context 不会触发重渲染。
 */
export const ScrollChromeContext = createContext<{
  setStickyPrompt: (p: StickyPrompt | null) => void;
}>({
  setStickyPrompt: () => {},
});

// ─── Props ───

interface Props {
  /** 可滚动内容（消息、工具输出） */
  scrollable: ReactNode;
  /** 底部固定内容（spinner、输入框、权限弹窗） */
  bottom: ReactNode;
  /** 在 ScrollBox 内消息之后渲染——用户可回滚查看上下文（用于权限对话框） */
  overlay?: ReactNode;
  /** ScrollBox 右下角浮动内容（用于伴侣气泡） */
  bottomFloat?: ReactNode;
  /** 模态对话框内容（absolute 底部弹窗） */
  modal?: ReactNode;
  /** 模态层的 ScrollBox 引用 */
  modalScrollRef?: React.RefObject<ScrollBoxHandle | null>;
  /** ScrollBox 引用 */
  scrollRef?: RefObject<ScrollBoxHandle | null>;
  /** 未读分割线的 scrollHeight 快照位置 */
  dividerYRef?: RefObject<number | null>;
  /** 强制隐藏 pill */
  hidePill?: boolean;
  /** 强制隐藏 sticky header */
  hideSticky?: boolean;
  /** pill 文本中的新消息计数 */
  newMessageCount?: number;
  /** 点击 pill 回调 */
  onPillClick?: () => void;
}

// ─── useUnseenDivider Hook ───

/**
 * 追踪"N 条新消息"分割线位置。
 * 用户首次滚动离开底部时快照 scrollHeight 和消息数。
 *
 * pillVisible 由 FullscreenLayout 通过 useSyncExternalStore 计算——
 * 每帧滚动不会导致 REPL 重渲染。
 * dividerIndex 留在 REPL 中，因为需要它计算 Messages 的分割线。
 */
export function useUnseenDivider(messageCount: number) {
  const [dividerIndex, setDividerIndex] = useState<number | null>(null);
  // ref 持有当前消息数，供 onScrollAway 在回调中同步读取
  const countRef = useRef(messageCount);
  countRef.current = messageCount;
  // scrollHeight 快照——分割线在内容坐标中的 y 位置
  const dividerYRef = useRef<number | null>(null);

  const onRepin = useCallback(() => {
    // 不在这里清除 dividerYRef——trackpad 动量事件可能在同一 stdin batch 中
    // 看到 null 并重新快照。useEffect 在 React commit 后清除。
    setDividerIndex(null);
  }, []);

  const onScrollAway = useCallback((handle: ScrollBoxHandle) => {
    // 视口下方没有内容 → 没有可跳转的目标
    const max = Math.max(0, handle.getScrollHeight() - handle.getViewportHeight());
    if (handle.getScrollTop() + handle.getPendingDelta() >= max) return;
    // 仅在首次离开底部时快照
    if (dividerYRef.current === null) {
      dividerYRef.current = handle.getScrollHeight();
      setDividerIndex(countRef.current);
    }
  }, []);

  const jumpToNew = useCallback((handle: ScrollBoxHandle | null) => {
    if (!handle) return;
    // scrollToBottom 设置 stickyScroll=true，确保虚拟滚动挂载尾部
    handle.scrollToBottom();
  }, []);

  // 同步 dividerYRef 与 dividerIndex
  useEffect(() => {
    if (dividerIndex === null) {
      dividerYRef.current = null;
    } else if (messageCount < dividerIndex) {
      dividerYRef.current = null;
      setDividerIndex(null);
    }
  }, [messageCount, dividerIndex]);

  const shiftDivider = useCallback((indexDelta: number, heightDelta: number) => {
    setDividerIndex(idx => idx === null ? null : idx + indexDelta);
    if (dividerYRef.current !== null) {
      dividerYRef.current += heightDelta;
    }
  }, []);

  return { dividerIndex, dividerYRef, onScrollAway, onRepin, jumpToNew, shiftDivider };
}

// ─── 辅助函数 ───

/** 简易复数 */
function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/** 全屏模式始终启用 */
function isFullscreenEnvEnabled(): boolean {
  return true;
}

// ─── NewMessagesPill 组件 ───

/**
 * Slack 风格的新消息药丸。
 * absolute 浮动在 ScrollBox 底部，居中显示。
 * count=0 时显示 "跳到底部"，>0 时显示 "N 条新消息"。
 */
function NewMessagesPill({ count, onClick }: { count: number; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const onEnter = useCallback(() => setHover(true), []);
  const onLeave = useCallback(() => setHover(false), []);
  const bg = hover ? 'cyanBright' : 'cyan';
  const label = count > 0 ? `${count} 条新${plural(count, '消息')}` : '跳到底部';

  return (
    <Box position="absolute" bottom={0} left={0} right={0} justifyContent="center">
      <Box onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <Text backgroundColor={bg} color="black" dimColor>
          {' '}{label}{' '}{figures.arrowDown}{' '}
        </Text>
      </Box>
    </Box>
  );
}

// ─── StickyPromptHeader 组件 ───

/**
 * 上下文面包屑：滚动查看历史时，在顶部固定当前对话轮次的提示词。
 * 高度固定 1 行（truncate-end），避免 ScrollBox 跳动。
 * 点击跳回原提示位置。
 */
function StickyPromptHeader({ text, onClick }: { text: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const onEnter = useCallback(() => setHover(true), []);
  const onLeave = useCallback(() => setHover(false), []);
  const bg = hover ? 'gray' : 'blackBright';

  return (
    <Box
      flexShrink={0}
      width="100%"
      height={1}
      paddingRight={1}
      backgroundColor={bg}
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <Text color="gray" wrap="truncate-end">
        {figures.pointer} {text}
      </Text>
    </Box>
  );
}

/**
 * PromptOverlayLayer — 补全浮层
 *
 * - 无边框、无选中标记符号
 * - 左列命令名 pad 到固定宽度（约终端 40%）
 * - 右列描述文本截断
 * - 选中项用 suggestion 色，未选中 dimColor
 * - 最多显示 5 项，超出滚动窗口
 */
function PromptOverlayLayer() {
  const overlayData = usePromptOverlay();
  const overlayDialog = usePromptOverlayDialog();

  useRegisterOverlay('autocomplete', overlayData !== null);
  useRegisterOverlay('prompt-dialog', overlayDialog != null);

  if (!overlayData && !overlayDialog) {
    return null;
  }

  const OVERLAY_MAX_ITEMS = 5;
  const columns = process.stdout.columns || 80;

  // 计算可见窗口（选中项居中）
  const suggestions = overlayData?.suggestions ?? [];
  const selectedIdx = overlayData?.selectedSuggestion ?? 0;
  const startIndex = Math.max(0, Math.min(
    selectedIdx - Math.floor(OVERLAY_MAX_ITEMS / 2),
    suggestions.length - OVERLAY_MAX_ITEMS,
  ));
  const endIndex = Math.min(startIndex + OVERLAY_MAX_ITEMS, suggestions.length);
  const visibleItems = suggestions.slice(startIndex, endIndex);

  // 左列宽度：命令名最大宽度 + padding，上限终端 40%
  const maxNameLen = Math.max(...suggestions.map(s => s.displayValue.length), 0);
  const displayTextWidth = Math.min(maxNameLen + 5, Math.floor(columns * 0.4));

  return (
    <Box position="absolute" bottom="100%" left={0} right={0} flexDirection="column">
      {overlayDialog}
      {visibleItems.length > 0 && (
        <Box flexDirection="column">
          {visibleItems.map((suggestion, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIdx;
            const textColor = isSelected ? 'cyan' : undefined;
            const shouldDim = !isSelected;

            // 左列：pad 到固定宽度
            let displayText = suggestion.displayValue;
            if (displayText.length > displayTextWidth - 2) {
              displayText = displayText.slice(0, displayTextWidth - 3) + '…';
            }
            const paddedName = displayText + ' '.repeat(Math.max(0, displayTextWidth - displayText.length));

            // 右列：描述截断到剩余宽度
            const descWidth = Math.max(0, columns - displayTextWidth - 4);
            let desc = (suggestion.description || '').replace(/\s+/g, ' ');
            if (desc.length > descWidth) {
              desc = desc.slice(0, descWidth - 1) + '…';
            }

            return (
              <Text key={`${suggestion.value}-${actualIndex}`} wrap="truncate">
                <Text color={textColor} dimColor={shouldDim}>{paddedName}</Text>
                <Text color={textColor} dimColor>{desc}</Text>
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ─── FullscreenLayout 主组件 ───

export function FullscreenLayout({
  scrollable,
  bottom,
  overlay,
  bottomFloat,
  modal,
  modalScrollRef,
  scrollRef,
  dividerYRef,
  hidePill = false,
  hideSticky = false,
  newMessageCount = 0,
  onPillClick,
}: Props): React.ReactNode {
  const { rows: terminalRows, columns } = useTerminalSize();

  // 滚动衍生的 chrome 状态（sticky prompt）
  const [stickyPrompt, setStickyPrompt] = useState<StickyPrompt | null>(null);
  const chromeCtx = useMemo(() => ({ setStickyPrompt }), []);

  // pill 可见性：布尔量化的滚动订阅
  // snapshot 是 "视口底部是否在分割线 y 之上？"——只有 boolean 翻转时才重渲染
  const subscribe = useCallback(
    (listener: () => void) =>
      scrollRef?.current?.subscribe(listener) ?? (() => {}),
    [scrollRef],
  );
  const pillVisible = useSyncExternalStore(subscribe, () => {
    const s = scrollRef?.current;
    const dividerY = dividerYRef?.current;
    if (!s || dividerY == null) return false;
    return s.getScrollTop() + s.getPendingDelta() + s.getViewportHeight() < dividerY;
  });

  // 超链接点击处理（全屏模式下终端拦截了 OSC 8 链接点击）
  useLayoutEffect(() => {
    if (!isFullscreenEnvEnabled()) return;
    const ink = instances.get(process.stdout);
    if (!ink) return;
    (ink as any).onHyperlinkClick = (url: string) => {
      if (url.startsWith('file:')) {
        try { /* openPath(fileURLToPath(url)) */ } catch { /* 忽略 */ }
      }
      // 其他 URL：可接入 openBrowser
    };
    return () => {
      (ink as any).onHyperlinkClick = undefined;
    };
  }, []);

  if (isFullscreenEnvEnabled()) {
    // ─── 全屏模式布局 ───

    // 三种 sticky 状态：null（底部）、{text,scrollTo}（滚动中）、'clicked'（刚点击）
    const sticky = hideSticky ? null : stickyPrompt;
    const headerPrompt = sticky != null && sticky !== 'clicked' && overlay == null ? sticky : null;
    const padCollapsed = sticky != null && overlay == null;

    // 滚动区域（ScrollBox + overlay 在同一容器中）
    const scrollContent = (
      <ScrollChromeContext value={chromeCtx}>
        {scrollable}
      </ScrollChromeContext>
    );

    return (
      <PromptOverlayProvider>
        {/* 滚动区域容器 */}
        <Box flexGrow={1} flexDirection="column" overflow="hidden">
          {/* StickyPromptHeader：ScrollBox 前面的 normal-flow 兄弟，占 1 行 */}
          {headerPrompt && (
            <StickyPromptHeader
              text={headerPrompt.text}
              onClick={headerPrompt.scrollTo}
            />
          )}

          {/* ScrollBox：stickyScroll 自动跟随底部 */}
          <ScrollBox
            ref={scrollRef}
            flexGrow={1}
            flexDirection="column"
            paddingTop={padCollapsed ? 0 : 1}
            stickyScroll
          >
            {scrollContent}
            {overlay}
          </ScrollBox>

          {/* NewMessagesPill：absolute 浮动在 ScrollBox 底部 */}
          {!hidePill && pillVisible && overlay == null && (
            <NewMessagesPill count={newMessageCount} onClick={onPillClick} />
          )}

          {/* bottomFloat：右下角浮动（用于伴侣气泡等） */}
          {bottomFloat != null && (
            <Box position="absolute" bottom={0} right={0} opaque>
              {bottomFloat}
            </Box>
          )}
        </Box>

        {/* 底部固定区域 */}
        <Box
          flexDirection="column"
          flexShrink={0}
          width="100%"
          maxHeight="50%"
          position="relative"
        >
          <PromptOverlayLayer />
          <Box flexDirection="column" width="100%" flexGrow={1} overflowY="hidden">
            {bottom}
          </Box>
        </Box>

        {/* 模态层：absolute 底部弹窗 */}
        {modal != null && (
          <ModalContext value={{
            rows: terminalRows - MODAL_TRANSCRIPT_PEEK - 1,
            columns: columns - 4,
            scrollRef: modalScrollRef ?? null,
          }}>
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              maxHeight={terminalRows - MODAL_TRANSCRIPT_PEEK}
              flexDirection="column"
              overflow="hidden"
              opaque
            >
              <Box flexShrink={0}>
                <Text color="cyan">{'\u2594'.repeat(columns)}</Text>
              </Box>
              <Box flexDirection="column" paddingX={2} flexShrink={0} overflow="hidden">
                {modal}
              </Box>
            </Box>
          </ModalContext>
        )}
      </PromptOverlayProvider>
    );
  }

  // ─── 非全屏模式（降级：顺序渲染） ───
  return (
    <>
      {scrollable}
      {bottom}
      {overlay}
      {modal}
    </>
  );
}
