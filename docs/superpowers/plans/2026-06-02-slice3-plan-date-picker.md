# Slice 3 Plan Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact Plan load-date modal that recenters the rolling rail, while keeping the Recipes hero as an immediate add-to-next-empty-day action with visible feedback.

**Architecture:** Add one focused `DatePickerModal` component and keep calendar state inside it until confirmation. Separate the Plan rail anchor from the real current date so distant ranges retain correct today/past semantics. Keep Recipes hero placement on the existing `useAddToNextEmptyDays` mutation and add local CTA feedback without changing the API.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest, React Testing Library, Playwright.

---

## File Structure

- Create `apps/web/src/components/DatePickerModal.tsx`: controlled mini-calendar modal with temporary month and selection state.
- Create `apps/web/src/components/DatePickerModal.css`: modal layout and responsive calendar styles using existing design tokens.
- Create `apps/web/src/components/DatePickerModal.test.tsx`: component behavior coverage.
- Modify `apps/web/src/lib/dateUtils.ts`: allow rail days to use a separate anchor and actual-today value.
- Modify `apps/web/src/lib/dateUtils.test.ts`: prove distant anchor semantics.
- Modify `apps/web/src/pages/PlanPage/PlanPage.tsx`: enable Plan load-date, anchor the 17-day rail, and scroll confirmed dates into view.
- Modify `apps/web/src/pages/PlanPage/PlanPage.css`: remove disabled-stub styling.
- Modify `apps/web/src/pages/RecipesPage/RecipesPage.tsx`: add hero auto-add pending, success, and retry feedback.
- Modify `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`: cover hero CTA feedback.
- Modify `apps/web/tests/app.spec.ts`: cover distant Plan loading and hero next-empty-day auto-add.
- Modify `PLAN.md`: move Slice 3 to Done only after both required suites pass.

### Task 1: Build The Date Picker Modal

**Files:**
- Create: `apps/web/src/components/DatePickerModal.tsx`
- Create: `apps/web/src/components/DatePickerModal.css`
- Create: `apps/web/src/components/DatePickerModal.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover the controlled contract before implementation:

```tsx
render(<DatePickerModal initialDate="2026-06-03" onConfirm={onConfirm} onClose={onClose} />);
expect(screen.getByRole('button', { name: 'Wednesday 3 June 2026' })).toHaveAttribute('aria-pressed', 'true');
fireEvent.click(screen.getByRole('button', { name: 'Thursday 11 June 2026' }));
fireEvent.click(screen.getByRole('button', { name: /choose thursday 11 june/i }));
expect(onConfirm).toHaveBeenCalledWith('2026-06-11');
```

Add separate tests that:

- Click `Next month`, select `Friday 10 July 2026`, and confirm `2026-07-10`.
- Click `Cancel` and assert `onClose` runs without `onConfirm`.
- Click the close button labelled `Close` and assert `onClose` runs without `onConfirm`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm --filter @eat/web test -- src/components/DatePickerModal.test.tsx
```

Expected: FAIL because `DatePickerModal` does not exist.

- [ ] **Step 3: Implement the controlled modal**

Create a component with this public contract:

```tsx
export interface DatePickerModalProps {
  initialDate: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ initialDate, onConfirm, onClose }: DatePickerModalProps) {
  // Parse YYYY-MM-DD in local time.
  // Keep selected ISO date and displayed month in component state.
  // Render Monday-first headings and leading blank grid cells.
  // Apply changes only when the confirm button is clicked.
}
```

Use `toIsoDate`, `addDays`, and local-time date construction. Give each calendar day a full accessible name such as `Wednesday 3 June 2026`, mark the selected button with `aria-pressed`, expose `Previous month`, `Next month`, `Close`, and `Cancel`, and label the confirm action `choose <full date>`.

Style with a fixed overlay, token-based paper panel, 7-column grid, selected-day state, and mobile-friendly width. Follow the existing `AddFromPlanModal` visual language rather than introducing global modal styles.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
pnpm --filter @eat/web test -- src/components/DatePickerModal.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DatePickerModal.tsx apps/web/src/components/DatePickerModal.css apps/web/src/components/DatePickerModal.test.tsx
git commit -m "feat(web): add compact date picker modal"
```

### Task 2: Recenter The Plan Rail

**Files:**
- Modify: `apps/web/src/lib/dateUtils.ts`
- Modify: `apps/web/src/lib/dateUtils.test.ts`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`

- [ ] **Step 1: Write failing date utility tests**

Add a test showing that a distant anchor controls the window while the actual current date controls semantic flags:

```ts
it('planWindowDays uses a separate anchor and actual today', () => {
  const anchor = new Date('2026-07-15T10:00:00');
  const today = new Date('2026-06-02T10:00:00');
  const days = planWindowDays(anchor, today);

  expect(days[0].iso).toBe('2026-07-13');
  expect(days[2].iso).toBe('2026-07-15');
  expect(days.some((day) => day.isToday)).toBe(false);
  expect(days.every((day) => !day.isPast)).toBe(true);
});
```

- [ ] **Step 2: Run the date utility tests and verify RED**

Run:

```bash
pnpm --filter @eat/web test -- src/lib/dateUtils.test.ts
```

Expected: FAIL because `planWindowDays` currently treats its only date argument as both anchor and today.

- [ ] **Step 3: Separate rail anchor from actual today**

Change the utility signature and derived flags:

```ts
export function planWindowDays(
  anchor: Date = new Date(),
  today: Date = new Date(),
): PlanWindowDay[] {
  const todayIso = toIsoDate(today);
  const start = addDays(anchor, -TODAY_INDEX);
  // Existing mapping remains, using todayIso for isToday and isPast.
}
```

- [ ] **Step 4: Run the date utility tests and verify GREEN**

Run:

```bash
pnpm --filter @eat/web test -- src/lib/dateUtils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire Plan to an anchor date and the modal**

In `PlanPage.tsx`:

- Capture actual today once: `const today = useMemo(() => new Date(), []);`.
- Store the rail anchor: `const [anchor, setAnchor] = useState(today);`.
- Derive `from`, `to`, and `days` from `anchor`; pass `today` separately to `planWindowDays(anchor, today)`.
- Derive summary counts from `days.slice(TODAY_INDEX, TODAY_INDEX + 7)` so a distant rail summarizes its focused seven-day segment.
- Rename the index-based scroll helper to `scrollToAnchor`.
- Open `DatePickerModal` from the enabled calendar button with `initialDate={toIsoDate(anchor)}`.
- On modal confirmation, parse the selected ISO date in local time, store it as the new anchor, close the modal, and let the existing loading effect scroll index `TODAY_INDEX` into view after the range renders.
- Make `today` restore the actual-today anchor and scroll it into view.
- Remove `.plan-scroll-btn--stub` styles.

Use an accessible button:

```tsx
<button className="plan-scroll-btn" onClick={() => setDatePickerOpen(true)} aria-label="Load date">
  {/* existing calendar svg */}
</button>
```

- [ ] **Step 6: Run focused web tests**

Run:

```bash
pnpm --filter @eat/web test -- src/lib/dateUtils.test.ts src/components/DatePickerModal.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/dateUtils.ts apps/web/src/lib/dateUtils.test.ts apps/web/src/pages/PlanPage/PlanPage.tsx apps/web/src/pages/PlanPage/PlanPage.css
git commit -m "feat(web): recenter plan rail from load-date picker"
```

### Task 3: Add Recipes Hero Auto-Add Feedback

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`

- [ ] **Step 1: Write failing hero CTA tests**

Extract and export a focused button component:

```tsx
<HeroPlanButton
  onAdd={() => Promise.resolve({ addedTo: ['Wed, 3 Jun'], skipped: [] })}
/>
```

Add tests that assert:

- The default label is `add to next open day`.
- While `onAdd` is unresolved, the disabled label is `adding...`.
- After success, the label is `added to Wed, 3 Jun`.
- After rejection, the label is `retry add to plan`, and clicking again invokes `onAdd` again.

- [ ] **Step 2: Run the Recipes page tests and verify RED**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/RecipesPage/RecipesPage.test.tsx
```

Expected: FAIL because `HeroPlanButton` does not exist.

- [ ] **Step 3: Implement the focused feedback component**

Add:

```tsx
export function HeroPlanButton({
  onAdd,
}: {
  onAdd: () => Promise<{ addedTo: string[]; skipped: string[] }>;
}) {
  // Track idle, pending, success, and error states.
  // Show the first returned date after success.
  // Retry by running the same onAdd callback.
}
```

Use it inside `EditorialHero`. Change the Recipes page callback to:

```ts
function handleAddFeatureToNextDay() {
  if (!feature) return Promise.resolve({ addedTo: [], skipped: [] });
  return addToNextEmptyDays.mutateAsync([{ recipeId: feature.id, servings: feature.servings }]);
}
```

Do not open `DatePickerModal` from Recipes. Do not alter bulk selection or recipe-form add-to-plan behavior.

- [ ] **Step 4: Run the Recipes page tests and verify GREEN**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/RecipesPage/RecipesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/RecipesPage/RecipesPage.test.tsx
git commit -m "feat(web): show recipes hero auto-add feedback"
```

### Task 4: Add Playwright Coverage

**Files:**
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Write failing Plan load-date E2E**

Add a test that:

- Visits `/plan`.
- Clicks `Load date`.
- Clicks `Next month`.
- Selects day `15` using its full accessible date name.
- Confirms the date.
- Observes a meal-plan GET whose `from` value is two days before the selected date and whose `to` value is fourteen days after it.
- Asserts the rail renders the selected day.

- [ ] **Step 2: Write failing Recipes hero E2E**

Add a test with route overrides that:

- Returns one list recipe and its detail recipe.
- Returns no occupied meal-plan entries for the forward scan.
- Captures the meal-plan POST.
- Visits `/recipes`.
- Clicks `add to next open day`.
- Asserts the POST uses the featured recipe, its servings, and today's ISO date.
- Asserts the CTA reports the formatted selected date and no date-picker dialog opens.

- [ ] **Step 3: Run the E2E suite and verify RED**

Run:

```bash
pnpm test:e2e
```

Expected: FAIL because Plan `Load date` is still disabled and Recipes hero feedback is not implemented.

- [ ] **Step 4: Adjust selectors or implementation only where the failing E2E reveals a real integration gap**

Keep route mocks scoped and preserve existing E2E behavior.

- [ ] **Step 5: Run the E2E suite and verify GREEN**

Run:

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tests/app.spec.ts
git commit -m "test(web): cover Slice 3 date selection flows"
```

### Task 5: Full Verification And Plan Update

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Run required verification**

Run:

```bash
pnpm test
pnpm test:e2e
```

Expected: both suites PASS.

- [ ] **Step 2: Update the living plan only after verification succeeds**

In `PLAN.md`:

- Change `Currently on` to state Slice 3 is complete and Slice 4 is next.
- Mark Slice 3 complete with `_2026-06-02_`.
- Add a Done entry describing the Plan compact date picker, distant 17-day rail recentering, Recipes hero next-empty-day feedback, and passing required suites.

- [ ] **Step 3: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark handoff backlog Slice 3 complete"
```

- [ ] **Step 4: Confirm a clean worktree**

Run:

```bash
git status --short
```

Expected: no output.
