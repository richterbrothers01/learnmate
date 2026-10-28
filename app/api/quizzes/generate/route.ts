import { NextResponse } from 'next/server';
import { ApiError, generateQuiz, getServerClient, toErrorPayload } from '../../../../lib/test-server';

/**
 * POST /api/quizzes/generate
 * Body: { templateChapterId: string, totalMarks: number }
 * totalMarks is 10, 30, 50, or a custom positive integer. If the chapter
 * bank holds fewer usable questions, this returns 422
 * QUIZ_BANK_TOO_SMALL and never silently reduces the total.
 * Returns the new quiz id + its questions WITHOUT correct answers.
 * 201 on creation.
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
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to generate a quiz.' } },
        { status: 401 },
      );
    }
    const result = await generateQuiz(client, body?.templateChapterId, body?.totalMarks);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
