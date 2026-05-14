import { useState, useMemo } from 'react';
import {
  useCurrentShoppingList, useGenerateShoppingList,
  useUpdateShoppingListItem, useAddShoppingListItem, useDeleteShoppingListItem,
} from '../../hooks/useShoppingList';
import { usePricesForList, useRefreshPrices } from '../../hooks/usePricesForList';
import { StaplesModal } from './StaplesModal';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import { AgentStatusCard, type AgentState } from '../../components/AgentStatusCard';
import type {
  ShoppingList, ShoppingListItem, ShoppingListPrice, Category, ShoppingSource,
} from '@eat/shared';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@eat/taxonomy';
import { mondayOf, toIsoDate } from '../../lib/dateUtils';
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

function ReasonChip({ source }: { source: ShoppingSource }) {
  const label =
    source === 'recipe' ? 'from recipes'
    : source === 'staple' ? 'low staple'
    : 'you added';
  return <span className={`sl-row-reason sl-row-reason--${source}`}>{label}</span>;
}

function CheckBox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Mark ${label}`}
      className={`sl-check${checked ? ' sl-check--checked' : ''}`}
      onClick={onToggle}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function PriceCell({ price, refreshing }: { price: ShoppingListPrice | undefined; refreshing: boolean }) {
  if (!price && refreshing) return <span className="sl-row-price sl-row-price--loading">…</span>;
  if (!price) return <span className="sl-row-price sl-row-price--missing">—</span>;
  if (!price.matched) return <span className="sl-row-price sl-row-price--missing">no match</span>;
  if (!price.inStock) return <span className="sl-row-price sl-row-price--missing">out of stock</span>;
  return <span className="sl-row-price">${price.price?.toFixed(2)}</span>;
}

function CategorySection({
  category,
  items,
  prices,
  refreshing,
  onToggle,
  onDelete,
}: {
  category: Category;
  items: ShoppingListItem[];
  prices: Map<string, ShoppingListPrice>;
  refreshing: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const subtotal = items.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);
  const checked = items.filter((i) => i.checked).length;

  return (
    <section className="sl-section">
      <div className="sl-section-header">
        <span className="sl-section-title">{CATEGORY_LABEL[category]}<span className="dot">.</span></span>
        <span className="sl-section-count">{items.length} {items.length === 1 ? 'item' : 'items'}{checked > 0 ? ` · ${checked} in cart` : ''}</span>
        <span className="sl-section-subtotal">${subtotal.toFixed(2)}</span>
      </div>
      {items.map((it) => (
        <div key={it.id} className={`sl-row${it.checked ? ' sl-row--checked' : ''}`}>
          <CheckBox
            checked={it.checked}
            onToggle={() => onToggle(it.id, !it.checked)}
            label={it.name}
          />
          <div className="sl-row-name">
            <span className="sl-row-label">{it.name}</span>
            <span className="sl-row-qty">{Math.ceil(it.qty * 10) / 10} {it.unit}</span>
          </div>
          <ReasonChip source={it.source} />
          <PriceCell price={prices.get(it.id)} refreshing={refreshing} />
          <button className="sl-row-menu" onClick={() => onDelete(it.id)} aria-label={`Remove ${it.name}`}>✕</button>
        </div>
      ))}
    </section>
  );
}

function AddItemForm({ listId }: { listId: string }) {
  const addItem = useAddShoppingListItem(listId);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('count');

  async function submit() {
    const parsedQty = parseFloat(qty);
    if (!name.trim() || isNaN(parsedQty) || parsedQty <= 0) return;
    await addItem.mutateAsync({ name: name.trim(), qty: parsedQty, unit });
    setName('');
    setQty('');
  }

  return (
    <div className="sl-add-form">
      <input placeholder="Item name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <input type="number" min="0" step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <select value={unit} onChange={(e) => setUnit(e.target.value)}>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      <button type="button" onClick={submit} disabled={addItem.isPending}>+ Add</button>
    </div>
  );
}

function ListView({ list }: { list: ShoppingList }) {
  const updateItem = useUpdateShoppingListItem(list.id);
  const deleteItem = useDeleteShoppingListItem(list.id);
  const { data: pricesData } = usePricesForList(list.id);
  const refresh = useRefreshPrices(list.id);

  const prices = useMemo(() => {
    const m = new Map<string, ShoppingListPrice>();
    for (const p of pricesData?.prices ?? []) m.set(p.shoppingListItemId, p);
    return m;
  }, [pricesData]);

  const job = pricesData?.job;
  const refreshing = job?.status === 'pending' || job?.status === 'in_progress' || refresh.isPending;

  const [tab, setTab] = useState<SourceTab>('all');

  const tabs = [
    ...SOURCE_TABS.map((t) => ({
      key: t.key,
      label: t.label,
      count: t.key === 'all' ? list.items.length : list.items.filter((i) => i.source === t.key).length,
    })),
  ];

  const visible = tab === 'all' ? list.items : list.items.filter((i) => i.source === tab);

  // Group by category.
  const byCategory = useMemo(() => {
    const m = new Map<Category, ShoppingListItem[]>();
    for (const it of visible) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return m;
  }, [visible]);

  // Totals.
  const allItems = CATEGORY_ORDER
    .map((c) => byCategory.get(c) ?? [])
    .flat();
  const subtotal = allItems.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);
  const pricedCount = allItems.filter((it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price !== null;
  }).length;
  const unmatched = allItems.length - pricedCount;

  // Store identity — read from prices; null if none.
  const storeKey = pricesData?.prices?.[0]?.store ?? null;
  const storeLabel = storeKey ? STORE_LABEL[storeKey] : null;

  const agentState: AgentState =
    job?.status === 'pending' || job?.status === 'in_progress' ? 'running'
    : job?.status === 'failed' ? 'failed'
    : 'idle';
  const agentMessage =
    agentState === 'running' ? `Checking prices${storeLabel ? ' at ' + storeLabel.name : ''}.`
    : agentState === 'failed' ? 'Last price check failed. Run refresh to try again.'
    : `I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.`;

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
              onToggle={(id, checked) => updateItem.mutate({ itemId: id, checked })}
              onDelete={(id) => deleteItem.mutate(id)}
            />
          );
        })}

        <section className="sl-section">
          <div className="sl-section-header">
            <span className="sl-section-title">Add item<span className="dot">.</span></span>
          </div>
          <AddItemForm listId={list.id} />
        </section>
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

        <button className="sl-send" disabled title="Coming soon · phase 4">
          <span>send to {storeLabel?.name ?? 'store'}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>→</span>
        </button>

        <AgentStatusCard state={agentState} message={agentMessage} />
        <button
          className="btn-outline"
          onClick={() => refresh.mutate()}
          disabled={refreshing}
          aria-label="Refresh prices"
          style={{ marginTop: -8 }}
        >
          {refreshing ? 'Checking prices…' : 'Refresh prices'}
        </button>
      </aside>
    </div>
  );
}

export function ShoppingListPage() {
  const { data: list, isLoading } = useCurrentShoppingList();
  const generate = useGenerateShoppingList();
  const [showStaples, setShowStaples] = useState(false);

  const thisWeekStart = toIsoDate(mondayOf(new Date()));

  const now = new Date();
  const builtAt = `AUTO-BUILT · LAST UPDATED ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

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
            <span style={{ color: 'var(--mute)' }}>No list yet — generate one for this week to begin.</span>
          )
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setShowStaples(true)}>staples</button>
            <button
              className="btn-primary"
              onClick={() => generate.mutate({ weekStart: thisWeekStart })}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate for this week'}
            </button>
          </>
        }
      />

      {isLoading && <p className="page-status">Loading…</p>}

      {!isLoading && !list && (
        <div className="list-empty">
          <p>No shopping list yet.</p>
          <p className="list-empty-hint">Click "Generate for this week" to build one from your meal plan and staples.</p>
        </div>
      )}

      {!isLoading && list && <ListView list={list} />}

      {showStaples && <StaplesModal onClose={() => setShowStaples(false)} />}
    </div>
  );
}
