# Google Maps setup

Put a browser key in `js/config.js` as `MAPS_API_KEY`. With no key the app runs fully offline, using a built-in map and local place search.

## APIs to enable (Cloud Console → APIs & Services → Library)
| API | Used for |
|---|---|
| Maps JavaScript API | the live map, loaded lazily the first time a map is shown |
| Places API (New) | `AutocompleteSuggestion` + `Place.fetchFields` (session-token billed) |
| Routes API | `Route.computeRoutes`, called only once stops are final (route review onward), cached per stop set |
| Geocoding API | turning a typed free-text address into a location |
| Directions API (Legacy, optional) | fallback only; new projects can't enable it, and the app works without it |

## Restrict the key (it is visible in the page source)
1. Credentials → your key → **Application restrictions → Websites (HTTP referrers)**: add `https://<user>.github.io/<repo>/*` (and `http://localhost:8765/*` for development only; remove it before launch).
2. **API restrictions → Restrict key**: tick only the APIs in the table above.
3. Never reuse this key server-side. Server calls need a separate, IP-restricted key.

## Quotas and billing alerts
- APIs & Services → each API → **Quotas**: cap requests per day and per minute per user (for example, Autocomplete at 5,000/day to start), so a leaked key can't run up a bill.
- Billing → **Budgets & alerts**: create a monthly budget with email alerts at 50%, 90% and 100%.
- Cost controls in code: 3-char minimum, 300 ms debounce, stale-request dropping, session tokens (autocomplete plus one details fetch billed as a session), field mask `displayName, formattedAddress, location, types`, memory + sessionStorage caching, lazy script loading, and no routing while stops are still being edited.

## Failure behaviour
On a bad or restricted key, `gm_authFailure` switches the map to the built-in SVG and place search to the local dataset, with no errors shown to the customer.
