import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useRecipe, useAddRecipe, useUpdateRecipe } from '../../hooks/useRecipes';
import type { CanonicalFood, CanonicalUnit, RecipeIngredientInput } from '@eat/shared';
import '../InventoryPage/ItemForm.css';

interface IngredientDraft extends RecipeIngredientInput {
  foodName: string;
}

interface IngredientRowProps {
  draft: IngredientDraft;
  onChange: (next: IngredientDraft) => void;
  onRemove: () => void;
}

function IngredientRow({ draft, onChange, onRemove }: IngredientRowProps) {
  return (
    <li className="ingredient-row">
      <span className="ingredient-name">
        {draft.foodName}{draft.optional ? ' (optional)' : ''}
      </span>
      <input
        className="form-input"
        type="number"
        step="any"
        min="0"
        value={draft.qty || ''}
        onChange={e => onChange({ ...draft, qty: parseFloat(e.target.value) || 0 })}
        aria-label="Quantity"
      />
      <select
        className="form-select"
        value={draft.unit}
        onChange={e => onChange({ ...draft, unit: e.target.value as CanonicalUnit })}
        aria-label="Unit"
      >
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      <button type="button" className="ingredient-remove" onClick={onRemove} aria-label="Remove ingredient">✕</button>
    </li>
  );
}

interface IngredientPickerProps {
  onPick: (food: CanonicalFood) => void;
}

function IngredientPicker({ onPick }: IngredientPickerProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(input);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="food-combobox" ref={ref}>
      <input
        className="form-input"
        type="text"
        placeholder="Add ingredient (e.g. flour, eggs…)"
        value={input}
        autoComplete="off"
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => { if (input.trim()) setOpen(true); }}
      />
      {open && results.length > 0 && (
        <ul className="food-dropdown" role="listbox">
          {results.map(food => (
            <li
              key={food.id}
              role="option"
              className="food-option"
              onMouseDown={() => { onPick(food); setInput(''); setOpen(false); }}
            >
              <span>{food.name}</span>
              <span className="food-option-unit">{food.defaultUnit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RecipeFormProps {
  mode: 'add' | 'edit';
  recipeId?: string;
  onClose: () => void;
}

export function RecipeForm({ mode, recipeId, onClose }: RecipeFormProps) {
  const { data: existing, isLoading: isLoadingExisting } = useRecipe(mode === 'edit' && recipeId ? recipeId : null);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [sourceUrl, setSourceUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(mode === 'add');

  useEffect(() => {
    if (mode === 'edit' && existing && !hydrated) {
      setName(existing.name);
      setServings(String(existing.servings));
      setSourceUrl(existing.sourceUrl ?? '');
      setInstructions(existing.instructions ?? '');
      setIngredients(existing.ingredients.map(i => ({
        canonicalFoodId: i.canonicalFoodId,
        foodName: i.foodName,
        qty: i.qty,
        unit: i.unit,
        optional: i.optional,
      })));
      setHydrated(true);
    }
  }, [mode, existing, hydrated]);

  const addMutation = useAddRecipe();
  const updateMutation = useUpdateRecipe(recipeId ?? '');
  const isPending = addMutation.isPending || updateMutation.isPending;

  function addIngredient(food: CanonicalFood) {
    if (ingredients.some(i => i.canonicalFoodId === food.id)) return;
    setIngredients(prev => [...prev, {
      canonicalFoodId: food.id,
      foodName: food.name,
      qty: 0,
      unit: food.defaultUnit as CanonicalUnit,
      optional: false,
    }]);
  }

  function updateIngredient(idx: number, next: IngredientDraft) {
    setIngredients(prev => prev.map((i, n) => n === idx ? next : i));
  }

  function removeIngredient(idx: number) {
    setIngredients(prev => prev.filter((_, n) => n !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Please enter a name.'); return; }

    const servingsNum = parseFloat(servings);
    if (isNaN(servingsNum) || servingsNum <= 0) { setError('Servings must be a positive number.'); return; }

    if (ingredients.length === 0) { setError('Add at least one ingredient.'); return; }
    if (ingredients.some(i => !i.qty || i.qty <= 0)) { setError('Every ingredient needs a positive quantity.'); return; }

    const payload = {
      name: name.trim(),
      servings: servingsNum,
      sourceUrl: sourceUrl.trim() || null,
      instructions: instructions.trim() || null,
      ingredients: ingredients.map(({ foodName: _foodName, ...rest }) => rest),
    };

    try {
      if (mode === 'add') {
        await addMutation.mutateAsync(payload);
      } else {
        await updateMutation.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{mode === 'add' ? 'Add recipe' : 'Edit recipe'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {mode === 'edit' && isLoadingExisting ? (
          <p className="recipes-status">Loading…</p>
        ) : (
          <form className="recipe-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label className="form-label" htmlFor="name">Name *</label>
              <input
                id="name"
                className="form-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Spaghetti bolognese"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="servings">Servings *</label>
                <input
                  id="servings"
                  className="form-input"
                  type="number"
                  step="any"
                  min="0"
                  value={servings}
                  onChange={e => setServings(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="sourceUrl">Source URL</label>
                <input
                  id="sourceUrl"
                  className="form-input"
                  type="url"
                  placeholder="Optional"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="ingredients-section">
              <span className="form-label">Ingredients *</span>
              {ingredients.length > 0 && (
                <ul className="ingredients-list">
                  {ingredients.map((ing, idx) => (
                    <IngredientRow
                      key={ing.canonicalFoodId}
                      draft={ing}
                      onChange={next => updateIngredient(idx, next)}
                      onRemove={() => removeIngredient(idx)}
                    />
                  ))}
                </ul>
              )}
              <IngredientPicker onPick={addIngredient} />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="instructions">Instructions</label>
              <textarea
                id="instructions"
                className="form-textarea"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Optional. Step-by-step or free-form."
              />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving…' : mode === 'add' ? 'Add recipe' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
