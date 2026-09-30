import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function validateName(value: string) {
    const name = value.trim();

    if (!name) {
        return {
            valid: false,
            error: "LearnMate Name is required.",
        };
    }

    if (name.length < 3) {
        return {
            valid: false,
            error: "LearnMate Name must be at least 3 characters.",
        };
    }

    if (name.length > 20) {
        return {
            valid: false,
            error: "LearnMate Name must be 20 characters or less.",
        };
    }

    if (!/^[A-Za-z0-9 ]+$/.test(name)) {
        return {
            valid: false,
            error: "LearnMate Name can only contain letters, numbers, and spaces.",
        };
    }

    return {
        valid: true,
        name,
    };
}

async function nameExists(name: string) {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("login_name", name)
        .limit(1);

    if (error) {
        throw error;
    }

    return !!data?.length;
}

async function getSuggestions(name: string) {
    const clean = name.trim();

    const candidates = [
        `${clean}1`,
        `${clean}12`,
        `${clean}123`,
        `${clean}01`,
        `${clean}2`,
        `${clean}22`,
        `${clean}7`,
        `${clean}99`,
    ];

    const suggestions: string[] = [];

    for (const candidate of candidates) {
        if (candidate.length > 20) continue;

        if (!/^[A-Za-z0-9 ]+$/.test(candidate)) continue;

        if (!(await nameExists(candidate))) {
            suggestions.push(candidate);
        }

        if (suggestions.length >= 3) {
            break;
        }
    }

    return suggestions;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const rawName =
            typeof body?.name === "string"
                ? body.name
                : "";

        const validation = validateName(rawName);

        if (!validation.valid) {
            return NextResponse.json(
                {
                    available: false,
                    error: validation.error,
                },
                { status: 400 }
            );
        }

        const name = validation.name!;

        const exists = await nameExists(name);

        if (!exists) {
            return NextResponse.json({
                available: true,
                name,
                suggestions: [],
            });
        }

        const suggestions = await getSuggestions(name);

        return NextResponse.json({
            available: false,
            name,
            error: "That LearnMate Name is already taken.",
            suggestions,
        });
    } catch (error) {
        console.error("NAME CHECK ERROR:", error);

        return NextResponse.json(
            {
                available: false,
                error: "Unable to check the name right now.",
            },
            { status: 500 }
        );
    }
}