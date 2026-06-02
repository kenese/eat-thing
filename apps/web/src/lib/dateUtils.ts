// All dates in this module use ISO-week (Monday-start) and the YYYY-MM-DD wire format.

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Monday of the week containing `d`, in local time.
export function mondayOf(d: Date): Date {
  const result = new Date(d);
  const dow = result.getDay(); // 0 = Sun, 1 = Mon, …
  const offset = dow === 0 ? -6 : 1 - dow;
  result.setDate(result.getDate() + offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function weekDays(weekStart: Date): { date: Date; iso: string; label: string }[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, iso: toIsoDate(d), label: `${labels[i]} ${d.getDate()}` };
  });
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const monthFmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  if (sameMonth) {
    return `${weekStart.getDate()}–${end.getDate()} ${monthFmt(end)} ${end.getFullYear()}`;
  }
  return `${weekStart.getDate()} ${monthFmt(weekStart)} – ${end.getDate()} ${monthFmt(end)} ${end.getFullYear()}`;
}

export const TODAY_INDEX = 2;
export const WINDOW_SIZE = 17;

export interface PlanWindowDay {
  date: Date;
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
}

export function planWindow(anchor: Date = new Date()): { from: string; to: string } {
  const start = addDays(anchor, -TODAY_INDEX);
  const end = addDays(anchor, WINDOW_SIZE - TODAY_INDEX - 1);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function planWindowDays(anchor: Date = new Date(), today: Date = anchor): PlanWindowDay[] {
  const todayIso = toIsoDate(today);
  const start = addDays(anchor, -TODAY_INDEX);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = addDays(start, i);
    const iso = toIsoDate(d);
    return {
      date: d,
      iso,
      label: `${labels[d.getDay()]} ${d.getDate()}`,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
    };
  });
}
