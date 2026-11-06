import type { SessionController } from "@mofied/session";

export type AudioInterruption = {
  interrupted: boolean;
  mayResume: boolean;
  focusGeneration?: number;
};
export type InterruptionSource = {
  getAudioInterruption(): AudioInterruption;
  /** Android focus follows the foreground session, including silent reminders. */
  setAudioSessionActive?(active: boolean, generation: number): Promise<void>;
  addListener(
    event: "audioInterruption",
    listener: (event: AudioInterruption) => void,
  ): { remove(): void };
};

let nextFocusGeneration = 0;

/** Subscribe for the session lifetime, including screens with no VideoPlayer. */
export function watchSessionInterruptions(
  source: InterruptionSource,
  session: SessionController,
) {
  let disposed = false;
  let active: boolean | undefined;
  let wants = session.getSnapshot().wantsToPlay;
  let generation = 0;
  const update = ({
    interrupted,
    mayResume,
    focusGeneration,
  }: AudioInterruption) => {
    if (disposed) return;
    // Ignore events queued before backgrounding, reacquisition, or a new owner.
    if (
      source.setAudioSessionActive &&
      (!active || focusGeneration !== generation)
    )
      return;
    session.setInterrupted(interrupted, mayResume);
  };
  const subscription = source.addListener("audioInterruption", update);
  const reconcileFocus = () => {
    const state = session.getSnapshot();
    const nextActive = !!state.item && !state.backgrounded;
    const retry = nextActive && state.wantsToPlay && !wants;
    wants = state.wantsToPlay;
    if (!source.setAudioSessionActive || (nextActive === active && !retry))
      return;
    active = nextActive;
    const request = (generation = ++nextFocusGeneration);
    // No countdown/playback is permitted while initial focus is unresolved.
    if (active) session.setInterrupted(true);
    void source.setAudioSessionActive(active, request).catch(() => {
      if (!disposed && request === generation && active)
        session.setInterrupted(false, false);
    });
  };
  const unsubscribe = session.subscribe(reconcileFocus);
  if (source.setAudioSessionActive) reconcileFocus();
  // iOS notification cache reconciliation remains synchronous.
  else update(source.getAudioInterruption());
  return () => {
    disposed = true;
    unsubscribe();
    subscription.remove();
    void source
      .setAudioSessionActive?.(false, ++nextFocusGeneration)
      .catch(() => {});
  };
}
