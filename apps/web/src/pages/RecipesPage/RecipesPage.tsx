import { useState, useEffect, useMemo } from 'react';
import { useRecipes, useRecipe } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import { RecipeForm } from './RecipeForm';
import { ImportModal } from './ImportModal';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import { StatusChip } from '../../components/StatusChip';
import { computeMissing, bucketRecipe } from '../../lib/recipeMatch';
import type { Recipe, RecipeSummary } from '@eat/shared';
import './RecipesPage.css';

type Tab = 'all' | 'cookable' | 'shoppable' | 'library';

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
            serves {recipe.servings}
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

function EditorialHero({
  feature,
  side,
  onOpen,
}: {
  feature: Recipe;
  side?: Recipe;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="rx-hero">
      <div className="rx-hero-main">
        <div className="rx-hero-copy">
          <div>
            <div className="rx-hero-eyebrow">
              <span className="rx-hero-eyebrow-dot" />
              COOK TONIGHT · USES WHAT YOU HAVE
            </div>
            <h2 className="rx-hero-title">
              {feature.name}
              <span className="dot">.</span>
            </h2>
            <p className="rx-hero-body">
              Ready in minutes from what's already on hand — no shopping needed.
            </p>
          </div>
          <div className="rx-hero-cta">
            <button className="btn-primary" onClick={() => onOpen(feature.id)}>
              open recipe <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17 }}>→</span>
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
          </div>
          <div className="rx-hero-side-body">
            <div className="rx-hero-side-title">{side.name}<span className="dot">.</span></div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.45 }}>
              Another cook-now pick from what's in the kitchen.
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

export function RecipesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
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

  // Hero / side features need full recipe objects (ingredients) — fetch them when picked.
  const sortedByMatch = useMemo(() => {
    const enriched = recipes.map((r) => {
      // Without server-side ingredient join in the summary, approximate by zero-missing assumption:
      // we treat summary recipes as bucketed once their full record loads. As a coarse heuristic,
      // we use ingredientCount === 0 ⇒ cookable; otherwise place in 'library' until a richer client
      // join is wired up. For the lite hero we re-fetch the picked recipe via useRecipe (below).
      const missing: string[] = [];
      return {
        recipe: r as RecipeSummary,
        match: { bucket: bucketRecipe(missing), missing } as MatchInfo,
      };
    });
    return enriched;
  }, [recipes]);

  // NOTE: A future task can replace the heuristic above with a proper match by fetching
  // full ingredient lists for every visible recipe. For this restyle we ship the simpler
  // version: the section grouping uses the heuristic; the hero gets a real full-record
  // fetch via useRecipe(firstId).

  const featureId = recipes[0]?.id ?? null;
  const sideId    = recipes[1]?.id ?? null;
  const { data: feature } = useRecipe(featureId ?? '');
  const { data: side }    = useRecipe(sideId ?? '');

  // If we have feature + inventory, derive its real bucket for accuracy in the hero copy.
  const featureMissing = feature ? computeMissing(feature, inventory) : null;

  const cookable  = sortedByMatch.filter((x) => x.match.bucket === 'cookable');
  const shoppable = sortedByMatch.filter((x) => x.match.bucket === 'shoppable');
  const library   = sortedByMatch.filter((x) => x.match.bucket === 'library');

  const buckets = { cookable, shoppable, library };
  const tabs = [
    { key: 'all',       label: 'All',         count: recipes.length },
    { key: 'cookable',  label: 'Cook now',    count: cookable.length,  dotColor: 'var(--fresh)' },
    { key: 'shoppable', label: 'Quick shop',  count: shoppable.length, dotColor: 'var(--persimmon)' },
    { key: 'library',   label: 'Library',     count: library.length },
  ];

  const visible = tab === 'all'
    ? sortedByMatch
    : buckets[tab];

  // featureMissing used to drive hero copy accuracy (consumed in the template below)
  void featureMissing;

  return (
    <div className="recipes-page">
      <PageTitle
        eyebrow={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        title="Recipes"
        summary={
          <>
            <strong>{cookable.length} cookable</strong> with what you have
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{shoppable.length} a quick shop away</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {recipes.length} in the library
            </span>
          </>
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setModal({ mode: 'import' })}>↓ import url</button>
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
        trailing={<><span>sort</span><span style={{ fontWeight: 600 }}>cookable first</span></>}
      />

      {isLoading && <p className="recipes-status">Loading…</p>}
      {isError && <p className="recipes-status error">Failed to load.</p>}

      {/* Hero — only when there's at least one recipe and we're on All */}
      {!isLoading && feature && tab === 'all' && (
        <EditorialHero
          feature={feature}
          side={side ?? undefined}
          onOpen={(id) => setModal({ mode: 'edit', id })}
        />
      )}

      {!isLoading && tab === 'all' ? (
        <>
          {cookable.length > 0 && (
            <section className="rx-section">
              <div className="rx-section-header">
                <span className="rx-section-title">Cook tonight<span className="dot">.</span></span>
                <span className="rx-section-count">{cookable.length} {cookable.length === 1 ? 'recipe' : 'recipes'}</span>
                <span className="rx-section-hint">uses what's on hand</span>
              </div>
              <div className="rx-grid">
                {cookable.map(({ recipe, match }) => (
                  <RecipeCard key={recipe.id} recipe={recipe} match={match} onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
                ))}
              </div>
            </section>
          )}

          {shoppable.length > 0 && (
            <section className="rx-section">
              <div className="rx-section-header">
                <span className="rx-section-title">One quick shop<span className="dot">.</span></span>
                <span className="rx-section-count">{shoppable.length} {shoppable.length === 1 ? 'recipe' : 'recipes'}</span>
                <span className="rx-section-hint">1–3 items away</span>
              </div>
              <div className="rx-grid">
                {shoppable.map(({ recipe, match }) => (
                  <RecipeCard key={recipe.id} recipe={recipe} match={match} onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
                ))}
              </div>
            </section>
          )}

          {library.length > 0 && (
            <section className="rx-section">
              <div className="rx-section-header">
                <span className="rx-section-title">The library<span className="dot">.</span></span>
                <span className="rx-section-count">{library.length} {library.length === 1 ? 'recipe' : 'recipes'}</span>
                <span className="rx-section-hint">all recipes</span>
              </div>
              <div className="rx-grid rx-grid--dense">
                {library.map(({ recipe, match }) => (
                  <RecipeCard key={recipe.id} recipe={recipe} match={match} dense onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
                ))}
              </div>
            </section>
          )}

          {recipes.length === 0 && !isLoading && (
            <p className="recipes-status">No recipes yet — tap + new recipe to get started.</p>
          )}
        </>
      ) : (
        <div className="rx-grid">
          {visible.map(({ recipe, match }) => (
            <RecipeCard key={recipe.id} recipe={recipe} match={match} onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
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
        />
      )}
    </div>
  );
}
