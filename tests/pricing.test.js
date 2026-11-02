const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const E = require('../js/pricing.js');
const vec = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing_vectors.json'), 'utf8'));
for (const v of vec) test(v.name, () => {
  const q = E.quote(v.inputs);
  for (const [k, exp] of Object.entries(v.expected)) {
    const dp = (exp.split('.')[1] || '').length;
    assert.strictEqual(q[k].toFixed(dp), exp, `${v.name}: ${k} = ${q[k]} expected ${exp}`);
  }
});
test('public engine carries no employment cost model', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/pricing.js'), 'utf8');
  assert.doesNotMatch(src, /w2|W-2|\bpeo|payroll|staff_markup|hc_|callin|hybrid|base_comm|\/\*|\/\//i);
  for (const k of Object.keys(E.DEF)) assert.doesNotMatch(k, /w2|peo|payroll|hc_|callin|hybrid|markup/);
  const q = E.quote({});
  for (const k of ['peo_fee', 'payroll_tax_wc', 'payroll_admin']) assert.ok(!(k in q), k + ' removed');
});
test('matches the finance engine for runner-priced jobs', () => {
  const orig = '/workspace/finance/pricing_v4/engine.js';
  if (!fs.existsSync(orig)) return;
  const m = { exports: {} }; new Function('module', fs.readFileSync(orig, 'utf8'))(m); const F = m.exports;
  const T = ['pickup', 'pharmacy', 'return', 'post_office', 'grocery'];
  for (let i = 0; i < 3000; i++) {
    const n = 1 + i % 6, inp = { staffing: i % 3 ? 'gig' : 'contractor_hc', pay_basis: i % 2 ? 'engaged' : 'logged', gig_util: 0.3 + (i % 70) / 100, stop_list: Array.from({ length: n }, (_, j) => ({ type: T[(i + j) % 5], items: (i * j) % 30 })), miles: (i % 1700) / 100, drive_minutes: i % 4 ? (i % 600) / 10 : null, batch_share: i % 5 ? 0 : 0.3, tip: i % 7, perk: ['none', 'one_free_wk', 'all'][i % 3], trips_per_paid_hr: i % 9 ? null : 0.5 + (i % 10) / 10, dropoff: i % 2 ? 'house' : 'apartment', weather: ['none', 'rain', 'snow'][i % 3], busy_fee: i % 4 };
    const a = E.quote(inp), b = F.quote(inp);
    for (const k of Object.keys(a)) assert.strictEqual(a[k], b[k], 'case ' + i + ' ' + k);
  }
});
