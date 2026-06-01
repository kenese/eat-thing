import { Link } from 'react-router-dom';
import { AISLE_LABEL } from '@eat/taxonomy';
import type { ShopSummary } from './homeDerivations';
import './ShopPreview.css';

interface ShopPreviewProps {
  shop: ShopSummary;
}

export function ShopPreview({ shop }: ShopPreviewProps) {
  const isEmpty = shop.state === 'empty';

  return (
    <section className="shop-preview">
      <div className="shop-preview-head">
        <div>
          <div className="shop-preview-eyebrow">
            shopping list · {isEmpty ? 'empty' : 'ready'}
          </div>
          <div className="shop-preview-headline">
            {isEmpty ? 'no list yet' : shop.builtLabel}
          </div>
          {!isEmpty && <div className="shop-preview-sub">this week</div>}
        </div>
        {shop.total != null && <ShopTotal total={shop.total} />}
      </div>

      <div className="shop-preview-hairline" />

      {isEmpty ? (
        <div className="shop-preview-empty">
          the list builds itself when you plan a meal.
        </div>
      ) : (
        <div className="shop-preview-aisles">
          {shop.aisles.map((a, i) => (
            <div
              key={a.name}
              className={`shop-preview-aisle${i < shop.aisles.length - 1 ? ' has-rule' : ''}`}
            >
              <div className="shop-preview-aisle-name">{AISLE_LABEL[a.name]}</div>
              <div className="shop-preview-aisle-items">{a.sampleItems.join(' · ')}</div>
              <div className="shop-preview-aisle-count">{a.count}</div>
            </div>
          ))}
        </div>
      )}

      <Link
        to={isEmpty ? '/plan' : '/list'}
        className="shop-preview-cta"
      >
        <span>{isEmpty ? 'start a list' : 'check out for me'}</span>
        <span className="shop-preview-cta-arrow">→</span>
      </Link>
    </section>
  );
}

function ShopTotal({ total }: { total: number }) {
  const cents = Math.round(total * 100);
  const dollars = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, '0');
  return (
    <div className="shop-preview-total">
      ${dollars}<span className="shop-preview-total-decimal">.{remainder}</span>
    </div>
  );
}
