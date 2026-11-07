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
      if (frame !== undefined) return;
      frame = video.requestVideoFrameCallback(() => {
        frame = undefined;
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
