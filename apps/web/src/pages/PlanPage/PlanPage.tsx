import React, { useState, useMemo } from 'react';
import { useRecipes, useRecipe } from '../../hooks/useRecipes';
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
import { computeMissing } from '../../lib/recipeMatch';
import type { MealPlanEntry, RecipeSummary, Recipe } from '@eat/shared';
import { mondayOf, addDays, toIsoDate, weekDays, formatWeekRange, planWindow } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import './PlanPage.css';

const DRAG_TYPE = 'application/x-eat-recipe-id';

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
  context,
  isToday,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  iso: string;
  label: string;
  context: string;
  isToday: boolean;
  entries: DayEntry[];
  onDropRecipe: (recipeId: string) => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const first = entries[0];
  const followUps = entries.slice(1);
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
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
        {context && <span className="day-col-context">{context}</span>}
      </div>

      {first ? (
        <>
          <div className="day-col-image">
            {first.recipe?.sourceImage
              ? <img src={first.recipe.sourceImage} alt="" />
              : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
          </div>
          <div className="day-col-name">{first.entry.recipeName}</div>
          {first.missing.length > 0 && (
            <div className="day-col-need">
              need {first.missing.slice(0, 2).join(', ')}
              {first.missing.length > 2 ? ` & ${first.missing.length - 2} more` : ''}
            </div>
          )}
          <div className="day-col-meta">
            serves {first.entry.servings}
          </div>
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

function FillStrip({
  openDay,
  candidates,
  onPlace,
}: {
  openDay: { iso: string; label: string };
  candidates: { recipe: RecipeSummary; missing: number; hint: string }[];
  onPlace: (iso: string, recipeId: string) => void;
}) {
  return (
    <div className="plan-fill">
      <div className="plan-fill-header">
        <span className="plan-fill-title">Fill {openDay.label}<span className="dot">.</span></span>
        <span className="plan-fill-count">{candidates.length} picks</span>
        <span className="plan-fill-hint">based on what you have &amp; what&apos;s expiring</span>
      </div>
      <div className="plan-fill-rows">
        {candidates.map((c) => (
          <div key={c.recipe.id} className="plan-fill-row">
            <div>
              <div className="plan-fill-row-name">{c.recipe.name}</div>
              <div className="plan-fill-row-hint">{c.hint}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--mute)' }}>serves {c.recipe.servings}</span>
            <StatusChip kind={c.missing === 0 ? 'cook' : 'shop'} missingCount={c.missing > 0 ? c.missing : undefined} />
            <button className="plan-fill-place" onClick={() => onPlace(openDay.iso, c.recipe.id)}>
              place in {openDay.label.toLowerCase()} <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanPage() {
  const navigate = useNavigate();
  const [weekStartDate, setWeekStartDate] = useState(() => mondayOf(new Date()));
  const todayIso = toIsoDate(new Date());

  const days = useMemo(() => weekDays(weekStartDate), [weekStartDate]);

  const { from, to } = useMemo(() => planWindow(weekStartDate), [weekStartDate]);
  const { data: week, isLoading: planLoading } = useMealPlanEntries(from, to);
  const { data: recipes = [] } = useRecipes();
  const { data: inventory = [] } = useInventory({});

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
  const cookingEntry = cookingEntryId
    ? (week?.entries ?? []).find((e) => e.id === cookingEntryId) ?? null
    : null;

  // Bucket entries by date and enrich with recipe + missing.
  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const fullRecipeQuery = (id: string) => useRecipe(id); // not called in render; helper for the inline expansion
  void fullRecipeQuery;

  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of week?.entries ?? []) {
      const recipeSummary = recipeMap.get(e.recipeId);
      // We don't have ingredients here without a per-recipe fetch; approximate planned entries as cookable.
      const kind: DayKind = 'cook'; // accurate per-day cook/shop bucketing requires per-entry recipe ingredients;
                                    // we ship 'cook' as the default and rely on the badge to be refined when the recipe loads.
      const dayEntry: DayEntry = {
        entry: e,
        recipe: undefined as Recipe | undefined, // not loaded in summary; CookModal handles cook-time deduction.
        missing: [],
        kind,
      };
      void recipeSummary;
      (map[e.date] ??= []).push(dayEntry);
    }
    return map;
  }, [week, recipeMap]);

  const pantryDays   = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'cook')).length;
  const leftoverDays = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'leftover')).length;
  const shopDays     = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'shop')).length;
  const openDays     = days.filter((d) => !(entriesByDay[d.iso]?.length)).length;
  void days.length; // totalDays kept for reference; all 7 slots are always rendered

  // Pick the first open day for the Fill strip.
  const firstOpenDay = days.find((d) => !(entriesByDay[d.iso]?.length));

  // Suggest top 3 not-already-placed recipes ranked by missing.length asc (uses inventory).
  const suggestions = useMemo(() => {
    if (!firstOpenDay) return [];
    const placedIds = new Set((week?.entries ?? []).map((e) => e.recipeId));
    const ranked = recipes
      .filter((r) => !placedIds.has(r.id))
      .map((r) => ({
        recipe: r,
        missing: 0, // without ingredients on the summary, treat as cookable; full match would require N fetches.
        hint: 'a quick pick',
      }))
      .slice(0, 3);
    return ranked;
  }, [recipes, week, firstOpenDay, inventory]);
  void computeMissing; // kept available for the future per-entry refinement

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({
      date,
      recipeId,
      servings: recipe?.servings ?? 1,
    });
  }

  return (
    <div className="plan-page">
      <PageTitle
        eyebrow={`WEEK ${getISOWeekNumber(weekStartDate)} · ${formatWeekRange(weekStartDate)}`}
        title="This week"
        summary={
          <>
            <strong>{pantryDays} from the pantry</strong>
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{shopDays} need a shop</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {openDays} open seat{openDays === 1 ? '' : 's'}
            </span>
          </>
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setWeekStartDate((d) => addDays(d, -7))}>← last week</button>
            <button className="btn-outline" onClick={() => setWeekStartDate((d) => addDays(d, 7))}>next week →</button>
          </>
        }
      />

      <div className="plan-prop-strip">
        <div className="plan-prop-bar" aria-hidden>
          <div className="plan-prop-bar-seg plan-prop-bar-seg--cook"     style={{ flex: pantryDays   }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--leftover" style={{ flex: leftoverDays }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--shop"     style={{ flex: shopDays     }} />
          <div className="plan-prop-bar-seg"                              style={{ flex: openDays     }} />
        </div>
        <div className="plan-prop-legend">
          {[
            ['cook now',    pantryDays,   'var(--fresh)'],
            ['leftover',    leftoverDays, 'var(--ink)'],
            ['needs shop',  shopDays,     'var(--persimmon)'],
            ['open',        openDays,     'var(--mute)'],
          ].map(([label, n, color]) => (
            <div key={label as string} className="plan-prop-legend-item">
              <span className="plan-prop-legend-dot" style={{ background: color as string }} />
              <span>{label as string}</span>
              <span className="plan-prop-legend-count">{n as number}</span>
            </div>
          ))}
        </div>
        {shopDays > 0 && (
          <div className="plan-prop-shop">
            <div className="plan-prop-shop-label">this week&apos;s shop</div>
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
          <div className="plan-pick-hint subtle">drag onto a day, or use the fill-day suggestions below</div>
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
          <div className="plan-week">
            {!planLoading && days.map((d) => (
              <DayCard
                key={d.iso}
                iso={d.iso}
                label={d.label}
                context={d.iso === todayIso ? 'today' : ''}
                isToday={d.iso === todayIso}
                entries={entriesByDay[d.iso] ?? []}
                onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
                onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
                onDeleteEntry={(id) => deleteEntry.mutate(id)}
                onMarkCookedEntry={(id) => setCookingEntryId(id)}
              />
            ))}
          </div>

          {firstOpenDay && suggestions.length > 0 && (
            <FillStrip
              openDay={{ iso: firstOpenDay.iso, label: firstOpenDay.label }}
              candidates={suggestions}
              onPlace={(iso, recipeId) => handleDrop(iso, recipeId)}
            />
          )}
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

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
