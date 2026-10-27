# Resume notes (updated Oct 24, 2026)
Phase 1 is done, Pro is removed (backup in /workspace/errand-redesign-v1.1-pro-backup/), and the pricing engine v4 is wired in. All tests pass: `node --test tests/`, then `python3 tests/e2e_addstop.py`, `e2e_playwright.py`, `e2e_overlap.py` and `e2e_webkit_iphone.py` (needs :8765 and :8770 servers), and `stranger.py after`. Nothing has been pushed. Mark pushes after Jeremy approves.

## 2026-10-25 — passwordless demo sign-in + Mark/Lex guardrails
- Auth stores no password or hash: account = {id,name,contact,createdAt,acks}; legacy salt/hash records stripped on load. Sign-in = name + email/phone. AU.session() is the one session check. Sign-out clears errand.auth.<app>, errand.session.<app> and personal data.
- New js/orders.js (timing modes, flex window line, courier eligibility + note, claims). Settings: line (15/40/2h, cap 12h), dropoff (29), timing, courier (off, demo only), claims — all labeled Pending Jeremy.
- Tests: tests/order_rules.test.js, tests/e2e_orders_iphone.py (new); auth tests rewritten. node 80/80; all WebKit suites pass, 0 CSP.
