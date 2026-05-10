import React, { useState } from 'react';
import {
  useCurrentShoppingList, useGenerateShoppingList,
  useUpdateShoppingListItem, useAddShoppingListItem, useDeleteShoppingListItem,
} from '../../hooks/useShoppingList';
import { usePricesForList, useRefreshPrices } from '../../hooks/usePricesForList';
import { StaplesModal } from './StaplesModal';
import type { ShoppingList, ShoppingListItem, ShoppingListPrice, CanonicalUnit } from '@eat/shared';
import { mondayOf, toIsoDate } from '../PlanPage/dateUtils';
import './ShoppingListPage.css';

const SOURCE_LABELS: Record<string, string> = {
  recipe: 'From recipes',
  staple: 'Staples',
  manual: 'Manual',
};

interface ItemRowProps {
  item: ShoppingListItem;
  price: ShoppingListPrice | undefined;
  refreshing: boolean;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

function priceCell(price: ShoppingListPrice | undefined, refreshing: boolean) {
  if (!price && refreshing) return <span className="list-item-price list-item-price--loading">…</span>;
  if (!price) return null;
  if (!price.matched) return <span className="list-item-price list-item-price--missing">no match</span>;
  if (!price.inStock) return <span className="list-item-price list-item-price--oos">out of stock</span>;
  return <span className="list-item-price">${price.price?.toFixed(2)}</span>;
}

function ItemRow({ item, price, refreshing, onToggle, onDelete }: ItemRowProps) {
  return (
    <li className={`list-item${item.checked ? ' checked' : ''}`}>
      <input
        type="checkbox"
        className="list-item-check"
        checked={item.checked}
        onChange={e => onToggle(e.target.checked)}
        id={`item-${item.id}`}
      />
      <label htmlFor={`item-${item.id}`} className="list-item-label">
        <span className="list-item-name">{item.name}</span>
        <span className="list-item-qty">{Math.ceil(item.qty * 10) / 10} {item.unit}</span>
      </label>
      {priceCell(price, refreshing)}
      <button className="list-item-delete" onClick={onDelete} aria-label={`Remove ${item.name}`}>✕</button>
    </li>
  );
}

interface AddItemFormProps {
  listId: string;
}

function AddItemForm({ listId }: AddItemFormProps) {
  const addItem = useAddShoppingListItem(listId);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<CanonicalUnit>('count');

  async function handleAdd() {
    const parsedQty = parseFloat(qty);
    if (!name.trim() || isNaN(parsedQty) || parsedQty <= 0) return;
    await addItem.mutateAsync({ name: name.trim(), qty: parsedQty, unit });
    setName('');
    setQty('');
  }

  return (
    <div className="add-item-form">
      <input
        className="form-input"
        placeholder="Item name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <input
        className="form-input form-input--sm"
        type="number"
        min="0"
        step="any"
        placeholder="Qty"
        value={qty}
        onChange={e => setQty(e.target.value)}
      />
      <select className="form-select" value={unit} onChange={e => setUnit(e.target.value as CanonicalUnit)}>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      <button className="btn btn-secondary" onClick={handleAdd} disabled={addItem.isPending}>
        + Add
      </button>
    </div>
  );
}

interface ListViewProps {
  list: ShoppingList;
}

function ListView({ list }: ListViewProps) {
  const updateItem = useUpdateShoppingListItem(list.id);
  const deleteItem = useDeleteShoppingListItem(list.id);
  const { data: pricesData } = usePricesForList(list.id);
  const refresh = useRefreshPrices(list.id);

  const priceByItemId = new Map<string, ShoppingListPrice>();
  for (const p of pricesData?.prices ?? []) priceByItemId.set(p.shoppingListItemId, p);

  const refreshing = pricesData?.job?.status === 'pending' || pricesData?.job?.status === 'in_progress' || refresh.isPending;

  const groups: Record<string, ShoppingListItem[]> = { recipe: [], staple: [], manual: [] };
  for (const item of list.items) (groups[item.source] ??= []).push(item);

  const uncheckedCount = list.items.filter(i => !i.checked).length;

  return (
    <div className="list-view">
      <div className="list-summary">
        {uncheckedCount === 0
          ? <span className="list-done">All done!</span>
          : <span>{uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} remaining</span>}
        <button
          className="btn btn-ghost"
          onClick={() => refresh.mutate()}
          disabled={refreshing}
          aria-label="Refresh prices"
        >
          {refreshing ? 'Checking prices…' : 'Refresh prices'}
        </button>
      </div>

      {(['recipe', 'staple', 'manual'] as const).map(source => {
        const items = groups[source] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={source} className="list-section">
            <h2 className="list-section-title">{SOURCE_LABELS[source]}</h2>
            <ul className="list-items">
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  price={priceByItemId.get(item.id)}
                  refreshing={refreshing}
                  onToggle={checked => updateItem.mutate({ itemId: item.id, checked })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="list-section list-section--manual">
        <h2 className="list-section-title">Add item</h2>
        <AddItemForm listId={list.id} />
      </section>
    </div>
  );
}

export function ShoppingListPage() {
  const { data: list, isLoading } = useCurrentShoppingList();
  const generate = useGenerateShoppingList();
  const [showStaples, setShowStaples] = useState(false);

  const thisWeekStart = toIsoDate(mondayOf(new Date()));

  return (
    <div className="shopping-list-page">
      <div className="page-header">
        <h1>Shopping list</h1>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={() => setShowStaples(true)}>Staples</button>
          <button
            className="btn btn-primary"
            onClick={() => generate.mutate({ weekStart: thisWeekStart })}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generating…' : 'Generate for this week'}
          </button>
        </div>
      </div>

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
