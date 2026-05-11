import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterStrip } from './FilterStrip';

describe('FilterStrip', () => {
  it('renders tabs with counts and marks the active tab', () => {
    render(
      <FilterStrip
        tabs={[
          { key: 'all', label: 'All', count: 5 },
          { key: 'a',   label: 'A',   count: 2 },
        ]}
        activeTab="a"
        onTabChange={() => {}}
      />,
    );
    const a = screen.getByRole('button', { name: /^A 2$/ });
    expect(a.className).toContain('filter-tab--active');
  });

  it('fires onTabChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(
      <FilterStrip
        tabs={[
          { key: 'all', label: 'All', count: 0 },
          { key: 'b',   label: 'B',   count: 0 },
        ]}
        activeTab="all"
        onTabChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^B/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders a search input bound to the prop value', () => {
    const onSearch = vi.fn();
    render(
      <FilterStrip
        tabs={[]}
        activeTab=""
        onTabChange={() => {}}
        searchValue="apple"
        onSearchChange={onSearch}
        searchPlaceholder="Search items…"
      />,
    );
    const input = screen.getByPlaceholderText('Search items…') as HTMLInputElement;
    expect(input.value).toBe('apple');
    fireEvent.change(input, { target: { value: 'banana' } });
    expect(onSearch).toHaveBeenCalledWith('banana');
  });
});
