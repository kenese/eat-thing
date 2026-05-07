import type { Meta, StoryObj } from '@storybook/react';
import { Counter } from './Counter';

const meta = {
    title: 'Components/Counter',
    component: Counter,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
} satisfies Meta<typeof Counter>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic counter state
export const Primary: Story = {
    args: {
        value: 0,
        onIncrement: () => console.log('Incremented!'),
        onReset: () => console.log('Reset!'),
    },
};

// Counter with a high value
export const HighValue: Story = {
    args: {
        ...Primary.args,
        value: 9999,
    },
};
