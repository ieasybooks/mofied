import { Alert, Linking } from "react-native";
import { copy, type Locale } from "@mofied/design";

export async function openLink(url: string, locale: Locale) {
  try {
    await Linking.openURL(url);
  } catch {
    const t = copy[locale];
    Alert.alert(t.linkError, t.linkErrorBody, [{ text: t.close }]);
  }
}
