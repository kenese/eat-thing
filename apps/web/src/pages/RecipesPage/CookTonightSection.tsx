import { RecipeCard, type MatchInfo } from './RecipeCard';
import type { RecipeSummary } from '@eat/shared';
import './RecipesPage.css';

export interface CookTonightItem {
  recipe: RecipeSummary;
  match: MatchInfo;
}

interface CookTonightSectionProps {
  items: CookTonightItem[];
  selectedIds?: Set<string>;
  className?: string;
  onOpenRecipe: (id: string) => void;
  onSelectRecipe?: (id: string) => void;
}

export function CookTonightSection({
  items,
  selectedIds = new Set(),
  className,
  onOpenRecipe,
  onSelectRecipe,
}: CookTonightSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className={`rx-section${className ? ` ${className}` : ''} `}>
      <div className="rx-section-header">
        <span className="rx-section-title">
          Ready to cook tonight<span className="dot" style={{ color: 'var(--fresh)' }}>.</span>
        </span>
        <span className="rx-section-count">{items.length} {items.length === 1 ? 'recipe' : 'recipes'}</span>
        <span className="rx-section-hint">uses what's on hand</span>
      </div>
      <div className="rx-grid">
        {items.map(({ recipe, match }) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            match={match}
            selected={selectedIds.has(recipe.id)}
            onSelect={onSelectRecipe ? () => onSelectRecipe(recipe.id) : undefined}
            onOpen={() => onOpenRecipe(recipe.id)}
          />
        ))}
      </div>
    </section>
  );
}
