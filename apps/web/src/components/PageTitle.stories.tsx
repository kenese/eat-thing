import type { Meta, StoryObj } from '@storybook/react';
import { PageTitle } from './PageTitle';

const meta: Meta<typeof PageTitle> = {
  title: 'Chrome/PageTitle',
  component: PageTitle,
};
export default meta;

type Story = StoryObj<typeof PageTitle>;

export const Inventory: Story = {
  args: {
    eyebrow: 'The kitchen · 9:14 am',
    title: 'Inventory',
    summary: '127 items on hand · 9 expiring this week · last reconciled today, 9:14 a.m.',
    actions: <button className="btn-primary">+ add item</button>,
  },
};
