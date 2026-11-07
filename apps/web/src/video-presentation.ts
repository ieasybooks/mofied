/** A playable resource is not necessarily painted yet. Keep its poster until
 * the compositor receives a frame, including for paused/restored playback. */
export function watchVideoPresentation(
  video: HTMLVideoElement,
  initialized: () => boolean,
  presented: () => void,
) {
  let disposed = false;
  let complete = false;
  let frame: number | undefined;
  let paint: number | undefined;
  let presentedTime: number | undefined;
  const ready = () =>
    initialized() &&
    !video.seeking &&
    video.readyState >= 2 &&
    video.videoWidth > 0;
  const reveal = () => {
    if (disposed || complete || !ready()) return;
    complete = true;
    presented();
  };
  const hasFrameCallback =
    typeof video.requestVideoFrameCallback === "function";
  const observe = () => {
    if (disposed || complete) return;
    if (hasFrameCallback) {
      // A paused seek can present its final frame just before seeking becomes
      // false. Reconcile that already-presented frame on seeked/loadeddata;
      // waiting for another callback would leave the poster up indefinitely.
      if (
        presentedTime !== undefined &&
        Math.abs(presentedTime - video.currentTime) < 0.1
      )
        reveal();
      if (complete) return;
      if (frame !== undefined) return;
      frame = video.requestVideoFrameCallback((_at, metadata) => {
        frame = undefined;
        if (initialized()) presentedTime = metadata.mediaTime;
        reveal();
        if (!complete) observe();
      });
    } else if (paint === undefined && ready()) {
      // Older engines have no compositor callback. Allow decoded data to reach
      // a paint before removing the cover, and recheck after any pending seek.
      paint = requestAnimationFrame(() => {
        paint = requestAnimationFrame(() => {
          paint = undefined;
          reveal();
        });
      });
    }
  };
  const events = ["loadeddata", "seeked", "playing", "timeupdate"];
  for (const event of events) video.addEventListener(event, observe);
  observe();
  return () => {
    disposed = true;
    if (frame !== undefined) video.cancelVideoFrameCallback(frame);
    if (paint !== undefined) cancelAnimationFrame(paint);
    for (const event of events) video.removeEventListener(event, observe);
  };
}
