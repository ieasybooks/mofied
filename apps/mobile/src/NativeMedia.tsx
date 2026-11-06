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
  const start = useRef(state.positionMs);
  const positionReadyRef = useRef(start.current === 0);
  const [positionReady, setPositionReady] = useState(positionReadyRef.current);
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
    const stopHealth = watchNativePlaybackHealth(player, session, item.id, {
      initialPositionMs: start.current,
      onPositionReady: () => {
        positionReadyRef.current = true;
        setPositionReady(true);
      },
    });
    const subscriptions = [
      player.addListener("playToEnd", () => {
        if (positionReadyRef.current)
          session.mediaEnded(item.id, player.currentTime * 1000);
      }),
      AppState.addEventListener("change", (next) => {
        // Inactive alone includes Control Center. It must not trigger our own pause.
        if (next === "active") {
          queueMicrotask(() => {
            if (disposed) return;
            if (
              positionReadyRef.current &&
              session.getSnapshot().shouldPlay &&
              !player.playing
            )
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
    if (positionReady && state.shouldPlay) player.play();
    else player.pause();
    // Session-level native events restore permission. Keep actual playback,
    // including muted playback, aligned with accounting during interruptions.
  }, [player, positionReady, state.shouldPlay, state.muted]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls={false}
        surfaceType="textureView"
        contentFit="cover"
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        allowsVideoFrameAnalysis={false}
        onFirstFrameRender={() => setHasFrame(true)}
      />
      {(!hasFrame || !positionReady) && item.posterUrl && (
        <Image
          source={{ uri: item.posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
    </View>
  );
}
