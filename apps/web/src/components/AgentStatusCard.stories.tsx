import type { Meta, StoryObj } from '@storybook/react';
import { AgentStatusCard } from './AgentStatusCard';

const meta: Meta<typeof AgentStatusCard> = {
  title: 'Chrome/AgentStatusCard',
  component: AgentStatusCard,
};
export default meta;
type Story = StoryObj<typeof AgentStatusCard>;

export const Idle: Story = {
  args: { state: 'idle', message: `I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.` },
};

export const Running: Story = {
  args: { state: 'running', message: 'Checking prices at New World · 12 items so far.' },
};

export const Failed: Story = {
  args: { state: 'failed', message: 'Login failed. Re-run the bootstrap script to refresh the session.' },
};
