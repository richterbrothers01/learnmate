import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");

        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const accessToken = authHeader.substring(7).trim();

        if (!accessToken) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Verify that the access token belongs to a real logged-in user.
        const {
            data: { user },
            error: userError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (userError || !user) {
            return NextResponse.json(
                { error: "Your session is invalid or expired." },
                { status: 401 }
            );
        }

        const userId = user.id;

        // Delete the user's profile first.
        // If other LearnMate tables reference profiles/auth.users,
        // their rows should also be deleted here or have ON DELETE CASCADE.
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", userId);

        if (profileError) {
            console.error("Profile deletion error:", profileError);

            return NextResponse.json(
                {
                    error:
                        "Could not delete your profile. Your account was not deleted.",
                },
                { status: 500 }
            );
        }

        // Finally delete the actual Supabase Auth account.
        const { error: authDeleteError } =
            await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error("Auth account deletion error:", authDeleteError);

            return NextResponse.json(
                {
                    error:
                        "Your profile was deleted, but the authentication account could not be deleted. Please contact support.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Account deleted successfully.",
        });
    } catch (error) {
        console.error("Delete account route error:", error);

        return NextResponse.json(
            {
                error: "Could not delete your account. Please try again.",
            },
            { status: 500 }
        );
    }
}