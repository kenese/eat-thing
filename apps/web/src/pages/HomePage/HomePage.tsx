import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroBand } from './HeroBand';
import { useHomeData } from './useHomeData';
import { WeekCarousel } from '../../components/WeekCarousel';
import { RecipeForm } from '../RecipesPage/RecipeForm';
import './HomePage.css';

export function HomePage() {
  const data = useHomeData();
  const [viewRecipeId, setViewRecipeId] = useState<string | null>(null);

  return (
    <div className="home-page">
      <HeroBand
        hero={data.hero}
        shop={data.shop}
        loading={{ inventory: data.loading.inventory }}
      />
      <div className="home-lower">
        <section className="home-plan-section">
          <div className="home-plan-head">
            <h2 className="home-plan-title">this week<span className="dot">.</span></h2>
            <Link to="/plan" className="home-plan-link">edit plan →</Link>
          </div>
          <WeekCarousel
            days={data.planDays}
            entriesByDay={data.entriesByDay}
            loading={data.loading.mealPlan}
            onOpenRecipe={setViewRecipeId}
          />
        </section>
      </div>

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
