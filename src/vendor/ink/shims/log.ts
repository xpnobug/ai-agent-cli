// @ts-nocheck
/**
 * utils/log shim
 */

export function logError(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'test') {
    console.error(...args);
  }
}
