// Hold My Spot: a booking at a blocked venue (e.g. a DMV) must be rejected, even if book_() is called directly.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const toasts = [], ctx = { AU: { require: () => true }, SETTINGS: require('../js/settings.js').SETTINGS, S: { c: { screen: 'lineReview', ln: null }, line: null }, R() {}, haptic() {}, toast: t => toasts.push(t), h() { return {}; }, icon: () => '', $: () => null, money: v => '$' + v, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/line.js'), 'utf8') + '\nthis.LN = LN; this.lineBlocked = lineBlocked;', ctx);
  return { ctx, toasts };
}
const form = place => ({ place, start: Date.now() + 3 * 3600e3, hours: 3 });
test('DMV venue is blocked', () => { const { ctx } = load(); assert.ok(ctx.lineBlocked({ name: 'DMV Garden City', addr: '801 Franklin Ave' })); });
test('booking at a DMV is rejected', () => {
  const { ctx, toasts } = load();
  ctx.S.c.ln = form({ name: 'NYS DMV Garden City', addr: '801 Franklin Ave, Garden City, NY', lat: 40.72, lng: -73.63, types: [] });
  ctx.LN.book_();
  assert.strictEqual(ctx.S.line, null, 'blocked venue produced a booking');
  assert.notStrictEqual(ctx.S.c.screen, 'lineStatus');
  assert.match(toasts[0], /DMV/);
});
test('booking at a government type venue is rejected', () => {
  const { ctx } = load();
  ctx.S.c.ln = form({ name: 'Nassau Building', addr: 'Mineola, NY', lat: 40.74, lng: -73.64, types: ['courthouse'] });
  ctx.LN.book_(); assert.strictEqual(ctx.S.line, null);
});
test('booking at an allowed venue goes through', () => {
  const { ctx } = load();
  ctx.S.c.ln = form({ name: 'Apple Fifth Avenue', addr: '767 5th Ave, New York, NY', lat: 40.76, lng: -73.97, types: [] });
  ctx.LN.book_(); assert.ok(ctx.S.line && ctx.S.line.status === 'requested');
});
