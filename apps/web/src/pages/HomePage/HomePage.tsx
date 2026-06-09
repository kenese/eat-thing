import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroBand } from './HeroBand';
import { ShopPreview } from './ShopPreview';
import { useHomeData } from './useHomeData';
import { WeekCarousel } from '../../components/WeekCarousel';
import { RecipeForm } from '../RecipesPage/RecipeForm';
import { CookTonightSection } from '../RecipesPage/CookTonightSection';
import { useRecipes } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import { bucketRecipe, computeMissingFromIds } from '../../lib/recipeMatch';
import type { MatchInfo } from '../RecipesPage/RecipeCard';
import './HomePage.css';

export function HomePage() {
  const data = useHomeData();
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null);
  const { data: recipes = [] } = useRecipes();
  const { data: inventory = [] } = useInventory();
  const todayIso = data.planDays.find((day) => day.isToday)?.iso ?? null;

  const cookTonight = useMemo(() => {
    return recipes
      .map((recipe) => {
        const missing = computeMissingFromIds(recipe.canonicalFoodIds, inventory);
        return {
          recipe,
          match: { bucket: bucketRecipe(missing), missing } as MatchInfo,
        };
      })
      .filter((item) => item.match.bucket === 'cookable');
  }, [recipes, inventory]);

  return (
    <div className="home-page">
      <HeroBand
        hero={data.hero}
        loading={{ inventory: data.loading.inventory }}
      />
      <ShopPreview shop={data.shop} />
      <section className="home-plan-section">
        <div className="home-plan-head">
          <h2 className="home-plan-title">this weeks plan<span className="dot">.</span></h2>
          <Link to="/plan" className="home-plan-link">edit plan →</Link>
        </div>
        <WeekCarousel
          days={data.planDays}
          entriesByDay={data.entriesByDay}
          loading={data.loading.mealPlan}
          initialScrollIso={todayIso}
          onOpenRecipe={setViewRecipeId}
        />
      </section>
      <CookTonightSection
        className="home-cook-section"
        items={cookTonight}
        onOpenRecipe={setViewRecipeId}
      />

      {viewRecipeId && (
        <RecipeForm
          mode="edit"
          recipeId={viewRecipeId}
          onClose={() => setViewRecipeId(null)}
        />
      )}
    </div>
  );
}
