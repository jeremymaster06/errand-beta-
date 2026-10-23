# Security & cost checklist

## Done (client)
- [x] No HTML built from user or API strings: all new UI uses createElement/textContent. Legacy templates pass every dynamic string through `esc()`. innerHTML is used only for static icon SVG and escaped templates (audited).
- [x] Strict CSP meta: `script-src 'self' https://maps.googleapis.com`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `upgrade-insecure-requests`. **Exception:** `script-src-attr 'unsafe-inline'`, because the legacy screens use inline `onclick`; removing it means moving those to addEventListener.
- [x] No third-party scripts besides Google Maps. HTTPS only. `referrer` policy set.
- [x] No secrets client-side; the referrer- and API-restricted Maps key is the only one.
- [x] Playwright: zero console errors and zero CSP violations across light, dark, 320–430 px and desktop.
- [x] Cost: 3-char/300 ms autocomplete, session tokens, field masks, caching, lazy Maps load, routes only once stops are final, with results cached.
- [ ] `frame-ancestors` / HSTS can't be set from a meta tag on GitHub Pages; add them as headers once there is a real host or CDN.

## Backend plan (before real customers)
- **Auth:** phone/email login with short-lived sessions (HttpOnly, Secure, SameSite cookies). Runner accounts are ID-verified, and Pro runners are checked for Rx pickups.
- **Server-side validation:** recompute every price, cap, fee and stop on the server and never trust client totals. Validate and limit the length of all text fields.
- **Rate limiting:** per IP and per account on login, trip creation, chat and any proxied Maps/Places calls.
- **Least privilege:** separate customer/runner/owner roles. DB credentials scoped per service. Server Maps key IP-restricted. Secrets in a secret manager.
- **Payments:** Stripe only (Checkout/Payment Intents with manual capture for the spending cap). No card data touches our servers. Verify webhook signatures.
