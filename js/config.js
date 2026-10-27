/* ================= CONFIG — edit here ================= */
/* Google Maps: paste a browser key here to switch from the built-in fallback map to live Google Maps.
 * See MAPS_SETUP.md for which APIs to enable and how to restrict the key. Leave '' for the fallback map. */
const MAPS_API_KEY = 'AIzaSyD09YHw_W7PGrjCkNSpE_SAcdolzVlvBTM';
/* Optional: a Map ID (Cloud-based map styling) for AdvancedMarkers. Leave '' to use classic markers. */
const MAPS_MAP_ID = '';

/* Brand. Accent is the single brand color; every tinted element uses var(--accent). */
const BRAND = { name: 'ErrandCo', plus: 'ErrandCo+', accent: '#6D28D9', onAccent: '#FFFFFF' };
/* Accent options for the prototype menu (first = default). All pass WCAG AA (>=4.5:1) with white text. */
const ACCENTS = [
  { id: 'violet', name: 'Deep violet', hex: '#6D28D9' },
  { id: 'indigo', name: 'Electric indigo', hex: '#5B3FD9' },
  { id: 'cobalt', name: 'Cobalt', hex: '#1D4ED8' }
];
