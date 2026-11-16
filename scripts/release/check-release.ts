// Checks that a release can go out: the tag matches the version, the build
// numbers are set, and store/ has everything every store needs within its
// limits. The release workflow runs it first; run it before tagging too:
//
//   bun run release:check              # the version in package.json
//   bun run release:check -- --tag v0.1.3
//
// In GitHub Actions it also writes version, ios-build-number and
// android-version-code to the step's outputs.

import { appendFileSync } from "node:fs";
import { problems, readStore } from "./store.ts";
import { readReleaseInfo, releaseInfoProblems } from "./release-info.ts";

const tagIndex = process.argv.indexOf("--tag");
const tag = tagIndex === -1 ? undefined : process.argv[tagIndex + 1];

const info = readReleaseInfo();
const found = [
  ...releaseInfoProblems(info, tag),
  ...problems(readStore(), info.version),
];

if (found.length > 0) {
  console.error(`Mofied ${info.version} can't be released yet:`);
  for (const problem of found) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `Mofied ${info.version} (iOS build ${info.iosBuildNumber}, Android version code ${info.androidVersionCode}) is ready to release.`,
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${info.version}\nios-build-number=${info.iosBuildNumber}\nandroid-version-code=${info.androidVersionCode}\n`,
  );
}
