import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TopNav } from './TopNav';
import { BrowserRouter } from 'react-router-dom';

describe('TopNav', () => {
  it('renders the eat-thing brand name', () => {
    render(
      <BrowserRouter>
        <TopNav />
      </BrowserRouter>,
    );
    expect(screen.getByText('eat-thing')).toBeInTheDocument();
  });
});
