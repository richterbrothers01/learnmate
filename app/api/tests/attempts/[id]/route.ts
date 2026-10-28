import { NextResponse } from "next/server";
import {
  ApiError,
  getServerClient,
  toErrorPayload,
} from "../../../../../lib/test-server";

/**
 * DELETE /api/tests/attempts/[id] — delete one of the student's own
 * completed-test records (the attempt and its answers). Only the
 * owning student can delete it; another student's id behaves like it
 * does not exist (404). Deleting a record does not touch the
 * chapter's test, its questions, or any schedule.
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: attemptId } = await ctx.params;
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to delete a test record.",
          },
        },
        { status: 401 },
      );
    }
    const userId = data.user.id;

    const { data: attempt, error: loadError } = await client
      .from("test_attempts")
      .select("id")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadError) {
      throw new ApiError(500, "DB_ERROR", "Failed to delete this test record.");
    }
    if (!attempt) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "No such completed test.",
          },
        },
        { status: 404 },
      );
    }

    // Answers first (in case there is no cascade), then the attempt.
    const { error: answersError } = await client
      .from("test_answers")
      .delete()
      .eq("attempt_id", attemptId);
    if (answersError) {
      throw new ApiError(500, "DB_ERROR", "Failed to delete this test record.");
    }
    const { error: attemptError } = await client
      .from("test_attempts")
      .delete()
      .eq("id", attemptId)
      .eq("user_id", userId);
    if (attemptError) {
      throw new ApiError(500, "DB_ERROR", "Failed to delete this test record.");
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
