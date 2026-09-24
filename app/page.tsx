"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      /*
       * Already logged in
       * → Dashboard
       */
      if (user) {
        router.replace("/dashboard");
        return;
      }

      /*
       * Not logged in.
       *
       * Check whether this browser has already completed
       * LearnMate onboarding.
       */
      const onboardingCompleted =
        window.localStorage.getItem(
          "learnmate_onboarding_completed"
        );

      if (onboardingCompleted === "true") {
        /*
         * Returning user who is currently logged out
         * → Auth
         */
        router.replace("/auth");
      } else {
        /*
         * Completely new visitor
         * → Onboarding
         */
        router.replace("/onboarding");
      }
    };

    checkUser();
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#321100",
        color: "#fff",
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      Loading LearnMate...
    </main>
  );
}