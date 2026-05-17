import type { ProductCandidate } from '@eat/shared';
import './ShoppingListPage.css';

interface Props {
  candidates: ProductCandidate[];
  chosenSku: string | null;
  onPick: (sku: string) => void;
  disabled?: boolean;
}

export function CandidatePicker({ candidates, chosenSku, onPick, disabled }: Props) {
  if (candidates.length === 0) return null;
  return (
    <ul className="candidate-picker">
      {candidates.map(c => {
        const isChosen = c.sku === chosenSku;
        return (
          <li key={c.sku} className={`candidate ${isChosen ? 'chosen' : ''}`}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(c.sku)}
              aria-pressed={isChosen}
            >
              <span className="candidate-name">{c.name}</span>
              {c.brand && <span className="candidate-brand">{c.brand}</span>}
              {c.packSize && (
                <span className="candidate-pack">
                  {c.packSize.unit === 'count' ? `${c.packSize.qty} pk` : `${c.packSize.qty}${c.packSize.unit}`}
                </span>
              )}
              <span className="candidate-price">${c.price.toFixed(2)}</span>
              {c.unitPrice && (
                <span className="candidate-unit-price">
                  {c.unitPrice.per === 'count'
                    ? `$${c.unitPrice.value.toFixed(2)}/ea`
                    : `$${(c.unitPrice.value * 100).toFixed(2)}/100${c.unitPrice.per}`}
                </span>
              )}
              {c.onSpecial && <span className="candidate-special">SPECIAL</span>}
              {c.cartQty > 1 && <span className="candidate-multi">×{c.cartQty}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
