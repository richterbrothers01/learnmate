import { NextResponse } from 'next/server';
import { ApiError, getServerClient, submitTest, toErrorPayload } from '../../../../../lib/test-server';

/**
 * POST /api/tests/[id]/submit
 * [id] is the TEST id (tests.id).
 * Body: { idempotencyKey: string, answers: [{ questionId, answer }], clientStartedAt?: string }
 * userId is taken from the session, NEVER from the body.
 * Grades server-side and returns score/total/passed/accuracy plus
 * per-question correctness (post-submission only). A repeated
 * idempotencyKey returns the original result without writing a second
 * attempt. 200 for both first and replayed submissions.
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: testId } = await ctx.params;
    const body = await readJson(req);
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to submit a test.' } },
        { status: 401 },
      );
    }
    const result = await submitTest(client, {
      idempotencyKey: body?.idempotencyKey,
      testId,
      userId: data.user.id,
      answers: body?.answers,
      clientStartedAt: body?.clientStartedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
