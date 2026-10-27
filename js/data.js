/* Demo data + domain logic (pricing, routing, upsells). No DOM here. */
'use strict';
const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n * 100) / 100).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMin = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min'; };
const TZ = 'America/New_York';
const MPH = 16; // suburban average incl. lights

/* Map centre / default drop-off until the customer enters their own address (no saved address is seeded). */
const HOME = { key: 'home', name: 'Your drop-off', addr: 'Set at checkout', lat: 40.7887, lng: -73.7280 };
const HUB = { key: 'hub', name: 'Runner start', addr: 'Great Neck Plaza', lat: 40.7932, lng: -73.7352 };
const PLACES = {
  stopshop: { name: 'Stop & Shop', addr: '65 Cutter Mill Rd', lat: 40.7838, lng: -73.7338, type: 'Groceries' },
  wholefoods: { name: 'Whole Foods Market', addr: 'Lake Success Shopping Ctr', lat: 40.7700, lng: -73.7080, type: 'Groceries' },
  cvs: { name: 'CVS Pharmacy', addr: '40 Middle Neck Rd', lat: 40.7905, lng: -73.7272, type: 'Pharmacy' },
  cleaners: { name: 'Great Neck Cleaners', addr: '110 Middle Neck Rd', lat: 40.7972, lng: -73.7268, type: 'Dry cleaning' },
  ups: { name: 'The UPS Store', addr: '15 Middle Neck Rd', lat: 40.7873, lng: -73.7262, type: 'Returns' },
  usps: { name: 'US Post Office', addr: '1 Welwyn Rd', lat: 40.7998, lng: -73.7290, type: 'Post office' },
  library: { name: 'Great Neck Library', addr: '159 Bayview Ave', lat: 40.8040, lng: -73.7305, type: 'Returns' },
  goodwill: { name: 'Goodwill Donation Center', addr: '350 Northern Blvd', lat: 40.7781, lng: -73.7200, type: 'Drop-off' }
};
const TYPES = {
  'Groceries': { ic: 'cart', store: true, dwell: 14 },
  'Dry cleaning': { ic: 'hanger', store: true, dwell: 5 },
  'Returns': { ic: 'ret', store: true, dwell: 6 },
  'Post office': { ic: 'envelope', store: true, dwell: 8 },
  'Pharmacy': { ic: 'pill', store: true, dwell: 10 },
  'Shopping': { ic: 'bag', store: true, dwell: 10 },
  'Personal pickup': { ic: 'pickup', dwell: 4 },
  'Drop-off': { ic: 'box', dwell: 4 },
  'Custom task': { ic: 'sparkles', dwell: 10 }
};


let _sid = 100;
function mkStop(type, pid, extra = {}) { return Object.assign({ id: 's' + (++_sid), type, pid: pid || null, items: [], note: '', from: null }, extra); }

const S = {
  view: 'c', accent: 'violet', det: {}, open: null,
  c: { screen: 'home', tab: 'home' },
  stops: [],
  timing: 'asap', when: SETTINGS.timing.scheduledWindows[0][0], cap: null,
  trip: null, history: [], subs: true,
  r: { tab: 'drive', online: false, job: null },
  o: { tab: 'overview', support: [] },
  line: null, // Hold My Spot booking (js/line.js)
  pay: { capPad: SETTINGS.pricing.capPadPct, method: null }
};

function placeOf(s) { return s.custom || PLACES[s.pid] || HOME; }


/* ---------- Routing ---------- */
const _rc = new Map();
function computeRoute(stops, start = HUB, end = HOME) {
  const key = JSON.stringify([stops.map(s => [s.id, placeOf(s).lat, placeOf(s).lng, s.from]), start.lat, end && end.lat]);
  if (_rc.has(key)) return _rc.get(key);
  const pts = stops.map(placeOf), M = RouteSolver.buildMatrix(pts, start, end);
  const idx = new Map(stops.map((s, i) => [s.id, i]));
  const prec = stops.filter(s => s.from && idx.has(s.from)).map(s => [idx.get(s.from), idx.get(s.id)]);
  const sol = RouteSolver.solve(M, prec);
  const typed = [...stops.keys()], feasibleTyped = RouteSolver.isFeasible(typed, prec);
  const entered = RouteSolver.repairOrder(typed, prec);
  const enteredMiles = RouteSolver.routeCost(entered, M);
  const dwell = stops.reduce((a, s) => a + TYPES[s.type].dwell, 0);
  const r = { order: sol.order, exact: sol.exact, prec, miles: sol.cost, driveMin: sol.cost / MPH * 60, dwell, mins: sol.cost / MPH * 60 + dwell,
    entered, enteredMiles, enteredDrive: enteredMiles / MPH * 60, enteredFixed: !feasibleTyped, n: stops.length };
  _rc.set(key, r); if (_rc.size > 300) _rc.delete(_rc.keys().next().value);
  return r;
}

/* ---------- Pricing: Adam's engine v4 (js/pricing.js, verbatim) ----------
   PROTOTYPE: computed in the browser for display only. The real build prices on the server and re-verifies at payment.
   Editing: miles are the solver's straight-line estimate ("est."). On review, the Google Routes road distance and drive
   time replace them. The real Routes drive time is passed straight to the engine's drive_minutes input. */
const ENGINE_TYPE = { Groceries: 'grocery', Pharmacy: 'pharmacy', Returns: 'return', 'Post office': 'post_office' }; // all other stop types -> 'pickup'
function engineStop(s) {
  const type = ENGINE_TYPE[s.type] || 'pickup';
  if (type !== 'grocery') return { type };
  const k = s.items.reduce((a, i) => a + (+i.q || 1), 0);
  return { type, items: k }; // empty grocery stop starts at 0 items (Adam Q2)
}
function stopsSig(stops) { return JSON.stringify(stops.map(s => [s.id, s.type, placeOf(s).lat, placeOf(s).lng, s.items.map(i => [i.n, i.q, i.p]), s.from])); }
/* timing: 'flex' lets dispatch batch the order, passed to the engine as its batch_share input.
   A standalone drop-off is priced at the settings price (engine price_override), so its margin stays honest. */
function engineInputs(stops, miles, real, timing) {
  const n = stops.length, goods = stops.reduce((a, s) => a + s.items.reduce((b, i) => b + (+i.p || 0), 0), 0);
  const inp = { ...SETTINGS.pricing.engine, stop_list: stops.map(engineStop), miles: Math.round(miles * 100) / 100, basket_per_stop: n ? goods / n : 0 };
  if (timing === 'flex') inp.batch_share = SETTINGS.timing.flexBatchShare;
  if (ORD.isStandaloneDropoff(stops)) inp.price_override = SETTINGS.dropoff.standalonePrice;
  if (real && real.min > 0) inp.drive_minutes = real.min; // real Google Routes drive time (engine drive_minutes input)
  return inp; // weather, busy_fee (demand), tolls, tip, dropoff, staffing...: spec defaults
}
function quote(o = {}) {
  const stops = o.stops || S.stops, r = computeRoute(stops), n = stops.length;
  const real = !o.stops && S.realRoute && S.realRoute.sig === stopsSig(stops) ? S.realRoute : null;
  const miles = real ? real.mi : r.miles;
  /* ESTIMATE ONLY. This runs Adam's engine (js/pricing.js, unmodified) in the browser for display.
     The final price is set by the server, which recomputes the quote from validated inputs; any
     client-sent price, fee, discount or cap must be ignored (Shield F1 / C1). */
  const timing = ORD.mode(stops, o.timing || S.timing), standalone = ORD.isStandaloneDropoff(stops);
  const e = n ? PricingEngine.quote(engineInputs(stops, miles, real, timing)) : null;
  const eEntered = n && !real ? PricingEngine.quote(engineInputs(stops, r.enteredMiles, null, timing)) : e;
  const asapPrice = timing === 'flex' && n && !standalone ? PricingEngine.quote(engineInputs(stops, miles, real, 'asap')).price : null;
  const price = e ? e.price : 0;
  const goods = stops.reduce((a, s) => a + s.items.reduce((b, i) => b + (+i.p || 0), 0), 0);
  const suggested = goods > 0 ? Math.ceil((goods * (1 + S.pay.capPad / 100)) / 5) * 5 : 0;
  const cap = o.stops ? suggested : (S.cap == null ? suggested : S.cap);
  return { route: r, e, est: !real, miles, timing, when: S.when, standalone, flexSave: asapPrice == null ? 0 : Math.max(0, asapPrice - price), f: { service: price, fee: price }, goods, suggested, cap, total: price + cap, refund: Math.max(0, cap - goods),
    save: { usd: Math.max(0, (eEntered ? eEntered.price : 0) - price), min: Math.max(0, r.enteredDrive - r.driveMin), mi: Math.max(0, r.enteredMiles - r.miles) },
    eta: Math.round(e ? e.minutes : r.mins) };
}
function marginal(newStops) { const a = quote(), b = quote({ stops: S.stops.concat(newStops) }); return { usd: b.f.service - a.f.service, min: b.route.mins - a.route.mins }; }
function routeSuggestions() {
  const have = new Set(S.stops.map(s => s.pid));
  return Object.entries(PLACES).filter(([k, p]) => p.type !== 'Personal' && !have.has(k))
    .map(([k, p]) => { const type = p.type === 'Drop-off' ? 'Drop-off' : p.type; const m = marginal([mkStop(type, k)]); return { k, p, type, m }; })
    .sort((a, b) => a.m.usd - b.m.usd).slice(0, 3);
}
/* Who would get the trip: requested favorite if available and qualified; else best available qualified runner. */
if (typeof module !== 'undefined') module.exports = { S, quote, computeRoute };

/* Shared order store for the three apps (/customer/, /runner/, /owner/). They are separate pages on one
   origin, so orders live in same-origin localStorage and the 'storage' event pushes changes to the other
   open apps. PROTOTYPE ONLY: a stand-in for the real backend. Production keeps orders and addresses on the
   server, not in browser storage (see SECURITY_COST_CHECKLIST.md). */
const Store = {
  KEY: 'errand.shared.v1', last: '',
  pick() { return JSON.stringify({ trip: S.trip, line: S.line, history: S.history, online: S.r.online, weekly: S.weekly || null, rt: S.rt || null }); },
  save() { const j = this.pick(); if (j === this.last) return; this.last = j; try { localStorage.setItem(this.KEY, j); } catch (e) { } },
  load() {
    let j = null; try { j = localStorage.getItem(this.KEY); } catch (e) { }
    if (!j) return false; let d; try { d = JSON.parse(j); } catch (e) { return false; }
    S.trip = d.trip || null; S.line = d.line || null; S.history = Array.isArray(d.history) ? d.history : []; S.r.online = !!d.online; S.weekly = d.weekly || null; S.rt = d.rt || null;
    this.last = j; return true;
  },
  listen() { window.addEventListener('storage', e => { if (e.key === this.KEY && this.load()) R(); }); }
};
