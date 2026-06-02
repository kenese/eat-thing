import { useMemo, useState } from 'react';
import { addDays, toIsoDate } from '../lib/dateUtils';
import './DatePickerModal.css';

export interface DatePickerModalProps {
  initialDate: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthGridStart(month: Date): Date {
  const firstDay = startOfMonth(month);
  const dayOfWeek = firstDay.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDays(firstDay, offset);
}

function formatMonthHeading(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatDayLabel(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday} ${date.getDate()} ${month} ${date.getFullYear()}`;
}

export function DatePickerModal({ initialDate, onConfirm, onClose }: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(parseIsoDate(initialDate)));

  const dayCells = useMemo(() => {
    const gridStart = monthGridStart(displayMonth);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const iso = toIsoDate(date);
      return {
        date,
        iso,
        label: formatDayLabel(date),
        isCurrentMonth: date.getMonth() === displayMonth.getMonth(),
      };
    });
  }, [displayMonth]);

  const selectedLabel = useMemo(() => formatDayLabel(parseIsoDate(selectedDate)), [selectedDate]);

  return (
    <div className="date-picker-overlay" role="dialog" aria-modal="true" aria-label="Choose a date">
      <div className="date-picker-panel">
        <div className="date-picker-header">
          <div>
            <p className="date-picker-eyebrow">load date</p>
            <h2 className="date-picker-title">
              Choose a date<span className="dot">.</span>
            </h2>
          </div>
          <button className="date-picker-close" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="date-picker-month-row">
          <button
            className="date-picker-month-btn"
            type="button"
            onClick={() =>
              setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="date-picker-month-label">{formatMonthHeading(displayMonth)}</p>
          <button
            className="date-picker-month-btn"
            type="button"
            onClick={() =>
              setDisplayMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="date-picker-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="date-picker-weekday">
              {label}
            </span>
          ))}
        </div>

        <div className="date-picker-grid">
          {dayCells.map((day) => (
            <button
              key={day.iso}
              className={[
                'date-picker-day',
                day.iso === selectedDate && 'date-picker-day--selected',
                !day.isCurrentMonth && 'date-picker-day--outside',
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              onClick={() => setSelectedDate(day.iso)}
              aria-label={day.label}
              aria-pressed={day.iso === selectedDate}
            >
              {day.date.getDate()}
            </button>
          ))}
        </div>

        <div className="date-picker-actions">
          <button className="btn-outline" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={() => onConfirm(selectedDate)}
            aria-label={`choose ${selectedLabel.toLowerCase()}`}
          >
            choose {selectedLabel.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
