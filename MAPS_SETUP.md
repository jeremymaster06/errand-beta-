# Google Maps setup

The app works without a key and uses a built-in vector map (`js/maps.js`, fallback mode).
To turn on live Google Maps, put a browser key in **one place**: `js/config.js` → `const MAPS_API_KEY = '...'`.
(Optional: `MAPS_MAP_ID` for cloud-styled maps.)

## APIs to enable (Google Cloud Console → APIs & Services → Library)
| API | Used for | Required? |
|---|---|---|
| **Maps JavaScript API** | the live map, markers, polyline, animated runner arrow | Yes |
| **Directions API** (legacy, via `DirectionsService`) — or **Routes API** if you migrate | road-following route polyline between stops in the optimized order | Yes |
| **Places API** (Places library / Autocomplete) | address autocomplete for "Other address…" stops | Recommended |
| **Geocoding API** | turning typed addresses into lat/lng | Recommended |
| Distance Matrix API | *Not used.* Stop ordering is solved client-side (Held-Karp exact ≤ 12 stops, heuristic beyond) on haversine × 1.35 road factor. Enable only if you later swap in real drive times. | No |

## Restrict the key (important: it is visible in page source)
Credentials → your key →
- **Application restrictions → Websites (HTTP referrers):**
  - `https://<your-github-username>.github.io/*`
  - (optional for local testing) `http://localhost:*/*`
- **API restrictions → Restrict key** to only the APIs above.

## Billing
Google Maps Platform requires a billing account on the project, even for usage inside the free monthly credit / free tiers. Set a **budget alert** and per-API **quota caps** (APIs & Services → Quotas) so a leaked or abused key can't run up charges. Dynamic map loads and Directions requests are billed per request beyond the free usage.

## Failure behaviour
If the key is missing, invalid, referrer-blocked, or the script fails to load, `gm_authFailure` / `onerror` switch the app back to the fallback map automatically. No errors are shown to users.
