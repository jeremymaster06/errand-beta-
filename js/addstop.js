/* Add-a-stop flow: place search (autocomplete) -> store item browser (stores) or stop details (addresses).
 * Security: every user- or API-provided string is inserted with textContent / DOM APIs, never as HTML.
 * Only icon() SVG strings (static, from icons.js) are set via innerHTML. */
'use strict';
const KIND_TYPE = { grocery: 'Groceries', pharmacy: 'Pharmacy', cleaners: 'Dry cleaning', post: 'Post office', shipping: 'Returns', hardware: 'Shopping', pet: 'Shopping', bakery: 'Shopping', office: 'Shopping', library: 'Returns', donation: 'Drop-off' };
const KIND_IC = { grocery: 'cart', pharmacy: 'pill', hardware: 'wrench', pet: 'paw', bakery: 'bread', cleaners: 'hanger', post: 'envelope', shipping: 'box', office: 'book', library: 'book', donation: 'gift', address: 'pin', saved: 'star' };

/* tiny DOM builder: h('div', {class, text, on:{click}, ...attrs}, ...children). Strings children become text nodes. */
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  for (const k in a || {}) { const v = a[k]; if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v; else if (k === 'ic') e.innerHTML = icon(v[0], v[1] || ''); else if (k === 'on') for (const ev in v) e.addEventListener(ev, v[ev]);
    else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v); }
  kids.flat().forEach(c => c != null && c !== false && e.append(c instanceof Node ? c : String(c)));
  return e;
}
const ic = (name, cls) => h('span', { class: 'ico', 'aria-hidden': 'true', ic: [name, cls] });
/* text with matched ranges in bold, built as nodes */
function hlText(t, rs) {
  const f = document.createDocumentFragment(); let i = 0;
  (rs || []).slice().sort((a, b) => a[0] - b[0]).forEach(([s, e]) => { if (s < i) return; if (s > i) f.append(t.slice(i, s)); f.append(h('b', { text: t.slice(s, e) })); i = e; });
  if (i < t.length) f.append(t.slice(i)); return f;
}
const miles = d => d == null ? '' : d < 0.1 ? '<0.1 mi' : d.toFixed(1) + ' mi';
const savedPlaces = () => Object.entries(PLACES).filter(([, p]) => p.type === 'Personal').map(([k, p]) => ({ id: k, name: p.name, addr: p.addr, city: 'Great Neck, NY', lat: p.lat, lng: p.lng, kind: 'saved' }));
function storeKindOf(s) { const p = s.custom || {}; if (Places.STORE_KINDS.includes(p.kind)) return p.kind; const L = Places.LOCAL.find(x => x.id === s.pid); return L && Places.STORE_KINDS.includes(L.kind) ? L.kind : null; }
function placeFromStop(s) { const p = placeOf(s); return { id: s.pid || s.id, name: p.name, addr: p.addr, lat: p.lat, lng: p.lng, kind: storeKindOf(s), store: true }; }
function setStopPlace(s, pl) {
  s.custom = { name: pl.name, addr: pl.addr, lat: pl.lat, lng: pl.lng, kind: pl.kind }; s.pid = pl.id;
  if (pl.store) s.type = KIND_TYPE[pl.kind] || 'Shopping'; else if (TYPES[s.type].store) s.type = 'Personal pickup';
}

/* screen shells: static markup only; content is mounted with DOM APIs in mountAdd() */
function addScreens(sc) {
  const nav = (title, back) => `<div class="navbar solid"><div class="nl"><button class="backbtn" id="navBack">${icon('chevL')}${back}</button></div><div class="nt" id="navT">${title}</div></div>`;
  if (sc === 'add') return `<div class="page notab addpg" data-scroll="pg-add">${nav('Add a stop', 'Back')}
    <div class="acwrap"><label class="acfield">${icon('search', 's')}<input id="acq" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="words" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="acList" aria-label="Search a store or address" placeholder="Search a store or address"><button id="acClear" class="clr" aria-label="Clear search">${icon('x', 's')}</button></label></div>
    <div id="acList" class="aclist" role="listbox" aria-label="Suggestions"></div></div>`;
  if (sc === 'place') return `<div class="page notab" data-scroll="pg-place">${nav('Stop details', 'Search')}<div class="page-body" id="plBody"></div></div>`;
  return `<div class="page notab storepg" data-scroll="pg-store" id="stPage">${nav('', 'Back')}<div id="stHead" class="sthead"></div>
    <div class="ststicky"><label class="acfield">${icon('search', 's')}<input id="stq" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" aria-label="Search this store"><button id="stClear" class="clr" aria-label="Clear search">${icon('x', 's')}</button></label><div class="sttabs" id="stTabs" role="tablist" aria-label="Categories"></div></div>
    <div id="stList"></div><div id="stCustom" class="page-body"></div></div><div id="cartBar"></div><div id="cartSheet"></div>`;
}
function mountAdd() {
  const sc = S.c.screen; if (S.view !== 'c' || !['add', 'place', 'store'].includes(sc)) return;
  if (sc === 'add') AS.mount(); else if (sc === 'place') PL.mount(); else ST.mount();
}

/* ---------- Search (autocomplete) ---------- */
let acTimer = 0, acSeq = 0;
const AS = {
  open(o = {}) { S.c.add = { q: '', res: [], sel: -1, loading: false, replace: o.replace || null, back: S.c.screen === 'store' || S.c.screen === 'place' ? 'stops' : S.c.screen }; S.c.screen = 'add'; Maps.ensure(); R(); },
  mount() {
    const A = S.c.add, i = $('#acq');
    $('#navBack').onclick = () => C.go(A.back || 'home');
    i.value = A.q; i.oninput = () => AS.input(i.value); i.onkeydown = AS.key;
    $('#acClear').onclick = e => { e.preventDefault(); i.value = ''; AS.input(''); i.focus(); };
    AS.paint(); requestAnimationFrame(() => i.focus({ preventScroll: true }));
  },
  input(v) {
    const A = S.c.add; A.q = v; A.sel = -1; clearTimeout(acTimer); const my = ++acSeq;
    if (v.trim().length < Places.MIN) { A.res = []; A.loading = false; AS.paint(); return; }
    A.loading = true; AS.paint();
    acTimer = setTimeout(async () => { const res = await Places.suggest(v, savedPlaces()); if (my !== acSeq) return; A.res = res; A.loading = false; AS.paint(); }, 300);
  },
  rows() { const A = S.c.add; return A.q.trim().length >= Places.MIN && !A.loading ? A.res.length + 1 : 0; },
  key(e) {
    const A = S.c.add, n = AS.rows();
    if (e.key === 'ArrowDown' && n) { A.sel = (A.sel + 1) % n; AS.paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && n) { A.sel = (A.sel - 1 + n) % n; AS.paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && n) { e.preventDefault(); AS.pick(A.sel >= 0 ? A.sel : 0); }
    else if (e.key === 'Escape') { e.target.value = ''; AS.input(''); }
  },
  paint() {
    const A = S.c.add, el = $('#acList'), i = $('#acq'); if (!el) return;
    const q = A.q.trim(), n = AS.rows(); el.replaceChildren();
    $('#acClear').style.visibility = A.q ? 'visible' : 'hidden';
    i.setAttribute('aria-expanded', n > 0); i.setAttribute('aria-activedescendant', A.sel >= 0 ? 'ac' + A.sel : '');
    if (q.length < Places.MIN) {
      el.append(h('div', { class: 'acempty' }, ic('search', 'l'), h('div', { class: 'hl', text: 'Where should your runner stop?' }),
        h('div', { class: 'fn', text: q ? 'Keep typing… suggestions appear after ' + Places.MIN + ' letters.' : 'Type any store, business, or street address.' })));
      return;
    }
    if (A.loading) { el.append(h('div', { class: 'acempty compact' }, h('div', { class: 'indet' }), h('div', { class: 'fn', text: 'Searching near Great Neck…' }))); return; }
    const box = h('div', { class: 'group' });
    if (!A.res.length) box.append(h('div', { class: 'acnone fn', text: 'No places found nearby for “' + q + '”.' }));
    A.res.forEach((r, k) => box.append(h('div', { class: 'cell tap ac' + (k === A.sel ? ' sel' : ''), id: 'ac' + k, role: 'option', 'aria-selected': k === A.sel, on: { click: () => AS.pick(k) } },
      h('div', { class: 'acic' + (Places.STORE_KINDS.includes(r.kind) ? ' store' : '') }, ic(KIND_IC[r.kind] || 'pin')),
      h('div', { class: 'grow' }, h('div', { class: 'acp ellip' }, hlText(r.primary, r.pm)), h('div', { class: 'acs ellip' }, hlText(r.secondary, r.sm))),
      r.dist != null ? h('div', { class: 'cap num', text: miles(r.dist) }) : null)));
    const k = A.res.length;
    box.append(h('div', { class: 'cell tap ac' + (k === A.sel ? ' sel' : ''), id: 'ac' + k, role: 'option', 'aria-selected': k === A.sel, on: { click: () => AS.pick(k) } },
      h('div', { class: 'acic' }, ic('pin')), h('div', { class: 'grow' }, h('div', { class: 'acp ellip' }, 'Use “', h('b', { text: q }), '”'), h('div', { class: 'acs', text: 'Use this exact address' }))));
    el.append(box);
    el.append(h('div', { class: 'acattr' + (Places.mode === 'google' ? ' g' : ''), text: Places.mode === 'google' ? 'powered by Google' : 'Demo search: Great Neck sample places. Add a Maps key for live Google results.' }));
    const s = A.sel >= 0 && $('#ac' + A.sel); if (s) s.scrollIntoView({ block: 'nearest' });
  },
  async pick(k) {
    const A = S.c.add; if (A.busy) return; A.busy = true;
    try { const pl = k < A.res.length ? await Places.resolve(A.res[k]) : await Places.freeText(A.q.trim()); AS.chosen(pl); } finally { A.busy = false; }
  },
  chosen(pl) {
    const A = S.c.add; haptic();
    if (A.replace) { const s = S.stops.find(x => x.id === A.replace); if (s) { setStopPlace(s, pl); S.cap = null; } S.c.screen = 'stops'; R(); toast('Location updated'); if (s && pl.store && !s.items.length) ST.edit(s.id); return; }
    if (pl.store) { ST.open(pl); return; }
    S.c.place = { pl, type: 'Personal pickup', what: '', note: '', from: '' }; S.c.screen = 'place'; R();
  }
};

/* ---------- Personal (non-store) stop details ---------- */
const PL = {
  mount() {
    const P = S.c.place, b = $('#plBody'); $('#navBack').onclick = () => { S.c.screen = 'add'; R(); };
    const types = [['Personal pickup', 'Pick up'], ['Drop-off', 'Drop off'], ['Custom task', 'Other task']];
    const what = h('input', { class: 'input', id: 'plWhat', 'aria-label': 'What is it?', placeholder: P.type === 'Drop-off' ? 'What are we dropping off?' : P.type === 'Custom task' ? 'Describe the task' : 'What are we picking up?', maxlength: 120 });
    what.value = P.what; what.oninput = () => P.what = what.value;
    const note = h('input', { class: 'input', id: 'plNote', 'aria-label': 'Note for runner', placeholder: 'Note for runner (gate code, who to ask…)', maxlength: 200 });
    note.value = P.note; note.oninput = () => P.note = note.value;
    const pickups = S.stops.filter(x => x.type === 'Personal pickup' || TYPES[x.type].store);
    let link = null;
    if (P.type !== 'Personal pickup' && pickups.length) { link = h('select', { class: 'input', 'aria-label': 'Deliver an item picked up at', on: { change: e => P.from = e.target.value } }, h('option', { value: '', text: 'Nothing linked' }), pickups.map(x => { const o = h('option', { value: x.id, text: placeOf(x).name }); if (x.id === P.from) o.selected = true; return o; })); }
    b.replaceChildren(
      h('div', { class: 'plhead' }, h('div', { class: 'acic' }, ic(KIND_IC[P.pl.kind] || 'pin')), h('div', { class: 'grow' }, h('div', { class: 't2 ellip', text: P.pl.name }), h('div', { class: 'fn ellip', text: P.pl.addr }))),
      P.pl.approx ? h('div', { class: 'group-f', text: 'We couldn’t verify this address. Your runner will confirm it with you in chat.' }) : '',
      h('div', { class: 'group-h', text: 'What happens here' }),
      h('div', { class: 'seg', role: 'tablist' }, types.map(([v, l]) => h('button', { role: 'tab', class: P.type === v ? 'on' : '', 'aria-selected': P.type === v, text: l, on: { click: () => { P.type = v; R(); } } }))),
      h('div', { class: 'group-h', text: 'Details' }), h('div', { class: 'stack' }, what, link ? h('label', { class: 'fn', text: 'Deliver an item picked up at' }) : '', link || '', note),
      h('button', { class: 'btn', style: 'margin-top:24px', text: 'Add stop', on: { click: PL.add } }));
  },
  add() {
    const P = S.c.place, pl = P.pl;
    const s = mkStop(P.type, pl.id, { custom: { name: pl.name, addr: pl.addr, lat: pl.lat, lng: pl.lng, kind: pl.kind }, items: P.what.trim() ? [{ n: P.what.trim(), p: 0 }] : [], note: P.note.trim(), from: P.from || null });
    S.stops.push(s); S.c.screen = 'stops'; haptic(); R(); toast('Added ' + pl.name);
  }
};

/* ---------- Store item browser (DoorDash-style) ---------- */
const ST = {
  async open(pl, stopId) {
    const st = await Catalog.getStore(pl); const [cats, items] = await Promise.all([Catalog.getCategories(st.id), Catalog.getItems(st.id)]);
    const cart = {}, custom = []; const s = stopId && S.stops.find(x => x.id === stopId);
    if (s) s.items.forEach(x => { if (x.id && items.some(i => i.id === x.id)) cart[x.id] = x.q || 1; else custom.push({ n: x.n, p: +x.p || 0 }); });
    S.c.store = { pl, st, cats, items, cart, custom, q: '', res: null, stopId: stopId || null, cartOpen: false, cat: cats[0] && cats[0].id, back: stopId ? 'stops' : 'add' };
    S.c.screen = 'store'; R();
  },
  edit(id) { const s = S.stops.find(x => x.id === id); ST.open(placeFromStop(s), id); },
  qty: id => S.c.store.cart[id] || 0,
  lines() { const T = S.c.store; return T.items.filter(i => T.cart[i.id]).map(i => ({ id: i.id, n: i.name, unit: i.unit, price: i.price, q: T.cart[i.id], rx: i.rx })).concat(T.custom.map((c, j) => ({ cj: j, n: c.n, unit: 'Not listed · runner finds it', price: c.p, q: 1 }))); },
  sum() { const L = ST.lines(); return { n: L.reduce((a, x) => a + x.q, 0), sub: L.reduce((a, x) => a + x.price * x.q, 0) }; },
  toItems() { return ST.lines().map(x => x.id ? { id: x.id, n: x.n + (x.q > 1 ? ' ×' + x.q : ''), p: Math.round(x.price * x.q * 100) / 100, q: x.q, rx: x.rx || undefined } : { n: x.n, p: x.price }); },
  draftStop() { const T = S.c.store, pl = T.pl; return mkStop(KIND_TYPE[T.st.kind] || 'Shopping', pl.id, { id: T.stopId || 'draft', custom: { name: pl.name, addr: pl.addr, lat: pl.lat, lng: pl.lng, kind: T.st.kind }, items: ST.toItems() }); },
  tripQuote() { const T = S.c.store, d = ST.draftStop(); const stops = T.stopId ? S.stops.map(x => x.id === T.stopId ? Object.assign({}, x, { items: d.items }) : x) : S.stops.concat(d); return quote({ stops }); },
  set(id, q) { S.c.store.cart[id] = Math.max(0, Math.min(99, q)); if (!S.c.store.cart[id]) delete S.c.store.cart[id]; haptic(); ST.paintList(); ST.paintCart(); },
  mount() {
    const T = S.c.store, st = T.st, pg = $('#stPage');
    $('#navBack').onclick = () => { if (T.back === 'add' && S.c.add) { S.c.screen = 'add'; R(); } else C.go('stops'); };
    $('#navT').textContent = st.name;
    $('#stHead').replaceChildren(h('div', { class: 'stlogo' }, ic(KIND_IC[st.kind] || 'bag', 'l')),
      h('div', { class: 'grow' }, h('h1', { class: 't1 sttitle', text: st.name }), h('div', { class: 'fn ellip', text: st.kindName + ' · ' + st.addr }),
        h('div', { class: 'chips stmeta' }, h('span', { class: 'badge', text: 'Shelf prices (est.)' }), h('span', { class: 'badge', text: 'Receipt photo at checkout' }))),
      st.note ? h('div', { class: 'stnote cap', text: st.note }) : '');
    const q = $('#stq'); q.placeholder = 'Search ' + st.name; q.value = T.q;
    q.oninput = () => { T.q = q.value; clearTimeout(ST._t); ST._t = setTimeout(ST.search, 150); };
    q.onkeydown = e => { if (e.key === 'Escape') { q.value = ''; T.q = ''; ST.search(); } };
    $('#stClear').onclick = e => { e.preventDefault(); q.value = ''; T.q = ''; ST.search(); q.focus(); };
    $('#stTabs').replaceChildren(...T.cats.map(c => h('button', { role: 'tab', class: 'chip' + (c.id === T.cat ? ' on' : ''), 'data-cat': c.id, 'aria-selected': c.id === T.cat, text: c.name, on: { click: () => ST.jump(c.id) } })));
    ST.paintCustom(); ST.search(true); ST.paintCart();
    pg.addEventListener('scroll', ST.spy, { passive: true });
  },
  async search(keep) {
    const T = S.c.store, q = T.q.trim();
    T.res = q ? await Catalog.searchItems(T.st.id, q) : null;
    $('#stClear').style.visibility = T.q ? 'visible' : 'hidden';
    $('#stTabs').hidden = !!q; ST.paintList(); if (!keep && q) $('#stPage').scrollTop = Math.min($('#stPage').scrollTop, $('#stHead').offsetHeight);
  },
  row(i) {
    const n = ST.qty(i.id), price = i.price ? money(i.price) : 'No charge';
    const ctl = !i.inStock ? h('span', { class: 'cap', text: 'Out of stock' })
      : n ? h('div', { class: 'qty', role: 'group', 'aria-label': 'Quantity of ' + i.name }, h('button', { 'aria-label': 'Remove one ' + i.name, ic: [n > 1 ? 'minus' : 'x', 's'], on: { click: e => { e.stopPropagation(); ST.set(i.id, n - 1); } } }), h('span', { class: 'num', text: n }), h('button', { 'aria-label': 'Add one more ' + i.name, ic: ['plus', 's'], on: { click: e => { e.stopPropagation(); ST.set(i.id, n + 1); } } }))
        : h('button', { class: 'addbtn', 'aria-label': 'Add ' + i.name, ic: ['plus', 's'], on: { click: e => { e.stopPropagation(); ST.set(i.id, 1); } } });
    return h('div', { class: 'irow' + (i.inStock ? '' : ' oos') + (n ? ' inc' : ''), 'data-item': i.id, on: { click: () => i.inStock && !n && ST.set(i.id, 1) } },
      h('div', { class: 'ithumb' }, i.image ? h('img', { src: i.image, alt: '', loading: 'lazy' }) : ic(i.icon)),
      h('div', { class: 'grow' }, h('div', { class: 'iname', text: i.name }), h('div', { class: 'cap', text: i.unit }), h('div', { class: 'iprice num', text: price })), ctl);
  },
  paintList() {
    const T = S.c.store, el = $('#stList'); if (!el) return; el.replaceChildren();
    if (T.res) {
      el.append(h('div', { class: 'group-h', text: T.res.length ? T.res.length + ' result' + (T.res.length > 1 ? 's' : '') + ' in ' + T.st.name : 'No results' }));
      if (T.res.length) el.append(h('div', { class: 'group ilist' }, T.res.map(ST.row)));
      else el.append(h('div', { class: 'acempty compact' }, h('div', { class: 'fn', text: 'Nothing called “' + T.q.trim() + '” on this menu. Add it below and your runner will find it.' })));
      return;
    }
    T.cats.forEach(c => el.append(h('section', { id: 'cat_' + c.id, class: 'stsec' }, h('h2', { class: 'group-h', text: c.name }), h('div', { class: 'group ilist' }, T.items.filter(i => i.category === c.id).map(ST.row)))));
  },
  paintCustom() {
    const T = S.c.store, n = h('input', { class: 'input', id: 'cuN', placeholder: T.q ? T.q : 'Item name', 'aria-label': 'Item not listed', maxlength: 80 }),
      p = h('input', { class: 'input', id: 'cuP', style: 'width:96px', inputmode: 'decimal', placeholder: '$ est.', 'aria-label': 'Estimated price' });
    const add = () => { const v = n.value.trim() || T.q.trim(); if (!v) { n.focus(); return; } T.custom.push({ n: v, p: Math.max(0, Math.min(5000, parseFloat(p.value) || 0)) }); n.value = ''; p.value = ''; haptic(); ST.paintCart(); toast('Added ' + v); };
    n.onkeydown = e => { if (e.key === 'Enter') add(); };
    $('#stCustom').replaceChildren(h('div', { class: 'group-h', text: 'Can’t find it?' }), h('div', { class: 'row8' }, n, p, h('button', { class: 'btn sm', 'aria-label': 'Add item not listed', ic: ['plus', 's'], on: { click: add } })),
      h('div', { class: 'group-f', text: 'Add anything this store sells. Your runner buys it at shelf price and texts a photo if it’s different.' }));
  },
  paintCart() {
    const T = S.c.store, bar = $('#cartBar'), { n, sub } = ST.sum(); if (!bar) return;
    bar.replaceChildren(); bar.className = n || T.stopId ? 'cartbar show' : 'cartbar';
    if (n || T.stopId) bar.append(h('button', { class: 'btn', id: 'viewCart', on: { click: ST.openCart } }, h('span', { class: 'cnt num', text: n }), h('span', { text: 'View cart' }), h('span', { class: 'num', text: money(sub) })));
    if (T.cartOpen) ST.paintSheet(); else $('#cartSheet').replaceChildren();
  },
  openCart() { S.c.store.cartOpen = true; ST.paintCart(); const c = $('#cartSheet .csheet'); if (c) c.focus(); },
  closeCart() { S.c.store.cartOpen = false; ST.paintCart(); },
  paintSheet() {
    const T = S.c.store, L = ST.lines(), { n, sub } = ST.sum(), q = ST.tripQuote(), capThis = sub * (1 + S.pay.capPad / 100);
    const line = (l, v, cls) => h('div', { class: 'cline' + (cls ? ' ' + cls : '') }, h('span', { text: l }), h('span', { class: 'num', text: v }));
    const rows = L.map(x => h('div', { class: 'irow' }, h('div', { class: 'grow' }, h('div', { class: 'iname', text: x.n }), h('div', { class: 'cap', text: x.unit + (x.price ? ' · ' + money(x.price) + ' each' : '') })),
      h('div', { class: 'iprice num', text: money(x.price * x.q) }),
      x.id ? h('div', { class: 'qty' }, h('button', { 'aria-label': 'Remove one ' + x.n, ic: [x.q > 1 ? 'minus' : 'x', 's'], on: { click: () => ST.set(x.id, x.q - 1) } }), h('span', { class: 'num', text: x.q }), h('button', { 'aria-label': 'Add one more ' + x.n, ic: ['plus', 's'], on: { click: () => ST.set(x.id, x.q + 1) } }))
        : h('button', { class: 'iconbtn', 'aria-label': 'Remove ' + x.n, ic: ['x', 's'], on: { click: () => { T.custom.splice(x.cj, 1); ST.paintCart(); } } })));
    const sheetEl = h('div', { class: 'csheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cart for ' + T.st.name, tabindex: '-1', on: { keydown: e => e.key === 'Escape' && ST.closeCart() } },
      h('div', { class: 'grabber' }, h('i')),
      h('div', { class: 'chead' }, h('div', { class: 'grow' }, h('div', { class: 't2', text: 'Your cart' }), h('div', { class: 'fn ellip', text: T.st.name + ' · ' + n + ' item' + (n === 1 ? '' : 's') })), h('button', { class: 'iconbtn', 'aria-label': 'Close cart', ic: ['x', 's'], on: { click: ST.closeCart } })),
      h('div', { class: 'cbody' }, L.length ? h('div', { class: 'group ilist' }, rows) : h('div', { class: 'acempty compact' }, h('div', { class: 'fn', text: 'Your cart is empty. Add items, or keep this stop with no purchases.' })),
        h('div', { class: 'group-h', text: 'This stop' }), h('div', { class: 'group cgroup' }, line('Items at shelf price (est.)', money(sub)), line('+ ' + S.pay.capPad + '% buffer for price changes', money(capThis - sub)), line('Adds to your spending cap', money(capThis), 'b')),
        h('div', { class: 'group-h', text: 'Your trip · one upfront price' }), h('div', { class: 'group cgroup' }, line('Service fee · ' + q.route.n + ' stop' + (q.route.n === 1 ? '' : 's') + ' · locked', money(q.f.service)), line('Spending cap · all items + ' + S.pay.capPad + '%', money(q.cap)), line('Upfront price', money(q.total), 'b')),
        h('div', { class: 'group-f', text: 'Unused cap is refunded with receipts. Anything over the cap needs your OK in chat.' })),
      h('div', { class: 'cfoot' }, h('button', { class: 'btn', id: 'cartDone', text: T.stopId ? 'Update stop · ' + money(sub) : 'Add to trip · ' + money(sub), on: { click: ST.commit } })));
    $('#cartSheet').replaceChildren(h('div', { class: 'cscrim', on: { click: ST.closeCart } }), sheetEl);
  },
  commit() {
    const T = S.c.store, items = ST.toItems(); let s = T.stopId && S.stops.find(x => x.id === T.stopId);
    if (s) s.items = items; else { s = ST.draftStop(); s.id = 's' + Date.now().toString(36); S.stops.push(s); }
    S.cap = null; S.c.screen = 'stops'; haptic(); R(); toast((T.stopId ? 'Updated ' : 'Added ') + T.st.name + (items.length ? ' · ' + ST.sum().n + ' items' : ''));
  },
  jump(id) { const sec = $('#cat_' + id), pg = $('#stPage'); if (!sec) return; S.c.store.cat = id; ST.tabs(); pg.scrollTo({ top: sec.offsetTop - $('.ststicky').offsetHeight - $('#stPage .navbar').offsetHeight + 4, behavior: 'smooth' }); },
  spy() { const T = S.c.store; if (!T || T.res) return; const pg = $('#stPage'), y = pg.scrollTop + $('.ststicky').offsetHeight + $('#stPage .navbar').offsetHeight + 12; let cur = T.cats[0].id;
    T.cats.forEach(c => { const s = $('#cat_' + c.id); if (s && s.offsetTop <= y) cur = c.id; }); if (cur !== T.cat) { T.cat = cur; ST.tabs(); } },
  tabs() { $$('#stTabs .chip').forEach(b => { const on = b.dataset.cat === S.c.store.cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) b.parentElement.scrollTo({ left: b.offsetLeft - 16, behavior: 'smooth' }); }); }
};
