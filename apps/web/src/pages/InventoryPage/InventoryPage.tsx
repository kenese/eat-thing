import React, { useState, useEffect } from 'react';
import { useInventory, useDeleteInventoryItem } from '../../hooks/useInventory';
import { ItemForm } from './ItemForm';
import type { InventoryRow, InventoryLocation } from '@eat/shared';
import './InventoryPage.css';

const LOCATION_TABS = [
  { key: 'all' as const, label: 'All' },
  { key: 'fridge' as const, label: 'Fridge' },
  { key: 'pantry' as const, label: 'Pantry' },
  { key: 'freezer' as const, label: 'Freezer' },
  { key: 'other' as const, label: 'Other' },
];

type LocationFilter = 'all' | InventoryLocation;

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <span className="expiry-badge expired">Expired</span>;
  if (days <= 7) return <span className="expiry-badge soon">Expires {days}d</span>;
  return null;
}

interface ItemRowProps {
  item: InventoryRow;
  onEdit: () => void;
  onDelete: () => void;
}

function ItemRow({ item, onEdit, onDelete }: ItemRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="inv-item">
      <div className="inv-item-main">
        <div className="inv-item-name">
          {item.foodName}
          {item.brand && <span className="inv-item-brand">{item.brand}</span>}
        </div>
        <div className="inv-item-qty">
          {item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1)} {item.unit}
        </div>
      </div>
      <div className="inv-item-footer">
        <div className="inv-item-badges">
          <span className={`loc-badge loc-${item.location}`}>{item.location}</span>
          <ExpiryBadge expiresAt={item.expiresAt} />
        </div>
        <div className="inv-item-actions">
          {confirming ? (
            <>
              <button className="btn-icon danger" onClick={() => { onDelete(); setConfirming(false); }} title="Confirm">✓</button>
              <button className="btn-icon" onClick={() => setConfirming(false)} title="Cancel">✕</button>
            </>
          ) : (
            <>
              <button className="btn-icon" onClick={onEdit} title="Edit">✎</button>
              <button className="btn-icon ghost-danger" onClick={() => setConfirming(true)} title="Delete">🗑</button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function InventoryPage() {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<
    { mode: 'add' } | { mode: 'edit'; item: InventoryRow } | null
  >(null);

  const deleteMutation = useDeleteInventoryItem();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items = [], isLoading, isError } = useInventory({
    location: locationFilter === 'all' ? undefined : locationFilter,
    q: debouncedSearch || undefined,
  });

  return (
    <div className="inventory-page">
      <div className="inv-header">
        <h1>Inventory</h1>
        <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>+ Add</button>
      </div>

      <div className="loc-tabs">
        {LOCATION_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`loc-tab${locationFilter === key ? ' active' : ''}`}
            onClick={() => setLocationFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="inv-search">
        <input
          type="search"
          placeholder="Search items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="inv-list-wrap">
        {isLoading && <p className="inv-status">Loading…</p>}
        {isError && <p className="inv-status error">Failed to load. Check your connection.</p>}
        {!isLoading && !isError && items.length === 0 && (
          <p className="inv-status empty">
            {search ? 'No items match your search.' : 'No items yet — tap + Add to get started.'}
          </p>
        )}
        {!isLoading && items.length > 0 && (
          <ul className="inv-list">
            {items.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onEdit={() => setModal({ mode: 'edit', item })}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))}
          </ul>
        )}
      </div>

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
