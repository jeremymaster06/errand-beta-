'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let lastScreenKey = '';
function haptic() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } }
function toast(msg, ic = 'check') { const t = $('#toast'); t.replaceChildren(dom(icon(ic, 's')), Object.assign(document.createElement('span'), { textContent: msg })); t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
const act = (name, ...args) => `data-act="${esc(name)}"${args.length ? ` data-args="${esc(JSON.stringify(args))}"` : ''}`;
const ACTION_ROOTS = () => ({ C, RN, OW, AS, LN, AU });
const ACTION_FNS = () => ({ toast });
function runAction(name, args) {
  const [root, fn] = String(name).split('.');
  const f = fn ? (Object.prototype.hasOwnProperty.call(ACTION_ROOTS(), root) && ACTION_ROOTS()[root]) : ACTION_FNS();
  const key = fn || root;
  if (!f || !Object.prototype.hasOwnProperty.call(f, key) || typeof f[key] !== 'function') return;
  f[key].apply(f, args);
}
const argsOf = el => { try { const a = JSON.parse(el.dataset.args || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
function wireActions() {
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) runAction(el.dataset.act, argsOf(el)); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el) runAction(el.dataset.change, [...argsOf(el), el.value]); });
  document.addEventListener('keydown', e => { const el = e.target.closest('[data-enter]'); if (el && e.key === 'Enter') runAction(el.dataset.enter, [el.value]); });
}
const cell = (o) => { const t = o.tap ? 'span' : 'div';
  return `<${o.tap ? 'button type="button"' : 'div'} class="cell ${o.tap ? 'tap' : ''}" ${o.tap || ''} style="${o.inset ? '--inset:' + o.inset + 'px' : (o.ic ? '--inset:58px' : '')}">
  ${o.ic ? `<${t} class="ic ${o.icc || ''}">${icon(o.ic)}</${t}>` : ''}${o.left || ''}
  <${t} class="grow"><${t} class="title ${o.tcls || ''}">${o.title}</${t}>${o.sub ? `<${t} class="subt">${o.sub}</${t}>` : ''}</${t}>
  ${o.acc != null ? `<${t} class="acc">${o.acc}</${t}>` : ''}${o.chev ? `<span class="chev">${icon('chevR', 's')}</span>` : ''}</${o.tap ? 'button' : 'div'}>`; };
const empty = (title, line, btn) => `<div class="estate"><div class="hl">${esc(title)}</div><p class="sub sec">${esc(line)}</p>${btn || ''}</div>`;
const group = (h, cells, f) => `${h ? `<div class="group-h">${h}</div>` : ''}<div class="group">${cells.join('')}</div>${f ? `<div class="group-f">${f}</div>` : ''}`;
const seg = (opts, cur, fn) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? 'on' : ''}" ${act(fn, v)}>${l}</button>`).join('')}</div>`;
function sheet(o) {
  const cur = S.det[o.id] || o.def || 'medium';
  return `<div class="sheet ${o.tabbar ? 'has-tabbar' : ''} ${o.solid ? 'solid' : ''}" data-sheet="${o.id}" data-detents="${(o.detents || ['medium', 'large']).join(',')}" data-detent="${cur}">
   <div class="grabber" title="Drag to resize"><i></i></div>${o.head ? `<div class="sh-head">${o.head}</div>` : ''}
   <div class="sh-body" data-scroll="sb-${o.id}">${o.body}</div>${o.foot ? `<div class="sh-foot">${o.foot}</div>` : ''}</div>`;
}
function page(title, body, o = {}) {
  return `<div class="page ${o.notab ? 'notab' : ''}" data-scroll="pg-${title}"><div class="navbar"><div class="nl">${o.back ? `<button class="backbtn" ${o.back}>${icon('chevL')}${o.backLabel || 'Back'}</button>` : ''}</div><div class="nt">${title}</div><div class="nr">${o.right || ''}</div></div>
  <h1 class="lt">${title}</h1><div class="page-body">${body}</div></div>`;
}
const tabbar = (tabs, cur, fn) => `<nav class="tabbar">${tabs.map(([k, l, ic]) => `<button class="${k === cur ? 'on' : ''}" ${act(fn, k)} aria-label="${l}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`;
function sceneFor(stops, opts = {}) {
  const start = opts.start || HUB, end = opts.end === undefined ? destOf() : opts.end;
  const r = computeRoute(stops, start, end);
  const order = opts.order || r.order;
  const pts = [{ ...start, kind: 'start' }];
  if (end) pts.push({ ...end, kind: 'end' });
  order.forEach((i, k) => pts.push({ ...placeOf(stops[i]), kind: 'stop', label: k + 1, done: opts.doneCount != null && k < opts.doneCount }));
  const path = [start].concat(order.map(i => placeOf(stops[i]))); if (end) path.push(end);
  let runnerT = null;
  if (opts.progress != null) {
    const legs = []; for (let i = 1; i < path.length; i++) legs.push(RouteSolver.haversineMi(path[i - 1], path[i]));
    const tot = legs.reduce((a, b) => a + b, 0) || 1; let acc = 0; for (let i = 0; i < Math.min(opts.progress, legs.length); i++) acc += legs[i];
    runnerT = acc / tot;
  }
  return { pts, path, runner: runnerT, start, final: !!opts.final };
}
function homeScene() {
  const hm = homePlace(); return { pts: [{ ...hm, kind: 'end' }], path: [], runner: null, start: hm };
}
function stopLine(s) {
  const k = s.items.length, goods = s.items.reduce((a, x) => a + (+x.p || 0), 0);
  if (TYPES[s.type].store) return k ? k + (k === 1 ? ' item' : ' items') + (goods ? ' · ' + money(goods) : '') : 'No items yet';
  const from = s.from && S.stops.concat(S.trip ? S.trip.stops : []).find(x => x.id === s.from), what = s.items.map(x => x.n).join(', ');
  return (s.type === 'Drop-off' ? 'Drop off' : s.type === 'Custom task' ? 'Task' : 'Pick up') + (what ? ': ' + what : from ? ' from ' + placeOf(from).name : '');
}
function trackStatus(t) {
  const n = t.stops.length, o = t.q.route.order;
  if (t.status === 'matching') return t.counter ? t.runnerName + ' proposed a new price' : 'Waiting for ' + t.runnerName + ' to accept';
  if (t.status === 'declined') return t.runner ? t.runnerName + " can't take this one" : 'Pick a runner for this errand';
  if (t.status === 'delivered') return 'Delivered';
  if (t.status === 'done') return 'All stops complete';
  return t.step === 0 ? 'Heading to ' + placeOf(t.stops[o[0]]).name : t.step >= n ? 'Heading to your final drop-off' : 'Stop ' + (t.step + 1) + ' of ' + n + ': ' + placeOf(t.stops[o[t.step]]).name;
}
function routeList(stops, order, o = {}) {
  const carried = new Set(); let rows = `<div class="rstop"><div class="rail"><span class="n start"></span></div><div><div class="hl">${esc(o.start.name)}</div><div class="fn">${esc(o.start.addr)}</div></div></div>`;
  order.forEach((i, k) => {
    const s = stops[i], p = placeOf(s), done = o.done != null && k < o.done, cur = o.done === k;
    const drops = stops.filter(x => x.from === s.id);
    if (s.type === 'Personal pickup' || TYPES[s.type].store || drops.length) carried.add(s.id);
    if (s.from) carried.delete(s.from);
    const carrying = [...carried].map(id => stops.find(x => x.id === id)).filter(Boolean);
    const linked = s.from ? stops.find(x => x.id === s.from) : null;
    rows += `<div class="rstop" ${cur ? 'style="background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:12px;margin:0 -8px;padding:10px 8px"' : ''}><div class="rail"><span class="n ${done ? 'done' : ''}">${done ? icon('check', 's') : k + 1}</span></div><div style="flex:1;min-width:0">
      <div class="hl">${esc(p.name)}</div><div class="fn">${esc(s.type)} · ${esc(p.addr || '')}</div>
      ${s.items.length ? `<div class="sub sec" style="margin-top:2px">${s.items.map(x => esc(x.n)).join(', ')}</div>` : ''}
      ${linked ? `<div class="carry" style="margin-top:4px">${icon('box', 's')}Drop off: ${esc(linked.items.map(x => x.n).join(', ') || 'item')} from ${esc(placeOf(linked).name)}</div>` : ''}
      ${!done && carrying.length && o.carry !== false ? `<div class="carry" style="margin-top:4px;color:var(--label2)">${icon('bag', 's')}Carrying after: ${carrying.map(x => esc(placeOf(x).name)).join(', ')}</div>` : ''}
      ${o.proof && done ? `<div class="fn green" style="margin-top:2px">${icon('camera', 's')} Photo proof · ${TYPES[s.type].store ? 'receipt uploaded' : 'handed off'}</div>` : ''}</div></div>`;
  });
  if (o.end) rows += `<div class="rstop"><div class="rail"><span class="n end">${icon('house', 's')}</span></div><div><div class="hl">${esc(o.end.name)}</div><div class="fn">${esc(o.end.addr)}</div><div class="fn">Final drop-off: all items delivered here</div></div></div>`;
  return `<div class="group" style="padding:4px 16px">${rows}</div>`;
}
const CAT_NAMES = { groceries: 'Groceries', returns: 'Returns & drop-offs', cleaning: 'Dry cleaning', weekly: 'Repeat weekly errands', post: 'Post office & packages', gifts: 'Gifts & flowers' };
function tripCat(t) { if (!t) return 'Errand'; if (t.recur) return CAT_NAMES.weekly; const k = t.preset && t.preset.key; return CAT_NAMES[k] || 'Errand'; }
const me = () => AU.session() || null;
const myNotes = () => { const u = me(); return (S.notes || []).filter(n => n.to === S.view && (S.view !== 'r' || !n.rid || (u && n.rid === u.id))); };
let seenNote = null;
function pingNotes() {
  const list = myNotes(), last = list[list.length - 1];
  if (seenNote === null) { seenNote = last ? last.id : ''; return; }
  if (last && last.id !== seenNote && !last.read) { seenNote = last.id; toast(last.text, 'bell'); }
}
const cloneStops = st => st.map(s => ({ ...s, items: s.items.map(i => ({ ...i })), id: 's' + (++_sid) }));
const tripLite = q => ({ route: { order: q.route.order, miles: q.route.miles }, timing: q.timing, when: q.when, cap: q.cap, goods: q.goods, miles: q.miles, eta: q.eta });
const C = {
  go(screen) { S.c.screen = screen; haptic(); R(); },
  tab(t) { S.c.tab = t; S.c.screen = t; R(); },
  addPlace(k, t) { const L = Places.LOCAL.find(x => x.id === k); if (L && Places.STORE_KINDS.includes(L.kind)) { Places.resolve({ src: 'local', place: L, kind: L.kind }).then(pl => ST.open(pl)); return; } S.stops.push(mkStop(t, k)); haptic(); R(); toast('Added ' + PLACES[k].name); },
  remove(id) { S.stops = S.stops.filter(s => s.id !== id); S.stops.forEach(s => { if (s.from === id) s.from = null; }); S.cap = null; S.c.screen = 'stops'; R(); },
  start() { if (S.trip) { C.go('tracking'); toast('You have an errand in progress'); return; } S.c.screen = 'stops'; if (!S.stops.length) AS.open(); else R(); },
  newOrder() { if (typeof TL !== 'undefined') TL.clear(); C.start(); },
  edit(id) { const s = S.stops.find(x => x.id === id); if (TYPES[s.type].store && storeKindOf(s)) ST.edit(id); else PL.edit(id); },
  timing(v) { S.timing = ORD.mode(S.stops, v); haptic(); R(); },
  window(v) { if (ORD.windows().some(w => w[0] === v)) S.when = v; R(); },
  addDropoff() { AS.open({ type: 'Drop-off' }); },
  dest() { AS.open({ dest: true }); },
  home() { AS.open({ home: true }); },
  cap(d) { const q = quote(); S.cap = Math.max(0, (S.cap == null ? q.suggested : S.cap) + d); R(); },
  pick(id) { if (S.c.runner !== id) S.c.agree = false; S.c.runner = id; haptic(); R(); },
  route(k) { if ((S.c.route || 'cheap') !== k) S.c.agree = false; S.c.route = k; haptic(); R(); },
  fav(id) { const f = S.prefs.favs = S.prefs.favs || []; const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); R(); toast(i >= 0 ? 'Removed from favorites' : 'Saved to favorites'); },
  confirm() {
    if (!AU.require()) return;
    if (!S.prefs.home && !S.dest) { C.dest(); toast('Add where everything should be delivered'); return; }
    if (isRide(S.c.note)) { toast(RIDE_MSG, 'alert'); return; }
    if (!S.pay.method) { C.useTestMethod(); return; }
    const q = quote(); if (!q.runner) { toast('Choose a runner first'); return; }
    if (!S.c.agree) { toast('Check the box to agree to the job agreement first'); return; }
    const r = S.runners[q.runner.id], dest = destOf(); haptic();
    S.trip = { id: 'T' + Date.now().toString(36), status: 'matching', step: 0, runner: r.id, runnerName: r.name, price: q.runner.price, q: tripLite(q), total: q.total,
      window: q.timing === 'flex' ? ORD.flexWindow() : null, at: Date.now(), dest: { name: dest.name, addr: dest.addr, lat: dest.lat, lng: dest.lng },
      stops: S.stops.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })), contract: errandContract(S.stops, q, r, dest), chat: [], proof: [], counter: null, preset: null, subs: S.subs, notes: S.c.note || '', consent: { text: agreeText(q), version: 'job-v1', at: Date.now() } };
    S.c.agree = false; S.c.runner = null; S.c.route = null; S.stops = []; S.dest = null; S.cap = null; S.c.note = ''; S.realRoute = null;
    notify('r', 'New request from ' + custName() + ': ' + S.trip.stops.length + ' stop' + (S.trip.stops.length === 1 ? '' : 's') + ', ' + money(q.runner.price), 'drive', r.id);
    S.c.screen = 'tracking'; R();
  },
  cancel() { const T = S.trip; if (!T) return; const free = T.status === 'matching' || T.status === 'declined'; if (T.runner) notify('r', 'The customer cancelled their errand', 'drive', T.runner); S.trip = null; S.c.screen = 'home'; R(); toast(free ? 'Errand cancelled. No charge.' : 'Errand cancelled. You pay only for items already bought.'); },
  repick() { const T = S.trip; if (!T) return; S.stops = T.stops.map(s => ({ ...s })); S.trip = null; S.c.runner = null; S.c.screen = 'review'; R(); },
  approveCounter() { const T = S.trip; if (!T || !T.counter) return; T.total = Math.round((T.total - T.price + T.counter.price) * 100) / 100; T.price = T.counter.price; T.contract = T.contract.replace(/^Price: [^,]+, set by the runner\./m, 'Price: ' + money(T.price) + ', set by the runner.'); T.counter = null; C.accepted(T); R(); toast('New price approved'); },
  declineCounter() { const T = S.trip; if (!T || !T.counter) return; notify('r', 'The customer declined your new price', 'drive', T.runner); T.status = 'declined'; T.counter = null; R(); },
  accepted(T) { T.status = 'accepted'; T.step = 0; T.times = T.stops.map(() => ({})); notify('r', 'Price approved. The job is yours.', 'drive', T.runner); },
  chat(text) { const T = S.trip || S.line; const t = String(text || '').trim().slice(0, 300); if (!T || !t) return; if (isRide(t)) { toast(RIDE_MSG, 'alert'); return; } T.chat = (T.chat || []).concat({ from: 'c', text: t, at: Date.now() }); notify('r', custName() + ': ' + t, 'chat', T.runner); R(); },
  rate(n) { S.c.rate = Object.assign(S.c.rate || {}, { stars: n }); R(); },
  tip(v) { S.c.rate = Object.assign(S.c.rate || {}, { tip: v }); R(); },
  submitRating() {
    const T = S.trip; if (!T || T.status !== 'delivered') return; const RT = S.c.rate || {}, r = S.runners[T.runner];
    if (r && RT.stars) r.rating = [(r.rating ? r.rating[0] : 0) + RT.stars, (r.rating ? r.rating[1] : 0) + 1];
    if (r && RT.tip) { const e = (r.earn || []).find(x => x.id === T.id); if (e) e.tip = RT.tip; notify('r', custName() + ' tipped you ' + money(RT.tip) + ' (test mode)', 'earn', r.id); }
    S.history.unshift({ kind: 'errand', id: T.id, status: 'delivered', cat: tripCat(T), title: tripCat(T) + ' · ' + T.stops.length + ' stop' + (T.stops.length === 1 ? '' : 's'), total: T.price + (T.proof || []).reduce((a, p) => a + (+p.total || 0), 0), price: T.price, tip: RT.tip || 0, stars: RT.stars || null,
      runner: T.runner, runnerName: T.runnerName, timing: T.q.timing, at: Date.now(), stops: T.stops.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })), dest: T.dest, photo: safeImg(T.deliveryPhoto) });
    S.history = S.history.slice(0, 30); S.trip = null; S.c.rate = null; S.c.screen = 'home'; R(); toast('Thanks! Receipt saved in Activity.');
  },
  order(i) { S.c.order = i; C.go('order'); },
  reorder(i) { const x = S.history[i]; if (!x || !x.stops) return; if (S.trip) { toast('Finish your current errand first'); return; } S.stops = cloneStops(x.stops); S.c.runner = S.runners[x.runner] && runnerReady(S.runners[x.runner]) ? x.runner : null; S.cap = null; S.c.screen = 'review'; R(); },
  help(i) { S.c.help = { i: i == null ? null : i, issue: '', note: '' }; C.go('help'); },
  issue(v) { S.c.help.issue = v; R(); },
  sendHelp() {
    const H = S.c.help; if (!H || !H.issue) return; const x = H.i == null ? S.trip : S.history[H.i];
    const rec = { id: 'H' + Date.now().toString(36), at: Date.now(), issue: H.issue, note: String(H.note || '').slice(0, 400), from: custName(), title: x ? (x.title || tripCat(x)) : 'General question', runner: x ? x.runner : null, runnerName: x ? x.runnerName : null, status: 'open' };
    S.support.unshift(rec); if (rec.runner) notify('r', 'A customer reported: ' + rec.issue, 'earn', rec.runner);
    S.c.help = null; S.c.screen = 'activity'; S.c.tab = 'activity'; R(); toast('Sent. Your runner and our support team can see it.');
  },
  toggleSubs() { S.subs = !S.subs; R(); },
  useTestMethod() { S.pay.method = { kind: 'test', label: 'Test card ···· 4242' }; if (S.c.screen === 'addPayment') S.c.screen = S.c.payBack || 'review'; S.c.payBack = null; haptic(); R(); toast('Test card added. Demo only, nothing is charged.'); },
  removeMethod() { S.pay.method = null; R(); },
  notes() { myNotes().forEach(n => n.read = true); C.go('notes'); },
  openNote(id) { const n = S.notes.find(x => x.id === id); if (!n) return; n.read = true; const g = n.go; if (g === 'chat' && S.trip) C.go('chat'); else if (g === 'tracking' && S.trip) C.go('tracking'); else if (g === 'lineStatus') LN.go('lineStatus'); else C.tab('activity'); },
  delAsk() { S.c.del = true; R(); }, delNo() { S.c.del = false; R(); }
};
const OVER = ['add', 'place', 'store']; let lastSc = '';
const bell = () => { const n = myNotes().filter(x => !x.read).length; return `<button class="bell" id="bellBtn" aria-label="Notifications${n ? ', ' + n + ' unread' : ''}" ${act(S.view === 'c' ? 'C.notes' : 'RN.notes')}>${icon('bell')}${n ? '<i class="dot"></i>' : ''}</button>`; };
function finalRow(back) {
  const d = destOf();
  return `<div class="final" id="finalDrop"><span class="sn end">${icon('house', 's')}</span><span class="grow"><span class="sub">Final drop-off: all items delivered here</span><span class="fn ellip" id="finalAddr">${esc(d.unset ? 'Add an address' : d.name + (d.addr && d.name !== d.addr ? ' · ' + d.addr : ''))}</span></span><button class="btn sm gray" id="destChange" ${act('C.dest')}>${d.unset ? 'Add' : 'Change'}</button></div>`;
}
function customer() {
  const sc = S.c.screen; const wasOver = OVER.includes(lastSc); lastSc = sc; let html = '', scene = null, tab = false, map = true, mount = null;
  if (sc === 'home') {
    tab = true; scene = homeScene(); const t = S.trip, L = S.line;
    const again = S.history.map((x, i) => [x, i]).filter(([x]) => x.stops && x.stops.length).slice(0, 2);
    html = sheet({ id: 'home', detents: ['peek', 'medium', 'large'], def: 'medium', tabbar: true,
      head: `<div class="hrow"><span class="wordmark">errandco</span>${bell()}</div><button class="search" id="newOrderBtn" ${act('C.newOrder')}>${icon('search')}<span>Where should a runner go?</span></button>`,
      body: (t ? `<div class="group live" id="liveCard">${cell({ ic: t.status === 'delivered' ? 'star' : 'route', title: esc(t.status === 'delivered' ? 'Rate your errand with ' + t.runnerName : ORD.phaseLabel(t) || trackStatus(t)), sub: esc(trackStatus(t)), chev: 1, tap: act('C.go', t.status === 'delivered' ? 'rate' : 'tracking') })}</div>` : '')
        + (L ? `<div class="group live">${cell({ ic: 'clock', title: esc(LINE_STR.tileTitle), sub: esc(L.place.name + ' · ' + (L.status === 'requested' ? 'Waiting for ' + L.runnerName : L.status === 'declined' ? L.runnerName + " can't take it" : L.status === 'almost' ? 'Almost your turn' : new Date(L.start).getTime() > Date.now() ? 'Accepted · starts ' + L.startLabel : L.runnerName + ' is in line')), chev: 1, tap: act('LN.go', 'lineStatus') })}</div>` : '')
        + `<div class="tiles">
        <button class="tile" id="tileErrands" ${act('C.start')}><span class="tile-ic">${icon('route')}</span><span class="tile-t">Errands</span><span class="tile-s">Stores and pickups in one trip.</span></button>
        <button class="tile" id="tileLine" ${act('LN.open')}><span class="tile-ic">${icon('clock')}</span><span class="tile-t">${esc(LINE_STR.tileTitle)}</span><span class="tile-s">${esc(LINE_STR.tileSub)}</span></button></div>`
        + (!t && S.stops.length ? `<div class="group">${cell({ ic: 'list', title: 'Continue your errand', sub: S.stops.length + ' stop' + (S.stops.length === 1 ? '' : 's'), chev: 1, tap: act('C.go', 'stops') })}</div>` : '')
        + (again.length ? group('Order again', again.map(([x, i]) => cell({ ic: 'ret', title: esc(x.title), sub: esc(x.stops.map(s => placeOf(s).name).join(', ')), acc: `<button class="btn sm gray" id="reorder-${i}" ${act('C.reorder', i)}>Reorder</button>` }))) : '')
        + `<div id="tileGrid"></div>` });
  }
  if (LN.screens.includes(sc)) { map = false; html = LN.shell(sc); }
  if (typeof TL !== 'undefined' && TL.screens.includes(sc)) { map = false; html = TL.shell(); }
  if (['stops', 'add', 'place', 'store'].includes(sc)) {
    scene = sceneFor(S.stops); const n = S.stops.length;
    html = `<button class="fbtn tl" aria-label="Back" ${act('C.go', 'home')}>${icon('chevL')}</button>` + sheet({ id: 'stops', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<h1 class="t1">Your errand</h1>`,
      body: (n ? `<ol class="slist">${S.stops.map((s, i) => `<li><button class="srow" ${act('C.edit', s.id)}><span class="sn num">${i + 1}</span><span class="grow"><span class="hl ellip">${esc(placeOf(s).name)}</span><span class="fn ellip">${esc(stopLine(s))}</span></span>${icon('chevR', 's')}</button></li>`).join('')}</ol>` : empty('No stops yet', 'Add a store or address. Your runner goes there, then to your final drop-off.'))
        + `<button class="btn gray addstop" id="addStopBtn" ${act('AS.open')}>${icon('plus', 's')}Add stop</button>`
        + (n ? `<button class="quiet" id="addDropoff" ${act('C.addDropoff')}><span class="grow"><span class="sub">Add a drop-off on the way</span><span class="fn">Hand off an item at another address on the same trip.</span></span><span class="tint sub">Add</span></button>` : '')
        + finalRow(),
      foot: `<button class="btn" id="toReview" ${n ? '' : 'disabled'} ${act('C.go', 'review')}>Choose a runner</button>` });
    if (sc !== 'stops') html += `<div class="ovl${wasOver ? '' : ' anim'}"><div class="ovscrim"></div><div class="ovsheet">${addScreens(sc)}</div></div>`;
  }
  if (sc === 'review') {
    if (!S.stops.length) { S.c.screen = 'stops'; return customer(); }
    const q = quote(), r = q.route, d = destOf();
    scene = sceneFor(S.stops, { final: r.pick === 'cheap', order: r.order }); scene.top = 80; scene.bottom = 330;
    const label = !q.runner ? 'Choose a runner' : (!S.prefs.home && !S.dest) ? 'Add drop-off address' : !S.pay.method ? 'Add a test card' : 'Request ' + q.runner.name + ' · ' + money(q.total);
    html = `<button class="fbtn tl" aria-label="Back" ${act('C.go', 'stops')}>${icon('chevL')}</button>` + sheet({ id: 'review', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<h1 class="t1">Review</h1><p class="sub sec">${S.stops.length} stop${S.stops.length === 1 ? '' : 's'} · <span id="rtm" data-dwell="${r.dwell}">${q.miles.toFixed(1)} mi · ~${fmtMin(q.eta)}${q.est ? ' est.' : ' by road'}</span></p>`,
      body: `<ol class="rlist">${r.order.map((i, k) => `<li><span class="sn num">${k + 1}</span><span class="grow"><span class="sub ellip">${esc(placeOf(S.stops[i]).name)}</span><span class="fn ellip">${esc(stopLine(S.stops[i]))}</span></span></li>`).join('')}</ol>${finalRow()}
      <div id="ckRoute"></div><div id="ckTiming"></div><div class="group-h">Choose your runner</div><div id="ckRunners"></div>
      <div class="group">${cell({ title: 'Payment', tap: S.pay.method ? act('C.go', 'addPayment') : act('C.useTestMethod'), acc: S.pay.method ? `<span class="sub sec" id="payMethod">${esc(S.pay.method.label)} · Demo only</span>` : '<span class="sub tint" id="payAdd">Add test card · Demo only</span>' })}</div>
      <div id="ckPrice"></div>
      <details class="more" id="moreOpts"><summary>More options</summary><div class="group">
        ${cell({ title: 'Item hold', sub: 'Items ' + money(q.goods) + ' + ' + money(Math.max(0, q.cap - q.goods)) + ' buffer. Unused hold is released.', acc: `<span class="sub num" id="capVal">${money(q.cap)}</span><div class="stepper"><button aria-label="Lower hold" ${act('C.cap', -5)}>−</button><button aria-label="Raise hold" ${act('C.cap', 5)}>+</button></div>` })}
        ${cell({ title: 'Ask before substituting', acc: `<button class="toggle ${S.subs ? 'on' : ''}" role="switch" aria-checked="${S.subs}" aria-label="Ask before substituting" ${act('C.toggleSubs')}></button>` })}
      </div><div id="ckNote"></div></details>
      <div id="tlReview"></div><div id="ckAgree"></div><p class="fn note blocknote">${esc(typeof TILE_STR !== 'undefined' ? TILE_STR.block : '')} ${esc(RIDE_MSG)}</p>`,
      foot: `<button class="btn" id="payBtn" ${act('C.confirm')} ${q.runner && (!S.pay.method || S.c.agree) ? '' : 'disabled'}>${esc(label)}</button>` });
  }
  if (sc === 'addPayment') {
    map = false;
    html = page('Payment', `<div class="group" id="addPaySheet">${cell({ ic: 'card', title: 'Test mode', sub: 'This test app never asks for card details. Real payments would go through a licensed payment processor straight to your runner.' })}</div>
      <button class="btn" id="useTestMethod" ${act('C.useTestMethod')}>Use test card ···· 4242</button><p class="fn note">Demo only. Nothing is charged.</p>`, { notab: true, back: act('C.go', S.c.payBack || 'review') });
  }
  if (sc === 'tracking') {
    if (!S.trip) { S.c.screen = 'home'; return customer(); }
    const t = S.trip; if (t.status === 'delivered') { S.c.screen = 'rate'; return customer(); }
    scene = sceneFor(t.stops, { final: true, end: t.dest || destOf(), doneCount: t.step, order: t.q.route.order });
    html = `<button class="fbtn tl" aria-label="Minimize" ${act('C.tab', 'home')}>${icon('chevD')}</button>` + sheet({ id: 'track', detents: ['medium', 'large'], def: 'medium', solid: true,
      head: `<div class="eta" id="trkStatus">${esc(t.status === 'declined' ? 'Not accepted' : ORD.phaseLabel(t))}</div><p class="sub sec" id="trkSub">${esc(trackStatus(t))}</p><div class="bar"><i id="trkBar"></i></div>`,
      body: `<div id="trkBody"></div>`,
      foot: t.status === 'declined' ? `<button class="btn" id="repickBtn" ${act('C.repick')}>Choose another runner</button>` : (t.status === 'matching' || (t.status === 'accepted' && !t.step && !(t.times[0] && t.times[0].arrive))) ? `<button class="btn gray" id="cancelTrip" ${act('C.cancel')}>Cancel errand</button>` : `<button class="btn gray" id="chatBtn" ${act('C.go', 'chat')}>Message ${esc(t.runnerName)}</button>` });
    mount = mountTracking;
  }
  if (sc === 'rate') {
    const t = S.trip; if (!t || t.status !== 'delivered') { S.c.screen = 'home'; return customer(); }
    map = false; html = page('Delivered', '<div id="mx"></div>', { notab: true, back: act('C.tab', 'home') }); mount = mountRate;
  }
  if (sc === 'chat') { map = false; html = page('Messages', '<div id="mx"></div>', { notab: true, back: act('C.go', S.trip ? 'tracking' : 'home') }); mount = () => mountChat('c'); }
  if (sc === 'notes') { map = false; html = page('Notifications', '<div id="mx"></div>', { notab: true, back: act('C.tab', 'home') }); mount = () => mountNotes('C.openNote'); }
  if (sc === 'activity') {
    map = false; tab = true;
    const live = [S.trip && cell({ ic: 'route', title: esc(tripCat(S.trip)), sub: esc(ORD.phaseLabel(S.trip) + ' · ' + S.trip.runnerName), chev: 1, tap: act('C.go', 'tracking') }), S.line && cell({ ic: 'clock', title: esc(LINE_STR.tileTitle), sub: esc(S.line.place.name), chev: 1, tap: act('LN.go', 'lineStatus') })].filter(Boolean);
    const mine = S.support.filter(x => x.from === custName());
    html = page('Activity', (live.length ? group('In progress', live) : '') + (S.history.length ? group('Past', S.history.map((x, i) => cell({ ic: x.kind === 'line' ? 'clock' : 'route', title: esc(x.title), sub: new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) + (x.runnerName ? ' · ' + esc(x.runnerName) : ''), acc: money(x.total + (x.tip || 0)), chev: 1, tap: act('C.order', i) }))) : live.length ? '' : empty('No errands yet', 'Your receipts show up here after each errand.', `<button class="btn" id="firstOrder" ${act('C.newOrder')}>Start an errand</button>`))
      + (mine.length ? group('Your reports', mine.map(x => cell({ ic: 'chat', title: esc(x.issue), sub: esc(x.title) + ' · ' + (x.status === 'open' ? 'Open' : 'Reviewed') }))) : ''));
  }
  if (sc === 'order') {
    map = false; const x = S.history[S.c.order]; if (!x) { S.c.screen = 'activity'; return customer(); }
    html = page('Receipt', '<div id="mx"></div>', { notab: true, back: act('C.tab', 'activity') }); mount = mountOrder;
  }
  if (sc === 'help') { map = false; html = page('Get help', '<div id="mx"></div>', { notab: true, back: act('C.tab', 'activity') }); mount = mountHelp; }
  if (sc === 'account') { map = false; tab = true; html = page('Account', '<div id="mx"></div>'); mount = mountAccount; }
  return { html, mount, scene: map ? scene : null, tab: tab ? tabbar([['home', 'Home', 'house'], ['activity', 'Activity', 'clock'], ['account', 'Account', 'person']], S.c.tab, 'C.tab') : '' };
}
window.onRouteMetric = m => {
  if (S.view !== 'c' || S.c.screen !== 'review' || quote().route.pick !== 'cheap') return;
  const sig = stopsSig(S.stops), cur = S.realRoute;
  if (cur && cur.sig === sig && Math.abs(cur.mi - m.mi) < 1e-9 && Math.abs(cur.min - m.min) < 1e-9) return;
  S.realRoute = { sig, mi: m.mi, min: m.min }; R();
};
const row = (l, v, b) => h('div', { class: 'pline' + (b ? ' b' : '') }, h('span', { text: l }), h('span', { class: 'num', text: v }));
const mx = () => { const e = $('#mx'); if (e) e.replaceChildren(); return e; };
const grp = (title, ...kids) => [title ? h('div', { class: 'group-h', text: title }) : '', h('div', { class: 'group' }, ...kids)];
const hcell = (title, sub, acc, o = {}) => h(o.click ? 'button' : 'div', { class: 'cell' + (o.click ? ' tap' : ''), id: o.id || null, on: o.click ? { click: o.click } : null }, o.ic ? h('span', { class: 'ic', ic: [o.ic] }) : '', h('span', { class: 'grow' }, h('span', { class: 'title', text: title }), sub ? h('span', { class: 'subt', text: sub }) : ''), acc || '');
function mountCheckout() {
  const tb = $('#ckTiming'); if (!tb) return;
  const q = quote(), modes = ORD.modes(S.stops);
  const segEl = h('div', { class: 'seg', role: 'tablist', id: 'ckModes', 'aria-label': 'When' }, modes.map(([v, l]) => h('button', { role: 'tab', id: 'ckMode-' + v, class: v === q.timing ? 'on' : '', 'aria-selected': String(v === q.timing), text: l, on: { click: () => C.timing(v) } })));
  const kids = [h('div', { class: 'group-h', text: 'When' }), segEl];
  if (q.timing === 'scheduled') { const sel = h('select', { class: 'whensel', id: 'ckWindow', 'aria-label': 'Requested time' }, ORD.windows().map(([v, l]) => { const o = h('option', { value: v, text: l }); o.selected = v === q.when; return o; })); sel.addEventListener('change', () => C.window(sel.value)); kids.push(sel); }
  kids.push(h('p', { class: 'fn sec', id: q.timing === 'flex' ? 'flexLine' : 'timeNote', text: q.timing === 'flex' ? ORD.flexLine(q, ORD.flexWindow()) : ORD.timeNote[q.timing] }));
  tb.replaceChildren(...kids);
  const rb = $('#ckRoute');
  if (rb && S.stops.length > 1) {
    const RT = q.routes, opt = (k, title) => { const o = RT[k], on = RT.pick === k, p = o.price == null ? '' : (q.runner ? '' : 'from ') + money(o.price);
      return h('button', { type: 'button', class: 'ropt' + (on ? ' on' : ''), id: 'route-' + k, role: 'radio', 'aria-checked': String(on), on: { click: () => C.route(k) } }, h('span', { class: 'rt', text: title }), h('span', { class: 'rp num', text: p }), h('span', { class: 'rs', text: o.miles.toFixed(1) + ' mi · ~' + fmtMin(o.mins) })); };
    rb.replaceChildren(h('div', { class: 'group-h', text: 'Route' }), RT.mine ? h('div', { class: 'ropts', role: 'radiogroup', 'aria-label': 'Route' }, opt('cheap', 'Cheapest route'), opt('mine', 'My order')) : h('div', { class: 'group' }, h('div', { class: 'cell', id: 'routeSame' }, h('span', { class: 'grow' }, h('span', { class: 'title', text: 'Your order is already the cheapest route' }), h('span', { class: 'subt', text: RT.cheap.miles.toFixed(1) + ' mi · ~' + fmtMin(RT.cheap.mins) })))),
      h('p', { class: 'fn sec', text: 'Final drop-off is always last, and every pickup comes before its drop-off.' }));
  } else if (rb) rb.replaceChildren();
  const rk = $('#ckRunners'); if (rk) rk.replaceChildren(runnerPicker(q.offers, q.runner && q.runner.id, C.pick, q.standalone ? 'Add a store or pickup stop. Drop-off-only errands aren’t available.' : 'No runners are taking errands right now. Runners choose their own hours, so check back soon.', R));
  const pb = $('#ckPrice');
  if (pb) pb.replaceChildren(q.runner ? h('div', { class: 'pbox', id: 'priceBox' }, row(q.runner.name + "'s price", money(q.runner.price)), row('Item hold', money(q.cap)), row('Total', money(q.total), 1), h('p', { class: 'fn', text: 'An upfront quote from the runner you pick. Unused hold is released.' })) : '');
  const nb = $('#ckNote'); if (nb) { const t = h('textarea', { class: 'input', id: 'ckNoteIn', rows: 2, maxlength: 300, placeholder: 'Note for your runner (gate code, brands…)', 'aria-label': 'Note for your runner' }); t.value = S.c.note || ''; t.addEventListener('input', () => { S.c.note = t.value; }); nb.replaceChildren(h('div', { class: 'cell' }, t)); }
  const ag = $('#ckAgree');
  if (ag && q.runner) {
    const box = h('input', { type: 'checkbox', id: 'ckConsent' }); box.checked = !!S.c.agree;
    box.addEventListener('change', () => { S.c.agree = box.checked; const b = $('#payBtn'); if (b && S.pay.method) b.disabled = !box.checked; });
    ag.replaceChildren(jobAgreement(errandContract(S.stops, q, S.runners[q.runner.id], destOf())), S.pay.method ? h('label', { class: 'ack', for: 'ckConsent' }, box, h('span', { class: 'fn', text: agreeText(q) })) : '');
  }
}
const agreeText = q => 'I agree to the job agreement with ' + q.runner.name + ' and the Terms, and I authorize a hold of ' + money(q.total) + '. Demo only: nothing is billed.';
const trackPct = t => t.status === 'delivered' ? 100 : t.status === 'declined' ? 0 : ({ matching: 4, accepted: 15, shopping: 15 + 70 * (t.step / Math.max(1, t.stops.length)), on_the_way: 90 }[ORD.phase(t)] || 4);
function mountTracking() {
  const b = $('#trkBody'), t = S.trip; if (!b || !t) return; const bar = $('#trkBar'); if (bar) bar.style.width = Math.round(trackPct(t)) + '%'; const r = S.runners[t.runner], dest = t.dest || destOf();
  const kids = [!t.runner ? '' : h('div', { class: 'group', id: 'runnerCard' }, hcell(t.runnerName, (r ? stars(r.rating) : '') + ' · Independent runner', t.status === 'accepted' ? h('button', { class: 'btn sm gray', id: 'chatOpen', text: 'Message', on: { click: () => C.go('chat') } }) : '', { ic: 'person' }))];
  if (t.counter) kids.push(h('div', { class: 'pbox', id: 'counterBox' }, h('div', { class: 'hl', text: t.runnerName + ' proposed ' + money(t.counter.price) }), t.counter.note ? h('p', { class: 'fn', text: '“' + t.counter.note + '”' }) : '', h('p', { class: 'fn', text: 'Was ' + money(t.price) + '. Approve to book at the new price, or decline at no charge.' }),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn', id: 'approveCounter', text: 'Approve ' + money(t.counter.price), on: { click: C.approveCounter } }), h('button', { class: 'btn gray', id: 'declineCounter', text: 'Decline', on: { click: C.declineCounter } }))));
  else if (t.status === 'matching') kids.push(h('p', { class: 'sub sec', text: t.runnerName + ' sees your request and decides whether to take it. Nothing is charged until they accept.' }));
  if (t.status === 'declined') kids.push(h('p', { class: 'sub sec', id: 'declinedNote', text: 'No charge. Your stops are saved, so you can pick another runner in one tap.' }));
  const order = t.q.route.order, steps = h('ol', { class: 'rlist', id: 'trkSteps' }, order.map((i, k) => { const p = t.proof[k] || {}; return h('li', {}, k < t.step ? h('span', { class: 'sn done', ic: ['check', 's'] }) : h('span', { class: 'sn num', text: String(k + 1) }), h('span', { class: 'grow' }, h('span', { class: 'sub ellip', text: placeOf(t.stops[i]).name }), h('span', { class: 'fn ellip', text: k < t.step ? 'Done' + (p.photo ? ' · photo' : '') + (p.receipt ? ' · receipt ' + money(p.total || 0) : '') : stopLine(t.stops[i]) }))); }),
    h('li', {}, h('span', { class: 'sn end', ic: ['house', 's'] }), h('span', { class: 'grow' }, h('span', { class: 'sub', text: 'Final drop-off: all items delivered here' }), h('span', { class: 'fn', text: dest.addr || dest.name }))));
  kids.push(steps);
  const items = t.proof.reduce((a, p) => a + (+p.total || 0), 0);
  if (t.runner) kids.push(h('div', { class: 'pbox', id: 'receipt' }, row('Runner price', money(t.price)), row('Item hold', money(t.q.cap)), items ? row('Items so far (receipts)', money(items)) : '', row('Total (test mode)', money(t.total), 1)), jobAgreement(t.contract));
  kids.push(h('button', { class: 'btn plain', id: 'trkHelp', text: 'Get help', on: { click: () => C.help(null) } }));
  b.replaceChildren(...kids);
}
function mountRate() {
  const e = mx(), t = S.trip; if (!e || !t) return; const RT = S.c.rate || {}, img = safeImg(t.deliveryPhoto);
  const st = h('div', { class: 'stars', id: 'rateStars', role: 'radiogroup', 'aria-label': 'Rating' }, [1, 2, 3, 4, 5].map(n => h('button', { class: 'star' + (n <= (RT.stars || 0) ? ' on' : ''), id: 'star' + n, role: 'radio', 'aria-checked': String(n === RT.stars), 'aria-label': n + ' star' + (n > 1 ? 's' : ''), ic: ['star', 'l fill'], on: { click: () => C.rate(n) } })));
  const tips = h('div', { class: 'seg', id: 'tipSeg' }, SETTINGS.tips.map(v => h('button', { class: v === (RT.tip || 0) ? 'on' : '', id: 'tip' + v, text: v ? '$' + v : 'No tip', on: { click: () => C.tip(v) } })));
  const items = t.proof.reduce((a, p) => a + (+p.total || 0), 0);
  e.append(h('div', { class: 'hero' }, h('div', { class: 't2', text: 'Delivered by ' + t.runnerName }), h('p', { class: 'sub sec', text: t.dest.addr || t.dest.name })),
    img ? h('img', { class: 'proof', id: 'deliveryPhoto', src: img, alt: 'Delivery photo' }) : '',
    h('div', { class: 'group-h', text: 'Rate ' + t.runnerName }), st, h('p', { class: 'fn sec', text: 'Ratings help other customers choose. They are never used to discipline runners.' }),
    h('div', { class: 'group-h', text: 'Tip (all of it goes to your runner)' }), tips,
    h('div', { class: 'pbox', id: 'finalReceipt' }, row('Runner price', money(t.price)), row('Items (receipts)', money(items)), row('Tip', money(RT.tip || 0)), row('Total (test mode)', money(t.price + items + (RT.tip || 0)), 1), h('p', { class: 'fn', text: 'Unused hold of ' + money(Math.max(0, t.q.cap - items)) + ' released. Paid to ' + t.runnerName + ' through the payment processor. Test mode: no money moved.' })),
    h('button', { class: 'btn', id: 'submitRating', text: 'Done', on: { click: C.submitRating } }));
}
function mountChat(who) {
  const e = mx(); if (!e) return; const T = S.trip || S.line, other = who === 'c' ? (T && T.runnerName) || 'your runner' : 'Customer';
  if (!T || (S.trip && !['accepted', 'delivered'].includes(T.status))) { e.append(h('div', { class: 'estate' }, h('div', { class: 'hl', text: 'No messages' }), h('p', { class: 'sub sec', text: 'You can message once the job is accepted.' }))); return; }
  const list = h('div', { class: 'chat', id: 'chatList' }, (T.chat || []).map(m => h('div', { class: 'msg ' + (m.from === who ? 'me' : 'them') }, h('span', { text: m.text }), h('span', { class: 'cap sec', text: ORD.fmtTime(m.at) }))));
  if (!(T.chat || []).length) list.append(h('p', { class: 'fn sec', text: 'Say hi to ' + other + '.' }));
  const inp = h('input', { class: 'input', id: 'chatIn', maxlength: 300, placeholder: 'Message ' + other, 'aria-label': 'Message' });
  const send = v => who === 'c' ? C.chat(v) : RN.chat(v);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') send(inp.value); });
  const quick = who === 'c' ? ['Thanks!', 'Leave it at the door', 'Call me when you arrive'] : ["I'm at the store", 'Out of stock. OK to substitute?', 'On my way'];
  e.append(list, h('div', { class: 'chips', id: 'chatQuick' }, quick.map(q => h('button', { class: 'chip', text: q, on: { click: () => send(q) } }))),
    h('div', { class: 'chatbar' }, inp, h('button', { class: 'btn sm', id: 'chatSend', text: 'Send', on: { click: () => send(inp.value) } })));
  list.scrollTop = list.scrollHeight;
}
function mountNotes(fn) {
  const e = mx(); if (!e) return; const list = myNotes().slice().reverse();
  if (!list.length) { e.append(h('div', { class: 'estate' }, h('div', { class: 'hl', text: 'No notifications' }), h('p', { class: 'sub sec', text: 'Updates about your jobs show up here.' }))); return; }
  e.append(h('div', { class: 'group', id: 'noteList' }, list.map(n => hcell(n.text, new Date(n.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }), '', { ic: 'bell', click: () => runAction(fn, [n.id]) }))));
}
function mountOrder() {
  const e = mx(), x = S.history[S.c.order]; if (!e || !x) return; const img = safeImg(x.photo), r = S.runners[x.runner], fav = ((S.prefs.favs) || []).includes(x.runner);
  e.append(h('div', { class: 'group' }, hcell(x.title, new Date(x.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) + (x.stars ? ' · You rated ' + x.stars + '★' : ''), '', { ic: x.kind === 'line' ? 'clock' : 'route' }),
    x.runnerName ? hcell(x.runnerName, r ? stars(r.rating) : '', r ? h('button', { class: 'btn sm gray', id: 'favBtn', text: fav ? 'Saved' : 'Save runner', on: { click: () => C.fav(x.runner) } }) : '', { ic: 'person' }) : ''),
    x.stops ? h('div', { class: 'group', id: 'orderStops' }, x.stops.map(s => hcell(placeOf(s).name, stopLine(s)))) : '',
    img ? h('img', { class: 'proof', src: img, alt: 'Delivery photo' }) : '',
    h('div', { class: 'pbox' }, x.price != null ? row('Runner price', money(x.price)) : '', x.kind === 'errand' && x.price != null ? row('Items (receipts)', money(x.total - x.price)) : '', x.tip ? row('Tip', money(x.tip)) : '', row('Total (test mode)', money(x.total + (x.tip || 0)), 1)),
    x.stops ? h('button', { class: 'btn', id: 'reorderBtn', text: 'Reorder', on: { click: () => C.reorder(S.c.order) } }) : '',
    h('button', { class: 'btn gray', id: 'helpBtn', text: 'Get help with this order', on: { click: () => C.help(S.c.order) } }));
}
const ISSUES = ['Missing item', 'Wrong or damaged item', 'Charged the wrong amount', 'Runner safety concern', 'Something else'];
function mountHelp() {
  const e = mx(), H = S.c.help; if (!e || !H) { if (e) e.append(h('p', { class: 'sub sec', text: 'Choose an order in Activity to get help.' })); return; }
  e.append(h('p', { class: 'sub sec', text: 'Tell us what happened. Your runner sees it and can make it right. Safety or fraud issues also go to our support team.' }),
    h('div', { class: 'group', role: 'radiogroup', id: 'issueList' }, ISSUES.map((v, i) => h('button', { class: 'cell tap' + (H.issue === v ? ' on' : ''), id: 'issue' + i, role: 'radio', 'aria-checked': String(H.issue === v), on: { click: () => C.issue(v) } }, h('span', { class: 'grow title', text: v }), H.issue === v ? h('span', { class: 'tint', ic: ['check', 's'] }) : ''))));
  const t = h('textarea', { class: 'input', id: 'helpNote', rows: 3, maxlength: 400, placeholder: 'Add details (optional)', 'aria-label': 'Details' }); t.value = H.note; t.addEventListener('input', () => { H.note = t.value; });
  e.append(h('div', { class: 'group' }, h('div', { class: 'cell' }, t)), h('button', { class: 'btn', id: 'sendHelp', disabled: !H.issue, text: 'Send report', on: { click: C.sendHelp } }));
}
function mountAccount() {
  const e = mx(), u = me(); if (!e) return; const hm = S.prefs.home, favs = (S.prefs.favs || []).map(id => S.runners[id]).filter(Boolean);
  e.append(...grp('Profile', hcell(u ? u.name : 'Not signed in', u ? u.contact : '', '', { ic: 'person' })),
    ...grp('Addresses', hcell('Home', hm ? hm.addr : 'Add your home address', h('span', { class: 'tint sub', text: hm ? 'Change' : 'Add' }), { ic: 'house', id: 'homeCell', click: C.home })),
    ...grp('Payment', hcell(S.pay.method ? S.pay.method.label : 'No payment method', 'Demo only. Nothing is charged.', h('span', { class: 'tint sub', text: S.pay.method ? 'Remove' : 'Add' }), { ic: 'card', id: 'payCell', click: () => { if (S.pay.method) C.removeMethod(); else { S.c.payBack = 'account'; C.go('addPayment'); } } })),
    ...grp('Favorite runners', ...(favs.length ? favs.map(r => hcell(r.name, stars(r.rating), h('button', { class: 'btn sm gray', text: 'Remove', on: { click: () => C.fav(r.id) } }), { ic: 'person' })) : [hcell('No favorites yet', 'Save a runner from a receipt.')])),
    ...grp('Settings', hcell('Ask before substituting', '', h('button', { class: 'toggle' + (S.subs ? ' on' : ''), role: 'switch', 'aria-checked': String(S.subs), 'aria-label': 'Ask before substituting', on: { click: C.toggleSubs } })),
      hcell('Notifications', myNotes().filter(n => !n.read).length + ' unread', h('span', { class: 'chev', ic: ['chevR', 's'] }), { ic: 'bell', click: C.notes }),
      hcell('Get help', '', h('span', { class: 'chev', ic: ['chevR', 's'] }), { ic: 'chat', click: () => C.help(null) })),
    ...grp('Legal', hcell('Terms of Service', 'Draft', '', { click: () => AU.openDoc('terms') }), hcell('Privacy Policy', 'Draft', '', { click: () => AU.openDoc('privacy') })),
    h('button', { class: 'btn plain', id: 'signOut', text: 'Sign out', on: { click: AU.signOut } }),
    S.c.del ? h('div', { class: 'pbox', id: 'delConfirm' }, h('p', { class: 'sub', text: 'Delete your account and history from this device? This can’t be undone.' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn danger', id: 'delYes', text: 'Delete account', on: { click: AU.deleteAccount } }), h('button', { class: 'btn gray', id: 'delNo', text: 'Keep account', on: { click: C.delNo } })))
      : h('button', { class: 'btn plain danger', id: 'delAcct', text: 'Delete account', on: { click: C.delAsk } }));
}
function signedOut() { S.c = { screen: 'home', tab: 'home' }; S.stops = []; S.cap = null; S.pay.method = null; S.r = { tab: 'drive', id: null, job: null }; S.o = { tab: 'overview' }; seenNote = null; }
function clearPersonalData(id) {
  if (S.view === 'c') { Object.assign(S, { stops: [], trip: null, line: null, history: [], weekly: null, cap: null, realRoute: null, dest: null }); S.prefs = { home: null }; S.notes = S.notes.filter(n => n.to !== 'c'); S.pay.method = null; }
  if (S.view === 'r' && id) { delete S.runners[id]; S.notes = S.notes.filter(n => n.rid !== id); }
  signedOut(); Store.save();
}
const LOC_COPY = 'Location is used only during an active job. Raw GPS is kept for 30 days at most; after that only a route summary stays on the order.';
const SHOP_NOTE = 'Pick items off the shelf at shelf price and snap the receipt. Item costs come from the customer’s card hold, never your own money.';
const RN = {
  me() {
    const u = me(); if (!u) return null;
    const r = S.runners[u.id] || (S.runners[u.id] = { id: u.id, name: u.name, pricing: null, rates: null, area: null, online: false, sub: null, rating: null, jobs: 0, jobLog: [], earn: [], onDays: [], since: Date.now() });
    r.name = u.name; return r;
  },
  tab(t) { S.r.tab = t; S.r.sc = null; R(); },
  sc(x) { S.r.sc = x; if (!x) { S.r.plan = null; S.r.rd = null; S.r.cancel = false; S.r.chg = null; } haptic(); R(); },
  notes() { myNotes().forEach(n => n.read = true); RN.sc('notes'); },
  openNote(id) { const n = S.notes.find(x => x.id === id); if (n) n.read = true; S.r.sc = n && n.go === 'chat' ? 'chat' : null; S.r.tab = n && n.go === 'earn' ? 'earn' : 'drive'; R(); },
  online() {
    const r = RN.me(); if (!r) return; if (!runnerReady(r)) { toast(r.pricing ? 'Choose a plan first' : 'Set your pricing first'); return; }
    r.online = !r.online; if (r.online) { const d = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); if (!r.onDays.includes(d)) r.onDays.push(d); }
    haptic(); R(); toast(r.online ? 'You’re available. Go offline anytime.' : 'You’re offline. No penalty, ever.');
  },
  draft() { const r = RN.me(); return S.r.rd || (S.r.rd = { pricing: r.pricing, area: r.area, rates: Object.fromEntries(RATE_KEYS.map(k => [k, r.rates && r.rates[k] != null ? String(r.rates[k]) : ''])) }); },
  saveRates() {
    const r = RN.me(), D = RN.draft(); if (!D.pricing) { toast('Choose how you price your jobs'); return; }
    if (!D.area) { toast('Choose where you usually start'); return; }
    const rates = cleanRates(D.rates);
    if (D.pricing === 'own' && !ratesOk(rates)) { toast('Enter your errand price to use your own rates'); return; }
    r.pricing = D.pricing; r.rates = rates; r.area = D.area; S.r.rd = null; S.r.sc = null; haptic(); R(); toast('Pricing saved');
  },
  pickTier(k) { S.r.plan = { tier: k, ok: false }; haptic(); R(); },
  consent(v) { if (S.r.plan) S.r.plan.ok = v; R(); },
  subscribe() {
    const r = RN.me(), P = SETTINGS.plan; if (!r || !S.r.plan || !S.r.plan.ok || !S.r.plan.tier) return;
    const T = tierOf(S.r.plan.tier), now = Date.now(), text = SETTINGS.subscription.consent(P, T); r.trialFrom = r.trialFrom || now;
    r.sub = { tier: T.key, status: 'active', since: now, consent: { text, disclosure: SETTINGS.subscription.disclosure(P, T), version: SETTINGS.subscription.version, at: now } };
    S.subLog.unshift({ id: 'S' + now.toString(36), runner: r.id, name: r.name, action: 'start', tier: T.key, text, version: SETTINGS.subscription.version, at: now });
    S.r.plan = null; S.r.sc = 'planDone'; haptic(); R();
  },
  changeAsk(k) { S.r.chg = k; R(); },
  changeNo() { S.r.chg = null; R(); },
  changeTier(k) {
    const r = RN.me(), F = subFor(r); if (!F || F.key === k) return; const T = tierOf(k), P = SETTINGS.plan, now = Date.now(), text = SETTINGS.subscription.change(T, F), up = P.tiers.indexOf(T) > P.tiers.indexOf(F);
    r.sub.tier = T.key; r.sub.consent = { text, disclosure: SETTINGS.subscription.disclosure(P, T), version: SETTINGS.subscription.version, at: now };
    S.subLog.unshift({ id: 'S' + now.toString(36), runner: r.id, name: r.name, action: up ? 'upgrade' : 'downgrade', from: F.name, tier: T.key, text, version: SETTINGS.subscription.version, at: now });
    S.r.chg = null; haptic(); R(); toast('You’re on ' + T.name + ' now');
  },
  cashOut() {
    const r = RN.me(); if (!r) return; const co = cashoutState(r); if (!co.can) return; const now = Date.now();
    (r.earn || []).forEach(x => { if (!x.paid) { x.paid = true; x.payout = 'Instant cash-out, free'; } });
    r.cashouts = (r.cashouts || []).concat(now); haptic(); R(); toast('Cashed out ' + money(co.balance) + ' (test mode). Free.');
  },
  declineUpgrade() { const r = RN.me(); if (!r || !r.sub) return; r.sub.declined = monthKey(); R(); toast('No change. Nothing extra is charged.'); },
  cancelAsk() { S.r.cancel = true; R(); },
  cancelNo() { S.r.cancel = false; R(); },
  cancelPlan() {
    const r = RN.me(); if (!r || !r.sub || r.sub.status !== 'active') return; const now = Date.now();
    S.subLog.unshift({ id: 'S' + now.toString(36), runner: r.id, name: r.name, action: 'cancel', tier: r.sub.tier, at: now });
    r.sub.status = 'cancelled'; r.sub.cancelledAt = now; r.online = false; S.r.cancel = false; R(); toast('Plan cancelled. You won’t be charged again.');
  },
  offer() { const T = S.trip, r = RN.me(); return T && r && T.runner === r.id ? T : null; },
  lineOffer() { const L = S.line, r = RN.me(); return L && r && L.runner === r.id ? L : null; },
  accept() {
    const T = RN.offer(), r = RN.me(); if (!T || T.status !== 'matching' || T.counter) return;
    T.status = 'accepted'; T.step = 0; T.times = T.stops.map(() => ({})); T.proof = T.stops.map(() => ({})); T.card = S.r.card ? { last4: String(4000 + Math.floor(Math.random() * 999)).slice(-4), limit: T.q.cap } : null;
    notify('c', r.name + ' accepted your errand', 'tracking'); haptic(); R(); toast('Job accepted');
  },
  decline() { const T = RN.offer(); if (!T || T.status !== 'matching') return; T.status = 'declined'; T.counter = null; notify('c', T.runnerName + " can't take your errand. Pick another runner.", 'tracking'); R(); toast('Declined. No penalty.'); },
  counter() {
    const T = RN.offer(), v = +(S.r.cp || ''); if (!T || T.status !== 'matching') return;
    if (!(v > 0)) { toast('Enter your price for this job'); return; }
    T.counter = { price: Math.round(v * 100) / 100, note: String(S.r.cn || '').slice(0, 140) }; S.r.cp = ''; S.r.cn = ''; S.r.cpOpen = false;
    notify('c', T.runnerName + ' proposed ' + money(T.counter.price) + ' for your errand', 'tracking'); R(); toast('Price sent. The customer decides.');
  },
  arrive() { const T = RN.offer(); if (!T || T.status !== 'accepted') return; const k = T.step, tm = T.times[k] || (T.times[k] = {}); if (!tm.arrive) tm.arrive = Date.now(); notify('c', T.runnerName + ' arrived at ' + placeOf(T.stops[T.q.route.order[k]]).name, 'tracking'); R(); },
  photo(kind, data) { const T = RN.offer(); if (!T) return; if (kind === 'deliver') T.deliveryPhoto = data; else { const p = T.proof[T.step] || (T.proof[T.step] = {}); p[kind] = data; } R(); },
  total(v) { const T = RN.offer(); if (!T) return; const p = T.proof[T.step] || (T.proof[T.step] = {}); p.total = Math.max(0, +v || 0); },
  completeStop() {
    const T = RN.offer(); if (!T || T.status !== 'accepted' || T.step >= T.stops.length) return;
    const k = T.step, s = T.stops[T.q.route.order[k]], p = T.proof[k] || {}, store = TYPES[s.type] && TYPES[s.type].store && s.type !== 'Returns' && s.type !== 'Post office' && s.type !== 'Dry cleaning';
    if (!p.photo) { toast('Add a photo first'); return; } if (store && (!p.receipt || !(p.total > 0))) { toast('Add the receipt photo and total'); return; }
    T.times[k].done = Date.now(); T.step = k + 1; haptic();
    notify('c', T.step >= T.stops.length ? T.runnerName + ' is heading to your final drop-off' : 'Stop ' + (k + 1) + ' done: ' + placeOf(s).name, 'tracking'); R();
  },
  deliver() {
    const T = RN.offer(), r = RN.me(); if (!T || T.status !== 'accepted' || T.step < T.stops.length) return;
    if (!safeImg(T.deliveryPhoto)) { toast('Add a delivery photo first'); return; }
    T.status = 'delivered'; T.deliveredAt = Date.now(); r.jobs = (r.jobs || 0) + 1; r.jobLog.push(Date.now());
    r.earn.unshift({ id: T.id, at: Date.now(), title: tripCat(T) + ' · ' + T.stops.length + ' stop' + (T.stops.length === 1 ? '' : 's'), price: T.price, tip: 0, fee: procFee(T.price), payout: 'Weekly payout, free', paid: false }); r.earn = r.earn.slice(0, 50);
    notify('c', 'Delivered! Rate ' + r.name + ' and add a tip.', 'tracking'); S.r.sc = null; haptic(); R(); toast('Delivered. Added to your free weekly payout.');
  },
  chat(text) { const T = RN.offer() || RN.lineOffer(), t = String(text || '').trim().slice(0, 300); if (!T || !t) return; T.chat = (T.chat || []).concat({ from: 'r', text: t, at: Date.now() }); notify('c', T.runnerName + ': ' + t, 'chat'); R(); },
  acceptLine() { const L = RN.lineOffer(), r = RN.me(); if (!L || L.status !== 'requested') return; L.status = 'holding'; L.code = LN.newCode(); L.sitStart = Date.now(); notify('c', r.name + ' accepted your line sitting', 'lineStatus'); haptic(); R(); toast('Line sitting accepted'); },
  declineLine() { const L = RN.lineOffer(); if (!L || L.status !== 'requested') return; L.status = 'declined'; notify('c', L.runnerName + " can't take your line sitting. Pick another runner.", 'lineStatus'); R(); toast('Declined. No penalty.'); },
  almost() { const L = RN.lineOffer(); if (!L) return; L.status = 'almost'; notify('c', 'Almost your turn at ' + L.place.name + '. Head over.', 'lineStatus'); R(); toast('Customer notified'); },
  end() {
    const L = RN.lineOffer(), r = RN.me(); if (!L) return; const end = Date.now();
    r.jobs = (r.jobs || 0) + 1; r.jobLog.push(end); r.earn.unshift({ id: L.id, at: end, title: LINE_STR.tileTitle + ' · ' + L.place.name, price: L.est.total, tip: 0, fee: procFee(L.est.total), payout: 'Weekly payout, free', paid: false });
    S.history.unshift({ kind: 'line', id: L.id, cat: LINE_STR.tileTitle, title: LINE_STR.tileTitle + ' · ' + L.place.name, total: L.est.total, price: L.est.total, runner: r.id, runnerName: r.name, at: end });
    S.line = null; notify('c', 'Line sitting finished. Receipt in Activity.', 'activity'); R(); toast('Finished. Added to your free weekly payout.');
  }
};
function runnerView() {
  const r = RN.me(), sc = S.r.sc, t = S.r.tab;
  if (!r) return { html: '' };
  const titles = { rates: 'Your pricing', plan: 'Subscription', planDone: 'Plan started', chat: 'Messages', notes: 'Notifications' };
  if (sc && titles[sc]) return { html: page(titles[sc], '<div id="mx"></div>', { notab: true, back: act('RN.sc', '') }), mount: sc === 'chat' ? () => mountChat('r') : sc === 'notes' ? () => mountNotes('RN.openNote') : () => RUNNER_MOUNT[sc](r) };
  const title = { drive: 'Jobs', earn: 'Earnings', acct: 'Account' }[t] || 'Jobs';
  return { html: page(title, '<div id="mx"></div>', { right: bell() }), mount: () => RUNNER_MOUNT[t](r), tab: tabbar([['drive', 'Jobs', 'route'], ['earn', 'Earnings', 'card'], ['acct', 'Account', 'person']], t, 'RN.tab') };
}
const chev = () => h('span', { class: 'chev', ic: ['chevR', 's'] });
const RUNNER_MOUNT = {
  drive(r) {
    const e = mx(); if (!e) return; const T = RN.offer(), L = RN.lineOffer(), tier = subFor(r);
    if (!runnerReady(r)) {
      e.append(h('p', { class: 'sub sec', text: AUTH_STR.runnerPitch }), h('div', { class: 'group', id: 'setupList' },
        hcell('1. Set your pricing', runnerPriced(r) ? (r.pricing === 'engine' ? 'Using the pricing engine' : 'Your own rates') : 'Your own rates, or the optional pricing engine', runnerPriced(r) ? h('span', { class: 'green', ic: ['check', 's'] }) : chev(), { id: 'setupRates', click: () => RN.sc('rates') }),
        hcell('2. Choose your plan', tier ? planStatus(r) : 'Free for your first ' + SETTINGS.plan.pilotJobs + ' jobs or ' + SETTINGS.plan.pilotWeeks + ' weeks. No per-job fees.', tier ? h('span', { class: 'green', ic: ['check', 's'] }) : chev(), { id: 'setupPlan', click: () => RN.sc('plan') })),
        h('p', { class: 'fn sec', text: 'Then turn on Available whenever you like. You choose every job and your own hours.' }));
      return;
    }
    e.append(h('div', { class: 'group', id: 'availCell' }, hcell(r.online ? 'Available' : 'Offline', r.online ? 'Customers see you as available now.' : 'Customers can still send you scheduled requests.', h('button', { class: 'toggle' + (r.online ? ' on' : ''), id: 'onlineToggle', role: 'switch', 'aria-checked': String(!!r.online), 'aria-label': 'Available', on: { click: RN.online } }))));
    if (T) RUNNER_MOUNT.job(r, T, e);
    if (L) RUNNER_MOUNT.line(r, L, e);
    const pu = tier && planUsage(r); if (pu && pu.offer) e.append(h('div', { class: 'group', id: 'upgradeNudge' }, hcell('Optional upgrade available', pu.jobs + ' jobs this month, over ' + tier.name + '’s ' + tier.max + '. Accept or decline. Nothing is charged automatically.', chev(), { ic: 'sparkles', click: () => RN.sc('plan') })));
    if (!T && !L) e.append(h('div', { class: 'estate', id: 'noOffers' }, h('div', { class: 'hl', text: 'No requests right now' }), h('p', { class: 'sub sec', text: 'When a customer picks you, their request shows up here with the details and your price before you decide.' })));
  },
  job(r, T, e) {
    const order = T.q.route.order, items = T.stops.reduce((a, s) => a + s.items.length, 0);
    if (T.status === 'matching') {
      e.append(h('div', { class: 'group-h', text: 'New request' }), h('div', { class: 'offer', id: 'offerCard' },
        h('div', { class: 't2 num', id: 'offerPrice', text: money(T.counter ? T.counter.price : T.price) }), h('p', { class: 'fn sec', text: T.counter ? 'You proposed this price. Waiting for the customer.' : r.pricing === 'engine' ? 'Pricing engine quote' : 'From your rates' }),
        h('p', { class: 'sub', text: T.stops.length + ' stop' + (T.stops.length === 1 ? '' : 's') + ' · ' + items + ' item' + (items === 1 ? '' : 's') + ' · ' + T.q.miles.toFixed(1) + ' mi · ~' + fmtMin(T.q.eta) }),
        h('p', { class: 'fn', text: (T.q.timing === 'scheduled' ? 'Requested: ' + ORD.windowLabel(T.q) : T.q.timing === 'flex' && T.window ? 'Flexible: ' + ORD.fmtTime(T.window.start) + '–' + ORD.fmtTime(T.window.end) : 'ASAP') + ' · Item hold ' + money(T.q.cap) }),
        h('ol', { class: 'rlist' }, order.map((i, k) => h('li', {}, h('span', { class: 'sn num', text: String(k + 1) }), h('span', { class: 'grow' }, h('span', { class: 'sub', text: placeOf(T.stops[i]).name }), h('span', { class: 'fn', text: stopLine(T.stops[i]) })))),
          h('li', {}, h('span', { class: 'sn end', ic: ['house', 's'] }), h('span', { class: 'grow' }, h('span', { class: 'sub', text: 'Final drop-off' }), h('span', { class: 'fn', text: T.dest.addr || T.dest.name })))),
        T.notes ? h('p', { class: 'fn', text: 'Note: ' + T.notes }) : '',
        jobAgreement(T.contract)));
      if (T.counter) return;
      const card = h('input', { type: 'checkbox', id: 'useCard' }); card.checked = !!S.r.card; card.addEventListener('change', () => { S.r.card = card.checked; });
      e.append(h('label', { class: 'ack', for: 'useCard' }, card, h('span', { text: 'Use a single-use purchase card for this order (optional, test mode). Limit ' + money(T.q.cap) + ', funded by the customer’s card hold.' })));
      if (S.r.cpOpen) {
        const p = h('input', { class: 'input', id: 'counterPrice', inputmode: 'decimal', placeholder: 'Your price for this job ($)', 'aria-label': 'Your price for this job', maxlength: 8 }); p.value = S.r.cp || ''; p.addEventListener('input', () => { S.r.cp = p.value; });
        const n = h('input', { class: 'input', id: 'counterNote', placeholder: 'Why (optional)', 'aria-label': 'Reason', maxlength: 140 }); n.value = S.r.cn || ''; n.addEventListener('input', () => { S.r.cn = n.value; });
        e.append(h('div', { class: 'group' }, h('div', { class: 'cell' }, p), h('div', { class: 'cell' }, n)), h('button', { class: 'btn', id: 'sendCounter', text: 'Send new price', on: { click: RN.counter } }), h('button', { class: 'btn plain', text: 'Keep my quote', on: { click: () => { S.r.cpOpen = false; R(); } } }));
        return;
      }
      e.append(h('button', { class: 'btn', id: 'acceptTrip', text: 'Accept · ' + money(T.price), on: { click: RN.accept } }),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn gray', id: 'counterBtn', text: 'Change price', on: { click: () => { S.r.cpOpen = true; R(); } } }), h('button', { class: 'btn gray', id: 'declineTrip', text: 'Decline', on: { click: RN.decline } })),
        h('p', { class: 'fn sec', text: 'Declining or going offline never affects you.' }));
      return;
    }
    if (T.status === 'declined' || T.status === 'delivered') { e.append(h('p', { class: 'fn sec', text: T.status === 'delivered' ? 'Last job delivered. Waiting for the customer’s rating.' : 'You declined the last request.' })); return; }
    const k = T.step, n = T.stops.length;
    e.append(h('div', { class: 'group-h', text: 'Active job · ' + money(T.price) }), h('div', { class: 'group' }, hcell('Customer', T.dest.addr || '', h('button', { class: 'btn sm gray', id: 'rChat', text: 'Message', on: { click: () => RN.sc('chat') } }), { ic: 'person' })));
    if (T.card) e.append(h('p', { class: 'fn', id: 'cardNote', text: 'Single-use card ···· ' + T.card.last4 + ' · limit ' + money(T.card.limit) + ' · this order only (test mode)' }));
    const steps = h('ol', { class: 'rlist', id: 'jobSteps' }, order.map((i, j) => h('li', { class: j === k ? 'cur' : '' }, j < k ? h('span', { class: 'sn done', ic: ['check', 's'] }) : h('span', { class: 'sn num', text: String(j + 1) }), h('span', { class: 'grow' }, h('span', { class: 'sub', text: placeOf(T.stops[i]).name }), h('span', { class: 'fn', text: stopLine(T.stops[i]) })))));
    e.append(steps);
    if (k < n) {
      const s = T.stops[order[k]], pl = placeOf(s), tm = T.times[k] || {}, p = T.proof[k] || {}, store = TYPES[s.type] && TYPES[s.type].store && !['Returns', 'Post office', 'Dry cleaning'].includes(s.type), url = mapsUrl(pl);
      const box = h('div', { class: 'stepbox', id: 'stepBox' }, h('div', { class: 'hl', text: 'Stop ' + (k + 1) + ' of ' + n + ': ' + pl.name }), h('p', { class: 'fn', text: pl.addr || '' }));
      if (url) box.append(h('a', { class: 'btn gray', id: 'navBtn', href: url, text: 'Navigate in Maps' }));
      if (!tm.arrive) box.append(h('button', { class: 'btn', id: 'arriveBtn', text: 'I’m here', on: { click: RN.arrive } }));
      else {
        if (store) box.append(h('p', { class: 'fn', text: SHOP_NOTE }));
        box.append(photoBtn('ph-photo', store ? 'Photo of items' : 'Photo proof', !!p.photo, d => RN.photo('photo', d)));
        if (store) { box.append(photoBtn('ph-receipt', 'Receipt photo', !!p.receipt, d => RN.photo('receipt', d))); const tot = h('input', { class: 'input', id: 'rcptTotal', inputmode: 'decimal', placeholder: 'Receipt total ($)', 'aria-label': 'Receipt total', maxlength: 8 }); if (p.total) tot.value = p.total; tot.addEventListener('input', () => RN.total(tot.value)); box.append(tot); }
        box.append(h('button', { class: 'btn', id: 'completeStop', text: 'Complete stop', on: { click: RN.completeStop } }));
      }
      e.append(box);
    } else {
      const url = mapsUrl(T.dest), box = h('div', { class: 'stepbox', id: 'stepBox' }, h('div', { class: 'hl', text: 'Final drop-off: all items delivered here' }), h('p', { class: 'fn', text: T.dest.addr || T.dest.name }));
      if (url) box.append(h('a', { class: 'btn gray', id: 'navBtn', href: url, text: 'Navigate in Maps' }));
      box.append(photoBtn('ph-deliver', 'Delivery photo', !!safeImg(T.deliveryPhoto), d => RN.photo('deliver', d)), h('button', { class: 'btn', id: 'deliverBtn', text: 'Mark delivered', on: { click: RN.deliver } }));
      e.append(box);
    }
  },
  line(r, L, e) {
    e.append(h('div', { class: 'group-h', text: L.status === 'requested' ? 'New line sitting request' : 'Line sitting' }), h('div', { class: 'offer', id: 'lineOffer' },
      h('div', { class: 't2 num', text: money(L.est.total) }), h('p', { class: 'sub', text: L.place.name + ' · ' + L.startLabel + ' · ' + L.hours + ' hr' }), h('p', { class: 'fn', text: L.place.addr || '' }), L.code ? h('p', { class: 'sub', text: 'Handoff code ' + L.code }) : '', jobAgreement(L.contract)));
    if (L.status === 'requested') e.append(h('button', { class: 'btn', id: 'acceptLine', text: 'Accept · ' + money(L.est.total), on: { click: RN.acceptLine } }), h('button', { class: 'btn gray', id: 'declineLine', text: 'Decline', on: { click: RN.declineLine } }));
    else if (L.status !== 'declined') e.append(mapsUrl(L.place) ? h('a', { class: 'btn gray', href: mapsUrl(L.place), text: 'Navigate in Maps' }) : '', L.status === 'holding' ? h('button', { class: 'btn', id: 'lineAlmost', text: 'Almost their turn', on: { click: RN.almost } }) : '', h('button', { class: 'btn gray', id: 'lineEnd', text: 'Finish', on: { click: RN.end } }));
  },
  earn(r) {
    const e = mx(); if (!e) return; const E = r.earn || [], tier = subFor(r);
    const gross = E.reduce((a, x) => a + x.price + (x.tip || 0), 0), fees = E.reduce((a, x) => a + x.fee, 0);
    e.append(h('div', { class: 'pbox', id: 'earnSum' }, row('Job earnings', money(E.reduce((a, x) => a + x.price, 0))), row('Tips (all yours)', money(E.reduce((a, x) => a + (x.tip || 0), 0))), row('Card processing (processor)', '−' + money(fees)), row('Your earnings', money(gross - fees), 1),
      h('p', { class: 'fn', text: 'ErrandCo takes no commission and no per-job fee.' })));
    const co = cashoutState(r), dl = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ });
    const pay = [hcell('Weekly payout · free', money(co.balance) + ' on ' + dl(co.weekly) + '. ' + SETTINGS.payouts.weekly, null, { id: 'weeklyCell' })];
    if (co.allowed) pay.push(h('div', { class: 'cell', id: 'cashCell' }, h('span', { class: 'grow' }, h('span', { class: 'title', text: 'Instant cash-out' }), h('span', { class: 'subt', id: 'cashCount', text: co.left + ' of ' + co.allowed + ' free instant cash-outs left' }), h('span', { class: 'subt', id: 'cashWhy', text: !co.left ? 'Instant cash-out is unavailable until ' + dl(co.reset) + '. Your weekly payout is still free.' : co.why || (co.balance > 0 ? '' : 'Nothing to cash out yet.') })),
      h('button', { class: 'btn sm', id: 'cashOutBtn', disabled: !co.can, text: 'Cash out', on: { click: RN.cashOut } })));
    e.append(...grp('Payouts', ...pay));
    e.append(...grp('Subscription', hcell(tier ? planStatus(r) : 'No active plan', 'Billed to your card separately, never taken from payouts.', chev(), { id: 'earnPlan', click: () => RN.sc('plan') })));
    e.append(...grp('Jobs', ...(E.length ? E.map(x => hcell(x.title, new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ }) + ' · ' + x.payout + (x.tip ? ' · tip ' + money(x.tip) : ''), h('span', { class: 'num', text: money(x.price + (x.tip || 0) - x.fee) }))) : [hcell('No jobs yet', 'Completed jobs and payouts show up here.')])));
    const rep = S.support.filter(x => x.runner === r.id);
    if (rep.length) e.append(...grp('Customer reports', ...rep.map(x => hcell(x.issue, x.title + (x.note ? ' · ' + x.note : ''), ''))));
  },
  acct(r) {
    const e = mx(); if (!e) return; const tier = subFor(r), u = me();
    e.append(...grp('Profile', hcell(r.name, (u && u.contact) || '', '', { ic: 'person' }), hcell('Rating', stars(r.rating) + ' · shown to customers only', '')),
      ...grp('Your business', hcell('Pricing', r.pricing === 'engine' ? 'Pricing engine' : r.pricing === 'own' ? 'Your rates from ' + money(r.rates.base) : 'Not set', chev(), { id: 'acctRates', click: () => RN.sc('rates') }),
        hcell('Subscription', tier ? planStatus(r) : 'No active plan', chev(), { id: 'acctPlan', click: () => RN.sc('plan') }),
        hcell('Hours', 'You choose. Turn on Available whenever you like.', '')),
      ...grp('Privacy', hcell('Location', LOC_COPY, '')),
      ...grp('Legal', hcell('Terms of Service', 'Draft', '', { click: () => AU.openDoc('terms') }), hcell(AUTH_DOCS.gps.title, 'Draft', '', { click: () => AU.openDoc('gps') })),
      h('button', { class: 'btn plain', id: 'signOut', text: 'Sign out', on: { click: AU.signOut } }),
      S.r.del ? h('div', { class: 'pbox', id: 'delConfirm' }, h('p', { class: 'sub', text: 'Delete your runner account from this device?' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn danger', id: 'delYes', text: 'Delete account', on: { click: AU.deleteAccount } }), h('button', { class: 'btn gray', text: 'Keep account', on: { click: () => { S.r.del = false; R(); } } })))
        : h('button', { class: 'btn plain danger', id: 'delAcct', text: 'Delete account', on: { click: () => { S.r.del = true; R(); } } }));
  },
  rates(r) {
    const e = mx(); if (!e) return; const D = RN.draft();
    const radio = (v, t, sub) => { const i = h('input', { type: 'radio', name: 'pricing', id: 'pr-' + v, value: v }); i.checked = D.pricing === v; i.addEventListener('change', () => { D.pricing = v; R(); }); return h('label', { class: 'cell ack', for: i.id }, i, h('span', { class: 'grow' }, h('span', { class: 'title', text: t }), h('span', { class: 'subt', text: sub }))); };
    e.append(h('p', { class: 'sub sec', text: 'You decide what to charge. There’s no default and no limit. You can also change the price on any single job before you accept.' }),
      h('div', { class: 'group', id: 'pricingChoice', role: 'radiogroup' }, radio('own', 'My own rates', 'Customers see your rate card.'), radio('engine', 'Pricing engine', 'An automatic quote from time and miles. Optional; it doesn’t affect how customers find you.')));
    if (D.pricing === 'own') e.append(h('div', { class: 'group-h', text: 'Your rates' }), h('div', { class: 'group', id: 'rateFields' }, SETTINGS.rates.fields.map(([k, l, u]) => {
      const i = h('input', { class: 'input num', id: 'rate-' + k, inputmode: 'decimal', maxlength: 8, 'aria-label': l, placeholder: u }); i.value = D.rates[k]; i.addEventListener('input', () => { D.rates[k] = i.value; });
      return h('div', { class: 'cell' }, h('span', { class: 'grow' }, h('span', { class: 'title', text: l }), h('span', { class: 'subt', text: u })), i); })),
      h('p', { class: 'fn sec', text: 'Leave line sitting empty if you don’t offer it.' }));
    const sel = h('select', { class: 'input', id: 'areaSel', 'aria-label': 'Where you usually start' }, h('option', { value: '', text: 'Where you usually start' }), SETTINGS.areas.map(([k, n]) => { const o = h('option', { value: k, text: n }); o.selected = k === D.area; return o; }));
    sel.addEventListener('change', () => { D.area = sel.value || null; });
    e.append(h('div', { class: 'group-h', text: 'Starting area' }), h('div', { class: 'group' }, h('div', { class: 'cell' }, sel)), h('p', { class: 'fn sec', text: 'Used only to show customers how far you are.' }),
      h('button', { class: 'btn', id: 'saveRates', text: 'Save pricing', on: { click: RN.saveRates } }));
  },
  plan(r) {
    const e = mx(); if (!e) return; const P = SETTINGS.plan, cur = subFor(r), u = planUsage(r), pick = S.r.plan && S.r.plan.tier;
    const label = h('p', { class: 'fn note', id: 'planLabel', text: P.label + '. ' + SETTINGS.planNote });
    const pilot = h('div', { class: 'group', id: 'planPilot' }, hcell('Free pilot', 'Your first ' + P.pilotJobs + ' jobs or ' + P.pilotWeeks + ' weeks, whichever comes first. Then your plan starts.'));
    const terms = h('div', { class: 'group', id: 'planTerms' }, hcell('Payouts', SETTINGS.payouts.weekly + ' Every plan.'), hcell('Instant cash-out eligibility', SETTINGS.payouts.eligibility));
    const tierBtn = (T, on, click) => h('button', { type: 'button', class: 'cell tap tier' + (on ? ' on' : ''), id: 'tier-' + T.key, role: 'radio', 'aria-checked': String(on), on: { click } }, h('span', { class: 'grow' }, h('span', { class: 'title', text: T.name }), h('span', { class: 'subt', text: jobRange(T) + ' a month' }), h('span', { class: 'fn', id: 'perk-' + T.key, text: T.cashouts ? SETTINGS.payouts.pro : SETTINGS.payouts.weekly })), h('span', { class: 'num sub', text: money(T.price) + '/month' }));
    if (cur) {
      const offer = u.offer ? h('div', { class: 'pbox', id: 'upgradeOffer' }, h('p', { class: 'sub', text: 'You’ve done ' + u.jobs + ' jobs this month, over ' + cur.name + '’s ' + cur.max + '. Want ' + u.next.name + ' (' + money(u.next.price) + ' a month, ' + jobRange(u.next) + ')?' }), u.next.cashouts ? h('p', { class: 'fn', text: SETTINGS.payouts.pro }) : '', h('p', { class: 'fn sec', text: 'Optional. Nothing changes and nothing extra is charged unless you accept.' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn', id: 'upgradeYes', text: 'Switch to ' + u.next.name, on: { click: () => RN.changeTier(u.next.key) } }), h('button', { class: 'btn gray', id: 'upgradeNo', text: 'No thanks', on: { click: RN.declineUpgrade } }))) : '';
      const T = S.r.chg && tierOf(S.r.chg);
      const chg = T ? h('div', { class: 'pbox', id: 'changeConfirm' }, h('p', { class: 'sub', text: SETTINGS.subscription.change(T, cur) }), h('p', { class: 'fn sec', text: 'Takes effect now. Billed separately, never taken from your payouts. Demo only. Nothing is billed.' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn', id: 'changeYes', text: 'Switch to ' + T.name, on: { click: () => RN.changeTier(T.key) } }), h('button', { class: 'btn gray', id: 'changeNo', text: 'Keep ' + cur.name, on: { click: RN.changeNo } }))) : '';
      e.append(h('div', { class: 'pbox', id: 'planCur' }, h('div', { class: 'hl', text: cur.name }), h('p', { class: 'sub', id: 'planNow', text: planStatus(r) }), h('p', { class: 'fn sec', text: u.inTrial ? 'Nothing is charged during your free pilot.' : 'Billed to your card separately each month, never taken from your payouts.' })), offer, label,
        h('div', { class: 'group-h', text: 'Change plan' }), h('div', { class: 'group', id: 'tierList', role: 'radiogroup', 'aria-label': 'Plan' }, ...P.tiers.map(x => tierBtn(x, x.key === cur.key, () => x.key === cur.key ? null : RN.changeAsk(x.key)))), chg, terms);
      e.append(S.r.cancel ? h('div', { class: 'pbox', id: 'cancelConfirm' }, h('p', { class: 'sub', text: 'Cancel your plan? You won’t be charged again. You can come back anytime.' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn danger', id: 'cancelYes', text: 'Cancel plan', on: { click: RN.cancelPlan } }), h('button', { class: 'btn gray', id: 'cancelNo', text: 'No thanks, keep it', on: { click: RN.cancelNo } })))
        : h('button', { class: 'btn plain danger', id: 'cancelPlan', text: 'Cancel subscription', on: { click: RN.cancelAsk } }));
      return;
    }
    const ok = !!(S.r.plan && S.r.plan.ok), c = h('input', { type: 'checkbox', id: 'subConsent' }); c.checked = ok; c.addEventListener('change', () => RN.consent(c.checked));
    e.append(h('p', { class: 'sub sec', text: 'Pick a flat monthly plan for the app. No commission and no per-job fees. Never taken from your payouts.' }), label, pilot,
      h('div', { class: 'group-h', text: 'Choose a plan' }), h('div', { class: 'group', id: 'tierList', role: 'radiogroup', 'aria-label': 'Plan' }, ...P.tiers.map(x => tierBtn(x, x.key === pick, () => RN.pickTier(x.key)))), terms);
    if (!pick) { e.append(h('p', { class: 'fn sec', id: 'pickNote', text: 'Pick the plan that fits how much you work. You can change or cancel anytime.' })); return; }
    const T = tierOf(pick);
    e.append(h('div', { class: 'pbox', id: 'subDisclosure' }, h('p', { class: 'sub', text: SETTINGS.subscription.disclosure(P, T) })),
      h('label', { class: 'ack', for: 'subConsent' }, c, h('span', { text: SETTINGS.subscription.consent(P, T) })),
      h('button', { class: 'btn', id: 'subPay', disabled: !ok, text: r.trialFrom && !u.inTrial ? 'Start ' + T.name + ' (test mode)' : 'Start free pilot (test mode)', on: { click: RN.subscribe } }), h('p', { class: 'fn sec', text: 'Demo only. Nothing is billed.' }));
  },
  planDone(r) {
    const e = mx(); if (!e) return;
    e.append(h('div', { class: 'pbox', id: 'subConfirm' }, h('div', { class: 'hl', text: subFor(r).name + ' plan chosen' }), h('p', { class: 'sub', text: planStatus(r) }), h('p', { class: 'fn', text: r.sub.consent.disclosure }), h('p', { class: 'fn sec', text: 'Consent recorded ' + new Date(r.sub.consent.at).toLocaleString('en-US', { timeZone: TZ }) + ' · ' + r.sub.consent.version + '. Test mode: nothing billed.' })),
      h('button', { class: 'btn', id: 'planDoneBtn', text: 'Done', on: { click: () => RN.tab('drive') } }));
  }
};
const DEACT = ['Safety', 'Fraud', 'Illegal acts', 'Unpaid subscription'];
const OW = {
  tab(t) { S.o.tab = t; R(); const d = $('#desk'); if (d) d.scrollTop = 0; },
  reason(id, v) { (S.o.reasons = S.o.reasons || {})[id] = v; },
  deactivate(id) { const r = S.runners[id], why = (S.o.reasons || {})[id]; if (!r) return; if (!DEACT.includes(why)) { toast('Choose a reason first', 'alert'); return; } r.deactivated = { reason: why, at: Date.now() }; r.online = false; R(); toast('Runner deactivated: ' + why); },
  reactivate(id) { const r = S.runners[id]; if (!r) return; r.deactivated = null; R(); toast('Runner reactivated'); },
  review(id) { const x = S.support.find(s => s.id === id); if (!x) return; x.status = 'reviewed'; R(); toast('Marked reviewed'); },
  mount() { const e = $('#omx'); if (!e) return; e.replaceChildren(); (OWNER_MOUNT[S.o.tab] || OWNER_MOUNT.overview)(e); }
};
const kpi = (l, v, s) => h('div', { class: 'kc' }, h('div', { class: 'fn sec', text: l }), h('div', { class: 't2 num', text: v }), s ? h('div', { class: 'fn sec', text: s }) : '');
const frow = (...cols) => h('div', { class: 'frow' }, ...cols.map((c, i) => c instanceof Node ? c : h('span', { class: i === 0 ? '' : i === cols.length - 1 ? 'num' : 'sec', text: c })));
const panel = (title, ...kids) => h('div', { class: 'panel' }, h('h3', { text: title }), ...kids);
const oNone = (title, line) => panel(title, h('p', { class: 'sub sec', text: line }));
const OWNER_MOUNT = {
  overview(e) {
    const all = Object.values(S.runners), subs = all.filter(subActive), U = subs.map(r => planUsage(r)), due = U.reduce((a, u) => a + u.due, 0), jobs = all.reduce((a, r) => a + jobsThisMonth(r), 0), trial = U.filter(u => u.inTrial).length;
    const n = k => k + ' runner' + (k === 1 ? '' : 's');
    e.append(h('div', { class: 'kgrid', id: 'owKpis' }, kpi('Runners registered', String(all.length)), kpi('Pricing set', String(all.filter(runnerPriced).length)), kpi('Subscribed', String(subs.length)), kpi('Available now', String(all.filter(r => r.online && !r.deactivated).length))),
      h('div', { class: 'kgrid' }, kpi('Subscription revenue', money(due), 'Per month · test mode'), kpi('Jobs this month', String(jobs), 'Across all runners')),
      panel('Plans · ' + SETTINGS.plan.label, h('div', { id: 'owPlans' }, frow('Free pilot', n(trial), money(0)), ...SETTINGS.plan.tiers.map(T => { const k = U.filter(u => !u.inTrial && u.tier === T).length; return frow(T.name + ' · ' + money(T.price) + '/month', n(k), money(k * T.price)); }), frow('Upgrade offers open', n(U.filter(u => u.offer).length), ''))),
      h('p', { class: 'fn sec', text: 'ErrandCo earns only from flat runner plans, billed separately. Runners set their own prices and hours, and keep all job pay and tips.' }));
  },
  subs(e) {
    const all = Object.values(S.runners).filter(r => r.sub);
    e.append(all.length ? panel('Runner subscriptions', ...all.map(r => { const on = r.sub.status === 'active'; return frow(h('span', {}, h('b', { text: r.name })), on ? 'Since ' + new Date(r.sub.since).toLocaleDateString('en-US', { timeZone: TZ }) + ' · ' + planStatus(r) : 'Cancelled', on ? money(planUsage(r).due) : money(0)); })) : oNone('Runner subscriptions', 'None yet. Plans appear here when runners choose one.'),
      S.subLog.length ? panel('Consent log', ...S.subLog.slice(0, 50).map(x => h('div', { class: 'frow stack' }, h('span', {}, h('b', { text: x.name }), ' · ' + x.action + (x.from ? ' from ' + x.from : '') + ' · ' + new Date(x.at).toLocaleString('en-US', { timeZone: TZ })), h('span', { class: 'sec', text: x.text ? x.text + ' · ' + x.version : 'Cancelled in app' })))) : '');
  },
  runners(e) {
    const all = Object.values(S.runners);
    if (!all.length) { e.append(oNone('Runners', 'None yet. Runners appear here after they sign up in the runner app.')); return; }
    e.append(panel('Runners', ...all.map(r => {
      const t = subFor(r), info = [r.pricing === 'engine' ? 'Pricing engine' : r.pricing === 'own' ? 'Own rates' : 'No pricing yet', t ? t.name + (planUsage(r).inTrial ? ' · Free pilot' : '') : 'No plan', r.online ? 'Available' : 'Offline', stars(r.rating) + ' rating', (r.jobs || 0) + ' jobs'].join(' · ');
      if (r.deactivated) return frow(h('span', {}, h('b', { text: r.name })), 'Deactivated: ' + r.deactivated.reason, h('button', { class: 'btn sm gray', id: 'owReact-' + r.id, text: 'Reactivate', on: { click: () => OW.reactivate(r.id) } }));
      const sel = h('select', { class: 'whensel', id: 'owWhy-' + r.id, 'aria-label': 'Reason' }, h('option', { value: '', text: 'Reason…' }), DEACT.map(d => { const o = h('option', { value: d, text: d }); o.selected = (S.o.reasons || {})[r.id] === d; return o; }));
      sel.addEventListener('change', () => OW.reason(r.id, sel.value));
      return frow(h('span', {}, h('b', { text: r.name })), info, h('span', { class: 'btnrow' }, sel, h('button', { class: 'btn sm gray', id: 'owDeact-' + r.id, text: 'Deactivate', on: { click: () => OW.deactivate(r.id) } })));
    })), h('p', { class: 'fn sec', text: 'Ratings are shown to customers and never used for discipline. Deactivation is only for safety, fraud, illegal acts, or an unpaid subscription. There are no pay, price, or schedule controls here: runners set those themselves.' }));
  },
  support(e) {
    e.append(S.support.length ? panel('Reports', ...S.support.map(x => frow(h('span', {}, h('b', { text: x.issue }), ' · ' + x.title), (x.runnerName ? 'Runner ' + x.runnerName + ' · ' : '') + (x.note || 'No note') + ' · ' + new Date(x.at).toLocaleString('en-US', { timeZone: TZ }), x.status === 'reviewed' ? 'Reviewed' : h('button', { class: 'btn sm gray', id: 'owRev-' + x.id, text: 'Mark reviewed', on: { click: () => OW.review(x.id) } })))) : oNone('Reports', 'All clear. Customer reports appear here.'));
  }
};
function owner() {
  const t = S.o.tab, secs = [['overview', 'Overview', 'chart'], ['subs', 'Subscriptions', 'card'], ['runners', 'Runners', 'users'], ['support', 'Support', 'chat']];
  const title = (secs.find(s => s[0] === t) || secs[0])[1];
  return `<div class="owner"><aside class="side"><div class="wordmark sm">errandco <span class="fn">owner</span></div>${secs.map(([k, l, ic]) => `<button class="sb ${k === t ? 'on' : ''}" ${act('OW.tab', k)}>${icon(ic)}${l}</button>`).join('')}</aside>
  <main class="omain"><div class="mobile-owner-tabs">${seg(secs.map(s => [s[0], s[1]]), t, 'OW.tab')}</div><h1 class="t1 otitle">${title}</h1><div id="omx"></div><p class="demo-note">Test mode. Every number comes from activity on this device. Nothing is billed.</p><button class="btn sm gray" id="signOut" ${act('AU.signOut')}>Sign out</button></main></div>`;
}
function R() {
  const dev = $('#device'), desk = $('#desk');
  document.body.dataset.view = S.view; Store.save();
  if (!AU.session()) { $('#screen').replaceChildren(); desk.replaceChildren(); $('#map').style.visibility = 'hidden'; return; }
  if (S.view === 'o') { dev.parentElement.style.display = 'none'; desk.style.display = 'block'; desk.replaceChildren(dom(owner())); OW.mount(); pingNotes(); return; }
  dev.parentElement.style.display = ''; desk.style.display = 'none';
  const scrolls = {}; $$('#screen [data-scroll]').forEach(e => scrolls[e.dataset.scroll] = e.scrollTop);
  const out = S.view === 'c' ? customer() : runnerView();
  const key = S.view + (S.view === 'c' ? S.c.screen : S.r.tab);
  const scr = $('#screen'); scr.replaceChildren(dom(out.html + (out.tab || '')));
  if (key !== lastScreenKey) { scr.classList.remove('fade'); void scr.offsetWidth; scr.classList.add('fade'); lastScreenKey = key; }
  else $$('#screen [data-scroll]').forEach(e => { if (scrolls[e.dataset.scroll] != null) e.scrollTop = scrolls[e.dataset.scroll]; });
  $('#map').style.visibility = out.scene ? 'visible' : 'hidden';
  if (out.scene) Maps.render($('#map'), out.scene);
  layoutSheets(); bindCollapse(); mountAdd(); LN.mount(); mountCheckout(); if (out.mount) out.mount(); if (typeof TL !== 'undefined') TL.mount(); pingNotes();
}
function detentPx(d, sh) {
  const H = $('#device').clientHeight, tb = sh.classList.contains('has-tabbar') ? 83 : 0;
  if (d === 'peek') return 190 + tb; if (d === 'medium') return Math.round(H * .52); return H - 47 - 10 - (sh.dataset.sheet === 'roffer' ? 56 : 0);
}
function layoutSheets() { $$('#screen .sheet').forEach(sh => { sh.style.height = detentPx(sh.dataset.detent, sh) + 'px'; const g = sh.querySelector('.grabber'); g.onpointerdown = e => startDrag(e, sh); }); }
function startDrag(e, sh) {
  const y0 = e.clientY, h0 = sh.offsetHeight, ds = sh.dataset.detents.split(','), sc = parseFloat(getComputedStyle($('#device')).getPropertyValue('--fit')) || 1;
  sh.style.transition = 'none'; let moved = false;
  const mv = ev => { moved = true; sh.style.height = Math.max(120, h0 + (y0 - ev.clientY) / sc) + 'px'; };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); sh.style.transition = '';
    const h = sh.offsetHeight; let best = ds[0];
    if (!moved) { best = ds[(ds.indexOf(sh.dataset.detent) + 1) % ds.length]; }
    else ds.forEach(d => { if (Math.abs(detentPx(d, sh) - h) < Math.abs(detentPx(best, sh) - h)) best = d; });
    sh.dataset.detent = best; S.det[sh.dataset.sheet] = best; sh.style.height = detentPx(best, sh) + 'px'; haptic(); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function bindCollapse() { $$('#screen .page').forEach(p => { const f = () => p.classList.toggle('scrolled', p.scrollTop > 36); p.onscroll = f; f(); }); }
function fit() {
  const st = $('#stage'), d = $('#device'); if (!st || !d) return;
  const mobile = window.innerWidth <= 600;
  if (mobile) { d.style.transform = ''; d.style.setProperty('--fit', 1); return; }
  const s = Math.min(1, (window.innerHeight - 80) / 868, (window.innerWidth - 32) / 414);
  d.style.transform = 'scale(' + s + ')'; d.style.setProperty('--fit', s);
}
function clock() { const e = $('#sbtime'); if (e) e.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(/\s?[AP]M/, ''); }
const ROLE = { customer: 'c', runner: 'r', owner: 'o' };
function boot() {
  if (window.top !== window.self) { document.body.textContent = 'Open errandco in its own browser tab.'; return; }
  S.view = ROLE[document.body.dataset.app] || 'c';
  Store.load(); Store.listen();
  R(); AU.mount(); fit(); clock(); setInterval(clock, 15000);
  window.addEventListener('resize', () => { fit(); if (S.view !== 'o') layoutSheets(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js', { scope: './' }).catch(() => { });
}
document.addEventListener('DOMContentLoaded', () => { wireActions(); boot(); });
