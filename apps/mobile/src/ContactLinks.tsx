import { Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Mail } from "lucide-react-native";
import { contactLinks, type Locale } from "@mofied/design";

const iconAccessibility =
  Platform.OS === "web" ? { "aria-hidden": true } : { accessible: false };

export function ContactLinks({
  locale,
  open,
}: {
  locale: Locale;
  open: (url: string) => void;
}) {
  return (
    <View
      style={[
        styles.links,
        { flexDirection: locale === "ar" ? "row-reverse" : "row" },
      ]}
    >
      {contactLinks.map((link) => (
        <Pressable
          key={link.id}
          accessibilityRole="link"
          accessibilityLabel={link.label[locale]}
          onPress={() => open(link.href)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          {link.path ? (
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              {...iconAccessibility}
            >
              <Path d={link.path} fill="#e2e2e2" />
            </Svg>
          ) : (
            <Mail size={20} color="#e2e2e2" {...iconAccessibility} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexWrap: "wrap", gap: 8 },
  link: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ffffff26",
    backgroundColor: "#ffffff05",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "#ffffff15", borderColor: "#ffffff55" },
});
