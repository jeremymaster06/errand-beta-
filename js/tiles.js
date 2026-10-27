/* Customer home tile grid, per-tile presets/requirements, and Repeat weekly errands.
 * Security: all text goes in through textContent (h() builder); static markup is built with dom().
 * No inline handlers (CSP script-src-attr 'none'). No demo data.
 * DRAFT COPY: TILE_STR strings are drafts pending Lex's legal review. TILE_CFG values are final (Oct 25).  */
'use strict';
const TILE_CFG = {
  post: { maxDeclaredValue: SETTINGS.tiles.postMaxDeclaredValue },                      // final: max declared value / our liability cap per package (USD)
  cleaning: { coverCap: SETTINGS.tiles.cleaningCoverCap, maxItemValue: SETTINGS.tiles.maxItemValue, claimDays: SETTINGS.tiles.claimDays }, // final: loss cover cap, max purchase/item value per order, claim window (days)
  grocery: { subs: ['best', 'ask', 'none'], defaultSub: null },  // substitution preference must be chosen up front
  weekly: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    windows: ['8–10 AM', '10 AM–12 PM', '12–2 PM', '2–4 PM', '4–6 PM', '6–8 PM'], priceNoticeDays: SETTINGS.tiles.weeklyPriceNoticeDays } // final: price-change notice period (days)
};
const TILE_STR = { // DRAFT, pending Lex
  draftTag: 'Draft copy · pending legal review',
  block: "We can't buy or carry alcohol, tobacco, vapes, cannabis, prescriptions, age-restricted items, lottery tickets, firearms, cash or money orders.",
  blockedItem: "That item isn't allowed. We can't buy or carry alcohol, tobacco, vapes, cannabis, prescriptions, age-restricted items, lottery tickets, firearms, cash or money orders.",
  cont: 'Continue', more: 'More errands',
  tiles: {
    groceries: { t: 'Groceries', s: 'Browse a store, add items.' },
    returns: { t: 'Returns & drop-offs', s: 'Store returns, label drop-offs.' },
    cleaning: { t: 'Dry cleaning', s: 'Drop off or pick up.' },
    weekly: { t: 'Repeat weekly errands', s: 'Same day and time each week.' },
    post: { t: 'Post office & packages', s: 'Prepaid labels and held mail.' },
    gifts: { t: 'Gifts & flowers', s: 'Picked up and delivered.' }
  },
  grocery: { subTitle: 'If an item is out of stock', subs: { best: 'Best match', ask: 'Ask me', none: "Don't substitute" }, ebt: 'EBT/SNAP not accepted.',
    range: 'Estimated range', rangeNote: 'The final amount depends on what the store has and the actual shelf prices. Unused cap is refunded.' },
  returns: { proofTitle: 'What do you have for the return?', proofs: { receipt: 'Receipt', qr: 'Return QR code', label: 'Prepaid shipping label' },
    id: "If the store needs your ID, you'll need to return it in person.", refund: 'Refunds go to your original payment method.' },
  post: { modeTitle: 'What do you need?', modes: { dropoff: 'Drop off a prepaid package (label or QR code)', held: 'Pick up held mail' },
    sealed: 'My package is sealed and has no hazardous or prohibited items (like lithium batteries, aerosols or flammables).',
    intl: 'This package is going outside the US', customs: 'I filled out and signed any customs forms myself.',
    heldAuth: "I'll give my runner a USPS authorization I've signed. My runner shows their own ID.",
    noOpen: 'Your runner never opens or repacks a package.', noSign: "We can't sign for certified or registered mail.",
    value: 'Declared value per package (USD)', valueMax: v => 'Packages declared over $' + v + " can't be accepted.",
    claims: "Lost or damaged parcels follow the carrier's claims process.",
    liability: v => 'Our liability is capped at $' + v + ' per package. For higher value, buy insurance from the carrier.' },
  cleaning: { cover: c => 'Your cleaner is responsible for cleaning results. We cover loss while items are with us, up to $' + c + '.',
    value: 'Optional: declare a higher value (USD)', over: m => "Items worth more than $" + m + " can't be accepted.",
    claim: d => 'Report a missing item within ' + d + ' days of delivery.',
    coverFull: c => 'Loss cover: up to $' + c + ' while items are with us. Normal wear and hidden defects are not covered.' },
  terms: { maxBuy: m => '$' + m.toLocaleString('en-US') + ' is the most a runner will buy per order. This does not limit refunds for items we lose or damage.',
    claim: 'Request a refund or credit under our Damage & Loss Policy (Terms \u00a74.3\u20134.4)', within: d => 'Submit within ' + d + ' days of delivery.', title: 'Terms' },
  gifts: { noAlc: 'No alcohol, including wine or champagne baskets.', rName: 'Recipient name', rAddr: 'Recipient address', rMsg: 'Card message (optional)',
    privacy: 'Recipient name, address and message are used only for this delivery.', price: 'You pay for the item; we confirm the price with you before buying.' },
  weekly: { title: 'Repeat weekly errands', day: 'Day', win: 'Time window', stopsNext: 'Add stops',
    label: 'Repeats weekly, each trip priced by the engine at the time.',
    priceTitle: 'How each week is charged', modes: { approve: "Show me each week's price before charging", max: 'Charge automatically up to my weekly max' },
    max: 'Weekly max (USD)', maxNote: "If a week's price would go over your max, we alert you and don't charge until you approve.",
    cancelHow: 'Cancel anytime in the app: Activity › Weekly errands › Cancel. One tap, no fee before a runner is dispatched.',
    skipEdit: 'You can skip or edit any single week in the app.',
    priceChange: n => "We give you " + n + " days' notice of any price change, and you can skip or cancel with one tap before each charge.",
    optIn: 'I agree this errand repeats every week until I cancel.',
    doneTitle: 'Weekly errands set up', skip: 'Skip next week', unskip: 'Undo skip', edit: "Edit next week's stops", cancel: 'Cancel weekly errands',
    cancelled: 'Weekly errands cancelled. No future trips will be booked.', skipped: 'Next week is skipped.', manage: 'Weekly errands' }
};
/* Global block list (Lex): applied to catalog items, catalog search, custom items, stop notes and place search. */
const BLOCK_RE = /\b(alcohol(ic)?|beers?|wines?|liquors?|vodka|whiske?y|bourbon|scotch|tequila|rum|gin|champagne|prosecco|sake|hard seltzer|spirits|tobacco|cigars?|cigarettes?|cigarillos?|vapes?|vaping|e-?cig(arette)?s?|nicotine|juul|hookah|cannabis|marijuana|thc|cbd|dispensary|prescriptions?|rx|dextromethorphan|cough syrup, dm|pseudoephedrine|sudafed|lottery|lotto|scratch-?offs?|powerball|firearms?|guns?|ammo|ammunition|rifles?|pistols?|cash|money orders?|check cashing)\b/i;
const BLOCK_VENUE_RE = /\b(liquor|wine (and|&) spirits|wine shop|smoke shop|vape|tobacco|dispensary|cannabis|gun shop|firearms?|check cashing|lottery)\b/i;
function isBlocked(t) { return BLOCK_RE.test(String(t || '').replace(/wine vinegar/ig, '')); }
const TILES = {
  groceries: { kinds: ['grocery'], ic: 'cart', q: 'grocery', type: 'Groceries', addrType: 'Personal pickup' },        // engine: grocery (item browser)
  returns: { kinds: ['shipping'], ic: 'ret', q: 'UPS Store', type: 'Returns', addrType: 'Drop-off' },                  // engine: return (drop-off)
  cleaning: { kinds: ['cleaners'], ic: 'hanger', q: 'cleaners', type: 'Dry cleaning', addrType: 'Personal pickup' },  // engine: pickup
  weekly: { ic: 'repeat' },
  post: { kinds: ['post'], ic: 'envelope', q: 'post office', type: 'Post office', addrType: 'Drop-off' },          // engine: post_office
  gifts: { ic: 'gift', q: 'florist', type: 'Shopping', addrType: 'Personal pickup' }              // engine: pickup (store)
};
const TL = {
  screens: ['tileSetup', 'weeklyDone'],
  preset: () => S.c.preset && TILES[S.c.preset.key] ? S.c.preset : null,
  shell() { return `<div class="lnwrap"><div class="page notab"><div class="navbar solid"><div class="nl"><button class="backbtn" id="navBack">${icon('chevL')}Back</button></div><div class="nt"></div></div><h1 class="lt" id="tsTitle"></h1><div class="page-body" id="tsBody"></div></div><div class="lnfoot" id="tsFoot"></div></div>`; },
  open(key) { if (!TILES[key]) return; S.c.tset = { key, f: {} }; S.c.screen = 'tileSetup'; haptic(); R(); },
  clear() { S.c.preset = null; },
  /* Lex's final terms per tile; review=true also repeats tile-specific caps shown in setup. */
  terms(k, review) {
    const X = TILE_STR, C2 = TILE_CFG, t = [];
    if (review && k === 'post') t.push(X.post.liability(C2.post.maxDeclaredValue));
    if (review && k === 'cleaning') t.push(X.cleaning.coverFull(C2.cleaning.coverCap));
    if (review && k === 'weekly') return t;
    if (k !== 'weekly') t.push(X.terms.maxBuy(C2.cleaning.maxItemValue), [h('button', { class: 'linkbtn', 'data-act': 'AU.openDoc', 'data-args': '["terms","4.3"]', text: X.terms.claim }), ' ', h('span', { id: 'tsClaimDays', text: X.terms.within(C2.cleaning.claimDays) })]);
    return t;
  },
  /* ---------- home grid ---------- */
  mountGrid() {
    const g = $('#tileGrid'); if (!g) return; g.replaceChildren();
    g.append(h('div', { class: 'group-h', text: TILE_STR.more }), h('div', { class: 'tgrid', role: 'list' }, Object.keys(TILES).map(k =>
      h('button', { class: 'gtile', id: 'tile-' + k, role: 'listitem', on: { click: () => TL.open(k) } },
        h('span', { class: 'gtile-ic', ic: [TILES[k].ic] }), h('span', { class: 'gtile-t', text: TILE_STR.tiles[k].t }), h('span', { class: 'gtile-s', text: TILE_STR.tiles[k].s })))));
    if (S.weekly && S.weekly.active) g.append(h('div', { class: 'group' }, h('button', { class: 'cell tap', id: 'wkManageCell', on: { click: () => { S.c.screen = 'weeklyDone'; R(); } } },
      h('span', { class: 'grow' }, h('span', { class: 'hl', text: TILE_STR.weekly.manage }), h('span', { class: 'fn sec', text: ' · ' + S.weekly.day + ' ' + S.weekly.win })))));
  },
  /* ---------- per-tile setup (requirements before the stop search) ---------- */
  mount() {
    TL.mountGrid(); TL.mountReview();
    const sc = S.c.screen; if (S.view !== 'c' || !TL.screens.includes(sc)) return;
    $('#navBack').onclick = () => C.tab('home');
    if (sc === 'weeklyDone') return TL.done();
    const T = S.c.tset, k = T.key, f = T.f, b = $('#tsBody'), foot = $('#tsFoot'); b.replaceChildren(); foot.replaceChildren();
    $('#tsTitle').textContent = TILE_STR.tiles[k].t;
    const note = t => h('div', { class: 'cell' }, h('div', { class: 'fn' }, t));
    const group = (title, ...kids) => [title ? h('div', { class: 'group-h', text: title }) : '', h('div', { class: 'group' }, ...kids)];
    const radio = (name, opts, title) => group(title, ...Object.entries(opts).map(([v, l]) => {
      const i = h('input', { type: 'radio', name, id: 'ts-' + name + '-' + v, value: v }); i.checked = f[name] === v; i.onchange = () => { f[name] = v; TL.mount(); };
      return h('label', { class: 'cell ack', for: i.id }, i, h('span', { text: l })); }));
    const tick = (name, text) => { const i = h('input', { type: 'checkbox', id: 'ts-' + name }); i.checked = !!f[name]; i.onchange = () => { f[name] = i.checked; TL.mount(); };
      return h('div', { class: 'group' }, h('label', { class: 'cell ack', for: i.id }, i, h('span', { text }))); };
    const field = (name, label, o = {}) => { const i = h('input', { class: 'input', id: 'ts-' + name, 'aria-label': label, placeholder: label, maxlength: o.max || 120, inputmode: o.num ? 'decimal' : null });
      i.value = f[name] || ''; i.oninput = () => { f[name] = i.value; TL.paintGo(); }; return h('div', { class: 'cell' }, i); };
    const sel = (name, opts, label) => { const s = h('select', { class: 'input', id: 'ts-' + name, 'aria-label': label }, h('option', { value: '', text: label }), opts.map(o => h('option', { value: o, text: o })));
      s.value = f[name] || ''; s.onchange = () => { f[name] = s.value; TL.paintGo(); }; return h('div', { class: 'cell' }, s); };
    const X = TILE_STR, C2 = TILE_CFG, parts = [];
    if (k === 'groceries') parts.push(...radio('sub', Object.fromEntries(C2.grocery.subs.map(s => [s, X.grocery.subs[s]])), X.grocery.subTitle), ...group('', note(X.grocery.ebt)));
    if (k === 'returns') parts.push(...radio('proof', X.returns.proofs, X.returns.proofTitle), ...group('', note(X.returns.id), note(X.returns.refund)));
    if (k === 'post') {
      parts.push(...radio('mode', X.post.modes, X.post.modeTitle));
      if (f.mode === 'dropoff') { parts.push(tick('sealed', X.post.sealed), tick('intl', X.post.intl)); if (f.intl) parts.push(tick('customs', X.post.customs));
        parts.push(...group(X.post.value, field('value', X.post.value, { num: 1, max: 9 }), note(X.post.valueMax(C2.post.maxDeclaredValue)))); }
      if (f.mode === 'held') parts.push(tick('heldAuth', X.post.heldAuth));
      parts.push(...group('', note(X.post.noOpen), note(X.post.noSign), note(X.post.claims), note(X.post.liability(C2.post.maxDeclaredValue))));
    }
    if (k === 'cleaning') parts.push(...group('', note(X.cleaning.cover(C2.cleaning.coverCap)), note(X.cleaning.over(C2.cleaning.maxItemValue)), note(X.cleaning.coverFull(C2.cleaning.coverCap)), note(X.cleaning.claim(C2.cleaning.claimDays))),
      ...group(X.cleaning.value, field('value', X.cleaning.value, { num: 1, max: 9 })));
    if (k === 'gifts') parts.push(...group('Recipient', field('rName', X.gifts.rName, { max: 80 }), field('rAddr', X.gifts.rAddr, { max: 160 }), field('rMsg', X.gifts.rMsg, { max: 200 })),
      ...group('', note(X.gifts.privacy), note(X.gifts.price), note(X.gifts.noAlc)));
    if (k === 'weekly') {
      parts.push(...group('', sel('day', C2.weekly.days, X.weekly.day), sel('win', C2.weekly.windows, X.weekly.win)), ...radio('pmode', X.weekly.modes, X.weekly.priceTitle));
      if (f.pmode === 'max') parts.push(...group(X.weekly.max, field('max', X.weekly.max, { num: 1, max: 7 }), note(X.weekly.maxNote)));
      parts.push(...group('', note(X.weekly.label), note(X.weekly.cancelHow), note(X.weekly.skipEdit), note(X.weekly.priceChange(C2.weekly.priceNoticeDays))));
    }
    parts.push(...group('', h('div', { id: 'tsTerms' }, ...TL.terms(k).map(t => note(t)))));
    parts.push(h('div', { class: 'blocknote fn', id: 'tsBlock', text: X.block }), h('div', { class: 'fn sec draft', text: X.draftTag }));
    b.append(...parts.filter(Boolean));
    foot.append(h('div', { class: 'fn err', id: 'tsErr', role: 'alert' }), h('button', { class: 'btn', id: 'tsGo', text: k === 'weekly' ? X.weekly.stopsNext : TL.err() === null ? X.cont : X.cont, on: { click: TL.go } }));
    TL.paintGo();
  },
  err() { // null = ok; '' = incomplete; string = shown error
    const T = S.c.tset, k = T.key, f = T.f, num = v => parseFloat(v), C2 = TILE_CFG, X = TILE_STR;
    if (k === 'groceries' && !f.sub) return '';
    if (k === 'returns' && !f.proof) return '';
    if (k === 'post') { if (!f.mode) return '';
      if (f.mode === 'dropoff') { if (!f.sealed || (f.intl && !f.customs)) return ''; if (f.value && !(num(f.value) >= 0)) return 'Enter a number.'; if (num(f.value) > C2.post.maxDeclaredValue) return X.post.valueMax(C2.post.maxDeclaredValue); }
      if (f.mode === 'held' && !f.heldAuth) return ''; }
    if (k === 'cleaning' && f.value) { if (!(num(f.value) >= 0)) return 'Enter a number.'; if (num(f.value) > C2.cleaning.maxItemValue) return X.cleaning.over(C2.cleaning.maxItemValue); }
    if (k === 'gifts') { if (!(f.rName || '').trim() || !(f.rAddr || '').trim()) return ''; if (['rName', 'rAddr', 'rMsg'].some(x => isBlocked(f[x]))) return X.blockedItem; }
    if (k === 'weekly') { if (!f.day || !f.win || !f.pmode) return ''; if (f.pmode === 'max' && !(num(f.max) > 0)) return ''; }
    return null;
  },
  paintGo() { const e = TL.err(), b = $('#tsGo'), m = $('#tsErr'); if (b) b.disabled = e !== null; if (m) m.textContent = e || ''; },
  go() {
    if (TL.err() !== null) return; const T = S.c.tset, P = TILES[T.key];
    S.c.preset = { key: T.key, f: { ...T.f } };
    if (T.key === 'weekly') { S.c.screen = 'stops'; R(); return; }
    S.c.screen = 'stops'; AS.open();
    const q = P.q, i = $('#acq'); if (i) i.value = q; AS.input(q);
  },
  /* ---------- review additions (grocery range, weekly terms + unchecked opt-in) ---------- */
  mountReview() {
    const box = $('#tlReview'); if (!box) return; box.replaceChildren(); const P = TL.preset(), pay = $('#payBtn'); if (!P) return;
    const X = TILE_STR, q = quote(), row = (l, v) => h('div', { class: 'pline' }, h('span', { text: l }), h('span', { class: 'num', text: v }));
    if (P.key === 'groceries') box.append(h('div', { class: 'group-h', text: X.grocery.range }), h('div', { class: 'group', style: 'padding:8px 16px' },
      row(X.grocery.range, money(q.f.service + q.goods) + ' – ' + money(q.total)), h('div', { class: 'fn sec', text: X.grocery.rangeNote }), h('div', { class: 'fn sec', text: 'Substitutions: ' + X.grocery.subs[P.f.sub] + ' · ' + X.grocery.ebt })));
    if (P.key === 'weekly') {
      const W = X.weekly, f = P.f, i = h('input', { type: 'checkbox', id: 'wkOptIn' }); i.checked = false;
      i.onchange = () => { if (pay) pay.disabled = !i.checked; };
      box.append(h('div', { class: 'group-h', text: W.title }), h('div', { class: 'group terms', id: 'wkTerms' },
        ...[f.day + 's, ' + f.win, W.label, f.pmode === 'max' ? W.modes.max + ': ' + money(+f.max) + '. ' + W.maxNote : W.modes.approve + '.', W.cancelHow, W.skipEdit, W.priceChange(TILE_CFG.weekly.priceNoticeDays)]
          .map(t => h('div', { class: 'cell' }, h('div', { class: 'fn', text: t })))),
        h('div', { class: 'group' }, h('label', { class: 'cell ack', for: 'wkOptIn' }, i, h('span', { text: W.optIn }))));
      if (pay) pay.disabled = true;
    }
    const T = TL.terms(P.key, true); if (T.length) box.append(h('div', { class: 'group-h', text: X.terms.title }), h('div', { class: 'group terms', id: 'tlTerms' }, ...T.map(t => h('div', { class: 'cell' }, h('div', { class: 'fn' }, t)))));
  },
  /* ---------- weekly confirmation / management ---------- */
  done() {
    const W = TILE_STR.weekly, b = $('#tsBody'), foot = $('#tsFoot'), K = S.weekly; b.replaceChildren(); foot.replaceChildren();
    $('#tsTitle').textContent = W.doneTitle;
    if (!K || !K.active) { b.append(h('div', { class: 'group' }, h('div', { class: 'cell' }, h('div', { class: 'fn', text: W.cancelled })))); return; }
    const c = t => h('div', { class: 'cell' }, h('div', { class: 'fn', text: t }));
    b.append(h('div', { class: 'group', id: 'wkSummary' }, c(K.day + 's, ' + K.win + ' · ' + K.stops + ' stop' + (K.stops === 1 ? '' : 's')), c(W.label),
      c(K.pmode === 'max' ? W.modes.max + ': ' + money(K.max) : W.modes.approve), c(K.skipNext ? W.skipped : 'Next trip: next ' + K.day + ', ' + K.win)),
      h('div', { class: 'group-h', text: 'How to cancel' }), h('div', { class: 'group' }, c(W.cancelHow), c(W.skipEdit), c(W.priceChange(TILE_CFG.weekly.priceNoticeDays))),
      h('button', { class: 'btn gray', id: 'wkSkip', text: K.skipNext ? W.unskip : W.skip, on: { click: () => { K.skipNext = !K.skipNext; R(); toast(K.skipNext ? W.skipped : 'Next week is back on.'); } } }),
      h('button', { class: 'btn gray', id: 'wkEdit', text: W.edit, on: { click: () => { S.c.preset = { key: 'weekly', f: { day: K.day, win: K.win, pmode: K.pmode, max: K.max }, editOnly: true }; S.c.screen = 'stops'; R(); } } }),
      S.trip ? h('button', { class: 'btn gray', id: 'wkTrack', text: "Track this week's trip", on: { click: () => C.go('tracking') } }) : '');
    foot.append(h('button', { class: 'btn danger', id: 'wkCancel', text: W.cancel, on: { click: () => { K.active = false; R(); toast(W.cancelled); } } }));
  }
};
/* ---- hooks into the existing flow (no changes to engine or pricing math) ---- */
(function () {
  const conf = C.confirm, start = C.start, tab = C.tab;
  C.start = function () { TL.clear(); start(); };
  C.tab = function (t) { if (t === 'home') { S.c.preset = S.c.preset && S.c.preset.key === 'weekly' && S.c.screen === 'review' ? S.c.preset : null; } tab(t); };
  C.confirm = function () {
    const P = TL.preset();
    if (P && P.editOnly) { if (S.weekly) S.weekly.stops = S.stops.length; S.c.preset = null; S.c.screen = 'weeklyDone'; R(); toast("Next week's stops updated"); return; }
    if (P && P.key === 'weekly') { const o = $('#wkOptIn'); if (!o || !o.checked) { toast('Tick the weekly box to continue.'); return; }
      conf(); S.trip.recur = { weekly: true, day: P.f.day, win: P.f.win };
      S.weekly = { active: true, day: P.f.day, win: P.f.win, pmode: P.f.pmode, max: +P.f.max || null, stops: S.trip.stops.length, skipNext: false };
      S.c.screen = 'weeklyDone'; R(); return; }
    if (P) { conf(); if (S.trip) S.trip.preset = { key: P.key, f: P.key === 'gifts' ? {} : P.f }; return; } // recipient details stay with the stop only
    conf();
  };
  const gi = Catalog.getItems; Catalog.getItems = async (...a) => (await gi(...a)).filter(i => !isBlocked(i.name) && !isBlocked(i.unit));
  const sg = Places.suggest; Places.suggest = async q => {
    if (isBlocked(q)) return [];
    let r = (await sg(q)).filter(x => !BLOCK_VENUE_RE.test(x.primary || ''));
    const P = TL.preset(), T = P && TILES[P.key];
    // Offline sample search matches names only, so a preset's category query lists that category's places instead.
    if (Places.mode === 'local' && T && T.kinds && q === T.q) r = Places.LOCAL.filter(x => T.kinds.includes(x.kind)).map(x => ({ id: x.id, primary: x.name, secondary: x.addr + (x.city ? ', ' + x.city : ''), pm: [], sm: [], kind: x.kind, src: 'local' }));
    return r;
  };
})();
