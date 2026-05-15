import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch, useCreateFood } from '../../hooks/useFoodSearch';
import { useRecipe, useAddRecipe, useUpdateRecipe } from '../../hooks/useRecipes';
import type { CanonicalFood, RecipeIngredientInput, ImportedRecipe } from '@eat/shared';
import '../InventoryPage/ItemForm.css';
import './RecipesPage.css';
import './RecipeForm.css';
import { RecipeImagePicker } from './RecipeImagePicker';

interface IngredientDraft {
  canonicalFoodId: string | null;
  foodName: string | null;
  rawText: string;
  qty: string;
  unit: string;
  optional: boolean;
  lowConfidence?: boolean;
}

interface IngredientRowProps {
  draft: IngredientDraft;
  onChange: (next: IngredientDraft) => void;
  onRemove: () => void;
}

function UnresolvedIngredientRow({ draft, onChange, onRemove }: IngredientRowProps) {
  const [searchInput, setSearchInput] = useState('');
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(searchInput);
  const createFood = useCreateFood();
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <li className="ingredient-row ingredient-row--unresolved">
      <div className="ingredient-resolution">
        <span className="ingredient-raw-text">{draft.rawText}</span>
        <div className="ingredient-resolution-actions" ref={comboRef}>
          {draft.canonicalFoodId && draft.foodName && (
            <button
              type="button"
              className="btn-resolve-accept"
              title={`Accept suggested match: ${draft.foodName}`}
              onClick={() => onChange({ ...draft, lowConfidence: false })}
            >
              Use &ldquo;{draft.foodName}&rdquo;
            </button>
          )}
          <div className="resolution-combobox">
            <input
              className="form-input resolution-search"
              type="text"
              placeholder={draft.foodName ? `or search to change…` : `Search canonical foods…`}
              value={searchInput}
              autoComplete="off"
              onChange={e => { setSearchInput(e.target.value); setOpen(true); }}
              onFocus={() => { if (searchInput.trim()) setOpen(true); }}
            />
            {open && results.length > 0 && (
              <ul className="food-dropdown" role="listbox">
                {results.map(food => (
                  <li
                    key={food.id}
                    role="option"
                    className="food-option"
                    onMouseDown={() => {
                      onChange({ ...draft, canonicalFoodId: food.id, foodName: food.name, lowConfidence: false });
                      setSearchInput('');
                      setOpen(false);
                    }}
                  >
                    <span>{food.name}</span>
                    <span className="food-option-unit">{food.defaultUnit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="btn-resolve-new"
            disabled={createFood.isPending}
            onClick={async () => {
              const food = await createFood.mutateAsync({
                name: draft.rawText,
                defaultUnit: (['g', 'ml', 'count'] as const).includes(draft.unit as 'g' | 'ml' | 'count') ? draft.unit as 'g' | 'ml' | 'count' : 'g',
                category: 'other',
              });
              onChange({ ...draft, canonicalFoodId: food.id, foodName: food.name, lowConfidence: false });
            }}
          >
            {createFood.isPending ? '…' : 'New food'}
          </button>
        </div>
      </div>
      <div className="ingredient-controls">
        <input
          className="form-input ingredient-qty"
          type="text"
          value={draft.qty || ''}
          onChange={e => onChange({ ...draft, qty: e.target.value })}
          aria-label="Quantity"
        />
        <input
          type="text"
          className="form-select ingredient-unit"
          value={draft.unit}
          onChange={e => onChange({ ...draft, unit: e.target.value })}
          aria-label="Unit"
        />
        <button type="button" className="ingredient-remove" onClick={onRemove} aria-label="Remove ingredient">✕</button>
      </div>
    </li>
  );
}

function IngredientRow({ draft, onChange, onRemove }: IngredientRowProps) {
  if (draft.lowConfidence || !draft.canonicalFoodId) {
    return <UnresolvedIngredientRow draft={draft} onChange={onChange} onRemove={onRemove} />;
  }
  return (
    <li className="ingredient-row">
      <span className="ingredient-name">
        {draft.foodName ?? draft.rawText}{draft.optional ? ' (optional)' : ''}
      </span>
      <div className="ingredient-controls">
        <input
          className="form-input ingredient-qty"
          type="text"
          value={draft.qty || ''}
          onChange={e => onChange({ ...draft, qty: e.target.value })}
          aria-label="Quantity"
        />
        <input
          type="text"
          className="form-select ingredient-unit"
          value={draft.unit}
          onChange={e => onChange({ ...draft, unit: e.target.value })}
          aria-label="Unit"
        />
        <button type="button" className="ingredient-remove" onClick={onRemove} aria-label="Remove ingredient">✕</button>
      </div>
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
  initialData?: ImportedRecipe;
  pendingPhoto?: { base64: string; mimeType: string };
  onClose: () => void;
}

export function RecipeForm({ mode, recipeId, initialData, pendingPhoto, onClose }: RecipeFormProps) {
  const { data: existing, isLoading: isLoadingExisting } = useRecipe(mode === 'edit' && recipeId ? recipeId : null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [servings, setServings] = useState(initialData ? String(initialData.servings) : '4');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [instructions, setInstructions] = useState(initialData?.instructions ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    initialData
      ? initialData.ingredients.map(i => ({
          canonicalFoodId: i.canonicalFoodId,
          foodName: i.foodName,
          rawText: i.rawText,
          qty: i.qty,
          unit: i.unit,
          optional: i.optional,
          lowConfidence: i.confidence === 'low' || !i.canonicalFoodId,
        }))
      : [],
  );
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(mode === 'add' || !!initialData);
  const [photoBase64, setPhotoBase64] = useState<string | null>(pendingPhoto?.base64 ?? null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(pendingPhoto?.mimeType ?? null);
  const [readOnly, setReadOnly] = useState(mode === 'edit');

  useEffect(() => {
    if (mode === 'edit' && existing && !hydrated) {
      setName(existing.name);
      setServings(String(existing.servings));
      setSourceUrl(existing.sourceUrl ?? '');
      setInstructions(existing.instructions ?? '');
      setIngredients(existing.ingredients.map(i => ({
        canonicalFoodId: i.canonicalFoodId,
        foodName: i.foodName,
        rawText: i.foodName,
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
      rawText: food.name,
      qty: '',
      unit: food.defaultUnit,
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
    if (ingredients.some(i => !i.canonicalFoodId)) { setError('Please resolve all unmatched ingredients (shown in amber) before saving.'); return; }
    if (ingredients.some(i => !i.qty.trim())) { setError('Every ingredient needs a quantity.'); return; }

    const payload = {
      name: name.trim(),
      servings: servingsNum,
      sourceUrl: sourceUrl.trim() || null,
      instructions: instructions.trim() || null,
      ingredients: ingredients.map(({ foodName: _fn, lowConfidence: _lc, rawText: _rt, ...rest }) => rest as RecipeIngredientInput),
      ...(initialData !== undefined && { sourceImage: initialData.sourceImage ?? null }),
      ...(photoBase64 && photoMimeType && { photoBase64, photoMimeType }),
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

  const viewImageSrc = photoBase64
    ? `data:${photoMimeType};base64,${photoBase64}`
    : (existing?.sourceImage ?? null);

  function formatIngredient(ing: IngredientDraft) {
    return [ing.qty, ing.unit, ing.foodName ?? ing.rawText].filter(Boolean).join(' ');
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel modal-panel--recipe" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{initialData ? 'Review imported recipe' : mode === 'add' ? 'Add recipe' : name || 'Recipe'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {mode === 'edit' && isLoadingExisting ? (
          <p className="recipes-status">Loading…</p>
        ) : readOnly ? (
          <div className="recipe-view">
            {viewImageSrc && (
              <div className="recipe-view-image">
                <img src={viewImageSrc} alt={name} />
              </div>
            )}
            <div className="recipe-view-body">
              <div className="recipe-view-meta">
                <span className="recipe-view-servings">{servings} servings</span>
                {sourceUrl && (
                  <a className="recipe-view-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source ↗
                  </a>
                )}
              </div>

              {ingredients.length > 0 && (
                <div className="recipe-view-section">
                  <span className="ingredients-section-title">Ingredients</span>
                  <ul className="recipe-view-ingredients">
                    {ingredients.map(ing => (
                      <li key={ing.canonicalFoodId} className="recipe-view-ingredient">
                        {formatIngredient(ing)}
                        {ing.optional && <span className="recipe-view-optional"> (optional)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {instructions && (
                <div className="recipe-view-section">
                  <span className="ingredients-section-title">Instructions</span>
                  <p className="recipe-view-instructions">{instructions}</p>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
                <button type="button" className="btn-primary" onClick={() => setReadOnly(false)}>Edit</button>
              </div>
            </div>
          </div>
        ) : (
          <form className="recipe-form" onSubmit={handleSubmit} noValidate>
            <div className="recipe-form-header">
              <div className="recipe-form-meta">
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
              </div>
              <RecipeImagePicker
                photoBase64={photoBase64}
                photoMimeType={photoMimeType}
                onChange={(base64, mimeType) => { setPhotoBase64(base64); setPhotoMimeType(mimeType); }}
              />
            </div>

            <hr className="recipe-form-divider" />

            <div className="ingredients-section">
              <div className="ingredients-section-header">
                <span className="ingredients-section-title">Ingredients</span>
                {ingredients.length > 0 && (
                  <span className="ingredients-section-count">
                    {ingredients.length} {ingredients.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              {ingredients.length > 0 && (
                <div className="ingredients-block">
                  <ul className="ingredients-grid">
                    {ingredients.map((ing, idx) => (
                      <IngredientRow
                        key={ing.canonicalFoodId}
                        draft={ing}
                        onChange={next => updateIngredient(idx, next)}
                        onRemove={() => removeIngredient(idx)}
                      />
                    ))}
                  </ul>
                </div>
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
              <button type="button" className="btn-secondary" onClick={() => mode === 'edit' ? setReadOnly(true) : onClose()}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'Saving…' : initialData ? 'Save imported recipe' : mode === 'add' ? 'Add recipe' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
