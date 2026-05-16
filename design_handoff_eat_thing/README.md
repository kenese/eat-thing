# Handoff: Eat Thing — Frontend Redesign

## Overview

Eat Thing is a household food-management app (inventory, recipes, meal planning, auto-generated shopping lists, supermarket integration via Playwright). This package contains a full set of high-fidelity desktop screens covering the product's primary surfaces, plus the design system that ties them together.

The current production site has no homepage and no committed visual language. This handoff replaces that with a coherent system across **Home, Inventory, Recipes, Meal Plan, and Shopping List** at desktop, plus **Home, Pantry, Recipes, and List** for mobile — the same system condensed for phone. All screens share the same header, palette, type, components, and microcopy voice.

## About the Design Files

The HTML/JSX files in this bundle are **design references**, not production code. They were built as a fast iteration tool — React components rendered in a pan/zoom design canvas so the team could compare directions side-by-side.

**Your task:** recreate these designs in the existing `eat-thing` codebase, using its current stack (Vite + React, per the repo) and patterns. Lift the visual language verbatim — exact hex values, exact typography, exact spacing — but wire it to the real data layer (the `packages/shared` types, the Playwright agent, the inventory store, etc.). Do not ship the HTML directly.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and component shapes are locked. Recreate pixel-perfectly. Mobile screens are designed at **402×874** (iPhone 15 Pro logical size); desktop at **1280** wide. Tablet is not in this handoff — it can scale off either end.

---

## Design Tokens

### Color (locked — "Crisp" palette)

| Token | Hex | Use |
|---|---|---|
| `paper` | `#f3f5f2` | App background |
| `paper2` | `#eaeee7` | Sidebar / nested surface |
| `cream` | `#e6ebe4` | Chip/tag fills, soft cards |
| `ink` | `#0d1714` | Primary text, header bar, dark cards |
| `ink2` | `#3a443e` | Secondary text |
| `ink3` | `#5a6359` | Tertiary text, italic captions |
| `mute` | `#6e7872` | Labels, meta |
| `green` | `#1f5d33` | Workhorse brand green (section dots, "produce") |
| `fresh` | `#5aa758` | "Cook now" / safe-state accent |
| `persimmon` | `#d96e2e` | **Primary accent** — CTAs, headline period, "needs shop" state |
| `persimDeep` | `#b6541d` | Persimmon text-on-light contexts |
| `rule` | `rgba(13,23,20,0.08)` | 1px dividers |
| `rule2` | `rgba(13,23,20,0.04)` | Soft row dividers |

### Typography (locked)

- **Sans (UI):** `"Schibsted Grotesk", system-ui, sans-serif` — weights 400 / 600 / 700 / 800
- **Serif (display + italics):** `"Lora", serif` — italic 400/500 for "playful" accents
- Both via Google Fonts.

**Type scale (desktop):**
| Use | Family | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Page title (italic serif, e.g. "Recipes.") | Lora italic | 56px | 400 | -0.02em |
| Section header (italic serif) | Lora italic | 28px | 400 | — |
| Card title | Schibsted | 18–19px | 600 | -0.012em |
| Body | Schibsted | 14px | 400 | — |
| Italic caption / "uses 3 expiring" | Lora italic | 13px | 400 | — |
| Eyebrow label | Schibsted | 11px | 600/700 | 0.12–0.14em, uppercase |
| Mono-feel data | Schibsted, `tabular-nums` | 11–13px | 600 | — |

**Recurring typographic move:** the headline period is persimmon — `Recipes<span style={{color: persimmon}}>.</span>`. Apply this on every page title and section header.

### Spacing & shape

- Page horizontal gutter: **36px**
- Card padding: **14–22px**
- Card radius: **10–14px** (cards), **8px** (buttons/inputs), **999px** (chips)
- Image-top card radius: **14px** on outer, image is square-cornered at the top edge
- Section gap: **28–36px**
- Grid gap: **12–16px**

### Iconography

Minimal. The design uses **emoji-free** typography and unicode glyphs only (`⌕` for search, `→` italic serif for inline arrows, `·` for separators). Do not introduce an icon library; if you need icons, draw them inline as SVG to match the line-weight of `Lora`.

---

## Screens

### 1 · Home (`direction-3-greengrocer-v2.jsx`)

A dashboard summarizing the week.

- **Top bar:** ink-on-paper nav (`home / inventory / recipes / plan / list / shops`), wordmark `Eat<lora-italic>thing</lora-italic>` (sans + serif italic, persimmon `thing`), date + avatar right
- **Hero band (grid 1.4fr / 1fr):**
  - Left: green pill status (`you have what you need for monday & tuesday`), then a 76px display headline — `cook from <lora-italic green>what's already</lora-italic> in the kitchen<persimmon>.</persimmon>`
  - Right: dark ink card "use this week" — list of expiring items, day count in italic serif, persimmon for "today" items
- **Meals strip (5 cards):** 1 of 5 highlighted in `green` (active/hero card), others in `cream`. Each card has lowercase italic day label top, recipe name middle, status tag bottom.
- **Shop card (right):** cream card with auto-shop date, persimmon dollar amount italic serif, aisles broken out (produce / butcher / dairy / pantry), persimmon CTA `check out for me, wednesday →`.

### 2 · Inventory (`inventory-ledger.jsx`)

The most data-dense screen.

- Header + page title `Pantry.` + summary line (`127 items across 3 locations · 9 expiring soon · last reconciled 9:14 am`)
- Filter strip: pill filters (`All / Fridge / Pantry / Freezer / Expiring soon`), search input, sort dropdown
- Two-pane: aisle-grouped item list + sidebar with location summary, expiring-soon, low-stock staples, and inline-edit affordances on hover.

### 3 · Recipes (`recipes.jsx`)

Image-led browse.

- **Editorial hero (2fr / 1fr):**
  - Left: ink card with persimmon eyebrow `cook tonight · uses 3 expiring`, large italic serif title with persimmon period, body copy referencing inventory items as italic serif words, two buttons (`open recipe →` persimmon primary, `add to wednesday` outline-on-dark), meta strip
  - Right: portrait "editor's pick" card — image-top, italic serif title, status badge
- **Three sections:** `Cook tonight.` (fresh-green dot), `One quick shop.` (persimmon dot), `The library.` (green dot)
- **Cards:** image-top with status badge top-left overlay, time/servings bottom-right overlay. Cook-now uses fresh-green badge, missing N uses persimmon badge.

### 4 · Meal Plan (`meal-plan.jsx`)

**Date stream, not a fixed week.** Planning is no longer scoped to a mon→sun frame — any date can hold up to 4 recipes. The page opens with **today as the 3rd visible day** (2 past days dimmed on the left) and the horizon strip covers ~16 days forward. A `load date` button jumps anywhere.

- Title `Plan.` + eyebrow `may 2026` + summary (`3 from the pantry · 2 need a shop · 1 open · next 7 days`)
- **Date-strip controls** in the title row: `← / today / → / load date` + persimmon `add recipes to list` CTA with a count pill (replaces the old `regenerate list`)
- **Horizon strip** — 16 day pills in a single row, today filled ink + persimmon accent, past days dimmed, fresh-green dot for days with a meal, persimmon `N×` for multi-meal days. Tap to jump.
- **7 day cards** in a 7-column grid. Today is the ink card. Past days show a `cooked` checkmark + line-through name. Multi-meal days stack a smaller primary card with secondary `MealRow` entries beneath (no image, just name + missing-line + small chip). Empty days are a dashed `open seat · + add recipe` target.
- **Lower row:** `Open seats.` suggestion list (3 inventory-aware picks with `pick day →` buttons — user chooses which empty date to place into), and `Wednesday, 4:30 pm` auto-shop preview on ink, grouped by reason (`for wed roast`, `for fri pizza`, `weekly staples`).

### 5 · Shopping List (`shopping-list.jsx`)

The Playwright handoff.

- Title `The list.` + auto-built timestamp + reason filters (`All / Wed roast / Fri pizza / Staples / You added`)
- **Two-pane:** aisle-grouped list (`Produce. / Butcher. / Dairy & cheese. / Pantry & oils. / Frozen.`) with running subtotals, custom checkboxes (fresh-green when checked), italic-serif reason chips beside each item, qty + price right-aligned
- **Sidebar:**
  - Store picker card with WF green tile (`Whole Foods · Brooklyn`)
  - Delivery-window 2×2 grid (selected = persimmon outline + tint)
  - Totals card with italic-serif `est. total` label and big tabular number
  - Persimmon `send to whole foods →` button
  - Ink agent-status card: fresh-green dot, eyebrow `playwright agent · idle`, italic-serif explainer copy

---

## Mobile (`mobile.jsx`)

Designed at **402×874**. Five screens cover the primary phone contexts: home, pantry, recipes, plan, and list.

**Shared chrome:**
- **Status bar** is the device's native iOS — not part of the app.
- **Bottom tab bar** (5 tabs, inline SVG icons + 10px labels): `home / pantry / recipes / plan / list`. Active tab is full-ink + 700 weight + 12% ink fill on the icon; inactive is `mute` + 500 weight. Tab bar floats on `rgba(243,245,242,0.94)` with `backdrop-filter: blur(20px)`.
- **Page top** is consistent: eyebrow (10px 700 0.16em tracking) above the big italic-serif page title (40–44px Lora italic). Persimmon period stays.
- **Primary action** in the top-right is a 38×38 persimmon circular `+` button.
- **No emoji.** Inline SVG line icons only.

### M1 · Home — "Tonight"

- Title `Tonight.` + ink hero recipe card with image, persimmon eyebrow chip, italic-serif title, `→` CTA
- Horizontal-scroll "Use this week." expiring chips — today's item inverted to ink card + persimmon italic-serif day number
- 3-day glance: `TUE / WED / THU` rows with status chips

### M2 · Pantry — by expiry

- Title `Pantry.` + summary line (`29 on hand · 9 expiring`)
- Search input (paper2 background, ⌕ glyph)
- Horizontal-scroll location pills (`All / Expiring / Fridge / Pantry / Freezer`)
- Section subtitle `by expiry` (italic serif, green)
- Flat list rows: name + qty inline, italic-serif `Nd` on the right (urgent ≤3 days). Days ≤1 use warn red, ≤3 persimmon, ≤7 persimDeep, otherwise fresh-green.

### M3 · Recipes — image-led

- Title `Recipes.` + eyebrow `5 cookable now`
- Filter chips (`All / Cook now / Quick shop / Library`)
- Image-hero recipe card with status badge top-left, time-overlay bottom-right
- 2-up grid of image-top recipe cards

### M4 · Plan — date stream

- Title `Plan.` + eyebrow `may 2026` + two top-right buttons: outlined calendar (`load date`) and persimmon `+` (add recipe)
- **Date strip** (7 pills visible, today is 3rd so 2 past dimmed on the left, scrollable horizontally for ~2 weeks forward): weekday short above large Lora-italic day number; today is ink-filled with persimmon dot; multi-meal days show a small `N×` instead of a dot
- **Summary line:** `N ready · N need a shop · next 7 days`
- **Day stream** (vertical scroll): each day is a section with a small dashed-rule label (`MON · MAY 11`). Today's label is persimmon with the italic-serif word `today.` next to it.
  - **Today:** ink card, 64×64 thumbnail, italic-serif recipe title, status chip on the right
  - **Other future days:** plain row — recipe name (sans 600), italic-serif `need X & N more` or `Nm · tag` underneath, status chip on the right. Multi-meal days stack 2+ rows with a `2 meals` count in the day label.
  - **Past days:** opacity 0.5, line-through name, italic-serif `cooked` indicator
  - **Empty days:** dashed `open seat   + add recipe`
- **Sticky bottom CTA:** persimmon `add recipes to list   N need shop →`

### M5 · List — in-store check-off

- Title `The list.` + italic-serif persimmon dollar amount in the corner
- Reason filter chips
- Aisle sections (`Produce. / Butcher. / Dairy.`) with italic-serif persimmon-period titles
- 22×22 custom checkboxes, fresh-green when checked + line-through item name
- Each item has italic-serif reason caption below name
- Sticky bottom panel: persimmon `send to Whole Foods · $58.29 →` button + fresh-green agent-status line

---

## Recurring Component Vocabulary

**Status chips** appear everywhere with consistent meaning:
| State | Background | Foreground | Label |
|---|---|---|---|
| Cook now | `fresh` (`#5aa758`) | `paper` | `cook now` (uppercase, 0.10em tracking, 700 weight, 10px) |
| Needs shop | `persimmon` (`#d96e2e`) | `paper` | `missing N` or `needs shop` |
| Leftover | `ink` (`#0d1714`) | `paper` | `leftover` |
| Open seat | transparent + dashed `mute` border | `mute` | `open seat` |

**Italic-serif eyebrow rule:** every page title and section header ends with a persimmon period. Every italic-serif "why" caption (`need cilantro, butter & 1 more`, `uses 3 expiring`, `last reconciled · 9:14 am`) uses Lora italic 12–14px in `ink3` or `mute`.

**Image slots** are user-fillable in the prototypes. In production, replace with `<img>` against the recipe's `imageUrl` from the data layer.

---

## Interactions & Behavior

This handoff is visual; the prototypes are static. Behaviors to wire:

- **Inventory match across screens.** Every recipe/meal card derives its status from `recipe.ingredients` ∩ `inventory.items`. The 0/1-3/3+ thresholds are: 0 = cook now, 1–3 = quick shop, 4+ = library.
- **Shopping list grouping.** Items are aisle-grouped with running subtotals. Reason chips trace back to which meal or which low-staple rule put them there.
- **Playwright handoff.** The "send to whole foods" button enqueues the Playwright job. The agent-status card is a live read of the agent state (`idle / running / awaiting confirmation / failed`).
- **Cook flow.** Not in this handoff — to design next.

---

## Files in This Bundle

- `README.md` — this document
- `screenshots/` — reference renders. **These are indicative snapshots, not the source of truth — when in doubt, open `Eat Thing - Directions.html` to see the live canvas.**
  - `01-home.png` … `05-shopping-list.png` — desktop (1280 wide)
  - `06-mobile-home.png` … `10-mobile-list.png` — mobile (in iPhone frame)
- `direction-3-greengrocer-v2.jsx` — desktop Home
- `inventory-ledger.jsx` — desktop Inventory
- `recipes.jsx` — desktop Recipes
- `meal-plan.jsx` — desktop Meal Plan
- `shopping-list.jsx` — desktop Shopping List
- `mobile.jsx` — all five mobile screens (`MHome / MInventory / MRecipes / MPlan / MList`)
- `ios-frame.jsx` — iPhone bezel used only for the design canvas; **not part of production**
- `image-slot.js` — drop-target placeholder used in the prototypes; replace with `<img>` in production
- `design-canvas.jsx` — design tool only, not for production
- `Eat Thing - Directions.html` — the canvas wrapper showing all artboards side-by-side

---

## Assets

No raster assets in this bundle. Recipe photography is user-supplied via `<image-slot>` drop targets in the prototypes; in production each `Recipe` should carry an `imageUrl`. Wordmark `Eat thing` is typeset (Schibsted 22/800 + Lora italic 28/400), no logo file.

---

## Open Questions for the Implementer

1. **Tablet.** Not designed. Desktop layouts should hold down to ~960px; below that, fall back to the mobile layout.
2. **Empty states.** Inventory with 0 items, recipe library with 0 recipes — not yet designed. Use the same visual vocabulary (italic serif "nothing here yet" + persimmon CTA).
3. **Cook flow modal.** The deduction prompt (`how many garlic bulbs left?`) is the next screen on the design queue.
4. **Onboarding.** First-time inventory setup is the hardest UX problem in the product and is unaddressed here.
5. **Shops / agent status view.** A dedicated screen for Playwright connection state, run history, and manual override is not yet designed.
6. **`load date` picker.** The calendar-icon button on both desktop and mobile plan screens is a placeholder — the actual date-picker affordance (modal? inline mini-cal?) needs design + a clear definition of what "load" means (scroll-to vs. recenter-strip).
