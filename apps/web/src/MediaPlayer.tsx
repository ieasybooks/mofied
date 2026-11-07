import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type Hls from "hls.js";
import { Pause, Play } from "lucide-react";
import type { MediaItem } from "@mofied/contracts";
import { copy, formatTime, type Locale } from "@mofied/design";
import type { SessionController, SessionSnapshot } from "@mofied/session";
import { watchPlaybackHealth } from "./playback-health";
import { MediaPreloader, permitsPreload, warmLoader } from "./media-preload";

export type MediaHandle = { synchronize: () => void };

export const MediaPlayer = forwardRef<
  MediaHandle,
  {
    item: MediaItem | null;
    session: SessionController;
    state: SessionSnapshot;
    locale: Locale;
    preview?: boolean;
    togglePlayback: () => void;
  }
>(function MediaPlayer(
  { item, session, state, locale, preview = false, togglePlayback },
  handle,
) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const preloader = useRef(new MediaPreloader());
  const startPosition = useRef(state.positionMs / 1000);
  const [attempt, setAttempt] = useState(0);
  const [measuredDuration, setMeasuredDuration] = useState<{
    id: string;
    ms: number;
  } | null>(null);
  const duration =
    measuredDuration && measuredDuration.id === item?.id
      ? measuredDuration.ms
      : (item?.durationMs ?? 0);
  const synchronize = useRef(() => {});
  useImperativeHandle(
    handle,
    () => ({ synchronize: () => synchronize.current() }),
    [],
  );
  const t = copy[locale];

  useEffect(() => {
    if (preview || !item) return;
    const video = ref.current!;
    const warmup = preloader.current.take(item.playback.url);
    let objectUrl: string | null = null;
    startPosition.current = session.getSnapshot().positionMs / 1000;
    video.muted = session.getSnapshot().muted;
    let cancelled = false;
    let recoveries = 0;
    let initialized = false;
    const progress = () =>
      session.mediaProgress(item.id, video.currentTime * 1000);
    const stopWatching = watchPlaybackHealth(
      video,
      session,
      item.id,
      () => initialized,
    );
    const ended = () => {
      if (!cancelled && initialized && video.ended)
        session.mediaEnded(item.id, video.currentTime * 1000);
    };
    const failed = () => {
      if (!cancelled) session.mediaFailed(item.id);
    };
    // A persistent element can receive queued events from its old resource.
    const mediaError = () => {
      if (video.error) failed();
    };
    const pausedExternally = () => {
      if (
        !cancelled &&
        video.paused &&
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
      if (video.readyState < 1) return;
      if (Number.isFinite(video.duration))
        setMeasuredDuration({ id: item.id, ms: video.duration * 1000 });
      if (startPosition.current > 0) {
        video.currentTime = Math.min(
          startPosition.current,
          Math.max(0, video.duration - 0.1),
        );
        startPosition.current = 0;
      }
      initialized = true;
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
    const sync = () => {
      const live = session.getSnapshot();
      if (cancelled || live.item?.id !== item.id) return;
      video.muted = live.muted;
      if (live.shouldPlay) void play();
      else video.pause();
    };
    synchronize.current = sync;
    for (const [event, handler] of Object.entries({
      ended,
      pause: pausedExternally,
      error: mediaError,
      loadedmetadata: loaded,
    }))
      video.addEventListener(event, handler);
    document.addEventListener("visibilitychange", visibleAgain);
    const load = async () => {
      if (
        item.playback.mimeType === "application/vnd.apple.mpegurl" &&
        !video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Native HLS and MP4 playback never download the fallback engine.
        const { default: Hls } = await import("hls.js");
        if (cancelled) return;
        if (!Hls.isSupported()) return failed();
        const hls = new Hls({
          loader: warmLoader(Hls, warmup),
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          backBufferLength: 0,
          enableWorker: true,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || cancelled) return;
          if (recoveries++ < 2 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // startLoad restarts segment loading; a failed initial manifest
            // needs loadSource or no retry request is actually sent.
            if (
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
            )
              hls.loadSource(item.playback.url);
            else hls.startLoad();
          } else if (recoveries < 3 && data.type === Hls.ErrorTypes.MEDIA_ERROR)
            hls.recoverMediaError();
          else failed();
        });
        hls.loadSource(item.playback.url);
        hls.attachMedia(video);
      } else {
        const cached =
          item.playback.mimeType === "video/mp4"
            ? warmup.get(item.playback.url)
            : undefined;
        if (cached)
          objectUrl = URL.createObjectURL(
            new Blob([cached.data], { type: "video/mp4" }),
          );
        video.src = objectUrl ?? item.playback.url;
      }
      if (session.getSnapshot().shouldPlay) void play();
    };
    void load().catch(failed);
    return () => {
      cancelled = true;
      if (synchronize.current === sync) synchronize.current = () => {};
      stopWatching();
      for (const [event, handler] of Object.entries({
        ended,
        pause: pausedExternally,
        error: mediaError,
        loadedmetadata: loaded,
      }))
        video.removeEventListener(event, handler);
      document.removeEventListener("visibilitychange", visibleAgain);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    item?.id,
    item?.playback.url,
    item?.playback.mimeType,
    session,
    attempt,
    preview,
  ]);

  useEffect(() => {
    if (!preview) synchronize.current();
  }, [state.shouldPlay, state.muted, item?.id, session, attempt, preview]);

  useEffect(() => {
    if (preview) return;
    // Automatic advancement changes the controller before the outgoing page
    // finishes sliding. Preserve its warmed destination until the handoff.
    if (session.getSnapshot().item?.id !== state.item?.id) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const next = session.upcomingMedia();
    if (
      !next ||
      !permitsPreload(connection) ||
      (session.plan.expiresAt &&
        Date.parse(session.plan.expiresAt) <= Date.now())
    ) {
      preloader.current.clear();
    } else if (
      state.wantsToPlay &&
      !state.aboutOpen &&
      !state.backgrounded &&
      (state.status === "playing" ||
        state.status === "reminder" ||
        state.navigating)
    ) {
      void preloader.current.prepare(
        next,
        !!ref.current?.canPlayType("application/vnd.apple.mpegurl"),
      );
    } else preloader.current.suspend();
  }, [
    session,
    state.item?.id,
    state.status,
    state.wantsToPlay,
    state.aboutOpen,
    state.backgrounded,
    state.navigating,
    state.remainingMs === 0,
    preview,
  ]);
  useEffect(() => () => preloader.current.clear(), []);

  const retry = () => {
    startPosition.current = state.positionMs / 1000;
    session.retry();
    setAttempt((value) => value + 1);
  };
  return (
    <>
      <div className="player-frame" data-testid="media-player" hidden={!item}>
        {preview ? (
          item?.posterUrl ? (
            <img className="media-poster" src={item.posterUrl} alt="" />
          ) : (
            <div className="preview-placeholder">
              <Play size={42} />
            </div>
          )
        ) : (
          <video
            ref={ref}
            muted={state.muted}
            poster={item?.posterUrl ?? undefined}
            playsInline
            preload="auto"
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate noremoteplayback"
            aria-label={item?.title}
          />
        )}
        {item && (
          <>
            <div className="scrim-top" />
            <div className="scrim-bottom" />
            <button
              type="button"
              className="media-tap"
              aria-label={state.wantsToPlay ? t.pause : t.play}
              onClick={(event) => {
                if (event.detail === 0) togglePlayback();
              }}
            />
            {state.status === "paused" &&
              !state.aboutOpen &&
              !state.navigating && (
                <div className="paused-glyph" aria-hidden="true">
                  <Play size={28} />
                </div>
              )}
            {!preview &&
              (state.status === "loading" || state.status === "buffering") && (
                <div className="player-status" role="status">
                  <span className="loader" />
                  {state.status === "loading" ? t.loading : t.buffering}
                </div>
              )}
            {state.status === "autoplay-blocked" && (
              <button className="player-message" onClick={togglePlayback}>
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
              aria-label={state.wantsToPlay ? t.pause : t.play}
              onClick={togglePlayback}
            >
              {state.shouldPlay ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </>
        )}
      </div>
      {item && (
        <div className="media-bottom">
          <div
            className="metadata"
            dir={session.plan.locale === "ar" ? "rtl" : "ltr"}
            lang={session.plan.locale}
          >
            <a
              className="speaker"
              href={item.speaker.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.speaker.imageUrl && (
                <img
                  key={item.id}
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
          <div className="media-timing">
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
        </div>
      )}
    </>
  );
});
