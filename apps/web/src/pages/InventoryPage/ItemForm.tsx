import React, { useState, useEffect, useRef, useId } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useAddInventoryItem, useUpdateInventoryItem } from '../../hooks/useInventory';
import { useCreateFood } from '../../hooks/useFoodSearch';
import { getTaxonomyReviewRequiredResponse } from '../../api/client';
import type { InventoryRow, CanonicalFood, TaxonomyReviewRequiredResponse } from '@eat/shared';
import { CATEGORY_ORDER, CATEGORY_LABEL } from '@eat/taxonomy';
import type { Category } from '@eat/taxonomy';
import './ItemForm.css';

interface FormState {
  canonicalFoodId: string;
  foodName: string;
  category: Category;
  qty: string;
  unit: string;
  brand: string;
  purchasedAt: string;
  expiresAt: string;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

interface FoodComboboxProps {
  value: string;
  displayName: string;
  onChange: (food: CanonicalFood) => void;
  onTextChange: (text: string) => void;
}

function FoodCombobox({ value, displayName, onChange, onTextChange }: FoodComboboxProps) {
  const [input, setInput] = useState(displayName);
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(input);
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => { setInput(displayName); }, [displayName]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="food-combobox" ref={ref}>
      <label className="form-label" htmlFor={inputId}>Food *</label>
      <input
        id={inputId}
        className="form-input"
        type="text"
        placeholder="Search or type a new food name…"
        value={input}
        autoComplete="off"
        onChange={e => {
          setInput(e.target.value);
          setOpen(true);
          onTextChange(e.target.value);
        }}
        onFocus={() => { if (input.trim()) setOpen(true); }}
      />
      {open && results.length > 0 && (
        <ul className="food-dropdown" role="listbox">
          {results.map(food => (
            <li
              key={food.id}
              role="option"
              aria-selected={food.id === value}
              className={`food-option${food.id === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(food); setInput(food.name); setOpen(false); }}
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

interface ItemFormProps {
  mode: 'add' | 'edit';
  item?: InventoryRow;
  onClose: () => void;
}

export function ItemForm({ mode, item, onClose }: ItemFormProps) {
  const [form, setForm] = useState<FormState>({
    canonicalFoodId: item?.canonicalFoodId ?? '',
    foodName: item?.foodName ?? '',
    category: (item?.category as Category) ?? 'other',
    qty: item != null ? String(item.qty) : '',
    unit: item?.unit ?? 'g',
    brand: item?.brand ?? '',
    purchasedAt: toDateInput(item?.purchasedAt),
    expiresAt: toDateInput(item?.expiresAt),
  });

  const [error, setError] = useState('');
  const [review, setReview] = useState<TaxonomyReviewRequiredResponse | null>(null);
  const addMutation = useAddInventoryItem();
  const updateMutation = useUpdateInventoryItem(item?.id ?? '');
  const createFood = useCreateFood();
  const isPending = addMutation.isPending || updateMutation.isPending;

  const isNewFood = mode === 'add' && !form.canonicalFoodId;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function inventoryPayload(qty: number, canonicalFoodId?: string) {
    if (canonicalFoodId) {
      return {
        canonicalFoodId,
        qty,
        unit: form.unit,
        brand: form.brand.trim() || null,
        purchasedAt: form.purchasedAt || null,
        expiresAt: form.expiresAt || null,
      };
    }
    return {
      foodName: form.foodName.trim(),
      category: form.category,
      qty,
      unit: form.unit,
      brand: form.brand.trim() || null,
      purchasedAt: form.purchasedAt || null,
      expiresAt: form.expiresAt || null,
    };
  }

  async function submitReviewedFood(canonicalFoodId: string) {
    const qty = parseFloat(form.qty);
    await addMutation.mutateAsync(inventoryPayload(qty, canonicalFoodId));
    setReview(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setReview(null);

    if (!form.foodName.trim()) { setError('Please enter or select a food.'); return; }
    if (isNewFood && !form.category) { setError('Please select a category.'); return; }

    const qty = parseFloat(form.qty);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be a positive number.'); return; }

    try {
      if (mode === 'add') {
        await addMutation.mutateAsync(inventoryPayload(qty, form.canonicalFoodId || undefined));
      } else {
        await updateMutation.mutateAsync({
          qty,
          unit: form.unit,
          brand: form.brand.trim() || null,
          purchasedAt: form.purchasedAt || null,
          expiresAt: form.expiresAt || null,
        });
      }
      onClose();
    } catch (err: unknown) {
      const taxonomyReview = getTaxonomyReviewRequiredResponse(err);
      if (taxonomyReview) {
        setReview(taxonomyReview);
        return;
      }
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
          <h2>{mode === 'add' ? 'Add item' : 'Edit item'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="item-form" onSubmit={handleSubmit} noValidate>
          {mode === 'add' ? (
            <FoodCombobox
              value={form.canonicalFoodId}
              displayName={form.foodName}
              onChange={food => setForm(f => ({
                ...f,
                canonicalFoodId: food.id,
                foodName: food.name,
                unit: food.defaultUnit,
              }))}
              onTextChange={text => setForm(f => ({
                ...f,
                foodName: text,
                canonicalFoodId: '',
              }))}
            />
          ) : (
            <div className="form-food-display">
              <span className="form-label">Food</span>
              <span className="form-food-name">{form.foodName}</span>
            </div>
          )}

          {isNewFood && (
            <div className="form-field">
              <label className="form-label" htmlFor="category">Category *</label>
              <select
                id="category"
                className="form-select"
                value={form.category}
                onChange={e => {
                  setReview(null);
                  set('category', e.target.value as Category);
                }}
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="qty">Quantity *</label>
              <input
                id="qty"
                className="form-input"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 500"
                value={form.qty}
                onChange={e => set('qty', e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="unit">Unit</label>
              <select
                id="unit"
                className="form-select"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="count">count</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="brand">Brand</label>
            <input
              id="brand"
              className="form-input"
              type="text"
              placeholder="Optional"
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="purchasedAt">Purchased</label>
              <input
                id="purchasedAt"
                className="form-input"
                type="date"
                value={form.purchasedAt}
                onChange={e => set('purchasedAt', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="expiresAt">Expires</label>
              <input
                id="expiresAt"
                className="form-input"
                type="date"
                value={form.expiresAt}
                onChange={e => set('expiresAt', e.target.value)}
              />
            </div>
          </div>

          {review && (
            <div className="form-field">
              <p className="form-error" role="alert">Review this new canonical food before saving.</p>
              {review.matches.length > 0 && (
                <div className="form-field">
                  {review.matches.map(match => (
                    <button
                      key={match.id}
                      type="button"
                      className="btn-secondary"
                      onClick={() => submitReviewedFood(match.id)}
                      disabled={isPending || createFood.isPending}
                    >
                      Use existing: {match.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={isPending || createFood.isPending}
                onClick={async () => {
                  try {
                    const created = await createFood.mutateAsync(review.proposed);
                    await submitReviewedFood(created.id);
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Something went wrong.');
                  }
                }}
              >
                {createFood.isPending ? 'Creating…' : `Create canonical food: ${review.proposed.name}`}
              </button>
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'add' ? 'Add item' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
