import crypto from 'crypto';

// 4-digit transaction PIN, stored as salted scrypt hash (built into Node, no extra package).
const derive = (pin, salt) =>
  new Promise((resolve, reject) => crypto.scrypt(String(pin), salt, 32, (e, key) => (e ? reject(e) : resolve(key))));

export async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(pin, salt)).toString('hex')}`;
}

export async function checkPin(pin, stored) {
  const [saltHex, keyHex] = String(stored || '').split(':');
  if (!saltHex || !keyHex) return false;
  const key = await derive(pin, Buffer.from(saltHex, 'hex'));
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin ?? ''));