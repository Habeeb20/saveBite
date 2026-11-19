import { readFileSync } from 'fs';

// Looks a data / TV plan up by its `coded` value in YOUR plan files, so the PRICE always comes
// from the server and never from what the phone sends.
const FILES = ['mtn', 'airtel', 'glo', '9mobile', 'dstv', 'gotv', 'startimes', 'showmax', 'electricity'];

const load = (name) => {
  try { return JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8')); }
  catch { return []; }
};

const index = new Map();
for (const f of FILES) for (const p of load(f)) if (p?.coded && p.status !== 0) index.set(String(p.coded), p);

export const findPlan = (coded) => index.get(String(coded)) ?? null;