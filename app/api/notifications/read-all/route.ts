import { NextResponse } from "next/server";
import { getServerClient, toErrorPayload } from "../../../../lib/test-server";

/**
 * POST /api/notifications/read-all — mark all of the signed-in
 * student's unread notifications as read. Powers the bell tab's
 * "Mark all read" button.
 */
export async function POST() {
  try {
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
      .eq("user_id", data.user.id)
      .is("read_at", null);
    return NextResponse.json({ readAll: true });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
