import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useAddInventoryItem, useUpdateInventoryItem } from '../../hooks/useInventory';
import type { InventoryRow, InventoryLocation, CanonicalUnit, CanonicalFood } from '@eat/shared';
import './ItemForm.css';

interface FormState {
  canonicalFoodId: string;
  foodName: string;
  qty: string;
  unit: CanonicalUnit;
  brand: string;
  location: InventoryLocation;
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
}

function FoodCombobox({ value, displayName, onChange }: FoodComboboxProps) {
  const [input, setInput] = useState(displayName);
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(input);
  const ref = useRef<HTMLDivElement>(null);

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
      <label className="form-label">Food *</label>
      <input
        className="form-input"
        type="text"
        placeholder="Search foods (e.g. milk, flour…)"
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
    qty: item != null ? String(item.qty) : '',
    unit: item?.unit ?? 'g',
    brand: item?.brand ?? '',
    location: item?.location ?? 'pantry',
    purchasedAt: toDateInput(item?.purchasedAt),
    expiresAt: toDateInput(item?.expiresAt),
  });

  const [error, setError] = useState('');
  const addMutation = useAddInventoryItem();
  const updateMutation = useUpdateInventoryItem(item?.id ?? '');
  const isPending = addMutation.isPending || updateMutation.isPending;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.canonicalFoodId) { setError('Please select a food.'); return; }

    const qty = parseFloat(form.qty);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be a positive number.'); return; }

    const payload = {
      qty,
      unit: form.unit,
      brand: form.brand.trim() || null,
      location: form.location,
      purchasedAt: form.purchasedAt || null,
      expiresAt: form.expiresAt || null,
    };

    try {
      if (mode === 'add') {
        await addMutation.mutateAsync({ canonicalFoodId: form.canonicalFoodId, ...payload });
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
            />
          ) : (
            <div className="form-food-display">
              <span className="form-label">Food</span>
              <span className="form-food-name">{form.foodName}</span>
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
                onChange={e => set('unit', e.target.value as CanonicalUnit)}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="count">count</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="location">Location</label>
            <select
              id="location"
              className="form-select"
              value={form.location}
              onChange={e => set('location', e.target.value as InventoryLocation)}
            >
              <option value="fridge">Fridge</option>
              <option value="pantry">Pantry</option>
              <option value="freezer">Freezer</option>
              <option value="other">Other</option>
            </select>
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
