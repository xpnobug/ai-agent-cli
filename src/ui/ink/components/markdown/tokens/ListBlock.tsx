/**
 * ListBlock - 列表组件（支持递归嵌套）
 */

import React from 'react';
import { Box, Text } from '../../../primitives.js';
import type { Tokens, Token } from 'marked';
import { renderInlineTokens } from '../renderToken.js';

const DEPTH_1_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DEPTH_2_ROMAN = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx'];

function getOrderedMarker(depth: number, index: number): string {
  switch (depth) {
    case 0:
    case 1:
      return `${index + 1}.`;
    case 2:
      return `${DEPTH_1_LETTERS[index] ?? (index + 1).toString()}.`;
    case 3:
      return `${DEPTH_2_ROMAN[index] ?? (index + 1).toString()}.`;
    default:
      return `${index + 1}.`;
  }
}

function ListItem({ item, ordered, index, depth }: {
  item: Tokens.ListItem;
  ordered: boolean;
  index: number;
  depth: number;
}) {
  const marker = ordered ? getOrderedMarker(depth, index) : '-';
  const parts = renderItemContent(item, depth);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{' '.repeat(depth * 2)}{marker} </Text>
        <Text>
          {parts.map((part, i) => (
            <React.Fragment key={i}>{part}</React.Fragment>
          ))}
        </Text>
      </Box>
    </Box>
  );
}

function renderItemContent(item: Tokens.ListItem, _depth: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];

  for (const child of (item.tokens ?? [])) {
    if (child.type === 'text' && 'tokens' in child && child.tokens) {
      parts.push(renderInlineTokens(child.tokens as Token[]));
    } else if (child.type === 'paragraph' && 'tokens' in child && child.tokens) {
      parts.push(renderInlineTokens(child.tokens as Token[]));
    } else if (child.type === 'list') {
      // 嵌套列表会在下方的 NestedList 中处理
    }
  }

  return parts;
}

function NestedLists({ item, depth }: { item: Tokens.ListItem; depth: number }) {
  const nestedLists = (item.tokens ?? []).filter((t): t is Tokens.List => t.type === 'list');
  if (nestedLists.length === 0) return null;

  return (
    <>
      {nestedLists.map((list, i) => (
        <ListBlock key={i} token={list} depth={depth + 1} />
      ))}
    </>
  );
}

export function ListBlock({ token, depth = 0 }: { token: Tokens.List; depth?: number }) {
  return (
    <Box flexDirection="column">
      {token.items.map((item, index) => (
        <Box key={index} flexDirection="column">
          <ListItem
            item={item}
            ordered={token.ordered}
            index={token.ordered ? (Number(token.start) || 1) - 1 + index : index}
            depth={depth}
          />
          <NestedLists item={item} depth={depth} />
        </Box>
      ))}
    </Box>
  );
}
