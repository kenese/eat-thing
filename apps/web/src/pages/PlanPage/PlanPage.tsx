import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRecipes } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import {
  useMealPlanEntries,
  useAddMealPlanEntry,
  useUpdateMealPlanEntry,
  useDeleteMealPlanEntry,
} from '../../hooks/useMealPlan';
import { CookModal } from './CookModal';
import { PageTitle } from '../../components/PageTitle';
import { StatusChip } from '../../components/StatusChip';
import type { MealPlanEntry, Recipe } from '@eat/shared';
import { planWindow, planWindowDays, TODAY_INDEX } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import './PlanPage.css';

const DRAG_TYPE = 'application/x-eat-recipe-id';
const MAX_ENTRIES_PER_DAY = 4;

type DayKind = 'cook' | 'shop' | 'leftover' | 'open';

interface DayEntry {
  entry: MealPlanEntry;
  recipe: Recipe | undefined;
  missing: string[];
  kind: DayKind;
}

function DayCard({
  iso,
  label,
  isToday,
  isPast,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  entries: DayEntry[];
  onDropRecipe: (recipeId: string) => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = entries.length >= MAX_ENTRIES_PER_DAY;

  const first = entries[0];
  const followUps = entries.slice(1);
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    e.preventDefault();
    setDragOver(false);
    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) onDropRecipe(recipeId);
  }

  return (
    <div
      className={[
        'day-col',
        dragOver && 'drag-over',
        isToday && 'today',
        isPast && 'past',
      ].filter(Boolean).join(' ')}
      data-iso={iso}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        {isToday && <span className="day-col-context" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>today.</span>}
      </div>

      {first ? (
        <>
          <div className="day-col-image">
            {first.recipe?.sourceImage
              ? <img src={first.recipe.sourceImage} alt="" />
              : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
          </div>
          <div className={`day-col-name${isPast ? ' day-col-name--past' : ''}`}>{first.entry.recipeName}</div>
          <div className="day-col-meta">serves {first.entry.servings}</div>
          <StatusChip kind={kind === 'open' ? 'open' : kind} />
          {followUps.map((fu) => (
            <div key={fu.entry.id} className="day-col-extra">
              <span className={`day-col-extra-name${isPast ? ' day-col-name--past' : ''}`}>{fu.entry.recipeName}</span>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>serves {fu.entry.servings}</span>
              <div className="day-col-extra-actions">
                {!isPast && fu.entry.status === 'planned' && (
                  <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(fu.entry.id)} title="Mark cooked">✓</button>
                )}
                <button className="day-col-extra-btn" onClick={() => onDeleteEntry(fu.entry.id)} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
          {!isPast && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
              {first.entry.status === 'planned' && (
                <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(first.entry.id)} title="Mark cooked">cooked ✓</button>
              )}
              <button className="day-col-extra-btn" onClick={() => onDeleteEntry(first.entry.id)} aria-label="Remove">remove ✕</button>
              <input
                className="day-col-extra-btn"
                type="number"
                min="0"
                step="any"
                defaultValue={first.entry.servings}
                onBlur={(e) => {
                  const n = parseFloat(e.currentTarget.value);
                  if (!isNaN(n) && n > 0 && n !== first.entry.servings) {
                    onUpdateEntry(first.entry.id, { servings: n });
                  }
                }}
                style={{ width: 50, textAlign: 'right' }}
                title="Edit servings"
              />
            </div>
          )}
          {isPast && (
            <div className="day-col-cooked-label">cooked</div>
          )}
          {atCapacity && !isPast && (
            <div className="day-col-cap">max 4 recipes</div>
          )}
        </>
      ) : (
        <div className="day-col-empty">
          <div className="day-col-empty-title">open seat</div>
          {!isPast && <div className="day-col-empty-hint">+ add recipe</div>}
        </div>
      )}
    </div>
  );
}

export function PlanPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => planWindow(now), [now]);
  const days = useMemo(() => planWindowDays(now), [now]);

  const { data: entriesResp, isLoading: planLoading } = useMealPlanEntries(from, to);
  const { data: recipes = [] } = useRecipes();
  const { data: inventory = [] } = useInventory({});
  void inventory;

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
  const cookingEntry = cookingEntryId
    ? (entriesResp?.entries ?? []).find((e) => e.id === cookingEntryId) ?? null
    : null;

  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      (map[e.date] ??= []).push({
        entry: e,
        recipe: undefined,
        missing: [],
        kind: 'cook',
      });
    }
    return map;
  }, [entriesResp]);

  const shopCount = days.filter((d) =>
    !d.isPast && (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'shop'),
  ).length;

  const pantryCount = days.filter((d) =>
    !d.isPast && (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'cook'),
  ).length;

  const openCount = days.filter((d) => !d.isPast && !(entriesByDay[d.iso]?.length)).length;

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({ date, recipeId, servings: recipe?.servings ?? 1 });
  }

  const weekRef = useRef<HTMLDivElement | null>(null);
  const horizonRef = useRef<HTMLDivElement | null>(null);

  function scrollToToday() {
    if (!weekRef.current) return;
    const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
    const todayCol = cols[TODAY_INDEX];
    if (todayCol) {
      const parentLeft = weekRef.current.getBoundingClientRect().left;
      const todayLeft = todayCol.getBoundingClientRect().left;
      weekRef.current.scrollLeft += todayLeft - parentLeft;
    }
  }

  useEffect(() => {
    if (!planLoading) scrollToToday();
  }, [planLoading]);

  function scrollByColumn(dir: -1 | 1) {
    if (!weekRef.current) return;
    const col = weekRef.current.querySelector<HTMLDivElement>('.day-col');
    if (col) weekRef.current.scrollLeft += dir * (col.offsetWidth + 12);
  }

  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toLowerCase();

  return (
    <div className="plan-page">
      <PageTitle
        eyebrow={monthLabel}
        title="Plan"
        summary={
          <>
            <strong>{pantryCount} from the pantry</strong>
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{shopCount} need a shop</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {openCount} open · next 7 days
            </span>
          </>
        }
        actions={
          <div className="plan-title-controls">
            <div className="plan-scroll-btns">
              <button className="plan-scroll-btn" onClick={() => scrollByColumn(-1)} aria-label="Scroll left">←</button>
              <button className="plan-scroll-btn" onClick={scrollToToday}>today</button>
              <button className="plan-scroll-btn" onClick={() => scrollByColumn(1)} aria-label="Scroll right">→</button>
              {/* HANDOFF: load-date picker — calendar icon button is a stub; no date picker modal yet */}
              <button className="plan-scroll-btn plan-scroll-btn--stub" disabled title="Load a specific date (coming soon)">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M1 5.5h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <button
              className="btn-primary plan-add-to-list-btn"
              onClick={() => navigate('/list')}
            >
              add recipes to list
              {shopCount > 0 && (
                <span className="plan-add-to-list-count">{shopCount}</span>
              )}
            </button>
          </div>
        }
      />

      {/* Horizon strip */}
      <div className="plan-horizon" ref={horizonRef}>
        {days.map((d, i) => {
          const dayEntries = entriesByDay[d.iso] ?? [];
          const mealCount = dayEntries.length;
          const [weekday, dayNum] = d.label.split(' ');
          return (
            <button
              key={d.iso}
              className={[
                'horizon-pill',
                d.isToday && 'horizon-pill--today',
                d.isPast && 'horizon-pill--past',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!weekRef.current) return;
                const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
                const target = cols[i];
                if (target) {
                  const parentLeft = weekRef.current.getBoundingClientRect().left;
                  const targetLeft = target.getBoundingClientRect().left;
                  weekRef.current.scrollLeft += targetLeft - parentLeft;
                }
              }}
            >
              <span className="horizon-pill-day">{weekday}</span>
              <span className="horizon-pill-num">{dayNum}</span>
              {mealCount > 1 ? (
                <span className="horizon-pill-multi">{mealCount}×</span>
              ) : mealCount === 1 ? (
                <span className="horizon-pill-dot" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Day grid */}
      {planLoading && <p className="plan-status">Loading…</p>}
      <div className="plan-week-scroll" ref={weekRef}>
        <div className="plan-week-rail">
          {!planLoading && days.map((d) => (
            <DayCard
              key={d.iso}
              iso={d.iso}
              label={d.label}
              isToday={d.isToday}
              isPast={d.isPast}
              entries={entriesByDay[d.iso] ?? []}
              onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
              onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
              onDeleteEntry={(id) => deleteEntry.mutate(id)}
              onMarkCookedEntry={(id) => setCookingEntryId(id)}
            />
          ))}
        </div>
      </div>

      {/* Recipe drag grid — full width below day grid */}
      <section className="plan-recipe-section">
        <div className="plan-recipe-section-header">
          Recipes<span className="dot">.</span>
          <span className="plan-recipe-section-hint">drag onto a day</span>
        </div>
        <div className="plan-recipe-grid">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="plan-recipe-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, r.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="plan-recipe-name">{r.name}</span>
              <span className="plan-recipe-meta">{r.servings} serv</span>
            </div>
          ))}
        </div>
      </section>

      {cookingEntry && (
        <CookModal
          mealPlanEntryId={cookingEntry.id}
          recipeName={cookingEntry.recipeName}
          onClose={() => setCookingEntryId(null)}
        />
      )}
    </div>
  );
}
