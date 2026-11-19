import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";

// On-device lock: a 6-digit PIN (stored only as a salted hash in the phone's secure storage) and
// optionally fingerprint / Face ID. Nothing here needs internet.

const key = (userId, name) => `lock.${userId}.${name}`;
const listeners = new Set();
export const onLockChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((f) => f());

export const PIN_LENGTH = 6;
export const MAX_FAILS = 10; // after this many wrong PINs the user must sign in again

const hash = (salt, pin) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function getLockConfig(userId) {
  const [pin, bio] = await Promise.all([
    SecureStore.getItemAsync(key(userId, "pin")),
    SecureStore.getItemAsync(key(userId, "bio")),
  ]);
  return { hasPin: !!pin, biometric: bio === "1" };
}

export async function setPin(userId, pin) {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  await SecureStore.setItemAsync(key(userId, "pin"), JSON.stringify({ salt, h: await hash(salt, pin) }));
  await SecureStore.deleteItemAsync(key(userId, "fails"));
  notify();
}

async function failState(userId) {
  try { return JSON.parse((await SecureStore.getItemAsync(key(userId, "fails"))) || "") ?? { count: 0, until: 0 }; }
  catch { return { count: 0, until: 0 }; }
}

// -> { ok } | { ok:false, left, wait (seconds), tooMany }
export async function verifyPin(userId, pin) {
  const st = await failState(userId);
  if (st.until > Date.now()) return { ok: false, wait: Math.ceil((st.until - Date.now()) / 1000), left: Math.max(0, MAX_FAILS - st.count) };

  const raw = await SecureStore.getItemAsync(key(userId, "pin"));
  if (!raw) return { ok: true };
  const { salt, h } = JSON.parse(raw);
  if ((await hash(salt, pin)) === h) {
    await SecureStore.deleteItemAsync(key(userId, "fails"));
    return { ok: true };
  }

  const count = st.count + 1;
  const until = count >= 5 ? Date.now() + Math.min(30 * 2 ** (count - 5), 600) * 1000 : 0; // 30s, 60s, 2min...
  await SecureStore.setItemAsync(key(userId, "fails"), JSON.stringify({ count, until }));
  return { ok: false, left: Math.max(0, MAX_FAILS - count), wait: until ? Math.ceil((until - Date.now()) / 1000) : 0, tooMany: count >= MAX_FAILS };
}

export async function biometricSupported() {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); }
  catch { return false; }
}

export async function setBiometric(userId, on) {
  await SecureStore.setItemAsync(key(userId, "bio"), on ? "1" : "0");
  notify();
}

export async function authenticateBiometric() {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock SaveBite", cancelLabel: "Use PIN" });
    return !!r.success;
  } catch { return false; }
}

export async function removeLock(userId) {
  await Promise.all(["pin", "bio", "fails"].map((n) => SecureStore.deleteItemAsync(key(userId, n)).catch(() => {})));
  notify();
}
