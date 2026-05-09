import React, { useState, useMemo } from 'react';
import { useRecipes } from '../../hooks/useRecipes';
import {
  useMealPlanWeek,
  useAddMealPlanEntry,
  useUpdateMealPlanEntry,
  useDeleteMealPlanEntry,
} from '../../hooks/useMealPlan';
import { CookModal } from './CookModal';
import type { MealPlanEntry, RecipeSummary } from '@eat/shared';
import { mondayOf, addDays, toIsoDate, weekDays, formatWeekRange } from './dateUtils';
import './PlanPage.css';

const DRAG_TYPE = 'application/x-eat-recipe-id';

interface DayColumnProps {
  iso: string;
  label: string;
  entries: MealPlanEntry[];
  onDropRecipe: (recipeId: string) => void;
  onPickRecipe: () => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
  isToday: boolean;
}

function DayColumn({ iso, label, entries, onDropRecipe, onPickRecipe, onUpdateEntry, onDeleteEntry, onMarkCookedEntry, isToday }: DayColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) onDropRecipe(recipeId);
  }

  return (
    <div
      className={`day-col${dragOver ? ' drag-over' : ''}${isToday ? ' today' : ''}`}
      data-iso={iso}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        <button className="day-col-add" onClick={onPickRecipe} aria-label={`Add to ${label}`}>+</button>
      </div>
      <div className="day-col-entries">
        {entries.map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onChange={patch => onUpdateEntry(entry.id, patch)}
            onDelete={() => onDeleteEntry(entry.id)}
            onMarkCooked={() => onMarkCookedEntry(entry.id)}
          />
        ))}
        {entries.length === 0 && <div className="day-col-empty">Drop a recipe here</div>}
      </div>
    </div>
  );
}

interface EntryCardProps {
  entry: MealPlanEntry;
  onChange: (patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDelete: () => void;
  onMarkCooked: () => void;
}

function EntryCard({ entry, onChange, onDelete, onMarkCooked }: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [servingsInput, setServingsInput] = useState(String(entry.servings));

  function commitServings() {
    const n = parseFloat(servingsInput);
    if (!isNaN(n) && n > 0 && n !== entry.servings) {
      onChange({ servings: n });
    } else {
      setServingsInput(String(entry.servings));
    }
    setEditing(false);
  }

  return (
    <div className={`entry-card status-${entry.status}`}>
      <div className="entry-card-name">{entry.recipeName}</div>
      <div className="entry-card-row">
        {editing ? (
          <input
            className="entry-servings-input"
            type="number"
            step="any"
            min="0"
            value={servingsInput}
            autoFocus
            onChange={e => setServingsInput(e.target.value)}
            onBlur={commitServings}
            onKeyDown={e => { if (e.key === 'Enter') commitServings(); if (e.key === 'Escape') { setEditing(false); setServingsInput(String(entry.servings)); } }}
          />
        ) : (
          <button className="entry-servings" onClick={() => setEditing(true)} title="Edit servings">
            {entry.servings} {entry.servings === 1 ? 'serving' : 'servings'}
          </button>
        )}
        {entry.status === 'planned' && (
          <button className="entry-cook" onClick={onMarkCooked} title="Mark cooked">✓</button>
        )}
        <button className="entry-delete" onClick={onDelete} aria-label="Remove">✕</button>
      </div>
    </div>
  );
}

interface RecipeListProps {
  recipes: RecipeSummary[];
  isLoading: boolean;
  onDayPick: (recipeId: string) => void;
  pendingDayPick: string | null;
}

function RecipeList({ recipes, isLoading, onDayPick, pendingDayPick }: RecipeListProps) {
  if (isLoading) return <p className="plan-status">Loading recipes…</p>;
  if (recipes.length === 0) {
    return <p className="plan-status empty">No recipes yet. Add one on the Recipes tab.</p>;
  }

  return (
    <ul className="plan-recipe-list">
      {recipes.map(r => (
        <li
          key={r.id}
          className="plan-recipe-item"
          draggable
          onDragStart={e => {
            e.dataTransfer.setData(DRAG_TYPE, r.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => pendingDayPick && onDayPick(r.id)}
        >
          <span className="plan-recipe-name">{r.name}</span>
          <span className="plan-recipe-meta">{r.servings} serv</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanPage() {
  const [weekStartDate, setWeekStartDate] = useState(() => mondayOf(new Date()));
  const weekStart = toIsoDate(weekStartDate);
  const todayIso = toIsoDate(new Date());

  const days = useMemo(() => weekDays(weekStartDate), [weekStartDate]);

  const { data: week, isLoading: planLoading } = useMealPlanWeek(weekStart);
  const { data: recipes = [], isLoading: recipesLoading } = useRecipes();

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry(weekStart);
  const deleteEntry = useDeleteMealPlanEntry(weekStart);

  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);

  const cookingEntry = cookingEntryId
    ? (week?.entries ?? []).find(e => e.id === cookingEntryId) ?? null
    : null;

  const entriesByDay = useMemo(() => {
    const map: Record<string, MealPlanEntry[]> = {};
    for (const e of week?.entries ?? []) {
      (map[e.date] ??= []).push(e);
    }
    return map;
  }, [week]);

  function handleDropRecipe(date: string, recipeId: string) {
    const recipe = recipes.find(r => r.id === recipeId);
    addEntry.mutate({
      weekStart,
      date,
      recipeId,
      servings: recipe?.servings ?? 1,
    });
    setPendingDay(null);
  }

  function handlePickFromList(recipeId: string) {
    if (!pendingDay) return;
    handleDropRecipe(pendingDay, recipeId);
  }

  return (
    <div className="plan-page">
      <div className="plan-header">
        <button className="plan-nav" onClick={() => setWeekStartDate(d => addDays(d, -7))} aria-label="Previous week">‹</button>
        <div className="plan-header-center">
          <h1>Meal plan</h1>
          <span className="plan-week-range">{formatWeekRange(weekStartDate)}</span>
        </div>
        <button className="plan-nav" onClick={() => setWeekStartDate(d => addDays(d, 7))} aria-label="Next week">›</button>
      </div>

      <div className="plan-body">
        <aside className={`plan-sidebar${pendingDay ? ' picking' : ''}`}>
          <div className="plan-sidebar-header">
            <h2>Recipes</h2>
            {pendingDay && (
              <button className="plan-cancel-pick" onClick={() => setPendingDay(null)}>Cancel</button>
            )}
          </div>
          {pendingDay && (
            <p className="plan-pick-hint">Tap a recipe to add it to {pendingDay}.</p>
          )}
          {!pendingDay && recipes.length > 0 && (
            <p className="plan-pick-hint subtle">Drag onto a day, or tap + on a day first.</p>
          )}
          <RecipeList
            recipes={recipes}
            isLoading={recipesLoading}
            onDayPick={handlePickFromList}
            pendingDayPick={pendingDay}
          />
        </aside>

        <div className="plan-week">
          {planLoading && <p className="plan-status">Loading…</p>}
          {!planLoading && days.map(d => (
            <DayColumn
              key={d.iso}
              iso={d.iso}
              label={d.label}
              entries={entriesByDay[d.iso] ?? []}
              isToday={d.iso === todayIso}
              onDropRecipe={recipeId => handleDropRecipe(d.iso, recipeId)}
              onPickRecipe={() => setPendingDay(d.iso)}
              onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
              onDeleteEntry={id => deleteEntry.mutate(id)}
              onMarkCookedEntry={id => setCookingEntryId(id)}
            />
          ))}
        </div>
      </div>

      {cookingEntry && (
        <CookModal
          mealPlanEntryId={cookingEntry.id}
          recipeName={cookingEntry.recipeName}
          weekStart={weekStart}
          onClose={() => setCookingEntryId(null)}
        />
      )}
    </div>
  );
}
