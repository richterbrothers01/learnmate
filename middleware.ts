import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },

                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({
                        request,
                    });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    /*
     * If the user is already logged in,
     * they should never see onboarding or auth.
     */
    if (user) {
        if (
            pathname === "/" ||
            pathname === "/onboarding" ||
            pathname === "/auth"
        ) {
            return NextResponse.redirect(
                new URL("/dashboard", request.url)
            );
        }

        return response;
    }

    /*
     * User is NOT logged in.
     *
     * If they try to access the dashboard,
     * send them to Auth.
     */
    if (pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(
            new URL("/auth", request.url)
        );
    }

    return response;
}

export const config = {
    matcher: [
        "/",
        "/onboarding",
        "/auth",
        "/dashboard/:path*",
    ],
};