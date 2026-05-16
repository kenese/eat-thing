# Design Handoff Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the live app's visual language to exactly match the refreshed `design_handoff_eat_thing/` package while preserving all existing features not covered by the handoff.

**Architecture:** Layer-by-layer execution — tokens/utilities first, then shared chrome, then desktop screens left-to-right per the handoff spec, then mobile. Each task commits independently. No new routes, no data-model changes; all work is CSS + JSX markup.

**Tech Stack:** React 18 · TypeScript · CSS Modules (co-located plain CSS) · Vitest + React Testing Library · Playwright E2E · Turborepo monorepo

---

## Pre-flight: orientation

Read these before touching any file:

- `design_handoff_eat_thing/README.md` — color tokens, type scale, component vocabulary (source of truth)
- `apps/web/src/styles/tokens.css` — already correct, do NOT change
- `apps/web/src/index.css` — global utilities and `body` baseline
- `apps/web/src/components/PageTitle.css` — already 56px h1, do NOT change

Run the test suite baseline before starting anything:

```bash
cd /path/to/eat-thing
pnpm test
pnpm test:e2e
```

Both must be green before you begin.

---

## File Map

| File | Action | Task |
|---|---|---|
| `apps/web/src/index.css` | Modify — add `.caption-serif`, `.eyebrow`, `.btn-outline--on-dark`, mobile BottomTabBar padding | 1, 7 |
| `apps/web/src/components/TopNav.tsx` | Modify — add `shops` stub span | 2 |
| `apps/web/src/components/TopNav.css` | Modify — style shops stub | 2 |
| `apps/web/src/components/TopNav.test.tsx` | Modify — update nav-item count assertion | 2 |
| `apps/web/src/pages/InventoryPage/InventoryPage.tsx` | Modify — two-pane layout + sidebar card | 3 |
| `apps/web/src/pages/InventoryPage/InventoryPage.css` | Modify — section headers 28px, two-pane grid | 3 |
| `apps/web/src/pages/RecipesPage/RecipesPage.tsx` | Modify — color dot before each section header | 4 |
| `apps/web/src/pages/RecipesPage/RecipesPage.css` | Modify — `.rx-section-dot` styles | 4 |
| `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` | Modify — reason chip below name | 5 |
| `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` | Modify — section headers 28px, checkboxes 22px, fresh-green checked | 5 |
| `apps/web/src/lib/dateUtils.ts` | Modify — add `isPast` to `PlanWindowDay` | 6 |
| `apps/web/src/lib/dateUtils.test.ts` | Modify — assert `isPast` | 6 |
| `apps/web/src/pages/PlanPage/PlanPage.tsx` | Modify — horizon strip, controls, day cards, recipe grid | 6 |
| `apps/web/src/pages/PlanPage/PlanPage.css` | Modify — replace prop-strip with horizon styles, full-width recipe grid | 6 |
| `apps/web/tests/app.spec.ts` | Modify — update "Coming up" → "Plan" assertion | 6 |
| `apps/web/src/components/BottomTabBar.tsx` | Create | 7 |
| `apps/web/src/components/BottomTabBar.css` | Create | 7 |
| `apps/web/src/components/BottomTabBar.test.tsx` | Create | 7 |
| `apps/web/src/App.tsx` | Modify — render BottomTabBar | 7 |
| Per-page CSS files (mobile `@media` blocks) | Modify | 8 |
| `HANDOFF-LANDED.md` | Create | 9 |

---

## Task 1: Global CSS utilities

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1.1: Add utilities to `index.css`**

Append these rules to the end of `apps/web/src/index.css` (after the existing `@media` block):

```css
/* Utility: italic-serif "why" caption — reuse on any explanatory caption */
.caption-serif {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--ink3);
  line-height: 1.35;
}

/* Utility: eyebrow label — reuse above any section or page title */
.eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mute);
}

/* Outline button variant for use on ink-background cards */
.btn-outline--on-dark {
  background: transparent;
  color: var(--paper);
  border: 1.5px solid rgba(243, 245, 242, 0.45);
  border-radius: var(--radius-control);
  padding: 10px 14px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-outline--on-dark:hover { border-color: var(--paper); }
```

- [ ] **Step 1.2: Run unit tests**

```bash
pnpm test
```

Expected: all pass (no unit tests touch `index.css` directly).

- [ ] **Step 1.3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style: add caption-serif, eyebrow, btn-outline--on-dark global utilities"
```

---

## Task 2: TopNav — add `shops` stub

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/components/TopNav.css`
- Modify: `apps/web/src/components/TopNav.test.tsx`

The `shops` tab appears in the handoff nav but has no route yet. It must be a `<span>`, not a `<NavLink>`, so the existing "does not include a shops link" test keeps passing.

- [ ] **Step 2.1: Update test assertion for nav item count**

In `apps/web/src/components/TopNav.test.tsx`, line 50–54:

Old:
```typescript
it('renders the five lowercase nav items in order', () => {
  renderAt('/');
  const labels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
  expect(labels).toEqual(['home', 'inventory', 'recipes', 'plan', 'list']);
});
```

New (change description only — shops is a span, so link count stays 5):
```typescript
it('renders the five lowercase nav links and a shops stub in order', () => {
  renderAt('/');
  const labels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
  expect(labels).toEqual(['home', 'inventory', 'recipes', 'plan', 'list']);
  expect(screen.getByText('shops')).toBeInTheDocument();
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
pnpm test -- --reporter=verbose TopNav
```

Expected: FAIL — `Unable to find an element with the text: shops`

- [ ] **Step 2.3: Add shops span to TopNav**

In `apps/web/src/components/TopNav.tsx`, update the `<nav>` block:

Old:
```tsx
<nav className="topnav-links">
  {NAV_ITEMS.map((item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `topnav-link${isActive ? ' topnav-link--active' : ''}`
      }
    >
      {item.label}
    </NavLink>
  ))}
</nav>
```

New:
```tsx
<nav className="topnav-links">
  {NAV_ITEMS.map((item) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `topnav-link${isActive ? ' topnav-link--active' : ''}`
      }
    >
      {item.label}
    </NavLink>
  ))}
  {/* HANDOFF: shops route — nav tab present but /shops page not yet designed */}
  <span className="topnav-link topnav-link--stub">shops</span>
</nav>
```

- [ ] **Step 2.4: Add stub style to TopNav.css**

Append to `apps/web/src/components/TopNav.css`:

```css
.topnav-link--stub {
  cursor: default;
  opacity: 0.35;
}
```

- [ ] **Step 2.5: Run tests**

```bash
pnpm test -- --reporter=verbose TopNav
```

Expected: all 5 tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/src/components/TopNav.tsx apps/web/src/components/TopNav.css apps/web/src/components/TopNav.test.tsx
git commit -m "feat: add shops nav stub (HANDOFF: no /shops route yet)"
```

---

## Task 3: Inventory — section headers 28px + two-pane sidebar card

**Files:**
- Modify: `apps/web/src/pages/InventoryPage/InventoryPage.tsx`
- Modify: `apps/web/src/pages/InventoryPage/InventoryPage.css`

The handoff shows a two-pane layout: item list (left ~2/3) with sidebar (right ~1/3) containing location counts, expiring-soon, and a staples low-stock section stub.

- [ ] **Step 3.1: Promote section header to 28px in CSS**

In `apps/web/src/pages/InventoryPage/InventoryPage.css`, change `.inv-group-label` font-size from `22px` to `28px`:

```css
.inv-group-label {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 28px;
  line-height: 1;
  color: var(--green);
  text-transform: capitalize;
}
```

- [ ] **Step 3.2: Add two-pane layout CSS**

Append to `apps/web/src/pages/InventoryPage/InventoryPage.css`:

```css
/* Two-pane layout */
.inv-body {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  align-items: start;
}

.inv-main { min-width: 0; }

/* Sidebar */
.inv-sidebar {
  position: sticky;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.inv-sidebar-card {
  background: var(--paper2);
  border-radius: var(--radius-card);
  padding: 16px 18px;
  border: 1px solid var(--rule);
}

.inv-sidebar-card-title {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mute);
  margin-bottom: 12px;
}

.inv-location-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--rule2);
  font-size: 14px;
}
.inv-location-row:last-child { border-bottom: none; }

.inv-location-label {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 16px;
  color: var(--green);
}

.inv-location-count {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--mute);
}

.inv-sidebar-expiring { display: flex; flex-direction: column; gap: 6px; }

.inv-sidebar-exp-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.inv-sidebar-exp-days {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 20px;
  width: 32px;
  font-variant-numeric: tabular-nums;
}

.inv-sidebar-exp-name {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .inv-body { grid-template-columns: 1fr; }
  .inv-sidebar { position: static; }
}
```

- [ ] **Step 3.3: Update InventoryPage.tsx to use two-pane layout**

In `apps/web/src/pages/InventoryPage/InventoryPage.tsx`, update `InventoryPage` to wrap the list and add a sidebar. Replace the entire `return` block of `InventoryPage`:

```tsx
export function InventoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: InventoryRow } | null>(null);

  const deleteMutation = useDeleteInventoryItem();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items = [], isLoading, isError } = useInventory({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    q: debouncedSearch || undefined,
  });

  const sortedByCategory = useMemo(() => {
    const buckets: Record<Category, InventoryRow[]> = {
      produce: [], meat: [], dairy: [], pantry: [], frozen: [], drinks: [], other: [],
    };
    for (const it of items) buckets[it.category].push(it);
    for (const k of CATEGORY_ORDER) {
      buckets[k].sort((a, b) => {
        const da = daysUntil(a.expiresAt);
        const db = daysUntil(b.expiresAt);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
    return buckets;
  }, [items]);

  const expSoon = items.filter((i) => {
    const d = daysUntil(i.expiresAt);
    return d !== null && d <= 7;
  }).length;

  // Derive location counts from categories: produce/meat/dairy → Fridge, pantry/drinks/other → Pantry, frozen → Freezer
  const locationCounts = useMemo(() => ({
    fridge: sortedByCategory.produce.length + sortedByCategory.meat.length + sortedByCategory.dairy.length,
    pantry: sortedByCategory.pantry.length + sortedByCategory.drinks.length + sortedByCategory.other.length,
    freezer: sortedByCategory.frozen.length,
  }), [sortedByCategory]);

  const expiringRows = useMemo(() =>
    items
      .map((i) => ({ ...i, d: daysUntil(i.expiresAt) }))
      .filter((i) => i.d !== null && i.d >= 0 && i.d <= 7)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .slice(0, 6),
    [items],
  );

  const now = new Date();
  const eyebrow = `THE KITCHEN · ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

  const tabs = [
    { key: 'all', label: 'All', count: items.length },
    ...CATEGORY_ORDER.map((cat) => ({
      key: cat,
      label: CATEGORY_LABEL[cat],
      count: sortedByCategory[cat].length,
    })),
  ];

  const categoriesToRender: Category[] =
    categoryFilter === 'all' ? CATEGORY_ORDER : [categoryFilter];

  return (
    <div className="inventory-page">
      <PageTitle
        eyebrow={eyebrow}
        title="Inventory"
        summary={
          <>
            <strong>{items.length} items</strong> on hand
            {expSoon > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>
                  {expSoon} expiring this week
                </span>
              </>
            )}
          </>
        }
        actions={
          <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> add item
          </button>
        }
      />

      <UseThisWeek items={items} />

      <FilterStrip
        tabs={tabs}
        activeTab={categoryFilter}
        onTabChange={(k) => setCategoryFilter(k as CategoryFilter)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search items, brands…"
        trailing={<><span>sort by</span><span style={{ fontWeight: 600 }}>expiry ↑</span></>}
      />

      {isLoading && <p className="inv-status">Loading…</p>}
      {isError && <p className="inv-status error">Failed to load. Check your connection.</p>}

      {!isLoading && !isError && items.length === 0 && (
        <p className="inv-status">
          {search ? 'No items match your search.' : 'No items yet — tap + add item to get started.'}
        </p>
      )}

      {!isLoading && items.length > 0 && (
        <div className="inv-body">
          <div className="inv-main">
            <div className="inv-col-header">
              <div>qty</div>
              <div>item</div>
              <div>added</div>
              <div>expires</div>
              <div></div>
            </div>
            {categoriesToRender.map((cat) => (
              <CategoryGroup
                key={cat}
                label={CATEGORY_LABEL[cat]}
                items={sortedByCategory[cat]}
                onEdit={(item) => setModal({ mode: 'edit', item })}
                onDelete={(item) => deleteMutation.mutate(item.id)}
              />
            ))}
          </div>

          <aside className="inv-sidebar">
            <div className="inv-sidebar-card">
              <div className="inv-sidebar-card-title">By location</div>
              {[
                { label: 'fridge', count: locationCounts.fridge },
                { label: 'pantry', count: locationCounts.pantry },
                { label: 'freezer', count: locationCounts.freezer },
              ].map(({ label, count }) => (
                <div key={label} className="inv-location-row">
                  <span className="inv-location-label">{label}</span>
                  <span className="inv-location-count">{count} items</span>
                </div>
              ))}
            </div>

            {expiringRows.length > 0 && (
              <div className="inv-sidebar-card">
                <div className="inv-sidebar-card-title">Expiring soon</div>
                <div className="inv-sidebar-expiring">
                  {expiringRows.map((it) => (
                    <div key={it.id} className="inv-sidebar-exp-row">
                      <span
                        className="inv-sidebar-exp-days"
                        style={{ color: (it.d ?? 0) <= 1 ? 'var(--persimmon)' : (it.d ?? 0) <= 3 ? 'var(--persim-deep)' : 'var(--ink3)' }}
                      >
                        {it.d}d
                      </span>
                      <span className="inv-sidebar-exp-name">{it.foodName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HANDOFF: low-stock staples — requires useStaples hook integration */}
            <div className="inv-sidebar-card">
              <div className="inv-sidebar-card-title">Low staples</div>
              <p style={{ fontSize: 13, color: 'var(--mute)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                staple tracking coming soon.
              </p>
            </div>
          </aside>
        </div>
      )}

      {modal && (
        <ItemForm
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests**

```bash
pnpm test
```

Expected: all pass. The inventory unit tests don't test DOM structure, only hooks.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/pages/InventoryPage/InventoryPage.tsx apps/web/src/pages/InventoryPage/InventoryPage.css
git commit -m "style: inventory — 28px section headers, two-pane sidebar (location/expiry)"
```

---

## Task 4: Recipes — color-coded section dots

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.css`

The handoff adds a colored circle dot before each section title (fresh-green for "Cook tonight", persimmon for "One quick shop", green for "The library"). `.rx-section-title` is already 28px Lora italic.

- [ ] **Step 4.1: Add dot CSS to RecipesPage.css**

Append after `.rx-section-hint` rule in `apps/web/src/pages/RecipesPage/RecipesPage.css`:

```css
.rx-section-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 10px;
  vertical-align: middle;
  flex-shrink: 0;
}
```

- [ ] **Step 4.2: Add dots to section header JSX**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, find the three section renders and update the header `<span>` in each:

Old (cookable section):
```tsx
<span className="rx-section-title">Cook tonight<span className="dot">.</span></span>
```

New (cookable section):
```tsx
<span className="rx-section-title">
  <span className="rx-section-dot" style={{ background: 'var(--fresh)' }} aria-hidden />
  Cook tonight<span className="dot">.</span>
</span>
```

Old (shoppable section):
```tsx
<span className="rx-section-title">One quick shop<span className="dot">.</span></span>
```

New (shoppable section):
```tsx
<span className="rx-section-title">
  <span className="rx-section-dot" style={{ background: 'var(--persimmon)' }} aria-hidden />
  One quick shop<span className="dot">.</span>
</span>
```

Old (library section):
```tsx
<span className="rx-section-title">The library<span className="dot">.</span></span>
```

New (library section):
```tsx
<span className="rx-section-title">
  <span className="rx-section-dot" style={{ background: 'var(--green)' }} aria-hidden />
  The library<span className="dot">.</span>
</span>
```

Also update `.rx-section-header` to use `align-items: center` (currently `baseline`) so the dot aligns with the title cap-height:

In `RecipesPage.css`, change `.rx-section-header`:
```css
.rx-section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
```

- [ ] **Step 4.3: Run tests**

```bash
pnpm test -- --reporter=verbose RecipesPage
```

Expected: all pass.

- [ ] **Step 4.4: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/RecipesPage/RecipesPage.css
git commit -m "style: recipes — color-coded section dots (fresh/persimmon/green)"
```

---

## Task 5: Shopping list — section headers 28px, checkboxes 22px, line-through fix

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`

Three issues to fix:
1. Section title font-size 22px → 28px
2. Checkbox 18×18px → 22×22px, color `var(--green)` → `var(--fresh)` when checked
3. CSS bug: `.sl-row--checked .sl-row-label` doesn't match class `sl-row--selected` used in the component
4. Reason chip layout: move it below item name (currently a separate grid column)

- [ ] **Step 5.1: Update CSS**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`, make these changes:

Change `.sl-section-title` font-size:
```css
.sl-section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 28px;
  line-height: 1;
}
```

Change `.sl-check` dimensions and `.sl-check--checked` color:
```css
.sl-check {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1.5px solid var(--rule);
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sl-check--checked { background: var(--fresh); border-color: var(--fresh); }
```

Change `.sl-row` grid to accommodate 22px checkbox and new name layout (reason below name, not a separate column):
```css
.sl-row {
  display: grid;
  grid-template-columns: 22px 1fr 80px 24px;
  gap: 14px;
  align-items: start;
  padding: 10px 4px;
  border-bottom: 1px solid var(--rule2);
}
```

Fix the line-through bug — change `.sl-row--checked` to `.sl-row--selected`:
```css
.sl-row--selected .sl-row-label { text-decoration: line-through; color: var(--mute); }
```

Add name column layout for reason below:
```css
.sl-row-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.sl-row-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
```

- [ ] **Step 5.2: Update CategorySection markup in ShoppingListPage.tsx**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`, update the row `<div>` inside `CategorySection` to wrap name + reason in `.sl-row-main`:

Old row contents:
```tsx
<button ... className={`sl-check${selected ? ' sl-check--checked' : ''}`} ...>
  {selected && <svg .../>}
</button>
<div className="sl-row-name">
  <span className="sl-row-label">{it.name}</span>
  <span className="sl-row-qty">{Math.ceil(it.qty * 10) / 10} {it.unit}</span>
</div>
<ReasonChip source={it.source} sourceRecipeNames={it.sourceRecipeNames ?? null} />
<PriceCell price={prices.get(it.id)} refreshing={refreshing} />
<button className="sl-row-menu" onClick={() => onDelete(it.id)} aria-label={`Remove ${it.name}`}>✕</button>
```

New row contents:
```tsx
<button
  type="button"
  role="checkbox"
  aria-checked={selected}
  aria-label={`Select ${it.name}`}
  className={`sl-check${selected ? ' sl-check--checked' : ''}`}
  onClick={() => onToggleSelect(it.id)}
>
  {selected && (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )}
</button>
<div className="sl-row-main">
  <div className="sl-row-name">
    <span className="sl-row-label">{it.name}</span>
    <span className="sl-row-qty">{Math.ceil(it.qty * 10) / 10} {it.unit}</span>
  </div>
  <ReasonChip source={it.source} sourceRecipeNames={it.sourceRecipeNames ?? null} />
</div>
<PriceCell price={prices.get(it.id)} refreshing={refreshing} />
<button className="sl-row-menu" onClick={() => onDelete(it.id)} aria-label={`Remove ${it.name}`}>✕</button>
```

- [ ] **Step 5.3: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5.4: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx apps/web/src/pages/ShoppingListPage/ShoppingListPage.css
git commit -m "style: shopping list — 28px section headers, 22px fresh checkboxes, reason below name"
```

---

## Task 6: Plan page — horizon strip, controls, day cards, recipe grid

**Files:**
- Modify: `apps/web/src/lib/dateUtils.ts`
- Modify: `apps/web/src/lib/dateUtils.test.ts`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`
- Modify: `apps/web/tests/app.spec.ts`

This is the largest task. The plan page gets:
- `PageTitle` title → "Plan", eyebrow → `may 2026`
- Title row actions: ← / today / → scroll controls + load-date stub + "add recipes to list" CTA
- Horizon strip (16 pills) replacing the proportion bar
- Day cards restyled: past = 0.5 opacity + line-through, today = ink card, empty = dashed
- Recipe list moved below day grid as full-width 4-column grid

### 6a: Add `isPast` to dateUtils

- [ ] **Step 6a.1: Update `PlanWindowDay` interface in `dateUtils.ts`**

```typescript
export interface PlanWindowDay {
  date: Date;
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
}
```

In `planWindowDays`, add `isPast` to the returned object:

```typescript
export function planWindowDays(now: Date = new Date()): PlanWindowDay[] {
  const todayIso = toIsoDate(now);
  const start = addDays(now, -TODAY_INDEX);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = addDays(start, i);
    const iso = toIsoDate(d);
    return {
      date: d,
      iso,
      label: `${labels[d.getDay()]} ${d.getDate()}`,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
    };
  });
}
```

- [ ] **Step 6a.2: Write failing test for `isPast`**

In `apps/web/src/lib/dateUtils.test.ts`, add:

```typescript
it('planWindowDays marks days before today as isPast', () => {
  const now = new Date('2026-05-17T12:00:00');
  const days = planWindowDays(now);
  // TODAY_INDEX = 2, so days[0] and days[1] are past, days[2] is today
  expect(days[0].isPast).toBe(true);
  expect(days[1].isPast).toBe(true);
  expect(days[2].isPast).toBe(false); // today
  expect(days[2].isToday).toBe(true);
  expect(days[3].isPast).toBe(false); // future
});
```

- [ ] **Step 6a.3: Run test to verify it fails**

```bash
pnpm test -- --reporter=verbose dateUtils
```

Expected: FAIL — `isPast` property doesn't exist yet.

- [ ] **Step 6a.4: Apply the `dateUtils.ts` change from Step 6a.1**

- [ ] **Step 6a.5: Run test to verify it passes**

```bash
pnpm test -- --reporter=verbose dateUtils
```

Expected: all dateUtils tests pass.

### 6b: Update E2E test

- [ ] **Step 6b.1: Update plan page heading assertion in app.spec.ts**

In `apps/web/tests/app.spec.ts`, line 148:

Old:
```typescript
await expect(page.getByRole('heading', { level: 1, name: 'Coming up' })).toBeVisible();
```

New:
```typescript
await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible();
```

### 6c: Rework PlanPage.tsx

- [ ] **Step 6c.1: Replace `PlanPage` return block**

Replace the entire `export function PlanPage()` in `apps/web/src/pages/PlanPage/PlanPage.tsx` with:

```tsx
export function PlanPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => planWindow(now), [now]);
  const days = useMemo(() => planWindowDays(now), [now]);

  const { data: entriesResp, isLoading: planLoading } = useMealPlanEntries(from, to);
  const { data: recipes = [] } = useRecipes();
  const { data: inventory = [] } = useInventory({});
  void inventory;

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
  const cookingEntry = cookingEntryId
    ? (entriesResp?.entries ?? []).find((e) => e.id === cookingEntryId) ?? null
    : null;

  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      (map[e.date] ??= []).push({
        entry: e,
        recipe: undefined,
        missing: [],
        kind: 'cook',
      });
    }
    return map;
  }, [entriesResp]);

  const shopCount = days.filter((d) =>
    !d.isPast && (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'shop'),
  ).length;

  const pantryCount = days.filter((d) =>
    !d.isPast && (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'cook'),
  ).length;

  const openCount = days.filter((d) => !d.isPast && !(entriesByDay[d.iso]?.length)).length;

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({ date, recipeId, servings: recipe?.servings ?? 1 });
  }

  // Scroll today into position TODAY_INDEX on mount and on "today" button click.
  const weekRef = useRef<HTMLDivElement | null>(null);
  const horizonRef = useRef<HTMLDivElement | null>(null);

  function scrollToToday() {
    if (!weekRef.current) return;
    const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
    const todayCol = cols[TODAY_INDEX];
    if (todayCol) {
      const parentLeft = weekRef.current.getBoundingClientRect().left;
      const todayLeft = todayCol.getBoundingClientRect().left;
      weekRef.current.scrollLeft += todayLeft - parentLeft;
    }
  }

  useEffect(() => {
    if (!planLoading) scrollToToday();
  }, [planLoading]);

  function scrollByColumn(dir: -1 | 1) {
    if (!weekRef.current) return;
    const col = weekRef.current.querySelector<HTMLDivElement>('.day-col');
    if (col) weekRef.current.scrollLeft += dir * (col.offsetWidth + 12);
  }

  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toLowerCase();

  return (
    <div className="plan-page">
      <PageTitle
        eyebrow={monthLabel}
        title="Plan"
        summary={
          <>
            <strong>{pantryCount} from the pantry</strong>
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{shopCount} need a shop</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {openCount} open · next 7 days
            </span>
          </>
        }
        actions={
          <div className="plan-title-controls">
            <div className="plan-scroll-btns">
              <button className="plan-scroll-btn" onClick={() => scrollByColumn(-1)} aria-label="Scroll left">←</button>
              <button className="plan-scroll-btn" onClick={scrollToToday}>today</button>
              <button className="plan-scroll-btn" onClick={() => scrollByColumn(1)} aria-label="Scroll right">→</button>
              {/* HANDOFF: load-date picker — calendar icon button is a stub; no date picker modal yet */}
              <button className="plan-scroll-btn plan-scroll-btn--stub" disabled title="Load a specific date (coming soon)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M1 5.5h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <button
              className="btn-primary plan-add-to-list-btn"
              onClick={() => navigate('/list')}
            >
              add recipes to list
              {shopCount > 0 && (
                <span className="plan-add-to-list-count">{shopCount}</span>
              )}
            </button>
          </div>
        }
      />

      {/* Horizon strip */}
      <div className="plan-horizon" ref={horizonRef}>
        {days.map((d, i) => {
          const dayEntries = entriesByDay[d.iso] ?? [];
          const mealCount = dayEntries.length;
          const [weekday, dayNum] = d.label.split(' ');
          return (
            <button
              key={d.iso}
              className={[
                'horizon-pill',
                d.isToday && 'horizon-pill--today',
                d.isPast && 'horizon-pill--past',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!weekRef.current) return;
                const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
                const target = cols[i];
                if (target) {
                  const parentLeft = weekRef.current.getBoundingClientRect().left;
                  const targetLeft = target.getBoundingClientRect().left;
                  weekRef.current.scrollLeft += targetLeft - parentLeft;
                }
              }}
            >
              <span className="horizon-pill-day">{weekday}</span>
              <span className="horizon-pill-num">{dayNum}</span>
              {mealCount > 1 ? (
                <span className="horizon-pill-multi">{mealCount}×</span>
              ) : mealCount === 1 ? (
                <span className="horizon-pill-dot" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Day grid */}
      {planLoading && <p className="plan-status">Loading…</p>}
      <div className="plan-week-scroll" ref={weekRef}>
        <div className="plan-week-rail">
          {!planLoading && days.map((d) => (
            <DayCard
              key={d.iso}
              iso={d.iso}
              label={d.label}
              isToday={d.isToday}
              isPast={d.isPast}
              entries={entriesByDay[d.iso] ?? []}
              onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
              onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
              onDeleteEntry={(id) => deleteEntry.mutate(id)}
              onMarkCookedEntry={(id) => setCookingEntryId(id)}
            />
          ))}
        </div>
      </div>

      {/* Recipe drag grid — full width below day grid */}
      <section className="plan-recipe-section">
        <div className="plan-recipe-section-header">
          Recipes<span className="dot">.</span>
          <span className="plan-recipe-section-hint">drag onto a day</span>
        </div>
        <div className="plan-recipe-grid">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="plan-recipe-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, r.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="plan-recipe-name">{r.name}</span>
              <span className="plan-recipe-meta">{r.servings} serv</span>
            </div>
          ))}
        </div>
      </section>

      {cookingEntry && (
        <CookModal
          mealPlanEntryId={cookingEntry.id}
          recipeName={cookingEntry.recipeName}
          onClose={() => setCookingEntryId(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6c.2: Update `DayCard` props to accept `isPast`**

In `PlanPage.tsx`, update the `DayCard` function signature and add past-day styling:

```tsx
function DayCard({
  iso,
  label,
  isToday,
  isPast,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  entries: DayEntry[];
  onDropRecipe: (recipeId: string) => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = entries.length >= MAX_ENTRIES_PER_DAY;

  const first = entries[0];
  const followUps = entries.slice(1);
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    e.preventDefault();
    setDragOver(false);
    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) onDropRecipe(recipeId);
  }

  return (
    <div
      className={[
        'day-col',
        dragOver && 'drag-over',
        isToday && 'today',
        isPast && 'past',
      ].filter(Boolean).join(' ')}
      data-iso={iso}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        {isToday && <span className="day-col-context" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>today.</span>}
      </div>

      {first ? (
        <>
          <div className="day-col-image">
            {first.recipe?.sourceImage
              ? <img src={first.recipe.sourceImage} alt="" />
              : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
          </div>
          <div className={`day-col-name${isPast ? ' day-col-name--past' : ''}`}>{first.entry.recipeName}</div>
          <div className="day-col-meta">serves {first.entry.servings}</div>
          <StatusChip kind={kind === 'open' ? 'open' : kind} />
          {followUps.map((fu) => (
            <div key={fu.entry.id} className="day-col-extra">
              <span className={`day-col-extra-name${isPast ? ' day-col-name--past' : ''}`}>{fu.entry.recipeName}</span>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>serves {fu.entry.servings}</span>
              <div className="day-col-extra-actions">
                {!isPast && fu.entry.status === 'planned' && (
                  <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(fu.entry.id)} title="Mark cooked">✓</button>
                )}
                <button className="day-col-extra-btn" onClick={() => onDeleteEntry(fu.entry.id)} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
          {!isPast && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
              {first.entry.status === 'planned' && (
                <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(first.entry.id)} title="Mark cooked">cooked ✓</button>
              )}
              <button className="day-col-extra-btn" onClick={() => onDeleteEntry(first.entry.id)} aria-label="Remove">remove ✕</button>
              <input
                className="day-col-extra-btn"
                type="number"
                min="0"
                step="any"
                defaultValue={first.entry.servings}
                onBlur={(e) => {
                  const n = parseFloat(e.currentTarget.value);
                  if (!isNaN(n) && n > 0 && n !== first.entry.servings) {
                    onUpdateEntry(first.entry.id, { servings: n });
                  }
                }}
                style={{ width: 50, textAlign: 'right' }}
                title="Edit servings"
              />
            </div>
          )}
          {isPast && (
            <div className="day-col-cooked-label">cooked</div>
          )}
          {atCapacity && !isPast && (
            <div className="day-col-cap">max 4 recipes</div>
          )}
        </>
      ) : (
        <div className="day-col-empty">
          <div className="day-col-empty-title">open seat</div>
          {!isPast && <div className="day-col-empty-hint">+ add recipe</div>}
        </div>
      )}
    </div>
  );
}
```

### 6d: Rework PlanPage.css

- [ ] **Step 6d.1: Replace PlanPage.css**

Completely replace `apps/web/src/pages/PlanPage/PlanPage.css` with:

```css
.plan-page { padding: 0 var(--gutter) 36px; max-width: 1440px; margin: 0 auto; }

/* Title controls row */
.plan-title-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plan-scroll-btns {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--paper2);
  border: 1px solid var(--rule);
  border-radius: var(--radius-control);
  padding: 2px;
}

.plan-scroll-btn {
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink2);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.plan-scroll-btn:hover { background: var(--cream); color: var(--ink); }
.plan-scroll-btn--stub { opacity: 0.4; cursor: not-allowed; }
.plan-scroll-btn--stub:hover { background: transparent; color: var(--ink2); }

.plan-add-to-list-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.plan-add-to-list-count {
  background: rgba(255,255,255,0.25);
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  font-variant-numeric: tabular-nums;
}

/* Horizon strip */
.plan-horizon {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 14px 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  scrollbar-width: none;
}
.plan-horizon::-webkit-scrollbar { display: none; }

.horizon-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 48px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}
.horizon-pill:hover { background: var(--cream); }

.horizon-pill--past { opacity: 0.4; }

.horizon-pill--today {
  background: var(--ink);
  color: var(--paper);
  border-color: transparent;
}
.horizon-pill--today:hover { background: var(--ink2); }

.horizon-pill-day {
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mute);
}
.horizon-pill--today .horizon-pill-day { color: rgba(243,245,242,0.6); }

.horizon-pill-num {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.horizon-pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--fresh);
  margin-top: 2px;
}
.horizon-pill--today .horizon-pill-dot { background: var(--persimmon); }

.horizon-pill-multi {
  font-family: var(--font-sans);
  font-size: 9px;
  font-weight: 700;
  color: var(--persimmon);
  margin-top: 2px;
}
.horizon-pill--today .horizon-pill-multi { color: var(--persimmon); }

/* Horizontal scrolling 17-day rail */
.plan-week-scroll {
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 20px 0 8px;
}
.plan-week-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 1fr);
  gap: 12px;
}
.plan-week-rail .day-col { scroll-snap-align: start; }

/* Day cards */
.day-col {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 220px;
}
.day-col.drag-over { border-color: var(--persimmon); background: rgba(217,110,46,0.05); }
.day-col.today { background: var(--ink); color: var(--paper); border-color: transparent; }
.day-col.past { opacity: 0.5; }

.day-col-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.day-col-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mute);
}
.day-col.today .day-col-label { color: var(--persimmon); }
.day-col-context {
  font-size: 12px;
  color: var(--ink3);
}
.day-col.today .day-col-context { color: rgba(243,245,242,0.7); }

.day-col-image {
  width: 100%;
  height: 64px;
  border-radius: 8px;
  background: var(--cream);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.day-col.today .day-col-image { background: #1a2520; }
.day-col-image img { width: 100%; height: 100%; object-fit: cover; }
.day-col-image-fallback {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--ink3);
  padding: 6px;
  text-align: center;
}

.day-col-name {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 17px;
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.day-col-name--past { text-decoration: line-through; }

.day-col-need {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 13px;
  color: var(--ink3);
  line-height: 1.35;
}
.day-col.today .day-col-need { color: rgba(243,245,242,0.7); }

.day-col-meta { font-size: 11px; color: var(--mute); margin-top: auto; }
.day-col.today .day-col-meta { color: rgba(243,245,242,0.7); }

.day-col-cooked-label {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 12px;
  color: var(--mute);
  margin-top: auto;
}

/* Empty (open seat) */
.day-col-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed var(--rule);
  border-radius: 10px;
  background: var(--paper2);
  padding: 16px 8px;
  color: var(--mute);
}
.day-col-empty-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 18px;
  color: var(--ink3);
}
.day-col-empty-hint { font-size: 11px; margin-top: 6px; }

/* Compact follow-up entries within a day */
.day-col-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-top: 1px solid var(--rule2);
  font-size: 13px;
}
.day-col.today .day-col-extra { border-top-color: rgba(243,245,242,0.14); }
.day-col-extra-name { font-weight: 500; }
.day-col-extra-actions { display: flex; gap: 4px; }
.day-col-extra-btn {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.6;
}
.day-col-extra-btn:hover { opacity: 1; }
.day-col-cap { font-size: 11px; color: var(--mute); font-style: italic; margin-top: 6px; }

/* Recipe drag grid — full width below day grid */
.plan-recipe-section { margin-top: 36px; }

.plan-recipe-section-header {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 28px;
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 14px;
}

.plan-recipe-section-hint {
  font-family: var(--font-sans);
  font-size: 12px;
  font-style: normal;
  color: var(--mute);
  letter-spacing: 0;
}

.plan-recipe-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.plan-recipe-item {
  padding: 12px 14px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-control);
  cursor: grab;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.plan-recipe-item:hover { border-color: var(--persim-deep); }
.plan-recipe-name { font-size: 14px; font-weight: 600; }
.plan-recipe-meta { font-size: 11px; color: var(--mute); }

.plan-status { padding: 40px; text-align: center; color: var(--mute); }

@media (max-width: 1024px) {
  .plan-recipe-grid { grid-template-columns: repeat(3, 1fr); }
  .plan-week-rail { grid-auto-columns: minmax(180px, 240px); }
}
@media (max-width: 640px) {
  .plan-week-rail { grid-auto-columns: minmax(160px, 200px); }
  .plan-recipe-grid { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 6e: Run tests**

```bash
pnpm test
pnpm test:e2e
```

Expected: all unit tests pass. E2E: "plan route loads" now passes with "Plan" heading. "plan page shows cook modal" still works (DayCard's "Mark cooked" button preserved for non-past entries).

- [ ] **Step 6f: Commit**

```bash
git add apps/web/src/lib/dateUtils.ts apps/web/src/lib/dateUtils.test.ts \
        apps/web/src/pages/PlanPage/PlanPage.tsx apps/web/src/pages/PlanPage/PlanPage.css \
        apps/web/tests/app.spec.ts
git commit -m "feat: plan page — horizon strip, scroll controls, past-day styling, recipe grid below"
```

---

## Task 7: BottomTabBar + mobile chrome

**Files:**
- Create: `apps/web/src/components/BottomTabBar.tsx`
- Create: `apps/web/src/components/BottomTabBar.css`
- Create: `apps/web/src/components/BottomTabBar.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`

On mobile (≤768px), the TopNav is hidden and a bottom tab bar with 5 tabs appears instead.

- [ ] **Step 7.1: Write the BottomTabBar test**

Create `apps/web/src/components/BottomTabBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

function renderBar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  );
}

describe('BottomTabBar', () => {
  it('renders all five tab labels', () => {
    renderBar();
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.getByText('pantry')).toBeInTheDocument();
    expect(screen.getByText('recipes')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('list')).toBeInTheDocument();
  });

  it('marks the active tab with the active class', () => {
    renderBar('/recipes');
    const recipesLink = screen.getByRole('link', { name: /recipes/i });
    expect(recipesLink.className).toContain('tab--active');
  });

  it('maps /inventory to the pantry tab', () => {
    renderBar('/inventory');
    const pantryLink = screen.getByRole('link', { name: /pantry/i });
    expect(pantryLink.className).toContain('tab--active');
  });
});
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
pnpm test -- --reporter=verbose BottomTabBar
```

Expected: FAIL — `BottomTabBar` not found.

- [ ] **Step 7.3: Create BottomTabBar.tsx**

Create `apps/web/src/components/BottomTabBar.tsx`:

```tsx
import { NavLink } from 'react-router-dom';
import './BottomTabBar.css';

const TABS = [
  {
    label: 'home',
    path: '/',
    end: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M3 10.5L11 3l8 7.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1v-8.5z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'pantry',
    path: '/inventory',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <rect x="3" y="3" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 8h16M8 8v12" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    label: 'recipes',
    path: '/recipes',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M7 3h8a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
          stroke="currentColor" strokeWidth="1.5"/>
        <path d="M9 8h4M9 12h4M9 16h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'plan',
    path: '/plan',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <rect x="3" y="4" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 9h16M7 2v4M15 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="7.5" cy="13.5" r="1" fill="currentColor"/>
        <circle cx="11" cy="13.5" r="1" fill="currentColor"/>
        <circle cx="14.5" cy="13.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    label: 'list',
    path: '/list',
    end: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M8 7h9M8 11h9M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="5" cy="7" r="1.2" fill="currentColor"/>
        <circle cx="5" cy="11" r="1.2" fill="currentColor"/>
        <circle cx="5" cy="15" r="1.2" fill="currentColor"/>
      </svg>
    ),
  },
];

export function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}
          aria-label={tab.label}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7.4: Create BottomTabBar.css**

Create `apps/web/src/components/BottomTabBar.css`:

```css
.bottom-tab-bar {
  display: none; /* shown only on mobile via index.css media query */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(243, 245, 242, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--rule);
  padding: 8px 0 max(12px, env(safe-area-inset-bottom));
  z-index: 100;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  text-decoration: none;
  color: var(--mute);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  padding: 6px 4px;
  border-radius: 10px;
  transition: color 0.12s ease;
}

.tab--active {
  color: var(--ink);
  font-weight: 700;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 28px;
  border-radius: 8px;
}

.tab--active .tab-icon {
  background: rgba(13, 23, 20, 0.10);
}

.tab-label { letter-spacing: 0.01em; }

@media (max-width: 768px) {
  .bottom-tab-bar {
    display: flex;
  }
}
```

- [ ] **Step 7.5: Update App.tsx to render BottomTabBar**

In `apps/web/src/App.tsx`:

Old imports block (top):
```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav';
```

New:
```tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { BottomTabBar } from './components/BottomTabBar';
```

Old return in `AppShell` (just after the `<TopNav />` line):
```tsx
  return (
    <>
      <TopNav />
      <div className="app-body">
```

New:
```tsx
  return (
    <>
      <TopNav />
      <div className="app-body">
```
(No change yet — BottomTabBar added after `</div>` closing `app-body`:)

Old:
```tsx
      </div>
    </>
  );
```

New:
```tsx
      </div>
      <BottomTabBar />
    </>
  );
```

- [ ] **Step 7.6: Hide TopNav and add bottom padding in index.css**

Append to `apps/web/src/index.css` (within or after the existing `@media (max-width: 768px)` block):

```css
@media (max-width: 768px) {
  .topnav {
    display: none;
  }
  .app-body {
    padding-bottom: 72px;
  }
}
```

- [ ] **Step 7.7: Run tests**

```bash
pnpm test -- --reporter=verbose BottomTabBar
pnpm test
```

Expected: all BottomTabBar tests pass; full suite passes.

- [ ] **Step 7.8: Commit**

```bash
git add apps/web/src/components/BottomTabBar.tsx apps/web/src/components/BottomTabBar.css \
        apps/web/src/components/BottomTabBar.test.tsx apps/web/src/App.tsx apps/web/src/index.css
git commit -m "feat: BottomTabBar component + mobile chrome (hide TopNav, add bottom padding)"
```

---

## Task 8: Mobile page layout adjustments

**Files:**
- Modify: `apps/web/src/pages/HomePage/HeroBand.css` (already has mobile block — verify)
- Modify: `apps/web/src/pages/HomePage/MealsStrip.css` (already has mobile scroll — verify)
- Modify: `apps/web/src/pages/InventoryPage/InventoryPage.css` (add mobile title size)
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.css` (mobile grid)
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css` (mobile plan layout)
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` (mobile sidebar stacking)

Mobile page titles should be 40–44px (already handled by `PageTitle.css @media max-width:768px` which sets `40px`). The main work here is ensuring the page grids stack correctly on mobile.

- [ ] **Step 8.1: Verify/update HeroBand mobile**

`HeroBand.css` already has:
```css
@media (max-width: 768px) {
  .hero-band { grid-template-columns: 1fr; gap: 24px; padding: 24px var(--gutter-mobile); }
  .hero-headline { font-size: 48px; }
}
```
This is correct. No change needed.

- [ ] **Step 8.2: Verify/update MealsStrip mobile**

`MealsStrip.css` already has:
```css
@media (max-width: 768px) {
  .meals-strip-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; ... }
  .meals-card { min-width: 200px; scroll-snap-align: start; }
}
```
This is correct. No change needed.

- [ ] **Step 8.3: Add mobile adjustments to RecipesPage.css**

Append to `apps/web/src/pages/RecipesPage/RecipesPage.css`:

```css
@media (max-width: 768px) {
  .rx-hero { grid-template-columns: 1fr; }
  .rx-hero-main { grid-template-columns: 1fr; min-height: auto; }
  .rx-hero-image { display: none; }
  .rx-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .rx-grid--dense { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 8.4: Add mobile adjustments to PlanPage.css**

Append to `apps/web/src/pages/PlanPage/PlanPage.css`:

```css
@media (max-width: 768px) {
  .plan-title-controls { flex-wrap: wrap; gap: 8px; }
  .plan-recipe-grid { grid-template-columns: repeat(2, 1fr); }
  .plan-add-to-list-btn { width: 100%; justify-content: center; }
}
```

- [ ] **Step 8.5: Verify ShoppingListPage mobile**

`ShoppingListPage.css` already has:
```css
@media (max-width: 1024px) {
  .sl-body { grid-template-columns: 1fr; }
  .sl-sidebar { border-left: none; border-top: 1px solid var(--rule); position: static; max-height: none; }
}
```
This stacks sidebar below list on smaller screens. No change needed.

- [ ] **Step 8.6: Run tests**

```bash
pnpm test
pnpm test:e2e
```

Expected: all pass.

- [ ] **Step 8.7: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.css apps/web/src/pages/PlanPage/PlanPage.css
git commit -m "style: mobile layout adjustments (recipes 2-col grid, plan title wrap)"
```

---

## Task 9: HANDOFF-LANDED.md

**Files:**
- Create: `HANDOFF-LANDED.md` at repo root

- [ ] **Step 9.1: Write HANDOFF-LANDED.md**

Create `/path/to/eat-thing/HANDOFF-LANDED.md`. Contents must include:

1. **Files changed** grouped by surface (tokens, nav, inventory, recipes, plan, shopping list, mobile)
2. **Conflicts found** — one line each: where, what handoff doesn't cover, what was done
3. **Stubs / TODOs** — all `// HANDOFF:` tagged locations
4. **Visual diffs to spot-check** — 5–10 screens with localhost URLs
5. **Open questions**

Stub content to paste and expand after completing Tasks 1–8:

```markdown
# HANDOFF-LANDED.md

## Files Changed

### Tokens / Global
- `apps/web/src/index.css` — added `.caption-serif`, `.eyebrow`, `.btn-outline--on-dark`, mobile BottomTabBar padding, TopNav hide on mobile

### Top Nav
- `apps/web/src/components/TopNav.tsx` — added `shops` stub span
- `apps/web/src/components/TopNav.css` — `.topnav-link--stub` style
- `apps/web/src/components/TopNav.test.tsx` — updated assertion to check for shops span text

### Inventory
- `apps/web/src/pages/InventoryPage/InventoryPage.tsx` — two-pane layout, location sidebar card, expiring sidebar card, low-staples stub card
- `apps/web/src/pages/InventoryPage/InventoryPage.css` — section headers 28px, `.inv-body` two-pane grid, sidebar card styles

### Recipes
- `apps/web/src/pages/RecipesPage/RecipesPage.tsx` — color dots before section headers (fresh/persimmon/green)
- `apps/web/src/pages/RecipesPage/RecipesPage.css` — `.rx-section-dot`, `.rx-section-header` align-items center, mobile grid

### Plan
- `apps/web/src/lib/dateUtils.ts` — added `isPast` to `PlanWindowDay`
- `apps/web/src/lib/dateUtils.test.ts` — asserts `isPast` field
- `apps/web/src/pages/PlanPage/PlanPage.tsx` — horizon strip, title controls (←/today/→/load-date stub/add-recipes-to-list), day cards with past/today styling, recipe drag grid below
- `apps/web/src/pages/PlanPage/PlanPage.css` — complete rework: horizon strip, day grid, recipe grid, removed prop-strip

### Shopping List
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` — reason chip moved below name in row markup
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` — section headers 28px, checkboxes 22px + var(--fresh) when checked, line-through bug fixed

### Mobile
- `apps/web/src/components/BottomTabBar.tsx` — new 5-tab bar (home/pantry/recipes/plan/list)
- `apps/web/src/components/BottomTabBar.css` — fixed bottom, blur background, active ink fill
- `apps/web/src/App.tsx` — renders BottomTabBar
- `apps/web/src/pages/RecipesPage/RecipesPage.css` — mobile 2-col grid

### Tests
- `apps/web/src/components/BottomTabBar.test.tsx` — new test (renders tabs, active class, /inventory → pantry tab)
- `apps/web/tests/app.spec.ts` — updated plan heading assertion "Coming up" → "Plan"

---

## Conflicts Found

| Location | Handoff doesn't cover | What was done |
|---|---|---|
| TopNav | No `/shops` route | Added `shops` as a disabled `<span>`; no NavLink |
| PlanPage | `load date` picker UX not designed | Calendar icon button added; action is a stub |
| PlanPage | "Open seats" suggestion list (below day grid) | Replaced with recipe drag-and-drop grid per user decision |
| PlanPage | "Auto-shop preview" panel | Not implemented; would require shopping-list pre-flight query |
| RecipesPage `EditorialHero` | "add to wednesday" button | Stub with `// HANDOFF:` comment |
| InventoryPage sidebar | Location breakdown uses category→location mapping | produce/meat/dairy → Fridge, pantry/drinks/other → Pantry, frozen → Freezer |
| InventoryPage sidebar | Low-stock staples widget | Stub card; requires `useStaples` integration |
| ShoppingListPage | Delivery-window 2×2 grid (selected = persimmon outline) | Not implemented (no delivery-window data model) |
| MealsStrip | "this week" header | Kept; plan-page change removes weekly framing, home still shows upcoming meals |
| Cook flow | Not in handoff | Preserved as-is; CookModal restyled with new button classes |
| Auth / LoginPage | Not in handoff | Unchanged |
| Storybook stories | Not in handoff | CSS-inherits new tokens automatically |

---

## Stubs / TODOs (HANDOFF: prefix)

1. `apps/web/src/components/TopNav.tsx` — `// HANDOFF: shops route — nav tab present but /shops page not yet designed`
2. `apps/web/src/pages/PlanPage/PlanPage.tsx` — `// HANDOFF: load-date picker — calendar icon button is a stub; no date picker modal yet`
3. `apps/web/src/pages/RecipesPage/RecipesPage.tsx` (`EditorialHero`) — `// HANDOFF: add-to-wednesday — wire to AddFromPlanModal when the day-picker design lands`

---

## Visual Diffs to Spot-Check

Start the dev server: `pnpm --filter @eat/web dev`

| Priority | Screen | URL | What to verify |
|---|---|---|---|
| 1 | Plan page | `http://localhost:5173/plan` | Horizon strip, ink today card, recipe grid below, ← today → controls |
| 2 | Inventory | `http://localhost:5173/inventory` | Two-pane with sidebar cards, 28px section headers |
| 3 | Recipes | `http://localhost:5173/recipes` | Color dots before section titles, hero eyebrow |
| 4 | Shopping List | `http://localhost:5173/list` | 28px section titles, 22px fresh-green checkboxes, reason below name |
| 5 | Home | `http://localhost:5173/` | Hero band, meals strip, shop preview unchanged |
| 6 | TopNav | Any page | Shops stub visible and dimmed |
| 7 | Mobile (DevTools 390px) | `/plan` | Horizon strip scrollable, sticky bottom CTA |
| 8 | Mobile (DevTools 390px) | `/inventory` | BottomTabBar visible, TopNav hidden |
| 9 | Mobile (DevTools 390px) | `/recipes` | 2-col recipe grid |
| 10 | Mobile (DevTools 390px) | `/list` | Checkboxes 22px, reason below name |

---

## Open Questions

1. **`load date` UX** — Calendar button is stubbed. When this is designed, the spec should decide: modal mini-calendar vs. inline date-input. The `weekRef` scroll target is already wired — just need the picked date to compute the column index.
2. **Inventory location model** — The sidebar derives "Fridge / Pantry / Freezer" from category. If the data model gains a real `location` field, update `locationCounts` in `InventoryPage.tsx`.
3. **Auto-shop preview on Plan** — Handoff shows a `Wednesday, 4:30 pm` delivery window on the plan page right rail. Not implemented — would need a pre-flight shopping-list API call. Flag for Slice 4.
4. **`add to wednesday` in RecipesPage hero** — Needs a day-picker concept to be meaningful. Currently a `// HANDOFF:` stub.
5. **Tablet breakpoint** — Handoff says desktop should hold to ~960px, below that fall back to mobile. BottomTabBar breakpoint is currently `≤768px`. Adjust to `≤960px` if tablet layout needs the tab bar earlier.
```

- [ ] **Step 9.2: Run full test suite one final time**

```bash
pnpm test
pnpm test:e2e
```

Expected: all pass.

- [ ] **Step 9.3: Final commit**

```bash
git add HANDOFF-LANDED.md
git commit -m "docs: HANDOFF-LANDED.md — design refresh summary, conflicts, stubs, spot-check URLs"
```
