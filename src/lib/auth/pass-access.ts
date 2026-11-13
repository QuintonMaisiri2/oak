import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const PASS_ACCESS_COOKIE = 'oak_pass_access';
export const PASS_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

export function signPassAccess(eventCode: string, secret: string, expires = Math.floor(Date.now() / 1000) + PASS_ACCESS_MAX_AGE): string {
  const payload = `${eventCode}.${expires}`;
  const signature = createHmac('sha256', secret).update(`pass-access:${payload}`).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyPassAccess(token: string | undefined, eventCode: string): boolean {
  const secret = process.env.REGISTRATION_RPC_SECRET;
  if (!secret || secret.length < 32 || !token || token.length > 256) return false;
  const [code, expiry, signature, extra] = token.split('.');
  if (extra !== undefined || code !== eventCode || !/^\d+$/.test(expiry || '') || Number(expiry) <= Date.now() / 1000 || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected = signPassAccess(code, secret, Number(expiry)).split('.')[2];
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
