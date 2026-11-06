import type { VideoPlayer } from "expo-video";
import type { SessionController } from "@mofied/session";

export type NativePlaybackPlayer = Pick<
  VideoPlayer,
  "currentTime" | "playing" | "status" | "play" | "pause" | "addListener"
>;

/** Native callbacks can lag behind both player properties and each other. */
export function watchNativePlaybackHealth(
  player: NativePlaybackPlayer,
  session: SessionController,
  itemId: string,
  restoration: { initialPositionMs: number; onPositionReady: () => void } = {
    initialPositionMs: 0,
    onPositionReady: () => {},
  },
) {
  let disposed = false;
  let failed = false;
  let position = player.currentTime;
  let lastAdvance = performance.now();
  let shouldPlay = session.getSnapshot().shouldPlay;
  let resumeRequested = false;
  const initialPosition = restoration.initialPositionMs / 1000;
  let seekingInitialPosition = initialPosition > 0;
  let seekRequested = false;
  const isCurrent = () =>
    !disposed && session.getSnapshot().item?.id === itemId;
  const reset = () => {
    position = player.currentTime;
    lastAdvance = performance.now();
    resumeRequested = false;
  };
  const unsubscribe = session.subscribe(() => {
    if (!isCurrent()) return;
    const next = session.getSnapshot().shouldPlay;
    if (next !== shouldPlay) {
      shouldPlay = next;
      reset();
    }
  });
  const fail = () => {
    if (!isCurrent() || failed) return;
    failed = true;
    session.mediaFailed(itemId);
  };
  const playing = () => {
    const { status } = session.getSnapshot();
    if (status === "loading" || status === "buffering")
      session.mediaPlaying(itemId, position * 1000);
  };
  const buffering = () => {
    const { status } = session.getSnapshot();
    if (status === "loading" || status === "playing")
      session.mediaBuffering(itemId);
  };
  const restorePosition = () => {
    if (!seekingInitialPosition) return true;
    // Loading/early timeUpdate callbacks commonly report zero. Keep the saved
    // position intact until the asynchronous native seek is acknowledged.
    if (!seekRequested && player.status === "readyToPlay") {
      seekRequested = true;
      player.currentTime = initialPosition;
    }
    const next = player.currentTime;
    if (seekRequested && next > 0 && Math.abs(next - initialPosition) < 0.5) {
      seekingInitialPosition = false;
      position = next;
      lastAdvance = performance.now();
      resumeRequested = false;
      restoration.onPositionReady();
      return true;
    }
    if (player.playing) player.pause();
    return false;
  };
  const progress = () => {
    if (!isCurrent() || failed) return false;
    if (!restorePosition()) return false;
    // Read the current playhead, not a possibly queued timeUpdate payload.
    const next = player.currentTime;
    if (!Number.isFinite(next)) return false;
    const advanced = next > position;
    position = next;
    if (session.getSnapshot().shouldPlay && advanced) {
      lastAdvance = performance.now();
      resumeRequested = false;
      // Recovery does not always deliver a second playingChange callback.
      playing();
    }
    session.mediaProgress(itemId, position * 1000);
    return advanced;
  };
  const resume = () => {
    if (
      isCurrent() &&
      !failed &&
      !seekingInitialPosition &&
      session.getSnapshot().shouldPlay &&
      player.status === "readyToPlay" &&
      !player.playing &&
      !resumeRequested
    ) {
      // One request per period without progress; a real failure still times out.
      resumeRequested = true;
      player.play();
    }
  };
  const reconcile = () => {
    if (!isCurrent() || failed) return;
    const advanced = progress();
    if (seekingInitialPosition) return;
    const state = session.getSnapshot();
    if (!state.shouldPlay) {
      if (player.playing) player.pause();
      return;
    }
    if (player.playing && player.status === "readyToPlay") playing();
    else if (!advanced) buffering();
    // A stopped native player is not evidence of autoplay denial. Keep intent
    // through buffering; explicit audioInterruption events own OS permission.
  };
  const subscriptions = [
    player.addListener("sourceLoad", () => {
      reconcile();
      resume();
    }),
    player.addListener("timeUpdate", progress),
    player.addListener("playingChange", reconcile),
    player.addListener("statusChange", ({ status }) => {
      if (status === "error") return fail();
      reconcile();
      if (status === "readyToPlay") resume();
    }),
  ];
  const timer = setInterval(() => {
    if (!isCurrent() || failed) return;
    // Sample before the deadline check, even if JS callbacks were delayed.
    progress();
    if (!session.getSnapshot().shouldPlay) return;
    const idleMs = performance.now() - lastAdvance;
    if (idleMs >= 20_000) fail();
    else if (idleMs >= 1500) {
      buffering();
      resume();
    }
  }, 1000);
  if (player.status === "error") fail();
  else if (seekingInitialPosition) reconcile();
  return () => {
    disposed = true;
    clearInterval(timer);
    unsubscribe();
    for (const subscription of subscriptions) subscription.remove();
  };
}
