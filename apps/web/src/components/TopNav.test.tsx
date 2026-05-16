import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopNav } from './TopNav';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('../lib/auth-client', () => ({
  authClient: { signOut: mocks.signOut },
}));

const storage = new Map<string, string>();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <TopNav />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TopNav', () => {
  beforeEach(() => {
    storage.clear();
    window.localStorage.removeItem('eat-thing:dev-session');
    vi.clearAllMocks();
  });

  it('renders the wordmark', () => {
    renderAt('/');
    expect(screen.getByLabelText('Eat thing')).toBeInTheDocument();
  });

  it('renders the five lowercase nav links and a shops stub in order', () => {
    renderAt('/');
    const labels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
    expect(labels).toEqual(['home', 'inventory', 'recipes', 'plan', 'list']);
    expect(screen.getByText('shops')).toBeInTheDocument();
  });

  it('does not include a shops link', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'shops' })).not.toBeInTheDocument();
  });

  it('marks the active route', () => {
    renderAt('/recipes');
    const active = screen.getByRole('link', { name: 'recipes' });
    expect(active.className).toContain('topnav-link--active');
  });

  it('signs out and clears the local dev session flag', async () => {
    window.localStorage.setItem('eat-thing:dev-session', '1');
    mocks.signOut.mockResolvedValue({});

    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(window.localStorage.getItem('eat-thing:dev-session')).toBeNull();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
