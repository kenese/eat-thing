import React, { useState } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useStaples, useCreateStaple, useDeleteStaple } from '../../hooks/useStaples';
import type { CanonicalUnit } from '@eat/shared';

interface Props {
  onClose: () => void;
}

export function StaplesModal({ onClose }: Props) {
  const { data: staples = [], isLoading } = useStaples();
  const createStaple = useCreateStaple();
  const deleteStaple = useDeleteStaple();

  const [foodQuery, setFoodQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<{ id: string; name: string; defaultUnit: CanonicalUnit } | null>(null);
  const [thresholdQty, setThresholdQty] = useState('');
  const [thresholdUnit, setThresholdUnit] = useState<CanonicalUnit>('g');
  const [formError, setFormError] = useState('');

  const { data: foodSuggestions = [] } = useFoodSearch(foodQuery);

  function handleSelectFood(food: { id: string; name: string; defaultUnit: CanonicalUnit }) {
    setSelectedFood(food);
    setFoodQuery(food.name);
    setThresholdUnit(food.defaultUnit);
  }

  async function handleAdd() {
    if (!selectedFood) { setFormError('Select a food'); return; }
    const qty = parseFloat(thresholdQty);
    if (isNaN(qty) || qty <= 0) { setFormError('Enter a positive quantity'); return; }
    setFormError('');
    try {
      await createStaple.mutateAsync({ canonicalFoodId: selectedFood.id, thresholdQty: qty, thresholdUnit });
      setFoodQuery('');
      setSelectedFood(null);
      setThresholdQty('');
    } catch {
      setFormError('Failed to add staple');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage staples</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="staples-modal-body">
          {isLoading && <p className="staples-loading">Loading…</p>}

          {staples.length > 0 && (
            <ul className="staples-list">
              {staples.map(s => (
                <li key={s.id} className="staples-item">
                  <span className="staples-name">{s.foodName}</span>
                  <span className="staples-threshold">{s.thresholdQty} {s.thresholdUnit}</span>
                  <button
                    className="staples-delete"
                    onClick={() => deleteStaple.mutate(s.id)}
                    aria-label={`Delete ${s.foodName}`}
                    disabled={deleteStaple.isPending}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {staples.length === 0 && !isLoading && (
            <p className="staples-empty">No staples yet. Add items you always want to have on hand.</p>
          )}

          <div className="staples-add-form">
            <h3>Add staple</h3>
            <div className="food-combobox">
              <input
                className="form-input"
                placeholder="Search food…"
                value={foodQuery}
                onChange={e => { setFoodQuery(e.target.value); setSelectedFood(null); }}
              />
              {foodSuggestions.length > 0 && !selectedFood && (
                <ul className="food-dropdown">
                  {foodSuggestions.map(f => (
                    <li key={f.id} onClick={() => handleSelectFood(f)} className="food-option">
                      <span>{f.name}</span>
                      <span className="food-option-unit">{f.defaultUnit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-row staples-qty-row">
              <input
                className="form-input"
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={thresholdQty}
                onChange={e => setThresholdQty(e.target.value)}
              />
              <select
                className="form-select"
                value={thresholdUnit}
                onChange={e => setThresholdUnit(e.target.value as CanonicalUnit)}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="count">count</option>
              </select>
              <button
                className="btn-primary"
                onClick={handleAdd}
                disabled={createStaple.isPending}
              >
                Add
              </button>
            </div>
            {formError && <p className="form-error">{formError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
