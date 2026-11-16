// The version being released and its build numbers: the version in the root
// package.json (which the apps report), the iOS buildNumber and the Android
// versionCode in apps/mobile/app.json. Each store needs build numbers it
// hasn't seen, so every release raises both.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ReleaseInfo = {
  version: string;
  iosBuildNumber: string;
  androidVersionCode: number;
};

export function readReleaseInfo(root = "."): ReleaseInfo {
  const { version } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ) as { version: string };
  const { expo } = JSON.parse(
    readFileSync(join(root, "apps/mobile/app.json"), "utf8"),
  ) as {
    expo: {
      ios?: { buildNumber?: string };
      android?: { versionCode?: number };
    };
  };
  return {
    version,
    iosBuildNumber: expo.ios?.buildNumber ?? "",
    androidVersionCode: expo.android?.versionCode ?? 0,
  };
}

export function releaseInfoProblems(info: ReleaseInfo, tag?: string): string[] {
  const found: string[] = [];
  if (!/^\d+\.\d+\.\d+$/.test(info.version))
    found.push(
      `package.json's version ${info.version} isn't MAJOR.MINOR.PATCH`,
    );
  if (tag !== undefined && tag !== `v${info.version}`) {
    found.push(
      `the tag ${tag} doesn't match package.json's version ${info.version}; tag v${info.version}`,
    );
  }
  if (!/^[1-9]\d*$/.test(info.iosBuildNumber)) {
    found.push(
      `apps/mobile/app.json's ios.buildNumber "${info.iosBuildNumber}" isn't a positive whole number`,
    );
  }
  if (
    !Number.isInteger(info.androidVersionCode) ||
    info.androidVersionCode < 1
  ) {
    found.push(
      `apps/mobile/app.json's android.versionCode ${info.androidVersionCode} isn't a positive whole number`,
    );
  }
  return found;
}
