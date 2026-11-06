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
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
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
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Mail,
  Globe,
} from "lucide-react-native";
import { SessionController } from "@mofied/session";
import { sessionLoadDiagnostic } from "@mofied/contracts";
import {
  appVersion,
  colors,
  copy,
  remainingLabel,
  formatTime,
  type Locale,
} from "@mofied/design";
import { NativeMedia } from "./NativeMedia";
import { loadSession } from "./provider";
import { ContactLinks } from "./ContactLinks";
import { useSessionLifecycle } from "./use-session-lifecycle";
import { Reminder } from "./Reminder";
import { Ending } from "./Ending";
import { openLink } from "./open-link";

const icon = require("../../../packages/design/assets/icons/icon-white-1024.png");
const appIcon = require("../../../packages/design/assets/icons/app-icon-flat-dark-1024.png");
const overlayFadeStops = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
] as const;
const bottomFadeColors = [
  "rgba(0, 0, 0, 0)",
  "rgba(0, 0, 0, 0.017)",
  "rgba(0, 0, 0, 0.064)",
  "rgba(0, 0, 0, 0.134)",
  "rgba(0, 0, 0, 0.218)",
  "rgba(0, 0, 0, 0.31)",
  "rgba(0, 0, 0, 0.402)",
  "rgba(0, 0, 0, 0.486)",
  "rgba(0, 0, 0, 0.556)",
  "rgba(0, 0, 0, 0.603)",
  "rgba(0, 0, 0, 0.62)",
] as const;
const topFadeColors = [
  "rgba(0, 0, 0, 0.45)",
  "rgba(0, 0, 0, 0.437)",
  "rgba(0, 0, 0, 0.403)",
  "rgba(0, 0, 0, 0.353)",
  "rgba(0, 0, 0, 0.292)",
  "rgba(0, 0, 0, 0.225)",
  "rgba(0, 0, 0, 0.158)",
  "rgba(0, 0, 0, 0.097)",
  "rgba(0, 0, 0, 0.047)",
  "rgba(0, 0, 0, 0.013)",
  "rgba(0, 0, 0, 0)",
] as const;
const storageKey = `mofied.session.v1.${__DEV__ ? "development" : "production"}`;
const subscribeWithoutSession = () => () => {};

export default function App() {
  const [fonts, fontError] = useFonts({
    Thmanyah: require("../../../packages/design/assets/fonts/ThmanyahSerifDisplay-Medium.ttf"),
    NotoNaskhUI: require("../../../packages/design/assets/fonts/NotoNaskhArabicUI-400.ttf"),
    NotoNaskhUIBold: require("../../../packages/design/assets/fonts/NotoNaskhArabicUI-600.ttf"),
    Kitab: require("../../../packages/design/assets/fonts/Kitab-Regular.ttf"),
    Gilroy: require("../../../packages/design/assets/fonts/Gilroy-Regular.ttf"),
    GilroyMedium: require("../../../packages/design/assets/fonts/Gilroy-Medium.ttf"),
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
  const hasPlayback = useSyncExternalStore(
    session?.subscribe ?? subscribeWithoutSession,
    () => !!session?.getSnapshot().item,
    () => !!session?.getSnapshot().item,
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locale, setLocale] = useState<Locale>("ar");
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutOpenRef = useRef(false);
  const showAbout = (open: boolean) => {
    aboutOpenRef.current = open;
    setAboutOpen(open);
    if (open) session?.openAbout();
    else session?.closeAbout();
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
      // Android grants focus asynchronously. Gate the very first render too.
      if (Platform.OS === "android") next.setInterrupted(true);
      if (aboutOpenRef.current) next.openAbout();
      if (!abort.signal.aborted) setSession(next);
    })().catch((error: unknown) => {
      if (!abort.signal.aborted) {
        console.warn(
          "[mofied] Session load failed",
          sessionLoadDiagnostic(error),
        );
        setError(true);
      }
    });
    return () => abort.abort();
  }, [attempt]);
  return (
    <View style={styles.root}>
      {session ? (
        <SessionView
          session={session}
          locale={locale}
          openAbout={() => showAbout(true)}
        />
      ) : (
        <View style={styles.startup}>
          <View style={[styles.header, { top: insets.top + 18 }]}>
            <Pressable
              style={styles.circle}
              accessibilityRole="button"
              accessibilityLabel={copy[locale].info}
              onPress={() => showAbout(true)}
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
        </View>
      )}
      <About
        visible={aboutOpen}
        hasPlayback={hasPlayback}
        locale={locale}
        setLocale={setLocale}
        close={() => showAbout(false)}
      />
    </View>
  );
}

function KeepScreenAwake() {
  useKeepAwake("mofied-session");
  return null;
}
function SessionView({
  session,
  locale,
  openAbout,
}: {
  session: SessionController;
  locale: Locale;
  openAbout: () => void;
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
  const contentIsArabic = session.plan.locale === "ar";
  const contentText: TextStyle = {
    writingDirection: contentIsArabic ? "rtl" : "ltr",
    textAlign: contentIsArabic ? "right" : "left",
  };
  useSessionLifecycle(session, storageKey);
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
            colors={topFadeColors}
            locations={overlayFadeStops}
            style={[styles.topScrim, { height: insets.top + 110 }]}
            pointerEvents="none"
          />
          <View
            style={StyleSheet.absoluteFill}
            {...gestures.panHandlers}
            accessible
            testID="media-controls"
            accessibilityRole="button"
            accessibilityLabel={state.shouldPlay ? t.pause : t.play}
            onAccessibilityTap={session.togglePlayback}
            accessibilityActions={[
              { name: "activate", label: state.shouldPlay ? t.pause : t.play },
              ...(state.canNext ? [{ name: "next", label: t.next }] : []),
              ...(state.canPrevious
                ? [{ name: "previous", label: t.previous }]
                : []),
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "next") session.next();
              else if (event.nativeEvent.actionName === "previous")
                session.previous();
              else session.togglePlayback();
            }}
          />
          <View
            style={[styles.mediaBottom, { paddingBottom: insets.bottom + 16 }]}
            pointerEvents="box-none"
            testID="media-bottom"
          >
            <LinearGradient
              colors={bottomFadeColors}
              locations={overlayFadeStops}
              style={styles.bottomFeather}
              pointerEvents="none"
            />
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.62)", "rgba(0, 0, 0, 0.68)"]}
              style={styles.bottomScrim}
              pointerEvents="none"
            />
            <View pointerEvents="box-none">
              <Pressable
                style={[
                  styles.speaker,
                  { flexDirection: contentIsArabic ? "row-reverse" : "row" },
                ]}
                accessibilityRole="link"
                onPress={() => void openLink(item.speaker.pageUrl, locale)}
              >
                {item.speaker.imageUrl && (
                  <Image
                    source={{ uri: item.speaker.imageUrl }}
                    style={styles.portrait}
                  />
                )}
                <Text
                  accessibilityLanguage={session.plan.locale}
                  style={[
                    styles.speakerName,
                    styles.overlayTextShadow,
                    contentText,
                  ]}
                >
                  {item.speaker.name}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => void openLink(item.pageUrl, locale)}
              >
                <Text
                  style={[styles.title, styles.overlayTextShadow, contentText]}
                  accessibilityLanguage={session.plan.locale}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.title}
                </Text>
              </Pressable>
            </View>
            <Text
              style={[styles.time, styles.overlayTextShadow]}
              pointerEvents="none"
            >
              {formatTime(state.positionMs)} / {formatTime(item.durationMs)}
            </Text>
            <View
              style={styles.progress}
              pointerEvents="none"
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
        <Reminder
          key={item.id}
          item={item}
          session={session}
          state={state}
          locale={locale}
        />
      )}
      {!item && <Ending ending={state.ending} locale={session.plan.locale} />}
      <View
        style={[styles.header, { top: insets.top + 18 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerControls} pointerEvents="box-none">
          <Pressable
            style={styles.circle}
            onPress={openAbout}
            accessibilityRole="button"
            accessibilityLabel={t.info}
            hitSlop={4}
          >
            <Info size={21} color="white" />
          </Pressable>
          {item?.kind === "media" && (
            <Pressable
              style={styles.circle}
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
          )}
        </View>
        {item && (
          <View style={styles.budget}>
            <Clock3 size={15} color="#f5f5f5" />
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[
                styles.budgetText,
                { fontFamily: locale === "ar" ? "NotoNaskhUI" : "Gilroy" },
              ]}
            >
              {remainingLabel(state.remainingMs, locale, item.kind)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type AboutPage = "info" | "privacy" | "support";
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
  ] as const;
  const bodies = {
    info: t.aboutBody,
    privacy: t.privacyBody,
    support: t.supportBody,
  };
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight;
  const isArabic = locale === "ar";
  const textDirection: TextStyle = {
    writingDirection: isArabic ? "rtl" : "ltr",
  };
  const textAlignment: TextStyle = { textAlign: isArabic ? "right" : "left" };
  const uiStyle: TextStyle = {
    ...textDirection,
    fontFamily: isArabic ? "NotoNaskhUI" : "Gilroy",
  };
  const rowDirection = {
    flexDirection:
      locale === "ar" ? ("row-reverse" as const) : ("row" as const),
  };
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
          <View
            style={[
              styles.aboutHead,
              rowDirection,
              {
                paddingLeft: isArabic ? 44 : 0,
                paddingRight: isArabic ? 0 : 44,
              },
            ]}
          >
            <Image source={appIcon} style={styles.aboutIcon} />
            <View style={styles.aboutHeadCopy}>
              <Text style={[styles.aboutName, textDirection, textAlignment]}>
                {page ? t[page] : t.name}
              </Text>
              {hasPlayback && (
                <Text style={[styles.aboutSubtitle, uiStyle, textAlignment]}>
                  {t.pausedAbout}
                </Text>
              )}
            </View>
          </View>
          <Pressable
            style={[
              styles.circle,
              styles.close,
              {
                left: isArabic ? 20 : undefined,
                right: isArabic ? undefined : 20,
              },
            ]}
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
                <Text style={[styles.body, uiStyle, textAlignment]}>
                  {bodies[page]}
                </Text>
                {page === "support" && (
                  <ContactLinks
                    locale={locale}
                    open={(url) => void openLink(url, locale)}
                  />
                )}
                <Pressable
                  style={styles.readButton}
                  onPress={() => setPage(null)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ui, uiStyle]}>{t.back}</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {rows.map(([Icon, key]) => (
                  <Pressable
                    key={key}
                    style={[styles.aboutRow, rowDirection]}
                    onPress={() => setPage(key)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.rowLead, rowDirection]}>
                      <Icon size={20} color="#aaa" />
                      <Text style={[styles.rowText, uiStyle]}>{t[key]}</Text>
                    </View>
                    <Chevron size={18} color="#888" />
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.aboutRow, rowDirection]}
                  onPress={() => setLocale(locale === "ar" ? "en" : "ar")}
                  accessibilityRole="button"
                >
                  <View style={[styles.rowLead, rowDirection]}>
                    <Globe size={20} color="#aaa" />
                    <Text style={[styles.rowText, uiStyle]}>{t.language}</Text>
                  </View>
                  <View style={[styles.rowLead, rowDirection]}>
                    <Text
                      style={[styles.aboutSubtitle, uiStyle, textAlignment]}
                    >
                      {locale === "ar" ? "العربية" : "English"}
                    </Text>
                    <Chevron size={18} color="#888" />
                  </View>
                </Pressable>
              </View>
            )}
          </ScrollView>
          <Text style={[styles.version, uiStyle]}>
            {t.version} {appVersion}
          </Text>
          {hasPlayback && (
            <>
              <Pressable
                style={[styles.resume, rowDirection]}
                onPress={close}
                accessibilityRole="button"
              >
                <Play size={18} color="#000" />
                <Text
                  style={[
                    styles.resumeText,
                    textDirection,
                    {
                      fontFamily: isArabic ? "NotoNaskhUIBold" : "GilroyMedium",
                    },
                  ]}
                >
                  {t.resume}
                </Text>
              </Pressable>
              <Text style={[styles.note, uiStyle]}>{t.resumeNote}</Text>
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
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomFeather: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  bottomScrim: {
    position: "absolute",
    top: 80,
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
    gap: 12,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
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
    minHeight: 40,
    flexShrink: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ffffff26",
    backgroundColor: "#00000099",
  },
  budgetText: {
    fontFamily: "NotoNaskhUI",
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  mediaBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  speaker: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    minHeight: 44,
  },
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
    lineHeight: 24,
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
  overlayTextShadow: {
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  time: {
    fontFamily: "Gilroy",
    fontSize: 13,
    lineHeight: 16,
    textAlign: "right",
    marginTop: 4,
    color: "#f0f0f0",
    writingDirection: "ltr",
    fontVariant: ["tabular-nums"],
  },
  progress: {
    height: 2,
    marginTop: 10,
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
  endTitle: {
    fontFamily: "Thmanyah",
    fontSize: 26,
    lineHeight: 39,
    color: colors.text,
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
  },
  aboutHeadCopy: { flex: 1, minWidth: 0 },
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
});
