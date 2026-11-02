(function (root) {
  'use strict';
  const STORE_KINDS = ['grocery', 'pharmacy', 'hardware', 'pet', 'bakery', 'cleaners', 'post', 'shipping', 'office'];
  const BIAS = { lat: 40.7887, lng: -73.7280 };
  const L = (id, name, addr, city, lat, lng, kind) => ({ id, name, addr, city, lat, lng, kind });
  const LOCAL = [
    L('nsfarms', 'North Shore Farms', '90 Horace Harding Blvd', 'Great Neck, NY 11020', 40.7608, -73.7213, 'grocery'),
    L('wholefoods', 'Whole Foods Market', '2101 Northern Blvd', 'Manhasset, NY 11030', 40.7907, -73.6949, 'grocery'),
    L('stopshop', 'Stop & Shop', '65 Shore Rd', 'Port Washington, NY 11050', 40.8275, -73.6975, 'grocery'),
    L('cvs', 'CVS Pharmacy', '510 Middle Neck Rd', 'Great Neck, NY 11023', 40.8003, -73.7344, 'pharmacy'),
    L('cleaners', 'Nu-Clear Drive-in Cleaners', '172 Middle Neck Rd', 'Great Neck, NY 11021', 40.7958, -73.7290, 'cleaners'),
    L('usps', 'Great Neck Post Office', '1 Welwyn Rd', 'Great Neck, NY 11021', 40.7998, -73.7290, 'post'),
    L('ups', 'The UPS Store', '10 Bond St', 'Great Neck, NY 11021', 40.7885, -73.7250, 'shipping'),
    L('a1', '25 Grace Ave', 'Great Neck, NY 11021', '', 40.7887, -73.7280, 'address'),
    L('a2', '12 Elm St', 'Great Neck, NY 11021', '', 40.8012, -73.7228, 'address'),
    L('a3', '88 Middle Neck Rd', 'Great Neck, NY 11021', '', 40.7958, -73.7296, 'address'),
    L('a4', '4 Kings Point Rd', 'Kings Point, NY 11024', '', 40.8090, -73.7400, 'address'),
    L('a5', '7 Station Plaza', 'Great Neck, NY 11021', '', 40.7868, -73.7262, 'address'),
    L('a6', '1 Great Neck Rd', 'Great Neck, NY 11021', '', 40.7920, -73.7190, 'address'),
    L('a7', '22 Bond St', 'Great Neck, NY 11021', '', 40.7884, -73.7247, 'address'),
    L('a8', '45 Steamboat Rd', 'Great Neck, NY 11024', '', 40.8020, -73.7345, 'address'),
    L('a9', '300 Lakeville Rd', 'Great Neck, NY 11020', '', 40.7740, -73.7060, 'address'),
    L('a10', '18 Old Mill Rd', 'Great Neck, NY 11023', '', 40.7990, -73.7440, 'address'),
    L('a11', '100 Plandome Rd', 'Manhasset, NY 11030', '', 40.7990, -73.6990, 'address'),
    L('a12', '55 Main St', 'Port Washington, NY 11050', '', 40.8290, -73.6880, 'address'),
    L('a13', '9 Cuttermill Rd', 'Great Neck, NY 11021', '', 40.7865, -73.7310, 'address'),
    L('a14', '140 East Shore Rd', 'Great Neck, NY 11023', '', 40.8050, -73.7180, 'address'),
    L('a15', '2 Bayview Ave', 'Great Neck, NY 11021', '', 40.7940, -73.7300, 'address'),
    L('a16', '60 Northern Blvd', 'Great Neck, NY 11021', '', 40.7785, -73.7270, 'address')
  ];
  const norm = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ');
  const words = s => { const out = []; String(s).replace(/[a-z0-9]+/gi, (w, i) => { out.push({ w: norm(w), s: i, e: i + w.length }); }); return out; };
  function lev1(a, b) {
    if (Math.abs(a.length - b.length) > 1 && b.length < a.length - 1) return false;
    const p = b.slice(0, a.length), q = b.slice(0, a.length + 1), r = b.slice(0, a.length - 1);
    const d = (x, y) => { const m = x.length, n = y.length, D = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) D[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); return D[m][n]; };
    return d(a, p) <= 1 || d(a, q) <= 1 || (r && d(a, r) <= 1);
  }
  function matchLocal(p, toks) {
    const fields = [words(p.name), words(p.addr + (p.city ? ', ' + p.city : ''))];
    let score = 0; const pm = [], sm = [];
    for (let t = 0; t < toks.length; t++) {
      const tk = toks[t]; let hit = null;
      for (let f = 0; f < 2 && !hit; f++) for (let k = 0; k < fields[f].length; k++) { const w = fields[f][k];
        if (w.w.startsWith(tk)) { hit = { f, w, len: tk.length, sc: (f ? 2 : 6) + (k === 0 ? 4 : 0) }; break; } }
      if (!hit && tk.length >= 4) for (let f = 0; f < 2 && !hit; f++) for (const w of fields[f]) if (lev1(tk, w.w)) { hit = { f, w, len: Math.min(tk.length, w.w.length), sc: 1 }; break; }
      if (!hit) return null;
      score += hit.sc; (hit.f ? sm : pm).push([hit.w.s, hit.w.s + hit.len]);
    }
    if (STORE_KINDS.includes(p.kind)) score += 1;
    const dist = Math.hypot(p.lat - BIAS.lat, (p.lng - BIAS.lng) * .76);
    return { score: score - dist * 20, pm, sm };
  }
  function localSuggest(q, extra = []) {
    const toks = words(q).map(x => x.w); if (!toks.length) return [];
    return extra.concat(LOCAL).map(p => { const m = matchLocal(p, toks); return m && { id: p.id, primary: p.name, secondary: p.addr + (p.city ? ', ' + p.city : ''), pm: m.pm, sm: m.sm, kind: p.kind, src: 'local', dist: Math.hypot((p.lat - BIAS.lat) * 69, (p.lng - BIAS.lng) * 52.4), score: m.score + (p.kind === 'saved' ? 3 : 0), place: p }; })
      .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 7);
  }
  const GTYPE = [['grocery', ['grocery_store', 'supermarket', 'market', 'food_store', 'convenience_store']], ['pharmacy', ['pharmacy', 'drugstore']], ['hardware', ['hardware_store', 'home_improvement_store', 'home_goods_store']], ['pet', ['pet_store']], ['bakery', ['bakery']], ['cleaners', ['laundry', 'dry_cleaner']], ['post', ['post_office']], ['shipping', ['shipping_service', 'courier_service']], ['office', ['office_supply_store', 'book_store']], ['library', ['library']]];
  function kindFromTypes(types) { types = types || []; for (const [k, ts] of GTYPE) if (types.some(t => ts.includes(t))) return k; return types.includes('store') || types.includes('shopping_mall') ? 'grocery' : (types.includes('street_address') || types.includes('premise') || types.includes('route') ? 'address' : 'address'); }
  const gReady = () => !!(root.google && google.maps && google.maps.places && google.maps.places.AutocompleteSuggestion);
  let token = null, gFailed = false;
  const ranges = (ms) => (ms || []).map(m => [m.startOffset || 0, m.endOffset]);
  async function googleSuggest(q) {
    const P = google.maps.places; if (!token) token = new P.AutocompleteSessionToken();
    const { suggestions } = await P.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q, sessionToken: token, locationBias: { center: BIAS, radius: 15000 }, origin: BIAS, includedRegionCodes: ['us'], language: 'en-US' });
    return (suggestions || []).filter(s => s.placePrediction).slice(0, 7).map(s => { const p = s.placePrediction;
      return { id: p.placeId, primary: p.mainText ? p.mainText.text : p.text.text, secondary: p.secondaryText ? p.secondaryText.text : '', pm: ranges(p.mainText && p.mainText.matches), sm: ranges(p.secondaryText && p.secondaryText.matches), kind: kindFromTypes(p.types), src: 'google', pred: p, dist: p.distanceMeters != null ? p.distanceMeters / 1609.34 : null }; }).map((r, i, a) => (r.g = a.findIndex(x => x.primary === r.primary), r))
      .sort((x, y) => x.g - y.g || (x.dist ?? 1e9) - (y.dist ?? 1e9));
  }
  const mem = new Map();
  function cacheGet(k) { if (mem.has(k)) return mem.get(k); try { const v = sessionStorage.getItem(k); if (v) { const o = JSON.parse(v); mem.set(k, o); return o; } } catch (e) { } return null; }
  function cacheSet(k, v) { mem.set(k, v); try { sessionStorage.setItem(k, JSON.stringify(v, (key, x) => key === 'pred' ? undefined : x)); } catch (e) { } }
  async function googleResolve(sg) {
    const ck = 'pd:' + sg.id, hit = cacheGet(ck); if (hit) { token = null; return hit; }
    const place = sg.pred ? sg.pred.toPlace() : new google.maps.places.Place({ id: sg.id }); await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'types'] });
    token = null;
    const kind = kindFromTypes(place.types);
    const out = { id: 'g_' + place.id, name: place.displayName || sg.primary, addr: (place.formattedAddress || sg.secondary).replace(/, USA$/, ''), lat: place.location.lat(), lng: place.location.lng(), kind, store: STORE_KINDS.includes(kind) };
    cacheSet(ck, out); return out;
  }
  const Places = {
    MIN: 3, STORE_KINDS, LOCAL, BIAS, kindFromTypes, localSuggest,
    get mode() { return gReady() && !gFailed ? 'google' : 'local'; },
    async suggest(q, extra) {
      q = String(q || '').trim(); if (q.length < Places.MIN) return [];
      if (Places.mode === 'google') { const ck = 'pl:' + q.toLowerCase(), hit = cacheGet(ck); if (hit) return hit;
        try { const r = await googleSuggest(q); cacheSet(ck, r); return r; } catch (e) { console.warn('Places autocomplete failed, using local search:', e && e.message); gFailed = true; } }
      return localSuggest(q, extra);
    },
    async resolve(sg) {
      if (sg.src === 'google') { try { return await googleResolve(sg); } catch (e) { console.warn('Place details failed:', e && e.message); } }
      const p = sg.place || {}; return { id: p.id || sg.id, name: p.name || sg.primary, addr: p.addr ? p.addr + (p.city ? ', ' + p.city.replace(/, NY$/, '') : '') : sg.secondary, lat: p.lat || BIAS.lat, lng: p.lng || BIAS.lng, kind: sg.kind, store: STORE_KINDS.includes(sg.kind) };
    },
    async freeText(text) {
      if (root.google && google.maps && google.maps.Geocoder && !gFailed) { try { const { results } = await new google.maps.Geocoder().geocode({ address: text, bounds: { north: 40.84, south: 40.75, east: -73.65, west: -73.77 } }); if (results && results[0]) { const r = results[0]; return { id: 'g_' + r.place_id, name: text, addr: r.formatted_address.replace(/, USA$/, ''), lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), kind: 'address', store: false }; } } catch (e) { console.warn('Geocode failed:', e && e.message); } }
      let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 1000;
      return { id: 'f_' + h, name: text, addr: 'Address as typed · runner confirms', lat: BIAS.lat + (h % 20 - 10) / 1000, lng: BIAS.lng + ((h / 20 | 0) % 20 - 10) / 1000, kind: 'address', store: false, approx: true };
    },
    _fail() { gFailed = true; },
    _reset() { token = null; gFailed = false; mem.clear(); }
  };
  root.Places = Places;
  if (typeof module !== 'undefined') module.exports = Places;
})(typeof window !== 'undefined' ? window : globalThis);
