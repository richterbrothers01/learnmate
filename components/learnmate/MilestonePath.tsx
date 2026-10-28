'use client';

/**
 * Mark 6 milestone path (LearnMate, Brief 2 + user decisions D1–D5).
 *
 * One path per ONGOING course. Every milestone is ONE chapter, labelled with
 * its ACTUAL chapter title — never "Level 1" / "Stage 3". Incomplete does
 * NOT mean locked: there is no locking and no prerequisites anywhere here.
 *
 * Colour contract (user decision):
 *   completed  = bright warm yellow (not neon, not green)
 *   incomplete = muted, pale darker yellow
 * Status is never conveyed by colour alone — every milestone and the panel
 * carry an explicit text status ("Completed" / "Not completed yet").
 *
 * Iconography contract: the ONLY emoji used anywhere in this component is
 * 🎥, on the milestone nodes. No stars, trophies, chests, characters,
 * headphones, microphones, or any other icon/emoji.
 *
 * Video contract (user decision D4 — videos come LATER):
 *   Clicking "Watch Video" / "Rewatch Video" first calls resolveChapterVideo()
 *   (lib/resolveVideo.ts). TODAY that returns null for every chapter, so the
 *   panel shows "The video for this chapter has not been added yet." and
 *   onWatchVideo is NOT called: no navigation, nothing marked complete.
 *   When the user supplies YouTube URLs later, they go into resolveVideo.ts
 *   only, and the same button then calls onWatchVideo(chapterId), which the
 *   integrator wires to the app's EXISTING chapter-selection / video
 *   interface. This component never renders its own player and never
 *   invents, defaults, or hardcodes a video URL.
 *
 * Completion contract: `completed` comes from server data passed in as
 * props (e.g. milestone_progress). Watching a video NEVER marks a chapter
 * complete — this component holds no completion state at all, only UI
 * state (which panel is open, and the video-notice message).
 *
 * Panel contract: exactly ONE glassmorphism panel exists at a time, shown
 * for the selected milestone. It has exactly ONE button ("Watch Video" or
 * "Rewatch Video" — no substitutes, no competing primary buttons). Close
 * it by clicking the selected milestone again or pressing Escape; there is
 * deliberately no extra close button, so the panel keeps its single-button
 * rule. Glass styling (translucent + backdrop blur) is restricted to this
 * panel only.
 *
 * Styling: ALL CSS lives in the <style> block below and is scoped under
 * `.learnmate-milestones`. No global styles are touched. Animation is a
 * restrained fade + small rise on mount, plus a subtle scroll parallax on
 * the decorative background layer only; both are fully disabled under
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react';
import { resolveChapterVideo } from '../../lib/learnmate/resolveVideo';

export interface MilestoneChapter {
  id: string;
  title: string;
  completed: boolean;
}

export interface MilestonePathProps {
  courseTitle: string;
  chapters: MilestoneChapter[];
  /** Wired by the integrator to the app's EXISTING chapter-selection / video interface. */
  onWatchVideo: (chapterId: string) => void;
  loading?: boolean;
  error?: string | null;
}

/** Cream-and-brown design language + the mandated milestone yellows. */
export const MILESTONE_COLORS = {
  /** Completed milestone: bright warm yellow (not neon, not green). */
  completed: '#F5B301',
  completedText: '#3B2314',
  /** Incomplete milestone: muted, pale darker yellow. */
  incomplete: '#D8C690',
  incompleteBorder: '#B89B5E',
  cream: '#FDF8EE',
  brown: '#5C3D2E',
} as const;

const CSS = `
.learnmate-milestones,
.learnmate-milestones * { box-sizing: border-box; }
.learnmate-milestones {
  position: relative;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  overflow-x: hidden;
  color: ${MILESTONE_COLORS.brown};
  font-family: inherit;
}
.learnmate-milestones .lm-decor {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
}
.learnmate-milestones .lm-decor::before,
.learnmate-milestones .lm-decor::after {
  content: ''; position: absolute; border-radius: 50%; opacity: 0.35;
}
.learnmate-milestones .lm-decor::before {
  width: 280px; height: 280px; top: 8%; right: -90px;
  background: radial-gradient(circle, #F5B30155 0%, transparent 70%);
}
.learnmate-milestones .lm-decor::after {
  width: 220px; height: 220px; top: 55%; left: -80px;
  background: radial-gradient(circle, #D8C69066 0%, transparent 70%);
}
.learnmate-milestones .lm-header { position: relative; text-align: center; }
.learnmate-milestones .lm-header h2 { margin: 0 0 6px; font-size: 1.5rem; }
.learnmate-milestones .lm-progress { margin: 0; opacity: 0.75; }
.learnmate-milestones .lm-state { position: relative; text-align: center; padding: 48px 16px; }
.learnmate-milestones .lm-path {
  position: relative; list-style: none; margin: 32px 0 0; padding: 8px 0 24px;
  /* Winding connector line running down the path. Decorative only. */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='120' viewBox='0 0 40 120'%3E%3Cpath d='M20 0 C 2 30, 38 60, 20 90 S 20 120, 20 120' fill='none' stroke='%235C3D2E' stroke-opacity='0.28' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: repeat-y; background-position: center top; background-size: 40px 120px;
}
.learnmate-milestones .lm-item {
  position: relative; width: 50%; padding: 14px 36px;
  animation: lm-fade-rise 0.45s ease both;
}
.learnmate-milestones .lm-item:nth-child(odd) { margin-left: 0; text-align: right; }
.learnmate-milestones .lm-item:nth-child(even) { margin-left: 50%; text-align: left; }
.learnmate-milestones .lm-milestone {
  display: inline-flex; align-items: center; gap: 14px; width: 100%;
  background: none; border: none; padding: 6px; cursor: pointer; color: inherit;
  font: inherit; text-align: inherit; border-radius: 14px;
}
.learnmate-milestones .lm-item:nth-child(odd) .lm-milestone { flex-direction: row-reverse; }
.learnmate-milestones .lm-milestone:focus-visible,
.learnmate-milestones .lm-watch:focus-visible {
  outline: 3px solid ${MILESTONE_COLORS.brown}; outline-offset: 4px;
}
.learnmate-milestones .lm-circle {
  flex: 0 0 auto; width: 56px; height: 56px; border-radius: 50%;
  display: grid; place-items: center; font-size: 26px; line-height: 1;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.learnmate-milestones .lm-milestone:hover .lm-circle { transform: scale(1.06); }
.learnmate-milestones .lm-circle--done {
  background: ${MILESTONE_COLORS.completed}; color: ${MILESTONE_COLORS.completedText};
  border: 2px solid #C78F00; box-shadow: 0 4px 14px rgba(245, 179, 1, 0.45);
}
.learnmate-milestones .lm-circle--todo {
  background: ${MILESTONE_COLORS.incomplete}; color: ${MILESTONE_COLORS.brown};
  border: 2px solid ${MILESTONE_COLORS.incompleteBorder};
}
.learnmate-milestones .lm-title { font-weight: 650; font-size: 1rem; line-height: 1.35; }
.learnmate-milestones .lm-status { display: block; font-size: 0.85rem; opacity: 0.75; margin-top: 2px; }
/* The ONE glassmorphism panel. Translucent, backdrop blur, low-opacity
   brown border, soft shadow, rounded, NO blue tint. */
.learnmate-milestones .lm-panel {
  position: relative; margin-top: 8px; padding: 22px;
  background: rgba(255, 251, 240, 0.68);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  backdrop-filter: blur(14px) saturate(1.25);
  border: 1px solid rgba(92, 61, 46, 0.20);
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(59, 35, 20, 0.14);
  text-align: left;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .learnmate-milestones .lm-panel { background: ${MILESTONE_COLORS.cream}; }
}
.learnmate-milestones .lm-panel h3 { margin: 0 0 6px; font-size: 1.15rem; }
.learnmate-milestones .lm-panel-status { margin: 0 0 16px; opacity: 0.8; }
.learnmate-milestones .lm-notice {
  margin: 0 0 16px; padding: 10px 12px; border-radius: 10px;
  background: rgba(216, 198, 144, 0.45); border: 1px solid rgba(92, 61, 46, 0.25);
}
.learnmate-milestones .lm-watch {
  min-height: 48px; padding: 12px 22px; border: none; border-radius: 999px;
  background: ${MILESTONE_COLORS.brown}; color: ${MILESTONE_COLORS.cream};
  font: inherit; font-weight: 650; font-size: 1rem; cursor: pointer;
}
.learnmate-milestones .lm-watch:hover { background: #452C20; }
.learnmate-milestones .lm-hint { margin: 14px 0 0; font-size: 0.85rem; opacity: 0.7; }
@keyframes lm-fade-rise {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 640px) {
  /* Mobile: single left-aligned path, winding line at the left, no overflow. */
  .learnmate-milestones .lm-path { background-position: left 16px top; }
  .learnmate-milestones .lm-item {
    width: 100%; margin-left: 0 !important; text-align: left;
    padding: 12px 0 12px 8px;
  }
  .learnmate-milestones .lm-item:nth-child(odd) .lm-milestone { flex-direction: row; }
  .learnmate-milestones .lm-circle { width: 52px; height: 52px; font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .learnmate-milestones .lm-item { animation: none; }
  .learnmate-milestones .lm-milestone:hover .lm-circle { transform: none; }
}
`;

export default function MilestonePath({
  courseTitle,
  chapters,
  onWatchVideo,
  loading = false,
  error = null,
}: MilestonePathProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const decorRef = useRef<HTMLDivElement | null>(null);

  const selected = chapters.find((c) => c.id === selectedId) ?? null;
  const completedCount = chapters.filter((c) => c.completed).length;

  // Escape closes the panel. No close button exists by design (single-button rule).
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
        setVideoNotice(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Subtle scroll parallax on the decorative layer only. Skipped entirely
  // under prefers-reduced-motion; never moves content or milestones.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (decorRef.current) {
          decorRef.current.style.transform = `translateY(${window.scrollY * 0.03}px)`;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleMilestoneClick = (id: string) => {
    setVideoNotice(null);
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleWatch = () => {
    if (!selected) return;
    // D4 gate: no video source yet => show the message, do NOT navigate,
    // do NOT mark anything complete. onWatchVideo is only called when a
    // real video URL resolves for THIS chapter.
    const videoUrl = resolveChapterVideo(selected.id);
    if (!videoUrl) {
      setVideoNotice('The video for this chapter has not been added yet.');
      return;
    }
    onWatchVideo(selected.id);
  };

  return (
    <section className="learnmate-milestones" aria-label={`${courseTitle} learning path`}>
      <style>{CSS}</style>
      <div ref={decorRef} className="lm-decor" aria-hidden="true" />

      <div className="lm-header">
        <h2>{courseTitle}</h2>
        {!loading && !error && chapters.length > 0 && (
          <p className="lm-progress">
            {completedCount} of {chapters.length} chapters completed
          </p>
        )}
      </div>

      {loading && (
        <div className="lm-state" aria-busy="true">
          <p>Loading your learning path…</p>
        </div>
      )}

      {!loading && error && (
        <div className="lm-state" role="alert">
          <p>Couldn&apos;t load your learning path. {error}</p>
        </div>
      )}

      {!loading && !error && chapters.length === 0 && (
        <div className="lm-state">
          <p>No chapters in this course yet.</p>
          <p>Chapters will appear here once they are added to the course.</p>
        </div>
      )}

      {!loading && !error && chapters.length > 0 && (
        <ol className="lm-path">
          {chapters.map((chapter, index) => {
            const isSelected = chapter.id === selectedId;
            const statusText = chapter.completed ? 'Completed' : 'Not completed yet';
            return (
              <li key={chapter.id} className="lm-item">
                <button
                  type="button"
                  className="lm-milestone"
                  aria-label={`${chapter.title} — ${statusText}`}
                  aria-expanded={isSelected}
                  style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
                  onClick={() => handleMilestoneClick(chapter.id)}
                >
                  <span
                    className={
                      chapter.completed ? 'lm-circle lm-circle--done' : 'lm-circle lm-circle--todo'
                    }
                    aria-hidden="true"
                  >
                    🎥
                  </span>
                  <span>
                    <span className="lm-title">{chapter.title}</span>
                    <span className="lm-status">{statusText}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && !error && selected && (
        <div className="lm-panel" role="region" aria-label={`Details for ${selected.title}`}>
          <h3>{selected.title}</h3>
          <p className="lm-panel-status">
            Status: {selected.completed ? 'Completed' : 'Not completed yet'}
          </p>
          {videoNotice && (
            <p className="lm-notice" role="status">
              {videoNotice}
            </p>
          )}
          <button type="button" className="lm-watch" onClick={handleWatch}>
            {selected.completed ? 'Rewatch Video' : 'Watch Video'}
          </button>
          <p className="lm-hint">Select the milestone again or press Escape to close this panel.</p>
        </div>
      )}
    </section>
  );
}
