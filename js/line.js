/* Hold My Spot: we hold a customer's place in a line. Booking -> Review -> Status.
 * Security: all user/API strings go in with textContent (h() from addstop.js); no inline handlers.
 * PRICING: everything below is a PROPOSED rate and a client-side ESTIMATE for the mockup only.
 * The server sets and verifies the final price; client numbers are never trusted (Shield F1 / C1). */
'use strict';
/* One config object for every pricing / fee rule. Rates come from js/settings.js (pending Jeremy). */
const LINE_CFG = {
  bookingFee: SETTINGS.line.bookingFee, hourly: SETTINGS.line.hourly, minHours: SETTINGS.line.minHours, capHours: SETTINGS.line.capHours, // total = fee + hourly x booked hours (minimum enforced)
  defaultHours: SETTINGS.line.defaultHours, incrementMin: SETTINGS.line.incrementMin, leadMinutes: SETTINGS.line.leadMinutes,     // scheduled start only (no ASAP), at least 2 h ahead
  cancel: { freeUntilDispatch: true, afterDispatch: 'time_and_mileage_used', callIn: { enabled: false, amount: null } }, // call-in flag kept, never shown
  noShow: { graceMin: SETTINGS.line.noShowGraceMin, fee: SETTINGS.line.noShowFee },                          // after grace: time spent + about $3 (Adam's final numbers)
  venueClosesLine: 'waive_minimum_bill_time_used',           // if the venue closes or cuts the line
  ratePending: true
};
/* One strings object for all Hold My Spot copy (draft, pending Lex). */
const LINE_STR = {
  tileTitle: 'Hold My Spot', tileSub: 'We hold your place in line.',
  bookTitle: 'Hold My Spot',
  bookLead: "We'll hold your place in line and ping you when it's almost your turn. You pay for time waited, up to the cap you set.",
  placeLabel: 'Where is the line?', placeHint: 'Search a venue or address',
  startLabel: 'Start time', startHint: 'Scheduled holds only. Choose a time at least 2 hours from now.',
  hoursLabel: 'Hours to book', rateTitle: 'Rate',
  estLabel: 'Total for your hours', estNote: 'Includes the $' + SETTINGS.line.bookingFee + ' booking fee. Nothing is added at checkout.',
  minErr: 'Book at least ' + SETTINGS.line.minHours + ' hours.',
  rateLabel: 'Proposed rate, estimate only, final price set by server',
  reviewLabel: 'Estimate. Final price set by server. Rate pending',
  termsTitle: 'Cancellation and no-show',
  cancelFree: 'Free to cancel until a runner is dispatched.',
  cancelAfter: 'After a runner is on the way, you pay only for the time and mileage already used.',
  noShow: "If you don't arrive within " + SETTINGS.line.noShowGraceMin + " minutes of being pinged, you pay for the time spent plus a $" + SETTINGS.line.noShowFee + " no-show fee.",
  venueClosed: 'If the venue closes or cuts the line, the minimum is waived and you pay only for time used.',
  feesAck: 'I understand the cancellation and no-show fees above.',
  rulesAck: "I've read this venue's line rules and understand I'm paying for time waited, with no guarantee of entry, tickets or items.",
  fine: "We hold your place in line. We can't guarantee tickets, items or entry. Venue rules apply, and some venues may not allow a swap, so you might need to join your runner in line. You pay for time used. If the venue closes the line, unused prepaid time is refunded.",
  blockedTitle: "We can't hold a spot here",
  statusTitle: 'Holding your spot', almostTitle: "Almost your turn, head over",
  pendingTitle: 'Waiting for a runner', pendingSub: "Your booking is in. We'll notify you when a runner accepts.",
  handoffTitle: 'How the handoff works',
  handoff: 'When it’s almost your turn, we ping you. Meet your runner in line and both of you confirm the same handoff code, then you take the spot.',
  noSwap: "If this venue doesn't allow swaps, join your runner in line instead of swapping.",
  codePending: 'Your handoff code appears here when a runner accepts.',
  runnerJob: 'Line hold'
};
/* Venues we refuse, with a short reason. Matched on the place name, address and Google types. */
const LINE_BLOCKS = [
  { re: /\b(dmv|motor vehicles?)\b/i, why: 'Government service lines like the DMV must be waited in by the person being served.' },
  { re: /\b(court ?house|courts?|city hall|town hall|village hall|social security|passport|government|immigration|uscis)\b/i, types: ['courthouse', 'city_hall', 'local_government_office', 'embassy'], why: 'We don’t hold places in court or government office lines.' },
  { re: /\b(shakespeare in the park|delacorte|free tickets?|ticket lottery|standby line|rush tickets?)\b/i, why: 'Free or limited ticket lines are meant for the people who wait in them.' },
  { re: /\b(raffle|limited drop|release day|sneaker drop|drop day)\b/i, why: 'We don’t hold spots for limited drops or raffles.' },
  { re: /\b(polling|poll site|early voting|election|board of elections|vote)\b/i, why: 'We never wait in voting or polling place lines.' },
  { re: /\b(food bank|food pantry|soup kitchen|clinic|vaccin\w*|testing site|health department|hospital|urgent care)\b/i, types: ['hospital'], why: 'We don’t hold places in health or food-assistance lines.' }
];
function lineBlocked(pl) {
  const text = [pl.name, pl.addr].join(' '), types = pl.types || [];
  const b = LINE_BLOCKS.find(x => x.re.test(text) || (x.types || []).some(t => types.includes(t)));
  return b ? b.why : null;
}
const lineMoney = v => '$' + (Number.isInteger(v) ? v : v.toFixed(2));
const lineOkHours = hrs => Number.isFinite(+hrs) && +hrs >= LINE_CFG.minHours && +hrs <= LINE_CFG.capHours;
/* Total for the booked hours. The minimum and the cap are enforced here and again in book_(). */
function lineEstimate(hours) {
  const C = LINE_CFG, hrs = Math.min(C.capHours, Math.max(C.minHours, +hours || 0)), r2 = x => Math.round(x * 100) / 100;
  return { hours: hrs, capMin: hrs * 60, total: r2(C.bookingFee + C.hourly * hrs), minTotal: r2(C.bookingFee + C.hourly * C.minHours) };
}
/* Copy computed from settings: '2-hour minimum ($95)', the rate, and the extra-hours / ending-early rules. */
const lineRules = hrs => {
  const C = LINE_CFG, step = Math.round(C.hourly * C.incrementMin / 60 * 100) / 100, e = lineEstimate(hrs);
  return {
    min: C.minHours + '-hour minimum (' + lineMoney(e.minTotal) + ')',
    rate: lineMoney(C.hourly) + '/hr + ' + lineMoney(C.bookingFee) + ' booking fee',
    extra: 'Extra hours: if the line is still going at ' + e.hours + ' hr, we ask you first. Each extra ' + C.incrementMin + ' minutes is ' + lineMoney(step) + ', up to ' + C.capHours + ' hr in total.',
    early: 'Ending early: if you take the spot before ' + e.hours + ' hr, you pay for the time used, never less than the ' + C.minHours + '-hour minimum (' + lineMoney(e.minTotal) + '). Unused prepaid time is refunded.'
  };
};
let lnTimer = 0, lnSeq = 0;
const LN = {
  screens: ['line', 'lineReview', 'lineStatus'],
  hoursLabel: m => { const hh = Math.floor(m / 60), mm = m % 60; return (hh ? hh + ' hr' : '') + (hh && mm ? ' ' : '') + (mm ? mm + ' min' : ''); },
  open() { S.c.ln = S.c.ln || { q: '', res: [], place: null, blocked: null, start: '', hours: LINE_CFG.defaultHours, rules: false, fees: false }; S.c.screen = S.line && S.line.status !== 'ended' ? 'lineStatus' : 'line'; Maps.ensure(); R(); },
  go(sc) { S.c.screen = sc; R(); },
  newCode() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0] % 10000).padStart(4, '0'); }, // prototype; the server issues real codes
  shell(sc) {
    const t = sc === 'line' ? LINE_STR.bookTitle : sc === 'lineReview' ? 'Review' : LINE_STR.tileTitle;
    return `<div class="lnwrap"><div class="page notab" data-scroll="pg-${sc}"><div class="navbar solid"><div class="nl"><button class="backbtn" id="navBack">${icon('chevL')}Back</button></div><div class="nt" id="navT"></div></div><h1 class="lt" id="lnTitle"></h1><div class="page-body" id="lnBody"></div></div><div class="lnfoot" id="lnFoot"></div></div>`; // footer sits below the scroll area, so it never covers fields
  },
  mount() {
    const sc = S.c.screen; if (S.view !== 'c' || !LN.screens.includes(sc)) return;
    const title = sc === 'line' ? LINE_STR.bookTitle : sc === 'lineReview' ? 'Review' : LINE_STR.tileTitle;
    $('#navT').textContent = title; $('#lnTitle').textContent = title;
    $('#navBack').onclick = () => { S.c.screen = sc === 'lineReview' ? 'line' : 'home'; R(); };
    if (sc === 'line') LN.book(); else if (sc === 'lineReview') LN.review(); else LN.status();
  },
  /* ---------- booking ---------- */
  book() {
    const F = S.c.ln, b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    b.append(h('p', { class: 'sub sec', text: LINE_STR.bookLead }), h('ul', { class: 'claims', id: 'lnClaims' }, ORD.claims().map(t => h('li', { class: /\(pending\)$/.test(t) ? 'pend' : '', text: t }))));
    // place
    b.append(h('div', { class: 'group-h', text: LINE_STR.placeLabel }));
    if (F.place) {
      b.append(h('div', { class: 'group' }, h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: F.place.name }), h('div', { class: 'subt', text: F.place.addr })),
        h('button', { class: 'btn sm gray', id: 'lnChange', text: 'Change', on: { click: () => { F.place = null; F.blocked = null; F.q = ''; F.res = []; LN.book(); } } }))));
      if (F.blocked) b.append(h('div', { class: 'blocked', id: 'lnBlocked', role: 'alert' }, h('div', { class: 'hl', text: LINE_STR.blockedTitle }), h('p', { class: 'sub', text: F.blocked })));
    } else {
      const inp = h('input', { id: 'lnq', type: 'text', inputmode: 'search', autocomplete: 'off', 'aria-label': LINE_STR.placeLabel, placeholder: LINE_STR.placeHint });
      inp.value = F.q; inp.addEventListener('input', () => LN.input(inp.value));
      b.append(h('label', { class: 'acfield' }, ic('search', 's'), inp), h('div', { id: 'lnList', class: 'aclist', role: 'listbox' }));
      LN.paintList();
      requestAnimationFrame(() => inp.focus({ preventScroll: true }));
    }
    if (!F.place || F.blocked) return;
    // time, wait, cap
    const min = new Date(Date.now() + LINE_CFG.leadMinutes * 60000); min.setSeconds(0, 0);
    const pad = n => String(n).padStart(2, '0'), local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const st = h('input', { id: 'lnStart', class: 'input', type: 'datetime-local', min: local(min), 'aria-label': LINE_STR.startLabel }); st.value = F.start;
    st.addEventListener('change', () => { F.start = st.value; LN.book(); });
    // hours: only minHours..capHours in 15-minute steps can be chosen
    const opts = []; for (let m = LINE_CFG.minHours * 60; m <= LINE_CFG.capHours * 60; m += LINE_CFG.incrementMin) opts.push(m / 60);
    const hs = h('select', { id: 'lnHours', class: 'whensel', 'aria-label': LINE_STR.hoursLabel }, opts.map(v => { const o = h('option', { value: v, text: LN.hoursLabel(v * 60) }); o.selected = v === +F.hours; return o; }));
    hs.addEventListener('change', () => { F.hours = +hs.value; LN.book(); });
    const e = lineEstimate(F.hours), rules = lineRules(F.hours);
    b.append(h('div', { class: 'group-h', text: 'When' }), h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.startLabel }), h('div', { class: 'subt', text: LINE_STR.startHint })), st),
      h('div', { class: 'cell', id: 'lnRate' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.rateTitle }), h('div', { class: 'subt', id: 'lnMin', text: rules.min })), h('div', { class: 'acc num', text: rules.rate })),
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.hoursLabel })), hs)));
    // total for the chosen hours, with the extra-hours and ending-early rules beside it
    b.append(h('div', { class: 'pbox', id: 'lnEst' }, LN.row(LINE_STR.estLabel + ' (' + LN.hoursLabel(e.capMin) + ')', money(e.total), 1),
      h('p', { class: 'fn', id: 'lnExtra', text: rules.extra }), h('p', { class: 'fn', id: 'lnEarly', text: rules.early })),
      h('p', { class: 'fn note', text: LINE_STR.estNote + ' ' + LINE_STR.rateLabel + ' (' + SETTINGS.line.pending + ').' }));
    // cancellation / no-show terms + acknowledgements
    b.append(h('div', { class: 'group-h', text: LINE_STR.termsTitle }), h('div', { class: 'group terms', id: 'lnTerms' },
      ...[LINE_STR.cancelFree, LINE_STR.cancelAfter, LINE_STR.noShow, LINE_STR.venueClosed].map(t => h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: t })))));
    b.append(LN.check('lnFees', LINE_STR.feesAck, F.fees, v => { F.fees = v; }), LN.check('lnRules', LINE_STR.rulesAck, F.rules, v => { F.rules = v; }));
    b.append(h('p', { class: 'fn note', text: LINE_STR.fine }));
    const ok = F.start && new Date(F.start) >= new Date(Date.now() + (LINE_CFG.leadMinutes - 1) * 60000) && lineOkHours(F.hours) && F.rules && F.fees;
    foot.append(h('button', { class: 'btn', id: 'lnReview', disabled: !ok, text: 'Review', on: { click: () => { S.c.screen = 'lineReview'; R(); } } }));
  },
  row(l, v, strong) { return h('div', { class: 'pline' + (strong ? ' b' : '') }, h('span', { text: l }), h('span', { class: 'num', text: v })); },
  check(id, label, val, set) {
    const c = h('input', { type: 'checkbox', id }); c.checked = !!val;
    c.addEventListener('change', () => { set(c.checked); LN.book(); });
    return h('label', { class: 'ack', for: id }, c, h('span', { text: label }));
  },
  input(v) {
    const F = S.c.ln; F.q = v; clearTimeout(lnTimer); const my = ++lnSeq;
    if (v.trim().length < Places.MIN) { F.res = []; LN.paintList(); return; }
    lnTimer = setTimeout(async () => { const r = await Places.suggest(v); if (my !== lnSeq) return; F.res = r; LN.paintList(); }, 300);
  },
  paintList() {
    const F = S.c.ln, el = $('#lnList'); if (!el) return; el.replaceChildren();
    if (F.q.trim().length < Places.MIN) return;
    F.res.forEach((sg, i) => el.append(h('button', { class: 'cell ac tap', id: 'ln' + i, role: 'option', on: { click: () => LN.pick(sg) } }, h('div', { class: 'grow' }, h('div', { class: 'title', text: sg.primary }), h('div', { class: 'subt', text: sg.secondary })))));
    el.append(h('button', { class: 'cell ac tap', id: 'lnTyped', role: 'option', on: { click: () => LN.pickTyped() } }, h('div', { class: 'grow' }, h('div', { class: 'title', text: 'Use “' + F.q.trim() + '”' }), h('div', { class: 'subt', text: 'Venue as typed' }))));
  },
  async pick(sg) { const pl = await Places.resolve(sg); pl.types = (sg.pred && sg.pred.types) || []; LN.setPlace(pl); },
  async pickTyped() { const F = S.c.ln, pl = await Places.freeText(F.q.trim()); pl.name = F.q.trim(); LN.setPlace(pl); },
  setPlace(pl) { const F = S.c.ln; F.place = { name: pl.name, addr: pl.addr, lat: pl.lat, lng: pl.lng, types: pl.types || [] }; F.blocked = lineBlocked(F.place); LN.book(); },
  /* ---------- review ---------- */
  review() {
    const F = S.c.ln; if (!F || !F.place || F.blocked) { S.c.screen = 'line'; R(); return; }
    const e = lineEstimate(F.hours), b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    const when = new Date(F.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    b.append(h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: F.place.name }), h('div', { class: 'subt', text: F.place.addr }))),
      h('div', { class: 'cell' }, h('div', { class: 'grow title', text: 'Starts' }), h('div', { class: 'acc', text: when })),
      h('div', { class: 'cell' }, h('div', { class: 'grow title', text: LINE_STR.hoursLabel }), h('div', { class: 'acc', text: LN.hoursLabel(e.capMin) }))));
    const rules = lineRules(F.hours);
    b.append(h('div', { class: 'pbox', id: 'lnRevEst' }, LN.row(LINE_STR.estLabel + ' (' + LN.hoursLabel(e.capMin) + ')', money(e.total), 1), h('p', { class: 'fn', text: rules.extra }), h('p', { class: 'fn', text: rules.early })),
      h('p', { class: 'fn note est-label', id: 'lnEstLabel', text: LINE_STR.reviewLabel }),
      h('p', { class: 'fn note', text: LINE_STR.estNote + ' ' + rules.rate + ', ' + rules.min + '.' }),
      h('div', { class: 'group-h', text: LINE_STR.termsTitle }), h('div', { class: 'group terms' }, ...[LINE_STR.cancelFree, LINE_STR.cancelAfter, LINE_STR.noShow].map(t => h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: t })))),
      h('p', { class: 'fn note', text: LINE_STR.fine }));
    foot.append(h('button', { class: 'btn', id: 'lnBook', text: 'Book · ' + money(e.total) + ' est.', on: { click: LN.book_ } }));
  },
  book_() {
    if (!AU.require()) return;
    const F = S.c.ln; if (!F || !F.place || lineBlocked(F.place)) { toast(F && F.place ? lineBlocked(F.place) : 'Choose where the line is.'); return; }
    if (!lineOkHours(F.hours)) { toast(LINE_STR.minErr); return; }   // the minimum is enforced at booking, not just in the picker
    const e = lineEstimate(F.hours); haptic();
    S.line = { place: { ...F.place }, start: F.start, startLabel: new Date(F.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }), hours: e.hours, capMin: e.capMin, est: e, status: 'requested', relief: false, code: null };
    S.c.ln = null; S.c.screen = 'lineStatus'; R();
  },
  cancel() { const L = S.line; const free = L && L.status === 'requested'; S.line = null; S.c.screen = 'home'; R(); toast(free ? 'Cancelled. No charge.' : 'Cancelled. You pay only for time and mileage used.'); },
  /* ---------- status ---------- */
  status() {
    const L = S.line, b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    if (!L) { b.append(h('div', { class: 'estate' }, h('div', { class: 'hl', text: 'No line hold' }), h('p', { class: 'sub sec', text: 'Book a hold to see it here.' }))); return; }
    const pending = L.status === 'requested';
    const head = pending ? LINE_STR.pendingTitle : L.status === 'almost' ? LINE_STR.almostTitle : L.status === 'ended' ? 'Hold ended' : LINE_STR.statusTitle;
    b.append(h('div', { class: 'statuscard', id: 'lnStatus' }, h('div', { class: 'eta', text: head }), h('p', { class: 'sub sec', text: pending ? LINE_STR.pendingSub : L.place.name + ' · ' + L.startLabel }),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + (pending ? 4 : L.status === 'almost' ? 90 : 50) + '%' }))));
    b.append(h('div', { class: 'group-h', text: LINE_STR.handoffTitle }), h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: 'Handoff code' }), h('div', { class: 'subt', text: L.code ? 'Show this to your runner. They see the same code.' : LINE_STR.codePending })), L.code ? h('div', { class: 'acc num code', text: L.code }) : null),
      h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: LINE_STR.handoff })),
      h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: LINE_STR.noSwap }))));
    b.append(h('div', { class: 'pbox' }, LN.row(LINE_STR.estLabel, money(L.est.total), 1)), h('p', { class: 'fn note', text: LINE_STR.reviewLabel }));
    foot.append(h('button', { class: 'btn gray', id: 'lnCancel', text: 'Cancel hold', on: { click: LN.cancel } }));
  }
};
