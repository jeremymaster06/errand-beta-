'use strict';
const ORD = {
  isStandaloneDropoff: stops => stops.length > 0 && stops.some(s => s.type === 'Drop-off') && stops.every(s => s.type === 'Drop-off' || s.type === 'Personal pickup'),
  modes: () => [['scheduled', 'Scheduled'], ['flex', 'Flexible'], ['asap', 'ASAP']],
  phase(t) {
    if (!t) return null;
    if (t.status === 'delivered') return 'delivered';
    if (t.status !== 'accepted') return 'matching';
    const n = (t.stops || []).length, st = +t.step || 0, tm = Array.isArray(t.times) ? t.times : [];
    if (st >= n && n) return 'on_the_way';
    return st === 0 && !(tm[0] && tm[0].arrive) ? 'accepted' : 'shopping';
  },
  PHASE_LABEL: { matching: 'Waiting for your runner', accepted: 'Accepted', shopping: 'Shopping', on_the_way: 'On the way', delivered: 'Delivered' },
  phaseLabel: t => ORD.PHASE_LABEL[ORD.phase(t)] || '',
  migrate(d) {
    if (!d || typeof d !== 'object') return d;
    const t = d.trip;
    if (t && typeof t === 'object' && !t.runner) { const st = Array.isArray(t.stops) ? t.stops : []; d.trip = { id: t.id || 'T0', status: 'declined', step: 0, runner: null, runnerName: '', price: 0, total: 0, at: t.at || Date.now(), stops: st, q: { route: { order: st.map((_, i) => i), miles: 0 }, timing: 'scheduled', cap: 0, goods: 0, miles: 0, eta: 0 }, dest: t.dest || null, chat: [], proof: [], times: [], counter: null, contract: '' }; }
    else if (t && typeof t === 'object') { if (!['matching', 'accepted', 'delivered', 'declined'].includes(t.status)) t.status = t.status === 'done' ? 'accepted' : 'matching'; if (t.status === 'accepted' && !Array.isArray(t.times)) t.times = (t.stops || []).map(() => ({})); if (t.status === 'accepted' && typeof t.step !== 'number') t.step = 0; }
    if (!Array.isArray(d.history)) d.history = [];
    return d;
  },
  mode: (stops, wanted) => ORD.modes(stops).some(([m]) => m === wanted) ? wanted : 'scheduled',
  flexWindow(now = Date.now()) {
    const T = SETTINGS.timing, half = 30 * 60000, start = Math.ceil((now + T.flexLeadMin * 60000) / half) * half;
    return { start, end: start + T.flexWindowHours * 3600000 };
  },
  windows(now = Date.now()) {
    const out = [], hr = t => +new Date(t).toLocaleString('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/New_York' });
    let t = Math.ceil((now + 2 * 3600000) / 3600000) * 3600000;
    for (let i = 0; i < 120 && out.length < SETTINGS.timing.windowCount; i++, t += 3600000) if (SETTINGS.timing.windowStarts.includes(hr(t))) out.push([String(t), ORD.winLabel(t, now)]);
    return out;
  },
  pickWhen(v, now = Date.now()) { const w = ORD.windows(now); return (w.find(x => x[0] === String(v)) || w[0])[0]; },
  winLabel(t, now = Date.now()) {
    const day = x => new Date(x).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }), d = day(t);
    const name = d === day(now) ? 'Today' : d === day(now + 86400000) ? 'Tomorrow' : new Date(t).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    const a = ORD.fmtTime(t), b = ORD.fmtTime(t + SETTINGS.timing.windowHours * 3600000);
    return name + ' ' + (a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a) + '–' + b;
  },
  fmtTime: ts => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }),
  windowLabel(q, w) {
    if (q.timing === 'flex') return ORD.fmtTime(w.start) + '–' + ORD.fmtTime(w.end);
    if (q.timing === 'scheduled') return +q.when ? ORD.winLabel(+q.when) : 'Scheduled';
    return 'ASAP';
  },
  flexLine(q, w) { return 'Flexible. You ask for ' + ORD.fmtTime(w.start) + '–' + ORD.fmtTime(w.end) + ' and your runner confirms when they accept.'; },
  timeNote: { scheduled: 'Requested time. Your runner confirms when they accept.', flex: 'Your runner fits it in within the time you ask for, if they accept.', asap: 'As soon as your runner can. They tell you their arrival time when they accept.' }
};
if (typeof module !== 'undefined') module.exports = { ORD };
