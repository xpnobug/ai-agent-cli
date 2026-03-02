/**
 * Markdown 渲染
 */

import { marked, Token } from 'marked';
import chalk from 'chalk';
import { EOL } from 'node:os';
import { highlight, supportsLanguage } from 'cli-highlight';

const STRIPPED_TAGS = [
  'commit_analysis',
  'context',
  'function_analysis',
  'pr_analysis',
];

function stripSystemMessages(content: string): string {
  const regex = new RegExp(`<(${STRIPPED_TAGS.join('|')})>.*?</\\1>\n?`, 'gs');
  return content.replace(regex, '').trim();
}

function logError(message: string): void {
  if (process.env.NODE_ENV === 'test') return;
  console.error(message);
}

function format(
  token: Token,
  listDepth = 0,
  orderedListNumber: number | null = null,
  parent: Token | null = null,
): string {
  switch (token.type) {
    case 'blockquote':
      return chalk.dim.italic((token.tokens ?? []).map((t: Token) => format(t)).join(''));
    case 'code':
      if (token.lang && supportsLanguage(token.lang)) {
        return highlight(token.text, { language: token.lang }) + EOL;
      }
      logError(
        `Language not supported while highlighting code, falling back to markdown: ${token.lang}`,
      );
      return highlight(token.text, { language: 'markdown' }) + EOL;
    case 'codespan':
      return chalk.blue(token.text);
    case 'em':
      return chalk.italic((token.tokens ?? []).map((t: Token) => format(t)).join(''));
    case 'strong':
      return chalk.bold((token.tokens ?? []).map((t: Token) => format(t)).join(''));
    case 'heading':
      switch (token.depth) {
        case 1:
          return (
            chalk.bold.italic.underline((token.tokens ?? []).map((t: Token) => format(t)).join('')) +
            EOL +
            EOL
          );
        case 2:
          return (
            chalk.bold((token.tokens ?? []).map((t: Token) => format(t)).join('')) +
            EOL +
            EOL
          );
        default:
          return (
            chalk.bold.dim((token.tokens ?? []).map((t: Token) => format(t)).join('')) +
            EOL +
            EOL
          );
      }
    case 'hr':
      return '---';
    case 'image':
      return `[Image: ${token.title}: ${token.href}]`;
    case 'link':
      return chalk.blue(token.href);
    case 'list':
      return token.items
        .map((t: Token, index: number) =>
          format(
            t,
            listDepth,
            token.ordered ? (token.start as number) + index : null,
            token,
          ),
        )
        .join('');
    case 'list_item':
      return (token.tokens ?? [])
        .map((t: Token) =>
          `${'  '.repeat(listDepth)}${format(t, listDepth + 1, orderedListNumber, token)}`,
        )
        .join('');
    case 'paragraph':
      return (token.tokens ?? []).map((t: Token) => format(t)).join('') + EOL;
    case 'space':
      return EOL;
    case 'text':
      if (parent?.type === 'list_item') {
        return `${orderedListNumber === null ? '-' : getListNumber(listDepth, orderedListNumber) + '.'} ${
          token.tokens
            ? token.tokens.map((t: Token) => format(t, listDepth, orderedListNumber, token)).join('')
            : token.text
        }${EOL}`;
      }
      return token.text;
  }
  return '';
}

const DEPTH_1_LIST_NUMBERS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'aa',
  'ab',
  'ac',
  'ad',
  'ae',
  'af',
  'ag',
  'ah',
  'ai',
  'aj',
  'ak',
  'al',
  'am',
  'an',
  'ao',
  'ap',
  'aq',
  'ar',
  'as',
  'at',
  'au',
  'av',
  'aw',
  'ax',
  'ay',
  'az',
];

const DEPTH_2_LIST_NUMBERS = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
  'xiii',
  'xiv',
  'xv',
  'xvi',
  'xvii',
  'xviii',
  'xix',
  'xx',
  'xxi',
  'xxii',
  'xxiii',
  'xxiv',
  'xxv',
  'xxvi',
  'xxvii',
  'xxviii',
  'xxix',
  'xxx',
  'xxxi',
  'xxxii',
  'xxxiii',
  'xxxiv',
  'xxxv',
  'xxxvi',
  'xxxvii',
  'xxxviii',
  'xxxix',
  'xl',
];

function getListNumber(listDepth: number, orderedListNumber: number): string {
  switch (listDepth) {
    case 0:
    case 1:
      return orderedListNumber.toString();
    case 2:
      return DEPTH_1_LIST_NUMBERS[orderedListNumber - 1]!;
    case 3:
      return DEPTH_2_LIST_NUMBERS[orderedListNumber - 1]!;
    default:
      return orderedListNumber.toString();
  }
}

export function applyMarkdown(content: string): string {
  return marked
    .lexer(stripSystemMessages(content))
    .map((t: Token) => format(t))
    .join('')
    .trim();
}
