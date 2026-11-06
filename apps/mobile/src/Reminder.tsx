import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Pause, Play } from "lucide-react-native";
import type { ReminderItem } from "@mofied/contracts";
import type { SessionController, SessionSnapshot } from "@mofied/session";
import {
  colors,
  copy,
  countdownLabel,
  formatCitation,
  type Locale,
} from "@mofied/design";

export function Reminder({
  item,
  session,
  state,
  locale,
}: {
  item: ReminderItem;
  session: SessionController;
  state: SessionSnapshot;
  locale: Locale;
}) {
  const insets = useSafeAreaInsets();
  const t = copy[locale];
  const contentIsArabic =
    item.content.kind === "quran" || session.plan.locale === "ar";
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <LinearGradient
        colors={["#181818", "#0a0a0a"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        testID="reminder-reading-region"
      >
        <View style={styles.kind}>
          <BookOpen size={18} color="#d6d6d6" />
          <Text style={styles.ui}>
            {item.content.kind === "quran" ? t.quran : t.reflection}
          </Text>
        </View>
        <Text
          style={[
            item.content.kind === "quran" ? styles.verses : styles.text,
            { writingDirection: contentIsArabic ? "rtl" : "ltr" },
            !contentIsArabic && { fontFamily: "Gilroy" },
          ]}
        >
          {item.content.body}
        </Text>
        <View style={styles.rule} />
        <Text
          style={[
            styles.citation,
            { writingDirection: session.plan.locale === "ar" ? "rtl" : "ltr" },
          ]}
          testID="reminder-citation"
        >
          {formatCitation(item.content.citation)}
        </Text>
      </ScrollView>
      <View style={styles.footer} testID="reminder-controls">
        <Text style={styles.countdown}>
          {countdownLabel(state.reminderRemainingMs, locale)}
        </Text>
        <View
          style={styles.track}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t.reflection}
          accessibilityValue={{
            min: 0,
            max: item.durationMs / 1000,
            now: Math.ceil(state.reminderRemainingMs / 1000),
          }}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${(state.reminderRemainingMs / item.durationMs) * 100}%`,
              },
            ]}
          />
        </View>
        <Pressable
          style={styles.button}
          accessibilityRole="button"
          onPress={session.togglePlayback}
        >
          {state.wantsToPlay ? (
            <Pause color="white" size={18} />
          ) : (
            <Play color="white" size={18} />
          )}
          <Text style={[styles.ui, styles.buttonText]}>
            {state.wantsToPlay ? t.pauseRead : t.resumeRead}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, gap: 20 },
  scroll: { flex: 1, minHeight: 0 },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  kind: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ffffff2e",
    borderRadius: 24,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  ui: { fontFamily: "NotoNaskhUI", fontSize: 16, color: colors.text },
  verses: {
    fontFamily: "Kitab",
    fontSize: 30,
    lineHeight: 58,
    color: colors.text,
    textAlign: "center",
    marginTop: 36,
  },
  text: {
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
  },
  footer: { flexShrink: 0 },
  countdown: {
    fontFamily: "NotoNaskhUI",
    fontSize: 16,
    color: "#d6d6d6",
    textAlign: "center",
  },
  track: {
    height: 2,
    backgroundColor: "#ffffff24",
    marginTop: 18,
    marginBottom: 24,
    marginHorizontal: 8,
    alignItems: "flex-end",
  },
  fill: { height: 2, backgroundColor: "white" },
  button: {
    minHeight: 48,
    paddingVertical: 10,
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
  buttonText: { flexShrink: 1, textAlign: "center" },
});
