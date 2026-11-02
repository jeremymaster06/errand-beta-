const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = ['settings', 'solver', 'pricing', 'data', 'orders', 'market', 'line'];
function load() {
  const toasts = [], ctx = { console, Math, Date, JSON, toast: t => toasts.push(t), R() {}, haptic() {}, AU: { require: () => true, session: () => ({ id: 'c1', name: 'Cy' }) }, h: () => ({}), $: () => null, icon: () => '' };
  vm.createContext(ctx);
  const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8')).join('\n;\n');
  vm.runInContext(src + '\nObject.assign(this, { SETTINGS, S, quote, mkStop, ORD, LN, lineEstimate, lineRules, lineOkHours, destOf, cleanRates, ratesOk, runnerPriced, runnerReady, runnerList, rankOffers, runnerPrice, planUsage, planStatus, cashoutState, tierOf, jobRange, monthKey, subFor, routeOptions, computeRoute, stopsSig, PricingEngine, engineInputs, isRide, errandContract, lineContract, procFee });', ctx);
  return Object.assign(ctx, { toasts });
}
const SRC = () => fs.readdirSync(path.join(__dirname, '../js')).filter(f => f !== 'config.js').map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
const sub = (tier = 'starter') => ({ tier, status: 'active', since: Date.now(), day: 1, consent: {} });
const runner = (id, o = {}) => ({ id, name: id, pricing: 'own', rates: { base: 20, extraStop: 5, bigShop: null, asap: 10, lineHourly: 30, lineMin: 2 }, area: 'gnp', online: true, sub: sub(), rating: null, jobs: 0, jobLog: [], earn: [], ...o });
const grocery = X => X.mkStop('Groceries', 'stopshop', { items: [{ n: 'Milk', p: 4, q: 1 }] });

test('No default pricing: a new runner has no pricing, empty rates are null, and nothing is offered until they choose', () => {
  const X = load(), r = runner('a', { pricing: null, rates: null });
  assert.ok(!X.runnerPriced(r) && !X.runnerReady(r)); X.S.runners = { a: r }; assert.strictEqual(X.runnerList().length, 0);
  const c = X.cleanRates({ base: '', extraStop: 'x', asap: '-1' }); assert.strictEqual(c.base, null); assert.strictEqual(c.extraStop, null); assert.strictEqual(c.asap, null);
  assert.ok(!X.ratesOk(c)); r.pricing = 'engine'; assert.ok(X.runnerPriced(r));
  assert.ok(X.SETTINGS.rates.fields.every(f => !/\d/.test(f[2] || '')), 'rate placeholders suggest no numbers');
  assert.ok(!/pricing:\s*'(own|engine)'/.test(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8')), 'no preselected pricing mode');
});
test('No price caps: any rate the runner sets is used as-is', () => {
  const X = load(); assert.strictEqual(X.cleanRates({ base: 5000 }).base, 5000); assert.strictEqual(X.SETTINGS.rates.max, undefined);
  assert.ok(X.SETTINGS.rates.fields.every(f => f.length <= 3));
});
test('Runner rates: base covers up to 3 stops, extra stops add, optional big-shop and ASAP rates', () => {
  const X = load(), r = runner('a'), s = [grocery(X)];
  assert.strictEqual(X.runnerPrice(r, s, 'scheduled'), 20);
  r.rates.bigShop = 30; assert.strictEqual(X.runnerPrice(r, s, 'scheduled'), 30);
  const four = [grocery(X), X.mkStop('Pharmacy', 'cvs'), X.mkStop('Dry cleaning', 'cleaners'), X.mkStop('Returns', 'ups')];
  assert.strictEqual(X.runnerPrice(r, four, 'scheduled'), 25); assert.strictEqual(X.runnerPrice(r, four, 'asap'), 35);
  assert.strictEqual(X.runnerPrice(runner('e', { pricing: 'engine' }), s, 'scheduled', { price: 17.5 }), 17.5);
});
test('Customer picks the runner: no runner is preselected or auto-assigned, even when only one is available', () => {
  const X = load(); X.S.runners = { a: runner('a') }; X.S.stops = [grocery(X)];
  let q = X.quote(); assert.strictEqual(q.offers.length, 1); assert.strictEqual(q.runner, null); assert.strictEqual(q.total, null);
  X.S.c.runner = 'a'; q = X.quote(); assert.strictEqual(q.runner.id, 'a'); assert.strictEqual(q.price, 20); assert.strictEqual(q.total, 20 + q.cap);
  X.S.runners.a.deactivated = { reason: 'Fraud' }; q = X.quote(); assert.strictEqual(q.runner, null, 'a removed runner is never swapped for another');
});
test('Ranking only by distance, price, rating and favorites; no boost for the pricing engine; offline runners still listed', () => {
  const X = load();
  X.S.runners = { near: runner('near', { area: 'gnp', online: false }), far: runner('far', { area: 'pw', rates: { base: 12 } }), eng: runner('eng', { area: 'man', pricing: 'engine', rating: [9, 2] }) };
  X.S.stops = [grocery(X)]; const ids = by => X.quote({ sort: by }).offers.map(o => o.id);
  assert.strictEqual(X.quote().offers.length, 3, 'offline runner listed, no penalty');
  assert.deepStrictEqual(ids('price')[0], 'far'); assert.strictEqual(ids('rating')[0], 'eng');
  X.S.prefs.favs = ['near']; assert.strictEqual(ids('favorites')[0], 'near');
  const d = X.quote({ sort: 'distance' }).offers; assert.ok(d.every((o, i) => !i || d[i - 1].dist <= o.dist));
  assert.ok(!/boost|promot|featured|sponsor/i.test(SRC()), 'no paid placement anywhere');
  assert.deepStrictEqual(Array.from(Object.keys(X.SETTINGS.plan).sort()), ['label', 'pilotJobs', 'pilotWeeks', 'tiers']);
  for (const T of X.SETTINGS.plan.tiers) assert.deepStrictEqual(Array.from(Object.keys(T).sort()), ['cashouts', 'key', 'max', 'min', 'name', 'price'], 'plans carry no ranking or visibility perks');
});
test('Flat plans: free pilot of 30 jobs or 6 weeks, then Starter $25 / Regular $75 / Pro $125, upgrade is an offer, never automatic', () => {
  const X = load(), P = X.SETTINGS.plan, S2 = X.SETTINGS.subscription, DAY = 864e5;
  assert.strictEqual(P.label, 'Placeholder pricing'); assert.strictEqual(P.pilotJobs, 30); assert.strictEqual(P.pilotWeeks, 6);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(P.tiers.map(t => [t.key, t.name, t.price, t.min, t.max]))), [['starter', 'Starter', 25, 0, 15], ['regular', 'Regular', 75, 16, 50], ['pro', 'Pro', 125, 51, null]]);
  assert.deepStrictEqual(Array.from(P.tiers.map(X.jobRange)), ['up to 15 jobs', '16 to 50 jobs', '51 or more jobs']);
  const T0 = P.tiers[0], d = S2.disclosure(P, T0), c = S2.consent(P, T0);
  assert.match(d, /first 30 jobs or 6 weeks, whichever comes first/); assert.match(d, /Starter is \$25 a month for up to 15 jobs/); assert.match(d, /billed to your card separately/); assert.match(d, /Never taken from your payouts/);
  assert.match(d, /offer an upgrade you can accept or decline\. We never charge you automatically/); assert.match(d, /Change plan or cancel anytime/);
  assert.match(c, /^I choose Starter: free for my first 30 jobs or 6 weeks, then \$25 a month for up to 15 jobs/);
  assert.ok(!/per (block|10)|percent|boost|priority|rank higher|featured/i.test(d + c + X.SETTINGS.planNote.replace('Nothing you pay changes how customers find or rank you.', '')), 'no per-block billing or perks');
  assert.ok(!/\b(blockPrice|monthlyCap|blockJobs|planPrice)\b/.test(SRC()), 'per-block billing code removed');
  const t0 = Date.UTC(2026, 10, 2, 15), at = (dd, h = 0) => t0 + dd * DAY + h * 36e5;
  const r = { id: 'a', sub: { tier: 'starter', status: 'active', since: t0 }, trialFrom: t0, jobLog: [] };
  for (let i = 0; i < 29; i++) r.jobLog.push(at(1, i / 10));
  let u = X.planUsage(r, at(2)); assert.ok(u.inTrial); assert.strictEqual(u.freeLeft, 1); assert.strictEqual(u.due, 0); assert.ok(!u.offer);
  r.jobLog.push(at(2)); u = X.planUsage(r, at(2, 1)); assert.ok(!u.inTrial, '30th job ends the pilot'); assert.strictEqual(u.due, 25, 'Starter is a flat $25'); assert.strictEqual(u.jobs, 0, 'pilot jobs do not count toward the plan');
  for (let i = 0; i < 15; i++) r.jobLog.push(at(3, i / 10)); u = X.planUsage(r, at(4)); assert.strictEqual(u.jobs, 15); assert.ok(!u.over && !u.offer); assert.strictEqual(u.due, 25);
  r.jobLog.push(at(4, 1)); u = X.planUsage(r, at(4, 2)); assert.ok(u.over && u.offer, '16th job shows an upgrade offer'); assert.strictEqual(u.next.key, 'regular'); assert.strictEqual(u.due, 25, 'going over never raises the charge by itself');
  r.sub.declined = X.monthKey(at(4, 2)); u = X.planUsage(r, at(4, 3)); assert.ok(u.over && !u.offer, 'declined offer stays dismissed this month'); assert.strictEqual(u.due, 25); assert.strictEqual(r.sub.tier, 'starter');
  for (let i = 0; i < 40; i++) r.jobLog.push(at(5, i / 20)); r.sub.declined = null; u = X.planUsage(r, at(6)); assert.strictEqual(u.next.key, 'pro', 'offer skips to the plan that fits');
  r.sub.tier = 'pro'; u = X.planUsage(r, at(6)); assert.ok(!u.over && !u.offer); assert.strictEqual(u.due, 125); assert.match(X.planStatus(r), /^Pro · \$125\.00 a month · 56 jobs this month$/);
  r.sub.tier = 'regular'; assert.strictEqual(X.planUsage(r, at(6)).due, 75, 'downgrade anytime');
  const slow = { id: 'b', sub: { tier: 'starter', status: 'active', since: t0 }, trialFrom: t0, jobLog: [at(1), at(2)] };
  assert.ok(X.planUsage(slow, at(41)).inTrial); u = X.planUsage(slow, at(42, 1)); assert.ok(!u.inTrial, '6 weeks ends the pilot'); assert.strictEqual(u.freeLeft, 28); assert.strictEqual(u.due, 25);
  slow.sub.status = 'cancelled'; u = X.planUsage(slow, at(43)); assert.strictEqual(u.due, 0, 'cancelled: nothing due'); assert.strictEqual(X.subFor(slow), null);
  assert.strictEqual(X.tierOf('usage').key, 'starter', 'older saved plans fall back to Starter');
});
test('Payouts: weekly is free on every plan; Pro gets 2 free instant cash-outs a month with fair eligibility, then none until next month, never a fee', () => {
  const X = load(), P = X.SETTINGS.plan, PO = X.SETTINGS.payouts, DAY = 864e5;
  assert.deepStrictEqual(Array.from(P.tiers.map(t => t.cashouts)), [0, 0, 2]);
  assert.strictEqual(PO.pro, 'Pro plan includes 2 free instant cash-outs a month (eligibility applies). Weekly payouts are always free.');
  assert.strictEqual(PO.weekly, 'Weekly payouts are always free.');
  assert.match(PO.eligibility, /at least 14 days active and no unresolved chargebacks/); assert.match(PO.eligibility, /Never tied to ratings, acceptance or hours/);
  for (const T of P.tiers) assert.ok(X.SETTINGS.subscription.disclosure(P, T).includes(PO.weekly), T.name + ' disclosure says weekly payouts are free');
  assert.ok(X.SETTINGS.subscription.disclosure(P, P.tiers[2]).includes(PO.pro));
  const now = Date.UTC(2026, 10, 18, 15), earn = () => [{ price: 30, tip: 5, fee: 1.17, paid: false }];
  const pro = { id: 'p', since: now - 30 * DAY, sub: { tier: 'pro', status: 'active', since: now - 30 * DAY }, jobLog: [], earn: earn(), cashouts: [], rating: [1, 1], acceptRate: 0.1, hours: 1 };
  let c = X.cashoutState(pro, now); assert.strictEqual(c.allowed, 2); assert.strictEqual(c.left, 2); assert.ok(c.can, 'eligible regardless of rating, acceptance or hours'); assert.strictEqual(c.balance, 33.83);
  pro.cashouts = [now - DAY]; c = X.cashoutState(pro, now); assert.strictEqual(c.left, 1); assert.ok(c.can);
  pro.cashouts.push(now - 3600e3); c = X.cashoutState(pro, now); assert.strictEqual(c.left, 0); assert.ok(!c.can, 'none left'); assert.ok(c.reset > now && new Date(c.reset).getDate() === 1, 'resets next month');
  pro.cashouts = [Date.UTC(2026, 9, 20), Date.UTC(2026, 9, 21)]; assert.strictEqual(X.cashoutState(pro, now).left, 2, 'last month does not count');
  const fresh = { ...pro, cashouts: [], since: now - 10 * DAY, sub: { ...pro.sub, since: now - 10 * DAY } }; c = X.cashoutState(fresh, now); assert.ok(!c.can && /14 days/.test(c.why), 'needs 14 days active');
  const cb = { ...pro, cashouts: [], chargebacks: [{ resolved: false }] }; c = X.cashoutState(cb, now); assert.ok(!c.can && /chargeback/.test(c.why));
  cb.chargebacks[0].resolved = true; assert.ok(X.cashoutState(cb, now).can, 'resolved chargeback no longer blocks');
  const st = { ...pro, sub: { tier: 'starter', status: 'active', since: pro.sub.since }, cashouts: [] }; c = X.cashoutState(st, now); assert.strictEqual(c.allowed, 0); assert.ok(!c.can, 'Starter: weekly only');
  const w = new Date(X.cashoutState(st, now).weekly); assert.strictEqual(w.getDay(), PO.weeklyDay); assert.ok(w.getTime() > now);
  const src = SRC(); assert.ok(!/instant[^'\n]{0,40}fee|cash-?out fee|instantFee/i.test(src.replace(/instant_perk|instant = r\(gp \* PERK\[p\.perk\]\)/g, '')), 'no instant cash-out fee option');
  const copy = [PO.pro, PO.weekly, PO.eligibility, ...P.tiers.map(T => X.SETTINGS.subscription.disclosure(P, T) + X.SETTINGS.subscription.consent(P, T))].join(' ');
  assert.ok(!/%|percent/i.test(copy), 'no percentages in plan or payout copy');
});
test('Final drop-off: defaults to home, can be any address, route and price follow it', () => {
  const X = load(); X.S.runners = { a: runner('a') }; X.S.c.runner = 'a'; X.S.stops = [grocery(X), X.mkStop('Pharmacy', 'cvs')];
  const unset = X.quote(); assert.ok(X.destOf().unset);
  X.S.prefs.home = { addr: '25 Grace Ave, Great Neck', lat: 40.7887, lng: -73.7280 }; assert.strictEqual(X.destOf().name, 'Home');
  const home = X.quote();
  X.S.dest = { name: "Mom's house", addr: '4 Kings Point Rd', lat: 40.8090, lng: -73.7400 };
  const away = X.quote(); assert.notStrictEqual(away.route.miles, home.route.miles); assert.strictEqual(away.route.n, 2);
  assert.strictEqual(away.price, 20, 'the drop-off is not counted as a stop');
  X.S.dest = null; assert.strictEqual(X.quote().route.miles, home.route.miles); assert.ok(unset);
});
test('Per-job contract: customer and runner are the parties, price set by the runner, goods only', () => {
  const X = load(); X.S.runners = { a: runner('a') }; X.S.c.runner = 'a'; X.S.stops = [grocery(X)];
  const q = X.quote(), c = X.errandContract(X.S.stops, q, X.S.runners.a, X.destOf());
  assert.match(c, /Cy \(customer\) and a \(runner\)/); assert.match(c, /\$20\.00, set by the runner/); assert.match(c, /Goods only, no passengers/); assert.match(c, /not a party/);
  const l = X.lineContract({ place: { name: 'Apple' }, start: Date.now() }, X.S.runners.a, { hours: 2, total: 60 }); assert.match(l, /No promise of entry/); assert.match(l, /not a party/);
});
test('Goods only: ride requests are recognised and blocked', () => {
  const X = load(); assert.ok(X.isRide('Ride to the airport') && X.isRide('pick me up at the station') && X.isRide('passenger'));
  assert.ok(!X.isRide('Pick up milk') && !X.isRide('Drop off dry cleaning'));
  assert.match(fs.readFileSync(path.join(__dirname, '../legal/terms.md'), 'utf8'), /goods only/i);
});
test('Line sitting: priced from the runner\'s hourly rate and minimum, capped in hours only', () => {
  const X = load(), r = runner('a'), L = X.SETTINGS.line;
  assert.strictEqual(L.bookingFee, undefined); assert.strictEqual(L.hourly, undefined);
  assert.strictEqual(X.lineEstimate(3, r).total, 90); assert.strictEqual(X.lineEstimate(1, r).total, 60); assert.strictEqual(X.lineEstimate(1, r).hours, 2);
  assert.strictEqual(X.lineEstimate(99, r).hours, L.capHours); assert.ok(!X.lineOkHours(0.5) && X.lineOkHours(1) && !X.lineOkHours(L.capHours + 1));
  assert.match(X.lineRules(3, r).rate, /\$30\/hr/); assert.match(X.lineRules(3, r).extra, /15 minutes is \$7\.50/); assert.match(X.lineRules(3).rate, /Set by your runner/);
  X.S.runners = { a: { ...r, sub: sub() } }; X.S.c.ln = { place: { name: 'Apple Fifth Avenue', addr: 'NY', types: [] }, start: Date.now() + 3 * 3600e3, hours: 0.5, runner: 'a' };
  X.LN.book_(); assert.strictEqual(X.S.line, null); assert.match(X.toasts[0], /at least 1 hour/);
});
test('Checkout timing copy promises no windows: the runner confirms', () => {
  const X = load(); X.S.stops = [grocery(X), X.mkStop('Dry cleaning', 'cleaners')]; X.S.timing = 'flex';
  const w = X.ORD.flexWindow(Date.UTC(2026, 9, 25, 14, 10)), line = X.ORD.flexLine(X.quote(), w);
  assert.match(line, /^Flexible\. You ask for \d{1,2}:\d\d [AP]M–\d{1,2}:\d\d [AP]M and your runner confirms when they accept\.$/);
  assert.ok(Object.values(X.ORD.timeNote).every(t => !/guarantee|we promise|on time, every time/i.test(t)));
});
test('Clean copy: no employer model, no guarantees, no "our runners", no pending tags or old product names', () => {
  const all = SRC() + fs.readFileSync(path.join(__dirname, '../legal/terms.md'), 'utf8').replace(/^>.*$/gm, '');
  for (const re of [/W-2/, /\bour runners\b/i, /guarantee/i, /clock ?in\b/i, /\bshifts?\b(?!\()/i, /overtime/i, /\bbonus/i, /\(pending\)|pending legal|pending Jeremy/i, /Hold My Spot/, /courier(?!_service)/i, /uniform/i, /Family Plan/i])
    assert.ok(!re.test(SRC()), 'found ' + re);
  assert.ok(all.length > 0);
});
test('Payouts: the processor fee is shown, the runner keeps the full price and tips', () => {
  const X = load(); assert.strictEqual(X.procFee(20), 0.88); assert.strictEqual(X.SETTINGS.card.pct, 0.029);
});
test('Route choice: cheapest vs my order, both priced from the picked runner, drop-off last, pickups before drop-offs', () => {
  const X = load(); X.S.prefs.home = { addr: '25 Grace Ave, Great Neck', lat: 40.7887, lng: -73.7280 };
  X.S.runners = { e: runner('e', { pricing: 'engine' }), o: runner('o') };
  X.S.stops = [X.mkStop('Pharmacy', 'stopshop'), X.mkStop('Pharmacy', 'nsfarms'), X.mkStop('Pharmacy', 'cvs')];
  X.S.c.runner = 'e'; X.S.c.route = null;
  const q = X.quote(), RT = q.routes;
  assert.strictEqual(RT.pick, 'cheap', 'cheapest preselected'); assert.ok(RT.mine, 'two options when orders differ');
  assert.deepStrictEqual(Array.from(X.quote({ route: 'mine' }).route.order), [0, 1, 2], 'my order keeps the entered order');
  assert.ok(RT.cheap.miles < RT.mine.miles, 'cheapest is shorter'); assert.ok(RT.cheap.price < RT.mine.price, 'engine runner: cheaper route costs less');
  const ec = c => X.PricingEngine.quote(X.engineInputs(X.S.stops, c.miles, null, q.timing)).price;
  assert.strictEqual(RT.cheap.price, ec(RT.cheap)); assert.strictEqual(RT.mine.price, ec(RT.mine));
  assert.strictEqual(q.price, RT.cheap.price, 'booked price is the chosen route price');
  const qm = X.quote({ route: 'mine' }); assert.strictEqual(qm.price, RT.mine.price); assert.strictEqual(qm.route.pick, 'mine'); assert.strictEqual(qm.miles, RT.mine.miles);
  X.S.c.runner = 'o'; const qo = X.quote(); assert.strictEqual(qo.routes.cheap.price, qo.routes.mine.price, 'flat-rate runner: same price both ways');
  X.S.c.runner = 'e'; const c1 = X.errandContract(X.S.stops, qm, X.S.runners.e, X.destOf()), c2 = X.errandContract(X.S.stops, q, X.S.runners.e, X.destOf());
  assert.match(c1, /customer’s order\): 1\. Stop & Shop, 2\. North Shore Farms, 3\. CVS Pharmacy\. Then deliver everything to Home/);
  const names = Array.from(q.route.order).map(i => ['Stop & Shop', 'North Shore Farms', 'CVS Pharmacy'][i]);
  assert.ok(c2.includes('(cheapest route): 1. ' + names[0] + ', 2. ' + names[1] + ', 3. ' + names[2] + '. Then deliver'), 'agreement lists the chosen order');
  const pu = X.mkStop('Personal pickup', 'stopshop'), dr = X.mkStop('Drop-off', 'a5', { from: pu.id });
  X.S.stops = [dr, X.mkStop('Pharmacy', 'cvs'), pu];
  for (const k of ['cheap', 'mine']) { const o = Array.from(X.quote({ route: k }).route.order); assert.ok(o.indexOf(2) < o.indexOf(0), k + ': pickup before its drop-off'); assert.strictEqual(o.length, 3, k + ': final drop-off is not a stop and stays last'); }
  X.S.stops = [X.mkStop('Pharmacy', 'cvs')]; const one = X.quote(); assert.strictEqual(one.routes.same, true); assert.strictEqual(one.routes.mine, null, 'identical orders show one option');
  X.S.stops = [X.mkStop('Pharmacy', 'stopshop'), X.mkStop('Pharmacy', 'nsfarms'), X.mkStop('Pharmacy', 'cvs')];
  const est = X.quote(); X.S.realRoute = { sig: X.stopsSig(X.S.stops), mi: est.routes.cheap.miles * 1.2, min: 30 };
  const re = X.quote(); assert.strictEqual(re.routes.cheap.miles, est.routes.cheap.miles * 1.2, 'road miles for the cheapest route');
  assert.ok(Math.abs(re.routes.mine.miles - est.routes.mine.miles * 1.2) < 1e-9, 'my order scaled to the same road basis, no extra lookup');
});
