/* UI layer. Renders Customer / Runner / Owner. State lives in S (data.js). */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let lastScreenKey = '', matchTimer = 0, offerTimer = 0;

/* ---------- small helpers ---------- */
function haptic() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { } }
function toast(msg, ic = 'check') { const t = $('#toast'); t.innerHTML = icon(ic, 's') + '<span>' + esc(msg) + '</span>'; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
const tierBadge = t => t === 'pro' ? `<span class="badge pro">${icon('seal', 's')}Pro</span>` : `<span class="badge std">Standard</span>`;
const avatar = (r, cls = '') => `<div class="avatar ${cls}" style="background:linear-gradient(135deg,${r.color},${r.color}cc)">${initials(r.name)}</div>`;
const cell = (o) => `<div class="cell ${o.tap ? 'tap' : ''}" ${o.tap ? `onclick="${o.tap}"` : ''} style="${o.inset ? '--inset:' + o.inset + 'px' : (o.ic ? '--inset:58px' : '')}">
  ${o.ic ? `<div class="ic ${o.icc || ''}">${icon(o.ic)}</div>` : ''}${o.left || ''}
  <div class="grow"><div class="title ${o.tcls || ''}">${o.title}</div>${o.sub ? `<div class="subt">${o.sub}</div>` : ''}</div>
  ${o.acc != null ? `<div class="acc">${o.acc}</div>` : ''}${o.chev ? `<span class="chev">${icon('chevR', 's')}</span>` : ''}</div>`;
const group = (h, cells, f) => `${h ? `<div class="group-h">${h}</div>` : ''}<div class="group">${cells.join('')}</div>${f ? `<div class="group-f">${f}</div>` : ''}`;
const seg = (opts, cur, fn) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? 'on' : ''}" onclick="${fn}('${v}')">${l}</button>`).join('')}</div>`;
function sheet(o) {
  const cur = S.det[o.id] || o.def || 'medium';
  return `<div class="sheet ${o.tabbar ? 'has-tabbar' : ''} ${o.solid ? 'solid' : ''}" data-sheet="${o.id}" data-detents="${(o.detents || ['medium', 'large']).join(',')}" data-detent="${cur}">
   <div class="grabber" title="Drag to resize"><i></i></div>${o.head ? `<div class="sh-head">${o.head}</div>` : ''}
   <div class="sh-body" data-scroll="sb-${o.id}">${o.body}</div>${o.foot ? `<div class="sh-foot">${o.foot}</div>` : ''}</div>`;
}
function page(title, body, o = {}) {
  return `<div class="page ${o.notab ? 'notab' : ''}" data-scroll="pg-${title}"><div class="navbar"><div class="nl">${o.back ? `<button class="backbtn" onclick="${o.back}">${icon('chevL')}${o.backLabel || 'Back'}</button>` : ''}</div><div class="nt">${title}</div><div class="nr">${o.right || ''}</div></div>
  <h1 class="lt">${title}</h1><div class="page-body">${body}</div></div>`;
}
const tabbar = (tabs, cur, fn) => `<nav class="tabbar">${tabs.map(([k, l, ic]) => `<button class="${k === cur ? 'on' : ''}" onclick="${fn}('${k}')" aria-label="${l}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`;

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
  const cars = RUNNERS.filter(r => r.status !== 'offline').map((r, i) => ({ lat: HOME.lat + Math.sin(i * 2.1) * .006, lng: HOME.lng + Math.cos(i * 2.1) * .008, kind: 'car' }));
  return { pts: [{ ...HOME, kind: 'end' }].concat(cars), path: [], runner: null, start: HOME };
}

/* ================= CUSTOMER actions ================= */
const C = {
  go(screen) { S.c.screen = screen; haptic(); R(); },
  tab(t) { S.c.tab = t; S.c.screen = t; R(); },
  addPlace(k, t) { const L = Places.LOCAL.find(x => x.id === k); if (L && Places.STORE_KINDS.includes(L.kind)) { Places.resolve({ src: 'local', place: L, kind: L.kind }).then(pl => ST.open(pl)); return; } S.stops.push(mkStop(t, k)); haptic(); R(); toast('Added ' + PLACES[k].name + ' to your route'); },
  addFavList(id) { const L = FAV_LISTS.find(x => x.id === id); L.stops.forEach(x => { if (!S.stops.some(s => s.pid === x.pid)) S.stops.push(mkStop(x.type, x.pid, { items: x.items.map(i => ({ ...i })) })); }); S.c.screen = 'stops'; R(); toast(L.name + ' added'); },
  addBundle(id) { const b = BUNDLES.find(x => x.id === id); b.places.forEach((p, i) => { if (!S.stops.some(s => s.pid === p)) S.stops.push(mkStop(b.types[i], p)); }); S.c.screen = 'stops'; R(); toast(b.name + ': $' + b.off + ' off applied'); },
  dismiss(k) { S.dismissed[k] = 1; R(); },
  remove(id) { S.stops = S.stops.filter(s => s.id !== id); S.stops.forEach(s => { if (s.from === id) s.from = null; }); if (S.open === id) S.open = null; R(); },
  toggle(id) { S.open = S.open === id ? null : id; R(); },
  addItem(id) { const s = S.stops.find(x => x.id === id), n = $('#in_' + id).value.trim(), pe = $('#ip_' + id), p = pe ? parseFloat(pe.value) || 0 : 0; if (!n) return; s.items.push({ n, p }); R(); },
  rmItem(id, j) { S.stops.find(x => x.id === id).items.splice(j, 1); R(); },
  note(id, v) { S.stops.find(x => x.id === id).note = v; },
  link(id, v) { S.stops.find(x => x.id === id).from = v || null; R(); },
  white(id) { const s = S.stops.find(x => x.id === id); s.white = !s.white; R(); },
  routeView(v) { S.c.routeView = v; R(); },
  speed(v) { S.speed = v; R(); }, tier(v) { S.tier = v; haptic(); R(); },
  fav(id) { S.requestFav = S.requestFav === id ? null : id; R(); },
  cap(d) { const q = quote(); S.cap = Math.max(0, (S.cap == null ? q.suggested : S.cap) + d); R(); },
  member() { S.member = !S.member; R(); toast(S.member ? 'Welcome to ' + BRAND.plus : 'Membership paused'); },
  confirm() {
    const q = quote(); haptic(); const m = matchRunner(S.tier, S.requestFav);
    S.trip = { status: 'matching', step: 0, q, tier: S.tier, runner: m.r.id, favMatch: m.fav, favMsg: m.favUnavailable, stops: S.stops.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })) };
    S.c.screen = 'matching'; S.tip = null; S.rating = 0; R();
    clearTimeout(matchTimer); matchTimer = setTimeout(() => { if (S.trip && S.trip.status === 'matching') { S.trip.status = 'active'; if (S.c.screen === 'matching') S.c.screen = 'tracking'; R(); toast(runner(S.trip.runner).name + ' accepted your trip'); } }, 2600);
  },
  cancel() { clearTimeout(matchTimer); S.trip = null; S.c.screen = 'price'; R(); toast('Trip cancelled — no charge'); },
  step() { if (!S.trip) return; S.trip.step = Math.min(S.trip.step + 1, S.trip.stops.length + 1); if (S.trip.step > S.trip.stops.length) S.trip.status = 'done'; R(); },
  star(id) { const i = S.favs.indexOf(id); if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id); if (i >= 0 && S.requestFav === id) S.requestFav = null; haptic(); R(); toast(i >= 0 ? 'Removed from favorites' : runner(id).name + ' added to favorites', 'star'); },
  rate(n) { S.rating = n; haptic(); R(); },
  tipSet(v) { S.tip = S.tip === v ? null : v; R(); },
  finish() { const t = S.trip, r = runner(t.runner); S.history.unshift({ date: 'Today', title: t.stops.length + ' stops · ' + t.stops.map(s => placeOf(s).name).slice(0, 3).join(', '), total: t.q.f.service + t.q.goods + (S.tip || 0), runner: r.id, saved: t.q.save.usd });
    S.trip = null; S.c.screen = 'home'; S.c.tab = 'home'; R(); toast('Thanks! Receipts sent to your email'); },
  reorder() { S.c.screen = 'stops'; R(); toast('Last trip loaded — edit, then review'); },
  say(t) { t = (t || '').trim(); if (!t) return; S.chat.push(['me', t]); setTimeout(() => { S.chat.push(['them', 'Got it! 👍']); if (S.c.screen === 'chat') R(); }, 700); R(); },
  weekly() { S.weekly = !S.weekly; haptic(); R(); toast(S.weekly ? 'Repeats weekly' : 'Weekly repeat off', 'calendar'); },
  refShare() { const r = S.ref; if (r.sent.length >= 5) { toast('Monthly limit reached (5 referrals)'); return; } r.sent.push({ n: 'Invite ' + (r.sent.length + 1), st: 'invited' }); try { navigator.clipboard && navigator.clipboard.writeText('Use code ' + r.code).catch(() => { }); } catch (e) { } R(); toast('Invite link copied', 'gift'); },
  share() { const u = location.href.split('#')[0] + '#track'; try { navigator.clipboard && navigator.clipboard.writeText(u).catch(() => { }); } catch (e) { } toast('Live tracking link copied', 'share'); }
};

/* ================= CUSTOMER screens ================= */
function customer() {
  const sc = S.c.screen; const q = quote(); let html = '', scene = null, tab = false, map = true;
  if (sc === 'home') {
    tab = true; scene = homeScene();
    const live = S.trip;
    const bundles = BUNDLES.filter(b => bundleActive(b) && !S.dismissed['b_' + b.id]);
    html = `<button class="fbtn tl" aria-label="Account" onclick="C.tab('account')">${icon('person')}</button>` + sheet({ id: 'home', detents: ['peek', 'medium', 'large'], def: 'medium', tabbar: true,
      head: `<div class="t2" style="margin:0 0 12px">Hi, Jeremy</div><button class="where" onclick="AS.open()">${icon('pin')}<span>Where to?</span><span class="sch" role="button" aria-label="Schedule" onclick="event.stopPropagation();S.speed=S.speed==='schedule'?'now':'schedule';R()">${icon('clock', 's')}${S.speed === 'schedule' ? 'Later' : 'Now'}</span></button>`,
      body: `${live ? `<div class="group" style="margin-top:12px">${cell({ ic: 'route', title: S.trip.status === 'done' ? 'Trip delivered' : 'Trip in progress', sub: runner(S.trip.runner).name + ' · ' + (S.trip.status === 'matching' ? 'matching…' : S.trip.status === 'done' ? 'rate & tip' : 'stop ' + Math.min(S.trip.step + 1, S.trip.stops.length) + ' of ' + S.trip.stops.length), chev: 1, tap: "C.go('" + (S.trip.status === 'matching' ? 'matching' : S.trip.status === 'done' ? 'rate' : 'tracking') + "')" })}</div>` : ''}
      <div class="group-h">Your trip</div><div class="group">${cell({ ic: 'list', title: S.stops.length + ' stops · one upfront price', sub: S.stops.map(s => esc(placeOf(s).name)).join(' → ') || 'No stops yet', chev: 1, tap: "C.go('stops')" })}</div>
      <div class="group-h">Reorder favorites</div><div class="group">${FAV_LISTS.map(L => cell({ ic: L.id === 'sat' ? 'calendar' : 'pill', icc: 'orange', title: L.name, sub: L.stops.length + ' stop' + (L.stops.length > 1 ? 's' : '') + ' · ' + L.when, acc: `<button class="btn sm gray" onclick="event.stopPropagation();C.addFavList('${L.id}')">Add</button>` })).join('')}</div>
      ${bundles.length ? `<div class="group-h">Limited-time bundles</div><div class="hscroll">${bundles.map(b => `<div class="hcard"><div style="display:flex;justify-content:space-between;align-items:start"><span class="badge acc">$${b.off} off</span><button class="iconbtn" style="width:26px;height:26px" aria-label="Dismiss ${b.name}" onclick="C.dismiss('b_${b.id}')">${icon('x', 's')}</button></div><div class="hl">${b.name}</div><div class="fn">${b.desc}</div><div class="cap">Ends ${fmtEnd(b.ends)}</div><button class="btn sm" style="margin-top:4px" onclick="C.addBundle('${b.id}')">Add both</button></div>`).join('')}</div>` : ''}
      <div class="group-h">Recent</div><div class="group">${['grandma', 'cvs', 'cleaners'].map(k => cell({ ic: 'clock', icc: 'gray', title: PLACES[k].name, sub: PLACES[k].addr })).join('')}</div>` });
  }
  if (sc === 'add' || sc === 'place' || sc === 'store') { map = false; html = addScreens(sc); }
  if (sc === 'stops') {
    scene = sceneFor(S.stops);
    const pro = needsPro(S.stops), fe = S.pay.freeEvery, n = S.stops.length, rem = n % fe, toFree = fe - rem, sugg = n ? routeSuggestions() : [];
    const ab = activeBundle(S.stops);
    const bundles = BUNDLES.filter(b => bundleActive(b) && !S.dismissed['b_' + b.id] && b !== ab);
    html = `<button class="fbtn tl" aria-label="Back" onclick="C.go('home')">${icon('chevL')}</button>` + sheet({ id: 'stops', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<div style="display:flex;align-items:baseline;justify-content:space-between"><div class="t1">Your trip</div><span class="fn">${n} stop${n === 1 ? '' : 's'} · ends at Home</span></div>`,
      body: `<div class="ups" style="margin-top:8px;display:block;background:var(--bg2)"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="sub"><b>${rem === 0 && n ? 'Stop fee waived on ' + q.f.freeStops + ' stop' + (q.f.freeStops > 1 ? 's' : '') + ' ✓' : 'Add ' + toFree + ' more stop' + (toFree > 1 ? 's' : '') + ' — your ' + fe + 'th stop fee is free'}</b></span><span class="fn num">${rem === 0 && n ? fe : rem}/${fe}</span></div>
        <div class="bar" style="margin-top:8px"><i style="width:${(rem === 0 && n ? 1 : rem / fe) * 100}%"></i></div><div class="cap" style="margin-top:6px">Every ${fe}th stop’s ${money(S.pay.perStop)} stop fee is on us. No minimums, nothing pre-added.</div></div>
      ${pro.length ? `<div class="group-f" style="margin:12px 4px 0">${tierBadge('pro')} Needs a Pro runner: ${pro.map(esc).join('; ')}.</div>` : ''}
      <div class="group-h">Stops · in the order you added them</div><div class="group">${S.stops.map(stopCell).join('') || cell({ title: '<span class="sec">No stops yet — add one below</span>' })}${cell({ ic: 'house', icc: 'gray', title: 'Home', sub: 'Purchases delivered to you at the end' })}</div>
      <button class="where addsearch" style="margin-top:12px" onclick="AS.open()">${icon('search')}<span>Add a stop: search a store or address</span></button>
      ${sugg.length ? `<div class="group-h">On your route</div>${sugg.map(x => `<div class="ups"><div style="width:36px;height:36px;border-radius:10px;background:var(--fill);color:var(--tint);display:grid;place-items:center;flex:none">${icon(TYPES[x.type].ic)}</div><div style="flex:1;min-width:0"><div class="hl ellip">${x.p.name}</div><div class="fn">Add a stop on your route for <b class="tint">+${money(x.m.usd)}</b> · +${Math.max(1, Math.round(x.m.min))} min</div></div><button class="btn sm" onclick="C.addPlace('${x.k}','${x.type}')">${TYPES[x.type].store && Places.LOCAL.some(l => l.id === x.k && Places.STORE_KINDS.includes(l.kind)) ? 'Shop' : 'Add'}</button><button class="x" aria-label="Not now" onclick="C.dismiss('p_${x.k}')">${icon('x')}</button></div>`).join('')}<div class="group-f">The price is the exact change to your service fee. Store items are extra, at shelf price; you pick them next.</div>` : ''}
      ${ab ? `<div class="group-h">Bundle applied</div><div class="ups"><span class="badge acc">−$${ab.off}</span><div style="flex:1"><div class="hl">${ab.name}</div><div class="cap">Ends ${fmtEnd(ab.ends)}</div></div></div>` : ''}
      ${bundles.length ? `<div class="group-h">Limited-time bundles</div>${bundles.map(b => `<div class="ups"><span class="badge acc">$${b.off} off</span><div style="flex:1;min-width:0"><div class="hl">${b.name}</div><div class="fn">${b.desc}</div><div class="cap">Ends ${fmtEnd(b.ends)}</div></div><button class="btn sm gray" onclick="C.addBundle('${b.id}')">Add</button><button class="x" aria-label="Dismiss ${b.name}" onclick="C.dismiss('b_${b.id}')">${icon('x')}</button></div>`).join('')}` : ''}
      ${n ? `<div class="group-h">One trip vs. separate orders</div><div class="group">${cell({ ic: 'clock', icc: 'green', title: '~' + fmtMin(q.separate.min) + ' of your time saved', sub: 'vs. doing ' + n + ' errand' + (n > 1 ? 's' : '') + ' yourself (est. 22 min each)' })}${cell({ ic: 'dollar', icc: 'green', title: money(q.f.service) + ' for all ' + n + ' stops', sub: 'vs. ~' + money(q.separate.usd) + ' in separate delivery fees (est. $7.99 each)' })}</div><div class="group-f">Estimates for comparison only. Your price is fixed before you confirm.</div>` : ''}`,
      foot: `<button class="btn" ${n ? '' : 'disabled'} onclick="C.go('route')">Review route · ${n} stop${n === 1 ? '' : 's'}</button>` });
  }
  if (sc === 'route') {
    const r = q.route, ent = S.c.routeView === 'entered';
    scene = sceneFor(S.stops, { entered: ent, final: true }); scene.top = 235; scene.bottom = 400;
    html = `<button class="fbtn tl" aria-label="Back" onclick="C.go('stops')">${icon('chevL')}</button>
    <div class="banner enter"><div class="badge-ic">${icon('route')}</div><div>${q.save.usd >= .01 ? `<b>We optimized your route</b><br><span class="sec">You save ${money(q.save.usd)} · ${Math.max(1, Math.round(q.save.min))} min vs. the order you entered</span>` : `<b>Your order is already the fastest</b><br><span class="sec">We checked every possible order</span>`}</div></div>` +
      sheet({ id: 'route', detents: ['medium', 'large'], def: 'medium',
        head: `<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px"><div class="t2">Route</div><span class="fn num">${(ent ? r.enteredMiles : r.miles).toFixed(1)} mi · ~${fmtMin(ent ? r.enteredDrive + r.dwell : r.mins)}</span></div>${seg([['opt', 'Optimized'], ['entered', 'As entered']], S.c.routeView, 'C.routeView')}`,
        body: `<div style="height:12px"></div>` + routeList(S.stops, ent ? r.entered : r.order, { start: HUB, end: HOME }) +
          `<div class="group-f" style="margin:8px 4px 0">${r.exact ? 'Exact shortest order: every valid order was checked.' : 'Near-optimal order (large trip, heuristic search).'}${r.prec.length ? ' Pickups always come before their drop-offs, so the runner has the item in hand.' : ''}${r.enteredFixed ? ' Your entered order had a drop-off before its pickup; we fixed that for the comparison.' : ''}</div>`,
        foot: `<button class="btn" onclick="C.go('options')">Choose options</button>` });
  }
  if (sc === 'options') {
    scene = sceneFor(S.stops, { final: true }); const pro = needsPro(S.stops); if (pro.length && S.tier !== 'pro') S.tier = 'pro';
    const qs = quote({ stops: S.stops, tier: 'standard' }), qp = quote({ stops: S.stops, tier: 'pro' }), cq = quote();
    const m = matchRunner(S.tier, S.requestFav), favs = S.favs.map(runner);
    html = `<button class="fbtn tl" aria-label="Back" onclick="C.go('route')">${icon('chevL')}</button>` + sheet({ id: 'options', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<div class="t2" style="margin-bottom:12px">Choose a trip</div>${seg([['now', 'Now'], ['rush', 'Rush'], ['schedule', 'Schedule']], S.speed, 'C.speed')}`,
      body: `${S.speed === 'schedule' ? `<div class="group" style="margin-top:12px">${cell({ ic: 'calendar', title: 'Start time', acc: `<select aria-label="Start time" onchange="S.when=this.value;R()" style="text-align:right">${['Today 2:00 PM', 'Today 5:00 PM', 'Sat 10:00 AM', 'Sun 9:00 AM'].map(w => `<option ${w === S.when ? 'selected' : ''}>${w}</option>`).join('')}</select>` })}</div>` : ''}
      <div style="margin-top:12px">${[['standard', 'Standard', 'car', 'Everyday errands · background-checked', qs], ['pro', 'Pro', 'seal', 'Rx & ID checks, high-value, white-glove', qp]].map(([k, l, ic, d, qq]) => `
      <button class="opt ${S.tier === k ? 'on' : ''} ${k === 'standard' && pro.length ? 'dis' : ''}" onclick="C.tier('${k}')" aria-pressed="${S.tier === k}"><div class="art">${icon(ic, 'l')}</div><div style="min-width:0;flex:1"><div class="hl">${l}</div><div class="fn">${S.speed === 'schedule' ? S.when : '~' + fmtMin(qq.eta * (S.speed === 'rush' ? .7 : 1))} · ${d}</div>${k === 'standard' && pro.length ? `<div class="cap" style="color:var(--orange)">Unavailable: ${esc(pro[0])}</div>` : ''}</div><div class="pr"><div class="hl num">${money(quote({ stops: S.stops, tier: k, speed: S.speed }).total)}</div><div class="cap num">${money(quote({ stops: S.stops, tier: k, speed: S.speed }).f.service)} fee</div></div></button>`).join('')}</div>
      <div class="group-h">Request a favorite runner</div><div class="group">${favs.length ? favs.map(r => cell({ left: avatar(r, 's'), title: r.name + ' ' + tierBadge(r.tier), sub: r.status === 'available' ? '<span class="green">Available now</span>' : (r.status === 'offline' ? 'Offline' : 'On another trip'), acc: `<button class="toggle ${S.requestFav === r.id ? 'on' : ''}" role="switch" aria-checked="${S.requestFav === r.id}" aria-label="Request ${r.name} again" onclick="C.fav('${r.id}')"></button>` })).join('') : cell({ title: '<span class="sec">Star a runner during or after a trip to request them again</span>' })}</div>
      ${S.requestFav ? `<div class="group-f">${m.fav ? 'We’ll send this trip to ' + runner(S.requestFav).name + ' first.' : esc(m.favUnavailable) + '. We’ll match the best available ' + (S.tier === 'pro' ? 'Pro ' : '') + 'runner instead, same price.'}</div>` : ''}
      <div class="group-h">Purchases</div><div class="group">${cell({ ic: 'creditcard', title: 'Spending cap', sub: 'Items ≈ ' + money(cq.goods) + ' at shelf price', acc: `<span class="hl num" style="color:var(--label);margin-right:8px">${money(cq.cap)}</span><div class="stepper"><button aria-label="Lower cap" onclick="C.cap(-5)">−</button><button aria-label="Raise cap" onclick="C.cap(5)">+</button></div>` })}
      ${cell({ ic: 'chat', title: 'Ask before substituting', acc: `<button class="toggle ${S.subs ? 'on' : ''}" role="switch" aria-checked="${S.subs}" aria-label="Ask before substituting" onclick="S.subs=!S.subs;R()"></button>` })}</div>
      <div class="group-f">Suggested cap = items + ${S.pay.capPad}% buffer (matches the payment hold). Unused cap is refunded with receipts. Anything over the cap needs your OK in chat. Alcohol & Rx: ID verified at handoff.</div>
      <div class="group-h">Payment</div><div class="group">${cell({ ic: 'card', icc: 'gray', title: 'Apple Pay', sub: 'Visa •• 4242', chev: 1, tap: "toast('Payment methods (demo)','card')" })}${cell({ ic: 'star', icc: 'orange', title: BRAND.plus, sub: S.member ? S.pay.memberDisc + '% off service fees, applied' : 'Save ' + S.pay.memberDisc + '% on every service fee · $14.99/mo', acc: `<button class="toggle ${S.member ? 'on' : ''}" role="switch" aria-checked="${S.member}" aria-label="${BRAND.plus} membership" onclick="C.member()"></button>` })}</div>`,
      foot: `<button class="btn" onclick="C.go('price')">Continue with ${S.tier === 'pro' ? 'Pro' : 'Standard'} · ${money(cq.total)}</button>` });
  }
  if (sc === 'price') {
    scene = sceneFor(S.stops, { final: true }); const f = q.f;
    const line = (l, v, cls = '') => `<div class="cell" style="min-height:36px;padding:8px 16px"><div class="grow sub">${l}</div><div class="acc num sub" style="color:${cls === 'green' ? 'var(--green)' : 'var(--label)'}">${v}</div></div>`;
    html = `<button class="fbtn tl" aria-label="Back" onclick="C.go('options')">${icon('chevL')}</button>` + sheet({ id: 'price', detents: ['medium', 'large'], def: 'large', solid: true,
      head: `<div class="fn" style="text-transform:uppercase">One upfront price</div><div class="big-price num" style="margin:6px 0 4px">${money(q.total)}</div><div class="sub sec">${S.tier === 'pro' ? 'Pro' : 'Standard'} · ${S.stops.length} stops · ${S.speed === 'schedule' ? S.when : S.speed === 'rush' ? 'Rush' : 'Now'} · locked in</div>`,
      body: `${q.save.usd >= .01 ? `<div class="ups" style="margin-top:12px;background:var(--bg2)"><span class="tint">${icon('route')}</span><div class="sub" style="flex:1">Route optimized: <b>${money(q.save.usd)}</b> and ${Math.max(1, Math.round(q.save.min))} min saved, already included.</div></div>` : ''}
      <div class="group-h">Service fee · locked</div><div class="group" style="background:var(--bg2)">${line('Base', money(f.base))}${line('Stops × ' + S.stops.length + (f.freeStops ? ' (' + f.freeStops + ' free)' : ''), money(f.stopFee))}${line('Distance · ' + q.route.miles.toFixed(1) + ' mi', money(f.dist))}${line('Drive time · ' + Math.round(q.route.driveMin) + ' min', money(f.time))}${f.tierAdd ? line('Pro tier', money(f.tierAdd)) : ''}${f.rushAdd ? line('Rush', money(f.rushAdd)) : ''}${f.memberOff ? line(BRAND.plus + ' −' + S.pay.memberDisc + '%', '−' + money(f.memberOff), 'green') : ''}${f.bundleOff ? line(f.bundle.name, '−' + money(f.bundleOff), 'green') : ''}${line('Platform ' + S.pay.servicePct + '%', money(f.platform))}${line('<b>Service fee</b>', '<b>' + money(f.service) + '</b>')}</div>
      <div class="group-h">Purchases</div><div class="group" style="background:var(--bg2)">${line('Spending cap (items + ' + S.pay.capPad + '% buffer)', money(q.cap))}${line('Items at shelf price (est.)', money(q.goods))}${line('Refunded if unused, with receipts', money(q.refund), 'green')}</div>
      <div class="group-f">You won’t pay more than ${money(q.total)} unless you approve an overage in chat. Tips are optional, added after the trip, separate from this price, and 100% go to your runner. Free cancellation until a runner accepts.</div>
      <div class="group-h">Repeat</div><div class="group" style="background:var(--bg2)">${cell({ ic: 'calendar', title: 'Repeat this trip weekly', sub: S.weekly ? 'Every ' + new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ }) + ' · re-priced & confirmed with you each week' : 'Same stops, every week. Skip or cancel anytime.', acc: `<button class="toggle ${S.weekly ? 'on' : ''}" role="switch" aria-checked="${S.weekly}" aria-label="Repeat this trip weekly" onclick="C.weekly()"></button>` })}</div><div class="group-h">vs. separate orders</div><div class="group" style="background:var(--bg2)">${line('Your time saved (est.)', '~' + fmtMin(q.separate.min))}${line('Separate delivery fees (est.)', '~' + money(q.separate.usd))}</div>`,
      foot: `<button class="btn" style="min-height:56px;font-size:19px" onclick="C.confirm()">Confirm ${S.tier === 'pro' ? 'Pro' : 'Standard'} · ${money(q.total)}</button><button class="btn plain" onclick="C.go('stops')">Edit trip</button>` });
  }
  if (sc === 'matching') {
    if (!S.trip) { S.c.screen = 'home'; return customer(); }
    scene = sceneFor(S.trip.stops, { final: true }); const r = runner(S.trip.runner);
    html = `<div class="radar"><i></i><i></i><i></i></div>` + sheet({ id: 'matching', detents: ['medium'], def: 'medium', solid: true,
      body: `<div class="t2" style="margin:8px 0 12px">Matching your runner…</div><div class="indet"></div>
      <div class="sub sec" style="margin-top:16px">${S.trip.favMatch ? 'Asking ' + r.name + ' (your favorite) first.' : S.trip.favMsg ? esc(S.trip.favMsg) + ', so we’re matching the best available ' + (S.trip.tier === 'pro' ? 'Pro ' : '') + 'runner nearby.' : 'Finding a background-checked ' + (S.trip.tier === 'pro' ? 'Pro ' : '') + 'runner near ' + esc(placeOf(S.trip.stops[S.trip.q.route.order[0]]).name) + '.'}</div>
      <div class="group" style="margin-top:16px;background:var(--bg2)">${cell({ ic: 'dollar', icc: 'green', title: money(S.trip.q.total) + ' · locked in', sub: S.trip.stops.length + ' stops · ' + (S.trip.tier === 'pro' ? 'Pro' : 'Standard') })}</div>`,
      foot: `<button class="btn gray" onclick="C.cancel()">Cancel · free</button>` });
  }
  if (sc === 'tracking') {
    if (!S.trip) { S.c.screen = 'home'; return customer(); }
    const t = S.trip, r = runner(t.runner), n = t.stops.length, order = t.q.route.order, done = t.step > n;
    scene = sceneFor(t.stops, { progress: t.step, doneCount: t.step, final: true });
    const eta = done ? 0 : Math.max(3, Math.round(t.q.eta * (1 - t.step / (n + 1))));
    const isFav = S.favs.includes(r.id);
    html = `<button class="fbtn tl" aria-label="Minimize" onclick="C.tab('home')">${icon('chevD')}</button><button class="fbtn tr" aria-label="Share trip" onclick="C.share()">${icon('share')}</button>` + sheet({ id: 'track', detents: ['peek', 'medium', 'large'], def: 'medium',
      head: `<div style="display:flex;align-items:end;justify-content:space-between"><div style="min-width:0"><div class="t1 num">${done ? 'Delivered' : eta + ' min'}</div><div class="sub sec ellip">${done ? 'All stops complete' : t.step === 0 ? 'Heading to ' + esc(placeOf(t.stops[order[0]]).name) : t.step >= n ? 'Heading home with your items' : 'Stop ' + (t.step + 1) + ' of ' + n + ' · ' + esc(placeOf(t.stops[order[t.step]]).name)}</div></div>${tierBadge(t.tier)}</div>
      <div class="bar" style="margin-top:12px"><i style="width:${Math.min(1, t.step / (n + 1)) * 100}%"></i></div>`,
      body: `<div class="group" style="margin-top:12px">${cell({ left: avatar(r), title: r.name, sub: tierBadge(r.tier) + ' ★ ' + r.rating + '<br>' + r.car })}<div class="cell" style="gap:8px;justify-content:space-around"><button class="iconbtn ${isFav ? 'on' : ''}" style="width:auto;padding:0 14px;border-radius:18px;gap:6px;display:flex;align-items:center" aria-pressed="${isFav}" onclick="C.star('${r.id}')">${icon('star', 's')}<span class="sub">${isFav ? 'Favorited' : 'Favorite'}</span></button><button class="iconbtn" style="width:auto;padding:0 14px;border-radius:18px;gap:6px;display:flex;align-items:center" onclick="C.go('chat')">${icon('chat', 's')}<span class="sub">Chat</span></button><button class="iconbtn" style="width:auto;padding:0 14px;border-radius:18px;gap:6px;display:flex;align-items:center" onclick="toast('Calling ${r.name.split(' ')[0]} (masked number)','phone')">${icon('phone', 's')}<span class="sub">Call</span></button></div></div>
      ${t.favMsg ? `<div class="group-f">${esc(t.favMsg)}, so ${r.name} took your trip.</div>` : ''}
      ${done ? `<button class="btn" style="margin-top:16px" onclick="C.go('rate')">Rate & tip</button>` : `<button class="btn gray" style="margin-top:16px" onclick="C.step()">${icon('bolt', 's')} Simulate progress</button>`}
      <div class="group-h">Stops</div>${routeList(t.stops, order, { start: HUB, end: HOME, done: t.step, proof: true })}
      <button class="btn plain" style="margin-top:8px" onclick="C.share()">${icon('share', 's')} Share live tracking link</button>` });
  }
  if (sc === 'chat') {
    map = false; const r = S.trip ? runner(S.trip.runner) : runner('maya');
    html = `<div class="page notab" data-scroll="chat" style="display:flex;flex-direction:column"><div class="navbar" style="background:var(--material);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom-color:var(--sep)"><div class="nl"><button class="backbtn" onclick="C.go(S.trip?'tracking':'activity')">${icon('chevL')}Trip</button></div><div class="nt" style="opacity:1;transform:none">${r.name}</div></div>
    <div style="flex:1;padding:12px 16px">${S.chat.map(m => `<div class="bubble ${m[0]}">${esc(m[1])}</div>`).join('')}
    <div class="group" style="margin:12px 0"><div class="cell" style="display:block"><div class="hl">${icon('ret', 's')} Substitution request</div><div class="sub sec" style="margin:4px 0 10px">Organic milk is out. Swap for Horizon 2% ($4.99, +$0.50)?</div><button class="btn sm" onclick="C.say('Yes, the swap is fine')">Approve</button> <button class="btn sm gray" onclick="C.say('Skip it, please')">Skip</button></div></div>
    <div class="group" style="margin:12px 0"><div class="cell" style="display:block"><div class="hl">${icon('creditcard', 's')} Over your spending cap</div><div class="sub sec" style="margin:4px 0 10px">Approve +$5.00 over your cap? Nothing extra is charged unless you approve.</div><button class="btn sm" onclick="C.say('Approved +$5 over cap')">Approve +$5</button> <button class="btn sm gray" onclick="C.say('Please stay under the cap')">Decline</button></div></div></div>
    <div style="position:sticky;bottom:0;padding:8px 12px calc(var(--sab) + 8px);background:var(--material);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:.5px solid var(--sep)"><div class="chatbar"><input id="msg" placeholder="Message" aria-label="Message" onkeydown="if(event.key==='Enter'){C.say(this.value)}"><button class="iconbtn on" aria-label="Send" onclick="C.say($('#msg').value)">${icon('arrowUp')}</button></div></div></div>`;
  }
  if (sc === 'rate') {
    if (!S.trip) { S.c.screen = 'home'; return customer(); }
    map = false; const t = S.trip, r = runner(t.runner), isFav = S.favs.includes(r.id), charged = t.q.f.service + t.q.goods + (S.tip || 0);
    html = page('Trip complete', `<div style="text-align:center;padding:8px 0 4px"><div class="avatar xl" style="margin:0 auto;background:linear-gradient(135deg,${r.color},${r.color}cc)">${initials(r.name)}</div><div class="t3" style="margin-top:12px">How was ${r.name.split(' ')[0]}?</div><div class="fn" style="margin-top:4px">${t.stops.length} stops · ${tierBadge(r.tier)}</div>
      <div class="stars" style="margin:12px 0" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(i => `<button role="radio" aria-checked="${i === S.rating}" class="${i <= S.rating ? 'on' : ''}" aria-label="${i} star${i > 1 ? 's' : ''}" onclick="C.rate(${i})"><svg viewBox="0 0 24 24"><path d="${ICONS.star}"/></svg></button>`).join('')}</div></div>
      <div class="group-h" style="text-align:center;margin-left:0">Add a tip · optional</div><div class="chips" style="justify-content:center">${[0, 3, 5, 8].map(v => `<button class="chip ${S.tip === v ? 'on' : ''}" onclick="C.tipSet(${v})">${v ? '$' + v : 'No tip'}</button>`).join('')}</div><div class="group-f" style="text-align:center">100% of your tip goes to ${r.name.split(' ')[0]}. It’s separate from the service fee.</div>
      <div class="group" style="margin-top:16px">${cell({ ic: 'star', icc: 'orange', title: 'Favorite ' + r.name.split(' ')[0], sub: 'Request again on future trips', acc: `<button class="toggle ${isFav ? 'on' : ''}" role="switch" aria-checked="${isFav}" aria-label="Favorite runner" onclick="C.star('${r.id}')"></button>` })}${cell({ ic: 'calendar', title: 'Repeat this trip weekly', sub: S.weekly ? 'Every ' + new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ }) + ' · re-priced & confirmed with you each week' : 'Same stops, every week. Skip or cancel anytime.', acc: `<button class="toggle ${S.weekly ? 'on' : ''}" role="switch" aria-checked="${S.weekly}" aria-label="Repeat this trip weekly" onclick="C.weekly()"></button>` })}</div>
      <div class="group-h">Receipt</div><div class="group">${cell({ title: 'Service fee', acc: money(t.q.f.service) })}${cell({ title: 'Items (receipts attached)', acc: money(t.q.goods) })}${cell({ title: 'Unused cap refunded', acc: `<span class="green">${money(t.q.refund)}</span>` })}${cell({ title: 'Tip · 100% to ' + r.name.split(' ')[0], sub: 'Separate from the service fee; ErrandCo keeps none of it', acc: S.tip ? money(S.tip) : '—' })}${cell({ title: '<b>Total charged</b>', acc: '<b style="color:var(--label)">' + money(charged) + '</b>' })}${cell({ ic: 'receipt', icc: 'gray', title: 'View store receipts', chev: 1, tap: "toast('Receipts (demo)','receipt')" })}</div>
      <button class="btn" style="margin-top:24px" onclick="C.finish()">Done</button>`, { notab: true });
  }
  if (sc === 'activity') {
    map = false; tab = true;
    html = page('Activity', `${S.trip ? group('In progress', [cell({ ic: 'route', title: S.trip.stops.length + ' stops · ' + runner(S.trip.runner).name, sub: S.trip.status === 'matching' ? 'Matching…' : S.trip.status === 'done' ? 'Delivered, rate your trip' : 'Stop ' + Math.min(S.trip.step + 1, S.trip.stops.length) + ' of ' + S.trip.stops.length, chev: 1, tap: "C.go('" + (S.trip.status === 'done' ? 'rate' : S.trip.status === 'matching' ? 'matching' : 'tracking') + "')" }), cell({ ic: 'chat', icc: 'gray', title: 'Chat with runner', chev: 1, tap: "C.go('chat')" })]) : ''}
      ${group('Past trips', S.history.map(h => cell({ ic: 'receipt', icc: 'gray', title: esc(h.title), sub: h.date + ' · ' + runner(h.runner).name + (h.saved >= .01 ? ' · route saved ' + money(h.saved) : ''), acc: `<span class="num" style="color:var(--label)">${money(h.total)}</span>` })))}
      <div style="display:flex;gap:8px;margin-top:16px"><button class="btn gray" onclick="C.reorder()">${icon('ret', 's')} Reorder</button><button class="btn gray" style="margin-top:0" onclick="toast('Receipts emailed','receipt')">${icon('receipt', 's')} Receipts</button></div>`);
  }
  if (sc === 'favorites') {
    map = false; tab = true; const favs = S.favs.map(runner);
    html = page('Favorites', `${group('Favorite runners', favs.length ? favs.map(r => cell({ left: avatar(r, 's'), title: r.name + ' ' + tierBadge(r.tier), sub: '★ ' + r.rating + ' · ' + (r.status === 'available' ? 'Available' : r.status === 'offline' ? 'Offline' : 'On another trip'), acc: `<button class="btn sm ${S.requestFav === r.id ? '' : 'gray'}" onclick="C.fav('${r.id}')">${S.requestFav === r.id ? 'Requested' : 'Request'}</button><button class="iconbtn on" aria-label="Unfavorite ${r.name}" onclick="C.star('${r.id}')">${icon('star')}</button>` })) : [cell({ title: '<span class="sec">No favorites yet. Tap Favorite on a runner during or after a trip.</span>' })],
      'If a requested favorite is busy or offline, we match the best available runner at the same price.')}
      ${group('Favorite lists', FAV_LISTS.map(L => cell({ ic: L.id === 'sat' ? 'calendar' : 'pill', icc: 'orange', title: L.name, sub: L.stops.map(s => PLACES[s.pid].name).join(', '), acc: `<button class="btn sm gray" onclick="C.addFavList('${L.id}')">Reorder</button>` })))}
      ${group('Past runners', RUNNERS.filter(r => !S.favs.includes(r.id)).slice(0, 4).map(r => cell({ left: avatar(r, 's'), title: r.name + ' ' + tierBadge(r.tier), sub: '★ ' + r.rating, acc: `<button class="iconbtn" aria-label="Favorite ${r.name}" onclick="C.star('${r.id}')">${icon('star')}</button>` })))}`);
  }
  if (sc === 'account') {
    map = false; tab = true;
    html = page('Account', `<div class="group">${cell({ left: '<div class="avatar" style="background:linear-gradient(135deg,var(--accent),#000)">JL</div>', title: '<b>Jeremy L.</b>', sub: 'Great Neck, NY · ' + (S.member ? BRAND.plus + ' member' : 'Standard account') })}</div>
      <div class="group" style="margin-top:16px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 45%,#000))"><div class="cell" style="background:none;display:block;color:var(--on-accent)"><div class="t3">${BRAND.plus} · $14.99/mo</div><div class="sub" style="opacity:.9;margin:6px 0 12px">${S.pay.memberDisc}% off every service fee · free standing weekly run · Rush at no extra · favorites asked first. Cancel anytime.</div><button class="btn" style="background:#fff;color:#000" onclick="C.member()">${S.member ? 'Manage membership' : 'Join ' + BRAND.plus}</button></div></div>
      ${group('Standing errands', [cell({ ic: 'calendar', title: 'Saturday Run · 10 AM', sub: 'Stop & Shop · Dry cleaner · Library', acc: '<span class="badge green">Active</span>' }), cell({ ic: 'list', icc: 'gray', title: 'Edit list', chev: 1, tap: "C.addFavList('sat')" }), cell({ ic: 'clock', icc: 'gray', title: 'Skip this week', chev: 1, tap: "toast('Saturday Run skipped for Oct 24')" }), cell({ ic: 'pill', icc: 'orange', title: 'Monthly CVS refill', sub: 'Next: Nov 2', acc: '<span class="badge orange">Scheduled</span>' }), cell({ ic: 'plus', icc: 'gray', title: '<span class="tint">New standing errand</span>', tap: "toast('New standing errand (demo)')" })])}
      ${group('Preferences', [cell({ ic: 'chat', title: 'Ask before substituting', acc: `<button class="toggle ${S.subs ? 'on' : ''}" role="switch" aria-checked="${S.subs}" aria-label="Ask before substituting" onclick="S.subs=!S.subs;R()"></button>` }), cell({ ic: 'shieldck', icc: 'green', title: 'ID check at handoff', sub: 'Alcohol & prescriptions' }), cell({ ic: 'card', icc: 'gray', title: 'Payment', sub: 'Apple Pay · Visa •• 4242', chev: 1 })])}
      <div class="group-h">Give a free stop, get a free stop</div><div class="group">${cell({ ic: 'gift', icc: 'orange', title: 'Invite a friend', sub: 'They get a free stop on their first trip. You get one after their first paid trip is completed.', acc: `<button class="btn sm" ${S.ref.sent.length >= 5 ? 'disabled' : ''} onclick="C.refShare()">Invite</button>` })}${cell({ ic: 'tag', icc: 'gray', title: 'Your code: <b>' + S.ref.code + '</b>', sub: S.ref.credits + ' free stop' + (S.ref.credits === 1 ? '' : 's') + ' available' })}${S.ref.sent.map(x => cell({ ic: 'person', icc: 'gray', title: esc(x.n), acc: x.st === 'credited' ? '<span class="badge green">Free stop credited</span>' : x.st === 'pending' ? '<span class="badge orange">Waiting for first paid trip</span>' : '<span class="badge std">Invited</span>' })).join('')}</div><div class="group-f">${S.ref.sent.length} of 5 referrals used in ${S.ref.month}. Credit is added only after your friend’s first paid trip completes. Max 5 referrals per month.</div>`);
  }
  return { html, scene: map ? scene : null, tab: tab ? tabbar([['home', 'Home', 'house'], ['activity', 'Activity', 'clock'], ['favorites', 'Favorites', 'star'], ['account', 'Account', 'person']], S.c.tab, 'C.tab') : '' };
}

/* ---------- stop editing & route list ---------- */
function stopCell(s, i) {
  const p = placeOf(s), T = TYPES[s.type], open = S.open === s.id, goods = s.items.reduce((a, x) => a + (+x.p || 0), 0);
  const pro = (typePro(s) || goods >= HIGH_VALUE || s.white);
  const pickups = S.stops.filter(x => x.id !== s.id && (x.type === 'Personal pickup' || TYPES[x.type].store));
  const head = cell({ ic: T.ic, title: esc(p.name) + (pro ? ' ' + tierBadge('pro') : ''), sub: esc(s.type) + (s.items.length ? ' · ' + s.items.length + ' item' + (s.items.length > 1 ? 's' : '') : '') + (goods ? ' · ' + money(goods) : '') + (s.from ? ' · <span class="carry">' + icon('bag', 's') + 'from ' + esc(placeOf(S.stops.find(x => x.id === s.from) || {}).name) + '</span>' : ''), chev: 0, tap: `C.toggle('${s.id}')`,
    acc: `<span class="chev" style="transform:rotate(${open ? 90 : 0}deg);transition:transform .3s var(--spring)">${icon('chevR', 's')}</span>` });
  if (!open) return head;
  return head + `<div class="cell" style="display:block;--inset:16px;padding-top:4px">
    <div style="display:flex;align-items:center;gap:10px;margin:4px 0 10px"><span class="tint">${icon('pin')}</span><div style="flex:1;min-width:0"><div class="sub ellip">${esc(p.name)}</div><div class="cap ellip">${esc(p.addr || '')}</div></div><button class="btn sm gray" onclick="AS.open({ replace: '${s.id}' })">Change</button></div>
    ${T.store && storeKindOf(s) ? `<button class="btn gray" style="margin-bottom:10px" onclick="ST.edit('${s.id}')">${icon('bag', 's')} Browse ${esc(p.name)} · edit items</button>` : ''}
    ${s.type === 'Drop-off' || s.type === 'Custom task' ? `<label class="fn">Deliver an item picked up at</label><select class="input" style="margin:4px 0 8px" aria-label="Linked pickup" onchange="C.link('${s.id}',this.value)"><option value="">Nothing linked</option>${pickups.map(x => `<option value="${x.id}" ${x.id === s.from ? 'selected' : ''}>${esc(placeOf(x).name)}</option>`).join('')}</select>` : ''}
    <label class="fn">${T.store ? 'Items' : 'What to pick up / drop off'}</label>
    ${s.items.map((x, j) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:.5px solid var(--sep)"><span class="sub" style="flex:1">${esc(x.n)}</span>${T.store ? `<span class="sub num sec">${money(+x.p || 0)}</span>` : ''}<button class="iconbtn" style="width:28px;height:28px" aria-label="Remove ${esc(x.n)}" onclick="C.rmItem('${s.id}',${j})">${icon('minus', 's')}</button></div>`).join('')}
    <div style="display:flex;gap:8px;margin:8px 0"><input class="input" id="in_${s.id}" placeholder="${T.store ? 'Add something not listed' : 'Describe it'}" aria-label="New item" onkeydown="if(event.key==='Enter')C.addItem('${s.id}')">${T.store ? `<input class="input" id="ip_${s.id}" style="width:84px" inputmode="decimal" placeholder="$ est." aria-label="Estimated price">` : ''}<button class="btn sm" aria-label="Add item" onclick="C.addItem('${s.id}')">${icon('plus', 's')}</button></div>
    <input class="input" placeholder="Note for runner" aria-label="Note for runner" value="${esc(s.note)}" onchange="C.note('${s.id}',this.value)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><span class="sub">White-glove care ${tierBadge('pro')}</span><button class="toggle ${s.white ? 'on' : ''}" role="switch" aria-checked="${!!s.white}" aria-label="White-glove care" onclick="C.white('${s.id}')"></button></div>
    ${typePro(s) ? `<div class="cap" style="margin-top:6px">${esc(typePro(s))}: a Pro runner is required.</div>` : goods >= HIGH_VALUE ? `<div class="cap" style="margin-top:6px">Items over ${money(HIGH_VALUE)}: a Pro runner is required.</div>` : ''}
    <button class="btn plain" style="color:var(--red);margin-top:4px" onclick="C.remove('${s.id}')">Remove stop</button></div>`;
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
      <div class="hl">${esc(p.name)} ${(typePro(s) || s.white) ? tierBadge('pro') : ''}</div><div class="fn">${esc(s.type)} · ${esc(p.addr || '')}</div>
      ${s.items.length ? `<div class="sub sec" style="margin-top:2px">${s.items.map(x => esc(x.n)).join(', ')}</div>` : ''}
      ${linked ? `<div class="carry" style="margin-top:4px">${icon('box', 's')}Drop off: ${esc(linked.items.map(x => x.n).join(', ') || 'item')} from ${esc(placeOf(linked).name)}</div>` : ''}
      ${!done && carrying.length && o.carry !== false ? `<div class="carry" style="margin-top:4px;color:var(--label2)">${icon('bag', 's')}Carrying after: ${carrying.map(x => esc(placeOf(x).name)).join(', ')}</div>` : ''}
      ${o.proof && done ? `<div class="fn green" style="margin-top:2px">${icon('camera', 's')} Photo proof · ${TYPES[s.type].store ? 'receipt uploaded' : 'handed off'}</div>` : ''}</div></div>`;
  });
  if (o.end) rows += `<div class="rstop"><div class="rail"><span class="n end">${icon('house', 's')}</span></div><div><div class="hl">${esc(o.end.name)}</div><div class="fn">${esc(o.end.addr)} · deliver purchases</div></div></div>`;
  return `<div class="group" style="padding:4px 16px">${rows}</div>`;
}

/* ================= RUNNER ================= */
const PRO_OFFER = { tier: 'pro', cust: 'M. Levi', stops: [mkStop('Pharmacy', 'cvs', { items: [{ n: 'Rx pickup (ID check)', p: 18, rx: true }] }), mkStop('Personal pickup', 'framer', { id: 'sFrame', items: [{ n: 'Framed oil painting ($1,200)', p: 0 }], white: true }), mkStop('Drop-off', 'kingspt', { from: 'sFrame', items: [{ n: 'Hang painting, white-glove' }] })] };
const STD_OFFER = { tier: 'standard', cust: 'Dana K.', stops: [mkStop('Groceries', 'stopshop', { items: [{ n: '9 items', p: 42 }] }), mkStop('Returns', 'ups', { items: [{ n: 'Amazon return' }] }), mkStop('Dry cleaning', 'cleaners', { items: [{ n: '2 suits' }] })] };
function offers() { const me = runner(S.r.me); return me.tier === 'pro' ? [PRO_OFFER, STD_OFFER] : [STD_OFFER]; }
function offerPay(o) { const q = quote({ stops: o.stops, tier: o.tier, member: false, speed: 'now' }); let pay = q.f.fee * S.pay.runnerShare / 100; if (o.tier === 'pro') pay *= 1 + S.pay.proPayBoost / 100; return { pay, q }; }
const RN = {
  tab(t) { S.r.tab = t; R(); },
  me(id) { S.r.me = id; S.r.online = false; S.r.job = null; S.r.offer = 0; clearInterval(offerTimer); R(); },
  online() { S.r.online = !S.r.online; haptic(); S.r.offer = 0; if (S.r.online) startOffer(); else clearInterval(offerTimer); R(); },
  accept() { clearInterval(offerTimer); const o = offers()[S.r.offer % offers().length]; S.r.job = o; S.r.stop = 0; S.r.tab = 'route'; haptic(); R(); toast('Trip accepted · route optimized'); },
  decline() { S.r.offer++; S.r.passed++; startOffer(); R(); },
  next() { const j = S.r.job, n = j.stops.length; S.r.stop++; haptic(); if (S.r.stop > n) { toast('Trip complete · ' + money(offerPay(j).pay) + ' earned', 'dollar'); S.r.job = null; S.r.tab = 'drive'; } R(); },
  cashout() { S.r.cashed = true; R(); const w = runner(S.r.me).week; toast('Sent ' + money(w - instantFee(w)) + ' · ' + money(instantFee(w)) + ' fee'); }
};
function startOffer() { clearInterval(offerTimer); S.r.offerT = 30; offerTimer = setInterval(() => { if (S.view !== 'r' || !S.r.online || S.r.job) return; S.r.offerT--; if (S.r.offerT <= 0) { RN.decline(); return; } const g = $('#offerRing'); if (g) { g.style.setProperty('--p', S.r.offerT / 30); g.querySelector('b').textContent = S.r.offerT; } }, 1000); }
function runnerView() {
  const me = runner(S.r.me), t = S.r.tab; let html = '', scene = null, map = true;
  const meSw = `<div class="group-h">Viewing as</div>${seg([['maya', 'Maya · Pro'], ['luis', 'Luis · Standard']], S.r.me, 'RN.me')}`;
  if (t === 'drive' || (t === 'route' && !S.r.job)) {
    S.r.tab = 'drive';
    if (!S.r.online) {
      scene = homeScene();
      html = `<div class="pill-online">${avatar(me, 's')}<span class="hl">Offline</span>${tierBadge(me.tier)}</div>` + sheet({ id: 'rdrive', detents: ['medium', 'large'], def: 'medium', tabbar: true,
        body: `<div style="text-align:center;padding:8px 0 16px"><button class="go" onclick="RN.online()" aria-label="Go online">GO</button><div class="t3" style="margin-top:12px">You’re offline</div><div class="sub sec">Go online to get errand trips near Great Neck</div></div>
        ${group('Today', [cell({ ic: 'dollar', icc: 'green', title: money(me.week / 5), sub: 'Earned today · ' + Math.round(me.week / 5 / 22) + ' trips' }), cell({ ic: 'flame', icc: 'orange', title: 'Busy near Middle Neck Rd', sub: '+$2.00 per trip until 7 PM' })])}${meSw}` });
    } else {
      const o = offers()[S.r.offer % offers().length], op = offerPay(o), r = op.q.route;
      scene = sceneFor(o.stops, { start: HUB, end: null });
      html = `<div class="pill-online"><span class="dot"></span><span class="hl">Online</span>${tierBadge(me.tier)}<button class="btn sm gray" onclick="RN.online()">Go offline</button></div>` + sheet({ id: 'roffer', detents: ['medium', 'large'], def: 'large', tabbar: true, solid: true,
        head: `<div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div class="fn" style="text-transform:uppercase">${o.tier === 'pro' ? 'Pro offer · higher pay' : 'New trip'}</div><div class="big-price num">${money(op.pay)}</div><div class="sub sec">${o.stops.length} stops · ${r.miles.toFixed(1)} mi · ~${fmtMin(r.mins)} · ${money(op.pay / (r.mins / 60))}/hr</div></div><div class="ring" id="offerRing" style="--p:${S.r.offerT / 30}"><b class="num">${S.r.offerT}</b></div></div>`,
        body: `${o.tier === 'pro' ? `<div class="ups" style="margin-top:12px;background:var(--bg2)">${tierBadge('pro')}<div class="sub" style="flex:1">Includes +${S.pay.proPayBoost}% Pro pay. Rx ID check and a white-glove $1,200 painting.</div></div>` : ''}
        <div class="group-h">Optimized order</div>${routeList(o.stops, r.order, { start: { name: 'You', addr: 'Great Neck Plaza' }, end: null })}
        <div class="group-f">${o.stops.some(s => s.from) ? 'Pickup is sequenced before its drop-off. ' : ''}Customer: ${esc(o.cust)} · tips go 100% to you.</div>`,
        foot: `<div style="display:flex;gap:8px"><button class="btn gray" style="flex:1" onclick="RN.decline()">Decline</button><button class="btn" style="flex:2" onclick="RN.accept()">Accept</button></div>` });
    }
  }
  if (t === 'route' && S.r.job) {
    const j = S.r.job, r = computeRoute(j.stops, HUB, null), n = j.stops.length, k = S.r.stop, cur = k < n ? j.stops[r.order[k]] : null;
    scene = sceneFor(j.stops, { start: HUB, end: null, progress: k, doneCount: k, final: true });
    const carried = j.stops.filter((s, idx) => r.order.indexOf(idx) < k && (s.type === 'Personal pickup' || TYPES[s.type].store) && !(j.stops.some(d => d.from === s.id && r.order.indexOf(j.stops.indexOf(d)) < k)));
    html = `<div class="turn"><div class="ar">${icon('turn', 'l')}</div><div style="flex:1;min-width:0"><div class="t3 num">0.3 mi</div><div class="sub ellip" style="opacity:.8">${cur ? 'Toward ' + esc(placeOf(cur).name) : 'Trip complete'}</div></div></div>` + sheet({ id: 'rroute', detents: ['peek', 'medium', 'large'], def: 'medium', tabbar: true,
      head: `<div style="display:flex;justify-content:space-between;align-items:center"><div><div class="fn" style="text-transform:uppercase">Stop ${Math.min(k + 1, n)} of ${n} ${j.tier === 'pro' ? tierBadge('pro') : ''}</div><div class="t2 ellip">${cur ? esc(placeOf(cur).name) : 'All done'}</div></div><button class="iconbtn" aria-label="Chat customer" onclick="toast('Chat with ${esc(j.cust)} (demo)','chat')">${icon('chat')}</button></div>`,
      body: `${cur ? `<div class="group" style="margin-top:12px;background:var(--bg2)">${cell({ ic: TYPES[cur.type].ic, title: esc(cur.type), sub: cur.items.map(x => esc(x.n)).join(', ') || 'No items listed' })}${TYPES[cur.type].pro ? cell({ ic: 'shieldck', icc: 'green', title: 'Scan customer ID at handoff' }) : ''}${cur.white ? cell({ ic: 'heart', icc: 'orange', title: 'White-glove: blanket wrap, two hands, photo before & after' }) : ''}</div>` : ''}
      <div class="group-h">Carrying now</div><div class="group">${carried.length ? carried.map(s => cell({ ic: 'bag', title: esc(s.items.map(x => x.n).join(', ') || placeOf(s).name), sub: 'From ' + esc(placeOf(s).name) + (j.stops.find(d => d.from === s.id) ? ' → ' + esc(placeOf(j.stops.find(d => d.from === s.id)).name) : ' → customer') })).join('') : cell({ title: '<span class="sec">Nothing yet</span>' })}</div>
      <div class="group-h">Route · optimized</div>${routeList(j.stops, r.order, { start: { name: 'Start', addr: 'Great Neck Plaza' }, end: null, done: k, proof: true })}`,
      foot: `<button class="btn" onclick="RN.next()">${cur ? (TYPES[cur.type].store ? 'Upload receipt & complete stop' : 'Photo proof & complete stop') : 'Finish trip'}</button>` });
  }
  if (t === 'earn') {
    map = false;
    html = page('Earnings', `<div class="group"><div class="cell" style="display:block;padding:16px"><div class="fn">This week</div><div class="big-price num">${money(me.week)}</div>
      <div style="display:flex;align-items:end;gap:8px;height:96px;margin-top:12px">${[62, 80, 45, 92, 70, 100, 30].map((h, i) => `<div style="flex:1;text-align:center"><div style="height:${h * .8}px;background:${i === 5 ? 'var(--accent)' : 'var(--fill)'};border-radius:6px"></div><div class="cap">${'MTWTFSS'[i]}</div></div>`).join('')}</div></div></div>
      ${group('Payouts', [cell({ ic: 'calendar', icc: 'green', title: 'Weekly payout · Free', sub: 'Every Monday to your bank, no fee', acc: S.r.cashed ? '—' : money(me.week) }), cell({ ic: 'bolt', title: 'Instant cash-out', sub: S.pay.instantPct + '% (min ' + money(S.pay.instantMin) + '), paid by you · fee ' + money(instantFee(me.week)) + ' · you receive ' + money(me.week - instantFee(me.week)), acc: `<button class="btn sm" ${S.r.cashed ? 'disabled' : ''} onclick="RN.cashout()">${S.r.cashed ? 'Sent' : 'Cash out'}</button>` })], 'Weekly payouts are always free. The instant fee is deducted from your cash-out; customers never pay it. Tips are paid out 100%.')}
      ${group('Breakdown', [cell({ title: 'Trip pay', acc: money(me.week * .78) }), cell({ title: 'Pro pay boost', acc: me.tier === 'pro' ? money(me.week * .12) : '—' }), cell({ title: 'Tips (100%)', acc: money(me.week * .1) })])}
      ${group('Your Pro progress', proProgress(me).map(x => cell({ title: x.k, sub: '<div class="bar" style="margin-top:6px;width:140px"><i style="width:' + x.p * 100 + '%;' + (x.ok ? 'background:var(--green)' : '') + '"></i></div>', acc: `<span class="${x.ok ? 'green' : ''}">${x.v}</span> <span class="cap">${x.need}</span>` })), me.tier === 'pro' ? 'You’re Pro: +' + S.pay.proPayBoost + '% pay on Pro trips (Rx, ID, high-value, white-glove).' : 'Meet every bar to unlock Pro trips with +' + S.pay.proPayBoost + '% pay.')}
      ${meSw}`);
  }
  if (t === 'acct') {
    map = false;
    html = page('Account', `<div class="group">${cell({ left: avatar(me), title: '<b>' + me.name + '</b> ' + tierBadge(me.tier), sub: me.type + ' · ★ ' + me.rating + ' · ' + me.stops.toLocaleString() + ' stops' })}</div>
      ${group('Vehicle & documents', [cell({ ic: 'car', title: me.car }), cell({ ic: 'shieldck', icc: 'green', title: 'Background check', acc: '<span class="badge green">Cleared</span>' }), cell({ ic: 'book', icc: 'gray', title: 'ID & Rx handling course', acc: me.tier === 'pro' ? '<span class="badge green">Done</span>' : '<button class="btn sm" onclick="toast(\'Course started\',\'book\')">Start</button>' })])}
      ${group('Safety', [cell({ ic: 'sos', icc: 'red', title: 'Emergency assistance', chev: 1, tap: "toast('Safety toolkit (demo)','sos')" }), cell({ ic: 'share', icc: 'gray', title: 'Share my trip', chev: 1, tap: "toast('Trip shared','share')" })])}${meSw}`);
  }
  return { html, scene: map ? scene : null, tab: tabbar([['drive', 'Drive', 'car'], ['route', 'Route', 'route'], ['earn', 'Earnings', 'dollar'], ['acct', 'Account', 'person']], S.r.tab, 'RN.tab') };
}

/* ================= OWNER ================= */
const OW = {
  tab(t) { S.o.tab = t; R(); window.scrollTo && $('#desk') && ($('#desk').scrollTop = 0); },
  setPay(k, v) { S.pay[k] = parseFloat(v) || 0; _rc.clear(); R(); },
  setReq(k, v) { S.proReq[k] = k === 'training' ? !!v : parseFloat(v) || 0; R(); },
  promote(id) { runner(id).tier = runner(id).tier === 'pro' ? 'standard' : 'pro'; R(); toast(runner(id).name + ' is now ' + (runner(id).tier === 'pro' ? 'Pro' : 'Standard')); },
  assign(jid) { const j = S.jobs.find(x => x.id === jid), r = RUNNERS.find(x => x.status === 'available' && (j.tier !== 'pro' || x.tier === 'pro')); if (r) { j.runner = r.id; j.status = 'Assigned'; toast(jid + ' → ' + r.name); } R(); },
  resolve(i) { const s = S.o.support.splice(i, 1)[0]; toast(s[2] + ': done'); R(); }
};
const kc = (l, v, d, cls = '') => `<div class="kcard"><div class="fn">${l}</div><div class="k num">${v}</div><div class="d ${cls}">${d}</div></div>`;
function owner() {
  const t = S.o.tab, secs = [['overview', 'Overview', 'chart'], ['jobs', 'Live jobs', 'map'], ['runners', 'Runners', 'users'], ['tiers', 'Tiers', 'seal'], ['pricing', 'Pricing', 'tag'], ['revenue', 'Basket & upsells', 'bag'], ['support', 'Support', 'chat'], ['comp', 'Competition', 'shield']];
  const pro = S.jobs.filter(j => j.tier === 'pro').length, mixPro = 31;
  const sample = quote({ stops: S.stops, tier: 'standard', member: false, speed: 'now' }), sampleP = quote({ stops: S.stops, tier: 'pro', member: false, speed: 'now' });
  let body = '';
  if (t === 'overview') body = `<div class="kgrid">${kc('Gross bookings · today', '$4,812', '▲ 12% vs last Fri', 'green')}${kc('Trips · today', '86', '3.4 stops / trip avg')}${kc('Tier mix', mixPro + '% Pro', 'Pro trips are 44% of revenue')}${kc('Route savings passed on', '$212', '1,240 mi · 11.2 hrs saved today', 'green')}${kc('Avg basket', '$61.30', '▲ $4.80 from on-route upsells', 'green')}${kc('Upsell attach rate', '23%', 'Dismissed 41% · no pre-checks')}${kc('On-time', '96.1%', 'Pro 98.0% · Std 95.4%')}${kc('Runners online', RUNNERS.filter(r => r.status !== 'offline').length + ' / ' + RUNNERS.length, '2 Pro online')}</div>
    <div class="two"><div class="panel"><h3>Tier mix · last 7 days</h3><div class="mix"><i style="width:${mixPro}%;background:var(--accent)"></i><i style="width:${100 - mixPro}%;background:var(--fill)"></i></div><div class="frow"><span>${tierBadge('pro')}</span><span class="num">${mixPro}% trips · $27.10 avg fee</span></div><div class="frow"><span>${tierBadge('standard')}</span><span class="num">${100 - mixPro}% trips · $14.60 avg fee</span></div></div>
    <div class="panel"><h3>Route optimization</h3><div class="frow"><span>Trips re-ordered</span><span class="num">62%</span></div><div class="frow"><span>Avg saving per re-ordered trip</span><span class="num">$1.18 · 2.6 min</span></div><div class="frow"><span>Exact solves (≤ 12 stops)</span><span class="num">99.4%</span></div><div class="frow"><span>Precedence-constrained trips</span><span class="num">18%</span></div></div></div>`;
  if (t === 'jobs') body = `<div class="panel" style="margin-top:0"><h3>Live jobs</h3>${S.jobs.map(j => `<div class="frow"><span><b>${j.id}</b> ${tierBadge(j.tier)} ${esc(j.cust)} · ${j.stops} stops</span><span class="sec">${j.runner ? runner(j.runner).name : '<span style="color:var(--red)">Unassigned</span>'} · ${j.status}</span><span class="num">${money(j.price)}</span>${j.runner ? '' : `<button class="btn sm" onclick="OW.assign('${j.id}')">Assign</button>`}</div>`).join('')}</div><div class="panel"><h3>Map</h3><div style="height:320px;border-radius:12px;overflow:hidden">${Maps.staticSvg(sceneFor(S.stops))}</div></div>`;
  if (t === 'runners') body = `<div class="panel" style="margin-top:0"><h3>Runners</h3>${RUNNERS.map(r => `<div class="frow">${avatar(r, 's')}<span style="flex:1"><b>${r.name}</b> ${tierBadge(r.tier)}<br><span class="fn">${r.type} · ★ ${r.rating} · ${r.stops} stops · ${r.ontime}% on-time · ${r.status}</span></span><span class="num">${money(r.week)}/wk</span><button class="btn sm gray" onclick="OW.promote('${r.id}')">${r.tier === 'pro' ? 'Move to Standard' : 'Promote to Pro'}</button></div>`).join('')}</div>`;
  if (t === 'tiers') body = `<div class="two"><div class="panel" style="margin-top:0"><h3>${tierBadge('pro')} Pro requirements</h3>
    <div class="frow"><span>Min rating</span><input class="input" type="number" step="0.01" value="${S.proReq.rating}" onchange="OW.setReq('rating',this.value)"></div><div class="frow"><span>Min completed stops</span><input class="input" type="number" value="${S.proReq.stops}" onchange="OW.setReq('stops',this.value)"></div><div class="frow"><span>Min on-time %</span><input class="input" type="number" value="${S.proReq.ontime}" onchange="OW.setReq('ontime',this.value)"></div><div class="frow"><span>ID & Rx course required</span><button class="toggle ${S.proReq.training ? 'on' : ''}" role="switch" aria-checked="${S.proReq.training}" aria-label="Course required" onclick="OW.setReq('training',${!S.proReq.training})"></button></div>
    <div class="group-f">Pro handles prescriptions & ID checks, items over ${money(HIGH_VALUE)}, and white-glove care.</div></div>
    <div class="panel" style="margin-top:0"><h3>Pro pipeline</h3>${RUNNERS.filter(r => r.tier !== 'pro').map(r => { const pp = proProgress(r), ok = pp.filter(x => x.ok).length; return `<div class="frow"><span>${r.name}</span><div class="bar" style="width:120px"><i style="width:${ok / pp.length * 100}%"></i></div><span class="num fn">${ok}/${pp.length}</span></div>`; }).join('')}</div></div>
    <div class="panel"><h3>Tier pricing</h3><div class="frow"><span>Pro fee multiplier</span><input class="input" type="number" step="0.05" value="${S.pay.proMult}" onchange="OW.setPay('proMult',this.value)"></div><div class="frow"><span>Pro flat add-on ($)</span><input class="input" type="number" step="0.5" value="${S.pay.proFlat}" onchange="OW.setPay('proFlat',this.value)"></div><div class="frow"><span>Pro runner pay boost (%)</span><input class="input" type="number" value="${S.pay.proPayBoost}" onchange="OW.setPay('proPayBoost',this.value)"></div>
    <div class="frow"><span>Sample trip (${S.stops.length} stops)</span><span class="num">${tierBadge('standard')} ${money(sample.f.service)} · ${tierBadge('pro')} ${money(sampleP.f.service)}</span></div></div>`;
  if (t === 'pricing') { const pf = [['base', 'Base fee ($)'], ['perStop', 'Per stop ($)'], ['perMile', 'Per mile ($)'], ['perMin', 'Per drive minute ($)'], ['servicePct', 'Platform fee (%)'], ['memberDisc', BRAND.plus + ' discount (%)'], ['runnerShare', 'Runner share (%)'], ['capPad', 'Spending-cap buffer (%) · matches payment hold'], ['instantPct', 'Runner instant cash-out fee (%)'], ['instantMin', 'Instant cash-out minimum fee ($)'], ['freeEvery', 'Free stop every Nth'], ['rushMult', 'Rush multiplier'], ['proMult', 'Pro multiplier'], ['proFlat', 'Pro flat ($)']];
    body = `<div class="two"><div class="panel" style="margin-top:0"><h3>Fee schedule</h3>${pf.map(([k, l]) => `<div class="frow"><span>${l}</span><input class="input" type="number" step="0.05" value="${S.pay[k]}" onchange="OW.setPay('${k}',this.value)"></div>`).join('')}</div>
    <div class="panel" style="margin-top:0"><h3>Live preview · current cart</h3><div class="frow"><span>Standard · Now</span><span class="num">${money(sample.f.service)}</span></div><div class="frow"><span>Standard · Rush</span><span class="num">${money(quote({ stops: S.stops, tier: 'standard', speed: 'rush', member: false }).f.service)}</span></div><div class="frow"><span>Pro · Now</span><span class="num">${money(sampleP.f.service)}</span></div><div class="frow"><span>Member · Standard</span><span class="num">${money(quote({ stops: S.stops, tier: 'standard', member: true }).f.service)}</span></div><div class="frow"><span>Runner earns (Std)</span><span class="num">${money(sample.f.fee * S.pay.runnerShare / 100)}</span></div><div class="frow"><span>Route saving vs entered</span><span class="num green">${money(sample.save.usd)} · ${sample.save.min.toFixed(1)} min</span></div></div></div>`; }
  if (t === 'revenue') body = `<div class="kgrid">${kc('Avg basket', '$61.30', '+$4.80 vs. before upsells', 'green')}${kc('Stops / trip', '3.4', '▲ 0.6 from on-route adds', 'green')}${kc('On-route add rate', '17%', 'Avg +$2.10 fee')}${kc('Bundle redemptions', '142', 'Fall closet refresh, ends ' + fmtEnd(BUNDLES[0].ends))}${kc('Favorite reorders', '28%', 'of trips this week')}${kc('Free-stop unlocks', '9%', 'Customers adding a 5th stop')}</div>
    <div class="panel"><h3>Upsell guardrails</h3><div class="frow"><span>Pre-checked add-ons</span><span class="green">None (enforced)</span></div><div class="frow"><span>Dismiss on every suggestion</span><span class="green">Yes</span></div><div class="frow"><span>Bundles with real end dates</span><span class="green">Yes · expired hidden</span></div><div class="frow"><span>Default tip</span><span class="green">None</span></div><div class="frow"><span>Upsell dismissal rate</span><span>41%</span></div></div>`;
  if (t === 'support') body = `<div class="panel" style="margin-top:0"><h3>Queue</h3>${S.o.support.map((s, i) => `<div class="frow"><span><span class="dot" style="background:var(--${s[0]})"></span> ${esc(s[1])}</span><button class="btn sm" onclick="OW.resolve(${i})">${s[2]}</button></div>`).join('') || '<div class="sec">All clear 🎉</div>'}</div>`;
  if (t === 'comp') body = `<div class="panel" style="margin-top:0"><h3>Positioning</h3>${[['Multi-stop, one price', 'Yes', 'Single store'], ['Personal pickups & drop-offs', 'Yes, with precedence', 'No'], ['Route-optimized price', 'Savings shown', 'No'], ['Pro tier for Rx / high-value', 'Yes', 'Partial'], ['Favorite runners', 'Yes', 'No']].map(r => `<div class="frow"><span>${r[0]}</span><span class="green">${r[1]}</span><span class="sec">Others: ${r[2]}</span></div>`).join('')}</div>`;
  const title = secs.find(s => s[0] === t)[1];
  return `<div class="owner"><aside class="side"><div class="t3" style="padding:4px 10px 12px">${BRAND.name} <span class="fn">Ops</span></div>${secs.map(([k, l, ic]) => `<button class="sb ${k === t ? 'on' : ''}" onclick="OW.tab('${k}')">${icon(ic)}${l}</button>`).join('')}</aside>
  <main class="omain"><div class="mobile-owner-tabs">${seg(secs.map(s => [s[0], s[1].split(' ')[0]]), t, 'OW.tab')}</div><h1 class="t1" style="margin:8px 0 16px">${title}</h1>${body}<p class="demo-note" style="margin-top:24px">Demo data. KPIs illustrative; prices computed live by the same engine customers see.</p></main></div>`;
}

/* ================= SHELL ================= */
function R() {
  const dev = $('#device'), desk = $('#desk');
  document.body.dataset.view = S.view;
  if (S.view === 'o') { dev.parentElement.style.display = 'none'; desk.style.display = 'block'; desk.innerHTML = owner(); return; }
  dev.parentElement.style.display = ''; desk.style.display = 'none';
  const scrolls = {}; $$('#screen [data-scroll]').forEach(e => scrolls[e.dataset.scroll] = e.scrollTop);
  const out = S.view === 'c' ? customer() : runnerView();
  const key = S.view + (S.view === 'c' ? S.c.screen : S.r.tab);
  const scr = $('#screen'); scr.innerHTML = out.html + (out.tab || '');
  if (key !== lastScreenKey) { scr.classList.remove('fade'); void scr.offsetWidth; scr.classList.add('fade'); lastScreenKey = key; }
  else $$('#screen [data-scroll]').forEach(e => { if (scrolls[e.dataset.scroll] != null) e.scrollTop = scrolls[e.dataset.scroll]; });
  $('#map').style.visibility = out.scene ? 'visible' : 'hidden';
  if (out.scene) Maps.render($('#map'), out.scene);
  layoutSheets(); bindCollapse(); mountAdd(); dev.dataset.dark = '';
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
function setAccent(k) {
  const a = ACCENTS.find(x => x.id === k) || ACCENTS[0]; k = a.id; S.accent = k; const r = document.documentElement.style;
  r.setProperty('--accent', a.hex); r.setProperty('--on-accent', a.on || '#fff');
  $$('.pop .acc').forEach(b => b.classList.toggle('cur', b.dataset.acc === k));
  try { localStorage.setItem('errand.accent', k); } catch (e) { }
  if (S.view !== 'o') { lastScreenKey += '_'; Maps.render($('#map'), (S.view === 'c' ? customer() : runnerView()).scene || homeScene(), true); }
}
function setView(v) { S.view = v; $$('[data-v]').forEach(b => { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-selected', b.dataset.v === v); }); $('#pop').classList.remove('open'); R(); fit(); }
function fit() {
  const st = $('#stage'), d = $('#device'); if (!st || !d) return;
  const mobile = window.innerWidth <= 600;
  if (mobile) { d.style.transform = ''; d.style.setProperty('--fit', 1); return; }
  const s = Math.min(1, (window.innerHeight - 80) / 868, (window.innerWidth - 32) / 414);
  d.style.transform = 'scale(' + s + ')'; d.style.setProperty('--fit', s);
}
function clock() { const e = $('#sbtime'); if (e) e.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(/\s?[AP]M/, ''); }
function boot() {
  let acc = 'violet'; try { acc = localStorage.getItem('errand.accent') || 'violet'; } catch (e) { }
  $('#brand').textContent = BRAND.name;
  $('#pop').innerHTML = `<div class="viewseg">${seg([['c', 'Customer'], ['r', 'Runner'], ['o', 'Owner']], S.view, 'setView')}</div><h6>Accent</h6>${ACCENTS.map(a => [a.id, a]).map(([k, a]) => `<button class="acc" data-acc="${k}" onclick="setAccent('${k}')"><span class="dot" style="background:${a.hex}"></span>${a.name}<span class="ck">${icon('check', 's')}</span></button>`).join('')}<h6 style="margin-top:8px">Map</h6><div class="fn" style="margin:0 16px 10px">${Maps.mode === 'fallback' ? 'Built-in map (no Google key set)' : 'Google Maps'}</div>`;
  $('#more').onclick = e => { e.stopPropagation(); $('#pop').classList.toggle('open'); };
  document.addEventListener('click', e => { if (!e.target.closest('#pop')) $('#pop').classList.remove('open'); });
  const h = location.hash.slice(1); if (h === 'runner') S.view = 'r'; if (h === 'owner') S.view = 'o'; if (h === 'track') { }
  setAccent(acc); setView(S.view); clock(); setInterval(clock, 15000);
  window.addEventListener('resize', () => { fit(); if (S.view !== 'o') layoutSheets(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.addEventListener('DOMContentLoaded', boot);
