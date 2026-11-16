// Checks that the apps can be released: the version (in apps/mobile/package.json)
// makes valid build numbers and matches the tag, if given, and
// apps/mobile/store/ has everything every store needs within its limits,
// including the version's release notes. The release workflow runs it first,
// and release-please's workflow runs it on the release pull request:
//
//   bun run release:check              # the version in apps/mobile/package.json
//   bun run release:check -- --tag v0.1.3

import { problems, readStore } from "./store.ts";
import {
  readVersion,
  releaseInfo,
  releaseInfoProblems,
} from "./release-info.ts";

const tagIndex = process.argv.indexOf("--tag");
const tag = tagIndex === -1 ? undefined : process.argv[tagIndex + 1];

const version = readVersion();
const found = [
  ...releaseInfoProblems(version, tag),
  ...problems(readStore(), version),
];

if (found.length > 0) {
  console.error(`Mofied ${version} can't be released yet:`);
  for (const problem of found) console.error(`  - ${problem}`);
  process.exit(1);
}

const info = releaseInfo(version);
console.log(
  `Mofied ${version} (build ${info.iosBuildNumber} on iOS and Android) is ready to release.`,
);
