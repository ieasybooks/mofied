import type { SessionController } from "@mofied/session";

export type AudioInterruption = { interrupted: boolean; mayResume: boolean };
export type InterruptionSource = {
  getAudioInterruption(): AudioInterruption;
  addListener(
    event: "audioInterruption",
    listener: (event: AudioInterruption) => void,
  ): { remove(): void };
};

/** Subscribe for the session lifetime, including screens with no VideoPlayer. */
export function watchSessionInterruptions(
  source: InterruptionSource,
  session: SessionController,
) {
  let disposed = false;
  const update = ({ interrupted, mayResume }: AudioInterruption) => {
    if (!disposed) session.setInterrupted(interrupted, mayResume);
  };
  const subscription = source.addListener("audioInterruption", update);
  // Covers an interruption that began before the session/listener was ready.
  update(source.getAudioInterruption());
  return () => {
    disposed = true;
    subscription.remove();
  };
}
