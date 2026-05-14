# Ideas

Post-MVP feature ideas. Not planned, not scheduled — just captured so they're not lost.

---

## Multi-store supermarket support

Adapters for Pak'nSave and Woolworths already exist in `apps/scraper` (parsers, fixtures, bootstrap scripts, smoke tests). Wiring them in requires:

- Headed bootstrap login for each store (same flow as New World)
- `bootstrap:ingest` on the Mac mini per store
- Multi-store fan-out: enqueue a `compare_prices` job per active session when the user refreshes prices
- UI to surface results: show per-store price and stock, not just New World

### Price optimisation ideas

- **Cheapest store**: given the full shopping list, which single store is cheapest overall?
- **Convenient store**: weight by distance or preference rather than pure price
- **Split shop**: identify items where the savings at store B justify the trip (e.g. only split if saving > $X)
- **Price history**: track price over time per SKU, surface trends ("eggs are cheaper this week")
- **Loyalty pricing**: some stores show member vs non-member prices — capture both

### Scraper robustness (multi-store)

- Logged-out detection per store with user prompt to re-bootstrap
- Per-store retry/backoff when the scraper hits a transient block
- Alert if a store's selectors go stale (zero results from a live search)

---

## Scan receipt

Upload a supermarket receipt photo → LLM extracts line items → auto-update inventory with quantities and prices paid. Useful for stores not covered by the scraper.

---

## Learned staples

After several months of purchase history, derive which items are bought on a regular cadence and suggest them as staples with inferred thresholds. (See D7.)

---

## Delivery-window picker

When building to cart, let the user pick a delivery window before handing off to the store checkout. Requires understanding each store's delivery slot API.

---

## Native mobile shell

Capacitor or React Native wrapper around the PWA for push notifications (e.g. "your delivery is on the way", "a staple is running low"). Deferred until PWA limitations are actually felt.
