/* UI layer. Renders Customer / Runner / Owner. State lives in S (data.js). */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let lastScreenKey = '';

/* ---------- small helpers ---------- */
function haptic() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } }
function toast(msg, ic = 'check') { const t = $('#toast'); t.replaceChildren(dom(icon(ic, 's')), Object.assign(document.createElement('span'), { textContent: msg })); t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
/* Event delegation instead of inline handlers (Shield F3/F5). act() emits data attributes only; the
   action name is looked up in a fixed allowlist and args travel as escaped JSON, never as code. */
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
const cell = (o) => `<div class="cell ${o.tap ? 'tap' : ''}" ${o.tap || ''} style="${o.inset ? '--inset:' + o.inset + 'px' : (o.ic ? '--inset:58px' : '')}">
  ${o.ic ? `<div class="ic ${o.icc || ''}">${icon(o.ic)}</div>` : ''}${o.left || ''}
  <div class="grow"><div class="title ${o.tcls || ''}">${o.title}</div>${o.sub ? `<div class="subt">${o.sub}</div>` : ''}</div>
  ${o.acc != null ? `<div class="acc">${o.acc}</div>` : ''}${o.chev ? `<span class="chev">${icon('chevR', 's')}</span>` : ''}</div>`;
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

/* ---------- map scenes ---------- */
function sceneFor(stops, opts = {}) {
  const start = opts.start || HUB, end = opts.end === undefined ? HOME : opts.end;
  const r = computeRoute(stops, start, end);
  const order = opts.entered ? r.entered : r.order;
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
  return { pts: [{ ...HOME, kind: 'end' }], path: [], runner: null, start: HOME };
}

/* ================= CUSTOMER actions ================= */
const C = {
  go(screen) { S.c.screen = screen; haptic(); R(); },
  tab(t) { S.c.tab = t; S.c.screen = t; R(); },
  addPlace(k, t) { const L = Places.LOCAL.find(x => x.id === k); if (L && Places.STORE_KINDS.includes(L.kind)) { Places.resolve({ src: 'local', place: L, kind: L.kind }).then(pl => ST.open(pl)); return; } S.stops.push(mkStop(t, k)); haptic(); R(); toast('Added ' + PLACES[k].name + ' to your route'); },
  remove(id) { S.stops = S.stops.filter(s => s.id !== id); S.stops.forEach(s => { if (s.from === id) s.from = null; }); S.cap = null; S.c.screen = 'stops'; R(); },
  start() { S.c.screen = 'stops'; AS.open(); },
  newOrder() { if (typeof TL !== 'undefined') TL.clear(); C.start(); },
  edit(id) { const s = S.stops.find(x => x.id === id); if (TYPES[s.type].store && storeKindOf(s)) ST.edit(id); else PL.edit(id); },
  timing(v) { S.timing = ORD.mode(S.stops, v); haptic(); R(); },
  window(v) { if (SETTINGS.timing.scheduledWindows.some(w => w[0] === v)) S.when = v; R(); },
  addDropoff() { AS.open({ type: 'Drop-off' }); },
  cap(d) { const q = quote(); S.cap = Math.max(0, (S.cap == null ? q.suggested : S.cap) + d); R(); },
  confirm() {
    if (!AU.require()) return;   // ordering requires sign-in
    if (!S.pay.method) { S.c.screen = 'addPayment'; R(); return; } // no order without a payment method (Shield)
    const q = quote(); haptic();
    S.trip = { status: 'matching', step: 0, q, window: q.timing === 'flex' ? ORD.flexWindow() : null, runner: null, pref: S.rpref || 'any', at: Date.now(), stops: S.stops.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })) };
    S.c.screen = 'tracking'; R();
  },
  cancel() { S.trip = null; S.c.screen = 'review'; R(); toast('Trip cancelled — no charge'); },
  toggleSubs() { S.subs = !S.subs; R(); },
  rpref(v) { S.rpref = v; R(); },
  /* Prototype: no card fields are collected. Real payments come later via Stripe. */
  useTestMethod() { S.pay.method = { kind: 'prototype', label: 'Prototype test method · no charge' }; S.c.screen = 'review'; haptic(); R(); toast('Payment method added'); },
};

/* ================= CUSTOMER screens ================= */
const OVER = ['add', 'place', 'store']; let lastSc = '';
function customer() {
  const sc = S.c.screen; const wasOver = OVER.includes(lastSc); lastSc = sc; const q = quote(); let html = '', scene = null, tab = false, map = true;
  if (sc === 'home') {
    tab = true; scene = homeScene(); const t = S.trip, L = S.line;
    html = sheet({ id: 'home', detents: ['peek', 'medium', 'large'], def: 'medium', tabbar: true,
      head: `<button class="btn newOrder" id="newOrderBtn" ${act('C.newOrder')}>${icon('plus')}Start a new order</button><h1 class="t1 hello">What do you need?</h1>`,
      body: `<div class="tiles">
        <button class="tile" id="tileErrands" ${act('C.start')}><span class="tile-ic">${icon('route')}</span><span class="tile-t">Errands</span><span class="tile-s">Stores and pickups, one trip, one upfront price.</span></button>
        <button class="tile" id="tileLine" ${act('LN.open')}><span class="tile-ic">${icon('clock')}</span><span class="tile-t">${esc(LINE_STR.tileTitle)}</span><span class="tile-s">${esc(LINE_STR.tileSub)}</span></button></div><div id="tileGrid"></div>`
        + (t ? `<div class="group">${cell({ ic: 'route', title: 'Errand trip', sub: esc(trackStatus(t)), chev: 1, tap: act('C.go', 'tracking') })}</div>` : '')
        + (L ? `<div class="group">${cell({ ic: 'clock', title: esc(LINE_STR.statusTitle), sub: esc(L.place.name), chev: 1, tap: act('LN.go', 'lineStatus') })}</div>` : '')
        + (!t && S.stops.length ? `<div class="group">${cell({ ic: 'list', title: 'Your trip', sub: S.stops.length + ' stop' + (S.stops.length === 1 ? '' : 's'), chev: 1, tap: act('C.go', 'stops') })}</div>` : '') });
  }
  if (LN.screens.includes(sc)) { map = false; html = LN.shell(sc); }
  if (typeof TL !== 'undefined' && TL.screens.includes(sc)) { map = false; html = TL.shell(); }
  /* One screen builds the trip. Search, stop details and the store browser open as sheets over it. */
  if (['stops', 'add', 'place', 'store'].includes(sc)) {
    scene = sceneFor(S.stops); const n = S.stops.length;
    html = `<button class="fbtn tl" aria-label="Back" ${act('C.go', 'home')}>${icon('chevL')}</button>` + sheet({ id: 'stops', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<h1 class="t1">Your trip</h1>`,
      body: (n ? `<ol class="slist">${S.stops.map((s, i) => `<li><button class="srow" ${act('C.edit', s.id)}><span class="sn num">${i + 1}</span><span class="grow"><span class="hl ellip">${esc(placeOf(s).name)}</span><span class="fn ellip">${esc(stopLine(s))}</span></span>${icon('chevR', 's')}</button></li>`).join('')}</ol>` : `<p class="sub sec empty">No stops yet.</p>`)
        + `<button class="btn gray addstop" ${act('AS.open')}>${icon('plus', 's')}Add stop</button>`
        + (n && !ORD.isStandaloneDropoff(S.stops) ? `<button class="quiet" id="addDropoff" ${act('C.addDropoff')}><span class="grow"><span class="sub">Add a drop-off to this errand</span><span class="fn">Your runner drops it off on the same trip. Priced by the extra time on your route.</span></span><span class="tint sub">Add</span></button>` : ''),
      foot: `<button class="btn" ${n ? '' : 'disabled'} ${act('C.go', 'review')}>${n ? 'Review · ' + money(q.total) + ' est.' : 'Review'}</button>` });
    if (sc !== 'stops') html += `<div class="ovl${wasOver ? '' : ' anim'}"><div class="ovscrim"></div><div class="ovsheet">${addScreens(sc)}</div></div>`;
  }
  if (sc === 'review') {
    const r = q.route, f = q.f;
    scene = sceneFor(S.stops, { final: true }); scene.top = 80; scene.bottom = 330;
    const line = (l, v, b) => `<div class="pline${b ? ' b' : ''}"><span>${l}</span><span class="num">${v}</span></div>`;
    const sugg = routeSuggestions()[0];
    html = `<button class="fbtn tl" aria-label="Back" ${act('C.go', 'stops')}>${icon('chevL')}</button>` + sheet({ id: 'review', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<h1 class="t1">Review</h1><p class="sub sec">${S.stops.length} stop${S.stops.length === 1 ? '' : 's'} · <span id="rtm" data-dwell="${r.dwell}">${q.miles.toFixed(1)} mi · ~${fmtMin(q.eta)}${q.est ? ' est.' : ' by road'}</span></p>`,
      body: `<ol class="rlist">${r.order.map((i, k) => `<li><span class="sn num">${k + 1}</span><span class="grow"><span class="sub ellip">${esc(placeOf(S.stops[i]).name)}</span><span class="fn ellip">${esc(stopLine(S.stops[i]))}</span></span></li>`).join('')}<li><span class="sn end">${icon('house', 's')}</span><span class="grow"><span class="sub">Home</span><span class="fn">Purchases delivered</span></span></li></ol>
      <div class="group">
        ${cell({ title: 'Spending cap', sub: 'Items ' + money(q.goods) + ' + ' + S.pay.capPad + '% buffer', acc: `<span class="sub num">${money(q.cap)}</span><div class="stepper"><button aria-label="Lower cap" ${act('C.cap', -5)}>−</button><button aria-label="Raise cap" ${act('C.cap', 5)}>+</button></div>` })}
        ${cell({ title: 'Runner', acc: `<select class="whensel" id="rprefSel" aria-label="Runner" data-change="C.rpref">${RPREF.map(([v, l]) => `<option value="${v}" ${v === (S.rpref || 'any') ? 'selected' : ''}>${l}</option>`).join('')}</select>` })}
        ${cell({ title: 'Payment', tap: act('C.go', 'addPayment'), acc: S.pay.method ? `<span class="sub sec" id="payMethod">${esc(S.pay.method.label)}</span>` : '<span class="sub tint" id="payAdd">Add payment</span>' })}
      </div>
      <div id="ckTiming"></div>
      <div class="pbox">${line('Service fee' + (q.est ? ' (est.)' : ''), money(f.service))}${line('Spending cap', money(q.cap))}${line('Total', money(q.total), 1)}</div>
      ${feeBreakdown(q)}
      <div id="tlReview"></div><p class="fn note blocknote">${esc(typeof TILE_STR !== 'undefined' ? TILE_STR.block : '')}</p>
      <p class="fn note">${q.est ? 'Estimated from straight-line distance. Checking the road route…' : 'Priced on the real road route. Unused cap is refunded with receipts; anything over it needs your OK.'} <b>Estimate:</b> calculated on this device for the prototype. The final price is set by our server before you pay.</p>
      ${sugg ? `<button class="quiet" ${act('C.addPlace', sugg.k, sugg.type)}><span class="grow"><span class="sub">On your way: ${esc(sugg.p.name)}</span><span class="fn">+${money(sugg.m.usd)} · +${Math.max(1, Math.round(sugg.m.min))} min</span></span><span class="tint sub">Add</span></button>` : ''}`,
      foot: `<button class="btn" id="payBtn" ${act('C.confirm')}>${S.pay.method ? 'Pay ' + money(q.total) : 'Add payment to continue'}</button>` });
  }
  if (sc === 'addPayment') {
    map = false;
    html = page('Add payment', `<div class="group" id="addPaySheet">${cell({ ic: 'creditcard', title: 'Payments are coming soon', sub: 'Real payments will be handled by Stripe. We never see or store your full card number. This prototype does not collect any card details.' })}</div>
      <p class="fn note">Your order is only placed after a payment method is added.</p>
      <button class="btn" id="useTestMethod" ${act('C.useTestMethod')}>Use prototype test method (no charge)</button>`, { notab: true, back: act('C.go', 'review') });
  }
  if (sc === 'tracking') {
    if (!S.trip) { S.c.screen = 'home'; return customer(); }
    const t = S.trip; scene = sceneFor(t.stops, { final: true });
    html = `<button class="fbtn tl" aria-label="Minimize" ${act('C.tab', 'home')}>${icon('chevD')}</button>` + sheet({ id: 'track', detents: ['medium', 'large'], def: 'medium', solid: true,
      head: `<div class="eta">${t.status === 'accepted' ? 'Runner on the way' : 'Finding a runner'}</div><p class="sub sec">${esc(trackStatus(t))}</p><div class="bar"><i style="width:4%"></i></div>`,
      body: `<div id="ckReceipt"></div><p class="sub sec" style="margin:12px 0">We'll show your runner here once one accepts. Nothing is charged until then.</p><ol class="rlist">${t.q.route.order.map((i, k) => `<li><span class="sn num">${k + 1}</span><span class="grow"><span class="sub ellip">${esc(placeOf(t.stops[i]).name)}</span></span></li>`).join('')}</ol>`,
      foot: `<button class="btn gray" ${act('C.cancel')}>Cancel trip</button>` });
  }
  if (sc === 'chat') {
    map = false;
    html = page('Chat', empty('No messages', 'You can chat with your runner once one accepts your trip.'), { notab: true, back: act('C.go', 'home') });
  }
  if (sc === 'activity') {
    map = false; tab = true;
    const live = [S.trip && cell({ ic: 'route', title: S.trip.stops.length + ' stop errand', sub: S.trip.status === 'accepted' ? 'Runner on the way' : 'Finding a runner', chev: 1, tap: act('C.go', 'tracking') }), S.line && cell({ ic: 'clock', title: esc(LINE_STR.tileTitle), sub: esc(S.line.place.name), chev: 1, tap: act('LN.go', 'lineStatus') })].filter(Boolean);
    html = page('Activity', (live.length ? group('In progress', live) : '') + (S.history.length ? group('Completed', S.history.map(x => cell({ ic: x.kind === 'line' ? 'clock' : 'route', title: esc(x.title), sub: new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), acc: money(x.total) }))) : empty('No trips yet', 'Your errands and line holds will show up here.', `<button class="btn" ${act('C.tab', 'home')}>Start an errand</button>`)));
  }
  if (sc === 'favorites') {
    map = false; tab = true;
    html = page('Favorites', empty('No favorites yet', 'After a trip, you can save a runner or a stop list here.'));
  }
  if (sc === 'account') {
    map = false; tab = true;
    html = page('Account', `${group('Preferences', [cell({ ic: 'chat', title: 'Ask before substituting', acc: `<button class="toggle ${S.subs ? 'on' : ''}" role="switch" aria-checked="${S.subs}" aria-label="Ask before substituting" ${act('C.toggleSubs')}></button>` }), cell({ ic: 'card', icc: 'gray', title: 'Payment', sub: 'Added at checkout' })])}
      ${group('Saved addresses', [cell({ title: '<span class="sec">No saved addresses. Addresses you use on a trip can be saved later.</span>' })])}
      <button class="btn plain danger" id="signOut" ${act('AU.signOut')}>Sign out</button>`);
  }
  return { html, scene: map ? scene : null, tab: tab ? tabbar([['home', 'Home', 'house'], ['activity', 'Activity', 'clock'], ['favorites', 'Favorites', 'star'], ['account', 'Account', 'person']], S.c.tab, 'C.tab') : '' };
}

/* ---------- stop editing & route list ---------- */
/* One honest breakdown of the service fee, from the engine's own line items (sums exactly to the fee). */
/* Real road distance/time arrives from the Routes API (review only). It locks the price for these exact stops. */
window.onRouteMetric = m => {
  if (S.view !== 'c' || S.c.screen !== 'review') return;
  const sig = stopsSig(S.stops), cur = S.realRoute;
  if (cur && cur.sig === sig && Math.abs(cur.mi - m.mi) < 1e-9 && Math.abs(cur.min - m.min) < 1e-9) return;
  S.realRoute = { sig, mi: m.mi, min: m.min }; R();
};
function feeBreakdown(q) {
  const e = q.e; if (!e) return '';
  const runner = e.runner_wage + e.payroll_tax_wc, costs = Math.round((e.variable_cost - runner - e.mileage + e.stripe_on_fee) * 100) / 100;
  const row = (l, v) => `<div class="pline"><span>${l}</span><span class="num">${money(v)}</span></div>`;
  return `<details class="pbreak"><summary>How the fee adds up</summary>${row('Runner pay · ' + e.minutes.toFixed(0) + ' min', runner)}${row('Mileage · ' + e.miles.toFixed(1) + ' mi', e.mileage)}${row('Card fees & insurance', costs)}${row('ErrandCo', e.margin_variable)}</details>`;
}
function stopLine(s) {
  const k = s.items.length, goods = s.items.reduce((a, x) => a + (+x.p || 0), 0);
  if (TYPES[s.type].store) return k ? k + (k === 1 ? ' item' : ' items') + (goods ? ' · ' + money(goods) : '') : 'No items yet';
  const from = s.from && S.stops.concat(S.trip ? S.trip.stops : []).find(x => x.id === s.from), what = s.items.map(x => x.n).join(', ');
  return (s.type === 'Drop-off' ? 'Drop off' : s.type === 'Custom task' ? 'Task' : 'Pick up') + (what ? ': ' + what : from ? ' from ' + placeOf(from).name : '');
}
function trackStatus(t) {
  const n = t.stops.length, o = t.q.route.order;
  if (t.status === 'matching') return 'Your price is locked. Matching takes a minute.';
  if (t.status === 'done') return 'All stops complete';
  return t.step === 0 ? 'Heading to ' + placeOf(t.stops[o[0]]).name : t.step >= n ? 'Heading home with your items' : 'Stop ' + (t.step + 1) + ' of ' + n + ': ' + placeOf(t.stops[o[t.step]]).name;
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
  if (o.end) rows += `<div class="rstop"><div class="rail"><span class="n end">${icon('house', 's')}</span></div><div><div class="hl">${esc(o.end.name)}</div><div class="fn">${esc(o.end.addr)} · deliver purchases</div></div></div>`;
  return `<div class="group" style="padding:4px 16px">${rows}</div>`;
}

/* ================= shared order helpers ================= */
const RPREF = [['any', 'Any available runner'], ['fav', 'My favorite runner'], ['top', 'Top-rated runner']];
const prefLabel = v => (RPREF.find(x => x[0] === v) || RPREF[0])[1];
const CAT_NAMES = { groceries: 'Groceries', returns: 'Returns & drop-offs', cleaning: 'Dry cleaning', weekly: 'Repeat weekly errands', post: 'Post office & packages', gifts: 'Gifts & flowers' }; // same as the six customer tiles
function tripCat(t) { if (!t) return 'Errand'; if (t.recur) return CAT_NAMES.weekly; const k = t.preset && t.preset.key; return CAT_NAMES[k] || 'Errand'; }
/* Owner dispatch board: demo-mode switch and the 'Send to courier' button, built as DOM nodes (no HTML strings). */
function mountDispatch() {
  const box = $('#owDispatch'); if (!box) return;
  const K = SETTINGS.courier, T = S.trip, chk = T ? ORD.courierCheck(T) : null, demo = !!S.o.demo;
  const sw = h('button', { class: 'toggle' + (demo ? ' on' : ''), id: 'owDemo', role: 'switch', 'aria-checked': String(demo), 'aria-label': 'Demo mode', on: { click: OW.demo } });
  const kids = [h('div', { class: 'frow' }, h('span', {}, h('b', { text: 'Demo mode' }), ' · courier handoff off by default'), sw)];
  if (T) {
    const can = demo && chk.ok && !T.courier && T.status === 'matching';
    kids.push(h('div', { class: 'frow' }, h('span', {}, h('button', { class: 'btn sm', id: 'owCourier', disabled: !can, 'aria-describedby': 'owCourierWhy', text: 'Send to courier', on: { click: OW.courier } }), ' ', h('span', { class: 'pendchip', text: 'Demo only, no partner contract' })),
      h('span', { class: 'sec', id: 'owCourierWhy', text: T.courier ? 'Sent to ' + T.courier.partner + ' (demo)' : !chk.ok ? chk.reason : !demo ? 'Turn on demo mode to try it.' : 'Eligible: standalone drop-off.' }),
      h('span', { class: 'num', text: 'Courier fee ' + money(K.fee) })));
  }
  if (S.line && S.line.status !== 'ended') kids.push(h('div', { class: 'frow' }, h('span', { text: LINE_STR.tileTitle }), h('span', { class: 'sec', id: 'owLineCourierWhy', text: ORD.courierCheck({ kind: 'line' }).reason })));
  box.replaceChildren(h('h3', { text: 'Courier handoff' }), ...kids, h('div', { class: 'group-f', text: 'Partner and fee come from settings. Banned for couriers: ' + K.banned.map(b => b.label.toLowerCase()).join(', ') + ', items over ' + K.maxLb + ' lb and items worth over ' + money(K.valueCap) + '.' }));
}
/* Customer checkout timing (review) and the receipt (tracking), built as DOM nodes. */
function mountCheckout() {
  const tb = $('#ckTiming');
  if (tb) {
    const q = quote(), modes = ORD.modes(S.stops), W = SETTINGS.timing;
    const segEl = h('div', { class: 'seg', role: 'tablist', id: 'ckModes', 'aria-label': 'When' }, modes.map(([v, l]) => h('button', { role: 'tab', id: 'ckMode-' + v, class: v === q.timing ? 'on' : '', 'aria-selected': String(v === q.timing), text: l, on: { click: () => C.timing(v) } })));
    const kids = [h('div', { class: 'group-h', text: 'When' }), segEl];
    if (q.timing === 'scheduled') { const sel = h('select', { class: 'whensel', id: 'ckWindow', 'aria-label': 'Delivery window' }, W.scheduledWindows.map(([v, l]) => { const o = h('option', { value: v, text: l }); o.selected = v === S.when; return o; })); sel.addEventListener('change', () => C.window(sel.value)); kids.push(h('div', { class: 'group' }, h('div', { class: 'cell' }, h('div', { class: 'grow title', text: 'Window' }), sel))); }
    if (q.timing === 'flex') kids.push(h('p', { class: 'sub flexline', id: 'flexLine', text: ORD.flexLine(q, ORD.flexWindow()) }));
    if (q.standalone) kids.push(h('p', { class: 'fn note', id: 'standaloneNote', text: 'Standalone drop-off: ' + money(SETTINGS.dropoff.standalonePrice) + ' (' + SETTINGS.dropoff.pending + '). Scheduled or flexible windows only, so we can route it with nearby errands.' }));
    tb.replaceChildren(...kids);
  }
  const rb = $('#ckReceipt'), T = S.trip;
  if (rb && T) {
    const row = (l, v, b) => h('div', { class: 'pline' + (b ? ' b' : '') }, h('span', { text: l }), h('span', { class: 'num', text: v }));
    const when = T.q.timing === 'flex' && T.window ? 'Flexible window · arrives between ' + ORD.fmtTime(T.window.start) + ' and ' + ORD.fmtTime(T.window.end) : T.q.timing === 'scheduled' ? 'Scheduled · ' + ORD.windowLabel(T.q) : 'ASAP';
    rb.replaceChildren(h('div', { class: 'pbox', id: 'receipt' }, row('When', when), row('Service fee', money(T.q.f.service)), row('Spending cap', money(T.q.cap)), row('Total charged', money(T.q.total), 1)),
      T.courier ? h('p', { class: 'fn note', id: 'courierNote', text: ORD.courierNote(T.courier.partner) }) : '');
  }
}
/* Sign-out: clear this app's personal data (orders, addresses, payment method, timesheet) from memory and the shared store. */
function clearPersonalData() {
  if (S.view === 'c') { Object.assign(S, { stops: [], trip: null, line: null, history: [], weekly: null, cap: null, realRoute: null, rpref: 'any', timing: 'asap' }); S.pay.method = null; S.c = { screen: 'home', tab: 'home' }; }
  if (S.view === 'r') { S.rt = null; S.r = { tab: 'drive', online: false, job: null }; }
  if (S.view === 'o') S.o = { tab: 'overview', support: [] };
  Store.save();
}
const runnerPay = t => t && t.q && t.q.e ? t.q.e.runner_total : 0;
const tripProfit = t => t && t.q && t.q.e ? t.q.e.margin_variable : 0;
const SHOP_NOTE = 'No store partnership: you shop it yourself. Pick items off the shelf, pay with the company card, snap the receipt.';
/* ================= RUNNER ================= */
/* Runner app: W-2 hourly model. Clock in/out, per-stop times (arrive/start/done) and line-sit time are logged
   separately; pay math lives in js/pay.js (PAY_CFG, PENDING Jeremy). Clean start: no seeded shifts or jobs. */
const PAID_COPY = 'Paid for every hour you work, with at least minimum wage guaranteed';
const LOC_COPY = 'Location is collected only during an active job. Raw GPS is kept for 30 days at most; after that only a route summary stays on the order. It is kept longer only for an open fraud or safety case.';
const rt = () => { const T = S.rt || (S.rt = { on: null, shifts: [], trips: [], lines: [], bonuses: [] }); T.tips = T.tips || []; return T; };
const fmtT = ts => ts ? new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '—';
const clockedHours = () => { const T = rt(); return T.shifts.reduce((a, s) => a + (s.out - s.in), 0) / 36e5 + (T.on ? (Date.now() - T.on) / 36e5 : 0); };
const offerPay = t => PAY.trip(t.stops.map(() => 0)).total;
const RN = {
  tab(t) { S.r.tab = t; R(); },
  clockIn() { if (!AU.require()) return; const T = rt(); if (T.on) return; T.on = Date.now(); S.r.online = true; haptic(); R(); toast('Clocked in · ' + fmtT(T.on)); },
  clockOut() {
    const T = rt(); if (!T.on) return;
    if ((S.trip && S.trip.status === 'accepted') || (S.line && ['holding', 'almost'].includes(S.line.status))) { toast('Finish your active job before clocking out'); return; }
    T.shifts.push({ in: T.on, out: Date.now() }); T.on = null; S.r.online = false; haptic(); R(); toast('Clocked out');
  },
  online() { if (rt().on) RN.clockOut(); else RN.clockIn(); },
  accept() { const L = S.line; if (!L || L.status !== 'requested' || !rt().on) return; L.status = 'holding'; L.code = LN.newCode(); L.sitStart = Date.now(); S.r.tab = 'route'; haptic(); R(); toast('Line hold accepted'); },
  acceptTrip() { const T = S.trip; if (!T || T.status !== 'matching' || !rt().on) return; T.status = 'accepted'; T.step = 0; T.times = T.stops.map(() => ({})); S.r.tab = 'route'; haptic(); R(); toast('Errand accepted'); },
  /* Each stop: Arrived -> Started -> Done. Wait = arrive..start. */
  next() {
    const T = S.trip; if (!T || T.status !== 'accepted') return; const st = T.step || 0; if (st >= T.stops.length) return;
    const tm = T.times[st] || (T.times[st] = {}), now = Date.now();
    if (!tm.arrive) tm.arrive = now; else if (!tm.start) tm.start = now; else { tm.done = now; T.step = st + 1; }
    haptic(); R(); if (tm.done) toast(T.step >= T.stops.length ? 'All stops done. Head to drop-off.' : 'Stop done');
  },
  doneTrip() {
    const T = S.trip; if (!T || T.status !== 'accepted' || (T.step || 0) < T.stops.length) return;
    const waits = T.times.map(x => Math.max(0, ((x.start || 0) - (x.arrive || 0)) / 6e4)), p = PAY.trip(waits);
    rt().trips.push({ at: Date.now(), cat: tripCat(T), waits, times: T.times, pay: p.total });
    S.history.unshift({ kind: 'errand', cat: tripCat(T), title: tripCat(T) + ' · ' + T.stops.length + ' stop' + (T.stops.length === 1 ? '' : 's'), total: T.q.total, timing: T.q.timing, courier: T.courier || null, fee: T.q.f.service, pay: p.total, profit: tripProfit(T), pref: T.pref, at: Date.now() });
    S.trip = null; S.r.tab = 'drive'; R(); toast('Errand completed');
  },
  almost() { const L = S.line; if (!L) return; L.status = 'almost'; R(); toast('Customer notified: almost their turn'); },
  relief() { const L = S.line; if (!L || L.relief) return; L.relief = true; R(); toast('Break / relief requested. Ops will confirm a time.'); },
  end() {
    S.r.tab = 'drive'; const L = S.line;
    if (L) { L.status = 'ended'; const end = Date.now(), waited = L.sitStart ? (end - L.sitStart) / 6e4 : 0, p = PAY.line(waited, L.capMin);
      rt().lines.push({ at: end, place: L.place.name, start: L.sitStart || end, end, waited, booked: L.capMin, pay: p.total });
      S.history.unshift({ kind: 'line', cat: LINE_STR.tileTitle, title: LINE_STR.tileTitle + ' · ' + L.place.name, total: L.est.total, fee: L.est.total, pay: p.total, profit: null, at: end }); }
    R();
  }
};
function timesheet() {
  const T = rt(), hrs = clockedHours(), lineMin = T.lines.reduce((a, l) => a + PAY.line(l.waited, l.booked).min, 0);
  if (!T.on && !T.shifts.length && !T.trips.length && !T.lines.length) return empty('No hours yet', 'Clock in from the Drive tab. ' + PAID_COPY + '. Your weekly pay statement appears here.');
  const w = PAY.week({ trips: T.trips, lines: T.lines.map(l => ({ waited: l.waited, booked: l.booked })), bonuses: T.bonuses, tips: T.tips, hours: hrs });
  const rate = r => money(r.rate) + ' / ' + r.unit;
  return `<div class="group" id="tsClock">${cell({ ic: 'clock', title: T.on ? 'Clocked in since ' + fmtT(T.on) : 'Clocked out', sub: T.shifts.length + ' shift' + (T.shifts.length === 1 ? '' : 's') + ' this week' })}${cell({ title: 'Clocked hours (full shifts, incl. idle and line time)', acc: `<span class="num" id="tsHours">${hrs.toFixed(2)} h</span>` })}${cell({ title: 'Line-sit time', acc: `<span class="num">${Math.round(lineMin)} min</span>` })}</div>`
    + group('Pay statement · this week', [
      ...w.rows.map(r => cell({ title: esc(r.label), sub: rate(r) + ' × ' + (Math.round(r.count * 10) / 10), acc: `<span class="num">${money(r.amt)}</span>` })),
      ...w.bonuses.map(b => cell({ title: 'Bonus · ' + esc(b.label), acc: `<span class="num">${money(b.amt)}</span>` })),
      cell({ title: 'Minimum-wage top-up', sub: 'Brings pay up to ' + money(PAY_CFG.baseHourly) + '/hr for ' + hrs.toFixed(2) + ' h', acc: `<span class="num" id="tsTopUp">${money(w.topUp)}</span>` }),
      cell({ title: 'Overtime', sub: w.otHours > 0 ? w.otHours.toFixed(2) + ' h over ' + PAY_CFG.otAfterHours + ' · half-time on regular rate ' + money(w.regRate) + '/hr' : 'After ' + PAY_CFG.otAfterHours + ' h, on this week’s regular rate', acc: `<span class="num" id="tsOT">${money(w.ot)}</span>` }),
      cell({ title: '<b>Wages this week</b>', acc: `<b class="num" id="tsTotal">${money(w.wages)}</b>` }),
      cell({ title: 'Tips', sub: '100% to you · not counted toward the minimum-wage top-up', acc: `<span class="num" id="tsTips">${money(w.tips)}</span>` }),
      cell({ title: '<b>Total with tips</b>', acc: `<b class="num" id="tsGrand">${money(w.total)}</b>` })
    ], PAID_COPY + '. All rates: Proposed, pending Jeremy. Hours count from clock-in to clock-out, including time between jobs.')
    + (T.trips.length ? group('Stop times', T.trips.flatMap((t, i) => t.times.map((x, k) => cell({ title: 'Trip ' + (i + 1) + ' · stop ' + (k + 1), sub: 'Arrived ' + fmtT(x.arrive) + ' · started ' + fmtT(x.start) + ' · done ' + fmtT(x.done) })))) : '')
    + (T.lines.length ? group('Line-sit times', T.lines.map(l => cell({ title: esc(l.place), sub: fmtT(l.start) + '–' + fmtT(l.end) + ' · ' + Math.round(PAY.line(l.waited, l.booked).min) + ' of ' + Math.round(l.booked) + ' booked min', acc: money(l.pay) }))) : '')
    + (T.shifts.length ? group('Shifts', T.shifts.map(s => cell({ title: fmtT(s.in) + ' – ' + fmtT(s.out), acc: `<span class="num">${((s.out - s.in) / 36e5).toFixed(2)} h</span>` }))) : '');
}
function runnerView() {
  const t = S.r.tab, L = S.line, on = !!rt().on; let html = '', scene = null, map = true;
  if (t === 'drive') {
    scene = homeScene();
    if (!on) html = sheet({ id: 'rdrive', detents: ['medium', 'large'], def: 'medium', tabbar: true,
      body: `<div style="text-align:center;padding:8px 0 16px"><button class="go" id="clockIn" ${act('RN.clockIn')} aria-label="Clock in">IN</button><div class="t3" style="margin-top:12px">You’re clocked out</div><div class="sub sec">Clock in to get requests near Great Neck. ${esc(PAID_COPY)}.</div><p class="fn note" id="locNote">${esc(LOC_COPY)}</p></div>` });
    else html = `<div class="pill-online"><span class="dot"></span><span class="hl">Clocked in · ${esc(fmtT(rt().on))}</span><button class="btn sm gray" id="clockOut" ${act('RN.clockOut')}>Clock out</button></div>` + sheet({ id: 'roffer', detents: ['medium', 'large'], def: 'medium', tabbar: true, solid: true,
      body: (L && L.status === 'requested') || (S.trip && S.trip.status === 'matching')
        ? `<div class="group-h">New requests</div>${S.trip && S.trip.status === 'matching' ? `<div class="group" id="jobCard">${cell({ ic: 'route', title: esc(tripCat(S.trip)) + ' · ' + S.trip.stops.length + ' stop' + (S.trip.stops.length === 1 ? '' : 's'), sub: S.trip.stops.map(x => esc(placeOf(x).name)).join(' · ') + '<br>' + S.trip.q.miles.toFixed(1) + ' mi · ~' + fmtMin(S.trip.q.eta) + (S.trip.pref !== 'any' ? ' · <b>' + esc(prefLabel(S.trip.pref)) + '</b>' : '') + '<br>Trip pay ' + money(PAY_CFG.perTrip) + ' + ' + money(PAY_CFG.perStop) + ' × ' + S.trip.stops.length + ' stop' + (S.trip.stops.length === 1 ? '' : 's') + ', plus ' + money(PAY_CFG.waitRate) + '/min wait after ' + PAY_CFG.waitGraceMin + ' min', acc: '<b class="num" id="offerPay">' + money(offerPay(S.trip)) + '</b>' })}</div><button class="btn" id="acceptTrip" ${act('RN.acceptTrip')}>Accept errand</button>` : ''}${L && L.status === 'requested' ? `<div class="group" id="lineCard">${cell({ ic: 'clock', title: esc(LINE_STR.runnerJob) + ' · ' + esc(L.place.name), sub: esc(L.startLabel) + ' · up to ' + esc(LN.hoursLabel(L.capMin)) + '<br>Line pay ' + money(PAY_CFG.lineRate) + '/waiting min, up to the booked length', acc: '<b class="num" id="linePay">up to ' + money(PAY.line(L.capMin, L.capMin).total) + '</b>' })}</div><button class="btn" ${act('RN.accept')}>Accept</button>` : ''}`
        : empty('No requests right now', 'Stay clocked in. New errands and line holds near you show up here.') });
  }
  if (t === 'route') {
    map = false;
    const lineJob = L && ['holding', 'almost'].includes(L.status), tripJob = S.trip && S.trip.status === 'accepted';
    html = page('Current job', tripJob && !lineJob
      ? (() => { const T = S.trip, st = T.step || 0, n = T.stops.length, cur = st < n ? T.stops[T.q.route.order[st]] : null, tm = (T.times || [])[st] || {};
          const lbl = !tm.arrive ? 'Arrived at ' : !tm.start ? 'Start at ' : 'Done at ';
          return `<div class="group">${cell({ ic: 'route', title: esc(tripCat(T)), sub: 'Stop ' + Math.min(st + 1, n) + ' of ' + n + ' · pickups before drop-offs', acc: '<b class="num">' + money(offerPay(T)) + '+</b>' })}${cur ? cell({ title: 'This stop', sub: 'Arrived ' + fmtT(tm.arrive) + ' · started ' + fmtT(tm.start) }) : ''}</div>
          ${cur && TYPES[cur.type].store ? `<p class="fn note" id="shopNote">${esc(SHOP_NOTE)}</p>` : ''}
          ${routeList(T.stops, T.q.route.order, { start: HUB, end: HOME, done: st, proof: true })}
          ${st < n ? `<button class="btn" id="nextStop" ${act('RN.next')}>${lbl}${esc(placeOf(cur).name)}</button>` : `<button class="btn" id="doneTrip" ${act('RN.doneTrip')}>Delivered · complete errand</button>`}
          <p class="fn note">${esc(LOC_COPY)}</p>`; })()
      : lineJob
      ? `<div class="group">${cell({ ic: 'clock', title: esc(L.place.name), sub: esc(L.place.addr) })}${cell({ title: 'Status', acc: esc(L.status === 'almost' ? 'Almost their turn' : 'Holding spot') })}${cell({ title: 'In line since', acc: esc(fmtT(L.sitStart)) })}${cell({ title: 'Handoff code', sub: 'The customer sees the same code', acc: `<span class="code num">${esc(L.code)}</span>` })}</div>
        <button class="btn gray" id="reliefBtn" ${L.relief ? 'disabled' : ''} ${act('RN.relief')}>${L.relief ? 'Break / relief requested' : 'Request break / relief'}</button>
        <button class="btn gray" ${act('RN.almost')}>Almost their turn · notify customer</button>
        <button class="btn" ${act('RN.end')}>End hold</button><p class="fn note">${esc(LOC_COPY)}</p>`
      : empty('No active job', 'Accept a request from the Drive tab to start.'));
  }
  if (t === 'earn') { map = false; html = page('Timesheet', timesheet()); }
  if (t === 'acct') { map = false; html = page('Account', group('Your status', [cell({ ic: 'star', title: 'Runner tier', sub: 'Top-rated after 25 jobs at 4.9★+. Customers can request top-rated or favorite runners.', acc: 'Standard' }), cell({ ic: 'person', title: 'Employee', sub: esc(PAID_COPY) + '. Clock in and out in the app.' })]) + empty('Profile not set up', 'Finish runner signup to add your vehicle, documents and payout account.')
      + group('Privacy', [cell({ ic: 'pin', title: 'Location', sub: esc(LOC_COPY) })])
      + group('Safety', [cell({ ic: 'sos', icc: 'red', title: 'Emergency assistance', sub: 'Call 911 in an emergency' })]) + `<button class="btn plain danger" id="signOut" ${act('AU.signOut')}>Sign out</button>`); }
  return { html, scene: map ? scene : null, tab: tabbar([['drive', 'Drive', 'car'], ['route', 'Job', 'route'], ['earn', 'Timesheet', 'dollar'], ['acct', 'Account', 'person']], S.r.tab, 'RN.tab') };
}

/* ================= OWNER ================= */
const OW = {
  tab(t) { S.o.tab = t; R(); window.scrollTo && $('#desk') && ($('#desk').scrollTop = 0); },
  setPay(k, v) { S.pay[k] = parseFloat(v) || 0; _rc.clear(); R(); },
  /* Courier handoff: demo only. Needs demo mode on and an eligible standalone drop-off; the reason shows otherwise. */
  demo() { S.o.demo = !S.o.demo; R(); },
  courier() {
    const T = S.trip, K = SETTINGS.courier, chk = ORD.courierCheck(T);
    if (!S.o.demo || !T || T.courier || T.status !== 'matching' || !chk.ok) { toast(chk.reason || 'Turn on demo mode first'); return; }
    T.courier = { partner: K.partner, fee: K.fee, at: Date.now(), demo: true }; haptic(); R(); toast('Demo: handed to ' + K.partner);
  }
};
const PROFIT_TARGET = 10;
const PROMOS = [['$10 off first order', 'First 150 households', '150 max'], ['Free ASAP', 'First 200 orders, not with first-order credit', '200 max'], ['Customer referrals', 'Both sides get credit', '150 max'], ['Runner sign-on bonus', '10 trips within 30 days', '15 runners'], ['Runner referrals', 'Capped', 'Capped']];
const kc = (l, v, d, cls = '') => `<div class="kcard"><div class="fn">${l}</div><div class="k num">${v}</div><div class="d ${cls}">${d}</div></div>`;
const oEmpty = (h, line) => `<div class="panel" style="margin-top:0"><h3>${esc(h)}</h3>${empty('Nothing yet', line)}</div>`;
function owner() {
  const t = S.o.tab, secs = [['overview', 'Overview', 'chart'], ['jobs', 'Orders', 'map'], ['runners', 'Runners', 'users'], ['pricing', 'Pricing', 'tag'], ['promos', 'Promos', 'gift'], ['support', 'Support', 'chat']];
  const sample = quote({ stops: S.stops });
  let body = '';
  if (t === 'overview') { const live = (S.trip ? 1 : 0) + (S.line && S.line.status !== 'ended' ? 1 : 0);
    const done = S.history.filter(x => x.profit != null), prof = done.reduce((a, x) => a + x.profit, 0), avg = done.length ? prof / done.length : null;
    body = `<div class="kgrid">${kc('Live orders', String(live), 'This session')}${kc('Gross bookings', money(S.history.reduce((a, x) => a + (+x.total || 0), 0)), S.history.length ? S.history.length + ' completed' : 'No completed trips yet')}${kc('Profit / trip', avg == null ? '—' : money(avg), 'Target ' + money(PROFIT_TARGET), avg != null && avg < PROFIT_TARGET ? 'red' : '')}${kc('Runners online', S.r.online ? '1' : '0', 'Runner app')}</div>${live ? '' : oEmpty('Activity', 'Bookings appear here as customers place them.')}`; }
  if (t === 'jobs') { const rows = [S.trip && `<div class="frow" id="owTrip"><span><b>${esc(tripCat(S.trip))}</b> · ${S.trip.pref !== 'any' ? esc(prefLabel(S.trip.pref)) + ' · ' : ''}${S.trip.stops.length} stop${S.trip.stops.length === 1 ? '' : 's'}</span><span class="sec">${S.trip.courier ? 'Courier (demo) · ' + esc(S.trip.courier.partner) : S.trip.status === 'accepted' ? 'Runner assigned · stop ' + Math.min((S.trip.step || 0) + 1, S.trip.stops.length) + '/' + S.trip.stops.length : 'Finding a runner'}</span><span class="num">${money(S.trip.q.total)} est.</span></div>`, S.line && S.line.status !== 'ended' && `<div class="frow" id="owLine"><span><b>${esc(LINE_STR.tileTitle)}</b> · ${esc(S.line.place.name)}</span><span class="sec">${esc(S.line.status)}${S.line.relief ? ' · relief requested' : ''}</span><span class="num">${money(S.line.est.total)} est.</span></div>`].filter(Boolean);
    const hist = S.history.map(x => `<div class="frow"><span><b>${esc(x.cat || x.title)}</b> · ${new Date(x.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })}</span><span class="sec">Runner ${money(x.pay || 0)}${x.profit != null ? ' · profit ' + money(x.profit) : ''}</span><span class="num">${money(x.total)}</span></div>`);
    body = (rows.length ? `<div class="panel" style="margin-top:0"><h3>Live</h3>${rows.join('')}</div>` : oEmpty('Live', 'No live orders. New bookings appear here.')) + '<div class="panel" id="owDispatch"></div>' + (hist.length ? `<div class="panel"><h3>Completed</h3>${hist.join('')}</div>` : ''); }
  if (t === 'runners') { const paid = S.history.reduce((a, x) => a + (+x.pay || 0), 0), req = S.trip && S.trip.pref !== 'any' ? prefLabel(S.trip.pref) : null;
    body = `<div class="panel" style="margin-top:0"><h3>Runners</h3>${S.r.online || S.history.length ? `<div class="frow" id="owRunner"><span><b>Runner 1</b> · Standard tier · Employee</span><span class="sec">${S.r.online ? 'Online' : 'Offline'} · ${S.history.length} job${S.history.length === 1 ? '' : 's'}</span><span class="num">${money(paid)} paid</span></div>` : empty('No runners online', 'Runners appear here once they go online in the Runner app.')}
      <div class="group-f">W-2 employee · ${esc(PAID_COPY)}. Tiers: Standard, Top-rated (25+ jobs at 4.9★+). Customers can pick a favorite or a top-rated runner.${req ? ' Live request: ' + esc(req) + '.' : ''}</div></div>`; }
  if (t === 'pricing') { const D = PricingEngine.DEF, e = sample.e, pf = [['capPad', 'Spending-cap buffer (%) · matches payment hold']];
    const defs = ['gig_rate', 'pay_basis', 'mileage_rate', 'park_find_min', 'mph', 'weather', 'busy_fee', 'busy_fee_cap', 'target_margin', 'trips_wk', 'insurance_monthly', 'maps_per_order', 'dropoff'];
    body = `<div class="two"><div class="panel" style="margin-top:0"><h3>Pricing engine v4 (read-only)</h3><div class="frow"><span><b>No fixed fee.</b> Each price set from time, miles, stops, weather and demand</span><span class="num">target ≈ ${money(PROFIT_TARGET)} profit/trip</span></div>${defs.map(k => `<div class="frow"><span>${k}</span><span class="num">${esc(String(D[k]))}</span></div>`).join('')}<div class="group-f">The engine's defaults come from finance/pricing_v4 (spec.md). To change the formula, update engine.js there and run tools/build_pricing.py.</div>
      <h3 style="margin-top:16px">App settings</h3>${pf.map(([k, l]) => `<div class="frow"><span>${l}</span><input class="input" type="number" step="0.05" value="${S.pay[k]}" data-change="OW.setPay" data-args="${esc(JSON.stringify([k]))}"></div>`).join('')}</div>
    <div class="panel" style="margin-top:0"><h3>Live preview · current cart (${S.stops.length} stop${S.stops.length === 1 ? '' : 's'}, straight-line est.)</h3>${e ? [['Service fee', e.price], ['Runner total', e.runner_total], ['Variable cost', e.variable_cost], ['Margin (variable)', e.margin_variable], ['All-in cost', e.allin_cost], ['Margin (all-in)', e.margin_allin]].map(([l, v]) => `<div class="frow"><span>${l}</span><span class="num ${v < 0 ? 'red' : ''}">${money(v)}</span></div>`).join('') + `<div class="frow"><span>Minutes · miles</span><span class="num">${e.minutes} · ${e.miles.toFixed(1)}</span></div>` : '<div class="sub sec">No stops</div>'}<div class="group-f">Prototype: calculated in the browser. Production prices and re-verifies on the server.</div></div></div>`; }
  if (t === 'promos') body = `<div class="panel" style="margin-top:0"><h3>Launch promos v2 · budget cap $12.1k · expected ~$3.8k / 4 wks</h3>${PROMOS.map(([n, d, c]) => `<div class="frow"><span><b>${n}</b></span><span class="sec">${d}</span><span class="num">${c}</span></div>`).join('')}<div class="group-f">Off until Jeremy approves launch. Household cap ($60 vs $70) pending Adam + Lex.</div></div>`;
  if (t === 'support') body = oEmpty('Support queue', 'All clear. Customer and runner issues appear here.');
  const title = secs.find(s => s[0] === t)[1];
  return `<div class="owner"><aside class="side"><div class="t3" style="padding:4px 10px 12px">${BRAND.name} <span class="fn">Ops</span></div>${secs.map(([k, l, ic]) => `<button class="sb ${k === t ? 'on' : ''}" ${act('OW.tab', k)}>${icon(ic)}${l}</button>`).join('')}</aside>
  <main class="omain"><div class="mobile-owner-tabs">${seg(secs.map(s => [s[0], s[1].split(' ')[0]]), t, 'OW.tab')}</div><h1 class="t1" style="margin:8px 0 16px">${title}</h1>${body}<p class="demo-note" style="margin-top:24px">Prototype. No seeded data: every number here comes from bookings made in this session. Prices shown are estimates; the server sets final prices.</p><button class="btn sm gray" id="signOut" ${act('AU.signOut')}>Sign out</button></main></div>`;
}

/* ================= SHELL ================= */
function R() {
  const dev = $('#device'), desk = $('#desk');
  document.body.dataset.view = S.view; Store.save();
  if (!AU.session()) { $('#screen').replaceChildren(); desk.replaceChildren(); $('#map').style.visibility = 'hidden'; return; }   // gated: nothing renders without a session
  if (S.view === 'o') { dev.parentElement.style.display = 'none'; desk.style.display = 'block'; desk.replaceChildren(dom(owner())); mountDispatch(); return; }
  dev.parentElement.style.display = ''; desk.style.display = 'none';
  const scrolls = {}; $$('#screen [data-scroll]').forEach(e => scrolls[e.dataset.scroll] = e.scrollTop);
  const out = S.view === 'c' ? customer() : runnerView();
  const key = S.view + (S.view === 'c' ? S.c.screen : S.r.tab);
  const scr = $('#screen'); scr.replaceChildren(dom(out.html + (out.tab || '')));
  if (key !== lastScreenKey) { scr.classList.remove('fade'); void scr.offsetWidth; scr.classList.add('fade'); lastScreenKey = key; }
  else $$('#screen [data-scroll]').forEach(e => { if (scrolls[e.dataset.scroll] != null) e.scrollTop = scrolls[e.dataset.scroll]; });
  $('#map').style.visibility = out.scene ? 'visible' : 'hidden';
  if (out.scene) Maps.render($('#map'), out.scene);
  layoutSheets(); bindCollapse(); mountAdd(); LN.mount(); mountCheckout(); if (typeof TL !== 'undefined') TL.mount(); dev.dataset.dark = '';
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
/* Each app is its own page (/customer/, /runner/, /owner/). The role comes from <body data-app> and can't be changed in-app. */
const ROLE = { customer: 'c', runner: 'r', owner: 'o' };
function boot() {
  S.view = ROLE[document.body.dataset.app] || 'c';
  Store.load(); Store.listen();
  R(); AU.mount(); fit(); clock(); setInterval(clock, 15000);
  window.addEventListener('resize', () => { fit(); if (S.view !== 'o') layoutSheets(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js', { scope: './' }).catch(() => { });
}
document.addEventListener('DOMContentLoaded', () => { wireActions(); boot(); });
