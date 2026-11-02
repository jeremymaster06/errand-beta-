const test = require('node:test'), assert = require('node:assert');
const { ORD } = require('../js/orders.js');
const trip = (o = {}) => ({ status: 'matching', stops: [{}, {}], step: 0, times: [{}, {}], ...o });
test('phases: Waiting for your runner -> Accepted -> Shopping -> On the way -> Delivered', () => {
  assert.strictEqual(ORD.phaseLabel(trip()), 'Waiting for your runner');
  assert.strictEqual(ORD.phaseLabel(trip({ status: 'accepted' })), 'Accepted');
  assert.strictEqual(ORD.phaseLabel(trip({ status: 'accepted', times: [{ arrive: 1 }, {}] })), 'Shopping');
  assert.strictEqual(ORD.phaseLabel(trip({ status: 'accepted', step: 1, times: [{ arrive: 1, start: 2, done: 3 }, {}] })), 'Shopping');
  assert.strictEqual(ORD.phaseLabel(trip({ status: 'accepted', step: 2 })), 'On the way');
  assert.strictEqual(ORD.phaseLabel(trip({ status: 'delivered' })), 'Delivered');
  assert.strictEqual(ORD.phase(null), null);
});
test('v13-format shared state migrates without dropping orders', () => {
  const old = { trip: { status: 'accepted', stops: [{}, {}, {}], q: {} }, line: null, history: [{ kind: 'errand', title: 'x', at: 1 }], online: true, rt: null };
  const d = ORD.migrate(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(d.trip.status, 'declined', 'an order from before runner choice asks the customer to pick a runner');
  assert.strictEqual(d.trip.stops.length, 3); assert.deepStrictEqual(d.trip.q.route.order, [0, 1, 2]); assert.strictEqual(d.history.length, 1);
  const m = ORD.migrate({ trip: { status: 'accepted', runner: 'r1', stops: [{}] } }); assert.strictEqual(m.trip.status, 'accepted'); assert.strictEqual(m.trip.times.length, 1); assert.deepStrictEqual(m.history, []);
  assert.strictEqual(ORD.migrate({ trip: { status: 'declined', runner: 'r1', stops: [{}] } }).trip.status, 'declined');
  assert.strictEqual(ORD.migrate({ trip: { status: 'weird', runner: 'r1', stops: [{}] } }).trip.status, 'matching');
});
