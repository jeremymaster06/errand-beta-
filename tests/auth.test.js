// Auth helpers: no password at all (not even a hash), input validation, account whitelisting, safe markdown parsing.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path');
const { AUTHX, ACCOUNT_FIELDS, AUTH_STR } = require('../js/auth.js');
const SRC = fs.readFileSync(path.join(__dirname, '../js/auth.js'), 'utf8');
test('no password or hashing code anywhere in auth.js', () => {
  assert.ok(!/PBKDF2|deriveBits|importKey|type:\s*'password'|auPw|validPw|verify\(|AUTH_CFG/.test(SRC), 'password/hash code found');
  assert.ok(!('hash' in AUTHX) && !('verify' in AUTHX) && !('validPw' in AUTHX));
  assert.ok(!Object.values(AUTH_STR).some(s => /password is incorrect/i.test(s)), 'wrong-password error still present');
  assert.strictEqual(AUTH_STR.demo, "Demo sign-in — don't use a real password");
});
test('account records keep only whitelisted keys (legacy password/hash/salt stripped)', () => {
  assert.deepStrictEqual(ACCOUNT_FIELDS, ['id', 'name', 'contact', 'createdAt', 'acks']);
  const legacy = { id: 'a', name: 'Ann', contact: 'ann@example.com', createdAt: 'x', acks: [], salt: 'AA==', hash: 'BB==', iter: 310000, alg: 'PBKDF2-SHA256', password: 'p', pw: 'p' };
  const c = AUTHX.clean(legacy);
  assert.deepStrictEqual(Object.keys(c).sort(), ['acks', 'contact', 'createdAt', 'id', 'name']);
  assert.ok(!/salt|hash|iter|alg|password|"pw"/.test(JSON.stringify(c)));
});
test('sign-in matches name plus email or phone', () => {
  const accts = [{ id: '1', name: 'Ann Lee', contact: 'ann@example.com' }, { id: '2', name: 'Rae', contact: '5165550199' }];
  assert.strictEqual(AUTHX.find(accts, ' ann lee ', 'ann@example.com').id, '1');
  assert.strictEqual(AUTHX.find(accts, 'Rae', AUTHX.normContact('(516) 555-0199')).id, '2');
  assert.strictEqual(AUTHX.find(accts, 'Bob', 'ann@example.com'), null, 'wrong name must not sign in');
  assert.strictEqual(AUTHX.find(accts, 'Ann Lee', 'other@example.com'), null);
});
test('validation', () => {
  assert.strictEqual(AUTHX.normContact(' Ann@Example.COM '), 'ann@example.com'); assert.strictEqual(AUTHX.normContact('(516) 555-0100'), '5165550100');
  assert.strictEqual(AUTHX.normContact('abc'), null); assert.strictEqual(AUTHX.validName('<script>'), null); assert.strictEqual(AUTHX.validName('Ann'), 'Ann');
});
test('every gated screen uses the one shared session check', () => {
  const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8'), line = fs.readFileSync(path.join(__dirname, '../js/line.js'), 'utf8');
  assert.ok(/if \(!AU\.session\(\)\)/.test(app), 'R() must gate on AU.session()');
  assert.ok(/require\(\) \{ if \(AU\.session\(\)\)/.test(SRC) && /render\(\) \{[^]*?AU\.session\(\)/.test(SRC), 'require/render must use session()');
  assert.ok(!/AU\.user\(|typeof AU/.test(app + line + SRC), 'a second session check exists');
  assert.ok(/C\.confirm|confirm\(\) \{\s*if \(!AU\.require\(\)\)/.test(app) && /clockIn\(\) \{ if \(!AU\.require\(\)\)/.test(app) && /book_\(\) \{\s*if \(!AU\.require\(\)\)/.test(line));
});
test('markdown parsed to nodes, never HTML', () => {
  const made = []; const mk = tag => { const n = { tag, kids: [], append(...k) { this.kids.push(...k); } }; made.push(n); return n; };
  const doc = { createDocumentFragment: () => mk('#frag'), createElement: mk, createTextNode: t => ({ text: t }) };
  const f = AUTHX.md(doc, '# Title\n> **DRAFT**\n- a <img src=x onerror=1>\n\nPara');
  assert.deepStrictEqual(f.kids.map(k => k.tag), ['h2', 'blockquote', 'ul', 'p']);
  assert.strictEqual(f.kids[2].kids[0].kids[0].text, 'a <img src=x onerror=1>'); // kept as text
});
