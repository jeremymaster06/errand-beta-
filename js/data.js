/* Demo data + domain logic (pricing, routing, tiers, upsells). No DOM here. */
'use strict';
const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n * 100) / 100).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMin = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min'; };
const TZ = 'America/New_York';
const fmtEnd = iso => new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
const MPH = 16; // suburban average incl. lights

const HOME = { key: 'home', name: 'Home', addr: '25 Grace Ave, Great Neck', lat: 40.7887, lng: -73.7280 };
const HUB = { key: 'hub', name: 'Runner start', addr: 'Great Neck Plaza', lat: 40.7932, lng: -73.7352 };
const PLACES = {
  stopshop: { name: 'Stop & Shop', addr: '65 Cutter Mill Rd', lat: 40.7838, lng: -73.7338, type: 'Groceries' },
  wholefoods: { name: 'Whole Foods Market', addr: 'Lake Success Shopping Ctr', lat: 40.7700, lng: -73.7080, type: 'Groceries' },
  cvs: { name: 'CVS Pharmacy', addr: '40 Middle Neck Rd', lat: 40.7905, lng: -73.7272, type: 'Pharmacy' },
  cleaners: { name: 'Great Neck Cleaners', addr: '110 Middle Neck Rd', lat: 40.7972, lng: -73.7268, type: 'Dry cleaning' },
  ups: { name: 'The UPS Store', addr: '15 Middle Neck Rd', lat: 40.7873, lng: -73.7262, type: 'Returns' },
  usps: { name: 'US Post Office', addr: '1 Welwyn Rd', lat: 40.7998, lng: -73.7290, type: 'Post office' },
  library: { name: 'Great Neck Library', addr: '159 Bayview Ave', lat: 40.8040, lng: -73.7305, type: 'Returns' },
  goodwill: { name: 'Goodwill Donation Center', addr: '350 Northern Blvd', lat: 40.7781, lng: -73.7200, type: 'Drop-off' },
  grandma: { name: 'Grandma', addr: '12 Elm St', lat: 40.8012, lng: -73.7228, type: 'Personal' },
  sister: { name: 'Sister', addr: '88 Middle Neck Rd', lat: 40.7958, lng: -73.7296, type: 'Personal' },
  dana: { name: 'Dana (friend)', addr: '7 Station Plaza', lat: 40.7868, lng: -73.7262, type: 'Personal' },
  office: { name: 'Office', addr: '1 Great Neck Rd', lat: 40.7920, lng: -73.7190, type: 'Personal' },
  framer: { name: 'Gallery Framers', addr: '22 Bond St', lat: 40.7884, lng: -73.7247, type: 'Personal' },
  kingspt: { name: 'Mrs. Alvarez', addr: '4 Kings Point Rd', lat: 40.8090, lng: -73.7400, type: 'Personal' }
};
const TYPES = {
  'Groceries': { ic: 'cart', store: true, dwell: 14 },
  'Dry cleaning': { ic: 'hanger', store: true, dwell: 5 },
  'Returns': { ic: 'ret', store: true, dwell: 6 },
  'Post office': { ic: 'envelope', store: true, dwell: 8 },
  'Pharmacy': { ic: 'pill', store: true, dwell: 10, pro: 'Prescription pickup needs an ID check' },
  'Shopping': { ic: 'bag', store: true, dwell: 10 },
  'Personal pickup': { ic: 'pickup', dwell: 4 },
  'Drop-off': { ic: 'box', dwell: 4 },
  'Custom task': { ic: 'sparkles', dwell: 10 }
};
const HIGH_VALUE = 150;

const RUNNERS = [
  { id: 'maya', name: 'Maya R.', tier: 'pro', type: 'Employee', rating: 4.97, stops: 1284, status: 'available', car: 'Silver Prius · 7KLM204', week: 612, ontime: 97, color: '#C2410C' },
  { id: 'priya', name: 'Priya N.', tier: 'pro', type: 'Employee', rating: 4.99, stops: 1610, status: 'busy', car: 'White Model 3', week: 590, ontime: 98, color: '#0E7490' },
  { id: 'luis', name: 'Luis M.', tier: 'standard', type: 'Gig', rating: 4.91, stops: 412, status: 'available', car: 'Blue Civic', week: 488, ontime: 95, color: '#4D7C0F' },
  { id: 'ana', name: 'Ana P.', tier: 'standard', type: 'Gig', rating: 4.93, stops: 538, status: 'available', car: 'Gray RAV4', week: 455, ontime: 96, color: '#7E22CE' },
  { id: 'tom', name: 'Tom B.', tier: 'standard', type: 'Gig', rating: 4.88, stops: 301, status: 'on job', car: 'Black Jetta', week: 402, ontime: 93, color: '#1D4ED8' },
  { id: 'sam', name: 'Sam W.', tier: 'standard', type: 'Gig', rating: 4.76, stops: 98, status: 'offline', car: 'Red Fit', week: 210, ontime: 90, color: '#BE123C' }
];
const runner = id => RUNNERS.find(r => r.id === id);
const initials = n => n.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

const FAV_LISTS = [
  { id: 'sat', name: 'Saturday Run', when: 'Last run Oct 17', stops: [
    { type: 'Groceries', pid: 'stopshop', items: [{ n: 'Weekly list (12 items)', p: 64.20 }] },
    { type: 'Dry cleaning', pid: 'cleaners', items: [{ n: '3 shirts, 1 suit', p: 28.00 }] },
    { type: 'Returns', pid: 'library', items: [{ n: '2 library books', p: 0 }] }] },
  { id: 'cvs', name: 'Monthly CVS refill', when: 'Next due Nov 2', stops: [{ type: 'Pharmacy', pid: 'cvs', items: [{ n: 'Lisinopril refill (Rx)', p: 12.00 }] }] }
];
const BUNDLES = [
  { id: 'fall', name: 'Fall closet refresh', desc: 'Dry cleaning + Goodwill donation drop-off', places: ['cleaners', 'goodwill'], types: ['Dry cleaning', 'Drop-off'], off: 5, ends: '2026-11-01T23:59:00-05:00' },
  { id: 'ship', name: 'Holiday shipping', desc: 'Post office + UPS returns in one trip', places: ['usps', 'ups'], types: ['Post office', 'Returns'], off: 3, ends: '2026-12-15T17:00:00-05:00' },
  { id: 'summer', name: 'Summer beach run', desc: 'Expired example (hidden)', places: ['stopshop', 'library'], types: ['Groceries', 'Returns'], off: 4, ends: '2026-09-07T23:59:00-04:00' }
];
const HISTORY = [
  { date: 'Oct 19', title: '4 stops · Groceries, CVS, UPS, Mom', total: 78.40, runner: 'maya', saved: 2.10 },
  { date: 'Oct 12', title: '2 stops · Dry cleaning, Post office', total: 24.10, runner: 'luis', saved: 0.00 },
  { date: 'Oct 5', title: '5 stops · Saturday Run', total: 112.75, runner: 'maya', saved: 3.40 }
];

let _sid = 100;
function mkStop(type, pid, extra = {}) { return Object.assign({ id: 's' + (++_sid), type, pid: pid || null, items: [], note: '', from: null, white: false }, extra); }

const S = {
  view: 'c', accent: 'violet', det: {}, open: null,
  c: { screen: 'home', tab: 'home', routeView: 'opt', addFor: null },
  stops: [
    mkStop('Groceries', 'stopshop', { items: [{ n: 'Milk, 1 gal', p: 4.49 }, { n: 'Eggs, dozen', p: 3.99 }, { n: 'Bananas', p: 1.89 }] }),
    mkStop('Personal pickup', 'grandma', { id: 'sGrandma', items: [{ n: 'Blue casserole dish (porch)', p: 0 }], note: 'Under the bench' }),
    mkStop('Drop-off', 'sister', { items: [], note: 'Leave with doorman', from: 'sGrandma' })
  ],
  speed: 'now', when: 'Sat 10:00 AM', tier: 'standard', requestFav: null, cap: null, member: false, dismissed: {},
  trip: null, chat: [['them', "Hi! I'm on my way to the first stop 🙂"]], tip: null, rating: 0,
  favs: ['priya'], weekly: false, ref: { month: 'Oct', sent: [{ n: 'Rachel G.', st: 'credited' }, { n: 'Ben K.', st: 'pending' }], code: 'JEREMY-STOP', credits: 1 }, history: HISTORY.slice(), subs: true,
  r: { tab: 'drive', me: 'maya', online: false, offer: 0, offerT: 30, passed: 0, job: null, stop: 0, done: {}, cashed: false },
  o: { tab: 'overview', support: [['red', '#1040 waiting for runner 6 min', 'Reassign'], ['orange', 'Dana K.: item out of stock, runner asking', 'Join chat'], ['green', 'Refund $4.10 unused spending cap', 'Approve']] },
  jobs: [
    { id: '#1041', cust: 'Dana K.', stops: 5, runner: 'luis', status: 'Shopping', price: 96.20, tier: 'standard' },
    { id: '#1040', cust: 'R. Cohen', stops: 2, runner: null, status: 'Waiting 6 min', price: 22.40, tier: 'standard' },
    { id: '#1039', cust: 'Ari S.', stops: 4, runner: 'tom', status: 'Delivering', price: 71.15, tier: 'standard' },
    { id: '#1038', cust: 'M. Levi', stops: 3, runner: 'priya', status: 'At pharmacy', price: 58.90, tier: 'pro' }
  ],
  pay: { base: 6, perStop: 3.5, perMile: 1.2, perMin: 0.15, servicePct: 8, memberDisc: 20, runnerShare: 80, capPad: 20, instantPct: 1, instantMin: 0.5, freeEvery: 5, rushMult: 1.35, proMult: 1.25, proFlat: 4, proPayBoost: 30 },
  proReq: { rating: 4.9, stops: 500, ontime: 95, training: true }
};

function instantFee(amt) { const p = S.pay; return Math.max(p.instantMin, Math.round(amt * p.instantPct) / 100); }
function placeOf(s) { return s.custom || PLACES[s.pid] || HOME; }
function bundleActive(b, now = new Date()) { return new Date(b.ends) > now; }
function activeBundle(stops) { return BUNDLES.filter(b => bundleActive(b)).find(b => b.places.every(p => stops.some(s => s.pid === p))) || null; }

/* Pharmacy stops need Pro only when they include a prescription (OTC-only baskets don't). */
function hasRx(s) { return s.type === 'Pharmacy' && (s.rx || s.items.some(i => i.rx || /\(Rx\)/.test(i.n))); }
function typePro(s) { const T = TYPES[s.type]; return T.pro && (s.type !== 'Pharmacy' || hasRx(s)) ? T.pro : ''; }
function needsPro(stops) {
  const why = [];
  stops.forEach(s => { const pl = placeOf(s);
    if (typePro(s)) why.push(typePro(s) + ' (' + pl.name + ')');
    if (s.items.some(i => i.p >= HIGH_VALUE)) why.push('High-value item over $' + HIGH_VALUE + ' (' + pl.name + ')');
    if (s.white) why.push('White-glove handling (' + pl.name + ')'); });
  return why;
}

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

/* ---------- Pricing ---------- */
function feeFor(miles, driveMin, ctx) {
  const p = S.pay, n = ctx.stops.length, free = Math.floor(n / p.freeEvery);
  const base = p.base, stopFee = p.perStop * (n - free), dist = p.perMile * miles, time = p.perMin * driveMin;
  const sub = base + stopFee + dist + time;
  const tierAdd = ctx.tier === 'pro' ? sub * (p.proMult - 1) + p.proFlat : 0;
  let fee = sub + tierAdd;
  const rushAdd = ctx.speed === 'rush' ? fee * (p.rushMult - 1) : 0; fee += rushAdd;
  const memberOff = ctx.member ? fee * p.memberDisc / 100 : 0; fee -= memberOff;
  const b = activeBundle(ctx.stops), bundleOff = b ? Math.min(b.off, fee * .5) : 0; fee -= bundleOff;
  const platform = fee * p.servicePct / 100;
  return { base, stopFee, freeStops: free, freeValue: free * p.perStop, dist, time, tierAdd, rushAdd, memberOff, bundle: b, bundleOff, fee, platform, service: fee + platform };
}
function quote(o = {}) {
  const ctx = { stops: o.stops || S.stops, tier: o.tier || S.tier, speed: o.speed || S.speed, member: o.member == null ? S.member : o.member };
  const r = computeRoute(ctx.stops);
  const f = feeFor(r.miles, r.driveMin, ctx), fe = feeFor(r.enteredMiles, r.enteredDrive, ctx);
  const goods = ctx.stops.reduce((a, s) => a + s.items.reduce((b, i) => b + (+i.p || 0), 0), 0);
  const suggested = goods > 0 ? Math.ceil((goods * (1 + S.pay.capPad / 100)) / 5) * 5 : 0;
  const cap = o.stops ? suggested : (S.cap == null ? suggested : S.cap);
  const n = ctx.stops.length;
  return { route: r, f, goods, suggested, cap, total: f.service + cap, refund: Math.max(0, cap - goods),
    save: { usd: Math.max(0, fe.service - f.service), min: Math.max(0, r.enteredDrive - r.driveMin), mi: Math.max(0, r.enteredMiles - r.miles) },
    separate: { usd: n * 7.99, min: n * 22 }, eta: Math.round(r.mins * (ctx.speed === 'rush' ? .7 : 1) + 8) };
}
function marginal(newStops) { const a = quote(), b = quote({ stops: S.stops.concat(newStops) }); return { usd: b.f.service - a.f.service, min: b.route.mins - a.route.mins }; }
function routeSuggestions() {
  const have = new Set(S.stops.map(s => s.pid));
  return Object.entries(PLACES).filter(([k, p]) => p.type !== 'Personal' && !have.has(k) && !S.dismissed['p_' + k])
    .map(([k, p]) => { const type = p.type === 'Drop-off' ? 'Drop-off' : p.type; const m = marginal([mkStop(type, k)]); return { k, p, type, m }; })
    .sort((a, b) => a.m.usd - b.m.usd).slice(0, 3);
}
/* Who would get the trip: requested favorite if available and qualified; else best available qualified runner. */
function matchRunner(tier, fav) {
  const ok = r => r.status === 'available' && (tier !== 'pro' || r.tier === 'pro');
  const f = fav && runner(fav);
  if (f && ok(f)) return { r: f, fav: true };
  const best = RUNNERS.filter(ok).sort((a, b) => b.rating - a.rating)[0] || RUNNERS[0];
  return { r: best, fav: false, favUnavailable: f ? (f.status !== 'available' ? f.name.split(' ')[0] + ' is ' + (f.status === 'busy' || f.status === 'on job' ? 'on another trip' : 'offline') : f.name.split(' ')[0] + ' is not a Pro runner') : null };
}
function proProgress(r) {
  const q = S.proReq; return [
    { k: 'Rating', v: r.rating.toFixed(2), need: '≥ ' + q.rating.toFixed(2), p: Math.min(1, r.rating / q.rating), ok: r.rating >= q.rating },
    { k: 'Completed stops', v: r.stops.toLocaleString(), need: '≥ ' + q.stops, p: Math.min(1, r.stops / q.stops), ok: r.stops >= q.stops },
    { k: 'On-time rate', v: r.ontime + '%', need: '≥ ' + q.ontime + '%', p: Math.min(1, r.ontime / q.ontime), ok: r.ontime >= q.ontime },
    { k: 'ID & Rx handling course', v: r.tier === 'pro' ? 'Done' : 'Not started', need: 'Required', p: r.tier === 'pro' ? 1 : 0, ok: r.tier === 'pro' }];
}
if (typeof module !== 'undefined') module.exports = { S, quote, computeRoute };
