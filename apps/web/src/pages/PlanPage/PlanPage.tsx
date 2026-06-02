import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useRecipes } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import {
  useMealPlanEntries,
  useAddMealPlanEntry,
  useUpdateMealPlanEntry,
  useDeleteMealPlanEntry,
} from '../../hooks/useMealPlan';
import { CookModal } from './CookModal';
import { RecipeForm } from '../RecipesPage/RecipeForm';
import { PageTitle } from '../../components/PageTitle';
import { StatusChip } from '../../components/StatusChip';
import type { MealPlanEntry, Recipe } from '@eat/shared';
import { computeMissing } from '../../lib/recipeMatch';
import { api } from '../../api/client';
import { planWindow, planWindowDays, TODAY_INDEX } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import './PlanPage.css';

const DRAG_TYPE = 'application/x-eat-recipe-id';
const DRAG_ENTRY_TYPE = 'application/x-eat-entry-id';
const DRAG_ENTRY_DATE_TYPE = 'application/x-eat-entry-date';
const MAX_ENTRIES_PER_DAY = 4;

type DayKind = 'cook' | 'shop' | 'leftover' | 'open';

interface DayEntry {
  entry: MealPlanEntry;
  missingNames: string[];
  kind: DayKind;
  totalTimeMinutes: number | null;
  sourceImage: string | null;
}

function MealRow({
  de,
  dark,
  isPast,
  onMarkCooked,
  onDelete,
  onOpenRecipe,
}: {
  de: DayEntry;
  dark: boolean;
  isPast: boolean;
  onMarkCooked: () => void;
  onDelete: () => void;
  onOpenRecipe: () => void;
}) {
  return (
    <div className="day-col-extra">
      <div className="day-col-extra-body">
        <button className={`day-col-extra-name day-col-recipe-link${isPast ? ' day-col-name--past' : ''}`} onClick={onOpenRecipe}>{de.entry.recipeName}</button>
        {de.missingNames.length > 0 ? (
          <span className="day-col-need" style={{ color: dark ? 'rgba(243,245,242,0.7)' : undefined }}>
            need {de.missingNames[0]}{de.missingNames.length > 1 ? ` & ${de.missingNames.length - 1} more` : ''}
          </span>
        ) : de.totalTimeMinutes ? (
          <span className="day-col-extra-meta">{de.totalTimeMinutes}m · serves {de.entry.servings}</span>
        ) : (
          <span className="day-col-extra-meta">serves {de.entry.servings}</span>
        )}
      </div>
      <StatusChip kind={de.kind === 'open' ? 'open' : de.kind} />
      <div className="day-col-extra-actions">
        {!isPast && de.entry.status === 'planned' && (
          <button className="day-col-extra-btn" onClick={onMarkCooked} title="Mark cooked">✓</button>
        )}
        <button className="day-col-extra-btn" onClick={onDelete} aria-label="Remove">✕</button>
      </div>
    </div>
  );
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
  onMoveEntry,
  onOpenRecipe,
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
  onMoveEntry: (entryId: string) => void;
  onOpenRecipe: (recipeId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = entries.length >= MAX_ENTRIES_PER_DAY;

  const first = entries[0];
  const followUps = entries.slice(1);
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes(DRAG_ENTRY_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_TYPE) ? 'copy' : 'move';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
    if (atCapacity || isPast) return;
    e.preventDefault();
    setDragOver(false);

    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) { onDropRecipe(recipeId); return; }

    const entryId = e.dataTransfer.getData(DRAG_ENTRY_TYPE);
    const sourceDate = e.dataTransfer.getData(DRAG_ENTRY_DATE_TYPE);
    if (entryId && sourceDate !== iso) {
      onMoveEntry(entryId);
    }
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
          {isPast ? (
            /* Past day — no image, checkmark + line-through name + cooked footer */
            <div className="day-col-past-body">
              <div className="day-col-past-name-row">
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M2 6.5L4.5 9L10 3.5" stroke="var(--fresh)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <button className="day-col-name day-col-name--past day-col-recipe-link" onClick={() => onOpenRecipe(first.entry.recipeId)}>{first.entry.recipeName}</button>
              </div>
              <div style={{ flex: 1 }} />
              <div className="day-col-cooked-label">
                cooked{first.totalTimeMinutes ? ` · ${first.totalTimeMinutes}m` : ''}
              </div>
            </div>
          ) : (
            <>
              <div
                className="day-col-drag-handle"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_ENTRY_TYPE, first.entry.id);
                  e.dataTransfer.setData(DRAG_ENTRY_DATE_TYPE, iso);
                  e.dataTransfer.effectAllowed = 'move';
                  e.stopPropagation();
                }}
              >
                <div className="day-col-image">
                  {first.sourceImage
                    ? <img src={first.sourceImage} alt="" />
                    : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
                </div>
                <button className="day-col-name day-col-recipe-link" onClick={(e) => { e.stopPropagation(); onOpenRecipe(first.entry.recipeId); }}>{first.entry.recipeName}</button>
              </div>

              {first.missingNames.length > 0 && (
                <div className="day-col-need">
                  need {first.missingNames.slice(0, 2).join(', ')}
                  {first.missingNames.length > 2 ? ` & ${first.missingNames.length - 2} more` : ''}
                </div>
              )}

              {followUps.map((fu) => (
                <MealRow
                  key={fu.entry.id}
                  de={fu}
                  dark={isToday}
                  isPast={false}
                  onMarkCooked={() => onMarkCookedEntry(fu.entry.id)}
                  onDelete={() => onDeleteEntry(fu.entry.id)}
                  onOpenRecipe={() => onOpenRecipe(fu.entry.recipeId)}
                />
              ))}

              <div style={{ flex: 1 }} />

              <div className="day-col-meta">
                {first.totalTimeMinutes && (
                  <><span style={{ fontVariantNumeric: 'tabular-nums' }}>{first.totalTimeMinutes}m</span><span style={{ opacity: 0.5, margin: '0 5px' }}>·</span></>
                )}
                serves {first.entry.servings}
              </div>
              <StatusChip kind={kind === 'open' ? 'open' : kind} />

              <div className="day-col-primary-actions">
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
            </>
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

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null);
  const cookingEntry = cookingEntryId
    ? (entriesResp?.entries ?? []).find((e) => e.id === cookingEntryId) ?? null
    : null;

  const recipeById = useMemo(() => {
    const m = new Map(recipes.map((r) => [r.id, r]));
    return m;
  }, [recipes]);

  // Fetch full Recipe objects (with ingredients) for each unique recipe in the plan.
  // Mirrors the Home page pattern so computeMissing can return ingredient names.
  const uniqueRecipeIds = useMemo(
    () => [...new Set((entriesResp?.entries ?? []).map((e) => e.recipeId))],
    [entriesResp],
  );
  const recipeDetailQueries = useQueries({
    queries: uniqueRecipeIds.map((id) => ({
      queryKey: ['recipe', id],
      queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
    })),
  });
  const fullRecipeById = useMemo(() => {
    const m = new Map<string, Recipe>();
    recipeDetailQueries.forEach((q, i) => {
      if (q.data) m.set(uniqueRecipeIds[i], q.data);
    });
    return m;
  }, [recipeDetailQueries, uniqueRecipeIds]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      const summary = recipeById.get(e.recipeId);
      const full = fullRecipeById.get(e.recipeId);
      const missingNames = full ? computeMissing(full, inventory) : [];
      const kind: DayKind = e.status === 'cooked' ? 'cook' : missingNames.length > 0 ? 'shop' : 'cook';
      (map[e.date] ??= []).push({
        entry: e,
        missingNames,
        kind,
        totalTimeMinutes: summary?.totalTimeMinutes ?? null,
        sourceImage: summary?.sourceImage ?? null,
      });
    }
    return map;
  }, [entriesResp, recipeById, fullRecipeById, inventory]);

  // Summary counts for the next 7 days only (per spec "next 7 days" caption)
  const todayIdx = days.findIndex((d) => d.isToday);
  const next7 = days.slice(todayIdx, todayIdx + 7);

  const shopCount = next7.filter((d) =>
    (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'shop'),
  ).length;

  const pantryCount = next7.filter((d) =>
    (entriesByDay[d.iso] ?? []).some((de) => de.kind === 'cook'),
  ).length;

  const openCount = next7.filter((d) => !(entriesByDay[d.iso]?.length)).length;

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({ date, recipeId, servings: recipe?.servings ?? 1 });
  }

  function handleMoveEntry(entryId: string, targetDate: string) {
    updateEntry.mutate({ id: entryId, date: targetDate });
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
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>→</span>
            </button>
          </div>
        }
      />

      {/* Horizon strip header + legend */}
      <div className="plan-horizon-header">
        <div className="plan-horizon-eyebrow">
          {days.length}-day horizon
        </div>
        <div className="plan-horizon-legend">
          {([
            ['cook now',    pantryCount, 'var(--fresh)',     false],
            ['needs shop',  shopCount,   'var(--persimmon)', false],
            ['open',        openCount,   'var(--mute)',      true],
          ] as [string, number, string, boolean][]).map(([lbl, n, color, dashed]) => (
            <div key={lbl} className="plan-horizon-legend-item">
              <span className="plan-horizon-legend-dot" style={{
                background: dashed ? 'transparent' : color,
                border: dashed ? `1.5px dashed ${color}` : 'none',
              }} />
              <span>{lbl}</span>
              <span className="plan-horizon-legend-count">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Horizon strip */}
      <div
        className="plan-horizon"
        ref={horizonRef}
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
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
              onMoveEntry={(entryId) => handleMoveEntry(entryId, d.iso)}
              onOpenRecipe={(recipeId) => setViewRecipeId(recipeId)}
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
              <button className="plan-recipe-name day-col-recipe-link" onClick={() => setViewRecipeId(r.id)}>{r.name}</button>
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

      {viewRecipeId && (
        <RecipeForm
          mode="edit"
          recipeId={viewRecipeId}
          onClose={() => setViewRecipeId(null)}
        />
      )}
    </div>
  );
}
