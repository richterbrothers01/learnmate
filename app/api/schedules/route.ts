import { NextResponse } from 'next/server';
import {
  ApiError,
  createSchedule,
  getServerClient,
  listSchedules,
  toErrorPayload,
} from '../../../lib/test-server';
import type { DbClient } from '../../../lib/test-server';

/**
 * GET /api/schedules — the signed-in student's schedules, soonest first.
 * POST /api/schedules — create one.
 * POST body: { templateChapterId: string, scheduledAt: string }
 * One active schedule per student per chapter (409 otherwise); past
 * times are rejected (400). 201 on creation.
 *
 * POST also creates the bell-tab notification ("Your test has been
 * scheduled for ...") on a best-effort basis: if the notification
 * insert fails (e.g. the notifications migration has not been run
 * yet), scheduling still succeeds.
 */
async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

async function authedUserId(client: DbClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function GET() {
  try {
    const client = await getServerClient();
    const userId = await authedUserId(client);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to view schedules.' } },
        { status: 401 },
      );
    }
    const schedules = await listSchedules(client, userId);
    return NextResponse.json({ schedules });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const client = await getServerClient();
    const userId = await authedUserId(client);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to schedule a test.' } },
        { status: 401 },
      );
    }
    const schedule = await createSchedule(client, userId, body?.templateChapterId, body?.scheduledAt);
    try {
      const { data: ch } = await client
        .from('curriculum_template_chapters')
        .select('title')
        .eq('id', schedule.template_chapter_id)
        .maybeSingle();
      await client.from('notifications').insert({
        user_id: userId,
        type: 'schedule',
        title: 'Test scheduled',
        body: `Your test for ${ch?.title ?? 'this chapter'} has been scheduled for ${new Date(schedule.scheduled_at).toLocaleString()}. You can start it within 30 minutes of that time.`,
        key: `schedule-created:${schedule.id}`,
        link: 'tests',
      });
    } catch {
      // Notifications must never break scheduling.
    }
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
