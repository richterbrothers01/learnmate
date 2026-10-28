import { NextResponse } from 'next/server';
import { ApiError, getServerClient, submitQuiz, toErrorPayload } from '../../../../../lib/test-server';

/**
 * POST /api/quizzes/[id]/submit
 * [id] is the QUIZ id (quizzes.id).
 * Body: { idempotencyKey: string, answers: [{ questionId, answer }], clientStartedAt?: string }
 * userId is taken from the session, NEVER from the body.
 * Practice quizzes: server-side grading, exactly-once per idempotency
 * key, no schedule gating, no pass threshold (passed is null).
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
    const { id: quizId } = await ctx.params;
    const body = await readJson(req);
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to submit a quiz.' } },
        { status: 401 },
      );
    }
    const result = await submitQuiz(client, {
      idempotencyKey: body?.idempotencyKey,
      quizId,
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
