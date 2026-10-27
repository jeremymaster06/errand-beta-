// Shield: no HTML-string sinks anywhere in js/. DOM is built with createElement/textContent (dom() / h()).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
test('js/ has no innerHTML, outerHTML, insertAdjacentHTML or document.write', () => {
  const dir = path.join(__dirname, '../js'), bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')))
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((l, i) => { if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(l)) bad.push(f + ':' + (i + 1)); });
  assert.deepStrictEqual(bad, []);
});
// Rule (see dom() in icons.js): no ${...} data inside href=, src= or style= in templates.
// Allowed: the two existing style values, which are computed from numbers/booleans only.
test('templates never interpolate into href, src or style', () => {
  const dir = path.join(__dirname, '../js'), ok = [/^style="\$\{o\.inset \? '--inset:' \+ o\.inset \+ 'px'/, /^style="display:\$\{scene\.runner == null \? 'none' : 'block'\}/], bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')))
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/(?:href|src|style)="[^"]*\$\{[^"]*/g)) if (!ok.some(r => r.test(m[0]))) bad.push(f + ': ' + m[0].slice(0, 60));
  assert.deepStrictEqual(bad, []);
});
