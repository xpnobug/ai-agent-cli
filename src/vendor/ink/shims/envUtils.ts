// @ts-nocheck
/**
 * utils/envUtils shim
 */

export function isEnvTruthy(key: string): boolean {
  return process.env[key] === '1' || process.env[key] === 'true';
}
