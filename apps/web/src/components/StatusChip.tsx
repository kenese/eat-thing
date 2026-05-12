import './StatusChip.css';

export type StatusKind = 'cook' | 'shop' | 'leftover' | 'open' | 'expired' | 'soon';

interface StatusChipProps {
  kind: StatusKind;
  /** When kind is 'shop', render "missing N" instead of "needs shop". */
  missingCount?: number;
  /** Reverse colors for use on a green hero card (paper bg, green fg). */
  onHero?: boolean;
}

function labelFor(kind: StatusKind, missingCount?: number): string {
  switch (kind) {
    case 'cook':     return 'cook now';
    case 'shop':     return missingCount && missingCount > 0 ? `missing ${missingCount}` : 'needs shop';
    case 'leftover': return 'leftover';
    case 'open':     return 'open seat';
    case 'expired':  return 'expired';
    case 'soon':     return 'use soon';
  }
}

export function StatusChip({ kind, missingCount, onHero }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${kind}${onHero ? ' status-chip--on-hero' : ''}`}>
      {kind !== 'open' && <span className="status-chip-dot" aria-hidden />}
      {labelFor(kind, missingCount)}
    </span>
  );
}
