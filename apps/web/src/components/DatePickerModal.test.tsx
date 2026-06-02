import React from 'react';
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

  it('closes on Escape', () => {
    const onClose = vi.fn();

    render(
      <DatePickerModal initialDate="2026-06-03" onConfirm={vi.fn()} onClose={onClose} />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Wednesday 3 June 2026' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses the selected day, traps tab navigation, and returns focus to the trigger', () => {
    function Wrapper() {
      const [open, setOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open picker
          </button>
          {open ? (
            <DatePickerModal
              initialDate="2026-06-03"
              onConfirm={vi.fn()}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      );
    }

    render(<Wrapper />);

    const trigger = screen.getByRole('button', { name: 'Open picker' });
    trigger.focus();
    fireEvent.click(trigger);

    const selectedDay = screen.getByRole('button', { name: 'Wednesday 3 June 2026' });
    expect(selectedDay).toHaveFocus();

    const closeButton = screen.getByRole('button', { name: 'Close' });
    const confirmButton = screen.getByRole('button', { name: 'choose wednesday 3 june 2026' });

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();

    confirmButton.focus();
    fireEvent.keyDown(confirmButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});
