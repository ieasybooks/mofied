// Writes store/ in the layouts fastlane reads, for the version in
// package.json: bun scripts/release/write-fastlane-metadata.ts <folder>
// creates <folder>/app-store/{metadata,screenshots} for deliver and
// <folder>/google-play/metadata for supply.

import { rmSync } from "node:fs";
import { readReleaseInfo } from "./release-info.ts";
import { readStore, writeFastlaneMetadata } from "./store.ts";

const out = process.argv[2];
if (!out) {
  console.error(
    "usage: bun scripts/release/write-fastlane-metadata.ts <folder>",
  );
  process.exit(2);
}
const info = readReleaseInfo();
rmSync(out, { recursive: true, force: true });
writeFastlaneMetadata(readStore(), info.version, info.androidVersionCode, out);
console.log(`Wrote the ${info.version} store metadata to ${out}.`);
