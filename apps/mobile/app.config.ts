import type { ConfigContext, ExpoConfig } from "expo/config";
import { version } from "../../package.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name!,
  slug: config.slug!,
  version,
});
