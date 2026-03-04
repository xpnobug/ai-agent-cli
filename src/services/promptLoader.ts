import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = new Map<string, string>();

function resolvePromptPath(relativePath: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    path.resolve(__dirname, '../prompts', relativePath), // src/services -> src/prompts
    path.resolve(__dirname, '../../prompts', relativePath), // dist/services -> dist/prompts
    path.resolve(process.cwd(), 'src/prompts', relativePath),
    path.resolve(process.cwd(), 'dist/prompts', relativePath),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(`Prompt file not found: ${relativePath}`);
}

export function loadPrompt(relativePath: string): string {
  const fullPath = resolvePromptPath(relativePath);
  if (cache.has(fullPath)) return cache.get(fullPath)!;
  const content = fs.readFileSync(fullPath, 'utf-8');
  cache.set(fullPath, content);
  return content;
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function loadPromptWithVars(relativePath: string, vars: Record<string, string>): string {
  return renderPrompt(loadPrompt(relativePath), vars);
}
