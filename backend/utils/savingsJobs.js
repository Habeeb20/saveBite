import { runDueAutoSaves } from '../services/savings.js';

// Call once after MongoDB is connected:  startSavingsJob();
export function startSavingsJob({ everyMs = 5 * 60 * 1000 } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runDueAutoSaves();
      if (r.saved || r.missed) console.log(`[savings] auto-save: ${r.saved} saved, ${r.missed} missed`);
    } catch (e) {
      console.error('[savings] job error:', e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 30 * 1000);
  return setInterval(tick, everyMs);
}