/**
 * resolveVideo.ts — THE SINGLE plug-in point for chapter video URLs.
 *
 * The URLs come from a YouTube research pass (2026-10-28): one best
 * level-matched video per chapter, keyed by curriculum key
 * (classLevel|subject|section|title). The map itself lives in
 * ./videoMap.ts so it can be reviewed and edited without touching
 * any component.
 *
 * Rules that must never change, wherever this function is used:
 *   - No fallback. A chapter with no entry MUST keep returning null,
 *     so its panel keeps showing "video not added yet" — never a
 *     "first chapter", default video, or placeholder URL.
 *   - Null means "not added yet" — never navigate, never mark complete.
 *   - Watching a video never marks a chapter complete (completion comes
 *     from milestone_progress data, not from playback).
 */

import { VIDEO_URLS } from "./videoMap";

/**
 * Resolve the video URL for one chapter, or null when no
 * level-appropriate video was found for it yet.
 */
export function resolveChapterVideo(chapterId: string): string | null {
  return VIDEO_URLS[chapterId] ?? null;
}
