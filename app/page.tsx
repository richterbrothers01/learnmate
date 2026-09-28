"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("learnmate-theme");

    if (savedTheme === "dark") {
      setDarkMode(true);
    } else if (savedTheme === "light") {
      setDarkMode(false);
    } else {
      setDarkMode(
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }

    const checkBrowser = async () => {
      const onboardingCompleted =
        window.localStorage.getItem(
          "learnmate_onboarding_completed"
        );

      if (onboardingCompleted !== "true") {
        router.replace("/onboarding");
        return;
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/dashboard");
        return;
      }

      router.replace("/auth");
    };

    checkBrowser();
  }, [router]);

  return (
    <main className={`loading-page ${darkMode ? "dark-mode" : ""}`}>
      <div className="page-decor">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>

      <div className="loading-content">
        <div className="loader-wrapper">
          <span className="loader-letter">S</span>
          <span className="loader-letter">t</span>
          <span className="loader-letter">a</span>
          <span className="loader-letter">r</span>
          <span className="loader-letter">t</span>
          <span className="loader-letter">i</span>
          <span className="loader-letter">n</span>
          <span className="loader-letter">g</span>

          <div className="loader"></div>
        </div>

        <div className="starting-text">
          Starting LearnMate🔥
        </div>
      </div>

      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-width: 100%;
          min-height: 100%;
          background: #7a2f00;
        }

        html {
          width: 100%;
          height: 100%;
        }

        body {
          min-height: 100vh;
          min-height: 100dvh;
          overflow: hidden;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        .loading-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;

          display: flex;
          align-items: center;
          justify-content: center;

          overflow: hidden;
          isolation: isolate;

          background: #7a2f00;
          color: #fff7e8;

          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

          transition: background 0.3s ease;
        }

        .loading-page.dark-mode {
          background: #111217;
        }

        /* =========================
           BACKGROUND DECOR
           ========================= */

        .page-decor {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;

          pointer-events: none;
          overflow: hidden;

          z-index: 0;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
        }

        .orb-one {
          width: 560px;
          height: 560px;

          left: -160px;
          top: -160px;

          background: #8e4214;
          opacity: 0.18;
        }

        .orb-two {
          width: 420px;
          height: 420px;

          right: -120px;
          bottom: -120px;

          background: #3e1e05;
          opacity: 0.18;
        }

        .dark-mode .orb-one {
          background: #8e4214;
          opacity: 0.12;
        }

        .dark-mode .orb-two {
          background: #3e1e05;
          opacity: 0.22;
        }

        /* =========================
           CONTENT
           ========================= */

        .loading-content {
          position: relative;
          z-index: 2;

          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;

          width: 100%;
        }

        /* =========================
           UIVERSE LOADER
           ========================= */

        .loader-wrapper {
          position: relative;

          display: flex;
          align-items: center;
          justify-content: center;

          width: 180px;
          height: 180px;

          font-family: "Inter", sans-serif;
          font-size: 1.2em;
          font-weight: 300;

          color: white;

          border-radius: 50%;
          background-color: transparent;

          user-select: none;
        }

        .loader {
          position: absolute;

          top: 0;
          left: 0;

          width: 100%;
          aspect-ratio: 1 / 1;

          border-radius: 50%;
          background-color: transparent;

          animation: loader-rotate 2s linear infinite;

          z-index: 0;
        }

        @keyframes loader-rotate {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 10px 20px 0 #fff inset,
              0 20px 30px 0 #ad5fff inset,
              0 60px 60px 0 #471eec inset;
          }

          50% {
            transform: rotate(270deg);
            box-shadow:
              0 10px 20px 0 #fff inset,
              0 20px 10px 0 #d60a47 inset,
              0 40px 60px 0 #311e80 inset;
          }

          100% {
            transform: rotate(450deg);
            box-shadow:
              0 10px 20px 0 #fff inset,
              0 20px 30px 0 #ad5fff inset,
              0 60px 60px 0 #471eec inset;
          }
        }

        .loader-letter {
          display: inline-block;

          opacity: 0.4;

          transform: translateY(0);

          animation: loader-letter-anim 2s infinite;

          z-index: 1;

          border-radius: 50ch;
          border: none;
        }

        .loader-letter:nth-child(1) {
          animation-delay: 0s;
        }

        .loader-letter:nth-child(2) {
          animation-delay: 0.1s;
        }

        .loader-letter:nth-child(3) {
          animation-delay: 0.2s;
        }

        .loader-letter:nth-child(4) {
          animation-delay: 0.3s;
        }

        .loader-letter:nth-child(5) {
          animation-delay: 0.4s;
        }

        .loader-letter:nth-child(6) {
          animation-delay: 0.5s;
        }

        .loader-letter:nth-child(7) {
          animation-delay: 0.6s;
        }

        .loader-letter:nth-child(8) {
          animation-delay: 0.7s;
        }

        @keyframes loader-letter-anim {
          0%,
          100% {
            opacity: 0.4;
            transform: translateY(0);
          }

          20% {
            opacity: 1;
            transform: scale(1.15);
          }

          40% {
            opacity: 0.7;
            transform: translateY(0);
          }
        }

        /* =========================
           TEXT
           ========================= */

        .starting-text {
          margin-top: 20px;

          font-size: 14px;
          font-weight: 300;

          color: rgba(255, 255, 255, 0.75);

          letter-spacing: 0.2px;
        }

        /* =========================
           MOBILE
           ========================= */

        @media (max-width: 520px) {
          .loader-wrapper {
            transform: scale(0.82);
          }

          .starting-text {
            margin-top: 10px;
            font-size: 13px;
          }
        }

        @media (max-height: 600px) {
          .loader-wrapper {
            transform: scale(0.78);
          }

          .starting-text {
            margin-top: 4px;
          }
        }

        /* =========================
           REDUCED MOTION
           ========================= */

        @media (prefers-reduced-motion: reduce) {
          .loader,
          .loader-letter {
            animation: none;
          }

          .loading-page {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}