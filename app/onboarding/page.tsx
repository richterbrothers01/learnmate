"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

type Answers = {
    aim: string | null;
    learning_for: string | null;
    learning_style: string | null;
    starting_level: string | null;
    improve: string | null;
};

type Question = {
    key: keyof Answers;
    eyebrow: string;
    title: string;
    sub: string;
    options: {
        value: string;
        label: string;
        icon: string;
    }[];
};

const QUESTIONS: Question[] = [
    {
        key: "aim",
        eyebrow: "01 / GETTING STARTED",
        title: "What's your aim?",
        sub: "Choose where you want to begin.",
        options: [
            {
                value: "new",
                label: "Learn something new",
                icon: "sprout",
            },
            {
                value: "improve",
                label: "Improve what I already know",
                icon: "chart",
            },
        ],
    },
    {
        key: "learning_for",
        eyebrow: "02 / YOUR PURPOSE",
        title: "What are you learning for?",
        sub: "Tell us what you're working towards.",
        options: [
            {
                value: "exams",
                label: "Study/exams",
                icon: "cap",
            },
            {
                value: "growth",
                label: "Personal/career growth",
                icon: "brief",
            },
        ],
    },
    {
        key: "learning_style",
        eyebrow: "03 / YOUR STYLE",
        title: "How do you learn best?",
        sub: "Pick the approach that feels natural to you.",
        options: [
            {
                value: "see",
                label: "See & understand",
                icon: "eye",
            },
            {
                value: "practice",
                label: "Practice and apply",
                icon: "bolt",
            },
        ],
    },
    {
        key: "starting_level",
        eyebrow: "04 / STARTING POINT",
        title: "Where are you starting from?",
        sub: "There are no wrong answers here.",
        options: [
            {
                value: "beginner",
                label: "I am a beginner",
                icon: "user",
            },
            {
                value: "basics",
                label: "I know the basics",
                icon: "book",
            },
        ],
    },
    {
        key: "improve",
        eyebrow: "05 / YOUR FOCUS",
        title: "What would you like to improve?",
        sub: "We'll use this to shape your experience.",
        options: [
            {
                value: "knowledge",
                label: "Knowledge",
                icon: "book2",
            },
            {
                value: "skills",
                label: "Skills",
                icon: "gear",
            },
        ],
    },
];

const INITIAL_ANSWERS: Answers = {
    aim: null,
    learning_for: null,
    learning_style: null,
    starting_level: null,
    improve: null,
};

const TYPE_SPEED = 38;
const OPTION_DELAY = 160;
const QUESTION_TRANSITION = 650;
const LOADER_DURATION = 3200;

function Icon({ name }: { name: string }) {
    const stroke = "#7A2F00";

    const common = {
        width: 22,
        height: 22,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke,
        strokeWidth: 1.7,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    };

    switch (name) {
        case "sprout":
            return (
                <svg {...common}>
                    <path d="M12 21V11" />
                    <path d="M12 14C8 14 5.5 11.5 5.5 7.5C9.5 7.5 12 10 12 14Z" />
                    <path d="M12 11C12 7 14.5 4.5 18.5 4.5C18.5 8.5 16 11 12 11Z" />
                </svg>
            );

        case "chart":
            return (
                <svg {...common}>
                    <path d="M4 19V5" />
                    <path d="M4 19H20" />
                    <path d="M7 15L10.5 11.5L13 14L19 7" />
                    <path d="M15.5 7H19V10.5" />
                </svg>
            );

        case "cap":
            return (
                <svg {...common}>
                    <path d="M3 9.5L12 5L21 9.5L12 14L3 9.5Z" />
                    <path d="M6 11.5V16C9 18 15 18 18 16V11.5" />
                    <path d="M21 10V15" />
                </svg>
            );

        case "brief":
            return (
                <svg {...common}>
                    <rect x="3.5" y="6.5" width="17" height="12.5" rx="2" />
                    <path d="M9 6.5V5C9 4.45 9.45 4 10 4H14C14.55 4 15 4.45 15 5V6.5" />
                    <path d="M3.5 11H20.5" />
                    <path d="M10 11V13H14V11" />
                </svg>
            );

        case "eye":
            return (
                <svg {...common}>
                    <path d="M2.5 12S6 6.5 12 6.5S21.5 12 21.5 12S18 17.5 12 17.5S2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.7" />
                </svg>
            );

        case "bolt":
            return (
                <svg {...common}>
                    <path d="M13.5 2.5L5 13H11L10.5 21.5L19 10.5H13L13.5 2.5Z" />
                </svg>
            );

        case "user":
            return (
                <svg {...common}>
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20C5.8 16.7 8.1 15 12 15S18.2 16.7 19 20" />
                </svg>
            );

        case "book":
        case "book2":
            return (
                <svg {...common}>
                    <path d="M5 4.5H17.5C18.9 4.5 20 5.6 20 7V19.5H7C5.9 19.5 5 18.6 5 17.5V4.5Z" />
                    <path d="M5 17.5C5 16.4 5.9 15.5 7 15.5H20" />
                    <path d="M9 8H16" />
                    <path d="M9 11H14" />
                </svg>
            );

        case "gear":
            return (
                <svg {...common}>
                    <path d="M12 8.2A3.8 3.8 0 1 0 12 15.8A3.8 3.8 0 0 0 12 8.2Z" />
                    <path d="M19.4 13.5L21 14.4L19.4 17.1L17.7 16.4C17.2 16.9 16.6 17.3 16 17.6L15.8 19.5H12.7L12.4 17.6C11.7 17.4 11.1 17.1 10.5 16.7L8.8 17.4L7.2 14.7L8.7 13.5C8.6 12.8 8.6 12.2 8.7 11.5L7.2 10.3L8.8 7.6L10.5 8.3C11.1 7.9 11.7 7.6 12.4 7.4L12.7 5.5H15.8L16 7.4C16.6 7.7 17.2 8.1 17.7 8.6L19.4 7.9L21 10.6L19.4 11.5C19.5 12.2 19.5 12.8 19.4 13.5Z" />
                </svg>
            );

        default:
            return null;
    }
}

export default function OnboardingPage() {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
    const [typedText, setTypedText] = useState("");
    const [showOptions, setShowOptions] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [transitioning, setTransitioning] = useState(false);
    const [loaderExiting, setLoaderExiting] = useState(false);
    const [parallax, setParallax] = useState({ x: 0, y: 0 });

    const timeoutRefs = useRef<number[]>([]);

    const isQuestion = step >= 0 && step < QUESTIONS.length;
    const isLoader = step === QUESTIONS.length;
    const isComplete = step === QUESTIONS.length + 1;

    const currentQuestion = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];

    const clearTimers = useCallback(() => {
        timeoutRefs.current.forEach((id) => window.clearTimeout(id));
        timeoutRefs.current = [];
    }, []);

    const later = useCallback((callback: () => void, delay: number) => {
        const id = window.setTimeout(callback, delay);
        timeoutRefs.current.push(id);
        return id;
    }, []);

    useEffect(() => {
        return () => {
            clearTimers();
        };
    }, [clearTimers]);

    /*
     * Question typewriter
     */
    useEffect(() => {
        if (!isQuestion) return;

        setTypedText("");
        setShowOptions(false);
        setSelected(null);
        setTransitioning(false);

        let index = 0;

        const interval = window.setInterval(() => {
            index += 1;
            setTypedText(currentQuestion.title.slice(0, index));

            if (index >= currentQuestion.title.length) {
                window.clearInterval(interval);

                later(() => {
                    setShowOptions(true);
                }, OPTION_DELAY);
            }
        }, TYPE_SPEED);

        return () => {
            window.clearInterval(interval);
        };
    }, [step, isQuestion, currentQuestion.title, later]);

    /*
     * Loader
     */
    useEffect(() => {
        if (!isLoader) return;

        setLoaderExiting(false);

        const loaderTimer = window.setTimeout(() => {
            setLoaderExiting(true);

            later(() => {
                setStep(QUESTIONS.length + 1);
                setLoaderExiting(false);
            }, 450);
        }, LOADER_DURATION);

        return () => {
            window.clearTimeout(loaderTimer);
        };
    }, [isLoader, later]);

    /*
     * Save onboarding answers temporarily.
     * This does NOT call Gemini or Supabase.
     */
    useEffect(() => {
        if (typeof window === "undefined") return;

        if (Object.values(answers).some(Boolean)) {
            window.sessionStorage.setItem(
                "learnmate_onboarding_answers",
                JSON.stringify(answers)
            );
        }
    }, [answers]);

    /*
     * Mouse / pointer parallax for PC.
     */
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();

        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;

        setParallax({
            x: Math.max(-0.5, Math.min(0.5, x)),
            y: Math.max(-0.5, Math.min(0.5, y)),
        });
    };

    const resetParallax = () => {
        setParallax({ x: 0, y: 0 });
    };

    const chooseOption = (index: number) => {
        if (!isQuestion || !showOptions || transitioning) return;

        setSelected(index);
        setTransitioning(true);

        const value = currentQuestion.options[index].value;

        setAnswers((previous) => ({
            ...previous,
            [currentQuestion.key]: value,
        }));

        later(() => {
            setStep((previous) => previous + 1);
        }, QUESTION_TRANSITION);
    };

    const handleContinue = () => {
        /*
         * Remember that this browser has completed onboarding.
         *
         * This prevents a user who logs out later from being
         * shown the onboarding questions again.
         */
        window.localStorage.setItem(
            "learnmate_onboarding_completed",
            "true"
        );

        window.location.href = "/auth";
    };

    return (
        <>
            <div
                className="lm-root"
                onPointerMove={handlePointerMove}
                onPointerLeave={resetParallax}
            >
                {/* BACKGROUND */}
                <div className="lm-background" aria-hidden="true">
                    <div
                        className="lm-glow lm-glow-one"
                        style={{
                            transform: `translate3d(${parallax.x * 34}px, ${parallax.y * 34
                                }px, 0)`,
                        }}
                    />

                    <div
                        className="lm-glow lm-glow-two"
                        style={{
                            transform: `translate3d(${parallax.x * -24}px, ${parallax.y * -24
                                }px, 0)`,
                        }}
                    />

                    <div
                        className="lm-glow lm-glow-three"
                        style={{
                            transform: `translate3d(${parallax.x * 16}px, ${parallax.y * -18
                                }px, 0)`,
                        }}
                    />

                    <div className="lm-noise" />
                </div>

                {/* MAIN */}
                <main className="lm-main">
                    <section
                        className={`lm-card ${transitioning || loaderExiting ? "is-transitioning" : ""
                            }`}
                        style={{
                            transform: `translate3d(${parallax.x * 7}px, ${parallax.y * 7
                                }px, 0)`,
                        }}
                    >
                        {/* QUESTION */}
                        {isQuestion && (
                            <div
                                key={`question-${step}`}
                                className={`lm-question ${transitioning ? "question-out" : "question-in"
                                    }`}
                            >
                                <div className="lm-progress-row">
                                    <span className="lm-eyebrow">
                                        {currentQuestion.eyebrow}
                                    </span>

                                    <span className="lm-counter">
                                        {String(step + 1).padStart(2, "0")} / 05
                                    </span>
                                </div>

                                <div className="lm-heading-area">
                                    <h1 className="lm-title">
                                        {typedText}
                                        <span
                                            className={`lm-caret ${typedText.length >= currentQuestion.title.length
                                                    ? "caret-done"
                                                    : ""
                                                }`}
                                        />
                                    </h1>

                                    <p className="lm-subtitle">{currentQuestion.sub}</p>
                                </div>

                                <div
                                    className={`lm-options ${showOptions ? "options-visible" : "options-hidden"
                                        }`}
                                >
                                    {currentQuestion.options.map((option, index) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={`lm-option ${selected === index ? "selected" : ""
                                                } ${selected !== null && selected !== index ? "muted" : ""}`}
                                            onClick={() => chooseOption(index)}
                                            disabled={!showOptions || transitioning}
                                        >
                                            <span className="lm-option-left">
                                                <span className="lm-option-icon">
                                                    <Icon name={option.icon} />
                                                </span>

                                                <span className="lm-option-label">
                                                    {option.label}
                                                </span>
                                            </span>

                                            <span className="lm-option-arrow">→</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="lm-footer">
                                    <div className="lm-dots" aria-hidden="true">
                                        {QUESTIONS.map((_, index) => (
                                            <span
                                                key={index}
                                                className={index === step ? "active" : ""}
                                            />
                                        ))}
                                    </div>

                                    <span className="lm-footer-text">
                                        Choose one to continue
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* LOADER */}
                        {isLoader && (
                            <div
                                className={`lm-loader ${loaderExiting ? "loader-out" : "loader-in"
                                    }`}
                            >
                                <div className="lm-orb-container">
                                    <ThinkingOrb state="working" size={64} />
                                </div>

                                <div className="lm-loader-copy">
                                    <h2>Creating your personalized experience</h2>

                                    <p>
                                        Just a moment — setting things up
                                        <br className="desktop-break" /> for you.
                                    </p>
                                </div>

                                <div className="lm-loading-line">
                                    <span />
                                </div>
                            </div>
                        )}

                        {/* COMPLETE */}
                        {isComplete && (
                            <div className="lm-complete">
                                <div className="lm-success-icon" aria-hidden="true">
                                    <svg
                                        width="25"
                                        height="25"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M5 12.5L9.2 16.5L19 7.5" />
                                    </svg>
                                </div>

                                <div className="lm-complete-copy">
                                    <h2>You&apos;re all set</h2>

                                    <p>
                                        Your learning profile has been created.
                                        <br className="desktop-break" />
                                        Let&apos;s get you started.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="lm-continue"
                                    onClick={handleContinue}
                                >
                                    <span>Continue</span>
                                    <span className="lm-continue-arrow">→</span>
                                </button>

                                <div className="lm-complete-footer">
                                    <div className="lm-dots" aria-hidden="true">
                                        {QUESTIONS.map((_, index) => (
                                            <span key={index} className="active" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="lm-bottom-hint">
                        <span className="lm-key">ESC</span>
                        <span>LearnMate</span>
                    </div>
                </main>
            </div>

            <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html),
        :global(body) {
          margin: 0;
          padding: 0;
          min-height: 100%;
        }

        :global(body) {
          overflow-x: hidden;
        }

        :global(button) {
          font: inherit;
        }

        .lm-root {
          --accent: #7a2f00;
          --accent-dark: #5e2200;
          --accent-soft: rgba(122, 47, 0, 0.08);
          --cream: #fdf8ed;
          --cream-deep: #f4ecdc;
          --ink: #24170f;
          --muted: #806f61;
          --line: rgba(80, 49, 29, 0.13);

          position: relative;
          min-height: 100svh;
          width: 100%;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 18% 20%,
              rgba(184, 105, 43, 0.22),
              transparent 30%
            ),
            radial-gradient(
              circle at 83% 78%,
              rgba(137, 65, 17, 0.2),
              transparent 34%
            ),
            linear-gradient(135deg, #321100 0%, #451900 48%, #2b0e00 100%);
          color: var(--ink);
          isolation: isolate;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .lm-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .lm-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(2px);
          opacity: 0.8;
          transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .lm-glow-one {
          width: min(38vw, 520px);
          height: min(38vw, 520px);
          left: -11%;
          top: -16%;
          background: radial-gradient(
            circle,
            rgba(207, 125, 52, 0.25) 0%,
            rgba(207, 125, 52, 0.08) 42%,
            transparent 72%
          );
        }

        .lm-glow-two {
          width: min(45vw, 600px);
          height: min(45vw, 600px);
          right: -15%;
          bottom: -24%;
          background: radial-gradient(
            circle,
            rgba(180, 82, 17, 0.25) 0%,
            rgba(180, 82, 17, 0.08) 42%,
            transparent 72%
          );
        }

        .lm-glow-three {
          width: min(22vw, 310px);
          height: min(22vw, 310px);
          left: 48%;
          top: 12%;
          background: radial-gradient(
            circle,
            rgba(255, 183, 103, 0.11) 0%,
            transparent 70%
          );
        }

        .lm-noise {
          position: absolute;
          inset: -50%;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");
          transform: rotate(8deg);
        }

        .lm-main {
          position: relative;
          min-height: 100svh;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 42px 24px 34px;
        }

        .lm-card {
          position: relative;
          width: min(700px, calc(100vw - 48px));
          min-height: 540px;
          display: flex;
          align-items: stretch;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.55);
          border-radius: 30px;
          background: rgba(253, 248, 237, 0.95);
          box-shadow:
            0 38px 90px rgba(20, 7, 0, 0.32),
            0 12px 35px rgba(20, 7, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          transition:
            transform 700ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 450ms ease,
            filter 450ms ease;
          overflow: hidden;
        }

        .lm-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              125deg,
              rgba(255, 255, 255, 0.46),
              transparent 30%
            ),
            linear-gradient(
              310deg,
              rgba(122, 47, 0, 0.025),
              transparent 35%
            );
        }

        .lm-card.is-transitioning {
          filter: blur(0.4px);
        }

        .lm-question,
        .lm-loader,
        .lm-complete {
          position: relative;
          width: 100%;
          min-height: 540px;
          padding: 54px 58px 44px;
          display: flex;
          flex-direction: column;
          z-index: 1;
        }

        .lm-question.question-in {
          animation: questionIn 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .lm-question.question-out {
          animation: questionOut 600ms cubic-bezier(0.55, 0, 0.85, 0.35) both;
        }

        @keyframes questionIn {
          from {
            opacity: 0;
            transform: translate3d(30px, 0, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes questionOut {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate3d(-28px, 0, 0) scale(0.985);
          }
        }

        .lm-progress-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .lm-eyebrow {
          color: var(--accent);
          font-size: 11px;
          line-height: 1;
          font-weight: 750;
          letter-spacing: 0.16em;
        }

        .lm-counter {
          color: rgba(36, 23, 15, 0.4);
          font-size: 11px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .lm-heading-area {
          margin-top: 66px;
        }

        .lm-title {
          min-height: 76px;
          margin: 0;
          color: var(--ink);
          font-family:
            Georgia, "Times New Roman", Times, serif;
          font-size: clamp(42px, 5vw, 62px);
          line-height: 1.05;
          font-weight: 500;
          letter-spacing: -0.045em;
        }

        .lm-caret {
          display: inline-block;
          width: 2px;
          height: 0.84em;
          margin-left: 5px;
          vertical-align: -0.06em;
          border-radius: 2px;
          background: var(--accent);
          animation: caretBlink 800ms ease-in-out infinite;
        }

        .lm-caret.caret-done {
          opacity: 0.55;
        }

        @keyframes caretBlink {
          0%,
          45% {
            opacity: 1;
          }
          46%,
          100% {
            opacity: 0;
          }
        }

        .lm-subtitle {
          margin: 16px 0 0;
          max-width: 480px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.7;
          font-weight: 450;
        }

        .lm-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 13px;
          margin-top: 48px;
          transition:
            opacity 450ms ease,
            transform 450ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .lm-options.options-hidden {
          opacity: 0;
          transform: translateY(13px);
          pointer-events: none;
        }

        .lm-options.options-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .lm-options.options-visible .lm-option {
          animation: optionIn 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .lm-options.options-visible .lm-option:nth-child(2) {
          animation-delay: 65ms;
        }

        @keyframes optionIn {
          from {
            opacity: 0;
            transform: translateY(13px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lm-option {
          position: relative;
          min-height: 76px;
          width: 100%;
          padding: 13px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.48);
          color: var(--ink);
          cursor: pointer;
          text-align: left;
          outline: none;
          transition:
            transform 250ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 250ms ease,
            background 250ms ease,
            box-shadow 250ms ease,
            opacity 250ms ease;
        }

        .lm-option::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.35),
            transparent 55%
          );
          opacity: 0;
          transition: opacity 250ms ease;
        }

        .lm-option:hover:not(:disabled) {
          transform: translateY(-3px);
          border-color: rgba(122, 47, 0, 0.28);
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 13px 28px rgba(64, 29, 9, 0.09);
        }

        .lm-option:hover:not(:disabled)::after {
          opacity: 1;
        }

        .lm-option:focus-visible {
          box-shadow:
            0 0 0 3px rgba(122, 47, 0, 0.12),
            0 13px 28px rgba(64, 29, 9, 0.08);
          border-color: rgba(122, 47, 0, 0.38);
        }

        .lm-option.selected {
          transform: translateY(-2px);
          border-color: var(--accent);
          background: rgba(122, 47, 0, 0.085);
          box-shadow: 0 14px 30px rgba(122, 47, 0, 0.1);
        }

        .lm-option.muted {
          opacity: 0.38;
        }

        .lm-option-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lm-option-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 43px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(122, 47, 0, 0.11);
          border-radius: 13px;
          background: rgba(122, 47, 0, 0.055);
        }

        .lm-option-label {
          min-width: 0;
          font-size: 13.5px;
          line-height: 1.35;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .lm-option-arrow {
          flex: 0 0 auto;
          color: var(--accent);
          font-size: 18px;
          line-height: 1;
          transform: translateX(0);
          transition: transform 250ms ease;
        }

        .lm-option:hover:not(:disabled) .lm-option-arrow {
          transform: translateX(4px);
        }

        .lm-footer {
          margin-top: auto;
          padding-top: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .lm-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .lm-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(36, 23, 15, 0.18);
          transition:
            width 300ms ease,
            background 300ms ease;
        }

        .lm-dots span.active {
          width: 18px;
          border-radius: 20px;
          background: var(--accent);
        }

        .lm-footer-text {
          color: rgba(36, 23, 15, 0.38);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        /* LOADER */

        .lm-loader {
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .lm-loader.loader-in {
          animation: loaderIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .lm-loader.loader-out {
          animation: loaderOut 450ms cubic-bezier(0.55, 0, 0.85, 0.35)
            both;
        }

        @keyframes loaderIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes loaderOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-14px) scale(0.985);
          }
        }

        .lm-orb-container {
          width: 100px;
          height: 100px;
          display: grid;
          place-items: center;
          margin-bottom: 30px;
          border-radius: 50%;
          background: rgba(122, 47, 0, 0.055);
          box-shadow:
            0 0 0 12px rgba(122, 47, 0, 0.018),
            0 18px 45px rgba(83, 33, 6, 0.09);
        }

        .lm-loader-copy h2 {
          margin: 0;
          max-width: 440px;
          color: var(--ink);
          font-family:
            Georgia, "Times New Roman", Times, serif;
          font-size: clamp(27px, 3.2vw, 38px);
          line-height: 1.15;
          font-weight: 500;
          letter-spacing: -0.035em;
        }

        .lm-loader-copy p {
          margin: 15px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.65;
        }

        .lm-loading-line {
          position: relative;
          width: min(280px, 70%);
          height: 3px;
          margin-top: 36px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(122, 47, 0, 0.09);
        }

        .lm-loading-line span {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 34%;
          border-radius: inherit;
          background: var(--accent);
          animation: loadingLine ${LOADER_DURATION}ms
            cubic-bezier(0.25, 0.7, 0.2, 1) forwards;
        }

        @keyframes loadingLine {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        /* COMPLETE */

        .lm-complete {
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .lm-success-icon {
          width: 66px;
          height: 66px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: var(--accent);
          background: rgba(122, 47, 0, 0.075);
          border: 1px solid rgba(122, 47, 0, 0.11);
          box-shadow:
            0 0 0 10px rgba(122, 47, 0, 0.025),
            0 17px 35px rgba(83, 33, 6, 0.08);
          animation: successIn 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes successIn {
          from {
            opacity: 0;
            transform: scale(0.65) translateY(8px);
          }
          65% {
            transform: scale(1.07);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .lm-complete-copy {
          margin-top: 28px;
          animation: completeCopyIn 650ms 100ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes completeCopyIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lm-complete-copy h2 {
          margin: 0;
          color: var(--ink);
          font-family:
            Georgia, "Times New Roman", Times, serif;
          font-size: clamp(38px, 5vw, 56px);
          line-height: 1;
          font-weight: 500;
          letter-spacing: -0.045em;
        }

        .lm-complete-copy p {
          margin: 17px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .lm-continue {
          min-width: 174px;
          height: 53px;
          margin-top: 34px;
          padding: 0 21px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          border: 0;
          border-radius: 15px;
          background: var(--accent);
          color: #fffaf3;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 14px 30px rgba(122, 47, 0, 0.22);
          transition:
            transform 250ms cubic-bezier(0.22, 1, 0.36, 1),
            background 250ms ease,
            box-shadow 250ms ease;
          animation: completeCopyIn 650ms 180ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .lm-continue:hover {
          transform: translateY(-3px);
          background: var(--accent-dark);
          box-shadow: 0 18px 35px rgba(122, 47, 0, 0.28);
        }

        .lm-continue:active {
          transform: translateY(0) scale(0.98);
        }

        .lm-continue:focus-visible {
          outline: 3px solid rgba(122, 47, 0, 0.18);
          outline-offset: 4px;
        }

        .lm-continue-arrow {
          font-size: 18px;
          font-weight: 400;
          transition: transform 250ms ease;
        }

        .lm-continue:hover .lm-continue-arrow {
          transform: translateX(4px);
        }

        .lm-complete-footer {
          position: absolute;
          bottom: 44px;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
        }

        /* BOTTOM HINT */

        .lm-bottom-hint {
          margin-top: 22px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 246, 232, 0.45);
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .lm-key {
          padding: 4px 6px;
          border: 1px solid rgba(255, 246, 232, 0.16);
          border-radius: 5px;
          color: rgba(255, 246, 232, 0.55);
          font-size: 8px;
          letter-spacing: 0.08em;
        }

        /* TABLET */

        @media (max-width: 760px) {
          .lm-main {
            padding: 28px 18px;
          }

          .lm-card {
            width: min(620px, calc(100vw - 36px));
            min-height: 520px;
            border-radius: 26px;
          }

          .lm-question,
          .lm-loader,
          .lm-complete {
            min-height: 520px;
            padding: 44px 42px 38px;
          }

          .lm-heading-area {
            margin-top: 56px;
          }

          .lm-title {
            font-size: clamp(40px, 7vw, 55px);
          }

          .lm-options {
            margin-top: 40px;
          }
        }

        /* PHONE */

        @media (max-width: 560px) {
          .lm-root {
            min-height: 100dvh;
          }

          .lm-main {
            min-height: 100dvh;
            padding: 16px;
          }

          .lm-card {
            width: calc(100vw - 32px);
            min-height: min(620px, calc(100dvh - 74px));
            border-radius: 24px;
          }

          .lm-question,
          .lm-loader,
          .lm-complete {
            min-height: min(620px, calc(100dvh - 74px));
            padding: 30px 22px 26px;
          }

          .lm-progress-row {
            align-items: flex-start;
          }

          .lm-eyebrow {
            max-width: 190px;
            font-size: 9px;
            line-height: 1.35;
          }

          .lm-counter {
            font-size: 9px;
          }

          .lm-heading-area {
            margin-top: 48px;
          }

          .lm-title {
            min-height: 106px;
            font-size: clamp(37px, 11vw, 49px);
            line-height: 1.04;
          }

          .lm-subtitle {
            max-width: 310px;
            margin-top: 14px;
            font-size: 13px;
            line-height: 1.6;
          }

          .lm-options {
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 34px;
          }

          .lm-option {
            min-height: 68px;
            padding: 10px 12px;
            border-radius: 15px;
          }

          .lm-option-icon {
            width: 39px;
            height: 39px;
            flex-basis: 39px;
            border-radius: 11px;
          }

          .lm-option-label {
            font-size: 12.5px;
          }

          .lm-option-arrow {
            font-size: 17px;
          }

          .lm-footer {
            padding-top: 25px;
          }

          .lm-footer-text {
            display: none;
          }

          .lm-dots {
            margin: 0 auto;
          }

          .lm-loader {
            justify-content: center;
          }

          .lm-orb-container {
            width: 88px;
            height: 88px;
            margin-bottom: 25px;
          }

          .lm-loader-copy h2 {
            max-width: 300px;
            font-size: 29px;
            line-height: 1.15;
          }

          .lm-loader-copy p {
            max-width: 280px;
            margin-left: auto;
            margin-right: auto;
            font-size: 12.5px;
          }

          .lm-loading-line {
            width: min(245px, 78%);
            margin-top: 30px;
          }

          .lm-success-icon {
            width: 58px;
            height: 58px;
          }

          .lm-complete-copy {
            margin-top: 25px;
          }

          .lm-complete-copy h2 {
            font-size: 42px;
          }

          .lm-complete-copy p {
            margin-top: 14px;
            font-size: 12.5px;
          }

          .lm-continue {
            width: min(190px, 100%);
            height: 51px;
            margin-top: 29px;
          }

          .lm-complete-footer {
            bottom: 26px;
          }

          .lm-bottom-hint {
            margin-top: 12px;
          }

          .lm-key {
            display: none;
          }
        }

        /* SMALL PHONES */

        @media (max-width: 380px) {
          .lm-main {
            padding: 12px;
          }

          .lm-card {
            width: calc(100vw - 24px);
            min-height: calc(100dvh - 58px);
            border-radius: 21px;
          }

          .lm-question,
          .lm-loader,
          .lm-complete {
            min-height: calc(100dvh - 58px);
            padding: 25px 18px 23px;
          }

          .lm-heading-area {
            margin-top: 38px;
          }

          .lm-title {
            min-height: 94px;
            font-size: 35px;
          }

          .lm-subtitle {
            font-size: 12px;
          }

          .lm-options {
            margin-top: 28px;
          }

          .lm-option {
            min-height: 63px;
          }

          .lm-option-icon {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
          }

          .lm-option-label {
            font-size: 11.8px;
          }

          .lm-loader-copy h2 {
            font-size: 26px;
          }

          .lm-complete-copy h2 {
            font-size: 38px;
          }

          .lm-complete-footer {
            bottom: 23px;
          }
        }

        /* REDUCED MOTION */

        @media (prefers-reduced-motion: reduce) {
          .lm-glow,
          .lm-card,
          .lm-option,
          .lm-option-arrow,
          .lm-continue,
          .lm-continue-arrow {
            transition: none !important;
          }

          .lm-question.question-in,
          .lm-question.question-out,
          .lm-loader.loader-in,
          .lm-loader.loader-out,
          .lm-options.options-visible .lm-option,
          .lm-success-icon,
          .lm-complete-copy,
          .lm-continue {
            animation: none !important;
          }

          .lm-caret {
            animation: none !important;
          }

          .lm-loading-line span {
            animation: none !important;
            width: 100%;
          }
        }
      `}</style>
        </>
    );
}