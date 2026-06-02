import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch, useCreateFood } from '../../hooks/useFoodSearch';
import { useRecipe, useAddRecipe, useUpdateRecipe, useDeleteRecipe } from '../../hooks/useRecipes';
import type { CanonicalFood, RecipeIngredientInput, ImportedRecipe } from '@eat/shared';
import { toCanonical, isMassUnit, isVolumeUnit } from '@eat/taxonomy';
import type { DisplayUnit } from '@eat/taxonomy';
import '../InventoryPage/ItemForm.css';
import './RecipesPage.css';
import './RecipeForm.css';
import { RecipeImagePicker } from './RecipeImagePicker';

function parseRecipeQty(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const mixed = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = Number(mixed[1]), n = Number(mixed[2]), d = Number(mixed[3]);
    if (d > 0) return w + n / d;
  }
  const frac = cleaned.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const n = Number(frac[1]), d = Number(frac[2]);
    if (d > 0) return n / d;
  }
  const p = Number.parseFloat(cleaned);
  return Number.isFinite(p) && p > 0 ? p : null;
}

function normalizeUnit(unit: string): DisplayUnit | null {
  const u = unit.trim().toLowerCase();
  if (!u) return 'count';
  if (u === 'gram' || u === 'grams' || u === 'gr') return 'g';
  if (u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'milliliter' || u === 'milliliters' || u === 'millilitre' || u === 'millilitres') return 'ml';
  if (u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') return 'l';
  if (u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'cups') return 'cup';
  if (u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'each' || u === 'item' || u === 'items' || u === 'count') return 'count';
  if (isMassUnit(u) || isVolumeUnit(u)) return u as DisplayUnit;
  return null;
}

function computeMetric(qty: string, unit: string): string | null {
  const q = parseRecipeQty(qty);
  const u = normalizeUnit(unit);
  if (q === null || u === null) return null;
  const canonical = toCanonical(q, u);
  const rounded = Math.round(canonical.qty * 10) / 10;
  const qtyStr = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${qtyStr} ${canonical.unit}`;
}

interface IngredientDraft {
  clientId: string;
  canonicalFoodId: string | null;
  foodName: string | null;
  rawText: string;
  qty: string;
  unit: string;
  section: string | null;
  optional: boolean;
  lowConfidence?: boolean;
  metricQty?: string;
  metricUnit?: 'g' | 'ml' | 'count';
}

function createIngredientDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? `ingredient-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function groupBySection(ings: IngredientDraft[]): Array<{ section: string | null; items: IngredientDraft[] }> {
  const groups: Array<{ section: string | null; items: IngredientDraft[] }> = [];
  const seen = new Map<string | null, number>();
  for (const ing of ings) {
    const key = ing.section ?? null;
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ section: key, items: [] });
    }
    groups[seen.get(key)!].items.push(ing);
  }
  return groups;
}

function renderInstructions(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      return <h3 key={i} className="recipe-instructions-heading">{headingMatch[1]}</h3>;
    }
    if (!line.trim()) {
      return <div key={i} className="recipe-instructions-gap" />;
    }
    return <p key={i} className="recipe-instructions-para">{line}</p>;
  });
}

interface MetricControlProps {
  draft: IngredientDraft;
  onChange: (next: IngredientDraft) => void;
  hasError?: boolean;
}

function MetricControl({ draft, onChange, hasError }: MetricControlProps) {
  const auto = computeMetric(draft.qty, draft.unit);
  if (auto) {
    return <span className="ingredient-metric">≈ {auto}</span>;
  }
  const metricError = hasError && (!draft.metricQty || !draft.metricUnit);
  return (
    <>
      <input
        className={`form-input ingredient-metric-qty${metricError ? ' ingredient-input--error' : ''}`}
        type="number"
        step="any"
        min="0"
        placeholder="qty"
        value={draft.metricQty ?? ''}
        onChange={e => onChange({ ...draft, metricQty: e.target.value })}
        aria-label="Metric quantity"
      />
      <select
        className={`form-select ingredient-metric-unit${metricError ? ' ingredient-input--error' : ''}`}
        value={draft.metricUnit ?? ''}
        onChange={e => onChange({ ...draft, metricUnit: e.target.value as 'g' | 'ml' | 'count' })}
        aria-label="Metric unit"
      >
        <option value="">—</option>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
    </>
  );
}

interface IngredientRowProps {
  draft: IngredientDraft;
  onChange: (next: IngredientDraft) => void;
  onRemove: () => void;
  hasError?: boolean;
}

function UnresolvedIngredientRow({ draft, onChange, onRemove, hasError }: IngredientRowProps) {
  const [searchInput, setSearchInput] = useState(draft.rawText);
  const [open, setOpen] = useState(false);
  const [pendingCanonical, setPendingCanonical] = useState<{ id: string; name: string; defaultUnit: string } | null>(null);
  const { data: results = [] } = useFoodSearch(searchInput);
  const createFood = useCreateFood();
  const comboRef = useRef<HTMLDivElement>(null);

  const exactMatch = results.find(f => f.name.toLowerCase() === searchInput.trim().toLowerCase());
  const isSelect = pendingCanonical !== null || exactMatch !== undefined;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleConfirm() {
    if (pendingCanonical) {
      onChange({ ...draft, canonicalFoodId: pendingCanonical.id, foodName: pendingCanonical.name, unit: draft.unit || pendingCanonical.defaultUnit, lowConfidence: false });
    } else if (exactMatch) {
      onChange({ ...draft, canonicalFoodId: exactMatch.id, foodName: exactMatch.name, unit: draft.unit || exactMatch.defaultUnit, lowConfidence: false });
    } else {
      const food = await createFood.mutateAsync({
        name: searchInput.trim(),
        defaultUnit: (['g', 'ml', 'count'] as const).includes(draft.unit as 'g' | 'ml' | 'count') ? draft.unit as 'g' | 'ml' | 'count' : 'g',
        category: 'other',
      });
      onChange({ ...draft, canonicalFoodId: food.id, foodName: food.name, unit: draft.unit || food.defaultUnit, lowConfidence: false });
    }
  }

  return (
    <li className="ingredient-row ingredient-row--unresolved">
      <div className="ingredient-resolution">
        <span className="ingredient-raw-text">Original: {draft.rawText}</span>
        <div className="ingredient-resolution-actions" ref={comboRef}>
          <div className="resolution-combobox">
            <input
              className="form-input resolution-search"
              type="text"
              placeholder="Search canonical foods…"
              value={searchInput}
              autoComplete="off"
              onChange={e => { setSearchInput(e.target.value); setPendingCanonical(null); setOpen(true); }}
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
                      setSearchInput(food.name);
                      setPendingCanonical({ id: food.id, name: food.name, defaultUnit: food.defaultUnit });
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
            disabled={createFood.isPending || !searchInput.trim()}
            onClick={handleConfirm}
          >
            {createFood.isPending ? '…' : isSelect ? 'select' : 'add'}
          </button>
        </div>
      </div>
      <div className="ingredient-controls">
        <input
          className={`form-input ingredient-qty${hasError && !draft.qty.trim() ? ' ingredient-input--error' : ''}`}
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
        <MetricControl draft={draft} onChange={onChange} hasError={hasError} />
        <button type="button" className="ingredient-remove" onClick={onRemove} aria-label="Remove ingredient">✕</button>
      </div>
    </li>
  );
}

function IngredientRow({ draft, onChange, onRemove, hasError }: IngredientRowProps) {
  if (draft.lowConfidence || !draft.canonicalFoodId) {
    return <UnresolvedIngredientRow draft={draft} onChange={onChange} onRemove={onRemove} hasError={hasError} />;
  }
  return (
    <li className="ingredient-row">
      <span className="ingredient-name">
        {draft.foodName ?? draft.rawText}{draft.optional ? ' (optional)' : ''}
      </span>
      <div className="ingredient-controls">
        <input
          className={`form-input ingredient-qty${hasError && !draft.qty.trim() ? ' ingredient-input--error' : ''}`}
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
        <MetricControl draft={draft} onChange={onChange} hasError={hasError} />
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
  onAddToPlan?: (recipeId: string, servings: number) => Promise<{ addedTo: string[]; skipped: string[] }>;
}

export function RecipeForm({ mode, recipeId, initialData, pendingPhoto, onClose, onAddToPlan }: RecipeFormProps) {
  const { data: existing, isLoading: isLoadingExisting } = useRecipe(mode === 'edit' && recipeId ? recipeId : null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [servings, setServings] = useState(initialData ? String(initialData.servings) : '4');
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(
    initialData?.totalTimeMinutes != null ? String(initialData.totalTimeMinutes) : '',
  );
  const [tags, setTags] = useState(initialData?.tags.join(', ') ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [instructions, setInstructions] = useState(initialData?.instructions ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    initialData
      ? initialData.ingredients.map(i => ({
          clientId: createIngredientDraftId(),
          canonicalFoodId: i.canonicalFoodId,
          foodName: i.foodName,
          rawText: i.rawText,
          qty: i.qty,
          unit: i.unit,
          section: i.section,
          optional: i.optional,
          lowConfidence: i.confidence === 'low' || !i.canonicalFoodId,
        }))
      : [],
  );
  const [error, setError] = useState('');
  const [ingredientErrors, setIngredientErrors] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(mode === 'add' || !!initialData);
  const [photoBase64, setPhotoBase64] = useState<string | null>(pendingPhoto?.base64 ?? null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(pendingPhoto?.mimeType ?? null);
  const [readOnly, setReadOnly] = useState(mode === 'edit');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addToPlanStatus, setAddToPlanStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [addToPlanLabel, setAddToPlanLabel] = useState('add to plan');
  const hasUnsavedChanges = useRef(false);
  const deleteRecipe = useDeleteRecipe();

  useEffect(() => {
    if (mode === 'edit' && existing && !hydrated) {
      setName(existing.name);
      setServings(String(existing.servings));
      setTotalTimeMinutes(existing.totalTimeMinutes != null ? String(existing.totalTimeMinutes) : '');
      setTags(existing.tags.join(', '));
      setSourceUrl(existing.sourceUrl ?? '');
      setInstructions(existing.instructions ?? '');
      setIngredients(existing.ingredients.map(i => ({
        clientId: i.id,
        canonicalFoodId: i.canonicalFoodId,
        foodName: i.foodName,
        rawText: i.foodName,
        qty: i.qty,
        unit: i.unit,
        section: i.section,
        optional: i.optional,
      })));
      setHydrated(true);
    }
  }, [mode, existing, hydrated]);

  const addMutation = useAddRecipe();
  const updateMutation = useUpdateRecipe(recipeId ?? '');
  const isPending = addMutation.isPending || updateMutation.isPending;

  function parseTagsInput(value: string) {
    return [...new Set(value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  }

  function attemptClose() {
    if (!readOnly && hasUnsavedChanges.current) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    onClose();
  }

  function addIngredient(food: CanonicalFood) {
    hasUnsavedChanges.current = true;
    setIngredients(prev => [...prev, {
      clientId: createIngredientDraftId(),
      canonicalFoodId: food.id,
      foodName: food.name,
      rawText: food.name,
      qty: '',
      unit: food.defaultUnit,
      section: null,
      optional: false,
    }]);
  }

  function updateIngredient(idx: number, next: IngredientDraft) {
    hasUnsavedChanges.current = true;
    setIngredients(prev => prev.map((i, n) => n === idx ? next : i));
  }

  function removeIngredient(idx: number) {
    hasUnsavedChanges.current = true;
    setIngredients(prev => prev.filter((_, n) => n !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Please enter a name.'); return; }

    const servingsNum = parseFloat(servings);
    if (isNaN(servingsNum) || servingsNum <= 0) { setError('Servings must be a positive number.'); return; }

    const totalTimeNum = totalTimeMinutes.trim() ? Number(totalTimeMinutes) : null;
    if (totalTimeNum !== null && (!Number.isInteger(totalTimeNum) || totalTimeNum <= 0)) {
      setError('Total time must be a whole number of minutes.');
      return;
    }

    if (ingredients.length === 0) { setError('Add at least one ingredient.'); return; }

    const newIngredientErrors = new Set<string>();
    for (const i of ingredients) {
      if (!i.canonicalFoodId || !i.qty.trim() || (!computeMetric(i.qty, i.unit) && (!i.metricQty || !i.metricUnit))) {
        newIngredientErrors.add(i.clientId);
      }
    }
    if (newIngredientErrors.size > 0) {
      setIngredientErrors(newIngredientErrors);
      setError(`${newIngredientErrors.size} ingredient${newIngredientErrors.size > 1 ? 's need' : ' needs'} attention — check the highlighted rows above.`);
      return;
    }
    setIngredientErrors(new Set());

    const payload = {
      name: name.trim(),
      servings: servingsNum,
      totalTimeMinutes: totalTimeNum,
      tags: parseTagsInput(tags),
      sourceUrl: sourceUrl.trim() || null,
      instructions: instructions.trim() || null,
      ingredients: ingredients.map(({ clientId: _id, foodName: _fn, lowConfidence: _lc, rawText: _rt, metricQty, metricUnit, ...rest }) => ({
        ...rest,
        metricValue: computeMetric(rest.qty, rest.unit) ?? (metricQty && metricUnit ? `${metricQty} ${metricUnit}` : null),
      } as RecipeIngredientInput)),
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

  async function handleDelete() {
    if (!recipeId) return;
    await deleteRecipe.mutateAsync(recipeId);
    onClose();
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
      onMouseDown={e => { if (e.target === e.currentTarget) attemptClose(); }}
    >
      <div className="modal-panel modal-panel--recipe" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{initialData ? 'Review imported recipe' : mode === 'add' ? 'Add recipe' : name || 'Recipe'}</h2>
          <button className="modal-close" onClick={attemptClose} aria-label="Close">✕</button>
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
                {totalTimeMinutes && <span className="recipe-view-time">{totalTimeMinutes} min</span>}
                {sourceUrl && (
                  <a className="recipe-view-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Source ↗
                  </a>
                )}
              </div>
              {parseTagsInput(tags).length > 0 && (
                <div className="recipe-view-tags">
                  {parseTagsInput(tags).map(tag => <span key={tag} className="recipe-view-tag">{tag}</span>)}
                </div>
              )}

              {ingredients.length > 0 && (
                <div className="recipe-view-section">
                  <span className="ingredients-section-title">Ingredients</span>
                  {groupBySection(ingredients).map((group, gi) => (
                    <div key={gi} className="recipe-view-ingredient-group">
                      {group.section && (
                        <div className="recipe-view-ingredient-section-header">{group.section.toLowerCase()}</div>
                      )}
                      <ul className="recipe-view-ingredients">
                        {group.items.map(ing => (
                          <li key={ing.clientId} className="recipe-view-ingredient">
                            {formatIngredient(ing)}
                            {ing.optional && <span className="recipe-view-optional"> (optional)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {instructions && (
                <div className="recipe-view-section">
                  <span className="ingredients-section-title">Instructions</span>
                  <div className="recipe-view-instructions">
                    {renderInstructions(instructions)}
                  </div>
                </div>
              )}

              <div className="form-actions">
                {deleteConfirm ? (
                  <>
                    <span className="recipe-view-delete-warning">delete this recipe?</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleDelete}
                      disabled={deleteRecipe.isPending}
                    >
                      {deleteRecipe.isPending ? 'deleting…' : 'yes, delete'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      cancel
                    </button>
                  </>
                ) : (
                  <>
                    {mode === 'edit' && recipeId && (
                      <button
                        type="button"
                        className="btn-danger btn-danger--ghost"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        delete
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={onClose}>close</button>
                    {onAddToPlan && recipeId && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={addToPlanStatus === 'pending'}
                        aria-label={addToPlanLabel}
                        onClick={async () => {
                          setAddToPlanStatus('pending');
                          try {
                            const { addedTo } = await onAddToPlan(recipeId, Number(servings));
                            const label = addedTo[0] ? `added to ${addedTo[0]}` : 'added to plan';
                            setAddToPlanLabel(label);
                            setAddToPlanStatus('success');
                            setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('add to plan'); }, 2500);
                          } catch {
                            setAddToPlanLabel('failed — try again');
                            setAddToPlanStatus('error');
                            setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('add to plan'); }, 2500);
                          }
                        }}
                      >
                        {addToPlanStatus === 'pending' ? 'adding…' : addToPlanLabel}
                      </button>
                    )}
                    <button type="button" className="btn-primary" onClick={() => setReadOnly(false)}>edit</button>
                  </>
                )}
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
                    onChange={e => { setName(e.target.value); hasUnsavedChanges.current = true; }}
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
                      onChange={e => { setServings(e.target.value); hasUnsavedChanges.current = true; }}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="totalTimeMinutes">Total time (min)</label>
                    <input
                      id="totalTimeMinutes"
                      className="form-input"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Optional"
                      value={totalTimeMinutes}
                      onChange={e => { setTotalTimeMinutes(e.target.value); hasUnsavedChanges.current = true; }}
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
                      onChange={e => { setSourceUrl(e.target.value); hasUnsavedChanges.current = true; }}
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="tags">Tags</label>
                  <input
                    id="tags"
                    className="form-input"
                    type="text"
                    placeholder="Comma-separated, e.g. quick, pasta"
                    value={tags}
                    onChange={e => { setTags(e.target.value); hasUnsavedChanges.current = true; }}
                  />
                </div>
              </div>
              <RecipeImagePicker
                photoBase64={photoBase64}
                photoMimeType={photoMimeType}
                onChange={(base64, mimeType) => { setPhotoBase64(base64); setPhotoMimeType(mimeType); hasUnsavedChanges.current = true; }}
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
                        key={ing.clientId}
                        draft={ing}
                        onChange={next => updateIngredient(idx, next)}
                        onRemove={() => removeIngredient(idx)}
                        hasError={ingredientErrors.has(ing.clientId)}
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
                onChange={e => { setInstructions(e.target.value); hasUnsavedChanges.current = true; }}
                placeholder="Optional. Step-by-step or free-form."
              />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => mode === 'edit' ? setReadOnly(true) : attemptClose()}>
                cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? 'saving…' : initialData ? 'save imported recipe' : mode === 'add' ? 'add recipe' : 'save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
