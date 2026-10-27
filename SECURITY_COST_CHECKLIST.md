# Security & cost checklist

## Done (client)
- [x] No HTML built from user or API strings: all new UI uses createElement/textContent. Legacy templates pass every dynamic string through `esc()`. innerHTML is used only for static icon SVG and escaped templates (audited).
- [x] Strict CSP meta: `script-src 'self' https://maps.googleapis.com`, **`script-src-attr 'none'`** (no inline handlers at all), `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `upgrade-insecure-requests`. `style-src 'unsafe-inline'` stays (Google Maps injects inline styles; styles can't run script).
- [x] No third-party scripts besides Google Maps. HTTPS only. `referrer` policy set.
- [x] No secrets client-side; the referrer- and API-restricted Maps key is the only one.
- [x] Playwright: zero console errors and zero CSP violations across light, dark, 320–430 px and desktop.
- [x] Cost: 3-char/300 ms autocomplete, session tokens, field masks, caching, lazy Maps load, routes only once stops are final, with results cached.
- [x] New customer flow (trip sheet → Review & pay → Tracking): stop rows, store sheet, cart and stop details are built with createElement/textContent. An e2e test types `<img src=x onerror=…>` into a stop and checks that it renders as text.
- [x] Routes is called once, when Review opens, and never while stops are being edited. Revisits use the cache. Place Details is called once per pick, with field mask `displayName,formattedAddress,location,types`. Geocoding is called only for a typed-address pick.
- [x] Live check (Oct 23, 2026): 0 CSP violations, `gm_authFailure` never fired, and the bad-key fallback works.
- [ ] `frame-ancestors` / HSTS can't be set from a meta tag on GitHub Pages; add them as headers once there is a real host or CDN.

## Shield review fixes (Oct 24, 2026, per /workspace/security/errand_threat_model.md)
- [x] F3/F5: every inline `onclick`/`onchange`/`onkeydown` removed (66). Templates emit `data-act` + escaped JSON `data-args`; one delegated listener (`wireActions` in js/app.js) runs only allowlisted actions on `C`/`RN`/`OW`/`AS`/`LN` + `setView`/`setAccent`/`toast`. No eval, `Function` or string handlers. IDs never go into JS strings.
- [x] F4: runner name/colour paths escaped; colour validated as `#RRGGBB`. With the clean start the runner avatar/name UI is removed entirely, so no runner data is rendered any more.
- [x] F7: sw.js v6 caches only same-origin static GETs (allowlisted extensions + navigations), never `/api`, `/auth`, `/login`, `config.js`, `key=` URLs, requests with Authorization, or `no-store`/`private` responses. Google APIs are cross-origin and bypassed. A `logout` message clears all caches.
- [x] F1 label: estimate-only comment in js/data.js `quote()` and js/line.js header; UI copy says "Estimate … final price is set by our server". js/pricing.js untouched.
- [x] Tests now count `securitypolicyviolation` events (previously `window.__csp` was never set).
- [x] Clean start: no seeded orders, stops, saved addresses, runners, chat, history, earnings or owner numbers. On first load localStorage is empty.
- [x] Hold My Spot: DOM/textContent only; venue blocklist client-side is UX only. The server must re-check venue eligibility, start time (≥2 h, no ASAP), and price.

- [x] Three separate apps: `/customer/`, `/runner/`, `/owner/`, each with its own index.html, manifest (name, short_name, start_url, scope, icons) and service-worker scope with a per-app cache (`errandco-v7-<app>`). The role switcher and accent menu are removed. The root `/` is a script-free redirect to `/customer/`.
- [x] Per-page CSP: `default-src 'none'`, `manifest-src 'self'`, `script-src-attr 'none'`. The owner page allows no Google origins (`script-src 'self'`, `connect-src 'self'`, `frame-src 'none'`).
- [ ] PROTOTYPE ONLY: the apps share orders through same-origin localStorage (`errand.shared.v1`, see `Store` in js/data.js). Anyone on the same device/origin can read it, and the runner/owner apps have no auth. Production must use the server with role-scoped auth, keep no addresses or orders in browser storage, and serve the owner app behind staff login (ideally on a separate origin).

## Backend plan (before real customers)
- **Auth:** phone/email login with short-lived sessions (HttpOnly, Secure, SameSite cookies). Runner accounts are ID-verified, and v1 does not take prescription pickups. The Pro/Rx tier returns in v1.1 with ID checks.
- **Server-side validation:** recompute every price, cap, fee and stop on the server and never trust client totals. Validate and limit the length of all text fields.
- **Rate limiting:** per IP and per account on login, trip creation, chat and any proxied Maps/Places calls.
- **Least privilege:** separate customer/runner/owner roles. DB credentials scoped per service. Server Maps key IP-restricted. Secrets in a secret manager.
- **Payments:** Stripe only (Checkout/Payment Intents with manual capture for the spending cap). No card data touches our servers. Verify webhook signatures.

## Pricing (must fix before production)
- [ ] Hold My Spot price ($15 fee + $40/hr, 2 h min, 15-min steps, cap; cancellation; no-show = time spent + $3) is a PROPOSED rate in `LINE_CFG` (js/line.js), computed on the client for display. The server must own it.
- [ ] The price is currently **client-calculated (prototype)**. The real build must compute the quote on the server from server-fetched route data, re-verify it at payment (amount = server quote + cap hold), and treat the client as display-only. Never trust a client-sent price.
- [x] Pricing engine v4 updated (Adam's new engine.js, `drive_minutes`), rebuilt by tools/build_pricing.py. Real Routes drive minutes go to the engine directly (no mph conversion). USPS stops map to `post_office`, and empty grocery stops start at 0 items.
- [x] Routes is called only on Review for final stops (cached by route key). Typing and editing use the straight-line estimate, with no API calls.
