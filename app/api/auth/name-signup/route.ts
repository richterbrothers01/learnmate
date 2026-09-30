import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function validateName(value: string) {
    const name = value.trim();

    if (name.length < 3 || name.length > 20) {
        return false;
    }

    return /^[A-Za-z0-9 ]+$/.test(name);
}

function makeSuggestions(name: string) {
    const clean = name.trim();

    return [
        `${clean}1`,
        `${clean}12`,
        `${clean}123`,
        `${clean}01`,
        `${clean}2`,
        `${clean}22`,
        `${clean}7`,
        `${clean}99`,
    ].filter(
        (suggestion) =>
            suggestion.length <= 20 &&
            /^[A-Za-z0-9 ]+$/.test(suggestion)
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const name = String(body?.name ?? "").trim();
        const password = String(body?.password ?? "");

        if (!validateName(name)) {
            return NextResponse.json(
                {
                    error:
                        "LearnMate Name must be 3–20 characters and can only contain letters, numbers, and spaces.",
                },
                { status: 400 }
            );
        }

        if (password.length < 6 || password.length > 20) {
            return NextResponse.json(
                {
                    error:
                        "Password must be between 6 and 20 characters.",
                },
                { status: 400 }
            );
        }

        /*
         * Check username before creating the Auth account.
         */
        const { data: existingProfile, error: profileCheckError } =
            await supabaseAdmin
                .from("profiles")
                .select("id, login_name")
                .ilike("login_name", name)
                .maybeSingle();

        if (profileCheckError) {
            console.error(
                "Profile availability error:",
                profileCheckError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to check the LearnMate Name right now.",
                },
                { status: 500 }
            );
        }

        if (existingProfile) {
            return NextResponse.json(
                {
                    error:
                        "That LearnMate Name is already being used.",
                    code: "NAME_TAKEN",
                    suggestions: makeSuggestions(name),
                },
                { status: 409 }
            );
        }

        /*
         * Supabase Auth requires an email.
         * This internal email is never shown to the user.
         */
        const internalEmail =
            `${crypto.randomUUID()}@auth.learnmate.local`;

        const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email: internalEmail,
                password,
                email_confirm: true,
                user_metadata: {
                    login_name: name,
                    fullname: name,
                },
            });

        if (authError || !authData.user) {
            console.error(
                "Auth creation error:",
                authError
            );

            return NextResponse.json(
                {
                    error:
                        authError?.message ||
                        "Unable to create your account. Please try again.",
                },
                { status: 400 }
            );
        }

        const userId = authData.user.id;

        /*
         * Create the profile using the service role.
         * This bypasses normal authenticated-user RLS
         * because this request is running server-side.
         */
        const { error: insertError } =
            await supabaseAdmin
                .from("profiles")
                .insert({
                    id: userId,
                    login_name: name,
                    fullname: name,
                    full_name: name,
                    onboarding_completed: false,
                });

        if (insertError) {
            console.error(
                "Profile creation error:",
                insertError
            );

            await supabaseAdmin.auth.admin.deleteUser(userId);

            if (insertError.code === "23505") {
                return NextResponse.json(
                    {
                        error:
                            "That LearnMate Name is already being used.",
                        code: "NAME_TAKEN",
                        suggestions: makeSuggestions(name),
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    error:
                        "Your account could not be completed. Please try again.",
                },
                { status: 500 }
            );
        }

        /*
         * Automatically authenticate the new user.
         */
        const {
            data: sessionData,
            error: sessionError,
        } = await supabaseAdmin.auth.signInWithPassword({
            email: internalEmail,
            password,
        });

        if (sessionError || !sessionData.session) {
            console.error(
                "Auto-login error:",
                sessionError
            );

            return NextResponse.json(
                {
                    error:
                        "Your account was created, but automatic sign-in failed. Please sign in again.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            access_token:
                sessionData.session.access_token,
            refresh_token:
                sessionData.session.refresh_token,
            user: {
                id: userId,
                name,
            },
        });
    } catch (error) {
        console.error(
            "NAME SIGNUP ERROR:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Something went wrong. Please try again.",
            },
            { status: 500 }
        );
    }
}