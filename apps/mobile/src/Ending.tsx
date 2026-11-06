import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SessionPlan } from "@mofied/contracts";
import { colors } from "@mofied/design";

export function Ending({
  ending,
  locale,
}: {
  ending: SessionPlan["ending"];
  locale: SessionPlan["locale"];
}) {
  const insets = useSafeAreaInsets();
  const direction = {
    writingDirection: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Image
        source={require("../../../packages/design/assets/icons/icon-white-1024.png")}
        style={styles.mark}
      />
      <Text style={[styles.title, direction]}>{ending.title}</Text>
      <View style={styles.rule} />
      <Text style={[styles.body, direction]}>{ending.body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { width: 72, height: 72, marginBottom: 32 },
  title: {
    fontFamily: "Thmanyah",
    fontSize: 26,
    lineHeight: 39,
    color: colors.text,
    textAlign: "center",
  },
  rule: {
    height: 1,
    width: 32,
    backgroundColor: "#ffffff26",
    marginVertical: 24,
  },
  body: {
    fontFamily: "NotoNaskhUI",
    fontSize: 18,
    lineHeight: 34,
    color: "#c9c9c9",
    maxWidth: 420,
    textAlign: "center",
  },
});
