"use client";

import { useEffect, useState } from "react";

/* ----------------------------------------------------------
   Same typewriter hook as app/dashboard/page.tsx
   (useTypewriter: 55ms per character, same interval logic).
   page.tsx files cannot export helpers in Next.js, so the
   hook is repeated here unchanged instead of imported.
---------------------------------------------------------- */
function useTypewriter(
  text: string,
  speed = 55,
  enabled = true,
) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      return;
    }

    setDisplayed("");

    if (!text) return;

    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed, enabled]);

  return displayed;
}

/* Typed heading: same blinking "|" cursor as the dashboard. */
export function LegalHeading({ text }: { text: string }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    );
  }, []);

  const typed = useTypewriter(text, 55, !reduced);

  return (
    <h1 className="h1 legal-title">
      <span className="legal-sr">{text}</span>

      <span aria-hidden="true">
        {typed}

        <span className="type-cursor">|</span>
      </span>
    </h1>
  );
}

/* Applies the saved LearnMate theme, mirroring the dashboard:
   saved "learnmate-theme" first, then the system preference. */
export function LegalThemeSync() {
  useEffect(() => {
    let theme: "light" | "dark" = "light";

    try {
      const saved = localStorage.getItem("learnmate-theme");

      if (saved === "light" || saved === "dark") {
        theme = saved;
      } else if (
        window.matchMedia("(prefers-color-scheme: dark)")
          .matches
      ) {
        theme = "dark";
      }
    } catch {
      /* storage unavailable: keep the light theme */
    }

    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
