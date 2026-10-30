import { NextResponse } from "next/server";
import {
  ApiError,
  getServerClient,
  toErrorPayload,
} from "../../../lib/test-server";

/**
 * GET /api/video-progress — the signed-in student's saved video progress.
 * POST /api/video-progress — record watch progress for one chapter.
 * DELETE /api/video-progress — clear the saved progress for a list of
 * chapter keys (used when a completed course is redone).
 * POST body: { chapterKey: string, watchedSeconds: number, durationSeconds: number }
 *
 * Progress is stored per chapter key (classLevel|subject|section|title) as
 * the furthest position reached while playing. The server keeps the
 * maximum, so progress never regresses. Percent is watched / duration,
 * clamped to 0–100. The table is user-owned (owner-only RLS); no service
 * role is involved.
 */
function clampPercent(watched: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((watched / duration) * 100)));
}

export async function GET() {
  try {
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to view video progress.",
          },
        },
        { status: 401 },
      );
    }
    const { data: rows, error: rowsError } = await client
      .from("video_progress")
      .select("chapter_key, watched_seconds, duration_seconds, percent")
      .eq("user_id", data.user.id)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (rowsError) {
      throw new ApiError(500, "DB_ERROR", "Failed to load video progress.");
    }
    return NextResponse.json({ progress: rows ?? [] });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const chapterKey =
      typeof body?.chapterKey === "string" ? body.chapterKey : "";
    const watchedIn = Number(body?.watchedSeconds);
    const durationIn = Number(body?.durationSeconds);
    if (
      !chapterKey ||
      !Number.isFinite(watchedIn) ||
      !Number.isFinite(durationIn) ||
      watchedIn < 0 ||
      durationIn < 0
    ) {
      throw new ApiError(
        400,
        "INVALID_PROGRESS",
        "chapterKey, watchedSeconds and durationSeconds are required.",
      );
    }
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to save video progress.",
          },
        },
        { status: 401 },
      );
    }
    const userId = data.user.id;
    const { data: existing } = await client
      .from("video_progress")
      .select("watched_seconds, duration_seconds")
      .eq("user_id", userId)
      .eq("chapter_key", chapterKey)
      .maybeSingle();
    const watched = Math.max(Number(existing?.watched_seconds) || 0, watchedIn);
    const duration = Math.max(
      Number(existing?.duration_seconds) || 0,
      durationIn,
    );
    const clampedWatched =
      duration > 0 ? Math.min(watched, duration) : watched;
    const percent = clampPercent(clampedWatched, duration);
    const { data: row, error: upsertError } = await client
      .from("video_progress")
      .upsert(
        {
          user_id: userId,
          chapter_key: chapterKey,
          watched_seconds: clampedWatched,
          duration_seconds: duration,
          percent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chapter_key" },
      )
      .select("chapter_key, watched_seconds, duration_seconds, percent")
      .single();
    if (upsertError) {
      throw new ApiError(500, "DB_ERROR", "Failed to save video progress.");
    }
    return NextResponse.json({ progress: row });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const chapterKeys: string[] = Array.isArray(body?.chapterKeys)
      ? body.chapterKeys.filter(
          (k: unknown): k is string =>
            typeof k === "string" && k.length > 0,
        )
      : [];
    if (chapterKeys.length === 0) {
      throw new ApiError(
        400,
        "INVALID_KEYS",
        "chapterKeys must be a non-empty array of chapter keys.",
      );
    }
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to reset course progress.",
          },
        },
        { status: 401 },
      );
    }
    const { error: delError, count } = await client
      .from("video_progress")
      .delete({ count: "exact" })
      .eq("user_id", data.user.id)
      .in("chapter_key", chapterKeys);
    if (delError) {
      throw new ApiError(500, "DB_ERROR", "Failed to reset course progress.");
    }
    return NextResponse.json({ deleted: count ?? 0 });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
