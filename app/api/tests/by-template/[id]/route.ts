import { NextResponse } from "next/server";
import {
  getServerClient,
  getTestByTemplateChapter,
  toErrorPayload,
} from "../../../../../lib/test-server";

/**
 * GET /api/tests/by-template/[id] — the chapter's test (test_number 1)
 * for a template chapter id. Used to start a scheduled test whose
 * course was deleted: schedules key to template chapters, not to
 * per-user courses, so a test must be reachable without any course.
 * Returns the test summary only (no questions, no answer keys).
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: templateChapterId } = await ctx.params;
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to take a test.",
          },
        },
        { status: 401 },
      );
    }
    const test = await getTestByTemplateChapter(client, templateChapterId);
    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        durationMinutes: test.duration_minutes,
      },
    });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
