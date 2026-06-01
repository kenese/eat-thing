import { useState, useEffect, useMemo } from 'react';
import { useInventory, useDeleteInventoryItem } from '../../hooks/useInventory';
import { ItemForm } from './ItemForm';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import type { InventoryRow } from '@eat/shared';
import { CATEGORY_ORDER, CATEGORY_LABEL } from '@eat/taxonomy';
import type { Category } from '@eat/taxonomy';
import './InventoryPage.css';

type CategoryFilter = 'all' | Category;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type Urgency = 'expired' | 'soon' | 'thisweek' | 'fresh' | 'none';
function urgencyOf(days: number | null): Urgency {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'soon';
  if (days <= 7) return 'thisweek';
  return 'fresh';
}

function fmtQty(qty: number, unit: string): string {
  const n = qty % 1 === 0 ? qty.toString() : qty.toFixed(qty < 1 ? 2 : 1);
  return `${n} ${unit}`;
}

function ExpiryCell({ days }: { days: number | null }) {
  const u = urgencyOf(days);
  const label =
    days === null ? 'no exp'
    : days < 0    ? `${-days}d ago`
    : `${days}d`;
  return (
    <div className={`inv-row-expires inv-row-expires--${u}`}>
      <span className="inv-row-expires-dot" aria-hidden />
      <span className="inv-row-expires-label">{label}</span>
    </div>
  );
}

function UseThisWeek({ items }: { items: InventoryRow[] }) {
  const soon = items
    .map((i) => ({ ...i, d: daysUntil(i.expiresAt) }))
    .filter((i) => i.d !== null && i.d <= 3)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    .slice(0, 5);
  if (soon.length === 0) return null;
  return (
    <div className="inv-use-week">
      <div>
        <div className="inv-use-week-title">use this week</div>
        <div className="inv-use-week-meta">soonest to expire · {soon.length}</div>
      </div>
      {soon.map((it) => (
        <div key={it.id} className="inv-use-cell">
          <div className={`inv-use-cell-days${(it.d ?? 0) <= 1 ? ' inv-use-cell-days--urgent' : ''}`}>
            {it.d}<span style={{ fontSize: 13, marginLeft: 2 }}>d</span>
          </div>
          <div className="inv-use-cell-name">{it.foodName}</div>
          <div className="inv-use-cell-sub">{fmtQty(it.qty, it.unit)}</div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ item, onEdit, onDelete }: { item: InventoryRow; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const days = daysUntil(item.expiresAt);
  return (
    <div className="inv-row">
      <div className="inv-row-qty">{fmtQty(item.qty, item.unit)}</div>
      <div className="inv-row-item">
        <div className="inv-row-item-name">{item.foodName}</div>
        {item.brand && <div className="inv-row-item-brand">{item.brand}</div>}
      </div>
      <div className="inv-row-added">{(() => {
        const da = daysUntil(item.purchasedAt);
        if (da === null) return '—';
        if (da >= 0) return 'today';
        return `${-da}d ago`;
      })()}</div>
      <ExpiryCell days={days} />
      <div className="inv-row-actions">
        {confirming ? (
          <>
            <button className="inv-row-action inv-row-action--danger" onClick={() => { onDelete(); setConfirming(false); }}>confirm</button>
            <button className="inv-row-action" onClick={() => setConfirming(false)}>cancel</button>
          </>
        ) : (
          <>
            <button className="inv-row-action" onClick={onEdit}>edit</button>
            <button className="inv-row-action inv-row-action--danger" onClick={() => setConfirming(true)}>delete</button>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryGroup({ label, items, onEdit, onDelete }: {
  label: string;
  items: InventoryRow[];
  onEdit: (it: InventoryRow) => void;
  onDelete: (it: InventoryRow) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="inv-group">
      <div className="inv-group-header">
        <span className="inv-group-label">{label}</span>
        <span className="inv-group-count">{items.length} items</span>
      </div>
      {items.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          onEdit={() => onEdit(it)}
          onDelete={() => onDelete(it)}
        />
      ))}
    </div>
  );
}

export function InventoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: InventoryRow } | null>(null);

  const deleteMutation = useDeleteInventoryItem();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items = [], isLoading, isError } = useInventory({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    q: debouncedSearch || undefined,
  });

  const sortedByCategory = useMemo(() => {
    const buckets: Record<Category, InventoryRow[]> = {
      produce: [], meat: [], dairy: [], pantry: [], frozen: [], drinks: [], other: [],
    };
    for (const it of items) buckets[it.category].push(it);
    for (const k of CATEGORY_ORDER) {
      buckets[k].sort((a, b) => {
        const da = daysUntil(a.expiresAt);
        const db = daysUntil(b.expiresAt);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
    return buckets;
  }, [items]);

  const expSoon = items.filter((i) => {
    const d = daysUntil(i.expiresAt);
    return d !== null && d <= 7;
  }).length;

  // Derive location counts from categories: produce/meat/dairy → Fridge, pantry/drinks/other → Pantry, frozen → Freezer
  const locationCounts = useMemo(() => ({
    fridge: sortedByCategory.produce.length + sortedByCategory.meat.length + sortedByCategory.dairy.length,
    pantry: sortedByCategory.pantry.length + sortedByCategory.drinks.length + sortedByCategory.other.length,
    freezer: sortedByCategory.frozen.length,
  }), [sortedByCategory]);

  const expiringRows = useMemo(() =>
    items
      .map((i) => ({ ...i, d: daysUntil(i.expiresAt) }))
      .filter((i) => i.d !== null && i.d >= 0 && i.d <= 7)
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
      .slice(0, 6),
    [items],
  );

  const now = new Date();
  const eyebrow = `the kitchen · ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

  const tabs = [
    { key: 'all', label: 'All', count: items.length },
    ...CATEGORY_ORDER.map((cat) => ({
      key: cat,
      label: CATEGORY_LABEL[cat],
      count: sortedByCategory[cat].length,
    })),
  ];

  const categoriesToRender: Category[] =
    categoryFilter === 'all' ? CATEGORY_ORDER : [categoryFilter];

  return (
    <div className="inventory-page">
      <PageTitle
        eyebrow={eyebrow}
        title="Inventory"
        summary={
          <>
            <strong>{items.length} items</strong> on hand
            {expSoon > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>
                  {expSoon} expiring this week
                </span>
              </>
            )}
          </>
        }
        actions={
          <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> add item
          </button>
        }
      />

      <UseThisWeek items={items} />

      <FilterStrip
        tabs={tabs}
        activeTab={categoryFilter}
        onTabChange={(k) => setCategoryFilter(k as CategoryFilter)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search items, brands…"
        trailing={<><span>sort by</span><span style={{ fontWeight: 600 }}>expiry ↑</span></>}
      />

      {isLoading && <p className="inv-status">Loading…</p>}
      {isError && <p className="inv-status error">Failed to load. Check your connection.</p>}

      {!isLoading && !isError && items.length === 0 && (
        <p className="inv-status">
          {search ? 'No items match your search.' : 'No items yet — tap + add item to get started.'}
        </p>
      )}

      {!isLoading && items.length > 0 && (
        <div className="inv-body">
          <div className="inv-main">
            <div className="inv-col-header">
              <div>qty</div>
              <div>item</div>
              <div>added</div>
              <div>expires</div>
              <div></div>
            </div>
            {categoriesToRender.map((cat) => (
              <CategoryGroup
                key={cat}
                label={CATEGORY_LABEL[cat]}
                items={sortedByCategory[cat]}
                onEdit={(item) => setModal({ mode: 'edit', item })}
                onDelete={(item) => deleteMutation.mutate(item.id)}
              />
            ))}
          </div>

          <aside className="inv-sidebar">
            <div className="inv-sidebar-card">
              <div className="inv-sidebar-card-title">By location</div>
              {[
                { label: 'fridge', count: locationCounts.fridge },
                { label: 'pantry', count: locationCounts.pantry },
                { label: 'freezer', count: locationCounts.freezer },
              ].map(({ label, count }) => (
                <div key={label} className="inv-location-row">
                  <span className="inv-location-label">{label}</span>
                  <span className="inv-location-count">{count} items</span>
                </div>
              ))}
            </div>

            {expiringRows.length > 0 && (
              <div className="inv-sidebar-card">
                <div className="inv-sidebar-card-title">Expiring soon</div>
                <div className="inv-sidebar-expiring">
                  {expiringRows.map((it) => (
                    <div key={it.id} className="inv-sidebar-exp-row">
                      <span
                        className="inv-sidebar-exp-days"
                        style={{ color: (it.d ?? 0) <= 1 ? 'var(--persimmon)' : (it.d ?? 0) <= 3 ? 'var(--persim-deep)' : 'var(--ink3)' }}
                      >
                        {it.d}d
                      </span>
                      <span className="inv-sidebar-exp-name">{it.foodName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HANDOFF: low-stock staples — requires useStaples hook integration */}
            <div className="inv-sidebar-card">
              <div className="inv-sidebar-card-title">Low staples</div>
              <p style={{ fontSize: 13, color: 'var(--mute)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                staple tracking coming soon.
              </p>
            </div>
          </aside>
        </div>
      )}

      {modal && (
        <ItemForm
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
