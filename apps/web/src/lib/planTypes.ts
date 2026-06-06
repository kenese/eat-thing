import type { MealPlanEntry } from '@eat/shared';

export type DayKind = 'cook' | 'shop' | 'leftover' | 'open';

export interface DayEntry {
  entry: MealPlanEntry;
  missingNames: string[];
  kind: DayKind;
  totalTimeMinutes: number | null;
  sourceImage: string | null;
}
