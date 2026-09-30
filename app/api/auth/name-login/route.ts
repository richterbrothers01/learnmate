import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const name = String(body?.name ?? "").trim();
        const password = String(body?.password ?? "");

        if (!name || !password) {
            return NextResponse.json(
                {
                    error:
                        "LearnMate Name and password are required.",
                },
                { status: 400 }
            );
        }

        /*
         * Find the LearnMate profile.
         */
        const { data: profile, error: profileError } =
            await supabaseAdmin
                .from("profiles")
                .select("id, login_name")
                .ilike("login_name", name)
                .maybeSingle();

        if (profileError) {
            console.error(
                "Profile lookup error:",
                profileError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to sign in right now. Please try again.",
                },
                { status: 500 }
            );
        }

        if (!profile) {
            return NextResponse.json(
                {
                    error:
                        "Incorrect LearnMate Name or password.",
                },
                { status: 401 }
            );
        }

        /*
         * Find the corresponding Supabase Auth user.
         */
        const {
            data: userData,
            error: userError,
        } = await supabaseAdmin.auth.admin.getUserById(
            profile.id
        );

        if (
            userError ||
            !userData.user?.email
        ) {
            console.error(
                "Auth user lookup error:",
                userError
            );

            return NextResponse.json(
                {
                    error:
                        "Unable to sign in right now. Please try again.",
                },
                { status: 500 }
            );
        }

        /*
         * Authenticate using the internal Auth email.
         */
        const {
            data: sessionData,
            error: loginError,
        } =
            await supabaseAdmin.auth.signInWithPassword({
                email: userData.user.email,
                password,
            });

        if (
            loginError ||
            !sessionData.session
        ) {
            return NextResponse.json(
                {
                    error:
                        "Incorrect LearnMate Name or password.",
                },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            access_token:
                sessionData.session.access_token,
            refresh_token:
                sessionData.session.refresh_token,
            user: {
                id: profile.id,
                name: profile.login_name,
            },
        });
    } catch (error) {
        console.error(
            "NAME LOGIN ERROR:",
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