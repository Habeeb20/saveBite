import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, ApiError } from "./api";
import { uploadImages } from "./cloudinary";
import { checkOnline, statusOf } from "./network";

/**
 * The outbox: every change the user makes (like, comment, message, post, cart...) goes through
 * mutate(). If the phone is offline - or the request fails because the connection drops - the change
 * is saved on the phone and sent later, in order, when the network is back.
 * Every request carries ?idem=<id> so the server ignores a repeat if the first one actually got through.
 */

const KEY = "outbox:v1";
const MAX_TRIES = 6;

let ns = "anon";
let queue = null; // [{ id, kind, method, path, body, uploads, dedupeKey, tries, createdAt }]
let running = null;
let inFlightId = null;
const outcomes = new Map(); // id -> { ok, result } | { ok:false, error }
const awaited = new Set(); // ids a screen is waiting on (so we don't also pop a global alert)
const listeners = new Set();

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const storeKey = () => `${KEY}:${ns}`;

export const setOutboxNamespace = (id) => {
  const next = String(id || "anon");
  if (next !== ns) { ns = next; queue = null; }
};

async function load() {
  if (queue) return queue;
  try { queue = JSON.parse(await AsyncStorage.getItem(storeKey())) ?? []; } catch { queue = []; }
  return queue;
}
const persist = () => AsyncStorage.setItem(storeKey(), JSON.stringify(queue)).catch(() => {});
const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch {} });

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const pendingCount = async () => (await load()).length;
export const hasPending = async (kindPrefix) => (await load()).some((a) => a.kind.startsWith(kindPrefix));

// forget queued changes that a newer one makes pointless (e.g. "clear cart" cancels earlier cart edits)
export async function dropWhere(test) {
  await load();
  queue = queue.filter((a) => a.id === inFlightId || !test(a));
  await persist();
  emit({ type: "queued" });
}

export async function enqueue(action) {
  await load();
  const entry = { id: uid(), tries: 0, createdAt: Date.now(), method: "POST", ...action };
  // same dedupeKey = only the latest wish counts (like then unlike offline -> just "unliked")
  if (entry.dedupeKey) queue = queue.filter((a) => a.id === inFlightId || a.dedupeKey !== entry.dedupeKey);
  queue.push(entry);
  await persist();
  emit({ type: "queued", entry });
  return entry;
}

async function run(a) {
  let body = a.body;
  if (a.uploads?.length) {
    // photos picked offline are uploaded now, then replaced by their URLs (so a retry won't re-upload)
    body = { ...(body || {}) };
    for (const u of a.uploads) {
      const uploaded = await uploadImages(u.assets);
      body[u.field] = [...(body[u.field] || []), ...uploaded];
    }
    a.body = body;
    a.uploads = [];
    await persist();
  }
  const sep = a.path.includes("?") ? "&" : "?";
  return api(`${a.path}${sep}idem=${a.id}`, { method: a.method, auth: true, body });
}

const rejected = (e) => {
  const s = statusOf(e);
  return e instanceof ApiError && s && s < 500 && s !== 408 && s !== 429; // the server said "no" for good
};

/** Send everything waiting, oldest first. Stops at the first problem so order is kept. */
export function flush() {
  if (running) return running;
  running = (async () => {
    await load();
    let synced = 0;
    while (queue.length) {
      if (!(await checkOnline())) break;
      const a = queue[0];
      inFlightId = a.id;
      try {
        const result = await run(a);
        outcomes.set(a.id, { ok: true, result });
        queue.shift();
        synced += 1;
        await persist();
        emit({ type: "done", entry: a, result });
      } catch (e) {
        const giveUp = () => {
          outcomes.set(a.id, { ok: false, error: e });
          queue.shift();
          emit({ type: "failed", entry: a, error: e, silent: awaited.has(a.id) });
        };
        if (rejected(e)) { giveUp(); await persist(); continue; }
        if (!(await checkOnline())) break; // just offline: keep it and wait
        a.tries = (a.tries || 0) + 1; // online but it still failed (server hiccup)
        if (a.tries >= MAX_TRIES) { giveUp(); await persist(); continue; }
        await persist();
        break;
      } finally {
        inFlightId = null;
      }
    }
    if (synced) emit({ type: "synced", count: synced });
    emit({ type: "idle" });
  })().finally(() => { running = null; });
  return running;
}

/**
 * Do a change now if we can, otherwise save it for later.
 *   { queued: false, result }  it went through
 *   { queued: true }           saved on the phone, will be sent when online
 * Throws the server's error if it rejected the change (so the screen can undo its optimistic update).
 */
export async function mutate(action) {
  const entry = await enqueue(action);
  awaited.add(entry.id);
  try {
    if (await checkOnline()) await flush();
    const o = outcomes.get(entry.id);
    if (o) {
      outcomes.delete(entry.id);
      if (o.ok) return { queued: false, result: o.result };
      throw o.error;
    }
    return { queued: true };
  } finally {
    awaited.delete(entry.id);
  }
}
