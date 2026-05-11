import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatusCard } from './AgentStatusCard';

describe('AgentStatusCard', () => {
  it('renders the idle eyebrow and message', () => {
    render(<AgentStatusCard state="idle" message="Standing by." />);
    expect(screen.getByText(/PLAYWRIGHT AGENT · IDLE/)).toBeInTheDocument();
    expect(screen.getByText('Standing by.')).toBeInTheDocument();
  });

  it('uses the running eyebrow when state=running', () => {
    render(<AgentStatusCard state="running" message="Checking prices." />);
    expect(screen.getByText(/PLAYWRIGHT AGENT · RUNNING/)).toBeInTheDocument();
  });

  it('uses the failed eyebrow when state=failed', () => {
    render(<AgentStatusCard state="failed" message="Something went wrong." />);
    expect(screen.getByText(/PLAYWRIGHT AGENT · FAILED/)).toBeInTheDocument();
  });
});
