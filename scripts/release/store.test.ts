import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  length,
  pngSize,
  problems,
  readStore,
  writeFastlaneMetadata,
} from "./store.ts";
import { releaseInfoProblems } from "./release-info.ts";

// A PNG header is all the checks read.
function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

// A copy of the repository's store/ to change.
function copyOfStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "mofied-store-"));
  temps.push(dir);
  cpSync("store", dir, { recursive: true });
  return dir;
}

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
}

describe("store/", () => {
  it("is ready for the version in package.json", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    expect(problems(readStore(), version)).toEqual([]);
  });

  it("needs release notes for the version", () => {
    expect(problems(readStore(), "9.9.9")).toEqual([
      "store/release-notes/9.9.9/ar.txt is missing or empty",
    ]);
  });

  it("reports texts over each store's limits, counting characters", () => {
    const root = copyOfStore();
    writeFileSync(join(root, "ar/name.txt"), "م".repeat(31));
    writeFileSync(join(root, "ar/short-description.txt"), "م".repeat(80));
    writeFileSync(join(root, "ar/keywords.txt"), "");
    writeFileSync(join(root, "release-notes/0.1.2/ar.txt"), "م".repeat(501));
    writeFileSync(join(root, "review-notes/appgallery.txt"), "Too short");
    expect(problems(readStore(root), "0.1.2")).toEqual([
      `${root}/ar/name.txt has 31 characters, over 30: Google Play title (30), AppGallery app name (64)`,
      `${root}/ar/keywords.txt is missing or empty`,
      `${root}/release-notes/0.1.2/ar.txt has 501 characters, over 500: Google Play release notes (500), AppGallery new features (500), App Store (4000)`,
      `${root}/review-notes/appgallery.txt is shorter than 10 characters`,
    ]);
  });

  it("reports missing files", () => {
    const root = copyOfStore();
    rmSync(join(root, "ar/subtitle.txt"));
    rmSync(join(root, "review-notes/app-store.txt"));
    expect(problems(readStore(root), "0.1.2")).toEqual([
      `${root}/ar/subtitle.txt is missing or empty`,
      `${root}/review-notes/app-store.txt is missing or empty`,
    ]);
  });

  it("reports images each store won't take", () => {
    const root = copyOfStore();
    const shots = join(root, "screenshots");
    writeFileSync(
      join(shots, "app-store/ar/iphone/01-watch.png"),
      png(1080, 1920),
    );
    writeFileSync(
      join(shots, "app-store/ar/ipad/06-extra.png"),
      png(2752, 2064),
    ); // landscape is fine
    writeFileSync(join(shots, "google-play/ar/icon.png"), png(1024, 1024));
    writeFileSync(
      join(shots, "google-play/ar/phone/06-tall.png"),
      png(1080, 2400),
    );
    writeFileSync(
      join(shots, "google-play/ar/phone/07-text.png"),
      "not an image",
    );
    rmSync(join(shots, "google-play/ar/feature-graphic.png"));
    for (const file of ["01-watch.png", "02-swipe.png", "03-reflect.png"])
      rmSync(join(shots, "appgallery/ar/phone", file));
    expect(problems(readStore(root), "0.1.2")).toEqual([
      `${shots}/app-store/ar/iphone/01-watch.png is 1080x1920; app-store takes 1320x2868, 1290x2796, 1206x2622, 1284x2778, 1242x2688`,
      `${shots}/google-play/ar/icon.png is 1024x1024; google-play takes 512x512`,
      `${shots}/google-play/ar/feature-graphic.png needs 1 PNG file, found 0`,
      `${shots}/google-play/ar/phone/06-tall.png is 1080x2400; Google Play screenshots are 320 to 3840 pixels a side, at most 2:1`,
      `${shots}/google-play/ar/phone/07-text.png: isn't a PNG`,
      `${shots}/appgallery/ar/phone needs 3 to 5 PNG files, found 2`,
    ]);
  });

  it("counts characters, not UTF-16 units", () => {
    expect(length("مفيد")).toBe(4);
    expect(length("🕋📖")).toBe(2);
  });

  it("reads PNG sizes", () => {
    expect(pngSize(png(1206, 2622))).toEqual({ width: 1206, height: 2622 });
    expect(
      pngSize(
        readFileSync("store/screenshots/google-play/ar/feature-graphic.png"),
      ),
    ).toEqual({ width: 1024, height: 500 });
    expect(() =>
      pngSize(Buffer.from("GIF89a and more bytes than a header")),
    ).toThrow("isn't a PNG");
  });
});

describe("writeFastlaneMetadata", () => {
  it("lays store/ out for deliver and supply", () => {
    const out = mkdtempSync(join(tmpdir(), "mofied-fastlane-"));
    temps.push(out);
    const store = readStore();
    writeFastlaneMetadata(store, "0.1.2", 3, out);
    const read = (path: string) => readFileSync(join(out, path), "utf8");
    const listing = store.listings.ar;
    const notes = readFileSync(
      "store/release-notes/0.1.2/ar.txt",
      "utf8",
    ).trim();

    expect(read("app-store/metadata/ar-SA/name.txt")).toBe(
      listing.appStoreName,
    );
    expect(read("app-store/metadata/ar-SA/subtitle.txt")).toBe(
      listing.subtitle,
    );
    expect(read("app-store/metadata/ar-SA/promotional_text.txt")).toBe(
      listing.shortDescription,
    );
    expect(read("app-store/metadata/ar-SA/description.txt")).toBe(
      listing.description,
    );
    expect(read("app-store/metadata/ar-SA/keywords.txt")).toBe(
      listing.keywords,
    );
    expect(read("app-store/metadata/ar-SA/release_notes.txt")).toBe(notes);
    expect(read("app-store/metadata/ar-SA/privacy_url.txt")).toBe(
      "https://mofied.com/privacy/",
    );
    expect(read("app-store/metadata/review_information/notes.txt")).toBe(
      store.reviewNotes.appStore,
    );

    expect(read("google-play/metadata/ar/title.txt")).toBe(listing.name);
    expect(read("google-play/metadata/ar/short_description.txt")).toBe(
      listing.shortDescription,
    );
    expect(read("google-play/metadata/ar/full_description.txt")).toBe(
      listing.description,
    );
    expect(read("google-play/metadata/ar/changelogs/3.txt")).toBe(notes);

    const shots = [
      "01-watch.png",
      "02-swipe.png",
      "03-reflect.png",
      "04-speaker.png",
      "05-finish.png",
    ];
    expect(files(join(out, "app-store/screenshots"))).toEqual([
      ...shots.map((file) => `ar-SA/ipad-${file}`),
      ...shots.map((file) => `ar-SA/iphone-${file}`),
    ]);
    expect(files(join(out, "google-play/metadata/ar/images"))).toEqual([
      "featureGraphic.png",
      "icon.png",
      ...shots.map((file) => `phoneScreenshots/${file}`),
      ...shots.map((file) => `sevenInchScreenshots/${file}`),
      ...shots.map((file) => `tenInchScreenshots/${file}`),
    ]);
    expect(
      readFileSync(
        join(out, "app-store/screenshots/ar-SA/iphone-01-watch.png"),
      ),
    ).toEqual(
      readFileSync("store/screenshots/app-store/ar/iphone/01-watch.png"),
    );
  });
});

describe("releaseInfoProblems", () => {
  const info = { version: "0.1.2", iosBuildNumber: "3", androidVersionCode: 3 };

  it("accepts the matching tag, or none", () => {
    expect(releaseInfoProblems(info, "v0.1.2")).toEqual([]);
    expect(releaseInfoProblems(info)).toEqual([]);
  });

  it("reports a tag for another version", () => {
    expect(releaseInfoProblems(info, "v0.1.3")).toEqual([
      "the tag v0.1.3 doesn't match package.json's version 0.1.2; tag v0.1.2",
    ]);
    expect(releaseInfoProblems(info, "0.1.2")).toHaveLength(1);
  });

  it("reports versions and build numbers the stores won't take", () => {
    expect(
      releaseInfoProblems({
        version: "0.1",
        iosBuildNumber: "03",
        androidVersionCode: 0,
      }),
    ).toEqual([
      "package.json's version 0.1 isn't MAJOR.MINOR.PATCH",
      `apps/mobile/app.json's ios.buildNumber "03" isn't a positive whole number`,
      "apps/mobile/app.json's android.versionCode 0 isn't a positive whole number",
    ]);
  });
});
