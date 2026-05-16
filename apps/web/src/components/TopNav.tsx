import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Wordmark } from './Wordmark';
import { disableDevSession, useSession } from '../hooks/useSession';
import { authClient } from '../lib/auth-client';
import './TopNav.css';

const NAV_ITEMS = [
  { label: 'home',      path: '/' },
  { label: 'inventory', path: '/inventory' },
  { label: 'recipes',   path: '/recipes' },
  { label: 'plan',      path: '/plan' },
  { label: 'list',      path: '/list' },
];

function formatDateLabel(d: Date): string {
  const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
  const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][d.getMonth()];
  return `${dow} · ${mon} ${d.getDate()}`;
}

function initialFor(name?: string | null, email?: string | null): string {
  const s = (name ?? email ?? '?').trim();
  return s.charAt(0).toUpperCase() || '?';
}

export function TopNav() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const today = new Date();

  const handleSignOut = async () => {
    disableDevSession();
    try {
      await authClient.signOut();
    } finally {
      queryClient.setQueryData(['session'], null);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    }
  };

  return (
    <header className="topnav">
      <div className="topnav-brand">
        <Wordmark size="md" tone="on-ink" />
      </div>
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
      <div className="topnav-meta">
        <span className="topnav-date">{formatDateLabel(today)}</span>
        <button
          type="button"
          className="topnav-avatar topnav-avatar-btn"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          {initialFor(session?.user?.name, session?.user?.email)}
        </button>
      </div>
    </header>
  );
}
