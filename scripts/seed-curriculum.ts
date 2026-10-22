
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";
import { CURRICULUM } from "../lib/curriculum";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function seedCurriculum() {
    const { data: subjects, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name");

    if (subjectsError) throw subjectsError;

    const subjectMap = new Map(
        (subjects ?? []).map((subject) => [subject.name, subject.id])
    );

    let totalChapters = 0;

    for (const [key, chapters] of Object.entries(CURRICULUM)) {
        const [classText, curriculumSubject] = key.split("|");
        const classLevel = Number(classText);

        const mathVariant =
            curriculumSubject === "Pure Mathematics"
                ? "Pure"
                : curriculumSubject === "Applied Mathematics"
                    ? "Applied"
                    : null;

        const subjectName =
            mathVariant !== null ? "Mathematics" : curriculumSubject;

        const subjectId = subjectMap.get(subjectName);

        if (!subjectId) {
            throw new Error(
                `Subject "${subjectName}" not found in public.subjects.`
            );
        }

        let templateQuery = supabase
            .from("curriculum_templates")
            .select("id")
            .eq("class_level", classLevel)
            .eq("subject_id", subjectId)
            .is("stream", null);

        if (mathVariant === null) {
            templateQuery = templateQuery.is("math_variant", null);
        } else {
            templateQuery = templateQuery.eq("math_variant", mathVariant);
        }

        const { data: templates, error: templateError } =
            await templateQuery.limit(1);

        if (templateError) throw templateError;

        let templateId = templates?.[0]?.id;

        if (!templateId) {
            const { data: createdTemplate, error: createError } =
                await supabase
                    .from("curriculum_templates")
                    .insert({
                        class_level: classLevel,
                        subject_id: subjectId,
                        stream: null,
                        math_variant: mathVariant,
                    })
                    .select("id")
                    .single();

            if (createError) throw createError;

            templateId = createdTemplate.id;
        }

        const chapterRows = chapters.map((chapter, index) => ({
            template_id: templateId,
            chapter_number: index + 1,
            section: chapter.section ?? null,
            title: chapter.title,
        }));

        for (let i = 0; i < chapterRows.length; i += 100) {
            const batch = chapterRows.slice(i, i + 100);

            const { error: chapterError } = await supabase
                .from("curriculum_template_chapters")
                .upsert(batch, {
                    onConflict: "template_id,chapter_number",
                });

            if (chapterError) throw chapterError;
        }

        // Remove stale chapter numbers beyond the current curriculum length.
        const { error: staleChaptersError } = await supabase
            .from("curriculum_template_chapters")
            .delete()
            .eq("template_id", templateId)
            .gt("chapter_number", chapters.length);

        if (staleChaptersError) throw staleChaptersError;

        totalChapters += chapters.length;

        console.log(
            `Class ${classLevel} | ${curriculumSubject}: ${chapters.length} chapters`
        );
    }

    console.log(`\nImport complete. Processed ${totalChapters} chapters.`);
}

seedCurriculum().catch((error: unknown) => {
    console.error("Curriculum import failed:", error);
    process.exitCode = 1;
});
