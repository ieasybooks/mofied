import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderHandlers,
} from "react-native";
import type { SessionController, SessionSnapshot } from "@mofied/session";
import {
  SessionPager,
  commitsPage,
  PAGE_SETTLE_MS,
  type Direction,
} from "@mofied/session";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function PagedSession({
  session,
  renderPage,
}: {
  session: SessionController;
  renderPage: (
    state: SessionSnapshot,
    preview: boolean,
    gestures: GestureResponderHandlers,
    navigate: (direction: Direction) => void,
  ) => ReactNode;
}) {
  const pager = useMemo(() => new SessionPager(session), [session]);
  const state = useSyncExternalStore(pager.subscribe, pager.getSnapshot);
  const offset = useRef(new Animated.Value(0)).current;
  const { height, width } = useWindowDimensions();
  const extent = useRef(height);
  const dragging = useRef(false);
  const rejected = useRef(false);
  const reduced = useReducedMotion();
  useLayoutEffect(pager.connect, [pager]);
  useLayoutEffect(() => {
    extent.current = height;
    pager.cancel();
  }, [pager, height, width]);
  useLayoutEffect(() => {
    if (state.phase === "idle") {
      offset.stopAnimation();
      offset.setValue(0);
      dragging.current = false;
      return;
    }
    if (state.phase !== "settling") return;
    const animation = Animated.timing(offset, {
      toValue: state.commit ? -state.direction * extent.current : 0,
      duration: reduced ? 0 : PAGE_SETTLE_MS,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) pager.finish(state.revision);
    });
    return () => animation.stop();
  }, [pager, offset, state.phase, state.revision, reduced]);
  const gestures = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          pager.getSnapshot().phase === "idle",
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
        onPanResponderGrant: () => {
          dragging.current = false;
          rejected.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          if (gesture.numberActiveTouches > 1) {
            rejected.current = true;
            pager.cancel();
            return;
          }
          if (rejected.current) return;
          if (
            !dragging.current &&
            Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 8
          ) {
            if (Math.abs(gesture.dy) <= Math.abs(gesture.dx) * 1.2) {
              rejected.current = true;
              return;
            }
            dragging.current = pager.begin();
          }
          if (!dragging.current) return;
          const available = pager.preview(gesture.dy < 0 ? 1 : -1);
          offset.setValue(
            available
              ? Math.max(-extent.current, Math.min(extent.current, gesture.dy))
              : Math.max(-70, Math.min(70, gesture.dy * 0.18)),
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          if (rejected.current) return;
          if (dragging.current)
            pager.release(commitsPage(gesture.dy, gesture.vy, extent.current));
          else if (Math.abs(gesture.dy) < 12 && Math.abs(gesture.dx) < 12)
            session.togglePlayback();
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          pager.release(false);
        },
      }),
    [pager, offset, session],
  );
  return (
    <View style={styles.viewport} testID={`session-pager-${state.phase}`}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: offset }] },
        ]}
      >
        <View style={styles.page} key={state.page.item?.id ?? "ending"}>
          {renderPage(state.page, false, gestures.panHandlers, pager.navigate)}
        </View>
        {state.neighbor && (
          <View
            style={[styles.page, { top: state.direction * height }]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {renderPage(state.neighbor, true, {}, pager.navigate)}
          </View>
        )}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  page: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    backgroundColor: "#0a0a0a",
  },
});
