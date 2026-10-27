// Runner pay math: trip pay, wait grace, line cap, minimum-wage top-up, overtime on the week's regular rate.
const test = require('node:test'), assert = require('node:assert');
const { PAY, PAY_CFG } = require('../js/pay.js');
test('config values', () => assert.deepStrictEqual([PAY_CFG.perTrip, PAY_CFG.perStop, PAY_CFG.waitRate, PAY_CFG.waitGraceMin, PAY_CFG.baseHourly], [10, 2, 0.30, 5, 17]));
test('trip: 2 stops, waits 3 and 15 min', () => { const p = PAY.trip([3, 15]); assert.strictEqual(p.waitMin, 10); assert.strictEqual(p.total, 10 + 4 + 3); });
test('trip shown before accept (no waits)', () => assert.strictEqual(PAY.trip([0]).total, 12));
test('line-sit capped at booked length', () => { assert.strictEqual(PAY.line(200, 180).min, 180); assert.strictEqual(PAY.line(200, 180).total, 54); assert.strictEqual(PAY.line(-5, 60).min, 0); });
test('top-up to minimum wage', () => {
  const w = PAY.week({ trips: [{ waits: [0] }], hours: 2 }); // piece 12, floor 34
  assert.strictEqual(w.piece, 12); assert.strictEqual(w.topUp, 22); assert.strictEqual(w.total, 34); assert.strictEqual(w.ot, 0);
});
test('no top-up when piece pay exceeds the floor', () => {
  const w = PAY.week({ trips: Array.from({ length: 5 }, () => ({ waits: [10, 10] })), hours: 3 }); // 5*(10+4+3)=85 > 51
  assert.strictEqual(w.piece, 85); assert.strictEqual(w.topUp, 0);
});
test('rows list each rate and count', () => {
  const w = PAY.week({ trips: [{ waits: [6] }, { waits: [0, 0] }], lines: [{ waited: 90, booked: 60 }], bonuses: [{ label: 'Sign-on', amt: 25 }], hours: 3 });
  assert.deepStrictEqual(w.rows.map(r => [r.rate, r.count]), [[10, 2], [2, 3], [0.3, 1], [0.3, 60]]);
  assert.strictEqual(w.bonus, 25);
});
test('overtime after 40h on the regular rate incl. bonus and top-up', () => {
  const w = PAY.week({ trips: Array.from({ length: 40 }, () => ({ waits: [0] })), bonuses: [{ label: 'B', amt: 50 }], hours: 45 });
  // piece 480, floor 765 -> top-up 285; straight 815; regular 815/45; OT 5h * half-time
  assert.strictEqual(w.topUp, 285); assert.strictEqual(w.otHours, 5);
  assert.strictEqual(w.ot, PAY.r2(5 * (815 / 45) * 0.5)); assert.strictEqual(w.total, PAY.r2(815 + 5 * (815 / 45) * 0.5));
});
test('zero hours, empty week', () => { const w = PAY.week({}); assert.strictEqual(w.total, 0); assert.strictEqual(w.regRate, 0); });
test('idle time between jobs is paid: top-up covers the full shift', () => {
  // 8h shift, only 1 short trip worked: piece 12, floor 8*17=136
  const w = PAY.week({ trips: [{ waits: [0] }], hours: 8 }); assert.strictEqual(w.topUp, 124); assert.strictEqual(w.wages, 136);
});
test('tips are separate and never reduce the top-up', () => {
  const a = PAY.week({ trips: [{ waits: [0] }], hours: 2 }), b = PAY.week({ trips: [{ waits: [0] }], tips: [20, 5], hours: 2 });
  assert.strictEqual(b.topUp, a.topUp); assert.strictEqual(b.tips, 25); assert.strictEqual(b.wages, a.wages); assert.strictEqual(b.total, a.total + 25);
});
test('OT excludes tips: +0.5 x (earnings incl. bonus and top-up) / hours per extra hour', () => {
  const w = PAY.week({ trips: Array.from({ length: 60 }, () => ({ waits: [10] })), bonuses: [{ label: 'B', amt: 40 }], tips: [100], hours: 44 });
  // piece 60*(10+2+1.5)=810, floor 748 -> no top-up; straight 850; OT 4h * 0.5 * 850/44
  assert.strictEqual(w.piece, 810); assert.strictEqual(w.topUp, 0);
  assert.strictEqual(w.ot, PAY.r2(4 * 0.5 * 850 / 44)); assert.strictEqual(w.total, PAY.r2(850 + 4 * 0.5 * 850 / 44 + 100));
});
