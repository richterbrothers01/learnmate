
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

const publicClient = createClient(
    supabaseUrl,
    publishableKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

// ============================================================
// NAME VALIDATION
// 3–20 characters
// Letters, numbers and spaces only
// ============================================================

function validName(value: string) {
    const name = value.trim();

    if (!name) {
        return {
            valid: false,
            message: "Name required",
        };
    }

    if (name.length < 3 || name.length > 20) {
        return {
            valid: false,
            message:
                "Name must be 3–20 characters and contain only letters, numbers, and spaces.",
        };
    }

    if (!/^[A-Za-z0-9 ]+$/.test(name)) {
        return {
            valid: false,
            message:
                "Name must be 3–20 characters and contain only letters, numbers, and spaces.",
        };
    }

    return {
        valid: true,
        message: "",
    };
}

// ============================================================
// CHECK NAME
// Case-insensitive
// ============================================================

async function nameExists(name: string) {
    const normalized = name.trim();

    const { data, error } = await admin
        .from("profiles")
        .select("id, login_name")
        .ilike("login_name", normalized)
        .limit(1);

    if (error) {
        throw new Error(error.message);
    }

    return Boolean(data && data.length > 0);
}

// ============================================================
// GENERATE REAL AVAILABLE NAME SUGGESTIONS
// ============================================================

async function getRecommendations(name: string) {
    const base = name.trim();

    const candidates: string[] = [];

    // Try the exact requested style first:
    // Lily1, Lily12, Lily123, etc.
    for (let i = 1; i <= 999; i++) {
        const candidate = `${ base }${ i } `;

        if (candidate.length > 20) {
            continue;
        }

        candidates.push(candidate);

        if (candidates.length >= 30) {
            break;
        }
    }

    // If the base is short enough, also try spaces + numbers.
    if (candidates.length < 30) {
        for (let i = 1; i <= 99; i++) {
            const candidate = `${ base } ${ i } `;

            if (candidate.length > 20) {
                continue;
            }

            candidates.push(candidate);

            if (candidates.length >= 30) {
                break;
            }
        }
    }

    const recommendations: string[] = [];

    for (const candidate of candidates) {
        if (recommendations.length >= 3) {
            break;
        }

        const exists = await nameExists(candidate);

        if (!exists) {
            recommendations.push(candidate);
        }
    }

    return recommendations;
}

// ============================================================
// INTERNAL EMAIL
//
// Supabase Auth needs an email identity.
// Users never see this email.
// ============================================================

function createInternalEmail() {
    return `${ crypto.randomUUID() } @auth.learnmate.local`;
}

// ============================================================
// RETURN SESSION IN BOTH FORMATS
//
// This makes the endpoint compatible with frontend code that
// expects either:
//
// result.session.access_token
//
// OR:
//
// result.access_token
// ============================================================

function sessionResponse(session: any) {
    return {
        success: true,

        session,

        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
        user: session.user,
    };
}

// ============================================================
// POST
// ============================================================

export async function POST(request: Request) {
    try {
        let body: any;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid authentication request.",
                },
                { status: 400 }
            );
        }

        const action = String(body?.action ?? "").trim();

        const name = String(
            body?.name ??
                body?.login_name ??
                ""
        ).trim();

        const password = String(
            body?.password ?? ""
        );

        // ========================================================
        // ENVIRONMENT CHECK
        // ========================================================

        if (
            !supabaseUrl ||
            !serviceRoleKey ||
            !publishableKey
        ) {
            console.error(
                "LearnMate auth environment variables are missing."
            );

            return NextResponse.json(
                {
                    success: false,
                    error:
                        "LearnMate authentication is not configured correctly.",
                },
                { status: 500 }
            );
        }

        // ========================================================
        // SIGN UP WITHOUT EMAIL
        // ========================================================

        if (action === "signup") {
            const validation = validName(name);

            if (!validation.valid) {
                return NextResponse.json(
                    {
                        success: false,
                        error: validation.message,
                    },
                    { status: 400 }
                );
            }

            if (!password) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Password required",
                    },
                    { status: 400 }
                );
            }

            if (password.length < 6) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Password must be at least 6 characters",
                    },
                    { status: 400 }
                );
            }

            if (password.length > 20) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Password must be 20 characters or less",
                    },
                    { status: 400 }
                );
            }

            // ----------------------------------------------------
            // CHECK DUPLICATE NAME BEFORE CREATING AUTH ACCOUNT
            // ----------------------------------------------------

            const alreadyExists = await nameExists(name);

            if (alreadyExists) {
                const recommendations =
                    await getRecommendations(name);

                return NextResponse.json(
                    {
                        success: false,
                        error: "That LearnMate name is already taken.",
                        code: "NAME_EXISTS",
                        recommendations,
                    },
                    { status: 409 }
                );
            }

            const normalizedName = name;

            // ----------------------------------------------------
            // CREATE PRIVATE AUTH IDENTITY
            // ----------------------------------------------------

            const internalEmail = createInternalEmail();

            const {
                data: createdUser,
                error: createError,
            } = await admin.auth.admin.createUser({
                email: internalEmail,
                password,
                email_confirm: true,

                user_metadata: {
                    full_name: normalizedName,
                    login_name: normalizedName,
                    auth_type: "name",
                },
            });

            if (
                createError ||
                !createdUser?.user
            ) {
                console.error(
                    "LearnMate createUser error:",
                    createError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            createError?.message ||
                            "Could not create your LearnMate account.",
                    },
                    { status: 400 }
                );
            }

            const userId = createdUser.user.id;

            // ----------------------------------------------------
            // CREATE PROFILE
            // ----------------------------------------------------

            const {
                error: profileError,
            } = await admin
                .from("profiles")
                .upsert(
                    {
                        id: userId,
                        fullname: normalizedName,
                        login_name: normalizedName,
                    },
                    {
                        onConflict: "id",
                    }
                );

            if (profileError) {
                console.error(
                    "LearnMate profile creation error:",
                    profileError
                );

                // Roll back Auth user if profile creation fails.
                await admin.auth.admin.deleteUser(userId);

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Could not finish creating your LearnMate profile.",
                    },
                    { status: 500 }
                );
            }

            // ----------------------------------------------------
            // AUTOMATIC LOGIN
            // ----------------------------------------------------

            const {
                data: sessionData,
                error: sessionError,
            } = await publicClient.auth.signInWithPassword({
                email: internalEmail,
                password,
            });

            if (
                sessionError ||
                !sessionData?.session
            ) {
                console.error(
                    "LearnMate automatic login error:",
                    sessionError
                );

                // Remove the account because signup was not
                // completed successfully.
                await admin.auth.admin.deleteUser(userId);

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            sessionError?.message ||
                            "Account was created, but automatic login failed.",
                    },
                    { status: 500 }
                );
            }

            // ----------------------------------------------------
            // IMPORTANT:
            // Return session AND token fields directly.
            // ----------------------------------------------------

            return NextResponse.json(
                sessionResponse(sessionData.session),
                { status: 200 }
            );
        }

        // ========================================================
        // SIGN IN WITH NAME
        //
        // Accept BOTH:
        // action: "signin"
        //
        // and old:
        // action: "signin-name"
        //
        // This keeps old accounts/frontend requests working.
        // ========================================================

        if (
            action === "signin" ||
            action === "signin-name"
        ) {
            const validation = validName(name);

            if (!validation.valid) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Enter a valid LearnMate name",
                    },
                    { status: 400 }
                );
            }

            if (!password) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Password required",
                    },
                    { status: 400 }
                );
            }

            // ----------------------------------------------------
            // FIND PROFILE
            // ----------------------------------------------------

            const {
                data: profile,
                error: profileError,
            } = await admin
                .from("profiles")
                .select("id, login_name")
                .ilike("login_name", name)
                .maybeSingle();

            if (profileError) {
                console.error(
                    "LearnMate profile lookup error:",
                    profileError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Unable to check your LearnMate name.",
                    },
                    { status: 500 }
                );
            }

            if (!profile) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Incorrect name or password",
                    },
                    { status: 401 }
                );
            }

            // ----------------------------------------------------
            // FIND AUTH USER
            // ----------------------------------------------------

            const {
                data: authUserData,
                error: authUserError,
            } = await admin.auth.admin.getUserById(
                profile.id
            );

            if (
                authUserError ||
                !authUserData?.user?.email
            ) {
                console.error(
                    "LearnMate Auth user lookup error:",
                    authUserError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Incorrect name or password",
                    },
                    { status: 401 }
                );
            }

            const internalEmail =
                authUserData.user.email;

            // ----------------------------------------------------
            // AUTHENTICATE USING INTERNAL EMAIL
            // ----------------------------------------------------

            const {
                data: sessionData,
                error: sessionError,
            } =
                await publicClient.auth.signInWithPassword(
                    {
                        email: internalEmail,
                        password,
                    }
                );

            if (
                sessionError ||
                !sessionData?.session
            ) {
                console.error(
                    "LearnMate name sign-in error:",
                    sessionError
                );

                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Incorrect name or password",
                    },
                    { status: 401 }
                );
            }

            // ----------------------------------------------------
            // RETURN COMPLETE SESSION
            // ----------------------------------------------------

            return NextResponse.json(
                sessionResponse(sessionData.session),
                { status: 200 }
            );
        }

        // ========================================================
        // UNKNOWN ACTION
        // ========================================================

        return NextResponse.json(
            {
                success: false,
                error: "Invalid authentication request.",
            },
            { status: 400 }
        );
    } catch (error: any) {
        console.error(
            "LearnMate username authentication error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    "Something went wrong. Please try again.",
            },
            { status: 500 }
        );
    }
}

