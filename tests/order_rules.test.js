// Hold My Spot minimum + copy, courier eligibility, standalone drop-offs, checkout timing / flex pricing, claims.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const FILES = ['settings', 'solver', 'pricing', 'data', 'orders', 'line'];
function load() {
  const toasts = [], ctx = { console, Math, Date, JSON, toast: t => toasts.push(t), R() {}, haptic() {}, AU: { require: () => true }, h: () => ({}), $: () => null, icon: () => '' };
  vm.createContext(ctx);
  const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8')).join('\n;\n');
  vm.runInContext(src + '\nObject.assign(this, { SETTINGS, S, quote, mkStop, ORD, LN, lineEstimate, lineRules, lineOkHours });', ctx);
  return Object.assign(ctx, { toasts });
}
const eq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m);
const place = { custom: { name: 'A', addr: '1 Main St', lat: 40.79, lng: -73.73 } };
const dropoffTrip = (X, extra = {}) => [X.mkStop('Personal pickup', null, { ...place, items: [{ n: 'Box of books', p: 0 }] }), X.mkStop('Drop-off', null, { custom: { name: 'B', addr: '9 Elm St', lat: 40.80, lng: -73.72 }, items: [{ n: 'Box of books', p: 0 }], ...extra })];

test('Hold My Spot settings: $15 fee, $40/hr, 2-hour minimum, cap; labeled pending Jeremy', () => {
  const X = load(), L = X.SETTINGS.line;
  assert.deepStrictEqual([L.bookingFee, L.hourly, L.minHours], [15, 40, 2]); assert.ok(L.capHours > L.minHours); assert.strictEqual(L.pending, 'Pending Jeremy');
});
test('Hold My Spot: "2-hour minimum ($95)" is calculated from settings', () => {
  const X = load(); assert.strictEqual(X.lineRules(2).min, '2-hour minimum ($95)');
  assert.strictEqual(X.lineRules(2).rate, '$40/hr + $15 booking fee');
});
test('Hold My Spot: the copy follows the settings when Adam changes them', () => {
  const ctx = { console, toast() {}, R() {}, haptic() {}, AU: { require: () => true }, h: () => ({}), $: () => null, icon: () => '' }; vm.createContext(ctx);
  const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8')).join('\n;\n').replace('bookingFee: 15, hourly: 40, minHours: 2,', 'bookingFee: 10, hourly: 25, minHours: 2,');
  vm.runInContext(src + '\nthis.lineRules = lineRules; this.lineEstimate = lineEstimate;', ctx);
  assert.strictEqual(ctx.lineRules(2).min, '2-hour minimum ($60)'); assert.strictEqual(ctx.lineEstimate(3).total, 85);
});
test('Hold My Spot: total for chosen hours, minimum and cap enforced', () => {
  const X = load();
  assert.strictEqual(X.lineEstimate(3).total, 135); assert.strictEqual(X.lineEstimate(1).total, 95); assert.strictEqual(X.lineEstimate(1).hours, 2);
  assert.strictEqual(X.lineEstimate(99).hours, X.SETTINGS.line.capHours);
  assert.ok(!X.lineOkHours(1.5) && X.lineOkHours(2) && !X.lineOkHours(X.SETTINGS.line.capHours + 1));
  const r = X.lineRules(3); assert.match(r.extra, /Extra hours: .*3 hr.*15 minutes is \$10/); assert.match(r.early, /Ending early: .*2-hour minimum \(\$95\)/);
});
test('Hold My Spot: a booking under the minimum is rejected in book_()', () => {
  const X = load(); X.S.c.ln = { place: { name: 'Apple Fifth Avenue', addr: 'NY', types: [] }, start: Date.now() + 3 * 3600e3, hours: 1 };
  X.LN.book_(); assert.strictEqual(X.S.line, null); assert.match(X.toasts[0], /at least 2 hours/);
  X.S.c.ln = { place: { name: 'Apple Fifth Avenue', addr: 'NY', types: [] }, start: Date.now() + 3 * 3600e3, hours: 3 };
  X.LN.book_(); assert.strictEqual(X.S.line.est.total, 135); assert.strictEqual(X.S.line.capMin, 180);
});
test('Courier: off by default, partner and fee in settings, banned list', () => {
  const K = load().SETTINGS.courier;
  assert.strictEqual(K.enabled, false); assert.ok(K.partner && K.fee > 0 && K.valueCap > 0); assert.strictEqual(K.maxLb, 50);
  eq(K.banned.map(b => b.id), ['alcohol', 'rx', 'age', 'giftcard']);
});
test('Courier: only a standalone drop-off with no store purchase and no line-sit is eligible', () => {
  const X = load();
  eq(X.ORD.courierCheck({ stops: dropoffTrip(X) }), { ok: true, reason: '' });
  assert.match(X.ORD.courierCheck({ stops: [X.mkStop('Groceries', 'stopshop'), ...dropoffTrip(X)] }).reason, /store purchase/);
  assert.match(X.ORD.courierCheck({ kind: 'line' }).reason, /Line-sits/);
  assert.match(X.ORD.courierCheck({ stops: [X.mkStop('Custom task', null, place)] }).reason, /standalone drop-offs/);
});
test('Courier: banned items are blocked with the reason', () => {
  const X = load(), K = X.SETTINGS.courier, why = (n, extra) => X.ORD.courierCheck({ stops: [X.mkStop('Drop-off', null, { ...place, items: [{ n, p: 0 }], ...extra })] }).reason;
  assert.match(why('2 bottles of wine'), /^Alcohol/); assert.match(why('Rx refill'), /^Prescriptions/); assert.match(why('carton of cigarettes'), /^Age-restricted/);
  assert.match(why('$50 gift card'), /^Gift cards/); assert.match(why('Desk', { lb: 51 }), /over 50 lb/); assert.match(why('Watch', { value: K.valueCap + 1 }), /worth over/);
  assert.strictEqual(why('Desk', { lb: 50, value: K.valueCap }), '');
});
test('Courier: customer note template uses the partner from settings', () => {
  const X = load();
  assert.strictEqual(X.ORD.courierNote(X.SETTINGS.courier.partner), 'This delivery is carried by our partner, ' + X.SETTINGS.courier.partner + '. Your price doesn’t change. We share your name, drop-off address and phone with them only to complete it.');
});
test('Drop-offs: standalone is never ASAP and is priced from the pending-Jeremy setting', () => {
  const X = load(); X.S.stops = dropoffTrip(X); X.S.timing = 'asap';
  eq(X.ORD.modes(X.S.stops).map(m => m[0]), ['scheduled', 'flex']);
  const q = X.quote(); assert.strictEqual(q.timing, 'scheduled'); assert.strictEqual(q.f.service, X.SETTINGS.dropoff.standalonePrice); assert.strictEqual(X.SETTINGS.dropoff.pending, 'Pending Jeremy');
  X.S.stops.push(X.mkStop('Groceries', 'stopshop', { items: [{ n: 'Milk', p: 4 }] }));
  assert.ok(!X.ORD.isStandaloneDropoff(X.S.stops)); eq(X.ORD.modes(X.S.stops).map(m => m[0]), ['asap', 'scheduled', 'flex']);
});
test('Checkout: flexible window saving is the real ASAP difference for the same order', () => {
  const X = load(); X.S.stops = [X.mkStop('Groceries', 'stopshop', { items: [{ n: 'Milk', p: 4 }] }), X.mkStop('Dry cleaning', 'cleaners')];
  const asap = X.quote({ timing: 'asap' }); X.S.timing = 'flex'; const flex = X.quote();
  assert.ok(flex.flexSave > 0); assert.strictEqual(flex.flexSave, asap.f.service - flex.f.service); assert.strictEqual(flex.total, asap.total - flex.flexSave);
  const w = X.ORD.flexWindow(Date.UTC(2026, 9, 25, 14, 10)), line = X.ORD.flexLine(flex, w);
  assert.match(line, /^Flexible window: save \$\d+\.\d\d\. Arrives between \d{1,2}:\d\d [AP]M and \d{1,2}:\d\d [AP]M\.$/);
  assert.ok(!/up to|was/i.test(line)); assert.strictEqual(w.end - w.start, X.SETTINGS.timing.flexWindowHours * 3600e3);
});
test('Reliability claims: W-2 + live tracking on; insured + vetted off and shown only as pending in the prototype', () => {
  const X = load(), on = Object.fromEntries(X.SETTINGS.claims.list.map(c => [c.id, c.on]));
  eq(on, { w2: true, tracking: true, insured: false, vetted: false });
  eq(X.ORD.claims(), ['W-2 runners', 'Live tracking during your sit', 'Insured (pending)', 'Vetted (pending)']);
  X.SETTINGS.claims.prototype = false; eq(X.ORD.claims(), ['W-2 runners', 'Live tracking during your sit']);
  const all = fs.readdirSync(path.join(__dirname, '../js')).map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
  assert.ok(!/show-?up guarantee/i.test(all), 'no show-up guarantee');
});
