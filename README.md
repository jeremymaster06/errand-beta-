# ErrandCo — redesign (static, GitHub Pages ready)

Open `index.html` (or serve the folder). All paths are relative; `.nojekyll` included.

- **Customer:** Home → Stops (on-route upsells, free-stop progress, bundles) → Optimized route → Options (Standard/Pro, favorite runner) → Upfront price → Matching → Tracking → Chat → Rate/Tip/Favorite. Tabs: Activity, Favorites, Account.
- **Runner:** go online, Pro offer with higher pay, optimized route with "carrying now", earnings, Pro progress.
- **Owner:** overview KPIs, live jobs, runners, tiers, pricing, basket & upsells, support, competition.
- ⋯ menu: accent color (Deep violet default) and, on phones, the view switcher.

Files: `js/config.js` (Maps key, brand, accent), `js/solver.js` (route optimizer), `js/maps.js`, `js/data.js`, `js/app.js`, `css/app.css`.
Tests: `node --test tests/` · Maps: see `MAPS_SETUP.md`.
