'use client';

/**
 * Milestone path (LearnMate) — updated 2026-10-29 at the user's request.
 *
 * One path per ONGOING course. Every milestone is ONE chapter, labelled
 * with its ACTUAL chapter title — never "Level 1" / "Stage 3". Nothing
 * is locked: every milestone can be opened at any time.
 *
 * Highlight contract (user, 2026-10-29 — supersedes the old
 * milestone_progress "completed" model): a milestone is HIGHLIGHTED
 * when its chapter video has been watched (watch progress > 0, from
 * the app's real video-progress data passed in as props), and not
 * highlighted when it has not been watched. Status is never conveyed
 * by colour alone — every milestone and the panel carry explicit text
 * ("Watched 72%" / "Not watched yet").
 *
 * Colour contract: watched = bright warm yellow #F5B301; not watched
 * = muted, pale darker yellow #D8C690.
 *
 * Iconography contract: the ONLY emoji used anywhere in this
 * component is 🎥, on the milestone nodes.
 *
 * Panel contract (user, 2026-10-29 — supersedes the old in-flow
 * single-button panel): clicking a milestone slides a glass panel in
 * from the RIGHT. Watched chapter: "Rewatch this video" + "Cancel".
 * Unwatched chapter: "Watch the video" + "Cancel". Cancel (or the
 * scrim, or Escape, or clicking the milestone again) slides the panel
 * back out to the right. The Watch button still goes through
 * resolveChapterVideo(): no URL => an inline notice, no navigation —
 * this component never invents a video URL and never renders a player;
 * onWatchVideo is wired by the integrator to the app's existing
 * chapter lesson interface.
 *
 * Scroll contract: this component creates NO scroll container of its
 * own — the path flows with the dashboard page and the page's own
 * scrollbar is the only one.
 *
 * Styling: ALL CSS lives in the <style> block below, scoped under
 * `.learnmate-milestones`. Animations are disabled under
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from 'react';
import { resolveChapterVideo } from '../../lib/learnmate/resolveVideo';

export interface MilestoneChapter {
  id: string;
  title: string;
  /** True when the student has watched any of this chapter's video. */
  watched: boolean;
  /** Furthest watch position reached, 0–100. */
  watchPercent: number;
}

export interface MilestonePathProps {
  courseTitle: string;
  chapters: MilestoneChapter[];
  /** Wired by the integrator to the app's EXISTING chapter-selection / video interface. */
  onWatchVideo: (chapterId: string) => void;
  loading?: boolean;
  error?: string | null;
}

/** Cream-and-brown design language + the milestone yellows. */
export const MILESTONE_COLORS = {
  /** Watched milestone: bright warm yellow (not neon, not green). */
  completed: '#F5B301',
  completedText: '#3B2314',
  /** Not-watched milestone: muted, pale darker yellow. */
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
  padding: 8px 0 48px;
  overflow-x: clip;
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
.learnmate-milestones .lm-header { position: relative; }
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
  background: none; border: none; padding: 8px; cursor: pointer; color: inherit;
  font: inherit; text-align: inherit; border-radius: 14px;
  transition: background 0.2s ease;
}
.learnmate-milestones .lm-milestone:hover { background: rgba(216, 198, 144, 0.18); }
.learnmate-milestones .lm-item:nth-child(odd) .lm-milestone { flex-direction: row-reverse; }
.learnmate-milestones .lm-milestone:focus-visible,
.learnmate-milestones .lm-watch:focus-visible,
.learnmate-milestones .lm-cancel:focus-visible {
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
.learnmate-milestones .lm-circle--selected {
  box-shadow: 0 0 0 3px ${MILESTONE_COLORS.cream}, 0 0 0 6px ${MILESTONE_COLORS.brown};
}
.learnmate-milestones .lm-title { font-weight: 650; font-size: 1rem; line-height: 1.35; }
.learnmate-milestones .lm-status { display: block; font-size: 0.85rem; opacity: 0.75; margin-top: 2px; }
/* The right slide-over panel (glass). Fixed to the viewport's right
   edge; slides in on open and back out on close. */
.learnmate-milestones .lm-panel-scrim {
  position: fixed; inset: 0; z-index: 79; border: none; padding: 0;
  background: rgba(26, 16, 8, 0.35); cursor: pointer;
  animation: lm-fade-in 0.25s ease both;
}
.learnmate-milestones .lm-panel-scrim.is-closing { animation: lm-fade-out 0.3s ease both; }
.learnmate-milestones .lm-panel {
  position: fixed; top: 0; right: 0; z-index: 80;
  width: min(360px, 92vw); height: 100dvh;
  padding: 28px 24px; overflow: hidden;
  background: rgba(255, 251, 240, 0.88);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  backdrop-filter: blur(14px) saturate(1.25);
  border-left: 1px solid rgba(92, 61, 46, 0.20);
  box-shadow: -16px 0 40px rgba(59, 35, 20, 0.18);
  text-align: left;
  animation: lm-panel-in 0.34s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.learnmate-milestones .lm-panel.is-closing { animation: lm-panel-out 0.3s ease both; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .learnmate-milestones .lm-panel { background: ${MILESTONE_COLORS.cream}; }
}
.learnmate-milestones .lm-panel h3 { margin: 0 0 6px; font-size: 1.2rem; line-height: 1.35; }
.learnmate-milestones .lm-panel-status { margin: 0 0 16px; opacity: 0.85; line-height: 1.55; }
.learnmate-milestones .lm-notice {
  margin: 0 0 16px; padding: 10px 12px; border-radius: 10px;
  background: rgba(216, 198, 144, 0.45); border: 1px solid rgba(92, 61, 46, 0.25);
}
.learnmate-milestones .lm-panel-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.learnmate-milestones .lm-watch {
  min-height: 48px; padding: 12px 22px; border: none; border-radius: 999px;
  background: ${MILESTONE_COLORS.brown}; color: ${MILESTONE_COLORS.cream};
  font: inherit; font-weight: 650; font-size: 1rem; cursor: pointer;
}
.learnmate-milestones .lm-watch:hover { background: #452C20; }
.learnmate-milestones .lm-cancel {
  min-height: 48px; padding: 12px 22px; border-radius: 999px;
  background: transparent; color: ${MILESTONE_COLORS.brown};
  border: 2px solid rgba(92, 61, 46, 0.45);
  font: inherit; font-weight: 650; font-size: 1rem; cursor: pointer;
}
.learnmate-milestones .lm-cancel:hover { background: rgba(216, 198, 144, 0.25); }
@keyframes lm-fade-rise {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes lm-panel-in {
  from { transform: translateX(105%); }
  to { transform: translateX(0); }
}
@keyframes lm-panel-out {
  from { transform: translateX(0); }
  to { transform: translateX(105%); }
}
@keyframes lm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes lm-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
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
  .learnmate-milestones .lm-panel,
  .learnmate-milestones .lm-panel.is-closing,
  .learnmate-milestones .lm-panel-scrim,
  .learnmate-milestones .lm-panel-scrim.is-closing { animation: none; }
}
/* Dashboard dark theme: keep the path and the glass panel readable. */
[data-theme="dark"] .learnmate-milestones { color: #F6E8D0; }
[data-theme="dark"] .learnmate-milestones .lm-panel {
  background: rgba(34, 22, 9, 0.88);
  border-left-color: rgba(233, 198, 137, 0.25);
}
[data-theme="dark"] .learnmate-milestones .lm-cancel {
  color: #F6E8D0; border-color: rgba(233, 198, 137, 0.45);
}
[data-theme="dark"] .learnmate-milestones .lm-circle--selected {
  box-shadow: 0 0 0 3px #221609, 0 0 0 6px #E9C689;
}
`;

const PANEL_SLIDE_MS = 320;

export default function MilestonePath({
  courseTitle,
  chapters,
  onWatchVideo,
  loading = false,
  error = null,
}: MilestonePathProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);
  const decorRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const selected = chapters.find((c) => c.id === selectedId) ?? null;
  const watchedCount = chapters.filter((c) => c.watched).length;

  const closePanel = () => {
    if (!selectedId || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedId(null);
      setClosing(false);
      setVideoNotice(null);
    }, PANEL_SLIDE_MS);
  };

  // If the chapter list changes (another course picked) while the
  // panel is open, drop a selection that no longer exists.
  useEffect(() => {
    if (selectedId && !chapters.some((c) => c.id === selectedId)) {
      window.clearTimeout(closeTimerRef.current);
      setSelectedId(null);
      setClosing(false);
      setVideoNotice(null);
    }
  }, [chapters, selectedId]);

  useEffect(() => {
    return () => window.clearTimeout(closeTimerRef.current);
  }, []);

  // Escape slides the panel away.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, closing]);

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
    if (closing) return;
    if (id === selectedId) {
      closePanel();
      return;
    }
    setVideoNotice(null);
    setSelectedId(id);
  };

  const handleWatch = () => {
    if (!selected) return;
    // Gate: no video source for this chapter => show the message and
    // do NOT navigate. onWatchVideo is only called when a real video
    // URL resolves for THIS chapter.
    const videoUrl = resolveChapterVideo(selected.id);
    if (!videoUrl) {
      setVideoNotice('The video for this chapter has not been added yet.');
      return;
    }
    window.clearTimeout(closeTimerRef.current);
    setSelectedId(null);
    setClosing(false);
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
            {watchedCount} of {chapters.length} videos watched
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
            const statusText = chapter.watched
              ? `Watched ${chapter.watchPercent}%`
              : 'Not watched yet';
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
                      (chapter.watched
                        ? 'lm-circle lm-circle--done'
                        : 'lm-circle lm-circle--todo') +
                      (isSelected ? ' lm-circle--selected' : '')
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
        <>
          <button
            type="button"
            aria-label="Cancel"
            className={
              closing ? 'lm-panel-scrim is-closing' : 'lm-panel-scrim'
            }
            onClick={closePanel}
          />
          <div
            className={closing ? 'lm-panel is-closing' : 'lm-panel'}
            role="dialog"
            aria-modal="false"
            aria-label={`Details for ${selected.title}`}
          >
            <h3>{selected.title}</h3>
            <p className="lm-panel-status">
              {selected.watched
                ? `You have watched ${selected.watchPercent}% of this video.`
                : 'You have not watched this video yet.'}
            </p>
            {videoNotice && (
              <p className="lm-notice" role="status">
                {videoNotice}
              </p>
            )}
            <div className="lm-panel-actions">
              <button type="button" className="lm-watch" onClick={handleWatch}>
                {selected.watched ? 'Rewatch this video' : 'Watch the video'}
              </button>
              <button type="button" className="lm-cancel" onClick={closePanel}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
