# ErrandCo — redesign (static, GitHub Pages ready)

Open `index.html` (or serve the folder). All paths are relative; `.nojekyll` included.

- **Customer:** Home → Stops (on-route upsells, free-stop progress, bundles) → Optimized route → Options (Standard/Pro, favorite runner) → Upfront price → Matching → Tracking → Chat → Rate/Tip/Favorite. Tabs: Activity, Favorites, Account.
- **Runner:** go online, Pro offer with higher pay, optimized route with "carrying now", earnings, Pro progress.
- **Owner:** overview KPIs, live jobs, runners, tiers, pricing, basket & upsells, support, competition.
- ⋯ menu: accent color (Deep violet default) and, on phones, the view switcher.

Files: `js/config.js` (Maps key, brand, accent), `js/solver.js` (route optimizer), `js/maps.js`, `js/data.js`, `js/app.js`, `css/app.css`.
Tests: `node --test tests/` · Maps: see `MAPS_SETUP.md`.

## Adding stops (no presets)
After a trip starts, nothing is pre-filled: the customer types a store or address.
- Autocomplete starts after 3 letters (300 ms debounce). With `MAPS_API_KEY` set in `js/config.js` it uses Google Places (New) `AutocompleteSuggestion` with session tokens, biased to Great Neck. Without a key, or if the key fails (`gm_authFailure`), it uses a built-in Great Neck / Nassau dataset (`js/places.js`) with fuzzy prefix matching.
- Store results open a DoorDash-style store browser (`js/addstop.js`): sticky category tabs, search across the whole catalog, + buttons and quantity steppers, custom items, and a per-stop cart. The cart sets the stop's items and the upfront price (service fee + spending cap, which is goods × 1.2 rounded up to $5).
- Personal places (homes, addresses) skip the browser and go to Pick up / Drop off / Other task.

## Catalog provider (`js/catalog.js`)
`Catalog.setProvider(p)`, where `p` implements async `getStore(kind, place)`, `getCategories(storeId)`, `getItems(storeId, category)` and `searchItems(storeId, query)`.
Items: `{id, name, price, category, image, icon, unit, inStock, rx}`. The bundled SampleProvider ships illustrative menus. Swap in a real backend or partner API without touching the UI.

## Tests
`node --test tests/solver.test.js` · `python3 tests/e2e_addstop.py` · `python3 tests/e2e_playwright.py` · `python3 tests/e2e_overlap.py` (serve the folder on :8765 first).
See MAPS_SETUP.md and SECURITY_COST_CHECKLIST.md.
