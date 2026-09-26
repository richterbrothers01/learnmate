"use client";

// ============================================================
// app/dashboard/page.tsx — LearnMate Student Dashboard
// ============================================================

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

// ============================================================
// TYPES
// ============================================================

type User = {
  name: string;
  email: string;
  klass: string;
  avatarUrl: string | null;
};

type Notif = {
  title: string;
  body: string;
  time: string;
};

type Course = {
  name: string;
  chapters: string;
  pct: number;
  icon: string;
};

type PerfRow = {
  label: string;
  pct: number;
};

type UpcomingTest = {
  title: string;
  subject: string;
  chapter: string;
  when: string;
  status: string;
};

type Activity = {
  title: string;
  sub: string;
  time: string;
};

type StreakMeta = {
  key: string;
  emoji: string;
  title: string;
  sub: string;
  gif: string | null;
};

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient();

// ============================================================
// FALLBACK USER
// ============================================================

const FALLBACK_USER: User = {
  name: "",
  email: "",
  klass: "Student",
  avatarUrl: null,
};

// ============================================================
// NOTIFICATIONS
// ============================================================

const MOCK_NOTIFS: Notif[] = [];

// ============================================================
// ZERO STATES
// ============================================================

const MOCK_OVERALL_PROGRESS = 0;
const MOCK_STUDY_TIME = "0h 0m";

const MOCK_COURSES: Course[] = [];
const MOCK_PERF: PerfRow[] = [];
const MOCK_UPCOMING: UpcomingTest[] = [];
const MOCK_ACTIVITY: Activity[] = [];

// ============================================================
// STREAK
// ============================================================

const MOCK_STREAK_DAYS = 0;

function getStreakMeta(days: number): StreakMeta {
  if (days < 3) {
    return {
      key: "turtle",
      emoji: "🐢",
      title: `${days} days`,
      sub: "Slow and steady",
      gif: "/turtle.gif",
    };
  }

  if (days === 4) {
    return {
      key: "bolt",
      emoji: "⚡",
      title: "4 days",
      sub: "Charged up!",
      gif: "/bolt.gif",
    };
  }

  if (days > 7) {
    return {
      key: "fire",
      emoji: "🔥",
      title: `${days} days`,
      sub: "On fire — keep it up!",
      gif: "/fire.gif",
    };
  }

  return {
    key: "normal",
    emoji: "🔥",
    title: `${days} days`,
    sub: "Keep learning",
    gif: null,
  };
}

// ============================================================
// NAVIGATION
// ============================================================

const NAV_ITEMS = [
  { emoji: "🏠", label: "Dashboard", active: true },
  { emoji: "📚", label: "My Courses", active: false },
  { emoji: "💡", label: "Doubt Clearer", active: false },
  { emoji: "🧠", label: "Quizzes", active: false },
  { emoji: "📝", label: "Tests", active: false },
  { emoji: "🏆", label: "Milestones", active: false },
  { emoji: "📊", label: "Analytics", active: false },
];

const RING_C = 201.06;

// ============================================================
// GREETING
// ============================================================

function greetingForHour(hour: number, name: string): string {
  const safeName = name || "Student";

  if (hour >= 0 && hour < 4) {
    return `Up late ${safeName}?`;
  }

  if (hour >= 4 && hour < 8) {
    return `Early morning study ${safeName}?`;
  }

  if (hour >= 8 && hour < 12) {
    return `Good morning, ${safeName}!`;
  }

  if (hour >= 12 && hour < 18) {
    return `Good Evening, ${safeName}!`;
  }

  return `Night Grind ${safeName}?`;
}

// ============================================================
// TYPEWRITER
// ============================================================

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

// ============================================================
// PROGRESS RING
// ============================================================

function ProgressRing({
  value,
  animate,
}: {
  value: number;
  animate: boolean;
}) {
  const fg = useRef<SVGCircleElement>(null);
  const txt = useRef<SVGTextElement>(null);

  useEffect(() => {
    const node = fg.current;
    const label = txt.current;

    if (!node || !label) return;

    const reduced = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    if (reduced || !animate || value === 0) {
      node.style.strokeDashoffset = String(
        RING_C * (1 - value / 100),
      );
      label.textContent = `${value}%`;
      return;
    }

    let raf = 0;

    const t0 = performance.now();
    const dur = 1400;

    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = value * eased;

      node.style.strokeDashoffset = String(
        RING_C * (1 - v / 100),
      );

      label.textContent = `${Math.round(v)}%`;

      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        node.style.strokeDashoffset = String(
          RING_C * (1 - value / 100),
        );

        label.textContent = `${value}%`;
      }
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [value, animate]);

  return (
    <div
      className="ring"
      role="img"
      aria-label={`Overall progress ${value} percent`}
    >
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          strokeWidth="9"
          className="ring-track"
          transform="rotate(-90 40 40)"
        />

        <circle
          ref={fg}
          cx="40"
          cy="40"
          r="32"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="ring-fg"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C}
          transform="rotate(-90 40 40)"
        />

        <text
          ref={txt}
          x="40"
          y="46"
          textAnchor="middle"
          className="ring-label"
        >
          0%
        </text>
      </svg>
    </div>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function DashboardPage() {
  const [user, setUser] = useState<User>(FALLBACK_USER);

  const [notifs] = useState<Notif[]>(MOCK_NOTIFS);

  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [theme, setTheme] =
    useState<"light" | "dark">("light");

  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");

  const [barsOn, setBarsOn] = useState(false);
  const [streakImgOk, setStreakImgOk] = useState(true);

  // ==========================================================
  // PHOTO / CROP
  // ==========================================================

  const [photoPreview, setPhotoPreview] =
    useState<string | null>(null);

  const [selectedPhotoSource, setSelectedPhotoSource] =
    useState<string | null>(null);

  const [selectedPhotoFile, setSelectedPhotoFile] =
    useState<File | null>(null);

  const [cropOpen, setCropOpen] = useState(false);

  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);

  const [photoSaving, setPhotoSaving] =
    useState(false);

  const [photoError, setPhotoError] =
    useState("");

  const photoInputRef =
    useRef<HTMLInputElement>(null);

  const photoImageRef =
    useRef<HTMLImageElement>(null);

  // ==========================================================
  // NAME SETUP
  // ==========================================================

  const [needsNameSetup, setNeedsNameSetup] =
    useState(false);

  const [nameSaving, setNameSaving] =
    useState(false);

  const [nameError, setNameError] =
    useState("");

  const [profileLoading, setProfileLoading] =
    useState(true);

  // ==========================================================
  // LOAD USER
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          if (mounted) {
            window.location.href = "/auth";
          }

          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("fullname, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!mounted) return;

        const fullname =
          profile?.fullname?.trim() || "";

        setUser({
          name: fullname || "",
          email: authUser.email || "",
          klass: "Student",
          avatarUrl: profile?.avatar_url || null,
        });

        setNameDraft(fullname);
        setEmailDraft(authUser.email || "");

        if (!fullname) {
          setNeedsNameSetup(true);
        }
      } catch (error) {
        console.error(
          "Unable to load LearnMate profile:",
          error,
        );
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // PREVENT BACKGROUND SCROLL WHEN MODALS ARE OPEN
  // ==========================================================

  useEffect(() => {
    const locked =
      settingsOpen ||
      cropOpen ||
      needsNameSetup;

    if (!locked) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    const previousBodyOverflow =
      document.body.style.overflow;

    const previousHtmlOverflow =
      document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousBodyOverflow;

      document.documentElement.style.overflow =
        previousHtmlOverflow;
    };
  }, [
    settingsOpen,
    cropOpen,
    needsNameSetup,
  ]);

  // ==========================================================
  // THEME
  // ==========================================================

  useEffect(() => {
    const saved =
      localStorage.getItem("learnmate-theme") as
      | "light"
      | "dark"
      | null;

    if (saved) {
      setTheme(saved);
    } else if (
      window.matchMedia("(prefers-color-scheme: dark)")
        .matches
    ) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme,
    );
  }, [theme]);

  // ==========================================================
  // BAR ANIMATION
  // ==========================================================

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      setBarsOn(true);
      return;
    }

    const timer = window.setTimeout(
      () => setBarsOn(true),
      300,
    );

    return () => window.clearTimeout(timer);
  }, []);

  // ==========================================================
  // SAVE NAME
  // ==========================================================

  const saveLearnMateName = async () => {
    const cleaned = nameDraft.trim();

    if (!cleaned) {
      setNameError("Please enter your name.");
      return;
    }

    setNameSaving(true);
    setNameError("");

    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "Could not get authenticated user:",
          userError,
        );

        setNameError(
          "Your session could not be verified. Please log in again.",
        );

        return;
      }

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const { error: updateError } =
        await supabase
          .from("profiles")
          .update({
            fullname: cleaned,
          })
          .eq("id", authUser.id);

      if (updateError) {
        console.error(
          "Supabase profile update error:",
          updateError,
        );

        setNameError(updateError.message);
        return;
      }

      setUser((prev) => ({
        ...prev,
        name: cleaned,
      }));

      setNeedsNameSetup(false);
    } catch (error) {
      console.error(
        "Could not save LearnMate name:",
        error,
      );

      setNameError(
        "Something went wrong while saving your name.",
      );
    } finally {
      setNameSaving(false);
    }
  };

  // ==========================================================
  // SAVE SETTINGS NAME
  // ==========================================================

  const saveSettings = async () => {
    const cleaned = nameDraft.trim();

    if (!cleaned) return;

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          fullname: cleaned,
        })
        .eq("id", authUser.id);

      if (error) {
        console.error(
          "Could not update name:",
          error,
        );
        return;
      }

      setUser((current) => ({
        ...current,
        name: cleaned,
      }));

      setSettingsOpen(false);
    } catch (error) {
      console.error(
        "Could not update name:",
        error,
      );
    }
  };

  // ==========================================================
  // THEME TOGGLE
  // ==========================================================

  const toggleTheme = () => {
    setTheme((current) => {
      const next =
        current === "dark"
          ? "light"
          : "dark";

      localStorage.setItem(
        "learnmate-theme",
        next,
      );

      return next;
    });
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "Logout error:",
        error,
      );
    }

    window.location.href = "/auth";
  };

  // ==========================================================
  // PHOTO FILE SELECT
  // ==========================================================

  const handlePhotoSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setPhotoError("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setPhotoError(
        "Only JPG, JPEG and PNG images are allowed.",
      );

      e.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setPhotoError(
        "Please choose an image smaller than 8 MB.",
      );

      e.target.value = "";
      return;
    }

    const objectUrl =
      URL.createObjectURL(file);

    setSelectedPhotoFile(file);
    setSelectedPhotoSource(objectUrl);

    setCropZoom(1);
    setCropX(0);
    setCropY(0);
    setCropOpen(true);
  };

  // ==========================================================
  // CANCEL CROP
  // ==========================================================

  const cancelCrop = () => {
    if (selectedPhotoSource) {
      URL.revokeObjectURL(
        selectedPhotoSource,
      );
    }

    setSelectedPhotoSource(null);
    setSelectedPhotoFile(null);
    setCropOpen(false);
    setCropZoom(1);
    setCropX(0);
    setCropY(0);

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  // ==========================================================
  // FINALIZE + UPLOAD PHOTO
  // ==========================================================

  const finalizePhoto = async () => {
    if (!selectedPhotoSource) return;

    setPhotoSaving(true);
    setPhotoError("");

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const image =
        photoImageRef.current;

      if (!image) {
        throw new Error(
          "Image could not be loaded.",
        );
      }

      const canvas =
        document.createElement("canvas");

      const OUTPUT_SIZE = 800;

      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Could not prepare image editor.",
        );
      }

      const naturalWidth =
        image.naturalWidth;

      const naturalHeight =
        image.naturalHeight;

      if (
        !naturalWidth ||
        !naturalHeight
      ) {
        throw new Error(
          "Image dimensions could not be read.",
        );
      }

      const baseScale =
        Math.max(
          OUTPUT_SIZE / naturalWidth,
          OUTPUT_SIZE / naturalHeight,
        );

      const scale =
        baseScale * cropZoom;

      const drawWidth =
        naturalWidth * scale;

      const drawHeight =
        naturalHeight * scale;

      const offsetX =
        (OUTPUT_SIZE - drawWidth) / 2 +
        (cropX / 100) * OUTPUT_SIZE;

      const offsetY =
        (OUTPUT_SIZE - drawHeight) / 2 +
        (cropY / 100) * OUTPUT_SIZE;

      ctx.clearRect(
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      ctx.drawImage(
        image,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight,
      );

      const blob =
        await new Promise<Blob | null>(
          (resolve) =>
            canvas.toBlob(
              resolve,
              "image/jpeg",
              0.9,
            ),
        );

      if (!blob) {
        throw new Error(
          "Could not create the final image.",
        );
      }

      const path =
        `${authUser.id}/profile.jpg`;

      const { error: uploadError } =
        await supabase.storage
          .from("avatars")
          .upload(
            path,
            blob,
            {
              contentType:
                "image/jpeg",
              upsert: true,
              cacheControl: "3600",
            },
          );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicUrlData,
      } =
        supabase.storage
          .from("avatars")
          .getPublicUrl(path);

      const publicUrl =
        `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } =
        await supabase
          .from("profiles")
          .update({
            avatar_url: publicUrl,
          })
          .eq("id", authUser.id);

      if (profileError) {
        throw profileError;
      }

      setPhotoPreview(publicUrl);

      setUser((current) => ({
        ...current,
        avatarUrl: publicUrl,
      }));

      if (selectedPhotoSource) {
        URL.revokeObjectURL(
          selectedPhotoSource,
        );
      }

      setSelectedPhotoSource(null);
      setSelectedPhotoFile(null);
      setCropOpen(false);
      setCropZoom(1);
      setCropX(0);
      setCropY(0);

      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    } catch (error) {
      console.error(
        "Could not save profile photo:",
        error,
      );

      if (
        error &&
        typeof error === "object" &&
        "message" in error
      ) {
        setPhotoError(
          String(
            (error as { message: string })
              .message,
          ),
        );
      } else {
        setPhotoError(
          "Could not save the profile photo. Please try again.",
        );
      }
    } finally {
      setPhotoSaving(false);
    }
  };

  // ==========================================================
  // CURRENT STREAK
  // ==========================================================

  const streakDays =
    MOCK_STREAK_DAYS;

  const streak =
    getStreakMeta(streakDays);

  // ==========================================================
  // WELCOME TYPEWRITER
  // ==========================================================

  const welcomeText =
    user.name
      ? `Welcome back, ${user.name}`
      : "Welcome back";

  const typedWelcome =
    useTypewriter(
      welcomeText,
      48,
      !profileLoading &&
      !needsNameSetup,
    );

  const initial = (
    user.name || "S"
  )
    .charAt(0)
    .toUpperCase();

  const currentHour =
    new Date().getHours();

  const welcomeSubtext =
    greetingForHour(
      currentHour,
      user.name,
    );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <style>{CSS}</style>

      <div className="lm">

        {/* MOBILE SIDEBAR SCRIM */}

        <div
          className={
            menuOpen
              ? "scrim show"
              : "scrim"
          }
          onClick={() =>
            setMenuOpen(false)
          }
          aria-hidden="true"
        />

        <div className="app">

          {/* SIDEBAR */}

          <aside
            className={
              menuOpen
                ? "sidebar open"
                : "sidebar"
            }
            aria-label="Primary navigation"
          >
            <div className="brand">

              <img
                className="brand-mark"
                src="/onlylogo.png"
                alt="LearnMate logo mark"
              />

              <img
                className="brand-word"
                src="/textlogo.png"
                alt="LearnMate"
              />

            </div>

            <nav
              className="nav"
              aria-label="Sections"
            >
              {NAV_ITEMS.map((n) => (
                <a
                  key={n.label}
                  href="#"
                  className={
                    n.active
                      ? "active"
                      : ""
                  }
                  aria-current={
                    n.active
                      ? "page"
                      : undefined
                  }
                >
                  <span
                    className="e"
                    aria-hidden="true"
                  >
                    {n.emoji}
                  </span>

                  {n.label}
                </a>
              ))}
            </nav>

            <div className="side-foot">

              <button
                type="button"
                onClick={() =>
                  setSettingsOpen(true)
                }
              >
                <span
                  className="e"
                  aria-hidden="true"
                >
                  ⚙️
                </span>

                Settings
              </button>

              <button
                type="button"
                className="profile-chip"
                onClick={() =>
                  setSettingsOpen(true)
                }
                aria-label="Open profile settings"
              >
                {photoPreview ||
                  user.avatarUrl ? (
                  <img
                    src={
                      photoPreview ??
                      user.avatarUrl ??
                      ""
                    }
                    alt="Profile photo"
                    className="profile-photo-small"
                  />
                ) : (
                  <span
                    className="fallback"
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                )}

                <span className="profile-meta">
                  <b>
                    {user.name ||
                      "Student"}
                  </b>

                  <small>
                    {user.klass}
                  </small>
                </span>

                <span aria-hidden="true">
                  ›
                </span>
              </button>

            </div>
          </aside>

          {/* MAIN */}

          <main className="main">

            {/* TOP BAR */}

            <div className="topbar reveal">

              <div className="top-left">

                <button
                  type="button"
                  className="icon-btn menu-btn"
                  onClick={() =>
                    setMenuOpen(true)
                  }
                  aria-label="Open menu"
                >
                  ☰
                </button>

                <div>

                  <h1 className="h1">
                    {typedWelcome}

                    <span className="type-cursor">
                      |
                    </span>
                  </h1>

                  <p className="sub">
                    {welcomeSubtext}
                  </p>

                </div>

              </div>

              <div className="top-actions">

                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Notifications"
                  aria-haspopup="true"
                  aria-expanded={
                    notifOpen
                  }
                  onClick={(e) => {
                    e.stopPropagation();

                    setNotifOpen(
                      (value) =>
                        !value,
                    );
                  }}
                >
                  <span
                    className="bell"
                    aria-hidden="true"
                  >
                    🔔
                  </span>

                  {notifs.length > 0 && (
                    <span
                      className="dot"
                      aria-label={`${notifs.length} new`}
                    >
                      {notifs.length}
                    </span>
                  )}
                </button>

                <div
                  className="avatar"
                  aria-label="Profile"
                >
                  {photoPreview ||
                    user.avatarUrl ? (
                    <img
                      src={
                        photoPreview ??
                        user.avatarUrl ??
                        ""
                      }
                      alt="Profile photo"
                    />
                  ) : (
                    <span aria-hidden="true">
                      {initial}
                    </span>
                  )}
                </div>

              </div>

            </div>

            {/* NOTIFICATION OVERLAY */}

            {notifOpen && (
              <div
                className="pop open"
                role="dialog"
                aria-label="Notifications"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <h4>
                  Notifications
                </h4>

                {notifs.length === 0 ? (
                  <p className="muted">
                    No new notifications.
                  </p>
                ) : (
                  notifs.map(
                    (n, i) => (
                      <div
                        key={i}
                        className="notif"
                      >
                        <span aria-hidden="true">
                          🔔
                        </span>

                        <span>
                          <b>
                            {n.title}
                          </b>

                          <br />

                          <small>
                            {n.body} ·{" "}
                            {n.time} ago
                          </small>
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {/* STATISTICS */}

            <section
              className="stats"
              aria-label="Overview"
            >

              <div className="card stat reveal d1">

                <ProgressRing
                  value={
                    MOCK_OVERALL_PROGRESS
                  }
                  animate
                />

                <div>
                  <b className="t">
                    Overall Progress
                  </b>

                  <small>
                    Across all courses
                  </small>
                </div>

              </div>

              <div className="card stat reveal d2">

                <div
                  className="streak-visual"
                  aria-hidden="true"
                >
                  {streak.gif &&
                    streakImgOk && (
                      <img
                        src={streak.gif}
                        alt=""
                        onError={() =>
                          setStreakImgOk(
                            false,
                          )
                        }
                      />
                    )}

                  {(!streak.gif ||
                    !streakImgOk) && (
                      <span className="streak-emoji">
                        {streak.emoji}
                      </span>
                    )}
                </div>

                <div>
                  <b className="t">
                    Streak
                  </b>

                  <div className="big">
                    {streak.title}
                  </div>

                  <small>
                    {streak.sub}
                  </small>
                </div>

              </div>

              <div className="card stat reveal d3">

                <div
                  className="stat-ic"
                  aria-hidden="true"
                >
                  🕒
                </div>

                <div>
                  <b className="t small-label">
                    Study Time
                  </b>

                  <div className="big">
                    {MOCK_STUDY_TIME}
                  </div>

                  <small>
                    This week
                  </small>
                </div>

              </div>

              <div className="card stat reveal d4">

                <div
                  className="stat-ic"
                  aria-hidden="true"
                >
                  📖
                </div>

                <div>
                  <b className="t small-label">
                    Courses
                  </b>

                  <div className="big">
                    0 active courses
                  </div>

                  <small>
                    Add your first course
                  </small>
                </div>

              </div>

            </section>

            {/* MAIN GRID */}

            <div className="grid">

              {/* LEFT */}

              <div className="col">

                {/* CONTINUE LEARNING */}

                <section
                  className="hero reveal d2"
                  aria-label="Continue learning"
                >

                  <div className="hero-head">
                    <span aria-hidden="true">
                      📖
                    </span>

                    Continue Learning
                  </div>

                  <div className="hero-body">

                    <div className="empty-course">

                      <div className="empty-course-icon">
                        📚
                      </div>

                      <div className="hero-info">

                        <h3>
                          Add New Course
                        </h3>

                        <p className="empty-course-text">
                          add new course to
                          continue learning
                        </p>

                        <div className="bar">
                          <i
                            style={{
                              width: "0%",
                            }}
                          />
                        </div>

                        <div className="hero-meta">

                          <span className="empty-course-text">
                            No course added yet
                          </span>

                          <span className="pct">
                            0%
                          </span>

                        </div>

                      </div>

                      <button
                        type="button"
                        className="btn-cream"
                      >
                        Add Course{" "}
                        <span aria-hidden="true">
                          →
                        </span>
                      </button>

                    </div>

                  </div>

                </section>

                {/* MY COURSES */}

                <div className="sec-head reveal d3">

                  <h2>
                    My Courses
                  </h2>

                  <a
                    className="link"
                    href="#"
                  >
                    View all{" "}
                    <span aria-hidden="true">
                      →
                    </span>
                  </a>

                </div>

                <section
                  className="courses-empty reveal d3"
                  aria-label="My courses"
                >
                  <span>
                    add new course
                  </span>
                </section>

                {/* PERFORMANCE */}

                <section
                  className="perf3 reveal d4"
                  aria-label="Performance"
                >

                  <div className="card pad">
                    <h3>
                      <span aria-hidden="true">
                        📊
                      </span>
                      Your Performance
                    </h3>

                    <div className="empty-section">
                      add new course
                    </div>
                  </div>

                  <div className="card pad">
                    <h3>
                      <span aria-hidden="true">
                        ⭐
                      </span>
                      Strong Topics
                    </h3>

                    <div className="empty-section">
                      add new course
                    </div>
                  </div>

                  <div className="card pad needs-attention-card">
                    <h3 className="warn-title">
                      <span aria-hidden="true">
                        ⚠️
                      </span>
                      Needs Attention
                    </h3>

                    <div className="empty-section">
                      add new course
                    </div>
                  </div>

                </section>

                {/* UPCOMING TESTS */}

                <section
                  className="card pad reveal d5"
                  aria-label="Upcoming tests"
                >

                  <div className="sec-head">

                    <h3>
                      <span aria-hidden="true">
                        🗓️
                      </span>
                      Upcoming Tests
                    </h3>

                    <a
                      className="link"
                      href="#"
                    >
                      View all{" "}
                      <span aria-hidden="true">
                        →
                      </span>
                    </a>

                  </div>

                  <div className="empty-section">
                    add new course
                  </div>

                </section>

                {/* LEARNING JOURNEY */}

                <section
                  className="card journey reveal d5"
                  aria-label="Learning journey"
                >

                  <b>
                    📖 LEARNING JOURNEY
                  </b>

                  <span className="empty-section">
                    add new course
                  </span>

                </section>

              </div>

              {/* RIGHT */}

              <div className="col">

                {/* COURSE STRUCTURE */}

                <section
                  className="card side-card reveal d3"
                  aria-label="Course structure"
                >

                  <div className="sec-head">

                    <h3>
                      📖 COURSE STRUCTURE
                    </h3>

                    <a
                      className="link"
                      href="#"
                    >
                      Add New Course{" "}
                      <span aria-hidden="true">
                        →
                      </span>
                    </a>

                  </div>

                  <div className="empty-side-state">
                    add new course
                  </div>

                </section>

                {/* DOUBT CLEARER */}

                <section
                  className="card side-card reveal d4"
                  aria-label="Doubt clearer"
                >

                  <div className="sec-head">

                    <h3>
                      💬 Doubt Clearer
                    </h3>

                    <small className="badge">
                      ⚡ AI Powered
                    </small>

                  </div>

                  <div className="qa empty-qa">

                    <div className="empty-section">
                      add new course
                    </div>

                  </div>

                </section>

                {/* RECENT ACTIVITY */}

                <section
                  className="card side-card reveal d5"
                  aria-label="Recent activity"
                >

                  <div className="sec-head">

                    <h3>
                      🕒 Recent Activity
                    </h3>

                    <a
                      className="link"
                      href="#"
                    >
                      View all{" "}
                      <span aria-hidden="true">
                        →
                      </span>
                    </a>

                  </div>

                  <div className="empty-side-state">
                    add new course
                  </div>

                </section>

              </div>

            </div>
          </main>
        </div>

        {/* ======================================================
            SETTINGS
        ====================================================== */}

        {settingsOpen && (
          <div
            className="modal-back open"
            onClick={(e) => {
              if (
                e.target ===
                e.currentTarget
              ) {
                setSettingsOpen(false);
              }
            }}
          >

            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
            >

              <header>

                <div className="set-title">
                  <b>
                    Settings
                  </b>

                  <br />

                  <small className="muted-text">
                    {user.email}
                  </small>
                </div>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() =>
                    setSettingsOpen(
                      false,
                    )
                  }
                  aria-label="Close settings"
                >
                  ✕
                </button>

              </header>

              <div className="body">

                {/* PROFILE PREVIEW */}

                <div className="settings-profile">

                  <div className="settings-avatar">
                    {photoPreview ||
                      user.avatarUrl ? (
                      <img
                        src={
                          photoPreview ??
                          user.avatarUrl ??
                          ""
                        }
                        alt="Profile photo"
                      />
                    ) : (
                      <span>
                        {initial}
                      </span>
                    )}
                  </div>

                  <div>
                    <b>
                      {user.name ||
                        "Student"}
                    </b>

                    <small>
                      Profile photo
                    </small>
                  </div>

                </div>

                {/* NAME */}

                <div className="field">

                  <label htmlFor="lm-name">
                    LearnMate name
                  </label>

                  <input
                    id="lm-name"
                    value={nameDraft}
                    onChange={(e) =>
                      setNameDraft(
                        e.target.value,
                      )
                    }
                    placeholder="Your LearnMate name"
                    maxLength={40}
                  />

                </div>

                {/* EMAIL */}

                <div className="field">

                  <label htmlFor="lm-email">
                    Email
                  </label>

                  <input
                    id="lm-email"
                    value={emailDraft}
                    readOnly
                  />

                </div>

                {/* PROFILE PHOTO */}

                <div className="field">

                  <label>
                    Profile photo
                  </label>

                  <input
                    ref={photoInputRef}
                    id="lm-photo"
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    className="photo-file-input"
                    onChange={
                      handlePhotoSelect
                    }
                  />

                  <button
                    type="button"
                    className="upload-photo-btn"
                    onClick={() =>
                      photoInputRef.current?.click()
                    }
                  >
                    <span>
                      {photoPreview ||
                        user.avatarUrl
                        ? "Change profile photo"
                        : "Upload profile photo"}
                    </span>

                    <span aria-hidden="true">
                      ↑
                    </span>
                  </button>

                  <small className="photo-help">
                    JPG or PNG · Maximum 8 MB
                  </small>

                  {photoError && (
                    <p className="photo-error">
                      {photoError}
                    </p>
                  )}

                </div>

                {/* DARK MODE */}

                <div className="switch">

                  <span>
                    Dark mode{" "}
                    <small className="muted-text">
                      Theme preference
                    </small>
                  </span>

                  <button
                    type="button"
                    className="toggle"
                    role="switch"
                    aria-checked={
                      theme === "dark"
                    }
                    aria-label="Toggle dark mode"
                    onClick={toggleTheme}
                  />

                </div>

                {/* ACTIONS */}

                <div className="row2">

                  <button
                    type="button"
                    className="btn-cream bordered"
                    onClick={
                      saveSettings
                    }
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    className="btn-brown centered"
                    onClick={
                      handleLogout
                    }
                  >
                    Log out
                  </button>

                </div>

              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            PHOTO CROP
        ====================================================== */}

        {cropOpen &&
          selectedPhotoSource && (
            <div
              className="crop-back"
              onClick={(e) => {
                if (
                  e.target ===
                  e.currentTarget
                ) {
                  cancelCrop();
                }
              }}
            >

              <div
                className="crop-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Crop profile photo"
              >

                <header className="crop-header">

                  <div>
                    <b>
                      Adjust profile photo
                    </b>

                    <small>
                      Crop and resize before saving
                    </small>
                  </div>

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={cancelCrop}
                    aria-label="Cancel photo editing"
                  >
                    ✕
                  </button>

                </header>

                <div className="crop-preview">

                  <div
                    className="crop-window"
                    style={{
                      backgroundImage:
                        `url("${selectedPhotoSource}")`,
                      backgroundPosition:
                        `calc(50% + ${cropX}%) calc(50% + ${cropY}%)`,
                      backgroundSize:
                        `${cropZoom * 100}%`,
                    }}
                  />

                  <span className="crop-circle">
                    Profile
                  </span>

                </div>

                <div className="crop-controls">

                  <label>
                    <span>
                      Zoom
                    </span>

                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.01"
                      value={cropZoom}
                      onChange={(e) =>
                        setCropZoom(
                          Number(
                            e.target.value,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Horizontal
                    </span>

                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={cropX}
                      onChange={(e) =>
                        setCropX(
                          Number(
                            e.target.value,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Vertical
                    </span>

                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={cropY}
                      onChange={(e) =>
                        setCropY(
                          Number(
                            e.target.value,
                          ),
                        )
                      }
                    />
                  </label>

                </div>

                <img
                  ref={photoImageRef}
                  src={selectedPhotoSource}
                  alt=""
                  className="crop-hidden-image"
                />

                <div className="crop-actions">

                  <button
                    type="button"
                    className="crop-cancel"
                    onClick={cancelCrop}
                    disabled={photoSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="crop-save"
                    onClick={
                      finalizePhoto
                    }
                    disabled={photoSaving}
                  >
                    {photoSaving
                      ? "Saving..."
                      : "Use this photo"}
                  </button>

                </div>

              </div>
            </div>
          )}

        {/* ======================================================
            FIRST LOGIN NAME SETUP
        ====================================================== */}

        {needsNameSetup && (
          <div className="name-setup-back">

            <div
              className="name-setup reveal"
              role="dialog"
              aria-modal="true"
              aria-label="Set your LearnMate name"
            >

              <h2>
                <TypewriterHeading
                  text="Set your LearnMate name"
                />
              </h2>

              <p>
                Choose the name you want
                LearnMate to use when
                welcoming you.
              </p>

              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(
                    e.target.value,
                  );

                  if (nameError) {
                    setNameError("");
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !nameSaving
                  ) {
                    saveLearnMateName();
                  }
                }}
                placeholder="Enter your name"
                maxLength={40}
              />

              {nameError && (
                <p className="name-error">
                  {nameError}
                </p>
              )}

              <button
                type="button"
                className="btn-brown name-save"
                onClick={
                  saveLearnMateName
                }
                disabled={nameSaving}
              >
                {nameSaving
                  ? "Saving..."
                  : "Continue"}

                {!nameSaving && (
                  <span aria-hidden="true">
                    →
                  </span>
                )}
              </button>

            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ============================================================
// TYPEWRITER HEADING
// ============================================================

function TypewriterHeading({
  text,
}: {
  text: string;
}) {
  const [displayed, setDisplayed] =
    useState("");

  useEffect(() => {
    let index = 0;

    setDisplayed("");

    const timer = window.setInterval(
      () => {
        index += 1;

        setDisplayed(
          text.slice(0, index),
        );

        if (index >= text.length) {
          window.clearInterval(timer);
        }
      },
      55,
    );

    return () =>
      window.clearInterval(timer);
  }, [text]);

  return (
    <>
      {displayed}
      <span className="type-cursor">
        |
      </span>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const CSS = `
:root{
  --brown:#7A2F00;
  --brown-900:#4A1E00;
  --cream:#E9C689;
  --cream-soft:#F6E6C6;
  --bg:#FAF4E8;
  --card:#FFFDF7;
  --card-2:#FFF9EE;
  --border:#E8DBC0;
  --border-soft:#EFE3C9;
  --text:#3D220F;
  --text-2:#6B4A2E;
  --muted:#8A6F52;
  --icon-bg:#F8EAD0;
  --sidebar-text:#F5E7CC;
  --sidebar-muted:#D8BE95;
  --track:#EDE0C6;
  --red:#D92D20;
  --radius:16px;
  --shadow:0 1px 2px rgba(122,47,0,.06),0 8px 24px rgba(122,47,0,.06)
}

[data-theme="dark"]{
  --bg:#17100A;
  --card:#221609;
  --card-2:#281B0D;
  --border:#3A2512;
  --border-soft:#3A2512;
  --text:#F6E8D0;
  --text-2:#D8BE95;
  --muted:#A68A65;
  --icon-bg:#35220F;
  --track:#3A2A18;
  --shadow:0 1px 2px rgba(0,0,0,.4)
}

*{
  box-sizing:border-box;
  margin:0;
  padding:0
}

html,
body{
  background:var(--bg);
  max-width:100%;
  overflow-x:hidden
}

.lm{
  font-family:'Inter',system-ui,-apple-system,'SF Pro Text',Segoe UI,Roboto,Arial,sans-serif;
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased
}

.lm button{
  font:inherit;
  cursor:pointer;
  border:0;
  background:none;
  color:inherit;
  min-height:36px
}

.lm button:disabled{
  opacity:.6;
  cursor:not-allowed
}

.lm img{
  display:block;
  max-width:100%
}

.lm .app{
  display:flex;
  min-height:100vh
}

/* SIDEBAR */

.lm .sidebar{
  width:236px;
  flex-shrink:0;
  background:var(--brown-900);
  color:var(--sidebar-text);
  position:fixed;
  inset:0 auto 0 0;
  height:100dvh;
  display:flex;
  flex-direction:column;
  padding:18px 14px 14px;
  z-index:50
}

.lm .brand{
  display:flex;
  align-items:center;
  gap:10px;
  padding:4px 8px 16px
}

.lm .brand-mark{
  width:70px;
  height:70px;
  object-fit:contain;
  border-radius:10px
}

.lm .brand-word{
  height:100px;
  width:auto;
  object-fit:contain
}

.lm .nav{
  display:flex;
  flex-direction:column;
  gap:4px;
  margin-top:4px
}

.lm .nav a{
  display:flex;
  align-items:center;
  gap:12px;
  text-decoration:none;
  color:var(--sidebar-text);
  padding:11px 12px;
  border-radius:12px;
  font-size:14px;
  font-weight:500
}

.lm .nav a:hover{
  background:rgba(233,198,137,.14)
}

.lm .nav a.active{
  background:rgba(233,198,137,.18);
  box-shadow:inset 0 0 0 1px rgba(233,198,137,.18);
  font-weight:600
}

.lm .side-foot{
  margin-top:auto;
  border-top:1px solid rgba(233,198,137,.22);
  padding-top:10px;
  display:flex;
  flex-direction:column;
  gap:8px
}

.lm .side-foot button,
.lm .profile-chip{
  display:flex;
  align-items:center;
  gap:12px;
  width:100%;
  text-align:left;
  padding:11px 12px;
  border-radius:12px;
  color:var(--sidebar-text);
  font-size:14px
}

.lm .side-foot button:hover,
.lm .profile-chip:hover{
  background:rgba(233,198,137,.14)
}

.lm .profile-photo-small{
  width:32px;
  height:32px;
  border-radius:50%;
  object-fit:cover;
  flex-shrink:0
}

.lm .fallback{
  width:32px;
  height:32px;
  border-radius:50%;
  background:var(--cream);
  color:var(--brown-900);
  display:grid;
  place-items:center;
  font-weight:800;
  flex-shrink:0
}

.lm .profile-meta{
  min-width:0;
  flex:1
}

.lm .profile-meta b{
  display:block;
  font-size:14px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis
}

.lm .profile-meta small{
  color:var(--sidebar-muted);
  font-size:12px
}

/* MAIN */

.lm .main{
  flex:1;
  margin-left:236px;
  min-width:0;
  padding:28px 28px 28px;
  max-width:1360px
}

.lm .topbar{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px
}

.lm .top-left{
  display:flex;
  gap:12px;
  align-items:center
}

.lm .h1{
  font-size:34px;
  letter-spacing:-.02em;
  font-weight:800;
  line-height:1.1
}

.lm .type-cursor{
  opacity:.45;
  animation:cursorBlink 1s steps(1) infinite
}

@keyframes cursorBlink{
  50%{
    opacity:0
  }
}

.lm .sub{
  color:var(--text-2);
  margin-top:6px;
  font-size:15px
}

.lm .top-actions{
  display:flex;
  align-items:center;
  gap:12px;
  position:relative
}

.lm .icon-btn{
  width:40px;
  height:40px;
  border-radius:50%;
  display:grid;
  place-items:center;
  position:relative
}

.lm .icon-btn:hover{
  background:var(--cream-soft)
}

[data-theme="dark"] .lm .icon-btn:hover{
  background:#35220F
}

.lm .bell{
  font-size:20px
}

.lm .dot{
  position:absolute;
  top:5px;
  right:5px;
  min-width:17px;
  height:17px;
  border-radius:999px;
  background:var(--red);
  color:#fff;
  font-size:10px;
  font-weight:700;
  display:grid;
  place-items:center;
  padding:0 5px;
  border:2px solid var(--bg)
}

.lm .avatar{
  width:42px;
  height:42px;
  border-radius:50%;
  overflow:hidden;
  background:var(--cream);
  border:1px solid var(--border);
  display:grid;
  place-items:center;
  font-weight:800;
  color:var(--brown-900);
  font-size:18px
}

.lm .avatar img{
  width:100%;
  height:100%;
  object-fit:cover
}

/* NOTIFICATIONS */

.lm .pop{
  position:fixed;
  top:78px;
  right:24px;
  width:min(320px,calc(100vw - 32px));
  max-height:min(420px,calc(100vh - 100px));
  overflow:auto;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:16px;
  box-shadow:0 12px 32px rgba(74,30,0,.18);
  padding:12px;
  z-index:150;
  animation:fadeIn .18s ease
}

.lm .pop h4{
  font-size:14px;
  margin:4px 4px 8px
}

.lm .notif{
  padding:10px;
  border-radius:10px;
  display:flex;
  gap:10px;
  font-size:13px
}

.lm .notif small{
  color:var(--muted)
}

.lm .muted{
  color:var(--muted);
  font-size:13px;
  padding:10px
}

/* STATS */

.lm .stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:14px;
  margin:20px 0 14px
}

.lm .card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow)
}

.lm .stat{
  padding:16px;
  display:flex;
  gap:14px;
  align-items:center
}

.lm .ring{
  width:68px;
  height:68px;
  flex-shrink:0
}

.lm .ring svg{
  width:100%;
  height:100%;
  transform:none
}

.lm .ring-track{
  stroke:var(--track)
}

.lm .ring-fg{
  stroke:#7A2F00
}

.lm .ring-label{
  font-size:16px;
  font-weight:800;
  fill:var(--text)
}

.lm .stat-ic{
  width:48px;
  height:48px;
  border-radius:14px;
  background:var(--icon-bg);
  display:grid;
  place-items:center;
  font-size:20px;
  flex-shrink:0
}

.lm .streak-visual{
  width:48px;
  height:48px;
  border-radius:14px;
  background:var(--icon-bg);
  display:grid;
  place-items:center;
  position:relative;
  flex-shrink:0;
  overflow:hidden
}

.lm .streak-visual img{
  position:absolute;
  inset:2px;
  width:calc(100% - 4px);
  height:calc(100% - 4px);
  object-fit:contain
}

.lm .streak-emoji{
  font-size:22px
}

.lm .stat b.t{
  display:block;
  font-size:15px
}

.lm .stat .big{
  font-size:22px;
  font-weight:800;
  letter-spacing:-.02em;
  margin-top:2px
}

.lm .stat small{
  color:var(--muted);
  font-size:12.5px
}

.lm .small-label{
  font-weight:500;
  font-size:13px
}

/* GRID */

.lm .grid{
  display:grid;
  grid-template-columns:1fr 375px;
  gap:14px;
  align-items:start
}

.lm .col{
  display:flex;
  flex-direction:column;
  gap:14px;
  min-width:0
}

/* HERO */

.lm .hero{
  background:var(--brown-900);
  color:#F8EAD0;
  border-radius:18px;
  padding:18px;
  border:1px solid rgba(0,0,0,.06)
}

.lm .hero-head{
  display:flex;
  align-items:center;
  gap:10px;
  font-weight:700;
  font-size:18px;
  margin-bottom:14px
}

.lm .hero-body{
  display:flex;
  gap:16px;
  align-items:center
}

.lm .empty-course{
  display:flex;
  gap:16px;
  align-items:center;
  width:100%;
  min-width:0
}

.lm .empty-course-icon{
  width:104px;
  height:104px;
  border-radius:14px;
  background:#2b1608;
  border:1px solid rgba(233,198,137,.3);
  display:grid;
  place-items:center;
  font-size:34px;
  flex-shrink:0
}

.lm .hero-info{
  flex:1;
  min-width:0
}

.lm .hero-info h3{
  font-size:19px
}

.lm .hero-info p{
  font-size:13px;
  color:var(--cream);
  opacity:.9;
  margin:6px 0 2px
}

.lm .empty-course-text{
  color:#F5E7CC;
  opacity:.6;
  font-size:13px
}

.lm .bar{
  height:8px;
  background:rgba(255,255,255,.18);
  border-radius:999px;
  margin-top:10px;
  overflow:hidden
}

.lm .bar i{
  display:block;
  height:100%;
  width:0;
  background:#F5E7CC;
  border-radius:999px;
  transition:width 1.2s cubic-bezier(.22,1,.36,1)
}

.lm .hero-meta{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:8px;
  font-size:13px
}

.lm .hero-meta .pct{
  margin-left:auto
}

/* BUTTONS */

.lm .btn-cream{
  background:#FBF2DF;
  color:#4A1E00;
  font-weight:700;
  padding:12px 18px;
  border-radius:14px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  white-space:nowrap;
  min-height:44px
}

.lm .btn-cream:hover{
  background:#FFFDF4
}

.lm .btn-cream.bordered{
  border:1px solid var(--border)
}

.lm .btn-brown{
  background:var(--brown);
  color:#FFF6E3;
  font-weight:700;
  padding:11px 16px;
  border-radius:14px;
  display:inline-flex;
  align-items:center;
  gap:8px;
  min-height:44px
}

.lm .btn-brown:hover{
  background:#8A3A05
}

.lm .btn-brown.centered{
  justify-content:center
}

/* SECTION HEAD */

.lm .sec-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0
}

.lm .sec-head h2{
  font-size:19px;
  font-weight:800
}

.lm .sec-head h3{
  font-size:15px;
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0
}

.lm .link{
  font-size:13px;
  color:var(--text-2);
  text-decoration:none;
  white-space:nowrap
}

/* COURSES */

.lm .courses-empty{
  min-height:110px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px dashed var(--border);
  border-radius:var(--radius);
  color:var(--text);
  opacity:.6;
  background:var(--card);
  min-width:0
}

.lm .courses-empty span{
  font-size:14px
}

/* PERFORMANCE */

.lm .perf3{
  display:grid;
  grid-template-columns:1.35fr .85fr .85fr;
  gap:14px;
  min-width:0
}

.lm .pad{
  padding:16px;
  min-width:0
}

.lm .pad h3{
  font-size:15px;
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:12px;
  min-width:0
}

.lm .warn-title{
  color:#9A3B00
}

.lm .empty-section{
  color:var(--text);
  opacity:.6;
  font-size:13px;
  padding:16px 0;
  overflow-wrap:anywhere
}

/* JOURNEY */

.lm .journey{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
  padding:14px 16px;
  font-size:12px;
  color:var(--text-2)
}

/* RIGHT SIDE */

.lm .side-card{
  padding:16px;
  min-width:0
}

.lm .badge{
  background:var(--icon-bg);
  padding:5px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:600;
  white-space:nowrap
}

.lm .empty-side-state{
  min-height:90px;
  display:grid;
  place-items:center;
  color:var(--text);
  opacity:.6;
  font-size:13px
}

.lm .qa{
  background:var(--card-2);
  border:1px solid var(--border-soft);
  border-radius:12px;
  padding:12px;
  margin-top:10px
}

.lm .empty-qa{
  min-height:100px;
  display:grid;
  place-items:center
}

/* SETTINGS */

.lm .modal-back{
  position:fixed;
  inset:0;
  background:rgba(40,18,0,.45);
  display:grid;
  place-items:center;
  z-index:180;
  padding:16px;
  animation:fadeIn .25s ease;
  overscroll-behavior:contain
}

.lm .modal{
  width:min(520px,100%);
  max-height:min(90dvh,760px);
  overflow-y:auto;
  overscroll-behavior:contain;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  animation:fadeUp .35s ease forwards
}

.lm .modal header{
  padding:16px 18px;
  border-bottom:1px solid var(--border-soft);
  display:flex;
  gap:10px;
  align-items:center
}

.lm .set-title{
  font-size:16px
}

.lm .modal header .icon-btn{
  margin-left:auto
}

.lm .modal .body{
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:14px
}

.lm .field label{
  font-size:13px;
  font-weight:600;
  display:block;
  margin-bottom:6px
}

.lm .field input{
  width:100%;
  padding:12px;
  border-radius:12px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  min-height:44px;
  outline:none
}

.lm .field input:focus{
  border-color:var(--brown)
}

.lm .row2{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px
}

.lm .switch{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  border:1px solid var(--border);
  border-radius:12px;
  padding:11px 12px;
  font-size:14px
}

.lm .muted-text{
  color:var(--muted)
}

.lm .toggle{
  width:50px;
  height:30px;
  border-radius:999px;
  background:var(--track);
  position:relative;
  flex-shrink:0;
  min-height:30px
}

.lm .toggle:after{
  content:"";
  position:absolute;
  top:3px;
  left:3px;
  width:24px;
  height:24px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.3)
}

.lm .toggle[aria-checked="true"]{
  background:var(--brown)
}

.lm .toggle[aria-checked="true"]:after{
  left:23px
}

/* SETTINGS PROFILE */

.lm .settings-profile{
  display:flex;
  align-items:center;
  gap:12px;
  padding:4px 0 8px
}

.lm .settings-avatar{
  width:58px;
  height:58px;
  border-radius:50%;
  overflow:hidden;
  background:var(--cream);
  color:var(--brown-900);
  display:grid;
  place-items:center;
  font-size:20px;
  font-weight:800;
  flex-shrink:0
}

.lm .settings-avatar img{
  width:100%;
  height:100%;
  object-fit:cover
}

.lm .settings-profile b{
  display:block;
  font-size:15px
}

.lm .settings-profile small{
  display:block;
  color:var(--muted);
  font-size:12px;
  margin-top:3px
}

/* PHOTO UPLOAD */

.lm .photo-file-input{
  display:none
}

.lm .upload-photo-btn{
  width:100%;
  min-height:48px;
  padding:12px 14px;
  border-radius:13px;
  border:1px solid var(--border);
  background:var(--card-2);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  font-weight:700;
  color:var(--text)
}

.lm .upload-photo-btn:hover{
  border-color:var(--brown);
  background:var(--cream-soft)
}

.lm .photo-help{
  display:block;
  color:var(--muted);
  font-size:11px;
  margin-top:6px
}

.lm .photo-error{
  color:#B42318;
  font-size:12px;
  margin-top:7px
}

/* PHOTO CROP */

.lm .crop-back{
  position:fixed;
  inset:0;
  z-index:250;
  background:rgba(40,18,0,.58);
  display:grid;
  place-items:center;
  padding:16px;
  overscroll-behavior:contain;
  animation:fadeIn .2s ease
}

.lm .crop-modal{
  width:min(520px,100%);
  max-height:calc(100dvh - 32px);
  overflow:auto;
  overscroll-behavior:contain;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:22px;
  box-shadow:0 20px 60px rgba(40,18,0,.28)
}

.lm .crop-header{
  display:flex;
  align-items:center;
  gap:12px;
  padding:16px 18px;
  border-bottom:1px solid var(--border-soft)
}

.lm .crop-header > div{
  min-width:0;
  flex:1
}

.lm .crop-header b{
  display:block;
  font-size:16px
}

.lm .crop-header small{
  display:block;
  color:var(--muted);
  font-size:12px;
  margin-top:3px
}

.lm .crop-preview{
  width:min(320px,80vw);
  aspect-ratio:1;
  margin:20px auto;
  position:relative;
  border-radius:50%;
  overflow:hidden;
  background:#2B1608;
  border:4px solid var(--cream);
  box-shadow:0 0 0 1px var(--border);
}

.lm .crop-window{
  position:absolute;
  inset:0;
  background-repeat:no-repeat;
  background-position:center;
  background-size:100%;
}

.lm .crop-circle{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  color:transparent;
  border-radius:50%;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)
}

.lm .crop-controls{
  padding:0 20px 16px;
  display:flex;
  flex-direction:column;
  gap:13px
}

.lm .crop-controls label{
  display:flex;
  flex-direction:column;
  gap:6px;
  color:var(--text);
  font-size:12px;
  font-weight:600
}

.lm .crop-controls input[type="range"]{
  width:100%;
  accent-color:var(--brown)
}

.lm .crop-hidden-image{
  display:none!important
}

.lm .crop-actions{
  display:grid;
  grid-template-columns:1fr 1.4fr;
  gap:10px;
  padding:16px 18px;
  border-top:1px solid var(--border-soft)
}

.lm .crop-cancel,
.lm .crop-save{
  min-height:46px;
  border-radius:13px;
  font-weight:700
}

.lm .crop-cancel{
  border:1px solid var(--border);
  background:var(--card-2)
}

.lm .crop-save{
  background:var(--brown);
  color:#FFF6E3
}

/* FIRST LOGIN */

.lm .name-setup-back{
  position:fixed;
  inset:0;
  z-index:200;
  background:rgba(40,18,0,.45);
  display:grid;
  place-items:center;
  padding:20px;
  animation:fadeIn .3s ease;
  overscroll-behavior:contain
}

.lm .name-setup{
  width:min(470px,100%);
  background:var(--card);
  border:1px solid var(--border);
  border-radius:22px;
  padding:30px;
  box-shadow:0 20px 60px rgba(74,30,0,.18);
  text-align:center
}

.lm .name-setup h2{
  font-size:25px;
  line-height:1.2;
  letter-spacing:-.02em;
  margin-bottom:10px
}

.lm .name-setup > p{
  color:var(--muted);
  font-size:14px;
  line-height:1.6;
  margin-bottom:20px
}

.lm .name-setup input{
  width:100%;
  min-height:48px;
  padding:13px 14px;
  border-radius:13px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  outline:none;
  margin-bottom:8px
}

.lm .name-setup input:focus{
  border-color:var(--brown)
}

.lm .name-error{
  color:#B42318!important;
  font-size:12px!important;
  margin:4px 0 10px!important
}

.lm .name-save{
  width:100%;
  justify-content:center;
  margin-top:10px
}

/* ANIMATION */

.lm .reveal{
  opacity:0;
  transform:translateY(8px);
  animation:fadeUp .55s ease forwards
}

@keyframes fadeUp{
  to{
    opacity:1;
    transform:none
  }
}

@keyframes fadeIn{
  from{
    opacity:0
  }

  to{
    opacity:1
  }
}

.lm .d1{
  animation-delay:.05s
}

.lm .d2{
  animation-delay:.12s
}

.lm .d3{
  animation-delay:.19s
}

.lm .d4{
  animation-delay:.26s
}

.lm .d5{
  animation-delay:.33s
}

.lm *{
  transition:
    background-color .25s ease,
    border-color .25s ease
}

.lm .menu-btn{
  display:none
}

.lm .scrim{
  display:none
}

@media (prefers-reduced-motion:reduce){

  .lm *,
  .lm *:before,
  .lm *:after{
    animation:none!important;
    transition:none!important
  }

  .lm .reveal{
    opacity:1;
    transform:none
  }

  .lm .bar i{
    transition:none
  }
}

/* TABLET */

@media(max-width:1100px){

  .lm .stats{
    grid-template-columns:repeat(2,1fr)
  }

  .lm .grid{
    grid-template-columns:1fr
  }

  .lm .perf3{
    grid-template-columns:repeat(3,minmax(0,1fr))
  }
}

/* PHONE */

@media(max-width:860px){

  .lm .sidebar{
    transform:translateX(-105%);
    transition:transform .28s ease;
    border-radius:0 20px 20px 0
  }

  .lm .sidebar.open{
    transform:none;
    box-shadow:0 0 60px rgba(0,0,0,.35)
  }

  .lm .main{
    margin-left:0;
    padding:18px 16px 90px;
    width:100%;
    max-width:none
  }

  .lm .menu-btn{
    display:grid
  }

  .lm .h1{
    font-size:26px
  }

  .lm .hero-body{
    flex-direction:column;
    align-items:stretch
  }

  .lm .empty-course{
    flex-direction:column;
    align-items:stretch
  }

  .lm .empty-course-icon{
    width:100%;
    height:110px
  }

  .lm .empty-course .btn-cream{
    width:100%;
    justify-content:center
  }

  .lm .row2{
    grid-template-columns:1fr
  }

  .lm .scrim{
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.35);
    z-index:40;
    display:none
  }

  .lm .scrim.show{
    display:block
  }

  .lm .stats{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px
  }

  .lm .stat{
    padding:12px;
    min-width:0
  }

  .lm .stat .big{
    font-size:18px
  }

  /* IMPORTANT MOBILE FIX:
     Needs Attention no longer gets squeezed off screen. */

  .lm .perf3{
    grid-template-columns:1fr;
    width:100%;
  }

  .lm .perf3 > .card{
    width:100%;
    min-width:0
  }

  .lm .needs-attention-card{
    min-width:0;
    overflow:hidden
  }

  .lm .needs-attention-card h3{
    flex-wrap:wrap;
    overflow-wrap:anywhere
  }

  .lm .name-setup{
    padding:24px 20px
  }

  .lm .pop{
    top:72px;
    right:12px;
    width:calc(100vw - 24px);
    max-height:70vh
  }

  .lm .brand-word{
    height:32px
  }

  .lm .crop-preview{
    width:min(280px,78vw)
  }
}

/* SMALL PHONES */

@media(max-width:520px){

  .lm .topbar{
    gap:8px
  }

  .lm .top-left{
    min-width:0;
    flex:1
  }

  .lm .top-left > div{
    min-width:0
  }

  .lm .h1{
    font-size:22px;
    overflow-wrap:anywhere
  }

  .lm .sub{
    font-size:13px
  }

  .lm .top-actions{
    flex-shrink:0
  }

  .lm .stats{
    grid-template-columns:1fr 1fr
  }

  .lm .stat{
    gap:9px
  }

  .lm .ring{
    width:54px;
    height:54px
  }

  .lm .stat-ic,
  .lm .streak-visual{
    width:42px;
    height:42px
  }

  .lm .stat .big{
    font-size:16px;
    overflow-wrap:anywhere
  }

  .lm .sec-head{
    flex-wrap:wrap
  }

  .lm .sec-head .link{
    margin-left:auto
  }

  .lm .modal-back,
  .lm .crop-back{
    padding:10px
  }

  .lm .modal{
    max-height:94dvh
  }

  .lm .name-setup h2{
    font-size:22px
  }
}

@media(max-width:380px){

  .lm .stats{
    grid-template-columns:1fr
  }

  .lm .h1{
    font-size:20px
  }

  .lm .main{
    padding-left:12px;
    padding-right:12px
  }

  .lm .crop-actions{
    grid-template-columns:1fr
  }
}
`;