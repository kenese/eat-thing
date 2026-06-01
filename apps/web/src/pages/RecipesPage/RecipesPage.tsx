import React, { useState, useEffect, useMemo } from 'react';
import { useRecipes, useRecipe, useDeleteRecipe } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import { useAddToNextEmptyDays } from '../../hooks/useMealPlan';
import { RecipeForm } from './RecipeForm';
import { ImportModal } from './ImportModal';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import { StatusChip } from '../../components/StatusChip';
import { computeMissing, computeMissingFromIds, bucketRecipe } from '../../lib/recipeMatch';
import type { Recipe, RecipeSummary } from '@eat/shared';
import './RecipesPage.css';

type Tab = 'all' | 'cookable' | 'shoppable';
type SortOrder = 'cookable-first' | 'recently-added' | 'name-az';

interface MatchInfo {
  bucket: 'cookable' | 'shoppable' | 'library';
  missing: string[];
}

export function RecipeCard({
  recipe,
  match,
  dense,
  selected,
  onOpen,
  onSelect,
}: {
  recipe: RecipeSummary;
  match: MatchInfo;
  dense?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onSelect?: () => void;
}) {
  return (
    <div className={`rx-card-wrapper${selected ? ' rx-card-wrapper--selected' : ''}`}>
      <button
        className={`rx-card${dense ? ' rx-card--dense' : ''}`}
        onClick={onOpen}
        aria-label={recipe.name}
      >
        <div className="rx-card-image">
          {recipe.sourceImage ? (
            <img src={recipe.sourceImage} alt="" />
          ) : (
            <span className="rx-card-image-fallback">{recipe.name}</span>
          )}
          <div className="rx-card-badge">
            {match.bucket === 'cookable' ? (
              <StatusChip kind="cook" />
            ) : (
              <StatusChip kind="shop" missingCount={match.missing.length} />
            )}
          </div>
          <div className="rx-card-meta-overlay">
            {recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} min · ` : ''}serves {recipe.servings}
          </div>
        </div>
        <div className="rx-card-body">
          <div className="rx-card-title">{recipe.name}</div>
          {!dense && match.missing.length > 0 && (
            <div className="rx-card-need">
              need {match.missing.slice(0, 2).join(', ')}
              {match.missing.length > 2 ? ` & ${match.missing.length - 2} more` : ''}
            </div>
          )}
          <div className="rx-card-footer">
            <span>{recipe.ingredientCount} ingr</span>
            {recipe.tags.length > 0 && (
              <span className="rx-card-tags">
                {recipe.tags.slice(0, 2).map(t => (
                  <span key={t} className="rx-card-tag">{t}</span>
                ))}
              </span>
            )}
          </div>
        </div>
      </button>
      {onSelect && (
        <button
          className={`rx-card-select-btn${selected ? ' rx-card-select-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); onSelect(); }}
          aria-label={selected ? 'Deselect recipe' : 'Select recipe'}
          aria-pressed={selected}
        >
          {selected ? '✓' : ''}
        </button>
      )}
    </div>
  );
}

function renderExpiringCopy(names: string[]): React.ReactNode {
  if (names.length === 0) return null;
  const withEm = names.map((n, i) => (
    <em key={i} style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{n}</em>
  ));
  const joined = withEm.reduce<React.ReactNode[]>((acc, el, i) => {
    if (i === 0) return [el];
    if (i === names.length - 1) return [...acc, names.length > 2 ? ', and ' : ' and ', el];
    return [...acc, ', ', el];
  }, []);
  return <>{joined}</>;
}

function EditorialHero({
  feature,
  side,
  sideMatch,
  featureExpiring,
  featureTime,
  onOpen,
  onAddFeatureToNextDay,
}: {
  feature: Recipe;
  side?: Recipe;
  sideMatch?: MatchInfo;
  featureExpiring: string[];
  featureTime: number | null;
  onOpen: (id: string) => void;
  onAddFeatureToNextDay: () => void;
}) {
  const expiringCount = featureExpiring.length;
  return (
    <div className="rx-hero">
      <div className="rx-hero-main">
        <div className="rx-hero-copy">
          <div>
            <div className="rx-hero-eyebrow">
              <span className="rx-hero-eyebrow-dot" />
              {expiringCount > 0
                ? `cook tonight · uses ${expiringCount} expiring`
                : 'cook tonight · uses what you have'}
            </div>
            <h2 className="rx-hero-title">
              {feature.name}
              <span className="dot">.</span>
            </h2>
            {expiringCount > 0 ? (
              <p className="rx-hero-body">
                {featureTime ? `Ready in ${featureTime} minutes. ` : ''}
                Uses up {renderExpiringCopy(featureExpiring)} from the fridge —{' '}
                {expiringCount === 1 ? 'something' : 'things'} you&apos;d otherwise throw out.
              </p>
            ) : (
              <p className="rx-hero-body">
                Ready in minutes from what&apos;s already on hand — no shopping needed.
              </p>
            )}
          </div>
          <div className="rx-hero-cta">
            <button className="btn-primary" onClick={() => onOpen(feature.id)}>
              open recipe <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17 }}>→</span>
            </button>
            {/* HANDOFF: day picker — replace label + handler when day-picker exists */}
            <button className="btn-outline--on-dark" onClick={onAddFeatureToNextDay}>
              add to next open day
            </button>
            <span style={{ fontSize: 11, color: 'rgba(243,245,242,0.5)', letterSpacing: '0.04em' }}>
              serves {feature.servings} · {feature.ingredients.length} ingredients
            </span>
          </div>
        </div>
        <div className="rx-hero-image">
          {feature.sourceImage
            ? <img src={feature.sourceImage} alt="" />
            : <span className="rx-hero-image-fallback">{feature.name}</span>}
        </div>
      </div>
      {side && (
        <button className="rx-hero-side" onClick={() => onOpen(side.id)} style={{ cursor: 'pointer', background: 'var(--paper)', textAlign: 'left', font: 'inherit' }}>
          <div className="rx-hero-side-image">
            {side.sourceImage
              ? <img src={side.sourceImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span className="rx-card-image-fallback">{side.name}</span>}
            <span className="rx-hero-side-badge">editor&apos;s pick</span>
          </div>
          <div className="rx-hero-side-body">
            <div className="rx-hero-side-title">{side.name}<span className="dot">.</span></div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.45 }}>
              Another cook-now pick from what's in the kitchen.
            </div>
            <div className="rx-hero-side-footer">
              {sideMatch && (
                sideMatch.bucket === 'cookable'
                  ? <StatusChip kind="cook" />
                  : <StatusChip kind="shop" missingCount={sideMatch.missing.length} />
              )}
              <span className="rx-hero-side-meta">serves {side.servings}</span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

export function SelectionBar({
  selectedIds,
  recipes,
  onClear,
  onAddToPlan,
  onDelete,
}: {
  selectedIds: Set<string>;
  recipes: RecipeSummary[];
  onClear: () => void;
  onAddToPlan: () => Promise<{ addedTo: string[]; skipped: string[] }>;
  onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = selectedIds.size;

  async function handleAddToPlan() {
    setIsPending(true);
    setMessage(null);
    setError(null);
    try {
      const { addedTo, skipped } = await onAddToPlan();
      let msg = addedTo.length > 0 ? `Added to ${addedTo.join(', ')}` : 'No empty days found.';
      if (skipped.length > 0) {
        const skippedNames = skipped.map(id => recipes.find(r => r.id === id)?.name ?? id);
        msg += ` ${skipped.length} recipe${skipped.length > 1 ? 's' : ''} had no available day: ${skippedNames.join(', ')}.`;
      }
      setMessage(msg);
      setTimeout(() => { setMessage(null); onClear(); }, 3000);
    } catch {
      setError('Failed to add to plan. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsPending(true);
    try {
      await onDelete();
      setConfirmDelete(false);
      onClear();
    } catch {
      setError('Some recipes could not be deleted. Try again.');
      setConfirmDelete(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      className={`rx-selection-bar${count > 0 ? ' rx-selection-bar--visible' : ''}`}
      aria-label="Selection actions"
    >
      {message ? (
        <span className="rx-selection-bar-message">{message}</span>
      ) : error ? (
        <>
          <span className="rx-selection-bar-error">{error}</span>
          <button className="rx-selection-bar-clear" onClick={() => setError(null)}>Dismiss</button>
        </>
      ) : confirmDelete ? (
        <>
          <span className="rx-selection-bar-count">
            Delete {count} recipe{count > 1 ? 's' : ''}? This can&apos;t be undone.
          </span>
          <button
            className="btn-primary rx-selection-bar-btn"
            onClick={handleDeleteConfirm}
            disabled={isPending}
            aria-label="Confirm"
          >
            {isPending ? 'deleting…' : 'confirm'}
          </button>
          <button
            className="btn-outline rx-selection-bar-btn"
            onClick={() => setConfirmDelete(false)}
            disabled={isPending}
            aria-label="Cancel"
          >
            cancel
          </button>
        </>
      ) : (
        <>
          <span className="rx-selection-bar-count">{count} selected</span>
          <button className="rx-selection-bar-clear" onClick={onClear}>× clear</button>
          <button
            className="btn-primary rx-selection-bar-btn"
            onClick={handleAddToPlan}
            disabled={isPending || count === 0}
          >
            {isPending ? 'adding…' : 'add to plan'}
          </button>
          <button
            className="rx-selection-bar-delete"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending || count === 0}
            aria-label="Delete"
          >
            delete
          </button>
        </>
      )}
    </div>
  );
}

export function RecipesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('cookable-first');
  const [modal, setModal] = useState<
    { mode: 'add' } | { mode: 'edit'; id: string } | { mode: 'import' } | null
  >(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: recipes = [], isLoading, isError } = useRecipes({
    q: debouncedSearch || undefined,
  });
  const { data: inventory = [] } = useInventory({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const addToNextEmptyDays = useAddToNextEmptyDays();
  const deleteRecipe = useDeleteRecipe();

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleAddSelectedToPlan() {
    const items = [...selectedIds].map(id => {
      const recipe = recipes.find(r => r.id === id);
      return { recipeId: id, servings: recipe?.servings ?? 2 };
    });
    return addToNextEmptyDays.mutateAsync(items);
  }

  async function handleDeleteSelected() {
    await Promise.all([...selectedIds].map(id => deleteRecipe.mutateAsync(id)));
  }

  // Hero / side features need full recipe objects (ingredients) — fetch them when picked.
  const sortedByMatch = useMemo(() => {
    return recipes.map((r) => {
      const missing = computeMissingFromIds(r.canonicalFoodIds, inventory);
      return {
        recipe: r as RecipeSummary,
        match: { bucket: bucketRecipe(missing), missing } as MatchInfo,
      };
    });
  }, [recipes, inventory]);

  const featureId = recipes[0]?.id ?? null;
  const sideId    = recipes[1]?.id ?? null;
  const { data: feature } = useRecipe(featureId ?? '');
  const { data: side }    = useRecipe(sideId ?? '');

  // Derive real match info for side card (full ingredient list via useRecipe).
  const sideMissingList = side ? computeMissing(side, inventory) : null;
  const sideMatch = sideMissingList !== null
    ? { bucket: bucketRecipe(sideMissingList), missing: sideMissingList } as MatchInfo
    : undefined;

  // Derive expiring inventory items that the featured recipe uses (for hero copy).
  const featureTime = recipes[0]?.totalTimeMinutes ?? null;
  const featureExpiring = useMemo(() => {
    if (!feature || inventory.length === 0) return [];
    const inventoryById = new Map(
      inventory.flatMap(r => r.canonicalFoodId ? [[r.canonicalFoodId, r] as const] : []),
    );
    return feature.ingredients
      .filter(ing => !ing.optional && ing.canonicalFoodId && inventoryById.has(ing.canonicalFoodId))
      .map(ing => ({
        name: ing.foodName,
        expiresAt: inventoryById.get(ing.canonicalFoodId!)?.expiresAt ?? null,
      }))
      .filter((x): x is { name: string; expiresAt: string } => x.expiresAt !== null)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
      .slice(0, 3)
      .map(x => x.name);
  }, [feature, inventory]);

  const cookable  = sortedByMatch.filter((x) => x.match.bucket === 'cookable');
  const shoppable = sortedByMatch.filter((x) => x.match.bucket === 'shoppable');
  const library   = sortedByMatch.filter((x) => x.match.bucket === 'library');

  const tabs = [
    { key: 'all',       label: 'all',         count: recipes.length },
    { key: 'cookable',  label: 'cook now',    count: cookable.length,  dotColor: 'var(--fresh)' },
    { key: 'shoppable', label: 'quick shop',  count: shoppable.length, dotColor: 'var(--persimmon)' },
  ];

  const flatSorted = useMemo(() => {
    const base = tab === 'all' ? sortedByMatch
      : tab === 'cookable' ? cookable
      : shoppable;
    if (sortOrder === 'cookable-first') return base;
    return [...base].sort((a, b) =>
      sortOrder === 'recently-added'
        ? new Date(b.recipe.createdAt).getTime() - new Date(a.recipe.createdAt).getTime()
        : a.recipe.name.localeCompare(b.recipe.name),
    );
  }, [tab, sortedByMatch, cookable, shoppable, sortOrder]);

  function handleAddFeatureToNextDay() {
    if (!feature) return;
    addToNextEmptyDays.mutate([{ recipeId: feature.id, servings: feature.servings }]);
  }

  return (
    <div className="recipes-page">
      <PageTitle
        eyebrow={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        title="Recipes"
        summary={
          <>
            <strong>{cookable.length} cookable</strong> with what you have
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{shoppable.length} a quick shop away</span>
            {' · '}
            <span style={{ color: 'var(--mute)', fontSize: 14 }}>
              {recipes.length} total
            </span>
          </>
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setModal({ mode: 'import' })}>↓ import</button>
            <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> new recipe
            </button>
          </>
        }
      />

      <FilterStrip
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as Tab)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search recipes, ingredients…"
        trailing={
          <label className="rx-sort-label">
            sort
            <select
              className="rx-sort-select"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as SortOrder)}
              aria-label="Sort recipes"
            >
              <option value="cookable-first">cookable first</option>
              <option value="recently-added">recently added</option>
              <option value="name-az">name a–z</option>
            </select>
          </label>
        }
      />

      {isLoading && <p className="recipes-status">Loading…</p>}
      {isError && <p className="recipes-status error">Failed to load.</p>}

      {/* Hero — only when there's at least one recipe and we're on All */}
      {!isLoading && feature && tab === 'all' && (
        <EditorialHero
          feature={feature}
          side={side ?? undefined}
          sideMatch={sideMatch}
          featureExpiring={featureExpiring}
          featureTime={featureTime}
          onOpen={(id) => setModal({ mode: 'edit', id })}
          onAddFeatureToNextDay={handleAddFeatureToNextDay}
        />
      )}

      {!isLoading && tab === 'all' && sortOrder === 'cookable-first' ? (
        <>
          {cookable.length > 0 && (
            <section className="rx-section">
              <div className="rx-section-header">
                <span className="rx-section-title">
                  Cook tonight<span className="dot" style={{ color: 'var(--fresh)' }}>.</span>
                </span>
                <span className="rx-section-count">{cookable.length} {cookable.length === 1 ? 'recipe' : 'recipes'}</span>
                <span className="rx-section-hint">uses what's on hand</span>
              </div>
              <div className="rx-grid">
                {cookable.map(({ recipe, match }) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    match={match}
                    selected={selectedIds.has(recipe.id)}
                    onSelect={() => toggleSelection(recipe.id)}
                    onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
                  />
                ))}
              </div>
            </section>
          )}

          {shoppable.length > 0 && (
            <section className="rx-section">
              <div className="rx-section-header">
                <span className="rx-section-title">
                  One quick shop<span className="dot" style={{ color: 'var(--persimmon)' }}>.</span>
                </span>
                <span className="rx-section-count">{shoppable.length} {shoppable.length === 1 ? 'recipe' : 'recipes'}</span>
                <span className="rx-section-hint">1–3 items away · auto-added to your next list</span>
              </div>
              <div className="rx-grid">
                {shoppable.map(({ recipe, match }) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    match={match}
                    selected={selectedIds.has(recipe.id)}
                    onSelect={() => toggleSelection(recipe.id)}
                    onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
                  />
                ))}
              </div>
            </section>
          )}

          {library.length > 0 && (
            <div className="rx-grid">
              {library.map(({ recipe, match }) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  match={match}
                  selected={selectedIds.has(recipe.id)}
                  onSelect={() => toggleSelection(recipe.id)}
                  onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
                />
              ))}
            </div>
          )}

          {recipes.length === 0 && !isLoading && (
            <p className="recipes-status">No recipes yet — tap + new recipe to get started.</p>
          )}
        </>
      ) : (
        <div className="rx-grid">
          {!isLoading && flatSorted.map(({ recipe, match }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              match={match}
              selected={selectedIds.has(recipe.id)}
              onSelect={() => toggleSelection(recipe.id)}
              onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
            />
          ))}
        </div>
      )}

      {modal && modal.mode === 'import' && (
        <ImportModal onClose={() => setModal(null)} />
      )}
      {modal && modal.mode !== 'import' && (
        <RecipeForm
          mode={modal.mode}
          recipeId={modal.mode === 'edit' ? modal.id : undefined}
          onClose={() => setModal(null)}
          onAddToPlan={async (recipeId, servings) =>
            addToNextEmptyDays.mutateAsync([{ recipeId, servings }])
          }
        />
      )}

      <SelectionBar
        selectedIds={selectedIds}
        recipes={recipes}
        onClear={clearSelection}
        onAddToPlan={handleAddSelectedToPlan}
        onDelete={handleDeleteSelected}
      />
    </div>
  );
}
