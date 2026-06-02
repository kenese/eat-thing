import { NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Wordmark } from './Wordmark';
import { disableDevSession, useSession } from '../hooks/useSession';
import { authClient } from '../lib/auth-client';
import './TopNav.css';

const NAV_ITEMS = [
  {
    label: 'home',
    path: '/',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <path d="M3 10.5L11 3l8 7.5V19a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1v-8.5z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: 'inventory',
    path: '/inventory',
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
        <span className="topnav-phone-brand" aria-hidden>Eat</span>
      </div>
      <nav className="topnav-links">
        {NAV_ITEMS.map((item) => (
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
        ))}
        {/* HANDOFF: shops route — nav tab present but /shops page not yet designed */}
        <span className="topnav-link topnav-link--stub topnav-phone-hidden">shops</span>
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
