'use strict';
const LINE_CFG = {
  capHours: SETTINGS.line.capHours, defaultHours: SETTINGS.line.defaultHours, incrementMin: SETTINGS.line.incrementMin, leadMinutes: SETTINGS.line.leadMinutes,
  minHours: 1, noShow: { graceMin: SETTINGS.line.noShowGraceMin }
};
const LINE_STR = {
  tileTitle: 'Line Sitting', tileSub: 'A runner waits in line for you.',
  bookTitle: 'Line Sitting',
  bookLead: "A runner waits in line and pings you when it's almost your turn. You pay your runner's hourly rate for the time you book.",
  placeLabel: 'Where is the line?', placeHint: 'Search a venue or address',
  startLabel: 'Start time', startHint: 'Choose a time at least 2 hours from now.',
  hoursLabel: 'Hours to book', rateTitle: 'Rate', rateSub: 'Each runner sets their own hourly rate. You choose one on the next screen.',
  estLabel: 'Total for your hours', estNote: "Your runner's rate for the hours you book. Nothing is added at checkout.",
  minErr: 'Book at least 1 hour.',
  termsTitle: 'Cancellation and no-show',
  cancelFree: 'Free to cancel until your runner accepts.',
  cancelAfter: 'After your runner accepts, you pay for the time already used.',
  noShow: "If you don't arrive within " + SETTINGS.line.noShowGraceMin + " minutes of being pinged, you pay for the time spent.",
  venueClosed: 'If the venue closes or cuts the line, you pay only for the time used.',
  feesAck: 'I understand the cancellation and no-show terms above.',
  rulesAck: "I've read this venue's line rules and understand I'm paying for time waited, with no promise of entry, tickets or items.",
  fine: "Runners can't promise tickets, items or entry. Venue rules apply, and some venues don't allow a swap, so you might need to join your runner in line. Unused prepaid time is refunded.",
  blockedTitle: "Line sitting isn't allowed here",
  statusTitle: 'Your runner is in line', almostTitle: "Almost your turn, head over",
  pendingTitle: 'Waiting for your runner', pendingSub: "Your request is in. We'll tell you when your runner accepts.",
  handoffTitle: 'How the handoff works',
  handoff: 'When it’s almost your turn, your runner pings you. Meet them in line, both of you check the same handoff code, then you take the spot.',
  noSwap: "If this venue doesn't allow swaps, join your runner in line instead of swapping.",
  codePending: 'Your handoff code appears here when your runner accepts.',
  runnerJob: 'Line sitting', pickTitle: 'Choose your runner', noRunners: 'No runners offer line sitting right now. Runners pick their own hours, so check back later.'
};
const LINE_BLOCKS = [
  { re: /\b(dmv|motor vehicles?)\b/i, why: 'Government service lines like the DMV must be waited in by the person being served.' },
  { re: /\b(court ?house|courts?|city hall|town hall|village hall|social security|passport|government|immigration|uscis)\b/i, types: ['courthouse', 'city_hall', 'local_government_office', 'embassy'], why: 'Line sitting isn’t available for court or government office lines.' },
  { re: /\b(shakespeare in the park|delacorte|free tickets?|ticket lottery|standby line|rush tickets?)\b/i, why: 'Free or limited ticket lines are meant for the people who wait in them.' },
  { re: /\b(raffle|limited drop|release day|sneaker drop|drop day)\b/i, why: 'Line sitting isn’t available for limited drops or raffles.' },
  { re: /\b(polling|poll site|early voting|election|board of elections|vote)\b/i, why: 'Line sitting is never available for voting or polling place lines.' },
  { re: /\b(food bank|food pantry|soup kitchen|clinic|vaccin\w*|testing site|health department|hospital|urgent care)\b/i, types: ['hospital'], why: 'Line sitting isn’t available for health or food-assistance lines.' }
];
function lineBlocked(pl) {
  const text = [pl.name, pl.addr].join(' '), types = pl.types || [];
  const b = LINE_BLOCKS.find(x => x.re.test(text) || (x.types || []).some(t => types.includes(t)));
  return b ? b.why : null;
}
const lineMoney = v => '$' + (Number.isInteger(v) ? v : v.toFixed(2));
const lineOkHours = hrs => Number.isFinite(+hrs) && +hrs >= LINE_CFG.minHours && +hrs <= LINE_CFG.capHours;
function lineEstimate(hours, r) {
  const C = LINE_CFG, hrs = Math.min(C.capHours, Math.max(C.minHours, +hours || 0)), p = r ? linePrice(r, hrs) : null;
  return { hours: p ? Math.min(C.capHours, p.hours) : hrs, capMin: (p ? Math.min(C.capHours, p.hours) : hrs) * 60, total: p ? p.total : null };
}
function lineRules(hrs, r) {
  const e = lineEstimate(hrs, r), rate = r && lineOk(r) ? r.rates.lineHourly : null, step = rate ? Math.round(rate * LINE_CFG.incrementMin / 60 * 100) / 100 : null;
  return {
    rate: rate ? lineMoney(rate) + '/hr' : 'Set by your runner',
    min: rate && r.rates.lineMin ? r.name + "'s minimum is " + r.rates.lineMin + ' hr' : '',
    extra: 'Extra time: if the line is still going at ' + e.hours + ' hr, your runner asks you first.' + (step ? ' Each extra ' + LINE_CFG.incrementMin + ' minutes is ' + lineMoney(step) + '.' : '') + ' Up to ' + LINE_CFG.capHours + ' hr in total.',
    early: 'Ending early: if you take the spot before ' + e.hours + ' hr, you pay for the time used' + (rate && r.rates.lineMin ? ', never less than your runner\'s ' + r.rates.lineMin + '-hour minimum' : '') + '. Unused prepaid time is refunded.'
  };
}
const lineOffers = hrs => Object.values(S.runners || {}).filter(r => runnerReady(r) && lineOk(r)).map(r => ({ id: r.id, name: r.name, online: !!r.online, rating: r.rating || null, jobs: r.jobs || 0, price: linePrice(r, Math.min(LINE_CFG.capHours, +hrs)).total, min: r.rates.lineMin || 0 }));
let lnTimer = 0, lnSeq = 0;
const LN = {
  screens: ['line', 'lineReview', 'lineStatus'],
  hoursLabel: m => { const hh = Math.floor(m / 60), mm = m % 60; return (hh ? hh + ' hr' : '') + (hh && mm ? ' ' : '') + (mm ? mm + ' min' : ''); },
  open() { S.c.ln = S.c.ln || { q: '', res: [], place: null, blocked: null, start: '', hours: LINE_CFG.defaultHours, rules: false, fees: false }; S.c.screen = S.line && S.line.status !== 'ended' ? 'lineStatus' : 'line'; Maps.ensure(); R(); },
  go(sc) { S.c.screen = sc; R(); },
  newCode() { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(a[0] % 10000).padStart(4, '0'); },
  shell(sc) {
    const t = sc === 'line' ? LINE_STR.bookTitle : sc === 'lineReview' ? 'Review' : LINE_STR.tileTitle;
    return `<div class="lnwrap"><div class="page notab" data-scroll="pg-${sc}"><div class="navbar solid"><div class="nl"><button class="backbtn" id="navBack">${icon('chevL')}Back</button></div><div class="nt" id="navT"></div></div><h1 class="lt" id="lnTitle"></h1><div class="page-body" id="lnBody"></div></div><div class="lnfoot" id="lnFoot"></div></div>`;
  },
  mount() {
    const sc = S.c.screen; if (S.view !== 'c' || !LN.screens.includes(sc)) return;
    const title = sc === 'line' ? LINE_STR.bookTitle : sc === 'lineReview' ? 'Review' : LINE_STR.tileTitle;
    $('#navT').textContent = title; $('#lnTitle').textContent = title;
    $('#navBack').onclick = () => { S.c.screen = sc === 'lineReview' ? 'line' : 'home'; R(); };
    if (sc === 'line') LN.book(); else if (sc === 'lineReview') LN.review(); else LN.status();
  },
  book() {
    const F = S.c.ln, b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    b.append(h('p', { class: 'sub sec', text: LINE_STR.bookLead }));
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
    const min = new Date(Date.now() + LINE_CFG.leadMinutes * 60000); min.setSeconds(0, 0);
    const pad = n => String(n).padStart(2, '0'), local = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const st = h('input', { id: 'lnStart', class: 'input', type: 'datetime-local', min: local(min), 'aria-label': LINE_STR.startLabel }); st.value = F.start;
    st.addEventListener('change', () => { F.start = st.value; LN.book(); });
    const opts = []; for (let m = LINE_CFG.minHours * 60; m <= LINE_CFG.capHours * 60; m += LINE_CFG.incrementMin) opts.push(m / 60);
    const hs = h('select', { id: 'lnHours', class: 'whensel', 'aria-label': LINE_STR.hoursLabel }, opts.map(v => { const o = h('option', { value: v, text: LN.hoursLabel(v * 60) }); o.selected = v === +F.hours; return o; }));
    hs.addEventListener('change', () => { F.hours = +hs.value; LN.book(); });
    b.append(h('div', { class: 'group-h', text: 'When' }), h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.startLabel }), h('div', { class: 'subt', text: LINE_STR.startHint })), st),
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.hoursLabel })), hs),
      h('div', { class: 'cell', id: 'lnRate' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: LINE_STR.rateTitle }), h('div', { class: 'subt', text: LINE_STR.rateSub })))));
    b.append(h('div', { class: 'group-h', text: LINE_STR.termsTitle }), h('div', { class: 'group terms', id: 'lnTerms' },
      ...[LINE_STR.cancelFree, LINE_STR.cancelAfter, LINE_STR.noShow, LINE_STR.venueClosed].map(t => h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: t })))));
    b.append(LN.check('lnFees', LINE_STR.feesAck, F.fees, v => { F.fees = v; }), LN.check('lnRules', LINE_STR.rulesAck, F.rules, v => { F.rules = v; }));
    b.append(h('p', { class: 'fn note', text: LINE_STR.fine }));
    const ok = F.start && new Date(F.start) >= new Date(Date.now() + (LINE_CFG.leadMinutes - 1) * 60000) && lineOkHours(F.hours) && F.rules && F.fees;
    foot.append(h('button', { class: 'btn', id: 'lnReview', disabled: !ok, text: 'Choose a runner', on: { click: () => { S.c.screen = 'lineReview'; R(); } } }));
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
  review() {
    const F = S.c.ln; if (!F || !F.place || F.blocked) { S.c.screen = 'line'; R(); return; }
    const b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    const offers = rankOffers(lineOffers(F.hours), S.c.sort || 'distance', F.place), pick = offers.find(o => o.id === F.runner) || null, r = pick && S.runners[pick.id];
    const when = new Date(F.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    b.append(h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: F.place.name }), h('div', { class: 'subt', text: F.place.addr }))),
      h('div', { class: 'cell' }, h('div', { class: 'grow title', text: 'Starts' }), h('div', { class: 'acc', text: when })),
      h('div', { class: 'cell' }, h('div', { class: 'grow title', text: LINE_STR.hoursLabel }), h('div', { class: 'acc', text: LN.hoursLabel(F.hours * 60) }))));
    b.append(h('div', { class: 'group-h', text: LINE_STR.pickTitle }), runnerPicker(offers, F.runner, id => { if (F.runner !== id) F.agree = false; F.runner = id; LN.review(); }, LINE_STR.noRunners, () => LN.review()));
    if (r) {
      const e = lineEstimate(F.hours, r), rules = lineRules(F.hours, r);
      b.append(h('div', { class: 'pbox', id: 'lnRevEst' }, LN.row(LINE_STR.estLabel + ' (' + LN.hoursLabel(e.capMin) + ')', money(e.total), 1), h('p', { class: 'fn', text: rules.rate + (rules.min ? ' · ' + rules.min : '') }), h('p', { class: 'fn', text: rules.extra }), h('p', { class: 'fn', text: rules.early })),
        h('p', { class: 'fn note', text: 'An upfront quote from the runner you pick. ' + LINE_STR.estNote }),
        jobAgreement(lineContract(F, r, e)));
      const pm = S.pay.method;
      b.append(h('div', { class: 'group' }, pm
        ? h('div', { class: 'cell' }, h('div', { class: 'grow title', text: 'Payment' }), h('div', { class: 'acc', id: 'lnPay', text: pm.label + ' · Demo only' }))
        : h('button', { type: 'button', class: 'cell tap', id: 'lnPayAdd', on: { click: () => { C.useTestMethod(); } } }, h('span', { class: 'grow title', text: 'Payment' }), h('span', { class: 'acc', text: 'Add test card · Demo only' }))));
      if (pm) {
        const box = h('input', { type: 'checkbox', id: 'lnConsent' }); box.checked = !!F.agree;
        box.addEventListener('change', () => { F.agree = box.checked; const k = $('#lnBook'); if (k) k.disabled = !box.checked; });
        b.append(h('label', { class: 'ack', for: 'lnConsent' }, box, h('span', { class: 'fn', text: lineAgreeText(pick.name, e.total) })));
      }
    }
    b.append(h('p', { class: 'fn note', text: LINE_STR.fine }));
    foot.append(h('button', { class: 'btn', id: 'lnBook', disabled: !r || (!!S.pay.method && !F.agree), text: !r ? 'Choose a runner' : !S.pay.method ? 'Add a test card' : 'Request ' + pick.name + ' · ' + money(lineEstimate(F.hours, r).total), on: { click: LN.book_ } }));
  },
  book_() {
    if (!AU.require()) return;
    const F = S.c.ln; if (!F || !F.place || lineBlocked(F.place)) { toast(F && F.place ? lineBlocked(F.place) : 'Choose where the line is.'); return; }
    if (!lineOkHours(F.hours)) { toast(LINE_STR.minErr); return; }
    const r = F.runner && S.runners[F.runner]; if (!r || !runnerReady(r) || !lineOk(r)) { toast('Choose a runner first.'); return; }
    if (!S.pay.method) { C.useTestMethod(); return; }
    if (!F.agree) { toast('Check the box to agree to the job agreement first'); return; }
    const e = lineEstimate(F.hours, r); haptic();
    S.line = { id: 'L' + Date.now().toString(36), runner: r.id, runnerName: r.name, place: { ...F.place }, start: F.start, startLabel: new Date(F.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }), hours: e.hours, capMin: e.capMin, est: e, rate: r.rates.lineHourly, status: 'requested', relief: false, code: null, contract: lineContract(F, r, e), consent: { text: lineAgreeText(r.name, e.total), version: 'job-v1', at: new Date().toISOString() } };
    toast('Requested. ' + r.name + ' can accept or decline. Nothing is billed in test mode.');
    notify('r', 'New line sitting request at ' + F.place.name, 'drive', r.id);
    S.c.ln = null; S.c.screen = 'lineStatus'; R();
  },
  cancel() { const L = S.line; const free = L && L.status === 'requested'; S.line = null; S.c.screen = 'home'; R(); toast(free ? 'Cancelled. No charge.' : 'Cancelled. You pay only for the time already used.'); },
  status() {
    const L = S.line, b = $('#lnBody'), foot = $('#lnFoot'); b.replaceChildren(); foot.replaceChildren();
    if (!L) { b.append(h('div', { class: 'estate' }, h('div', { class: 'hl', text: 'No line sitting booked' }), h('p', { class: 'sub sec', text: 'Book line sitting to see it here.' }))); return; }
    const pending = L.status === 'requested', declined = L.status === 'declined';
    if (declined) { b.append(h('div', { class: 'statuscard', id: 'lnStatus' }, h('div', { class: 'eta', text: L.runnerName + " can't take this one" }), h('p', { class: 'sub sec', text: 'No charge. Choose another runner for the same time.' })));
      foot.append(h('button', { class: 'btn', id: 'lnRepick', text: 'Choose another runner', on: { click: () => { S.c.ln = { q: '', res: [], place: L.place, blocked: null, start: L.start, hours: L.hours, rules: true, fees: true, runner: null }; S.line = null; S.c.screen = 'lineReview'; R(); } } }));
      return; }
    const head = pending ? LINE_STR.pendingTitle : L.status === 'almost' ? LINE_STR.almostTitle : L.status === 'ended' ? 'Line sitting ended' : new Date(L.start).getTime() > Date.now() ? 'Accepted · starts ' + L.startLabel : LINE_STR.statusTitle;
    b.append(h('div', { class: 'statuscard', id: 'lnStatus' }, h('div', { class: 'eta', text: head }), h('p', { class: 'sub sec', text: (pending ? LINE_STR.pendingSub : L.place.name + ' · ' + L.startLabel) + ' Runner: ' + L.runnerName + '.' }),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + (pending ? 4 : L.status === 'almost' ? 90 : 50) + '%' }))));
    b.append(h('div', { class: 'group-h', text: LINE_STR.handoffTitle }), h('div', { class: 'group' },
      h('div', { class: 'cell' }, h('div', { class: 'grow' }, h('div', { class: 'title', text: 'Handoff code' }), h('div', { class: 'subt', text: L.code ? 'Show this to your runner. They see the same code.' : LINE_STR.codePending })), L.code ? h('div', { class: 'acc num code', text: L.code }) : null),
      h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: LINE_STR.handoff })),
      h('div', { class: 'cell' }, h('div', { class: 'grow sub', text: LINE_STR.noSwap }))));
    b.append(h('div', { class: 'pbox' }, LN.row(LINE_STR.estLabel, money(L.est.total), 1)), h('p', { class: 'fn note', text: 'Upfront quote from ' + L.runnerName + '. Test mode: no money moves.' }));
    if (L.contract) b.append(jobAgreement(L.contract));
    foot.append(h('button', { class: 'btn gray', id: 'lnCancel', text: L.status === 'requested' ? 'Cancel request' : 'Cancel line sitting', on: { click: LN.cancel } }));
  }
};
const lineAgreeText = (name, total) => 'I agree to the job agreement with ' + name + ' and the Terms, and I authorize a hold of ' + money(total) + '. Demo only: nothing is billed.';
