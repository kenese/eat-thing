import { HeroBand } from './HeroBand';
import { MealsStrip } from './MealsStrip';
import { ShopPreview } from './ShopPreview';
import { useHomeData } from './useHomeData';
import './HomePage.css';

export function HomePage() {
  const data = useHomeData();
  const hasPlan = data.meals.some((m) => m.kind !== 'open');

  return (
    <div className="home-page">
      <HeroBand
        hero={data.hero}
        expiring={data.expiring}
        loading={{ inventory: data.loading.inventory }}
      />
      <div className="home-lower">
        <MealsStrip meals={data.meals} hasPlan={hasPlan} />
        <ShopPreview shop={data.shop} />
      </div>
    </div>
  );
}
