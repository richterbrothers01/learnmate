import { NextResponse } from 'next/server';
import {
  getServerClient,
  getTestQuestionsByTestId,
  toErrorPayload,
} from '../../../../../lib/test-server';

/**
 * GET /api/tests/[id]/questions
 * [id] is the TEST id (tests.id), not the chapter id.
 * Returns the test summary + its questions WITHOUT correct_answer or
 * explanation. Requires sign-in. Refuses (403) when the chapter's
 * schedule is expired/missed (Decision D5).
 */
type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: testId } = await ctx.params;
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to take a test.' } },
        { status: 401 },
      );
    }
    const result = await getTestQuestionsByTestId(client, testId, data.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
