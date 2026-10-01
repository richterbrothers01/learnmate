"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { createClient } from "../../lib/supabase/client";

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

type StreakMeta = {
  key: string;
  emoji: string;
  title: string;
  sub: string;
  gif: string | null;
};

type SettingsView = "main" | "name" | "email";
type ConfirmAction = "logout" | "delete" | null;

type Course = {
  id: string;
  title: string;
  class: string;
  subject: string;
  progress: number;
};

const supabase = createClient();

const FALLBACK_USER: User = {
  name: "",
  email: "",
  klass: "Student",
  avatarUrl: null,
};

const MOCK_NOTIFS: Notif[] = [];
const MOCK_OVERALL_PROGRESS = 0;
const MOCK_STUDY_TIME = "0h 0m";

const CLASSES = Array.from(
  { length: 12 },
  (_, i) => `Class ${i + 1}`,
);

const SUBJECTS = [
  "Information Technology",
  "Science",
  "Social Science",
  "Mathematics",
  "English",
];

function getStreakMeta(days: number): StreakMeta {
  if (days <= 3) {
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

  return {
    key: "fire",
    emoji: "🔥",
    title: `${days} days`,
    sub: "On fire — keep it up!",
    gif: "/fire.gif",
  };
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function calculateCurrentStreak(dates: string[]): number {
  if (!dates.length) return 0;

  const uniqueDates = Array.from(new Set(dates)).sort((a, b) =>
    b.localeCompare(a),
  );

  const today = getLocalDateString(new Date());

  const firstDate =
    uniqueDates[0] === today ? today : uniqueDates[0];

  let streak = 1;

  for (let i = 1; i < uniqueDates.length; i += 1) {
    const current = parseDateString(firstDate);

    current.setDate(current.getDate() - streak);

    const expected = getLocalDateString(current);

    if (uniqueDates[i] === expected) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

const NAV_ITEMS = [
  { emoji: "🏠", label: "Dashboard" },
  { emoji: "📚", label: "My Courses" },
  { emoji: "💡", label: "Doubt Clearer" },
  { emoji: "🧠", label: "Quizzes" },
  { emoji: "📝", label: "Tests" },
  { emoji: "🏆", label: "Milestones" },
  { emoji: "📊", label: "Analytics" },
];

const RING_C = 201.06;

function greetingForHour(hour: number, name: string): string {
  const safeName = name || "Student";

  if (hour >= 0 && hour < 4) return `Up late ${safeName}?`;
  if (hour >= 4 && hour < 8)
    return `Early morning study ${safeName}?`;
  if (hour >= 8 && hour < 12)
    return `Good morning, ${safeName}!`;
  if (hour >= 12 && hour < 18)
    return `Good Evening, ${safeName}!`;

  return `Night Grind ${safeName}?`;
}

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
    const start = performance.now();
    const duration = 1400;

    const tick = (time: number) => {
      const progress = Math.min(
        1,
        (time - start) / duration,
      );

      const eased = 1 - Math.pow(1 - progress, 3);
      const current = value * eased;

      node.style.strokeDashoffset = String(
        RING_C * (1 - current / 100),
      );

      label.textContent = `${Math.round(current)}%`;

      if (progress < 1) {
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

export default function DashboardPage() {
  const [user, setUser] = useState<User>(FALLBACK_USER);
  const [notifs] = useState<Notif[]>(MOCK_NOTIFS);

  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsView, setSettingsView] =
    useState<SettingsView>("main");

  const [theme, setTheme] =
    useState<"light" | "dark">("light");

  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");

  const [settingsSaving, setSettingsSaving] =
    useState(false);
  const [settingsError, setSettingsError] = useState("");

  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const [streakImgOk, setStreakImgOk] = useState(true);
  const [streakDays, setStreakDays] = useState(0);
  const [streakLoading, setStreakLoading] =
    useState(true);

  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null);

  const [accountActionLoading, setAccountActionLoading] =
    useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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

  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const photoInputRef =
    useRef<HTMLInputElement>(null);

  const photoImageRef =
    useRef<HTMLImageElement>(null);

  const [needsNameSetup, setNeedsNameSetup] =
    useState(false);

  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [profileLoading, setProfileLoading] =
    useState(true);

  /* ==========================================================
     MARK 2 — COURSES
  ========================================================== */

  const [activeSection, setActiveSection] =
    useState<"dashboard" | "courses">(
      "dashboard",
    );

  const [addOpen, setAddOpen] = useState(false);
  const [addClosing, setAddClosing] = useState(false);

  const [courses, setCourses] =
    useState<Course[]>([]);
  const [courseTab, setCourseTab] =
    useState<"ongoing" | "completed">("ongoing");

  const [selectedClass, setSelectedClass] =
    useState<string | null>(null);

  const [selectedSubject, setSelectedSubject] =
    useState<string | null>(null);

  const [coursesContentReady, setCoursesContentReady] =
    useState(false);

  const [addControlsReady, setAddControlsReady] =
    useState(false);

  useEffect(() => {
    const savedSection =
      localStorage.getItem(
        "learnmate-active-section",
      );

    if (savedSection === "courses") {
      setActiveSection("courses");
    } else {
      setActiveSection("dashboard");
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "courses") {
      setCoursesContentReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCoursesContentReady(true);
    }, 30);

    return () => window.clearTimeout(timer);
  }, [activeSection]);

  useEffect(() => {
    if (!addOpen) {
      setAddControlsReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setAddControlsReady(true);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [addOpen]);

  const ongoingCourses = courses.filter(
    (course) => course.progress < 100,
  );

  const completedCourses = courses.filter(
    (course) => course.progress === 100,
  );

  /* ==========================================================
     LOAD PROFILE
  ========================================================== */

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

        const { data: profile } =
          await supabase
            .from("profiles")
            .select("fullname, avatar_url")
            .eq("id", authUser.id)
            .maybeSingle();

        if (!mounted) return;

        const fullname =
          profile?.fullname?.trim() || "";

        setUser({
          name: fullname,
          email: authUser.email || "",
          klass: "Student",
          avatarUrl:
            profile?.avatar_url || null,
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

  /* ==========================================================
     DAILY STREAK
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const recordDailyVisit = async () => {
      try {
        setStreakLoading(true);

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          if (mounted) setStreakDays(0);
          return;
        }

        const today =
          getLocalDateString(new Date());

        const { error: insertError } =
          await supabase
            .from("study_streaks")
            .upsert(
              {
                user_id: authUser.id,
                activity_date: today,
              },
              {
                onConflict:
                  "user_id,activity_date",
                ignoreDuplicates: true,
              },
            );

        if (insertError) {
          console.error(
            "Could not record daily visit:",
            insertError,
          );
        }

        const {
          data: activity,
          error: activityError,
        } = await supabase
          .from("study_streaks")
          .select("activity_date")
          .eq("user_id", authUser.id)
          .order("activity_date", {
            ascending: false,
          });

        if (activityError) {
          console.error(
            "Could not load streak history:",
            activityError,
          );

          if (mounted) setStreakDays(0);
          return;
        }

        if (!mounted) return;

        const dates =
          activity?.map(
            (row) => row.activity_date,
          ) || [];

        setStreakDays(
          calculateCurrentStreak(dates),
        );
      } catch (error) {
        console.error(
          "Streak error:",
          error,
        );

        if (mounted) setStreakDays(0);
      } finally {
        if (mounted) {
          setStreakLoading(false);
        }
      }
    };

    recordDailyVisit();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     OUTSIDE CLICK
  ========================================================== */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        notifOpen &&
        notifRef.current &&
        !notifRef.current.contains(target)
      ) {
        setNotifOpen(false);
      }

      if (
        settingsOpen &&
        settingsRef.current &&
        !settingsRef.current.contains(target)
      ) {
        setSettingsOpen(false);
        setSettingsView("main");
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, [notifOpen, settingsOpen]);

  /* ==========================================================
     LOCK BACKGROUND
  ========================================================== */

  useEffect(() => {
    const locked =
      menuOpen ||
      settingsOpen ||
      cropOpen ||
      needsNameSetup ||
      confirmAction !== null;

    if (!locked) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow =
        "";
      return;
    }

    const previousBody =
      document.body.style.overflow;

    const previousHtml =
      document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousBody;

      document.documentElement.style.overflow =
        previousHtml;
    };
  }, [
    menuOpen,
    settingsOpen,
    cropOpen,
    needsNameSetup,
    confirmAction,
  ]);

  /* ==========================================================
     THEME
  ========================================================== */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "learnmate-theme",
      ) as "light" | "dark" | null;

    if (saved) {
      setTheme(saved);
    } else if (
      window
        .matchMedia(
          "(prefers-color-scheme: dark)",
        )
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

  /* ==========================================================
     TOAST
  ========================================================== */

  const showToast = (
    message: string,
    type: "error" | "success" = "error",
  ) => {
    setToast({
      message,
      type,
    });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  /* ==========================================================
     VALIDATION
  ========================================================== */

  const isValidLearnMateName = (
    name: string,
  ) => /^[A-Za-z0-9 ]+$/.test(name);

  const isValidEmail = (
    email: string,
  ) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim(),
    );

  /* ==========================================================
     FIRST LOGIN NAME
  ========================================================== */

  const saveLearnMateName = async () => {
    const cleaned = nameDraft.trim();

    if (!cleaned) {
      setNameError(
        "Please enter your name.",
      );
      return;
    }

    if (
      !isValidLearnMateName(cleaned)
    ) {
      setNameError(
        "Name can't have special characters like -=+@#$%^&*() etc.",
      );
      return;
    }

    setNameSaving(true);
    setNameError("");

    try {
      const {
        data: { user: authUser },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !authUser) {
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
        setNameError(
          updateError.message,
        );
        return;
      }

      setUser((prev) => ({
        ...prev,
        name: cleaned,
      }));

      setNeedsNameSetup(false);
    } catch (error) {
      console.error(error);

      setNameError(
        "Something went wrong while saving your name.",
      );
    } finally {
      setNameSaving(false);
    }
  };

  /* ==========================================================
     CHANGE NAME
  ========================================================== */

  const changeLearnMateName = async () => {
    const cleaned = nameDraft.trim();

    if (!cleaned) {
      showToast("Please enter your name.");
      return;
    }

    if (
      !isValidLearnMateName(cleaned)
    ) {
      showToast(
        "Name can't have special characters like -=+@#$%^&*() etc.",
      );
      return;
    }

    setSettingsSaving(true);

    try {
      const {
        data: { user: authUser },
      } =
        await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const { error } =
        await supabase
          .from("profiles")
          .update({
            fullname: cleaned,
          })
          .eq("id", authUser.id);

      if (error) {
        showToast(error.message);
        return;
      }

      setUser((current) => ({
        ...current,
        name: cleaned,
      }));

      setNameDraft(cleaned);

      showToast(
        "Your LearnMate name has been changed.",
        "success",
      );

      setSettingsView("main");
    } catch (error) {
      console.error(error);

      showToast(
        "Something went wrong while changing your name.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  /* ==========================================================
     CHANGE EMAIL
  ========================================================== */

  const changeEmail = async () => {
    const cleaned = emailDraft.trim();

    if (!cleaned) {
      showToast(
        "Please enter your email.",
      );
      return;
    }

    if (!isValidEmail(cleaned)) {
      showToast(
        "Please enter a valid email address.",
      );
      return;
    }

    if (
      cleaned.toLowerCase() ===
      user.email.toLowerCase()
    ) {
      showToast(
        "This is already your current email.",
      );
      return;
    }

    setSettingsSaving(true);

    try {
      const {
        data: { user: authUser },
      } =
        await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const { error } =
        await supabase.auth.updateUser({
          email: cleaned,
        });

      if (error) {
        showToast(error.message);
        return;
      }

      showToast(
        "Check your new email to confirm the change.",
        "success",
      );

      setSettingsView("main");
    } catch (error) {
      console.error(error);

      showToast(
        "Something went wrong while changing your email.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  /* ==========================================================
     SAVE SETTINGS
  ========================================================== */

  const saveSettings = async () => {
    const cleaned = nameDraft.trim();

    if (!cleaned) {
      showToast("Please enter your name.");
      return;
    }

    if (
      !isValidLearnMateName(cleaned)
    ) {
      showToast(
        "Name can't have special characters like -=+@#$%^&*() etc.",
      );
      return;
    }

    setSettingsSaving(true);

    try {
      const {
        data: { user: authUser },
      } =
        await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const { error } =
        await supabase
          .from("profiles")
          .update({
            fullname: cleaned,
          })
          .eq("id", authUser.id);

      if (error) {
        showToast(error.message);
        return;
      }

      setUser((current) => ({
        ...current,
        name: cleaned,
      }));

      setNameDraft(cleaned);

      showToast(
        "Your LearnMate name has been updated.",
        "success",
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Something went wrong while saving your settings.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  /* ==========================================================
     THEME
  ========================================================== */

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

  /* ==========================================================
     LOGOUT / DELETE
  ========================================================== */

  const requestLogout = () => {
    setNotifOpen(false);
    setSettingsOpen(false);
    setConfirmAction("logout");
  };

  const handleLogout = async () => {
    setAccountActionLoading(true);

    try {
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        showToast(error.message);
        setConfirmAction(null);
        return;
      }

      window.location.href = "/auth";
    } catch (error) {
      console.error(
        "Logout error:",
        error,
      );

      showToast(
        "Could not log out. Please try again.",
      );

      setConfirmAction(null);
    } finally {
      setAccountActionLoading(false);
    }
  };

  const requestDeleteAccount = () => {
    setNotifOpen(false);
    setSettingsOpen(false);
    setConfirmAction("delete");
  };

  const handleDeleteAccount = async () => {
    setAccountActionLoading(true);

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/auth";
        return;
      }

      const response = await fetch(
        "/api/account/delete",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
        },
      );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Could not delete your account.",
        );
      }

      await supabase.auth.signOut();

      window.location.href = "/auth";
    } catch (error) {
      console.error(
        "Account deletion error:",
        error,
      );

      showToast(
        error instanceof Error
          ? error.message
          : "Could not delete your account. Please try again.",
      );

      setConfirmAction(null);
    } finally {
      setAccountActionLoading(false);
    }
  };

  /* ==========================================================
     PHOTO
  ========================================================== */

  const handlePhotoSelect = (
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setPhotoError("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
    ];

    if (
      !allowedTypes.includes(
        file.type,
      )
    ) {
      setPhotoError(
        "Only JPG, JPEG and PNG images are allowed.",
      );

      e.target.value = "";
      return;
    }

    if (
      file.size >
      8 * 1024 * 1024
    ) {
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

  const finalizePhoto = async () => {
    if (!selectedPhotoSource) return;

    setPhotoSaving(true);
    setPhotoError("");

    try {
      const {
        data: { user: authUser },
      } =
        await supabase.auth.getUser();

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
          OUTPUT_SIZE /
          naturalWidth,
          OUTPUT_SIZE /
          naturalHeight,
        );

      const scale =
        baseScale * cropZoom;

      const drawWidth =
        naturalWidth * scale;

      const drawHeight =
        naturalHeight * scale;

      const offsetX =
        (OUTPUT_SIZE -
          drawWidth) /
        2 +
        (cropX / 100) *
        OUTPUT_SIZE;

      const offsetY =
        (OUTPUT_SIZE -
          drawHeight) /
        2 +
        (cropY / 100) *
        OUTPUT_SIZE;

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

      showToast(
        "Profile photo updated.",
        "success",
      );
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
            (
              error as {
                message: string;
              }
            ).message,
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

  /* ==========================================================
     MARK 2 — NAVIGATION
  ========================================================== */

  const handleNavClick = (
    label: string,
  ) => {
    if (label === "Dashboard") {
      setActiveSection("dashboard");
      setAddOpen(false);
      setAddClosing(false);

      localStorage.setItem(
        "learnmate-active-section",
        "dashboard",
      );

      return;
    }

    if (label === "My Courses") {
      setActiveSection("courses");
      setAddOpen(false);
      setAddClosing(false);

      localStorage.setItem(
        "learnmate-active-section",
        "courses",
      );

      return;
    }

    showToast(
      "This Feature will be added in MARK3 Update",
      "error",
    );
  };

  /* ==========================================================
     MARK 2 — ADD COURSE
  ========================================================== */

  const openAddCourse = () => {
    setAddClosing(false);
    setAddOpen(true);
    setSelectedClass(null);
    setSelectedSubject(null);
    setAddControlsReady(false);
  };

  const cancelAddCourse = () => {
    if (addClosing) return;

    setAddClosing(true);
    setAddControlsReady(false);

    window.setTimeout(() => {
      setAddOpen(false);
      setAddClosing(false);
      setSelectedClass(null);
      setSelectedSubject(null);
    }, 320);
  };

  const addCourse = () => {
    if (!selectedClass) {
      showToast(
        "Please select your class.",
        "error",
      );
      return;
    }

    if (!selectedSubject) {
      showToast(
        "Please select your subject.",
        "error",
      );
      return;
    }

    const newCourse: Course = {
      id: `${Date.now()}-${selectedClass}-${selectedSubject}`,
      title: `${selectedSubject} — ${selectedClass}`,
      class: selectedClass,
      subject: selectedSubject,
      progress: 0,
    };

    setCourses((current) => [
      ...current,
      newCourse,
    ]);

    showToast(
      "Course added successfully.",
      "success",
    );

    setAddOpen(false);
    setAddClosing(false);
    setSelectedClass(null);
    setSelectedSubject(null);
  };

  /* ==========================================================
     DISPLAY
  ========================================================== */

  const streak = getStreakMeta(
    streakLoading ? 0 : streakDays,
  );

  const welcomeText = user.name
    ? `Welcome back, ${user.name}`
    : "Welcome back";

  const typedWelcome = useTypewriter(
    welcomeText,
    48,
    !profileLoading &&
    !needsNameSetup &&
    activeSection === "dashboard",
  );

  const typedCoursesHeading =
    useTypewriter(
      "My Courses",
      55,
      activeSection === "courses" &&
      !addOpen &&
      !addClosing,
    );

  const typedAddHeading =
    useTypewriter(
      "Add a new course",
      55,
      addOpen || addClosing,
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

  const openSettings = () => {
    setMenuOpen(false);
    setNotifOpen(false);
    setSettingsView("main");
    setSettingsError("");
    setSettingsOpen(true);
  };

  return (
    <>
      <style>{CSS}</style>

      <div className="lm">
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
              {NAV_ITEMS.map((item) => {
                const active =
                  (activeSection ===
                    "dashboard" &&
                    item.label ===
                    "Dashboard") ||
                  (activeSection ===
                    "courses" &&
                    item.label ===
                    "My Courses");

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={
                      active
                        ? "nav-link active"
                        : "nav-link"
                    }
                    onClick={() => {
                      setMenuOpen(false);
                      setNotifOpen(false);
                      handleNavClick(
                        item.label,
                      );
                    }}
                  >
                    <span
                      aria-hidden="true"
                    >
                      {item.emoji}
                    </span>

                    <span>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="side-foot">
              <button
                type="button"
                onClick={openSettings}
              >
                <span
                  aria-hidden="true"
                >
                  ⚙️
                </span>

                Settings
              </button>

              <button
                type="button"
                className="profile-chip"
                onClick={openSettings}
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

          <main className="main">
            {/* TOPBAR */}

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

                {activeSection ===
                  "dashboard" ? (
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
                ) : (
                  <div className="courses-heading-wrap">
                    {!addOpen &&
                      !addClosing && (
                        <h1 className="h1">
                          {typedCoursesHeading}

                          <span className="type-cursor">
                            |
                          </span>
                        </h1>
                      )}

                    {addOpen &&
                      !addClosing && (
                        <h1 className="h1">
                          {typedAddHeading}

                          <span className="type-cursor">
                            |
                          </span>
                        </h1>
                      )}
                  </div>
                )}
              </div>

              <div className="top-actions">
                <div className="desktop-theme-toggle">
                  <button
                    type="button"
                    className="theme-switch"
                    role="switch"
                    aria-checked={
                      theme === "dark"
                    }
                    aria-label="Toggle dark mode"
                    onClick={toggleTheme}
                  >
                    <span className="theme-orb">
                      {theme ===
                        "dark"
                        ? "☾"
                        : "☀"}
                    </span>

                    <span className="theme-label">
                      {theme ===
                        "dark"
                        ? "Dark"
                        : "Light"}
                    </span>
                  </button>
                </div>

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

                    setSettingsOpen(
                      false,
                    );

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

                  {notifs.length >
                    0 && (
                      <span className="dot">
                        {notifs.length}
                      </span>
                    )}
                </button>

                <button
                  type="button"
                  className="avatar"
                  aria-label="Profile"
                  onClick={(e) => {
                    e.stopPropagation();

                    setNotifOpen(
                      false,
                    );

                    setSettingsView(
                      "main",
                    );

                    setSettingsOpen(
                      (value) =>
                        !value,
                    );
                  }}
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
                    <span>
                      {initial}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* NOTIFICATIONS */}

            {notifOpen && (
              <div
                ref={notifRef}
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

                {notifs.length ===
                  0 ? (
                  <p className="muted">
                    No new
                    notifications.
                  </p>
                ) : (
                  notifs.map(
                    (n, i) => (
                      <div
                        key={i}
                        className="notif"
                      >
                        <span>
                          🔔
                        </span>

                        <span>
                          <b>
                            {n.title}
                          </b>

                          <br />

                          <small>
                            {
                              n.body
                            }{" "}
                            ·{" "}
                            {
                              n.time
                            }{" "}
                            ago
                          </small>
                        </span>
                      </div>
                    ),
                  )
                )}
              </div>
            )}

            {/* ==================================================
                DASHBOARD
            ================================================== */}

            {activeSection ===
              "dashboard" && (
                <>
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
                              src={
                                streak.gif
                              }
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
                              {
                                streak.emoji
                              }
                            </span>
                          )}
                      </div>

                      <div>
                        <b className="t">
                          Streak
                        </b>

                        <div className="big">
                          {streakLoading
                            ? "..."
                            : streak.title}
                        </div>

                        <small>
                          {streakLoading
                            ? "Loading streak"
                            : streak.sub}
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
                          {
                            MOCK_STUDY_TIME
                          }
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
                          {
                            courses.filter(
                              (course) =>
                                course.progress <
                                100,
                            ).length
                          }{" "}
                          active
                          courses
                        </div>

                        <small>
                          Add your first
                          course
                        </small>
                      </div>
                    </div>
                  </section>

                  <div className="grid">
                    <div className="col">
                      <section
                        className="hero reveal d2"
                        aria-label="Continue learning"
                      >
                        <div className="hero-head">
                          <span>
                            📖
                          </span>

                          Continue
                          Learning
                        </div>

                        <div className="hero-body">
                          <div className="empty-course">
                            <div className="empty-course-icon">
                              📚
                            </div>

                            <div className="hero-info">
                              <h3>
                                Add New
                                Course
                              </h3>

                              <p className="empty-course-text">
                                add new
                                course to
                                continue
                                learning
                              </p>

                              <div className="bar">
                                <i
                                  style={{
                                    width:
                                      "0%",
                                  }}
                                />
                              </div>

                              <div className="hero-meta">
                                <span className="empty-course-text">
                                  No course
                                  added yet
                                </span>

                                <span className="pct">
                                  0%
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn-cream"
                              onClick={() => {
                                setActiveSection(
                                  "courses",
                                );

                                localStorage.setItem(
                                  "learnmate-active-section",
                                  "courses",
                                );

                                openAddCourse();
                              }}
                            >
                              Add Course{" "}
                              <span>
                                →
                              </span>
                            </button>
                          </div>
                        </div>
                      </section>

                      <section
                        className="perf3 reveal d4"
                        aria-label="Performance"
                      >
                        <div className="card pad">
                          <h3>
                            📊 Your
                            Performance
                          </h3>

                          <div className="empty-section">
                            add new
                            course
                          </div>
                        </div>

                        <div className="card pad">
                          <h3>
                            ⭐ Strong
                            Topics
                          </h3>

                          <div className="empty-section">
                            add new
                            course
                          </div>
                        </div>

                        <div className="card pad needs-attention-card">
                          <h3 className="warn-title">
                            ⚠️ Needs
                            Attention
                          </h3>

                          <div className="empty-section">
                            add new
                            course
                          </div>
                        </div>
                      </section>

                      <section
                        className="card pad reveal d5"
                        aria-label="Upcoming tests"
                      >
                        <div className="sec-head">
                          <h3>
                            🗓️ Upcoming
                            Tests
                          </h3>

                          <a
                            className="link"
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();

                              showToast(
                                "This Feature will be added in MARK3 Update",
                                "error",
                              );
                            }}
                          >
                            View all →
                          </a>
                        </div>

                        <div className="empty-section">
                          add new course
                        </div>
                      </section>

                      <section
                        className="card journey reveal d5"
                        aria-label="Learning journey"
                      >
                        <b>
                          📖 LEARNING
                          JOURNEY
                        </b>

                        <span className="empty-section">
                          add new course
                        </span>
                      </section>
                    </div>
                  </div>
                </>
              )}

            {/* ==================================================
                MY COURSES
            ================================================== */}

            {activeSection ===
              "courses" && (
                <section
                  className="courses-page"
                  aria-label="My Courses"
                >
                  {!addOpen &&
                    !addClosing && (
                      <div
                        className={
                          coursesContentReady
                            ? "courses-content courses-content-visible"
                            : "courses-content"
                        }
                      >
                    <div className="courses-heading-row">
                      <button
                        type="button"
                        className="btn-brown add-course-top"
                        onClick={() => {
                          openAddCourse();
                        }}
                      >
                        + Add Course
                      </button>
                    </div>

                    <div className="course-tabs">
                      <button
                        type="button"
                        className={`course-tab ${courseTab === "ongoing" ? "active" : ""
                          }`}
                        onClick={() =>
                          setCourseTab("ongoing")
                        }
                      >
                        Ongoing
                        <span>
                          {ongoingCourses.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`course-tab ${courseTab === "completed" ? "active" : ""
                          }`}
                        onClick={() =>
                          setCourseTab("completed")
                        }
                      >
                        Completed
                        <span>
                          {completedCourses.length}
                        </span>
                      </button>
                    </div>
                        <section className="courses-section">
                          <div className="courses-section-head">
                            <h2>
                              Ongoing
                            </h2>

                            <span>
                              0–99%
                            </span>
                          </div>

                          {ongoingCourses.length ===
                            0 ? (
                            <div className="courses-empty">
                              <span>
                                Add new courses
                              </span>
                            </div>
                          ) : (
                            <div className="courses-list">
                              {ongoingCourses.map(
                                (
                                  course,
                                ) => (
                                  <article
                                    key={
                                      course.id
                                    }
                                    className="course-card"
                                  >
                                    <div className="course-card-top">
                                      <div className="course-subject-icon">
                                        {course.subject ===
                                          "Mathematics"
                                          ? "∑"
                                          : course.subject ===
                                            "Science"
                                            ? "⚗"
                                            : course.subject ===
                                              "Information Technology"
                                              ? "⌘"
                                              : course.subject ===
                                                "Social Science"
                                                ? "🌍"
                                                : "A"}
                                      </div>

                                      <div className="course-card-title">
                                        <h3>
                                          {
                                            course.subject
                                          }
                                        </h3>

                                        <p>
                                          {
                                            course.class
                                          }
                                        </p>
                                      </div>

                                      <span className="course-status">
                                        Ongoing
                                      </span>
                                    </div>

                                    <div className="course-progress">
                                      <div className="course-progress-row">
                                        <span>
                                          Progress
                                        </span>

                                        <b>
                                          {
                                            course.progress
                                          }
                                          %
                                        </b>
                                      </div>

                                      <div className="course-progress-track">
                                        <i
                                          style={{
                                            width: `${course.progress}%`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="course-card-bottom">
                                      <span>
                                        {
                                          course.class
                                        }
                                      </span>

                                      <button
                                        type="button"
                                        className="course-open-btn"
                                        onClick={() =>
                                          showToast(
                                            "This Feature will be added in MARK3 Update",
                                            "error",
                                          )
                                        }
                                      >
                                        Open →
                                      </button>
                                    </div>
                                  </article>
                                ),
                              )}
                            </div>
                          )}
                        </section>

                        <section className="courses-section">
                          <div className="courses-section-head">
                            <h2>
                              Completed
                            </h2>

                            <span>
                              100%
                            </span>
                          </div>

                          {completedCourses.length ===
                            0 ? (
                            <div className="courses-empty">
                              <span>
                                Add new courses
                              </span>
                            </div>
                          ) : (
                            <div className="courses-list">
                              {completedCourses.map(
                                (
                                  course,
                                ) => (
                                  <article
                                    key={
                                      course.id
                                    }
                                    className="course-card"
                                  >
                                    <div className="course-card-top">
                                      <div className="course-subject-icon">
                                        ✓
                                      </div>

                                      <div className="course-card-title">
                                        <h3>
                                          {
                                            course.subject
                                          }
                                        </h3>

                                        <p>
                                          {
                                            course.class
                                          }
                                        </p>
                                      </div>

                                      <span className="course-status">
                                        Completed
                                      </span>
                                    </div>

                                    <div className="course-progress">
                                      <div className="course-progress-row">
                                        <span>
                                          Progress
                                        </span>

                                        <b>
                                          100%
                                        </b>
                                      </div>

                                      <div className="course-progress-track">
                                        <i
                                          style={{
                                            width:
                                              "100%",
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="course-card-bottom">
                                      <span>
                                        {
                                          course.class
                                        }
                                      </span>

                                      <button
                                        type="button"
                                        className="course-open-btn"
                                        onClick={() =>
                                          showToast(
                                            "This Feature will be added in MARK3 Update",
                                            "error",
                                          )
                                        }
                                      >
                                        Open →
                                      </button>
                                    </div>
                                  </article>
                                ),
                              )}
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                  {addOpen && (
                    <div
                      className={
                        addClosing
                          ? "add-course-page add-course-closing"
                          : "add-course-page"
                      }
                    >
                      <div className="add-course-heading">
                        <h1 className="h1">
                          {typedAddHeading}

                          <span className="type-cursor">
                            |
                          </span>
                        </h1>
                      </div>

                      <div
                        className={
                          addControlsReady
                            ? "add-course-controls add-course-controls-visible"
                            : "add-course-controls"
                        }
                      >
                        <section className="course-selector-section">
                          <div className="course-selector-title">
                            <h3>
                              Select your
                              class
                            </h3>

                            <span>
                              {selectedClass ||
                                "Choose one"}
                            </span>
                          </div>

                          <div className="class-grid">
                            {CLASSES.map(
                              (item) => (
                                <button
                                  key={item}
                                  type="button"
                                  className={
                                    selectedClass ===
                                      item
                                      ? "class-option selected"
                                      : "class-option"
                                  }
                                  onClick={() =>
                                    setSelectedClass(
                                      item,
                                    )
                                  }
                                >
                                  {item}

                                  {selectedClass ===
                                    item && (
                                      <span>
                                        ✓
                                      </span>
                                    )}
                                </button>
                              ),
                            )}
                          </div>
                        </section>

                        <section className="course-selector-section">
                          <div className="course-selector-title">
                            <h3>
                              Select your
                              subject
                            </h3>

                            <span>
                              {selectedSubject ||
                                "Choose one"}
                            </span>
                          </div>

                          <div className="subject-grid">
                            {SUBJECTS.map(
                              (subject) => (
                                <button
                                  key={
                                    subject
                                  }
                                  type="button"
                                  className={
                                    selectedSubject ===
                                      subject
                                      ? "subject-option selected"
                                      : "subject-option"
                                  }
                                  onClick={() =>
                                    setSelectedSubject(
                                      subject,
                                    )
                                  }
                                >
                                  <span>
                                    {subject ===
                                      "Mathematics"
                                      ? "∑"
                                      : subject ===
                                        "Science"
                                        ? "⚗"
                                        : subject ===
                                          "Information Technology"
                                          ? "⌘"
                                          : subject ===
                                            "Social Science"
                                            ? "🌍"
                                            : "A"}
                                  </span>

                                  <b>
                                    {
                                      subject
                                    }
                                  </b>

                                  {selectedSubject ===
                                    subject && (
                                      <i>
                                        ✓
                                      </i>
                                    )}
                                </button>
                              ),
                            )}
                          </div>
                        </section>

                        <div className="add-course-actions">
                          <button
                            type="button"
                            className="add-course-cancel"
                            onClick={
                              cancelAddCourse
                            }
                            disabled={
                              addClosing
                            }
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="add-course-save"
                            onClick={
                              addCourse
                            }
                            disabled={
                              addClosing
                            }
                          >
                            Add Course
                            <span>
                              →
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}
          </main>
        </div>

        {/* SETTINGS */}

        {settingsOpen && (
          <div
            className="modal-back open"
            onClick={(e) => {
              if (
                e.target ===
                e.currentTarget
              ) {
                setSettingsOpen(false);
                setSettingsView(
                  "main",
                );
              }
            }}
          >
            <div
              ref={settingsRef}
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
            >
              {settingsView ===
                "main" && (
                  <>
                    <header>
                      <div className="set-title">
                        <b>
                          Settings
                        </b>

                        <br />

                        <small className="muted-text">
                          {
                            user.email
                          }
                        </small>
                      </div>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setSettingsOpen(
                            false,
                          );

                          setSettingsView(
                            "main",
                          );
                        }}
                        aria-label="Close settings"
                      >
                        ✕
                      </button>
                    </header>

                    <div className="body">
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

                      <div className="settings-value-section">
                        <label>
                          LearnMate name
                        </label>

                        <div className="settings-value">
                          {user.name ||
                            "Student"}
                        </div>

                        <button
                          type="button"
                          className="change-setting-btn"
                          onClick={() => {
                            setNameDraft(
                              user.name,
                            );

                            setSettingsError(
                              "",
                            );

                            setSettingsView(
                              "name",
                            );
                          }}
                        >
                          Change your
                          name?
                        </button>
                      </div>

                      <div className="settings-value-section">
                        <label>
                          Email
                        </label>

                        <div className="settings-value email-value">
                          {
                            user.email
                          }
                        </div>

                        <button
                          type="button"
                          className="change-setting-btn"
                          onClick={() => {
                            setEmailDraft(
                              user.email,
                            );

                            setSettingsError(
                              "",
                            );

                            setSettingsView(
                              "email",
                            );
                          }}
                        >
                          Change your
                          mail?
                        </button>
                      </div>

                      <div className="field">
                        <label>
                          Profile photo
                        </label>

                        <input
                          ref={
                            photoInputRef
                          }
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

                          <span>
                            ↑
                          </span>
                        </button>

                        <small className="photo-help">
                          JPG or PNG ·
                          Maximum 8 MB
                        </small>

                        {photoError && (
                          <p className="photo-error">
                            {
                              photoError
                            }
                          </p>
                        )}
                      </div>

                      <div className="switch mobile-theme-setting">
                        <span>
                          Dark mode{" "}
                          <small className="muted-text">
                            Theme preference
                          </small>
                        </span>

                        <button
                          type="button"
                          className="theme-switch settings-theme-switch"
                          role="switch"
                          aria-checked={
                            theme ===
                            "dark"
                          }
                          aria-label="Toggle dark mode"
                          onClick={
                            toggleTheme
                          }
                        >
                          <span className="theme-orb">
                            {theme ===
                              "dark"
                              ? "☾"
                              : "☀"}
                          </span>

                          <span className="theme-label">
                            {theme ===
                              "dark"
                              ? "Dark"
                              : "Light"}
                          </span>
                        </button>
                      </div>

                      <section className="danger-zone">
                        <div className="danger-title">
                          DANGER ZONE
                        </div>

                        <div className="danger-content">
                          <div>
                            <b>
                              Delete your
                              account?
                            </b>

                            <p>
                              Permanently
                              delete your
                              LearnMate
                              account and
                              its account
                              data.
                            </p>
                          </div>

                          <button
                            type="button"
                            className="delete-account-btn"
                            onClick={
                              requestDeleteAccount
                            }
                          >
                            Delete
                            account
                          </button>
                        </div>
                      </section>

                      <div className="row2">
                        <button
                          type="button"
                          className="btn-cream bordered"
                          onClick={
                            saveSettings
                          }
                          disabled={
                            settingsSaving
                          }
                        >
                          {settingsSaving
                            ? "Saving..."
                            : "Save"}
                        </button>

                        <button
                          type="button"
                          className="btn-brown centered"
                          onClick={
                            requestLogout
                          }
                        >
                          Log out
                        </button>
                      </div>
                    </div>
                  </>
                )}

              {settingsView ===
                "name" && (
                  <div className="settings-change-view">
                    <header>
                      <button
                        type="button"
                        className="settings-back"
                        onClick={() =>
                          setSettingsView(
                            "main",
                          )
                        }
                      >
                        ← Back
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setSettingsOpen(
                            false,
                          );

                          setSettingsView(
                            "main",
                          );
                        }}
                        aria-label="Close settings"
                      >
                        ✕
                      </button>
                    </header>

                    <div className="settings-change-content">
                      <h2>
                        <TypewriterHeading text="Set your new LearnMate name" />
                      </h2>

                      <p>
                        Choose the name you want LearnMate to use when welcoming you.
                      </p>

                      <input
                        autoFocus
                        value={
                          nameDraft
                        }
                        onChange={(e) => {
                          setNameDraft(
                            e.target.value,
                          );

                          setSettingsError(
                            "",
                          );
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key ===
                            "Enter" &&
                            !settingsSaving
                          ) {
                            changeLearnMateName();
                          }
                        }}
                        placeholder="Enter your new name"
                        maxLength={40}
                      />

                      <button
                        type="button"
                        className="btn-brown name-save"
                        onClick={
                          changeLearnMateName
                        }
                        disabled={
                          settingsSaving
                        }
                      >
                        {settingsSaving
                          ? "Saving..."
                          : "Save name"}

                        {!settingsSaving && (
                          <span>
                            →
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              {settingsView ===
                "email" && (
                  <div className="settings-change-view">
                    <header>
                      <button
                        type="button"
                        className="settings-back"
                        onClick={() =>
                          setSettingsView(
                            "main",
                          )
                        }
                      >
                        ← Back
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          setSettingsOpen(
                            false,
                          );

                          setSettingsView(
                            "main",
                          );
                        }}
                        aria-label="Close settings"
                      >
                        ✕
                      </button>
                    </header>

                    <div className="settings-change-content">
                      <h2>
                        <TypewriterHeading text="Enter your new email" />
                      </h2>

                      <p>
                        Enter the email address you want to use with your LearnMate account.
                      </p>

                      <input
                        autoFocus
                        type="email"
                        value={
                          emailDraft
                        }
                        onChange={(e) => {
                          setEmailDraft(
                            e.target.value,
                          );

                          setSettingsError(
                            "",
                          );
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key ===
                            "Enter" &&
                            !settingsSaving
                          ) {
                            changeEmail();
                          }
                        }}
                        placeholder="Enter your new email"
                        maxLength={120}
                      />

                      <p className="email-change-note">
                        You may need to confirm the new email from your inbox.
                      </p>

                      <button
                        type="button"
                        className="btn-brown name-save"
                        onClick={
                          changeEmail
                        }
                        disabled={
                          settingsSaving
                        }
                      >
                        {settingsSaving
                          ? "Updating..."
                          : "Change email"}

                        {!settingsSaving && (
                          <span>
                            →
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* PHOTO CROP */}

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
                      Adjust profile
                      photo
                    </b>

                    <small>
                      Crop and resize
                      before saving
                    </small>
                  </div>

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={
                      cancelCrop
                    }
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
                      value={
                        cropZoom
                      }
                      onChange={(e) =>
                        setCropZoom(
                          Number(
                            e.target
                              .value,
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
                            e.target
                              .value,
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
                            e.target
                              .value,
                          ),
                        )
                      }
                    />
                  </label>
                </div>

                <img
                  ref={
                    photoImageRef
                  }
                  src={
                    selectedPhotoSource
                  }
                  alt=""
                  className="crop-hidden-image"
                />

                <div className="crop-actions">
                  <button
                    type="button"
                    className="crop-cancel"
                    onClick={
                      cancelCrop
                    }
                    disabled={
                      photoSaving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="crop-save"
                    onClick={
                      finalizePhoto
                    }
                    disabled={
                      photoSaving
                    }
                  >
                    {photoSaving
                      ? "Saving..."
                      : "Use this photo"}
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* FIRST LOGIN */}

        {needsNameSetup && (
          <div className="name-setup-back">
            <div
              className="name-setup reveal"
              role="dialog"
              aria-modal="true"
              aria-label="Set your LearnMate name"
            >
              <h2>
                <TypewriterHeading text="Set your LearnMate name" />
              </h2>

              <p>
                Choose the name you want LearnMate to use when welcoming you.
              </p>

              <input
                autoFocus
                value={
                  nameDraft
                }
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
                    e.key ===
                    "Enter" &&
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
                disabled={
                  nameSaving
                }
              >
                {nameSaving
                  ? "Saving..."
                  : "Continue"}

                {!nameSaving && (
                  <span>
                    →
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMATION */}

        {confirmAction && (
          <div
            className="confirm-back"
            onClick={(e) => {
              if (
                e.target ===
                e.currentTarget &&
                !accountActionLoading
              ) {
                setConfirmAction(
                  null,
                );
              }
            }}
          >
            <div
              className={
                confirmAction ===
                  "delete"
                  ? "confirm-modal danger-confirm"
                  : "confirm-modal"
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="confirm-icon">
                {confirmAction ===
                  "delete"
                  ? "!"
                  : "?"}
              </div>

              <h2 id="confirm-title">
                {confirmAction ===
                  "delete"
                  ? "Delete your account?"
                  : "Log out of LearnMate?"}
              </h2>

              <p>
                {confirmAction ===
                  "delete"
                  ? "This will permanently delete your LearnMate account. You will not be able to sign in to this deleted account again."
                  : "Are you sure you want to log out of your LearnMate account?"}
              </p>

              {confirmAction ===
                "delete" && (
                  <p className="confirm-warning">
                    This action
                    cannot be
                    undone.
                  </p>
                )}

              <div className="confirm-actions">
                <button
                  type="button"
                  className="confirm-cancel"
                  onClick={() =>
                    setConfirmAction(
                      null,
                    )
                  }
                  disabled={
                    accountActionLoading
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    confirmAction ===
                      "delete"
                      ? "confirm-danger"
                      : "confirm-primary"
                  }
                  onClick={
                    confirmAction ===
                      "delete"
                      ? handleDeleteAccount
                      : handleLogout
                  }
                  disabled={
                    accountActionLoading
                  }
                >
                  {accountActionLoading
                    ? confirmAction ===
                      "delete"
                      ? "Deleting..."
                      : "Logging out..."
                    : confirmAction ===
                      "delete"
                      ? "Delete account"
                      : "Log out"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}

        {toast && (
          <div
            className={`lm-toast ${toast.type ===
                "success"
                ? "success"
                : "error"
              }`}
            role="alert"
          >
            <span className="toast-icon">
              {toast.type ===
                "success"
                ? "✓"
                : "!"}
            </span>

            <span>
              {toast.message}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

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

    const timer =
      window.setInterval(() => {
        index += 1;

        setDisplayed(
          text.slice(
            0,
            index,
          ),
        );

        if (
          index >=
          text.length
        ) {
          window.clearInterval(
            timer,
          );
        }
      }, 55);

    return () =>
      window.clearInterval(
        timer,
      );
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
  --shadow:
    0 1px 2px rgba(122,47,0,.06),
    0 8px 24px rgba(122,47,0,.06)
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
  --shadow:
    0 1px 2px rgba(0,0,0,.4)
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
  z-index:50;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch
}

.lm .brand{
  display:flex;
  align-items:center;
  gap:10px;
  padding:4px 8px 16px;
  flex-shrink:0
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
  margin-top:4px;
  flex-shrink:0
}

.lm .nav-link{
  display:flex;
  align-items:center;
  gap:12px;
  color:var(--sidebar-text);
  padding:11px 12px;
  border-radius:12px;
  font-size:14px;
  font-weight:500;
  width:100%;
  text-align:left;
  min-height:36px
}

.lm .nav-link:hover{
  background:rgba(233,198,137,.14)
}

.lm .nav-link.active{
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
  gap:8px;
  flex-shrink:0
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

.lm .main{
  flex:1;
  margin-left:236px;
  min-width:0;
  padding:28px;
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
  50%{opacity:0}
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
  font-size:18px;
  padding:0
}

.lm .avatar img{
  width:100%;
  height:100%;
  object-fit:cover
}

.lm .desktop-theme-toggle{
  display:flex;
  align-items:center
}

.lm .theme-switch{
  width:72px;
  height:34px;
  min-height:34px;
  border-radius:999px;
  background:var(--track);
  border:1px solid var(--border);
  display:flex;
  align-items:center;
  gap:5px;
  padding:3px 5px 3px 4px;
  position:relative;
  overflow:hidden;
  box-shadow:
    inset 0 1px 2px rgba(0,0,0,.08),
    0 2px 8px rgba(122,47,0,.06)
}

.lm .theme-switch:hover{
  border-color:var(--cream);
  box-shadow:
    inset 0 1px 2px rgba(0,0,0,.08),
    0 0 14px rgba(233,198,137,.18)
}

.lm .theme-orb{
  width:26px;
  height:26px;
  border-radius:50%;
  background:#fff;
  color:#4A1E00;
  display:grid;
  place-items:center;
  font-size:13px;
  flex-shrink:0;
  box-shadow:0 2px 7px rgba(0,0,0,.18)
}

.lm .theme-switch[aria-checked="true"]{
  background:#2B1A0D;
  border-color:#4A3019;
  justify-content:flex-end;
  padding-left:5px;
  padding-right:4px
}

.lm .theme-switch[aria-checked="true"] .theme-orb{
  background:#34323d;
  color:#F6E8D0
}

.lm .theme-label{
  font-size:9px;
  font-weight:800;
  color:var(--text-2);
  line-height:1;
  user-select:none
}

.lm .theme-switch[aria-checked="true"] .theme-label{
  color:#F6E8D0
}

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
  height:100%
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

.lm .grid{
  display:grid;
  grid-template-columns:1fr;
  gap:14px;
  align-items:start
}

.lm .col{
  display:flex;
  flex-direction:column;
  gap:14px;
  min-width:0
}

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
  border-radius:999px
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

.lm .sec-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0
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

.lm .journey{
  display:flex;
  align-items:center;
  gap:12px;
  flex-wrap:wrap;
  padding:14px 16px;
  font-size:12px;
  color:var(--text-2)
}

/* ============================================================
   MARK 2 — COURSES
============================================================ */

.lm .courses-page{
  width:100%;
  min-width:0;
  padding-top:0
}

.lm .courses-heading-wrap{
  min-width:0
}

.lm .courses-content{
  opacity:0;
  transform:translateY(8px);
  pointer-events:none
}

.lm .courses-content-visible{
  animation:coursesContentIn .6s ease forwards;
  pointer-events:auto
}

@keyframes coursesContentIn{
  from{
    opacity:0;
    transform:translateY(10px)
  }
  to{
    opacity:1;
    transform:none
  }
}

.lm .courses-section{
  margin-top:22px
}

.lm .courses-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:4px
}

.lm .courses-section-head h2{
  font-size:18px;
  font-weight:800;
  letter-spacing:-.02em
}

.lm .courses-section-head span{
  color:var(--muted);
  font-size:12px;
  font-weight:700
}
.lm .courses-heading-row{
  display:flex;
  justify-content:flex-end;
  align-items:center;
  width:100%
}
.lm .add-course-top{
  min-height:42px;
  padding:10px 16px;
  border-radius:12px;
  white-space:nowrap;
  flex-shrink:0
}

.lm .add-course-top:hover{
  background:#8A3A05
}

.lm .course-tabs{
  display:flex;
  align-items:center;
  gap:5px;
  margin-top:20px;
  padding:4px;
  width:max-content;
  max-width:100%;
  background:var(--card-2);
  border:1px solid var(--border);
  border-radius:13px
}

.lm .course-tab{
  min-height:38px;
  padding:8px 14px;
  border-radius:9px;
  display:flex;
  align-items:center;
  gap:7px;
  font-size:13px;
  font-weight:700;
  color:var(--muted)
}

.lm .course-tab span{
  min-width:20px;
  height:20px;
  padding:0 6px;
  border-radius:999px;
  background:var(--track);
  display:grid;
  place-items:center;
  font-size:10px
}

.lm .course-tab.active{
  background:var(--brown);
  color:#FFF6E3
}

.lm .course-tab.active span{
  background:rgba(255,255,255,.15);
  color:#fff
}

.lm .courses-empty{
  min-height:110px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--muted);
  font-size:14px;
  text-align:center
}

.lm .courses-list{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:14px;
  margin-top:14px
}

.lm .course-card{
  padding:18px;
  min-width:0;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow)
}

.lm .course-card-top{
  display:flex;
  align-items:flex-start;
  gap:12px;
  min-width:0
}

.lm .course-subject-icon{
  width:48px;
  height:48px;
  border-radius:14px;
  background:var(--icon-bg);
  display:grid;
  place-items:center;
  flex-shrink:0;
  font-size:21px
}

.lm .course-card-title{
  flex:1;
  min-width:0
}

.lm .course-card-title h3{
  font-size:16px;
  line-height:1.3;
  overflow-wrap:anywhere
}

.lm .course-card-title p{
  color:var(--muted);
  font-size:12px;
  margin-top:4px
}

.lm .course-status{
  flex-shrink:0;
  padding:6px 9px;
  border-radius:999px;
  background:var(--cream-soft);
  color:var(--brown);
  font-size:10px;
  font-weight:800
}

[data-theme="dark"] .lm .course-status{
  background:#35220F;
  color:var(--cream)
}

.lm .course-progress{
  margin-top:20px
}

.lm .course-progress-row{
  display:flex;
  justify-content:space-between;
  gap:10px;
  font-size:11px;
  color:var(--muted)
}

.lm .course-progress-row b{
  color:var(--text);
  font-size:12px
}

.lm .course-progress-track{
  height:8px;
  background:var(--track);
  border-radius:999px;
  overflow:hidden;
  margin-top:7px
}

.lm .course-progress-track i{
  display:block;
  height:100%;
  background:var(--brown);
  border-radius:inherit;
  transition:width .8s ease
}

.lm .course-card-bottom{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-top:17px;
  padding-top:13px;
  border-top:1px solid var(--border-soft);
  color:var(--muted);
  font-size:11px
}

.lm .course-open-btn{
  color:var(--brown);
  font-size:12px;
  font-weight:800;
  min-height:30px
}

.lm .course-open-btn:hover{
  text-decoration:underline
}

/* ADD COURSE */

.lm .add-course-page{
  animation:addCourseIn .45s cubic-bezier(.22,1,.36,1) forwards
}

.lm .add-course-closing{
  animation:addCourseOut .32s ease forwards
}

@keyframes addCourseIn{
  from{
    opacity:0;
    transform:translateY(8px)
  }
  to{
    opacity:1;
    transform:none
  }
}

@keyframes addCourseOut{
  from{
    opacity:1;
    transform:none
  }
  to{
    opacity:0;
    transform:translateY(8px)
  }
}

.lm .add-course-heading{
  min-height:44px
}

.lm .add-course-controls{
  opacity:0;
  transform:translateY(10px);
  pointer-events:none;
  margin-top:22px
}

.lm .add-course-controls-visible{
  animation:addControlsIn .55s cubic-bezier(.22,1,.36,1) forwards;
  pointer-events:auto
}

@keyframes addControlsIn{
  from{
    opacity:0;
    transform:translateY(12px)
  }
  to{
    opacity:1;
    transform:none
  }
}

.lm .course-selector-section{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:18px;
  margin-bottom:14px
}

.lm .course-selector-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px
}

.lm .course-selector-title h3{
  font-size:15px
}

.lm .course-selector-title span{
  color:var(--muted);
  font-size:12px;
  font-weight:700;
  text-align:right
}

.lm .class-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:9px
}

.lm .class-option{
  min-height:48px;
  padding:9px 10px;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--card-2);
  font-size:12px;
  font-weight:700;
  color:var(--text-2);
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px
}

.lm .class-option:hover{
  border-color:var(--cream);
  background:var(--cream-soft)
}

.lm .class-option.selected{
  border-color:var(--brown);
  background:var(--brown);
  color:#FFF6E3;
  box-shadow:0 5px 16px rgba(122,47,0,.15)
}

.lm .subject-grid{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:10px
}

.lm .subject-option{
  min-height:94px;
  padding:12px 9px;
  border:1px solid var(--border);
  border-radius:13px;
  background:var(--card-2);
  color:var(--text-2);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  position:relative
}

.lm .subject-option > span{
  width:34px;
  height:34px;
  border-radius:10px;
  background:var(--icon-bg);
  display:grid;
  place-items:center;
  color:var(--brown);
  font-size:16px;
  font-weight:800
}

.lm .subject-option b{
  font-size:11px;
  line-height:1.3;
  text-align:center
}

.lm .subject-option i{
  position:absolute;
  top:7px;
  right:8px;
  width:18px;
  height:18px;
  border-radius:50%;
  background:var(--brown);
  color:#fff;
  display:grid;
  place-items:center;
  font-style:normal;
  font-size:10px
}

.lm .subject-option:hover{
  border-color:var(--cream)
}

.lm .subject-option.selected{
  border-color:var(--brown);
  box-shadow:0 0 0 2px rgba(122,47,0,.08)
}

.lm .subject-option.selected > span{
  background:var(--brown);
  color:#FFF6E3
}

.lm .add-course-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  margin-top:6px
}

.lm .add-course-cancel{
  min-height:44px;
  padding:10px 17px;
  border:1px solid var(--border);
  border-radius:13px;
  background:var(--card);
  color:var(--text-2);
  font-size:13px;
  font-weight:800
}

.lm .add-course-cancel:hover{
  background:var(--card-2);
  border-color:var(--cream)
}

.lm .add-course-save{
  min-height:44px;
  padding:10px 17px;
  border-radius:13px;
  background:var(--brown);
  color:#FFF6E3;
  font-size:13px;
  font-weight:800
}

.lm .add-course-save:hover{
  background:#8A3A05
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

.lm .settings-value-section{
  padding:2px 0;
  display:flex;
  flex-direction:column;
  align-items:flex-start
}

.lm .settings-value-section label{
  font-size:13px;
  font-weight:600;
  display:block;
  margin-bottom:6px
}

.lm .settings-value{
  width:100%;
  min-height:44px;
  padding:12px;
  border-radius:12px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  display:flex;
  align-items:center;
  font-size:14px;
  overflow-wrap:anywhere
}

.lm .email-value{
  color:var(--text-2)
}

.lm .change-setting-btn{
  margin-top:7px;
  padding:3px 0;
  min-height:28px;
  color:var(--brown);
  font-size:12px;
  font-weight:700;
  text-decoration:underline;
  text-decoration-color:rgba(122,47,0,.25);
  text-underline-offset:3px
}

.lm .change-setting-btn:hover{
  color:#9A3B00
}

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

.lm .photo-file-input{
  display:none
}

.lm .upload-photo-btn{
  width:100%;
  min-height:48px;
  padding:12px 14px;
  border-radius:13px;
  border:1px solid rgba(233,198,137,.5);
  background:var(--card-2);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  font-weight:700;
  color:var(--text);
  position:relative;
  overflow:hidden;
  box-shadow:
    0 0 0 1px rgba(233,198,137,.08),
    0 0 18px rgba(233,198,137,.08)
}

.lm .upload-photo-btn::before{
  content:"";
  position:absolute;
  top:-60%;
  left:-25%;
  width:35%;
  height:220%;
  background:linear-gradient(
    90deg,
    transparent,
    rgba(255,255,255,.18),
    transparent
  );
  transform:rotate(18deg);
  opacity:0;
  transition:left .55s ease,opacity .35s ease;
  pointer-events:none
}

.lm .upload-photo-btn:hover{
  border-color:var(--cream);
  box-shadow:
    0 0 0 1px rgba(233,198,137,.15),
    0 0 24px rgba(233,198,137,.18)
}

.lm .upload-photo-btn:hover::before{
  left:110%;
  opacity:1
}

.lm .photo-help{
  display:block;
  color:var(--muted);
  font-size:11px;
  margin-top:6px
}

.lm .photo-error,
.lm .settings-error{
  color:#B42318;
  font-size:12px;
  margin-top:7px
}

.lm .mobile-theme-setting{
  display:flex
}

.lm .settings-theme-switch{
  width:74px;
  flex-shrink:0
}

.lm .danger-zone{
  border:1px solid rgba(217,45,32,.28);
  border-radius:15px;
  padding:14px;
  background:rgba(217,45,32,.035)
}

.lm .danger-title{
  color:#B42318;
  font-size:11px;
  font-weight:900;
  letter-spacing:.09em;
  margin-bottom:11px
}

.lm .danger-content{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px
}

.lm .danger-content > div{
  min-width:0;
  flex:1
}

.lm .danger-content b{
  display:block;
  color:#B42318;
  font-size:14px;
  margin-bottom:4px
}

.lm .danger-content p{
  color:var(--muted);
  font-size:11.5px;
  line-height:1.5
}

.lm .delete-account-btn{
  min-height:40px!important;
  padding:9px 12px!important;
  border-radius:11px!important;
  border:1px solid rgba(180,35,24,.3)!important;
  background:rgba(217,45,32,.07)!important;
  color:#B42318!important;
  font-size:12px!important;
  font-weight:800!important;
  white-space:nowrap
}

.lm .settings-change-view{
  min-height:420px;
  animation:settingsViewFade .35s ease forwards
}

@keyframes settingsViewFade{
  from{
    opacity:0;
    transform:translateY(8px)
  }
  to{
    opacity:1;
    transform:none
  }
}

.lm .settings-change-view > header{
  min-height:70px
}

.lm .settings-back{
  font-size:13px;
  font-weight:700;
  color:var(--text-2);
  min-height:38px;
  padding:6px 4px;
  border-radius:9px
}

.lm .settings-back:hover{
  color:var(--brown);
  background:var(--cream-soft)
}

.lm .settings-change-content{
  padding:42px 30px 34px;
  text-align:center;
  animation:settingsContentFade .55s ease .08s both
}

@keyframes settingsContentFade{
  from{
    opacity:0;
    transform:translateY(10px)
  }
  to{
    opacity:1;
    transform:none
  }
}

.lm .settings-change-content h2{
  font-size:25px;
  line-height:1.25;
  letter-spacing:-.025em;
  margin-bottom:11px;
  min-height:32px
}

.lm .settings-change-content > p{
  color:var(--muted);
  font-size:14px;
  line-height:1.6;
  max-width:400px;
  margin:0 auto 22px
}

.lm .settings-change-content input{
  width:100%;
  min-height:50px;
  padding:13px 15px;
  border-radius:13px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  outline:none;
  text-align:left
}

.lm .settings-change-content input:focus{
  border-color:var(--brown);
  box-shadow:0 0 0 3px rgba(122,47,0,.08)
}

.lm .settings-change-content .name-save{
  width:100%;
  justify-content:center;
  margin-top:12px
}

.lm .email-change-note{
  margin:8px auto 0!important;
  font-size:11px!important;
  line-height:1.5!important;
  color:var(--muted)!important;
  max-width:390px!important
}

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
  box-shadow:0 0 0 1px var(--border)
}

.lm .crop-window{
  position:absolute;
  inset:0;
  background-repeat:no-repeat
}

.lm .crop-circle{
  position:absolute;
  inset:0;
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

.lm .confirm-back{
  position:fixed;
  inset:0;
  z-index:400;
  background:rgba(40,18,0,.52);
  display:grid;
  place-items:center;
  padding:18px;
  overscroll-behavior:contain;
  animation:fadeIn .2s ease
}

.lm .confirm-modal{
  width:min(430px,100%);
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:28px;
  box-shadow:0 20px 60px rgba(40,18,0,.25);
  text-align:center;
  animation:confirmUp .28s cubic-bezier(.22,1,.36,1) forwards
}

@keyframes confirmUp{
  from{
    opacity:0;
    transform:translateY(10px) scale(.98)
  }
  to{
    opacity:1;
    transform:none
  }
}

.lm .confirm-icon{
  width:48px;
  height:48px;
  border-radius:50%;
  display:grid;
  place-items:center;
  margin:0 auto 15px;
  background:var(--cream-soft);
  color:var(--brown);
  font-size:20px;
  font-weight:900
}

.lm .danger-confirm .confirm-icon{
  background:#FEE4E2;
  color:#B42318
}

.lm .confirm-modal h2{
  font-size:22px;
  line-height:1.25;
  margin-bottom:9px
}

.lm .confirm-modal > p{
  color:var(--muted);
  font-size:13px;
  line-height:1.6;
  max-width:360px;
  margin:0 auto
}

.lm .confirm-warning{
  color:#B42318!important;
  font-weight:700;
  margin-top:8px!important
}

.lm .confirm-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin-top:22px
}

.lm .confirm-cancel,
.lm .confirm-primary,
.lm .confirm-danger{
  min-height:46px!important;
  border-radius:13px!important;
  font-size:13px!important;
  font-weight:800!important
}

.lm .confirm-cancel{
  border:1px solid var(--border)!important;
  background:var(--card-2)!important;
  color:var(--text)!important
}

.lm .confirm-primary{
  background:var(--brown)!important;
  color:#FFF6E3!important
}

.lm .confirm-danger{
  background:#B42318!important;
  color:#fff!important
}

.lm-toast{
  position:fixed;
  left:50%;
  bottom:28px;
  transform:translateX(-50%) translateY(18px);
  z-index:500;
  min-width:min(380px,calc(100vw - 32px));
  max-width:calc(100vw - 32px);
  padding:12px 16px;
  border-radius:14px;
  display:flex;
  align-items:center;
  gap:10px;
  background:var(--card);
  color:var(--text);
  border:1px solid var(--border);
  box-shadow:0 14px 40px rgba(40,18,0,.22);
  font-size:13px;
  font-weight:600;
  animation:toastIn .32s cubic-bezier(.22,1,.36,1) forwards
}

@keyframes toastIn{
  from{
    opacity:0;
    transform:translateX(-50%) translateY(18px)
  }
  to{
    opacity:1;
    transform:translateX(-50%) translateY(0)
  }
}

.lm-toast.error{
  border-color:rgba(217,45,32,.25)
}

.lm-toast.success{
  border-color:rgba(122,47,0,.25)
}

.lm-toast .toast-icon{
  width:22px;
  height:22px;
  border-radius:50%;
  display:grid;
  place-items:center;
  flex-shrink:0;
  font-size:12px;
  font-weight:900
}

.lm-toast.error .toast-icon{
  background:#FEE4E2;
  color:#B42318
}

.lm-toast.success .toast-icon{
  background:var(--cream-soft);
  color:var(--brown)
}

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
  from{opacity:0}
  to{opacity:1}
}

.lm .d1{animation-delay:.05s}
.lm .d2{animation-delay:.12s}
.lm .d3{animation-delay:.19s}
.lm .d4{animation-delay:.26s}
.lm .d5{animation-delay:.33s}

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

@media(prefers-reduced-motion:reduce){
  .lm *,
  .lm *:before,
  .lm *:after{
    animation:none!important;
    transition:none!important
  }

  .lm .reveal,
  .lm .courses-content,
  .lm .add-course-controls{
    opacity:1;
    transform:none
  }
}

@media(max-width:1100px){
  .lm .stats{
    grid-template-columns:repeat(2,1fr)
  }

  .lm .perf3{
    grid-template-columns:repeat(3,minmax(0,1fr))
  }

  .lm .courses-list{
    grid-template-columns:1fr 1fr
  }

  .lm .subject-grid{
    grid-template-columns:repeat(3,1fr)
  }
}

@media(max-width:860px){
  .lm .desktop-theme-toggle{
    display:none
  }

  .lm .sidebar{
    transform:translateX(-105%);
    transition:transform .28s ease;
    border-radius:0 20px 20px 0;
    overflow-y:auto;
    overflow-x:hidden;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    touch-action:pan-y
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
    display:none;
    touch-action:none
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

  .lm .perf3{
    grid-template-columns:1fr;
    width:100%
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

  .lm .settings-change-content{
    padding:34px 24px 30px
  }

  .lm .danger-content{
    align-items:flex-start
  }

  .lm .delete-account-btn{
    flex-shrink:0
  }

  .lm .courses-list{
    grid-template-columns:1fr
  }

  .lm .class-grid{
    grid-template-columns:repeat(3,1fr)
  }

  .lm .subject-grid{
    grid-template-columns:repeat(2,1fr)
  }

  .lm .course-card-top{
    flex-wrap:wrap
  }

  .lm .course-status{
    margin-left:auto
  }
}

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

  .lm .settings-change-content{
    padding:30px 18px 26px
  }

  .lm .settings-change-content h2{
    font-size:22px
  }

  .lm .danger-content{
    flex-direction:column
  }

  .lm .delete-account-btn{
    width:100%
  }

  .lm .confirm-modal{
    padding:24px 18px
  }

  .lm .confirm-modal h2{
    font-size:20px
  }

  .lm-toast{
    bottom:18px;
    min-width:calc(100vw - 28px)
  }

  .lm .course-tabs{
    width:100%
  }

  .lm .course-tab{
    flex:1;
    justify-content:center
  }

  .lm .class-grid{
    grid-template-columns:repeat(2,1fr)
  }

  .lm .subject-grid{
    grid-template-columns:1fr
  }

  .lm .subject-option{
    min-height:64px;
    flex-direction:row;
    justify-content:flex-start;
    text-align:left;
    padding:10px 12px
  }

  .lm .subject-option b{
    text-align:left
  }

  .lm .add-course-actions{
    display:grid;
    grid-template-columns:1fr 1fr
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

  .lm .settings-change-content{
    padding:26px 15px 24px
  }

  .lm .confirm-actions{
    grid-template-columns:1fr
  }
}
`;