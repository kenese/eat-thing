# HANDOFF-LANDED.md

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
