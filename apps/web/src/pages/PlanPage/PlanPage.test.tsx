import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  PlanPage,
  resolveAnchorAfterTodayChange,
  useCurrentLocalDay,
} from './PlanPage';

const mockUseQueries = vi.fn(() => []);
const mockUseRecipes = vi.fn(() => ({ data: [] }));
const mockUseInventory = vi.fn(() => ({ data: [] }));
const mockUseMealPlanEntries = vi.fn();
const mockUseAddMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseUpdateMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseDeleteMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueries: () => mockUseQueries(),
  };
});

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => mockUseRecipes(),
}));

vi.mock('../../hooks/useInventory', () => ({
  useInventory: () => mockUseInventory(),
}));

vi.mock('../../hooks/useMealPlan', () => ({
  useMealPlanEntries: (...args: unknown[]) => mockUseMealPlanEntries(...args),
  useAddMealPlanEntry: () => mockUseAddMealPlanEntry(),
  useUpdateMealPlanEntry: () => mockUseUpdateMealPlanEntry(),
  useDeleteMealPlanEntry: () => mockUseDeleteMealPlanEntry(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('PlanPage time handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseMealPlanEntries.mockImplementation((from: string, to: string) => ({
      data: { entries: [] },
      isLoading: false,
      from,
      to,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('useCurrentLocalDay refreshes after local midnight', () => {
    vi.setSystemTime(new Date('2026-06-03T23:59:30'));

    const { result } = renderHook(() => useCurrentLocalDay());

    expect(toIso(result.current)).toBe('2026-06-03');

    act(() => {
      vi.setSystemTime(new Date('2026-06-04T00:00:01'));
      vi.advanceTimersByTime(30_000);
    });

    expect(toIso(result.current)).toBe('2026-06-04');
  });

  it('resolveAnchorAfterTodayChange only advances anchors that were on today', () => {
    const previousToday = new Date(2026, 5, 3);
    const nextToday = new Date(2026, 5, 4);
    const distantAnchor = new Date(2026, 6, 15);

    expect(toIso(resolveAnchorAfterTodayChange(previousToday, previousToday, nextToday))).toBe('2026-06-04');
    expect(toIso(resolveAnchorAfterTodayChange(distantAnchor, previousToday, nextToday))).toBe('2026-07-15');
  });

  it('today resets a distant anchor back to the current day window', async () => {
    vi.setSystemTime(new Date('2026-06-03T10:00:00'));

    render(
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>,
    );

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-06-01', '2026-06-17');

    fireEvent.click(screen.getByRole('button', { name: 'Load date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday 15 July 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'choose wednesday 15 july 2026' }));

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-07-13', '2026-07-29');

    fireEvent.click(screen.getByRole('button', { name: 'today' }));

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-06-01', '2026-06-17');
  });
});
