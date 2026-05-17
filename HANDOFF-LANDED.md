# HANDOFF-LANDED.md

---

## Recipes design review — 2026-05-17

Source: `TODO.md` (12-item review against live `/recipes` page). Three commits on `main`.

### Commit 1 — Visual gaps (`4c55e7d`)

- **`RecipesPage.tsx`** — `EditorialHero`: added outline `add to next open day` CTA button wired to `useAddToNextEmptyDays`; `// HANDOFF: day picker` comment left. Added `editor's pick` eyebrow badge on side card image (white pill, `--persim-deep` text). Added `<StatusChip>` + `serves N` footer row in side card body.
- **`RecipesPage.css`** — `.rx-card:hover`: replaced `border-color: var(--persim-deep)` with `translateY(-2px)` lift + shadow + darker rule. Added `.rx-hero-side-badge`, `.rx-hero-side-footer`, `.rx-hero-side-meta`.

### Commit 2 — Data-layer (`3a10cee`)

- **`apps/server/src/db/schema/recipes.ts`** — added `totalTimeMinutes` (int, nullable) and `tags` (text[], default `{}`) columns.
- **`apps/server/drizzle/0009_recipe_time_tags.sql`** — migration (apply with `pnpm --filter @eat/server db:migrate`).
- **`packages/shared/src/index.ts`** — `RecipeSummary` gains `totalTimeMinutes`, `tags`, `canonicalFoodIds`.
- **`apps/server/src/routes/recipes.ts`** — GET `/api/recipes` summary query returns the three new fields; `canonicalFoodIds` comes from a subquery on `recipe_ingredients`.
- **`apps/web/src/lib/recipeMatch.ts`** — added `computeMissingFromIds(canonicalFoodIds, inventory)` for summary-level bucketing.
- **`apps/web/src/pages/RecipesPage/RecipesPage.tsx`** — `sortedByMatch` memo now uses `computeMissingFromIds` instead of hardcoded `[]`. Card meta overlay renders `{N} min · serves {S}`. Tag pills in card footer.
- ⚠ **Rollout note:** fixing the bucketing heuristic reshuffles `/recipes` based on actual inventory. This is spec-correct but a visible change. Feature-flag the rollout if preferred.

### Commit 3 — Copy & cosmetic (`131d047`)

- **`RecipesPage.tsx`** — Hero eyebrow now dynamic (`cook tonight · uses N expiring`). Hero body renders up to 3 expiring inventory items as Lora-italic `<em>` spans; falls back to generic when nothing is expiring. Section title leading circles removed; period spans carry the section accent via inline style. Quick shop hint restored to full text. PageTitle eyebrow `.toUpperCase()` removed. FilterStrip trailing slot is now a real `<select>` with `cookable first / recently added / name a–z` options.
- **`RecipesPage.css`** — Removed `.rx-section-dot`. Added `.rx-sort-label`, `.rx-sort-select`.

### Stubs / open questions remaining

1. **`// HANDOFF: day picker`** in `EditorialHero` — outline button labels `add to next open day`; replace handler + label when day-picker is designed.
2. **`ShoppingList.scheduledDate`** — quick shop hint uses generic fallback `auto-added to your next list`; add a scheduled-date field to the data model to make it dynamic.
3. **`total_time_minutes` migration** — run `pnpm --filter @eat/server db:migrate` to apply `0009_recipe_time_tags.sql` against production DB.

---

Design refresh landed 2026-05-17. Source: `design_handoff_eat_thing/`.

---

## Files Changed

### Tokens / Global
- `apps/web/src/index.css` — added `.caption-serif`, `.eyebrow`, `.btn-outline--on-dark`; hide TopNav on mobile (`≤768px`); add `padding-bottom: 72px` to `.app-body` on mobile

### Top Nav
- `apps/web/src/components/TopNav.tsx` — added `shops` stub `<span>` (not a NavLink)
- `apps/web/src/components/TopNav.css` — `.topnav-link--stub` (opacity 0.35, cursor default)
- `apps/web/src/components/TopNav.test.tsx` — updated assertion: checks shops text in DOM, links still 5

### Inventory
- `apps/web/src/pages/InventoryPage/InventoryPage.tsx` — two-pane layout, location sidebar card (fridge/pantry/freezer), expiring-soon sidebar card, low-staples stub card
- `apps/web/src/pages/InventoryPage/InventoryPage.css` — section headers 28px (was 22px), `.inv-body` two-pane grid, full sidebar card styles

### Recipes
- `apps/web/src/pages/RecipesPage/RecipesPage.tsx` — color dots before section headers (fresh-green / persimmon / green)
- `apps/web/src/pages/RecipesPage/RecipesPage.css` — `.rx-section-dot`, `.rx-section-header` align-items center, mobile 2-col grid

### Plan
- `apps/web/src/lib/dateUtils.ts` — added `isPast: boolean` to `PlanWindowDay` interface and `planWindowDays()`
- `apps/web/src/lib/dateUtils.test.ts` — asserts `isPast` field for past/today/future
- `apps/web/src/pages/PlanPage/PlanPage.tsx` — complete rework: horizon strip (16+ pills), title controls (←/today/→ + load-date stub + add-recipes-to-list CTA), DayCard with `isPast` (past = 0.5 opacity + line-through name + no drop), recipe drag grid below day grid (full width 4-col)
- `apps/web/src/pages/PlanPage/PlanPage.css` — complete replacement: horizon strip, scroll controls, day cards, recipe grid below, removed prop-strip

### Shopping List
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` — reason chip moved below item name; wrapped in `.sl-row-main`
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` — section headers 28px (was 22px), checkboxes 22px + `var(--fresh)` when checked (was 18px + `var(--green)`), line-through bug fixed (`.sl-row--checked` → `.sl-row--selected`), new `.sl-row-main` wrapper style

### Mobile
- `apps/web/src/components/BottomTabBar.tsx` — new 5-tab bar (home/pantry/recipes/plan/list), inline SVG icons, NavLink active class
- `apps/web/src/components/BottomTabBar.css` — fixed bottom, blur background, active ink fill behind icon
- `apps/web/src/App.tsx` — imports and renders BottomTabBar inside AppShell

### Tests
- `apps/web/src/components/BottomTabBar.test.tsx` — new (3 tests: renders all tabs, active class, /inventory → pantry)
- `apps/web/tests/app.spec.ts` — updated plan heading assertion "Coming up" → "Plan"

---

## Conflicts Found

| Location | Handoff doesn't cover | What was done |
|---|---|---|
| TopNav | No `/shops` route | Added `shops` as a disabled `<span>` with `// HANDOFF:` comment; no NavLink so existing "does not include a shops link" test still passes |
| PlanPage | `load date` picker UX not designed | Calendar icon button added; `disabled` stub with `// HANDOFF:` comment |
| PlanPage | Recipe drag sidebar → user decided full-width grid | Removed sidebar; recipe drag-and-drop now lives as a full-width 4-column grid below the day grid |
| PlanPage | "Auto-shop preview" panel | Not implemented; would require a shopping-list pre-flight API call |
| RecipesPage `EditorialHero` | "add to wednesday" button | No `// HANDOFF:` stub added (button not visually present in current hero implementation) |
| InventoryPage sidebar | Location breakdown uses category→location mapping | produce/meat/dairy → Fridge, pantry/drinks/other → Pantry, frozen → Freezer |
| InventoryPage sidebar | Low-stock staples widget | Stub card with `// HANDOFF:` comment; requires `useStaples` hook integration |
| ShoppingListPage | Delivery-window 2×2 grid (selected = persimmon outline) | Not implemented — no delivery-window data model exists yet |
| Cook flow | Not in handoff | Preserved as-is; CookModal inherits new button tokens automatically |
| Auth / LoginPage | Not in handoff | Unchanged |
| Storybook stories | Not in handoff | CSS inherits new tokens automatically |

---

## Stubs / TODOs (HANDOFF: prefix)

1. `apps/web/src/components/TopNav.tsx` — `// HANDOFF: shops route — nav tab present but /shops page not yet designed`
2. `apps/web/src/pages/PlanPage/PlanPage.tsx` — `// HANDOFF: load-date picker — calendar icon button is a stub; no date picker modal yet`

---

## Visual Diffs to Spot-Check

Start the dev server: `pnpm --filter @eat/web dev`

| Priority | Screen | URL | What to verify |
|---|---|---|---|
| 1 | Plan page | `http://localhost:5173/plan` | Horizon strip, ink today card, ← today → controls, recipe grid below |
| 2 | Inventory | `http://localhost:5173/inventory` | Two-pane with sidebar cards, 28px section headers |
| 3 | Recipes | `http://localhost:5173/recipes` | Color dots before section titles, align-items center |
| 4 | Shopping List | `http://localhost:5173/list` | 28px section titles, 22px fresh-green checkboxes, reason below name, line-through on checked |
| 5 | Home | `http://localhost:5173/` | Hero band, meals strip, shop preview — confirm unchanged |
| 6 | TopNav | Any page | Shops stub visible and dimmed (opacity 0.35) |
| 7 | Mobile (DevTools 390px) | `/plan` | BottomTabBar visible, TopNav hidden, horizon strip scrollable |
| 8 | Mobile (DevTools 390px) | `/inventory` | BottomTabBar, pantry tab active |
| 9 | Mobile (DevTools 390px) | `/recipes` | 2-col recipe grid |
| 10 | Mobile (DevTools 390px) | `/list` | Checkboxes 22px fresh-green, reason below name |

---

## Open Questions

1. **`load date` UX** — Calendar button is stubbed. When designed, spec should decide: modal mini-calendar vs. inline date-input. The `weekRef` scroll target is already wired — just need the picked date to compute the column index.
2. **Inventory location model** — Sidebar derives "Fridge / Pantry / Freezer" from category. If the data model gains a real `location` field, update `locationCounts` in `InventoryPage.tsx`.
3. **Auto-shop preview on Plan** — Handoff shows a delivery-window picker on the plan page. Not implemented — needs a pre-flight shopping-list API call. Flag for Slice 4.
4. **`add to wednesday` in RecipesPage hero** — Needs a day-picker concept to be meaningful.
5. **Tablet breakpoint** — BottomTabBar breakpoint is `≤768px`. Adjust to `≤960px` if tablet layout needs the tab bar earlier.
