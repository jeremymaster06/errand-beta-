/* SF Symbols–style line icons (24x24, 1.8 stroke). icon(name, cls) -> inline SVG string. */
const ICONS = {
  house: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  star: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6',
  cart: 'M3 4h2.5l2.2 11h10.6L20.5 7H6.4M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  hanger: 'M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3l9 6.5a1.5 1.5 0 0 1-.9 2.7H3.9A1.5 1.5 0 0 1 3 14.5L12 8',
  ret: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  envelope: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM8.5 8.5l7 7',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  pickup: 'M4 11l8-7 8 7v9H4zM12 14v6M9 17l3-3 3 3',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  chevR: 'M9 5l7 7-7 7', chevL: 'M15 5l-7 7 7 7', chevD: 'M5 9l7 7 7-7',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6 6 18', check: 'M5 12.5l4.5 4.5L19 7',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  gear: 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  shieldck: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM8.5 12l2.5 2.5 4.5-5',
  car: 'M5 16V11l2-5h10l2 5v5M3 16h18v3h-3M6 19H3M7.5 13.5h.01M16.5 13.5h.01',
  seal: 'M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2zM8.5 12l2.5 2.5 4.5-5',
  gift: 'M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7S10 3 7.5 4 9 7 12 7zM12 7s2-4 4.5-3S15 7 12 7z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  camera: 'M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  turn: 'M6 20V11a3 3 0 0 1 3-3h9M14 4l4 4-4 4',
  power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0',
  dollar: 'M12 2v20M17 6.5C16 5 14.3 4.5 12 4.5c-3 0-5 1.3-5 3.5s2 3 5 3.5 5 1.5 5 3.7-2 3.3-5 3.3c-2.5 0-4.3-.7-5.3-2.3',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a3 3 0 0 1 3-3h1M18 9v6a3 3 0 0 1-3 3h-5',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  flame: 'M12 21c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2.5 3-4 3 .5-2 0-4-1-5-1 4-5 6.5-5 11 0 4.3 3 7 7 7z',
  heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  sos: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16h.01',
  ellipsis: 'M6 12h.01M12 12h.01M18 12h.01',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  leaf: 'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l7-7',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c.6-3.5 3.3-5 7-5s6.4 1.5 7 5M16 4a3.5 3.5 0 0 1 0 7M18 15c2.2.5 3.6 2 4 5',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5',
  wrench: 'M14.5 5.5a4 4 0 0 0 5 5L12 18a2.1 2.1 0 0 1-3-3zM14.5 5.5 17 3l1 3 3 1-2.5 2.5M4 20l5-5',
  paw: 'M8 8.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM16 8.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM4.5 13a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM19.5 13a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.2 2 2.5 2 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.3 0 2.5-.5 2.5-2 0-2.5-2.5-6-5.5-6z',
  bread: 'M5 20V11a3.5 3.5 0 0 1-1-6.5C6 3 9 3 12 3s6 0 8 1.5A3.5 3.5 0 0 1 19 11v9z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  snow: 'M12 2v20M4 7l16 10M20 7 4 17M9 4l3 2 3-2M9 20l3-2 3 2',
  sneeze: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 10h.01M15 10h.01M9 15.5c1.8 1.3 4.2 1.3 6 0',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  brush: 'M18 3l3 3-9 9-3-3zM9 12c-3 0-4 2-4 4s-1 3-2 4c4 0 8-1 8-5',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9 20 18M8.1 16.1 20 6',
  creditcard: 'M3 6h18v12H3zM3 10h18'
};
function icon(n, cls = '') { const d = ICONS[n] || ICONS.ellipsis; return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`; }
/* RULE: data (typed, API or stored) never goes into href, src or style attributes; only static/numeric values do (tests/no_html_sinks.test.js).
   dom(markup) -> DocumentFragment. Builds the app's own static template markup with createElement(NS) and text nodes; no HTML sinks.
   Data must be esc()'d into templates: it is decoded back to plain text nodes, never parsed as tags. */
const SVGNS = 'http://www.w3.org/2000/svg', VOID = /^(br|hr|img|input|wbr)$/;
const unesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[k]));
function dom(html) {
  const st = [document.createDocumentFragment()];
  for (const m of String(html).matchAll(/<\/([\w-]+)\s*>|<([\w-]+)((?:\s+[^\s=>\/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+|</g)) {
    const top = st[st.length - 1];
    if (m[1]) { const i = st.findLastIndex(e => e.localName && e.localName.toLowerCase() === m[1].toLowerCase()); if (i > 0) st.length = i; continue; }
    if (!m[2]) { top.append(unesc(m[0])); continue; }
    const svg = m[2] === 'svg' || top.namespaceURI === SVGNS, e = svg ? document.createElementNS(SVGNS, m[2]) : document.createElement(m[2]);
    for (const a of m[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) e.setAttribute(a[1], unesc(a[2] || ''));
    top.append(e); if (!m[4] && !VOID.test(m[2])) st.push(e);
  }
  return st[0];
}
