import type { ConfigContext, ExpoConfig } from "expo/config";
import { buildNumber } from "@ieasybooks/release/build-number";
import { version } from "./package.json";

// The apps' version is apps/mobile/package.json's, which release-please raises;
// the build numbers follow from it.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name!,
  slug: config.slug!,
  version,
  ios: { ...config.ios, buildNumber: String(buildNumber(version)) },
  android: { ...config.android, versionCode: buildNumber(version) },
});
