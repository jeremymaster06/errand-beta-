const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const calls = [], maps = [];
  class LatLng { constructor(a, b) { this.a = a; this.b = b; } lat() { return this.a; } lng() { return this.b; } }
  class Map { constructor(div, opts) { this.div = div; this.opts = opts; maps.push(this); } getDiv() { return this.div; }
    setCenter(c) { calls.push(['center', c]); } setZoom(z) { calls.push(['zoom', z]); } fitBounds() { calls.push(['fit']); } }
  class Marker { constructor() {} setMap() {} setPosition() {} }
  class LatLngBounds { extend() {} }
  const node = () => ({ style: {}, children: [], appendChild(c) { this.children.push(c); }, replaceChildren() { this.children = []; }, contains(x) { return this.children.includes(x); }, clientHeight: 600, firstChild: null });
  const ctx = { MAPS_API_KEY: 'test', MAPS_MAP_ID: '', console, Promise, JSON, Set, Math, Number, String,
    matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ getPropertyValue: () => '#000' }),
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, performance: { now: () => 0 }, dom: () => ({}),
    document: { createElement: node, head: { appendChild() {} }, documentElement: {}, getElementById: () => null } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/maps.js'), 'utf8'), ctx);
  ctx.google = { maps: { Map, Marker, LatLng, LatLngBounds, SymbolPath: { CIRCLE: 0 } } };
  return { ctx, calls, maps, node };
}
test('single-point map centers at zoom 15 with keyboard shortcuts off', () => {
  const { ctx, calls, maps, node } = load(), el = node(), p = { lat: 40.79, lng: -73.73, kind: 'start' };
  ctx.Maps.render(el, { pts: [p], path: [], start: p }); ctx.__errandMapsReady();
  assert.strictEqual(ctx.Maps.mode, 'google');
  assert.strictEqual(maps.at(-1).opts.keyboardShortcuts, false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls)), [['center', p], ['zoom', 15]]);
});
test('two identical points also center at zoom 15; distinct points fit bounds', () => {
  const a = load(), p = { lat: 40.79, lng: -73.73 };
  a.ctx.Maps.render(a.node(), { pts: [p, { ...p }], path: [] }); a.ctx.__errandMapsReady();
  assert.deepStrictEqual(a.calls.map(c => c[0]), ['center', 'zoom']);
  const b = load();
  b.ctx.Maps.render(b.node(), { pts: [p, { lat: 40.8, lng: -73.7 }], path: [] }); b.ctx.__errandMapsReady();
  assert.deepStrictEqual(b.calls.map(c => c[0]), ['fit']);
});
