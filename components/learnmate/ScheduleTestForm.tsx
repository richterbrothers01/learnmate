"use client";

import { useMemo, useState } from "react";
import { useTypedText } from "./TestTaker";

/**
 * ScheduleTestForm — decluttered Mark 6 version.
 *
 * The screen shows exactly one thing: the typewriter heading
 * "Schedule your test" and the custom CSS calendar (month + year
 * selectors, a day grid with past days disabled, hour / minute
 * selectors). No "How scheduling works" explainer, no per-chapter
 * schedule list — scheduled tests live in the Tests section's
 * Upcoming tab. After a successful schedule, the parent returns to
 * the Tests list (Upcoming tab).
 *
 * Props: onCreate receives an ISO 8601 timestamp (UTC) for the picked
 * local date + time. onBack returns to the type-select screen.
 * Schedule / ScheduleStatus types are kept as exports for callers
 * that import them, even though this screen no longer lists schedules.
 */

export type ScheduleStatus =
  | "scheduled"
  | "available"
  | "completed"
  | "missed"
  | "cancelled";

export type Schedule = {
  id: string;
  /** ISO 8601 timestamp, as stored by the server. */
  scheduledAtISO: string;
  status: ScheduleStatus;
};

export type ScheduleTestFormProps = {
  /** Create a schedule. Receives an ISO 8601 timestamp (UTC). */
  onCreate: (scheduledAtISO: string) => Promise<void>;
  /** Back action (Add-test flow). */
  onBack: () => void;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ScheduleTestForm({
  onCreate,
  onBack,
}: ScheduleTestFormProps) {
  const today = useMemo(() => startOfToday(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { shown: titleShown, done: titleDone } = useTypedText(
    "Schedule your test",
    30,
    true,
  );

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const yearOptions = [today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2];

  const goMonth = (delta: number) => {
    setSelectedDay(null);
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const chosenDate =
    selectedDay === null
      ? null
      : new Date(viewYear, viewMonth, selectedDay, hour, minute);

  const handleCreate = async () => {
    setFormError(null);
    if (selectedDay === null || !chosenDate) {
      setFormError("Pick a date first.");
      return;
    }
    if (Number.isNaN(chosenDate.getTime())) {
      setFormError("That date and time could not be understood. Pick again.");
      return;
    }
    if (chosenDate.getTime() <= Date.now()) {
      setFormError("The scheduled time must be in the future.");
      return;
    }
    setCreating(true);
    try {
      // The picked date + time are in the student's local timezone;
      // converting with toISOString produces the matching UTC instant.
      await onCreate(chosenDate.toISOString());
      setSelectedDay(null);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Could not save this schedule. Try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="lm-schedule-form" aria-labelledby="lm-schedule-title">
      <button type="button" className="btn-cream" onClick={onBack}>
        ← Back
      </button>
      <h2 id="lm-schedule-title">
        <span className="lm-tt-sr">Schedule your test</span>
        <span aria-hidden="true">📅 {titleShown}</span>
        {!titleDone && (
          <span className="type-cursor" aria-hidden="true">
            |
          </span>
        )}
      </h2>

      <div className="lm-cal">
        <div className="lm-cal-head">
          <span className="lm-cal-title">📅 Pick a date</span>
          <select
            className="lm-cal-select"
            aria-label="Month"
            value={viewMonth}
            onChange={(e) => {
              setSelectedDay(null);
              setViewMonth(Number(e.target.value));
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="lm-cal-select"
            aria-label="Year"
            value={viewYear}
            onChange={(e) => {
              setSelectedDay(null);
              setViewYear(Number(e.target.value));
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="lm-cal-navbtn"
            aria-label="Previous month"
            onClick={() => goMonth(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="lm-cal-navbtn"
            aria-label="Next month"
            onClick={() => goMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="lm-cal-week" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="lm-cal-days" role="grid" aria-label="Calendar days">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <span key={`blank-${i}`} className="lm-cal-blank" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(viewYear, viewMonth, day);
            const isPast = date < today;
            const isToday = date.getTime() === today.getTime();
            const isSelected = selectedDay === day;
            const cls = [
              "lm-cal-day",
              isToday ? "is-today" : "",
              isSelected ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={day}
                type="button"
                className={cls}
                disabled={isPast}
                aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="lm-cal-time">
          <label>
            Hour
            <select
              className="lm-cal-select"
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minute
            <select
              className="lm-cal-select"
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="lm-cal-foot">
          <span className="lm-cal-summary">
            {chosenDate
              ? `Selected: ${chosenDate.toLocaleString()}`
              : "No date picked yet."}
          </span>
          <button
            type="button"
            className="btn-brown"
            disabled={creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Saving…" : "Schedule test"}
          </button>
        </div>

        {formError && (
          <p className="lm-error" role="alert">
            {formError}
          </p>
        )}
      </div>
    </section>
  );
}
