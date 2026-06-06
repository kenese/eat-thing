import type { ShoppingListFromPlanPreview } from '@eat/shared';

type AutoShopPreviewPanelProps = {
  isOpen: boolean;
  entryIds: string[];
  preview: ShoppingListFromPlanPreview | undefined;
  isLoading: boolean;
  error: Error | null;
  isConfirming: boolean;
  onClose: () => void;
  onRetry: () => void;
  onConfirm: (entryIds: string[]) => Promise<void>;
};

export function AutoShopPreviewPanel({
  isOpen,
  entryIds,
  preview,
  isLoading,
  error,
  isConfirming,
  onClose,
  onRetry,
  onConfirm,
}: AutoShopPreviewPanelProps) {
  if (!isOpen) return null;

  const hasEntries = entryIds.length > 0;

  return (
    <div className="auto-shop-overlay" role="dialog" aria-modal="true" aria-label="Auto-shop preview">
      <div className="auto-shop-panel">
        <div className="auto-shop-header">
          <div>
            <p className="auto-shop-eyebrow">plan preview</p>
            <h2 className="auto-shop-title">Auto-shop<span className="dot">.</span></h2>
          </div>
          <button className="auto-shop-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!hasEntries && (
          <div className="auto-shop-state">
            <p className="auto-shop-copy">Everything in the current plan window is covered by inventory.</p>
            <p className="auto-shop-copy auto-shop-copy--muted">You can still head to the list if you want to check manual or staple items.</p>
          </div>
        )}

        {hasEntries && isLoading && (
          <div className="auto-shop-state">
            <p className="auto-shop-copy">Loading auto-shop preview…</p>
          </div>
        )}

        {hasEntries && error && (
          <div className="auto-shop-state">
            <p className="auto-shop-copy">Could not load the auto-shop preview.</p>
            <button className="btn-outline" onClick={onRetry}>Try again</button>
          </div>
        )}

        {hasEntries && !isLoading && !error && preview && (
          <>
            <div className="auto-shop-summary">
              <p className="auto-shop-kicker">
                {preview.scheduledFor ? `shopping for ${preview.scheduledFor}` : 'shopping for the next shop'}
              </p>
              <p className="auto-shop-copy">
                {preview.recipeCount} planned recipe{preview.recipeCount === 1 ? '' : 's'} across {preview.dayCount} day{preview.dayCount === 1 ? '' : 's'} would add {preview.itemCount} item{preview.itemCount === 1 ? '' : 's'}.
              </p>
              <p className="auto-shop-copy auto-shop-copy--muted">
                {preview.recipeItemCount} recipe gap{preview.recipeItemCount === 1 ? '' : 's'} · {preview.stapleItemCount} staple top-up{preview.stapleItemCount === 1 ? '' : 's'}
              </p>
            </div>

            {preview.itemCount === 0 ? (
              <div className="auto-shop-state">
                <p className="auto-shop-copy">Nothing new needs to be added to the shopping list.</p>
              </div>
            ) : (
              <ul className="auto-shop-items">
                {preview.items.map((item) => (
                  <li key={`${item.source}-${item.canonicalFoodId}-${item.unit}`} className="auto-shop-item">
                    <div>
                      <p className="auto-shop-item-name">{item.name}</p>
                      <p className="auto-shop-item-meta">
                        {item.qty} {item.unit} · {item.source === 'recipe' ? 'recipe' : 'staple'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="auto-shop-actions">
          <button className="btn-outline" onClick={onClose}>Close</button>
          {hasEntries && !error && (
            <button
              className="btn-primary"
              onClick={() => void onConfirm(entryIds)}
              disabled={isLoading || isConfirming}
            >
              {isConfirming ? 'Updating…' : 'Update list'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
