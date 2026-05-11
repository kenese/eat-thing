import type { ReactNode } from 'react';
import './FilterStrip.css';

export interface FilterTab {
  key: string;
  label: string;
  count: number;
  /** Optional coloured dot (e.g. fresh-green for "cook now"). */
  dotColor?: string;
}

interface FilterStripProps {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Right-side slot — typically a "sort by …" pseudo-dropdown. */
  trailing?: ReactNode;
}

export function FilterStrip({
  tabs,
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  trailing,
}: FilterStripProps) {
  return (
    <div className="filter-strip">
      <div className="filter-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={`filter-tab${t.key === activeTab ? ' filter-tab--active' : ''}`}
          >
            {t.dotColor && (
              <span className="filter-tab-dot" style={{ background: t.dotColor }} />
            )}
            <span>{t.label}</span>
            {' '}
            <span className="filter-tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      {onSearchChange && (
        <div className="filter-search">
          <span className="filter-search-glyph" aria-hidden>⌕</span>
          <input
            type="search"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
          />
        </div>
      )}
      {trailing && <div className="filter-trailing">{trailing}</div>}
    </div>
  );
}
