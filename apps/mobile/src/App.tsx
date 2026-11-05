import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import {
  Info,
  Clock3,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Mail,
  BookOpen,
  Globe,
} from "lucide-react-native";
import { SessionController } from "@mofied/session";
import {
  colors,
  copy,
  remainingLabel,
  countdownLabel,
  formatTime,
  type Locale,
} from "@mofied/design";
import { NativeMedia } from "./NativeMedia";
import { loadSession } from "./provider";

const icon = require("../../../packages/design/assets/icons/icon-white-1024.png");
const appIcon = require("../../../packages/design/assets/icons/app-icon-flat-dark-1024.png");
const storageKey = `mofied.session.v1.${__DEV__ ? "development" : "production"}`;
const open = (url: string) => {
  void Linking.openURL(url).catch(() => {});
};

export default function App() {
  const [fonts, fontError] = useFonts({
    Thmanyah: require("../../../packages/design/assets/fonts/ThmanyahSerifDisplay-Medium.ttf"),
    NotoNaskhUI: require("../../../packages/design/assets/fonts/NotoNaskhArabicUI-400.ttf"),
    NotoNaskhUIBold: require("../../../packages/design/assets/fonts/NotoNaskhArabicUI-600.ttf"),
    Kitab: require("../../../packages/design/assets/fonts/Kitab-Regular.ttf"),
    Gilroy: require("../../../packages/design/assets/fonts/Gilroy-Regular.ttf"),
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {fonts || fontError ? (
        <LoadedApp />
      ) : (
        <View style={styles.startup}>
          <ActivityIndicator color="white" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

function LoadedApp() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<SessionController | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locale, setLocale] = useState<Locale>("ar");
  const [startupInfo, setStartupInfo] = useState(false);
  const startupInfoRef = useRef(false);
  const showStartupInfo = (open: boolean) => {
    startupInfoRef.current = open;
    setStartupInfo(open);
  };
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    void (async () => {
      const saved = await AsyncStorage.getItem(storageKey).catch(() => null);
      const restored = saved ? SessionController.restore(saved) : null;
      const next =
        restored ?? new SessionController(await loadSession(abort.signal));
      // Browser layout preview keeps autoplay muted; real native playback starts with sound.
      if (!restored && Platform.OS !== "web") next.toggleMuted();
      if (Platform.OS !== "web" && AppState.currentState === "background")
        next.setBackgrounded(true);
      if (startupInfoRef.current) next.openAbout();
      if (!abort.signal.aborted) setSession(next);
    })().catch(() => {
      if (!abort.signal.aborted) setError(true);
    });
    return () => abort.abort();
  }, [attempt]);
  if (!session)
    return (
      <View style={styles.startup}>
        <View style={[styles.header, { top: insets.top + 18 }]}>
          <Pressable
            style={styles.circle}
            accessibilityRole="button"
            accessibilityLabel={copy[locale].info}
            onPress={() => showStartupInfo(true)}
          >
            <Info size={21} color="white" />
          </Pressable>
        </View>
        <Image source={icon} style={styles.startupMark} />
        {error ? (
          <>
            <Text style={styles.endTitle}>{copy[locale].loadError}</Text>
            <Text style={styles.body}>{copy[locale].connection}</Text>
            <Pressable
              style={styles.readButton}
              onPress={() => setAttempt((value) => value + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.ui}>{copy[locale].retry}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color="white" />
        )}
        <About
          visible={startupInfo}
          hasPlayback={false}
          locale={locale}
          setLocale={setLocale}
          close={() => showStartupInfo(false)}
        />
      </View>
    );
  return (
    <SessionView session={session} locale={locale} setLocale={setLocale} />
  );
}

function KeepScreenAwake() {
  useKeepAwake("mofied-session");
  return null;
}
function SessionView({
  session,
  locale,
  setLocale,
}: {
  session: SessionController;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const item = state.item;
  const t = copy[locale];
  useEffect(() => {
    const timer = setInterval(session.tick, 100);
    let disposed = false;
    let pendingWrite = Promise.resolve();
    const persist = () => {
      const value = session.serialize();
      // Serialize writes so an old save cannot recreate a completed session.
      pendingWrite = pendingWrite
        .then(() =>
          value
            ? AsyncStorage.setItem(storageKey, value)
            : AsyncStorage.removeItem(storageKey),
        )
        .catch(() => {});
    };
    const saveTimer = setInterval(persist, 1500);
    const unsubscribe = session.subscribe(() => {
      if (session.getSnapshot().status === "ended") persist();
    });
    const subscription = AppState.addEventListener("change", (next) => {
      if (disposed) return;
      if (Platform.OS === "web") return;
      if (next === "background") {
        session.setBackgrounded(true);
        persist();
      } else if (next === "active") session.setBackgrounded(false);
      // Do not pause for inactive/blur alone (Control Center / notification drawer).
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      clearInterval(saveTimer);
      unsubscribe();
      subscription.remove();
      persist();
    };
  }, [session]);
  const gestures = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 8,
        onPanResponderRelease: (_event, gesture) => {
          if (
            Math.abs(gesture.dy) > 65 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.3
          ) {
            if (gesture.dy < 0) session.next();
            else session.previous();
          } else if (Math.abs(gesture.dy) < 12 && Math.abs(gesture.dx) < 12)
            session.togglePlayback();
        },
      }),
    [session],
  );
  const retry = () => {
    session.retry();
    setAttempt((value) => value + 1);
  };
  return (
    <View style={styles.root}>
      {state.shouldPlay && state.status !== "error" && <KeepScreenAwake />}
      {item?.kind === "media" && (
        <>
          <NativeMedia
            key={`${item.id}:${attempt}`}
            item={item}
            session={session}
            state={state}
          />
          <LinearGradient
            colors={["#00000066", "transparent"]}
            style={styles.topScrim}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "#00000099", "#000000dd", "#000000ee"]}
            locations={[0, 0.38, 0.64, 1]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />
          <View
            style={StyleSheet.absoluteFill}
            {...gestures.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={state.shouldPlay ? t.pause : t.play}
            accessibilityActions={[
              { name: "activate", label: state.shouldPlay ? t.pause : t.play },
              { name: "increment", label: t.next },
              { name: "decrement", label: t.previous },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "increment") session.next();
              else if (event.nativeEvent.actionName === "decrement")
                session.previous();
              else session.togglePlayback();
            }}
          />
          <View style={[styles.metadata, { bottom: insets.bottom + 112 }]}>
            <Pressable
              style={styles.speaker}
              accessibilityRole="link"
              onPress={() => open(item.speaker.pageUrl)}
            >
              {item.speaker.imageUrl && (
                <Image
                  source={{ uri: item.speaker.imageUrl }}
                  style={styles.portrait}
                />
              )}
              <Text style={styles.speakerName}>{item.speaker.name}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => open(item.pageUrl)}
            >
              <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                {item.title}
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={[
              styles.circle,
              styles.sound,
              { bottom: insets.bottom + 44 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={state.muted ? t.soundOn : t.soundOff}
            onPress={session.toggleMuted}
            hitSlop={4}
          >
            {state.muted ? (
              <VolumeX color="white" size={21} />
            ) : (
              <Volume2 color="white" size={21} />
            )}
          </Pressable>
          <View
            style={[styles.swipe, { bottom: insets.bottom + 46 }]}
            pointerEvents="none"
          >
            <ChevronUp size={18} color="#ffffffc4" />
            <Text style={styles.swipeText}>{t.swipe}</Text>
          </View>
          <Text style={[styles.time, { bottom: insets.bottom + 44 }]}>
            {formatTime(state.positionMs)} / {formatTime(item.durationMs)}
          </Text>
          <View
            style={[styles.progress, { bottom: insets.bottom + 24 }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.min(
                100,
                Math.round((state.positionMs / item.durationMs) * 100),
              ),
            }}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (state.positionMs / item.durationMs) * 100)}%`,
                },
              ]}
            />
          </View>
          {state.status === "paused" && !state.aboutOpen && (
            <View pointerEvents="none" style={styles.center}>
              <View style={styles.paused}>
                <Play color="white" size={28} />
              </View>
            </View>
          )}
          {(state.status === "loading" || state.status === "buffering") && (
            <View style={styles.center} pointerEvents="none">
              <ActivityIndicator color="white" />
              <Text style={styles.ui}>{t.buffering}</Text>
            </View>
          )}
          {(state.status === "error" ||
            state.status === "autoplay-blocked") && (
            <View style={styles.center}>
              <View style={styles.errorBox}>
                <Text style={styles.body}>
                  {state.status === "error" ? t.mediaError : t.autoplay}
                </Text>
                <Pressable
                  style={styles.readButton}
                  accessibilityRole="button"
                  onPress={
                    state.status === "error" ? retry : session.togglePlayback
                  }
                >
                  <Text style={styles.ui}>
                    {state.status === "error" ? t.retry : t.play}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
      {item?.kind === "reminder" && (
        <>
          <LinearGradient
            colors={["#181818", "#0a0a0a"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.reminderBody}>
            <View style={styles.kind}>
              <BookOpen size={18} color="#d6d6d6" />
              <Text style={styles.ui}>
                {item.content.kind === "quran" ? t.quran : t.reflection}
              </Text>
            </View>
            <Text
              style={
                item.content.kind === "quran"
                  ? styles.verses
                  : styles.reminderText
              }
            >
              {item.content.body}
            </Text>
            <View style={styles.rule} />
            <Text style={styles.citation}>{item.content.citation}</Text>
          </View>
          <View style={[styles.reminderBottom, { bottom: insets.bottom + 40 }]}>
            <Text style={styles.countdown}>
              {countdownLabel(state.reminderRemainingMs, locale)}
            </Text>
            <View style={styles.countTrack}>
              <View
                style={[
                  styles.countFill,
                  {
                    width: `${(state.reminderRemainingMs / item.durationMs) * 100}%`,
                  },
                ]}
              />
            </View>
            <Pressable
              style={styles.readButton}
              accessibilityRole="button"
              onPress={session.togglePlayback}
            >
              {state.wantsToPlay ? (
                <Pause color="white" size={18} />
              ) : (
                <Play color="white" size={18} />
              )}
              <Text style={styles.ui}>
                {state.wantsToPlay ? t.pauseRead : t.resumeRead}
              </Text>
            </Pressable>
            <Text style={styles.source}>
              {item.content.kind === "quran"
                ? t.textSource
                : item.content.source}
            </Text>
          </View>
        </>
      )}
      {!item && (
        <View style={styles.ending}>
          <Image source={icon} style={styles.endMark} />
          <Text style={styles.endTitle}>{state.ending.title}</Text>
          <View style={styles.rule} />
          <Text style={styles.endBody}>{state.ending.body}</Text>
        </View>
      )}
      <View
        style={[styles.header, { top: insets.top + 18 }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.circle}
          onPress={session.openAbout}
          accessibilityRole="button"
          accessibilityLabel={t.info}
          hitSlop={4}
        >
          <Info size={21} color="white" />
        </Pressable>
        {item && (
          <View style={styles.budget}>
            <Clock3 size={15} color="#f5f5f5" />
            <Text style={styles.budgetText}>
              {remainingLabel(state.remainingMs, locale)}
            </Text>
          </View>
        )}
      </View>
      <About
        visible={state.aboutOpen}
        hasPlayback={!!item}
        locale={locale}
        setLocale={setLocale}
        close={session.closeAbout}
      />
    </View>
  );
}

type AboutPage = "info" | "privacy" | "support" | "sources";
function About({
  visible,
  hasPlayback,
  locale,
  setLocale,
  close,
}: {
  visible: boolean;
  hasPlayback: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  close: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<AboutPage | null>(null);
  const t = copy[locale];
  useEffect(() => {
    if (!visible) setPage(null);
  }, [visible]);
  const rows = [
    [Info, "info"],
    [Shield, "privacy"],
    [Mail, "support"],
    [BookOpen, "sources"],
  ] as const;
  const bodies = {
    info: t.aboutBody,
    privacy: t.privacyBody,
    support: t.supportBody,
    sources: t.sourcesBody,
  };
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.modal}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={close}
          accessibilityLabel={t.close}
          accessibilityRole="button"
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 26 }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.aboutHead}>
            <Image source={appIcon} style={styles.aboutIcon} />
            <View>
              <Text style={styles.aboutName}>{page ? t[page] : t.name}</Text>
              {hasPlayback && (
                <Text style={styles.aboutSubtitle}>{t.pausedAbout}</Text>
              )}
            </View>
          </View>
          <Pressable
            style={[styles.circle, styles.close]}
            accessibilityRole="button"
            accessibilityLabel={t.close}
            onPress={close}
          >
            <X size={20} color="white" />
          </Pressable>
          <ScrollView
            style={styles.aboutScroll}
            contentContainerStyle={styles.aboutScrollContent}
          >
            {page ? (
              <View style={styles.aboutCopy}>
                <Text style={styles.body}>{bodies[page]}</Text>
                {page === "support" && (
                  <Pressable
                    onPress={() =>
                      open("https://github.com/ieasybooks/mofied/issues")
                    }
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>GitHub</Text>
                  </Pressable>
                )}
                {page === "sources" && (
                  <Pressable
                    onPress={() => open("https://tanzil.net/docs/")}
                    accessibilityRole="link"
                  >
                    <Text style={styles.link}>Tanzil</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.readButton}
                  onPress={() => setPage(null)}
                  accessibilityRole="button"
                >
                  <Text style={styles.ui}>{t.back}</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {rows.map(([Icon, key]) => (
                  <Pressable
                    key={key}
                    style={styles.aboutRow}
                    onPress={() => setPage(key)}
                    accessibilityRole="button"
                  >
                    <View style={styles.rowLead}>
                      <Icon size={20} color="#aaa" />
                      <Text style={styles.rowText}>{t[key]}</Text>
                    </View>
                    <Chevron size={18} color="#888" />
                  </Pressable>
                ))}
                <Pressable
                  style={styles.aboutRow}
                  onPress={() => setLocale(locale === "ar" ? "en" : "ar")}
                  accessibilityRole="button"
                >
                  <View style={styles.rowLead}>
                    <Globe size={20} color="#aaa" />
                    <Text style={styles.rowText}>{t.language}</Text>
                  </View>
                  <View style={styles.rowLead}>
                    <Chevron size={18} color="#888" />
                    <Text style={styles.aboutSubtitle}>
                      {locale === "ar" ? "العربية" : "English"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>
          <Text style={styles.version}>{t.version} 0.1.0</Text>
          {hasPlayback && (
            <>
              <Pressable
                style={styles.resume}
                onPress={close}
                accessibilityRole="button"
              >
                <Play size={18} color="#000" />
                <Text style={styles.resumeText}>{t.resume}</Text>
              </Pressable>
              <Text style={styles.note}>{t.resumeNote}</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  ui: {
    fontFamily: "NotoNaskhUI",
    fontSize: 16,
    color: colors.text,
    writingDirection: "rtl",
  },
  body: {
    fontFamily: "NotoNaskhUI",
    fontSize: 18,
    color: colors.secondary,
    lineHeight: 32,
    textAlign: "right",
    writingDirection: "rtl",
  },
  startup: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    padding: 24,
  },
  startupMark: { width: 64, height: 64 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: "30%" },
  bottomScrim: {
    position: "absolute",
    top: "30%",
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffffff26",
    backgroundColor: "#00000099",
    alignItems: "center",
    justifyContent: "center",
  },
  budget: {
    height: 40,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ffffff26",
    backgroundColor: "#00000099",
  },
  budgetText: { fontFamily: "NotoNaskhUI", fontSize: 14, color: colors.text },
  metadata: { position: "absolute", left: 24, right: 24, gap: 6 },
  speaker: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  portrait: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ffffff26",
  },
  speakerName: {
    fontFamily: "NotoNaskhUI",
    fontSize: 16,
    color: "#e2e2e2",
    flexShrink: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  title: {
    fontFamily: "Thmanyah",
    fontSize: 28,
    lineHeight: 42,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sound: { position: "absolute", left: 20, backgroundColor: "#ffffff08" },
  swipe: { position: "absolute", left: 76, right: 76, alignItems: "center" },
  swipeText: { fontFamily: "NotoNaskhUI", fontSize: 13, color: "#ffffffc4" },
  time: {
    position: "absolute",
    right: 20,
    fontFamily: "Gilroy",
    fontSize: 13,
    color: "#f0f0f0",
    writingDirection: "ltr",
    fontVariant: ["tabular-nums"],
  },
  progress: {
    position: "absolute",
    height: 2,
    left: 20,
    right: 20,
    backgroundColor: "#ffffff38",
  },
  progressFill: { height: 2, backgroundColor: "white" },
  center: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  paused: {
    borderWidth: 1,
    borderColor: "#ffffff30",
    padding: 18,
    borderRadius: 40,
    backgroundColor: "#00000055",
  },
  errorBox: {
    width: "85%",
    gap: 18,
    padding: 24,
    backgroundColor: "#0a0a0aee",
    borderRadius: 20,
  },
  reminderBody: {
    position: "absolute",
    top: "25%",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  kind: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#ffffff2e",
    borderRadius: 24,
  },
  verses: {
    fontFamily: "Kitab",
    fontSize: 30,
    lineHeight: 59,
    color: colors.text,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 36,
  },
  reminderText: {
    fontFamily: "NotoNaskhUI",
    fontSize: 24,
    lineHeight: 42,
    color: colors.text,
    textAlign: "center",
    marginTop: 36,
  },
  rule: {
    height: 1,
    width: 32,
    backgroundColor: "#ffffff26",
    marginVertical: 24,
  },
  citation: {
    fontFamily: "NotoNaskhUI",
    fontSize: 16,
    color: "#c4c4c4",
    textAlign: "center",
    writingDirection: "rtl",
  },
  reminderBottom: { position: "absolute", left: 24, right: 24 },
  countdown: {
    fontFamily: "NotoNaskhUI",
    fontSize: 16,
    color: "#d6d6d6",
    textAlign: "center",
  },
  countTrack: {
    height: 2,
    backgroundColor: "#ffffff24",
    marginTop: 18,
    marginBottom: 24,
    marginHorizontal: 8,
    alignItems: "flex-end",
  },
  countFill: { height: 2, backgroundColor: "white" },
  readButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ffffff38",
    borderRadius: 28,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
    backgroundColor: "#ffffff05",
  },
  source: {
    fontFamily: "NotoNaskhUI",
    fontSize: 13,
    color: "#a3a3a3",
    textAlign: "center",
    marginTop: 18,
  },
  ending: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  endMark: { width: 72, height: 72, marginBottom: 32 },
  endTitle: {
    fontFamily: "Thmanyah",
    fontSize: 26,
    lineHeight: 39,
    color: colors.text,
    textAlign: "center",
    writingDirection: "rtl",
  },
  endBody: {
    fontFamily: "NotoNaskhUI",
    fontSize: 18,
    lineHeight: 34,
    color: "#c9c9c9",
    maxWidth: 316,
    textAlign: "center",
    writingDirection: "rtl",
  },
  modal: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  backdrop: { backgroundColor: "#00000088" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 34,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 520,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "#ffffff1c",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#ffffff35",
    position: "absolute",
    top: 10,
    alignSelf: "center",
  },
  aboutHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingLeft: 44,
  },
  aboutIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  aboutName: {
    fontFamily: "Thmanyah",
    fontSize: 22,
    lineHeight: 33,
    color: colors.text,
    textAlign: "right",
  },
  aboutSubtitle: {
    fontFamily: "NotoNaskhUI",
    fontSize: 15,
    color: colors.secondary,
    textAlign: "right",
  },
  close: {
    position: "absolute",
    left: 20,
    top: 30,
    backgroundColor: "#ffffff08",
    borderWidth: 0,
  },
  aboutScroll: { marginTop: 28 },
  aboutScrollContent: { flexGrow: 1 },
  aboutRow: {
    minHeight: 56,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff12",
  },
  rowLead: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  rowText: { fontFamily: "NotoNaskhUI", fontSize: 17, color: "#ececec" },
  version: {
    fontFamily: "NotoNaskhUI",
    fontSize: 14,
    color: "#9a9a9a",
    textAlign: "center",
    marginVertical: 16,
  },
  resume: {
    height: 52,
    borderRadius: 28,
    backgroundColor: "white",
    flexDirection: "row-reverse",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeText: { fontFamily: "NotoNaskhUIBold", fontSize: 17, color: "black" },
  note: {
    fontFamily: "NotoNaskhUI",
    fontSize: 14,
    color: "#9a9a9a",
    textAlign: "center",
    marginTop: 12,
  },
  aboutCopy: { gap: 18 },
  link: {
    fontFamily: "Gilroy",
    fontSize: 16,
    color: "white",
    textDecorationLine: "underline",
  },
});
