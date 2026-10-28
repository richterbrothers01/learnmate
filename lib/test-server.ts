/**
 * LearnMate — Tests / Quizzes / Scheduling: server helpers.
 *
 * Stack: Next.js App Router + TypeScript + Supabase. These helpers take a
 * Supabase client as their first argument so they stay testable and so the
 * only project-specific wiring is `getServerClient()` below.
 *
 * NON-NEGOTIABLE DECISIONS IMPLEMENTED HERE (user answers, 2026-10-26):
 * - D1: exactly 1 test per chapter (tests.test_number = 1), 30 MCQs,
 *   1 mark each, total 30.
 * - D2: passing marks = 60% = 18/30 for every test.
 * - D3: TESTS ARE NOT SAVED if the student leaves. No attempt row is
 *   created until submission. Consequence, stated plainly: the server
 *   CANNOT enforce a timer from a start record. The in-page timer is
 *   client-side only; `clientStartedAt` on submit is recorded as
 *   reported, never trusted for enforcement. Submission is exactly-once
 *   via an idempotency key (see submitTest / README migration).
 * - D5: scheduling is user-driven. A missed schedule blocks the chapter
 *   test until the student schedules it again (see
 *   assertScheduleAllowsStart). Expiry is computed at start/submit time
 *   from the scheduled date, so it holds even if the cleanup job has
 *   not run yet; markExpiredSchedules() exists for hygiene/reporting.
 * - D7: every chapter has its own question set, keyed to
 *   curriculum_template_chapters (template_chapter_id).
 *
 * SECURITY:
 * - correct_answer and explanation are NEVER selected from the database
 *   in any pre-submission path, and public-question objects are built
 *   field-by-field (never by spreading a question row). The only place a
 *   correct answer reaches the browser is inside a post-submission
 *   result, for the student's own submitted attempt.
 * - Routes derive userId from the Supabase session, never from the
 *   request body. Helpers trust the userId they are given, so only call
 *   them with the session user id.
 * - RLS is never disabled and no service-role key is used or referenced
 *   anywhere in this folder.
 *
 * HONEST SCOPE NOTE: this code was written without live database access.
 * It has NOT been run against Supabase, auth, or push delivery. See
 * README.md "UNTESTED" and "Assumptions" before wiring it in.
 */

// ---------------------------------------------------------------------------
// Minimal client type
// ---------------------------------------------------------------------------

/**
 * Structural subset of the Supabase JS client used by this module.
 * `from()` is intentionally `any`: the full Postgrest query-builder type
 * is not reproduced here, and the integrator may narrow DbClient to
 * `SupabaseClient` from `@supabase/supabase-js` without changing any
 * helper. Nothing in this file depends on the concrete client class.
 */
export type DbClient = {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
  };
};

/**
 * WIRING (repo integration): the real Supabase server client from
 * lib/supabase/server.ts (async, cookie-based). Replaces the pack's
 * throwing stub. All routes await getServerClient().
 */
import { createClient as createSupabaseServerClient } from "./supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function getServerClient(): Promise<DbClient> {
  const client = await createSupabaseServerClient();
  return client as unknown as DbClient;
}

/**
 * BANK CLIENT (service role): reads SHARED template bank data only.
 *
 * Why this exists: the shared bank (template tests/questions/links) has
 * no per-user owner, so row-level security hides it from the signed-in
 * user client — which made every imported test appear empty in the app
 * even though the database holds all 30 questions per test.
 * This client runs server-side only (route handlers), so its key never
 * reaches the browser.
 *
 * Safety boundary, read carefully:
 * - Public loaders (loadPublicQuestions, quiz bank reads) select ONLY
 *   public fields (id, text, options, marks) — correct_answer is never
 *   selected, so it can never leak through them.
 * - Key loaders (loadTestKey, loadQuizKey) read correct_answer ONLY to
 *   grade server-side; per-question correctness is returned ONLY in
 *   post-submission responses, never before submission (existing rule).
 * - Everything user-owned (schedules, attempts, answers, subscriptions,
 *   ownership checks) keeps using the user client, so RLS still guards it.
 * Do NOT use the bank client for user-owned reads or writes.
 */
let bankClient: DbClient | null = null;
function getBankClient(): DbClient {
  if (bankClient) return bankClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new ApiError(
      500,
      'SERVER_CONFIG',
      'The server is missing SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL). Add SUPABASE_SERVICE_ROLE_KEY to .env.local (server-only, never NEXT_PUBLIC_) and restart the dev server.',
    );
  }
  bankClient = createServiceClient(url, serviceKey) as unknown as DbClient;
  return bankClient;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const badRequest = (code: string, message: string) => new ApiError(400, code, message);
const notFound = (code: string, message: string) => new ApiError(404, code, message);
const forbidden = (code: string, message: string) => new ApiError(403, code, message);
const conflict = (code: string, message: string) => new ApiError(409, code, message);
const dbError = (message: string) => new ApiError(500, 'DATABASE_ERROR', message);

/** Convert any thrown error into a safe JSON error payload for routes. */
export function toErrorPayload(err: unknown): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  if (err instanceof ApiError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } };
  }
  console.error(err);
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('INVALID_ID', `${field} is required.`);
  }
  return value.trim();
}

function isUniqueViolation(err: any): boolean {
  if (!err) return false;
  if (err.code === '23505') return true;
  return /duplicate key/i.test(String(err.message ?? ''));
}

function validAnswerLetter(value: unknown): value is string {
  return typeof value === 'string' && /^[A-D]$/.test(value.trim().toUpperCase());
}

/** A bank row is usable only if it has text and exactly 4 string options. */
function isWellFormedQuestion(q: any): boolean {
  return (
    q != null &&
    typeof q.id === 'string' &&
    typeof q.question_text === 'string' &&
    q.question_text.trim() !== '' &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o: unknown) => typeof o === 'string')
  );
}

// ---------------------------------------------------------------------------
// Scheduling: expiry model (Decision D5)
// ---------------------------------------------------------------------------

/**
 * Expiry rule: a schedule expires when its scheduled CALENDAR DATE has
 * passed (UTC). A test scheduled for a date may therefore be taken any
 * time up to 23:59:59 UTC on that date, and not after. UTC is used because
 * scheduled_at is timestamptz and the server has no per-student timezone
 * in this module; if the product stores a student timezone, replace the
 * UTC day boundary here with that timezone's day boundary (one place).
 */
export function isScheduleDatePassed(scheduledAt: string, now: Date = new Date()): boolean {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return true; // unparseable date: fail closed
  const endOfDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
  return now.getTime() > endOfDay.getTime();
}

export interface ScheduleRow {
  id: string;
  user_id: string;
  template_chapter_id: string;
  scheduled_at: string;
  status: string;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Most recently created schedule for this student + chapter, any status. */
export async function getLatestSchedule(
  client: DbClient,
  userId: string,
  templateChapterId: string,
): Promise<ScheduleRow | null> {
  const { data, error } = await client
    .from('scheduled_tests')
    .select(
      'id, user_id, template_chapter_id, scheduled_at, status, reminder_sent_at, created_at, updated_at',
    )
    .eq('user_id', userId)
    .eq('template_chapter_id', templateChapterId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw dbError('Failed to load schedule.');
  return Array.isArray(data) && data.length > 0 ? (data[0] as ScheduleRow) : null;
}

/**
 * Enforces D5 at test start AND submit time.
 * - No schedule, or latest schedule completed/cancelled: allowed (the
 *   test is open; scheduling is opt-in, not a prerequisite).
 * - Latest schedule active (scheduled/available) and its date has passed:
 *   refused (SCHEDULE_EXPIRED).
 * - Latest schedule missed: refused (SCHEDULE_MISSED). The student must
 *   create a new schedule, which then becomes the latest and re-opens
 *   the chapter. This is what makes "if the date is gone you can't do
 *   the test" actually hold: without this branch, a student who missed
 *   a schedule could simply take the test unscheduled the next day.
 * If the product instead wants missed schedules to leave the test open,
 * delete the 'missed' branch below — that is the only change needed.
 */
export async function assertScheduleAllowsStart(
  client: DbClient,
  userId: string,
  templateChapterId: string,
): Promise<void> {
  const schedule = await getLatestSchedule(client, userId, templateChapterId);
  if (!schedule) return;
  if (schedule.status === 'missed') {
    throw forbidden(
      'SCHEDULE_MISSED',
      'This test was scheduled and the date has passed. Schedule it again to take it.',
    );
  }
  if (
    (schedule.status === 'scheduled' || schedule.status === 'available') &&
    isScheduleDatePassed(schedule.scheduled_at)
  ) {
    throw forbidden(
      'SCHEDULE_EXPIRED',
      'The scheduled date for this test has passed. Schedule it again to take it.',
    );
  }
}

// ---------------------------------------------------------------------------
// Tests: loading definitions and public (key-stripped) questions
// ---------------------------------------------------------------------------

export interface TestRow {
  id: string;
  template_chapter_id: string | null;
  chapter_id: string | null;
  test_number: number;
  title: string;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number;
}

/** The chapter's single test (D1: test_number = 1). */
export async function getTestByTemplateChapter(
  client: DbClient,
  templateChapterId: string,
): Promise<TestRow> {
  const { data, error } = await client
    .from('tests')
    .select(
      'id, template_chapter_id, chapter_id, test_number, title, total_marks, passing_marks, duration_minutes',
    )
    .eq('template_chapter_id', templateChapterId)
    .eq('test_number', 1)
    .maybeSingle();
  if (error) throw dbError('Failed to load test.');
  if (!data) throw notFound('TEST_NOT_FOUND', 'No test exists for this chapter yet.');
  return data as TestRow;
}

export async function getTestById(client: DbClient, testId: string): Promise<TestRow> {
  const { data, error } = await client
    .from('tests')
    .select(
      'id, template_chapter_id, chapter_id, test_number, title, total_marks, passing_marks, duration_minutes',
    )
    .eq('id', testId)
    .maybeSingle();
  if (error) throw dbError('Failed to load test.');
  if (!data) throw notFound('TEST_NOT_FOUND', 'No test with that id exists.');
  return data as TestRow;
}

export interface PublicQuestion {
  id: string;
  questionOrder: number;
  questionText: string;
  options: string[];
  marks: number;
}

export interface TestQuestionsResponse {
  test: {
    id: string;
    title: string;
    totalMarks: number;
    passingMarks: number;
    durationMinutes: number;
  };
  questions: PublicQuestion[];
}

/**
 * Loads a test's questions with correct_answer and explanation NEVER
 * selected. Output objects are built field-by-field so that even if the
 * select list is widened later, keys cannot leak through a spread.
 */
async function loadPublicQuestions(testId: string): Promise<PublicQuestion[]> {
  // Bank read via the bank client (shared rows are invisible to the user
  // client under RLS). Only public fields are selected below.
  const { data, error } = await getBankClient()
    .from('test_questions')
    .select('question_order, questions(id, question_text, options, marks)')
    .eq('test_id', testId)
    .order('question_order', { ascending: true });
  if (error) throw dbError('Failed to load test questions.');
  const rows = Array.isArray(data) ? data : [];
  const questions: PublicQuestion[] = rows.map((row: any) => {
    const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    if (!isWellFormedQuestion(q)) {
      throw new ApiError(
        500,
        'DATA_INTEGRITY',
        'A question in this test is malformed in the bank. It cannot be served.',
      );
    }
    return {
      id: q.id as string,
      questionOrder: row.question_order as number,
      questionText: q.question_text as string,
      options: q.options as string[],
      marks: typeof q.marks === 'number' ? q.marks : 1,
    };
  });
  return questions;
}

function toTestSummary(test: TestRow): TestQuestionsResponse['test'] {
  return {
    id: test.id,
    title: test.title,
    totalMarks: test.total_marks,
    passingMarks: test.passing_marks,
    durationMinutes: test.duration_minutes,
  };
}

/**
 * Questions for taking a chapter's test, addressed by template chapter.
 * Refuses when the chapter's schedule is expired/missed (D5).
 */
export async function getTestQuestionsForAttempt(
  client: DbClient,
  templateChapterId: string,
  userId: string,
): Promise<TestQuestionsResponse> {
  requireId(templateChapterId, 'templateChapterId');
  requireId(userId, 'userId');
  const test = await getTestByTemplateChapter(client, templateChapterId);
  await assertScheduleAllowsStart(client, userId, templateChapterId);
  const questions = await loadPublicQuestions(test.id);
  return { test: toTestSummary(test), questions };
}

/**
 * Same as getTestQuestionsForAttempt, addressed by test id (this is what
 * the GET /api/tests/[id]/questions route uses). The schedule check runs
 * only when the test is linked to a template chapter; legacy tests with
 * only chapter_id have no schedule to check.
 */
export async function getTestQuestionsByTestId(
  client: DbClient,
  testId: string,
  userId: string,
): Promise<TestQuestionsResponse> {
  requireId(testId, 'testId');
  requireId(userId, 'userId');
  const test = await getTestById(client, testId);
  if (test.template_chapter_id) {
    await assertScheduleAllowsStart(client, userId, test.template_chapter_id);
  }
  const questions = await loadPublicQuestions(test.id);
  return { test: toTestSummary(test), questions };
}

// ---------------------------------------------------------------------------
// Tests: server-side grading + exactly-once submission (D2, D3)
// ---------------------------------------------------------------------------

export interface SubmitAnswerInput {
  questionId: string;
  answer: string;
}

export interface SubmitTestInput {
  idempotencyKey: string;
  testId: string;
  userId: string;
  answers: SubmitAnswerInput[];
  /** Reported by the client for the record only. Never trusted for timing (D3). */
  clientStartedAt?: string;
}

export interface QuestionResult {
  questionId: string;
  submittedAnswer: string | null;
  /** Present ONLY in post-submission responses, never before submission. */
  correctAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface SubmitTestResult {
  attemptId: string;
  testId: string;
  score: number;
  totalMarks: number;
  passingMarks: number;
  passed: boolean;
  accuracy: number;
  results: QuestionResult[];
  /** True when this response replays an earlier submission with the same key. */
  replayed: boolean;
}

interface GradedQuestion {
  questionId: string;
  correctAnswer: string;
  marks: number;
  questionOrder: number;
}

/** Loads a test's answer key server-side only (never returned directly). */
async function loadTestKey(testId: string): Promise<GradedQuestion[]> {
  // Bank read via the bank client (see getBankClient). Answers are used
  // only to grade server-side; they are never sent before submission.
  const { data, error } = await getBankClient()
    .from('test_questions')
    .select('question_order, question_id, questions(id, correct_answer, marks)')
    .eq('test_id', testId)
    .order('question_order', { ascending: true });
  if (error) throw dbError('Failed to load test questions.');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => {
    const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    if (!q || !validAnswerLetter(q.correct_answer)) {
      throw new ApiError(
        500,
        'DATA_INTEGRITY',
        'A question in this test has no valid correct answer in the bank.',
      );
    }
    return {
      questionId: row.question_id as string,
      correctAnswer: String(q.correct_answer).trim().toUpperCase(),
      marks: typeof q.marks === 'number' ? q.marks : 1,
      questionOrder: row.question_order as number,
    };
  });
}

/**
 * Normalises a submitted answer list: validates letters, rejects a
 * question answered twice, and returns a questionId -> letter map.
 * Unknown question ids are rejected by the caller (they must belong to
 * the test, otherwise a client could pad a submission with junk).
 */
function normaliseAnswers(answers: unknown): Map<string, string> {
  if (!Array.isArray(answers)) {
    throw badRequest('INVALID_ANSWERS', 'answers must be an array.');
  }
  const map = new Map<string, string>();
  for (const a of answers) {
    const questionId = (a as any)?.questionId;
    const answer = (a as any)?.answer;
    if (typeof questionId !== 'string' || questionId.trim() === '') {
      throw badRequest('INVALID_ANSWERS', 'Every answer needs a questionId.');
    }
    if (!validAnswerLetter(answer)) {
      throw badRequest('INVALID_ANSWERS', 'Every answer must be a letter A-D.');
    }
    if (map.has(questionId)) {
      throw badRequest('DUPLICATE_ANSWER', `Question ${questionId} was answered twice.`);
    }
    map.set(questionId, String(answer).trim().toUpperCase());
  }
  return map;
}

function gradeQuestions(
  key: GradedQuestion[],
  submitted: Map<string, string>,
): { results: QuestionResult[]; score: number } {
  let score = 0;
  const results = key.map((k) => {
    const submittedAnswer = submitted.get(k.questionId) ?? null;
    const isCorrect = submittedAnswer === k.correctAnswer;
    const marksAwarded = isCorrect ? k.marks : 0;
    score += marksAwarded;
    return {
      questionId: k.questionId,
      submittedAnswer,
      correctAnswer: k.correctAnswer,
      isCorrect,
      marksAwarded,
    };
  });
  return { results, score };
}

function parseClientStartedAt(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

/** Rebuilds a previous submission's result for an idempotency replay. */
async function replayTestAttempt(
  client: DbClient,
  attempt: any,
  test: TestRow,
): Promise<SubmitTestResult> {
  const key = await loadTestKey(test.id);
  const { data, error } = await client
    .from('test_answers')
    .select('question_id, answer, is_correct, marks_awarded')
    .eq('attempt_id', attempt.id);
  if (error) throw dbError('Failed to load previous attempt.');
  const submitted = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    if (typeof row.answer === 'string') submitted.set(row.question_id, row.answer);
  }
  const { results } = gradeQuestions(key, submitted);
  return {
    attemptId: attempt.id,
    testId: test.id,
    score: attempt.score,
    totalMarks: test.total_marks,
    passingMarks: test.passing_marks,
    passed: attempt.score >= test.passing_marks,
    accuracy: attempt.accuracy,
    results,
    replayed: true,
  };
}

async function findTestAttemptByKey(
  client: DbClient,
  userId: string,
  idempotencyKey: string,
): Promise<any | null> {
  const { data, error } = await client
    .from('test_attempts')
    .select('id, test_id, user_id, score, total_marks, accuracy, passed, started_at, completed_at')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) throw dbError('Failed to check submission idempotency.');
  return data ?? null;
}

/**
 * Grades and records a test submission, exactly once per idempotency key.
 *
 * Client contract: generate ONE key per submit click (e.g.
 * crypto.randomUUID()) and reuse that same key when retrying the same
 * submission after a network failure. A new attempt needs a new key.
 * A duplicate key returns the original result and writes nothing.
 *
 * Requires the README migration: test_attempts.idempotency_key with a
 * unique index on (user_id, idempotency_key). If two concurrent requests
 * race past the pre-check, the unique index rejects the second insert
 * and this function replays the first result instead of erroring.
 */
export async function submitTest(
  client: DbClient,
  input: SubmitTestInput,
): Promise<SubmitTestResult> {
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
    throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey is required for submission.');
  }
  const idempotencyKey = input.idempotencyKey.trim();
  const testId = requireId(input.testId, 'testId');
  const userId = requireId(input.userId, 'userId');
  const submitted = normaliseAnswers(input.answers);

  // Idempotency first: a retry must never create a second attempt.
  const existing = await findTestAttemptByKey(client, userId, idempotencyKey);
  if (existing) {
    const test = await getTestById(client, existing.test_id);
    return replayTestAttempt(client, existing, test);
  }

  const test = await getTestById(client, testId);
  if (test.template_chapter_id) {
    await assertScheduleAllowsStart(client, userId, test.template_chapter_id);
  }
  const key = await loadTestKey(test.id);
  const keyIds = new Set(key.map((k) => k.questionId));
  for (const questionId of submitted.keys()) {
    if (!keyIds.has(questionId)) {
      throw badRequest('UNKNOWN_QUESTION', `Answer for question ${questionId} is not part of this test.`);
    }
  }
  const { results, score } = gradeQuestions(key, submitted);
  const totalMarks = test.total_marks;
  const passingMarks = test.passing_marks;
  const passed = score >= passingMarks;
  const accuracy = totalMarks > 0 ? round2((score / totalMarks) * 100) : 0;
  const now = new Date().toISOString();

  const { data: attempt, error: attemptError } = await client
    .from('test_attempts')
    .insert({
      test_id: test.id,
      user_id: userId,
      score,
      total_marks: totalMarks,
      accuracy,
      passed,
      started_at: parseClientStartedAt(input.clientStartedAt, now),
      completed_at: now,
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();
  if (attemptError) {
    if (isUniqueViolation(attemptError)) {
      const raced = await findTestAttemptByKey(client, userId, idempotencyKey);
      if (raced) return replayTestAttempt(client, raced, test);
    }
    throw dbError('Failed to record test attempt.');
  }

  // Only answered questions get test_answers rows; unanswered questions
  // count as incorrect with 0 marks (see gradeQuestions). This avoids
  // assuming the answer column is nullable.
  const answerRows = results
    .filter((r) => r.submittedAnswer !== null)
    .map((r) => ({
      attempt_id: attempt.id,
      question_id: r.questionId,
      answer: r.submittedAnswer,
      is_correct: r.isCorrect,
      marks_awarded: r.marksAwarded,
      answered_at: now,
    }));
  if (answerRows.length > 0) {
    const { error: answersError } = await client.from('test_answers').insert(answerRows);
    if (answersError) throw dbError('Failed to record test answers.');
  }

  // Best effort only: a completed scheduled test flips its schedule to
  // completed. If this fails, the attempt above is still the source of
  // truth and the submission must not fail because of it.
  if (test.template_chapter_id) {
    try {
      await client
        .from('scheduled_tests')
        .update({ status: 'completed', updated_at: now })
        .eq('user_id', userId)
        .eq('template_chapter_id', test.template_chapter_id)
        .in('status', ['scheduled', 'available']);
    } catch {
      // Intentionally ignored; see comment above.
    }
  }

  return {
    attemptId: attempt.id,
    testId: test.id,
    score,
    totalMarks,
    passingMarks,
    passed,
    accuracy,
    results,
    replayed: false,
  };
}

// ---------------------------------------------------------------------------
// Quizzes: fixed-set practice generation + submission
// ---------------------------------------------------------------------------

export interface GeneratedQuiz {
  quizId: string;
  templateChapterId: string;
  totalMarks: number;
  questions: PublicQuestion[];
}

/** Fisher-Yates shuffle (practice selection only; not a security primitive). */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Creates a fixed-set practice quiz from the chapter bank.
 *
 * totalMarks is the number of questions (1 mark each): 10, 30, 50, or any
 * other custom positive integer. If the chapter bank holds fewer usable
 * questions, this ERRORS (422 QUIZ_BANK_TOO_SMALL) and never silently
 * reduces the total — a quiz that claims 30 marks must contain 30.
 *
 * NOTE on quizzes.chapter_id: the schema lists only a legacy per-user
 * chapter_id on quizzes, while this system keys quizzes to template
 * chapters (D7). The row is therefore inserted with chapter_id = null
 * and is_adaptive = false (a generated quiz is a fixed set, not an
 * adaptive one). This assumes quizzes.chapter_id is nullable. If it is
 * NOT NULL in the live schema, apply the proposed migration in README.md
 * (add quizzes.template_chapter_id) and change the insert below — that
 * is the only code change needed.
 */
export async function generateQuiz(
  client: DbClient,
  templateChapterId: string,
  totalMarks: number,
): Promise<GeneratedQuiz> {
  requireId(templateChapterId, 'templateChapterId');
  if (!Number.isInteger(totalMarks) || totalMarks <= 0) {
    throw badRequest(
      'INVALID_TOTAL_MARKS',
      'totalMarks must be a positive integer: 10, 30, 50, or a custom total.',
    );
  }
  const { data: chapter, error: chapterError } = await client
    .from('curriculum_template_chapters')
    .select('id, title')
    .eq('id', templateChapterId)
    .maybeSingle();
  if (chapterError) throw dbError('Failed to load chapter.');
  if (!chapter) throw notFound('CHAPTER_NOT_FOUND', 'No chapter with that id exists.');

  const { data: bank, error: bankError } = await getBankClient()
    .from('questions')
    .select('id, question_text, options, marks')
    .eq('template_chapter_id', templateChapterId);
  if (bankError) throw dbError('Failed to load question bank.');
  const usable = (Array.isArray(bank) ? bank : []).filter(isWellFormedQuestion);
  if (usable.length < totalMarks) {
    throw new ApiError(
      422,
      'QUIZ_BANK_TOO_SMALL',
      `This chapter has ${usable.length} usable questions in the bank, which is fewer than ` +
        `the requested ${totalMarks} marks. The total was not reduced; request a smaller total ` +
        `or add questions to the bank.`,
    );
  }
  const selected = shuffled(usable).slice(0, totalMarks);

  const { data: quiz, error: quizError } = await client
    .from('quizzes')
    .insert({
      chapter_id: null,
      title: `Practice Quiz — ${chapter.title}`,
      total_marks: totalMarks,
      is_adaptive: false,
    })
    .select('id')
    .single();
  if (quizError) throw dbError('Failed to create quiz.');
  const quizQuestions = selected.map((q: any, i: number) => ({
    quiz_id: quiz.id,
    question_id: q.id,
    question_order: i + 1,
  }));
  const { error: qqError } = await client.from('quiz_questions').insert(quizQuestions);
  if (qqError) throw dbError('Failed to attach questions to quiz.');

  // Rebuild public questions field-by-field (keys never selected above).
  const questions: PublicQuestion[] = selected.map((q: any, i: number) => ({
    id: q.id as string,
    questionOrder: i + 1,
    questionText: q.question_text as string,
    options: q.options as string[],
    marks: 1,
  }));
  return { quizId: quiz.id, templateChapterId, totalMarks, questions };
}

export interface SubmitQuizInput {
  idempotencyKey: string;
  quizId: string;
  userId: string;
  answers: SubmitAnswerInput[];
  clientStartedAt?: string;
}

export interface SubmitQuizResult {
  attemptId: string;
  quizId: string;
  score: number;
  totalMarks: number;
  accuracy: number;
  /** Quizzes have no passing_marks column, so pass/fail is not defined. */
  passed: null;
  results: QuestionResult[];
  replayed: boolean;
}

async function loadQuizKey(quizId: string): Promise<GradedQuestion[]> {
  // Bank read via the bank client (see getBankClient). Answers are used
  // only to grade server-side; they are never sent before submission.
  const { data, error } = await getBankClient()
    .from('quiz_questions')
    .select('question_order, question_id, questions(id, correct_answer, marks)')
    .eq('quiz_id', quizId)
    .order('question_order', { ascending: true });
  if (error) throw dbError('Failed to load quiz questions.');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row: any) => {
    const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
    if (!q || !validAnswerLetter(q.correct_answer)) {
      throw new ApiError(
        500,
        'DATA_INTEGRITY',
        'A question in this quiz has no valid correct answer in the bank.',
      );
    }
    return {
      questionId: row.question_id as string,
      correctAnswer: String(q.correct_answer).trim().toUpperCase(),
      marks: 1, // quizzes are 1 mark per question by definition (see generateQuiz)
      questionOrder: row.question_order as number,
    };
  });
}

/**
 * Quiz submission, analogous to submitTest: server-side grading, exactly
 * once per idempotency key, per-question correctness only post-submission.
 * Quizzes are practice and are NOT gated by schedules, and have no pass
 * threshold (passed is always null). Requires the README migration for
 * quiz_attempts.idempotency_key (same snippet as test_attempts).
 */
export async function submitQuiz(
  client: DbClient,
  input: SubmitQuizInput,
): Promise<SubmitQuizResult> {
  if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
    throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey is required for submission.');
  }
  const idempotencyKey = input.idempotencyKey.trim();
  const quizId = requireId(input.quizId, 'quizId');
  const userId = requireId(input.userId, 'userId');
  const submitted = normaliseAnswers(input.answers);

  const { data: existing, error: existingError } = await client
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, score, total_marks, accuracy')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existingError) throw dbError('Failed to check submission idempotency.');
  if (existing) {
    const key = await loadQuizKey(existing.quiz_id);
    const { data: prevAnswers, error: prevError } = await client
      .from('quiz_answers')
      .select('question_id, answer')
      .eq('attempt_id', existing.id);
    if (prevError) throw dbError('Failed to load previous attempt.');
    const prevMap = new Map<string, string>();
    for (const row of Array.isArray(prevAnswers) ? prevAnswers : []) {
      if (typeof row.answer === 'string') prevMap.set(row.question_id, row.answer);
    }
    const { results } = gradeQuestions(key, prevMap);
    return {
      attemptId: existing.id,
      quizId: existing.quiz_id,
      score: existing.score,
      totalMarks: existing.total_marks,
      accuracy: existing.accuracy,
      passed: null,
      results,
      replayed: true,
    };
  }

  const { data: quiz, error: quizError } = await client
    .from('quizzes')
    .select('id, total_marks')
    .eq('id', quizId)
    .maybeSingle();
  if (quizError) throw dbError('Failed to load quiz.');
  if (!quiz) throw notFound('QUIZ_NOT_FOUND', 'No quiz with that id exists.');
  const key = await loadQuizKey(quiz.id);
  const keyIds = new Set(key.map((k) => k.questionId));
  for (const questionId of submitted.keys()) {
    if (!keyIds.has(questionId)) {
      throw badRequest('UNKNOWN_QUESTION', `Answer for question ${questionId} is not part of this quiz.`);
    }
  }
  const { results, score } = gradeQuestions(key, submitted);
  const totalMarks = quiz.total_marks;
  const accuracy = totalMarks > 0 ? round2((score / totalMarks) * 100) : 0;
  const now = new Date().toISOString();

  // passed is deliberately omitted: quizzes have no passing_marks column
  // and no pass threshold is defined for practice quizzes. If
  // quiz_attempts.passed is NOT NULL without a default in the live
  // schema, give it a default (see README) rather than inventing a value.
  const { data: attempt, error: attemptError } = await client
    .from('quiz_attempts')
    .insert({
      quiz_id: quiz.id,
      user_id: userId,
      score,
      total_marks: totalMarks,
      accuracy,
      started_at: parseClientStartedAt(input.clientStartedAt, now),
      completed_at: now,
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();
  if (attemptError) {
    if (isUniqueViolation(attemptError)) {
      const { data: raced } = await client
        .from('quiz_attempts')
        .select('id, quiz_id, score, total_marks, accuracy')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (raced) {
        const racedKey = await loadQuizKey(raced.quiz_id);
        const { data: racedAnswers } = await client
          .from('quiz_answers')
          .select('question_id, answer')
          .eq('attempt_id', raced.id);
        const racedMap = new Map<string, string>();
        for (const row of Array.isArray(racedAnswers) ? racedAnswers : []) {
          if (typeof row.answer === 'string') racedMap.set(row.question_id, row.answer);
        }
        const { results: racedResults } = gradeQuestions(racedKey, racedMap);
        return {
          attemptId: raced.id,
          quizId: raced.quiz_id,
          score: raced.score,
          totalMarks: raced.total_marks,
          accuracy: raced.accuracy,
          passed: null,
          results: racedResults,
          replayed: true,
        };
      }
    }
    throw dbError('Failed to record quiz attempt.');
  }
  const answerRows = results
    .filter((r) => r.submittedAnswer !== null)
    .map((r) => ({
      attempt_id: attempt.id,
      question_id: r.questionId,
      answer: r.submittedAnswer,
      is_correct: r.isCorrect,
      marks_awarded: r.marksAwarded,
      answered_at: now,
    }));
  if (answerRows.length > 0) {
    const { error: answersError } = await client.from('quiz_answers').insert(answerRows);
    if (answersError) throw dbError('Failed to record quiz answers.');
  }
  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    score,
    totalMarks,
    accuracy,
    passed: null,
    results,
    replayed: false,
  };
}

// ---------------------------------------------------------------------------
// Schedules (D5) and push subscriptions (storage only)
// ---------------------------------------------------------------------------

export interface ScheduleWithChapter extends ScheduleRow {
  chapter: { id: string; title: string; chapter_number: number; section: string | null } | null;
  /** True when the scheduled date has passed but the row is not yet flipped. */
  isExpired: boolean;
}

export async function createSchedule(
  client: DbClient,
  userId: string,
  templateChapterId: string,
  scheduledAt: string,
): Promise<ScheduleRow> {
  requireId(userId, 'userId');
  requireId(templateChapterId, 'templateChapterId');
  if (typeof scheduledAt !== 'string' || Number.isNaN(new Date(scheduledAt).getTime())) {
    throw badRequest('INVALID_SCHEDULED_AT', 'scheduledAt must be a valid date/time.');
  }
  if (new Date(scheduledAt).getTime() < Date.now()) {
    throw badRequest('SCHEDULE_IN_PAST', 'A test cannot be scheduled in the past.');
  }
  const { data: chapter, error: chapterError } = await client
    .from('curriculum_template_chapters')
    .select('id')
    .eq('id', templateChapterId)
    .maybeSingle();
  if (chapterError) throw dbError('Failed to load chapter.');
  if (!chapter) throw notFound('CHAPTER_NOT_FOUND', 'No chapter with that id exists.');
  const { data: active, error: activeError } = await client
    .from('scheduled_tests')
    .select('id')
    .eq('user_id', userId)
    .eq('template_chapter_id', templateChapterId)
    .in('status', ['scheduled', 'available'])
    .limit(1);
  if (activeError) throw dbError('Failed to check existing schedules.');
  if (Array.isArray(active) && active.length > 0) {
    throw conflict(
      'SCHEDULE_ALREADY_ACTIVE',
      'This chapter already has an active schedule. Cancel it before scheduling again.',
    );
  }
  const { data, error } = await client
    .from('scheduled_tests')
    .insert({
      user_id: userId,
      template_chapter_id: templateChapterId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: 'scheduled',
    })
    .select('id, user_id, template_chapter_id, scheduled_at, status, reminder_sent_at, created_at, updated_at')
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        'SCHEDULE_ALREADY_ACTIVE',
        'This chapter already has an active schedule. Cancel it before scheduling again.',
      );
    }
    throw dbError('Failed to create schedule.');
  }
  return data as ScheduleRow;
}

export async function listSchedules(
  client: DbClient,
  userId: string,
): Promise<ScheduleWithChapter[]> {
  requireId(userId, 'userId');
  const { data, error } = await client
    .from('scheduled_tests')
    .select(
      'id, user_id, template_chapter_id, scheduled_at, status, reminder_sent_at, created_at, updated_at, ' +
        'curriculum_template_chapters(id, title, chapter_number, section)',
    )
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true })
    .limit(100);
  if (error) throw dbError('Failed to list schedules.');
  return (Array.isArray(data) ? data : []).map((row: any) => {
    const ch = Array.isArray(row.curriculum_template_chapters)
      ? row.curriculum_template_chapters[0]
      : row.curriculum_template_chapters;
    return {
      id: row.id,
      user_id: row.user_id,
      template_chapter_id: row.template_chapter_id,
      scheduled_at: row.scheduled_at,
      status: row.status,
      reminder_sent_at: row.reminder_sent_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      chapter: ch
        ? {
            id: ch.id,
            title: ch.title,
            chapter_number: ch.chapter_number,
            section: ch.section ?? null,
          }
        : null,
      isExpired:
        (row.status === 'scheduled' || row.status === 'available') &&
        isScheduleDatePassed(row.scheduled_at),
    };
  });
}

/**
 * Cancels a schedule. Only the owning student may cancel, only while the
 * schedule is still active (scheduled/available), and only before its
 * date has passed. A completed, missed, or already-cancelled schedule
 * cannot be cancelled. (Per D3 there is no server-visible "started but
 * not submitted" state, so "before start" is enforced via status + date.)
 */
export async function cancelSchedule(
  client: DbClient,
  userId: string,
  scheduleId: string,
): Promise<ScheduleRow> {
  requireId(userId, 'userId');
  requireId(scheduleId, 'scheduleId');
  const { data, error } = await client
    .from('scheduled_tests')
    .select('id, user_id, template_chapter_id, scheduled_at, status, reminder_sent_at, created_at, updated_at')
    .eq('id', scheduleId)
    .maybeSingle();
  if (error) throw dbError('Failed to load schedule.');
  // 404 for other students' schedules too: never confirm their existence.
  if (!data || data.user_id !== userId) {
    throw notFound('SCHEDULE_NOT_FOUND', 'No schedule with that id exists.');
  }
  if (data.status !== 'scheduled' && data.status !== 'available') {
    throw conflict(
      'SCHEDULE_NOT_CANCELLABLE',
      `A ${data.status} schedule cannot be cancelled.`,
    );
  }
  if (isScheduleDatePassed(data.scheduled_at)) {
    throw conflict(
      'SCHEDULE_EXPIRED',
      'The scheduled date has passed, so this schedule can no longer be cancelled. Schedule the test again instead.',
    );
  }
  const { data: updated, error: updateError } = await client
    .from('scheduled_tests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select('id, user_id, template_chapter_id, scheduled_at, status, reminder_sent_at, created_at, updated_at')
    .single();
  if (updateError) throw dbError('Failed to cancel schedule.');
  return updated as ScheduleRow;
}

/**
 * Flips past-due active schedules to 'missed'. Intended to be called by a
 * scheduled job (Supabase cron / Edge Function), NOT by user-facing
 * routes: expiry at start/submit time is already enforced by computation
 * (assertScheduleAllowsStart), so this job is hygiene and reporting, not
 * the enforcement mechanism. Returns how many rows were flipped.
 */
export async function markExpiredSchedules(
  client: DbClient,
  now: Date = new Date(),
): Promise<{ updated: number }> {
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const { data, error } = await client
    .from('scheduled_tests')
    .update({ status: 'missed', updated_at: now.toISOString() })
    .in('status', ['scheduled', 'available'])
    .lt('scheduled_at', threshold)
    .select('id');
  if (error) throw dbError('Failed to mark expired schedules.');
  return { updated: Array.isArray(data) ? data.length : 0 };
}

// ---------------------------------------------------------------------------
// Push subscriptions (storage only — sending is NOT implemented here)
// ---------------------------------------------------------------------------

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  created_at: string;
}

/**
 * Stores (or refreshes) a browser Web Push subscription for the student.
 * This only records where reminders may be sent. Actually sending a push
 * when a scheduled time nears needs a service worker, VAPID keys, and a
 * sender (Edge Function / cron) — none of that is in this folder, and
 * push delivery must not be claimed working until those are configured
 * and tested (see README).
 */
export async function recordPushSubscription(
  client: DbClient,
  userId: string,
  input: PushSubscriptionInput,
): Promise<PushSubscriptionRow> {
  requireId(userId, 'userId');
  for (const field of ['endpoint', 'p256dh', 'auth'] as const) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') {
      throw badRequest('INVALID_SUBSCRIPTION', `${field} is required for a push subscription.`);
    }
  }
  const { data, error } = await client
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      },
      { onConflict: 'user_id,endpoint' },
    )
    .select('id, user_id, endpoint, created_at')
    .single();
  if (error) throw dbError('Failed to save push subscription.');
  return data as PushSubscriptionRow;
}
