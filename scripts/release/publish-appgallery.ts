// Publishes the release APK to AppGallery (see appgallery.ts):
//
//   bun scripts/release/publish-appgallery.ts <apk> [--dry-run]
//
// APPGALLERY_CONNECT_SERVICE_ACCOUNT holds the service account's key file.
// --dry-run reads AppGallery and reports what a release would change,
// without changing anything.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  AppGallery,
  publishToAppGallery,
  type Io,
  type ServiceAccount,
} from "./appgallery.ts";
import { readReleaseInfo } from "./release-info.ts";
import { readStore } from "./store.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const apkPath = args.find((arg) => !arg.startsWith("--"));
const key = process.env.APPGALLERY_CONNECT_SERVICE_ACCOUNT;
if (!apkPath || !key) {
  console.error(
    "usage: APPGALLERY_CONNECT_SERVICE_ACCOUNT=<key file JSON> bun scripts/release/publish-appgallery.ts <apk> [--dry-run]",
  );
  process.exit(2);
}

const io: Io = {
  fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log: (line) => console.log(line),
};
const store = readStore();
const gallery = new AppGallery(
  JSON.parse(key) as ServiceAccount,
  store.config.appGallery.appId,
  io,
);
await publishToAppGallery({
  gallery,
  store,
  version: readReleaseInfo().version,
  apk: { fileName: basename(apkPath), bytes: readFileSync(apkPath) },
  dryRun,
  io,
});
