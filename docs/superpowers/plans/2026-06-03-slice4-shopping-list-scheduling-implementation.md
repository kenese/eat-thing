# Slice 4 Shopping List Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store a nullable scheduled shopping date on the active shopping list, edit it from the Shopping List header, and show that date in Recipes quick-shop copy.

**Architecture:** Add one nullable `date` field to `shopping_lists`, expose it as `scheduledFor: string | null`, and update it through a household-scoped shopping-list PATCH route. The web app reuses `DatePickerModal`, adds one shopping-list metadata mutation, and lets Recipes read the current list without creating one.

**Tech Stack:** Drizzle/Postgres migrations, Express + Zod, TanStack Query, React Testing Library/Vitest, Playwright.

---

## File Map

- Modify `apps/server/drizzle/0014_shopping_list_scheduled_for.sql`: add the database column.
- Modify `apps/server/drizzle/meta/_journal.json`: add the migration journal entry.
- Modify `apps/server/src/db/schema/shopping.ts`: add `scheduledFor` to the Drizzle table.
- Modify `packages/shared/src/shopping.ts`: add `scheduledFor` to `ShoppingList` and add `UpdateShoppingListInput`.
- Modify `apps/server/src/routes/shopping-lists.ts`: include `scheduledFor`, add PATCH validation/route, preserve existing household scoping.
- Modify `apps/server/src/routes/shopping-lists.test.ts`: server TDD coverage for read/update/validation/foreign-household behavior.
- Modify `apps/server/src/routes/shopping-lists.from-plan.test.ts`: keep mocked schema/list payload aligned with `scheduledFor`.
- Modify `apps/web/src/dev/mockApi.ts`: include `scheduledFor` in dev shopping-list payloads.
- Modify `apps/web/src/hooks/useShoppingList.ts`: add `useUpdateShoppingList`.
- Modify `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`: add header date chip and modal flow.
- Modify `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`: component TDD for date chip and mutation.
- Modify `apps/web/src/pages/RecipesPage/RecipesPage.tsx`: read current list and render dated quick-shop copy.
- Modify `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`: component TDD for dated/fallback copy.
- Modify `apps/web/tests/app.spec.ts`: E2E coverage for setting the date on `/list` and seeing it on `/recipes`.
- Modify `DECISIONS.md`: add one numbered decision for household-local shopping-list scheduled dates.

## Task 1: Database, Shared Type, And Server Read Payload

**Files:**
- Create: `apps/server/drizzle/0014_shopping_list_scheduled_for.sql`
- Modify: `apps/server/drizzle/meta/_journal.json`
- Modify: `apps/server/src/db/schema/shopping.ts`
- Modify: `packages/shared/src/shopping.ts`
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`
- Modify: `apps/server/src/routes/shopping-lists.from-plan.test.ts`

- [ ] **Step 1: Write failing current-list test**

Add this test inside `describe('shopping-lists router', ...)` in `apps/server/src/routes/shopping-lists.test.ts`:

```ts
it('GET /current returns the scheduled shopping date', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
  mocks.selectFrom.mockResolvedValueOnce([{
    id: '550e8400-e29b-41d4-a716-446655440001',
    householdId: 'hh-1',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    finalizedAt: null,
    scheduledFor: '2026-06-05',
  }]);
  mocks.selectFrom.mockResolvedValueOnce([]);

  const res = await request(app).get('/api/shopping-lists/current');

  expect(res.status).toBe(200);
  expect(res.body.scheduledFor).toBe('2026-06-05');
  expect(res.body.items).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts -t "GET /current returns the scheduled shopping date"
```

Expected: FAIL because `scheduledFor` is missing from the response.

- [ ] **Step 3: Add migration**

Create `apps/server/drizzle/0014_shopping_list_scheduled_for.sql`:

```sql
ALTER TABLE "shopping_lists"
  ADD COLUMN IF NOT EXISTS "scheduled_for" date;
```

Append this entry to `apps/server/drizzle/meta/_journal.json` after the current final entry. The current final tracked index is `12`, so this new entry uses `13`:

```json
{
  "idx": 13,
  "version": "7",
  "when": 1780444800000,
  "tag": "0014_shopping_list_scheduled_for",
  "breakpoints": true
}
```

- [ ] **Step 4: Update schema and shared type**

In `apps/server/src/db/schema/shopping.ts`, import `date` and add the field:

```ts
import { pgTable, uuid, text, timestamp, date, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';
```

```ts
export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at'),
  scheduledFor: date('scheduled_for'),
});
```

In `packages/shared/src/shopping.ts`, update the list type:

```ts
export interface ShoppingList {
  id: string;
  householdId: string;
  createdAt: string;
  finalizedAt: string | null;
  scheduledFor: string | null;
  items: ShoppingListItem[];
}
```

- [ ] **Step 5: Include scheduledFor in server list columns**

In `apps/server/src/routes/shopping-lists.ts`, update `listCols`:

```ts
const listCols = {
  id: shoppingLists.id,
  householdId: shoppingLists.householdId,
  createdAt: shoppingLists.createdAt,
  finalizedAt: shoppingLists.finalizedAt,
  scheduledFor: shoppingLists.scheduledFor,
};
```

- [ ] **Step 6: Align test mocks for schema shape**

In `apps/server/src/routes/shopping-lists.test.ts`, update the mocked schema object:

```ts
shoppingLists: {
  id: 'shoppingListId',
  householdId: 'shoppingListHouseholdId',
  createdAt: 'shoppingListCreatedAt',
  finalizedAt: 'shoppingListFinalizedAt',
  scheduledFor: 'shoppingListScheduledFor',
},
```

In `apps/server/src/routes/shopping-lists.from-plan.test.ts`, update the mocked `shoppingLists` schema similarly:

```ts
shoppingLists: {
  id: 'shoppingListId',
  householdId: 'shoppingListHouseholdId',
  createdAt: 'shoppingListCreatedAt',
  finalizedAt: 'shoppingListFinalizedAt',
  scheduledFor: 'shoppingListScheduledFor',
},
```

- [ ] **Step 7: Run test to verify GREEN**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts -t "GET /current returns the scheduled shopping date"
```

Expected: PASS.

- [ ] **Step 8: Add from-plan read assertion**

In `apps/server/src/routes/shopping-lists.from-plan.test.ts`, add or extend a focused test so the final selected list row includes:

```ts
{
  id: 'list-1',
  householdId: 'hh-1',
  createdAt: new Date('2026-06-01T00:00:00Z'),
  finalizedAt: null,
  scheduledFor: '2026-06-05',
}
```

Assert:

```ts
expect(res.body.scheduledFor).toBe('2026-06-05');
```

- [ ] **Step 9: Run focused server tests**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts src/routes/shopping-lists.from-plan.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/server/drizzle/0014_shopping_list_scheduled_for.sql \
  apps/server/drizzle/meta/_journal.json \
  apps/server/src/db/schema/shopping.ts \
  packages/shared/src/shopping.ts \
  apps/server/src/routes/shopping-lists.ts \
  apps/server/src/routes/shopping-lists.test.ts \
  apps/server/src/routes/shopping-lists.from-plan.test.ts
git commit -m "feat(server): return shopping list scheduled date"
```

## Task 2: Household-Scoped Scheduled Date Update API

**Files:**
- Modify: `packages/shared/src/shopping.ts`
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`
- Modify: `apps/web/src/hooks/useShoppingList.ts`

- [ ] **Step 1: Write failing set-date route test**

Add helper near the existing route helpers in `apps/server/src/routes/shopping-lists.test.ts`:

```ts
async function patchShoppingList(listId: string, body: { scheduledFor?: string | null }) {
  const app = express();
  app.use(express.json());
  app.use('/api/shopping-lists', shoppingListsRouter);
  return request(app).patch(`/api/shopping-lists/${listId}`).send(body);
}
```

Add test:

```ts
it('PATCH /:listId sets a scheduled shopping date for an owned list', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
  mocks.updateSet.mockClear();
  mocks.selectFrom.mockResolvedValueOnce([{
    id: '550e8400-e29b-41d4-a716-446655440001',
    householdId: 'hh-1',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    finalizedAt: null,
    scheduledFor: '2026-06-05',
  }]);
  mocks.selectFrom.mockResolvedValueOnce([]);

  const res = await patchShoppingList('550e8400-e29b-41d4-a716-446655440001', {
    scheduledFor: '2026-06-05',
  });

  expect(res.status).toBe(200);
  expect(mocks.updateSet).toHaveBeenCalledWith({ scheduledFor: '2026-06-05' });
  expect(mocks.updateWhereArgs).toHaveBeenCalledWith(expect.arrayContaining([
    { field: 'shoppingListId', value: '550e8400-e29b-41d4-a716-446655440001' },
    { field: 'shoppingListHouseholdId', value: 'hh-1' },
  ]));
  expect(res.body.scheduledFor).toBe('2026-06-05');
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts -t "sets a scheduled shopping date"
```

Expected: FAIL with 404 or missing route.

- [ ] **Step 3: Add shared input type**

In `packages/shared/src/shopping.ts`, add:

```ts
export interface UpdateShoppingListInput {
  scheduledFor: string | null;
}
```

- [ ] **Step 4: Add API validation and route**

In `apps/server/src/routes/shopping-lists.ts`, add after `updateItemSchema`:

```ts
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'scheduledFor must be a valid ISO date');

const updateListSchema = z.object({
  scheduledFor: isoDateSchema.nullable(),
});
```

Add route before item-specific routes:

```ts
// PATCH /api/shopping-lists/:listId
router.patch('/:listId', withHousehold, async (req, res) => {
  const listId = req.params['listId'] as string;
  if (!z.string().uuid().safeParse(listId).success) {
    res.status(404).json({ error: 'Shopping list not found' });
    return;
  }

  const parse = updateListSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  try {
    await db.update(shoppingLists)
      .set({ scheduledFor: parse.data.scheduledFor })
      .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, req.householdId)));

    const [updatedList] = await db
      .select(listCols)
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, req.householdId)))
      .limit(1);

    if (!updatedList) {
      res.status(404).json({ error: 'Shopping list not found' });
      return;
    }

    const items = await itemsForList(listId, req.householdId);
    res.json({ ...updatedList, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 5: Run set-date test to verify GREEN**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts -t "sets a scheduled shopping date"
```

Expected: PASS.

- [ ] **Step 6: Add failing clear-date, invalid-date, and foreign-list tests**

Add:

```ts
it('PATCH /:listId clears the scheduled shopping date', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
  mocks.selectFrom.mockResolvedValueOnce([{
    id: '550e8400-e29b-41d4-a716-446655440001',
    householdId: 'hh-1',
    createdAt: new Date('2026-06-01T00:00:00Z'),
    finalizedAt: null,
    scheduledFor: null,
  }]);
  mocks.selectFrom.mockResolvedValueOnce([]);

  const res = await patchShoppingList('550e8400-e29b-41d4-a716-446655440001', {
    scheduledFor: null,
  });

  expect(res.status).toBe(200);
  expect(mocks.updateSet).toHaveBeenCalledWith({ scheduledFor: null });
  expect(res.body.scheduledFor).toBeNull();
});

it('PATCH /:listId rejects invalid scheduled dates', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

  const res = await patchShoppingList('550e8400-e29b-41d4-a716-446655440001', {
    scheduledFor: '2026-02-31',
  });

  expect(res.status).toBe(400);
  expect(mocks.updateSet).not.toHaveBeenCalled();
});

it('PATCH /:listId returns not found for a foreign household list', async () => {
  mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
  mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
  mocks.selectFrom.mockResolvedValueOnce([]);

  const res = await patchShoppingList('550e8400-e29b-41d4-a716-446655440001', {
    scheduledFor: '2026-06-05',
  });

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'Shopping list not found' });
});
```

- [ ] **Step 7: Run tests to verify GREEN**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts -t "PATCH /:listId"
```

Expected: PASS.

- [ ] **Step 8: Add web hook mutation**

In `apps/web/src/hooks/useShoppingList.ts`, import `UpdateShoppingListInput`:

```ts
  UpdateShoppingListInput,
```

Add:

```ts
export function useUpdateShoppingList(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateShoppingListInput) =>
      api.patch<ShoppingList>(`/api/shopping-lists/${listId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm --filter @eat/server test -- src/routes/shopping-lists.test.ts
pnpm --filter @eat/web test -- src/hooks/useMealPlan.test.tsx
```

Expected: server tests PASS; the web command PASSes and catches TypeScript/import breakage in the test build.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/shopping.ts \
  apps/server/src/routes/shopping-lists.ts \
  apps/server/src/routes/shopping-lists.test.ts \
  apps/web/src/hooks/useShoppingList.ts
git commit -m "feat(api): update shopping list scheduled date"
```

## Task 3: Shopping List Header Date Chip

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`
- Modify: `apps/web/src/dev/mockApi.ts`

- [ ] **Step 1: Write failing component test**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`, add `useUpdateShoppingList` to the hoisted mocks:

```ts
useUpdateShoppingList: vi.fn(),
```

Add it to the mocked `../../hooks/useShoppingList` export:

```ts
useUpdateShoppingList: hooks.useUpdateShoppingList,
```

Add `scheduledFor: null` to `baseList`.

In the existing `beforeEach`, add a default mutation mock:

```ts
hooks.useUpdateShoppingList.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
```

Add this test:

```tsx
it('opens a date picker from the scheduled shop chip and confirms a date', async () => {
  const mutate = vi.fn();
  hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
  hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
  hooks.useUpdateShoppingList.mockReturnValue({ mutate, isPending: false, isError: false });
  hooks.useCurrentShoppingList.mockReturnValue({
    data: { ...baseList, scheduledFor: null },
    isLoading: false,
  });

  renderPage();

  fireEvent.click(screen.getByRole('button', { name: /set shop date/i }));
  expect(screen.getByRole('dialog', { name: /choose a date/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '5' }));
  fireEvent.click(screen.getByRole('button', { name: /use/i }));

  await waitFor(() => expect(mutate).toHaveBeenCalledWith({ scheduledFor: expect.stringMatching(/^\d{4}-\d{2}-05$/) }));
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx -t "scheduled shop chip"
```

Expected: FAIL because `Set shop date` is not rendered.

- [ ] **Step 3: Add date formatting helpers and modal state**

In `ShoppingListPage.tsx`, add `DatePickerModal` and `useUpdateShoppingList` to the existing imports:

```ts
import { DatePickerModal } from '../../components/DatePickerModal';
import {
  useCurrentShoppingList,
  useUpdateShoppingList,
  useUpdateShoppingListItem, useAddShoppingListItem, useDeleteShoppingListItem,
  usePurchaseShoppingListItems, useBatchDeleteShoppingListItems,
} from '../../hooks/useShoppingList';
```

Add helpers near other local helpers:

```ts
function localTodayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatShoppingDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
```

Do not add date-picker state to the parent `ShoppingListPage`. Keep the mutation and modal state in a small child component in the same file:

```tsx
function ScheduledDateAction({ list }: { list: ShoppingList }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const updateList = useUpdateShoppingList(list.id);

  return (
    <>
      <button
        className="btn-outline"
        onClick={() => setShowDatePicker(true)}
        disabled={updateList.isPending}
      >
        {list.scheduledFor ? `Shop ${formatShoppingDate(list.scheduledFor)}` : 'Set shop date'}
      </button>
      {updateList.isError && <span className="page-status error">Could not update the shop date.</span>}
      {showDatePicker && (
        <DatePickerModal
          initialDate={list.scheduledFor ?? localTodayIso()}
          onClose={() => setShowDatePicker(false)}
          onConfirm={(date) => {
            updateList.mutate({ scheduledFor: date });
            setShowDatePicker(false);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Render the chip and modal**

In the `PageTitle` actions fragment, render the chip only when `list` exists:

```tsx
{list && <ScheduledDateAction list={list} />}
```

Do not pass a `title` prop to `DatePickerModal`; the current component already renders `aria-label="Choose a date"`.

The `ScheduledDateAction` component owns the modal, so no extra page-level modal block is needed.

Remove any page-level scheduled-date error block if it was added during red/green; the child component renders:

```tsx
<span className="page-status error">Could not update the shop date.</span>
```

- [ ] **Step 5: Update dev mock API**

In `apps/web/src/dev/mockApi.ts`, add to `shoppingList`:

```ts
scheduledFor: null,
```

- [ ] **Step 6: Run test to verify GREEN**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx -t "scheduled shop chip"
```

Expected: PASS.

- [ ] **Step 7: Add display test for existing date**

Add:

```tsx
it('shows the scheduled shopping date when the list has one', () => {
  hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
  hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
  hooks.useUpdateShoppingList.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
  hooks.useCurrentShoppingList.mockReturnValue({
    data: { ...baseList, scheduledFor: '2026-06-05' },
    isLoading: false,
  });

  renderPage();

  expect(screen.getByRole('button', { name: /shop fri,? 5 jun/i })).toBeInTheDocument();
});
```

Use the exact accessible name produced by the local environment if the comma differs.

- [ ] **Step 8: Run focused web test**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx \
  apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx \
  apps/web/src/dev/mockApi.ts
git commit -m "feat(web): edit shopping list scheduled date"
```

## Task 4: Recipes Quick-Shop Dated Copy

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`

- [ ] **Step 1: Add failing Recipes page tests**

In `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`, mock the data hooks needed by `RecipesPage`. If the file currently only tests subcomponents, add these imports:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecipesPage } from './RecipesPage';
```

Add hoisted mocks:

```ts
const pageHooks = vi.hoisted(() => ({
  useRecipes: vi.fn(),
  useInventory: vi.fn(),
  useCurrentShoppingList: vi.fn(),
  useAddToNextEmptyDays: vi.fn(),
}));

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: pageHooks.useRecipes,
  useCreateRecipe: vi.fn(),
  useUpdateRecipe: vi.fn(),
  useDeleteRecipe: vi.fn(),
}));
vi.mock('../../hooks/useInventory', () => ({
  useInventory: pageHooks.useInventory,
}));
vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: pageHooks.useCurrentShoppingList,
}));
vi.mock('../../hooks/useMealPlan', () => ({
  useAddToNextEmptyDays: pageHooks.useAddToNextEmptyDays,
}));
```

Add helpers:

```tsx
function renderRecipesPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RecipesPage /></QueryClientProvider>);
}

const shoppableRecipe = {
  id: 'r-shop',
  name: 'Fish tacos',
  servings: 4,
  sourceUrl: null,
  sourceImage: null,
  ingredientCount: 2,
  totalTimeMinutes: null,
  tags: [],
  canonicalFoodIds: ['food-fish'],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

function setupRecipesPage(scheduledFor: string | null) {
  pageHooks.useRecipes.mockReturnValue({ data: [shoppableRecipe], isLoading: false, isError: false });
  pageHooks.useInventory.mockReturnValue({ data: [], isLoading: false });
  pageHooks.useCurrentShoppingList.mockReturnValue({
    data: scheduledFor ? {
      id: 'list-1',
      householdId: 'h',
      createdAt: '2026-06-01T00:00:00Z',
      finalizedAt: null,
      scheduledFor,
      items: [],
    } : null,
    isLoading: false,
  });
  pageHooks.useAddToNextEmptyDays.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
}
```

Add tests:

```tsx
it('uses the scheduled shopping date in quick-shop copy', () => {
  setupRecipesPage('2026-06-05');

  renderRecipesPage();

  expect(screen.getByText(/1 quick shop for fri,? 5 jun/i)).toBeInTheDocument();
  expect(screen.getByText(/add to your fri,? 5 jun list/i)).toBeInTheDocument();
});

it('keeps generic quick-shop copy without a scheduled shopping date', () => {
  setupRecipesPage(null);

  renderRecipesPage();

  expect(screen.getByText(/1 a quick shop away/i)).toBeInTheDocument();
  expect(screen.getByText(/auto-added to your next list/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/RecipesPage/RecipesPage.test.tsx -t "quick-shop copy"
```

Expected: FAIL because Recipes does not read the shopping-list date yet.

- [ ] **Step 3: Update Recipes page copy**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, import:

```ts
import { useCurrentShoppingList } from '../../hooks/useShoppingList';
```

Add helper near local helpers:

```ts
function formatShoppingDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
```

Inside `RecipesPage`, add:

```ts
const { data: shoppingList } = useCurrentShoppingList();
const scheduledShopLabel = shoppingList?.scheduledFor ? formatShoppingDate(shoppingList.scheduledFor) : null;
```

Change the PageTitle quick-shop summary span to:

```tsx
<span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>
  {scheduledShopLabel
    ? `${shoppable.length} quick ${shoppable.length === 1 ? 'shop' : 'shops'} for ${scheduledShopLabel}`
    : `${shoppable.length} a quick shop away`}
</span>
```

Change the shoppable section hint to:

```tsx
<span className="rx-section-hint">
  {scheduledShopLabel
    ? `1-3 items away · add to your ${scheduledShopLabel} list`
    : '1-3 items away · auto-added to your next list'}
</span>
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/RecipesPage/RecipesPage.test.tsx -t "quick-shop copy"
```

Expected: PASS.

- [ ] **Step 5: Run focused page tests**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/RecipesPage/RecipesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx \
  apps/web/src/pages/RecipesPage/RecipesPage.test.tsx
git commit -m "feat(web): show shopping date in recipes quick shop copy"
```

## Task 5: Playwright Coverage

**Files:**
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Write failing E2E test**

Add `scheduledFor: null` to `FAKE_SHOPPING_LIST`.

Add this test inside `test.describe('shopping list — find products + manual pick + send to cart', ...)`:

```ts
test('scheduled shopping date updates Recipes quick-shop copy', async ({ page }) => {
  let scheduledFor: string | null = null;
  const listWithDate = () => ({ ...FAKE_SHOPPING_LIST, scheduledFor });

  await page.route(`**/api/shopping-lists/current`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listWithDate()),
    }),
  );
  await page.route(`**/api/shopping-lists/${LIST_ID}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    scheduledFor = route.request().postDataJSON().scheduledFor;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(listWithDate()),
    });
  });
  await page.unroute('**/api/recipes*');
  await page.route('**/api/recipes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'recipe-shop',
        householdId: 'h-1',
        name: 'Fish tacos',
        servings: 4,
        sourceUrl: null,
        sourceImage: null,
        ingredientCount: 1,
        totalTimeMinutes: null,
        tags: [],
        canonicalFoodIds: ['food-extra'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]),
    }),
  );

  await page.goto('/list');
  await page.getByRole('button', { name: /set shop date/i }).click();
  await expect(page.getByRole('dialog', { name: /choose a date/i })).toBeVisible();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: /choose/i }).click();

  await expect.poll(() => scheduledFor).toMatch(/^\d{4}-\d{2}-05$/);
  await expect(page.getByRole('button', { name: /shop .*5/i })).toBeVisible();

  await page.getByRole('link', { name: 'recipes' }).click();
  await expect(page.getByText(/quick shop.*5/i)).toBeVisible();
  await expect(page.getByText(/add to your .*5 .*list/i)).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test to verify RED**

Run:

```bash
pnpm --filter @eat/web exec playwright test tests/app.spec.ts -g "scheduled shopping date updates Recipes quick-shop copy"
```

Expected: FAIL because the date chip and PATCH route are not wired in the app yet if earlier tasks have not been completed; if tasks 1-4 are complete, it should fail only on any missing E2E selector/copy mismatch.

- [ ] **Step 3: Adjust selectors only if needed**

If the date picker confirm button includes the full selected date in its accessible name, keep the broad `/choose/i` selector. Keep the behavior assertions:

```ts
await expect.poll(() => scheduledFor).toMatch(/^\d{4}-\d{2}-05$/);
await expect(page.getByText(/add to your .*5 .*list/i)).toBeVisible();
```

- [ ] **Step 4: Run E2E test to verify GREEN**

Run:

```bash
pnpm --filter @eat/web exec playwright test tests/app.spec.ts -g "scheduled shopping date updates Recipes quick-shop copy"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/app.spec.ts
git commit -m "test(e2e): cover shopping list scheduled date"
```

## Task 6: Architecture Decision

**Files:**
- Modify: `DECISIONS.md`

- [ ] **Step 1: Add decision entry**

Append this new numbered decision to `DECISIONS.md`:

```md
## D29 — Shopping lists schedule by household-local date

**Date:** 2026-06-03

Shopping lists now carry an optional `scheduled_for` date. The field is a household-local
calendar day, serialized as `YYYY-MM-DD`, rather than a timestamp.

This keeps Slice 4 focused on "what day are we shopping?" while avoiding premature
delivery-slot modeling. Later supermarket delivery work can add slot/timestamp tables
without changing the meaning of the active list's shopping day.

The value remains scoped through the owning `shopping_lists.household_id`; update routes
must filter by both list id and household id.
```

- [ ] **Step 2: Commit**

```bash
git add DECISIONS.md
git commit -m "docs: decide shopping list scheduled date model"
```

## Task 7: Migration And Full Verification

**Files:**
- No new files unless verification exposes a defect.

- [ ] **Step 1: Run database migration**

Run:

```bash
pnpm --filter @eat/server db:migrate
```

Expected: migration applies successfully. If local DB credentials are missing, stop and report the exact error; do not mark Slice 4 complete.

- [ ] **Step 2: Run full unit suite without cache**

Run:

```bash
TURBO_FORCE=true pnpm test
```

Expected: all package tests pass.

- [ ] **Step 3: Run full E2E suite without cache**

Run:

```bash
TURBO_FORCE=true pnpm test:e2e
```

Expected: all Playwright tests pass.

- [ ] **Step 4: Check status**

Run:

```bash
git status --short
```

Expected: clean worktree.

- [ ] **Step 5: If verification required fixes, commit them**

Only if files changed during verification fixes, replace the paths below with the actual changed files from `git status --short`:

```bash
git add apps/server/src/routes/shopping-lists.ts apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx
git commit -m "fix: stabilize shopping list scheduled date"
```

## Task 8: PLAN Update After Verification

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Update PLAN after all verification passes**

Only after Task 7 passes, update `PLAN.md`:

```md
**Currently on:** Handoff backlog Slice 4 complete — resume at Slice 5 plan auto-shop preview
```

Move the Slice 4 handoff backlog item to Done with the date:

```md
- [x] Handoff backlog Slice 4: shopping-list scheduled date + dynamic Recipes quick-shop copy — _2026-06-03_
```

If the exact Done section uses a different local format, preserve that format and use the same wording/date.

- [ ] **Step 2: Commit PLAN update**

```bash
git add PLAN.md
git commit -m "docs: mark handoff backlog Slice 4 complete"
```

## Final Verification Commands

Run these after Task 8:

```bash
TURBO_FORCE=true pnpm test
TURBO_FORCE=true pnpm test:e2e
git status --short
```

Expected:

- `pnpm test`: all Turbo tasks successful, no cached tasks.
- `pnpm test:e2e`: all Playwright tests pass, no cached tasks.
- `git status --short`: clean.

## Implementation Notes

- Keep all `household_id` scoping intact. The PATCH route must filter by both `shopping_lists.id` and `shopping_lists.householdId`.
- Do not create a shopping list from Recipes just to read quick-shop copy.
- Do not introduce delivery slots or timestamps in this slice.
- Do not change shopping-list finalization behavior.
- Preserve manual shopping-list items in `POST /api/shopping-lists/from-plan`.
- Use TDD for each behavior change: write the failing test, run it red, implement, run it green.
