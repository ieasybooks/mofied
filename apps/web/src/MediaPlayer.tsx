import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Pause, Play, Volume2, VolumeX, ChevronUp } from "lucide-react";
import type { MediaItem } from "@mofied/contracts";
import { copy, formatTime, type Locale } from "@mofied/design";
import type { SessionController, SessionSnapshot } from "@mofied/session";
import { watchPlaybackHealth } from "./playback-health";

export function MediaPlayer({
  item,
  session,
  state,
  locale,
}: {
  item: MediaItem;
  session: SessionController;
  state: SessionSnapshot;
  locale: Locale;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const startPosition = useRef(state.positionMs / 1000);
  const [attempt, setAttempt] = useState(0);
  const [duration, setDuration] = useState(item.durationMs);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const t = copy[locale];

  useEffect(() => {
    const video = ref.current!;
    let cancelled = false;
    let recoveries = 0;
    const progress = () =>
      session.mediaProgress(item.id, video.currentTime * 1000);
    const stopWatching = watchPlaybackHealth(video, session, item.id);
    const ended = () => session.mediaEnded(item.id, video.currentTime * 1000);
    const failed = () => {
      if (!cancelled) session.mediaFailed(item.id);
    };
    const pausedExternally = () => {
      if (
        !cancelled &&
        !video.ended &&
        session.getSnapshot().shouldPlay &&
        video.readyState >= 2
      ) {
        progress();
        // Browsers may suspend untouched muted autoplay in a background tab.
        // Reflect the actual pause instead of showing playing or replacing media.
        session.autoplayBlocked(item.id);
      }
    };
    const visibleAgain = () => {
      const snapshot = session.getSnapshot();
      if (
        !document.hidden &&
        snapshot.status === "autoplay-blocked" &&
        snapshot.wantsToPlay
      )
        session.togglePlayback();
    };
    const loaded = () => {
      if (Number.isFinite(video.duration)) setDuration(video.duration * 1000);
      if (startPosition.current > 0) {
        video.currentTime = Math.min(
          startPosition.current,
          Math.max(0, video.duration - 0.1),
        );
        startPosition.current = 0;
      }
      if (session.getSnapshot().shouldPlay) void play();
    };
    const play = async () => {
      try {
        await video.play();
      } catch (error) {
        if (cancelled || !session.getSnapshot().shouldPlay) return;
        if (error instanceof DOMException && error.name === "NotAllowedError")
          session.autoplayBlocked(item.id);
        else if (!(
          error instanceof DOMException && error.name === "AbortError"
        ))
          failed();
      }
    };
    for (const [event, handler] of Object.entries({
      ended,
      pause: pausedExternally,
      error: failed,
      loadedmetadata: loaded,
    }))
      video.addEventListener(event, handler);
    document.addEventListener("visibilitychange", visibleAgain);
    if (
      item.playback.mimeType === "application/vnd.apple.mpegurl" &&
      !video.canPlayType("application/vnd.apple.mpegurl") &&
      Hls.isSupported()
    ) {
      const hls = new Hls({
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        backBufferLength: 0,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(item.playback.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (recoveries++ < 2 && data.type === Hls.ErrorTypes.NETWORK_ERROR)
          hls.startLoad();
        else if (recoveries < 3 && data.type === Hls.ErrorTypes.MEDIA_ERROR)
          hls.recoverMediaError();
        else failed();
      });
    } else video.src = item.playback.url;
    if (session.getSnapshot().shouldPlay) void play();
    return () => {
      cancelled = true;
      stopWatching();
      for (const [event, handler] of Object.entries({
        ended,
        pause: pausedExternally,
        error: failed,
        loadedmetadata: loaded,
      }))
        video.removeEventListener(event, handler);
      document.removeEventListener("visibilitychange", visibleAgain);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [item.id, item.playback.url, item.playback.mimeType, session, attempt]);

  useEffect(() => {
    const video = ref.current!;
    video.muted = state.muted;
    if (state.shouldPlay) {
      void video.play().catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "NotAllowedError" &&
          session.getSnapshot().shouldPlay
        )
          session.autoplayBlocked(item.id);
      });
    } else video.pause();
  }, [state.shouldPlay, state.muted, item.id, session, attempt]);

  const retry = () => {
    startPosition.current = state.positionMs / 1000;
    session.retry();
    setAttempt((value) => value + 1);
  };
  return (
    <>
      <div className="player-frame" data-testid="media-player">
        <video
          ref={ref}
          muted={state.muted}
          poster={item.posterUrl ?? undefined}
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate noremoteplayback"
          aria-label={item.title}
        />
        <div className="scrim-top" />
        <div className="scrim-bottom" />
        <button
          type="button"
          className="media-tap"
          aria-label={state.shouldPlay ? t.pause : t.play}
          onPointerDown={(event) => {
            pointer.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start) return;
            const dy = event.clientY - start.y;
            const dx = event.clientX - start.x;
            if (Math.abs(dy) > 65 && Math.abs(dy) > Math.abs(dx) * 1.3) {
              if (dy < 0) session.next();
              else session.previous();
            } else if (Math.abs(dy) < 15 && Math.abs(dx) < 15)
              session.togglePlayback();
          }}
          onPointerCancel={() => {
            pointer.current = null;
          }}
          onClick={(event) => {
            if (event.detail === 0) session.togglePlayback();
          }}
        />
        {state.status === "paused" && !state.aboutOpen && (
          <div className="paused-glyph" aria-hidden="true">
            <Play size={28} />
          </div>
        )}
        {(state.status === "loading" || state.status === "buffering") && (
          <div className="player-status" role="status">
            <span className="loader" />
            {state.status === "loading" ? t.loading : t.buffering}
          </div>
        )}
        {state.status === "autoplay-blocked" && (
          <button className="player-message" onClick={session.togglePlayback}>
            <Play size={28} />
            <span>{t.autoplay}</span>
          </button>
        )}
        {state.status === "error" && (
          <div className="player-message" role="alert">
            <p>{t.mediaError}</p>
            <button className="text-button" onClick={retry}>
              {t.retry}
            </button>
          </div>
        )}
        <button
          type="button"
          className="small-pause"
          aria-label={state.shouldPlay ? t.pause : t.play}
          onClick={session.togglePlayback}
        >
          {state.shouldPlay ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="media-time" dir="ltr">
          {formatTime(state.positionMs)} / {formatTime(duration)}
        </div>
        <div
          className="media-progress"
          role="progressbar"
          aria-label={item.title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(
            100,
            Math.round((state.positionMs / duration) * 100),
          )}
        >
          <i
            style={{
              width: `${Math.min(100, (state.positionMs / duration) * 100)}%`,
            }}
          />
        </div>
      </div>
      <div className="metadata" dir="rtl">
        <a
          className="speaker"
          href={item.speaker.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.speaker.imageUrl && (
            <img
              src={item.speaker.imageUrl}
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          <span>{item.speaker.name}</span>
        </a>
        <h1 className="media-title">
          <a
            href={item.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={item.title}
          >
            {item.title}
          </a>
        </h1>
      </div>
      <button
        type="button"
        className="mobile-sound round-button"
        aria-label={state.muted ? t.soundOn : t.soundOff}
        onClick={session.toggleMuted}
      >
        {state.muted ? <VolumeX size={21} /> : <Volume2 size={21} />}
      </button>
      <div className="swipe-hint" aria-hidden="true">
        <ChevronUp size={18} />
        <span>{t.swipe}</span>
      </div>
    </>
  );
}
