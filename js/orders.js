/* Order rules shared by the customer and owner apps and the node tests: standalone drop-offs, checkout timing
 * windows, courier-handoff eligibility and reliability claims. Pure logic, no DOM. Every number comes from
 * js/settings.js. PROTOTYPE: the server re-checks all of this before it charges or dispatches anything. */
'use strict';
const ORD = {
  /* A standalone drop-off: only personal pickups and drop-offs (at least one drop-off), no store purchase. */
  isStandaloneDropoff: stops => stops.length > 0 && stops.some(s => s.type === 'Drop-off') && stops.every(s => s.type === 'Drop-off' || s.type === 'Personal pickup'),
  /* Timing modes offered at checkout. ASAP is never offered for a standalone drop-off. */
  modes: stops => [['asap', 'ASAP'], ['scheduled', 'Scheduled'], ['flex', 'Flexible']].filter(([m]) => m !== 'asap' || !ORD.isStandaloneDropoff(stops)),
  mode: (stops, wanted) => ORD.modes(stops).some(([m]) => m === wanted) ? wanted : 'scheduled',
  /* Flexible window: starts at the next half hour after the lead time and lasts flexWindowHours. */
  flexWindow(now = Date.now()) {
    const T = SETTINGS.timing, half = 30 * 60000, start = Math.ceil((now + T.flexLeadMin * 60000) / half) * half;
    return { start, end: start + T.flexWindowHours * 3600000 };
  },
  fmtTime: ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }),
  windowLabel(q, w) {
    if (q.timing === 'flex') return ORD.fmtTime(w.start) + '–' + ORD.fmtTime(w.end);
    if (q.timing === 'scheduled') { const s = SETTINGS.timing.scheduledWindows.find(x => x[0] === q.when) || SETTINGS.timing.scheduledWindows[0]; return s[1]; }
    return 'ASAP';
  },
  /* Checkout line for the flexible window. X is the real ASAP-minus-flexible difference for this same order. */
  flexLine(q, w) {
    const when = 'Arrives between ' + ORD.fmtTime(w.start) + ' and ' + ORD.fmtTime(w.end) + '.';
    return q.flexSave > 0 ? 'Flexible window: save ' + money(q.flexSave) + '. ' + when : 'Flexible window. ' + when;
  },
  /* Courier handoff (demo only). Returns { ok, reason }. */
  courierCheck(job) {
    const K = SETTINGS.courier;
    if (!job || job.kind === 'line') return { ok: false, reason: 'Line-sits stay with our runners.' };
    const stops = job.stops || [];
    if (stops.some(s => TYPES[s.type] && TYPES[s.type].store)) return { ok: false, reason: 'Has a store purchase. Only standalone drop-offs can go to a courier.' };
    if (!ORD.isStandaloneDropoff(stops)) return { ok: false, reason: 'Only standalone drop-offs can go to a courier.' };
    for (const s of stops) {
      const text = [s.note].concat(s.items.map(i => i.n)).join(' ');
      const hit = K.banned.find(b => new RegExp(b.re, 'i').test(text));
      if (hit) return { ok: false, reason: hit.label + ' can’t go to a courier.' };
      if ((+s.lb || 0) > K.maxLb) return { ok: false, reason: 'Items over ' + K.maxLb + ' lb can’t go to a courier.' };
      if ((+s.value || 0) > K.valueCap) return { ok: false, reason: 'Items worth over ' + money(K.valueCap) + ' can’t go to a courier.' };
    }
    return { ok: true, reason: '' };
  },
  courierNote: partner => 'This delivery is carried by our partner, ' + partner + '. Your price doesn’t change. We share your name, drop-off address and phone with them only to complete it.',
  /* Reliability claims: on claims as written; off claims only in the prototype, labeled pending. */
  claims: () => { const C = SETTINGS.claims; return C.list.filter(c => c.on || C.prototype).map(c => c.on ? c.text : c.text + ' (pending)'); }
};
if (typeof module !== 'undefined') module.exports = { ORD };
