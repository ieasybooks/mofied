// Development-only browser rendering of the native UI. Device playback uses expo-video.
import { useEffect, useRef } from "react";
import Hls from "hls.js";
import type { MediaProps } from "./NativeMedia";

export function NativeMedia({ item, session, state }: MediaProps) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current!;
    const progress = () =>
      session.mediaProgress(item.id, element.currentTime * 1000);
    const playing = () =>
      session.mediaPlaying(item.id, element.currentTime * 1000);
    const ended = () => session.mediaEnded(item.id, element.currentTime * 1000);
    const failed = () => session.mediaFailed(item.id);
    const waiting = () => session.mediaBuffering(item.id);
    for (const [event, handler] of Object.entries({
      timeupdate: progress,
      playing,
      ended,
      error: failed,
      waiting,
    }))
      element.addEventListener(event, handler);
    let hls: Hls | null = null;
    if (
      !element.canPlayType("application/vnd.apple.mpegurl") &&
      Hls.isSupported() &&
      item.playback.mimeType !== "video/mp4"
    ) {
      hls = new Hls({ maxBufferLength: 20, backBufferLength: 0 });
      hls.loadSource(item.playback.url);
      hls.attachMedia(element);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) failed();
      });
    } else element.src = item.playback.url;
    return () => {
      for (const [event, handler] of Object.entries({
        timeupdate: progress,
        playing,
        ended,
        error: failed,
        waiting,
      }))
        element.removeEventListener(event, handler);
      hls?.destroy();
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [item.id, session]);
  useEffect(() => {
    const element = video.current!;
    element.muted = state.muted;
    if (state.shouldPlay)
      void element.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError")
          session.autoplayBlocked(item.id);
      });
    else element.pause();
  }, [state.shouldPlay, state.muted, item.id, session]);
  return (
    <video
      ref={video}
      playsInline
      muted={state.muted}
      poster={item.posterUrl ?? undefined}
      disablePictureInPicture
      disableRemotePlayback
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}
