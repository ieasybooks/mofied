import { useEffect, useRef, useState } from "react";
import { AppState, Image, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { MediaItem } from "@mofied/contracts";
import type { SessionController, SessionSnapshot } from "@mofied/session";
import { watchNativePlaybackHealth } from "./native-playback-health";

export type MediaProps = {
  item: MediaItem;
  session: SessionController;
  state: SessionSnapshot;
};
export function NativeMedia({ item, session, state }: MediaProps) {
  const [hasFrame, setHasFrame] = useState(false);
  const start = useRef(state.positionMs / 1000);
  const source = {
    uri: item.playback.url,
    contentType:
      item.playback.mimeType === "video/mp4"
        ? ("progressive" as const)
        : ("hls" as const),
  };
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.muted = state.muted;
    instance.staysActiveInBackground = false;
    instance.allowsExternalPlayback = false;
    instance.showNowPlayingNotification = false;
    instance.audioMixingMode = "doNotMix";
    instance.timeUpdateEventInterval = 0.25;
  });
  useEffect(() => {
    let disposed = false;
    const stopHealth = watchNativePlaybackHealth(player, session, item.id);
    const subscriptions = [
      player.addListener("sourceLoad", () => {
        if (start.current > 0) {
          player.currentTime = start.current;
          start.current = 0;
        }
      }),
      player.addListener("playToEnd", () =>
        session.mediaEnded(item.id, player.currentTime * 1000),
      ),
      AppState.addEventListener("change", (next) => {
        // Inactive alone includes Control Center. It must not trigger our own pause.
        if (next === "active") {
          queueMicrotask(() => {
            if (disposed) return;
            if (session.getSnapshot().shouldPlay && !player.playing)
              player.play();
          });
        }
      }),
    ];
    return () => {
      disposed = true;
      stopHealth();
      for (const subscription of subscriptions) subscription.remove();
      player.pause();
    };
  }, [item.id, player, session]);
  useEffect(() => {
    player.muted = state.muted;
    if (state.shouldPlay) player.play();
    else player.pause();
    // Session-level native events restore permission. Keep actual playback,
    // including muted playback, aligned with accounting during interruptions.
  }, [player, state.shouldPlay, state.muted]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        contentFit="cover"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        allowsVideoFrameAnalysis={false}
        onFirstFrameRender={() => setHasFrame(true)}
      />
      {!hasFrame && item.posterUrl && (
        <Image
          source={{ uri: item.posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
    </View>
  );
}
