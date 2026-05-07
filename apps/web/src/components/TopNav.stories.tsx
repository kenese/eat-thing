import type { Meta, StoryObj } from '@storybook/react';
import { TopNav } from './TopNav';
import { BrowserRouter } from 'react-router-dom';

const meta = {
    title: 'Components/TopNav',
    component: TopNav,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        (Story) => (
            <BrowserRouter>
                <Story />
            </BrowserRouter>
        ),
    ],
    tags: ['autodocs'],
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
