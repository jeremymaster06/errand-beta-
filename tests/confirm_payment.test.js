// Shield: C.confirm must not create or change a trip without a payment method; it opens the Add payment sheet.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const body = src.slice(src.indexOf('const C = {'), src.indexOf('\n};', src.indexOf('const C = {')) + 3);
  const ctx = { S: { c: { screen: 'review' }, pay: { capPad: 20, method: null }, stops: [{ id: 1, items: [] }], trip: null }, AU: { require: () => true }, R() {}, haptic() {}, toast() {}, quote: () => ({ total: 54 }), AS: {}, TL: { clear() {} } };
  vm.createContext(ctx); vm.runInContext(body + '\nthis.C = C;', ctx); return ctx;
}
test('no payment method: confirm does not place the order', () => {
  const x = load(); x.C.confirm();
  assert.strictEqual(x.S.trip, null); assert.strictEqual(x.S.c.screen, 'addPayment');
});
test('no payment method: an existing trip status is not changed', () => {
  const x = load(); x.S.trip = { status: 'matching' }; x.C.confirm(); assert.strictEqual(x.S.trip.status, 'matching');
});
test('with a method: order is created', () => {
  const x = load(); x.C.useTestMethod(); assert.ok(x.S.pay.method); assert.strictEqual(x.S.c.screen, 'review');
  x.C.confirm(); assert.strictEqual(x.S.trip.status, 'matching'); assert.strictEqual(x.S.c.screen, 'tracking');
});
