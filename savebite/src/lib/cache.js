import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { isNetworkError } from "./network";

const PREFIX = "cache:v1:";
let namespace = "anon"; // one cache per signed-in user, so accounts never see each other's data

export const setCacheNamespace = (userId) => { namespace = String(userId || "anon"); };
const keyOf = (path) => `${PREFIX}${namespace}:${path}`;

export async function readCache(path) {
  try {
    const raw = await AsyncStorage.getItem(keyOf(path));
    return raw ? JSON.parse(raw) : null; // { t: savedAtMs, data }
  } catch { return null; }
}

export async function writeCache(path, data) {
  try { await AsyncStorage.setItem(keyOf(path), JSON.stringify({ t: Date.now(), data })); } catch {}
}

// call on logout
export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {}
}

/**
 * Use instead of api() for GET requests.
 * Online  -> fetches normally and saves the answer on the phone.
 * Offline -> returns the last saved answer (with __stale: true) instead of failing.
 */
export async function cachedApi(path, opts = {}) {
  try {
    const res = await api(path, opts);
    writeCache(path, res);
    return res;
  } catch (e) {
    if (isNetworkError(e)) {
      const hit = await readCache(path);
      if (hit) return { ...hit.data, __stale: true, __cachedAt: hit.t };
    }
    throw e;
  }
}
