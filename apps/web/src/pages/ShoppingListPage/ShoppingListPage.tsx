import { useState, useMemo, useRef, useEffect } from 'react';
import {
  useCurrentShoppingList,
  useUpdateShoppingListItem, useAddShoppingListItem, useDeleteShoppingListItem,
  usePurchaseShoppingListItems, useBatchDeleteShoppingListItems,
} from '../../hooks/useShoppingList';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useCreateFood } from '../../hooks/useFoodSearch';
import { getTaxonomyReviewRequiredResponse } from '../../api/client';
import { usePricesForList, useRefreshPrices, useChooseSku, useSendToCart, useCartResult } from '../../hooks/usePricesForList';
import { ReconcileModal } from './ReconcileModal';
import { StaplesModal } from './StaplesModal';
import { AddFromPlanModal } from './AddFromPlanModal';
import { CandidatePicker } from './CandidatePicker';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import { AgentStatusCard, type AgentState } from '../../components/AgentStatusCard';
import type {
  ShoppingList, ShoppingListItem, ShoppingListPrice, Category, ShoppingSource, CanonicalFood,
  TaxonomyReviewRequiredResponse,
} from '@eat/shared';
import { AISLE_LABEL, CATEGORY_LABEL, CATEGORY_ORDER } from '@eat/taxonomy';
import type { Category as TaxCategory } from '@eat/taxonomy';
import './ShoppingListPage.css';

type SourceTab = 'all' | ShoppingSource;

const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'recipe', label: 'From recipes' },
  { key: 'staple', label: 'Staples' },
  { key: 'manual', label: 'You added' },
];

const STORE_LABEL: Record<string, { name: string; initials: string }> = {
  new_world:  { name: "New World",  initials: 'NW' },
  paknsave:   { name: "Pak'nSave",  initials: 'PS' },
  woolworths: { name: 'Woolworths', initials: 'WW' },
};

function ReasonChip({ source, sourceRecipeNames }: { source: ShoppingSource; sourceRecipeNames: string[] | null }) {
  const label =
    source === 'recipe'
      ? (sourceRecipeNames && sourceRecipeNames.length > 0 ? sourceRecipeNames.join(', ') : 'from recipes')
    : source === 'staple' ? 'low staple'
    : 'you added';
  return <span className={`sl-row-reason sl-row-reason--${source}`}>{label}</span>;
}

function PriceCell({ price, refreshing }: { price: ShoppingListPrice | undefined; refreshing: boolean }) {
  if (!price && refreshing) return <span className="sl-row-price sl-row-price--loading">…</span>;
  if (!price) return <span className="sl-row-price sl-row-price--missing">—</span>;
  if (!price.matched) return <span className="sl-row-price sl-row-price--missing">no match</span>;
  if (!price.inStock) return <span className="sl-row-price sl-row-price--missing">out of stock</span>;
  return <span className="sl-row-price">${price.price?.toFixed(2)}</span>;
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="sl-confirm-overlay" role="dialog" aria-modal="true">
      <div className="sl-confirm-panel">
        <p className="sl-confirm-message">{message}</p>
        <div className="sl-confirm-actions">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Remove anyway</button>
        </div>
      </div>
    </div>
  );
}

type BadgeLabel = 'Sole match' | 'Preferred' | 'Picked' | 'Pick one';

function badgeFor(price: ShoppingListPrice | undefined): BadgeLabel | null {
  const candidates = price?.candidates ?? [];
  if (!price || candidates.length === 0) return null;
  if (!price.chosenSku) return candidates.length > 1 ? 'Pick one' : null;
  const chosen = candidates.find(c => c.sku === price.chosenSku);
  if (!chosen) return null;
  if (chosen.resolution === 'sole') return 'Sole match';
  if (chosen.resolution === 'preferred') return 'Preferred';
  return 'Picked';
}

function CategorySection({
  category,
  items,
  prices,
  refreshing,
  selectedIds,
  expanded,
  onToggleSelect,
  onDelete,
  onToggleExpand,
  onPickSku,
  pickSkuPending,
}: {
  category: Category;
  items: ShoppingListItem[];
  prices: Map<string, ShoppingListPrice>;
  refreshing: boolean;
  selectedIds: Set<string>;
  expanded: Record<string, boolean>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onPickSku: (itemId: string, sku: string) => void;
  pickSkuPending: boolean;
}) {
  const subtotal = items.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);

  return (
    <section className="sl-section">
      <div className="sl-section-header">
        <span className="sl-section-title">{AISLE_LABEL[category]}<span className="dot">.</span></span>
        <span className="sl-section-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        <span className="sl-section-subtotal">${subtotal.toFixed(2)}</span>
      </div>
      {items.map((it) => {
        const selected = selectedIds.has(it.id);
        const p = prices.get(it.id);
        const badge = badgeFor(p);
        const slug = badge ? badge.toLowerCase().replace(/\s+/g, '-') : null;
        const isExpanded = expanded[it.id] ?? false;
        return (
          <div key={it.id} className={`sl-row${selected ? ' sl-row--selected' : ''}`}>
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`Select ${it.name}`}
              className={`sl-check${selected ? ' sl-check--checked' : ''}`}
              onClick={() => onToggleSelect(it.id)}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="sl-row-main">
              <div className="sl-row-name">
                <span className="sl-row-label">{it.name}</span>
                <span className="sl-row-qty">{Math.ceil(it.qty * 10) / 10} {it.unit}</span>
              </div>
              <ReasonChip source={it.source} sourceRecipeNames={it.sourceRecipeNames ?? null} />
              {badge && (
                <>
                  <span className={`row-badge row-badge-${slug}`}>{badge}</span>
                  {badge === 'Pick one' && (
                    <button
                      type="button"
                      className="row-toggle"
                      onClick={() => onToggleExpand(it.id)}
                    >
                      {isExpanded ? 'Hide options' : 'Show options'}
                    </button>
                  )}
                  {badge === 'Pick one' && isExpanded && p && (
                    <CandidatePicker
                      candidates={p.candidates}
                      chosenSku={p.chosenSku}
                      disabled={pickSkuPending}
                      onPick={sku => onPickSku(it.id, sku)}
                    />
                  )}
                </>
              )}
            </div>
            <PriceCell price={p} refreshing={refreshing} />
            <button className="sl-row-menu" onClick={() => onDelete(it.id)} aria-label={`Remove ${it.name}`}>✕</button>
          </div>
        );
      })}
    </section>
  );
}

function FoodCombobox({
  value,
  displayName,
  onChange,
  onTextChange,
}: {
  value: string;
  displayName: string;
  onChange: (food: CanonicalFood) => void;
  onTextChange: (text: string) => void;
}) {
  const [input, setInput] = useState(displayName);
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(input);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(displayName); }, [displayName]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="food-combobox" ref={ref} style={{ flex: 1, minWidth: 0 }}>
      <input
        className="form-input"
        type="text"
        placeholder="Food name or search…"
        value={input}
        autoComplete="off"
        onChange={e => {
          setInput(e.target.value);
          setOpen(true);
          onTextChange(e.target.value);
        }}
        onFocus={() => { if (input.trim()) setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
      />
      {open && results.length > 0 && (
        <ul className="food-dropdown" role="listbox">
          {results.map(food => (
            <li
              key={food.id}
              role="option"
              aria-selected={food.id === value}
              className={`food-option${food.id === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(food); setInput(food.name); setOpen(false); }}
            >
              <span>{food.name}</span>
              <span className="food-option-unit">{food.defaultUnit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddItemForm({ listId }: { listId: string }) {
  const addItem = useAddShoppingListItem(listId);
  const createFood = useCreateFood();
  const [canonicalFoodId, setCanonicalFoodId] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('count');
  const [category, setCategory] = useState<TaxCategory>('other');
  const [error, setError] = useState('');
  const [review, setReview] = useState<TaxonomyReviewRequiredResponse | null>(null);

  const isNewFood = !canonicalFoodId && name.trim().length > 0;

  function resetForm() {
    setCanonicalFoodId('');
    setName('');
    setQty('');
    setUnit('count');
    setCategory('other');
    setError('');
    setReview(null);
  }

  function payload(parsedQty: number, canonicalId?: string) {
    return canonicalId
      ? { canonicalFoodId: canonicalId, name: name.trim(), qty: parsedQty, unit }
      : { name: name.trim(), qty: parsedQty, unit, category };
  }

  async function submitWithCanonicalFood(canonicalId: string) {
    const parsedQty = parseFloat(qty);
    await addItem.mutateAsync(payload(parsedQty, canonicalId));
    resetForm();
  }

  async function submit() {
    setError('');
    setReview(null);
    const parsedQty = parseFloat(qty);
    if (!name.trim() || isNaN(parsedQty) || parsedQty <= 0) return;
    if (isNewFood && !category) return;

    try {
      await addItem.mutateAsync(payload(parsedQty, canonicalFoodId || undefined));
      resetForm();
    } catch (err: unknown) {
      const taxonomyReview = getTaxonomyReviewRequiredResponse(err);
      if (taxonomyReview) {
        setReview(taxonomyReview);
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="sl-add-form">
      <FoodCombobox
        value={canonicalFoodId}
        displayName={name}
        onChange={food => {
          setReview(null);
          setCanonicalFoodId(food.id);
          setName(food.name);
          setUnit(food.defaultUnit);
        }}
        onTextChange={text => {
          setReview(null);
          setName(text);
          setCanonicalFoodId('');
        }}
      />
      {isNewFood && (
        <select className="form-select" value={category} onChange={e => { setReview(null); setCategory(e.target.value as TaxCategory); }} aria-label="Category">
          {CATEGORY_ORDER.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
          ))}
        </select>
      )}
      <input type="number" min="0" step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="form-input" style={{ width: 70 }} />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className="form-select" style={{ width: 70 }}>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      <button type="button" onClick={submit} disabled={addItem.isPending || !name.trim()} className="sl-add-btn">+ Add</button>
      {review && (
        <div className="form-error" role="alert">
          Review this new canonical food before adding it.
          {review.matches.map(match => (
            <button
              key={match.id}
              type="button"
              className="btn-secondary"
              onClick={() => submitWithCanonicalFood(match.id)}
              disabled={addItem.isPending || createFood.isPending}
            >
              Use existing: {match.name}
            </button>
          ))}
          <button
            type="button"
            className="btn-primary"
            disabled={addItem.isPending || createFood.isPending}
            onClick={async () => {
              try {
                const created = await createFood.mutateAsync(review.proposed);
                await submitWithCanonicalFood(created.id);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Something went wrong.');
              }
            }}
          >
            {createFood.isPending ? 'Creating…' : `Create canonical food: ${review.proposed.name}`}
          </button>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function ActionBar({
  count,
  hasRecipeItems,
  onPurchase,
  onRemove,
  purchasing,
  removing,
}: {
  count: number;
  hasRecipeItems: boolean;
  onPurchase: () => void;
  onRemove: () => void;
  purchasing: boolean;
  removing: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="sl-action-bar" role="toolbar" aria-label="Selection actions">
      <span className="sl-action-bar-count">{count} {count === 1 ? 'item' : 'items'} selected</span>
      <div className="sl-action-bar-buttons">
        <button className="sl-action-btn sl-action-btn--purchase" onClick={onPurchase} disabled={purchasing || removing} aria-label="Mark selected as purchased">
          {purchasing ? 'Saving…' : 'Mark purchased'}
        </button>
        <button className="sl-action-btn sl-action-btn--remove" onClick={onRemove} disabled={purchasing || removing} aria-label="Remove selected items">
          {removing ? 'Removing…' : `Remove${hasRecipeItems ? ' ⚠' : ''}`}
        </button>
      </div>
    </div>
  );
}

function ListView({ list }: { list: ShoppingList }) {
  const updateItem = useUpdateShoppingListItem(list.id);
  const deleteItem = useDeleteShoppingListItem(list.id);
  const purchaseItems = usePurchaseShoppingListItems(list.id);
  const batchDelete = useBatchDeleteShoppingListItems(list.id);
  const { data: pricesData } = usePricesForList(list.id);
  const refresh = useRefreshPrices(list.id);
  const chooseSku = useChooseSku(list.id);
  const sendToCart = useSendToCart(list.id);
  const cartResult = useCartResult(list.id);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const prices = useMemo(() => {
    const m = new Map<string, ShoppingListPrice>();
    for (const p of pricesData?.prices ?? []) m.set(p.shoppingListItemId, p);
    return m;
  }, [pricesData]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const priceJob = pricesData?.job;
  const cartJob = cartResult.data?.job;
  const priceJobActive = priceJob?.status === 'pending' || priceJob?.status === 'in_progress';
  const cartJobActive = cartJob?.status === 'pending' || cartJob?.status === 'in_progress';
  const job = cartJobActive ? cartJob : priceJobActive ? priceJob : cartJob?.status === 'failed' ? cartJob : priceJob;
  const jobAction = job === cartJob ? 'cart update' : 'price check';
  const refreshing = priceJobActive || refresh.isPending;

  const hasUnpicked = list.items.some(it => {
    const p = prices.get(it.id);
    return p ? ((p.candidates?.length ?? 0) > 1 && !p.chosenSku) : false;
  });
  const hasAnyPicked = list.items.some(it => !!prices.get(it.id)?.chosenSku);

  useEffect(() => {
    if (cartResult.data?.job?.status === 'done') setReconcileOpen(true);
  }, [cartResult.data?.job?.status]);

  const [tab, setTab] = useState<SourceTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);

  const tabs = SOURCE_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.key === 'all' ? list.items.length : list.items.filter((i) => i.source === t.key).length,
  }));

  const visible = tab === 'all' ? list.items : list.items.filter((i) => i.source === tab);

  const byCategory = useMemo(() => {
    const m = new Map<Category, ShoppingListItem[]>();
    for (const it of visible) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return m;
  }, [visible]);

  const allItems = CATEGORY_ORDER.map((c) => byCategory.get(c) ?? []).flat();

  const subtotal = allItems.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);
  const pricedCount = allItems.filter((it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price !== null;
  }).length;
  const unmatched = allItems.length - pricedCount;

  const storeKey = pricesData?.prices?.[0]?.store ?? (job ? 'new_world' : null);
  const storeLabel = storeKey ? STORE_LABEL[storeKey] : null;
  const sessionExpired = job?.failure?.code === 'session_expired';

  const agentState: AgentState =
    job?.status === 'pending' || job?.status === 'in_progress' ? 'running'
    : job?.status === 'failed' ? 'failed'
    : 'idle';
  const agentMessage =
    job?.retrying && job.failure
      ? `Retrying ${jobAction}${storeLabel ? ' at ' + storeLabel.name : ''}… attempt ${job.failure.attempt} of ${job.failure.maxAttempts}`
    : agentState === 'running' ? `Checking prices${storeLabel ? ' at ' + storeLabel.name : ''}.`
    : agentState === 'failed'
      ? sessionExpired
        ? 'New World needs a fresh sign-in on the Mac mini.'
        : 'Last price check failed. Run refresh to try again.'
    : `I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.`;

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedArr = [...selectedIds];
  const hasRecipeItems = selectedArr.some(id => {
    const item = list.items.find(i => i.id === id);
    return item?.source === 'recipe';
  });

  async function handlePurchase() {
    if (selectedArr.length === 0) return;
    await purchaseItems.mutateAsync({ itemIds: selectedArr });
    setSelectedIds(new Set());
  }

  function handleRemoveClick() {
    if (hasRecipeItems) {
      setConfirmRemove(true);
    } else {
      doRemove();
    }
  }

  async function doRemove() {
    if (selectedArr.length === 0) return;
    await batchDelete.mutateAsync({ itemIds: selectedArr });
    setSelectedIds(new Set());
    setConfirmRemove(false);
  }

  // Deselect items that are no longer in the list (e.g. after purchase).
  const listItemIds = new Set(list.items.map(i => i.id));
  if (selectedIds.size > 0) {
    const staleIds = selectedArr.filter(id => !listItemIds.has(id));
    if (staleIds.length > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        staleIds.forEach(id => next.delete(id));
        return next;
      });
    }
  }

  return (
    <div className="sl-body">
      <div className="sl-list-pane">
        <FilterStrip
          tabs={tabs}
          activeTab={tab}
          onTabChange={(k) => setTab(k as SourceTab)}
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Search items…"
          trailing={<><span>group by</span><span style={{ fontWeight: 600 }}>category</span></>}
        />

        {CATEGORY_ORDER.map((c) => {
          const items = byCategory.get(c);
          if (!items || items.length === 0) return null;
          return (
            <CategorySection
              key={c}
              category={c}
              items={items}
              prices={prices}
              refreshing={refreshing}
              selectedIds={selectedIds}
              expanded={expanded}
              onToggleSelect={toggleSelect}
              onDelete={(id) => deleteItem.mutate(id)}
              onToggleExpand={(id) => setExpanded(e => ({ ...e, [id]: !e[id] }))}
              onPickSku={(itemId, sku) => chooseSku.mutate({ itemId, sku })}
              pickSkuPending={chooseSku.isPending}
            />
          );
        })}

        <section className="sl-section">
          <div className="sl-section-header">
            <span className="sl-section-title">Add item<span className="dot">.</span></span>
          </div>
          <AddItemForm listId={list.id} />
        </section>

        <ActionBar
          count={selectedIds.size}
          hasRecipeItems={hasRecipeItems}
          onPurchase={handlePurchase}
          onRemove={handleRemoveClick}
          purchasing={purchaseItems.isPending}
          removing={batchDelete.isPending}
        />
      </div>

      <aside className="sl-sidebar">
        <div>
          <div className="sl-eyebrow">Send to</div>
          <div className="sl-store">
            <div className="sl-store-tile">{storeLabel?.initials ?? '—'}</div>
            <div style={{ flex: 1 }}>
              <div className="sl-store-name">{storeLabel?.name ?? 'No store connected'}</div>
              <div className="sl-store-sub">{storeLabel ? 'connected · price checks active' : 'set one up in settings'}</div>
            </div>
            <span className="sl-store-change" title="Coming soon — Slice 3">change</span>
          </div>
        </div>

        <div>
          <div className="sl-eyebrow">Totals</div>
          <div className="sl-totals">
            <div className="sl-totals-line">
              <span>items</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{list.items.length}</span>
            </div>
            <div className="sl-totals-grand">
              <span className="sl-totals-label">est. total</span>
              <span className="sl-totals-value">${subtotal.toFixed(2)}</span>
            </div>
            <div className="sl-totals-sub">{pricedCount} priced · {unmatched} without a match</div>
          </div>
        </div>

        {sessionExpired && (
          <div className="form-error" role="alert">
            <strong>New World needs you to sign in again on the Mac mini.</strong>
            <div>Re-run bootstrap and ingest your session, then try again.</div>
          </div>
        )}

        <button
          type="button"
          className="sl-send"
          disabled={!hasAnyPicked || hasUnpicked || sendToCart.isPending}
          onClick={() => sendToCart.mutate()}
        >
          <span>{sendToCart.isPending ? 'Sending…' : 'Send to cart'}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>→</span>
        </button>
        {hasUnpicked && <span className="hint">Pick options for items marked "Pick one" first.</span>}

        <AgentStatusCard state={agentState} message={agentMessage} />
        <button
          className="btn-outline"
          onClick={() => refresh.mutate()}
          disabled={refreshing}
          aria-label="Find products"
          style={{ marginTop: -8 }}
        >
          {refreshing ? 'Checking prices…' : 'Find products'}
        </button>
      </aside>

      {confirmRemove && (
        <ConfirmDialog
          message="Some selected items are from recipes — removing them won't update the recipe's ingredient status. Remove anyway?"
          onConfirm={doRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}

      <ReconcileModal
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        result={cartResult.data?.result ?? null}
        items={list.items.map(i => ({ id: i.id, name: i.name }))}
      />
    </div>
  );
}

export function ShoppingListPage() {
  const { data: list, isLoading } = useCurrentShoppingList();
  const [showStaples, setShowStaples] = useState(false);
  const [showAddFromPlan, setShowAddFromPlan] = useState(false);

  const currentListRecipeIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of list?.items ?? []) {
      if (item.sourceRecipeId) set.add(item.sourceRecipeId);
    }
    return set;
  }, [list]);

  const now = new Date();
  const builtAt = `auto-built · last updated ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

  return (
    <div className="shopping-list-page">
      <PageTitle
        eyebrow={builtAt}
        title="The list"
        summary={
          list ? (
            <>
              <strong>{list.items.length} items</strong> · for{' '}
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>this week's plan</span>
            </>
          ) : (
            <span style={{ color: 'var(--mute)' }}>No list yet — click &quot;Add from planned recipes&quot; to begin.</span>
          )
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setShowStaples(true)}>staples</button>
            <button
              className="btn-primary"
              onClick={() => setShowAddFromPlan(true)}
            >
              Add from planned recipes
            </button>
          </>
        }
      />

      {isLoading && <p className="page-status">Loading…</p>}

      {!isLoading && !list && (
        <div className="list-empty">
          <p>No shopping list yet.</p>
          <p className="list-empty-hint">Click &quot;Add from planned recipes&quot; to build one from your plan.</p>
        </div>
      )}

      {!isLoading && list && <ListView list={list} />}

      {showStaples && <StaplesModal onClose={() => setShowStaples(false)} />}
      {showAddFromPlan && (
        <AddFromPlanModal
          currentListRecipeIds={currentListRecipeIds}
          onClose={() => setShowAddFromPlan(false)}
        />
      )}
    </div>
  );
}
