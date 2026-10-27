// Every vector in Adam's test_vectors.json must match to the cent (minutes to 0.1).
// Also checks that js/pricing.js embeds engine.js unchanged.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('../js/pricing.js');
const vec = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing_vectors.json'), 'utf8'));
for (const v of vec) test(v.name, () => {
  const q = E.quote(v.inputs);
  for (const [k, exp] of Object.entries(v.expected)) {
    const dp = (exp.split('.')[1] || '').length;
    assert.strictEqual(q[k].toFixed(dp), exp, `${v.name}: ${k} = ${q[k]} expected ${exp}`);
  }
});
test('engine embedded verbatim', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/pricing.js'), 'utf8');
  const body = src.split('/* ---- engine.js (verbatim) ---- */\n')[1].split('\n/* ---- end engine.js ---- */')[0];
  const h = crypto.createHash('sha256').update(body).digest('hex');
  assert.ok(src.includes('engine.js sha256: ' + h), 'embedded engine differs from the recorded hash');
  const orig = '/workspace/finance/pricing_v4/engine.js';
  if (fs.existsSync(orig)) assert.strictEqual(body, fs.readFileSync(orig, 'utf8'), 'js/pricing.js is out of date with finance/pricing_v4/engine.js');
});
