# Slice 5 Plan Auto-Shop Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Plan-page auto-shop preview backed by a household-scoped pre-flight API, then confirm through the existing shopping-list mutation and navigate to `/list`.

**Architecture:** Extract the existing shopping-list derivation logic into a shared server helper so preview and confirm use the same rules. Add a preview route plus shared types on the backend, then layer a Plan-local preview panel and query hook on the frontend that loads on demand and confirms via the existing `/from-plan` mutation.

**Tech Stack:** React 19, TanStack Query, React Router, Express, Drizzle, Vitest, Playwright.

---

### Task 1: Shared types and server preview contract

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write the failing server contract test**

```ts
it('POST /preview-from-plan returns a read-only preview payload', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

  const res = await request(app)
    .post('/api/shopping-lists/preview-from-plan')
    .send({ entryIds: ['550e8400-e29b-41d4-a716-446655440000'] });

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    scheduledFor: '2026-06-05',
    entryIds: ['550e8400-e29b-41d4-a716-446655440000'],
    dayCount: 1,
    recipeCount: 1,
    itemCount: 2,
    recipeItemCount: 1,
    stapleItemCount: 1,
  });
});
```

- [ ] **Step 2: Run the server test to verify it fails**

Run: `pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts`
Expected: FAIL because `POST /api/shopping-lists/preview-from-plan` does not exist yet.

- [ ] **Step 3: Add the shared preview response type**

```ts
export interface ShoppingListPreviewItem {
  canonicalFoodId: string;
  name: string;
  qty: number;
  unit: string;
  source: 'recipe' | 'staple';
  sourceRecipeNames: string[] | null;
  sourceRecipeId: string | null;
}

export interface ShoppingListFromPlanPreview {
  scheduledFor: string | null;
  entryIds: string[];
  dayCount: number;
  recipeCount: number;
  itemCount: number;
  recipeItemCount: number;
  stapleItemCount: number;
  items: ShoppingListPreviewItem[];
}
```

- [ ] **Step 4: Run the server test again**

Run: `pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts`
Expected: FAIL still points at missing route or behavior, not missing types.

### Task 2: Shared derivation helper and preview API

**Files:**
- Create: `apps/server/src/lib/shopping-list-from-plan.ts`
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Test: `apps/server/src/routes/shopping-lists.test.ts`
- Test: `apps/server/src/routes/shopping-lists.from-plan.test.ts`

- [ ] **Step 1: Write or extend failing tests for preview behavior and non-mutation**

```ts
expect(mocks.insertValues).not.toHaveBeenCalled();
expect(mocks.updateSet).not.toHaveBeenCalled();
expect(res.body.items).toEqual([
  expect.objectContaining({ source: 'recipe', name: 'Tomatoes' }),
  expect.objectContaining({ source: 'staple', name: 'Rice' }),
]);
```

- [ ] **Step 2: Run the targeted server tests**

Run: `pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts src/routes/shopping-lists.from-plan.test.ts`
Expected: FAIL with missing route / failing preview assertions.

- [ ] **Step 3: Extract the shared derivation helper**

```ts
export async function deriveShoppingListFromPlanPreview(
  householdId: string,
  entryIds: string[],
): Promise<ShoppingListFromPlanPreview> {
  // load recipe ingredients
  // subtract inventory using amountInUnit()
  // append low-stock staples
  // load current list scheduledFor
  // return preview payload without writes
}
```

- [ ] **Step 4: Reuse the helper in both routes**

```ts
router.post('/preview-from-plan', withHousehold, async (req, res) => {
  const parse = fromPlanSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  const preview = await deriveShoppingListFromPlanPreview(req.householdId, parse.data.entryIds);
  res.json(preview);
});
```

```ts
const derived = await deriveShoppingListFromPlanPreview(hid, entryIds);
const recipeItemsToInsert = derived.items.filter((item) => item.source === 'recipe');
const stapleItemsToInsert = derived.items.filter((item) => item.source === 'staple');
```

- [ ] **Step 5: Run targeted server tests to green**

Run: `pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts src/routes/shopping-lists.from-plan.test.ts`
Expected: PASS for preview route and existing from-plan behavior.

### Task 3: Plan-page preview hook and UI

**Files:**
- Modify: `apps/web/src/hooks/useShoppingList.ts`
- Create: `apps/web/src/pages/PlanPage/AutoShopPreviewPanel.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`
- Test: `apps/web/src/pages/PlanPage/PlanPage.test.tsx`

- [ ] **Step 1: Write the failing Plan page tests**

```ts
it('opens the auto-shop preview and confirms through the shopping-list mutation', async () => {
  render(
    <MemoryRouter>
      <PlanPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /add recipes to list/i }));
  expect(await screen.findByText(/shopping for 2026-06-05/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /update list/i }));
  expect(mockApplyPlanToShoppingList).toHaveBeenCalledWith({ entryIds: ['entry-1'] });
  expect(mockNavigate).toHaveBeenCalledWith('/list');
});
```

- [ ] **Step 2: Run the Plan page test to verify it fails**

Run: `pnpm --filter @eat/web test -- src/pages/PlanPage/PlanPage.test.tsx`
Expected: FAIL because the preview panel and hook do not exist yet.

- [ ] **Step 3: Add the preview query hook**

```ts
export function useShoppingListFromPlanPreview(entryIds: string[], enabled: boolean) {
  return useQuery<ShoppingListFromPlanPreview>({
    queryKey: ['shopping-list', 'preview-from-plan', ...entryIds],
    enabled: enabled && entryIds.length > 0,
    queryFn: () => api.post<ShoppingListFromPlanPreview>('/api/shopping-lists/preview-from-plan', { entryIds }),
  });
}
```

- [ ] **Step 4: Add the Plan-local preview panel and wire it into `PlanPage`**

```tsx
<AutoShopPreviewPanel
  entryIds={previewEntryIds}
  isOpen={isPreviewOpen}
  onClose={() => setPreviewOpen(false)}
  onConfirm={async (entryIds) => {
    await applyPlanToShoppingList.mutateAsync({ entryIds });
    navigate('/list');
  }}
/>
```

- [ ] **Step 5: Run the Plan page test to green**

Run: `pnpm --filter @eat/web test -- src/pages/PlanPage/PlanPage.test.tsx`
Expected: PASS with explicit loading, empty, error, and confirm behavior.

### Task 4: End-to-end coverage and plan bookkeeping

**Files:**
- Modify: `apps/web/tests/app.spec.ts`
- Modify: `PLAN.md`

- [ ] **Step 1: Write the failing E2E assertion**

```ts
test('plan auto-shop preview confirms and sends the user to the shopping list', async ({ page }) => {
  await page.goto('/plan');
  await page.getByRole('button', { name: /add recipes to list/i }).click();
  await expect(page.getByText(/shopping for/i)).toBeVisible();
  await page.getByRole('button', { name: /update list/i }).click();
  await expect(page).toHaveURL(/\/list$/);
});
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run: `pnpm test:e2e -- --grep "plan auto-shop preview confirms and sends the user to the shopping list"`
Expected: FAIL because the preview flow is not wired yet.

- [ ] **Step 3: Update `PLAN.md` after implementation succeeds**

```md
- [x] Slice 5: Plan auto-shop read-only preview + pre-flight API — _2026-06-03_
```

Also move the completion summary into the Done log with the date, matching the existing format.

- [ ] **Step 4: Run the focused E2E to green**

Run: `pnpm test:e2e -- --grep "plan auto-shop preview confirms and sends the user to the shopping list"`
Expected: PASS.

- [ ] **Step 5: Run the full required verification**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: PASS.
