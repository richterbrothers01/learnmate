"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type LessonVideoProps = {
  videoId: string;
  chapterKey: string;
  initialSeconds?: number;
  onProgress?: (
    percent: number,
    watchedSeconds: number,
    durationSeconds: number,
  ) => void;
};

let ytApiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window."));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

/**
 * LessonVideo — a YouTube lesson player that tracks watch progress.
 *
 * The player runs through the YouTube IFrame API on the privacy-enhanced
 * (youtube-nocookie) host, so the lesson keeps its existing embed while
 * gaining real playback position. Progress is the furthest position
 * reached while the video is playing, sampled every 5 seconds and flushed
 * on pause, on end, and on unmount; the server keeps the maximum, so
 * progress never regresses. If the player API cannot load (e.g. YouTube
 * is blocked on the network), the plain embed is shown instead so the
 * video still plays — just without tracking. Nothing is ever faked.
 */
export default function LessonVideo({
  videoId,
  chapterKey,
  initialSeconds = 0,
  onProgress,
}: LessonVideoProps) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [apiFailed, setApiFailed] = useState(false);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    let frame: HTMLIFrameElement | null = null;
    let timer: number | undefined = undefined;
    let lastFlushed = -1;
    let maxPos = Math.max(0, initialSeconds || 0);

    const post = (
      percent: number,
      watched: number,
      duration: number,
    ) => {
      if (percent <= lastFlushed) return;
      lastFlushed = percent;
      fetch("/api/video-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterKey,
          watchedSeconds: Math.round(watched),
          durationSeconds: Math.round(duration),
        }),
      }).catch(() => {
        /* Best-effort: a missed flush is re-sent on the next sample. */
      });
    };

    const sample = (final = false) => {
      if (!player) return;
      try {
        const duration = Number(player.getDuration?.());
        if (!duration || duration <= 0) return;
        const current = Number(player.getCurrentTime?.());
        if (Number.isFinite(current)) {
          maxPos = Math.max(maxPos, Math.min(current, duration));
        }
        maxPos = Math.min(maxPos, duration);
        const percent = Math.min(
          100,
          Math.round((maxPos / duration) * 100),
        );
        onProgressRef.current?.(percent, maxPos, duration);
        if (final || percent > lastFlushed) {
          post(percent, maxPos, duration);
        }
      } catch {
        /* Player not ready yet. */
      }
    };

    const stopTimer = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const handleState = (event: any) => {
      const state = event?.data;
      if (state === 1) {
        // Playing: sample now, then every 5 seconds.
        sample();
        stopTimer();
        timer = window.setInterval(() => sample(), 5000);
      } else {
        stopTimer();
        if (state === 0) {
          // Ended: the whole video counts as watched.
          try {
            const duration = Number(player?.getDuration?.());
            if (duration > 0) maxPos = duration;
          } catch {
            /* ignore */
          }
        }
        sample(true);
      }
    };

    const failTimer = window.setTimeout(() => {
      if (!player && !cancelled) setApiFailed(true);
    }, 8000);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holderRef.current || !YT?.Player) {
          if (!cancelled && !holderRef.current) setApiFailed(true);
          return;
        }
        window.clearTimeout(failTimer);
        // The iframe is created imperatively inside the React-managed
        // container, so the player API never replaces a node React owns.
        frame = document.createElement("iframe");
        frame.src =
          `https://www.youtube-nocookie.com/embed/${videoId}` +
          `?enablejsapi=1&rel=0&start=${Math.floor(maxPos)}` +
          `&origin=${encodeURIComponent(window.location.origin)}`;
        frame.width = "100%";
        frame.height = "100%";
        frame.style.border = "0";
        frame.style.display = "block";
        frame.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        frame.allowFullscreen = true;
        frame.title = "Lesson video";
        holderRef.current.appendChild(frame);
        player = new YT.Player(frame, {
          events: {
            onStateChange: handleState,
            onError: () => {
              if (!cancelled) setApiFailed(true);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      stopTimer();
      try {
        sample(true);
      } catch {
        /* ignore */
      }
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      try {
        if (frame && frame.parentNode) {
          frame.parentNode.removeChild(frame);
        }
      } catch {
        /* ignore */
      }
    };
    // The effect intentionally re-runs only when the video changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, chapterKey]);

  if (apiFailed) {
    // The YouTube player API could not load or bind: fall back to the
    // plain embed so the video still plays, just without tracking.
    return (
      <iframe
        className="lesson-video"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return <div ref={holderRef} className="lesson-video" />;
}
