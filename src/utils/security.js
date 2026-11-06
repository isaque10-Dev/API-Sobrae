import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored || '')) return false;
  const [, salt, encoded] = stored.split('$');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(hash, Buffer.from(encoded, 'hex'));
}
export const newToken = () => randomBytes(32).toString('hex');
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
