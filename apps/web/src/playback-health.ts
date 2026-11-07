import type { SessionController } from "@mofied/session";

type PlaybackMedia = Pick<
  HTMLMediaElement,
  "currentTime" | "paused" | "ended" | "seeking" | "readyState"
> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

/** Network events are hints; only stopped playback should consume a retry. */
export function watchPlaybackHealth(
  video: PlaybackMedia,
  session: SessionController,
  itemId: string,
  isReady: () => boolean = () => true,
) {
  let position = video.currentTime;
  let lastAdvance = performance.now();
  let shouldPlay = session.getSnapshot().shouldPlay;

  const reset = () => {
    position = video.currentTime;
    lastAdvance = performance.now();
  };
  // About/manual pause may last longer than the watchdog, including while JS
  // timers are suspended. Resume always starts a fresh recovery window.
  const unsubscribe = session.subscribe(() => {
    const next = session.getSnapshot().shouldPlay;
    if (next !== shouldPlay) {
      shouldPlay = next;
      reset();
    }
  });

  const progress = () => {
    if (!isReady()) return;
    const advanced = video.currentTime > position;
    position = video.currentTime;
    if (
      shouldPlay &&
      advanced &&
      !video.paused &&
      !video.ended &&
      !video.seeking
    ) {
      lastAdvance = performance.now();
      const { status } = session.getSnapshot();
      // Some native HLS implementations resume timeupdates without a second
      // playing event. Real progress must clear their stale buffering state.
      if (status === "loading" || status === "buffering")
        session.mediaPlaying(itemId, position * 1000);
    }
    session.mediaProgress(itemId, position * 1000);
  };
  const playing = () => {
    if (!isReady()) return;
    reset();
    session.mediaPlaying(itemId, position * 1000);
  };
  const waiting = () => {
    progress();
    // stalled means the fetch stopped receiving data, not that buffered frames
    // stopped playing. HAVE_FUTURE_DATA (3) or better does not imply buffering.
    if (shouldPlay && !video.ended && video.readyState < 3)
      session.mediaBuffering(itemId);
  };
  const handlers = { timeupdate: progress, playing, waiting, stalled: waiting };
  for (const [event, handler] of Object.entries(handlers))
    video.addEventListener(event, handler);

  const timer = setInterval(() => {
    // Read the playhead before checking elapsed time. Hidden tabs can delay JS
    // callbacks for >20s while the media itself continues playing normally.
    progress();
    if (!shouldPlay || video.ended) return;
    const idleMs = performance.now() - lastAdvance;
    if (idleMs >= 20_000) session.mediaFailed(itemId);
    else if (idleMs >= 1500 && session.getSnapshot().status === "playing")
      session.mediaBuffering(itemId);
  }, 1000);

  return () => {
    clearInterval(timer);
    unsubscribe();
    for (const [event, handler] of Object.entries(handlers))
      video.removeEventListener(event, handler);
  };
}
