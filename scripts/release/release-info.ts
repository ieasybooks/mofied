// The apps' version being released and its build numbers: the version in
// apps/mobile/package.json, which release-please raises and the apps report,
// and the iOS buildNumber and Android versionCode that follow from it
// (apps/mobile/build-number.js).
//
// Run directly, it prints them as JSON for fastlane:
//
//   bun scripts/release/release-info.ts
//   {"version":"0.1.3","iosBuildNumber":"1003","androidVersionCode":1003}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNumber } from "../../apps/mobile/build-number.js";

export type ReleaseInfo = {
  version: string;
  iosBuildNumber: string;
  androidVersionCode: number;
};

export const VERSION_FILE = "apps/mobile/package.json";

export function readVersion(root = "."): string {
  return (
    JSON.parse(readFileSync(join(root, VERSION_FILE), "utf8")) as {
      version: string;
    }
  ).version;
}

export function releaseInfo(version: string): ReleaseInfo {
  const code = buildNumber(version);
  return { version, iosBuildNumber: String(code), androidVersionCode: code };
}

export function readReleaseInfo(root = "."): ReleaseInfo {
  return releaseInfo(readVersion(root));
}

// Why the version can't be released under the tag, if given.
export function releaseInfoProblems(version: string, tag?: string): string[] {
  const found: string[] = [];
  try {
    buildNumber(version);
  } catch (error) {
    found.push(`${VERSION_FILE}: ${(error as Error).message}`);
  }
  if (tag !== undefined && tag !== `v${version}`) {
    found.push(
      `the tag ${tag} doesn't match ${VERSION_FILE}'s version ${version}; tag v${version}`,
    );
  }
  return found;
}

if (import.meta.main) console.log(JSON.stringify(readReleaseInfo()));
