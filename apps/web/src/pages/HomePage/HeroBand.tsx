import type { HomeData } from './useHomeData';
import './HeroBand.css';

interface HeroBandProps {
  hero: HomeData['hero'];
  expiring: HomeData['expiring'];
  loading: { inventory: boolean };
}

export function HeroBand({ hero, expiring, loading }: HeroBandProps) {
  const inventoryEmpty = !loading.inventory && hero.onHandCount === 0;

  return (
    <section className="hero-band">
      <div className="hero-band-left">
        {inventoryEmpty ? (
          <div className="hero-pill">
            <span className="hero-pill-dot" aria-hidden />
            add a few things to start cooking from your kitchen
          </div>
        ) : hero.pill ? (
          <div className="hero-pill">
            <span className="hero-pill-dot" aria-hidden />
            {hero.pill}
          </div>
        ) : null}

        <h1 className="hero-headline">
          cook from{' '}
          <span className="hero-headline-italic">what's already</span>
          <br />
          in the kitchen<span className="dot">.</span>
        </h1>

        <div className="hero-subcopy">
          {inventoryEmpty ? (
            <span className="hero-subcopy-empty">
              start by adding a few things to your kitchen.
            </span>
          ) : (
            <>
              {hero.onHandCount} things on hand
              {hero.expiringSoonCount > 0 && (
                <> · {hero.expiringSoonCount} won't make it past {hero.expirySubcopyDay}</>
              )}
              {' '}· the list builds itself.
            </>
          )}
        </div>
      </div>

      <aside className="hero-use-card">
        <div className="hero-use-head">
          <div className="hero-use-title">use this week</div>
          <div className="hero-use-tag">
            {expiring.totalCount} {expiring.totalCount === 1 ? 'item' : 'items'}
          </div>
        </div>

        {expiring.rows.length === 0 ? (
          <div className="hero-use-empty">nothing on the edge yet.</div>
        ) : (
          expiring.rows.map((row, i) => (
            <div
              key={row.id}
              className={`hero-use-row${i === 0 ? ' is-first' : ''}`}
            >
              <div
                className={`hero-use-days${row.daysLeft <= 1 ? ' is-today' : ''}`}
              >
                {row.daysLeft}d
              </div>
              <div className="hero-use-name-col">
                <div className="hero-use-name">{row.name}</div>
                <div className="hero-use-qty">{row.qtyDisplay}</div>
              </div>
              <div
                className={`hero-use-tagline${row.daysLeft <= 1 ? ' is-today' : ''}`}
              >
                {row.daysLeft <= 1 ? 'today' : 'soon'}
              </div>
            </div>
          ))
        )}
      </aside>
    </section>
  );
}
