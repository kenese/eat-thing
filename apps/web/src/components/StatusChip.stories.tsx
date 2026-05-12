import type { Meta, StoryObj } from '@storybook/react';
import { StatusChip } from './StatusChip';

const meta: Meta<typeof StatusChip> = {
  title: 'Chrome/StatusChip',
  component: StatusChip,
};
export default meta;
type Story = StoryObj<typeof StatusChip>;

export const AllKinds: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 16, background: '#f3f5f2' }}>
      <StatusChip kind="cook" />
      <StatusChip kind="shop" missingCount={2} />
      <StatusChip kind="shop" />
      <StatusChip kind="leftover" />
      <StatusChip kind="open" />
      <StatusChip kind="expired" />
      <StatusChip kind="soon" />
    </div>
  ),
};

export const OnHero: Story = {
  render: () => (
    <div style={{ display: 'inline-flex', padding: 24, background: 'var(--green, #1f5d33)', borderRadius: 10 }}>
      <StatusChip kind="cook" onHero />
    </div>
  ),
};
