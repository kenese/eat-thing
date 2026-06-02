import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePickerModal } from './DatePickerModal';

describe('DatePickerModal', () => {
  it('defaults to the initial date and confirms the selected day', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerModal initialDate="2026-06-03" onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(
      screen.getByRole('button', { name: 'Wednesday 3 June 2026' }),
    ).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Thursday 11 June 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'choose thursday 11 june 2026' }));

    expect(onConfirm).toHaveBeenCalledWith('2026-06-11');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('navigates months before confirming a date', () => {
    const onConfirm = vi.fn();

    render(
      <DatePickerModal initialDate="2026-06-03" onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Friday 10 July 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'choose friday 10 july 2026' }));

    expect(onConfirm).toHaveBeenCalledWith('2026-07-10');
  });

  it('cancels without confirming a date', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerModal initialDate="2026-06-03" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes without confirming a date', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerModal initialDate="2026-06-03" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
