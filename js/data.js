'use strict';
const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n * 100) / 100).toFixed(2);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMin = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60 ? (m % 60) + ' min' : '') : m + ' min'; };
const TZ = 'America/New_York';
const MPH = 16;
const HOME = { key: 'home', name: 'Home', addr: 'Add your address', lat: 40.7887, lng: -73.7280, unset: true };
const HUB = { key: 'hub', name: 'Runner start', addr: 'Great Neck Plaza', lat: 40.7932, lng: -73.7352 };
const PLACES = {
  stopshop: { name: 'Stop & Shop', addr: '65 Shore Rd, Port Washington', lat: 40.8275, lng: -73.6975, type: 'Groceries' },
  wholefoods: { name: 'Whole Foods Market', addr: '2101 Northern Blvd, Manhasset', lat: 40.7907, lng: -73.6949, type: 'Groceries' },
  nsfarms: { name: 'North Shore Farms', addr: '90 Horace Harding Blvd, Great Neck', lat: 40.7608, lng: -73.7213, type: 'Groceries' },
  cvs: { name: 'CVS Pharmacy', addr: '510 Middle Neck Rd', lat: 40.8003, lng: -73.7344, type: 'Pharmacy' },
  cleaners: { name: 'Nu-Clear Drive-in Cleaners', addr: '172 Middle Neck Rd', lat: 40.7958, lng: -73.7290, type: 'Dry cleaning' },
  ups: { name: 'The UPS Store', addr: '10 Bond St', lat: 40.7885, lng: -73.7250, type: 'Returns' },
  usps: { name: 'Great Neck Post Office', addr: '1 Welwyn Rd', lat: 40.7998, lng: -73.7290, type: 'Post office' }
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
  view: 'c', det: {}, open: null,
  c: { screen: 'home', tab: 'home' },
  stops: [],
  timing: 'scheduled', when: null, cap: null,
  trip: null, history: [], subs: true, dest: null, prefs: { home: null }, notes: [], support: [], runners: {}, subLog: [],
  r: { tab: 'drive', id: null, job: null },
  o: { tab: 'overview', support: [] },
  line: null,
  pay: { capPad: SETTINGS.pricing.capPadPct, method: null }
};
function placeOf(s) { return s.custom || PLACES[s.pid] || HOME; }
function homePlace() { const h = S.prefs && S.prefs.home; return h ? { key: 'home', name: 'Home', addr: h.addr, lat: h.lat, lng: h.lng, home: true } : HOME; }
function destOf() { return S.dest || homePlace(); }
const _rc = new Map();
function computeRoute(stops, start = HUB, end = destOf()) {
  const key = JSON.stringify([stops.map(s => [s.id, placeOf(s).lat, placeOf(s).lng, s.from]), start.lat, start.lng, end && end.lat, end && end.lng]);
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
const ENGINE_TYPE = { Groceries: 'grocery', Pharmacy: 'pharmacy', Returns: 'return', 'Post office': 'post_office' };
function engineStop(s) {
  const type = ENGINE_TYPE[s.type] || 'pickup';
  if (type !== 'grocery') return { type };
  const k = s.items.reduce((a, i) => a + (+i.q || 1), 0);
  return { type, items: k };
}
function stopsSig(stops) { return JSON.stringify(stops.map(s => [s.id, s.type, placeOf(s).lat, placeOf(s).lng, s.items.map(i => [i.n, i.q, i.p]), s.from])); }
function engineInputs(stops, miles, real, timing) {
  const n = stops.length, goods = stops.reduce((a, s) => a + s.items.reduce((b, i) => b + (+i.p || 0), 0), 0);
  const inp = { ...SETTINGS.pricing.engine, stop_list: stops.map(engineStop), miles: Math.round(miles * 100) / 100, basket_per_stop: n ? goods / n : 0 };
  if (timing === 'flex') inp.batch_share = SETTINGS.timing.flexBatchShare;
  if (real && real.min > 0) inp.drive_minutes = real.min;
  return inp;
}
const RATE_KEYS = SETTINGS.rates.fields.map(f => f[0]);
function cleanRates(x) {
  if (!x || typeof x !== 'object') return null;
  const o = {}; for (const k of RATE_KEYS) { const v = +x[k]; o[k] = x[k] !== '' && x[k] != null && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null; }
  return o;
}
const ratesOk = r => !!r && r.base > 0;
const lineOk = r => !!r && !!r.rates && r.rates.lineHourly > 0;
const subActive = r => !!r && !!r.sub && r.sub.status === 'active';
const runnerPriced = r => !!r && (r.pricing === 'engine' || (r.pricing === 'own' && ratesOk(r.rates)));
const runnerReady = r => runnerPriced(r) && subActive(r);
const AREA = k => { const a = SETTINGS.areas.find(x => x[0] === k) || SETTINGS.areas[0]; return { key: a[0], name: a[1], lat: a[2], lng: a[3] }; };
const tierOf = k => SETTINGS.plan.tiers.find(t => t.key === k) || SETTINGS.plan.tiers[0];
const subFor = r => subActive(r) ? tierOf(r.sub.tier) : null;
const monthKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7);
const jobsThisMonth = r => ((r && r.jobLog) || []).filter(t => monthKey(t) === monthKey()).length;
function planUsage(r, now = Date.now()) {
  const P = SETTINGS.plan, T = subFor(r), from = (r && (r.trialFrom || (r.sub && r.sub.since))) || now, log = ((r && r.jobLog) || []).filter(t => t >= from).sort((a, b) => a - b);
  const weekEnd = from + P.pilotWeeks * 7 * 864e5, trialEnd = log.length >= P.pilotJobs ? Math.min(weekEnd, log[P.pilotJobs - 1]) : weekEnd;
  const free = log.filter(t => t <= trialEnd).length, inTrial = now < trialEnd && free < P.pilotJobs, mk = monthKey(now);
  const jobs = inTrial ? 0 : log.filter(t => t > trialEnd && monthKey(t) === mk).length, i = T ? P.tiers.indexOf(T) : -1;
  const over = !!T && T.max != null && jobs > T.max, next = over ? P.tiers.slice(i + 1).find(x => x.max == null || jobs <= x.max) || P.tiers[P.tiers.length - 1] : null;
  return { inTrial, trialEnd, freeLeft: Math.max(0, P.pilotJobs - free), jobs, tier: T, over, next, offer: over && !!r.sub && r.sub.declined !== mk, due: T && !inTrial ? T.price : 0 };
}
const planStatus = r => { const u = planUsage(r), T = u.tier; if (!T) return 'No active plan'; return u.inTrial ? T.name + ' · Free pilot · ' + u.freeLeft + ' free jobs left, until ' + new Date(u.trialEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : T.name + ' · ' + money(T.price) + ' a month · ' + u.jobs + (T.max == null ? '' : ' of ' + T.max) + ' job' + (u.jobs === 1 && T.max == null ? '' : 's') + ' this month'; };
const nextWeekly = (now = Date.now()) => { const d = new Date(now), k = (SETTINGS.payouts.weeklyDay - d.getDay() + 7) % 7 || 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() + k).getTime(); };
function cashoutState(r, now = Date.now()) {
  const T = subFor(r), allowed = T ? T.cashouts : 0, mk = monthKey(now), used = ((r && r.cashouts) || []).filter(t => monthKey(t) === mk).length;
  const start = (r && (r.since || (r.sub && r.sub.since))) || now, days = Math.floor((now - start) / 864e5), cb = ((r && r.chargebacks) || []).some(c => !c.resolved);
  const balance = Math.round(((r && r.earn) || []).filter(x => !x.paid).reduce((a, x) => a + x.price + (x.tip || 0) - x.fee, 0) * 100) / 100;
  const d = new Date(now), reset = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(), why = days < SETTINGS.payouts.minActiveDays ? 'Available after ' + SETTINGS.payouts.minActiveDays + ' days active' : cb ? 'Unavailable while a chargeback is open' : '';
  return { allowed, used, left: Math.max(0, allowed - used), eligible: !why, why, balance, reset, can: allowed > used && !why && balance > 0, weekly: nextWeekly(now) };
}
const runnerList = () => Object.values(S.runners || {}).filter(r => runnerReady(r) && !r.deactivated);
function rankOffers(list, by, from) {
  const favs = (S.prefs && S.prefs.favs) || [], dist = o => { const a = AREA(S.runners[o.id] && S.runners[o.id].area); return RouteSolver.haversineMi(a, from); };
  list.forEach(o => { o.dist = Math.round(dist(o) * 10) / 10; o.fav = favs.includes(o.id); });
  const key = { distance: o => o.dist, price: o => o.price, rating: o => -(o.rating ? o.rating[0] / o.rating[1] : 0), favorites: o => (o.fav ? 0 : 1) * 1e6 + o.dist }[by] || (o => o.dist);
  return list.slice().sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
}
function runnerPrice(r, stops, timing, e) {
  if (!r || !stops.length) return null;
  if (r.pricing === 'engine') return e ? e.price : null;
  const R2 = r.rates; if (!ratesOk(R2)) return null;
  const n = stops.length, big = n === 1 && stops[0].type === 'Groceries' && R2.bigShop > 0;
  let p = big ? R2.bigShop : R2.base + Math.max(0, n - 3) * (R2.extraStop || 0);
  if (timing === 'asap') p += R2.asap || 0;
  return Math.round(p * 100) / 100;
}
function linePrice(r, hours) {
  if (!lineOk(r)) return null;
  const hrs = Math.max(+r.rates.lineMin || 0, +hours || 0);
  return { hours: hrs, total: Math.round(r.rates.lineHourly * hrs * 100) / 100 };
}
function routeOptions(stops, end, real) {
  const r = computeRoute(stops, HUB, end), same = r.order.length === r.entered.length && r.order.every((v, i) => v === r.entered[i]);
  const k = real && r.miles > 0 ? real.mi / r.miles : 1, km = real && r.driveMin > 0 ? real.min / r.driveMin : 1;
  const opt = (order, mi, drive) => ({ order, miles: mi * k, driveMin: drive * km, mins: drive * km + r.dwell, real: real ? { mi: mi * k, min: drive * km } : null });
  return { r, same, cheap: real ? { order: r.order, miles: real.mi, driveMin: real.min, mins: real.min + r.dwell, real } : opt(r.order, r.miles, r.driveMin), mine: same ? null : opt(r.entered, r.enteredMiles, r.enteredDrive) };
}
function quote(o = {}) {
  const stops = o.stops || S.stops, end = o.end || destOf(), n = stops.length;
  const real = !o.stops && S.realRoute && S.realRoute.sig === stopsSig(stops) ? S.realRoute : null;
  const R0 = routeOptions(stops, end, real), want = o.route || (S.c && S.c.route) || 'cheap', pick = want === 'mine' && R0.mine ? 'mine' : 'cheap', ch = R0[pick];
  const r = { ...R0.r, order: ch.order, miles: ch.miles, driveMin: ch.driveMin, mins: ch.mins, pick, same: R0.same }, miles = ch.miles;
  const timing = ORD.mode(stops, o.timing || S.timing), standalone = ORD.isStandaloneDropoff(stops);
  const eng = c => n ? PricingEngine.quote(engineInputs(stops, c.miles, c.real, timing)) : null;
  const E = { cheap: eng(R0.cheap), mine: R0.mine ? eng(R0.mine) : null }, e = E[pick];
  const offers = standalone || !n ? [] : rankOffers(runnerList().map(x => ({ id: x.id, name: x.name, online: !!x.online, rating: x.rating || null, jobs: x.jobs || 0, price: runnerPrice(x, stops, timing, e) })).filter(x => x.price != null), o.sort || (S.c && S.c.sort) || 'distance', n ? placeOf(stops[0]) : HUB);
  const pickId = o.runner !== undefined ? o.runner : S.c && S.c.runner, sel = offers.find(x => x.id === pickId) || null;
  const price = sel ? sel.price : null;
  const priceFor = k => { if (!R0[k]) return null; const x = sel && S.runners[sel.id]; if (x) return runnerPrice(x, stops, timing, E[k]); const ps = runnerList().map(y => runnerPrice(y, stops, timing, E[k])).filter(v => v != null); return ps.length ? Math.min(...ps) : null; };
  const mn = k => E[k] ? E[k].minutes : R0[k].mins, routes = { same: R0.same, pick, cheap: { miles: R0.cheap.miles, mins: mn('cheap'), price: priceFor('cheap') }, mine: R0.mine ? { miles: R0.mine.miles, mins: mn('mine'), price: priceFor('mine') } : null };
  const goods = stops.reduce((a, s) => a + s.items.reduce((b, i) => b + (+i.p || 0), 0), 0);
  const suggested = goods > 0 ? Math.ceil((goods * (1 + S.pay.capPad / 100)) / 5) * 5 : 0;
  const cap = o.stops ? suggested : (S.cap == null ? suggested : S.cap);
  return { route: r, routes, e, est: !real, miles, timing, when: ORD.pickWhen(S.when), standalone, offers, runner: sel, price, goods, suggested, cap,
    total: price == null ? null : price + cap, refund: Math.max(0, cap - goods), eta: Math.round(e ? e.minutes : r.mins) };
}
if (typeof module !== 'undefined') module.exports = { S, quote, computeRoute, destOf, runnerPrice, linePrice, cleanRates, rankOffers };
const Store = {
  KEY: 'errand.shared.v1', last: '',
  pick() { return JSON.stringify({ trip: S.trip, line: S.line, history: S.history, weekly: S.weekly || null, rt: S.rt || null, prefs: S.prefs, notes: S.notes, support: S.support, runners: S.runners, subLog: S.subLog, payMethod: S.pay.method || null }); },
  save() { const j = this.pick(); if (j === this.last) return; this.last = j; try { localStorage.setItem(this.KEY, j); } catch (e) { } try { this.ch && this.ch.postMessage('sync'); } catch (e) { } },
  load() {
    let j = null; try { j = localStorage.getItem(this.KEY); } catch (e) { }
    if (!j) return false; let d; try { d = JSON.parse(j); } catch (e) { return false; }
    d = ORD.migrate(d) || {};
    S.trip = d.trip || null; S.line = d.line || null; S.history = Array.isArray(d.history) ? d.history : []; S.weekly = d.weekly || null; S.rt = d.rt || null;
    S.prefs = d.prefs && typeof d.prefs === 'object' ? d.prefs : { home: null }; S.notes = Array.isArray(d.notes) ? d.notes.slice(-60) : []; S.support = Array.isArray(d.support) ? d.support : [];
    S.runners = d.runners && typeof d.runners === 'object' ? d.runners : {}; S.subLog = Array.isArray(d.subLog) ? d.subLog : [];
    S.pay.method = d.payMethod && d.payMethod.kind === 'test' ? { kind: 'test', label: 'Test card ···· 4242' } : null;
    this.last = j; return true;
  },
  listen() {
    window.addEventListener('storage', e => { if (e.key === this.KEY && this.load()) R(); });
    try { this.ch = new BroadcastChannel('errand.shared'); this.ch.onmessage = () => { let j = null; try { j = localStorage.getItem(this.KEY); } catch (e) { } if (j !== this.last && this.load()) R(); }; } catch (e) { this.ch = null; }
  }
};
