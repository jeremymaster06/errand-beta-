'use strict';
const RIDE_RE = /\b(rides?|passengers?|drive me|pick me up|give me a lift|lift to|carpool|taxi|uber me|airport run with me|take me to)\b/i;
const isRide = t => RIDE_RE.test(String(t || ''));
const RIDE_MSG = 'Runners carry goods only. They never give rides.';
const SORTS = [['distance', 'Nearest'], ['price', 'Lowest price'], ['rating', 'Top rated'], ['favorites', 'Favorites']];
const stars = r => r && r[1] ? (r[0] / r[1]).toFixed(1) + ' ★ (' + r[1] + ')' : 'New';
function runnerPicker(offers, selId, onPick, emptyText, onSort) {
  const sort = h('select', { class: 'whensel', id: 'rkSort', 'aria-label': 'Sort runners' }, SORTS.map(([v, l]) => { const o = h('option', { value: v, text: l }); o.selected = v === (S.c.sort || 'distance'); return o; }));
  sort.addEventListener('change', () => { S.c.sort = sort.value; onSort(); });
  if (!offers.length) return h('div', { class: 'group', id: 'runnerPick' }, h('div', { class: 'cell' }, h('div', { class: 'grow sub sec', id: 'noRunners', text: emptyText })));
  return h('div', { class: 'group rpick', id: 'runnerPick', role: 'radiogroup', 'aria-label': 'Runners' },
    h('div', { class: 'cell' }, h('div', { class: 'grow fn sec', text: offers.length + ' runner' + (offers.length === 1 ? '' : 's') + ' · sorted by' }), sort),
    ...offers.map(o => h('button', { class: 'cell tap rk' + (o.id === selId ? ' on' : ''), id: 'rk-' + o.id, role: 'radio', 'aria-checked': String(o.id === selId), on: { click: () => onPick(o.id) } },
      h('span', { class: 'rk-av', text: o.name.slice(0, 1).toUpperCase() }),
      h('span', { class: 'grow' }, h('span', { class: 'title', text: o.name + (o.fav ? ' · Favorite' : '') }), h('span', { class: 'subt', text: stars(o.rating) + ' · ' + (o.dist != null ? o.dist + ' mi away' : '') + ' · ' + (o.online ? 'Available now' : 'Not online now') })),
      h('span', { class: 'acc num', text: money(o.price) }))));
}
function jobAgreement(text, open) {
  const d = h('details', { class: 'agree', id: 'jobAgreement' }, h('summary', { text: 'Job agreement' }), ...text.split('\n').map(t => h('p', { class: 'fn', text: t })));
  if (open) d.open = true; return d;
}
const custName = () => { const s = AU.session(); return s ? s.name : 'Customer'; };
function errandContract(stops, q, r, dest) {
  return ['Between ' + custName() + ' (customer) and ' + r.name + ' (runner), made ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) + '.',
    'Work: ' + stops.length + ' stop' + (stops.length === 1 ? '' : 's') + ' in this order' + (stops.length > 1 ? ' (' + (q.route.pick === 'mine' ? 'customer’s order' : 'cheapest route') + ')' : '') + ': ' + q.route.order.map((i, k) => (k + 1) + '. ' + placeOf(stops[i]).name).join(', ') + '. Then deliver everything to ' + dest.name + (dest.addr && !dest.unset ? ', ' + dest.addr : '') + '. Goods only, no passengers.',
    'Price: ' + money(q.runner.price) + ', set by the runner. Item costs at shelf price from a hold of up to ' + money(q.cap) + ' on the customer\'s card; unused hold is released.',
    'Timing: ' + (ORD.timeNote[q.timing] || '') + ' The runner chooses how to do the work.',
    'Cancel: free until the runner accepts. After that, the customer pays for items already bought.',
    'ErrandCo provides the app and payment processing only and is not a party to this agreement. Test mode: no money moves.'].join('\n');
}
function lineContract(F, r, e) {
  return ['Between ' + custName() + ' (customer) and ' + r.name + ' (runner).',
    'Work: wait in line at ' + F.place.name + ' starting ' + new Date(F.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ }) + ' for up to ' + e.hours + ' hr. No promise of entry, tickets or items.',
    'Price: ' + money(e.total) + ' (' + money(r.rates.lineHourly) + '/hr), set by the runner.',
    'ErrandCo provides the app and payment processing only and is not a party to this agreement. Test mode: no money moves.'].join('\n');
}
function notify(to, text, go, rid) { S.notes = (S.notes || []).concat({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), to, rid: rid || null, text: String(text).slice(0, 160), at: Date.now(), go: go || null, read: false }).slice(-60); }
const SAFE_IMG = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const safeImg = v => typeof v === 'string' && v.length < 400000 && SAFE_IMG.test(v) ? v : null;
function readPhoto(file) {
  return new Promise((ok, no) => {
    if (!file || !/^image\//.test(file.type)) { no(new Error('type')); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const k = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); const d = safeImg(c.toDataURL('image/jpeg', 0.6)); d ? ok(d) : no(new Error('size')); };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('read')); };
    img.src = url;
  });
}
function photoBtn(id, label, have, onDone) {
  const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', id, class: 'vh', 'aria-label': label });
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; readPhoto(f).then(onDone).catch(() => toast("Couldn't use that photo. Try another.", 'alert')); });
  return h('label', { class: 'btn ' + (have ? 'gray' : ''), for: id }, inp, h('span', { text: have ? label + ' · Retake' : label }));
}
const procFee = p => Math.round((p * SETTINGS.card.pct + SETTINGS.card.fixed) * 100) / 100;
const mapsUrl = p => { const la = +p.lat, ln = +p.lng; return Number.isFinite(la) && Number.isFinite(ln) ? 'https://maps.apple.com/?daddr=' + la.toFixed(5) + ',' + ln.toFixed(5) : null; };
