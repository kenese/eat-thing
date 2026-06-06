import { ShopPreview } from './ShopPreview';
import type { HomeData } from './useHomeData';
import './HeroBand.css';

interface HeroBandProps {
  hero: HomeData['hero'];
  shop: HomeData['shop'];
  loading: { inventory: boolean };
}

export function HeroBand({ hero, shop, loading }: HeroBandProps) {
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

      <ShopPreview shop={shop} />
    </section>
  );
}
