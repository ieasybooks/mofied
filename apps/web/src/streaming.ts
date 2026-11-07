import type Hls from "hls.js";

/** Prefer controllable buffering so even native-HLS browsers can consume the
 * session's warmed bytes without another HTTP validation round trip. iPhone
 * exposes ManagedMediaSource instead of MediaSource on supported OS versions. */
export function canBufferHls(): boolean {
  const environment = globalThis as typeof globalThis & {
    ManagedMediaSource?: typeof MediaSource;
    WebKitMediaSource?: typeof MediaSource;
  };
  const source =
    environment.MediaSource ??
    environment.ManagedMediaSource ??
    environment.WebKitMediaSource;
  return !!source?.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
}

let engine: Promise<typeof Hls> | undefined;
export function loadHls(): Promise<typeof Hls> {
  return (engine ??= import("hls.js")
    .then(({ default: Hls }) => Hls)
    .catch((error: unknown) => {
      engine = undefined;
      throw error;
    }));
}
