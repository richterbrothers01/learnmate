import { NextResponse } from "next/server";
import {
  ApiError,
  getServerClient,
  getTestByTemplateChapter,
  toErrorPayload,
} from "../../../../lib/test-server";

/**
 * GET /api/chapters/resolve?classLevel=&subject=&mathVariant=&section=&title=
 *
 * Bridges the dashboard's CURRICULUM identity (class, DB subject name,
 * optional math variant, section, title) to the shared template chapter
 * id that tests, quizzes and schedules are keyed by. Also returns the
 * chapter's single test (test_number = 1) when it has been imported, or
 * test: null when the import has not run for this chapter yet.
 *
 * Subject matching uses the dashboard course's subject verbatim, which
 * comes from the subjects table itself (loadCourses), so it matches the
 * DB name by construction. Pure/Applied maths resolve to
 * subjects.name "Mathematics" plus the math_variant, mirroring the seed
 * script. Section "" means NULL. Title must match exactly (titles are
 * verbatim from the synced curriculum list).
 */
export async function GET(req: Request) {
  try {
    const client = await getServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Sign in to resolve a chapter.",
          },
        },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const classLevel = Number(url.searchParams.get("classLevel"));
    const subject = (url.searchParams.get("subject") || "").trim();
    const mathVariant = (url.searchParams.get("mathVariant") || "").trim();
    const sectionParam = url.searchParams.get("section") || "";
    const title = (url.searchParams.get("title") || "").trim();
    if (!Number.isInteger(classLevel) || !subject || !title) {
      throw new ApiError(
        400,
        "INVALID_QUERY",
        "classLevel, subject and title are required.",
      );
    }

    const { data: subjectRows, error: subjectError } = await client
      .from("subjects")
      .select("id, name")
      .ilike("name", subject)
      .limit(1);
    if (subjectError || !subjectRows?.length) {
      throw new ApiError(
        404,
        "CHAPTER_NOT_FOUND",
        "This chapter is not in the curriculum templates yet.",
      );
    }
    const subjectId = (subjectRows as { id: string }[])[0].id;

    let templateQuery = client
      .from("curriculum_templates")
      .select("id")
      .eq("class_level", classLevel)
      .eq("subject_id", subjectId);
    templateQuery =
      mathVariant === "Pure" || mathVariant === "Applied"
        ? templateQuery.eq("math_variant", mathVariant)
        : templateQuery.is("math_variant", null);
    const { data: templates, error: templateError } =
      await templateQuery.limit(1);
    if (templateError || !templates?.length) {
      throw new ApiError(
        404,
        "CHAPTER_NOT_FOUND",
        "This chapter is not in the curriculum templates yet.",
      );
    }
    const templateId = (templates as { id: string }[])[0].id;

    let chapterQuery = client
      .from("curriculum_template_chapters")
      .select("id")
      .eq("template_id", templateId)
      .eq("title", title);
    chapterQuery =
      sectionParam === ""
        ? chapterQuery.is("section", null)
        : chapterQuery.eq("section", sectionParam);
    const { data: chapters, error: chapterError } =
      await chapterQuery.limit(1);
    if (chapterError || !chapters?.length) {
      throw new ApiError(
        404,
        "CHAPTER_NOT_FOUND",
        "This chapter is not in the curriculum templates yet — run the seed sync, then refresh.",
      );
    }
    const templateChapterId = (chapters as { id: string }[])[0].id;

    let test = null;
    try {
      const row = await getTestByTemplateChapter(client, templateChapterId);
      test = {
        id: row.id,
        title: row.title,
        totalMarks: row.total_marks,
        passingMarks: row.passing_marks,
        durationMinutes: row.duration_minutes,
      };
    } catch (err) {
      const { body } = toErrorPayload(err);
      if (body?.error?.code !== "TEST_NOT_FOUND") throw err;
      test = null;
    }

    return NextResponse.json({ templateChapterId, test });
  } catch (err) {
    const { status, body } = toErrorPayload(err);
    return NextResponse.json(body, { status });
  }
}
