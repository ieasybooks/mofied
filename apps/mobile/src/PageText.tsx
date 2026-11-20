import { StyleSheet, Text, View, type TextStyle } from "react-native";
import { colors, inline, type Page, type PageId } from "@mofied/design";

/**
 * One of the About pages. Its links open in the browser or the mail app, and
 * a link to another of these pages opens it in place.
 */
export function PageText({
  page,
  textStyle,
  titleStyle,
  openUrl,
  openPage,
}: {
  page: Page;
  /** The UI font, direction and alignment for the language. */
  textStyle: TextStyle;
  /** Direction and alignment for headings. */
  titleStyle: TextStyle;
  openUrl: (url: string) => void;
  openPage: (page: PageId) => void;
}) {
  return (
    <View>
      {page.updated && (
        <Text style={[styles.updated, textStyle]}>{page.updated}</Text>
      )}
      {page.sections.map((section, index) => (
        <View key={index} style={index > 0 && styles.section}>
          {section.heading && (
            <Text
              accessibilityRole="header"
              style={[styles.heading, titleStyle]}
            >
              {section.heading}
            </Text>
          )}
          {section.paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              style={[styles.body, textStyle, index > 0 && styles.next]}
            >
              {inline(paragraph).map((part, index) =>
                "page" in part || "href" in part ? (
                  <Text
                    key={index}
                    accessibilityRole="link"
                    style={styles.link}
                    onPress={() =>
                      "page" in part ? openPage(part.page) : openUrl(part.href)
                    }
                  >
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  updated: { fontSize: 14, lineHeight: 22, color: "#9a9a9a", marginBottom: 14 },
  section: { marginTop: 24 },
  heading: {
    fontFamily: "Thmanyah",
    fontSize: 20,
    lineHeight: 32,
    color: colors.text,
    marginBottom: 4,
  },
  body: { fontSize: 18, lineHeight: 32, color: colors.secondary },
  next: { marginTop: 12 },
  link: { color: colors.text, textDecorationLine: "underline" },
});
