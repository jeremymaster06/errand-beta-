/* SETTINGS: the one place for every customer price input and runner pay rate. UI code reads from here;
 * no price or rate is hard-coded in screens. Adam's per-minute pricing drops in under SETTINGS.pricing.engine
 * (passed as inputs to the unmodified engine). There is NO minimum trip fee (Jeremy rejected $54).
 * Prototype estimates only: the server sets and verifies the final price. */
'use strict';
const SETTINGS = {
  pricing: {
    engine: {},              // overrides for PricingEngine inputs (empty = engine spec defaults)
    capPadPct: 20            // spending-cap buffer (%) above the item estimate
  },
  line: {                    // Hold My Spot. Rates PENDING JEREMY (Adam is remodeling vs a $50 / 2 h competitor)
    pending: 'Pending Jeremy',
    bookingFee: 15, hourly: 40, minHours: 2, capHours: 12,   // capHours: most hours one booking can run
    defaultHours: 2, incrementMin: 15, leadMinutes: 120,
    noShowGraceMin: 15, noShowFee: 3
  },
  dropoff: {                 // standalone drop-off (no store stop). Price PENDING JEREMY (Adam: $29 to clear break-even)
    pending: 'Pending Jeremy', standalonePrice: 29
  },
  timing: {                  // checkout timing. A flexible window lets dispatch batch the order (engine batch_share)
    pending: 'Pending Jeremy', flexWindowHours: 3, flexLeadMin: 30, flexBatchShare: 1,
    scheduledWindows: [['today5', 'Today 5:00–7:00 PM'], ['sat10', 'Sat 10:00 AM–12:00 PM'], ['sun9', 'Sun 9:00–11:00 AM']]
  },
  courier: {                 // courier handoff: OFF, demo only. No partner contract exists (Lex, Oct 25)
    enabled: false,          // never true until a written contract names customer-to-customer drop-offs
    partner: 'Partner Courier (demo)', fee: 10, valueCap: 100, maxLb: 50,
    banned: [                // matched on item names/notes; weight and value are checked from the item fields
      { id: 'alcohol', label: 'Alcohol', re: '\\b(alcohol|beer|wine|liquor|vodka|whiskey|tequila|rum|gin|champagne|hard seltzer)\\b' },
      { id: 'rx', label: 'Prescriptions', re: '\\b(prescriptions?|rx|medications?)\\b' },
      { id: 'age', label: 'Age-restricted items', re: '\\b(tobacco|cigars?|cigarettes?|vapes?|e-?cig\\w*|nicotine|cannabis|lottery|firearms?|ammo|ammunition)\\b' },
      { id: 'giftcard', label: 'Gift cards', re: '\\bgift ?cards?\\b' }
    ]
  },
  claims: {                  // reliability claims (Lex): only true claims are on. Off claims show as "pending" in the prototype only
    prototype: true,
    list: [
      { id: 'w2', text: 'W-2 runners', on: true },
      { id: 'tracking', text: 'Live tracking during your sit', on: true },
      { id: 'insured', text: 'Insured', on: false },   // on only once the policies are bought
      { id: 'vetted', text: 'Vetted', on: false }      // on only once background checks are running
    ]
  },
  tiles: {                   // final (Lex, Oct 25)
    postMaxDeclaredValue: 500, cleaningCoverCap: 300, maxItemValue: 1000, claimDays: 14, weeklyPriceNoticeDays: 7
  },
  pay: {                     // runner pay: Proposed, pending Jeremy
    perTrip: 10, perStop: 2, waitRate: 0.30, waitGraceMin: 5, lineRate: 0.30, baseHourly: 17, otAfterHours: 40, otFactor: 1.5
  }
};
if (typeof module !== 'undefined') module.exports = { SETTINGS };
