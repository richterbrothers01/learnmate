"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TestAnswer,
  TestQuestion,
  TestResult,
} from "./TestTaker";

/**
 * QuizTaker — practice quizzes (not chapter tests).
 *
 * Setup: the student picks 10, 30, 50, or custom marks. Custom marks are
 * validated (> 0, whole number) and are NEVER silently changed: if the
 * server reports the bank cannot satisfy the request, the error is shown
 * and the student picks again. Assumption (see README): 1 mark per
 * question, so "marks" also equals the number of questions requested.
 *
 * No-save behaviour matches TestTaker in one respect: answers live in
 * React state only during the quiz — no localStorage, no sessionStorage,
 * no mid-quiz persistence. The difference (per the brief) is that the
 * no-save DISCLAIMER does not apply: quiz attempts ARE recorded on
 * completion, via onSubmit, once the student submits.
 *
 * Like TestTaker, this component never receives correct answers before
 * submission; correctness appears only on the result screen.
 *
 * Styling: plain classNames only (btn-cream / btn-brown, lm-* namespace),
 * no hardcoded colours, no animations — see README.md.
 */

export type QuizGenerateResult =
  | { questions: TestQuestion[] }
  | { error: string };

export type QuizTakerProps = {
  chapterTitle: string;
  /**
   * Ask the server to build a quiz of `marks` marks. Returns questions
   * or a plain-language error (e.g. "Only 30 questions are available for
   * this chapter, so a 50-mark quiz cannot be built."). The component
   * displays that error verbatim and does NOT fall back to a different
   * mark total on its own.
   */
  onGenerate: (marks: number) => Promise<QuizGenerateResult>;
  /**
   * Submit a completed quiz. Same exactly-once contract as TestTaker:
   * the idempotencyKey is generated once per quiz and stable across
   * retries; the server must enforce it.
   */
  onSubmit: (
    answers: TestAnswer[],
    idempotencyKey: string,
  ) => Promise<TestResult>;
  onExit: () => void;
  /** Quizzes have no pass threshold: when true, the result screen shows
   * score only (no Passed/Not passed line). Dashboard passes this for quizzes. */
  hidePassFail?: boolean;
};

type Phase =
  | "setup"
  | "generating"
  | "taking"
  | "confirm-submit"
  | "submitting"
  | "result";

const PRESET_MARKS = [10, 30, 50] as const;

export default function QuizTaker({
  chapterTitle,
  onGenerate,
  onSubmit,
  onExit,
  hidePassFail = false,
}: QuizTakerProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedMarks, setSelectedMarks] = useState<number | "custom">(10);
  const [customMarks, setCustomMarks] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  /** questionId -> selected option text. Memory only. Never persisted. */
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);

  const resolvedMarks =
    selectedMarks === "custom" ? Number(customMarks) : selectedMarks;
  const customValid =
    selectedMarks !== "custom" ||
    (Number.isInteger(resolvedMarks) && resolvedMarks > 0);
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined,
  ).length;
  const unansweredCount = questions.length - answeredCount;
  const currentQuestion = questions[currentIndex];

  const startQuiz = useCallback(async () => {
    if (!customValid) {
      setSetupError("Custom marks must be a whole number greater than 0.");
      return;
    }
    setSetupError(null);
    setPhase("generating");
    const res = await onGenerate(resolvedMarks);
    if ("error" in res) {
      // Bank cannot satisfy the request: show it, do not silently adjust.
      setSetupError(res.error);
      setPhase("setup");
      return;
    }
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setQuestions(res.questions);
    setAnswers({});
    setCurrentIndex(0);
    setSubmitError(null);
    setResult(null);
    setPhase("taking");
  }, [customValid, onGenerate, resolvedMarks]);

  const doSubmit = useCallback(async () => {
    if (submitInFlightRef.current) return;
    if (!idempotencyKeyRef.current) return;
    submitInFlightRef.current = true;
    setSubmitError(null);
    setPhase("submitting");
    const payload: TestAnswer[] = questions.flatMap((q) => {
      const selected = answers[q.id];
      // Unanswered questions submit no answer entry for that question;
      // the server grades them as incorrect / zero marks.
      if (selected === undefined) return [];
      // The server grades by letter (A-D), but selections are stored as
      // option text; convert the selected text back to its letter.
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

  // Warn on refresh / tab close while a quiz is in progress. As with
  // tests, this warns only — it cannot save in-progress answers.
  useEffect(() => {
    if (phase !== "taking" && phase !== "confirm-submit") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  /* ---------------------------------- Setup --------------------------------- */
  if (phase === "setup" || phase === "generating") {
    return (
      <section className="lm-quiz-taker lm-quiz-setup" aria-labelledby="lm-quiz-title">
        <h2 id="lm-quiz-title">Practice quiz</h2>
        <p className="lm-chapter-title">{chapterTitle}</p>
        <p>
          Choose how many marks this quiz should be worth. Your answers are
          kept only while the quiz page is open; the quiz is recorded only
          when you submit it.
        </p>
        <fieldset>
          <legend>Quiz marks</legend>
          <div className="lm-marks-options" role="radiogroup">
            {PRESET_MARKS.map((marks) => (
              <label key={marks} className="lm-option-label">
                <input
                  type="radio"
                  name="quiz-marks"
                  checked={selectedMarks === marks}
                  onChange={() => setSelectedMarks(marks)}
                />
                <span>{marks} marks</span>
              </label>
            ))}
            <label className="lm-option-label">
              <input
                type="radio"
                name="quiz-marks"
                checked={selectedMarks === "custom"}
                onChange={() => setSelectedMarks("custom")}
              />
              <span>Custom marks</span>
            </label>
          </div>
          {selectedMarks === "custom" && (
            <label className="lm-custom-marks">
              Custom marks
              <input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={customMarks}
                onChange={(e) => setCustomMarks(e.target.value)}
                aria-describedby="lm-custom-marks-hint"
              />
              <span id="lm-custom-marks-hint">
                Enter a whole number greater than 0.
              </span>
            </label>
          )}
        </fieldset>
        {setupError && (
          <p className="lm-error" role="alert">
            {setupError}
          </p>
        )}
        <button
          type="button"
          className="btn-brown"
          disabled={phase === "generating" || !customValid}
          onClick={() => void startQuiz()}
        >
          {phase === "generating" ? "Building quiz…" : "Start quiz"}
        </button>
        <button type="button" className="btn-cream" onClick={onExit}>
          Go back
        </button>
      </section>
    );
  }

  /* --------------------------------- Result --------------------------------- */
  if (phase === "result" && result) {
    return (
      <section className="lm-quiz-taker lm-result" aria-labelledby="lm-quiz-result-title">
        <h2 id="lm-quiz-result-title">Quiz result</h2>
        <p className="lm-chapter-title">{chapterTitle}</p>
        <p>
          Score: {result.score} / {result.totalMarks}
          {!hidePassFail && (
            <>
              {" "}— {result.passed ? "Passed" : "Not passed"} (passing marks:{" "}
              {result.passingMarks})
            </>
          )}
        </p>
        <h3>Review your answers</h3>
        <ol className="lm-review-list">
          {result.perQuestion.map((q, i) => (
            <li key={q.questionId} className="lm-review-item">
              <p>
                Question {i + 1}: {q.text}
              </p>
              <ul>
                {q.options.map((option) => (
                  <li
                    key={option}
                    className={
                      option === q.correctAnswer
                        ? "lm-option-correct"
                        : option === q.selectedAnswer
                          ? "lm-option-selected-wrong"
                          : "lm-option"
                    }
                  >
                    {option}
                    {option === q.correctAnswer ? " — correct answer" : ""}
                    {option === q.selectedAnswer && option !== q.correctAnswer
                      ? " — your answer"
                      : ""}
                    {option === q.selectedAnswer && option === q.correctAnswer
                      ? " — your answer"
                      : ""}
                  </li>
                ))}
              </ul>
              <p>
                {q.selectedAnswer === null || q.selectedAnswer === ""
                  ? "You did not answer this question."
                  : q.isCorrect
                    ? `Correct — ${q.marksAwarded} mark(s).`
                    : "Incorrect — 0 marks."}
              </p>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-brown" onClick={onExit}>
          Done
        </button>
      </section>
    );
  }

  /* ------------------------------ Taking / dialogs --------------------------- */
  return (
    <section className="lm-quiz-taker" aria-labelledby="lm-quiz-title">
      <h2 id="lm-quiz-title">Practice quiz</h2>
      <p className="lm-chapter-title">{chapterTitle}</p>
      <p role="status">
        Answered: {answeredCount} of {questions.length} — Unanswered:{" "}
        {unansweredCount}
      </p>

      {submitError && (
        <p className="lm-error" role="alert">
          {submitError}
        </p>
      )}

      {currentQuestion && (
        <fieldset className="lm-question">
          <legend>
            Question {currentIndex + 1} of {questions.length}
          </legend>
          <p>{currentQuestion.text}</p>
          <div className="lm-options" role="radiogroup">
            {currentQuestion.options.map((option, idx) => (
              <label key={option} className="lm-option-label">
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  checked={answers[currentQuestion.id] === option}
                  onChange={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.id]: option,
                    }))
                  }
                />
                <span>
                  {String.fromCharCode(65 + idx)}) {option}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <nav className="lm-question-nav" aria-label="Question navigation">
        <button
          type="button"
          className="btn-cream"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-cream"
          disabled={currentIndex === questions.length - 1}
          onClick={() =>
            setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
          }
        >
          Next
        </button>
      </nav>

      <div className="lm-review-grid" aria-label="Review all questions">
        <p>Jump to a question (status is shown in words, not colour alone):</p>
        <ol>
          {questions.map((q, i) => (
            <li key={q.id}>
              <button
                type="button"
                className={i === currentIndex ? "btn-brown" : "btn-cream"}
                aria-label={`Question ${i + 1}: ${answers[q.id] !== undefined ? "answered" : "not answered"
                  }`}
                aria-current={i === currentIndex ? "true" : undefined}
                onClick={() => setCurrentIndex(i)}
              >
                {i + 1} ({answers[q.id] !== undefined ? "answered" : "unanswered"})
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="lm-test-actions">
        <button
          type="button"
          className="btn-brown"
          onClick={() => setPhase("confirm-submit")}
        >
          Submit quiz
        </button>
        <button type="button" className="btn-cream" onClick={onExit}>
          Leave quiz
        </button>
      </div>

      {phase === "confirm-submit" && (
        <div className="lm-dialog" role="dialog" aria-modal="true" aria-labelledby="lm-quiz-confirm-title">
          <h3 id="lm-quiz-confirm-title">Submit this quiz?</h3>
          <p>
            You have answered {answeredCount} of {questions.length} questions.
            {unansweredCount > 0 &&
              ` ${unansweredCount} question(s) will be marked incorrect.`}{" "}
            Once submitted, your answers cannot be changed.
          </p>
          <button
            type="button"
            className="btn-brown"
            onClick={() => void doSubmit()}
          >
            Yes, submit
          </button>
          <button
            type="button"
            className="btn-cream"
            onClick={() => setPhase("taking")}
          >
            Keep working
          </button>
        </div>
      )}

      {phase === "submitting" && (
        <p className="lm-submitting" role="status">
          Submitting… please do not close this page.
        </p>
      )}
    </section>
  );
}
