import { NextResponse } from "next/server";
import { getServerClient, toErrorPayload } from "../../../../../lib/test-server";

/**
 * POST /api/notifications/[id]/read — mark one of the signed-in
 * student's notifications as read. Idempotent: reading an already-read
 * notification is a no-op success. Another student's id behaves like
 * it does not exist (the update simply matches nothing).
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to update notifications.",
          },
        },
        { status: 401 },
      );
    }
    await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", data.user.id)
      .is("read_at", null);
    return NextResponse.json({ read: true });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
