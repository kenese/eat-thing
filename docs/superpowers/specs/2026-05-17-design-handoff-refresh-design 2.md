# Design Handoff Refresh — Eat Thing Frontend

**Date:** 2026-05-17
**Source:** `design_handoff_eat_thing/README.md` + JSX design references
**Approach:** Option A — layer-by-layer, one commit per surface

---

## Scope

Update the live app's visual language to match the refreshed design handoff exactly.
Preserve all existing features not in the handoff (cook flow, import modal, drag-and-drop
recipe planning, agent status card, auth). Restyle them with the new tokens and vocabulary.

---

## What Is Already Correct (No Changes Needed)

- `apps/web/src/styles/tokens.css` — all color tokens match the handoff exactly
- `apps/web/index.html` — Google Fonts loading (Schibsted Grotesk + Lora) already in place
- `TopNav.tsx` structure — ink background, wordmark, nav tabs, persimmon active underline
- `PageTitle.tsx` / `StatusChip.tsx` / `FilterStrip.tsx` — structurally sound, CSS needs polish
- All 5 desktop routes and the rolling date-stream PlanPage

---

## Design Tokens Reference

| Token | Value |
|---|---|
| `--paper` | `#f3f5f2` |
| `--paper2` | `#eaeee7` |
| `--cream` | `#e6ebe4` |
| `--ink` | `#0d1714` |
| `--ink2` | `#3a443e` |
| `--ink3` | `#5a6359` |
| `--mute` | `#6e7872` |
| `--green` | `#1f5d33` |
| `--fresh` | `#5aa758` |
| `--persimmon` | `#d96e2e` |
| `--persim-deep` | `#b6541d` |
| `--rule` | `rgba(13,23,20,0.08)` |
| `--rule2` | `rgba(13,23,20,0.04)` |

Fonts: `--font-sans: "Schibsted Grotesk"` / `--font-serif: "Lora"` (italic 400/500 only).

---

## Type Scale

| Use | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Page title | Lora italic | 56px | 400 | -0.02em |
| Section header | Lora italic | 28px | 400 | — |
| Card title | Schibsted | 18–19px | 600 | -0.012em |
| Body | Schibsted | 14px | 400 | — |
| Italic caption ("why") | Lora italic | 13px | 400 | — |
| Eyebrow label | Schibsted | 11px | 600–700 | 0.12–0.14em, uppercase |
| Data / mono-feel | Schibsted, tabular-nums | 11–13px | 600 | — |

**Persimmon-period rule:** every page title and section header ends with
`<span class="dot">.</span>` (color: var(--persimmon)). Already in `PageTitle`; must be
applied to every section header across all pages.

**Italic-serif "why" caption rule:** every explanatory caption uses Lora italic 13px ink3/mute.
Implemented via a `.caption-serif` utility class added to `index.css`.

---

## Surface 1 · Typography + Global Utilities

**File:** `apps/web/src/styles/tokens.css`, `apps/web/src/index.css`,
`apps/web/src/components/PageTitle.css`

Changes:
- `PageTitle.css`: promote `h1.page-title` to 56px Lora italic, -0.02em tracking
- `index.css`: add `.caption-serif` utility (Lora italic, 13px, `var(--ink3)`)
- `index.css`: add `.eyebrow` utility (11px, 700, 0.14em, uppercase, `var(--mute)`)
- Verify `.dot` class is present in `index.css` (already is)

---

## Surface 2 · TopNav + Wordmark

**Files:** `components/TopNav.css`, `components/Wordmark.tsx`, `components/Wordmark.css`

Changes:
- `Wordmark`: "thing" text rendered in `var(--persimmon)` when `tone="on-ink"`.
  Currently renders in paper; needs a span wrapping "thing" with persimmon color.
- Add `shops` nav item as a stub (no route; renders as plain `<span>` or disabled link
  with `// HANDOFF: shops route not yet implemented`).
- Nav link font-size: 13px 600, lowercase — already correct.
- TopNav CSS: verify gap, padding match handoff (14px vertical, `var(--gutter)` horizontal).

---

## Surface 3 · Home Page

**Files:** `pages/HomePage/HomePage.css`, `HeroBand.tsx/.css`,
`MealsStrip.tsx/.css`, `ShopPreview.tsx/.css`

### HeroBand
- Grid: `1.4fr 1fr`, gap 24px
- Left: green pill `you have what you need for monday & tuesday` (fresh-green bg, paper text,
  radius 999px), then a 76px display headline mixing Schibsted + Lora italic green inline
  words + persimmon period
- Right: ink card with `use this week` eyebrow, expiring items list (Lora italic day-count,
  persimmon for today items)

### MealsStrip
- 5 cards in a row
- Active/hero card: `var(--fresh)` background, paper text, lowercase italic day label top,
  recipe name middle (Schibsted 600), status chip bottom
- Inactive cards: `var(--cream)` background, ink text

### ShopPreview
- Cream card, auto-shop date eyebrow, persimmon italic serif dollar amount, aisles broken out,
  persimmon CTA `check out for me, wednesday →` (Lora italic arrow)

---

## Surface 4 · Inventory Page

**Files:** `pages/InventoryPage/InventoryPage.css`, `InventoryPage.tsx`

Changes:
- Two-pane layout: item list (left, ~2/3 width) + sidebar (right, ~1/3 width)
- Sidebar card: location summary (Fridge/Pantry/Freezer counts), expiring-soon list,
  low-stock staples section — markup added to `InventoryPage.tsx`
- Item rows: italic-serif expiry label on the right (Lora italic `Nd`)
- Section headers (`CategoryGroup`): `label<span class="dot">.</span>` persimmon period,
  Lora italic 28px
- Expiry color coding in `ExpiryCell`: ≤1 day = warn red, ≤3 = persimmon, ≤7 = persimDeep,
  otherwise fresh-green (currently uses urgency classes — verify/update CSS values)

---

## Surface 5 · Recipes Page

**Files:** `pages/RecipesPage/RecipesPage.css`, `RecipesPage.tsx`

Changes:
- `EditorialHero` left card: ink background, persimmon eyebrow dot + label, Lora italic
  large title with persimmon period, two buttons (persimmon primary `open recipe →`,
  outline-on-dark `add to wednesday`)
- `EditorialHero` right card: image-top portrait card, italic serif title, status badge
- Section headers: colored leading dot (fresh-green for cook-tonight, persimmon for
  quick-shop, green for library), Lora italic 28px + persimmon period
- `RecipeCard` image-top: status badge overlaid top-left, time/servings overlay bottom-right,
  radius 14px outer

---

## Surface 6 · Plan Page

**Files:** `pages/PlanPage/PlanPage.css`, `PlanPage.tsx`

### Title row
- `PageTitle` eyebrow: `may 2026` (current month/year, lowercase)
- Title: "Plan" (was "Coming up")
- Summary: `N from the pantry · N need a shop · N open · next 7 days`
- Title row actions: `← / today / →` text nav buttons + `load date` calendar icon button
  (`// HANDOFF: load-date picker — stub, no modal yet`) + persimmon "add recipes to list"
  CTA with count pill (wired to existing AddFromPlanModal flow in ShoppingListPage — navigate
  to `/list` or open modal)

### Horizon strip (new)
- Single scrollable row of 16 date pills
- Today pill: ink fill, persimmon bottom-dot
- Past pills: 50% opacity
- Days with a meal: fresh-green dot
- Multi-meal days: persimmon `N×` label instead of dot
- Clicking a pill scrolls the day grid to that column

### Day grid
- 7 columns, full width, horizontally scrollable
- Today column: ink background card, 64×64 thumbnail, Lora italic recipe title, status chip
- Past days: 50% opacity, line-through recipe name, italic-serif "cooked" label
- Future days with recipe: plain row, sans 600 name, italic-serif `need X & N more` caption,
  status chip right
- Multi-meal days: primary card + stacked `MealRow` entries beneath (no image, name + chip)
- Empty days: dashed border, `open seat · + add recipe` text

### Recipe drag grid (below day grid — user decision)
- Full-width grid replacing the sidebar
- Same drag-and-drop logic, new CSS layout (4-column grid, cream cards)
- Section header: `Recipes.` Lora italic 28px

---

## Surface 7 · Shopping List

**Files:** `pages/ShoppingListPage/ShoppingListPage.css`, `ShoppingListPage.tsx`

Changes:
- Two-pane: aisle-grouped list (left ~60%) + sidebar (right ~40%)
- List: aisle sections with `Produce.` Lora italic 28px headers (persimmon period), running
  subtotals, 22×22 custom checkboxes (fresh-green when checked + line-through name), italic-
  serif reason chip below each item name, qty + price right-aligned
- Reason filter chips above list (uses `FilterStrip`)
- Sidebar:
  - Store picker card (cream, store name + location)
  - Delivery-window 2×2 grid (selected = persimmon outline + tint)
  - Totals card (italic-serif "est. total" label, large tabular number)
  - Persimmon `send to whole foods →` button (wired to existing Playwright enqueue)
  - Ink `AgentStatusCard` (already exists as a component — wire it here)

---

## Surface 8 · Mobile

**Files:** `components/BottomTabBar.tsx` (new), `components/BottomTabBar.css` (new),
`index.css` (media query additions), per-page mobile CSS blocks

### Shared mobile chrome
- `TopNav`: hidden on mobile (`display: none` at `≤768px`)
- `BottomTabBar` (new component): 5 tabs, inline SVG icons + 10px labels
  - Active: full ink text, 700 weight, 12% ink fill behind icon
  - Inactive: `var(--mute)`, 500 weight
  - Background: `rgba(243,245,242,0.94)` + `backdrop-filter: blur(20px)`
  - Positioned fixed at bottom; add `padding-bottom: 72px` to `.app-body` on mobile
- Page title on mobile: eyebrow (10px 700 0.16em) + 40–44px Lora italic
- Primary action: 38×38 persimmon `+` circle button top-right (per-page, where applicable)

### M1 · Home mobile
- Ink hero recipe card (image, persimmon eyebrow chip, Lora italic title, `→` CTA)
- Horizontal-scroll expiring chips strip
- 3-day glance (TUE/WED/THU rows with status chips)

### M2 · Pantry mobile
- Search input (paper2 bg, ⌕ glyph)
- Horizontal-scroll location pills
- Flat item list: name + qty, italic-serif `Nd` days right-aligned (color-coded)

### M3 · Recipes mobile
- Image-hero card + 2-up grid
- Filter chips

### M4 · Plan mobile (new layout)
- Date strip: 7 pills visible, today 3rd, scrollable
- Day stream: vertical scroll, section labels (`MON · MAY 11`), today = ink card,
  past = 50% opacity + line-through, empty = dashed open seat
- Sticky bottom CTA: persimmon `add recipes to list  N need shop →`
- `load date` button: top-right outlined calendar icon (`// HANDOFF: stub`)

### M5 · List mobile
- Aisle sections with Lora italic persimmon-period headers
- Custom checkboxes (fresh-green checked)
- Sticky bottom: persimmon send button + fresh-green agent-status line

---

## Component Vocabulary (cross-cutting)

### StatusChip
Existing component. CSS values to verify against spec:
- `cook`: fresh bg, paper text, uppercase 700 10px 0.10em
- `shop`: persimmon bg, paper text
- `leftover`: ink bg, paper text
- `open`: transparent + dashed mute border, mute text
- Dot: 6×6px circle, same as bg color of adjacent chip type (for visual distinction)

### FilterStrip chips
- Radius: 999px
- Fill: cream (inactive), ink (active)
- Text: ink (inactive), paper (active)
- Font: 12px 600

### Buttons
- `.btn-primary`: persimmon bg, paper text, radius 8px, 13px 600
- `.btn-outline`: transparent, ink border 1.5px, ink text, radius 8px
- `.btn-outline--on-dark`: transparent, paper border 1.5px, paper text (for use on ink cards)

---

## Conflicts / Out-of-Handoff Features

| Feature | Location | Handoff Coverage | Decision |
|---|---|---|---|
| Cook modal (mark cooked) | PlanPage | Not covered | Preserve, restyle |
| Recipe drag-and-drop | PlanPage | Not covered | Preserve, move below day grid as full-width grid |
| Recipe form / import modal | RecipesPage | Not covered | Preserve, restyle with new button styles |
| Auth / login page | LoginPage | Not covered | Restyle with new tokens |
| `shops` nav tab | TopNav | Listed but no route | Add as stub span |
| `load date` button | PlanPage, mobile M4 | Shown, picker not designed | Add button, stub action with `// HANDOFF:` |
| `add recipes to list` CTA | PlanPage | New CTA replacing old prop bar | Wire to AddFromPlanModal or navigate to /list |
| SelectionBar (bulk add/delete) | RecipesPage | Not covered | Preserve, restyle |
| AgentStatusCard | ShoppingListPage | Ink card in sidebar | Wire existing component into sidebar |
| Storybook stories | components/ | Not covered | Update CSS; stories auto-inherit |

---

## Testing

- Update unit test snapshots/assertions where class names or rendered text changes
  (`StatusChip.test.tsx`, `TopNav.test.tsx`, `PageTitle.test.tsx`, `FilterStrip.test.tsx`)
- Update `app.spec.ts` E2E assertions for Plan page (horizon strip, "add recipes to list"
  button label, day card structure)
- New `BottomTabBar.test.tsx` — basic render + active tab tests
- No new routes or data-layer changes; no migration or API test updates needed

---

## Stubs / TODOs (HANDOFF: prefix)

1. `// HANDOFF: shops route — nav tab present but /shops page not yet designed`
2. `// HANDOFF: load-date picker — calendar icon button is a stub; no date picker modal yet`
3. `// HANDOFF: add-to-wednesday — EditorialHero secondary button; wire to AddFromPlanModal or PlanPage`

---

## Output Deliverable

On completion: `HANDOFF-LANDED.md` at repo root with files changed, conflicts, stubs,
spot-check URLs, and open questions (per the handoff brief).
