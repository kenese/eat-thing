import React, { useState } from 'react';
import { useCookPreview, useCreateCookEvent } from '../../hooks/useCookEvents';
import type { CookDeduction, CookPromptResponse } from '@eat/shared';
import './CookModal.css';

interface Props {
  mealPlanEntryId: string;
  recipeName: string;
  weekStart: string;
  onClose: () => void;
}

export function CookModal({ mealPlanEntryId, recipeName, weekStart, onClose }: Props) {
  const { data: preview, isLoading, error } = useCookPreview(mealPlanEntryId);
  const createCookEvent = useCreateCookEvent(weekStart);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="cook-modal" onClick={e => e.stopPropagation()}>
          <p className="cook-modal-loading">Calculating deductions…</p>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="cook-modal" onClick={e => e.stopPropagation()}>
          <p className="cook-modal-error">Could not load cook preview. Try again.</p>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const allPromptsAnswered = preview.prompts.every(p => (promptAnswers[p.canonicalFoodId] ?? '').trim().length > 0);

  async function handleConfirm() {
    if (!preview) return;
    const promptResponses: CookPromptResponse[] = preview.prompts.map(p => ({
      question: p.question,
      answer: promptAnswers[p.canonicalFoodId] ?? '',
      inventoryItemId: p.inventoryItemId,
    }));
    await createCookEvent.mutateAsync({
      mealPlanEntryId,
      recipeId: preview.recipeId,
      servings: preview.servings,
      deductions: preview.deductions,
      promptResponses,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cook-modal" onClick={e => e.stopPropagation()}>
        <div className="cook-modal-header">
          <h2>Mark "{recipeName}" cooked</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {preview.prompts.length > 0 && (
          <div className="cook-modal-prompts">
            <p className="cook-modal-section-label">A few quick questions</p>
            {preview.prompts.map(p => (
              <div key={p.canonicalFoodId} className="cook-prompt">
                <label className="cook-prompt-question">{p.question}</label>
                <input
                  className="form-input"
                  placeholder="e.g. 3 cloves, 50g, half a bulb…"
                  value={promptAnswers[p.canonicalFoodId] ?? ''}
                  onChange={e => setPromptAnswers(prev => ({ ...prev, [p.canonicalFoodId]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="cook-modal-deductions">
          <p className="cook-modal-section-label">
            {preview.deductions.length > 0 ? 'Will deduct from inventory' : 'Nothing to deduct from inventory'}
          </p>
          {preview.deductions.length > 0 && (
            <ul className="cook-deduction-list">
              {preview.deductions.map((d: CookDeduction) => (
                <li key={d.inventoryItemId} className="cook-deduction-item">
                  <span className="cook-deduction-name">{d.foodName}</span>
                  <span className="cook-deduction-qty">−{Math.round(d.qty * 10) / 10} {d.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cook-modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!allPromptsAnswered || createCookEvent.isPending}
          >
            {createCookEvent.isPending ? 'Saving…' : 'Mark cooked'}
          </button>
        </div>
      </div>
    </div>
  );
}
