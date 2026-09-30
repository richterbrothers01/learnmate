"use client";

// ============================================================================
// LearnMate Mark 2 — My Courses UI (frontend only)
// ----------------------------------------------------------------------------
// This file is UI-only. No Supabase auth, no database, no Gemini, no APIs.
// Local React state + mock data so the flow can be demonstrated.
// Supabase / persistence will be connected later at the marked TODOs.
//
// What this file adds (Mark 2):
//   Sidebar "My Courses" -> replaces main content -> typewriter "My Courses"
//   -> Ongoing / Completed tabs -> top-right Uiverse "+ Add Course" button
//   -> "Add a new course" modal -> Select Class + Preferred Subject
//   -> validation toasts -> course added locally (0%, Ongoing)
// ============================================================================

import { useEffect, useRef, useState } from "react";

// ============================================================================
// FUTURE COURSE STRUCTURE (foundation only — no video system yet)
// ----------------------------------------------------------------------------
// Course
// ├── Chapter 1
// │   ├── Milestone 1 (explanatory video + in-video Qs + MCQ + fill-blank)
// │   ├── Milestone 2
// │   └── Milestone 3
// ├── Chapter 2 (its OWN milestones — never share milestones across chapters)
// └── ...
// Later: milestone results feed Analytics; 100% course => Completed tab.
// ============================================================================

type CourseStatus = "ongoing" | "completed";

// Future-facing milestone: video/questions/tests attach here later.
type FutureMilestone = {
    id: string;
    title: string;
    // TODO (later Mark): videoUrl, inVideoQuestions, mcqTestId, fibTestId, result
};

// Milestones live UNDER a chapter — they are different for each chapter.
type FutureChapter = {
    id: string;
    title: string;
    milestones: FutureMilestone[];
};

type Course = {
    id: string;
    title: string; // e.g. "Class 10 Science"
    class: string; // e.g. "Class 10"
    subject: string; // e.g. "Science"
    progress: number; // 0-100. Ongoing = 0-99, Completed = exactly 100
    status: CourseStatus;
    chapters: FutureChapter[];
};

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; msg: string; leaving: boolean };

// Required selections for the Add Course interface.
const CLASSES = [
    "Class 1",
    "Class 2",
    "Class 3",
    "Class 4",
    "Class 5",
    "Class 6",
    "Class 7",
    "Class 8",
    "Class 9",
    "Class 10",
    "Class 11",
    "Class 12",
];

const SUBJECTS = [
    "Information Technology",
    "Science",
    "Social Science",
    "Mathematics",
    "English",
];

function makeId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// Builds a new 0% course with a structural chapter/milestone skeleton.
// TODO: Replace local creation with Supabase insert into `courses`,
// `chapters`, `milestones` tables. Progress will come from DB later.
function makeCourse(cls: string, subject: string): Course {
    const chapters: FutureChapter[] = [1, 2, 3].map((c) => ({
        id: makeId("ch"),
        title: `Chapter ${c}`,
        milestones: [1, 2, 3].map((m) => ({
            id: makeId("ms"),
            title: `Milestone ${m}`,
        })),
    }));
    return {
        id: makeId("course"),
        title: `${cls} ${subject}`,
        class: cls,
        subject,
        progress: 0,
        status: "ongoing",
        chapters,
    };
}

// ----------------------------------------------------------------------------
// Typewriter hook — same feel as the existing LearnMate heading:
// smooth, classy, not too fast, blinking caret handled in JSX/CSS.
// Respects prefers-reduced-motion by showing text instantly.
// ----------------------------------------------------------------------------
function useTypewriter(target: string, start: boolean, speed = 48): { display: string; done: boolean } {
    const [display, setDisplay] = useState<string>(start ? "" : target);
    const [done, setDone] = useState<boolean>(!start);

    useEffect(() => {
        if (!start) {
            setDisplay(target);
            setDone(true);
            return;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setDisplay(target);
            setDone(true);
            return;
        }
        setDisplay("");
        setDone(false);
        let i = 0;
        const id = window.setInterval(() => {
            i += 1;
            setDisplay(target.slice(0, i));
            if (i >= target.length) {
                window.clearInterval(id);
                setDone(true);
            }
        }, speed);
        return () => window.clearInterval(id);
    }, [target, start, speed]);

    return { display, done };
}

export default function Page() {
    // ---- App shell state (preserves existing LearnMate chrome) ----
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeNav, setActiveNav] = useState("My Courses");

    // Main content switching: Dashboard <-> My Courses.
    // Add-course is a modal/page-state layered above Courses.
    const [view, setView] = useState<"dashboard" | "courses">("courses");
    const [addOpen, setAddOpen] = useState(false);

    // ---- My Courses state (local only for now) ----
    // TODO: Replace `courses` with Supabase `courses` table query
    // filtered by the logged-in user. Initial state is intentionally
    // empty so the empty state ("Add new courses") is visible.
    const [courses, setCourses] = useState<Course[]>([]);
    const [tab, setTab] = useState<"ongoing" | "completed">("ongoing");

    // ---- Add-course selections (required, React state only) ----
    // TODO: On submit, insert into Supabase instead of local state.
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

    // ---- Toasts (LearnMate-style, ✓ / ×) ----
    const toastId = useRef(0);
    const [toasts, setToasts] = useState<Toast[]>([]);

    function pushToast(kind: ToastKind, msg: string) {
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev, { id, kind, msg, leaving: false }]);
        // Same timing feel as existing LearnMate toast: ~2.5s visible, then exit.
        window.setTimeout(() => {
            setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        }, 2500);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2950);
    }

    // ---- Theme: keep existing system-preference-then-manual behavior ----
    useEffect(() => {
        const saved = localStorage.getItem("learnmate-theme") as "light" | "dark" | null;
        if (saved) setTheme(saved);
        else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    }, []);

    // Lock body scroll while the Add modal is open (smooth sheet feel).
    useEffect(() => {
        document.body.style.overflow = addOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [addOpen]);

    // Typewriters: dashboard heading, courses heading, add-modal heading.
    // Each heading sits in the SAME h1 position (top of main content).
    const dashType = useTypewriter("Welcome back, Student", view === "dashboard", 42);
    const coursesType = useTypewriter("My Courses", view === "courses" && !addOpen, 55);
    const addType = useTypewriter("Add a new course", addOpen, 38);

    const ongoing = courses.filter((c) => c.progress < 100);
    const completed = courses.filter((c) => c.progress === 100);
    const visible = tab === "ongoing" ? ongoing : completed;

    function goNav(label: string) {
        setActiveNav(label);
        setMenuOpen(false);
        if (label === "My Courses") {
            setView("courses");
            setAddOpen(false);
            return;
        }
        if (label === "Dashboard") {
            setView("dashboard");
            setAddOpen(false);
            return;
        }
        // Other sections belong to later Marks — acknowledge without breaking UI.
        pushToast("error", `${label} is coming in a later update.`);
    }

    function openAdd() {
        setAddOpen(true);
    }

    function closeAdd() {
        setAddOpen(false);
    }

    // Final "Add Course" validation + local insert.
    function submitAdd() {
        if (!selectedClass || !selectedSubject) {
            if (!selectedClass && !selectedSubject)
                pushToast("error", "Please select a class and a preferred subject.");
            else if (!selectedClass) pushToast("error", "Please select a class to continue.");
            else pushToast("error", "Please select a preferred subject to continue.");
            return;
        }
        const course = makeCourse(selectedClass, selectedSubject);
        setCourses((prev) => [course, ...prev]);
        setSelectedClass(null);
        setSelectedSubject(null);
        setTab("ongoing");
        setAddOpen(false);
        pushToast("success", "Course added successfully.");
    }

    return (
        <div className="lm" data-theme={theme}>
            <style>{CSS}</style>

            {/* Mobile scrim for the sidebar drawer */}
            <div
                className={menuOpen ? "lm-scrim show" : "lm-scrim"}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
            />

            <div className="lm-app">
                {/* ================= SIDEBAR (existing LearnMate chrome) ================= */}
                <aside className={menuOpen ? "lm-side open" : "lm-side"} aria-label="Primary">
                    <div className="lm-brand">
                        {/* Existing logos — never modified / recolored / filtered. */}
                        <img className="lm-mark" src="/onlylogo.png" alt="LearnMate logo mark" />
                        <img className="lm-word" src="/textlogo.png" alt="LearnMate" />
                    </div>
                    <nav className="lm-nav" aria-label="Sections">
                        {[
                            { e: "🏠", label: "Dashboard" },
                            { e: "📚", label: "My Courses" },
                            { e: "💡", label: "Doubt Clearer" },
                            { e: "🧠", label: "Quizzes" },
                            { e: "📝", label: "Tests" },
                            { e: "🏆", label: "Milestones" },
                            { e: "📊", label: "Analytics" },
                            { e: "⚙️", label: "Settings" },
                        ].map((n) => (
                            <button
                                key={n.label}
                                type="button"
                                className={activeNav === n.label ? "lm-navbtn active" : "lm-navbtn"}
                                onClick={() => goNav(n.label)}
                                aria-current={activeNav === n.label ? "page" : undefined}
                            >
                                <span className="lm-emoji" aria-hidden="true">
                                    {n.e}
                                </span>
                                {n.label}
                            </button>
                        ))}
                    </nav>
                    <div className="lm-sidefoot">
                        <button
                            type="button"
                            className="lm-themebtn"
                            onClick={() => {
                                setTheme((t) => {
                                    const next = t === "dark" ? "light" : "dark";
                                    localStorage.setItem("learnmate-theme", next);
                                    return next;
                                });
                            }}
                            aria-label="Toggle light and dark mode"
                        >
                            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                        </button>
                    </div>
                </aside>

                {/* ================= MAIN COLUMN ================= */}
                <div className="lm-mainwrap">
                    {/* Top navigation (existing behavior preserved) */}
                    <header className="lm-topbar">
                        <button
                            type="button"
                            className="lm-iconbtn lm-menubtn"
                            onClick={() => setMenuOpen(true)}
                            aria-label="Open menu"
                        >
                            ☰
                        </button>
                        <div className="lm-topspacer" />
                        <button type="button" className="lm-iconbtn" aria-label="Notifications">
                            🔔<span className="lm-dot" aria-hidden="true" />
                        </button>
                        <div className="lm-avatar" aria-label="Profile">
                            S
                        </div>
                    </header>

                    {/* Dashboard placeholder — proves heading position is shared */}
                    {view === "dashboard" && (
                        <main className="lm-content lm-enter" key="dashboard">
                            <div className="lm-headrow">
                                <h1 className="lm-h1" aria-live="polite">
                                    {dashType.display}
                                    {!dashType.done && (
                                        <span className="lm-caret" aria-hidden="true">
                                            ▍
                                        </span>
                                    )}
                                </h1>
                            </div>
                            {dashType.done && (
                                <div className="lm-fadeup">
                                    <p className="lm-sub">This is the existing dashboard surface. Open My Courses from the sidebar.</p>
                                    <button type="button" className="lm-primary" onClick={() => goNav("My Courses")}>
                                        Go to My Courses
                                    </button>
                                </div>
                            )}
                        </main>
                    )}

                    {/* ================= MY COURSES PAGE ================= */}
                    {view === "courses" && (
                        <main className="lm-content lm-enter" key="courses">
                            {/* Heading row: SAME position as "Welcome back" + top-right button */}
                            <div className="lm-headrow">
                                <h1 className="lm-h1" aria-live="polite">
                                    {coursesType.display}
                                    {!coursesType.done && (
                                        <span className="lm-caret" aria-hidden="true">
                                            ▍
                                        </span>
                                    )}
                                </h1>
                                {/* Position-only wrapper: the Uiverse button itself is untouched */}
                                {coursesType.done && (
                                    <div className="uiverse-pos">
                                        {/* From Uiverse.io by nazar-gavrylyk — visual spec frozen */}
                                        <button className="button" type="button" onClick={openAdd} aria-label="Add Course">
                                            <span className="label">+ Add Course</span>
                                            <span className="gradient-container">
                                                <span className="gradient"></span>
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Rest of UI reveals only after the typewriter finishes */}
                            {coursesType.done && (
                                <div className="lm-fadeup">
                                    <p className="lm-sub">
                                        Your learning library. Ongoing holds 0–99% courses; Completed holds exactly 100%.
                                    </p>

                                    {/* Tabs: Ongoing / Completed */}
                                    <div className="lm-tabs" role="tablist" aria-label="Course sections">
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === "ongoing"}
                                            className={tab === "ongoing" ? "lm-tab active" : "lm-tab"}
                                            onClick={() => setTab("ongoing")}
                                        >
                                            Ongoing
                                            <span className="lm-count">{ongoing.length}</span>
                                        </button>
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === "completed"}
                                            className={tab === "completed" ? "lm-tab active" : "lm-tab"}
                                            onClick={() => setTab("completed")}
                                        >
                                            Completed
                                            <span className="lm-count">{completed.length}</span>
                                        </button>
                                    </div>

                                    {/* Course list / empty state */}
                                    {visible.length === 0 ? (
                                        <div className="lm-empty lm-fadeup" role="status">
                                            <p className="lm-emptytitle">Add new courses</p>
                                            <p className="lm-emptysub">
                                                {tab === "ongoing"
                                                    ? "No ongoing courses yet — use + Add Course to get started."
                                                    : "No completed courses yet — finish a course to see it here."}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="lm-grid">
                                            {visible.map((c) => (
                                                <article key={c.id} className="lm-course">
                                                    <div className="lm-coursetop">
                                                        <h3>{c.title}</h3>
                                                        <span className={c.status === "completed" ? "lm-pill done" : "lm-pill"}>
                                                            {c.status === "completed" ? "Completed" : "Ongoing"}
                                                        </span>
                                                    </div>
                                                    <p className="lm-meta">
                                                        {c.class} · {c.subject}
                                                    </p>
                                                    <div
                                                        className="lm-track"
                                                        role="img"
                                                        aria-label={`${c.title} progress ${c.progress} percent`}
                                                    >
                                                        <i style={{ width: `${c.progress}%` }} />
                                                    </div>
                                                    <div className="lm-courserow">
                                                        <span>{c.progress}%</span>
                                                        <span className="lm-muted">
                                                            {c.chapters.length} chapters ·{" "}
                                                            {c.chapters.reduce((n, ch) => n + ch.milestones.length, 0)} milestones
                                                        </span>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </main>
                    )}
                </div>
            </div>

            {/* ================= ADD A NEW COURSE (modal / page-state) ================= */}
            {addOpen && (
                <div
                    className="lm-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) closeAdd();
                    }}
                    role="presentation"
                >
                    <div className="lm-sheet" role="dialog" aria-modal="true" aria-label="Add a new course">
                        <h2 className="lm-h2" aria-live="polite">
                            {addType.display}
                            {!addType.done && (
                                <span className="lm-caret" aria-hidden="true">
                                    ▍
                                </span>
                            )}
                        </h2>

                        {addType.done && (
                            <div className="lm-fadeup">
                                <div className="lm-group">
                                    <p className="lm-label">
                                        Select class <span className="lm-req">*</span>
                                    </p>
                                    <div className="lm-classgrid">
                                        {CLASSES.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                className={selectedClass === c ? "lm-chip active" : "lm-chip"}
                                                onClick={() => setSelectedClass(c)}
                                                aria-pressed={selectedClass === c}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="lm-group">
                                    <p className="lm-label">
                                        Preferred subject <span className="lm-req">*</span>
                                    </p>
                                    <div className="lm-subjlist">
                                        {SUBJECTS.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                className={selectedSubject === s ? "lm-subj active" : "lm-subj"}
                                                onClick={() => setSelectedSubject(s)}
                                                aria-pressed={selectedSubject === s}
                                            >
                                                <span aria-hidden="true">{selectedSubject === s ? "●" : "○"}</span>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="lm-actions">
                                    <button type="button" className="lm-ghost" onClick={closeAdd}>
                                        Cancel
                                    </button>
                                    <button type="button" className="lm-primary" onClick={submitAdd}>
                                        Add Course
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================= TOASTS (LearnMate-style) ================= */}
            <div className="lm-toasts" aria-live="polite" aria-atomic="true">
                {toasts.map((t) => (
                    <div key={t.id} className={t.leaving ? "lm-toast leaving" : t.kind === "success" ? "lm-toast ok" : "lm-toast err"}>
                        <span className="lm-toastmark" aria-hidden="true">
                            {t.kind === "success" ? "✓" : "×"}
                        </span>
                        {t.msg}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// STYLES — kept inside the TSX so no separate CSS file is required.
// LearnMate brown/cream only. Hover is minimal (background-color only).
// The Uiverse "+ Add Course" block below is EXACTLY as provided —
// only its POSITION (top-right via .uiverse-pos) was set by us.
// ============================================================================
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
.lm{font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#FAF4E8;color:#3D220F;min-height:100vh;-webkit-font-smoothing:antialiased}
.lm[data-theme="dark"]{background:#17100A;color:#F6E8D0}
.lm-app{display:flex;min-height:100vh}
.lm-side{width:236px;flex-shrink:0;background:#4A1E00;color:#F5E7CC;position:fixed;inset:0 auto 0 0;height:100dvh;display:flex;flex-direction:column;padding:18px 14px 14px;z-index:50}
.lm-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 16px}
.lm-mark{width:40px;height:40px;object-fit:contain;border-radius:10px}
.lm-word{height:26px;object-fit:contain}
.lm-nav{display:flex;flex-direction:column;gap:4px}
.lm-navbtn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 12px;border-radius:12px;font-size:14px;font-weight:500;color:#F5E7CC;background:none;border:0;cursor:pointer;font:inherit}
.lm-navbtn:hover{background:rgba(233,198,137,.14)}
.lm-navbtn.active{background:rgba(233,198,137,.18);box-shadow:inset 0 0 0 1px rgba(233,198,137,.18);font-weight:600}
.lm-emoji{width:20px;text-align:center}
.lm-sidefoot{margin-top:auto;border-top:1px solid rgba(233,198,137,.22);padding-top:10px}
.lm-themebtn{width:100%;text-align:left;padding:11px 12px;border-radius:12px;background:none;border:0;color:#F5E7CC;cursor:pointer;font:inherit;font-size:14px}
.lm-themebtn:hover{background:rgba(233,198,137,.14)}
.lm-mainwrap{flex:1;margin-left:236px;min-width:0;display:flex;flex-direction:column}
.lm-topbar{display:flex;align-items:center;gap:12px;padding:16px 24px 0}
.lm-topspacer{flex:1}
.lm-iconbtn{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:none;border:0;cursor:pointer;color:inherit;font-size:18px;position:relative}
.lm-iconbtn:hover{background:#F1E2C4}
.lm[data-theme="dark"] .lm-iconbtn:hover{background:#2E1F10}
.lm-menubtn{display:none}
.lm-dot{position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:#D92D20}
.lm-avatar{width:40px;height:40px;border-radius:50%;background:#E9C689;color:#4A1E00;display:grid;place-items:center;font-weight:800}
.lm-content{padding:18px 28px 40px;max-width:1080px}
.lm-headrow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.lm-h1{font-size:34px;letter-spacing:-.02em;font-weight:800;line-height:1.15;min-height:48px}
.lm-h2{font-size:26px;letter-spacing:-.01em;font-weight:800;min-height:36px;margin-bottom:6px}
.lm-caret{display:inline-block;margin-left:2px;animation:lmblink 1s steps(1) infinite;color:#7A2F00}
.lm[data-theme="dark"] .lm-caret{color:#E9C689}
@keyframes lmblink{50%{opacity:0}}
.lm-sub{color:#6B4A2E;margin:8px 0 16px;font-size:15px}
.lm[data-theme="dark"] .lm-sub{color:#D8BE95}
.lm-tabs{display:inline-flex;gap:6px;background:#FFFDF7;border:1px solid #E8DBC0;border-radius:999px;padding:5px;margin-bottom:18px}
.lm[data-theme="dark"] .lm-tabs{background:#221609;border-color:#3A2512}
.lm-tab{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;border:0;background:none;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:#6B4A2E}
.lm-tab:hover{background:#F6E6C6}
.lm-tab.active{background:#7A2F00;color:#FFF6E3}
.lm-count{background:rgba(122,47,0,.12);border-radius:999px;padding:1px 8px;font-size:12px}
.lm-tab.active .lm-count{background:rgba(255,255,255,.22)}
.lm-empty{background:#FFFDF7;border:1px solid #E8DBC0;border-radius:16px;padding:56px 24px;text-align:center;box-shadow:0 1px 2px rgba(122,47,0,.06)}
.lm[data-theme="dark"] .lm-empty{background:#221609;border-color:#3A2512}
.lm-emptytitle{font-size:20px;font-weight:700}
.lm-emptysub{color:#8A6F52;font-size:14px;margin-top:8px}
.lm[data-theme="dark"] .lm-emptysub{color:#A68A65}
.lm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.lm-course{background:#FFFDF7;border:1px solid #E8DBC0;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(122,47,0,.06)}
.lm[data-theme="dark"] .lm-course{background:#221609;border-color:#3A2512}
.lm-coursetop{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lm-coursetop h3{font-size:16px}
.lm-pill{font-size:12px;font-weight:700;background:#F6E6C6;color:#7A2F00;border-radius:999px;padding:5px 11px;white-space:nowrap}
.lm-pill.done{background:#7A2F00;color:#FFF6E3}
.lm-meta{font-size:13px;color:#6B4A2E;margin:6px 0 4px}
.lm[data-theme="dark"] .lm-meta{color:#D8BE95}
.lm-track{height:8px;background:#EDE0C6;border-radius:999px;overflow:hidden;margin-top:10px}
.lm[data-theme="dark"] .lm-track{background:#3A2A18}
.lm-track i{display:block;height:100%;width:0;background:#7A2F00;border-radius:999px;transition:width .8s ease}
.lm-courserow{display:flex;justify-content:space-between;font-size:12.5px;margin-top:8px}
.lm-muted{color:#8A6F52}
.lm-group{margin:16px 0}
.lm-label{font-size:14px;font-weight:700;margin-bottom:10px}
.lm-req{color:#B3261E}
.lm-classgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.lm-chip{padding:11px 6px;border-radius:12px;border:1px solid #E8DBC0;background:#FFFDF7;cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#3D220F;min-height:44px}
.lm-chip:hover{background:#F6E6C6}
.lm-chip.active{background:#7A2F00;border-color:#7A2F00;color:#FFF6E3}
.lm[data-theme="dark"] .lm-chip{background:#281B0D;border-color:#3A2512;color:#F6E8D0}
.lm-subjlist{display:flex;flex-direction:column;gap:8px}
.lm-subj{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid #E8DBC0;background:#FFFDF7;cursor:pointer;font:inherit;font-size:14px;text-align:left;min-height:48px}
.lm-subj:hover{background:#F6E6C6}
.lm-subj.active{border-color:#7A2F00;background:#FBF0D8;font-weight:700}
.lm[data-theme="dark"] .lm-subj{background:#281B0D;border-color:#3A2512;color:#F6E8D0}
.lm-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.lm-ghost{padding:12px 18px;border-radius:12px;border:1px solid #E8DBC0;background:transparent;cursor:pointer;font:inherit;font-weight:600;min-height:48px}
.lm-ghost:hover{background:#F6E6C6}
.lm-primary{padding:12px 20px;border-radius:12px;border:0;background:#7A2F00;color:#FFF6E3;cursor:pointer;font:inherit;font-weight:700;min-height:48px}
.lm-primary:hover{background:#8A3A05}
.lm-overlay{position:fixed;inset:0;background:rgba(40,18,0,.45);display:grid;place-items:center;z-index:80;padding:16px;animation:lmfade .25s ease}
.lm-sheet{width:min(640px,100%);max-height:88dvh;overflow:auto;background:#FFFDF7;border:1px solid #E8DBC0;border-radius:20px;padding:22px;box-shadow:0 24px 64px rgba(74,30,0,.25);animation:lmsheet .3s ease}
.lm[data-theme="dark"] .lm-sheet{background:#221609;border-color:#3A2512}
.lm-toasts{position:fixed;right:18px;bottom:18px;display:flex;flex-direction:column;gap:10px;z-index:100;max-width:min(360px,calc(100vw - 36px))}
.lm-toast{display:flex;align-items:center;gap:10px;background:#4A1E00;color:#FFF3DC;border-radius:12px;padding:13px 15px;font-size:14px;font-weight:600;box-shadow:0 12px 32px rgba(0,0,0,.25);animation:lmtoastin .28s ease}
.lm-toast.ok .lm-toastmark{background:#2E7D32}
.lm-toast.err .lm-toastmark{background:#B3261E}
.lm-toastmark{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:14px;flex-shrink:0}
.lm-toast.leaving{opacity:0;transform:translateY(6px);transition:opacity .3s ease,transform .3s ease}
.lm-enter{animation:lmfade .3s ease}
.lm-fadeup{animation:lmfadeup .45s ease both}
@keyframes lmfade{from{opacity:0}to{opacity:1}}
@keyframes lmfadeup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes lmtoastin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lmsheet{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.uiverse-pos{margin-left:auto;position:relative;z-index:1;flex-shrink:0;isolation:isolate}
.lm-scrim{display:none}
@media(max-width:900px){.lm-grid{grid-template-columns:1fr}.lm-classgrid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:860px){.lm-side{transform:translateX(-105%);transition:transform .28s ease;border-radius:0 20px 20px 0}.lm-side.open{transform:none;box-shadow:0 0 60px rgba(0,0,0,.35)}.lm-mainwrap{margin-left:0}.lm-menubtn{display:grid}.lm-scrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:40;display:none}.lm-scrim.show{display:block}.lm-content{padding:14px 16px 40px}.lm-h1{font-size:27px}.lm-headrow{flex-direction:column;align-items:stretch}.uiverse-pos{align-self:flex-end;margin-left:0;margin-top:4px}.lm-actions{flex-direction:column-reverse}.lm-actions .lm-ghost,.lm-actions .lm-primary{width:100%}}
@media (prefers-reduced-motion:reduce){.lm-enter,.lm-fadeup,.lm-overlay,.lm-sheet,.lm-toast,.lm-caret{animation:none!important}.lm-fadeup,.lm-enter{opacity:1!important;transform:none!important}.lm-track i{transition:none}}

/* From Uiverse.io by nazar-gavrylyk */
.button {
  border: none;
  outline: none;
  background-color: #3a3a3a;
  width: 180px;
  height: 60px;
  font-size: 18px;
  color: #fff;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  position: relative;
  transition: all 0.3s;
}

.button::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  width: 106%;
  height: 120%;
  z-index: -1;
  border-radius: inherit;
  transition: all 0.3s;
}

.gradient-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 106%;
  height: 115%;
  overflow: hidden;
  border-radius: inherit;
  z-index: -2;
  filter: blur(10px);
  transition: all 0.3s;
}

.gradient {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 110%;
  aspect-ratio: 1;
  border-radius: 100%;
  transition: all 0.3s;
  background-image: linear-gradient(
    90deg,
    hsl(226, 81%, 64%),
    hsl(271, 81%, 64%),
    hsl(316, 81%, 64%),
    hsl(1, 81%, 64%),
    hsl(46, 81%, 64%),
    hsl(91, 81%, 64%),
    hsl(136, 81%, 64%),
    hsl(181, 81%, 64%)
  );
  animation: rotate 2s linear infinite;
  filter: blur(10px);
}

.label {
  width: 156px;
  height: 45px;
  text-align: center;
  line-height: 45px;
  border-radius: 22px;
  background-color: rgba(43, 43, 43, 1);
  background-image: linear-gradient(
    180deg,
    rgb(43, 43, 43) 0%,
    rgb(68, 68, 68) 100%
  );
}

.button:hover .gradient-container {
  transform: translate(-50%, -50%) scale(0.98);
  filter: blur(5px);
}

.button:hover .gradient {
  filter: blur(5px);
}

@keyframes rotate {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
`;