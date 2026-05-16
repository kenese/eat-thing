import { useMemo, useState, useEffect } from 'react';
import { useMealPlanEntries } from '../../hooks/useMealPlan';
import { useApplyPlanToShoppingList } from '../../hooks/useShoppingList';
import { addDays, toIsoDate } from '../../lib/dateUtils';
import type { MealPlanEntry } from '@eat/shared';
import './AddFromPlanModal.css';

export interface AddFromPlanModalProps {
  currentListRecipeIds: Set<string>;
  onClose: () => void;
}

type DayGroup = { date: string; entries: MealPlanEntry[]; label: string };

function isoFromDays(now: Date, offset: number): string {
  return toIsoDate(addDays(now, offset));
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AddFromPlanModal({ currentListRecipeIds, onClose }: AddFromPlanModalProps) {
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => isoFromDays(now, 0), [now]);
  const to = useMemo(() => isoFromDays(now, 14), [now]);

  const { data: entriesResp, isLoading } = useMealPlanEntries(from, to);
  const applyMut = useApplyPlanToShoppingList();

  const dayGroups: DayGroup[] = useMemo(() => {
    const byDate: Record<string, MealPlanEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      (byDate[e.date] ??= []).push(e);
    }
    return Object.keys(byDate)
      .sort()
      .map((date) => ({ date, entries: byDate[date], label: formatDayLabel(date) }));
  }, [entriesResp]);

  // Pre-tick: a day is ticked if every entry's recipeId is in currentListRecipeIds.
  const [tickedDays, setTickedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initial = new Set<string>();
    for (const g of dayGroups) {
      if (g.entries.every((e) => currentListRecipeIds.has(e.recipeId))) {
        initial.add(g.date);
      }
    }
    setTickedDays(initial);
  }, [dayGroups, currentListRecipeIds]);

  function toggleDay(date: string) {
    setTickedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function handleSubmit() {
    const entryIds: string[] = [];
    for (const g of dayGroups) {
      if (tickedDays.has(g.date)) {
        for (const e of g.entries) entryIds.push(e.id);
      }
    }
    await applyMut.mutateAsync({ entryIds });
    onClose();
  }

  return (
    <div className="afp-overlay" role="dialog" aria-modal="true">
      <div className="afp-panel">
        <div className="afp-header">
          <h2 className="afp-title">Add from planned recipes</h2>
          <button className="afp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {isLoading && <p className="afp-status">Loading…</p>}

        {!isLoading && dayGroups.length === 0 && (
          <p className="afp-empty">No planned recipes in the next 2 weeks. Add recipes to your plan first.</p>
        )}

        {!isLoading && dayGroups.length > 0 && (
          <ul className="afp-list">
            {dayGroups.map((g) => {
              const summary = g.entries.length === 1
                ? g.entries[0].recipeName
                : `${g.entries.length} recipes`;
              const id = `afp-${g.date}`;
              return (
                <li key={g.date} className="afp-row">
                  <input
                    id={id}
                    type="checkbox"
                    checked={tickedDays.has(g.date)}
                    onChange={() => toggleDay(g.date)}
                    aria-label={summary}
                  />
                  <label htmlFor={id} className="afp-label">
                    <span className="afp-date">{g.label}</span>
                    <span className="afp-summary">{summary}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="afp-actions">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={applyMut.isPending || isLoading}
          >
            {applyMut.isPending ? 'Updating…' : 'Update list'}
          </button>
        </div>
      </div>
    </div>
  );
}
