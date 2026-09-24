"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkBrowser = async () => {
      /*
       * FIRST:
       * Check whether this browser has completed
       * LearnMate onboarding.
       */
      const onboardingCompleted =
        window.localStorage.getItem(
          "learnmate_onboarding_completed"
        );

      /*
       * New browser / first visit
       * → Onboarding
       */
      if (onboardingCompleted !== "true") {
        router.replace("/onboarding");
        return;
      }

      /*
       * Onboarding is already completed.
       * Now check whether the user is logged in.
       */
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      /*
       * Logged in
       * → Dashboard
       */
      if (user) {
        router.replace("/dashboard");
        return;
      }

      /*
       * Onboarding completed but not logged in
       * → Auth
       */
      router.replace("/auth");
    };

    checkBrowser();
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