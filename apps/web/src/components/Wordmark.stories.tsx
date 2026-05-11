import type { Meta, StoryObj } from '@storybook/react';
import { Wordmark } from './Wordmark';

const meta: Meta<typeof Wordmark> = {
  title: 'Brand/Wordmark',
  component: Wordmark,
};
export default meta;

type Story = StoryObj<typeof Wordmark>;

export const OnInk: Story = {
  args: { tone: 'on-ink', size: 'md' },
  decorators: [(Story) => <div style={{ background: '#0d1714', padding: 24 }}><Story /></div>],
};

export const OnPaper: Story = {
  args: { tone: 'on-paper', size: 'md' },
  decorators: [(Story) => <div style={{ background: '#f3f5f2', padding: 24 }}><Story /></div>],
};

export const Large: Story = {
  args: { tone: 'on-paper', size: 'lg' },
};
