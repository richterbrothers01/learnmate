import { NextResponse } from "next/server";
import {
  ApiError,
  getServerClient,
  toErrorPayload,
} from "../../../lib/test-server";
import type { DbClient } from "../../../lib/test-server";

/**
 * GET /api/notifications — the signed-in student's notifications,
 * newest first, plus the unread count. Powers the bell tab.
 *
 * POST /api/notifications — create one notification for the signed-in
 * student. Body: { type, title, body, key?, link? }. When `key` is
 * given, creation is idempotent: a second create with the same key
 * returns { created: false } instead of a duplicate row (the partial
 * unique index on (user_id, key) enforces this). Used by the app for
 * streak milestones and test reminders.
 */
async function authedUserId(client: DbClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

function unauthenticated() {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHENTICATED",
        message: "Sign in to view notifications.",
      },
    },
    { status: 401 },
  );
}

export async function GET() {
  try {
    const client = await getServerClient();
    const userId = await authedUserId(client);
    if (!userId) return unauthenticated();
    const { data, error } = await client
      .from("notifications")
      .select("id, type, title, body, key, link, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ApiError(500, "DB_ERROR", "Failed to list notifications.");
    const rows = Array.isArray(data) ? data : [];
    return NextResponse.json({
      notifications: rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link ?? null,
        createdAt: r.created_at,
        readAt: r.read_at ?? null,
      })),
      unreadCount: rows.filter((r: any) => !r.read_at).length,
    });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const client = await getServerClient();
    const userId = await authedUserId(client);
    if (!userId) return unauthenticated();
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const type = typeof body?.type === "string" ? body.type.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!type || !title || !text) {
      throw new ApiError(
        400,
        "INVALID_NOTIFICATION",
        "type, title and body are required.",
      );
    }
    const key = typeof body?.key === "string" && body.key.trim() !== ""
      ? body.key.trim()
      : null;
    const link = typeof body?.link === "string" && body.link.trim() !== ""
      ? body.link.trim()
      : null;
    const { data, error } = await client
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body: text,
        key,
        link,
      })
      .select("id")
      .single();
    if (error) {
      // 23505 = the (user_id, key) dedup fired: already notified.
      if ((error as any).code === "23505") {
        return NextResponse.json({ created: false });
      }
      throw new ApiError(500, "DB_ERROR", "Failed to create notification.");
    }
    return NextResponse.json({ created: true, id: data.id }, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
