# Frontend restyle — Crisp + Persimmon system

Status: spec · 2026-05-11
Scope: `apps/web` only · pure restyle (no behavioural rewrites)
Driver: `design_handoff_eat_thing/` (handoff bundle in repo root)

---

## Goal

Replace the current dark-indigo theme of `apps/web` with the "Crisp" palette + Schibsted/Lora typography system defined in the design handoff, while keeping every existing feature working. Defer the handoff's new screens (Home dashboard) and new behaviours (Playwright send-to-store CTA, scan-receipt, print, delivery-window picker, per-meal reason chips, editor's pick) until they have backing data or roadmap slots.

## Non-goals

- New Home page (`/` will continue to redirect to `/inventory`).
- New "Shops" nav destination.
- Mobile redesign — handoff is desktop-only (1280px); existing mobile CSS stays as-is, with the new palette/fonts cascading naturally.
- Any backend or behavioural changes beyond the single small additive migration in §3.4.
- Modals (ItemForm, RecipeForm, ImportModal, CookModal, StaplesModal) — they keep their current structure; only their palette/typography updates via the global tokens.

---

## 1. Design tokens

### 1.1 Color (locked — "Crisp" palette + persimmon accent)

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#f3f5f2` | App background |
| `--paper2` | `#eaeee7` | Sidebar / nested surface |
| `--cream` | `#e6ebe4` | Chip fills, image-slot placeholder |
| `--ink` | `#0d1714` | Primary text, header bar, dark cards |
| `--ink2` | `#3a443e` | Secondary text |
| `--ink3` | `#5a6359` | Tertiary text, italic captions |
| `--mute` | `#6e7872` | Labels, meta |
| `--green` | `#1f5d33` | Section dots, "produce" accent |
| `--fresh` | `#5aa758` | Cook-now / safe-state accent, agent-idle dot |
| `--persimmon` | `#d96e2e` | **Primary accent** — CTAs, headline periods, needs-shop |
| `--persim-deep` | `#b6541d` | Persimmon text on light backgrounds |
| `--warn` | `#c2412e` | Expired |
| `--rule` | `rgba(13,23,20,0.08)` | 1px dividers |
| `--rule2` | `rgba(13,23,20,0.04)` | Soft row dividers |

These replace every existing variable in `index.css` (`--bg-primary`, `--bg-active`, etc.).

### 1.2 Typography

- **Sans (UI):** `"Schibsted Grotesk", system-ui, sans-serif` — weights 400 / 600 / 700 / 800
- **Serif (display + italics):** `"Lora", serif` — italic 400 / 500
- Both loaded via `<link>` to Google Fonts in `apps/web/index.html`.
- Inter is removed.

Type scale (desktop):

| Use | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Page title (italic serif, e.g. `Inventory.`) | Lora italic | 56px | 400 | -0.02em |
| Section header (italic serif) | Lora italic | 28px | 400 | — |
| Sub-section header (italic serif) | Lora italic | 22–24px | 400 | — |
| Card title | Schibsted | 18–19px | 600 | -0.012em |
| Body | Schibsted | 14px | 400 | — |
| Italic caption / "need X, Y & N more" | Lora italic | 12–14px | 400 | — |
| Eyebrow label | Schibsted | 11px | 600/700 | 0.12–0.14em, uppercase |
| Mono-feel data | Schibsted, `tabular-nums` | 11–13px | 600 | — |

**Recurring move:** every page title and section header ends with a persimmon-colored period (`Recipes<span class="dot">.</span>`).

### 1.3 Shape

- Page horizontal gutter: 36px (24px on narrow viewports — existing mobile breakpoint).
- Card padding: 14–22px.
- Card radius: 10–14px; buttons/inputs: 8px; chips: 999px.
- Section gap: 28–36px; grid gap: 12–16px.

### 1.4 Iconography

Inline unicode glyphs only: `⌕` (search), `→` italic-serif (Lora), `·` (separator). Existing emoji-only icons in modals (`✎`, `✕`, `🗑`, `✓`) stay — they're internal-action affordances, replacing them is out of scope.

### 1.5 Where these live

A single new file `apps/web/src/styles/tokens.css` holds CSS custom properties and global font-face / Google Fonts link wiring. `index.css` is rewritten to consume them. Each page's existing CSS file (`InventoryPage.css`, `RecipesPage.css`, etc.) is updated to use the tokens — no CSS Modules conversion, no new build deps.

---

## 2. Global chrome

### 2.1 Header (`TopNav`)

Replace the gradient wordmark + indigo pill nav with the handoff treatment:

- Background: `--ink`. Padding: `14px 36px`.
- Left: wordmark `Eat<span class="logo-italic">thing</span>` — Schibsted 22/800 + Lora italic 28/400 in persimmon.
- Center: nav links — Schibsted 13/600, lowercase. Active link has a persimmon 2px bottom-border + full-opacity paper color; inactive links use `paper` at 60% opacity.
- Right: date stamp (`mon · may 11`, uppercase 11px 0.04em tracking, 70% paper opacity) + avatar circle (30px, persimmon bg, paper letter — first initial of signed-in user).
- Nav items in order: `home`, `inventory`, `recipes`, `plan`, `list`. (No `shops`.) `home` routes to `/`, which still redirects to `/inventory` for now — the visible "home" link mirrors that redirect so adding a real Home later is a route swap.

The component contract stays the same — it's a styling rewrite of `TopNav.tsx` + `TopNav.css`, plus a tiny addition that pulls the user initial + today's date via existing `useSession`.

### 2.2 Page shell

All pages adopt the same shell:

```
<header> (TopNav)
<div class="page">
  <div class="page-title-row">    ← eyebrow + italic-serif title + summary line + action buttons (top-right)
  <div class="page-strip">        ← filter pills + search + sort (when applicable)
  <main class="page-body">        ← page-specific content, scrollable
</div>
```

A reusable `PageTitle` component (props: `eyebrow`, `title`, `summary`, `actions`) lives in `apps/web/src/components/PageTitle.tsx`. Similarly a `FilterStrip` component wraps the persistent pill/search/sort row.

---

## 3. Per-page changes

### 3.1 Inventory page

**Keep:** location filter tabs, search, add-item flow, edit-on-click, delete-with-confirm, the four locations (fridge/pantry/freezer/other).

**Restyle:**
- `<h1>Inventory</h1>` → eyebrow (`THE KITCHEN · 9:14 AM`) + italic Lora `Inventory.` + summary line (`{total} items on hand · {expiring} expiring this week · last reconciled today, 9:14 a.m.`). The eyebrow timestamp and "last reconciled" line use the current time; "expiring" counts items with `expiresAt` within 7 days.
- Header right gets a single primary button `+ add item` (persimmon). No "scan receipt" button (out of scope).
- Filter strip becomes the design's pill row: All / Fridge / Pantry / Freezer / Other, each with item count, active pill is `--ink` bg with `--paper` text, inactive is `transparent` with `--rule` border. Search input gets a `⌕` glyph prefix. New trailing `sort by expiry ↑` dropdown — for now hard-coded to expiry-ascending; the dropdown is a static display until a sort menu is built (future).

**Add:**
- **"Use this week" strip** — dark (`--ink`) card above the filter strip. Title `use this week` (Lora italic 18) + uppercase eyebrow `SOONEST TO EXPIRE · N`. Shows up to 5 items with `daysUntil(expiresAt) ≤ 3`, sorted ascending. Each cell: italic Lora `{N}d` (persimmon if `≤1`, paper otherwise), Schibsted 13/600 food name, 11/regular qty+brand. Hidden if there are zero items expiring within 3 days.
- **Section-grouped rows always visible** — even when "All" tab is active, rows are grouped by location with a paper2 section header (italic Lora 22 location label + Schibsted 12 item count). When a non-"All" tab is selected, only that location's section is rendered.
- **Tabular row layout** — replaces card rows. 5 columns:
  `qty (90px) | item+brand (1fr) | added (130px) | expires (110px) | edit (60px)`.
  - `qty`: tabular-nums Schibsted 14/600 with unit.
  - `item`: Schibsted 15/500 name + italic Lora 12 brand below.
  - `added`: e.g. `5d ago`, Schibsted 12/mute, tabular-nums.
  - `expires`: coloured dot (size 6, opacity-driven by urgency) + day count. When urgency is `soon` (≤3d) or `expired`, the count switches to italic Lora 16 (persimmon for soon, warn for expired). Otherwise Schibsted 13/500 in fresh/persim-deep/mute by urgency tier.
  - `edit`: fades in on row hover (`opacity` 0 → 1), shows a small `edit` chip + a `✕` confirm-delete flow that matches today's behaviour.

**Drop from design:** the `spot` column (no sub-location field), the `scan receipt` button.

**Data sources:** all existing — `useInventory`, `useDeleteInventoryItem`. No API changes.

### 3.2 Recipes page

**Keep:** add/edit/import flow, search, delete, all existing modals.

**Restyle:**
- Title row matches inventory: eyebrow (`MONDAY · MAY 11`) + italic Lora `Recipes.` + summary (`{cookable} cookable with what you have · {shoppable} a quick shop away · {total} in the library`). Right side: secondary `↓ import url` + persimmon `+ new recipe`.
- Filter strip pills: All / Cook now (`--fresh` dot) / Quick shop (`--persimmon` dot) / Library. Search + a static `sort: cookable first` dropdown.

**Add:**
- **Inventory-aware sectioning** — at view time, compute `missing(recipe) = recipe.ingredients.filter(i => not satisfied by inventory)`. Buckets:
  - `cookable` if `missing.length === 0`
  - `shoppable` if `1 ≤ missing.length ≤ 3`
  - `library` if `missing.length ≥ 4`
  - The matching reuses the same logic that the shopping-list generator uses on the server. To avoid a new endpoint for this view, the simplest implementation is a new client-side helper `computeRecipeMissing(recipe, inventory)` that takes the existing `useRecipes()` + `useInventory()` data and groups by aisle. Names + canonical-food IDs already exist on both ends; the match is `inventory.some(i => i.canonicalFoodId === ingredient.canonicalFoodId && i.qty >= scaledNeed)` with a fallback to name-equality when canonicalFoodId is null.
- **Editorial hero (lite)** — the first cookable recipe (no curation) gets rendered in a 2fr/1fr grid block above the sections:
  - Left: ink card with persimmon-tinted eyebrow chip `COOK TONIGHT · USES WHAT YOU HAVE`, italic Lora 56 recipe name + persimmon period, body copy (static: "Ready in minutes from what's already on hand."), persimmon `open recipe →` button (opens existing edit modal in view mode), and meta strip (servings + ingredient count). **No "add to wednesday" CTA** (deferred).
  - Right: a portrait card with the recipe's `photo` if present, else a cream placeholder block with the recipe name in Lora italic 24. No `editor's pick` badge; this slot uses the *second* cookable recipe (if any) as a secondary feature.
- **Image-top cards** — `RecipeCard` becomes image-top with status badge (top-left) and a serves/ingredients overlay (bottom-right). If `recipe.photo` is null, the image area renders a cream block with the recipe name in italic Lora centered. Library variant is `dense` (shorter image, no missing-list caption). Hover affordances (edit, delete) move to a `⋯` menu on each card.

**Drop from design:** `editor's pick` badge, time chip (no `time` field on `recipe`), tag chips (no `tags` field), `add to wednesday` button.

**Data sources:** `useRecipes`, plus `useInventory` for the matching helper. No API changes.

### 3.3 Meal plan page

**Keep:** week navigation, draggable recipes sidebar, drop-to-add, tap-+-to-pick fallback, inline servings edit, mark-cooked + CookModal, delete entry, multi-entry per day, today highlighting.

**Restyle:**
- Title row: eyebrow (`WEEK {N} · {RANGE}`) + italic Lora `This week.` + summary (`{pantry} from the pantry · {shop} need a shop · {open} open seat`). Right side: `← last week` / `next week →` (existing prev/next, styled as outline buttons) + persimmon `regenerate list →` button that calls the existing generate-shopping-list mutation.
- Existing week-range string moves into the eyebrow row.

**Add:**
- **Proportion bar strip** — 8px-tall rounded bar with four segments (`fresh`/`ink`/`persimmon`/transparent for pantry/leftover/shop/open) and a legend (dot + label + count). Right of the bar, a single sliver shows the week's shop count: eyebrow `WED SHOP` + `{N} items · view list →` (persimmon link, navigates to `/list`). Hidden when there are zero entries.
- **Day cards (new layout)** — 7-column grid. Each day card has:
  - Header row: eyebrow `{DAY} · {DD}` (left) + italic Lora context label `today` / `tomorrow` / empty (right).
  - Image strip for the *first* planned entry. Cream placeholder when no photo.
  - Schibsted 18/600 recipe name (first entry only).
  - Italic Lora `need X, Y & N more` line for the first entry when `missing.length > 0`.
  - Meta line: `{time}m · serves {N}` — `time` is **dropped** (no field); shown as `serves {N}` only.
  - **Additional entries** for the same day stack below the first as compact follow-up rows (Schibsted 14/500 name + `serves N` + a small ✕). This preserves the existing multi-entry capability without redesigning it.
  - Status chip (one of cook now / needs shop / leftover / open seat).
- **Today's card is dark** (`--ink` bg, paper text, persimmon eyebrow), as in the mock.
- **Open day** renders the dashed empty state with italic Lora `open seat` + `drop a recipe` hint.
- **Fill open day suggestion strip** — only when at least one day in the visible week has no entries. A bordered section below the 7-day grid: italic Lora 24 `Fill {DayName}.` + uppercase `THREE PICKS`. Each row: recipe name + italic-serif hint (`uses N expiring`, `all pantry`, `add to wed shop`) + status chip + `place in {day} →` button that adds the entry. Picks come from `useRecipes()` ranked by `cookable > shoppable > library`, top 3 not already in the week.
- **Wednesday auto-shop preview card** — **DROPPED** (no scheduled-shop concept).

**Data sources:** `useMealPlanWeek`, `useRecipes`, `useInventory`. The inventory-match helper from §3.2 is reused. No API changes.

### 3.4 Shopping list page

**Keep:** generate button, staples flow, add/delete/check-off, price column, refresh-prices flow.

**Restyle:**
- Title row: eyebrow (`AUTO-BUILT · LAST UPDATED {HH:MM}`) + italic Lora `The list.` + summary (`{N} items across {sections} sections · for this week's plan`). Right side: outline `+ add item` (toggles the existing add-item form into view) — **`print` button is dropped**.

**Add (palette + structure):**
- **Filter pills** — All / From recipes / Staples / You added (matches today's three sources). Per-meal pills ("Wed roast", "Fri pizza") are **dropped** because shopping-list items don't track meal provenance today.
- **Group by food category** instead of by source — see §3.5 below.
- **Reason chips** on each item row — italic Lora 12 chip with the item's source: `from recipes` (persim-deep), `low staple` (green), `you added` (ink3). Right-aligned to the price.
- **Custom checkbox** — replaces native `<input type="checkbox">`. 18×18 rounded square. Unchecked: `--rule` border, transparent fill. Checked: `--green` border + fill with white tick SVG. Reuses existing `onChange` handler.
- **Two-pane layout** — left (1fr) is the aisle-grouped list; right (360px) is a sticky sidebar.

**Sidebar contents** (top-to-bottom):
- **Store sticker** — eyebrow `SEND TO`. A bordered tile showing the store currently being used for price checks: green 28×28 initials box (`NW`/`PS`/`WW` for New World / Pak'nSave / Woolworths). The store name is read from the existing `usePricesForList` response — both the active price-refresh `job.store` and the persisted `shoppingListPrices.store` carry the store identifier, so no new endpoint is needed. When no prices have ever been fetched, the tile renders as "no store connected" with neutral styling. A grey `change` text-button — **disabled with tooltip "coming soon"** until the store-picker UI ships in Slice 3.
- **Totals card** — bordered paper card. Single row: italic Lora `est. total` + tabular-nums Schibsted 24/800 number (sum of priced items only). Beneath it, mute caption: `N priced · M without a match`.
- **Send-to-store button** — full-width persimmon button `send to {store name} →`. **Disabled with hover hint "coming soon · phase 4"**.
- **Agent status card** — ink-bg card. Top row: pulse dot (`--fresh` when idle/success, `--persimmon` when running, `--warn` when failed) + uppercase eyebrow `PLAYWRIGHT AGENT · {STATE}`. Below, italic Lora 14 caption that adapts to state. Driven by the existing `usePricesForList` job state (`pending`/`in_progress`/`done`/`error`) — repurposes the price-refresh job as "the agent" for now.
- **Delivery window grid — DROPPED** (no delivery-window concept).
- **Subtotal / delivery / tax breakdown — DROPPED** (only model subtotal today).

#### 3.5 Food categories — small prerequisite migration

To deliver the broad section grouping on the shopping list, `canonical_foods` gains a `category` column.

**Schema change:**
```ts
// apps/server/src/db/schema/foods.ts
export const canonicalFoods = pgTable('canonical_foods', {
  // … existing columns …
  category: text('category').notNull().default('other'),
});
```

Categories (closed list, also exported from `packages/taxonomy`):
- `produce` — fruit & veg
- `meat` — meat, poultry, fish, seafood
- `dairy` — milk, butter, cheese, yoghurt, eggs
- `pantry` — flour, oils, spices, dried goods, sauces, condiments, canned goods, baking
- `frozen` — anything stored frozen by default
- `drinks` — coffee, tea, soft drinks, alcohol
- `other` — fallback

Display labels (used in section headers):

| category | label |
|---|---|
| produce | `Fruit & veg.` |
| meat | `Meat & fish.` |
| dairy | `Dairy & eggs.` |
| pantry | `Pantry & dry goods.` |
| frozen | `Frozen.` |
| drinks | `Drinks.` |
| other | `Other.` |

**Seed update:** every `SeedFood` in `packages/taxonomy/src/seed.ts` gets a `category: Category` field. The seed's existing comment-grouped layout maps almost 1:1 — the migration just makes the implicit grouping explicit. The shared `Category` union is exported from `packages/shared`.

**Migration:**
- Add `category` column (default `'other'`).
- Re-run `db:seed` to update existing rows by name (the seeder upserts by `name`).
- Manual ingredients (`recipe_ingredients.canonicalFoodId IS NULL`) fall through to `other`.

**API change:** `GET /api/shopping-lists/:id` (or `GET /api/shopping-lists` for the current list) joins `canonical_foods.category` onto each item. Shape: `ShoppingListItem.category: Category`. The `ShoppingList` summary also exposes the `category` for grouping. The shopping list page then groups by `category` client-side with a fixed display order.

**Fallback:** items with no `canonicalFoodId` (manual adds) get `category: 'other'`.

---

## 4. Component inventory

New shared components in `apps/web/src/components/`:

- `PageTitle.tsx` — eyebrow + italic-serif title + summary + actions slot.
- `FilterStrip.tsx` — pill tabs + search + sort. Generic over the tab list.
- `StatusChip.tsx` — `kind: 'cook' | 'shop' | 'leftover' | 'open' | 'expired' | 'soon'`. Used on recipe cards, meal-plan day cards, and inventory rows.
- `EyebrowDot.tsx` — small inline `<span>` for the persimmon-period rule.
- `Wordmark.tsx` — the `Eat<italic>thing</italic>` logotype (extracted from `TopNav` so we can reuse on login).
- `AgentStatusCard.tsx` — ink-bg card with dot + eyebrow + italic caption. Driven by props.

No new external dependencies. Lora and Schibsted Grotesk load via Google Fonts `<link>` in `index.html` (preconnect + `display=swap`).

---

## 5. Testing

- **Unit / component tests:** existing Vitest tests for `TopNav`, `ShoppingListPage`, `dateUtils` continue to pass after the restyle. Update `TopNav.test.tsx` for the new nav items (home, no shops) and the wordmark structure. Add a test for `StatusChip` (each kind renders the correct label + colour token attribute) and for `PageTitle`.
- **E2E:** the existing Playwright suite already covers add/edit/delete flows. Re-run after the restyle. No new E2E tests; visual regression is out of scope here.
- **Storybook:** add stories for the new shared components (`PageTitle`, `FilterStrip`, `StatusChip`, `AgentStatusCard`, `Wordmark`). Update `TopNav.stories.tsx` and `Counter.*` is left alone (already there).
- **The taxonomy migration** gets its own test in `packages/taxonomy`: every `SeedFood` has a `category`, and the union of categories matches the closed list.

CLAUDE.md rule: `pnpm test` and `pnpm test:e2e` must pass before this lands.

---

## 6. Out of scope (explicit deferrals)

- New Home dashboard page — separate spec.
- Scan-receipt, print buttons.
- Delivery-window picker.
- Per-meal reason chips ("wed roast", "fri pizza") on shopping list.
- Active store-picker UI (depends on Phase 3 Slice 3).
- "Send to store" Playwright handoff (Phase 4).
- Editor's pick on recipes (no curation source).
- `time` (cook time) and `tags` fields on recipes — needed for the time/tag chips; left for a separate schema task.
- Mobile redesign — handoff is desktop-only.

---

## 7. PLAN.md insertion

This work is added as a new section under **Cross-cutting / ongoing** in PLAN.md as:

```
## Frontend restyle (in progress)
- [ ] Tokens + Google Fonts + global chrome (header, page shell, title component)
- [ ] Inventory: tabular ledger + use-this-week strip + sectioned groups
- [ ] Recipes: inventory-aware sections + editorial hero (lite) + image-top cards
- [ ] Meal plan: proportion strip + redesigned day cards + fill-open-day suggestions
- [ ] Shopping list: categories migration + two-pane layout + reason chips + agent status
- [ ] Test pass: unit + Storybook + E2E green
```

It is not a numbered phase; it's restyling work that crosses all phases.
