import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it.each([
    ['cook',     'cook now'],
    ['leftover', 'leftover'],
    ['open',     'open seat'],
    ['expired',  'expired'],
  ] as const)('renders %s with label "%s"', (kind, label) => {
    render(<StatusChip kind={kind} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders "missing N" for kind=shop with a count', () => {
    render(<StatusChip kind="shop" missingCount={2} />);
    expect(screen.getByText('missing 2')).toBeInTheDocument();
  });

  it('falls back to "needs shop" for kind=shop with no count', () => {
    render(<StatusChip kind="shop" />);
    expect(screen.getByText('needs shop')).toBeInTheDocument();
  });
});
