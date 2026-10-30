"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import Link from "next/link";

import { createClient } from "../../lib/supabase/client";
import { CURRICULUM, type CurriculumChapter } from "../../lib/curriculum";
import TestTaker from "../../components/learnmate/TestTaker";
import type {
  TestAnswer,
  TestQuestion,
  TestResult,
} from "../../components/learnmate/TestTaker";
import QuizTaker from "../../components/learnmate/QuizTaker";
import type { QuizGenerateResult } from "../../components/learnmate/QuizTaker";
import ScheduleTestForm from "../../components/learnmate/ScheduleTestForm";
import type { Schedule as LmSchedule } from "../../components/learnmate/ScheduleTestForm";
import MilestonePath from "../../components/learnmate/MilestonePath";
import TestTypeSelect from "../../components/learnmate/TestTypeSelect";
import { resolveChapterVideo } from "../../lib/learnmate/resolveVideo";
import LessonVideo from "../../components/learnmate/LessonVideo";
import { usePushSubscription } from "../../lib/learnmate/usePushSubscription";

type User = {
  name: string;
  email: string;
  klass: string;
  avatarUrl: string | null;
};

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  link: string | null;
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
  classLevel: number;
  stream: string | null;
  mathVariant: "Pure" | "Applied" | null;
};

type SubjectRow = {
  id: string;
  name: string;
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

const STREAMS = [
  "Science",
  "Commerce",
  "Arts/Humanities",
];

const JUNIOR_SUBJECTS = [
  "English",
  "Mathematics",
  "EVS",
];

const MIDDLE_SUBJECTS = [
  "English",
  "Mathematics",
  "Science",
  "Social Science",
];

const STREAM_SUBJECTS: Record<string, string[]> = {
  Science: [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "Computer Science",
  ],
  Commerce: [
    "Accountancy",
    "Business Studies",
    "Economics",
    "Mathematics",
  ],
  "Arts/Humanities": [
    "History",
    "Political Science",
    "Geography",
    "Sociology",
    "Psychology",
  ],
};


type AnswerStat = { courseTitle: string; chapterTitle: string; correct: number; total: number };
type LmVideoProgress = { percent: number; watched: number; duration: number };
type LmHomeTest = { id: string; title: string; iso: string };


function getCurriculumKey(course: Course): string {
  const subject = course.subject.trim();
  const aliases: Record<string, string> = {
    "Social Studies": "Social Science", "Social Sciences": "Social Science",
    "Maths": "Mathematics", "Computer Science (Science)": "Computer Science",
    "Mathematics (Pure)": "Pure Mathematics", "Mathematics (Applied)": "Applied Mathematics"
  };
  let normalized = aliases[subject] || subject;
  if (course.mathVariant === "Pure") normalized = "Pure Mathematics";
  if (course.mathVariant === "Applied") normalized = "Applied Mathematics";
  return `${course.classLevel}|${normalized}`;
}

function getCourseChapters(course: Course): CurriculumChapter[] {
  const key = getCurriculumKey(course);
  if (CURRICULUM[key]) return CURRICULUM[key];
  // Some school databases store stream-specific subjects as generic Mathematics.
  if (course.classLevel >= 11 && course.subject === "Mathematics") {
    const variant = course.mathVariant || "Pure";
    return CURRICULUM[`${course.classLevel}|${variant} Mathematics`] || [];
  }
  return [];
}

// Merge saved video progress into course progress. A course's
// progress is the mean of its chapters' watched percentages
// (unwatched chapters count as 0). If a course has no tracked
// video at all, its existing (milestone) progress is kept.
function lmMergeVideoProgress(
  courses: Course[],
  video: Record<string, LmVideoProgress>,
): Course[] {
  return courses.map((course) => {
    const chapters = getCourseChapters(course);
    if (!chapters.length) return course;
    const key = getCurriculumKey(course);
    let tracked = false;
    let sum = 0;
    chapters.forEach((chapter) => {
      const p = video[`${key}|${chapter.section ?? ""}|${chapter.title}`];
      if (p) tracked = true;
      sum += p?.percent ?? 0;
    });
    if (!tracked) return course;
    return { ...course, progress: Math.round(sum / chapters.length) };
  });
}

function getWeekStart(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatStudyTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

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
      emoji: "",
      title: "4 days",
      sub: "Charged up!",
      gif: "/bolt.gif",
    };
  }

  return {
    key: "fire",
    emoji: "",
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

// Animates a number from its previous value to the new one
// (ease-out cubic), so a progress figure visibly counts up from 0
// on first load and rolls to the new value whenever it changes.
// Respects prefers-reduced-motion by jumping straight to the value.
function useCountUp(value: number, durationMs = 1400): number {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const reduced = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const from = displayRef.current;

    if (reduced || from === value) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (value - from) * eased;

      displayRef.current = current;
      setDisplay(current);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        displayRef.current = value;
        setDisplay(value);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return display;
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

/* ==========================================================
   MARK 5 — LEARNMATE AI (DOUBT CLEARER)
   Types, backend connection point and message renderer.
========================================================== */

type AiRole = "user" | "assistant";

type AiMessage = {
  id: string;
  role: AiRole;
  content: string;
  failed?: boolean;
};

type AiChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

const AI_HEADING = "Enhance your learning.";
const AI_HISTORY_LIMIT = 60;

/* ----------------------------------------------------------
   BACKEND CONNECTION POINT (the only place that talks to
   the Doubt Clearer API route).

   POST /api/doubt-clearer   (same-origin, cookie session)
   Request : { question: string, chatId: string | null }
   Response: { answer: string, chatId: string }

   Response keys are read tolerantly (answer / reply /
   response / message / text and chatId / chat_id /
   conversationId / conversation_id). If your route uses
   other names or a different request body, change ONLY
   requestAiAnswer below.
---------------------------------------------------------- */
const AI_API_ENDPOINT = "/api/doubt-clearer";

class AiRequestError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message ?? `LearnMate AI request failed (${status})`);
    this.name = "AiRequestError";
    this.status = status;
  }
}

function aiPickString(source: unknown, keys: string[]): string | null {
  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

async function requestAiAnswer(
  question: string,
  chatId: string | null,
): Promise<{ answer: string; chatId: string | null }> {
  const response = await fetch(AI_API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, chatId }),
  });

  if (!response.ok) throw new AiRequestError(response.status);

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    throw new AiRequestError(502, "LearnMate AI returned an unreadable response");
  }

  const answer = aiPickString(data, [
    "answer",
    "reply",
    "response",
    "message",
    "text",
  ]);

  if (!answer) {
    throw new AiRequestError(502, "LearnMate AI returned an empty response");
  }

  return {
    answer,
    chatId: aiPickString(data, [
      "chatId",
      "chat_id",
      "conversationId",
      "conversation_id",
    ]),
  };
}

function aiFriendlyError(error: unknown): string {
  if (error instanceof AiRequestError) {
    if (error.status === 401 || error.status === 403) {
      return "Your session may have expired. Refresh the page and sign in again.";
    }

    if (error.status === 429) {
      return "LearnMate AI is getting a lot of questions right now. Please wait a moment and try again.";
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }

  return "LearnMate AI could not answer that just now. Please try again.";
}

function aiNewId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ---- Lightweight, dependency-free markdown renderer ----
   Produces React elements only (never raw HTML), so model
   output cannot inject markup into the page. */

const AI_UL = /^\s*[-*•]\s+/;
const AI_OL = /^\s*\d+[.)]\s+/;
const AI_FENCE = /^\s*```/;
const AI_MD_HEADING = /^\s{0,3}(#{1,4})\s+(.*)$/;
const AI_RULE = /^\s*([-*_])\1{2,}\s*$/;
const AI_QUOTE = /^\s*>\s?/;
const AI_TABLE_SEP =
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function startsAiBlock(line: string, next?: string): boolean {
  return (
    AI_FENCE.test(line) ||
    AI_MD_HEADING.test(line) ||
    AI_RULE.test(line) ||
    AI_UL.test(line) ||
    AI_OL.test(line) ||
    AI_QUOTE.test(line) ||
    (line.trim().startsWith("|") &&
      next !== undefined &&
      AI_TABLE_SEP.test(next))
  );
}

function splitAiTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderAiInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g,
  );

  return parts.map((part, index) => {
    if (!part) return null;

    const key = `${keyPrefix}-${index}`;

    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="ai-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

function renderAiMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let counter = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const key = `b${counter}`;
    counter += 1;

    // Fenced code block
    if (AI_FENCE.test(line)) {
      const code: string[] = [];
      i += 1;

      while (i < lines.length && !AI_FENCE.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }

      i += 1;

      blocks.push(
        <pre key={key} className="ai-code" tabIndex={0}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const heading = line.match(AI_MD_HEADING);

    if (heading) {
      blocks.push(
        <h3 key={key} className="ai-md-heading">
          {renderAiInline(heading[2], key)}
        </h3>,
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (AI_RULE.test(line)) {
      blocks.push(<hr key={key} className="ai-md-rule" />);
      i += 1;
      continue;
    }

    // Table
    if (
      line.trim().startsWith("|") &&
      i + 1 < lines.length &&
      AI_TABLE_SEP.test(lines[i + 1])
    ) {
      const head = splitAiTableRow(line);
      const rows: string[][] = [];
      i += 2;

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitAiTableRow(lines[i]));
        i += 1;
      }

      blocks.push(
        <div key={key} className="ai-table-wrap">
          <table className="ai-table">
            <thead>
              <tr>
                {head.map((cell, n) => (
                  <th key={n}>{renderAiInline(cell, `${key}-h${n}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, n) => (
                    <td key={n}>
                      {renderAiInline(cell, `${key}-${r}-${n}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (AI_QUOTE.test(line)) {
      const quote: string[] = [];

      while (i < lines.length && AI_QUOTE.test(lines[i])) {
        quote.push(lines[i].replace(AI_QUOTE, ""));
        i += 1;
      }

      blocks.push(
        <blockquote key={key} className="ai-md-quote">
          {quote.map((text, n) => (
            <span key={n}>
              {n > 0 && <br />}
              {renderAiInline(text, `${key}-${n}`)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Lists
    if (AI_UL.test(line) || AI_OL.test(line)) {
      const ordered = AI_OL.test(line);
      const pattern = ordered ? AI_OL : AI_UL;
      const startMatch = line.match(/^\s*(\d+)/);
      const start = ordered && startMatch ? Number(startMatch[1]) : 1;
      const items: string[] = [];

      while (i < lines.length && pattern.test(lines[i])) {
        let item = lines[i].replace(pattern, "");
        i += 1;

        while (
          i < lines.length &&
          lines[i].trim() &&
          /^\s{2,}\S/.test(lines[i]) &&
          !AI_UL.test(lines[i]) &&
          !AI_OL.test(lines[i])
        ) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }

        items.push(item);

        // Allow a blank line between items of the same list.
        let peek = i;
        while (peek < lines.length && !lines[peek].trim()) peek += 1;
        if (peek > i && peek < lines.length && pattern.test(lines[peek])) {
          i = peek;
        }
      }

      const listItems = items.map((item, n) => (
        <li key={n}>{renderAiInline(item, `${key}-${n}`)}</li>
      ));

      blocks.push(
        ordered ? (
          <ol key={key} className="ai-md-list" start={start}>
            {listItems}
          </ol>
        ) : (
          <ul key={key} className="ai-md-list">
            {listItems}
          </ul>
        ),
      );
      continue;
    }

    // Paragraph
    const paragraph: string[] = [line];
    i += 1;

    while (
      i < lines.length &&
      lines[i].trim() &&
      !startsAiBlock(lines[i], lines[i + 1])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={key} className="ai-md-p">
        {paragraph.map((text, n) => (
          <span key={n}>
            {n > 0 && <br />}
            {renderAiInline(text.trim(), `${key}-${n}`)}
          </span>
        ))}
      </p>,
    );
  }

  return blocks;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User>(FALLBACK_USER);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem("learnmate-sidebar-collapsed") ===
        "1"
      ) {
        setSidebarCollapsed(true);
      }
    } catch {
      /* Storage unavailable: start expanded. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "learnmate-sidebar-collapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* Persistence is a nicety, not a requirement. */
    }
  }, [sidebarCollapsed]);
  const [settingsView, setSettingsView] =
    useState<SettingsView>("main");

  const [theme, setTheme] =
    useState<"light" | "dark">("light");

  const themePeriodRef = useRef("");
  const themeManualRef = useRef(false);

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
    useState<
      | "dashboard"
      | "courses"
      | "ai"
      | "tests"
      | "quizzes"
      | "milestones"
      | "analytics"
    >(
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

  const [selectedCompulsorySubject, setSelectedCompulsorySubject] =
    useState<string | null>(null);

  const [coursesContentReady, setCoursesContentReady] =
    useState(false);

  const [addControlsReady, setAddControlsReady] =
    useState(false);
  const [courseLoading, setCourseLoading] =
    useState(true);

  const [courseSaving, setCourseSaving] =
    useState(false);

  const [courseDeleteLoading, setCourseDeleteLoading] =
    useState(false);

  const [selectedStream, setSelectedStream] =
    useState<string | null>(null);

  const [selectedMathVariant, setSelectedMathVariant] =
    useState<"Pure" | "Applied" | null>(null);

  const [courseDeleteMode, setCourseDeleteMode] =
    useState(false);

  const [selectedCourseIds, setSelectedCourseIds] =
    useState<string[]>([]);

  const [courseDeleteConfirmOpen, setCourseDeleteConfirmOpen] =
    useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<CurriculumChapter | null>(null);
  const [weeklyStudySeconds, setWeeklyStudySeconds] = useState(0);
  const [answerStats, setAnswerStats] = useState<AnswerStat[]>([]);
  const [nextTestDate, setNextTestDate] = useState<string | null>(null);
  const [lmVideoProgress, setLmVideoProgress] = useState<Record<string, LmVideoProgress>>({});
  const [lmHomeUpcoming, setLmHomeUpcoming] = useState<LmHomeTest[]>([]);
  const [lmHomeUpcomingTotal, setLmHomeUpcomingTotal] = useState(0);


  /* ==========================================================
     MARK 5 — LEARNMATE AI (DOUBT CLEARER) STATE
  ========================================================== */

  const [aiChats, setAiChats] = useState<AiChatSummary[]>([]);
  const [aiHistoryLoading, setAiHistoryLoading] = useState(true);
  const [aiHistoryError, setAiHistoryError] = useState(false);

  const [aiActiveChatId, setAiActiveChatId] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiMessagesLoading, setAiMessagesLoading] = useState(false);
  const [aiMessagesError, setAiMessagesError] = useState(false);

  const [aiDraft, setAiDraft] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiGlowLive, setAiGlowLive] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [aiCompact, setAiCompact] = useState(false);
  const [aiHistoryCollapsed, setAiHistoryCollapsed] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiReducedMotion, setAiReducedMotion] = useState(false);
  const [aiShowJump, setAiShowJump] = useState(false);

  // Incremented whenever the active conversation changes, so a slow
  // response can never be written into a different conversation.
  const aiSessionRef = useRef(0);
  const aiActiveChatIdRef = useRef<string | null>(null);
  const aiSendingRef = useRef(false);
  const aiChatsRequestRef = useRef(0);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  const aiStickRef = useRef(true);
  const aiPendingScrollRef = useRef<
    "instant" | "bottom" | "assistant" | null
  >(null);


  useEffect(() => {
    const savedSection =
      sessionStorage.getItem(
        "learnmate-active-section",
      );

    if (savedSection === "courses") {
      setActiveSection("courses");
    } else if (savedSection === "ai") {
      setActiveSection("ai");
    } else if (savedSection === "tests") {
      setActiveSection("tests");
    } else if (savedSection === "quizzes") {
      setActiveSection("quizzes");
    } else if (savedSection === "milestones") {
      setActiveSection("milestones");
    } else if (savedSection === "analytics") {
      setActiveSection("analytics");
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
    let mounted = true;

    const initializeCourses = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser || !mounted) return;

      await loadCourses(authUser.id);
      await lmRefreshVideoProgress();
    };

    initializeCourses();

    return () => {
      mounted = false;
    };
  }, []);

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
  const getClassNumber = (
    value: string | null,
  ): number | null => {
    if (!value) return null;

    const number = Number(
      value.replace("Class ", "").trim(),
    );

    return Number.isFinite(number)
      ? number
      : null;
  };

  const getSubjectsForSelection = (
    classLevel: number | null,
    stream: string | null,
  ): string[] => {
    if (!classLevel) return [];

    if (classLevel === 1 || classLevel === 2) {
      return ["English", "Mathematics"];
    }

    if (classLevel >= 3 && classLevel <= 5) {
      return JUNIOR_SUBJECTS;
    }

    if (classLevel >= 6 && classLevel <= 10) {
      return MIDDLE_SUBJECTS;
    }

    if (classLevel >= 11 && classLevel <= 12) {
      if (!stream) return [];

      return STREAM_SUBJECTS[stream] || [];
    }

    return [];
  };

  const getSubjectIcon = (
    subject: string,
  ): string => {
    switch (subject) {
      case "Mathematics":
        return "∑";

      case "Science":
      case "Physics":
      case "Chemistry":
      case "Biology":
        return "⚗";

      case "Computer Science":
        return "⌘";

      case "Social Science":
      case "Geography":
        return "🌍";

      case "History":
        return "◫";

      case "Political Science":
        return "⚖";

      case "Psychology":
        return "◉";

      case "Economics":
        return "₹";

      case "Accountancy":
        return "▤";

      case "Business Studies":
        return "▣";

      default:
        return "A";
    }
  };

  const parseCourseTitle = (
    title: string,
    classLevel: number,
  ): {
    stream: string | null;
    mathVariant: "Pure" | "Applied" | null;
  } => {
    let stream: string | null = null;
    let mathVariant:
      | "Pure"
      | "Applied"
      | null = null;

    if (title.includes("— Science")) {
      stream = "Science";
    } else if (title.includes("— Commerce")) {
      stream = "Commerce";
    } else if (
      title.includes("— Arts/Humanities")
    ) {
      stream = "Arts/Humanities";
    }

    if (
      classLevel >= 11 &&
      title.includes("Mathematics (Pure)")
    ) {
      mathVariant = "Pure";
    }

    if (
      classLevel >= 11 &&
      title.includes("Mathematics (Applied)")
    ) {
      mathVariant = "Applied";
    }

    return {
      stream,
      mathVariant,
    };
  };

  // Best-effort fetch of saved video progress, merged into course
  // progress. If the video_progress migration has not run yet the
  // route errors and courses simply keep their old progress.
  const lmRefreshVideoProgress = async () => {
    try {
      const res = await fetch("/api/video-progress");
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, LmVideoProgress> = {};
      (Array.isArray(data?.progress) ? data.progress : []).forEach((row: any) => {
        if (typeof row?.chapter_key !== "string") return;
        map[row.chapter_key] = {
          percent: Math.max(0, Math.min(100, Number(row.percent) || 0)),
          watched: Math.max(0, Number(row.watched_seconds) || 0),
          duration: Math.max(0, Number(row.duration_seconds) || 0),
        };
      });
      setLmVideoProgress(map);
      setCourses((prev) => lmMergeVideoProgress(prev, map));
    } catch {
      /* Video progress is optional until its migration runs. */
    }
  };

  const loadCourses = async (
    userId: string,
  ) => {
    setCourseLoading(true);

    try {
      const {
        data: courseRows,
        error: courseError,
      } = await supabase
        .from("courses")
        .select(
          "id,title,class_level,subject_id,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      if (courseError) {
        console.error(
          "Could not load courses:",
          courseError,
        );

        showToast(
          "Could not load your courses.",
          "error",
        );

        return;
      }

      if (!courseRows?.length) {
        setCourses([]);
        return;
      }

      const subjectIds = Array.from(
        new Set(
          courseRows.map(
            (course) => course.subject_id,
          ),
        ),
      );

      const {
        data: subjectRows,
        error: subjectError,
      } = await supabase
        .from("subjects")
        .select("id,name")
        .in("id", subjectIds);

      if (subjectError) {
        console.error(
          "Could not load subjects:",
          subjectError,
        );

        setCourses([]);
        return;
      }

      const subjectMap = new Map<string, string>();

      (
        (subjectRows || []) as SubjectRow[]
      ).forEach((subject) => {
        subjectMap.set(
          subject.id,
          subject.name,
        );
      });

      const rawCourses = courseRows.map(
        (row) => {
          const classLevel =
            Number(row.class_level);

          const subject =
            subjectMap.get(row.subject_id) ||
            "Unknown Subject";

          const parsed =
            parseCourseTitle(
              row.title,
              classLevel,
            );

          return {
            id: row.id,
            title: row.title,
            class: `Class ${classLevel}`,
            subject,
            progress: 0,
            classLevel,
            stream: parsed.stream,
            mathVariant: parsed.mathVariant,
          };
        },
      );

      const courseIds =
        rawCourses.map(
          (course) => course.id,
        );

      const {
        data: chapters,
        error: chaptersError,
      } = await supabase
        .from("chapters")
        .select("id,course_id")
        .in("course_id", courseIds);

      if (chaptersError || !chapters?.length) {
        setCourses(rawCourses);
        return;
      }

      const chapterIds =
        chapters.map(
          (chapter) => chapter.id,
        );

      const {
        data: milestones,
        error: milestonesError,
      } = await supabase
        .from("milestones")
        .select("id,chapter_id")
        .in("chapter_id", chapterIds);

      if (
        milestonesError ||
        !milestones?.length
      ) {
        setCourses(rawCourses);
        return;
      }

      const milestoneIds =
        milestones.map(
          (milestone) => milestone.id,
        );

      const {
        data: progressRows,
        error: progressError,
      } = await supabase
        .from("milestone_progress")
        .select(
          "milestone_id,progress_percent,completed",
        )
        .eq("user_id", userId)
        .in("milestone_id", milestoneIds);

      if (progressError) {
        setCourses(rawCourses);
        return;
      }

      const chapterToCourse =
        new Map<string, string>();

      chapters.forEach((chapter) => {
        chapterToCourse.set(
          chapter.id,
          chapter.course_id,
        );
      });

      const milestoneToCourse =
        new Map<string, string>();

      milestones.forEach((milestone) => {
        const courseId =
          chapterToCourse.get(
            milestone.chapter_id,
          );

        if (courseId) {
          milestoneToCourse.set(
            milestone.id,
            courseId,
          );
        }
      });

      const progressByCourse =
        new Map<string, number[]>();

      milestoneIds.forEach(
        (milestoneId) => {
          const courseId =
            milestoneToCourse.get(
              milestoneId,
            );

          if (!courseId) return;

          const row =
            progressRows?.find(
              (item) =>
                item.milestone_id ===
                milestoneId,
            );

          const progress = Math.max(
            0,
            Math.min(
              100,
              Number(
                row?.progress_percent,
              ) || 0,
            ),
          );

          const values =
            progressByCourse.get(
              courseId,
            ) || [];

          values.push(progress);

          progressByCourse.set(
            courseId,
            values,
          );
        },
      );

      setCourses(
        rawCourses.map((course) => {
          const values =
            progressByCourse.get(
              course.id,
            );

          const progress =
            values?.length
              ? Math.round(
                values.reduce(
                  (sum, value) =>
                    sum + value,
                  0,
                ) / values.length,
              )
              : 0;

          return {
            ...course,
            progress,
          };
        }),
      );
    } catch (error) {
      console.error(
        "Course loading error:",
        error,
      );

      showToast(
        "Could not load your courses.",
        "error",
      );
    } finally {
      setCourseLoading(false);
    }
  };

  const toggleCourseSelection = (
    courseId: string,
  ) => {
    setSelectedCourseIds((current) =>
      current.includes(courseId)
        ? current.filter(
          (id) => id !== courseId,
        )
        : [...current, courseId],
    );
  };

  const startCourseDeleteMode = () => {
    setCourseDeleteMode(true);
    setSelectedCourseIds([]);
  };

  const cancelCourseDeleteMode = () => {
    setCourseDeleteMode(false);
    setSelectedCourseIds([]);
    setCourseDeleteConfirmOpen(false);
  };

  const requestDeleteSelectedCourses = () => {
    if (!selectedCourseIds.length) {
      showToast(
        "Select at least one course.",
        "error",
      );
      return;
    }

    setCourseDeleteConfirmOpen(true);
  };

  const handleDeleteSelectedCourses =
    async () => {
      if (!selectedCourseIds.length) return;

      setCourseDeleteLoading(true);

      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          window.location.href = "/auth";
          return;
        }

        const { error } = await supabase
          .from("courses")
          .delete()
          .in("id", selectedCourseIds)
          .eq("user_id", authUser.id);

        if (error) {
          throw error;
        }

        const deletedIds =
          new Set(selectedCourseIds);

        setCourses((current) =>
          current.filter(
            (course) =>
              !deletedIds.has(course.id),
          ),
        );

        const count =
          selectedCourseIds.length;

        setSelectedCourseIds([]);
        setCourseDeleteMode(false);
        setCourseDeleteConfirmOpen(false);

        showToast(
          count === 1
            ? "Course deleted."
            : `${count} courses deleted.`,
          "success",
        );
      } catch (error) {
        console.error(
          "Could not delete courses:",
          error,
        );

        showToast(
          error instanceof Error
            ? error.message
            : "Could not delete the selected courses.",
          "error",
        );
      } finally {
        setCourseDeleteLoading(false);
      }
    };
  const ongoingCourses = courses.filter(
    (course) => course.progress < 100,
  );

  const completedCourses = courses.filter(
    (course) => course.progress >= 100,
  );

  const displayedCourses =
    courseTab === "ongoing"
      ? ongoingCourses
      : completedCourses;

  const mostCompletedCourse =
    [...ongoingCourses].sort((a, b) => b.progress - a.progress)[0] ||
    [...completedCourses].sort((a, b) => b.progress - a.progress)[0] ||
    null;
  const continueProgress = useCountUp(mostCompletedCourse?.progress ?? 0);
  const selectedCourse = courses.find(course => course.id === selectedCourseId) || null;
  const selectedCourseChapters = selectedCourse ? getCourseChapters(selectedCourse) : [];
  const strongestTopic = answerStats.filter(x => x.total > 0).sort((a, b) => (b.correct / b.total) - (a.correct / a.total))[0] || null;
  const weakestTopic = answerStats.filter(x => x.total > 0).sort((a, b) => (a.correct / a.total) - (b.correct / b.total))[0] || null;

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
      confirmAction !== null ||
      courseDeleteConfirmOpen;

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
    courseDeleteConfirmOpen,
  ]);

  /* ==========================================================
     THEME
  ========================================================== */

  useEffect(() => {
    const periodOf = (d: Date) => {
      // Theme windows: dark 12:00 AM-3:59 AM, light 4:00 AM-11:59 PM.
      // The window key must change at both boundaries (midnight and
      // 4 AM) so a manual toggle holds only until the next boundary.
      // Hours 0-3 belong to the window that began the previous day.
      const day = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() - (d.getHours() < 4 ? 1 : 0),
      );

      return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    };

    const applyTimeTheme = () => {
      const now = new Date();
      const period = periodOf(now);

      if (themePeriodRef.current !== period) {
        themePeriodRef.current = period;
        themeManualRef.current = false;
      }

      if (themeManualRef.current) return;

      setTheme(now.getHours() < 4 ? "dark" : "light");
    };

    applyTimeTheme();

    const timer = window.setInterval(applyTimeTheme, 30000);

    return () => window.clearInterval(timer);
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
            login_name: cleaned,
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
            login_name: cleaned,
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
            login_name: cleaned,
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
    themeManualRef.current = true;

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
   LEARNMATE TESTS / QUIZZES / MILESTONES — WIRING (2026-10-26)
   Sections wired to /api/tests, /api/quizzes, /api/schedules and
   /api/chapters/resolve. Decisions: D1 one test/chapter (30 marks),
   D2 pass 18, D3 tests in-memory only (TestTaker), D5 scheduling +
   server expiry, D4 videos later via resolveVideo (null today).
   ========================================================== */

  type LmApiTest = {
    id: string;
    title: string;
    totalMarks: number;
    passingMarks: number;
    durationMinutes: number;
  };

  type LmResolvedChapter = {
    templateChapterId: string;
    test: LmApiTest | null;
  };

  type LmLoadedTest = {
    testId: string;
    testTitle: string;
    chapterTitle: string;
    durationMinutes: number;
    questions: TestQuestion[];
  };

  const lmApiError = async (res: Response): Promise<string> => {
    try {
      const body = await res.json();
      const message =
        body?.error?.message ||
        body?.error ||
        `Request failed (${res.status}).`;
      return typeof message === "string"
        ? message
        : `Request failed (${res.status}).`;
    } catch {
      return `Request failed (${res.status}).`;
    }
  };

  const lmResolveChapter = async (
    course: Course,
    chapter: CurriculumChapter,
  ): Promise<LmResolvedChapter> => {
    const params = new URLSearchParams({
      classLevel: String(course.classLevel),
      subject: course.subject,
      section: chapter.section ?? "",
      title: chapter.title,
    });
    if (course.mathVariant) params.set("mathVariant", course.mathVariant);
    const res = await fetch(`/api/chapters/resolve?${params.toString()}`);
    if (!res.ok) throw new Error(await lmApiError(res));
    return (await res.json()) as LmResolvedChapter;
  };

  const lmPush = usePushSubscription();

  /* ---------------- Tests section state ---------------- */

  // One view at a time — views never stack or overlap. The list view
  // (Upcoming / Completed) is the landing screen; the picker only
  // appears after "+ Add test" is pressed.
  type LmTestView =
    | "list"
    | "pick-course"
    | "pick-chapter"
    | "type-select"
    | "schedule";
  type LmTestTab = "upcoming" | "completed";

  const [lmTestView, setLmTestView] = useState<LmTestView>("list");
  const [lmTestTab, setLmTestTab] = useState<LmTestTab>("upcoming");
  const [lmTestCourseId, setLmTestCourseId] = useState<string>("");
  const [lmTestChapterIndex, setLmTestChapterIndex] = useState<string>("");
  const [lmTestResolve, setLmTestResolve] =
    useState<LmResolvedChapter | null>(null);
  const [lmTestResolving, setLmTestResolving] = useState(false);
  const [lmTestError, setLmTestError] = useState<string | null>(null);
  const [lmTestQuestions, setLmTestQuestions] =
    useState<LmLoadedTest | null>(null);
  type LmUpcomingSchedule = {
    id: string;
    templateChapterId: string;
    scheduledAtISO: string;
    status: string;
    windowEndsAtISO: string;
    isExpired: boolean;
    chapterTitle: string;
    section: string | null;
  };
  type LmCompletedTest = {
    id: string;
    chapterTitle: string;
    section: string | null;
    score: number;
    totalMarks: number;
    passed: boolean;
    completedAt: string;
  };
  const [lmUpcoming, setLmUpcoming] = useState<LmUpcomingSchedule[]>([]);
  const [lmUpcomingLoading, setLmUpcomingLoading] = useState(false);
  const [lmCompleted, setLmCompleted] = useState<LmCompletedTest[]>([]);
  const [lmCompletedLoading, setLmCompletedLoading] = useState(false);
  const [lmAnWeek, setLmAnWeek] = useState<{ date: string; seconds: number }[]>([]);
  const [lmAnTotalSeconds, setLmAnTotalSeconds] = useState(0);
  const [lmAnBestStreak, setLmAnBestStreak] = useState(0);
  const [lmAnReady, setLmAnReady] = useState(false);
  const [lmAnGo, setLmAnGo] = useState(false);
  const [lmConfirmDeleteAttemptId, setLmConfirmDeleteAttemptId] = useState<string | null>(null);
  const lmChapterPickedRef = useRef(false);

  const lmRefreshUpcoming = async () => {
    setLmUpcomingLoading(true);
    try {
      const res = await fetch("/api/schedules");
      if (!res.ok) return;
      const body = await res.json();
      const rows = Array.isArray(body?.schedules) ? body.schedules : [];
      setLmUpcoming(
        rows.map((s: any) => ({
          id: String(s.id),
          templateChapterId: String(s.template_chapter_id),
          scheduledAtISO: String(s.scheduled_at),
          status: String(s.status),
          windowEndsAtISO: String(s.windowEndsAt ?? ""),
          isExpired: Boolean(s.isExpired),
          chapterTitle: String(s.chapter?.title ?? "Untitled chapter"),
          section: s.chapter?.section ?? null,
        })),
      );
    } catch {
      /* Keep the previous list; Upcoming is secondary. */
    } finally {
      setLmUpcomingLoading(false);
    }
  };

  const lmRefreshCompleted = async () => {
    setLmCompletedLoading(true);
    try {
      const res = await fetch("/api/tests/attempts");
      if (!res.ok) return;
      const body = await res.json();
      const rows = Array.isArray(body?.attempts) ? body.attempts : [];
      setLmCompleted(
        rows.map((a: any) => ({
          id: String(a.id),
          chapterTitle: String(a.chapterTitle ?? "Untitled chapter"),
          section: a.section ?? null,
          score: Number(a.score ?? 0),
          totalMarks: Number(a.totalMarks ?? 30),
          passed: Boolean(a.passed),
          completedAt: String(a.completedAt),
        })),
      );
    } catch {
      /* Keep the previous list; Completed is secondary. */
    } finally {
      setLmCompletedLoading(false);
    }
  };


  /* ---------- Analytics: derived from real attempts / courses ---------- */
  const lmAnShow =
    activeSection === "analytics" && lmAnReady && !lmCompletedLoading;
  const lmAnAvg30 = lmCompleted.length
    ? lmCompleted.reduce(
      (s, a) => s + (a.totalMarks > 0 ? (a.score / a.totalMarks) * 30 : 0),
      0,
    ) / lmCompleted.length
    : 0;
  const lmAnPassedCount = lmCompleted.filter((a) => a.passed).length;
  const lmAnChart = [...lmCompleted].slice(0, 7).reverse();
  const lmAnChartPts = lmAnChart.map((a, i) => {
    const score30 = a.totalMarks > 0 ? (a.score / a.totalMarks) * 30 : 0;
    return {
      x:
        lmAnChart.length > 1
          ? 20 + (520 * i) / (lmAnChart.length - 1)
          : 280,
      y: 168 - (Math.min(30, score30) / 30) * 148,
      score: Math.round(score30),
    };
  });
  const lmAnLine = lmAnChartPts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const lmAnArea =
    lmAnChartPts.length > 1
      ? `${lmAnLine} L${lmAnChartPts[lmAnChartPts.length - 1].x.toFixed(1)},168 L${lmAnChartPts[0].x.toFixed(1)},168 Z`
      : "";
  const lmAnPassY = 168 - (18 / 30) * 148;
  const lmAnBestByChapter = new Map<string, LmCompletedTest>();
  for (const a of lmCompleted) {
    const cur = lmAnBestByChapter.get(a.chapterTitle);
    if (!cur || a.score / a.totalMarks > cur.score / cur.totalMarks)
      lmAnBestByChapter.set(a.chapterTitle, a);
  }
  const lmAnRanked = Array.from(lmAnBestByChapter.values()).sort(
    (x, y) => y.score / y.totalMarks - x.score / x.totalMarks,
  );
  const lmAnStrong = lmAnRanked
    .filter((a) => a.totalMarks > 0 && a.score / a.totalMarks >= 0.6)
    .slice(0, 2);
  const lmAnWeak = [...lmAnRanked]
    .reverse()
    .filter((a) => a.totalMarks > 0 && a.score / a.totalMarks < 0.6)
    .slice(0, 2);
  const lmAnSubjects = (() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const c of courses) {
      const e = m.get(c.subject) ?? { sum: 0, n: 0 };
      e.sum += c.progress;
      e.n += 1;
      m.set(c.subject, e);
    }
    return Array.from(m.entries())
      .map(([subject, e]) => ({ subject, pct: Math.round(e.sum / e.n) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  })();
  const lmAnWeekDays = (() => {
    const start = parseDateString(getWeekStart());
    const byDate = new Map(lmAnWeek.map((r) => [r.date, r.seconds]));
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayStr = getLocalDateString(new Date());
    return names.map((name, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = getLocalDateString(d);
      return {
        name,
        minutes: Math.round((byDate.get(ds) ?? 0) / 60),
        isToday: ds === todayStr,
      };
    });
  })();
  const lmAnWeekMax = Math.max(1, ...lmAnWeekDays.map((d) => d.minutes));
  const lmAnWeekTotal = lmAnWeekDays.reduce((s, d) => s + d.minutes, 0);
  const lmAnT = useCountUp(lmAnGo ? 100 : 0, 1900) / 100;
  const lmAnOverallAnim = useCountUp(
    lmAnGo ? (mostCompletedCourse?.progress ?? 0) : 0,
    1700,
  );
  const lmAnStreakAnim = useCountUp(lmAnGo ? streakDays : 0, 1700);
  const lmAnAvgAnim = useCountUp(lmAnGo ? lmAnAvg30 : 0, 1700);
  const lmAnTimeAnim = useCountUp(lmAnGo ? lmAnTotalSeconds : 0, 1700);

  // Schedule phase from the clock: a scheduled test opens at its
  // scheduled time and can be started for 30 minutes. Before that it
  // is upcoming; after the window it is missed, whatever the stored
  // status still says (the row flips to missed lazily, server-side).
  const lmSchedulePhase = (
    s: LmUpcomingSchedule,
  ): "upcoming" | "open" | "missed" => {
    if (s.status === "missed") return "missed";
    if (s.status !== "scheduled" && s.status !== "available")
      return "missed";
    const start = new Date(s.scheduledAtISO).getTime();
    const end = s.windowEndsAtISO
      ? new Date(s.windowEndsAtISO).getTime()
      : start + 30 * 60 * 1000;
    const now = Date.now();
    if (Number.isNaN(start) || Number.isNaN(end) || now > end)
      return "missed";
    return now < start ? "upcoming" : "open";
  };

  const lmUpcomingLive = lmUpcoming.filter(
    (s) =>
      (s.status === "scheduled" || s.status === "available") &&
      lmSchedulePhase(s) !== "missed",
  );
  const lmUpcomingMissed = lmUpcoming.filter(
    (s) =>
      (s.status === "scheduled" ||
        s.status === "available" ||
        s.status === "missed") &&
      lmSchedulePhase(s) === "missed",
  );

  // Open-window prompt: when a scheduled test's 30-minute start
  // window is open, opening the app shows a prompt naming the test
  // with a forced choice — Start test or Cancel test. One prompt at
  // a time (the window that closes soonest first, since schedules
  // arrive ordered by scheduled time). A schedule handled here is
  // not prompted again this page session, even if the student backs
  // out of the started test without submitting.
  const [lmOpenPromptId, setLmOpenPromptId] = useState<string | null>(null);
  const [lmRedoCourse, setLmRedoCourse] =
    useState<Course | null>(null);
  const lmPromptHandledRef = useRef<Set<string>>(new Set());
  const lmOpenPromptItem = lmOpenPromptId
    ? lmUpcoming.find((s) => s.id === lmOpenPromptId) ?? null
    : null;
  const lmPromptHeading = lmOpenPromptItem
    ? `Your test for ${lmOpenPromptItem.chapterTitle} has started.`
    : "";
  const lmPromptTyped = useTypewriter(
    lmPromptHeading,
    45,
    Boolean(lmOpenPromptItem),
  );

  useEffect(() => {
    if (lmOpenPromptId) {
      // The schedule vanished (cancelled or completed elsewhere):
      // close the prompt instead of pointing at nothing.
      if (!lmUpcoming.some((s) => s.id === lmOpenPromptId)) {
        setLmOpenPromptId(null);
      }
      return;
    }
    if (lmTestQuestions) return;
    const open = lmUpcoming.find(
      (s) =>
        (s.status === "scheduled" || s.status === "available") &&
        lmSchedulePhase(s) === "open" &&
        !lmPromptHandledRef.current.has(s.id),
    );
    if (open) setLmOpenPromptId(open.id);
  }, [lmUpcoming, lmTestQuestions, lmOpenPromptId]);

  const lmPromptStart = () => {
    const item = lmOpenPromptItem;
    if (!item) return;
    lmPromptHandledRef.current.add(item.id);
    setLmOpenPromptId(null);
    setActiveSection("tests");
    sessionStorage.setItem("learnmate-active-section", "tests");
    lmStartUpcoming(item);
  };

  const lmPromptCancel = async () => {
    const item = lmOpenPromptItem;
    if (!item) return;
    lmPromptHandledRef.current.add(item.id);
    setLmOpenPromptId(null);
    try {
      await lmCancelTestSchedule(item.id);
      showToast("Test cancelled.", "success");
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Could not cancel this test.",
        "error",
      );
    }
    await lmRefreshUpcoming();
  };

  /* Redo a completed course: clear its saved video progress so it returns
     to Ongoing at 0%. Past test attempts are kept. */
  const lmRedoConfirm = async () => {
    const course = lmRedoCourse;
    if (!course) return;
    setLmRedoCourse(null);

    await lmWithLoading("Resetting your course…", async () => {
      try {
        const curriculumKey = getCurriculumKey(course);
        const chapterKeys = getCourseChapters(course).map(
          (chapter) =>
            `${curriculumKey}|${chapter.section ?? ""}|${chapter.title}`,
        );

        const res = await fetch("/api/video-progress", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterKeys }),
        });

        if (!res.ok) throw new Error("reset failed");

        await lmRefreshVideoProgress();

        setAddOpen(false);
        setAddClosing(false);
        setSelectedClass(null);
        setSelectedStream(null);
        setSelectedSubject(null);
        setSelectedCompulsorySubject(null);
        setSelectedMathVariant(null);
        setActiveSection("courses");
        sessionStorage.setItem(
          "learnmate-active-section",
          "courses",
        );
        setCourseTab("ongoing");
        setSelectedCourseId(course.id);
        showToast(
          "Course reset — it is back in your ongoing courses.",
          "success",
        );
      } catch {
        showToast(
          "Could not reset this course. Please try again.",
          "error",
        );
      }
    });
  };

  // Start from Upcoming: the schedule itself pins the exact chapter
  // (templateChapterId), so there is nothing to match against courses.
  // A chapter sitting in several courses — or in none, after a course
  // was deleted — starts exactly the same way, with no ambiguity and
  // no "open it through Add test" dead end.
  const lmStartUpcoming = (item: LmUpcomingSchedule) => {
    void lmStartScheduledWithoutCourse(item);
  };

  // When a chapter picked from the chapter list resolves, show the two
  // options (Do it now / Schedule). Same stale-resolve guard as above.
  // Backing out of type-select does not re-trigger this: the ref is
  // only set by an actual chapter tap.
  useEffect(() => {
    if (
      lmChapterPickedRef.current &&
      !lmTestResolving &&
      lmTestResolve?.test
    ) {
      lmChapterPickedRef.current = false;
      setLmTestView("type-select");
    }
  }, [lmTestResolve, lmTestResolving]);

  // List data: whenever the Tests section is showing its list view,
  // load the active tab (fresh on every return to the list, e.g. after
  // scheduling or finishing a test).
  useEffect(() => {
    if (activeSection !== "tests" || lmTestQuestions) return;
    if (lmTestView !== "list") return;
    if (lmTestTab === "upcoming") void lmRefreshUpcoming();
    else void lmRefreshCompleted();
  }, [activeSection, lmTestView, lmTestTab, lmTestQuestions]);

  const lmTestCourse =
    courses.find((c) => c.id === lmTestCourseId) || null;
  const lmTestChapters = lmTestCourse
    ? getCourseChapters(lmTestCourse)
    : [];
  const lmTestChapter =
    lmTestChapterIndex !== "" &&
      lmTestChapters[Number(lmTestChapterIndex)]
      ? lmTestChapters[Number(lmTestChapterIndex)]
      : null;

  useEffect(() => {
    if (!lmTestCourseId || lmTestChapterIndex === "") {
      setLmTestResolve(null);
      return;
    }
    const course = courses.find((c) => c.id === lmTestCourseId);
    if (!course) return;
    const chapters = getCourseChapters(course);
    const chapter = chapters[Number(lmTestChapterIndex)];
    if (!chapter) return;
    let cancelled = false;
    setLmTestResolving(true);
    setLmTestError(null);
    lmResolveChapter(course, chapter)
      .then((resolved) => {
        if (cancelled) return;
        setLmTestResolve(resolved);
        setLmTestResolving(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setLmTestError(
            err instanceof Error
              ? err.message
              : "Could not load this chapter's test.",
          );
          setLmTestResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lmTestCourseId, lmTestChapterIndex, courses]);

  /* ---------------- Global loading overlay ---------------- */
  // One overlay for every Tests action, so a button click never leaves
  // the site looking frozen: the overlay appears if the action takes
  // longer than 200ms (fast actions never flash it) and stays until
  // the action settles — success or error — via the finally block.
  // Overlapping actions stack; the overlay shows the latest message.
  const [lmLoadingStack, setLmLoadingStack] = useState<
    { id: number; message: string }[]
  >([]);
  const lmLoadingIdRef = useRef(0);
  const lmWithLoading = async <T,>(
    message: string,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const id = (lmLoadingIdRef.current += 1);
    let shown = false;
    const timer = window.setTimeout(() => {
      shown = true;
      setLmLoadingStack((prev) => [...prev, { id, message }]);
    }, 200);
    try {
      return await fn();
    } finally {
      window.clearTimeout(timer);
      if (shown) {
        setLmLoadingStack((prev) => prev.filter((x) => x.id !== id));
      }
    }
  };
  const lmLoadingVisible = lmLoadingStack.length > 0;
  const lmLoadingMessage =
    lmLoadingStack.length > 0
      ? lmLoadingStack[lmLoadingStack.length - 1].message
      : "";

  const lmStartTest = () =>
    lmWithLoading("Starting your test…", async () => {
      if (!lmTestResolve?.test || !lmTestChapter) return;
      setLmTestError(null);
      try {
        const res = await fetch(
          `/api/tests/${lmTestResolve.test.id}/questions`,
        );
        if (!res.ok) throw new Error(await lmApiError(res));
        const body = await res.json();
        const questions: TestQuestion[] = [...(body.questions || [])]
          .sort(
            (a: any, b: any) => a.questionOrder - b.questionOrder,
          )
          .map((q: any) => ({
            id: String(q.id),
            text: String(q.questionText),
            options: q.options as string[],
          }));
        setLmTestQuestions({
          testId: String(body.test.id),
          testTitle: String(body.test.title),
          chapterTitle: lmTestChapter.title,
          durationMinutes: body.test.durationMinutes ?? 30,
          questions,
        });
      } catch (err) {
        setLmTestError(
          err instanceof Error
            ? err.message
            : "Could not start this test.",
        );
      }
    });

  // Start a scheduled test without any course: the schedule itself
  // carries the chapter (templateChapterId), so a deleted course can
  // never hide or block its tests. The test's own disclaimer still
  // shows first (TestTaker always starts on the disclaimer phase).
  const lmStartScheduledWithoutCourse = (item: LmUpcomingSchedule) =>
    lmWithLoading("Starting your test…", async () => {
      try {
        const res = await fetch(
          `/api/tests/by-template/${item.templateChapterId}`,
        );
        if (!res.ok) throw new Error(await lmApiError(res));
        const body = await res.json();
        const qres = await fetch(`/api/tests/${body.test.id}/questions`);
        if (!qres.ok) throw new Error(await lmApiError(qres));
        const qbody = await qres.json();
        const questions: TestQuestion[] = [...(qbody.questions || [])]
          .sort((a: any, b: any) => a.questionOrder - b.questionOrder)
          .map((q: any) => ({
            id: String(q.id),
            text: String(q.questionText),
            options: q.options as string[],
          }));
        setLmTestQuestions({
          testId: String(qbody.test.id),
          testTitle: String(qbody.test.title),
          chapterTitle: item.chapterTitle,
          durationMinutes: qbody.test.durationMinutes ?? 30,
          questions,
        });
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Could not start this test.",
          "error",
        );
      }
    });

  const lmSubmitTest = (
    answers: TestAnswer[],
    idempotencyKey: string,
  ): Promise<TestResult> =>
    lmWithLoading("Submitting your test…", async () => {
      if (!lmTestQuestions) throw new Error("No test is loaded.");
      const res = await fetch(
        `/api/tests/${lmTestQuestions.testId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, idempotencyKey }),
        },
      );
      if (!res.ok) throw new Error(await lmApiError(res));
      const body = await res.json();
      const byId = new Map(
        lmTestQuestions.questions.map((q) => [q.id, q]),
      );
      return {
        score: body.score,
        totalMarks: body.totalMarks,
        passingMarks: body.passingMarks,
        passed: body.passed,
        perQuestion: (body.results || []).map((r: any) => {
          const q = byId.get(r.questionId);
          return {
            questionId: r.questionId,
            text: q?.text ?? "",
            options: q?.options ?? [],
            selectedAnswer: r.submittedAnswer,
            correctAnswer: r.correctAnswer,
            isCorrect: r.isCorrect,
            marksAwarded: r.marksAwarded,
          };
        }),
      };
    });

  const lmCreateTestSchedule = (scheduledAtISO: string) =>
    lmWithLoading("Scheduling your test…", async () => {
      if (!lmTestResolve)
        throw new Error("Pick a course and chapter first.");
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateChapterId: lmTestResolve.templateChapterId,
          scheduledAt: scheduledAtISO,
        }),
      });
      if (!res.ok) throw new Error(await lmApiError(res));
    });

  const lmDeleteCompleted = (id: string) =>
    lmWithLoading("Deleting your test…", async () => {
      const res = await fetch(`/api/tests/attempts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await lmApiError(res));
      setLmConfirmDeleteAttemptId(null);
      await lmRefreshCompleted();
    });

  const lmCancelTestSchedule = (id: string) =>
    lmWithLoading("Cancelling your test…", async () => {
      const res = await fetch(`/api/schedules/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await lmApiError(res));
    });


  /* ---------------- Notifications (bell tab) ---------------- */

  const lmTimeAgo = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms) || ms < 0) return "just now";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  };

  const lmRefreshNotifs = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const body = await res.json();
      const rows = Array.isArray(body?.notifications) ? body.notifications : [];
      setNotifs(
        rows.map((r: any) => ({
          id: String(r.id),
          type: String(r.type),
          title: String(r.title),
          body: String(r.body),
          time: lmTimeAgo(String(r.createdAt)),
          read: Boolean(r.readAt),
          link: r.link ?? null,
        })),
      );
    } catch {
      /* The bell is secondary; a failed refresh just keeps old rows. */
    }
  };

  const notifUnread = notifs.filter((n) => !n.read).length;

  const lmMarkNotifRead = async (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      /* Local state already updated. */
    }
  };

  const lmMarkAllNotifsRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      /* Local state already updated. */
    }
  };

  const lmOpenNotif = (n: Notif) => {
    if (!n.read) void lmMarkNotifRead(n.id);
    if (n.link === "tests") {
      setNotifOpen(false);
      setActiveSection("tests");
      sessionStorage.setItem("learnmate-active-section", "tests");
      setLmTestView("list");
      setLmTestTab("upcoming");
    }
  };

  // Streak milestones: 4 / 7 / 10 / 15 days. Every milestone at or
  // below the current streak gets its notification (deduped by key),
  // so a streak that jumped past a milestone still notifies for it.
  useEffect(() => {
    if (streakLoading || streakDays <= 0) return;
    const due = [4, 7, 10, 15].filter((m) => streakDays >= m);
    if (due.length === 0) return;
    (async () => {
      for (const m of due) {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "streak",
              title: `${m}-day streak!`,
              body: `You've studied ${m} days in a row. Keep it going!`,
              key: `streak:${m}`,
            }),
          });
        } catch {
          /* Bell is secondary; ignore. */
        }
      }
      void lmRefreshNotifs();
    })();
  }, [streakDays, streakLoading]);

  // Test reminders: 24h, 12h, 4h, 2h, 1h, 30m, 10m before a scheduled
  // test. A window notifies once its threshold is reached (deduped by
  // key); opening the app late still shows the windows already
  // reached. Schedules more than 24h out cost no requests at all.
  const lmCheckReminders = async () => {
    const windows = [
      { label: "24 hours", ms: 24 * 3600 * 1000 },
      { label: "12 hours", ms: 12 * 3600 * 1000 },
      { label: "4 hours", ms: 4 * 3600 * 1000 },
      { label: "2 hours", ms: 2 * 3600 * 1000 },
      { label: "1 hour", ms: 3600 * 1000 },
      { label: "30 minutes", ms: 30 * 60 * 1000 },
      { label: "10 minutes", ms: 10 * 60 * 1000 },
    ];
    for (const s of lmUpcoming) {
      if (s.status !== "scheduled" && s.status !== "available") continue;
      const startMs = new Date(s.scheduledAtISO).getTime();
      const endMs = s.windowEndsAtISO
        ? new Date(s.windowEndsAtISO).getTime()
        : startMs + 30 * 60 * 1000;
      const nowMs = Date.now();
      // The window has opened: one "started" notification per schedule.
      if (!Number.isNaN(startMs) && nowMs >= startMs && nowMs <= endMs) {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "test-started",
              title: "Your test has started",
              body: `Your test for ${s.chapterTitle} is open now — you can start it until ${new Date(endMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
              key: `started:${s.id}`,
              link: "tests",
            }),
          });
        } catch {
          /* Bell is secondary; ignore. */
        }
      }
      // The window has closed with no submission: the test is missed.
      // Skipped while any test is on screen — a student mid-test is
      // not missing it; the check runs again once the test closes.
      if (!Number.isNaN(endMs) && nowMs > endMs && !lmTestQuestions) {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "test-missed",
              title: "You missed your test",
              body: `Your test for ${s.chapterTitle} was scheduled for ${new Date(s.scheduledAtISO).toLocaleString()} and its start window has closed. You can schedule it again from Tests.`,
              key: `missed:${s.id}`,
              link: "tests",
            }),
          });
        } catch {
          /* Bell is secondary; ignore. */
        }
      }
      const until = new Date(s.scheduledAtISO).getTime() - Date.now();
      if (until <= 0 || until > windows[0].ms) continue;
      for (const w of windows) {
        if (until > w.ms) continue;
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "reminder",
              title: `Test in ${w.label}`,
              body: `Your test for ${s.chapterTitle} is coming up — scheduled for ${new Date(s.scheduledAtISO).toLocaleString()}.`,
              key: `reminder:${s.id}:${w.label}`,
              link: "tests",
            }),
          });
        } catch {
          /* Bell is secondary; ignore. */
        }
      }
    }
  };

  useEffect(() => {
    if (lmUpcoming.length === 0) return;
    void lmCheckReminders().then(() => void lmRefreshNotifs());
  }, [lmUpcoming]);

  // Welcome safety net: accounts whose signup path never writes a
  // profiles row (Google sign-in) never trip the welcome trigger, so
  // make sure exactly one welcome notification exists. Deduped by
  // key, so this is a no-op for everyone who already has one.
  // Bell upkeep: fresh notifications + fresh schedules every minute,
  // so reminders appear while the dashboard is open, and once on load.
  useEffect(() => {
    void (async () => {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "welcome",
            title: "Welcome to LearnMate!",
            body: "Your account is ready. Add a course and take your first chapter test.",
            key: "welcome",
          }),
        });
      } catch {
        /* Bell is secondary; ignore. */
      }
      void lmRefreshNotifs();
    })();
    void lmRefreshUpcoming();
    const t = window.setInterval(() => {
      void lmRefreshNotifs();
      void lmRefreshUpcoming();
    }, 60000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------------- Quizzes section state ---------------- */

  const [lmQuizCourseId, setLmQuizCourseId] = useState<string>("");
  const [lmQuizChapterIndex, setLmQuizChapterIndex] = useState<string>("");
  const [lmQuizResolve, setLmQuizResolve] =
    useState<LmResolvedChapter | null>(null);
  const [lmQuizResolving, setLmQuizResolving] = useState(false);
  const [lmQuizError, setLmQuizError] = useState<string | null>(null);
  const [lmQuizQuestions, setLmQuizQuestions] = useState<TestQuestion[]>(
    [],
  );
  const lmQuizIdRef = useRef<string | null>(null);

  const lmQuizCourse =
    courses.find((c) => c.id === lmQuizCourseId) || null;
  const lmQuizChapters = lmQuizCourse
    ? getCourseChapters(lmQuizCourse)
    : [];
  const lmQuizChapter =
    lmQuizChapterIndex !== "" &&
      lmQuizChapters[Number(lmQuizChapterIndex)]
      ? lmQuizChapters[Number(lmQuizChapterIndex)]
      : null;

  useEffect(() => {
    if (!lmQuizCourseId || lmQuizChapterIndex === "") {
      setLmQuizResolve(null);
      return;
    }
    const course = courses.find((c) => c.id === lmQuizCourseId);
    if (!course) return;
    const chapters = getCourseChapters(course);
    const chapter = chapters[Number(lmQuizChapterIndex)];
    if (!chapter) return;
    let cancelled = false;
    setLmQuizResolving(true);
    setLmQuizError(null);
    lmResolveChapter(course, chapter)
      .then((resolved) => {
        if (cancelled) return;
        setLmQuizResolve(resolved);
        setLmQuizResolving(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setLmQuizError(
            err instanceof Error
              ? err.message
              : "Could not load this chapter.",
          );
          setLmQuizResolving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lmQuizCourseId, lmQuizChapterIndex, courses]);

  const lmGenerateQuiz = async (
    marks: number,
  ): Promise<QuizGenerateResult> => {
    if (!lmQuizResolve)
      return { error: "Pick a course and chapter first." };
    try {
      const res = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateChapterId: lmQuizResolve.templateChapterId,
          totalMarks: marks,
        }),
      });
      if (!res.ok) return { error: await lmApiError(res) };
      const body = await res.json();
      lmQuizIdRef.current = String(body.quizId);
      const questions: TestQuestion[] = [...(body.questions || [])]
        .sort(
          (a: any, b: any) => a.questionOrder - b.questionOrder,
        )
        .map((q: any) => ({
          id: String(q.id),
          text: String(q.questionText),
          options: q.options as string[],
        }));
      setLmQuizQuestions(questions);
      return { questions };
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Could not build this quiz.",
      };
    }
  };

  const lmSubmitQuiz = async (
    answers: TestAnswer[],
    idempotencyKey: string,
  ): Promise<TestResult> => {
    const quizId = lmQuizIdRef.current;
    if (!quizId) throw new Error("No quiz is loaded.");
    const res = await fetch(`/api/quizzes/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, idempotencyKey }),
    });
    if (!res.ok) throw new Error(await lmApiError(res));
    const body = await res.json();
    const byId = new Map(lmQuizQuestions.map((q) => [q.id, q]));
    return {
      score: body.score,
      totalMarks: body.totalMarks,
      // Quizzes have no pass threshold; these values are hidden by
      // hidePassFail on the result screen and are never displayed.
      passingMarks: 0,
      passed: false,
      perQuestion: (body.results || []).map((r: any) => {
        const q = byId.get(r.questionId);
        return {
          questionId: r.questionId,
          text: q?.text ?? "",
          options: q?.options ?? [],
          selectedAnswer: r.submittedAnswer,
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          marksAwarded: r.marksAwarded,
        };
      }),
    };
  };

  /* ---------------- Milestones section state ---------------- */

  const [lmMilestoneCourseId, setLmMilestoneCourseId] =
    useState<string>("");
  const [lmMilestoneChapters, setLmMilestoneChapters] = useState<
    { id: string; title: string; watched: boolean; watchPercent: number }[]
  >([]);
  const [lmMsDropdownOpen, setLmMsDropdownOpen] = useState(false);
  const [lmMilestoneLoading, setLmMilestoneLoading] = useState(false);
  const [lmMilestoneError, setLmMilestoneError] = useState<string | null>(
    null,
  );
  const [lmMilestoneNotice, setLmMilestoneNotice] = useState<string | null>(
    null,
  );

  const lmMilestoneCourse =
    courses.find((c) => c.id === lmMilestoneCourseId) || null;
  const lmOngoingCourses = courses.filter((c) => c.progress < 100);

  const lmMilestoneKey = (
    course: Course,
    chapter: CurriculumChapter,
  ): string =>
    `${getCurriculumKey(course)}|${chapter.section ?? ""}|${chapter.title}`;

  // Milestone chapters come straight from the curriculum plus the
  // student's real video watch progress: a chapter counts as
  // watched when any of its video has been watched (percent > 0).
  // No separate milestone tables are involved anymore.
  useEffect(() => {
    const course = courses.find((c) => c.id === lmMilestoneCourseId);
    if (!course) {
      setLmMilestoneChapters([]);
      setLmMilestoneError(null);
      setLmMilestoneLoading(false);
      return;
    }
    setLmMilestoneError(null);
    setLmMilestoneLoading(false);
    setLmMilestoneChapters(
      getCourseChapters(course).map((ch) => {
        const key = lmMilestoneKey(course, ch);
        const p = lmVideoProgress[key];
        return {
          id: key,
          title: ch.title,
          watched: (p?.percent ?? 0) > 0,
          watchPercent: p?.percent ?? 0,
        };
      }),
    );
  }, [lmMilestoneCourseId, courses, lmVideoProgress]);

  // Default the milestone course to the ongoing course with the
  // highest progress whenever nothing valid is picked.
  useEffect(() => {
    if (lmOngoingCourses.length === 0) return;
    if (lmOngoingCourses.some((c) => c.id === lmMilestoneCourseId)) return;
    const best = [...lmOngoingCourses].sort(
      (a, b) => b.progress - a.progress,
    )[0];
    setLmMilestoneCourseId(best.id);
  }, [lmOngoingCourses, lmMilestoneCourseId]);

  // Fresh watch progress whenever the Milestones section opens, so
  // a video watched a moment ago lights up straight away.
  useEffect(() => {
    if (activeSection === "milestones") void lmRefreshVideoProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const lmHandleMilestoneWatch = (course: Course, chapterId: string) => {
    // Defense-in-depth gate: MilestonePath already refuses to call this
    // when resolveChapterVideo returns null. If a URL ever resolves, the
    // existing chapter-selection mechanism opens that chapter's lesson.
    // NOTE: future resolveVideo map keys must be these curriculum keys
    // (classLevel|subject|section|title) for the gate to line up.
    const videoUrl = resolveChapterVideo(chapterId);
    if (!videoUrl) {
      setLmMilestoneNotice(
        "The video for this chapter has not been added yet.",
      );
      return;
    }
    const parts = chapterId.split("|");
    const title = parts.slice(3).join("|");
    const section = parts[2] || undefined;
    const chapter = getCourseChapters(course).find(
      (c) => c.title === title && (c.section ?? "") === (section ?? ""),
    );
    if (!chapter) {
      setLmMilestoneNotice("Could not open that chapter.");
      return;
    }
    setLmMilestoneNotice(null);
    setActiveSection("courses");
    sessionStorage.setItem("learnmate-active-section", "courses");
    setSelectedCourseId(course.id);
    setSelectedChapter(chapter);
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

      sessionStorage.setItem(
        "learnmate-active-section",
        "dashboard",
      );

      return;
    }

    if (label === "My Courses") {
      setActiveSection("courses");
      setAddOpen(false);
      setAddClosing(false);

      sessionStorage.setItem(
        "learnmate-active-section",
        "courses",
      );

      return;
    }

    if (label === "Doubt Clearer") {
      setActiveSection("ai");
      setAddOpen(false);
      setAddClosing(false);

      sessionStorage.setItem(
        "learnmate-active-section",
        "ai",
      );

      return;
    }


    if (label === "Tests") {
      setActiveSection("tests");
      setAddOpen(false);
      setAddClosing(false);

      sessionStorage.setItem(
        "learnmate-active-section",
        "tests",
      );

      return;
    }

    if (label === "Milestones") {
      setActiveSection("milestones");
      setAddOpen(false);
      setAddClosing(false);

      sessionStorage.setItem(
        "learnmate-active-section",
        "milestones",
      );

      return;
    }

    if (label === "Analytics") {
      setActiveSection("analytics");
      setAddOpen(false);
      setAddClosing(false);

      sessionStorage.setItem(
        "learnmate-active-section",
        "analytics",
      );

      return;
    }

    showToast(
      "This Feature will be added in MARK3 Update",
      "error",
    );
  };


  /* Analytics data: attempts refresh + study time + streak history. */
  useEffect(() => {
    if (activeSection !== "analytics") return;
    let cancelled = false;
    setLmAnReady(false);
    void lmRefreshCompleted();
    (async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          if (!cancelled) setLmAnReady(true);
          return;
        }
        const weekStart = getWeekStart();
        const today = getLocalDateString(new Date());
        const [weekRes, totalRes, streakRes] = await Promise.all([
          supabase
            .from("study_time_logs")
            .select("activity_date,seconds_studied")
            .eq("user_id", authUser.id)
            .gte("activity_date", weekStart)
            .lte("activity_date", today),
          supabase
            .from("study_time_logs")
            .select("seconds_studied")
            .eq("user_id", authUser.id),
          supabase
            .from("study_streaks")
            .select("activity_date")
            .eq("user_id", authUser.id)
            .order("activity_date", { ascending: true }),
        ]);
        if (cancelled) return;
        if (!weekRes.error)
          setLmAnWeek(
            (weekRes.data ?? []).map((r: any) => ({
              date: String(r.activity_date),
              seconds: Math.max(0, Number(r.seconds_studied) || 0),
            })),
          );
        if (!totalRes.error)
          setLmAnTotalSeconds(
            (totalRes.data ?? []).reduce(
              (s: number, r: any) =>
                s + Math.max(0, Number(r.seconds_studied) || 0),
              0,
            ),
          );
        if (!streakRes.error) {
          const dates = Array.from(
            new Set(
              (streakRes.data ?? []).map((r: any) =>
                String(r.activity_date),
              ),
            ),
          ).sort();
          let best = 0;
          let run = 0;
          let prev: Date | null = null;
          for (const d of dates) {
            const cur = parseDateString(d);
            if (
              prev &&
              Math.round(
                (cur.getTime() - prev.getTime()) / 86400000,
              ) === 1
            )
              run += 1;
            else run = 1;
            best = Math.max(best, run);
            prev = cur;
          }
          setLmAnBestStreak(best);
        }
      } catch {
        /* Whatever loaded stays; empty states are honest. */
      }
      if (!cancelled) setLmAnReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  /* Start the analytics loaders just after the cards begin to
     de-blur, so the 0-to-value motion is clearly visible. */
  useEffect(() => {
    if (!lmAnShow) {
      setLmAnGo(false);
      return;
    }
    const t = window.setTimeout(() => setLmAnGo(true), 300);
    return () => window.clearTimeout(t);
  }, [lmAnShow]);

  /* ==========================================================
     MARK 2 — ADD COURSE
  ========================================================== */

  const openAddCourse = () => {
    setAddClosing(false);
    setAddOpen(true);

    setSelectedClass(null);
    setSelectedStream(null);
    setSelectedSubject(null);
    setSelectedCompulsorySubject(null);
    setSelectedMathVariant(null);

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
      setSelectedStream(null);
      setSelectedSubject(null);
      setSelectedCompulsorySubject(null);
      setSelectedMathVariant(null);
    }, 320);
  };

  const addCourse = async () => {
    if (!selectedClass) {
      showToast(
        "Please select your class.",
        "error",
      );
      return;
    }

    const classLevel =
      getClassNumber(selectedClass);

    if (!classLevel) {
      showToast(
        "Invalid class selected.",
        "error",
      );
      return;
    }

    if (
      classLevel >= 11 &&
      !selectedStream
    ) {
      showToast(
        "Please select your stream.",
        "error",
      );
      return;
    }

    const selectedCourseSubject =
      selectedCompulsorySubject || selectedSubject;

    if (!selectedCourseSubject) {
      showToast(
        classLevel >= 11
          ? "Please select one compulsory subject or stream subject."
          : "Please select your subject.",
        "error",
      );
      return;
    }

    if (
      classLevel >= 11 &&
      selectedCourseSubject === "Mathematics" &&
      !selectedMathVariant
    ) {
      showToast(
        "Please select Pure or Applied Mathematics.",
        "error",
      );
      return;
    }

    setCourseSaving(true);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const {
        data: subject,
        error: subjectError,
      } = await supabase
        .from("subjects")
        .select("id")
        .eq("name", selectedCourseSubject)
        .maybeSingle();

      if (subjectError) {
        throw subjectError;
      }

      if (!subject) {
        throw new Error(
          `Subject "${selectedCourseSubject}" does not exist in Supabase.`,
        );
      }

      const subjectTitle =
        selectedMathVariant &&
          selectedCourseSubject === "Mathematics"
          ? `${selectedCourseSubject} (${selectedMathVariant})`
          : selectedCourseSubject;

      const title = [
        subjectTitle,
        selectedClass,
        selectedStream,
      ]
        .filter(Boolean)
        .join(" — ");
      // Prevent the same user from adding the exact same course twice.
      const {
        data: existingCourse,
        error: duplicateCheckError,
      } = await supabase
        .from("courses")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("class_level", classLevel)
        .eq("subject_id", subject.id)
        .eq("title", title)
        .maybeSingle();

      if (duplicateCheckError) {
        throw duplicateCheckError;
      }

      if (existingCourse) {
        const doneCourse = courses.find(
          (course) => course.id === existingCourse.id,
        );

        if (doneCourse && doneCourse.progress >= 100) {
          setLmRedoCourse(doneCourse);
          return;
        }

        showToast(
          "You’ve already added this course.",
          "error",
        );
        return;
      }
      const {
        data: insertedCourse,
        error: insertError,
      } = await supabase
        .from("courses")
        .insert({
          user_id: authUser.id,
          title,
          class_level: classLevel,
          subject_id: subject.id,
        })
        .select(
          "id,title,class_level,subject_id,created_at",
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      const newCourse: Course = {
        id: insertedCourse.id,
        title: insertedCourse.title,
        class: `Class ${classLevel}`,
        subject: selectedCourseSubject,
        progress: 0,
        classLevel,
        stream: selectedStream,
        mathVariant:
          selectedMathVariant,
      };

      setCourses((current) => [
        newCourse,
        ...current,
      ]);

      showToast(
        "Course added successfully.",
        "success",
      );

      setAddOpen(false);
      setAddClosing(false);
      setSelectedClass(null);
      setSelectedStream(null);
      setSelectedSubject(null);
      setSelectedCompulsorySubject(null);
      setSelectedMathVariant(null);
    } catch (error) {
      console.error(
        "Could not add course:",
        error,
      );

      showToast(
        error instanceof Error
          ? error.message
          : "Could not add the course.",
        "error",
      );
    } finally {
      setCourseSaving(false);
    }
  };

  /* Mark 3 weekly study timer. Supabase is the source of truth across browsers. */
  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;
    let refreshTimer: number | undefined;
    let userId: string | null = null;
    let weekStart = getWeekStart();
    let baseSeconds = 0;
    let pendingSeconds = 0;
    let flushing = false;

    const loadWeekTotal = async () => {
      if (!userId) return;
      const currentWeekStart = getWeekStart();
      const today = getLocalDateString(new Date());

      const { data, error } = await supabase
        .from("study_time_logs")
        .select("activity_date,seconds_studied")
        .eq("user_id", userId)
        .gte("activity_date", currentWeekStart)
        .lte("activity_date", today);

      if (error) {
        console.error("Could not load weekly study time:", error);
        return;
      }

      if (!mounted) return;
      weekStart = currentWeekStart;
      baseSeconds = (data || []).reduce(
        (total, row) => total + Math.max(0, Number(row.seconds_studied) || 0),
        0,
      );
      setWeeklyStudySeconds(baseSeconds + pendingSeconds);
    };

    const flushPending = async () => {
      if (!userId || pendingSeconds <= 0 || flushing) return;

      const secondsToSave = pendingSeconds;
      const activityDate = getLocalDateString(new Date());
      flushing = true;

      try {
        const { error } = await supabase.rpc("increment_study_time", {
          p_activity_date: activityDate,
          p_seconds: secondsToSave,
        });

        if (error) {
          console.error("Could not save study time:", error);
          return;
        }

        pendingSeconds = Math.max(0, pendingSeconds - secondsToSave);
        await loadWeekTotal();
      } finally {
        flushing = false;
      }
    };

    const start = async () => {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();

      if (error) console.error("Could not identify user for study time:", error);
      if (!mounted || !authUser) return;

      userId = authUser.id;
      await loadWeekTotal();

      const active = activeSection === "courses" && Boolean(selectedCourseId);
      if (!active || !mounted) return;

      timer = window.setInterval(() => {
        const currentWeekStart = getWeekStart();

        // The displayed total rolls over automatically when Monday begins.
        if (currentWeekStart !== weekStart) {
          weekStart = currentWeekStart;
          baseSeconds = 0;
          pendingSeconds = 0;
          setWeeklyStudySeconds(0);
          void loadWeekTotal();
        }

        pendingSeconds += 1;
        setWeeklyStudySeconds(baseSeconds + pendingSeconds);

        if (pendingSeconds >= 15) void flushPending();
      }, 1000);

      // Pick up study time logged from another browser/device while this page is open.
      refreshTimer = window.setInterval(() => {
        void loadWeekTotal();
      }, 30000);

      document.addEventListener("visibilitychange", handleVisibilityChange);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flushPending();
    };

    void start();

    return () => {
      mounted = false;
      if (timer !== undefined) window.clearInterval(timer);
      if (refreshTimer !== undefined) window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Best-effort save for time accumulated just before leaving the course.
      void flushPending();
    };
  }, [activeSection, selectedCourseId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("learnmate-chapter-answer-stats");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setAnswerStats(parsed.filter((x: any) => x && typeof x.chapterTitle === "string" && typeof x.courseTitle === "string"));
      }
      const test = localStorage.getItem("learnmate-next-test-date");
      if (test) setNextTestDate(test);
    } catch { /* optional local Mark 3 stats */ }
  }, []);

  // When a lesson closes, refresh course progress from saved video
  // progress. The video's final flush can land just after unmount,
  // so refetch once more shortly after close as well.
  const lmPrevChapterRef = useRef<CurriculumChapter | null>(null);
  useEffect(() => {
    const wasOpen = lmPrevChapterRef.current !== null;
    lmPrevChapterRef.current = selectedChapter;
    if (wasOpen && selectedChapter === null) {
      void lmRefreshVideoProgress();
      const t = window.setTimeout(() => {
        void lmRefreshVideoProgress();
      }, 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [selectedChapter]);

  // Dashboard home data: live scheduled tests (soonest first) and
  // best-per-chapter test results for Strong Topics / Needs
  // Attention. Both replace localStorage values that were never
  // written by any code path, which is why those sections stayed
  // empty. If the attempts fetch comes back empty, the old
  // localStorage stats (if any) are left in place.
  useEffect(() => {
    if (activeSection !== "dashboard") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/schedules");
        if (res.ok) {
          const data = await res.json();
          const live = (Array.isArray(data?.schedules) ? data.schedules : []).filter(
            (s: any) =>
              (s.status === "scheduled" || s.status === "available") &&
              !s.isExpired,
          );
          if (!cancelled) {
            setLmHomeUpcomingTotal(live.length);
            setLmHomeUpcoming(
              live.slice(0, 3).map((s: any) => ({
                id: s.id,
                title: s.chapter?.title ?? "Test",
                iso: s.scheduled_at,
              })),
            );
          }
        }
      } catch {
        /* Best-effort home data. */
      }
      try {
        const res = await fetch("/api/tests/attempts");
        if (res.ok) {
          const data = await res.json();
          const best = new Map<string, { title: string; section: string; score: number; total: number }>();
          (Array.isArray(data?.attempts) ? data.attempts : []).forEach((a: any) => {
            if (!a.chapterTitle || !a.totalMarks) return;
            const prev = best.get(a.chapterTitle);
            if (!prev || a.score / a.totalMarks > prev.score / prev.total) {
              best.set(a.chapterTitle, {
                title: a.chapterTitle,
                section: a.section ?? "",
                score: a.score,
                total: a.totalMarks,
              });
            }
          });
          if (!cancelled && best.size > 0) {
            setAnswerStats(
              [...best.values()].map((b) => ({
                chapterTitle: b.title,
                courseTitle: b.section,
                correct: b.score,
                total: b.total,
              })),
            );
          }
        }
      } catch {
        /* Best-effort home data. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  /* ==========================================================
     MARK 5 — LEARNMATE AI (DOUBT CLEARER) LOGIC
  ========================================================== */

  const aiSetActiveChat = (id: string | null) => {
    aiActiveChatIdRef.current = id;
    setAiActiveChatId(id);
  };

  const aiFocusComposer = () => {
    if (typeof window === "undefined") return;

    // Avoid popping the on-screen keyboard on touch devices.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    window.setTimeout(() => aiTextareaRef.current?.focus(), 80);
  };

  /* ---- History (reads through the existing Supabase client;
          row-level security on ai_chats enforces ownership) ---- */

  const aiLoadChats = async (silent = false) => {
    aiChatsRequestRef.current += 1;
    const requestId = aiChatsRequestRef.current;

    if (!silent) {
      setAiHistoryLoading(true);
      setAiHistoryError(false);
    }

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("ai_chats")
        .select("id, title, updated_at, created_at")
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false })
        .limit(AI_HISTORY_LIMIT);

      if (error) throw error;
      if (requestId !== aiChatsRequestRef.current) return;

      const rows = (data ?? []) as Array<{
        id: string;
        title: string | null;
        updated_at: string | null;
        created_at: string | null;
      }>;

      setAiChats(
        rows.map((row) => ({
          id: row.id,
          title: row.title?.trim() || "New conversation",
          updatedAt: row.updated_at ?? row.created_at ?? "",
        })),
      );
      setAiHistoryError(false);
    } catch (error) {
      console.error("LearnMate AI: could not load chat history", error);

      if (requestId === aiChatsRequestRef.current && !silent) {
        setAiHistoryError(true);
      }
    } finally {
      if (requestId === aiChatsRequestRef.current) {
        setAiHistoryLoading(false);
      }
    }
  };

  const aiLoadMessages = async (chatId: string, session: number) => {
    setAiMessagesLoading(true);
    setAiMessagesError(false);

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, created_at")
        .eq("chat_id", chatId)
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (session !== aiSessionRef.current) return;

      const rows = (data ?? []) as Array<{
        id: string;
        role: string;
        content: string | null;
        created_at: string | null;
      }>;

      const mapped = rows.map((row) => ({
        id: row.id,
        role: (row.role === "user" ? "user" : "assistant") as AiRole,
        content: row.content ?? "",
        time: row.created_at ? Date.parse(row.created_at) || 0 : 0,
      }));

      // Question and answer can share a timestamp; keep the question first.
      mapped.sort(
        (a, b) =>
          a.time - b.time ||
          (a.role === b.role ? 0 : a.role === "user" ? -1 : 1),
      );

      aiPendingScrollRef.current = "instant";
      aiStickRef.current = true;
      setAiMessages(
        mapped.map(({ id, role, content }) => ({ id, role, content })),
      );
    } catch (error) {
      console.error("LearnMate AI: could not load conversation", error);

      if (session !== aiSessionRef.current) return;
      setAiMessagesError(true);
    } finally {
      if (session === aiSessionRef.current) setAiMessagesLoading(false);
    }
  };

  /* ---- Chat history actions ---- */

  const aiRenameChat = async (chat: AiChatSummary) => {
    const proposed = window.prompt("Rename this conversation", chat.title);
    if (proposed === null) return;
    const title = proposed.trim();
    if (!title) {
      showToast("Chat name cannot be empty.", "error");
      return;
    }
    if (title.length > 80) {
      showToast("Chat names must be 80 characters or fewer.", "error");
      return;
    }
    if (title === chat.title) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("No authenticated user");
      const { error } = await supabase
        .from("ai_chats")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", chat.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      setAiChats((current) => current.map((item) => item.id === chat.id ? { ...item, title, updatedAt: new Date().toISOString() } : item));
      showToast("Conversation renamed.", "success");
    } catch (error) {
      console.error("LearnMate AI: could not rename conversation", error);
      showToast("Could not rename this conversation. Please try again.", "error");
    }
  };

  const aiDeleteChat = async (chat: AiChatSummary) => {
    if (!window.confirm(`Delete “${chat.title}”? This conversation and its messages will be permanently deleted.`)) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("No authenticated user");
      const { error } = await supabase
        .from("ai_chats")
        .delete()
        .eq("id", chat.id)
        .eq("user_id", authUser.id);
      if (error) throw error;

      setAiChats((current) => current.filter((item) => item.id !== chat.id));
      if (aiActiveChatIdRef.current === chat.id) {
        aiSessionRef.current += 1;
        aiSendingRef.current = false;
        aiSetActiveChat(null);
        setAiMessages([]);
        setAiMessagesLoading(false);
        setAiMessagesError(false);
        setAiSending(false);
        setAiError(null);
      }
      showToast("Conversation deleted.", "success");
    } catch (error) {
      console.error("LearnMate AI: could not delete conversation", error);
      showToast("Could not delete this conversation. Please try again.", "error");
    }
  };

  /* ---- Conversation actions ---- */

  const aiStartNewChat = () => {
    aiSessionRef.current += 1;
    aiSendingRef.current = false;

    aiSetActiveChat(null);
    setAiMessages([]);
    setAiMessagesLoading(false);
    setAiMessagesError(false);
    setAiError(null);
    setAiSending(false);
    setAiShowJump(false);
    setAiDrawerOpen(false);
    aiStickRef.current = true;

    aiFocusComposer();
  };

  const aiOpenChat = (chatId: string) => {
    if (chatId === aiActiveChatIdRef.current && !aiMessagesError) {
      setAiDrawerOpen(false);
      return;
    }

    aiSessionRef.current += 1;
    const session = aiSessionRef.current;

    aiSendingRef.current = false;
    setAiSending(false);
    setAiError(null);
    setAiShowJump(false);
    setAiMessages([]);
    aiSetActiveChat(chatId);
    setAiDrawerOpen(false);

    void aiLoadMessages(chatId, session);
    aiFocusComposer();
  };

  const aiSubmit = async (retryText?: string, retryId?: string) => {
    const question = (retryText ?? aiDraft).trim();

    if (!question || aiSendingRef.current) return;

    const session = aiSessionRef.current;
    const chatIdAtSend = aiActiveChatIdRef.current;
    const messageId = retryId ?? aiNewId("user");

    aiSendingRef.current = true;
    setAiSending(true);
    setAiError(null);
    aiPendingScrollRef.current = "bottom";
    aiStickRef.current = true;

    if (retryId) {
      setAiMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, failed: false } : m)),
      );
    } else {
      setAiMessages((prev) => [
        ...prev,
        { id: messageId, role: "user", content: question },
      ]);
      setAiDraft("");
    }

    try {
      const result = await requestAiAnswer(question, chatIdAtSend);

      if (session !== aiSessionRef.current) {
        // The student moved to another conversation; do not show this
        // answer here, just refresh the history so the chat appears.
        void aiLoadChats(true);
        return;
      }

      if (result.chatId) aiSetActiveChat(result.chatId);

      aiPendingScrollRef.current = "assistant";
      setAiMessages((prev) => [
        ...prev,
        {
          id: aiNewId("assistant"),
          role: "assistant",
          content: result.answer,
        },
      ]);

      void aiLoadChats(true);
    } catch (error) {
      console.error("LearnMate AI: request failed", error);

      if (session !== aiSessionRef.current) return;

      setAiMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, failed: true } : m)),
      );
      setAiError(aiFriendlyError(error));
    } finally {
      if (session === aiSessionRef.current) {
        aiSendingRef.current = false;
        setAiSending(false);
      }
    }
  };

  const aiRetry = () => {
    const failed = [...aiMessages]
      .reverse()
      .find((m) => m.role === "user" && m.failed);

    if (failed) void aiSubmit(failed.content, failed.id);
  };

  const aiHandleKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void aiSubmit();
    }
  };

  const aiCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("Copied to clipboard", "success");
    } catch {
      showToast("Could not copy. Please select the text and copy it.", "error");
    }
  };

  const aiToggleHistory = () => {
    if (aiCompact) {
      setAiDrawerOpen((open) => !open);
    } else {
      setAiHistoryCollapsed((collapsed) => !collapsed);
    }
  };

  const aiHandleScroll = () => {
    const el = aiScrollRef.current;
    if (!el) return;

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 120;
    aiStickRef.current = nearBottom;

    const showJump = !nearBottom && el.scrollHeight > el.clientHeight + 200;
    setAiShowJump((prev) => (prev === showJump ? prev : showJump));
  };

  const aiJumpToLatest = () => {
    const el = aiScrollRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: aiReducedMotion ? "auto" : "smooth",
    });
  };

  /* ---- Derived values ---- */

  const aiHistoryVisible = aiCompact ? aiDrawerOpen : !aiHistoryCollapsed;

  const aiShowWelcome =
    !aiActiveChatId &&
    aiMessages.length === 0 &&
    !aiSending &&
    !aiMessagesLoading;

  const aiTypedHeading = useTypewriter(
    AI_HEADING,
    55,
    activeSection === "ai" && aiShowWelcome && !aiReducedMotion,
  );

  /* ---- Effects ---- */

  // Reduced-motion and compact-layout detection.
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 1100px)");

    const sync = () => {
      setAiReducedMotion(motion.matches);
      setAiCompact(compact.matches);
    };

    sync();
    motion.addEventListener("change", sync);
    compact.addEventListener("change", sync);

    return () => {
      motion.removeEventListener("change", sync);
      compact.removeEventListener("change", sync);
    };
  }, []);

  // Load history each time the student opens Doubt Clearer.
  useEffect(() => {
    if (activeSection !== "ai") return;

    void aiLoadChats();
    aiFocusComposer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Keep the glow animating until its fade-out has finished.
  useEffect(() => {
    if (aiSending) {
      setAiGlowLive(true);
      return;
    }

    const timer = window.setTimeout(() => setAiGlowLive(false), 800);
    return () => window.clearTimeout(timer);
  }, [aiSending]);

  // Grow the composer with its content (up to a cap).
  useEffect(() => {
    const el = aiTextareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [aiDraft, activeSection, aiShowWelcome]);

  // Scroll behaviour: jump to the question, then to the start of the
  // answer, without yanking a student who is reading further up.
  useEffect(() => {
    if (activeSection !== "ai") return;

    const behavior: ScrollBehavior = aiReducedMotion ? "auto" : "smooth";
    const lastId = aiMessages[aiMessages.length - 1]?.id;

    const frame = window.requestAnimationFrame(() => {
      const mode = aiPendingScrollRef.current;
      aiPendingScrollRef.current = null;

      const el = aiScrollRef.current;
      if (!el) return;

      if (mode === "instant") {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      } else if (mode === "assistant" && lastId) {
        const node = el.querySelector<HTMLElement>(
          `[data-ai-msg-id="${lastId}"]`,
        );

        if (node) {
          el.scrollTo({
            top: Math.max(node.offsetTop - 12, 0),
            behavior,
          });
        }
      } else if (mode === "bottom" || aiStickRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    aiMessages,
    aiSending,
    aiError,
    aiMessagesLoading,
    activeSection,
    aiReducedMotion,
  ]);

  // Escape closes the history drawer.
  useEffect(() => {
    if (!aiDrawerOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiDrawerOpen(false);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aiDrawerOpen]);

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

        <div
          className={
            sidebarCollapsed ? "app sidebar-collapsed" : "app"
          }
        >
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
                    "My Courses") ||
                  (activeSection ===
                    "ai" &&
                    item.label ===
                    "Doubt Clearer") ||
                  (activeSection ===
                    "analytics" &&
                    item.label ===
                    "Analytics");
                return (
                  <button
                    key={item.label}
                    type="button"
                    title={item.label}
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

                    <span className="nav-label">
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

                <span className="side-foot-label">
                  Settings
                </span>
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

                <span
                  className="profile-chevron"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>

              <nav
                className="side-legal"
                aria-label="Legal"
              >
                <Link href="/privacy">
                  Privacy Policy
                </Link>

                <Link href="/terms">
                  Terms &amp; Conditions
                </Link>
              </nav>
            </div>
          </aside>
          <button
            type="button"
            className="lm-edge-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            aria-expanded={!sidebarCollapsed}
            title={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            <span aria-hidden="true">
              {sidebarCollapsed ? "»" : "«"}
            </span>
          </button>

          <main className={activeSection === "ai" ? "main ai-mode" : "main"}>
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
                  "dashboard" && (
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
                  )}
              </div>

              <div className="top-actions">
                <div className="desktop-theme-toggle">
                  <div className="lm-dn">
                    <input
                      className="lm-dn-input"
                      id="lm-dn-toggle"
                      type="checkbox"
                      checked={theme === "dark"}
                      onChange={toggleTheme}
                      aria-label="Toggle dark mode"
                    />

                    <label
                      className="lm-dn-toggle"
                      htmlFor="lm-dn-toggle"
                    >
                      <span className="lm-dn-handler">
                        <span className="lm-dn-crater lm-dn-crater--1"></span>
                        <span className="lm-dn-crater lm-dn-crater--2"></span>
                        <span className="lm-dn-crater lm-dn-crater--3"></span>
                      </span>

                      <span className="lm-dn-star lm-dn-star--1"></span>
                      <span className="lm-dn-star lm-dn-star--2"></span>
                      <span className="lm-dn-star lm-dn-star--3"></span>
                      <span className="lm-dn-star lm-dn-star--4"></span>
                      <span className="lm-dn-star lm-dn-star--5"></span>
                      <span className="lm-dn-star lm-dn-star--6"></span>
                    </label>
                  </div>
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

                    void lmRefreshNotifs();
                  }}
                >
                  <span
                    className="bell"
                    aria-hidden="true"
                  >
                    🔔
                  </span>

                  {notifUnread >
                    0 && (
                      <span className="dot">
                        {notifUnread}
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
                <div className="notif-head">
                  <h4>
                    Notifications
                  </h4>

                  {notifUnread > 0 && (
                    <button
                      type="button"
                      className="btn-cream"
                      onClick={() => void lmMarkAllNotifsRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifs.length === 0 ? (
                  <p className="muted">
                    No new notifications.
                  </p>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={n.read ? "notif" : "notif is-unread"}
                      onClick={() => lmOpenNotif(n)}
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
                          {n.body} · {n.time}
                        </small>
                      </span>
                    </div>
                  ))
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
                          mostCompletedCourse?.progress ?? 0
                        }
                        animate
                      />

                      <div>
                        <b className="t">
                          Overall Progress
                        </b>

                        <small className="overall-course-name">
                          {mostCompletedCourse ? mostCompletedCourse.title : "No courses added"}
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
                          {formatStudyTime(weeklyStudySeconds)}
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
                          {mostCompletedCourse ? (
                            <div className="empty-course continue-course">
                              <div className="empty-course-icon">📚</div>
                              <div className="hero-info">
                                <h3>{mostCompletedCourse.subject}{mostCompletedCourse.mathVariant ? ` (${mostCompletedCourse.mathVariant})` : ""}</h3>
                                <p>{mostCompletedCourse.class}{mostCompletedCourse.stream ? ` · ${mostCompletedCourse.stream}` : ""}</p>
                                <div className="bar"><i style={{ width: `${continueProgress}%` }} /></div>
                                <div className="hero-meta"><span>{mostCompletedCourse.progress >= 100 ? "Course completed" : "Continue where you left off"}</span><span className="pct">{Math.round(continueProgress)}%</span></div>
                              </div>
                              <button type="button" className="btn-cream" onClick={() => { setActiveSection("courses"); sessionStorage.setItem("learnmate-active-section", "courses"); setSelectedCourseId(mostCompletedCourse.id); setSelectedChapter(null); }}>
                                {mostCompletedCourse.progress >= 100 ? "Review Course" : "Continue Learning"} <span>→</span>
                              </button>
                            </div>
                          ) : (
                            <div className="empty-course">
                              <div className="empty-course-icon">📚</div>
                              <div className="hero-info"><h3>Add New Course</h3><p className="empty-course-text">Add a course to start learning.</p></div>
                              <button type="button" className="btn-cream" onClick={() => { setActiveSection("courses"); sessionStorage.setItem("learnmate-active-section", "courses"); openAddCourse(); }}>Add Course <span>→</span></button>
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="perf3 reveal d4 mark3-topic-grid" aria-label="Topic accuracy">
                        <div className="card pad">
                          <h3>⭐ Strong Topics</h3>
                          {strongestTopic ? <div className="topic-result"><b>{strongestTopic.chapterTitle}</b>{strongestTopic.courseTitle ? <span>{strongestTopic.courseTitle}</span> : null}<strong>{Math.round(strongestTopic.correct / strongestTopic.total * 100)}% correct</strong></div> : <div className="empty-section">Chapter accuracy will appear after you answer questions.</div>}
                        </div>
                        <div className="card pad needs-attention-card">
                          <h3 className="warn-title">⚠️ Needs Attention</h3>
                          {weakestTopic ? <div className="topic-result"><b>{weakestTopic.chapterTitle}</b>{weakestTopic.courseTitle ? <span>{weakestTopic.courseTitle}</span> : null}<strong>{Math.round(weakestTopic.correct / weakestTopic.total * 100)}% correct</strong></div> : <div className="empty-section">Your lowest-accuracy chapter will appear here after you answer questions.</div>}
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
                              setActiveSection("tests");
                              sessionStorage.setItem("learnmate-active-section", "tests");
                              setLmTestView("list");
                              setLmTestTab("upcoming");
                            }}
                          >
                            View all →
                          </a>
                        </div>

                        {lmHomeUpcoming.length > 0 ? (
                          <>
                            <div className="lm-home-tests">
                              {lmHomeUpcoming.map((t) => (
                                <button key={t.id} type="button" className="lm-home-test" onClick={() => { setActiveSection("tests"); sessionStorage.setItem("learnmate-active-section", "tests"); setLmTestView("list"); setLmTestTab("upcoming"); }}>
                                  <span className="lm-home-test-title">{t.title}</span>
                                  <span className="lm-home-test-date">{new Date(t.iso).toLocaleString()}</span>
                                </button>
                              ))}
                            </div>
                            {lmHomeUpcomingTotal > lmHomeUpcoming.length && (
                              <div className="lm-home-test-more">and {lmHomeUpcomingTotal - lmHomeUpcoming.length} more scheduled</div>
                            )}
                          </>
                        ) : (
                          <div className="empty-section">
                            {nextTestDate ? `Next test: ${new Date(`${nextTestDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}` : "No upcoming test scheduled"}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </>
              )}

            {/* ==================================================
                MARK 5 — LEARNMATE AI (DOUBT CLEARER)
            ================================================== */}

            {activeSection === "ai" && (
              <section
                className={`ai-workspace${aiHistoryVisible && !aiCompact ? " has-history" : ""
                  }`}
                aria-label="LearnMate AI"
              >
                {aiCompact && aiDrawerOpen && (
                  <div
                    className="ai-history-scrim"
                    onClick={() => setAiDrawerOpen(false)}
                    aria-hidden="true"
                  />
                )}

                {/* Previous conversations */}

                <aside
                  className={`ai-history${aiCompact ? " ai-history--drawer" : ""
                    }${aiHistoryVisible ? " is-visible" : ""}`}
                  aria-label="Previous conversations"
                  aria-hidden={!aiHistoryVisible}
                >
                  <div className="ai-history-head">
                    <h2 className="ai-history-title">Chats</h2>

                    {aiCompact && (
                      <button
                        type="button"
                        className="ai-icon-btn"
                        aria-label="Close chat history"
                        onClick={() => setAiDrawerOpen(false)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="ai-history-body">
                    {aiHistoryLoading ? (
                      <div aria-label="Loading conversations" role="status">
                        <span className="ai-skeleton" />
                        <span className="ai-skeleton" />
                        <span className="ai-skeleton" />
                        <span className="ai-skeleton" />
                      </div>
                    ) : aiHistoryError ? (
                      <div className="ai-history-note" role="alert">
                        Could not load your conversations.
                        <br />
                        <button
                          type="button"
                          className="ai-link-btn"
                          onClick={() => void aiLoadChats()}
                        >
                          Try again
                        </button>
                      </div>
                    ) : aiChats.length === 0 ? (
                      <p className="ai-history-note">
                        No conversations yet. Questions you ask will appear
                        here.
                      </p>
                    ) : (
                      <ul className="ai-history-list" role="list">
                        {aiChats.map((chat) => {
                          const isActive = chat.id === aiActiveChatId;

                          return (
                            <li key={chat.id} className="ai-history-row">
                              <button
                                type="button"
                                className={
                                  isActive
                                    ? "ai-history-item is-active"
                                    : "ai-history-item"
                                }
                                aria-current={isActive ? "true" : undefined}
                                title={chat.title}
                                onClick={() => aiOpenChat(chat.id)}
                              >
                                <span className="ai-history-item-title">{chat.title}</span>
                              </button>
                              <div className="ai-history-actions">
                                <button type="button" className="ai-history-action" aria-label={`Rename ${chat.title}`} title="Rename chat" onClick={() => void aiRenameChat(chat)}>
                                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16.5 6.5a1.8 1.8 0 0 0-2.5-2.5L4.3 13.7 3 17Z" /></svg>
                                </button>
                                <button type="button" className="ai-history-action is-delete" aria-label={`Delete ${chat.title}`} title="Delete chat" onClick={() => void aiDeleteChat(chat)}>
                                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 5.5h13M7.5 5.5V3.7h5v1.8M5.2 5.5l.7 11h8.2l.7-11M8 8.5v5M12 8.5v5" /></svg>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </aside>

                {/* Conversation */}

                <div className="ai-chat-pane">
                  <div className="ai-chat-head">
                    <button
                      type="button"
                      className="ai-icon-btn"
                      onClick={aiToggleHistory}
                      aria-label={
                        aiHistoryVisible
                          ? "Hide chat history"
                          : "Show chat history"
                      }
                      aria-expanded={aiHistoryVisible}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="4" width="18" height="16" rx="3" />
                        <path d="M9 4v16" />
                      </svg>
                    </button>

                    <span className="ai-chat-name">LearnMate AI</span>

                    <button
                      type="button"
                      className="ai-new-chat"
                      aria-label="New chat"
                      onClick={aiStartNewChat}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>New chat</span>
                    </button>
                  </div>

                  <div
                    className={`ai-chat${aiShowWelcome ? " is-welcome" : ""}`}
                  >
                    <div
                      className="ai-scroll"
                      ref={aiScrollRef}
                      onScroll={aiHandleScroll}
                    >
                      {aiShowWelcome ? (
                        <div className="ai-welcome">
                          <h1 className="ai-title" aria-label={AI_HEADING}>
                            <span className="ai-title-ghost" aria-hidden="true">
                              {AI_HEADING}
                            </span>

                            <span className="ai-title-live" aria-hidden="true">
                              {aiTypedHeading}

                              {aiTypedHeading.length < AI_HEADING.length && (
                                <span className="type-cursor">|</span>
                              )}
                            </span>
                          </h1>

                          <p className="ai-welcome-sub">
                            LearnMate AI helps you understand concepts and
                            clear your doubts, one step at a time.
                          </p>
                        </div>
                      ) : (
                        <div
                          className="ai-thread"
                          role="log"
                          aria-label="Conversation with LearnMate AI"
                        >
                          {aiMessagesLoading && (
                            <div
                              className="ai-thread-loading"
                              role="status"
                              aria-label="Loading conversation"
                            >
                              <span className="ai-skeleton ai-skeleton--right" />
                              <span className="ai-skeleton ai-skeleton--wide" />
                              <span className="ai-skeleton ai-skeleton--mid" />
                            </div>
                          )}

                          {aiMessagesError && (
                            <div className="ai-msg">
                              <div className="ai-error" role="alert">
                                <span>
                                  This conversation could not be loaded.
                                </span>

                                <button
                                  type="button"
                                  className="ai-retry"
                                  onClick={() => {
                                    const id = aiActiveChatIdRef.current;
                                    if (!id) return;
                                    aiSessionRef.current += 1;
                                    void aiLoadMessages(
                                      id,
                                      aiSessionRef.current,
                                    );
                                  }}
                                >
                                  Try again
                                </button>
                              </div>
                            </div>
                          )}

                          {aiMessages.map((message) =>
                            message.role === "user" ? (
                              <div
                                key={message.id}
                                className="ai-msg ai-msg--user"
                                data-ai-msg-id={message.id}
                              >
                                <div className="ai-user-wrap">
                                  <div
                                    className={
                                      message.failed
                                        ? "ai-bubble is-failed"
                                        : "ai-bubble"
                                    }
                                  >
                                    {message.content}
                                  </div>

                                  {message.failed && (
                                    <span className="ai-not-sent">
                                      Not sent
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div
                                key={message.id}
                                className="ai-msg ai-msg--assistant"
                                data-ai-msg-id={message.id}
                              >
                                <span className="ai-avatar" aria-hidden="true">
                                  🤖
                                </span>

                                <div className="ai-msg-body">
                                  <div className="ai-prose">
                                    {renderAiMarkdown(message.content)}
                                  </div>

                                  <div className="ai-msg-actions">
                                    <button
                                      type="button"
                                      className="ai-copy"
                                      onClick={() =>
                                        void aiCopyMessage(message.content)
                                      }
                                      aria-label="Copy answer"
                                    >
                                      <svg
                                        viewBox="0 0 24 24"
                                        width="15"
                                        height="15"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.9"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <rect
                                          x="9"
                                          y="9"
                                          width="11"
                                          height="11"
                                          rx="2.5"
                                        />
                                        <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
                                      </svg>
                                      <span>Copy</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ),
                          )}

                          {aiSending && (
                            <div
                              className="ai-msg ai-msg--assistant"
                              role="status"
                              aria-label="LearnMate AI is thinking"
                            >
                              <span
                                className="ai-avatar ai-avatar--pulse"
                                aria-hidden="true"
                              >
                                🤖
                              </span>

                              <span className="ai-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                              </span>
                            </div>
                          )}

                          {aiError && !aiSending && (
                            <div className="ai-msg">
                              <div className="ai-error" role="alert">
                                <span>{aiError}</span>

                                <button
                                  type="button"
                                  className="ai-retry"
                                  onClick={aiRetry}
                                >
                                  Try again
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Composer */}

                    <div className="ai-dock">
                      {!aiShowWelcome && aiShowJump && (
                        <button
                          type="button"
                          className="ai-jump"
                          onClick={aiJumpToLatest}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 5v14M5 12l7 7 7-7" />
                          </svg>
                          Latest
                        </button>
                      )}

                      <form
                        className="ai-composer-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void aiSubmit();
                        }}
                      >
                        <div
                          className={`ai-composer-shell${aiGlowLive ? " is-live" : ""
                            }${aiSending ? " is-busy" : ""}`}
                        >
                          <span className="ai-glow" aria-hidden="true" />
                          <span className="ai-ring" aria-hidden="true" />

                          <div className="ai-composer">
                            <textarea
                              ref={aiTextareaRef}
                              className="ai-input"
                              rows={1}
                              value={aiDraft}
                              onChange={(event) =>
                                setAiDraft(event.target.value)
                              }
                              onKeyDown={aiHandleKeyDown}
                              placeholder="Ask LearnMate AI"
                              aria-label="Message LearnMate AI"
                              aria-busy={aiSending}
                              enterKeyHint="send"
                            />

                            <button
                              type="submit"
                              className={
                                aiSending ? "ai-send is-busy" : "ai-send"
                              }
                              aria-label={
                                aiSending
                                  ? "LearnMate AI is responding"
                                  : "Send message"
                              }
                              disabled={aiSending || !aiDraft.trim()}
                            >
                              {aiSending ? (
                                <span
                                  className="ai-spinner"
                                  aria-hidden="true"
                                />
                              ) : (
                                <svg
                                  viewBox="0 0 24 24"
                                  width="20"
                                  height="20"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M12 19V5M5 12l7-7 7 7" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="ai-footnote">
                          LearnMate AI can make mistakes. Double-check
                          important answers.
                        </p>
                      </form>
                    </div>

                    <div className="ai-chat-spacer" aria-hidden="true" />
                  </div>
                </div>
              </section>
            )}

            {/* ==================================================
                MY COURSES
            ================================================== */}

            {activeSection === "courses" && (
              <section
                className="courses-page"
                aria-label="My Courses"
              >
                {selectedCourseId && selectedCourse && !selectedChapter && !addOpen && !addClosing && (
                  <section className="chapter-page courses-content courses-content-visible">
                    <div className="courses-heading-row">
                      <div className="courses-heading-copy"><button type="button" className="back-link" onClick={() => setSelectedCourseId(null)}>← My Courses</button><h1 className="h1">{selectedCourse.class} · {selectedCourse.subject}</h1><p className="sub">Choose a chapter to start learning.</p></div>
                      <span className="course-status">{selectedCourse.progress}% complete</span>
                    </div>
                    {selectedCourseChapters.length ? (
                      <div className="chapter-list">
                        {Array.from(new Set(selectedCourseChapters.map(ch => ch.section || "Chapters"))).map(section => (
                          <div className="chapter-group" key={section}>
                            {section !== "Chapters" && <h2>{section}</h2>}
                            <div className="chapter-grid">
                              {selectedCourseChapters.filter(ch => (ch.section || "Chapters") === section).map((chapter, index) => (
                                <button type="button" className="chapter-card" key={`${section}-${chapter.title}-${index}`} onClick={() => setSelectedChapter(chapter)}>
                                  <span className="chapter-number">{selectedCourseChapters.indexOf(chapter) + 1}</span><span className="chapter-copy"><b>{chapter.title}</b><small>Video lesson</small></span><span className="chapter-arrow">→</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <div className="courses-empty"><strong>Chapters are not configured yet</strong><span>The curriculum list for this subject is not available in Mark 3.</span></div>}
                  </section>
                )}

                {selectedCourseId && selectedCourse && selectedChapter && !addOpen && !addClosing && (
                  <section className="lesson-page courses-content courses-content-visible">
                    <div className="courses-heading-row">
                      <div className="courses-heading-copy"><button type="button" className="back-link" onClick={() => setSelectedChapter(null)}>← Back to chapters</button><h1 className="h1">{selectedChapter.title}</h1><p className="sub">{selectedCourse.class} · {selectedCourse.subject}</p></div>
                    </div>
                    <div className="lesson-layout">
                      <div className="lesson-player">
                        {(() => {
                          const lessonKey = `${getCurriculumKey(selectedCourse)}|${selectedChapter.section ?? ""}|${selectedChapter.title}`;
                          const videoSrc = resolveChapterVideo(lessonKey);
                          if (!videoSrc) {
                            return (
                              <>
                                <img className="lesson-fallback" src="/404.jpg" alt="Video unavailable for this chapter" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                <div className="lesson-empty-note">The video for this chapter has not been added yet.</div>
                              </>
                            );
                          }
                          const yt = videoSrc.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                          if (yt) {
                            return (
                              <LessonVideo
                                videoId={yt[1]}
                                chapterKey={lessonKey}
                                initialSeconds={lmVideoProgress[lessonKey]?.watched ?? 0}
                                onProgress={(percent, watched, duration) => {
                                  setLmVideoProgress((prev) => ({
                                    ...prev,
                                    [lessonKey]: { percent, watched, duration },
                                  }));
                                }}
                              />
                            );
                          }
                          return <video controls playsInline src={videoSrc} />;
                        })()}
                      </div>
                      <aside className="lesson-details"><span className="lesson-eyebrow">NOW LEARNING</span><h2>{selectedChapter.title}</h2><p>Follow the lesson at your own pace.</p>{(() => {
                        const k = `${getCurriculumKey(selectedCourse)}|${selectedChapter.section ?? ""}|${selectedChapter.title}`;
                        const p = lmVideoProgress[k]?.percent ?? 0;
                        return p > 0 ? (<p className="lm-lesson-watched">Watched {p}% of this video</p>) : null;
                      })()}<button type="button" className="btn-brown" onClick={() => setSelectedChapter(null)}>All Chapters <span>→</span></button></aside>
                    </div>
                  </section>
                )}

                {!selectedCourseId && !selectedChapter && !addOpen && !addClosing && (
                  <div
                    className={
                      coursesContentReady
                        ? "courses-content courses-content-visible"
                        : "courses-content"
                    }
                  >
                    <div className="courses-heading-row">
                      <div className="courses-heading-copy course-heading-fade">
                        <h1 className="h1">My Courses</h1>
                        <p className="sub">Your learning space, organized your way.</p>
                      </div>

                      <button
                        type="button"
                        className="btn-brown add-course-top"
                        onClick={openAddCourse}
                      >
                        + Add Course
                      </button>
                    </div>

                    <div className="course-tabs" role="tablist" aria-label="Course status">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={courseTab === "ongoing"}
                        className={`course-tab ${courseTab === "ongoing" ? "active" : ""}`}
                        onClick={() => setCourseTab("ongoing")}
                      >
                        Ongoing
                        <span>{ongoingCourses.length}</span>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={courseTab === "completed"}
                        className={`course-tab ${courseTab === "completed" ? "active" : ""}`}
                        onClick={() => setCourseTab("completed")}
                      >
                        Completed
                        <span>{completedCourses.length}</span>
                      </button>
                    </div>

                    <section
                      key={courseTab}
                      className="courses-section course-tab-content"
                    >
                      <div className="courses-section-head">
                        <div>
                          <h2>{courseTab === "ongoing" ? " Ongoing" : " Completed"}</h2>
                          <p>
                            {courseTab === "ongoing"
                              ? "Courses you are currently learning"
                              : "Courses you have fully completed"}
                          </p>
                        </div>
                        <span>{courseTab === "ongoing" ? "0–99%" : "100%"}</span>
                      </div>

                      {courseLoading ? (
                        <div className="courses-empty courses-loading-state">
                          <div className="course-loader-orb" aria-hidden="true" />
                          <span>Loading your courses...</span>
                        </div>
                      ) : displayedCourses.length === 0 ? (
                        <div className="courses-empty">
                          <strong>Nothing here yet</strong>
                          <span>
                            {courseTab === "ongoing"
                              ? "No ongoing courses yet."
                              : "No completed courses yet."}
                          </span>
                        </div>
                      ) : (
                        <div className="courses-list">
                          {displayedCourses.map((course) => {
                            const selected = selectedCourseIds.includes(course.id);

                            return (
                              <article
                                key={course.id}
                                className={`course-card ${courseDeleteMode && selected ? "course-card-selected" : ""}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  if (courseDeleteMode) {
                                    toggleCourseSelection(course.id);
                                    return;
                                  }

                                  setSelectedCourseId(course.id);
                                  setSelectedChapter(null);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();

                                    if (courseDeleteMode) {
                                      toggleCourseSelection(course.id);
                                      return;
                                    }

                                    setSelectedCourseId(course.id);
                                    setSelectedChapter(null);
                                  }
                                }}
                              >
                                <div className="course-card-top">
                                  <div className="course-subject-icon">
                                    {course.progress >= 100 ? "✓" : getSubjectIcon(course.subject)}
                                  </div>

                                  <div className="course-card-title">
                                    <h3>
                                      {course.subject}
                                      {course.mathVariant && ` (${course.mathVariant})`}
                                    </h3>
                                    <p>
                                      {course.class}
                                      {course.stream && ` · ${course.stream}`}
                                    </p>
                                  </div>

                                  {courseDeleteMode ? (
                                    <span
                                      className={`course-select-circle ${selected ? "selected" : ""}`}
                                      aria-label={selected ? "Selected" : "Not selected"}
                                    >
                                      {selected ? "✓" : ""}
                                    </span>
                                  ) : (
                                    <span className="course-status">
                                      {course.progress >= 100 ? "Completed" : "Ongoing"}
                                    </span>
                                  )}
                                </div>

                                <div className="course-progress">
                                  <div className="course-progress-row">
                                    <span>Progress</span>
                                    <b>{course.progress}%</b>
                                  </div>
                                  <div className="course-progress-track">
                                    <i style={{ width: `${course.progress}%` }} />
                                  </div>
                                </div>

                                <div className="course-card-bottom">
                                  <span>
                                    {course.stream || course.class}
                                  </span>

                                  {courseDeleteMode && (
                                    <button
                                      type="button"
                                      className={`course-open-btn ${selected ? "selected" : ""}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleCourseSelection(course.id);
                                      }}
                                    >
                                      {selected ? "Selected ✓" : "Select"}
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <div
                      className={
                        courseDeleteMode
                          ? "course-danger-actions delete-mode"
                          : "course-danger-actions"
                      }
                    >
                      {courseDeleteMode && (
                        <button
                          type="button"
                          className="course-delete-cancel"
                          onClick={cancelCourseDeleteMode}
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        type="button"
                        className="course-delete-fab"
                        onClick={
                          courseDeleteMode
                            ? requestDeleteSelectedCourses
                            : startCourseDeleteMode
                        }
                        disabled={courseDeleteLoading}
                        aria-label={
                          courseDeleteMode
                            ? "Delete selected courses"
                            : "Delete courses"
                        }
                        title={
                          courseDeleteMode
                            ? "Delete selected courses"
                            : "Delete courses"
                        }
                      >
                        <img src="/bin.png" alt="" aria-hidden="true" />
                      </button>
                    </div>
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
                      <h1 className="h1">Add a new course</h1>
                    </div>

                    <div
                      className={
                        addControlsReady
                          ? "add-course-controls add-course-controls-visible"
                          : "add-course-controls"
                      }
                    >
                      <section className="course-selector-section course-step-fade">
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
                                onClick={() => {
                                  setSelectedClass(item);
                                  setSelectedStream(null);
                                  setSelectedSubject(null);
                                  setSelectedCompulsorySubject(null);
                                  setSelectedMathVariant(null);
                                }}
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

                      {selectedClass && (
                        <>
                          {getClassNumber(selectedClass)! >= 11 && (
                            <section
                              key={`stream-${selectedClass}`}
                              className="course-selector-section course-step-fade"
                            >
                              <div className="course-selector-title">
                                <h3>Select your stream</h3>

                                <span>
                                  {selectedStream || "Choose one"}
                                </span>
                              </div>

                              <div className="subject-grid">
                                {STREAMS.map((stream) => (
                                  <button
                                    key={stream}
                                    type="button"
                                    className={
                                      selectedStream === stream
                                        ? "subject-option selected"
                                        : "subject-option"
                                    }
                                    onClick={() => {
                                      setSelectedStream(stream);
                                      setSelectedSubject(null);
                                      setSelectedCompulsorySubject(null);
                                      setSelectedMathVariant(null);
                                    }}
                                  >
                                    <span>
                                      {stream === "Science"
                                        ? "⚗"
                                        : stream === "Commerce"
                                          ? "₹"
                                          : "◫"}
                                    </span>

                                    <b>{stream}</b>

                                    {selectedStream === stream && (
                                      <i>✓</i>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </section>
                          )}

                          {getClassNumber(selectedClass)! >= 11 && (
                            <section
                              key={`compulsory-${selectedClass}`}
                              className="course-selector-section course-step-fade"
                            >
                              <div className="course-selector-title">
                                <h3>Compulsory Subjects</h3>

                                <span>
                                  {selectedCompulsorySubject || "Choose one"}
                                </span>
                              </div>

                              <div className="subject-grid compulsory-grid">
                                <button
                                  type="button"
                                  className={
                                    selectedCompulsorySubject === "English"
                                      ? "subject-option selected"
                                      : "subject-option"
                                  }
                                  onClick={() => {
                                    setSelectedCompulsorySubject(
                                      selectedCompulsorySubject === "English"
                                        ? null
                                        : "English",
                                    );
                                    setSelectedSubject(null);
                                    setSelectedMathVariant(null);
                                  }}
                                >
                                  <span>A</span>
                                  <b>English</b>
                                  {selectedCompulsorySubject === "English" && (
                                    <i>✓</i>
                                  )}
                                </button>
                              </div>
                            </section>
                          )}

                          {getSubjectsForSelection(
                            getClassNumber(selectedClass),
                            selectedStream,
                          ).length > 0 && (
                              <section
                                key={`subjects-${selectedClass}-${selectedStream || "base"}`}
                                className="course-selector-section course-step-fade"
                              >
                                <div className="course-selector-title">
                                  <h3>Select your subject</h3>

                                  <span>
                                    {selectedSubject || "Choose one"}
                                  </span>
                                </div>

                                <div className="subject-grid">
                                  {getSubjectsForSelection(
                                    getClassNumber(selectedClass),
                                    selectedStream,
                                  ).map((subject) => (
                                    <button
                                      key={subject}
                                      type="button"
                                      className={
                                        selectedSubject === subject
                                          ? "subject-option selected"
                                          : "subject-option"
                                      }
                                      onClick={() => {
                                        setSelectedSubject(
                                          selectedSubject === subject
                                            ? null
                                            : subject,
                                        );
                                        setSelectedCompulsorySubject(null);

                                        if (
                                          subject !== "Mathematics"
                                        ) {
                                          setSelectedMathVariant(null);
                                        }
                                      }}
                                    >
                                      <span>
                                        {getSubjectIcon(subject)}
                                      </span>

                                      <b>{subject}</b>

                                      {selectedSubject === subject && (
                                        <i>✓</i>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </section>
                            )}

                          {getClassNumber(selectedClass)! >= 11 &&
                            selectedSubject === "Mathematics" && (
                              <section
                                key={`math-${selectedClass}-${selectedStream}`}
                                className="course-selector-section course-step-fade"
                              >
                                <div className="course-selector-title">
                                  <h3>Mathematics type</h3>

                                  <span>
                                    {selectedMathVariant ||
                                      "Choose one"}
                                  </span>
                                </div>

                                <div className="subject-grid">
                                  {(["Pure", "Applied"] as const).map(
                                    (variant) => (
                                      <button
                                        key={variant}
                                        type="button"
                                        className={
                                          selectedMathVariant === variant
                                            ? "subject-option selected"
                                            : "subject-option"
                                        }
                                        onClick={() =>
                                          setSelectedMathVariant(
                                            variant,
                                          )
                                        }
                                      >
                                        <span>∑</span>

                                        <b>{variant}</b>

                                        {selectedMathVariant ===
                                          variant && <i>✓</i>}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </section>
                            )}
                        </>
                      )}

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
                            addClosing || courseSaving
                          }
                        >
                          {courseSaving
                            ? "Saving..."
                            : "Add Course"}
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
            {activeSection === "tests" && (
              <section className="lm-section courses-content courses-content-visible">
                {lmTestQuestions ? (
                  <TestTaker
                    key={lmTestQuestions.testId}
                    testTitle={lmTestQuestions.testTitle}
                    chapterTitle={lmTestQuestions.chapterTitle}
                    durationMinutes={lmTestQuestions.durationMinutes}
                    questions={lmTestQuestions.questions}
                    onSubmit={lmSubmitTest}
                    onTimeWarning={(m) => showToast(m, "success")}
                    onExit={() => {
                      setLmTestQuestions(null);
                      setLmTestView("list");
                      void lmRefreshUpcoming();
                      void lmRefreshCompleted();
                    }}
                  />
                ) : (
                  <>
                    <div className="courses-heading-row">
                      <div className="courses-heading-copy">
                        <h1 className="h1">Tests</h1>
                        <p className="sub">One test per chapter: 30 questions, 30 marks, pass at 18. If you leave a test, it restarts from the beginning and nothing is recorded until you submit.</p>
                      </div>
                      {lmTestView === "list" && (
                        <button
                          type="button"
                          className="btn-brown add-course-top"
                          onClick={() => setLmTestView("pick-course")}
                        >
                          + Add test
                        </button>
                      )}
                    </div>
                    {lmTestView === "pick-course" ? (
                      <>
                        <button
                          type="button"
                          className="btn-cream"
                          onClick={() => setLmTestView("list")}
                        >
                          ← Back to tests
                        </button>
                        <div className="courses-section-head">
                          <div>
                            <h2>Pick a course</h2>
                            <p>Choose one of your ongoing courses</p>
                          </div>
                        </div>
                        {lmOngoingCourses.length === 0 ? (
                          <>
                            <p className="sub">
                              {courses.length === 0
                                ? "You don't have any courses right now, so you can add a course."
                                : "All your courses are completed. Start a new course to take its chapter tests."}
                            </p>
                            <button
                              type="button"
                              className="btn-brown"
                              onClick={() => {
                                setActiveSection("courses");
                                sessionStorage.setItem("learnmate-active-section", "courses");
                                openAddCourse();
                              }}
                            >
                              + Add a course
                            </button>
                          </>
                        ) : (
                          <div className="courses-list">
                            {lmOngoingCourses.map((course) => (
                              <article
                                key={course.id}
                                className="course-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setLmTestCourseId(course.id);
                                  setLmTestChapterIndex("");
                                  setLmTestView("pick-chapter");
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setLmTestCourseId(course.id);
                                    setLmTestChapterIndex("");
                                    setLmTestView("pick-chapter");
                                  }
                                }}
                              >
                                <div className="course-card-top">
                                  <div className="course-subject-icon">
                                    {getSubjectIcon(course.subject)}
                                  </div>
                                  <div className="course-card-title">
                                    <h3>
                                      {course.subject}
                                      {course.mathVariant && ` (${course.mathVariant})`}
                                    </h3>
                                    <p>
                                      {course.class}
                                      {course.stream && ` · ${course.stream}`}
                                    </p>
                                  </div>
                                  <span className="course-status">Ongoing</span>
                                </div>
                                <div className="course-progress">
                                  <div className="course-progress-row">
                                    <span>Progress</span>
                                    <b>{course.progress}%</b>
                                  </div>
                                  <div className="course-progress-track">
                                    <i style={{ width: `${course.progress}%` }} />
                                  </div>
                                </div>
                                <div className="course-card-bottom">
                                  <span>
                                    {course.stream || course.class}
                                  </span>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </>
                    ) : lmTestView === "pick-chapter" ? (
                      <>
                        <button
                          type="button"
                          className="btn-cream"
                          onClick={() => {
                            setLmTestChapterIndex("");
                            setLmTestView("pick-course");
                          }}
                        >
                          ← Back to courses
                        </button>
                        <div className="courses-section-head">
                          <div>
                            <h2>{lmTestCourse ? `${lmTestCourse.class} · ${lmTestCourse.subject}` : "Pick a chapter"}</h2>
                            <p>Choose a chapter to test yourself on</p>
                          </div>
                        </div>
                        {lmTestResolving ? (
                          <div className="lm-spinner-wrap" role="status" aria-label="Loading test">
                            <span className="lm-spinner" aria-hidden="true" />
                          </div>
                        ) : lmTestError ? (
                          <>
                            <p className="lm-error" role="alert">{lmTestError}</p>
                            <button
                              type="button"
                              className="btn-cream"
                              onClick={() => setLmTestChapterIndex("")}
                            >
                              Choose another chapter
                            </button>
                          </>
                        ) : lmTestResolve && !lmTestResolve.test ? (
                          <>
                            <div className="empty-section">This chapter&apos;s test hasn&apos;t been imported yet. Run the import, then refresh this page.</div>
                            <button
                              type="button"
                              className="btn-cream"
                              onClick={() => setLmTestChapterIndex("")}
                            >
                              Choose another chapter
                            </button>
                          </>
                        ) : (
                          <div className="lm-chapter-list">
                            {lmTestChapters.map((chapter, index) => (
                              <button
                                key={`${chapter.section ?? ""}|${chapter.title}`}
                                type="button"
                                className={`lm-chapter-row ${String(index) === lmTestChapterIndex ? "is-selected" : ""}`}
                                onClick={() => {
                                  lmChapterPickedRef.current = true;
                                  setLmTestChapterIndex(String(index));
                                }}
                              >
                                <span className="lm-chapter-row-title">
                                  {chapter.section
                                    ? `${chapter.section} — ${chapter.title}`
                                    : chapter.title}
                                </span>
                                <span aria-hidden="true">→</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : lmTestView === "type-select" && lmTestResolve?.test && lmTestChapter ? (
                      <TestTypeSelect
                        testTitle={lmTestResolve.test.title}
                        chapterTitle={lmTestChapter.title}
                        onDoNow={() => {
                          void lmStartTest();
                        }}
                        onSchedule={() => {
                          setLmTestView("schedule");
                        }}
                        onBack={() => setLmTestView("pick-chapter")}
                      />
                    ) : lmTestView === "schedule" && lmTestResolve?.test && lmTestChapter ? (
                      <ScheduleTestForm
                        onCreate={async (iso) => {
                          await lmCreateTestSchedule(iso);
                          setLmTestTab("upcoming");
                          setLmTestView("list");
                          void lmRefreshNotifs();
                        }}
                        onBack={() => setLmTestView("type-select")}
                      />
                    ) : (
                      <>
                        <div className="course-tabs" role="tablist" aria-label="Tests views">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={lmTestTab === "upcoming"}
                            className={`course-tab ${lmTestTab === "upcoming" ? "active" : ""}`}
                            onClick={() => setLmTestTab("upcoming")}
                          >
                            Upcoming
                            <span>{lmUpcomingLive.length}</span>
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={lmTestTab === "completed"}
                            className={`course-tab ${lmTestTab === "completed" ? "active" : ""}`}
                            onClick={() => setLmTestTab("completed")}
                          >
                            Completed
                            <span>{lmCompleted.length}</span>
                          </button>
                        </div>
                        {lmTestTab === "upcoming" ? (
                          <>
                            <div className="courses-section-head">
                              <div>
                                <h2>Upcoming tests</h2>
                                <p>Tests you have scheduled and can still take</p>
                              </div>
                            </div>
                            {lmUpcomingLoading ? (
                              <div className="lm-spinner-wrap" role="status" aria-label="Loading upcoming tests">
                                <span className="lm-spinner" aria-hidden="true" />
                              </div>
                            ) : lmUpcomingLive.length === 0 && lmUpcomingMissed.length === 0 ? (
                              <div className="empty-section">No tests scheduled yet. Press “Add test”, pick a course and chapter, then “Schedule the test”.</div>
                            ) : (
                              <div className="lm-upcoming-list">
                                {lmUpcomingLive.map((s) => {
                                  const phase = lmSchedulePhase(s); const startMs = new Date(s.scheduledAtISO).getTime(); const endMs = s.windowEndsAtISO ? new Date(s.windowEndsAtISO).getTime() : startMs + 30 * 60 * 1000; return (
                                    <div key={s.id} className="lm-upcoming-card">
                                      <div>
                                        <p className="lm-upcoming-title">
                                          {s.chapterTitle}
                                          {s.section ? ` — ${s.section}` : ""}
                                        </p>
                                        <p className="lm-upcoming-meta">
                                          <span>{new Date(s.scheduledAtISO).toLocaleString()}</span>
                                          <span
                                            className={`lm-upcoming-pill ${phase === "open" ? "is-available" : "is-scheduled"}`}
                                          >
                                            {phase === "open" ? "Open now" : "Scheduled"}
                                          </span>
                                          <span>
                                            {phase === "open"
                                              ? `Start by ${new Date(endMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                                              : `Opens ${new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                                          </span>
                                        </p>
                                      </div>
                                      <div className="lm-upcoming-actions">
                                        <button
                                          type="button"
                                          className="btn-brown"
                                          disabled={phase === "upcoming"}
                                          onClick={() => lmStartUpcoming(s)}
                                        >
                                          Start test
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-cream"
                                          onClick={async () => {
                                            await lmCancelTestSchedule(s.id);
                                            await lmRefreshUpcoming();
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {!lmUpcomingLoading && lmUpcomingMissed.length > 0 && (
                              <>
                                <div className="courses-section-head">
                                  <div>
                                    <h2>Missed tests</h2>
                                    <p>Their start windows have closed — schedule them again to take them</p>
                                  </div>
                                </div>
                                <div className="lm-upcoming-list">
                                  {lmUpcomingMissed.map((s) => (
                                    <div key={s.id} className="lm-upcoming-card">
                                      <div>
                                        <p className="lm-upcoming-title">
                                          {s.chapterTitle}
                                          {s.section ? ` — ${s.section}` : ""}
                                        </p>
                                        <p className="lm-upcoming-meta">
                                          <span>{new Date(s.scheduledAtISO).toLocaleString()}</span>
                                          <span className="lm-upcoming-pill is-missed">Missed</span>
                                        </p>
                                      </div>
                                      <div className="lm-upcoming-actions">
                                        <button
                                          type="button"
                                          className="btn-brown"
                                          onClick={() => setLmTestView("pick-course")}
                                        >
                                          Schedule again
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="courses-section-head">
                              <div>
                                <h2>Completed tests</h2>
                                <p>Tests you have submitted</p>
                              </div>
                            </div>
                            {lmCompletedLoading ? (
                              <div className="lm-spinner-wrap" role="status" aria-label="Loading completed tests">
                                <span className="lm-spinner" aria-hidden="true" />
                              </div>
                            ) : lmCompleted.length === 0 ? (
                              <div className="empty-section">No completed tests yet. Finish a test and it will show up here.</div>
                            ) : (
                              <div className="lm-upcoming-list">
                                {lmCompleted.map((t) => (
                                  <div key={t.id} className="lm-upcoming-card">
                                    <div>
                                      <p className="lm-upcoming-title">
                                        {t.chapterTitle}
                                        {t.section ? ` — ${t.section}` : ""}
                                      </p>
                                      <p className="lm-upcoming-meta">
                                        <span>{new Date(t.completedAt).toLocaleString()}</span>
                                        <span
                                          className={`lm-upcoming-pill ${t.passed ? "is-available" : "is-scheduled"}`}
                                        >
                                          {t.passed ? "Passed" : "Not passed"}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="lm-upcoming-actions">
                                      <span className="lm-completed-score">{t.score} / {t.totalMarks}</span>
                                      {lmConfirmDeleteAttemptId === t.id ? (
                                        <>
                                          <button
                                            type="button"
                                            className="btn-brown"
                                            onClick={async () => {
                                              try {
                                                await lmDeleteCompleted(t.id);
                                              } catch (err) {
                                                showToast(
                                                  err instanceof Error
                                                    ? err.message
                                                    : "Could not delete this test record.",
                                                  "error",
                                                );
                                              }
                                            }}
                                          >
                                            Yes, delete
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-cream"
                                            onClick={() => setLmConfirmDeleteAttemptId(null)}
                                          >
                                            Keep it
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn-cream"
                                          onClick={() => setLmConfirmDeleteAttemptId(t.id)}
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            {activeSection === "quizzes" && (
              <section className="lm-section courses-content courses-content-visible">
                <div className="courses-heading-row">
                  <div className="courses-heading-copy">
                    <h1 className="h1">Quizzes</h1>
                    <p className="sub">Practice quizzes at 10, 30, 50, or custom marks. Quiz attempts are recorded when you submit.</p>
                  </div>
                </div>
                {courses.length === 0 ? (
                  <div className="empty-section">Add a course first, then come back here to practise its chapters.</div>
                ) : (
                  <>
                    <div className="lm-picker-row">
                      <label className="lm-picker-label">
                        Course
                        <select
                          value={lmQuizCourseId}
                          onChange={(e) => {
                            setLmQuizCourseId(e.target.value);
                            setLmQuizChapterIndex("");
                            setLmQuizResolve(null);
                            lmQuizIdRef.current = null;
                            setLmQuizQuestions([]);
                          }}
                        >
                          <option value="">Choose a course…</option>
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.class} · {course.subject}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="lm-picker-label">
                        Chapter
                        <select
                          value={lmQuizChapterIndex}
                          disabled={!lmQuizCourse}
                          onChange={(e) => {
                            setLmQuizChapterIndex(e.target.value);
                            lmQuizIdRef.current = null;
                            setLmQuizQuestions([]);
                          }}
                        >
                          <option value="">Choose a chapter…</option>
                          {lmQuizChapters.map((chapter, index) => (
                            <option
                              key={`${chapter.section ?? ""}|${chapter.title}`}
                              value={String(index)}
                            >
                              {chapter.section
                                ? `${chapter.section} — ${chapter.title}`
                                : chapter.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {lmQuizResolving && (
                      <p className="sub">Loading chapter…</p>
                    )}
                    {lmQuizError && (
                      <p className="lm-error" role="alert">{lmQuizError}</p>
                    )}
                    {lmQuizResolve && lmQuizChapter && (
                      <QuizTaker
                        key={`${lmQuizCourseId}:${lmQuizChapterIndex}`}
                        chapterTitle={lmQuizChapter.title}
                        onGenerate={lmGenerateQuiz}
                        onSubmit={lmSubmitQuiz}
                        hidePassFail
                        onExit={() => {
                          lmQuizIdRef.current = null;
                          setLmQuizQuestions([]);
                        }}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {activeSection === "milestones" && (
              <section className="lm-section courses-content courses-content-visible">
                <div className="courses-heading-row">
                  <div className="courses-heading-copy">
                    <h1 className="h1">Milestones</h1>
                    <p className="sub">One path per ongoing course. Every milestone is a chapter, in order — and a milestone lights up once you have watched its video.</p>
                  </div>
                </div>
                {lmOngoingCourses.length === 0 ? (
                  <div className="empty-section">No ongoing courses yet. Add a course, and its chapter path will appear here.</div>
                ) : (
                  <>
                    <div className="lm-msdd">
                      <span className="lm-msdd-label">Course</span>
                      <div className="lm-msdd-wrap">
                        <button
                          type="button"
                          className="lm-msdd-btn"
                          aria-haspopup="listbox"
                          aria-expanded={lmMsDropdownOpen}
                          onClick={() => setLmMsDropdownOpen((o) => !o)}
                        >
                          <span className="lm-msdd-btn-text">
                            {lmMilestoneCourse
                              ? `${lmMilestoneCourse.class} · ${lmMilestoneCourse.subject}`
                              : "Choose a course…"}
                          </span>
                          {lmMilestoneCourse && (
                            <span className="lm-msdd-btn-pct">
                              {lmMilestoneCourse.progress}%
                            </span>
                          )}
                          <span
                            className={`lm-msdd-chevron${lmMsDropdownOpen ? " open" : ""}`}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </button>
                        {lmMsDropdownOpen && (
                          <>
                            <button
                              type="button"
                              className="lm-msdd-scrim"
                              aria-hidden="true"
                              tabIndex={-1}
                              onClick={() => setLmMsDropdownOpen(false)}
                            />
                            <ul
                              className="lm-msdd-list"
                              role="listbox"
                              aria-label="Choose a course"
                            >
                              {lmOngoingCourses.map((course) => (
                                <li key={course.id}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={
                                      course.id === lmMilestoneCourseId
                                    }
                                    className={`lm-msdd-item${course.id === lmMilestoneCourseId ? " selected" : ""}`}
                                    onClick={() => {
                                      setLmMilestoneCourseId(course.id);
                                      setLmMilestoneNotice(null);
                                      setLmMsDropdownOpen(false);
                                    }}
                                  >
                                    <span className="lm-msdd-item-main">
                                      {course.class} · {course.subject}
                                      {course.mathVariant
                                        ? ` (${course.mathVariant})`
                                        : ""}
                                    </span>
                                    <span className="lm-msdd-item-bar">
                                      <i
                                        style={{
                                          width: `${course.progress}%`,
                                        }}
                                      />
                                    </span>
                                    <span className="lm-msdd-item-pct">
                                      {course.progress}%
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                    {lmMilestoneNotice && (
                      <p className="lm-error" role="alert">{lmMilestoneNotice}</p>
                    )}
                    {lmMilestoneCourse && (
                      <MilestonePath
                        courseTitle={`${lmMilestoneCourse.class} · ${lmMilestoneCourse.subject}`}
                        chapters={lmMilestoneChapters}
                        onWatchVideo={(chapterId) =>
                          lmHandleMilestoneWatch(lmMilestoneCourse, chapterId)
                        }
                        loading={lmMilestoneLoading}
                        error={lmMilestoneError}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {activeSection === "analytics" && (
              <section className="lm-an reveal">
                <h1>Analytics</h1>
                <p className="sub">
                  Your learning at a glance — see how your tests,
                  videos and study time are adding up.
                </p>

                {!lmAnShow ? (
                  <div className="lm-spinner-wrap">
                    <div className="lm-spinner" />
                    <p>Loading your analytics…</p>
                  </div>
                ) : (
                  <>
                    <div className="lm-an-stats">
                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "0ms" }}
                      >
                        <div className="lm-an-k">Overall progress</div>
                        <div className="lm-an-v">
                          {Math.round(lmAnOverallAnim)}%
                        </div>
                        <div className="lm-an-d">
                          {mostCompletedCourse
                            ? `Best course: ${mostCompletedCourse.title}`
                            : "Add a course to begin"}
                        </div>
                      </div>

                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "60ms" }}
                      >
                        <div className="lm-an-k">Study streak</div>
                        <div className="lm-an-v">
                          {Math.round(lmAnStreakAnim)}{" "}
                          <small>days</small>
                        </div>
                        <div className="lm-an-d">
                          {lmAnBestStreak > 0
                            ? `Your best: ${lmAnBestStreak} days`
                            : "Study today to start a streak"}
                        </div>
                      </div>

                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "120ms" }}
                      >
                        <div className="lm-an-k">Study time</div>
                        <div className="lm-an-v">
                          {formatStudyTime(Math.round(lmAnTimeAnim))}
                        </div>
                        <div className="lm-an-d">
                          {`This week: ${formatStudyTime(weeklyStudySeconds)}`}
                        </div>
                      </div>

                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "180ms" }}
                      >
                        <div className="lm-an-k">Average test score</div>
                        <div className="lm-an-v">
                          {Math.round(lmAnAvgAnim)}
                          <small>/30</small>
                        </div>
                        <div className="lm-an-d">
                          {lmCompleted.length
                            ? `${lmCompleted.length} tests taken · ${lmAnPassedCount} passed`
                            : "No tests taken yet"}
                        </div>
                      </div>
                    </div>

                    <div className="lm-an-grid">
                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "240ms" }}
                      >
                        <h3>Test performance</h3>
                        <p className="lm-an-hint">
                          Your recent test scores — the dashed line is
                          the pass mark (18/30).
                        </p>
                        {lmAnChart.length === 0 ? (
                          <p className="lm-an-empty">
                            Take a test and your score graph will
                            appear here.
                          </p>
                        ) : (
                          <svg
                            className="lm-an-chart"
                            viewBox="0 0 560 190"
                            width="100%"
                            role="img"
                            aria-label="Recent test scores"
                          >
                            <defs>
                              <linearGradient
                                id="lmAnArea"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#E9C689"
                                  stopOpacity=".38"
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#E9C689"
                                  stopOpacity=".02"
                                />
                              </linearGradient>
                            </defs>
                            <line
                              x1="10"
                              y1={lmAnPassY}
                              x2="550"
                              y2={lmAnPassY}
                              stroke="#D92D20"
                              strokeWidth="1.4"
                              strokeDasharray="5 5"
                            />
                            <text
                              x="548"
                              y={lmAnPassY - 8}
                              textAnchor="end"
                              fontSize="11"
                              fontWeight="700"
                              className="lm-an-pass-label"
                              fill="#D92D20"
                            >
                              Pass mark 18
                            </text>
                            {lmAnArea && (
                              <path
                                d={lmAnArea}
                                fill="url(#lmAnArea)"
                                opacity={lmAnT}
                              />
                            )}
                            {lmAnChartPts.length > 1 && (
                              <path
                                d={lmAnLine}
                                fill="none"
                                className="lm-an-line"
                                strokeWidth="2.6"
                                strokeLinecap="round"
                                pathLength={100}
                                strokeDasharray={100}
                                strokeDashoffset={100 * (1 - lmAnT)}
                              />
                            )}
                            {lmAnChartPts.map((p, i) => (
                              <g key={i} opacity={lmAnT}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="5"
                                  className="lm-an-pt"
                                  strokeWidth="2.4"
                                />
                                <text
                                  x={p.x}
                                  y={p.y - 12}
                                  textAnchor="middle"
                                  fontSize="12"
                                  fontWeight="800"
                                  className="lm-an-pt-label"
                                >
                                  {p.score}
                                </text>
                              </g>
                            ))}
                          </svg>
                        )}
                      </div>

                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "300ms" }}
                      >
                        <h3>Topics</h3>
                        <p className="lm-an-hint">
                          From your best attempt in each chapter.
                        </p>
                        {lmAnRanked.length === 0 ? (
                          <p className="lm-an-empty">
                            Take a test and your strong and
                            needs-attention topics will show up here.
                          </p>
                        ) : (
                          <>
                            {lmAnStrong.length > 0 && (
                              <>
                                <div className="lm-an-lbl">
                                  💪 Strong topics
                                </div>
                                {lmAnStrong.map((a) => (
                                  <div
                                    className="lm-an-topic"
                                    key={a.id}
                                  >
                                    <span>{a.chapterTitle}</span>
                                    <span className="lm-an-score">
                                      {a.score}/{a.totalMarks}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}
                            {lmAnWeak.length > 0 && (
                              <>
                                <div className="lm-an-lbl">
                                  🎯 Needs attention
                                </div>
                                {lmAnWeak.map((a) => (
                                  <div
                                    className="lm-an-topic"
                                    key={a.id}
                                  >
                                    <span>{a.chapterTitle}</span>
                                    <span className="lm-an-score">
                                      {a.score}/{a.totalMarks}
                                    </span>
                                  </div>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="lm-an-grid2">
                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "360ms" }}
                      >
                        <h3>Subject progress</h3>
                        <p className="lm-an-hint">
                          How far you have gotten in each subject.
                        </p>
                        {lmAnSubjects.length === 0 ? (
                          <p className="lm-an-empty">
                            Add a course and your subject progress
                            will appear here.
                          </p>
                        ) : (
                          lmAnSubjects.map((s) => (
                            <div
                              className="lm-an-bar-row"
                              key={s.subject}
                            >
                              <span>{s.subject}</span>
                              <div className="lm-an-bar">
                                <i
                                  style={{
                                    width: `${s.pct * lmAnT}%`,
                                  }}
                                />
                              </div>
                              <span className="lm-an-pct">
                                {Math.round(s.pct * lmAnT)}%
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div
                        className="lm-an-card lm-an-blur"
                        style={{ animationDelay: "420ms" }}
                      >
                        <h3>Study this week</h3>
                        <p className="lm-an-hint">
                          Minutes studied each day this week.
                        </p>
                        <div className="lm-an-week">
                          {lmAnWeekDays.map((d) => (
                            <div className="lm-an-wcol" key={d.name}>
                              <span className="lm-an-wmin">
                                {Math.round(d.minutes * lmAnT)}
                              </span>
                              <div
                                className={
                                  d.isToday
                                    ? "lm-an-wbar today"
                                    : "lm-an-wbar"
                                }
                                style={{
                                  height: `${Math.max(
                                    3,
                                    (d.minutes / lmAnWeekMax) *
                                    84 *
                                    lmAnT,
                                  )}px`,
                                }}
                              />
                              <span className="lm-an-wday">
                                {d.name}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="lm-an-wtotal">
                          {`Total: ${Math.round(lmAnWeekTotal * lmAnT)} min this week`}
                        </p>
                      </div>
                    </div>

                    <div
                      className="lm-an-card lm-an-blur"
                      style={{ animationDelay: "480ms" }}
                    >
                      <h3>Recent tests</h3>
                      <p className="lm-an-hint">
                        Your latest results, newest first.
                      </p>
                      {lmCompleted.length === 0 ? (
                        <p className="lm-an-empty">
                          No tests yet — your results will be listed
                          here once you take one.
                        </p>
                      ) : (
                        lmCompleted.slice(0, 5).map((a) => (
                          <div className="lm-an-row" key={a.id}>
                            <span>{a.chapterTitle}</span>
                            <span className="lm-an-sec">
                              {a.section ?? "—"}
                            </span>
                            <span>
                              {new Date(
                                a.completedAt,
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <span className="lm-an-score">
                              {a.score}/{a.totalMarks}
                            </span>
                            <span
                              className={
                                a.passed
                                  ? "lm-an-chip"
                                  : "lm-an-chip fail"
                              }
                            >
                              {a.passed ? "✓ Passed" : "Not passed"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
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

        {courseDeleteConfirmOpen && (
          <div
            className="modal-back open course-delete-back"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCourseDeleteConfirmOpen(false);
              }
            }}
          >
            <div
              className="course-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="course-delete-title"
            >
              <div className="course-delete-icon">!</div>
              <h2 id="course-delete-title">Delete selected courses?</h2>
              <p>
                This will permanently remove {selectedCourseIds.length}{" "}
                {selectedCourseIds.length === 1 ? "course" : "courses"} from your LearnMate account.
              </p>
              <div className="course-delete-modal-actions">
                <button
                  type="button"
                  className="course-delete-cancel"
                  onClick={() => setCourseDeleteConfirmOpen(false)}
                  disabled={courseDeleteLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="course-delete-confirm"
                  onClick={handleDeleteSelectedCourses}
                  disabled={courseDeleteLoading}
                >
                  {courseDeleteLoading ? "Deleting..." : "Delete courses"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPEN-WINDOW TEST PROMPT */}

        {lmOpenPromptItem && (
          <div className="lm-open-prompt-scrim">
            <div
              className="lm-open-prompt-card"
              role="alertdialog"
              aria-modal="true"
              aria-label={lmPromptHeading}
            >
              <p className="lm-open-prompt-title">
                {lmPromptTyped}
                {lmPromptTyped.length < lmPromptHeading.length && (
                  <span className="type-cursor" aria-hidden="true">
                    |
                  </span>
                )}
              </p>

              <p className="lm-open-prompt-sub">
                {lmOpenPromptItem.section
                  ? `${lmOpenPromptItem.section} · `
                  : ""}
                Scheduled for{" "}
                {new Date(
                  lmOpenPromptItem.scheduledAtISO,
                ).toLocaleString()}
                . You can start it until{" "}
                {new Date(
                  lmOpenPromptItem.windowEndsAtISO
                    ? lmOpenPromptItem.windowEndsAtISO
                    : new Date(
                      lmOpenPromptItem.scheduledAtISO,
                    ).getTime() +
                    30 * 60 * 1000,
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                .
              </p>

              <div className="lm-open-prompt-actions reveal">
                <button
                  type="button"
                  className="btn-brown"
                  onClick={lmPromptStart}
                >
                  Start test
                </button>

                <button
                  type="button"
                  className="btn-cream"
                  onClick={() => void lmPromptCancel()}
                >
                  Cancel test
                </button>
              </div>
            </div>
          </div>
        )}

        {lmRedoCourse && (
          <div
            className="lm-redo-scrim"
            role="alertdialog"
            aria-modal="true"
            aria-label="Redo this course"
          >
            <div className="lm-redo-card">
              <h3>Redo this course?</h3>

              <p>
                You have already completed this course:{" "}
                <b>{lmRedoCourse.title}</b>
              </p>

              <p>
                Redoing it resets its progress to the beginning, so you can
                go through it again. Your past test results stay saved.
              </p>

              <div className="lm-redo-actions">
                <button
                  type="button"
                  className="btn-cream"
                  onClick={() => setLmRedoCourse(null)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn-brown"
                  onClick={() => void lmRedoConfirm()}
                >
                  Redo course
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL LOADING OVERLAY */}

        {lmLoadingVisible && (
          <div
            className="lm-loading-overlay"
            role="status"
            aria-live="polite"
            aria-label={lmLoadingMessage}
          >
            <div className="lm-loading-card">
              <span
                className="lm-spinner lm-loading-spinner"
                aria-hidden="true"
              />

              <div className="lm-loading-brand">
                LearnMate
              </div>

              <div className="lm-loading-message">
                {lmLoadingMessage}
              </div>

              <div className="lm-loading-sub">
                Please wait…
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

.lm .side-legal{
  display:flex;
  flex-direction:column;
  gap:2px;
  margin-top:2px;
  padding-top:8px;
  border-top:1px solid rgba(233,198,137,.12)
}

.lm .side-legal a{
  display:flex;
  align-items:center;
  min-height:32px;
  padding:6px 12px;
  border-radius:10px;
  color:var(--sidebar-muted);
  font-size:12.5px;
  font-weight:500;
  text-decoration:none
}

.lm .side-legal a:hover,
.lm .side-legal a:focus-visible{
  color:var(--sidebar-text);
  background:rgba(233,198,137,.1)
}

.lm .side-legal a:focus-visible{
  outline:2px solid rgba(233,198,137,.5);
  outline-offset:-2px
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
  position:relative;
  width:100%;
  min-width:0;
  padding-top:0
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
.lm .course-heading-fade{
  animation:courseHeadingIn .48s cubic-bezier(.22,1,.36,1) both
}

.lm .add-course-heading{
  animation:courseHeadingIn .48s cubic-bezier(.22,1,.36,1) both
}

@keyframes courseHeadingIn{
  from{opacity:0;transform:translateY(8px) scale(.99)}
  to{opacity:1;transform:none}
}

.lm .course-tab-content{
  animation:courseTabFade .42s cubic-bezier(.22,1,.36,1) both
}

@keyframes courseTabFade{
  from{opacity:0;transform:translateY(10px);filter:blur(2px)}
  to{opacity:1;transform:none;filter:none}
}

.lm .course-step-fade{
  animation:courseStepFade .46s cubic-bezier(.22,1,.36,1) both
}

@keyframes courseStepFade{
  from{opacity:0;transform:translateY(12px) scale(.992)}
  to{opacity:1;transform:none}
}

/* ==========================================================
   COURSE SYSTEM — SMOOTH / IPHONE-STYLE INTERACTION
========================================================== */
.lm .courses-page{
  animation:coursePageIn .55s cubic-bezier(.22,1,.36,1) both
}

@keyframes coursePageIn{
  from{opacity:0;transform:translateY(10px) scale(.992)}
  to{opacity:1;transform:none}
}

.lm .courses-heading-row{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:18px;
  margin-bottom:22px
}

.lm .courses-heading-copy .h1{
  margin-bottom:5px
}

.lm .courses-heading-copy .sub{
  margin:0
}

.lm .course-tabs{
  background:color-mix(in srgb,var(--card) 88%,transparent);
  border:1px solid color-mix(in srgb,var(--border) 82%,transparent);
  box-shadow:0 12px 35px rgba(74,30,0,.06), inset 0 1px 0 rgba(255,255,255,.42);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
}

.lm .course-tab{
  transition:transform .28s cubic-bezier(.22,1,.36,1),background .28s ease,box-shadow .28s ease,color .28s ease
}

.lm .course-tab:active{
  transform:scale(.96)
}

.lm .course-tab.active{
  box-shadow:0 7px 20px rgba(122,47,0,.14),inset 0 1px 0 rgba(255,255,255,.34)
}

.lm .courses-section{
  border-radius:24px;
  box-shadow:0 14px 45px rgba(74,30,0,.055);
  overflow:hidden
}

.lm .courses-section-head{
  align-items:center
}

.lm .courses-section-head h2{
  letter-spacing:-.025em
}

.lm .courses-section-head p{
  margin-top:4px;
  color:var(--muted);
  font-size:13px
}

.lm .course-card{
  position:relative;
  overflow:hidden;
  transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s ease,border-color .35s ease,background .35s ease;
  will-change:transform;
}

.lm .course-card::before{
  content:"";
  position:absolute;
  inset:0;
  background:linear-gradient(120deg,rgba(255,255,255,.26),transparent 42%,rgba(233,198,137,.08));
  opacity:0;
  pointer-events:none;
  transition:opacity .35s ease
}

.lm .course-card:hover{
  transform:translateY(-4px);
  box-shadow:0 18px 42px rgba(74,30,0,.10);
  border-color:color-mix(in srgb,var(--cream) 55%,var(--border))
}

.lm .course-card:hover::before{
  opacity:1
}

.lm .course-card:active{
  transform:translateY(-1px) scale(.992);
  transition-duration:.12s
}

.lm .course-card-selected{
  outline:2px solid var(--red);
  outline-offset:2px;
  box-shadow:0 16px 42px rgba(217,45,32,.12)
}

.lm .course-select-circle{
  width:30px;
  height:30px;
  border-radius:50%;
  border:1.5px solid var(--border);
  display:flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  background:color-mix(in srgb,var(--card) 76%,transparent);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.04);
  transition:all .25s cubic-bezier(.22,1,.36,1)
}

.lm .course-select-circle.selected{
  background:var(--red);
  border-color:var(--red);
  color:#fff;
  transform:scale(1.06);
  box-shadow:0 7px 18px rgba(217,45,32,.22)
}

.lm .course-open-btn{
  transition:transform .25s cubic-bezier(.22,1,.36,1),background .25s ease,box-shadow .25s ease
}

.lm .course-open-btn:hover{
  transform:translateX(2px)
}

.lm .course-open-btn:active{
  transform:scale(.95)
}

.lm .course-open-btn.selected{
  background:var(--red);
  color:#fff
}

.lm .course-danger-actions{
  position:sticky;
  bottom:20px;
  z-index:90;
  width:max-content;
  margin-left:auto;
  margin-top:10px;
  margin-bottom:10px;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:9px;
  padding:0;
}
.lm .course-delete-fab{
  width:54px;
  height:54px;
  padding:0;
  border:0;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:#E52B20;
  box-shadow:0 13px 30px rgba(217,45,32,.28),0 4px 12px rgba(40,12,0,.18);
  transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,opacity .2s ease;
}

.lm .course-delete-fab img{
  width:28px;
  height:28px;
  object-fit:contain;
  display:block
}

.lm .course-delete-fab:hover{
  transform:translateY(-3px) scale(1.035);
  box-shadow:0 17px 34px rgba(217,45,32,.34),0 5px 14px rgba(40,12,0,.18)
}

.lm .course-delete-fab:active{
  transform:scale(.91)
}

.lm .course-delete-fab:disabled{
  opacity:.55;
  cursor:not-allowed
}

.lm .course-delete-cancel{
  min-height:38px;
  padding:9px 13px;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--card);
  color:var(--text);
  font-size:12px;
  font-weight:800;
  box-shadow:0 8px 20px rgba(74,30,0,.08);
  transition:transform .25s cubic-bezier(.22,1,.36,1),background .25s ease,box-shadow .25s ease
}

.lm .course-delete-cancel:hover{
  transform:translateY(-2px);
  background:var(--card-2);
  box-shadow:0 11px 24px rgba(74,30,0,.11)
}

.lm .course-delete-cancel:active{
  transform:scale(.95)
}

.lm .course-delete-back{
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  animation:deleteScrimIn .28s ease both
}

@keyframes deleteScrimIn{
  from{opacity:0}
  to{opacity:1}
}

.lm .course-delete-modal{
  width:min(450px,calc(100vw - 32px));
  padding:28px;
  border:1px solid color-mix(in srgb,var(--border) 86%,white);
  border-radius:28px;
  background:color-mix(in srgb,var(--card) 91%,transparent);
  color:var(--text);
  box-shadow:0 35px 100px rgba(45,18,0,.22),inset 0 1px 0 rgba(255,255,255,.48);
  backdrop-filter:blur(26px) saturate(1.1);
  -webkit-backdrop-filter:blur(26px) saturate(1.1);
  animation:deleteModalIn .42s cubic-bezier(.22,1,.36,1) both
}

@keyframes deleteModalIn{
  from{opacity:0;transform:translateY(18px) scale(.94)}
  to{opacity:1;transform:none}
}

.lm .course-delete-icon{
  width:48px;
  height:48px;
  border-radius:16px;
  display:grid;
  place-items:center;
  background:color-mix(in srgb,var(--red) 13%,var(--card));
  border:1px solid color-mix(in srgb,var(--red) 22%,var(--border));
  color:var(--red);
  font-weight:850;
  margin-bottom:18px
}

.lm .course-delete-modal h2{
  margin:0 0 8px;
  font-size:22px;
  letter-spacing:-.025em
}

.lm .course-delete-modal p{
  margin:0;
  color:var(--muted);
  line-height:1.6;
  font-size:14px
}

.lm .course-delete-modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:24px
}

.lm .courses-empty{
  min-height:260px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8px;
  text-align:center;
  padding:35px 20px
}

.lm .courses-empty strong{
  font-size:16px
}

.lm .courses-empty > span{
  color:var(--muted);
  font-size:13px
}

.lm .course-loader-orb{
  width:34px;
  height:34px;
  border-radius:50%;
  border:2px solid var(--border);
  border-top-color:var(--brown);
  animation:courseSpin .8s linear infinite;
  margin-bottom:4px
}

@keyframes courseSpin{
  to{transform:rotate(360deg)}
}

@media(max-width:640px){

  .lm .courses-heading-row{
    align-items:stretch;
    flex-direction:column;
    gap:14px
  }
  .lm .add-course-top{
    width:100%
  }

  .lm .course-danger-actions{
    position:fixed !important;
    right:24px !important;
    bottom:-80px !important;
    left:auto !important;
    top:auto !important;
    z-index:1000 !important;
  }

  .lm .course-delete-fab{
    width:54px;
    height:54px;
  }

  .lm .course-delete-fab img{
    width:25px;
    height:25px
  }

  .lm .course-delete-modal{
    border-radius:24px;
    padding:24px
  }

  .lm .course-delete-modal-actions{
    display:grid;
    grid-template-columns:1fr 1fr
  }

}
  .lm .course-delete-fab img{
    width:25px;
    height:25px
  }

  .lm .course-delete-modal{
    border-radius:24px;
    padding:24px
  }

  .lm .course-delete-modal-actions{
    display:grid;
    grid-template-columns:1fr 1fr
  }
}

@media(prefers-reduced-motion:reduce){
  .lm .courses-page,.lm .course-delete-modal,.lm .course-delete-back,.lm .course-loader-orb{
    animation:none!important
  }

  .lm .course-card,.lm .course-tab,.lm .course-open-btn,.lm .course-delete-fab,.lm .course-delete-cancel{
    transition:none!important
  }
}



/* MARK 3 — course chapters, video lesson and responsive topic summaries */
.lm .overall-course-name{display:block;color:#5c5b58!important;font-weight:600;margin-top:4px;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lm .continue-course .hero-info{min-width:0;flex:1}
.lm .mark3-topic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.lm .topic-result{display:flex;flex-direction:column;gap:7px;padding-top:14px}
.lm .topic-result b{font-size:16px;color:var(--text)}
.lm .topic-result span{font-size:13px;color:var(--muted)}
.lm .topic-result strong{font-size:13px;color:var(--brown)}
.lm .chapter-page,.lm .lesson-page{padding-bottom:36px}
.lm .back-link{border:0;background:transparent;color:var(--text-2);font:inherit;font-size:13px;padding:0 0 14px;cursor:pointer;transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s}
.lm .back-link:hover{opacity:.72;transform:translateX(-2px)}
.lm .chapter-list{display:flex;flex-direction:column;gap:30px;margin-top:26px}
.lm .chapter-group h2{font-size:17px;font-weight:650;margin:0 0 14px;color:var(--text)}
.lm .chapter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.lm .chapter-card{display:flex;align-items:center;gap:14px;text-align:left;width:100%;min-height:84px;padding:17px;border:1px solid var(--border-soft);border-radius:16px;background:var(--card);color:var(--text);cursor:pointer;box-shadow:0 3px 12px rgba(74,30,0,.025);transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s,border-color .24s}
.lm .chapter-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(74,30,0,.08);border-color:var(--cream)}
.lm .chapter-card:active{transform:scale(.985)}
.lm .chapter-number{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:var(--icon-bg);color:var(--brown);font-size:13px;font-weight:700}
.lm .chapter-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:6px}
.lm .chapter-copy b{font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
.lm .chapter-copy small{font-size:12px;color:var(--muted)}
.lm .chapter-arrow{font-size:20px;color:var(--muted)}
.lm .lesson-layout{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(240px,.8fr);gap:24px;margin-top:22px;align-items:start}
.lm .lesson-player{min-width:0;border-radius:20px;overflow:hidden;background:#1b1712;box-shadow:0 14px 42px rgba(45,25,8,.12);aspect-ratio:16/9;position:relative;display:flex;align-items:center;justify-content:center}
.lm .lesson-player video,.lm .lesson-fallback{display:block;width:100%;height:100%;object-fit:contain}
.lm .lesson-fallback{object-fit:cover}
.lm .lesson-empty-note{position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;font-size:12px}
.lm .lesson-details{padding:24px 4px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.lm .lesson-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:700;color:var(--muted)}
.lm .lesson-details h2{font-size:22px;line-height:1.3;margin:0;color:var(--text)}
.lm .lesson-details p{font-size:14px;line-height:1.7;color:var(--muted);margin:0 0 8px}
.lm .lesson-details .btn-brown{display:inline-flex;align-items:center;gap:10px}
@media(max-width:760px){.lm .chapter-grid{grid-template-columns:1fr}.lm .lesson-layout{grid-template-columns:1fr;gap:10px}.lm .lesson-details{padding:14px 2px}.lm .mark3-topic-grid{grid-template-columns:1fr}.lm .continue-course{flex-wrap:wrap}.lm .continue-course .btn-cream{width:100%;justify-content:center}}
@media(prefers-reduced-motion:reduce){.lm .chapter-card,.lm .back-link{transition:none!important}}

/* ==========================================================
   MARK 5 — LEARNMATE AI (DOUBT CLEARER)
   Everything below is namespaced with ai- and only applies
   inside the new workspace.
========================================================== */

.lm .main.ai-mode{
  height:100vh;
  height:100dvh;
  display:flex;
  flex-direction:column;
  padding-bottom:16px;
  overflow:hidden
}

.lm .main.ai-mode > .topbar{
  flex-shrink:0
}

/* ---------- Password gate: glass, depth and restrained parallax ---------- */
.lm .ai-password-stage{
  position:relative; isolation:isolate; flex:1; min-height:0; overflow:hidden;
  display:grid; place-items:center; padding:clamp(18px,4vw,44px);
  border-radius:26px; background:
    radial-gradient(ellipse at 16% 12%,rgba(211,177,132,.20),transparent 38%),
    radial-gradient(ellipse at 86% 84%,rgba(156,119,82,.14),transparent 36%),
    linear-gradient(145deg,rgba(255,252,246,.72),rgba(240,226,207,.38));
}
[data-theme="dark"] .lm .ai-password-stage{
  background:radial-gradient(ellipse at 16% 12%,rgba(172,126,78,.17),transparent 38%),radial-gradient(ellipse at 86% 84%,rgba(126,91,58,.19),transparent 36%),linear-gradient(145deg,rgba(35,29,23,.82),rgba(25,22,19,.65));
}
.lm .ai-gate-orb{position:absolute;z-index:-1;pointer-events:none;border-radius:50%;filter:blur(1px);opacity:.58;animation:aiGateFloat 10s ease-in-out infinite alternate}
.lm .ai-gate-orb--one{width:clamp(170px,24vw,330px);aspect-ratio:1;top:7%;left:8%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.86),rgba(196,157,112,.20) 55%,transparent 72%)}
.lm .ai-gate-orb--two{width:clamp(220px,28vw,390px);aspect-ratio:1;right:5%;bottom:1%;animation-delay:-4s;background:radial-gradient(circle at 45% 45%,rgba(255,255,255,.52),rgba(145,104,66,.19) 56%,transparent 73%)}
.lm .ai-gate-scene{position:relative;display:grid;place-items:center;width:min(100%,480px);perspective:1200px}
.lm .ai-gate-light{position:absolute;z-index:0;left:50%;top:50%;width:250px;height:250px;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,255,255,.54),rgba(202,169,131,.13) 44%,transparent 70%);filter:blur(14px);transition:left .16s ease-out,top .16s ease-out}
.lm .ai-password-card{position:relative;z-index:1;width:100%;padding:clamp(28px,4vw,44px);border:1px solid rgba(255,255,255,.72);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.73),rgba(255,249,239,.44));box-shadow:0 32px 90px rgba(72,48,27,.13),inset 0 1px 0 rgba(255,255,255,.88);backdrop-filter:blur(28px) saturate(145%);-webkit-backdrop-filter:blur(28px) saturate(145%);transform:perspective(1200px) rotateX(0) rotateY(0);transition:transform .22s ease,box-shadow .3s ease,border-color .3s ease;will-change:transform}
.lm .ai-password-card:hover{box-shadow:0 38px 100px rgba(72,48,27,.17),inset 0 1px 0 rgba(255,255,255,.95);border-color:rgba(255,255,255,.92)}
[data-theme="dark"] .lm .ai-password-card{background:linear-gradient(145deg,rgba(57,47,37,.82),rgba(34,29,24,.68));border-color:rgba(255,255,255,.12);box-shadow:0 32px 90px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.08)}
.lm .ai-gate-mark{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 22px;border:1px solid rgba(139,101,66,.18);border-radius:18px;color:var(--brown);background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(235,218,194,.56));box-shadow:0 8px 22px rgba(77,49,25,.08),inset 0 1px 0 rgba(255,255,255,.9)}
[data-theme="dark"] .lm .ai-gate-mark{color:var(--cream);background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12)}
.lm .ai-gate-eyebrow{margin:0 0 10px;text-align:center;font-size:10px;letter-spacing:.19em;font-weight:750;color:var(--muted)}
.lm .ai-gate-title{margin:0;text-align:center;color:var(--text);font-size:clamp(27px,4vw,35px);line-height:1.14;letter-spacing:-.045em;font-weight:650}
.lm .ai-gate-description{margin:12px 0 28px;text-align:center;color:var(--muted);font-size:14px;line-height:1.65}
.lm .ai-gate-label{display:block;margin:0 0 9px 2px;color:var(--text-2);font-size:12px;font-weight:650}
.lm .ai-gate-input{display:block;width:100%;height:51px;padding:0 15px;border:1px solid rgba(133,99,67,.23);border-radius:14px;outline:none;background:rgba(255,255,255,.57);color:var(--text);font:inherit;font-size:14px;letter-spacing:.08em;box-shadow:inset 0 1px 2px rgba(55,35,17,.025);transition:border-color .2s ease,box-shadow .2s ease,background .2s ease}
.lm .ai-gate-input::placeholder{letter-spacing:0;color:var(--muted);opacity:.72}
.lm .ai-gate-input:focus{border-color:rgba(130,91,55,.65);background:rgba(255,255,255,.82);box-shadow:0 0 0 4px rgba(145,105,67,.10)}
[data-theme="dark"] .lm .ai-gate-input{background:rgba(0,0,0,.16);border-color:rgba(255,255,255,.13)}
[data-theme="dark"] .lm .ai-gate-input:focus{background:rgba(0,0,0,.24);border-color:rgba(225,196,162,.55)}
.lm .ai-gate-submit{display:flex;align-items:center;justify-content:space-between;width:100%;height:51px;margin-top:15px;padding:0 17px;border:1px solid rgba(67,42,24,.15);border-radius:14px;background:linear-gradient(135deg,#886344,#67452e);color:#fffaf3;font:inherit;font-size:14px;font-weight:650;cursor:pointer;box-shadow:0 9px 22px rgba(93,61,37,.18),inset 0 1px 0 rgba(255,255,255,.18);transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}
.lm .ai-gate-submit:hover{transform:translateY(-1px);filter:brightness(1.04);box-shadow:0 13px 27px rgba(93,61,37,.23),inset 0 1px 0 rgba(255,255,255,.2)}
.lm .ai-gate-submit:active{transform:scale(.99)}
.lm .ai-gate-submit span:last-child{font-size:20px;font-weight:400;transition:transform .2s ease}
.lm .ai-gate-submit:hover span:last-child{transform:translateX(3px)}
.lm .ai-gate-back{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:42px;margin-top:10px;border:0;border-radius:12px;background:transparent;color:var(--text-2);font:inherit;font-size:13px;cursor:pointer;transition:background .2s ease,color .2s ease}
.lm .ai-gate-back:hover{background:rgba(125,91,58,.08);color:var(--text)}
.lm .ai-gate-footnote{margin:21px 0 0;text-align:center;color:var(--muted);font-size:11px;letter-spacing:.015em}
@keyframes aiGateFloat{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(20px,-17px,0) scale(1.06)}}
@media(max-width:600px){.lm .ai-password-stage{padding:12px;border-radius:20px}.lm .ai-password-card{padding:30px 23px;border-radius:25px}.lm .ai-gate-orb--one{top:1%;left:-16%}.lm .ai-gate-orb--two{right:-20%;bottom:-5%}}
@media(prefers-reduced-motion:reduce){.lm .ai-gate-orb{animation:none!important}.lm .ai-password-card,.lm .ai-gate-light,.lm .ai-gate-submit,.lm .ai-gate-submit span:last-child,.lm .ai-gate-back{transition:none!important}.lm .ai-password-card{transform:none!important}}

.lm .ai-workspace{
  --ai-user-bg:#F3E3C3;
  position:relative;
  flex:1;
  min-height:0;
  margin-top:8px;
  display:grid;
  grid-template-columns:minmax(0,1fr);
  grid-template-rows:minmax(0,1fr);
  gap:18px
}

.lm .ai-workspace.has-history{
  grid-template-columns:252px minmax(0,1fr)
}

[data-theme="dark"] .lm .ai-workspace{
  --ai-user-bg:#3A2512
}

/* ---------- History ---------- */

.lm .ai-history{
  display:none;
  flex-direction:column;
  min-height:0;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  box-shadow:var(--shadow);
  overflow:hidden
}

.lm .ai-history.is-visible{
  display:flex
}

.lm .ai-history--drawer{
  display:flex;
  position:absolute;
  z-index:6;
  top:0;
  bottom:0;
  left:0;
  width:min(300px,86%);
  visibility:hidden;
  transform:translateX(-104%);
  transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s linear .3s;
  box-shadow:0 18px 50px rgba(40,22,8,.28)
}

.lm .ai-history--drawer.is-visible{
  visibility:visible;
  transform:none;
  transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s
}

.lm .ai-history-scrim{
  position:absolute;
  inset:0;
  z-index:5;
  border-radius:20px;
  background:rgba(40,22,8,.34);
  animation:aiFadeIn .2s ease both
}

.lm .ai-history-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  min-height:48px;
  padding:10px 12px 4px 18px;
  flex-shrink:0
}

.lm .ai-history-title{
  font-size:12px;
  font-weight:700;
  letter-spacing:.09em;
  text-transform:uppercase;
  color:var(--muted)
}

.lm .ai-history-body{
  flex:1;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  padding:4px 8px 12px
}

.lm .ai-history-list{
  list-style:none;
  display:flex;
  flex-direction:column;
  gap:2px
}

.lm .ai-history-row{position:relative;display:flex;align-items:center;gap:2px;padding-right:3px;border-radius:12px}
.lm .ai-history-row .ai-history-item{flex:1;min-width:0;width:auto;padding-right:5px}
.lm .ai-history-actions{display:flex;align-items:center;gap:1px;flex-shrink:0;opacity:.72;transition:opacity .18s ease}
.lm .ai-history-row:hover .ai-history-actions,.lm .ai-history-row:focus-within .ai-history-actions{opacity:1}
.lm .ai-history-action{display:grid;place-items:center;width:27px;height:29px;border:0;border-radius:8px;background:transparent;color:var(--muted);cursor:pointer;transition:background .18s ease,color .18s ease,transform .18s ease}
.lm .ai-history-action:hover{background:var(--icon-bg);color:var(--text);transform:translateY(-1px)}
.lm .ai-history-action.is-delete:hover{background:rgba(166,65,48,.10);color:#a64130}
.lm .ai-history-item{
  display:block;
  width:100%;
  min-height:40px;
  text-align:left;
  padding:9px 12px;
  border-radius:12px;
  font-size:14px;
  line-height:1.35;
  color:var(--text-2);
  transition:background-color .2s ease,color .2s ease
}

.lm .ai-history-item-title{
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  overflow-wrap:anywhere
}

.lm .ai-history-item:hover{
  background:var(--icon-bg);
  color:var(--text)
}

.lm .ai-history-item.is-active{
  background:var(--cream-soft);
  color:var(--brown-900);
  font-weight:600
}

[data-theme="dark"] .lm .ai-history-item.is-active{
  background:#35220F;
  color:var(--text)
}

.lm .ai-history-note{
  padding:16px 12px;
  font-size:13.5px;
  line-height:1.55;
  color:var(--muted);
  text-align:center
}

.lm .ai-link-btn{
  margin-top:10px;
  height:34px;
  min-height:34px;
  padding:0 16px;
  border-radius:999px;
  border:1px solid var(--border);
  color:var(--brown);
  font-size:13.5px;
  font-weight:600;
  transition:background-color .2s ease,border-color .2s ease
}

.lm .ai-link-btn:hover{
  background:var(--icon-bg)
}

[data-theme="dark"] .lm .ai-link-btn{
  color:var(--cream)
}

.lm .ai-skeleton{
  display:block;
  height:38px;
  margin:6px 4px;
  border-radius:12px;
  background:linear-gradient(90deg,var(--icon-bg),var(--border-soft),var(--icon-bg));
  background-size:200% 100%;
  animation:aiShimmer 1.4s linear infinite
}

.lm .ai-skeleton--right{
  width:46%;
  margin-left:auto;
  height:44px;
  border-radius:20px
}

.lm .ai-skeleton--wide{
  width:100%;
  height:92px;
  border-radius:16px
}

.lm .ai-skeleton--mid{
  width:68%;
  height:22px
}

/* ---------- Chat pane ---------- */

.lm .ai-chat-pane{
  min-width:0;
  min-height:0;
  display:flex;
  flex-direction:column
}

.lm .ai-chat-head{
  display:flex;
  align-items:center;
  gap:8px;
  padding:0 2px 10px;
  flex-shrink:0
}

.lm .ai-chat-name{
  font-size:15px;
  font-weight:700;
  letter-spacing:-.01em;
  color:var(--text)
}

.lm .ai-icon-btn{
  width:38px;
  height:38px;
  min-height:38px;
  display:grid;
  place-items:center;
  border-radius:12px;
  color:var(--text-2);
  transition:background-color .2s ease,color .2s ease
}

.lm .ai-icon-btn:hover{
  background:var(--icon-bg);
  color:var(--text)
}

.lm .ai-new-chat{
  margin-left:auto;
  display:inline-flex;
  align-items:center;
  gap:7px;
  height:38px;
  min-height:38px;
  padding:0 16px 0 13px;
  border-radius:999px;
  border:1px solid var(--border);
  background:var(--card);
  color:var(--brown);
  font-size:14px;
  font-weight:600;
  transition:background-color .2s ease,border-color .2s ease,transform .2s ease
}

.lm .ai-new-chat:hover{
  background:var(--icon-bg);
  transform:translateY(-1px)
}

[data-theme="dark"] .lm .ai-new-chat{
  color:var(--cream)
}

.lm .ai-icon-btn:focus-visible,
.lm .ai-new-chat:focus-visible,
.lm .ai-history-item:focus-visible,
.lm .ai-copy:focus-visible,
.lm .ai-retry:focus-visible,
.lm .ai-link-btn:focus-visible,
.lm .ai-jump:focus-visible,
.lm .ai-send:focus-visible,
.lm .ai-code:focus-visible{
  outline:2px solid var(--brown);
  outline-offset:2px
}

[data-theme="dark"] .lm .ai-icon-btn:focus-visible,
[data-theme="dark"] .lm .ai-new-chat:focus-visible,
[data-theme="dark"] .lm .ai-history-item:focus-visible,
[data-theme="dark"] .lm .ai-copy:focus-visible,
[data-theme="dark"] .lm .ai-retry:focus-visible,
[data-theme="dark"] .lm .ai-link-btn:focus-visible,
[data-theme="dark"] .lm .ai-jump:focus-visible,
[data-theme="dark"] .lm .ai-send:focus-visible,
[data-theme="dark"] .lm .ai-code:focus-visible{
  outline-color:var(--cream)
}

/* Rows: [messages][composer][spacer]. The spacer collapses once a
   conversation starts, which slides the composer down to the bottom. */

.lm .ai-chat{
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:minmax(0,1fr);
  grid-template-rows:1fr auto 0fr;
  transition:grid-template-rows .6s cubic-bezier(.22,.8,.24,1)
}

.lm .ai-chat.is-welcome{
  grid-template-rows:1fr auto 1fr
}

.lm .ai-chat-spacer{
  min-height:0
}

.lm .ai-scroll{
  position:relative;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch
}

.lm .ai-chat.is-welcome .ai-scroll{
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  overflow:hidden
}

/* ---------- Welcome ---------- */

.lm .ai-welcome{
  width:100%;
  max-width:768px;
  margin:0 auto;
  padding:0 8px 28px;
  animation:aiWelcomeIn .65s cubic-bezier(.2,.8,.2,1) both
}

.lm .ai-title{
  position:relative;
  display:block;
  font-size:clamp(30px,4.6vw,46px);
  font-weight:700;
  letter-spacing:-.03em;
  line-height:1.14;
  color:var(--text)
}

.lm .ai-title-ghost{
  display:block;
  visibility:hidden
}

.lm .ai-title-live{
  position:absolute;
  inset:0;
  display:block
}

.lm .ai-welcome-sub{
  margin-top:14px;
  max-width:520px;
  font-size:16px;
  line-height:1.6;
  color:var(--text-2)
}

/* ---------- Thread ---------- */

.lm .ai-thread{
  width:100%;
  max-width:768px;
  margin:0 auto;
  padding:10px 6px 30px;
  display:flex;
  flex-direction:column;
  gap:26px
}

.lm .ai-thread-loading{
  display:flex;
  flex-direction:column;
  gap:12px
}

.lm .ai-msg{
  display:flex;
  gap:14px;
  animation:aiMsgIn .4s cubic-bezier(.2,.8,.2,1) both
}

.lm .ai-msg--user{
  justify-content:flex-end
}

.lm .ai-user-wrap{
  display:flex;
  flex-direction:column;
  align-items:flex-end;
  gap:6px;
  max-width:84%
}

.lm .ai-bubble{
  padding:12px 18px;
  border-radius:22px 22px 6px 22px;
  background:var(--ai-user-bg);
  color:var(--text);
  font-size:15.5px;
  line-height:1.6;
  white-space:pre-wrap;
  overflow-wrap:anywhere
}

.lm .ai-bubble.is-failed{
  outline:1px solid rgba(217,45,32,.45)
}

.lm .ai-not-sent{
  font-size:12.5px;
  color:var(--red)
}

.lm .ai-avatar{
  flex:0 0 32px;
  width:32px;
  height:32px;
  margin-top:2px;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:var(--brown);
  color:var(--cream-soft);
  font-size:15px;
  line-height:1
}

[data-theme="dark"] .lm .ai-avatar{
  background:var(--cream);
  color:var(--brown-900)
}

.lm .ai-avatar--pulse{
  animation:aiAvatarPulse 1.6s ease-in-out infinite
}

.lm .ai-msg-body{
  flex:1;
  min-width:0
}

.lm .ai-prose{
  font-size:16px;
  line-height:1.75;
  color:var(--text);
  overflow-wrap:anywhere
}

.lm .ai-prose > * + *{
  margin-top:14px
}

.lm .ai-prose > .ai-md-heading{
  margin-top:24px;
  font-size:18px;
  font-weight:700;
  letter-spacing:-.01em;
  line-height:1.4
}

.lm .ai-md-list{
  padding-left:24px;
  display:flex;
  flex-direction:column;
  gap:6px
}

.lm .ai-md-list li::marker{
  color:var(--brown)
}

[data-theme="dark"] .lm .ai-md-list li::marker{
  color:var(--cream)
}

.lm .ai-md-quote{
  padding-left:14px;
  border-left:3px solid var(--border);
  color:var(--text-2)
}

.lm .ai-md-rule{
  border:0;
  border-top:1px solid var(--border)
}

.lm .ai-inline-code{
  padding:2px 6px;
  border-radius:6px;
  background:var(--icon-bg);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:.9em
}

.lm .ai-code{
  padding:14px 16px;
  border-radius:14px;
  background:#2A1A0C;
  color:#F6E8D0;
  overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:13.5px;
  line-height:1.65;
  white-space:pre
}

.lm .ai-table-wrap{
  overflow-x:auto;
  border:1px solid var(--border);
  border-radius:14px
}

.lm .ai-table{
  width:100%;
  border-collapse:collapse;
  font-size:14.5px;
  line-height:1.55
}

.lm .ai-table th,
.lm .ai-table td{
  padding:10px 14px;
  text-align:left;
  vertical-align:top;
  border-bottom:1px solid var(--border-soft)
}

.lm .ai-table th{
  background:var(--icon-bg);
  font-weight:700
}

.lm .ai-table tr:last-child td{
  border-bottom:0
}

.lm .ai-msg-actions{
  display:flex;
  gap:4px;
  margin-top:8px
}

.lm .ai-copy{
  display:inline-flex;
  align-items:center;
  gap:6px;
  height:32px;
  min-height:32px;
  padding:0 11px;
  border-radius:999px;
  font-size:13px;
  color:var(--muted);
  transition:background-color .2s ease,color .2s ease
}

.lm .ai-copy:hover{
  background:var(--icon-bg);
  color:var(--text)
}

.lm .ai-dots{
  display:inline-flex;
  align-items:center;
  gap:5px;
  height:32px
}

.lm .ai-dots span{
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--brown);
  opacity:.3;
  animation:aiDot 1.2s ease-in-out infinite
}

[data-theme="dark"] .lm .ai-dots span{
  background:var(--cream)
}

.lm .ai-dots span:nth-child(2){animation-delay:.15s}
.lm .ai-dots span:nth-child(3){animation-delay:.3s}

.lm .ai-error{
  flex:1;
  min-width:0;
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:10px 14px;
  padding:12px 16px;
  border-radius:16px;
  background:rgba(217,45,32,.07);
  border:1px solid rgba(217,45,32,.3);
  font-size:14.5px;
  line-height:1.5;
  color:var(--text)
}

.lm .ai-retry{
  margin-left:auto;
  height:34px;
  min-height:34px;
  padding:0 16px;
  border-radius:999px;
  background:var(--brown);
  color:var(--cream-soft);
  font-size:13.5px;
  font-weight:600;
  transition:background-color .2s ease,transform .2s ease
}

.lm .ai-retry:hover{
  transform:translateY(-1px)
}

[data-theme="dark"] .lm .ai-retry{
  background:var(--cream);
  color:var(--brown-900)
}

/* ---------- Composer ---------- */

.lm .ai-dock{
  position:relative;
  width:100%;
  max-width:768px;
  margin:0 auto;
  padding:0 4px
}

.lm .ai-jump{
  position:absolute;
  z-index:3;
  left:50%;
  top:-52px;
  transform:translateX(-50%);
  display:inline-flex;
  align-items:center;
  gap:6px;
  height:38px;
  min-height:38px;
  padding:0 16px;
  border-radius:999px;
  border:1px solid var(--border);
  background:var(--card);
  box-shadow:var(--shadow);
  font-size:13.5px;
  color:var(--text-2);
  animation:aiFadeIn .2s ease both
}

.lm .ai-composer-shell{
  position:relative;
  isolation:isolate;
  border-radius:28px
}

.lm .ai-glow,
.lm .ai-ring{
  position:absolute;
  overflow:hidden;
  pointer-events:none;
  opacity:0;
  transition:opacity .55s ease
}

.lm .ai-glow{
  inset:-3px;
  border-radius:34px;
  z-index:-2;
  filter:blur(13px)
}

.lm .ai-ring{
  inset:-1.5px;
  border-radius:30px;
  z-index:-1
}

.lm .ai-glow::before,
.lm .ai-ring::before{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:200%;
  aspect-ratio:1 / 1;
  transform:translate(-50%,-50%) rotate(0deg);
  background:conic-gradient(from 0deg,#4285F4,#34A853,#FBBC05,#EA4335,#4285F4);
  animation:aiRingSpin 3.4s linear infinite;
  animation-play-state:paused
}

.lm .ai-composer-shell.is-live .ai-glow::before,
.lm .ai-composer-shell.is-live .ai-ring::before{
  animation-play-state:running
}

.lm .ai-composer-shell.is-busy .ai-ring{
  opacity:1
}

.lm .ai-composer-shell.is-busy .ai-glow{
  opacity:.6;
  animation:aiGlowBreathe 1.9s ease-in-out infinite
}

[data-theme="dark"] .lm .ai-composer-shell.is-busy .ai-glow{
  opacity:.36
}

[data-theme="dark"] .lm .ai-composer-shell.is-busy .ai-ring{
  opacity:.85
}

.lm .ai-composer{
  position:relative;
  z-index:1;
  display:flex;
  align-items:flex-end;
  gap:10px;
  padding:10px 10px 10px 22px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:28px;
  box-shadow:0 1px 2px rgba(122,47,0,.05),0 12px 32px rgba(122,47,0,.08);
  transition:border-color .25s ease,box-shadow .25s ease,background-color .25s ease
}

[data-theme="dark"] .lm .ai-composer{
  box-shadow:0 1px 2px rgba(0,0,0,.4),0 12px 32px rgba(0,0,0,.28)
}

.lm .ai-composer:focus-within{
  border-color:rgba(122,47,0,.45);
  box-shadow:0 1px 2px rgba(122,47,0,.06),0 14px 36px rgba(122,47,0,.13)
}

[data-theme="dark"] .lm .ai-composer:focus-within{
  border-color:rgba(233,198,137,.45)
}

.lm .ai-composer-shell.is-busy .ai-composer{
  border-color:transparent
}

.lm .ai-input{
  flex:1;
  min-width:0;
  max-height:200px;
  padding:9px 0;
  border:0;
  outline:0;
  resize:none;
  overflow-y:auto;
  background:transparent;
  color:var(--text);
  font:inherit;
  font-size:16px;
  line-height:1.55
}

.lm .ai-input::placeholder{
  color:var(--muted)
}

.lm .ai-send{
  flex:0 0 44px;
  width:44px;
  height:44px;
  min-height:44px;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:var(--brown);
  color:#FFF6E4;
  transition:transform .2s ease,background-color .2s ease,color .2s ease
}

.lm .ai-send:hover:not(:disabled){
  background:var(--brown-900);
  transform:translateY(-1px)
}

.lm .ai-send:disabled{
  background:var(--border);
  color:var(--muted);
  opacity:1;
  cursor:not-allowed
}

.lm .ai-send.is-busy:disabled{
  background:var(--brown);
  color:#FFF6E4;
  cursor:progress
}

[data-theme="dark"] .lm .ai-send{
  background:var(--cream);
  color:var(--brown-900)
}

[data-theme="dark"] .lm .ai-send:hover:not(:disabled){
  background:var(--cream-soft)
}

[data-theme="dark"] .lm .ai-send:disabled{
  background:var(--border);
  color:var(--muted)
}

[data-theme="dark"] .lm .ai-send.is-busy:disabled{
  background:var(--cream);
  color:var(--brown-900)
}

.lm .ai-spinner{
  width:18px;
  height:18px;
  border-radius:50%;
  border:2.5px solid rgba(255,246,228,.35);
  border-top-color:#FFF6E4;
  animation:aiSpin .8s linear infinite
}

[data-theme="dark"] .lm .ai-spinner{
  border-color:rgba(74,30,0,.25);
  border-top-color:var(--brown-900)
}

.lm .ai-footnote{
  margin-top:10px;
  padding-bottom:2px;
  text-align:center;
  font-size:12px;
  line-height:1.4;
  color:var(--muted)
}

/* ---------- Motion ---------- */

@keyframes aiFadeIn{
  from{opacity:0}
  to{opacity:1}
}

@keyframes aiMsgIn{
  from{opacity:0;transform:translateY(10px)}
  to{opacity:1;transform:none}
}

@keyframes aiWelcomeIn{
  from{opacity:0;transform:translateY(12px)}
  to{opacity:1;transform:none}
}

@keyframes aiRingSpin{
  to{transform:translate(-50%,-50%) rotate(360deg)}
}

@keyframes aiGlowBreathe{
  0%,100%{transform:scale(1,1)}
  50%{transform:scale(1.02,1.2)}
}

@keyframes aiDot{
  0%,80%,100%{transform:scale(.7);opacity:.3}
  40%{transform:scale(1);opacity:.9}
}

@keyframes aiAvatarPulse{
  0%,100%{transform:scale(1)}
  50%{transform:scale(1.1)}
}

@keyframes aiSpin{
  to{transform:rotate(360deg)}
}

@keyframes aiShimmer{
  to{background-position:-200% 0}
}

/* ---------- Responsive ---------- */

@media(max-width:860px){
  .lm .main.ai-mode{
    padding:12px 12px calc(10px + env(safe-area-inset-bottom))
  }

  .lm .ai-workspace{
    margin-top:4px
  }

  .lm .ai-thread{
    gap:22px;
    padding:6px 2px 22px
  }

  .lm .ai-msg{
    gap:10px
  }

  .lm .ai-user-wrap{
    max-width:90%
  }

  .lm .ai-avatar{
    flex-basis:28px;
    width:28px;
    height:28px;
    font-size:13px
  }

  .lm .ai-prose{
    font-size:15.5px;
    line-height:1.7
  }

  .lm .ai-composer-shell,
  .lm .ai-composer{
    border-radius:26px
  }

  .lm .ai-composer{
    padding:8px 8px 8px 18px
  }

  .lm .ai-dock{
    padding:0 6px
  }

  .lm .ai-footnote{
    font-size:11.5px
  }

  .lm .ai-copy{
    height:36px;
    min-height:36px
  }
}

@media(max-width:420px){
  .lm .ai-new-chat span{
    display:none
  }

  .lm .ai-new-chat{
    width:38px;
    padding:0;
    justify-content:center
  }
}

@media(max-height:560px){
  .lm .ai-footnote{
    display:none
  }
}

@media(prefers-reduced-motion:reduce){
  .lm .ai-chat{
    transition:none
  }

  .lm .ai-composer-shell.is-busy .ai-glow{
    animation:none
  }
}

.lm .lm-section{margin-top:8px}
.lm .lm-picker-row{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
.lm .lm-picker-label{display:flex;flex-direction:column;gap:6px;font-weight:600}
.lm .lm-picker-label select{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text);max-width:420px}
.lm .lm-test-taker,.lm .lm-quiz-taker,.lm .lm-schedule-form{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;margin:16px 0}
.lm .lm-question{font-size:18px;font-weight:600;margin:12px 0}
.lm .lm-options{display:grid;gap:8px;margin:12px 0}
.lm .lm-option-label{display:flex;gap:10px;align-items:flex-start;background:var(--card-2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;cursor:pointer}
.lm .lm-question-nav,.lm .lm-test-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.lm .lm-review-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:8px;margin:12px 0}
.lm .lm-review-item{background:var(--card-2);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center}
.lm .lm-review-list{display:grid;gap:12px}
.lm .lm-dialog{background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:12px}
.lm .lm-error{color:#9b1c1c;font-weight:600}
.lm .lm-marks-options{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.lm .lm-custom-marks input{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--text)}
.lm .lm-schedule-list{display:grid;gap:8px;margin:12px 0}
.lm .lm-schedule-item{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;background:var(--card-2);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.lm .lm-schedule-picker{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.lm .lm-cancel-reason{color:var(--muted)}
.lm .lm-chapter-title{color:var(--text-2)}
.lm .lm-test-meta{color:var(--text-2)}
.lm .lm-submitting{color:var(--muted)}
.lm .lm-option-correct{color:#2e7d32;font-weight:700}
.lm .lm-option-selected-wrong{color:#9b1c1c}
.lm .lm-push-row{margin:16px 0}
/* ============================================================================
   LearnMate — Mark 6 Tests UI styles.
   PASTE this whole block inside the dashboard CSS string in
   app/dashboard/page.tsx, just before the closing backtick of the CSS
   string (the line at the very end of the CSS that only contains a
   backtick followed by a semicolon).
   Uses ONLY the existing CSS variables, so it follows light + dark mode.
   Do NOT redefine .type-cursor — it already exists in the dashboard CSS.
   Reduced motion is already handled by the existing global
   lm-star rule (animation none, transition none), so these animations
   automatically switch off for users who prefer reduced motion.
   Toast z-index is 500, so the test dialogs below sit under toasts.
   ========================================================================== */

/* ------------------------------ Test overlay ------------------------------ */

/* The test is a normal in-flow section now, NOT a fixed overlay:
   no separate scrollbar, no scroll lock — the page's own scrollbar
   moves the whole test, and nothing can be clipped off-screen. */
.lm-tt{
  width:100%;
  background:var(--bg);
  color:var(--text);
  padding-bottom:24px;
}

.lm-tt-sr{
  position:absolute;
  width:1px;
  height:1px;
  overflow:hidden;
  clip:rect(0 0 0 0);
  white-space:nowrap;
}

.lm-tt-sub{
  color:var(--text-2);
  margin-top:4px;
  line-height:1.5;
}

.lm-tt-error{
  max-width:1080px;
  margin:0 auto 16px;
}

/* ------------------------------ Timer ring -------------------------------- */
/* --tt-p is a unitless 0–100 number set inline once per tick. */

.lm-tt-ring{
  position:relative;
  width:128px;
  height:128px;
  border-radius:50%;
  flex-shrink:0;
  display:grid;
  place-items:center;
  background:conic-gradient(
    var(--brown) 0 calc(var(--tt-p, 100) * 1%),
    var(--track) calc(var(--tt-p, 100) * 1%) 100%
  );
}

.lm-tt-ring-core{
  width:96px;
  height:96px;
  border-radius:50%;
  background:var(--card);
  display:grid;
  place-items:center;
  font-weight:800;
  font-size:20px;
  color:var(--text);
}

.lm-tt-ring-knob{
  position:absolute;
  top:4px;
  left:50%;
  width:16px;
  height:16px;
  margin-left:-8px;
  border-radius:50%;
  background:var(--brown);
  border:3px solid var(--card);
  transform-origin:50% 60px;
  transform:rotate(calc(var(--tt-p, 100) * 3.6deg));
}

.lm-tt-ring.is-urgent{
  background:conic-gradient(
    var(--red) 0 calc(var(--tt-p, 100) * 1%),
    var(--track) calc(var(--tt-p, 100) * 1%) 100%
  );
}

.lm-tt-ring.is-urgent .lm-tt-ring-knob{
  background:var(--red);
}

.lm-tt-ring.is-urgent .lm-tt-ring-core{
  color:var(--red);
}

/* ------------------------------ Taking screen ----------------------------- */

.lm-tt-top{
  max-width:1080px;
  margin:0 auto 20px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  flex-wrap:wrap;
}

.lm-tt-heading h2{
  font-size:26px;
  line-height:1.2;
}

.lm-tt-body{
  max-width:1080px;
  margin:0 auto;
  display:grid;
  grid-template-columns:minmax(0, 1fr) 300px;
  gap:20px;
  align-items:start;
}

.lm-tt-stage{
  position:relative;
  min-width:0;
}

.lm-tt-screen{
  width:100%;
}

.lm-tt-screen.lm-tt-out-next,
.lm-tt-screen.lm-tt-out-prev{
  position:absolute;
  inset:0;
  pointer-events:none;
}

/* Slide direction follows the request literally: Next slides right,
   Previous slides left. 340ms matches SLIDE_MS in TestTaker.tsx. */
.lm-tt-in-next{animation:ttInNext .34s ease both}
.lm-tt-out-next{animation:ttOutNext .34s ease both}
.lm-tt-in-prev{animation:ttInPrev .34s ease both}
.lm-tt-out-prev{animation:ttOutPrev .34s ease both}

@keyframes ttInNext{from{opacity:0;transform:translateX(-48px)}to{opacity:1;transform:none}}
@keyframes ttOutNext{from{opacity:1;transform:none}to{opacity:0;transform:translateX(48px)}}
@keyframes ttInPrev{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:none}}
@keyframes ttOutPrev{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-48px)}}

.lm-tt-qwin{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:24px;
}

.lm-tt-qhead{
  display:flex;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
  color:var(--text-2);
  font-size:13px;
  font-weight:700;
}

.lm-tt-qstate.is-answered{
  color:var(--brown);
}

.lm-tt-qtext{
  font-size:22px;
  line-height:1.45;
  margin:16px 0 20px;
  min-height:2.9em;
}

.lm-tt-options{
  display:grid;
  gap:10px;
  opacity:0;
  transform:translateY(6px);
  transition:opacity .3s ease, transform .3s ease;
}

.lm-tt-options.is-in{
  opacity:1;
  transform:none;
}

.lm-tt-opt{
  display:flex;
  align-items:center;
  gap:12px;
  background:var(--card-2);
  border:1px solid var(--border);
  border-radius:14px;
  padding:14px 16px;
  cursor:pointer;
  transition:border-color .2s ease, background .2s ease, box-shadow .2s ease;
}

.lm-tt-opt:hover{
  border-color:var(--brown);
}

.lm-tt-opt:focus-within{
  box-shadow:0 0 0 2px var(--brown);
}

.lm-tt-opt.is-selected{
  border-color:var(--brown);
  background:var(--cream-soft);
  box-shadow:0 0 0 1px var(--brown);
}

.lm-tt-radio{
  position:absolute;
  opacity:0;
  pointer-events:none;
}

.lm-tt-opt-key{
  width:30px;
  height:30px;
  border-radius:50%;
  background:var(--icon-bg);
  color:var(--brown);
  display:grid;
  place-items:center;
  font-weight:800;
  flex-shrink:0;
}

.lm-tt-opt.is-selected .lm-tt-opt-key{
  background:var(--brown);
  color:var(--cream-soft);
}

.lm-tt-opt-text{
  line-height:1.4;
}

.lm-tt-nav{
  display:flex;
  justify-content:space-between;
  margin-top:20px;
}

/* --------------------------- Question palette ----------------------------- */

.lm-tt-panel{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:20px;
  align-self:start;
}

.lm-tt-panel-title{
  font-size:18px;
}

.lm-tt-legend{
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--text-2);
  font-size:13px;
  margin:10px 0 14px;
  flex-wrap:wrap;
}

.lm-tt-dot{
  width:12px;
  height:12px;
  border-radius:50%;
  background:var(--card-2);
  border:1px solid var(--border);
  display:inline-block;
  flex-shrink:0;
}

.lm-tt-dot.is-answered{
  background:var(--brown);
  border-color:var(--brown);
}

.lm-tt-legend-sep{
  width:1px;
  height:14px;
  background:var(--border);
}

.lm-tt-grid{
  list-style:none;
  display:grid;
  grid-template-columns:repeat(5, 1fr);
  gap:8px;
}

.lm-tt-grid li{
  list-style:none;
}

.lm-tt-box{
  width:100%;
  aspect-ratio:1;
  border-radius:10px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  font-weight:700;
  cursor:pointer;
  transition:border-color .2s ease, background .2s ease, box-shadow .2s ease;
}

.lm-tt-box:hover{
  border-color:var(--brown);
}

.lm-tt-box.is-answered{
  background:var(--brown);
  color:var(--cream-soft);
  border-color:var(--brown);
}

.lm-tt-box.is-current{
  box-shadow:0 0 0 2px var(--cream), 0 0 0 4px var(--brown);
}

.lm-tt-submit{
  width:100%;
  margin-top:16px;
}

.lm-tt-leave{
  width:100%;
  margin-top:10px;
}

/* ------------------------------ Dialogs ----------------------------------- */

.lm-tt-scrim{
  position:fixed;
  inset:0;
  background:rgba(23, 16, 10, .55);
  display:grid;
  place-items:center;
  z-index:70;
  padding:20px;
}

.lm-tt-dialog{
  background:var(--card);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:24px;
  max-width:480px;
  width:100%;
}

.lm-tt-dialog h3{
  margin-bottom:10px;
}

.lm-tt-dialog p{
  color:var(--text-2);
  line-height:1.5;
}

.lm-tt-dialog-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:18px;
  flex-wrap:wrap;
}

.lm-tt-submitting{
  color:var(--cream-soft);
  font-weight:700;
}

/* ------------------------------ Disclaimer -------------------------------- */

.lm-tt-disclaimer{
  display:flex;
  flex-direction:column;
}

.lm-tt-dis-body{
  flex:1;
  display:flex;
  flex-direction:column;
  justify-content:center;
  max-width:720px;
  margin:0 auto;
  width:100%;
}

.lm-tt-dis-title{
  font-size:30px;
  line-height:1.2;
  margin:12px 0 20px;
}

.lm-tt-dis-list{
  list-style:none;
  display:grid;
  gap:12px;
}

.lm-tt-dis-item{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  padding:16px 18px;
  line-height:1.5;
}

.lm-tt-dis-actions{
  display:flex;
  justify-content:space-between;
  gap:12px;
  max-width:720px;
  margin:24px auto 0;
  width:100%;
}

/* ------------------------------ Result screen ----------------------------- */

.lm-tt-result-inner{
  max-width:860px;
  margin:0 auto;
  width:100%;
}

.lm-tt-result-title{
  font-size:28px;
}

.lm-tt-score{
  display:flex;
  align-items:baseline;
  gap:12px;
  flex-wrap:wrap;
  margin:16px 0 24px;
  font-size:18px;
}

.lm-tt-score b{
  font-size:30px;
}

.lm-tt-review-title{
  margin-bottom:12px;
}

.lm-tt-review{
  list-style:none;
  display:grid;
  gap:14px;
}

.lm-tt-review-item{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:18px 20px;
}

.lm-tt-review-q{
  font-weight:700;
  line-height:1.45;
}

.lm-tt-review-opts{
  list-style:none;
  display:grid;
  gap:6px;
  margin:12px 0;
}

.lm-tt-rev-opt{
  padding:10px 12px;
  border-radius:10px;
  background:var(--card-2);
  border:1px solid var(--border);
  line-height:1.4;
}

.lm-tt-rev-opt.is-correct{
  border-color:var(--brown);
  background:var(--cream-soft);
  font-weight:700;
}

.lm-tt-rev-opt.is-wrong{
  border-color:var(--red);
}

.lm-tt-review-note{
  color:var(--text-2);
}

.lm-tt-result-actions{
  margin-top:20px;
  display:flex;
  justify-content:flex-end;
}

/* --------------------------- Type-select screen --------------------------- */

.lm-tt-type{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:28px;
}

.lm-tt-type-title{
  font-size:26px;
  line-height:1.25;
}

.lm-tt-type-cards{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:16px;
  margin-top:20px;
}

.lm-tt-type-card{
  text-align:left;
  background:var(--card-2);
  border:1px solid var(--border);
  border-radius:18px;
  padding:22px;
  cursor:pointer;
  color:var(--text);
  font:inherit;
  transition:transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}

.lm-tt-type-card:hover{
  transform:translateY(-4px);
  border-color:var(--brown);
  box-shadow:0 16px 32px rgba(122, 47, 0, .18), 0 0 0 1px rgba(122, 47, 0, .08);
}

.lm-tt-type-card:focus-visible{
  outline:2px solid var(--brown);
  outline-offset:2px;
}

.lm-tt-type-card h3{
  font-size:19px;
  margin-bottom:6px;
}

.lm-tt-type-card p{
  color:var(--text-2);
  line-height:1.5;
}

.lm-tt-type-back{
  margin-top:18px;
}

/* ------------------------------ Calendar picker --------------------------- */

.lm-cal{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:24px;
}

.lm-cal-head{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.lm-cal-title{
  font-size:20px;
  margin-right:auto;
}

.lm-cal-select{
  background:var(--card-2);
  color:var(--text);
  border:1px solid var(--border);
  border-radius:10px;
  padding:8px 10px;
  font:inherit;
  cursor:pointer;
}

.lm-cal-navbtn{
  width:36px;
  height:36px;
  border-radius:10px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  font-weight:800;
  cursor:pointer;
}

.lm-cal-navbtn:hover{
  border-color:var(--brown);
}

.lm-cal-week{
  display:grid;
  grid-template-columns:repeat(7, 1fr);
  gap:6px;
  margin-top:18px;
  color:var(--muted);
  font-size:12px;
  font-weight:700;
  text-align:center;
}

.lm-cal-days{
  display:grid;
  grid-template-columns:repeat(7, 1fr);
  gap:6px;
  margin-top:6px;
}

.lm-cal-day{
  aspect-ratio:1;
  border-radius:12px;
  border:1px solid var(--border);
  background:var(--card-2);
  color:var(--text);
  font:inherit;
  font-weight:700;
  cursor:pointer;
  transition:border-color .2s ease, background .2s ease;
}

.lm-cal-day:hover:not(:disabled){
  border-color:var(--brown);
}

.lm-cal-day:disabled{
  opacity:.38;
  cursor:not-allowed;
}

.lm-cal-day.is-today{
  color:var(--brown);
  font-weight:900;
}

.lm-cal-day.is-selected{
  background:var(--brown);
  color:var(--cream-soft);
  border-color:var(--brown);
}

.lm-cal-day.is-selected.is-today{
  color:var(--cream-soft);
}

.lm-cal-blank{
  aspect-ratio:1;
}

.lm-cal-time{
  display:flex;
  gap:12px;
  margin-top:18px;
  flex-wrap:wrap;
}

.lm-cal-time label{
  display:flex;
  flex-direction:column;
  gap:6px;
  font-size:13px;
  color:var(--text-2);
  font-weight:700;
}

.lm-cal-foot{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-top:18px;
  flex-wrap:wrap;
}

.lm-cal-summary{
  color:var(--text-2);
}

/* ------------------------------ Upcoming list ----------------------------- */

.lm-upcoming-list{
  display:grid;
  gap:12px;
}

.lm-upcoming-card{
  display:flex;
  justify-content:space-between;
  gap:16px;
  flex-wrap:wrap;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:18px 20px;
}

.lm-upcoming-title{
  font-weight:800;
  line-height:1.4;
}

.lm-upcoming-meta{
  color:var(--text-2);
  margin-top:4px;
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.lm-upcoming-pill{
  display:inline-block;
  padding:4px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:800;
}

.lm-upcoming-pill.is-scheduled{
  background:var(--cream-soft);
  color:var(--brown);
}

.lm-upcoming-pill.is-available{
  background:var(--brown);
  color:var(--cream-soft);
}

.lm-upcoming-pill.is-missed{
  background:#FDECEA;
  color:var(--red);
}

[data-theme="dark"] .lm .lm-upcoming-pill.is-missed{
  background:#3A1512;
  color:#F6B8B0;
}

.lm .btn-brown:disabled{
  opacity:.5;
  cursor:not-allowed;
}

.lm .lm-msdd{
  display:flex;
  flex-direction:column;
  gap:8px;
  margin:16px 0;
  max-width:460px;
}

.lm .lm-msdd-label{
  font-weight:700;
  font-size:14px;
  color:var(--text);
}

.lm .lm-msdd-wrap{position:relative}

.lm .lm-msdd-btn{
  display:flex;
  align-items:center;
  gap:10px;
  width:100%;
  padding:12px 14px;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--card);
  color:var(--text);
  font:inherit;
  font-weight:600;
  cursor:pointer;
  box-shadow:var(--shadow);
  transition:border-color .2s ease;
}

.lm .lm-msdd-btn:hover{border-color:var(--brown)}

.lm .lm-msdd-btn-text{
  flex:1;
  text-align:left;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lm .lm-msdd-btn-pct{
  color:var(--brown);
  font-weight:800;
}

[data-theme="dark"] .lm .lm-msdd-btn-pct{color:var(--cream)}

.lm .lm-msdd-chevron{
  transition:transform .25s ease;
  color:var(--muted);
}

.lm .lm-msdd-chevron.open{transform:rotate(180deg)}

.lm .lm-msdd-scrim{
  position:fixed;
  inset:0;
  z-index:60;
  background:transparent;
  border:none;
  cursor:default;
}

.lm .lm-msdd-list{
  position:absolute;
  top:calc(100% + 8px);
  left:0;
  right:0;
  z-index:61;
  list-style:none;
  margin:0;
  padding:6px;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  box-shadow:var(--shadow);
  max-height:320px;
  overflow-y:auto;
  animation:fadeUp .22s ease;
}

.lm .lm-msdd-item{
  display:flex;
  align-items:center;
  gap:10px;
  width:100%;
  padding:10px 12px;
  border:none;
  border-radius:10px;
  background:transparent;
  color:var(--text);
  font:inherit;
  cursor:pointer;
  text-align:left;
}

.lm .lm-msdd-item:hover{background:var(--card-2)}

.lm .lm-msdd-item.selected{
  background:var(--cream-soft);
  font-weight:700;
}

[data-theme="dark"] .lm .lm-msdd-item.selected{background:var(--icon-bg)}

.lm .lm-msdd-item-main{
  flex:1;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.lm .lm-msdd-item-bar{
  flex:0 0 64px;
  height:6px;
  border-radius:999px;
  background:var(--track);
  overflow:hidden;
}

.lm .lm-msdd-item-bar i{
  display:block;
  height:100%;
  background:var(--brown);
  border-radius:999px;
}

.lm .lm-msdd-item-pct{
  font-size:13px;
  color:var(--text-2);
  min-width:36px;
  text-align:right;
}

@media(min-width:861px){
  .lm .sidebar{transition:width .28s ease,padding .28s ease}
  .lm .main{transition:margin-left .28s ease}
  .lm .app.sidebar-collapsed .sidebar{width:78px;padding:18px 10px 14px}
  .lm .app.sidebar-collapsed .main{margin-left:78px}
  .lm .app.sidebar-collapsed .brand{justify-content:center;padding:4px 0 16px}
  .lm .app.sidebar-collapsed .brand-mark{width:44px;height:44px}
  .lm .app.sidebar-collapsed .brand-word{display:none}
  .lm .app.sidebar-collapsed .nav-link{justify-content:center;padding:11px 0}
  .lm .app.sidebar-collapsed .nav-label{display:none}
  .lm .app.sidebar-collapsed .side-foot button,
  .lm .app.sidebar-collapsed .profile-chip{justify-content:center;padding:11px 0}
  .lm .app.sidebar-collapsed .side-foot-label{display:none}
  .lm .app.sidebar-collapsed .profile-meta{display:none}
  .lm .app.sidebar-collapsed .profile-chevron{display:none}
  .lm .app.sidebar-collapsed .side-legal{display:none}
}

.lm .lm-edge-toggle{
  position:fixed;
  top:102px;
  left:220px;
  width:32px;
  height:32px;
  border-radius:50%;
  background:var(--brown);
  border:2px solid var(--cream-soft);
  color:var(--cream);
  box-shadow:0 3px 12px rgba(61,34,15,.4);
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  font-weight:800;
  line-height:1;
  padding:0 0 2px;
  cursor:pointer;
  z-index:55;
  transition:left .28s ease,background .15s ease,transform .15s ease
}
.lm .lm-edge-toggle:hover{background:var(--brown-900);transform:scale(1.12)}
.lm .app.sidebar-collapsed .lm-edge-toggle{left:62px}
[data-theme="dark"] .lm .lm-edge-toggle{background:var(--cream);color:var(--brown-900);border-color:var(--brown)}
@media (max-width:860px){
  .lm .lm-edge-toggle{display:none}
}

.lm .lm-an-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}
.lm .lm-an-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px}
.lm .lm-an-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.lm .lm-an-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;box-shadow:var(--shadow)}
.lm .lm-an-card h3{font-size:15.5px;color:var(--brown-900);margin:0 0 2px}
[data-theme="dark"] .lm .lm-an-card h3{color:var(--cream)}
.lm .lm-an-hint{font-size:12.5px;color:var(--muted);margin:0 0 12px}
.lm .lm-an-k{font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.lm .lm-an-v{font-size:27px;font-weight:800;color:var(--brown-900);margin:6px 0 3px}
[data-theme="dark"] .lm .lm-an-v{color:var(--cream)}
.lm .lm-an-v small{font-size:15px;font-weight:700;color:var(--text-2)}
.lm .lm-an-d{font-size:12.5px;color:var(--text-2)}
.lm .lm-an-blur{animation:lmAnBlur 1.25s ease-out both}
@keyframes lmAnBlur{from{filter:blur(14px);opacity:.35;transform:translateY(10px)}to{filter:blur(0);opacity:1;transform:none}}
.lm .lm-an-topic{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-soft);font-size:13.5px}
.lm .lm-an-topic:last-child{border-bottom:none}
.lm .lm-an-score{font-weight:800;color:var(--brown);white-space:nowrap}
[data-theme="dark"] .lm .lm-an-score{color:var(--cream)}
.lm .lm-an-lbl{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin:12px 0 2px;color:var(--text-2)}
.lm .lm-an-bar-row{display:grid;grid-template-columns:110px 1fr 44px;align-items:center;gap:10px;padding:7px 0;font-size:13.5px}
.lm .lm-an-bar{height:10px;border-radius:99px;background:var(--track);overflow:hidden}
.lm .lm-an-bar i{display:block;height:100%;border-radius:99px;background:var(--brown)}
.lm .lm-an-pct{font-weight:800;color:var(--brown);text-align:right}
[data-theme="dark"] .lm .lm-an-pct{color:var(--cream)}
.lm .lm-an-week{display:flex;align-items:flex-end;gap:8px}
.lm .lm-an-wcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px}
.lm .lm-an-wbar{width:100%;max-width:38px;border-radius:7px 7px 3px 3px;background:#C89B5F}
.lm .lm-an-wbar.today{background:var(--brown)}
.lm .lm-an-wmin{font-size:11.5px;font-weight:800;color:var(--brown-900)}
[data-theme="dark"] .lm .lm-an-wmin{color:var(--cream)}
.lm .lm-an-wday{font-size:11.5px;font-weight:600;color:var(--text-2)}
.lm .lm-an-wtotal{font-size:12.5px;color:var(--muted);margin:10px 0 0}
.lm .lm-an-row{display:grid;grid-template-columns:1fr 90px 110px 60px 96px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border-soft);font-size:13.5px}
.lm .lm-an-row:last-child{border-bottom:none}
.lm .lm-an-chip{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;background:var(--cream-soft);color:var(--brown);text-align:center}
.lm .lm-an-chip.fail{background:#FDECEA;color:var(--red)}
[data-theme="dark"] .lm .lm-an-chip{background:var(--icon-bg);color:var(--cream)}
[data-theme="dark"] .lm .lm-an-chip.fail{background:#3A1512;color:#F6B8B0}
.lm .lm-an-empty{font-size:13.5px;color:var(--muted);padding:10px 0;line-height:1.55;margin:0}
@media (max-width:980px){
  .lm .lm-an-stats{grid-template-columns:repeat(2,1fr)}
  .lm .lm-an-grid,.lm .lm-an-grid2{grid-template-columns:1fr}
  .lm .lm-an-row{grid-template-columns:1fr 70px 60px 96px}
  .lm .lm-an-row .lm-an-sec{display:none}
}

.lm .lm-an-line{stroke:var(--brown)}
[data-theme="dark"] .lm .lm-an-line{stroke:var(--cream)}
.lm .lm-an-pt{fill:var(--card);stroke:var(--brown)}
[data-theme="dark"] .lm .lm-an-pt{stroke:var(--cream)}
.lm .lm-an-pt-label{fill:var(--brown-900)}
[data-theme="dark"] .lm .lm-an-pt-label{fill:var(--cream)}
[data-theme="dark"] .lm .lm-an-pass-label{fill:#F6B8B0}

.lm-open-prompt-scrim{
  position:fixed;
  inset:0;
  z-index:900;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  background:rgba(26,16,8,.55);
  backdrop-filter:blur(3px);
  animation:fadeIn .25s ease;
}

.lm-open-prompt-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  box-shadow:var(--shadow);
  width:100%;
  max-width:440px;
  padding:28px 24px;
}

.lm-open-prompt-title{
  font-size:20px;
  font-weight:800;
  line-height:1.45;
  color:var(--text);
  min-height:58px;
}

.lm-open-prompt-sub{
  margin-top:8px;
  font-size:14px;
  line-height:1.55;
  color:var(--text-2);
}

.lm-open-prompt-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:22px;
}

.lm-upcoming-actions{
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap;
}

/* ------------------------------ Responsive -------------------------------- */

@media (max-width: 820px){

  .lm-tt-body{
    grid-template-columns:1fr;
  }

  .lm-tt-ring{
    width:104px;
    height:104px;
  }

  .lm-tt-ring-core{
    width:76px;
    height:76px;
    font-size:17px;
  }

  .lm-tt-ring-knob{
    transform-origin:50% 48px;
  }

  .lm-tt-qtext{
    font-size:19px;
  }

  .lm-tt-type-cards{
    grid-template-columns:1fr;
  }

  .lm-tt-dis-title{
    font-size:25px;
  }
}
/* ------------------------------ Tests list: spinner ----------------------- */

.lm-spinner-wrap{
  display:grid;
  place-items:center;
  padding:48px 0;
}

.lm-spinner{
  width:44px;
  height:44px;
  border-radius:50%;
  border:4px solid var(--track);
  border-top-color:var(--brown);
  animation:lmSpin .8s linear infinite;
}

@keyframes lmSpin{to{transform:rotate(360deg)}}

/* ------------------------------ Chapter picker ---------------------------- */

.lm-chapter-list{
  display:grid;
  gap:10px;
}

.lm-chapter-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  width:100%;
  text-align:left;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  padding:16px 18px;
  color:var(--text);
  font:inherit;
  font-weight:700;
  cursor:pointer;
  transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.lm-chapter-row:hover{
  border-color:var(--brown);
  transform:translateY(-2px);
  box-shadow:0 10px 20px rgba(122, 47, 0, .12);
}

.lm-chapter-row.is-selected{
  border-color:var(--brown);
  box-shadow:0 0 0 1px var(--brown);
}

.lm-chapter-row-title{
  line-height:1.4;
}

/* ------------------------------ Completed score --------------------------- */

.lm-completed-score{
  font-weight:800;
  font-size:18px;
  color:var(--brown);
}
.lm .notif-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.lm .notif-head h4{margin:4px}
.lm .notif-head .btn-cream{padding:6px 10px;font-size:12px}
.lm .notif{cursor:pointer}
.lm .notif.is-unread{border-left:3px solid var(--brown);background:var(--card-2)}
.lm .lm-loading-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(26,16,8,.55);backdrop-filter:blur(3px);animation:fadeIn .18s ease}
.lm .lm-loading-card{background:var(--card);border:1px solid var(--border);border-radius:20px;box-shadow:0 16px 48px rgba(74,30,0,.28);padding:32px 40px;text-align:center;max-width:min(320px,calc(100vw - 48px))}
.lm .lm-loading-spinner{display:block;width:56px;height:56px;margin:0 auto 16px;border-width:5px}
.lm .lm-loading-brand{font-weight:800;font-size:20px;color:var(--brown);letter-spacing:.2px}
[data-theme="dark"] .lm .lm-loading-brand{color:var(--cream)}
.lm .lm-loading-message{margin-top:8px;font-size:15px;color:var(--text)}
.lm .lm-loading-sub{margin-top:4px;font-size:13px;color:var(--muted)}
.lm .lm-redo-scrim{position:fixed;inset:0;z-index:950;background:rgba(43,22,4,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
.lm .lm-redo-card{background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 60px rgba(43,22,4,.3);max-width:440px;width:100%;padding:26px}
.lm .lm-redo-card h3{font-family:var(--font-display);font-size:24px;color:var(--ink);margin:0 0 8px}
.lm .lm-redo-card p{color:var(--muted);font-size:14.5px;line-height:1.55;margin:0 0 6px}
.lm .lm-redo-card p b{color:var(--ink)}
.lm .lm-redo-actions{display:flex;gap:10px;margin-top:18px}
.lm .lm-redo-actions .btn-brown,.lm .lm-redo-actions .btn-cream{flex:1;justify-content:center}
.lm .lm-dn{position:relative;display:inline-block;margin:0 40px 0 44px;color:#fff}
.lm .lm-dn-input{position:absolute;left:-99em}
.lm .lm-dn-input:focus-visible + .lm-dn-toggle{outline:2px solid var(--cream);outline-offset:3px}
.lm .lm-dn-toggle{cursor:pointer;display:inline-block;position:relative;width:56px;height:32px;background-color:#83d8ff;border-radius:84px;transition:background-color 200ms cubic-bezier(.445,.05,.55,.95)}
.lm .lm-dn-toggle:before{content:"AM";position:absolute;left:-36px;top:10px;font-size:12px;color:#749ed7}
.lm .lm-dn-toggle:after{content:"PM";position:absolute;right:-34px;top:10px;font-size:12px}
.lm .lm-dn-handler{display:inline-block;position:relative;z-index:1;top:2.5px;left:2.5px;width:27px;height:27px;background-color:#ffcf96;border-radius:50px;box-shadow:0 2px 6px rgba(0,0,0,.3);transition:all 400ms cubic-bezier(.68,-.55,.265,1.55);transform:rotate(-45deg)}
.lm .lm-dn-crater{position:absolute;background-color:#e8cda5;opacity:0;transition:opacity 200ms ease-in-out;border-radius:100%}
.lm .lm-dn-crater--1{top:11px;left:6px;width:2.5px;height:2.5px}
.lm .lm-dn-crater--2{top:17px;left:14px;width:4px;height:4px}
.lm .lm-dn-crater--3{top:6px;left:15px;width:5px;height:5px}
.lm .lm-dn-star{position:absolute;background-color:#fff;transition:all 300ms cubic-bezier(.445,.05,.55,.95);border-radius:50%}
.lm .lm-dn-star--1{top:6px;left:22px;z-index:0;width:19px;height:2px}
.lm .lm-dn-star--2{top:12px;left:17px;z-index:1;width:19px;height:2px}
.lm .lm-dn-star--3{top:17px;left:25px;z-index:0;width:19px;height:2px}
.lm .lm-dn-star--4,.lm .lm-dn-star--5,.lm .lm-dn-star--6{opacity:0;transition:all 300ms 0 cubic-bezier(.445,.05,.55,.95)}
.lm .lm-dn-star--4{top:10px;left:7px;z-index:0;width:2px;height:2px;transform:translate3d(2px,0,0)}
.lm .lm-dn-star--5{top:20px;left:11px;z-index:0;width:2px;height:2px;transform:translate3d(2px,0,0)}
.lm .lm-dn-star--6{top:23px;left:17px;z-index:0;width:2px;height:2px;transform:translate3d(2px,0,0)}
.lm .lm-dn-input:checked + .lm-dn-toggle{background-color:#749dd6}
.lm .lm-dn-input:checked + .lm-dn-toggle:before{color:#fff}
.lm .lm-dn-input:checked + .lm-dn-toggle:after{color:#749ed7}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-handler{background-color:#ffe5b5;transform:translate3d(24px,0,0) rotate(0)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-handler .lm-dn-crater{opacity:1}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--1{width:2px;height:2px}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--2{width:4px;height:4px;transform:translate3d(-3px,0,0)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--3{width:2px;height:2px;transform:translate3d(-4px,0,0)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--4,.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--5,.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--6{opacity:1;transform:translate3d(0,0,0)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--4{transition:all 300ms 200ms cubic-bezier(.445,.05,.55,.95)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--5{transition:all 300ms 300ms cubic-bezier(.445,.05,.55,.95)}
.lm .lm-dn-input:checked + .lm-dn-toggle .lm-dn-star--6{transition:all 300ms 400ms cubic-bezier(.445,.05,.55,.95)}
@media (max-width:700px){ .lm .lm-dn{margin:0 30px 0 34px} }
.lm .lesson-video{width:100%;height:100%;border:0;display:block}
.lm .lm-home-tests{display:flex;flex-direction:column;gap:8px}
.lm .lm-home-test{display:flex;justify-content:space-between;align-items:baseline;gap:12px;width:100%;text-align:left;background:var(--card-2);border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;color:var(--text);font:inherit}
.lm .lm-home-test-title{font-weight:700}
.lm .lm-home-test-date{color:var(--muted);font-size:13px;white-space:nowrap}
.lm .lm-home-test-more{margin-top:8px;font-size:13px;color:var(--muted)}
.lm .lm-lesson-watched{margin-top:8px;font-size:13px;color:var(--muted)}
.lm .courses-section-head h2{clip-path:none;-webkit-clip-path:none;mask:none;-webkit-mask:none;transform:none;filter:none;overflow:visible;padding-left:.07em;margin-left:-.07em}
.lm .courses-section-head h2::first-letter{font-family:inherit;font-size:inherit;font-weight:inherit;font-style:normal;float:none;margin:0;padding:0;line-height:inherit;color:inherit;background:none;-webkit-text-fill-color:currentColor}
.lm .courses-section-head{padding:18px 26px 0}
`;

