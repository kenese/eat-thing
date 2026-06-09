import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusChip } from './StatusChip';
import type { MealPlanEntry } from '@eat/shared';
import type { PlanWindowDay } from '../lib/dateUtils';
import type { DayEntry, DayKind } from '../lib/planTypes';
import './WeekCarousel.css';

export type { DayEntry, DayKind };

export const DRAG_TYPE = 'application/x-eat-recipe-id';
export const DRAG_ENTRY_TYPE = 'application/x-eat-entry-id';
export const DRAG_ENTRY_DATE_TYPE = 'application/x-eat-entry-date';

const MAX_ENTRIES_PER_DAY = 4;

interface ExpandedState {
  iso: string;
  rect: DOMRect;
  isToday: boolean;
  isPast: boolean;
}

function DayTray({
  rect,
  isToday,
  isPast,
  entries,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
  onOpenRecipe,
}: {
  rect: DOMRect;
  isToday: boolean;
  isPast: boolean;
  entries: DayEntry[];
  onUpdateEntry?: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry?: (id: string) => void;
  onMarkCookedEntry?: (id: string) => void;
  onOpenRecipe?: (recipeId: string) => void;
}) {
  const multi = entries.length > 1;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect.left,
    top: rect.bottom - 1,
    width: rect.width,
  };

  return (
    <div
      className={`day-tray${isToday ? ' day-tray--dark' : ''}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {entries.map((de, i) => (
        <div key={de.entry.id} className={`tray-entry${i > 0 ? ' tray-entry--divided' : ''}`}>
          {multi && (
            <div className="tray-entry-head">
              <button
                className="tray-entry-name day-col-recipe-link"
                onClick={() => onOpenRecipe?.(de.entry.recipeId)}
              >
                {de.entry.recipeName}
              </button>
              <StatusChip kind={de.kind === 'open' ? 'open' : de.kind} />
            </div>
          )}

          {de.missingNames.length > 0 && (
            <div className="tray-need">
              need {de.missingNames.slice(0, 2).join(', ')}
              {de.missingNames.length > 2 ? ` & ${de.missingNames.length - 2} more` : ''}
            </div>
          )}

          {isPast ? (
            <div className="tray-cooked">cooked{de.totalTimeMinutes ? ` · ${de.totalTimeMinutes} min` : ''}</div>
          ) : (
            <div className="tray-servings">
              <span className="tray-servings-label">servings</span>
              {onUpdateEntry ? (
                <div className="tray-stepper">
                  <button
                    type="button"
                    onClick={() => onUpdateEntry(de.entry.id, { servings: Math.max(1, de.entry.servings - 1) })}
                    aria-label="Fewer servings"
                  >–</button>
                  <span className="tray-stepper-val">{de.entry.servings}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateEntry(de.entry.id, { servings: de.entry.servings + 1 })}
                    aria-label="More servings"
                  >+</button>
                </div>
              ) : (
                <span className="tray-stepper-val">{de.entry.servings}</span>
              )}
              {de.totalTimeMinutes && <span className="tray-time">{de.totalTimeMinutes} min</span>}
            </div>
          )}

          <div className="tray-actions">
            {onOpenRecipe ? (
              <button className="tray-btn tray-btn--primary" onClick={() => onOpenRecipe(de.entry.recipeId)}>
                open recipe<span className="tray-btn-arrow"> →</span>
              </button>
            ) : (
              <Link to="/plan" className="tray-btn tray-btn--primary">
                manage in plan<span className="tray-btn-arrow"> →</span>
              </Link>
            )}
            {!isPast && (onMarkCookedEntry || onDeleteEntry) && (
              <div className="tray-actions-row">
                {de.entry.status === 'planned' && onMarkCookedEntry && (
                  <button className="tray-btn" onClick={() => onMarkCookedEntry(de.entry.id)} title="Mark cooked">
                    ✓ cooked
                  </button>
                )}
                {onDeleteEntry && (
                  <button
                    className="tray-btn tray-btn--ghost"
                    onClick={() => onDeleteEntry(de.entry.id)}
                    aria-label="Remove"
                  >
                    ✕ remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DayCard({
  iso,
  label,
  isToday,
  isPast,
  entries,
  expanded,
  onDropRecipe,
  onMoveEntry,
  onToggleExpand,
  onCloseTray,
}: {
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  entries: DayEntry[];
  expanded: boolean;
  onDropRecipe?: (recipeId: string) => void;
  onMoveEntry?: (entryId: string) => void;
  onToggleExpand: (iso: string, el: HTMLElement) => void;
  onCloseTray: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = entries.length >= MAX_ENTRIES_PER_DAY;

  const first = entries[0];
  const extra = entries.length - 1;
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (!onDropRecipe && !onMoveEntry) return;
    if (atCapacity || isPast) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes(DRAG_ENTRY_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_TYPE) ? 'copy' : 'move';
      setDragOver(true);
    }
  }

  function onDrop(e: React.DragEvent) {
    if (!onDropRecipe && !onMoveEntry) return;
    if (atCapacity || isPast) return;
    e.preventDefault();
    setDragOver(false);

    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId && onDropRecipe) { onDropRecipe(recipeId); return; }

    const entryId = e.dataTransfer.getData(DRAG_ENTRY_TYPE);
    const sourceDate = e.dataTransfer.getData(DRAG_ENTRY_DATE_TYPE);
    if (entryId && sourceDate !== iso && onMoveEntry) {
      onMoveEntry(entryId);
    }
  }

  function toggle() {
    if (first && ref.current) onToggleExpand(iso, ref.current);
  }

  return (
    <div
      ref={ref}
      className={[
        'day-col',
        dragOver && 'drag-over',
        isToday && 'today',
        isPast && 'past',
        expanded && 'expanded',
        !first && 'is-open',
      ].filter(Boolean).join(' ')}
      data-iso={iso}
      role={first ? 'button' : undefined}
      tabIndex={first ? 0 : undefined}
      aria-expanded={first ? expanded : undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={(e) => { if (first) { e.stopPropagation(); toggle(); } }}
      onKeyDown={(e) => {
        if (first && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); }
      }}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        {isToday && (
          <span className="day-col-context" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
            today.
          </span>
        )}
        {first && (
          <svg className="day-col-caret" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>

      {first ? (
        isPast ? (
          <div className="day-col-past-body">
            <div className="day-col-past-name-row">
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M2 6.5L4.5 9L10 3.5" stroke="var(--fresh)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="day-col-name day-col-name--past">{first.entry.recipeName}</span>
            </div>
            <div style={{ flex: 1 }} />
            <div className="day-col-foot">
              <span className="day-col-cooked-label">
                cooked{first.totalTimeMinutes ? ` · ${first.totalTimeMinutes}m` : ''}
              </span>
              {extra > 0 && <span className="day-col-more" aria-label={`${extra} more`}>+{extra}</span>}
            </div>
          </div>
        ) : (
          <>
            <div
              className="day-col-body"
              draggable={!!onMoveEntry}
              onDragStart={onMoveEntry ? (e) => {
                e.dataTransfer.setData(DRAG_ENTRY_TYPE, first.entry.id);
                e.dataTransfer.setData(DRAG_ENTRY_DATE_TYPE, iso);
                e.dataTransfer.effectAllowed = 'move';
                onCloseTray();
                e.stopPropagation();
              } : undefined}
            >
              <div className="day-col-image">
                {first.sourceImage
                  ? <img src={first.sourceImage} alt="" />
                  : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
              </div>
              <div className="day-col-name">{first.entry.recipeName}</div>
            </div>

            <div className="day-col-foot">
              <StatusChip kind={kind === 'open' ? 'open' : kind} />
              {extra > 0 && <span className="day-col-more" aria-label={`${extra} more`}>+{extra}</span>}
            </div>
          </>
        )
      ) : (
        <div className="day-col-empty">
          <div className="day-col-empty-title">open seat</div>
          {!isPast && <div className="day-col-empty-hint">+ add recipe</div>}
        </div>
      )}

      {atCapacity && !isPast && <div className="day-col-cap">max 4 recipes</div>}
    </div>
  );
}

export interface WeekCarouselProps {
  days: PlanWindowDay[];
  entriesByDay: Record<string, DayEntry[]>;
  loading?: boolean;
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  initialScrollIso?: string | null;
  onDropRecipe?: (date: string, recipeId: string) => void;
  onMoveEntry?: (entryId: string, targetDate: string) => void;
  onUpdateEntry?: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry?: (id: string) => void;
  onMarkCookedEntry?: (id: string) => void;
  onOpenRecipe?: (recipeId: string) => void;
}

export function WeekCarousel({
  days,
  entriesByDay,
  loading,
  scrollRef: externalRef,
  initialScrollIso,
  onDropRecipe,
  onMoveEntry,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
  onOpenRecipe,
}: WeekCarouselProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = externalRef ?? internalRef;
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const lastInitialScrollIso = useRef<string | null>(null);

  const closeTray = useCallback(() => setExpanded(null), []);

  const scrollToIso = useCallback((iso: string) => {
    if (!scrollRef.current) return;
    const target = scrollRef.current.querySelector<HTMLDivElement>(`.day-col[data-iso="${iso}"]`);
    if (!target) return;

    const parentLeft = scrollRef.current.getBoundingClientRect().left;
    const targetLeft = target.getBoundingClientRect().left;
    scrollRef.current.scrollLeft += targetLeft - parentLeft;
  }, [scrollRef]);

  const toggleExpand = useCallback((iso: string, el: HTMLElement) => {
    setExpanded((cur) => {
      if (cur && cur.iso === iso) return null;
      const day = days.find((d) => d.iso === iso);
      return { iso, rect: el.getBoundingClientRect(), isToday: !!day?.isToday, isPast: !!day?.isPast };
    });
  }, [days]);

  useEffect(() => {
    if (!expanded) return;
    const onDocClick = () => closeTray();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTray(); };
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', closeTray, true);
    window.addEventListener('resize', closeTray);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', closeTray, true);
      window.removeEventListener('resize', closeTray);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded, closeTray]);

  useEffect(() => {
    if (loading || !initialScrollIso || lastInitialScrollIso.current === initialScrollIso) return;
    scrollToIso(initialScrollIso);
    lastInitialScrollIso.current = initialScrollIso;
  }, [initialScrollIso, loading, scrollToIso]);

  return (
    <>
      {loading && <p className="plan-status">Loading…</p>}
      <div className="plan-week-scroll" ref={scrollRef}>
        <div className="plan-week-rail">
          {!loading && days.map((d) => (
            <DayCard
              key={d.iso}
              iso={d.iso}
              label={d.label}
              isToday={d.isToday}
              isPast={d.isPast}
              entries={entriesByDay[d.iso] ?? []}
              expanded={expanded?.iso === d.iso}
              onDropRecipe={onDropRecipe ? (recipeId) => onDropRecipe(d.iso, recipeId) : undefined}
              onMoveEntry={onMoveEntry ? (entryId) => onMoveEntry(entryId, d.iso) : undefined}
              onToggleExpand={toggleExpand}
              onCloseTray={closeTray}
            />
          ))}
        </div>
      </div>
      {expanded && (entriesByDay[expanded.iso]?.length ?? 0) > 0 && (
        <DayTray
          rect={expanded.rect}
          isToday={expanded.isToday}
          isPast={expanded.isPast}
          entries={entriesByDay[expanded.iso] ?? []}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}
          onMarkCookedEntry={onMarkCookedEntry ? (id) => { onMarkCookedEntry(id); closeTray(); } : undefined}
          onOpenRecipe={onOpenRecipe ? (id) => { onOpenRecipe(id); closeTray(); } : undefined}
        />
      )}
    </>
  );
}
