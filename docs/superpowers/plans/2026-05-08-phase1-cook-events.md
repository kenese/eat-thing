# Phase 1: Cook Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark a planned meal as cooked, which creates an audit-trail cook event and deducts the recipe's ingredients from inventory. Ambiguous unit cases (e.g. recipe wants `count` garlic but inventory tracks `g`) are surfaced as prompts for the user to resolve.

**Architecture:** The server exposes two endpoints: a `GET /preview` that computes proposed deductions without writing anything, and a `POST /` that finalises the event. The frontend adds a "Mark cooked" button to each `EntryCard` in `PlanPage`. A `CookModal` shows the proposed deductions (and any prompts), lets the user confirm or answer prompts, then calls POST. On success, the entry card status updates to `cooked` and inventory is refreshed via TanStack Query invalidation.

**Open question resolved:** 1 cook event = 1 cook of the recipe at the recorded serving count. Deductions scale by `(entry.servings / recipe.servings)`. Cooking a 4-serving recipe at 4 servings deducts 100%; at 2 servings deducts 50%. This is already the correct model — no special handling needed for leftovers.

**Tech Stack:** Express + Drizzle ORM + Zod (server); `@taxonomy` unit conversion helpers; TanStack Query (client); React + CSS Modules (UI).

---

## File Map

**New files:**
- `apps/server/src/routes/cook-events.ts` — preview + create endpoints
- `apps/server/src/routes/cook-events.test.ts` — validation + auth unit tests
- `apps/web/src/hooks/useCookEvents.ts` — TanStack Query mutations
- `apps/web/src/pages/PlanPage/CookModal.tsx` — confirm + prompt UI
- `apps/web/src/pages/PlanPage/CookModal.css` — styles

**Modified files:**
- `packages/shared/src/index.ts` — add CookEvent, CookDeduction, CookPrompt types
- `apps/server/src/app.ts` — wire cookEventsRouter
- `apps/web/src/pages/PlanPage/PlanPage.tsx` — add "Mark cooked" to EntryCard, wire CookModal
- `apps/server/src/routes/meal-plans.ts` — no change needed (status update happens via cook-events route)

---

## Task 1: Shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Append CookEvent types**

```typescript
// ─── Cook events ──────────────────────────────────────────────────────────────

export interface CookDeduction {
  inventoryItemId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: CanonicalUnit;
}

export interface CookPrompt {
  question: string;
  canonicalFoodId: string;
  foodName: string;
  inventoryItemId?: string;
  inventoryQty?: number;
  inventoryUnit?: CanonicalUnit;
}

export interface CookEventPreview {
  mealPlanEntryId: string | null;
  recipeId: string;
  servings: number;
  deductions: CookDeduction[];
  prompts: CookPrompt[];
}

export interface CookPromptResponse {
  question: string;
  answer: string;
  inventoryItemId?: string;
}

export interface CreateCookEventInput {
  mealPlanEntryId?: string;
  recipeId: string;
  servings: number;
  deductions: CookDeduction[];
  promptResponses: CookPromptResponse[];
}

export interface CookEvent {
  id: string;
  householdId: string;
  mealPlanEntryId: string | null;
  cookedAt: string;
  deductions: CookDeduction[];
  promptsResolved: CookPromptResponse[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @eat/shared build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add CookEvent types"
```

---

## Task 2: Cook events server routes

**Files:**
- Create: `apps/server/src/routes/cook-events.ts`
- Create: `apps/server/src/routes/cook-events.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/routes/cook-events.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const chain = { from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }) };
  return { db: { select: () => chain } };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {},
  cookEvents: {}, mealPlans: {},
}));

const { default: cookEventsRouter } = await import('./cook-events');

describe('cook-events router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/cook-events', cookEventsRouter);
  });

  it('GET /preview returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/cook-events/preview?mealPlanEntryId=some-id');
    expect(res.status).toBe(401);
  });

  it('GET /preview returns 400 when no mealPlanEntryId or recipeId provided', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).get('/api/cook-events/preview');
    expect(res.status).toBe(400);
  });

  it('POST returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/cook-events').send({});
    expect(res.status).toBe(401);
  });

  it('POST rejects missing recipeId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/cook-events')
      .send({ servings: 2, deductions: [], promptResponses: [] });
    expect(res.status).toBe(400);
  });

  it('POST rejects non-positive servings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/cook-events')
      .send({
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 0,
        deductions: [],
        promptResponses: [],
      });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @eat/server test -- --reporter=verbose cook-events.test.ts
```

Expected: `Cannot find module './cook-events'`

- [ ] **Step 3: Implement cook-events routes**

Create `apps/server/src/routes/cook-events.ts`:

```typescript
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import {
  mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods, cookEvents,
} from '../db/schema/index.js';
import type { CookDeduction, CookPrompt, CookEventPreview } from '@eat/shared';

const router: ExpressRouter = Router();

const deductionSchema = z.object({
  inventoryItemId: z.string().uuid(),
  canonicalFoodId: z.string().uuid(),
  foodName: z.string(),
  qty: z.number().positive(),
  unit: z.enum(['g', 'ml', 'count']),
});

const promptResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  inventoryItemId: z.string().uuid().optional(),
});

const createSchema = z.object({
  mealPlanEntryId: z.string().uuid().optional(),
  recipeId: z.string().uuid(),
  servings: z.number().positive(),
  deductions: z.array(deductionSchema),
  promptResponses: z.array(promptResponseSchema),
});

// GET /api/cook-events/preview?mealPlanEntryId=X  or  ?recipeId=X&servings=Y
// Returns proposed deductions + prompts for ambiguous units. No writes.
router.get('/preview', withHousehold, async (req, res) => {
  const { mealPlanEntryId, recipeId: qRecipeId, servings: qServings } = req.query as Record<string, string>;

  if (!mealPlanEntryId && !qRecipeId) {
    res.status(400).json({ error: 'Provide mealPlanEntryId or recipeId + servings' });
    return;
  }

  try {
    let recipeId: string;
    let servings: number;
    let entryId: string | null = null;

    if (mealPlanEntryId) {
      const [entry] = await db
        .select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings, householdId: mealPlanEntries.householdId })
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, mealPlanEntryId))
        .limit(1);
      if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
      if (entry.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }
      recipeId = entry.recipeId;
      servings = entry.servings;
      entryId = mealPlanEntryId;
    } else {
      const parsedServings = parseFloat(qServings);
      if (!qRecipeId || isNaN(parsedServings) || parsedServings <= 0) {
        res.status(400).json({ error: 'recipeId and positive servings required' });
        return;
      }
      recipeId = qRecipeId;
      servings = parsedServings;
    }

    // Get recipe to compute scaling ratio
    const [recipe] = await db
      .select({ id: recipes.id, servings: recipes.servings, householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (!recipe || recipe.householdId !== req.householdId) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    const scalingRatio = recipe.servings > 0 ? servings / recipe.servings : 1;

    // Get recipe ingredients (non-optional) with food info
    const ingredients = await db
      .select({
        canonicalFoodId: recipeIngredients.canonicalFoodId,
        foodName: canonicalFoods.name,
        qty: recipeIngredients.qty,
        unit: recipeIngredients.unit,
        densityGPerMl: canonicalFoods.densityGPerMl,
      })
      .from(recipeIngredients)
      .innerJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
      .where(and(eq(recipeIngredients.recipeId, recipeId), eq(recipeIngredients.optional, false)));

    // Get household inventory
    const inventory = await db
      .select({
        id: inventoryItems.id,
        canonicalFoodId: inventoryItems.canonicalFoodId,
        qty: inventoryItems.qty,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, req.householdId));

    // Index inventory by canonicalFoodId for quick lookup
    const invByFood = new Map<string, typeof inventory>();
    for (const item of inventory) {
      const list = invByFood.get(item.canonicalFoodId) ?? [];
      list.push(item);
      invByFood.set(item.canonicalFoodId, list);
    }

    const deductions: CookDeduction[] = [];
    const prompts: CookPrompt[] = [];

    for (const ing of ingredients) {
      const needed = ing.qty * scalingRatio;
      const invItems = invByFood.get(ing.canonicalFoodId) ?? [];

      if (invItems.length === 0) {
        // Nothing in inventory — skip silently (can't deduct what we don't have)
        continue;
      }

      // Try to find inventory items in the same canonical unit
      const sameUnit = invItems.filter(i => i.unit === ing.unit);
      if (sameUnit.length > 0) {
        // Deduct from same-unit items (first one found; in practice household will have one entry per food)
        const item = sameUnit[0];
        const actualDeduction = Math.min(needed, item.qty);
        if (actualDeduction > 0.001) {
          deductions.push({ inventoryItemId: item.id, canonicalFoodId: ing.canonicalFoodId, foodName: ing.foodName, qty: actualDeduction, unit: ing.unit });
        }
        continue;
      }

      // Try cross-unit (g↔ml) using density
      if (ing.densityGPerMl != null) {
        const altUnit = ing.unit === 'g' ? 'ml' : ing.unit === 'ml' ? 'g' : null;
        if (altUnit) {
          const altItems = invItems.filter(i => i.unit === altUnit);
          if (altItems.length > 0) {
            const item = altItems[0];
            const neededInAltUnit = ing.unit === 'g'
              ? needed / ing.densityGPerMl  // g needed → ml to deduct
              : needed * ing.densityGPerMl;  // ml needed → g to deduct
            const actualDeduction = Math.min(neededInAltUnit, item.qty);
            if (actualDeduction > 0.001) {
              deductions.push({ inventoryItemId: item.id, canonicalFoodId: ing.canonicalFoodId, foodName: ing.foodName, qty: actualDeduction, unit: altUnit as 'g' | 'ml' | 'count' });
            }
            continue;
          }
        }
      }

      // Unit mismatch we can't resolve — prompt the user
      const item = invItems[0];
      prompts.push({
        question: `How much ${ing.foodName} will this recipe use? (your inventory has ${item.qty} ${item.unit})`,
        canonicalFoodId: ing.canonicalFoodId,
        foodName: ing.foodName,
        inventoryItemId: item.id,
        inventoryQty: item.qty,
        inventoryUnit: item.unit,
      });
    }

    const preview: CookEventPreview = {
      mealPlanEntryId: entryId,
      recipeId,
      servings,
      deductions,
      prompts,
    };
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cook-events
// Creates the cook event, applies deductions to inventory, updates entry status.
router.post('/', withHousehold, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { mealPlanEntryId, recipeId, servings, deductions, promptResponses } = parse.data;

  try {
    // Verify recipe belongs to this household
    const [recipe] = await db
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (!recipe || recipe.householdId !== req.householdId) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    // Verify meal plan entry if provided
    if (mealPlanEntryId) {
      const [entry] = await db
        .select({ householdId: mealPlanEntries.householdId })
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, mealPlanEntryId))
        .limit(1);
      if (!entry || entry.householdId !== req.householdId) {
        res.status(404).json({ error: 'Meal plan entry not found' });
        return;
      }
    }

    const eventId = uuidv4();

    await db.transaction(async tx => {
      // Apply deductions to inventory
      for (const d of deductions) {
        const [item] = await tx
          .select({ qty: inventoryItems.qty, householdId: inventoryItems.householdId })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, d.inventoryItemId))
          .limit(1);

        if (!item || item.householdId !== req.householdId) continue;

        const newQty = Math.max(0, item.qty - d.qty);
        if (newQty <= 0.001) {
          await tx.delete(inventoryItems).where(eq(inventoryItems.id, d.inventoryItemId));
        } else {
          await tx
            .update(inventoryItems)
            .set({ qty: newQty, updatedAt: new Date() })
            .where(eq(inventoryItems.id, d.inventoryItemId));
        }
      }

      // Create the cook event
      await tx.insert(cookEvents).values({
        id: eventId,
        householdId: req.householdId,
        mealPlanEntryId: mealPlanEntryId ?? null,
        cookedAt: new Date(),
        deductions: deductions,
        promptsResolved: promptResponses,
      });

      // Update meal plan entry status to 'cooked'
      if (mealPlanEntryId) {
        await tx
          .update(mealPlanEntries)
          .set({ status: 'cooked' })
          .where(eq(mealPlanEntries.id, mealPlanEntryId));
      }

      // Mark inventory as dirty for OpenBrain sync debounce
      // (insert or update sync_dirty row — upsert via conflict on unique constraint)
      await tx.execute(
        sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
            VALUES (${uuidv4()}, ${req.householdId}, 'inventory', ${req.householdId}, now())
            ON CONFLICT (household_id, resource_type, resource_id)
            DO UPDATE SET dirty_since = now(), claimed_at = null`,
      );
    });

    const [event] = await db
      .select({ id: cookEvents.id, householdId: cookEvents.householdId, mealPlanEntryId: cookEvents.mealPlanEntryId, cookedAt: cookEvents.cookedAt, deductions: cookEvents.deductions, promptsResolved: cookEvents.promptsResolved })
      .from(cookEvents)
      .where(eq(cookEvents.id, eventId));

    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @eat/server test -- --reporter=verbose cook-events.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/cook-events.ts apps/server/src/routes/cook-events.test.ts
git commit -m "feat(server): add cook events preview + create routes"
```

---

## Task 3: Wire route in app.ts

**Files:**
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add import and mount**

In `apps/server/src/app.ts`, add after the existing imports:

```typescript
import cookEventsRouter from './routes/cook-events.js';
```

After existing route mounts:

```typescript
app.use('/api/cook-events', cookEventsRouter);
```

- [ ] **Step 2: Run full server test suite**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/app.ts
git commit -m "feat(server): wire cook-events route"
```

---

## Task 4: Client hook

**Files:**
- Create: `apps/web/src/hooks/useCookEvents.ts`

- [ ] **Step 1: Implement useCookEvents**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CookEventPreview, CreateCookEventInput, CookEvent } from '@eat/shared';

export function useCookPreview(mealPlanEntryId: string | null) {
  return useQuery<CookEventPreview>({
    queryKey: ['cook-preview', mealPlanEntryId],
    queryFn: () => api.get<CookEventPreview>(`/api/cook-events/preview?mealPlanEntryId=${mealPlanEntryId}`),
    enabled: !!mealPlanEntryId,
    staleTime: 0,
  });
}

export function useCreateCookEvent(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCookEventInput) => api.post<CookEvent>('/api/cook-events', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan', weekStart] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useCookEvents.ts
git commit -m "feat(web): add useCookEvents hooks"
```

---

## Task 5: CookModal component

**Files:**
- Create: `apps/web/src/pages/PlanPage/CookModal.tsx`
- Create: `apps/web/src/pages/PlanPage/CookModal.css`

The modal has two phases:
1. **Loading:** fetch preview via `useCookPreview`
2. **Prompts:** if `preview.prompts.length > 0`, show each prompt as a text input
3. **Confirm:** show the list of deductions, "Mark cooked" button

- [ ] **Step 1: Implement CookModal**

Create `apps/web/src/pages/PlanPage/CookModal.tsx`:

```tsx
import React, { useState } from 'react';
import { useCookPreview, useCreateCookEvent } from '../../hooks/useCookEvents';
import type { CookDeduction, CookPromptResponse } from '@eat/shared';
import './CookModal.css';

interface Props {
  mealPlanEntryId: string;
  recipeName: string;
  weekStart: string;
  onClose: () => void;
}

export function CookModal({ mealPlanEntryId, recipeName, weekStart, onClose }: Props) {
  const { data: preview, isLoading, error } = useCookPreview(mealPlanEntryId);
  const createCookEvent = useCreateCookEvent(weekStart);

  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="cook-modal" onClick={e => e.stopPropagation()}>
          <p className="cook-modal-loading">Calculating deductions…</p>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="cook-modal" onClick={e => e.stopPropagation()}>
          <p className="cook-modal-error">Could not load cook preview. Try again.</p>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const allPromptsAnswered = preview.prompts.every(p => (promptAnswers[p.canonicalFoodId] ?? '').trim().length > 0);

  async function handleConfirm() {
    if (!preview) return;

    const promptResponses: CookPromptResponse[] = preview.prompts.map(p => ({
      question: p.question,
      answer: promptAnswers[p.canonicalFoodId] ?? '',
      inventoryItemId: p.inventoryItemId,
    }));

    await createCookEvent.mutateAsync({
      mealPlanEntryId,
      recipeId: preview.recipeId,
      servings: preview.servings,
      deductions: preview.deductions,
      promptResponses,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cook-modal" onClick={e => e.stopPropagation()}>
        <div className="cook-modal-header">
          <h2>Mark "{recipeName}" cooked</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {preview.prompts.length > 0 && (
          <div className="cook-modal-prompts">
            <p className="cook-modal-section-label">A few quick questions</p>
            {preview.prompts.map(p => (
              <div key={p.canonicalFoodId} className="cook-prompt">
                <label className="cook-prompt-question">{p.question}</label>
                <input
                  className="form-input"
                  placeholder={`e.g. 3 cloves, 50g, half a bulb…`}
                  value={promptAnswers[p.canonicalFoodId] ?? ''}
                  onChange={e => setPromptAnswers(prev => ({ ...prev, [p.canonicalFoodId]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="cook-modal-deductions">
          <p className="cook-modal-section-label">
            {preview.deductions.length > 0
              ? 'Will deduct from inventory'
              : 'Nothing to deduct from inventory'}
          </p>
          {preview.deductions.length > 0 && (
            <ul className="cook-deduction-list">
              {preview.deductions.map((d: CookDeduction) => (
                <li key={d.inventoryItemId} className="cook-deduction-item">
                  <span className="cook-deduction-name">{d.foodName}</span>
                  <span className="cook-deduction-qty">−{Math.round(d.qty * 10) / 10} {d.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cook-modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!allPromptsAnswered || createCookEvent.isPending}
          >
            {createCookEvent.isPending ? 'Saving…' : 'Mark cooked'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CookModal.css**

Create `apps/web/src/pages/PlanPage/CookModal.css`:

```css
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: flex-end; justify-content: center; z-index: 50;
}
@media (min-width: 480px) { .modal-overlay { align-items: center; padding: 1rem; } }

.cook-modal {
  background: var(--color-bg, #0f0f1a);
  border-radius: 0.75rem 0.75rem 0 0;
  width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}
@media (min-width: 480px) { .cook-modal { border-radius: 0.75rem; } }

.cook-modal-header { display: flex; align-items: center; justify-content: space-between; }
.cook-modal-header h2 { margin: 0; font-size: 1.0625rem; }
.modal-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--color-muted, #94a3b8); }

.cook-modal-section-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted, #94a3b8); margin: 0 0 0.5rem; }

.cook-modal-prompts { display: flex; flex-direction: column; gap: 0.75rem; }
.cook-prompt { display: flex; flex-direction: column; gap: 0.25rem; }
.cook-prompt-question { font-size: 0.9375rem; }
.form-input { background: var(--color-surface, #1e1e2e); border: 1px solid var(--color-border, #3f3f5a); border-radius: 0.375rem; color: inherit; padding: 0.5rem 0.75rem; font-size: 0.9375rem; width: 100%; box-sizing: border-box; }

.cook-deduction-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.cook-deduction-item { display: flex; justify-content: space-between; align-items: center; padding: 0.375rem 0.625rem; background: var(--color-surface, #1e1e2e); border-radius: 0.375rem; }
.cook-deduction-name { font-size: 0.9375rem; }
.cook-deduction-qty { font-size: 0.875rem; color: #f87171; }

.cook-modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.cook-modal-loading { color: var(--color-muted, #94a3b8); text-align: center; padding: 1.5rem 0; }
.cook-modal-error { color: #f87171; }

.btn { padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.9375rem; border: none; cursor: pointer; font-weight: 500; }
.btn-primary { background: var(--color-primary, #6366f1); color: #fff; }
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-ghost { background: transparent; color: var(--color-muted, #94a3b8); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/PlanPage/CookModal.tsx apps/web/src/pages/PlanPage/CookModal.css
git commit -m "feat(web): add CookModal component"
```

---

## Task 6: Wire CookModal into PlanPage

**Files:**
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `apps/web/src/pages/PlanPage/PlanPage.tsx`, add import:

```typescript
import { CookModal } from './CookModal';
```

Inside the `EntryCard` component, after the existing `editing` state declaration (line 79), add:

No state changes needed in `EntryCard` — the "Mark cooked" button will call a prop from the parent.

Update `EntryCardProps` (around line 71) to add:

```typescript
interface EntryCardProps {
  entry: MealPlanEntry;
  onChange: (patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDelete: () => void;
  onMarkCooked: () => void;  // ← new
}
```

In the `EntryCard` function signature, destructure `onMarkCooked`:

```typescript
function EntryCard({ entry, onChange, onDelete, onMarkCooked }: EntryCardProps) {
```

In the `EntryCard` JSX, add a cook button after the delete button, visible only when status is 'planned':

```tsx
{entry.status === 'planned' && (
  <button className="entry-cook" onClick={onMarkCooked} title="Mark cooked">
    ✓
  </button>
)}
```

- [ ] **Step 2: Add cook state to PlanPage**

In the `PlanPage` function (around line 152), add state for the entry being cooked:

```typescript
const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
```

And derive the entry being cooked:

```typescript
const cookingEntry = cookingEntryId
  ? (week?.entries ?? []).find(e => e.id === cookingEntryId) ?? null
  : null;
```

- [ ] **Step 3: Pass onMarkCooked to DayColumn and down to EntryCard**

In `DayColumnProps`, add:

```typescript
onMarkCookedEntry: (id: string) => void;
```

In `DayColumn` destructuring and JSX, thread `onMarkCookedEntry` through to `EntryCard`:

```tsx
// In DayColumn props:
onMarkCookedEntry: (id: string) => void;

// In DayColumn body, pass to EntryCard:
<EntryCard
  key={entry.id}
  entry={entry}
  onChange={patch => onUpdateEntry(entry.id, patch)}
  onDelete={() => onDeleteEntry(entry.id)}
  onMarkCooked={() => onMarkCookedEntry(entry.id)}
/>
```

In the `PlanPage` JSX, on each `DayColumn`:

```tsx
onMarkCookedEntry={id => setCookingEntryId(id)}
```

- [ ] **Step 4: Render CookModal in PlanPage**

After the `</div>` closing `plan-body`, add:

```tsx
{cookingEntry && (
  <CookModal
    mealPlanEntryId={cookingEntry.id}
    recipeName={cookingEntry.recipeName}
    weekStart={weekStart}
    onClose={() => setCookingEntryId(null)}
  />
)}
```

- [ ] **Step 5: Run full test suite**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass. The meal-plans E2E test still works because no plan-page E2E tests assert the cook button.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/PlanPage/PlanPage.tsx
git commit -m "feat(web): add Mark cooked button and CookModal to PlanPage"
```

---

## Task 7: Update E2E tests for cook flow

The cook flow requires a running server with real DB — cover it with a route-stub E2E test to verify the modal renders, not the full cook transaction.

**Files:**
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Add cook event stub and test**

In `stubAuthedShell`, add:

```typescript
await page.route('**/api/cook-events/preview*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mealPlanEntryId: 'entry-1',
      recipeId: 'recipe-1',
      servings: 4,
      deductions: [
        { inventoryItemId: 'inv-1', canonicalFoodId: 'food-1', foodName: 'Pasta', qty: 400, unit: 'g' },
      ],
      prompts: [],
    }),
  }),
);
```

Update the meal plan stub in `stubAuthedShell` to return an entry so the cook button exists:

```typescript
await page.route('**/api/meal-plans*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      weekStart: '2026-01-05',
      mealPlanId: 'plan-1',
      entries: [
        { id: 'entry-1', mealPlanId: 'plan-1', date: '2026-01-06', recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
      ],
    }),
  }),
);
```

Add a new test:

```typescript
test('plan page shows cook modal when mark cooked is clicked', async ({ page }) => {
  await page.goto('/plan');
  // The entry card's cook button (✓)
  await page.getByTitle('Mark cooked').first().click();
  await expect(page.getByRole('heading', { name: /mark.*cooked/i })).toBeVisible();
  await expect(page.getByText('Pasta')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E**

```bash
pnpm test:e2e -- --grep "cook modal"
```

Expected: passes.

- [ ] **Step 3: Run full suites**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/app.spec.ts
git commit -m "test(e2e): add cook modal visibility test"
```
