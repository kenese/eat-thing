import { Link } from 'react-router-dom';
import { StatusChip } from '../../components/StatusChip';
import type { MealCellStatus } from './homeDerivations';
import './MealsStrip.css';

interface MealsStripProps {
  meals: MealCellStatus[];
  hasPlan: boolean;
}

export function MealsStrip({ meals, hasPlan }: MealsStripProps) {
  return (
    <section className="meals-strip">
      <div className="meals-strip-head">
        <div className="meals-strip-title-row">
          <h2 className="meals-strip-title">this week</h2>
          <span className="meals-strip-subtitle">
            {hasPlan ? '(5 + an open seat)' : '(no plan yet)'}
          </span>
        </div>
        <Link to="/plan" className="meals-strip-action">edit plan →</Link>
      </div>

      <div className="meals-strip-grid">
        {meals.map((cell) => (
          <MealsCard key={cell.dayLabel + (cell.isToday ? '-today' : '')} cell={cell} />
        ))}
      </div>
    </section>
  );
}

function MealsCard({ cell }: { cell: MealCellStatus }) {
  const isHero = cell.isToday && cell.kind === 'cook';
  const isOpen = cell.kind === 'open';

  const className = [
    'meals-card',
    isHero && 'meals-card--hero',
    isOpen && 'meals-card--open',
  ].filter(Boolean).join(' ');

  return (
    <Link to="/plan" className={className}>
      <div className="meals-card-day">{cell.dayLabel}</div>
      {cell.kind === 'open' ? (
        <div className="meals-card-spacer" />
      ) : (
        <div className="meals-card-name">{cell.recipe.name}</div>
      )}
      <div className="meals-card-chip">
        {cell.kind === 'cook' && <StatusChip kind="cook" onHero={isHero} />}
        {cell.kind === 'shop' && <StatusChip kind="shop" missingCount={cell.missingCount} />}
        {cell.kind === 'open' && <StatusChip kind="open" />}
      </div>
    </Link>
  );
}
