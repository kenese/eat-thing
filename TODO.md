# TODO — Recipes page design refresh

Tracked from the design review on 2026-05-17. Source: `Recipes - Design Review.html` + `design_handoff_eat_thing/recipes.jsx` + `design_handoff_eat_thing/README.md`.

All 12 items landed in three commits on 2026-05-17. See `HANDOFF-LANDED.md` for the refresh summary.

---

## 1 · Visual gaps — ✅ landed commit `4c55e7d`

### [x] Hero: add the missing "add to wednesday" outline CTA
- Outline button `add to next open day` added in `.rx-hero-cta`, wired to `useAddToNextEmptyDays`. `// HANDOFF: day picker` comment left.

### [x] Hero side card: restore "editor's pick" badge + status footer
- `editor's pick` white-pill badge added on `.rx-hero-side-image` (absolute, `--persim-deep` text). Footer row with `<StatusChip>` + `serves N` added in `.rx-hero-side-body`.

### [x] Card hover treatment is too loud
- `.rx-card:hover` now uses `translateY(-2px)` lift + `box-shadow` + `rgba(13,23,20,0.16)` rule. Persimmon border swap removed.

---

## 2 · Data-layer gaps — ✅ landed commit `3a10cee`

### [x] Bucketing heuristic is broken — every recipe lands in "cookable"
- `RecipeSummary` now carries `canonicalFoodIds: string[]` (subquery on `recipe_ingredients`). `computeMissingFromIds()` added to `recipeMatch.ts`. `sortedByMatch` memo uses real inventory match.
- ⚠ **Rollout note:** this causes visible reshuffling on `/recipes`. Recipes now land in the correct section based on inventory. Feature-flag if gradual rollout preferred.

### [x] Add time to recipe cards (`{time} min · serves {servings}`)
- `total_time_minutes` column added to `recipes` table (migration `0009_recipe_time_tags.sql`). `RecipeSummary.totalTimeMinutes` added. Card meta overlay renders `{N} min · serves {S}` when time is set.

### [x] Add tag pills to card footer
- `tags` text[] column added to `recipes` table. `RecipeSummary.tags` added. First 2 tags render as cream-fill pills in `.rx-card-footer`.

---

## 3 · Copy & content drift — ✅ landed commit `131d047`

### [x] Hero body copy: render inventory-aware italic items
- `featureExpiring` derived by intersecting `feature.ingredients` with inventory rows that have `expiresAt` set, sorted soonest first. Rendered as Lora-italic `<em>` spans. Falls back to generic line when nothing is expiring.

### [x] Hero eyebrow: make "uses N expiring" dynamic
- Eyebrow now: `cook tonight · uses N expiring` (dynamic) or `cook tonight · uses what you have` (fallback). Lowercase source; CSS applies `text-transform: uppercase`.

### [x] Section period colour varies per section
- Leading `.rx-section-dot` circles removed. Each section's `.dot` period carries the accent via `style={{ color: 'var(--fresh)' }}`, `'var(--persimmon)'`, `'var(--green)'`.

### [x] "Quick shop" section hint truncated
- Full text restored: `1–3 items away · auto-added to your next list`. `ShoppingList` has no `scheduledDate` field; generic fallback used.

---

## 4 · Cosmetic — ✅ landed commit `131d047`

### [x] PageTitle eyebrow shouldn't `.toUpperCase()` in source
- `.toUpperCase()` removed. `.page-title-eyebrow` already applies `text-transform: uppercase`.

### [x] Sort control: real dropdown
- `<select>` wired with options: *cookable first* / *recently added* / *name a–z*. `cookable first` keeps three-section layout; other orders show flat sorted grid.

---

## Out of scope (already flagged in `HANDOFF-LANDED.md`, not Recipes-specific)

- `load date` picker on PlanPage
- Auto-shop preview panel on PlanPage
- Delivery-window 2×2 grid on ShoppingListPage
- `/shops` route
- InventoryPage low-stock staples widget
