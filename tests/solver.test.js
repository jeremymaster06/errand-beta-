// Run: node --test tests/
const test = require('node:test'); const assert = require('node:assert/strict');
const R = require('../js/solver.js');

function perms(a) { if (a.length <= 1) return [a]; return a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x, ...p])); }
function brute(M, prec) { const n = M.length - 2; let best = Infinity, bo = null;
  for (const p of perms([...Array(n).keys()])) if (R.isFeasible(p, prec)) { const c = R.routeCost(p, M); if (c < best) { best = c; bo = p; } } return { best, bo }; }
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function randInstance(n, r) { const pts = Array.from({ length: n + 2 }, () => ({ x: r() * 10, y: r() * 10 }));
  return pts.map(a => pts.map(b => Math.hypot(a.x - b.x, a.y - b.y))); }
function line(xs, start, end) { const pts = xs.concat([start, end]); return pts.map(a => pts.map(b => Math.abs(a - b))); }

test('empty and single stop', () => {
  assert.deepEqual(R.solve(line([], 0, 5)).order, []);
  const r = R.solve(line([3], 0, 5)); assert.deepEqual(r.order, [0]); assert.equal(r.cost, 5);
});

test('points on a line are visited in sweep order', () => {
  const r = R.solve(line([4, 1, 3, 2], 0, 5)); assert.deepEqual(r.order, [1, 3, 2, 0]); assert.equal(r.cost, 5);
});

test('precedence: pickup must precede its drop-off even when that is longer', () => {
  // stop0 = drop-off at x=1, stop1 = pickup at x=4. Unconstrained best is 0 then 1. Constraint forces 1 before 0.
  const M = line([1, 4], 0, 5);
  assert.deepEqual(R.solve(M).order, [0, 1]);
  const r = R.solve(M, [[1, 0]]); assert.deepEqual(r.order, [1, 0]); assert.equal(r.cost, 11); assert.ok(R.isFeasible(r.order, [[1, 0]]));
});

test('multiple pickup/drop-off chains (a->b->c) and independent pairs', () => {
  const M = line([5, 1, 3, 2, 4], 0, 0), prec = [[0, 1], [1, 2], [3, 4]];
  const r = R.solve(M, prec); assert.ok(R.isFeasible(r.order, prec)); assert.equal(r.cost, brute(M, prec).best);
});

test('exact DP matches brute force on 200 random instances (n<=7) with random precedence', () => {
  const r = rng(42);
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(r() * 7), M = randInstance(n, r), prec = [];
    for (let k = 0; k < Math.floor(r() * 3); k++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a < b) prec.push([a, b]); }
    const s = R.solve(M, prec), b = brute(M, prec);
    assert.ok(R.isFeasible(s.order, prec)); assert.ok(Math.abs(s.cost - b.best) < 1e-9, `t=${t}`); assert.equal(s.exact, true);
  }
});

test('heuristic (n=15) returns a feasible permutation no worse than the entered order', () => {
  const r = rng(7), n = 15, M = randInstance(n, r), prec = [[0, 14], [3, 2], [5, 9], [11, 1]];
  const s = R.solve(M, prec); assert.equal(s.exact, false);
  assert.deepEqual([...s.order].sort((a, b) => a - b), [...Array(n).keys()]);
  assert.ok(R.isFeasible(s.order, prec));
  const entered = R.repairOrder([...Array(n).keys()], prec); assert.ok(s.cost <= R.routeCost(entered, M) + 1e-9);
});

test('heuristic is close to exact on medium instances (n=9, forced heuristic)', () => {
  const r = rng(99);
  for (let t = 0; t < 20; t++) { const M = randInstance(9, r), prec = [[0, 8], [2, 4]];
    const h = R.solve(M, prec, { exactMax: 0 }), e = R.solve(M, prec);
    assert.ok(R.isFeasible(h.order, prec)); assert.ok(h.cost <= e.cost * 1.25 + 1e-9, `t=${t} ${h.cost} vs ${e.cost}`); }
});

test('precedence cycle is rejected', () => { assert.throws(() => R.solve(line([1, 2], 0, 0), [[0, 1], [1, 0]]), /cycle/); });

test('repairOrder keeps entered order but fixes drop-off before pickup', () => {
  assert.deepEqual(R.repairOrder([2, 0, 1], [[1, 2]]), [0, 1, 2]);
  assert.deepEqual(R.repairOrder([0, 1, 2], []), [0, 1, 2]);
});

test('open path without fixed end (zero column)', () => {
  const M = line([2, 6], 0, 0).map(row => { row[3] = 0; return row; });
  const s = R.solve(M); assert.deepEqual(s.order, [0, 1]); assert.equal(s.cost, 6);
});

test('haversine + matrix sanity', () => {
  const a = { lat: 40.7887, lng: -73.728 }, b = { lat: 40.8010, lng: -73.723 };
  const d = R.haversineMi(a, b); assert.ok(d > 0.8 && d < 1.0, String(d));
  const M = R.buildMatrix([b], a, a); assert.equal(M.length, 3); assert.equal(M[1][2], 0);
});
