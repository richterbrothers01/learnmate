import { NextResponse } from 'next/server';
import {
  ApiError,
  getServerClient,
  recordPushSubscription,
  toErrorPayload,
} from '../../../../lib/test-server';

/**
 * POST /api/push/subscribe
 * Body: { endpoint: string, p256dh: string, auth: string } — a browser
 * Web Push subscription (from serviceWorkerRegistration.pushManager).
 * Stores it for schedule reminders. This does NOT send pushes: sending
 * needs a service worker, VAPID keys, and a sender job (see README).
 * The response echoes only id + endpoint, never the key material.
 */
async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to enable reminders.' } },
        { status: 401 },
      );
    }
    const sub = await recordPushSubscription(client, data.user.id, {
      endpoint: body?.endpoint,
      p256dh: body?.p256dh,
      auth: body?.auth,
    });
    return NextResponse.json({ subscription: { id: sub.id, endpoint: sub.endpoint } });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
