import { useState, useEffect } from 'react';
import { useRecipes, useDeleteRecipe } from '../../hooks/useRecipes';
import { RecipeForm } from './RecipeForm';
import type { RecipeSummary } from '@eat/shared';
import './RecipesPage.css';

interface RecipeRowProps {
  recipe: RecipeSummary;
  onEdit: () => void;
  onDelete: () => void;
}

function RecipeRow({ recipe, onEdit, onDelete }: RecipeRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="recipe-item">
      <div className="recipe-item-main">
        <button className="recipe-item-name" onClick={onEdit}>
          {recipe.name}
        </button>
        <div className="recipe-item-meta">
          {recipe.ingredientCount} {recipe.ingredientCount === 1 ? 'ingredient' : 'ingredients'} · {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
        </div>
      </div>
      <div className="recipe-item-actions">
        {confirming ? (
          <>
            <button className="btn-icon danger" onClick={() => { onDelete(); setConfirming(false); }} title="Confirm">✓</button>
            <button className="btn-icon" onClick={() => setConfirming(false)} title="Cancel">✕</button>
          </>
        ) : (
          <>
            <button className="btn-icon" onClick={onEdit} title="Edit">✎</button>
            <button className="btn-icon ghost-danger" onClick={() => setConfirming(true)} title="Delete">🗑</button>
          </>
        )}
      </div>
    </li>
  );
}

export function RecipesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<
    { mode: 'add' } | { mode: 'edit'; id: string } | null
  >(null);

  const deleteMutation = useDeleteRecipe();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: recipes = [], isLoading, isError } = useRecipes({
    q: debouncedSearch || undefined,
  });

  return (
    <div className="recipes-page">
      <div className="recipes-header">
        <h1>Recipes</h1>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>+ Add</button>
      </div>

      <div className="recipes-search">
        <input
          type="search"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="recipes-list-wrap">
        {isLoading && <p className="recipes-status">Loading…</p>}
        {isError && <p className="recipes-status error">Failed to load. Check your connection.</p>}
        {!isLoading && !isError && recipes.length === 0 && (
          <p className="recipes-status empty">
            {search ? 'No recipes match your search.' : 'No recipes yet — tap + Add to get started.'}
          </p>
        )}
        {!isLoading && recipes.length > 0 && (
          <ul className="recipes-list">
            {recipes.map(r => (
              <RecipeRow
                key={r.id}
                recipe={r}
                onEdit={() => setModal({ mode: 'edit', id: r.id })}
                onDelete={() => deleteMutation.mutate(r.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <RecipeForm
          mode={modal.mode}
          recipeId={modal.mode === 'edit' ? modal.id : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
