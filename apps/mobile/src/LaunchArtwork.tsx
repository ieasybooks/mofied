import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { colors, copy, type Locale } from "@mofied/design";

/** Match the native launch image; adding the spinner never moves the mark. */
export function LaunchArtwork({ locale = "ar" }: { locale?: Locale }) {
  return (
    <View style={styles.screen} testID="launch-screen" pointerEvents="none">
      <Image
        source={require("../../../packages/design/assets/icons/icon-white-1024.png")}
        style={styles.mark}
        resizeMode="contain"
        accessible={false}
      />
      <ActivityIndicator
        style={styles.loader}
        size="small"
        color={colors.text}
        accessibilityLabel={copy[locale].starting}
        accessibilityState={{ busy: true }}
        testID="launch-loader"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  mark: {
    position: "absolute",
    width: 80,
    height: 80,
    left: "50%",
    top: "50%",
    marginLeft: -40,
    marginTop: -40,
  },
  loader: {
    position: "absolute",
    width: 24,
    height: 24,
    left: "50%",
    top: "50%",
    marginLeft: -12,
    marginTop: 64,
  },
});
