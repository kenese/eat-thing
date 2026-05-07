# Starter App — Template

## Architecture
- **Monorepo**: Turborepo with `apps/web`, `apps/server`, `packages/shared`
- **Frontend**: React 19 + Vite + Zustand + TanStack Query + React Router
- **Backend**: Express (REST API setup, easily extensible for WebSockets)
- **Shared**: TypeScript types for basic payloads (e.g. `AppState`) in `@starter/shared`
- **Testing & UI Tooling**: Vitest (Unit/Component), Playwright (E2E), Storybook (UI Explorer)

## Project Structure
```
apps/web/src/
  components/    — React components (TopNav, Counter)
  hooks/         — Custom hooks (useCounter - TanStack Query)
  store/         — Zustand stores (appStore for local UI state)
  App.tsx        — Root layout with routing
  main.tsx       — Entry point with QueryClientProvider
apps/web/tests/  — Playwright E2E tests

apps/server/src/
  index.ts       — Express REST server

packages/shared/src/
  index.ts       — Shared types (e.g., AppState) for frontend and backend
```

## Key Patterns
- Data fetching is handled by **TanStack Query** (React Query) against the Express backend.
- The `apps/server` exposes a simple REST API (e.g., `/api/counter`). This server is kept deliberately simple and can be quickly upgraded with `socket.io` during an interview if real-time features are required.
- **Zustand** is retained but intended only for purely local client state (e.g., UI theme toggles, sidebar states). Server state should go through React Query.
- Shared types in `@starter/shared` should be mapped cleanly to API endpoints to avoid duplication. Keep it clean to make adding features during interviews fast.

## Commands (Root)
- `pnpm dev` — starts both frontend (5173) and backend (3001) via Turborepo
- `pnpm build` — production build for all packages
- `pnpm test` — runs Vitest unit and component tests
- `pnpm test:e2e` — runs Playwright E2E tests
- `pnpm storybook` — starts Storybook development server (6006)
- `pnpm clean` — removes build directories

## Commands (Workspace Specific)
- `pnpm --filter @starter/web dev` — frontend only
- `pnpm --filter @starter/server dev` — backend only

## Conventions
- Zustand for client state (not Redux/Context)
- CSS Modules or plain CSS for styling (co-located with components)
- Inter font from Google Fonts
- Dark theme: bg `#0f0f1a`/`#1a1a2e`, text `#e2e8f0`, accent `#6366f1`
- Use `.stories.tsx` files alongside components for Storybook documentation
- Use `.test.tsx` for unit/component tests in Vitest
