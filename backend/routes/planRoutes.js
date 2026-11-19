import express from 'express';
import { readFileSync } from 'fs';

const router = express.Router();

// JSON files live in ../data relative to this file.
// (__dirname doesn't exist in ES modules, so resolve paths from import.meta.url.)
const loadJSON = (name) =>
  JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

// Loaded once at startup, so requests are served from memory.
const SERVICES = {
  // data
  mtn:         { type: 'data',        label: 'MTN',         plans: loadJSON('mtn') },
  airtel:      { type: 'data',        label: 'Airtel',      plans: loadJSON('airtel') },
  glo:         { type: 'data',        label: 'Glo',         plans: loadJSON('glo') },
  '9mobile':   { type: 'data',        label: '9mobile',     plans: loadJSON('9mobile') },
  // cable tv
  dstv:        { type: 'tv',          label: 'DStv',        plans: loadJSON('dstv') },
  gotv:        { type: 'tv',          label: 'GOtv',        plans: loadJSON('gotv') },
  startimes:   { type: 'tv',          label: 'Startimes',   plans: loadJSON('startimes') },
  showmax:     { type: 'tv',          label: 'Showmax',     plans: loadJSON('showmax') },
  // electricity
  electricity: { type: 'electricity', label: 'Electricity', plans: loadJSON('electricity') },
};

// GET /api/plans
// Lightweight index: which services exist, so the frontend can build menus
// without downloading any plans.
router.get('/', (req, res) => {
  const services = Object.entries(SERVICES).map(([key, s]) => ({
    key,
    label: s.label,
    type: s.type,
    count: s.plans.filter((p) => p.status === 1).length,
  }));
  res.json({ success: true, services });
});

// GET /api/plans/type/:type   (data | tv | electricity)
// Every service of one type, e.g. all four networks in one call.
router.get('/type/:type', (req, res) => {
  const type = req.params.type.toLowerCase();
  const matches = Object.entries(SERVICES).filter(([, s]) => s.type === type);
  if (!matches.length) {
    return res.status(404).json({ success: false, message: `Unknown type "${req.params.type}"` });
  }
  const data = {};
  for (const [key, s] of matches) data[key] = filter(s.plans, req.query);
  res.json({ success: true, type, data });
});

// GET /api/plans/:service?category=SME&minPrice=100&maxPrice=5000&search=1gb&includeInactive=true
router.get('/:service', (req, res) => {
  const key = req.params.service.toLowerCase();
  const service = SERVICES[key];
  if (!service) {
    return res.status(404).json({
      success: false,
      message: `Unknown service "${req.params.service}"`,
      available: Object.keys(SERVICES),
    });
  }
  const plans = filter(service.plans, req.query);
  res.json({ success: true, service: key, type: service.type, count: plans.length, plans });
});

function filter(plans, q) {
  let out = plans;
  if (q.includeInactive !== 'true') out = out.filter((p) => p.status === 1);
  if (q.category) {
    const c = String(q.category).toUpperCase();
    out = out.filter((p) => String(p.category || '').toUpperCase() === c);
  }
  if (q.server) out = out.filter((p) => String(p.server) === String(q.server));
  if (q.minPrice) out = out.filter((p) => p.price >= Number(q.minPrice));
  if (q.maxPrice) out = out.filter((p) => p.price <= Number(q.maxPrice));
  if (q.search) {
    const s = String(q.search).toLowerCase();
    out = out.filter((p) => p.name.toLowerCase().includes(s));
  }
  return out;
}

export default router;