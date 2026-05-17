import type { CartJobResult, CartActionResult } from '@eat/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  result: CartJobResult | null;
  items: Array<{ id: string; name: string }>;
}

const ACTION_LABEL: Record<CartActionResult['action'], string> = {
  added: 'Added',
  qty_increased: 'Qty bumped',
  already_in_cart: 'Already in cart',
  failed: 'Failed',
};

export function ReconcileModal({ open, onClose, result, items }: Props) {
  if (!open) return null;
  const nameById = new Map(items.map(i => [i.id, i.name]));
  return (
    <div className="reconcile-modal" role="dialog" aria-modal="true" aria-label="Cart updated">
      <div className="reconcile-modal-inner">
        <header><h2>Cart updated</h2><button onClick={onClose}>Close</button></header>
        {!result && <p>Waiting for cart…</p>}
        {result && (
          <>
            <ul className="reconcile-list">
              {result.perItem.map(r => (
                <li key={r.shoppingListItemId + r.sku} className={`reconcile-row reconcile-${r.action}`}>
                  <span className="reconcile-name">{nameById.get(r.shoppingListItemId) ?? r.sku}</span>
                  <span className="reconcile-action">{ACTION_LABEL[r.action]}</span>
                  {r.failureReason && <span className="reconcile-reason">{r.failureReason}</span>}
                </li>
              ))}
            </ul>
            <footer>
              <span>Trolley total: ${result.cartTotalNzd.toFixed(2)}</span>
              <a href={result.trolleyUrl} target="_blank" rel="noreferrer">Open New World trolley →</a>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
