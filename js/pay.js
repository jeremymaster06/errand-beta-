/* Runner pay (W-2 hourly model). Pure math, shared by the runner app, owner app and node tests.
 * Every PAY_CFG rate is Proposed, pending Jeremy. Hours = full shift clock-in to clock-out, idle time included.
 * Tips are separate, 100% to the runner, and never count toward the top-up or the overtime regular rate. Prototype only: production computes pay on the server. */
'use strict';
const PAY_CFG = (typeof SETTINGS !== 'undefined' ? SETTINGS : require('./settings.js').SETTINGS).pay; // rates live in js/settings.js
const PAY = {
  r2: v => Math.round(v * 100) / 100,
  /* waits: minutes waited at each stop (arrive -> start). */
  stopWaitMin: w => Math.max(0, (+w || 0) - PAY_CFG.waitGraceMin),
  trip(waits) {
    const n = waits.length, wm = waits.reduce((a, w) => a + PAY.stopWaitMin(w), 0);
    return { base: PAY_CFG.perTrip, stops: n * PAY_CFG.perStop, wait: PAY.r2(wm * PAY_CFG.waitRate), waitMin: wm, total: PAY.r2(PAY_CFG.perTrip + n * PAY_CFG.perStop + wm * PAY_CFG.waitRate) };
  },
  line(waitedMin, bookedMin) { const m = Math.max(0, Math.min(+waitedMin || 0, +bookedMin || 0)); return { min: m, total: PAY.r2(m * PAY_CFG.lineRate) }; },
  /* trips: [{ waits:[min..] }], lines: [{ waited, booked }], bonuses: [{ label, amt }], tips: [amt], hours: full clocked shift hours */
  week({ trips = [], lines = [], bonuses = [], tips = [], hours = 0 }) {
    const C = PAY_CFG, stops = trips.reduce((a, t) => a + t.waits.length, 0);
    const waitMin = trips.reduce((a, t) => a + t.waits.reduce((b, w) => b + PAY.stopWaitMin(w), 0), 0);
    const lineMin = lines.reduce((a, l) => a + PAY.line(l.waited, l.booked).min, 0);
    const rows = [
      { label: 'Trips', rate: C.perTrip, unit: 'trip', count: trips.length },
      { label: 'Stops', rate: C.perStop, unit: 'stop', count: stops },
      { label: 'Stop wait (after ' + C.waitGraceMin + ' min)', rate: C.waitRate, unit: 'min', count: waitMin },
      { label: 'Line-sit', rate: C.lineRate, unit: 'min', count: lineMin }
    ].map(r => ({ ...r, amt: PAY.r2(r.rate * r.count) }));
    const piece = PAY.r2(rows.reduce((a, r) => a + r.amt, 0)), bonus = PAY.r2(bonuses.reduce((a, b) => a + (+b.amt || 0), 0));
    const topUp = PAY.r2(Math.max(0, C.baseHourly * hours - piece));       // minimum-wage guarantee
    const straight = PAY.r2(piece + bonus + topUp);
    const regRate = hours > 0 ? straight / hours : 0;                       // regular rate includes piece pay, bonuses and top-up
    const otHours = Math.max(0, hours - C.otAfterHours);
    const ot = PAY.r2(otHours * regRate * (C.otFactor - 1));               // premium half-time on the regular rate
    const tip = PAY.r2(tips.reduce((a, t) => a + (+t || 0), 0));             // separate line, excluded from top-up and OT
    return { rows, piece, bonus, bonuses, topUp, hours, regRate: PAY.r2(regRate), otHours, ot, tips: tip, wages: PAY.r2(straight + ot), total: PAY.r2(straight + ot + tip) };
  }
};
if (typeof module !== 'undefined') module.exports = { PAY, PAY_CFG };
