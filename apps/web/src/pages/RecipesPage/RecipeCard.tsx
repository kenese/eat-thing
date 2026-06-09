import { StatusChip } from '../../components/StatusChip';
import type { RecipeSummary } from '@eat/shared';

export interface MatchInfo {
  bucket: 'cookable' | 'shoppable' | 'library';
  missing: string[];
}

export function RecipeCard({
  recipe,
  match,
  dense,
  selected,
  onOpen,
  onSelect,
}: {
  recipe: RecipeSummary;
  match: MatchInfo;
  dense?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onSelect?: () => void;
}) {
  return (
    <div className={`rx-card-wrapper${selected ? ' rx-card-wrapper--selected' : ''}`}>
      <button
        className={`rx-card${dense ? ' rx-card--dense' : ''}`}
        onClick={onOpen}
        aria-label={recipe.name}
      >
        <div className="rx-card-image">
          {recipe.sourceImage ? (
            <img src={recipe.sourceImage} alt="" />
          ) : (
            <span className="rx-card-image-fallback">{recipe.name}</span>
          )}
          <div className="rx-card-badge">
            {match.bucket === 'cookable' ? (
              <StatusChip kind="cook" />
            ) : (
              <StatusChip kind="shop" missingCount={match.missing.length} />
            )}
          </div>
          <div className="rx-card-meta-overlay">
            {recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min · ` : ''}serves {recipe.servings}
          </div>
        </div>
        <div className="rx-card-body">
          <div className="rx-card-title">{recipe.name}</div>
          {!dense && match.missing.length > 0 && (
            <div className="rx-card-need">
              need {match.missing.slice(0, 2).join(', ')}
              {match.missing.length > 2 ? ` & ${match.missing.length - 2} more` : ''}
            </div>
          )}
          <div className="rx-card-footer">
            <span>{recipe.ingredientCount} ingr</span>
            {recipe.tags.length > 0 && (
              <span className="rx-card-tags">
                {recipe.tags.slice(0, 2).map(t => (
                  <span key={t} className="rx-card-tag">{t}</span>
                ))}
              </span>
            )}
          </div>
        </div>
      </button>
      {onSelect && (
        <button
          className={`rx-card-select-btn${selected ? ' rx-card-select-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); onSelect(); }}
          aria-label={selected ? 'Deselect recipe' : 'Select recipe'}
          aria-pressed={selected}
        >
          {selected ? '✓' : ''}
        </button>
      )}
    </div>
  );
}
