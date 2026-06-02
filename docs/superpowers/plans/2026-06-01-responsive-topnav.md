# Responsive Top Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep primary navigation in the header at every viewport width and compact it to icon-only navigation on phones.

**Architecture:** `TopNav` becomes the only navigation component. It renders the existing text labels plus inline SVG icons for each route, then CSS switches visibility at `<=480px`; tablet and desktop keep text navigation. The fixed `BottomTabBar` and its compensating page padding are deleted.

**Tech Stack:** React 19, React Router `NavLink`, CSS media queries, Vitest with React Testing Library, Playwright.

---

## File Structure

- Modify `apps/web/src/components/TopNav.tsx`: add route icons, compact-only wordmark text, accessible labels, and class hooks.
- Modify `apps/web/src/components/TopNav.css`: retain tablet behavior and add the `<=480px` compact header layout.
- Modify `apps/web/src/components/TopNav.test.tsx`: cover text navigation, compact icon markup, accessible names, and phone-only shops omission hook.
- Modify `apps/web/src/App.tsx`: stop rendering `BottomTabBar`.
- Modify `apps/web/src/index.css`: remove footer-nav padding and the rule that hides `TopNav`.
- Delete `apps/web/src/components/BottomTabBar.tsx`: obsolete fixed footer navigation.
- Delete `apps/web/src/components/BottomTabBar.css`: obsolete fixed footer styles.
- Delete `apps/web/src/components/BottomTabBar.test.tsx`: obsolete component tests.
- Modify `apps/web/tests/app.spec.ts`: add phone and tablet responsive header assertions.
- Modify `PLAN.md`: record the completed responsive chrome correction after verification.

### Task 1: Add Regression Coverage For The Responsive Header

**Files:**
- Modify: `apps/web/src/components/TopNav.test.tsx`
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Write failing `TopNav` unit tests**

Add tests that require compact icon hooks and accessible names:

```tsx
it('renders accessible icon hooks for the five available routes', () => {
  renderAt('/');
  const links = screen.getAllByRole('link');
  expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
    'home',
    'inventory',
    'recipes',
    'plan',
    'list',
  ]);
  expect(document.querySelectorAll('.topnav-icon')).toHaveLength(5);
});

it('marks the shops stub as hidden from the compact phone header', () => {
  renderAt('/');
  expect(screen.getByText('shops')).toHaveClass('topnav-phone-hidden');
});

it('renders a phone-only Eat brand alongside the full wordmark', () => {
  renderAt('/');
  expect(screen.getByText('Eat', { selector: '.topnav-phone-brand' })).toBeInTheDocument();
  expect(screen.getByLabelText('Eat thing')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused unit test and verify it fails**

Run:

```bash
pnpm --filter @eat/web test -- src/components/TopNav.test.tsx
```

Expected: FAIL because `.topnav-icon`, `.topnav-phone-hidden`, `.topnav-phone-brand`, and route `aria-label` attributes do not exist.

- [ ] **Step 3: Write failing Playwright viewport tests**

Inside `test.describe('authenticated routes load', ...)`, add:

```ts
test('phone keeps compact navigation in the header without a footer bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.topnav')).toBeVisible();
  await expect(page.locator('.topnav-phone-brand')).toBeVisible();
  await expect(page.getByLabel('Eat thing')).toBeHidden();
  await expect(page.locator('.topnav-icon')).toHaveCount(5);
  await expect(page.getByText('shops', { exact: true })).toBeHidden();
  await expect(page.locator('.bottom-tab-bar')).toHaveCount(0);
});

test('tablet keeps the text header layout', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');

  await expect(page.locator('.topnav')).toBeVisible();
  await expect(page.getByLabel('Eat thing')).toBeVisible();
  await expect(page.locator('.topnav-phone-brand')).toBeHidden();
  await expect(page.getByRole('link', { name: 'inventory' })).toContainText('inventory');
  await expect(page.getByText('shops', { exact: true })).toBeVisible();
  await expect(page.locator('.bottom-tab-bar')).toHaveCount(0);
});
```

- [ ] **Step 4: Run the focused E2E viewport tests and verify they fail**

Run:

```bash
pnpm --filter @eat/web exec playwright test --grep "phone keeps compact navigation|tablet keeps the text header"
```

Expected: FAIL because phone currently hides `.topnav`, renders `.bottom-tab-bar`, and has no compact header hooks.

### Task 2: Make `TopNav` The Only Responsive Navigation

**Files:**
- Modify: `apps/web/src/components/TopNav.tsx`
- Modify: `apps/web/src/components/TopNav.css`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/index.css`
- Delete: `apps/web/src/components/BottomTabBar.tsx`
- Delete: `apps/web/src/components/BottomTabBar.css`
- Delete: `apps/web/src/components/BottomTabBar.test.tsx`

- [ ] **Step 1: Move route icons into `TopNav`**

Extend each `NAV_ITEMS` entry with the corresponding inline SVG currently owned by `BottomTabBar`. Give SVGs `aria-hidden` and render each link with an accessible label:

```tsx
<NavLink
  key={item.path}
  to={item.path}
  end={item.path === '/'}
  aria-label={item.label}
  className={({ isActive }) =>
    `topnav-link${isActive ? ' topnav-link--active' : ''}`
  }
>
  <span className="topnav-link-label">{item.label}</span>
  <span className="topnav-icon">{item.icon}</span>
</NavLink>
```

Render a phone-only brand beside the existing wordmark and tag the stub for phone hiding:

```tsx
<div className="topnav-brand">
  <Wordmark size="md" tone="on-ink" />
  <span className="topnav-phone-brand" aria-hidden>Eat</span>
</div>
...
<span className="topnav-link topnav-link--stub topnav-phone-hidden">shops</span>
```

- [ ] **Step 2: Add compact phone CSS**

Keep the existing `<=768px` tablet rule. Add:

```css
.topnav-phone-brand,
.topnav-icon {
  display: none;
}

@media (max-width: 480px) {
  .topnav {
    padding: 10px 12px;
    gap: 8px;
  }

  .wordmark,
  .topnav-link-label,
  .topnav-phone-hidden {
    display: none;
  }

  .topnav-phone-brand,
  .topnav-icon {
    display: flex;
  }

  .topnav-phone-brand {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 700;
  }

  .topnav-links {
    justify-content: flex-end;
    gap: 4px;
  }

  .topnav-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 27px;
    height: 27px;
    padding: 0;
    border-bottom: 0;
    border-radius: 7px;
  }

  .topnav-link--active {
    background: rgba(243, 245, 242, 0.12);
    box-shadow: inset 0 -2px var(--persimmon);
  }

  .topnav-icon svg {
    width: 18px;
    height: 18px;
  }

  .topnav-avatar {
    width: 27px;
    height: 27px;
  }
}
```

- [ ] **Step 3: Remove footer navigation**

Delete the `BottomTabBar` import and render call from `apps/web/src/App.tsx`. Delete the three obsolete `BottomTabBar` files. In `apps/web/src/index.css`, keep mobile `.page` padding but delete:

```css
.topnav {
  display: none;
}
.app-body {
  padding-bottom: 72px;
}
```

- [ ] **Step 4: Run focused unit tests and verify they pass**

Run:

```bash
pnpm --filter @eat/web test -- src/components/TopNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run focused E2E viewport tests and verify they pass**

Run:

```bash
pnpm --filter @eat/web exec playwright test --grep "phone keeps compact navigation|tablet keeps the text header"
```

Expected: PASS.

### Task 3: Verify And Record The Completed Change

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Run the full required unit suite**

Run:

```bash
pnpm test
```

Expected: PASS across the monorepo.

- [ ] **Step 2: Run the full required Playwright suite**

Run:

```bash
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 3: Record the verified chrome correction**

Add to the top of `PLAN.md` under `## Done`:

```md
- 2026-06-01 — Responsive chrome correction: removed the mobile footer tab bar, kept primary navigation in the header at every width, and added an icon-only compact iPhone header with `Eat` branding while retaining the existing text header on tablet and desktop.
```

- [ ] **Step 4: Run a final diff check**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended responsive-navigation, test, and plan files are modified or deleted, alongside any pre-existing user changes.
