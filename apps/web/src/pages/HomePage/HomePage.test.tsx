import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

const pageHooks = vi.hoisted(() => ({
  useHomeData: vi.fn(),
  useRecipes: vi.fn(),
  useInventory: vi.fn(),
  WeekCarousel: vi.fn(() => <section aria-label="week carousel">week</section>),
}));

vi.mock('./useHomeData', () => ({
  useHomeData: pageHooks.useHomeData,
}));

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: pageHooks.useRecipes,
}));

vi.mock('../../hooks/useInventory', () => ({
  useInventory: pageHooks.useInventory,
}));

vi.mock('./HeroBand', () => ({
  HeroBand: () => <section aria-label="hero">hero</section>,
}));

vi.mock('./ShopPreview', () => ({
  ShopPreview: () => <section aria-label="shop preview">shop</section>,
}));

vi.mock('../../components/WeekCarousel', () => ({
  WeekCarousel: pageHooks.WeekCarousel,
}));

vi.mock('../RecipesPage/RecipeForm', () => ({
  RecipeForm: () => <div role="dialog" aria-label="Recipe form" />,
}));

const pasta = {
  id: 'r1',
  name: 'Pasta Carbonara',
  servings: 4,
  sourceUrl: null,
  sourceImage: null,
  ingredientCount: 2,
  totalTimeMinutes: 20,
  tags: [],
  canonicalFoodIds: ['eggs'],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

function setupHomePage() {
  pageHooks.useHomeData.mockReturnValue({
    hero: { pill: null, onHandCount: 1, expiringSoonCount: 0, expirySubcopyDay: 'today' },
    shop: { items: [], totalItems: 0, checkedItems: 0, estimatedTotal: null },
    planDays: [
      { date: new Date(2026, 5, 1), iso: '2026-06-01', label: 'Mon 1', isToday: false, isPast: true },
      { date: new Date(2026, 5, 2), iso: '2026-06-02', label: 'Tue 2', isToday: false, isPast: true },
      { date: new Date(2026, 5, 3), iso: '2026-06-03', label: 'Wed 3', isToday: true, isPast: false },
    ],
    entriesByDay: {},
    loading: { inventory: false, mealPlan: false, recipes: false, shopping: false },
    errors: { inventory: false, mealPlan: false, recipes: false, shopping: false },
  });
  pageHooks.useRecipes.mockReturnValue({ data: [pasta], isLoading: false, isError: false });
  pageHooks.useInventory.mockReturnValue({
    data: [{
      id: 'i1',
      householdId: 'h1',
      canonicalFoodId: 'eggs',
      foodName: 'eggs',
      qty: 6,
      unit: 'count',
      brand: null,
      category: 'dairy',
      purchasedAt: null,
      expiresAt: null,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
    }],
    isLoading: false,
  });
}

describe('HomePage', () => {
  it('adds the cook tonight section after the weekly plan', () => {
    setupHomePage();

    render(<MemoryRouter><HomePage /></MemoryRouter>);

    const week = screen.getByLabelText('week carousel');
    const cookTonight = screen.getByText('Ready to cook tonight').closest('section');

    expect(cookTonight).toBeInTheDocument();
    expect(cookTonight!.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(screen.getByRole('button', { name: /pasta carbonara/i })).toBeInTheDocument();
  });

  it('loads the weekly plan carousel at today even when earlier days exist', () => {
    setupHomePage();

    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(pageHooks.WeekCarousel).toHaveBeenCalledWith(
      expect.objectContaining({ initialScrollIso: '2026-06-03' }),
      undefined,
    );
  });
});
