---
name: Home page (dashboard)
status: design — approved 2026-05-12
owner: @kenese
---

# Home page (dashboard) — design

## Context

The frontend restyle to the "Crisp + Persimmon" system is complete for Inventory, Recipes, Meal Plan, and Shopping List. The Home dashboard was deferred from that effort (see PLAN.md → "Frontend restyle (complete)" → Deferred). The route `/` currently redirects to `/inventory`. This spec covers building the Home page against the design at `design_handoff_eat_thing/direction-3-greengrocer-v2.jsx` and the shared handoff at `design_handoff_eat_thing/README.md`.

Visual language is locked — exact hex, exact typography, exact spacing. All design tokens already live in `apps/web/src/styles/tokens.css`. Chrome (`TopNav`, `Wordmark`, `PageTitle`, `StatusChip`, `AgentStatusCard`, `FilterStrip`) is already shipped. No new tokens are introduced.

## Scope

In:
- New `HomePage` rendered at `/`.
- Wiring to existing `/api/inventory`, `/api/meal-plans`, `/api/recipes`, `/api/shopping-lists` endpoints — no new server work.
- `StatusChip` gains an `--on-hero` modifier (paper-on-green) for the highlighted today card.
- Vitest unit tests, RTL component tests, one Playwright E2E.

Out:
- TopNav label changes (`home → kitchen`, adding `shops`). Tracked separately.
- A real `/api/dashboard` aggregator.
- A real "auto-shop scheduling" concept. The shop card reads the current shopping list.
- Mobile re-cut beyond the existing responsive pattern (collapse to single column + horizontal scroll-snap meals strip).
- Cook-now interactions, recipe deep-links from cards (deferred — cards link to `/plan`).

## Decisions (from brainstorming)

1. **Shop card CTA** navigates to `/list`. Phase 3 slice 3 send-to-store is still WIP; the homepage CTA is a deep link until then.
2. **Hero copy is real data** — pill from coverage logic; sub-copy from inventory counts.
3. **Meals strip is rolling 5 days from today.** Today is the hero card when its status is `cook`. Empty days render as open-seat.
4. **TopNav unchanged.** Current labels stay (`home / inventory / recipes / plan / list`).
5. **Shop card reads the current shopping list,** with an empty state if no list exists.

## File layout

```
apps/web/src/pages/HomePage/
  HomePage.tsx              composes the four sections
  HomePage.css
  HeroBand.tsx              left headline + right "use this week"
  HeroBand.css
  MealsStrip.tsx            5-day rolling strip with hero card
  MealsStrip.css
  ShopPreview.tsx           right "shopping list" card
  ShopPreview.css
  useHomeData.ts            composes 4 query hooks → derived display state
  HomePage.test.tsx         component-level tests
  useHomeData.test.ts       coverage-prefix + aisle grouping + expiring sort
```

`App.tsx` change: `<Route path="/" element={<HomePage />} />` replaces the current `<Navigate to="/inventory" replace />`.

E2E: `apps/web/e2e/home.spec.ts`.

## Data layer — `useHomeData.ts`

Single hook wrapping the four existing TanStack Query hooks. Returns `{ hero, meals, expiring, shop }` plus per-section loading/error state so sections can render independently.

### Inputs (existing hooks)

- `useInventory()` → `inventory_items[]` with `qty`, `unit`, `expires_at`, `canonical_food.{name, category}`
- `useMealPlan(weekStart)` → entries keyed by date with `recipe_id` + `servings`
- `useRecipes()` → recipes with ingredients
- `useShoppingList()` → current list + prices + categories (see commit `fa0af56`)

### Derived values

| Field | Source | Logic |
|---|---|---|
| `hero.onHandCount` | inventory | `items.length` (rows, not summed quantities) |
| `hero.expiringSoonCount` | inventory | items where `expires_at ≤ today + 3d` |
| `hero.expirySubcopyDay` | derived | `dayName(today + 3d)`, lowercase long form (e.g. `wednesday`) — used in sub-copy |
| `hero.coveredDaysPill` | meals (below) | see "Coverage pill" |
| `meals` | mealPlan + inventory + recipes | rolling 5 days from today; per day either `{recipe, status, isToday}` or `{kind: 'open', isToday}`. Status from existing recipe↔inventory match helper (`packages/shared` / commit `925be02`): 0 missing → `cook`, 1+ missing → `shop` with count. `leftover` is not derived from data today; render only if a future cook-event flow surfaces it. |
| `expiring` | inventory | items with `expires_at` set, sorted by days-until-expiry asc, cap to 4. Each: `{name, qty + unit, daysLeft}`. |
| `shop.state` | shoppingList | `'ready'` if list exists with items; `'empty'` if no current list. |
| `shop.total` | shoppingList | `Σ price × qty` for unchecked items; `null` if no prices yet. |
| `shop.aisles` | shoppingList | `groupBy(item.canonical_food.category)`, top 4 by count, each `{name, sampleItems[3], count}`. Overflow collapsed silently. |
| `shop.builtAt` | shoppingList | `shopping_list.created_at` formatted as `built · {dow} {h:mm am/pm}`. |

### Coverage pill

Walk `meals` from day 1 forward. Collect the prefix run of days where status is `cook` (full inventory match). Stop at the first day that is anything else (`shop`, `leftover`, `open`, missing entry).

| Prefix run | Pill copy | Pill shown? |
|---|---|---|
| 0 days (day 1 isn't `cook`) | — | hidden |
| 1 day | `you have what you need for {day}` | yes |
| 2+ days | `you have what you need for {first} & {last}` | yes |

A `cook → open → cook` pattern stops at the open day; the trailing `cook` does not count.

**Day-name formatting (project-wide convention):**
- Coverage pill and sub-copy: lowercase long form — `monday`, `tuesday`, `wednesday`, …
- Meals strip cards: lowercase short form — `mon`, `tue`, `wed`, …
- Shop card big label: lowercase short form — `built sun 9:14 am`.

### Loading & errors

Per-section, not page-level. While a query is pending, that section renders an italic-serif `loading…` placeholder in `--mute`. On error, an italic-serif `couldn't load` line with a sans 12/600 `retry` button (calls `refetch()` on that query). Other sections render normally.

## Visual recreation

All hex / type / spacing values lifted verbatim from the design file. Tokens already exist.

### Page wrapper

New class `.home-page`. No `.page` max-width container — the design is edge-to-edge with 36px horizontal gutters. Below 768px, grids collapse to single column and the meals strip becomes a horizontal scroll-snap row (existing pattern on `PlanPage`).

### Hero band

`padding: 36px 36px 24px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 36px; align-items: end`.

**Left column:**
- Coverage pill — inline-flex, bg `--cream`, `padding 6px 12px`, `border-radius 999px`, `border 1px solid rgba(13,23,20,0.1)`, mb 14. 6×6 dot in `--fresh`. Label sans 12/600.
- Headline — Schibsted 76/700, line-height 0.95, tracking -0.035em, color `--ink`. Mid-phrase `"what's already"` is Lora italic 400 in `--green`. Terminal period in `--persimmon` (use the existing `.dot` class).
- Sub-copy — sans 15 in `--ink2`, max-width 540, mt 14. Format: `{onHandCount} things on hand · {expiringSoonCount} won't make it past {expirySubcopyDay} · the list builds itself.`. When `expiringSoonCount === 0`, drop that middle clause entirely (don't render `0 won't make it past …`).

**Right column ("use this week"):**
- Ink card — `bg --ink`, `color --paper`, `border-radius 14px`, `padding 20px 22px`.
- Header row (flex, justify-between, mb 12): `use this week` sans 16/700; `{expiringSoonCount} items` Lora italic 16 in `--fresh` (the real total — may exceed the 4 rows shown).
- Up to 4 rows (`expiring`). Each row: flex, baseline, gap 12, padding `8px 0`, top border `1px solid rgba(243,245,242,0.14)` on all but the first.
  - Days column: Lora italic 28, line-height 1, width 40, `tabular-nums`, color `--fresh` when `daysLeft ≤ 1` else `--paper`. Text: `{daysLeft}d`.
  - Middle column (flex 1): name sans 14/600; qty sans 11 / 0.6 opacity.
  - Right tag: sans 11/600 uppercase 0.04em, `--fresh` when `daysLeft ≤ 1` else `paper/0.7`. Text: `today` or `soon`.

### Meals strip section

Container is the left column of a `grid 1.6fr / 1fr; gap 24px; padding 8px 36px 28px` lower-row layout (the right column is the shop card).

- Section header row: `this week` sans 22/700 -0.01em + `(5 + an open seat)` Lora italic 22 in `--mute`. Right action `edit plan →` sans 12/600 in `--ink2`, links to `/plan`.
- Card grid: `grid-template-columns: repeat(5, 1fr); gap 12`.

**Card:**
- Default: `border-radius 10px`, `padding 14px`, `border 1px solid rgba(13,23,20,0.08)`, bg `--cream`.
- Day label (top): Lora italic 14, uppercase, letter-spacing 0.02em, opacity 0.7. Lowercase short day name.
- Recipe name (middle, `mt 28`): sans 17/700, tracking -0.01em, line-height 1.1.
- Status chip (bottom, `mt 12`): reuse `StatusChip` (`cook`, `shop`, `open`).

**Today hero card** (when `isToday && status === 'cook'`): bg `--green`, color `--paper`, no border. The status chip needs a paper-on-green look — add `StatusChip` modifier `--on-hero` (see "StatusChip update").

**Open-seat card** (`kind === 'open'`): bg `--paper`, `border 1px dashed --mute`, content centred, `StatusChip kind="open"`.

Cards link to `/plan`.

### Shop preview card

Right column of the lower row. `bg --cream`, `border-radius 14px`, `padding 20px 22px`, `border 1px solid rgba(13,23,20,0.08)`, `display: flex; flex-direction: column`.

**Top row** (flex, justify-between, items-start):
- Eyebrow: `shopping list · ready` (or `· empty`) — sans 11/600 uppercase 0.06em in `--ink2`.
- Big label: `built {dow} {h:mm am/pm}` (or `no list yet`) — sans 26/700 -0.02em.
- Sub-line: `this week` — sans 13 in `--ink2`. (No store concept yet.) Hidden in the empty state.
- Right: total — Lora italic 36 in `--persimmon`, line-height 1, with decimal in sans 18 `--mute`. Hidden if `shop.total === null`.

**Hairline:** `border-top 1px solid rgba(13,23,20,0.08); margin: 14px -22px 12px`.

**Aisle rows** (up to 4):
- `display: grid; grid-template-columns: 74px 1fr 28px; gap 8; padding 6px 0; align-items: baseline`.
- Bottom border `1px dashed rgba(13,23,20,0.1)` on all but the last.
- Left: category name (lowercase, from `canonical_foods.category`) — Lora italic 16 in `--green`.
- Middle: sample items joined by ` · ` (cap 3 items, truncate with ellipsis) — sans 12 in `--ink2`.
- Right: count — sans 13/700 `tabular-nums`, right-aligned.

**CTA button** (`margin-top: auto; padding-top: 14px`):
- bg `--persimmon`, color `--paper`, `border-radius 10`, `padding 14px 16px`, sans 14/700 0.01em.
- `display: flex; justify-content: space-between`.
- Label `check out for me →` (`→` is Lora italic 18, separate span).
- `href="/list"` rendered as `<Link>`.

**Empty state** (`shop.state === 'empty'`):
- Aisle rows replaced with single italic-serif line: `the list builds itself when you plan a meal.` (Lora italic 15 in `--ink2`).
- CTA label becomes `start a list →`, `href="/plan"`.

## StatusChip update

Add an `--on-hero` modifier class for use on the today-hero green card.

- `.status-chip--cook.status-chip--on-hero` → bg `--paper`, color `--green`, dot color `--green`.
- Story: add an `OnHero` story showing the chip on a green background card.
- Test: add one assertion that the modifier class composes correctly.

No other status kinds need the modifier in v1 — the hero card only shows `cook` (it's only hero when today is fully covered).

## Empty states

| Source | Empty state |
|---|---|
| Inventory has 0 items | Coverage pill hidden. Sub-copy: italic-serif `start by adding a few things to your kitchen.` (Lora italic 15 in `--ink2`). "Use this week" card body replaced with single italic-serif `nothing on the edge yet.`. |
| Meal plan has 0 entries this week | All 5 strip cards render as open-seat. Coverage pill hidden. Section header subtitle changes to `(no plan yet)`. |
| Shopping list has 0 items | Shop card empty state above. |
| Recipes table empty | Same as "0 meal-plan entries". |

## Mobile (≤ 768px)

- Hero band collapses to a single column (`grid-template-columns: 1fr`), gap 24px, "use this week" stacks below.
- Lower row collapses to a single column. Meals strip becomes a horizontal scroll-snap row matching the `PlanPage` pattern.
- Headline drops from 76 → 48 (existing scale on other pages).

## Tests

**`useHomeData.test.ts` (Vitest):**
- Coverage-prefix logic across 6 fixtures: all-cook, cook→shop, shop on day 1, open on day 1, cook→open→cook, all-open.
- Aisle grouping respects `canonical_food.category` and caps at 4.
- Expiring sort orders by days-until-expiry and caps at 4.
- `daysLeft ≤ 1` toggles the "today" tag.

**`HomePage.test.tsx` (RTL):**
- Renders coverage pill copy from a fixture (`mon & tue`).
- Renders sub-copy with on-hand and expiring counts.
- Meals strip renders exactly 5 cards; today's card is the hero when status is `cook`.
- Shop card empty-state renders the italic-serif line and `start a list →` CTA.
- CTA `href="/list"` (or `/plan` in empty state).

**`home.spec.ts` (Playwright E2E):**
- Logged-in user lands on `/`.
- Sees Wordmark + all four blocks.
- `check out for me →` navigates to `/list`.
- `edit plan →` navigates to `/plan`.

## Acceptance

- `/` renders `HomePage` for authenticated users; unauthenticated still routes to login.
- All four blocks match the design file's hex/type/spacing.
- All listed unit + E2E tests pass.
- `pnpm test` and `pnpm test:e2e` both pass from the repo root (per CLAUDE.md).
- PLAN.md "Frontend restyle (complete) → Deferred → Home dashboard" gets moved to a completed line with today's date.
