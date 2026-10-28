import { NextResponse } from "next/server";
import {
  ApiError,
  getServerClient,
  toErrorPayload,
} from "../../../../lib/test-server";

/**
 * GET /api/tests/attempts — the signed-in student's submitted tests,
 * newest first, with chapter titles. Powers the Tests "Completed" tab.
 *
 * Attempts are the source of truth for completion: they cover both
 * "do it now" tests and scheduled tests (submitting also flips the
 * matching schedule to completed, but the attempt row is what proves
 * a test was finished). Only the student's own rows are returned
 * (test_attempts RLS is owner-only).
 *
 * Chapter titles are resolved in two batched lookups (tests, then
 * template chapters) rather than a deep embed, so nothing depends on
 * optional foreign keys existing between those tables.
 */
export async function GET() {
  try {
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to view completed tests.",
          },
        },
        { status: 401 },
      );
    }
    const userId = data.user.id;

    const { data: attempts, error: attemptsError } = await client
      .from("test_attempts")
      .select("id, test_id, score, total_marks, passed, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(100);
    if (attemptsError) {
      throw new ApiError(500, "DB_ERROR", "Failed to list completed tests.");
    }
    const rows = Array.isArray(attempts) ? attempts : [];

    const testIds = [...new Set(rows.map((r: any) => r.test_id))];
    const testsById = new Map<string, any>();
    if (testIds.length > 0) {
      const { data: tests } = await client
        .from("tests")
        .select("id, template_chapter_id")
        .in("id", testIds);
      for (const t of Array.isArray(tests) ? tests : []) {
        testsById.set(t.id, t);
      }
    }

    const templateIds = [
      ...new Set(
        [...testsById.values()]
          .map((t) => t.template_chapter_id)
          .filter(Boolean),
      ),
    ];
    const chaptersById = new Map<string, any>();
    if (templateIds.length > 0) {
      const { data: chapters } = await client
        .from("curriculum_template_chapters")
        .select("id, title, section")
        .in("id", templateIds);
      for (const c of Array.isArray(chapters) ? chapters : []) {
        chaptersById.set(c.id, c);
      }
    }

    const out = rows.map((r: any) => {
      const test = testsById.get(r.test_id);
      const ch = test?.template_chapter_id
        ? chaptersById.get(test.template_chapter_id)
        : undefined;
      return {
        id: String(r.id),
        chapterTitle: ch?.title ?? "Untitled chapter",
        section: ch?.section ?? null,
        score: r.score,
        totalMarks: r.total_marks,
        passed: r.passed,
        completedAt: r.completed_at,
      };
    });
    return NextResponse.json({ attempts: out });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
