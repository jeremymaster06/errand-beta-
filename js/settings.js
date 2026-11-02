'use strict';
const jobRange = T => T.max == null ? T.min + ' or more jobs' : (T.min ? T.min + ' to ' + T.max : 'up to ' + T.max) + ' jobs';
const SETTINGS = {
  pricing: {
    engine: {},
    capPadPct: 20
  },
  line: {
    capHours: 12, incrementMin: 15, leadMinutes: 120, defaultHours: 2,
    noShowGraceMin: 15
  },
  timing: {
    flexWindowHours: 3, flexLeadMin: 30, flexBatchShare: 1,
    windowStarts: [8, 10, 12, 14, 16, 18], windowHours: 2, windowCount: 8
  },
  rates: {
    fields: [
      ['base', 'Errand, up to 3 stops', '$ per errand'],
      ['extraStop', 'Each extra stop', '$ per stop'],
      ['bigShop', 'Big grocery shop, 1 store', '$ per shop'],
      ['asap', 'ASAP surcharge', '$ per errand'],
      ['lineHourly', 'Line sitting', '$ per hour'],
      ['lineMin', 'Line sitting minimum', 'hours']
    ]
  },
  areas: [['gnp', 'Great Neck Plaza', 40.7932, -73.7352], ['gne', 'Great Neck Estates', 40.7870, -73.7390], ['man', 'Manhasset', 40.7979, -73.6996], ['pw', 'Port Washington', 40.8257, -73.6982]],
  plan: {
    label: 'Placeholder pricing', pilotJobs: 30, pilotWeeks: 6,
    tiers: [
      { key: 'starter', name: 'Starter', price: 25, min: 0, max: 15, cashouts: 0 },
      { key: 'regular', name: 'Regular', price: 75, min: 16, max: 50, cashouts: 0 },
      { key: 'pro', name: 'Pro', price: 125, min: 51, max: null, cashouts: 2 }
    ]
  },
  payouts: {
    weeklyDay: 5, minActiveDays: 14,
    weekly: 'Weekly payouts are always free.',
    pro: 'Pro plan includes 2 free instant cash-outs a month (eligibility applies). Weekly payouts are always free.',
    eligibility: 'Instant cash-outs need at least 14 days active and no unresolved chargebacks. Never tied to ratings, acceptance or hours.'
  },
  subscription: {
    version: 'sub-v4',
    disclosure: (P, T) => 'Free pilot: your first ' + P.pilotJobs + ' jobs or ' + P.pilotWeeks + ' weeks, whichever comes first. After that, ' + T.name + ' is $' + T.price + ' a month for ' + jobRange(T) + ', billed to your card separately each month. Never taken from your payouts. No commission and no per-job fees. ' + (T.cashouts ? SETTINGS.payouts.pro : SETTINGS.payouts.weekly) + ' If you go over your plan’s jobs in a month, we offer an upgrade you can accept or decline. We never charge you automatically. Change plan or cancel anytime in Account > Subscription.',
    consent: (P, T) => 'I choose ' + T.name + ': free for my first ' + P.pilotJobs + ' jobs or ' + P.pilotWeeks + ' weeks, then $' + T.price + ' a month for ' + jobRange(T) + ', billed to my card until I change or cancel.',
    change: (T, F) => 'I switch from ' + F.name + ' to ' + T.name + ': $' + T.price + ' a month for ' + jobRange(T) + ', billed to my card until I change or cancel.'
  },
  card: { pct: 0.029, fixed: 0.30 },
  tips: [0, 3, 5, 8],
  tiles: {
    postMaxDeclaredValue: 500, maxItemValue: 1000, claimDays: 14
  },
  planNote: 'Everyone gets the same app and the same listing. Nothing you pay changes how customers find or rank you.'
};
if (typeof module !== 'undefined') module.exports = { SETTINGS, jobRange };
