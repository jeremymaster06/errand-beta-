const PricingEngine = (function () {
  const DEF = { stops: 3, basket_per_stop: 50, staffing: 'gig', pay_basis: 'engaged', gig_rate: 25, gig_util: 0.85, mileage_rate: 0.76, tip: 0, perk: 'none', trips_wk: 20, maps_per_order: 0, insurance_monthly: 127.33, fixed_monthly: 559.58, startup_total: 3750, startup_months: 12, cac: 10, lifetime_orders: 24, support_min: 3, support_rate: 20, refund_rate: 0.02, refund_avg: 20, dispute_rate: 0.003, dispute_fee: 15, target_margin: 0.15, price_override: null, stop_list: null, drive_minutes: null, dropoff: 'house', mph: 19.5, weather: 'none', park_find_min: 3, tolls: 0, busy_fee: 0, busy_fee_cap: 3, cc_per_min: 0.42, store_comm_pct: 0, member_price: 0, member_discount: 0, member_trips: 0, batch_share: 0, batch_saving: 0.20, trips_per_paid_hr: null };
  const DWELL = { pickup: 3.4, pharmacy: 7, 'return': 6, post_office: 5, house: 2, apartment: 8 }, WX = { none: 1, rain: 1.15, snow: 1.40 }, PERK = { none: 0, one_free_wk: 0.002, all: 0.01 };
  const stopMin = st => st.type === 'grocery' ? Math.max(0, st.items ?? 15) * (st.min_per_item ?? 1) + (st.queue ?? 4) : st.minutes != null ? +st.minutes : DWELL[st.type];
  const r = x => { const s = x < 0 ? -1 : 1; return s * Math.floor(Math.abs(x) * 100 + 0.5 + 1e-7) / 100; };
  function quote(kw) {
    const p = Object.assign({}, DEF, kw); let n, mins, miles;
    if (p.stop_list && p.stop_list.length) { n = p.stop_list.length; miles = +(p.miles || (3 + 1.5 * n)); mins = p.stop_list.reduce((a, x) => a + stopMin(x) + +p.park_find_min, 0) + DWELL[p.dropoff] + (p.drive_minutes != null ? +p.drive_minutes : miles / p.mph * 60) * WX[p.weather]; }
    else { n = +p.stops; mins = 15 + 12 * n; miles = 3 + 1.5 * n; }
    mins = Math.floor(mins * 1000 + 0.5 + 1e-7) / 1000;
    if (p.trips_per_paid_hr != null) p.gig_util = Math.min(1, Math.floor(p.trips_per_paid_hr * mins / 60 * 10000 + 0.5 + 1e-7) / 10000);
    const gu = +p.gig_util;
    let gw = p.staffing === 'contractor_hc' ? r(p.cc_per_min * mins) : p.pay_basis === 'engaged' ? r(p.gig_rate * mins / 60) : r(p.gig_rate * mins / 60 / gu);
    const pre = gw; gw = Math.max(gw, r(17 * mins / 60 / gu)); const topup = r(gw - pre);
    const bf = 1 - Math.min(Math.max(+p.batch_share, 0), 1) * p.batch_saving; gw = r(gw * bf);
    const wage = r(gw), mileage = r(r(miles * p.mileage_rate) * bf), tip = r(+p.tip), gp = gw + mileage;
    const connect = r(0.0025 * gp + 0.25 / 20 + 2 / (20 * 4.33)), instant = r(gp * PERK[p.perk]);
    const basket = r(n * p.basket_per_stop), sb = r(0.029 * basket + 0.30 + 0.10 * n), V = +p.trips_wk, ins = r(p.insurance_monthly / (V * 4.33)), maps = r(+p.maps_per_order);
    const variable = r(wage + mileage + connect + instant + sb + ins + maps);
    let price = p.price_override != null && p.price_override !== '' ? +p.price_override : Math.ceil(variable / (1 - 0.029) / (1 - p.target_margin) - 1e-9);
    const busy = r(Math.min(+p.busy_fee, +p.busy_fee_cap)), tolls = r(+p.tolls); price = r(price + busy);
    const sf = r(0.029 * (price + tip + tolls)), comm = r(Math.min(Math.max(+p.store_comm_pct, 0), 0.10) * basket), mv = r(price - variable - sf + comm), mnet = r((p.member_trips > 0 ? r(p.member_price / p.member_trips) : 0) - r(+p.member_discount));
    const fixed = r(p.fixed_monthly / (V * 4.33)), startup = r(p.startup_total / (V * 4.33 * p.startup_months)), cac = r(p.cac / p.lifetime_orders);
    const support = r(p.support_min / 60 * p.support_rate), refunds = r(p.refund_rate * p.refund_avg), disputes = r(p.dispute_rate * (p.dispute_fee + price + tip + basket));
    const allin = r(variable + sf + fixed + startup + cac + support + refunds + disputes), rt = r(wage + mileage + tip);
    return { minutes: Math.floor(mins * 10 + 0.5 + 1e-7) / 10, tolls, busy_fee: busy, miles, runner_wage: wage, mileage, tip, connect, instant_perk: instant, basket, stripe_on_basket: sb, insurance: ins, maps, variable_cost: variable, price, stripe_on_fee: sf, margin_variable: mv, fixed, startup, cac, support, refunds, disputes, allin_cost: allin, margin_allin: r(price - allin + comm), store_commission: comm, member_net_per_trip: mnet, margin_allin_member: r(price - allin + comm + mnet), customer_total: r(price + tip + basket + tolls), runner_total: rt, runner_per_engaged_hr: r(rt * 60 / mins), runner_per_logged_hr: r(rt * 60 * gu / mins), topup, runner_per_paid_hr: r(rt * 60 * gu / mins) };
  }
  return { quote, DEF };
})();
if (typeof module !== 'undefined') module.exports = PricingEngine;
