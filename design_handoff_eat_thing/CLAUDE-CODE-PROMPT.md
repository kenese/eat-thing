# Claude Code Prompt — Refresh Eat Thing styles from new handoff

Copy everything below the line and paste into Claude Code at the root of the
`eat-thing` repo. Attach the `design_handoff_eat_thing/` folder alongside.

---

I have a refreshed design handoff in `design_handoff_eat_thing/`. The previous
version of this handoff is already partially landed in the codebase but is
stale — palette, typography, and several screens have moved on. **Update the
live app to match this new handoff exactly**, while preserving the real data
layer, routing, and any features that already exist in the app but aren't in
the handoff (see "Conflict policy" below).

## Read first
1. `design_handoff_eat_thing/README.md` — the full design spec. Treat this as
   the source of truth for visual + interaction decisions.
2. `Eat Thing - Directions.html` — open this in a browser to see every screen
   live (the JSX files load into a design canvas). Use this when the README
   text is ambiguous.
3. The individual `*.jsx` files for the exact markup/structure of each screen.
   These are React design references, not production code — lift the visual
   structure, don't copy them wholesale.

## Scope of the refresh
Update the following surfaces in the app:

- **Design tokens** (colors, typography, spacing, radii) — see README "Design
  Tokens". Replace any existing token files (`theme.ts`, `colors.ts`,
  `tokens.css`, etc.) with values from the spec. Persimmon `#d96e2e` is the
  primary accent everywhere; locked palette is "Crisp".
- **Typography** — Schibsted Grotesk (sans) + Lora (serif italic, for display
  and "playful" accents). Load both from Google Fonts. Apply the type scale
  from the README. The persimmon-period rule applies to every page title and
  section header.
- **Top nav / wordmark** — ink-on-paper bar, `Eat<lora-italic persimmon>thing`
  wordmark, lowercase nav tabs with persimmon underline on active.
- **Five desktop screens**: Home, Inventory, Recipes, Meal Plan, Shopping List.
- **Five mobile screens**: Home, Pantry, Recipes, Plan, List, plus the shared
  tab bar.
- **Component vocabulary**: status chips, italic-serif "why" captions, card
  shapes, button styles, filter chips — see README "Recurring Component
  Vocabulary".

## What changed since the last handoff (heads-up)

- **Meal plan is now a date stream, not a fixed week.** Any date holds 0–4
  recipes. The page opens with today as the 2nd visible card on desktop / 3rd
  on mobile, with past days dimmed on the left and ~2 weeks scrollable on the
  right. The desktop day-strip is horizontally scrollable (the rest of the
  page scrolls vertically as normal flow). The old "regenerate list" CTA is
  now "add recipes to list".
- **There is no "this week" framing anymore.** Remove anything that assumes a
  monday→sunday window.
- **A "load date" affordance** (calendar icon button) exists on both desktop
  and mobile plan screens — wire it to the existing date picker if you have
  one; otherwise leave it as a stub and flag it in your summary.
- **Mobile plan screen is new** (M4 in the handoff). The old 4-screen mobile
  set is now 5 screens.

## Conflict policy

The handoff is visual-only and is intentionally narrower than the live app.
When you find features in the codebase that aren't in the handoff (cook flow,
onboarding, shop/agent status views, settings, auth, recipe editor, etc.):

1. **Don't delete them.** Restyle them with the new tokens, type, and component
   vocabulary so they fit visually. Status chips, italic-serif eyebrows, and
   the persimmon-period rule should be applied consistently.
2. **Don't invent new behavior** to match the design. If a screen in the
   design has a button the live app doesn't support (e.g. "pick day"), wire it
   to the closest existing action or leave a clear TODO in code with a
   `// HANDOFF:` prefix.
3. **Flag every conflict in your final summary** (see "Output" below). I want
   to triage them, not have you guess.

## Specifically don't touch

- The Playwright agent integration (`packages/...` — wire only the styling of
  the agent-status card; don't change behavior)
- The inventory data model in `packages/shared`
- Routing structure
- Any environment / build config

## Output

When you're done, write a `HANDOFF-LANDED.md` at the repo root with:

1. **Files changed** — grouped by surface (tokens, nav, home, inventory, etc.)
2. **Conflicts found** — for each, one line: where it is, what the handoff
   doesn't cover, what you did about it.
3. **Stubs / TODOs** — anything you left `// HANDOFF:`-tagged in code.
4. **Visual diffs to spot-check** — list the 5–10 screens I should open first
   to verify the refresh landed correctly. Include the URLs.
5. **Open questions** — anything ambiguous in the handoff that you had to
   guess on.

## Approach

Work in this order so I can review incrementally:

1. Tokens + typography (one PR/commit). Verify the existing screens still
   render without exploding before moving on.
2. Top nav + shared chrome (one commit).
3. One screen at a time, desktop first. Start with **Home** (lowest risk),
   end with **Meal Plan** (most changed).
4. Mobile screens last.
5. Cross-cutting components (status chip, filter chip, day card) — refactor
   into shared components as you go; don't duplicate.

Commit often. Don't try to land everything in one diff.
