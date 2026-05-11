import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopNav } from './TopNav';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const meta: Meta<typeof TopNav> = {
  title: 'Chrome/TopNav',
  component: TopNav,
  decorators: [
    (Story) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter><Story /></MemoryRouter>
      </QueryClientProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof TopNav>;

export const Default: Story = {};
