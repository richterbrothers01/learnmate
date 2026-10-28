import { NextResponse } from 'next/server';
import { cancelSchedule, getServerClient, toErrorPayload } from '../../../../../lib/test-server';

/**
 * POST /api/schedules/[id]/cancel
 * [id] is the SCHEDULE id (scheduled_tests.id). No body needed.
 * Only the owning student may cancel, only while the schedule is active
 * and its date has not passed. Other students' ids return 404.
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { id: scheduleId } = await ctx.params;
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to cancel a schedule.' } },
        { status: 401 },
      );
    }
    const schedule = await cancelSchedule(client, data.user.id, scheduleId);
    return NextResponse.json({ schedule });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
