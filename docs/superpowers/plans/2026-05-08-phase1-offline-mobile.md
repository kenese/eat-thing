# Phase 1: Offline Cache + Mobile Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Persist TanStack Query's cache to IndexedDB so inventory, recipes, shopping list, and meal plan are readable when the device is offline. (2) Fix the three core screens so they're usable on a 375px-wide phone screen.

**Architecture:** Use `@tanstack/react-query-persist-client` + `idb-keyval` to create a sync storage persister wired into the QueryClient. Pages go offline-readable with no code changes — the persisted cache is restored on page load before any network request completes. Mobile layout fixes are CSS-only (no component logic changes): the PlanPage 7-day grid gets horizontal scroll on small screens; InventoryPage and ShoppingListPage already have a single-column layout that only needs minor padding/typography tweaks.

**Tech Stack:** `@tanstack/react-query-persist-client`, `idb-keyval` (IndexedDB wrapper); CSS media queries; existing React Router + Vite setup.

**Decision (D10):** Offline reads only. Writes still require a connection — no queue or conflict resolution.

---

## File Map

**New files:**
- `apps/web/src/lib/queryPersistence.ts` — IDB persister factory

**Modified files:**
- `apps/web/package.json` — add `@tanstack/react-query-persist-client` + `idb-keyval` deps
- `apps/web/src/main.tsx` — wrap QueryClient with PersistQueryClientProvider
- `apps/web/src/pages/PlanPage/PlanPage.css` — horizontal-scroll grid on mobile
- `apps/web/src/index.css` (or a new `apps/web/src/mobile.css`) — global mobile tweaks
- `apps/web/tests/app.spec.ts` — no changes needed (offline test would require service-worker test harness; defer)

---

## Task 1: Install dependencies

- [ ] **Step 1: Add packages**

```bash
pnpm --filter @eat/web add @tanstack/react-query-persist-client idb-keyval
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter @eat/web build
```

Expected: builds without errors (the new packages are tree-shakeable and don't affect the build).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "deps(web): add react-query-persist-client and idb-keyval"
```

---

## Task 2: IDB persister

**Files:**
- Create: `apps/web/src/lib/queryPersistence.ts`

- [ ] **Step 1: Implement IDB persister**

The `@tanstack/react-query-persist-client` package expects a `Persister` with `persistClient`, `restoreClient`, and `removeClient` methods. `idb-keyval` provides a typed `get`/`set`/`del` backed by IndexedDB.

Create `apps/web/src/lib/queryPersistence.ts`:

```typescript
import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'eat-thing-query-cache';

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(IDB_KEY, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(IDB_KEY);
    },
    removeClient: async () => {
      await del(IDB_KEY);
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/queryPersistence.ts
git commit -m "feat(web): add IndexedDB persister for TanStack Query"
```

---

## Task 3: Wire persister into QueryClient

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Read current main.tsx**

```bash
cat apps/web/src/main.tsx
```

(Note the current QueryClient setup and StrictMode/React.createRoot usage — main.tsx will wrap it.)

- [ ] **Step 2: Update main.tsx**

Replace the existing `QueryClientProvider` wrapper with `PersistQueryClientProvider`. The full updated file should look like this (adjust if current main.tsx differs):

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIdbPersister } from './lib/queryPersistence';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — must be ≥ maxAge in persister config
    },
  },
});

const persister = createIdbPersister();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
```

**Important:** `gcTime` (formerly `cacheTime`) must be ≥ `maxAge`. Both are set to 24 hours here so the persisted cache is valid for a full day of offline use.

- [ ] **Step 3: Start dev server and verify**

```bash
pnpm dev
```

Open the app, navigate to /inventory, then open DevTools → Application → IndexedDB. After the first data load, the `eat-thing-query-cache` key should appear. Refresh the page — data loads instantly from the cache before the network request returns.

- [ ] **Step 4: Run test suite**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass. (PersistQueryClientProvider is a drop-in replacement for QueryClientProvider.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/main.tsx
git commit -m "feat(web): persist TanStack Query cache to IndexedDB for offline reads"
```

---

## Task 4: PlanPage mobile layout

The 7-day grid (`plan-week`) currently lays out as a row of 7 `DayColumn` elements. On 375px screens this collapses into unreadable slivers.

**Files:**
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`

- [ ] **Step 1: Read current PlanPage.css**

```bash
cat apps/web/src/pages/PlanPage/PlanPage.css
```

- [ ] **Step 2: Add mobile rules**

At the bottom of `apps/web/src/pages/PlanPage/PlanPage.css`, add:

```css
/* ── Mobile: horizontal-scroll week grid ──────────────────────────────────── */
@media (max-width: 767px) {
  .plan-page {
    padding: 0;
  }

  .plan-header {
    padding: 0.75rem 1rem;
  }

  .plan-body {
    flex-direction: column;
  }

  .plan-sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--color-border, #3f3f5a);
    padding: 0.75rem 1rem;
  }

  .plan-recipe-list {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .plan-recipe-item {
    flex-shrink: 0;
    min-width: 120px;
  }

  .plan-week {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 0;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .day-col {
    flex-shrink: 0;
    width: 72vw;
    max-width: 260px;
    scroll-snap-align: start;
    border-right: 1px solid var(--color-border, #3f3f5a);
    min-height: 200px;
  }

  .day-col:last-child {
    border-right: none;
  }
}
```

- [ ] **Step 3: Verify in browser**

```bash
pnpm dev
```

Open /plan. In DevTools, set viewport to 375px. The week grid should be horizontally scrollable, with each day column about 72vw wide and a snap scroll feel.

- [ ] **Step 4: Run test suite**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass (CSS-only change).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/PlanPage/PlanPage.css
git commit -m "fix(web): horizontal-scroll meal plan week grid on mobile"
```

---

## Task 5: Inventory page mobile polish

The InventoryPage uses a vertical list layout that generally works on mobile, but needs tighter spacing and touch-friendly tap targets.

**Files:**
- Modify: `apps/web/src/pages/InventoryPage/InventoryPage.css` (read the file first to find the right selectors)

- [ ] **Step 1: Read current InventoryPage.css**

```bash
cat apps/web/src/pages/InventoryPage/InventoryPage.css
```

- [ ] **Step 2: Add mobile rules**

Append to `InventoryPage.css`:

```css
@media (max-width: 767px) {
  .inventory-page {
    padding: 0.75rem;
  }

  .inventory-header {
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .inventory-item {
    padding: 0.75rem;
    min-height: 48px; /* touch target */
  }

  .inventory-item-actions button {
    min-width: 44px;
    min-height: 44px;
  }
}
```

If any of the selectors above don't exist in the current CSS, use the actual selectors from the file you read. The goal is: minimum 48px touch targets, comfortable padding on small screens.

- [ ] **Step 3: Verify in browser at 375px viewport**

Tap targets should be comfortably tappable. No horizontal overflow.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/InventoryPage/InventoryPage.css
git commit -m "fix(web): inventory page mobile touch targets and spacing"
```

---

## Task 6: Shopping list page mobile polish

The ShoppingListPage was designed mobile-first from Task 7 of the shopping list plan. Verify it and add any remaining fixes.

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` if needed

- [ ] **Step 1: Verify at 375px viewport**

```bash
pnpm dev
```

Open /list at 375px viewport. Check:
- Header actions row doesn't overflow horizontally
- Checkbox items have ≥ 48px touch height
- Add item form inputs are full-width

- [ ] **Step 2: Fix any overflow**

If the header actions row overflows, update `.page-header` in ShoppingListPage.css:

```css
@media (max-width: 480px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

If the add item form overflows, update `.add-item-form`:

```css
@media (max-width: 480px) {
  .add-item-form {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-rows: auto auto;
  }

  .add-item-form .form-input:first-child {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 3: Run final suite**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/ShoppingListPage.css
git commit -m "fix(web): shopping list page mobile layout adjustments"
```
