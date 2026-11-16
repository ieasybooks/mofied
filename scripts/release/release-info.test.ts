import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildNumber } from "../../apps/mobile/build-number.js";
import {
  readReleaseInfo,
  readVersion,
  releaseInfo,
  releaseInfoProblems,
} from "./release-info.ts";

describe("buildNumber", () => {
  it("gives each version its own number, rising with the version", () => {
    expect(buildNumber("0.1.3")).toBe(1003);
    expect(buildNumber("0.2.0")).toBe(2000);
    expect(buildNumber("1.0.0")).toBe(1_000_000);
    expect(buildNumber("1.2.3")).toBe(1_002_003);
    expect(buildNumber("2100.0.0")).toBe(2_100_000_000);
    const ordered = [
      "0.0.1",
      "0.1.3",
      "0.1.999",
      "0.2.0",
      "0.999.999",
      "1.0.0",
    ];
    const numbers = ordered.map(buildNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("is above the build number 0.1.2 shipped with", () => {
    expect(buildNumber("0.1.3")).toBeGreaterThan(3);
  });

  it("refuses versions the stores can't number", () => {
    for (const version of ["0.1", "v0.1.3", "0.1.3-beta.1", "01.2.3", ""])
      expect(() => buildNumber(version)).toThrow("isn't MAJOR.MINOR.PATCH");
    expect(() => buildNumber("0.1000.0")).toThrow("go up to 999");
    expect(() => buildNumber("0.1.1000")).toThrow("go up to 999");
    expect(() => buildNumber("0.0.0")).toThrow("from 0.0.1 to 2100.0.0");
    expect(() => buildNumber("2100.0.1")).toThrow("from 0.0.1 to 2100.0.0");
  });
});

describe("releaseInfo", () => {
  it("numbers both platforms' builds from the version", () => {
    expect(releaseInfo("0.1.3")).toEqual({
      version: "0.1.3",
      iosBuildNumber: "1003",
      androidVersionCode: 1003,
    });
  });

  it("reads the version from apps/mobile/package.json", () => {
    expect(readReleaseInfo()).toEqual(releaseInfo(readVersion()));
  });

  it("prints itself as JSON for fastlane, as Expo's config numbers the builds", () => {
    const printed = JSON.parse(
      execFileSync("bun", ["scripts/release/release-info.ts"], {
        encoding: "utf8",
      }),
    );
    expect(printed).toEqual(readReleaseInfo());

    const expo = JSON.parse(
      execFileSync("bunx", ["expo", "config", "--type", "public", "--json"], {
        cwd: "apps/mobile",
        encoding: "utf8",
      }),
    );
    expect({
      version: expo.version,
      iosBuildNumber: expo.ios.buildNumber,
      androidVersionCode: expo.android.versionCode,
    }).toEqual(printed);
  }, 60_000);
});

describe("releaseInfoProblems", () => {
  it("accepts the matching tag, or none", () => {
    expect(releaseInfoProblems("0.1.3", "v0.1.3")).toEqual([]);
    expect(releaseInfoProblems("0.1.3")).toEqual([]);
  });

  it("reports a tag for another version", () => {
    expect(releaseInfoProblems("0.1.3", "v0.1.4")).toEqual([
      "the tag v0.1.4 doesn't match apps/mobile/package.json's version 0.1.3; tag v0.1.3",
    ]);
    expect(releaseInfoProblems("0.1.3", "0.1.3")).toHaveLength(1);
    expect(releaseInfoProblems("0.1.3", "web-v0.1.3")).toHaveLength(1);
  });

  it("reports versions the stores can't number", () => {
    expect(releaseInfoProblems("0.1")).toEqual([
      "apps/mobile/package.json: the version 0.1 isn't MAJOR.MINOR.PATCH",
    ]);
    expect(releaseInfoProblems("0.1.1000")).toHaveLength(1);
  });
});
