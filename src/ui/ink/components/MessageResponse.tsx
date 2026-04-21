/**
 * MessageResponse — 工具结果连接符组件
 *
 * - 多行内容用 `borderLeft=single`，让竖线自动贴合全高度，
 *   而不是只在第一行画一条静态前缀；
 * - 统一 1 列宽度的 `│`，避免 U+23BF / NBSP 在不同终端/字体下
 *   被渲染成异常宽度导致后续行错位。
 */

import React, { useContext, createContext } from 'react';
import { Box } from '../primitives.js';
import { getInkColors } from '../../theme.js';
import { Ratchet } from './design-system/Ratchet.js';

// ─── Props ───

interface MessageResponseProps {
  children: React.ReactNode;
  /** 固定高度（行数）。指定后用 overflowY="hidden" 裁剪 */
  height?: number;
}

// ─── 嵌套检测 Context（防止渲染多层连接符） ───

const MessageResponseContext = createContext(false);

function MessageResponseProvider({ children }: { children: React.ReactNode }) {
  return (
    <MessageResponseContext.Provider value={true}>
      {children}
    </MessageResponseContext.Provider>
  );
}

// ─── 组件 ───

export function MessageResponse({ children, height }: MessageResponseProps) {
  const isMessageResponse = useContext(MessageResponseContext);
  const colors = getInkColors();

  if (isMessageResponse) {
    return <>{children}</>;
  }

  // borderLeft 自动按容器高度绘制，多行时每行都有 │
  // paddingLeft 让内容和 │ 之间留一个固定的 1 格空隙
  const inner = (
    <MessageResponseProvider>
      <Box
        borderStyle="single"
        borderLeft
        borderTop={false}
        borderRight={false}
        borderBottom={false}
        borderColor={colors.textDim}
        paddingLeft={1}
        marginLeft={2}
        height={height}
        overflowY="hidden"
      >
        {children}
      </Box>
    </MessageResponseProvider>
  );

  if (height !== undefined) {
    return inner;
  }

  return <Ratchet lock="offscreen">{inner}</Ratchet>;
}
