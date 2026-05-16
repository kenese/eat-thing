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
