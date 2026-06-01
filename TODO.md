# How to work this list

This file tracks design-spec discrepancies across all five pages. **It is not a flat task queue — work it in this order:**

**0 · Source of truth.** The spec is the handoff bundle, not this file's prose. For exact hex / spacing / type, open `design_handoff_eat_thing/<page>.jsx` and `design_handoff_eat_thing/README.md`. This list points at them; it doesn't replace them.

**1 · Resolve the "Decide intent first" items before writing any code.** Items marked **"Decide intent first"** are design decisions, not coding tasks. An agent will guess on these and create drift. Answer them inline in this file first. The *still-open* ones are:
- *Cross-page* — section-header size: **22px** (spec) or **28px** (live)? Decide once; applies to Inventory §3, Shopping List §2, and the landed Recipes work.
- *Home §1* — shop-preview day anchor; *Home §2* — hero-cell category tag vs status word.
- *Plan §1* — where edit controls live (hover-reveal vs popover); *Plan §2* — horizon strip grid vs scroll; *Plan §3* — grouped vs separate title controls.
- *Shopping List §3* — keep the staples flow or consolidate; *§4* — `⋯` row menu vs `✕` delete.

> **Already decided in the repo docs — do NOT re-open these:**
> - *Inventory §1 (location vs category)* → **decided: keep category, defer location.** PLAN.md: `[-] Restore inventory location field — defer until category-derived counts cause a demonstrated problem`. So the spec's location grouping is intentionally not matched; *Inventory §2 (`spot` field)* drops in priority with it.
> - *Inventory §3 (scan-receipt button)* → **deferred.** IDEAS.md parks receipt scanning post-MVP; don't add the button now.
> - *Home §3 / Shopping List §5 (delivery-window grid)* → **deferred**, PLAN.md Slice 6.
> - *Shopping List §1 (per-meal filter pills)* → **deferred**, PLAN.md "Deferred: per-meal reason pills."

**2 · Do the shared data-layer work once, upfront.** Note: the **recipe-side schema already landed** — `RecipeSummary` now carries `canonicalFoodIds`, `totalTimeMinutes`, and `tags` (HANDOFF-LANDED commit `3a10cee` / migration 0009). So *Plan §1* needs no new schema — it just has to **join recipe data into meal-plan entries client-side and run `computeMissing` per entry** (mirror Home's `computeMeals`). The one genuinely-new shared piece left is the **`AISLE_LABEL` map in `@eat/taxonomy`** (used by Home §3 + Shopping List §2) — land that first.

**3 · Then hand off page-by-page, not all at once.** Prompt one section at a time (`"Do the Inventory section of TODO.md"`) so each produces a reviewable diff. "Do TODO.md" produces an unreviewable PR.

**4 · Things flagged blocked** (no data model yet) should stay un-built, not faked: delivery-window grid, multi-store "also connected", live delivery/tax totals, the Playwright send wiring. Leave placeholders that show `—`, never invented numbers.

---

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

---

# TODO — Home page design refresh

Tracked from the design review on 2026-05-17 (Recipes-style pass). Source: `apps/web/src/pages/HomePage/*` + `design_handoff_eat_thing/direction-3-greengrocer-v2.jsx` + `design_handoff_eat_thing/README.md`.

Home landed mostly intact — hero, "use this week" card, 5-cell meals strip, shop preview card. The remaining gaps are concentrated in the **shop preview card** (it currently reads as a status panel for a list that's already built, but the spec frames it as a *delivery handoff* for the next auto-shop) and in the **meals strip hero logic**. The hero band itself is the most faithful surface on the page.

---

## 1 · Hero band

### [ ] Subcopy day reference may drift past "wednesday"
- **Where:** `HomePage/homeDerivations.ts` → `subcopyDay()` + `HeroBand.tsx`.
- **Spec:** `127 things on hand · 4 won't make it past wednesday · the list builds itself.`
- **Now:** Day is computed as `today + 3 days`. On a Sunday that's Wednesday (spec); on a Friday that's Monday.
- **Decide intent first:** spec is a static reference to "the next shop day" — i.e. the next auto-shop date, not "today + 3". Until a delivery-window data model exists, leaving the today+3 fallback is OK, but the right anchor is the shop's `builtLabel` day.
- **DECISION:** derive the day from the soonest-expiring item in the use-this-week set (items with no expiry are already excluded by computeExpiring). When the set is empty, the clause is already omitted — leave that behavior.

---

## 2 · Meals strip

### [ ] Hero (highlighted) cell logic doesn't match spec
- **Where:** `HomePage/MealsStrip.tsx` → `MealsCard` → `isHero` computation.
- **Spec:** One of the five cards is *always* highlighted in workhorse green — the "active/next-up" card (in the sample data, that's Wednesday's roast — a shopping day, not today).
- **Now:** `isHero = cell.isToday && cell.kind === 'cook'` — only highlights today, and only if it's already cookable. On a day with no plan or a missing-ingredient day, no card is highlighted at all and the strip reads flat.
- **Fix:** Highlight the *next* non-past cell that has a recipe regardless of kind. Falls back to the first cell with a recipe; if none, no highlight. Today is fine as a tiebreaker.

### [ ] Hero card uses persimmon-on-green status chip vs spec's white-pill-with-green-text
- **Where:** `MealsStrip.tsx` → `<StatusChip kind="cook" onHero={isHero} />` + `StatusChip` component.
- **Spec:** On the green hero card, the tag is a white pill with green text — inverted from the off-card chip — and the label is the *category tag* (`pantry`, `shopping`, `leftover`), not the status word.
- **Now:** StatusChip is reused on-hero; visual treatment is fine but the label says `cook now` / `missing N` regardless.
- **Decide intent first:** spec's category tag was sample data, not a derived field. Either (a) derive a category tag from recipe.tags and render it on the hero card only, or (b) accept the status-word treatment and treat this as spec drift. Likely (b) is fine — the status word is more informative.

---

## 3 · Shop preview card

The card currently presents the shopping list's *current state* (built timestamp, item counts, this-week label). Spec frames it as a *delivery handoff* (`auto-shop · queued`, `wed 4:30 pm`, store name). These are different mental models. Most fixes below depend on which model the team wants.

### [ ] Eyebrow + headline + subline read as "list status," not "auto-shop handoff"
- **Where:** `HomePage/ShopPreview.tsx` → header block.
- **Spec:** Eyebrow `auto-shop · queued`; headline `wed 4:30 pm` (delivery slot); subline `whole foods · brooklyn`.
- **Now:** Eyebrow `shopping list · ready`; headline `built sun 9:14 am` (build timestamp); subline `this week`.
- **Cause:** No delivery-window or store-binding data model exists yet — flagged in `HANDOFF-LANDED.md` Open Question #3.
- **Fix (interim):** Until delivery-window data ships, swap the subline from `this week` to the store name (from `pricesData.prices[0].store` already used on ShoppingListPage), keep the headline as `builtLabel`, and leave the eyebrow as-is. When the data lands, flip the model wholesale.

### [ ] CTA loses the day suffix
- **Where:** `ShopPreview.tsx` → CTA span.
- **Spec:** `check out for me, wednesday →`.
- **Now:** `check out for me →`.
- **Fix:** Append the next-shop day once the delivery-window model exists. Until then, leave as-is — guessing a day is worse than omitting one.

### [ ] Aisle row labels diverge from system vocabulary
- **Where:** `ShopPreview.tsx` → aisle rows.
- **Spec rows:** `produce · fennel · lemons · parsley · shallots · 4` / `butcher · whole chicken · italian sausage · 2` / `dairy · butter · whole milk · 2` / `pantry · olives · anchovies · 00 flour · 3`.
- **Now:** Uses `CATEGORY_LABEL[category]` — so `Meat` instead of `Butcher`, `Dairy` instead of `Dairy & cheese`, `Pantry` instead of `Pantry & oils`. Plus the labels are Title-Cased; spec is lowercase italic.
- **Cause:** Shared with ShoppingListPage (same bug, same fix — see ShoppingList §2).
- **Fix:** Either remap to the system aisle labels in a single place (`AISLE_LABEL` in `@eat/taxonomy`), or override only the display string at the render site. Render lowercase; let CSS handle case.

---

## 4 · Copy & cosmetic

### [ ] "Use this week" qty formatting strips spec's fractions
- **Where:** `homeDerivations.ts` → `formatQty()`.
- **Spec:** `½ pt` / `1 bunch` / `½ loaf`.
- **Now:** `0.5 pt` / `1 bn` / `0.5 lf`. Unit abbreviations are also opaque (`bn`, `lf`).
- **Fix (small):** Map common decimal qtys to unicode fractions (½, ¼, ¾, ⅓, ⅔) and full-word units for the home strip only. Inventory page keeps abbreviations.

### [ ] Hero-pill is hidden on inventory-empty; spec is unconditional
- **Where:** `HeroBand.tsx` → `inventoryEmpty` guard on `.hero-pill`.
- **Now:** When pantry is empty, the green coverage pill is hidden entirely.
- **Fix:** Replace with an empty-state pill (`add a few things to start cooking from your kitchen`) so the slot still anchors the eye, instead of leaving the top of the hero with nothing above the headline.

---

# TODO — Inventory page design refresh

Tracked from the design review on 2026-05-17 (Recipes-style pass). Source: `apps/web/src/pages/InventoryPage/*` + `design_handoff_eat_thing/inventory-ledger.jsx` + `design_handoff_eat_thing/README.md`.

Two-pane layout, sidebar cards, and the "use this week" strip all landed. The two structural gaps are:

1. **Grouping** — spec groups by **location** (fridge/pantry/freezer/other); live groups by **category** (produce/meat/dairy/…). The whole filter strip and section list inherit from this choice.
2. **Spot field** — the spec carries a `spot` field on every item (`top shelf`, `crisper`, `shelf A2`) and renders it both inline in the use-this-week strip and as a column in the table. Live schema has no `spot`.

The category-vs-location question is the central decision; once made, everything else follows.

---

## 1 · Structural — location vs category

### [-] Decide: group by `location` (spec) or `category` (live)? — DECIDED: keep category, defer location
> **Status (per PLAN.md): deferred, not open.** `[-] Restore inventory location field — defer until category-derived counts cause a demonstrated problem`. The current category grouping is intentional; the spec's location grouping is knowingly not matched. Leave this item closed unless the deferral is reversed. Everything below is retained for when/if that happens.
- **Where:** `InventoryPage.tsx` → `sortedByCategory` + filter tabs + `CategoryGroup` rendering.
- **Spec:** Sections are `Fridge / Pantry / Freezer / Other`. Filter pills are `All / Fridge / Pantry / Freezer / Expiring soon`. Category is *implicit*.
- **Now:** Sections are `Produce / Meat / Dairy / Pantry / Frozen / Drinks / Other`. Filter pills are the same seven categories. Location is *derived* from category in the sidebar (`produce + meat + dairy → fridge` etc.).
- **Cause:** `InventoryRow.location` doesn't exist in `packages/shared`; it has `category` only. The spec assumes a `location` field.
- **Decide intent first:** Location is a spatial / physical-storage concept (where things are); category is a taxonomy concept (what kind of food). The spec's choice is correct for a kitchen-ledger mental model. Adding `location: 'fridge' | 'pantry' | 'freezer' | 'other'` to `InventoryRow` + storage layer is the right move.
- **Fix:** Add `location` to schema. Default-derive from category on legacy rows (the mapping in `InventoryPage.tsx` already exists). Switch sections + filter pills to location. Keep `category` for sort/sub-grouping inside a location only if useful.

### [ ] Filter strip: add "Expiring soon" pill
- **Where:** `InventoryPage.tsx` → `tabs` array.
- **Spec:** Last pill in the strip is `Expiring soon` (count = items with ≤7 days).
- **Now:** No such pill — expiring is only in the sidebar card.
- **Fix:** Add to `tabs`, with `expSoon` count. Add a corresponding filter branch (`urgency` filter) to `useInventory`.

---

## 2 · Data-layer gaps

### [ ] Add `spot` field — used in two places
- **Where:** `InventoryRow` schema + use-this-week strip + table column.
- **Spec data:** `spot: 'top shelf' | 'crisper' | 'shelf A2' | …` — a freeform string the user sets per item.
- **Now:** No `spot` field.
- **Fix:** Add `spot?: string` to `InventoryRow` (optional — most rows won't have one). Plumb through storage. Update `ItemForm` with a small text input under brand. Render in:
  - **Use-this-week strip:** below qty, as `{qty} · {spot}` (currently just `{qty}`).
  - **Table:** new column between "item" and "added", `font-size: 12 / color: ink2`. Bump grid from 5-col to 6-col: `90px 1fr 140px 130px 110px 60px`.

---

## 3 · Visual / cosmetic

### [ ] Section header label drift — 28px vs spec 22px
- **Where:** `InventoryPage.css` → `.inv-group-label`.
- **Now:** `font-size: 28px` (bumped from 22 in HANDOFF-LANDED).
- **Spec:** 22px italic Lora green.
- **Decide intent first:** the bump was deliberate to match Recipes/Shopping section headers. If the system convention is now 28px for section labels, leave it and update spec; if the spec is canonical, revert to 22 here, on Shopping List, and on Recipes for consistency.

### [-] Missing "scan receipt" outline button in title actions — DEFERRED per IDEAS.md
> **Status: deferred.** IDEAS.md parks receipt scanning post-MVP ("Scan receipt → LLM extracts line items"). Do **not** add the button now — it would signal an undesigned, unscheduled flow. Reinstate this item only when scan-receipt is pulled into a slice.
- **Where:** `InventoryPage.tsx` → `<PageTitle actions>`.
- **Spec:** Two buttons — `scan receipt` (outline) + `+ add item` (persimmon).
- **Now:** Only `+ add item`.
- **Fix:** Add an outline button before `+ add item` with `// HANDOFF: receipt scan flow not yet designed` and disabled state. Or strip it from the spec as out of scope and don't render. Pick one; the slot is currently asymmetric.

### [ ] Summary line missing the "last reconciled" italic timestamp
- **Where:** `InventoryPage.tsx` → `<PageTitle summary>`.
- **Spec:** `{N} items on hand · {N} expiring this week · last reconciled today, 9:14 a.m.` (last clause italic serif).
- **Now:** `{N} items on hand · {N} expiring this week`.
- **Fix:** Append `<span class="caption-serif">last reconciled {today, time}</span>`. Until we have a real "last reconciled" event, anchor it to `Date.now()` matching the eyebrow.

### [ ] Eyebrow uppercased in source; should be lowercase + CSS-uppercased
- **Where:** `InventoryPage.tsx` → `eyebrow` const.
- **Now:** `'THE KITCHEN · …'.toLowerCase()` wait, actually `'THE KITCHEN · '` + `…toLowerCase()` — produces mixed-case `'THE KITCHEN · 9:14 am'`. The `text-transform: uppercase` then upper-cases the time too.
- **Fix:** Source string should be lowercase: `the kitchen · {time}`. CSS handles the visual uppercase via `.page-title-eyebrow`. (Same convention as called out in Recipes §4 PageTitle.)

---

# TODO — Plan page design refresh

Tracked from the design review on 2026-05-17 (Recipes-style pass). Source: `apps/web/src/pages/PlanPage/*` + `design_handoff_eat_thing/meal-plan.jsx` + `design_handoff_eat_thing/README.md`.

Plan was the heaviest piece of the handoff and the most-altered. The big-ticket items (horizon strip, ink today card, ←/today/→ controls, past-day treatment) landed. What's left is concentrated in the **day card** (typography is partially inverted vs spec, the inventory-aware "need X & N more" line is missing) and the **lower row** (spec has two sections — open seats + auto-shop preview — live has a full-width recipe drag grid instead).

The recipe drag grid is an intentional deviation per `HANDOFF-LANDED.md`. Don't revert it.

---

## 1 · Day card

### [ ] Recipe title is italic Lora; spec is sans 17/600
- **Where:** `PlanPage.css` → `.day-col-name`.
- **Spec:** `font-family: sans; font-size: 17px (or 15 if multi-meal); font-weight: 600; letter-spacing: -0.012em`.
- **Now:** `font-family: var(--font-serif); font-style: italic; font-size: 17px; font-weight: 400`.
- **Cause:** Treatment inversion — the spec uses *italic serif for the day label/context* (`today.`, `tomorrow`) and *sans for the recipe name*. Live has them swapped.
- **Fix:** Flip `.day-col-name` to sans 600. Day-context labels in `.day-col-context` are already italic serif — good.

### [ ] Missing "need {ingredient} & N more" line under the recipe name
- **Where:** `PlanPage.tsx` → `DayCard` rendering, after `.day-col-name`.
- **Spec:** When a day's primary meal has missing ingredients, render italic serif 12 ink3 (or paper-70 on the ink today card): `need {missing[0]}, {missing[1]} & {N-2} more`. The whole point of the page is showing what you need to shop for — this line is the bridge.
- **Now:** `DayEntry.missing` is hardcoded `[]` and `kind` is hardcoded `'cook'` (see `entriesByDay` useMemo). `useInventory` is read but discarded with `void inventory`. The status chip never says `missing N`.
- **Cause:** `MealPlanEntry` isn't joined to recipe ingredients on the client — but **the recipe schema needed already exists** (`RecipeSummary.canonicalFoodIds` landed, HANDOFF-LANDED commit `3a10cee`). No new schema required.
- **Fix:** Join recipes-by-id on the client and run `computeMissing` / `computeMissingFromIds` per entry, mirroring Home's `computeMeals`. (`useRecipes` + `useInventory` are both already available on the page.)a) is cheaper and keeps the API thin.

### [ ] Day card meta line is missing time
- **Where:** `PlanPage.tsx` → `.day-col-meta`.
- **Spec:** `{time}m · serves {N}` (e.g. `90m · serves 4`).
- **Now:** `serves {servings}`.
- **Cause:** `RecipeSummary.totalTimeMinutes` **already landed** (migration 0009). The Plan page just needs to read it off the joined recipe. No schema work.

### [ ] Past day cards still render the recipe image
- **Where:** `PlanPage.tsx` → `DayCard`, `first.recipe?.sourceImage` block.
- **Spec:** Past days have **no image** — just a green checkmark, line-through name, and italic serif `cooked · {time}m` at the bottom of the card.
- **Now:** Image renders for past days, name has line-through (good), `cooked` label at the bottom (good). The image makes past days louder than the spec intends.
- **Fix:** Branch on `isPast` — skip the `.day-col-image` block, render an inline checkmark + name row instead. The checkmark SVG is in `meal-plan.jsx` (`MealRow` cooked branch) — copy that shape.

### [ ] Multi-meal days don't show secondary entries as `MealRow`s
- **Where:** `PlanPage.tsx` → `DayCard`, `followUps.map(...)` block.
- **Spec:** Each follow-up meal is a horizontal row: name (sans 13/600), italic serif `need X & N more` *or* `Nm · tag` underneath, status chip on the right. Border-top hairline above.
- **Now:** Follow-ups render as a flat row with `name + serves N + ✓ + ✕` buttons. No missing line. No status chip. Visual rhythm doesn't match the primary card.
- **Fix:** Extract a `<MealRow>` sub-component matching the spec. Edit affordances (✓/✕/servings input) should still be reachable, but treat them as hover/focus reveals rather than always-visible.

### [ ] Empty "open seat" hint isn't persimmon
- **Where:** `PlanPage.css` → `.day-col-empty-hint`.
- **Spec:** `+ add recipe` in persimmon 700 11px letter-spacing 0.02em.
- **Now:** Inherits `color: var(--mute)` from `.day-col-empty`. Reads as inert.
- **Fix:** `.day-col-empty-hint { color: var(--persimmon); font-weight: 700; letter-spacing: 0.02em; }`.

### [ ] Servings + remove + cooked controls are always visible
- **Where:** `PlanPage.tsx` → `DayCard`, the `style={{ marginTop: 6, display: 'flex', gap: 4 }}` row.
- **Spec:** No edit controls visible on the card — spec is a viewing artifact. But this is a real product, so we need them. Spec doesn't tell us where.
- **Decide intent first:** hover-reveal (consistent with Inventory's `.inv-row-actions`) or move into a small popover triggered by `⋯`. Right now the controls dominate the bottom of every card. Hover-reveal is the lower-lift, more spec-faithful option.

---

## 2 · Horizon strip

### [ ] Missing strip header + legend
- **Where:** `PlanPage.tsx` → above `.plan-horizon`.
- **Spec:** Above the pill row, a two-part header:
  - Left: eyebrow `16-day horizon · {N} – {N} {month}` (10/700/0.14em mute).
  - Right: a tiny legend — `cook now N · needs shop N · leftover N · open N` with colored dots (`fresh`, `persimmon`, `ink`, dashed `mute`).
- **Now:** No header, no legend. The strip is naked between the title row and the day grid.
- **Fix:** Add a flex row above the pill rail. The legend reuses the kind counts the title summary already derives.

### [ ] Horizon pills are min-width scroll instead of equal-width grid
- **Where:** `PlanPage.css` → `.plan-horizon` + `.horizon-pill`.
- **Spec:** `display: grid; grid-template-columns: repeat(16, 1fr); gap: 6px` — the strip exactly spans the page gutter and every pill is the same width.
- **Now:** `display: flex; overflow-x: auto; min-width: 48px` — scrollable, pills inconsistent width depending on label.
- **Decide intent first:** spec assumes a fixed 16-day horizon; live's `planWindowDays(now)` may return a different count or want to grow. If the count is fixed, switch to the grid (cleaner rhythm). If it should be open-ended, keep the scroll but tighten the min-width + lock pill internal layout. Default to the grid — it matches the rest of the system's geometry.

### [ ] Multi-meal `N×` is persimmon on every pill; spec is persimDeep off-today, persimmon on-today
- **Where:** `PlanPage.css` → `.horizon-pill-multi`.
- **Now:** Always `color: var(--persimmon)`.
- **Fix:** Default to `var(--persim-deep)`; the `.horizon-pill--today .horizon-pill-multi` rule already exists — just flip the default.

---

## 3 · Title row

### [ ] Summary counts use the wrong window
- **Where:** `PlanPage.tsx` → `shopCount` / `pantryCount` / `openCount`.
- **Spec:** `next 7 days` literally — `next7 = days.slice(todayIdx, todayIdx + 7)`.
- **Now:** Filters across the *full horizon* (`days.filter(d => !d.isPast && …)`) — yields larger numbers than the "next 7 days" caption claims.
- **Fix:** Slice `days` to the next-7-from-today before counting.

### [ ] "add recipes to list" button is missing trailing italic arrow
- **Where:** `PlanPage.tsx` → `.btn-primary.plan-add-to-list-btn`.
- **Spec:** `add recipes to list   {N}   →` — the `→` is Lora italic 16px after the count badge.
- **Now:** No arrow.
- **Fix:** Append `<span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>→</span>` after the count.

### [ ] ←/today/→/load-date are grouped in a single paper2 pill; spec is four separate buttons
- **Where:** `PlanPage.css` → `.plan-scroll-btns` group + `.plan-scroll-btn`.
- **Spec:** Four separate 38×38 outline buttons (38×38 for ← and →, auto-width for `today` and `load date`).
- **Now:** Grouped in a paper2 pill container with 2px internal padding.
- **Decide intent first:** the grouped pill is denser and visually quieter, which is arguably better when there's already a noisy CTA next to it. The spec's separate buttons are more legible but heavier. Either is defensible. If you change it, change it on both desktop and mobile.

---

# TODO — Shopping List page design refresh

Tracked from the design review on 2026-05-17 (Recipes-style pass). Source: `apps/web/src/pages/ShoppingListPage/*` + `design_handoff_eat_thing/shopping-list.jsx` + `design_handoff_eat_thing/README.md`.

Section titles, fresh-green checkboxes, reason-below-name layout, and the agent status card all landed (per `HANDOFF-LANDED.md`). The remaining gaps are concentrated in three areas:

1. **Filter pills** — spec splits recipes per-meal (`Wed roast`, `Fri pizza`); live merges them into a single `From recipes` tab.
2. **Aisle vocabulary** — spec uses `Butcher / Dairy & cheese / Pantry & oils`; live uses raw category labels (`Meat / Dairy / Pantry`).
3. **Sidebar** — delivery window grid + multi-line totals card are still missing (the first is already flagged in `HANDOFF-LANDED.md`; the totals card is new).

---

## 1 · Filter strip — pills + grouping

### [-] Filter pills merge per-meal into "From recipes"; spec splits them — DEFERRED per PLAN.md
> **Status: deferred.** PLAN.md lists "per-meal reason pills" under Deferred. Also note `sourceRecipeNames` stores names, not IDs (IDEAS.md "recipe chip navigation"), so stable per-meal tabs would want `sourceRecipeId` first. Keep the single `From recipes` tab until this is scheduled. Spec detail retained below.
- **Where:** `ShoppingListPage.tsx` → `SOURCE_TABS`.
- **Spec:** `All · {N}` / `Wed roast · {N}` (persimmon dot) / `Fri pizza · {N}` (persimmon dot) / `Staples · {N}` (green dot) / `You added · {N}` (no dot). Per-meal pills are derived from the planned recipes that contributed to the list.
- **Now:** `All / From recipes / Staples / You added` — one tab covers every recipe contribution.
- **Cause:** `ShoppingListItem.sourceRecipeNames` is `string[] | null`, but filter logic only checks `item.source === 'recipe'`.
- **Fix:** Derive a tab per distinct `sourceRecipeName` (or per `sourceRecipeId` for stability across renames). Use a max of ~4–5 per-meal tabs; collapse the long tail into `+N more` if you have to. Each tab carries a `dot` color: persimmon for recipe-contributed, green for staples, none for manual.
- **Note:** `FilterStrip` component currently doesn't support per-tab colored dots — add `dot?: 'persimmon' | 'green'` to `FilterTab` props.

### [ ] "Group by" indicator says `category`; system vocabulary is `aisle`
- **Where:** `ShoppingListPage.tsx` → `FilterStrip` trailing slot.
- **Spec:** `group by aisle`.
- **Now:** `group by category`.
- **Fix:** Change the label to `aisle`. Same one-word fix as Home §3 / Inventory aisle naming — the system vocabulary throughout is `aisle`, even though the data field is `category`.

---

## 2 · Aisle section labels

### [ ] Aisle labels use `CATEGORY_LABEL`; spec uses warmer / clearer aisle names
- **Where:** `ShoppingListPage.tsx` → `CategorySection` title.
- **Spec mapping:**
  | Category | Aisle label |
  |---|---|
  | `produce` | `Produce` |
  | `meat` | `Butcher` |
  | `dairy` | `Dairy & cheese` |
  | `pantry` | `Pantry & oils` |
  | `frozen` | `Frozen` |
  | `drinks` | `Drinks` |
  | `other` | `Other` |
- **Now:** Raw `CATEGORY_LABEL[c]` — so `Meat / Dairy / Pantry`.
- **Fix:** Add an `AISLE_LABEL` map in `@eat/taxonomy` (next to `CATEGORY_LABEL`); use it on this page, ShopPreview, and any aisle-grouped list. Don't touch `CATEGORY_LABEL` — that's the form/inventory taxonomy and should stay as-is.

### [ ] Section header label size — 28px vs spec 22px
- **Where:** `ShoppingListPage.css` → `.sl-section-title`.
- **Now:** 28px (per HANDOFF).
- **Spec:** 22px italic Lora.
- **Decide intent first:** same call as Inventory §3 — decide once across Inventory + Shopping List + Recipes whether the system size for italic-serif section headers is 22 or 28. Pick one; touch all three.

---

## 3 · Title row

### [ ] Summary line missing "across N aisles"
- **Where:** `ShoppingListPage.tsx` → `<PageTitle summary>`.
- **Spec:** `{N} items across {N} aisles · for this week's plan`.
- **Now:** `{N} items · for this week's plan`.
- **Fix:** Count distinct categories in `list.items` and inject.

### [ ] Title actions don't match spec — spec is `+ add item` + `print`
- **Where:** `ShoppingListPage.tsx` → `<PageTitle actions>`.
- **Spec:** Two outline buttons — `+ add item` + `print`.
- **Now:** `staples` (outline) + `Add from planned recipes` (persimmon primary).
- **Cause:** Existing functionality predates the spec. The staples flow has no equivalent in the spec; `Add from planned recipes` is functionally the same as `add item` but specific to recipes.
- **Decide intent first:** the spec's `+ add item` was a stand-in for *any* way of adding to the list. The current trio of {add-item-inline, add-from-plan, staples} expresses more functionality, but it spends a lot of header surface area on it. Possible consolidation: keep `Add from planned recipes` as the persimmon primary, move `staples` and the inline add form into a single `+ add` button that opens a popover.
- **Fix:** Surface this to design before changing — don't unilaterally drop staples.

### [ ] Eyebrow uppercased in source
- **Where:** `ShoppingListPage.tsx` → `builtAt` const.
- **Now:** `'AUTO-BUILT · LAST UPDATED ' + …toLowerCase()` → `'AUTO-BUILT · LAST UPDATED 9:14 am'`.
- **Spec:** Lowercase source, CSS uppercases.
- **Fix:** Same as Inventory §3 / Recipes §4 — make the source string lowercase.

---

## 4 · Row layout

### [ ] Delete affordance is `✕`; spec is a `⋯` menu
- **Where:** `ShoppingListPage.tsx` → `.sl-row-menu`.
- **Spec:** `⋯` ellipsis mute 16px — opens a row menu (rename / change qty / remove).
- **Now:** `✕` close button deletes immediately.
- **Decide intent first:** spec's menu doesn't exist as a component. The current single-purpose ✕ is more honest about what it does. If we're not building a row menu now, keep ✕ — but soften the glyph (`var(--mute)` is already right) and consider showing on hover only.

### [ ] Per-row "reason" chip moved below the name (HANDOFF deviation)
- **Where:** `.sl-row-main` wrapper.
- **Spec:** Reason chip is inline between name and price (4-col grid `18px 1fr 90px 80px 24px`).
- **Now:** Stacked below name in a `.sl-row-main` column.
- **Cause:** Intentional, per `HANDOFF-LANDED.md` — done to prevent name truncation on narrow viewports.
- **Note:** Keep the deviation. But add a `@media (min-width: 1100px)` branch that restores inline placement when there's room — the spec layout reads cleaner when it fits.

---

## 5 · Sidebar

### [ ] Delivery-window 2×2 grid — not implemented
- **Already flagged in `HANDOFF-LANDED.md` — Open Question #3.** Listed here for completeness.

### [ ] Totals card shows price-coverage instead of spec's subtotal/delivery/tax breakdown
- **Where:** `ShoppingListPage.tsx` → `.sl-totals` block.
- **Spec:** Three lines (`subtotal`, `delivery`, `est. tax`) + grand-total row (`est. total` italic serif label + big sans tabular number).
- **Now:** One line (`items` count), grand total (✓ matches), sub-line `{N} priced · {N} without a match`.
- **Cause:** No delivery/tax data exists; price-coverage was substituted to keep the card useful.
- **Fix:** Move the price-coverage line *under* the grand total as a footnote (italic serif 11/mute). Add `delivery` and `est. tax` rows as placeholders showing `—` until the delivery-window model lands. Don't fake numbers.

### [ ] Store card missing "also connected" italic line
> **Note — wrong stores in the spec:** the handoff JSX uses US chains (`Whole Foods`, `Trader Joe's`, `FreshDirect`). The real product is **NZ** (`New World` / `Pak'nSave` / `Woolworths`, per DECISIONS D21 + `STORE_LABEL`). Don't lift these names literally. Multi-store is also post-MVP (IDEAS.md), so this line stays hidden for now.
- **Where:** `ShoppingListPage.tsx` → `.sl-store` block.
- **Spec:** Below the store row, an italic serif 12 ink3 line: `also connected: Trader Joe's, FreshDirect`.
- **Now:** Not rendered.
- **Cause:** No multi-store data model.
- **Fix:** Hide entirely until multi-store support exists — don't render a placeholder. Note as blocked.

### [ ] Send button disabled with a `title` tooltip; spec is enabled
- **Where:** `.sl-send` button.
- **Now:** `disabled title="Coming soon · phase 4"`.
- **Spec:** Enabled persimmon button.
- **Cause:** Playwright handoff not yet wired.
- **Fix:** Keep disabled until wired, but swap the disabled treatment from `cream` background to persimmon-with-50%-opacity so the affordance stays visible. The current disabled state reads as inert.

---

## 6 · Extras not in spec (keep, but acknowledge)

- **Inline add-item form** at the bottom of the list — not in spec, but useful. Keep.
- **Selection action bar** (sticky bottom, "Mark purchased" / "Remove") — not in spec, but useful. Keep.
- **`Refresh prices` button** in the sidebar — not in spec, intentional for price-check debugging. Move into a hidden dev menu later; for now keep visible.

