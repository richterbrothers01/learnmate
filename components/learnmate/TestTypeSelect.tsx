"use client";

import { useTypedText } from "./TestTaker";

/**
 * TestTypeSelect — the screen that appears immediately after the student
 * presses "Add test" for a resolved chapter test.
 *
 * Typewriter heading + fade-in (via the existing .reveal animation), then
 * two cards with iOS/macOS-style hover lift + slight glow. No new colours,
 * no new fonts: all styling lives in the dashboard CSS string.
 */

export type TestTypeSelectProps = {
  testTitle: string;
  chapterTitle: string;
  /** Start the test right now (mounts TestTaker, disclaimer first). */
  onDoNow: () => void;
  /** Open the schedule calendar for this chapter's test. */
  onSchedule: () => void;
  /** Back to the course / chapter picker. */
  onBack: () => void;
};

export default function TestTypeSelect({
  testTitle,
  chapterTitle,
  onDoNow,
  onSchedule,
  onBack,
}: TestTypeSelectProps) {
  const { shown, done } = useTypedText(
    "Select the type of test you want",
    30,
    true,
  );

  return (
    <section className="lm-tt-type reveal" aria-labelledby="lm-type-title">
      <p className="lm-tt-sub">
        {testTitle} · {chapterTitle}
      </p>
      <h2 id="lm-type-title" className="lm-tt-type-title">
        <span className="lm-tt-sr">Select the type of test you want</span>
        <span aria-hidden="true">{shown}</span>
        {!done && (
          <span className="type-cursor" aria-hidden="true">
            |
          </span>
        )}
      </h2>
      <div className="lm-tt-type-cards">
        <button type="button" className="lm-tt-type-card" onClick={onDoNow}>
          <h3>Do it now</h3>
          <p>Start the test right now.</p>
        </button>
        <button type="button" className="lm-tt-type-card" onClick={onSchedule}>
          <h3>Schedule the test</h3>
          <p>Pick a date and time. It will appear under Upcoming.</p>
        </button>
      </div>
      <button type="button" className="btn-cream lm-tt-type-back" onClick={onBack}>
        ← Back
      </button>
    </section>
  );
}
