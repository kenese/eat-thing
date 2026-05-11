import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FilterStrip } from './FilterStrip';

const meta: Meta<typeof FilterStrip> = {
  title: 'Chrome/FilterStrip',
  component: FilterStrip,
};
export default meta;
type Story = StoryObj<typeof FilterStrip>;

const TABS = [
  { key: 'all', label: 'All', count: 12 },
  { key: 'cook', label: 'Cook now', count: 4, dotColor: '#5aa758' },
  { key: 'shop', label: 'Quick shop', count: 3, dotColor: '#d96e2e' },
  { key: 'library', label: 'Library', count: 5 },
];

export const Recipes: Story = {
  render: () => {
    const [active, setActive] = useState('all');
    const [q, setQ] = useState('');
    return (
      <FilterStrip
        tabs={TABS}
        activeTab={active}
        onTabChange={setActive}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search recipes, ingredients, tags…"
        trailing={<><span>sort</span><span style={{ fontWeight: 600 }}>cookable first</span></>}
      />
    );
  },
};
