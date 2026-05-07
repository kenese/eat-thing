# Starter App — Template

A modern, full-stack monorepo template for building web applications. REST API backend with React frontend—easily extensible for WebSockets if needed later.

## 🚀 Tech Stack

### Core Architecture
- **Monorepo**: Turborepo for workspace management
- **Package Manager**: pnpm

### Frontend (`apps/web`)
- **Framework**: React 19 + Vite
- **Routing**: React Router
- **State Management**: Zustand (local UI state) + TanStack Query (server state)
- **Styling**: CSS Modules / Plain CSS

### Backend (`apps/server`)
- **Server**: Express (REST API setup, easily extensible for WebSockets)

### Shared Types (`packages/shared`)
- **Language**: TypeScript
- **Contents**: Shared types for basic payloads (e.g. `AppState`) in `@starter/shared`

### Testing & Documentation
- **Unit/Component Testing**: Vitest & React Testing Library
- **End-to-End Testing**: Playwright
- **UI Component Explorer**: Storybook

---

## 📂 Project Structure

```
apps/web/src/
  components/    — React components (TopNav, Counter)
  hooks/         — Custom hooks (e.g. useCounter with TanStack Query)
  store/         — Zustand stores (appStore for local UI state)
  App.tsx        — Root layout with routing
  main.tsx       — Entry point with QueryClientProvider

apps/web/tests/  — Playwright E2E tests

apps/server/src/
  index.ts       — Express REST server

packages/shared/src/
  index.ts       — Shared types (e.g., AppState) for frontend and backend
```

---

## 🏎️ Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Environment
Run both the frontend and backend simultaneously:
```bash
pnpm dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### 3. Build for Production
```bash
pnpm build
```

---

## 🛠️ Commands

| Command | Description |
|---|---|
| `pnpm dev` | Starts both frontend (5173) and backend (3001) via Turborepo |
| `pnpm build` | Production build for all packages |
| `pnpm storybook` | Starts Storybook UI at `http://localhost:6006` |
| `pnpm test` | Runs unit & component tests via Vitest |
| `pnpm test:e2e` | Runs Playwright E2E tests |
| `pnpm lint` | Runs the linter across all packages |
| `pnpm clean` | Removes build directories (`dist`, `.turbo`) |

**Workspace-specific:**
- `pnpm --filter @starter/web dev` — frontend only
- `pnpm --filter @starter/server dev` — backend only

---

## 💡 Key Design Patterns

- **TanStack Query**: Data fetching and server state are handled by React Query against the Express backend.
- **REST API**: The server exposes a simple REST API (e.g. `/api/counter`). It is kept deliberately simple and can be upgraded with `socket.io` during an interview if real-time features are required.
- **Zustand**: Used for purely local client state (e.g. UI theme toggles, sidebar state). Server state goes through React Query.
- **Shared types**: Types in `@starter/shared` should map cleanly to API endpoints to avoid duplication and make adding features fast.

---

## 🎨 Conventions

- Use **Zustand** for client state; avoid Redux or Context API unless necessary.
- **Dark Mode Default**: the template ships with a dark theme (Backgrounds: `#0f0f1a` / `#1a1a2e`, Text: `#e2e8f0`, Accent: `#6366f1`).
- Typography uses **Inter** from Google Fonts.
- Use `.stories.tsx` files alongside components for Storybook documentation.
- Use `.test.tsx` for unit/component tests in Vitest.
