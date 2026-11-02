const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function load(runner = true) {
  const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const body = src.slice(src.indexOf('const tripLite'), src.indexOf('\n};', src.indexOf('const C = {')) + 3);
  const q = { route: { order: [0], miles: 1 }, timing: 'scheduled', when: 'a', cap: 10, goods: 5, miles: 1, eta: 20, total: 39, runner: runner ? { id: 'r1', name: 'Ann', price: 22 } : null };
  const ctx = { S: { c: { screen: 'review' }, pay: { method: null }, prefs: { home: { addr: '1 Main St', lat: 1, lng: 1 } }, dest: null, stops: [{ id: 1, items: [] }], trip: null, runners: { r1: { id: 'r1', name: 'Ann' } }, notes: [] },
    AU: { require: () => true }, R() {}, haptic() {}, toast() {}, quote: () => q, destOf: () => ({ name: 'Home', addr: '1 Main St', lat: 1, lng: 1 }), errandContract: () => 'contract', custName: () => 'Cy', money: n => '$' + n, agreeText: () => 'I agree (test)', isRide: t => /\bride\b/i.test(t || ''), RIDE_MSG: 'goods only',
    notify(to, text, go, rid) { ctx.S.notes.push({ to, rid }); }, ORD: { flexWindow: () => null }, AS: {}, TL: { clear() {} } };
  vm.createContext(ctx); vm.runInContext(body + '\nthis.C = C;', ctx); return ctx;
}
test('no payment method: confirm adds a test card inline and does not place the order', () => {
  const x = load(); x.C.confirm();
  assert.strictEqual(x.S.trip, null); assert.strictEqual(x.S.c.screen, 'review'); assert.strictEqual(x.S.pay.method.kind, 'test');
});
test('a ride request in the note is refused', () => {
  const x = load(); x.C.useTestMethod(); x.S.c.agree = true; x.S.c.note = 'give me a ride'; x.C.confirm(); assert.strictEqual(x.S.trip, null);
});
test('no payment method: an existing trip status is not changed', () => {
  const x = load(); x.S.trip = { status: 'matching' }; x.C.confirm(); assert.strictEqual(x.S.trip.status, 'matching');
});
test('no runner picked: nothing is booked and nobody is auto-assigned', () => {
  const x = load(false); x.C.useTestMethod(); x.C.confirm(); assert.strictEqual(x.S.trip, null); assert.strictEqual(x.S.notes.length, 0);
});
test('consent box unchecked: nothing is booked', () => {
  const x = load(); x.C.useTestMethod(); x.C.confirm(); assert.strictEqual(x.S.trip, null); assert.strictEqual(x.S.notes.length, 0);
});
test('with a method, a picked runner and consent: the order goes only to that runner, with a contract and logged consent', () => {
  const x = load(); x.C.useTestMethod(); assert.ok(x.S.pay.method); assert.strictEqual(x.S.c.screen, 'review');
  x.S.c.agree = true; x.C.confirm(); assert.strictEqual(x.S.trip.consent.text, 'I agree (test)'); assert.ok(x.S.trip.consent.at > 0); assert.strictEqual(x.S.c.agree, false); assert.strictEqual(x.S.trip.status, 'matching'); assert.strictEqual(x.S.c.screen, 'tracking');
  assert.strictEqual(x.S.trip.runner, 'r1'); assert.strictEqual(x.S.trip.price, 22); assert.strictEqual(x.S.trip.contract, 'contract');
  assert.deepStrictEqual(x.S.notes.map(n => n.rid), ['r1']);
});
