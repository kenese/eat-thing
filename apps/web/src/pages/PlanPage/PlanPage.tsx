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
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  iso: string;
  label: string;
  isToday: boolean;
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
    if (atCapacity) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
    if (atCapacity) return;
    e.preventDefault();
    setDragOver(false);
    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) onDropRecipe(recipeId);
  }

  return (
    <div
      className={`day-col${dragOver ? ' drag-over' : ''}${isToday ? ' today' : ''}`}
      data-iso={iso}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        {isToday && <span className="day-col-context">today</span>}
      </div>

      {first ? (
        <>
          <div className="day-col-image">
            {first.recipe?.sourceImage
              ? <img src={first.recipe.sourceImage} alt="" />
              : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
          </div>
          <div className="day-col-name">{first.entry.recipeName}</div>
          <div className="day-col-meta">serves {first.entry.servings}</div>
          <StatusChip kind={kind === 'open' ? 'open' : kind} />
          {followUps.map((fu) => (
            <div key={fu.entry.id} className="day-col-extra">
              <span className="day-col-extra-name">{fu.entry.recipeName}</span>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>serves {fu.entry.servings}</span>
              <div className="day-col-extra-actions">
                {fu.entry.status === 'planned' && (
                  <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(fu.entry.id)} title="Mark cooked">✓</button>
                )}
                <button className="day-col-extra-btn" onClick={() => onDeleteEntry(fu.entry.id)} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
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
          {atCapacity && (
            <div className="day-col-cap">max 4 recipes</div>
          )}
        </>
      ) : (
        <div className="day-col-empty">
          <div className="day-col-empty-title">open seat</div>
          <div className="day-col-empty-hint">drop a recipe</div>
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
  void inventory; // reserved for richer per-day cook/shop bucketing once recipe ingredients are fetched per-entry

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

  const totals = useMemo(() => {
    const pantryDays = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'cook')).length;
    const shopDays   = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'shop')).length;
    const leftoverDays = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'leftover')).length;
    const openDays   = days.filter((d) => !(entriesByDay[d.iso]?.length)).length;
    return { pantryDays, shopDays, leftoverDays, openDays };
  }, [entriesByDay, days]);

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({
      date,
      recipeId,
      servings: recipe?.servings ?? 1,
    });
  }

  // Scroll today into position 3 on mount.
  const weekRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!weekRef.current || planLoading) return;
    const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
    const todayCol = cols[TODAY_INDEX];
    if (todayCol) {
      // Position today as the 3rd visible column from the left.
      const parentLeft = weekRef.current.getBoundingClientRect().left;
      const todayLeft = todayCol.getBoundingClientRect().left;
      weekRef.current.scrollLeft += todayLeft - parentLeft;
    }
  }, [planLoading]);

  return (
    <div className="plan-page">
      <PageTitle
        eyebrow="THE PLAN"
        title="Coming up"
        summary={
          <>
            <strong>{totals.pantryDays} from the pantry</strong>
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{totals.shopDays} need a shop</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {totals.openDays} open seat{totals.openDays === 1 ? '' : 's'}
            </span>
          </>
        }
      />

      <div className="plan-prop-strip">
        <div className="plan-prop-bar" aria-hidden>
          <div className="plan-prop-bar-seg plan-prop-bar-seg--cook"     style={{ flex: totals.pantryDays   }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--leftover" style={{ flex: totals.leftoverDays }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--shop"     style={{ flex: totals.shopDays     }} />
          <div className="plan-prop-bar-seg"                              style={{ flex: totals.openDays     }} />
        </div>
        <div className="plan-prop-legend">
          {[
            ['cook now',    totals.pantryDays,   'var(--fresh)'],
            ['leftover',    totals.leftoverDays, 'var(--ink)'],
            ['needs shop',  totals.shopDays,     'var(--persimmon)'],
            ['open',        totals.openDays,     'var(--mute)'],
          ].map(([label, n, color]) => (
            <div key={label as string} className="plan-prop-legend-item">
              <span className="plan-prop-legend-dot" style={{ background: color as string }} />
              <span>{label as string}</span>
              <span className="plan-prop-legend-count">{n as number}</span>
            </div>
          ))}
        </div>
        {totals.shopDays > 0 && (
          <div className="plan-prop-shop">
            <div className="plan-prop-shop-label">your shopping list</div>
            <div>
              <a className="plan-prop-shop-cta" href="#" onClick={(e) => { e.preventDefault(); navigate('/list'); }}>
                view list →
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="plan-body">
        <aside className="plan-sidebar">
          <div className="plan-sidebar-header">Recipes<span className="dot">.</span></div>
          <div className="plan-pick-hint subtle">drag onto a day</div>
          <ul className="plan-recipe-list">
            {recipes.map((r) => (
              <li
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
              </li>
            ))}
          </ul>
        </aside>

        <div>
          {planLoading && <p className="plan-status">Loading…</p>}
          <div className="plan-week-scroll" ref={weekRef}>
            <div className="plan-week-rail">
              {!planLoading && days.map((d) => (
                <DayCard
                  key={d.iso}
                  iso={d.iso}
                  label={d.label}
                  isToday={d.isToday}
                  entries={entriesByDay[d.iso] ?? []}
                  onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
                  onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
                  onDeleteEntry={(id) => deleteEntry.mutate(id)}
                  onMarkCookedEntry={(id) => setCookingEntryId(id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

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
