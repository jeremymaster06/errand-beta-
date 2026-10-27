/* Sign-in for the three apps (prototype). Accounts are separate per app and stay on this device.
 * No passwords at all (Shield + Mark guardrail): customer and runner sign-in is name + email or phone, and a
 * session flag. No password, hash or salt is collected or stored. Account records are whitelisted on every load.
 * DOM is built with textContent only (no HTML sinks); legal docs are parsed from markdown into DOM nodes.
 * Owner app has NO sign-up path: one preset demo owner identity, no password (Shield). */
'use strict';
const ACCOUNT_FIELDS = ['id', 'name', 'contact', 'createdAt', 'acks'];   // the only keys an account record may hold
const AUTH_STR = {
  demo: "Demo sign-in — don't use a real password",
  device: 'Prototype only: accounts stay on this device.',
  noMatch: 'No account matches that name and email or phone.',
  passkey: 'Coming with the real backend',
  draft: 'Draft, pending attorney review',
  banner: 'Draft, not in effect, pending attorney review',
  demoOnly: 'Demo only. This is a test app; no real service, orders, or charges.',
  paid: 'Paid for every hour you work, with at least minimum wage guaranteed',
  gpsOnly: 'Location is used only during an active job. Clocking in does not start location tracking.'
};
const AUTH_DOCS = {
  terms: { title: 'Terms of Service', file: '../legal/terms.md' },
  privacy: { title: 'Privacy Policy', file: '../legal/privacy.md' },
  pay: { title: 'Pay notice (Labor Law §195)', file: '../legal/runner-pay-notice.md' },
  gps: { title: 'Electronic monitoring notice (Civ. Rights Law §52-c)', file: '../legal/runner-gps-notice.md' }
};
const AUTHX = {
  normContact(v) {
    const s = String(v || '').trim();
    if (/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s)) return s.toLowerCase();
    const d = s.replace(/[\s().+-]/g, ''); return /^\d{10,15}$/.test(d) ? d : null;
  },
  validName: v => { const s = String(v || '').trim(); return s.length >= 1 && s.length <= 80 && !/[<>\u0000-\u001f]/.test(s) ? s : null; },
  sameName: (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(),
  /* Keep only whitelisted account keys, so a password, hash or salt from an older build can never survive. */
  clean: a => Object.fromEntries(ACCOUNT_FIELDS.filter(k => a && a[k] !== undefined).map(k => [k, a[k]])),
  find: (accounts, name, contact) => accounts.find(x => x.contact === contact && AUTHX.sameName(x.name, name)) || null,
  /* Markdown -> DOM nodes (headings, lists, quotes, paragraphs, **bold**). Text only. */
  md(doc, text) {
    const frag = doc.createDocumentFragment(); let list = null;
    const inline = (el, s) => { s.split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; if (/^\*\*[^*]+\*\*$/.test(p)) { const b = doc.createElement('strong'); b.textContent = p.slice(2, -2); el.append(b); } else el.append(doc.createTextNode(p)); }); return el; };
    for (const raw of String(text).split('\n')) {
      const line = raw.trimEnd(); let m;
      if (!line.trim()) { list = null; continue; }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) { list = null; frag.append(inline(doc.createElement('h' + Math.min(6, m[1].length + 1)), m[2])); continue; }
      if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { if (!list) { list = doc.createElement('ul'); frag.append(list); } list.append(inline(doc.createElement('li'), m[1])); continue; }
      list = null;
      if ((m = /^>\s?(.*)$/.exec(line))) { frag.append(inline(doc.createElement('blockquote'), m[1])); continue; }
      if (/^-{3,}$/.test(line.trim())) { frag.append(doc.createElement('hr')); continue; }
      frag.append(inline(doc.createElement('p'), line));
    }
    return frag;
  }
};
if (typeof module !== 'undefined') { module.exports = { AUTHX, AUTH_STR, ACCOUNT_FIELDS }; }
else {
  const APP = () => document.body.dataset.app || 'customer';
  const KEY = () => 'errand.auth.' + APP(), SKEY = () => 'errand.session.' + APP();
  const load = () => {
    let raw = null, d; try { raw = localStorage.getItem(KEY()); d = JSON.parse(raw || '{}'); } catch (e) { d = {}; }
    const out = { accounts: (Array.isArray(d.accounts) ? d.accounts : []).map(AUTHX.clean) };
    if (raw && JSON.stringify(out) !== raw) save(out);   // strips legacy password/hash keys from storage
    return out;
  };
  const save = d => { try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) { } };
  const el = (tag, a = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(a)) { if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k === 'act') e.dataset.act = v; else if (k === 'args') e.dataset.args = JSON.stringify(v); else e.setAttribute(k, v === true ? '' : v); } kids.flat().forEach(k => k != null && e.append(k)); return e; };
  const docCache = {};
  async function fetchDoc(k) {
    if (docCache[k]) return docCache[k];
    const r = await fetch(AUTH_DOCS[k].file, { cache: 'no-store' }); if (!r.ok) throw new Error('doc');
    const text = await r.text(), dg = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return (docCache[k] = { text, version: 'sha256:' + [...dg.slice(0, 6)].map(x => x.toString(16).padStart(2, '0')).join('') });
  }
  const AU = {
    st: { screen: 'welcome', err: '', back: 'welcome', pending: null },
    /* The one session check. Every gated screen, action and the sign-in overlay go through this. */
    session() { try { const s = JSON.parse(localStorage.getItem(SKEY()) || 'null'); if (!s) return null; if (APP() === 'owner') return s.id === 'demo-owner' ? { id: s.id, name: 'Demo owner' } : null; const a = load().accounts.find(x => x.id === s.id); return a && AU.onboarded(a) ? a : null; } catch (e) { return null; } },
    onboarded: a => APP() !== 'runner' || (['pay', 'gps'].every(d => (a.acks || []).some(x => x.doc === d))),
    mount() { if (!$('#auth')) document.body.append(el('div', { id: 'auth', class: 'auth', role: 'dialog', 'aria-modal': 'true' })); AU.render(); },
    go(screen) { AU.st.err = ''; if (screen !== 'doc') AU.st.back = screen; AU.st.screen = screen; AU.render(); },
    require() { if (AU.session()) return true; AU.go('welcome'); toast('Sign in to continue'); return false; },
    /* Sign-out clears the session, this app's account record (name, contact) and the app's personal data. */
    signOut() { try { localStorage.removeItem(SKEY()); localStorage.removeItem(KEY()); } catch (e) { } clearPersonalData(); AU.st = { screen: 'welcome', err: '', back: 'welcome', pending: null }; AU.render(); R(); },
    async openDoc(k, sec) { if (!AUTH_DOCS[k]) return; AU.st.doc = k; AU.st.sec = sec; AU.st.screen = 'doc'; AU.render(); },
    err(m) { AU.st.err = m; const e = $('#auErr'); if (e) { e.textContent = m; e.hidden = !m; } },
    async signUp() {
      const name = AUTHX.validName($('#auName').value), contact = AUTHX.normContact($('#auContact').value);
      if (!name) return AU.err('Enter your name (up to 80 characters).');
      if (!contact) return AU.err('Enter a valid email or a 10–15 digit phone number.');
      if (APP() === 'customer' && !$('#auTerms').checked) return AU.err('Please agree to the Terms of Service and Privacy Policy.');
      const d = load(); if (d.accounts.some(x => x.contact === contact)) return AU.err('Could not create an account with these details. Try signing in.');
      const btn = $('#auGo'); btn.disabled = true;
      const acks = [];
      if (APP() === 'customer') for (const k of ['terms', 'privacy']) { try { acks.push({ doc: k, version: (await fetchDoc(k)).version, at: new Date().toISOString() }); } catch (e) { acks.push({ doc: k, version: 'unavailable', at: new Date().toISOString() }); } }
      const acct = { id: crypto.randomUUID(), name, contact, createdAt: new Date().toISOString(), acks };
      d.accounts.push(acct); save(d); AU.start(acct);
    },
    signIn() {
      const name = AUTHX.validName($('#auName').value), contact = AUTHX.normContact($('#auContact').value);
      const a = name && contact && AUTHX.find(load().accounts, name, contact);
      if (!a) return AU.err(AUTH_STR.noMatch);
      AU.start(a);
    },
    demoOwner() { if (APP() !== 'owner') return; localStorage.setItem(SKEY(), JSON.stringify({ id: 'demo-owner', at: Date.now() })); AU.render(); R(); },
    start(a) {
      localStorage.setItem(SKEY(), JSON.stringify({ id: a.id, at: Date.now() }));
      if (!AU.onboarded(a)) { AU.go('onboard'); return; }
      AU.render(); R(); toast('Signed in as ' + a.name);
    },
    async ackOnboard() {
      if (!$('#auAckPay').checked || !$('#auAckGps').checked) return AU.err('Please acknowledge both notices to continue.');
      const s = JSON.parse(localStorage.getItem(SKEY()) || 'null'), d = load(), a = s && d.accounts.find(x => x.id === s.id); if (!a) return AU.go('welcome');
      a.acks = a.acks || []; for (const k of ['pay', 'gps']) { let v = 'unavailable'; try { v = (await fetchDoc(k)).version; } catch (e) { } a.acks.push({ doc: k, version: v, at: new Date().toISOString() }); }
      save(d); AU.render(); R(); toast('Welcome, ' + a.name);
    },
    render() {
      const box = $('#auth'); if (!box) return; const u = AU.session(), app = APP();
      document.body.dataset.authed = u ? '1' : '0';
      if (u && AU.st.screen !== 'doc') { box.hidden = true; box.replaceChildren(); return; }
      box.hidden = false; const S2 = AU.st;
      const title = { customer: 'ErrandCo', runner: 'ErrandCo Runner', owner: 'ErrandCo Owner' }[app];
      const demo = () => el('p', { class: 'au-demo', text: AUTH_STR.demo });
      const demoOnly = () => el('p', { class: 'au-demoonly', id: 'auDemoOnly', role: 'note', text: AUTH_STR.demoOnly });
      const errP = () => el('p', { class: 'au-err', id: 'auErr', role: 'alert', text: S2.err, hidden: !S2.err });
      const field = (id, label, ac) => el('label', { class: 'au-field' }, el('span', { class: 'fn sec', text: label }), el('div', { class: 'au-row' }, el('input', { id, type: 'text', autocomplete: ac, maxlength: 190, spellcheck: 'false', autocapitalize: 'off' })));
      const who = () => [field('auName', 'Name', 'name'), field('auContact', 'Email or phone', 'username')];
      const passkey = () => el('div', { class: 'au-passkey' }, el('button', { type: 'button', class: 'btn gray', id: 'auPasskey', disabled: true, 'aria-disabled': 'true', text: 'Sign in with a passkey' }), el('p', { class: 'fn sec', text: AUTH_STR.passkey }));
      const back = to => el('button', { type: 'button', class: 'btn plain', act: 'AU.go', args: [to], text: 'Back' });
      let body = [];
      if (app === 'owner') {
        body = [el('h1', { class: 't1', text: 'Owner sign in' }), demoOnly(), el('form', { class: 'au-form', id: 'auOwner' }, demo(),
          el('p', { class: 'sub sec', text: 'The owner dashboard has a single preset demo identity. There is no owner sign-up.' }),
          el('button', { type: 'button', class: 'btn', id: 'auDemoOwner', act: 'AU.demoOwner', text: 'Sign in as Demo owner' })), passkey(), el('p', { class: 'fn sec au-note', text: AUTH_STR.device })];
      } else if (S2.screen === 'doc') {
        const k = S2.doc, art = el('article', { class: 'au-doc', id: 'auDoc' }, el('p', { class: 'fn sec', text: 'Loading…' }));
        body = [el('p', { class: 'au-banner', id: 'auDraftBanner', role: 'note', text: AUTH_STR.banner }), el('div', { class: 'au-top' }, back(S2.back)), el('h1', { class: 't1', text: AUTH_DOCS[k].title }), el('p', { class: 'au-draft', id: 'auDraft', text: AUTH_STR.draft }), art];
        fetchDoc(k).then(d => { if (AU.st.screen === 'doc' && AU.st.doc === k) { art.replaceChildren(AUTHX.md(document, d.text)); art.append(el('p', { class: 'fn sec', text: 'Version ' + d.version })); const p = S2.sec && [...art.children].find(x => x.textContent.startsWith(S2.sec + ' ')); if (p) p.scrollIntoView(); } }).catch(() => art.replaceChildren(el('p', { class: 'au-err', text: 'Could not load this document.' })));
      } else if (S2.screen === 'signup') {
        const docLink = (k, t) => el('button', { type: 'button', class: 'linkbtn', id: 'auDoc-' + k, act: 'AU.openDoc', args: [k], text: t });
        body = [el('div', { class: 'au-top' }, back('welcome')), el('h1', { class: 't1', text: 'Create account' }), demoOnly(), el('form', { class: 'au-form', id: 'auSignup' }, demo(),
          who(),
          app === 'customer' ? el('label', { class: 'au-check', for: 'auTerms' }, el('input', { type: 'checkbox', id: 'auTerms' }), el('span', {}, 'I agree to the ', docLink('terms', 'Terms of Service'), ' and ', docLink('privacy', 'Privacy Policy'), el('span', { class: 'fn sec', text: ' (' + AUTH_STR.draft + ')' }))) : el('p', { class: 'fn sec', text: 'Next: review your pay and location notices.' }),
          errP(), el('button', { type: 'button', class: 'btn', id: 'auGo', act: 'AU.signUp', text: 'Create account' })), el('p', { class: 'fn sec au-note', text: AUTH_STR.device })];
      } else if (S2.screen === 'signin') {
        body = [el('div', { class: 'au-top' }, back('welcome')), el('h1', { class: 't1', text: 'Sign in' }), el('form', { class: 'au-form', id: 'auSignin' }, demo(),
          who(), errP(), el('button', { type: 'button', class: 'btn', id: 'auGo', act: 'AU.signIn', text: 'Sign in' })), passkey(), el('p', { class: 'fn sec au-note', text: AUTH_STR.device })];
      } else if (S2.screen === 'onboard' && app === 'runner') {
        const gps = el('article', { class: 'au-doc', id: 'auGpsText' }, el('p', { class: 'fn sec', text: 'Loading…' }));
        fetchDoc('gps').then(d => gps.replaceChildren(AUTHX.md(document, d.text), el('p', { class: 'fn sec', text: 'Version ' + d.version }))).catch(() => gps.replaceChildren(el('p', { class: 'au-err', text: 'Could not load the notice.' })));
        body = [el('h1', { class: 't1', text: 'Before you start' }), el('p', { class: 'au-banner', role: 'note', text: AUTH_STR.banner }), el('p', { class: 'sub', id: 'auPaid', text: AUTH_STR.paid + '.' }),
          el('p', { class: 'sub sec', text: AUTH_STR.gpsOnly }), el('p', { class: 'au-draft', text: AUTH_STR.draft }),
          el('button', { type: 'button', class: 'btn gray', id: 'auDoc-pay', act: 'AU.openDoc', args: ['pay'], text: 'Read the pay notice' }),
          el('h2', { class: 't3', text: AUTH_DOCS.gps.title }), gps,
          el('label', { class: 'au-check', for: 'auAckPay' }, el('input', { type: 'checkbox', id: 'auAckPay' }), el('span', { text: 'I received and read the pay notice.' })),
          el('label', { class: 'au-check', for: 'auAckGps' }, el('input', { type: 'checkbox', id: 'auAckGps' }), el('span', { text: 'I acknowledge the electronic monitoring notice.' })),
          errP(), el('button', { type: 'button', class: 'btn', id: 'auAck', act: 'AU.ackOnboard', text: 'Continue' }), el('button', { type: 'button', class: 'btn plain', act: 'AU.signOut', text: 'Sign out' })];
      } else {
        body = [el('div', { class: 'au-hero' }, el('div', { class: 'au-logo', text: title.slice(0, 1) }), el('h1', { class: 't1', text: app === 'runner' ? 'Welcome, runner' : 'Welcome to ' + title }),
          el('p', { class: 'sub sec', text: app === 'runner' ? AUTH_STR.paid + '.' : 'Errands done for you, one upfront price.' })),
          el('button', { type: 'button', class: 'btn', id: 'auToSignup', act: 'AU.go', args: ['signup'], text: 'Create account' }),
          el('button', { type: 'button', class: 'btn gray', id: 'auToSignin', act: 'AU.go', args: ['signin'], text: 'Sign in' }), passkey(), el('p', { class: 'fn sec au-note', text: AUTH_STR.device })];
      }
      box.replaceChildren(el('div', { class: 'au-inner' }, body));
      const f = box.querySelector('input:not([type=checkbox])'); if (f && S2.screen !== 'doc') f.focus({ preventScroll: true });
    }
  };
  window.AU = AU;
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('#auth form')) { e.preventDefault(); const g = $('#auGo'); if (g && !g.disabled) g.click(); } });
}
