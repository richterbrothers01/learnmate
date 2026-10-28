"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { prettyMath } from "./prettyMath";

/**
 * TestTaker — one test per chapter (30 MCQs, 1 mark each, total 30, pass at 18).
 *
 * NO-SAVE RULE (the most important behaviour in this file):
 * answers live in React state ONLY while this component is mounted.
 * There is deliberately NO localStorage, NO sessionStorage, and NO
 * fetch/DB write until the final submit. Closing, refreshing, or
 * navigating away discards everything and records no attempt. Only a
 * submitted test creates an attempt (server-side, via onSubmit).
 *
 * The component never receives correct answers. Props questions contain
 * id, text and options only; correctness appears solely on the result
 * screen, from the server's submit response, after submission.
 *
 * Mark 6 redesign:
 *  - Disclaimer: full screen, typewriter text, Cancel (left) / Start test (right).
 *  - Timer: pure-CSS conic-gradient ring (see .lm-tt-ring in the dashboard CSS)
 *    that depletes as time passes, remaining time in the centre.
 *  - Warnings: onTimeWarning fires ONCE each at 20, 10, 5 and 2 minutes left.
 *    The dashboard passes its existing showToast, so no new toast style exists.
 *  - Every question is its own screen with a typewriter effect. Next slides the
 *    screen to the right, Previous slides it to the left. No Previous on Q1.
 *  - Square numbered palette with answered / unanswered shown in words too.
 *
 * Styling: classNames only (lm-tt-* namespace, btn-cream / btn-brown). All CSS
 * lives in the dashboard CSS string, uses only the existing CSS variables, and
 * is covered by the existing prefers-reduced-motion rule. The one dynamic value
 * is the ring's --tt-p custom property, set inline once per tick.
 */

export type TestQuestion = {
  id: string;
  text: string;
  /** Exactly 4 option strings, in display order. No correct answer here. */
  options: string[];
};

export type TestAnswer = {
  questionId: string;
  /** The selected option's letter (A-D), as graded by the server. */
  answer: string;
};

export type TestResultQuestion = {
  questionId: string;
  text: string;
  options: string[];
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
};

export type TestResult = {
  score: number;
  totalMarks: number;
  passingMarks: number;
  passed: boolean;
  perQuestion: TestResultQuestion[];
};

export type TestTakerProps = {
  testTitle: string;
  chapterTitle: string;
  /** Default 30 minutes. */
  durationMinutes?: number;
  questions: TestQuestion[];
  /**
   * Called exactly once per submission attempt. The idempotencyKey is
   * generated once when the test starts and is stable across retries of
   * the same submission, so a double-click or a retried request cannot
   * create a second attempt. The server enforces exactly-once submission.
   */
  onSubmit: (
    answers: TestAnswer[],
    idempotencyKey: string,
  ) => Promise<TestResult>;
  /** Called when the student deliberately leaves (after confirmation) or cancels. */
  onExit: () => void;
  /**
   * Called with a ready-to-show message ("⏰ 20 minutes left!") when the
   * remaining time reaches exactly 20, 10, 5 and 2 minutes. Wire it to the
   * app's existing toast.
   */
  onTimeWarning?: (message: string) => void;
};

type Phase =
  | "disclaimer"
  | "taking"
  | "confirm-submit"
  | "confirm-leave"
  | "submitting"
  | "result";

type SlideDirection = "next" | "prev";

/** Seconds-left thresholds that raise a warning. Exactly these four. */
const WARNING_THRESHOLDS = [1200, 600, 300, 120] as const;
const SLIDE_MS = 340;

/** Disclaimer copy. First entry is the heading, the rest are the points. */
const DISCLAIMER_LINES = [
  "Before you start",
  "The passing percentage is 18 out of 30 (60%).",
  "If the student leaves while doing the test, then the test will be cancelled.",
  "Test quality may differ based on internet connectivity.",
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Typewriter for a single string. Instant under prefers-reduced-motion. */
export function useTypedText(
  text: string,
  msPerChar = 30,
  enabled = true,
): { shown: string; done: boolean } {
  const [count, setCount] = useState(() =>
    enabled && !prefersReducedMotion() ? 0 : text.length,
  );

  useEffect(() => {
    if (!enabled || prefersReducedMotion() || !text) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar, enabled]);

  return { shown: text.slice(0, count), done: count >= text.length };
}

/** Typewriter across several lines, typed one after another. */
function useTypedLines(lines: string[], msPerChar = 22) {
  const total = useMemo(
    () => lines.reduce((n, l) => n + l.length, 0),
    [lines],
  );
  const [count, setCount] = useState(() =>
    prefersReducedMotion() ? total : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(total);
      return;
    }
    setCount(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= total) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [total, msPerChar]);

  let remaining = count;
  const shown = lines.map((line) => {
    const n = Math.max(0, Math.min(line.length, remaining));
    remaining -= n;
    return line.slice(0, n);
  });
  const done = count >= total;
  const active = done
    ? lines.length - 1
    : shown.findIndex((s, i) => s.length < lines[i].length);

  return { shown, active, done };
}

/* ------------------------------ Timer ring ------------------------------ */

function TimerRing({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const style = { "--tt-p": pct.toFixed(3) } as CSSProperties;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <div
      className={remaining <= 120 ? "lm-tt-ring is-urgent" : "lm-tt-ring"}
      style={style}
      role="timer"
      aria-label={`Time left: ${minutes} minutes ${seconds} seconds`}
    >
      <span className="lm-tt-ring-knob" aria-hidden="true" />
      <span className="lm-tt-ring-core">
        <time dateTime={`PT${remaining}S`}>{formatCountdown(remaining)}</time>
      </span>
    </div>
  );
}

/* --------------------------- One question screen --------------------------- */

type QuestionScreenProps = {
  question: TestQuestion;
  index: number;
  total: number;
  selected: string | undefined;
  /** Typewriter on first visit only; revisits show instantly. */
  animate: boolean;
  readOnly?: boolean;
  onSelect?: (option: string) => void;
  onTyped?: (questionId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
};

function QuestionScreen({
  question,
  index,
  total,
  selected,
  animate,
  readOnly = false,
  onSelect,
  onTyped,
  onPrev,
  onNext,
  onSubmit,
}: QuestionScreenProps) {
  // Display only: the typewriter types the prettified text, while the
  // stored question, selection and grading all keep the raw strings.
  const displayText = prettyMath(question.text);
  const speed = Math.max(
    8,
    Math.min(26, Math.round(1100 / Math.max(1, displayText.length))),
  );
  const { shown, done } = useTypedText(displayText, speed, animate);

  useEffect(() => {
    if (done) onTyped?.(question.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const answered = selected !== undefined;
  const isLast = index === total - 1;

  return (
    <div className="lm-tt-qwin">
      <div className="lm-tt-qhead">
        <span className="lm-tt-qcount">
          Question {index + 1} of {total}
        </span>
        <span className={answered ? "lm-tt-qstate is-answered" : "lm-tt-qstate"}>
          {answered ? "Answered" : "Not answered yet"}
        </span>
      </div>

      <h3 className="lm-tt-qtext" aria-label={displayText}>
        <span aria-hidden="true">{shown}</span>
        {!done && (
          <span className="type-cursor" aria-hidden="true">
            |
          </span>
        )}
      </h3>

      <div
        className={done ? "lm-tt-options is-in" : "lm-tt-options"}
        role="radiogroup"
        aria-label="Answer options"
      >
        {question.options.map((option, idx) => (
          <label
            key={idx}
            className={
              selected === option ? "lm-tt-opt is-selected" : "lm-tt-opt"
            }
          >
            <input
              className="lm-tt-radio"
              type="radio"
              name={`question-${question.id}`}
              checked={selected === option}
              disabled={readOnly}
              onChange={() => onSelect?.(option)}
            />
            <span className="lm-tt-opt-key" aria-hidden="true">
              {String.fromCharCode(65 + idx)}
            </span>
            <span className="lm-tt-opt-text">{prettyMath(option)}</span>
          </label>
        ))}
      </div>

      <div className="lm-tt-nav">
        {index > 0 ? (
          <button
            type="button"
            className="btn-cream"
            disabled={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            onClick={onPrev}
          >
            Previous
          </button>
        ) : (
          <span />
        )}
        {isLast ? (
          <button
            type="button"
            className="btn-brown"
            disabled={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            onClick={onSubmit}
          >
            Submit test
          </button>
        ) : (
          <button
            type="button"
            className="btn-brown"
            disabled={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            onClick={onNext}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Main --------------------------------- */

export default function TestTaker({
  testTitle,
  chapterTitle,
  durationMinutes = 30,
  questions,
  onSubmit,
  onExit,
  onTimeWarning,
}: TestTakerProps) {
  const [phase, setPhase] = useState<Phase>("disclaimer");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [leaving, setLeaving] = useState<{
    index: number;
    dir: SlideDirection;
  } | null>(null);
  const [direction, setDirection] = useState<SlideDirection>("next");
  /** questionId -> selected option text. Memory only. Never persisted. */
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(
    durationMinutes * 60,
  );
  const [result, setResult] = useState<TestResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Generated once per test start; stable across submit retries. */
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const endAtRef = useRef(0);
  const expiredRef = useRef(false);
  const warnedRef = useRef<Set<number>>(new Set());
  const typedRef = useRef<Set<string>>(new Set());
  const slideTimerRef = useRef<number | null>(null);
  const doSubmitRef = useRef<() => Promise<void>>(async () => { });
  const onTimeWarningRef = useRef(onTimeWarning);
  onTimeWarningRef.current = onTimeWarning;

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );
  const unansweredCount = questions.length - answeredCount;

  // No scroll lock: the test scrolls with the page (see .lm-tt).

  useEffect(
    () => () => {
      if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current);
    },
    [],
  );

  const startTest = useCallback(() => {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    endAtRef.current = Date.now() + durationMinutes * 60 * 1000;
    expiredRef.current = false;
    warnedRef.current = new Set();
    typedRef.current = new Set();
    setAnswers({});
    setCurrentIndex(0);
    setLeaving(null);
    setDirection("next");
    setRemainingSeconds(durationMinutes * 60);
    setSubmitError(null);
    setResult(null);
    setPhase("taking");
  }, [durationMinutes]);

  const doSubmit = useCallback(async () => {
    if (submitInFlightRef.current) return;
    if (!idempotencyKeyRef.current) return;
    submitInFlightRef.current = true;
    setSubmitError(null);
    setPhase("submitting");
    const payload: TestAnswer[] = questions.flatMap((q) => {
      const selected = answers[q.id];
      // Unanswered questions submit no entry; the server grades them as 0.
      if (selected === undefined) return [];
      // The server grades by letter (A-D); selections are stored as option
      // text, so convert the selected text back to its letter.
      const optionIndex = q.options.indexOf(selected);
      if (optionIndex < 0) return [];
      return [{ questionId: q.id, answer: String.fromCharCode(65 + optionIndex) }];
    });
    try {
      const res = await onSubmit(payload, idempotencyKeyRef.current);
      setResult(res);
      setPhase("result");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed. Your answers are still on this page — try again.",
      );
      setPhase("taking");
    } finally {
      submitInFlightRef.current = false;
    }
  }, [questions, answers, onSubmit]);
  doSubmitRef.current = doSubmit;

  /**
   * Countdown. Deadline-based (not tick-counting), so a throttled background
   * tab cannot drift. It also keeps running while a confirm dialog is open,
   * so opening "Submit?" can no longer freeze the clock. Auto-submits at zero.
   */
  const timerActive =
    phase === "taking" || phase === "confirm-submit" || phase === "confirm-leave";

  useEffect(() => {
    if (!timerActive) return;
    const totalSeconds = durationMinutes * 60;

    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000),
      );
      setRemainingSeconds((prev) => (prev === left ? prev : left));

      // Warn once per threshold. If a throttled tab skipped past several,
      // announce only the nearest one.
      const crossed = WARNING_THRESHOLDS.filter(
        (t) =>
          t < totalSeconds &&
          left > 0 &&
          left <= t &&
          !warnedRef.current.has(t),
      );
      if (crossed.length > 0) {
        crossed.forEach((t) => warnedRef.current.add(t));
        const minutes = Math.min(...crossed) / 60;
        onTimeWarningRef.current?.(`⏰ ${minutes} minutes left!`);
      }

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        void doSubmitRef.current();
      }
    };

    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timerActive, durationMinutes]);

  // Warn on refresh / tab close while a test is in progress. This cannot
  // prevent data loss — that is the point of the no-save rule — it only warns.
  useEffect(() => {
    if (!timerActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [timerActive]);

  // Escape closes a confirm dialog.
  useEffect(() => {
    if (phase !== "confirm-submit" && phase !== "confirm-leave") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("taking");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const selectOption = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const goTo = (target: number) => {
    if (target < 0 || target >= questions.length || target === currentIndex) {
      return;
    }
    const dir: SlideDirection = target > currentIndex ? "next" : "prev";
    setDirection(dir);
    if (!prefersReducedMotion()) {
      setLeaving({ index: currentIndex, dir });
      if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current);
      slideTimerRef.current = window.setTimeout(
        () => setLeaving(null),
        SLIDE_MS,
      );
    }
    setCurrentIndex(target);
  };

  const markTyped = useCallback((id: string) => {
    typedRef.current.add(id);
  }, []);

  /* ------------------------------- Disclaimer ------------------------------ */
  if (phase === "disclaimer") {
    return (
      <DisclaimerScreen
        testTitle={testTitle}
        chapterTitle={chapterTitle}
        onCancel={onExit}
        onStart={startTest}
      />
    );
  }

  /* --------------------------------- Result -------------------------------- */
  if (phase === "result" && result) {
    return (
      <section
        className="lm-tt lm-tt-result"
        aria-labelledby="lm-result-title"
      >
        <div className="lm-tt-result-inner">
          <h2 id="lm-result-title" className="lm-tt-result-title">
            Test result
          </h2>
          <p className="lm-tt-sub">{chapterTitle}</p>

          <div className="lm-tt-score">
            <b>
              {result.score} / {result.totalMarks}
            </b>
            <span>
              {result.passed ? "Passed" : "Not passed"} · passing marks:{" "}
              {result.passingMarks}
            </span>
          </div>

          <h3 className="lm-tt-review-title">Review your answers</h3>
          <ol className="lm-tt-review">
            {result.perQuestion.map((q, i) => (
              <li key={q.questionId} className="lm-tt-review-item">
                <p className="lm-tt-review-q">
                  Question {i + 1}: {prettyMath(q.text)}
                </p>
                <ul className="lm-tt-review-opts">
                  {q.options.map((option, idx) => {
                    const isCorrect = option === q.correctAnswer;
                    const isPicked = option === q.selectedAnswer;
                    return (
                      <li
                        key={idx}
                        className={
                          isCorrect
                            ? "lm-tt-rev-opt is-correct"
                            : isPicked
                              ? "lm-tt-rev-opt is-wrong"
                              : "lm-tt-rev-opt"
                        }
                      >
                        {prettyMath(option)}
                        {isCorrect ? " — correct answer" : ""}
                        {isPicked ? " — your answer" : ""}
                      </li>
                    );
                  })}
                </ul>
                <p className="lm-tt-review-note">
                  {q.selectedAnswer === null || q.selectedAnswer === ""
                    ? "You did not answer this question."
                    : q.isCorrect
                      ? `Correct — ${q.marksAwarded} mark(s).`
                      : "Incorrect — 0 marks."}
                </p>
              </li>
            ))}
          </ol>

          <div className="lm-tt-result-actions">
            <button type="button" className="btn-brown" onClick={onExit}>
              Done
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ------------------------------ Taking / dialogs -------------------------- */
  const currentQuestion = questions[currentIndex];
  const leavingQuestion = leaving ? questions[leaving.index] : null;

  return (
    <section className="lm-tt lm-tt-live" aria-labelledby="lm-test-title">
      <header className="lm-tt-top">
        <div className="lm-tt-heading">
          <h2 id="lm-test-title">{testTitle}</h2>
          <p className="lm-tt-sub">{chapterTitle}</p>
        </div>
        <TimerRing
          remaining={remainingSeconds}
          total={durationMinutes * 60}
        />
      </header>

      {submitError && (
        <p className="lm-error lm-tt-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="lm-tt-body">
        <div className="lm-tt-stage">
          {leaving && leavingQuestion && (
            <div
              className={`lm-tt-screen lm-tt-out-${leaving.dir}`}
              aria-hidden="true"
            >
              <QuestionScreen
                question={leavingQuestion}
                index={leaving.index}
                total={questions.length}
                selected={answers[leavingQuestion.id]}
                animate={false}
                readOnly
              />
            </div>
          )}
          {currentQuestion && (
            <div
              key={currentQuestion.id}
              className={
                leaving
                  ? `lm-tt-screen lm-tt-in-${direction}`
                  : "lm-tt-screen"
              }
            >
              <QuestionScreen
                question={currentQuestion}
                index={currentIndex}
                total={questions.length}
                selected={answers[currentQuestion.id]}
                animate={!typedRef.current.has(currentQuestion.id)}
                onSelect={(option) => selectOption(currentQuestion.id, option)}
                onTyped={markTyped}
                onPrev={() => goTo(currentIndex - 1)}
                onNext={() => goTo(currentIndex + 1)}
                onSubmit={() => setPhase("confirm-submit")}
              />
            </div>
          )}
        </div>

        <aside className="lm-tt-panel" aria-label="Question navigator">
          <h3 className="lm-tt-panel-title">Question Analysis</h3>
          <p className="lm-tt-legend">
            <span className="lm-tt-dot is-answered" aria-hidden="true" />
            <span>Answered - {answeredCount}</span>
            <span className="lm-tt-legend-sep" aria-hidden="true" />
            <span className="lm-tt-dot" aria-hidden="true" />
            <span>Unanswered - {unansweredCount}</span>
          </p>
          <ol className="lm-tt-grid">
            {questions.map((q, i) => {
              const isAnswered = answers[q.id] !== undefined;
              const cls = [
                "lm-tt-box",
                isAnswered ? "is-answered" : "",
                i === currentIndex ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={cls}
                    aria-label={`Question ${i + 1}: ${isAnswered ? "answered" : "not answered"
                      }`}
                    title={isAnswered ? "Answered" : "Unanswered"}
                    aria-current={i === currentIndex ? "true" : undefined}
                    onClick={() => goTo(i)}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="btn-brown lm-tt-submit"
            onClick={() => setPhase("confirm-submit")}
          >
            Submit test
          </button>
          <button
            type="button"
            className="btn-cream lm-tt-leave"
            onClick={() => setPhase("confirm-leave")}
          >
            Leave test
          </button>
        </aside>
      </div>

      {phase === "confirm-submit" && (
        <div className="lm-tt-scrim">
          <div
            className="lm-tt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lm-confirm-submit-title"
          >
            <h3 id="lm-confirm-submit-title">Submit this test?</h3>
            <p>
              You have answered {answeredCount} of {questions.length}{" "}
              questions.
              {unansweredCount > 0 &&
                ` ${unansweredCount} question(s) will be marked incorrect.`}{" "}
              Once submitted, your answers cannot be changed.
            </p>
            <div className="lm-tt-dialog-actions">
              <button
                type="button"
                className="btn-cream"
                onClick={() => setPhase("taking")}
              >
                Keep working
              </button>
              <button
                type="button"
                className="btn-brown"
                onClick={() => void doSubmit()}
              >
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "confirm-leave" && (
        <div className="lm-tt-scrim">
          <div
            className="lm-tt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lm-confirm-leave-title"
          >
            <h3 id="lm-confirm-leave-title">Leave without submitting?</h3>
            <p>
              If you leave now, all your answers on this page are discarded and
              nothing is recorded. You will have to start the test again from
              the first question.
            </p>
            <div className="lm-tt-dialog-actions">
              <button
                type="button"
                className="btn-cream"
                onClick={() => setPhase("taking")}
              >
                Stay on this test
              </button>
              <button type="button" className="btn-brown" onClick={onExit}>
                Yes, leave and discard
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <div className="lm-tt-scrim">
          <p className="lm-tt-submitting" role="status">
            Submitting… please do not close this page.
          </p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Disclaimer ------------------------------ */

function DisclaimerScreen({
  testTitle,
  chapterTitle,
  onCancel,
  onStart,
}: {
  testTitle: string;
  chapterTitle: string;
  onCancel: () => void;
  onStart: () => void;
}) {
  const { shown, active } = useTypedLines(DISCLAIMER_LINES, 22);
  const [heading, ...points] = DISCLAIMER_LINES;
  const typedPoints = shown.slice(1);

  return (
    <section
      className="lm-tt lm-tt-disclaimer"
      aria-labelledby="lm-tt-dis-title"
    >
      <div className="lm-tt-dis-body">
        <p className="lm-tt-sub">
          {testTitle} · {chapterTitle}
        </p>
        <h2 id="lm-tt-dis-title" className="lm-tt-dis-title">
          <span className="lm-tt-sr">{heading}</span>
          <span aria-hidden="true">{shown[0]}</span>
          {active === 0 && (
            <span className="type-cursor" aria-hidden="true">
              |
            </span>
          )}
        </h2>
        <ul className="lm-tt-dis-list">
          {points.map((full, i) => (
            <li key={full} className="lm-tt-dis-item">
              <span className="lm-tt-sr">{full}</span>
              <span aria-hidden="true">
                {typedPoints[i]}
                {active === i + 1 && (
                  <span className="type-cursor">|</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lm-tt-dis-actions">
        <button type="button" className="btn-cream" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-brown" onClick={onStart}>
          Start test
        </button>
      </div>
    </section>
  );
}
