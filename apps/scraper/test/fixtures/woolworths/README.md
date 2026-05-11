# Woolworths fixtures

Hand-rolled HTML mirroring the parsing surface used by the adapter
(`apps/scraper/src/stores/woolworths.ts`). Selectors:

- Search results: `ul[data-testid="product-grid"] > li[data-product-id]`
  with `.product-name`, `.product-brand`, `.product-price`,
  `data-in-stock="true"|"false"`.
- Past orders: `section[data-testid="past-orders"] li[data-product-id]`
  with `.item-name`, `.item-brand`.
- Logged-out marker: `div[data-testid="login-required"]`.

## Refreshing against the live site

When the smoke test fails because Woolworths ships markup changes:

1. Run `pnpm --filter @eat/scraper bootstrap:woolworths` and log in.
2. Navigate to search and orders pages, copy outerHTML via dev tools.
3. Update the parser in `woolworths.ts` to handle the new structure.
4. Replace the fixtures here with trimmed versions (drop nav chrome,
   keep the structures the parser reads).
5. Re-run `pnpm --filter @eat/scraper test`.
