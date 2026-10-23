/* Map abstraction. Maps.render(el, scene) draws the same scene with Google Maps (if MAPS_API_KEY is set
 * and loads) or with the built-in SVG fallback. scene = {pts:[{lat,lng,label,kind}], path:[{lat,lng}...] (in
 * visit order), runner: 0..1 progress along path | null, start:{lat,lng}}. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const HAS_KEY = typeof MAPS_API_KEY === 'string' && !!MAPS_API_KEY;
  let mode = 'fallback', loadP = null; // the Google script is loaded lazily on first map render / first place search
  const routeCache = new Map(); // final routes only, keyed by stop coordinates
  let g = null, gmap = null, gObjs = [], gRunner = null, gPath = [], lastKey = '', anim = { cur: 0, target: 0, raf: 0 }, host = null;

  /* ---------- Google ---------- */
  function loadGoogle() {
    if (loadP) return loadP; if (!HAS_KEY) return (loadP = Promise.resolve(false));
    loadP = new Promise(res => { const done = ok => res(ok);
    window.gm_authFailure = () => { if (window.Places) Places._fail(); console.warn('Google Maps auth failed; using fallback map.'); mode = 'fallback'; lastKey = ''; if (host) Maps.render(host.el, host.scene, true); done(false); };
    window.__errandMapsReady = () => { g = google.maps; mode = 'google'; lastKey = ''; if (host) Maps.render(host.el, host.scene, true); done(true); };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(MAPS_API_KEY) + '&libraries=places,marker&loading=async&callback=__errandMapsReady';
    s.async = true; s.onerror = () => { mode = 'fallback'; lastKey = ''; if (host) Maps.render(host.el, host.scene, true); done(false); };
    document.head.appendChild(s); });
    return loadP;
  }

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6D28D9';

  function renderGoogle(el, scene) {
    if (!gmap || !el.contains(gmap.getDiv())) {
      el.innerHTML = ''; const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0'; el.appendChild(d);
      gmap = new g.Map(d, { center: scene.start || scene.pts[0], zoom: 14, disableDefaultUI: true, gestureHandling: 'greedy', mapId: MAPS_MAP_ID || undefined });
    }
    gObjs.forEach(o => o.setMap(null)); gObjs = [];
    const b = new g.LatLngBounds(); const col = accent();
    scene.pts.forEach(p => { b.extend(p);
      gObjs.push(new g.Marker({ map: gmap, position: p, label: p.label ? { text: String(p.label), color: '#fff', fontWeight: '700' } : undefined,
        icon: { path: g.SymbolPath.CIRCLE, scale: p.kind === 'start' ? 6 : (p.kind === 'car' ? 7 : 12), fillColor: p.kind === 'car' ? '#444' : p.kind === 'start' ? '#111' : (p.kind === 'end' ? '#111' : col), fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } })); });
    gmap.fitBounds(b, { top: 60, bottom: Math.round(el.clientHeight * 0.5), left: 30, right: 30 });
    const path = scene.path; if (path.length < 2) return;
    const rkey = JSON.stringify(path.map(p => [+p.lat.toFixed(5), +p.lng.toFixed(5)]));
    const draw = (pts, real) => { if (real) routeCache.set(rkey, pts);
      gPath = pts; gObjs.push(new g.Polyline({ map: gmap, path: gPath, strokeColor: '#000', strokeOpacity: .25, strokeWeight: 9 }));
      gObjs.push(new g.Polyline({ map: gmap, path: gPath, strokeColor: col, strokeWeight: 5 })); setRunner(scene.runner); };
    const straight = () => path.map(p => new g.LatLng(p.lat, p.lng));
    const viaDirections = () => { try { new g.DirectionsService().route({ origin: path[0], destination: path[path.length - 1],
      waypoints: path.slice(1, -1).map(p => ({ location: p, stopover: true })), optimizeWaypoints: false, travelMode: g.TravelMode.DRIVING },
      (res, status) => status === 'OK' ? draw(res.routes[0].overview_path, true) : draw(straight())); } catch (e) { draw(straight()); } };
    /* Cost rule: no Routes/Directions request until the stops are final (trip confirmed). Before that, straight legs. */
    if (!scene.final) return draw(straight());
    if (routeCache.has(rkey)) return draw(routeCache.get(rkey));
    /* Routes API (Route class, preferred). Our solver fixes the stop order (pickup-before-drop-off), so Google only draws roads. */
    const ll = v => (typeof v === 'function' ? v() : v);
    (g.importLibrary ? g.importLibrary('routes') : Promise.reject()).then(lib => {
      if (!lib || !lib.Route) throw new Error('no Route class');
      return lib.Route.computeRoutes({ origin: path[0], destination: path[path.length - 1], intermediates: path.slice(1, -1).map(p => ({ location: p })),
        travelMode: 'DRIVING', fields: ['path', 'distanceMeters', 'durationMillis'] });
    }).then(({ routes }) => { if (!routes || !routes[0] || !routes[0].path) throw new Error('no route');
      draw(routes[0].path.map(p => new g.LatLng(ll(p.lat), ll(p.lng))), true); })
      .catch(() => viaDirections());
  }
  function gPointAt(t) {
    if (!gPath.length) return null; const L = []; let tot = 0;
    for (let i = 1; i < gPath.length; i++) { const d = g.geometry ? g.geometry.spherical.computeDistanceBetween(gPath[i - 1], gPath[i]) : Math.hypot(gPath[i].lat() - gPath[i - 1].lat(), gPath[i].lng() - gPath[i - 1].lng()); L.push(d); tot += d; }
    let want = t * tot; for (let i = 0; i < L.length; i++) { if (want <= L[i]) { const f = L[i] ? want / L[i] : 0; return { lat: gPath[i].lat() + (gPath[i + 1].lat() - gPath[i].lat()) * f, lng: gPath[i].lng() + (gPath[i + 1].lng() - gPath[i].lng()) * f }; } want -= L[i]; }
    return { lat: gPath[gPath.length - 1].lat(), lng: gPath[gPath.length - 1].lng() };
  }

  /* ---------- Fallback SVG ---------- */
  const W = 400, H = 860;
  function proj(scene) {
    const all = scene.pts.concat(scene.path); let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    all.forEach(p => { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lng); d = Math.max(d, p.lng); });
    const k = Math.cos(((a + b) / 2) * Math.PI / 180); const spanX = (d - c) * k || .01, spanY = (b - a) || .01;
    // fit into upper area (sheet covers bottom ~45%)
    const top = scene.top || 150, bot = scene.bottom || H * 0.43; const box = { x: 48, y: top, w: W - 96, h: Math.max(140, bot - top) }; const s = Math.min(box.w / spanX, box.h / spanY);
    const ox = box.x + (box.w - spanX * s) / 2, oy = box.y + (box.h - spanY * s) / 2;
    return p => [ox + (p.lng - c) * k * s, oy + (b - p.lat) * s];
  }
  function streets() {
    // deterministic pseudo street network
    let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; let s = '';
    for (let i = 0; i < 9; i++) { const y = 40 + i * 100 + rnd() * 30; s += `M-20 ${y} C 120 ${y + rnd() * 60 - 30}, 280 ${y + rnd() * 60 - 30}, 420 ${y + rnd() * 40 - 20} `; }
    for (let i = 0; i < 6; i++) { const x = 20 + i * 75 + rnd() * 20; s += `M${x} -20 C ${x + rnd() * 50 - 25} 300, ${x + rnd() * 50 - 25} 600, ${x + rnd() * 30} 880 `; }
    return s;
  }
  const STREETS = streets();
  function svgFallback(scene) {
    const P = proj(scene), path = scene.path.map(P);
    const d = path.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const pins = scene.pts.map(p => { const [x, y] = P(p);
      if (p.kind === 'car') return `<g class="m-car"><circle cx="${x}" cy="${y}" r="11" fill="var(--cell)" stroke="var(--sep)" stroke-width="1"/><path d="M${x - 5} ${y + 4} L${x} ${y - 6} L${x + 5} ${y + 4} L${x} ${y + 1}z" fill="var(--label)"/></g>`;
      if (p.kind === 'start') return `<g class="m-start"><circle cx="${x}" cy="${y}" r="9" fill="var(--map-pin-dark)" stroke="#fff" stroke-width="3"/></g>`;
      if (p.kind === 'end') return `<g><rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="6" fill="var(--map-pin-dark)" stroke="#fff" stroke-width="3"/><path d="M${x - 5} ${y + 1} l${5} -5 l${5} 5 v5 h-10z" fill="#fff"/></g>`;
      return `<g class="m-pin ${p.done ? 'done' : ''}"><path d="M${x} ${y + 2} c-10-12-15-17-15-25 a15 15 0 1 1 30 0 c0 8-5 13-15 25z" fill="${p.done ? 'var(--map-done)' : 'var(--accent)'}" stroke="#fff" stroke-width="2.5"/><text x="${x}" y="${y - 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${p.done ? '✓' : p.label}</text></g>`; }).join('');
    return `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" aria-label="Map">
      <rect width="${W}" height="${H}" fill="var(--map-land)"/>
      <path d="M-10 0 H410 V60 C 320 80, 240 40, 150 70 S 30 60, -10 85 Z" fill="var(--map-water)"/>
      <path d="M40 420 h90 v70 h-90z M260 230 h70 v60 h-70z M300 600 h80 v90 h-80z" fill="var(--map-park)" rx="8"/>
      <path d="${STREETS}" fill="none" stroke="var(--map-road)" stroke-width="7" stroke-linecap="round"/>
      <path d="M-20 300 C 100 260, 300 340, 420 280" fill="none" stroke="var(--map-major)" stroke-width="12"/>
      <text x="300" y="40" font-size="11" fill="var(--map-label)" font-style="italic">Manhasset Bay</text>
      ${d ? `<path d="${d}" fill="none" stroke="var(--map-casing)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
      <path id="routeLine" d="${d}" fill="none" stroke="var(--accent)" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      ${pins}<g id="runnerDot" style="display:${scene.runner == null ? 'none' : 'block'}"><circle r="20" fill="var(--accent)" opacity=".18"><animate attributeName="r" values="12;24;12" dur="2s" repeatCount="indefinite"/></circle>
      <circle r="11" fill="#fff"/><circle r="8" fill="var(--accent)"/><path d="M-3.5 2 L0 -4 L3.5 2 Z" fill="#fff"/></g></svg>`;
  }
  function placeRunnerSvg(t) { const line = host && host.el.querySelector('#routeLine'), dot = host && host.el.querySelector('#runnerDot'); if (!line || !dot) return;
    const L = line.getTotalLength(), p = line.getPointAtLength(Math.max(0, Math.min(1, t)) * L); dot.setAttribute('transform', `translate(${p.x},${p.y})`); }

  function setRunner(t) {
    if (t == null) return; cancelAnimationFrame(anim.raf); anim.target = t; const from = anim.cur, t0 = performance.now(), dur = 1400;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); anim.cur = from + (anim.target - from) * e;
      if (mode === 'google') { const p = gPointAt(anim.cur); if (p) { if (!gRunner) gRunner = new g.Marker({ map: gmap, zIndex: 999, icon: { path: g.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: accent(), fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } }); gRunner.setMap(gmap); gRunner.setPosition(p); } }
      else placeRunnerSvg(anim.cur);
      if (k < 1) anim.raf = requestAnimationFrame(step); };
    anim.raf = requestAnimationFrame(step);
  }

  const Maps = {
    get mode() { return mode; }, ensure: () => loadGoogle(),
    render(el, scene, force) {
      host = { el, scene }; if (HAS_KEY && !loadP) loadGoogle();
      const key = JSON.stringify([scene.pts, scene.path, mode, scene.top, scene.bottom]);
      const redraw = key !== lastKey || force || !el.firstChild;
      if (redraw) {
        lastKey = key;
        if (mode === 'google') { if (gRunner) gRunner.setMap(null); gRunner = null; renderGoogle(el, scene); }
        else { gmap = null; el.innerHTML = svgFallback(scene); }
      }
      if (scene.runner == null) { cancelAnimationFrame(anim.raf); anim.cur = 0; anim.target = 0; if (gRunner) gRunner.setMap(null); return; }
      if (redraw && mode !== 'google') placeRunnerSvg(anim.cur);
      if (anim.target !== scene.runner || redraw) setRunner(scene.runner);
    },
    /* Static, non-interactive SVG for dashboards. */
    staticSvg(scene) { return svgFallback(scene).replace('<g id="runnerDot"', '<g data-static="1"').replace(' id="routeLine"', ''); }
  };
  window.Maps = Maps;
})();
